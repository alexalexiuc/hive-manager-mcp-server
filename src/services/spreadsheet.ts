import { SPREADSHEET_NAME } from '../constants.js';
import type { Env } from '../types.js';
import { findSpreadsheet } from './drive.js';
import { createDriveClient, createSheetsClient } from './google.js';
import { ensureSpreadsheetStructure } from './sheets.js';

export async function resolveSpreadsheetId(env: Env): Promise<string | null> {
  if (env.SPREADSHEET_ID && env.SPREADSHEET_ID.trim()) {
    return env.SPREADSHEET_ID.trim();
  }

  const drive = createDriveClient(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  return findSpreadsheet(drive, SPREADSHEET_NAME);
}

export async function requireSpreadsheetId(env: Env): Promise<string> {
  const spreadsheetId = await resolveSpreadsheetId(env);
  if (!spreadsheetId) {
    throw new Error(
      'No spreadsheet found. Run hive_setup first or set SPREADSHEET_ID in the MCP server environment.'
    );
  }

  return spreadsheetId;
}

export async function requirePreparedSpreadsheetId(env: Env): Promise<string> {
  const spreadsheetId = await requireSpreadsheetId(env);
  const sheets = createSheetsClient(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  await ensureSpreadsheetStructure(sheets, spreadsheetId);
  return spreadsheetId;
}
