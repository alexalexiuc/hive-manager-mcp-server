import type { Env } from '../types.js';
import { createSheetsClient } from './google.js';
import { ensureSpreadsheetStructure } from './sheets.js';

export function requireSpreadsheetId(env: Env): string {
  if (!env.REQUEST_SPREADSHEET_ID || !env.REQUEST_SPREADSHEET_ID.trim()) {
    throw new Error(
      'Missing spreadsheet id. Pass x-spreadsheet-id request header.',
    );
  }

  return env.REQUEST_SPREADSHEET_ID.trim();
}

export async function requirePreparedSpreadsheetId(
  env: Env,
): Promise<{
  spreadsheetId: string;
  sheets: ReturnType<typeof createSheetsClient>;
}> {
  const spreadsheetId = requireSpreadsheetId(env);
  const sheets = createSheetsClient(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  await ensureSpreadsheetStructure(sheets, spreadsheetId);
  return { spreadsheetId, sheets };
}
