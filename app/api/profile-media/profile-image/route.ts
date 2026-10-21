import { get, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { base } from "@/lib/base-chain";
import { createPublicClient, decodeEventLog, http, isAddress, verifyMessage, type Address, type Hex } from "viem";
import { ANIMATION_CREDITS_ADDRESS, animationCreditsAbi } from "@/lib/animation-credits";
import { getViewer } from "@/lib/viewer";
import { getPrefs } from "@/lib/prefs";

export const runtime = "nodejs";
export const maxDuration = 60;

const baseClient = createPublicClient({ chain: base, transport: http("https://mainnet.base.org", { timeout: 15_000 }) });
const apiKey = () => process.env.GOOGLE_AI_API_KEY;
const IMAGE_MODEL = "gemini-nano-banana-2.1";
const LEGACY_ANIMATION_MODEL = "veo-3.1-lite-generate-preview";
const GOOGLE_API = "https://generativelanguage.googleapis.com/v1beta";

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
        .replace(/AIza[A-Za-z0-9_-]+/gi, "[redacted]")
        .replace(/\s+/g, " ")
        .slice(0, 240);
      return `${response.status}: ${safe}`;
    }
  } catch { /* Keep provider response parsing defensive. */ }
  return String(response.status);
}

/** Keep a short, useful provider diagnostic in the request record for later polls. */
function safeFailureMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : "Unknown provider error";
  return raw
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/AIza[A-Za-z0-9_-]+/gi, "[redacted]")
    .replace(/xai-[A-Za-z0-9_-]+/gi, "[redacted]")
    .replace(/\s+/g, " ")
    .slice(0, 280);
}

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

