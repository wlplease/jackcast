import Link from "next/link";
import { getViewer } from "@/lib/viewer";

const steps = [
  { number: "01", title: "Start with Following", text: "Read recent casts from people you follow. Open a cast to join the conversation." },
  { number: "02", title: "Make the feed yours", text: "Try Friends, Top Accounts, Recasts, Media, and Mini Apps. Reorder feeds, choose a theme, and set privacy options in Settings." },
  { number: "03", title: "Connect when you’re ready", text: "Browsing is read-only. Connect your Farcaster account when you want to post or react. Review the setup security warning before continuing." },
];

const destinations = [
  { href: "/friends", icon: "♡", title: "Friends", text: "A focused feed from people you choose." },
  { href: "/top", icon: "↗", title: "Top Accounts", text: "Catch up on active voices in your network." },
  { href: "/mini-apps", icon: "▦", title: "Mini Apps", text: "Find and open apps from Farcaster." },
  { href: "/media", icon: "▶", title: "Media", text: "Browse photo, video, and audio casts." },
  { href: "/saved", icon: "☆", title: "Saved", text: "Keep casts handy in collections on this device." },
  { href: "/me#privacy", icon: "◈", title: "Privacy choices", text: "Turn optional services off for this device." },
];

export default async function WelcomePage() {
  const viewer = await getViewer();
  return <main className="welcome-page">
    <header className="welcome-hero">
      <span className="welcome-kicker">JACKCASTER · QUICK START</span>
      <h1>Welcome. Make yourself at home.</h1>
      <p>Jackcaster is a personal Farcaster client. Start by reading; set up your feeds and extras as you go.</p>
      <div className="welcome-hero-actions">
        {viewer ? <Link className="btn" href="/">Open Following feed <span aria-hidden="true">→</span></Link> : <Link className="btn" href="/setup">Set up an account <span aria-hidden="true">→</span></Link>}
        {viewer?.canWrite ? <span className="welcome-status">Connected on this device</span> : viewer ? <Link className="btn ghost" href="/setup">Connect for posting</Link> : <span className="welcome-status">Read-only browsing works after an account is configured.</span>}
      </div>
    </header>

    <section className="welcome-section" aria-labelledby="welcome-steps-title">
      <div className="welcome-section-heading"><span className="welcome-kicker">THREE EASY STEPS</span><h2 id="welcome-steps-title">Get comfortable</h2></div>
      <div className="welcome-steps">{steps.map((step) => <article className="welcome-step" key={step.number}><span>{step.number}</span><div><h3>{step.title}</h3><p>{step.text}</p></div></article>)}</div>
    </section>

    <section className="welcome-section" aria-labelledby="welcome-explore-title">
      <div className="welcome-section-heading"><span className="welcome-kicker">PICK A PLACE TO START</span><h2 id="welcome-explore-title">Explore Jackcaster</h2></div>
      <div className="welcome-destinations">{destinations.map((item) => <Link className="welcome-destination" href={item.href} key={item.href}><span aria-hidden="true">{item.icon}</span><div><strong>{item.title}</strong><small>{item.text}</small></div><b aria-hidden="true">→</b></Link>)}</div>
    </section>

    <aside className="welcome-privacy"><strong>Your choices stay yours.</strong><p>Feed settings and privacy choices are saved on this device. AI, voice, GIF search, direct messages, and the map are optional. {viewer && <>See <Link href="/me#privacy">Privacy choices</Link> or </>}read the <Link href="https://github.com/wlplease/jackcast/blob/main/SECURITY.md" target="_blank" rel="noreferrer">security notes</Link>.</p></aside>
  </main>;
}
