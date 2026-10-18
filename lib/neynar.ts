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
    _client = new NeynarAPIClient(new Configuration({
        apiKey: env("NEYNAR_API_KEY"),
        // Only for local testing against a mock server. Leave unset in production.
        ...(process.env.NEYNAR_API_BASE ? { basePath: process.env.NEYNAR_API_BASE } : {}),
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
