// @ts-check
// ROAD-LOOK (2026-10-27, KPbICA through the owner: "Texture blending for road tiles and surroundings") - A ROAD'S EDGE
// BLENDS INTO ITS GROUND, in both terrain programs (renderer.js TERRAIN_FS and the lane's EL_TERRAIN_FS), right after
// the fragment's own tile is sampled. world/road/roadEdge.js is the law and the reason; this is its twin in GLSL, term
// for term - the same hash, the same lattice, the same dials (read from ROAD_EDGE, never restated) - and
// test/world/road/roadlook.test.js runs it through test/glsl.mjs against the JS.
//
// It reads the pixel's own tilemap (uTilemap, unit 2) for the three cells round the fragment's nearest tile corner, and
// the tile array (uTileArr) for a neighbour's picture where the fragment draws one. `uRoadEdge` is the switch, a frame's
// (renderer.js `roadEdges`, roadEdgesOn below): 0 draws every tile as DFU does - the classic skin, the kill door. It is
// declared after the program's ROT and TRANS tables, which it turns a neighbour's picture by.
import { ROAD_EDGE, ROAD_EDGE_WET, ROAD_PAVING } from '../world/road/roadEdge.js';
import { GROUND_RECORD_LIMIT } from '../world/terrain/terrainTiles.js';
import { pageParam } from '../systems/pageQuery.js'; // the kill door
import { isEnhanced } from '../systems/uiSkin.js'; // the skin

/** A ROAD'S EDGE BLENDED INTO ITS GROUND - the enhanced skin's ground, whatever the page (it moves no flat and no step: a
 *  picture alone); the classic skin keeps DFU's tiles to their edges. `?roadedges=off` the kill door. No Features row.
 *  The skin is a page's (systems/uiSkin.js: a new skin reloads the page), so the renderer takes it once, as it is made -
 *  every host and lab that draws the ground alike, and no host's own line.
 *  @param {string} [search] */
export function roadEdgesOn(search) {
  return pageParam('roadedges', search) !== 'off' && isEnhanced(search);
}

const f = (v) => (Number.isInteger(v) ? `${v}.0` : `${v}`);

/** The edges' lattice noise (ROAD-LOOK's, COAST-LOOK's too - render/groundEdgeGlsl.js): `reHash`, the lattice hash, and
 *  `reNoise`, value noise on a lattice of whole cells a pixel's side. Its one text: roadEdgeGlsl carries it, and a program
 *  that draws no road edge and wanders a coast's (render/waterSurface.js) takes it on its own. */
export const EDGE_NOISE_GLSL = `float reHash(highp ivec2 c, highp uint salt) {
  highp uint h = (uint(c.x) * 0x8da6b343u) ^ (uint(c.y) * 0xd8163841u) ^ (salt * 0xcb1ab31fu);
  h ^= h >> 16u; h *= 0x7feb352du; h ^= h >> 15u; h *= 0x846ca68bu; h ^= h >> 16u;
  return float(h >> 8u) * (1.0 / 16777216.0);
}
// value noise on a lattice of \`n\` cells a pixel's side, its indices taken modulo the pixel (the same on both sides of its edge)
float reNoise(vec2 p, highp int n, highp uint salt) {
  vec2 q = p * (float(n) / 128.0);
  vec2 fl = floor(q);
  highp ivec2 i = ivec2(fl);   // never negative: p is the pixel's own, 0..128
  highp ivec2 i0 = i % n, i1 = (i + 1) % n;
  vec2 fr = q - fl;
  vec2 u = fr * fr * (3.0 - 2.0 * fr);
  float a = reHash(i0, salt), b = reHash(ivec2(i1.x, i0.y), salt), c = reHash(ivec2(i0.x, i1.y), salt), d = reHash(i1, salt);
  float top = a + (b - a) * u.x, bot = c + (d - c) * u.x;
  return top + (bot - top) * u.y;
}
`;

/**
 * The chunk, for a program whose texels decode through `decode` (the lane's elDecode; '' for the classic program's
 * display values). Declares `uRoadEdge` and `vec3 roadEdge(vec3 own, uint data, vec2 p, vec2 gx, vec2 gy, int t)`:
 * `own` the fragment's own decoded texel, `data` its tile byte, `p` its pixel-local tile coordinate (the program's
 * `unwrapped`), `gx`/`gy` its own gradient (ROT[t] of the coordinate's), `t` its own turn.
 * @param {string} decode
 */
