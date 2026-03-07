import { vi } from 'vitest';

export function mockSheetsClient() {
  return {
    spreadsheets: {
      values: {
        append: vi.fn().mockResolvedValue({ data: {} }),
        get: vi.fn().mockResolvedValue({ data: { values: [] } }),
        update: vi.fn().mockResolvedValue({ data: {} }),
        batchUpdate: vi.fn().mockResolvedValue({ data: {} }),
      },
      batchUpdate: vi.fn().mockResolvedValue({ data: {} }),
      get: vi.fn().mockResolvedValue({ data: { sheets: [{ properties: { sheetId: 0, title: 'logs' } }] } }),
      create: vi.fn().mockResolvedValue({ data: { spreadsheetId: 'mock-spreadsheet-id' } }),
    },
  };
}

export function mockDriveClient() {
  return {
    files: {
      list: vi.fn().mockResolvedValue({ data: { files: [] } }),
      get: vi.fn().mockResolvedValue({ data: '' }),
      create: vi.fn().mockResolvedValue({ data: { id: 'mock-file-id' } }),
      update: vi.fn().mockResolvedValue({ data: {} }),
    },
  };
}

export function mockProfileRow(hive: string, overrides?: Partial<Record<string, string>>): string[] {
  const data = {
    last_check: '2024-01-15',
    strength: 'strong',
    queen_status: 'queen_seen',
    brood_status: 'healthy',
    food_status: 'medium',
    notes: 'Colony looks healthy',
    todos: 'Check honey super',
    updated_at: '2024-01-15T10:00:00.000Z',
    ...overrides,
  };

  return [
    hive,
    data.last_check,
    data.strength,
    data.queen_status,
    data.brood_status,
    data.food_status,
    data.notes,
    data.todos,
    data.updated_at,
  ];
}

export function mockLogRow(overrides?: Partial<Record<string, string>>): string[] {
  const data = {
    timestamp: '2024-01-15T10:00:00.000Z',
    hive: '1',
    event_type: 'inspection',
    queen_seen: 'true',
    brood_status: 'healthy',
    food_status: 'medium',
    action_taken: 'Added honey super',
    notes: 'All looks good',
    next_check: '2024-01-29',
    tags: 'inspection',
    ...overrides,
  };

  return [
    data.timestamp,
    data.hive,
    data.event_type,
    data.queen_seen,
    data.brood_status,
    data.food_status,
    data.action_taken,
    data.notes,
    data.next_check,
    data.tags,
  ];
}
