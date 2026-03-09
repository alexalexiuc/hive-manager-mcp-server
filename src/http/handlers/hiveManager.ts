import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createMcpServer } from '../../hiveManager/server';
import type { RequestContext } from '../types';

export async function handleHiveManagerRequest(
  context: RequestContext
): Promise<Response> {
  const { request, env, params } = context;
  const requestScopedEnv = {
    ...env,
    REQUEST_SPREADSHEET_ID: params.spreadsheetId,
  };
  const server = createMcpServer(requestScopedEnv);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    try {
      await server.close();
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.warn(`Failed to close MCP server cleanly: ${error.message}`);
      } else {
        console.warn('Failed to close MCP server cleanly.', error);
      }
    }
  }
}
