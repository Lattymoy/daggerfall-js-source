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
import { CITY_COURT_BLOCKS } from './census.js';
import { companiesOf, companyOfPlace, namedIn, COMPANY_DIVE_CHANCE, holyDayOf, holyDepartMin, holyDraw } from './companies.js';   // LW13: the companies, the pilgrims' holy day

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
/** LW9 (bible/06-Systems/Living-World-II.md): THE ROAD'S NEW TRAFFIC's own tables, beside the first's - each job's pace,
 *  cycle (days), chance a cycle, reach (map pixels) and stay (days). A patrol's and a noble's people ride with their
 *  leader (`leaderOf`) as a sellsword rides with its merchant, and keep no tables of their own. */
export const ROAD_PACE = Object.freeze({ carter: 0.8, hunter: 1, patrol: 1, noble: 0.85, retainer: 0.85, minstrel: 0.95 });
export const ROAD_CYCLE_DAYS = Object.freeze({ carter: 7, hunter: 4, patrol: 6, noble: 20, minstrel: 4 });
export const ROAD_TRIP_CHANCE = Object.freeze({ carter: 0.8, hunter: 0.75, patrol: 0.95, noble: 0.6, minstrel: 0.8 });
export const ROAD_RANGE_PX = Object.freeze({ carter: [1, 4], hunter: [1, 3], patrol: [3, 12], noble: [6, 18], minstrel: [3, 8] });
export const ROAD_STAY_DAYS = Object.freeze({ carter: [0, 0], hunter: [0, 0], patrol: [0, 1], noble: [1, 2], minstrel: [1, 2] });
/** A job's row of a table, the road's new traffic's beside the first's. @param {Record<string, any>} first @param {Record<string, any>} road @param {string} job */
const rowOf = (first, road, job) => first[job] ?? road[job];
/** LW9: A CARTER'S MARKET - a town of this many blocks or more, a city or a village (a General Store's town), its market
 *  day one day in seven by its map id; the carter in by MARKET_IN_H (the road walked from first light, WALK_FROM_H), at
 *  the stall till MARKET_OUT_H, home by nightfall - a market farther than a morning's walk is no carter's. */
export const MARKET_BLOCKS = 4;
export const MARKET_IN_H = 12;
export const MARKET_OUT_H = 13.5;
/** LW9: A HUNTER'S WILD - its point the first of a few seeded tries that stands on dry ground off every town's pixel. */
export const WILD_TRIES = 6;
/** LW9: THE INN ON THE ROAD - a roadside tavern (location type 6) this near the way (map pixels) is an inn a party walks
 *  on to at nightfall, when it lies ahead within INN_AHEAD_N (native: a map pixel) - it lodges there, not in a camp. */
export const INN_TYPE = 6;
export const INN_REACH_PX = 1;
export const INN_AHEAD_N = NATIVE_PIXEL;
/** LW9: A PATROL KEEPS THE ROADS round its towns - a trip from or to a town a patrol's round went from or to in the
 *  days before it (and while it walks) meets trouble PATROL_RISK times as often. */
export const PATROL_COVER_DAYS = 2;
export const PATROL_RISK = 0.5;
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
/** LW-DRY: the ground a party's stop stands on - its middle and a ring this far about it (native: 5 m, past the widest
 *  of the road's rings, a beset party's foes - livingRoads.js FOE_RING_N) - and the step a stop is sounded along its way
 *  for dry ground (native: 2 m - AUDIT LW-DRY: 8 m stepped over a dry place too narrow to find). */
export const STOP_RING_N = 200;
export const DRY_STEP_N = 80;

/**
 * @typedef {import('./census.js').Resident} Resident
 * @typedef {import('./census.js').LwTown} LwTown
 * @typedef {{ pixels: { x: number, y: number }[], kinds?: string[] }} RoutePlan - travelRoute.js planRoute's answer
 * @typedef {{ pts: number[][], cum: number[], len: number, kinds: string[], dry?: (nx: number, nz: number) => boolean,
 *   inns?: { s: number, town: LwTown }[] }} Way - a route as a walked line (native). LW-DRY `dry`: whether the ground at a
 *   native point is dry (the world's `dryAt`). LW9 `inns`: the roadside taverns on it (innsAlong)
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
 *   dryAt?: (nx: number, nz: number) => boolean,
 * }} TripWorld - the host's: towns near a pixel (the game's own rows, populated); the planner's way between two towns
 *   (undefined while it is being asked, null for none); a town's travellers (census.js travellerRoster). LW4: who holds
 *   a traveller's place in a cycle (lives.js - null while it stands empty; unasked, the census's own), whether its
 *   holder dies that cycle (and so sets out whatever the chance said - a fated death is on the road), and the trouble
 *   a trip meets (trouble.js - the trip as it left it). LW6: the dungeons near a pixel (`dungeon: true` rows - an
 *   adventurer's dives). LW5b: the Bay's lanes from a port town (naval/seaLanes.js: the far port, the lane's length in
 *   metres; none for a town with no harbour; undefined while the map is unread). LW-DRY: whether the ground at a native
 *   point is dry (`nativeDry` over world/dryGround.js - the height map's own, every client's alike); unasked, all is dry)
 * @typedef {{ id: string, k?: number, kind: string, leader: Resident, party: Resident[], from: LwTown, to: LwTown, way: Way,
 *   pace: number, outT0: number, outT1: number, backT0: number, backT1: number, trim0: number, trim1: number,
 *   enc?: any, halt?: { t0: number, t1: number, fightEnd: number, s: number, leg: 'out'|'back' },
 *   fallen?: { res: Resident, t: number, s: number, inside?: boolean, hand?: boolean, atSea?: boolean }[], turned?: boolean, dive?: { t0: number, t1: number },
 *   sea?: { key: string, len: number }, market?: boolean, wild?: { x: number, z: number }, company?: { key: string, name: string },
 *   holy?: { day: number, id: number }, hiredBy?: string }} Trip - LW13: `company` the company walking it, `holy` a pilgrims'
 *   holy day it is bound for, `hiredBy` a company's trip a merchant's train took on. LW5b: `sea` a passage
 *   by sea, its lane and length (no road under it). LW9: `market` a carter's day to market, `wild` a hunter's point in the
 *   wild (its `to` no town: `mapId` -1). LW6: `dive` an
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

/**
 * A planner's route as a walked line through its pixels' centres (native units). LW-DRY: `dry` the ground's (the
 * world's `dryAt`), read where a party stops.
 * @param {RoutePlan} plan @param {((nx: number, nz: number) => boolean) | null} [dry] @returns {Way}
 */
