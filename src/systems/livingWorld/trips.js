// @ts-check
// LW3 (2026-10-04, bible/06-Systems/Living-World.md): THE ROADS - where a town's travellers go, when, by which way, and
// where on it they are at any minute of the sky's clock. Pure, like the rest of the living world (LW0 decision 2): the
// towns near (the MAPS rows the host hands, the game's own rows alone so every client reads the same), the way (the
// Travel Options planner's on Hazelnut's roads - `systems/travelRoute.js planRoute` - asked through the host, cached
// there), a seed and the clock in; a party's place out.
//
// A TRAVELLER'S CYCLES. Each traveller (census.js travellerRoster: merchants, adventurers, pilgrims, couriers, the
// small places' pedlars - every town has one, a city six) lives in
// cycles of days (`CYCLE_DAYS`, at the calendar's walking pace; longer at a slower clock's, `paceScale`), offset by
// their own seed. In each cycle they go or stay (`TRIP_CHANCE`); going, they pick a town of the right kind within their
// range (`TRIP_RANGE_PX`: a merchant a town to trade in, the bigger the likelier; a pilgrim a temple's town; a courier
// anywhere), set out at an hour of a morning, walk the way BY DAY (WALK_FROM_H to WALK_TO_H) and camp where night
// finds them, stay a day or two (`STAY_DAYS`), and walk home. A trip that would not fit its cycle at their pace takes
// the next nearer town, or none.
//
// CARAVANS. A merchant takes the town's sellswords under contract to them for the road (up to HIRE_MAX; the town's
// sellswords dealt to its merchants in slot order), and a pilgrim, a courier or a pedlar setting out the same day for the
// same town joins the first such merchant's train - one party, one pace, one timeline. Each a law of the trips alone
// (formCaravans), so a train is the same whichever minute of it is read.
//
// WHAT THE TOWNS SEE. A traveller's home sees an AWAY WINDOW (dayPlan.js schedule: gear, the walk out to the exit
// facing the road, the walk home); the town they go to sees a VISITOR (lodging at a tavern, in by the exit facing the
// road they came, out by it again).
//
// UNITS. Positions in the world's native units (32768 a map pixel, 40 a metre - the bands' and the Overworld's own);
// the route a polyline through its pixels' centres, which is the road itself (Basic Roads paints each road bit from a
// pixel's centre to its edge or corner, travelRoute.js / roadClearance.js), trimmed at each end by the town's own
// half-width so a party walks out of the town's edge, not its middle.
import { lwSeed, lwRng, rollInt, pickWeighted } from './seed.js';
import { seededRng } from '../wind.js';
import { DAY_MIN, DAY_START_MIN } from './dayPlan.js';
import { WORLD_MAP_TERRAIN_DIM as NATIVE_PIXEL } from '../../formats/mapsFile.js';
import { NATIVE_PER_M } from '../travelDungeons.js';

// the native units' one homes: a map pixel the MAPS format's own (mapsFile.js), a metre the travel view's (travelDungeons.js)
export { NATIVE_PIXEL, NATIVE_PER_M };
/** The native units of one RMB block (4096 classic units, 102.4 m). */
export const NATIVE_BLOCK = 4096;
/** The daylight a party walks in (hours of the day). */
export const WALK_FROM_H = 7;
export const WALK_TO_H = 19;
/** Each job's pace on the road, times the street's (a merchant's train at a cart's pace, a courier at a jog). */
export const TRIP_PACE = Object.freeze({ merchant: 0.85, mercenary: 0.85, adventurer: 1.05, courier: 1.3, pilgrim: 0.9, sailor: 1, pedlar: 0.95 });
/** Each job's cycle (days, at the calendar's walking pace). */
export const CYCLE_DAYS = Object.freeze({ merchant: 7, adventurer: 7, pilgrim: 20, courier: 5, pedlar: 6 });
/** The chance a traveller goes in a cycle. */
export const TRIP_CHANCE = Object.freeze({ merchant: 0.9, adventurer: 0.7, pilgrim: 0.5, courier: 0.9, pedlar: 0.85 });
/** The map pixels a job's destination lies within (nearest, farthest). */
export const TRIP_RANGE_PX = Object.freeze({ merchant: [3, 14], adventurer: [3, 12], pilgrim: [3, 18], courier: [4, 18], pedlar: [2, 6] });
/** The days a job stays where it went. */
export const STAY_DAYS = Object.freeze({ merchant: [1, 2], adventurer: [1, 1], pilgrim: [1, 2], courier: [0, 1], pedlar: [0, 1] });
/** The most sellswords a merchant hires for the road. */
export const HIRE_MAX = 3;
/** The farthest a traveller's home can be from a town and still be read for visitors or the roads (map pixels). */
export const TRIP_REACH_PX = 18;
/** LW6: the share of an adventurer's trips that are DIVES - into a dungeon in reach, when one is - and the reach
 *  (map pixels, nearest and farthest), and the hours inside (the clock's minutes, fewest and most). */
export const DIVE_CHANCE = 0.55;
export const DIVE_RANGE_PX = Object.freeze([1, 8]);
export const DIVE_MIN = Object.freeze([240, 600]);
/** LW5b: THE PASSAGE BY SEA - the share of a port town's travellers' trips that sail to a port a lane of the Bay runs
 *  to from theirs (by job: a sailor crews, a sellsword rides with their merchant), how much faster a ship goes than a
 *  walker (by night as by day), and the hours of the morning tide a ship sails on. */
export const SEA_CHANCE = Object.freeze({ merchant: 0.4, pilgrim: 0.3, courier: 0.35, pedlar: 0.2, adventurer: 0.15 });
export const SEA_PACE_X = 3;
export const SEA_TIDE_H = Object.freeze([6, 9]);
/** The calendar's walking pace (metres a clock minute): DFU's 1.3 m/s over CLASSIC_MINUTES_PER_SECOND. */
export const CALENDAR_MPM = 1.3 / 0.2;

