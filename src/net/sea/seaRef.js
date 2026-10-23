// @ts-check
// ═════════════════════════════════════════════════════════════════════
// SHIP-PVP (2026-10-22, the owner: "Build ever single bit of this and dont return until its perfected" - broadsides
// between captains in the open sea, a ship wrecked and boarded, her hold a prize; bible/03-World/Eltheric-Ocean.md
// SHIP-PVP): THE OPEN SEA'S GUNS REFEREED - the relay's half, beside the zone's own referee (net/wild/wildRef.js), on the
// same room state (`st` - its fighters: who stands in the zone, where, and what kin).
//
//   - A SHIP is a captain's at her helm in the open zone, said by her captain (`helm`: her hull, her toughness, her uid,
//     her hull as her own game reckons it) every SEA_REF.helmMs or so. Her BAR is the referee's: her hull's base strength
//     (SEA_SHIP_HP, the player's own build's - systems/naval/navalShips.js HULL_BUILDS) times her toughness (her Hull
//     refit and the Captain's Due, never past SEA_REF.toughMax). Her own reckoning only ever LOWERS it (a ship of the sea's
//     guns broke her): the referee's bar is the lower of the two. Unstruck by a captain SEA_REF.mendMs, she is whole again
//     at her next word (to that word). AUDIT SEA VENTURES F1/A1: a captain who leaves her helm, the zone or the room (her
//     word, her socket) leaves her ship OFF the guns with her bar kept until it would be whole, and one who crosses into
//     another cell's room carries it there (`seaCarry`, kept at the hub with the zone's own carry) - a word off and on, a
//     dropped socket or a cell's line was a whole ship. AUDIT SEA VENTURES E6A: a shot asks the SHOOTER'S helm word be
//     fresh, never her target's - a captain whose page is paused (a window, a hidden tab) is at sea all the same.
//   - A SHOT is a captain's balls on another's ship (`shot`: the hull and canvas her own game reckoned they struck): landed
//     only where both captains stand in the zone at their helms, neither down, never kin (wildKin's: a party, its truce,
//     a duel's two, a guild), within SEA_REF.reachM of each other (both their BELIEVED places - a jumper fires at nothing),
//     at most SEA_REF.hz words a second, and on the shooter's own purse: SHIP_REF of her hull a second (the serpent's
//     reference broadside - net/serpent/serpentBrain.js), SEA_REF.rateX of it refilling, SEA_REF.depthX of it deep, no one
//     word past SEA_REF.capX of it. Her canvas's harm is bounded a word (SEA_REF.sailCapX), and a fire set once in
//     SEA_REF.fireMs. The victim's own game lays what landed on her - in SHARES of her bar and her canvas, so her own
//     builds and the referee's agree.
//   - A WRECK is the referee's word: her bar at none by a captain's shot, or by her own reckoning within SEA_REF.creditMs
//     of a captain's shot (the last captain whose shot took any of her bar is her killer - AUDIT SEA VENTURES E6B: canvas
//     or a fire alone never claims a ship the sea broke). Her bar at none by her own reckoning alone (the sea's guns), she
//     is out of the fight both ways until it mends - no captain's shot lands on her, and none of hers on another. She stays wrecked SEA_REF.wreckMs. Her killer then
//     has SEA_REF.boardMs to come within SEA_REF.boardM of her - her captain's believed place, or where she lay wrecked: a
//     captain who leaves, or jumps away, leaves her wreck to be boarded - and board her (`board`; never in a jump - AUDIT
//     SEA VENTURES A6), her hold's share the prize; and the relay signs the wreck (net/wild/wildReceipt.js `n1`), boarded or not.
//
// Pure: no clock (every `now` an argument), no socket, no storage - the relay's room keeps it in its memory (a room that
// restarts mid-fight forgets its ships; a wreck awaiting its boarding is kept in its storage, as a fall is).
// ═════════════════════════════════════════════════════════════════════
import { SHIP_REF, clampHull } from '../serpent/serpentBrain.js';
import { WILD_REF } from '../wild/wildRef.js';
import { SIEGE_UNITS_PER_M } from '../siege/siegeRef.js';

