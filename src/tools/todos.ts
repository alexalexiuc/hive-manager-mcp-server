import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createSheetsClient } from '../services/google.js';
import { getRows, appendRow } from '../services/sheets.js';
import { requirePreparedSpreadsheetId } from '../services/spreadsheet.js';
import { APIARY_TODOS_SHEET_NAME } from '../constants.js';
import type { Env } from '../types.js';

const AddTodoSchema = z.object({
  todo: z.string().describe('Task description'),
  priority: z.enum(['low', 'medium', 'high']).optional().describe('Task priority'),
  status: z.enum(['open', 'done']).optional().default('open').describe('Task status'),
  due_date: z.string().optional().describe('Optional due date (YYYY-MM-DD)'),
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
      const spreadsheetId = await requirePreparedSpreadsheetId(env);
      const sheets = createSheetsClient(env.GOOGLE_SERVICE_ACCOUNT_JSON);

      const rows = await getRows(sheets, spreadsheetId, APIARY_TODOS_SHEET_NAME);

      const todos = rows.map((row) => ({
        todo: row[0] ?? '',
        priority: row[1] ?? '',
        status: row[2] ?? '',
        due_date: row[3] ?? '',
        notes: row[4] ?? '',
        created_at: row[5] ?? '',
        updated_at: row[6] ?? '',
      }));

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              count: todos.length,
              todos,
            }),
          },
        ],
      };
    }
  );

  server.registerTool(
    'hive_add_todo',
    {
      description: 'Add a new general apiary todo entry to the apiary_todos sheet.',
      inputSchema: AddTodoSchema.shape,
    },
    async (input: AddTodoInput) => {
      const spreadsheetId = await requirePreparedSpreadsheetId(env);
      const sheets = createSheetsClient(env.GOOGLE_SERVICE_ACCOUNT_JSON);

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

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              message: 'Todo added successfully.',
            }),
          },
        ],
      };
    }
  );
}
