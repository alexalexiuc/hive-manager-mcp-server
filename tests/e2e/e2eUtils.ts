import 'dotenv/config';
import worker from '../../src/index.js';
import {
  HIVES_SHEET_NAME,
  LOGS_SHEET_NAME,
  HARVESTS_SHEET_NAME,
  TODOS_SHEET_NAME,
  RELOCATIONS_SHEET_NAME,
} from '../../src/constants.js';
import {
  MEALS_SHEET_NAME,
  PROFILE_SHEET_NAME,
} from '../../src/calories/constants.js';
import {
  execWithBackoffRetry,
  isRetryableGoogleQuotaError,
} from '../../src/shared/retry.js';
import { createSheetsClient } from '../../src/services/google.js';
import { signToken } from '../../src/http/token.js';
import type { Env } from '../../src/types.js';

type E2EConfig = {
  serviceAccountJson?: string;
  spreadsheetId?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
};

export type RequiredE2EConfig = {
  serviceAccountJson: string;
  spreadsheetId: string;
  oauthClientId: string;
  oauthClientSecret: string;
};

function getEnvValue(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

export function getE2EConfig(): E2EConfig {
  return {
    serviceAccountJson: getEnvValue('GOOGLE_SERVICE_ACCOUNT_JSON'),
    spreadsheetId: getEnvValue('E2E_SPREADSHEET_ID'),
    oauthClientId: getEnvValue('OAUTH_CLIENT_ID'),
    oauthClientSecret: getEnvValue('OAUTH_CLIENT_SECRET'),
  };
}

export function requireE2EConfig(): RequiredE2EConfig {
  const config = getE2EConfig();
  const missing: string[] = [];

  if (!config.serviceAccountJson) {
    missing.push('GOOGLE_SERVICE_ACCOUNT_JSON');
  }
  if (!config.spreadsheetId) {
    missing.push('E2E_SPREADSHEET_ID');
  }
  if (!config.oauthClientId) {
    missing.push('OAUTH_CLIENT_ID');
  }
  if (!config.oauthClientSecret) {
    missing.push('OAUTH_CLIENT_SECRET');
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required e2e environment variables: ${missing.join(', ')}`,
    );
  }

  return {
    serviceAccountJson: config.serviceAccountJson!,
    spreadsheetId: config.spreadsheetId!,
    oauthClientId: config.oauthClientId!,
    oauthClientSecret: config.oauthClientSecret!,
  };
}

export type E2ESpreadsheetContext = {
  spreadsheetId: string;
};

export async function resolveE2ESpreadsheetContext(
  config: E2EConfig,
): Promise<E2ESpreadsheetContext> {
  if (!config.spreadsheetId) {
    throw new Error('E2E_SPREADSHEET_ID is required for e2e tests.');
  }

  return { spreadsheetId: config.spreadsheetId };
}

export async function prepareAndClearSpreadsheet(
  config: E2EConfig,
  spreadsheetId: string,
): Promise<void> {
  if (!config.serviceAccountJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is required for e2e tests.');
  }

  const sheets = createSheetsClient(config.serviceAccountJson);
  const spreadsheet = await execWithBackoffRetry(async () => {
    return sheets.spreadsheets.get({ spreadsheetId });
  });
  const existingTitles = new Set(
    (spreadsheet.data.sheets ?? [])
      .map((sheet) => sheet.properties?.title)
      .filter((title): title is string => Boolean(title)),
  );
  const ranges = [
    HIVES_SHEET_NAME,
    LOGS_SHEET_NAME,
    HARVESTS_SHEET_NAME,
    TODOS_SHEET_NAME,
    RELOCATIONS_SHEET_NAME,
  ]
    .filter((sheetName) => existingTitles.has(sheetName))
    .map((sheetName) => `${sheetName}!A2:Z`);

  if (ranges.length === 0) {
    return;
  }

  await execWithBackoffRetry(async () => {
    await sheets.spreadsheets.values.batchClear({
      spreadsheetId,
      requestBody: {
        ranges,
      },
    });
  });
}

export async function prepareAndClearCaloriesSpreadsheet(
  config: E2EConfig,
  spreadsheetId: string,
): Promise<void> {
  if (!config.serviceAccountJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is required for e2e tests.');
  }

  const sheets = createSheetsClient(config.serviceAccountJson);
  const spreadsheet = await execWithBackoffRetry(async () => {
    return sheets.spreadsheets.get({ spreadsheetId });
  });
  const existingTitles = new Set(
    (spreadsheet.data.sheets ?? [])
      .map((sheet) => sheet.properties?.title)
      .filter((title): title is string => Boolean(title)),
  );
  const ranges = [MEALS_SHEET_NAME, PROFILE_SHEET_NAME]
    .filter((sheetName) => existingTitles.has(sheetName))
    .map((sheetName) => `${sheetName}!A2:Z`);

  if (ranges.length === 0) {
    return;
  }

  await execWithBackoffRetry(async () => {
    await sheets.spreadsheets.values.batchClear({
      spreadsheetId,
      requestBody: { ranges },
    });
  });
}

export function buildE2EEnv(config: E2EConfig): Env {
  if (!config.serviceAccountJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is required for e2e tests.');
  }
  if (!config.oauthClientId) {
    throw new Error('OAUTH_CLIENT_ID is required for e2e tests.');
  }
  if (!config.oauthClientSecret) {
    throw new Error('OAUTH_CLIENT_SECRET is required for e2e tests.');
  }

  return {
    GOOGLE_SERVICE_ACCOUNT_JSON: config.serviceAccountJson,
    OAUTH_CLIENT_ID: config.oauthClientId,
    OAUTH_CLIENT_SECRET: config.oauthClientSecret,
  };
}

export async function callMcpMethod(
  env: Env,
  spreadsheetId: string,
  method: string,
  params: Record<string, unknown>,
  id = 1,
  endpoint = 'apiary',
): Promise<Record<string, unknown>> {
  const accessToken = await signToken(
    { client_id: env.OAUTH_CLIENT_ID, exp: Date.now() + 3600 * 1000 },
    env.OAUTH_CLIENT_SECRET,
  );

  return execWithBackoffRetry(async () => {
    const request = new Request(`https://example.com/${endpoint}/${spreadsheetId}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id,
        method,
        params,
      }),
    });

    const response = await worker.fetch(request, env);
    const text = await response.text();
    if (response.status !== 200) {
      throw new Error(`MCP request failed with ${response.status}: ${text}`);
    }

    const rpc = JSON.parse(text) as Record<string, unknown>;
    const rpcError = rpc.error as { message?: unknown } | undefined;
    if (
      rpcError?.message &&
      isRetryableGoogleQuotaError(String(rpcError.message))
    ) {
      throw new Error(String(rpcError.message));
    }

    const result = rpc.result as
      | { content?: Array<{ text?: unknown }>; isError?: unknown }
      | undefined;
    const firstText = result?.content?.[0]?.text;
    if (
      result?.isError &&
      typeof firstText === 'string' &&
      isRetryableGoogleQuotaError(firstText)
    ) {
      throw new Error(firstText);
    }

    return rpc;
  });
}

export async function callTool(
  env: Env,
  spreadsheetId: string,
  toolName: string,
  args: Record<string, unknown> = {},
  id = 1,
  endpoint = 'apiary',
): Promise<Record<string, unknown>> {
  return callMcpMethod(
    env,
    spreadsheetId,
    'tools/call',
    {
      name: toolName,
      arguments: args,
    },
    id,
    endpoint,
  );
}

export async function callCaloriesTool(
  env: Env,
  spreadsheetId: string,
  toolName: string,
  args: Record<string, unknown> = {},
  id = 1,
): Promise<Record<string, unknown>> {
  return callTool(env, spreadsheetId, toolName, args, id, 'calories');
}

export function extractToolJson(
  rpcResponse: Record<string, unknown>,
): Record<string, unknown> {
  const result = rpcResponse.result as Record<string, unknown> | undefined;
  const content = result?.content as Array<Record<string, unknown>> | undefined;
  const text = content?.[0]?.text;

  if (typeof text !== 'string') {
    throw new Error(
      `Unexpected tool response payload: ${JSON.stringify(rpcResponse)}`,
    );
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Tool response is not valid JSON: ${text}`);
  }
}
