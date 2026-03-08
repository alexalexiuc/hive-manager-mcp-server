import { describe, expect, it } from "vitest";
import { LOGS_SHEET_NAME } from "../../src/constants.js";
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

describeIfConfigured("E2E tool: hive_get_log_history", () => {
  it("returns filtered history that matches logs sheet rows", async () => {
    const ctx = await resolveE2ESpreadsheetContext(config);
    await prepareAndClearSpreadsheet(config, ctx.spreadsheetId);
    const env = buildE2EEnv(config, ctx.spreadsheetId);

    await callTool(env, "hive_setup", {}, 401);

    await callTool(
      env,
      "hive_log_entry",
      { hive: "1", event_type: "inspection", notes: "Hive 1 check" },
      402,
    );
    await callTool(
      env,
      "hive_log_entry",
      { hive: "2", event_type: "feeding", notes: "Hive 2 feeding" },
      403,
    );

    const historyResponse = await callTool(
      env,
      "hive_get_log_history",
      { hive: "1", limit: 10 },
      404,
    );
    const historyPayload = extractToolJson(historyResponse);
    expect(historyPayload.count).toBe(1);

    const entries = historyPayload.entries as Array<Record<string, string>>;
    expect(entries[0]?.hive).toBe("1");
    expect(entries[0]?.event_type).toBe("inspection");

    const sheets = createSheetsClient(config.serviceAccountJson!);
    const rows = await getRows(sheets, ctx.spreadsheetId, LOGS_SHEET_NAME);
    expect(rows).toHaveLength(2);
  }, 60_000);
});