/**
 * @typedef {import('./census.js').Resident} Resident
 * @typedef {import('./census.js').LwTown} LwTown
 * @typedef {{ pixels: { x: number, y: number }[], kinds?: string[] }} RoutePlan - travelRoute.js planRoute's answer
 * @typedef {{ pts: number[][], cum: number[], len: number, kinds: string[] }} Way - a route as a walked line (native)
 * @typedef {{
 *   townsNear: (px: number, py: number, rMax: number) => LwTown[],
 *   routeOf: (a: LwTown, b: LwTown) => (RoutePlan | null | undefined),
 *   rosterOf: (town: LwTown) => Resident[],
 *   templeTown?: (town: LwTown) => boolean,
 *   holderOf?: (res: Resident, k: number) => (Resident | null),
 *   dungeonsNear?: (px: number, py: number, rMax: number) => LwTown[],
 *   fated?: (res: Resident, k: number) => boolean,
 *   fate?: (trip: Trip) => Trip,
 *   lanesFrom?: (town: LwTown) => ({ to: LwTown, len: number, key: string }[] | undefined),
 * }} TripWorld - the host's: towns near a pixel (the game's own rows, populated); the planner's way between two towns
 *   (undefined while it is being asked, null for none); a town's travellers (census.js travellerRoster). LW4: who holds
 *   a traveller's place in a cycle (lives.js - null while it stands empty; unasked, the census's own), whether its
 *   holder dies that cycle (and so sets out whatever the chance said - a fated death is on the road), and the trouble
 *   a trip meets (trouble.js - the trip as it left it). LW6: the dungeons near a pixel (`dungeon: true` rows - an
 *   adventurer's dives). LW5b: the Bay's lanes from a port town (naval/seaLanes.js: the far port, the lane's length in
 *   metres; none for a town with no harbour; undefined while the map is unread)
 * @typedef {{ id: string, k?: number, kind: string, leader: Resident, party: Resident[], from: LwTown, to: LwTown, way: Way,
 *   pace: number, outT0: number, outT1: number, backT0: number, backT1: number, trim0: number, trim1: number,
 *   enc?: any, halt?: { t0: number, t1: number, fightEnd: number, s: number, leg: 'out'|'back' },
 *   fallen?: { res: Resident, t: number, s: number, inside?: boolean, hand?: boolean, atSea?: boolean }[], turned?: boolean, dive?: { t0: number, t1: number },
 *   sea?: { key: string, len: number } }} Trip - LW5b: `sea` a passage by sea, its lane and length (no road under it). LW6: `dive` an
 *   adventurer's hours in the dungeon it went to (its `to` a dungeon). LW4: `k` its cycle; the trouble's
 *   `enc`, its `halt`, the `fallen` and whether it `turned` home (trouble.js troubledTrip). LW7: a fallen by a `hand`
 *   (handsOn - struck down by the player, or at their side) gone from that minute, no remains or news of the road's
 */

/** How much slower a clock's walking pace is than the calendar's (online's sky walks half as far a minute). @param {number} mpm */
export const paceScale = (mpm) => Math.max(1, CALENDAR_MPM / Math.max(0.1, mpm));

/** The minutes of daylight walking between two minutes of the clock. @param {number} a @param {number} b */
export function walkedMinutes(a, b) {
  if (!(b > a)) return 0;
  const from = WALK_FROM_H * 60, to = WALK_TO_H * 60;
  let total = 0;
  let day = Math.floor(a / DAY_MIN);
  for (; day * DAY_MIN < b; day++) {
    const lo = Math.max(a, day * DAY_MIN + from), hi = Math.min(b, day * DAY_MIN + to);
    if (hi > lo) total += hi - lo;
  }
  return total;
}

/** The minute of the clock at which `minutes` of daylight walking from `a` are done. @param {number} a @param {number} minutes */
export function whenWalked(a, minutes) {
  let left = Math.max(0, minutes);
  const from = WALK_FROM_H * 60, to = WALK_TO_H * 60;
  let day = Math.floor(a / DAY_MIN);
  let t = a;
  for (let guard = 0; guard < 4000; guard++, day++) {
    const lo = Math.max(t, day * DAY_MIN + from), hi = day * DAY_MIN + to;
    if (hi > lo) {
      if (hi - lo >= left) return lo + left;
      left -= hi - lo;
    }
    t = (day + 1) * DAY_MIN;
  }
  return t;
}

/** A planner's route as a walked line through its pixels' centres (native units). @param {RoutePlan} plan @returns {Way} */
export function wayOf(plan) {
  const pts = (plan?.pixels ?? []).map((p) => [p.x * NATIVE_PIXEL + NATIVE_PIXEL / 2, (499 - p.y) * NATIVE_PIXEL + NATIVE_PIXEL / 2]);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, len: cum[cum.length - 1] ?? 0, kinds: [...(plan?.kinds ?? [])] };
}

/** The point `s` native units along a way, and the way it faces (a world yaw: 0 +z, +PI/2 +x). @param {Way} way @param {number} s */
export function wayAt(way, s) {
  const { pts, cum } = way;
  if (!pts.length) return { x: 0, z: 0, yaw: 0 };
  if (pts.length === 1) return { x: pts[0][0], z: pts[0][1], yaw: 0 };
  const d = Math.max(0, Math.min(way.len, s));
  let i = 1;
  while (i < pts.length - 1 && cum[i] < d) i++;
  const a = pts[i - 1], b = pts[i];
  const seg = cum[i] - cum[i - 1];
  const k = seg > 0 ? (d - cum[i - 1]) / seg : 0;
  return { x: a[0] + (b[0] - a[0]) * k, z: a[1] + (b[1] - a[1]) * k, yaw: Math.atan2(b[0] - a[0], b[1] - a[1]) };
}

/** A town's half-width on the ground (native), for the trim at each end of a way: its blocks' side, halved, and a margin. @param {LwTown} town */
export const townTrim = (town) => (Math.ceil(Math.sqrt(Math.max(1, town.blocks | 0))) * NATIVE_BLOCK) / 2 + NATIVE_BLOCK / 2;

/** A traveller's cycle holding `day`: its number, its first day and its length (days). @param {Resident} res @param {number} day @param {number} scale */
export function cycleOf(res, day, scale) {
  const len = Math.max(2, Math.round((CYCLE_DAYS[/** @type {keyof typeof CYCLE_DAYS} */ (res.job)] ?? 8) * scale));
  const phase = lwSeed(res.town, res.slot, 0x6379) % len;   // 'cy'
  const k = Math.floor((day + phase) / len);
  return { k, start: k * len - phase, len };
}

/**
 * The trip a traveller makes in cycle `k` (only the traveller's own choice - no caravan yet), null for none, undefined
 * while a way it needs is still being asked.
 * @param {Resident} res @param {LwTown} home @param {number} k @param {TripWorld} world @param {{ mpm: number }} o
 * @returns {Trip|null|undefined}
 */
