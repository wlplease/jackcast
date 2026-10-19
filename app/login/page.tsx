"use client";

import { useActionState } from "react";
import { login } from "@/app/actions";
import { Wordmark } from "@/components/Wordmark";

const DEPLOY_URL = "https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fwlplease%2Fjackcast&project-name=jackcast&repository-name=jackcast&env=NEYNAR_API_KEY,APP_PASSWORD&envDescription=Add%20your%20Neynar%20API%20key%20and%20choose%20a%20private%20password%20for%20your%20own%20Jackcaster%20deployment.&envLink=https%3A%2F%2Fgithub.com%2Fwlplease%2Fjackcast%23setup";

export default function LoginPage() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <main className="login">
      <div className="login-layout">
        <section className="login-card" aria-labelledby="login-title">
          <div className="wordmark"><Wordmark /></div>
          <h1 id="login-title">Welcome back</h1>
          <p className="login-intro">Sign in to this private Jackcaster instance.</p>
          <form action={action}>
            <label className="sr-only" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" placeholder="Your password" autoComplete="current-password" required />
            <button className="btn" type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
            {error && <div className="form-error" role="alert" style={{ textAlign: "center" }}>{error}</div>}
          </form>
        </section>

        <aside className="login-deploy" aria-labelledby="login-deploy-title">
          <span className="login-eyebrow">YOUR OWN FARCASTER CLIENT</span>
          <h2 id="login-deploy-title">Want your own Jackcaster?</h2>
          <p>This login is for the owner of this private instance. To use your own Farcaster account, make a separate deployment with your own Neynar API key and password.</p>
          <ol>
            <li><span>1</span><div><strong>Get your Neynar API key</strong><small>Create one at dev.neynar.com for your own deployment.</small></div></li>
            <li><span>2</span><div><strong>Deploy your GitHub copy</strong><small>Enter the key and choose your private login password in Vercel.</small></div></li>
            <li><span>3</span><div><strong>Connect Farcaster</strong><small>After deploy, finish setup on your own site.</small></div></li>
          </ol>
          <a className="login-deploy-button" href={DEPLOY_URL} target="_blank" rel="noreferrer">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2 23 21H1L12 2Z" /></svg>
            Deploy your own on Vercel <span aria-hidden="true">↗</span>
          </a>
          <a className="login-source-link" href="https://github.com/wlplease/jackcast" target="_blank" rel="noreferrer">View Jackcaster on GitHub <span aria-hidden="true">↗</span></a>
          <small className="login-deploy-note">The Neynar key is a server secret entered in Vercel during deployment. It is not entered on this login page or alongside your Farcaster recovery phrase.</small>
        </aside>
      </div>
    </main>
  );
}
