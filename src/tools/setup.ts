import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createSheetsClient } from '../services/google.js';
import { ensureSpreadsheetStructure } from '../services/sheets.js';
import { requireSpreadsheetId } from '../services/spreadsheet.js';
import type { Env } from '../types.js';

export function registerSetupTool(server: McpServer, env: Env) {
  server.registerTool(
    'hive_setup',
    {
      description:
        'Set up a Google Spreadsheet for hive data. Requires x-spreadsheet-id header and ensures required sheets exist.',
    },
    async () => {
      const sheets = createSheetsClient(env.GOOGLE_SERVICE_ACCOUNT_JSON);
      const spreadsheetId = requireSpreadsheetId(env);
      await ensureSpreadsheetStructure(sheets, spreadsheetId);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              spreadsheet_url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
            }),
          },
        ],
      };
    }
  );
}
