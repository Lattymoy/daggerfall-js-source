// @ts-check
// CAPTAIN-TREE (2026-10-17, the owner: "A firmament styled captain skill tree along with making improvements to the ship
// upgrade system" - a player's ask beside it: "a skill tree for ship layers ... integrated with leveling ... connect current
// stats to ship behaviour"; bible/03-World/Naval-Refit.md CAPTAIN-TREE) - THE CAPTAIN'S STARS. The port's own; pure.
//
// A CAPTAIN'S LEVEL is earned at sea and never stored: it is read off the captain's log (systems/naval/captainLedger.js
// newLog - ships sunk and taken by their trade, boarders thrown back, prizes claimed, contracts done, leagues sailed,
// charts raised, the Eltheric isles charted and how deep) as CAPTAIN_XP weighs each deed (`captainXpOf`), up a curve
// to CAPTAIN_LEVEL_MAX (`levelOf`). The log is the save's, so the level follows the character, and a captain who has
// done nothing at sea is level 1.
//
// A POINT A LEVEL past the first buys a star on the captain's sky - the Firmament's shape (bible/06-Systems/Firmament.md:
// a start in the middle, paths of small stars to notables and keystones, a star bought only beside one held), its
// "Master and Commander" made a sky of its own. THE HELM in the middle (held by every captain); to its left THE MASTER -
// the seamanship of a ship: her canvas, her oars and helm, her hold and her trade, her shipwright's; to its right THE
// COMMANDER - her war: the guns' drill and their aim, the shot locker (grape, chain, heated shot), the boarders and the
// ram. Each path runs small stars to a notable and on to a KEYSTONE that gives much and costs a little.
//
// A STAR TAKEN BACK takes with it every star joined to the Helm only through it (`takesBack`; `refundable` - one that takes
// none else) - free, at any time: a captain's sky is relearned on the deck, not bought back.
//
// WHAT THE STARS DO is one sum of stats (`starStats`, each a share: +0.06 way is 6% more), read where the ship's own
// numbers are read: her way under sail, under oars and her helm, her hold, her hull (Come Sail Away's and the sea fight's
// refit seam - scenes/fleetHost.js refit), her guns' harm, reload and aim, each load's own edge, her boarders, her ram and
// how long it fouls a ship, her repairs, her trade at the exchange (CAPTAIN_STATS).

import { LEAGUE_M } from '../../world/ethericSea.js';   // the log's `sailed` is metres
import { naturalShot, shotId, shotGun, shotReach } from './shotKinds.js';   // the shot locker's stars: a ball's load

/** The deeds a captain's level is earned by, and each's worth. */
export const CAPTAIN_XP = Object.freeze({
  sunk: Object.freeze({ pirate: 40, merchant: 25, navy: 50, ether: 60, legend: 300 }),
  taken: Object.freeze({ pirate: 60, merchant: 40, navy: 75, ether: 90, legend: 400 }),
  repelled: 30, claimed: 20, contract: 50, league: 12, map: 40, island: 25, deep: 15,
  /** a merchant's way up: an XP for every TRADED_GOLD sold at the exchange (the log's `traded`) */
  traded: 1,
});
export const TRADED_GOLD = 40;
export const CAPTAIN_LEVEL_MAX = 30;

