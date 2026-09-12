// THE RETRO PIXEL - the port's own "painted sky" grid, shared by every
// sky pass.
//
// PS2 (2026-09-12) moved ES1e's two functions out of the dome's shader
// so the dome, the volumetric clouds' composite and Dynamic Skies'
// skybox could all pixelate on ONE grid (uRetroStep, uRetroLevels; 0/0
// is each pass exactly as it was).
//
// ES1g (2026-09-12, Mac: "the returning pixelated sky look exposes the
// frame of a square skybox"). IT DID, and the frame was real. ES1f cast
// the grid on an equi-angular CUBE to escape the lat-long pole, and a
// cube has twelve edges. The geometry tiled across them continuously -
// measured: snapped elevations run 44.5605, 44.7363, 44.9121 | 45.0879,
// 45.2637, 45.4395 with the boundary exactly at 45 - but NOTHING ELSE
// did. A face's cell numbering is its own: approaching the +Y/+Z edge
// from above, the Bayer phase ran 3,0,1 and leaving it below it ran
// 3,2,1 - the cell index counts UP to the edge on one face and DOWN
// from it on the other, so the ordered dither MIRRORS there, and
// `face * 977.0` shifted its phase again on top. Rendered as a map, the
// break is unmistakable: above 45 degrees every row of the dither
// pattern shears (the top face's axes are x and z, so azimuth runs
// diagonally across it); below 45 degrees every row is identical (a
// side face's axes are azimuth and elevation). That hard line at 45
// degrees, four of them meeting at the corners, IS the square frame.
// A cube cannot not have it: adjacent faces' axes differ by 90 degrees,
// so the pixel rows change direction at every edge whatever you index.
//
// SO THE GRID IS RINGS NOW, and the pole ES1f fled is handled without
// faces. Rows of constant elevation, one `step` tall; each ring's
// azimuth count chosen as round(2*PI*cos(el)/step) so every cell is one
// step WIDE as well - the count falls as the rings shorten, which is
// exactly what the lat-long grid failed to do (it kept 2*PI/step cells
// on every ring, so they became slivers and pinwheeled at the zenith).
// Measured over the whole sphere: cell width 0.3506..0.3533 degrees
// against a height of 0.3516, the largest jump between neighbouring
// directions is 0.4966 degrees where one cell's diagonal is 0.4972 -
// i.e. quantization, and NO seam anywhere, through both poles and
// across the azimuth wrap. The cells stay SQUARE all the way up, too -
// even the top ring, which holds three of them, is 1.047 wide for one
// tall. What it costs is the last couple of degrees around the zenith
// and the nadir, where consecutive rings hold very different counts (3,
// 9, 16, 22, 28 coming down) so the rows no longer line up and the grid
// reads there as a rosette rather than a checkerboard. The old cube
// spent a hard edge across the whole sky to buy that.
//
// And this is the painted sky's own shape. SKY??.DAT is a PANORAMA
// strip - horizontal rows of pixels wrapped around the horizon - so
// rows of constant elevation are what the artwork was drawn on.
//
// THE PIXEL IS ITS TRUE SIZE AGAIN. ES1f passed n = (PI/2)/step as
// "cells per face", but the face's coordinate spans [-1,1], so
// floor(uv * n) cut 2n cells across it: 512 a face, 1024 across 180
// degrees, against SKY??.DAT's 512 - every retro pixel was HALF the
// width it is documented to be, and the pin guarded n rather than the
// angle it produced. The ring grid takes `step` itself and a cell is
// one `step`, so the law and the code are the same number now.
//
// Every caller writes the same two lines after its view direction and
// before its output - kept as text here so a shader cannot drift from
// its siblings, and pinned by test/macfive.test.js.

/** ringSnap(dir, step, cellOut) and bayer4(p). */
export const RETRO_GLSL = `
// The sky's pixel: rings of constant elevation, each one \`step\` tall,
// each holding as many cells as fit at one \`step\` wide. No faces, so no
// edge; the ring count falls toward the pole, so no pinwheel either.
// cellOut is CONTINUOUS (AUDIT 39 F53's law): floor() is the cell's id
// and fract() is where the fragment sits inside it, which is what the
// dither indexes and what a per-cell feature would place against.
vec3 ringSnap(vec3 dir, float step, out vec2 cellOut) {
  float el = asin(clamp(dir.y, -1.0, 1.0));
  // The last ring is clamped: a fragment at exactly the zenith would
  // otherwise index one ring past the top and rebuild with a NEGATIVE
  // cosine, mirroring itself through the pole.
  float ring = min(floor((el + 1.57079633) / step), floor(3.14159265 / step) - 1.0);
  float elC = (ring + 0.5) * step - 1.57079633;
  float ce = cos(elC);
  float m = max(1.0, floor(6.28318531 * ce / step + 0.5));   // floor(x+0.5), not round(): a tie must land the same way on every GPU
  float az = atan(dir.x, dir.z);
  az -= 6.28318531 * floor(az / 6.28318531);                 // [0, 2PI) - and the wrap is a cell boundary, not a seam
  float g = az * m / 6.28318531;
  float azC = (floor(g) + 0.5) * 6.28318531 / m;
  cellOut = vec2(g, (el + 1.57079633) / step);
  return vec3(sin(azC) * ce, sin(elC), cos(azC) * ce);       // already unit: ce is cos(elC)
}

// Bayer 4x4, the ordered dither a 256-colour gradient used.
float bayer4(vec2 p) {
  int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0));
  int i = y * 4 + x;
  float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return m[i] / 16.0;
}
`;

/** The snap, after \`dir\` is built: uniform uRetroStep (radians per pixel, 0 = smooth). */
export const RETRO_SNAP_GLSL = `  vec2 cell = vec2(0.0);
  if (uRetroStep > 0.0) dir = ringSnap(dir, uRetroStep, cell);
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
