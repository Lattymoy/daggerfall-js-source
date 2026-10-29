// THE SEABED UNDER A DUNGEON'S WATER (2026-10-29). Daggerfall ships a seabed's flats - kelp, coral fans, starfish,
// shell and weed beds, a reef, a wreck (TEXTURE.105 and .106) - and stands them nowhere. Every block a dungeon floods
// (rdbLayout's waterLevel) now grows them on its submerged floors: a level floor a metre under the water, clear of doors
// and of each other, inside a room with space for the plant. A pure law over the layout - markers and models as seeds,
// rings round each, the collider's answers handed in - so every client stands the same flora and nothing rides the
// wire (the fires' shape, world/dungeon/dungeonFires.js). Sizes are the classic records', never a texture mod's.
// The spread: the spot with the least hash first, then the one farthest from those chosen, up to FLORA.perBlock.

import { hash32 } from '../spawnedDungeons.js';
import { GLOBAL_SCALE } from '../meshReader.js';
import { classicBillboardSize, billboardSize } from '../rmbFlats.js';
import { fireLayoutInputs } from './dungeonFires.js';

export const FLORA = Object.freeze({
  depthM: 1,          // the floor this far under the water at least
  flatNy: 0.9,        // a floor, not a slope
  doorM: 1.5,         // from every door
  spacingM: 2.4,      // from every other plant
  ceilingM: 10,       // a ceiling within this far: inside a room
  enclosedM: 30,      // ...and walls round it: `enclosedRays` of the eight meet one within this far
  enclosedRays: 4,
  clearM: 0.1,        // past the plant's half width, all round
  perBlock: 14,
});
/** The seabed's flats by kind, and how often each is picked (out of the weights' sum). */
export const FLORA_KINDS = Object.freeze([
  Object.freeze({ kind: 'kelp', weight: 4, records: Object.freeze([[106, 2], [106, 3], [106, 4], [106, 6]]) }),
  Object.freeze({ kind: 'bed', weight: 3, records: Object.freeze([[105, 5], [105, 6], [105, 7], [105, 8], [105, 9], [105, 10], [106, 0], [106, 1]]) }),
  Object.freeze({ kind: 'fan', weight: 2, records: Object.freeze([[105, 1], [105, 2]]) }),
  Object.freeze({ kind: 'star', weight: 1, records: Object.freeze([[105, 3], [105, 4]]) }),
  Object.freeze({ kind: 'reef', weight: 1, records: Object.freeze([[106, 5], [105, 0]]) }),
]);
export const FLORA_ARCHIVES = Object.freeze([105, 106]);
const WEIGHTS = FLORA_KINDS.reduce((n, k) => n + k.weight, 0);
const WATER_NONE = 10000;

const ringOf = (r) => { const d = r * Math.SQRT1_2; return [[r, 0], [-r, 0], [0, r], [0, -r], [d, d], [d, -d], [-d, d], [-d, -d]]; };
/** Where round a seed a plant may stand, in order: the seed's own floor, then two rings. */
const SPOTS = Object.freeze([[0, 0], ...ringOf(1.8), ...ringOf(3.6)].map(Object.freeze));
const d2 = (a, b) => { const x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2]; return x * x + y * y + z * z; };

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
 * The flora of a dungeon: [{ pos: [x, y, z] (its foot, the dungeon's frame), archive, record }], in layout order.
 * `probe` answers `floor(p)` ({ y, ny } or null) and `room(p, halfWidth, height)`; `sizeOf(archive, record)` the classic
 * size { w, h } in metres or null.
 */
export function dungeonFloraPlan({ blocks, probe, sizeOf, doors = [], seed = 0 } = {}) {
  const out = [];
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
        const floor = probe.floor([s[0] + dx, s[1], s[2] + dz]);
        if (!floor || !(floor.ny >= FLORA.flatNy) || floor.y > water - FLORA.depthM) continue;
        const pos = [s[0] + dx, floor.y, s[2] + dz];
        if (doors.some((d) => d2(d, pos) < FLORA.doorM * FLORA.doorM)) continue;
        const h = hash32(seed >>> 0, bi, si, oi);
        const fits = ([archive, record]) => {
          const size = sizeOf(archive, record);
          return !!size && probe.room(pos, size.w / 2 + FLORA.clearM, size.h + FLORA.clearM);
        };
        const narrow = FLORA_KINDS[0].records[(h >>> 16) % FLORA_KINDS[0].records.length];
        const pick = [floraPick(h), narrow].find(fits);
        if (pick) spots.push({ pos, archive: pick[0], record: pick[1], h });
      }
    }
    // spread: the least hash first, then farthest-point, ties to the least hash (squared distances: the same on every client)
    const chosen = [];
    while (chosen.length < FLORA.perBlock) {
      let best = null, bestD = -1;
      for (const c of spots) {
        if (chosen.includes(c)) continue;
        const d = chosen.length ? Math.min(...chosen.map((o) => d2(o.pos, c.pos))) : Infinity;
        if (d < FLORA.spacingM * FLORA.spacingM) continue;
        if (d > bestD || (d === bestD && c.h < best.h)) { best = c; bestD = d; }
      }
      if (!best) break;
      chosen.push(best);
    }
    for (const c of chosen) out.push({ pos: c.pos, archive: c.archive, record: c.record });
  });
  return out;
}

