import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  appendRow,
  getRows,
  toSheetOperationError,
  updateRow,
} from '../../services/sheets';
import { requireSpreadsheetContext } from '../../services/spreadsheet';
import {
  MEALS_SHEET_NAME,
  MEAL_COL,
  MealType,
  DEFAULT_MEAL_LIMIT,
  MAX_MEAL_LIMIT,
  MEALS_SHEET_HEADERS,
  PROFILE_SHEET_NAME,
} from '../constants';
import { yyyyMmDdDateSchema } from '../../shared/validation';
import type { MealEntry } from '../types';
import { toolResponse } from '../../shared/toolResponse';
import { generateUlid } from '../../shared/ulid';
import { Env } from '../../types';
import { rowToProfile, sumMealsForDate } from '../utils';
import { calculateTDEE } from './profile';

export function rowToMealEntry(row: string[]): MealEntry {
  return {
    meal_id: row[MEAL_COL.meal_id] ?? '',
    date: row[MEAL_COL.date] ?? '',
    meal_type: row[MEAL_COL.meal_type] ?? '',
    description: row[MEAL_COL.description] ?? '',
    calories: row[MEAL_COL.calories] ?? '',
    protein_g: row[MEAL_COL.protein_g] ?? '',
    carbs_g: row[MEAL_COL.carbs_g] ?? '',
    fat_g: row[MEAL_COL.fat_g] ?? '',
    notes: row[MEAL_COL.notes] ?? '',
    created_at: row[MEAL_COL.created_at] ?? '',
  };
}

const LogMealSchema = z.object({
  description: z
    .string()
    .describe(
      'What was eaten — describe the meal as seen in the photo or as told by the user, e.g. "grilled chicken breast with rice and salad"'
    ),
  calories: z
    .number()
    .int()
    .positive()
    .describe(
      'Estimated calorie content of the meal. If analyzing a photo, estimate based on visible portion sizes and typical nutritional values.'
    ),
  meal_type: z
    .nativeEnum(MealType)
    .optional()
    .describe(
      'Type of meal: "breakfast" | "lunch" | "dinner" | "snack". If not specified, infer from the time of day or context.'
    ),
  date: yyyyMmDdDateSchema
    .optional()
    .describe('Date of the meal (YYYY-MM-DD). Defaults to today.'),
  protein_g: z
    .number()
    .positive()
    .optional()
    .describe('Estimated protein content in grams'),
  carbs_g: z
    .number()
    .positive()
    .optional()
    .describe('Estimated carbohydrate content in grams'),
  fat_g: z
    .number()
    .positive()
    .optional()
    .describe('Estimated fat content in grams'),
  notes: z
    .string()
    .optional()
    .describe(
      'Any additional notes, e.g. "restaurant portion, may be larger than typical"'
    ),
});

const GetMealsSchema = z.object({
  date: yyyyMmDdDateSchema
    .optional()
    .describe('Filter to a specific date (YYYY-MM-DD). Omit for all entries.'),
  meal_type: z.nativeEnum(MealType).optional().describe('Filter by meal type'),
  limit: z
    .number()
    .int()
    .positive()
    .max(MAX_MEAL_LIMIT)
    .default(DEFAULT_MEAL_LIMIT)
    .optional()
    .describe(
      `Max entries to return (default: ${DEFAULT_MEAL_LIMIT}, max: ${MAX_MEAL_LIMIT})`
    ),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .optional()
    .describe('Pagination offset. Defaults to 0.'),
});

const DeleteMealSchema = z.object({
  meal_id: z.string().describe('The meal_id of the entry to delete'),
});

type LogMealInput = z.infer<typeof LogMealSchema>;
type GetMealsInput = z.infer<typeof GetMealsSchema>;
type DeleteMealInput = z.infer<typeof DeleteMealSchema>;

