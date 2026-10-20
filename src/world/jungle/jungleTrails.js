// JUNGLE-TRAILS (2026-10-19, the owner: "Implement procedural dirt pathways that cut through the forest"). The jungle's
// own trails: dirt worn through its floor, winding, meeting, looping - never the road painter's tracks, which run
// straight from a pixel's middle to its edge and are the map's (the travel map, the ink map, the landforms, fast
// travel read them). A trail is where a field on the WORLD's lattice crosses its middle value: two families of them
// (JUNGLE_TRAILS.families), each a value noise (ecotone.js ecoHash) seen through a warp of its own, so a trail bends as
// a path walked round trees bends and the two families cross at junctions. The field is a pure function of the world
// tile, so a trail runs on unbroken across every pixel's edge - the worker and the main thread, every client alike -
// with no graph of neighbours to agree on.
//
// The terrain kernel (world/terrain/terrainGen.js) paints each pixel's trails into its tile data before the marching
// squares run: a corner on a trail is dirt (never water), so DFU's own dirt-to-grass tiles blend its edges; and every
// tile two of whose corners are the trail's - half dirt by its art and more - goes into the pixel's `paths` (a tile with
// one is the trail's edge, a corner of dirt the floor grows over) - the mask the road painter keeps (GRASS-PATH1) and every
// layer that keeps off a track already reads (the jungle's trees, palms and floor, Real forests, the meadow's grass and
// the jungle floor's carpet, the home yards). Only where the jungle is whole (JUNGLE_EDGE.in deep): the ground at its
// edge is the pixel's own layout's too, and DFU's scatter reads no mask. Never in a location's rect. A jungle tree keeps
// its foot off a trail as VERGE1 keeps it off a road (jungleNature.js withJungle, trailClear). The heights are never
// moved: a trail is worn into the ground, not cut, so the room's ground is the ground it was.
// bible/03-World/Bantha-Jungle.md "The trails".
import { ecoHash } from '../ecotone.js';
import { jungleDepthAt, JUNGLE_EDGE, JUNGLE_WANDER_MAX } from './jungleRegion.js';
import { TERRAIN_SIZE } from '../terrain/terrainSampler.js';
import { WORLD_MAP_TILE_DIM, WATER, DIRT } from '../terrain/terrainTiles.js';

/** The trails' numbers, in one place. Tiles are DFU's (6.4 m), on the world's lattice (x east, z north). */
export const JUNGLE_TRAILS = Object.freeze({
  /** each family: its field's lattice (tiles), its salt, its lattice's turn off the world's axes (a cosine and a sine,
   *  a Pythagorean triple's - exact in every engine, where Math.cos is not, and the room agrees on its trails) so no
   *  trail runs along a lattice line, and its warp - a value noise a coordinate, `amp` tiles each way over `cell`-tile
   *  cells: 6 amp under its cell, so the warp can never fold a trail back over itself (warpStretch under 2) */
  families: Object.freeze([
    Object.freeze({ cell: 176, salt: 701, turn: Object.freeze([4 / 5, 3 / 5]), warp: Object.freeze({ cell: 112, amp: 18 }) }),
    Object.freeze({ cell: 240, salt: 709, turn: Object.freeze([12 / 13, -5 / 13]), warp: Object.freeze({ cell: 160, amp: 26 }) }),
  ]),
  /** the lattice's values are held this far off the trail's middle value either side, so no island of the field - and
   *  no ring of trail round it - is smaller than about half a cell */
  gap: 0.1,
  /** a trail's half width (tiles): a corner this near its line is dirt - past a corner's diagonal half (0.71), so the
   *  dirt runs unbroken whatever the line's heading */
  half: 0.75,
  /** the painter reads the field a block of this many tiles square at a time, and a block no family's line can reach
   *  (its bound, below) not at all */
  block: 4,
});

const s3 = (t) => t * t * (3 - 2 * t), ds3 = (t) => 6 * t * (1 - t);
/** a lattice point's value, held off the middle by JUNGLE_TRAILS.gap */
const lattice = (ix, iz, salt) => {
  const v = ecoHash(ix, iz, salt) * (1 - 2 * JUNGLE_TRAILS.gap);
  return v < 0.5 - JUNGLE_TRAILS.gap ? v : v + 2 * JUNGLE_TRAILS.gap;
};
/** value noise at (x, z) tiles over `cell`-tile cells: its value and its gradient (per tile) into out[0..2] - the
 *  gradient no steeper than 1.5 / cell an axis (smoothstep's steepest, a lattice step of at most 1) */
function valueNoise(x, z, cell, salt, out) {
  const qx = x / cell, qz = z / cell, ix = Math.floor(qx), iz = Math.floor(qz), fx = qx - ix, fz = qz - iz;
  const a = lattice(ix, iz, salt), b = lattice(ix + 1, iz, salt), c = lattice(ix, iz + 1, salt), d = lattice(ix + 1, iz + 1, salt);
  const ux = s3(fx), uz = s3(fz), top = a + (b - a) * ux, bot = c + (d - c) * ux;
  out[0] = top + (bot - top) * uz;
  out[1] = ((b - a) * (1 - uz) + (d - c) * uz) * ds3(fx) / cell;
  out[2] = (bot - top) * ds3(fz) / cell;
}

