// @ts-check
// GHOSTFENCE (bible/03-World/Red-Mountain.md, The Ghostfence): the fence's ghost-light - its curtain shimmering between
// the pylons and a halo about each orb - drawn by the far ring after the volcano's fire, in its two lenses (the world's
// near, its own past the world's far plane, where the cone hides it: redMountainFire.js `hidden`). It stands on the
// ground each layer draws: a built pixel's own feet (noteFenceFeet, the pixel build's), the middle ring's kernel eased as
// it eases, the far ring's centres. Not a DFU member. Ledger A (GHOSTFENCE).
import { buildProgram } from './glProgram.js';
import { perspective, mirrorProjectionX } from '../world/mat4.js';
import { TERRAIN_SIZE } from '../world/terrain/terrainSampler.js';
import { BAY_H } from '../world/tamriel/tamrielFrame.js';
import { ghostfencePanel, sampleToPixel, GHOSTFENCE_DIALS } from '../world/tamriel/ghostfence.js';
import { PYLON, CURTAIN, GHOSTGATE } from '../world/tamriel/ghostfenceModel.js';
import { FIRE_GLSL } from './redMountainFire.js';

const SAMPLE_M = TERRAIN_SIZE / 128;
const f1 = (v) => Number(v).toFixed(5);
const v3 = (a) => `vec3(${a.map(f1).join(', ')})`;

/** THE GLOW'S DIALS (metres, seconds, linear colours): its colour, how bright the curtain and a halo burn at night and
 *  the share of that a full day leaves, a halo's radius, the least it is drawn at (pixels) and the least share of its
 *  light it keeps drawn wider, the curtain's fade (its start and end, metres from the eye) and the halos' end, its
 *  motion's period, how far it is drawn at all, and the depth under the cone's profile a point may lie unhidden. */
export const GLOW = Object.freeze({
  ghost: Object.freeze([0.5, 1.0, 0.82]), curtain: 0.55, halo: 1.4, dayGlow: 0.3,
  haloR: 3.2, haloPx: 2.5, haloFloor: 0.3, fade: Object.freeze([4000, 12000, 45000]), period: 40, reach: 60000, margin: 250,
});

/** `?fenceglow=off` - the fence's glow not drawn (its pylons stand). */
export function fenceGlowDisabled(search = globalThis.location?.search) {
  try { return /[?&]fenceglow=off\b/.test(search ?? ''); }
  catch { return false; }
}

// ── THE FEET THE PIXEL BUILD STOOD ────────────────────────────────

const _feet = new Map();
let _feetStamp = 0;
/** A built pixel's pylons' feet (scenes/ghostfenceBuild.js): their indices and the heights they stand at (world units,
 *  the pixel's own ground). Read while the far ring holds the pixel built; a rebuild notes them again. */
export function noteFenceFeet(pkey, idx, seats) { _feet.set(pkey, { idx, seats }); _feetStamp++; }
/** The feet noted, and a stamp that moves when any is. */
export const fenceFeet = () => ({ map: _feet, stamp: _feetStamp });

/**
 * WHERE EACH PYLON'S FOOT STANDS on the ground the views draw (world units): `fine` a built pixel's noted foot, else the
 * middle ring's kernel (`kind` 1: eased onto `coarse` as that ring eases), else the far ring's; `coarse` the far ring's. Pure.
 * @param {import('../world/tamriel/ghostfence.js').GhostfenceFrame} frame
 * @param {{ feet?: { map: Map<string, { idx: number[], seats: ArrayLike<number> }> } | null, built?: { has(k: string): boolean } | null,
 *   mid?: { heights: ArrayLike<number>, baseX: number, baseY: number, radius: number, sub: number } | null,
 *   ring?: { baseX: number, baseY: number, radius: number, side: number, positions: ArrayLike<number>, ground?: ArrayLike<number> | null } | null }} layers
 */
