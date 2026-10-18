import { redirect } from "next/navigation";
import { ThreadComposer } from "@/components/ThreadComposer";
import { requireViewer } from "@/lib/viewer";

export default async function ThreadPage() {
  const viewer = await requireViewer();
  if (!viewer.canWrite) redirect("/setup");
  return <ThreadComposer />;
}
