import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { requireViewer } from "@/lib/viewer";
import { followedChannels, getMe, tabChannels } from "@/lib/data";
import { getPrefs } from "@/lib/prefs";
import { ThemeForm } from "@/components/ThemeForm";
import { ChannelTabsForm } from "@/components/ChannelTabsForm";
import { CustomFeedForm, CustomFeedNameForm, FriendsFeedForm } from "@/components/FriendsFeedForm";
import { FiltersForm } from "@/components/FiltersForm";
import { ListeningSettings } from "@/components/ListeningSettings";
import { DonationPanel } from "@/components/DonationPanel";
import { FeedNamesForm } from "@/components/FeedNamesForm";
import { ShareJackcasterButton } from "@/components/ShareJackcasterButton";
import { CopyIntroLinkButton } from "@/components/CopyIntroLinkButton";
import { FeedNavigationForm } from "@/components/FeedNavigationForm";
import { PrivacyOptions } from "@/components/PrivacyOptions";

const SETTINGS = [
  { href: "#appearance", icon: "◐", title: "Appearance", detail: "Themes and light or dark mode" },
  { href: "#feeds", icon: "☷", title: "Channel tabs", detail: "Choose feeds and composer channels" },
  { href: "#labels", icon: "✎", title: "Feed names", detail: "Rename your feed tabs" },
  { href: "#friends", icon: "♡", title: "Friends and custom", detail: "Choose people for each feed" },
  { href: "#filters", icon: "⌕", title: "Feed controls", detail: "Muted topics, replies, mini apps, and density" },
  { href: "#listening", icon: "♫", title: "Listening", detail: "Your optional audio playlist" },
  { href: "#account", icon: "◉", title: "Account and connection", detail: "Posting access and setup details" },
  { href: "#share", icon: "✦", title: "Share Jackcaster", detail: "Cast a ready-to-edit app intro" },
  { href: "#services", icon: "◇", title: "Optional services", detail: "See which extras are configured" },
  { href: "#privacy", icon: "◈", title: "Privacy choices", detail: "Turn optional services off on this device" },
  { href: "#donate", icon: "♡", title: "Support the developers", detail: "Donate on Base with your wallet" },
  { href: "#developer", icon: "⌘", title: "Developer tools", detail: "Mini Apps and project tools" },
];

