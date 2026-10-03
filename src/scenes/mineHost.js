// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF2 (2026-09-28, Mac: "Go") - MINING AND QUARRYING IN THE STREAMING
// WORLD, a kind in the gathering host (scenes/gatherHost.js; bible/
// 06-Systems/Professions-Arc.md 5.2, 6, 23; FORAGE0 14):
//
//   WHERE A NODE STANDS (PROF0 6's "nearest suitable anchor", decided in
//   23). World of Daggerfall is forced on for the online lane, so every
//   client of a room stands the same rock pieces (the pixel's `rocks`,
//   the Rocks and Mountains layouts' own boxes - scenes/world.js). A VEIN
//   stands at the foot of the piece nearest its law point, on the side
//   facing it; with no piece left, on the terrain's stone tile (tile 3)
//   nearest its point within VEIN_STONE_REACH tiles where nature could
//   stand; else where nature stands at its point; else nowhere. A BOULDER
//   is a piece itself - Quarrying works a rock field's boulders (5.2) -
//   so a pixel with no clear side left stands fewer. ROCK-SHARE: a piece
//   holds a node on each side, NODE_SPACING_M apart (it held one).
//   THE PICTURE. The material's own item flat (TEXTURE.254: the metal's
//   own, a new ore Lodestone's), a small cluster at the foot; a boulder's
//   loose stone Lodestone's lump - no new art (law 6).
//   THE ACT. Foraging's Pick-Axe checks first (FORAGE0 14.3); the machine
//   is systems/mineAct.js; the hand draws DFU's Warhammer (template 126),
//   its StrikeDown frames on each swing.
//
// PROF2b (2026-10-03, Mac: "plus we need to build motherloads"): A
// MOTHERLODE stands here too - on the pixel the service picked, at the rock
// piece nearest the pixel's heart (else its stone, else where nature stands),
// while it stands for this account (net/motherlodeBook.js): its ore's
// flats, a heap of them and twice a vein's size, glowing and on the compass
// from MOTHERLODE_MARK.reach. Its act is tier 6's; it asks an Apprentice's
// Mining and the relay's Watch receipt for its pixel, which rides the
// harvest (`ask`) to the service.
// ═══════════════════════════════════════════════════════════════════
import { veins, boulders, nodeKey, VEIN_TABLES, dungeonVeins, dveinKey } from '../net/nodeLaw.js';
import { tierOpen, TIER_RANKS, PROF_RANK_MAX, pickAxeBand, minedMaterial, storesFullIn, GROUND_WHERE, GROUND_WHERE_WORDS } from '../net/professionLaw.js';
import { natureStandsAt, groundAt, insideRocks } from '../world/terrainNature.js';   // NODE-CLEAR: the rock check's one home
import { WORLD_MAP_TILE_DIM } from '../world/terrainTiles.js';
import { TERRAIN_SIZE } from '../world/terrainSampler.js';
import { createMineAct } from '../systems/mineAct.js';
import { FT } from '../systems/foragingLaw.js';
import { foragingActRefusal, foragingToolIn, actChecksRefusal } from '../systems/foragingInstall.js';
import { materialLabel } from '../systems/profItems.js';
import { templateByIndex } from '../systems/itemTemplates.js';
import { liveStat } from '../systems/statMods.js';
import { getPref } from '../systems/uiPrefs.js';
import { MOTHERLODE_TIER, MOTHERLODE_RANK } from '../net/motherlodeLaw.js';   // PROF2b
import { MOTHERLODE_TEXT } from '../net/motherlodeBook.js';

