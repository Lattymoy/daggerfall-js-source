// @ts-check
// STAFF-EVENT (2026-10-24, mob; net/staffEvent/staffEventLaw.js, bible/11-Multiplayer/Staff-Events.md): A STAFF EVENT ON
// THIS MACHINE. The hub's book of the events live, each held as a RAID of its own (systems/raidingParties.js runs it - one
// player in the place stands its monsters, the rest stand them as puppets, by RAID2's own law), and each event's ledger
// as its place's cell last said it: whether its mini boss is due, stood, fell, and the kills so far. The kills are read
// only to stop standing monsters at the event's total - the meter is staff's (they read it on the Staff Panel); a player
// is never shown it.
//
// Nothing here is saved: an event is the hub's, said again at every hello.
import { validStaffEvent, staffEventKey, staffEventIdOf, isAreaEvent, STAFF_EVENTS_MAX } from '../net/staffEvent/staffEventLaw.js';

/**
 * A staff event held as a raid: the fields systems/raidingParties.js reads off a raid, and the event's own.
 * @typedef {{ staff: import('../net/staffEvent/staffEventLaw.js').StaffEvent, key: string, regionIndex: number,
 *   locationIndex: number, locationName: string, px: number, py: number, startMinute: number, endMinute: number,
 *   attackAmount: number, type: number, killed: number, struck: boolean, announced: boolean, cleansed: boolean,
 *   routed: boolean, bossFc: number, bossUp: 0|1, bossDown: 0|1, bossSaid: number, mine: number, fillS?: number, bossLostAt?: number, handSeen: number, clearSince?: number, clearWait?: Set<any> }} StaffRaid
 *   `fillS` STAFF-EVENT PACKS' pace: the seconds its packs take to stand the cap, rolled once (raidingParties.js).
 *   `mine` THE REWARD's: its monsters that fell after a blow of mine, mine to stand or a puppet of another's.
 *   `bossFc` the boss call (the ledger's `fc`) whose boss I stood, -1 none; `bossSaid` the call whose boss was announced;
 *   `bossLostAt` BOSS-LOST's: when its stood boss was first seen standing nowhere; `handSeen` BOSS-CLEAR's: the book's
 *   hand calls (`fb`) as of the last boss I stood - one past it is staff's Spawn mini boss now, stood at once; `clearSince`
 *   when its boss first waited for the field clear (raidingParties.js STAFF_BOSS_CLEAR_MAX_MS).
 */

/** @type {Map<string, StaffRaid>} */
let _raids = new Map();
/** @type {Map<string, { n: number, bd: 0|1, bu: 0|1, bk: 0|1, fc: number }>} */
let _ledgers = new Map();
/** The events heard ended, so a late book does not stand one again. @type {Set<string>} */
let _ended = new Set();
const ENDED_KEPT = 32;

/** @param {import('../net/staffEvent/staffEventLaw.js').StaffEvent} e @returns {StaffRaid} */
const raidOf = (e) => ({
  staff: e, key: staffEventKey(e.id), regionIndex: e.rg, locationIndex: e.loc, locationName: e.nm, px: e.px, py: e.py,
  startMinute: -Infinity, endMinute: Infinity, attackAmount: e.n, type: 9, killed: 0, struck: false, announced: false,
  cleansed: false, routed: false, bossFc: -1, bossUp: 0, bossDown: 0, bossSaid: -1, mine: 0, fillS: undefined, handSeen: e.fb,
});

const endOne = (/** @type {string} */ id) => {
  const r = _raids.get(id);
  if (r) r.cleansed = true;
  _ended.add(id);
  while (_ended.size > ENDED_KEPT) _ended.delete(_ended.values().next().value);
};

/**
 * THE HUB'S BOOK (`{k:'ev', l}` - every hello, every change): an event new to it is held, one it still names is kept as it
 * is (its count, its boss) with the book's fields fresh - a boss staff called by hand among them - and one it no longer
 * names is over. Answers how many events are live here.
 * @param {any[]} list validStaffEvent's shape, projected already
 */
export function staffEventBook(list) {
  const seen = new Set();
  for (const raw of Array.isArray(list) ? list.slice(0, STAFF_EVENTS_MAX) : []) {
    const e = validStaffEvent(raw);
    if (!e || _ended.has(e.id)) continue;
    seen.add(e.id);
    const had = _raids.get(e.id);
    if (had) { had.staff = e; had.attackAmount = e.n; } else _raids.set(e.id, raidOf(e));
  }
  for (const id of [..._raids.keys()]) if (!seen.has(id) && !_raids.get(id)?.cleansed) endOne(id);
  return [..._raids.values()].filter((r) => !r.cleansed).length;
}
/** AN END (`{k:'end', id}`), whatever ended it - staff, its boss's fall, its clock, its last monster. */
export const staffEventEnd = (/** @type {string} */ id) => { endOne(id); return true; };
/** A CELL'S LEDGER (`{k:'st'}`) for an event I hold. @param {{ id: string, n: number, bd: 0|1, bu: 0|1, bk: 0|1, fc: number }} st */
export function staffEventLedger(st) {
  if (!_raids.has(st.id)) return false;
  _ledgers.set(st.id, { n: st.n, bd: st.bd, bu: st.bu, bk: st.bk, fc: st.fc });
  return true;
}
/** The cell's last word on an event, or null. @param {string} id */
export const staffLedgerOf = (id) => _ledgers.get(id) ?? null;

