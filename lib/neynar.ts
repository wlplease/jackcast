import "server-only";
import { NeynarAPIClient, Configuration } from "@neynar/nodejs-sdk";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}. See .env.example.`);
  return v;
}

let _client: NeynarAPIClient | null = null;

export function neynar(): NeynarAPIClient {
  if (!_client) {
    const customBase = process.env.NEYNAR_API_BASE;
    // The SDK sends the API key to its configured base URL. Keep mock endpoints
    // available for local development, but never allow a production deployment
    // to redirect authenticated requests to an arbitrary host.
    if (customBase && process.env.NODE_ENV === "production") {
      throw new Error("NEYNAR_API_BASE is only supported outside production.");
    }
    _client = new NeynarAPIClient(new Configuration({
        apiKey: env("NEYNAR_API_KEY"),
        // Only for local testing against a mock server. Leave unset in production.
        ...(customBase ? { basePath: customBase } : {}),
      }));
  }
  return _client;
}

export const config = {
  /** Channels pinned in the nav, e.g. "dev,base,music" */
  get pinnedChannels(): string[] {
    return (process.env.PINNED_CHANNELS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  },
};
