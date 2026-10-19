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
const ANIMATION_MODEL = "grok-imagine-video-1.5-lite";
const ANIMATION_EDIT_MODEL = "grok-imagine-video";

async function providerError(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  try {
    const body = JSON.parse(text) as { error?: unknown; message?: unknown; detail?: unknown; code?: unknown };
    const error = body.error && typeof body.error === "object" ? body.error as Record<string, unknown> : null;
    const candidates = [body.error, error?.message, body.message, body.detail, body.code];
    const detail = candidates.find((value): value is string => typeof value === "string" && value.trim().length > 0);
    if (detail) {
      const safe = detail
        .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
        .replace(/xai-[A-Za-z0-9_-]+/gi, "[redacted]")
        .replace(/\s+/g, " ")
        .slice(0, 240);
      return `${response.status}: ${safe}`;
    }
  } catch { /* Keep provider response parsing defensive. */ }
  return String(response.status);
}

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

async function startAnimation(sourceImage: string, prompt: string, key: string): Promise<string> {
  const start = await fetch("https://api.x.ai/v1/videos/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: ANIMATION_MODEL,
      prompt: `Create a polished, silent, seamless five-second looping profile animation from this image. ${prompt} Preserve the exact identity, face, expression, clothing, and framing of the original subject. Keep the face centered, sharp, unobstructed, and recognizable inside a circular avatar crop. Animate only gentle background light and small natural motion; keep all motion smooth and restrained, return to the opening pose for a clean loop, use no cuts, camera movement, text, logos, or audio.`,
      image: { url: sourceImage },
      duration: 5,
      resolution: "480p",
      generate_audio: false,
    }),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!start.ok) throw new Error(`Grok could not start the animation (${await providerError(start)}).`);
  const job = await start.json() as { request_id?: string };
  if (!job.request_id || !/^[A-Za-z0-9_-]{1,160}$/.test(job.request_id)) throw new Error("Grok returned an invalid animation job.");
  return job.request_id;
}

async function startAnimationUpgrade(sourceVideo: string, prompt: string, key: string): Promise<string> {
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
  if (!start.ok) throw new Error(`Grok could not start the animation upgrade (${await providerError(start)}).`);
  const job = await start.json() as { request_id?: string };
  if (!job.request_id || !/^[A-Za-z0-9_-]{1,160}$/.test(job.request_id)) throw new Error("Grok returned an invalid animation edit job.");
  return job.request_id;
}

