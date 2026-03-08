import type { Env } from '../types.js';
import { createSheetsClient } from './google.js';
import { ensureSpreadsheetStructure } from './sheets.js';

export function resolveSpreadsheetId(env: Env): string | null {
  if (env.REQUEST_SPREADSHEET_ID && env.REQUEST_SPREADSHEET_ID.trim()) {
    return env.REQUEST_SPREADSHEET_ID.trim();
  }

  if (env.SPREADSHEET_ID && env.SPREADSHEET_ID.trim()) {
    return env.SPREADSHEET_ID.trim();
  }

  return null;
}

export function requireSpreadsheetId(env: Env): string {
  const spreadsheetId = resolveSpreadsheetId(env);
  if (!spreadsheetId) {
    throw new Error('Missing spreadsheet id. Pass x-spreadsheet-id request header.');
  }

  return spreadsheetId;
}

export async function requirePreparedSpreadsheetId(env: Env): Promise<string> {
  const spreadsheetId = requireSpreadsheetId(env);
  const sheets = createSheetsClient(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  await ensureSpreadsheetStructure(sheets, spreadsheetId);
  return spreadsheetId;
}
