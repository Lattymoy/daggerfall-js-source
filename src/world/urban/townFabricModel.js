// @ts-check
// ═══════════════════════════════════════════════════════════════════
// URBANIZER U3 (bible/03-World/Urban-Fabric.md section 5) - A TOWN'S FABRIC MADE: one model of the town's own over its
// blocks (world/urban/townFabric.js plans it), in the location's metres (x east, z north, its ground y 0):
//   - its MAIN STREETS laid in the style's setts (URBAN_KINDS.setts) between kerbs, its PAVEMENTS of flags FABRIC_PAVE_Y
//     over them, each kerb's face where a pavement meets anything but a house, a prop's bare ground or a pavement;
//   - a city's SIDE STREETS (Daggerfall's road tiles) in its cobbles - a hamlet's keep Daggerfall's own ground;
//   - its YARDS closed by Daggerfall's own fence (ARCH3D 41206: its rails between their posts, stretched along each run of
//     fence as TS4's walls are along their line - world/townWalls.js townWallModel) or by a low wall of the style's with a
//     coping of its flags and a pillar either side of every gate;
//   - its DEAD ENDS' walls, the style's, FABRIC_DEAD_WALL high;
//   - its yards' WOODPILES against their fences - log ends to the yard, bark over the top, Daggerfall's crate beside each.
// The port's own pieces are mapped at vanilla's texel density (world/capitalModels.js vanillaTexels: a 64-texel picture
// every 1.6 m) and Daggerfall's keep their own pictures, swapped to the town's climate as any block's model is. One
// submesh a picture (world/arena/arenaModel.js composeArenaModel), so the town's fabric is a handful of draws in the
// pixel's static batch. Pure: the plan and Daggerfall's pieces in, the model out.
// ═══════════════════════════════════════════════════════════════════
import { MeshBuilder } from '../detStandIns.js';
import { composeArenaModel } from '../arena/arenaModel.js';
import { vanillaTexels } from '../capitalModels.js';
import { NAV_CELL } from '../city/cityNavigation.js';
import { FABRIC_KIND, edgeRuns } from './townFabric.js';
import { URBAN_STYLES, styleArt, urbanArt } from './urbanRecords.js';
import { BARK } from './urbanArt.js';

/** Daggerfall's own pieces the fabric stands (its ARCH3D, the player's): the yard fence's rails and posts, and a crate. */
export const FABRIC_PIECES = Object.freeze({ fence: 41206, crate: 41818 });
/** Heights, metres over the town's ground: a carriageway's and a cobbled street's face, a pavement's top - its kerb under
 *  the 0.1 m a walker's step looks ahead at (characters/mobile/mobilePerson.js `_clear`, "aim low to better detect
 *  stairs"), so the town's people cross it and a kerb never shuts a street to them. */
export const FABRIC_ROAD_Y = 0.0;
export const FABRIC_PAVE_Y = 0.08;
/** AUDIT PROP-GROUND: the land under the town - the location's origin stands 2 x 0.025 m over the ground TS2 flattens
 *  (scenes/pixelBuild.js locLocal), where Daggerfall's flats stand. */
export const FABRIC_LAND_Y = -0.05;
/** AUDIT PROP-GROUND: what the model lays on a cell - nothing, a face at FABRIC_ROAD_Y (setts, cobbles), flags. */
export const FABRIC_FACE = Object.freeze({ none: 0, road: 1, flags: 2 });

/**
 * AUDIT PROP-GROUND: THE FACE EACH CELL IS LAID WITH - the one law the model lays by and a flat is stood on
 * (world/urban/townFabricStand.js fabricLift): a cell's kind, or a prop's cell's `under`; setts where the style lays a
 * carriageway, cobbles on a city's side streets, flags on every pavement.
 * @param {{ W: number, H: number, kind: Uint8Array, under: Uint8Array }} plan @param {string} style @param {boolean} [cobbles]
 * @returns {{ faces: Uint8Array, surf: Uint8Array }} `surf` each cell's kind as laid
 */
