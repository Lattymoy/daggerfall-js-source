// @ts-check
// WB6b (2026-09-25, Mac: "the arena needs to be an oblivion masterpiece ... Whole thing needs to feel alive"): THE LAND
// OUT IN THE FIRE - what stands between the court and the Deadlands' painted horizon, so the world has a middle
// distance and the eye has parallax. Design: bible/11-Multiplayer/World-Bosses.md section 4 ("The Deadlands").
//
// THE ISLANDS: rock rising out of the sea of fire in a ring round the court, ISLAND_NEAR to ISLAND_FAR out - a jagged
// mound and a cluster of black spires leaning out of it, the tallest standing well over the court's floor, the fog
// taking them one by one into the red. The window over the great tower (render/deadlands.js SIGIL_TOWER, behind the
// boss as the players arrive) is left open, so nothing of the land ever stands in front of it.
//
// THE FLOATING SHARDS: broken pieces of the court's own floor hanging in the air round it - flagstones on top (its
// joints still burning), black rock tapering under them - each bobbing and turning slowly, on the clock the Deadlands
// already keep (render/deadlands.js DEAD_CLOCK_PERIOD: every period a whole number of bobs and turns, so the clock can
// wrap).
//
// The court's own frame (world/gateArena.js courtToDungeon): the floor at y 0, the sea at LAVA_Y, the arrival at +z
// facing -z. All of it the gate's basalt and the court's flagstones - no new art. Seeded and pure: the same land on
// every screen. The tower's azimuth and the clock's period are read from render/deadlands.js - the one world/ module that
// reads a render/ one, for two numbers the sky and the land must share.
// Not a DFU member. Ledger A (WB).
import { faces, spike, GATE_ARCHIVE, GATE_STONE_RECORD } from './gateModel.js';
import { courtToDungeon, COURT_ARCHIVE, COURT_FLOOR_RECORD, LAVA_Y } from './gateArena.js';
import { seededRng } from '../systems/wind.js';
import { SIGIL_TOWER, DEAD_CLOCK_PERIOD } from '../render/deadlands.js';
import { COURT_R } from '../net/gateBrain.js';

/** The islands: how many, how near and how far (metres from the court's centre). */
export const ISLAND_COUNT = 12;
export const ISLAND_NEAR = 75;
export const ISLAND_FAR = 235;
/** The open window over the great tower, either side of its azimuth (radians): no island stands in it. */
export const TOWER_WINDOW = 0.42;
/** The shards: how many, their ring (metres from the centre), how high over the floor. */
export const SHARD_COUNT = 6;
export const SHARD_RING = Object.freeze([COURT_R + 11, COURT_R + 32]);
export const SHARD_RISE = Object.freeze([3, 16]);
/** ...and none within this of the great tower's azimuth (the arrival's sightline to it, past the boss). */
export const SHARD_WINDOW = 0.8;
/** The seed the land is drawn from. */
export const LAND_SEED = 0xdead1a;

const azOf = (x, z) => Math.atan2(x, -z);   // render/deadlands.js deadAzimuth: 0 toward the boss from the arrival
const wrapPi = (a) => a - 2 * Math.PI * Math.floor((a + Math.PI) / (2 * Math.PI));

/**
 * The islands, seeded: `[{ x, z, r, mound, spires: [{ base: [x, y, z], w, tip: [x, y, z] }] }]` in the court's frame
 * (y 0 the floor). Spread round the ring with a jitter, none in the tower's window, the nearer the lower.
 */
export function deadlandsIslands() {
  const rolls = seededRng(LAND_SEED);
  const out = [];
  for (let i = 0; i < ISLAND_COUNT; i++) {
    let az = ((i + 0.5) / ISLAND_COUNT) * Math.PI * 2 - Math.PI + (rolls() - 0.5) * 0.35;
    const off = wrapPi(az - SIGIL_TOWER.az);
    if (Math.abs(off) < TOWER_WINDOW) az = SIGIL_TOWER.az + Math.sign(off || 1) * (TOWER_WINDOW + 0.05);
    const d = ISLAND_NEAR + rolls() * (ISLAND_FAR - ISLAND_NEAR);
    const x = Math.sin(az) * d, z = -Math.cos(az) * d;
    const scale = 0.6 + 0.4 * ((d - ISLAND_NEAR) / (ISLAND_FAR - ISLAND_NEAR)) + rolls() * 0.35;   // the further, the larger - they must read over the fog
    const r = (9 + rolls() * 12) * scale;
    const mound = (8 + rolls() * 10) * scale;
    const spires = [];
    const n = 3 + Math.floor(rolls() * 5);
    for (let k = 0; k < n; k++) {
      const a = rolls() * Math.PI * 2, rr = r * (0.15 + rolls() * 0.45);
      const bx = x + Math.cos(a) * rr, bz = z + Math.sin(a) * rr;
      const tall = (k === 0 ? 1 : 0.35 + rolls() * 0.55) * (40 + rolls() * 45) * scale;
      const lean = 0.12 + rolls() * 0.3;
      const la = a + (rolls() - 0.5) * 0.8;
      spires.push({
        base: [bx, LAVA_Y + mound * 0.35, bz],
        w: (2 + rolls() * 3) * scale * (k === 0 ? 1.4 : 1),
        tip: [bx + Math.cos(la) * tall * lean, LAVA_Y + mound * 0.35 + tall, bz + Math.sin(la) * tall * lean],
      });
    }
    out.push({ x, z, r, mound, spires });
  }
  return out;
}

