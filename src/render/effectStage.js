// @ts-check
// STOREFRONT (2026-10-29; bible/06-Systems/Storefront.md section 9, PROFILE-SLOTS): THE EFFECTS TRIED ON - a kill effect
// or a portal skin played on the character's stage (render/characterStage.js), as the world plays them: the kill's
// burst by the world's own simulation and pass (render/killFx.js) with the body burning away in its colour and coming
// back; the portal's frames and the pieces about it (scenes/portalSkins.js) opening, holding and sealing behind the
// body with their bursts. Each turns on a loop while it is tried on. Its own GL objects on the stage's context, let go
// with it. Not a DFU member.
import { KillFx, KillFxPass, KFX_GHOST_S, KILL_FX_EDGE } from './killFx.js';
import { portalSkinOf, dressPlace } from '../scenes/portalSkins.js';
import { portalFrame, portalOpenAt, portalLife, PORTAL_SIZE, PORTAL_MS, PORTAL_FRAMES, PORTAL_FPS } from '../scenes/portalFx.js';

/** A kill tried on, its loop (s): the body burns (KFX_GHOST_S), stays gone to `back`, gathers again by `whole`. */
export const STAGE_KILL_S = Object.freeze({ back: 2.3, whole: 2.8, cycle: 3.6 });
/** A portal tried on: how long it holds open (ms), and the pause before it opens again (ms). */
export const STAGE_PORTAL_MS = Object.freeze({ hold: 2800, pause: 700 });
/** How far behind the body the portal stands (m, away from the eye). */
export const STAGE_PORTAL_BACK = 0.7;
/** The stage's portal faces away from its eye (render/killFx.js `dir`): the camera looks down -Z. */
export const STAGE_FACING = Object.freeze([0, -1]);
/** Where a loop stands still for less motion (s into it): a kill's body whole again, a portal wide open. */
export const stageHoldS = (/** @type {string|null} */ slot) => (slot === 'portal' ? (PORTAL_MS.open + STAGE_PORTAL_MS.hold / 2) / 1000 : STAGE_KILL_S.whole);
/** The tallest a piece stands (the Daedric Stone's arch, m) - the portal is drawn smaller where the frame is shorter. */
export const STAGE_PORTAL_TOP = 3.35;

/** The body's share burned `t` s into a kill's loop of look `look` (0 whole .. 1 gone). Pure. */
export function stageKillShare(/** @type {string} */ look, /** @type {number} */ t) {
  const ghost = KFX_GHOST_S[/** @type {keyof typeof KFX_GHOST_S} */ (look)] ?? 0.8;
  if (t <= 0) return 0;
  if (t < ghost) { const u = t / ghost; return u * u * (3 - 2 * u); }
  if (t < STAGE_KILL_S.back) return 1;
  if (t < STAGE_KILL_S.whole) { const u = (t - STAGE_KILL_S.back) / (STAGE_KILL_S.whole - STAGE_KILL_S.back); return 1 - u * u * (3 - 2 * u); }
  return 0;
}

/** The highest world height on the screen's top edge (NDC y = 0.97) over the stage's middle at depth `z`, by the
 *  frame's view-projection `vp` - the room a portal has. Pure. */
export function stageTopAt(/** @type {ArrayLike<number>} */ vp, /** @type {number} */ z) {
  const b = vp[13] + vp[9] * z, d = vp[15] + vp[11] * z, a = vp[5], c = vp[7];
  const den = a - 0.97 * c;
  return Math.abs(den) > 1e-9 ? (0.97 * d - b) / den : STAGE_PORTAL_TOP;
}

const CARD_VS = `#version 300 es
layout(location = 0) in vec2 aC;
uniform mat4 uVP; uniform vec3 uAt; uniform vec3 uRight; uniform vec2 uSize;
out vec2 vUv;
void main() { vUv = aC; gl_Position = uVP * vec4(uAt + uRight * ((aC.x - 0.5) * uSize.x) + vec3(0.0, aC.y * uSize.y, 0.0), 1.0); }`;
const CARD_FS = `#version 300 es
precision highp float;
in vec2 vUv; uniform sampler2D uTex; uniform float uAlpha; out vec4 o;
void main() { vec4 c = texture(uTex, vUv); if (c.a < 0.02) discard; o = vec4(c.rgb, c.a * uAlpha); }`;

/**
 * The stage's effects on `gl`: `set(slot, key)` tries one on ('kill' or 'portal', `key` its look; a portal's null the
 * violet vortex; any other slot nothing), `step(dt, height)` runs it, `burn()` the body's dissolve now (null for none),
 * `drawBehind(vp, right)` the portal before the body, `drawFront(proj, view, eye)` the bursts after it. Under less
 * motion (`reduced`: read each frame, or fixed) it plays once to its hold (stageHoldS) and stands still.
 * @param {WebGL2RenderingContext} gl
 * @param {{ reduced?: boolean | (() => boolean), onCue?: (slot: string, key: string|null) => void }} [o] `onCue` each loop's start (its sound)
 */