/** The item flats' archive; a picture a new ore has none of its own borrows Lodestone's (PROF0 4.8). */
export const ORE_FLAT_ARCHIVE = 254;
export const LODESTONE_RECORD = 66;
/** A vein is this many of its metal's flats at this times the item's own size, spread this far (m) at the foot. */
export const VEIN_FLATS = 3;
export const VEIN_SCALE = 2.2;
export const VEIN_SPREAD = 0.45;
/** A boulder's loose stone at its foot: this many Lodestone lumps at this size. */
export const STONE_FLATS = 3;
export const STONE_SCALE = 1.8;
/** How far off a piece's box a node's flats stand (m), and how far a vein looks for a stone tile (tiles). */
export const ROCK_OFFSET = 0.4;
/** ROCK-SHARE: two nodes at a rock field stand at least this far apart (m) - on one piece's different sides, or two. */
export const NODE_SPACING_M = 6;
/** FOOT-IN (AUDIT of ROCK-FOOT): a node's foot stands at least this far inside its own pixel (m). A field's pieces reach
 *  past the pixel's edge, and a node stood on the next pixel's ground was lit and on the compass but no look found it -
 *  the gathering host asks only the pixels whose ground is in reach (gatherHost nearPixels) - and its height was read
 *  off the edge's samples. */
export const FOOT_INSET_M = 0.5;
/** Whether a pixel-local (x, z) stands on the pixel's own ground, FOOT_INSET_M in. */
const onPixel = (x, z) => x >= FOOT_INSET_M && x <= TERRAIN_SIZE - FOOT_INSET_M && z >= FOOT_INSET_M && z <= TERRAIN_SIZE - FOOT_INSET_M;
export const VEIN_STONE_REACH = 24;
/** A Prospector's compass marks the veins stood within this many metres (PROF0 3.3). */
export const PROSPECT_M = 200;
/** NODE-MARKS: a node's glow about its foot (m) - a vein's ore, a boulder's loose stone under its rock, a dungeon
 *  vein's on its wall - and a Prospector's veins, marked out to PROSPECT_M. */
export const MINE_MARKS = Object.freeze({
  vein: Object.freeze({ w: 1.6, h: 1.3 }), boulder: Object.freeze({ w: 2.1, h: 1.5 }), dvein: Object.freeze({ w: 1.4, h: 1.2 }),
});
const PROSPECTOR_MARKS = Object.freeze({ vein: Object.freeze({ ...MINE_MARKS.vein, reach: PROSPECT_M }), dvein: Object.freeze({ ...MINE_MARKS.dvein, reach: PROSPECT_M }) });
/** PROF2b: a Motherlode's heap - this many of its ore's flats at this size, spread this far (m) - and its glow, marked
 *  on the compass from `reach` off (the compass marks it from anywhere while it stands - scenes/world.js). */
export const MOTHERLODE_FLATS = 7;
export const MOTHERLODE_SCALE = 3.3;
export const MOTHERLODE_SPREAD = 1.1;
export const MOTHERLODE_MARK = Object.freeze({ w: 3.4, h: 2.6, reach: 400 });
/** The Pick-Axe in the hand (FORAGE0 14.2): DFU's own Warhammer. */
export const PICK_HAND = Object.freeze({ group: 'Weapons', templateIndex: 126, material: 0 });
/** DFU's StrikeDown frames a swing plays (fpsWeapon.js clamps to the art's own count). */
const STRIKE_FRAMES = 5;

const TILE_M = TERRAIN_SIZE / WORLD_MAP_TILE_DIM;
/** The point of a box's footprint nearest (x, z) - on its edge, pushed ROCK_OFFSET out along the way from its centre.
 *  @param {number[]} box [x0, y0, z0, x1, y1, z1] */
export function rockFoot(box, x, z) {
  const cx = (box[0] + box[3]) / 2, cz = (box[2] + box[5]) / 2;
  let qx = Math.max(box[0], Math.min(box[3], x)), qz = Math.max(box[2], Math.min(box[5], z));
  if (qx > box[0] && qx < box[3] && qz > box[2] && qz < box[5]) {
    // the point is inside the footprint: the nearest edge
    const d = [qx - box[0], box[3] - qx, qz - box[2], box[5] - qz];
    const m = d.indexOf(Math.min(...d));
    if (m === 0) qx = box[0]; else if (m === 1) qx = box[3]; else if (m === 2) qz = box[2]; else qz = box[5];
  }
  let dx = qx - cx, dz = qz - cz;
  const l = Math.hypot(dx, dz) || 1;
  dx /= l; dz /= l;
  return [qx + dx * ROCK_OFFSET, qz + dz * ROCK_OFFSET];
}
/** The distance from (x, z) to a box's footprint (0 inside). */
const toBox = (box, x, z) => Math.hypot(Math.max(box[0] - x, 0, x - box[3]), Math.max(box[2] - z, 0, z - box[5]));
/** ROCK-FOOT: the sides a piece's foot may stand on (FOOT_SIDES), as points far off its centre for rockFoot to face -
 *  (x, z) itself first, then the rest by how near their bearing is to it. */
