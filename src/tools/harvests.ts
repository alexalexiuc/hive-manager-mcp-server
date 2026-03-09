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
  HARVEST_COL,
  HARVESTS_SHEET_NAME,
  HIVE_COL,
  HIVES_SHEET_NAME,
  LOGS_SHEET_NAME,
} from '../constants.js';
import { isoTimestampSchema } from '../shared/validation.js';
import { generateUlid } from '../shared/ulid.js';
import { toolResponse } from './toolResponse.js';
import { rowToHive, hiveToRow } from './hives.js';
import type { Env, Harvest } from '../types.js';

function rowToHarvest(row: string[]): Harvest {
  return {
    harvest_id: row[HARVEST_COL.harvest_id] ?? '',
    timestamp: row[HARVEST_COL.timestamp] ?? '',
    hive: row[HARVEST_COL.hive] ?? '',
    year: row[HARVEST_COL.year] ?? '',
    weight_kg: row[HARVEST_COL.weight_kg] ?? '',
    season: row[HARVEST_COL.season] ?? '',
    units_extracted: row[HARVEST_COL.units_extracted] ?? '',
    notes: row[HARVEST_COL.notes] ?? '',
  };
}

const LogHarvestSchema = z.object({
  hive: z.string().describe('Hive identifier'),
  weight_kg: z.number().positive().describe('Yield in kilograms'),
  year: z
    .number()
    .int()
    .optional()
    .describe('Calendar year of the harvest. Defaults to current year.'),
  season: z
    .string()
    .optional()
    .describe(
      'Free-text harvest type label, e.g. "acacia", "sunflower", "spring"',
    ),
  units_extracted: z
    .number()
    .int()
    .optional()
    .describe(
      'Number of units extracted — supers for vertical hives, frames for horizontal.',
    ),
  notes: z.string().optional().describe('Free text'),
  timestamp: isoTimestampSchema
    .optional()
    .describe('ISO datetime of the harvest. Defaults to now.'),
});

const GetHarvestSummarySchema = z.object({
  hive: z
    .string()
    .optional()
    .describe('Scope to one hive; omit for all hives'),
  year: z.number().int().optional().describe('Filter by calendar year'),
  season: z
    .string()
    .optional()
    .describe('Filter by season label (partial match)'),
});

type LogHarvestInput = z.infer<typeof LogHarvestSchema>;
type GetHarvestSummaryInput = z.infer<typeof GetHarvestSummarySchema>;

