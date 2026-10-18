// @ts-check
// RVN-STARS (2026-10-17, the owner: "develop a firmament style tree for revenants. Just like we did for ships and
// characters"; bible/06-Systems/Revenants.md section 44) - A SWORN REVENANT'S STARS. The port's own; pure.
//
// EACH SWORN ONE GROWS ITS OWN SKY. Its level is earned at the player's side and kept on its oath (`companion.xp` - a
// fight won beside the player, by the foe's level; an errand come home, by its days and its danger, while it is under
// RVN_XP.ERRAND_LEVEL_MOST), up a curve to RVN_LEVEL_MAX (`rvnLevelOf`). A POINT A LEVEL past the first, and one for each
// rank past the first it was sworn at (a rank V revenant - one that rose four times - comes to the oath with four), buys
// a star on its sky - the Firmament's shape
// (bible/06-Systems/Firmament.md) as CAPTAIN-TREE made it a sky of its own (systems/naval/captainTree.js): a start in the
// middle, paths of small stars to notables and keystones, a star bought only beside one held.
//
// THE OATH in the middle (held by every sworn one), and three aspects about it:
//   THE BLADE (above) - its body: its health and its blows;
//   THE GRAVE (right) - its art: its weight and how soon it comes again, and AWAKENED ART, which teaches an art of its
//     kind to one born without (systems/revenant/revenantArts.js artOf);
//   THE ROAD (left) - its errands and its oath: the odds and the haul abroad, the road's days, the loyalty it loses, the
//     rest it needs.
// Each path but the Rite runs small stars to a notable and on to a KEYSTONE that gives much and costs a little; the six
// notables are joined in a ring (Awakened Art the Grave's own link between its two).
//
// A STAR TAKEN BACK takes with it every star joined to the Oath only through it - free, at any time but abroad (its sky is
// set at the player's side): CAPTAIN-TREE's law, a revenant's sky relearned on the road, not bought back.
//
// WHAT THE STARS DO is one sum of stats (`rvnStarStats`, each a share, each kept within RVN_STAR_LEAST..RVN_STAR_MOST),
// read where the revenant's own numbers are read: its health and blows where its body stands (revenantCompanions.js
// applySwornStrength - and, AUDIT RVN-STARS S1, the whole its oath carries between stands rescaled when its sky changes),
// its art's weight and its cooldowns (revenantArts.js swornArtNumbers), an errand's odds, haul and road (revenantErrands.js -
// taken onto the errand as it sets out, AUDIT RVN-STARS S2/S3: `rvnErrandSky`), its loyalty's losses (`rvnLoyaltyMove`, its
// fraction carried - S6) and its rests (revenantCompanions.js, revenant.js's day). A hostile revenant has no oath, so none.

/** What a level is earned by: WON a fight won at the player's side, and WON_PER more a level of the foe it fought (to
 *  WON_LEVEL_MOST); ERRAND an errand come home, a day of its road a danger (HARD_SHARE of it for a hard road - the
 *  errand's own law, revenantErrands.js ERRAND.HARD_SHARE), paid only under ERRAND_LEVEL_MOST - AUDIT RVN-STARS S11: the
 *  road teaches a revenant only so much (offline a rest carries an errand on, DFU's one clock, and its XP was a farm). */
export const RVN_XP = Object.freeze({ WON: 5, WON_PER: 1, WON_LEVEL_MOST: 30, ERRAND: 15, HARD_SHARE: 0.5, ERRAND_LEVEL_MOST: 10 });
export const RVN_LEVEL_MAX = 20;

const n0 = (v) => (Number.isFinite(v) && v > 0 ? v : 0);
/** The XP a fight won is worth, by the level of the foe fought. */
export const rvnXpWon = (foeLevel) => RVN_XP.WON + RVN_XP.WON_PER * Math.min(RVN_XP.WON_LEVEL_MOST, Math.max(1, Math.floor(n0(foeLevel)) || 1));
/** The XP an errand home is worth: the days of its own road (its place's, less its `road` - AUDIT RVN-STARS S16) times its
 *  danger (revenantErrands.js ERRAND_PLACES), half a hard road's. */
export const rvnXpErrand = (place, won, road = 0) => Math.floor(RVN_XP.ERRAND * n0(place?.days) * (1 - (Number(road) || 0)) * n0(place?.danger) * (won ? 1 : RVN_XP.HARD_SHARE));
/** The XP level `L` begins at - 75 x (L - 1)^1.7 (AUDIT RVN-STARS S13: CAPTAIN-TREE's pace at the top): level 2 at 75, 5 at
 *  792, 10 at 3,142, 15 at 6,660, 20 at 11,193. */
