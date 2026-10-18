import { Masthead } from "@/components/Masthead";
import { tabChannels, unseenCount } from "@/lib/data";
import { getPrefs } from "@/lib/prefs";

export const dynamic = "force-dynamic";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  let unseen = 0;
  let channels: string[] = [];
  try {
    const [nextChannels, nextUnseen, prefs] = await Promise.all([tabChannels(), unseenCount(), getPrefs()]);
    channels = nextChannels;
    unseen = nextUnseen;
    return (
      <div className="shell">
        <Masthead channels={channels} unseen={unseen} customName={prefs.customName} />
        <main>{children}</main>
      </div>
    );
  } catch {}

  return (
    <div className="shell">
      <Masthead channels={channels} unseen={unseen} customName="Custom" />
      <main>{children}</main>
    </div>
  );
}
