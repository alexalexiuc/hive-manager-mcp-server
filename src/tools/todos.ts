import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getRows, appendRow } from '../services/sheets.js';
import { requirePreparedSpreadsheetId } from '../services/spreadsheet.js';
import { APIARY_TODOS_SHEET_NAME, TODO_COL } from '../constants.js';
import { yyyyMmDdDateSchema } from '../shared/validation.js';
import { toolResponse } from './toolResponse.js';
import type { Env } from '../types.js';

const AddTodoSchema = z.object({
  todo: z.string().describe('Task description'),
  priority: z.enum(['low', 'medium', 'high']).optional().describe('Task priority'),
  status: z.enum(['open', 'done']).optional().default('open').describe('Task status'),
  due_date: yyyyMmDdDateSchema
    .optional()
    .describe('Optional due date (YYYY-MM-DD)'),
  notes: z.string().optional().describe('Additional notes'),
});

type AddTodoInput = z.infer<typeof AddTodoSchema>;

export function registerTodoTools(server: McpServer, env: Env) {
  server.registerTool(
    'hive_get_todos',
    {
      description: 'Read all general apiary todos from the apiary_todos sheet.',
    },
    async () => {
      const { spreadsheetId, sheets } = await requirePreparedSpreadsheetId(env);

      const rows = await getRows(sheets, spreadsheetId, APIARY_TODOS_SHEET_NAME);

      const todos = rows.map((row) => ({
        todo: row[TODO_COL.todo] ?? '',
        priority: row[TODO_COL.priority] ?? '',
        status: row[TODO_COL.status] ?? '',
        due_date: row[TODO_COL.due_date] ?? '',
        notes: row[TODO_COL.notes] ?? '',
        created_at: row[TODO_COL.created_at] ?? '',
        updated_at: row[TODO_COL.updated_at] ?? '',
      }));

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
      const { spreadsheetId, sheets } = await requirePreparedSpreadsheetId(env);

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
}
