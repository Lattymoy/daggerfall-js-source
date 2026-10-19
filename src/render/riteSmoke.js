// @ts-check
// WB12d (2026-10-01, Mac: "faithful and a Summoner"): THE RITE'S SMOKE - a pillar of smoke over the faithful's circle,
// from the omen until the breach opens, seen across the omen's ring: a dark plume rising from the altar's flame,
// widening and leaning as it climbs, churning upward. Design: bible/11-Multiplayer/World-Bosses.md section 19 D.
//
// The gate's beacon's law (render/gate/gatePass.js): fixed geometry (its column), every placement a uniform, the clock
// handed wrapped and every rate whole cycles over it - the smoke's noise TILES along the column, and each octave climbs
// a whole number of columns over SMOKE_CLOCK_PERIOD, so the wrap never shows. The column's rows and its noise run on
// the billows' own height (smokeBillowOf), so its billows grow as they climb, and the biggest bulge its outline
// (AUDIT WB12d G17). Blended PREMULTIPLIED (ONE,
// ONE_MINUS_SRC_ALPHA): its alpha is how much sky it hides, and the fire's glow in its foot is light added. Lit as the
// frame is (AUDIT WB12d G8). Never thinner than a few pixels: far off it widens with its distance, and in a clear day's
// distance fog it never thins below SMOKE_FOG_FLOOR, so a circle a few kilometres off is a dark line on the horizon -
// weather's fog takes it whole (AUDIT WB12d G9).
//
// Not a DFU member. Ledger A (WB).
import { FOG_FACTOR_GLSL } from './labGrass.js';
import { buildProgram } from './glProgram.js';

/** The clock the smoke is drawn on, seconds, wrapped. */
export const SMOKE_CLOCK_PERIOD = 120;
export const smokeClock = (seconds) => ((seconds % SMOKE_CLOCK_PERIOD) + SMOKE_CLOCK_PERIOD) % SMOKE_CLOCK_PERIOD;
/** The plume: how tall, its radius at the fire and at its top, how slowly it swells (the power of its height), and how
 *  far it leans by its top (metres east, north - the same way every day: no wind is read). AUDIT WB12d (G3): its foot
 *  the altar's flame's width, swelling slowly - a 3 m foot swelling at the height's 0.6 stood a 9 m funnel round the
 *  braziers. */
export const SMOKE_HEIGHT_M = 340;
export const SMOKE_FOOT_R = 1.2;
export const SMOKE_TOP_R = 70;
export const SMOKE_SWELL = 0.9;
export const SMOKE_LEAN = Object.freeze([60, 24]);
/** The column's rings round and up (a plume's swell needs its rows - a beacon's two make a cone). */
export const SMOKE_SEGMENTS = 24;
export const SMOKE_ROWS = 40;
/** Its noise's tiles round the column and up it, and AUDIT WB12d (G17) the columns each octave climbs over the clock's
 *  period (whole, so the wrap never shows): the big billows slow, the fine faster - a plume churning as it rises, where
 *  one sheet of noise slid up it whole at 5.7 m/s. */
export const SMOKE_TILES_AROUND = 4;
export const SMOKE_TILES_UP = 10;
export const SMOKE_CLIMB_HEIGHTS = Object.freeze([2, 3, 5]);
/** AUDIT WB12d (G17): the billows grow as they climb, each about as tall as it is wide - the noise's height runs on
 *  log(1 + SMOKE_BILLOW h) - where cells 34 m tall stood up a column 2 m wide and drew a searchlight's streaks. */
export const SMOKE_BILLOW = 20;
/** The billows' height at a height up the column (both 0..1), and its inverse - the column's rows run on it, close at
 *  the fire and far apart at the top. Pure. */
export const smokeBillowOf = (h) => Math.log(1 + SMOKE_BILLOW * h) / Math.log(1 + SMOKE_BILLOW);
export const smokeHeightOf = (y) => (Math.exp(y * Math.log(1 + SMOKE_BILLOW)) - 1) / SMOKE_BILLOW;
/** AUDIT WB12d (G17): how far its biggest billows bulge out of its outline (a share of its radius, either way) - a smooth
 *  cone's edge read as a funnel. */
export const SMOKE_LUMP = 0.6;
/** AUDIT WB12d (G9): each octave fades to SMOKE_LOD_MEAN as its billows shrink under SMOKE_LOD_RAD (radians, about 3
 *  pixels on a wide view) - no shimmer far off, and a little over the noise's own mean, so a far plume reads thick; and
 *  the noise's thin and thick edges, where it begins to hide the sky and where it hides it all. */