const n0 = (v) => (Number.isFinite(v) && v > 0 ? v : 0);
/** The captain's XP from their log (captainLedger.js newLog's). Pure; a log it cannot read is 0. */
export function captainXpOf(log) {
  if (!log || typeof log !== 'object') return 0;
  let xp = 0;
  for (const [trade, w] of Object.entries(CAPTAIN_XP.sunk)) xp += n0(log.sunk?.[trade]) * w;
  for (const [trade, w] of Object.entries(CAPTAIN_XP.taken)) xp += n0(log.taken?.[trade]) * w;
  xp += n0(log.repelled) * CAPTAIN_XP.repelled + n0(log.claimed) * CAPTAIN_XP.claimed;
  for (const v of Object.values(log.contracts ?? {})) xp += n0(v) * CAPTAIN_XP.contract;
  xp += Math.floor(n0(log.sailed) / LEAGUE_M) * CAPTAIN_XP.league;
  xp += n0(log.maps) * CAPTAIN_XP.map + n0(log.islands) * CAPTAIN_XP.island + n0(log.deepest) * CAPTAIN_XP.deep;
  xp += Math.floor(n0(log.traded) / TRADED_GOLD) * CAPTAIN_XP.traded;
  return Math.floor(xp);
}
/** The XP level `L` begins at - 100 x (L - 1)^1.6: level 2 at 100, 10 at 3,363, 20 at 11,117, 30 at 21,869. */
export const xpForLevel = (L) => (L <= 1 ? 0 : Math.round(100 * (L - 1) ** 1.6));
/** A captain's level for their XP, 1 to CAPTAIN_LEVEL_MAX. */
export function levelOf(xp) {
  let L = 1;
  while (L < CAPTAIN_LEVEL_MAX && n0(xp) >= xpForLevel(L + 1)) L++;
  return L;
}
/** The points a level gives: one a level past the first. */
export const starPoints = (level) => Math.max(0, Math.min(CAPTAIN_LEVEL_MAX, level | 0) - 1);
/** A captain's whole reading: `{ xp, level, points, next }` - `next` the XP the next level begins at (null at the top). */
export function captainOf(log) {
  const xp = captainXpOf(log), level = levelOf(xp);
  return { xp, level, points: starPoints(level), next: level < CAPTAIN_LEVEL_MAX ? xpForLevel(level + 1) : null };
}

/**
 * THE STATS a star can carry, each a share of the ship's own number: `way` her way under sail, `oars` under oars, `turn`
 * her helm's swing, `cargo` her hold, `hull` her hull and canvas, `repair` her repairs' pace, `trade` the share of the
 * exchange's spread her dealing closes (systems/naval/tradeGoods.js exchangeOf - never past its TRADE_MOST, so the exchange
 * still buys under what it sells); `harm` her guns' harm, `reload` off their reload, `aim` her gun crews' skill, `grape`
 * grapeshot's men, `chain` chain shot's canvas, `heated` heated shot's chance of fire, `boarders` hands more over the rail,
 * `ram` her ram's harm, `foul` seconds more a ram fouls a ship.
 */
export const CAPTAIN_STATS = Object.freeze(['way', 'oars', 'turn', 'cargo', 'hull', 'repair', 'trade', 'harm', 'reload', 'aim', 'grape', 'chain', 'heated', 'boarders', 'ram', 'foul']);

/** Where a path's stars stand: its bearing (degrees, 0 up, clockwise) and each star's distance out. */
const RING = Object.freeze([150, 270, 390, 510, 640]);
const at = (deg, r) => { const a = (deg * Math.PI) / 180; return [Math.round(Math.sin(a) * r), Math.round(-Math.cos(a) * r)]; };
/** A path's stars: `[id, kind, stats]` from the Helm out along bearing `deg`, each joined to the one before. */
function path(sec, deg, stars, from = 'helm') {
  return stars.map(([id, kind, stats], i) => ({ id, sec, kind, stats: Object.freeze(stats), pos: at(deg, RING[i]), links: [i === 0 ? from : stars[i - 1][0]] }));
}
/**
 * THE SKY: THE HELM, and eight paths - THE MASTER's four to the left (her canvas, her oars and helm, her hold and her trade,
 * her shipwright's), THE COMMANDER's four to the right (the guns' drill, their aim, the shot locker, the boarders and the
 * ram). Each star `{ id, sec, kind, stats, pos: [x, y], links }`; notables of paths side by side joined across.
 */
