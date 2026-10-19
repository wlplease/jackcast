"use client";

import { useActionState } from "react";
import { login } from "@/app/actions";
import { LandingWalkthrough } from "@/components/LandingWalkthrough";
import { ShareJackcasterButton } from "@/components/ShareJackcasterButton";
import { CopyIntroLinkButton } from "@/components/CopyIntroLinkButton";

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
        <aside className="login-deploy" aria-labelledby="login-deploy-title">
          <span className="login-eyebrow">A PERSONAL FARCASTER CLIENT</span>
          <h2 id="login-deploy-title">Make room for the parts of Farcaster you care about.</h2>
          <p className="login-deploy-intro"><span>Jackcaster is an open-source Farcaster client for one owner, built on GenuineJack&apos;s Selfcaster. Follow a chronological timeline, organize feeds around people and topics, review posts sent from Jackcaster, and explore conversations, media, and Mini Apps. This is the maintainer&apos;s private instance; deploy your own copy to connect your account.</span></p>
          <LandingWalkthrough />
          <section className="login-what" aria-labelledby="login-what-title">
            <div className="login-what-heading"><span className="login-eyebrow">THE CLIENT, AT A GLANCE</span><h3 id="login-what-title">A more personal way to follow the network</h3></div>
            <article><span aria-hidden="true">↕</span><div><h4>Feeds with a purpose</h4><p>Keep Following chronological. Give Friends, custom lists, Top Accounts, channels, Recasts, and your Jackcaster-sent posts their own views. Reorder tabs and tuck away feeds you rarely use.</p></div></article>
            <article><span aria-hidden="true">✎</span><div><h4>Read, reply, and create</h4><p>Compose posts, replies, quotes, and threads; keep drafts on your device and browse posts, profiles, and media.</p></div></article>
            <article><span aria-hidden="true">▣</span><div><h4>Explore beyond the feed</h4><p>Discover Mini Apps, play supported media inline, review profile activity, and choose a soundtrack while you browse.</p></div></article>
            <article><span aria-hidden="true">⚙</span><div><h4>Your copy, your choices</h4><p>Each deployment is for one owner. Feed preferences stay in that browser. Gemini catch-up, audio, GIF search, the map, and paid profile artwork are optional and may use separate services or incur costs.</p></div></article>
            <p className="login-what-note">Jackcaster is an independent fork, not an official Selfcaster release. It keeps the original project&apos;s MIT license and attribution. Read the <a href="https://github.com/wlplease/jackcast#setup" target="_blank" rel="noreferrer">setup guide</a> and <a href="https://github.com/wlplease/jackcast/blob/main/SECURITY.md" target="_blank" rel="noreferrer">security notes</a>.</p>
          </section>
          <section className="login-share" aria-labelledby="login-share-title">
            <div><span className="login-eyebrow">PASS IT ALONG</span><h3 id="login-share-title">Tell your corner of Farcaster</h3><p>Choose an intro, make it sound like you, then share it with the Jackcaster link attached.</p></div>
            <div className="login-share-actions"><ShareJackcasterButton full /><CopyIntroLinkButton /></div>
          </section>
          <div className="login-deploy-divider"><span>YOUR OWN COPY · 3 STEPS</span><i aria-hidden="true" /></div>
          <ol>
            <li><span>1</span><div><strong>Deploy your copy</strong><small>Scroll to the Vercel button below and click it. Add your Neynar API key and a private app password, scroll down, then select <b>Deploy</b>.</small></div></li>
            <li><span>2</span><div><strong>Connect Farcaster</strong><small>After launch, open your app&apos;s Setup and approve its Farcaster signer. Setup currently asks for the Farcaster account custody-wallet phrase to sign one request in your browser. This is separate from the app&apos;s optional wallet-connect flow. Never enter the phrase in Vercel.</small></div></li>
            <li><span>3</span><div><strong>Add optional extras</strong><small>Set up Gemini AI or shared GIF search (GIPHY plus Upstash) in Vercel when you want them.</small></div></li>
          </ol>
          <a className="login-deploy-button" href={DEPLOY_URL} target="_blank" rel="noreferrer">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2 23 21H1L12 2Z" /></svg>
            Deploy to Vercel <span aria-hidden="true">↗</span>
          </a>
          <div className="login-source-links">
            <a href="https://github.com/wlplease/jackcast" target="_blank" rel="noreferrer">Jackcaster source <span aria-hidden="true">↗</span></a>
            <a href="https://github.com/GenuineJack/selfcaster" target="_blank" rel="noreferrer">Selfcaster original <span aria-hidden="true">↗</span></a>
          </div>
          <small className="login-deploy-note">Only enter your recovery phrase on the Jackcaster deployment you control—not on the Vercel form or an unfamiliar site.</small>
        </aside>
        <div className="login-layout">
          <section className="login-card" aria-labelledby="login-title">
            <div className="login-card-terminalbar"><span><i aria-hidden="true" />INSTANCE OWNER</span><small>PRIVATE</small></div>
            <span className="login-card-kicker">OWNER SIGN-IN · NOT FOR DEPLOYERS</span>
            <h1 id="login-title">Owner sign-in</h1>
            <p className="login-intro">This sign-in is only for the owner of this Jackcaster instance.</p>
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