export const FOOT_SIDES = 8;
function footTargets(box, x, z) {
  const cx = (box[0] + box[3]) / 2, cz = (box[2] + box[5]) / 2;
  const far = Math.max(box[3] - box[0], box[5] - box[2]) + 10;
  const toward = Math.atan2(z - cz, x - cx);
  const sides = [];
  for (let k = 0; k < FOOT_SIDES; k++) {
    const a = (k * 2 * Math.PI) / FOOT_SIDES;
    sides.push({ a, off: Math.abs(Math.atan2(Math.sin(a - toward), Math.cos(a - toward))) });
  }
  sides.sort((p, q) => p.off - q.off || p.a - q.a);
  return [[x, z], ...sides.map(({ a }) => [cx + Math.cos(a) * far, cz + Math.sin(a) * far])];
}
/** The stone tile nearest (tx, ty) within `reach` tiles where nature could stand, or null - VEIN-CLEAR: never a tile
 *  whose stand is inside a rock piece (`rocks`). */
function nearestStone(samples, tilemap, locationRect, tx, ty, reach, rocks) {
  let best = null, bestD = Infinity;
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      const d = dx * dx + dy * dy;
      if (d >= bestD || d > reach * reach) continue;
      const x = tx + dx, y = ty + dy;
      if (x < 0 || y < 0 || x >= WORLD_MAP_TILE_DIM || y >= WORLD_MAP_TILE_DIM) continue;
      if ((tilemap[y * WORLD_MAP_TILE_DIM + x] & 0x3f) !== 3) continue;
      const at = natureStandsAt(samples, tilemap, locationRect, x, y);
      if (at && !insideRocks(rocks, at.x, at.z)) { best = at; bestD = d; }
    }
  }
  return best;
}

/**
 * A PIXEL'S VEINS AND BOULDERS AS THE CLIENT STANDS THEM (PROF0 23): the law's nodes of the day, each at its anchor -
 * `{ key, what: 'vein'|'boulder', slot, tier, material, signature?, local, rock?, lift }`, `local` pixel-local metres.
 * @param {{ px: number, py: number, day: number, climate: number, region?: number|null, confirmed?: boolean,
 *   samples: Float32Array, tilemap: Uint8Array, locationRect?: any, rocks?: number[][] }} p
 */