export function ownTrip(res, home, k, world, { mpm }) {
  const chance = TRIP_CHANCE[/** @type {keyof typeof TRIP_CHANCE} */ (res.job)];
  if (!(chance > 0)) return null;
  const scale = paceScale(mpm);
  const len = Math.max(2, Math.round((CYCLE_DAYS[/** @type {keyof typeof CYCLE_DAYS} */ (res.job)] ?? 8) * scale));
  const phase = lwSeed(res.town, res.slot, 0x6379) % len;
  const start = k * len - phase;
  const rng = lwRng(res.town, res.slot, k, 0x74726970);   // 'trip'
  if (rng() >= chance && !world.fated?.(res, k)) return null;   // LW4: a death the lives hold for this cycle is met on the road (AUDIT-B1: the dice's - a spare never takes the trip away)
  const pace = (TRIP_PACE[/** @type {keyof typeof TRIP_PACE} */ (res.job)] ?? 1) * mpm * NATIVE_PER_M;   // native a clock minute
  // LW6: an adventurer's cycle a DIVE now and then - its own dice, so a cycle that is none is the trip it always was
  if (res.job === 'adventurer' && world.dungeonsNear) {
    const drng = lwRng(res.town, res.slot, k, 0x64697665);   // 'dive'
    if (drng() < DIVE_CHANCE) {
      const dive = diveTrip(res, home, k, world, { start, len, pace, rng: drng });
      if (dive !== null) return dive;   // undefined (a way asked) or the dive; none that fits, the town trip
    }
  }
  // LW5b: a port town's traveller's cycle a PASSAGE BY SEA now and then - its own dice, so a cycle that is none is the
  // trip it always was
  const seaShare = SEA_CHANCE[/** @type {keyof typeof SEA_CHANCE} */ (res.job)] ?? 0;
  if (home.port && world.lanesFrom && seaShare > 0) {
    const srng = lwRng(res.town, res.slot, k, 0x736561);   // 'sea'
    if (srng() < seaShare) {
      const sea = seaTrip(res, home, k, world, { start, len, mpm, pace, rng: srng });
      if (sea !== null) return sea;   // undefined (the map unread) or the passage; none that fits, the road's trip
    }
  }
  const [rMin, rMax] = TRIP_RANGE_PX[/** @type {keyof typeof TRIP_RANGE_PX} */ (res.job)] ?? [3, 12];
  const near = world.townsNear(home.px ?? 0, home.py ?? 0, rMax)
    .filter((t) => t.mapId !== home.mapId && Math.max(Math.abs((t.px ?? 0) - (home.px ?? 0)), Math.abs((t.py ?? 0) - (home.py ?? 0))) >= rMin);
  if (!near.length) return null;
  /** @type {Record<string, number>} */
  const weights = {};
  for (const t of near) {
    const d = Math.hypot((t.px ?? 0) - (home.px ?? 0), (t.py ?? 0) - (home.py ?? 0));
    const size = Math.pow(Math.max(1, t.blocks | 0), 0.7);
    let w = res.job === 'merchant' ? size / (1 + d / 8) : res.job === 'pilgrim' ? ((world.templeTown?.(t) ? 6 : 0.2) * size) / (1 + d / 12) : 1 / (1 + d / 10);
    if (res.job === 'adventurer') w = size / (1 + d / 6);
    weights[String(t.mapId)] = w;
  }
  // the pick, then the towns nearer than it, the farthest of them first - the trip most like the one chosen that fits
  const pick = pickWeighted(rng, weights);
  const first = near.find((t) => String(t.mapId) === pick);
  if (!first) return null;
  const dist = (t) => Math.hypot((t.px ?? 0) - (home.px ?? 0), (t.py ?? 0) - (home.py ?? 0));
  const nearer = near.filter((t) => t !== first && dist(t) < dist(first)).sort((a, b) => dist(b) - dist(a) || a.mapId - b.mapId);
  const order = [first, ...nearer];
  const [sLo, sHi] = STAY_DAYS[/** @type {keyof typeof STAY_DAYS} */ (res.job)] ?? [1, 1];
  const stay = rollInt(rng, sLo, sHi);
  const departH = res.job === 'adventurer' ? 6 + rng() * 2 : 7 + rng() * 2;
  const offsetRoll = rng();
  for (const to of order) {
    const plan = world.routeOf(home, to);
    if (plan === undefined) return undefined;
    if (!plan || !(plan.pixels?.length >= 2)) continue;
    const way = wayOf(plan);
    const trim0 = Math.min(townTrim(home), way.len * 0.4), trim1 = Math.min(townTrim(/** @type {LwTown} */ (to)), way.len * 0.4);
    const walk = Math.max(0, way.len - trim0 - trim1) / pace;   // minutes of daylight walking, each way
    const estDays = 2 * Math.ceil(walk / ((WALK_TO_H - WALK_FROM_H) * 60)) + stay + 1;
    if (estDays > len - 1) continue;
    const dayOffset = Math.floor(offsetRoll * (len - estDays));
    const outT0 = (start + dayOffset) * DAY_MIN + Math.floor(departH * 60);
    const outT1 = whenWalked(outT0, walk);
    const arriveDay = Math.floor(outT1 / DAY_MIN);
    // home again: after the days' stay, of a morning; with no stay, a rest of two hours (in by noon) or the next morning
    const morning = (d) => d * DAY_MIN + 7 * 60 + (lwSeed(res.town, res.slot, k, 0x6261) % 120);   // 'ba'
    const backT0 = Math.max(outT1 + 60, stay > 0 ? morning(arriveDay + stay) : (outT1 - arriveDay * DAY_MIN < 12 * 60 ? outT1 + 120 : morning(arriveDay + 1)));
    const backT1 = whenWalked(backT0, walk);
    if (backT1 > (start + len) * DAY_MIN + DAY_START_MIN) continue;
    return { id: `${res.id}:${k}`, k, kind: res.job, leader: res, party: [res], from: home, to: /** @type {LwTown} */ (to), way, pace,
      outT0, outT1, backT0, backT1, trim0, trim1 };
  }
  return null;
}

/** LW5b: the way of a trip with no road under it - a passage by sea. */
const noWay = () => ({ pts: [], cum: [0], len: 0, kinds: [] });

/**
 * LW5b: A PASSAGE BY SEA - a port town's traveller's trip to a port a lane of the Bay runs to from theirs
 * (`world.lanesFrom`: the far port and the lane's length), the bigger and the nearer the likelier (a pilgrim's a temple
 * town's); the pick, then the nearer lanes, the longest of them first. Out from the dock on a morning tide (SEA_TIDE_H),
 * the crossing at SEA_PACE_X a walker's pace by night as by day, the stay, home on a later morning's tide (a ship turns
 * round overnight at the least) - inside the cycle, or none (null); undefined while the map is unread.
 * @param {Resident} res @param {LwTown} home @param {number} k @param {TripWorld} world
 * @param {{ start: number, len: number, mpm: number, pace: number, rng: () => number }} o
 * @returns {Trip|null|undefined}
 */
