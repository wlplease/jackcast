import { NetworkMap } from "@/components/NetworkMap";
import { getMe } from "@/lib/data";
import { requireViewer } from "@/lib/viewer";
import { getPrefs } from "@/lib/prefs";

export default async function NetworkMapPage() {
  const [viewer, me, prefs] = await Promise.all([requireViewer(), getMe().catch(() => null), getPrefs()]);
  return <NetworkMap fid={viewer.fid} username={me?.username ?? `fid-${viewer.fid}`} displayName={me?.display_name ?? "Farcaster user"} pfpUrl={me?.pfp_url ?? ""} sharingEnabled={!prefs.disabledServices.includes("map")} />;
}
