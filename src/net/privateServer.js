// @ts-check
// A PRIVATE SERVER, hosted on a player's own PC (app/lib/privateHost.mjs). The desktop shell's launcher
// hosts one or joins a friend's, and tells the page its address before any game script runs (app/preload.cjs
// `daggerShell.privateServer`). Then a local character loaded this run plays online there: the relay is the game's
// own, run on the host's PC, and the sign-in is the host's - its front mints the token this asks for, signed with the
// host's own key. Nothing of a private run reaches the main relay or the account service (accountClient.js
// serviceBase answers none), so nothing made there can reach the realm.
//
// The address is always a loopback one: the host's own game connects to its front, and a guest's to the bridge its
// shell runs to the host - so wire.js relayUrl's one plain ws:// door (localhost) is the only one it needs.
import { relayUrl, sanitizeName } from './wire.js';

/** The private server this page plays on - `{ url }` - or null for the main servers.
 *  @param {any} [shell] the desktop shell's bridge (window.daggerShell) */
export function privateServer(shell = /** @type {any} */ (globalThis).daggerShell) {
  const url = relayUrl(shell?.privateServer?.url);
  return url && url.startsWith('ws://') ? { url } : null;
}

const SUBJECT_KEY = 'dfo.privateSubject';
/** This device's account id on private servers: random, made once, kept in the app's storage (identityToken.js ID_RE).
 *  @param {any} storage  appStorage() */
export function privateSubject(storage) {
  try {
    const kept = storage?.getItem?.(SUBJECT_KEY);
    if (typeof kept === 'string' && /^p[0-9a-f]{24}$/.test(kept)) return kept;
  } catch { /* unreadable: a new one */ }
  const made = 'p' + [...globalThis.crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, '0')).join('');
  try { storage?.setItem?.(SUBJECT_KEY, made); } catch { /* unsaved: this run's own */ }
  return made;
}

/**
 * The session's minter on a private server: the host's front signs a guest token for this device and the character's
 * name (POST /private/token). Null on any failure, as accountClient.js accountTokenMinter answers, so the session's
 * own retry and refusal paths hold.
 * @param {{ url: string }} server
 * @param {{ fetch: typeof globalThis.fetch, subject: () => string, name: () => unknown }} deps
 */
export function privateMinter(server, { fetch, subject, name }) {
  const at = server.url.replace(/^ws/, 'http') + '/private/token';
  return async () => {
    try {
      const n = sanitizeName(String(name() ?? '')) || 'Traveller';
      const res = await fetch(at, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ s: subject(), n }) });
      if (!res.ok) return null;
      const got = await res.json();
      return typeof got?.tok === 'string' ? got.tok : null;
    } catch { return null; }
  };
}
