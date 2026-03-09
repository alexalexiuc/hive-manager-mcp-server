import { sheets_v4 } from 'googleapis';
import { getSheetIdByTitle } from '../services/sheets';
import { execWithBackoffRetry } from '../shared/retry';
import {
  MEALS_SHEET_NAME,
  PROFILE_SHEET_NAME,
  MEALS_SHEET_HEADERS,
  PROFILE_SHEET_HEADERS,
  REQUIRED_CALORIES_SHEETS,
} from './constants';

export async function ensureCaloriesSpreadsheetStructure(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<void> {
  const initial = await execWithBackoffRetry(async () => {
    return sheets.spreadsheets.get({ spreadsheetId });
  });

  const hasMeals = getSheetIdByTitle(initial.data, MEALS_SHEET_NAME) !== null;
  const hasProfile =
    getSheetIdByTitle(initial.data, PROFILE_SHEET_NAME) !== null;
  const defaultSheetId = getSheetIdByTitle(initial.data, 'Sheet1');

  const setupRequests: sheets_v4.Schema$Request[] = [];

  if (!hasMeals) {
    if (defaultSheetId !== null) {
      setupRequests.push({
        updateSheetProperties: {
          properties: { sheetId: defaultSheetId, title: MEALS_SHEET_NAME },
          fields: 'title',
        },
      });
    } else {
      setupRequests.push({
        addSheet: { properties: { title: MEALS_SHEET_NAME } },
      });
    }
  }

  if (!hasProfile) {
    setupRequests.push({
      addSheet: { properties: { title: PROFILE_SHEET_NAME } },
    });
  }

  if (setupRequests.length > 0) {
    await execWithBackoffRetry(async () => {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: setupRequests },
      });
    });
  }

  // Write canonical headers
  await execWithBackoffRetry(async () => {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: [
          {
            range: `${MEALS_SHEET_NAME}!A1`,
            values: [[...MEALS_SHEET_HEADERS]],
          },
          {
            range: `${PROFILE_SHEET_NAME}!A1`,
            values: [[...PROFILE_SHEET_HEADERS]],
          },
        ],
      },
    });
  });

  // Apply formatting (bold header + frozen row + blue theme)
  const updated = await execWithBackoffRetry(async () => {
    return sheets.spreadsheets.get({ spreadsheetId });
  });

  const formatRequests: sheets_v4.Schema$Request[] = [];
  for (const title of REQUIRED_CALORIES_SHEETS) {
    const sheetId = getSheetIdByTitle(updated.data, title);
    if (sheetId === null) continue;

    formatRequests.push(
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
          cell: {
            userEnteredFormat: {
              textFormat: { bold: true },
              backgroundColor: { red: 0.12, green: 0.46, blue: 0.7 },
            },
          },
          fields: 'userEnteredFormat(textFormat,backgroundColor)',
        },
      },
      {
        updateSheetProperties: {
          properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
          fields: 'gridProperties.frozenRowCount',
        },
      }
    );
  }

  if (formatRequests.length > 0) {
    await execWithBackoffRetry(async () => {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: formatRequests },
      });
    });
  }
}
