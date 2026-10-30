// THE SEABED UNDER A DUNGEON'S WATER (SEABED, 2026-10-29; AUDIT SHIP-REFIT the same day). Daggerfall ships a seabed's
// flats (TEXTURE.105 and .106) and stands them nowhere; every block a dungeon floods grows them on its submerged floors. A
// pure law over the layout - seeds its markers and models, the collider's answers handed in - so every client stands the
// same seabed and nothing rides the wire (the fires' shape, world/dungeon/dungeonFires.js). A spot is in its own block, a
// metre under that block's water, on a floor level a metre all round (no step, ramp, ledge or tabletop), clear of doors,
// markers and the layout's flats, inside a room with space for the plant; the spread takes the least hash first, then the
// farthest spot, 2.4 m from every plant in the dungeon. Sizes are the classic records', never a texture mod's.
import { hash32 } from '../spawnedDungeons.js';
import { GLOBAL_SCALE } from '../meshReader.js';
import { RDB_SIDE } from '../rdbLayout.js';
import { classicBillboardSize, billboardSize } from '../rmbFlats.js';
import { transformPoint, multiply, trs } from '../mat4.js';
import { isDungeonExitDoor } from './dungeonLayout.js';
import { itemMarks, enemyMarks } from './dungeonFires.js';

export const SEABED = Object.freeze({
  depthM: 1, // the floor this far under its own block's water at least
  flatNy: 0.99, // a floor, not a slope (the fires' C3: 0.9 passed a 25.8 degree ramp)
  levelR: 0.5, // the floor sampled this far out on eight bearings...
  reachR: 1, // ...and this far (the fires' F4: a tabletop or a plinth is level under the first ring alone)
  levelM: 0.05, // ...each within this of the spot's
  doorM: 1.5, // from every door's middle
  markerM: 1.5, // from every marker a pile, a quest's item, a foe or the way in stands on (the fires' F3)
  flatM: 1, // from every flat the layout stands
  storeyM: 3, // the height band a marker or a flat counts in
  spacingM: 2.4, // from every other plant in the dungeon
  ceilingM: 10, // a ceiling within this far: inside a room
  enclosedM: 30, // ...and walls round it: `enclosedRays` of the eight meet one within this far
  enclosedRays: 4,
  clearM: 0.1, // past the plant's half width, all round, from its foot to its top
  footM: 0.06, // the lowest of those rays: over the 5 cm a level floor may rise (a stone under a fan)
  gapM: 0.15, // no gap between those rays, round its edge or up its height, wider than this
  perBlock: 14,
});
/** The seabed's flats by kind, and how often each is picked (out of the weights' sum). TEXTURE.106 record 6 is a column
 *  of bubbles, no plant, and stands nowhere. */
export const FLORA_KINDS = Object.freeze([
  Object.freeze({
    kind: 'kelp',
    weight: 4,
    records: Object.freeze([
      [106, 2],
      [106, 3],
      [106, 4],
    ]),
  }),
  Object.freeze({
    kind: 'bed',
    weight: 3,
    records: Object.freeze([
      [105, 5],
      [105, 6],
      [105, 7],
      [105, 8],
      [105, 9],
      [105, 10],
      [106, 0],
      [106, 1],
    ]),
  }),
  Object.freeze({
    kind: 'fan',
    weight: 2,
    records: Object.freeze([
      [105, 1],
      [105, 2],
    ]),
  }),
  Object.freeze({
    kind: 'star',
    weight: 1,
    records: Object.freeze([
      [105, 3],
      [105, 4],
    ]),
  }),
  Object.freeze({
    kind: 'reef',
    weight: 1,
    records: Object.freeze([
      [106, 5],
      [105, 0],
    ]),
  }), // a reef; an anchor
]);
export const FLORA_ARCHIVES = Object.freeze([105, 106]);
const WEIGHTS = FLORA_KINDS.reduce((n, k) => n + k.weight, 0);
const WATER_NONE = 10000;

