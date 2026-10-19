import { FeedComposer } from "@/components/FeedComposer";
import { Feed } from "@/components/Feed";
import { SetupBanner } from "@/components/SetupBanner";
import { followingFeed } from "@/lib/data";
import { getViewer } from "@/lib/viewer";
import { FeedWelcome } from "@/components/FeedWelcome";
import { LandingWalkthrough } from "@/components/LandingWalkthrough";
import Link from "next/link";

export default async function Home({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const { cursor } = await searchParams;
  const viewer = await getViewer();
  if (!viewer) {
    return (
      <section className="first-use" aria-labelledby="first-use-title">
        <div className="first-use-copy">
          <span className="login-eyebrow">YOUR PRIVATE FARCASTER CLIENT</span>
          <h1 id="first-use-title">Welcome to your Jackcaster.</h1>
          <p>Your app password is accepted. Connect your Farcaster account when you’re ready to load your personal feed and enable posting. Setup is optional until then.</p>
          <Link className="btn" href="/setup">Continue to account setup <span aria-hidden="true">↗</span></Link>
          <small>Setup currently asks for the Farcaster account custody-wallet recovery phrase to authorize a posting signer. Read the warning on the next screen before continuing. If you don’t want to enter it, you can leave this page.</small>
        </div>
        <LandingWalkthrough />
      </section>
    );
  }
  try {
    const page = await followingFeed(cursor);
    const canWrite = viewer.canWrite;
    return (
      <>
        {!canWrite && (
          <div className="banner">
            Read-only mode. <a href="/setup" style={{ color: "var(--accent)", fontWeight: 500 }}>Connect your account</a> to cast, like and reply.
          </div>
        )}
        {canWrite && <FeedWelcome />}
        <FeedComposer canWrite={canWrite} cursor={cursor} />
        <Feed page={page} basePath="/" canWrite={canWrite} viewerFid={viewer.fid} live={cursor ? undefined : "following"} emptyTitle="Your feed is empty" emptyBody="Follow some people and they'll show up here, newest first." />
      </>
    );
  } catch (e) {
    return <SetupBanner error={e} />;
  }
}
