import { describe, it } from 'vitest';

describe('apiary_add_todo', () => {
  it.todo('appends new todo row to todos sheet with ULID todo_id');
  it.todo('sets created_at and updated_at to current timestamp');
  it.todo('defaults status to open');
  it.todo('defaults priority to medium when not provided');
  it.todo('stores hive identifier when provided (hive-scoped todo)');
  it.todo('stores empty hive when omitted (apiary-level todo)');
  it.todo('returns { todo_id, hive, todo, priority, due_date, created_at }');
  it.todo('throws error when x-spreadsheet-id header missing');
  it.todo('validates todo is a non-empty string');
});

describe('apiary_list_todos', () => {
  it.todo('returns open todos by default');
  it.todo('returns done todos when status=done');
  it.todo('returns all todos when status=all');
  it.todo('filters by hive when provided');
  it.todo('includes apiary-level todos alongside hive todos when include_apiary=true (default)');
  it.todo('excludes apiary-level todos when include_apiary=false');
  it.todo('filters by priority when provided');
  it.todo('returns count alongside todos array');
  it.todo('throws error when x-spreadsheet-id header missing');
});

describe('apiary_complete_todo', () => {
  it.todo('sets todo status to done in todos sheet');
  it.todo('updates updated_at timestamp');
  it.todo('optionally replaces notes when provided');
  it.todo('returns { todo_id, status: "done", updated_at }');
  it.todo('throws error when todo with todo_id is not found');
  it.todo('throws error when x-spreadsheet-id header missing');
});