export const rvnXpForLevel = (L) => (L <= 1 ? 0 : Math.round(75 * (L - 1) ** 1.7));
/** The most XP a record keeps: the top level's (AUDIT RVN-STARS S12 - a hand-made 3e9 wrapped past 2^31 at the next win). */
export const RVN_XP_MOST = rvnXpForLevel(RVN_LEVEL_MAX);
/** A record's XP read back: a whole number, 0 to RVN_XP_MOST. */
export const rvnXpOf = (v) => Math.min(RVN_XP_MOST, Math.floor(n0(Number(v))));
/** A sworn one's level for its XP, 1 to RVN_LEVEL_MAX. */
export function rvnLevelOf(xp) {
  let L = 1;
  while (L < RVN_LEVEL_MAX && n0(xp) >= rvnXpForLevel(L + 1)) L++;
  return L;
}
/** The points a level and a rank give: one a level past the first, one a rank past the first (rank 1 to 5). */
export const rvnStarPoints = (level, rank) => Math.max(0, Math.min(RVN_LEVEL_MAX, level | 0) - 1) + Math.max(0, Math.min(5, rank | 0) - 1);
/** A sworn one's whole reading: `{ xp, level, points, next, set }` - `next` the XP its next level begins at (null at the
 *  top), `set` the stars it holds past the Oath. A record with no oath is level 1 with its rank's points. */
export function rvnStarsOf(r) {
  const xp = rvnXpOf(r?.companion?.xp), level = rvnLevelOf(xp);
  const held = Array.isArray(r?.companion?.stars) ? r.companion.stars : ['oath'];
  return { xp, level, points: rvnStarPoints(level, r?.rank ?? 1), next: level < RVN_LEVEL_MAX ? rvnXpForLevel(level + 1) : null, set: Math.max(0, held.length - 1) };
}

/**
 * THE STATS a star can carry: `health` a share of its health, `blows` of its blows' harm; `art` its art's weight (a
 * heal's share, a ward's or a cry's points, a strike's harm), `haste` a share off its art's cooldowns, `awaken` an art
 * taught to one born without; `odds` its strength abroad (revenantErrands.js errandPower - ERRAND.ODDS.PER a point), `haul`
 * a share more of an errand's gold and goods (never its pieces), `road` a share off an errand's days, `bold` a hard road
 * bringing back nothing (AUDIT RVN-STARS S5 - Fortune's Road's price), `loyal` a share off every loyalty it loses, `rest`
 * a share off every rest it needs.
 */
export const RVN_STAR_STATS = Object.freeze(['health', 'blows', 'art', 'haste', 'awaken', 'odds', 'haul', 'road', 'bold', 'loyal', 'rest']);
/** The most a whole sky gives of each - the law's guard for a star a later sky adds (AUDIT RVN-STARS S18: the body's too). */
export const RVN_STAR_MOST = Object.freeze({ health: 0.5, blows: 0.4, art: 0.4, haste: 0.25, awaken: 1, odds: 0.5, haul: 0.4, road: 0.15, bold: 1, loyal: 0.5, rest: 0.5 });

/** Where a path's stars stand: each star's distance out (CAPTAIN-TREE's rings). */
const RING = Object.freeze([150, 270, 390, 510, 640]);
const at = (deg, r) => { const a = (deg * Math.PI) / 180; return [Math.round(Math.sin(a) * r), Math.round(-Math.cos(a) * r)]; };
/** A path's stars: `[id, kind, stats]` from the Oath out along bearing `deg`, each joined to the one before. */
function path(sec, deg, stars) {
  return stars.map(([id, kind, stats], i) => ({ id, sec, kind, stats: Object.freeze(stats), pos: at(deg, RING[i]), links: [i === 0 ? 'oath' : stars[i - 1][0]] }));
}
/**
 * THE SKY: THE OATH, and six paths - THE BLADE's two above (its flesh, its fury), THE GRAVE's two to the right (its art's
 * power, its rite's haste) with AWAKENED ART between their notables, THE ROAD's two to the left (the road abroad, the
 * oath kept). Each star `{ id, sec, kind, stats, pos: [x, y], links }`.
 */