/** A jagged mound: a ring at the sea, a narrower ring part way up, a peak - each ring's radius and height jittered. */
function mound(f, cx, cz, r, h, rolls) {
  const sides = 9;
  const base = [], mid = [];
  for (let k = 0; k < sides; k++) {
    const a = (k / sides) * Math.PI * 2 + rolls() * 0.3;
    const rb = r * (0.8 + rolls() * 0.35), rm = r * (0.4 + rolls() * 0.25);
    base.push(courtToDungeon(cx + Math.cos(a) * rb, LAVA_Y - 3, cz + Math.sin(a) * rb));
    mid.push(courtToDungeon(cx + Math.cos(a) * rm, LAVA_Y + h * (0.45 + rolls() * 0.3), cz + Math.sin(a) * rm));
  }
  const peak = courtToDungeon(cx + (rolls() - 0.5) * r * 0.3, LAVA_Y + h, cz + (rolls() - 0.5) * r * 0.3);
  for (let k = 0; k < sides; k++) {
    const k1 = (k + 1) % sides;
    // wound to face out (seen from the court and from above)
    f.quad(GATE_STONE_RECORD, base[k], mid[k], mid[k1], base[k1], [0, 0], [0, 1], [1, 1], [1, 0]);
    f.tri(GATE_STONE_RECORD, mid[k], peak, mid[k1], [0, 1], [0.5, 2], [1, 1]);
  }
}

/** Faces into renderer.createMesh's model shape, sub-meshes by (archive, record). */
function toModel(f, byArchive) {
  const recs = [...f.byRec.keys()].sort((a, b) => a - b);
  const count = recs.reduce((n, r) => n + f.byRec.get(r).p.length / 3, 0);
  const positions = new Float32Array(count * 3), normals = new Float32Array(count * 3), uvs = new Float32Array(count * 2);
  const indices = count > 65535 ? new Uint32Array(count) : new Uint16Array(count);
  const subMeshes = [];
  let v = 0;
  for (const rec of recs) {
    const g = f.byRec.get(rec);
    const n = g.p.length / 3;
    positions.set(g.p, v * 3); normals.set(g.n, v * 3); uvs.set(g.uv, v * 2);
    for (let i = 0; i < n; i++) indices[v + i] = v + i;
    const [textureArchive, textureRecord] = byArchive.get(rec);
    subMeshes.push({ textureArchive, textureRecord, startIndex: v, primitiveCount: n / 3 });
    v += n;
  }
  return { positions, normals, uvs, indices, subMeshes };
}

/** THE ISLANDS, WHOLE: renderer.createMesh's model shape in the dungeon's frame - every mound and spire, the gate's basalt. */
export function buildDeadlandsLand() {
  const f = faces();
  const rolls = seededRng(LAND_SEED ^ 0x5a17);
  for (const isl of deadlandsIslands()) {
    mound(f, isl.x, isl.z, isl.r, isl.mound, rolls);
    for (const s of isl.spires) spike(f, courtToDungeon(...s.base), s.w, courtToDungeon(...s.tip));
  }
  return toModel(f, new Map([[GATE_STONE_RECORD, [GATE_ARCHIVE, GATE_STONE_RECORD]]]));
}

/** The shards, seeded: `[{ x, y, z, size, tilt, bob, bobTurns, spinTurns, phase }]` in the court's frame - a ring round
 *  the court, off the floor, out of the great tower's window and clear of the bridge; bobs and turns WHOLE over the
 *  Deadlands' period. */
export function deadlandsShards() {
  const rolls = seededRng(LAND_SEED ^ 0x0b0b);
  const out = [];
  for (let i = 0; i < SHARD_COUNT; i++) {
    let az = ((i + 0.5) / SHARD_COUNT) * Math.PI * 2 - Math.PI + (rolls() - 0.5) * 0.4;
    const offTower = wrapPi(az - SIGIL_TOWER.az);
    if (Math.abs(offTower) < SHARD_WINDOW) az = SIGIL_TOWER.az + Math.sign(offTower || 1) * (SHARD_WINDOW + 0.1);   // the arrival's sightline to the tower stays clear
    if (Math.abs(wrapPi(az - Math.PI)) < 0.45) az += 0.6;   // not over the bridge the players came by (+z is azimuth PI)
    const d = SHARD_RING[0] + rolls() * (SHARD_RING[1] - SHARD_RING[0]);
    out.push({
      x: Math.sin(az) * d, z: -Math.cos(az) * d,
      y: SHARD_RISE[0] + rolls() * (SHARD_RISE[1] - SHARD_RISE[0]),
      size: 2.5 + rolls() * 3.5,
      tilt: (rolls() - 0.5) * 0.35,
      bob: 0.6 + rolls() * 1.1,
      bobTurns: 40 + Math.floor(rolls() * 40),     // a bob every 7.5 to 15 s
      spinTurns: (1 + Math.floor(rolls() * 3)) * (rolls() < 0.5 ? -1 : 1),
      phase: rolls(),
    });
  }
  return out;
}

