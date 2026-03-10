import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signToken } from './src/http/token';

vi.mock(
  '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js',
  () => ({
    WebStandardStreamableHTTPServerTransport: vi
      .fn()
      .mockImplementation(() => ({
        handleRequest: vi
          .fn()
          .mockResolvedValue(new Response('{"ok":true}', { status: 200 })),
      })),
  })
);

vi.mock('./src/hiveManager/server.js', () => ({
  createMcpServer: vi.fn().mockReturnValue({
    connect: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('./src/calories/server.js', () => ({
  createCaloriesServer: vi.fn().mockReturnValue({
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
    OAUTH_CLIENT_ID: 'test-client-id',
    OAUTH_CLIENT_SECRET: 'test-client-secret',
    ...overrides,
  };
}

async function makeAccessToken(env: {
  OAUTH_CLIENT_ID: string;
  OAUTH_CLIENT_SECRET: string;
}): Promise<string> {
  return signToken(
    { client_id: env.OAUTH_CLIENT_ID, exp: Date.now() + 3_600_000 },
    env.OAUTH_CLIENT_SECRET
  );
}

function makeRequest(
  path: string,
  method = 'GET',
  headers: Record<string, string> = {}
): Request {
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

  it('rejects /apiary/:id request without auth header', async () => {
    const env = makeEnv();
    const req = makeRequest('/apiary/sheet-123', 'POST');
    const res = await worker.fetch(req, env);

    expect(res.status).toBe(401);
  });

  it('accepts /apiary/:id request with valid OAuth token', async () => {
    const env = makeEnv();
    const accessToken = await makeAccessToken(env);
    const req = makeRequest('/apiary/sheet-123', 'POST', {
      Authorization: `Bearer ${accessToken}`,
    });
    const res = await worker.fetch(req, env);

    expect(res.status).toBe(200);
  });

  it('rejects /apiary/:id request with invalid OAuth token', async () => {
    const env = makeEnv();
    const req = makeRequest('/apiary/sheet-123', 'POST', {
      Authorization: 'Bearer invalid-token',
    });
    const res = await worker.fetch(req, env);

    expect(res.status).toBe(401);
  });

  it('rejects /calories/:id request without auth header', async () => {
    const env = makeEnv();
    const req = makeRequest('/calories/sheet-123', 'POST');
    const res = await worker.fetch(req, env);

    expect(res.status).toBe(401);
  });

  it('accepts /calories/:id request with valid OAuth token', async () => {
    const env = makeEnv();
    const accessToken = await makeAccessToken(env);
    const req = makeRequest('/calories/sheet-123', 'POST', {
      Authorization: `Bearer ${accessToken}`,
    });
    const res = await worker.fetch(req, env);

    expect(res.status).toBe(200);
  });

  it('returns 404 for unknown routes when authenticated', async () => {
    const env = makeEnv();
    const accessToken = await makeAccessToken(env);
    const req = makeRequest('/some-other-path', 'GET', {
      Authorization: `Bearer ${accessToken}`,
    });
    const res = await worker.fetch(req, env);

    expect(res.status).toBe(404);
  });
});