export function registerMealTools(server: McpServer, env: Env) {
  server.registerTool(
    'calories_log_meal',
    {
      description:
        'Log a meal and its calorie content. Use this after analyzing a food photo or when the user describes what they ate. The model should estimate calories and optionally macros before calling this tool.',
      inputSchema: LogMealSchema.shape,
      annotations: { idempotentHint: false, destructiveHint: false },
    },
    async (input: LogMealInput) => {
      const { spreadsheetId, sheets } = await requireSpreadsheetContext(env);

      const today = new Date().toISOString().split('T')[0]!;
      const date = input.date ?? today;
      const meal_id = generateUlid();
      const created_at = new Date().toISOString();

      // Infer meal type from time of day if not provided
      let meal_type = input.meal_type;
      if (!meal_type) {
        const hour = new Date().getUTCHours();
        if (hour < 10) meal_type = MealType.BREAKFAST;
        else if (hour < 14) meal_type = MealType.LUNCH;
        else if (hour < 19) meal_type = MealType.DINNER;
        else meal_type = MealType.SNACK;
      }

      const row = [
        meal_id,
        date,
        meal_type,
        input.description,
        input.calories,
        input.protein_g ?? '',
        input.carbs_g ?? '',
        input.fat_g ?? '',
        input.notes ?? '',
        created_at,
      ];

      try {
        await appendRow(sheets, spreadsheetId, MEALS_SHEET_NAME, row);
      } catch (error: unknown) {
        throw toSheetOperationError(error, MEALS_SHEET_NAME);
      }

      // Fetch updated meal rows and profile to compute remaining-calories
      // enrichment. This is best-effort: if the reads fail (e.g. quota), we
      // return null for the enrichment fields so the meal is not re-logged on
      // an MCP-level retry of the whole request.
      const mealRows = await getRows(
        sheets,
        spreadsheetId,
        MEALS_SHEET_NAME
      ).catch(() => []);
      const profileRows = await getRows(
        sheets,
        spreadsheetId,
        PROFILE_SHEET_NAME
      ).catch(() => []);

      const profile =
        profileRows.length > 0 && profileRows[0]
          ? rowToProfile(profileRows[0])
          : {};
      const { daily_calories } = calculateTDEE(profile);

      const totals = mealRows.length > 0 ? sumMealsForDate(mealRows, date) : null;
      const calories_consumed = totals?.calories ?? null;
      const remaining_calories =
        daily_calories !== null && calories_consumed !== null
          ? daily_calories - calories_consumed
          : null;

      return toolResponse({
        meal_id,
        date,
        meal_type,
        description: input.description,
        calories: input.calories,
        protein_g: input.protein_g ?? null,
        carbs_g: input.carbs_g ?? null,
        fat_g: input.fat_g ?? null,
        calories_consumed,
        daily_target: daily_calories,
        remaining_calories,
        over_budget: remaining_calories !== null ? remaining_calories < 0 : null,
      });
    }
  );

  server.registerTool(
    'calories_get_meals',
    {
      description:
        'Retrieve logged meal entries. Filter by date or meal type. Useful for reviewing what was eaten on a given day.',
      inputSchema: GetMealsSchema.shape,
      annotations: { readOnlyHint: true },
    },
    async (input: GetMealsInput) => {
      const { spreadsheetId, sheets } = await requireSpreadsheetContext(env);

      let rows: string[][];
      try {
        rows = await getRows(sheets, spreadsheetId, MEALS_SHEET_NAME);
      } catch (error: unknown) {
        throw toSheetOperationError(error, MEALS_SHEET_NAME);
      }

      let filtered = rows;

      if (input.date) {
        filtered = filtered.filter((r) => r[MEAL_COL.date] === input.date);
      }

      if (input.meal_type) {
        filtered = filtered.filter(
          (r) => r[MEAL_COL.meal_type] === input.meal_type
        );
      }

      const total_count = filtered.length;
      const limit = input.limit ?? DEFAULT_MEAL_LIMIT;
      const offset = input.offset ?? 0;
      const page = filtered.slice(offset, offset + limit);
      const entries = page.map(rowToMealEntry);
      const has_more = offset + limit < total_count;
      const next_offset = has_more ? offset + limit : null;

      return toolResponse({ entries, total_count, has_more, next_offset });
    }
  );

  server.registerTool(
    'calories_delete_meal',
    {
      description:
        'Delete a meal entry by its meal_id. Use this to correct a logging mistake.',
      inputSchema: DeleteMealSchema.shape,
      annotations: { idempotentHint: false, destructiveHint: true },
    },
    async (input: DeleteMealInput) => {
      const { spreadsheetId, sheets } = await requireSpreadsheetContext(env);

      let rows: string[][];
      try {
        rows = await getRows(sheets, spreadsheetId, MEALS_SHEET_NAME);
      } catch (error: unknown) {
        throw toSheetOperationError(error, MEALS_SHEET_NAME);
      }

      const rowIndex = rows.findIndex(
        (r) => r[MEAL_COL.meal_id] === input.meal_id
      );

      if (rowIndex === -1) {
        throw new Error(`Meal with id "${input.meal_id}" not found.`);
      }

      // Clear the row (set all cells to empty string)
      const emptyRow = Array(MEALS_SHEET_HEADERS.length).fill('') as string[];
      const sheetRowIndex = rowIndex + 2; // +1 for header, +1 for 1-based index

      try {
        await updateRow(
          sheets,
          spreadsheetId,
          MEALS_SHEET_NAME,
          sheetRowIndex,
          emptyRow
        );
      } catch (error: unknown) {
        throw toSheetOperationError(error, MEALS_SHEET_NAME);
      }

      return toolResponse({ deleted: true, meal_id: input.meal_id });
    }
  );
}
