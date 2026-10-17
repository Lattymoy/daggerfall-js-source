// @ts-check
// May this identity token's holder join this voice room? Pure - verifier, clock and the relay's lookups are all arguments.
//
// RULES: identity is the token's verified subject (a body `playerId` is never read, so nobody impersonates); a
// party channel needs standingOf(acct) - the hub's word on its party and its mute - to confirm membership; a proximity
// channel needs presenceOf(acct, room, ly) to confirm the relay has this identity hello'd into the room - and the layer
// of it - it claims; a muted account may listen but not publish, muted by its token's `mu` or by the hub's (a mute
// order the hub heard after the token was minted - MOD1); a banned account (SAFE4's ban, the hub's `bn`) is refused
// either channel. A lookup that did not answer (null) refuses: fail closed.

import { verifyToken } from '../../src/net/identityToken.js';
import { voiceRoomName, VOICE_TOKEN_TTL_S } from '../../src/net/voice/voiceWire.js';

/**
 * @typedef {{ c: 'x', k: string, l: number } | { c: 'p', k: string, l: 0 }} Seat  what a credential is for - its channel (`x` proximity, `p` party), the game's key or the party, the layer - carried in it as LiveKit participant metadata for the sweep (revoker.js)
 * @typedef {{ party: string|null, mu: number, bn?: number }} Standing
 * @typedef {{ ok: true, identity: string, name: string, room: string, seat: Seat, canPublish: boolean, ttl: number, claims: any }} Admitted
 * @typedef {{ ok: false, why: string, status: number }} Refused
 */

/**
 * @param {{ token: string, channel: 'proximity'|'party', room: string|null, party: string|null, ly?: number }} ask  validTokenAsk's projection
 * @param {{ publicKey: CryptoKey|null, subtle: SubtleCrypto, nowS: number, standingOf?: (acct: string) => Promise<Standing|null>|Standing|null, presenceOf?: (acct: string, room: string, ly: number) => Promise<boolean|null>|boolean|null, ttlS?: number }} env
 * @returns {Promise<Admitted|Refused>}
 */
export async function authorizeVoice(ask, { publicKey, subtle, nowS, standingOf, presenceOf, ttlS = VOICE_TOKEN_TTL_S }) {
  if (!publicKey) return { ok: false, why: 'no-public-key', status: 503 };
  const v = await verifyToken(ask.token, publicKey, { subtle, nowS });
  if (!v.ok) return { ok: false, why: `bad-token:${v.why}`, status: 401 };
  const c = v.claims;
  const identity = String(c.s);
  const standing = typeof standingOf === 'function' ? await standingOf(identity) : null;
  if ((Number(standing?.bn) || 0) > nowS) return { ok: false, why: 'banned', status: 403 };
  let room, seat;
  if (ask.channel === 'party') {
    if (!standing?.party || standing.party !== ask.party) return { ok: false, why: 'not-in-party', status: 403 };
    room = await voiceRoomName('party', ask.party, 0, subtle);
    seat = /** @type {Seat} */ ({ c: 'p', k: String(ask.party), l: 0 });
  } else {
    // the room is not just shape-checked - the relay must say this identity is really there; a missing presenceOf fails closed too, as a party does.
    const ly = ask.ly ?? 0;
    if (typeof presenceOf !== 'function' || (await presenceOf(identity, String(ask.room), ly)) !== true) return { ok: false, why: 'not-in-room', status: 403 };
    room = await voiceRoomName('proximity', ask.room, ly, subtle);
    seat = /** @type {Seat} */ ({ c: 'x', k: String(ask.room), l: ly });
  }
  if (!room) return { ok: false, why: 'bad-room', status: 400 };
  // a credential may not outlive the identity token it was minted from
  const left = Number(c.e) - nowS;
  const ttl = Math.max(1, Math.min(ttlS, Number.isFinite(left) ? left : ttlS));
  const muted = (Number.isFinite(c.mu) && c.mu > nowS) || (Number(standing?.mu) || 0) > nowS;
  return { ok: true, identity, name: String(c.n ?? identity), room, seat, canPublish: !muted, ttl, claims: c };
}
