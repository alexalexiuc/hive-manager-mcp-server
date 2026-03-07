import { vi } from 'vitest';

export function mockSheetsClient() {
  return {
    spreadsheets: {
      values: {
        append: vi.fn().mockResolvedValue({ data: {} }),
        get: vi.fn().mockResolvedValue({ data: { values: [] } }),
        update: vi.fn().mockResolvedValue({ data: {} }),
      },
      batchUpdate: vi.fn().mockResolvedValue({ data: {} }),
      get: vi.fn().mockResolvedValue({ data: {} }),
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

export function mockHiveProfile(hiveId: string, overrides?: Partial<Record<string, string>>): string {
  const sep = '========================================';
  const dash = '----------------------------------------';
  const data = {
    lastChecked: '2024-01-15',
    location: 'Main apiary',
    status: 'Strong',
    boxes: '2',
    frames: '8',
    queenSeen: 'Yes',
    notes: 'Colony looks healthy',
    todos: 'Check honey super',
    basicInfo: 'Italian bees, established 2023',
    ...overrides,
  };

  return [
    `HIVE ${hiveId}`,
    sep,
    `Last checked : ${data.lastChecked}`,
    `Location     : ${data.location}`,
    `Status       : ${data.status}`,
    `Boxes        : ${data.boxes}`,
    `Frames       : ${data.frames}`,
    `Queen seen   : ${data.queenSeen}`,
    dash,
    'NOTES:',
    data.notes,
    '',
    'TODOS:',
    data.todos,
    '',
    'BASIC INFO:',
    data.basicInfo,
    '',
  ].join('\n');
}

export function mockLogEntry(overrides?: Partial<Record<string, string>>): Record<string, string> {
  return {
    date: '2024-01-15',
    hive_id: '1',
    location: 'Main apiary',
    overall_status: 'Strong',
    boxes: '2',
    frames: '8',
    queen_seen: 'Yes',
    notes: 'All looks good',
    action_taken: 'Added honey super',
    next_visit: '2024-01-29',
    ...overrides,
  };
}
