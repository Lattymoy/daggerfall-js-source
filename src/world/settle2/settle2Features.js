// @ts-check
// A WORLD 2.0 TOWN'S FEATURES - its wall and gates,
// its terraces' retaining walls and stairs, its well and stalls, its docks, bridges and stilt platforms - as models of the
// shells' lane (settle2Shell.js): kind 1 to 6 in the id's top bits, the shape in the rest, so a model is a pure function of
// its shape. Each kind's fields are the generator's (gen2/settle/settlementGen.js, stage G), read and never changed. A
// feature's frame is a building's: -z its `dir`, y up from its anchor. Daggerfall's own pictures: the city walls' stone
// (TEXTURE.117, swapped by climate), the planks of TEXTURE.171 and a roof of TEXTURE.169.
import { MeshBuilder } from '../detStandIns.js';
import { registerCustomModelFamily } from '../customModels.js';
import { SETTLE2_SHELL_MODEL, SETTLE2_CODE_BITS, SETTLE2_KINDS, SHELL_STEP_M, SHELL_ROOF, isShellId, shellModel } from './settle2Shell.js';
import { TERRAIN_SIZE } from '../terrain/terrainSampler.js';
import { PAD_MARGIN_M } from '../gen2/padLaw.js';

const PX = TERRAIN_SIZE, S = SHELL_STEP_M, KIND = 2 ** SETTLE2_CODE_BITS;
/** The feature kinds' places in the lane. */
export const FEATURE_KIND = Object.freeze({ wall: 1, gate: 2, retaining: 3, stairs: 4, prop: 5, deck: 6 });
const PROP = Object.freeze({ well: 0, stall: 1 }), DECK = Object.freeze({ dock: 0, bridge: 1, platform: 2 });
const STONE = Object.freeze([117, 0]), SLIT = Object.freeze([117, 1]), DARK = Object.freeze([117, 2]), PLANK = Object.freeze([171, 3]), CLOTH = Object.freeze([0, 36]), WATER = Object.freeze([0, 79]);
/** A wall's thickness, a gate's opening and its towers' side, a stair's tread and width, metres. */
export const FEATURE_M = Object.freeze({ wall: 1.2, opening: 4.5, tower: 3, tread: 0.32, rise: 0.3, stair: 1.6, foot: 1, clear: 4.2 });

const q = (m, max) => Math.max(0, Math.min(max, Math.round(m / S)));
const signed = (m, step, half) => Math.max(-half + 1, Math.min(half - 1, Math.round(m / step))) + half;
const idOf = (kind, code) => SETTLE2_SHELL_MODEL + kind * KIND + code;
/** A wall's length and height. */
export const wallId = (len, tall) => idOf(FEATURE_KIND.wall, q(len, 255) | (q(tall, 127) << 8));
/** A gate's height and the clear height under its lintel. */
export const gateId = (tall, clear) => idOf(FEATURE_KIND.gate, q(tall, 127) | (q(clear, 63) << 7));
/** A terrace's retaining ring: its pad's width and depth and the drop it holds. */
export const retainingId = (w, d, drop) => idOf(FEATURE_KIND.retaining, q(w, 127) | (q(d, 127) << 7) | (q(drop, 63) << 14));
/** A stair: its rise (signed, quarter metres - up away from the door where the street stands higher). */
export const stairsId = (rise) => idOf(FEATURE_KIND.stairs, signed(rise, 0.25, 128));
/** A prop: a well (its roof's picture) or a stall. */
export const propId = (sub, roofRec = 0) => idOf(FEATURE_KIND.prop, sub | ((roofRec & 3) << 2));
/** A deck: a dock, a bridge or a platform - its length, width, rise end to end and its piles' depth. */
export const deckId = (sub, len, wide, rise, piles) => idOf(FEATURE_KIND.deck, sub | (q(len, 255) << 2) | (q(wide, 63) << 10) | (signed(rise, 0.25, 64) << 16) | (q(piles, 31) << 23));
/** Every model of the lane: a shell or a feature. @param {number} id */
export const isSettle2ModelId = (id) => id >= SETTLE2_SHELL_MODEL && id < SETTLE2_SHELL_MODEL + SETTLE2_KINDS * KIND;
/** A feature id's kind and shape, or null. @param {number} id */
export function featureShapeOf(id) {
  if (!isSettle2ModelId(id) || isShellId(id)) return null;
  const k = Math.floor((id - SETTLE2_SHELL_MODEL) / KIND), c = id - SETTLE2_SHELL_MODEL - k * KIND;
  if (k === FEATURE_KIND.wall) return { kind: 'wall', len: (c & 255) * S, tall: ((c >> 8) & 127) * S };
  if (k === FEATURE_KIND.gate) return { kind: 'gate', tall: (c & 127) * S, clear: ((c >> 7) & 63) * S };
  if (k === FEATURE_KIND.retaining) return { kind: 'retaining', w: (c & 127) * S, d: ((c >> 7) & 127) * S, drop: ((c >> 14) & 63) * S };
  if (k === FEATURE_KIND.stairs) return { kind: 'stairs', rise: ((c & 255) - 128) * 0.25 };
  if (k === FEATURE_KIND.prop) return { kind: (c & 3) === PROP.well ? 'well' : 'stall', roofRec: (c >> 2) & 3 };
  const sub = ['dock', 'bridge', 'platform'][c & 3];
  return { kind: sub, len: ((c >> 2) & 255) * S, wide: ((c >> 10) & 63) * S, rise: (((c >> 16) & 127) - 64) * 0.25, piles: ((c >> 23) & 31) * S };
}

