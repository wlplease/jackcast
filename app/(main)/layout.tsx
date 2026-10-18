import { Masthead } from "@/components/Masthead";
import { FeedScrollRestoration } from "@/components/FeedScrollRestoration";
import { tabChannels } from "@/lib/data";
import { getPrefs } from "@/lib/prefs";

export const dynamic = "force-dynamic";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  let channels: string[] = [];
  try {
    const [nextChannels, prefs] = await Promise.all([tabChannels(), getPrefs()]);
    channels = nextChannels;
    return (
      <div className="shell">
        <FeedScrollRestoration />
        <Masthead channels={channels} customName={prefs.customName} />
        <main>{children}</main>
      </div>
    );
  } catch {}

  return (
    <div className="shell">
      <FeedScrollRestoration />
      <Masthead channels={channels} customName="Custom" />
      <main>{children}</main>
    </div>
  );
}
