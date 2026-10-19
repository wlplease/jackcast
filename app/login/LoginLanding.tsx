"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login } from "@/app/actions";
import { LandingWalkthrough } from "@/components/LandingWalkthrough";

const DEPLOY_URL = "https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fwlplease%2Fjackcast&project-name=jackcast&repository-name=jackcast&env=NEYNAR_API_KEY,APP_PASSWORD&envDescription=Add%20your%20Neynar%20API%20key%20and%20choose%20a%20private%20password%20for%20your%20own%20Jackcaster%20deployment.&envLink=https%3A%2F%2Fgithub.com%2Fwlplease%2Fjackcast%23setup";

export default function LoginLanding() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <main className="login">
      <section className="login-portal" aria-label="Jackcaster portal">
        <header className="login-portal-bar">
          <span className="login-portal-system"><i aria-hidden="true">↟</i><span>JACKCASTER <b>/</b> PERSONAL CLIENT</span></span>
          <span className="login-portal-status"><i aria-hidden="true" />PRIVATE INSTANCE</span>
        </header>
        <aside className="login-deploy" aria-labelledby="login-deploy-title">
          <span className="login-eyebrow">YOUR FARCASTER, YOUR WAY</span>
          <h2 id="login-deploy-title">A calmer home for your Farcaster conversations.</h2>
          <p className="login-deploy-intro"><span>An open-source Farcaster client for chronological feeds, focused lists, conversations, and Mini Apps. This is a private demo; deploy your own copy to use Jackcaster.</span></p>
          <a className="login-deploy-button login-deploy-button-top" href={DEPLOY_URL} target="_blank" rel="noreferrer">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2 23 21H1L12 2Z" /></svg>
            Quick deploy to Vercel <span aria-hidden="true">↗</span>
          </a>
          <LandingWalkthrough />
          <section className="login-what" aria-labelledby="login-what-title">
            <div className="login-what-heading"><span className="login-eyebrow">MADE TO FIT YOUR FLOW</span><h3 id="login-what-title">Your feed, your rhythm.</h3></div>
            <article><span aria-hidden="true">↕</span><div><h4>Focused feeds</h4><p>Following, Friends, lists, channels, and more.</p></div></article>
            <article><span aria-hidden="true">✎</span><div><h4>Join the conversation</h4><p>Post, reply, quote, and save drafts on your device.</p></div></article>
            <article><span aria-hidden="true">▣</span><div><h4>Explore</h4><p>Discover Mini Apps, media, and profiles.</p></div></article>
            <p className="login-what-note">An independent, open-source fork of Selfcaster. <a href="https://github.com/wlplease/jackcast#setup" target="_blank" rel="noreferrer">Setup</a> · <a href="https://github.com/wlplease/jackcast/blob/main/SECURITY.md" target="_blank" rel="noreferrer">Security</a></p>
          </section>
          <div className="login-deploy-divider"><span>GET STARTED</span><i aria-hidden="true" /></div>
          <ol>
            <li><span>1</span><div><strong>Deploy your copy</strong><small>Add your Neynar API key and choose a private app password.</small></div></li>
            <li><span>2</span><div><strong>Browse, then connect to post</strong><small>Posting is optional. Follow the setup security guidance; never enter a recovery phrase in Vercel.</small></div></li>
          </ol>
          <a className="login-deploy-button" href={DEPLOY_URL} target="_blank" rel="noreferrer">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2 23 21H1L12 2Z" /></svg>
            Deploy to Vercel <span aria-hidden="true">↗</span>
          </a>
          <div className="login-source-links">
            <a href="https://github.com/wlplease/jackcast" target="_blank" rel="noreferrer">Jackcaster source <span aria-hidden="true">↗</span></a>
            <a href="https://github.com/GenuineJack/selfcaster" target="_blank" rel="noreferrer">Selfcaster original <span aria-hidden="true">↗</span></a>
          </div>
            <small className="login-deploy-note">Optional services and their costs are described in the setup guide.</small>
        </aside>
        <div className="login-layout">
          <section className="login-card" aria-labelledby="login-title">
            <div className="login-card-terminalbar"><span><i aria-hidden="true" />INSTANCE OWNER</span><small>PRIVATE</small></div>
            <span className="login-card-kicker">FOR THE OWNER OF THIS INSTANCE</span>
            <h1 id="login-title">Owner sign-in</h1>
            <p className="login-intro">Sign in to the maintainer’s private Jackcaster instance.</p>
            <form action={action}>
              <label className="sr-only" htmlFor="password">Password</label>
              <input id="password" name="password" type="password" placeholder="Your password" autoComplete="current-password" required />
              <button className="btn" type="submit" disabled={pending}>{pending ? "Signing in…" : "Enter Jackcaster"}<span aria-hidden="true">↗</span></button>
              {error && <div className="form-error" role="alert" style={{ textAlign: "center" }}>{error}</div>}
            </form>
            <Link className="login-setup-link" href="https://github.com/wlplease/jackcast#setup" target="_blank">Deploy your own Jackcaster <span aria-hidden="true">↗</span></Link>
            <small className="login-card-note">Private access · Your password stays on this deployment</small>
          </section>
        </div>
        <footer className="login-portal-footer"><span>JACKCASTER PORTAL</span><span>BUILT ON OPEN-SOURCE SELFCASTER <b>↟</b></span><span>YOUR FEED. YOUR RULES.</span></footer>
      </section>
    </main>
  );
}
