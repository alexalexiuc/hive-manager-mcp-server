import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  getRows,
  findRowIndex,
  updateRow,
  appendRow,
} from '../services/sheets.js';
import { requireSpreadsheetContext } from '../services/spreadsheet.js';
import { PROFILE_COL, PROFILES_SHEET_NAME } from '../constants.js';
import { toolResponse } from './toolResponse.js';
import type { Env, HiveProfile } from '../types.js';

function rowToProfile(row: string[]): HiveProfile {
  return {
    hive: row[PROFILE_COL.hive] ?? '',
    last_check: row[PROFILE_COL.last_check] ?? '',
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

const GetProfileSchema = z.object({
  hive: z
    .string()
    .describe('The hive number or identifier to retrieve the profile for'),
});

const UpdateProfileSchema = z.object({
  hive: z.string().describe('The hive number or identifier to update'),
  strength: z
    .string()
    .optional()
    .describe('Colony strength (e.g. "strong", "medium", "weak")'),
  queen_status: z
    .string()
    .optional()
    .describe('Queen status (e.g. "queen_seen", "missing", "unknown")'),
  brood_status: z.string().optional().describe('Brood condition'),
  food_status: z.string().optional().describe('Food/honey level'),
  notes: z.string().optional().describe('General notes'),
  todos: z.string().optional().describe('Upcoming actions or todos'),
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

type GetProfileInput = z.infer<typeof GetProfileSchema>;
type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export function registerProfileTools(server: McpServer, env: Env) {
  server.registerTool(
    'hive_get_profile',
    {
      description:
        'Read the current profile for a specific hive from the profiles sheet.',
      inputSchema: GetProfileSchema.shape,
    },
    async (input: GetProfileInput) => {
      const { spreadsheetId, sheets } = await requireSpreadsheetContext(env);

      const rowIndex = await findRowIndex(
        sheets,
        spreadsheetId,
        PROFILES_SHEET_NAME,
        PROFILE_COL.hive,
        input.hive,
      );
      if (rowIndex === null) {
        throw new Error(`Profile for hive ${input.hive} not found.`);
      }

      const rows = await getRows(sheets, spreadsheetId, PROFILES_SHEET_NAME);
      const row = rows[rowIndex - 2] ?? [];
      const profile = rowToProfile(row);

      return toolResponse(profile);
    },
  );

  server.registerTool(
    'hive_update_profile',
    {
      description:
        'Update specific fields in a hive profile row in the profiles sheet.',
      inputSchema: UpdateProfileSchema.shape,
    },
    async (input: UpdateProfileInput) => {
      const { spreadsheetId, sheets } = await requireSpreadsheetContext(env);

      const updatedAt = new Date().toISOString();
      const rowIndex = await findRowIndex(
        sheets,
        spreadsheetId,
        PROFILES_SHEET_NAME,
        PROFILE_COL.hive,
        input.hive,
      );

      if (rowIndex === null) {
        // Create a new profile row
        const profileRow = [
          input.hive,
          '',
          input.strength ?? '',
          input.queen_status ?? '',
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
        const rows = await getRows(sheets, spreadsheetId, PROFILES_SHEET_NAME);
        const existing = rows[rowIndex - 2] ?? [];

        const mergedRow = [
          input.hive,
          existing[PROFILE_COL.last_check] ?? '',
          input.strength ?? existing[PROFILE_COL.strength] ?? '',
          input.queen_status ?? existing[PROFILE_COL.queen_status] ?? '',
          input.brood_status ?? existing[PROFILE_COL.brood_status] ?? '',
          input.food_status ?? existing[PROFILE_COL.food_status] ?? '',
          input.notes ?? existing[PROFILE_COL.notes] ?? '',
          input.todos ?? existing[PROFILE_COL.todos] ?? '',
          updatedAt,
          input.origin_hive ?? existing[PROFILE_COL.origin_hive] ?? '',
          input.queen_race ?? existing[PROFILE_COL.queen_race] ?? '',
          input.queen_birth_year ?? existing[PROFILE_COL.queen_birth_year] ?? '',
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
        message: `Profile for hive ${input.hive} updated successfully.`,
      });
    },
  );

  server.registerTool(
    'hive_get_all_profiles',
    {
      description: 'List all hive profiles from the profiles sheet.',
    },
    async () => {
      const { spreadsheetId, sheets } = await requireSpreadsheetContext(env);

      const rows = await getRows(sheets, spreadsheetId, PROFILES_SHEET_NAME);
      const profiles = rows.map((row) => rowToProfile(row));

      return toolResponse({ count: profiles.length, profiles });
    },
  );
}