export const RVN_STARS = Object.freeze([
  { id: 'oath', sec: 'oath', kind: 'start', stats: Object.freeze({}), pos: [0, 0], links: [] },
  // THE BLADE
  ...path('blade', 330, [['b_hp1', 'small', { health: 0.05 }], ['b_hp2', 'small', { health: 0.05 }], ['b_iron', 'notable', { health: 0.1 }], ['b_hp3', 'small', { health: 0.05 }], ['b_deathless', 'keystone', { health: 0.25, blows: -0.1 }]]),
  ...path('blade', 30, [['b_bl1', 'small', { blows: 0.04 }], ['b_bl2', 'small', { blows: 0.04 }], ['b_relent', 'notable', { blows: 0.08 }], ['b_bl3', 'small', { blows: 0.04 }], ['b_rage', 'keystone', { blows: 0.2, health: -0.1 }]]),
  // THE GRAVE
  ...path('grave', 90, [['g_pow1', 'small', { art: 0.05 }], ['g_pow2', 'small', { art: 0.05 }], ['g_focus', 'notable', { art: 0.1 }], ['g_pow3', 'small', { art: 0.05 }], ['g_pact', 'keystone', { art: 0.15, health: -0.1 }]]),
  ...path('grave', 150, [['g_hst1', 'small', { haste: 0.05 }], ['g_hst2', 'small', { haste: 0.05 }], ['g_rite', 'notable', { haste: 0.1 }], ['g_hst3', 'small', { haste: 0.05 }]]),
  { id: 'g_wake', sec: 'grave', kind: 'notable', stats: Object.freeze({ awaken: 1 }), pos: at(120, 470), links: ['g_focus', 'g_rite'] },
  // THE ROAD
  ...path('road', 210, [['r_odd1', 'small', { odds: 0.3 }], ['r_haul1', 'small', { haul: 0.05 }], ['r_far', 'notable', { road: 0.15, odds: 0.2 }], ['r_haul2', 'small', { haul: 0.05 }], ['r_fortune', 'keystone', { haul: 0.3, bold: 1 }]]),
  ...path('road', 270, [['r_loy1', 'small', { loyal: 0.1 }], ['r_rest1', 'small', { rest: 0.1 }], ['r_bound', 'notable', { loyal: 0.2 }], ['r_rest2', 'small', { rest: 0.1 }], ['r_vigil', 'keystone', { rest: 0.3, loyal: 0.2, road: -0.1 }]]),
].map((s) => Object.freeze({ ...s, pos: Object.freeze(s.pos), links: Object.freeze(s.links) })));
/** The notables' ring: each aspect's two joined, and each aspect to the next (the Grave's through Awakened Art). */
export const RVN_STAR_CROSS = Object.freeze([['b_iron', 'b_relent'], ['b_relent', 'g_focus'], ['g_rite', 'r_far'], ['r_far', 'r_bound'], ['r_bound', 'b_iron']]);
const BY_ID = new Map(RVN_STARS.map((s) => [s.id, s]));
/** A star by its id, or null. */
export const rvnStarOf = (id) => BY_ID.get(id) ?? null;
/** Every line of the sky, `[a, b]` once each. */
export const RVN_STAR_EDGES = Object.freeze([...RVN_STARS.flatMap((s) => s.links.map((l) => Object.freeze([l, s.id]))), ...RVN_STAR_CROSS.map((e) => Object.freeze([...e]))]);
const NEIGHBOURS = new Map(RVN_STARS.map((s) => [s.id, new Set()]));
for (const [a, b] of RVN_STAR_EDGES) { NEIGHBOURS.get(a).add(b); NEIGHBOURS.get(b).add(a); }
/** The stars beside `id`. */
export const rvnNeighboursOf = (id) => [...(NEIGHBOURS.get(id) ?? [])];

/** A held sky through its door: the Oath, and only known stars, once each, each joined to the Oath through held stars -
 *  no more than `points` past the Oath, the earliest asked first, in an order it could have set them in (CAPTAIN-TREE's
 *  heldStars). Pure. */
export function rvnHeldStars(ids, points = Infinity) {
  points = Math.floor(points);   // AUDIT RVN-STARS S17: a point is whole
  const want = [];
  for (const id of Array.isArray(ids) ? ids : []) if (typeof id === 'string' && id !== 'oath' && BY_ID.has(id) && !want.includes(id)) want.push(id);
  const out = ['oath'];
  const seen = new Set(out);
  for (let grew = true; grew && out.length - 1 < points;) {
    grew = false;
    for (const id of want) {
      if (out.length - 1 >= points) break;
      if (seen.has(id) || !rvnNeighboursOf(id).some((n) => seen.has(n))) continue;
      seen.add(id); out.push(id); grew = true;
    }
  }
  return out;
}
/** The stars a star given back takes with it: itself first, then every held star joined to the Oath only through it - []
 *  for the Oath, or a star not held. Pure. */
