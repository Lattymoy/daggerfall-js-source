// @ts-check
// LEASE1 (2026-10-22, mob of the staff panel's freeze: "this need addressed"; design doc "DFO Staff Panel: design",
// "Holding against a modded game: room leases"): A ROOM HEARS THE HUB'S WORD ON EVERY SOCKET, NOT THE GAME'S. A mute,
// a ban and (with the staff panel) a freeze land on the hub - the law door posts there (server/src/index.js lawDoor) -
// and every other room hears one only when the player's own game carries it (`{t:'law'}`, scenes/chatSafetyHost.js).
// A room reads a token only at hello, so a changed game that carries nothing kept talking in Trade, LFG, a language's
// room or a region's for as long as its sockets stood.
//
// So the hub hands each of its sockets a LEASE - its account, its mute and freeze as the hub holds them now, and when
// it lapses - signed with a key only the relay holds, and the game hands it on to every other room it holds:
//   - every LEASE_MS the game asks its hub link (`{t:'lease'}`), the hub (a shard, or the bus itself) answers
//     `{t:'lease', l}`, and each lease room's socket the game holds (`leaseRoom`) says the same frame just ahead of the
//     next frame it sends there (net/online.js `_leased`) - a room where the player does nothing is woken by nothing
//     (mob's load check, 2026-10-22 07:57Z);
//   - a lease room takes a lease for the socket's own account only; one newer than the room's last word on the socket
//     (its token, a carried order, an earlier lease) sets the socket's mute and freeze - the hub's word wins - and an
//     older one still holds a freeze longer than the room's, since a token says nothing of one (a review of the PR);
//   - a socket whose hello said it hands leases on (`ls` 1) is BOUND: while the relay's `leaseDoor` is on (net/relayCfg.js),
//     a bound socket is heard in nothing but its ping and its lease until its first lease lands - no grace (a review of
//     the PR: a changed game that reconnected inside one would never be leased, and a token carries no freeze); the
//     honest game keeps its hub's newest lease wherever it stands and hands it on ahead of its first frame there, and
//     that frame waits on the lease's read (a frame before the game's first lease, or long after its hub went away, is
//     lost with the door on: the game has nothing to hand on, its poses go again, and its hub answers within a trip); a
//     region's shard asks the door before it hands a line up to its bus; a bound socket whose last lease lapsed is heard
//     in nothing until its next lands, never closed (the third review: a close bought an honest game back from a hidden
//     tab nothing but a reconnect, as unheard); a bound socket's frame with no live lease waits on the hub's answer, never
//     a guess; and a lease room refuses a hello that does not say `ls` (LEASE_OLD_REASON, GRANT-DOOR's own law: off until
//     the site serves the build that says it, since the relay deploys first), never waiting on the hub to know - and a
//     frame of such a build asks the hub only in a wake that never has (the load: never once a minute a room);
//   - a banned account holds no hub link, so it is handed no lease.
// The key is the relay's own secret (GATE_SIGNING_KEY) through HKDF with this law's own info - no new secret, and never
// the key that signs a receipt. A relay without the secret hands out none, and binds nobody.

import { _b64url, ID_RE } from './identityToken.js';
import { isSocialRoom, LEASE_WIRE_MAX } from './wire.js';

/** How often a game asks its hub for a lease. */
export const LEASE_MS = 30_000;
/** A lease's life, seconds - three asks, so one lost on the way costs nothing. */
export const LEASE_LIFE_S = 90;
/** The fewest ms between two lease frames a room reads from one socket (an ask minted, or a lease checked) - an honest game
 *  says one every LEASE_MS. */
export const LEASE_FRAME_MIN_MS = 5_000;
/** How long the game hands a lease on after it came - its life less a margin for the wire, on the game's own clock from
 *  when it came, never by the lease's own times (a player's clock is not the relay's). One past it the room would read as
 *  none, spending its one lease read in LEASE_FRAME_MIN_MS on it (a review of the PR). */
export const LEASE_HELD_MS = (LEASE_LIFE_S - 15) * 1000;
/** The fewest ms between two leases the game hands one socket - the room's meter (LEASE_FRAME_MIN_MS), and a second for
 *  the wire's jitter; a newer lease waits for the frame after (the third review: one the meter dropped was counted handed). */
export const LEASE_HAND_MIN_MS = LEASE_FRAME_MIN_MS + 1000;
/** HKDF's info: this law's key and nobody else's. */
export const LEASE_INFO = 'dfo-room-lease:v1';
/** The close reason of a hello the lease door refuses (a WebSocket close's reason is at most 123 bytes); the words ride
 *  the error frame before it, GROUND-GATE's own (server/src/index.js GROUND_OLD_WORDS: update the game). */
