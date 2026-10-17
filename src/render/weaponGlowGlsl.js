// @ts-check
// WEAPON-GLOW1 (2026-10-16; bible/05-Combat/Weapon-Glow.md): THE GLOW'S DRAWING - one design, two drawers. A leaf: the
// shaders' source and the numbers they are drawn by, no import (render/renderer.js builds the programs and issues the
// draws; systems/weaponGlow.js decides what a weapon shows).
//
// THE DESIGN. An element's glow is an OUTLINE that lives: a band round the weapon's silhouette, hottest at the edge and
// cooling outward in four steps of the element's ramp (systems/weaponGlow.js GLOW_RAMPS - Daggerfall's own way with
// light, a few palette shades and never a smooth blend), its REACH - how far the band stands off the edge - moving:
//   - FIRE: tongues that climb. The reach is two octaves of value noise scrolled up the screen, stretched upward and
//     cut short below (a flame rises), and an ember now and then drifts up off the top.
//   - FROST: a rime that breathes. A square reach (the Chebyshev metric - ice is angular), still spikes where a cell's
//     hash says so, a slow pulse, and a glint that flashes white on a crystal for a fifth of a second.
//   - SHOCK: an edge that crackles. A diamond reach (Manhattan - jagged), a band that flickers in 2x2 blocks at
//     twelve steps a second, arcs thrown out where a stepped noise peaks, and a surge a few times a second.
//   - ARCANE (the Morrowind hand's enchanted look - systems/weaponGlow.js law 5): an even halo that turns slowly.
// Inside the silhouette the weapon's own edge takes the element's light (the RIM), so the outline reads as the
// weapon's and not a sticker behind it.
//
// THE TWO DRAWERS.
//   - THE CLASSIC SPRITE (Renderer.drawScreenQuadGlow): one quad over the frame's own rect, grown by the search window,
//     that reads the frame's FIELD - each Daggerfall pixel's distance to the nearest opaque one in the look's metric,
//     measured once a frame and look into a small picture (GLOW_FIELD_FS; AUDIT WEAPON-GLOW SPR-1) - and moves the band
//     over it. Evaluated per Daggerfall pixel of the frame, so the outline is drawn in the sprite's own pixels.
//   - THE MORROWIND MESH (Renderer._drawWeaponGlow, inside drawCharacter's sprite pass): the weapon's ranges drawn
//     again, SHIFTED in screen space round GLOW_DIRS directions at each of GLOW_RINGS distances - the union of a ring's
//     copies is the silhouette dilated by its distance, so the ring's fragment knows its band without searching - at
//     the BACK of the pass and before the body, so the real weapon and everything else the pass draws cover them, an
//     inner ring nearer than an outer so it paints over it. Opaque, because the arm's composite cuts at half alpha
//     (drawScreenOverlayQuad). Then, after the body, the CHARGE: the weapon's own surface again, additive, lit at its
//     rim and patterned by its element - the detail a model can carry that a 2D frame cannot. The ring's `c` is the fragment's place in glow UNITS (a Daggerfall pixel at
//     the pass's height, GLOW_UNIT_ROWS), so a flame on a model is a flame the size of one on a sprite.
//
// THE CLOCK. Every rate is whole over GLOW_CLOCK_PERIOD (the renderer wraps its seconds there): the scrolls' noise is
// periodic in y over exactly the cells a period scrolls (gwNoise's `py`), the pulses' periods divide it, and the stepped
// hashes start their count again - so the wrap is a frame like any other, never a jump in a flame.

/** The seconds the glow's clock wraps at - every rate below is whole over it. */
export const GLOW_CLOCK_PERIOD = 240;
/** A glow unit is a Daggerfall pixel: the pass's height over Daggerfall's 200 rows - in first person the LENS's rows
 *  (combat/fpArm.js lays it on the mesh, `glowUnit`, so a Weapon Widget scale grows the outline with the arm), a
 *  third-person picture's own rows otherwise. Never under GLOW_UNIT_MIN of a texel (a far body's outline is a thin one,
 *  never none) nor over GLOW_UNIT_MAX. */