export function createEffectStage(gl, { reduced = /** @type {boolean | (() => boolean)} */ (false), onCue = () => {} } = {}) {
  const still = typeof reduced === 'function' ? reduced : () => !!reduced;
  let sim = /** @type {KillFx|null} */ (null), pass = /** @type {KillFxPass|null} */ (null);
  try { sim = new KillFx({ reduced: still }); pass = new KillFxPass(gl); } catch { sim = null; pass = null; }
  const compile = (/** @type {number} */ type, /** @type {string} */ src) => { const s = /** @type {WebGLShader} */ (gl.createShader(type)); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = /** @type {WebGLProgram} */ (gl.createProgram());
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, CARD_VS)); gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, CARD_FS)); gl.linkProgram(prog);
  const cardOk = !!gl.getProgramParameter(prog, gl.LINK_STATUS);
  const U = Object.fromEntries(['uVP', 'uAt', 'uRight', 'uSize', 'uTex', 'uAlpha'].map((n) => [n, gl.getUniformLocation(prog, n)]));
  const vao = gl.createVertexArray(), buf = gl.createBuffer();
  gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
  gl.bindVertexArray(null);
  /** @type {Map<string, WebGLTexture>} each frame's picture, by `archive/record` */
  const tex = new Map();
  const upload = (/** @type {string} */ id, /** @type {{ width: number, height: number, colors: ArrayLike<number> & { buffer: ArrayBufferLike, byteOffset: number } }} */ pic) => {
    const t = /** @type {WebGLTexture} */ (gl.createTexture());
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, pic.width, pic.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(pic.colors.buffer, pic.colors.byteOffset, pic.width * pic.height * 4));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    tex.set(id, t);
  };
  /** The frames a skin draws (its vortex and its pieces'), made the first time it is tried on. */
  function ensureArt(/** @type {string|null} */ skin) {
    const look = portalSkinOf(skin);
    if (!look) { if (!tex.has('violet/0')) for (let k = 0; k < PORTAL_FRAMES; k++) upload(`violet/${k}`, portalFrame(k)); return; }
    if (tex.has(`${look.archive}/0`)) return;
    for (let k = 0; k < look.frames; k++) upload(`${look.archive}/${k}`, look.paint(k, look.frames, look.tex.w, look.tex.h));
    for (const d of look.dress) for (let k = 0; k < d.frames; k++) upload(`${d.archive}/${k}`, d.paint(k, d.frames, d.tex.w, d.tex.h));
  }

  let slot = /** @type {string|null} */ (null), key = /** @type {string|null} */ (null), t = 0, cycleAt = -1, breath = 0, height = 1.8;
  const at = [0, 0, -STAGE_PORTAL_BACK];
  const cycleS = () => (slot === 'portal' ? (portalLife({ holdMs: STAGE_PORTAL_MS.hold }) + STAGE_PORTAL_MS.pause) / 1000 : STAGE_KILL_S.cycle);
  function cue() {
    breath = 0;
    if (slot === 'kill' && key) sim?.start(key, [0, 0, 0], { h: height * 1.02, w: height * 0.45 });
    else if (slot === 'portal') { const look = portalSkinOf(key); if (look) sim?.start(look.open, [at[0], 0.05, at[2]], { h: PORTAL_SIZE.h, w: PORTAL_SIZE.w, dir: STAGE_FACING }); }
    onCue(/** @type {string} */ (slot), key);
  }
  return {
    set(/** @type {string|null} */ s, /** @type {string|null} */ k) {
      const next = s === 'kill' && k ? 'kill' : s === 'portal' ? 'portal' : null;
      if (next === slot && k === key) return;
      slot = next; key = next ? k ?? null : null; t = 0; cycleAt = -1;
      sim?.clear();
      if (slot === 'portal') ensureArt(key);
    },
    /** One frame: `h` the body's height (m), the kill's measure. */
    step(/** @type {number} */ dt, /** @type {number} */ h) {
      if (Number.isFinite(h) && h > 0.5) height = h;
      const d = Math.min(0.05, Math.max(0, Number.isFinite(dt) ? dt : 0));
      sim?.step(d);
      if (!slot) return;
      const loop = cycleS(), calm = still();
      if (calm) { const holdAt = Math.floor(t / loop) * loop + stageHoldS(slot); t = Math.min(t + d, holdAt); }   // this loop to its hold, and no further
      else t += d;
      const n = Math.floor(t / loop);
      if (n !== cycleAt) { cycleAt = n; cue(); }
      const look = slot === 'portal' ? portalSkinOf(key) : null;
      if (look?.ambient && !calm) {
        const age = (t % loop) * 1000, { open: o } = portalOpenAt(age, { holdMs: STAGE_PORTAL_MS.hold });
        breath += d;
        if (o > 0.8 && breath >= look.ambient.every) { breath = 0; sim?.start(look.ambient.recipe, [at[0], 0.05, at[2]], { h: PORTAL_SIZE.h, w: PORTAL_SIZE.w, dir: STAGE_FACING }); }
      }
    },
    /** The body's burn now - `[share, r, g, b]`, the edge's colour - or null while it stands whole. */
    burn() {
      if (slot !== 'kill' || !key) return null;
      const share = stageKillShare(key, t % STAGE_KILL_S.cycle);
      const e = KILL_FX_EDGE[/** @type {keyof typeof KILL_FX_EDGE} */ (key)] ?? [1, 0.6, 0.3];
      return share > 0 ? [share, e[0], e[1], e[2]] : null;
    },
    /** The portal and its pieces, behind the body - blended over the floor, never writing depth. */
    drawBehind(/** @type {Float32Array} */ vp, /** @type {number[]} */ right) {
      if (slot !== 'portal' || !cardOk) return;
      const look = portalSkinOf(key), age = (t % cycleS()) * 1000;
      const { open: k, done } = portalOpenAt(age, { holdMs: STAGE_PORTAL_MS.hold });
      if (done || k <= 0) return;
      const fit = Math.max(0.45, Math.min(1, stageTopAt(vp, at[2]) / (look?.dress.length ? STAGE_PORTAL_TOP : PORTAL_SIZE.h + 0.2)));
      gl.useProgram(prog);
      gl.uniformMatrix4fv(U.uVP, false, vp); gl.uniform1i(U.uTex, 0);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.enable(gl.DEPTH_TEST); gl.depthMask(false);
      gl.bindVertexArray(vao); gl.activeTexture(gl.TEXTURE0);
      const card = (/** @type {string} */ id, /** @type {number[]} */ p, /** @type {number} */ w, /** @type {number} */ h, /** @type {number} */ a) => {
        const tx = tex.get(id);
        if (!tx || !(Math.abs(w) > 1e-4) || !(h > 1e-4)) return;
        gl.bindTexture(gl.TEXTURE_2D, tx);
        gl.uniform3f(U.uAt, p[0], p[1], p[2]); gl.uniform3f(U.uRight, right[0], right[1], right[2]); gl.uniform2f(U.uSize, w, h); gl.uniform1f(U.uAlpha, a);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      };
      const W = PORTAL_SIZE.w * fit, H = PORTAL_SIZE.h * fit;
      const w = W * Math.max(0.04, Math.min(1, k * 1.25 - 0.1)), hgt = H * Math.max(0.12, Math.min(1.06, 0.35 + k * 0.7));
      const closing = age > portalLife({ holdMs: STAGE_PORTAL_MS.hold }) - PORTAL_MS.close;
      const mid = [at[0], H * 0.5, at[2]];
      const pieces = [];
      for (const d of look?.dress ?? []) for (let i = 0; i < d.count; i++) {
        const pl = dressPlace(d, i, age / 1000, k, d.place === 'arch' ? [mid[0], mid[1], mid[2] - 0.08] : mid, right, closing);
        const sc = pl.scale * fit, fr = Math.floor((age / 1000 + (i * 0.37) % 1) * d.fps) % d.frames;
        const foot = [mid[0] + (pl.at[0] - mid[0]) * fit, mid[1] + (pl.at[1] - mid[1]) * fit, mid[2] + (pl.at[2] - mid[2]) * fit];   // `mid` is fitted already: the fit once
        pieces.push({ id: `${d.archive}/${fr}`, p: foot, w: d.size.w * sc * (pl.spin < 0 ? -1 : 1), h: d.size.h * sc, a: Math.min(1, pl.scale * 1.2), back: d.place === 'arch' });
      }
      for (const q of pieces) if (q.back) card(q.id, q.p, q.w, q.h, q.a);   // the arch stands behind its vortex
      const rec = look ? `${look.archive}/${Math.floor((age / 1000) * look.fps) % look.frames}` : `violet/${Math.floor((age / 1000) * PORTAL_FPS) % PORTAL_FRAMES}`;
      card(rec, [at[0], (H - hgt) * 0.5, at[2]], w, hgt, Math.min(1, k * 1.15));
      for (const q of pieces) if (!q.back) card(q.id, q.p, q.w, q.h, q.a);
      gl.bindVertexArray(null); gl.disable(gl.BLEND); gl.depthMask(true);
    },
    /** The bursts, over the body and through it (the stage's depth). */
    drawFront(/** @type {Float32Array} */ proj, /** @type {Float32Array} */ view, /** @type {number[]} */ eye) {
      if (!sim || !pass || !sim.live || !sim.build()) return;
      pass.draw(sim, proj, view, eye, null);
      gl.disable(gl.CULL_FACE);   // the stage draws both faces
    },
    /** What is tried on now (a probe's, a test's). */
    state: () => ({ slot, key, t }),
    destroy() {
      for (const t2 of tex.values()) gl.deleteTexture(t2);
      tex.clear();
      gl.deleteBuffer(buf); gl.deleteVertexArray(vao); gl.deleteProgram(prog);
      pass?.destroy();
    },
  };
}
