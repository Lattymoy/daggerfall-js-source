// @ts-check
// DRUNK2 (2026-10-17, asked for: "I want more of a beer goggle effect at higher levels"). THE BEER GOGGLES: the frame,
// as a drink well past the Drunk line sees it - soft, doubled, warm and glowing. A post pass over the RESOLVED frame:
// the world, the weapon and the blood as they stand on the canvas when the HUD's draw begins (hud.js drawHud, the one
// host-agnostic call, through survival/drunkFeel.js drawLens), so the bars, the compass and every window painted
// after it stay sharp.
//
// THE PASS: renderer.resolveFrame() (the air pass's resolve - the frame on the canvas now), endWorldPass and endUiRun
// (the full canvas, the baseline), then `copyTexSubImage2D` of the canvas into a texture of its size and one
// full-screen triangle back over it through the shader below, opaque, depth and culling off; then the baseline back
// and markForeignPass (EV6: a pass outside the renderer's own entry points says so). Nothing runs sober: the caller
// asks only with a strength past zero.
//
// THE SHADER, at `uK` (0..1, drunkFeel.js gogglesAt):
//   - a slow wave through the picture (a few thousandths of the screen);
//   - DOUBLE VISION: the picture blended with itself offset to one side, the gap breathing with the clock;
//   - a soft blur (an eight-tap ring a few pixels wide, scaled by uK);
//   - THE GOGGLES: highlights bloom warm, colour saturates, the whole leans amber.

import { buildProgram } from './glProgram.js';

/** At full strength: the wave (share of the screen), the ghost's gap (share of the width; and of the height), how much
 *  of the ghost is seen, the blur's ring (pixels), the glow, the saturation added and the warm tint. */
export const GOGGLES = Object.freeze({
  wave: 0.004,
  ghost: Object.freeze({ x: 0.018, y: 0.004, mix: 0.45 }),
  blurPx: 3,
  glow: 0.28,
  saturate: 0.35,
  warm: Object.freeze([1.08, 1.0, 0.86]),
});

