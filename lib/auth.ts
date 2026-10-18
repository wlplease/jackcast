// Single-user password gate. The cookie holds a keyed HMAC of APP_PASSWORD,
// so changing the password logs out every device. Works in edge middleware and Node.

export const SESSION_COOKIE = "selfcaster_session";

function bufferSource(value: string): ArrayBuffer {
  return new TextEncoder().encode(value).buffer as ArrayBuffer;
}

export async function sessionToken(): Promise<string | null> {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    bufferSource(`selfcaster:session:v2:${pw}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, bufferSource("session"));
  return `v2.${Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}
