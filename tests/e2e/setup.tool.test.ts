import { describe, expect, it } from 'vitest';
import {
  HIVES_SHEET_NAME,
  LOGS_SHEET_NAME,
  HARVESTS_SHEET_NAME,
  TODOS_SHEET_NAME,
  RELOCATIONS_SHEET_NAME,
} from '../../src/constants.js';
import { createSheetsClient } from '../../src/services/google.js';
import {
  buildE2EEnv,
  callTool,
  extractToolJson,
  prepareAndClearSpreadsheet,
  requireE2EConfig,
  resolveE2ESpreadsheetContext,
} from './e2eUtils.js';

const config = requireE2EConfig();

describe('E2E tool: apiary_setup', () => {
  it('returns spreadsheet url and ensures required sheets exist', async () => {
    const ctx = await resolveE2ESpreadsheetContext(config);
    await prepareAndClearSpreadsheet(config, ctx.spreadsheetId);
    const env = buildE2EEnv(config);

    const rpcResponse = await callTool(
      env,
      ctx.spreadsheetId,
      'apiary_setup',
      {},
      101,
    );
    const payload = extractToolJson(rpcResponse);

    expect(String(payload.spreadsheet_url)).toContain(ctx.spreadsheetId);

    const sheets = createSheetsClient(config.serviceAccountJson!);
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: ctx.spreadsheetId,
    });
    const titles = (spreadsheet.data.sheets ?? [])
      .map((sheet) => sheet.properties?.title ?? '')
      .filter(Boolean);

    expect(titles).toContain(HIVES_SHEET_NAME);
    expect(titles).toContain(LOGS_SHEET_NAME);
    expect(titles).toContain(HARVESTS_SHEET_NAME);
    expect(titles).toContain(TODOS_SHEET_NAME);
    expect(titles).toContain(RELOCATIONS_SHEET_NAME);
  }, 60_000);
});