export const GLOW_UNIT_ROWS = 200;
export const GLOW_UNIT_MIN = 0.5;
export const GLOW_UNIT_MAX = 8;
export const glowUnit = (rows) => Math.min(GLOW_UNIT_MAX, Math.max(GLOW_UNIT_MIN, rows / GLOW_UNIT_ROWS));
/** The Morrowind outline's bands, in glow units from the edge - drawn outermost first. */
export const GLOW_RINGS = Object.freeze([4.75, 3.25, 2, 1]);
/** The directions a ring's copies are shifted round. */
export const GLOW_DIRS = 12;
/** Fire's reach is stretched upward and cut short below: the up and down factors on a shift's y (the sprite's metric
 *  is the same pair, inverted - gwMetric). */
export const GLOW_FIRE_UP = 1.8;
export const GLOW_FIRE_DOWN = 0.6;
/** The embers' shifts over a fire weapon (glow units, three heights, each straight up and a hair to either side). */
export const GLOW_EMBER_RISE = Object.freeze([6, 7.5, 9]);
/** How far a look's outline stands off the weapon at most, in glow units: the outer ring, fire's stretched up and its
 *  embers over it. */
export const glowReach = (look) => (look === 'fire' ? Math.max(GLOW_RINGS[0] * GLOW_FIRE_UP, ...GLOW_EMBER_RISE) : GLOW_RINGS[0]);
/** AUDIT WEAPON-GLOW MW-3: THE ROOM A THIRD-PERSON PICTURE NEEDS FOR ITS OUTLINE, in texels a side (render/
 *  characterSprite.js drawRigSpriteBox pads the window by it, as it pads for a foe's tells - bodyFxPad): the reach in
 *  glow units at the unit the PADDED picture will draw at, and a texel over. `rows` the picture's rows before the pad.
 *  The drawn weapon is often the box's edge - a blade held high is its top - so without it the outline was cut flat. */
export function glowPad(look, rows) {
  const reach = glowReach(look);
  let pad = 0;
  for (let i = 0; i < 4; i++) pad = Math.ceil(reach * glowUnit(rows + 2 * pad)) + 1;
  return pad;
}
/** WHERE A RING STANDS IN DEPTH: at the back of the pass, NDC z `GLOW_RING_FAR + ring x GLOW_RING_STEP` - an outer ring
 *  farther than an inner one, so the inner paints over it, and every ring behind anything the pass draws after it. The
 *  rings are drawn BEFORE the body: a shifted copy of a tilted blade can stand nearer than the blade's own surface at
 *  a pixel, and drawn after it the rings painted over the weapon they outline (the probe saw it, tools/
 *  weaponGlowProbe.mjs). An ember stands at the front of the rings. AUDIT WEAPON-GLOW MW-2: the sprite target's depth is
 *  DEPTH_COMPONENT16, a step of 1/65535 in window depth - the rings were 1e-5 apart there, and the two inner ones fell on
 *  one value, so the hottest band never drew; GLOW_RING_STEP keeps every neighbour at least GLOW_DEPTH_STEPS steps apart
 *  (test/systems/weaponglow1.test.js). The pass's own geometry stands nearer than GLOW_RING_FAR everywhere it draws (the
 *  first-person arm's far plane is four reaches, and the arm reaches 0.999 only past 2.8 of them; a third-person
 *  picture's ortho holds its box well inside). The charge's pull is toward the eye, a hair - its vertex shader is
 *  another program's arithmetic, and LEQUAL alone would lose a texel where the two round apart. */
export const GLOW_RING_FAR = 0.999;
export const GLOW_RING_STEP = 1e-4;
export const GLOW_DEPTH_STEPS = 2;
export const GLOW_CHARGE_PULL = -1e-5;
/** AUDIT WEAPON-GLOW MW-1: the window depth at and past which a texel of a picture is a ring's (or an ember's), never
 *  the body's - two D16 steps under the nearest of them. render/renderer.js's body quad gives such a texel the quad's
 *  own depth (BODY-DEPTH would have stood it where its depth says: a reach behind the body, under a wall's or a floor's). */
