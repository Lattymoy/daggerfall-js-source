// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WILD1 (2026-10-07) - THE OPEN ZONE: THE WROTHGARIAN MOUNTAINS (bible/11-Multiplayer/Wild-Zone.md).
//
// The owner: "Wrothgarian mountains need to be turned into a open pvp zone ... The zone needs to be marked on the map
// players cant see each others near and in that zone. Mobs are 4x stronger (even elites and champions) and drop 100%
// better loot. Same goes for dungeons." - and, asked what "100% better" is: "twice gold and twice the dropchance for
// rarity items and double drops".
//
// WHAT THE ZONE IS: every map pixel the POLITIC map gives to the Wrothgarian Mountains (MapsFile.getRegionIndexAt -
// region 16, its known bad byte 105 folded in), and every place in it - its towns' streets and buildings, and its
// dungeons. NEAR it: within WILD_NEAR_PX map pixels of its edge (the maps' hiding reaches that far, so a player cannot
// be watched from just over the line).
//
// ONLINE ALONE: offline there is no other player, so no fight between players, no remains and no one to hide from -
// and the zone's harder foes and richer loot are the price and the prize of that danger, so offline the mountains are
// Daggerfall's own (the death penalty's law, systems/deathPenalty.js: "online mode only").
//
// THIS FILE IS A LEAF: the region test, the mask the maps paint and hide by, the numbers, and the one live flag the
// pools read at a spawn (`wildHere`, set by the world host each frame). It imports nothing, so every pool can read it.
// ═══════════════════════════════════════════════════════════════════

/** The Wrothgarian Mountains - MapsFile's region index (mapsTables.js REGION_NAMES[16]). */
export const WILD_REGION = 16;
export const WILD_NAME = 'Wrothgarian Mountains';
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
export const wildRingName = (ring) => ['The Foothills', 'The Passes', 'The High Crags', 'The Heart'][(ring | 0) - 1] ?? 'The Heart';
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

/**
 * The owner's cut (2026-10-07, drawn in red over the zone map): the zone is only the part of the Wrothgarian Mountains
 * inside this polygon, in fractions (u, v) of the region's own bounding box (0,0 = its top-left, 1,1 = bottom-right).
 */
