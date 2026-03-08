import { describe, expect, it } from 'vitest';
import { APIARY_TODOS_SHEET_NAME, TODO_COL } from '../../src/constants.js';
import { createSheetsClient } from '../../src/services/google.js';
import { getRows } from '../../src/services/sheets.js';
import {
  buildE2EEnv,
  callTool,
  extractToolJson,
  prepareAndClearSpreadsheet,
  requireE2EConfig,
  resolveE2ESpreadsheetContext,
} from './e2eUtils.js';

const config = requireE2EConfig();

describe('E2E tools: todos', () => {
  it('adds and reads todos via MCP tools', async () => {
    const ctx = await resolveE2ESpreadsheetContext(config);
    await prepareAndClearSpreadsheet(config, ctx.spreadsheetId);
    const env = buildE2EEnv(config);

    await callTool(env, ctx.spreadsheetId, 'hive_setup', {}, 501);

    const addResponse = await callTool(
      env,
      ctx.spreadsheetId,
      'hive_add_todo',
      {
        todo: 'Check brood pattern',
        priority: 'medium',
        status: 'open',
        notes: 'Created by e2e',
      },
      502,
    );
    const addPayload = extractToolJson(addResponse);
    expect(addPayload.success).toBe(true);

    const listResponse = await callTool(
      env,
      ctx.spreadsheetId,
      'hive_get_todos',
      {},
      503,
    );
    const listPayload = extractToolJson(listResponse);
    expect(listPayload.count).toBe(1);

    const todos = listPayload.todos as Array<Record<string, string>>;
    expect(todos[0]?.todo).toBe('Check brood pattern');
    const createdAt = todos[0]?.created_at;
    expect(createdAt).toBeTruthy();

    const updateResponse = await callTool(
      env,
      ctx.spreadsheetId,
      'hive_update_todo',
      {
        created_at: createdAt,
        priority: 'high',
        due_date: '2026-03-31',
        notes: 'Updated by e2e',
      },
      504,
    );
    const updatePayload = extractToolJson(updateResponse);
    expect(updatePayload.success).toBe(true);

    const markDoneResponse = await callTool(
      env,
      ctx.spreadsheetId,
      'hive_mark_todo_done',
      {
        created_at: createdAt,
      },
      505,
    );
    const markDonePayload = extractToolJson(markDoneResponse);
    expect(markDonePayload.success).toBe(true);

    const updatedListResponse = await callTool(
      env,
      ctx.spreadsheetId,
      'hive_get_todos',
      {},
      506,
    );
    const updatedListPayload = extractToolJson(updatedListResponse);
    const updatedTodos = updatedListPayload.todos as Array<Record<string, string>>;
    expect(updatedTodos[0]?.priority).toBe('high');
    expect(updatedTodos[0]?.due_date).toBe('2026-03-31');
    expect(updatedTodos[0]?.status).toBe('done');
    expect(updatedTodos[0]?.notes).toBe('Updated by e2e');

    const sheets = createSheetsClient(config.serviceAccountJson!);
    const rows = await getRows(
      sheets,
      ctx.spreadsheetId,
      APIARY_TODOS_SHEET_NAME,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0][TODO_COL.todo]).toBe('Check brood pattern');
    expect(rows[0][TODO_COL.priority]).toBe('high');
    expect(rows[0][TODO_COL.status]).toBe('done');
    expect(rows[0][TODO_COL.due_date]).toBe('2026-03-31');
    expect(rows[0][TODO_COL.notes]).toBe('Updated by e2e');
  }, 60_000);
});