export const GLOW_DEPTH_FLOOR = (GLOW_RING_FAR + 1) / 2 - GLOW_DEPTH_STEPS / 65535;
/** The most draws glowRingDraws answers - the instanced pass's uniform array (fire: 48 rings and 9 embers). */
export const GLOW_DRAWS_MAX = 64;
/** THE MOST A LOOK'S BAND REACHES, in glow cells (a Daggerfall pixel - the frame's own on a classic sprite): gwReach at
 *  level 3 with its noise at the top - fire (1.2 + 3)(0.5 + 1.25), frost 0.8 + 2.4 + 2.4 + 0.5, shock 1.6 + 0.9 + 6.5 +
 *  1, arcane (its one level, 2) 1.6 + 1.2. The sprite clamps its reach here (`uReachMax`), and its window below holds
 *  every cell within it, so no band is ever cut short by the window's box (AUDIT WEAPON-GLOW SPR-2: the window was a
 *  guess, and shock's band reached past it in every frame at level 3). */
export const GLOW_REACH_MAX = Object.freeze({ fire: 7.35, frost: 6.1, shock: 10, arcane: 2.8 });
/** How far past its band a fire ember may rise off the weapon (GLOW_SPRITE_FS - an ember stands only over a solid). */
export const GLOW_EMBER_SLACK = 3;
/** The farthest a look's field measures, in glow cells: its reach, and fire's embers past it. */
export const glowFieldReach = (look) => GLOW_REACH_MAX[/** @type {keyof typeof GLOW_REACH_MAX} */ (look)] + (look === 'fire' ? GLOW_EMBER_SLACK : 0);
/** The sprite's search window per look, in glow cells: [half-width, rows above the cell, rows below it] - every cell
 *  within glowFieldReach in the look's metric (gwMetric), and no more. Fire's flame stands over its weapon, so it looks
 *  far DOWN (its metric shrinks a rise by GLOW_FIRE_UP) and a little way up (a fall grows by 1/GLOW_FIRE_DOWN), and only
 *  its band looks up - an ember rises off a solid below it. */
export const GLOW_SPRITE_WINDOW = Object.freeze(Object.fromEntries(['fire', 'frost', 'shock', 'arcane'].map((look) => {
  const r = GLOW_REACH_MAX[/** @type {keyof typeof GLOW_REACH_MAX} */ (look)], e = glowFieldReach(look);
  return [look, Object.freeze(look === 'fire' ? [Math.floor(e), Math.floor(r * GLOW_FIRE_DOWN), Math.floor(e * GLOW_FIRE_UP)] : [Math.floor(e), Math.floor(e), Math.floor(e)])];
})));
/** AUDIT WEAPON-GLOW SPR-1: the most frames' fields the renderer keeps (render/renderer.js drawScreenQuadGlow) - a
 *  weapon's sheet is seven records of a few frames each, so two weapons' worth and the Thunderlock's; the least
 *  recently drawn goes first. */
export const GLOW_FIELDS_MAX = 128;

/** The shared half: hash, periodic value noise, and the four looks' reach, shade, rim and charge. `c` is a place in
 *  glow cells with y UP; `uRamp` the look's four stops, dark to hot. */
