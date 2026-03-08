import { describe, it, expect, vi, beforeEach } from 'vitest';

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

  it('accepts /mcp request without auth header', async () => {
    const env = makeEnv();
    const req = makeRequest('/mcp', 'POST');
    const res = await worker.fetch(req, env);

    expect(res.status).toBe(200);
  });

  it('returns 404 for unknown routes', async () => {
    const env = makeEnv();
    const req = makeRequest('/some-other-path');
    const res = await worker.fetch(req, env);

    expect(res.status).toBe(404);
  });
});
