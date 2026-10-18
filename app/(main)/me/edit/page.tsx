import { redirect } from "next/navigation";
import { EditProfile } from "@/components/EditProfile";
import { SetupBanner } from "@/components/SetupBanner";
import { neynar } from "@/lib/neynar";
import { requireViewer } from "@/lib/viewer";

export default async function EditProfilePage() {
  const viewer = await requireViewer();
  if (!viewer.canWrite) redirect("/setup");
  try {
    const { users } = await neynar().fetchBulkUsers({ fids: [viewer.fid] });
    const me = users[0];
    return (
      <>
        <div className="section-head">
          <h1>Edit profile</h1>
        </div>
        <EditProfile
          initial={{ displayName: me.display_name ?? "", bio: me.profile?.bio?.text ?? "", pfpUrl: me.pfp_url ?? "" }}
        />
      </>
    );
  } catch (e) {
    return <SetupBanner error={e} />;
  }
}
