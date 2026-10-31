// @ts-check
// DELVE II (bible/03-World/Delve-II.md section 4; the owner, 2026-10-28: "Every dungeon"): THE SITE LAW - where a
// dungeon's encounters stand, in rooms its layout already has. dungeonFires.js's shape and its rules (a pure law over the
// layout, the collider's answers handed in, squared distances, literal bearings, a seeded tie), widened to a room: a disc
// of level floor with walls round it, clear of the doors, the movers, the start, treasure and quest markers, the fires and
// the way in (a foe's marker only off its heart). Every client stands the same sites, so nothing about where they are
// rides the wire. Not a DFU member (Ledger A: DELVE II).
import { hash32 } from '../blockHash.js';
import {
  dungeonStart,
  enemyMarks,
  itemMarks,
  isPalaceLayout,
  isBorderBlock,
  colliderFireProbe,
  blockWaterY,
  DFIRE,
} from './dungeonFires.js';
import { RDB_SIDE } from '../rdbLayout.js';
import {
  DELVE_KINDS,
  DELVE_KIND_NAMES,
  DELVE_FAMILIES,
  DELVE_HEART_VAULTS,
  LITANY_RING_M,
  litanyCount,
} from '../../net/delve/delveLaw.js';
import { curatedAnchors } from './curatedBlocks.js'; // DLV5: a curated block's encounters, designed
import { curatedRecordsLive } from './curatedRecords.js';

/** @typedef {{ r: number, flatNy: number, levelM: number, rings: readonly number[], ceilingM: number, enclosedM: number,
 *   enclosedRays: number, gridM: number, doorM: number, enemyM: number, itemM: number, startM: number, fireM: number,
 *   dryM: number, storeyM: number, spacingM: number, perBlocks: number, max: number }} SiteLaw */
/** @type {Readonly<SiteLaw>} */
export const DSITE = Object.freeze({
  r: 4, // the disc of level, clear floor a site needs (the census, Delve-II.md section 4)
  flatNy: 0.99, // a floor that is flat (the fire law's ray finds it within 4 m below)
  levelM: 0.25, // level to this on every ring
  rings: Object.freeze([1.5, 3, 4]), // the rings the floor is asked on (the last the disc's own edge)
  ceilingM: 12, // a ceiling within this far over it: inside a room
  enclosedM: 30, // and walls - at least `enclosedRays` of the eight chest-height rays meet one within this far
  enclosedRays: 4,
  gridM: 4, // the candidates' grid over a block
  doorM: 4.5, // from every door (the disc and half a metre)
  enemyM: 2, // an enemy marker never at its heart, on its storey (the halls the foes stand in are the rooms a site wants)
  itemM: 4, // from every start, treasure and quest marker on its storey
  startM: 20, // from the way in
  fireM: 12, // from every campfire, the layout's and the law's
  dryM: 0.5, // over the block's water
  storeyM: 6, // the height band that stands in for a storey
  spacingM: 60, // between sites
  perBlocks: 2,
  max: 3,
});
/** THE SMALL ROOM: the second pass, where the first stood fewer sites than the layout wants - a 3 m disc on a 2 m grid,
 *  nearer the doors, the markers, the way in and the fires (the census, Delve-II.md section 4). */
/** @type {Readonly<SiteLaw>} */
export const DSITE_SMALL = Object.freeze({
  ...DSITE,
  r: 3,
  rings: Object.freeze([1.5, 3]),
  gridM: 2,
  doorM: 3.5,
  itemM: 3,
  startM: 12,
  fireM: 8,
});
const R2 = Math.SQRT1_2;
/** The eight bearings, literals and one IEEE product, in dungeonFires.js ringOf's order. @type {ReadonlyArray<readonly number[]>} */
const EIGHT = Object.freeze(
  [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [R2, R2],
    [R2, -R2],
    [-R2, R2],
    [-R2, -R2],
  ].map((b) => Object.freeze(b)),
);
/** Where every piece of either kind stands, each asked on its own spot: the Litany's plates (the tier's four or five,
 *  delveLaw.js litanyPlates' bearings), the Hold's gates (the diagonals, half a metre in) and its vault (an axis, 0.6 m
 *  in - vaultSpot). Between them a room may hold what rooms hold (AUDIT DELVE II L9: the census). */