export function standMineNodes({ px, py, day, climate, region = null, confirmed = false, samples, tilemap, locationRect = null, rocks = [] }) {
  const out = [];
  const pieces = rocks ?? [];
  /** ROCK-SHARE: the feet taken - a piece holds a node on each of its sides NODE_SPACING_M apart */
  const taken = [];
  // ROCK-FOOT: the nearest piece with a foot clear of every piece - the side facing (x, z) first, then its others,
  // nearest that way first. A piece whose one foot fell inside a neighbour was spent and nothing stood: a field's pieces
  // overlap, so a boulder stood only where the first piece asked faced open ground. ROCK-SHARE: and clear of every node
  // stood - a field's few open sides held one node a piece, so its boulders ran out at two or three a day
  const claim = (x, z) => {
    const order = pieces.map((b, i) => ({ i, d: toBox(b, x, z) })).sort((a, b) => a.d - b.d || a.i - b.i);
    for (const { i } of order) {
      for (const [tx, tz] of footTargets(pieces[i], x, z)) {
        const foot = rockFoot(pieces[i], tx, tz);
        if (!onPixel(foot[0], foot[1]) || insideRocks(pieces, foot[0], foot[1])) continue;   // FOOT-IN
        if (taken.some((t) => Math.hypot(t[0] - foot[0], t[1] - foot[1]) < NODE_SPACING_M)) continue;
        taken.push(foot);
        return { rock: pieces[i], foot };
      }
    }
    return null;
  };
  // ROCK-FOOT: the boulders claim their pieces first - a vein with no piece left stands on the stone beside the field, a
  // boulder with none stands nowhere (the veins took the field's clear pieces, and its boulders were rarely seen)
  const stones = [];
  for (const b of boulders({ x: px, y: py, day, climate })) {
    // a boulder is a rock field's piece: none left whose foot is clear (AUDIT 29 C11: never inside a neighbour), none stands
    const claimed = claim(b.u * TERRAIN_SIZE, b.v * TERRAIN_SIZE);
    if (!claimed) continue;
    const { rock, foot: [fx, fz] } = claimed;
    const g = groundAt(samples, fx, fz);
    stones.push({ key: nodeKey({ kind: 'boulder', x: px, y: py, day, slot: b.slot }), what: 'boulder', slot: b.slot, tier: b.tier, material: b.material, local: [fx, g, fz], rock, lift: Math.min(1.2, Math.max(0.4, (rock[4] - g) / 2)) });
  }
  if (VEIN_TABLES[climate]) {
    for (const v of veins({ x: px, y: py, day, climate, region, confirmed })) {
      const x = v.u * TERRAIN_SIZE, z = v.v * TERRAIN_SIZE;
      const claimed = claim(x, z);
      const rock = claimed?.rock ?? null;
      let local = null;
      if (claimed) {
        const [fx, fz] = claimed.foot;
        local = [fx, groundAt(samples, fx, fz), fz];
      }
      if (!local) {
        const tx = Math.min(WORLD_MAP_TILE_DIM - 1, Math.floor(v.u * WORLD_MAP_TILE_DIM));
        const ty = Math.min(WORLD_MAP_TILE_DIM - 1, Math.floor(v.v * WORLD_MAP_TILE_DIM));
        // VEIN-CLEAR (FIELD BUGS 2026-10-01): a rock field stands on stone, so the stone tile nearest could lie under a
        // piece of it - a vein stood inside the rock, glowing and marked, that no look could reach (the ray to it is the
        // rock's); it stands on the nearest stone outside every piece, as a rock's foot does (AUDIT 29 C11)
        const outside = (a) => (a && !insideRocks(rocks ?? [], a.x, a.z) ? a : null);
        const at = nearestStone(samples, tilemap, locationRect, tx, ty, VEIN_STONE_REACH, rocks ?? []) ?? outside(natureStandsAt(samples, tilemap, locationRect, tx, ty));
        if (at) local = [at.x, at.y, at.z];
      }
      if (!local) continue;
      out.push({ key: nodeKey({ kind: 'vein', x: px, y: py, day, slot: v.slot }), what: 'vein', slot: v.slot, tier: v.tier, material: v.material, signature: v.signature, local, rock: rock ?? null, lift: 0.5 });
    }
  }
  out.push(...stones);
  return out;
}
/** AUDIT SILVER-WAYS D4: the pixel's tiles walked for a Motherlode's place this far apart (tiles), the nearest its heart
 *  first. */
const LODE_SEARCH_STEP = 4;
/**
 * AUDIT SILVER-WAYS D4: WHERE A MOTHERLODE STANDS WHEN ITS HEART CANNOT HOLD IT - the pixel's tiles every
 * LODE_SEARCH_STEP, the nearest its heart first (the one order every client walks, so all stand it alike), the first
 * where nature stands outside the pixel's town and its rocks; null on a pixel that holds none (all water, all cliff).
 * A town over the heart with no stone within VEIN_STONE_REACH of it stood the day's Motherlode nowhere - risen in the
 * chat and on every compass, and on no ground - the service picks pixels with no map (the witnesses' word on the ground
 * is all it reads), and the witnesses' pixels are the ones folk walk, about the towns.
 */