export function fabricFaces(plan, style, cobbles = false) {
  const st = URBAN_STYLES[style] ?? URBAN_STYLES.imperial,
    K = FABRIC_KIND,
    F = FABRIC_FACE;
  const surf = Uint8Array.from(plan.kind, (k, i) => (k === K.built && plan.under[i]) || k);
  const faces = Uint8Array.from(surf, (k) =>
    k === K.pave ? F.flags : (k === K.main && st.carriage) || (k === K.side && cobbles && st.side) ? F.road : F.none,
  );
  return { faces, surf };
}
/** A yard's low wall (the walled styles'): its height, its thickness, its coping's overhang and depth, a gate pillar's
 *  side and height. A dead end's wall: its height and thickness. */
export const FABRIC_WALL = Object.freeze({ h: 1.5, t: 0.36, coping: 0.07, copingH: 0.08, pillar: 0.56, pillarH: 1.9 });
export const FABRIC_DEAD_WALL = Object.freeze({ h: 2.6, t: 0.5 });
/** A woodpile's length along its fence, its height and its depth. */
export const FABRIC_PILE = Object.freeze({ l: 1.5, h: 0.95, d: 0.62 });

const C = NAV_CELL;
const UP = [0, 1, 0];
/** SOLITUDE-RELIEF: a town block's side in the fabric's cells (world/city/cityNavigation.js: 64 to a block). */
const BLOCK_CELLS = 64;

/** SOLITUDE-RELIEF: rectangles of cells cut wherever they cross a block's edge (each piece then one block's). */
function rectsByBlock(rects) {
  const out = [];
  for (const [x0, z0, x1, z1] of rects) {
    for (let bx = Math.floor(x0 / BLOCK_CELLS); bx * BLOCK_CELLS < x1; bx++) {
      for (let bz = Math.floor(z0 / BLOCK_CELLS); bz * BLOCK_CELLS < z1; bz++) {
        out.push([
          Math.max(x0, bx * BLOCK_CELLS),
          Math.max(z0, bz * BLOCK_CELLS),
          Math.min(x1, (bx + 1) * BLOCK_CELLS),
          Math.min(z1, (bz + 1) * BLOCK_CELLS),
        ]);
      }
    }
  }
  return out;
}
/** SOLITUDE-RELIEF: runs of edges cut wherever their inner cells cross into another block (each piece then one block's). */
function runsByBlock(runs, W) {
  const blockOf = (e) => {
    const x = e.inner % W,
      z = (e.inner - x) / W;
    return `${Math.floor(x / BLOCK_CELLS)},${Math.floor(z / BLOCK_CELLS)}`;
  };
  const out = [];
  for (const run of runs) {
    let cur = [run[0]];
    for (let k = 1; k < run.length; k++) {
      if (blockOf(run[k]) === blockOf(cur[0])) cur.push(run[k]);
      else {
        out.push(cur);
        cur = [run[k]];
      }
    }
    out.push(cur);
  }
  return out;
}
/** A mesh's copy raised `dy` metres. */
function raised(m, dy) {
  if (!dy) return m;
  const positions = Float32Array.from(m.positions);
  for (let i = 1; i < positions.length; i += 3) positions[i] += dy;
  return { ...m, positions };
}

/** The rectangles of cells a mask marks, greedily (a row's run, grown down while every cell of it holds), each [x0, z0,
 *  x1, z1] in cells (the far edges exclusive). */
export function cellRects(W, H, mask) {
  const used = new Uint8Array(W * H),
    out = [];
  for (let z = 0; z < H; z++) {
    for (let x = 0; x < W; x++) {
      const i = z * W + x;
      if (!mask[i] || used[i]) continue;
      let x1 = x;
      while (x1 < W && mask[z * W + x1] && !used[z * W + x1]) x1++;
      let z1 = z + 1;
      for (; z1 < H; z1++) {
        let full = true;
        for (let k = x; k < x1 && full; k++) if (!mask[z1 * W + k] || used[z1 * W + k]) full = false;
        if (!full) break;
      }
      for (let zz = z; zz < z1; zz++) used.fill(1, zz * W + x, zz * W + x1);
      out.push([x, z, x1, z1]);
    }
  }
  return out;
}

