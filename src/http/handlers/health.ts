import type { RequestContext } from '../types';

const VERSION = '1.0.0';

export async function handleHealthRequest(
  _context: RequestContext
): Promise<Response> {
  return new Response(
    JSON.stringify({
      status: 'ok',
      server: 'hive-manager-mcp-server',
      version: VERSION,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