export const GLOW_LOOK_GLSL = `
uniform vec3 uRamp[4];
float gwHash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
// value noise, periodic in y over py lattice rows - a scroll of exactly py rows a clock period wraps seamlessly
float gwNoise(vec2 x, float py) {
  vec2 i = floor(x);
  vec2 f = x - i;
  vec2 u = f * f * (3.0 - 2.0 * f);
  float y0 = mod(i.y, py);
  float y1 = mod(i.y + 1.0, py);
  float a = gwHash(vec2(i.x, y0));
  float b = gwHash(vec2(i.x + 1.0, y0));
  float c = gwHash(vec2(i.x, y1));
  float d = gwHash(vec2(i.x + 1.0, y1));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// the distance a texel is from a solid one, in the look's own metric (o: from the texel to the solid, y up)
float gwMetric(int look, vec2 o) {
  if (look == 1) return length(vec2(o.x, o.y * (o.y < 0.0 ? ${(1 / GLOW_FIRE_UP).toFixed(6)} : ${(1 / GLOW_FIRE_DOWN).toFixed(6)})));
  if (look == 2) return max(abs(o.x), abs(o.y));
  if (look == 3) return abs(o.x) + abs(o.y);
  return length(o);
}
// how far the band stands off the edge here, now
float gwReach(int look, vec2 c, float t, float lv) {
  if (look == 1) {
    float n1 = gwNoise(vec2(c.x * 0.45, c.y * 0.3 - t * 2.0), 480.0);
    float n2 = gwNoise(vec2(c.x * 0.9 + 17.0, c.y * 0.6 - t * 4.0), 960.0);
    return (1.2 + 1.0 * lv) * (0.5 + n1 * (0.75 + 0.5 * n2));
  }
  if (look == 2) {
    float spike = step(0.86, gwHash(floor(c) + 31.0));
    float breath = 0.5 + 0.5 * sin(t * 2.0943951);
    return 0.8 + 0.8 * lv + spike * (0.6 + 0.6 * lv) + 0.5 * breath;
  }
  if (look == 3) {
    float s = floor(t * 12.0);
    float arc = gwNoise(floor(c * 0.5) * 0.9 + vec2(s * 3.7, s * 1.3), 4096.0);
    float surge = step(0.8, gwHash(vec2(floor(t * 3.0), 7.0)));
    return 1.6 + 0.3 * lv + smoothstep(0.55, 0.85, arc) * (2.0 + 1.5 * lv) + surge;
  }
  float w = 0.5 + 0.5 * sin(t * 1.5707963 + c.x * 0.15 + c.y * 0.1);
  return 1.6 + 0.6 * lv * (0.7 + 0.3 * w);
}
// the band's colour at h (1 at the edge, 0 at the reach) - four steps of the ramp; alpha 0 is a gap
vec4 gwShade(int look, float h, vec2 c, float t, float lv) {
  int q = int(clamp(floor(h * 4.0 - 0.5), 0.0, 3.0));
  vec3 col = uRamp[q];
  float a = 0.55 + 0.45 * h;
  if (look == 2 && gwHash(floor(c) + floor(t * 5.0) * 7.31) > 0.972) { col = uRamp[3]; a = 1.0; }
  if (look == 3 && gwHash(floor(c * 0.5) + floor(t * 12.0) * 13.0) < 0.18) return vec4(0.0);
  return vec4(col, a * (0.75 + 0.083 * lv));
}
// an ember over a flame: rising a cell a step, six steps a second
bool gwEmber(vec2 c, float t, float lv) {
  return gwHash(vec2(floor(c.x), mod(floor(c.y) - floor(t * 6.0), 1440.0))) > 0.993 - 0.002 * lv;
}
// the weapon's own edge, lit by its element: x the colour's share
vec4 gwRim(int look, vec2 c, float t, float lv) {
  float k = 0.3;
  if (look == 1) k = 0.25 + 0.35 * gwNoise(vec2(c.x * 0.6, c.y * 0.6 - t * 3.0), 720.0);
  else if (look == 2) k = 0.3 + 0.2 * (0.5 + 0.5 * sin(t * 2.0943951));
  else if (look == 3) k = gwHash(floor(c * 0.5) + floor(t * 12.0) * 5.0) > 0.5 ? 0.65 : 0.15;
  return vec4(uRamp[2], k * (0.7 + 0.1 * lv));
}
// the Morrowind charge's pattern on the surface, 0..1: fire boils up the screen, frost is facets that glint in turn,
// shock is veins that jump twelve times a second, arcane a slow swirl
float gwSurface(int look, vec2 uv, vec2 c, float t) {
  if (look == 1) return smoothstep(0.4, 0.95, gwNoise(vec2(c.x * 0.5, c.y * 0.35 - t * 2.5), 600.0));
  if (look == 2) {
    float f = gwHash(floor(uv * 24.0));
    return pow(0.5 + 0.5 * sin(t * 2.0943951 + f * 6.2831853), 6.0);
  }
  if (look == 3) {
    float s = floor(t * 12.0);
    return 1.0 - smoothstep(0.0, 0.07, abs(gwNoise(c * 0.6 + vec2(s * 5.1, s * 2.3), 4096.0) - 0.5));
  }
  float a = t * 0.2617994;
  return gwNoise(uv * 8.0 + vec2(sin(a), cos(a)) * 2.0, 4096.0);
}
`;

/** THE CLASSIC SPRITE'S QUAD: the frame's rect grown by `uPad` glow cells a side (left, top, right, bottom - none on a
 *  side the frame is cut at), its parameter `vQ` running past 0..1 into the pad; `uArt` the frame's size in cells. */
