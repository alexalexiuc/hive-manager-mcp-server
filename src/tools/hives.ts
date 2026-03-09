import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  appendRow,
  findRowIndex,
  getRows,
  updateRow,
} from '../services/sheets.js';
import { requireSpreadsheetContext } from '../services/spreadsheet.js';
import { HIVE_COL, HIVES_SHEET_NAME } from '../constants.js';
import { yyyyMmDdDateSchema } from '../shared/validation.js';
import { toolResponse } from './toolResponse.js';
import type { Env, Hive } from '../types.js';

export function rowToHive(row: string[]): Hive {
  return {
    hive: row[HIVE_COL.hive] ?? '',
    hive_type: row[HIVE_COL.hive_type] ?? '',
    units: row[HIVE_COL.units] ?? '',
    last_check: row[HIVE_COL.last_check] ?? '',
    next_check: row[HIVE_COL.next_check] ?? '',
    strength: row[HIVE_COL.strength] ?? '',
    queen_status: row[HIVE_COL.queen_status] ?? '',
    brood_status: row[HIVE_COL.brood_status] ?? '',
    food_status: row[HIVE_COL.food_status] ?? '',
    last_action: row[HIVE_COL.last_action] ?? '',
    last_treatment: row[HIVE_COL.last_treatment] ?? '',
    notes: row[HIVE_COL.notes] ?? '',
    queen_race: row[HIVE_COL.queen_race] ?? '',
    queen_birth_year: row[HIVE_COL.queen_birth_year] ?? '',
    origin_hive: row[HIVE_COL.origin_hive] ?? '',
    location: row[HIVE_COL.location] ?? '',
    active: row[HIVE_COL.active] ?? 'true',
    updated_at: row[HIVE_COL.updated_at] ?? '',
  };
}

export function hiveToRow(hive: Hive): (string | number | undefined)[] {
  return [
    hive.hive,
    hive.hive_type ?? '',
    hive.units ?? '',
    hive.last_check ?? '',
    hive.next_check ?? '',
    hive.strength ?? '',
    hive.queen_status ?? '',
    hive.brood_status ?? '',
    hive.food_status ?? '',
    hive.last_action ?? '',
    hive.last_treatment ?? '',
    hive.notes ?? '',
    hive.queen_race ?? '',
    hive.queen_birth_year ?? '',
    hive.origin_hive ?? '',
    hive.location ?? '',
    hive.active ?? 'true',
    hive.updated_at ?? '',
  ];
}

const GetHiveStatusSchema = z.object({
  hive: z.string().describe('Hive identifier, e.g. "5" or "north-1"'),
});

const ListHivesSchema = z.object({
  active_only: z
    .boolean()
    .optional()
    .default(true)
    .describe('Exclude wintered/decommissioned hives. Defaults to true.'),
  location: z
    .string()
    .optional()
    .describe('Filter by location label, e.g. "orchard"'),
  queen_status: z
    .string()
    .optional()
    .describe('Filter by queen status, e.g. "missing"'),
  strength: z
    .string()
    .optional()
    .describe('Filter by colony strength, e.g. "weak"'),
});

const ListDueForCheckSchema = z.object({
  days: z
    .number()
    .int()
    .positive()
    .default(7)
    .optional()
    .describe(
      'Fallback overdue threshold in days used when next_check is not set on a hive. Defaults to 7.',
    ),
  location: z
    .string()
    .optional()
    .describe('Scope to one location label'),
});

