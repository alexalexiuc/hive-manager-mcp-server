import { describe, expect, it, beforeEach } from 'vitest';
import {
  buildE2EEnv,
  callCaloriesTool,
  extractToolJson,
  prepareAndClearCaloriesSpreadsheet,
  requireE2EConfig,
  resolveE2ESpreadsheetContext,
  type E2ESpreadsheetContext,
} from '../e2eUtils';
import type { Env } from '../../../src/types';

const config = requireE2EConfig();

describe('E2E tools: calories summary', () => {
  let ctx: E2ESpreadsheetContext;
  let env: Env;
  let today: string;

  beforeEach(async () => {
    ctx = await resolveE2ESpreadsheetContext(config);
    await prepareAndClearCaloriesSpreadsheet(config, ctx.spreadsheetId);
    env = buildE2EEnv(config);
    today = new Date().toISOString().split('T')[0]!;

    await callCaloriesTool(env, ctx.spreadsheetId, 'calories_setup', {}, 630);

    // Set up a profile so we have a daily target
    await callCaloriesTool(
      env,
      ctx.spreadsheetId,
      'calories_update_profile',
      {
        age: 30,
        height_cm: 175,
        weight_kg: 70,
        sex: 'female',
        activity_level: 'lightly_active',
        goal_calories_override: 1800,
      },
      631
    );

    // Log 3 initial meals (total: 930 kcal)
    await callCaloriesTool(
      env,
      ctx.spreadsheetId,
      'calories_log_meal',
      {
        description: 'Yogurt and granola',
        calories: 350,
        meal_type: 'breakfast',
        date: today,
      },
      632
    );
    await callCaloriesTool(
      env,
      ctx.spreadsheetId,
      'calories_log_meal',
      {
        description: 'Caesar salad with chicken',
        calories: 500,
        meal_type: 'lunch',
        date: today,
        protein_g: 35,
        carbs_g: 20,
        fat_g: 22,
      },
      633
    );
    await callCaloriesTool(
      env,
      ctx.spreadsheetId,
      'calories_log_meal',
      { description: 'Apple', calories: 80, meal_type: 'snack', date: today },
      634
    );
  }, 60_000);

  it('daily summary totals calories across all meals for the day', async () => {
    const summaryResponse = await callCaloriesTool(
      env,
      ctx.spreadsheetId,
      'calories_get_daily_summary',
      { date: today },
      635
    );
    const summary = extractToolJson(summaryResponse);

    expect(summary.date).toBe(today);
    expect(summary.daily_target).toBe(1800);

    const totals = summary.totals as Record<string, number>;
    expect(totals.calories).toBe(930); // 350 + 500 + 80
    expect(totals.meal_count).toBe(3);

    expect(summary.remaining_calories).toBe(870); // 1800 - 930
    expect(summary.goal_met).toBe(false);

    const meals = summary.meals as Array<Record<string, unknown>>;
    expect(meals).toHaveLength(3);
  }, 60_000);

  it('get_remaining shows calories left and per-meal budget hint', async () => {
    const remainingResponse = await callCaloriesTool(
      env,
      ctx.spreadsheetId,
      'calories_get_remaining',
      { date: today, meal_type: 'dinner' },
      636
    );
    const remaining = extractToolJson(remainingResponse);

    expect(remaining.date).toBe(today);
    expect(remaining.calories_consumed).toBe(930);
    expect(remaining.daily_target).toBe(1800);
    expect(remaining.remaining_calories).toBe(870);
    expect(remaining.over_budget).toBe(false);
    expect(remaining.meal_type).toBe('dinner');
    // dinner budget: 30% of 1800 = 540
    expect(remaining.suggested_meal_budget).toBe(540);
  }, 60_000);

  it('marks as over_budget when calories exceed daily target', async () => {
    // Log a very large dinner to exceed the 1800 target (already at 930)
    await callCaloriesTool(
      env,
      ctx.spreadsheetId,
      'calories_log_meal',
      {
        description: 'Large steak dinner with wine and dessert',
        calories: 1200,
        meal_type: 'dinner',
        date: today,
      },
      637
    );

    const remainingResponse = await callCaloriesTool(
      env,
      ctx.spreadsheetId,
      'calories_get_remaining',
      { date: today },
      638
    );
    const remaining = extractToolJson(remainingResponse);

    // 930 + 1200 = 2130, target = 1800 → over budget
    expect(remaining.calories_consumed).toBe(2130);
    expect(remaining.remaining_calories).toBe(-330);
    expect(remaining.over_budget).toBe(true);
  }, 60_000);

  it('weekly summary covers Mon–Sun and sums all logged days', async () => {
    // Log a large dinner to have a full day's worth of calories logged
    await callCaloriesTool(
      env,
      ctx.spreadsheetId,
      'calories_log_meal',
      {
        description: 'Large steak dinner with wine and dessert',
        calories: 1200,
        meal_type: 'dinner',
        date: today,
      },
      639
    );

    const weeklyResponse = await callCaloriesTool(
      env,
      ctx.spreadsheetId,
      'calories_get_weekly_summary',
      { date: today },
      640
    );
    const weekly = extractToolJson(weeklyResponse);

    expect(weekly.daily_target).toBe(1800);
    expect(weekly.weekly_target).toBe(12600); // 1800 * 7

    const { start, end } = weekly.week as { start: string; end: string };
    expect(start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(end).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Week runs Monday→Sunday
    const startDay = new Date(start + 'T00:00:00Z').getUTCDay();
    const endDay = new Date(end + 'T00:00:00Z').getUTCDay();
    expect(startDay).toBe(1); // Monday
    expect(endDay).toBe(0); // Sunday

    // We logged 2130 kcal today — it should appear in the day array
    const days = weekly.days as Array<{ date: string; calories: number }>;
    expect(days).toHaveLength(7);
    const todayEntry = days.find((d) => d.date === today);
    expect(todayEntry?.calories).toBe(2130);

    // Weekly total should be ≥ today's calories
    expect(weekly.weekly_total_calories as number).toBeGreaterThanOrEqual(2130);
  }, 60_000);
});

