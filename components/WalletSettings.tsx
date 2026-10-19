"use client";

import { useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import type { EIP1193Provider } from "viem";

type WalletWindow = Window & { ethereum?: EIP1193Provider };

async function getProvider(): Promise<EIP1193Provider | undefined> {
  try {
    if (await sdk.isInMiniApp()) return await sdk.wallet.getEthereumProvider() as EIP1193Provider;
  } catch { /* Fall back to an installed browser wallet. */ }
  return (window as WalletWindow).ethereum;
}

function shorten(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletSettings() {
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState("");
  const [provider, setProvider] = useState<EIP1193Provider>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function connect() {
    setBusy(true);
    setMessage("");
    try {
      const wallet = provider || await getProvider();
      if (!wallet) throw new Error("Open Jackcaster in Farcaster or install a compatible browser wallet.");
      const accounts = await wallet.request({ method: "eth_requestAccounts" }) as string[];
      const chain = await wallet.request({ method: "eth_chainId" }) as string;
      setProvider(wallet);
      setAddress(accounts?.[0] || "");
      setChainId(chain || "");
      setMessage(accounts?.[0] ? "Wallet selected. Your Farcaster sign-in remains separate." : "No wallet account was selected.");
    } catch (error) {
      const reason = error as { code?: number; message?: string };
      setMessage(reason.code === 4001 ? "You cancelled the wallet connection." : reason.message || "Could not connect a wallet.");
    } finally { setBusy(false); }
  }

  return <div className="wallet-settings">
    <p className="wallet-settings-warning"><strong>Optional third-party wallet.</strong> The wallet is provided and controlled by Farcaster or your installed wallet provider, not Jackcaster. Connecting shares your public wallet address with Jackcaster. We never ask for your recovery phrase or private key. Review every transaction in your wallet; transactions may be irreversible. Jackcaster is not liable for third-party wallet services or losses from transactions.</p>
    <div className="wallet-settings-copy">
      <strong>{address ? "Wallet selected" : "Wallet not connected"}</strong>
      <span>{address ? `${shorten(address)} · ${chainId === "0x2105" ? "Base" : chainId ? `Chain ${Number.parseInt(chainId, 16)}` : "Network unknown"}` : "Wallet access is optional. Farcaster sign-in and social features work without connecting a wallet."}</span>
    </div>
    <button type="button" className="btn ghost sm" onClick={() => void connect()} disabled={busy}>{busy ? "Waiting for wallet…" : address ? "Choose account" : "Connect wallet"}</button>
    {message && <p className="field-hint wallet-settings-message" role="status">{message}</p>}
  </div>;
}
