import "dotenv/config";
import worker from "../../src/index.js";
import {
  APIARY_TODOS_SHEET_NAME,
  LOGS_SHEET_NAME,
  PROFILES_SHEET_NAME,
  RELOCATIONS_SHEET_NAME,
  SPREADSHEET_NAME,
} from "../../src/constants.js";
import { findFolder, findSpreadsheetInFolder } from "../../src/services/drive.js";
import { createDriveClient, createSheetsClient } from "../../src/services/google.js";
import type { Env } from "../../src/types.js";

type E2EConfig = {
  serviceAccountJson?: string;
  hivesFolderId?: string;
  hivesFolderName: string;
  hivesE2eFolderName: string;
  spreadsheetName: string;
};

function getEnvValue(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

export function getE2EConfig(): E2EConfig {
  return {
    serviceAccountJson: getEnvValue("GOOGLE_SERVICE_ACCOUNT_JSON"),
    hivesFolderId: getEnvValue("HIVES_FOLDER_ID"),
    hivesFolderName: getEnvValue("HIVES_FOLDER_NAME") ?? "Hives",
    hivesE2eFolderName: getEnvValue("HIVES_E2E_FOLDER_NAME") ?? "e2e",
    spreadsheetName: getEnvValue("E2E_SPREADSHEET_NAME") ?? SPREADSHEET_NAME,
  };
}

export type E2ESpreadsheetContext = {
  spreadsheetId: string;
  hivesFolderId: string;
  e2eFolderId: string;
};

export async function resolveE2ESpreadsheetContext(
  config: E2EConfig,
): Promise<E2ESpreadsheetContext> {
  if (!config.serviceAccountJson) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is required for e2e tests.");
  }

  const drive = createDriveClient(config.serviceAccountJson);
  const hivesFolderId =
    config.hivesFolderId ?? (await findFolder(drive, config.hivesFolderName));
  if (!hivesFolderId) {
    throw new Error(
      `Could not find '${config.hivesFolderName}' folder in Google Drive.`,
    );
  }

  const e2eFolderId = await findFolder(
    drive,
    config.hivesE2eFolderName,
    hivesFolderId,
  );
  if (!e2eFolderId) {
    throw new Error(
      `Could not find '${config.hivesFolderName}/${config.hivesE2eFolderName}' folder in Google Drive.`,
    );
  }

  const spreadsheetId = await findSpreadsheetInFolder(
    drive,
    config.spreadsheetName,
    e2eFolderId,
  );
  if (!spreadsheetId) {
    throw new Error(
      `Could not find spreadsheet '${config.spreadsheetName}' in '${config.hivesFolderName}/${config.hivesE2eFolderName}'.`,
    );
  }

  return { spreadsheetId, hivesFolderId, e2eFolderId };
}

export async function prepareAndClearSpreadsheet(
  config: E2EConfig,
  spreadsheetId: string,
): Promise<void> {
  if (!config.serviceAccountJson) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is required for e2e tests.");
  }

  const sheets = createSheetsClient(config.serviceAccountJson);

  await Promise.all([
    sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${LOGS_SHEET_NAME}!A2:Z`,
    }),
    sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${PROFILES_SHEET_NAME}!A2:Z`,
    }),
    sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${APIARY_TODOS_SHEET_NAME}!A2:Z`,
    }),
    sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${RELOCATIONS_SHEET_NAME}!A2:Z`,
    }),
  ]);
}

export function buildE2EEnv(config: E2EConfig, spreadsheetId: string): Env {
  if (!config.serviceAccountJson) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is required for e2e tests.");
  }

  return {
    GOOGLE_SERVICE_ACCOUNT_JSON: config.serviceAccountJson,
    SPREADSHEET_ID: spreadsheetId,
    AUTH_API_KEY: getEnvValue("AUTH_API_KEY") ?? "e2e-local-auth-key",
  };
}

export async function callMcpMethod(
  env: Env,
  method: string,
  params: Record<string, unknown>,
  id = 1,
): Promise<Record<string, unknown>> {
  const request = new Request("https://example.com/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${env.AUTH_API_KEY ?? ""}`,
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

  return JSON.parse(text) as Record<string, unknown>;
}

export async function callTool(
  env: Env,
  toolName: string,
  args: Record<string, unknown> = {},
  id = 1,
): Promise<Record<string, unknown>> {
  return callMcpMethod(
    env,
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
    throw new Error(`Unexpected tool response payload: ${JSON.stringify(rpcResponse)}`);
  }

  return JSON.parse(text) as Record<string, unknown>;
}
