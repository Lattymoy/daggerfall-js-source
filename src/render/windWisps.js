// @ts-check
// WIND3 (2026-09-14, Mac: "World space wisps that indicate the direction
// of wind") - THE WISPS: the wind, seen.
//
// A wisp is a faint streak of air riding the wind: a thin quad stretched
// along the wind's own velocity, born and gone over a couple of seconds
// (a fade in and out on its own phase, so the field is never a rigid
// sheet), wobbling a little as it goes. They live in a box that follows
// the eye and WRAPS (the lab's law from the rain: `p = mod(p - uEye +
// uBox*0.5, uBox) + uEye - uBox*0.5`, so moving reveals other wisps and
// never drags the ones in view), and they travel by the ONE integrated
// wind (systems/windDrive.js `step`, PROTO-19's law: a distance already
// travelled, never wind x time). The count and the alpha follow the
// wind's STRENGTH - a few faint ones in a breeze, the air full of them
// in a gale - with a floor, because the point of them is to be read: a
// player looks up from the map and knows which way it blows before the
// grass tells them.
//
// A sibling of PrecipitationRenderer: its own program, its own instanced
// VAO, drawn after the rain with alpha blend, depth-tested against the
// world, no depth write, unfogged (the box hugs the eye inside any fog's
// near field). The hosts call markForeignPass() after it, as they do
// after the rain (EV6). ENHANCED ONLY, behind its own row (`wind-wisps`
// on the Features home, the pref `windWisps`, the player's own online);
// `?wisps=off` is the kill door.

import { isEnhanced } from '../systems/uiSkin.js';
import { getPref } from '../systems/uiPrefs.js';

/** WIND5: a JS number as a GLSL float literal (`${1}` is an int to the compiler). */
const glslF = (v) => (Number.isInteger(v) ? `${v}.0` : String(v));
/** WIND5: THE FLOURISH. The ribbon's segments; the stroke's share of the path (the rest is the curl); the arch's rise
 *  (a share of the length, doubled at most per wisp; half the strokes an S instead of an arch); the curl's radius (a share of the length), its turns and how
 *  far it tightens (the end's radius as a share of the start's); how far a curl's plane leans off the vertical about
 *  the wind (radians); and the life's split - the head runs the path over the first WISP_DRAW_HEAD of it, the tail
 *  follows from WISP_DRAW_TAIL. */
export const WISP_SEGMENTS = 40;
export const WISP_STROKE = 0.55;
export const WISP_ARCH = 0.08;
export const WISP_CURL_R = 0.2;
export const WISP_CURL_TURNS = 1.6;
export const WISP_CURL_TIGHT = 0.3;
export const WISP_LEAN = 1.05;
export const WISP_DRAW_HEAD = 0.55;
export const WISP_DRAW_TAIL = 0.45;

const HEAD = `#version 300 es
precision highp float;
`;