export const GLOW_SPRITE_VS = `#version 300 es
layout(location=0) in vec2 aPos;
uniform vec4 uDst;
uniform vec2 uCanvas;
uniform vec4 uPad;
uniform ivec2 uArt;
out vec2 vQ;
void main() {
  vec2 p = aPos * 0.5 + 0.5;
  vec2 art = vec2(uArt);
  vec2 q = mix(-uPad.xy / art, 1.0 + uPad.zw / art, p);
  vQ = q;
  vec2 px = uDst.xy + q * uDst.zw;
  gl_Position = vec4(px.x / uCanvas.x * 2.0 - 1.0, 1.0 - px.y / uCanvas.y * 2.0, 0.0, 1.0);
}`;

/** The field's bake covers its whole target - the screen quad's corners, as they are. */
export const GLOW_FIELD_VS = `#version 300 es
layout(location=0) in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

/** AUDIT WEAPON-GLOW SPR-1: THE FRAME'S FIELD, baked once a frame and look (render/renderer.js _glowField) - the
 *  search the outline used to run for every screen pixel of every frame (up to 234 texel reads each, 80 times the
 *  sprite's own cost) run once, a cell at a time, into a small RGBA8 picture the outline then reads once a pixel. A cell
 *  is a Daggerfall pixel of the frame (`uArt` cells over the texture's texels - SPR-4: an HD frame's or the Thunderlock's
 *  outline the size of a classic one's, never a few texels thin), solid when the texel at its middle is at half alpha.
 *  Out: r the distance to the nearest solid cell in the look's metric over `uDmax` (1 for none within), g whether that
 *  cell is below (a fire ember rises only off a solid), b the cell's own kind - 0 open, 0.5 an edge (the rim), 1 inside.
 *  SPR-3: a side the frame is CUT at (`uCut`: left, right, bottom, in the texture's own sides) is no silhouette - a cell
 *  past it reads as the edge cell beside it, so the arm leaving the screen takes no rim and throws no band. The field
 *  stands `uFieldPad` cells round the frame (left, top, right, bottom). */
export const GLOW_FIELD_FS = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uTex;
uniform ivec2 uArt;
uniform ivec4 uFieldPad;
uniform ivec3 uWin;
uniform ivec3 uCut;
uniform int uLook;
uniform float uDmax;
out vec4 outColor;
${GLOW_LOOK_GLSL}
bool gwCell(ivec2 a) {
  if (uCut.x == 1 && a.x < 0) a.x = 0;
  if (uCut.y == 1 && a.x >= uArt.x) a.x = uArt.x - 1;
  if (uCut.z == 1 && a.y >= uArt.y) a.y = uArt.y - 1;
  if (a.x < 0 || a.y < 0 || a.x >= uArt.x || a.y >= uArt.y) return false;
  vec2 k = vec2(textureSize(uTex, 0)) / vec2(uArt);
  return texelFetch(uTex, ivec2((vec2(a) + 0.5) * k), 0).a >= 0.5;
}
void main() {
  ivec2 a = ivec2(gl_FragCoord.xy) - uFieldPad.xy;
  if (gwCell(a)) {
    bool inner = gwCell(a + ivec2(1, 0)) && gwCell(a - ivec2(1, 0)) && gwCell(a + ivec2(0, 1)) && gwCell(a - ivec2(0, 1));
    outColor = vec4(1.0, 0.0, inner ? 1.0 : 0.5, 1.0);
    return;
  }
  float d = uDmax;
  bool below = false;
  for (int y = -uWin.y; y <= uWin.z; y++) {
    for (int x = -uWin.x; x <= uWin.x; x++) {
      if (!gwCell(a + ivec2(x, y))) continue;
      float m = gwMetric(uLook, vec2(float(x), -float(y)));
      if (m < d) { d = m; below = y > 0; }
    }
  }
  outColor = vec4(d / uDmax, below ? 1.0 : 0.0, 0.0, 1.0);
}`;

