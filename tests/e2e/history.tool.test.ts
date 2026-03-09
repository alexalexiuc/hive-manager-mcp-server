import { describe, expect, it } from 'vitest';
import { LOGS_SHEET_NAME } from '../../src/constants.js';
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

describe('E2E tool: apiary_get_log_history', () => {
  it('returns filtered history that matches logs sheet rows', async () => {
    const ctx = await resolveE2ESpreadsheetContext(config);
    await prepareAndClearSpreadsheet(config, ctx.spreadsheetId);
    const env = buildE2EEnv(config);

    await callTool(env, ctx.spreadsheetId, 'apiary_setup', {}, 401);

    await callTool(
      env,
      ctx.spreadsheetId,
      'apiary_log_event',
      { hive: '1', event_type: 'inspection', summary: 'Hive 1 check' },
      402,
    );
    await callTool(
      env,
      ctx.spreadsheetId,
      'apiary_log_event',
      { hive: '2', event_type: 'feeding', summary: 'Hive 2 feeding' },
      403,
    );

    const historyResponse = await callTool(
      env,
      ctx.spreadsheetId,
      'apiary_get_log_history',
      { hive: '1', limit: 10 },
      404,
    );
    const historyPayload = extractToolJson(historyResponse);
    expect(historyPayload.total_count).toBe(1);

    const entries = historyPayload.entries as Array<Record<string, string>>;
    expect(entries[0]?.hive).toBe('1');
    expect(entries[0]?.event_type).toBe('inspection');
    expect(entries[0]?.summary).toBe('Hive 1 check');

    const sheets = createSheetsClient(config.serviceAccountJson!);
    const rows = await getRows(sheets, ctx.spreadsheetId, LOGS_SHEET_NAME);
    expect(rows).toHaveLength(2);
  }, 60_000);
});
