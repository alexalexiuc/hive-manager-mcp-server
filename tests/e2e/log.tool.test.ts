import { describe, expect, it } from "vitest";
import { LOGS_SHEET_NAME, PROFILES_SHEET_NAME } from "../../src/constants.js";
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

describeIfConfigured("E2E tool: hive_log_entry", () => {
  it("writes a logs row and creates/updates profile row", async () => {
    const ctx = await resolveE2ESpreadsheetContext(config);
    await prepareAndClearSpreadsheet(config, ctx.spreadsheetId);
    const env = buildE2EEnv(config, ctx.spreadsheetId);

    await callTool(env, "hive_setup", {}, 201);
    const rpcResponse = await callTool(
      env,
      "hive_log_entry",
      {
        hive: "1",
        event_type: "inspection",
        strength: "medium",
        queen_seen: "true",
        brood_status: "healthy",
        food_status: "medium",
        notes: "Initial hive profile setup.",
      },
      202,
    );
    const payload = extractToolJson(rpcResponse);
    expect(payload.success).toBe(true);

    const sheets = createSheetsClient(config.serviceAccountJson!);
    const logRows = await getRows(sheets, ctx.spreadsheetId, LOGS_SHEET_NAME);
    const profileRows = await getRows(sheets, ctx.spreadsheetId, PROFILES_SHEET_NAME);

    expect(logRows).toHaveLength(1);
    expect(logRows[0][1]).toBe("1");
    expect(logRows[0][2]).toBe("inspection");

    expect(profileRows).toHaveLength(1);
    expect(profileRows[0][0]).toBe("1");
    expect(profileRows[0][2]).toBe("medium");
  }, 60_000);
});
