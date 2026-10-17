// @ts-check
// VOICE-REVOKE (bible/11-Multiplayer/Voice-Arc.md section 4): A SEAT ON THE SFU IS HELD, NOT KEPT. LiveKit reads a
// credential at the join alone - a participant stays until it leaves or is removed, and the server refreshes a
// connected client's token on its own - so a credential's short life bounds nothing once it is used: a member kicked
// from the party, a player gone from the room, an account muted by a moderator would each keep their seat for as long
// as their own client chose. The sweep asks the SFU who sits where and the relay whether each still may, and takes the
// seat back (RemoveParticipant) or the voice (UpdateParticipant, canPublish off - LiveKit unpublishes the tracks). A
// banned account (SAFE4) loses every seat it holds.
//
// What each seat is for rides in its own credential - the participant metadata this service mints and a client cannot
// change (livekitToken.js: canUpdateOwnMetadata false) - so the sweep needs no memory of its own. A relay that did not
// answer leaves a seat be until the next sweep (the mint refuses on the same silence): an outage must not drop every
// call at once, and nobody but this service can make the relay silent (its doors are secret-gated).

import { VOICE_PARTY_RE, voiceRoomKeyOk, voiceLayerOf, voiceRoomName } from '../../src/net/voice/voiceWire.js';
import { mintLiveKitAdminToken } from './livekitToken.js';

/** How often the node service sweeps (ms); the Worker sweeps on its cron (wrangler.toml, each minute). */
export const VOICE_SWEEP_MS = 20_000;
/** The most SFU rooms one sweep reads - past it, the next sweep starts where this one stopped. A Worker invocation may
 *  make 1,000 subrequests, and a sweep makes 1 + rooms reads of the SFU and, a seat, two of the relay (standing and
 *  presence) and at most one action: 1 + 16 + 3 * 16 * VOICE_ROOM_MAX = 785. */
export const VOICE_SWEEP_ROOMS_MAX = 16;
/** An SFU room this service names - a proximity digest or a party (voiceWire.js voiceRoomName), with its shard. */
const VOICE_SFU_ROOM_RE = /^(vx_[0-9a-f]{32}|vp_q[0-9a-z]{6,20})(?:_s([1-9]\d?))?$/;

/** @typedef {import('./roomAuthorizer.js').Seat} Seat */

/** A seat as its credential carries it. */
export const seatMeta = (/** @type {Seat} */ seat) => JSON.stringify(seat);

/** A seat read back from a participant's metadata - null for anything this service did not mint. */
export function readSeatMeta(s) {
  let m;
  try { m = JSON.parse(String(s ?? '')); } catch { return null; }
  if (!m || typeof m !== 'object') return null;
  if (m.c === 'p') return VOICE_PARTY_RE.test(String(m.k)) && m.l === 0 ? { c: 'p', k: String(m.k), l: 0 } : null;
  if (m.c === 'x') return voiceRoomKeyOk(m.k) && Number.isInteger(m.l) && voiceLayerOf(m.l) !== null ? { c: 'x', k: m.k, l: m.l } : null;
  return null;
}

/**
 * One seat's verdict: 'keep', 'remove' (no longer in the party, or the room, or banned - or no seat of ours, or a seat
 * in a room not its own) or 'mute' (still in, but muted and still able to publish).
 * @param {string} room  the SFU room the participant sits in
 * @param {any} p  a ListParticipants row
 * @param {{ nowS: number, subtle: SubtleCrypto, presenceOf: (acct: string, room: string, ly: number) => Promise<boolean|null>, standingOf: (acct: string) => Promise<{ party: string|null, mu: number, bn?: number }|null> }} o
 */
