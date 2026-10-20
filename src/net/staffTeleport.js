// @ts-check
// STAFF-TP: an on-demand destination, never a traveller/map marker. The hub
// authenticates staff and routes one target's fresh answer only to its asker.
import { privateInteriorOf } from './privateInterior.js';
import { boatUid, readSailingCabin } from './boatIdentity.js';
import { instanceOfWord } from './instanceRoom.js';   // INSTANCES (the audit): a place's instance, where the player stands in one
export const STAFF_TP_RELAY_MIN = 159;   // world156 now belongs to upstream's arena; unpublished local candidates through 158 are superseded by the combined law.
export const STAFF_TP_TIMEOUT_MS = 8000;
export const STAFF_TP_ERRORS = Object.freeze(['offline', 'ambiguous', 'busy', 'private', 'battle', 'unavailable', 'denied']);
export const staffTeleportSupported = (v) => Number(/^world(\d+)$/.exec(String(v ?? ''))?.[1]) >= STAFF_TP_RELAY_MIN;
const token = (v) => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(v);
const finite = (v) => Number.isFinite(v) && Math.abs(v) <= 1e9;
const integer = (v, max = 0xffffffff) => Number.isSafeInteger(v) && v >= 0 && v <= max;
const point = (v, length = 3) => Array.isArray(v) && v.length === length && v.every(finite);
const pixel = (v) => v && integer(v.x, 999) && integer(v.y, 499);
const label = (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 64 && !/[\x00-\x1f\x7f]/.test(v);
/** INSTANCES (the audit): the instance a building or a dungeon destination stands in (net/instanceRoom.js instanceWord's
 *  `<owner>.<epoch>`) - staff land in the player's own room, which admits staff, never its public twin; absent, public. */
const insOf = (d) => (d.ins != null && instanceOfWord(d.ins) ? { ins: d.ins } : {});

// Keep the relay independent of the game world's layout loader. Missing stamps
// are legacy classic towns; reject unknown or duplicate vendors rather than
// silently dropping a stamp and entering a different building.
function staffLayout(value) {
  if (value == null || value === 'classic') return 'classic';
  if (typeof value !== 'string' || value.length > 128) return null;
  const parts = value.split('+');
  if (parts.length > 2 || parts.some((part) => !/^beautiful-(?:cities|villages)@[0-9]+\.[0-9]+\.[0-9]+$/.test(part))) return null;
  if (new Set(parts.map((part) => part.split('@')[0])).size !== parts.length) return null;
  return parts.sort().join('+');
}

/** Finite, bounded, lossless coordinates. No rounding, floor ray or player data. */
export function validStaffDestination(d) {
  if (!d || !pixel(d.pixel) || !point(d.pos) || !finite(d.yaw) || !finite(d.pitch)) return null;
  const out = { kind: d.kind, pixel: { x: d.pixel.x, y: d.pixel.y }, pos: [...d.pos], yaw: d.yaw, pitch: d.pitch };
  if (d.kind === 'exterior') {
    if (d.boat != null) {
      if (!token(d.boat.owner) || !integer(d.boat.slot, 255) || !point(d.boat.local)) return null;
      if (d.boat.uid != null && !boatUid(d.boat.uid)) return null;
      return { ...out, boat: { owner: d.boat.owner, slot: d.boat.slot, ...(d.boat.uid != null ? { uid: d.boat.uid } : {}), local: [...d.boat.local] } };
    }
    return out;
  }
  if (d.kind === 'interior') {
    if (d.sailingCabin != null) {
      const cabin = readSailingCabin(d.sailingCabin), room = privateInteriorOf(d.privateRoom);
      if (!cabin || room?.boatUid !== cabin.uid || !token(d.cabinOwner)) return null;
      return { ...out, sailingCabin: cabin, privateRoom: d.privateRoom, cabinOwner: d.cabinOwner };
    }
    const layout = staffLayout(d.layout);
    if (layout === null) return null;
    const b = d.door;
    if (!b || !integer(b.blockIndex, 65535) || !integer(b.recordIndex, 65535) || !integer(b.doorIndex, 65535) || !integer(b.buildingKey)) return null;
    const room = d.privateRoom == null ? null : privateInteriorOf(d.privateRoom);
    if (d.privateRoom != null && (!room || room.buildingKey !== b.buildingKey)) return null;
    if (d.ins != null && (room || !instanceOfWord(d.ins))) return null;   // INSTANCES: a private room is no instance's
    return { ...out, ...(d.layout != null ? { layout } : {}), door: { blockIndex: b.blockIndex, recordIndex: b.recordIndex, doorIndex: b.doorIndex, buildingKey: b.buildingKey }, ...(room ? { privateRoom: d.privateRoom } : {}), ...insOf(d) };
  }
  if (d.kind === 'dungeon') {
    if (!integer(d.mapId)) return null;
    if (d.locationKey != null && !/^dungeon:(0|[1-9]\d{0,9})$/.test(d.locationKey)) return null;
    if (d.ins != null && !instanceOfWord(d.ins)) return null;
    // INSTANCES: `whole` - the dungeon as Daggerfall lays it (an instance's, or a whole public room's), which staff build to
    // stand where the player does; absent, the world's own size for it
    return { ...out, mapId: d.mapId, ...(d.locationKey != null ? { locationKey: d.locationKey } : {}), ...insOf(d), ...(d.whole === true || d.ins != null ? { whole: true } : {}) };
  }
  if (d.kind === 'gate') {
    const g = d.gate;
    if (!g || !integer(g.day) || !integer(g.px, 999) || !integer(g.py, 499) || !point(g.spot, 2) || (g.near != null && g.near !== '' && !label(g.near))) return null;
    return { ...out, gate: { day: g.day, px: g.px, py: g.py, spot: [...g.spot], near: g.near ?? '' } };
  }
  if (d.kind === 'abyss') {
    const a = d.abyss;
    if (!a || !integer(a.PitMapX, 999) || !integer(a.PitMapY, 499)
      || !integer(a.TemplateMapX, 999) || !integer(a.TemplateMapY, 499)
      || !integer(a.TemplateRegionIndex, 61) || !integer(a.TemplateLocationIndex, 65535)
      || !finite(a.ReturnWorldX) || !finite(a.ReturnWorldZ) || !finite(a.ReturnPitDepth)
      || a.ReturnPitDepth < 0 || !label(a.DungeonName)) return null;
    return { ...out, abyss: {
      Active: true, PitMapX: a.PitMapX, PitMapY: a.PitMapY,
      TemplateMapX: a.TemplateMapX, TemplateMapY: a.TemplateMapY,
      TemplateRegionIndex: a.TemplateRegionIndex, TemplateLocationIndex: a.TemplateLocationIndex,
      ReturnWorldX: a.ReturnWorldX, ReturnWorldZ: a.ReturnWorldZ,
      HasReturnPitDepth: a.HasReturnPitDepth === true, ReturnPitDepth: a.ReturnPitDepth,
      DungeonName: a.DungeonName, RecallBinding: null,
    } };
  }
  return null;
}

/** Client -> hub. Replies cannot choose a recipient: only a hub ticket. */
export function validStaffTeleportIn(m) {
  if (m?.k === 'ask' && token(m.nonce)) {
    if (token(m.id) && m.name == null) return { k: 'ask', nonce: m.nonce, id: m.id };
    if (label(m.name) && m.id == null) return { k: 'ask', nonce: m.nonce, name: m.name.trim() };
  }
  if (m?.k === 'answer' && token(m.ticket)) {
    if (STAFF_TP_ERRORS.includes(m.error)) return { k: 'answer', ticket: m.ticket, error: m.error };
    const dest = validStaffDestination(m.dest);
    if (dest) return { k: 'answer', ticket: m.ticket, dest };
  }
  return null;
}

/** Hub -> client. Unsolicited results never move a player. */
export function validStaffTeleportOut(m) {
  if (m?.k === 'capture' && token(m.ticket)) return { k: 'capture', ticket: m.ticket };
  if (m?.k !== 'result' || !token(m.nonce)) return null;
  if (STAFF_TP_ERRORS.includes(m.error)) return { k: 'result', nonce: m.nonce, error: m.error };
  const dest = validStaffDestination(m.dest);
  return dest && token(m.id) && label(m.name) ? { k: 'result', nonce: m.nonce, id: m.id, name: m.name, dest } : null;
}

export function staffDestinationKey(d) {
  // A map pixel is part of an interior's identity; door keys repeat in towns.
  const site = `${d.kind}:${d.pixel.x},${d.pixel.y}`;
  if (d.kind === 'interior') return `${site}:${JSON.stringify(d.sailingCabin ? [d.sailingCabin.uid, d.sailingCabin.hull, d.sailingCabin.origin, d.cabinOwner] : [d.door, staffLayout(d.layout)])}:${d.privateRoom ?? ''}:${d.ins ?? ''}`;   // INSTANCES: and its instance - the same door, another room
  if (d.kind === 'dungeon') return `${site}:${d.mapId}:${d.locationKey ?? ''}:${d.ins ?? ''}:${d.whole ? 'w' : ''}`;
  if (d.kind === 'gate') return `gate:${d.gate.day}`;
  if (d.kind === 'abyss') return `${site}:${d.abyss.PitMapX},${d.abyss.PitMapY}:${d.abyss.TemplateRegionIndex},${d.abyss.TemplateLocationIndex}`;
  return site;
}

/** Load a destination, then re-sample THAT player, including when they cross a
 * door during the load. `place` must not await between its final sample and spawn. */
export async function followStaffPlayer(name, { ask, prepare, place, allowed = () => true }) {
  let answer = await ask({ name });
  const id = answer.id;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!allowed()) throw new Error('Teleport cancelled: your player is no longer ready.');
    await prepare(answer.dest);
    const fresh = await ask({ id });
    if (!allowed()) throw new Error('Teleport cancelled: your player is no longer ready.');
    if (fresh.id !== id) throw new Error('The target player changed.');
    if (staffDestinationKey(answer.dest) === staffDestinationKey(fresh.dest)) {
      await place(fresh.dest);
      return fresh;
    }
    answer = fresh;
  }
  throw new Error('The player kept changing locations. Try /tp again.');
}

