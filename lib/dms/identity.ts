"use client";

import { entropyToMnemonic, mnemonicToEntropy, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { getPublicKey } from "nostr-tools";

const STORAGE_KEY = "jackcast:dm-identity:v1";
const KDF_ITERATIONS = 310_000;
const AAD_PREFIX = "jackcast-dm-identity-v1:";

export type DmIdentity = { publicKey: string; secretKey: Uint8Array };
type StoredIdentity = { version: 1; publicKey: string; salt: string; iv: string; ciphertext: string };

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
const asArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
};

function parseStored(): StoredIdentity | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const record = JSON.parse(raw) as StoredIdentity;
    if (record.version !== 1 || !/^[0-9a-f]{64}$/.test(record.publicKey) || !record.salt || !record.iv || !record.ciphertext) return null;
    return record;
  } catch { return null; }
}

async function encryptionKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", asArrayBuffer(new TextEncoder().encode(password)), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: asArrayBuffer(salt), iterations: KDF_ITERATIONS, hash: "SHA-256" }, material,
    { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export function hasStoredDmIdentity(): boolean { return parseStored() !== null; }

export function createDmIdentity(): { identity: DmIdentity; recoveryPhrase: string } {
  let secretKey: Uint8Array;
  let publicKey: string;
  let recoveryPhrase: string;
  do {
    const entropy = crypto.getRandomValues(new Uint8Array(32));
    recoveryPhrase = entropyToMnemonic(entropy, wordlist);
    secretKey = entropy;
    try { publicKey = getPublicKey(secretKey); } catch { publicKey = ""; }
  } while (!publicKey);
  return { identity: { publicKey, secretKey }, recoveryPhrase };
}

export async function restoreDmIdentity(recoveryPhrase: string): Promise<DmIdentity> {
  const normalized = recoveryPhrase.trim().toLowerCase().split(/\s+/).join(" ");
  if (!validateMnemonic(normalized, wordlist)) throw new Error("That recovery phrase is not valid.");
  const secretKey = mnemonicToEntropy(normalized, wordlist);
  if (secretKey.length !== 32) throw new Error("That recovery phrase has the wrong length.");
  try { return { secretKey, publicKey: getPublicKey(secretKey) }; }
  catch { throw new Error("That recovery phrase does not contain a valid DM key."); }
}

export async function saveDmIdentity(identity: DmIdentity, password: string): Promise<void> {
  if (password.length < 16) throw new Error("Choose a local unlock passphrase with at least 16 characters.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey(password, salt);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: asArrayBuffer(iv), additionalData: asArrayBuffer(new TextEncoder().encode(AAD_PREFIX + identity.publicKey)) }, key, asArrayBuffer(identity.secretKey)));
  const record: StoredIdentity = { version: 1, publicKey: identity.publicKey, salt: toBase64(salt), iv: toBase64(iv), ciphertext: toBase64(ciphertext) };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
}

export async function unlockDmIdentity(password: string): Promise<DmIdentity> {
  const record = parseStored();
  if (!record) throw new Error("No saved DM identity was found in this browser.");
  try {
    const key = await encryptionKey(password, fromBase64(record.salt));
    const secretKey = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: asArrayBuffer(fromBase64(record.iv)), additionalData: asArrayBuffer(new TextEncoder().encode(AAD_PREFIX + record.publicKey)) }, key, asArrayBuffer(fromBase64(record.ciphertext))));
    const publicKey = getPublicKey(secretKey);
    if (publicKey !== record.publicKey) throw new Error();
    return { publicKey, secretKey };
  } catch { throw new Error("That local unlock password did not work. You can restore with your 24-word recovery phrase."); }
}

export function forgetDmIdentity(): void {
  localStorage.removeItem(STORAGE_KEY);
  const remove: string[] = [];
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (key?.startsWith("jackcast:dm-contacts:v1:") || key?.startsWith("jackcast:dm-blocks:v1:")) remove.push(key);
  }
  for (const key of remove) localStorage.removeItem(key);
}
