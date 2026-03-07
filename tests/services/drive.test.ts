import { describe, it } from 'vitest';

describe('readFile', () => {
  it.todo('returns file content as string');
  it.todo('handles API errors');
});

describe('writeFile', () => {
  it.todo('updates file content via Drive API');
  it.todo('handles API errors');
});

describe('listFiles', () => {
  it.todo('returns list of files in folder');
  it.todo('filters by mimeType when provided');
  it.todo('returns empty array when folder is empty');
});

describe('findSpreadsheet', () => {
  it.todo('returns spreadsheet ID when found by name');
  it.todo('returns null when no spreadsheet with that name exists');
});