export function wayOf(plan, dry = null) {
  const pts = (plan?.pixels ?? []).map((p) => [p.x * NATIVE_PIXEL + NATIVE_PIXEL / 2, (499 - p.y) * NATIVE_PIXEL + NATIVE_PIXEL / 2]);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  /** @type {Way} */
  const way = { pts, cum, len: cum[cum.length - 1] ?? 0, kinds: [...(plan?.kinds ?? [])] };
  if (dry) way.dry = dry;
  return way;
}

/**
 * LW-DRY: a native point's ground through a reader of a map pixel's (world/dryGround.js createDryGround: the pixel, and
 * the point's fraction east and north across it) - the frame the ways are drawn in: x east from pixel 0, z north from
 * the map's southern edge (a pixel's row `499 - floor(z / NATIVE_PIXEL)`, trouble.js's own reading).
 * @param {(px: number, py: number, fx: number, fz: number) => boolean} dry
 * @returns {(nx: number, nz: number) => boolean}
 */
export function nativeDry(dry) {
  return (nx, nz) => {
    const gx = nx / NATIVE_PIXEL, gz = nz / NATIVE_PIXEL;
    const px = Math.floor(gx), pz = Math.floor(gz);
    return dry(px, 499 - pz, gx - px, gz - pz);
  };
}

/** LW-DRY: each way's stops sounded, kept (the same night asked every read). @type {WeakMap<Way, Map<string, number>>} */
const stopsOf = new WeakMap();

/**
 * LW-DRY (field, 2026-10-05, Mac: "NPCs will get stuck over bodies of water"): A STOP ON DRY GROUND. A way is the
 * planner's straight legs between its pixels' centres, and the planner's water is a whole pixel's: by a coast a leg
 * runs over the sea's edge, and where night or trouble stopped a party there it camped, fought and lay fallen in the
 * water. The first place at or past `s` along `way`, going `dir` (+1 on the way out, -1 on the way home), within
 * [`lo`, `hi`], where a stop stands dry - its middle and a ring of STOP_RING_N about it, sounded a DRY_STEP_N at a time;
 * none before the leg's end, its end (AUDIT LW-DRY: the town's own ground - its flattened plateau the kernel does not
 * read; before, `s` itself, the water). With no `way.dry`, `s`.
 * @param {Way} way @param {number} s @param {1|-1} dir @param {number} lo @param {number} hi
 * @returns {number}
 */
export function dryStop(way, s, dir, lo, hi) {
  const dry = way.dry;
  if (!dry) return s;
  let kept = stopsOf.get(way);
  if (!kept) stopsOf.set(way, kept = new Map());
  const key = `${dir}:${s}:${lo}:${hi}`;
  const known = kept.get(key);
  if (known !== undefined) return known;
  let found = dir > 0 ? hi : lo;
  for (let at = s; at >= lo && at <= hi; at += dir * DRY_STEP_N) {
    const p = wayAt(way, at);
    let ok = dry(p.x, p.z);
    for (let i = 0; ok && i < 8; i++) ok = dry(p.x + Math.sin((i * Math.PI) / 4) * STOP_RING_N, p.z + Math.cos((i * Math.PI) / 4) * STOP_RING_N);
    if (ok) { found = at; break; }
  }
  kept.set(key, found);
  return found;
}

/** LW-DRY: the last minute walking ended (WALK_TO_H) at or before `t`. @param {number} t */
const lastDusk = (t) => { const d = Math.floor(t / DAY_MIN) * DAY_MIN + WALK_TO_H * 60; return d <= t ? d : d - DAY_MIN; };

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
  const len = Math.max(2, Math.round((rowOf(CYCLE_DAYS, ROAD_CYCLE_DAYS, res.job) ?? 8) * scale));
  const phase = lwSeed(res.town, res.slot, 0x6379) % len;   // 'cy'
  const k = Math.floor((day + phase) / len);
  return { k, start: k * len - phase, len };
}

/**
 * LW9: where the road's new traffic may be bound - a patrol keeps its own region, a noble goes to another court (a city
 * of CITY_COURT_BLOCKS), a minstrel to a town big enough for a tavern's crowd; the first's jobs anywhere their range
 * says.
 * @param {string} job @param {LwTown} home @param {LwTown} t
 */
export function roadBound(job, home, t) {
  if (job === 'patrol') return home.region == null || t.region === home.region;
  if (job === 'noble') return t.type === 0 && (t.blocks | 0) >= CITY_COURT_BLOCKS;
  if (job === 'minstrel') return (t.blocks | 0) >= MARKET_BLOCKS;
  return true;
}

