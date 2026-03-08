import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { appendRow, getRows } from '../services/sheets.js';
import { requirePreparedSpreadsheetId } from '../services/spreadsheet.js';
import { RELOCATION_COL, RELOCATIONS_SHEET_NAME } from '../constants.js';
import { isoTimestampSchema } from '../shared/validation.js';
import { toolResponse } from './toolResponse.js';
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
      'Comma-separated list of hive identifiers being relocated (e.g. "1,2,5")',
    ),
  location: z
    .string()
    .describe('Name or description of the destination location'),
  timestamp: isoTimestampSchema
    .optional()
    .describe('ISO timestamp of the move. Defaults to now.'),
  notes: z
    .string()
    .optional()
    .describe('Additional notes about the relocation'),
});

const GetRelocationsSchema = z.object({
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
    .describe(
      'Maximum number of most-recent entries to return. Defaults to 50.',
    ),
});

const GetCurrentLocationSchema = z.object({
  hive: z
    .string()
    .describe('The hive identifier to look up the current location for'),
});

type LogRelocationInput = z.infer<typeof LogRelocationSchema>;
type GetRelocationsInput = z.infer<typeof GetRelocationsSchema>;
type GetCurrentLocationInput = z.infer<typeof GetCurrentLocationSchema>;

export function registerRelocationTools(server: McpServer, env: Env) {
  server.registerTool(
    'hive_log_relocation',
    {
      description:
        'Record the relocation of one or more hives to a new location. Appends a row to the relocations sheet.',
      inputSchema: LogRelocationSchema.shape,
    },
    async (input: LogRelocationInput) => {
      const { spreadsheetId, sheets } = await requirePreparedSpreadsheetId(env);

      const timestamp = input.timestamp ?? new Date().toISOString();
      const row = [timestamp, input.hives, input.location, input.notes ?? ''];
      await appendRow(sheets, spreadsheetId, RELOCATIONS_SHEET_NAME, row);

      return toolResponse({
        success: true,
        message: `Relocation of hive(s) ${input.hives} to "${input.location}" recorded at ${timestamp}.`,
      });
    },
  );

  server.registerTool(
    'hive_get_relocations',
    {
      description:
        'Retrieve relocation history from the relocations sheet, optionally filtered by hive.',
      inputSchema: GetRelocationsSchema.shape,
    },
    async (input: GetRelocationsInput) => {
      const { spreadsheetId, sheets } = await requirePreparedSpreadsheetId(env);

      const allRows = await getRows(
        sheets,
        spreadsheetId,
        RELOCATIONS_SHEET_NAME,
      );
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
        (a[RELOCATION_COL.timestamp] ?? '').localeCompare(b[RELOCATION_COL.timestamp] ?? ''),
      );
      const entries = sorted.slice(-limit).map((row) => rowToRelocation(row));

      return toolResponse({ count: entries.length, entries });
    },
  );

  server.registerTool(
    'hive_get_current_location',
    {
      description:
        'Get the most recent recorded location for a specific hive based on the relocations sheet.',
      inputSchema: GetCurrentLocationSchema.shape,
    },
    async (input: GetCurrentLocationInput) => {
      const { spreadsheetId, sheets } = await requirePreparedSpreadsheetId(env);

      const allRows = await getRows(
        sheets,
        spreadsheetId,
        RELOCATIONS_SHEET_NAME,
      );

      const hiveId = input.hive;
      const matching = allRows.filter((row) => {
        const hivesCell = row[RELOCATION_COL.hives] ?? '';
        return hivesCell
          .split(',')
          .map((h) => h.trim())
          .includes(hiveId);
      });

      if (matching.length === 0) {
        return toolResponse({
          hive: hiveId,
          current_location: null,
          message: `No relocation records found for hive ${hiveId}.`,
        });
      }

      const sorted = [...matching].sort((a, b) =>
        (a[RELOCATION_COL.timestamp] ?? '').localeCompare(b[RELOCATION_COL.timestamp] ?? ''),
      );
      const latest = rowToRelocation(sorted[sorted.length - 1]);

      return toolResponse({
        hive: hiveId,
        current_location: latest.location,
        since: latest.timestamp,
        notes: latest.notes,
      });
    },
  );
}
