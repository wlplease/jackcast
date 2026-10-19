"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { mnemonicToAccount } from "viem/accounts";
import { SIGNED_KEY_REQUEST_DOMAIN, SIGNED_KEY_REQUEST_TYPES } from "@/lib/signed-key-request";
import { checkSigner, disconnectDevice, findAccount, registerSigner, startSigner } from "./actions";

type Connected = { fid: number; signerUuid: string; username?: string };

const PENDING_KEY = "selfcaster:pending-signer";
const QR_OPTS = { margin: 1, width: 440, color: { dark: "#0d0d0d", light: "#ffffff" } };

function clearPending() {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {}
}

type Step =
  | { kind: "intro" }
  | { kind: "phrase" }
  | { kind: "working"; label: string }
  | { kind: "approve"; signerUuid: string; approvalUrl: string; qr: string; sponsored: boolean }
  | { kind: "done"; fid: number; signerUuid: string; username?: string; fresh: boolean };

function Steps({ at }: { at: number }) {
  const labels = ["Sign", "Approve", "Done"];
  return (
    <ol className="steps" aria-label="Progress">
      {labels.map((l, i) => (
        <li key={l} className={i < at ? "done" : i === at ? "now" : ""} aria-current={i === at ? "step" : undefined}>
          <span>{i + 1}</span>
          {l}
        </li>
      ))}
    </ol>
  );
}

