const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ENCODING_LEN = ENCODING.length; // 32

function encodeTime(now: number, len: number): string {
  let str = '';
  let t = now;
  for (let i = len - 1; i >= 0; i--) {
    str = ENCODING.charAt(t % ENCODING_LEN) + str;
    t = Math.floor(t / ENCODING_LEN);
  }
  return str;
}

function encodeRandom(len: number): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let str = '';
  for (let i = 0; i < len; i++) {
    str += ENCODING.charAt(bytes[i] % ENCODING_LEN);
  }
  return str;
}

export function generateUlid(): string {
  return encodeTime(Date.now(), 10) + encodeRandom(16);
}
