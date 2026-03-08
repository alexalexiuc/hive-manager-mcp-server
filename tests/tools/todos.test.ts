import { describe, it } from 'vitest';

describe('hive_get_todos', () => {
  it.todo('returns all todos from apiary_todos sheet as JSON');
  it.todo('returns empty list when no todos exist');
  it.todo('throws error when x-spreadsheet-id header missing');
});

describe('hive_add_todo', () => {
  it.todo('appends new todo row to apiary_todos sheet');
  it.todo('sets created_at and updated_at to current timestamp');
  it.todo('defaults status to open when not provided');
  it.todo('returns success message');
  it.todo('throws error when x-spreadsheet-id header missing');
  it.todo('validates todo is a non-empty string');
});