// WIND5 (2026-09-23, Mac: "lets reduce the amount of wind streaks and change their design to be more swirly like the
// image" - a sheet of calligraphic wind flourishes). A wisp is no longer one straight quad: it is a RIBBON of
// WISP_SEGMENTS segments along a path - a gentle arched stroke down the wind that ends in a spiral, tightening as it
// turns (the flourish's curl). Each swirl leans its curl's plane its own way about the wind and curls up or down, so
// the air holds a varied hand, not one stamp. The ribbon faces the eye across its width and swells from its tail and
// thins into the curl, the way a pen stroke does, and it is DRAWN ON - the head travels the path, then the tail
// follows and erases it - rather than blinking whole. A look with no curl (the sandstorm's) is one segment, the
// straight streak it always was.
export const WISP_VS = HEAD + `layout(location=0) in vec2 aCorner;   // x across the ribbon (0..1), y along its path (0..1)
layout(location=1) in vec4 aSeed;      // x,y,z in the box + phase
uniform mat4 uVP; uniform vec3 uEye;
uniform float uTime, uBox, uStrength;
uniform vec2 uWindV, uWindOff, uLen;   // WEATHER2d: the look's streak length (base, spread)
uniform float uCurl;                   // WIND5: 1 a flourish, 0 a straight streak (the sand)
out float vT; out float vLife; out float vAcross; out vec2 vDraw;
const float PI = 3.14159265;
// WIND5: the flourish's path in its own plane, in lengths - x down the wind, y across it in the curl's plane
vec2 swirl(float s, float seed) {
  float sc = mix(1.0, ${glslF(WISP_STROKE)}, uCurl);   // the stroke's share of the path; the rest is the curl
  float arch = (${glslF(WISP_ARCH)} + fract(seed*19.3)*${glslF(WISP_ARCH)}) * uCurl;
  if (s <= sc) {
    float a = s / sc;
    float r = sin(PI * a);
    float wave = fract(seed*53.9) < 0.5 ? 1.0 : 2.0 * (1.0 - 2.0 * a);   // an arch, or an S
    return vec2(s, arch * sc * r * r * wave);   // sin squared: it leaves level and meets the curl level
  }
  float k = (s - sc) / (1.0 - sc);
  float R0 = ${glslF(WISP_CURL_R)} * (0.8 + fract(seed*29.7)*0.4);
  float th = k * ${glslF(WISP_CURL_TURNS)} * 2.0 * PI;
  float r = R0 * (1.0 - ${glslF(1 - WISP_CURL_TIGHT)} * k * k);   // eased in: no kink where the stroke meets the curl
  return vec2(sc, R0) + r * vec2(sin(th), -cos(th));   // from the stroke's end, heading down the wind, curling in
}
void main(){
  float seed = aSeed.w;
  vec3 p = aSeed.xyz;
  // every wisp takes its own share of the wind, so the field is not one
  // rigid direction (the rain's per-drop gust, PROTO-9)
  float gust = 0.80 + fract(seed*3.7)*0.4;
  p += vec3(uWindOff.x, 0.0, uWindOff.y) * gust;
  // a slow wobble across and along, phased per wisp
  p.y += sin(uTime*0.9 + seed*31.0) * 0.35;
  p.xz += vec2(cos(uTime*0.7 + seed*17.0), sin(uTime*0.6 + seed*23.0)) * 0.25;
  p = mod(p - uEye + uBox*0.5, uBox) + uEye - uBox*0.5;
  // born, brightest at half life, gone: a fade on the wisp's own clock
  float rate = 0.35 + fract(seed*5.3)*0.25;
  float ph = fract(uTime*rate + seed*7.0);
  vLife = sin(ph * 3.14159);
  // WIND5: drawn on - the head runs the path over the first part of the life, the tail follows it off
  vDraw = vec2(smoothstep(0.0, ${glslF(WISP_DRAW_HEAD)}, ph) * 1.05, smoothstep(${glslF(WISP_DRAW_TAIL)}, 1.0, ph) * 1.05 - 0.05);
  // a streak along the wind's velocity, longer in a stronger wind
  vec3 drift = vec3(uWindV.x, 0.0, uWindV.y) * gust;
  float dl = length(drift);
  vec3 vel = dl > 1e-3 ? drift / dl : vec3(1.0, 0.0, 0.0);
  float len = (uLen.x + fract(seed*13.1)*uLen.y) * (0.5 + uStrength);
  float sz = 0.05 + fract(seed*11.7)*0.05;
  // WIND5: the curl's plane - leaning off the vertical about the wind by up to WISP_LEAN, curling up or down
  vec3 across = normalize(vec3(-vel.z, 0.0, vel.x));   // not 'flat': GLSL ES 3.00 reserves it
  float lean = (fract(seed*41.3) * 2.0 - 1.0) * ${glslF(WISP_LEAN)};
  vec3 up = (cos(lean) * vec3(0.0, 1.0, 0.0) + sin(lean) * across) * (fract(seed*7.7) < 0.5 ? 1.0 : -1.0);
  float sAt = aCorner.y;
  vec2 c = swirl(sAt, seed);
  vec2 tg = swirl(min(sAt + 0.01, 1.0), seed) - swirl(max(sAt - 0.01, 0.0), seed);
  p += (vel * (c.x - 0.5) + up * c.y) * len;
  vec3 t3 = vel * tg.x + up * tg.y;
  vec3 toEye = uEye - p;
  vec3 c0 = cross(length(t3) > 1e-6 ? t3 : vel, toEye);
  vec3 side = length(c0) > 1e-4 ? normalize(c0) : vec3(0.0, 1.0, 0.0);
  // the pen: swelling in from the tail, thinning into the curl (a straight streak keeps its width)
  float pen = mix(1.0, smoothstep(0.0, 0.12, sAt) * (1.0 - 0.75 * smoothstep(0.3, 1.0, sAt)), uCurl);
  p += side * (aCorner.x-0.5) * sz * pen;
  vT = sAt;
  vAcross = aCorner.x;
  gl_Position = uVP * vec4(p, 1.0);
}`;
export const WISP_FS = HEAD + `in float vT; in float vLife; in float vAcross; in vec2 vDraw;
uniform float uStrength;
uniform vec3 uColor;   // WEATHER2d: the look's colour
uniform vec2 uAlpha;   // WEATHER2d: the look's alpha (base, per strength)
uniform float uCurl;   // WIND5
out vec4 o;
void main(){
  // bright toward the head, faint at the tail; never more than a breath
  float a = smoothstep(0.0, 0.45, vT) * (1.0 - smoothstep(0.85, 1.0, vT));
  // WIND5: a flourish is drawn on and off along its path, soft across its width like ink
  float drawn = smoothstep(vDraw.y, vDraw.y + 0.06, vT) * (1.0 - smoothstep(vDraw.x - 0.06, vDraw.x, vT));
  float ink = 1.0 - pow(abs(vAcross * 2.0 - 1.0), 3.0);
  a = mix(a, drawn * ink * 1.6, uCurl);
  a *= vLife * (uAlpha.x + uAlpha.y * uStrength);
  o = vec4(uColor, a);
}`;

