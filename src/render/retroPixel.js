// PS2 - THE PIXEL ON EVERY SKY (2026-09-12, Mac: "Volumetric clouds and
// pixelated should be compatible with dynamic skies though"). ES1e's
// retro pass - the angular pixel on an equi-angular cube (cubeSnap) and
// the ordered Bayer posterise (bayer4) - lived inside the dome's own
// fragment shader, so the Pixelated sky switch (PS1) reached the port's
// dome and nothing else: the volumetric clouds composited smooth over a
// pixelated dome, and Dynamic Skies' skybox never saw it. The two
// functions are ONE GLSL string now, moved out of the dome verbatim,
// and three shaders carry it - the dome (render/enhancedSky.js), the
// clouds' composite (render/volumetricClouds.js) and the mod's skybox
// (render/dynamicSkiesRenderer.js) - each with the same two uniforms
// (uRetroStep, uRetroLevels; 0 = the pass as it was) set from the one
// `retro` the host decides (retroFor). The same cell grid on every
// pass, so the clouds' pixels are the sky's pixels.
//
// Every caller writes the same two lines after its view direction and
// before its output - kept as text here so a shader cannot drift from
// its siblings, and pinned by test/macfive.test.js PS2.

/** cubeSnap(dir, n, cellOut) and bayer4(p). */
export const RETRO_GLSL = `
vec3 cubeSnap(vec3 dir, float n, out vec2 cellOut) {
  vec3 a = abs(dir);
  float m = max(a.x, max(a.y, a.z));
  vec2 raw; float face;
  if (a.x >= m) { raw = dir.zy / a.x; face = dir.x > 0.0 ? 0.0 : 1.0; }
  else if (a.y >= m) { raw = dir.xz / a.y; face = dir.y > 0.0 ? 2.0 : 3.0; }
  else { raw = dir.xy / a.z; face = dir.z > 0.0 ? 4.0 : 5.0; }
  // EQUI-ANGULAR faces (ES1f, second pass). A plain cube face is a
  // TANGENT plane, so its cells cover 2.6x less sky at the corners than
  // at the centre - and a cell size that varies across the frame beats
  // against the screen's own grid and draws curved moire rings, which
  // is the pole artifact's ghost rather than its cure. Warping the face
  // by atan (the equi-angular cubemap of 360 video) makes every cell
  // the SAME ANGLE everywhere, so the grid reads as an even bitmap in
  // every direction. A face spans 90 degrees, so n = (PI/2)/step gives
  // the painted sky's pixel: 256 a face, 512 across 180 degrees, which
  // is SKY??.DAT's own width.
  vec2 uv = atan(raw) * 1.27323954;                 // 4/PI: [-1,1] over the face
  vec2 cell = floor(uv * n);
  vec2 t = tan((cell + 0.5) / n * 0.78539816);      // PI/4: back to the tangent plane
  // AUDIT 39 F53: cellOut is CONTINUOUS - the cell id is floor(cellOut),
  // and its fraction is where the fragment sits INSIDE the cell, which
  // is what the star field draws a star at. Handing back the floored id
  // made fract() of it exactly zero, so the bright first star layer
  // could not produce a lit pixel anywhere on the sphere. Callers floor
  // it for the id; the face offset is integral, so flooring here or
  // there names the same cell.
  cellOut = uv * n + face * 977.0;                  // a face's cells are its own
  if (a.x >= m) return normalize(vec3(sign(dir.x), t.y, t.x));
  if (a.y >= m) return normalize(vec3(t.x, sign(dir.y), t.y));
  return normalize(vec3(t.x, t.y, sign(dir.z)));
}

// Bayer 4x4, the ordered dither a 256-colour gradient used.
float bayer4(vec2 p) {
  int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0));
  int i = y * 4 + x;
  float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return m[i] / 16.0;
}
`;

/** The snap, after \`dir\` is built: uniforms uRetroStep (radians per pixel, 0 = smooth). */
export const RETRO_SNAP_GLSL = `  vec2 cell = vec2(0.0);
  if (uRetroStep > 0.0) dir = cubeSnap(dir, 1.57079633 / uRetroStep, cell);
  cell = floor(cell);                               // F53: bayer4 indexes the CELL, not its interior`;

/** The posterise, on the value named, before the output: uRetroLevels (0 = none). */
export const retroPosteriseGlsl = (v) => `  if (uRetroLevels > 0.0) {
    float b = bayer4(uRetroStep > 0.0 ? cell : gl_FragCoord.xy) - 0.5;
    ${v} = floor(${v} * uRetroLevels + 0.5 + b) / uRetroLevels;
  }`;

/** The two uniforms every retro-capable pass declares, in this order. */
export const RETRO_UNIFORMS = Object.freeze(['uRetroStep', 'uRetroLevels']);
export const RETRO_UNIFORM_GLSL = `uniform float uRetroStep;   // 0 = the smooth pass; else the angular pixel (radians)
uniform float uRetroLevels; // 0 = no posterise`;

/** Upload one pass's retro state. */
export function setRetroUniforms(gl, u, retro) {
  gl.uniform1f(u.uRetroStep, retro ? retro.step : 0);
  gl.uniform1f(u.uRetroLevels, retro ? retro.levels : 0);
}
