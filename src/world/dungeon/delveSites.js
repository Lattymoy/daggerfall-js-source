// @ts-check
// DELVE II (bible/03-World/Delve-II.md section 4; the owner, 2026-10-28: "Every dungeon"): THE SITE LAW - where a
// dungeon's encounters stand, in rooms its layout already has. dungeonFires.js's shape and its rules (a pure law over the
// layout, the collider's answers handed in, squared distances, literal bearings, a seeded tie), widened to a room: a disc
// of level floor with walls round it, clear of every door, marker, fire and the way in. Every client stands the same
// sites, so nothing about where they are rides the wire. Not a DFU member (Ledger A: DELVE II).
import { hash32 } from '../blockHash.js';
import { dungeonStart, enemyMarks, itemMarks, isPalaceLayout, isBorderBlock, colliderFireProbe, blockWaterY } from './dungeonFires.js';
import { RDB_SIDE } from '../rdbLayout.js';
import { DELVE_KINDS, DELVE_KIND_NAMES, DELVE_FAMILIES } from '../../net/delve/delveLaw.js';

/** @typedef {{ r: number, flatNy: number, levelM: number, rings: readonly number[], ceilingM: number, enclosedM: number,
 *   enclosedRays: number, gridM: number, doorM: number, enemyM: number, itemM: number, startM: number, fireM: number,
 *   dryM: number, storeyM: number, spacingM: number, perBlocks: number, max: number }} SiteLaw */
/** @type {Readonly<SiteLaw>} */
export const DSITE = Object.freeze({
  r: 4,               // the disc of level, clear floor a site needs (the census, Delve-II.md section 4)
  flatNy: 0.99,       // a floor that is flat (the fire law's ray finds it within 4 m below)
  levelM: 0.25,       // level to this on every ring
  rings: Object.freeze([1.5, 3, 4]),   // the rings the floor is asked on (the last the disc's own edge)
  ceilingM: 12,       // a ceiling within this far over it: inside a room
  enclosedM: 30,      // and walls - at least `enclosedRays` of the eight chest-height rays meet one within this far
  enclosedRays: 4,
  gridM: 4,           // the candidates' grid over a block
  doorM: 4.5,         // from every door (the disc and half a metre)
  enemyM: 2,          // an enemy marker never at its heart, on its storey (the halls the foes stand in are the rooms a site wants)
  itemM: 4,           // from every start, treasure and quest marker on its storey
  startM: 20,         // from the way in
  fireM: 12,          // from every campfire, the layout's and the law's
  dryM: 0.5,          // over the block's water
  storeyM: 6,         // the height band that stands in for a storey
  spacingM: 60,       // between sites
  perBlocks: 2, max: 3,
});
/** THE SMALL ROOM: the second pass, where the first stood fewer sites than the layout wants - a 3 m disc on a 2 m grid,
 *  nearer the doors, the markers, the way in and the fires (the census, section 4: a site in 74 dungeons of a hundred
 *  becomes 92). */
/** @type {Readonly<SiteLaw>} */
export const DSITE_SMALL = Object.freeze({ ...DSITE, r: 3, rings: Object.freeze([1.5, 3]), gridM: 2, doorM: 3.5, itemM: 3, startM: 12, fireM: 8 });
const R2 = Math.SQRT1_2;
/** The eight bearings, literals and one IEEE product, in dungeonFires.js ringOf's order. @type {ReadonlyArray<readonly number[]>} */
const EIGHT = Object.freeze([[1, 0], [-1, 0], [0, 1], [0, -1], [R2, R2], [R2, -R2], [-R2, R2], [-R2, -R2]].map((b) => Object.freeze(b)));
const d2 = (a, b) => { const x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2]; return x * x + y * y + z * z; };
const flat2 = (a, b) => { const x = a[0] - b[0], z = a[2] - b[2]; return x * x + z * z; };
const deep = (a, b) => { const x = a[0] - b[0], y = 2 * (a[1] - b[1]), z = a[2] - b[2]; return x * x + y * y + z * z; };
const SQ = (m) => m * m;
const cm = (v) => Math.round(v * 100) / 100;
const ONLY_DUNGEON = Object.freeze({ only: Object.freeze(['dungeon']) });
const SITE_SALT = 0x5d17;

