import { sheets_v4 } from 'googleapis';
import { execWithBackoffRetry } from '../shared/retry';

export function getSheetIdByTitle(
  spreadsheet: sheets_v4.Schema$Spreadsheet,
  title: string
): number | null {
  for (const sheet of spreadsheet.sheets ?? []) {
    if (
      sheet.properties?.title === title &&
      typeof sheet.properties.sheetId === 'number'
    ) {
      return sheet.properties.sheetId;
    }
  }

  return null;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return JSON.stringify(error);
}

export function isMissingSheetError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('unable to parse range') ||
    message.includes('range not found') ||
    message.includes('sheet not found')
  );
}

export function toSheetOperationError(
  error: unknown,
  sheetName: string
): Error {
  if (isMissingSheetError(error)) {
    return new Error(
      `Required sheet "${sheetName}" is missing. Run setup tool to create required sheets.`
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
