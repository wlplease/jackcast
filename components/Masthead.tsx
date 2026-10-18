"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions";
import { Wordmark } from "@/components/Wordmark";

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
};

export function Masthead({ channels, unseen, customName, aiEnabled }: { channels: string[]; unseen: number; customName: string; aiEnabled: boolean }) {
  const path = usePathname();
  const tab = (href: string, label: string) => (
    <Link key={href} href={href} className="tab" aria-current={path === href ? "page" : undefined}>
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
        <Link href="/" className="wordmark">
          <Wordmark />
        </Link>
        <nav className="mast-nav" aria-label="Main">
          {aiEnabled && icon("/#ai-catch-up", "AI catch-up", I.ai)}
          {icon("/search", "Search", I.search)}
          {icon("/notifications", "Notifications", I.bell, unseen)}
          {icon("/me", "You", I.you)}
          <form action={logout}>
            <button type="submit" className="icon-btn" aria-label="Lock" title="Lock">
              {I.lock}
            </button>
          </form>
        </nav>
      </div>
      <nav className="tabs" aria-label="Feeds">
        {tab("/", "Following")}
        {tab("/friends", "Friends")}
        {tab("/circle", customName)}
        {channels.map((c) => tab(`/c/${c}`, `/${c}`))}
      </nav>
    </header>
  );
}
