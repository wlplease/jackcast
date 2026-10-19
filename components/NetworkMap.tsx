"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geoDistance, geoOrthographic, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { firebaseAnonymousIdToken } from "@/lib/firebase-anonymous-client";

type City = { id: number; name: string; lat: number; lon: number; countryCode: string; country: string };
type Pin = { fid: number; username: string; displayName?: string; pfpUrl?: string; cityId: number; city: string; country: string; locationMethod?: "gps"; updatedAt?: { toDate?: () => Date } };
type PinRow = Pin & { id: string };
type WorldTopology = Topology<{ countries: GeometryCollection }>;

function config(): { apiKey: string; authDomain: string; projectId: string; appId: string } | null {
  const packed = process.env.NEXT_PUBLIC_FIREBASE_CONFIG;
  if (packed) try { const value = JSON.parse(packed); if (value.apiKey && value.authDomain && value.projectId && value.appId) return value; } catch {}
  const { NEXT_PUBLIC_FIREBASE_API_KEY: apiKey, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: authDomain, NEXT_PUBLIC_FIREBASE_PROJECT_ID: projectId, NEXT_PUBLIC_FIREBASE_APP_ID: appId } = process.env;
  return apiKey && authDomain && projectId && appId ? { apiKey, authDomain, projectId, appId } : null;
}

function parseCities(text: string): City[] {
  return text.split(/\r?\n/).filter(Boolean).map((line) => {
    const [id, name, lat, lon, countryCode, country] = line.split("\t");
    return { id: Number(id), name, lat: Number(lat), lon: Number(lon), countryCode, country };
  }).filter((city) => Number.isInteger(city.id) && city.name && city.country && Number.isFinite(city.lat) && Number.isFinite(city.lon));
}

function nearestCity(cities: City[], lat: number, lon: number): { city: City; distanceKm: number } | null {
  let best: City | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  const toRad = Math.PI / 180;
  for (const city of cities) {
    const dLat = (city.lat - lat) * toRad;
    const dLon = (city.lon - lon) * toRad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * toRad) * Math.cos(city.lat * toRad) * Math.sin(dLon / 2) ** 2;
    const distance = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    if (distance < bestDistance) { best = city; bestDistance = distance; }
  }
  return best && bestDistance <= 15 ? { city: best, distanceKm: bestDistance } : null;
}

