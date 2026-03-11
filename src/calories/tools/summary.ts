import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getRows, toSheetOperationError } from '../../services/sheets';
import { requireSpreadsheetContext } from '../../services/spreadsheet';
import {
  MEALS_SHEET_NAME,
  PROFILE_SHEET_NAME,
  MEAL_COL,
  MealType,
} from '../constants';
import { yyyyMmDdDateSchema } from '../../shared/validation';
import { calculateTDEE } from './profile';
import { rowToMealEntry } from './meals';
import { rowToProfile } from '../utils';
import { toolResponse } from '../../shared/toolResponse';
import { Env } from '../../types';

function getWeekBounds(dateStr: string): { start: string; end: string } {
  const date = new Date(dateStr + 'T00:00:00Z');
  const day = date.getUTCDay(); // 0=Sun
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  return {
    start: monday.toISOString().split('T')[0]!,
    end: sunday.toISOString().split('T')[0]!,
  };
}

interface DayTotals {
  date: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meal_count: number;
}

function sumMealsForDate(rows: string[][], date: string): DayTotals {
  const dayRows = rows.filter(
    (r) => r[MEAL_COL.date] === date && r[MEAL_COL.meal_id] !== ''
  );
  const totals: DayTotals = {
    date,
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    meal_count: dayRows.length,
  };
  for (const row of dayRows) {
    totals.calories += Number(row[MEAL_COL.calories]) || 0;
    totals.protein_g += Number(row[MEAL_COL.protein_g]) || 0;
    totals.carbs_g += Number(row[MEAL_COL.carbs_g]) || 0;
    totals.fat_g += Number(row[MEAL_COL.fat_g]) || 0;
  }
  return totals;
}

const GetDailySummarySchema = z.object({
  date: yyyyMmDdDateSchema
    .optional()
    .describe('Date to summarize (YYYY-MM-DD). Defaults to today.'),
});

const GetWeeklySummarySchema = z.object({
  date: yyyyMmDdDateSchema
    .optional()
    .describe(
      'Any date within the target week (YYYY-MM-DD). Defaults to today. Week runs Monday–Sunday.'
    ),
});

const GetRemainingSchema = z.object({
  date: yyyyMmDdDateSchema
    .optional()
    .describe('Date to check (YYYY-MM-DD). Defaults to today.'),
  meal_type: z
    .nativeEnum(MealType)
    .optional()
    .describe(
      'If provided, also shows typical calorie budget for that meal type based on common distribution (breakfast 25%, lunch 35%, dinner 30%, snacks 10%).'
    ),
});

type GetDailySummaryInput = z.infer<typeof GetDailySummarySchema>;
type GetWeeklySummaryInput = z.infer<typeof GetWeeklySummarySchema>;
type GetRemainingInput = z.infer<typeof GetRemainingSchema>;

const MEAL_TYPE_FRACTIONS: Record<MealType, number> = {
  [MealType.BREAKFAST]: 0.25,
  [MealType.LUNCH]: 0.35,
  [MealType.DINNER]: 0.3,
  [MealType.SNACK]: 0.1,
};