// ZONE-CUT2 (2026-10-08, the owner: "thats what the borders form should be normaly try to not use this bump"): the same cut
// snapped onto the roads it was drawn along (traced off the owner's own map), with the south edge's bump - the road's climb
// north of the heart - taken straight across.
export const WILD_CUT = Object.freeze([[0.4103,0.0],[0.4097,0.0375],[0.4166,0.0778],[0.4103,0.1056],[0.4007,0.1278],[0.3952,0.1736],[0.3924,0.1764],[0.3924,0.1903],[0.4007,0.2083],[0.3862,0.2278],[0.3848,0.25],[0.3972,0.3014],[0.3993,0.3403],[0.4048,0.3681],[0.4055,0.4292],[0.4124,0.4639],[0.4193,0.4792],[0.42,0.4986],[0.4379,0.4736],[0.4641,0.4542],[0.5828,0.4458],[0.5897,0.4653],[0.5952,0.4625],[0.6159,0.4792],[0.6421,0.4819],[0.66,0.5056],[0.6938,0.5139],[0.7152,0.5417],[0.7331,0.5444],[0.7131,0.4833],[0.7138,0.4514],[0.7359,0.4042],[0.7503,0.3833],[0.7545,0.3472],[0.8103,0.2361],[0.8103,0.2236],[0.8,0.2083],[0.7614,0.2069],[0.7352,0.1819],[0.731,0.1875],[0.7338,0.1764],[0.7276,0.1597],[0.7241,0.1153],[0.7117,0.0569],[0.7179,0.0417],[0.7324,0.0389],[0.7414,0.0]]);
const inCut = (cut, u, v) => {
  let c = false;
  for (let i = 0, j = cut.length - 1; i < cut.length; j = i++) {
    const [xi, yi] = cut[i], [xj, yj] = cut[j];
    if ((yi > v) !== (yj > v) && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};

/** Is this region the zone? */
export const isWildRegion = (regionIndex) => regionIndex === WILD_REGION;

// ── the live flag: where the player stands now ───────────────────────────────────────────────────────────────────────
let _here = false;
let _ring = 0;
/** The world host's word each frame: the player stands in the zone, online (scenes/world.js) - and in which ring. */
export function setWildHere(on, ring = 0) { _here = !!on; _ring = _here ? Math.max(1, Math.min(WILD_RINGS, ring | 0 || WILD_RINGS)) : 0; }
/** Does the player stand in the zone now? (The foe pools ask at a spawn, the loot rolls at a death.) */
export const wildHere = () => _here;
/** The ring the player stands in (1 the outer, 4 the heart), 0 outside. */
export const wildRing = () => _ring;
/** WILD2: the mask the world host registered (the maps' own) - so a host with no map of its own (a dungeon's build)
 *  reads a place's ring by its map pixel. */
let _mask = null;
export function setWildMask(mask) { _mask = mask ?? null; }
export const wildMask = () => _mask;

// ── the mask: the zone's pixels and the band around them ──────────────────────────────────────────────────────────────
/**
 * The zone over a `width` x `height` map: `inside` and `near` (inside, or within `nearPx` of an inside pixel) as one
 * byte a pixel, and the inside's bounding box. `regionAt(x, y)` answers a pixel's region (MapsFile.getRegionIndexAt).
 * Built once a map (`wildMaskOf` caches it).
 */
export function buildWildMask({ width, height, regionAt, nearPx = WILD_NEAR_PX, keepOut = [], cut = WILD_CUT }) {   // cut: null - the whole region (the laws over a plain shape)
  const inside = new Uint8Array(width * height);
  const region = new Uint8Array(width * height);   // the whole region 16 (road-only walking outside the cut)
  let rx0 = width, ry0 = height, rx1 = -1, ry1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (regionAt(x, y) !== WILD_REGION) continue;
      region[y * width + x] = 1;
      if (x < rx0) rx0 = x; if (x > rx1) rx1 = x; if (y < ry0) ry0 = y; if (y > ry1) ry1 = y;
    }
  }
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = ry0; y <= ry1; y++) {
    for (let x = rx0; x <= rx1; x++) {
      if (!region[y * width + x]) continue;
      if (cut && !inCut(cut, (x + 0.5 - rx0) / (rx1 - rx0 + 1), (y + 0.5 - ry0) / (ry1 - ry0 + 1))) continue;
      inside[y * width + x] = 1;
    }
  }
  // WILD-KEEPOUT2 (the owner: "can you move the exact borders to right so wrothgaria is out"): THE WEST BORDER MOVED EAST -
  // never a notch. Each zone pixel's run of zone pixels to its west (itself counted) is read; the border moves east by the
  // longest run found on a kept-out town's ground (the town's pixel and WILD_KEEPOUT_PX about it), the same distance all
  // along the west - so the town falls just outside, and the border keeps its shape (the east, the top and the south as cut)
  if (keepOut.length) {
    const run = new Uint16Array(width * height);
    for (let y = ry0; y <= ry1; y++) for (let x = rx0, n = 0; x <= rx1; x++) { const i = y * width + x; n = inside[i] ? n + 1 : 0; run[i] = n; }
    let shift = 0;
    for (const k of keepOut) {
      for (let y = k.y - WILD_KEEPOUT_PX; y <= k.y + WILD_KEEPOUT_PX; y++) {
        for (let x = k.x - WILD_KEEPOUT_PX; x <= k.x + WILD_KEEPOUT_PX; x++) {
          if (x >= 0 && y >= 0 && x < width && y < height) shift = Math.max(shift, run[y * width + x]);
        }
      }
    }
    if (shift > 0) for (let i = 0; i < run.length; i++) if (inside[i] && run[i] <= shift) inside[i] = 0;
  }
  for (let y = ry0; y <= ry1; y++) {
    for (let x = rx0; x <= rx1; x++) {
      if (!inside[y * width + x]) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  const near = new Uint8Array(width * height);
  if (x1 >= 0) {
    // a separable square dilation (two passes over the box widened by the band) - a pixel within nearPx on both axes
    const bx0 = Math.max(0, x0 - nearPx), bx1 = Math.min(width - 1, x1 + nearPx);
    const by0 = Math.max(0, y0 - nearPx), by1 = Math.min(height - 1, y1 + nearPx);
    const row = new Uint8Array(width * height);
    for (let y = y0; y <= y1; y++) {
      for (let x = bx0; x <= bx1; x++) {
        let hit = 0;
        for (let k = Math.max(0, x - nearPx); k <= Math.min(width - 1, x + nearPx) && !hit; k++) hit = inside[y * width + k];
        row[y * width + x] = hit;
      }
    }
    for (let y = by0; y <= by1; y++) {
      for (let x = bx0; x <= bx1; x++) {
        let hit = 0;
        for (let k = Math.max(0, y - nearPx); k <= Math.min(height - 1, y + nearPx) && !hit; k++) hit = row[k * width + x];
        near[y * width + x] = hit;
      }
    }
  }
  // WILD2: THE DEPTH - each inside pixel's chamfer distance (3 a side, 4 a corner) from the nearest outside pixel, by
  // the two-pass sweep over the box; the rings read it over the deepest
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
  return {
    width, height, inside, region, near, depth, maxDepth, box: x1 >= 0 ? { x0, y0, x1, y1 } : null,
    regionBox: rx1 >= 0 ? { x0: rx0, y0: ry0, x1: rx1, y1: ry1 } : null,   // CLASSIC-CUT: the whole region's box (wildPictureZone)
  };
}

/**
 * CLASSIC-CUT: THE ZONE ON A PICTURE OF THE REGION - the classic province map's picker bitmap, whose region 16 is the
 * Wrothgarian Mountains drawn small and in its own shape. A picture pixel `isRegion` answers for is the zone's when the
 * map pixel at the same place in the region's box is: the pixel read as a fraction of the picture's own box of the
 * region, laid over the mask's (`regionBox`) - so the owner's cut and the keep-out read on the picture as on the map,
 * never the whole region. Answers a predicate `(x, y) => boolean`; never the zone without a mask.
 * @param {any} mask
 * @param {(x: number, y: number) => boolean} isRegion
 * @param {number} width
 * @param {number} height
 */
export function wildPictureZone(mask, isRegion, width, height) {
  const rb = mask?.regionBox;
  if (!rb) return () => false;
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isRegion(x, y)) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return () => false;
  const sx = (rb.x1 - rb.x0 + 1) / (x1 - x0 + 1), sy = (rb.y1 - rb.y0 + 1) / (y1 - y0 + 1);
  return (x, y) => isRegion(x, y) && wildInside(mask, rb.x0 + (x - x0 + 0.5) * sx, rb.y0 + (y - y0 + 0.5) * sy);
}

