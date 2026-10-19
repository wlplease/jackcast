import { JumpingJacksGame } from "@/components/JumpingJacksGame";
import { requireViewer } from "@/lib/viewer";
import { getMe } from "@/lib/data";

export default async function ArcadePage() {
  const viewer = await requireViewer();
  const me = await getMe().catch(() => null);
  return <JumpingJacksGame player={{ fid: viewer.fid, username: me?.username ?? `fid-${viewer.fid}` }} />;
}
