"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SimplePool, type Event } from "nostr-tools";
import { getDmSelf, getDmUser, lookupDmUser, publishDmKeyProof, verifyDmKeyProof, type DmUser } from "@/app/(main)/messages/actions";
import { createDmIdentity, forgetDmIdentity, hasStoredDmIdentity, restoreDmIdentity, saveDmIdentity, unlockDmIdentity, type DmIdentity } from "@/lib/dms/identity";
import { DEFAULT_DM_RELAYS, createDmBinding, resolveDmBinding, resolveDmBindingByKey, resolveDmRelays, sendDm, verifyDmBinding, publishDmBinding, fetchDms, type DecryptedDm } from "@/lib/dms/protocol";

type Contact = DmUser & { publicKey: string; relays: string[]; accepted: boolean; blocked: boolean };
const CONTACTS_KEY = "jackcast:dm-contacts:v1:";
const BLOCKS_KEY = "jackcast:dm-blocks:v1:";

function readContacts(pubkey: string): Contact[] {
  try {
    const rows = JSON.parse(localStorage.getItem(CONTACTS_KEY + pubkey) || "[]") as Contact[];
    return Array.isArray(rows) ? rows.filter((x) => Number.isSafeInteger(x.fid) && /^[0-9a-f]{64}$/.test(x.publicKey) && Array.isArray(x.relays) && x.relays.length <= 3 && x.relays.every((url) => { try { return new URL(url).protocol === "wss:"; } catch { return false; } })).map((x) => ({ ...x, accepted: x.accepted === true, blocked: x.blocked === true })) : [];
  } catch { return []; }
}

function saveContacts(pubkey: string, contacts: Contact[]) {
  localStorage.setItem(CONTACTS_KEY + pubkey, JSON.stringify(contacts));
}

function prettyKey(key: string) { return `${key.slice(0, 8)}…${key.slice(-8)}`; }

