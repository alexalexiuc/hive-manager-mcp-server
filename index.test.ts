import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMcpServer } from './src/server.js';

vi.mock('@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js', () => ({
  WebStandardStreamableHTTPServerTransport: vi.fn().mockImplementation(() => ({
    handleRequest: vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 })),
  })),
}));

vi.mock('./src/server.js', () => ({
  createMcpServer: vi.fn().mockReturnValue({
    connect: vi.fn().mockResolvedValue(undefined),
  }),
}));

type WorkerModule = typeof import('./src/index.js');

async function loadWorker(): Promise<WorkerModule['default']> {
  const mod = (await import('./src/index.js')) as WorkerModule;
  return mod.default;
}

function makeEnv(overrides: Record<string, string> = {}) {
  return {
    GOOGLE_SERVICE_ACCOUNT_JSON: '{"type":"service_account"}',
    AUTH_API_KEY: 'test-api-key',
    ...overrides,
  };
}

function makeRequest(path: string, method = 'GET', headers: Record<string, string> = {}): Request {
  return new Request(`https://example.com${path}`, { method, headers });
}

describe('HTTP routes', () => {
  let worker: WorkerModule['default'];

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    worker = await loadWorker();
  });

  it('returns health response without auth header', async () => {
    const env = makeEnv();
    const req = makeRequest('/health');
    const res = await worker.fetch(req, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('ok');
  });

  it('rejects /mcp request without auth header', async () => {
    const env = makeEnv();
    const req = makeRequest('/mcp', 'POST');
    const res = await worker.fetch(req, env);

    expect(res.status).toBe(401);
  });

  it('accepts /mcp request with auth header', async () => {
    const env = makeEnv();
    const req = makeRequest('/mcp', 'POST', {
      Authorization: `Bearer ${env.AUTH_API_KEY}`,
      'x-spreadsheet-id': 'sheet-123',
    });
    const res = await worker.fetch(req, env);

    expect(res.status).toBe(200);
    expect(createMcpServer).toHaveBeenCalledWith(
      expect.objectContaining({
        REQUEST_SPREADSHEET_ID: 'sheet-123',
      }),
    );
  });

  it('returns 404 for authorized unknown routes', async () => {
    const env = makeEnv();
    const req = makeRequest('/some-other-path', 'GET', {
      Authorization: `Bearer ${env.AUTH_API_KEY}`,
    });
    const res = await worker.fetch(req, env);

    expect(res.status).toBe(404);
  });
});
