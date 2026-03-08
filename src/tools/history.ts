import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getRows } from '../services/sheets.js';
import { requireSpreadsheetContext } from '../services/spreadsheet.js';
import {
  LOG_COL,
  LOGS_SHEET_NAME,
  DEFAULT_LOG_LIMIT,
  MAX_LOG_LIMIT,
} from '../constants.js';
import { toolResponse } from './toolResponse.js';
import type { Env, HiveLogEntry } from '../types.js';

function rowToLogEntry(row: string[]): HiveLogEntry {
  return {
    timestamp: row[LOG_COL.timestamp] ?? '',
    hive: row[LOG_COL.hive] ?? '',
    event_type: row[LOG_COL.event_type] ?? '',
    queen_seen: row[LOG_COL.queen_seen] ?? '',
    brood_status: row[LOG_COL.brood_status] ?? '',
    food_status: row[LOG_COL.food_status] ?? '',
    action_taken: row[LOG_COL.action_taken] ?? '',
    notes: row[LOG_COL.notes] ?? '',
    next_check: row[LOG_COL.next_check] ?? '',
    tags: row[LOG_COL.tags] ?? '',
  };
}

const HistorySchema = z.object({
  hive: z
    .string()
    .optional()
    .describe(
      'Filter by hive number or identifier. If omitted, returns entries for all hives.',
    ),
  limit: z
    .number()
    .int()
    .positive()
    .max(MAX_LOG_LIMIT)
    .default(DEFAULT_LOG_LIMIT)
    .optional()
    .describe(
      `Number of most recent entries to return (default: ${DEFAULT_LOG_LIMIT}, max: ${MAX_LOG_LIMIT})`,
    ),
});

type HistoryInput = z.infer<typeof HistorySchema>;

export function registerHistoryTool(server: McpServer, env: Env) {
  server.registerTool(
    'hive_get_log_history',
    {
      description:
        'Retrieve event log history from the logs sheet. Optionally filter by hive and limit results.',
      inputSchema: HistorySchema.shape,
    },
    async (input: HistoryInput) => {
      const { spreadsheetId, sheets } = await requireSpreadsheetContext(env);

      const rows = await getRows(sheets, spreadsheetId, LOGS_SHEET_NAME);

      let filtered = rows;
      if (input.hive) {
        filtered = rows.filter((row) => row[LOG_COL.hive] === input.hive);
      }

      const limit = input.limit ?? DEFAULT_LOG_LIMIT;
      const entries = filtered.slice(-limit).map(rowToLogEntry);

      return toolResponse({ count: entries.length, entries });
    },
  );
}
