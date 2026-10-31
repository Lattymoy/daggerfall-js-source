// @ts-check
// SOLITUDE-RELIEF (2026-10-27, bible/03-World/Arena-Provinces.md; a departure from DFU's BlendLocationTerrain, as
// RUMARE-WATER's capitalSea.js is) - A CAPITAL ON A RELIEF OF ITS OWN (CAPITAL_RELIEFS: Solitude's world/solitudeRelief.js).
// Its blocks stand on its streets' level (`flat`, terrainGen.js's flatten) and every vertex of its pixel on the relief:
// the sea's where the relief is at the sea - its blocks lay their water there alone (solitudeGroundTile), a Daggerfall
// block's pond stays on its tier (read as the sea, it sank a 46 m pit into the Well District) - else the relief's height;
// the outer `band` samples eased to the land's own, so no seam opens with the pixels round it. Pure and worker-safe: the
// terrain worker and this thread read the same law.
import {
  SCALED_OCEAN_ELEVATION,
  MAX_TERRAIN_HEIGHT,
  HEIGHTMAP_DIMENSION,
  STREAMING_TERRAIN_SCALE,
} from './terrainSampler.js';
import {
  solitudeHeight,
  solitudeWalkShut,
  SOLITUDE_LEVELS,
  SOLITUDE_PIXEL,
  SOLITUDE_EDGE_BAND,
} from '../solitudeRelief.js';

const f32 = Math.fround;
/** Metres over the sea as the samples are normalized (the kernel's unit is STREAMING_TERRAIN_SCALE metres). */
export const reliefSample = (metres) =>
  f32((SCALED_OCEAN_ELEVATION + metres / STREAMING_TERRAIN_SCALE) / MAX_TERRAIN_HEIGHT);
/** The sea's own height, normalized (capitalSea.js CAPITAL_SEA's). */
const SEA = f32(SCALED_OCEAN_ELEVATION / MAX_TERRAIN_HEIGHT);

/**
 * THE CAPITALS' RELIEFS, by key: `height(x, z)` metres over the sea at a point of the anchor's metres (x east, z south),
 * `flat` the streets' level (metres) its blocks stand on, its pixel's north-west corner in those metres (`x0`, `z0`) and
 * its side, `band` - how many samples in from the pixel's edge the land's own heights are eased to - and `walkShut(x, z)`
 * where its walkers never go (its terraces' works, world/townWalls.js townWalkShut).
 */
export const CAPITAL_RELIEFS = Object.freeze({
  solitude: Object.freeze({
    height: solitudeHeight,
    flat: SOLITUDE_LEVELS.city,
    x0: SOLITUDE_PIXEL.x0,
    z0: SOLITUDE_PIXEL.z0,
    side: SOLITUDE_PIXEL.side,
    band: SOLITUDE_EDGE_BAND,
    walkShut: solitudeWalkShut,
  }),
});
/** A capital location's relief (its flatten's `relief` key's, CAPITAL_RELIEFS) - null for every other location. */
export const reliefOf = (dfLocation) => CAPITAL_RELIEFS[dfLocation?.capital?.flattenAt?.relief] ?? null;
/** The flatten a capital with a relief takes (world/terrain/terrainGen.js flattenAt.relief): its streets' level. */
export function reliefFlat(key) {
  const r = CAPITAL_RELIEFS[key];
  const v = reliefSample(r ? r.flat : 0);
  return { avg: v, classic: v };
}

const T = 128,
  H = HEIGHTMAP_DIMENSION;

const smooth = (t) => {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return k * k * (3 - 2 * k);
};

/** A vertex's place in a relief's anchor metres: x east from its pixel's west edge, z south from its north edge (y 0 the
 *  pixel's south edge). */
export const reliefVertexAt = (r, x, y) => [r.x0 + (x * r.side) / T, r.z0 + ((T - y) * r.side) / T];
/** AUDIT CAPITAL-CARRIAGES L4: the relief AS DRAWN at a point (anchor metres; metres over the sea) - its vertices' heights
 *  across the quad's two triangles, as terrainSurface.js surfaceHeightAt splits them. Between vertices the relief's own
 *  law and the drawn ground differ: a carriage stood level on the law sat 0.6 m into its bank. The outer band aside. */
export function reliefDrawnAt(r, x, z) {
  const q = r.side / T,
    lx = (x - r.x0) / q,
    lz = (r.z0 + r.side - z) / q;
  const qx = Math.max(0, Math.min(T - 1, Math.floor(lx))),
    qz = Math.max(0, Math.min(T - 1, Math.floor(lz))),
    ax = lx - qx,
    az = lz - qz;
  const h = (i, j) => r.height(...reliefVertexAt(r, i, j));
  const h00 = h(qx, qz),
    h10 = h(qx + 1, qz),
    h01 = h(qx, qz + 1),
    h11 = h(qx + 1, qz + 1);
  return az >= ax ? h00 + az * (h01 - h00) + ax * (h11 - h01) : h00 + ax * (h10 - h00) + az * (h11 - h10);
}

/**
 * THE GROUND OF A CAPITAL ON ITS RELIEF, after its flatten (every sample of its rect at its streets' level, its rim
 * blended): every vertex the relief's height (the header's law), the sea's where the relief is, the outer band eased to the
 * land's own. Mutates `S` in place.
 * @param {Float32Array} S the pixel's samples (x * 129 + y, y north), flattened
 * @param {Float32Array} natural the same samples before the flatten (the land's own ground)
 * @param {string} key the relief's (CAPITAL_RELIEFS)
 */
export function capitalReliefGround(S, natural, key) {
  const r = CAPITAL_RELIEFS[key];
  if (!r) return;
  for (let x = 0; x < H; x++) {
    for (let y = 0; y < H; y++) {
      const i = x * H + y;
      const [ax, az] = reliefVertexAt(r, x, y),
        m = r.height(ax, az);
      const own = m <= 1e-3 ? SEA : reliefSample(m);
      // the outer band: the land's own at the edge, eased to the relief's over `band` samples in
      const d = Math.min(x, y, T - x, T - y),
        w = d >= r.band ? 0 : 1 - smooth(d / r.band);
      const v = w > 0 ? f32(own + (natural[i] - own) * w) : own;
      S[i] = v <= SEA ? SEA : v;
    }
  }
}