/** how far the warp can stretch a step at most: 1 + its amplitude (2 amp) times its two noises' steepest together
 *  (3 / cell) - under 2 by JUNGLE_TRAILS.families' own law */
export const warpStretch = (fam) => 1 + (2 * fam.warp.amp * 3) / fam.warp.cell;
/** how steeply (per tile) a family's field can change at most: its noise's steepest (1.5 sqrt 2 / cell) through the
 *  warp's stretch */
const steepest = (fam) => ((1.5 * Math.SQRT2) / fam.cell) * warpStretch(fam);

const _u = [0, 0, 0], _v = [0, 0, 0], _f = [0, 0, 0];
/** a family's field at the world tile point (wx, wz) into _f (its value, its gradient in the turned, warped frame), the
 *  warp's noises in _u and _v; answers the warp's amplitude */
function field(wx, wz, fam) {
  const [c, s] = fam.turn;
  const x = c * wx - s * wz, z = s * wx + c * wz;   // turned: a rotation keeps every distance
  valueNoise(x, z, fam.warp.cell, fam.salt + 1, _u);
  valueNoise(x, z, fam.warp.cell, fam.salt + 2, _v);
  const A = 2 * fam.warp.amp;
  valueNoise(x + A * (_u[0] - 0.5), z + A * (_v[0] - 0.5), fam.cell, fam.salt, _f);
  return A;
}
/** how far (tiles) the world tile point (wx, wz) stands from one family's trail line: the field's distance from its
 *  middle value over its gradient - the line's distance where the field runs straight, the warp carried through (the
 *  chain rule; the turn keeps the gradient's length). A flat field is far from any line (0 on it, as a flat field
 *  exactly at the middle - nowhere in practice - is). */
function familyDistance(wx, wz, fam) {
  const A = field(wx, wz, fam);
  const gx = _f[1] * (1 + A * _u[1]) + _f[2] * A * _v[1];
  const gz = _f[1] * A * _u[2] + _f[2] * (1 + A * _v[2]);
  const off = Math.abs(_f[0] - 0.5), g = Math.sqrt(gx * gx + gz * gz);
  return g > 0 ? off / g : (off > 0 ? Infinity : 0);
}

/** How far (tiles) the world tile point (wx, wz) - x east, z north (FOREST1's frame: a pixel's first tile px * 128,
 *  -py * 128) - stands from the nearest trail's line, wherever the jungle is. */
export function trailDistance(wx, wz) {
  let d = Infinity;
  for (const fam of JUNGLE_TRAILS.families) d = Math.min(d, familyDistance(wx, wz, fam));
  return d;
}

const NB = WORLD_MAP_TILE_DIM / JUNGLE_TRAILS.block;   // a pixel's blocks a side
let _blocksOf = -1, _blocksPy = 0, _blocks = new Float64Array(0);
/**
 * A PIXEL'S BLOCKS (JUNGLE_TRAILS.block tiles square, NB x NB, row by row from its first tile): for each family in turn,
 * a floor (tiles) under how near its line comes to any point of the block - the field's distance from the middle at the
 * block's middle over its steepest, less the block's half diagonal: the field moves no faster than its steepest, and a
 * point's distance from the line is its field's distance from the middle over a gradient no steeper. Exact, never an
 * estimate: test/world/jungletrails.test.js reads every corner too and asks the same answer. The last pixel's kept -
 * the painter and the jungle's trees read the same pixel's in turn.
 * @returns {Float64Array} families x NB x NB
 */
export function trailBlocks(px, py) {
  if (_blocksOf === px && _blocksPy === py) return _blocks;
  const B = JUNGLE_TRAILS.block, H = B / 2, R = Math.SQRT2 * H, ox = px * WORLD_MAP_TILE_DIM, oz = -py * WORLD_MAP_TILE_DIM;
  const fams = JUNGLE_TRAILS.families, out = new Float64Array(fams.length * NB * NB);
  fams.forEach((fam, k) => {
    for (let j = 0; j < NB; j++) {
      for (let i = 0; i < NB; i++) {
        field(ox + i * B + H, oz + j * B + H, fam);
        out[(k * NB + j) * NB + i] = Math.abs(_f[0] - 0.5) / steepest(fam) - R - 1e-9;   // a rounding's margin, toward near
      }
    }
  });
  _blocksOf = px; _blocksPy = py; _blocks = out;
  return out;
}

/** How far (m) a pixel-local point (x east, z north, metres) stands from the nearest trail's dirt - its line less its
 *  half width - 0 on it. A tree whose foot reaches less stands clear (jungleNature.js withJungle). */
