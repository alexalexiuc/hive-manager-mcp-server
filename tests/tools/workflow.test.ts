import { describe, it } from 'vitest';

describe('apiary_log_harvest', () => {
  it.todo('appends a row to the harvests sheet with harvest_id, timestamp, hive, year, weight_kg, season');
  it.todo('appends a "harvest" entry to the logs sheet for hive timeline completeness');
  it.todo('updates last_check and last_action on the hive row');
  it.todo('defaults year to current year when not provided');
  it.todo('generates a ULID harvest_id');
  it.todo('returns { harvest_id, hive, year, weight_kg, season, timestamp }');
  it.todo('throws error when x-spreadsheet-id header missing');
});

describe('apiary_get_harvest_summary', () => {
  it.todo('returns total_kg across all harvests');
  it.todo('returns by_hive breakdown with per-hive totals and entry counts');
  it.todo('returns by_year breakdown');
  it.todo('returns by_season breakdown with year grouping');
  it.todo('filters by hive when provided');
  it.todo('filters by year when provided');
  it.todo('filters by season label (partial match) when provided');
  it.todo('returns zero totals when no harvest records exist');
  it.todo('throws error when x-spreadsheet-id header missing');
});