function standAnywhere(samples, tilemap, locationRect, rocks) {
  const c = Math.floor(WORLD_MAP_TILE_DIM / 2);
  const tiles = [];
  for (let y = LODE_SEARCH_STEP / 2; y < WORLD_MAP_TILE_DIM; y += LODE_SEARCH_STEP) {
    for (let x = LODE_SEARCH_STEP / 2; x < WORLD_MAP_TILE_DIM; x += LODE_SEARCH_STEP) tiles.push({ x, y, d: (x - c) ** 2 + (y - c) ** 2 });
  }
  tiles.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
  for (const { x, y } of tiles) {
    const at = natureStandsAt(samples, tilemap, locationRect, x, y);
    if (at && onPixel(at.x, at.z) && !insideRocks(rocks, at.x, at.z)) return at;
  }
  return null;
}
/**
 * PROF2b: A PIXEL'S MOTHERLODES AS THE CLIENT STANDS THEM - each standing one (`lodes`, net/motherlodeBook.js
 * standingOn) at the foot of the rock piece nearest the pixel's heart, clear of the nodes already stood (`taken`, their
 * `local`s) by NODE_SPACING_M; with no clear foot, on the stone nearest its heart, else where nature stands there. `{ key,
 * what: 'motherlode', slot, tier, material, local, rock, lift, lode }`, `local` pixel-local metres.
 * @param {{ lodes: any[], samples: Float32Array, tilemap: Uint8Array, locationRect?: any, rocks?: number[][], taken?: number[][] }} p
 */
export function standMotherlodes({ lodes, samples, tilemap, locationRect = null, rocks = [], taken = [] }) {
  const out = [];
  const pieces = rocks ?? [];
  const clear = (x, z) => onPixel(x, z) && !insideRocks(pieces, x, z) && ![...taken, ...out.map((n) => n.local)].some((t) => Math.hypot(t[0] - x, t[2] - z) < NODE_SPACING_M);
  for (const lode of lodes ?? []) {
    const cx = TERRAIN_SIZE / 2, cz = TERRAIN_SIZE / 2;
    let local = null, rock = null;
    const order = pieces.map((b, i) => ({ i, d: toBox(b, cx, cz) })).sort((a, b) => a.d - b.d || a.i - b.i);
    for (const { i } of order) {
      for (const [tx, tz] of footTargets(pieces[i], cx, cz)) {
        const foot = rockFoot(pieces[i], tx, tz);
        if (!clear(foot[0], foot[1])) continue;
        local = [foot[0], groundAt(samples, foot[0], foot[1]), foot[1]];
        rock = pieces[i];
        break;
      }
      if (local) break;
    }
    if (!local) {
      // no clear foot at a piece: the stone nearest its heart, else where nature stands there - a Motherlode stands
      // wherever its pixel can hold it, a vein beside it or not (it is the day's one; a vein moves aside for none)
      const t = Math.floor(WORLD_MAP_TILE_DIM / 2);
      const at = nearestStone(samples, tilemap, locationRect, t, t, VEIN_STONE_REACH, pieces) ?? natureStandsAt(samples, tilemap, locationRect, t, t)
        ?? standAnywhere(samples, tilemap, locationRect, pieces);
      if (at && onPixel(at.x, at.z) && !insideRocks(pieces, at.x, at.z)) local = [at.x, at.y, at.z];
    }
    if (!local) continue;
    out.push({ key: lode.key, what: 'motherlode', slot: lode.k, tier: MOTHERLODE_TIER, material: lode.material, local, rock, lift: 0.9, lode });
  }
  return out;
}
/** A dungeon vein's checks: Foraging's inside, settlement, daylight and sea are the surface's (PROF0 5.1, 23) - the foe
 *  and the load are asked. */
export const DUNGEON_SKIP = Object.freeze(['inside', 'town', 'daylight', 'sea']);
/**
 * A DUNGEON'S VEINS AS THE CLIENT STANDS THEM (PROF0 23): the law's veins of the day, each on the wall its ray finds
 * (`wall(marker, bearing)` - the dungeon's own, scenes/dungeonContext.js veinWall: world metres or null) -
 * `{ key, what: 'dvein', slot, tier, material, local, lift }`, `local` the dungeon's own space.
 * @param {{ dungeon: number, day: number, climate: number, confirmed?: boolean,
 *   wall: (marker: number, bearing: number) => (number[]|null) }} p
 */
