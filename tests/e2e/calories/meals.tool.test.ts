import { describe, expect, it, beforeEach } from 'vitest';
import { MEALS_SHEET_NAME, MEAL_COL } from '../../../src/calories/constants';
import {
  buildE2EEnv,
  callCaloriesTool,
  extractToolJson,
  prepareAndClearCaloriesSpreadsheet,
  requireE2EConfig,
  resolveE2ESpreadsheetContext,
  type E2ESpreadsheetContext,
} from '../e2eUtils';
import { createSheetsClient } from '../../../src/services/google';
import { getRows } from '../../../src/services/sheets';
import type { Env } from '../../../src/types';

const config = requireE2EConfig();

describe('E2E tools: calories meals', () => {
  let ctx: E2ESpreadsheetContext;
  let env: Env;

  beforeEach(async () => {
    ctx = await resolveE2ESpreadsheetContext(config);
    await prepareAndClearCaloriesSpreadsheet(config, ctx.spreadsheetId);
    env = buildE2EEnv(config);
    await callCaloriesTool(env, ctx.spreadsheetId, 'calories_setup', {}, 620);
  }, 60_000);

  it('logs a meal and reads it back', async () => {
    const today = new Date().toISOString().split('T')[0]!;

    const logResponse = await callCaloriesTool(
      env,
      ctx.spreadsheetId,
      'calories_log_meal',
      {
        description: 'Grilled chicken breast with rice and salad',
        calories: 650,
        meal_type: 'lunch',
        date: today,
        protein_g: 45,
        carbs_g: 60,
        fat_g: 12,
        notes: 'e2e test meal',
      },
      622
    );
    const logPayload = extractToolJson(logResponse);

    expect(typeof logPayload.meal_id).toBe('string');
    expect(logPayload.meal_id).toHaveLength(26); // ULID length
    expect(logPayload.description).toBe(
      'Grilled chicken breast with rice and salad'
    );
    expect(logPayload.calories).toBe(650);
    expect(logPayload.meal_type).toBe('lunch');
    expect(logPayload.date).toBe(today);

    // Enriched remaining fields — no profile set up, so targets are null
    expect(logPayload.calories_consumed).toBe(650);
    expect(logPayload.daily_target).toBeNull();
    expect(logPayload.remaining_calories).toBeNull();
    expect(logPayload.over_budget).toBeNull();

    const mealId = logPayload.meal_id as string;

    // Verify via get_meals
    const getMealsResponse = await callCaloriesTool(
      env,
      ctx.spreadsheetId,
      'calories_get_meals',
      { date: today },
      623
    );
    const getMealsPayload = extractToolJson(getMealsResponse);
    expect(getMealsPayload.total_count).toBe(1);

    const entries = getMealsPayload.entries as Array<Record<string, unknown>>;
    expect(entries[0]?.description).toBe(
      'Grilled chicken breast with rice and salad'
    );
    expect(entries[0]?.meal_type).toBe('lunch');

    // Verify sheet directly
    const sheets = createSheetsClient(config.serviceAccountJson);
    const rows = await getRows(sheets, ctx.spreadsheetId, MEALS_SHEET_NAME);
    expect(rows).toHaveLength(1);
    expect(rows[0][MEAL_COL.meal_id]).toBe(mealId);
    expect(rows[0][MEAL_COL.description]).toBe(
      'Grilled chicken breast with rice and salad'
    );
    expect(rows[0][MEAL_COL.calories]).toBe('650');
    expect(rows[0][MEAL_COL.meal_type]).toBe('lunch');
    expect(rows[0][MEAL_COL.protein_g]).toBe('45');
  }, 60_000);

  it('log response includes remaining calories when profile is set', async () => {
    const today = new Date().toISOString().split('T')[0]!;

    // Set up a profile with a known daily target
    await callCaloriesTool(
      env,
      ctx.spreadsheetId,
      'calories_update_profile',
      { goal_calories_override: 2000 },
      641
    );

    // Log first meal
    const firstLog = await callCaloriesTool(
      env,
      ctx.spreadsheetId,
      'calories_log_meal',
      { description: 'Oatmeal', calories: 300, meal_type: 'breakfast', date: today },
      642
    );
    const firstPayload = extractToolJson(firstLog);
    expect(firstPayload.calories_consumed).toBe(300);
    expect(firstPayload.daily_target).toBe(2000);
    expect(firstPayload.remaining_calories).toBe(1700); // 2000 - 300
    expect(firstPayload.over_budget).toBe(false);

    // Log second meal (cumulative total: 1800)
    const secondLog = await callCaloriesTool(
      env,
      ctx.spreadsheetId,
      'calories_log_meal',
      { description: 'Big lunch', calories: 1500, meal_type: 'lunch', date: today },
      643
    );
    const secondPayload = extractToolJson(secondLog);
    expect(secondPayload.calories_consumed).toBe(1800); // 300 + 1500
    expect(secondPayload.daily_target).toBe(2000);
    expect(secondPayload.remaining_calories).toBe(200); // 2000 - 1800
    expect(secondPayload.over_budget).toBe(false);

    // Log a meal that pushes over budget
    const thirdLog = await callCaloriesTool(
      env,
      ctx.spreadsheetId,
      'calories_log_meal',
      { description: 'Huge dinner', calories: 800, meal_type: 'dinner', date: today },
      644
    );
    const thirdPayload = extractToolJson(thirdLog);
    expect(thirdPayload.calories_consumed).toBe(2600); // 1800 + 800
    expect(thirdPayload.daily_target).toBe(2000);
    expect(thirdPayload.remaining_calories).toBe(-600); // 2000 - 2600
    expect(thirdPayload.over_budget).toBe(true);
  }, 60_000);

  it('filters meals by meal_type', async () => {
    const today = new Date().toISOString().split('T')[0]!;

    // Log both a lunch and breakfast in this test
    await callCaloriesTool(
      env,
      ctx.spreadsheetId,
      'calories_log_meal',
      {
        description: 'Grilled chicken breast with rice',
        calories: 650,
        meal_type: 'lunch',
        date: today,
      },
      624
    );
    await callCaloriesTool(
      env,
      ctx.spreadsheetId,
      'calories_log_meal',
      {
        description: 'Oatmeal with berries',
        calories: 320,
        meal_type: 'breakfast',
        date: today,
      },
      625
    );

    const lunchResponse = await callCaloriesTool(
      env,
      ctx.spreadsheetId,
      'calories_get_meals',
      { date: today, meal_type: 'lunch' },
      626
    );
    const lunchPayload = extractToolJson(lunchResponse);
    expect(lunchPayload.total_count).toBe(1);
    const lunches = lunchPayload.entries as Array<Record<string, unknown>>;
    expect(lunches[0]?.meal_type).toBe('lunch');

    const breakfastResponse = await callCaloriesTool(
      env,
      ctx.spreadsheetId,
      'calories_get_meals',
      { date: today, meal_type: 'breakfast' },
      627
    );
    const breakfastPayload = extractToolJson(breakfastResponse);
    expect(breakfastPayload.total_count).toBe(1);
    const breakfasts = breakfastPayload.entries as Array<
      Record<string, unknown>
    >;
    expect(breakfasts[0]?.description).toBe('Oatmeal with berries');
  }, 60_000);

  it('deletes a meal and it no longer appears in queries', async () => {
    const today = new Date().toISOString().split('T')[0]!;

    // Log a snack to delete
    const snackResponse = await callCaloriesTool(
      env,
      ctx.spreadsheetId,
      'calories_log_meal',
      {
        description: 'Chocolate bar — mistake entry',
        calories: 250,
        meal_type: 'snack',
        date: today,
      },
      628
    );
    const snackPayload = extractToolJson(snackResponse);
    const snackId = snackPayload.meal_id as string;

    // Delete it
    const deleteResponse = await callCaloriesTool(
      env,
      ctx.spreadsheetId,
      'calories_delete_meal',
      { meal_id: snackId },
      629
    );
    const deletePayload = extractToolJson(deleteResponse);
    expect(deletePayload.deleted).toBe(true);
    expect(deletePayload.meal_id).toBe(snackId);

    // Verify it no longer appears in queries (empty rows are skipped)
    const getMealsResponse = await callCaloriesTool(
      env,
      ctx.spreadsheetId,
      'calories_get_meals',
      { date: today, meal_type: 'snack' },
      630
    );
    const getMealsPayload = extractToolJson(getMealsResponse);
    expect(getMealsPayload.total_count).toBe(0);
  }, 60_000);
});

