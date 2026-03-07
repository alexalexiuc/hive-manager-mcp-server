import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createSheetsClient } from '../services/google.js';
import { appendRow, findRowIndex, updateRow } from '../services/sheets.js';
import { requirePreparedSpreadsheetId } from '../services/spreadsheet.js';
import { EventType, LOGS_SHEET_NAME, PROFILES_SHEET_NAME } from '../constants.js';
import type { Env } from '../types.js';

const LogEntrySchema = z.object({
  hive: z.string().describe('Hive number or identifier (e.g. "5", "north-1")'),
  event_type: z.nativeEnum(EventType).describe('Type of event: inspection, feeding, treatment, or harvest'),
  timestamp: z.string().optional().describe('ISO timestamp of the event. Defaults to now.'),
  queen_seen: z.string().optional().describe('Was the queen seen? (e.g. "true", "false", "eggs only")'),
  brood_status: z.string().optional().describe('Brood condition (e.g. "healthy", "spotty", "none")'),
  food_status: z.string().optional().describe('Food/honey level (e.g. "low", "medium", "full")'),
  action_taken: z.string().optional().describe('Actions performed during this event'),
  notes: z.string().optional().describe('Free-text notes and observations'),
  next_check: z.string().optional().describe('Recommended next inspection date (YYYY-MM-DD)'),
  tags: z.string().optional().describe('Optional comma-separated labels'),
  strength: z.string().optional().describe('Colony strength for profile update (e.g. "strong", "medium", "weak")'),
  todos: z.string().optional().describe('Todos to record in the hive profile'),
  origin_hive: z.string().optional().describe('The hive this hive was created from (e.g. via split or merge)'),
  queen_race: z.string().optional().describe('Race or breed of the queen (e.g. "Carniolan", "Italian")'),
  queen_birth_year: z.string().optional().describe('Year the queen was born or introduced (e.g. "2024")'),
});

type LogEntryInput = z.infer<typeof LogEntrySchema>;

export function registerLogTool(server: McpServer, env: Env) {
  server.registerTool(
    'hive_log_entry',
    {
      description:
        'Log a hive event. Appends a row to the logs sheet and creates or updates the hive profile row in the profiles sheet.',
      inputSchema: LogEntrySchema.shape,
    },
    async (input: LogEntryInput) => {
      const spreadsheetId = await requirePreparedSpreadsheetId(env);
      const sheets = createSheetsClient(env.GOOGLE_SERVICE_ACCOUNT_JSON);

      const timestamp = input.timestamp ?? new Date().toISOString();
      const date = timestamp.split('T')[0];

      // Append to logs sheet
      const logRow = [
        timestamp,
        input.hive,
        input.event_type,
        input.queen_seen ?? '',
        input.brood_status ?? '',
        input.food_status ?? '',
        input.action_taken ?? '',
        input.notes ?? '',
        input.next_check ?? '',
        input.tags ?? '',
      ];

      await appendRow(sheets, spreadsheetId, LOGS_SHEET_NAME, logRow);

      // Update or create profile row
      const updatedAt = new Date().toISOString();
      const rowIndex = await findRowIndex(sheets, spreadsheetId, PROFILES_SHEET_NAME, 0, input.hive);

      if (rowIndex === null) {
        // Create new profile row
        const profileRow = [
          input.hive,
          date,
          input.strength ?? '',
          input.queen_seen ?? '',
          input.brood_status ?? '',
          input.food_status ?? '',
          input.notes ?? '',
          input.todos ?? '',
          updatedAt,
          input.origin_hive ?? '',
          input.queen_race ?? '',
          input.queen_birth_year ?? '',
        ];
        await appendRow(sheets, spreadsheetId, PROFILES_SHEET_NAME, profileRow);
      } else {
        // Read existing profile to merge fields
        const { getRows } = await import('../services/sheets.js');
        const profileRows = await getRows(sheets, spreadsheetId, PROFILES_SHEET_NAME);
        // rowIndex is 1-based; row 1 is header, so data starts at row 2 → profileRows[rowIndex - 2]
        const existing = profileRows[rowIndex - 2] ?? [];

        const mergedRow = [
          input.hive,
          date,
          input.strength ?? existing[2] ?? '',
          input.queen_seen ?? existing[3] ?? '',
          input.brood_status ?? existing[4] ?? '',
          input.food_status ?? existing[5] ?? '',
          input.notes ?? existing[6] ?? '',
          input.todos ?? existing[7] ?? '',
          updatedAt,
          input.origin_hive ?? existing[9] ?? '',
          input.queen_race ?? existing[10] ?? '',
          input.queen_birth_year ?? existing[11] ?? '',
        ];
        await updateRow(sheets, spreadsheetId, PROFILES_SHEET_NAME, rowIndex, mergedRow);
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              message: `Logged ${input.event_type} for hive ${input.hive} at ${timestamp}.`,
            }),
          },
        ],
      };
    }
  );
}
