import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerCaloriesSetupTool } from './tools/setup.js';
import { registerProfileTools } from './tools/profile.js';
import { registerMealTools } from './tools/meals.js';
import { registerSummaryTools } from './tools/summary.js';
import type { Env } from '../types.js';

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