/** How many sites a layout stands: one for two non-border blocks, one to three - none in a palace. Pure. */
export function delveSiteCount(blocks) {
  if (isPalaceLayout(blocks)) return 0;
  const n = (blocks ?? []).filter((b) => !isBorderBlock(b?.name)).length;
  return Math.max(1, Math.min(DSITE.max, Math.floor(n / DSITE.perBlocks)));
}

/** THE COLLIDER'S ANSWERS (player/collider.js): `floor` the fire law's own (a face that looks up, the dungeon's mesh);
 *  `room(p, r)` a ceiling within DSITE.ceilingM, the eight chest-height rays each clear past the disc `r` and at least
 *  DSITE.enclosedRays of them meeting a wall within DSITE.enclosedM, and the body fits - with each ray's wall (Infinity
 *  where none), which the vault reads. */
export function colliderSiteProbe(collider) {
  const { floor } = colliderFireProbe(collider);
  return {
    floor,
    room: (p, r = DSITE.r) => {
      if (!Number.isFinite(collider.raycast([p[0], p[1] + 0.2, p[2]], [0, 1, 0], DSITE.ceilingM, ONLY_DUNGEON))) return null;
      const walls = EIGHT.map(([dx, dz]) => collider.raycast([p[0], p[1] + 0.9, p[2]], [dx, 0, dz], DSITE.enclosedM, ONLY_DUNGEON));
      if (walls.some((d) => d < r) || walls.filter((d) => Number.isFinite(d)).length < DSITE.enclosedRays) return null;
      return collider.penetrationAt([p[0], p[1] + 0.05, p[2]]) < 0.03 ? { walls } : null;
    },
  };
}

/** THE CANDIDATES: a grid `gridM` apart over every non-border block, at each storey its markers stand on (their heights,
 *  a storey apart), in layout order - block, storey, row, column. A palace's castle block holds none. Pure. */
export function siteCandidates(blocks, /** @type {number} */ gridM = DSITE.gridM) {
  const out = [];
  const n = Math.floor(RDB_SIDE / gridM), pad = (RDB_SIDE - (n - 1) * gridM) / 2;
  (blocks ?? []).forEach((b, bi) => {
    const lay = b?.layout;
    if (!lay || lay.castleBlock || isBorderBlock(b.name)) return;
    const water = blockWaterY(lay);
    const ys = (lay.markers ?? []).filter((m) => m && m.archive == null).map((m) => m.y).sort((a, c) => a - c);
    const storeys = [];
    for (const y of ys.length ? ys : [0]) if (!storeys.length || y - storeys[storeys.length - 1] >= DSITE.storeyM) storeys.push(y);
    for (const y of storeys) {
      for (let gz = 0; gz < n; gz++) {
        for (let gx = 0; gx < n; gx++) out.push({ pos: [b.originX + pad + gx * gridM, y, b.originZ + pad + gz * gridM], block: bi, start: !!b.isStartingBlock, water });
      }
    }
  });
  return out;
}
/** Is the floor level and flat on every ring round `pos` (already on its floor)? */
function levelDisc(probe, pos, rings) {
  for (let k = rings.length - 1; k >= 0; k--) {
    const r = rings[k];
    for (const [dx, dz] of EIGHT) {
      const g = probe.floor([pos[0] + dx * r, pos[1], pos[2] + dz * r]);
      if (!g || !(g.ny > DSITE.flatNy) || !(Math.abs(g.y - pos[1]) <= DSITE.levelM)) return false;
    }
  }
  return true;
}

