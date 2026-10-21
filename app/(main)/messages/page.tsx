import Link from "next/link";
import { DmInbox } from "@/components/DmInbox";
import { getViewer } from "@/lib/viewer";
import { getPrefs } from "@/lib/prefs";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const [viewer, prefs] = await Promise.all([getViewer(), getPrefs()]);
  if (prefs.disabledServices.includes("dms")) return <section className="dm-card"><h1>Direct messages are off</h1><p>Turn them back on in <Link href="/me#privacy">Settings → Privacy choices</Link> whenever you&apos;re ready.</p></section>;
  if (!viewer) return <section className="dm-card"><h1>Set up your Farcaster account first</h1><p>Finish the existing Jackcast setup to approve your Farcaster signer. Messages reuse that signer; DMs do not ask you to connect a wallet or enter your Farcaster recovery seed again.</p><Link className="btn primary" href="/setup">Open setup</Link></section>;
  return <DmInbox viewerFid={viewer.fid} />;
}
