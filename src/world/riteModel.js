// @ts-check
// WB12d (2026-10-01, Mac: "faithful and a Summoner"): THE FAITHFUL'S CIRCLE, MADE - cut from the gate's own stone
// (world/gate/gateModel.js faces, GATE_ARCHIVE): Dagon's sigil burned into the earth (its own art, world/gate/gateArt.js
// riteSigilArt, laid on the ground's own heights), a ring of braziers, an altar stone and the faithful's casket - and
// where their tents, their fire and the faithful themselves stand. Design: bible/11-Multiplayer/World-Bosses.md
// section 19 D.
//
// THE CIRCLE'S OWN FRAME: x east and z north from its centre, y up from the ground there - the host stands it at the
// centre unturned. `facing` is the bearing from the circle to its gate (radians, the scene's: (sin, cos) is the way):
// the altar's face and the opening in the faithful's ring are toward it, their camp behind. Pure.
//
// Not a DFU member. Ledger A (WB).
import { faces, GATE_ARCHIVE, GATE_STONE_RECORD, RITE_SIGIL_RECORD } from './gate/gateModel.js';

/** The sigil burned into the earth: its radius, and how far over the ground it lies (no fighting the terrain). */
export const RITE_SIGIL_R = 6.5;
export const RITE_SIGIL_LIFT = 0.04;
/** Each of its points rides the highest ground this near it - a fold of the land between two points never shows
 *  through: its rings and segments are never further apart than twice this. AUDIT WB12d (G5): a finer drape and a
 *  nearer reach - on a steep slope it lay a hand's breadth over the ground, a plank the faithful's feet sank into. */
export const RITE_SIGIL_REACH = 0.5;
export const RITE_SIGIL_RINGS = 12;
export const RITE_SIGIL_SEGS = 48;
/** The braziers round it: how many, how far out, and how tall (each a basalt column with a fire on it). */
export const RITE_BRAZIERS = 6;
export const RITE_BRAZIER_R = 8.5;
export const RITE_BRAZIER_H = 1.1;
export const RITE_BRAZIER_W = 0.35;
/** The altar at the heart: across, deep and high, metres. */
export const RITE_ALTAR = Object.freeze({ w: 1.9, d: 0.9, h: 0.95 });
/** The faithful's casket beside it - the chest. */
export const RITE_CASKET = Object.freeze({ w: 0.9, d: 0.55, h: 0.55, r: 1.7 });
/** The faithful chant in a ring this far out, facing the altar; the Summoner stands behind it, facing the gate. */
export const RITE_RING_R = 4.6;
export const RITE_SUMMONER_R = 1.4;
/** Their camp, behind the circle: two tents and a fire, this far from its heart. */
export const RITE_TENT_R = 15;
export const RITE_FIRE_R = 13;

const dir = (a, r) => [Math.sin(a) * r, Math.cos(a) * r];

/**
 * Where everything stands, in the circle's frame: `braziers` [[x, z]], `altar` and `casket` {x, z, yaw}, `tents`
 * [{x, z, yaw}], `fire` [x, z], `summoner` [x, z, yaw] and `ring(n)` - n places on the faithful's ring [x, z, yaw], the
 * gap toward the gate. Yaws turn a body to face its way (the scene's: (sin, cos)). Pure.
 * @param {number} facing
 */