/**
 * LAND AND KEEP: each candidate's first spot on which every rule of `law` (DSITE, or DSITE_SMALL) holds - a floor, dry,
 * clear of the doors, the markers, the fires and the way in, level on every ring, a room round it. `probe` the scene's
 * (colliderSiteProbe); the rest positions in the dungeon's frame; `tally` (the census's) counts each refused spot's
 * first broken rule. Answers `{ ...candidate, pos, walls }`, in layout order.
 * @typedef {{ probe?: any, doors?: number[][], enemies?: number[][], items?: number[][], fires?: number[][],
 *   start?: number[] | null, tally?: Record<string, any> | null, law?: Readonly<SiteLaw> }} LandOpts
 */
export function landDelveSites(cands, /** @type {LandOpts} */ { probe, doors = [], enemies = [], items = [], fires = [], start = null, tally = null, law = DSITE } = {}) {
  const out = [];
  const storeyClear = (list, pos, m) => list.every((q) => flat2(q, pos) >= SQ(m) || Math.abs(q[1] - pos[1]) >= law.storeyM);
  const no = (rule) => { if (tally) tally[rule] = (tally[rule] ?? 0) + 1; };
  for (const c of cands ?? []) {
    const at = c.pos;
    const f = probe?.floor?.(at);
    if (!f || !Number.isFinite(f.y) || !(f.ny > law.flatNy)) { no('floor'); continue; }
    const pos = [at[0], f.y, at[2]];
    if (pos[1] < c.water + law.dryM) { no('water'); continue; }
    if (doors.some((d) => d2(d, pos) < SQ(law.doorM))) { no('door'); continue; }
    if (!storeyClear(enemies, pos, law.enemyM)) { no('enemy'); continue; }
    if (!storeyClear(items, pos, law.itemM)) { no('item'); continue; }
    if (start && d2(start, pos) < SQ(law.startM)) { no('start'); continue; }
    if (fires.some((q) => d2(q, pos) < SQ(law.fireM))) { no('fire'); continue; }
    if (!levelDisc(probe, pos, law.rings)) { no('level'); continue; }
    const room = probe?.room?.(pos, law.r);
    if (!room) { no('room'); continue; }
    out.push({ ...c, pos, walls: room.walls });
  }
  return out;
}

/** THE CHOICE: the deepest first (farthest from the way in, height counted twice) where nothing stands yet, then
 *  farthest-point spread DSITE.spacingM from every site and every `taken` spot, a storey with none served first; every
 *  tie by the dungeon's seed. Answers the `count` chosen (or fewer), in order. */
export function chooseSites(valid, /** @type {{ seed?: number, start?: number[] | null, count?: number, taken?: number[][] }} */ { seed = 0, start = null, count = 1, taken = [] } = {}) {
  const pool = (valid ?? []).map((c, i) => ({ ...c, tie: hash32(seed >>> 0, i, SITE_SALT) }));
  const chosen = [];
  if (!pool.length || count <= 0) return chosen;
  const better = (a, b, sa, sb) => (sa !== sb ? sa > sb : a.tie < b.tie);
  const take = (c) => { chosen.push(c); pool.splice(pool.indexOf(c), 1); };
  const from = start ?? pool[0].pos;
  if (!taken.length) take(pool.reduce((best, c) => (!best || better(c, best, deep(c.pos, from), deep(best.pos, from)) ? c : best), null));
  const band = (p) => Math.floor(p[1] / DSITE.storeyM);
  while (chosen.length < count) {
    const near = [...taken, ...chosen.map((q) => q.pos)];
    const open = pool.filter((c) => near.every((q) => d2(q, c.pos) >= SQ(DSITE.spacingM)));
    if (!open.length) break;
    const lit = new Set(near.map(band));
    const unserved = open.filter((c) => !lit.has(band(c.pos)));
    const score = (c) => Math.min(...near.map((q) => d2(q, c.pos)));
    take((unserved.length ? unserved : open).reduce((best, c) => (!best || better(c, best, score(c), score(best)) ? c : best), null));
  }
  return chosen;
}

