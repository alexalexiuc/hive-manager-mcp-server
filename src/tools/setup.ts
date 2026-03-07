import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createDriveClient, createSheetsClient } from '../services/google.js';
import { findOrCreateFolder, findFile, createTextFile } from '../services/drive.js';
import { createSheet } from '../services/sheets.js';
import { HIVES_FOLDER_NAME, PROFILES_FOLDER_NAME, LOG_SHEET_NAME, TODOS_FILENAME, getDefaultTodosContent } from '../constants.js';
import type { Env } from '../types.js';

export function registerSetupTool(server: McpServer, env: Env) {
  server.tool(
    'hive_setup',
    'Set up the Hives folder structure in Google Drive and Sheets. Creates the Hives/ root folder, profiles/ subfolder, hive_logs Google Sheet with headers, and todos_general.txt if they do not already exist.',
    {},
    async () => {
      const drive = createDriveClient(env.GOOGLE_SERVICE_ACCOUNT_JSON);
      const sheets = createSheetsClient(env.GOOGLE_SERVICE_ACCOUNT_JSON);

      const hivesFolderId = await findOrCreateFolder(drive, HIVES_FOLDER_NAME);
      await findOrCreateFolder(drive, PROFILES_FOLDER_NAME, hivesFolderId);

      let sheetId = env.LOG_SHEET_ID;
      if (!sheetId) {
        const existingSheet = await findFile(drive, LOG_SHEET_NAME, hivesFolderId);
        if (existingSheet) {
          sheetId = existingSheet;
        } else {
          sheetId = await createSheet(sheets, LOG_SHEET_NAME, hivesFolderId, drive);
        }
      }

      const existingTodos = await findFile(drive, TODOS_FILENAME, hivesFolderId);
      if (!existingTodos) {
        await createTextFile(drive, TODOS_FILENAME, getDefaultTodosContent(), hivesFolderId);
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              folder_url: `https://drive.google.com/drive/folders/${hivesFolderId}`,
              sheet_url: `https://docs.google.com/spreadsheets/d/${sheetId}`,
            }),
          },
        ],
      };
    }
  );
}
