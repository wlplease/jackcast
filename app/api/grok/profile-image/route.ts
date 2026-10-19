import { get, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { base } from "@/lib/base-chain";
import { createPublicClient, decodeEventLog, http, isAddress, verifyMessage, type Address, type Hex } from "viem";
import { ANIMATION_CREDITS_ADDRESS, animationCreditsAbi } from "@/lib/animation-credits";
import { neynar } from "@/lib/neynar";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";
export const maxDuration = 60;

const baseClient = createPublicClient({ chain: base, transport: http("https://mainnet.base.org", { timeout: 15_000 }) });
const apiKey = () => process.env.REACT_APP_GROK_API_KEY || process.env.XAI_API_KEY;

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

async function generateImage(prompt: string, key: string): Promise<{ bytes: Buffer; contentType: string; ext: "png" | "jpg" }> {
  const response = await fetch("https://api.x.ai/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "grok-imagine-image-2.0", prompt: `Create a polished, square Farcaster profile picture. ${prompt}. No text, no watermark.`, aspect_ratio: "1:1", resolution: "1k", quality: "low", response_format: "b64_json", n: 1 }),
    signal: AbortSignal.timeout(45_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Grok image request failed (${response.status}).`);
  const result = await response.json() as { data?: { b64_json?: string }[] };
  const encoded = result.data?.[0]?.b64_json;
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error("Grok returned an invalid image.");
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length < 8 || bytes.length > 12 * 1024 * 1024) throw new Error("Grok image size is unsupported.");
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { bytes, contentType: "image/png", ext: "png" };
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { bytes, contentType: "image/jpeg", ext: "jpg" };
  throw new Error("Grok returned an unsupported image format.");
}

async function generateAnimation(sourceImage: string, prompt: string, key: string): Promise<{ bytes: Buffer; contentType: "video/mp4"; ext: "mp4" }> {
  const start = await fetch("https://api.x.ai/v1/videos/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "grok-imagine-video-1.5-lite",
      prompt: `Create a polished, silent, seamless five-second looping profile animation from this image. ${prompt} Preserve the exact identity, face, expression, clothing, and framing of the original subject. Keep the face centered, sharp, unobstructed, and recognizable inside a circular avatar crop. Animate only gentle background light and small natural motion; keep all motion smooth and restrained, return to the opening pose for a clean loop, use no cuts, camera movement, text, logos, or audio.`,
      image: { url: sourceImage },
      duration: 5,
      resolution: "480p",
      generate_audio: false,
    }),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!start.ok) throw new Error(`Grok could not start the animation (${start.status}).`);
  const job = await start.json() as { request_id?: string };
  if (!job.request_id || !/^[A-Za-z0-9_-]{1,160}$/.test(job.request_id)) throw new Error("Grok returned an invalid animation job.");

  let videoUrl = "";
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    const statusResponse = await fetch(`https://api.x.ai/v1/videos/${encodeURIComponent(job.request_id)}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
    if (!statusResponse.ok) continue;
    const status = await statusResponse.json() as { status?: string; video?: { url?: string } };
    if (status.status === "failed") throw new Error("Grok could not finish the animation.");
    if (status.status === "done" && status.video?.url) { videoUrl = status.video.url; break; }
  }
  if (!videoUrl) throw new Error("Animation is still processing. The attempt is recorded; check before spending another credit.");
  const remote = new URL(videoUrl);
  if (remote.protocol !== "https:" || remote.hostname !== "vidgen.x.ai") throw new Error("Grok returned an unexpected video host.");
  const videoResponse = await fetch(remote, { signal: AbortSignal.timeout(15_000), cache: "no-store" });
  if (!videoResponse.ok || Number(videoResponse.headers.get("content-length") || 0) > 30 * 1024 * 1024) throw new Error("Grok returned a video that could not be saved.");
  const bytes = Buffer.from(await videoResponse.arrayBuffer());
  if (bytes.length < 12 || bytes.length > 30 * 1024 * 1024 || bytes.toString("ascii", 4, 8) !== "ftyp") throw new Error("Grok returned an invalid MP4 file.");
  return { bytes, contentType: "video/mp4", ext: "mp4" };
}

async function upgradeAnimation(sourceVideo: string, prompt: string, key: string): Promise<{ bytes: Buffer; contentType: "video/mp4"; ext: "mp4" }> {
  const start = await fetch("https://api.x.ai/v1/videos/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "grok-imagine-video",
      prompt: `Refine this animated Farcaster profile image: ${prompt}. Preserve the exact person's or character's identity, face, expression, clothing, framing, and overall style. Keep the face centered, sharp, unobstructed, and recognizable inside a circular avatar crop. Keep motion smooth, subtle, and seamless, returning to the opening pose. No cuts, camera movement, text, logos, or audio.`,
      video: { url: sourceVideo },
    }),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!start.ok) throw new Error(`Grok could not start the animation upgrade (${start.status}).`);
  const job = await start.json() as { request_id?: string };
  if (!job.request_id || !/^[A-Za-z0-9_-]{1,160}$/.test(job.request_id)) throw new Error("Grok returned an invalid animation edit job.");

  let videoUrl = "";
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    const statusResponse = await fetch(`https://api.x.ai/v1/videos/${encodeURIComponent(job.request_id)}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
    if (!statusResponse.ok) continue;
    const status = await statusResponse.json() as { status?: string; video?: { url?: string } };
    if (status.status === "failed") throw new Error("Grok could not finish the animation upgrade.");
    if (status.status === "done" && status.video?.url) { videoUrl = status.video.url; break; }
  }
  if (!videoUrl) throw new Error("Animation upgrade is still processing. The attempt is recorded; check before spending another credit.");
  const remote = new URL(videoUrl);
  if (remote.protocol !== "https:" || remote.hostname !== "vidgen.x.ai") throw new Error("Grok returned an unexpected video host.");
  const videoResponse = await fetch(remote, { signal: AbortSignal.timeout(15_000), cache: "no-store" });
  if (!videoResponse.ok || Number(videoResponse.headers.get("content-length") || 0) > 30 * 1024 * 1024) throw new Error("Grok returned a video that could not be saved.");
  const bytes = Buffer.from(await videoResponse.arrayBuffer());
  if (bytes.length < 12 || bytes.length > 30 * 1024 * 1024 || bytes.toString("ascii", 4, 8) !== "ftyp") throw new Error("Grok returned an invalid MP4 file.");
  return { bytes, contentType: "video/mp4", ext: "mp4" };
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer?.canWrite) return fail("Connect a writable Farcaster account before generating profile media.", 401);
  const key = apiKey();
  if (!key) return fail("Grok generation is not configured on this deployment.", 503);
  if (!process.env.BLOB_READ_WRITE_TOKEN && !(process.env.BLOB_STORE_ID && process.env.BLOB_WEBHOOK_PUBLIC_KEY)) return fail("Vercel Blob is required for secure, replay-protected generation storage.", 503);

  let body: { walletAddress?: unknown; requestId?: unknown; transactionHash?: unknown; signature?: unknown; prompt?: unknown; mode?: unknown; sourceImageUrl?: unknown; sourceRequestId?: unknown };
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 12_000) return fail("Request is too large.", 413);
    body = await request.json();
  } catch { return fail("Invalid request body.", 400); }

  const { walletAddress, requestId, transactionHash, signature, prompt, mode, sourceImageUrl, sourceRequestId } = body;
  if (typeof walletAddress !== "string" || !isAddress(walletAddress)) return fail("Connect a valid EVM wallet.", 400);
  if (typeof requestId !== "string" || !/^0x[0-9a-f]{64}$/i.test(requestId) || /^0x0{64}$/i.test(requestId)) return fail("Invalid generation request ID.", 400);
  if (typeof transactionHash !== "string" || !/^0x[0-9a-f]{64}$/i.test(transactionHash)) return fail("A confirmed credit-use transaction is required.", 400);
  if (typeof signature !== "string" || !/^0x[0-9a-f]{130,132}$/i.test(signature)) return fail("Wallet authorization is required.", 400);
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 1_000) return fail("Describe the image or motion in 1–1,000 characters.", 400);
  if (mode !== "image" && mode !== "animate" && mode !== "upgrade") return fail("Choose image generation, profile animation, or animation upgrade.", 400);
  if (mode !== "image") {
    if (viewer.source !== "setup" || !viewer.signerUuid) return fail("Connect your Farcaster account on this device before creating or upgrading an animation.", 401);
    try {
      const activeSigner = await neynar().lookupSigner({ signerUuid: viewer.signerUuid });
      if (activeSigner.status !== "approved" || activeSigner.fid !== viewer.fid) return fail("Reconnect your Farcaster account before creating or upgrading an animation.", 401);
    } catch { return fail("Couldn't verify your Farcaster connection right now. Try again shortly.", 503); }
  }

  const wallet = walletAddress as Address;
  const hash = transactionHash as Hex;
  const requestHex = requestId as Hex;
  const message = `Jackcaster Grok profile ${mode}\nFID: ${viewer.fid}\nWallet: ${wallet.toLowerCase()}\nRequest: ${requestHex.toLowerCase()}`;
  try {
    if (!(await verifyMessage({ address: wallet, message, signature: signature as Hex }))) return fail("Wallet authorization did not match this request.", 401);
    let animationSource: string | undefined;
    let videoSource: string | undefined;
    let sourceKind: string | null = null;
    if (mode === "animate" || mode === "upgrade") {
      if (typeof sourceImageUrl !== "string" || !sourceImageUrl.startsWith("https://")) return fail("Choose a profile image to animate.", 400);
      if (typeof sourceRequestId === "string" && /^0x[0-9a-f]{64}$/i.test(sourceRequestId)) {
        const sourcePath = `grok-requests/${wallet.toLowerCase()}/${sourceRequestId.slice(2).toLowerCase()}.json`;
        const source = await get(sourcePath, { access: process.env.GROK_REQUEST_BLOB_ACCESS === "private" ? "private" : "public" });
        if (!source || source.statusCode !== 200) return fail("That generated source image was not found for this wallet.", 403);
        const savedSource = await new Response(source.stream).json() as { mediaUrl?: unknown; mediaType?: unknown };
        const expectedType = mode === "upgrade" ? "video" : "image";
        if (savedSource.mediaType !== expectedType || savedSource.mediaUrl !== sourceImageUrl) return fail(mode === "upgrade" ? "You can only upgrade an animation generated for this connected wallet." : "You can only animate an image generated for this connected wallet.", 403);
        if (mode === "upgrade") videoSource = sourceImageUrl;
        else animationSource = sourceImageUrl;
        sourceKind = mode === "upgrade" ? "wallet-generated-animation" : "wallet-generated-image";
      } else {
        const { users } = await neynar().fetchBulkUsers({ fids: [viewer.fid] });
        const currentPfp = users[0]?.pfp_url;
        if (!currentPfp?.startsWith("https://") || currentPfp !== sourceImageUrl) return fail("The source must be your current Farcaster profile image.", 403);
        if (mode === "upgrade") {
          const currentPfpPath = new URL(currentPfp).pathname;
          if (!/\.mp4$/i.test(currentPfpPath)) return fail("Only an MP4 animated profile can be upgraded. Choose an animation you created in Jackcaster or your current MP4 profile image.", 400);
          videoSource = currentPfp;
          sourceKind = "current-farcaster-video";
        } else {
          animationSource = currentPfp;
          sourceKind = "current-farcaster-image";
        }
      }
    }
    const receipt = await baseClient.getTransactionReceipt({ hash });
    if (receipt.status !== "success") return fail("The credit-use transaction did not succeed on Base.", 402);
    const transaction = await baseClient.getTransaction({ hash });
    if (transaction.from.toLowerCase() !== wallet.toLowerCase() || transaction.to?.toLowerCase() !== ANIMATION_CREDITS_ADDRESS.toLowerCase()) return fail("The transaction does not match this wallet and credit contract.", 403);

    const hasCreditEvent = receipt.logs.some((log) => {
      if (log.address.toLowerCase() !== ANIMATION_CREDITS_ADDRESS.toLowerCase()) return false;
      try {
        const event = decodeEventLog({ abi: animationCreditsAbi, data: log.data, topics: log.topics });
        return event.eventName === "CreditUsed" && event.args.account.toLowerCase() === wallet.toLowerCase() && event.args.requestId.toLowerCase() === requestHex.toLowerCase();
      } catch { return false; }
    });
    if (!hasCreditEvent) return fail("No matching credit-use event was found for this wallet and request.", 402);

    const lockPath = `grok-requests/${wallet.toLowerCase()}/${requestHex.slice(2).toLowerCase()}.json`;
    const blobAccess = process.env.GROK_REQUEST_BLOB_ACCESS === "private" ? "private" : "public";
    const auditRecord = {
      fid: viewer.fid,
      wallet: wallet.toLowerCase(),
      requestId: requestHex.toLowerCase(),
      tx: hash.toLowerCase(),
      mode,
      sourceKind,
      sourceRequestId: typeof sourceRequestId === "string" ? sourceRequestId.toLowerCase() : null,
      status: "processing",
      startedAt: Date.now(),
    };
    console.info("Jackcaster profile-media generation started", JSON.stringify({ fid: viewer.fid, wallet: wallet.toLowerCase(), requestId: requestHex.toLowerCase(), mode, sourceKind, at: new Date(auditRecord.startedAt).toISOString() }));
    const previous = await get(lockPath, { access: blobAccess });
    if (previous?.statusCode === 200) {
      const saved = await new Response(previous.stream).json() as { mediaUrl?: unknown; mediaType?: unknown };
      if (typeof saved.mediaUrl === "string" && saved.mediaUrl.startsWith("https://")) return NextResponse.json({ mediaUrl: saved.mediaUrl, mediaType: saved.mediaType }, { headers: { "Cache-Control": "no-store" } });
      return fail("This credit is already processing or was consumed by a failed attempt. Check your profile before spending another credit.", 409);
    }
    try {
      await put(lockPath, JSON.stringify(auditRecord), {
        access: blobAccess, addRandomSuffix: false, allowOverwrite: false, contentType: "application/json", cacheControlMaxAge: 60,
      });
    } catch { return fail("This credit was already used or secure request storage failed. Check your profile before spending another credit.", 409); }

    let generated: { bytes: Buffer; contentType: string; ext: "png" | "jpg" | "mp4" };
    try {
      generated = mode === "image"
        ? await generateImage(prompt.trim(), key)
        : mode === "upgrade"
          ? await upgradeAnimation(videoSource!, prompt.trim(), key)
          : await generateAnimation(animationSource!, prompt.trim(), key);
    } catch (error) {
      console.error("Grok profile media generation failed:", error instanceof Error ? error.message : "unknown error");
      await put(lockPath, JSON.stringify({ ...auditRecord, status: "failed", failure: "provider_generation_failed", completedAt: Date.now() }), {
        access: blobAccess, addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", cacheControlMaxAge: 60,
      }).catch(() => {});
      console.info("Jackcaster profile-media generation failed", JSON.stringify({ fid: viewer.fid, wallet: wallet.toLowerCase(), requestId: requestHex.toLowerCase(), mode, at: new Date().toISOString() }));
      const detail = error instanceof Error && /^(Grok could not start|Grok could not finish|Animation is still processing|Animation upgrade is still processing)/.test(error.message)
        ? ` ${error.message}`
        : "";
      return fail(`Grok could not complete this generation.${detail} The onchain credit was spent for this attempt.`, 502);
    }

    try {
      const mediaPath = `pfp/grok-${viewer.fid}-${requestHex.slice(2).toLowerCase()}.${generated.ext}`;
      const blob = await put(mediaPath, generated.bytes, {
        access: blobAccess, addRandomSuffix: true, allowOverwrite: false, contentType: generated.contentType, cacheControlMaxAge: 31_536_000,
      });
      const mediaUrl = blobAccess === "private" ? `${new URL(request.url).origin}/i/${blob.pathname}` : blob.url;
      const mediaType = generated.ext === "mp4" ? "video" : "image";
      const completedAt = Date.now();
      await put(lockPath, JSON.stringify({ ...auditRecord, status: "completed", mediaUrl, mediaType, completedAt }), {
        access: blobAccess, addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", cacheControlMaxAge: 60,
      });
      console.info("Jackcaster profile-media generation completed", JSON.stringify({ fid: viewer.fid, wallet: wallet.toLowerCase(), requestId: requestHex.toLowerCase(), mode, mediaType, at: new Date(completedAt).toISOString() }));
      return NextResponse.json({ mediaUrl, mediaType, requestId: requestHex }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      await put(lockPath, JSON.stringify({ ...auditRecord, status: "failed", failure: "media_storage_failed", completedAt: Date.now() }), {
        access: blobAccess, addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", cacheControlMaxAge: 60,
      }).catch(() => {});
      throw error;
    }
  } catch (error) {
    console.error("Grok profile media request failed:", error instanceof Error ? error.message : "unknown error");
    return fail("Could not verify or save this generation. Check Base confirmation and your Vercel Blob setup.", 502);
  }
}
