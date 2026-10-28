// @ts-check
// SD-PARTY (2026-10-28, bible/11-Multiplayer/Super-Dungeons.md SD-PARTY): the relay's half of a party's own Hour,
// the room `sd:<s>.<owner>` (sdLaw.js sdRoomKey). The door lets in the owner, staff and the owner's party (the hub's
// word, _instanceKinOf); the hub silent is busy. The hub keeps one life and one win an account a Hollow across copies:
// a realm asks it before a newcomer and tells it each death and rise.
import { SD_KEY, sdReceiptKey, SOCIAL_ROOM, SD_TELL_RETRY_MS } from '../../src/net/wire.js';
import { sdOwnerOfRoom, SD_NO_FALLEN } from '../../src/net/superDungeon/sdLaw.js';
import { instanceOwnerOf } from '../../src/net/instanceRoom.js';
import { ROOM_CALL_MS } from './relayScale.js';

/** The door's refusals, said by the realm as its others are: a copy of the Hour is its party's alone, and an account
 *  wins one Hollow once, in whichever copy. */
export const SD_NO_PARTY = 'This Hour belongs to another party.';
export const SD_NO_WON = 'You have already broken this Hour.';
/** The hub's internal door a realm asks and tells of an account's life and win this Hollow. */
export const SD_INTERNAL_ACCT = '/internal/sd/acct';
/** Where the hub keeps an account's death in this Hollow - `{ s, d: 1 }` (one Hollow stands at a time). */
export const sdAcctKey = (sub) => `sdac:${sub}`;
const SUB_RE = /^[A-Za-z0-9_-]{4,64}$/;

/**
 * THE COPY'S DOOR - why `sub` may not stand in the realm `key`, or null. `staff` its right as staff; `kin(sub, owner)`
 * the hub's word that `sub`'s party holds the owner (true, false, or null while the hub is silent).
 * @param {string} key @param {string|null} sub @param {boolean} staff
 * @param {(sub: string, owner: string) => Promise<boolean|null>} kin @returns {Promise<string|null>} 'busy' or a refusal
 */
export async function sdCopyRight(key, sub, staff, kin) {
  const owner = sdOwnerOfRoom(key);
  if (!owner || !sub) return SD_NO_PARTY;
  if (staff || (await instanceOwnerOf(sub)) === owner) return null;
  const k = await kin(sub, owner);
  return k == null ? 'busy' : k ? null : SD_NO_PARTY;
}

/** A realm's word to the hub - `{ s, a, op }`, op 'may', 'down' or 'up' - projected, or null. */
export function validSdAcct(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const b = /** @type {any} */ (v);
  return Number.isSafeInteger(b.s) && b.s > 0 && typeof b.a === 'string' && SUB_RE.test(b.a) && ['may', 'down', 'up'].includes(b.op) ? { s: b.s, a: b.a, op: b.op } : null;
}

/** THE REALM ASKS OR TELLS THE HUB. Answers the hub's JSON, or null when it is silent (a relay of one room: `{ ok: true }`).
 *  @param {any} env @param {{ s: number, a: string, op: string }} body */
export async function sdAcctAsk(env, body) {
  const rooms = env?.ROOMS;
  if (!rooms?.idFromName || !rooms?.get) return { ok: true };
  try {
    const res = await rooms.get(rooms.idFromName(SOCIAL_ROOM)).fetch(new Request(`https://relay.internal${SD_INTERNAL_ACCT}`, { method: 'POST', body: JSON.stringify(body), signal: AbortSignal.timeout(ROOM_CALL_MS) }));
    return res?.ok ? await res.json() : null;
  } catch (e) { console.warn('[sd] acct', e?.message ?? e); return null; }
}

/** May `sub`, new to this copy, come in - null or the refusal. The hub silent lets it in: the realm's own record and
 *  door still hold (a hub that struggles shuts no Hour - AUDIT SD II L3 F2's law). @param {any} env @param {number} s @param {string} sub */
export async function sdNewcomerWord(env, s, sub) {
  const r = await sdAcctAsk(env, { s, a: sub, op: 'may' });
  return r?.w === 'won' ? SD_NO_WON : r?.w === 'down' ? SD_NO_FALLEN : null;
}

/** A death or a rise told to the hub, once again a beat on if the first was not heard - never awaited by the pose.
 *  @param {any} room the realm (its `env`, its `state`) @param {number} s @param {string} sub @param {'down'|'up'} op */
export function sdAcctTell(room, s, sub, op) {
  const once = () => sdAcctAsk(room.env, { s, a: sub, op });
  const p = once().then((r) => (r ? r : new Promise((ok) => setTimeout(ok, SD_TELL_RETRY_MS)).then(once)));
  try { room.state?.waitUntil?.(p); } catch { /* not every runtime */ }
  return p;
}

/** THE HUB'S ANSWER. `may`: 'won' for an account holding this slot's receipt, 'down' for one lying dead in a copy;
 *  `down` and `up` kept and cleared. A word for another slot than the hub's record is ok and kept nowhere.
 *  @param {any} room the hub @param {Request} request */
export async function sdAcctInternal(room, request) {
  let body = null;
  try { body = await request.json(); } catch { body = null; }
  const c = validSdAcct(body);
  if (!c) return Response.json({ ok: false }, { status: 400 });
  const rec = await room.state.storage.get(SD_KEY);
  if (!rec || rec.s !== c.s) return Response.json({ ok: true });
  if (c.op === 'down') { await room.state.storage.put(sdAcctKey(c.a), { s: c.s, d: 1 }); return Response.json({ ok: true }); }
  if (c.op === 'up') { await room.state.storage.delete(sdAcctKey(c.a)); return Response.json({ ok: true }); }
  const rc = await room.state.storage.get(sdReceiptKey(c.a));
  if (rc && typeof rc === 'object' && rc.s === c.s) return Response.json({ ok: true, w: 'won' });
  const d = await room.state.storage.get(sdAcctKey(c.a));
  return Response.json({ ok: true, ...(d && d.s === c.s ? { w: 'down' } : {}) });
}
