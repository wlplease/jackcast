"use client";

import { useEffect, useState } from "react";
import { firebaseAnonymousIdToken } from "@/lib/firebase-anonymous-client";

type Pin = { fid: number; username: string; displayName?: string; pfpUrl?: string; place: string; lat?: number; lon?: number; updatedAt?: { toDate?: () => Date } };
type PinRow = Pin & { id: string };

function config(): { apiKey: string; authDomain: string; projectId: string; appId: string } | null {
  const packed = process.env.NEXT_PUBLIC_FIREBASE_CONFIG;
  if (packed) try { const value = JSON.parse(packed); if (value.apiKey && value.authDomain && value.projectId && value.appId) return value; } catch {}
  const { NEXT_PUBLIC_FIREBASE_API_KEY: apiKey, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: authDomain, NEXT_PUBLIC_FIREBASE_PROJECT_ID: projectId, NEXT_PUBLIC_FIREBASE_APP_ID: appId } = process.env;
  return apiKey && authDomain && projectId && appId ? { apiKey, authDomain, projectId, appId } : null;
}

export function NetworkMap({ fid, username, displayName, pfpUrl }: { fid: number; username: string; displayName: string; pfpUrl: string }) {
  const [pins, setPins] = useState<PinRow[]>([]);
  const [myPin, setMyPin] = useState<PinRow | null>(null);
  const [place, setPlace] = useState("");
  const [pendingLocation, setPendingLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [reviewPlace, setReviewPlace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    let stop = () => {};
    void (async () => {
      const firebaseConfig = config();
      if (!firebaseConfig) { if (active) { setError("Shared map is not configured yet. Add the Firebase Web App config described in the README."); setReady(true); } return; }
      try {
        await firebaseAnonymousIdToken("jackcaster-map");
        const [{ initializeApp, getApps }, { getAuth }, { getFirestore, collection, onSnapshot, query, orderBy, limit }] = await Promise.all([import("firebase/app"), import("firebase/auth"), import("firebase/firestore")]);
        const app = getApps().find((entry) => entry.name === "jackcaster-map") ?? initializeApp(firebaseConfig, "jackcaster-map");
        const db = getFirestore(app);
        const uid = getAuth(app).currentUser?.uid ?? "";
        if (!active) return;
        stop = onSnapshot(query(collection(db, "jackcaster_map", "pins", "pins"), orderBy("updatedAt", "desc"), limit(300)), (snapshot) => {
          if (!active) return;
          const rows = snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Pin) }));
          setPins(rows);
          setMyPin(rows.find((item) => item.id === uid) ?? null);
          setReady(true);
        }, () => { if (active) { setError("Could not load shared map pins. Check the Jackcaster map rules in Firebase."); setReady(true); } });
      } catch (reason) {
        if (active) { setError(reason instanceof Error ? reason.message : "Could not connect to the shared map."); setReady(true); }
      }
    })();
    return () => { active = false; stop(); };
  }, []);

  async function savePin(coords?: { lat: number; lon: number }) {
    if (!place.trim() && !coords && !pendingLocation) { setError("Enter a broad place name, or choose Use my approximate area."); return; }
    setBusy(true); setError("");
    try {
      const firebaseConfig = config();
      if (!firebaseConfig) throw new Error("Shared map is not configured.");
      await firebaseAnonymousIdToken("jackcaster-map");
      const [{ initializeApp, getApps }, { getAuth }, { getFirestore, doc, setDoc, serverTimestamp }] = await Promise.all([import("firebase/app"), import("firebase/auth"), import("firebase/firestore")]);
      const app = getApps().find((entry) => entry.name === "jackcaster-map") ?? initializeApp(firebaseConfig, "jackcaster-map");
      const uid = getAuth(app).currentUser?.uid;
      if (!uid) throw new Error("Firebase anonymous sign-in is unavailable. Enable Anonymous under Firebase Authentication → Sign-in method.");
      const db = getFirestore(app);
      const verifiedCoords = coords ?? pendingLocation ?? undefined;
      if (verifiedCoords && (!Number.isFinite(verifiedCoords.lat) || !Number.isFinite(verifiedCoords.lon) || Math.abs(verifiedCoords.lat) > 90 || Math.abs(verifiedCoords.lon) > 180)) {
        throw new Error("The approximate coordinates could not be verified. Please request your area again.");
      }
      const pin: Pin = { fid, username: username.slice(0, 32), displayName: displayName.slice(0, 48), pfpUrl: pfpUrl.slice(0, 256), place: (place.trim() || (verifiedCoords ? "Approximate area" : "")).slice(0, 80), updatedAt: serverTimestamp() as Pin["updatedAt"] };
      if (verifiedCoords) { pin.lat = verifiedCoords.lat; pin.lon = verifiedCoords.lon; }
      await setDoc(doc(db, "jackcaster_map", "pins", "pins", uid), pin);
      setPlace(""); setPendingLocation(null); setReviewPlace(false); setMyPin({ ...pin, id: uid });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save your map pin."); }
    finally { setBusy(false); }
  }

  function useLocation() {
    if (!navigator.geolocation) { setError("This browser does not provide location. Enter a broad place name instead."); return; }
    setBusy(true); setError("");
    navigator.geolocation.getCurrentPosition((position) => {
      // Round immediately in the browser to a broad ~10 km grid. Raw coordinates are never sent or stored.
      const lat = Math.round(position.coords.latitude * 10) / 10;
      const lon = Math.round(position.coords.longitude * 10) / 10;
      setPendingLocation({ lat, lon });
      setPlace("");
      setReviewPlace(true);
      setBusy(false);
    }, (reason) => {
      setBusy(false);
      setPendingLocation(null);
      setReviewPlace(false);
      setError(reason.code === reason.PERMISSION_DENIED ? "Location permission was declined. Your place name can still be reviewed and shared manually." : "Could not read your location. You can enter a broad place name instead.");
    }, { enableHighAccuracy: false, maximumAge: 300_000, timeout: 12_000 });
  }

  async function removePin() {
    setBusy(true); setError("");
    try {
      const firebaseConfig = config();
      if (!firebaseConfig) throw new Error("Shared map is not configured.");
      await firebaseAnonymousIdToken("jackcaster-map");
      const [{ initializeApp, getApps }, { getAuth }, { getFirestore, deleteDoc, doc }] = await Promise.all([import("firebase/app"), import("firebase/auth"), import("firebase/firestore")]);
      const app = getApps().find((entry) => entry.name === "jackcaster-map") ?? initializeApp(firebaseConfig, "jackcaster-map");
      const uid = getAuth(app).currentUser?.uid;
      if (!uid) throw new Error("Could not verify your map session.");
      await deleteDoc(doc(getFirestore(app), "jackcaster_map", "pins", "pins", uid));
      setMyPin(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not remove your pin."); }
    finally { setBusy(false); }
  }

  return <div className="network-map-page">
    <header className="section-head"><div><span className="map-eyebrow">JACKCASTER COMMUNITY</span><h1>Around the network</h1><p>Opt-in places shared by Jackcaster users. No one is shown until they choose to add a pin.</p></div><strong className="map-count">{pins.length} {pins.length === 1 ? "pin" : "pins"}</strong></header>
    <section className="map-privacy-card"><div><strong>Your place, on your terms</strong><p>Your exact GPS location stays in your browser. If you choose GPS, Jackcaster rounds it on-device to a broad area (about 10 km); a city or region you enter is shared as written. Nothing is saved until you review and confirm. Confirmed pins are public to people who can access this Firebase map, are self-reported, and can be removed at any time.</p></div>
      {myPin ? <div className="map-your-pin"><span>📍 {myPin.place}{myPin.lat !== undefined ? " · approximate area" : ""}</span><button type="button" className="btn ghost sm" onClick={() => void removePin()} disabled={busy}>Remove my pin</button></div> : reviewPlace ? <div className="map-pin-review"><strong>Review before sharing</strong><p>{pendingLocation ? `Approximate grid: ${pendingLocation.lat.toFixed(1)}°, ${pendingLocation.lon.toFixed(1)}° (about 10 km; exact GPS is not included).` : `Place to share: ${place.trim()}`}</p><small>This location and your public Farcaster profile name will be written directly from this browser to the shared Firebase map after you confirm.</small><div className="map-pin-form"><button type="button" className="btn ghost sm" disabled={busy} onClick={() => { setPendingLocation(null); setReviewPlace(false); }}>Cancel</button><button type="button" className="btn sm" disabled={busy} onClick={() => void savePin()}>{busy ? "Saving…" : "Confirm and share"}</button></div></div> : <div className="map-pin-form"><input value={place} onChange={(event) => setPlace(event.target.value)} maxLength={80} placeholder="City or broad region" aria-label="Place name to share" /><button type="button" className="btn ghost sm" disabled={busy || !place.trim()} onClick={() => setReviewPlace(true)}>Review place</button><button type="button" className="btn sm" disabled={busy} onClick={useLocation}>{busy ? "Working…" : "Use my approximate area"}</button></div>}
      {error && <p className="map-error" role="status">{error}</p>}
    </section>
    {!ready ? <p className="map-empty">Loading the community map…</p> : pins.length === 0 ? <p className="map-empty">No places shared yet. Add the first broad area if you’d like to appear here.</p> : <>
      <section className="network-map-canvas" aria-label="Community place pins">
        <svg className="network-map-world" viewBox="0 0 1000 500" role="img" aria-label="Stylized world map with broad community pins">
          <path d="M68 91 106 66 142 61 165 45 210 53 230 74 269 81 284 102 321 117 314 142 294 158 281 183 261 189 248 214 222 206 203 190 177 196 153 183 129 174 115 157 91 154 78 132 57 119Z M285 232 316 237 341 252 357 278 352 305 370 329 361 355 350 383 333 415 321 443 305 429 297 397 283 378 278 350 268 331 274 303 263 281Z M420 86 441 68 467 76 472 100 455 117 433 108Z M467 126 494 111 521 113 538 128 560 124 577 139 602 139 618 151 653 148 672 161 704 155 729 169 762 164 781 180 820 179 847 196 876 198 897 219 875 233 852 227 833 241 807 234 788 250 760 239 742 221 721 224 699 209 676 216 657 203 634 209 617 194 594 198 579 178 554 183 536 164 512 169 491 151 470 155Z M489 189 519 180 548 196 570 223 580 257 564 280 555 316 534 355 517 391 500 371 487 340 479 310 466 280 473 248 461 221Z M700 279 735 272 768 281 789 304 779 327 753 337 725 326 707 305Z M830 348 862 337 891 345 917 363 905 385 880 394 855 382 832 370Z" />
        </svg>
        {pins.filter((pin) => pin.lat !== undefined && pin.lon !== undefined).map((pin, index) => {
          const x = ((pin.lon! + 180) / 360) * 100;
          const y = ((90 - pin.lat!) / 180) * 100;
          return <a key={pin.id} className="network-map-marker" href={`/u/${encodeURIComponent(pin.username)}`} style={{ left: `${Math.max(2, Math.min(98, x))}%`, top: `${Math.max(4, Math.min(96, y))}%` }} title={`${pin.displayName || pin.username} · ${pin.place}`} aria-label={`Open ${pin.displayName || pin.username}'s profile`}><span>↟</span></a>;
        })}
        <small>Approximate pins only · not for navigation</small>
      </section>
      <section className="map-pin-list" aria-label="People on the map">{pins.map((pin) => <article className="map-pin-row" key={pin.id}><span className="map-avatar">{pin.pfpUrl ? <img src={pin.pfpUrl} alt="" /> : "↟"}</span><span><strong>{pin.displayName || `@${pin.username}`}</strong><small>@{pin.username} · {pin.place}{pin.lat !== undefined ? " · broad area" : ""}</small></span>{pin.lat !== undefined && pin.lon !== undefined && <a href={`https://www.openstreetmap.org/?mlat=${pin.lat}&mlon=${pin.lon}#map=10/${pin.lat}/${pin.lon}`} target="_blank" rel="noreferrer">Approx. map ↗</a>}</article>)}</section>
    </>}
  </div>;
}
