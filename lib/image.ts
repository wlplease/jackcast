// Browser-only helpers for getting photos small before they leave your phone.

export type Prepared = { blob: Blob; type: string; ext: string; width: number; height: number };

const MAX_EDGE = 2048;
const QUALITY = 0.85;

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
  } catch {
    // Older Safari: fall back to an <img>, which also respects EXIF orientation.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function dims(src: ImageBitmap | HTMLImageElement) {
  return "naturalWidth" in src ? { w: src.naturalWidth, h: src.naturalHeight } : { w: src.width, h: src.height };
}

function toJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't encode image"))), "image/jpeg", QUALITY)
  );
}

/** Resizes to at most 2048px on the long edge and re-encodes as JPEG. GIFs pass through so they stay animated. */
export async function prepareImage(file: File): Promise<Prepared> {
  if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) throw new Error("That file isn't an image.");
  if (file.type === "image/gif") {
    if (file.size > 10 * 1024 * 1024) throw new Error("GIFs need to be under 10 MB.");
    return { blob: file, type: "image/gif", ext: "gif", width: 0, height: 0 };
  }
  const src = await decode(file);
  const { w, h } = dims(src);
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  const width = Math.round(w * scale);
  const height = Math.round(h * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff"; // transparent PNGs get a white background instead of black
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(src, 0, 0, width, height);
  if ("close" in src) src.close();
  return { blob: await toJpeg(canvas), type: "image/jpeg", ext: "jpg", width, height };
}

/** Center-crops to a square for profile photos. */
export async function prepareAvatar(file: File, size = 600): Promise<Prepared> {
  // Keep animated avatars intact. Cropping a GIF through canvas captures only
  // one frame; the circular avatar CSS already crops the original visually.
  if (file.type === "image/gif") {
    if (file.size > 10 * 1024 * 1024) throw new Error("Animated profile GIFs need to be under 10 MB.");
    if (!file.size) throw new Error("That GIF file is empty.");
    return { blob: file, type: "image/gif", ext: "gif", width: 0, height: 0 };
  }
  const src = await decode(file);
  const { w, h } = dims(src);
  const side = Math.min(w, h);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(src, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size);
  if ("close" in src) src.close();
  return { blob: await toJpeg(canvas), type: "image/jpeg", ext: "jpg", width: size, height: size };
}

export function randomName(prefix: "casts" | "pfp", ext: string) {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `${prefix}/${stamp}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
}