export const CAPTAIN_STARS = Object.freeze([
  { id: 'helm', sec: 'helm', kind: 'start', stats: Object.freeze({}), pos: [0, 0], links: [] },
  // THE MASTER
  ...path('master', 225, [['m_way1', 'small', { way: 0.03 }], ['m_way2', 'small', { way: 0.03 }], ['m_clean', 'notable', { way: 0.06 }], ['m_way3', 'small', { way: 0.03 }], ['m_wind', 'keystone', { way: 0.12, oars: -0.12 }]]),
  ...path('master', 255, [['m_oar1', 'small', { oars: 0.05 }], ['m_turn1', 'small', { turn: 0.06 }], ['m_quick', 'notable', { turn: 0.12, oars: 0.05 }], ['m_oar2', 'small', { oars: 0.05 }]]),
  ...path('master', 285, [['m_hold1', 'small', { cargo: 0.06 }], ['m_hold2', 'small', { cargo: 0.06 }], ['m_deep', 'notable', { cargo: 0.12 }], ['m_trade1', 'small', { trade: 0.2 }], ['m_prince', 'keystone', { cargo: 0.25, trade: 0.3, harm: -0.1 }]]),
  ...path('master', 315, [['m_hull1', 'small', { hull: 0.04 }], ['m_rep1', 'small', { repair: 0.15 }], ['m_oak', 'notable', { hull: 0.08, repair: 0.1 }], ['m_hull2', 'small', { hull: 0.04 }], ['m_iron', 'keystone', { hull: 0.2, way: -0.08 }]]),
  // THE COMMANDER
  ...path('commander', 45, [['c_rel1', 'small', { reload: 0.03 }], ['c_rel2', 'small', { reload: 0.03 }], ['c_drill', 'notable', { reload: 0.06 }], ['c_harm1', 'small', { harm: 0.04 }], ['c_line', 'keystone', { harm: 0.15, reload: -0.1 }]]),
  ...path('commander', 75, [['c_aim1', 'small', { aim: 0.06 }], ['c_aim2', 'small', { aim: 0.06 }], ['c_long', 'notable', { aim: 0.12 }], ['c_harm2', 'small', { harm: 0.04 }]]),
  // the shot locker forks: grape and chain each off the locker, heated shot past grape (and across from chain)
  ...path('commander', 105, [['c_shot1', 'small', { harm: 0.03 }]]),
  { id: 'c_grape', sec: 'commander', kind: 'notable', stats: Object.freeze({ grape: 0.3 }), pos: at(92, 290), links: ['c_shot1'] },
  { id: 'c_chain', sec: 'commander', kind: 'notable', stats: Object.freeze({ chain: 0.3 }), pos: at(118, 290), links: ['c_shot1'] },
  { id: 'c_hot', sec: 'commander', kind: 'notable', stats: Object.freeze({ heated: 0.5 }), pos: at(105, 430), links: ['c_grape'] },
  ...path('commander', 135, [['c_board1', 'small', { boarders: 1 }], ['c_ram1', 'small', { ram: 0.2 }], ['c_irons', 'notable', { foul: 8, boarders: 1 }], ['c_board2', 'small', { boarders: 1 }], ['c_creed', 'keystone', { boarders: 2, hull: -0.1 }]]),
].map((s) => Object.freeze({ ...s, pos: Object.freeze(s.pos) })));
/** The stars joined across paths: each path's notable to its neighbour's. */
export const CAPTAIN_CROSS = Object.freeze([['m_clean', 'm_quick'], ['m_quick', 'm_deep'], ['m_deep', 'm_oak'], ['c_drill', 'c_long'], ['c_long', 'c_grape'], ['c_chain', 'c_hot'], ['c_hot', 'c_irons']]);
const BY_ID = new Map(CAPTAIN_STARS.map((s) => [s.id, s]));
/** A star by its id, or null. */
export const starOf = (id) => BY_ID.get(id) ?? null;
/** Every line of the sky, `[a, b]` once each. */
export const CAPTAIN_EDGES = Object.freeze([...CAPTAIN_STARS.flatMap((s) => s.links.map((l) => Object.freeze([l, s.id]))), ...CAPTAIN_CROSS.map((e) => Object.freeze([...e]))]);
const NEIGHBOURS = new Map(CAPTAIN_STARS.map((s) => [s.id, new Set()]));
for (const [a, b] of CAPTAIN_EDGES) { NEIGHBOURS.get(a).add(b); NEIGHBOURS.get(b).add(a); }
/** The stars beside `id`. */
export const neighboursOf = (id) => [...(NEIGHBOURS.get(id) ?? [])];

