// @ts-check
// SESSION-SIGN (2026-10-18; bible/11-Multiplayer/Scale-Arc.md THE PLAN PAST 1,000, decision 4 - the owner, at a thousand
// online: "Make the best call for future proofing"): THE SESSION'S LOOKUP OFF THE HOT ROUTES. Every authenticated request
// asked the account database who its secret is (accounts.js resolveSession, WHO_SQL) - a round trip each, some 30-74 a
// second at a thousand online on the one primary and its replicas, and the primary is capped by its trips (PRIMARY-TRIPS).
// Now a hot route (passRoute: the checkpoint, the heartbeat, a town's homes, the pixels, the chapters' sheet, the seats'
// list) whose lookup the primary answered carries a PASS back beside its answer (`x-session-pass`, net/sessionPassLaw.js):
// who the lookup found - the account's id, its session, its handle, when it registered and its mute - signed by the
// service for PASS_TTL_S and bound to the secret it was minted for. The page sends it back with that secret on the hot
// routes, and there the service believes it without asking. A hot route reads nothing of the account but those
// (test/server/sessionsign.test.js holds every hot route's answer under a pass to the lookup's own, over the accounts it
// reads differently).
//
// THE LAG IS THE DECISION'S, ON THE READS: a sign-out, a password change, a recovery, a ban, a mute or an unmute reaches a
// hot route's reads when its pass is renewed - a pass is believed until PASS_RENEW_S before it ends, so under PASS_TTL_S -
// PASS_RENEW_S after it was minted, and it is minted only off a lookup the primary answered (passMintable - a replica's
// may be older than a sign-out, AUDIT PLAN-1000 E5) - and every other route at once, the mint of the relay's token among
// them (a ban and a mute are pushed to the relay besides: sanctions.js pushLaw). THE WRITES DO NOT WAIT (E3): the
// checkpoint and the heartbeat's beat ask the session and the ban in the statement they already make (realm.js
// checkpointRealm, accounts.js creditPlay). A banned account is handed no pass (E6), and a page lets its pass go when the
// account it names changes under its secret - a guest registered (net/accountClient.js, E2). A pass that fails - forged,
// another secret's, past its time, a service with no key - is no refusal: the lookup answers, as it did.
//
// THE KEY IS THE SERVICE'S OWN, DRAWN FOR THIS ALONE: HMAC-SHA-256 under a key HKDF draws from IDENTITY_PRIVATE_KEY's
// bytes (info PASS_INFO), so no new secret is set, and a pass is never a relay token (another algorithm under another
// key). The secret rides in the MAC, never in the pass: a pass without its secret is believed nowhere. The key outlives a
// deploy (account-deploy.yml mints the pair once), so a slice that changes what a pass claims changes PASS_INFO with it
// (E11) - no pass minted before it is believed after, nor after a rollback.

/* global atob */
import { _b64url } from '../../src/net/identityToken.js';
import { DB_FIRST_PRIMARY } from './service.js';

/** How long a pass is good for (decision 4: five minutes - the relay's identity tokens already accept five). */
export const PASS_TTL_S = 300;
/** A pass with this little left, or less, is not believed: the lookup answers, and a new pass rides back - so a page that
 *  asks as often as the heartbeat renews its pass before it lapses, and the lag is under PASS_TTL_S - PASS_RENEW_S. */
export const PASS_RENEW_S = 60;
/** A pass's most characters: one longer is never believed, and never minted (AUDIT PLAN-1000 E9). */
export const PASS_MAX_CHARS = 1024;
/** HKDF's word for this key (a key drawn for another use names another; a pass that claims another thing, another). */
const PASS_INFO = 'dfo-session-pass-v1';

/** The hot routes, by path: the measured busiest that read nothing of the account but a pass's fields (PRIMARY-TRIPS'
 *  counts; bible/11-Multiplayer/Scale-Arc.md SESSION-SIGN). The progression claims, the mint and every route that changes
 *  an account keep the lookup. */
export const PASS_PATHS = Object.freeze(['/v1/heartbeat', '/v1/homes/town', '/v1/prof/pixels', '/v1/chapters/list', '/v1/seats/list', '/v1/festival/town']);   // WITCH1: and a town's Hearth Offerings, asked as its homes are
const PASS_PATH_SET = new Set(PASS_PATHS);
/** The realm checkpoint (service.js's realm data path), a PUT. */
const CHECKPOINT_RE = /^\/v1\/realm\/r[0-9a-f]{20}\/data$/;