/** A run of edges as a segment on its line, metres: its two ends (`a` the first edge's start), the way out of its inner
 *  cells (`out`, a step) and its length. */
export function runSegment(run, W) {
  const first = run[0],
    last = run[run.length - 1];
  const ends = (e) => {
    const x = e.inner % W,
      z = (e.inner - x) / W,
      d = e.dir;
    // the steps (townFabric.js STEPS): 0 east, 1 west, 2 north, 3 south
    if (d === 0)
      return [
        [(x + 1) * C, z * C],
        [(x + 1) * C, (z + 1) * C],
      ];
    if (d === 1)
      return [
        [x * C, z * C],
        [x * C, (z + 1) * C],
      ];
    if (d === 2)
      return [
        [x * C, (z + 1) * C],
        [(x + 1) * C, (z + 1) * C],
      ];
    return [
      [x * C, z * C],
      [(x + 1) * C, z * C],
    ];
  };
  const a = ends(first)[0],
    b = ends(last)[1],
    out = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ][first.dir];
  return { a, b, out, length: Math.hypot(b[0] - a[0], b[1] - a[1]) };
}

/** A wall along a segment: a box `t` thick and `h` high centred on its line, its ends `inset` in from the segment's. */
function wallAlong(mb, tex, seg, h, t, inset = 0, y0 = 0) {
  const dx = (seg.b[0] - seg.a[0]) / seg.length,
    dz = (seg.b[1] - seg.a[1]) / seg.length,
    L = seg.length - 2 * inset;
  if (L <= 0.05) return;
  const cx = (seg.a[0] + seg.b[0]) / 2,
    cz = (seg.a[1] + seg.b[1]) / 2;
  mb.box(tex, [cx, y0 + h / 2, cz], [Math.abs(dx) * L + Math.abs(dz) * t, h, Math.abs(dz) * L + Math.abs(dx) * t]);
}

/**
 * A Daggerfall piece stood along a segment: its model (the meshReader's shape, metres, y up) laid with its longer
 * horizontal axis along the segment, stretched to `len`, its foot on the ground, its middle at `at` - a part of the
 * composed model, its pictures its own.
 */
export function pieceAlong(m, at, dir, len) {
  const p = m.positions,
    n = p.length / 3;
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    z0 = Infinity,
    z1 = -Infinity;
  for (let i = 0; i < n; i++) {
    x0 = Math.min(x0, p[i * 3]);
    x1 = Math.max(x1, p[i * 3]);
    y0 = Math.min(y0, p[i * 3 + 1]);
    z0 = Math.min(z0, p[i * 3 + 2]);
    z1 = Math.max(z1, p[i * 3 + 2]);
  }
  const alongX = x1 - x0 >= z1 - z0,
    own = alongX ? x1 - x0 : z1 - z0,
    k = own > 0 ? len / own : 1,
    cx = (x0 + x1) / 2,
    cz = (z0 + z1) / 2;
  const [ux, uz] = dir,
    wx = -uz,
    wz = ux; // along the segment, and across it
  const positions = new Float32Array(n * 3),
    normals = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const lx = p[i * 3] - cx,
      lz = p[i * 3 + 2] - cz,
      along = (alongX ? lx : lz) * k,
      across = alongX ? lz : lx;
    positions[i * 3] = at[0] + along * ux + across * wx;
    positions[i * 3 + 1] = p[i * 3 + 1] - y0;
    positions[i * 3 + 2] = at[1] + along * uz + across * wz;
    const nx = m.normals[i * 3],
      nz = m.normals[i * 3 + 2],
      na = (alongX ? nx : nz) / k,
      nc = alongX ? nz : nx;
    const ox = na * ux + nc * wx,
      oz = na * uz + nc * wz,
      oy = m.normals[i * 3 + 1],
      l = Math.hypot(ox, oy, oz) || 1;
    normals[i * 3] = ox / l;
    normals[i * 3 + 1] = oy / l;
    normals[i * 3 + 2] = oz / l;
  }
  // a turn that mirrors (the across axis taken from x to z) keeps its winding by turning each triangle back
  const mirrored = alongX ? ux * wz - uz * wx < 0 : ux * wz - uz * wx > 0;
  const indices = Uint32Array.from(m.indices);
  if (mirrored)
    for (let t = 0; t < indices.length; t += 3) {
      const b = indices[t + 1];
      indices[t + 1] = indices[t + 2];
      indices[t + 2] = b;
    }
  return { positions, normals, uvs: m.uvs, indices, subMeshes: m.subMeshes };
}

