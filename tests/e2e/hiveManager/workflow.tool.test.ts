import { describe, expect, it } from 'vitest';
import {
  buildE2EEnv,
  callTool,
  extractToolJson,
  prepareAndClearHiveManagerSpreadsheet,
  requireE2EConfig,
  resolveE2ESpreadsheetContext,
} from '../e2eUtils';
import {
  HARVEST_COL,
  HARVESTS_SHEET_NAME,
  HIVE_COL,
  HIVES_SHEET_NAME,
  LOG_COL,
  LOGS_SHEET_NAME,
} from '../../../src/hiveManager/constants';
import { createSheetsClient } from '../../../src/services/google';
import { getRows } from '../../../src/services/sheets';

const config = requireE2EConfig();

describe('E2E tool: apiary_log_event (inspection)', () => {
  it('logs an inspection and creates/updates the hive row', async () => {
    const ctx = await resolveE2ESpreadsheetContext(config);
    await prepareAndClearHiveManagerSpreadsheet(config, ctx.spreadsheetId);
    const env = buildE2EEnv(config);

    await callTool(env, ctx.spreadsheetId, 'apiary_setup', {}, 601);

    const inspectResponse = await callTool(
      env,
      ctx.spreadsheetId,
      'apiary_log_event',
      {
        hive: '3',
        event_type: 'inspection',
        queen_status: 'seen',
        brood_status: 'healthy',
        food_status: 'medium',
        strength: 'strong',
        summary: 'Looked great, added super',
        next_check: '2026-03-22',
      },
      602
    );
    const inspectPayload = extractToolJson(inspectResponse);
    expect(typeof inspectPayload.log_id).toBe('string');
    expect(inspectPayload.hive).toBe('3');

    const sheets = createSheetsClient(config.serviceAccountJson!);
    const logRows = await getRows(sheets, ctx.spreadsheetId, LOGS_SHEET_NAME);
    expect(logRows).toHaveLength(1);
    expect(logRows[0][LOG_COL.hive]).toBe('3');
    expect(logRows[0][LOG_COL.event_type]).toBe('inspection');
    expect(logRows[0][LOG_COL.summary]).toBe('Looked great, added super');

    const hiveRows = await getRows(sheets, ctx.spreadsheetId, HIVES_SHEET_NAME);
    expect(hiveRows).toHaveLength(1);
    expect(hiveRows[0][HIVE_COL.hive]).toBe('3');
    expect(hiveRows[0][HIVE_COL.next_check]).toBe('2026-03-22');
    expect(hiveRows[0][HIVE_COL.strength]).toBe('strong');
    expect(hiveRows[0][HIVE_COL.queen_status]).toBe('seen');
    expect(hiveRows[0][HIVE_COL.brood_status]).toBe('healthy');
    expect(hiveRows[0][HIVE_COL.food_status]).toBe('medium');
  }, 60_000);
});