export function trailRoom(px, py, x, z) {
  const scale = TERRAIN_SIZE / WORLD_MAP_TILE_DIM;
  return Math.max(0, (trailDistance(px * WORLD_MAP_TILE_DIM + x / scale, -py * WORLD_MAP_TILE_DIM + z / scale) - JUNGLE_TRAILS.half) * scale);
}

/** Whether a disc of `reach` (m) about a pixel-local point (x east, z north, metres) stands clear of every trail's dirt
 *  (VERGE1's vergeClear's shape): its block's floor first (trailBlocks), the point's own distance only where that cannot
 *  say. A jungle tree keeps its foot so (jungleNature.js withJungle). */
export function trailClear(px, py, x, z, reach) {
  const scale = TERRAIN_SIZE / WORLD_MAP_TILE_DIM, bx = Math.floor(x / scale / JUNGLE_TRAILS.block), bz = Math.floor(z / scale / JUNGLE_TRAILS.block);
  if (bx >= 0 && bx < NB && bz >= 0 && bz < NB) {
    const blocks = trailBlocks(px, py), need = JUNGLE_TRAILS.half + reach / scale;
    let far = true;
    for (let k = 0; k < JUNGLE_TRAILS.families.length; k++) if (blocks[(k * NB + bz) * NB + bx] < need) far = false;
    if (far) return true;
  }
  return trailRoom(px, py, x, z) >= reach;
}

/** Whether a pixel's 3x3 of the jungle's field (jungleNine) can reach JUNGLE_EDGE.in anywhere in it - the wander and
 *  all - so its trails are worth reading. */
export function trailsReach(nine) {
  let hi = -Infinity;
  for (let k = 0; k < 9; k++) hi = Math.max(hi, nine[k]);
  return hi * TERRAIN_SIZE + JUNGLE_WANDER_MAX >= JUNGLE_EDGE.in;
}

/**
 * THE TRAILS INTO A PIXEL'S TILE DATA (129 x 129 corners, generateTileData's: x + y * 129) - before the marching squares
 * run (terrainTiles.js assignTiles). A corner on a trail - within JUNGLE_TRAILS.half of its line, on land, out of the
 * location's rect, where the jungle is whole - is dirt; every tile no painter wrote (the tilemap's 0) with two such
 * corners - half dirt by its marching square's art and more - goes into `paths`. Answers the paths mask: the one handed, or a new one where a trail ran and none was (the kernel's
 * `paths` stays null where no network and no trail ran).
 * @param {Uint8Array} tileData @param {Uint8Array} tilemap the pixel's 128 x 128 (y * 128 + x) @param {?Uint8Array} paths
 * @param {{ px: number, py: number, nine: ArrayLike<number>, whole?: boolean,
 *   rect?: ?{ xMin: number, xMax: number, yMin: number, yMax: number } }} at
 *   `whole` - the jungle owns every corner (jungleNature.js jungleWhole), its depth unread
 */
export function paintJungleTrails(tileData, tilemap, paths, { px, py, nine, whole = false, rect = null }) {
  if (!nine || (!whole && !trailsReach(nine))) return paths;
  const T = WORLD_MAP_TILE_DIM, D = T + 1, scale = TERRAIN_SIZE / T, ox = px * T, oz = -py * T;
  const B = JUNGLE_TRAILS.block, fams = JUNGLE_TRAILS.families, near = [], blocks = trailBlocks(px, py);
  const on = new Uint8Array(D * D);
  let n = 0;
  for (let by = 0; by < T; by += B) {
    for (let bx = 0; bx < T; bx += B) {
      near.length = 0;
      fams.forEach((fam, k) => { if (blocks[(k * NB + by / B) * NB + bx / B] <= JUNGLE_TRAILS.half) near.push(fam); });
      if (!near.length) continue;
      // the block's own corners: its first B a side, and the pixel's last row and column with the last block's
      for (let y = by; y < (by + B === T ? D : by + B); y++) {
        for (let x = bx; x < (bx + B === T ? D : bx + B); x++) {
          const i = x + y * D;
          if (tileData[i] === WATER) continue;
          if (rect && x >= rect.xMin && x <= rect.xMax && y >= rect.yMin && y <= rect.yMax) continue;   // the town's own ground, to its edge
          let d = Infinity;
          for (const fam of near) d = Math.min(d, familyDistance(ox + x, oz + y, fam));
          if (d > JUNGLE_TRAILS.half) continue;
          if (!whole && jungleDepthAt(px, py, nine, x * scale, y * scale) < JUNGLE_EDGE.in) continue;
          on[i] = 1;
          tileData[i] = DIRT;
          n++;
        }
      }
    }
  }
  if (!n) return paths;
  paths ??= new Uint8Array(T * T);
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const t = y * T + x, i = x + y * D;
      if (tilemap[t] === 0 && on[i] + on[i + 1] + on[i + D] + on[i + D + 1] >= 2) paths[t] = 1;   // half dirt by its art and more
    }
  }
  return paths;
}