/** Runs of fence laid between two of the model's breaths (a city's fabric is a thousand pieces of fence and more). */
export const FABRIC_RUNS_A_BREATH = 64;

/**
 * THE TOWN'S FABRIC MODEL (the header).
 * @param {ReturnType<typeof import('./townFabric.js').fabricPlan>} plan
 * @param {string} style an URBAN_STYLES key
 * @param {{ cobbles?: boolean, classicModel?: (id: number) => any, lift?: ?((bx: number, by: number) => number) }} [o] `cobbles`
 *   whether its side streets are laid (a city's), `classicModel` Daggerfall's pieces (the model door's - null where it has
 *   none: the port's own alone), `lift` (SOLITUDE-RELIEF) a block's metres over the ground (capitalBlockLift), cut by block
 */
export function townFabricModel(plan, style, o = {}) {
  const steps = townFabricSteps(plan, style, o);
  let r = steps.next();
  while (!r.done) r = steps.next();
  return r.value;
}

/**
 * The same model made a step at a time, `breathe()` awaited between its steps (the model door's `buildSliced` - world/
 * customModels.js customModelBuilt: a city's fabric is a few hundred milliseconds of work on a slow machine, never one
 * frame's).
 * @param {ReturnType<typeof import('./townFabric.js').fabricPlan>} plan @param {string} style
 * @param {{ cobbles?: boolean, classicModel?: (id: number) => any }} o @param {() => any} breathe
 */
export async function townFabricModelSliced(plan, style, o, breathe) {
  const steps = townFabricSteps(plan, style, o);
  let r = steps.next();
  while (!r.done) {
    await breathe();
    r = steps.next();
  }
  return r.value;
}

/**
 * The model's steps: a yield after its streets, after every FABRIC_RUNS_A_BREATH runs of its yards' fences, after its
 * dead ends and woodpiles and after its own faces are mapped; its return the model.
 * @param {ReturnType<typeof import('./townFabric.js').fabricPlan>} plan @param {string} style
 * @param {{ cobbles?: boolean, classicModel?: (id: number) => any, lift?: ?((bx: number, by: number) => number) }} [o]
 */