export function NetworkMap({ fid, username, displayName, pfpUrl }: { fid: number; username: string; displayName: string; pfpUrl: string }) {
  const [cities, setCities] = useState<City[]>([]);
  const [topology, setTopology] = useState<WorldTopology | null>(null);
  const [pins, setPins] = useState<PinRow[]>([]);
  const [myPin, setMyPin] = useState<PinRow | null>(null);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [reviewPin, setReviewPin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [geoReady, setGeoReady] = useState(false);
  const citiesById = useMemo(() => new Map(cities.map((city) => [city.id, city])), [cities]);
  const visiblePins = useMemo(() => pins.filter((pin) => citiesById.has(pin.cityId)), [pins, citiesById]);
  const visibleMyPin = myPin && citiesById.has(myPin.cityId) ? myPin : null;
  useEffect(() => {
    let active = true;
    let stop = () => {};
    void (async () => {
      const [cityResult, worldResult] = await Promise.allSettled([
        fetch("/data/geonames-cities.tsv", { cache: "force-cache" }).then((response) => { if (!response.ok) throw new Error("Could not load the offline city list."); return response.text(); }),
        fetch("/data/world-countries-110m.json", { cache: "force-cache" }).then((response) => { if (!response.ok) throw new Error("Could not load the world globe data."); return response.json() as Promise<WorldTopology>; }),
      ]);
      if (!active) return;
      if (cityResult.status === "fulfilled") setCities(parseCities(cityResult.value));
      if (worldResult.status === "fulfilled") setTopology(worldResult.value);
      if (cityResult.status === "rejected" || worldResult.status === "rejected") setError("The local map data could not be loaded. Refresh the page to try again.");
      setGeoReady(cityResult.status === "fulfilled" && worldResult.status === "fulfilled");

      const firebaseConfig = config();
      if (!firebaseConfig) { if (active) { setError((current) => current || "Shared map is not configured yet. Add the Firebase Web App config described in the README."); setReady(true); } return; }
      try {
        await firebaseAnonymousIdToken("jackcaster-map");
        const [{ initializeApp, getApps }, { getAuth }, { getFirestore, collection, onSnapshot, query, orderBy, limit }] = await Promise.all([import("firebase/app"), import("firebase/auth"), import("firebase/firestore")]);
        const app = getApps().find((entry) => entry.name === "jackcaster-map") ?? initializeApp(firebaseConfig, "jackcaster-map");
        const db = getFirestore(app);
        const uid = getAuth(app).currentUser?.uid ?? "";
        if (!active) return;
        stop = onSnapshot(query(collection(db, "jackcaster_map", "pins", "pins"), orderBy("updatedAt", "desc"), limit(300)), (snapshot) => {
          if (!active) return;
          const allRows = snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Pin) }));
          const rows = allRows.filter((item) => item.locationMethod === "gps" && Number.isInteger(item.cityId) && Number.isInteger(item.fid) && Boolean(item.username && item.city && item.country));
          setPins(rows);
          setMyPin(allRows.find((item) => item.id === uid) ?? null);
          setReady(true);
        }, () => { if (active) { setError("Could not load shared map pins. Check the Jackcaster map rules in Firebase."); setReady(true); } });
      } catch (reason) {
        if (active) { setError(reason instanceof Error ? reason.message : "Could not connect to the shared map."); setReady(true); }
      }
    })();
    return () => { active = false; stop(); };
  }, []);

  async function savePin() {
    if (!selectedCity) { setError("Use GPS to find a nearby city before sharing a pin."); return; }
    setBusy(true); setError("");
    try {
      const firebaseConfig = config();
      if (!firebaseConfig) throw new Error("Shared map is not configured.");
      await firebaseAnonymousIdToken("jackcaster-map");
      const [{ initializeApp, getApps }, { getAuth }, { getFirestore, doc, setDoc, serverTimestamp }] = await Promise.all([import("firebase/app"), import("firebase/auth"), import("firebase/firestore")]);
      const app = getApps().find((entry) => entry.name === "jackcaster-map") ?? initializeApp(firebaseConfig, "jackcaster-map");
      const uid = getAuth(app).currentUser?.uid;
      if (!uid) throw new Error("Firebase could not verify this browser session.");
      const db = getFirestore(app);
      const pin: Pin = { fid, username: username.slice(0, 32), displayName: displayName.slice(0, 48), pfpUrl: pfpUrl.slice(0, 256), cityId: selectedCity.id, city: selectedCity.name.slice(0, 80), country: selectedCity.country.slice(0, 80), locationMethod: "gps", updatedAt: serverTimestamp() as Pin["updatedAt"] };
      await setDoc(doc(db, "jackcaster_map", "pins", "pins", uid), pin);
      setSelectedCity(null); setReviewPin(false); setMyPin({ ...pin, id: uid });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save your city pin."); }
    finally { setBusy(false); }
  }

  function useLocation() {
    if (!navigator.geolocation) { setError("GPS is not available in this browser. Your location was not changed."); return; }
    setBusy(true); setError("");
    navigator.geolocation.getCurrentPosition((position) => {
      // The exact coordinates are used only for a local lookup and are discarded before any network request.
      if (!Number.isFinite(position.coords.accuracy) || position.coords.accuracy > 1_000) {
        setBusy(false);
        setError("GPS accuracy is too low to choose a city (over 1 km). Enable precise location and try again. No location was saved.");
        return;
      }
      const match = nearestCity(cities, position.coords.latitude, position.coords.longitude);
      if (match) {
        setSelectedCity(match.city);
        setReviewPin(true);
      } else {
        setSelectedCity(null);
        setReviewPin(false);
        setError("No listed city was found within 15 km of your GPS location. No location was saved.");
      }
      setBusy(false);
    }, (reason) => {
      setBusy(false);
      setError(reason.code === reason.PERMISSION_DENIED ? "Location permission was declined. Your location was not changed." : "Could not read a GPS location. Your location was not changed; try again or leave it unset.");
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 });
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
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not remove your city pin."); }
    finally { setBusy(false); }
  }

  const cityGroups = useMemo(() => {
    const groups = new Map<number, { city: City; pins: PinRow[] }>();
    for (const pin of visiblePins) {
      const city = citiesById.get(pin.cityId);
      if (!city) continue;
      const group = groups.get(pin.cityId) ?? { city, pins: [] };
      group.pins.push(pin);
      groups.set(pin.cityId, group);
    }
    return [...groups.values()];
  }, [citiesById, visiblePins]);
  const hasLegacyMyPin = Boolean(myPin && (myPin.locationMethod !== "gps" || !citiesById.has(myPin.cityId)));

  return (
    <div className="network-map-page">
      <header className="section-head">
        <div>
          <span className="map-eyebrow">JACKCASTER COMMUNITY</span>
          <h1>Network globe</h1>
        <p>Opt-in city spots based on a fresh GPS reading. Share a nearby city or leave your location unset.</p>
        </div>
        <strong className="map-count">{visiblePins.length === 300 ? "300+" : visiblePins.length} {visiblePins.length === 1 ? "person" : "people"}</strong>
      </header>

      <section className="map-privacy-card">
        <div>
          <strong>Share a GPS-checked city</strong>
          <p>Jackcaster requests a fresh GPS reading with reported accuracy within 1 km, then matches a listed city within 15 km on this device. GPS coordinates are discarded; only the city and country are shared after you confirm. You can leave this blank or remove your pin anytime. Browser GPS can be spoofed, so this is an estimate, not proof of physical presence.</p>
        </div>
        {reviewPin && selectedCity ? (
          <div className="map-pin-review">
            <strong>Confirm your nearby city</strong>
            <p>{selectedCity.name}, {selectedCity.country}</p>
            <small>Matched on this device from your fresh GPS reading. Exact coordinates and GPS accuracy are not uploaded.</small>
            <div className="map-pin-form">
              <button type="button" className="btn ghost sm" disabled={busy} onClick={() => { setSelectedCity(null); setReviewPin(false); setError(""); }}>Cancel</button>
              <button type="button" className="btn sm" disabled={busy} onClick={() => void savePin()}>{busy ? "Saving…" : "Share this city"}</button>
            </div>
          </div>
        ) : hasLegacyMyPin ? (
          <div className="map-your-pin">
            <span>Older pin hidden until you confirm a nearby city with GPS.</span>
            <button type="button" className="btn ghost sm" onClick={useLocation} disabled={busy}>{busy ? "Checking GPS…" : "Update with GPS"}</button>
            <button type="button" className="btn ghost sm" onClick={() => void removePin()} disabled={busy}>Remove old pin</button>
          </div>
        ) : visibleMyPin ? (
          <div className="map-your-pin">
            <span>📍 {visibleMyPin.city}, {visibleMyPin.country}</span>
            <button type="button" className="btn ghost sm" onClick={useLocation} disabled={busy}>{busy ? "Checking GPS…" : "Update with GPS"}</button>
            <button type="button" className="btn ghost sm" onClick={() => void removePin()} disabled={busy}>Remove my pin</button>
          </div>
        ) : (
          <div className="map-pin-form">
            <button type="button" className="btn sm" disabled={busy || !geoReady} onClick={useLocation}>{busy ? "Checking GPS…" : "Use GPS to find my city"}</button>
            <small className="map-attribution">GPS is optional. Nothing is saved until you confirm.</small>
          </div>
        )}
        {error && <p className="map-error" role="status">{error}</p>}
      </section>

      {!geoReady ? (
        <p className="map-empty">Loading the local world and city data…</p>
      ) : (
        <section className="network-globe-card" aria-label="Spinning globe of shared cities">
          {topology ? <SpinningGlobe topology={topology} groups={cityGroups} /> : <p className="map-empty">Globe data is unavailable.</p>}
          <div className="globe-caption"><strong>{cityGroups.length.toLocaleString()} cities</strong><span>Drag to turn the globe · dots mark shared cities</span></div>
        </section>
      )}

      {!ready ? (
        <p className="map-empty">Loading community pins…</p>
      ) : visiblePins.length === 0 ? (
        <p className="map-empty">No cities shared yet. Add yours if you’d like to appear on the globe.</p>
      ) : (
        <section className="map-pin-list" aria-label="People on the globe">
          <h2>Across the network</h2>
          {visiblePins.map((pin) => (
            <article className="map-pin-row" key={pin.id}>
              <span className="map-avatar">{pin.pfpUrl ? <img src={pin.pfpUrl} alt="" /> : "↟"}</span>
              <span><strong>{pin.displayName || `@${pin.username}`}</strong><small>@{pin.username} · {pin.city}, {pin.country}</small></span>
              <a href={`/u/${encodeURIComponent(pin.username)}`} aria-label={`Open @${pin.username}'s profile`}>Profile ↗</a>
            </article>
          ))}
        </section>
      )}

      <small className="map-attribution">City data: <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a> · Globe boundaries: <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Natural Earth</a></small>
    </div>
  );
}

