// @ts-check
// COAST-LOOK (2026-10-28, the owner: "Coastlines arent texture blended properly. They have hard edges" - "Both edges"):
// world/terrain/groundEdge.js's GLSL twin, term for term (its table, its dials, ROAD-LOOK's lattice noise), for both
// terrain programs, the water's sheet and the silt; test/render/coastlook.test.js runs it through test/glsl.mjs against
// the JS. `uGroundEdge` is the switch (renderer.js `coastEdges`): 0 draws every tile as DFU does.
import { GROUND_EDGE, COAST_CUT, COAST_CUT_WANDER, GROUND_KIND, packGroundKinds } from '../world/terrain/groundEdge.js';
import { CLIP_SENTINEL } from '../world/terrain/terrainSurface.js';
import { pageParam } from '../systems/pageQuery.js'; // the kill door
import { isEnhanced } from '../systems/uiSkin.js'; // the skin

/** The enhanced skin's, `?coastedges=off` the kill door; the classic skin keeps DFU's tiles and the mod's whole-tile cut.
 *  No Features row: a picture alone, as ROAD-LOOK's. @param {string} [search] */
export function coastEdgesOn(search) {
  return pageParam('coastedges', search) !== 'off' && isEnhanced(search);
}

const f = (v) => (Number.isInteger(v) ? `${v}.0` : `${v}`);

/** `uGroundEdge` and `float geWander(vec2 p)` at a pixel-local point, 0 with the switch off - after EDGE_NOISE_GLSL. */
export function groundWanderGlsl() {
  return `// COAST-LOOK's wander (render/groundEdgeGlsl.js; the law is world/terrain/groundEdge.js)
uniform float uGroundEdge;   // 0: every tile its own, as DFU draws it
float geWander(vec2 p) {
  if (uGroundEdge <= 0.0) return 0.0;
  p = max(p, vec2(0.0));   // the lattice's index is never negative
  return ${GROUND_EDGE.wander.map((o, k) => `${f(o.amp)} * (2.0 * reNoise(p, ${o.cells}, ${GROUND_EDGE.salt + k}u) - 1.0)`).join(' + ')};
}`;
}

/** `GE_KINDS` (the table packed) and `uint geEntry(uint d)`, 0 for no transition. The sheet reads it too: its shore
 *  wanders where the ground blends and nowhere else (a record whose art reads as water keeps the art's line). */
export function groundKindsGlsl() {
  return `const highp uint GE_KINDS[128] = uint[128](${[...packGroundKinds()].map((w) => `${w}u`).join(', ')});
highp uint geEntry(highp uint d) { return (GE_KINDS[int(d >> 1u)] >> ((d & 1u) * 16u)) & 65535u; }`;
}

/** The ground's read of its water's smoothed fields (world/water/waterLevel.js shoreMap; renderer.js
 *  drawTerrain binds them) - `shoreWet(p)` at a tile coordinate, 1 wet, 0 dry: the silt's line and a shore's kinds';
 *  `shoreOpen(p)` the clip's smoothed share, the coast's cut. */
export function shoreGlsl() {
  return `uniform sampler2D uShore;
uniform int uShoreOn;       // 1 where this ground's water has its fields
float shoreWet(vec2 p) { return 1.0 - textureLod(uShore, (2.0 * p + 0.5) / vec2(textureSize(uShore, 0)), 0.0).g; }
float shoreOpen(vec2 p) { return textureLod(uShore, (2.0 * p + 0.5) / vec2(textureSize(uShore, 0)), 0.0).b; }`;
}

/** The terrain programs' chunk, after ROAD-LOOK's (its noise, `reCell`, the program's ROT and TRANS), `decode` the lane's
 *  elDecode: the wander and the table, `groundMix` (a transition's two kinds and the second's share), `geBase` (a kind's
 *  base record, unturned, at the coordinate's own gradient) and `coastCut` (the clip variant's: true where the fragment is
 *  cut, else a kept point of a clipped tile handed the nearest kept tile's byte, mirrored).
 *  @param {string} decode */
