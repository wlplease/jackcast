import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Feed } from "@/components/Feed";
import { SetupBanner } from "@/components/SetupBanner";
import { neynar } from "@/lib/neynar";
import { clean } from "@/lib/data";
import { compact } from "@/lib/format";
import type { Author } from "@/lib/types";
import { requireViewer } from "@/lib/viewer";

type Kind = "casts" | "people" | "channels";
const KINDS: { id: Kind; label: string }[] = [
  { id: "casts", label: "Casts" },
  { id: "people", label: "People" },
  { id: "channels", label: "Channels" },
];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; cursor?: string }>;
}) {
  const sp = await searchParams;
  const viewer = await requireViewer();
  const q = (sp.q ?? "").trim().slice(0, 100);
  const kind: Kind = KINDS.some((k) => k.id === sp.type) ? (sp.type as Kind) : "casts";
  const href = (k: Kind) => `/search?${new URLSearchParams({ q, type: k })}`;

  return (
    <>
      <form className="search-bar" action="/search" role="search">
        <input type="hidden" name="type" value={kind} />
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="M20 20l-4.2-4.2" />
        </svg>
        <input
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search casts, people, channels"
          aria-label="Search"
          autoFocus={!q}
          enterKeyHint="search"
        />
      </form>
      <nav className="seg" aria-label="Search type">
        {KINDS.map((k) => (
          <Link key={k.id} href={href(k.id)} className="seg-item" aria-current={k.id === kind ? "page" : undefined}>
            {k.label}
          </Link>
        ))}
      </nav>
      <p className="field-hint search-miniapps-link"><Link href="/mini-apps">Looking for Mini Apps? Browse weekly trends and search the catalog →</Link></p>
      {q ? <Results q={q} kind={kind} cursor={sp.cursor} fid={viewer.fid} canWrite={viewer.canWrite} /> : <Hints />}
    </>
  );
}

function Hints() {
  return (
    <section className="search-suggestions" aria-label="Search suggestions">
      <div className="search-suggestions-intro">
        <span className="search-suggestions-mark" aria-hidden="true">⌕</span>
        <div><h2>What are you looking for?</h2><p>Search the Farcaster conversation, find people, or explore a channel.</p></div>
      </div>
      <div className="search-suggestion-grid">
        <SuggestionCard type="casts" title="Casts" description="Find conversations, ideas, and links" icon="✳" />
        <SuggestionCard type="people" title="People" description="Discover creators and accounts" icon="♙" />
        <SuggestionCard type="channels" title="Channels" description="Explore communities by topic" icon="#" />
      </div>
      <p className="search-suggestion-examples">Try <SuggestionLink type="casts" query="mini apps" label="mini apps" />, <SuggestionLink type="people" query="builders" label="builders" />, or <SuggestionLink type="channels" query="music" label="music" />.</p>
    </section>
  );
}

function SuggestionCard({ type, title, description, icon }: { type: Kind; title: string; description: string; icon: string }) {
  return <Link className="search-suggestion-card" href={`/search?${new URLSearchParams({ type })}`}>
    <span className="search-suggestion-icon" aria-hidden="true">{icon}</span>
    <span><strong>{title}</strong><small>{description}</small></span>
    <span className="search-suggestion-arrow" aria-hidden="true">→</span>
  </Link>;
}

function SuggestionLink({ type, query, label }: { type: Kind; query: string; label: string }) {
  return <Link href={`/search?${new URLSearchParams({ type, q: query })}`}>{label}</Link>;
}

async function Results({ q, kind, cursor, fid, canWrite }: { q: string; kind: Kind; cursor?: string; fid: number; canWrite: boolean }) {
  try {
    if (kind === "people") {
      const res = await neynar().searchUser({ q: q.replace(/^@/, ""), viewerFid: fid, limit: 10 });
      const users = res.result.users;
      if (!users.length) return <NoResults q={q} />;
      return (
        <ul className="result-list">
          {users.map((u) => (
            <li key={u.fid}>
              <Link href={`/u/${u.username}`} className="result">
                <Avatar user={u as Author} />
                <div className="result-main">
                  <div className="result-title">{u.display_name || u.username}</div>
                  <div className="result-sub">
                    @{u.username} · {compact(u.follower_count)} followers
                    {u.viewer_context?.following ? " · following" : ""}
                  </div>
                  {u.profile?.bio?.text && <div className="result-desc">{u.profile.bio.text}</div>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      );
    }

    if (kind === "channels") {
      const res = await neynar().searchChannels({ q: q.replace(/^\//, ""), limit: 20, viewerFid: fid });
      if (!res.channels.length) return <NoResults q={q} />;
      return (
        <ul className="result-list">
          {res.channels.map((c) => (
            <li key={c.id}>
              <Link href={`/c/${c.id}`} className="result">
                <Avatar user={{ fid: 0, pfp_url: c.image_url }} />
                <div className="result-main">
                  <div className="result-title">{c.name || c.id}</div>
                  <div className="result-sub">
                    /{c.id}
                    {c.follower_count != null ? ` · ${compact(c.follower_count)} followers` : ""}
                  </div>
                  {c.description && <div className="result-desc">{c.description}</div>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      );
    }

    const res = await neynar().searchCasts({ q, viewerFid: fid, limit: 25, cursor });
    const filtered = await clean(res.result.casts, fid);
    if (!filtered.casts.length && !filtered.hidden) return <NoResults q={q} />;
    return (
      <Feed
        page={{ ...filtered, cursor: res.result.next?.cursor ?? null }}
        basePath={`/search?${new URLSearchParams({ q, type: "casts" })}`}
        canWrite={canWrite}
        viewerFid={fid}
        emptyTitle="Nothing left"
        emptyBody="Everything matching was hidden by your filters."
      />
    );
  } catch (e) {
    return <SetupBanner error={e} />;
  }
}

function NoResults({ q }: { q: string }) {
  return (
    <div className="empty">
      <h2>No results</h2>
      <p>Nothing matched &ldquo;{q}&rdquo;.</p>
    </div>
  );
}
