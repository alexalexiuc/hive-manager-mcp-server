import { describe, it } from 'vitest';

describe('appendRow', () => {
  it.todo('calls spreadsheets.values.append with correct params');
  it.todo('handles API errors');
});

describe('getRows', () => {
  it.todo('returns rows from spreadsheet');
  it.todo('returns empty array when no data');
  it.todo('handles API errors');
});

describe('createSheet', () => {
  it.todo('creates spreadsheet with correct name');
  it.todo('adds header row with LOG_SHEET_HEADERS');
  it.todo('applies bold formatting to header row');
  it.todo('freezes header row');
  it.todo('returns spreadsheet ID');
});
