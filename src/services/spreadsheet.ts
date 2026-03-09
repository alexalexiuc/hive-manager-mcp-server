import type { Env } from '../types.js';
import { createSheetsClient } from './google.js';

export function requireSpreadsheetId(env: Env): string {
  if (!env.REQUEST_SPREADSHEET_ID || !env.REQUEST_SPREADSHEET_ID.trim()) {
    throw new Error('Missing spreadsheet id. Include it in the MCP endpoint URL: /mcp/:spreadsheetId');
  }

  return env.REQUEST_SPREADSHEET_ID.trim();
}

export async function requireSpreadsheetContext(
  env: Env,
): Promise<{
  spreadsheetId: string;
  sheets: ReturnType<typeof createSheetsClient>;
}> {
  const spreadsheetId = requireSpreadsheetId(env);
  const sheets = createSheetsClient(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  return { spreadsheetId, sheets };
}
