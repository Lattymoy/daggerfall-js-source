// @ts-check
// PEAKS1 (2026-10-26, the owner: "... snow capped ..."; bible/03-World/Peaks.md) - THE BARE FACE, in both terrain programs
// (renderer.js TERRAIN_FS and the lane's EL_TERRAIN_FS), right after the snow's cover (render/snowCoverGlsl.js). The law is
// world/peaks/snowcap.js: the cap's snow is in the frame's snowlines already (scenes/snowCoverHost.js merges it into each
// lattice point's lines), and its own line rides their alpha; here a steep face near and over that line sheds the snow to
// BARE ROCK - its tile's own ground set's stone record (DFU's base record 3, terrainTiles.js createLookupTable's last
// range: every climate's set has one) - so a summit's cliffs stand grey between white ledges. SNOW-FACE (FIELD BUGS
// 2026-10-21) stands under it: a face under the cap's line keeps the weather's snow, and no face sheds to its summer
// grass - over the line it sheds to rock. Off the snow lane (uSnowSet.y 0: the classic skin, the interiors) the chunk is
// one uniform test and the ground is what it was. A LEAF OF NO IMPORTS (test/render/boot2.test.js: the renderer builds its
// programs from it as it loads) - the law's own module reads its face's dials from here.

/** THE FACE'S DIALS (world/peaks/snowcap.js SNOWCAP.face - their one home is here, the leaf both read): a steep face sheds
 *  the cap to bare rock - its normal's y from `held` (snow holds) down to `bare` (rock), from `from` metres under the cap's
 *  line (none) to `full` under it (all). */
export const CAP_FACE = Object.freeze({ bare: 0.62, held: 0.8, from: 500, full: 150 });

/** DFU's stone record in every ground set (terrainTiles.js createLookupTable: addLookupRange(table, 3, 3, ...) - the
 *  base record of the stone ring). */
export const STONE_RECORD = 3;

const f = (v) => (Number.isInteger(v) ? `${v}.0` : `${v}`);

/**
 * The face's chunk, for a terrain program whose texels decode through `decode` (the lane's elDecode; '' the classic
 * program's) - after snowCoverGlsl (its uSnowLines, uSnowSet, uSnowWin, uEcoOrigin and uTileArr): `float snowFace(inout
 * vec3 tex, float c, vec2 local, float y, vec3 n, vec2 tuv, vec2 gx, vec2 gy)` - the ground's texel `tex` turned toward
 * its set's stone by the face's share, and the cover `c` answered less it. `tileM` the world tile the lines' lattice is
 * read in (render/snowCoverGlsl.js SNOW_TILE_M - the caller's, so this stays a leaf).
 * @param {string} decode
 * @param {number} tileM
 */
export function snowCapGlsl(decode, tileM) {
  const F = CAP_FACE;
  return `// PEAKS1 (render/snowCapGlsl.js; the law is world/peaks/snowcap.js)
float snowCapAt(highp ivec2 p) {
  highp int s = uSnowWin.z - 1;
  return texelFetch(uSnowLines, clamp(p, ivec2(0), ivec2(s)), 0).a;
}
// the cap's line at a pixel-local point: the lattice's bilinear, snowLine's own
float snowCapLine(vec2 local) {
  vec2 rel = vec2(uEcoOrigin.xy - uSnowWin.xy) + local / ${f(tileM)};
  vec2 q = vec2(rel.x, -rel.y) / uSnowSet.z;
  vec2 fl = floor(q);
  highp ivec2 i = ivec2(fl);
  vec2 u = q - fl;
  return mix(mix(snowCapAt(i), snowCapAt(i + ivec2(1, 0)), u.x), mix(snowCapAt(i + ivec2(0, 1)), snowCapAt(i + ivec2(1, 1)), u.x), u.y);
}
// snowcap.js faceRock: steep (the normal's y under held, all of it at bare) and near or over the cap's line
float snowFaceRock(vec2 local, float y, vec3 n) {
  if (uSnowSet.y < 0.5) return 0.0;
  if (n.y >= ${f(F.held)}) return 0.0;   // a ledge holds it - the line unread (its four fetches spared on most ground)
  float line = snowCapLine(local);
  return (1.0 - smoothstep(${f(F.bare)}, ${f(F.held)}, n.y)) * smoothstep(line - ${f(F.from)}, line - ${f(F.full)}, y + uSnowSet.x);
}
float snowFace(inout vec3 tex, float c, vec2 local, float y, vec3 n, vec2 tuv, vec2 gx, vec2 gy) {
  float r = snowFaceRock(local, y, n);
  if (r <= 0.0) return c;
  tex = mix(tex, ${decode}(textureGrad(uTileArr, vec3(tuv, ${f(STONE_RECORD)}), gx, gy).rgb), r);
  return c * (1.0 - r);
}
`;
}
