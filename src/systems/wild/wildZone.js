// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WILD1 (2026-10-07) - THE OPEN ZONE: THE WROTHGARIAN MOUNTAINS (bible/11-Multiplayer/Wild-Zone.md).
//
// The owner: "Wrothgarian mountains need to be turned into a open pvp zone ... The zone needs to be marked on the map
// players cant see each others near and in that zone. Mobs are 4x stronger (even elites and champions) and drop 100%
// better loot. Same goes for dungeons." - and, asked what "100% better" is: "twice gold and twice the dropchance for
// rarity items and double drops".
//
// WHAT THE ZONE IS: WW-C2 (2026-10-24, bible/03-World/World-Wide.md WW-C; the owner: "Cyrodil becomes the new open PvP
// area with the wrothgarian mountain area being retired in favor of this. Cryodil will be home to all abundent resources
// and everything else from the wrothgarian zone") - CYRODIIL, the Imperial Province past the Bay: every map pixel of its
// land (systems/wild/cyrodiilZone.js, the province's own picture), and every place in it. It was the Wrothgarian
// Mountains (region 16 of the Bay, the owner's cut, Wrothgaria kept out) from WILD1 to WW-C2: that zone is retired, the
// mountains Daggerfall's own again. NEAR it: within WILD_NEAR_PX map pixels of its edge (the maps' hiding reaches that
// far, so a player cannot be watched from just over the line).
//
// ONLINE ALONE: offline there is no other player, so no fight between players, no remains and no one to hide from -
// and the zone's harder foes and richer loot are the price and the prize of that danger, so offline the province is
// the world's own (the death penalty's law, systems/deathPenalty.js: "online mode only").
//
// THIS FILE IS A LEAF: the region test, the mask the maps paint and hide by, the numbers, and the one live flag the
// pools read at a spawn (`wildHere`, set by the world host each frame). It imports nothing but the text core (itself a
// leaf - MAC, 2026-10-14: the escrow's words are the player's language's, L10N4) and the region table (formats/, a leaf),
// so every pool can read it. The province's own mask is cyrodiilZone.js's (the picture's law is not a leaf's).
// ═══════════════════════════════════════════════════════════════════
import { t } from '../textManager.js';
import { isLetterOfCredit } from '../peerWord.js';   // BURNT-SAID: the letters a death took, by their worth
import { CYRODIIL_REGION } from '../../formats/mapsTables.js';   // WW-C2: the zone's region, one home

/** WW-C2: Cyrodiil - the Imperial Province's region past the Bay (formats/mapsTables.js CYRODIIL_REGION); the
 *  Wrothgarian Mountains' 16 retired. */
export const WILD_REGION = CYRODIIL_REGION;
/** The zone's name as a sentence says it - a name of its own, no article ("You enter Cyrodiil"). */
export const WILD_NAME = 'Cyrodiil';
/** The owner's four: a foe's health and its blows. Elites and champions are built first and then this, so theirs too. */
export const WILD_FOE_HEALTH_MULT = 4;
export const WILD_FOE_DAMAGE_MULT = 4;
/** "Twice gold and twice the dropchance for rarity items and double drops" - THE HEART'S (WILD2: the innermost ring). */
export const WILD_LOOT_GOLD_MULT = 2;
export const WILD_LOOT_DROP_MULT = 2;
export const WILD_LOOT_RARE_MULT = 2;
/**
 * WILD2 (2026-10-07, the owner: "give the zone 4 levels from the outerside to the inside 25% of the zone are 25% more
 * loot when you go in deeper 50% more loot then 75 and when youre in the middle 25% 100% more loot"): THE RINGS. A
 * pixel's depth is its distance from the zone's edge over the deepest pixel's; the outer quarter of that depth is ring
 * 1, the heart's quarter ring 4. A ring's loot is every multiplier above at `WILD_RING_LOOT[ring - 1]` - the heart's
 * the owner's "twice" exactly. The foes are four times as strong in every ring.
 */
export const WILD_RINGS = 4;
export const WILD_RING_LOOT = Object.freeze([1.25, 1.5, 1.75, 2]);
/** A ring's loot multiplier (1-4; anything else the heart's - a caller that cannot say is never paid less). */
export const wildRingLoot = (ring) => WILD_RING_LOOT[(ring | 0) - 1] ?? WILD_RING_LOOT[WILD_RINGS - 1];
/** A ring's word for the maps and the HUD. */
export const wildRingName = (ring) => ['The Borderlands', 'The Wilds', 'The Heartlands', 'The Heart'][(ring | 0) - 1] ?? 'The Heart';   // WW-C2: Cyrodiil's, its border to the Imperial heart (the mountains' Foothills to High Crags retired)
export const wildRingBonus = (ring) => `+${Math.round((wildRingLoot(ring) - 1) * 100)}% loot`;
/** "has to wait 2mins till respawn" - and a killer's body lies as long. */
export const WILD_DEATH_HOLD_S = 120;
/** A blow from another player this recent at the death names them the killer (a lingering spell, a foe's last swing
 *  after a player's - the player who brought you down). */
