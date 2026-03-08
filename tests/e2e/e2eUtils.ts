import "dotenv/config";
import { SPREADSHEET_NAME } from "../../src/constants";
import {
  findFolder,
  findSpreadsheetInFolder,
} from "../../src/services/drive.js";
import { createDriveClient, createSheetsClient } from "../../src/services/google.js";

export type E2EConfig = {
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

export function getE2EConfig(): E2EConfig {
  return {
    serviceAccountJson: getEnvValue("GOOGLE_SERVICE_ACCOUNT_JSON"),
    hivesFolderId: getEnvValue("HIVES_FOLDER_ID"),
    hivesFolderName: getEnvValue("HIVES_FOLDER_NAME") ?? "Hives",
    hivesE2eFolderName: getEnvValue("HIVES_E2E_FOLDER_NAME") ?? "e2e",
    spreadsheetName: getEnvValue("E2E_SPREADSHEET_NAME") ?? SPREADSHEET_NAME,
  };
}

export type E2ESpreadsheetResolution = {
  spreadsheetId: string;
  e2eFolderId: string;
};

/**
 * Resolves the E2E test spreadsheet by navigating the Drive folder hierarchy.
 * Returns the spreadsheet ID and the e2e folder ID.
 * Throws a descriptive error if any step fails.
 */
export async function resolveE2ESpreadsheet(
  config: E2EConfig,
): Promise<E2ESpreadsheetResolution> {
  if (!config.serviceAccountJson) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is required for e2e tests.");
  }

  const drive = createDriveClient(config.serviceAccountJson);

  const hivesFolderId =
    config.hivesFolderId ??
    (await findFolder(drive, config.hivesFolderName));
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

  return { spreadsheetId, e2eFolderId };
}

/**
 * Resolves the E2E test spreadsheet ID by navigating the Drive folder hierarchy.
 * Throws a descriptive error if any step fails.
 */
export async function resolveE2ESpreadsheetId(
  config: E2EConfig,
): Promise<string> {
  const { spreadsheetId } = await resolveE2ESpreadsheet(config);
  return spreadsheetId;
}

/**
 * Clears all data rows (A2:Z) from the given sheet names, leaving headers intact.
 */
export async function clearSheetData(
  sheets: ReturnType<typeof createSheetsClient>,
  spreadsheetId: string,
  sheetNames: string[],
): Promise<void> {
  await Promise.all(
    sheetNames.map((name) =>
      sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `${name}!A2:Z`,
      }),
    ),
  );
}
