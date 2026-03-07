import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createDriveClient } from '../services/google.js';
import { readFile, writeFile, findFile } from '../services/drive.js';
import { TODOS_FILENAME } from '../constants.js';
import type { Env } from '../types.js';

const UpdateTodosSchema = z.object({
  content: z.string().describe('The full new content for the todos_general.txt file'),
});

type UpdateTodosInput = z.infer<typeof UpdateTodosSchema>;

export function registerTodoTools(server: McpServer, env: Env) {
  server.tool(
    'hive_get_todos',
    'Read the general apiary todos file (todos_general.txt) from the Hives/ folder in Google Drive.',
    {},
    async () => {
      const drive = createDriveClient(env.GOOGLE_SERVICE_ACCOUNT_JSON);

      const hivesFolderId = env.HIVES_FOLDER_ID;
      if (!hivesFolderId) {
        throw new Error('HIVES_FOLDER_ID is not set. Run hive_setup first.');
      }

      const fileId = await findFile(drive, TODOS_FILENAME, hivesFolderId);
      if (!fileId) {
        throw new Error('todos_general.txt not found. Run hive_setup first.');
      }

      const content = await readFile(drive, fileId);

      return {
        content: [
          {
            type: 'text' as const,
            text: content,
          },
        ],
      };
    }
  );

  server.tool(
    'hive_update_todos',
    'Overwrite the general apiary todos file (todos_general.txt) with new content.',
    UpdateTodosSchema.shape,
    async (input: UpdateTodosInput) => {
      const drive = createDriveClient(env.GOOGLE_SERVICE_ACCOUNT_JSON);

      const hivesFolderId = env.HIVES_FOLDER_ID;
      if (!hivesFolderId) {
        throw new Error('HIVES_FOLDER_ID is not set. Run hive_setup first.');
      }

      const fileId = await findFile(drive, TODOS_FILENAME, hivesFolderId);
      if (!fileId) {
        throw new Error('todos_general.txt not found. Run hive_setup first.');
      }

      await writeFile(drive, fileId, input.content);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              message: 'todos_general.txt updated successfully.',
            }),
          },
        ],
      };
    }
  );
}
