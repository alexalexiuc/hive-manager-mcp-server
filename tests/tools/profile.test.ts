import { describe, it } from 'vitest';

describe('hive_get_profile', () => {
  it.todo('returns profile JSON for existing hive from profiles sheet');
  it.todo('throws error when profile not found in profiles sheet');
  it.todo('throws error when SPREADSHEET_ID not set');
});

describe('hive_update_profile', () => {
  it.todo('merges new fields with existing profile row');
  it.todo('writes updated row back to profiles sheet');
  it.todo('creates new profile row when hive does not exist');
  it.todo('handles partial updates (only provided fields change)');
  it.todo('throws error when SPREADSHEET_ID not set');
});

describe('hive_get_all_profiles', () => {
  it.todo('returns all profile rows from profiles sheet as JSON');
  it.todo('returns empty list when no profiles exist');
  it.todo('correctly maps row columns to profile fields');
  it.todo('throws error when SPREADSHEET_ID not set');
});
