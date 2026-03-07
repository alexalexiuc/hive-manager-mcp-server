import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createSheetsClient } from '../services/google.js';
import { getRows } from '../services/sheets.js';
import { LOGS_SHEET_NAME, DEFAULT_LOG_LIMIT, MAX_LOG_LIMIT } from '../constants.js';
import type { Env } from '../types.js';

const HistorySchema = z.object({
  hive: z.string().optional().describe('Filter by hive number or identifier. If omitted, returns entries for all hives.'),
  limit: z
    .number()
    .int()
    .positive()
    .max(MAX_LOG_LIMIT)
    .default(DEFAULT_LOG_LIMIT)
    .optional()
    .describe(`Number of most recent entries to return (default: ${DEFAULT_LOG_LIMIT}, max: ${MAX_LOG_LIMIT})`),
});

type HistoryInput = z.infer<typeof HistorySchema>;

export function registerHistoryTool(server: McpServer, env: Env) {
  server.tool(
    'hive_get_log_history',
    'Retrieve event log history from the logs sheet. Optionally filter by hive and limit results.',
    HistorySchema.shape,
    async (input: HistoryInput) => {
      const sheets = createSheetsClient(env.GOOGLE_SERVICE_ACCOUNT_JSON);

      const spreadsheetId = env.SPREADSHEET_ID;
      if (!spreadsheetId) {
        throw new Error('SPREADSHEET_ID is not set. Run hive_setup first.');
      }

      const rows = await getRows(sheets, spreadsheetId, LOGS_SHEET_NAME);

      let filtered = rows;
      if (input.hive) {
        filtered = rows.filter((row) => row[1] === input.hive);
      }

      const limit = input.limit ?? DEFAULT_LOG_LIMIT;
      const limited = filtered.slice(-limit);

      const entries = limited.map((row) => ({
        timestamp: row[0] ?? '',
        hive: row[1] ?? '',
        event_type: row[2] ?? '',
        queen_seen: row[3] ?? '',
        brood_status: row[4] ?? '',
        food_status: row[5] ?? '',
        action_taken: row[6] ?? '',
        notes: row[7] ?? '',
        next_check: row[8] ?? '',
        tags: row[9] ?? '',
      }));

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              count: entries.length,
              entries,
            }),
          },
        ],
      };
    }
  );
}
