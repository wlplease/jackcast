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
          <span className="login-portal-status"><i aria-hidden="true" />SELF-HOSTED CLIENT</span>
        </header>
        <aside className="login-deploy" aria-labelledby="login-deploy-title">
          <span className="login-eyebrow">YOUR FARCASTER, YOUR WAY</span>
          <h2 id="login-deploy-title">Your Farcaster, in your own space.</h2>
          <p className="login-deploy-intro"><span>A calm, chronological client you host and control. Browse your feed, follow conversations, and post when you choose.</span></p>
          <a className="login-deploy-button login-deploy-button-top" href={DEPLOY_URL} target="_blank" rel="noreferrer">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2 23 21H1L12 2Z" /></svg>
            Quick deploy to Vercel <span aria-hidden="true">↗</span>
          </a>
          <div className="login-prereq-card"><strong>Ready to deploy?</strong><span>You’ll need a Neynar API key and a private app password. Posting setup is optional.</span><a href="https://github.com/wlplease/jackcast#setup" target="_blank" rel="noreferrer">See setup requirements <span aria-hidden="true">↗</span></a></div>
          <LandingWalkthrough />
          <section className="login-what" aria-labelledby="login-what-title">
            <div className="login-what-heading"><span className="login-eyebrow">THE CLIENT EXAMPLE</span><h3 id="login-what-title">Your feed, your rhythm.</h3></div>
            <article><span aria-hidden="true">↕</span><div><h4>Focused feeds</h4><p>Following, Friends, lists, channels, and more.</p></div></article>
            <article><span aria-hidden="true">✎</span><div><h4>Join the conversation</h4><p>Post, reply, quote, and save drafts on your device.</p></div></article>
            <article><span aria-hidden="true">▣</span><div><h4>Explore</h4><p>Discover Mini Apps, media, and profiles.</p></div></article>
            <p className="login-what-note">An independent, open-source Farcaster client. <a href="https://github.com/wlplease/jackcast/blob/main/SECURITY.md" target="_blank" rel="noreferrer">Security details</a></p>
          </section>
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
            <small className="login-card-note">Private access · Your password stays on this deployment</small>
          </section>
        </div>
        <footer className="login-portal-footer"><span>JACKCASTER PORTAL</span><span>BUILT ON OPEN-SOURCE SELFCASTER <b>↟</b></span><span>YOUR FEED. YOUR RULES.</span></footer>
      </section>
    </main>
  );
}
