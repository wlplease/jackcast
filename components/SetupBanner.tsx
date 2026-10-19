import Link from "next/link";
import { RetryServiceButton } from "./RetryServiceButton";

function describeNeynarError(error: unknown) {
  const value = error && typeof error === "object" ? error as { message?: unknown; status?: unknown; response?: { status?: unknown } } : {};
  const message = typeof value.message === "string" ? value.message : "";
  const status = Number(value.status ?? value.response?.status ?? 0);

  if (/Missing env var NEYNAR_API_KEY/i.test(message)) {
    return { title: "Neynar isn’t configured", body: "Add NEYNAR_API_KEY to this deployment’s server environment, then redeploy." };
  }
  if (/No Farcaster account is configured/i.test(message)) {
    return { title: "Choose an account to browse", body: "This deployment needs a read-only Farcaster ID (MY_FID) or an account connected in Setup before it can load a feed." };
  }
  if (/Not connected|Visit \/setup/i.test(message)) {
    return { title: "Connect a Farcaster account", body: "Finish account setup before loading this data." };
  }
  if (status === 401 || status === 403) {
    return { title: "Neynar rejected this request", body: "Check the server API key, configured Farcaster ID, and Neynar access." };
  }
  if (status === 429) {
    return { title: "Neynar rate limit reached", body: "Wait a moment before retrying. Repeated refreshes may use more API credits." };
  }
  if (status >= 500 || /fetch failed|network|timed? ?out/i.test(message)) {
    return { title: "Neynar is temporarily unavailable", body: "Your account settings are unchanged. Try again in a little while." };
  }
  return { title: "Farcaster data could not load", body: "Check the Neynar connection and try again. Sensitive provider details are hidden." };
}

export function SetupBanner({ error }: { error: unknown }) {
  const status = describeNeynarError(error);
  return (
    <div className="banner service-banner" role="status">
      <div>
        <strong>{status.title}</strong>
        <p>{status.body}</p>
      </div>
      <div className="service-actions">
        <RetryServiceButton />
        <Link className="linkish" href="/setup">Account setup</Link>
      </div>
    </div>
  );
}
