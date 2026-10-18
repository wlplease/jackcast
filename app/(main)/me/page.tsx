import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { ChannelTabsForm } from "@/components/ChannelTabsForm";
import { FriendsFeedForm } from "@/components/FriendsFeedForm";
import { PinnedCastForm } from "@/components/PinnedCastForm";
import { FiltersForm } from "@/components/FiltersForm";
import { ThemeForm } from "@/components/ThemeForm";
import { RichText } from "@/components/RichText";
import { SetupBanner } from "@/components/SetupBanner";
import { StatsChart } from "@/components/StatsChart";
import { followedChannels, tabChannels } from "@/lib/data";
import { neynar } from "@/lib/neynar";
import { compact, timeAgo } from "@/lib/format";
import { getPrefs } from "@/lib/prefs";
import { computeStats } from "@/lib/stats";
import { asCast } from "@/lib/types";
import { requireViewer } from "@/lib/viewer";

export default async function MePage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const viewer = await requireViewer();
  const envDefault = Number(process.env.MIN_USER_SCORE ?? "0") || 0;

  try {
    const [{ users }, casts, prefs, followed, currentTabs] = await Promise.all([
      neynar().fetchBulkUsers({ fids: [viewer.fid] }),
      neynar()
        .fetchCastsForUser({ fid: viewer.fid, viewerFid: viewer.fid, includeReplies: false, limit: 150 })
        .then((r) => r.casts.map(asCast)),
      getPrefs(),
      followedChannels(),
      tabChannels(),
    ]);
    const me = users[0];
    const stats = computeStats(casts);

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
            <span className="meta">{stats.windowLabel}</span>
          </div>
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
              </div>
              <p className="field-hint">
                {stats.avg.toFixed(1)} likes, recasts and replies per cast on average. Top-level casts only.
              </p>
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
          <div className="me-section-head">
            <h2>Look</h2>
            <span className="meta">this device</span>
          </div>
          <ThemeForm initialTheme={prefs.theme} initialMode={prefs.mode} />
        </section>

        <section className="me-section">
          <div className="me-section-head">
            <h2>Your feed</h2>
            <span className="meta">this device</span>
          </div>
          <ChannelTabsForm followed={followed} current={currentTabs} />
        </section>

        <section className="me-section" id="friends">
          <div className="me-section-head">
            <h2>Friends feed</h2>
            <span className="meta">this device</span>
          </div>
          <FriendsFeedForm initial={prefs.friends} />
        </section>

        <section className="me-section">
          <div className="me-section-head">
            <h2>Filters</h2>
            <span className="meta">this device</span>
          </div>
          <FiltersForm initial={prefs} envDefault={envDefault} />
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
      </>
    );
  } catch (e) {
    return <SetupBanner error={e} />;
  }
}
