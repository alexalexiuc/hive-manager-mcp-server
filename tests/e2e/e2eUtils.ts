import "dotenv/config";
import { SPREADSHEET_NAME } from "../../src/constants";

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

export function getE2EConfig(): E2EConfig {
  return {
    serviceAccountJson: getEnvValue("GOOGLE_SERVICE_ACCOUNT_JSON"),
    hivesFolderId: getEnvValue("HIVES_FOLDER_ID"),
    hivesFolderName: getEnvValue("HIVES_FOLDER_NAME") ?? "Hives",
    hivesE2eFolderName: getEnvValue("HIVES_E2E_FOLDER_NAME") ?? "e2e",
    spreadsheetName: getEnvValue("E2E_SPREADSHEET_NAME") ?? SPREADSHEET_NAME,
  };
}