/** ONE SHARD, about its own origin: an irregular slab of flagstones on top (its joints burning), its broken edge, a
 *  rock core tapering under it and spikes hanging from it - size 1 (the matrix scales it). */
export function buildShardModel() {
  const f = faces();
  const rolls = seededRng(LAND_SEED ^ 0x51ab);
  const sides = 8, ring = [], edge = [], core = [];
  for (let k = 0; k < sides; k++) {
    const a = (k / sides) * Math.PI * 2 + (rolls() - 0.5) * 0.45;
    const r = 0.7 + rolls() * 0.45;
    ring.push([Math.cos(a) * r, (rolls() - 0.5) * 0.08, Math.sin(a) * r]);
    edge.push([Math.cos(a) * r * (0.88 + rolls() * 0.1), -0.35 - rolls() * 0.15, Math.sin(a) * r * (0.88 + rolls() * 0.1)]);
    core.push([Math.cos(a + 0.2) * r * (0.45 + rolls() * 0.2), -0.95 - rolls() * 0.3, Math.sin(a + 0.2) * r * (0.45 + rolls() * 0.2)]);
  }
  const tip = [(rolls() - 0.5) * 0.3, -2.1 - rolls() * 0.8, (rolls() - 0.5) * 0.3];
  const c = [0, 0.02, 0];
  const uv = (p) => [p[0] * 0.5 + 0.5, p[2] * 0.5 + 0.5];
  for (let k = 0; k < sides; k++) {
    const k1 = (k + 1) % sides;
    f.tri(COURT_FLOOR_RECORD + 1000, c, ring[k1], ring[k], uv(c), uv(ring[k1]), uv(ring[k]));   // the top faces up
    f.quad(GATE_STONE_RECORD, edge[k], ring[k], ring[k1], edge[k1], [0, 0], [0, 0.3], [1, 0.3], [1, 0]);
    f.quad(GATE_STONE_RECORD, core[k], edge[k], edge[k1], core[k1], [0, 0], [0, 0.5], [1, 0.5], [1, 0]);
    f.tri(GATE_STONE_RECORD, core[k], core[k1], tip, [0, 0], [1, 0], [0.5, 1.5]);
  }
  // spikes hanging from its underside, like the roots torn out of the court's rock
  for (let k = 0; k < 3; k++) {
    const b = core[(k * 3) % sides];
    spike(f, b, 0.16 + rolls() * 0.1, [b[0] * 1.2 + (rolls() - 0.5) * 0.4, b[1] - 0.9 - rolls() * 1.1, b[2] * 1.2 + (rolls() - 0.5) * 0.4]);
  }
  return toModel(f, new Map([[GATE_STONE_RECORD, [GATE_ARCHIVE, GATE_STONE_RECORD]], [COURT_FLOOR_RECORD + 1000, [COURT_ARCHIVE, COURT_FLOOR_RECORD]]]));
}

/**
 * A shard's matrix at `seconds` (the Deadlands' clock): column-major, its size, its turn about y, its bob - written
 * into `out` (a Float32Array(16), handed back). Pure.
 */
export function shardMatrix(s, seconds, out = new Float32Array(16)) {
  const t = ((seconds % DEAD_CLOCK_PERIOD) + DEAD_CLOCK_PERIOD) % DEAD_CLOCK_PERIOD;
  const bob = Math.sin((t / DEAD_CLOCK_PERIOD) * s.bobTurns * 2 * Math.PI + s.phase * 2 * Math.PI) * s.bob;
  const yaw = (t / DEAD_CLOCK_PERIOD) * s.spinTurns * 2 * Math.PI + s.phase * 7;
  const cy = Math.cos(yaw), sy = Math.sin(yaw), ct = Math.cos(s.tilt ?? 0), st = Math.sin(s.tilt ?? 0);
  const k = s.size;
  const [px, py, pz] = courtToDungeon(s.x, s.y + bob, s.z);
  // R = R_y(yaw) * R_x(tilt), scaled - columns: the x axis, the y axis, the z axis, the place
  out.set([cy * k, 0, -sy * k, 0, sy * st * k, ct * k, cy * st * k, 0, sy * ct * k, -st * k, cy * ct * k, 0, px, py, pz, 1]);
  return out;
}