/** A box from (x0, y0, z0) to (x1, y1, z1): its faces out, its pictures a 1.6 x 3.2 m wall's (TEXTURE's 64 x 128). */
function slab(mb, tex, x0, y0, z0, x1, y1, z1, top = tex) {
  const u = (a) => a / 1.6, v = (a) => a / 3.2, P = (x, y, z) => [x, y, z];
  const uv = (w, h) => [[0, -v(h)], [u(w), -v(h)], [u(w), 0], [0, 0]];
  mb.quad(tex, P(x1, y0, z0), P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0), [0, 0, -1], uv(x1 - x0, y1 - y0));
  mb.quad(tex, P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1), [0, 0, 1], uv(x1 - x0, y1 - y0));
  mb.quad(tex, P(x1, y0, z1), P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), [1, 0, 0], uv(z1 - z0, y1 - y0));
  mb.quad(tex, P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0), [-1, 0, 0], uv(z1 - z0, y1 - y0));
  mb.quad(top, P(x0, y1, z0), P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), [0, 1, 0], [[0, 0], [0, u(z1 - z0)], [u(x1 - x0), u(z1 - z0)], [u(x1 - x0), 0]]);
}
/** A plank deck from z 0 at y 0 to z -len at y rise, `wide` across, a hand thick; its rails where `rails`. */
function deck(mb, len, wide, rise, rails) {
  const h = wide / 2, t = 0.3, n = [0, len, rise], l = Math.hypot(...n), up = [0, n[1] / l, n[2] / l];
  mb.quad(PLANK, [-h, 0, 0], [h, 0, 0], [h, rise, -len], [-h, rise, -len], up, [[0, 0], [wide / 1.6, 0], [wide / 1.6, len / 1.6], [0, len / 1.6]]);
  mb.quad(PLANK, [h, -t, 0], [-h, -t, 0], [-h, rise - t, -len], [h, rise - t, -len], [0, -up[1], -up[2]], [[0, 0], [wide / 1.6, 0], [wide / 1.6, len / 1.6], [0, len / 1.6]]);
  for (const x of [-h, h]) mb.quad(PLANK, [x, -t, 0], [x, -t, -len], [x, rise, -len], [x, 0, 0], [Math.sign(x), 0, 0], [[0, 0], [len / 1.6, 0], [len / 1.6, -0.1], [0, -0.1]]);
  if (rails) for (const x of [-h, h - 0.15]) for (let k = 0; k < Math.max(1, Math.round(len / 3)); k++) {
    const z0 = -(len * k) / Math.max(1, Math.round(len / 3)), z1 = -(len * (k + 1)) / Math.max(1, Math.round(len / 3)), y = (rise * -z0) / len;
    slab(mb, PLANK, x, y, z1, x + 0.15, y + 0.9, z0);
  }
}
/** Piles every few metres along a deck's sides, from under it to `deep` below its start. */
function piles(mb, len, wide, rise, deep) {
  const n = Math.max(1, Math.round(len / 4));
  for (let k = 0; k <= n; k++) for (const x of [-wide / 2 + 0.2, wide / 2 - 0.2]) {
    const z = -(len * k) / n, y = (rise * k) / n;
    slab(mb, PLANK, x - 0.15, -deep - 0.5, z - 0.15, x + 0.15, y - 0.3, z + 0.15);
  }
}
/** A stair down (or up) `rise` metres from y 0 at z `from`, out along -z, every tread under a body's step.
 *  @param {any} mb @param {readonly number[]} tex @param {number} rise @param {number} from @param {number} [wide] */
