"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { base } from "@/lib/base-chain";
import { createPublicClient, encodeFunctionData, formatUnits, http, isAddress, toHex, type Address, type EIP1193Provider, type Hex } from "viem";
import { ANIMATION_CREDITS_ADDRESS, animationCreditsAbi, BASE_USDC_ADDRESS, usdcAbi } from "@/lib/animation-credits";

type EthereumWindow = Window & { ethereum?: EIP1193Provider };
const baseClient = createPublicClient({ chain: base, transport: http("https://mainnet.base.org") });
const USDC_DECIMALS = 6;

const animationStyles = [
  { id: "auto", title: "Auto", note: "Natural, polished motion", icon: "✦", motion: "Create a premium profile animation with subtle natural motion: a gentle expression shift, soft light movement, and a slight breeze. Keep the face and identity unchanged, centered, crisp, and recognizable in a small circular avatar." },
  { id: "glow", title: "Soft glow", note: "Warm light, calm shimmer", icon: "☼", motion: "Add a soft warm halo and delicate light shimmer around the portrait. Keep effects behind the subject, understated and elegant." },
  { id: "orbit", title: "Cosmic orbit", note: "Tiny stars, slow drift", icon: "✧", motion: "Add a few tiny tasteful stars and a slow, graceful cosmic light orbit in the background. Keep all effects subtle and away from the face." },
  { id: "bloom", title: "Bloom", note: "Colorful, gentle energy", icon: "❋", motion: "Add a gentle colorful bloom of light and a few floating petals or particles in the background, with calm graceful motion." },
] as const;

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

