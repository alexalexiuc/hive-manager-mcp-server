import { describe, it } from 'vitest';

describe('hive_get_profile', () => {
  it.todo('returns profile text for existing hive');
  it.todo('throws error when profile not found');
  it.todo('throws error when PROFILES_FOLDER_ID not set');
});

describe('hive_update_profile', () => {
  it.todo('merges new fields with existing profile');
  it.todo('writes updated profile back to Drive');
  it.todo('throws error when profile not found');
  it.todo('handles partial updates (only provided fields change)');
});

describe('hive_get_all_profiles', () => {
  it.todo('returns all profiles from profiles/ folder');
  it.todo('returns empty list when no profiles exist');
  it.todo('correctly extracts hive_id from filename');
});