export const SMOKE_LOD_RAD = 0.003;
export const SMOKE_LOD_MEAN = 0.58;
export const SMOKE_COVER = Object.freeze([0.28, 0.7]);
/** How dark, how thick, the least of it a clear day's distance fog may leave, its widening a metre away. */
export const SMOKE_COLOR = Object.freeze([0.11, 0.1, 0.095]);
export const SMOKE_ALPHA = 0.95;
export const SMOKE_FOG_FLOOR = 0.6;
export const SMOKE_WIDEN = 0.007;
/** AUDIT WB12d (G3): it fades in over its first metre - the flame's - and the fire glows in it over its first few
 *  metres (the glow falls by e every SMOKE_EMBER_M): light added, never the smoke's own colour. */
export const SMOKE_FOOT_FADE_M = 1;
export const SMOKE_EMBER = Object.freeze([0.85, 0.28, 0.08]);
export const SMOKE_EMBER_M = 2.5;
export const SMOKE_GLOW = 1.4;
/** AUDIT WB12d (G8): the least of the frame's light it takes - the night darkens it, never to a hole in the sky. */
export const SMOKE_LIGHT_MIN = 0.06;
/** The most pillars a frame draws (its host stands one circle at a time - AUDIT WB12d D21: no day's pillar beside another's). */
export const SMOKE_MAX = 2;
/** AUDIT WB12d (G14): THE ONE THRESHOLD - a pillar this faint or fainter is not drawn, and its host says it is not
 *  smoking (scenes/riteHost.js): a pass asked to draw always draws, so the host's foreign-pass mark always follows. */
export const SMOKE_FADE_MIN = 0.001;

const HEAD = `#version 300 es
precision highp float;
`;
const FOG_UNIFORMS = `uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
`;
const f1 = (v) => Number(v).toFixed(4);
const v3 = (a) => `vec3(${a.map(f1).join(', ')})`;
const NOISE = `float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// value noise on a lattice that TILES: per's cells round and up, so the column's seam and the clock's wrap are seamless
float tnoise(vec2 q, vec2 per) {
  vec2 i = floor(q), f = fract(q);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(mod(i, per)), b = hash(mod(i + vec2(1.0, 0.0), per));
  float c = hash(mod(i + vec2(0.0, 1.0), per)), d = hash(mod(i + vec2(1.0, 1.0), per));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
`;

export const SMOKE_VS = HEAD + `layout(location = 0) in vec2 aUV;   // x around 0..1, y up the billows' height 0..1
uniform mat4 uVP;
uniform vec3 uOrigin;   // the circle's heart, on its ground
uniform vec3 uEye;
uniform float uTime;
out vec2 vUV;
out vec3 vWorld;
out vec3 vNormal;
out float vRad;
${NOISE}// the column's height up it (0..1) at a row's place on the billows' height: close at the fire, far apart at the top
float heightOf(float y) { return (exp(clamp(y, 0.0, 1.0) * ${f1(Math.log(1 + SMOKE_BILLOW))}) - 1.0) / ${f1(SMOKE_BILLOW)}; }
vec3 axisAt(float h) { return uOrigin + vec3(${f1(SMOKE_LEAN[0])} * h * h, h * ${f1(SMOKE_HEIGHT_M)}, ${f1(SMOKE_LEAN[1])} * h * h); }
// its radius there: the flame's width at its foot, swelling slowly as it climbs, its biggest billows bulging out of it as
// they rise - the smoke's own first octave, so the outline swells where the smoke is thick (AUDIT WB12d G17) - and never
// thinner than a few pixels far off
float radiusAt(vec2 uv) {
  vec2 per = vec2(${f1(SMOKE_TILES_AROUND)}, ${f1(SMOKE_TILES_UP)});
  float lump = tnoise(vec2(uv.x * per.x, (clamp(uv.y, 0.0, 1.0) - uTime / ${f1(SMOKE_CLOCK_PERIOD)} * ${f1(SMOKE_CLIMB_HEIGHTS[0])}) * per.y), per);
  float r = mix(${f1(SMOKE_FOOT_R)}, ${f1(SMOKE_TOP_R)}, pow(heightOf(uv.y), ${f1(SMOKE_SWELL)})) * (1.0 + ${f1(SMOKE_LUMP)} * (lump - 0.5));
  return max(r, length(uEye.xz - uOrigin.xz) * ${f1(SMOKE_WIDEN)});
}
vec3 placeAt(vec2 uv) {
  float a = uv.x * 6.283185307179586;
  return axisAt(heightOf(uv.y)) + vec3(cos(a), 0.0, sin(a)) * radiusAt(uv);
}
void main() {
  float h = heightOf(aUV.y), a = aUV.x * 6.283185307179586, rad = radiusAt(aUV);
  vec3 p = axisAt(h) + vec3(cos(a), 0.0, sin(a)) * rad;
  // its own surface's normal, the bulges' slopes and all (AUDIT WB12d G17: the axis's outward line folded a bulge's
  // flank into a hard ring)
  vec2 e = vec2(${f1(0.25 / SMOKE_SEGMENTS)}, ${f1(0.25 / SMOKE_ROWS)});
  vNormal = cross(placeAt(aUV + vec2(0.0, e.y)) - placeAt(aUV - vec2(0.0, e.y)), placeAt(aUV + vec2(e.x, 0.0)) - placeAt(aUV - vec2(e.x, 0.0)));
  vUV = vec2(aUV.x, h);
  vWorld = p;
  vRad = rad;
  gl_Position = uVP * vec4(p, 1.0);
}`;

