import { redirect } from "next/navigation";
import { EditProfile } from "@/components/EditProfile";
import { SetupBanner } from "@/components/SetupBanner";
import { neynar } from "@/lib/neynar";
import { requireViewer } from "@/lib/viewer";
import { profileStudioStatus } from "@/lib/profile-studio";

export default async function EditProfilePage() {
  const viewer = await requireViewer();
  if (!viewer.canWrite) redirect("/setup");
  try {
    const { users } = await neynar().fetchBulkUsers({ fids: [viewer.fid] });
    const me = users[0];
    const profileStudio = profileStudioStatus();
    const grokSetupMessage = profileStudio.enabled
      ? undefined
      : `Paid profile art is optional. This copy needs ${profileStudio.missing.join(" and ")} before the studio can be used. No credits can be spent until it is ready.`;
    return (
      <>
        <div className="section-head">
          <h1>Edit profile</h1>
        </div>
        <EditProfile
          fid={viewer.fid}
          farcasterSignedIn={viewer.source === "setup"}
          grokEnabled={profileStudio.enabled}
          grokSetupMessage={grokSetupMessage}
          initial={{ displayName: me.display_name ?? "", bio: me.profile?.bio?.text ?? "", pfpUrl: me.pfp_url ?? "", bannerUrl: me.profile?.banner?.url ?? "" }}
        />
      </>
    );
  } catch (e) {
    return <SetupBanner error={e} />;
  }
}