function stair(mb, tex, rise, from, wide = FEATURE_M.stair) {
  const n = Math.max(1, Math.ceil(Math.abs(rise) / FEATURE_M.rise)), r = rise / n, low = Math.min(0, -rise) - 0.5;
  for (let i = 1; i <= n; i++) slab(mb, tex, -wide / 2, low, from - i * FEATURE_M.tread, wide / 2, -r * i, from - (i - 1) * FEATURE_M.tread);
}

/** A feature's model (dfMeshToModel's shape, metres), or null. @param {number} id */
export function featureModel(id) {
  const f = featureShapeOf(id);
  if (!f) return null;
  const mb = new MeshBuilder(), F = FEATURE_M;
  if (f.kind === 'wall') {   // a length along x, its base at y 0, merlons on its top
    const h = f.len / 2, t = F.wall / 2;
    slab(mb, STONE, -h, 0, -t, h, f.tall, t, DARK);
    for (let x = -h + 0.5; x + 1 <= h; x += 2) slab(mb, STONE, x, f.tall, -t, x + 1, f.tall + 0.8, t, DARK);
  } else if (f.kind === 'gate') {   // two towers either side of an opening along z, a lintel over it
    const o = F.opening / 2, w = F.tower, d = w / 2;
    for (const s of [-1, 1]) slab(mb, SLIT, s > 0 ? o : -o - w, 0, -d, s > 0 ? o + w : -o, f.tall + 1.5, d, DARK);
    slab(mb, STONE, -o, f.clear, -d, o, f.tall, d, DARK);
  } else if (f.kind === 'retaining') {   // a ring at the pad's edge, its top the pad's, open before the door
    const hw = f.w / 2, hd = f.d / 2, t = 0.4, g = F.stair / 2 + 0.2, y0 = -f.drop - 0.5;
    slab(mb, DARK, -hw - t, y0, hd, hw + t, 0, hd + t);
    slab(mb, DARK, hw, y0, -hd - t, hw + t, 0, hd);
    slab(mb, DARK, -hw - t, y0, -hd - t, -hw, 0, hd);
    slab(mb, DARK, -hw, y0, -hd - t, -g, 0, -hd);
    slab(mb, DARK, g, y0, -hd - t, hw, 0, -hd);
  } else if (f.kind === 'stairs') {
    stair(mb, DARK, f.rise, -PAD_MARGIN_M);
  } else if (f.kind === 'well') {   // a stone ring with its water, two posts and a roof
    mb.cylinderY(STONE, [0, -0.3, 0], 1.1, 1.2, 8, 1.6);
    mb.quad(WATER, [-0.7, 0.92, -0.7], [-0.7, 0.92, 0.7], [0.7, 0.92, 0.7], [0.7, 0.92, -0.7], [0, 1, 0]);
    for (const x of [-1, 0.85]) slab(mb, PLANK, x, 0.9, -0.08, x + 0.15, 2.6, 0.08);
    for (const s of [-1, 1]) mb.quad([SHELL_ROOF, f.roofRec], [-1.3, 2.4, s * 1.3], [1.3, 2.4, s * 1.3], [1.3, 3.1, 0], [-1.3, 3.1, 0], [0, 0.88, s * 0.47]);
  } else if (f.kind === 'stall') {   // a counter facing -z, four posts and an awning
    slab(mb, PLANK, -1.2, 0, -0.5, 1.2, 1, 0.4);
    for (const [x, z] of [[-1.2, -0.6], [1.05, -0.6], [-1.2, 1.2], [1.05, 1.2]]) slab(mb, PLANK, x, 0, z, x + 0.15, 2.4, z + 0.15);
    mb.sheet(CLOTH, [-1.4, 2.2, -0.9], [1.4, 2.2, -0.9], [1.4, 2.6, 1.5], [-1.4, 2.6, 1.5], [0, 0.99, -0.16], [[0, 0], [2, 0], [2, 1.5], [0, 1.5]]);
  } else if (f.kind === 'platform') {   // a stilt house's deck under its footprint and out before its door, legs, a stair down
    const hw = f.wide / 2, hd = f.len / 2, out = 1.2;
    slab(mb, PLANK, -hw, -0.25, -hd - out, hw, 0, hd + 0.2);
    const nx = Math.max(2, Math.round(f.wide / 3) + 1), nz = Math.max(2, Math.round(f.len / 3) + 1);
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      if (i > 0 && i < nx - 1 && j > 0 && j < nz - 1) continue;
      const x = -hw + 0.15 + ((f.wide - 0.3) * i) / (nx - 1), z = -hd + (f.len * j) / (nz - 1);
      slab(mb, PLANK, x - 0.15, -f.piles - 0.3, z - 0.15, x + 0.15, -0.25, z + 0.15);
    }
    stair(mb, PLANK, f.piles, -hd - out, 1.4);
  } else {   // a dock or a bridge: its deck from its anchor out along -z, piles under it, a bridge's rails
    deck(mb, f.len, f.wide, f.rise, f.kind === 'bridge');
    piles(mb, f.len, f.wide, f.rise, f.piles);
  }
  return mb.build();
}
/** Every model of the lane, a shell's or a feature's. @param {number} id */
export const settle2Model = (id) => (isShellId(id) ? shellModel(id) : featureModel(id));
let _installed = false;
/** The lane's family, once: solid, its pictures swapped for the climate as a block's are. */
export function installSettle2Models() {
  if (_installed) return;
  _installed = true;
  registerCustomModelFamily({ owns: isSettle2ModelId, build: settle2Model, keep: 384, climateFree: false });
}

