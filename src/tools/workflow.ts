import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  appendRow,
  findRowIndex,
  getRows,
  updateRow,
} from '../services/sheets.js';
import { requireSpreadsheetContext } from '../services/spreadsheet.js';
import {
  EventType,
  LOG_COL,
  LOGS_SHEET_NAME,
  PROFILE_COL,
  PROFILES_SHEET_NAME,
} from '../constants.js';
import { isoTimestampSchema, yyyyMmDdDateSchema } from '../shared/validation.js';
import { toolResponse } from './toolResponse.js';
import type { Env, HiveProfile } from '../types.js';

function rowToProfile(row: string[]): HiveProfile {
  return {
    hive: row[PROFILE_COL.hive] ?? '',
    last_check: row[PROFILE_COL.last_check] ?? '',
    next_check: row[PROFILE_COL.next_check] ?? '',
    strength: row[PROFILE_COL.strength] ?? '',
    queen_status: row[PROFILE_COL.queen_status] ?? '',
    brood_status: row[PROFILE_COL.brood_status] ?? '',
    food_status: row[PROFILE_COL.food_status] ?? '',
    notes: row[PROFILE_COL.notes] ?? '',
    todos: row[PROFILE_COL.todos] ?? '',
    updated_at: row[PROFILE_COL.updated_at] ?? '',
    origin_hive: row[PROFILE_COL.origin_hive] ?? '',
    queen_race: row[PROFILE_COL.queen_race] ?? '',
    queen_birth_year: row[PROFILE_COL.queen_birth_year] ?? '',
  };
}

const ListDueForCheckSchema = z.object({
  days: z
    .number()
    .int()
    .positive()
    .default(7)
    .optional()
    .describe(
      'Number of days since last inspection. Hives not checked within this window are returned. Defaults to 7.',
    ),
});

const GetLatestStateSchema = z.object({
  hive: z
    .string()
    .describe('The hive number or identifier to retrieve the current state for'),
});

const LogInspectionSchema = z.object({
  hive: z.string().describe('Hive number or identifier (e.g. "5", "north-1")'),
  timestamp: isoTimestampSchema
    .optional()
    .describe('ISO timestamp of the inspection. Defaults to now.'),
  queen_status: z
    .string()
    .optional()
    .describe('Queen status (e.g. "queen_seen", "eggs only", "missing")'),
  brood_status: z
    .string()
    .optional()
    .describe('Brood condition (e.g. "healthy", "spotty", "none")'),
  food_level: z
    .string()
    .optional()
    .describe('Food/honey level (e.g. "low", "medium", "full")'),
  colony_strength: z
    .string()
    .optional()
    .describe('Colony strength (e.g. "strong", "medium", "weak")'),
  action_taken: z
    .string()
    .optional()
    .describe('Actions performed during the inspection'),
  notes: z.string().optional().describe('Free-text notes and observations'),
  next_inspection_date: yyyyMmDdDateSchema
    .optional()
    .describe('Recommended next inspection date (YYYY-MM-DD)'),
  tags: z.string().optional().describe('Optional comma-separated labels'),
});

type ListDueForCheckInput = z.infer<typeof ListDueForCheckSchema>;
type GetLatestStateInput = z.infer<typeof GetLatestStateSchema>;
type LogInspectionInput = z.infer<typeof LogInspectionSchema>;