export function fenceGround(frame, { feet = null, built = null, mid = null, ring = null }) {
  const n = frame.n, fine = new Float32Array(n), coarse = new Float32Array(n), kind = new Uint8Array(n);
  const exact = new Map();
  if (feet && built) for (const [k, v] of feet.map) if (built.has(k)) v.idx.forEach((i, j) => exact.set(i, v.seats[j]));
  const ringAt = (bx, by) => {
    if (!ring) return null;
    const fi = bx - 0.5 - ring.baseX + ring.radius, fj = by - 0.5 - ring.baseY + ring.radius;
    const i = Math.floor(fi), j = Math.floor(fj);
    if (i < 0 || j < 0 || i + 1 >= ring.side || j + 1 >= ring.side) return null;
    const h = (a, b) => (ring.ground ? ring.ground[b * ring.side + a] : ring.positions[(b * ring.side + a) * 3 + 1]);
    const u = fi - i, v = fj - j;
    return (h(i, j) * (1 - u) + h(i + 1, j) * u) * (1 - v) + (h(i, j + 1) * (1 - u) + h(i + 1, j + 1) * u) * v;
  };
  const midAt = (bx, by) => {
    if (!mid) return null;
    const side = (2 * mid.radius + 1) * mid.sub + 1, cell = TERRAIN_SIZE / mid.sub;
    const gx = ((bx - mid.baseX) * TERRAIN_SIZE) / cell + mid.radius * mid.sub, gz = ((mid.baseY + 1 - by) * TERRAIN_SIZE) / cell + mid.radius * mid.sub;
    const i = Math.floor(gx), j = Math.floor(gz);
    if (i < 0 || j < 0 || i + 1 >= side || j + 1 >= side) return null;
    const H = mid.heights, u = gx - i, v = gz - j, at = (a, b) => H[b * side + a];
    return (at(i, j) * (1 - u) + at(i + 1, j) * u) * (1 - v) + (at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u) * v;
  };
  for (let i = 0; i < n; i++) {
    const gx = frame.pts[2 * i], gy = frame.pts[2 * i + 1], bx = gx / 128, by = BAY_H + 1 - gy / 128;
    const c = ringAt(bx, by), m = exact.has(i) ? null : midAt(bx, by);
    coarse[i] = c ?? 0;
    if (exact.has(i)) fine[i] = /** @type {number} */ (exact.get(i));
    else if (m !== null) { fine[i] = m; kind[i] = 1; }
    else fine[i] = coarse[i];
  }
  return { fine, coarse, kind };
}

/**
 * THE GLOW'S MESHES in the frame of the pixel under the volcano's centre (x east, z north from its south-west corner):
 * the curtain - a quad a run of the fence, (x, z) and (metres along it, 0 foot .. 1 top) a corner, and the pylon whose
 * foot it stands on - and a halo a pylon's orb (Ghostgate's two on its towers): its centre, its corner, its lift over the
 * foot and its pylon. Pure.
 * @param {import('../world/tamriel/ghostfence.js').GhostfenceFrame} frame
 */
export function glowMeshes(frame) {
  const [px, py] = sampleToPixel(frame.cx, frame.cy), ox = px * 128, oy = (BAY_H - py) * 128;
  const local = (gx, gy) => [(gx - ox) * SAMPLE_M, (gy - oy) * SAMPLE_M];
  const n = frame.n, curtain = [], curtainOf = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, [a, b] = ghostfencePanel(frame, i), [ax, az] = local(a[0], a[1]), [bx, bz] = local(b[0], b[1]);
    const sa = i * GHOSTFENCE_DIALS.spacing, sb = sa + GHOSTFENCE_DIALS.spacing;
    for (const [x, z, s, v, k] of [[ax, az, sa, 0, i], [bx, bz, sb, 0, j], [bx, bz, sb, 1, j], [ax, az, sa, 0, i], [bx, bz, sb, 1, j], [ax, az, sa, 1, i]]) { curtain.push(x, z, s, v); curtainOf.push(k); }
  }
  const halo = [], haloOf = [], corners = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
  const orb = (gx, gy, lift, k) => { const [x, z] = local(gx, gy); for (const [cx, cy] of corners) { halo.push(x, z, cx, cy, lift); haloOf.push(k); } };
  const gateLift = GHOSTGATE.height + GHOSTGATE.cornice + GHOSTGATE.top[2] + GHOSTGATE.orb.over, mid = (GHOSTGATE.passage + GHOSTGATE.half) / 2 / SAMPLE_M;
  for (let i = 0; i < n; i++) {
    const gx = frame.pts[2 * i], gy = frame.pts[2 * i + 1];
    if (i !== frame.gate) { orb(gx, gy, PYLON.orb.at, i); continue; }
    for (const s of [-1, 1]) orb(gx + s * frame.tan[2 * i] * mid, gy + s * frame.tan[2 * i + 1] * mid, gateLift, i);
  }
  return { px, py, curtain: new Float32Array(curtain), curtainOf: Int32Array.from(curtainOf), halo: new Float32Array(halo), haloOf: Int32Array.from(haloOf) };
}