/**
 * WILD2: THE RING of map pixel (x, y) - 1 (the outer quarter of the zone's depth) to 4 (its heart) - or 0 outside the
 * zone (or with no mask). The mask defaults to the registered one (setWildMask).
 */
export function wildRingAt(x, y, mask = _mask) {
  if (!mask?.depth || !mask.maxDepth) return wildInside(mask, x, y) ? WILD_RINGS : 0;
  const px = Math.floor(x), py = Math.floor(y);
  if (!(px >= 0 && py >= 0 && px < mask.width && py < mask.height)) return 0;
  const d = mask.depth[py * mask.width + px];
  if (!d) return 0;
  return Math.max(1, Math.min(WILD_RINGS, Math.ceil((d / mask.maxDepth) * WILD_RINGS)));
}

const _masks = new WeakMap();
/** The zone's mask over a MapsFile (its own `getRegionIndexAt`), built at the first ask and kept. Null without one. */
/** WILD-KEEPOUT (2026-10-08, the owner: "can we place the zone still in the mountain region but keep wrothgaria out of
 *  it?", then "move the exact borders to right so wrothgaria is out"): the towns of the region the zone never takes -
 *  its west border moved east until each, and WILD_KEEPOUT_PX of ground about it, lies outside (buildWildMask). */
