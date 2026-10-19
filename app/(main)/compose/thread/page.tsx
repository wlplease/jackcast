import { redirect } from "next/navigation";
import { ThreadComposer } from "@/components/ThreadComposer";
import { requireViewer } from "@/lib/viewer";
import { getMe } from "@/lib/data";

export default async function ThreadPage() {
  const viewer = await requireViewer();
  if (!viewer.canWrite) redirect("/setup");
  const me = await getMe();
  return <ThreadComposer username={me.username || `fid-${viewer.fid}`} />;
}
