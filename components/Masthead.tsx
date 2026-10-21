"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logout } from "@/app/actions";
import { Wordmark } from "@/components/Wordmark";
import { NotificationLink } from "@/components/NotificationLink";
import { ListeningDock } from "@/components/ListeningDock";
import { ProfileQuickMenu } from "@/components/ProfileQuickMenu";
import { BUILTIN_FEED_ORDER, DEFAULT_FEED_NAMES, type BuiltinFeedKey, type FeedNames } from "@/lib/prefs-shared";
import { trackUsage } from "@/components/UsageAnalytics";

const I = {
  search: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" />
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z" /><path d="M10 20a2.2 2.2 0 0 0 4 0" />
    </svg>
  ),
  messages: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5 8 8 0 0 1-3.4-.8L4 20l1.4-4.1a7.5 7.5 0 1 1 14.6-4.4Z" /><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" />
    </svg>
  ),
  you: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20c1.3-3.6 4.2-5.4 7.5-5.4s6.2 1.8 7.5 5.4" />
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9.5" rx="2" /><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
    </svg>
  ),
  ai: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 2 1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2Z" />
      <path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
      <path d="M19.4 15.2a1.7 1.7 0 0 0 .3 1.9l.1.1-1.9 1.9-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-2.7v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-1.9-1.9.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H6v-2.7h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.9-1.9.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V6h2.7v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.9 1.9-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2v2.7h-.2a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  ),
};

export function Masthead({ channels, customName, audioTracks = [], feedNames = DEFAULT_FEED_NAMES, feedOrder = BUILTIN_FEED_ORDER, hiddenFeeds = [] }: { channels: string[]; customName: string; audioTracks?: { title: string; url: string }[]; feedNames?: FeedNames; feedOrder?: BuiltinFeedKey[]; hiddenFeeds?: BuiltinFeedKey[] }) {
  const path = usePathname();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [showMoreFeeds, setShowMoreFeeds] = useState(false);
  const feedLinks: Record<BuiltinFeedKey, [string, string]> = {
    following: ["/", feedNames.following], friends: ["/friends", feedNames.friends], leaders: ["/top", feedNames.leaders],
    recasts: ["/recasts", feedNames.recasts], sent: ["/sent", "Sent"], miniApps: ["/mini-apps", feedNames.miniApps],
    media: ["/media", feedNames.media], custom: ["/circle", customName],
  };
  const tab = (href: string, label: string) => (
    <Link key={href} href={href} className="tab" aria-current={path === href ? "page" : undefined} onClick={() => {
      const feed = href === "/" ? "following" : href === "/friends" ? "friends" : href === "/top" ? "leaders" : href === "/recasts" ? "recasts" : href === "/sent" ? "sent" : href === "/mini-apps" ? "mini_apps" : href === "/media" ? "media" : href === "/circle" ? "custom" : "channel";
      trackUsage({ name: "feed_open", feed });
    }}>
      {label}
    </Link>
  );
  const icon = (href: string, label: string, svg: React.ReactNode, badge?: number) => (
    <Link href={href} className="icon-btn" aria-label={badge ? `${label}, ${badge} new` : label} aria-current={path.startsWith(href) ? "page" : undefined} title={label}>
      {svg}
      {badge ? <span className="badge">{badge > 99 ? "99+" : badge}</span> : null}
    </Link>
  );

  return (
    <header className="mast">
      <div className="mast-row">
        <Link href="/" className="wordmark" aria-label="Jackcaster home feed" title="Home feed" scroll>
          <Wordmark />
        </Link>
        <nav className="mast-nav" aria-label="Main">
          {icon("/search", "Search", I.search)}
          {icon("/?ai=1#ai-catch-up", "AI catch-up", I.ai)}
          <ListeningDock personalTracks={audioTracks} />
          <NotificationLink icon={I.bell} />
          {icon("/messages", "Private messages", I.messages)}
          <ProfileQuickMenu />
          {icon("/me", "Settings", I.settings)}
          <button type="button" className="icon-btn" aria-label="Sign out" title="Sign out" onClick={() => setConfirmSignOut(true)}>
            {I.lock}
          </button>
        </nav>
      </div>
      <nav className="tabs" aria-label="Feeds">
        {feedOrder.filter((key) => !hiddenFeeds.includes(key)).map((key) => {
          const [href, label] = feedLinks[key];
          return tab(href, label);
        })}
        {hiddenFeeds.length > 0 && <div className="tabs-more">
          <button type="button" className="tab tabs-more-button" aria-expanded={showMoreFeeds} onClick={() => setShowMoreFeeds((open) => !open)}>More <span aria-hidden="true">⌄</span></button>
          {showMoreFeeds && <div className="tabs-more-menu" aria-label="Hidden feeds">{hiddenFeeds.map((key) => {
            const [href, label] = feedLinks[key];
            return <Link key={key} href={href} className="tabs-more-link" aria-current={path === href ? "page" : undefined} onClick={() => setShowMoreFeeds(false)}>{label}</Link>;
          })}<Link href="/me#feed-navigation" className="tabs-more-manage" onClick={() => setShowMoreFeeds(false)}>Manage feeds…</Link></div>}
        </div>}
        {channels.map((c) => tab(`/c/${c}`, `/${c}`))}
      </nav>
      {confirmSignOut && <div className="confirm-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmSignOut(false); }}>
        <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="signout-title" aria-describedby="signout-description">
          <div className="confirm-icon">{I.lock}</div>
          <h2 id="signout-title">Sign out of Jackcaster?</h2>
          <p id="signout-description">You can sign back in any time with your app password.</p>
          <div className="confirm-actions">
            <button type="button" className="btn secondary" onClick={() => setConfirmSignOut(false)}>Stay signed in</button>
            <form action={logout}><button type="submit" className="btn danger">Sign out</button></form>
          </div>
        </section>
      </div>}
    </header>
  );
}
