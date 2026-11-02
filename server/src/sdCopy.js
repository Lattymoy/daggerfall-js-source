// @ts-check
// SD-PARTY (2026-10-28, bible/11-Multiplayer/Super-Dungeons.md SD-PARTY): the relay's half of a party's own Hour,
// the room `sd:<s>.<owner>` (sdLaw.js sdRoomKey). The door lets in the owner, staff and the owner's party (the hub's
// word, _instanceKinOf); the hub silent is busy. The hub keeps one life and one win an account a Hollow across copies:
// a realm asks it before a newcomer and tells it each death, kept with the copy it was in - SD-BACK: that copy takes the
// dead back, no other does. SD-SOLO: a shared Hour (`p<n>`) admits anyone to SD_PUB_SEATS; the Worker finds the open one.
import { SD_KEY, sdReceiptKey, sdLaneKey, SOCIAL_ROOM, SD_TELL_RETRY_MS } from '../../src/net/wire.js';
import {
  sdOwnerOfRoom,
  sdRoomKey,
  sdPubOwner,
  isSdPubOwner,
  sdLaneOf,
  SD_NO_FALLEN,
  SD_PUB_SEATS,
  SD_PUB_MAX,
} from '../../src/net/superDungeon/sdLaw.js';
import { instanceOwnerOf } from '../../src/net/instanceRoom.js';
import { ROOM_CALL_MS } from './relayScale.js';

/** The door's refusals, said by the realm as its others are: a copy of the Hour is its party's alone, and an account
 *  wins one Hollow once, in whichever copy. */
export const SD_NO_PARTY = 'This Hour belongs to another party.';
export const SD_NO_WON = 'You have already broken this Hour.';
/** The hub's internal door a realm asks and tells of an account's life and win this Hollow. */
export const SD_INTERNAL_ACCT = '/internal/sd/acct';
/** Where the hub keeps an account's death in its lane's Hollow - `{ s, d: 1, o }` (one Hollow stands a lane at a time).
 *  AUDIT TAMRIEL-WIDE B1: a lane past the Bay's under `sdac:<sub>.<lane>` (sdReceiptKey's law); the Bay's as it was. */
export const sdAcctKey = (sub, lane = 0) => (lane ? `sdac:${sub}.${lane}` : `sdac:${sub}`);
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
  if (isSdPubOwner(owner)) return null; // SD-SOLO: a shared Hour's door is its seats'
  if (staff || (await instanceOwnerOf(sub)) === owner) return null;
  const k = await kin(sub, owner);
  return k == null ? 'busy' : k ? null : SD_NO_PARTY;
}

/** A realm's word to the hub - `{ s, a, op, o }`, op 'may' or 'down', `o` the copy's owner - projected, or null. */
export function validSdAcct(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const b = /** @type {any} */ (v);
  return Number.isSafeInteger(b.s) &&
    b.s > 0 &&
    typeof b.a === 'string' &&
    SUB_RE.test(b.a) &&
    ['may', 'down'].includes(b.op) &&
    sdRoomKey(b.s, b.o)
    ? { s: b.s, a: b.a, op: b.op, o: b.o }
    : null;
}

/** THE REALM ASKS OR TELLS THE HUB. Answers the hub's JSON, or null when it is silent (a relay of one room: `{ ok: true }`).
 *  @param {any} env @param {{ s: number, a: string, op: string, o: string }} body */
export async function sdAcctAsk(env, body) {
  const rooms = env?.ROOMS;
  if (!rooms?.idFromName || !rooms?.get) return { ok: true };
  try {
    const res = await rooms.get(rooms.idFromName(SOCIAL_ROOM)).fetch(
      new Request(`https://relay.internal${SD_INTERNAL_ACCT}`, {
        method: 'POST',
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(ROOM_CALL_MS),
      }),
    );
    return res?.ok ? await res.json() : null;
  } catch (e) {
    console.warn('[sd] acct', e?.message ?? e);
    return null;
  }
}

/** May `sub`, new to the copy owned by `o`, come in - null or the refusal. The hub silent lets it in: the realm's own
 *  record and door still hold (a hub that struggles shuts no Hour - AUDIT SD II L3 F2's law).
 *  @param {any} env @param {number} s @param {string} sub @param {string} o */
export async function sdNewcomerWord(env, s, sub, o) {
  const r = await sdAcctAsk(env, { s, a: sub, op: 'may', o });
  return r?.w === 'won' ? SD_NO_WON : r?.w === 'down' ? SD_NO_FALLEN : null;
}

/** A death told to the hub, with the copy it was in - once again a beat on if the first was not heard, never awaited.
 *  @param {any} room the realm (its `env`, its `state`) @param {string} key its room @param {string} sub */