const ringOf = (r) => {
  const d = r * Math.SQRT1_2;
  return [
    [r, 0],
    [-r, 0],
    [0, r],
    [0, -r],
    [d, d],
    [d, -d],
    [-d, d],
    [-d, -d],
  ];
};
/** Where round a seed a plant may stand, in order: the seed's own floor, then two rings. */
const SPOTS = Object.freeze([[0, 0], ...ringOf(1.8), ...ringOf(3.6)].map(Object.freeze));
/** The floor's sixteen samples round a spot: SEABED.levelR out, then SEABED.reachR. */
const LEVEL_RINGS = Object.freeze([...ringOf(SEABED.levelR), ...ringOf(SEABED.reachR)].map(Object.freeze));
const d2 = (a, b) => {
  const x = a[0] - b[0],
    y = a[1] - b[1],
    z = a[2] - b[2];
  return x * x + y * y + z * z;
};
/** AUDIT SHIP-REFIT: N bearings round a spot, turned by a literal cosine and sine - plain products, no Math.sin (an
 *  engine's own last bit), so every client casts the same rays. Eight left a gap of a metre at a wide bed's edge, and a
 *  column stood in it. */
const TURNS = Object.freeze({
  8: [0.7071067811865476, 0.7071067811865475],
  16: [0.9238795325112867, 0.3826834323650898],
  32: [0.9807852804032304, 0.19509032201612825],
  64: [0.9951847266721969, 0.0980171403295606],
});
const bearingsOf = (n) => {
  const [c, s] = TURNS[n],
    out = [[0, 1]];
  while (out.length < n) {
    const [x, z] = out[out.length - 1];
    out.push([x * c + z * s, z * c - x * s]);
  }
  return Object.freeze(out.map(Object.freeze));
};
const BEARINGS = Object.freeze(Object.fromEntries(Object.keys(TURNS).map((n) => [n, bearingsOf(Number(n))])));
/** The bearings a plant's clearance is read on: enough that no gap at its edge is wider than SEABED.gapM. */
export const clearanceBearings = (half) =>
  BEARINGS[[8, 16, 32].find((n) => (2 * Math.PI * half) / n <= SEABED.gapM) ?? 64];
/** AUDIT SHIP-REFIT: the heights it is read at, from SEABED.footM to its top, none further apart than SEABED.gapM - rays
 *  a fifth of its height apart passed a bar 0.45 m deep at a fan's edge. Plain arithmetic: every client's the same. */
export const clearanceHeights = (height) => {
  const n = Math.max(1, Math.ceil((height - SEABED.footM) / SEABED.gapM));
  return Array.from({ length: n + 1 }, (_, i) => SEABED.footM + ((height - SEABED.footM) * i) / n);
};
/** Squared distance across, for a mark within SEABED.storeyM of `p`'s height; Infinity off its storey. */
const across = (m, p) => (Math.abs(m[1] - p[1]) < SEABED.storeyM ? (m[0] - p[0]) ** 2 + (m[2] - p[2]) ** 2 : Infinity);
const inBlock = (b, x, z) => x >= b.originX && x < b.originX + RDB_SIDE && z >= b.originZ && z < b.originZ + RDB_SIDE;

/** The plant a spot's hash picks: [archive, record]. */
export function floraPick(h) {
  let w = h % WEIGHTS;
  for (const k of FLORA_KINDS) {
    if (w < k.weight) return k.records[(h >>> 8) % k.records.length];
    w -= k.weight;
  }
  return FLORA_KINDS[0].records[0];
}

/**
 * The doors a plant keeps clear of, in the dungeon's frame: every action door's middle (its model's box under its matrix
 * - a door's origin is its hinge) and every exit door's face. `positionsOf(modelIdNum)` the model's vertex array or null
 * (the origin is taken then).
 */
export function floraDoors(blocks, positionsOf = () => null) {
  const out = [];
  for (const b of blocks ?? []) {
    const om = trs(b.originX, 0, b.originZ, 0, 0, 0);
    for (const d of b?.layout?.actionDoors ?? []) {
      const p = positionsOf(d.modelIdNum),
        m = multiply(om, d.matrix);
      if (!p?.length) {
        out.push([m[12], m[13], m[14]]);
        continue;
      }
      const lo = [Infinity, Infinity, Infinity],
        hi = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < p.length; i += 3)
        for (let k = 0; k < 3; k++) {
          lo[k] = Math.min(lo[k], p[i + k]);
          hi[k] = Math.max(hi[k], p[i + k]);
        }
      out.push(transformPoint(m, (lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2));
    }
    for (const d of (b?.layout?.exitDoors ?? []).filter(isDungeonExitDoor)) {
      const c = d.centre
        ? transformPoint(d.matrix, d.centre.x, d.centre.y, d.centre.z)
        : [d.matrix[12], d.matrix[13], d.matrix[14]];
      out.push([c[0] + b.originX, c[1], c[2] + b.originZ]);
    }
  }
  return out;
}