export const WILD_KILL_CREDIT_MS = 10_000;
/** How far from the zone's edge the maps still hide a player, in map pixels (one is ~820 m). */
export const WILD_NEAR_PX = 6;

/** WILD3 (2026-10-07, the owner: "fast traveling via carriage inside the zone costs 2,5k gold and has a 10minute cool
 *  down. you cant fast travel out and into the zone. Same for all other fast travel options except the overworld map"):
 *  the fee and the wait of every fast journey that starts and ends inside the zone. */
export const WILD_TRAVEL_FEE = 2500;
/** PVPTIERS: a fast journey inside the zone costs by the tier it lands in - 2.5k, 5k, 10k, 15k. */
export const WILD_TRAVEL_FEES = Object.freeze([2500, 5000, 10000, 15000]);
export const wildTravelFee = (ring) => WILD_TRAVEL_FEES[Math.max(1, Math.min(4, ring | 0 || 1)) - 1];
export const WILD_TRAVEL_COOLDOWN_MS = 10 * 60_000;

/** WILD3 (the owner: "Giants you meet there are also 4 times bigger (not in dungeons only outside). i hope there are
 *  giants to meet"): Daggerfall's Giant (MobileTypes 16) stands four times its size in the zone's open country, and a
 *  wanderer the zone's roll stands is one WILD_GIANT_CHANCE of the time - so there are giants to meet. */
export const WILD_GIANT = 16;
export const WILD_GIANT_SIZE = 4;
export const WILD_GIANT_CHANCE = 0.15;
/** PVPGIANT: at most this many giants roam the zone at once; each stands ten times the health and four times the blows
 *  over the zone's own multipliers, and drops twice an elite's. */
export const WILD_GIANT_MAX = 2;
export const WILD_GIANT_HEALTH_MULT = 10;
export const WILD_GIANT_DAMAGE_MULT = 4;
/** ZONE-WATCH: the open zone's towns post their watch ten times as strong (scenes/world.js guardScale -> scenes/cityGuards.js
 *  stands it on a watchman's health); FOE-BOUNDS reads it (net/foeBounds.js FOE_BOUND.zoneWatch). */
export const ZONE_WATCH_SCALE = 10;
/** A body's size over its sprite's: a giant of the zone's open country's four, anyone else's one. */
export const wildGiantSize = (entity) => (entity?.wildGiant ? WILD_GIANT_SIZE : 1);
/** GREATER-GIANT (2026-10-08, the owner: "Name the giant Greater Giant which spawns 10 normal gants when half health"): the
 *  zone's own giants are GREATER GIANTS - their name; at half their health, once a life, they call GREATER_GIANT_CALL
 *  giants of the ordinary kind (the zone's four times, never an elite or a champion) about them. */
export const GREATER_GIANT_NAME = 'Greater Giant';
export const GREATER_GIANT_CALL = 10;
export const GREATER_GIANT_CALL_AT = 0.5;

/** WILD3 (the owner: "when other players are near you they are counted as enemies bright red and its called stranger when
 *  you near them Like 600m away. and when youre near them like 200m it slows you down like normal enemies"): a STRANGER
 *  is another player in the zone outside my party and my guild - marked within WILD_STRANGER_M, slowing a journey within
 *  WILD_STRANGER_SLOW_M, in WILD_STRANGER_RGBA. */
export const WILD_STRANGER_M = 600;
/** STRANGER-SEE (2026-10-08, the owner: "make strangers visible at 1,5km"): a stranger is marked (the Overworld's helmet,
 *  the red) this far; the warning stays at WILD_STRANGER_M. */
export const WILD_STRANGER_SEE_M = 1500;
export const WILD_STRANGER_SLOW_M = 200;
export const WILD_STRANGER_RGBA = Object.freeze([1, 0.23, 0.18, 1]);

/** Is this region the zone? */
export const isWildRegion = (regionIndex) => regionIndex === WILD_REGION;

// ── the live flag: where the player stands now ───────────────────────────────────────────────────────────────────────
let _here = false;
let _ring = 0;
let _kind = null;
/** The world host's word each frame: the player stands in the zone, online (scenes/world.js) - and in which ring, and on
 *  which ground (ETHER-WILD, 2026-10-21: `kind` - 'cyrodiil' (WW-C2; the Wrothgarian Mountains' 'wroth' before it), 'ether' the Eltheric Ocean past
 *  Veilhaven's peace, systems/wild/etherWild.js). Every law of the zone reads the flag alike; only its words read the kind. */
export function setWildHere(on, ring = 0, kind = WILD_KIND) {
  _here = !!on; _ring = _here ? Math.max(1, Math.min(WILD_RINGS, ring | 0 || WILD_RINGS)) : 0; _kind = _here ? (kind || WILD_KIND) : null;
}
/** Does the player stand in the zone now? (The foe pools ask at a spawn, the loot rolls at a death.) */
export const wildHere = () => _here;
/** The ring the player stands in (1 the outer, 4 the heart), 0 outside. */
export const wildRing = () => _ring;
/** ETHER-WILD: the ground of the zone the player stands in - 'wroth' or 'ether' - or null outside every zone. */
export const wildZoneKind = () => _kind;