const VS = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uFrame;
uniform vec2 uPx;      // one pixel, in uv
uniform vec4 uRect;    // the presented picture's place in the copy, in uv: offset (xy) and size (zw)
uniform float uK;      // the goggles' strength
uniform float uT;      // the clock (s)
uniform float uWave;
uniform vec3 uGhost;   // x, y gap (uv) and its mix
uniform float uBlurPx;
uniform float uGlow;
uniform float uSat;
uniform vec3 uWarm;
out vec4 outColor;
// a tap inside the picture only: a ghost or a blur reaching past its edge reads the edge, never a pillarbox's black
vec3 tap(vec2 uv) { return texture(uFrame, clamp(uRect.xy + uv * uRect.zw, uRect.xy + uPx * 0.5, uRect.xy + uRect.zw - uPx * 0.5)).rgb; }
vec3 soft(vec2 uv) {
  float r = uBlurPx * uK;
  vec3 c = tap(uv) * 2.0;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785398;
    c += tap(uv + vec2(cos(a), sin(a)) * r * uPx / uRect.zw);
  }
  return c / 10.0;
}
void main() {
  vec2 uv = vUv + uK * uWave * vec2(sin(uT * 1.3 + vUv.y * 9.0), cos(uT * 1.1 + vUv.x * 7.0));
  vec2 gap = uK * vec2(uGhost.x * (0.6 + 0.4 * sin(uT * 0.7)), uGhost.y * sin(uT * 0.9));
  vec3 c = mix(soft(uv), soft(uv + gap), uGhost.z * uK);
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  c += uK * uGlow * smoothstep(0.45, 1.0, lum) * vec3(1.0, 0.85, 0.6);
  c = mix(vec3(lum), c, 1.0 + uSat * uK);
  c *= mix(vec3(1.0), uWarm, uK);
  outColor = vec4(c, 1.0);
}`;

/** One renderer's goggles: its program, its copy and its empty VAO, made on the first strong enough frame. */
const _byGl = new WeakMap();
function stateFor(gl) {
  let s = _byGl.get(gl);
  // a lost and restored context keeps its `gl` but not what was made on it: made again, as on the first frame
  if (s && gl.isProgram(s.prog)) return s;
  const prog = buildProgram(gl, VS, FS, 'drunkGoggles');
  const u = (n) => gl.getUniformLocation(prog, n);
  s = {
    prog, vao: gl.createVertexArray(), tex: gl.createTexture(), w: 0, h: 0,
    loc: { frame: u('uFrame'), px: u('uPx'), rect: u('uRect'), k: u('uK'), t: u('uT'), wave: u('uWave'), ghost: u('uGhost'), blur: u('uBlurPx'), glow: u('uGlow'), sat: u('uSat'), warm: u('uWarm') },
  };
  _byGl.set(gl, s);
  return s;
}

/** EVERY ALLOCATION HAS AN OWNER: the CONTEXT owns them - one program, one frame-sized copy and one empty VAO a context,
 *  freed with it (render/glRelease.js loses every context as the page goes). This lets them go sooner, for a caller
 *  that wants the copy's memory back while the context lives on. */
export function releaseDrunkGoggles(gl) {
  const s = _byGl.get(gl);
  if (!s) return;
  _byGl.delete(gl);
  gl.deleteProgram(s.prog); gl.deleteTexture(s.tex); gl.deleteVertexArray(s.vao);
}

/**
 * The goggles over this frame at strength `k` (0..1) and clock `t` (s), over the presented picture's place `rect`
 * (canvas pixels from the top left, as the HUD lays out: retro mode's pillarbox puts the picture inside black bars, and
 * the pass reads and writes inside it alone - a ghost reaching past the picture's edge reads the edge, and the bars stay
 * black; AUDIT DRUNK2 (Sol's review)). Without a rect, the whole canvas. Answers whether it drew. A renderer with no GL
 * context (a test's stand-in) draws nothing.
 * @param {any} renderer
 * @param {number} k
 * @param {number} t
 * @param {{x: number, y: number, w: number, h: number} | null} [rect]
 */
export function drawDrunkGoggles(renderer, k, t, rect = null) {
  const gl = renderer?.gl;
  if (!(k > 0) || !gl || typeof gl.copyTexSubImage2D !== 'function') return false;
  // a lost context compiles nothing (a null log, the program "faulted") - and threw out of the HUD's draw every frame
  // until it came back; the frame goes undrunk instead (seen in a real run, the page closing)
  if (gl.isContextLost?.()) return false;
  renderer.resolveFrame?.();
  renderer.endWorldPass?.();
  renderer.endUiRun?.();
  const s = stateFor(gl);
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, s.tex);
  if (s.w !== w || s.h !== h) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    s.w = w; s.h = h;
  }
  gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, w, h);
  // the picture's place in GL's bottom-up pixels, inside the buffer
  const rx = Math.max(0, Math.min(w, Math.round(rect?.x ?? 0))), rw = Math.max(1, Math.min(w - rx, Math.round(rect?.w ?? w)));
  const rh0 = Math.round(rect?.h ?? h), ry = Math.max(0, Math.min(h, h - Math.round(rect?.y ?? 0) - rh0)), rh = Math.max(1, Math.min(h - ry, rh0));
  gl.viewport(rx, ry, rw, rh);
  gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
  gl.useProgram(s.prog);
  gl.bindVertexArray(s.vao);
  gl.uniform1i(s.loc.frame, 0);
  gl.uniform2f(s.loc.px, 1 / w, 1 / h);
  gl.uniform4f(s.loc.rect, rx / w, ry / h, rw / w, rh / h);
  gl.uniform1f(s.loc.k, Math.min(1, k));
  gl.uniform1f(s.loc.t, t);
  gl.uniform1f(s.loc.wave, GOGGLES.wave);
  gl.uniform3f(s.loc.ghost, GOGGLES.ghost.x, GOGGLES.ghost.y, GOGGLES.ghost.mix);
  gl.uniform1f(s.loc.blur, GOGGLES.blurPx);
  gl.uniform1f(s.loc.glow, GOGGLES.glow);
  gl.uniform1f(s.loc.sat, GOGGLES.saturate);
  gl.uniform3f(s.loc.warm, GOGGLES.warm[0], GOGGLES.warm[1], GOGGLES.warm[2]);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindVertexArray(null);
  gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);   // the baseline back (renderer.js _close2D's)
  gl.viewport(0, 0, w, h);   // and the whole canvas, which the 2D pass after it lays out in (endWorldPass's)
  renderer.markForeignPass?.();
  return true;
}
