import { describe, expect, it } from 'vitest';
import { HIVE_COL, HIVES_SHEET_NAME } from '../../src/constants.js';
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

describe('E2E tools: hive profile', () => {
  it('creates, updates, and reads hive profile data via MCP tools', async () => {
    const ctx = await resolveE2ESpreadsheetContext(config);
    await prepareAndClearSpreadsheet(config, ctx.spreadsheetId);
    const env = buildE2EEnv(config);

    await callTool(env, ctx.spreadsheetId, 'apiary_setup', {}, 301);

    const updateResponse = await callTool(
      env,
      ctx.spreadsheetId,
      'apiary_update_hive_profile',
      {
        hive: '1',
        queen_race: 'Carniolan',
        location: 'orchard',
        notes: 'Profile updated via tool',
      },
      302,
    );
    const updatePayload = extractToolJson(updateResponse);
    expect(updatePayload.hive).toBe('1');
    expect(updatePayload.queen_race).toBe('Carniolan');
    expect(updatePayload.location).toBe('orchard');

    const getResponse = await callTool(
      env,
      ctx.spreadsheetId,
      'apiary_get_hive_status',
      { hive: '1' },
      303,
    );
    const hivePayload = extractToolJson(getResponse);
    expect(hivePayload.hive).toBe('1');
    expect(hivePayload.queen_race).toBe('Carniolan');
    expect(hivePayload.location).toBe('orchard');

    const listResponse = await callTool(
      env,
      ctx.spreadsheetId,
      'apiary_list_hives',
      {},
      304,
    );
    const listPayload = extractToolJson(listResponse);
    expect(listPayload.count).toBe(1);

    const sheets = createSheetsClient(config.serviceAccountJson!);
    const hiveRows = await getRows(sheets, ctx.spreadsheetId, HIVES_SHEET_NAME);
    expect(hiveRows).toHaveLength(1);
    expect(hiveRows[0][HIVE_COL.hive]).toBe('1');
    expect(hiveRows[0][HIVE_COL.queen_race]).toBe('Carniolan');
    expect(hiveRows[0][HIVE_COL.location]).toBe('orchard');
  }, 60_000);
});
