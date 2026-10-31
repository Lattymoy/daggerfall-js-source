// @ts-check
// ARMORY (2026-10-28; bible/04-Characters/Aura-Armory.md section 8): A WEAPON PIECE ON THE SHOP'S STAGE. The body pass
// draws no weapon piece (weapon glow law 7), so the auras' stage showed a bare figure for one. Here a longsword of
// Daggerfall's pixels stands on the stage, outlined by the classic hand's own shaders (render/weaponGlowGlsl.js): the
// field baked once, the band read off it each frame, as Renderer.drawScreenQuadGlow draws a held weapon's. Not a DFU member.
import {
  GLOW_FIELD_VS,
  GLOW_FIELD_FS,
  GLOW_SPRITE_VS,
  GLOW_SPRITE_FS,
  GLOW_CLOCK_PERIOD,
  GLOW_REACH_MAX,
  glowFieldReach,
} from './weaponGlowGlsl.js';

/** The blade's size in Daggerfall's pixels. */
export const BLADE_W = 15;
export const BLADE_H = 64;
/** The blade's share of the stage's height at most. */
export const BLADE_FILL = 0.84;

const C = Object.freeze({
  hi: [236, 239, 246],
  lit: [196, 202, 214],
  steel: [158, 164, 178],
  fuller: [108, 114, 128],
  dark: [86, 90, 102],
  iron: [96, 92, 88],
  ironDark: [58, 55, 53],
  brass: [182, 146, 66],
  brassDark: [118, 90, 40],
  hide: [96, 60, 36],
  hideDark: [62, 39, 25],
});
/** The blade's rows, top first: each `[first x, the colours across]`. */
function bladeRows() {
  /** @type {Array<[number, number[][]]>} */ const rows = [];
  rows.push([7, [C.hi]], [6, [C.lit, C.hi, C.dark]], [6, [C.lit, C.fuller, C.dark]], [6, [C.lit, C.fuller, C.dark]]); // the point
  for (let y = 4; y < 44; y++) rows.push([5, [C.hi, C.lit, C.fuller, C.steel, C.dark]]); // the blade, its fuller down the middle
  rows.push([
    0,
    [
      C.ironDark,
      C.iron,
      C.iron,
      C.iron,
      C.iron,
      C.iron,
      C.iron,
      C.brass,
      C.iron,
      C.iron,
      C.iron,
      C.iron,
      C.iron,
      C.iron,
      C.ironDark,
    ],
  ]);
  rows.push([
    0,
    [
      C.ironDark,
      C.iron,
      C.iron,
      C.iron,
      C.iron,
      C.iron,
      C.brass,
      C.brassDark,
      C.brass,
      C.iron,
      C.iron,
      C.iron,
      C.iron,
      C.iron,
      C.ironDark,
    ],
  ]);
  rows.push([
    1,
    [
      C.ironDark,
      C.ironDark,
      C.iron,
      C.iron,
      C.iron,
      C.iron,
      C.brass,
      C.iron,
      C.iron,
      C.iron,
      C.iron,
      C.ironDark,
      C.ironDark,
    ],
  ]); // the guard
  for (let y = 47; y < 59; y++) rows.push([6, y % 2 ? [C.hide, C.hideDark, C.hide] : [C.hideDark, C.hide, C.hideDark]]); // the grip, wrapped
  rows.push(
    [5, [C.brassDark, C.brass, C.brass, C.brass, C.brassDark]],
    [5, [C.brass, C.brass, C.brassDark, C.brass, C.brassDark]],
  );
  rows.push(
    [5, [C.brassDark, C.brass, C.brass, C.brassDark, C.brassDark]],
    [6, [C.brassDark, C.brass, C.brassDark]],
    [6, [C.brassDark, C.brassDark, C.brassDark]],
  ); // the pommel
  return rows;
}

