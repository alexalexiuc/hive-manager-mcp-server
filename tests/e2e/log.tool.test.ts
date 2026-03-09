import { describe, expect, it } from 'vitest';
import {
  HIVE_COL,
  HIVES_SHEET_NAME,
  LOG_COL,
  LOGS_SHEET_NAME,
} from '../../src/constants.js';
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

describe('E2E tool: apiary_log_event', () => {
  it('writes a logs row and creates/updates hive row', async () => {
    const ctx = await resolveE2ESpreadsheetContext(config);
    await prepareAndClearSpreadsheet(config, ctx.spreadsheetId);
    const env = buildE2EEnv(config);

    await callTool(env, ctx.spreadsheetId, 'apiary_setup', {}, 201);
    const rpcResponse = await callTool(
      env,
      ctx.spreadsheetId,
      'apiary_log_event',
      {
        hive: '1',
        event_type: 'inspection',
        strength: 'medium',
        queen_status: 'seen',
        brood_status: 'healthy',
        food_status: 'medium',
        summary: 'Initial hive inspection.',
      },
      202,
    );
    const payload = extractToolJson(rpcResponse);
    expect(typeof payload.log_id).toBe('string');
    expect(payload.hive).toBe('1');
    expect(payload.event_type).toBe('inspection');

    const sheets = createSheetsClient(config.serviceAccountJson!);
    const logRows = await getRows(sheets, ctx.spreadsheetId, LOGS_SHEET_NAME);
    const hiveRows = await getRows(sheets, ctx.spreadsheetId, HIVES_SHEET_NAME);

    expect(logRows).toHaveLength(1);
    expect(logRows[0][LOG_COL.hive]).toBe('1');
    expect(logRows[0][LOG_COL.event_type]).toBe('inspection');
    expect(logRows[0][LOG_COL.summary]).toBe('Initial hive inspection.');

    expect(hiveRows).toHaveLength(1);
    expect(hiveRows[0][HIVE_COL.hive]).toBe('1');
    expect(hiveRows[0][HIVE_COL.strength]).toBe('medium');
    expect(hiveRows[0][HIVE_COL.queen_status]).toBe('seen');
  }, 60_000);
});
