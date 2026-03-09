import { describe, expect, it } from 'vitest';
import { createSheetsClient } from '../../../src/services/google';
import { getRows } from '../../../src/services/sheets';
import {
  buildE2EEnv,
  callTool,
  extractToolJson,
  prepareAndClearHiveManagerSpreadsheet,
  requireE2EConfig,
  resolveE2ESpreadsheetContext,
} from '../e2eUtils';
import { TODO_COL, TODOS_SHEET_NAME } from '../../../src/hiveManager/constants';

const config = requireE2EConfig();

describe('E2E tools: todos', () => {
  it('adds, lists, and completes todos via MCP tools', async () => {
    const ctx = await resolveE2ESpreadsheetContext(config);
    await prepareAndClearHiveManagerSpreadsheet(config, ctx.spreadsheetId);
    const env = buildE2EEnv(config);

    await callTool(env, ctx.spreadsheetId, 'apiary_setup', {}, 501);

    const addResponse = await callTool(
      env,
      ctx.spreadsheetId,
      'apiary_add_todo',
      {
        todo: 'Check brood pattern',
        priority: 'medium',
        notes: 'Created by e2e',
      },
      502
    );
    const addPayload = extractToolJson(addResponse);
    expect(typeof addPayload.todo_id).toBe('string');
    expect(addPayload.todo).toBe('Check brood pattern');
    expect(addPayload.priority).toBe('medium');
    const todoId = addPayload.todo_id as string;

    const listResponse = await callTool(
      env,
      ctx.spreadsheetId,
      'apiary_list_todos',
      {},
      503
    );
    const listPayload = extractToolJson(listResponse);
    expect(listPayload.count).toBe(1);

    const todos = listPayload.todos as Array<Record<string, string>>;
    expect(todos[0]?.todo).toBe('Check brood pattern');
    expect(todos[0]?.status).toBe('open');

    const markDoneResponse = await callTool(
      env,
      ctx.spreadsheetId,
      'apiary_complete_todo',
      { todo_id: todoId },
      504
    );
    const markDonePayload = extractToolJson(markDoneResponse);
    expect(markDonePayload.todo_id).toBe(todoId);
    expect(markDonePayload.status).toBe('done');

    const updatedListResponse = await callTool(
      env,
      ctx.spreadsheetId,
      'apiary_list_todos',
      { status: 'done' },
      505
    );
    const updatedListPayload = extractToolJson(updatedListResponse);
    const updatedTodos = updatedListPayload.todos as Array<
      Record<string, string>
    >;
    expect(updatedTodos[0]?.status).toBe('done');

    const sheets = createSheetsClient(config.serviceAccountJson!);
    const rows = await getRows(sheets, ctx.spreadsheetId, TODOS_SHEET_NAME);
    expect(rows).toHaveLength(1);
    expect(rows[0][TODO_COL.todo]).toBe('Check brood pattern');
    expect(rows[0][TODO_COL.priority]).toBe('medium');
    expect(rows[0][TODO_COL.status]).toBe('done');
  }, 60_000);
});
