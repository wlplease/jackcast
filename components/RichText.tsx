import Link from "next/link";
import { tokenize } from "@/lib/format";

export function RichText({ text }: { text: string }) {
  return (
    <>
      {tokenize(text).map((p, i) => {
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
