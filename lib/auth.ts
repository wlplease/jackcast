// Single-user password gate. Versioned, short-lived HMAC sessions let a password
// rotation revoke every device and limit how long a stolen cookie can be replayed.

export const SESSION_COOKIE = "selfcaster_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function bufferSource(value: string): ArrayBuffer {
  return new TextEncoder().encode(value).buffer as ArrayBuffer;
}

async function sessionKey(password: string, usages: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    bufferSource(`selfcaster:session:v3:${password}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages
  );
}

export async function createSessionToken(): Promise<string | null> {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return null;
  const issuedAt = Math.floor(Date.now() / 1000);
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const payload = `session|${issuedAt}|${nonce}`;
  const signature = await crypto.subtle.sign("HMAC", await sessionKey(pw, ["sign"]), bufferSource(payload));
  return `v3.${issuedAt}.${nonce}.${Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

export async function isValidSessionToken(token: string | undefined): Promise<boolean> {
  const pw = process.env.APP_PASSWORD;
  if (!pw || !token) return false;
  const match = /^v3\.(\d{10})\.([0-9a-f]{32})\.([0-9a-f]{64})$/i.exec(token);
  if (!match) return false;
  const issuedAt = Number(match[1]);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(issuedAt) || issuedAt > now + 60 || now - issuedAt > SESSION_MAX_AGE_SECONDS) return false;
  const signature = new Uint8Array(match[3].match(/.{2}/g)!.map((byte) => Number.parseInt(byte, 16)));
  return crypto.subtle.verify(
    "HMAC",
    await sessionKey(pw, ["verify"]),
    signature,
    bufferSource(`session|${issuedAt}|${match[2]}`)
  );
}
