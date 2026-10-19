"use client";

import { useActionState } from "react";
import { login } from "@/app/actions";
import { Wordmark } from "@/components/Wordmark";

const DEPLOY_URL = "https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fwlplease%2Fjackcast&project-name=jackcast&repository-name=jackcast&env=NEYNAR_API_KEY,APP_PASSWORD&envDescription=Add%20your%20Neynar%20API%20key%20and%20choose%20a%20private%20password%20for%20your%20own%20Jackcaster%20deployment.&envLink=https%3A%2F%2Fgithub.com%2Fwlplease%2Fjackcast%23setup";

export default function LoginPage() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <main className="login">
      <section className="login-portal" aria-label="Jackcaster portal">
        <header className="login-portal-bar">
          <span className="login-portal-system"><i aria-hidden="true">↟</i><span>JACKCASTER <b>/</b> PERSONAL CLIENT</span></span>
          <span className="login-portal-status"><i aria-hidden="true" />PRIVATE INSTANCE</span>
        </header>
        <div className="login-layout">
          <section className="login-card" aria-labelledby="login-title">
            <div className="wordmark"><Wordmark /></div>
            <span className="login-card-kicker">MEMBER ACCESS <b>•</b> 01</span>
            <h1 id="login-title">Welcome back</h1>
            <p className="login-intro">Sign in to your private Jackcaster portal.</p>
            <form action={action}>
              <label className="sr-only" htmlFor="password">Password</label>
              <input id="password" name="password" type="password" placeholder="Your password" autoComplete="current-password" required />
              <button className="btn" type="submit" disabled={pending}>{pending ? "Signing in…" : "Enter Jackcaster"}<span aria-hidden="true">↗</span></button>
              {error && <div className="form-error" role="alert" style={{ textAlign: "center" }}>{error}</div>}
            </form>
            <small className="login-card-note">Private access · Your password stays on this deployment</small>
          </section>

          <aside className="login-deploy" aria-labelledby="login-deploy-title">
            <span className="login-eyebrow">OPEN SOURCE · YOUR OWN RULES</span>
            <h2 id="login-deploy-title">A calmer Farcaster starts here.</h2>
            <p>Chronological feeds, your people, and useful tools in one personal client. Make a separate deployment to connect your own Farcaster account.</p>
            <div className="login-feature-grid" aria-label="Jackcaster features">
              <span><b>01</b><strong>Feeds in order</strong><small>No engagement ranking</small></span>
              <span><b>02</b><strong>Your circles</strong><small>Friends and custom feeds</small></span>
              <span><b>03</b><strong>More to explore</strong><small>Mini Apps, media, and tools</small></span>
            </div>
            <div className="login-deploy-divider"><span>LAUNCH YOUR OWN PORTAL</span><i aria-hidden="true" /></div>
            <ol>
              <li><span>1</span><div><strong>Add your Neynar API key</strong><small>Create one at dev.neynar.com and add it privately in Vercel.</small></div></li>
              <li><span>2</span><div><strong>Deploy your GitHub copy</strong><small>Choose a private password, then connect Farcaster in setup.</small></div></li>
            </ol>
            <a className="login-deploy-button" href={DEPLOY_URL} target="_blank" rel="noreferrer">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2 23 21H1L12 2Z" /></svg>
              Deploy your own on Vercel <span aria-hidden="true">↗</span>
            </a>
            <div className="login-source-links">
              <a href="https://github.com/wlplease/jackcast" target="_blank" rel="noreferrer">Jackcaster source <span aria-hidden="true">↗</span></a>
              <a href="https://github.com/GenuineJack/selfcaster" target="_blank" rel="noreferrer">Selfcaster original <span aria-hidden="true">↗</span></a>
            </div>
            <small className="login-deploy-note">Your Neynar key is a server secret entered in Vercel. Never enter a recovery phrase here.</small>
          </aside>
        </div>
        <footer className="login-portal-footer"><span>JACKCASTER PORTAL</span><span>BUILT ON OPEN-SOURCE SELFCASTER <b>↟</b></span><span>YOUR FEED. YOUR RULES.</span></footer>
      </section>
    </main>
  );
}
