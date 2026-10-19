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
const apiKey = () => process.env.GOOGLE_AI_API_KEY;
const ANIMATION_MODEL = "veo-3.1-lite-generate-preview";
const IMAGE_MODEL = "gemini-nano-banana-2.1";
const VIDEO_EDIT_MODEL = "gemini-omni-1.1-flash";
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

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

async function generateImage(prompt: string, key: string): Promise<{ bytes: Buffer; contentType: string; ext: "png" | "jpg" }> {
  const response = await fetch(`${GOOGLE_API}/interactions`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
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

async function readRemoteMedia(url: string, maxBytes: number, allowedTypes: string[]): Promise<{ bytes: Buffer; mimeType: string }> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error("The selected media URL is not a safe HTTPS address.");
  const response = await fetch(parsed, { redirect: "error", signal: AbortSignal.timeout(15_000), cache: "no-store" });
  if (!response.ok) throw new Error("The selected profile media could not be retrieved.");
  const declared = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const length = Number(response.headers.get("content-length") || 0);
  if (length > maxBytes || !allowedTypes.includes(declared)) throw new Error("The selected media format or size is not supported.");
  if (!response.body) throw new Error("The selected profile media could not be read.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error("The selected media exceeds the supported size.");
    }
    chunks.push(value);
  }
  const bytes = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  if (!bytes.length) throw new Error("The selected profile media is empty.");
  return { bytes, mimeType: declared };
}

async function startAnimation(sourceImage: string, prompt: string, key: string): Promise<string> {
  const source = await readRemoteMedia(sourceImage, 10 * 1024 * 1024, ["image/png", "image/jpeg", "image/webp"]);
  const start = await fetch(`${GOOGLE_API}/models/${ANIMATION_MODEL}:predictLongRunning`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ instances: [{ prompt: `Create a short, polished profile animation from this portrait. ${prompt} Preserve the exact identity, face, expression, clothing, and framing. Keep the face centered, sharp, unobstructed, and recognizable inside a circular avatar crop. Use subtle natural motion, one continuous shot, no cuts, camera movement, text, or logos. Keep the scene quiet with no speech or music.` , image: { inlineData: { mimeType: source.mimeType, data: source.bytes.toString("base64") } } }], parameters: { aspectRatio: "9:16", durationSeconds: "4", resolution: "720p", personGeneration: "allow_adult" } }),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!start.ok) throw new Error(`Google could not start the animation (${await providerError(start)}).`);
  const job = await start.json() as { name?: string };
  if (!job.name || !/^models\/[^\s]{1,240}\/operations\/[^\s]{1,240}$/.test(job.name)) throw new Error("Google returned an invalid animation job.");
  return job.name;
}

async function generateAnimationUpgrade(sourceVideo: string, prompt: string, key: string): Promise<Buffer> {
  const source = await readRemoteMedia(sourceVideo, 4 * 1024 * 1024, ["video/mp4"]);
  const start = await fetch(`${GOOGLE_API}/interactions`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ model: VIDEO_EDIT_MODEL, input: [{ type: "video", data: source.bytes.toString("base64"), mime_type: source.mimeType }, { type: "text", text: `Refine this animated profile image: ${prompt}. Preserve the same identity, face, expression, clothing and framing. Keep the face clear and centered in a circular avatar crop. Use subtle motion, one continuous shot, no cuts, no text, no speech, no music. Keep everything else the same.` }], response_format: { type: "video", resolution: "360p" }, generation_config: { video_config: { task: "edit" } } }),
    signal: AbortSignal.timeout(55_000),
    cache: "no-store",
  });
  if (!start.ok) throw new Error(`Google could not edit the animation (${await providerError(start)}).`);
  const interaction = await start.json() as { output_video?: { data?: string }; steps?: { type?: string; content?: { type?: string; data?: string }[] }[] };
  const encoded = interaction.output_video?.data ?? interaction.steps?.flatMap((step) => step.type === "model_output" ? step.content ?? [] : []).find((part) => part.type === "video")?.data;
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error("Google did not return a usable video. Try a new animation from a still image.");
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length < 12 || bytes.length > 30 * 1024 * 1024 || bytes.toString("ascii", 4, 8) !== "ftyp") throw new Error("Google returned an invalid MP4 file.");
  return bytes;
}