/** The box that follows the eye, metres a side (the rain's is 42; the
 *  wisps read from further, so the wind is legible over a field). */
export const WISP_BOX = 90;
/** The most wisps the field draws, at a gale.
 *
 *  WIND4 (2026-09-15, Mac: "the wind wisps are far too many and the
 *  amount should be reduced"). This was 2400 in a 90 m box - about one
 *  wisp per three cubic metres of the air in front of you at a gale,
 *  which reads as a fog of streaks rather than as wind. The field's
 *  job is to make the DIRECTION legible, and that is carried by a few
 *  streaks moving together, not by filling the box: 650 at a gale,
 *  and a calm that is nearly clear.
 *
 *  WIND5 (2026-09-23, Mac: "lets reduce the amount of wind streaks"): 240. A flourish is a bigger, more deliberate
 *  mark than a streak - a stroke and a curl, drawn on and off - and a few of them read as wind where the streaks
 *  needed numbers; a calm keeps a couple of dozen (the floor). */
export const WISP_MAX = 240;
/** The share of WISP_MAX drawn in a dead calm - the floor that keeps
 *  the direction readable. WIND4: 0.08 of the new maximum is ~52
 *  wisps, where 0.12 of the old was 288 - a still day should be still. */
export const WISP_FLOOR = 0.08;

/** WEATHER2d: A LOOK - the program in a dress. The wisps' own, and the
 *  sandstorm's: tan, dense, short streaks in a lower box, no floor (no
 *  sand without a storm), the front's intensity its strength. */
export const WISP_LOOK = Object.freeze({ color: Object.freeze([0.86, 0.89, 0.94]), alpha: Object.freeze([0.10, 0.12]), len: Object.freeze([2.6, 2.0]), count: WISP_MAX, floor: WISP_FLOOR, box: WISP_BOX, curl: 1 });   // WIND5: longer, to hold a curl
export const SAND_LOOK = Object.freeze({ color: Object.freeze([0.80, 0.64, 0.40]), alpha: Object.freeze([0.28, 0.30]), len: Object.freeze([0.8, 1.2]), count: 7000, floor: 0, box: 70, curl: 0 });   // WIND5: sand streaks, straight

/** WIND5: the ribbon's vertices for a look - WISP_SEGMENTS segments for a flourish, one for a straight streak (the
 *  quad it always was, corner for corner). Each segment two triangles: (x across, y along the path). */
export function ribbon(look) {
  const n = look.curl > 0 ? WISP_SEGMENTS : 1;
  const v = new Float32Array(n * 12);
  for (let i = 0; i < n; i++) {
    const a = i / n, b = (i + 1) / n;
    v.set([0, a, 1, a, 1, b, 0, a, 1, b, 0, b], i * 12);
  }
  return v;
}

/** How many wisps a wind of `strength01` draws: the floor plus the rest
 *  over a smoothstep of the strength. Pure. */