/** A held sky through its door: the Helm, and only known stars, once each, each joined to the Helm through held stars -
 *  no more than `points` past the Helm, the earliest asked first. Its order is one a captain could have set them in (each
 *  beside one before it), whatever order they were asked in - a sky with a star taken back out of its middle keeps every
 *  star still joined. Pure. */
export function heldStars(ids, points = Infinity) {
  const want = [];
  for (const id of Array.isArray(ids) ? ids : []) if (typeof id === 'string' && id !== 'helm' && BY_ID.has(id) && !want.includes(id)) want.push(id);
  const out = ['helm'];
  const seen = new Set(out);
  for (let grew = true; grew && out.length - 1 < points;) {
    grew = false;
    for (const id of want) {
      if (out.length - 1 >= points) break;
      if (seen.has(id) || !neighboursOf(id).some((n) => seen.has(n))) continue;
      seen.add(id); out.push(id); grew = true;
    }
  }
  return out;
}
/** Whether `id` can be taken now: a known star not held, beside one held, with a point left. */
export function takeable(held, id, points) {
  const h = new Set(heldStars(held));
  return BY_ID.has(id) && !h.has(id) && neighboursOf(id).some((n) => h.has(n)) && h.size - 1 < points;
}
/** The stars a star given back takes with it: itself first, then every held star joined to the Helm only through it - [] for
 *  the Helm, or a star not held. Pure. */
export function takesBack(held, id) {
  const h = new Set(heldStars(held));
  if (id === 'helm' || !h.has(id)) return [];
  h.delete(id);
  const reach = new Set(['helm']);
  const stack = ['helm'];
  while (stack.length) for (const n of neighboursOf(stack.pop())) if (h.has(n) && !reach.has(n)) { reach.add(n); stack.push(n); }
  return [id, ...[...h].filter((x) => !reach.has(x))];
}
/** Whether `id` can be given back alone: held, not the Helm, and every other held star still joined to the Helm without it. */
export const refundable = (held, id) => takesBack(held, id).length === 1;
/** The shortest way from the held sky to `id` (the stars to take, nearest first) - [] when held, null where none. */
export function wayTo(held, id) {
  const h = new Set(heldStars(held));
  if (!BY_ID.has(id)) return null;
  if (h.has(id)) return [];
  const from = new Map();
  const queue = [...h];
  for (const q of queue) from.set(q, null);
  while (queue.length) {
    const cur = queue.shift();
    for (const n of neighboursOf(cur)) {
      if (from.has(n)) continue;
      from.set(n, cur);
      if (n === id) { const way = []; for (let x = n; x && !h.has(x); x = from.get(x)) way.unshift(x); return way; }
      queue.push(n);
    }
  }
  return null;
}
/** THE STATS of a held sky - each of CAPTAIN_STATS summed over its stars (0 where none carry it). */
export function starStats(held) {
  const out = Object.fromEntries(CAPTAIN_STATS.map((k) => [k, 0]));
  for (const id of heldStars(held)) for (const [k, v] of Object.entries(starOf(id).stats)) out[k] = Math.round((out[k] + v) * 10000) / 10000;
  return Object.freeze(out);
}
/** A stat's multiple of the ship's own number (1 + its share, never under 0.1) - what the seams multiply by. */
export const statScale = (stats, key) => Math.max(0.1, 1 + (Number(stats?.[key]) || 0));

