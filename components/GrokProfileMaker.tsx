"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { base } from "@/lib/base-chain";
import { createPublicClient, encodeFunctionData, formatUnits, http, isAddress, toHex, type Address, type EIP1193Provider, type Hex } from "viem";
import { ANIMATION_CREDITS_ADDRESS, animationCreditsAbi, BASE_USDC_ADDRESS, usdcAbi } from "@/lib/animation-credits";

type EthereumWindow = Window & { ethereum?: EIP1193Provider };
const baseClient = createPublicClient({ chain: base, transport: http("https://mainnet.base.org") });
const USDC_DECIMALS = 6;

async function getProvider(): Promise<EIP1193Provider | undefined> {
  try { if (await sdk.isInMiniApp()) return await sdk.wallet.getEthereumProvider() as EIP1193Provider; }
  catch { /* Fall back to an installed browser wallet. */ }
  return (window as EthereumWindow).ethereum;
}

async function connectBase(provider: EIP1193Provider): Promise<Address> {
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
  const accounts = await provider.request({ method: "eth_requestAccounts" }) as string[];
  if (!accounts?.[0] || !isAddress(accounts[0])) throw new Error("Select a valid wallet account.");
  return accounts[0] as Address;
}

async function send(provider: EIP1193Provider, from: Address, to: Address, data: Hex): Promise<Hex> {
  const hash = await provider.request({ method: "eth_sendTransaction", params: [{ from, to, data, value: "0x0" }] }) as string;
  if (!/^0x[0-9a-f]{64}$/i.test(hash)) throw new Error("The wallet returned an invalid transaction hash.");
  const receipt = await baseClient.waitForTransactionReceipt({ hash: hash as Hex, timeout: 120_000 });
  if (receipt.status !== "success") throw new Error("The transaction reverted on Base.");
  return hash as Hex;
}