const PLATES = Object.freeze({
  4: Object.freeze(
    [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ].map((b) => Object.freeze(b)),
  ),
  5: Object.freeze(
    [
      [0, 1],
      [0.951057, 0.309017],
      [0.587785, -0.809017],
      [-0.587785, -0.809017],
      [-0.951057, 0.309017],
    ].map((b) => Object.freeze(b)),
  ),
});
const d2 = (a, b) => {
  const x = a[0] - b[0],
    y = a[1] - b[1],
    z = a[2] - b[2];
  return x * x + y * y + z * z;
};
const flat2 = (a, b) => {
  const x = a[0] - b[0],
    z = a[2] - b[2];
  return x * x + z * z;
};
const deep = (a, b) => {
  const x = a[0] - b[0],
    y = 2 * (a[1] - b[1]),
    z = a[2] - b[2];
  return x * x + y * y + z * z;
};
const SQ = (m) => m * m;
const cm = (v) => Math.round(v * 100) / 100;
const ONLY_DUNGEON = Object.freeze({ only: Object.freeze(['dungeon']) });
const SKIP_DUNGEON = Object.freeze({ skip: Object.freeze(['dungeon']) });
/** The height a site keeps clear over its floor (m): a body's, and a hand over it. */
const CLEAR_H = 2.5;
/** Whether a world box reaches into the disc of radius `r` at `p` (its floor) up to CLEAR_H over it. Pure. */
export function boxMeetsDisc(b, p, r) {
  if (b.max[1] < p[1] - 0.25 || b.min[1] > p[1] + CLEAR_H) return false;
  const dx = Math.max(b.min[0] - p[0], 0, p[0] - b.max[0]),
    dz = Math.max(b.min[2] - p[2], 0, p[2] - b.max[2]);
  return dx * dx + dz * dz < r * r;
}
const SITE_SALT = 0x5d17;

/** How many sites a layout stands: one for two non-border blocks, one to three - none in a palace. Pure. */
export function delveSiteCount(blocks) {
  if (isPalaceLayout(blocks)) return 0;
  const n = (blocks ?? []).filter((b) => !isBorderBlock(b?.name)).length;
  return Math.max(1, Math.min(DSITE.max, Math.floor(n / DSITE.perBlocks)));
}

/** THE COLLIDER'S ANSWERS (player/collider.js): `floor` the fire law's own (a face that looks up, the dungeon's mesh);
 *  `room(p, r)` no mover, door or other piece not the dungeon's own reaching into the disc `r` (its box at the build
 *  pose, every client's the same), a ceiling within DSITE.ceilingM, the eight chest-height rays each clear past the disc
 *  and at least DSITE.enclosedRays of them meeting a wall within DSITE.enclosedM, and the body fits - with each ray's
 *  wall (Infinity where none), which the vault reads. */
export function colliderSiteProbe(collider) {
  const { floor } = colliderFireProbe(collider);
  const others = collider.bucketBoxes?.(SKIP_DUNGEON) ?? [];
  return {
    floor,
    room: (p, r = DSITE.r) => {
      if (others.some((b) => boxMeetsDisc(b, p, r))) return null;
      if (!Number.isFinite(collider.raycast([p[0], p[1] + 0.2, p[2]], [0, 1, 0], DSITE.ceilingM, ONLY_DUNGEON)))
        return null;
      const walls = EIGHT.map(([dx, dz]) =>
        collider.raycast([p[0], p[1] + 0.9, p[2]], [dx, 0, dz], DSITE.enclosedM, ONLY_DUNGEON),
      );
      if (walls.some((d) => d < r) || walls.filter((d) => Number.isFinite(d)).length < DSITE.enclosedRays) return null;
      return collider.penetrationAt([p[0], p[1] + 0.05, p[2]]) < 0.03 ? { walls } : null;
    },
  };
}

/** THE CANDIDATES: a grid `gridM` apart over every non-border block, at each storey its markers stand on (their heights,
 *  a storey apart), in layout order - block, storey, row, column. A palace's castle block holds none. Pure. */
