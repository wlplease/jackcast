import Link from "next/link";
import { DmInbox } from "@/components/DmInbox";
import { getViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const viewer = await getViewer();
  if (!viewer) return <section className="dm-card"><h1>Set up your Farcaster account first</h1><p>Finish the existing Jackcast setup to approve your Farcaster signer. Messages reuse that signer; DMs do not ask you to connect a wallet or enter your Farcaster recovery seed again.</p><Link className="btn primary" href="/setup">Open setup</Link></section>;
  return <DmInbox viewerFid={viewer.fid} />;
}