export default async function SettingsPage() {
  const viewer = await requireViewer();
  const [me, prefs, followed, currentTabs] = await Promise.all([getMe().catch(() => null), getPrefs(), followedChannels().catch(() => []), tabChannels().catch(() => [])]);
  const envDefault = Number(process.env.MIN_USER_SCORE ?? "0") || 0;
  const firebaseConfigured = (() => {
    if (process.env.NEXT_PUBLIC_FIREBASE_CONFIG) {
      try { const config = JSON.parse(process.env.NEXT_PUBLIC_FIREBASE_CONFIG) as Record<string, unknown>; if (config.apiKey && config.authDomain && config.projectId && config.appId) return true; } catch { /* Check individual fields below. */ }
    }
    return Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && process.env.NEXT_PUBLIC_FIREBASE_APP_ID);
  })();
  const services = [
    { name: "Gemini AI catch-up", enabled: Boolean(process.env.GOOGLE_AI_API_KEY), setup: "Add GOOGLE_AI_API_KEY in your deployment settings." },
    { name: "Read aloud", enabled: Boolean((process.env.ELEVENLABS_API_KEY || process.env.ELEVELN_LAB_API_KEY) && process.env.ELEVENLABS_VOICE_ID), setup: "Add an ElevenLabs API key and voice ID in your deployment settings." },
    { name: "Shared GIF search", enabled: Boolean((process.env.GIPHY_APP || process.env.GIPHY_API_KEY) && (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) && (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN)), setup: "Configure a GIPHY key and Upstash Redis in your deployment settings." },
    { name: "Community map and leaderboard", enabled: firebaseConfigured, setup: "Configure the public Firebase Web settings and enable Anonymous Auth." },
  ];
  return <>
    <div className="section-head settings-page-title"><div><h1>Settings</h1><p>Make Jackcaster work the way you do.</p></div></div>
    <section className="settings-identity">
      {me && <Avatar user={me} />}
      <div><strong>{me?.display_name || me?.username || `FID ${viewer.fid}`}</strong><span>{viewer.canWrite ? "Connected account" : "Read-only connection"} · FID {viewer.fid}</span></div>
      <Link href="/profile" className="btn ghost sm">Profile & analytics</Link>
    </section>
    <nav className="settings-shortcuts" aria-label="Settings sections">{SETTINGS.map((section) => <a key={section.href} href={section.href} className="settings-shortcut"><span className="settings-shortcut-icon" aria-hidden="true">{section.icon}</span><span><strong>{section.title}</strong><small>{section.detail}</small></span><span aria-hidden="true">›</span></a>)}</nav>
    <section className="me-section" id="appearance"><div className="me-section-head"><h2>Appearance</h2><span className="meta">this device</span></div><ThemeForm initialTheme={prefs.theme} initialMode={prefs.mode} /></section>
    <section className="me-section" id="feeds"><div className="me-section-head"><h2>Channel tabs</h2><span className="meta">this device</span></div><ChannelTabsForm followed={followed} current={currentTabs} /></section>
    <section className="me-section" id="feed-navigation"><div className="me-section-head"><h2>Built-in feed tabs</h2><span className="meta">this device</span></div><FeedNavigationForm initialOrder={prefs.feedOrder} initialHidden={prefs.hiddenFeeds} /></section>
    <section className="me-section" id="labels"><div className="me-section-head"><h2>Feed names</h2><span className="meta">this device</span></div><FeedNamesForm initial={prefs.feedNames} /></section>
    <section className="me-section" id="friends"><div className="me-section-head"><h2>Friends</h2><span className="meta">this device · up to 50</span></div><FriendsFeedForm initial={prefs.friends} /></section>
    <section className="me-section" id="custom-feed"><div className="me-section-head"><h2>Custom feed</h2><span className="meta">this device</span></div><CustomFeedNameForm initial={prefs.customName} /><CustomFeedForm initial={prefs.customPeople} excluded={prefs.friends} /></section>
    <section className="me-section" id="filters"><div className="me-section-head"><h2>Feed controls</h2><span className="meta">this device</span></div><FiltersForm initial={prefs} envDefault={envDefault} /></section>
    <section className="me-section" id="listening"><div className="me-section-head"><div><h2>Listening</h2><p className="field-hint">Optional background tracks and audio settings.</p></div><span className="meta">this device</span></div><ListeningSettings initial={prefs.audioTracks} /></section>
    <section className="me-section" id="account"><div className="me-section-head"><h2>Account and connection</h2></div><p className="field-hint">{viewer.canWrite ? `Connected as @${me?.username || `FID ${viewer.fid}`} on this device. Posts use this Farcaster account.` : "Read-only. Connect your own Farcaster account to post, like, and reply."} <Link href="/setup" className="linkish">{viewer.canWrite ? "Connection details" : "Connect account"}</Link></p></section>
    <section className="me-section" id="share"><div className="me-section-head"><div><h2>Share Jackcaster</h2><p className="field-hint">Pick a short intro and open a Farcaster cast with the app link already attached.</p></div></div><ShareJackcasterButton full /><CopyIntroLinkButton /></section>
    <section className="me-section" id="services"><div className="me-section-head"><div><h2>Optional services</h2><p className="field-hint">Configuration status only; this does not check provider uptime, quota, or credentials. Secret values never appear here.</p></div><span className="meta">deployment status</span></div><div className="service-status-list">{services.map((service) => <article key={service.name}><span className={`service-status-dot${service.enabled ? " ready" : " off"}`} aria-hidden="true" /><div><strong>{service.name}</strong><small>{service.enabled ? "Configured on this deployment" : service.setup}</small></div><span className={`service-status-label${service.enabled ? " ready" : " off"}`}>{service.enabled ? "Configured" : "Not configured"}</span></article>)}</div></section>
    <section className="me-section" id="privacy"><div className="me-section-head"><div><h2>Privacy choices</h2><p className="field-hint">Turn off optional providers and features on this device.</p></div><span className="meta">this device</span></div><PrivacyOptions initialDisabled={prefs.disabledServices} /></section>
    <section className="me-section" id="donate"><div className="me-section-head"><div><h2>Support the developers</h2><p className="field-hint">Choose a project and donate USDC or ETH on Base.</p></div><span className="meta">optional</span></div><DonationPanel /></section>
    <section className="me-section" id="developer"><div className="me-section-head"><div><h2>Developer tools</h2><p className="field-hint">Your published Mini Apps and project resources.</p></div><span className="meta">advanced</span></div><Link className="btn ghost sm" href="/dev">Open Developer tools →</Link></section>
  </>;
}