export function siteCandidates(blocks, /** @type {number} */ gridM = DSITE.gridM) {
  const out = [];
  const n = Math.floor(RDB_SIDE / gridM),
    pad = (RDB_SIDE - (n - 1) * gridM) / 2;
  (blocks ?? []).forEach((b, bi) => {
    const lay = b?.layout;
    if (!lay || lay.castleBlock || isBorderBlock(b.name)) return;
    const water = blockWaterY(lay);
    const ys = (lay.markers ?? [])
      .filter((m) => m && m.archive == null)
      .map((m) => m.y)
      .sort((a, c) => a - c);
    const storeys = [];
    for (const y of ys.length ? ys : [0])
      if (!storeys.length || y - storeys[storeys.length - 1] >= DSITE.storeyM) storeys.push(y);
    for (const y of storeys) {
      for (let gz = 0; gz < n; gz++) {
        for (let gx = 0; gx < n; gx++)
          out.push({
            pos: [b.originX + pad + gx * gridM, y, b.originZ + pad + gz * gridM],
            block: bi,
            start: !!b.isStartingBlock,
            water,
          });
      }
    }
  });
  return out;
}
/** Is the floor level and flat round `pos` (already on its floor) - on every ring of `law` at the eight bearings, the
 *  outer ring first, and on every piece's own spot (the `tier`'s plates, the gates, the vault's four)? */
function levelDisc(probe, pos, law, tier) {
  const flat = (x, z) => {
    const g = probe.floor([x, pos[1], z]);
    return !!g && g.ny > law.flatNy && Math.abs(g.y - pos[1]) <= law.levelM;
  };
  for (let k = law.rings.length - 1; k >= 0; k--) {
    for (const [dx, dz] of EIGHT) if (!flat(pos[0] + dx * law.rings[k], pos[2] + dz * law.rings[k])) return false;
  }
  for (const [dx, dz] of PLATES[litanyCount(tier)])
    if (!flat(pos[0] + dx * LITANY_RING_M, pos[2] + dz * LITANY_RING_M)) return false;
  const g = law.r - 0.5,
    v = law.r - 0.6;
  for (const [dx, dz] of EIGHT.slice(4)) if (!flat(pos[0] + dx * g, pos[2] + dz * g)) return false;
  for (const [dx, dz] of EIGHT.slice(0, 4)) if (!flat(pos[0] + dx * v, pos[2] + dz * v)) return false;
  return true;
}

/**
 * LAND AND KEEP: each candidate's first spot on which every rule of `law` (DSITE, or DSITE_SMALL) holds - a floor, dry,
 * clear of the doors, the markers, the fires and the way in, level on every ring, a room round it. `probe` the scene's
 * (colliderSiteProbe); the rest positions in the dungeon's frame; `tally` (the census's) counts each refused spot's
 * first broken rule. Answers `{ ...candidate, pos, walls }`, in layout order.
 * @typedef {{ probe?: any, doors?: number[][], enemies?: number[][], items?: number[][], fires?: number[][],
 *   start?: number[] | null, tally?: Record<string, any> | null, law?: Readonly<SiteLaw>, tier?: string }} LandOpts
 */
export function landDelveSites(
  cands,
  /** @type {LandOpts} */ {
    probe,
    doors = [],
    enemies = [],
    items = [],
    fires = [],
    start = null,
    tally = null,
    law = DSITE,
    tier = 'regular',
  } = {},
) {
  const out = [];
  const storeyClear = (list, pos, m) =>
    list.every((q) => flat2(q, pos) >= SQ(m) || Math.abs(q[1] - pos[1]) >= law.storeyM);
  const no = (rule) => {
    if (tally) tally[rule] = (tally[rule] ?? 0) + 1;
  };
  for (const c of cands ?? []) {
    const at = c.pos;
    const f = probe?.floor?.(at);
    if (!f || !Number.isFinite(f.y) || !(f.ny > law.flatNy)) {
      no('floor');
      continue;
    }
    const pos = [at[0], f.y, at[2]];
    if (pos[1] < c.water + law.dryM) {
      no('water');
      continue;
    }
    if (doors.some((d) => d2(d, pos) < SQ(law.doorM))) {
      no('door');
      continue;
    }
    if (!storeyClear(enemies, pos, law.enemyM)) {
      no('enemy');
      continue;
    }
    if (!storeyClear(items, pos, law.itemM)) {
      no('item');
      continue;
    }
    if (start && d2(start, pos) < SQ(law.startM)) {
      no('start');
      continue;
    }
    if (fires.some((q) => d2(q, pos) < SQ(law.fireM))) {
      no('fire');
      continue;
    }
    if (!levelDisc(probe, pos, law, tier)) {
      no('level');
      continue;
    }
    const room = probe?.room?.(pos, law.r);
    if (!room) {
      no('room');
      continue;
    }
    out.push({ ...c, pos, walls: room.walls });
  }
  return out;
}