// ── ETHER-WILD: THE ZONE'S WORDS BY ITS GROUND ───────────────────────────────────────────────────────────────────────
// Cyrodiil's words are WILD_TEXT's (WW-C2; the mountains' before it). Another ground registers its own (systems/wild/etherWild.js, the Eltheric Ocean's)
// so this leaf imports nothing of it, and a word it does not name is Cyrodiil's.
/** Cyrodiil's kind (setWildHere's default) - WW-C2: the Wrothgarian Mountains' 'wroth' retired. */
export const WILD_KIND = 'cyrodiil';
/** @type {Map<string, Record<string, any>>} */
const _kindWords = new Map();
/** A ground's own words: `name` (the zone's name in a sentence), `ringName(ring)`, and any WILD_TEXT key it says its own
 *  way. */
export function registerZoneWords(kind, words) { _kindWords.set(kind, words); }   // kept as given: a getter reads its words in the language of the moment
/** A word of the zone - its ground's own, else the mountains' (WILD_TEXT's). `kind` defaults to where the player stands. */
export const zoneWord = (key, kind = _kind) => (kind ? _kindWords.get(kind)?.[key] : undefined) ?? WILD_TEXT[key];
/** The zone's name in a sentence, with its own article where it takes one (WW-C2: "Cyrodiil" none, "the Eltheric Ocean"). */
export const zoneName = (kind = _kind) => (kind ? _kindWords.get(kind)?.name : undefined) ?? WILD_NAME;
/** A ring's name on the zone's ground (the mountains': wildRingName). */
export const zoneRingName = (ring, kind = _kind) => ((kind ? _kindWords.get(kind)?.ringName : undefined) ?? wildRingName)(ring);
/** WILD2: the mask the world host registered (the maps' own) - so a host with no map of its own (a dungeon's build)
 *  reads a place's ring by its map pixel. */
let _mask = null;
export function setWildMask(mask) { _mask = mask ?? null; }
export const wildMask = () => _mask;

// ── the mask: the zone's cells and the band around them ──────────────────────────────────────────────────────────────
// WW-C2: A MASK IS A GRID OF CELLS over the world's map pixels - `cell` pixels a side from its origin (`ox`, `oy`, a world
// map pixel) - so a zone a province wide (Cyrodiil's two million pixels, systems/wild/cyrodiilZone.js) is laid on a grid
// its laws can walk. Every law that takes or answers a place takes and answers WORLD map pixels (fractions allowed): only
// the grid's own arrays and its box are its cells. A mask of cell 1 at (0, 0) is a map's own pixels, one for one.

/** The cell of world map pixel (x, y) on `mask`'s grid, [cx, cy] - off the grid where the pixel is. */
export const maskCellOf = (mask, x, y) => {
  const c = mask?.cell ?? 1;
  return [Math.floor((x - (mask?.ox ?? 0)) / c), Math.floor((y - (mask?.oy ?? 0)) / c)];
};
/** The world point of grid point (cx, cy): a cell's corner - its middle at + 0.5 a side. */
export const maskWorld = (mask, cx, cy) => {
  const c = mask?.cell ?? 1;
  return [(mask?.ox ?? 0) + cx * c, (mask?.oy ?? 0) + cy * c];
};
const onGrid = (mask, cx, cy) => cx >= 0 && cy >= 0 && cx < mask.width && cy < mask.height;
/** The zone's box on the world, map pixels `{ x0, y0, x1, y1 }` (inclusive) - its cells' box laid on the world; null for
 *  a mask with no zone. */
export function maskWorldBox(mask) {
  if (!mask?.box) return null;
  const c = mask.cell ?? 1, [x0, y0] = maskWorld(mask, mask.box.x0, mask.box.y0);
  return { x0, y0, x1: x0 + (mask.box.x1 - mask.box.x0 + 1) * c - 1, y1: y0 + (mask.box.y1 - mask.box.y0 + 1) * c - 1 };
}
/** A cell's ring - 1 (the outer quarter of the zone's depth) to 4 (its heart) - by its depth; 0 outside the zone. */
export function ringOfCell(mask, cx, cy) {
  if (!mask?.depth || !mask.maxDepth || !onGrid(mask, cx, cy)) return 0;
  const d = mask.depth[cy * mask.width + cx];
  return d ? Math.max(1, Math.min(WILD_RINGS, Math.ceil((d / mask.maxDepth) * WILD_RINGS))) : 0;
}

/**
 * The zone over a `width` x `height` grid of cells: `inside` and `near` (inside, or within `nearPx` map pixels of an
 * inside cell - a cell at the least) as one byte a cell, each inside cell's depth, and the inside's box (cells). `inZone`
 * answers a cell. Built once a zone (systems/wild/cyrodiilZone.js cyrodiilMask keeps it).
 * @param {{ width: number, height: number, inZone: (cx: number, cy: number) => boolean, ox?: number, oy?: number, cell?: number, nearPx?: number }} p
 */