export const SMOKE_FS = HEAD + `in vec2 vUV;
in vec3 vWorld;
in vec3 vNormal;
in float vRad;
uniform float uTime;
uniform float uFade;
uniform float uLight;   // the frame's light on it, 0..1
${FOG_UNIFORMS}out vec4 o;
${FOG_FACTOR_GLSL}
${NOISE}void main() {
  float h = vUV.y;
  float t = uTime / ${f1(SMOKE_CLOCK_PERIOD)};   // the clock's period, 0..1
  vec2 per = vec2(${f1(SMOKE_TILES_AROUND)}, ${f1(SMOKE_TILES_UP)});
  // the billows grow as they climb (AUDIT WB12d G17): the noise's height, and how fast it runs here
  float y = log(1.0 + ${f1(SMOKE_BILLOW)} * h) / ${f1(Math.log(1 + SMOKE_BILLOW))};
  float dy = ${f1(SMOKE_BILLOW / Math.log(1 + SMOKE_BILLOW))} / (1.0 + ${f1(SMOKE_BILLOW)} * h);
  // the coarsest billow here against the eye's few pixels at its distance (AUDIT WB12d G9)
  float big = min(6.2831853 * vRad / per.x, ${f1(SMOKE_HEIGHT_M)} / (per.y * dy)) / max(length(uCamPos - vWorld) * ${f1(SMOKE_LOD_RAD)}, 1e-4);
  // each octave its own climb, a whole number of columns a period (AUDIT WB12d G17), and its mean once too fine to see
  float n = 0.5 * mix(${f1(SMOKE_LOD_MEAN)}, tnoise(vec2(vUV.x * per.x, (y - t * ${f1(SMOKE_CLIMB_HEIGHTS[0])}) * per.y), per), smoothstep(1.0, 3.0, big))
          + 0.3 * mix(${f1(SMOKE_LOD_MEAN)}, tnoise(vec2(vUV.x * per.x * 2.0, (y - t * ${f1(SMOKE_CLIMB_HEIGHTS[1])}) * per.y * 2.0), per * 2.0), smoothstep(2.0, 6.0, big))
          + 0.2 * mix(${f1(SMOKE_LOD_MEAN)}, tnoise(vec2(vUV.x * per.x * 4.0, (y - t * ${f1(SMOKE_CLIMB_HEIGHTS[2])}) * per.y * 4.0), per * 4.0), smoothstep(4.0, 12.0, big));
  // thick where the eye looks through the plume's heart, thin where its surface turns edge on
  float core = smoothstep(0.0, 0.55, abs(dot(normalize(vNormal), normalize(uCamPos - vWorld))));
  float puff = smoothstep(${f1(SMOKE_COVER[0])}, ${f1(SMOKE_COVER[1])}, n) * core;
  float body = smoothstep(0.0, ${f1(SMOKE_FOOT_FADE_M / SMOKE_HEIGHT_M)}, h) * (1.0 - smoothstep(0.5, 1.0, h));
  float a = clamp(puff * body * ${f1(SMOKE_ALPHA)}, 0.0, 1.0);
  // the floor in a clear day's distance alone - weather's fog takes it whole (AUDIT WB12d G9)
  float f = fogFactorAt(vWorld);
  a *= (uFogMode == 1 ? max(f, ${f1(SMOKE_FOG_FLOOR)}) : f) * uFade;
  // lit as the frame is (AUDIT WB12d G8); the fire under it a glow in its first metres, light added (G3)
  vec3 glow = ${v3(SMOKE_EMBER)} * (${f1(SMOKE_GLOW)} * exp(-h * ${f1(SMOKE_HEIGHT_M / SMOKE_EMBER_M)}) * puff * f * uFade);
  o = vec4(${v3(SMOKE_COLOR)} * max(uLight, ${f1(SMOKE_LIGHT_MIN)}) * a + glow, a);
}`;