export function DmInbox({ viewerFid }: { viewerFid: number }) {
  const [stored, setStored] = useState(false);
  const [identity, setIdentity] = useState<DmIdentity | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [blockedKeys, setBlockedKeys] = useState<string[]>([]);
  const [messages, setMessages] = useState<DecryptedDm[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<DecryptedDm | null>(null);
  const [self, setSelf] = useState<DmUser | null>(null);
  const [mode, setMode] = useState<"create" | "restore" | null>(null);
  const [draftIdentity, setDraftIdentity] = useState<DmIdentity | null>(null);
  const [recoveryPhrase, setRecoveryPhrase] = useState("");
  const [confirmWordIndex, setConfirmWordIndex] = useState(0);
  const [backupWord, setBackupWord] = useState("");
  const [savedPhrase, setSavedPhrase] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recipientInput, setRecipientInput] = useState("");
  const [compose, setCompose] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [bindingValid, setBindingValid] = useState(false);
  const [inboxReady, setInboxReady] = useState(false);
  const [pendingPublicProof, setPendingPublicProof] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { setStored(hasStoredDmIdentity()); }, []);

  useEffect(() => {
    let active = true;
    void getDmSelf().then((result) => { if (active && result.ok) setSelf(result.user); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!identity && !draftIdentity) return;
    let timer: ReturnType<typeof setTimeout>;
    const clearSensitiveState = () => {
      identity?.secretKey.fill(0);
      draftIdentity?.secretKey.fill(0);
      setIdentity(null); setDraftIdentity(null); setMessages([]); setSelected(null); setBindingValid(false); setInboxReady(false);
      setRecoveryPhrase(""); setBackupWord(""); setPassword(""); setConfirmPassword(""); setMode(null);
    };
    const resetIdleTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(clearSensitiveState, 15 * 60 * 1000);
    };
    const onPageHide = () => clearSensitiveState();
    resetIdleTimer();
    window.addEventListener("pointerdown", resetIdleTimer);
    window.addEventListener("keydown", resetIdleTimer);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", resetIdleTimer);
      window.removeEventListener("keydown", resetIdleTimer);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [identity, draftIdentity]);

  useEffect(() => {
    if (!identity) return;
    setContacts(readContacts(identity.publicKey));
    try {
      const keys = JSON.parse(localStorage.getItem(BLOCKS_KEY + identity.publicKey) || "[]") as string[];
      setBlockedKeys(Array.isArray(keys) ? keys.filter((key) => /^[0-9a-f]{64}$/.test(key)) : []);
    } catch { setBlockedKeys([]); }
  }, [identity]);

  const loadMessages = useCallback(async (current: DmIdentity, quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const rows = await fetchDms(current);
      setMessages(rows);
      setError("");
    } catch {
      if (!quiet) setError("DM relays could not be reached. Your saved key remains on this device.");
    } finally { if (!quiet) setRefreshing(false); }
  }, []);

  useEffect(() => {
    if (!identity) return;
    void loadMessages(identity);
    refreshTimer.current = setInterval(() => void loadMessages(identity, true), 60_000);
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current); };
  }, [identity, loadMessages]);

  const conversationKeys = useMemo(() => {
    if (!identity) return [];
    const keys = new Set(contacts.filter((c) => !c.blocked && !blockedKeys.includes(c.publicKey)).map((c) => c.publicKey));
    for (const message of messages) {
      const counterpart = message.author === identity.publicKey ? message.recipient : message.author;
      if (counterpart && counterpart !== identity.publicKey && !blockedKeys.includes(counterpart)) keys.add(counterpart);
    }
    return [...keys];
  }, [blockedKeys, contacts, identity, messages]);

  useEffect(() => {
    if (!identity || !self || conversationKeys.length === 0) return;
    let cancelled = false;
    const known = new Set(contacts.map((contact) => contact.publicKey));
    void Promise.all(conversationKeys.filter((key) => !known.has(key)).map(async (key) => {
      try {
        const binding = await resolveDmBindingByKey(key);
        if (!binding) return null;
        const result = await getDmUser(binding.fid);
        const proven = binding.version === 2
          ? !!binding.castHash && await verifyDmKeyProof(binding.castHash, binding.fid, binding.publicKey)
          : result.ok && await verifyDmBinding(binding, result.user.custodyAddress);
        if (!result.ok || !proven) return null;
        const relays = await resolveDmRelays(key);
        return { ...result.user, publicKey: key, relays, accepted: false, blocked: false };
      } catch { return null; }
    })).then((found) => {
      if (cancelled) return;
      const additions = found.filter((x): x is Contact => !!x);
      if (additions.length) setContacts((previous) => {
        const merged = [...previous];
        for (const item of additions) if (!merged.some((x) => x.publicKey === item.publicKey)) merged.push(item);
        saveContacts(identity.publicKey, merged);
        return merged;
      });
    });
    return () => { cancelled = true; };
  }, [identity, self, conversationKeys, contacts]);

  useEffect(() => {
    if (!identity || !self) { setBindingValid(false); setInboxReady(false); return; }
    let cancelled = false;
    void Promise.all([resolveDmBinding(viewerFid, self.custodyAddress), resolveDmRelays(identity.publicKey)]).then(async ([binding, relays]) => {
      const proofValid = binding?.version === 2 && !!binding.castHash && await verifyDmKeyProof(binding.castHash, viewerFid, identity.publicKey);
      const legacyValid = binding?.version === 1 && binding.publicKey === identity.publicKey && await verifyDmBinding(binding, self.custodyAddress);
      if (!cancelled) { setBindingValid(proofValid || legacyValid); setInboxReady(relays.length > 0); }
    }).catch(() => { if (!cancelled) { setBindingValid(false); setInboxReady(false); } });
    return () => { cancelled = true; };
  }, [identity, self, viewerFid]);

  async function unlock() {
    setLoading(true); setError("");
    try {
      const loaded = await unlockDmIdentity(password);
      setIdentity(loaded); setPassword("");
      const result = await getDmSelf();
      if (result.ok) setSelf(result.user);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not unlock the DM identity."); }
    finally { setLoading(false); }
  }

  function beginCreate() {
    setError("");
    setPassword(""); setConfirmPassword("");
    const generated = createDmIdentity();
    setDraftIdentity(generated.identity);
    setRecoveryPhrase(generated.recoveryPhrase);
    setConfirmWordIndex(Math.floor(Math.random() * 24));
    setBackupWord(""); setSavedPhrase(false);
    setMode("create");
  }

  async function beginRestore() {
    setError("");
    setPassword(""); setConfirmPassword("");
    try {
      const restored = await restoreDmIdentity(recoveryPhrase);
      setDraftIdentity(restored);
      setRecoveryPhrase(recoveryPhrase.trim().toLowerCase().split(/\s+/).join(" "));
      setMode("restore");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not read that recovery phrase."); }
  }

  async function signAndEnable() {
    if (!draftIdentity) return;
    if (!self) { setError("Could not confirm your Farcaster identity. Refresh the page and try again."); return; }
    setLoading(true); setError(""); setNotice("");
    try {
      if (password.length < 16 || password !== confirmPassword) throw new Error("Use a matching local unlock passphrase of at least 16 characters.");
      setPendingPublicProof(true);
      setLoading(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not prepare the DM identity."); setLoading(false); }
  }

  async function confirmPublicProof() {
    if (!draftIdentity || !self) return;
    setLoading(true); setError(""); setNotice("");
    try {
      if (password.length < 16 || password !== confirmPassword) throw new Error("Use a matching local unlock passphrase of at least 16 characters.");
      const published = await publishDmKeyProof(draftIdentity.publicKey);
      if (!published.ok) throw new Error(published.error);
      const binding = createDmBinding(viewerFid, draftIdentity.publicKey, published.hash);
      await saveDmIdentity(draftIdentity, password);
      setStored(true);
      // The public post is the trust anchor. The relays carry only a locator, so it is signed by the local DM key.
      await publishDmBinding(binding, draftIdentity);
      setIdentity(draftIdentity);
      setBindingValid(true); setInboxReady(true);
      setNotice("Your public Farcaster proof is published and linked to your encrypted DM key. Save the recovery phrase somewhere private before closing this page.");
      setMode(null); setPendingPublicProof(false); setDraftIdentity(null); setSavedPhrase(false); setBackupWord(""); setPassword(""); setConfirmPassword(""); setRecoveryPhrase("");
      const result = await getDmSelf();
      if (result.ok) setSelf(result.user);
    } catch (e) {
      if (hasStoredDmIdentity()) { setStored(true); setPendingPublicProof(false); setMode(null); setDraftIdentity(null); setRecoveryPhrase(""); setBackupWord(""); setPassword(""); setConfirmPassword(""); }
      setError(e instanceof Error ? e.message : "Could not publish the Farcaster proof.");
    }
    finally { setLoading(false); }
  }

  async function addContact() {
    setLoading(true); setError(""); setNotice("");
    try {
      const result = await lookupDmUser(recipientInput);
      if (!result.ok) throw new Error(result.error);
      if (result.user.fid === viewerFid) throw new Error("You cannot start a DM with your own account.");
      const binding = await resolveDmBinding(result.user.fid, result.user.custodyAddress);
      if (!binding) throw new Error("That Farcaster account has not published a verified Jackcast DM identity yet.");
      const verified = binding.version === 2
        ? !!binding.castHash && await verifyDmKeyProof(binding.castHash, binding.fid, binding.publicKey)
        : await verifyDmBinding(binding, result.user.custodyAddress);
      if (!verified) throw new Error("That Farcaster DM key proof could not be verified. Do not send to this identity.");
      const relays = await resolveDmRelays(binding.publicKey);
      if (!relays.length) throw new Error("That account has not published DM inbox relays yet.");
      const contact = { ...result.user, publicKey: binding.publicKey, relays, accepted: true, blocked: false };
      setBlockedKeys((previous) => {
        const updated = previous.filter((key) => key !== contact.publicKey);
        if (identity) localStorage.setItem(BLOCKS_KEY + identity.publicKey, JSON.stringify(updated));
        return updated;
      });
      setContacts((previous) => {
        const updated = [...previous.filter((item) => item.publicKey !== contact.publicKey), contact];
        if (identity) saveContacts(identity.publicKey, updated);
        return updated;
      });
      setSelected(contact.publicKey); setRecipientInput("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not add this contact."); }
    finally { setLoading(false); }
  }

  async function send() {
    if (!identity || !selected || !compose.trim() || !bindingValid || !inboxReady) return;
    setLoading(true); setError("");
    try {
      const recipient = contacts.find((contact) => contact.publicKey === selected);
      if (!recipient) throw new Error("Could not verify this recipient. Refresh or find them again before sending.");
      if (!recipient.accepted || recipient.blocked) throw new Error("Accept this message request before replying.");
      const currentUser = await getDmUser(recipient.fid);
      if (!currentUser.ok) throw new Error(currentUser.error);
      const currentBinding = await resolveDmBinding(recipient.fid, currentUser.user.custodyAddress);
      if (!currentBinding) throw new Error("Could not verify the recipient's current DM key. Do not send until their identity can be checked.");
      if (currentBinding.publicKey !== recipient.publicKey) {
        throw new Error("This contact's DM key changed. Review and add the updated identity before sending.");
      }
      const recipientRelays = await resolveDmRelays(currentBinding.publicKey);
      if (!recipientRelays.length) throw new Error("This contact no longer has an available DM inbox relay list.");
      await sendDm(identity, selected, recipientRelays, compose, replyingTo?.id);
      setCompose("");
      setReplyingTo(null);
      await loadMessages(identity, true);
      setNotice("Encrypted message sent to the configured relays.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not send this message."); }
    finally { setLoading(false); }
  }

  async function publishCurrentBinding() {
    if (!identity || !self) return;
    setLoading(true); setError(""); setNotice("");
    try {
      const binding = await resolveDmBinding(viewerFid, self.custodyAddress);
      if (!binding || binding.publicKey !== identity.publicKey || binding.version !== 2 || !binding.castHash || !await verifyDmKeyProof(binding.castHash, viewerFid, identity.publicKey)) throw new Error("A matching public Farcaster proof is required. Restore the key setup to review and publish it.");
      await publishDmBinding(binding, identity);
      setBindingValid(true); setInboxReady(true);
      setNotice("The existing public Farcaster proof is linked to your DM inbox.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not publish the Farcaster proof locator."); }
    finally { setLoading(false); }
  }

  function lock() {
    identity?.secretKey.fill(0);
    setIdentity(null); setMessages([]); setSelected(null); setBindingValid(false); setInboxReady(false);
  }

  function forgetLocalIdentity() {
    if (!window.confirm("Remove the encrypted DM key and local conversation contacts from this browser? You will need your 24-word recovery phrase to restore it.")) return;
    identity?.secretKey.fill(0);
    if (draftIdentity) draftIdentity.secretKey.fill(0);
    forgetDmIdentity();
    setStored(false); setIdentity(null); setDraftIdentity(null); setContacts([]); setBlockedKeys([]); setMessages([]); setSelected(null); setMode(null); setRecoveryPhrase(""); setBackupWord(""); setPassword(""); setConfirmPassword("");
    setNotice("The local DM key and contact list were removed from this browser.");
  }

  function updateContact(key: string, changes: Partial<Pick<Contact, "accepted" | "blocked">>) {
    setContacts((previous) => {
      const updated = previous.map((contact) => contact.publicKey === key ? { ...contact, ...changes } : contact);
      if (identity) saveContacts(identity.publicKey, updated);
      return updated;
    });
    if (changes.blocked) blockKey(key);
  }

  function blockKey(key: string) {
    setBlockedKeys((previous) => {
      const updated = previous.includes(key) ? previous : [...previous, key];
      if (identity) localStorage.setItem(BLOCKS_KEY + identity.publicKey, JSON.stringify(updated));
      return updated;
    });
    setSelected(null);
  }

  async function copyRecovery() {
    try { await navigator.clipboard.writeText(recoveryPhrase); setNotice("Recovery phrase copied. Store it somewhere private and offline."); }
    catch { setError("Clipboard access was blocked. Select the words and copy them manually."); }
  }

  const selectedContact = contacts.find((contact) => contact.publicKey === selected);
  const thread = messages.filter((message) => message.author === selected || message.recipient === selected);
  const threadById = new Map(thread.map((message) => [message.id, message]));

  if (!identity && !mode && stored) return <section className="dm-card">
    <span className="setup-eyebrow">PRIVATE MESSAGES</span><h1>Unlock your DM key</h1>
    <p>This key is encrypted in this browser. Enter the local unlock password you chose, or restore the 24-word recovery phrase on this device.</p>
    <form className="dm-form" onSubmit={(event) => { event.preventDefault(); void unlock(); }}>
      <label>Local unlock password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      <button className="btn primary" disabled={loading || !password}>{loading ? "Unlocking…" : "Unlock"}</button>
    </form>
    <button type="button" className="btn ghost" onClick={() => { setMode("restore"); setRecoveryPhrase(""); }}>Restore with recovery phrase</button>
    <button type="button" className="btn ghost" onClick={forgetLocalIdentity}>Forget key from this browser</button>
    <p className="dm-warning">Jackcast never receives this key. The current web page can access it while unlocked. NIP-17 does not provide Signal-style forward secrecy.</p>
    {error && <p className="field-hint error" role="alert">{error}</p>}
  </section>;

  if (!identity && mode === "restore" && !draftIdentity) return <section className="dm-card">
    <h1>Restore your DM identity</h1><p>Enter the 24 words you saved when creating this key. They are processed locally and never sent to Jackcast or a relay.</p>
    <label>24-word recovery phrase<textarea rows={4} autoComplete="off" spellCheck={false} value={recoveryPhrase} onChange={(event) => setRecoveryPhrase(event.target.value)} /></label>
    <div className="dm-actions"><button type="button" className="btn primary" onClick={() => void beginRestore()}>Continue</button><button type="button" className="btn ghost" onClick={() => { setMode(null); setRecoveryPhrase(""); }}>Cancel</button></div>
    {error && <p className="field-hint error" role="alert">{error}</p>}
  </section>;

  if (!identity && mode && draftIdentity) return <section className="dm-card">
    <span className="setup-eyebrow">KEY BACKUP</span><h1>{mode === "create" ? "Save your recovery phrase" : "Protect your recovered key"}</h1>
    <p>This separate 24-word phrase controls your Jackcast DM identity. It is not your Farcaster recovery phrase. Anyone who gets it can read messages encrypted to this key.</p>
    {mode === "create" && <><div className="dm-recovery-words" aria-label="DM recovery phrase">{recoveryPhrase.split(" ").map((word, index) => <span key={`${index}-${word}`}><small>{index + 1}</small>{word}</span>)}</div><button type="button" className="btn ghost" onClick={() => void copyRecovery()}>Copy recovery phrase</button></>}
    <label>New local unlock passphrase (16+ characters)<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
    <label>Confirm local unlock passphrase<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
    <p className="field-hint">Use a long passphrase you do not use elsewhere. It protects only this browser copy; the 24 words are needed to restore on another device.</p>
    <p className="field-hint">DM public key: <code>{draftIdentity.publicKey}</code></p>
    {mode === "create" ? <label>Confirm word {confirmWordIndex + 1} from the recovery phrase<input autoComplete="off" value={backupWord} onChange={(event) => setBackupWord(event.target.value.trim().toLowerCase())} /></label> : <label className="dm-check"><input type="checkbox" checked={savedPhrase} onChange={(event) => setSavedPhrase(event.target.checked)} /> I have this recovery phrase backed up somewhere private.</label>}
    <p className="dm-warning">Jackcast reuses the Farcaster signer you approved in /setup using your Farcaster recovery seed. Your seed is cleared after setup and is never requested for DMs. No wallet connection is needed. The signer will publish one public cast linking FID {viewerFid} to this DM public key. It contains no private key or messages. Review the exact post below; nothing is published until you confirm.</p>
    {pendingPublicProof && <div className="dm-warning" role="group" aria-label="Review public DM key proof"><strong>Public Farcaster cast</strong><p>Jackcast DM key proof<br />FID: {viewerFid}<br />Nostr public key: {draftIdentity.publicKey}<br /><br />This public cast links my Farcaster identity to my Jackcast encrypted messaging key. It contains no private key or message content.</p><p>This links the key publicly on your Farcaster account. Anyone can see it. Continue only if you agree to publish this exact text.</p><div className="dm-actions"><button type="button" className="btn primary" disabled={loading} onClick={() => void confirmPublicProof()}>{loading ? "Publishing proof…" : "Publish this public proof"}</button><button type="button" className="btn ghost" disabled={loading} onClick={() => setPendingPublicProof(false)}>Cancel</button></div></div>}
    {!self && <p className="field-hint">Loading your Farcaster identity record…</p>}
    {!pendingPublicProof && <button type="button" className="btn primary" disabled={loading || password.length < 16 || password !== confirmPassword || (mode === "create" ? backupWord !== recoveryPhrase.split(" ")[confirmWordIndex] : !savedPhrase) || !self} onClick={() => void signAndEnable()}>{loading ? "Preparing…" : "Review public proof"}</button>}
    <button type="button" className="btn ghost" onClick={() => { draftIdentity.secretKey.fill(0); setDraftIdentity(null); setRecoveryPhrase(""); setBackupWord(""); setMode(null); setPassword(""); setConfirmPassword(""); }}>Cancel</button>
    {notice && <p className="field-hint" role="status">{notice}</p>}{error && <p className="field-hint error" role="alert">{error}</p>}
  </section>;

  if (!identity) return <section className="dm-card">
    <span className="setup-eyebrow">JACKCAST DMS</span><h1>Private messages across deployments</h1>
    <p>Create a separate local DM key and link its public key to your verified Farcaster FID with your already-approved Farcaster signer. No extra wallet connection, Matrix account, Firebase messages, or user API key.</p>
    <div className="dm-actions"><button type="button" className="btn primary" onClick={beginCreate}>Create DM identity</button><button type="button" className="btn ghost" onClick={() => { setMode("restore"); setRecoveryPhrase(""); }}>Restore existing identity</button></div>
    <ul className="dm-security-list"><li>Messages use NIP-17 and are encrypted on your device before relay delivery.</li><li>Relay operators see metadata and ciphertext, not message text.</li><li>NIP-17 does not provide Signal-style forward secrecy.</li><li>If you lose both this device and the recovery phrase, old messages cannot be recovered.</li></ul>
    {notice && <p className="field-hint" role="status">{notice}</p>}{error && <p className="field-hint error" role="alert">{error}</p>}
  </section>;

  return <section className="dm-inbox">
    <header className="dm-header"><div><span className="setup-eyebrow">JACKCAST DMS</span><h1>Messages</h1><p>{bindingValid ? "FID identity verified" : "FID identity not verified"} · {inboxReady ? "inbox relays ready" : "inbox relays not found"} · key <code>{prettyKey(identity.publicKey)}</code></p></div><button type="button" className="btn ghost sm" onClick={lock}>Lock key</button></header>
    {(!bindingValid || !inboxReady) && <div className="dm-warning" role="status">This key needs a verified Farcaster proof and an inbox relay list before it can send or receive DMs. <button type="button" className="btn ghost sm" disabled={loading || !self} onClick={() => void publishCurrentBinding()}>Link Farcaster proof</button></div>}
    <div className="dm-add-contact"><label htmlFor="dm-recipient">Start a message</label><div><input id="dm-recipient" value={recipientInput} onChange={(event) => setRecipientInput(event.target.value)} placeholder="Farcaster username or FID" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void addContact(); } }} /><button type="button" className="btn primary" disabled={loading || !recipientInput.trim()} onClick={() => void addContact()}>Find</button></div></div>
    <div className="dm-layout">
      <aside className="dm-threads" aria-label="Conversations">
        {conversationKeys.length === 0 ? <p className="field-hint">No messages yet. Find someone by Farcaster username or FID to start.</p> : conversationKeys.map((key) => {
          const contact = contacts.find((item) => item.publicKey === key && !item.blocked && !blockedKeys.includes(key));
          const last = [...messages].reverse().find((item) => item.author === key || item.recipient === key);
          return <button key={key} type="button" className={`dm-thread ${selected === key ? "selected" : ""}`} onClick={() => setSelected(key)}><strong>{contact ? `${contact.accepted ? "" : "Request · "}@${contact.username}` : `Request · ${prettyKey(key)}`}</strong><span>{last?.content || "No message text"}</span></button>;
        })}
      </aside>
      <div className="dm-chat">
        {!selected ? <div className="dm-empty">Choose a conversation to read or send a message.</div> : <>
          <header><strong>{selectedContact?.accepted ? `@${selectedContact.username}` : "Message request"}</strong><small>{selectedContact ? `FID ${selectedContact.fid}` : prettyKey(selected)}</small></header>
          {(!selectedContact || !selectedContact.accepted) && <div className="dm-request-actions"><span>Accept this request to reply, or block this key on this device.</span>{selectedContact && <button type="button" className="btn primary sm" onClick={() => updateContact(selectedContact.publicKey, { accepted: true })}>Accept</button>}<button type="button" className="btn ghost sm" onClick={() => blockKey(selected)}>Block</button></div>}
          <div className="dm-history" aria-live="polite">{thread.map((message) => {
            const parent = message.replyTo ? threadById.get(message.replyTo) : undefined;
            return <article key={message.id} className={`dm-message ${message.author === identity.publicKey ? "outgoing" : "incoming"}`}>
              {message.replyTo && <div className="dm-reply-reference">↳ {parent ? `Reply to: ${parent.content.slice(0, 160)}${parent.content.length > 160 ? "…" : ""}` : `Reply to earlier message · ${prettyKey(message.replyTo)}`}</div>}
              <p>{message.content}</p><time dateTime={new Date(message.createdAt * 1000).toISOString()}>{new Date(message.createdAt * 1000).toLocaleString()}</time>
              {selectedContact?.accepted && <button type="button" className="dm-reply-button" onClick={() => setReplyingTo(message)}>Reply</button>}
            </article>;
          })}</div>
          <form className="dm-compose" onSubmit={(event) => { event.preventDefault(); void send(); }}>
            {replyingTo && <div className="dm-replying"><span>Replying to: {replyingTo.content.slice(0, 140)}{replyingTo.content.length > 140 ? "…" : ""}</span><button type="button" className="btn ghost sm" onClick={() => setReplyingTo(null)}>Cancel reply</button></div>}
            <textarea rows={2} maxLength={8000} value={compose} onChange={(event) => setCompose(event.target.value)} placeholder={replyingTo ? "Write your reply" : "Write an encrypted message"} /><button type="submit" className="btn primary" disabled={loading || !compose.trim() || !bindingValid || !inboxReady}>{loading ? "Sending…" : replyingTo ? "Send reply" : "Send"}</button>
          </form>
        </>}
      </div>
    </div>
    <footer className="dm-footer"><span>Transport: Nostr relays</span><span>{DEFAULT_DM_RELAYS.length} default relays</span><button type="button" className="btn ghost sm" disabled={refreshing} onClick={() => void loadMessages(identity)}>{refreshing ? "Refreshing…" : "Refresh inbox"}</button><button type="button" className="btn ghost sm" onClick={forgetLocalIdentity}>Forget local key</button></footer>
    {(notice || error) && <p className={`field-hint ${error ? "error" : ""}`} role={error ? "alert" : "status"}>{error || notice}</p>}
  </section>;
}