function SpinningGlobe({ topology, groups }: { topology: WorldTopology; groups: { city: City; pins: PinRow[] }[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotationRef = useRef(-20);
  const draggingRef = useRef(false);
  const lastXRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const land = feature(topology, topology.objects.countries) as GeoPermissibleObjects;
    const borders = mesh(topology, topology.objects.countries, (a, b) => a !== b);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let lastDraw = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;

    const draw = (time: number) => {
      frame = requestAnimationFrame(draw);
      if (time - lastDraw < 32) return;
      lastDraw = time;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      if (width !== rect.width || height !== rect.height || dpr !== Math.min(window.devicePixelRatio || 1, 2)) {
        width = rect.width; height = rect.height; dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      if (!draggingRef.current && !reducedMotion.matches) rotationRef.current = (rotationRef.current + 0.12) % 360;
      const radius = Math.min(width, height) * 0.445;
      const projection = geoOrthographic().translate([width / 2, height / 2]).scale(radius).clipAngle(90).rotate([rotationRef.current, 0, 0]);
      const path = geoPath(projection, context);
      const style = getComputedStyle(canvas);
      const ocean = style.getPropertyValue("--globe-ocean").trim() || "#bfe5ee";
      const landColor = style.getPropertyValue("--globe-land").trim() || "#76ac94";
      const borderColor = style.getPropertyValue("--globe-border").trim() || "#effaf4";
      const dotColor = style.getPropertyValue("--brand").trim() || "#5946ec";
      const centerX = width / 2; const centerY = height / 2;
      const sphere = context.createRadialGradient(centerX - radius * .25, centerY - radius * .34, radius * .08, centerX, centerY, radius * 1.1);
      sphere.addColorStop(0, ocean); sphere.addColorStop(1, style.getPropertyValue("--card").trim() || "#f6f8f5");
      context.beginPath(); path({ type: "Sphere" }); context.fillStyle = sphere; context.fill();
      context.save(); context.beginPath(); path({ type: "Sphere" }); context.clip();
      context.beginPath(); path(land); context.fillStyle = landColor; context.fill();
      context.beginPath(); path(borders); context.strokeStyle = borderColor; context.lineWidth = .55; context.stroke();
      context.globalAlpha = .15; context.strokeStyle = borderColor; context.lineWidth = .7;
      for (const latitude of [-60, -30, 0, 30, 60]) { context.beginPath(); path({ type: "LineString", coordinates: Array.from({ length: 73 }, (_, i) => [-180 + i * 5, latitude]) }); context.stroke(); }
      for (const longitude of [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150]) { context.beginPath(); path({ type: "LineString", coordinates: Array.from({ length: 37 }, (_, i) => [longitude, -90 + i * 5]) }); context.stroke(); }
      context.globalAlpha = 1;
      for (const group of groups) {
        if (geoDistance([group.city.lon, group.city.lat], [-rotationRef.current, 0]) > Math.PI / 2) continue;
        const point = projection([group.city.lon, group.city.lat]);
        if (!point) continue;
        context.beginPath(); context.arc(point[0], point[1], group.pins.length > 1 ? 5.3 : 3.4, 0, Math.PI * 2);
        context.fillStyle = dotColor; context.shadowColor = dotColor; context.shadowBlur = 12; context.fill(); context.shadowBlur = 0;
        context.beginPath(); context.arc(point[0], point[1], 1.35, 0, Math.PI * 2); context.fillStyle = "#fff"; context.fill();
        if (group.pins.length > 1) { context.fillStyle = "#fff"; context.font = "600 8px system-ui"; context.textAlign = "center"; context.textBaseline = "middle"; context.fillText(String(group.pins.length), point[0], point[1]); }
      }
      context.restore();
      context.beginPath(); path({ type: "Sphere" }); context.strokeStyle = style.getPropertyValue("--rule-strong").trim() || "#8ca89a"; context.lineWidth = 1; context.stroke();
    };
    frame = requestAnimationFrame(draw);
    const resize = new ResizeObserver(() => { width = 0; height = 0; });
    resize.observe(canvas);
    return () => { cancelAnimationFrame(frame); resize.disconnect(); };
  }, [topology, groups]);

  return <canvas ref={canvasRef} className="network-globe" aria-label="Rotating globe showing shared city locations" role="img" onPointerDown={(event) => { draggingRef.current = true; lastXRef.current = event.clientX; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (!draggingRef.current) return; const dx = event.clientX - lastXRef.current; lastXRef.current = event.clientX; rotationRef.current = (rotationRef.current + dx * .45 + 360) % 360; }} onPointerUp={() => { draggingRef.current = false; }} onPointerCancel={() => { draggingRef.current = false; }} />;
}
