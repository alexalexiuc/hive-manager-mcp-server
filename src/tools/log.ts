import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  appendRow,
  findRowIndex,
  updateRow,
  getRows,
} from '../services/sheets.js';
import { requirePreparedSpreadsheetId } from '../services/spreadsheet.js';
import {
  EventType,
  LOGS_SHEET_NAME,
  PROFILE_COL,
  PROFILES_SHEET_NAME,
} from '../constants.js';
import { isoTimestampSchema, yyyyMmDdDateSchema } from '../shared/validation.js';
import { toolResponse } from './toolResponse.js';
import type { Env } from '../types.js';

const LogEntrySchema = z.object({
  hive: z.string().describe('Hive number or identifier (e.g. "5", "north-1")'),
  event_type: z
    .nativeEnum(EventType)
    .describe('Type of event: inspection, feeding, treatment, or harvest'),
  timestamp: isoTimestampSchema
    .optional()
    .describe('ISO timestamp of the event. Defaults to now.'),
  queen_seen: z
    .string()
    .optional()
    .describe('Was the queen seen? (e.g. "true", "false", "eggs only")'),
  brood_status: z
    .string()
    .optional()
    .describe('Brood condition (e.g. "healthy", "spotty", "none")'),
  food_status: z
    .string()
    .optional()
    .describe('Food/honey level (e.g. "low", "medium", "full")'),
  action_taken: z
    .string()
    .optional()
    .describe('Actions performed during this event'),
  notes: z.string().optional().describe('Free-text notes and observations'),
  next_check: yyyyMmDdDateSchema
    .optional()
    .describe('Recommended next inspection date (YYYY-MM-DD)'),
  tags: z.string().optional().describe('Optional comma-separated labels'),
  strength: z
    .string()
    .optional()
    .describe(
      'Colony strength for profile update (e.g. "strong", "medium", "weak")'
    ),
  todos: z.string().optional().describe('Todos to record in the hive profile'),
  origin_hive: z
    .string()
    .optional()
    .describe('The hive this hive was created from (e.g. via split or merge)'),
  queen_race: z
    .string()
    .optional()
    .describe('Race or breed of the queen (e.g. "Carniolan", "Italian")'),
  queen_birth_year: z
    .string()
    .optional()
    .describe('Year the queen was born or introduced (e.g. "2024")'),
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
      const { spreadsheetId, sheets } = await requirePreparedSpreadsheetId(env);

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
      const rowIndex = await findRowIndex(
        sheets,
        spreadsheetId,
        PROFILES_SHEET_NAME,
        PROFILE_COL.hive,
        input.hive
      );

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
        const profileRows = await getRows(
          sheets,
          spreadsheetId,
          PROFILES_SHEET_NAME
        );
        // rowIndex is 1-based; row 1 is header, so data starts at row 2 → profileRows[rowIndex - 2]
        const existing = profileRows[rowIndex - 2] ?? [];

        const mergedRow = [
          input.hive,
          date,
          input.strength ?? existing[PROFILE_COL.strength] ?? '',
          input.queen_seen ?? existing[PROFILE_COL.queen_status] ?? '',
          input.brood_status ?? existing[PROFILE_COL.brood_status] ?? '',
          input.food_status ?? existing[PROFILE_COL.food_status] ?? '',
          input.notes ?? existing[PROFILE_COL.notes] ?? '',
          input.todos ?? existing[PROFILE_COL.todos] ?? '',
          updatedAt,
          input.origin_hive ?? existing[PROFILE_COL.origin_hive] ?? '',
          input.queen_race ?? existing[PROFILE_COL.queen_race] ?? '',
          input.queen_birth_year ??
            existing[PROFILE_COL.queen_birth_year] ??
            '',
        ];
        await updateRow(
          sheets,
          spreadsheetId,
          PROFILES_SHEET_NAME,
          rowIndex,
          mergedRow
        );
      }

      return toolResponse({
        success: true,
        message: `Logged ${input.event_type} for hive ${input.hive} at ${timestamp}.`,
      });
    }
  );
}
