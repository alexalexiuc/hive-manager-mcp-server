import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { appendRow, findRowIndex, getRows, updateRow } from '../services/sheets.js';
import { requireSpreadsheetContext } from '../services/spreadsheet.js';
import {
  RELOCATION_COL,
  RELOCATIONS_SHEET_NAME,
  HIVES_SHEET_NAME,
  HIVE_COL,
} from '../constants.js';
import { isoTimestampSchema } from '../shared/validation.js';
import { toolResponse } from './toolResponse.js';
import { rowToHive, hiveToRow } from './hives.js';
import type { Env, HiveRelocation } from '../types.js';

function rowToRelocation(row: string[]): HiveRelocation {
  return {
    timestamp: row[RELOCATION_COL.timestamp] ?? '',
    hives: row[RELOCATION_COL.hives] ?? '',
    location: row[RELOCATION_COL.location] ?? '',
    notes: row[RELOCATION_COL.notes] ?? '',
  };
}

const LogRelocationSchema = z.object({
  hives: z
    .string()
    .describe(
      'Comma-separated list of hive identifiers being relocated, e.g. "3,5,7"',
    ),
  location: z
    .string()
    .describe('Destination location label, e.g. "orchard", "field-B"'),
  timestamp: isoTimestampSchema
    .optional()
    .describe('ISO datetime of the move. Defaults to now.'),
  notes: z
    .string()
    .optional()
    .describe('Optional notes about the relocation'),
});

const GetRelocationHistorySchema = z.object({
  hive: z
    .string()
    .optional()
    .describe(
      'Filter entries to a specific hive identifier. Returns all entries when omitted.',
    ),
  limit: z
    .number()
    .int()
    .positive()
    .max(500)
    .optional()
    .describe('Maximum number of most-recent entries to return. Defaults to 50.'),
});

type LogRelocationInput = z.infer<typeof LogRelocationSchema>;
type GetRelocationHistoryInput = z.infer<typeof GetRelocationHistorySchema>;

export function registerRelocationTools(server: McpServer, env: Env) {
  server.registerTool(
    'apiary_log_relocation',
    {
      description:
        'Record that one or more hives were moved to a new location. Appends to the relocations sheet and updates the location field on each moved hive in the hives sheet.',
      inputSchema: LogRelocationSchema.shape,
    },
    async (input: LogRelocationInput) => {
      const { spreadsheetId, sheets } = await requireSpreadsheetContext(env);

      const timestamp = input.timestamp ?? new Date().toISOString();
      const row = [timestamp, input.hives, input.location, input.notes ?? ''];
      await appendRow(sheets, spreadsheetId, RELOCATIONS_SHEET_NAME, row);

      // Update location on each hive in the hives sheet
      const updatedAt = new Date().toISOString();
      const hiveIds = input.hives
        .split(',')
        .map((h) => h.trim())
        .filter(Boolean);

      for (const hiveId of hiveIds) {
        const rowIndex = await findRowIndex(
          sheets,
          spreadsheetId,
          HIVES_SHEET_NAME,
          HIVE_COL.hive,
          hiveId,
        );

        if (rowIndex !== null) {
          const allRows = await getRows(sheets, spreadsheetId, HIVES_SHEET_NAME);
          const existing = allRows[rowIndex - 2] ?? [];
          const current = rowToHive(existing);

          const updated = {
            ...current,
            location: input.location,
            updated_at: updatedAt,
          };

          await updateRow(
            sheets,
            spreadsheetId,
            HIVES_SHEET_NAME,
            rowIndex,
            hiveToRow(updated),
          );
        }
      }

      return toolResponse({
        timestamp,
        hives: input.hives,
        location: input.location,
      });
    },
  );

  server.registerTool(
    'apiary_get_relocation_history',
    {
      description:
        'Retrieve relocation history from the relocations sheet, optionally filtered by hive.',
      inputSchema: GetRelocationHistorySchema.shape,
      annotations: { readOnlyHint: true },
    },
    async (input: GetRelocationHistoryInput) => {
      const { spreadsheetId, sheets } = await requireSpreadsheetContext(env);

      const allRows = await getRows(sheets, spreadsheetId, RELOCATIONS_SHEET_NAME);
      const limit = input.limit ?? 50;

      let filtered = allRows;
      if (input.hive) {
        const hiveId = input.hive;
        filtered = allRows.filter((row) => {
          const hivesCell = row[RELOCATION_COL.hives] ?? '';
          return hivesCell
            .split(',')
            .map((h) => h.trim())
            .includes(hiveId);
        });
      }

      const sorted = [...filtered].sort((a, b) =>
        (a[RELOCATION_COL.timestamp] ?? '').localeCompare(
          b[RELOCATION_COL.timestamp] ?? '',
        ),
      );
      const entries = sorted.slice(-limit).map((row) => rowToRelocation(row));

      return toolResponse({ count: entries.length, entries });
    },
  );
}