/** THE BASE STRENGTH OF A PLAYER'S HULL, by hull (navalShips.js HULL_BUILDS' hullHp - the rowboat, the Large Boat, the
 *  Small Ship, the galley, the carrack - pinned equal), and of her canvas (their sailHp). */
export const SEA_SHIP_HP = Object.freeze([96, 240, 672, 832, 896]);
export const SEA_SAIL_HP = Object.freeze([0, 96, 256, 144, 352]);

/** The referee's own numbers: a ship's toughness at most (a Hull refit's whole, 1.75, over the Captain's Due's most, a
 *  quarter less taken); how long a ship unstruck by a captain takes to be whole; how long a captain's shot is her
 *  killer's when her own reckoning breaks her; how long a wreck stays one; how long her killer has to board her, and how
 *  near (metres); a gun's reach and the poses' slack; the purse (a word a second at most, the reference's refill, depth
 *  and one word's cap, the canvas's cap); a fire once so often; how long a helm's word stands; the most ships and wrecks
 *  a room keeps. */
export const SEA_REF = Object.freeze({
  toughMax: 2.4, mendMs: 120_000, creditMs: 30_000, wreckMs: 600_000, boardMs: 180_000, boardM: 40,
  reachM: 300, slackM: 30, hz: 10, rateX: 1.5, depthX: 20, capX: 14, sailCapX: 4, fireMs: 10_000, helmMs: 20_000,
  shipsMax: 200, wrecksMax: 64,
});
/** A wreck awaiting its boarding is kept in the room's storage under this prefix (a restarted room signs it all the same). */
export const SEA_WRECK_PREFIX = 'seawreck:';

/** The ships and the wrecks, kept on the zone referee's room state. */
const shipsOf = (/** @type {any} */ st) => (st.ships ??= new Map());
const wrecksOf = (/** @type {any} */ st) => (st.wrecks ??= new Map());
/** Two believed places apart, metres (the zone's poses are the world frame's units - siegeRef.js SIEGE_UNITS_PER_M). */
const apartM = (/** @type {any} */ a, /** @type {any} */ b) => Math.hypot((a.x - b.x) / SIEGE_UNITS_PER_M, (a.z - b.z) / SIEGE_UNITS_PER_M);
/** A ship's toughness as said, kept within the law. */
export const seaTough = (/** @type {unknown} */ t) => (Number.isFinite(t) ? Math.max(1, Math.min(SEA_REF.toughMax, /** @type {number} */ (t))) : 1);
/** A captain's said hull - a share of her own whole, 0 to 1. */
const share = (/** @type {unknown} */ h) => (Number.isFinite(h) ? Math.max(0, Math.min(1, /** @type {number} */ (h))) : 1);
/** AUDIT SEA VENTURES F1/A1: a ship whose captain has left her helm, the zone or the room - forgotten if her bar would be
 *  whole at her next word anyway, else kept OFF the guns with it (no shot lands on her, nor hers on another). A wreck stays
 *  one. */
function offShip(/** @type {Map<string, any>} */ ships, /** @type {string} */ sub, /** @type {any} */ s, /** @type {number} */ now) {
  if (!s || s.wrecked) return;
  if (now - s.struckAt >= SEA_REF.mendMs) ships.delete(sub);
  else s.off = true;
}

/**
 * A CAPTAIN'S WORD AT HER HELM (`helm`): `hl` her hull (-1: she has left her helm), `t` her toughness, `u` her uid, `h` her
 * hull as her own game reckons it (a share of her whole). Kept only for a fighter standing in the zone. A new hull or uid
 * is a new ship at the share the last one stood at (a captain changing ships mid-fight changes nothing). Answers `{ wreck,
 * evicted }` - a WRECK her own word made (her reckoning at none within SEA_REF.creditMs of a captain's shot - that captain
 * her killer), and a full room's oldest wreck put out for it (to be signed unboarded) - or null.
 * @param {any} st @param {string} sub
 * @param {{ id: string, ci?: string, hl: number, t?: number, u?: number, h?: number }} o
 * @param {number} now @param {{ rid?: string, room?: string }} [w] the id a wreck would take, and the room
 */
