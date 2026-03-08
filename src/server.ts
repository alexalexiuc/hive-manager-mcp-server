import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerSetupTool } from './tools/setup.js';
import { registerLogTool } from './tools/log.js';
import { registerProfileTools } from './tools/profile.js';
import { registerHistoryTool } from './tools/history.js';
import { registerTodoTools } from './tools/todos.js';
import { registerRelocationTools } from './tools/relocations.js';
import { registerWorkflowTools } from './tools/workflow.js';
import type { Env } from './types.js';

export function createMcpServer(env: Env): McpServer {
  const server = new McpServer({
    name: 'hive-manager-mcp-server',
    version: '1.0.0',
  });

  registerSetupTool(server, env);
  registerLogTool(server, env);
  registerProfileTools(server, env);
  registerHistoryTool(server, env);
  registerTodoTools(server, env);
  registerRelocationTools(server, env);
  registerWorkflowTools(server, env);

  return server;
}
