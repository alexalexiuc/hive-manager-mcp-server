import "dotenv/config";
import worker from "../../src/index.js";
import {
  APIARY_TODOS_SHEET_NAME,
  LOGS_SHEET_NAME,
  PROFILES_SHEET_NAME,
  RELOCATIONS_SHEET_NAME,
  SPREADSHEET_ID_HEADER,
} from "../../src/constants.js";
import {
  execWithBackoffRetry,
  isRetryableGoogleQuotaError,
} from "../../src/shared/retry.js";
import { createSheetsClient } from "../../src/services/google.js";
import type { Env } from "../../src/types.js";

type E2EConfig = {
  serviceAccountJson?: string;
  spreadsheetId?: string;
};

function getEnvValue(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

export function getE2EConfig(): E2EConfig {
  return {
    serviceAccountJson: getEnvValue("GOOGLE_SERVICE_ACCOUNT_JSON"),
    spreadsheetId: getEnvValue("E2E_SPREADSHEET_ID") ?? getEnvValue("SPREADSHEET_ID"),
  };
}

export type E2ESpreadsheetContext = {
  spreadsheetId: string;
};

export async function resolveE2ESpreadsheetContext(
  config: E2EConfig,
): Promise<E2ESpreadsheetContext> {
  if (!config.spreadsheetId) {
    throw new Error(
      "E2E_SPREADSHEET_ID (or SPREADSHEET_ID) is required for e2e tests.",
    );
  }

  return { spreadsheetId: config.spreadsheetId };
}

export async function prepareAndClearSpreadsheet(
  config: E2EConfig,
  spreadsheetId: string,
): Promise<void> {
  if (!config.serviceAccountJson) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is required for e2e tests.");
  }

  const sheets = createSheetsClient(config.serviceAccountJson);
  await execWithBackoffRetry(async () => {
    await sheets.spreadsheets.values.batchClear({
      spreadsheetId,
      requestBody: {
        ranges: [
          `${LOGS_SHEET_NAME}!A2:Z`,
          `${PROFILES_SHEET_NAME}!A2:Z`,
          `${APIARY_TODOS_SHEET_NAME}!A2:Z`,
          `${RELOCATIONS_SHEET_NAME}!A2:Z`,
        ],
      },
    });
  });
}

export function buildE2EEnv(config: E2EConfig): Env {
  if (!config.serviceAccountJson) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is required for e2e tests.");
  }

  return {
    GOOGLE_SERVICE_ACCOUNT_JSON: config.serviceAccountJson,
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
    const request = new Request("https://example.com/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        [SPREADSHEET_ID_HEADER]: spreadsheetId,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
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
      typeof firstText === "string" &&
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
    "tools/call",
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

  if (typeof text !== "string") {
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