export const STAFF_TP_ERROR_TEXT = Object.freeze({
  offline: 'That player is not online.', ambiguous: 'More than one player matches. Use their full name.',
  busy: 'A player is changing locations or the server is busy. Try again.',
  private: 'That private room is not ready. Both players and the server need the latest update.',
  battle: 'That player is in a battle instance. Use its authorized entry.',
  unavailable: 'The target location is unavailable or their client needs updating.',
  denied: 'The server did not authorize this staff teleport.',
});

/** The request lifetime belongs to the hub connection, not the chat tab. */
export function createStaffTeleportClient({ send, capture, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let pending = null, serial = 0;
  function cancel() {
    if (!pending) return;
    const p = pending; pending = null; clearTimer(p.timer);
    p.reject(new Error('Teleport cancelled: the connection changed.'));
  }
  return {
    cancel,
    ask(target) {
      if (pending) return Promise.reject(new Error('A player lookup is already in progress.'));
      const nonce = `tp-${++serial}`;
      return new Promise((resolve, reject) => {
        const timer = setTimer(() => { if (pending?.nonce === nonce) { pending = null; reject(new Error('The player did not answer. They may be offline or need a client update.')); } }, STAFF_TP_TIMEOUT_MS);
        pending = { nonce, resolve, reject, timer };
        if (!send({ k: 'ask', nonce, ...target })) {
          pending = null; clearTimer(timer); reject(new Error('Exact player teleport requires an updated, connected server.'));
        }
      });
    },
    receive(raw) {
      const m = validStaffTeleportOut(raw);
      if (!m) return;
      if (m.k === 'capture') {
        let result;
        try { result = capture(); } catch { result = { error: 'unavailable' }; }
        send({ k: 'answer', ticket: m.ticket, ...result });
      } else if (pending?.nonce === m.nonce) {
        const p = pending; pending = null; clearTimer(p.timer);
        if ('error' in m) p.reject(new Error(STAFF_TP_ERROR_TEXT[m.error])); else p.resolve(m);
      }
    },
  };
}