export function seaHelm(st, sub, { id, ci = '', hl, t = 1, u = 0, h = 1 }, now, { rid = '', room = '' } = {}) {
  const ships = shipsOf(st), x = st.fighters?.get(sub);
  let s = ships.get(sub);
  if (clampHull(hl) < 0 || !x?.zone) { offShip(ships, sub, s, now); return null; }
  if (s?.wrecked) {
    if (now - s.wreckAt < SEA_REF.wreckMs) { s.at = now; return null; }   // a wreck stays one her while
    ships.delete(sub); s = undefined;
  }
  const uid = Number.isSafeInteger(u) && u > 0 ? u : 0;
  const max = SEA_SHIP_HP[hl] * seaTough(t), sailMax = SEA_SAIL_HP[hl] * seaTough(t);
  if (!s) {
    if (ships.size >= SEA_REF.shipsMax) for (const [k, v] of ships) if (!v.wrecked && (v.off || now - v.at >= SEA_REF.helmMs)) { ships.delete(k); break; }
    if (ships.size >= SEA_REF.shipsMax) return null;
    s = { id, ci, hl, u: uid, max, sailMax, hp: max, at: now, struckAt: -Infinity, by: null, byAt: -Infinity, fireAt: -Infinity, wrecked: false, wreckAt: -Infinity, off: false, bucket: 0, bucketAt: now, rate: SEA_REF.hz, rateAt: now };
    ships.set(sub, s);
  } else if (s.hl !== hl || s.u !== uid || s.max !== max) {
    const was = s.max > 0 ? s.hp / s.max : 1;
    s.hl = hl; s.u = uid; s.max = max; s.sailMax = sailMax; s.hp = max * was;
  }
  s.id = id; if (ci) s.ci = ci; s.at = now; s.off = false;
  const c = x.seaCarry;   // F1/A1: the bar she carries from another room's guns (the hub's, seaCarry) - newer than this room's
  if (c) { x.seaCarry = null; if (now - c.at < SEA_REF.mendMs && c.at > s.struckAt) { s.hp = s.max * c.h; s.struckAt = c.at; } }
  if (now - s.struckAt >= SEA_REF.mendMs) s.hp = s.max;   // unstruck so long: whole again, to her own word
  s.hp = Math.min(s.hp, share(h) * s.max);
  if (s.hp > 1e-6) return null;
  s.hp = 0;
  if (!s.by || now - s.byAt > SEA_REF.creditMs) return null;   // the sea's guns broke her, no captain's
  const [wreck, evicted] = wreckOf(st, sub, s, s.by, now, rid, room);
  return { wreck, evicted };
}

/** A ship wrecked: the referee's record of it - `{ r, fallen, fallenId, ci, killer, killerId, kc, u, m, x, z, at, boarded }`,
 *  `x`/`z` where she lay (her captain's believed place, or null) - and the room's oldest wreck, put out to make room (or
 *  null). */
function wreckOf(/** @type {any} */ st, /** @type {string} */ sub, /** @type {any} */ s, /** @type {string} */ by, /** @type {number} */ now, /** @type {string} */ rid, /** @type {string} */ room) {
  s.wrecked = true; s.wreckAt = now; s.hp = 0;
  const k = st.fighters?.get(by), wrecks = wrecksOf(st), lay = st.fighters?.get(sub)?.pose;
  const w = { r: rid, fallen: sub, fallenId: s.id, ci: s.ci, killer: by, killerId: k?.id ?? '', kc: k?.ci ?? '', u: s.u, m: typeof room === 'string' ? room : '', x: lay ? lay.x : null, z: lay ? lay.z : null, at: now, boarded: false };
  let evicted = null;
  if (wrecks.size >= SEA_REF.wrecksMax) { evicted = wrecks.values().next().value; wrecks.delete(evicted.r); }
  wrecks.set(rid, w);
  return [w, evicted];
}

/** The purse's word rate: one token a word. */
function spendWord(/** @type {any} */ s, /** @type {number} */ now) {
  s.rate = Math.min(SEA_REF.hz, s.rate + (Math.max(0, now - s.rateAt) / 1000) * SEA_REF.hz);
  s.rateAt = now;
  if (!(s.rate >= 1)) return false;
  s.rate -= 1;
  return true;
}