export function sdAcctTell(room, key, sub) {
  const s = Number(String(key).slice(3).split('.')[0]),
    o = sdOwnerOfRoom(key);
  const once = () => sdAcctAsk(room.env, { s, a: sub, op: 'down', o });
  const p = once().then((r) => (r ? r : new Promise((ok) => setTimeout(ok, SD_TELL_RETRY_MS)).then(once)));
  try {
    room.state?.waitUntil?.(p);
  } catch {
    /* not every runtime */
  }
  return p;
}

/** THE HUB'S ANSWER. `may`: 'won' for an account holding this slot's receipt, 'down' for one that died in another copy;
 *  `down` kept, with its copy (the first death's). A word for another slot than its lane's record is ok and kept nowhere.
 *  AUDIT TAMRIEL-WIDE B1: the slot's own lane's record, death and receipt (WW5's keys) - it read the Bay's alone.
 *  @param {any} room the hub @param {Request} request */
export async function sdAcctInternal(room, request) {
  let body = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const c = validSdAcct(body);
  if (!c) return Response.json({ ok: false }, { status: 400 });
  const lane = sdLaneOf(c.s);
  const rec = await room.state.storage.get(sdLaneKey(SD_KEY, lane));
  if (!rec || rec.s !== c.s) return Response.json({ ok: true });
  const d = await room.state.storage.get(sdAcctKey(c.a, lane));
  const mine = d && d.s === c.s ? d : null;
  if (c.op === 'down') {
    if (!mine) await room.state.storage.put(sdAcctKey(c.a, lane), { s: c.s, d: 1, o: c.o });
    return Response.json({ ok: true });
  }
  const rc = await room.state.storage.get(sdReceiptKey(c.a, lane));
  if (rc && typeof rc === 'object' && rc.s === c.s) return Response.json({ ok: true, w: 'won' });
  return Response.json({ ok: true, ...(mine && mine.o !== c.o ? { w: 'down' } : {}) });
}

/** SD-SOLO: the realm's door for the Worker's walk - `{ s, o }` asked: whether its Hour has room for a newcomer (fewer
 *  than SD_PUB_SEATS in, its fight standing) and whether the account whose digest is `o` is in it already.
 *  @param {any} room the realm @param {Request} request */
export async function sdSeatsInternal(room, request) {
  let b = null;
  try {
    b = await request.json();
  } catch {
    b = null;
  }
  if (!b || !Number.isSafeInteger(b.s) || b.s <= 0 || typeof b.o !== 'string' || !/^[0-9a-f]{16}$/.test(b.o))
    return Response.json({ ok: false }, { status: 400 });
  const realm = await room._sdRealmOf(b.s),
    f = await room._sdFightOf();
  const owners = await Promise.all(realm.in.map((x) => instanceOwnerOf(x)));
  return Response.json({ ok: true, has: owners.includes(b.o), open: realm.in.length < SD_PUB_SEATS && !f?.fell });
}
/** The Worker's path for the walk: `/sd/open?s=<slot>&o=<my digest>`. */
export const SD_OPEN_PATH = '/sd/open';
export const SD_INTERNAL_SEATS = '/internal/sd/seats';

/** SD-SOLO: THE WORKER'S WALK of a Hollow's shared Hours - the first that holds me, else the first open, as `{ n }`
 *  (`n` null: none answered, or all SD_PUB_MAX full). They open in order, so the one I am in comes first.
 *  @param {any} env @param {URL} url */
export async function sdOpenDoor(env, url) {
  const s = Number(url.searchParams.get('s')),
    o = String(url.searchParams.get('o') ?? '');
  const head = { 'content-type': 'application/json', 'access-control-allow-origin': '*' };
  if (!sdRoomKey(s, o) || isSdPubOwner(o) || !env?.ROOMS?.idFromName)
    return new Response(JSON.stringify({ n: null }), { status: 400, headers: head });
  for (let n = 0; n < SD_PUB_MAX; n++) {
    const key = /** @type {string} */ (sdRoomKey(s, /** @type {string} */ (sdPubOwner(n))));
    let r = null;
    try {
      const res = await env.ROOMS.get(env.ROOMS.idFromName(key)).fetch(
        new Request(`https://relay.internal${SD_INTERNAL_SEATS}`, {
          method: 'POST',
          body: JSON.stringify({ s, o }),
          signal: AbortSignal.timeout(ROOM_CALL_MS),
        }),
      );
      r = res?.ok ? await res.json() : null;
    } catch (e) {
      console.warn('[sd] seats', e?.message ?? e);
    }
    if (!r) break;
    if (r.has || r.open) return new Response(JSON.stringify({ n }), { headers: head });
  }
  return new Response(JSON.stringify({ n: null }), { headers: head });
}
