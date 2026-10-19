// @ts-check
// SHIP-COLOURS (2026-10-17, the owner: "Finally, a fully customizable flag with the option to use your guild insignia";
// bible/03-World/Naval-Refit.md SHIP-COLOURS) - A SHIP'S FLAG, FLOWN: cloth at her masthead, streaming downwind.
//
// The guild's banners (render/bannerPass.js) hang from a wall; a flag flies from a staff. Each is a sheet of
// FLAG_COLS by FLAG_ROWS quads, its HOIST edge (u 0) nailed at the masthead (her FlagObject - Come Sail Away aims it down
// the wind she feels, ComeSailAway.cs's flag rotation, so the fly lies along its forward) and its FLY (u 1) out along
// it. A travelling wave runs from the hoist to the fly, its throw growing toward the free edge and with the wind; in a
// light air the fly bends down toward the staff along an arc (its length kept). Its normal is the wave's own slope, so the folds
// catch the sun. The picture is the flag's drawing (ui/flagArt.js drawFlag), one texture a flag, kept while it is
// drawn (BANNER_TEXTURE_IDLE_S, the banners' law); the shape's cut is discarded, both faces drawn, lit by the frame's sun
// and moon and fogged as the ground is (bannerPass.js's fragment law).
//
// Every rate is a whole number of cycles over BANNER_CLOCK_PERIOD and the clock is handed wrapped (bannerClock), so the
// wave never stutters as a 32-bit float's seconds grow; each flag's phase is its own.
import { FOG_FACTOR_GLSL } from './labGrass.js';
import { buildProgram } from './glProgram.js';
import { bannerClock, BANNER_TEXTURE_IDLE_S } from './bannerPass.js';
import { BAYER_GLSL, DISSOLVE_GLSL } from './orderedDither.js';   // AUDIT 2: SHIP-FADE's dissolve, her cloth with her hull

/** The quads along the fly and down the hoist. */
export const FLAG_COLS = 12;
export const FLAG_ROWS = 3;
/** The most flags a frame draws - SEA-COLOURS: the sea's ships' with the players', the nearest first (a cloth is one draw). */
export const FLAGS_MAX = 24;
/** The canvas a flag is drawn on, pixels wide (two thirds as tall). */
export const FLAG_TEX_W = 96;
/** A flag that would not paint is asked again this long on (s) - never every frame. */
export const FLAG_REPAINT_S = 5;
/** How far a dead calm bends the fly down toward the staff (radians at its free edge). */
export const FLAG_SLACK_BEND = 0.9;
/** The wave's cycles a second and its waves along the cloth (whole over the period - a pin holds the rate). */
export const FLAG_WAVE_HZ = 1.5;
export const FLAG_WAVES = 1.6;

const HEAD = `#version 300 es
precision highp float;
`;
export const FLAG_VS = HEAD + `layout(location = 0) in vec2 aUV;   // x: along the fly 0..1 from the hoist, y: down the hoist 0..1
uniform mat4 uVP;
uniform vec3 uTop;     // the hoist's top, in the scene (her masthead)
uniform vec3 uFly;     // along the fly, flat (downwind)
uniform vec2 uSize;    // fly, hoist (m)
uniform float uTime;   // bannerClock's seconds
uniform float uWind;   // 0..1
uniform float uPhase;
out vec2 vUV;
out vec3 vWorld;
out vec3 vNormal;
const float TAU = 6.283185307179586;
void main() {
  float u = aUV.x, v = aUV.y;
  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 side = normalize(cross(up, uFly));
  // a light air: the fly bends down toward the staff along an arc - its length kept (the cloth never stretches), its
  // angle FLAG_SLACK_BEND radians at the fly in a dead calm
  float bend = ${FLAG_SLACK_BEND.toFixed(2)} * (1.0 - uWind);
  float reach = (bend > 1e-3 ? sin(bend * u) / bend : u) * uSize.x;
  float droop = (bend > 1e-3 ? (1.0 - cos(bend * u)) / bend : 0.0) * uSize.x;
  float w = TAU * (uTime * ${FLAG_WAVE_HZ.toFixed(2)} - u * ${FLAG_WAVES.toFixed(2)}) + uPhase;
  float amp = (0.04 + 0.12 * uWind) * uSize.y;
  float throwU = u * (0.35 + 0.65 * u);
  float lateral = amp * throwU * sin(w + v * 0.8);
  // the sheet bends as a whole about her side: its hoist-wise line at u turned by the fly's own angle there, so a row
  // below the top edge follows it in toward the staff and the cloth is never sheared
  float turn = bend * u;
  vec3 down = -(sin(turn) * uFly + cos(turn) * up);
  vec3 p = uTop + uFly * reach - up * droop + down * v * uSize.y + side * lateral;
  // the fold's slope along the fly: the normal leans off the side by it
  float dLat = amp * ((0.35 + 1.3 * u) * sin(w + v * 0.8) - throwU * TAU * ${FLAG_WAVES.toFixed(2)} * cos(w + v * 0.8)) / max(uSize.x, 0.1);
  vNormal = normalize(side - uFly * dLat);
  vUV = aUV;
  vWorld = p;
  gl_Position = uVP * vec4(p, 1.0);
}`;
export const FLAG_FS = HEAD + `in vec2 vUV;
in vec3 vWorld;
in vec3 vNormal;
uniform sampler2D uTex;
uniform vec3 uSunDir;
uniform vec3 uAmb;
uniform vec3 uSunCol;
uniform float uSunScale;
uniform vec3 uMoonDir;
uniform vec3 uMoonCol;
uniform float uMoonScale;
uniform vec3 uFogColor;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
out vec4 o;
${FOG_FACTOR_GLSL}
${BAYER_GLSL}
${DISSOLVE_GLSL}
void main() {
  vec4 t = texture(uTex, vUV);
  if (t.a < 0.5) discard;   // the shape's cut
  dissolveCut();   // AUDIT 2: SHIP-FADE - a ship sailing into the world or out of it keeps her share of her cloth as of her hull
  t.rgb /= t.a;   // uploaded premultiplied (the banners' law)
  float face = abs(dot(normalize(vNormal), normalize(uSunDir)));
  float moon = abs(dot(normalize(vNormal), normalize(uMoonDir)));
  vec3 lit = t.rgb * min(vec3(1.0), uAmb + uSunCol * uSunScale * (0.3 + 0.7 * face) + uMoonCol * uMoonScale * (0.3 + 0.7 * moon));
  vec3 c = mix(uFogColor, lit, fogFactorAt(vWorld));
  o = vec4(dwWaterFog(c, vWorld), 1.0);
}`;

