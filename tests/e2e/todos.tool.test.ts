import { describe, expect, it } from "vitest";
import { APIARY_TODOS_SHEET_NAME } from "../../src/constants.js";
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

describeIfConfigured("E2E tools: todos", () => {
  it("adds and reads todos via MCP tools", async () => {
    const ctx = await resolveE2ESpreadsheetContext(config);
    await prepareAndClearSpreadsheet(config, ctx.spreadsheetId);
    const env = buildE2EEnv(config, ctx.spreadsheetId);

    await callTool(env, "hive_setup", {}, 501);

    const addResponse = await callTool(
      env,
      "hive_add_todo",
      {
        todo: "Check brood pattern",
        priority: "medium",
        status: "open",
        notes: "Created by e2e",
      },
      502,
    );
    const addPayload = extractToolJson(addResponse);
    expect(addPayload.success).toBe(true);

    const listResponse = await callTool(env, "hive_get_todos", {}, 503);
    const listPayload = extractToolJson(listResponse);
    expect(listPayload.count).toBe(1);

    const todos = listPayload.todos as Array<Record<string, string>>;
    expect(todos[0]?.todo).toBe("Check brood pattern");

    const sheets = createSheetsClient(config.serviceAccountJson!);
    const rows = await getRows(sheets, ctx.spreadsheetId, APIARY_TODOS_SHEET_NAME);
    expect(rows).toHaveLength(1);
    expect(rows[0][0]).toBe("Check brood pattern");
  }, 60_000);
});