export function wispCount(strength01, look = WISP_LOOK) {
  const s = Math.max(0, Math.min(1, strength01));
  const u = Math.max(0, Math.min(1, (s - 0.05) / 0.85));
  const ss = u * u * (3 - 2 * u);
  return Math.round(look.count * (look.floor + (1 - look.floor) * ss));
}

/** The wisps' switch: the enhanced skin, the `windWisps` pref, and
 *  `?wisps=off` the kill door. Read once a frame by the exterior hosts. */
export function wispsOn(search = globalThis.location?.search ?? '') {
  return isEnhanced() && !!getPref('windWisps') && new URLSearchParams(search).get('wisps') !== 'off';
}

function compileShader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
  return sh;
}

function mat4Multiply(out, a, b) {
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

export class WindWispsRenderer {
  /** Built by the enhanced lane at boot, so a shader fault is a
   *  constructor fault the boot probe sees (the rain's law). */
  constructor(gl, look = WISP_LOOK) {
    this.gl = gl;
    this.look = look;   // WEATHER2d
    const prog = gl.createProgram();
    gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER, WISP_VS));
    gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, WISP_FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    this.program = prog;
    this.u = {};
    for (const n of ['uVP', 'uEye', 'uTime', 'uBox', 'uStrength', 'uWindV', 'uWindOff', 'uLen', 'uColor', 'uAlpha', 'uCurl']) this.u[n] = gl.getUniformLocation(prog, n);   // WIND5: uCurl
    // the instances: x,y,z in [0, BOX) + a phase, from one seeded
    // xorshift so the field is the same field every load
    const n = look.count, box = look.box;
    const inst = new Float32Array(n * 4);
    let s = 0x7a3d9f1b;
    const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    for (let i = 0; i < n; i++) { inst[i * 4] = rnd() * box; inst[i * 4 + 1] = rnd() * box; inst[i * 4 + 2] = rnd() * box; inst[i * 4 + 3] = rnd(); }
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const q = ribbon(look);   // WIND5: the flourish's ribbon, or the streak's one quad
    this.verts = q.length / 2;
    const qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb); gl.bufferData(gl.ARRAY_BUFFER, q, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ib); gl.bufferData(gl.ARRAY_BUFFER, inst, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 16, 0); gl.vertexAttribDivisor(1, 1);
    gl.bindVertexArray(null);
    this.vao = vao;
    /** the wind's travel so far, metres, integrated from windDrive's
     *  step each frame and kept inside one box's span - the wrap makes
     *  the two identical, and a bounded number never loses precision
     *  over a long session */
    this.windOff = new Float32Array(2);
    this._vp = new Float32Array(16);
    /** the count the last draw put up, for the stats and the tests */
    this.drawn = 0;
  }

  /** Advance the travel by the frame's step and wrap it. */
  advance(step) {
    for (let i = 0; i < 2; i++) {
      const box = this.look.box;
      let v = this.windOff[i] + (step?.[i] ?? 0);
      v = ((v % box) + box) % box;
      this.windOff[i] = v;
    }
  }

  /** Draw the frame's wisps for `wd` (systems/windDrive.js's answer):
   *  nothing when the deck is unknown. Advances the travel first. */
  draw(wd, proj, view, eye, timeSeconds) {
    this.drawn = 0;
    if (!wd?.on) return;
    this.advance(wd.step);
    const count = wispCount(wd.strength01, this.look);
    if (count <= 0) return;
    const gl = this.gl, U = this.u, look = this.look;
    mat4Multiply(this._vp, proj, view);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(U.uVP, false, this._vp);
    gl.uniform3fv(U.uEye, eye);
    gl.uniform1f(U.uTime, timeSeconds);
    gl.uniform1f(U.uBox, look.box);
    gl.uniform1f(U.uStrength, wd.strength01);
    gl.uniform2f(U.uLen, look.len[0], look.len[1]); gl.uniform3fv(U.uColor, look.color); gl.uniform2f(U.uAlpha, look.alpha[0], look.alpha[1]);   // WEATHER2d: the look
    gl.uniform1f(U.uCurl, look.curl ?? 0);   // WIND5
    gl.uniform2f(U.uWindV, wd.windV[0], wd.windV[1]);
    gl.uniform2fv(U.uWindOff, this.windOff);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, this.verts, count);   // WIND5: the ribbon's vertices
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    this.drawn = count;
  }
}
