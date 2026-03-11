export const SPREADSHEET_NAME = 'hive_manager';
export const HIVES_SHEET_NAME = 'hives';
export const LOGS_SHEET_NAME = 'logs';
export const HARVESTS_SHEET_NAME = 'harvests';
export const TODOS_SHEET_NAME = 'todos';
export const RELOCATIONS_SHEET_NAME = 'relocations';

export const REQUIRED_HIVE_MANAGER_SHEETS = [
  HIVES_SHEET_NAME,
  LOGS_SHEET_NAME,
  HARVESTS_SHEET_NAME,
  TODOS_SHEET_NAME,
  RELOCATIONS_SHEET_NAME,
] as const;

export const HIVES_SHEET_HEADERS = [
  'hive',
  'hive_type',
  'units',
  'last_check',
  'next_check',
  'strength',
  'queen_status',
  'brood_status',
  'food_status',
  'last_action',
  'last_treatment',
  'notes',
  'queen_race',
  'queen_birth_year',
  'origin_hive',
  'location',
  'active',
  'updated_at',
] as const;

export const LOGS_SHEET_HEADERS = [
  'log_id',
  'timestamp',
  'hive',
  'event_type',
  'summary',
  'treatment_product',
  'treatment_dose',
  'treatment_duration',
  'tags',
] as const;

export const HARVESTS_SHEET_HEADERS = [
  'harvest_id',
  'timestamp',
  'hive',
  'year',
  'weight_kg',
  'season',
  'units_extracted',
  'notes',
] as const;

export const TODOS_SHEET_HEADERS = [
  'todo_id',
  'hive',
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
  NOTE = 'note',
}

export const DEFAULT_LOG_LIMIT = 20;
export const MAX_LOG_LIMIT = 200;

// Column index maps — derived from header arrays so indices stay in sync.
export const HIVE_COL = Object.fromEntries(
  HIVES_SHEET_HEADERS.map((h, i) => [h, i])
) as { [K in (typeof HIVES_SHEET_HEADERS)[number]]: number };

export const LOG_COL = Object.fromEntries(
  LOGS_SHEET_HEADERS.map((h, i) => [h, i])
) as { [K in (typeof LOGS_SHEET_HEADERS)[number]]: number };

export const HARVEST_COL = Object.fromEntries(
  HARVESTS_SHEET_HEADERS.map((h, i) => [h, i])
) as { [K in (typeof HARVESTS_SHEET_HEADERS)[number]]: number };

export const TODO_COL = Object.fromEntries(
  TODOS_SHEET_HEADERS.map((h, i) => [h, i])
) as { [K in (typeof TODOS_SHEET_HEADERS)[number]]: number };

export const RELOCATION_COL = Object.fromEntries(
  RELOCATIONS_SHEET_HEADERS.map((h, i) => [h, i])
) as { [K in (typeof RELOCATIONS_SHEET_HEADERS)[number]]: number };