/** THE CHOICE: the deepest first (farthest from the way in, height counted twice) where nothing stands yet, then
 *  farthest-point spread DSITE.spacingM from every site and every `taken` spot, a storey with none served first; every
 *  tie by the dungeon's seed. Answers the `count` chosen (or fewer), in order. */
export function chooseSites(
  valid,
  /** @type {{ seed?: number, start?: number[] | null, count?: number, taken?: number[][] }} */ {
    seed = 0,
    start = null,
    count = 1,
    taken = [],
  } = {},
) {
  const pool = (valid ?? []).map((c, i) => ({ ...c, tie: hash32(seed >>> 0, i, SITE_SALT) }));
  const chosen = [];
  if (!pool.length || count <= 0) return chosen;
  const better = (a, b, sa, sb) => (sa !== sb ? sa > sb : a.tie < b.tie);
  const take = (c) => {
    chosen.push(c);
    pool.splice(pool.indexOf(c), 1);
  };
  const from = start ?? pool[0].pos;
  if (!taken.length)
    take(
      pool.reduce((best, c) => (!best || better(c, best, deep(c.pos, from), deep(best.pos, from)) ? c : best), null),
    );
  const band = (p) => Math.floor(p[1] / DSITE.storeyM);
  while (chosen.length < count) {
    const near = [...taken, ...chosen.map((q) => q.pos)];
    const open = pool.filter((c) => near.every((q) => d2(q, c.pos) >= SQ(DSITE.spacingM)));
    if (!open.length) break;
    const lit = new Set(near.map(band));
    const unserved = open.filter((c) => !lit.has(band(c.pos)));
    const score = (c) => Math.min(...near.map((q) => d2(q, c.pos)));
    take(
      (unserved.length ? unserved : open).reduce(
        (best, c) => (!best || better(c, best, score(c), score(best)) ? c : best),
        null,
      ),
    );
  }
  return chosen;
}

/** THE KINDS: drawn off the seed, a site at a time, from `kinds` (the ones built); two sites or more hold one of each
 *  family where both are offered - the first site's family drawn, the second the other. `first` the kinds already
 *  stood (DLV5: a curated block's anchors), which the draw goes on from. Pure. */
export function siteKinds(count, seed, kinds = DELVE_KIND_NAMES, first = []) {
  const pool = DELVE_KIND_NAMES.filter((k) => kinds.includes(k));
  if (!pool.length) return [...first].slice(0, count);
  const fam = DELVE_FAMILIES.filter((f) => pool.some((k) => DELVE_KINDS[k].family === f));
  const out = [...first];
  for (let i = out.length; i < count; i++) {
    const h = hash32(seed >>> 0, i, SITE_SALT + 1);
    let f = fam[h % fam.length];
    if (i === 1 && fam.length > 1) f = fam.find((x) => x !== DELVE_KINDS[out[0]].family) ?? f;
    const of = pool.filter((k) => DELVE_KINDS[k].family === f);
    out.push(of[(h >>> 8) % of.length]);
  }
  return out;
}

/** The vault's spot: a Litany's or the seals' at its heart, inside its pieces' ring; every other kind's toward the nearest
 *  wall of the four axis bearings (its gates stand on the diagonals; the first on a tie), the disc less 0.6 m out. The walls are compared to
 *  the centimetre: a nearer by less than that is a tie, never a last bit of an engine's trig. */
function vaultSpot(pos, walls, r, kind) {
  if (DELVE_HEART_VAULTS.includes(kind)) return [cm(pos[0]), cm(pos[1]), cm(pos[2])];
  let j = 0;
  for (let k = 1; k < 4; k++) if (cm(walls[k]) < cm(walls[j])) j = k;
  const g = r - 0.6; // levelDisc asks the floor here, on all four
  return [cm(pos[0] + EIGHT[j][0] * g), cm(pos[1]), cm(pos[2] + EIGHT[j][1] * g)];
}

/** A candidate certainly within DSITE.spacingM of a site taken, wherever its floor lands (the floor ray's reach: 4 m
 *  under its storey, 1 m over - dungeonFires.js colliderFireProbe), so chooseSites would never take it. Pure. */
export function tooNearTaken(pos, taken) {
  const S = SQ(DSITE.spacingM);
  return taken.some((q) => {
    const dx = pos[0] - q[0],
      dz = pos[2] - q[2],
      dy = Math.abs(pos[1] - q[1]) + DFIRE.floorM;
    return dx * dx + dz * dz + dy * dy < S;
  });
}