/** The plume's column, (around, up) pairs, two triangles a cell. Pure. */
export function smokeVertices(segments = SMOKE_SEGMENTS, rows = SMOKE_ROWS) {
  const out = new Float32Array(segments * rows * 12);
  let o = 0;
  for (let j = 0; j < rows; j++) {
    const v0 = j / rows, v1 = (j + 1) / rows;
    for (let i = 0; i < segments; i++) {
      const a = i / segments, b = (i + 1) / segments;
      for (const [u, v] of [[a, v0], [b, v0], [b, v1], [a, v0], [b, v1], [a, v1]]) { out[o++] = u; out[o++] = v; }
    }
  }
  return out;
}

function mat4Multiply(out, a, b) {
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}
const NO_FOG_RANGE = new Float32Array([0, 1]);
const NO_FOCUS = new Float32Array(4);
const NO_HAZE = new Float32Array(8);   // AUDIT BANTHA1 HAZE-3: uJungleHaze off ([1].x 0)
const ORIGIN = new Float32Array([0, 0, 0]);

/** The rite's pillars of smoke, one foreign pass. */
export class RiteSmokeRenderer {
  /** @param {WebGL2RenderingContext} gl */
  constructor(gl) {
    this.gl = gl;
    this.program = buildProgram(gl, SMOKE_VS, SMOKE_FS, 'rite smoke');
    this.u = {};
    for (const n of ['uVP', 'uOrigin', 'uEye', 'uTime', 'uFade', 'uLight', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos', 'uFocus', 'uJungleHaze']) this.u[n] = gl.getUniformLocation(this.program, n);
    const verts = smokeVertices();
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);
    this.count = verts.length / 2;
    this._vp = new Float32Array(16);
    this.drawn = 0;
  }

  /**
   * Draw the pillars: `smokes` [{ origin: [x, y, z] the circle's heart on its ground, fade 0..1 }] (at most SMOKE_MAX,
   * the faded skipped), `eye` the view's own eye, `seconds` any clock (wrapped here), `fog` the frame's fog - and its
   * `light`, the frame's light on the smoke 0..1 (render/rainCurtains.js's: the ambient and the sun's share).
   */
  draw(smokes, proj, view, eye, seconds, fog = null) {
    this.drawn = 0;
    const list = (Array.isArray(smokes) ? smokes : []).filter((s) => s && Array.isArray(s.origin) && s.origin.length === 3 && s.origin.every(Number.isFinite) && s.fade > SMOKE_FADE_MIN).slice(0, SMOKE_MAX);
    if (!list.length) return;
    const gl = this.gl, U = this.u;
    mat4Multiply(this._vp, proj, view);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(U.uVP, false, this._vp);
    gl.uniform1f(U.uTime, smokeClock(seconds));
    gl.uniform1f(U.uLight, Number.isFinite(fog?.light) ? Math.max(0, Math.min(1, fog.light)) : 1);
    gl.uniform3fv(U.uEye, eye ?? fog?.camPos ?? ORIGIN);
    gl.uniform1i(U.uFogMode, fog ? fog.mode : 0);
    gl.uniform1f(U.uFogDensity, fog?.density ?? 0);
    gl.uniform2fv(U.uFogRange, fog?.range ?? NO_FOG_RANGE);
    gl.uniform3fv(U.uCamPos, fog?.camPos ?? eye ?? ORIGIN);
    if (U.uFocus) gl.uniform4fv(U.uFocus, fog?.focus ?? NO_FOCUS);   // AUDIT DEEP R-1: under the travel view the fog is the traveller's (fogGlsl.js FOCUS_GLSL)
    if (U.uJungleHaze) gl.uniform4fv(U.uJungleHaze, fog?.haze ?? NO_HAZE);   // BANTHA1 (AUDIT BANTHA1 HAZE-3): the jungle's haze (renderer.setJungleHaze); none handed, off
    gl.bindVertexArray(this.vao);
    for (const s of list) {
      gl.uniform3f(U.uOrigin, s.origin[0], s.origin[1], s.origin[2]);
      gl.uniform1f(U.uFade, Math.min(1, s.fade));
      gl.drawArrays(gl.TRIANGLES, 0, this.count);
      this.drawn++;
    }
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
}
