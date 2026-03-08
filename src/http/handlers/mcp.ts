import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { SPREADSHEET_ID_HEADER } from '../../constants.js';
import { createMcpServer } from '../../server.js';
import type { Env } from '../../types.js';

function withRequestSpreadsheetId(env: Env, request: Request): Env {
  const spreadsheetId = request.headers.get(SPREADSHEET_ID_HEADER) ?? undefined;
  return {
    ...env,
    REQUEST_SPREADSHEET_ID: spreadsheetId,
  };
}

export async function handleMcpRequest(
  request: Request,
  env: Env
): Promise<Response> {
  const requestScopedEnv = withRequestSpreadsheetId(env, request);
  const server = createMcpServer(requestScopedEnv);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);
  return transport.handleRequest(request);
}
