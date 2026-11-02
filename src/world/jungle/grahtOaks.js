// @ts-check
// ═══════════════════════════════════════════════════════════════════
// GRAHT1 (bible/03-World/Graht-Oaks.md; the owner, 2026-10-25: "Vardenfell needs proper super tall low poly tree sprites
// with branchs/leaves that expand to cover the sky. The current simple skybox method is very low quality and band
// aided" - the canopy over Valenwood's forest, VALENWOOD-CANOPY's ceiling of leaves) - THE GRAHT-OAKS' LAW: where
// Valenwood's giant trees stand, and what they stand. PURE and the terrain worker's (its import graph is world/ alone):
// the jungle's layout (world/terrain/jungleNature.js jungleLayout) stands them first, as the jungle's top storey, and
// every storey under them keeps off their feet; the pixel's build (scenes/pixelBuild.js) hands them to their host
// (scenes/grahtHost.js), which draws them, and files their trunks' bodies for the player's clamp.
//
//   - WHERE. A site a cell of GRAHT.cell tiles (102.4 m - a power of two dividing a pixel's 128, so a cell never straddles
//     a pixel) on the WORLD's lattice, its tree somewhere in the cell's middle (GRAHT.inset - so every foot keeps inside
//     its own pixel and no pixel asks its neighbours), standing where the canopy's zones close it: GRAHT.occupancy of the
//     sites at a whole canopy, thinning to none at the canopy's line (world/jungle/jungleCanopy.js canopyShare, the
//     light's own share - the trees ARE the canopy). Every draw a hash of the site's world tile (terrainNature.js
//     tileDraw): the same tree on every client, the worker and the main thread.
//   - WHAT IT NEVER STANDS ON. Its FOOT - the buttresses' reach at its scale (grahtMeasures foot) - wholly on land the
//     jungle keeps (the layout's `footOf`: DFU's dirt, grass and stone and the edges between them, GRAHT_LAND_RECORDS;
//     no road, track or trail - the road painter's `paths` and the jungle's own trails - no place's rect or clearing, no
//     water, no beach, nothing past DFU's 50 degrees), the trunk's
//     own tile no steeper than the jungle trees' 34, and the ground under the foot no rougher than GRAHT.bury - where it
//     stands at the lowest ground under its foot (sunk, never floating: the uphill buttresses go into the slope). A
//     town's trees stand round it, never in it; their crowns reach over its edge and over the roads cut through them.
//   - THE STOREYS UNDER IT. Every canopy tree, young tree, palm and roadside pair keeps off a graht-oak's whole foot; the
//     floor's plants off its trunk (grahtFootMask).
//   - ITS BODIES (grahtBodies): the trunk a body to where its limbs begin, each buttress a run of bodies along it - the
//     player walks round a graht-oak's roots, never through them (world/propBodies.js PROP-BODIES' shape).
//   - ITS LOD (grahtLodOf): by the distance over the tree's scale - LOD 0 near, LOD 1 to GRAHT.lod[1], LOD 2 past it.
// ═══════════════════════════════════════════════════════════════════
import { grahtSkeleton, grahtTrunkRadius, finSection, GRAHT_VARIANTS } from './grahtOakMesh.js';
import { createLookupTable } from '../terrain/terrainTiles.js';

