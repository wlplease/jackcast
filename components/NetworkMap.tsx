"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geoContains, geoDistance, geoOrthographic, geoPath, type GeoPermissibleObjects } from "d3-geo";
import type { Feature, FeatureCollection } from "geojson";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import usStatesData from "@/lib/us-states-10m.json";
import { finalizeEvent, generateSecretKey, SimplePool, verifyEvent, type Event, type EventTemplate } from "nostr-tools";
import { DEFAULT_DM_RELAYS } from "@/lib/dms/protocol";

const AREA_STEP = 2;
const MAP_KIND = 30_078;
const MAP_TAG = "jackcast-area-pin";
const MAP_KEY_STORAGE = "jackcast:map-key:v1";
const MAP_TIME_STORAGE = "jackcast:map-last-updated:v1";
type Pin = { fid: number; username: string; displayName?: string; pfpUrl?: string; areaId: number; deleted?: boolean; updatedAt: number };
type PinRow = Pin & { id: string };
type WorldTopology = Topology<{ countries: GeometryCollection }>;
type StatesTopology = Topology<{ states: GeometryCollection }>;
const US_STATE_FEATURES = feature(usStatesData as unknown as StatesTopology, (usStatesData as unknown as StatesTopology).objects.states) as FeatureCollection;

function areaLabel(areaId: number, countries: FeatureCollection, states: FeatureCollection) {
  const { lat, lon } = areaCenter(areaId);
  const point: [number, number] = [lon, lat];
  const country = countries.features.find((item) => geoContains(item, point)) as (Feature & { properties?: { name?: string } }) | undefined;
  const countryName = country?.properties?.name;
  if (!countryName) return "Broad area";
  if (countryName === "United States of America") {
    const state = states.features.find((item) => geoContains(item, point)) as (Feature & { properties?: { name?: string } }) | undefined;
    return state?.properties?.name ? `${state.properties.name}, US` : "United States";
  }
  return countryName;
}

function bytesToHex(bytes: Uint8Array) { return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join(""); }
function hexToBytes(hex: string) { return Uint8Array.from(hex.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16)); }
function nextMapTimestamp(previous = 0) {
  const stored = Number(localStorage.getItem(MAP_TIME_STORAGE) || 0);
  const next = Math.max(Math.floor(Date.now() / 1000), previous + 1, stored + 1);
  localStorage.setItem(MAP_TIME_STORAGE, String(next));
  return next;
}

function mapSecretKey(): Uint8Array {
  const existing = localStorage.getItem(MAP_KEY_STORAGE);
  if (existing && /^[0-9a-f]{64}$/.test(existing)) return hexToBytes(existing);
  const secret = generateSecretKey();
  localStorage.setItem(MAP_KEY_STORAGE, bytesToHex(secret));
  return secret;
}

function parseMapEvent(event: Event): Pin | null {
  if (event.kind !== MAP_KIND || !verifyEvent(event) || !event.tags.some((tag) => tag[0] === "t" && tag[1] === MAP_TAG)) return null;
  try {
    const pin = JSON.parse(event.content) as Pin;
    if (!Number.isSafeInteger(pin.fid) || pin.fid < 1 || typeof pin.username !== "string" || pin.username.length > 32 ||
      typeof pin.displayName !== "string" || pin.displayName.length > 48 || typeof pin.pfpUrl !== "string" || pin.pfpUrl.length > 256 ||
      !Number.isInteger(pin.areaId) || pin.areaId < 0 || pin.areaId >= 90000 || typeof pin.deleted !== "boolean" || !Number.isSafeInteger(pin.updatedAt) || pin.updatedAt !== event.created_at) return null;
    return pin;
  } catch { return null; }
}

async function readMapPins(fid: number): Promise<{ pins: PinRow[]; ownPin: PinRow | null }> {
  const pool = new SimplePool();
  try {
    const events = await pool.querySync([...DEFAULT_DM_RELAYS], { kinds: [MAP_KIND], "#t": [MAP_TAG], limit: 1000 }, { maxWait: 10_000 });
    const latestByFid = new Map<number, PinRow>();
    let ownPin: PinRow | null = null;
    for (const event of events.sort((a, b) => b.created_at - a.created_at)) {
      const pin = parseMapEvent(event);
      if (!pin) continue;
      const row = { ...pin, id: event.pubkey };
      if (pin.fid === fid && (!ownPin || pin.updatedAt > ownPin.updatedAt)) ownPin = row;
      const previous = latestByFid.get(pin.fid);
      if (!previous || pin.updatedAt > previous.updatedAt) latestByFid.set(pin.fid, row);
    }
    return { pins: [...latestByFid.values()].filter((pin) => !pin.deleted), ownPin: ownPin?.deleted ? null : ownPin };
  } finally { pool.destroy(); }
}

