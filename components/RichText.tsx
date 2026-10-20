import Link from "next/link";
import { tokenize } from "@/lib/format";
import { withoutCastAttribution } from "@/lib/cast-attribution";

export function RichText({ text }: { text: string }) {
  // Keep protocol attribution in the published cast for transparency and Sent-feed matching,
  // while avoiding a repeated raw URL in every feed, profile, and thread view.
  const displayText = withoutCastAttribution(text);
  return (
    <>
      {tokenize(displayText).map((p, i) => {
        switch (p.kind) {
          case "url": {
            let label = p.value.replace(/^https?:\/\/(www\.)?/, "");
            if (label.length > 42) label = label.slice(0, 40) + "…";
            return (
              <a key={i} className="link" href={p.value} target="_blank" rel="noreferrer">
                {label}
              </a>
            );
          }
          case "mention":
            return (
              <Link key={i} className="link" href={`/u/${p.value}`}>
                @{p.value}
              </Link>
            );
          case "channel":
            return (
              <Link key={i} className="link" href={`/c/${p.value}`}>
                /{p.value}
              </Link>
            );
          default:
            return <span key={i}>{p.value}</span>;
        }
      })}
    </>
  );
}