export function buildWildMask({ width, height, inZone, ox = 0, oy = 0, cell = 1, nearPx = WILD_NEAR_PX }) {
  const inside = new Uint8Array(width * height);
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!inZone(x, y)) continue;
      inside[y * width + x] = 1;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  const band = Math.max(1, Math.ceil(nearPx / cell));   // WW-C2: the hiding band in cells
  const near = new Uint8Array(width * height);
  if (x1 >= 0) {
    // a separable square dilation (two passes over the box widened by the band) - a cell within the band on both axes
    const bx0 = Math.max(0, x0 - band), bx1 = Math.min(width - 1, x1 + band);
    const by0 = Math.max(0, y0 - band), by1 = Math.min(height - 1, y1 + band);
    const row = new Uint8Array(width * height);
    for (let y = y0; y <= y1; y++) {
      for (let x = bx0; x <= bx1; x++) {
        let hit = 0;
        for (let k = Math.max(0, x - band); k <= Math.min(width - 1, x + band) && !hit; k++) hit = inside[y * width + k];
        row[y * width + x] = hit;
      }
    }
    for (let y = by0; y <= by1; y++) {
      for (let x = bx0; x <= bx1; x++) {
        let hit = 0;
        for (let k = Math.max(0, y - band); k <= Math.min(height - 1, y + band) && !hit; k++) hit = row[k * width + x];
        near[y * width + x] = hit;
      }
    }
  }
  // WILD2: THE DEPTH - each inside cell's chamfer distance (3 a side, 4 a corner) from the nearest outside cell, by the
  // two-pass sweep over the box; the rings read it over the deepest
  const depth = new Uint16Array(width * height);
  let maxDepth = 0;
  if (x1 >= 0) {
    const BIG = 65000;
    const D = (x, y) => (x < 0 || y < 0 || x >= width || y >= height ? 0 : depth[y * width + x]);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) depth[y * width + x] = inside[y * width + x] ? BIG : 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * width + x;
        if (!depth[i]) continue;
        depth[i] = Math.min(depth[i], D(x - 1, y) + 3, D(x, y - 1) + 3, D(x - 1, y - 1) + 4, D(x + 1, y - 1) + 4);
      }
    }
    for (let y = y1; y >= y0; y--) {
      for (let x = x1; x >= x0; x--) {
        const i = y * width + x;
        if (!depth[i]) continue;
        depth[i] = Math.min(depth[i], D(x + 1, y) + 3, D(x, y + 1) + 3, D(x + 1, y + 1) + 4, D(x - 1, y + 1) + 4);
        if (depth[i] > maxDepth) maxDepth = depth[i];
      }
    }
  }
  return { width, height, ox, oy, cell, inside, near, depth, maxDepth, box: x1 >= 0 ? { x0, y0, x1, y1 } : null };
}

/**
 * WILD2: THE RING of world map pixel (x, y) - 1 (the outer quarter of the zone's depth) to 4 (its heart) - or 0 outside
 * the zone (or with no mask). The mask defaults to the registered one (setWildMask).
 */
export function wildRingAt(x, y, mask = _mask) {
  if (!mask) return 0;
  if (!mask.depth || !mask.maxDepth) return wildInside(mask, x, y) ? WILD_RINGS : 0;
  const [cx, cy] = maskCellOf(mask, x, y);
  return ringOfCell(mask, cx, cy);
}
const at = (mask, field, x, y) => {
  if (!mask) return false;
  const [cx, cy] = maskCellOf(mask, x, y);
  return onGrid(mask, cx, cy) && mask[field][cy * mask.width + cx] === 1;
};
/** Is world map pixel (x, y) - fractions allowed - inside the zone? */
export const wildInside = (mask, x, y) => at(mask, 'inside', x, y);
/** Is it in the zone or within its band? */
export const wildNear = (mask, x, y) => at(mask, 'near', x, y);

/**
 * THE ZONE'S EDGE as chains of world map points, for the maps' red line: every edge between an inside cell and an
 * outside one, joined end to end where they meet, each chain `[{x, y}, ...]` (WW-C2: the grid's cell corners laid on
 * the world). WILD2: with `within(cx, cy)` - a set of cells inside the zone - the edge of that set instead (a ring's
 * inner line: `wildRingChains`).
 */
