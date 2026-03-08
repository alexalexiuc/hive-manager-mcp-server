import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createSheetsClient: vi.fn(),
  appendRow: vi.fn(),
  getRows: vi.fn(),
  requirePreparedSpreadsheetId: vi.fn(),
}));

vi.mock('../../src/services/google.js', () => ({
  createSheetsClient: mocks.createSheetsClient,
}));

vi.mock('../../src/services/sheets.js', () => ({
  appendRow: mocks.appendRow,
  getRows: mocks.getRows,
}));

vi.mock('../../src/services/spreadsheet.js', () => ({
  requirePreparedSpreadsheetId: mocks.requirePreparedSpreadsheetId,
}));

import { registerRelocationTools } from '../../src/tools/relocations.js';
import { RELOCATIONS_SHEET_NAME } from '../../src/constants.js';
type ToolHandler = (input: Record<string, unknown>) => Promise<{ content: Array<{ text: string }> }>;

function registerHandlers() {
  const handlers: Record<string, ToolHandler> = {};

  const server = {
    registerTool: vi.fn((name: string, _config: unknown, handler: ToolHandler) => {
      handlers[name] = handler;
    }),
  };

  registerRelocationTools(server as never, { GOOGLE_SERVICE_ACCOUNT_JSON: 'fake-json' });
  return handlers;
}

function parseTextResponse(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0]?.text ?? '{}') as Record<string, unknown>;
}

describe('hive_log_relocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSheetsClient.mockReturnValue('mock-sheets-client');
    mocks.requirePreparedSpreadsheetId.mockResolvedValue('spreadsheet-123');
  });

  it('appends a row to the relocations sheet with hives, location, timestamp, and notes', async () => {
    const handlers = registerHandlers();

    await handlers.hive_log_relocation({
      hives: '1,2,5',
      location: 'Mountain Apiary',
      timestamp: '2026-01-10T12:30:00.000Z',
      notes: 'Moved before frost',
    });

    expect(mocks.appendRow).toHaveBeenCalledWith(
      'mock-sheets-client',
      'spreadsheet-123',
      RELOCATIONS_SHEET_NAME,
      ['2026-01-10T12:30:00.000Z', '1,2,5', 'Mountain Apiary', 'Moved before frost']
    );
  });

  it('uses current timestamp when none is provided', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T09:00:00.000Z'));
    const handlers = registerHandlers();

    await handlers.hive_log_relocation({ hives: '3', location: 'North Yard' });

    expect(mocks.appendRow).toHaveBeenCalledWith(
      'mock-sheets-client',
      'spreadsheet-123',
      RELOCATIONS_SHEET_NAME,
      ['2026-03-01T09:00:00.000Z', '3', 'North Yard', '']
    );

    vi.useRealTimers();
  });

  it('returns success message with hive list and location', async () => {
    const handlers = registerHandlers();

    const result = await handlers.hive_log_relocation({ hives: '7', location: 'South Orchard' });
    const payload = parseTextResponse(result);

    expect(payload.success).toBe(true);
    expect(payload.message).toContain('7');
    expect(payload.message).toContain('South Orchard');
  });

  it('throws error when SPREADSHEET_ID is not set and setup has not been run', async () => {
    const handlers = registerHandlers();
    mocks.requirePreparedSpreadsheetId.mockRejectedValueOnce(
      new Error('No spreadsheet found. Run hive_setup first or set SPREADSHEET_ID in the MCP server environment.')
    );

    await expect(handlers.hive_log_relocation({ hives: '2', location: 'East' })).rejects.toThrow(
      'No spreadsheet found'
    );
  });
});