/**
 * LW9: THE ONE A TRAVELLER RIDES WITH - a place whose trips are another's: a sellsword's its contract merchant
 * (contractOf), a patrol's its first (the patrol rides as one), a retainer's the noble the retainers are dealt to in slot
 * order (the first to the first, round again, as the sellswords are); LW13 an adventurer's its company's first
 * (companies.js). Null for one who leads, or rides with nobody.
 * @param {Resident} res @param {Resident[]} roster @returns {Resident|null}
 */
export function leaderOf(res, roster) {
  if (res.job === 'mercenary') return contractOf(res, roster);
  if (res.job === 'patrol') {
    const first = roster.filter((r) => r.job === 'patrol').sort((a, b) => a.slot - b.slot)[0] ?? null;
    return first && first.slot !== res.slot ? first : null;
  }
  if (res.job === 'adventurer') {   // LW13: a company's place rides with its first
    const c = companyOfPlace(res, roster);
    return c && c.places[0].slot !== res.slot ? c.places[0] : null;
  }
  if (res.job === 'retainer') {
    const nobles = roster.filter((r) => r.job === 'noble').sort((a, b) => a.slot - b.slot);
    const i = roster.filter((r) => r.job === 'retainer').sort((a, b) => a.slot - b.slot).findIndex((r) => r.slot === res.slot);
    return nobles.length && i >= 0 ? nobles[i % nobles.length] : null;
  }
  return null;
}

/** LW9: a market town's market day - one day in seven, by its map id: true on `day`. @param {LwTown} town @param {number} day */
export const marketDay = (town, day) => ((day + (lwSeed(town.mapId >>> 0, 0x6d6b74) % 7)) % 7) === 0;   // 'mkt'

/**
 * LW9: A CARTER'S DAY TO MARKET - the nearest town within reach that keeps a market (a city or a village of
 * MARKET_BLOCKS), on its MARKET DAY in the cycle (`marketDay`): out at first light, in by MARKET_IN_H (a walk longer than
 * that is too far - the next nearer), at the stall till MARKET_OUT_H, home by the evening. Null for none; undefined while
 * a way is asked.
 * @param {Resident} res @param {LwTown} home @param {number} k @param {TripWorld} world
 * @param {{ start: number, len: number, pace: number, rng: () => number }} o
 * @returns {Trip|null|undefined}
 */
export function marketTrip(res, home, k, world, { start, len, pace, rng }) {
  const [, rMax] = ROAD_RANGE_PX.carter;
  const dist = (/** @type {LwTown} */ t) => Math.hypot((t.px ?? 0) - (home.px ?? 0), (t.py ?? 0) - (home.py ?? 0));
  const near = world.townsNear(home.px ?? 0, home.py ?? 0, rMax)
    .filter((t) => t.mapId !== home.mapId && (t.blocks | 0) >= MARKET_BLOCKS && (t.type == null || t.type === 0 || t.type === 2))
    .sort((a, b) => dist(a) - dist(b) || a.mapId - b.mapId);
  const leave = Math.floor((5 + rng()) * 60);
  for (const to of near) {
    let day = -1;
    for (let d = start; d < start + len; d++) if (marketDay(to, d)) { day = d; break; }
    if (day < 0) continue;
    const plan = world.routeOf(home, to);
    if (plan === undefined) return undefined;
    if (!plan || !(plan.pixels?.length >= 2)) continue;
    const way = wayOf(plan, world.dryAt);
    const trim0 = Math.min(townTrim(home), way.len * 0.4), trim1 = Math.min(townTrim(to), way.len * 0.4);
    const walk = Math.max(0, way.len - trim0 - trim1) / pace;
    const outT0 = day * DAY_MIN + leave;
    const outT1 = whenWalked(outT0, walk);
    if (outT1 > day * DAY_MIN + MARKET_IN_H * 60) continue;   // too far to be in for the market
    const backT0 = day * DAY_MIN + MARKET_OUT_H * 60;
    const backT1 = whenWalked(backT0, walk);
    if (backT1 > day * DAY_MIN + WALK_TO_H * 60) continue;   // home by nightfall
    return { id: `${res.id}:${k}`, k, kind: res.job, leader: res, party: [res], from: home, to, way, pace,
      outT0, outT1, backT0, backT1, trim0, trim1, market: true };
  }
  return null;
}

/** LW9: the wild a hunter goes into - no town, its own name. @param {number} px @param {number} py @returns {LwTown} */
const wildOf = (px, py) => ({ mapId: -1, name: 'the wild', px, py, blocks: 1, wild: true });

/**
 * LW9: A HUNTER'S DAY IN THE WILD - a point on dry, open ground one to three map pixels off their town (the first of
 * WILD_TRIES seeded tries that stands dry, off every town's pixel, its line from the town dry where it is sounded), out at
 * first light, a night's camp there, home the next day. Its way is no road: a straight line from the town, `open`
 * throughout (trouble.js GROUND_RISK's worst). Null for none.
 * @param {Resident} res @param {LwTown} home @param {number} k @param {TripWorld} world
 * @param {{ start: number, len: number, pace: number, rng: () => number }} o
 * @returns {Trip|null}
 */