async function publishMapPin(pin: Pin): Promise<string> {
  const secretKey = mapSecretKey();
  const template: EventTemplate = { kind: MAP_KIND, created_at: pin.updatedAt, tags: [["d", `fid-${pin.fid}`], ["t", MAP_TAG]], content: JSON.stringify(pin) };
  const event = finalizeEvent(template, secretKey);
  const pool = new SimplePool();
  try {
    const accepted = await Promise.allSettled(pool.publish([...DEFAULT_DM_RELAYS], event));
    if (!accepted.some((result) => result.status === "fulfilled")) throw new Error("Nostr relays did not accept the area update. Check your connection and retry.");
    return event.pubkey;
  } finally { pool.destroy(); }
}

function areaIdFor(lat: number, lon: number) {
  const latIndex = Math.max(0, Math.min(89, Math.floor((lat + 90) / AREA_STEP)));
  const lonIndex = Math.max(0, Math.min(179, Math.floor((lon + 180) / AREA_STEP)));
  return latIndex * 1000 + lonIndex;
}

function areaCenter(areaId: number) {
  const latIndex = Math.floor(areaId / 1000);
  const lonIndex = areaId % 1000;
  return { lat: -90 + (latIndex + 0.5) * AREA_STEP, lon: -180 + (lonIndex + 0.5) * AREA_STEP };
}

function locationErrorMessage(reason: GeolocationPositionError) {
  if (!window.isSecureContext) return "Location access requires a secure HTTPS page. Open Jackcaster using its HTTPS address and try again.";
  if (reason.code === reason.PERMISSION_DENIED) return "Location access was denied or blocked by this browser. Allow location for this site in browser and device settings, then try again.";
  if (reason.code === reason.POSITION_UNAVAILABLE) return "The device could not determine a location. Turn on Location Services and try again outdoors or near a window.";
  if (reason.code === reason.TIMEOUT) return "The device did not return a location in time. Check Location Services and try again.";
  return "Could not read a location. Check this browser's location permission and try again.";
}