/** The cloth's vertices, (along, down) pairs, two triangles a quad. Pure. */
export function flagVertices(cols = FLAG_COLS, rows = FLAG_ROWS) {
  const out = new Float32Array(cols * rows * 6 * 2);
  let o = 0;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const u0 = i / cols, u1 = (i + 1) / cols, v0 = j / rows, v1 = (j + 1) / rows;
      for (const [u, v] of [[u0, v0], [u1, v0], [u1, v1], [u0, v0], [u1, v1], [u0, v1]]) { out[o++] = u; out[o++] = v; }
    }
  }
  return out;
}

/** The fly's flat direction from a forward (her FlagObject's), unit - or +z for one that points straight up or down. */
export function flyOf(forward) {
  const x = Number(forward?.[0]) || 0, z = Number(forward?.[2]) || 0;
  const l = Math.hypot(x, z);
  return l > 1e-4 ? [x / l, 0, z / l] : [0, 0, 1];
}

function mat4Multiply(out, a, b) {
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return out;
}
const NO_FOG_RANGE = new Float32Array([0, 1]);
const NO_WATER_FOG = new Float32Array(20);
const NO_HAZE = new Float32Array(8);   // BANTHA1: uJungleHaze off ([1].x 0)
const NO_FOCUS = new Float32Array(4);
const GREY = new Float32Array([0.5, 0.5, 0.5]);
const UP = new Float32Array([0, 1, 0]);

export class ShipFlagRenderer {
  /** @param {WebGL2RenderingContext} gl @param {{ paint?: (flag: any) => (HTMLCanvasElement|OffscreenCanvas|null) }} [opts] */
  constructor(gl, { paint = null } = {}) {
    this.gl = gl;
    this.paint = paint;
    const prog = buildProgram(gl, FLAG_VS, FLAG_FS);
    this.program = prog;
    this.u = {};
    for (const n of ['uVP', 'uTop', 'uFly', 'uSize', 'uTime', 'uWind', 'uPhase', 'uTex', 'uSunDir', 'uAmb', 'uSunCol', 'uSunScale', 'uMoonDir', 'uMoonCol', 'uMoonScale',
      'uFogColor', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos', 'uDwFog', 'uJungleHaze', 'uFocus', 'uDissolveCut']) this.u[n] = gl.getUniformLocation(prog, n);
    const verts = flagVertices();
    this.count = verts.length / 2;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);
    this._vp = new Float32Array(16);
    /** @type {Map<string, {tex: WebGLTexture | null, seen: number, failed?: number}>} a flag's texture, by its key, when it
     *  was last drawn, and (null) when it would not paint */
    this.textures = new Map();
    this.drawn = 0;
  }

  /** A flag's texture: painted and uploaded the first time, kept while it is drawn (null where it cannot be painted -
   *  remembered so, and asked again FLAG_REPAINT_S on: AUDIT 2026-10-17, a canvas was made and painted every frame for a
   *  flag that would not paint). */
  textureOf(key, flag, seconds = 0) {
    const had = this.textures.get(key);
    if (had) { had.seen = seconds; if (had.tex || seconds - had.failed < FLAG_REPAINT_S) return had.tex; }
    const gl = this.gl;
    const canvas = this.paint?.(flag) ?? null;
    if (!canvas) { this.textures.set(key, { tex: null, seen: seconds, failed: seconds }); return null; }
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, /** @type {any} */ (canvas));
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.textures.set(key, { tex, seen: seconds });
    return tex;
  }
  /** A flag not drawn for BANNER_TEXTURE_IDLE_S gives its texture back - asked by every draw, one of no flags too (the
   *  host draws on, so the textures of flags sailed out of sight go). */
  prune(seconds) {
    for (const [key, t] of this.textures) if (seconds - t.seen > BANNER_TEXTURE_IDLE_S) { if (t.tex) this.gl.deleteTexture(t.tex); this.textures.delete(key); }
  }

