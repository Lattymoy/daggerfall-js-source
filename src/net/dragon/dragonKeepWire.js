// @ts-check
// DRAGON5b (bible/11-Multiplayer/Dwarven-Dragon.md section 10): A TAMED DRAGON LEFT IN THE WORLD, ON THE WIRE - its owner's
// word on their own foes frame (`dk`), as HCC-ONLINE's horse rides `hv` (systems/horse/horseCartWire.js): where it
// waits (the wire's world frame), the way it faces, its flight in or out by kind and age, its look and its name. The
// relay reads none of it; a reader takes it through validDragonKeepRecord or drops it whole. The name passes the label
// door (wire.js sanitizeLabel) at both ends. Not a DFU member. Ledger A (DRAGON).
import { POSE_BOUND, POSE_Y_BOUND, sanitizeLabel } from '../wire.js';
import { DRAGON_NAME_MAX, DRAGON_COME_MS, DRAGON_LEAVE_MS } from '../../systems/dragon/dragonKeep.js';

/** A flight's kind on the wire: 1 in, 2 out. */
const FLIGHT_CODE = Object.freeze({ in: 1, out: 2 });
const FLIGHT_KIND = Object.freeze({ 1: 'in', 2: 'out' });
const r2 = (v) => Math.round(v * 100) / 100;
const r4 = (v) => Math.round(v * 10000) / 10000;

/** The name as the wire carries it: '' where nothing printable is left or the filter refuses it. */
export const dragonNameOnWire = (name) => (typeof name === 'string' ? sanitizeLabel(name, DRAGON_NAME_MAX) : '');

/**
 * My word: `shown` `{ spot: [x, y, z] (scene), yaw, kind ('in'|'out'|null), age (ms), look, name }`, or null when none
 * stands - `toWire` turns a scene point to the wire's frame. Answers `{ p, yw, fl?, lk?, n? }` or null.
 */
export function dragonKeepWireRecord(shown, toWire = (p) => p) {
  if (
    !shown ||
    !Array.isArray(shown.spot) ||
    shown.spot.length !== 3 ||
    !shown.spot.every(Number.isFinite) ||
    !Number.isFinite(shown.yaw)
  )
    return null;
  const p = toWire(shown.spot);
  const out = { p: [r2(p[0]), r2(p[1]), r2(p[2])], yw: r4(shown.yaw) };
  const code = FLIGHT_CODE[shown.kind];
  if (code) out.fl = [code, Math.max(0, Math.round(shown.age))];
  if (shown.look === 1) out.lk = 1;
  const n = dragonNameOnWire(shown.name);
  if (n) out.n = n;
  return out;
}

/** A peer's word through the door: `{ spot, yaw, kind, age, look, name }`, or null - the whole record dropped. */
export function validDragonKeepRecord(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const p = raw.p;
  if (!Array.isArray(p) || p.length !== 3 || !p.every(Number.isFinite)) return null;
  if (Math.abs(p[0]) > POSE_BOUND || Math.abs(p[2]) > POSE_BOUND || Math.abs(p[1]) > POSE_Y_BOUND) return null;
  if (!Number.isFinite(raw.yw) || Math.abs(raw.yw) > 8) return null;
  let kind = null,
    age = 0;
  if (raw.fl !== undefined) {
    const fl = raw.fl;
    if (!Array.isArray(fl) || fl.length !== 2 || !FLIGHT_KIND[fl[0]] || !Number.isInteger(fl[1]) || fl[1] < 0)
      return null;
    kind = FLIGHT_KIND[fl[0]];
    age = Math.min(fl[1], kind === 'in' ? DRAGON_COME_MS : DRAGON_LEAVE_MS);
  }
  if (raw.n !== undefined && (typeof raw.n !== 'string' || raw.n.length > DRAGON_NAME_MAX * 4)) return null;
  return {
    spot: [p[0], p[1], p[2]],
    yaw: raw.yw,
    kind,
    age,
    look: raw.lk === 1 ? 1 : 0,
    name: dragonNameOnWire(raw.n ?? ''),
  };
}

/** A change key: a frame carries the record only when the word moved (a flight's age aside - every screen runs it). */
export const dragonKeepRecordKey = (rec) =>
  rec ? JSON.stringify([rec.p, rec.yw, rec.fl?.[0] ?? 0, rec.lk ?? 0, rec.n ?? '']) : '';
