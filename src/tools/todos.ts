import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getRows, appendRow, updateRow } from '../services/sheets.js';
import { requireSpreadsheetContext } from '../services/spreadsheet.js';
import { APIARY_TODOS_SHEET_NAME, TODO_COL } from '../constants.js';
import { isoTimestampSchema, yyyyMmDdDateSchema } from '../shared/validation.js';
import { toolResponse } from './toolResponse.js';
import type { Env } from '../types.js';

const TodoPrioritySchema = z.enum(['low', 'medium', 'high']);
const TodoStatusSchema = z.enum(['open', 'done']);

const AddTodoSchema = z.object({
  todo: z.string().describe('Task description'),
  priority: TodoPrioritySchema.optional().describe('Task priority'),
  status: TodoStatusSchema.optional().default('open').describe('Task status'),
  due_date: yyyyMmDdDateSchema
    .optional()
    .describe('Optional due date (YYYY-MM-DD)'),
  notes: z.string().optional().describe('Additional notes'),
});

const UpdateTodoSchemaBase = z.object({
  created_at: isoTimestampSchema.describe(
    'created_at value from hive_get_todos for the todo to update'
  ),
  todo: z.string().optional().describe('Updated task description'),
  priority: TodoPrioritySchema.optional().describe('Updated task priority'),
  status: TodoStatusSchema.optional().describe('Updated task status'),
  due_date: yyyyMmDdDateSchema
    .optional()
    .describe('Updated due date (YYYY-MM-DD)'),
  notes: z.string().optional().describe('Updated notes'),
});

const UpdateTodoSchema = UpdateTodoSchemaBase.refine(
    (input) =>
      input.todo !== undefined ||
      input.priority !== undefined ||
      input.status !== undefined ||
      input.due_date !== undefined ||
      input.notes !== undefined,
    {
      message: 'Provide at least one field to update.',
    }
  );

const MarkTodoDoneSchema = z.object({
  created_at: isoTimestampSchema.describe(
    'created_at value from hive_get_todos for the todo to mark as done'
  ),
  notes: z.string().optional().describe('Optional replacement notes'),
});

type AddTodoInput = z.infer<typeof AddTodoSchema>;
type UpdateTodoInput = z.infer<typeof UpdateTodoSchema>;
type MarkTodoDoneInput = z.infer<typeof MarkTodoDoneSchema>;

function rowToTodo(row: string[]) {
  return {
    todo: row[TODO_COL.todo] ?? '',
    priority: row[TODO_COL.priority] ?? '',
    status: row[TODO_COL.status] ?? '',
    due_date: row[TODO_COL.due_date] ?? '',
    notes: row[TODO_COL.notes] ?? '',
    created_at: row[TODO_COL.created_at] ?? '',
    updated_at: row[TODO_COL.updated_at] ?? '',
  };
}

function findTodoRowIndexByCreatedAt(
  rows: string[][],
  createdAt: string
): number | null {
  for (let i = 0; i < rows.length; i++) {
    if ((rows[i][TODO_COL.created_at] ?? '') === createdAt) {
      return i + 2; // 1-based row index with header at row 1
    }
  }

  return null;
}

export function registerTodoTools(server: McpServer, env: Env) {
  server.registerTool(
    'hive_get_todos',
    {
      description: 'List all general apiary todos from the apiary_todos sheet.',
    },
    async () => {
      const { spreadsheetId, sheets } = await requireSpreadsheetContext(env);

      const rows = await getRows(sheets, spreadsheetId, APIARY_TODOS_SHEET_NAME);
      const todos = rows.map((row) => rowToTodo(row));

      return toolResponse({ count: todos.length, todos });
    }
  );

  server.registerTool(
    'hive_add_todo',
    {
      description: 'Add a new general apiary todo entry to the apiary_todos sheet.',
      inputSchema: AddTodoSchema.shape,
    },
    async (input: AddTodoInput) => {
      const { spreadsheetId, sheets } = await requireSpreadsheetContext(env);

      const now = new Date().toISOString();
      const row = [
        input.todo,
        input.priority ?? '',
        input.status ?? 'open',
        input.due_date ?? '',
        input.notes ?? '',
        now,
        now,
      ];

      await appendRow(sheets, spreadsheetId, APIARY_TODOS_SHEET_NAME, row);

      return toolResponse({ success: true, message: 'Todo added successfully.' });
    }
  );

  server.registerTool(
    'hive_update_todo',
    {
      description:
        'Update fields in an existing apiary todo identified by created_at.',
      inputSchema: UpdateTodoSchemaBase.shape,
    },
    async (input: UpdateTodoInput) => {
      const { todo, priority, status, due_date, notes } = input;
      if (
        todo === undefined &&
        priority === undefined &&
        status === undefined &&
        due_date === undefined &&
        notes === undefined
      ) {
        throw new Error('Provide at least one field to update.');
      }
      const parsedInput = UpdateTodoSchema.parse(input);
      const { spreadsheetId, sheets } = await requireSpreadsheetContext(env);
      const rows = await getRows(sheets, spreadsheetId, APIARY_TODOS_SHEET_NAME);
      const rowIndex = findTodoRowIndexByCreatedAt(rows, parsedInput.created_at);

      if (rowIndex === null) {
        throw new Error(
          `Todo with created_at ${parsedInput.created_at} not found.`
        );
      }

      const existing = rows[rowIndex - 2] ?? [];
      const now = new Date().toISOString();
      const updatedRow = [
        parsedInput.todo ?? existing[TODO_COL.todo] ?? '',
        parsedInput.priority ?? existing[TODO_COL.priority] ?? '',
        parsedInput.status ?? existing[TODO_COL.status] ?? '',
        parsedInput.due_date ?? existing[TODO_COL.due_date] ?? '',
        parsedInput.notes ?? existing[TODO_COL.notes] ?? '',
        existing[TODO_COL.created_at] ?? parsedInput.created_at,
        now,
      ];

      await updateRow(sheets, spreadsheetId, APIARY_TODOS_SHEET_NAME, rowIndex, updatedRow);

      return toolResponse({
        success: true,
        message: 'Todo updated successfully.',
        created_at: existing[TODO_COL.created_at] ?? parsedInput.created_at,
      });
    }
  );

  server.registerTool(
    'hive_complete_todo',
    {
      description:
        'Mark an existing apiary todo as done, identified by created_at.',
      inputSchema: MarkTodoDoneSchema.shape,
    },
    async (input: MarkTodoDoneInput) => {
      const { spreadsheetId, sheets } = await requireSpreadsheetContext(env);
      const rows = await getRows(sheets, spreadsheetId, APIARY_TODOS_SHEET_NAME);
      const rowIndex = findTodoRowIndexByCreatedAt(rows, input.created_at);

      if (rowIndex === null) {
        throw new Error(`Todo with created_at ${input.created_at} not found.`);
      }

      const existing = rows[rowIndex - 2] ?? [];
      const now = new Date().toISOString();
      const updatedRow = [
        existing[TODO_COL.todo] ?? '',
        existing[TODO_COL.priority] ?? '',
        'done',
        existing[TODO_COL.due_date] ?? '',
        input.notes ?? existing[TODO_COL.notes] ?? '',
        existing[TODO_COL.created_at] ?? input.created_at,
        now,
      ];

      await updateRow(sheets, spreadsheetId, APIARY_TODOS_SHEET_NAME, rowIndex, updatedRow);

      return toolResponse({
        success: true,
        message: 'Todo marked as done.',
        created_at: existing[TODO_COL.created_at] ?? input.created_at,
      });
    }
  );
}