/** THE WHOLE LAW, for the scene: `blocks` the layout's, `probe` the collider's answers (colliderSiteProbe), `doors` its
 *  doors and `fires` its campfires (dungeonFires.js fireLayoutInputs and the fire plan), `seed` its locationId, `tier`
 *  dungeonTier's word, `kinds` those built, `none` a dungeon that stands none (the caller's: the Hold, a made level, the
 *  Abyss Hollow), `anchors` a curated block's (curatedBlocks.js curatedAnchors - they stand first, as designed). The large
 *  rooms first, then the small ones for what they leave short. Answers `{ sites, candidates, valid, small, anchored }` - the
 *  sites as delveLaw.js reads them, and the census's counts (`small` the second pass's sites).
 *  @typedef {{ blocks?: any[], probe?: any, doors?: number[][], fires?: number[][], seed?: number, tier?: string,
 *   kinds?: readonly string[], none?: boolean, tally?: Record<string, any> | null, anchors?: any[] }} PlanOpts */
export function delveSitePlan(
  /** @type {PlanOpts} */ {
    blocks,
    probe,
    doors = [],
    fires = [],
    seed = 0,
    tier = 'regular',
    kinds = DELVE_KIND_NAMES,
    none = false,
    tally = null,
    anchors = curatedAnchors(blocks, curatedRecordsLive()),
  } = {},
) {
  // DLV5: a curated block's anchors stand first, as designed (its kinds the ones built); the law finds the rest of the count.
  // DLV6: one a fire or the way in crowds gives way, by its own ward's law, as a found site would (a neighbour block's
  // brazier, a neighbour start block's door - AUDIT DLV5-6: 17 of 2,232 spliced dungeons); the campfires keep clear of them
  const start = dungeonStart(blocks);
  const lawOf = (a) => (a.r === DSITE.r ? DSITE : DSITE_SMALL);
  const fixed = none
    ? []
    : anchors.filter(
        (a) =>
          kinds.includes(a.kind) &&
          fires.every((q) => d2(q, a.at) >= SQ(lawOf(a).fireM)) &&
          (!start || d2(start, a.at) >= SQ(lawOf(a).startM)),
      );
  const count = none ? 0 : Math.max(0, delveSiteCount(blocks) - fixed.length);
  const cands = siteCandidates(blocks);
  if (count <= 0 && !fixed.length) return { sites: [], candidates: cands.length, valid: 0, small: 0, anchored: 0 };
  const marks = { probe, doors, enemies: enemyMarks(blocks), items: itemMarks(blocks), fires, start, tier };
  const held = fixed.map((a) => a.at);
  const valid = count > 0 ? landDelveSites(cands, { ...marks, tally }).filter((c) => !tooNearTaken(c.pos, held)) : [];
  const large = chooseSites(valid, { seed, start, count, taken: held }).map((c) => ({ c, r: DSITE.r }));
  let small = [];
  if (large.length < count) {
    const taken = [...held, ...large.map(({ c }) => c.pos)];
    const cands2 = siteCandidates(blocks, DSITE_SMALL.gridM).filter((c) => !tooNearTaken(c.pos, taken)); // never to be chosen: never probed
    const spots = landDelveSites(cands2, { ...marks, tally: tally ? (tally.small ??= {}) : null, law: DSITE_SMALL });
    small = chooseSites(spots, { seed, start, count: count - large.length, taken }).map((c) => ({
      c,
      r: DSITE_SMALL.r,
    }));
  }
  const chosen = [...large, ...small];
  const kindOf = siteKinds(
    fixed.length + chosen.length,
    seed,
    kinds,
    fixed.map((a) => a.kind),
  );
  const sites = [
    ...fixed.map((a, i) => ({
      i,
      kind: a.kind,
      x: cm(a.at[0]),
      y: cm(a.at[1]),
      z: cm(a.at[2]),
      r: a.r,
      tier,
      vault: a.vault.map(cm),
    })),
    ...chosen.map(({ c, r }, k) => {
      const i = fixed.length + k;
      return {
        i,
        kind: kindOf[i],
        x: cm(c.pos[0]),
        y: cm(c.pos[1]),
        z: cm(c.pos[2]),
        r,
        tier,
        vault: vaultSpot(c.pos, c.walls, r, kindOf[i]),
      };
    }),
  ];
  return { sites, candidates: cands.length, valid: valid.length, small: small.length, anchored: fixed.length };
}
