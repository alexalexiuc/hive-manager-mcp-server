import 'dotenv/config';
import worker from '../../src/index.js';
import {
  HIVES_SHEET_NAME,
  LOGS_SHEET_NAME,
  HARVESTS_SHEET_NAME,
  TODOS_SHEET_NAME,
  RELOCATIONS_SHEET_NAME,
  SPREADSHEET_ID_HEADER,
} from '../../src/constants.js';
import {
  execWithBackoffRetry,
  isRetryableGoogleQuotaError,
} from '../../src/shared/retry.js';
import { createSheetsClient } from '../../src/services/google.js';
import type { Env } from '../../src/types.js';

type E2EConfig = {
  serviceAccountJson?: string;
  spreadsheetId?: string;
  authApiKey?: string;
};

export type RequiredE2EConfig = {
  serviceAccountJson: string;
  spreadsheetId: string;
  authApiKey: string;
};

function getEnvValue(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

export function getE2EConfig(): E2EConfig {
  return {
    serviceAccountJson: getEnvValue('GOOGLE_SERVICE_ACCOUNT_JSON'),
    spreadsheetId: getEnvValue('E2E_SPREADSHEET_ID'),
    authApiKey: getEnvValue('AUTH_API_KEY'),
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
  if (!config.authApiKey) {
    missing.push('AUTH_API_KEY');
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required e2e environment variables: ${missing.join(', ')}`,
    );
  }

  return {
    serviceAccountJson: config.serviceAccountJson!,
    spreadsheetId: config.spreadsheetId!,
    authApiKey: config.authApiKey!,
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

export function buildE2EEnv(config: E2EConfig): Env {
  if (!config.serviceAccountJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is required for e2e tests.');
  }
  if (!config.authApiKey) {
    throw new Error('AUTH_API_KEY is required for e2e tests.');
  }

  return {
    GOOGLE_SERVICE_ACCOUNT_JSON: config.serviceAccountJson,
    AUTH_API_KEY: config.authApiKey,
  };
}

export async function callMcpMethod(
  env: Env,
  spreadsheetId: string,
  method: string,
  params: Record<string, unknown>,
  id = 1,
): Promise<Record<string, unknown>> {
  return execWithBackoffRetry(async () => {
    const request = new Request('https://example.com/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: `Bearer ${env.AUTH_API_KEY ?? ''}`,
        [SPREADSHEET_ID_HEADER]: spreadsheetId,
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
  );
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
