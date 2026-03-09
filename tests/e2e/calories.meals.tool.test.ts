import { describe, expect, it } from 'vitest';
import { createSheetsClient } from '../../src/services/google.js';
import { getRows } from '../../src/services/sheets.js';
import { MEALS_SHEET_NAME, MEAL_COL } from '../../src/calories/constants.js';
import {
  buildE2EEnv,
  callCaloriesTool,
  extractToolJson,
  prepareAndClearCaloriesSpreadsheet,
  requireE2EConfig,
  resolveE2ESpreadsheetContext,
} from './e2eUtils.js';

const config = requireE2EConfig();

describe('E2E tools: calories meals', () => {
  it('logs a meal and reads it back', async () => {
    const ctx = await resolveE2ESpreadsheetContext(config);
    await prepareAndClearCaloriesSpreadsheet(config, ctx.spreadsheetId);
    const env = buildE2EEnv(config);

    await callCaloriesTool(env, ctx.spreadsheetId, 'calories_setup', {}, 621);

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
      622,
    );
    const logPayload = extractToolJson(logResponse);

    expect(typeof logPayload.meal_id).toBe('string');
    expect(logPayload.meal_id).toHaveLength(26); // ULID length
    expect(logPayload.description).toBe('Grilled chicken breast with rice and salad');
    expect(logPayload.calories).toBe(650);
    expect(logPayload.meal_type).toBe('lunch');
    expect(logPayload.date).toBe(today);

    const mealId = logPayload.meal_id as string;

    // Verify via get_meals
    const getMealsResponse = await callCaloriesTool(
      env,
      ctx.spreadsheetId,
      'calories_get_meals',
      { date: today },
      623,
    );
    const getMealsPayload = extractToolJson(getMealsResponse);
    expect(getMealsPayload.total_count).toBe(1);

    const entries = getMealsPayload.entries as Array<Record<string, unknown>>;
    expect(entries[0]?.description).toBe('Grilled chicken breast with rice and salad');
    expect(entries[0]?.meal_type).toBe('lunch');

    // Verify sheet directly
    const sheets = createSheetsClient(config.serviceAccountJson);
    const rows = await getRows(sheets, ctx.spreadsheetId, MEALS_SHEET_NAME);
    expect(rows).toHaveLength(1);
    expect(rows[0][MEAL_COL.meal_id]).toBe(mealId);
    expect(rows[0][MEAL_COL.description]).toBe('Grilled chicken breast with rice and salad');
    expect(rows[0][MEAL_COL.calories]).toBe('650');
    expect(rows[0][MEAL_COL.meal_type]).toBe('lunch');
    expect(rows[0][MEAL_COL.protein_g]).toBe('45');
  }, 60_000);

  it('filters meals by meal_type', async () => {
    const ctx = await resolveE2ESpreadsheetContext(config);
    const env = buildE2EEnv(config);

    const today = new Date().toISOString().split('T')[0]!;

    // Add a breakfast entry alongside the existing lunch
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
      624,
    );

    const lunchResponse = await callCaloriesTool(
      env,
      ctx.spreadsheetId,
      'calories_get_meals',
      { date: today, meal_type: 'lunch' },
      625,
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
      626,
    );
    const breakfastPayload = extractToolJson(breakfastResponse);
    expect(breakfastPayload.total_count).toBe(1);
    const breakfasts = breakfastPayload.entries as Array<Record<string, unknown>>;
    expect(breakfasts[0]?.description).toBe('Oatmeal with berries');
  }, 60_000);

  it('deletes a meal and it no longer appears in queries', async () => {
    const ctx = await resolveE2ESpreadsheetContext(config);
    const env = buildE2EEnv(config);

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
      627,
    );
    const snackPayload = extractToolJson(snackResponse);
    const snackId = snackPayload.meal_id as string;

    // Delete it
    const deleteResponse = await callCaloriesTool(
      env,
      ctx.spreadsheetId,
      'calories_delete_meal',
      { meal_id: snackId },
      628,
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
      629,
    );
    const getMealsPayload = extractToolJson(getMealsResponse);
    expect(getMealsPayload.total_count).toBe(0);
  }, 60_000);
});