/** The rays the law reads off the dungeon's own mesh: the fires' floor, and a plant's room round and over it. */
export function colliderFloraProbe(collider) {
  const only = Object.freeze({ only: Object.freeze(['dungeon']) });
  return {
    floor: (p) => {
      const from = [p[0], p[1] + 1, p[2]];
      const hit = collider.raycastHit(from, [0, -1, 0], 6);
      return Number.isFinite(hit?.dist) && hit.normal && !hit.back && hit.key === 'dungeon' ? { y: from[1] - hit.dist, ny: hit.normal[1] } : null;
    },
    room: (p, half, height) => {
      if (Number.isFinite(collider.raycast([p[0], p[1] + 0.05, p[2]], [0, 1, 0], height, only))) return false;
      if (!Number.isFinite(collider.raycast([p[0], p[1] + 0.05, p[2]], [0, 1, 0], FLORA.ceilingM, only))) return false;
      // clear at three heights: a sloped wall can lean into a wide plant's foot and miss its middle
      for (const k of [0.25, 0.5, 0.75]) {
        for (const [dx, dz] of ringOf(1)) if (Number.isFinite(collider.raycast([p[0], p[1] + height * k, p[2]], [dx, 0, dz], half, only))) return false;
      }
      let walls = 0;
      for (const [dx, dz] of ringOf(1)) if (Number.isFinite(collider.raycast([p[0], p[1] + Math.min(height / 2, 1), p[2]], [dx, 0, dz], FLORA.enclosedM, only))) walls++;
      return walls >= FLORA.enclosedRays;
    },
  };
}

/** THE HOST'S ONE CALL: the plan over the built dungeon, each plant into the host's flat batches by its centre. */
export async function standDungeonFlora({ blocks, collider, getTexture, flatGroups, seed = 0 }) {
  if (!(blocks ?? []).some((b) => Number.isFinite(b?.layout?.waterLevel) && b.layout.waterLevel !== WATER_NONE)) return [];
  const tex = new Map();
  for (const a of FLORA_ARCHIVES) tex.set(a, await getTexture(a).catch(() => null));
  const has = (a, r) => { const t = tex.get(a); return t && r < t.recordCount ? t : null; };
  const plan = dungeonFloraPlan({
    blocks, probe: colliderFloraProbe(collider), seed, doors: fireLayoutInputs(blocks, []).doors,
    sizeOf: (a, r) => { const t = has(a, r); return t ? classicBillboardSize(t, r) : null; },
  });
  for (const f of plan) {
    const size = billboardSize(has(f.archive, f.record), f.record);
    const key = `${f.archive}_${f.record}`;
    if (!flatGroups.has(key)) flatGroups.set(key, []);
    flatGroups.get(key).push([f.pos[0], f.pos[1] + size.h / 2, f.pos[2]]);   // a dungeon flat's point is its centre
  }
  return plan;
}