/** The graht-oaks' numbers, in one place. Tiles are DFU's (6.4 m); metres else. */
export const GRAHT = Object.freeze({
  /** a site's cell (tiles: 102.4 m - divides 128) */
  cell: 16,
  /** where in its cell a trunk stands, a share each way - its middle 40%, so a foot at its largest (foot x scale[1])
   *  keeps 0.3 x 102.4 = 30.7 m from the cell's edge and never crosses its pixel's */
  inset: Object.freeze([0.3, 0.7]),
  /** a site's chance of a tree at a whole canopy (the canopy's share thins it to none at its line) */
  occupancy: 0.9,
  /** a tree's scale on its variant's own size */
  scale: Object.freeze([0.84, 1.2]),
  /** the most the ground under a foot may rise over its lowest (m, at the tree's scale) - rougher ground stands none */
  bury: 16,
  /** how far under the lowest ground under its foot a tree stands (m) */
  sink: 0.5,
  /** the jungle trees' own steepest (degrees) for the trunk's tile */
  steep: 34,
  /** the LODs' reach (m, over the tree's scale): LOD 0 nearer than [0], LOD 1 nearer than [1], LOD 2 past it */
  lod: Object.freeze([420, 1250]),
  /** the floor's plants keep off the trunk by its radius and this (m, at its scale) */
  floorClear: 3,
  /** the draws' salts (terrainNature.js tileDraw) - a band of their own */
  salt: 70,
});
/** A tree's floats, in a set: x, y, z (pixel-local m), yaw (radians), scale, variant. */
export const GRAHT_TREE_FLOATS = 6;

/** A buttress's bodies: its run along the ground from the trunk out to where it meets the ground, a body every
 *  GRAHT_FIN_STEP of it (m, at scale 1) - each on the drawn fin (grahtOakMesh.js finSection, the mesh's own law), as tall
 *  as the fin stands there. */
export const GRAHT_FIN_STEP = 2.5;
/** A body's least radius (m, at scale 1): a fin's thin edge still turns the player's capsule. */
export const GRAHT_FIN_BODY_R = 1.6;
/** A buttress's bodies in the tree's frame at scale 1 - [x, z, height] each: along the fin's cross-section at the ground
 *  (its line where the player walks), the fin's height at each the cross-section whose edge stands there. */
function finBodies(t, f) {
  const u0 = 3 / (f.rise + 3),
    g = finSection(t, f, u0); // the cross-section at the ground (y 0)
  const rad = [Math.cos(f.angle), Math.sin(f.angle)]; // its ground cross-section straight out along it (finSection's sweep nothing at the ground: rise 20 m and more)
  const out = [];
  for (let d = grahtTrunkRadius(t, 0) + GRAHT_FIN_STEP * 0.5; d < g.out - 1; d += GRAHT_FIN_STEP) {
    let lo = u0,
      hi = 1; // the cross-section whose edge stands at d (its edge comes in as it rises): its height
    for (let k = 0; k < 24; k++) {
      const mid = (lo + hi) / 2;
      if (finSection(t, f, mid).out > d) lo = mid;
      else hi = mid;
    }
    out.push(Object.freeze([rad[0] * d, rad[1] * d, finSection(t, f, lo).y]));
  }
  return Object.freeze(out);
}
/** A variant's MEASURES, off its skeleton: its height and crown's reach, the trunk's radius at the ground (its flare)
 *  and at a man's height, where its limbs begin, its foot (the farthest a buttress reaches), its buttresses' bodies
 *  (finBodies, every fin's) - every number at scale 1. */
function measuresOf(sk) {
  const t = sk.trunk;
  return Object.freeze({
    height: sk.height,
    crownR: sk.crownR,
    crownFrom: t.crownFrom,
    trunk: grahtTrunkRadius(t, 1.5),
    ground: grahtTrunkRadius(t, 0),
    foot: Math.max(...sk.fins.map((f) => f.reach)),
    finBodies: Object.freeze(sk.fins.flatMap((f) => finBodies(t, f))),
  });
}
/** Every variant's measures (grahtSkeleton's, made once at load - a few hundred draws each). */
export const GRAHT_MEASURES = Object.freeze(
  Array.from({ length: GRAHT_VARIANTS }, (_, v) => measuresOf(grahtSkeleton(v))),
);
/** The largest foot any tree stands (m) - the reach a site's tests and the storeys' mask look out to. */
export const GRAHT_FOOT_MAX = Math.max(...GRAHT_MEASURES.map((m) => m.foot)) * GRAHT.scale[1];

