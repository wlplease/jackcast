import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { Feed } from "@/components/Feed";
import { RichText } from "@/components/RichText";
import { SetupBanner } from "@/components/SetupBanner";
import { neynar } from "@/lib/neynar";
import { userCasts } from "@/lib/data";
import { compact } from "@/lib/format";
import { requireViewer } from "@/lib/viewer";

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { username } = await params;
  const { cursor } = await searchParams;
  const viewer = await requireViewer();

  let user;
  try {
    ({ user } = await neynar().lookupUserByUsername({ username, viewerFid: viewer.fid }));
  } catch (e) {
    const status = (e as { response?: { status?: number } })?.response?.status;
    if (status === 404) notFound();
    return <SetupBanner error={e} />;
  }

  const page = await userCasts(user.fid, cursor);
  const followsYou = user.viewer_context?.followed_by;

  return (
    <>
      {!cursor && (
        <section className="profile">
          <Avatar user={user} />
          <h1>{user.display_name || user.username}</h1>
          <div className="handle">
            @{user.username} · fid {user.fid}
            {followsYou ? " · follows you" : ""}
          </div>
          {user.profile?.bio?.text && (
            <p className="bio">
              <RichText text={user.profile.bio.text} />
            </p>
          )}
          <div className="stats">
            <span>{compact(user.following_count)} following</span>
            <span>{compact(user.follower_count)} followers</span>
          </div>
        </section>
      )}
      <Feed page={page} basePath={`/u/${username}`} canWrite={viewer.canWrite} emptyBody="No casts yet." />
    </>
  );
}