/** Is the floor level at `offsets` round `pos` (on its floor)? Each sample a floor within SEABED.levelM of the spot's. */
function levelAt(probe, pos, offsets) {
  for (const [dx, dz] of offsets) {
    const g = probe.floor([pos[0] + dx, pos[1], pos[2] + dz]);
    if (!g || !(g.ny >= SEABED.flatNy) || !(Math.abs(g.y - pos[1]) <= SEABED.levelM)) return false;
  }
  return true;
}
/** AUDIT SHIP-REFIT: and under a plant wider than the rings, at its own half width - a 2.8 m bed overhung a step. */
const footRing = (half) => clearanceBearings(half).map(([x, z]) => [x * half, z * half]);

/**
 * The flora of a dungeon: [{ pos: [x, y, z] (its foot, the dungeon's frame), archive, record }], in pick order block by
 * block. `probe` answers `floor(p)` ({ y, ny } or null) and `room(p, halfWidth, height)`; `sizeOf(archive, record)` the
 * classic size { w, h } in metres or null; `doors` floraDoors' list.
 */
export function dungeonFloraPlan({ blocks, probe, sizeOf, doors = [], seed = 0 } = {}) {
  const out = [];
  const marks = [...itemMarks(blocks), ...enemyMarks(blocks)];
  const flats = (blocks ?? []).flatMap((b) =>
    (b?.layout?.flats ?? []).map((f) => [f.x + b.originX, f.y, f.z + b.originZ]),
  );
  (blocks ?? []).forEach((b, bi) => {
    const lay = b?.layout;
    if (!lay || !Number.isFinite(lay.waterLevel) || lay.waterLevel === WATER_NONE) return;
    const water = -lay.waterLevel * GLOBAL_SCALE;
    const seeds = [
      ...(lay.markers ?? []).map((m) => [m.x + b.originX, m.y, m.z + b.originZ]),
      ...(lay.placements ?? []).map((p) => [p.matrix[12] + b.originX, p.matrix[13], p.matrix[14] + b.originZ]),
    ];
    const spots = [];
    for (const [si, s] of seeds.entries()) {
      for (const [oi, [dx, dz]] of SPOTS.entries()) {
        const x = s[0] + dx,
          z = s[2] + dz;
        if (!inBlock(b, x, z)) continue; // its own block's water, the one the host draws and swims in there
        const floor = probe.floor([x, s[1], z]);
        if (!floor || !(floor.ny >= SEABED.flatNy) || floor.y > water - SEABED.depthM) continue;
        const pos = [x, floor.y, z];
        if (doors.some((d) => d2(d, pos) < SEABED.doorM * SEABED.doorM)) continue;
        if (marks.some((m) => across(m, pos) < SEABED.markerM * SEABED.markerM)) continue;
        if (flats.some((f) => across(f, pos) < SEABED.flatM * SEABED.flatM)) continue;
        if (!levelAt(probe, pos, LEVEL_RINGS)) continue;
        const h = hash32(seed >>> 0, bi, si, oi);
        const fits = ([archive, record]) => {
          const size = sizeOf(archive, record);
          if (!size || (size.w / 2 > SEABED.reachR && !levelAt(probe, pos, footRing(size.w / 2)))) return false;
          return probe.room(pos, size.w / 2 + SEABED.clearM, size.h);
        };
        const narrow = FLORA_KINDS[0].records[(h >>> 16) % FLORA_KINDS[0].records.length];
        const pick = [floraPick(h), narrow].find(fits);
        if (pick) spots.push({ pos, archive: pick[0], record: pick[1], h });
      }
    }
    // spread: the least hash first, then farthest-point, ties to the least hash - every plant of the dungeon's counted
    // (squared distances: the same on every client)
    const chosen = [];
    while (chosen.length < SEABED.perBlock) {
      let best = null,
        bestD = -1;
      for (const c of spots) {
        if (chosen.includes(c)) continue;
        let d = Infinity;
        for (const o of chosen) d = Math.min(d, d2(o.pos, c.pos));
        for (const o of out) d = Math.min(d, d2(o.pos, c.pos));
        if (d < SEABED.spacingM * SEABED.spacingM) continue;
        const ranked = chosen.length ? d : Infinity; // the first of a block by its hash alone, as ever
        if (ranked > bestD || (ranked === bestD && c.h < best.h)) {
          best = c;
          bestD = ranked;
        }
      }
      if (!best) break;
      chosen.push(best);
    }
    for (const c of chosen) out.push({ pos: c.pos, archive: c.archive, record: c.record });
  });
  return out;
}

