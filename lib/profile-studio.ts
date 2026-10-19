import "server-only";

export function profileStudioStatus() {
  const missing: string[] = [];
  if (!process.env.REACT_APP_GROK_API_KEY && !process.env.XAI_API_KEY) missing.push("a server-side xAI key (XAI_API_KEY)");
  if (!process.env.BLOB_READ_WRITE_TOKEN && !(process.env.BLOB_STORE_ID && process.env.BLOB_WEBHOOK_PUBLIC_KEY)) missing.push("Vercel Blob storage");
  return { enabled: missing.length === 0, missing };
}