export function rvnTakesBack(held, id) {
  const h = new Set(rvnHeldStars(held));
  if (id === 'oath' || !h.has(id)) return [];
  h.delete(id);
  const reach = new Set(['oath']);
  const stack = ['oath'];
  while (stack.length) for (const n of rvnNeighboursOf(stack.pop())) if (h.has(n) && !reach.has(n)) { reach.add(n); stack.push(n); }
  return [id, ...[...h].filter((x) => !reach.has(x))];
}
/** The shortest way from the held sky to `id` (the stars to take, nearest first) - [] when held, null where none. */
export function rvnWayTo(held, id) {
  const h = new Set(rvnHeldStars(held));
  if (!BY_ID.has(id)) return null;
  if (h.has(id)) return [];
  const from = new Map();
  const queue = [...h];
  for (const q of queue) from.set(q, null);
  while (queue.length) {
    const cur = queue.shift();
    for (const n of rvnNeighboursOf(cur)) {
      if (from.has(n)) continue;
      from.set(n, cur);
      if (n === id) { const way = []; for (let x = n; x && !h.has(x); x = from.get(x)) way.unshift(x); return way; }
      queue.push(n);
    }
  }
  return null;
}
/** The least a whole sky gives of each - its keystones' prices together (a sum the bounds keep a sum under). */
export const RVN_STAR_LEAST = Object.freeze(Object.fromEntries(RVN_STAR_STATS.map((k) => [k, Math.round(RVN_STARS.reduce((n, s) => n + Math.min(0, s.stats[k] ?? 0), 0) * 10000) / 10000])));
/** THE STATS of a held sky - each of RVN_STAR_STATS summed over its stars, kept within RVN_STAR_LEAST..RVN_STAR_MOST (0
 *  where none). */
export function rvnStarStats(held) {
  const out = Object.fromEntries(RVN_STAR_STATS.map((k) => [k, 0]));
  for (const id of rvnHeldStars(held)) for (const [k, v] of Object.entries(rvnStarOf(id).stats)) out[k] = Math.round((out[k] + v) * 10000) / 10000;
  for (const k of RVN_STAR_STATS) out[k] = Math.max(RVN_STAR_LEAST[k], Math.min(RVN_STAR_MOST[k], out[k]));
  return Object.freeze(out);
}
const NONE = rvnStarStats(['oath']);
/** What a record's stars do - its oath's sky, no more of it than its points hold (AUDIT RVN-STARS S17); none for a record
 *  not sworn. */
export const rvnStatsOf = (r) => (r?.sworn && Array.isArray(r.companion?.stars) ? rvnStarStats(rvnHeldStars(r.companion.stars, rvnStarsOf(r).points)) : NONE);
/** A stat's multiple of the revenant's own number (1 + its share, never under 0.1) - what the seams multiply by. */
export const rvnStatScale = (stats, key) => Math.max(0.1, 1 + (Number(stats?.[key]) || 0));
/** Whether a record's sky holds Awakened Art - through the door, as every stat is (AUDIT RVN-STARS S17). */
export const rvnAwakened = (r) => rvnStatsOf(r).awaken > 0;
/**
 * A loyalty move `d` as its oath bears it: a gain whole; a loss less by its `loyal` share, the fraction carried on its oath
 * (`c.lossCarry`, -1..0) to the next loss - AUDIT RVN-STARS S6: rounded each time, a day away's -0.9 was -1 and -0.5 none,
 * so every share under a half did nothing to it and a half made it never desert. Answers the whole points to move; `c`
 * the companion it is moved on (the record's, by default).
 */
export function rvnLoyaltyMove(r, d, c = r?.companion) {
  if (!(d < 0)) return d;
  const exact = d * (1 - rvnStatsOf(r).loyal) + (Number.isFinite(c?.lossCarry) ? c.lossCarry : 0);
  const whole = Math.ceil(exact - 1e-9);
  if (c) c.lossCarry = Math.round((exact - whole) * 1e6) / 1e6;
  return whole;
}
/** A rest of `minutes` as its sky shortens it (`rest`), whole minutes. */
export const rvnRestMinutes = (r, minutes) => Math.round(minutes * (1 - rvnStatsOf(r).rest));
/** AUDIT RVN-STARS S2, S3: AN ERRAND'S SKY, taken onto it as it sets out (revenantErrands.js newErrand) - its odds, its haul,
 *  its road and whether a hard road brings back nothing - so its stars can change neither its length nor its haul while it is
 *  gone (a reload of a save made abroad set them from a later sky). */
export const rvnErrandSky = (r) => { const s = rvnStatsOf(r); return Object.freeze({ odds: s.odds, haul: s.haul, road: s.road, bold: s.bold > 0 }); };
/** An errand's sky read back: each number within its bounds, else none. */
export function rvnErrandSkyOf(v) {
  if (!v || typeof v !== 'object') return null;
  const n = (k) => Math.max(RVN_STAR_LEAST[k], Math.min(RVN_STAR_MOST[k], Number.isFinite(v[k]) ? v[k] : 0));
  return Object.freeze({ odds: n('odds'), haul: n('haul'), road: n('road'), bold: v.bold === true });
}
