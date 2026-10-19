import { get, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { base } from "viem/chains";
import { createPublicClient, decodeEventLog, http, isAddress, verifyMessage, type Address, type Hex } from "viem";
import { getViewer } from "@/lib/viewer";
import { ANIMATION_CREDITS_ADDRESS, animationCreditsAbi } from "@/lib/animation-credits";

export const runtime = "nodejs";
export const maxDuration = 60;

const baseClient = createPublicClient({ chain: base, transport: http("https://mainnet.base.org", { timeout: 15_000 }) });
const API_KEY = () => process.env.REACT_APP_GROK_API_KEY || process.env.XAI_API_KEY;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer?.canWrite) return jsonError("Connect a writable Farcaster account before generating an image.", 401);
  if (!API_KEY()) return jsonError("Grok image generation is not configured on this deployment.", 503);
  if (!process.env.BLOB_READ_WRITE_TOKEN && !(process.env.BLOB_STORE_ID && process.env.BLOB_WEBHOOK_PUBLIC_KEY)) {
    return jsonError("Secure one-use generation storage is not configured. Set up Vercel Blob first.", 503);
  }

  let body: { walletAddress?: unknown; requestId?: unknown; transactionHash?: unknown; signature?: unknown; prompt?: unknown };
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 12_000) return jsonError("Request is too large.", 413);
    body = await request.json();
  } catch { return jsonError("Invalid request body.", 400); }

  const { walletAddress, requestId, transactionHash, signature, prompt } = body;
  if (typeof walletAddress !== "string" || !isAddress(walletAddress)) return jsonError("Connect a valid EVM wallet.", 400);
  if (typeof requestId !== "string" || !/^0x[0-9a-f]{64}$/i.test(requestId) || /^0x0{64}$/i.test(requestId)) return jsonError("Invalid generation request ID.", 400);
  if (typeof transactionHash !== "string" || !/^0x[0-9a-f]{64}$/i.test(transactionHash)) return jsonError("The confirmed credit-use transaction is required.", 400);
  if (typeof signature !== "string" || !/^0x[0-9a-f]{130,132}$/i.test(signature)) return jsonError("Wallet authorization is required.", 400);
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 500) return jsonError("Describe the profile image in 1–500 characters.", 400);

  const wallet = walletAddress as Address;
  const hash = transactionHash as Hex;
  const requestHex = requestId as Hex;
  const message = `Jackcaster Grok profile image\nFID: ${viewer.fid}\nWallet: ${wallet.toLowerCase()}\nRequest: ${requestHex.toLowerCase()}\nTransaction: ${hash.toLowerCase()}`;
  try {
    if (!(await verifyMessage({ address: wallet, message, signature: signature as Hex }))) return jsonError("Wallet authorization did not match this request.", 401);

    const receipt = await baseClient.getTransactionReceipt({ hash });
    if (receipt.status !== "success") return jsonError("The credit-use transaction did not succeed on Base.", 402);
    const transaction = await baseClient.getTransaction({ hash });
    if (transaction.from.toLowerCase() !== wallet.toLowerCase()) return jsonError("The transaction sender does not match the connected wallet.", 403);

    let creditUsed = false;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== ANIMATION_CREDITS_ADDRESS.toLowerCase()) continue;
      try {
        const decoded = decodeEventLog({ abi: animationCreditsAbi, data: log.data, topics: log.topics });
        if (decoded.eventName === "CreditUsed" && decoded.args.account.toLowerCase() === wallet.toLowerCase() && decoded.args.requestId.toLowerCase() === requestHex.toLowerCase()) creditUsed = true;
      } catch { /* Ignore other contract events in the receipt. */ }
    }
    if (!creditUsed) return jsonError("No matching credit-use event was found for this wallet and request.", 402);

    const lockPath = `grok-requests/${wallet.toLowerCase()}/${requestHex.slice(2).toLowerCase()}.json`;
    const blobAccess = process.env.GROK_REQUEST_BLOB_ACCESS === "private" ? "private" : "public";
    const previous = await get(lockPath, { access: blobAccess });
    if (previous?.statusCode === 200) {
      const saved = await new Response(previous.stream).json() as { imageUrl?: unknown };
      if (typeof saved.imageUrl === "string" && saved.imageUrl.startsWith("https://")) {
        return NextResponse.json({ imageUrl: saved.imageUrl }, { headers: { "Cache-Control": "no-store" } });
      }
      return jsonError("This credit is already processing or was consumed by a failed generation. Use another credit if needed.", 409);
    }
    try {
      await put(lockPath, JSON.stringify({ fid: viewer.fid, wallet: wallet.toLowerCase(), requestId: requestHex.toLowerCase(), tx: hash.toLowerCase(), startedAt: Date.now() }), {
        access: blobAccess,
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: "application/json",
        cacheControlMaxAge: 60,
      });
    } catch {
      return jsonError("This credit request was already used or secure request storage failed. Check your profile before spending another credit.", 409);
    }

    const grokResponse = await fetch("https://api.x.ai/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "grok-imagine-image-2.0", prompt: `Create a polished, square Farcaster profile picture. ${prompt.trim()}. No text, no watermark.`, aspect_ratio: "1:1", resolution: "1k", quality: "low", response_format: "b64_json", n: 1 }),
      signal: AbortSignal.timeout(50_000),
      cache: "no-store",
    });
    if (!grokResponse.ok) {
      console.error("Grok image generation failed with status", grokResponse.status);
      return jsonError("Grok could not complete this generation. The onchain credit was already spent for this attempt.", 502);
    }
    const result = await grokResponse.json() as { data?: { b64_json?: string }[] };
    const encoded = result.data?.[0]?.b64_json;
    if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return jsonError("Grok returned an invalid image for this attempt.", 502);
    const image = Buffer.from(encoded, "base64");
    if (image.length < 8 || image.length > 12 * 1024 * 1024) return jsonError("Grok returned an image with an unsupported size.", 502);
    const isPng = image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isJpeg = image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff;
    if (!isPng && !isJpeg) return jsonError("Grok returned an unsupported image format.", 502);
    const extension = isPng ? "png" : "jpg";
    const imagePath = `pfp/grok-${viewer.fid}-${requestHex.slice(2).toLowerCase()}.${extension}`;
    const savedImage = await put(imagePath, image, {
      access: blobAccess,
      addRandomSuffix: true,
      allowOverwrite: false,
      contentType: isPng ? "image/png" : "image/jpeg",
      cacheControlMaxAge: 31_536_000,
    });
    const imageUrl = blobAccess === "private" ? `${new URL(request.url).origin}/i/${savedImage.pathname}` : savedImage.url;
    await put(lockPath, JSON.stringify({ fid: viewer.fid, wallet: wallet.toLowerCase(), requestId: requestHex.toLowerCase(), tx: hash.toLowerCase(), imageUrl, completedAt: Date.now() }), {
      access: blobAccess,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });
    return NextResponse.json({ imageUrl }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Grok profile image request failed:", error instanceof Error ? error.message : "unknown error");
    return jsonError("Could not verify or generate this request. Check Base confirmation and try again with another credit if needed.", 502);
  }
}