export function seaTrip(res, home, k, world, { start, len, mpm, pace, rng }) {
  const all = world.lanesFrom?.(home);
  if (all === undefined) return undefined;
  const lanes = all.filter((l) => l.to && l.to.mapId !== home.mapId && l.len > 0);
  if (!lanes.length) return null;
  /** @type {Record<string, number>} */
  const weights = {};
  for (const l of lanes) {
    const size = Math.pow(Math.max(1, l.to.blocks | 0), 0.7);
    const temple = res.job === 'pilgrim' ? (world.templeTown?.(l.to) ? 6 : 0.2) : 1;
    weights[l.key] = (temple * size) / (1 + l.len / 10000);
  }
  const pick = pickWeighted(rng, weights);
  const first = lanes.find((l) => l.key === pick);
  if (!first) return null;
  const order = [first, ...lanes.filter((l) => l !== first && l.len < first.len).sort((a, b) => b.len - a.len || (a.key < b.key ? -1 : 1))];
  const [sLo, sHi] = STAY_DAYS[/** @type {keyof typeof STAY_DAYS} */ (res.job)] ?? [1, 1];
  const stay = rollInt(rng, sLo, sHi);
  const tideMin = Math.floor((SEA_TIDE_H[0] + rng() * (SEA_TIDE_H[1] - SEA_TIDE_H[0])) * 60);
  const offsetRoll = rng();
  const cycleEnd = (start + len) * DAY_MIN + DAY_START_MIN;
  for (const l of order) {
    const cross = Math.ceil(l.len / (Math.max(0.1, mpm) * SEA_PACE_X));   // the clock's minutes, by night as by day
    const span = Math.ceil((2 * cross) / DAY_MIN) + Math.max(1, stay) + 1;
    const outT0 = (start + Math.floor(offsetRoll * Math.max(0, len - span))) * DAY_MIN + tideMin;
    const outT1 = outT0 + cross;
    const backT0 = Math.max(outT1 + 60, (Math.floor(outT1 / DAY_MIN) + Math.max(1, stay)) * DAY_MIN + tideMin);
    const backT1 = backT0 + cross;
    if (backT1 > cycleEnd) continue;
    return { id: `${res.id}:${k}`, k, kind: res.job, leader: res, party: [res], from: home, to: l.to, way: noWay(), pace,
      outT0, outT1, backT0, backT1, trim0: 0, trim1: 0, sea: { key: l.key, len: l.len } };
  }
  return null;
}

/**
 * LW6: A DIVE - an adventurer's trip to a dungeon within DIVE_RANGE_PX (the nearer the likelier; the pick, then the
 * nearer ones, farthest first, as a trip's town), set out of a morning, walked by day, its hours inside (DIVE_MIN) in
 * place of a stay, and home - inside the cycle, or none (null); undefined while a way is asked.
 * @param {Resident} res @param {LwTown} home @param {number} k @param {TripWorld} world
 * @param {{ start: number, len: number, pace: number, rng: () => number }} o
 * @returns {Trip|null|undefined}
 */
export function diveTrip(res, home, k, world, { start, len, pace, rng }) {
  const [rMin, rMax] = DIVE_RANGE_PX;
  const near = (world.dungeonsNear?.(home.px ?? 0, home.py ?? 0, rMax) ?? [])
    .filter((d) => Math.max(Math.abs((d.px ?? 0) - (home.px ?? 0)), Math.abs((d.py ?? 0) - (home.py ?? 0))) >= rMin);
  if (!near.length) return null;
  const dist = (d) => Math.hypot((d.px ?? 0) - (home.px ?? 0), (d.py ?? 0) - (home.py ?? 0));
  /** @type {Record<string, number>} */
  const weights = {};
  for (const d of near) weights[String(d.mapId)] = 1 / (1 + dist(d) / 4);
  const pick = pickWeighted(rng, weights);
  const first = near.find((d) => String(d.mapId) === pick);
  if (!first) return null;
  const order = [first, ...near.filter((d) => d !== first && dist(d) < dist(first)).sort((a, b) => dist(b) - dist(a) || a.mapId - b.mapId)];
  const inside = rollInt(rng, DIVE_MIN[0], DIVE_MIN[1]);
  const departH = 6 + rng() * 2;
  const offsetRoll = rng();
  for (const to of order) {
    const plan = world.routeOf(home, to);
    if (plan === undefined) return undefined;
    if (!plan || !(plan.pixels?.length >= 2)) continue;
    const way = wayOf(plan);
    const trim0 = Math.min(townTrim(home), way.len * 0.4), trim1 = Math.min(townTrim(to), way.len * 0.4);
    const walk = Math.max(0, way.len - trim0 - trim1) / pace;
    const estDays = 2 * Math.ceil(walk / ((WALK_TO_H - WALK_FROM_H) * 60)) + Math.ceil(inside / DAY_MIN) + 1;
    if (estDays > len - 1) continue;
    const dayOffset = Math.floor(offsetRoll * (len - estDays));
    const outT0 = (start + dayOffset) * DAY_MIN + Math.floor(departH * 60);
    const outT1 = whenWalked(outT0, walk);
    const backT0 = outT1 + inside;   // out of the dungeon - by night, the walk home waits for the light (whenWalked)
    const backT1 = whenWalked(backT0, walk);
    if (!(backT1 <= (start + len) * DAY_MIN + DAY_START_MIN)) continue;   // home inside the cycle
    return { id: `${res.id}:${k}`, k, kind: res.job, leader: res, party: [res], from: home, to, way, pace,
      outT0, outT1, backT0, backT1, trim0, trim1, dive: { t0: outT1, t1: backT0 } };
  }
  return null;
}

/**
 * A traveller's own trip of a cycle, kept in the book (`o.memo`) - a trip of a cycle never changes, so it is asked
 * again only while it waits on a way (undefined).
 * @param {Resident} res @param {LwTown} town @param {number} k @param {TripWorld} world @param {{ mpm: number, memo?: Map<string, Trip|null> }} o
 * @returns {Trip|null|undefined}
 */
export function memoTrip(res, town, k, world, o) {
  const key = `${res.id}:${k}`;
  let trip = o.memo?.get(key);
  if (trip === undefined) { trip = ownTrip(res, town, k, world, o); if (trip !== undefined) o.memo?.set(key, trip); }
  return trip;
}

/** The contract's deal: the town's merchants and its sellswords, each in slot order (formCaravans, contractOf). @param {Resident[]} roster */
const dealOf = (roster) => ({
  merchants: roster.filter((r) => r.job === 'merchant').sort((a, b) => a.slot - b.slot),
  sellswords: roster.filter((r) => r.job === 'mercenary').sort((a, b) => a.slot - b.slot),
});