// ── WHERE THE STARS ARE READ ─────────────────────────────────────────────────────────────────────────────────────────
// Each seam multiplies the ship's own number as it is read - never written into her record, so a sky changed is her
// next reading, and a ship of another captain (a peer's, the sea's) reads none of mine.

/** The least a stat's reload multiple comes to (a gun is never loaded in no time). */
export const RELOAD_LEAST = 0.5;

/**
 * Her refits (systems/fleet.js refitOf: `{ cargo, speed, hull, guns }`) as her captain's stars better them - her hold, her
 * way under sail, her hull and canvas, her shot's harm - with her oars' way and her helm's swing besides (`oars`, `turn`:
 * Come Sail Away's moveSpeed and turnSpeed, scenes/fleetHost.js refit). Pure; a refit of none is none.
 */
export function captainRefit(refit, stats) {
  if (!refit) return refit;
  return {
    ...refit,
    cargo: refit.cargo * statScale(stats, 'cargo'), speed: refit.speed * statScale(stats, 'way'), hull: refit.hull * statScale(stats, 'hull'),
    guns: refit.guns * statScale(stats, 'harm'), oars: statScale(stats, 'oars'), turn: statScale(stats, 'turn'),
  };
}
/**
 * Her crew's worth (systems/naval/shipCrew.js crewWorth's) as her captain's stars drill them: her guns' reload (`reload`,
 * a multiple of it - never under RELOAD_LEAST), her hands' mending (`mend`, by `repair`) and the hands she sends over the
 * rail (`hands`, by `boarders`). Pure.
 */
export function captainWorth(worth, stats) {
  if (!stats) return worth;
  const n = (k) => Number(stats[k]) || 0;
  return { ...worth, reload: Math.max(RELOAD_LEAST, worth.reload * (1 - n('reload'))), mend: worth.mend * statScale(stats, 'repair'), hands: Math.max(0, worth.hands + Math.round(n('boarders'))) };
}
/**
 * A ball of the captain's as it strikes (scenes/naval/navalHost.js loadedGun): the gun it fired from (shotKinds.js shotGun's
 * row for its load) with the shot locker's stars over it - grapeshot's men (`grape`), chain shot's canvas (`chain`), and
 * heated shot's chance of fire (`fireK`, shotKinds.js shotFireChance's multiple). Pure; another's ball, or no stars, the gun.
 * @param {string} gunKind @param {any} gun @param {string | null} shot @param {any} stats
 */
export function captainShot(gunKind, gun, shot, stats) {
  if (!gun || !stats || gunKind === 'barrel') return gun;
  const s = shot == null ? naturalShot(gunKind) : shotId(shot);
  if (s === 'grape' && stats.grape) return { ...gun, crew: gun.crew * statScale(stats, 'grape') };
  if (s === 'chain' && stats.chain) return { ...gun, sail: gun.sail * statScale(stats, 'chain') };
  if (s === 'heated' && stats.heated) return { ...gun, fireK: statScale(stats, 'heated') };
  return gun;
}
/** SHOT-KINDS: the gun a ball struck with - its bore `gun` (navalGunnery.js GUNS[gunKind]) as its load `shot` fires it
 *  (shotKinds.js shotGun; none: its bore's own), her captain's shot locker's stars over it (`stats` - a ball of mine's
 *  alone; captainShot), grapeshot's men by its time aloft `t` (shotReach). The naval host's strike reads it (AUDIT
 *  2026-10-17: out of createNavalHost - HOST-SPLIT). Pure. */
export function struckGun(gunKind, gun, shot, t, stats) {
  const g = captainShot(gunKind, shotGun(gunKind, gun, shot ?? null), shot ?? null, stats);
  if (!g) return null;
  const reach = shotReach(shot, t);
  return reach < 1 ? { ...g, crew: g.crew * reach } : g;
}