async function generateImage(prompt: string, key: string): Promise<{ bytes: Buffer; contentType: string; ext: "png" | "jpg" }> {
  const response = await fetch(`${GOOGLE_API}/interactions`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json", "Api-Revision": "2026-05-20" },
    body: JSON.stringify({ model: IMAGE_MODEL, input: `Create a polished, square Farcaster profile picture. ${prompt}. No text, no watermark.`, response_format: { type: "image", aspect_ratio: "1:1", image_size: "1K" } }),
    signal: AbortSignal.timeout(45_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Google image generation failed (${await providerError(response)}).`);
  const result = await response.json() as { output_image?: { data?: string; mime_type?: string }; steps?: { type?: string; content?: { type?: string; data?: string; mime_type?: string }[] }[] };
  const image = result.output_image ?? result.steps?.flatMap((step) => step.type === "model_output" ? step.content ?? [] : []).find((part) => part.type === "image");
  const encoded = image?.data;
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error("Google returned an invalid image.");
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length < 8 || bytes.length > 12 * 1024 * 1024) throw new Error("Google image size is unsupported.");
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { bytes, contentType: "image/png", ext: "png" };
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { bytes, contentType: "image/jpeg", ext: "jpg" };
  throw new Error("Google returned an unsupported image format.");
}

function decodeVideo(encoded?: string): Buffer {
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error("Google did not return a usable video file.");
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length < 12 || bytes.length > 30 * 1024 * 1024 || bytes.toString("ascii", 4, 8) !== "ftyp") throw new Error("Google returned an invalid MP4 file.");
  return bytes;
}

async function downloadVideo(videoUrl: string): Promise<Buffer> {
  const remote = new URL(videoUrl);
  if (remote.protocol !== "https:" || !["generativelanguage.googleapis.com", "storage.googleapis.com"].includes(remote.hostname)) throw new Error("Google returned an unexpected video host.");
  const response = await fetch(remote, { headers: { "x-goog-api-key": apiKey() || "" }, signal: AbortSignal.timeout(20_000), cache: "no-store" });
  if (!response.ok) throw new Error(`Google video download failed (${await providerError(response)}).`);
  if (Number(response.headers.get("content-length") || 0) > 30 * 1024 * 1024) throw new Error("Google returned a video larger than Jackcaster can save.");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 12 || bytes.length > 30 * 1024 * 1024 || bytes.toString("ascii", 4, 8) !== "ftyp") throw new Error("Google returned an invalid MP4 file.");
  return bytes;
}

async function getInteractionVideo(interactionId: string, key: string): Promise<{ status: "processing" } | { status: "failed"; error: string } | { status: "complete"; bytes: Buffer }> {
  const response = await fetch(`${GOOGLE_API}/interactions/${encodeURIComponent(interactionId)}`, {
    headers: { "x-goog-api-key": key, "Api-Revision": "2026-05-20" },
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Google interaction status check failed (${await providerError(response)}).`);
  const interaction = await response.json() as {
    status?: string;
    error?: { message?: string } | string;
    output_video?: { data?: string; uri?: string };
    steps?: { type?: string; content?: { type?: string; data?: string; uri?: string }[] }[];
  };
  if (interaction.status === "in_progress" || interaction.status === "queued" || interaction.status === "requires_action") return { status: "processing" };
  if (interaction.status !== "completed") {
    const detail = typeof interaction.error === "string" ? interaction.error : interaction.error?.message;
    return { status: "failed", error: safeFailureMessage(new Error(detail || `Google finished the job as ${interaction.status || "incomplete"}.`)) };
  }

  const video = interaction.output_video ?? interaction.steps?.flatMap((step) => step.type === "model_output" ? step.content ?? [] : []).find((part) => part.type === "video");
  if (video?.uri) {
    const fileUrl = new URL(video.uri);
    const fileId = fileUrl.pathname.match(/\/v1beta\/files\/([^/:]+)/)?.[1];
    if (fileId && fileUrl.hostname === "generativelanguage.googleapis.com") {
      const fileResponse = await fetch(`${GOOGLE_API}/files/${encodeURIComponent(fileId)}`, {
        headers: { "x-goog-api-key": key },
        signal: AbortSignal.timeout(8_000),
        cache: "no-store",
      });
      if (!fileResponse.ok) throw new Error(`Google video file check failed (${await providerError(fileResponse)}).`);
      const file = await fileResponse.json() as { state?: string };
      if (file.state === "FAILED") return { status: "failed", error: "Google could not finish preparing the animation video." };
      if (file.state !== "ACTIVE") return { status: "processing" };
    }
    return { status: "complete", bytes: await downloadVideo(video.uri) };
  }
  if (video?.data) return { status: "complete", bytes: decodeVideo(video.data) };
  return { status: "failed", error: "Google marked the animation complete but did not return an MP4 video." };
}

export async function POST(request: Request) {
  if ((await getPrefs()).disabledServices.includes("gemini")) return fail("Gemini image tools are turned off in this device's privacy choices.", 403);
  let body: { walletAddress?: unknown; requestId?: unknown; transactionHash?: unknown; signature?: unknown; prompt?: unknown; mode?: unknown };
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 12_000) return fail("Request is too large.", 413);
    body = await request.json();
  } catch { return fail("Invalid request body.", 400); }

  const { walletAddress, requestId, transactionHash, signature, prompt, mode } = body;
  if (mode === "animate" || mode === "upgrade") {
    return fail("Profile animation is paused. No Google generation was started. If you already confirmed a credit-use transaction, the contract still records that credit as spent.", 503);
  }

  const viewer = await getViewer();
  if (!viewer?.canWrite) return fail("Connect a writable Farcaster account before generating profile media.", 401);
  const key = apiKey();
  if (!key) return fail("Google AI generation is not configured on this deployment.", 503);
  if (!process.env.BLOB_READ_WRITE_TOKEN && !(process.env.BLOB_STORE_ID && process.env.BLOB_WEBHOOK_PUBLIC_KEY)) return fail("Vercel Blob is required for secure, replay-protected generation storage.", 503);
  if (typeof walletAddress !== "string" || !isAddress(walletAddress)) return fail("Connect a valid EVM wallet.", 400);
  if (typeof requestId !== "string" || !/^0x[0-9a-f]{64}$/i.test(requestId) || /^0x0{64}$/i.test(requestId)) return fail("Invalid generation request ID.", 400);
  if (typeof transactionHash !== "string" || !/^0x[0-9a-f]{64}$/i.test(transactionHash)) return fail("A confirmed credit-use transaction is required.", 400);
  if (typeof signature !== "string" || !/^0x[0-9a-f]{130,132}$/i.test(signature)) return fail("Wallet authorization is required.", 400);
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 1_000) return fail("Describe the image in 1–1,000 characters.", 400);
  if (mode !== "image") return fail("Only still profile artwork is available right now.", 400);

  const wallet = walletAddress as Address;
  const hash = transactionHash as Hex;
  const requestHex = requestId as Hex;
  const message = `Jackcaster Google profile image\nFID: ${viewer.fid}\nWallet: ${wallet.toLowerCase()}\nRequest: ${requestHex.toLowerCase()}`;
  try {
    if (!(await verifyMessage({ address: wallet, message, signature: signature as Hex }))) return fail("Wallet authorization did not match this request.", 401);
    const sourceKind: string | null = null;
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

    const lockPath = `profile-requests/${wallet.toLowerCase()}/${requestHex.slice(2).toLowerCase()}.json`;
    const blobAccess = process.env.PROFILE_REQUEST_BLOB_ACCESS === "private" ? "private" : "public";
    const auditRecord = {
      fid: viewer.fid,
      wallet: wallet.toLowerCase(),
      requestId: requestHex.toLowerCase(),
      tx: hash.toLowerCase(),
      mode,
      sourceKind,
      sourceRequestId: null,
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

    let generated: { bytes: Buffer; contentType: string; ext: "png" | "jpg" };
    try {
      generated = await generateImage(prompt.trim(), key);
    } catch (error) {
      console.error("Google profile media generation failed:", error instanceof Error ? error.message : "unknown error");
      await put(lockPath, JSON.stringify({ ...auditRecord, status: "failed", failure: "provider_generation_failed", completedAt: Date.now() }), {
        access: blobAccess, addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", cacheControlMaxAge: 60,
      }).catch(() => {});
      console.info("Jackcaster profile-media generation failed", JSON.stringify({ fid: viewer.fid, wallet: wallet.toLowerCase(), requestId: requestHex.toLowerCase(), mode, at: new Date().toISOString() }));
      const detail = error instanceof Error && /^(Google could not start|Google could not edit|Google image generation failed)/.test(error.message)
        ? ` ${error.message}`
        : "";
      return fail(`Google could not complete this generation.${detail} The onchain credit was spent for this attempt.`, 502);
    }

    try {
      const mediaPath = `pfp/jackcaster-${viewer.fid}-${requestHex.slice(2).toLowerCase()}.${generated.ext}`;
      const blob = await put(mediaPath, generated.bytes, {
        access: blobAccess, addRandomSuffix: true, allowOverwrite: false, contentType: generated.contentType, cacheControlMaxAge: 31_536_000,
      });
      const mediaUrl = blobAccess === "private" ? `${new URL(request.url).origin}/i/${blob.pathname}` : blob.url;
      const mediaType = "image" as const;
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
    console.error("Google profile media request failed:", error instanceof Error ? error.message : "unknown error");
    return fail("Could not verify or save this generation. Check Base confirmation and your Vercel Blob setup.", 502);
  }
}

/** Free preflight: confirm the deployment key can access the selected Google model before a credit is spent. */
export async function GET(request: Request) {
  if ((await getPrefs()).disabledServices.includes("gemini")) return fail("Gemini image tools are turned off in this device's privacy choices.", 403);
  const viewer = await getViewer();
  const requestUrl = new URL(request.url);
  const mode = requestUrl.searchParams.get("mode") || "animate";
  if (mode !== "image" && mode !== "animate" && mode !== "upgrade") return fail("Choose image generation, profile animation, or animation upgrade.", 400);
  const pendingRequestId = requestUrl.searchParams.get("requestId");
  if (!pendingRequestId && mode !== "image") return fail("Profile animation is temporarily paused. No Jackcaster credit was used.", 503);
  if (!viewer?.canWrite) return fail("Connect a writable Farcaster account first. No credit was used.", 401);
  if (mode !== "image" && (viewer.source !== "setup" || !viewer.signerUuid)) {
    return fail("Connect Farcaster on this device before animating your profile. No credit was used.", 401);
  }
  if (pendingRequestId) {
    const walletAddress = requestUrl.searchParams.get("walletAddress");
    if (!walletAddress || !isAddress(walletAddress) || !/^0x[0-9a-f]{64}$/i.test(pendingRequestId)) return fail("Invalid animation status request.", 400);
    const wallet = walletAddress.toLowerCase();
    const requestId = pendingRequestId.toLowerCase();
    const lockPath = `profile-requests/${wallet}/${requestId.slice(2)}.json`;
    const blobAccess = process.env.PROFILE_REQUEST_BLOB_ACCESS === "private" ? "private" : "public";
    try {
      const lock = await get(lockPath, { access: blobAccess });
      if (!lock || lock.statusCode !== 200) return fail("Animation request was not found for this wallet.", 404);
      const record = await new Response(lock.stream).json() as {
        fid?: unknown; wallet?: unknown; requestId?: unknown; mode?: unknown; status?: unknown; providerRequestId?: unknown;
        mediaUrl?: unknown; mediaType?: unknown; startedAt?: unknown; failureMessage?: unknown;
      };
      if (record.fid !== viewer.fid || record.wallet !== wallet || record.requestId !== requestId || (record.mode !== "animate" && record.mode !== "upgrade")) {
        return fail("Animation request does not belong to this Farcaster account and wallet.", 403);
      }
      if (record.status === "completed" && typeof record.mediaUrl === "string") {
        return NextResponse.json({ mediaUrl: record.mediaUrl, mediaType: record.mediaType, requestId }, { headers: { "Cache-Control": "no-store" } });
      }
      if (record.status === "failed") {
        const detail = typeof record.failureMessage === "string" ? ` ${record.failureMessage.slice(0, 280)}` : "";
        return fail(`Google could not complete this animation.${detail} The onchain credit was spent for this attempt.`, 502);
      }
      const providerRequestId = record.providerRequestId;
      const isGoogleInteraction = typeof providerRequestId === "string" && /^v1_[A-Za-z0-9_+=/-]{8,512}$/.test(providerRequestId);
      const isLegacyOperation = typeof providerRequestId === "string" && new RegExp(`^models/${LEGACY_ANIMATION_MODEL}/operations/[^\\s]{1,240}$`).test(providerRequestId);
      if (!isGoogleInteraction && !isLegacyOperation) return fail("The animation job is not available to resume. Check the profile before spending another credit.", 409);
      const key = apiKey();
      if (!key) return fail("Google AI is not configured on this deployment. The animation job remains saved.", 503);
      if (isGoogleInteraction) {
        try {
          const result = await getInteractionVideo(providerRequestId!, key);
          if (result.status === "processing") return NextResponse.json({ processing: true, requestId }, { status: 202, headers: { "Cache-Control": "no-store" } });
          if (result.status === "failed") {
            await put(lockPath, JSON.stringify({ ...record, status: "failed", failure: "provider_generation_failed", failureMessage: result.error, completedAt: Date.now() }), {
              access: blobAccess, addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", cacheControlMaxAge: 60,
            }).catch(() => {});
            return fail(`Google could not complete this animation: ${result.error}. The onchain credit was spent for this attempt.`, 502);
          }
          const mediaPath = `pfp/jackcaster-${viewer.fid}-${requestId.slice(2)}.mp4`;
          const blob = await put(mediaPath, result.bytes, {
            access: blobAccess, addRandomSuffix: true, allowOverwrite: false, contentType: "video/mp4", cacheControlMaxAge: 31_536_000,
          });
          const mediaUrl = blobAccess === "private" ? `${new URL(request.url).origin}/i/${blob.pathname}` : blob.url;
          await put(lockPath, JSON.stringify({ ...record, status: "completed", mediaUrl, mediaType: "video", completedAt: Date.now() }), {
            access: blobAccess, addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", cacheControlMaxAge: 60,
          });
          console.info("Jackcaster profile video completed", JSON.stringify({ fid: viewer.fid, wallet, requestId, mode: record.mode, at: new Date().toISOString() }));
          return NextResponse.json({ mediaUrl, mediaType: "video", requestId }, { headers: { "Cache-Control": "no-store" } });
        } catch (error) {
          const detail = safeFailureMessage(error);
          console.error("Google profile video status check failed:", detail);
          if (/429:.*(?:Free Tier|0 requests per day)/i.test(detail)) {
            return fail("Gemini Omni video is unavailable on this Google Free Tier (0 requests per day). Your saved job is still available. After enabling paid video access, resume this job; it will not spend another Jackcaster credit.", 503);
          }
          return fail(`Couldn't check or save this animation right now: ${detail}. Its job remains saved; try checking again.`, 503);
        }
      }
      const statusResponse = await fetch(`${GOOGLE_API}/${record.providerRequestId}`, {
        headers: { "x-goog-api-key": key },
        signal: AbortSignal.timeout(8_000),
        cache: "no-store",
      });
      if (!statusResponse.ok) {
        if (statusResponse.status === 401 || statusResponse.status === 403) {
          return fail(`Google could not check the animation job (${await providerError(statusResponse)}). The job is still saved; check Google AI API access and billing, then resume it.`, 503);
        }
        return fail(`Google animation status check returned ${statusResponse.status}; the job is still saved. Try checking again shortly.`, 503);
      }
      const providerStatus = await statusResponse.json() as { done?: boolean; error?: { message?: string }; response?: { generateVideoResponse?: { generatedSamples?: { video?: { uri?: string } }[] } } };
      if (providerStatus.error) {
        const failureMessage = safeFailureMessage(new Error(providerStatus.error.message || "Google reported an animation error."));
        await put(lockPath, JSON.stringify({ ...record, status: "failed", failure: "provider_generation_failed", failureMessage, completedAt: Date.now() }), {
          access: blobAccess, addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", cacheControlMaxAge: 60,
        }).catch(() => {});
        return fail(`Google could not complete this animation: ${failureMessage}. The onchain credit was spent for this attempt.`, 502);
      }
      if (!providerStatus.done) {
        return NextResponse.json({ processing: true, requestId }, { status: 202, headers: { "Cache-Control": "no-store" } });
      }
      const videoUrl = providerStatus.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
      if (!videoUrl) throw new Error("Google completed the animation without returning a video file.");
      const bytes = await downloadVideo(videoUrl);
      const mediaPath = `pfp/jackcaster-${viewer.fid}-${requestId.slice(2)}.mp4`;
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
      const detail = safeFailureMessage(error);
      console.error("Google profile animation status check failed:", detail);
      return fail(`Couldn't check or save this animation right now: ${detail}. Its job remains saved; try checking again.`, 503);
    }
  }

  const key = apiKey();
  if (!key) return fail("Google AI is not configured on this deployment. No credit was used.", 503);
  if (!process.env.BLOB_READ_WRITE_TOKEN && !(process.env.BLOB_STORE_ID && process.env.BLOB_WEBHOOK_PUBLIC_KEY)) {
    return fail("Vercel Blob is not configured to save profile artwork. No credit was used.", 503);
  }
  const model = IMAGE_MODEL;
  try {
    const modelResponse = await fetch(`${GOOGLE_API}/models/${encodeURIComponent(model)}`, {
      headers: { "x-goog-api-key": key },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!modelResponse.ok) {
      const advice = modelResponse.status === 401
        ? "Check that GOOGLE_AI_API_KEY is active and the Gemini API is enabled for its project."
        : modelResponse.status === 403
          ? "Check that the Google project has access to this image model."
          : "Try again shortly.";
      return fail(`Google AI preflight failed (${await providerError(modelResponse)}). ${advice} No Jackcaster credit was used.`, 503);
    }
    return NextResponse.json({ ready: true, model }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return fail("Couldn't check Google AI model access. No credit was used; try again shortly.", 503);
  }
}