export function NetworkMap({ fid, username, displayName, pfpUrl, sharingEnabled = true }: { fid: number; username: string; displayName: string; pfpUrl: string; sharingEnabled?: boolean }) {
  const [topology, setTopology] = useState<WorldTopology | null>(null);
  const [pins, setPins] = useState<PinRow[]>([]);
  const [myPin, setMyPin] = useState<PinRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [geoReady, setGeoReady] = useState(false);
  const [relayReady, setRelayReady] = useState<boolean | null>(null);
  const visiblePins = useMemo(() => pins.filter((pin) => Number.isInteger(pin.areaId) && pin.areaId >= 0 && pin.areaId < 90000), [pins]);
  const visibleMyPin = myPin && Number.isInteger(myPin.areaId) && myPin.areaId >= 0 && myPin.areaId < 90000 ? myPin : null;
  useEffect(() => {
    let active = true;
    void (async () => {
      const worldResult = await Promise.allSettled([
        fetch("/data/world-countries-110m.json", { cache: "force-cache" }).then((response) => { if (!response.ok) throw new Error("Could not load the world globe data."); return response.json() as Promise<WorldTopology>; }),
      ]).then((results) => results[0]);
      if (!active) return;
      if (worldResult.status === "fulfilled") setTopology(worldResult.value);
      if (worldResult.status === "rejected") setError("The local map data could not be loaded. Refresh the page to try again.");
      setGeoReady(worldResult.status === "fulfilled");

      if (!sharingEnabled) { if (active) { setRelayReady(false); setReady(true); } return; }

      try {
        const result = await readMapPins(fid);
        if (active) { setPins(result.pins); setMyPin(result.ownPin); setRelayReady(true); setReady(true); }
      } catch {
        if (active) { setError("Could not load public area pins from Nostr relays. Try refreshing."); setRelayReady(false); setReady(true); }
      }
    })();
    return () => { active = false; };
  }, [sharingEnabled]);

  async function savePin(areaId: number) {
    setBusy(true); setError("");
    try {
      if (!sharingEnabled) throw new Error("Map sharing is turned off in your privacy settings.");
      const pin: Pin = { fid, username: username.slice(0, 32), displayName: displayName.slice(0, 48), pfpUrl: pfpUrl.slice(0, 256), areaId, deleted: false, updatedAt: nextMapTimestamp(myPin?.updatedAt ?? 0) };
      const id = await publishMapPin(pin);
      setMyPin({ ...pin, id });
      const result = await readMapPins(fid);
      setPins(result.pins); setMyPin(result.ownPin);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not share your approximate area."); }
    finally { setBusy(false); }
  }

  function useLocation() {
    if (!sharingEnabled) { setError("Map sharing is turned off in your privacy settings."); return; }
    if (!window.isSecureContext) { setError("Location access requires a secure HTTPS page. Open Jackcaster using its HTTPS address and try again."); return; }
    if (!navigator.geolocation) { setError("GPS is not available in this browser. Your location was not changed."); return; }
    setBusy(true); setError("");
    const acceptPosition = (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        setBusy(false); setError("The device returned an invalid location. Your pin was not changed."); return;
      }
      // Raw coordinates stay in memory only long enough to reduce them to a coarse area cell.
      void savePin(areaIdFor(latitude, longitude));
    };
    const fail = (reason: GeolocationPositionError) => { setBusy(false); setError(locationErrorMessage(reason)); };
    try {
      // Request the browser's lower-power location only. Round it to a broad
      // area immediately; never retry with high-accuracy GPS.
      navigator.geolocation.getCurrentPosition(acceptPosition, fail, { enableHighAccuracy: false, maximumAge: 300_000, timeout: 20_000 });
    } catch {
      setBusy(false);
      setError("This page cannot request location. Open Jackcaster in a secure browser tab and allow location access for this site.");
    }
  }

  async function removePin() {
    setBusy(true); setError("");
    try {
      if (!sharingEnabled) throw new Error("Map sharing is turned off in your privacy settings.");
      if (!sharingEnabled) throw new Error("Map sharing is turned off in your privacy settings.");
      const oldPin = myPin;
      if (!oldPin) { setError("This browser does not have the signing key for this area's pin."); return; }
      const tombstone: Pin = { fid, username: username.slice(0, 32), displayName: displayName.slice(0, 48), pfpUrl: pfpUrl.slice(0, 256), areaId: oldPin.areaId, deleted: true, updatedAt: nextMapTimestamp(oldPin.updatedAt) };
      await publishMapPin(tombstone);
      setMyPin(null);
      const result = await readMapPins(fid); setPins(result.pins);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not remove your area."); }
    finally { setBusy(false); }
  }

  const areaGroups = useMemo(() => {
    const groups = new Map<number, { lat: number; lon: number; pins: PinRow[] }>();
    for (const pin of visiblePins) {
      const center = areaCenter(pin.areaId);
      const group = groups.get(pin.areaId) ?? { ...center, pins: [] };
      group.pins.push(pin);
      groups.set(pin.areaId, group);
    }
    return [...groups.values()];
  }, [visiblePins]);
  const locationLabels = useMemo(() => {
    if (!topology) return new Map<number, string>();
    const countries = feature(topology, topology.objects.countries) as FeatureCollection;
    return new Map(visiblePins.map((pin) => [pin.areaId, areaLabel(pin.areaId, countries, US_STATE_FEATURES)]));
  }, [topology, visiblePins]);
  const hasLegacyMyPin = Boolean(myPin && !visibleMyPin);

  return (
    <div className="network-map-page">
      <header className="section-head">
        <div>
          <span className="map-eyebrow">JACKCASTER COMMUNITY</span>
          <h1>Network globe</h1>
      <p>Find your people across broad areas.</p>
        </div>
        <strong className="map-count">{visiblePins.length === 300 ? "300+" : visiblePins.length} {visiblePins.length === 1 ? "person" : "people"}</strong>
      </header>

      <section className="map-privacy-card">
        <div>
          <strong>{relayReady === false ? "Community map" : "Share an approximate area"}</strong>
          <p>Optional: your device rounds location to a broad area before sharing. Exact coordinates are never uploaded. Pins are public. Update or remove yours from this browser.</p>
        </div>
        {!sharingEnabled ? (
          <p className="map-setup-note" role="status">Map sharing is off in your privacy settings.</p>
        ) : relayReady === null ? (
          <p className="map-setup-note" role="status">Connecting to the public Nostr area relays…</p>
        ) : hasLegacyMyPin ? (
          <div className="map-your-pin">
            <span>Older city pin hidden. Replace it with an approximate area or remove it.</span>
            <button type="button" className="btn ghost sm" onClick={useLocation} disabled={busy}>{busy ? "Finding area…" : "Update area"}</button>
            <button type="button" className="btn ghost sm" onClick={() => void removePin()} disabled={busy}>Remove old pin</button>
          </div>
        ) : visibleMyPin ? (
          <div className="map-your-pin">
            <span>📍 {locationLabels.get(visibleMyPin.areaId) ?? "Region unavailable"} shared</span>
            <button type="button" className="btn ghost sm" onClick={useLocation} disabled={busy}>{busy ? "Finding area…" : "Update area"}</button>
            <button type="button" className="btn ghost sm" onClick={() => void removePin()} disabled={busy}>Remove my pin</button>
          </div>
        ) : (
          <div className="map-pin-form">
            <button type="button" className="btn sm" disabled={busy || !geoReady} onClick={useLocation}>{busy ? "Finding and sharing…" : "Share my approximate area"}</button>
            <small className="map-attribution">Optional · shares only a broad area and public profile details. Exact coordinates stay on this device. A small map key stays in this browser so you can update or remove your pin.</small>
          </div>
        )}
        {error && <p className="map-error" role="status">{error}</p>}
      </section>

      {!geoReady ? (
        <p className="map-empty">Loading the globe…</p>
      ) : (
        <section className="network-globe-card" aria-label="Spinning globe of shared approximate areas">
          {topology ? <SpinningGlobe topology={topology} groups={areaGroups} /> : <p className="map-empty">Globe data is unavailable.</p>}
          <div className="globe-caption"><strong>{areaGroups.length.toLocaleString()} areas</strong><span>Drag to turn · each dot covers a broad area</span></div>
        </section>
      )}

      {!ready ? (
        <p className="map-empty">Loading community pins…</p>
      ) : visiblePins.length === 0 ? (
        <p className="map-empty">No areas shared yet. Add yours if you’d like to appear on the globe.</p>
      ) : (
        <section className="map-pin-list" aria-label="People on the globe">
          <h2>Across the network</h2>
          {visiblePins.map((pin) => (
            <article className="map-pin-row" key={pin.id}>
              <span className="map-avatar">{pin.pfpUrl ? <img src={pin.pfpUrl} alt="" /> : "↟"}</span>
              <span><strong>{pin.displayName || `@${pin.username}`}</strong><small>@{pin.username} · {locationLabels.get(pin.areaId) ?? "Region unavailable"}</small></span>
              <a href={`/u/${encodeURIComponent(pin.username)}`} aria-label={`Open @${pin.username}'s profile`}>Profile ↗</a>
            </article>
          ))}
        </section>
      )}

      <small className="map-attribution">Globe boundaries: <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Natural Earth</a>. US state boundaries: <a href="https://github.com/topojson/us-atlas" target="_blank" rel="noreferrer">US Atlas</a> from Census Bureau data.</small>
    </div>
  );
}

function SpinningGlobe({ topology, groups }: { topology: WorldTopology; groups: { lat: number; lon: number; pins: PinRow[] }[] }) {
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
        if (geoDistance([group.lon, group.lat], [-rotationRef.current, 0]) > Math.PI / 2) continue;
        const point = projection([group.lon, group.lat]);
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

  return <canvas ref={canvasRef} className="network-globe" aria-label="Rotating globe showing shared approximate areas" role="img" onPointerDown={(event) => { draggingRef.current = true; lastXRef.current = event.clientX; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (!draggingRef.current) return; const dx = event.clientX - lastXRef.current; lastXRef.current = event.clientX; rotationRef.current = (rotationRef.current + dx * .45 + 360) % 360; }} onPointerUp={() => { draggingRef.current = false; }} onPointerCancel={() => { draggingRef.current = false; }} />;
}
