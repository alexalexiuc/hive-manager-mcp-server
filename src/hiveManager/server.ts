import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerSetupTool } from './tools/setup';
import { registerHiveTools } from './tools/hives';
import { registerLogTools } from './tools/logs';
import { registerHarvestTools } from './tools/harvests';
import { registerTodoTools } from './tools/todos';
import { registerRelocationTools } from './tools/relocations';
import { Env } from '../types';

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
