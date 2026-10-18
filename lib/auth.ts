// Single-user password gate. The cookie holds a hash of APP_PASSWORD, so
// changing the password logs out every device. Works in edge middleware and Node.

export const SESSION_COOKIE = "selfcaster_session";

export async function sessionToken(): Promise<string | null> {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return null;
  const data = new TextEncoder().encode(`selfcaster:v1:${pw}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