export function riteLayout(facing) {
  const braziers = [];
  for (let i = 0; i < RITE_BRAZIERS; i++) braziers.push(dir(facing + ((i + 0.5) / RITE_BRAZIERS) * 2 * Math.PI, RITE_BRAZIER_R));
  const behind = facing + Math.PI;
  const [sx, sz] = dir(behind, RITE_SUMMONER_R);
  const [cx, cz] = dir(facing + Math.PI / 2, RITE_CASKET.r);
  const tents = [-0.45, 0.45].map((d) => { const [x, z] = dir(behind + d, RITE_TENT_R); return { x, z, yaw: Math.atan2(-x, -z) }; });
  return {
    braziers,
    altar: { x: 0, z: 0, yaw: facing },
    casket: { x: cx, z: cz, yaw: facing },
    tents,
    fire: dir(behind, RITE_FIRE_R),
    summoner: [sx, sz, facing],
    /** n places round the ring, centred opposite the gate, the gap left toward it */
    ring(n) {
      const out = [];
      for (let i = 0; i < n; i++) {
        const a = behind + ((i + 1) / (n + 1) - 0.5) * 1.75 * Math.PI;
        const [x, z] = dir(a, RITE_RING_R);
        out.push([x, z, Math.atan2(-x, -z)]);
      }
      return out;
    },
  };
}

/** A box's eight corners about (x, z), turned by `yaw`: its foot sunk under the lowest ground at its corners (never
 *  standing on air on a slope), its top `h` over the ground at its middle. */
function boxCorners(x, z, yaw, w, d, h, ground) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const at = (u, v) => [x + c * u + s * v, z - s * u + c * v];
  const foot = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([u, v]) => at(u, v));
  const y0 = Math.min(...foot.map(([fx, fz]) => ground(fx, fz))) - 0.15, y1 = ground(x, z) + h;
  return [...foot.map(([fx, fz]) => [fx, y0, fz]), ...foot.map(([fx, fz]) => [fx, y1, fz])];
}
function box(f, rec, k) {
  const q = (a, b, c, d) => f.quad(rec, k[d], k[c], k[b], k[a], [0, 0], [1, 0], [1, 1], [0, 1]);   // wound outward
  q(4, 5, 6, 7);                       // the top
  q(0, 1, 5, 4); q(1, 2, 6, 5); q(2, 3, 7, 6); q(3, 0, 4, 7);   // the sides
}

/**
 * THE CIRCLE'S STONE: renderer.createMesh's model shape, in the circle's frame. `heightAt(x, z)` is the ground over the
 * centre's at a point of the frame (0 where nothing answers - a flat circle until the land is known). Sub-meshes by the
 * gate's archive's records: the stone, and the sigil's own (AUDIT WB12d G11). `parts` builds the one or the other - the
 * host draws the sigil from near alone (AUDIT WB12d G6) and stands the stone in the collider.
 * @param {number} facing @param {(x: number, z: number) => number} [heightAt]
 * @param {{stone?: boolean, sigil?: boolean}} [parts]
 */
