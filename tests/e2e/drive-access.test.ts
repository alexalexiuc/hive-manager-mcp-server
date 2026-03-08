import { beforeAll, describe, expect, it } from "vitest";
import { createDriveClient } from "../../src/services/google.js";
import {
  getE2EConfig,
  resolveE2ESpreadsheet,
} from "./e2eUtils.js";

const config = getE2EConfig();
const describeIfConfigured = config.serviceAccountJson
  ? describe
  : describe.skip;

describeIfConfigured("Drive E2E: spreadsheet access", () => {
  let spreadsheetId: string;
  let e2eFolderId: string;

  beforeAll(async () => {
    ({ spreadsheetId, e2eFolderId } = await resolveE2ESpreadsheet(config));
  }, 60_000);

  it("can find spreadsheet in Hives/e2e and read metadata", async () => {
    const drive = createDriveClient(config.serviceAccountJson!);
    const metadata = await drive.files.get({
      fileId: spreadsheetId,
      fields: "id,name,mimeType,parents",
    });

    expect(metadata.data.id).toBe(spreadsheetId);
    expect(metadata.data.name).toBe(config.spreadsheetName);
    expect(metadata.data.mimeType).toBe(
      "application/vnd.google-apps.spreadsheet",
    );
    expect(metadata.data.parents ?? []).toContain(e2eFolderId);
  }, 30_000);
});