export function wildEdgeChains(mask, within = null) {
  if (!mask?.box) return [];
  const { width, inside } = mask;
  const isIn = within
    ? (x, y) => onGrid(mask, x, y) && inside[y * width + x] === 1 && within(x, y)
    : (x, y) => onGrid(mask, x, y) && inside[y * width + x] === 1;
  /** @type {Map<string, Array<[number, number]>>} */
  const from = new Map();
  const add = (ax, ay, bx, by) => {
    const k = `${ax},${ay}`;
    const list = from.get(k);
    if (list) list.push([bx, by]); else from.set(k, [[bx, by]]);
  };
  const { x0, y0, x1, y1 } = mask.box;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!isIn(x, y)) continue;
      // clockwise around the cell, so every chain runs one way
      if (!isIn(x, y - 1)) add(x, y, x + 1, y);
      if (!isIn(x + 1, y)) add(x + 1, y, x + 1, y + 1);
      if (!isIn(x, y + 1)) add(x + 1, y + 1, x, y + 1);
      if (!isIn(x - 1, y)) add(x, y + 1, x, y);
    }
  }
  const chains = [];
  const take = (k) => {
    const list = from.get(k);
    if (!list?.length) return null;
    const next = list.pop();
    if (!list.length) from.delete(k);
    return next;
  };
  while (from.size) {
    const startKey = from.keys().next().value;
    const [sx, sy] = startKey.split(',').map(Number);
    const chain = [{ x: sx, y: sy }];
    let k = startKey;
    for (;;) {
      const n = take(k);
      if (!n) break;
      // a straight run is one segment: drop the middle corner
      const last = chain[chain.length - 1], prev = chain[chain.length - 2];
      if (prev && (prev.x === last.x && last.x === n[0] || prev.y === last.y && last.y === n[1])) chain[chain.length - 1] = { x: n[0], y: n[1] };
      else chain.push({ x: n[0], y: n[1] });
      k = `${n[0]},${n[1]}`;
      if (k === startKey) break;
    }
    if (chain.length > 1) chains.push(chain.map((p) => { const [wx, wy] = maskWorld(mask, p.x, p.y); return { x: wx, y: wy }; }));
  }
  return chains;
}

/** WILD2: the line where ring `ring` (2-4) begins - the edge of every cell at that ring or deeper. */
export const wildRingChains = (mask, ring) => wildEdgeChains(mask, (cx, cy) => ringOfCell(mask, cx, cy) >= ring);

/**
 * WILD2: WHERE EACH RING IS NAMED on a map - world map points `{ ring, x, y }`: the heart at the middle of its deepest
 * cells, and each outer ring on the line north from it, at the middle of that ring's run (so the four read as a column,
 * the outer at the top). A ring the line misses is named at its own cells' middle.
 */
export function wildRingAnchors(mask) {
  if (!mask?.box || !mask.maxDepth) return [];
  const { x0, y0, x1, y1 } = mask.box;
  const sum = Array.from({ length: WILD_RINGS + 1 }, () => ({ x: 0, y: 0, n: 0 }));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const r = ringOfCell(mask, x, y); if (r) { sum[r].x += x + 0.5; sum[r].y += y + 0.5; sum[r].n++; } }
  const heart = sum[WILD_RINGS].n ? { x: sum[WILD_RINGS].x / sum[WILD_RINGS].n, y: sum[WILD_RINGS].y / sum[WILD_RINGS].n } : null;
  const out = [];
  if (heart) out.push({ ring: WILD_RINGS, x: heart.x, y: heart.y });
  for (let r = WILD_RINGS - 1; r >= 1; r--) {
    let at = null;
    if (heart) {
      const cx = Math.floor(heart.x);
      let a = -1, b = -1;
      for (let y = Math.floor(heart.y); y >= y0; y--) { if (ringOfCell(mask, cx, y) === r) { if (b < 0) b = y; a = y; } else if (b >= 0) break; }
      if (b >= 0) at = { x: cx + 0.5, y: (a + b + 1) / 2 };
    }
    if (!at && sum[r].n) at = { x: sum[r].x / sum[r].n, y: sum[r].y / sum[r].n };
    if (at) out.push({ ring: r, ...at });
  }
  return out.map((p) => { const [wx, wy] = maskWorld(mask, p.x, p.y); return { ring: p.ring, x: wx, y: wy }; });
}

/**
 * WILD3: A FAST JOURNEY's law - from map pixel `from` to `to` (each `{ x, y }`), with the zone's `mask` (null offline:
 * no zone), the last fast journey inside it at `lastAt` (ms, or null), `now`, and the gold the traveller can pay it from.
 * Answers `{ ok: true, fee }` (fee 0 outside the zone), or `{ ok: false, text }`: never into or out of the zone, and
 * inside it one journey in ten minutes, for the fee of the tier it lands in (PVPTIERS: WILD_TRAVEL_FEES). The Overworld
 * map's journeys are walked, never asked.
 */
export function wildJourney({ from, to, mask, now = Date.now(), lastAt = null, gold = 0 }) {
  if (!mask || !from || !to) return { ok: true, fee: 0 };
  const a = wildInside(mask, from.x, from.y), b = wildInside(mask, to.x, to.y);
  if (!a && !b) return { ok: true, fee: 0 };
  if (a !== b) return { ok: false, text: a ? WILD_TEXT.travelOut : WILD_TEXT.travelIn };
  const wait = Number.isFinite(lastAt) ? WILD_TRAVEL_COOLDOWN_MS - (now - lastAt) : 0;
  if (wait > 0) return { ok: false, text: WILD_TEXT.travelWait(Math.ceil(wait / 60_000)) };
  const fee = wildTravelFee(wildRingAt(to.x, to.y, mask));   // PVPTIERS: by the tier it lands in
  if (!(gold >= fee)) return { ok: false, text: WILD_TEXT.travelPoor(fee) };
  return { ok: true, fee };
}