/** THE CLASSIC SPRITE'S OUTLINE: per Daggerfall pixel of the frame, off its field (two reads a pixel - the field's cell
 *  and the frame's own texel) - an edge cell's solid texels take the rim, an open cell its band at the distance the
 *  field says, the reach clamped where the field stops measuring (`uReachMax`). Premultiplied out (the renderer blends
 *  ONE, ONE_MINUS_SRC_ALPHA). The frame's alpha law is drawScreenQuad's: a texel is opaque at half alpha. A texel the
 *  field's cell disagrees with (an HD frame's antialiased edge, a cell finer than its texels) draws nothing: the frame
 *  shows there as it is. */
export const GLOW_SPRITE_FS = `#version 300 es
precision highp float;
precision highp int;
in vec2 vQ;
uniform sampler2D uTex;
uniform sampler2D uField;
uniform vec4 uSrc;
uniform ivec2 uArt;
uniform ivec2 uFieldAt;
uniform int uLook;
uniform float uLevel;
uniform float uTime;
uniform float uDmax;
uniform float uReachMax;
out vec4 outColor;
${GLOW_LOOK_GLSL}
void main() {
  vec2 uv = mix(uSrc.xy, uSrc.zw, vQ);
  ivec2 ts = textureSize(uTex, 0);
  ivec2 tc = ivec2(floor(uv * vec2(ts)));
  bool solid = tc.x >= 0 && tc.y >= 0 && tc.x < ts.x && tc.y < ts.y && texelFetch(uTex, tc, 0).a >= 0.5;
  ivec2 a = ivec2(floor(uv * vec2(uArt)));
  vec4 f = texelFetch(uField, clamp(a + uFieldAt, ivec2(0), textureSize(uField, 0) - 1), 0);
  vec2 c = vec2(float(a.x), -float(a.y));
  float t = uTime;
  float lv = uLevel;
  if (solid) {
    if (f.b < 0.25 || f.b > 0.75) discard;
    vec4 r = gwRim(uLook, c, t, lv);
    outColor = vec4(r.rgb * r.a, r.a * 0.5);
    return;
  }
  if (f.b > 0.25 || f.r >= 0.999) discard;
  float d = f.r * uDmax;
  float reach = min(gwReach(uLook, c, t, lv), uReachMax);
  float h = 1.0 - d / max(reach, 0.25);
  if (h <= 0.0) {
    if (uLook == 1 && f.g > 0.5 && d < reach + ${GLOW_EMBER_SLACK.toFixed(1)} && gwEmber(c, t, lv)) { outColor = vec4(uRamp[2], 1.0); return; }
    discard;
  }
  vec4 s = gwShade(uLook, h, c, t, lv);
  if (s.a <= 0.0) discard;
  outColor = vec4(s.rgb * s.a, s.a);
}`;

/** THE MORROWIND PASS'S VERTEX SHADER: the character program's skinned vertex shader (renderer.js CHAR_SKIN_VS) with
 *  the glow's after its own gl_Position - the SAME expression first, so an unshifted draw is the body's own position -
 *  and the view-space position the charge lights by. AUDIT WEAPON-GLOW MW-5: THE RINGS ARE INSTANCED - one draw a
 *  weapon range for every ring and ember (it was one draw a range a ring: fire's 57 x the ranges, each re-binding its
 *  texture), each instance its row of `uGlowDraw` (xy the shift in NDC, z the depth it stands at in NDC - 0 keeps the
 *  body's own, moved by `uGlowPull` - and w its band in glow units, -1 an ember), `uGlowInstanced` 0 for the charge's
 *  plain draw. Throws on a source without exactly one of each needle: a silent no-op here is a glow drawn nowhere
 *  (skinFaceFs' rule). */
export function glowMeshVs(charSkinVs) {
  const decl = 'out vec3 vEmissive;';
  const pos = 'gl_Position = uProj * uView * world;';
  const n = (needle) => charSkinVs.split(needle).length - 1;
  if (n(decl) !== 1 || n(pos) !== 1) {
    throw new Error(`WEAPON-GLOW1: the character vertex shader needs one "${decl}" and one "${pos}" (has ${n(decl)} and ${n(pos)})`);
  }
  return charSkinVs
    .replace(decl, `${decl}\nout vec3 vViewPos;\nflat out float vRingD;\nuniform vec4 uGlowDraw[${GLOW_DRAWS_MAX}];\nuniform int uGlowInstanced;\nuniform float uGlowPull;`)
    .replace(pos, `${pos}\n  vViewPos = (uView * world).xyz;\n  vec4 gwD = uGlowInstanced == 1 ? uGlowDraw[gl_InstanceID] : vec4(0.0);\n  gl_Position.xy += gwD.xy * gl_Position.w;\n  gl_Position.z = gwD.z > 0.0 ? gwD.z * gl_Position.w : gl_Position.z + uGlowPull * gl_Position.w;\n  vRingD = gwD.w;`);
}

