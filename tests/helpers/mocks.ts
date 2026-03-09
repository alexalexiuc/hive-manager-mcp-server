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
      get: vi.fn().mockResolvedValue({ data: { sheets: [{ properties: { sheetId: 0, title: 'hives' } }] } }),
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

export function mockHiveRow(hive: string, overrides?: Partial<Record<string, string>>): string[] {
  const data = {
    hive_type: 'vertical',
    units: '3',
    last_check: '2024-01-15',
    next_check: '2024-01-29',
    strength: 'strong',
    queen_status: 'seen',
    brood_status: 'healthy',
    food_status: 'medium',
    last_action: 'Added super',
    last_treatment: '',
    notes: 'Colony looks healthy',
    queen_race: 'Carniolan',
    queen_birth_year: '2024',
    origin_hive: '',
    location: 'orchard',
    active: 'true',
    updated_at: '2024-01-15T10:00:00.000Z',
    ...overrides,
  };

  return [
    hive,
    data.hive_type,
    data.units,
    data.last_check,
    data.next_check,
    data.strength,
    data.queen_status,
    data.brood_status,
    data.food_status,
    data.last_action,
    data.last_treatment,
    data.notes,
    data.queen_race,
    data.queen_birth_year,
    data.origin_hive,
    data.location,
    data.active,
    data.updated_at,
  ];
}

export function mockLogRow(overrides?: Partial<Record<string, string>>): string[] {
  const data = {
    log_id: '01JPABC123456789ABCDEFGHIJ',
    timestamp: '2024-01-15T10:00:00.000Z',
    hive: '1',
    event_type: 'inspection',
    summary: 'Colony looks healthy, added super',
    next_check: '2024-01-29',
    treatment_product: '',
    treatment_dose: '',
    treatment_duration: '',
    tags: '',
    ...overrides,
  };

  return [
    data.log_id,
    data.timestamp,
    data.hive,
    data.event_type,
    data.summary,
    data.next_check,
    data.treatment_product,
    data.treatment_dose,
    data.treatment_duration,
    data.tags,
  ];
}

export function mockRelocationRow(overrides?: Partial<Record<string, string>>): string[] {
  const data = {
    timestamp: '2024-05-01T08:00:00.000Z',
    hives: '1,2,3',
    location: 'South field',
    notes: 'Moved for clover season',
    ...overrides,
  };

  return [data.timestamp, data.hives, data.location, data.notes];
}