export const LEASE_OLD_REASON = 'old lease';
/** The first relay that knows the frame (RELAY_VERSION's number). */
export const LEASE_RELAY_MIN = 242;
/** Does the relay at version `v` know the lease frame? An older one closes a socket on a frame type it does not know. */
export const relaySupportsLease = (v) => Number(/^world(\d+)$/.exec(String(v ?? ''))?.[1]) >= LEASE_RELAY_MIN;
/** A room a lease binds: EVERY ROOM BUT THE HUB'S (and its shards), which hands leases out - a channel (Trade, LFG, a
 *  language's, a region's and its shards), a cell or world room, and every place a player acts in besides: a home, a
 *  caravan, a boat, a siege or a Royal Tourney, an arena's hall and floors, a gate's court, an Elite Breach, a Super
 *  dungeon's realm (STAFF-PANEL5-FREEZE-FIX, mob: "freeze they can only talk to staff while frozen" - a review found a
 *  frozen player free in each of these, which no lease reached). A room's kind added later is bound from its first day. */
export const leaseRoom = (key) => typeof key === 'string' && !isSocialRoom(key);

const enc = new TextEncoder();
const dec = new TextDecoder();
const until = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : null);

/**
 * The lease key from the relay's secret: HMAC-SHA-256, sign and verify, derived through HKDF (LEASE_INFO). Null - never a
 * throw - for none.
 * @param {unknown} secret @param {{subtle: SubtleCrypto}} env
 */
export async function leaseKeyOf(secret, { subtle }) {
  if (typeof secret !== 'string' || !secret) return null;
  try {
    const base = await subtle.importKey('raw', enc.encode(secret), 'HKDF', false, ['deriveKey']);
    return await subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: enc.encode(LEASE_INFO) }, base, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign', 'verify']);
  } catch { return null; }
}

/**
 * MINT - the hub's half: `<claims>.<mac>`, base64url, or null for claims no lease carries. STAFF-PANEL5-FREEZE-FIX (round
 * two, a review: a hub shard's lease is its bus's to mint, so a bus that did not answer left every lease room unheard):
 * `p` 1 is a PASS, the lease a hub shard mints off its own attachment while its bus takes nothing it hands up - a room
 * reads it as a lease older than its own last word (`readLease` says `p`; server/src/index.js `_leaseRead`): its life
 * renewed and a freeze it carries taken, never a mute or a freeze lifted (a fresh hello there has not heard the bus's
 * book of freezes - the review's finding 25).
 * @param {{ s: string, mu?: number, fz?: number, at: number, p?: number }} what  `s` the account, `mu`/`fz` until when (epoch s; 0 none), `at` now (epoch s), `p` 1 a pass
 * @param {CryptoKey} key @param {{subtle: SubtleCrypto}} env
 */
export async function mintLease({ s, mu = 0, fz = 0, at, p = 0 }, key, { subtle }) {
  if (typeof s !== 'string' || !ID_RE.test(s) || until(mu) == null || until(fz) == null || !(until(at) > 0) || (p !== 0 && p !== 1)) return null;
  const body = _b64url.encode(enc.encode(JSON.stringify({ s, m: mu, f: fz, a: at, u: at + LEASE_LIFE_S, ...(p ? { p } : {}) })));
  const mac = new Uint8Array(await subtle.sign('HMAC', key, enc.encode(body)));
  const l = `${body}.${_b64url.encode(mac)}`;
  return l.length <= LEASE_WIRE_MAX ? l : null;
}

/**
 * READ - a room's half: `{ s, mu, fz, at, u }` (and `p` 1, a pass) for a lease this relay signed that has not lapsed at
 * `nowS`, else null.
 * @param {unknown} l @param {CryptoKey} key @param {{subtle: SubtleCrypto, nowS: number}} env
 */
export async function readLease(l, key, { subtle, nowS }) {
  if (typeof l !== 'string' || l.length > LEASE_WIRE_MAX) return null;
  const dot = l.indexOf('.');
  if (dot < 1 || dot !== l.lastIndexOf('.')) return null;
  const body = l.slice(0, dot), mac = _b64url.decode(l.slice(dot + 1));
  if (!mac) return null;
  let ok = false;
  try { ok = await subtle.verify('HMAC', key, mac, enc.encode(body)); } catch { return null; }
  if (!ok) return null;
  let c;
  try { c = JSON.parse(dec.decode(_b64url.decode(body) ?? new Uint8Array(0))); } catch { return null; }
  if (!c || typeof c.s !== 'string' || !ID_RE.test(c.s) || until(c.m) == null || until(c.f) == null || !(until(c.a) > 0) || c.u !== c.a + LEASE_LIFE_S || (c.p !== undefined && c.p !== 1)) return null;
  if (c.u <= nowS || c.a > nowS + 30) return null;   // lapsed, or from a clock past the relay's own skew
  return { s: c.s, mu: c.m, fz: c.f, at: c.a, u: c.u, ...(c.p ? { p: 1 } : {}) };
}