/** THE BLADE'S PICTURE: `BLADE_W` x `BLADE_H` RGBA, its top row first (as a classic frame is laid in its texture), a
 *  longsword point up - steel with a fuller, an iron guard set with brass, a wrapped grip, a brass pommel. Pure. */
export function weaponPieceArt() {
  const px = new Uint8Array(BLADE_W * BLADE_H * 4);
  bladeRows().forEach(([x0, cols], y) =>
    cols.forEach((c, i) => {
      const o = (y * BLADE_W + x0 + i) * 4;
      px[o] = c[0];
      px[o + 1] = c[1];
      px[o + 2] = c[2];
      px[o + 3] = 255;
    }),
  );
  return { w: BLADE_W, h: BLADE_H, px };
}

/** Where the blade stands on a `W` x `H` canvas: whole pixels a cell, centred, its pad of `pad` cells kept inside.
 *  `{ x, y, w, h, cell }` in canvas pixels, top-left. Pure. */
export function weaponPieceLayout(/** @type {number} */ W, /** @type {number} */ H, pad = 4) {
  const cell = Math.max(
    1,
    Math.floor(Math.min((H * BLADE_FILL) / (BLADE_H + 2 * pad), (W * BLADE_FILL) / (BLADE_W + 2 * pad))),
  );
  const w = BLADE_W * cell,
    h = BLADE_H * cell;
  return { x: Math.round((W - w) / 2), y: Math.round((H - h) / 2), w, h, cell };
}

const BLADE_FS = `#version 300 es
precision highp float;
in vec2 vQ;
uniform sampler2D uTex;
out vec4 outColor;
void main() {
  vec4 c = texture(uTex, vQ);
  if (c.a < 0.5) discard;
  outColor = vec4(c.rgb, 1.0);
}`;

/**
 * THE STAGE on `canvas`, drawing `spec` (systems/weaponGlow.js glowSpec - the piece's look at its level) round the blade
 * until stopped. Answers `{ set, setKit, stop, step }` as the auras' stage does - or null without WebGL2 or the spec.
 * @param {HTMLCanvasElement} canvas @param {any} spec @param {{ clear?: number[], now?: () => number }} [o]
 */
