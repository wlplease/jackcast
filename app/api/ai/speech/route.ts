import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_TEXT_LENGTH = 2_400;
const MAX_BODY_BYTES = 6_000;
const MAX_AUDIO_BYTES = 5_000_000;

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "The audio request must use JSON." }, { status: 415 });
  }
  // Accept the misspelled key name used by the original private deployment while
  // documenting ELEVENLABS_API_KEY as the canonical name for other installs.
  const apiKey = process.env.ELEVENLABS_API_KEY || process.env.ELEVELN_LAB_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) {
    return NextResponse.json({ error: "Read-aloud is optional and is not enabled on this deployment. Add an ElevenLabs API key and voice ID to enable it." }, { status: 503 });
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) return NextResponse.json({ error: "This audio request is too large." }, { status: 413 });

  let raw: string;
  try {
    const reader = request.body?.getReader();
    if (!reader) return NextResponse.json({ error: "The audio request was not valid." }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let byteLength = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > MAX_BODY_BYTES) {
        await reader.cancel();
        return NextResponse.json({ error: "This audio request is too large." }, { status: 413 });
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    raw = new TextDecoder().decode(bytes);
  } catch {
    return NextResponse.json({ error: "The audio request was not valid." }, { status: 400 });
  }
  let text: unknown;
  try {
    const body = JSON.parse(raw) as { text?: unknown };
    text = body?.text;
  } catch {
    return NextResponse.json({ error: "The audio request was not valid." }, { status: 400 });
  }
  if (typeof text !== "string" || !text.trim() || text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: `Audio text must be between 1 and ${MAX_TEXT_LENGTH} characters.` }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(voiceId)) {
    return NextResponse.json({ error: "The configured ElevenLabs voice ID is invalid." }, { status: 503 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "content-type": "application/json", "xi-api-key": apiKey },
      body: JSON.stringify({ text: text.trim(), model_id: "eleven_flash_v2_5" }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      return NextResponse.json({ error: response.status === 401 || response.status === 403
        ? "ElevenLabs rejected the audio request. Check the API key and voice access."
        : response.status === 429
          ? "ElevenLabs is rate limiting audio requests. Try again later."
          : "ElevenLabs could not create the audio. Check the voice and account quota." }, { status: 502 });
    }
    const audio = await response.arrayBuffer();
    if (audio.byteLength === 0 || audio.byteLength > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: "ElevenLabs returned an invalid audio file." }, { status: 502 });
    }
    return new NextResponse(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audio.byteLength),
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? "ElevenLabs took too long to create the audio. Try again later."
      : "ElevenLabs is temporarily unavailable. Check your connection and try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