export function standDungeonVeins({ dungeon, day, climate, confirmed = false, wall }) {
  const out = [];
  for (const v of dungeonVeins({ dungeon, day, climate, confirmed })) {
    const at = wall(v.marker, v.bearing);
    if (!at) continue;
    out.push({ key: dveinKey({ dungeon, day, slot: v.slot }), what: 'dvein', slot: v.slot, tier: v.tier, material: v.material, local: at, lift: 0.4, reach: 2.5 });
  }
  return out;
}
/** A node's flats: a cluster round its foot, turned by its slot. */
export function mineFlats(node) {
  const [x, y, z] = node.local;
  const n = node.what === 'boulder' ? STONE_FLATS : node.what === 'motherlode' ? MOTHERLODE_FLATS : VEIN_FLATS;   // PROF2b: a heap
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = node.slot * 1.7 + (i * 2 * Math.PI) / n;
    const r = i === 0 ? 0 : node.what === 'dvein' ? VEIN_SPREAD / 2 : node.what === 'motherlode' ? MOTHERLODE_SPREAD : VEIN_SPREAD;   // on a wall the ore sits close
    out.push([x + Math.cos(a) * r, y, z + Math.sin(a) * r]);
  }
  return out;
}
/** The picture a node's flats draw: its metal's own item flat, or Lodestone's for a new ore and for loose stone. */
export function mineRecord(node) {
  if (node.what === 'boulder') return LODESTONE_RECORD;
  const m = minedMaterial(node.material);
  const t = m?.group ? templateByIndex(m.templateIndex) : null;
  return Number.isInteger(t?.worldTextureRecord) ? t.worldTextureRecord : LODESTONE_RECORD;
}

/**
 * WHAT E DOES AT A VEIN OR A BOULDER, and the prompt that says it: `{ harvest, verb, rest, ready }` - `ready` false with
 * `rest` naming what is missing (worked today, being counted, the day's cap, the rank, the Pick-Axe, the Stores' room);
 * a rank short carries the rank it needs (`needsRank` - VEIN-NEED says the player's own beside it).
 * @param {{ node: any, taken: boolean, counting: boolean, rank: number, pick: boolean, storesFull: (key: string) => boolean,
 *   today: number, cap: number }} o
 */
export function minePlan({ node, taken, counting, rank, pick, storesFull, today, cap }) {
  const harvest = node.what === 'boulder' ? 'stone' : 'ore';
  const name = node.what === 'boulder' ? 'the stone' : materialLabel(node.material);
  const verb = node.what === 'boulder' ? 'Quarry the stone' : `Mine ${name}`;
  const rankWord = `Mining ${rank}`;
  if (taken) return { harvest, verb: `${node.what === 'boulder' ? 'The stone' : name} - worked today`, rest: '', ready: false };
  if (counting) return { harvest, verb, rest: 'being counted', ready: false };
  if (today >= cap) return { harvest, verb, rest: `${rankWord} - ${today} of ${cap} today`, ready: false, full: true };
  if (!tierOpen(rank, node.tier)) return { harvest, verb, rest: `needs Mining ${TIER_RANKS[node.tier - 1]}`, ready: false, needsRank: TIER_RANKS[node.tier - 1] };
  if (!pick) return { harvest, verb, rest: 'needs a Pick-Axe', ready: false };
  if (storesFull(node.material)) return { harvest, verb, rest: `Stores full - ${materialLabel(node.material)}`, ready: false };
  return { harvest, verb, rest: rankWord, ready: true };
}

/**
 * PROF2b: WHAT E DOES AT A MOTHERLODE - minePlan's shape: struck today by this character (or being counted), the
 * account's one found, an Apprentice's Mining (MOTHERLODE_RANK, not tier 6's), the Pick-Axe, the Stores' room. The
 * day's sixty are a vein's; a Motherlode is none of them.
 * @param {{ node: any, taken: boolean, counting: boolean, found: boolean, rank: number, pick: boolean, storesFull: (key: string) => boolean }} o
 */
