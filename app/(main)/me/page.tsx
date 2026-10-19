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

const SETTINGS = [
  { href: "#appearance", icon: "◐", title: "Appearance", detail: "Themes and light or dark mode" },
  { href: "#feeds", icon: "☷", title: "Channel tabs", detail: "Choose feeds and composer channels" },
  { href: "#labels", icon: "✎", title: "Feed names", detail: "Rename your feed tabs" },
  { href: "#friends", icon: "♡", title: "Friends and custom", detail: "Choose people for each feed" },
  { href: "#filters", icon: "⌕", title: "Feed controls", detail: "Muted topics, replies, mini apps, and density" },
  { href: "#listening", icon: "♫", title: "Listening", detail: "Your optional audio playlist" },
  { href: "#account", icon: "◉", title: "Account and connection", detail: "Posting access and setup details" },
  { href: "#share", icon: "✦", title: "Share Jackcaster", detail: "Cast a ready-to-edit app intro" },
  { href: "#donate", icon: "♡", title: "Support the developers", detail: "Donate on Base with your wallet" },
  { href: "#developer", icon: "⌘", title: "Developer tools", detail: "Mini Apps and project tools" },
];

export default async function SettingsPage() {
  const viewer = await requireViewer();
  const [me, prefs, followed, currentTabs] = await Promise.all([getMe().catch(() => null), getPrefs(), followedChannels().catch(() => []), tabChannels().catch(() => [])]);
  const envDefault = Number(process.env.MIN_USER_SCORE ?? "0") || 0;
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
    <section className="me-section" id="labels"><div className="me-section-head"><h2>Feed names</h2><span className="meta">this device</span></div><FeedNamesForm initial={prefs.feedNames} /></section>
    <section className="me-section" id="friends"><div className="me-section-head"><h2>Friends</h2><span className="meta">this device · up to 50</span></div><FriendsFeedForm initial={prefs.friends} /></section>
    <section className="me-section" id="custom-feed"><div className="me-section-head"><h2>Custom feed</h2><span className="meta">this device</span></div><CustomFeedNameForm initial={prefs.customName} /><CustomFeedForm initial={prefs.customPeople} excluded={prefs.friends} /></section>
    <section className="me-section" id="filters"><div className="me-section-head"><h2>Feed controls</h2><span className="meta">this device</span></div><FiltersForm initial={prefs} envDefault={envDefault} /></section>
    <section className="me-section" id="listening"><div className="me-section-head"><div><h2>Listening</h2><p className="field-hint">Optional background tracks and audio settings.</p></div><span className="meta">this device</span></div><ListeningSettings initial={prefs.audioTracks} /></section>
    <section className="me-section" id="account"><div className="me-section-head"><h2>Account and connection</h2></div><p className="field-hint">{viewer.canWrite ? viewer.source === "env" ? "Connected on every device through your environment variables." : "Connected on this device." : "Read-only. Connect to post, like, and reply."} <Link href="/setup" className="linkish">{viewer.canWrite ? "Connection details" : "Connect account"}</Link></p></section>
    <section className="me-section" id="share"><div className="me-section-head"><div><h2>Share Jackcaster</h2><p className="field-hint">Pick a short intro and open a Farcaster cast with the app link already attached.</p></div></div><ShareJackcasterButton full /></section>
    <section className="me-section" id="donate"><div className="me-section-head"><div><h2>Support the developers</h2><p className="field-hint">Choose a project and donate USDC or ETH on Base.</p></div><span className="meta">optional</span></div><DonationPanel /></section>
    <section className="me-section" id="developer"><div className="me-section-head"><div><h2>Developer tools</h2><p className="field-hint">Your published Mini Apps and project resources.</p></div><span className="meta">advanced</span></div><Link className="btn ghost sm" href="/dev">Open Developer tools →</Link></section>
  </>;
}
