import { Masthead } from "@/components/Masthead";
import { tabChannels, unseenCount } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  let unseen = 0;
  let channels: string[] = [];
  try {
    [channels, unseen] = await Promise.all([tabChannels(), unseenCount()]);
  } catch {}

  return (
    <div className="shell">
      <Masthead channels={channels} unseen={unseen} />
      <main>{children}</main>
    </div>
  );
}
