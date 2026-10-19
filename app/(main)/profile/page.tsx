import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { CastCard } from "@/components/CastCard";
import { PinnedCastForm } from "@/components/PinnedCastForm";
import { RichText } from "@/components/RichText";
import { SetupBanner } from "@/components/SetupBanner";
import { StatsChart } from "@/components/StatsChart";
import { ownProfileAnalytics } from "@/lib/data";
import { compact, timeAgo } from "@/lib/format";
import { getPrefs } from "@/lib/prefs";
import { computeStats, type StatsWindow } from "@/lib/stats";
import { requireViewer } from "@/lib/viewer";

export default async function MePage({ searchParams }: { searchParams: Promise<{ saved?: string; window?: string }> }) {
  const { saved, window: requestedWindow } = await searchParams;
  const window: StatsWindow = requestedWindow === "7d" || requestedWindow === "90d" || requestedWindow === "loaded" ? requestedWindow : "30d";
  const viewer = await requireViewer();

  try {
    const [profileData, prefs] = await Promise.all([
      ownProfileAnalytics(viewer.fid),
      getPrefs(),
    ]);
    const { user: me, casts } = profileData;
    const stats = computeStats(casts, window, me.follower_count ?? 0);

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

        <section className="me-section">
          <div className="me-section-head">
            <h2>Your casts</h2>
            <span className="meta">{stats.windowLabel} · up to 100 most recent casts</span>
          </div>
          <nav className="stats-range" aria-label="Analytics date range">
            {([ ["7d", "7 days"], ["30d", "30 days"], ["90d", "90 days"], ["loaded", "Loaded casts"] ] as const).map(([value, label]) => (
              <Link key={value} href={`/me?window=${value}`} className={`stats-range-link${window === value ? " active" : ""}`} aria-current={window === value ? "page" : undefined}>{label}</Link>
            ))}
          </nav>
          {stats.casts === 0 ? (
            <p className="field-hint">No casts yet. Post something and come back.</p>
          ) : (
            <>
              <div className="tiles">
                <div className="tile">
                  <b>{compact(stats.casts)}</b>
                  <span>casts</span>
                </div>
                <div className="tile">
                  <b>{compact(stats.likes)}</b>
                  <span>likes</span>
                </div>
                <div className="tile">
                  <b>{compact(stats.recasts)}</b>
                  <span>recasts</span>
                </div>
                <div className="tile">
                  <b>{compact(stats.replies)}</b>
                  <span>replies</span>
                </div>
                <div className="tile">
                  <b>{stats.avg.toFixed(1)}</b>
                  <span>engagement per cast</span>
                </div>
                <div className="tile">
                  <b>{stats.engagementRate.toFixed(1)}%</b>
                  <span>engagement / followers</span>
                </div>
                <div className="tile">
                  <b>{compact(stats.mediaCasts)}</b>
                  <span>casts with media</span>
                </div>
                {stats.bestCast && <div className="tile"><b>{compact(stats.bestCast.e)}</b><span>best cast engagement</span></div>}
              </div>
              <p className="field-hint">Top-level casts only. Engagement rate is reactions and replies divided by follower count; it is an estimate, not unique reach.</p>
              <StatsChart points={stats.points} />
              {stats.top.length > 0 && (
                <>
                  <h3 className="sub-head">What landed</h3>
                  <ol className="top-casts">
                    {stats.top.map((c) => (
                      <li key={c.hash}>
                        <Link href={`/cast/${c.hash}`}>
                          <span className="tc-text">{c.text || (c.hasMedia ? "(photo or link)" : "(no text)")}</span>
                          <span className="tc-meta">
                            ♥ {compact(c.likes)} · ↻ {compact(c.recasts)} · ↳ {compact(c.replies)} · {timeAgo(c.ts)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </>
          )}
        </section>

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
              ? viewer.source === "env"
                ? "Connected on every device through your environment variables."
                : "Connected on this device."
              : "Read-only. Connect to post, like and reply."}{" "}
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