// ── PARTY-TRUCE (FIELD BUGS 2026-10-09b) ────────────────────────────────────────────────────────────────────────────
// The Discord's "you can be teleported into a pvp zone and killed": a stranger invited a new player to his party, led
// the party's walk into the mountains, and killed them - a party mate is never fair (world.js wildFair), and a kick or a
// leave ends the party in the instant, so the protection the walk in was taken under was dropped where it mattered.
// A player who leaves my party, or whose party I leave, is held out of the fight both ways for WILD_PARTY_TRUCE_MS - a
// walk out of the zone - before they are a stranger like any other. Each side reads its own party (the defender's own
// client refuses an unfair blow, net/wild/wildFight.js onFrame), so a doctored attacker gains nothing. Held in memory: a
// reload forgets it (Wild-Zone.md's known limits).
export const WILD_PARTY_TRUCE_MS = 10 * 60_000;
/** The truce's clock. `frame(peers, now)` each frame with my party's peer ids as they stand (social.partyPeers - a Set)
 *  answers the ones that just left it; `holds(id, now)` - is that player under truce with me. */
export function createPartyTruce(ms = WILD_PARTY_TRUCE_MS) {
  let was = new Set();
  /** peer id -> when its truce ends */
  const until = new Map();
  return {
    frame(peers, now) {
      const gone = [];
      for (const id of was) if (!peers.has(id)) { until.set(id, now + ms); gone.push(id); }
      for (const id of peers) until.delete(id);   // a mate again: the party's own protection
      for (const [id, t] of until) if (t <= now) until.delete(id);
      was = new Set(peers);
      return gone;
    },
    holds: (id, now) => (until.get(id) ?? 0) > now,
  };
}