const COMMON = `uniform mat4 uVP;
uniform vec3 uOrigin;
uniform vec3 uMorph;      // the middle ring's ease: its band (metres, Chebyshev from uMorphFrom) and 1 to ease
uniform vec3 uMorphFrom;
float footOf(vec3 h, vec2 xz) {
  if (h.z > 0.5 && uMorph.z > 0.5) { vec2 d = abs(xz - uMorphFrom.xz); return mix(h.x, h.y, smoothstep(uMorph.x, uMorph.y, max(d.x, d.y))); }
  return h.x;
}
`;
const { HEAD, HIDE, NOISE, HAZE } = FIRE_GLSL;
/** How bright the glow burns by the frame's light: all of it at night, GLOW.dayGlow of it at full day. */
const NIGHT = `float nightOf(float light) { return 1.0 - ${f1(1 - GLOW.dayGlow)} * clamp(light, 0.0, 1.0); }
`;

export const FENCE_CURTAIN_VS = HEAD + `layout(location = 0) in vec4 aCorner;   // x, z; metres along the fence; 0 foot, 1 top
layout(location = 1) in vec3 aFoot;     // fine, coarse, eased
${COMMON}out vec2 vSide;
out vec3 vWorld;
void main() {
  vec3 w = uOrigin + vec3(aCorner.x, 0.0, aCorner.y);
  w.y += footOf(aFoot, w.xz) + mix(${f1(CURTAIN.from)}, ${f1(CURTAIN.to)}, aCorner.w);
  vSide = aCorner.zw;
  vWorld = w;
  gl_Position = uVP * vec4(w, 1.0);
}`;

export const FENCE_CURTAIN_FS = HEAD + `in vec2 vSide;
in vec3 vWorld;
uniform float uTime;
uniform float uLight;
${HIDE}${HAZE}${NIGHT}out vec4 o;
${NOISE}void main() {
  float d = distance(vWorld, uEye), fade = 1.0 - smoothstep(${f1(GLOW.fade[0])}, ${f1(GLOW.fade[1])}, d);
  if (fade <= 0.0 || hidden(vWorld, ${f1(GLOW.margin)})) discard;   // the fade's test first: the walk is the dear part
  // strands of the ancestors' light climbing the curtain, thickest low, gone at its top
  float y = vSide.y, rise = flow(vec2(vSide.x / 7.0, y * 2.4), vec2(0.0, 1.6), uTime);
  float strands = 0.5 + 0.5 * sin(vSide.x * 0.8 + rise * 6.0);
  float body = smoothstep(0.08, 0.35, y) * (1.0 - smoothstep(0.7, 1.0, y));
  float a = body * (0.2 + 0.8 * smoothstep(0.3, 0.8, rise)) * mix(0.55, 1.0, strands);
  o = vec4(${v3(GLOW.ghost)} * (a * ${f1(GLOW.curtain)} * nightOf(uLight) * fade * (1.0 - hazeAt(d))), 0.0);
}`;

export const FENCE_HALO_VS = HEAD + `layout(location = 0) in vec4 aCorner;   // x, z; the quad's corner
layout(location = 1) in float aLift;
layout(location = 2) in vec3 aFoot;
${COMMON}uniform vec3 uRight;
uniform vec3 uUp;
uniform vec3 uEye;
uniform float uPx;   // a pixel's angle (radians)
out vec2 vCorner;
out vec3 vWorld;
out float vShare;   // its own light's share once it is drawn wider than itself (its neighbours' halos overlap it)
void main() {
  vec3 c = uOrigin + vec3(aCorner.x, 0.0, aCorner.y);
  c.y += footOf(aFoot, c.xz) + aLift;
  float r = max(${f1(GLOW.haloR)}, distance(c, uEye) * uPx * ${f1(GLOW.haloPx)});
  vShare = clamp(${f1(GLOW.haloR * 1.8)} / r, ${f1(GLOW.haloFloor)}, 1.0);
  vCorner = aCorner.zw;
  vWorld = c;
  gl_Position = uVP * vec4(c + (uRight * aCorner.z + uUp * aCorner.w) * r, 1.0);
}`;