export function registerHarvestTools(server: McpServer, env: Env) {
  server.registerTool(
    'apiary_log_harvest',
    {
      description:
        'Record a honey harvest with yield weight and an optional free-text season label. Appends to the harvests sheet and also appends a "harvest" entry to the logs sheet so the hive timeline remains complete.',
      inputSchema: LogHarvestSchema.shape,
      annotations: { idempotentHint: false },
    },
    async (input: LogHarvestInput) => {
      const { spreadsheetId, sheets } = await requireSpreadsheetContext(env);

      const timestamp = input.timestamp ?? new Date().toISOString();
      const date = timestamp.split('T')[0];
      const year = input.year ?? new Date().getFullYear();
      const harvestId = generateUlid();

      // Append to harvests sheet
      const harvestRow = [
        harvestId,
        timestamp,
        input.hive,
        year,
        input.weight_kg,
        input.season ?? '',
        input.units_extracted ?? '',
        input.notes ?? '',
      ];
      await appendRow(sheets, spreadsheetId, HARVESTS_SHEET_NAME, harvestRow);

      // Append harvest entry to logs sheet
      const logId = generateUlid();
      const logRow = [
        logId,
        timestamp,
        input.hive,
        'harvest',
        input.notes
          ? `Harvested ${input.weight_kg}kg${input.season ? ` (${input.season})` : ''}. ${input.notes}`
          : `Harvested ${input.weight_kg}kg${input.season ? ` (${input.season})` : ''}`,
        '', // next_check
        '', // treatment_product
        '', // treatment_dose
        '', // treatment_duration
        '', // tags
      ];
      await appendRow(sheets, spreadsheetId, LOGS_SHEET_NAME, logRow);

      // Update hive row: last_action + last_check
      const updatedAt = new Date().toISOString();
      const rowIndex = await findRowIndex(
        sheets,
        spreadsheetId,
        HIVES_SHEET_NAME,
        HIVE_COL.hive,
        input.hive,
      );

      if (rowIndex !== null) {
        const allRows = await getRows(sheets, spreadsheetId, HIVES_SHEET_NAME);
        const existing = allRows[rowIndex - 2] ?? [];
        const current = rowToHive(existing);

        const updated = {
          ...current,
          last_check: date,
          last_action: `Harvested ${input.weight_kg}kg${input.season ? ` (${input.season})` : ''}`,
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

      return toolResponse({
        harvest_id: harvestId,
        hive: input.hive,
        year,
        weight_kg: input.weight_kg,
        season: input.season ?? null,
        timestamp,
      });
    },
  );

  server.registerTool(
    'apiary_get_harvest_summary',
    {
      description:
        'Return harvest totals and per-hive breakdown. Use when a user asks "how much did I harvest this year?", "which hive produced the most?", or "what is my total yield?"',
      inputSchema: GetHarvestSummarySchema.shape,
      annotations: { readOnlyHint: true },
    },
    async (input: GetHarvestSummaryInput) => {
      const { spreadsheetId, sheets } = await requireSpreadsheetContext(env);

      const rows = await getRows(sheets, spreadsheetId, HARVESTS_SHEET_NAME);
      let harvests = rows.map((r) => rowToHarvest(r));

      if (input.hive) {
        harvests = harvests.filter((h) => h.hive === input.hive);
      }

      if (input.year != null) {
        const yearStr = String(input.year);
        harvests = harvests.filter((h) => h.year === yearStr);
      }

      if (input.season) {
        const seasonLower = input.season.toLowerCase();
        harvests = harvests.filter((h) =>
          (h.season ?? '').toLowerCase().includes(seasonLower),
        );
      }

      const toKg = (v: string) => parseFloat(v) || 0;

      // Total
      const total_kg = harvests.reduce((sum, h) => sum + toKg(h.weight_kg), 0);

      // By hive
      const hiveMap = new Map<string, { total_kg: number; entries: number }>();
      for (const h of harvests) {
        const entry = hiveMap.get(h.hive) ?? { total_kg: 0, entries: 0 };
        entry.total_kg += toKg(h.weight_kg);
        entry.entries += 1;
        hiveMap.set(h.hive, entry);
      }
      const by_hive = Array.from(hiveMap.entries()).map(([hive, data]) => ({
        hive,
        total_kg: Math.round(data.total_kg * 100) / 100,
        entries: data.entries,
      }));

      // By year
      const yearMap = new Map<string, number>();
      for (const h of harvests) {
        yearMap.set(h.year, (yearMap.get(h.year) ?? 0) + toKg(h.weight_kg));
      }
      const by_year = Array.from(yearMap.entries()).map(([year, total]) => ({
        year: parseInt(year, 10),
        total_kg: Math.round(total * 100) / 100,
      }));

      // By season
      const seasonYearMap = new Map<string, number>();
      for (const h of harvests) {
        if (!h.season) continue;
        const key = `${h.season}|||${h.year}`;
        seasonYearMap.set(key, (seasonYearMap.get(key) ?? 0) + toKg(h.weight_kg));
      }
      const by_season = Array.from(seasonYearMap.entries()).map(([key, total]) => {
        const [season, year] = key.split('|||');
        return {
          season,
          year: parseInt(year, 10),
          total_kg: Math.round(total * 100) / 100,
        };
      });

      return toolResponse({
        total_kg: Math.round(total_kg * 100) / 100,
        by_hive,
        by_year,
        by_season,
        entries: harvests,
      });
    },
  );
}