// ── the words ─────────────────────────────────────────────────────────────────────────────────────────────────────────
export const WILD_TEXT = Object.freeze({
  enter: `You enter ${WILD_NAME}, an open PvP zone. Foes here are four times as strong, and you can lose what you carry.`,
  leave: `You leave ${WILD_NAME}.`,
  chip: 'Open PvP',
  chipTip: `${WILD_NAME}: other players may attack you. Foes are four times as strong and drop up to twice the loot (25% more at the edge, twice in the heart). If you die, you drop what you carry.`,
  mapKey: 'Open PvP zone',
  deathPvp: (name) => `${name || 'Another player'} may claim one piece of your worn gear.`,
  deathDrop: (n) => (n > 0 ? `${n} ${n === 1 ? 'thing you carried lies' : 'things you carried lie'} where you fell, for ten minutes.` : ''),
  // BURNT-SAID (FIELD BUGS 2026-10-18b): a held record's drop is taken and laid nowhere (Integrity-Arc, Lane 1's freeze) -
  // said, where it was said as nothing at all; and the letters of credit among what a death took, by their worth - through
  // the text core (L10N4), read when they are said
  deathBurnt: (n) => (n > 0 ? t('wild.death.burnt', '{n, plural, one {# thing you carried was} other {# things you carried were}} lost where you fell. This character\'s trading is frozen, so nothing is left for anyone to take.', { n }) : ''),
  deathLetters: (n, gold) => (n > 0 ? t('wild.death.letters', '{n, plural, one {A letter} other {# letters}} of credit worth {gold} gold left your wallet.', { n, gold: Number(gold).toLocaleString('en-US') }) : ''),
  deathClaim: (name, item) => `${name || 'Another player'} took your ${item || 'gear'}.`,
  // MAC (2026-10-14, the two-phase handoff): the piece claimed is held in escrow until its killer collects it - its words
  // through the text core (L10N4), read when they are said
  deathHeld: (name, item) => (name
    ? t('wild.escrow.deathHeld', '{name} claimed your {item}. It is held until they collect it, and comes back to you if they do not.', { name, item: item || t('wild.escrow.gear', 'gear') })
    : t('wild.escrow.deathHeldAnon', 'Another player claimed your {item}. It is held until they collect it, and comes back to you if they do not.', { item: item || t('wild.escrow.gear', 'gear') })),
  heldNote: (name, item, min) => (name
    ? t('wild.escrow.heldNote', 'Your {item} is held for {name}. If they do not collect it within {min, plural, one {# minute} other {# minutes}}, it comes back to you.', { name, item: item || t('wild.escrow.gear', 'gear'), min })
    : t('wild.escrow.heldNoteAnon', 'Your {item} is held for your killer. If they do not collect it within {min, plural, one {# minute} other {# minutes}}, it comes back to you.', { item: item || t('wild.escrow.gear', 'gear'), min })),
  heldBack: (item) => t('wild.escrow.heldBack', 'Your {item} has come back to you. It was never collected.', { item: item || t('wild.escrow.gear', 'gear') }),
  heldTaken: (name, item) => (name
    ? t('wild.escrow.heldTaken', '{name} collected your {item}.', { name, item: item || t('wild.escrow.gear', 'gear') })
    : t('wild.escrow.heldTakenAnon', 'Your killer collected your {item}.', { item: item || t('wild.escrow.gear', 'gear') })),
  collected: (item) => t('wild.escrow.collected', 'You take {item}.', { item }),
  collectLate: () => t('wild.escrow.collectLate', 'That piece was no longer held for you.'),
  deathHold: `In ${WILD_NAME} the dead wait two minutes.`,
  remainsName: (name) => (name ? `${name}'s remains` : 'Remains'),
  mine: 'Your remains',
  taken: 'Someone took that first.',
  gone: 'The body gives nothing up.',
  picked: (name, item) => `You take ${item} from ${name || 'the body'}.`,
  chosen: (name, item) => `You choose ${item} from ${name || 'the body'}. It comes to you from their remains.`,   // INT9: the pick is the relay's to sign
  lostPiece: (name, item) => `${name || 'Your killer'} took your ${item}.`,
  dropLate: `What you dropped when you died in ${WILD_NAME} has left your pack. It lies where you fell.`,   // INT9 (AUDIT): a receipt that found the fallen risen
  burntLate: () => t('wild.death.burntLate', 'What you dropped when you died in Cyrodiil has left your pack. This character\'s trading is frozen, so it was lost.'),   // BURNT-SAID: the same, for a held record
  noFight: 'You cannot attack a member of your party.',
  // PARTY-TRUCE: a party left in the zone, and a walk that leads into it
  truce: `No longer in your party. In ${WILD_NAME} you and they cannot fight for ten minutes. Then you are strangers.`,
  walkInto: `It leads into ${WILD_NAME}, an open PvP zone. Other players may kill you there and take what you carry.`,
  // AUDIT SEA VENTURES C6, C7: two more of the zone's own, so a ground of its own says them its way (zoneWord) - through
  // the text core (L10N4), read when they are said (a getter: a string where the callers read one)
  get unstuckOut() { return t('wild.zone.unstuckOut', '/unstuck does not work outdoors in Cyrodiil.'); },
  get revenantOne() { return t('wild.zone.revenantOne', 'Only one revenant may walk at your side in Cyrodiil.'); },
  // WILD3: the strangers
  stranger: 'Stranger',
  strangerNear: (m) => `A stranger is near - ${Math.max(10, Math.round(m / 10) * 10)} m.`,
  // WILD3: the journeys
  travelIn: `No fast travel into ${WILD_NAME}. Cross its edge on foot or on horseback (the Overworld map).`,
  travelOut: `No fast travel out of ${WILD_NAME}. Walk or ride out (the Overworld map).`,
  travelWait: (min) => `The carriages of ${WILD_NAME} run every ten minutes. The next leaves in ${min} minute${min === 1 ? '' : 's'}.`,
  travelPoor: (fee) => `A journey inside ${WILD_NAME} costs ${fee.toLocaleString('en-US')} gold here.`,
  travelPaid: (fee) => `You pay ${fee.toLocaleString('en-US')} gold for the Imperial road.`,
  // COMPANION-DROP (FIELD BUGS 2026-10-19f; the owner: "Bag drops; no send-off in zone"): a companion at my side drops his
  // pack with mine, so none is sent off from inside the zone (the teleport's own refusal, said of a companion), nothing of
  // mine reaches one waiting outside it, and one carried off knocked out leaves what it carries with me - through the
  // text core (L10N4), read when they are said
  companionStays: (name) => t('wild.companion.stays', '{name} stays at your side until you leave {zone}.', { zone: zoneName(), name: name || t('wild.companion.yours', 'your companion') }),
  companionAway: (name) => t('wild.companion.away', '{name} is waiting outside {zone}. Come out to hand over gear.', { zone: zoneName(), name: name || t('wild.companion.yoursFirst', 'Your companion') }),
  companionLeft: (name, n) => t('wild.companion.left', '{name} hands you {n, plural, one {# item} other {# items}} before leaving.', { zone: zoneName(), name: name || t('wild.companion.yoursFirst', 'Your companion'), n }),
  // WILD2: the rings
  ring: (r) => `${wildRingName(r)}: ${wildRingBonus(r)}.`,
  ringCross: (r, deeper) => `${deeper ? 'Deeper' : 'Back out'} - ${wildRingName(r)}: ${wildRingBonus(r)}.`,
});

/**
 * A FOE OF THE ZONE: four times its health and four times its blows - over whatever it already stood as (an elite's,
 * a champion's, a revenant's), so "even elites and champions". `own` false for a puppet: its maximum is its owner's
 * word (the stream's), so only its blows are scaled here, as an elite puppet's are. Idempotent (`wildFoe`). Answers
 * whether it scaled.
 */
/** A foe of the zone's loot options for spawnEnemyLoot (scenes/hostCombat.js): every category's chance and the rarity
 *  ladder's odds at its ring's multiplier (WILD2: x1.25 the outer ring to x2 the heart - `lootDropMult`'s and
 *  `lootQualityMult`'s doors), over whatever an elite's already are. The gold is hostCombat.js wildLootAfter's, and a
 *  plain foe's cap is as much wider (systems/foeLootCap.js, by the foe's `wildRing`). */
