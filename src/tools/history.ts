import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createSheetsClient } from '../services/google.js';
import { getRows } from '../services/sheets.js';
import { LOG_SHEET_NAME, DEFAULT_LOG_LIMIT, MAX_LOG_LIMIT } from '../constants.js';
import type { Env } from '../types.js';

const HistorySchema = z.object({
  hive_id: z.string().optional().describe('Filter by hive ID. If omitted, returns all entries.'),
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
    'Retrieve inspection log history from the hive_logs Google Sheet. Optionally filter by hive ID and limit results.',
    HistorySchema.shape,
    async (input: HistoryInput) => {
      const sheets = createSheetsClient(env.GOOGLE_SERVICE_ACCOUNT_JSON);

      const sheetId = env.LOG_SHEET_ID;
      if (!sheetId) {
        throw new Error('LOG_SHEET_ID is not set. Run hive_setup first.');
      }

      const rows = await getRows(sheets, sheetId, LOG_SHEET_NAME);

      let filtered = rows;
      if (input.hive_id) {
        filtered = rows.filter((row) => row[1] === input.hive_id);
      }

      const limit = input.limit ?? DEFAULT_LOG_LIMIT;
      const limited = filtered.slice(-limit);

      const entries = limited.map((row) => ({
        date: row[0] ?? '',
        hive_id: row[1] ?? '',
        location: row[2] ?? '',
        overall_status: row[3] ?? '',
        boxes: row[4] ?? '',
        frames: row[5] ?? '',
        queen_seen: row[6] ?? '',
        notes: row[7] ?? '',
        action_taken: row[8] ?? '',
        next_visit: row[9] ?? '',
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
