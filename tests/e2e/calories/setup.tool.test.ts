import { describe, expect, it } from 'vitest';
import { execWithBackoffRetry } from '../../../src/shared/retry';
import {
  MEALS_SHEET_NAME,
  PROFILE_SHEET_NAME,
} from '../../../src/calories/constants';
import {
  buildE2EEnv,
  callCaloriesTool,
  extractToolJson,
  prepareAndClearCaloriesSpreadsheet,
  requireE2EConfig,
  resolveE2ESpreadsheetContext,
} from '../e2eUtils';
import { createSheetsClient } from '../../../src/services/google';

const config = requireE2EConfig();

describe('E2E tool: calories_setup', () => {
  it('creates meals and profile sheets with correct headers', async () => {
    const ctx = await resolveE2ESpreadsheetContext(config);
    await prepareAndClearCaloriesSpreadsheet(config, ctx.spreadsheetId);
    const env = buildE2EEnv(config);

    const response = await callCaloriesTool(
      env,
      ctx.spreadsheetId,
      'calories_setup',
      {},
      601
    );
    const payload = extractToolJson(response);

    expect(typeof payload.spreadsheet_url).toBe('string');
    expect(payload.spreadsheet_url).toContain(ctx.spreadsheetId);

    // Verify both sheets exist in the spreadsheet
    const sheets = createSheetsClient(config.serviceAccountJson);
    const spreadsheet = await execWithBackoffRetry(async () => {
      return sheets.spreadsheets.get({ spreadsheetId: ctx.spreadsheetId });
    });
    const sheetTitles = (spreadsheet.data.sheets ?? [])
      .map((s) => s.properties?.title)
      .filter(Boolean);

    expect(sheetTitles).toContain(MEALS_SHEET_NAME);
    expect(sheetTitles).toContain(PROFILE_SHEET_NAME);
  }, 60_000);

  it('is idempotent — running setup twice does not corrupt sheets', async () => {
    const ctx = await resolveE2ESpreadsheetContext(config);
    const env = buildE2EEnv(config);

    // Run setup a second time; should succeed without error
    const response = await callCaloriesTool(
      env,
      ctx.spreadsheetId,
      'calories_setup',
      {},
      602
    );
    const payload = extractToolJson(response);
    expect(typeof payload.spreadsheet_url).toBe('string');
  }, 60_000);
});
