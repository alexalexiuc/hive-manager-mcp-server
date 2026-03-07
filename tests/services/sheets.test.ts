import { describe, it } from 'vitest';

describe('appendRow', () => {
  it.todo('calls spreadsheets.values.append with correct params');
  it.todo('handles API errors');
});

describe('getRows', () => {
  it.todo('returns rows from spreadsheet using A2:Z range');
  it.todo('returns empty array when no data');
  it.todo('handles API errors');
});

describe('findRowIndex', () => {
  it.todo('returns 1-based row index when value found in column');
  it.todo('returns null when value not found');
  it.todo('skips the header row when searching');
});

describe('updateRow', () => {
  it.todo('calls spreadsheets.values.update with correct row reference');
  it.todo('handles API errors');
});

describe('createSpreadsheet', () => {
  it.todo('creates spreadsheet with logs, profiles, and apiary_todos sheets');
  it.todo('adds correct header rows to each sheet');
  it.todo('applies bold formatting and frozen row to all header rows');
  it.todo('returns spreadsheet ID');
});
