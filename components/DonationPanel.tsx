"use client";

import { useCallback, useEffect, useState } from "react";
import { encodeFunctionData, parseEther, parseUnits, toHex, type EIP1193Provider, type Hex } from "viem";
import { sdk } from "@farcaster/miniapp-sdk";
import { BASE_CHAIN_HEX, BASE_USDC, DONATION_RECIPIENTS } from "@/lib/donation-recipients";

type Recipient = keyof typeof DONATION_RECIPIENTS;
type Currency = "USDC" | "ETH";
type EthereumWindow = Window & { ethereum?: EIP1193Provider };
const AMOUNTS = [1, 10, 100] as const;
const transferAbi = [{ type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "value", type: "uint256" }], outputs: [{ name: "", type: "bool" }] }] as const;

export function DonationPanel() {
  const [recipient, setRecipient] = useState<Recipient>("jackcaster");
  const [currency, setCurrency] = useState<Currency>("USDC");
  const [amount, setAmount] = useState<(typeof AMOUNTS)[number]>(10);
  const [ethUsd, setEthUsd] = useState<number | null>(null);
  const [priceUpdatedAt, setPriceUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [txHash, setTxHash] = useState("");

  const refreshPrice = useCallback(async () => {
    try {
      const response = await fetch("/api/donations/eth-price", { cache: "no-store" });
      if (!response.ok) throw new Error("Price unavailable");
      const data = await response.json() as { ethUsd: number; updatedAt: string };
      setEthUsd(data.ethUsd);
      setPriceUpdatedAt(data.updatedAt);
    } catch {
      setEthUsd(null);
      setPriceUpdatedAt(null);
    }
  }, []);

  useEffect(() => { void refreshPrice(); }, [refreshPrice]);

  const send = async () => {
    setLoading(true);
    setMessage("");
    setTxHash("");
    try {
      let provider: EIP1193Provider | undefined;
      try {
        if (await sdk.isInMiniApp()) provider = await sdk.wallet.getEthereumProvider() as EIP1193Provider;
      } catch { /* Use a browser wallet when the host wallet is unavailable. */ }
      provider ??= (window as EthereumWindow).ethereum;
      if (!provider) throw new Error("Open Jackcaster in Farcaster or install a Base-compatible wallet to donate.");
      try {
        await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BASE_CHAIN_HEX }] });
      } catch (error) {
        const code = (error as { code?: number }).code;
        if (code !== 4902) throw error;
        await provider.request({ method: "wallet_addEthereumChain", params: [{ chainId: BASE_CHAIN_HEX, chainName: "Base", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: ["https://mainnet.base.org"], blockExplorerUrls: ["https://basescan.org"] }] });
      }
      const accounts = await provider.request({ method: "eth_requestAccounts" }) as string[];
      const from = accounts?.[0];
      if (!from) throw new Error("No wallet account was selected.");
      const to = DONATION_RECIPIENTS[recipient].address;
      const tx: { from: string; to: string; data?: Hex; value: Hex } = currency === "USDC"
        ? { from, to: BASE_USDC, data: encodeFunctionData({ abi: transferAbi, functionName: "transfer", args: [to, parseUnits(String(amount), 6)] }), value: "0x0" }
        : (() => {
          if (!ethUsd) throw new Error("The ETH price is unavailable. Refresh the quote or choose USDC.");
          const ethAmount = (amount / ethUsd).toFixed(8);
          return { from, to, value: toHex(parseEther(ethAmount)) };
        })();
      setMessage("Review the recipient and amount in your wallet before approving.");
      const hash = await (provider.request as unknown as (args: { method: string; params?: unknown[] }) => Promise<unknown>)({ method: "eth_sendTransaction", params: [tx] }) as string;
      if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error("Wallet returned an invalid transaction id.");
      setTxHash(hash);
      setMessage("Donation submitted on Base. Your wallet may still be confirming it.");
    } catch (error) {
      const e = error as { code?: number; message?: string };
      setMessage(e.code === 4001 ? "You cancelled the wallet request." : e.message || "Could not start the donation. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const ethQuote = ethUsd ? (amount / ethUsd).toFixed(6) : null;
  const quoteTime = priceUpdatedAt ? new Date(priceUpdatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
  const selected = DONATION_RECIPIENTS[recipient];

  return <div className="donation-panel" id="donate">
    <p className="field-hint">Support the original Selfcaster project or Jackcaster. Donations go directly to the selected wallet on Base; Jackcaster does not add a fee.</p>
    <div className="donation-field"><span className="donation-label">Recipient</span><div className="donation-choice-grid">{(Object.keys(DONATION_RECIPIENTS) as Recipient[]).map((key) => <button type="button" key={key} className={`donation-choice${recipient === key ? " active" : ""}`} onClick={() => { setRecipient(key); setTxHash(""); }}>{DONATION_RECIPIENTS[key].label}</button>)}</div><code className="donation-address">{selected.address}</code></div>
    <div className="donation-field"><span className="donation-label">Choose an amount in USD</span><div className="donation-amount-grid">{AMOUNTS.map((value) => <button type="button" key={value} className={`donation-amount${amount === value ? " active" : ""}`} onClick={() => setAmount(value)}>${value}</button>)}</div></div>
    <div className="donation-bottom-row"><label className="donation-currency">Pay with <select value={currency} onChange={(event) => setCurrency(event.target.value as Currency)}><option value="USDC">USDC</option><option value="ETH">ETH</option></select> on Base</label>{currency === "ETH" && <span className="field-hint donation-quote">{ethQuote ? `≈ ${ethQuote} ETH · $${ethUsd?.toLocaleString()} / ETH · ${quoteTime}` : <button type="button" className="linkish" onClick={() => void refreshPrice()}>Refresh ETH quote</button>}</span>}</div>
    <button type="button" className="btn primary donation-submit" disabled={loading || (currency === "ETH" && !ethQuote)} onClick={() => void send()}>{loading ? "Waiting for wallet…" : `Donate to ${recipient === "jackcaster" ? "Jackcaster" : "Selfcaster"} with ${currency}`}</button>
    <p className="field-hint donation-wallet-note">Your wallet shows the final recipient and amount before approval. Check both carefully.</p>
    {message && <p className="donation-status" role="status">{message} {txHash && <a href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noopener noreferrer">View on BaseScan ↗</a>}</p>}
  </div>;
}