export function GrokProfileMaker({ fid, farcasterSignedIn, currentPfpUrl, onUse }: { fid: number; farcasterSignedIn: boolean; currentPfpUrl: string; onUse: (url: string) => void }) {
  const [style, setStyle] = useState<(typeof animationStyles)[number]["id"]>("auto");
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
  const busyRef = useRef(false);
  const currentPfpIsMp4 = /\.mp4(?:$|[?#])/i.test(currentPfpUrl);
  const currentPfpIsWebm = /\.webm(?:$|[?#])/i.test(currentPfpUrl);
  const currentPfpIsGif = /\.gif(?:$|[?#])/i.test(currentPfpUrl);
  const selectedStyle = animationStyles.find((item) => item.id === style) ?? animationStyles[0];
  const finalPrompt = [selectedStyle.motion, prompt.trim()].filter(Boolean).join(" Extra direction: ");

  useEffect(() => {
    try {
      const key = `jackcaster:grok-profile-intro:v1:${fid}`;
      if (!localStorage.getItem(key)) setIntroOpen(true);
    } catch { setIntroOpen(true); }
  }, [fid]);

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

  async function generate(mode: "image" | "animate" | "upgrade", sourceImageUrl = currentPfpUrl, sourceRequestId?: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true); setMessage("");
    try {
      if (mode !== "image" && !farcasterSignedIn) throw new Error("Connect your Farcaster account on this device before creating or upgrading an animation.");
      const state = await refresh(walletAddress ?? undefined);
      if (state.balance < 1n) throw new Error("No credits in this wallet. Buy a pack to create more profile media.");
      if (mode === "image" && !prompt.trim()) throw new Error("Add a short description for the new profile artwork.");
      if (mode !== "image" && !sourceImageUrl) throw new Error(mode === "upgrade" ? "Choose an existing animation to upgrade." : "Set a profile image before animating it.");
      const requestId = toHex(crypto.getRandomValues(new Uint8Array(32))) as Hex;
      setMessage("Confirm spending one profile-media credit in your wallet…");
      const txHash = await send(state.provider, state.account, ANIMATION_CREDITS_ADDRESS, encodeFunctionData({ abi: animationCreditsAbi, functionName: "useCredit", args: [requestId] }));
      setCredits(state.balance - 1n);
      const authorization = `Jackcaster Grok profile ${mode}\nFID: ${fid}\nWallet: ${state.account.toLowerCase()}\nRequest: ${requestId.toLowerCase()}\nTransaction: ${txHash.toLowerCase()}`;
      const signature = await state.provider.request({ method: "personal_sign", params: [toHex(authorization), state.account] }) as Hex;
      setMessage(mode === "animate" ? "Credit confirmed. Grok is animating your profile image…" : "Credit confirmed. Grok is creating your profile image…");
      const response = await fetch("/api/grok/profile-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ walletAddress: state.account, requestId, transactionHash: txHash, signature, prompt: mode === "image" ? prompt.trim() : finalPrompt, mode, sourceImageUrl: mode !== "image" ? sourceImageUrl : undefined, sourceRequestId: mode !== "image" ? sourceRequestId : undefined }) });
      const result = await response.json() as { mediaUrl?: string; mediaType?: "image" | "video"; requestId?: string; error?: string };
      if (!response.ok || !result.mediaUrl || !result.mediaType) throw new Error(result.error || "Generation failed. This onchain attempt has been consumed.");
      setGeneratedUrl(result.mediaUrl);
      setGeneratedType(result.mediaType);
      setGeneratedRequestId(result.requestId || requestId);
      setMessage(`${mode === "upgrade" ? "Upgraded animation" : result.mediaType === "video" ? "Animation" : "Image"} ready. Preview it below, then choose whether to use it on your profile.`);
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
        <h2 id="grok-offer-title">Create your animated profile</h2>
        <p id="grok-offer-copy">Make profile art or animate your photo. Preview it before saving.</p>
        <div className="grok-offer-steps"><span><b>1</b> Check price and credits</span><span><b>2</b> Create and preview</span><span><b>3</b> Save if you like it</span></div>
        <p className="grok-offer-note">One credit per try, even if generation fails. You approve every wallet transaction.</p>
        <div className="grok-offer-actions"><button type="button" className="btn" onClick={() => closeIntro(true)}>Open studio</button><button type="button" className="btn ghost" onClick={() => closeIntro()}>Later</button></div>
      </section>
    </div>}
    <section className="grok-maker" id="grok-profile-studio" aria-label="AI profile media generator">
    <div className="grok-maker-heading"><div><strong>Profile studio</strong><p className="field-hint">Choose a look, preview your animation, and save only when it feels right.</p></div><span className="meta">Base · USDC</span></div>
    <button type="button" className="grok-offer-reopen" onClick={() => setIntroOpen(true)}>How it works</button>
    <fieldset className="grok-style-picker" aria-label="Choose an animation style">
      <legend>Pick an animation style <span className="meta">Auto is ready to use</span></legend>
      <div className="grok-style-grid">{animationStyles.map((item) => <button key={item.id} type="button" className={`grok-style-card${style === item.id ? " selected" : ""}`} aria-pressed={style === item.id} onClick={() => setStyle(item.id)}><span className="grok-style-icon" aria-hidden="true">{item.icon}</span><span><strong>{item.title}</strong><small>{item.note}</small></span></button>)}</div>
    </fieldset>
    <label className="field"><span className="field-label">Optional custom touch</span><textarea className="text-input" rows={2} maxLength={300} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Add a color, mood, or small detail—or leave blank for Auto." /></label>
    <div className="grok-maker-actions">
      <button type="button" className="btn ghost sm" disabled={busy} onClick={() => void connectOrRefresh()}>{busy ? "Working…" : walletAddress ? "Refresh credits" : "Connect wallet"}</button>
      <button type="button" className="btn ghost sm" disabled={busy || !walletAddress || credits === null || price === null || pack === null} onClick={() => void buy()}>{busy ? "Waiting…" : `Buy ${pack ?? "…"} credits · ${price === null ? "…" : `${formatUnits(price, USDC_DECIMALS)} USDC`}`}</button>
      <button type="button" className="btn sm" disabled={busy || !prompt.trim() || credits === null || credits < 1n} onClick={() => void generate("image")}>{busy ? "Creating…" : "Create new artwork · 1 credit"}</button>
      {currentPfpUrl && (currentPfpIsMp4
        ? <button type="button" className="btn sm" disabled={busy || !farcasterSignedIn || credits === null || credits < 1n} onClick={() => void generate("upgrade")}>{busy ? "Creating…" : "Upgrade current MP4 · 1 credit"}</button>
        : currentPfpIsWebm || currentPfpIsGif
          ? <button type="button" className="btn sm" disabled title={currentPfpIsGif ? "Grok video generation needs a still PNG, JPEG, or WebP image." : "Grok video editing accepts MP4 source videos."}>{currentPfpIsGif ? "GIF source unsupported" : "WebM upgrade unavailable"}</button>
        : <button type="button" className="btn sm" disabled={busy || !farcasterSignedIn || credits === null || credits < 1n} onClick={() => void generate("animate")}>{busy ? "Creating…" : "Animate my profile · 1 credit"}</button>)}
      {generatedUrl && generatedType === "image" && <button type="button" className="btn ghost sm" disabled={busy || !farcasterSignedIn || credits === null || credits < 1n} onClick={() => void generate("animate", generatedUrl, generatedRequestId)}>{busy ? "Creating…" : "Animate this image · 1 credit"}</button>}
      {generatedUrl && generatedType === "video" && <button type="button" className="btn ghost sm" disabled={busy || !farcasterSignedIn || credits === null || credits < 1n} onClick={() => void generate("upgrade", generatedUrl, generatedRequestId)}>{busy ? "Creating…" : "Try another look · 1 credit"}</button>}
    </div>
    {credits !== null && <p className="field-hint">Balance: {credits.toString()} · {walletAddress?.slice(0, 6)}…{walletAddress?.slice(-4)}</p>}
    {!walletAddress && <p className="field-hint">Connect Base to see your live price and credits.</p>}
    {currentPfpIsGif && <p className="field-hint grok-maker-status" role="note">Grok needs a still PNG, JPEG, or WebP image to create a profile animation. You can create a new image below, then animate that result; this GIF will not be sent or charged for animation.</p>}
    {currentPfpIsWebm && <p className="field-hint grok-maker-status" role="note">Animation upgrades currently accept MP4 source video. This WebM will not be sent or charged for an upgrade.</p>}
    {!farcasterSignedIn && <p className="field-hint grok-maker-status" role="note">Connect your Farcaster account on this device to animate or upgrade a profile video. Buying credits and image creation do not enable animation access.</p>}
    {message && <p className="field-hint grok-maker-status" role="status">{message}</p>}
    {generatedUrl && <div className="grok-maker-result"><div className="grok-maker-preview">{generatedType === "video" ? <video src={generatedUrl} autoPlay muted loop playsInline controls aria-label="Animated profile preview" /> : <img src={generatedUrl} alt="Generated profile image preview" />}</div><div><span className="grok-result-kicker">YOUR PREVIEW</span><strong>{generatedType === "video" ? "Your animation is ready" : "Your artwork is ready"}</strong><p className="field-hint">It won’t change your Farcaster profile until you apply it and save.</p><button type="button" className="btn sm" disabled={busy} onClick={() => onUse(generatedUrl)}>Use on my profile</button></div></div>}
    <p className="field-hint">1 credit per try, even if it fails. Your prompt and image go to xAI.</p>
    </section>
  </>;
}