/** LW4: the merchant whose contract a sellsword's place is under (formCaravans' deal), or null. @param {Resident} res @param {Resident[]} roster */
export function contractOf(res, roster) {
  const { merchants, sellswords } = dealOf(roster);
  const i = sellswords.findIndex((r) => r.slot === res.slot);
  return merchants.length && i >= 0 ? merchants[i % merchants.length] : null;
}

/**
 * LW4: the cycle a traveller's PLACE lives by on `day` (lives.js reads its fate by it): its own (cycleOf), a
 * sellsword's its contract merchant's - the trips it rides are that merchant's.
 * @param {Resident} res @param {Resident[]} roster @param {number} day @param {number} scale
 */
export function placeCycle(res, roster, day, scale) {
  const m = res.job === 'mercenary' ? contractOf(res, roster) : null;
  return cycleOf(m ?? res, day, scale).k;
}

/**
 * LW4: does the holder of a place set out at all in its cycle `k` - its own trip, a sellsword its contract merchant's
 * (a fated sellsword goes with it whatever the hire said)? A fated holder who does not dies abroad, unseen. Undefined
 * while a way is asked.
 * @param {Resident} res @param {LwTown} town @param {number} k @param {TripWorld} world @param {{ mpm: number, memo?: Map<string, Trip|null> }} o
 * @returns {boolean|undefined}
 */
export function setsOut(res, town, k, world, o) {
  let who = res;
  if (res.job === 'mercenary') {
    const m = contractOf(res, world.rosterOf(town));
    const held = m && (world.holderOf ? world.holderOf(m, k) : m);
    if (!held) return false;
    who = held;
  }
  const trip = memoTrip(who, town, k, world, o);
  return trip === undefined ? undefined : !!trip;
}

/**
 * THE TOWN'S TRIPS on the road or away at minute `t` - every traveller's own trips of the cycles that can hold it, the
 * caravans made (sellswords hired, pilgrims and couriers joined), each party's trip once (its leader's). Undefined
 * while a way is still being asked.
 * @param {LwTown} town @param {number} t @param {TripWorld} world @param {{ mpm: number, memo?: Map<string, Trip|null> }} o
 * @returns {Trip[]|undefined}
 */
export function townTrips(town, t, world, o) {
  const scale = paceScale(o.mpm);
  const day = Math.floor(t / DAY_MIN);
  const roster = world.rosterOf(town);
  let pending = false;
  /** @param {Resident} res @param {number} k */
  const tripOf = (res, k) => {
    const trip = memoTrip(res, town, k, world, o);
    if (trip === undefined) pending = true;
    return trip ?? null;
  };
  // LW-PERF: THE DAY'S TRIPS KEPT IN THE BOOK - every trip of the cycles that can hold the day (the holders' own), kept
  // once known; a minute's are those of them within a day of it, and its parties (the caravans, their trouble) are kept
  // while the same ones are (the roads, the deep and the towns read every town near once a second - each read the
  // whole roster, its caravans and its fates again). The book is the trips' own, made again with them (a turn, a load)
  const memo = /** @type {Map<string, any> | undefined} */ (o.memo);
  const key = `town:${town.mapId}:${day}`;
  let kept = memo?.get(key);
  if (kept && (kept.world !== world || kept.scale !== scale)) kept = undefined;
  if (!kept) {
    /** @type {Trip[]} */
    const cands = [];
    for (const res of roster) {
      if (!(TRIP_CHANCE[/** @type {keyof typeof TRIP_CHANCE} */ (res.job)] > 0)) continue;
      const cyc = cycleOf(res, day, scale);
      for (const k of [cyc.k - 1, cyc.k]) {
        const holder = world.holderOf ? world.holderOf(res, k) : res;   // LW4: whoever holds the place that cycle - none while it stands empty
        if (!holder) continue;
        const trip = tripOf(holder, k);
        if (trip) cands.push(trip);
      }
    }
    if (pending) return undefined;
    kept = { world, scale, cands, pass: /** @type {number[]|null} */ (null), out: /** @type {Trip[]|null} */ (null) };
    memo?.set(key, kept);
  }
  /** @type {number[]} */
  const pass = [];
  for (let i = 0; i < kept.cands.length; i++) { const trip = kept.cands[i]; if (trip.backT1 > t - DAY_MIN && trip.outT0 < t + DAY_MIN) pass.push(i); }
  const same = (/** @type {number[]} */ a, /** @type {number[]} */ b) => a.length === b.length && a.every((x, i) => x === b[i]);
  if (kept.out && same(kept.pass, pass)) return kept.out;
  const trips = pass.map((i) => kept.cands[i]);
  const made = formCaravans(town, trips, roster, tripOf, scale, world.holderOf, world.fated);
  if (pending) return undefined;
  const out = world.fate ? made.map((tr) => /** @type {Trip} */ (/** @type {any} */ (world.fate)(tr))) : made;   // LW4: each party's trouble
  kept.pass = pass; kept.out = out;
  return out;
}

/** The jobs that ride in a merchant's train when it sets out the day they do, for the town they go to. */
const JOINS = new Set(['pilgrim', 'courier', 'pedlar']);

/**
 * THE CARAVANS - each a law of the trips alone, never of which of them a reader happened to ask about (a train read on
 * the third day of its walk is the train that set out):
 *  - A merchant's SELLSWORDS are the town's own under contract to them: the town's sellswords in slot order, dealt to its
 *    merchants in slot order (the first to the first, round again), and a trip takes its merchant's first `want` of them
 *    (the trip's own roll, 0 to HIRE_MAX). A merchant's trips never overlap (each fits its cycle), so neither do theirs.
 *  - A pilgrim's, courier's or pedlar's trip that sets out the day a merchant's does, for the same town, JOINS that
 *    merchant's train - the first merchant in slot order with such a trip - and walks its timeline, its pace.
 * `tripOf(res, k)` the town's traveller's own trip of a cycle (townTrips' book); pure over it. LW4: the contract and
 * the joiners are the PLACES' (the census roster's slots); `holderOf(res, k)` who holds each that cycle (a place
 * standing empty hires nobody and joins nobody).
 * @param {LwTown} town @param {Trip[]} trips - the window's own trips
 * @param {Resident[]} roster @param {(res: Resident, k: number) => Trip|null} tripOf @param {number} scale
 * @param {(res: Resident, k: number) => (Resident | null)} [holderOf] @param {(res: Resident, k: number) => boolean} [fated]
 * @returns {Trip[]}
 */
