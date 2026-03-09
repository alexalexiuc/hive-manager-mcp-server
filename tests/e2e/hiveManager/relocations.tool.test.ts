import { describe, expect, it } from 'vitest';
import {
  RELOCATION_COL,
  RELOCATIONS_SHEET_NAME,
  HIVE_COL,
  HIVES_SHEET_NAME,
} from '../../../src/hiveManager/constants';
import { createSheetsClient } from '../../../src/services/google';
import { getRows } from '../../../src/services/sheets';
import {
  buildE2EEnv,
  callTool,
  extractToolJson,
  prepareAndClearHiveManagerSpreadsheet,
  requireE2EConfig,
  resolveE2ESpreadsheetContext,
} from '../e2eUtils';

const config = requireE2EConfig();

describe('E2E tools: relocations', () => {
  it('logs relocation, updates hive location, and retrieves history', async () => {
    const ctx = await resolveE2ESpreadsheetContext(config);
    await prepareAndClearHiveManagerSpreadsheet(config, ctx.spreadsheetId);
    const env = buildE2EEnv(config);

    await callTool(env, ctx.spreadsheetId, 'apiary_setup', {}, 701);

    // Create hives first
    await callTool(
      env,
      ctx.spreadsheetId,
      'apiary_update_hive_profile',
      { hive: '1', location: 'home' },
      702
    );
    await callTool(
      env,
      ctx.spreadsheetId,
      'apiary_update_hive_profile',
      { hive: '2', location: 'home' },
      703
    );

    const logResponse = await callTool(
      env,
      ctx.spreadsheetId,
      'apiary_log_relocation',
      {
        hives: '1,2',
        location: 'North Apiary',
        notes: 'Season move',
      },
      704
    );
    const logPayload = extractToolJson(logResponse);
    expect(logPayload.hives).toBe('1,2');
    expect(logPayload.location).toBe('North Apiary');

    const listResponse = await callTool(
      env,
      ctx.spreadsheetId,
      'apiary_get_relocation_history',
      { hive: '1', limit: 10 },
      705
    );
    const listPayload = extractToolJson(listResponse);
    expect(listPayload.count).toBe(1);

    const sheets = createSheetsClient(config.serviceAccountJson!);
    const rows = await getRows(
      sheets,
      ctx.spreadsheetId,
      RELOCATIONS_SHEET_NAME
    );
    expect(rows).toHaveLength(1);
    expect(rows[0][RELOCATION_COL.hives]).toBe('1,2');
    expect(rows[0][RELOCATION_COL.location]).toBe('North Apiary');

    // Verify hive location was updated
    const hiveRows = await getRows(sheets, ctx.spreadsheetId, HIVES_SHEET_NAME);
    const hive1 = hiveRows.find((r) => r[HIVE_COL.hive] === '1');
    expect(hive1?.[HIVE_COL.location]).toBe('North Apiary');

    // Verify hive status reflects new location
    const statusResponse = await callTool(
      env,
      ctx.spreadsheetId,
      'apiary_get_hive_status',
      { hive: '1' },
      706
    );
    const statusPayload = extractToolJson(statusResponse);
    expect(statusPayload.location).toBe('North Apiary');
  }, 60_000);
});
