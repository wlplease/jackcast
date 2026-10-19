"use client";

/* eslint-disable @next/next/no-img-element */
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { uploadImage } from "@/lib/upload-client";
import { updateProfile } from "@/app/(main)/me/actions";
import { prepareAvatar, randomName } from "@/lib/image";
import { GrokProfileMaker } from "@/components/GrokProfileMaker";

const bytes = (s: string) => new TextEncoder().encode(s).length;

export function EditProfile({ initial, fid, farcasterSignedIn, grokEnabled }: { initial: { displayName: string; bio: string; pfpUrl: string; bannerUrl: string }; fid: number; farcasterSignedIn: boolean; grokEnabled: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [bio, setBio] = useState(initial.bio);
  const [pfp, setPfp] = useState(initial.pfpUrl);
  const [bannerUrl, setBannerUrl] = useState(initial.bannerUrl);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const bioBytes = bytes(bio);
  const nameBytes = bytes(displayName);
  const changed = displayName !== initial.displayName || bio !== initial.bio || pfp !== initial.pfpUrl || bannerUrl !== initial.bannerUrl;

  async function pickPhoto(file: File) {
    setError(null);
    setUploading(true);
    const url = URL.createObjectURL(file);
    setPreview(url);
    try {
      const prepared = await prepareAvatar(file);
      const blobUrl = await uploadImage(randomName("pfp", prepared.ext), prepared.blob, prepared.type);
      setPfp(blobUrl);
    } catch (e) {
      setPreview(null);
      const msg = (e as Error)?.message ?? "";
      setError(
        /Blob|501/.test(msg)
          ? "Photo uploads need Vercel Blob turned on. See the README."
          : (e as Error)?.name === "TimeoutError" || /abort|timed? ?out/i.test(msg)
            ? "Upload timed out. Check your connection and try again."
            : msg || "Upload failed"
      );
    } finally {
      setUploading(false);
    }
  }

  function save() {
    setError(null);
    start(async () => {
      const res = await updateProfile({
        displayName: displayName !== initial.displayName ? displayName : undefined,
        bio: bio !== initial.bio ? bio : undefined,
        pfpUrl: pfp !== initial.pfpUrl ? pfp : undefined,
        bannerUrl: bannerUrl !== initial.bannerUrl ? bannerUrl : undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/me?saved=1");
      router.refresh();
    });
  }

  return (
    <div className="edit-profile">
      <div className="pfp-edit">
        {/\.(?:mp4|webm)(?:[?#]|$)/i.test(preview ?? pfp) ? <video className="avatar xl avatar-motion" src={preview ?? pfp} autoPlay muted loop playsInline controls aria-label="Current animated profile image" /> : <img className="avatar xl" src={preview ?? pfp ?? ""} alt="" />}
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pickPhoto(f);
              e.target.value = "";
            }}
          />
          <button type="button" className="btn ghost sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? "Uploading…" : "Change photo"}
          </button>
          <p className="field-hint">Photos are cropped to a centered square. Animated GIFs keep all frames and display in the round avatar crop (up to 10 MB).</p>
        </div>
      </div>

      {grokEnabled && <GrokProfileMaker fid={fid} farcasterSignedIn={farcasterSignedIn} currentPfpUrl={initial.pfpUrl} onUse={(url) => { setPfp(url); setPreview(null); setError(null); }} />}

      <label className="field">
        <span className="field-label">
          Display name <span className={`count${nameBytes > 32 ? " over" : ""}`}>{32 - nameBytes}</span>
        </span>
        <input className="text-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="off" />
      </label>

      <label className="field">
        <span className="field-label">Cover image URL <span className="meta">Neynar Pro required</span></span>
        <input className="text-input" type="url" inputMode="url" placeholder="https://…" value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} autoComplete="url" />
        <span className="field-hint">Optional wide image shown on your Farcaster profile. Clear the field to remove it. Neynar requires a Pro subscription to change the banner.</span>
      </label>

      <label className="field">
        <span className="field-label">
          Bio <span className={`count${bioBytes > 256 ? " over" : ""}`}>{256 - bioBytes}</span>
        </span>
        <textarea className="text-input" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} />
      </label>

      {error && <div className="form-error">{error}</div>}

      <div className="edit-actions">
        <Link href="/me" className="btn ghost">
          Cancel
        </Link>
        <button className="btn" onClick={save} disabled={!changed || pending || uploading || bioBytes > 256 || nameBytes > 32 || !displayName.trim()}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
