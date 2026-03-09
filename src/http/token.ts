function base64urlEncode(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function getHmacKey(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signToken(
  payload: object,
  secret: string
): Promise<string> {
  const data = btoa(JSON.stringify(payload));
  const key = await getHmacKey(secret);
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(data)
  );
  return `${data}.${base64urlEncode(sig)}`;
}

export async function verifyToken<T extends { exp: number }>(
  token: string,
  secret: string
): Promise<T | null> {
  const dot = token.indexOf('.');
  if (dot === -1) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const key = await getHmacKey(secret);
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    base64urlDecode(sig),
    new TextEncoder().encode(data)
  );
  if (!valid) return null;

  try {
    const payload = JSON.parse(atob(data)) as T;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
