import { signToken, verifyToken } from '../token.js';
import type { RequestContext } from '../types.js';

// ---- OAuth metadata ----

export async function handleOAuthMetadata(context: RequestContext): Promise<Response> {
  const { url } = context;
  const base = `${url.protocol}//${url.host}`;
  return new Response(
    JSON.stringify({
      issuer: base,
      authorization_endpoint: `${base}/oauth/authorize`,
      token_endpoint: `${base}/oauth/token`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['client_secret_post'],
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

// ---- Authorization endpoint (GET — show consent page) ----

function renderConsentPage(params: URLSearchParams): string {
  const clientId = escapeHtml(params.get('client_id') ?? '');
  const hiddenFields = [...params.entries()]
    .map(
      ([k, v]) =>
        `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}">`
    )
    .join('\n    ');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Authorize — Hive Manager</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 480px; margin: 80px auto; padding: 0 16px; }
    h1 { font-size: 1.4rem; }
    .actions { display: flex; gap: 12px; margin-top: 24px; }
    button { padding: 10px 20px; border-radius: 6px; border: none; cursor: pointer; font-size: 1rem; }
    button[value="allow"] { background: #2563eb; color: #fff; }
    button[value="deny"]  { background: #e5e7eb; color: #111; }
  </style>
</head>
<body>
  <h1>Authorize Hive Manager MCP Server</h1>
  <p>The application <strong>${clientId}</strong> is requesting access to your hive data.</p>
  <form method="POST" action="/oauth/authorize">
    ${hiddenFields}
    <div class="actions">
      <button type="submit" name="action" value="allow">Allow</button>
      <button type="submit" name="action" value="deny">Deny</button>
    </div>
  </form>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Validate redirect_uri: must be a parseable URL and either https (any host)
 * or http restricted to localhost / 127.0.0.1.
 * Returns the parsed URL on success or null on failure.
 */
function validateRedirectUri(redirectUri: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(redirectUri);
  } catch {
    return null;
  }
  if (parsed.protocol === 'https:') return parsed;
  if (
    parsed.protocol === 'http:' &&
    (parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '[::1]')
  ) {
    return parsed;
  }
  return null;
}

export async function handleOAuthAuthorizeGet(context: RequestContext): Promise<Response> {
  const { url, env } = context;
  const params = url.searchParams;

  if (params.get('client_id') !== env.OAUTH_CLIENT_ID) {
    return new Response('Invalid client_id', { status: 400 });
  }
  if (params.get('response_type') !== 'code') {
    return new Response('Only response_type=code is supported', { status: 400 });
  }
  const rawRedirectUri = params.get('redirect_uri');
  if (!rawRedirectUri) {
    return new Response('Missing redirect_uri', { status: 400 });
  }
  if (!validateRedirectUri(rawRedirectUri)) {
    return new Response('Invalid redirect_uri', { status: 400 });
  }

  return new Response(renderConsentPage(params), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

// ---- Authorization endpoint (POST — process consent) ----

interface AuthCodePayload {
  client_id: string;
  redirect_uri: string;
  code_challenge: string | null;
  code_challenge_method: string | null;
  exp: number;
}

export async function handleOAuthAuthorizePost(context: RequestContext): Promise<Response> {
  const { request, env } = context;
  const body = await request.formData();
  const redirectUri = body.get('redirect_uri') as string | null;
  const state = body.get('state') as string | null;

  if (!redirectUri) {
    return new Response('Missing redirect_uri', { status: 400 });
  }
  const parsedRedirectUri = validateRedirectUri(redirectUri);
  if (!parsedRedirectUri) {
    return new Response('Invalid redirect_uri', { status: 400 });
  }

  if (body.get('action') !== 'allow') {
    parsedRedirectUri.searchParams.set('error', 'access_denied');
    if (state) parsedRedirectUri.searchParams.set('state', state);
    return Response.redirect(parsedRedirectUri.toString(), 302);
  }

  const clientId = body.get('client_id') as string | null;
  if (clientId !== env.OAUTH_CLIENT_ID) {
    return new Response('Invalid client_id', { status: 400 });
  }

  const code = await signToken(
    {
      client_id: clientId,
      redirect_uri: redirectUri,
      code_challenge: body.get('code_challenge') as string | null,
      code_challenge_method: body.get('code_challenge_method') as string | null,
      exp: Date.now() + 5 * 60 * 1000,
    } satisfies AuthCodePayload,
    env.OAUTH_CLIENT_SECRET
  );

  parsedRedirectUri.searchParams.set('code', code);
  if (state) parsedRedirectUri.searchParams.set('state', state);
  return Response.redirect(parsedRedirectUri.toString(), 302);
}

// ---- Token endpoint ----

async function verifyPkce(
  codeVerifier: string,
  codeChallenge: string,
  method: string
): Promise<boolean> {
  if (method === 'S256') {
    const hash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(codeVerifier)
    );
    const encoded = btoa(String.fromCharCode(...new Uint8Array(hash)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    return encoded === codeChallenge;
  }
  if (method === 'plain') {
    return codeVerifier === codeChallenge;
  }
  return false;
}

function tokenError(error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handleOAuthToken(context: RequestContext): Promise<Response> {
  const { request, env } = context;
  const body = await request.formData();

  if (body.get('grant_type') !== 'authorization_code') {
    return tokenError('unsupported_grant_type');
  }

  const clientId = body.get('client_id') as string | null;
  const clientSecret = body.get('client_secret') as string | null;
  if (clientId !== env.OAUTH_CLIENT_ID || clientSecret !== env.OAUTH_CLIENT_SECRET) {
    return tokenError('invalid_client');
  }

  const code = body.get('code') as string | null;
  if (!code) return tokenError('invalid_request');

  const payload = await verifyToken<AuthCodePayload>(code, env.OAUTH_CLIENT_SECRET);
  if (!payload) return tokenError('invalid_grant');

  const redirectUri = body.get('redirect_uri') as string | null;
  if (payload.client_id !== clientId || payload.redirect_uri !== redirectUri) {
    return tokenError('invalid_grant');
  }

  if (payload.code_challenge) {
    const codeVerifier = body.get('code_verifier') as string | null;
    if (!codeVerifier) return tokenError('invalid_grant');
    const ok = await verifyPkce(
      codeVerifier,
      payload.code_challenge,
      payload.code_challenge_method ?? 'plain'
    );
    if (!ok) return tokenError('invalid_grant');
  }

  const expiresIn = 3600;
  const accessToken = await signToken(
    { client_id: clientId, exp: Date.now() + expiresIn * 1000 },
    env.OAUTH_CLIENT_SECRET
  );

  return new Response(
    JSON.stringify({ access_token: accessToken, token_type: 'bearer', expires_in: expiresIn }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}
