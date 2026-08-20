const encoder = new TextEncoder();

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export async function derivePasswordHash(password: string, saltBase64: string, iterations: number) {
  const safeIterations = iterations || 100_000;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: fromBase64(saltBase64), iterations: safeIterations },
    key,
    256,
  );
  return toBase64(new Uint8Array(bits));
}

export async function createPasswordRecord(password: string, iterations = 100_000) {
  const safeIterations = iterations;
  const salt = toBase64(randomBytes(16));
  return { hash: await derivePasswordHash(password, salt, safeIterations), salt, iterations: safeIterations };
}

export async function verifyPassword(password: string, expectedHash: string, salt: string, iterations: number) {
  const actual = fromBase64(await derivePasswordHash(password, salt, iterations));
  const expected = fromBase64(expectedHash);
  if (actual.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < actual.length; index += 1) mismatch |= actual[index] ^ expected[index];
  return mismatch === 0;
}

export function createSessionToken() {
  return toBase64(randomBytes(32)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export async function hashSessionToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return toBase64(new Uint8Array(digest));
}