/**
 * A CAPTAIN'S SHOT ON ANOTHER'S SHIP (`shot`): `d` the hull her own game reckoned her balls struck, `s` the canvas, `f`
 * a fire set; `kin` the caller's wildKin over the two. Judged as the head says. Answers `{ ok, dealt, frac, sail, fire,
 * left, wreck, evicted, why }` - `frac` and `sail` the shares of her bar and her canvas that landed, `left` her bar's share
 * left, `wreck` the referee's record when this shot wrecked her (and `evicted` a full room's oldest, to be signed).
 * @param {any} st @param {string} by @param {string} to
 * @param {{ d?: number, s?: number, f?: boolean, kin?: boolean, rid?: string, room?: string }} o @param {number} now
 */
export function seaShot(st, by, to, { d = 0, s: sail = 0, f = false, kin = false, rid = '', room = '' } = {}, now) {
  const no = (/** @type {string} */ why) => ({ ok: false, dealt: 0, frac: 0, sail: 0, fire: false, left: 1, wreck: null, evicted: null, why });
  const a = st.fighters?.get(by), x = st.fighters?.get(to);
  if (!a || !x || by === to) return no('no-fighter');
  if (!a.zone || !x.zone) return no('zone');
  if (a.down || x.down) return no('down');
  if (kin) return no('kin');
  const ships = shipsOf(st), me = ships.get(by), her = ships.get(to);
  // F1/A1: neither off the guns; E6B: neither at none by the sea's guns (out of the fight both ways until she mends)
  if (!me || !her || me.wrecked || her.wrecked || me.off || her.off || !(me.hp > 1e-6) || !(her.hp > 1e-6)) return no('ship');
  if (now - me.at > SEA_REF.helmMs) return no('helm');   // E6A: the shooter's word alone - her target's page may be paused
  if (now - a.jumpAt < WILD_REF.jumpMs) return no('jump');   // a jumper fires at nothing, as it strikes nothing
  if (!a.pose || !x.pose || apartM(a.pose, x.pose) > SEA_REF.reachM + SEA_REF.slackM) return no('reach');
  const ref = SHIP_REF[clampHull(me.hl)] ?? 0;
  if (!(ref > 0)) return no('guns');
  if (!spendWord(me, now)) return no('rate');
  const bucket = Math.min(SEA_REF.depthX * ref, me.bucket + (Math.max(0, now - me.bucketAt) / 1000) * SEA_REF.rateX * ref);
  const got = Math.max(0, Math.min(Number.isFinite(d) ? d : 0, SEA_REF.capX * ref, bucket, her.hp));
  me.bucket = bucket - got; me.bucketAt = now;
  const canvas = her.sailMax > 0 ? Math.max(0, Math.min(Number.isFinite(sail) ? sail : 0, SEA_REF.sailCapX * ref)) / her.sailMax : 0;
  const fire = !!f && now - her.fireAt >= SEA_REF.fireMs;
  if (fire) her.fireAt = now;
  if (!(got > 0) && !(canvas > 0) && !fire) return { ok: true, dealt: 0, frac: 0, sail: 0, fire: false, left: her.max > 0 ? her.hp / her.max : 0, wreck: null, evicted: null, why: null };
  her.struckAt = now;
  if (got > 0) { her.hp -= got; her.by = by; her.byAt = now; }   // E6B: her killer is a captain whose shot took her bar
  const frac = her.max > 0 ? got / her.max : 0;
  const [wreck, evicted] = her.hp <= 1e-6 ? wreckOf(st, to, her, by, now, rid, room) : [null, null];   // a shot lands only on a bar above none: one that took none wrecks nothing
  return { ok: true, dealt: got, frac, sail: Math.min(1, canvas), fire, left: her.max > 0 ? Math.max(0, her.hp) / her.max : 0, wreck, evicted, why: null };
}

