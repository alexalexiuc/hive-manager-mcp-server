import { sheets_v4, drive_v3 } from 'googleapis';
import {
  LOGS_SHEET_NAME,
  PROFILES_SHEET_NAME,
  APIARY_TODOS_SHEET_NAME,
  RELOCATIONS_SHEET_NAME,
  LOGS_SHEET_HEADERS,
  PROFILES_SHEET_HEADERS,
  APIARY_TODOS_SHEET_HEADERS,
  RELOCATIONS_SHEET_HEADERS,
} from '../constants.js';
import { execWithBackoffRetry } from '../shared/retry.js';

const REQUIRED_SHEETS = [
  LOGS_SHEET_NAME,
  PROFILES_SHEET_NAME,
  APIARY_TODOS_SHEET_NAME,
  RELOCATIONS_SHEET_NAME,
] as const;

function getSheetIdByTitle(
  spreadsheet: sheets_v4.Schema$Spreadsheet,
  title: string
): number | null {
  for (const sheet of spreadsheet.sheets ?? []) {
    if (sheet.properties?.title === title && typeof sheet.properties.sheetId === 'number') {
      return sheet.properties.sheetId;
    }
  }

  return null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return JSON.stringify(error);
}

function isMissingSheetError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('unable to parse range') ||
    message.includes('range not found') ||
    message.includes('sheet not found')
  );
}

function toSheetOperationError(error: unknown, sheetName: string): Error {
  if (isMissingSheetError(error)) {
    return new Error(
      `Required sheet "${sheetName}" is missing. Run hive_setup to create required sheets.`
    );
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(getErrorMessage(error));
}

export async function appendRow(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string,
  values: (string | number | undefined)[]
): Promise<void> {
  try {
    await execWithBackoffRetry(async () => {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [values],
        },
      });
    });
  } catch (error: unknown) {
    throw toSheetOperationError(error, sheetName);
  }
}

export async function getRows(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string
): Promise<string[][]> {
  try {
    const response = await execWithBackoffRetry(async () => {
      return sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A2:Z`,
      });
    });

    return (response.data.values as string[][]) || [];
  } catch (error: unknown) {
    throw toSheetOperationError(error, sheetName);
  }
}

export async function findRowIndex(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string,
  columnIndex: number,
  value: string
): Promise<number | null> {
  try {
    const response = await execWithBackoffRetry(async () => {
      return sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A1:Z`,
      });
    });

    const rows = (response.data.values as string[][]) || [];
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][columnIndex] === value) {
        return i + 1; // 1-based row index (row 1 is header)
      }
    }

    return null;
  } catch (error: unknown) {
    throw toSheetOperationError(error, sheetName);
  }
}

export async function updateRow(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string,
  rowIndex: number,
  values: (string | number | undefined)[]
): Promise<void> {
  try {
    await execWithBackoffRetry(async () => {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [values],
        },
      });
    });
  } catch (error: unknown) {
    throw toSheetOperationError(error, sheetName);
  }
}

export async function createSpreadsheet(
  sheets: sheets_v4.Sheets,
  title: string,
  driveService: drive_v3.Drive
): Promise<string> {
  const response = await execWithBackoffRetry(async () => {
    return driveService.files.create({
      requestBody: {
        name: title,
        mimeType: 'application/vnd.google-apps.spreadsheet',
      },
      fields: 'id',
    });
  });

  const spreadsheetId = response.data.id as string;
  await ensureSpreadsheetStructure(sheets, spreadsheetId);
  return spreadsheetId;
}

export async function ensureSpreadsheetStructure(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<void> {
  const initial = await execWithBackoffRetry(async () => {
    return sheets.spreadsheets.get({ spreadsheetId });
  });
  const hasLogs = getSheetIdByTitle(initial.data, LOGS_SHEET_NAME) !== null;
  const hasProfiles = getSheetIdByTitle(initial.data, PROFILES_SHEET_NAME) !== null;
  const hasTodos = getSheetIdByTitle(initial.data, APIARY_TODOS_SHEET_NAME) !== null;
  const hasRelocations = getSheetIdByTitle(initial.data, RELOCATIONS_SHEET_NAME) !== null;
  const defaultSheetId = getSheetIdByTitle(initial.data, 'Sheet1');

  const setupRequests: sheets_v4.Schema$Request[] = [];
  if (!hasLogs) {
    if (defaultSheetId !== null) {
      setupRequests.push({
        updateSheetProperties: {
          properties: { sheetId: defaultSheetId, title: LOGS_SHEET_NAME },
          fields: 'title',
        },
      });
    } else {
      setupRequests.push({
        addSheet: {
          properties: { title: LOGS_SHEET_NAME },
        },
      });
    }
  }

  if (!hasProfiles) {
    setupRequests.push({
      addSheet: {
        properties: { title: PROFILES_SHEET_NAME },
      },
    });
  }

  if (!hasTodos) {
    setupRequests.push({
      addSheet: {
        properties: { title: APIARY_TODOS_SHEET_NAME },
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
          { range: `${LOGS_SHEET_NAME}!A1`, values: [[...LOGS_SHEET_HEADERS]] },
          { range: `${PROFILES_SHEET_NAME}!A1`, values: [[...PROFILES_SHEET_HEADERS]] },
          { range: `${APIARY_TODOS_SHEET_NAME}!A1`, values: [[...APIARY_TODOS_SHEET_HEADERS]] },
          { range: `${RELOCATIONS_SHEET_NAME}!A1`, values: [[...RELOCATIONS_SHEET_HEADERS]] },
        ],
      },
    });
  });

  // Apply bold header + frozen row formatting to required sheets.
  const updated = await execWithBackoffRetry(async () => {
    return sheets.spreadsheets.get({ spreadsheetId });
  });
  const formatRequests: sheets_v4.Schema$Request[] = [];
  for (const title of REQUIRED_SHEETS) {
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