export const WILD_KEEPOUT_TOWNS = Object.freeze(['Wrothgaria']);
export const WILD_KEEPOUT_PX = 2;
export function wildMaskOf(maps, width = 1000, height = 500) {
  if (!maps || typeof maps.getRegionIndexAt !== 'function') return null;
  const had = _masks.get(maps);
  if (had) return had;
  // WILD-KEEPOUT: the towns kept out, each a square of WILD_KEEPOUT_PX about its pixel - read off the map files every
  // client holds, so every client cuts the same zone
  const keep = [];
  for (const name of WILD_KEEPOUT_TOWNS) {
    try {
      const loc = maps.getLocationByName?.(WILD_NAME, name);
      const t = loc?.mapTableData;
      if (t && Number.isFinite(t.longitude) && Number.isFinite(t.latitude)) keep.push({ x: Math.trunc(t.longitude / 128), y: 499 - Math.trunc(t.latitude / 128) });   // formats/mapsFile.js longitudeLatitudeToMapPixel
    } catch { /* a map file without it: nothing kept out */ }
  }
  const m = buildWildMask({ width, height, regionAt: (x, y) => maps.getRegionIndexAt(x, y), keepOut: keep });
  _masks.set(maps, m);
  return m;
}
const at = (mask, field, x, y) => {
  if (!mask) return false;
  const px = Math.floor(x), py = Math.floor(y);
  if (!(px >= 0 && py >= 0 && px < mask.width && py < mask.height)) return false;
  return mask[field][py * mask.width + px] === 1;
};
/** Is map pixel (x, y) - fractions allowed - inside the zone? */
export const wildInside = (mask, x, y) => at(mask, 'inside', x, y);
/** Is it in the zone or within its band? */
export const wildNear = (mask, x, y) => at(mask, 'near', x, y);

/**
 * THE ZONE'S EDGE as chains of map-pixel corners, for the maps' red line: every edge between an inside pixel and an
 * outside one, joined end to end where they meet. Each chain is `[{x, y}, ...]` in pixel-corner units. WILD2: with
 * `within`, the edge of that set instead (a ring's inner line: `wildRingChains`).
 */
export function wildEdgeChains(mask, within = null) {
  if (!mask?.box) return [];
  const { width, inside } = mask;
  // WILD2: `within(x, y)` - a set inside the zone to edge instead of the zone (a ring and every ring deeper)
  const isIn = within
    ? (x, y) => x >= 0 && y >= 0 && x < mask.width && y < mask.height && inside[y * width + x] === 1 && within(x, y)
    : (x, y) => x >= 0 && y >= 0 && x < mask.width && y < mask.height && inside[y * width + x] === 1;
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
      // clockwise around the pixel, so every chain runs one way
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
    if (chain.length > 1) chains.push(chain);
  }
  return chains;
}

/** WILD2: the line where ring `ring` (2-4) begins - the edge of every pixel at that ring or deeper. */
export const wildRingChains = (mask, ring) => wildEdgeChains(mask, (x, y) => wildRingAt(x, y, mask) >= ring);

/**
 * WILD2: WHERE EACH RING IS NAMED on a map - map-pixel points `{ ring, x, y }`: the heart at the middle of its deepest
 * pixels, and each outer ring on the line north from it, at the middle of that ring's run (so the four read as a
 * column, the outer at the top). A ring the line misses is named at its own pixels' middle.
 */
