import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createDriveClient, createSheetsClient } from '../services/google.js';
import { createSpreadsheet, ensureSpreadsheetStructure } from '../services/sheets.js';
import { SPREADSHEET_NAME } from '../constants.js';
import { resolveSpreadsheetId } from '../services/spreadsheet.js';
import type { Env } from '../types.js';

export function registerSetupTool(server: McpServer, env: Env) {
  server.registerTool(
    'hive_setup',
    {
      description:
        'Set up the hive_manager Google Spreadsheet with logs, profiles, and apiary_todos sheets. Creates the spreadsheet if it does not already exist.',
    },
    async () => {
      const sheets = createSheetsClient(env.GOOGLE_SERVICE_ACCOUNT_JSON);
      let spreadsheetId = await resolveSpreadsheetId(env);
      if (!spreadsheetId) {
        const drive = createDriveClient(env.GOOGLE_SERVICE_ACCOUNT_JSON);
        spreadsheetId = await createSpreadsheet(sheets, SPREADSHEET_NAME, drive);
      } else {
        await ensureSpreadsheetStructure(sheets, spreadsheetId);
      }

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