/** THE MORROWIND PASS'S FRAGMENT SHADER: `uMode` 0 the rings (opaque, each fragment's band its instance's `vRingD`, -1
 *  an ember), 1 the charge (additive - the renderer masks alpha). The range's own cutout holds in both. AUDIT
 *  WEAPON-GLOW MW-7: the charge's derivatives are taken first, in uniform control flow, before any discard
 *  (skinFaceFs' rule). MW-4: a place is counted from the picture's own corner (`uGlowOrigin` - a batched body's tile
 *  moves in the target from frame to frame, and its glow moved with it). */
export const GLOW_MESH_FS = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUV;
in vec3 vViewPos;
flat in float vRingD;
uniform sampler2D uTex;
uniform float uUseTex;
uniform float uAlphaCut;
uniform int uLook;
uniform float uLevel;
uniform float uTime;
uniform float uMode;
uniform float uUnit;
uniform vec2 uGlowOrigin;
out vec4 outColor;
${GLOW_LOOK_GLSL}
void main() {
  vec3 dx = dFdx(vViewPos);
  vec3 dy = dFdy(vViewPos);
  if (uUseTex > 0.5 && uAlphaCut > 0.0 && texture(uTex, vUV).a < uAlphaCut) discard;
  vec2 c = (gl_FragCoord.xy - uGlowOrigin) / uUnit;
  float t = uTime;
  float lv = uLevel;
  if (uMode < 0.5) {
    if (vRingD < 0.0) {
      if (!gwEmber(c, t, lv)) discard;
      outColor = vec4(uRamp[2], 1.0);
      return;
    }
    float h = 1.0 - vRingD / max(gwReach(uLook, c, t, lv), 0.25);
    if (h <= 0.0) discard;
    vec4 s = gwShade(uLook, h, c, t, lv);
    if (s.a <= 0.0) discard;
    outColor = vec4(s.rgb, 1.0);
    return;
  }
  vec3 n = normalize(cross(dx, dy));
  vec3 v = normalize(-vViewPos);
  float rim = pow(1.0 - abs(dot(n, v)), 2.0);
  float pat = gwSurface(uLook, vUV, c, t);
  float k = (0.06 + 0.4 * rim + 0.3 * pat) * (0.45 + 0.12 * lv);
  outColor = vec4(mix(uRamp[1], uRamp[3], pat) * k, 0.0);
}`;

/**
 * The Morrowind outline's draws for a look: each `{ shift: [dx, dy], ring, far }` in glow units (y up), the rings
 * outermost first, each round GLOW_DIRS directions - fire's stretched up and cut short below - then fire's embers
 * (`ring` -1). Pure: the renderer scales the shifts to the pass's pixels.
 * @param {string} look
 */
export function glowRingDraws(look) {
  const out = [];
  for (const ring of GLOW_RINGS) {
    for (let i = 0; i < GLOW_DIRS; i++) {
      const a = (i * 2 * Math.PI) / GLOW_DIRS;
      let x = Math.cos(a), y = Math.sin(a);
      if (look === 'fire') y *= y > 0 ? GLOW_FIRE_UP : GLOW_FIRE_DOWN;
      out.push(Object.freeze({ shift: Object.freeze([x * ring, y * ring]), ring, far: GLOW_RING_FAR + ring * GLOW_RING_STEP }));
    }
  }
  if (look === 'fire') {
    for (const up of GLOW_EMBER_RISE) for (const side of [-0.6, 0, 0.6]) {
      out.push(Object.freeze({ shift: Object.freeze([side, up]), ring: -1, far: GLOW_RING_FAR }));
    }
  }
  return Object.freeze(out);
}