export function buildRiteModel(facing, heightAt = () => 0, { stone = true, sigil = true } = {}) {
  const h = (x, z) => { const v = heightAt(x, z); return Number.isFinite(v) ? v : 0; };
  const f = faces();
  const L = riteLayout(facing);
  // the sigil: rings out from the heart, each point on the highest ground about it - its art turned with the altar, the
  // star's first point toward the gate (gateArt.js riteSigilArt draws it at +v)
  const RINGS = RITE_SIGIL_RINGS, SEGS = RITE_SIGIL_SEGS, K = RITE_SIGIL_REACH, D = K * Math.SQRT1_2;
  const ride = (x, z) => Math.max(h(x, z), h(x + K, z), h(x - K, z), h(x, z + K), h(x, z - K), h(x + D, z + D), h(x - D, z + D), h(x + D, z - D), h(x - D, z - D));
  const cf = Math.cos(facing), sf = Math.sin(facing), uvOf = (x, z) => [0.5 + (x * cf - z * sf) / (2 * RITE_SIGIL_R), 0.5 + (x * sf + z * cf) / (2 * RITE_SIGIL_R)];
  if (sigil) {
    const grid = [];
    for (let ri = 0; ri <= RINGS; ri++) {
      const row = [];
      for (let si = 0; si <= SEGS; si++) {
        const r = (ri / RINGS) * RITE_SIGIL_R, a = (si / SEGS) * 2 * Math.PI;
        const x = Math.sin(a) * r, z = Math.cos(a) * r;
        row.push({ p: [x, ride(x, z) + RITE_SIGIL_LIFT, z], uv: uvOf(x, z) });
      }
      grid.push(row);
    }
    const pt = (ri, si) => grid[ri][si];
    for (let ri = 0; ri < RINGS; ri++) {
      for (let si = 0; si < SEGS; si++) {
        const a = pt(ri, si), b = pt(ri, si + 1), c = pt(ri + 1, si + 1), d = pt(ri + 1, si);
        if (ri === 0) f.tri(RITE_SIGIL_RECORD, a.p, d.p, c.p, a.uv, d.uv, c.uv);
        else f.quad(RITE_SIGIL_RECORD, a.p, d.p, c.p, b.p, a.uv, d.uv, c.uv, b.uv);
      }
    }
  }
  if (stone) {
    // the braziers: hexagonal columns of the stone, sunk under the lowest ground at their rims - each face its own strip
    // of the stone, the cap a patch as wide (AUDIT WB12d G19: six faces of one strip read as one face turned, and a cap
    // of a tenth of the art one flat colour)
    for (const [x, z] of L.braziers) {
      const R = RITE_BRAZIER_W;
      const rim = Array.from({ length: 6 }, (_, j) => h(x + Math.cos((j / 6) * 2 * Math.PI) * R, z + Math.sin((j / 6) * 2 * Math.PI) * R));
      const y0 = Math.min(h(x, z), ...rim) - 0.3, y1 = h(x, z) + RITE_BRAZIER_H;
      for (let j = 0; j < 6; j++) {
        const a0 = (j / 6) * 2 * Math.PI, a1 = ((j + 1) / 6) * 2 * Math.PI, u = j * 0.15;
        const p = (a, y) => [x + Math.cos(a) * R, y, z + Math.sin(a) * R];
        f.quad(GATE_STONE_RECORD, p(a0, y0), p(a0, y1), p(a1, y1), p(a1, y0), [u, 0], [u, 1.5], [u + 0.3, 1.5], [u + 0.3, 0]);
        f.tri(GATE_STONE_RECORD, [x, y1, z], p(a1, y1), p(a0, y1), [0.5, 0.5], [0.5 + Math.cos(a1) * 0.3, 0.5 + Math.sin(a1) * 0.3], [0.5 + Math.cos(a0) * 0.3, 0.5 + Math.sin(a0) * 0.3]);
      }
    }
    // the altar and the casket, each standing on the ground at its middle
    box(f, GATE_STONE_RECORD, boxCorners(L.altar.x, L.altar.z, L.altar.yaw, RITE_ALTAR.w, RITE_ALTAR.d, RITE_ALTAR.h, h));
    box(f, GATE_STONE_RECORD, boxCorners(L.casket.x, L.casket.z, L.casket.yaw, RITE_CASKET.w, RITE_CASKET.d, RITE_CASKET.h, h));
  }
  // assembled as the gate's own (gateModel.js buildGateModel)
  const recs = [...f.byRec.keys()].sort((a, b) => a - b);
  const count = recs.reduce((n, r) => n + f.byRec.get(r).p.length / 3, 0);
  const positions = new Float32Array(count * 3), normals = new Float32Array(count * 3), uvs = new Float32Array(count * 2);
  const indices = new Uint32Array(count);
  const subMeshes = [];
  let v = 0;
  for (const rec of recs) {
    const g = f.byRec.get(rec), n = g.p.length / 3;
    positions.set(g.p, v * 3); normals.set(g.n, v * 3); uvs.set(g.uv, v * 2);
    for (let i = 0; i < n; i++) indices[v + i] = v + i;
    subMeshes.push({ textureArchive: GATE_ARCHIVE, textureRecord: rec, startIndex: v, primitiveCount: n / 3 });
    v += n;
  }
  return { positions, normals, uvs, indices, subMeshes };
}
