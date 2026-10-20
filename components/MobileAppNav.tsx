"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Home", icon: <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-6h6v6"/></> },
  { href: "/search", label: "Search", icon: <><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></> },
  { href: "/saved", label: "Saved", icon: <><path d="M6 4.8A1.8 1.8 0 0 1 7.8 3h8.4A1.8 1.8 0 0 1 18 4.8V21l-6-4-6 4V4.8Z"/></> },
  { href: "/notifications", label: "Alerts", icon: <><path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Z"/><path d="M10 20a2.2 2.2 0 0 0 4 0"/></> },
  { href: "/map", label: "Map", icon: <><circle cx="12" cy="12" r="9"/><path d="M3.5 12h17M12 3c2.4 2.5 3.5 5.5 3.5 9s-1.1 6.5-3.5 9c-2.4-2.5-3.5-5.5-3.5-9S9.6 3 12 3Z"/></> },
  { href: "/me", label: "You", icon: <><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.3-3.6 4.2-5.4 7.5-5.4s6.2 1.8 7.5 5.4"/></> },
];

export function MobileAppNav() {
  const pathname = usePathname();
  return <nav className="mobile-app-nav" aria-label="App navigation">
    {items.map((item) => {
      const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
      return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{item.icon}</svg>
        <span>{item.label}</span>
      </Link>;
    })}
  </nav>;
}
