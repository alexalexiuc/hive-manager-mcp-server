import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerSetupTool } from './tools/setup.js';
import { registerHiveTools } from './tools/hives.js';
import { registerLogTools } from './tools/logs.js';
import { registerHarvestTools } from './tools/harvests.js';
import { registerTodoTools } from './tools/todos.js';
import { registerRelocationTools } from './tools/relocations.js';
import type { Env } from './types.js';

export function createMcpServer(env: Env): McpServer {
  const server = new McpServer({
    name: 'hive-manager-mcp-server',
    version: '1.0.0',
  });

  registerSetupTool(server, env);
  registerHiveTools(server, env);
  registerLogTools(server, env);
  registerHarvestTools(server, env);
  registerTodoTools(server, env);
  registerRelocationTools(server, env);

  return server;
}
