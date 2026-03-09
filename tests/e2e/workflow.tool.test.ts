import { describe, expect, it } from 'vitest';
import { LOGS_SHEET_NAME, PROFILES_SHEET_NAME } from '../../src/constants.js';
import { createSheetsClient } from '../../src/services/google.js';
import { getRows } from '../../src/services/sheets.js';
import {
  buildE2EEnv,
  callTool,
  extractToolJson,
  prepareAndClearSpreadsheet,
  requireE2EConfig,
  resolveE2ESpreadsheetContext,
} from './e2eUtils.js';

const config = requireE2EConfig();

describe('E2E tool: hive_log_inspection', () => {
  it('logs an inspection and creates/updates the profile row', async () => {
    const ctx = await resolveE2ESpreadsheetContext(config);
    await prepareAndClearSpreadsheet(config, ctx.spreadsheetId);
    const env = buildE2EEnv(config);

    await callTool(env, ctx.spreadsheetId, 'hive_setup', {}, 601);

    const inspectResponse = await callTool(
      env,
      ctx.spreadsheetId,
      'hive_log_inspection',
      {
        hive: '3',
        queen_status: 'queen_seen',
        brood_status: 'healthy',
        food_level: 'medium',
        colony_strength: 'strong',
        action_taken: 'Added super',
        notes: 'Looked great',
        next_inspection_date: '2026-03-22',
      },
      602,
    );
    const inspectPayload = extractToolJson(inspectResponse);
    expect(inspectPayload.success).toBe(true);

    const sheets = createSheetsClient(config.serviceAccountJson!);
    const logRows = await getRows(sheets, ctx.spreadsheetId, LOGS_SHEET_NAME);
    expect(logRows).toHaveLength(1);
    expect(logRows[0][1]).toBe('3');
    expect(logRows[0][2]).toBe('inspection');
    expect(logRows[0][3]).toBe('queen_seen');
    expect(logRows[0][4]).toBe('healthy');
    expect(logRows[0][5]).toBe('medium');
    expect(logRows[0][6]).toBe('Added super');
    expect(logRows[0][7]).toBe('Looked great');
    expect(logRows[0][8]).toBe('2026-03-22');

    const profileRows = await getRows(
      sheets,
      ctx.spreadsheetId,
      PROFILES_SHEET_NAME,
    );
    expect(profileRows).toHaveLength(1);
    expect(profileRows[0][0]).toBe('3');
    expect(profileRows[0][2]).toBe('strong');
    expect(profileRows[0][3]).toBe('queen_seen');
    expect(profileRows[0][4]).toBe('healthy');
    expect(profileRows[0][5]).toBe('medium');
  }, 60_000);
});

describe('E2E tool: hive_get_latest_state', () => {
  it('returns profile and most recent log entry for a hive', async () => {
    const ctx = await resolveE2ESpreadsheetContext(config);
    await prepareAndClearSpreadsheet(config, ctx.spreadsheetId);
    const env = buildE2EEnv(config);

    await callTool(env, ctx.spreadsheetId, 'hive_setup', {}, 611);

    await callTool(
      env,
      ctx.spreadsheetId,
      'hive_log_inspection',
      {
        hive: '4',
        queen_status: 'queen_seen',
        brood_status: 'spotty',
        food_level: 'low',
        colony_strength: 'medium',
        notes: 'Needs feeding',
      },
      612,
    );

    const stateResponse = await callTool(
      env,
      ctx.spreadsheetId,
      'hive_get_latest_state',
      { hive: '4' },
      613,
    );
    const statePayload = extractToolJson(stateResponse);

    const profile = statePayload.profile as Record<string, string>;
    expect(profile.hive).toBe('4');
    expect(profile.strength).toBe('medium');
    expect(profile.queen_status).toBe('queen_seen');

    const latestLog = statePayload.latest_log as Record<string, string>;
    expect(latestLog).not.toBeNull();
    expect(latestLog.event_type).toBe('inspection');
    expect(latestLog.brood_status).toBe('spotty');
    expect(latestLog.food_status).toBe('low');
    expect(latestLog.notes).toBe('Needs feeding');
  }, 60_000);

  it('returns null latest_log when hive has no log entries', async () => {
    const ctx = await resolveE2ESpreadsheetContext(config);
    await prepareAndClearSpreadsheet(config, ctx.spreadsheetId);
    const env = buildE2EEnv(config);

    await callTool(env, ctx.spreadsheetId, 'hive_setup', {}, 621);

    await callTool(
      env,
      ctx.spreadsheetId,
      'hive_update_profile',
      { hive: '5', strength: 'weak', notes: 'Profile only, no logs' },
      622,
    );

    const stateResponse = await callTool(
      env,
      ctx.spreadsheetId,
      'hive_get_latest_state',
      { hive: '5' },
      623,
    );
    const statePayload = extractToolJson(stateResponse);

    const profile = statePayload.profile as Record<string, string>;
    expect(profile.hive).toBe('5');
    expect(profile.strength).toBe('weak');
    expect(statePayload.latest_log).toBeNull();
  }, 60_000);
});

describe('E2E tool: hive_list_due_for_check', () => {
  it('returns hives not checked within the specified number of days', async () => {
    const ctx = await resolveE2ESpreadsheetContext(config);
    await prepareAndClearSpreadsheet(config, ctx.spreadsheetId);
    const env = buildE2EEnv(config);

    await callTool(env, ctx.spreadsheetId, 'hive_setup', {}, 631);

    // Hive 6: inspected long ago (stale)
    await callTool(
      env,
      ctx.spreadsheetId,
      'hive_log_entry',
      {
        hive: '6',
        event_type: 'inspection',
        timestamp: '2020-01-01T10:00:00.000Z',
        notes: 'Old inspection',
      },
      632,
    );

    // Hive 7: inspected today (fresh)
    const todayTs = new Date().toISOString();
    await callTool(
      env,
      ctx.spreadsheetId,
      'hive_log_entry',
      {
        hive: '7',
        event_type: 'inspection',
        timestamp: todayTs,
        notes: 'Fresh inspection',
      },
      633,
    );

    const dueResponse = await callTool(
      env,
      ctx.spreadsheetId,
      'hive_list_due_for_check',
      { days: 7 },
      634,
    );
    const duePayload = extractToolJson(dueResponse);
    expect(duePayload.days_threshold).toBe(7);

    const hives = duePayload.hives as Array<Record<string, string>>;
    const hiveIds = hives.map((h) => h.hive);
    expect(hiveIds).toContain('6');
    expect(hiveIds).not.toContain('7');
  }, 60_000);

  it('returns hives with no last_check (never inspected)', async () => {
    const ctx = await resolveE2ESpreadsheetContext(config);
    await prepareAndClearSpreadsheet(config, ctx.spreadsheetId);
    const env = buildE2EEnv(config);

    await callTool(env, ctx.spreadsheetId, 'hive_setup', {}, 641);

    // Add a profile with no last_check by using update_profile directly
    await callTool(
      env,
      ctx.spreadsheetId,
      'hive_update_profile',
      { hive: '8', strength: 'strong', notes: 'Never inspected' },
      642,
    );

    const dueResponse = await callTool(
      env,
      ctx.spreadsheetId,
      'hive_list_due_for_check',
      { days: 7 },
      643,
    );
    const duePayload = extractToolJson(dueResponse);

    const hives = duePayload.hives as Array<Record<string, string>>;
    const hiveIds = hives.map((h) => h.hive);
    expect(hiveIds).toContain('8');
  }, 60_000);
});
