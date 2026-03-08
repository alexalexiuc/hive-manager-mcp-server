import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the MCP SDK transport and server before importing the module under test
vi.mock('@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js', () => ({
  WebStandardStreamableHTTPServerTransport: vi.fn().mockImplementation(() => ({
    handleRequest: vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 })),
  })),
}));

vi.mock('../src/server.js', () => ({
  createMcpServer: vi.fn().mockReturnValue({
    connect: vi.fn().mockResolvedValue(undefined),
  }),
}));

// Dynamically import the worker default export after mocks are in place
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type WorkerModule = typeof import('../src/index.js');

async function loadWorker(): Promise<WorkerModule['default']> {
  const mod = await import('../src/index.js') as WorkerModule;
  return mod.default;
}

function makeEnv(overrides: Record<string, string> = {}) {
  return {
    GOOGLE_SERVICE_ACCOUNT_JSON: '{"type":"service_account"}',
    AUTH_API_KEY: 'test-secret-key',
    ...overrides,
  };
}

function makeRequest(path: string, method = 'GET', headers: Record<string, string> = {}): Request {
  return new Request(`https://example.com${path}`, { method, headers });
}

describe('Authorization middleware', () => {
  let worker: WorkerModule['default'];

  beforeEach(async () => {
    vi.resetModules();
    worker = await loadWorker();
  });

  it('returns 401 when Authorization header is missing', async () => {
    const env = makeEnv();
    const req = makeRequest('/health');
    const res = await worker.fetch(req, env);

    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body).toEqual({ error: 'Unauthorized' });
  });

  it('returns 401 when Bearer token is wrong', async () => {
    const env = makeEnv();
    const req = makeRequest('/health', 'GET', { Authorization: 'Bearer wrong-key' });
    const res = await worker.fetch(req, env);

    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body).toEqual({ error: 'Unauthorized' });
  });

  it('returns 401 when auth scheme is not Bearer', async () => {
    const env = makeEnv();
    const req = makeRequest('/health', 'GET', { Authorization: 'Basic test-secret-key' });
    const res = await worker.fetch(req, env);

    expect(res.status).toBe(401);
  });

  it('returns 401 when AUTH_API_KEY is an empty string', async () => {
    const env = makeEnv({ AUTH_API_KEY: '' });
    const req = makeRequest('/health', 'GET', { Authorization: 'Bearer test-secret-key' });
    const res = await worker.fetch(req, env);

    expect(res.status).toBe(401);
  });

  it('returns 401 when AUTH_API_KEY is undefined (not configured)', async () => {
    const { AUTH_API_KEY: _removed, ...envWithoutKey } = makeEnv();
    const req = makeRequest('/health', 'GET', { Authorization: 'Bearer test-secret-key' });
    const res = await worker.fetch(req, envWithoutKey as ReturnType<typeof makeEnv>);

    expect(res.status).toBe(401);
  });

  it('passes through to /health when valid Bearer token provided', async () => {
    const env = makeEnv();
    const req = makeRequest('/health', 'GET', { Authorization: 'Bearer test-secret-key' });
    const res = await worker.fetch(req, env);

    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe('ok');
  });

  it('passes through to /mcp when valid Bearer token provided', async () => {
    const env = makeEnv();
    const req = makeRequest('/mcp', 'POST', { Authorization: 'Bearer test-secret-key' });
    const res = await worker.fetch(req, env);

    expect(res.status).toBe(200);
  });

  it('returns 401 for /mcp without token', async () => {
    const env = makeEnv();
    const req = makeRequest('/mcp', 'POST');
    const res = await worker.fetch(req, env);

    expect(res.status).toBe(401);
  });

  it('returns 401 for unknown routes without token', async () => {
    const env = makeEnv();
    const req = makeRequest('/some-other-path');
    const res = await worker.fetch(req, env);

    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown routes with valid token', async () => {
    const env = makeEnv();
    const req = makeRequest('/some-other-path', 'GET', { Authorization: 'Bearer test-secret-key' });
    const res = await worker.fetch(req, env);

    expect(res.status).toBe(404);
  });

  it('response body does not leak implementation details on 401', async () => {
    const env = makeEnv();
    const req = makeRequest('/health', 'GET', { Authorization: 'Bearer bad-key' });
    const res = await worker.fetch(req, env);

    const body = await res.text();
    expect(body).not.toContain('AUTH_API_KEY');
    expect(body).not.toContain('stack');
    expect(JSON.parse(body)).toEqual({ error: 'Unauthorized' });
  });
});