/**
 * THE KILLER BOARDS HER (`board`): its own wreck `r`, within SEA_REF.boardMs of it, its believed place within SEA_REF.boardM
 * of her - her captain's believed place (kept when she goes from the room), or where she lay wrecked (a room that
 * restarted forgot her captain; one who jumped away left her). Her captain need not be here: her wreck is. Answers the
 * wreck - boarded, off the referee's list, to be signed - or null.
 * @param {any} st @param {string} by @param {string} r @param {number} now
 */
export function seaBoard(st, by, r, now) {
  const wrecks = wrecksOf(st), w = wrecks.get(r);
  if (!w || w.killer !== by || w.boarded || now - w.at > SEA_REF.boardMs) return null;
  const a = st.fighters?.get(by), her = st.fighters?.get(w.fallen)?.pose;
  const near = (/** @type {any} */ p) => !!p && apartM(a.pose, p) <= SEA_REF.boardM + SEA_REF.slackM;
  if (!a?.pose || now - a.jumpAt < WILD_REF.jumpMs) return null;   // AUDIT SEA VENTURES A6: a jumper boards nothing, as it fires at nothing
  if (!(near(her) || near(Number.isFinite(w.x) && Number.isFinite(w.z) ? { x: w.x, z: w.z } : null))) return null;
  w.boarded = true;
  wrecks.delete(r);
  return w;
}

/** The referee's beat: every wreck its killer did not board in time, off the list to be signed unboarded; a ship whose
 *  captain has left the zone (her zone's word, her socket) off the guns (offShip), and one off the guns forgotten when
 *  her bar would be whole; wrecks of ships past SEA_REF.wreckMs forgotten. AUDIT SEA VENTURES E6A: a ship whose captain
 *  stands in the zone saying nothing (a hidden tab) is at sea all the same - never forgotten for her quiet. */
export function seaStep(/** @type {any} */ st, /** @type {number} */ now) {
  const out = [], ships = shipsOf(st);
  for (const [r, w] of wrecksOf(st)) if (now - w.at > SEA_REF.boardMs) { wrecksOf(st).delete(r); out.push(w); }
  for (const [k, s] of ships) {
    if (s.wrecked) { if (now - s.wreckAt >= SEA_REF.wreckMs) ships.delete(k); continue; }
    if (s.off || !st.fighters?.get(k)?.zone) offShip(ships, k, s, now);
  }
  return out;
}

/** AUDIT SEA VENTURES F1/A1: WHAT A SHIP CARRIES out of this room (the hub keeps it with the zone's own carry - wildRef.js
 *  wildCarry - for the next room she sails into): her bar's share and when a captain last struck her - or null, never
 *  struck (whole wherever she goes). */
export function seaCarry(/** @type {any} */ st, /** @type {string} */ sub) {
  const s = shipsOf(st).get(sub);
  if (!s || !Number.isFinite(s.struckAt)) return null;
  return { h: s.max > 0 ? Math.max(0, Math.min(1, s.hp / s.max)) : 0, at: s.struckAt };
}

/** A wreck read back from storage, checked for the shape wreckOf writes - or null. */
export function seaWreckOf(/** @type {any} */ v) {
  if (!v || typeof v !== 'object' || typeof v.r !== 'string' || typeof v.fallen !== 'string' || typeof v.killer !== 'string' || !Number.isFinite(v.at)) return null;
  return { r: v.r, fallen: v.fallen, fallenId: typeof v.fallenId === 'string' ? v.fallenId : '', ci: typeof v.ci === 'string' ? v.ci : '', killer: v.killer, killerId: typeof v.killerId === 'string' ? v.killerId : '', kc: typeof v.kc === 'string' ? v.kc : '', u: Number.isSafeInteger(v.u) ? v.u : 0, m: typeof v.m === 'string' ? v.m : '', x: Number.isFinite(v.x) ? v.x : null, z: Number.isFinite(v.z) ? v.z : null, at: v.at, boarded: v.boarded === true };
}

/** A captain's socket gone from the room: her ship off the guns (offShip - AUDIT SEA VENTURES F1/A1: her bar kept until it
 *  would be whole), unless she is a wreck (a wreck stays one). */
export function seaGone(/** @type {any} */ st, /** @type {string} */ sub, /** @type {number} */ now) {
  offShip(shipsOf(st), sub, shipsOf(st).get(sub), now);
}
