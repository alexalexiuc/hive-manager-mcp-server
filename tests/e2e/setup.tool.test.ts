import { describe, expect, it } from "vitest";
import { LOGS_SHEET_NAME, PROFILES_SHEET_NAME, APIARY_TODOS_SHEET_NAME, RELOCATIONS_SHEET_NAME } from "../../src/constants.js";
import { createSheetsClient } from "../../src/services/google.js";
import {
  buildE2EEnv,
  callTool,
  extractToolJson,
  getE2EConfig,
  prepareAndClearSpreadsheet,
  resolveE2ESpreadsheetContext,
} from "./e2eUtils.js";

const config = getE2EConfig();
const describeIfConfigured = config.serviceAccountJson && config.spreadsheetId ? describe : describe.skip;

describeIfConfigured("E2E tool: hive_setup", () => {
  it("returns spreadsheet url and ensures required sheets exist", async () => {
    const ctx = await resolveE2ESpreadsheetContext(config);
    await prepareAndClearSpreadsheet(config, ctx.spreadsheetId);
    const env = buildE2EEnv(config);

    const rpcResponse = await callTool(env, ctx.spreadsheetId, "hive_setup", {}, 101);
    const payload = extractToolJson(rpcResponse);

    expect(payload.success).toBe(true);
    expect(String(payload.spreadsheet_url)).toContain(ctx.spreadsheetId);

    const sheets = createSheetsClient(config.serviceAccountJson!);
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: ctx.spreadsheetId });
    const titles = (spreadsheet.data.sheets ?? [])
      .map((sheet) => sheet.properties?.title ?? "")
      .filter(Boolean);

    expect(titles).toContain(LOGS_SHEET_NAME);
    expect(titles).toContain(PROFILES_SHEET_NAME);
    expect(titles).toContain(APIARY_TODOS_SHEET_NAME);
    expect(titles).toContain(RELOCATIONS_SHEET_NAME);
  }, 60_000);
});