export function registerSummaryTools(server: McpServer, env: Env) {
  server.registerTool(
    'calories_get_daily_summary',
    {
      description:
        'Get a full calorie and macro summary for a given day, broken down by meal. Also shows progress against the daily target.',
      inputSchema: GetDailySummarySchema.shape,
      annotations: { readOnlyHint: true },
    },
    async (input: GetDailySummaryInput) => {
      const { spreadsheetId, sheets } = await requireSpreadsheetContext(env);

      const today = new Date().toISOString().split('T')[0]!;
      const date = input.date ?? today;

      let mealRows: string[][];
      let profileRows: string[][];

      try {
        mealRows = await getRows(sheets, spreadsheetId, MEALS_SHEET_NAME);
      } catch (error: unknown) {
        throw toSheetOperationError(error, MEALS_SHEET_NAME);
      }
      try {
        profileRows = await getRows(sheets, spreadsheetId, PROFILE_SHEET_NAME);
      } catch (error: unknown) {
        throw toSheetOperationError(error, PROFILE_SHEET_NAME);
      }

      const profile =
        profileRows.length > 0 && profileRows[0]
          ? rowToProfile(profileRows[0])
          : {};
      const { daily_calories } = calculateTDEE(profile);

      const dayMeals = mealRows
        .filter((r) => r[MEAL_COL.date] === date && r[MEAL_COL.meal_id] !== '')
        .map(rowToMealEntry);

      const totals = sumMealsForDate(mealRows, date);
      const remaining =
        daily_calories !== null ? daily_calories - totals.calories : null;

      return toolResponse({
        date,
        meals: dayMeals,
        totals: {
          calories: totals.calories,
          protein_g: totals.protein_g || null,
          carbs_g: totals.carbs_g || null,
          fat_g: totals.fat_g || null,
          meal_count: totals.meal_count,
        },
        daily_target: daily_calories,
        remaining_calories: remaining,
        goal_met:
          daily_calories !== null ? totals.calories >= daily_calories : null,
      });
    }
  );

  server.registerTool(
    'calories_get_weekly_summary',
    {
      description:
        'Get a calorie summary for each day of the week (Mon–Sun) containing the given date. Shows daily totals and weekly average vs target.',
      inputSchema: GetWeeklySummarySchema.shape,
      annotations: { readOnlyHint: true },
    },
    async (input: GetWeeklySummaryInput) => {
      const { spreadsheetId, sheets } = await requireSpreadsheetContext(env);

      const today = new Date().toISOString().split('T')[0]!;
      const anchorDate = input.date ?? today;
      const { start, end } = getWeekBounds(anchorDate);

      let mealRows: string[][];
      let profileRows: string[][];

      try {
        mealRows = await getRows(sheets, spreadsheetId, MEALS_SHEET_NAME);
      } catch (error: unknown) {
        throw toSheetOperationError(error, MEALS_SHEET_NAME);
      }
      try {
        profileRows = await getRows(sheets, spreadsheetId, PROFILE_SHEET_NAME);
      } catch (error: unknown) {
        throw toSheetOperationError(error, PROFILE_SHEET_NAME);
      }

      const profile =
        profileRows.length > 0 && profileRows[0]
          ? rowToProfile(profileRows[0])
          : {};
      const { daily_calories } = calculateTDEE(profile);

      // Build day-by-day summary for Mon–Sun
      const days: DayTotals[] = [];
      const current = new Date(start + 'T00:00:00Z');
      const endDate = new Date(end + 'T00:00:00Z');

      while (current <= endDate) {
        const dateStr = current.toISOString().split('T')[0]!;
        days.push(sumMealsForDate(mealRows, dateStr));
        current.setUTCDate(current.getUTCDate() + 1);
      }

      const totalCalories = days.reduce((s, d) => s + d.calories, 0);
      const daysWithData = days.filter((d) => d.meal_count > 0).length;
      const weeklyAverage =
        daysWithData > 0 ? Math.round(totalCalories / daysWithData) : 0;
      const weeklyTarget = daily_calories !== null ? daily_calories * 7 : null;

      return toolResponse({
        week: { start, end },
        days,
        weekly_total_calories: totalCalories,
        weekly_average_calories: weeklyAverage,
        daily_target: daily_calories,
        weekly_target: weeklyTarget,
        weekly_remaining:
          weeklyTarget !== null ? weeklyTarget - totalCalories : null,
      });
    }
  );

  server.registerTool(
    'calories_get_remaining',
    {
      description:
        'Get remaining calories for the day based on the daily target and what has been logged so far. Optionally shows budget for a specific upcoming meal.',
      inputSchema: GetRemainingSchema.shape,
      annotations: { readOnlyHint: true },
    },
    async (input: GetRemainingInput) => {
      const { spreadsheetId, sheets } = await requireSpreadsheetContext(env);

      const today = new Date().toISOString().split('T')[0]!;
      const date = input.date ?? today;

      let mealRows: string[][];
      let profileRows: string[][];

      try {
        mealRows = await getRows(sheets, spreadsheetId, MEALS_SHEET_NAME);
      } catch (error: unknown) {
        throw toSheetOperationError(error, MEALS_SHEET_NAME);
      }
      try {
        profileRows = await getRows(sheets, spreadsheetId, PROFILE_SHEET_NAME);
      } catch (error: unknown) {
        throw toSheetOperationError(error, PROFILE_SHEET_NAME);
      }

      const profile =
        profileRows.length > 0 && profileRows[0]
          ? rowToProfile(profileRows[0])
          : {};
      const { daily_calories } = calculateTDEE(profile);

      const totals = sumMealsForDate(mealRows, date);
      const remaining =
        daily_calories !== null ? daily_calories - totals.calories : null;

      // Per-meal budget hint
      let meal_budget: number | null = null;
      if (input.meal_type && daily_calories !== null) {
        meal_budget = Math.round(
          daily_calories * MEAL_TYPE_FRACTIONS[input.meal_type as MealType]
        );
      }

      return toolResponse({
        date,
        calories_consumed: totals.calories,
        daily_target: daily_calories,
        remaining_calories: remaining,
        over_budget: remaining !== null ? remaining < 0 : null,
        meal_type: input.meal_type ?? null,
        suggested_meal_budget: meal_budget,
      });
    }
  );
}
