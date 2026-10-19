/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Feed } from "@/components/Feed";
import { SetupBanner } from "@/components/SetupBanner";
import { topAccountsFeed } from "@/lib/data";
import { requireViewer } from "@/lib/viewer";

export default async function TopAccountsPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const [{ cursor }, viewer] = await Promise.all([searchParams, requireViewer()]);
  try {
    const { snapshot, ...page } = await topAccountsFeed(cursor);
    return <>
      <section className="section-head top-feed-head"><div><h1>Top Accounts</h1><p>Farcaster leaders and the most active people in your network, ranked by their last 90 days of posts.</p></div><span className="meta">{snapshot.active.length} active accounts</span></section>
      {snapshot.leaders.length > 0 && <section className="top-feed-leaders" aria-labelledby="top-leaders-title"><div className="top-feed-section-head"><div><h2 id="top-leaders-title">Farcaster & ecosystem leaders</h2><p>Curated voices across the protocol, apps, and community.</p></div></div><div className="top-feed-leader-grid">{snapshot.leaders.map((person) => <Link key={person.fid} href={`/u/${encodeURIComponent(person.username)}`} className="top-feed-leader"><span className="top-feed-avatar">{person.pfpUrl ? <img src={person.pfpUrl} alt="" /> : person.displayName.slice(0, 1)}</span><span className="top-feed-leader-copy"><strong>{person.displayName}</strong><small>@{person.username}</small><em>{person.role}</em></span><span className="top-feed-arrow" aria-hidden="true">↗</span></Link>)}</div></section>}
      <section className="top-feed-active" aria-labelledby="top-active-title"><div className="top-feed-section-head"><div><h2 id="top-active-title">Most active in your network</h2><p>{snapshot.scanned.toLocaleString()} posts checked{snapshot.complete ? " · full 90-day window" : " · bounded scan; newest activity may rank higher"}</p></div><span className="meta">90 days</span></div>{snapshot.active.length ? <div className="top-feed-active-list">{snapshot.active.slice(0, 20).map((person, index) => <Link key={person.fid} href={`/u/${encodeURIComponent(person.username)}`} className="top-feed-active-row"><b>{index + 1}</b><span>@{person.username}</span><small>{person.posts} posts · {person.followers.toLocaleString()} followers</small><span aria-hidden="true">↗</span></Link>)}</div> : <p className="field-hint">No 90-day activity rankings are available yet. Posts from the curated leaders are still shown below.</p>}</section>
      <div className="top-feed-posts-head"><div><h2>Latest posts</h2><p>Chronological posts from the leaders and your active accounts.</p></div></div>
      <Feed page={page} basePath="/top" canWrite={viewer.canWrite} viewerFid={viewer.fid} live="top" emptyTitle="No recent posts from these accounts" emptyBody="New posts will appear here as the leaders and active accounts in your network cast." />
    </>;
  } catch (error) { return <SetupBanner error={error} />; }
}