/** The events live here, as raids. @returns {StaffRaid[]} */
export const staffRaids = () => [..._raids.values()].filter((r) => !r.cleansed);
/** The events that ended and whose monsters are not yet routed (raidingParties routs each once). */
/**
 * BOSS-BOUND (2026-10-25, mob: "heal was set to 10000 for zombie its wromng", "the event boss had to low of health"): the
 * most health a peer's mini boss of the event `key` may claim - the exact health staff typed (`hp`), or its kind's
 * normal bound (net/foeBounds.js, `normal`) times the event's multiplier (`bh`), whichever is more. FOE-BOUNDS judged it
 * as a plain elite, and every copy but its owner's took a boss past that down as impossible. Null when no live event
 * of my book has that key: the plain bound holds.
 * @param {string} key @param {number} normal @returns {number|null}
 */
export function staffBossBound(key, normal) {
  const r = staffRaids().find((x) => x.key === key);
  if (!r) return null;
  return Math.max(r.staff.hp ?? 0, Math.round(normal * Math.min(100, Math.max(1, r.staff.bh ?? 10))));
}
export const staffRaidsEnded = () => [..._raids.values()].filter((r) => r.cleansed && !r.routed);
/** A key's raid, or null. @param {string} key */
export const staffRaidOfKey = (key) => { const id = staffEventIdOf(key); return id ? _raids.get(id) ?? null : null; };

/**
 * THE EVENT I STAND IN, or null: a town's while I stand in its town (the host's `townHere` - outdoors, in the rect, the
 * raid's own test); an area's while I stand outdoors on its pixel.
 * @param {{regionIndex: number, locationIndex: number}|null} town @param {{x: number, y: number}|null} px @param {boolean} outdoors
 */
export function staffRaidHere(town, px, outdoors) {
  for (const r of _raids.values()) {
    if (r.cleansed) continue;
    if (isAreaEvent(r.staff) ? outdoors && !!px && px.x === r.px && px.y === r.py : !!town && town.regionIndex === r.regionIndex && town.locationIndex === r.locationIndex) return r;
  }
  return null;
}

/** A monster for the event: one of its kinds, evenly. @param {StaffRaid} r @param {() => number} random */
export const staffRaider = (r, random) => r.staff.mt[Math.min(r.staff.mt.length - 1, Math.floor(random() * r.staff.mt.length))];
/** Is there room for one more of the event's monsters - fewer than `cap` standing of mine, and the event's kills and my
 *  standing ones short of its total? @param {StaffRaid} r @param {number} standing @param {number} cap */
export function staffRaidRoom(r, standing, cap) {
  if (standing >= cap) return false;
  const n = Math.max(_ledgers.get(r.staff.id)?.n ?? 0, r.killed);
  return n + standing < r.staff.n;
}
/** The boss call I should answer now - its ledger's `fc` - or -1: the cell called a boss nobody stood, and I have not
 *  stood one for this call. @param {StaffRaid} r */
export function staffBossWanted(r) {
  const led = _ledgers.get(r.staff.id);
  if (!led || !led.bd || led.bu || led.bk) return -1;
  return r.bossFc === led.fc ? -1 : led.fc;
}
/** @param {StaffRaid} r */
export const staffBossByHand = (r) => (r.staff.fb ?? 0) > (r.handSeen ?? 0);
/**
 * BOSS-LOST (mob 2026-10-25: "boss seems to not spawn every time"): the call whose boss stood but stands nowhere now -
 * not fallen, not mine, no puppet of it - for STAFF_BOSS_LOST_MS, or -1. A jump's sweep, a removal or a runner gone took
 * it, and the cell, told it stood, would never call it again: the one who runs the event stands it again, for the same
 * call. The wait lets a fallen runner's boss come over to me (raidingParties.js tookStaffBoss) first.
 * @param {StaffRaid} r @param {boolean} standing @param {number} nowMs
 */
export function staffBossLost(r, standing, nowMs) {
  const led = _ledgers.get(r.staff.id);
  if (!led || !led.bd || !led.bu || led.bk || standing || (r.bossDown && r.bossFc === led.fc)) { r.bossLostAt = undefined; return -1; }
  r.bossLostAt ??= nowMs;
  if (nowMs - r.bossLostAt < STAFF_BOSS_LOST_MS) return -1;
  r.bossLostAt = undefined;
  return led.fc;
}
export const STAFF_BOSS_LOST_MS = 8000;
/** The boss line, once a call, where the player stands in the event: the call whose boss is due, or -1. @param {StaffRaid} r */
export function staffBossToSay(r) {
  const led = _ledgers.get(r.staff.id);
  if (!led || !led.bd || !led.bu || r.bossSaid === led.fc) return -1;   // BOSS-CLEAR: said once it stands, not at its call
  r.bossSaid = led.fc;
  return led.fc;
}

/** Test seam. */
export function _resetStaffEvents() { _raids = new Map(); _ledgers = new Map(); _ended = new Set(); }