  /**
   * Draw the flags: `flags` [{ key, flag, top: [x, y, z] in the scene, fly: [x, 0, z] unit, size: [fly, hoist], phase, fade }]
   * (`fade` AUDIT 2: her SHIP-FADE share, 1 or none whole)
   * (at most FLAGS_MAX), `seconds` any clock, `light` the frame's, `wind` 0..1, `fog` the frame's. Answers whether it
   * drew anything (the host marks the foreign pass on it).
   */
  draw(flags, proj, view, eye, seconds, { light = null, wind = 0, fog = null } = {}) {
    this.drawn = 0;
    this.prune(seconds);
    const list = (Array.isArray(flags) ? flags : []).filter((f) => f && Array.isArray(f.top) && f.top.every(Number.isFinite) && Array.isArray(f.size)).slice(0, FLAGS_MAX);
    if (!list.length) return false;
    const gl = this.gl, U = this.u;
    mat4Multiply(this._vp, proj, view);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(U.uVP, false, this._vp);
    gl.uniform1f(U.uTime, bannerClock(seconds));
    gl.uniform1f(U.uWind, Math.max(0, Math.min(1, Number(wind) || 0)));
    gl.uniform3fv(U.uSunDir, light?.sunDir ?? UP);
    gl.uniform3fv(U.uAmb, light?.amb ?? GREY);
    gl.uniform3fv(U.uSunCol, light?.sunCol ?? GREY);
    gl.uniform1f(U.uSunScale, light?.sunScale ?? 0.5);
    gl.uniform3fv(U.uMoonDir, light?.moonDir ?? UP);
    gl.uniform3fv(U.uMoonCol, light?.moonCol ?? GREY);
    gl.uniform1f(U.uMoonScale, light?.moonScale ?? 0);
    gl.uniform3fv(U.uFogColor, fog?.color ?? GREY);
    gl.uniform1i(U.uFogMode, fog ? fog.mode : 0);
    gl.uniform1f(U.uFogDensity, fog?.density ?? 0);
    gl.uniform2fv(U.uFogRange, fog?.range ?? NO_FOG_RANGE);
    gl.uniform3fv(U.uCamPos, fog?.camPos ?? eye ?? GREY);
    if (U.uDwFog) gl.uniform4fv(U.uDwFog, fog?.dw ?? NO_WATER_FOG);
    if (U.uJungleHaze) gl.uniform4fv(U.uJungleHaze, fog?.haze ?? NO_HAZE);   // BANTHA1: the jungle's haze (renderer.setJungleHaze); none handed, off
    if (U.uFocus) gl.uniform4fv(U.uFocus, fog?.focus ?? NO_FOCUS);
    gl.uniform1i(U.uTex, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindVertexArray(this.vao);
    gl.disable(gl.CULL_FACE);
    for (const f of list) {
      const tex = this.textureOf(f.key, f.flag, seconds);
      if (!tex) continue;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform3f(U.uTop, f.top[0], f.top[1], f.top[2]);
      const fly = flyOf(f.fly);
      gl.uniform3f(U.uFly, fly[0], fly[1], fly[2]);
      gl.uniform2f(U.uSize, f.size[0], f.size[1]);
      gl.uniform1f(U.uPhase, Number(f.phase) || 0);
      if (U.uDissolveCut) gl.uniform1f(U.uDissolveCut, 1 - Math.max(0, Math.min(1, Number.isFinite(f.fade) ? f.fade : 1)));   // AUDIT 2: her fade's share CUT (nought whole)
      gl.drawArrays(gl.TRIANGLES, 0, this.count);
      this.drawn++;
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    return true;
  }
}