export function startWeaponPiecePreview(
  canvas,
  spec,
  { clear = [0.035, 0.03, 0.055], now = () => performance.now() / 1000 } = {},
) {
  if (!spec?.ramp || !(spec.code > 0) || !spec.win) return null;
  /** @type {WebGL2RenderingContext|null} */
  const gl = /** @type {any} */ (
    canvas.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: false })
  );
  if (!gl) return null;
  const build = (/** @type {string} */ vs, /** @type {string} */ fs) => {
    const p = /** @type {WebGLProgram} */ (gl.createProgram());
    for (const [type, src] of /** @type {Array<[number, string]>} */ ([
      [gl.VERTEX_SHADER, vs],
      [gl.FRAGMENT_SHADER, fs],
    ])) {
      const s = /** @type {WebGLShader} */ (gl.createShader(type));
      gl.shaderSource(s, src);
      gl.compileShader(s);
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
  };
  const blade = build(GLOW_SPRITE_VS, BLADE_FS),
    fieldP = build(GLOW_FIELD_VS, GLOW_FIELD_FS),
    glow = build(GLOW_SPRITE_VS, GLOW_SPRITE_FS);
  if (!blade || !fieldP || !glow) return null;
  const at = (/** @type {WebGLProgram} */ p, /** @type {string} */ n) => gl.getUniformLocation(p, n);
  const vao = gl.createVertexArray(),
    buf = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
  const texOf = (/** @type {number} */ w, /** @type {number} */ h, /** @type {Uint8Array|null} */ px) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
    for (const [k, v] of [
      [gl.TEXTURE_MIN_FILTER, gl.NEAREST],
      [gl.TEXTURE_MAG_FILTER, gl.NEAREST],
      [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE],
      [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE],
    ])
      gl.texParameteri(gl.TEXTURE_2D, k, v);
    return t;
  };
  const art = weaponPieceArt(),
    tex = texOf(art.w, art.h, art.px);
  // THE FIELD, baked once (AUDIT WEAPON-GLOW SPR-1): the look's window on every side - the blade stands whole, nothing cut
  const [wx, up, down] = spec.win,
    pad = Math.max(wx, up, down),
    fw = art.w + 2 * pad,
    fh = art.h + 2 * pad;
  const field = texOf(fw, fh, null),
    fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, field, 0);
  gl.viewport(0, 0, fw, fh);
  gl.useProgram(fieldP);
  gl.uniform1i(at(fieldP, 'uTex'), 0);
  gl.uniform2i(at(fieldP, 'uArt'), art.w, art.h);
  gl.uniform4i(at(fieldP, 'uFieldPad'), pad, pad, pad, pad);
  gl.uniform3i(at(fieldP, 'uWin'), wx, up, down);
  gl.uniform3i(at(fieldP, 'uCut'), 0, 0, 0);
  gl.uniform1i(at(fieldP, 'uLook'), spec.code);
  gl.uniform1f(at(fieldP, 'uDmax'), glowFieldReach(spec.look));
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  const t0 = now();
  let raf = 0,
    stopped = false;
  const frame = () => {
    raf = 0;
    if (stopped) return;
    if (canvas.isConnected === false) {
      stop();
      return;
    }
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1),
      W = Math.max(1, Math.round(canvas.clientWidth * dpr)),
      H = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
    const L = weaponPieceLayout(W, H, pad);
    gl.viewport(0, 0, W, H);
    gl.clearColor(clear[0], clear[1], clear[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(vao);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, field);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    for (const p of [blade, glow]) {
      gl.useProgram(p);
      gl.uniform4f(at(p, 'uDst'), L.x, L.y, L.w, L.h);
      gl.uniform2f(at(p, 'uCanvas'), W, H);
      gl.uniform2i(at(p, 'uArt'), art.w, art.h);
      gl.uniform1i(at(p, 'uTex'), 0);
    }
    gl.useProgram(blade);
    gl.uniform4f(at(blade, 'uPad'), 0, 0, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    // the outline, the classic hand's: premultiplied, over the blade (drawScreenQuadGlow's blend)
    gl.useProgram(glow);
    gl.uniform4f(at(glow, 'uPad'), pad, pad, pad, pad);
    gl.uniform4f(at(glow, 'uSrc'), 0, 0, 1, 1);
    gl.uniform1i(at(glow, 'uField'), 1);
    gl.uniform2i(at(glow, 'uFieldAt'), pad, pad);
    gl.uniform1i(at(glow, 'uLook'), spec.code);
    gl.uniform1f(at(glow, 'uLevel'), spec.level);
    gl.uniform1f(at(glow, 'uTime'), (now() - t0) % GLOW_CLOCK_PERIOD);
    gl.uniform1f(at(glow, 'uDmax'), glowFieldReach(spec.look));
    gl.uniform1f(at(glow, 'uReachMax'), GLOW_REACH_MAX[/** @type {keyof typeof GLOW_REACH_MAX} */ (spec.look)]);
    gl.uniform3fv(at(glow, 'uRamp'), spec.ramp);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
    raf = globalThis.requestAnimationFrame?.(frame) ?? 0;
  };
  function stop() {
    stopped = true;
    if (raf) globalThis.cancelAnimationFrame?.(raf);
    gl.getExtension('WEBGL_lose_context')?.loseContext(); // EVERY ALLOCATION HAS AN OWNER: the context and all it held
  }
  raf = globalThis.requestAnimationFrame?.(frame) ?? 0;
  return {
    set() {},
    setKit() {},
    stop,
    step: () => {
      if (raf) globalThis.cancelAnimationFrame?.(raf);
      frame();
    },
  };
}