export function wildTrip(res, home, k, world, { start, len, pace, rng }) {
  const hx = ((home.px ?? 0) + 0.5) * NATIVE_PIXEL, hz = (499 - (home.py ?? 0) + 0.5) * NATIVE_PIXEL;
  const [rMin, rMax] = ROAD_RANGE_PX.hunter;
  for (let i = 0; i < WILD_TRIES; i++) {
    const ang = rng() * Math.PI * 2, d = (rMin + rng() * (rMax - rMin)) * NATIVE_PIXEL;
    const wx = hx + Math.sin(ang) * d, wz = hz + Math.cos(ang) * d;
    const ppx = Math.floor(wx / NATIVE_PIXEL), ppy = 499 - Math.floor(wz / NATIVE_PIXEL);
    if (world.townsNear(ppx, ppy, 0).length) continue;
    let dry = true;
    for (let j = 1; dry && j <= 4; j++) dry = !world.dryAt || world.dryAt(hx + ((wx - hx) * j) / 4, hz + ((wz - hz) * j) / 4);
    if (!dry) continue;
    /** @type {Way} */
    const way = { pts: [[hx, hz], [wx, wz]], cum: [0, d], len: d, kinds: ['open'] };
    if (world.dryAt) way.dry = world.dryAt;
    const trim0 = Math.min(townTrim(home), d * 0.4), trim1 = 0;
    const walk = Math.max(0, d - trim0) / pace;
    const estDays = 3;
    if (estDays > len - 1) return null;
    const dayOffset = Math.floor(rng() * (len - estDays));
    const outT0 = (start + dayOffset) * DAY_MIN + Math.floor((6 + rng()) * 60);
    const outT1 = whenWalked(outT0, walk);
    const backT0 = (Math.floor(outT1 / DAY_MIN) + 1) * DAY_MIN + Math.floor((8 + rng() * 2) * 60);   // the next morning's hunt done
    const backT1 = whenWalked(backT0, walk);
    if (backT1 > (start + len) * DAY_MIN + DAY_START_MIN) return null;
    return { id: `${res.id}:${k}`, k, kind: res.job, leader: res, party: [res], from: home, to: wildOf(ppx, ppy), way, pace,
      outT0, outT1, backT0, backT1, trim0, trim1, wild: { x: wx, z: wz } };
  }
  return null;
}

/**
 * LW9: THE INNS ON A WAY - each roadside tavern (location type INN_TYPE) within INN_REACH_PX of one of the route's
 * pixels, but its two ends, where the way comes nearest it (`s`, native) - read once, as the way is made (`way.inns`).
 * @param {Way} way @param {RoutePlan} plan @param {TripWorld} world @param {LwTown} home @param {LwTown} to
 * @returns {Way}
 */
export function innsAlong(way, plan, world, home, to) {
  /** @type {Map<number, { s: number, town: LwTown }>} */
  const found = new Map();
  const px = plan?.pixels ?? [];
  for (let i = 0; i < px.length; i++) {
    for (const t of world.townsNear(px[i].x, px[i].y, INN_REACH_PX)) {
      if (t.type !== INN_TYPE || t.mapId === home.mapId || t.mapId === to.mapId || found.has(t.mapId)) continue;
      found.set(t.mapId, { s: way.cum[i] ?? 0, town: t });
    }
  }
  if (found.size) way.inns = [...found.values()].sort((a, b) => a.s - b.s || a.town.mapId - b.town.mapId);
  return way;
}

/**
 * LW9: WHERE NIGHT STOPS A PARTY - an inn on its way ahead within INN_AHEAD_N (the nearest; it walks on to it and lodges
 * there), else the first dry ground on (dryStop).
 * @param {Way} way @param {number} s @param {1|-1} dir @param {number} lo @param {number} hi @returns {number}
 */
export function nightStop(way, s, dir, lo, hi) {
  const inn = innAhead(way, s, dir, lo, hi);
  return inn ? inn.s : dryStop(way, s, dir, lo, hi);
}

/** LW9: the inn ahead of `s` within INN_AHEAD_N, between `lo` and `hi`, or null. @param {Way} way @param {number} s @param {1|-1} dir @param {number} lo @param {number} hi */
export function innAhead(way, s, dir, lo, hi) {
  let best = null;
  for (const inn of way.inns ?? []) {
    const ahead = dir * (inn.s - s);
    if (ahead < 0 || ahead > INN_AHEAD_N || inn.s < lo || inn.s > hi) continue;
    if (!best || ahead < dir * (best.s - s)) best = inn;
  }
  return best;
}

/**
 * The trip a traveller makes in cycle `k` (only the traveller's own choice - no caravan yet), null for none, undefined
 * while a way it needs is still being asked.
 * @param {Resident} res @param {LwTown} home @param {number} k @param {TripWorld} world @param {{ mpm: number }} o
 * @returns {Trip|null|undefined}
 */
