import { NetworkMap } from "@/components/NetworkMap";
import { getMe } from "@/lib/data";
import { requireViewer } from "@/lib/viewer";

export default async function NetworkMapPage() {
  const viewer = await requireViewer();
  const me = await getMe().catch(() => null);
  return <NetworkMap fid={viewer.fid} username={me?.username ?? `fid-${viewer.fid}`} displayName={me?.display_name ?? "Farcaster user"} pfpUrl={me?.pfp_url ?? ""} />;
}
