import "dotenv/config";
import { describe, expect, it } from "vitest";
import { SPREADSHEET_NAME } from "../../src/constants.js";
import {
  findFolder,
  findSpreadsheetInFolder,
} from "../../src/services/drive.js";
import { createDriveClient } from "../../src/services/google.js";

type E2EConfig = {
  serviceAccountJson?: string;
  hivesFolderId?: string;
  hivesFolderName: string;
  hivesE2eFolderName: string;
  spreadsheetName: string;
};

function getEnvValue(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

function getE2EConfig(): E2EConfig {
  return {
    serviceAccountJson: getEnvValue("GOOGLE_SERVICE_ACCOUNT_JSON"),
    hivesFolderId: getEnvValue("HIVES_FOLDER_ID"),
    hivesFolderName: getEnvValue("HIVES_FOLDER_NAME") ?? "Hives",
    hivesE2eFolderName: getEnvValue("HIVES_E2E_FOLDER_NAME") ?? "e2e",
    spreadsheetName: getEnvValue("E2E_SPREADSHEET_NAME") ?? SPREADSHEET_NAME,
  };
}

const config = getE2EConfig();
const describeIfConfigured = config.serviceAccountJson
  ? describe
  : describe.skip;

describeIfConfigured("Drive E2E: spreadsheet access", () => {
  it("can find spreadsheet in Hives/e2e and read metadata", async () => {
    if (!config.serviceAccountJson) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is required for e2e tests.");
    }

    const drive = createDriveClient(config.serviceAccountJson);

    const hivesFolderId =
      config.hivesFolderId ?? (await findFolder(drive, config.hivesFolderName));
    console.log("Using Hives folder ID:", hivesFolderId);
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