async function downloadVideo(videoUrl: string): Promise<Buffer> {
  const remote = new URL(videoUrl);
  if (remote.protocol !== "https:" || remote.hostname !== "vidgen.x.ai") throw new Error("Grok returned an unexpected video host.");
  const response = await fetch(remote, { signal: AbortSignal.timeout(20_000), cache: "no-store" });
  if (!response.ok || Number(response.headers.get("content-length") || 0) > 30 * 1024 * 1024) throw new Error("Grok returned a video that could not be saved.");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 12 || bytes.length > 30 * 1024 * 1024 || bytes.toString("ascii", 4, 8) !== "ftyp") throw new Error("Grok returned an invalid MP4 file.");
  return bytes;
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

    if (mode !== "image") {
      try {
        const providerRequestId = mode === "upgrade"
          ? await startAnimationUpgrade(videoSource!, prompt.trim(), key)
          : await startAnimation(animationSource!, prompt.trim(), key);
        await put(lockPath, JSON.stringify({ ...auditRecord, status: "processing", providerRequestId }), {
          access: blobAccess, addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", cacheControlMaxAge: 60,
        });
        return NextResponse.json({ processing: true, requestId: requestHex }, { status: 202, headers: { "Cache-Control": "no-store" } });
      } catch (error) {
        console.error("Grok profile animation could not start:", error instanceof Error ? error.message : "unknown error");
        await put(lockPath, JSON.stringify({ ...auditRecord, status: "failed", failure: "provider_start_failed", completedAt: Date.now() }), {
          access: blobAccess, addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", cacheControlMaxAge: 60,
        }).catch(() => {});
        const detail = error instanceof Error && /^(Grok could not start)/.test(error.message) ? ` ${error.message}` : "";
        return fail(`Grok could not start this animation.${detail} The onchain credit was spent for this attempt.`, 502);
      }
    }

    let generated: { bytes: Buffer; contentType: string; ext: "png" | "jpg" | "mp4" };
    try {
      generated = await generateImage(prompt.trim(), key);
    } catch (error) {
      console.error("Grok profile media generation failed:", error instanceof Error ? error.message : "unknown error");
      await put(lockPath, JSON.stringify({ ...auditRecord, status: "failed", failure: "provider_generation_failed", completedAt: Date.now() }), {
        access: blobAccess, addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", cacheControlMaxAge: 60,
      }).catch(() => {});
      console.info("Jackcaster profile-media generation failed", JSON.stringify({ fid: viewer.fid, wallet: wallet.toLowerCase(), requestId: requestHex.toLowerCase(), mode, at: new Date().toISOString() }));
      const detail = error instanceof Error && /^(Grok could not start|Grok could not finish|Grok status check failed|Grok animation upgrade status check failed|Animation is still processing|Animation upgrade is still processing)/.test(error.message)
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

/** Free preflight: confirm this deployment's xAI key can use the animation model before a credit is spent. */
export async function GET(request: Request) {
  const viewer = await getViewer();
  if (!viewer?.canWrite || viewer.source !== "setup" || !viewer.signerUuid) {
    return fail("Connect Farcaster on this device before animating your profile. No credit was used.", 401);
  }
  const requestUrl = new URL(request.url);
  const pendingRequestId = requestUrl.searchParams.get("requestId");
  if (pendingRequestId) {
    const walletAddress = requestUrl.searchParams.get("walletAddress");
    if (!walletAddress || !isAddress(walletAddress) || !/^0x[0-9a-f]{64}$/i.test(pendingRequestId)) return fail("Invalid animation status request.", 400);
    const wallet = walletAddress.toLowerCase();
    const requestId = pendingRequestId.toLowerCase();
    const lockPath = `grok-requests/${wallet}/${requestId.slice(2)}.json`;
    const blobAccess = process.env.GROK_REQUEST_BLOB_ACCESS === "private" ? "private" : "public";
    try {
      const lock = await get(lockPath, { access: blobAccess });
      if (!lock || lock.statusCode !== 200) return fail("Animation request was not found for this wallet.", 404);
      const record = await new Response(lock.stream).json() as {
        fid?: unknown; wallet?: unknown; requestId?: unknown; mode?: unknown; status?: unknown; providerRequestId?: unknown;
        mediaUrl?: unknown; mediaType?: unknown; startedAt?: unknown;
      };
      if (record.fid !== viewer.fid || record.wallet !== wallet || record.requestId !== requestId || (record.mode !== "animate" && record.mode !== "upgrade")) {
        return fail("Animation request does not belong to this Farcaster account and wallet.", 403);
      }
      if (record.status === "completed" && typeof record.mediaUrl === "string") {
        return NextResponse.json({ mediaUrl: record.mediaUrl, mediaType: record.mediaType, requestId }, { headers: { "Cache-Control": "no-store" } });
      }
      if (record.status === "failed") return fail("Grok could not complete this animation. The onchain credit was spent for this attempt.", 502);
      if (typeof record.providerRequestId !== "string" || !/^[A-Za-z0-9_-]{1,160}$/.test(record.providerRequestId)) {
        return fail("The animation job is not available to resume. Check the profile before spending another credit.", 409);
      }
      const key = apiKey();
      if (!key) return fail("Grok is not configured on this deployment. The animation job remains saved.", 503);
      const statusResponse = await fetch(`https://api.x.ai/v1/videos/${encodeURIComponent(record.providerRequestId)}`, {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(8_000),
        cache: "no-store",
      });
      if (!statusResponse.ok) {
        if (statusResponse.status === 401 || statusResponse.status === 403) {
          return fail(`Grok could not check the animation job (${await providerError(statusResponse)}). The job is still saved; check xAI key access or team billing, then resume it.`, 503);
        }
        return fail(`Grok status check returned ${statusResponse.status}; the animation job is still saved. Try checking again shortly.`, 503);
      }
      const providerStatus = await statusResponse.json() as { status?: string; video?: { url?: string } };
      if (providerStatus.status === "failed") {
        await put(lockPath, JSON.stringify({ ...record, status: "failed", failure: "provider_generation_failed", completedAt: Date.now() }), {
          access: blobAccess, addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", cacheControlMaxAge: 60,
        }).catch(() => {});
        return fail("Grok could not complete this animation. The onchain credit was spent for this attempt.", 502);
      }
      if (providerStatus.status !== "done" || !providerStatus.video?.url) {
        return NextResponse.json({ processing: true, requestId }, { status: 202, headers: { "Cache-Control": "no-store" } });
      }
      const bytes = await downloadVideo(providerStatus.video.url);
      const mediaPath = `pfp/grok-${viewer.fid}-${requestId.slice(2)}.mp4`;
      const blob = await put(mediaPath, bytes, {
        access: blobAccess, addRandomSuffix: true, allowOverwrite: false, contentType: "video/mp4", cacheControlMaxAge: 31_536_000,
      });
      const mediaUrl = blobAccess === "private" ? `${new URL(request.url).origin}/i/${blob.pathname}` : blob.url;
      await put(lockPath, JSON.stringify({ ...record, status: "completed", mediaUrl, mediaType: "video", completedAt: Date.now() }), {
        access: blobAccess, addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", cacheControlMaxAge: 60,
      });
      console.info("Jackcaster profile animation completed", JSON.stringify({ fid: viewer.fid, wallet, requestId, mode: record.mode, at: new Date().toISOString() }));
      return NextResponse.json({ mediaUrl, mediaType: "video", requestId }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      console.error("Grok profile animation status check failed:", error instanceof Error ? error.message : "unknown error");
      return fail("Couldn't check or save this animation right now. Its job remains saved; try checking again.", 503);
    }
  }

  const key = apiKey();
  if (!key) return fail("Grok is not configured on this deployment. No credit was used.", 503);
  if (!process.env.BLOB_READ_WRITE_TOKEN && !(process.env.BLOB_STORE_ID && process.env.BLOB_WEBHOOK_PUBLIC_KEY)) {
    return fail("Vercel Blob is not configured to save the animation. No credit was used.", 503);
  }
  const model = requestUrl.searchParams.get("mode") === "upgrade" ? ANIMATION_EDIT_MODEL : ANIMATION_MODEL;
  try {
    const modelResponse = await fetch(`https://api.x.ai/v1/video-generation-models/${encodeURIComponent(model)}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!modelResponse.ok) {
      const advice = modelResponse.status === 401
        ? "Check that the xAI API key is active and belongs to the intended team."
        : modelResponse.status === 403
          ? "Check the xAI team's available API credits and monthly spending limit."
          : "Try again shortly.";
      return fail(`xAI preflight failed (${await providerError(modelResponse)}). ${advice} No Jackcaster credit was used.`, 503);
    }
    return NextResponse.json({ ready: true, model }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return fail("Couldn't check xAI video access. No credit was used; try again shortly.", 503);
  }
}