const UpdateHiveProfileSchema = z.object({
  hive: z.string().describe('Hive identifier'),
  queen_race: z
    .string()
    .optional()
    .describe('Race or breed of the queen, e.g. "Carniolan"'),
  queen_birth_year: z
    .string()
    .optional()
    .describe('Year the queen was born or introduced, e.g. "2025"'),
  origin_hive: z
    .string()
    .optional()
    .describe('Source hive if this was a split or merge'),
  hive_type: z
    .string()
    .optional()
    .describe('Hive type, e.g. "vertical" or "horizontal"'),
  units: z
    .number()
    .optional()
    .describe('Number of bodies (vertical) or frames (horizontal)'),
  location: z
    .string()
    .optional()
    .describe('Current location label, e.g. "orchard"'),
  active: z
    .boolean()
    .optional()
    .describe('Set to false to decommission or winter a hive'),
  notes: z
    .string()
    .optional()
    .describe('Replace standing notes on the hive'),
  next_check: yyyyMmDdDateSchema
    .optional()
    .describe('Recommended next inspection date (YYYY-MM-DD)'),
});

type GetHiveStatusInput = z.infer<typeof GetHiveStatusSchema>;
type ListHivesInput = z.infer<typeof ListHivesSchema>;
type ListDueForCheckInput = z.infer<typeof ListDueForCheckSchema>;
type UpdateHiveProfileInput = z.infer<typeof UpdateHiveProfileSchema>;

