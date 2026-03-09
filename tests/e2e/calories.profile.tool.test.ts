import { describe, expect, it } from 'vitest';
import { createSheetsClient } from '../../src/services/google.js';
import { getRows } from '../../src/services/sheets.js';
import { PROFILE_SHEET_NAME, PROFILE_COL } from '../../src/calories/constants.js';
import {
  buildE2EEnv,
  callCaloriesTool,
  extractToolJson,
  prepareAndClearCaloriesSpreadsheet,
  requireE2EConfig,
  resolveE2ESpreadsheetContext,
} from './e2eUtils.js';

const config = requireE2EConfig();

describe('E2E tools: calories profile', () => {
  it('saves profile and returns calculated BMR and TDEE', async () => {
    const ctx = await resolveE2ESpreadsheetContext(config);
    await prepareAndClearCaloriesSpreadsheet(config, ctx.spreadsheetId);
    const env = buildE2EEnv(config);

    await callCaloriesTool(env, ctx.spreadsheetId, 'calories_setup', {}, 611);

    const updateResponse = await callCaloriesTool(
      env,
      ctx.spreadsheetId,
      'calories_update_profile',
      {
        name: 'Alex',
        age: 30,
        height_cm: 178,
        weight_kg: 75,
        sex: 'male',
        activity_level: 'moderately_active',
      },
      612,
    );
    const updatePayload = extractToolJson(updateResponse);

    expect(updatePayload.profile).toBeDefined();
    const profile = updatePayload.profile as Record<string, string>;
    expect(profile.name).toBe('Alex');
    expect(profile.age).toBe('30');
    expect(profile.height_cm).toBe('178');
    expect(profile.weight_kg).toBe('75');
    expect(profile.sex).toBe('male');
    expect(profile.activity_level).toBe('moderately_active');

    const calculated = updatePayload.calculated as Record<string, number | null>;
    // Mifflin-St Jeor male: 10*75 + 6.25*178 - 5*30 + 5 = 750 + 1112.5 - 150 + 5 = 1717.5 → 1718
    expect(typeof calculated.bmr).toBe('number');
    expect(typeof calculated.tdee).toBe('number');
    expect((calculated.bmr as number)).toBeGreaterThan(1500);
    expect((calculated.tdee as number)).toBeGreaterThan(calculated.bmr as number);

    // Verify profile written to sheet
    const sheets = createSheetsClient(config.serviceAccountJson);
    const rows = await getRows(sheets, ctx.spreadsheetId, PROFILE_SHEET_NAME);
    expect(rows).toHaveLength(1);
    expect(rows[0][PROFILE_COL.name]).toBe('Alex');
    expect(rows[0][PROFILE_COL.sex]).toBe('male');
    expect(rows[0][PROFILE_COL.activity_level]).toBe('moderately_active');
  }, 60_000);

  it('get_profile returns same calculated values as update', async () => {
    const ctx = await resolveE2ESpreadsheetContext(config);
    const env = buildE2EEnv(config);

    const getResponse = await callCaloriesTool(
      env,
      ctx.spreadsheetId,
      'calories_get_profile',
      {},
      613,
    );
    const getPayload = extractToolJson(getResponse);

    expect(getPayload.profile).toBeDefined();
    const profile = getPayload.profile as Record<string, string>;
    expect(profile.name).toBe('Alex');

    const calculated = getPayload.calculated as Record<string, unknown>;
    expect(typeof calculated.bmr).toBe('number');
    expect(typeof calculated.tdee).toBe('number');
    expect(typeof calculated.daily_calories).toBe('number');
    expect(typeof calculated.activity_description).toBe('string');
  }, 60_000);

  it('partial update preserves existing fields', async () => {
    const ctx = await resolveE2ESpreadsheetContext(config);
    const env = buildE2EEnv(config);

    // Only update weight; all other fields should remain
    const updateResponse = await callCaloriesTool(
      env,
      ctx.spreadsheetId,
      'calories_update_profile',
      { weight_kg: 73 },
      614,
    );
    const updatePayload = extractToolJson(updateResponse);
    const profile = updatePayload.profile as Record<string, string>;

    expect(profile.weight_kg).toBe('73');
    expect(profile.name).toBe('Alex'); // preserved
    expect(profile.sex).toBe('male'); // preserved
    expect(profile.activity_level).toBe('moderately_active'); // preserved
  }, 60_000);

  it('goal_calories_override replaces TDEE as daily_calories', async () => {
    const ctx = await resolveE2ESpreadsheetContext(config);
    const env = buildE2EEnv(config);

    const updateResponse = await callCaloriesTool(
      env,
      ctx.spreadsheetId,
      'calories_update_profile',
      { goal_calories_override: 1800 },
      615,
    );
    const updatePayload = extractToolJson(updateResponse);
    const calculated = updatePayload.calculated as Record<string, number | null>;

    expect(calculated.daily_calories).toBe(1800);
    // TDEE still calculated but daily_calories is the override
    expect((calculated.tdee as number)).not.toBe(1800);
  }, 60_000);
});