export function roadEdgeGlsl(decode = '') {
  const s = ROAD_EDGE.soft;
  return `// ROAD-LOOK (render/roadEdgeGlsl.js; the law is world/road/roadEdge.js)
uniform float uRoadEdge;   // 0: every tile its own, as DFU draws it
const highp uvec2 RE_WET = uvec2(${ROAD_EDGE_WET[0]}u, ${ROAD_EDGE_WET[1]}u);   // the records that carry water, 0-31 and 32-63
bool reRoad(highp uint d) { return (d >> 2u) == ${ROAD_PAVING}u; }   // the paving: its edge tiles are the ground's side
bool reTakes(highp uint d) { highp uint r = d >> 2u; return r < ${GROUND_RECORD_LIMIT}u && (((r < 32u ? (RE_WET.x >> r) : (RE_WET.y >> (r - 32u))) & 1u) == 0u); }
${EDGE_NOISE_GLSL}float reWander(vec2 p) {
  return ${ROAD_EDGE.wander.map((o, k) => `${f(o.amp)} * (2.0 * reNoise(p, ${o.cells}, ${ROAD_EDGE.salt + k}u) - 1.0)`).join(' + ')};
}
float reNear(float d) { float w = max(0.5 - d, 0.0); return w * w / max(d * d, 1e-6); }
highp uint reCell(highp ivec2 c) { return texelFetch(uTilemap, clamp(c, ivec2(0), ivec2(127)), 0).r; }
// a cell's picture at p, mirrored about the cell's own square and turned by its own transform, at the fragment's gradient
vec3 reTexel(highp uint d, highp ivec2 c, vec2 p, vec2 dux, vec2 duy) {
  vec2 l = p - vec2(c);
  l = vec2(l.x < 0.0 ? -l.x : (l.x > 1.0 ? 2.0 - l.x : l.x), l.y < 0.0 ? -l.y : (l.y > 1.0 ? 2.0 - l.y : l.y));
  int t = int(d & 3u);
  return ${decode}(textureGrad(uTileArr, vec3(ROT[t] * l + TRANS[t], float(d >> 2u)), ROT[t] * dux, ROT[t] * duy).rgb);
}
vec3 roadEdge(vec3 own, highp uint data, vec2 p, vec2 gx, vec2 gy, int t) {
  if (uRoadEdge <= 0.0 || !reTakes(data)) return own;
  highp ivec2 c = clamp(ivec2(floor(p)), ivec2(0), ivec2(127));
  vec2 fr = p - vec2(c);
  highp ivec2 sg = ivec2(fr.x < 0.5 ? -1 : 1, fr.y < 0.5 ? -1 : 1);
  highp ivec2 cb = c + ivec2(sg.x, 0), cc = c + ivec2(0, sg.y), cd = c + sg;
  highp uint db = reCell(cb), dc = reCell(cc), dd = reCell(cd);
  bool ra = reRoad(data), rb = reRoad(db), rc = reRoad(dc), rd = reRoad(dd);
  if (ra == rb && ra == rc && ra == rd) return own;
  // the dual square about the nearest tile corner k: s runs 0..1 from the cells' centres west and south of it
  vec2 k = floor(p + 0.5);
  vec2 s = p - (k - 0.5);
  float wxa = float(c.x) == k.x ? s.x : 1.0 - s.x, wxb = float(cb.x) == k.x ? s.x : 1.0 - s.x;
  float wya = float(c.y) == k.y ? s.y : 1.0 - s.y, wyc = float(cc.y) == k.y ? s.y : 1.0 - s.y;
  float lin = (ra ? wxa * wya : 0.0) + (rb ? wxb * wya : 0.0) + (rc ? wxa * wyc : 0.0) + (rd ? wxb * wyc : 0.0);
  float rho = smoothstep(${f(0.5 - s)}, ${f(0.5 + s)}, lin + reWander(p));
  float mine = ra ? rho : 1.0 - rho;
  if (mine >= 1.0) return own;
  float u = min(fr.x, 1.0 - fr.x), v = min(fr.y, 1.0 - fr.y);
  float gb = (rb != ra && reTakes(db)) ? reNear(u) : 0.0;
  float gc = (rc != ra && reTakes(dc)) ? reNear(v) : 0.0;
  float gd = (rd != ra && reTakes(dd)) ? reNear(sqrt(u * u + v * v)) : 0.0;
  float gs = gb + gc + gd;
  if (gs <= 0.0) return own;
  // the coordinate's own gradient, back from the fragment's turn (ROT is orthonormal)
  vec2 dux = transpose(ROT[t]) * gx, duy = transpose(ROT[t]) * gy;
  vec3 o = vec3(0.0);
  if (gb > 0.0) o += gb * reTexel(db, cb, p, dux, duy);
  if (gc > 0.0) o += gc * reTexel(dc, cc, p, dux, duy);
  if (gd > 0.0) o += gd * reTexel(dd, cd, p, dux, duy);
  return mix(o / gs, own, mine);
}
`;
}
