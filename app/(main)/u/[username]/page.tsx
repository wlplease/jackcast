import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { ProfileFriendsAction } from "@/components/ProfileFriendsAction";
import { CastCard } from "@/components/CastCard";
import { Feed } from "@/components/Feed";
import { RichText } from "@/components/RichText";
import { SetupBanner } from "@/components/SetupBanner";
import { neynar } from "@/lib/neynar";
import { userCasts } from "@/lib/data";
import { compact } from "@/lib/format";
import { requireViewer } from "@/lib/viewer";
import { getPrefs } from "@/lib/prefs";

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ cursor?: string; view?: string }>;
}) {
  const { username } = await params;
  const { cursor, view } = await searchParams;
  const activeView = view === "media" ? "media" : "posts";
  const viewer = await requireViewer();

  let user;
  try {
    ({ user } = await neynar().lookupUserByUsername({ username, viewerFid: viewer.fid }));
  } catch (e) {
    const status = (e as { response?: { status?: number } })?.response?.status;
    if (status === 404) notFound();
    return <SetupBanner error={e} />;
  }

  const page = await userCasts(user.fid, cursor, activeView === "media");
  const followsYou = user.viewer_context?.followed_by;
  const prefs = await getPrefs();
  const pinned = !cursor && activeView === "posts" && user.fid === viewer.fid
    ? page.casts.find((cast) => cast.hash.toLowerCase() === prefs.pinnedCastHash)
    : undefined;
  const visibleCasts = pinned ? page.casts.filter((cast) => cast.hash !== pinned.hash) : page.casts;

  return (
    <>
      {!cursor && (
        <section className="profile">
          {user.profile?.banner?.url
            ? <img className="profile-cover-image" src={user.profile.banner.url} alt="" />
            : <div className="profile-cover" aria-hidden="true" />}
          <div className="profile-identity">
            <Avatar user={user} />
            <ProfileFriendsAction person={{ fid: user.fid, username: user.username }} initial={prefs.friends} />
          </div>
          <h1>{user.display_name || user.username}</h1>
          <div className="handle">@{user.username} · fid {user.fid}{followsYou ? " · follows you" : ""}</div>
          {user.profile?.bio?.text && (
            <p className="bio">
              <RichText text={user.profile.bio.text} />
            </p>
          )}
          <div className="stats profile-stats">
            <span><b>{compact(user.following_count)}</b> following</span>
            <span><b>{compact(user.follower_count)}</b> followers</span>
          </div>
        </section>
      )}
      <nav className="profile-tabs" aria-label="Profile posts">
        <a href={`/u/${username}`} aria-current={activeView === "posts" ? "page" : undefined}>Posts</a>
        <a href={`/u/${username}?view=media`} aria-current={activeView === "media" ? "page" : undefined}>Media</a>
      </nav>
      {pinned && <div className="pinned-cast"><div className="pinned-label">Pinned on this Selfcaster</div><CastCard cast={pinned} canWrite={viewer.canWrite} variant="focus" /></div>}
      <Feed
        page={{ ...page, casts: visibleCasts }}
        basePath={`/u/${username}${activeView === "media" ? "?view=media" : ""}`}
        canWrite={viewer.canWrite}
        emptyTitle={activeView === "media" ? "No media yet" : "No posts yet"}
        emptyBody={activeView === "media" ? "Photos and videos from this profile will show up here." : "No casts to show yet."}
      />
    </>
  );
}
