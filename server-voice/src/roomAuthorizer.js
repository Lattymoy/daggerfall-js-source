// @ts-check
// May this identity token's holder join this voice room? Pure - verifier, clock and party/presence lookups are all arguments.
//
// RULES: identity is the token's verified subject (a body `playerId` is never read, so nobody impersonates); a
// party channel needs partyOf(acct) to confirm membership; a proximity channel needs presenceOf(acct, room) to confirm the relay has this identity hello'd into the room it claims; a muted account may listen but not publish.

import { verifyToken } from '../../src/net/identityToken.js';
import { voiceRoomName, VOICE_TOKEN_TTL_S } from '../../src/voice/voiceWire.js';

/**
 * @typedef {{ ok: true, identity: string, name: string, room: string, canPublish: boolean, ttl: number, claims: any }} Admitted
 * @typedef {{ ok: false, why: string, status: number }} Refused
 */

/**
 * @param {{ token: string, channel: 'proximity'|'party', room: string|null, party: string|null }} ask  validTokenAsk's projection
 * @param {{ publicKey: CryptoKey|null, subtle: SubtleCrypto, nowS: number, partyOf: (acct: string) => Promise<string|null>|string|null, presenceOf: (acct: string, room: string) => Promise<boolean>|boolean, ttlS?: number }} env
 * @returns {Promise<Admitted|Refused>}
 */
export async function authorizeVoice(ask, { publicKey, subtle, nowS, partyOf, presenceOf, ttlS = VOICE_TOKEN_TTL_S }) {
  if (!publicKey) return { ok: false, why: 'no-public-key', status: 503 };
  const v = await verifyToken(ask.token, publicKey, { subtle, nowS });
  if (!v.ok) return { ok: false, why: `bad-token:${v.why}`, status: 401 };
  const c = v.claims;
  const identity = String(c.s);
  let room;
  if (ask.channel === 'party') {
    const mine = await partyOf(identity);
    if (!mine || mine !== ask.party) return { ok: false, why: 'not-in-party', status: 403 };
    room = voiceRoomName('party', ask.party);
  } else {
    // the room is not just shape-checked - the relay must say this identity is really there; a missing presenceOf fails closed too, same law partyOf already lives by.
    if (typeof presenceOf !== 'function' || !(await presenceOf(identity, String(ask.room)))) return { ok: false, why: 'not-in-room', status: 403 };
    room = voiceRoomName('proximity', ask.room);
  }
  if (!room) return { ok: false, why: 'bad-room', status: 400 };
  // a credential may not outlive the identity token it was minted from
  const left = Number(c.e) - nowS;
  const ttl = Math.max(1, Math.min(ttlS, Number.isFinite(left) ? left : ttlS));
  const muted = Number.isFinite(c.mu) && c.mu > nowS;
  return { ok: true, identity, name: String(c.n ?? identity), room, canPublish: !muted, ttl, claims: c };
}