export function formCaravans(town, trips, roster, tripOf, scale, holderOf, fated) {
  const { merchants, sellswords } = dealOf(roster);
  const dayOf = (/** @type {Trip} */ tr) => Math.floor(tr.outT0 / DAY_MIN);
  const held = (/** @type {Resident} */ r, /** @type {number} */ k) => (holderOf ? holderOf(r, k) : r);
  /** A place's own trip of the cycle holding day `d`, through whoever holds it then. @param {Resident} r @param {number} d */
  const placeTrip = (r, d) => { const k = cycleOf(r, d, scale).k; const h = held(r, k); return h ? tripOf(h, k) : null; };
  /** The merchant's trip a joiner's rides in, or null. @param {Trip} j */
  const trainOf = (j) => {
    const d = dayOf(j);
    for (const m of merchants) {
      const mt = placeTrip(m, d);
      if (mt && mt.to.mapId === j.to.mapId && dayOf(mt) === d) return mt;
    }
    return null;
  };
  /** @type {Trip[]} */
  const out = [];
  for (const tr of trips) {
    if (tr.kind === 'merchant') {
      const mi = merchants.findIndex((m) => m.slot === tr.leader.slot);
      const want = seededRng(lwSeed(tr.leader.town, tr.leader.slot, tr.outT0 | 0, 0x68697265))() * (HIRE_MAX + 1) | 0;   // 'hire'
      const k = tr.k ?? cycleOf(tr.leader, dayOf(tr), scale).k;
      // the contract's first `want` places, and any place of it whose holder the road takes this cycle (a fated death is met on the road)
      const contract = mi < 0 ? [] : sellswords.filter((_, i) => i % merchants.length === mi);
      const hired = contract.map((sw, i) => { const h = held(sw, k); return h && (i < want || !!fated?.(h, k)) ? h : null; }).filter((h) => !!h);
      const d = dayOf(tr);
      const joined = [];
      for (const r of roster) {
        if (!JOINS.has(r.job)) continue;
        const jt = placeTrip(r, d);
        if (jt && jt.to.mapId === tr.to.mapId && dayOf(jt) === d && trainOf(jt)?.id === tr.id) joined.push(jt.leader);
      }
      out.push({ ...tr, party: [tr.leader, .../** @type {Resident[]} */ (hired), ...joined] });
    } else if (!(JOINS.has(tr.kind) && trainOf(tr))) out.push(tr);
  }
  return out;
}

/** LW4: how long a town talks of a trouble on the road (days from when it was known). */
export const NEWS_DAYS = 3;

/**
 * LW4: WHAT A TOWN KNOWS OF THE ROAD at minute `t` - its own parties' troubles (trouble.js), each known from when the
 * party came home (a party none of whom came home, from when it was due: `trip.backT1`), for NEWS_DAYS - newest
 * first. `who` the one it befell (the first of the fallen, else the leader), `foe` the first of the foes, `place`
 * the town they were bound for, `enc` the encounter's id (LW7: the character's turn of it). A hand's dead are not the
 * road's news (LW7).
 * @param {Trip[]} trips - the town's own, about the minute (and the days before it) @param {number} t
 * @returns {{ id: string, enc: string, kind: string, who: string, foe: number|null, place: string, t: number, dive: boolean, sea: boolean }[]}
 */
export function newsOf(trips, t) {
  const seen = new Set();
  const out = [];
  for (const tr of trips) {
    const enc = tr.enc;
    if (!enc || seen.has(tr.id)) continue;
    seen.add(tr.id);
    const known = tr.backT1;
    if (!(known <= t && t - known < NEWS_DAYS * DAY_MIN)) continue;
    const fell = tr.fallen?.filter((f) => !f.hand) ?? [];
    const who = fell[0]?.res ?? tr.leader;
    out.push({ id: tr.id, enc: enc.id, kind: fell.length ? 'fell' : enc.kind, who: who.name, foe: enc.foes?.[0] ?? null, place: tr.to?.name ?? '', t: known, dive: !!tr.dive, sea: !!tr.sea });
  }
  return out.sort((a, b) => b.t - a.t);
}

/**
 * Where a party is at minute `t`: 'out' or 'back' on the road (walking by day, `camp` by night), 'stay' at the town it
 * went to, 'home' before and after. On the road, `x`/`z` its place (native) and `yaw` the way it walks.
 * LW4: a trip's trouble (trouble.js troubledTrip) HOLDS the party where it fell - `halt` (and `fight` for the fight's
 * own minutes) - and then it walks on, making up the halt at HALT_CATCH_UP again its pace; a party TURNED walks home
 * from where it stood.
 * @param {Trip} trip @param {number} t
 * LW5b: a passage by sea is 'sea' while it sails, out and home (no road under it).
 * @returns {{ phase: 'home'|'out'|'stay'|'back'|'sea', x?: number, z?: number, yaw?: number, camp?: boolean, s?: number, halt?: boolean, fight?: boolean }}
 */
export function partyAt(trip, t) {
  const { way, pace, trim0, trim1 } = trip;
  const walk = Math.max(0, way.len - trim0 - trim1);
  const daylight = (m) => { const h = (((m % DAY_MIN) + DAY_MIN) % DAY_MIN) / 60; return h >= WALK_FROM_H && h < WALK_TO_H; };
  if (t < trip.outT0 || t >= trip.backT1) return { phase: 'home' };
  if (trip.sea) return { phase: t < trip.outT1 || t >= trip.backT0 ? 'sea' : 'stay' };   // LW5b: a passage is the ship's, never the road's
  const h = trip.halt;
  const placed = (/** @type {'out'|'back'} */ phase, /** @type {number} */ s, extra = {}) => {
    const p = wayAt(way, s);
    return { phase, x: p.x, z: p.z, yaw: phase === 'back' ? p.yaw + Math.PI : p.yaw, camp: !daylight(t), s, ...extra };
  };
  if (h && t >= h.t0 && t < h.t1) return placed(h.leg, h.s, { halt: true, fight: t < h.fightEnd });
  if (trip.turned && h && t >= h.t1) return placed('back', Math.max(trim0, h.s - Math.min(h.s - trim0, pace * walkedMinutes(h.t1, t))));
  // the lag a halt left - the ground the day's walk would have covered while the party stood - made up at HALT_CATCH_UP
  // again the pace (a party hurrying on, never a sprint); what is still owed at the leg's end is made up at its town
  const lag = (/** @type {'out'|'back'} */ leg) => {
    if (!h || h.leg !== leg || t < h.t1) return 0;
    return Math.max(0, pace * walkedMinutes(h.t0, h.t1) - HALT_CATCH_UP * pace * walkedMinutes(h.t1, t));
  };
  if (t < trip.outT1) return placed('out', Math.max(trim0, trim0 + Math.min(walk, pace * walkedMinutes(trip.outT0, t)) - lag('out')));
  if (t < trip.backT0) return { phase: 'stay' };
  return placed('back', Math.min(way.len - trim1, way.len - trim1 - Math.min(walk, pace * walkedMinutes(trip.backT0, t)) + lag('back')));
}

