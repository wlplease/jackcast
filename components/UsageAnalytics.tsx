"use client";

import { track } from "@vercel/analytics";
import { Analytics, type BeforeSend } from "@vercel/analytics/next";

const PAGE_ROUTES = new Set([
  "/", "/friends", "/top", "/recasts", "/sent", "/mini-apps", "/media", "/circle",
  "/search", "/notifications", "/profile", "/map", "/me", "/dev", "/setup",
  "/login", "/compose", "/compose/thread", "/arcade",
]);

const anonymizePageView: BeforeSend = (event) => {
  try {
    const url = new URL(event.url, window.location.origin);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    let route = PAGE_ROUTES.has(path) ? path : "/other";
    if (/^\/u\/[^/]+$/i.test(path)) route = "/u/:profile";
    else if (/^\/cast\/[^/]+$/i.test(path)) route = "/cast/:cast";
    else if (/^\/c\/[^/]+$/i.test(path)) route = "/c/:channel";
    else if (/^\/arcade\/weeks\/[^/]+$/i.test(path)) route = "/arcade/weeks/:week";
    return { ...event, url: `${url.origin}${route}` };
  } catch {
    return null;
  }
};

type UsageEvent =
  | { name: "feed_open"; feed: "following" | "friends" | "leaders" | "recasts" | "sent" | "mini_apps" | "media" | "custom" | "channel" }
  | { name: "cast_published"; kind: "cast" | "reply" | "quote" }
  | { name: "cast_deleted" }
  | { name: "mini_app_opened" | "digest_created" }
  | { name: "digest_requested"; posts: number }
  | { name: "gif_search"; source: "personal" | "shared" };

/** A closed event schema prevents future calls from attaching personal content or identifiers. */
export function trackUsage(event: UsageEvent) {
  switch (event.name) {
    case "feed_open": track(event.name, { feed: event.feed }); break;
    case "cast_published": track(event.name, { kind: event.kind }); break;
    case "cast_deleted": track(event.name); break;
    case "digest_requested": track(event.name, { posts: Math.max(0, Math.min(40, Math.floor(event.posts))) }); break;
    case "gif_search": track(event.name, { source: event.source }); break;
    default: track(event.name);
  }
}

export function UsageAnalytics() {
  return <Analytics beforeSend={anonymizePageView} />;
}
