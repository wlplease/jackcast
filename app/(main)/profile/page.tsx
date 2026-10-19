import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { CastCard } from "@/components/CastCard";
import { PinnedCastForm } from "@/components/PinnedCastForm";
import { RichText } from "@/components/RichText";
import { SetupBanner } from "@/components/SetupBanner";
import { ProfileAnalytics } from "@/components/ProfileAnalytics";
import { ownProfileAnalytics } from "@/lib/data";
import { compact } from "@/lib/format";
import { getPrefs } from "@/lib/prefs";
import { requireViewer } from "@/lib/viewer";

export default async function MePage({ searchParams }: { searchParams: Promise<{ saved?: string; window?: string }> }) {
  const { saved } = await searchParams;
  const viewer = await requireViewer();

  try {
    const [profileData, prefs] = await Promise.all([
      ownProfileAnalytics(viewer.fid),
      getPrefs(),
    ]);
    const { user: me, casts } = profileData;

    return (
      <>
        <section className="profile me-head">
          {me.profile?.banner?.url
            ? <img className="profile-cover-image" src={me.profile.banner.url} alt="" />
            : <div className="profile-cover" aria-hidden="true" />}
          <div className="me-top">
            <Avatar user={me} />
            {viewer.canWrite && (
              <Link href="/me/edit" className="btn ghost sm">
                Edit profile
              </Link>
            )}
          </div>
          <h1>{me.display_name || me.username}</h1>
          <div className="handle">
            <Link href={`/u/${me.username}`}>@{me.username}</Link> · fid {me.fid}
          </div>
          {me.profile?.bio?.text && (
            <p className="bio">
              <RichText text={me.profile.bio.text} />
            </p>
          )}
          <div className="stats profile-stats">
            <span><b>{compact(me.following_count)}</b> following</span>
            <span><b>{compact(me.follower_count)}</b> followers</span>
          </div>
          {saved && <div className="form-ok">Profile updated. It can take a minute to show up everywhere.</div>}
        </section>

        <ProfileAnalytics casts={casts} followerCount={me.follower_count ?? 0} />

        <section className="me-section">
          <div className="me-section-head"><h2>Profile</h2><span className="meta">this Selfcaster</span></div>
          <PinnedCastForm casts={casts.slice(0, 30)} initial={prefs.pinnedCastHash} />
        </section>

        <section className="me-section">
          <div className="me-section-head"><h2>Settings</h2></div>
          <p className="field-hint">Themes, feeds, and filter controls are together in one place.</p>
          <Link href="/me" className="btn ghost sm">Open settings</Link>
        </section>

        <section className="me-section">
          <div className="me-section-head">
            <h2>Account</h2>
          </div>
          <p className="field-hint">
            {viewer.canWrite
              ? `Connected as @${me?.username || `FID ${viewer.fid}`} on this device.`
              : "Read-only. Connect your own Farcaster account to post, like and reply."}{" "}
            <Link href="/setup" className="linkish">
              {viewer.canWrite ? "Connection details" : "Connect"}
            </Link>
          </p>
        </section>

        <section className="me-section profile-recent-casts">
          <div className="me-section-head">
            <div><h2>Recent casts</h2><p className="field-hint">Your latest public posts, newest first.</p></div>
            {me.username && <Link href={`/u/${encodeURIComponent(me.username)}`} className="linkish">View all casts →</Link>}
          </div>
          {casts.length === 0
            ? <div className="empty"><h2>No casts yet</h2><p>When you post on Farcaster, your recent casts will appear here.</p></div>
            : casts.slice(0, 10).map((cast) => <CastCard key={cast.hash} cast={cast} canWrite={viewer.canWrite} viewerFid={viewer.fid} mutes={prefs.mutes} />)}
        </section>
      </>
    );
  } catch (e) {
    return <SetupBanner error={e} />;
  }
}