export function motherlodePlan({ node, taken, counting, found, rank, pick, storesFull }) {
  const name = materialLabel(node.material);
  const verb = `Strike the Motherlode of ${name}`;
  if (taken) return { harvest: 'ore', verb: 'The Motherlode - struck today', rest: '', ready: false };
  if (counting) return { harvest: 'ore', verb, rest: 'being counted', ready: false };
  if (found) return { harvest: 'ore', verb, rest: 'your Motherlode today is found', ready: false };
  if (rank < MOTHERLODE_RANK) return { harvest: 'ore', verb, rest: `needs Mining ${MOTHERLODE_RANK}`, ready: false, needsRank: MOTHERLODE_RANK };
  if (!pick) return { harvest: 'ore', verb, rest: 'needs a Pick-Axe', ready: false };
  if (storesFull(node.material)) return { harvest: 'ore', verb, rest: `Stores full - ${name}`, ready: false };
  return { harvest: 'ore', verb, rest: `Mining ${rank}`, ready: true };
}

/** The hand's StrikeDown frame for a swing's phase (1 just struck, 0 none) - Idle between swings. */
export const pickHandFrame = (swing) => (swing > 0 ? { state: 'StrikeDown', frame: Math.min(STRIKE_FRAMES - 1, Math.floor((1 - swing) * STRIKE_FRAMES)) } : { state: 'Idle', frame: 0 });

/**
 * MINING'S KIND in the gathering host (scenes/gatherHost.js): the veins and boulders, their pictures, the plan, the act.
 * PROF2b: and the Motherlodes standing (`lodes`, net/motherlodeBook.js), their strike's silver said through `marks`
 * (net/marksBook.js strikeLine).
 * @param {{ book: any, lodes?: any, marks?: any }} deps
 * @returns {import('./gatherHost.js').GatherKind}
 */
