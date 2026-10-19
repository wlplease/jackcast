"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { base } from "@/lib/base-chain";
import { createPublicClient, encodeFunctionData, formatUnits, http, isAddress, toHex, type Address, type EIP1193Provider, type Hex } from "viem";
import { ANIMATION_CREDITS_ADDRESS, animationCreditsAbi, BASE_USDC_ADDRESS, usdcAbi } from "@/lib/animation-credits";

type EthereumWindow = Window & { ethereum?: EIP1193Provider };
type PendingAnimation = { requestId: string; walletAddress: Address; mode: "animate" | "upgrade"; provider: "google" };
type SavedPreview = { mediaUrl: string; mediaType: "image" | "video"; requestId: string };
const baseClient = createPublicClient({ chain: base, transport: http("https://mainnet.base.org") });
const USDC_DECIMALS = 6;

async function getProvider(): Promise<EIP1193Provider | undefined> {
  try { if (await sdk.isInMiniApp()) return await sdk.wallet.getEthereumProvider() as EIP1193Provider; }
  catch { /* Fall back to an installed browser wallet. */ }
  return (window as EthereumWindow).ethereum;
}

async function connectBase(provider: EIP1193Provider, requestAccess = true): Promise<Address> {
  let chainId = await provider.request({ method: "eth_chainId" }) as string;
  if (chainId?.toLowerCase() !== "0x2105") {
    try { await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x2105" }] }); }
    catch (error) {
      if ((error as { code?: number }).code !== 4902) throw error;
      await provider.request({ method: "wallet_addEthereumChain", params: [{ chainId: "0x2105", chainName: "Base", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: ["https://mainnet.base.org"], blockExplorerUrls: ["https://basescan.org"] }] });
    }
    chainId = await provider.request({ method: "eth_chainId" }) as string;
  }
  if (chainId?.toLowerCase() !== "0x2105") throw new Error("Switch your wallet to Base before continuing.");
  const accounts = await provider.request({ method: requestAccess ? "eth_requestAccounts" : "eth_accounts" }) as string[];
  if (!accounts?.[0] || !isAddress(accounts[0])) throw new Error("Select a valid wallet account.");
  return accounts[0] as Address;
}

function walletError(error: unknown, fallback: string): string {
  const reason = error as { message?: string; code?: number | string };
  if (reason?.code === -32002 || /wallet_requestPermissions|requestPermissions.*pending|already pending|request already pending/i.test(reason?.message ?? "")) {
    return "A wallet request is already open. Finish or close it, then try again.";
  }
  if (reason?.code === 4001) return "Wallet request canceled.";
  return reason?.message || fallback;
}

async function send(provider: EIP1193Provider, from: Address, to: Address, data: Hex): Promise<Hex> {
  const hash = await provider.request({ method: "eth_sendTransaction", params: [{ from, to, data, value: "0x0" }] }) as string;
  if (!/^0x[0-9a-f]{64}$/i.test(hash)) throw new Error("The wallet returned an invalid transaction hash.");
  const receipt = await baseClient.waitForTransactionReceipt({ hash: hash as Hex, timeout: 120_000 });
  if (receipt.status !== "success") throw new Error("The transaction reverted on Base.");
  return hash as Hex;
}

export function ProfileMediaMaker({ fid, currentPfpUrl, onUse }: { fid: number; currentPfpUrl: string; onUse: (url: string) => void }) {
  const [prompt, setPrompt] = useState("");
  const [credits, setCredits] = useState<bigint | null>(null);
  const [price, setPrice] = useState<bigint | null>(null);
  const [pack, setPack] = useState<number | null>(null);
  const [walletAddress, setWalletAddress] = useState<Address | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState("");
  const [generatedType, setGeneratedType] = useState<"image" | "video">("image");
  const [generatedRequestId, setGeneratedRequestId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [introOpen, setIntroOpen] = useState(false);
  const [pendingAnimation, setPendingAnimation] = useState<PendingAnimation | null>(null);
  const busyRef = useRef(false);
  const currentPfpIsMp4 = /\.mp4(?:$|[?#])/i.test(currentPfpUrl);
  const currentPfpIsWebm = /\.webm(?:$|[?#])/i.test(currentPfpUrl);

  useEffect(() => {
    try {
      const key = `jackcaster:grok-profile-intro:v1:${fid}`;
      if (!localStorage.getItem(key)) setIntroOpen(true);
    } catch { setIntroOpen(true); }
  }, [fid]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`jackcaster:profile-preview:v1:${fid}`);
      if (saved) {
        const preview = JSON.parse(saved) as Partial<SavedPreview>;
        const safeUrl = typeof preview.mediaUrl === "string" && (preview.mediaUrl.startsWith("https://") || preview.mediaUrl.startsWith("/i/pfp/"));
        if (safeUrl && (preview.mediaType === "image" || preview.mediaType === "video") && typeof preview.requestId === "string") {
          setGeneratedUrl(preview.mediaUrl!);
          setGeneratedType(preview.mediaType);
          setGeneratedRequestId(preview.requestId);
        }
      }
    } catch { /* A saved preview is a convenience; bad local data must not block editing. */ }
  }, [fid]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`jackcaster:grok-pending:v1:${fid}`);
      if (!saved) return;
      const value = JSON.parse(saved) as Partial<PendingAnimation>;
      if (value.provider === "google" && (value.mode === "animate" || value.mode === "upgrade") && typeof value.requestId === "string" && /^0x[0-9a-f]{64}$/i.test(value.requestId)
        && typeof value.walletAddress === "string" && isAddress(value.walletAddress)) {
        setPendingAnimation({ requestId: value.requestId, walletAddress: value.walletAddress, mode: value.mode, provider: "google" });
      } else localStorage.removeItem(`jackcaster:grok-pending:v1:${fid}`);
    } catch { /* Pending jobs are a convenience; corrupt local state should not block the studio. */ }
  }, [fid]);

  function savePendingAnimation(value: PendingAnimation | null) {
    setPendingAnimation(value);
    try {
      const key = `jackcaster:grok-pending:v1:${fid}`;
      if (value) localStorage.setItem(key, JSON.stringify(value));
      else localStorage.removeItem(key);
    } catch { /* The active generation can continue even when local storage is unavailable. */ }
  }

  function saveGeneratedPreview(preview: SavedPreview) {
    setGeneratedUrl(preview.mediaUrl);
    setGeneratedType(preview.mediaType);
    setGeneratedRequestId(preview.requestId);
    try { localStorage.setItem(`jackcaster:profile-preview:v1:${fid}`, JSON.stringify(preview)); }
    catch { /* Keep the in-page preview even if the browser cannot persist it. */ }
  }

  async function waitForAnimation(pending: PendingAnimation) {
    const query = new URLSearchParams({ requestId: pending.requestId, walletAddress: pending.walletAddress });
    const deadline = Date.now() + 10 * 60_000;
    let pollDelay = 5_000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => window.setTimeout(resolve, pollDelay));
      setMessage("Google is rendering your animation… You can leave and resume this job later.");
      let poll: Response;
      try {
        poll = await fetch(`/api/profile-media/profile-image?${query}`, { cache: "no-store" });
      } catch {
        pollDelay = Math.min(30_000, pollDelay * 2);
        setMessage("Connection interrupted while checking Google. Your job and credit are saved; Jackcaster will retry automatically.");
        continue;
      }
      let result: { processing?: boolean; mediaUrl?: string; mediaType?: "image" | "video"; requestId?: string; error?: string };
      try { result = await poll.json() as typeof result; }
      catch {
        pollDelay = Math.min(30_000, pollDelay * 2);
        setMessage("The status response was incomplete. Your job and credit are saved; Jackcaster will retry automatically.");
        continue;
      }
      if (poll.status === 202 && result.processing) {
        pollDelay = Math.min(15_000, pollDelay + 2_500);
        continue;
      }
      if (poll.status === 503 && /\b429\b|rate limit|temporarily unavailable/i.test(result.error || "") && !/0 requests per day|Free Tier/i.test(result.error || "")) {
        pollDelay = Math.min(30_000, Math.max(10_000, pollDelay * 2));
        setMessage("Google is briefly rate-limiting status checks. Your job and credit are saved; Jackcaster will retry automatically.");
        continue;
      }
      // Keep the saved job resumable, but surface provider/configuration errors
      // instead of hiding them behind ten minutes of repeated polling.
      if (poll.status === 503) throw new Error(result.error || "Google could not check the saved animation. Resume it later; no new credit is needed.");
      if (!poll.ok || !result.mediaUrl || result.mediaType !== "video") {
        savePendingAnimation(null);
        throw new Error(result.error || "Google could not complete this animation. The onchain credit was spent for this attempt.");
      }
      savePendingAnimation(null);
      saveGeneratedPreview({ mediaUrl: result.mediaUrl, mediaType: "video", requestId: result.requestId || pending.requestId });
      setMessage("Animation ready. Preview it below, then choose whether to use it on your profile.");
      return;
    }
    setMessage("This animation is taking longer than expected. The job is saved; resume it here later. Don’t spend another credit for this job.");
  }

  async function resumeAnimation() {
    if (!pendingAnimation || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try { await waitForAnimation(pendingAnimation); }
    catch (error) { setMessage(walletError(error, "Could not resume the animation.")); }
    finally { busyRef.current = false; setBusy(false); }
  }

  function closeIntro(openStudio = false) {
    try { localStorage.setItem(`jackcaster:grok-profile-intro:v1:${fid}`, "seen"); } catch {}
    setIntroOpen(false);
    if (openStudio) window.setTimeout(() => document.getElementById("grok-profile-studio")?.scrollIntoView({ behavior: "smooth", block: "center" }), 30);
  }

  const refresh = useCallback(async (address?: Address) => {
    const provider = await getProvider();
    if (!provider) throw new Error("Open Jackcaster in Farcaster or connect a compatible Base wallet.");
    const account = await connectBase(provider, !address);
    if (address && account.toLowerCase() !== address.toLowerCase()) throw new Error("The connected wallet changed. Refresh the credit balance before continuing.");
    const [balance, currentPrice, paid, bonus] = await Promise.all([
      baseClient.readContract({ address: ANIMATION_CREDITS_ADDRESS, abi: animationCreditsAbi, functionName: "creditsOf", args: [account] }),
      baseClient.readContract({ address: ANIMATION_CREDITS_ADDRESS, abi: animationCreditsAbi, functionName: "priceUSDC" }),
      baseClient.readContract({ address: ANIMATION_CREDITS_ADDRESS, abi: animationCreditsAbi, functionName: "paidCreditsPerPurchase" }),
      baseClient.readContract({ address: ANIMATION_CREDITS_ADDRESS, abi: animationCreditsAbi, functionName: "bonusCreditsPerPurchase" }),
    ]);
    setWalletAddress(account);
    setCredits(balance);
    setPrice(currentPrice);
    setPack(Number(paid) + Number(bonus));
    return { provider, account, balance, currentPrice };
  }, []);

  async function buy() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true); setMessage("");
    try {
      const state = await refresh(walletAddress ?? undefined);
      const allowance = await baseClient.readContract({ address: BASE_USDC_ADDRESS, abi: usdcAbi, functionName: "allowance", args: [state.account, ANIMATION_CREDITS_ADDRESS] });
      if (allowance < state.currentPrice) {
        setMessage(`Approve ${formatUnits(state.currentPrice, USDC_DECIMALS)} USDC in your wallet. Jackcaster requests only this exact purchase amount.`);
        await send(state.provider, state.account, BASE_USDC_ADDRESS, encodeFunctionData({ abi: usdcAbi, functionName: "approve", args: [ANIMATION_CREDITS_ADDRESS, state.currentPrice] }));
      }
      setMessage("Confirm the credit purchase in your wallet…");
      const hash = await send(state.provider, state.account, ANIMATION_CREDITS_ADDRESS, encodeFunctionData({ abi: animationCreditsAbi, functionName: "buyCredits" }));
      await refresh(state.account);
      setMessage(`Purchase confirmed on Base. View transaction on BaseScan: ${hash}`);
    } catch (error) { setMessage(walletError(error, "Could not buy credits.")); }
    finally { busyRef.current = false; setBusy(false); }
  }

  async function generateImage() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true); setMessage("");
    try {
      const state = await refresh(walletAddress ?? undefined);
      if (state.balance < 1n) throw new Error("No credits in this wallet. Buy a pack to create more profile media.");
      if (!prompt.trim()) throw new Error("Add a short description for the new profile artwork.");
      {
        setMessage("Checking Google model availability. No credit is used for this check…");
        const accessResponse = await fetch("/api/profile-media/profile-image?mode=image", { cache: "no-store" });
        const access = await accessResponse.json() as { ready?: boolean; error?: string };
        if (!accessResponse.ok || !access.ready) throw new Error(access.error || "Could not confirm Google AI access. No credit was used.");
      }
      const requestId = toHex(crypto.getRandomValues(new Uint8Array(32))) as Hex;
      const authorization = `Jackcaster Google profile image\nFID: ${fid}\nWallet: ${state.account.toLowerCase()}\nRequest: ${requestId.toLowerCase()}`;
      setMessage("Sign the request in MetaMask. This message signature does not move funds.");
      const signature = await state.provider.request({ method: "personal_sign", params: [toHex(authorization), state.account] }) as Hex;
      setMessage("Confirm spending 1 credit in MetaMask…");
      const txHash = await send(state.provider, state.account, ANIMATION_CREDITS_ADDRESS, encodeFunctionData({ abi: animationCreditsAbi, functionName: "useCredit", args: [requestId] }));
      setCredits(state.balance - 1n);
      setMessage("Credit confirmed. Google is creating your profile artwork…");
      const response = await fetch("/api/profile-media/profile-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ walletAddress: state.account, requestId, transactionHash: txHash, signature, prompt: prompt.trim(), mode: "image" }) });
      const result = await response.json() as { processing?: boolean; mediaUrl?: string; mediaType?: "image" | "video"; requestId?: string; error?: string };
      if (!response.ok || !result.mediaUrl || !result.mediaType) throw new Error(result.error || "Generation failed. This onchain attempt has been consumed.");
      saveGeneratedPreview({ mediaUrl: result.mediaUrl, mediaType: result.mediaType, requestId: result.requestId || requestId });
      setMessage("Artwork ready. Preview it below, then choose whether to use it on your profile.");
    } catch (error) { setMessage(walletError(error, "Could not generate the image.")); }
    finally { busyRef.current = false; setBusy(false); }
  }

  async function connectOrRefresh() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage("");
    try {
      await refresh(walletAddress ?? undefined);
      setMessage("Balance and price updated.");
    } catch (error) { setMessage(walletError(error, "Could not connect wallet.")); }
    finally { busyRef.current = false; setBusy(false); }
  }

  return <>
    {introOpen && <div className="grok-offer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeIntro(); }}>
      <section className="grok-offer" role="dialog" aria-modal="true" aria-labelledby="grok-offer-title" aria-describedby="grok-offer-copy">
        <button type="button" className="grok-offer-close" aria-label="Close profile studio offer" onClick={() => closeIntro()}>×</button>
        <span className="grok-offer-icon" aria-hidden="true">✦</span>
        <span className="grok-offer-kicker">PROFILE STUDIO</span>
        <h2 id="grok-offer-title">Create profile artwork</h2>
        <p id="grok-offer-copy">Make a custom still image for your profile. Preview it before saving.</p>
        <div className="grok-offer-steps"><span><b>1</b> Check price and credits</span><span><b>2</b> Create and preview</span><span><b>3</b> Save if you like it</span></div>
        <p className="grok-offer-note">One credit per try, even if generation fails. You approve every wallet transaction.</p>
        <div className="grok-offer-actions"><button type="button" className="btn" onClick={() => closeIntro(true)}>Open studio</button><button type="button" className="btn ghost" onClick={() => closeIntro()}>Later</button></div>
      </section>
    </div>}
    <section className="grok-maker" id="grok-profile-studio" aria-label="AI profile artwork generator">
    <div className="grok-maker-heading"><div><strong>Profile artwork</strong><p className="field-hint">Describe a still image, preview it, and save only when it feels right.</p></div><span className="meta">Base · USDC</span></div>
    <button type="button" className="grok-offer-reopen" onClick={() => setIntroOpen(true)}>How it works</button>
    {currentPfpUrl && <div className="grok-maker-current"><span className="grok-maker-current-image">{currentPfpIsMp4 || currentPfpIsWebm ? <video src={currentPfpUrl} autoPlay muted loop playsInline aria-label="Your current animated Farcaster profile picture" /> : <img src={currentPfpUrl} alt="Your current Farcaster profile picture" />}</span><span><small>YOUR PROFILE NOW</small><strong>Current profile picture</strong><span className="field-hint">It stays in place until you preview and save a new one.</span></span></div>}
    <div className="grok-maker-notice" role="note"><strong>Profile animation is paused</strong><span>New animations and upgrades are disabled while Google video access is unavailable. Existing saved animation jobs can still be checked below.</span></div>
    <label className="field"><span className="field-label">Describe your artwork</span><textarea className="text-input" rows={3} maxLength={500} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="A warm, illustrated portrait with a deep teal backdrop…" /></label>
    <div className="grok-maker-actions">
      <button type="button" className="btn ghost sm" disabled={busy} onClick={() => void connectOrRefresh()}>{busy ? "Working…" : walletAddress ? "Refresh credits" : "Connect wallet"}</button>
      <button type="button" className="btn ghost sm" disabled={busy || !walletAddress || credits === null || price === null || pack === null} onClick={() => void buy()}>{busy ? "Waiting…" : `Buy ${pack ?? "…"} credits · ${price === null ? "…" : `${formatUnits(price, USDC_DECIMALS)} USDC`}`}</button>
      <button type="button" className="btn sm" disabled={busy || !prompt.trim() || credits === null || credits < 1n} onClick={() => void generateImage()}>{busy ? "Creating…" : "Create artwork · 1 credit"}</button>
    </div>
    {credits !== null && <p className="field-hint">Balance: {credits.toString()} · {walletAddress?.slice(0, 6)}…{walletAddress?.slice(-4)}</p>}
    {!walletAddress && <p className="field-hint">Connect Base to see your live price and credits.</p>}
    {message && <p className="field-hint grok-maker-status" role="status">{message}</p>}
    {pendingAnimation && <div className="grok-maker-pending"><div><strong>Saved animation job</strong><span className="field-hint">This attempt already used one credit. Check the same job; it won&apos;t charge again.</span></div><button type="button" className="btn sm" disabled={busy} onClick={() => void resumeAnimation()}>{busy ? "Checking…" : "Check saved job"}</button></div>}
    {generatedUrl && <div className="grok-maker-result"><div className="grok-maker-compare">{currentPfpUrl && <div><small>BEFORE</small><span className="grok-maker-preview">{currentPfpIsMp4 || currentPfpIsWebm ? <video src={currentPfpUrl} autoPlay muted loop playsInline aria-label="Current profile picture" /> : <img src={currentPfpUrl} alt="Current profile picture" />}</span></div>}<div><small>NEW</small><span className="grok-maker-preview">{generatedType === "video" ? <video src={generatedUrl} autoPlay muted loop playsInline controls aria-label="New animated profile preview" /> : <img src={generatedUrl} alt="New profile image preview" />}</span></div></div><div><span className="grok-result-kicker">YOUR PREVIEW</span><strong>{generatedType === "video" ? "Your animation is ready" : "Your artwork is ready"}</strong><p className="field-hint">Your current picture stays live until you choose <strong>Use on my profile</strong> and save.</p><button type="button" className="btn sm" disabled={busy} onClick={() => onUse(generatedUrl)}>Use on my profile</button></div></div>}
    <p className="field-hint">Each image attempt uses one credit, including provider failures. Your prompt goes to Google AI and may be retained under the project&apos;s policy.</p>
    </section>
  </>;
}