export function wildLootOpts(opts = {}, ring = WILD_RINGS) {
  const m = wildRingLoot(ring);
  return { ...opts, lootDropMult: (opts.lootDropMult ?? 1) * m, lootQualityMult: (opts.lootQualityMult ?? 1) * m };
}
/** A foe's loot multiplier: its ring's (stamped by applyWildFoe), or 1 for a foe of no zone. */
export const wildFoeLoot = (entity) => (entity?.wildFoe ? wildRingLoot(entity.wildRing) : 1);
/**
 * WILD2: A TREASURE PILE of the zone's dungeons - its ring's share of a SECOND roll through the pile's one home
 * (`roll`, dungeonContext.js rollPileItems): the heart's always (the owner's "double drops"), the outer ring's one time
 * in four - so a pile's drops, its gold and its odds of a rare piece are its ring's multiplier on average. In place;
 * answers the items.
 */
export function wildPileMore(items, roll, ring = WILD_RINGS, rand = Math.random) {
  const extra = wildRingLoot(ring) - 1;
  if (Array.isArray(items) && typeof roll === 'function' && (extra >= 1 || rand() < extra)) {
    const more = roll();
    if (Array.isArray(more)) items.push(...more);
  }
  return items;
}

export function applyWildFoe(entity, { own = true, ring = WILD_RINGS } = {}) {
  if (!entity || entity.wildFoe) return false;
  entity.wildFoe = true;
  entity.wildRing = Math.max(1, Math.min(WILD_RINGS, ring | 0 || WILD_RINGS));   // WILD2: its loot's ring
  // PVPDUNGEONS (the owner: "With the tier, enemies also get stronger on top of what they are in the zone based on the tier
  // percentage"): the ring's own share - +25% in the foothills to +100% in the heart - over the zone's four times
  const tier = wildRingLoot(entity.wildRing);
  entity.wildTierMult = tier;
  if (own) {
    entity.maxHealth = Math.max(1, Math.round((entity.maxHealth || 1) * WILD_FOE_HEALTH_MULT * tier));
    entity.health = entity.maxHealth;
    entity.healthMult = (entity.healthMult ?? 1) * WILD_FOE_HEALTH_MULT * tier;   // TELL1: what was stood on the kind's own health (its poise)
  }
  const prior = Number.isFinite(entity.damageScale) && entity.damageScale > 0 ? entity.damageScale : 1;
  entity.damageScale = prior * WILD_FOE_DAMAGE_MULT * tier;
  return true;
}

// ── a death in the zone, as the death screen reads it ─────────────────────────────────────────────────────────────────
let _death = null;
/** The world host's word at a death in the zone - `{ killer, dropped, claimed, held, burnt, letters }` (the killer's name or
 *  null, how many things were left where the body fell, the worn piece the killer took - `held`: MAC (2026-10-14), held in
 *  escrow until they collect it - BURNT-SAID: how many were taken and laid nowhere, a held record's, and `letters` the
 *  pieces the death took out of the pack, of which the letters of credit are counted) - or null when the death screen
 *  goes. The screen holds WILD_DEATH_HOLD_S and takes no Enter while it stands (ui/deathScreen.js). */
export function setWildDeath(d) {
  _death = d ? { killer: typeof d.killer === 'string' && d.killer ? d.killer : null, dropped: Math.max(0, d.dropped | 0), claimed: typeof d.claimed === 'string' && d.claimed ? d.claimed : null, held: d.held === true,
    burnt: Math.max(0, d.burnt | 0), letters: wildLettersOf(d.letters), kind: d.kind ?? _death?.kind ?? _kind ?? WILD_KIND } : null;   // ETHER-WILD: the ground it fell on, for its words
}
/** BURNT-SAID: the letters of credit among `items` - how many, and the gold they stand for. */
export function wildLettersOf(/** @type {any} */ items) {
  const l = (Array.isArray(items) ? items : []).filter(isLetterOfCredit);
  return { n: l.length, gold: l.reduce((g, it) => g + (Number.isSafeInteger(it.value) && it.value > 0 ? it.value : 0), 0) };
}
export const wildDeath = () => _death;
/** The death screen's lines for a death in the zone (empty for any other). */
export function wildDeathLines(d = _death) {
  if (!d) return [];
  return [d.killer ? (d.claimed ? (d.held ? WILD_TEXT.deathHeld : WILD_TEXT.deathClaim)(d.killer, d.claimed) : WILD_TEXT.deathPvp(d.killer)) : '', WILD_TEXT.deathDrop(d.dropped),
    WILD_TEXT.deathBurnt(d.burnt ?? 0), WILD_TEXT.deathLetters(d.letters?.n ?? 0, d.letters?.gold ?? 0), zoneWord('deathHold', d.kind ?? WILD_KIND)].filter(Boolean);
}