/**
 * THE LAND A FOOT MAY COVER: every tile record DFU's marching squares make of dirt, grass and stone - their transitions
 * too (world/terrain/terrainTiles.js createLookupTable, its rings past the water's: 1-3, 10-12, 15-17, 51, 53) - never one
 * with water in it (0, 5-7, 48). The jungle's own flats grow on the three alone (jungleNature.js JUNGLE.ground, DFU's
 * law); a buttress lies over the edge between two of them, where a foot held to them stood on 59% of the sites the
 * occupancy drew (the Bay's whole jungle, measured on the freeware: 34.2 a pixel of 57.6) and the canopy opened.
 */
export const GRAHT_LAND_RECORDS = Object.freeze(
  [...new Set(Array.from(createLookupTable().subarray(16), (v) => v & 0x3f))].sort((a, b) => a - b),
);

/** A tree's LOD at `d` metres from the eye over its scale. */
export const grahtLodOf = (d) => (d < GRAHT.lod[0] ? 0 : d < GRAHT.lod[1] ? 1 : 2);

/**
 * A PIXEL'S GRAHT-OAKS - its trees, GRAHT_TREE_FLOATS each (pixel-local), on the lattice of its world tiles from
 * (ox, oz) (its first tile, FOREST1's frame). `share(mx, mz)` the canopy's share at a point (0..1); `growsOn(ti)` a tile
 * a foot may cover (the layout's footOf - GRAHT_LAND_RECORDS); `steepAt(ti)` a tile past the trees' steepest; `ground(mx, mz)` the
 * ground's height (m); `trailOk(mx, mz, r)` no trail within r; `draw(wx, wz, salt)` the world tile's own dice. `tiles`
 * a pixel's side in tiles, `tileM` a tile in metres.
 * @param {{ ox: number, oz: number, tiles: number, tileM: number, share: (x: number, z: number) => number,
 *   growsOn: (ti: number) => boolean, steepAt: (ti: number) => boolean, ground: (x: number, z: number) => number,
 *   trailOk: (x: number, z: number, r: number) => boolean, draw: (wx: number, wz: number, salt: number) => number }} a
 * @returns {Float32Array}
 */
export function grahtSites({ ox, oz, tiles, tileM, share, growsOn, steepAt, ground, trailOk, draw }) {
  const C = GRAHT.cell,
    cells = tiles / C,
    out = [],
    [in0, in1] = GRAHT.inset,
    S = GRAHT.salt;
  for (let cy = 0; cy < cells; cy++) {
    for (let cx = 0; cx < cells; cx++) {
      const wx = ox + cx * C,
        wz = oz + cy * C;
      const tx = cx * C + C * (in0 + (in1 - in0) * draw(wx, wz, S)),
        tz = cy * C + C * (in0 + (in1 - in0) * draw(wx, wz, S + 1));
      const mx = tx * tileM,
        mz = tz * tileM;
      if (draw(wx, wz, S + 2) >= GRAHT.occupancy * share(mx, mz)) continue;
      const variant = Math.min(GRAHT_VARIANTS - 1, Math.floor(draw(wx, wz, S + 3) * GRAHT_VARIANTS));
      const scale = GRAHT.scale[0] + (GRAHT.scale[1] - GRAHT.scale[0]) * draw(wx, wz, S + 4);
      const foot = GRAHT_MEASURES[variant].foot * scale;
      const ti0 = Math.floor(tz) * tiles + Math.floor(tx);
      if (steepAt(ti0)) continue;
      // the whole foot on land a foot may cover: every tile whose middle lies within the foot (and a half tile)
      const reach = foot + tileM * 0.5,
        rt = Math.ceil(reach / tileM);
      let ok = true,
        lo = Infinity,
        hi = -Infinity;
      for (let y = Math.max(0, Math.floor(tz) - rt); y <= Math.min(tiles - 1, Math.floor(tz) + rt) && ok; y++) {
        for (let x = Math.max(0, Math.floor(tx) - rt); x <= Math.min(tiles - 1, Math.floor(tx) + rt); x++) {
          const dx = (x + 0.5) * tileM - mx,
            dz = (y + 0.5) * tileM - mz;
          if (dx * dx + dz * dz > reach * reach) continue;
          if (!growsOn(y * tiles + x)) {
            ok = false;
            break;
          }
          const g = ground((x + 0.5) * tileM, (y + 0.5) * tileM);
          if (g < lo) lo = g;
          if (g > hi) hi = g;
        }
      }
      if (!ok || hi - lo > GRAHT.bury * scale || !trailOk(mx, mz, foot)) continue;
      out.push(mx, Math.min(lo, ground(mx, mz)) - GRAHT.sink, mz, draw(wx, wz, S + 5) * Math.PI * 2, scale, variant);
    }
  }
  return Float32Array.from(out);
}