export function mineKind({ book, lodes = null, marks = null }) {
  const harvestOf = (n) => (n.what === 'boulder' ? 'stone' : 'ore');
  const gone = (n) => book.taken(n.key, harvestOf(n)) || (n.what === 'motherlode' && !!lodes?.found?.());   // PROF2b: the account's one found
  return {
    id: 'mine',
    professions: Object.freeze(['mining']),
    nodesOf({ px, py, day, info, confirmed, entry }) {
      const stone = {
        samples: entry.samples, tilemap: entry.tilemap, locationRect: entry.locationRect ?? entry.wodSite ?? null, rocks: entry.rocks ?? [],   // AUDIT 29 C8
      };
      const nodes = standMineNodes({ px, py, day, climate: info.climate, region: info.region, confirmed, ...stone });
      // PROF2b: a Motherlode standing on this pixel, clear of its veins and boulders
      const here = lodes?.standingOn?.(px, py) ?? [];
      return here.length ? [...nodes, ...standMotherlodes({ lodes: here, ...stone, taken: nodes.map((n) => n.local) })] : nodes;
    },
    dungeonNodesOf({ dungeon, day, info, confirmed, wall }) {
      return standDungeonVeins({ dungeon, day, climate: info.climate, confirmed, wall });
    },
    flatsOf: (n) => [{ archive: ORE_FLAT_ARCHIVE, record: mineRecord(n), scale: n.what === 'boulder' ? STONE_SCALE : n.what === 'motherlode' ? MOTHERLODE_SCALE : VEIN_SCALE, centers: mineFlats(n) }],
    gone,
    /** NODE-MARKS: every vein and boulder standing; a Prospector's veins from PROSPECT_M off (PROF0 3.3) */
    mark(n, { specs }) {
      if (gone(n)) return null;
      if (n.what === 'motherlode') return MOTHERLODE_MARK;   // PROF2b: from 400 m, whatever the specialisation
      return (specs('mining')[50] === 'prospector' && PROSPECTOR_MARKS[n.what]) || MINE_MARKS[n.what] || MINE_MARKS.vein;
    },
    tools: Object.freeze([FT.PickAxe]),   // TOOL-USE: the Pick-Axe's Use at a vein or a boulder is E there
    where: (n) => (n.what === 'dvein' ? null : actChecksRefusal(GROUND_WHERE, GROUND_WHERE_WORDS)),   // SETTLE-SAID: a dungeon's vein asks no settlement (DUNGEON_SKIP)
    /** PROF-MENU: the menu's title - the boulder, or the vein's ore. */
    nodeName: (n) => (n.what === 'boulder' ? 'Boulder' : n.what === 'motherlode' ? `Motherlode of ${materialLabel(n.material).replace(/ Ore$/, '')}` : `${materialLabel(n.material).replace(/ Ore$/, '')} Vein`),
    plan(n, { entity, rank }) {
      if (n.what === 'motherlode') {   // PROF2b
        const plan = motherlodePlan({
          node: n, taken: book.taken(n.key, 'ore'), counting: book.counting(n.key, 'ore'), found: !!lodes?.found?.(), rank: rank('mining'),
          pick: !!foragingToolIn(entity, FT.PickAxe), storesFull: (key) => storesFullIn(book, key),
        });
        return { ...plan, profession: 'mining' };
      }
      const plan = minePlan({
        node: n, taken: book.taken(n.key, harvestOf(n)), counting: book.counting(n.key, harvestOf(n)), rank: rank('mining'),
        pick: !!foragingToolIn(entity, FT.PickAxe), storesFull: (key) => storesFullIn(book, key),   // STORES-ROOM: every origin, as the service counts
        today: book.state.today?.mining ?? 0, cap: book.state.caps?.harvests ?? 60,
      });
      return { ...plan, profession: 'mining' };
    },
    start(n, plan, { entity, rank }) {
      const refusal = foragingActRefusal(FT.PickAxe, n.what === 'dvein' ? DUNGEON_SKIP : null);
      if (refusal) return { refused: refusal };
      // PROF2b: a Motherlode's strike carries the relay's word that it stood on its pixel - none yet, no act
      const watch = n.what === 'motherlode' ? lodes?.watchFor?.(n.lode.x, n.lode.y) ?? null : null;
      if (n.what === 'motherlode' && !watch) return { refused: MOTHERLODE_TEXT.watch };
      return {
        act: createMineAct({
          tier: n.tier, band: pickAxeBand({ intelligence: liveStat(entity, 'intelligence'), agility: liveStat(entity, 'agility') }),
          master: rank('mining') >= PROF_RANK_MAX, gentle: getPref('gentleActs') === true,
        }),
        harvest: plan.harvest, tool: foragingToolIn(entity, FT.PickAxe), profession: 'mining', label: '',
        hand: (a) => (a.tool ? { ...PICK_HAND, ...pickHandFrame(a.act.swing) } : null),
        // AUDIT SILVER-WAYS D5: the receipt asked again at the act's end - the newest standing then (one the relay handed
        // during a long act), the start's where none newer stands
        ...(watch ? { ask: () => ({ watch: lodes?.watchFor?.(n.lode.x, n.lode.y, 0) ?? watch }) } : {}),
      };
    },
    /** AUDIT SILVER-WAYS D2: a Motherlode's refusal told to the Motherlodes' book (its twenty, the find, the list read
     *  again), which stands its pixel again. */
    refused(key, error) {
      if (typeof key === 'string' && key.startsWith('mlode:')) lodes?.refused?.(key, error);
    },
    /** PROF2b: a Motherlode's answer - the find and its count told to the Motherlodes' book, its silver said. */
    answered(d, toast, o = {}) {
      if (!d?.motherlode) return;
      lodes?.heard?.(d);
      const line = d.marks ? marks?.strikeLine?.(d.marks) ?? null : null;   // the balance kept either way
      if (typeof line === 'string' && line && o?.hauled !== true) toast(line);   // HAUL-CARDS: its card says the silver
    },
    cleanNote: () => ' (every strike on the glint)',
    title: () => 'Miner',
  };
}
