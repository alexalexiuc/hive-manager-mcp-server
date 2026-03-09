import { describe, expect, it } from 'vitest';
import { PROFILE_COL, PROFILES_SHEET_NAME } from '../../src/constants.js';
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

describe('E2E tools: profile', () => {
  it('updates and reads profile data via MCP tools', async () => {
    const ctx = await resolveE2ESpreadsheetContext(config);
    await prepareAndClearSpreadsheet(config, ctx.spreadsheetId);
    const env = buildE2EEnv(config);

    await callTool(env, ctx.spreadsheetId, 'hive_setup', {}, 301);

    const updateResponse = await callTool(
      env,
      ctx.spreadsheetId,
      'hive_update_profile',
      {
        hive: '1',
        strength: 'strong',
        queen_status: 'queen_seen',
        brood_status: 'healthy',
        food_status: 'high',
        notes: 'Profile updated via tool',
      },
      302,
    );
    const updatePayload = extractToolJson(updateResponse);
    expect(updatePayload.success).toBe(true);

    const getResponse = await callTool(
      env,
      ctx.spreadsheetId,
      'hive_get_profile',
      { hive: '1' },
      303,
    );
    const profilePayload = extractToolJson(getResponse);
    expect(profilePayload.hive).toBe('1');
    expect(profilePayload.strength).toBe('strong');

    const allResponse = await callTool(
      env,
      ctx.spreadsheetId,
      'hive_get_all_profiles',
      {},
      304,
    );
    const allPayload = extractToolJson(allResponse);
    expect(allPayload.count).toBe(1);

    const sheets = createSheetsClient(config.serviceAccountJson!);
    const profileRows = await getRows(
      sheets,
      ctx.spreadsheetId,
      PROFILES_SHEET_NAME,
    );
    expect(profileRows).toHaveLength(1);
    expect(profileRows[0][0]).toBe('1');
    expect(profileRows[0][PROFILE_COL.strength]).toBe('strong');
  }, 60_000);
});
