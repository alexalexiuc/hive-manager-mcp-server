export const SPREADSHEET_NAME = 'hive_manager';
export const LOGS_SHEET_NAME = 'logs';
export const PROFILES_SHEET_NAME = 'profiles';
export const APIARY_TODOS_SHEET_NAME = 'apiary_todos';
export const RELOCATIONS_SHEET_NAME = 'relocations';

export const LOGS_SHEET_HEADERS = [
  'timestamp',
  'hive',
  'event_type',
  'queen_seen',
  'brood_status',
  'food_status',
  'action_taken',
  'notes',
  'next_check',
  'tags',
] as const;

export const PROFILES_SHEET_HEADERS = [
  'hive',
  'last_check',
  'next_check',
  'strength',
  'queen_status',
  'brood_status',
  'food_status',
  'notes',
  'todos',
  'updated_at',
  'origin_hive',
  'queen_race',
  'queen_birth_year',
] as const;

export const APIARY_TODOS_SHEET_HEADERS = [
  'todo',
  'priority',
  'status',
  'due_date',
  'notes',
  'created_at',
  'updated_at',
] as const;

export const RELOCATIONS_SHEET_HEADERS = [
  'timestamp',
  'hives',
  'location',
  'notes',
] as const;

export enum EventType {
  INSPECTION = 'inspection',
  FEEDING = 'feeding',
  TREATMENT = 'treatment',
  HARVEST = 'harvest',
}

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
];

export const DEFAULT_LOG_LIMIT = 50;
export const MAX_LOG_LIMIT = 500;

export const SPREADSHEET_ID_HEADER = 'x-spreadsheet-id';

// Column index maps — derived from header arrays so indices stay in sync.
export const LOG_COL = Object.fromEntries(
  LOGS_SHEET_HEADERS.map((h, i) => [h, i]),
) as { [K in (typeof LOGS_SHEET_HEADERS)[number]]: number };

export const PROFILE_COL = Object.fromEntries(
  PROFILES_SHEET_HEADERS.map((h, i) => [h, i]),
) as { [K in (typeof PROFILES_SHEET_HEADERS)[number]]: number };

export const TODO_COL = Object.fromEntries(
  APIARY_TODOS_SHEET_HEADERS.map((h, i) => [h, i]),
) as { [K in (typeof APIARY_TODOS_SHEET_HEADERS)[number]]: number };

export const RELOCATION_COL = Object.fromEntries(
  RELOCATIONS_SHEET_HEADERS.map((h, i) => [h, i]),
) as { [K in (typeof RELOCATIONS_SHEET_HEADERS)[number]]: number };