/** Whether `path` (asked with `method`) is a hot route a pass is believed on. */
export const passRoute = (/** @type {string} */ path, /** @type {string} */ method) => PASS_PATH_SET.has(path) || (method === 'PUT' && CHECKPOINT_RE.test(path));
/** AUDIT PLAN-1000 E5: whether a request's lookup was the primary's own answer - asked on the binding (`binding`, every route
 *  REPLICA_ROUTES does not name), or a session that began at the primary (service.js routeDb with no bookmark: its first
 *  statement is the lookup). A bookmarked session's lookup is a replica's, which may stand before a sign-out: no pass. */
export const passMintable = (/** @type {any} */ db, /** @type {any} */ binding) => db === binding || db?.[DB_FIRST_PRIMARY] === true;

/** @type {Promise<CryptoKey|null>|null} */
let _passKey = null;
/** The pass key, or null for a service with no IDENTITY_PRIVATE_KEY (no pass is minted or believed). Drawn once an isolate. */
export function passKey(/** @type {any} */ env, /** @type {SubtleCrypto} */ subtle) {
  if (_passKey) return _passKey;
  const b64 = String(env?.IDENTITY_PRIVATE_KEY ?? '');
  if (!b64) return Promise.resolve(null);
  _passKey = (async () => {
    try {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const base = await subtle.importKey('raw', bytes, 'HKDF', false, ['deriveKey']);
      return await subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: new TextEncoder().encode(PASS_INFO) },
        base, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign', 'verify']);
    } catch { return null; }
  })();
  return _passKey;
}
/** A stood service is a fresh isolate: its key drawn again (test/accountDb.mjs, beside signing.js's). */
export function _resetPassKeyForTests() { _passKey = null; }

/** What the MAC covers: the pass's body, and the secret it was minted for. */
const macInput = (/** @type {string} */ body, /** @type {string} */ secret) => new TextEncoder().encode(`p1.${body}.${secret}`);
const intOrNull = (/** @type {any} */ v) => (Number.isSafeInteger(v) ? v : null);

/**
 * A pass for the account the lookup found (`who`, resolveSession's answer), minted for `secret`, good until
 * `nowS + PASS_TTL_S`. `p1.<body>.<mac>` - the body base64url JSON, the MAC base64url - or null past PASS_MAX_CHARS.
 * @param {CryptoKey} key @param {{ player: any, session: any }} who @param {string} secret @param {number} nowS @param {SubtleCrypto} subtle
 */
export async function mintPass(key, who, secret, nowS, subtle) {
  const p = who.player;
  const claims = { p: p.id, s: who.session?.id ?? null, h: typeof p.handle === 'string' ? p.handle : null, r: intOrNull(p.registered_at),
    m: intOrNull(p.muted_until), x: nowS + PASS_TTL_S };
  const body = _b64url.encode(new TextEncoder().encode(JSON.stringify(claims)));
  const mac = new Uint8Array(await subtle.sign('HMAC', key, macInput(body, secret)));
  const pass = `p1.${body}.${_b64url.encode(mac)}`;
  return pass.length > PASS_MAX_CHARS ? null : pass;   // E9: one that would never be believed is never handed
}

/**
 * Who a pass says, as resolveSession answers it (`{ player, session }` - the player's columns a pass carries, no other),
 * or null: not a pass, not this secret's, not the service's, or within PASS_RENEW_S of its end. Never throws.
 * @param {CryptoKey} key @param {any} pass @param {any} secret @param {number} nowS @param {SubtleCrypto} subtle
 */
export async function readPass(key, pass, secret, nowS, subtle) {
  if (typeof pass !== 'string' || pass.length > PASS_MAX_CHARS || typeof secret !== 'string' || !secret) return null;
  const parts = pass.split('.');
  if (parts.length !== 3 || parts[0] !== 'p1') return null;
  const mac = _b64url.decode(parts[2]), body = _b64url.decode(parts[1]);
  if (!mac || !body) return null;
  try {
    if (!(await subtle.verify('HMAC', key, mac, macInput(parts[1], secret)))) return null;
    const c = JSON.parse(new TextDecoder().decode(body));
    if (!c || typeof c.p !== 'string' || !Number.isSafeInteger(c.x) || c.x - nowS <= PASS_RENEW_S) return null;
    return {
      player: { id: c.p, handle: c.h ?? null, registered_at: c.r ?? null, muted_until: c.m ?? null },   // E6: a banned account was minted none
      session: { id: c.s ?? null },
      pass: true,
    };
  } catch { return null; }
}
