// @ts-check
// A private server on a player's own PC (app/lib/privateHost.mjs). The shell's launcher hosts or joins one and
// hands the page its loopback address (app/preload.cjs). A local character then plays online there, signed in by
// the host's own key. From the world's boot the page reaches no account service, so nothing reaches the realm.
// A realm character comes as a copy: the title menu still reaches the service, so Copy to offline works there.
import { relayUrl, sanitizeName } from './wire.js';
import { appStorage } from '../systems/appStorage.js';

/** The private server this page plays on - `{ url }` - or null for the main servers.
 *  @param {any} [shell] the desktop shell's bridge (window.daggerShell) */
export function privateServer(shell = /** @type {any} */ (globalThis).daggerShell) {
  const url = relayUrl(shell?.privateServer?.url);
  return url && url.startsWith('ws://') ? { url } : null;
}

/** What the title menu says when a realm character is opened on a private server. */
export const PRIVATE_REALM_REFUSED = 'You are on a private server. To bring an online character, use Copy to offline on it first, then load the copy. Your online character stays as it is.';

let running = false;
/** The world's boot on a private server starts the run: from then on the page reaches no account service. */
export function startPrivateRun() { running = true; }
/** Whether this page's world plays on a private server (accountClient.js serviceBase). */
export const privateRunOn = () => running;

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

/**
 * The world's boot on a private server: starts the run and takes a local character online. Answers
 * `{ url, mint, refusal }` (`refusal` is a realm boot's answer when a realm character was opened), or null.
 * @param {URLSearchParams} params  the boot's
 * @param {(p: URLSearchParams) => void} publish  the lane's publishBootParams
 * @param {() => unknown} name  the character's name, read at each mint
 */
export function privateBoot(params, publish, name) {
  const server = privateServer();
  if (!server) return null;
  startPrivateRun();
  const realm = params.has('realm') || params.has('realmnew');
  if (!realm && !params.has('online')) { params.set('online', ''); publish(params); }
  const mint = privateMinter(server, { fetch: (u, i) => globalThis.fetch(u, i), subject: () => privateSubject(appStorage()), name });
  return { url: server.url, mint, refusal: realm ? { ok: false, error: 'private' } : null };
}