async function downloadVideo(videoUrl: string): Promise<Buffer> {
  const remote = new URL(videoUrl);
  if (remote.protocol !== "https:" || !["generativelanguage.googleapis.com", "storage.googleapis.com"].includes(remote.hostname)) throw new Error("Google returned an unexpected video host.");
  const response = await fetch(remote, { headers: { "x-goog-api-key": apiKey() || "" }, signal: AbortSignal.timeout(20_000), cache: "no-store" });
  if (!response.ok || Number(response.headers.get("content-length") || 0) > 30 * 1024 * 1024) throw new Error("Google returned a video that could not be saved.");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 12 || bytes.length > 30 * 1024 * 1024 || bytes.toString("ascii", 4, 8) !== "ftyp") throw new Error("Google returned an invalid MP4 file.");
  return bytes;
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer?.canWrite) return fail("Connect a writable Farcaster account before generating profile media.", 401);
  const key = apiKey();
  if (!key) return fail("Google AI generation is not configured on this deployment.", 503);
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
  const message = `Jackcaster Google profile ${mode}\nFID: ${viewer.fid}\nWallet: ${wallet.toLowerCase()}\nRequest: ${requestHex.toLowerCase()}`;
  try {
    if (!(await verifyMessage({ address: wallet, message, signature: signature as Hex }))) return fail("Wallet authorization did not match this request.", 401);
    let animationSource: string | undefined;
    let videoSource: string | undefined;
    let sourceKind: string | null = null;
    if (mode === "animate" || mode === "upgrade") {
      if (typeof sourceImageUrl !== "string" || !sourceImageUrl.startsWith("https://")) return fail("Choose a profile image to animate.", 400);
      if (typeof sourceRequestId === "string" && /^0x[0-9a-f]{64}$/i.test(sourceRequestId)) {
        const sourcePath = `profile-requests/${wallet.toLowerCase()}/${sourceRequestId.slice(2).toLowerCase()}.json`;
        const source = await get(sourcePath, { access: process.env.PROFILE_REQUEST_BLOB_ACCESS === "private" ? "private" : "public" });
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

    const lockPath = `profile-requests/${wallet.toLowerCase()}/${requestHex.slice(2).toLowerCase()}.json`;
    const blobAccess = process.env.PROFILE_REQUEST_BLOB_ACCESS === "private" ? "private" : "public";
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

    if (mode === "animate") {
      try {
        const providerRequestId = await startAnimation(animationSource!, prompt.trim(), key);
        await put(lockPath, JSON.stringify({ ...auditRecord, status: "processing", providerRequestId }), {
          access: blobAccess, addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", cacheControlMaxAge: 60,
        });
        return NextResponse.json({ processing: true, requestId: requestHex }, { status: 202, headers: { "Cache-Control": "no-store" } });
      } catch (error) {
        console.error("Google profile animation could not start:", error instanceof Error ? error.message : "unknown error");
        await put(lockPath, JSON.stringify({ ...auditRecord, status: "failed", failure: "provider_start_failed", completedAt: Date.now() }), {
          access: blobAccess, addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", cacheControlMaxAge: 60,
        }).catch(() => {});
        const detail = error instanceof Error && /^(Google could not start)/.test(error.message) ? ` ${error.message}` : "";
        return fail(`Google could not start this animation.${detail} The onchain credit was spent for this attempt.`, 502);
      }
    }

    let generated: { bytes: Buffer; contentType: string; ext: "png" | "jpg" | "mp4" };
    try {
      if (mode === "upgrade") generated = { bytes: await generateAnimationUpgrade(videoSource!, prompt.trim(), key), contentType: "video/mp4", ext: "mp4" };
      else generated = await generateImage(prompt.trim(), key);
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
    console.error("Google profile media request failed:", error instanceof Error ? error.message : "unknown error");
    return fail("Could not verify or save this generation. Check Base confirmation and your Vercel Blob setup.", 502);
  }
}

/** Free preflight: confirm the deployment key can access the selected Google model before a credit is spent. */
export async function GET(request: Request) {
  const viewer = await getViewer();
  const requestUrl = new URL(request.url);
  const mode = requestUrl.searchParams.get("mode") || "animate";
  if (mode !== "image" && mode !== "animate" && mode !== "upgrade") return fail("Choose image generation, profile animation, or animation upgrade.", 400);
  if (!viewer?.canWrite) return fail("Connect a writable Farcaster account first. No credit was used.", 401);
  if (mode !== "image" && (viewer.source !== "setup" || !viewer.signerUuid)) {
    return fail("Connect Farcaster on this device before animating your profile. No credit was used.", 401);
  }
  const pendingRequestId = requestUrl.searchParams.get("requestId");
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
        mediaUrl?: unknown; mediaType?: unknown; startedAt?: unknown;
      };
      if (record.fid !== viewer.fid || record.wallet !== wallet || record.requestId !== requestId || (record.mode !== "animate" && record.mode !== "upgrade")) {
        return fail("Animation request does not belong to this Farcaster account and wallet.", 403);
      }
      if (record.status === "completed" && typeof record.mediaUrl === "string") {
        return NextResponse.json({ mediaUrl: record.mediaUrl, mediaType: record.mediaType, requestId }, { headers: { "Cache-Control": "no-store" } });
      }
      if (record.status === "failed") return fail("Google could not complete this animation. The onchain credit was spent for this attempt.", 502);
      if (typeof record.providerRequestId !== "string" || !/^models\/veo-3\.1-lite-generate-preview\/operations\/[^\s]{1,240}$/.test(record.providerRequestId)) {
        return fail("The animation job is not available to resume. Check the profile before spending another credit.", 409);
      }
      const key = apiKey();
      if (!key) return fail("Google AI is not configured on this deployment. The animation job remains saved.", 503);
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
        await put(lockPath, JSON.stringify({ ...record, status: "failed", failure: "provider_generation_failed", completedAt: Date.now() }), {
          access: blobAccess, addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", cacheControlMaxAge: 60,
        }).catch(() => {});
        return fail(`Google could not complete this animation${providerStatus.error.message ? `: ${providerStatus.error.message.slice(0, 180)}` : ""}. The onchain credit was spent for this attempt.`, 502);
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
      console.error("Google profile animation status check failed:", error instanceof Error ? error.message : "unknown error");
      return fail("Couldn't check or save this animation right now. Its job remains saved; try checking again.", 503);
    }
  }

  const key = apiKey();
  if (!key) return fail("Google AI is not configured on this deployment. No credit was used.", 503);
  if (!process.env.BLOB_READ_WRITE_TOKEN && !(process.env.BLOB_STORE_ID && process.env.BLOB_WEBHOOK_PUBLIC_KEY)) {
    return fail("Vercel Blob is not configured to save the animation. No credit was used.", 503);
  }
  const model = mode === "image" ? IMAGE_MODEL : mode === "upgrade" ? VIDEO_EDIT_MODEL : ANIMATION_MODEL;
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
          ? "Check that the Google project has billing enabled and access to this video model."
          : "Try again shortly.";
      return fail(`Google AI preflight failed (${await providerError(modelResponse)}). ${advice} No Jackcaster credit was used.`, 503);
    }
    return NextResponse.json({ ready: true, model }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return fail("Couldn't check Google AI model access. No credit was used; try again shortly.", 503);
  }
}