describe('hive_get_relocations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSheetsClient.mockReturnValue('mock-sheets-client');
    mocks.requirePreparedSpreadsheetId.mockResolvedValue('spreadsheet-123');
  });

  it('returns all relocation entries when no hive filter is given', async () => {
    const handlers = registerHandlers();
    mocks.getRows.mockResolvedValueOnce([
      ['2026-01-01T10:00:00.000Z', '1', 'North', ''],
      ['2026-01-02T10:00:00.000Z', '2', 'South', 'rainy'],
    ]);

    const result = await handlers.hive_get_relocations({});
    const payload = parseTextResponse(result);

    expect(payload.count).toBe(2);
    expect(payload.entries).toEqual([
      { timestamp: '2026-01-01T10:00:00.000Z', hives: '1', location: 'North', notes: '' },
      { timestamp: '2026-01-02T10:00:00.000Z', hives: '2', location: 'South', notes: 'rainy' },
    ]);
  });

  it('filters entries to only those that include the specified hive', async () => {
    const handlers = registerHandlers();
    mocks.getRows.mockResolvedValueOnce([
      ['2026-01-01T10:00:00.000Z', '1, 3', 'North', ''],
      ['2026-01-02T10:00:00.000Z', '2', 'South', ''],
      ['2026-01-03T10:00:00.000Z', '3,4', 'East', ''],
    ]);

    const result = await handlers.hive_get_relocations({ hive: '3' });
    const payload = parseTextResponse(result);

    expect(payload.count).toBe(2);
    expect(payload.entries).toEqual([
      { timestamp: '2026-01-01T10:00:00.000Z', hives: '1, 3', location: 'North', notes: '' },
      { timestamp: '2026-01-03T10:00:00.000Z', hives: '3,4', location: 'East', notes: '' },
    ]);
  });

  it('respects the limit parameter and returns the most recent entries', async () => {
    const handlers = registerHandlers();
    mocks.getRows.mockResolvedValueOnce([
      ['2026-01-01T10:00:00.000Z', '1', 'North', ''],
      ['2026-01-02T10:00:00.000Z', '1', 'South', ''],
      ['2026-01-03T10:00:00.000Z', '1', 'East', ''],
    ]);

    const result = await handlers.hive_get_relocations({ hive: '1', limit: 2 });
    const payload = parseTextResponse(result);

    expect(payload.count).toBe(2);
    expect(payload.entries).toEqual([
      { timestamp: '2026-01-02T10:00:00.000Z', hives: '1', location: 'South', notes: '' },
      { timestamp: '2026-01-03T10:00:00.000Z', hives: '1', location: 'East', notes: '' },
    ]);
  });

  it('defaults to limit 50 when not specified', async () => {
    const handlers = registerHandlers();
    const rows = Array.from({ length: 60 }, (_, i) => {
      const day = String(i + 1).padStart(2, '0');
      return [`2026-01-${day}T10:00:00.000Z`, '8', `Location-${day}`, ''];
    });
    mocks.getRows.mockResolvedValueOnce(rows);

    const result = await handlers.hive_get_relocations({});
    const payload = parseTextResponse(result);

    expect(payload.count).toBe(50);
    const entries = payload.entries as Array<{ timestamp: string }>;
    expect(entries[0]?.timestamp).toBe('2026-01-11T10:00:00.000Z');
    expect(entries[49]?.timestamp).toBe('2026-01-60T10:00:00.000Z');
  });

  it('returns empty list when no relocation records exist', async () => {
    const handlers = registerHandlers();
    mocks.getRows.mockResolvedValueOnce([]);

    const result = await handlers.hive_get_relocations({});
    const payload = parseTextResponse(result);

    expect(payload).toEqual({ count: 0, entries: [] });
  });

  it('throws error when SPREADSHEET_ID is not set and setup has not been run', async () => {
    const handlers = registerHandlers();
    mocks.requirePreparedSpreadsheetId.mockRejectedValueOnce(new Error('No spreadsheet found'));

    await expect(handlers.hive_get_relocations({})).rejects.toThrow('No spreadsheet found');
  });
});

describe('hive_get_current_location', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSheetsClient.mockReturnValue('mock-sheets-client');
    mocks.requirePreparedSpreadsheetId.mockResolvedValue('spreadsheet-123');
  });

  it('returns the most recent location for a hive that has relocation records', async () => {
    const handlers = registerHandlers();
    mocks.getRows.mockResolvedValueOnce([
      ['2026-01-01T10:00:00.000Z', '9', 'North', 'old'],
      ['2026-02-01T10:00:00.000Z', '9,10', 'South', 'latest'],
    ]);

    const result = await handlers.hive_get_current_location({ hive: '9' });
    const payload = parseTextResponse(result);

    expect(payload).toEqual({
      hive: '9',
      current_location: 'South',
      since: '2026-02-01T10:00:00.000Z',
      notes: 'latest',
    });
  });

  it('returns null current_location when no records exist for the hive', async () => {
    const handlers = registerHandlers();
    mocks.getRows.mockResolvedValueOnce([
      ['2026-01-01T10:00:00.000Z', '1', 'North', ''],
    ]);

    const result = await handlers.hive_get_current_location({ hive: '99' });
    const payload = parseTextResponse(result);

    expect(payload.hive).toBe('99');
    expect(payload.current_location).toBeNull();
  });

  it('includes the timestamp of the most recent relocation in the response', async () => {
    const handlers = registerHandlers();
    mocks.getRows.mockResolvedValueOnce([
      ['2026-03-01T10:00:00.000Z', '11', 'West', ''],
    ]);

    const result = await handlers.hive_get_current_location({ hive: '11' });
    const payload = parseTextResponse(result);

    expect(payload.since).toBe('2026-03-01T10:00:00.000Z');
  });

  it('throws error when SPREADSHEET_ID is not set and setup has not been run', async () => {
    const handlers = registerHandlers();
    mocks.requirePreparedSpreadsheetId.mockRejectedValueOnce(new Error('No spreadsheet found'));

    await expect(handlers.hive_get_current_location({ hive: '2' })).rejects.toThrow('No spreadsheet found');
  });
});