/** LW4: how much faster than its pace a party walks to make up a halt (a half again). */
export const HALT_CATCH_UP = 0.5;

/**
 * LW7: A TRIP'S HAND DEATHS - each member a hand took before the trip was done (lives.js handDeath: struck down by the
 * player, or fallen fighting at their side), gone from the party from that minute (`fallen`, `hand`): the trip itself
 * stands as the road made it. `handOf(member)` the minute, or null.
 * @param {Trip} trip @param {(res: Resident) => (number|null)} handOf @returns {Trip}
 */
export function handsOn(trip, handOf) {
  const hands = [];
  for (const m of trip.party) {
    const t = handOf(m);
    if (t != null && t < trip.backT1) hands.push({ res: m, t, s: 0, hand: true });   // a death after the trip is the town's
  }
  return hands.length ? { ...trip, fallen: [...(trip.fallen ?? []), ...hands] } : trip;
}

/** LW4: the party at minute `t` - its members less the fallen by then. @param {Trip} trip @param {number} t */
export const membersAt = (trip, t) => (trip.fallen?.length ? trip.party.filter((m) => !trip.fallen?.some((f) => f.res.id === m.id && f.t <= t)) : trip.party);

/** The way a trip leaves its home toward (a world yaw, off its way's first leg past the town's trim). @param {Trip} trip */
export const leavingYaw = (trip) => wayAt(trip.way, trip.trim0 + 1).yaw;
/** The way a trip comes into the town it goes to from (a world yaw out of that town toward the road). @param {Trip} trip */
export const arrivingYaw = (trip) => wayAt(trip.way, trip.way.len - trip.trim1 - 1).yaw + Math.PI;

/**
 * A home town's away windows for a resident on `day` - each trip of theirs (their own, or a caravan they ride with)
 * touching the living day: out at its first minute, home at its last; armed where they carry a class.
 * @param {Resident} res @param {Trip[]} trips - townTrips' answer for the day
 * LW5b: a passage by sea's window is the dock's (`dock`).
 * @returns {{ t0: number, t1: number, yaw: number, armed: boolean, dock: boolean }[]}
 */
export function awayOf(res, trips) {
  const out = [];
  for (const tr of trips) {
    if (!tr.party.some((p) => p.id === res.id)) continue;
    const fell = tr.fallen?.some((f) => f.res.id === res.id);   // LW4: one the road took never walks home
    out.push({ t0: tr.outT0, t1: fell ? Infinity : tr.backT1, yaw: leavingYaw(tr), armed: res.cls != null, dock: !!tr.sea });   // LW5b: a passage leaves by the dock
  }
  return out.sort((a, b) => a.t0 - b.t0);
}

/**
 * The visitors a town has on `day`: the parties of the towns within TRIP_REACH_PX staying in it that day - each member
 * with the minute they come in (at the exit facing the road they came), the minute they leave by it, and its way.
 * Undefined while a way is still being asked.
 * @param {LwTown} town @param {number} day @param {TripWorld} world @param {{ mpm: number, memo?: Map<string, Trip|null> }} o
 * LW5b: and a port's visitors off the ships from the ports its lanes run to (in and out by the dock, `dock`).
 * @returns {{ res: Resident, trip: Trip, inT: number, outT: number, yaw: number, dock: boolean }[] | undefined}
 */
export function visitorsOf(town, day, world, o) {
  const D0 = day * DAY_MIN + DAY_START_MIN, D1 = D0 + DAY_MIN;
  const out = [];
  let pending = false;
  const homes = [...world.townsNear(town.px ?? 0, town.py ?? 0, TRIP_REACH_PX)];
  const lanes = town.port ? world.lanesFrom?.(town) : [];
  if (lanes === undefined) pending = true;
  for (const l of lanes ?? []) if (l.to && !homes.some((h) => h.mapId === l.to.mapId)) homes.push(l.to);   // LW5b: a port's own across the water, however far
  for (const from of homes) {
    if (from.mapId === town.mapId) continue;
    const trips = townTrips(from, D0 + DAY_MIN / 2, world, o);
    if (trips === undefined) { pending = true; continue; }
    for (const tr of trips) {
      if (tr.to.mapId !== town.mapId || tr.turned || !(tr.outT1 < D1 && tr.backT0 > D0)) continue;   // LW4: a party turned home never comes
      for (const res of membersAt(tr, tr.outT1)) out.push({ res, trip: tr, inT: tr.outT1, outT: tr.backT0, yaw: arrivingYaw(tr), dock: !!tr.sea });   // LW5b: off a ship, by the dock
    }
  }
  return pending ? undefined : out;
}

/**
 * The parties on the road within `rPx` map pixels of a pixel at minute `t` - every town within reach of it (a trip
 * runs at most TRIP_REACH_PX from its home), each party's place. `pending` while a way is still being asked (the
 * parties whose ways are known are answered meanwhile).
 * @param {number} px @param {number} py @param {number} t @param {TripWorld} world @param {{ mpm: number, memo?: Map<string, Trip|null> }} o
 * @param {number} [rPx]
 * @returns {{ parties: { trip: Trip, at: ReturnType<typeof partyAt> }[], pending: boolean }}
 */
export function partiesNear(px, py, t, world, o, rPx = 6) {
  const parties = [];
  let pending = false;
  for (const town of world.townsNear(px, py, rPx + TRIP_REACH_PX)) {
    const got = partiesOfTown(town, px, py, t, world, o, rPx);
    if (got === undefined) { pending = true; continue; }
    for (const p of got) parties.push(p);
  }
  return { parties, pending };
}

/**
 * LW-PERF: ONE TOWN'S SHARE of partiesNear - its parties on the road within `rPx` map pixels of the pixel at minute `t`
 * (a reader may read the towns near over several frames). Undefined while its trips wait on a way.
 * @param {LwTown} town @param {number} px @param {number} py @param {number} t @param {TripWorld} world
 * @param {{ mpm: number, memo?: Map<string, Trip|null> }} o @param {number} [rPx]
 * @returns {{ trip: Trip, at: ReturnType<typeof partyAt> }[] | undefined}
 */