export const FENCE_HALO_FS = HEAD + `in vec2 vCorner;
in vec3 vWorld;
in float vShare;
uniform float uLight;
${HIDE}${HAZE}${NIGHT}out vec4 o;
void main() {
  float q = dot(vCorner, vCorner), d = distance(vWorld, uEye), fade = 1.0 - smoothstep(${f1(GLOW.fade[1])}, ${f1(GLOW.fade[2])}, d);
  if (q >= 1.0 || fade <= 0.0 || hidden(vWorld, ${f1(GLOW.margin)})) discard;
  float a = (1.0 - q) * (1.0 - q) * vShare;
  o = vec4(${v3(GLOW.ghost)} * (a * ${f1(GLOW.halo)} * nightOf(uLight) * fade * (1.0 - hazeAt(d))), 0.0);
}`;

/** FIRST-USE: the glow's two programs, as its constructor builds them. */
export const GLOW_PROGRAMS = /** @type {ReadonlyArray<readonly [string, string]>} */ (Object.freeze([[FENCE_CURTAIN_VS, FENCE_CURTAIN_FS], [FENCE_HALO_VS, FENCE_HALO_FS]]));

function mat4Multiply(out, a, b) {
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return out;
}

/** The Ghostfence's glow: its curtain and its halos, drawn by the far ring (render/farRing.js) after the fire. */
export class GhostfenceGlow {
  /** @param {WebGL2RenderingContext} gl */
  constructor(gl) {
    this.gl = gl;
    this.curtainProgram = buildProgram(gl, FENCE_CURTAIN_VS, FENCE_CURTAIN_FS, 'ghostfence curtain');
    this.haloProgram = buildProgram(gl, FENCE_HALO_VS, FENCE_HALO_FS, 'ghostfence halo');
    const names = ['uVP', 'uOrigin', 'uMorph', 'uMorphFrom', 'uEye', 'uTime', 'uLight', 'uCone', 'uProf', 'uFogColor', 'uHaze', 'uRight', 'uUp', 'uPx'];
    const locs = (p) => Object.fromEntries(names.map((k) => [k, gl.getUniformLocation(p, k)]));
    this.cu = locs(this.curtainProgram);
    this.hu = locs(this.haloProgram);
    this.mesh = null; this._frame = null; this._groundKey = null;
    this._vp = new Float32Array(16); this._origin = new Float32Array(3);
    this._lensKey = ''; this._lens = null;
    this._bufs = []; this._vaos = [];
    this.drawn = 0;
  }

