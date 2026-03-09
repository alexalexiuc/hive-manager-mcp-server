import { describe, it } from 'vitest';

describe('hive_list_todos', () => {
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

describe('hive_complete_todo', () => {
  it.todo('sets todo status to done in apiary_todos sheet');
  it.todo('updates updated_at timestamp');
  it.todo('optionally replaces notes when provided');
  it.todo('throws error when todo with created_at is not found');
  it.todo('throws error when x-spreadsheet-id header missing');
});