export function partiesOfTown(town, px, py, t, world, o, rPx = 6) {
  const trips = townTrips(town, t, world, o);
  if (trips === undefined) return undefined;
  const parties = [];
  for (const trip of trips) {
    const at = partyAt(trip, t);
    if (at.phase !== 'out' && at.phase !== 'back') continue;
    const ppx = Math.floor(/** @type {number} */ (at.x) / NATIVE_PIXEL), ppy = 499 - Math.floor(/** @type {number} */ (at.z) / NATIVE_PIXEL);
    if (Math.max(Math.abs(ppx - px), Math.abs(ppy - py)) <= rPx) parties.push({ trip, at });
  }
  return parties;
}

/** LW4: how long the fallen lie where they fell (minutes of the clock). */
export const REMAINS_MIN = DAY_MIN;

/**
 * LW4: THE FALLEN near a pixel at minute `t` - each of the towns' parties' dead within `rPx` map pixels, lying where
 * the trouble took them for REMAINS_MIN (native `x`, `z`; `yaw` the way the party walked). `pending` as partiesNear's.
 * @param {number} px @param {number} py @param {number} t @param {TripWorld} world @param {{ mpm: number, memo?: Map<string, Trip|null> }} o
 * @param {number} [rPx]
 * @returns {{ remains: { key: string, res: Resident, x: number, z: number, yaw: number, trip: Trip }[], pending: boolean }}
 */
export function remainsNear(px, py, t, world, o, rPx = 6) {
  const remains = [];
  let pending = false;
  for (const town of world.townsNear(px, py, rPx + TRIP_REACH_PX)) {
    const got = remainsOfTown(town, px, py, t, world, o, rPx);
    if (got === undefined) { pending = true; continue; }
    for (const r of got) remains.push(r);
  }
  return { remains, pending };
}

/**
 * LW-PERF: ONE TOWN'S SHARE of remainsNear (a reader may read the towns near over several frames). Undefined while its
 * trips wait on a way.
 * @param {LwTown} town @param {number} px @param {number} py @param {number} t @param {TripWorld} world
 * @param {{ mpm: number, memo?: Map<string, Trip|null> }} o @param {number} [rPx]
 * @returns {{ key: string, res: Resident, x: number, z: number, yaw: number, trip: Trip }[] | undefined}
 */
export function remainsOfTown(town, px, py, t, world, o, rPx = 6) {
  const trips = townTrips(town, t, world, o);
  if (trips === undefined) return undefined;
  const remains = [];
  for (const trip of trips) {
    const fell = trip.fallen?.filter((f) => !f.hand);   // LW7: a hand's dead lie where the hand left them, not the road's
    if (!fell?.length) continue;
    fell.forEach((f, i) => {
      if (f.inside || f.atSea || !(f.t <= t && t < f.t + REMAINS_MIN)) return;   // LW6: the fallen of a dive lie in the dungeon; LW5b: the sea's, nowhere
      const p = wayAt(trip.way, f.s);
      const ppx = Math.floor(p.x / NATIVE_PIXEL), ppy = 499 - Math.floor(p.z / NATIVE_PIXEL);
      if (Math.max(Math.abs(ppx - px), Math.abs(ppy - py)) > rPx) return;
      // laid a pace apart across the way, as they fell
      const side = (i - (fell.length - 1) / 2) * 60;
      remains.push({ key: `rem:${f.res.id}`, res: f.res, x: p.x + Math.cos(p.yaw) * side, z: p.z - Math.sin(p.yaw) * side, yaw: p.yaw, trip });
    });
  }
  return remains;
}

/** LW6b: how long the fallen of a dive lie in its dungeon to be found (the clock's minutes). */
export const DEEP_REMAINS_MIN = 3 * DAY_MIN;

/**
 * LW6b: THE FALLEN IN THE DEEP at minute `t` - the dead of the dives into `dungeon` by the towns within reach, each from
 * the minute the deep took them for DEEP_REMAINS_MIN (a hand's dead are the hand's: LW7). `key` the remains' own
 * (`deep:<resident>:<trip>`). The oldest first. `pending` as diversAt's.
 * @param {LwTown} dungeon @param {number} t @param {TripWorld} world @param {{ mpm: number, memo?: Map<string, Trip|null> }} o
 * @returns {{ remains: { key: string, res: Resident, trip: Trip, t: number }[], pending: boolean }}
 */
export function fallenIn(dungeon, t, world, o) {
  /** @type {Map<string, { key: string, res: Resident, trip: Trip, t: number }>} */
  const found = new Map();
  let pending = false;
  for (const town of world.townsNear(dungeon.px ?? 0, dungeon.py ?? 0, TRIP_REACH_PX)) {
    // a trip is its town's within a day of its end: read back over the days the remains lie
    for (let back = 0; back * DAY_MIN <= DEEP_REMAINS_MIN + DAY_MIN; back++) {
      const trips = townTrips(town, t - back * DAY_MIN, world, o);
      if (trips === undefined) { pending = true; break; }
      for (const trip of trips) {
        if (!trip.dive || trip.to?.mapId !== dungeon.mapId) continue;
        for (const f of trip.fallen ?? []) {
          if (!f.inside || f.hand || !(f.t <= t && t < f.t + DEEP_REMAINS_MIN)) continue;
          const key = `deep:${f.res.id}:${trip.id}`;
          if (!found.has(key)) found.set(key, { key, res: f.res, trip, t: f.t });
        }
      }
    }
  }
  return { remains: [...found.values()].sort((a, b) => a.t - b.t || (a.key < b.key ? -1 : 1)), pending };
}

/**
 * LW6: THE DIVERS in a dungeon at minute `t` - the parties of the towns within TRIP_REACH_PX inside it now (their dive,
 * less the fallen by then). `pending` as partiesNear's.
 * @param {LwTown} dungeon @param {number} t @param {TripWorld} world @param {{ mpm: number, memo?: Map<string, Trip|null> }} o
 * @returns {{ divers: { trip: Trip, members: Resident[] }[], pending: boolean }}
 */
export function diversAt(dungeon, t, world, o) {
  const divers = [];
  let pending = false;
  for (const town of world.townsNear(dungeon.px ?? 0, dungeon.py ?? 0, TRIP_REACH_PX)) {
    const trips = townTrips(town, t, world, o);
    if (trips === undefined) { pending = true; continue; }
    for (const trip of trips) {
      if (!trip.dive || trip.to?.mapId !== dungeon.mapId || !(trip.dive.t0 <= t && t < trip.backT0)) continue;
      const members = membersAt(trip, t);
      if (members.length) divers.push({ trip, members });
    }
  }
  return { divers, pending };
}
