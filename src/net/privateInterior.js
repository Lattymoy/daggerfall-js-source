// @ts-check
// Owner/character-specific presence rooms. They deliberately are NOT world
// rooms: personal containers, loot, scene caches and deeds never enter the relay.
const PREFIX = /^owned:([a-f0-9]{32})\.([a-f0-9]{16})$/;
const ROOM = /^owned:([a-f0-9]{32})\.([a-f0-9]{16}):(0|[1-9]\d{0,9})\.(0|[1-9]\d{0,9})$/;
const BOAT_ROOM = /^owned:([a-f0-9]{32})\.([a-f0-9]{16}):boat\.([1-9]\d{0,15})$/;
const identity = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{4,64}$/.test(v);
// WAGONS2-VISIT (2026-10-09, Mac: "People should be able to use the interior just like houses, like crafting and such";
// who comes in, "Like an online home"): A CARAVAN'S OWN ROOM - `caravan:<k>`, `k` its owner's park key (net/wire.js
// parkKeyOf: the account the token verified and the character, hashed - PARK_KEY_RE's 24 hex, pinned equal by
// test/wagons2_visit.test.js), the key the cell's record of the parked caravan already carries. Its owner stands in it
// inside their caravan and a visitor joins it by the record, so both stand in one room, in MapsFile's frame (the room
// stands at the caravan's pose in the world). A presence room like the rest of this family, with one thing kept: what
// its owner placed in it (the relay's `caravan` frame, net/wire.js validCaravanData), from its owner alone.
const CARAVAN_ROOM = /^caravan:([0-9a-f]{24})$/;
/** The room of the caravan whose owner's park key is `k`, or null. */
export const caravanRoomOf = (k) => (typeof k === 'string' && /^[0-9a-f]{24}$/.test(k) ? `caravan:${k}` : null);
/** The owner's park key a caravan's room names, or null for any other room. */
export function caravanKeyOf(key) {
  const m = typeof key === 'string' && CARAVAN_ROOM.exec(key);
  return m ? m[1] : null;
}
const digest = async (s, bytes) => [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))).slice(0, bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function privateInteriorPrefix(account, character) {
  if (!identity(account) || !identity(character)) return null;
  const owner = await digest(`private-interior:account:${account}`, 16);
  const slot = await digest(`private-interior:character:${character}`, 8);
  return `owned:${owner}.${slot}`;
}

export function privateInteriorRoom(prefix, mapId, buildingKey) {
  if (!PREFIX.test(prefix ?? '') || !Number.isInteger(mapId) || !Number.isInteger(buildingKey) || !buildingKey) return null;
  return `${prefix}:${mapId >>> 0}.${buildingKey >>> 0}`;
}

export function privateBoatRoom(prefix, uid) {
  return PREFIX.test(prefix ?? '') && Number.isSafeInteger(uid) && uid > 0 ? `${prefix}:boat.${uid}` : null;
}

export function privateInteriorOf(key) {
  const cv = caravanKeyOf(key);
  if (cv) return { caravan: cv };   // WAGONS2-VISIT: a caravan's room is one of the family - its poses MapsFile's (world.js nativeFrame, online.js nativePoseRoom)
  const b = typeof key === 'string' && BOAT_ROOM.exec(key);
  if (b && Number.isSafeInteger(+b[3])) return { owner: b[1], character: b[2], boatUid: +b[3] };
  const m = typeof key === 'string' && ROOM.exec(key);
  if (!m || +m[3] > 0xffffffff || +m[4] > 0xffffffff || !+m[4]) return null;
  return { owner: m[1], character: m[2], mapId: +m[3], buildingKey: +m[4] };
}

export function privateInteriorMatches(key, mapId, buildingKey) {
  const r = privateInteriorOf(key);
  return !!r && Number.isInteger(mapId) && Number.isInteger(buildingKey) && r.mapId === (mapId >>> 0) && r.buildingKey === (buildingKey >>> 0);
}

/** `subject` and `staff` must come from the relay's verified token, never hello fields. */
export async function privateInteriorAdmits(key, subject, staff) {
  const r = privateInteriorOf(key);
  if (!r || !identity(subject)) return false;
  return staff || r.owner === await digest(`private-interior:account:${subject}`, 16);
}