const unit = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
/**
 * A TOWN'S FEATURES PLACED: each `{ kind, id, at: [x, y] world pixels, z: metres over the sea, dir: map }` - the model's
 * anchor and its frame's -z - and each field's rectangle (`fields`, world pixels). The wall runs ring point to ring point,
 * cut where a gate stands; a gate, a retaining ring, a stair and a platform take their building's level and way; a dock
 * and a bridge stand over the water, their piles to its bed. `ground(x, y)` and `water(x, y)` the town's region's.
 * @param {any} town @param {(x: number, y: number) => number} ground @param {(x: number, y: number) => any} water
 */
export function settle2Features(town, ground, water) {
  const out = [], fields = [], at = (b) => `${b.at.x},${b.at.y}`, byAt = new Map(town.buildings.map((b) => [at(b), b]));
  const byDoor = new Map(town.buildings.filter((b) => b.doors[0]).map((b) => [`${b.doors[0].x},${b.doors[0].y}`, b]));
  const gates = town.features.filter((f) => f.kind === 'gate'), M = (a, b) => Math.sqrt(dist2(a, b)) * PX;
  for (const f of town.features) {
    if (f.kind === 'wall') {
      for (let i = 0; i < f.pts.length; i++) {
        const a = f.pts[i], b = f.pts[(i + 1) % f.pts.length], len = M(a, b), s = unit([b[0] - a[0], b[1] - a[1]]);
        // the run's pieces between the gates on it (each gate cut its towers' width, less a hand the towers overlap)
        const cut = [];
        for (const g of gates) {
          const t = ((g.at[0] - a[0]) * s[0] + (g.at[1] - a[1]) * s[1]) * PX, off = Math.abs((g.at[0] - a[0]) * -s[1] + (g.at[1] - a[1]) * s[0]) * PX;
          if (off < 8 && t > -6 && t < len + 6) cut.push([t - FEATURE_M.opening / 2 - FEATURE_M.tower + 0.5, t + FEATURE_M.opening / 2 + FEATURE_M.tower - 0.5]);
        }
        let from = 0;
        for (const [c0, c1] of [...cut.sort((p, r) => p[0] - r[0]), [len, len]]) {
          if (c0 - from > 0.5) out.push(wallPiece(a, s, from, Math.min(c0, len), f.height, ground));
          from = Math.max(from, c1);
        }
      }
    } else if (f.kind === 'gate') {
      const across = [-f.dir[1], f.dir[0]], o = (FEATURE_M.opening / 2 + FEATURE_M.tower) / PX, gs = [-1, 0, 1].map((k) => ground(f.at[0] + across[0] * o * k, f.at[1] + across[1] * o * k));
      const base = Math.min(...gs) - FEATURE_M.foot, wall = town.features.find((w) => w.kind === 'wall')?.height ?? 6;
      out.push({ kind: 'gate', id: gateId(Math.max(...gs) + wall - base, gs[1] - base + FEATURE_M.clear), at: f.at, z: base, dir: f.dir });
    } else if (f.kind === 'retaining') {
      const b = byAt.get(`${f.at[0]},${f.at[1]}`);
      if (b) out.push({ kind: 'retaining', id: retainingId(b.footprint[0] + 2 * PAD_MARGIN_M, b.footprint[1] + 2 * PAD_MARGIN_M, f.height), at: f.at, z: b.ground.level, dir: f.dir });
    } else if (f.kind === 'stairs') {
      const b = byDoor.get(`${f.at[0]},${f.at[1]}`);
      if (b) out.push({ kind: 'stairs', id: stairsId(f.rise), at: f.at, z: b.ground.level, dir: f.dir });
    } else if (f.kind === 'platform') {
      const b = byAt.get(`${f.at[0]},${f.at[1]}`);
      if (b) out.push({ kind: 'platform', id: deckId(DECK.platform, f.size[1], f.size[0] + 0.4, 0, f.stilts), at: f.at, z: f.level, dir: b.at.dir });
    } else if (f.kind === 'well') {
      out.push({ kind: 'well', id: propId(PROP.well, 0), at: f.at, z: f.level, dir: [0, 1] });
    } else if (f.kind === 'stall') {
      out.push({ kind: 'stall', id: propId(PROP.stall), at: f.at, z: ground(f.at[0], f.at[1]), dir: f.dir });
    } else if (f.kind === 'dock') {
      const span = [0, 6, 12, 18, f.length].map((m) => [f.at[0] + (f.dir[0] * m) / PX, f.at[1] + (f.dir[1] * m) / PX]);
      const level = Math.max(ground(f.at[0], f.at[1]), ...span.map((p) => (water(p[0], p[1])?.surface ?? -Infinity) + 0.6)), bed = Math.min(...span.map((p) => ground(p[0], p[1])));
      out.push({ kind: 'dock', id: deckId(DECK.dock, f.length, 3, 0, level - bed + 0.5), at: f.at, z: level, dir: f.dir });
    } else if (f.kind === 'bridge') {
      const len = M(f.from, f.to), dir = unit([f.to[0] - f.from[0], f.to[1] - f.from[1]]), mid = [(f.from[0] + f.to[0]) / 2, (f.from[1] + f.to[1]) / 2];
      const over = (water(mid[0], mid[1])?.surface ?? -Infinity) + 0.6, z0 = Math.max(ground(f.from[0], f.from[1]), over), z1 = Math.max(ground(f.to[0], f.to[1]), over);
      const road = town.roads.reduce((best, r) => { const d = Math.min(...r.pts.map((p) => dist2(p, mid))); return d < best.d ? { d, r } : best; }, { d: Infinity, r: null }).r;
      out.push({ kind: 'bridge', id: deckId(DECK.bridge, len + 1, (road?.width ?? 3) + 1, z1 - z0, Math.max(z0, z1) - ground(mid[0], mid[1]) + 0.5), at: [f.from[0] - (dir[0] * 0.5) / PX, f.from[1] - (dir[1] * 0.5) / PX], z: z0, dir });
    } else if (f.kind === 'field') {
      const hx = f.size[0] / 2 / PX, hy = f.size[1] / 2 / PX;
      fields.push([f.at[0] - hx, f.at[1] - hy, f.at[0] + hx, f.at[1] + hy]);
    }
  }
  return { placed: out, fields };
}
/** A piece of a wall's run from `t0` to `t1` metres along it: a box on its middle, its base a stride under its lower end's
 *  ground and its top `height` over its higher end's (its pieces step with the land), a hand longer either end. */
function wallPiece(a, s, t0, t1, height, ground) {
  const p0 = [a[0] + (s[0] * t0) / PX, a[1] + (s[1] * t0) / PX], p1 = [a[0] + (s[0] * t1) / PX, a[1] + (s[1] * t1) / PX];
  const g0 = ground(...p0), g1 = ground(...p1), base = Math.min(g0, g1) - FEATURE_M.foot;
  return { kind: 'wall', id: wallId(t1 - t0 + 0.6, Math.max(g0, g1) + height - base), at: [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2], z: base, dir: [-s[1], s[0]] };
}