describe('E2E tool: apiary_list_due_for_check', () => {
  it('returns hives not checked within the specified number of days', async () => {
    const ctx = await resolveE2ESpreadsheetContext(config);
    await prepareAndClearHiveManagerSpreadsheet(config, ctx.spreadsheetId);
    const env = buildE2EEnv(config);

    await callTool(env, ctx.spreadsheetId, 'apiary_setup', {}, 631);

    // Hive 6: inspected long ago (stale)
    await callTool(
      env,
      ctx.spreadsheetId,
      'apiary_log_event',
      {
        hive: '6',
        event_type: 'inspection',
        timestamp: '2020-01-01T10:00:00.000Z',
        summary: 'Old inspection',
      },
      632
    );

    // Hive 7: inspected today (fresh)
    const todayTs = new Date().toISOString();
    await callTool(
      env,
      ctx.spreadsheetId,
      'apiary_log_event',
      {
        hive: '7',
        event_type: 'inspection',
        timestamp: todayTs,
        summary: 'Fresh inspection',
      },
      633
    );

    const dueResponse = await callTool(
      env,
      ctx.spreadsheetId,
      'apiary_list_due_for_check',
      { days: 7 },
      634
    );
    const duePayload = extractToolJson(dueResponse);

    const hives = duePayload.hives as Array<Record<string, string>>;
    const hiveIds = hives.map((h) => h.hive);
    expect(hiveIds).toContain('6');
    expect(hiveIds).not.toContain('7');
  }, 60_000);

  it('returns hives with no last_check (never inspected)', async () => {
    const ctx = await resolveE2ESpreadsheetContext(config);
    await prepareAndClearHiveManagerSpreadsheet(config, ctx.spreadsheetId);
    const env = buildE2EEnv(config);

    await callTool(env, ctx.spreadsheetId, 'apiary_setup', {}, 641);

    await callTool(
      env,
      ctx.spreadsheetId,
      'apiary_update_hive_profile',
      { hive: '8', notes: 'Never inspected' },
      642
    );

    const dueResponse = await callTool(
      env,
      ctx.spreadsheetId,
      'apiary_list_due_for_check',
      { days: 7 },
      643
    );
    const duePayload = extractToolJson(dueResponse);

    const hives = duePayload.hives as Array<Record<string, string>>;
    const hiveIds = hives.map((h) => h.hive);
    expect(hiveIds).toContain('8');
  }, 60_000);
});

describe('E2E tool: apiary_log_harvest', () => {
  it('appends harvest to harvests and logs sheets, updates hive row', async () => {
    const ctx = await resolveE2ESpreadsheetContext(config);
    await prepareAndClearHiveManagerSpreadsheet(config, ctx.spreadsheetId);
    const env = buildE2EEnv(config);

    await callTool(env, ctx.spreadsheetId, 'apiary_setup', {}, 651);

    // First create the hive
    await callTool(
      env,
      ctx.spreadsheetId,
      'apiary_update_hive_profile',
      { hive: '9', location: 'apiary' },
      652
    );

    const harvestResponse = await callTool(
      env,
      ctx.spreadsheetId,
      'apiary_log_harvest',
      {
        hive: '9',
        weight_kg: 12.5,
        season: 'acacia',
        year: 2026,
        notes: 'First harvest',
      },
      653
    );
    const harvestPayload = extractToolJson(harvestResponse);
    expect(typeof harvestPayload.harvest_id).toBe('string');
    expect(harvestPayload.hive).toBe('9');
    expect(harvestPayload.weight_kg).toBe(12.5);
    expect(harvestPayload.season).toBe('acacia');
    expect(harvestPayload.year).toBe(2026);

    const sheets = createSheetsClient(config.serviceAccountJson!);
    const harvestRows = await getRows(
      sheets,
      ctx.spreadsheetId,
      HARVESTS_SHEET_NAME
    );
    expect(harvestRows).toHaveLength(1);
    expect(harvestRows[0][HARVEST_COL.hive]).toBe('9');
    expect(harvestRows[0][HARVEST_COL.weight_kg]).toBe('12.5');
    expect(harvestRows[0][HARVEST_COL.season]).toBe('acacia');

    const logRows = await getRows(sheets, ctx.spreadsheetId, LOGS_SHEET_NAME);
    const harvestLogRow = logRows.find(
      (r) => r[LOG_COL.event_type] === 'harvest'
    );
    expect(harvestLogRow).toBeDefined();
    expect(harvestLogRow![LOG_COL.hive]).toBe('9');

    const summaryResponse = await callTool(
      env,
      ctx.spreadsheetId,
      'apiary_get_harvest_summary',
      { year: 2026 },
      654
    );
    const summaryPayload = extractToolJson(summaryResponse);
    expect(summaryPayload.total_kg).toBe(12.5);
    expect(
      (summaryPayload.by_hive as Array<Record<string, unknown>>)[0]?.hive
    ).toBe('9');
  }, 60_000);
});
