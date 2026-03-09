import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createSheetsClient } from '../../services/google.js';
import { ensureCaloriesSpreadsheetStructure } from '../services/sheets.js';
import { requireSpreadsheetId } from '../../services/spreadsheet.js';
import type { Env } from '../../types.js';

export function registerCaloriesSetupTool(server: McpServer, env: Env) {
  server.registerTool(
    'calories_setup',
    {
      description:
        'Ensure all required sheets and headers exist in the calorie tracker spreadsheet. Idempotent — safe to call at any time. Call once before the first write operation if the spreadsheet may be new or uninitialized.',
      annotations: {
        readOnlyHint: false,
        idempotentHint: true,
        destructiveHint: false,
      },
    },
    async () => {
      const sheets = createSheetsClient(env.GOOGLE_SERVICE_ACCOUNT_JSON);
      const spreadsheetId = requireSpreadsheetId(env);
      await ensureCaloriesSpreadsheetStructure(sheets, spreadsheetId);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              spreadsheet_url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
              sheets_created: ['meals', 'profile'],
            }),
          },
        ],
      };
    },
  );
}
