import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getRows, appendRow, updateRow } from '../services/sheets.js';
import { requireSpreadsheetContext } from '../services/spreadsheet.js';
import { TODOS_SHEET_NAME, TODO_COL } from '../constants.js';
import { yyyyMmDdDateSchema } from '../shared/validation.js';
import { generateUlid } from '../shared/ulid.js';
import { toolResponse } from './toolResponse.js';
import type { Env } from '../types.js';

const TodoPrioritySchema = z.enum(['low', 'medium', 'high']);
const TodoStatusSchema = z.enum(['open', 'done', 'all']);

const AddTodoSchema = z.object({
  todo: z.string().describe('Task description'),
  hive: z
    .string()
    .optional()
    .describe('Hive identifier. Omit for apiary-level todos.'),
  priority: TodoPrioritySchema
    .optional()
    .default('medium')
    .describe('Task priority: "high" | "medium" | "low". Defaults to "medium".'),
  due_date: yyyyMmDdDateSchema
    .optional()
    .describe('Optional due date (YYYY-MM-DD)'),
  notes: z.string().optional().describe('Optional context'),
});

const ListTodosSchema = z.object({
  hive: z
    .string()
    .optional()
    .describe('Filter to one hive\'s todos'),
  include_apiary: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      'Include apiary-level todos (where hive is empty) alongside hive-specific ones. Defaults to true.',
    ),
  status: TodoStatusSchema.optional()
    .default('open')
    .describe('"open" | "done" | "all". Defaults to "open".'),
  priority: TodoPrioritySchema
    .optional()
    .describe('Filter by priority: "high", "medium", or "low"'),
});

const CompleteTodoSchema = z.object({
  todo_id: z.string().describe('Todo identifier from apiary_add_todo or apiary_list_todos'),
  notes: z.string().optional().describe('Optional completion notes'),
});

type AddTodoInput = z.infer<typeof AddTodoSchema>;
type ListTodosInput = z.infer<typeof ListTodosSchema>;
type CompleteTodoInput = z.infer<typeof CompleteTodoSchema>;

function rowToTodo(row: string[]) {
  return {
    todo_id: row[TODO_COL.todo_id] ?? '',
    hive: row[TODO_COL.hive] ?? '',
    todo: row[TODO_COL.todo] ?? '',
    priority: row[TODO_COL.priority] ?? '',
    status: row[TODO_COL.status] ?? '',
    due_date: row[TODO_COL.due_date] ?? '',
    notes: row[TODO_COL.notes] ?? '',
    created_at: row[TODO_COL.created_at] ?? '',
    updated_at: row[TODO_COL.updated_at] ?? '',
  };
}

function findTodoRowIndexByTodoId(
  rows: string[][],
  todoId: string,
): number | null {
  for (let i = 0; i < rows.length; i++) {
    if ((rows[i][TODO_COL.todo_id] ?? '') === todoId) {
      return i + 2; // 1-based row index with header at row 1
    }
  }

  return null;
}

export function registerTodoTools(server: McpServer, env: Env) {
  server.registerTool(
    'apiary_add_todo',
    {
      description:
        'Add a todo task. Supply hive to make it hive-specific; omit hive for an apiary-level task such as ordering supplies or general maintenance.',
      inputSchema: AddTodoSchema.shape,
      annotations: { idempotentHint: false },
    },
    async (input: AddTodoInput) => {
      const { spreadsheetId, sheets } = await requireSpreadsheetContext(env);

      const now = new Date().toISOString();
      const todoId = generateUlid();
      const row = [
        todoId,
        input.hive ?? '',
        input.todo,
        input.priority ?? 'medium',
        'open',
        input.due_date ?? '',
        input.notes ?? '',
        now,
        now,
      ];

      await appendRow(sheets, spreadsheetId, TODOS_SHEET_NAME, row);

      return toolResponse({
        todo_id: todoId,
        hive: input.hive ?? '',
        todo: input.todo,
        priority: input.priority ?? 'medium',
        due_date: input.due_date ?? null,
        created_at: now,
      });
    },
  );

  server.registerTool(
    'apiary_list_todos',
    {
      description:
        'List todos with optional filters. Filter by hive to see hive-specific items. Use include_apiary to control whether apiary-level todos appear alongside hive todos. Defaults to open status only.',
      inputSchema: ListTodosSchema.shape,
      annotations: { readOnlyHint: true },
    },
    async (input: ListTodosInput) => {
      const { spreadsheetId, sheets } = await requireSpreadsheetContext(env);

      const rows = await getRows(sheets, spreadsheetId, TODOS_SHEET_NAME);
      let todos = rows.map((r) => rowToTodo(r));

      // Status filter (default: open)
      const status = input.status ?? 'open';
      if (status !== 'all') {
        todos = todos.filter((t) => t.status === status);
      }

      // Hive filter
      if (input.hive) {
        const includeApiary = input.include_apiary ?? true;
        todos = todos.filter(
          (t) => t.hive === input.hive || (includeApiary && t.hive === ''),
        );
      }

      // Priority filter
      if (input.priority) {
        todos = todos.filter((t) => t.priority === input.priority);
      }

      return toolResponse({ todos, count: todos.length });
    },
  );

  server.registerTool(
    'apiary_complete_todo',
    {
      description:
        'Mark a todo as done by its todo_id. The todo_id is a ULID returned by apiary_add_todo and shown in apiary_list_todos results. If todo_id is not in context, call apiary_list_todos first.',
      inputSchema: CompleteTodoSchema.shape,
      annotations: { idempotentHint: true },
    },
    async (input: CompleteTodoInput) => {
      const { spreadsheetId, sheets } = await requireSpreadsheetContext(env);

      const rows = await getRows(sheets, spreadsheetId, TODOS_SHEET_NAME);
      const rowIndex = findTodoRowIndexByTodoId(rows, input.todo_id);

      if (rowIndex === null) {
        throw new Error(`Todo with todo_id "${input.todo_id}" not found.`);
      }

      const existing = rows[rowIndex - 2] ?? [];
      const now = new Date().toISOString();
      const updatedRow = [
        existing[TODO_COL.todo_id] ?? input.todo_id,
        existing[TODO_COL.hive] ?? '',
        existing[TODO_COL.todo] ?? '',
        existing[TODO_COL.priority] ?? '',
        'done',
        existing[TODO_COL.due_date] ?? '',
        input.notes ?? existing[TODO_COL.notes] ?? '',
        existing[TODO_COL.created_at] ?? '',
        now,
      ];

      await updateRow(sheets, spreadsheetId, TODOS_SHEET_NAME, rowIndex, updatedRow);

      return toolResponse({
        todo_id: input.todo_id,
        status: 'done',
        updated_at: now,
      });
    },
  );
}

