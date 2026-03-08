import { describe, expect, it } from "vitest";
import { RELOCATIONS_SHEET_NAME } from "../../src/constants.js";
import { createSheetsClient } from "../../src/services/google.js";
import { getRows } from "../../src/services/sheets.js";
import {
  buildE2EEnv,
  callTool,
  extractToolJson,
  getE2EConfig,
  prepareAndClearSpreadsheet,
  resolveE2ESpreadsheetContext,
} from "./e2eUtils.js";

const config = getE2EConfig();
const describeIfConfigured = config.serviceAccountJson ? describe : describe.skip;

describeIfConfigured("E2E tools: relocations", () => {
  it("logs relocation and resolves current location", async () => {
    const ctx = await resolveE2ESpreadsheetContext(config);
    await prepareAndClearSpreadsheet(config, ctx.spreadsheetId);
    const env = buildE2EEnv(config, ctx.spreadsheetId);

    await callTool(env, "hive_setup", {}, 601);

    const logResponse = await callTool(
      env,
      "hive_log_relocation",
      {
        hives: "1,2",
        location: "North Apiary",
        notes: "Season move",
      },
      602,
    );
    const logPayload = extractToolJson(logResponse);
    expect(logPayload.success).toBe(true);

    const listResponse = await callTool(
      env,
      "hive_get_relocations",
      { hive: "1", limit: 10 },
      603,
    );
    const listPayload = extractToolJson(listResponse);
    expect(listPayload.count).toBe(1);

    const currentResponse = await callTool(
      env,
      "hive_get_current_location",
      { hive: "1" },
      604,
    );
    const currentPayload = extractToolJson(currentResponse);
    expect(currentPayload.current_location).toBe("North Apiary");

    const sheets = createSheetsClient(config.serviceAccountJson!);
    const rows = await getRows(sheets, ctx.spreadsheetId, RELOCATIONS_SHEET_NAME);
    expect(rows).toHaveLength(1);
    expect(rows[0][1]).toBe("1,2");
    expect(rows[0][2]).toBe("North Apiary");
  }, 60_000);
});