export function wildRingAnchors(mask) {
  if (!mask?.box || !mask.maxDepth) return [];
  const { x0, y0, x1, y1 } = mask.box;
  const sum = Array.from({ length: WILD_RINGS + 1 }, () => ({ x: 0, y: 0, n: 0 }));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const r = wildRingAt(x, y, mask); if (r) { sum[r].x += x + 0.5; sum[r].y += y + 0.5; sum[r].n++; } }
  const heart = sum[WILD_RINGS].n ? { x: sum[WILD_RINGS].x / sum[WILD_RINGS].n, y: sum[WILD_RINGS].y / sum[WILD_RINGS].n } : null;
  const out = [];
  if (heart) out.push({ ring: WILD_RINGS, x: heart.x, y: heart.y });
  for (let r = WILD_RINGS - 1; r >= 1; r--) {
    let at = null;
    if (heart) {
      const cx = Math.floor(heart.x);
      let a = -1, b = -1;
      for (let y = Math.floor(heart.y); y >= y0; y--) { if (wildRingAt(cx, y, mask) === r) { if (b < 0) b = y; a = y; } else if (b >= 0) break; }
      if (b >= 0) at = { x: cx + 0.5, y: (a + b + 1) / 2 };
    }
    if (!at && sum[r].n) at = { x: sum[r].x / sum[r].n, y: sum[r].y / sum[r].n };
    if (at) out.push({ ring: r, ...at });
  }
  return out;
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
// client refuses an unfair blow, net/wildFight.js onFrame), so a doctored attacker gains nothing. Held in memory: a
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
  enter: `You enter the ${WILD_NAME} - an open PvP zone. Foes here are four times as strong; what you carry is at stake.`,
  leave: `You leave the ${WILD_NAME}.`,
  chip: 'Open PvP',
  chipTip: `${WILD_NAME}: other players may attack you, foes are four times as strong and drop up to twice the loot (25% more at the edge, twice in the heart), and a death drops what you carry.`,
  mapKey: 'Open PvP zone',
  deathPvp: (name) => `${name || 'Another player'} may claim one piece of your worn gear.`,
  deathDrop: (n) => (n > 0 ? `${n} ${n === 1 ? 'thing you carried lies' : 'things you carried lie'} where you fell, for ten minutes.` : ''),
  deathClaim: (name, item) => `${name || 'Another player'} took your ${item || 'gear'}.`,
  deathHold: 'In the mountains the dead wait two minutes.',
  remainsName: (name) => (name ? `${name}'s remains` : 'Remains'),
  mine: 'Your remains',
  taken: 'Someone took that first.',
  gone: 'The body gives nothing up.',
  picked: (name, item) => `You take ${item} from ${name || 'the body'}.`,
  lostPiece: (name, item) => `${name || 'Your killer'} took your ${item}.`,
  noFight: 'You cannot attack a member of your party.',
  // PARTY-TRUCE: a party left in the zone, and a walk that leads into it
  truce: `No longer of your party - in the ${WILD_NAME} you and they cannot fight for ten minutes. Then you are strangers.`,
  walkInto: `It leads into the ${WILD_NAME} - an open PvP zone: other players may kill you there and take what you carry.`,
  // WILD3: the strangers
  stranger: 'Stranger',
  strangerNear: (m) => `A stranger is near - ${Math.max(10, Math.round(m / 10) * 10)} m.`,
  // WILD3: the journeys
  travelIn: `No fast travel into the ${WILD_NAME} - its edge is crossed on foot or in the saddle (the Overworld map).`,
  travelOut: `No fast travel out of the ${WILD_NAME} - walk or ride out (the Overworld map).`,
  travelWait: (min) => `The mountain carriages run once every ten minutes - ${min} more minute${min === 1 ? '' : 's'}.`,
  travelPoor: (fee) => `A journey inside the ${WILD_NAME} costs ${fee.toLocaleString('en-US')} gold here.`,
  travelPaid: (fee) => `You pay ${fee.toLocaleString('en-US')} gold for the mountain road.`,
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
/** The world host's word at a death in the zone - `{ killer, dropped, claimed }` (the killer's name or null, how many
 *  things were left where the body fell, the worn piece the killer took) - or null when the death screen goes. The screen holds WILD_DEATH_HOLD_S and takes
 *  no Enter while it stands (ui/deathScreen.js). */
export function setWildDeath(d) {
  _death = d ? { killer: typeof d.killer === 'string' && d.killer ? d.killer : null, dropped: Math.max(0, d.dropped | 0), claimed: typeof d.claimed === 'string' && d.claimed ? d.claimed : null } : null;
}
export const wildDeath = () => _death;
/** The death screen's lines for a death in the zone (empty for any other). */
export function wildDeathLines(d = _death) {
  if (!d) return [];
  return [d.killer ? (d.claimed ? WILD_TEXT.deathClaim(d.killer, d.claimed) : WILD_TEXT.deathPvp(d.killer)) : '', WILD_TEXT.deathDrop(d.dropped), WILD_TEXT.deathHold].filter(Boolean);
}