/** THE KINDS: drawn off the seed, a site at a time, from `kinds` (the ones built); two sites or more hold one of each
 *  family where both are offered - the first site's family drawn, the second the other. Pure. */
export function siteKinds(count, seed, kinds = DELVE_KIND_NAMES) {
  const pool = DELVE_KIND_NAMES.filter((k) => kinds.includes(k));
  if (!pool.length) return [];
  const fam = DELVE_FAMILIES.filter((f) => pool.some((k) => DELVE_KINDS[k].family === f));
  const out = [];
  for (let i = 0; i < count; i++) {
    const h = hash32(seed >>> 0, i, SITE_SALT + 1);
    let f = fam[h % fam.length];
    if (i === 1 && fam.length > 1) f = fam.find((x) => x !== DELVE_KINDS[out[0]].family) ?? f;
    const of = pool.filter((k) => DELVE_KINDS[k].family === f);
    out.push(of[(h >>> 8) % of.length]);
  }
  return out;
}

/** The vault's spot: toward the nearest wall (the first of the eight bearings on a tie), the disc less 0.6 m out. */
function vaultSpot(pos, walls, r) {
  let j = 0;
  for (let k = 1; k < EIGHT.length; k++) if (walls[k] < walls[j]) j = k;
  const g = r - 0.6;
  return [cm(pos[0] + EIGHT[j][0] * g), pos[1], cm(pos[2] + EIGHT[j][1] * g)];
}

/** THE WHOLE LAW, for the scene: `blocks` the layout's, `probe` the collider's answers (colliderSiteProbe), `doors` its
 *  doors and `fires` its campfires (dungeonFires.js fireLayoutInputs and the fire plan), `seed` its locationId, `tier`
 *  dungeonTier's word, `kinds` those built, `none` a dungeon that stands none (the caller's: the Hold, a made level, the
 *  Abyss Hollow). The large rooms first, then the small ones for what they leave short. Answers `{ sites, candidates,
 *  valid, small }` - the sites as delveLaw.js reads them, and the census's counts (`small` the second pass's sites).
 *  @typedef {{ blocks?: any[], probe?: any, doors?: number[][], fires?: number[][], seed?: number, tier?: string,
 *   kinds?: readonly string[], none?: boolean, tally?: Record<string, any> | null }} PlanOpts */
export function delveSitePlan(/** @type {PlanOpts} */ { blocks, probe, doors = [], fires = [], seed = 0, tier = 'regular', kinds = DELVE_KIND_NAMES, none = false, tally = null } = {}) {
  const count = none ? 0 : delveSiteCount(blocks);
  const cands = siteCandidates(blocks);
  if (count <= 0) return { sites: [], candidates: cands.length, valid: 0, small: 0 };
  const start = dungeonStart(blocks);
  const marks = { probe, doors, enemies: enemyMarks(blocks), items: itemMarks(blocks), fires, start };
  const valid = landDelveSites(cands, { ...marks, tally });
  const large = chooseSites(valid, { seed, start, count }).map((c) => ({ c, r: DSITE.r }));
  let small = [];
  if (large.length < count) {
    const spots = landDelveSites(siteCandidates(blocks, DSITE_SMALL.gridM), { ...marks, tally: tally ? (tally.small ??= {}) : null, law: DSITE_SMALL });
    small = chooseSites(spots, { seed, start, count: count - large.length, taken: large.map(({ c }) => c.pos) }).map((c) => ({ c, r: DSITE_SMALL.r }));
  }
  const chosen = [...large, ...small];
  const kindOf = siteKinds(chosen.length, seed, kinds);
  const sites = chosen.map(({ c, r }, i) => ({
    i, kind: kindOf[i], x: cm(c.pos[0]), y: cm(c.pos[1]), z: cm(c.pos[2]), r, tier, vault: vaultSpot(c.pos, c.walls, r),
  }));
  return { sites, candidates: cands.length, valid: valid.length, small: small.length };
}