export function registerHiveTools(server: McpServer, env: Env) {
  server.registerTool(
    'apiary_get_hive_status',
    {
      description:
        'Get the full current state of a single hive from the hives sheet. Returns all observation fields plus denormalized last action and last treatment — no log join required.',
      inputSchema: GetHiveStatusSchema.shape,
      annotations: { readOnlyHint: true },
    },
    async (input: GetHiveStatusInput) => {
      const { spreadsheetId, sheets } = await requireSpreadsheetContext(env);

      const rows = await getRows(sheets, spreadsheetId, HIVES_SHEET_NAME);
      const row = rows.find((r) => r[HIVE_COL.hive] === input.hive);

      if (!row) {
        throw new Error(`Hive "${input.hive}" not found.`);
      }

      return toolResponse(rowToHive(row));
    },
  );

  server.registerTool(
    'apiary_list_hives',
    {
      description:
        'List hives with optional filters. Use when a user asks "show me all my hives", "which hives have a missing queen?", or "what hives are at the orchard?"',
      inputSchema: ListHivesSchema.shape,
      annotations: { readOnlyHint: true },
    },
    async (input: ListHivesInput) => {
      const { spreadsheetId, sheets } = await requireSpreadsheetContext(env);

      const rows = await getRows(sheets, spreadsheetId, HIVES_SHEET_NAME);
      let hives = rows.map((r) => rowToHive(r));

      const activeOnly = input.active_only ?? true;
      if (activeOnly) {
        hives = hives.filter((h) => h.active !== 'false');
      }

      if (input.location) {
        const loc = input.location.toLowerCase();
        hives = hives.filter((h) => (h.location ?? '').toLowerCase() === loc);
      }

      if (input.queen_status) {
        const qs = input.queen_status.toLowerCase();
        hives = hives.filter(
          (h) => (h.queen_status ?? '').toLowerCase() === qs,
        );
      }

      if (input.strength) {
        const st = input.strength.toLowerCase();
        hives = hives.filter((h) => (h.strength ?? '').toLowerCase() === st);
      }

      return toolResponse({ hives, count: hives.length });
    },
  );

  server.registerTool(
    'apiary_list_due_for_check',
    {
      description:
        'Return hives that are overdue for inspection — either their next_check date has passed, or they have not been checked within the threshold window. Results are sorted by most overdue first.',
      inputSchema: ListDueForCheckSchema.shape,
      annotations: { readOnlyHint: true },
    },
    async (input: ListDueForCheckInput) => {
      const { spreadsheetId, sheets } = await requireSpreadsheetContext(env);

      const rows = await getRows(sheets, spreadsheetId, HIVES_SHEET_NAME);
      let hives = rows.map((r) => rowToHive(r));

      // Only active hives
      hives = hives.filter((h) => h.active !== 'false');

      if (input.location) {
        const loc = input.location.toLowerCase();
        hives = hives.filter((h) => (h.location ?? '').toLowerCase() === loc);
      }

      const days = input.days ?? 7;
      const today = new Date().toISOString().split('T')[0];
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffDate = cutoff.toISOString().split('T')[0];

      const due = hives.filter((h) => {
        // If next_check is set, use it as the primary indicator
        if (h.next_check) {
          return h.next_check < today;
        }
        // Fall back to days threshold based on last_check
        if (!h.last_check) return true;
        return h.last_check < cutoffDate;
      });

      // Sort by last_check ascending (most overdue first — no last_check goes to the top)
      due.sort((a, b) => {
        if (!a.last_check && !b.last_check) return 0;
        if (!a.last_check) return -1;
        if (!b.last_check) return 1;
        return a.last_check.localeCompare(b.last_check);
      });

      return toolResponse({ hives: due, count: due.length });
    },
  );

  server.registerTool(
    'apiary_update_hive_profile',
    {
      description:
        'Update the standing metadata of a hive — information not tied to a specific field event. Use for recording queen race after an introduction, marking a hive as inactive, correcting location, or updating origin. Do not use this to record inspection results; use apiary_log_event for that.',
      inputSchema: UpdateHiveProfileSchema.shape,
      annotations: { idempotentHint: true, destructiveHint: false },
    },
    async (input: UpdateHiveProfileInput) => {
      const { spreadsheetId, sheets } = await requireSpreadsheetContext(env);

      const updatedAt = new Date().toISOString();

      const rowIndex = await findRowIndex(
        sheets,
        spreadsheetId,
        HIVES_SHEET_NAME,
        HIVE_COL.hive,
        input.hive,
      );

      if (rowIndex === null) {
        // Create a new hive row
        const newHive: Hive = {
          hive: input.hive,
          hive_type: input.hive_type ?? '',
          units: input.units != null ? String(input.units) : '',
          last_check: '',
          next_check: input.next_check ?? '',
          strength: '',
          queen_status: '',
          brood_status: '',
          food_status: '',
          last_action: '',
          last_treatment: '',
          notes: input.notes ?? '',
          queen_race: input.queen_race ?? '',
          queen_birth_year: input.queen_birth_year ?? '',
          origin_hive: input.origin_hive ?? '',
          location: input.location ?? '',
          active: input.active != null ? String(input.active) : 'true',
          updated_at: updatedAt,
        };
        await appendRow(sheets, spreadsheetId, HIVES_SHEET_NAME, hiveToRow(newHive));
        return toolResponse(newHive);
      }

      const allRows = await getRows(sheets, spreadsheetId, HIVES_SHEET_NAME);
      const existing = allRows[rowIndex - 2] ?? [];
      const current = rowToHive(existing);

      const merged: Hive = {
        hive: input.hive,
        hive_type: input.hive_type ?? current.hive_type ?? '',
        units: input.units != null ? String(input.units) : (current.units ?? ''),
        last_check: current.last_check ?? '',
        next_check: input.next_check ?? current.next_check ?? '',
        strength: current.strength ?? '',
        queen_status: current.queen_status ?? '',
        brood_status: current.brood_status ?? '',
        food_status: current.food_status ?? '',
        last_action: current.last_action ?? '',
        last_treatment: current.last_treatment ?? '',
        notes: input.notes ?? current.notes ?? '',
        queen_race: input.queen_race ?? current.queen_race ?? '',
        queen_birth_year: input.queen_birth_year ?? current.queen_birth_year ?? '',
        origin_hive: input.origin_hive ?? current.origin_hive ?? '',
        location: input.location ?? current.location ?? '',
        active: input.active != null ? String(input.active) : (current.active ?? 'true'),
        updated_at: updatedAt,
      };

      await updateRow(
        sheets,
        spreadsheetId,
        HIVES_SHEET_NAME,
        rowIndex,
        hiveToRow(merged),
      );

      return toolResponse(merged);
    },
  );
}