  /** The meshes for the fence's frame, built when it moves (the trace landing, a fit). */
  update(frame) {
    if (!frame) { this.mesh = null; this._frame = null; return; }
    if (frame === this._frame) return;
    this._frame = frame; this._groundKey = null;
    this._free();
    const gl = this.gl, m = glowMeshes(frame);
    const buffer = (data, usage) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, usage); this._bufs.push(b); return b; };
    const vao = () => { const v = gl.createVertexArray(); gl.bindVertexArray(v); this._vaos.push(v); return v; };
    this.curtainVao = vao();
    buffer(m.curtain, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0);
    this.curtainFoot = buffer(new Float32Array(m.curtainOf.length * 3), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 12, 0);
    this.haloVao = vao();
    buffer(m.halo, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 20, 16);
    this.haloFoot = buffer(new Float32Array(m.haloOf.length * 3), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 12, 0);
    gl.bindVertexArray(null);
    this.mesh = m;
  }

  /** The feet laid again when any layer under them moved (a pixel built or let go, a ring laid round a new base). */
  _feetFor(ground) {
    const key = [ground.feet?.stamp, ground.built?.changes ?? ground.built?.size, ground.mid, ground.ring];
    if (this._groundKey && key.every((k, i) => k === this._groundKey[i])) return;
    this._groundKey = key;
    const gl = this.gl, m = /** @type {any} */ (this.mesh), g = fenceGround(/** @type {any} */ (this._frame), ground);
    const fill = (of, buf) => {
      const out = new Float32Array(of.length * 3);
      for (let v = 0; v < of.length; v++) { const k = of[v]; out[3 * v] = g.fine[k]; out[3 * v + 1] = g.coarse[k]; out[3 * v + 2] = g.kind[k]; }
      gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, out, gl.DYNAMIC_DRAW);
    };
    fill(m.curtainOf, this.curtainFoot);
    fill(m.haloOf, this.haloFoot);
  }

  /**
   * Draw the glow in the far ring's pass, after the fire - fire.draw's arguments, and `cone` the fire's (coneIn: null with
   * none - nothing hides it), `profile` its, `ground` the layers its feet stand on (fenceGround's) and `morph` the middle
   * ring's ease ({ from, start, end }).
   */
  draw({ ringOrigin, baseX, baseY, view, worldProj, fovY, aspect, far, eye, fog, rim, hold, light, seconds, cone, profile, ground, morph }) {
    this.drawn = 0;
    const m = this.mesh;
    if (!m || !eye || !worldProj || !ground?.ring) return;
    const gl = this.gl, o = this._origin;
    o[0] = ringOrigin[0] + (m.px - baseX) * TERRAIN_SIZE; o[1] = ringOrigin[1]; o[2] = ringOrigin[2] - (m.py - baseY) * TERRAIN_SIZE;
    const f = /** @type {any} */ (this._frame), cx = o[0] + (f.cx - m.px * 128) * SAMPLE_M, cz = o[2] + (f.cy - (BAY_H - m.py) * 128) * SAMPLE_M;
    if (Math.hypot(eye[0] - cx, eye[2] - cz) > GLOW.reach) return;
    this._feetFor(ground);
    const worldFar = worldProj[14] / (worldProj[10] + 1);
    const key = `${fovY},${aspect},${far},${worldFar}`;
    if (key !== this._lensKey) { this._lens = mirrorProjectionX(perspective(fovY, aspect, worldFar * 0.98, far)); this._lensKey = key; }
    const t = ((seconds % GLOW.period) + GLOW.period) % GLOW.period / GLOW.period;
    const px = (2 * Math.tan(fovY / 2)) / Math.max(1, gl.drawingBufferHeight);
    gl.depthMask(false);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    for (const pass of ['far', 'near']) {
      const isFar = pass === 'far';
      mat4Multiply(this._vp, isFar ? /** @type {Float32Array} */ (this._lens) : worldProj, view);
      gl.depthRange(isFar ? 1 : 0, 1);
      const set = (U) => {
        gl.uniformMatrix4fv(U.uVP, false, this._vp);
        gl.uniform3fv(U.uOrigin, o);
        gl.uniform3f(U.uMorph, morph?.start ?? 0, morph?.end ?? 0, morph?.from && ground.mid ? 1 : 0);
        if (morph?.from) gl.uniform3f(U.uMorphFrom, morph.from[0], morph.from[1], morph.from[2]);
        gl.uniform3fv(U.uEye, eye);
        gl.uniform1f(U.uTime, t);
        gl.uniform1f(U.uLight, Math.max(0, Math.min(1, light)));
        gl.uniform4f(U.uCone, cone?.[0] ?? 0, cone?.[1] ?? 0, cone?.[2] ?? 0, isFar && cone && profile ? 1 : 0);
        if (profile) gl.uniform1fv(U.uProf, profile);
        gl.uniform3fv(U.uFogColor, fog.color);
        gl.uniform4fv(U.uHaze, isFar ? [rim[0], rim[1], hold, 1] : [fog.start, fog.end, 1, 0]);
      };
      gl.useProgram(this.curtainProgram);
      set(this.cu);
      gl.bindVertexArray(this.curtainVao);
      gl.drawArrays(gl.TRIANGLES, 0, m.curtainOf.length);
      gl.useProgram(this.haloProgram);
      set(this.hu);
      gl.uniform3f(this.hu.uRight, view[0], view[4], view[8]);
      gl.uniform3f(this.hu.uUp, view[1], view[5], view[9]);
      gl.uniform1f(this.hu.uPx, px);
      gl.bindVertexArray(this.haloVao);
      gl.drawArrays(gl.TRIANGLES, 0, m.haloOf.length);
      this.drawn++;
    }
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
    gl.depthRange(0, 1);
  }

  _free() {
    const gl = this.gl;
    for (const b of this._bufs) gl.deleteBuffer(b);
    for (const v of this._vaos) gl.deleteVertexArray(v);
    this._bufs = []; this._vaos = [];
  }

  /** Free the GL objects (every allocation has an owner: the far ring's dispose). */
  dispose() {
    this._free();
    this.gl.deleteProgram(this.curtainProgram); this.gl.deleteProgram(this.haloProgram);
    this.mesh = null; this._frame = null;
  }
}