export function GrokProfileMaker({ fid, farcasterSignedIn, currentPfpUrl, onUse }: { fid: number; farcasterSignedIn: boolean; currentPfpUrl: string; onUse: (url: string) => void }) {
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
  const currentPfpIsMp4 = /\.mp4(?:$|[?#])/i.test(currentPfpUrl);

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
    const account = await connectBase(provider);
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
    setBusy(true); setMessage("");
    try {
      const state = await refresh();
      const allowance = await baseClient.readContract({ address: BASE_USDC_ADDRESS, abi: usdcAbi, functionName: "allowance", args: [state.account, ANIMATION_CREDITS_ADDRESS] });
      if (allowance < state.currentPrice) {
        setMessage(`Approve ${formatUnits(state.currentPrice, USDC_DECIMALS)} USDC in your wallet. Jackcaster requests only this exact purchase amount.`);
        await send(state.provider, state.account, BASE_USDC_ADDRESS, encodeFunctionData({ abi: usdcAbi, functionName: "approve", args: [ANIMATION_CREDITS_ADDRESS, state.currentPrice] }));
      }
      setMessage("Confirm the credit purchase in your wallet…");
      const hash = await send(state.provider, state.account, ANIMATION_CREDITS_ADDRESS, encodeFunctionData({ abi: animationCreditsAbi, functionName: "buyCredits" }));
      await refresh(state.account);
      setMessage(`Purchase confirmed on Base. View transaction on BaseScan: ${hash}`);
    } catch (error) { setMessage((error as Error).message || "Could not buy credits."); }
    finally { setBusy(false); }
  }

  async function generate(mode: "image" | "animate" | "upgrade", sourceImageUrl = currentPfpUrl, sourceRequestId?: string) {
    setBusy(true); setMessage(""); setGeneratedUrl("");
    try {
      if (mode !== "image" && !farcasterSignedIn) throw new Error("Connect your Farcaster account on this device before creating or upgrading an animation.");
      const state = await refresh(walletAddress ?? undefined);
      if (state.balance < 1n) throw new Error("No credits in this wallet. Buy a pack to create more profile media.");
      if (!prompt.trim()) throw new Error("Describe the profile image or motion you want first.");
      if (mode !== "image" && !sourceImageUrl) throw new Error(mode === "upgrade" ? "Choose an existing animation to upgrade." : "Set a profile image before animating it.");
      const requestId = toHex(crypto.getRandomValues(new Uint8Array(32))) as Hex;
      setMessage("Confirm spending one profile-media credit in your wallet…");
      const txHash = await send(state.provider, state.account, ANIMATION_CREDITS_ADDRESS, encodeFunctionData({ abi: animationCreditsAbi, functionName: "useCredit", args: [requestId] }));
      setCredits(state.balance - 1n);
      const authorization = `Jackcaster Grok profile ${mode}\nFID: ${fid}\nWallet: ${state.account.toLowerCase()}\nRequest: ${requestId.toLowerCase()}\nTransaction: ${txHash.toLowerCase()}`;
      const signature = await state.provider.request({ method: "personal_sign", params: [toHex(authorization), state.account] }) as Hex;
      setMessage(mode === "animate" ? "Credit confirmed. Grok is animating your profile image…" : "Credit confirmed. Grok is creating your profile image…");
      const response = await fetch("/api/grok/profile-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ walletAddress: state.account, requestId, transactionHash: txHash, signature, prompt: prompt.trim(), mode, sourceImageUrl: mode !== "image" ? sourceImageUrl : undefined, sourceRequestId: mode !== "image" ? sourceRequestId : undefined }) });
      const result = await response.json() as { mediaUrl?: string; mediaType?: "image" | "video"; requestId?: string; error?: string };
      if (!response.ok || !result.mediaUrl || !result.mediaType) throw new Error(result.error || "Generation failed. This onchain attempt has been consumed.");
      setGeneratedUrl(result.mediaUrl);
      setGeneratedType(result.mediaType);
      setGeneratedRequestId(result.requestId || requestId);
      setMessage(`${mode === "upgrade" ? "Upgraded animation" : result.mediaType === "video" ? "Animation" : "Image"} ready. Preview it below, then choose whether to use it on your profile.`);
    } catch (error) { setMessage((error as Error).message || "Could not generate the image."); }
    finally { setBusy(false); }
  }

  return <>
    {introOpen && <div className="grok-offer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeIntro(); }}>
      <section className="grok-offer" role="dialog" aria-modal="true" aria-labelledby="grok-offer-title" aria-describedby="grok-offer-copy">
        <button type="button" className="grok-offer-close" aria-label="Close profile studio offer" onClick={() => closeIntro()}>×</button>
        <span className="grok-offer-icon" aria-hidden="true">✦</span>
        <span className="grok-offer-kicker">NEW · PROFILE STUDIO</span>
        <h2 id="grok-offer-title">Make your profile move</h2>
        <p id="grok-offer-copy">Create profile art, animate a still picture, or spend a credit to refine an existing MP4 profile animation with Grok. Preview every result before deciding whether to save it to Farcaster.</p>
        <div className="grok-offer-steps"><span><b>01</b> Choose a prompt</span><span><b>02</b> Check the live Base price</span><span><b>03</b> Preview, then save if you like it</span></div>
        <p className="grok-offer-note">One contract credit per image, animation, or animation upgrade. Your wallet is not connected and no purchase happens until you choose. xAI receives your prompt and the profile media you select. Provider attempts use a credit even if generation fails.</p>
        <div className="grok-offer-actions"><button type="button" className="btn" onClick={() => closeIntro(true)}>Explore profile studio</button><button type="button" className="btn ghost" onClick={() => closeIntro()}>Maybe later</button></div>
      </section>
    </div>}
    <section className="grok-maker" id="grok-profile-studio" aria-label="AI profile media generator">
    <div className="grok-maker-heading"><div><strong>Create, animate, or refine your profile with Grok</strong><p className="field-hint">Buy credits here, then spend one per generation or animation upgrade. Preview first; your profile changes only after you choose the result and save.</p></div><span className="meta">Base · USDC</span></div>
    <button type="button" className="grok-offer-reopen" onClick={() => setIntroOpen(true)}>How paid profile creation works</button>
    <label className="field"><span className="field-label">Describe the image or motion</span><textarea className="text-input" rows={3} maxLength={500} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="A friendly jackalope astronaut, warm paper-cut illustration, mint and coral palette…" /></label>
    <div className="grok-maker-actions">
      <button type="button" className="btn ghost sm" disabled={busy} onClick={() => { setBusy(true); setMessage(""); void refresh().then(() => setMessage("Wallet and credit balance refreshed.")).catch((error) => setMessage((error as Error).message)).finally(() => setBusy(false)); }}>{busy ? "Working…" : walletAddress ? "Refresh credits" : "Connect wallet"}</button>
      <button type="button" className="btn ghost sm" disabled={busy} onClick={() => void buy()}>{busy ? "Waiting…" : `Buy ${pack ?? "…"} credits · ${price === null ? "…" : `${formatUnits(price, USDC_DECIMALS)} USDC`}`}</button>
      <button type="button" className="btn sm" disabled={busy || !prompt.trim() || credits === null || credits < 1n} onClick={() => void generate("image")}>{busy ? "Creating…" : "Create image · 1 credit"}</button>
      {currentPfpUrl && <button type="button" className="btn sm" disabled={busy || !farcasterSignedIn || !prompt.trim() || credits === null || credits < 1n} onClick={() => void generate(currentPfpIsMp4 ? "upgrade" : "animate")}>{busy ? "Creating…" : currentPfpIsMp4 ? "Upgrade current animation · 1 credit" : "Animate profile · 1 credit"}</button>}
      {generatedUrl && generatedType === "image" && <button type="button" className="btn ghost sm" disabled={busy || !farcasterSignedIn || !prompt.trim() || credits === null || credits < 1n} onClick={() => void generate("animate", generatedUrl, generatedRequestId)}>{busy ? "Creating…" : "Animate this image · 1 credit"}</button>}
      {generatedUrl && generatedType === "video" && <button type="button" className="btn ghost sm" disabled={busy || !farcasterSignedIn || !prompt.trim() || credits === null || credits < 1n} onClick={() => void generate("upgrade", generatedUrl, generatedRequestId)}>{busy ? "Creating…" : "Upgrade this animation · 1 credit"}</button>}
    </div>
    {credits !== null && <p className="field-hint">{credits.toString()} credits · {walletAddress ? `wallet ${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : "Connect your wallet"}{pack ? ` · current pack includes ${pack} credits` : ""}</p>}
    {!farcasterSignedIn && <p className="field-hint grok-maker-status" role="note">Connect your Farcaster account on this device to animate or upgrade a profile video. Buying credits and image creation do not enable animation access.</p>}
    {message && <p className="field-hint grok-maker-status" role="status">{message}</p>}
    {generatedUrl && <div className="grok-maker-result">{generatedType === "video" ? <video src={generatedUrl} autoPlay muted loop playsInline controls aria-label="Animated profile preview" /> : <img src={generatedUrl} alt="Generated profile image preview" />}<div><strong>{generatedType === "video" ? "Animation" : "Image"} ready</strong><p className="field-hint">It is not applied until you choose it and save your profile.</p><button type="button" className="btn sm" onClick={() => onUse(generatedUrl)}>Use this profile media</button></div></div>}
    <p className="field-hint">USDC purchases use the Base contract. Grok generation is provided by xAI; your prompt and selected profile media are sent to xAI. New animations are five-second silent videos; an upgrade refines an existing MP4 animation. Each confirmed attempt uses one credit, including provider failures. Review results before saving.</p>
    </section>
  </>;
}
