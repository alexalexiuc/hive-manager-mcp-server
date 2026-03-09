import { describe, it } from 'vitest';

describe('apiary_get_hive_status', () => {
  it.todo('returns full hive row for an existing hive from hives sheet');
  it.todo('throws error when hive is not found');
  it.todo('throws error when x-spreadsheet-id header missing');
});

describe('apiary_list_hives', () => {
  it.todo('returns all active hives by default (active_only=true)');
  it.todo('returns all hives including inactive when active_only=false');
  it.todo('filters by location');
  it.todo('filters by queen_status');
  it.todo('filters by strength');
  it.todo('returns count alongside hives array');
  it.todo('throws error when x-spreadsheet-id header missing');
});

describe('apiary_list_due_for_check', () => {
  it.todo('returns hives where next_check date has passed');
  it.todo('returns hives with no next_check and last_check older than threshold');
  it.todo('returns hives with no last_check date (never inspected)');
  it.todo('defaults to a 7-day threshold when days not provided');
  it.todo('sorts results by last_check ascending (most overdue first)');
  it.todo('filters by location when provided');
  it.todo('throws error when x-spreadsheet-id header missing');
});

describe('apiary_update_hive_profile', () => {
  it.todo('creates new hive row when hive does not exist');
  it.todo('merges new metadata fields with existing hive row');
  it.todo('converts boolean active flag to string "true"/"false"');
  it.todo('returns the updated hive row');
  it.todo('throws error when x-spreadsheet-id header missing');
});