export async function seatVerdict(room, p, { nowS, subtle, presenceOf, standingOf }) {
  const identity = typeof p?.identity === 'string' ? p.identity : '';
  const seat = readSeatMeta(p?.metadata);
  const base = VOICE_SFU_ROOM_RE.exec(room)?.[1] ?? null;
  if (!identity || !seat || !base) return 'remove';
  const name = seat.c === 'p' ? await voiceRoomName('party', seat.k, 0, subtle) : await voiceRoomName('proximity', seat.k, seat.l, subtle);
  if (name !== base) return 'remove';   // a credential minted for another room - no seat we gave
  const standing = await standingOf(identity);
  if ((Number(standing?.bn) || 0) > nowS) return 'remove';   // banned: no seat anywhere
  if (seat.c === 'p') {
    if (standing === null) return 'keep';   // the relay did not answer: next sweep
    if (standing.party !== seat.k) return 'remove';
  } else if ((await presenceOf(identity, seat.k, seat.l)) === false) return 'remove';
  const perm = p?.permission ?? {};
  const canPublish = perm.can_publish ?? perm.canPublish;
  return (Number(standing?.mu) || 0) > nowS && canPublish !== false ? 'mute' : 'keep';
}

/**
 * The sweep: every SFU room this service names (VOICE_SWEEP_ROOMS_MAX at most, from `start`), every seat in it judged.
 * @param {{ env: any, fetchImpl: typeof fetch, subtle: SubtleCrypto, nowS: number, start?: number,
 *   presenceOf: (acct: string, room: string, ly: number) => Promise<boolean|null>,
 *   standingOf: (acct: string) => Promise<{ party: string|null, mu: number }|null> }} o
 * @returns {Promise<{ skipped?: true, rooms: number, removed: string[], muted: string[], next: number }>}
 */
export async function sweepVoice({ env, fetchImpl, subtle, nowS, start = 0, presenceOf, standingOf }) {
  if (!env.LIVEKIT_ADMIN_URL || !env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) return { skipped: true, rooms: 0, removed: [], muted: [], next: 0 };
  const base = String(env.LIVEKIT_ADMIN_URL).replace(/\/+$/, '');
  const call = async (/** @type {string} */ method, /** @type {string|null} */ room, body) => {
    const bearer = await mintLiveKitAdminToken({ apiKey: env.LIVEKIT_API_KEY, apiSecret: env.LIVEKIT_API_SECRET, room, nowS }, subtle);
    const res = await fetchImpl(`${base}/twirp/livekit.RoomService/${method}`, { method: 'POST', headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`${method} ${res.status}`);
    return res.json();
  };
  const listed = await call('ListRooms', null, {});
  const all = (Array.isArray(listed?.rooms) ? listed.rooms : []).map((r) => r?.name).filter((n) => typeof n === 'string' && VOICE_SFU_ROOM_RE.test(n)).sort();
  const from = all.length ? start % all.length : 0;
  const rooms = [...all.slice(from), ...all.slice(0, from)].slice(0, VOICE_SWEEP_ROOMS_MAX);
  const removed = [], muted = [];
  for (const room of rooms) {
    let seats;
    try { seats = (await call('ListParticipants', room, { room }))?.participants; } catch (e) { console.warn('[voice] sweep list', room, /** @type {any} */ (e)?.message ?? e); continue; }
    for (const p of Array.isArray(seats) ? seats : []) {
      if (typeof p?.identity !== 'string' || !p.identity) continue;   // nothing a Remove could name
      const verdict = await seatVerdict(room, p, { nowS, subtle, presenceOf, standingOf });
      try {
        if (verdict === 'remove') { await call('RemoveParticipant', room, { room, identity: p.identity }); removed.push(`${room}/${p.identity}`); }
        else if (verdict === 'mute') { await call('UpdateParticipant', room, { room, identity: p.identity, permission: { can_subscribe: true, can_publish: false, can_publish_data: false } }); muted.push(`${room}/${p.identity}`); }
      } catch (e) { console.warn('[voice] sweep', verdict, room, /** @type {any} */ (e)?.message ?? e); }
    }
  }
  return { rooms: rooms.length, removed, muted, next: from + rooms.length };
}