export function SetupFlow({ connected, hasApiKey }: { connected: Connected | null; hasApiKey: boolean }) {
  const [step, setStep] = useState<Step>(
    connected
      ? { kind: "done", fid: connected.fid, signerUuid: connected.signerUuid, username: connected.username, fresh: false }
      : { kind: "intro" }
  );
  const [error, setError] = useState<string | null>(null);
  const phraseRef = useRef<HTMLInputElement>(null);
  const signingRef = useRef(false);

  useEffect(() => {
    const clearPhrase = () => {
      if (phraseRef.current) phraseRef.current.value = "";
    };
    window.addEventListener("pagehide", clearPhrase);
    window.addEventListener("beforeunload", clearPhrase);
    document.addEventListener("visibilitychange", clearPhrase);
    return () => {
      clearPhrase();
      window.removeEventListener("pagehide", clearPhrase);
      window.removeEventListener("beforeunload", clearPhrase);
      document.removeEventListener("visibilitychange", clearPhrase);
    };
  }, []);

  // On a phone you bounce out to the Farcaster app to approve. iOS sometimes unloads the
  // browser tab while you're gone, so keep the pending request in this tab's session storage
  // and pick it back up when the page comes back. (No phrase in here, just the request id.)
  useEffect(() => {
    if (connected) return;
    let pending: { signerUuid: string; approvalUrl: string; sponsored: boolean } | null = null;
    try {
      pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) || "null");
    } catch {}
    if (!pending?.signerUuid) return;
    const p = pending;
    QRCode.toDataURL(p.approvalUrl, QR_OPTS).then((qr) => setStep({ kind: "approve", ...p, qr }));
  }, [connected]);

  // Poll for approval, and check right away when you switch back to this tab.
  useEffect(() => {
    if (step.kind !== "approve") return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;
    const tick = async () => {
      if (stop || inFlight) return;
      inFlight = true;
      clearTimeout(timer);
      const res = await checkSigner(step.signerUuid);
      inFlight = false;
      if (stop) return;
      if (!res.ok) setError(res.error);
      else if (res.status === "approved" && res.fid) {
        clearPending();
        setStep({ kind: "done", fid: res.fid, signerUuid: step.signerUuid, username: res.username, fresh: true });
        return;
      } else if (res.status === "revoked") {
        clearPending();
        setError("That request was rejected in the Farcaster app. Start over to try again.");
        return;
      }
      timer = setTimeout(tick, 2500);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    timer = setTimeout(tick, 2500);
    return () => {
      stop = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [step]);

  async function sign() {
    if (signingRef.current) return;
    signingRef.current = true;
    setError(null);
    // Read straight from the input and clear the DOM field before doing any work.
    // The phrase is never put in React state, sent to the server, or stored.
    let raw = phraseRef.current?.value ?? "";
    if (phraseRef.current) phraseRef.current.value = "";
    let phrase = raw.trim().toLowerCase().split(/\s+/).join(" ");
    raw = "";
    let account: ReturnType<typeof mnemonicToAccount> | undefined;
    try {
      account = mnemonicToAccount(phrase);
    } catch {
      setError("That doesn't look like a valid 12 or 24 word recovery phrase.");
      phrase = "";
      signingRef.current = false;
      return;
    }
    phrase = "";

    try {
      setStep({ kind: "working", label: "Finding your account" });
      const acct = await findAccount(account.address);
      if (!acct.ok) {
        setError(acct.error);
        setStep({ kind: "phrase" });
        return;
      }

      setStep({ kind: "working", label: `Requesting a key for @${acct.username}` });
      const signer = await startSigner();
      if (!signer.ok) {
        setError(signer.error);
        setStep({ kind: "phrase" });
        return;
      }

      const deadline = Math.floor(Date.now() / 1000) + 86400;
      const signature = await account.signTypedData({
        domain: SIGNED_KEY_REQUEST_DOMAIN,
        types: SIGNED_KEY_REQUEST_TYPES,
        primaryType: "SignedKeyRequest",
        message: {
          requestFid: BigInt(acct.fid),
          key: signer.publicKey as `0x${string}`,
          deadline: BigInt(deadline),
        },
      });
      account = undefined;

      setStep({ kind: "working", label: "Registering with Neynar" });
      const reg = await registerSigner({ signerUuid: signer.signerUuid, appFid: acct.fid, deadline, signature });
      if (!reg.ok) {
        setError(reg.error);
        setStep({ kind: "phrase" });
        return;
      }

      const pending = { signerUuid: signer.signerUuid, approvalUrl: reg.approvalUrl, sponsored: reg.sponsored };
      try {
        sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
      } catch {}
      const qr = await QRCode.toDataURL(reg.approvalUrl, QR_OPTS);
      setStep({ kind: "approve", ...pending, qr });
    } catch {
      setError("Setup could not finish. Your phrase was cleared; please start again.");
      setStep({ kind: "phrase" });
    } finally {
      account = undefined;
      raw = "";
      phrase = "";
      signingRef.current = false;
    }
  }

  if (!hasApiKey) {
    return (
      <section className="setup-card">
        <h1>One thing first</h1>
        <p>
          Add <code>NEYNAR_API_KEY</code> to your environment variables (Vercel, Settings, Environment Variables), redeploy,
          then come back here.
        </p>
        <p className="setup-security-note"><strong>For the instance operator:</strong> Neynar is a server key. Don’t paste it into this page or share it with users.</p>
        <Link className="quiet setup-skip" href="/">Return to Jackcaster</Link>
      </section>
    );
  }

  if (step.kind === "intro") {
    return (
      <section className="setup-card">
        <span className="setup-eyebrow">FARCASTER, ON YOUR TERMS</span>
        <h1>Browse first. Connect when you’re ready.</h1>
        <p>
          Jackcaster can load a read-only Farcaster feed without a signer. Connect an account only when you want to post, like, or reply.
        </p>
        <p className="setup-upstream-credit">Jackcaster is an independent fork of <a href="https://selfcaster.xyz/" target="_blank" rel="noreferrer">Selfcaster</a>, the original open-source Farcaster client by <a href="https://farcaster.xyz/genuinejack" target="_blank" rel="noreferrer">@genuinejack</a>.</p>
        <div className="setup-security-note"><strong>Before you begin:</strong> if this deployment has a read-only Farcaster ID configured, you can browse without connecting a signer. Otherwise, the instance operator needs to configure <code>MY_FID</code> before a read-only feed is available.</div>
        <div className="setup-options">
          <div><strong>Neynar service key</strong><span>Required by the instance operator for Farcaster data and posting setup. It stays server-side; users should never enter it here.</span></div>
          <div><strong>AI and voice keys</strong><span>Google Gemini and ElevenLabs are optional and configured by the instance operator. They are not needed to browse or post.</span></div>
          <div><strong>Farcaster connection</strong><span>Optional posting access. You can connect later from Settings → Account and connection.</span></div>
          <div><strong>GIF search</strong><span>Browse the built-in GIF library with a shared cooldown. You do not need to create or enter a GIPHY account key.</span></div>
        </div>
        <div className="setup-security-note" role="note"><strong>Security warning: read this before continuing.</strong> Posting setup asks for the recovery phrase for your Farcaster account&apos;s custody wallet to sign one request in this browser. It is not sent to Jackcaster&apos;s server, but any webpage can be risky, and that phrase may control onchain assets. Continue only on a deployment you control, using a trusted, updated device and browser. A compromised page, browser extension, or device could still expose it. Read-only browsing needs no phrase. If you are unsure what the phrase controls, do not enter it.</div>
        <ol className="how">
          <li>Start a Farcaster signer request for this device.</li>
          <li>Review and approve that request in the Farcaster app.</li>
          <li>Revoke Jackcaster’s signer access anytime in Farcaster settings.</li>
        </ol>
        <button className="btn wide" onClick={() => setStep({ kind: "phrase" })}>
          Continue to posting setup
        </button>
        <Link className="quiet setup-skip" href="/">
          Skip connection and browse read-only
        </Link>
      </section>
    );
  }

  if (step.kind === "phrase" || step.kind === "working") {
    const working = step.kind === "working";
    return (
      <section className="setup-card">
        <Steps at={0} />
        <h1>Sign the request</h1>
        <p>
          <strong>Only continue if this is your own deployment and you trust this device and browser.</strong> This optional flow uses the recovery phrase for your Farcaster account&apos;s custody wallet to sign one request in this browser, then clears the input. Only the signature is sent to the server. That phrase may control onchain assets; a compromised page or browser extension could expose it. This is separate from the app&apos;s wallet-connect flow. If you are unsure what the phrase controls, leave this page and browse read-only.
        </p>
        <label className="sr-only" htmlFor="phrase">
          Recovery phrase
        </label>
        <input
          id="phrase"
          ref={phraseRef}
          type="password"
          placeholder="twelve or twenty four words"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-1p-ignore
          data-lpignore="true"
          disabled={working}
          onKeyDown={(e) => {
            if (e.key === "Enter") sign();
          }}
        />
        <div className="safety">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          <span>
            Signed in this browser, then cleared. The phrase is never sent to the server or saved. Only the signature
            leaves this page.
            <em className="only-phone"> If you copied it from the Farcaster app, copy something else afterward so it isn&apos;t left on your clipboard.</em>
          </span>
        </div>
        <button className="btn wide" onClick={sign} disabled={working}>
          {working ? step.label + "…" : "Sign & continue"}
        </button>
        {error && <div className="form-error">{error}</div>}
      </section>
    );
  }

  if (step.kind === "approve") {
    return (
      <section className="setup-card">
        <Steps at={1} />
        <h1>Approve in Farcaster</h1>
        <p className="only-desktop">Scan this with your phone&apos;s camera, then approve in the Farcaster app.</p>
        <p className="only-phone">
          Tap below to open the Farcaster app and approve. Then come back to this tab. It finishes on its own.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="qr only-desktop" src={step.qr} alt="QR code to approve this app in Farcaster" />
        {/* New tab so this page (and the pending request) is still here when you come back */}
        <a className="btn wide" href={step.approvalUrl} target="_blank" rel="noreferrer">
          Open in Farcaster
        </a>
        <div className="waiting">
          <span className="pulse" aria-hidden="true" />
          Waiting for approval
          <small>{step.sponsored ? "Onchain fee covered by Neynar." : "The Farcaster app may ask you to cover a small fee."}</small>
        </div>
        {error && (
          <div className="form-error">
            {error}{" "}
            <button className="linkish" onClick={() => { clearPending(); setError(null); setStep({ kind: "phrase" }); }}>
              Start over
            </button>
          </div>
        )}
      </section>
    );
  }

  // done
  return (
    <section className="setup-card">
      <Steps at={3} />
      <h1>{step.fresh ? "You're connected" : "Connected"}</h1>
      <p>
        {step.username ? <>Posting as <b>@{step.username}</b></> : <>Posting as fid {step.fid}</>} on this device.
      </p>
      <div className="env-box">
        <h2>Your account stays yours</h2>
        <p>The Neynar API key connects Jackcast to Farcaster. This device-specific signer chooses your posting account; Jackcast never uses a deployment-wide signer for your casts. Connect separately on each device.</p>
      </div>

      <Link className="btn wide" href="/">
        Go to my feed
      </Link>
      {connected && !step.fresh && (
        <button
          className="quiet"
          onClick={async () => {
            await disconnectDevice();
            setStep({ kind: "intro" });
          }}
        >
          Disconnect this device
        </button>
      )}
    </section>
  );
}