export function ownTrip(res, home, k, world, { mpm }) {
  const chance = rowOf(TRIP_CHANCE, ROAD_TRIP_CHANCE, res.job);
  if (!(chance > 0)) return null;
  if ((res.job === 'patrol' || res.job === 'adventurer') && leaderOf(res, world.rosterOf(home))) return null;   // LW9: a patrol's rides with its first; LW13: a company's with its first
  const company = res.job === 'adventurer' ? companyOfPlace(res, world.rosterOf(home)) : null;   // LW13: the company it leads
  const scale = paceScale(mpm);
  const len = Math.max(2, Math.round((rowOf(CYCLE_DAYS, ROAD_CYCLE_DAYS, res.job) ?? 8) * scale));
  const phase = lwSeed(res.town, res.slot, 0x6379) % len;
  const start = k * len - phase;
  const rng = lwRng(res.town, res.slot, k, 0x74726970);   // 'trip'
  if (rng() >= chance && !world.fated?.(res, k) && !company?.places.slice(1).some((p) => world.fated?.(p, k))) return null;   // LW4: a death the lives hold for this cycle is met on the road (AUDIT-B1: the dice's - a spare never takes the trip away); LW13: any of its company's
  const pace = (rowOf(TRIP_PACE, ROAD_PACE, res.job) ?? 1) * mpm * NATIVE_PER_M;   // native a clock minute
  // LW9: a carter's day to market, a hunter's into the wild - their own laws
  if (res.job === 'carter') return marketTrip(res, home, k, world, { start, len, pace, rng });
  if (res.job === 'hunter') return wildTrip(res, home, k, world, { start, len, pace, rng });
  // LW6: an adventurer's cycle a DIVE now and then - its own dice, so a cycle that is none is the trip it always was
  if (res.job === 'adventurer' && world.dungeonsNear) {
    const drng = lwRng(res.town, res.slot, k, 0x64697665);   // 'dive'
    if (drng() < (company ? COMPANY_DIVE_CHANCE : DIVE_CHANCE)) {   // LW13: a company the likelier
      const dive = diveTrip(res, home, k, world, { start, len, pace, rng: drng });
      if (dive !== null) return dive;   // undefined (a way asked) or the dive; none that fits, the town trip
    }
  }
  // LW13: a pilgrim's cycle with a temple town's holy day in reach goes to it (its own draw), as a band with its town's
  if (res.job === 'pilgrim' && world.templeTown) {
    const holy = holyTrip(res, home, k, world, { start, len, pace });
    if (holy !== null) return holy;   // undefined (a way asked) or the holy day's; none, the trip it always was
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
  const [rMin, rMax] = rowOf(TRIP_RANGE_PX, ROAD_RANGE_PX, res.job) ?? [3, 12];
  const near = world.townsNear(home.px ?? 0, home.py ?? 0, rMax)
    .filter((t) => t.mapId !== home.mapId && Math.max(Math.abs((t.px ?? 0) - (home.px ?? 0)), Math.abs((t.py ?? 0) - (home.py ?? 0))) >= rMin)
    .filter((t) => roadBound(res.job, home, t));   // LW9: a patrol keeps its region, a noble goes to a court, a minstrel to a tavern's town
  if (!near.length) return null;
  /** @type {Record<string, number>} */
  const weights = {};
  for (const t of near) {
    const d = Math.hypot((t.px ?? 0) - (home.px ?? 0), (t.py ?? 0) - (home.py ?? 0));
    const size = Math.pow(Math.max(1, t.blocks | 0), 0.7);
    let w = res.job === 'merchant' ? size / (1 + d / 8) : res.job === 'pilgrim' ? ((world.templeTown?.(t) ? 6 : 0.2) * size) / (1 + d / 12) : 1 / (1 + d / 10);
    if (res.job === 'adventurer') w = size / (1 + d / 6);
    else if (res.job === 'patrol' || res.job === 'noble' || res.job === 'minstrel') w = size / (1 + d / 8);   // LW9
    weights[String(t.mapId)] = w;
  }
  // the pick, then the towns nearer than it, the farthest of them first - the trip most like the one chosen that fits
  const pick = pickWeighted(rng, weights);
  const first = near.find((t) => String(t.mapId) === pick);
  if (!first) return null;
  const dist = (t) => Math.hypot((t.px ?? 0) - (home.px ?? 0), (t.py ?? 0) - (home.py ?? 0));
  const nearer = near.filter((t) => t !== first && dist(t) < dist(first)).sort((a, b) => dist(b) - dist(a) || a.mapId - b.mapId);
  const order = [first, ...nearer];
  const [sLo, sHi] = rowOf(STAY_DAYS, ROAD_STAY_DAYS, res.job) ?? [1, 1];
  const stay = rollInt(rng, sLo, sHi);
  const departH = res.job === 'adventurer' ? 6 + rng() * 2 : 7 + rng() * 2;
  const offsetRoll = rng();
  for (const to of order) {
    const plan = world.routeOf(home, to);
    if (plan === undefined) return undefined;
    if (!plan || !(plan.pixels?.length >= 2)) continue;
    const way = innsAlong(wayOf(plan, world.dryAt), plan, world, home, to);   // LW9: the inns on its road
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

/** LW13: a pilgrim's holy day is reached by this hour of its morning (in for the day's rites). */
export const HOLY_IN_H = 10;
/**
 * LW13: A PILGRIMAGE TO A HOLY DAY - the first temple town within a pilgrim's range keeping its region's own holy day
 * inside the cycle (companies.js holyDayOf, the nearer first): out of a morning (one minute for its town's pilgrims -
 * they go as a band) to arrive by HOLY_IN_H of it, home the morning after - inside the cycle, or none (null); the
 * pilgrim's own draw (HOLY_CHANCE) says whether it goes. Undefined while a way is asked.
 * @param {Resident} res @param {LwTown} home @param {number} k @param {TripWorld} world
 * @param {{ start: number, len: number, pace: number }} o
 * @returns {Trip|null|undefined}
 */
export function holyTrip(res, home, k, world, { start, len, pace }) {
  if (!holyDraw(res, k)) return null;
  const [rMin, rMax] = TRIP_RANGE_PX.pilgrim;
  const dist = (t) => Math.hypot((t.px ?? 0) - (home.px ?? 0), (t.py ?? 0) - (home.py ?? 0));
  const temples = world.townsNear(home.px ?? 0, home.py ?? 0, rMax)
    .filter((t) => t.mapId !== home.mapId && Math.max(Math.abs((t.px ?? 0) - (home.px ?? 0)), Math.abs((t.py ?? 0) - (home.py ?? 0))) >= rMin && !!world.templeTown?.(t))
    .sort((a, b) => dist(a) - dist(b) || a.mapId - b.mapId);
  const holy = holyDayOf(temples, start, len);
  if (!holy) return null;
  const plan = world.routeOf(home, holy.town);
  if (plan === undefined) return undefined;
  if (!plan || !(plan.pixels?.length >= 2)) return null;
  const to = /** @type {LwTown} */ (holy.town);
  const way = innsAlong(wayOf(plan, world.dryAt), plan, world, home, to);
  const trim0 = Math.min(townTrim(home), way.len * 0.4), trim1 = Math.min(townTrim(to), way.len * 0.4);
  const walk = Math.max(0, way.len - trim0 - trim1) / pace;
  const by = holy.day * DAY_MIN + HOLY_IN_H * 60;
  let outDay = holy.day - Math.ceil(walk / ((WALK_TO_H - WALK_FROM_H) * 60));
  let outT0 = outDay * DAY_MIN + holyDepartMin(home, holy.day), outT1 = whenWalked(outT0, walk);
  for (let i = 0; i < 2 && outT1 > by; i++) { outDay--; outT0 = outDay * DAY_MIN + holyDepartMin(home, holy.day); outT1 = whenWalked(outT0, walk); }
  if (outT1 > by) return null;
  const backT0 = (holy.day + 1) * DAY_MIN + 7 * 60 + (lwSeed(home.mapId >>> 0, holy.day, 0x6261) % 120);   // 'ba': the morning after
  const backT1 = whenWalked(backT0, walk);
  if (outT0 < start * DAY_MIN || backT1 > (start + len) * DAY_MIN + DAY_START_MIN) return null;
  return { id: `${res.id}:${k}`, k, kind: res.job, leader: res, party: [res], from: home, to, way, pace,
    outT0, outT1, backT0, backT1, trim0, trim1, holy: { day: holy.day, id: holy.id } };
}

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
    const way = wayOf(plan, world.dryAt);
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
  const m = leaderOf(res, roster);   // LW9: a patrol's and a retainer's too
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
  if (res.job === 'mercenary' || leaderOf(res, world.rosterOf(town))) {   // LW9: a patrol's and a retainer's ride with their leader
    const m = leaderOf(res, world.rosterOf(town));
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
      if (!(rowOf(TRIP_CHANCE, ROAD_TRIP_CHANCE, res.job) > 0)) continue;
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
 *  - LW13: a COMPANY (companies.js) walks its first place's trip, every place's holder that cycle with it, named; one
 *    setting out the day a merchant's train with no sellsword does, for the same town, is HIRED on it. PILGRIMS of the
 *    town setting out the same day for the same town (in no train) go as a BAND, the first place leading.
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
  /** A merchant's trip's sellswords: its contract's first `want` places, and any whose holder the road takes. @param {Trip} tr */
  const hiredOf = (tr) => {
    const mi = merchants.findIndex((m) => m.slot === tr.leader.slot);
    const want = seededRng(lwSeed(tr.leader.town, tr.leader.slot, tr.outT0 | 0, 0x68697265))() * (HIRE_MAX + 1) | 0;   // 'hire'
    const k = tr.k ?? cycleOf(tr.leader, dayOf(tr), scale).k;
    // the contract's first `want` places, and any place of it whose holder the road takes this cycle (a fated death is met on the road)
    const contract = mi < 0 ? [] : sellswords.filter((_, i) => i % merchants.length === mi);
    return /** @type {Resident[]} */ (contract.map((sw, i) => { const h = held(sw, k); return h && (i < want || !!fated?.(h, k)) ? h : null; }).filter((h) => !!h));
  };
  // LW13: THE COMPANIES (companies.js) - each its first place's trip, its places' holders that cycle walking it; a company
  // setting out the day a merchant's train with no sellsword does, for the same town, is HIRED on it (the joiners' law)
  const companies = companiesOf(roster);
  /** A company's members on its trip: each place's holder that cycle (a place standing empty walks with nobody). */
  const membersOf = (/** @type {any} */ c, /** @type {Trip} */ tr) => {
    const k = tr.k ?? cycleOf(tr.leader, dayOf(tr), scale).k;
    return [tr.leader, ...c.places.slice(1).map((p) => held(p, k)).filter((h) => !!h)];
  };
  /** The merchant's train a company's trip is hired on, or null. @param {Trip} ct */
  const hireOf = (ct) => {
    if (ct.dive || ct.sea) return null;
    const d = dayOf(ct);
    for (const m of merchants) {
      const mt = placeTrip(m, d);
      if (mt && !mt.sea && mt.to.mapId === ct.to.mapId && dayOf(mt) === d && !hiredOf(mt).length) return mt;
    }
    return null;
  };
  // LW13: PILGRIM BANDS - a town's pilgrims setting out the same day for the same town (not in a merchant's train) go
  // together, the first place in slot order leading
  const pilgrims = roster.filter((r) => r.job === 'pilgrim').sort((a, b) => a.slot - b.slot);
  /** The band a pilgrim's trip walks in: its members' trips, the leader's first. @param {Trip} pt */
  const bandOf = (pt) => {
    const d = dayOf(pt);
    return pilgrims.map((r) => placeTrip(r, d)).filter((t) => !!t && t.kind === 'pilgrim' && !t.sea && t.to.mapId === pt.to.mapId && dayOf(t) === d && !trainOf(t));
  };
  /** @type {Trip[]} */
  const out = [];
  for (const tr of trips) {
    if (tr.kind === 'merchant') {
      const hired = hiredOf(tr);
      const d = dayOf(tr);
      const joined = [];
      for (const r of roster) {
        if (!JOINS.has(r.job)) continue;
        const jt = placeTrip(r, d);
        if (jt && jt.to.mapId === tr.to.mapId && dayOf(jt) === d && trainOf(jt)?.id === tr.id) joined.push(jt.leader);
      }
      // LW13: no sellsword with it - the first company setting out with it hired on
      let hiredBy = null;
      if (!hired.length) {
        for (const c of companies) {
          const ct = placeTrip(c.places[0], d);
          if (ct && hireOf(ct)?.id === tr.id) { joined.push(...membersOf(c, ct)); hiredBy = c.key; break; }
        }
      }
      out.push({ ...tr, party: [tr.leader, ...hired, ...joined], ...(hiredBy ? { hiredBy } : {}) });
    } else if (tr.kind === 'patrol' || tr.kind === 'noble') {
      // LW9: a patrol rides as one, its first leading; a noble goes in procession with the retainers dealt to them -
      // every place of it its holder that cycle (a place standing empty rides with nobody)
      const k = tr.k ?? cycleOf(tr.leader, dayOf(tr), scale).k;
      const riders = roster.filter((r) => r.slot !== tr.leader.slot && leaderOf(r, roster)?.slot === tr.leader.slot).sort((a, b) => a.slot - b.slot);
      out.push({ ...tr, party: [tr.leader, ...riders.map((r) => held(r, k)).filter((h) => !!h)] });
    } else if (tr.kind === 'adventurer') {
      // LW13: a company walks its first place's trip together, named; one hired on a merchant's train walks in it
      const c = companies.find((x) => x.places[0].slot === tr.leader.slot) ?? null;
      if (!c) out.push(tr);
      else if (!hireOf(tr)) { const named = namedIn(c, town.name ?? ''); out.push({ ...tr, party: membersOf(c, tr), company: { key: c.key, name: named.name } }); }
    } else if (tr.kind === 'pilgrim') {
      if (trainOf(tr)) continue;
      const band = bandOf(tr);
      if (band.length < 2) out.push(tr);
      else if (band[0].id === tr.id) out.push({ ...tr, party: band.map((t) => t.leader) });   // LW13: the band, its first leading
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
 * road's news (LW7). LW12: a band's trouble names it (`band`).
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
    out.push({ id: tr.id, enc: enc.id, kind: fell.length ? 'fell' : enc.kind, who: who.name, foe: enc.foes?.[0] ?? null, ...(enc.bandName ? { band: enc.bandName } : {}), place: tr.to?.name ?? '', t: known, dive: !!tr.dive, sea: !!tr.sea });
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
 * LW9: `inn` the roadside tavern it lodges at for the night (no camp: it is indoors).
 * @returns {{ phase: 'home'|'out'|'stay'|'back'|'sea', x?: number, z?: number, yaw?: number, camp?: boolean, s?: number, halt?: boolean, fight?: boolean, inn?: LwTown }}
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
  // LW-DRY: a leg walked by day - `sAt(m)` the way the day's walk has covered by minute m, the leg begun at `legT0` -
  // and the camps night makes on it, on dry ground. At each nightfall (the leg's own start, if it sets out by night)
  // the night's camp is the first dry ground on from where the party stands (`dryStop`); it walks on to it at its pace
  // - into the next day if it must - and camps, and by day it is wherever is farther on: the day's walk or that walk on
  // (a camp ahead waits for the day's walk to come up to it). AUDIT LW-DRY: one place a minute, ever on along the leg -
  // before, each dusk sounded from the day's walk and each dawn stood the party at the night's camp, reached or not, so
  // a long wet stretch, a start before dawn or a trouble met on the walk on jumped it. With no ground to read
  // (`way.dry`), the day's walk.
  const walked = (/** @type {'out'|'back'} */ phase, /** @type {number} */ legT0, /** @type {(m: number) => number} */ sAt) => {
    const s = sAt(t);
    if (!way.dry && !way.inns) return placed(phase, s);   // LW9: a way with an inn on it stops at it, dry ground read or not
    const dir = phase === 'out' ? 1 : -1;
    const lo = trim0, hi = way.len - trim1;
    let fall = daylight(legT0) ? lastDusk(legT0) + DAY_MIN : legT0;
    if (t < fall) return placed(phase, s);   // its first day's walk
    // the nights up to `t`, each from where the party stands at its fall
    let at = sAt(fall), camp = nightStop(way, at, dir, lo, hi);   // LW9: an inn ahead, else dry ground
    for (let next = lastDusk(fall) + DAY_MIN; next <= t; next += DAY_MIN) {
      const on = pace * (next - fall) >= Math.abs(camp - at) ? camp : at + dir * pace * (next - fall);
      const w = sAt(next);
      at = dir * (w - on) >= 0 ? w : on;
      fall = next;
      camp = nightStop(way, at, dir, lo, hi);
    }
    const reached = pace * (t - fall) >= Math.abs(camp - at);
    const there = reached ? camp : at + dir * pace * (t - fall);
    if (daylight(t) && dir * (s - there) >= 0) return { ...placed(phase, s), camp: false };   // the day's walk
    const inn = reached ? way.inns?.find((i) => i.s === camp) ?? null : null;   // LW9: lodged at the inn on the road
    return { ...placed(phase, there), camp: reached, ...(inn ? { inn: inn.town } : {}) };   // walking on to the night's camp, or at it
  };
  if (trip.turned && h && t >= h.t1) return walked('back', h.t1, (m) => Math.max(trim0, h.s - Math.min(h.s - trim0, pace * walkedMinutes(h.t1, m))));
  // the lag a halt left - the ground the day's walk would have covered while the party stood - made up at HALT_CATCH_UP
  // again the pace (a party hurrying on, never a sprint); what is still owed at the leg's end is made up at its town.
  // AUDIT LW-DRY: owed from the halt's start - a nightfall during a halt (the camps read the walk at each) is read where
  // the party stood, never where it would have walked to
  const lag = (/** @type {'out'|'back'} */ leg, /** @type {number} */ m) => {
    if (!h || h.leg !== leg || m < h.t0) return 0;
    return Math.max(0, pace * walkedMinutes(h.t0, h.t1) - HALT_CATCH_UP * pace * walkedMinutes(h.t1, m));
  };
  if (t < trip.outT1) return walked('out', trip.outT0, (m) => Math.max(trim0, trim0 + Math.min(walk, pace * walkedMinutes(trip.outT0, m)) - lag('out', m)));
  if (t < trip.backT0) return trip.wild ? { ...placed('out', way.len - trim1), camp: true } : { phase: 'stay' };   // LW9: the hunt's camp in the wild
  return walked('back', trip.backT0, (m) => Math.min(way.len - trim1, way.len - trim1 - Math.min(walk, pace * walkedMinutes(trip.backT0, m)) + lag('back', m)));
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
 * LW9: THE INN'S GUESTS on living day `day` - the parties of the towns within TRIP_REACH_PX lodged at `inn` (a roadside
 * tavern on their way: partyAt's `inn`) the night before the day (out of a morning) or the day's own night: each member
 * with the minute they came in (sounded on from nightfall a quarter hour at a time) and the morning they leave by.
 * Undefined while a way is still being asked.
 * @param {LwTown} inn @param {number} day @param {TripWorld} world @param {{ mpm: number, memo?: Map<string, Trip|null> }} o
 * @returns {{ res: Resident, trip: Trip, inT: number, outT: number, yaw: number, dock: boolean }[] | undefined}
 */
export function innGuestsOf(inn, day, world, o) {
  const D0 = day * DAY_MIN + DAY_START_MIN, D1 = D0 + DAY_MIN;
  const out = [];
  const seen = new Set();
  let pending = false;
  for (const from of world.townsNear(inn.px ?? 0, inn.py ?? 0, TRIP_REACH_PX)) {
    for (const night of [(day - 1) * DAY_MIN + 23 * 60, day * DAY_MIN + 23 * 60]) {
      const trips = townTrips(from, night, world, o);
      if (trips === undefined) { pending = true; break; }
      for (const tr of trips) {
        if (seen.has(`${tr.id}@${night}`) || !tr.way.inns?.some((i) => i.town.mapId === inn.mapId)) continue;
        const at = partyAt(tr, night);
        if (at.inn?.mapId !== inn.mapId) continue;
        seen.add(`${tr.id}@${night}`);
        const dusk = Math.floor(night / DAY_MIN) * DAY_MIN + WALK_TO_H * 60;
        let inT = night;
        for (let m = dusk; m < night; m += 15) if (partyAt(tr, m).inn?.mapId === inn.mapId) { inT = m; break; }
        const outT = (Math.floor(night / DAY_MIN) + 1) * DAY_MIN + WALK_FROM_H * 60;
        if (!(inT < D1 && outT > D0)) continue;
        const yaw = /** @type {number} */ (at.yaw ?? 0) + Math.PI;   // in from the road it walks
        for (const res of membersAt(tr, inT)) out.push({ res, trip: tr, inT, outT, yaw, dock: false });
      }
    }
  }
  return pending ? undefined : out;
}

/**
 * LW9: DOES A PATROL KEEP THE ROAD a trip walks - a patrol's round (its first's own trip; LW9's `patrol`) from or to
 * either end of the trip, walking within PATROL_COVER_DAYS before the trip set out or while it walks. Read off the patrols'
 * own trips alone (memoTrip - never their trouble), so a trip's trouble never asks its own.
 * @param {Trip} trip @param {TripWorld} world @param {{ mpm: number, memo?: Map<string, Trip|null> }} o
 */
export function patrolCover(trip, world, o) {
  if (!trip.from || !trip.to || trip.to.mapId < 0) return false;
  const ends = new Set([trip.from.mapId, trip.to.mapId]);
  const lo = trip.outT0 - PATROL_COVER_DAYS * DAY_MIN, hi = trip.backT1;
  const scale = paceScale(o.mpm);
  const [, reach] = ROAD_RANGE_PX.patrol;
  for (const town of world.townsNear(trip.from.px ?? 0, trip.from.py ?? 0, reach)) {
    if (town.type !== 0 || (town.blocks | 0) < CITY_COURT_BLOCKS) continue;
    const first = world.rosterOf(town).find((r) => r.job === 'patrol' && !leaderOf(r, world.rosterOf(town)));
    if (!first) continue;
    // every cycle of its first's that can hold a round walking in the window - the one before the window's too
    const k1 = cycleOf(first, Math.floor(hi / DAY_MIN), scale).k;
    for (let kk = cycleOf(first, Math.floor(lo / DAY_MIN), scale).k - 1; kk <= k1; kk++) {
      const holder = world.holderOf ? world.holderOf(first, kk) : first;
      const pt = holder ? memoTrip(holder, town, kk, world, o) : null;
      if (pt && pt.outT0 < hi && pt.backT1 > lo && (ends.has(pt.from.mapId) || ends.has(pt.to.mapId))) return true;
    }
  }
  return false;
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
