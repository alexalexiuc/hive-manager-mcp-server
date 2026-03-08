import { describe, expect, it } from "vitest";
import worker from "../../src/index.js";
import { getE2EConfig } from "./e2eUtils.js";

const config = getE2EConfig();
const describeIfConfigured = config.serviceAccountJson && config.spreadsheetId
  ? describe
  : describe.skip;

describeIfConfigured("MCP E2E: spreadsheet header access", () => {
  it("returns a tool error when x-spreadsheet-id header is missing", async () => {
    const request = new Request("https://example.com/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "hive_setup",
          arguments: {},
        },
      }),
    });

    const response = await worker.fetch(request, {
      GOOGLE_SERVICE_ACCOUNT_JSON: config.serviceAccountJson!,
    });

    expect(response.status).toBe(200);
    const rpc = (await response.json()) as {
      result?: { isError?: boolean; content?: Array<{ text?: string }> };
    };

    expect(rpc.result?.isError).toBe(true);
    expect(rpc.result?.content?.[0]?.text).toContain("Missing spreadsheet id");
  }, 30_000);
});