export function registerWorkflowTools(server: McpServer, env: Env) {
  server.registerTool(
    'hive_list_due_for_check',
    {
      description:
        'List hives that have not been inspected within a configurable number of days. Useful for planning inspection rounds.',
      inputSchema: ListDueForCheckSchema.shape,
    },
    async (input: ListDueForCheckInput) => {
      const { spreadsheetId, sheets } = await requireSpreadsheetContext(env);

      const rows = await getRows(sheets, spreadsheetId, PROFILES_SHEET_NAME);
      const profiles = rows.map((row) => rowToProfile(row));

      const days = input.days ?? 7;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffDate = cutoff.toISOString().split('T')[0];

      const due = profiles.filter((p) => {
        if (!p.last_check) return true;
        return p.last_check < cutoffDate;
      });

      return toolResponse({
        days_threshold: days,
        count: due.length,
        hives: due,
      });
    },
  );

  server.registerTool(
    'hive_get_latest_state',
    {
      description:
        'Get the latest known state of a hive, including profile data and the most recent log entry. Use this to quickly understand what is happening with a hive right now.',
      inputSchema: GetLatestStateSchema.shape,
    },
    async (input: GetLatestStateInput) => {
      const { spreadsheetId, sheets } = await requireSpreadsheetContext(env);

      const profileRows = await getRows(
        sheets,
        spreadsheetId,
        PROFILES_SHEET_NAME,
      );
      const profileRow = profileRows.find(
        (row) => (row[PROFILE_COL.hive] ?? '') === input.hive,
      );

      if (!profileRow) {
        throw new Error(`No profile found for hive ${input.hive}.`);
      }

      const profile = rowToProfile(profileRow);

      const logRows = await getRows(sheets, spreadsheetId, LOGS_SHEET_NAME);
      const hiveLogRows = logRows.filter(
        (row) => (row[LOG_COL.hive] ?? '') === input.hive,
      );

      const latestLogRow =
        hiveLogRows.length > 0
          ? hiveLogRows[hiveLogRows.length - 1]
          : null;

      const latest_log = latestLogRow
        ? {
            timestamp: latestLogRow[LOG_COL.timestamp] ?? '',
            event_type: latestLogRow[LOG_COL.event_type] ?? '',
            queen_seen: latestLogRow[LOG_COL.queen_seen] ?? '',
            brood_status: latestLogRow[LOG_COL.brood_status] ?? '',
            food_status: latestLogRow[LOG_COL.food_status] ?? '',
            action_taken: latestLogRow[LOG_COL.action_taken] ?? '',
            notes: latestLogRow[LOG_COL.notes] ?? '',
            next_check: latestLogRow[LOG_COL.next_check] ?? '',
          }
        : null;

      return toolResponse({ profile, latest_log });
    },
  );

  server.registerTool(
    'hive_log_inspection',
    {
      description:
        'Log a full hive inspection in a single call. Appends an inspection entry to the logs sheet and updates the hive profile with the latest state.',
      inputSchema: LogInspectionSchema.shape,
    },
    async (input: LogInspectionInput) => {
      const { spreadsheetId, sheets } = await requireSpreadsheetContext(env);

      const timestamp = input.timestamp ?? new Date().toISOString();
      const date = timestamp.split('T')[0];

      const logRow = [
        timestamp,
        input.hive,
        EventType.INSPECTION,
        input.queen_status ?? '',
        input.brood_status ?? '',
        input.food_level ?? '',
        input.action_taken ?? '',
        input.notes ?? '',
        input.next_inspection_date ?? '',
        input.tags ?? '',
      ];

      await appendRow(sheets, spreadsheetId, LOGS_SHEET_NAME, logRow);

      const updatedAt = new Date().toISOString();
      const rowIndex = await findRowIndex(
        sheets,
        spreadsheetId,
        PROFILES_SHEET_NAME,
        PROFILE_COL.hive,
        input.hive,
      );

      if (rowIndex === null) {
        const profileRow = [
          input.hive,
          date,
          input.next_inspection_date ?? '',
          input.colony_strength ?? '',
          input.queen_status ?? '',
          input.brood_status ?? '',
          input.food_level ?? '',
          input.notes ?? '',
          '',
          updatedAt,
          '',
          '',
          '',
        ];
        await appendRow(sheets, spreadsheetId, PROFILES_SHEET_NAME, profileRow);
      } else {
        const profileRows = await getRows(
          sheets,
          spreadsheetId,
          PROFILES_SHEET_NAME,
        );
        const existing = profileRows[rowIndex - 2] ?? [];

        const mergedRow = [
          input.hive,
          date,
          input.next_inspection_date ?? existing[PROFILE_COL.next_check] ?? '',
          input.colony_strength ?? existing[PROFILE_COL.strength] ?? '',
          input.queen_status ?? existing[PROFILE_COL.queen_status] ?? '',
          input.brood_status ?? existing[PROFILE_COL.brood_status] ?? '',
          input.food_level ?? existing[PROFILE_COL.food_status] ?? '',
          input.notes ?? existing[PROFILE_COL.notes] ?? '',
          existing[PROFILE_COL.todos] ?? '',
          updatedAt,
          existing[PROFILE_COL.origin_hive] ?? '',
          existing[PROFILE_COL.queen_race] ?? '',
          existing[PROFILE_COL.queen_birth_year] ?? '',
        ];
        await updateRow(
          sheets,
          spreadsheetId,
          PROFILES_SHEET_NAME,
          rowIndex,
          mergedRow,
        );
      }

      return toolResponse({
        success: true,
        message: `Inspection for hive ${input.hive} logged at ${timestamp}.`,
      });
    },
  );
}