export function* townFabricSteps(plan, style, { cobbles = false, classicModel = () => null, lift = null } = {}) {
  const st = URBAN_STYLES[style] ?? URBAN_STYLES.imperial,
    K = FABRIC_KIND,
    W = plan.W,
    H = plan.H,
    n = W * H;
  const mb = new MeshBuilder(),
    parts = [];
  const setts = styleArt(style, 'setts'),
    flags = styleArt(style, 'flags'),
    cobble = styleArt(style, 'cobbles'),
    wallTex = styleArt(style, 'wall');
  // SOLITUDE-RELIEF: a cell's block's lift (0 for a town on one ground: every piece as it was), pieces cut at blocks' edges
  const liftAt = (x, z) => (lift ? lift(Math.floor(x / BLOCK_CELLS), Math.floor(z / BLOCK_CELLS)) : 0);
  const runLift = (run) => {
    const x = run[0].inner % W;
    return liftAt(x, (run[0].inner - x) / W);
  };
  const runsOf = (edges) => (lift ? runsByBlock(edgeRuns({ W }, edges), W) : edgeRuns({ W }, edges));
  const flat = (tex, mask, y) => {
    const rects = cellRects(W, H, mask);
    for (const [x0, z0, x1, z1] of lift ? rectsByBlock(rects) : rects) {
      const yy = y + liftAt(x0, z0);
      mb.quad(tex, [x0 * C, yy, z0 * C], [x1 * C, yy, z0 * C], [x1 * C, yy, z1 * C], [x0 * C, yy, z1 * C], UP);
    }
  };
  // PROP-GROUND: a prop's clearance laid in the surface round it (world/urban/townFabric.js propGround)
  const { faces, surf } = fabricFaces(plan, style, cobbles),
    F = FABRIC_FACE;
  const of = (k, f) => {
    const m = new Uint8Array(n);
    for (let i = 0; i < n; i++) if (surf[i] === k && faces[i] === f) m[i] = 1;
    return m;
  };
  // the main streets: setts between the kerbs (none on the planks' styles - their forest floor between two boardwalks)
  flat(setts, of(K.main, F.road), FABRIC_ROAD_Y);
  flat(cobble, of(K.side, F.road), FABRIC_ROAD_Y);
  const pave = of(K.pave, F.flags);
  flat(flags, pave, FABRIC_PAVE_Y);
  // each kerb's face: a pavement's edge onto anything but a house, a prop's bare ground or another pavement - down to the
  // face laid past it, or to the land where none is (AUDIT PROP-GROUND: its foot had hung 5 cm over the land)
  const kerbs = [[], []];
  for (let i = 0; i < n; i++) {
    if (!pave[i]) continue;
    const x = i % W,
      z = (i - x) / W;
    [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].forEach(([dx, dz], dir) => {
      const nx = x + dx,
        nz = z + dz,
        j = nz * W + nx,
        inside = nx >= 0 && nz >= 0 && nx < W && nz < H;
      if (inside && (pave[j] || surf[j] === K.built)) return;
      kerbs[inside && faces[j] === F.road ? 0 : 1].push({ inner: i, outer: j, dir });
    });
  }
  for (const [k, foot] of [
    [0, FABRIC_ROAD_Y],
    [1, FABRIC_LAND_Y],
  ]) {
    for (const run of runsOf(kerbs[k])) {
      const s = runSegment(run, W),
        [ox, oz] = s.out,
        dy = runLift(run);
      mb.quad(
        flags,
        [s.a[0], foot + dy, s.a[1]],
        [s.b[0], foot + dy, s.b[1]],
        [s.b[0], FABRIC_PAVE_Y + dy, s.b[1]],
        [s.a[0], FABRIC_PAVE_Y + dy, s.a[1]],
        [ox, 0, oz],
      );
    }
  }
  yield 'streets';
  // the yards' fences or walls, and the pillars at their gates
  const fenceModel = st.yard === 'fence' ? classicModel(FABRIC_PIECES.fence) : null;
  let laid = 0;
  for (const run of runsOf(plan.fences)) {
    if (++laid % FABRIC_RUNS_A_BREATH === 0) yield 'fences';
    const s = runSegment(run, W),
      dir = [(s.b[0] - s.a[0]) / s.length, (s.b[1] - s.a[1]) / s.length],
      dy = runLift(run);
    if (fenceModel) {
      const pieces = Math.max(1, Math.round(s.length / 3.2)),
        len = s.length / pieces;
      for (let k = 0; k < pieces; k++)
        parts.push(
          raised(
            pieceAlong(fenceModel, [s.a[0] + dir[0] * len * (k + 0.5), s.a[1] + dir[1] * len * (k + 0.5)], dir, len),
            dy,
          ),
        );
    } else {
      wallAlong(mb, wallTex, s, FABRIC_WALL.h, FABRIC_WALL.t, 0, dy);
      wallAlong(
        mb,
        flags,
        s,
        FABRIC_WALL.copingH,
        FABRIC_WALL.t + 2 * FABRIC_WALL.coping,
        -FABRIC_WALL.coping,
        FABRIC_WALL.h + dy,
      );
    }
  }
  if (!fenceModel) {
    for (const run of runsOf(plan.gates)) {
      const s = runSegment(run, W),
        dy = runLift(run);
      for (const [x, z] of [s.a, s.b])
        mb.box(
          wallTex,
          [x, FABRIC_WALL.pillarH / 2 + dy, z],
          [FABRIC_WALL.pillar, FABRIC_WALL.pillarH, FABRIC_WALL.pillar],
        );
    }
  }
  yield 'yards';
  // the dead ends' walls
  for (const run of runsOf(plan.walls))
    wallAlong(
      mb,
      wallTex,
      runSegment(run, W),
      FABRIC_DEAD_WALL.h,
      FABRIC_DEAD_WALL.t,
      -FABRIC_DEAD_WALL.t / 2,
      runLift(run),
    );
  // the woodpiles: against their fence, log ends to the yard and along it, bark over the top; Daggerfall's crate beside
  const crate = classicModel(FABRIC_PIECES.crate);
  for (const p of plan.props) {
    const x = p.cell % W,
      z = (p.cell - x) / W,
      out = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ][p.dir],
      along = [-out[1], out[0]],
      dy = liftAt(x, z);
    const back = [
      (x + 0.5) * C + out[0] * (C / 2 - FABRIC_PILE.d / 2 - 0.2),
      (z + 0.5) * C + out[1] * (C / 2 - FABRIC_PILE.d / 2 - 0.2),
    ];
    const L = FABRIC_PILE.l,
      D = FABRIC_PILE.d,
      Y = FABRIC_PILE.h;
    const corner = (a, b, y) => [back[0] + along[0] * a + out[0] * b, y + dy, back[1] + along[1] * a + out[1] * b];
    const ends = urbanArt('logEnds');
    mb.quad(
      ends,
      corner(-L / 2, -D / 2, 0),
      corner(L / 2, -D / 2, 0),
      corner(L / 2, -D / 2, Y),
      corner(-L / 2, -D / 2, Y),
      [-out[0], 0, -out[1]],
    );
    mb.quad(
      ends,
      corner(L / 2, D / 2, 0),
      corner(-L / 2, D / 2, 0),
      corner(-L / 2, D / 2, Y),
      corner(L / 2, D / 2, Y),
      [out[0], 0, out[1]],
    );
    mb.quad(
      BARK,
      corner(-L / 2, -D / 2, Y),
      corner(L / 2, -D / 2, Y),
      corner(L / 2, D / 2, Y),
      corner(-L / 2, D / 2, Y),
      UP,
    );
    mb.quad(
      BARK,
      corner(L / 2, -D / 2, 0),
      corner(L / 2, D / 2, 0),
      corner(L / 2, D / 2, Y),
      corner(L / 2, -D / 2, Y),
      [along[0], 0, along[1]],
    );
    mb.quad(
      BARK,
      corner(-L / 2, D / 2, 0),
      corner(-L / 2, -D / 2, 0),
      corner(-L / 2, -D / 2, Y),
      corner(-L / 2, D / 2, Y),
      [-along[0], 0, -along[1]],
    );
    if (crate)
      parts.push(
        raised(
          pieceAlong(crate, [back[0] + along[0] * (L / 2 + 0.5), back[1] + along[1] * (L / 2 + 0.5)], along, 0.58),
          dy,
        ),
      );
  }
  yield 'props';
  const own = mb.groups.size ? vanillaTexels(mb.build()) : null;
  yield 'mapped';
  return composeArenaModel([...(own ? [own] : []), ...parts]);
}
