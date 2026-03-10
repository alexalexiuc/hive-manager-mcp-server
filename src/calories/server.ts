import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerCaloriesSetupTool } from './tools/setup';
import { registerProfileTools } from './tools/profile';
import { registerMealTools } from './tools/meals';
import { registerSummaryTools } from './tools/summary';
import { Env } from '../types';

export function createCaloriesServer(env: Env): McpServer {
  const server = new McpServer({
    name: 'calories-tracker-mcp-server',
    version: '1.0.0',
  });

  registerCaloriesSetupTool(server, env);
  registerProfileTools(server, env);
  registerMealTools(server, env);
  registerSummaryTools(server, env);

  return server;
}
