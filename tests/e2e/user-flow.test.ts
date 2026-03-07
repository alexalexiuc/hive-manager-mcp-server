import { describe, expect, it } from "vitest";
import {
  APIARY_TODOS_SHEET_NAME,
  LOGS_SHEET_NAME,
  PROFILES_SHEET_NAME,
} from "../../src/constants.js";
import {
  findFolder,
  findSpreadsheetInFolder,
} from "../../src/services/drive.js";
import {
  createDriveClient,
  createSheetsClient,
} from "../../src/services/google.js";
import {
  appendRow,
  getRows,
  findRowIndex,
  ensureSpreadsheetStructure,
} from "../../src/services/sheets.js";
import { getE2EConfig } from "./e2eUtils.js";

const config = getE2EConfig();
const describeIfConfigured = config.serviceAccountJson
  ? describe
  : describe.skip;

describeIfConfigured("E2E user flow", () => {
  it("clears e2e spreadsheet data and supports log/profile/todo flow", async () => {
    if (!config.serviceAccountJson) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is required for e2e tests.");
    }

    const drive = createDriveClient(config.serviceAccountJson);
    const sheets = createSheetsClient(config.serviceAccountJson);

    const hivesFolderId =
      config.hivesFolderId ?? (await findFolder(drive, config.hivesFolderName));
    if (!hivesFolderId) {
      throw new Error(
        `Could not find '${config.hivesFolderName}' folder in Google Drive.`,
      );
    }

    const e2eFolderId = await findFolder(
      drive,
      config.hivesE2eFolderName,
      hivesFolderId,
    );
    if (!e2eFolderId) {
      throw new Error(
        `Could not find '${config.hivesFolderName}/${config.hivesE2eFolderName}' folder in Google Drive.`,
      );
    }

    const spreadsheetId = await findSpreadsheetInFolder(
      drive,
      config.spreadsheetName,
      e2eFolderId,
    );
    if (!spreadsheetId) {
      throw new Error(
        `Could not find spreadsheet '${config.spreadsheetName}' in '${config.hivesFolderName}/${config.hivesE2eFolderName}'.`,
      );
    }

    // Prepare all required sheets/headers and clear data rows for deterministic e2e runs.
    await ensureSpreadsheetStructure(sheets, spreadsheetId);
    await Promise.all([
      sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `${LOGS_SHEET_NAME}!A2:Z`,
      }),
      sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `${PROFILES_SHEET_NAME}!A2:Z`,
      }),
      sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `${APIARY_TODOS_SHEET_NAME}!A2:Z`,
      }),
    ]);

    const now = new Date().toISOString();
    await appendRow(sheets, spreadsheetId, LOGS_SHEET_NAME, [
      now,
      "1",
      "inspection",
      "true",
      "healthy",
      "medium",
      "",
      "Initial hive profile setup.",
      "",
      "",
    ]);

    const profileRowIndex = await findRowIndex(
      sheets,
      spreadsheetId,
      PROFILES_SHEET_NAME,
      0,
      "1",
    );
    if (!profileRowIndex) {
      await appendRow(sheets, spreadsheetId, PROFILES_SHEET_NAME, [
        "1",
        now.split("T")[0],
        "medium",
        "true",
        "healthy",
        "medium",
        "Initial hive profile setup.",
        "",
        now,
      ]);
    }

    await appendRow(sheets, spreadsheetId, APIARY_TODOS_SHEET_NAME, [
      "Check brood next visit",
      "medium",
      "open",
      "",
      "",
      now,
      now,
    ]);

    const logRows = await getRows(sheets, spreadsheetId, LOGS_SHEET_NAME);
    const profileRows = await getRows(
      sheets,
      spreadsheetId,
      PROFILES_SHEET_NAME,
    );
    const todoRows = await getRows(
      sheets,
      spreadsheetId,
      APIARY_TODOS_SHEET_NAME,
    );

    expect(logRows).toHaveLength(1);
    expect(logRows[0][1]).toBe("1");
    expect(logRows[0][2]).toBe("inspection");

    expect(profileRows).toHaveLength(1);
    expect(profileRows[0][0]).toBe("1");

    expect(todoRows).toHaveLength(1);
    expect(todoRows[0][0]).toBe("Check brood next visit");
  }, 60_000);
});