export function groundEdgeGlsl(decode = '') {
  const s = GROUND_EDGE.soft;
  return `${groundWanderGlsl()}
${groundKindsGlsl()}
${shoreGlsl()}
bool groundMix(highp uint d, vec2 f, vec2 p, out highp uint a, out highp uint b, out float s) {
  a = 0u; b = 0u; s = 0.0;
  if (uGroundEdge <= 0.0) return false;
  highp uint e = geEntry(d);
  if (e == 0u) return false;
  a = (e >> 1u) & 3u; b = (e >> 3u) & 3u;
  highp uint m = (e >> 5u) & 15u;
  float c = uShoreOn == 1 && a == ${GROUND_KIND.water}u ? 1.0 - shoreWet(p)   // a shore's land on its water's line
    : mix(mix(float(m & 1u), float((m >> 1u) & 1u), f.x), mix(float((m >> 2u) & 1u), float((m >> 3u) & 1u), f.x), f.y);
  s = smoothstep(${f(0.5 - s)}, ${f(0.5 + s)}, c + geWander(p));
  return true;
}
vec3 geBase(highp uint k, vec2 f, vec2 dux, vec2 duy) { return ${decode}(textureGrad(uTileArr, vec3(f, float(k)), dux, duy).rgb); }
bool coastCut(vec2 p, inout uint data, inout int layer, inout int t, inout vec2 tileUV, inout vec2 tuv, inout vec2 gx, inout vec2 gy) {
  if (data != ${CLIP_SENTINEL}u) return false;   // a cell the mod kept is never cut
  highp ivec2 c = clamp(ivec2(floor(p)), ivec2(0), ivec2(127));
  vec2 fr = p - vec2(c);
  highp ivec2 sg = ivec2(fr.x < 0.5 ? -1 : 1, fr.y < 0.5 ? -1 : 1);
  highp ivec2 cb = c + ivec2(sg.x, 0), cc = c + ivec2(0, sg.y), cd = c + sg;
  highp uint db = reCell(cb), dc = reCell(cc), dd = reCell(cd);
  bool kb = db == ${CLIP_SENTINEL}u, kc = dc == ${CLIP_SENTINEL}u, kd = dd == ${CLIP_SENTINEL}u;
  bool byShare = uShoreOn == 1;   // with the water's fields the line is the clip's smoothed share's
  if (byShare && shoreOpen(p) + ${f(COAST_CUT_WANDER)} * geWander(p) > ${f(COAST_CUT.share)}) return true;
  if (!byShare && kb && kc && kd) return true;
  // the dual square about the nearest tile corner k: s runs 0..1 from the cells' centres west and south of it
  vec2 k = floor(p + 0.5);
  vec2 q = p - (k - 0.5);
  float wxa = float(c.x) == k.x ? q.x : 1.0 - q.x, wxb = float(cb.x) == k.x ? q.x : 1.0 - q.x;
  float wya = float(c.y) == k.y ? q.y : 1.0 - q.y, wyc = float(cc.y) == k.y ? q.y : 1.0 - q.y;
  float lin = wxa * wya + (kb ? wxb * wya : 0.0) + (kc ? wxa * wyc : 0.0) + (kd ? wxb * wyc : 0.0);
  if (!byShare && lin + ${f(COAST_CUT_WANDER)} * geWander(p) > ${f(COAST_CUT.line)}) return true;
  // kept: the nearest kept cell across this corner - its x or y neighbour (the nearer edge first), else the diagonal
  float u = min(fr.x, 1.0 - fr.x), v = min(fr.y, 1.0 - fr.y);
  highp ivec2 n = cd; highp uint dn = dd;
  if (u <= v) { if (!kb) { n = cb; dn = db; } else if (!kc) { n = cc; dn = dc; } }
  else { if (!kc) { n = cc; dn = dc; } else if (!kb) { n = cb; dn = db; } }
  bool far = kb && kc && kd;   // all three clipped (only the share's line keeps one): the nearest kept cell two out
  if (far) {
    float best = 1e9;
    for (int dy = -2; dy <= 2; dy++) for (int dx = -2; dx <= 2; dx++) {
      if (max(abs(dx), abs(dy)) < 2) continue;
      highp ivec2 m = c + ivec2(dx, dy);
      highp uint dm = reCell(m);
      float away = length(p - vec2(m) - 0.5);
      if (dm != ${CLIP_SENTINEL}u && away < best) { best = away; n = m; dn = dm; }
    }
    if (dn == ${CLIP_SENTINEL}u) return true;
  }
  // the coordinate's own gradient, back from the cut byte's turn (ROT is orthonormal), turned by the kept cell's
  vec2 dux = transpose(ROT[t]) * gx, duy = transpose(ROT[t]) * gy;
  data = dn; layer = int(dn >> 2u); t = int(dn & 3u);
  vec2 l = p - vec2(n);
  l = vec2(l.x < 0.0 ? -l.x : (l.x > 1.0 ? 2.0 - l.x : l.x), l.y < 0.0 ? -l.y : (l.y > 1.0 ? 2.0 - l.y : l.y));
  if (far) l = fract(p);
  tileUV = l; tuv = ROT[t] * l + TRANS[t]; gx = ROT[t] * dux; gy = ROT[t] * duy;
  return false;
}
`;
}
