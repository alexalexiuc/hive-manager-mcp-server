import { describe, it } from 'vitest';

describe('hive_get_todos', () => {
  it.todo('returns todos file content');
  it.todo('throws error when HIVES_FOLDER_ID not set');
  it.todo('throws error when todos_general.txt not found');
});

describe('hive_update_todos', () => {
  it.todo('overwrites todos file with new content');
  it.todo('returns success message');
  it.todo('throws error when todos_general.txt not found');
  it.todo('validates content is a non-empty string');
});
