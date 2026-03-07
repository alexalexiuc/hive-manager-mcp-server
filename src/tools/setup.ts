import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createDriveClient, createSheetsClient } from '../services/google.js';
import { findSpreadsheet } from '../services/drive.js';
import { createSpreadsheet } from '../services/sheets.js';
import { SPREADSHEET_NAME } from '../constants.js';
import type { Env } from '../types.js';

export function registerSetupTool(server: McpServer, env: Env) {
  server.tool(
    'hive_setup',
    'Set up the hive_manager Google Spreadsheet with logs, profiles, and apiary_todos sheets. Creates the spreadsheet if it does not already exist.',
    {},
    async () => {
      const drive = createDriveClient(env.GOOGLE_SERVICE_ACCOUNT_JSON);
      const sheets = createSheetsClient(env.GOOGLE_SERVICE_ACCOUNT_JSON);

      let spreadsheetId = env.SPREADSHEET_ID;
      if (!spreadsheetId) {
        const existing = await findSpreadsheet(drive, SPREADSHEET_NAME);
        if (existing) {
          spreadsheetId = existing;
        } else {
          spreadsheetId = await createSpreadsheet(sheets, SPREADSHEET_NAME, drive);
        }
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