/**
 * The rays the law reads off the dungeon's own mesh at the build - every bucket at its build pose (the fires' floor
 * rule: the law runs after every mover and door is hung and before a save moves one), so a plant stands clear of a door
 * leaf or a platform as they stand. `floor` the first surface under a point a metre over it, the dungeon's own face that looks up;
 * `room` no face inside the plant's half width from its foot to its top (clearanceBearings, clearanceHeights) nor over it, a face met from behind anywhere refused (the
 * spot is inside a solid), a ceiling within SEABED.ceilingM and walls round it.
 */
export function colliderFloraProbe(collider) {
  const met = (from, dir, far) => collider.raycastHit(from, dir, far);
  return {
    floor: (p) => {
      const from = [p[0], p[1] + 1, p[2]];
      const hit = met(from, [0, -1, 0], 6);
      return Number.isFinite(hit?.dist) && hit.normal && !hit.back && hit.key === 'dungeon'
        ? { y: from[1] - hit.dist, ny: hit.normal[1] }
        : null; // never a lift's platform (the fires' C4)
    },
    room: (p, half, height) => {
      const up = met([p[0], p[1] + 0.05, p[2]], [0, 1, 0], SEABED.ceilingM);
      if (!Number.isFinite(up?.dist) || up.back || up.dist < height) return false;
      const bearings = clearanceBearings(half);
      for (const y of clearanceHeights(height)) {
        for (const [dx, dz] of bearings) {
          const hit = met([p[0], p[1] + y, p[2]], [dx, 0, dz], half);
          if (Number.isFinite(hit?.dist)) return false;
        }
      }
      let walls = 0;
      for (const [dx, dz] of ringOf(1)) {
        const hit = met([p[0], p[1] + Math.min(height / 2, 1), p[2]], [dx, 0, dz], SEABED.enclosedM);
        if (!Number.isFinite(hit?.dist)) continue;
        if (hit.back) return false;
        walls++;
      }
      return walls >= SEABED.enclosedRays;
    },
  };
}

/**
 * THE HOST'S ONE CALL: the plan over the built dungeon, each plant into the host's flat batches by its centre, swum
 * through - no body and no cover (`noCover`: a seabed's weed is the flora PROP-BODIES lets a body pass, and a body
 * clamped the swimming player). `positionsOf(modelIdNum)` the host's model vertices, for the doors' middles.
 */
export async function standDungeonFlora({ blocks, collider, getTexture, flatGroups, positionsOf, seed = 0 }) {
  if (!(blocks ?? []).some((b) => Number.isFinite(b?.layout?.waterLevel) && b.layout.waterLevel !== WATER_NONE))
    return [];
  const tex = new Map();
  for (const a of FLORA_ARCHIVES) tex.set(a, await getTexture(a).catch(() => null));
  const has = (a, r) => {
    const t = tex.get(a);
    return t && r < t.recordCount ? t : null;
  };
  const plan = dungeonFloraPlan({
    blocks,
    probe: colliderFloraProbe(collider),
    seed,
    doors: floraDoors(blocks, positionsOf),
    sizeOf: (a, r) => {
      const t = has(a, r);
      return t ? classicBillboardSize(t, r) : null;
    },
  });
  for (const f of plan) {
    const size = billboardSize(has(f.archive, f.record), f.record);
    const key = `${f.archive}_${f.record}`;
    if (!flatGroups.has(key)) flatGroups.set(key, []);
    flatGroups.get(key).push(Object.assign([f.pos[0], f.pos[1] + size.h / 2, f.pos[2]], { noCover: true })); // a dungeon flat's point is its centre
  }
  return plan;
}