/**
 * THE STOREYS' MASK: a tile (of `tiles` x `tiles`, `tileM` metres) is 1 where its middle lies within a graht-oak's foot
 * (its whole reach, every tree and palm keeps off it) and 2 within its trunk (the floor's plants keep off that too);
 * 0 elsewhere - or null for a pixel with none.
 * @param {Float32Array} trees @param {number} tiles @param {number} tileM
 */
export function grahtFootMask(trees, tiles, tileM) {
  if (!trees?.length) return null;
  const mask = new Uint8Array(tiles * tiles);
  for (let i = 0; i < trees.length; i += GRAHT_TREE_FLOATS) {
    const mx = trees[i],
      mz = trees[i + 2],
      s = trees[i + 4],
      m = GRAHT_MEASURES[trees[i + 5]];
    const foot = m.foot * s + tileM * 0.5,
      core = (m.ground + GRAHT.floorClear) * s + tileM * 0.5; // a tile whose middle is within either (and half a tile: a plant stands anywhere in its tile)
    const rt = Math.ceil(foot / tileM),
      cx = Math.floor(mx / tileM),
      cz = Math.floor(mz / tileM);
    for (let y = Math.max(0, cz - rt); y <= Math.min(tiles - 1, cz + rt); y++) {
      for (let x = Math.max(0, cx - rt); x <= Math.min(tiles - 1, cx + rt); x++) {
        const dx = (x + 0.5) * tileM - mx,
          dz = (y + 0.5) * tileM - mz,
          d2 = dx * dx + dz * dz;
        if (d2 <= core * core) mask[y * tiles + x] = 2;
        else if (d2 <= foot * foot && mask[y * tiles + x] === 0) mask[y * tiles + x] = 1;
      }
    }
  }
  return mask;
}

/**
 * A TREE'S BODIES (world/propBodies.js's shape: `{ c, r, h, lift, body, nature, _mark }`, its foot `c` pixel-local): the trunk to
 * where its limbs begin, and each buttress a run of bodies from the trunk to its foot.
 * @param {ArrayLike<number>} trees a set's floats @param {number} i the tree's first
 */
export function grahtBodies(trees, i) {
  const x = trees[i],
    y = trees[i + 1],
    z = trees[i + 2],
    yaw = trees[i + 3],
    s = trees[i + 4],
    m = GRAHT_MEASURES[trees[i + 5]];
  const out = [{ c: [x, y, z], r: m.trunk * s, h: (m.crownFrom + 4) * s, lift: 0, body: true, nature: true, _mark: 0 }];
  const c = Math.cos(yaw),
    sn = Math.sin(yaw);
  for (const [bx, bz, bh] of m.finBodies) {
    // in the world, turned and scaled as the mesh is (BB_VS's mesh mode: x' = c x + s z, z' = -s x + c z)
    out.push({
      c: [x + (c * bx + sn * bz) * s, y, z + (-sn * bx + c * bz) * s],
      r: GRAHT_FIN_BODY_R * s,
      h: Math.max(2, bh * s + 1),
      lift: 0,
      body: true,
      nature: true,
      _mark: 0,
    });
  }
  return out;
}
