import { sheets_v4, drive_v3 } from 'googleapis';
import {
  LOGS_SHEET_NAME,
  PROFILES_SHEET_NAME,
  APIARY_TODOS_SHEET_NAME,
  LOGS_SHEET_HEADERS,
  PROFILES_SHEET_HEADERS,
  APIARY_TODOS_SHEET_HEADERS,
} from '../constants.js';

export async function appendRow(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string,
  values: (string | number | undefined)[]
): Promise<void> {
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [values],
    },
  });
}

export async function getRows(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string
): Promise<string[][]> {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A2:Z`,
  });

  return (response.data.values as string[][]) || [];
}

export async function findRowIndex(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string,
  columnIndex: number,
  value: string
): Promise<number | null> {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A1:Z`,
  });

  const rows = (response.data.values as string[][]) || [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][columnIndex] === value) {
      return i + 1; // 1-based row index (row 1 is header)
    }
  }
  return null;
}

export async function updateRow(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string,
  rowIndex: number,
  values: (string | number | undefined)[]
): Promise<void> {
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [values],
    },
  });
}

export async function createSpreadsheet(
  sheets: sheets_v4.Sheets,
  title: string,
  driveService: drive_v3.Drive
): Promise<string> {
  const response = await driveService.files.create({
    requestBody: {
      name: title,
      mimeType: 'application/vnd.google-apps.spreadsheet',
    },
    fields: 'id',
  });

  const spreadsheetId = response.data.id as string;

  // Rename the default sheet to "logs" and add "profiles" and "apiary_todos"
  const sheetsResponse = await sheets.spreadsheets.get({ spreadsheetId });
  const defaultSheetId = sheetsResponse.data.sheets?.[0]?.properties?.sheetId ?? 0;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateSheetProperties: {
            properties: { sheetId: defaultSheetId, title: LOGS_SHEET_NAME },
            fields: 'title',
          },
        },
        {
          addSheet: {
            properties: { title: PROFILES_SHEET_NAME },
          },
        },
        {
          addSheet: {
            properties: { title: APIARY_TODOS_SHEET_NAME },
          },
        },
      ],
    },
  });

  // Add headers to all three sheets
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: `${LOGS_SHEET_NAME}!A1`, values: [[...LOGS_SHEET_HEADERS]] },
        { range: `${PROFILES_SHEET_NAME}!A1`, values: [[...PROFILES_SHEET_HEADERS]] },
        { range: `${APIARY_TODOS_SHEET_NAME}!A1`, values: [[...APIARY_TODOS_SHEET_HEADERS]] },
      ],
    },
  });

  // Get updated sheet IDs for formatting
  const updatedSheets = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetIds = (updatedSheets.data.sheets ?? []).map(
    (s: sheets_v4.Schema$Sheet) => s.properties?.sheetId ?? 0
  );

  // Apply bold header + frozen row formatting to all sheets
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: sheetIds.flatMap((sheetId: number) => [
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
        },
      ]),
    },
  });

  return spreadsheetId;
}
