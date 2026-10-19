import { getViewer } from "@/lib/viewer";
import { neynar } from "@/lib/neynar";
import { SetupFlow } from "./SetupFlow";
import { Wordmark } from "@/components/Wordmark";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const viewer = await getViewer();
  let username: string | undefined;
  if (viewer?.canWrite) {
    try {
      const { users } = await neynar().fetchBulkUsers({ fids: [viewer.fid] });
      username = users[0]?.username;
    } catch {}
  }

  return (
    <main className="setup">
      <div className="wordmark">
        <Wordmark />
      </div>
      <SetupFlow
        connected={
          viewer?.source === "setup" && viewer.signerUuid
            ? { fid: viewer.fid, signerUuid: viewer.signerUuid, username, source: viewer.source }
            : null
        }
        hasApiKey={Boolean(process.env.NEYNAR_API_KEY)}
      />
    </main>
  );
}
