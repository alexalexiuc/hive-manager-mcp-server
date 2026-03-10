import { sheets_v4 } from 'googleapis';
import {
  HIVES_SHEET_NAME,
  LOGS_SHEET_NAME,
  HARVESTS_SHEET_NAME,
  TODOS_SHEET_NAME,
  RELOCATIONS_SHEET_NAME,
  HIVES_SHEET_HEADERS,
  LOGS_SHEET_HEADERS,
  HARVESTS_SHEET_HEADERS,
  TODOS_SHEET_HEADERS,
  RELOCATIONS_SHEET_HEADERS,
  REQUIRED_HIVE_MANAGER_SHEETS,
} from './constants';
import { execWithBackoffRetry } from '../shared/retry';
import { getSheetIdByTitle } from '../services/sheets';

export async function ensureHiveManagerSpreadsheetStructure(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<void> {
  const initial = await execWithBackoffRetry(async () => {
    return sheets.spreadsheets.get({ spreadsheetId });
  });
  const hasHives = getSheetIdByTitle(initial.data, HIVES_SHEET_NAME) !== null;
  const hasLogs = getSheetIdByTitle(initial.data, LOGS_SHEET_NAME) !== null;
  const hasHarvests =
    getSheetIdByTitle(initial.data, HARVESTS_SHEET_NAME) !== null;
  const hasTodos = getSheetIdByTitle(initial.data, TODOS_SHEET_NAME) !== null;
  const hasRelocations =
    getSheetIdByTitle(initial.data, RELOCATIONS_SHEET_NAME) !== null;
  const defaultSheetId = getSheetIdByTitle(initial.data, 'Sheet1');

  const setupRequests: sheets_v4.Schema$Request[] = [];
  if (!hasHives) {
    if (defaultSheetId !== null) {
      setupRequests.push({
        updateSheetProperties: {
          properties: { sheetId: defaultSheetId, title: HIVES_SHEET_NAME },
          fields: 'title',
        },
      });
    } else {
      setupRequests.push({
        addSheet: {
          properties: { title: HIVES_SHEET_NAME },
        },
      });
    }
  }

  if (!hasLogs) {
    setupRequests.push({
      addSheet: {
        properties: { title: LOGS_SHEET_NAME },
      },
    });
  }

  if (!hasHarvests) {
    setupRequests.push({
      addSheet: {
        properties: { title: HARVESTS_SHEET_NAME },
      },
    });
  }

  if (!hasTodos) {
    setupRequests.push({
      addSheet: {
        properties: { title: TODOS_SHEET_NAME },
      },
    });
  }

  if (!hasRelocations) {
    setupRequests.push({
      addSheet: {
        properties: { title: RELOCATIONS_SHEET_NAME },
      },
    });
  }

  if (setupRequests.length > 0) {
    await execWithBackoffRetry(async () => {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: setupRequests,
        },
      });
    });
  }

  // Ensure canonical headers are always present.
  await execWithBackoffRetry(async () => {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: [
          {
            range: `${HIVES_SHEET_NAME}!A1`,
            values: [[...HIVES_SHEET_HEADERS]],
          },
          { range: `${LOGS_SHEET_NAME}!A1`, values: [[...LOGS_SHEET_HEADERS]] },
          {
            range: `${HARVESTS_SHEET_NAME}!A1`,
            values: [[...HARVESTS_SHEET_HEADERS]],
          },
          {
            range: `${TODOS_SHEET_NAME}!A1`,
            values: [[...TODOS_SHEET_HEADERS]],
          },
          {
            range: `${RELOCATIONS_SHEET_NAME}!A1`,
            values: [[...RELOCATIONS_SHEET_HEADERS]],
          },
        ],
      },
    });
  });

  // Apply bold header + frozen row formatting to required sheets.
  const updated = await execWithBackoffRetry(async () => {
    return sheets.spreadsheets.get({ spreadsheetId });
  });
  const formatRequests: sheets_v4.Schema$Request[] = [];
  for (const title of REQUIRED_HIVE_MANAGER_SHEETS) {
    const sheetId = getSheetIdByTitle(updated.data, title);
    if (sheetId === null) {
      continue;
    }

    formatRequests.push(
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
          cell: {
            userEnteredFormat: {
              textFormat: { bold: true },
              backgroundColor: { red: 0.2, green: 0.6, blue: 0.2 },
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
        requestBody: {
          requests: formatRequests,
        },
      });
    });
  }
}
