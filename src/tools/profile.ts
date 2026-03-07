import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createSheetsClient } from '../services/google.js';
import { getRows, findRowIndex, updateRow, appendRow } from '../services/sheets.js';
import { requireSpreadsheetId } from '../services/spreadsheet.js';
import { PROFILES_SHEET_NAME } from '../constants.js';
import type { Env, HiveProfile } from '../types.js';

function rowToProfile(row: string[]): HiveProfile {
  return {
    hive: row[0] ?? '',
    last_check: row[1] ?? '',
    strength: row[2] ?? '',
    queen_status: row[3] ?? '',
    brood_status: row[4] ?? '',
    food_status: row[5] ?? '',
    notes: row[6] ?? '',
    todos: row[7] ?? '',
    updated_at: row[8] ?? '',
  };
}

const GetProfileSchema = z.object({
  hive: z.string().describe('The hive number or identifier to retrieve the profile for'),
});

const UpdateProfileSchema = z.object({
  hive: z.string().describe('The hive number or identifier to update'),
  strength: z.string().optional().describe('Colony strength (e.g. "strong", "medium", "weak")'),
  queen_status: z.string().optional().describe('Queen status (e.g. "queen_seen", "missing", "unknown")'),
  brood_status: z.string().optional().describe('Brood condition'),
  food_status: z.string().optional().describe('Food/honey level'),
  notes: z.string().optional().describe('General notes'),
  todos: z.string().optional().describe('Upcoming actions or todos'),
});

type GetProfileInput = z.infer<typeof GetProfileSchema>;
type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export function registerProfileTools(server: McpServer, env: Env) {
  server.registerTool(
    'hive_get_profile',
    {
      description: 'Read the current profile for a specific hive from the profiles sheet.',
      inputSchema: GetProfileSchema.shape,
    },
    async (input: GetProfileInput) => {
      const spreadsheetId = await requireSpreadsheetId(env);
      const sheets = createSheetsClient(env.GOOGLE_SERVICE_ACCOUNT_JSON);

      const rowIndex = await findRowIndex(sheets, spreadsheetId, PROFILES_SHEET_NAME, 0, input.hive);
      if (rowIndex === null) {
        throw new Error(`Profile for hive ${input.hive} not found.`);
      }

      const rows = await getRows(sheets, spreadsheetId, PROFILES_SHEET_NAME);
      const row = rows[rowIndex - 2] ?? [];
      const profile = rowToProfile(row);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(profile),
          },
        ],
      };
    }
  );

  server.registerTool(
    'hive_update_profile',
    {
      description: 'Update specific fields in a hive profile row in the profiles sheet.',
      inputSchema: UpdateProfileSchema.shape,
    },
    async (input: UpdateProfileInput) => {
      const spreadsheetId = await requireSpreadsheetId(env);
      const sheets = createSheetsClient(env.GOOGLE_SERVICE_ACCOUNT_JSON);

      const updatedAt = new Date().toISOString();
      const rowIndex = await findRowIndex(sheets, spreadsheetId, PROFILES_SHEET_NAME, 0, input.hive);

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
        ];
        await appendRow(sheets, spreadsheetId, PROFILES_SHEET_NAME, profileRow);
      } else {
        const rows = await getRows(sheets, spreadsheetId, PROFILES_SHEET_NAME);
        const existing = rows[rowIndex - 2] ?? [];

        const mergedRow = [
          input.hive,
          existing[1] ?? '',
          input.strength ?? existing[2] ?? '',
          input.queen_status ?? existing[3] ?? '',
          input.brood_status ?? existing[4] ?? '',
          input.food_status ?? existing[5] ?? '',
          input.notes ?? existing[6] ?? '',
          input.todos ?? existing[7] ?? '',
          updatedAt,
        ];
        await updateRow(sheets, spreadsheetId, PROFILES_SHEET_NAME, rowIndex, mergedRow);
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              message: `Profile for hive ${input.hive} updated successfully.`,
            }),
          },
        ],
      };
    }
  );

  server.registerTool(
    'hive_get_all_profiles',
    {
      description: 'List all hive profiles from the profiles sheet.',
    },
    async () => {
      const spreadsheetId = await requireSpreadsheetId(env);
      const sheets = createSheetsClient(env.GOOGLE_SERVICE_ACCOUNT_JSON);

      const rows = await getRows(sheets, spreadsheetId, PROFILES_SHEET_NAME);
      const profiles = rows.map((row) => rowToProfile(row));

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              count: profiles.length,
              profiles,
            }),
          },
        ],
      };
    }
  );
}
