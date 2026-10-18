import { Composer, type QuoteTarget } from "@/components/Composer";
import { SetupBanner } from "@/components/SetupBanner";
import { neynar } from "@/lib/neynar";
import { getMe, composerChannels } from "@/lib/data";
import type { Author } from "@/lib/types";
import { requireViewer } from "@/lib/viewer";
import Link from "next/link";

/**
 * One composer page for quotes and for sharing from elsewhere:
 *   /compose?quote=0xhash                 quote a cast
 *   /compose?url=https://…&text=…         from the iOS Shortcut or the bookmarklet
 *   /compose?title=…&text=…&url=…         from Android's share sheet (PWA share target)
 */
export default async function ComposePage({
  searchParams,
}: {
  searchParams: Promise<{ quote?: string; url?: string; text?: string; title?: string }>;
}) {
  const sp = await searchParams;
  const viewer = await requireViewer();

  if (!viewer.canWrite) {
    return (
      <div className="banner">
        Read-only mode. <Link href="/setup" style={{ color: "var(--accent)", fontWeight: 500 }}>Connect your account</Link> to cast.
      </div>
    );
  }

  // Android often puts the link inside `text`. Pull a trailing URL out into its own embed.
  let text = (sp.text ?? "").trim();
  let url = (sp.url ?? "").trim();
  if (!url) {
    const m = text.match(/(https?:\/\/\S+)\s*$/);
    if (m) {
      url = m[1];
      text = text.slice(0, m.index).trim();
    }
  }
  const title = (sp.title ?? "").trim();
  if (!text && title && title !== url) text = title;

  try {
    const [me, channels, quote] = await Promise.all([
      getMe(),
      composerChannels(),
      sp.quote && /^0x[0-9a-f]{6,64}$/i.test(sp.quote)
        ? neynar()
            .lookupCastByHashOrUrl({ identifier: sp.quote, type: "hash", viewerFid: viewer.fid })
            .then(
              (r): QuoteTarget => ({
                hash: r.cast.hash,
                fid: r.cast.author.fid,
                author: r.cast.author as Author,
                text: r.cast.text,
              })
            )
            .catch(() => undefined)
        : Promise.resolve(undefined),
    ]);

    return (
      <>
        <div className="section-head">
          <h1>{quote ? "Quote" : url ? "Share" : "New cast"}</h1>
        </div>
        <Composer
          me={me}
          channels={channels}
          initialText={text}
          initialLink={url}
          quote={quote}
          afterPost="/"
          autoFocus
        />
      </>
    );
  } catch (e) {
    return <SetupBanner error={e} />;
  }
}
