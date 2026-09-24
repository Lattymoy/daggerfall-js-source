// AUDIT RETRO1 (2026-09-24, Mac: "Audit this") - the five-lens audit of
// RETRO1, DFU's retro mode. Each pin below is one confirmed finding and
// fails with its fix reverted (tools/mutants/auditretro1.json):
//
//   A  fidelity   the twin by the drawn bar (A1/C3), the (int) bar (A7),
//                 DFU's approximate gamma (A3), replacements uncapped (A4),
//                 the ?interior host's lens and rect (A8/C4)
//   B  GL         nothing of the image left on a unit (B1), a panel before
//                 the first quad (B2), a live scissor (B3), a menu frame's
//                 rect (B4), the depth taken at begin (B5), the rect placed
//                 at the present (B6)
//   C  hosts      Shift-F11 under a window (C1), the first-person overlay
//                 (C2), sprites in image pixels (C6), the shift's cap and
//                 DFU's tip (C7), the frame shown at its own foot (C8/E5)
//   D  pins       the LUT's and the palette's bytes (D1), the pass's GL
//                 state (D2), the renderer's (D3), every late-upload cap
//                 (D4), the lane's retro slot (D5), float32 (D6), highp int (D7)
//   E  cost       the LUT a slice a frame (E1), freed with retro off (E2),
//                 a failed build or present survived (E3), one warning (E4),
//                 the program warmed (E7)
//
// The fake GL here is STATEFUL (lens B's): texture units, framebuffer
// attachments, each texture's own parameters, the capabilities, and the
// two draw-time rules WebGL2 enforces that this audit is about - a
// sampler reading a texture attached to the framebuffer it draws into (a
// feedback loop), and two sampler types on one unit. Its constants are
// WebGL2's own values (lens D: the recording GL answered 1 for every
// constant it did not list, so "Point" was satisfied by the depth
// texture's pair alone).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  RETRO_ASPECT, retroAspectViewportRect, retroFrameConfig, _resetRetroPostprocessing, toggleRetroPostprocessing,
} from '../src/systems/retroMode.js';
import {
  ART_PAL, buildRetroLut, retroLutSteps, RETRO_FS, RetroPass, retroShownByte, retroGammaOf,
  unityLinearToGamma, unityGammaToLinear, srgbToLinear, linearToSrgb,
} from '../src/render/retroPass.js';
import { setFrameTarget } from '../src/render/renderTarget.js';
import { Renderer, WORLD_FRAME } from '../src/render/renderer.js';
import { EL_LANE } from '../src/render/enhancedLighting.js';
import { LabGrassRenderer } from '../src/render/labGrass.js';
import { drawRigSpriteBox } from '../src/render/characterSprite.js';
import { setValue, resetToDefaults, getInt, _resetForTests } from '../src/systems/settings.js';
import { NUMBER_LAW } from '../src/ui/settingsLaw.js';
import { helpOf } from '../src/ui/settingsCopy.js';
import { largeHudWorldAspect, worldViewportRect, dockedLargeHudHeight } from '../src/ui/hudLarge.js';
import { retroToggleKey, hudShortcutKey } from '../src/ui/hudShortcuts.js';
import { routeKey } from '../src/ui/input.js';

const src = (rel) => readFileSync(new URL(`../src/${rel}`, import.meta.url), 'utf8');
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const L = new Float32Array([0.3, 0.8, -0.2]);
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

// ── the stateful fake GL ──────────

const E = {
  DEPTH_BUFFER_BIT: 0x100, STENCIL_BUFFER_BIT: 0x400, COLOR_BUFFER_BIT: 0x4000,
  POINTS: 0, LINES: 1, TRIANGLES: 4, TRIANGLE_STRIP: 5, TRIANGLE_FAN: 6, ZERO: 0, ONE: 1, NONE: 0,
  SRC_ALPHA: 0x302, ONE_MINUS_SRC_ALPHA: 0x303, FUNC_ADD: 0x8006, MIN: 0x8007, MAX: 0x8008,
  TEXTURE_2D: 0x0DE1, TEXTURE_3D: 0x806F, TEXTURE_2D_ARRAY: 0x8C1A, TEXTURE_CUBE_MAP: 0x8513,
  TEXTURE_MAG_FILTER: 0x2800, TEXTURE_MIN_FILTER: 0x2801, TEXTURE_WRAP_S: 0x2802, TEXTURE_WRAP_T: 0x2803, TEXTURE_WRAP_R: 0x8072,
  TEXTURE_MAX_LEVEL: 0x813D, TEXTURE_BASE_LEVEL: 0x813C, TEXTURE_COMPARE_MODE: 0x884C,
  NEAREST: 0x2600, LINEAR: 0x2601, NEAREST_MIPMAP_NEAREST: 0x2700, LINEAR_MIPMAP_NEAREST: 0x2701, NEAREST_MIPMAP_LINEAR: 0x2702, LINEAR_MIPMAP_LINEAR: 0x2703,
  REPEAT: 0x2901, CLAMP_TO_EDGE: 0x812F, MIRRORED_REPEAT: 0x8370,
  RED: 0x1903, RG: 0x8227, RGB: 0x1907, RGBA: 0x1908, R8: 0x8229, RG8: 0x822B, RGB8: 0x8051, RGBA8: 0x8058,
  R16F: 0x822D, RG16F: 0x822F, RGBA16F: 0x881A, R32F: 0x822E, RGBA32F: 0x8814, R32UI: 0x8236, RGBA32UI: 0x8D70,
  RED_INTEGER: 0x8D94, RGBA_INTEGER: 0x8D99, UNSIGNED_BYTE: 0x1401, UNSIGNED_SHORT: 0x1403, INT: 0x1404, UNSIGNED_INT: 0x1405, FLOAT: 0x1406, HALF_FLOAT: 0x140B,
  DEPTH_COMPONENT: 0x1902, DEPTH_COMPONENT16: 0x81A5, DEPTH_COMPONENT24: 0x81A6, DEPTH_COMPONENT32F: 0x8CAC, DEPTH_STENCIL: 0x84F9, DEPTH24_STENCIL8: 0x88F0,
  FRAMEBUFFER: 0x8D40, READ_FRAMEBUFFER: 0x8CA8, DRAW_FRAMEBUFFER: 0x8CA9, RENDERBUFFER: 0x8D41, FRAMEBUFFER_COMPLETE: 0x8CD5,
  COLOR_ATTACHMENT0: 0x8CE0, DEPTH_ATTACHMENT: 0x8D00, DEPTH_STENCIL_ATTACHMENT: 0x821A,
  ARRAY_BUFFER: 0x8892, ELEMENT_ARRAY_BUFFER: 0x8893, UNIFORM_BUFFER: 0x8A11, STATIC_DRAW: 0x88E4, DYNAMIC_DRAW: 0x88E8, STREAM_DRAW: 0x88E0,
  VERTEX_SHADER: 0x8B31, FRAGMENT_SHADER: 0x8B30, COMPILE_STATUS: 0x8B81, LINK_STATUS: 0x8B82,
  DEPTH_TEST: 0x0B71, CULL_FACE: 0x0B44, BLEND: 0x0BE2, SCISSOR_TEST: 0x0C11, STENCIL_TEST: 0x0B90, POLYGON_OFFSET_FILL: 0x8037,
  BACK: 0x0405, FRONT: 0x0404, CW: 0x0900, CCW: 0x0901, LESS: 0x0201, EQUAL: 0x0202, LEQUAL: 0x0203, GREATER: 0x0204, GEQUAL: 0x0206, ALWAYS: 0x0207,
  UNPACK_ALIGNMENT: 0x0CF5, PACK_ALIGNMENT: 0x0D05, UNPACK_FLIP_Y_WEBGL: 0x9240, UNPACK_PREMULTIPLY_ALPHA_WEBGL: 0x9241,
  TEXTURE0: 0x84C0,
};
for (let i = 1; i < 32; i++) E[`TEXTURE${i}`] = E.TEXTURE0 + i;
const TARGET_OF = (type) => (/2DArray/.test(type) ? E.TEXTURE_2D_ARRAY : /3D/.test(type) ? E.TEXTURE_3D : /Cube/.test(type) ? E.TEXTURE_CUBE_MAP : E.TEXTURE_2D);

function stateGl(W = 1280, H = 720) {
  let ids = 0;
  const calls = [], errors = [];
  const canvas = { clientWidth: W, clientHeight: H, width: W, height: H };
  const s = {
    active: 0, units: Array.from({ length: 32 }, () => ({})), drawFb: null, readFb: null, fbos: new Map(), prog: null,
    enabled: new Set([E.DEPTH_TEST, E.CULL_FACE]), depthMask: true, viewport: [0, 0, W, H], clearColor: [0, 0, 0, 0], scissor: [0, 0, W, H],
    clears: [], draws: [], blits: [],
  };
  const obj = (kind, extra = {}) => ({ kind, id: ++ids, ...extra });
  const bound = (target) => s.units[s.active][target];
  const attach = (target, att, tex) => {
    const fb = target === E.READ_FRAMEBUFFER ? s.readFb : s.drawFb;
    if (!fb) return;
    if (!s.fbos.has(fb)) s.fbos.set(fb, {});
    s.fbos.get(fb)[att] = tex;
  };
  const draw = (what) => {
    const p = s.prog;
    s.draws.push({ what, prog: p, fb: s.drawFb, viewport: [...s.viewport], scissorOn: s.enabled.has(E.SCISSOR_TEST), units: s.units.slice(0, 5).map((u) => ({ ...u })) });
    if (!p) return;
    const onUnit = new Map();
    const att = s.drawFb ? Object.values(s.fbos.get(s.drawFb) ?? {}) : [];
    for (const smp of p.samplers) {
      if (!smp.active) continue;
      const unit = p.units[smp.name] ?? 0;
      const prev = onUnit.get(unit);
      if (prev && prev.type !== smp.type) errors.push({ what, err: 'INVALID_OPERATION: two sampler types on one unit', unit, a: prev.name, b: smp.name });
      onUnit.set(unit, smp);
      const tex = s.units[unit]?.[TARGET_OF(smp.type)];
      if (tex && att.includes(tex)) errors.push({ what, err: 'INVALID_OPERATION: feedback loop', sampler: smp.name, unit, tex: tex.id });
    }
  };
  const impl = {
    createTexture: () => obj('tex', { params: {} }), createFramebuffer: () => obj('fbo'), createRenderbuffer: () => obj('rb'),
    createBuffer: () => obj('buf'), createVertexArray: () => obj('vao'), createQuery: () => obj('q'),
    createShader: (type) => obj('sh', { type }), createProgram: () => obj('prog', { shaders: [], samplers: [], units: {}, values: {}, locs: new Map() }),
    shaderSource: (sh, text) => { sh.src = text; },
    attachShader: (p, sh) => { p.shaders.push(sh); },
    linkProgram: (p) => {
      const text = p.shaders.map((x) => x.src ?? '').join('\n');
      const re = /uniform\s+(?:(?:highp|mediump|lowp)\s+)?((?:u|i)?sampler\w+)\s+([^;]+);/g;
      let m;
      while ((m = re.exec(text))) {
        for (const raw of m[2].split(',')) {
          const name = raw.trim().replace(/\[.*$/, '');
          if (name) p.samplers.push({ name, type: m[1], active: (text.match(new RegExp(`\\b${name}\\b`, 'g')) ?? []).length > 1 });
        }
      }
    },
    getShaderParameter: () => true, getProgramParameter: () => true, getShaderInfoLog: () => '', getProgramInfoLog: () => '',
    getUniformLocation: (p, name) => { if (!p.locs.has(name)) p.locs.set(name, { p, name }); return p.locs.get(name); },
    getAttribLocation: () => 0, getExtension: () => null, isContextLost: () => false,
    getParameter: () => new Float32Array(4), checkFramebufferStatus: () => E.FRAMEBUFFER_COMPLETE,
    isEnabled: (cap) => s.enabled.has(cap), enable: (cap) => s.enabled.add(cap), disable: (cap) => s.enabled.delete(cap),
    depthMask: (b) => { s.depthMask = !!b; },
    viewport: (x, y, w, h) => { s.viewport = [x, y, w, h]; },
    scissor: (x, y, w, h) => { s.scissor = [x, y, w, h]; },
    clearColor: (r, g, b, a) => { s.clearColor = [r, g, b, a]; },
    clear: (bits) => { s.clears.push({ bits, fb: s.drawFb, scissorOn: s.enabled.has(E.SCISSOR_TEST), depthMask: s.depthMask, viewport: [...s.viewport], color: [...s.clearColor] }); },
    useProgram: (p) => { s.prog = p; },
    uniform1i: (loc, v) => { if (loc?.p) { loc.p.units[loc.name] = v; loc.p.values[loc.name] = [v]; } },
    uniform1f: (loc, ...v) => { if (loc?.p) loc.p.values[loc.name] = v; },
    uniform2f: (loc, ...v) => { if (loc?.p) loc.p.values[loc.name] = v; },
    uniform4f: (loc, ...v) => { if (loc?.p) loc.p.values[loc.name] = v; },
    uniform4fv: (loc, v) => { if (loc?.p) loc.p.values[loc.name] = Array.from(v); },
    uniform2fv: (loc, v) => { if (loc?.p) loc.p.values[loc.name] = Array.from(v); },
    activeTexture: (u) => { s.active = u - E.TEXTURE0; },
    bindTexture: (target, tex) => { s.units[s.active][target] = tex ?? null; },
    texParameteri: (target, pname, v) => { const t = bound(target); if (t) t.params[pname] = v; },
    texImage2D: (target, level, fmt, w, h) => { const t = bound(target); if (t && level === 0) Object.assign(t, { fmt, w, h }); },
    texStorage2D: (target, levels, fmt, w, h) => { const t = bound(target); if (t) Object.assign(t, { fmt, w, h, levels }); },
    texImage3D: (target, level, fmt, w, h, d) => { const t = bound(target); if (t && level === 0) Object.assign(t, { fmt, w, h, d }); },
    deleteTexture: (tex) => { if (tex) tex.deleted = true; for (const u of s.units) for (const k of Object.keys(u)) if (u[k] === tex) u[k] = null; },
    bindFramebuffer: (target, fb) => {
      if (target === E.FRAMEBUFFER || target === E.DRAW_FRAMEBUFFER) s.drawFb = fb ?? null;
      if (target === E.FRAMEBUFFER || target === E.READ_FRAMEBUFFER) s.readFb = fb ?? null;
    },
    deleteFramebuffer: (fb) => { if (fb) fb.deleted = true; if (s.drawFb === fb) s.drawFb = null; if (s.readFb === fb) s.readFb = null; },
    framebufferTexture2D: (target, att, _tt, tex) => attach(target, att, tex),
    framebufferTextureLayer: (target, att, tex) => attach(target, att, tex),
    framebufferRenderbuffer: (target, att, _rt, rb) => attach(target, att, rb),
    blitFramebuffer: (...a) => { s.blits.push({ readFb: s.readFb, drawFb: s.drawFb, args: a }); },
    drawArrays: () => draw('drawArrays'), drawElements: () => draw('drawElements'),
    drawArraysInstanced: () => draw('drawArraysInstanced'), drawElementsInstanced: () => draw('drawElementsInstanced'),
  };
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in E) return E[k];
      if (k === 'drawingBufferWidth') return canvas.width;
      if (k === 'drawingBufferHeight') return canvas.height;
      if (k === 'canvas') return canvas;
      if (typeof k === 'string' && k.toUpperCase() === k) return `GL_${k}`;   // a constant this file does not use is at least distinct
      const f = impl[k];
      return (...a) => { calls.push([k, ...a]); return f ? f(...a) : undefined; };
    },
  });
  canvas.getContext = () => gl;
  return { gl, canvas, calls, errors, s };
}

/** The present's own draw - the retro program's (it owns the one uKind). */
const presents = (s) => s.draws.filter((d) => d.prog?.locs?.has('uKind'));
const retroCfg = (over = {}) => ({ width: 320, height: 200, hudWidth: 320, hudHeight: 154, post: 1, lutShift: 5, mipmaps: true, ...over });
const fakeMesh = (gl) => ({ vao: gl.createVertexArray(), subMeshes: [{ textureArchive: 1, textureRecord: 1, primitiveCount: 1, startIndex: 0 }] });

// ── A: fidelity ──────────

test('AUDIT RETRO1 A1/C3: the docked twin follows the DRAWN bar - the settings alone (the enhanced skin draws no classic bar) keep the 320x200 image and its 1.6 lens', () => {
  resetToDefaults();
  try {
    setValue('Video', 'RetroRenderingMode', 1);
    setValue('GUI', 'LargeHUD', true);   // LargeHUDDocked ships True
    assert.equal(largeHudWorldAspect(1920, 1080, null), 1.6, 'no bar drawn: the full texture\'s lens, not 320/154 stretched over the whole canvas');
    assert.deepEqual(worldViewportRect(1920, 1080, null), { x: 0, y: 0, w: 1, h: 1 }, 'and the full rect - the two agree');
    assert.equal(largeHudWorldAspect(1920, 1080, { h: 270 }), 320 / 154, 'a docked bar drawn: the _HUD twin\'s');
    setValue('GUI', 'LargeHUDDocked', false);
    assert.equal(largeHudWorldAspect(1920, 1080, { h: 270 }), 1.6, 'an undocked bar is an overlay - the full texture (UpdateRenderTarget :425 asks LargeHUDDocked)');
    setValue('GUI', 'LargeHUDDocked', true);
    // the renderer picks the same twin off the rect the host set from the same bar
    const { canvas } = stateGl();
    const r = new Renderer(canvas);
    r.setRetroSource(() => retroFrameConfig());
    r.setWorldViewport(worldViewportRect(1280, 720, null));
    r.beginFrame(I, I, L, WORLD_FRAME);
    assert.deepEqual(r.worldViewportPx, [0, 0, 320, 200], 'no bar: the full image');
    r.drawScreenQuad(null, { x: 0, y: 0, w: 1, h: 1 });
    r.setWorldViewport(worldViewportRect(1280, 720, { h: 184 }));
    r.beginFrame(I, I, L, WORLD_FRAME);
    assert.deepEqual(r.worldViewportPx, [0, 0, 320, 154], 'a docked strip: the _HUD image');
    r.drawScreenQuad(null, { x: 0, y: 0, w: 1, h: 1 });
    setValue('Video', 'RetroModeAspectCorrection', 1);
    r.setWorldViewport(worldViewportRect(1280, 720, null));
    r.beginFrame(I, I, L, WORLD_FRAME);
    assert.deepEqual(r.worldViewportPx, [0, 0, 320, 200], 'a pillarbox with no bar is not a docked strip');
    r.drawScreenQuad(null, { x: 0, y: 0, w: 1, h: 1 });
  } finally { resetToDefaults(); setFrameTarget(null); }
});

test('AUDIT RETRO1 A7: the docked bar\'s height is `(int)Rectangle.height` (HUDLarge.cs:251) - the rect, the lens and the crosshair all read the cast', () => {
  resetToDefaults();
  try {
    setValue('GUI', 'LargeHUD', true);
    assert.equal(dockedLargeHudHeight({ h: 220.8 }), 220);
    assert.ok(near(largeHudWorldAspect(1536, 1000, { h: 220.8 }), 1536 / 780), 'the lens over the whole-pixel strip');
  } finally { resetToDefaults(); }
});

test('AUDIT RETRO1 A3: DFU\'s effect runs between UnityCG\'s APPROXIMATE gamma pair, and its screen shows the result through the exact sRGB encode', () => {
  // UnityCG.cginc, verbatim
  assert.ok(near(unityLinearToGamma(0.5), 1.055 * 0.5 ** 0.416666667 - 0.055));
  assert.equal(unityLinearToGamma(-1), 0, 'max(..., 0)');
  assert.ok(near(unityGammaToLinear(0.5), 0.5 * (0.5 * (0.5 * 0.305306011 + 0.682171111) + 0.012522878)));
  assert.ok(near(srgbToLinear(linearToSrgb(0.2)), 0.2, 1e-12), 'the exact pair is an identity');
  // the numbers lens A measured against DFU: palette grey 4 shows as 1, 8 as 4; posterize's 1/15 as 13
  assert.deepEqual([4, 8, 12, 15].map((v) => retroShownByte(v / 255)), [1, 4, 7, 10]);
  assert.equal(retroShownByte(1 / 15), 13);
  assert.ok(near(retroGammaOf(255), 1, 1e-9) && retroGammaOf(0) === 0);
  // and the shader is the same arithmetic
  assert.match(RETRO_FS, /vec3 unityLinearToGamma\(vec3 l\) \{ return max\(1\.055 \* pow\(max\(l, vec3\(0\.0\)\), vec3\(0\.416666667\)\) - 0\.055, vec3\(0\.0\)\); \}/);
  assert.match(RETRO_FS, /vec3 unityGammaToLinear\(vec3 s\) \{ return s \* \(s \* \(s \* 0\.305306011 \+ 0\.682171111\) \+ 0\.012522878\); \}/);
  assert.match(RETRO_FS, /vec3 srgbToLinear\(vec3 c\) \{ return mix\(c \/ 12\.92, pow\(\(c \+ 0\.055\) \/ 1\.055, vec3\(2\.4\)\), step\(0\.04045, c\)\); \}/);
  assert.match(RETRO_FS, /vec3 linearToSrgb\(vec3 l\) \{ return mix\(l \* 12\.92, 1\.055 \* pow\(l, vec3\(1\.0 \/ 2\.4\)\) - 0\.055, step\(0\.0031308, l\)\); \}/);
});

test('AUDIT RETRO1 A4: a replacement texture (TryImportTexture) keeps its mip chain under retro mode - uploaded and swept alike - where a classic one is capped', () => {
  const { canvas } = stateGl();
  const r = new Renderer(canvas);
  let cfg = retroCfg({ mipmaps: false });
  r.setRetroSource(() => cfg);
  try {
    r.beginFrame(I, I, L, WORLD_FRAME);
    r.drawScreenQuad(null, { x: 0, y: 0, w: 1, h: 1 });
    const img = { width: 2, height: 2, colors: new Uint8Array(16) };
    r.uploadTexture(7, 0, img);
    r.uploadTexture(8, 0, img, { replacement: true });
    const swapEmit = r.uploadEmissionTexture(8, 0, img, { replacement: true });
    const tex = (a) => r.textures.get(`${a}_0`);
    assert.equal(tex(7).params[E.TEXTURE_MAX_LEVEL], 0, 'the classic upload capped');
    assert.equal(tex(8).params[E.TEXTURE_MAX_LEVEL], undefined, 'the replacement not');
    assert.equal(swapEmit.params[E.TEXTURE_MAX_LEVEL], undefined, 'nor its emission map - both samples stay on one level');
    cfg = retroCfg({ mipmaps: true });
    r.beginFrame(I, I, L, WORLD_FRAME);
    r.drawScreenQuad(null, { x: 0, y: 0, w: 1, h: 1 });
    cfg = retroCfg({ mipmaps: false });
    tex(8).params[E.TEXTURE_MAX_LEVEL] = 'untouched';
    r.beginFrame(I, I, L, WORLD_FRAME);
    assert.equal(tex(7).params[E.TEXTURE_MAX_LEVEL], 0, 'the sweep caps the classic one');
    assert.equal(tex(8).params[E.TEXTURE_MAX_LEVEL], 'untouched', 'and passes the replacement by');
    r.drawScreenQuad(null, { x: 0, y: 0, w: 1, h: 1 });
  } finally { setFrameTarget(null); }
  const dp = src('scenes/dataPipeline.js');
  assert.match(dp, /const replacement = !!swap;/, 'the pipeline flags TryImportTexture\'s');
  assert.match(dp, /renderer\.uploadEmissionTexture\(archive, record, t\.getWindowColors32\(bitmap\), \{ replacement \}\);/);
  assert.match(dp, /renderer\.uploadEmissionTexture\(archive, record, color32, \{ white: true, replacement \}\);/);
});

test('AUDIT RETRO1 A8/C4: the ?interior host takes the hosts\' one lens and world rect, DaggerfallHUD\'s shortcuts and the frame-foot present', () => {
  const h = src('scenes/interior.js');
  assert.match(h, /const proj = mirrorProjectionX\(perspective\(fieldOfView\(\), largeHudWorldAspect\(canvas\.clientWidth, canvas\.clientHeight\), 0\.05, 500\)\);/);
  const rect = h.indexOf('renderer.setWorldViewport(worldViewportRect(canvas.clientWidth, canvas.clientHeight));');
  assert.ok(rect > 0 && rect < h.indexOf('renderer.beginFrame(proj, view, INTERIOR_LIGHT_DIR, WORLD_FRAME);'), 'the rect set before the frame that consumes it');
  assert.match(h, /keys\.add\(e\.code\);\n\s+if \(hudShortcutKey\(e, keys\)\) \{ e\.preventDefault\(\); return; \}/, 'below the window gate, as DaggerfallHUD.Update is');
  assert.ok(h.indexOf('renderer.resolveFrame();') > h.indexOf('overlay.draw(renderer, canvas, mapFont, 1);'), 'shown after its last draw');
});

// ── B: GL ──────────

test('AUDIT RETRO1 B1: a present leaves nothing of the image on a unit - the next retro frame binds that image to draw into, and a sampler still reading it is a feedback loop', () => {
  const { gl, canvas, errors, s } = stateGl();
  const r = new Renderer(canvas);
  r.setRetroSource(() => retroCfg({ post: 3 }));
  const grass = new LabGrassRenderer(gl);   // a foreign pass of the enhanced skin, built at host boot
  grass.count = 4; grass.perCell = 4; grass.slotBox = [[-0.5, -0.5, -0.5, 0.5, 0.5, 0.5]]; grass.slotCount = [4]; grass.slotFrame = new Float32Array(4);
  const light = { fog: null, sunDir: L, amb: [1, 1, 1], sunCol: [1, 1, 1], dim: 0, sunScale: 1, moonDir: L, moonScale: 0, moonCol: [0, 0, 0] };
  const wind = { dir: [1, 0], speed: 1, windV: [0, 0] };
  try {
    r.beginFrame(I, I, L, WORLD_FRAME);   // the enhanced skin: no screen quad - presented at the next beginFrame
    r.beginFrame(I, I, L, WORLD_FRAME);
    const t = r.retro.target;
    assert.equal(s.drawFb, t.fbo, 'the world draws into the image again');
    assert.equal(presents(s).length, 1, 'the owed image was presented first');
    for (let u = 0; u < 3; u++) {
      assert.ok(![t.tex, t.depth].includes(s.units[u][E.TEXTURE_2D]), `unit ${u} holds none of the image`);
      assert.equal(s.units[u][E.TEXTURE_3D] ?? null, null, `unit ${u} holds no LUT`);
    }
    errors.length = 0;
    grass.draw(I, I, new Float32Array(3), 0, light, wind, 50, 'smooth');
    grass.draw(I, I, new Float32Array(3), 0, light, wind, 50, 'pixel');
    assert.deepEqual(errors, [], 'no WebGL error in either grass style');
    r.drawScreenQuad(null, { x: 0, y: 0, w: 1, h: 1 });
  } finally { setFrameTarget(null); }
});

test('AUDIT RETRO1 B1: and the grass\'s smooth style names its sheet\'s unit, so the lighting lane\'s resolve leaving the frame image on unit 0 is no loop either', () => {
  const { gl, canvas, errors } = stateGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE); r.setAir(true);
  const grass = new LabGrassRenderer(gl);
  grass.count = 4; grass.perCell = 4; grass.slotBox = [[-0.5, -0.5, -0.5, 0.5, 0.5, 0.5]]; grass.slotCount = [4]; grass.slotFrame = new Float32Array(4);
  const light = { fog: null, sunDir: L, amb: [1, 1, 1], sunCol: [1, 1, 1], dim: 0, sunScale: 1, moonDir: L, moonScale: 0, moonCol: [0, 0, 0] };
  try {
    r.beginFrame(I, I, L, WORLD_FRAME); r.drawScreenQuad(null, { x: 0, y: 0, w: 1, h: 1 });   // the lane resolved: its frame image left on unit 0
    r.beginFrame(I, I, L, WORLD_FRAME);
    errors.length = 0;
    grass.draw(I, I, new Float32Array(3), 0, light, { dir: [1, 0], speed: 1, windV: [0, 0] }, 50, 'smooth');
    assert.deepEqual(errors, []);
    r.drawScreenQuad(null, { x: 0, y: 0, w: 1, h: 1 });
  } finally { setFrameTarget(null); }
});

test('AUDIT RETRO1 B2/C5/E6: a panel opened before the world frame\'s first screen quad presents the image first and draws on the canvas; the world frame it interrupts keeps nothing owed', () => {
  for (const lane of [false, true]) {
    const { canvas, s } = stateGl();
    const r = new Renderer(canvas);
    if (lane) { r.setLightingLane(EL_LANE); r.setAir(true); }
    r.setRetroSource(() => retroCfg());
    try {
      r.beginFrame(I, I, L, WORLD_FRAME);
      const fbo = r.retro.target.fbo;
      let panelFb;
      r.panelFrame({ proj: I, view: I, lightDir: L, rect: { x: 10, y: 20, w: 100, h: 100 } }, () => { panelFb = s.drawFb; });
      assert.equal(presents(s).length, 1, `${lane ? 'lane' : 'classic'}: the image was shown before the panel`);
      assert.equal(panelFb, null, 'the panel draws on the canvas, not into the image');
      assert.notEqual(s.drawFb, fbo);
      assert.equal(r._retroOwed, false);
      r.drawScreenQuad(null, { x: 0, y: 0, w: 1, h: 1 });
      assert.equal(presents(s).length, 1, 'and it is not shown twice');
    } finally { setFrameTarget(null); }
  }
});

test('AUDIT RETRO1 B3: a scissor live at the frame\'s first screen quad is lifted for the black clear and the image, and put back as it was', () => {
  const { canvas, s } = stateGl();
  const r = new Renderer(canvas);
  r.setRetroSource(() => retroCfg());
  try {
    r.beginFrame(I, I, L, WORLD_FRAME);
    r.setScreenScissor(100, 100, 50, 50);
    const box = [...s.scissor];
    s.clears.length = 0;
    r.drawScreenQuad(null, { x: 0, y: 0, w: 10, h: 10 });
    const black = s.clears.find((c) => c.fb === null && c.bits === E.COLOR_BUFFER_BIT);
    assert.equal(black?.scissorOn, false, 'the canvas clears whole');
    assert.equal(presents(s)[0].scissorOn, false, 'the image is drawn whole');
    assert.ok(s.enabled.has(E.SCISSOR_TEST), 'the scissor back on');
    assert.deepEqual(s.scissor, box, 'on its own box');
    r.clearScreenScissor();
  } finally { setFrameTarget(null); }
});

test('AUDIT RETRO1 B4: under the lane a menu frame after a retro world frame resolves over its WHOLE image, not the last world frame\'s 320x200 corner', () => {
  const { canvas } = stateGl(1280, 720);
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE); r.setAir(true);
  r.setRetroSource(() => retroCfg({ post: 0 }));
  try {
    r.beginFrame(I, I, L, WORLD_FRAME);
    r.drawScreenQuad(null, { x: 0, y: 0, w: 1, h: 1 });
    const resolveRect = () => r.air.programs.resolve.p.values.uRect;
    assert.deepEqual(resolveRect(), [0, 0, 320, 200], 'the world frame: its image');
    r.beginFrame(I, I, L);   // the video player's, a menu's
    r.drawScreenQuad(null, { x: 0, y: 0, w: 1, h: 1 });
    assert.deepEqual(resolveRect(), [0, 0, 1280, 720], 'the menu frame: all of it');
  } finally { setFrameTarget(null); }
});

test('AUDIT RETRO1 B5: the sky test reads the depth the frame WROTE, taken at its begin - the air pass turned on mid-frame hands over a reused pass\'s old depth', () => {
  const { canvas, s } = stateGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE); r.setAir(true);
  r.setRetroSource(() => retroCfg({ post: 2 }));
  try {
    r.beginFrame(I, I, L, WORLD_FRAME); r.drawScreenQuad(null, { x: 0, y: 0, w: 1, h: 1 });   // the pass has a retro frame of its own now
    r.setAir(false);
    r.beginFrame(I, I, L, WORLD_FRAME);   // the classic set: the world writes the image's own depth
    r.setAir(true);                       // ...and the air comes back before the frame is shown
    s.draws.length = 0;
    r.drawScreenQuad(null, { x: 0, y: 0, w: 1, h: 1 });
    const p = presents(s).at(-1);
    assert.equal(p.units[1][E.TEXTURE_2D], r.retro.target.depth, 'the image\'s own depth, not the air frame\'s');
  } finally { setFrameTarget(null); }
});

test('AUDIT RETRO1 B6: an owed image lands on the canvas as it is when it is shown - a resize between the frame and its present moves the rect with it', () => {
  const { canvas, s } = stateGl(1280, 720);
  const r = new Renderer(canvas);
  r.setRetroSource(() => retroCfg());
  try {
    r.setWorldViewport({ x: 0.125, y: 0, w: 0.75, h: 1 });
    r.beginFrame(I, I, L, WORLD_FRAME);   // no screen quad
    canvas.clientWidth = 1600; canvas.clientHeight = 900;
    s.draws.length = 0;
    r.setWorldViewport({ x: 0.125, y: 0, w: 0.75, h: 1 });
    r.beginFrame(I, I, L, WORLD_FRAME);
    assert.deepEqual(presents(s)[0].viewport, [200, 0, 1200, 900], 'the pillarbox of the canvas it is shown on');
    r.drawScreenQuad(null, { x: 0, y: 0, w: 1, h: 1 });
  } finally { setFrameTarget(null); }
});

// ── C: hosts ──────────

test('AUDIT RETRO1 C1: Shift-F11 under an open window loads nothing - it is the retro toggle\'s chord on QuickLoad\'s key, and the window gate keeps the toggle off too', () => {
  const ev = (shiftKey) => ({ code: 'F11', key: 'F11', shiftKey, target: null, preventDefault() {} });
  assert.equal(retroToggleKey(ev(true)), true);
  assert.equal(retroToggleKey(ev(false)), false, 'F11 alone is QuickLoad\'s');
  let loads = 0;
  const ctx = { uiOverlayActive: true, overlayIsNative: false, overlayInput() {}, quickLoad: () => { loads++; } };
  _resetRetroPostprocessing();
  routeKey(ev(true), ctx, null, new Set(['ShiftLeft']));
  assert.equal(loads, 0, 'Shift-F11 under a window: no load');
  routeKey(ev(false), ctx, null, new Set());
  assert.equal(loads, 1, 'F11 under a window still loads (the death screen\'s hint)');
  assert.equal(retroFrameConfig(), null);
  const w = src('scenes/world.js');
  assert.match(w, /actionForCode\(bindings\(\), e\.code\) === 'QuickLoad' && !retroToggleKey\(e, keys\)\) \{/, 'the exterior ladder\'s own arm');
  _resetRetroPostprocessing();
});

test('AUDIT RETRO1 C2: on the classic set the first-person overlay is drawn on the CANVAS after the image is shown; under the lane it goes into the lane\'s frame and through its resolve', () => {
  for (const lane of [false, true]) {
    const { canvas, s } = stateGl();
    const r = new Renderer(canvas);
    if (lane) { r.setLightingLane(EL_LANE); r.setAir(true); }
    r.setRetroSource(() => retroCfg());
    r.setWorldViewport({ x: 0.125, y: 0, w: 0.75, h: 1 });
    try {
      r.beginFrame(I, I, L, WORLD_FRAME);
      const arm = { id: 'armRT' };
      s.draws.length = 0;
      r.drawScreenOverlayQuad(arm, 0.5, 0.5);
      const overlay = s.draws.find((d) => d.units[0][E.TEXTURE_2D] === arm);
      if (!lane) {
        assert.equal(presents(s).length, 1, 'classic: the image shown first');
        assert.equal(overlay.fb, null, 'the arm on the canvas');
        assert.deepEqual(overlay.viewport, [0, 0, 1280, 720], 'over the whole canvas, at its own resolution');
      } else {
        assert.equal(presents(s).length, 0, 'lane: nothing shown yet');
        assert.equal(overlay.fb, r.air.frame.fbo, 'the arm in the lane\'s frame');
      }
      r.drawScreenQuad(null, { x: 0, y: 0, w: 1, h: 1 });
    } finally { setFrameTarget(null); }
  }
});

test('AUDIT RETRO1 C6: a rig sprite drawn into the retro image is sized in the IMAGE\'s pixels, a texel a whole number of them', () => {
  const sized = [];
  const rend = { retroImageSpan: null, renderCharacterSprite: (_m, _r, _p, _v, pw, ph) => { sized.push([pw, ph]); return {}; }, drawCharacterSpriteQuad() {} };
  const canvas = { clientWidth: 1920, clientHeight: 1080 };
  const box = { center: [0, 0, 0], halfW: 0.25, halfH: 0.5 };
  drawRigSpriteBox(rend, canvas, {}, I, box, I, I, [0, 0, -10]);
  assert.deepEqual(sized[0], [30, 60], 'the canvas: 540 px tall at 9 px a texel');
  rend.retroImageSpan = [200, 1080];
  drawRigSpriteBox(rend, canvas, {}, I, box, I, I, [0, 0, -10]);
  assert.deepEqual(sized[1], [25, 50], 'the image: 100 of its rows at 2 a texel (9 x 200/1080 = 1.67, rounded whole)');
  // and the renderer answers the span only while a retro world pass is live
  const { canvas: c2 } = stateGl(1280, 720);
  const r = new Renderer(c2);
  r.setRetroSource(() => retroCfg());
  try {
    r.setWorldViewport({ x: 0.125, y: 0, w: 0.75, h: 1 });
    r.beginFrame(I, I, L, WORLD_FRAME);
    assert.deepEqual(r.retroImageSpan, [200, 720]);
    r.drawScreenQuad(null, { x: 0, y: 0, w: 1, h: 1 });
    assert.equal(r.retroImageSpan, null, 'the 2D pass is the canvas\'s');
  } finally { setFrameTarget(null); }
});

test('AUDIT RETRO1 C7: the shift steps 0..7 (8 is a one-texel LUT - a black world), and the retro row carries DFU\'s own tip', () => {
  resetToDefaults();
  try {
    assert.equal(NUMBER_LAW['Video/PalettizationLUTShift'].max, 7);
    setValue('Video', 'PalettizationLUTShift', 8);
    assert.equal(getInt('Video', 'PalettizationLUTShift', 0, 7), 7);
    assert.equal(buildRetroLut(8).size, 1, 'what 8 would have been');
    assert.equal(helpOf('Video/RetroRenderingMode'), 'Renders world at lower resolutions', 'RetroModeConfigPage.cs:36, retroModeTip');
  } finally { resetToDefaults(); }
});

test('AUDIT RETRO1 C8/E5: every host shows its frame at its own foot - a frame that drew no screen quad is not left for the next beginFrame', () => {
  const at = (rel, before) => {
    const h = src(rel);
    const hits = [...h.matchAll(/renderer\.resolveFrame\(\);/g)].map((m) => m.index);
    return { h, hits, before: before.map((b) => h.indexOf(b)) };
  };
  const w = at('scenes/world.js', []);
  assert.equal(w.hits.length, 2, 'both world frame tails');
  for (const i of w.hits) assert.match(w.h.slice(i, i + 600), /capturePendingScreenshot\(canvas\);/, 'each before its shot');
  const d = at('scenes/dungeon.js', []);
  assert.equal(d.hits.length, 2, 'both dungeon frame tails');
  for (const i of d.hits) assert.match(d.h.slice(i, i + 600), /capturePendingScreenshot\(canvas\);/);
  const x = at('scenes/exterior.js', []);
  assert.equal(x.hits.length, 1);
  assert.ok(x.hits[0] > x.h.indexOf('townTalk.frame(dt);   // T3b'), 'after the last draw');
  assert.match(src('render/renderer.js'), /resolveFrame\(\) \{ this\._compositeAir\(\); \}/);
});

// ── D: the pins that were missing ──────────

test('AUDIT RETRO1 D1: the LUT at DFU\'s shipped shift and the palette are pinned by their BYTES - the tree-agreement test compared the port with itself', () => {
  const sha = (u8) => createHash('sha256').update(u8).digest('hex');
  assert.equal(sha(Uint8Array.from(ART_PAL)), '6b2c2d608acda51434c51929dd3c8ac11fbb182d8f3a07a30973c6e6ce7a942f', 'art_pal, all 258 (lens D checked it against DFU\'s, entry for entry)');
  assert.equal(sha(buildRetroLut(1).data), '8c552c8060e3fbac1e404fdb579b1359e7190463f62e605b13958ac180c394ff', 'the shift-1 LUT, 128^3 texels');
});

test('AUDIT RETRO1 D2: the pass\'s GL state, texture by texture - the image and its depth Point and clamped at 24 bits, the LUT Point and clamped, the samplers on units 0/1/2, the baseline back after the draw', () => {
  const { gl, s } = stateGl();
  const pass = new RetroPass(gl, { build: (vs, fs) => { const p = gl.createProgram(); const a = gl.createShader(E.VERTEX_SHADER), b = gl.createShader(E.FRAGMENT_SHADER); gl.shaderSource(a, vs); gl.shaderSource(b, fs); gl.attachShader(p, a); gl.attachShader(p, b); gl.linkProgram(p); return p; } });
  try {
    pass.beginFrameTarget(320, 200);
    const t = pass.target;
    const point = { [E.TEXTURE_MIN_FILTER]: E.NEAREST, [E.TEXTURE_MAG_FILTER]: E.NEAREST, [E.TEXTURE_WRAP_S]: E.CLAMP_TO_EDGE, [E.TEXTURE_WRAP_T]: E.CLAMP_TO_EDGE };
    assert.deepEqual([t.tex.fmt, t.tex.w, t.tex.h], [E.RGBA8, 320, 200]);
    assert.deepEqual(t.tex.params, point, 'the image: m_FilterMode Point, m_WrapU Clamp');
    assert.deepEqual([t.depth.fmt, t.depth.w, t.depth.h], [E.DEPTH_COMPONENT24, 320, 200], 'm_DepthFormat 2');
    assert.deepEqual(t.depth.params, point);
    assert.deepEqual([s.fbos.get(t.fbo)[E.COLOR_ATTACHMENT0], s.fbos.get(t.fbo)[E.DEPTH_ATTACHMENT]], [t.tex, t.depth]);
    s.clears.length = 0;
    pass.present({ depth: null, rect: [160, 0, 960, 720], canvasW: 1280, canvasH: 720, post: 3, lutShift: 5, clear: [0.25, 0.5, 0.75, 1] });
    const lut = pass.lut.tex;
    assert.deepEqual([lut.fmt, lut.w, lut.h, lut.d], [E.RGBA8, 8, 8, 8]);
    assert.deepEqual(lut.params, { ...point, [E.TEXTURE_WRAP_R]: E.CLAMP_TO_EDGE }, 'the LUT: Point, Clamp (:336)');
    const P = pass.P.p;
    assert.deepEqual([P.units.uColor, P.units.uDepth, P.units.uLut], [0, 1, 2], 'every sampler on its own unit');
    const d = presents(s)[0];
    assert.equal(d.fb, null, 'drawn on the canvas');
    assert.deepEqual([d.units[0][E.TEXTURE_2D], d.units[1][E.TEXTURE_2D], d.units[2][E.TEXTURE_3D]], [t.tex, t.depth, lut], 'the image on 0, its depth on 1, the LUT on 2');
    assert.deepEqual(d.viewport, [160, 0, 960, 720]);
    assert.deepEqual(s.clears[0], { bits: E.COLOR_BUFFER_BIT, fb: null, scissorOn: false, depthMask: true, viewport: [0, 0, 1280, 720], color: [0, 0, 0, 1] }, 'the canvas cleared black, whole');
    assert.deepEqual(s.clearColor, [0.25, 0.5, 0.75, 1], 'the renderer\'s clear colour back');
    assert.ok(s.enabled.has(E.DEPTH_TEST) && s.enabled.has(E.CULL_FACE) && !s.enabled.has(E.BLEND), 'the baseline back');
    assert.equal(s.depthMask, true, 'depth writes back on - the next frame\'s depth clear is masked otherwise');
    assert.deepEqual(s.viewport, [0, 0, 1280, 720]);
    assert.equal(s.active, 0, 'TEXTURE0 active');
    // the blit that stands in for a program that would not build reads the IMAGE
    const failed = new RetroPass(gl, { build: () => { throw new Error('no'); } });
    const warn = console.warn; console.warn = () => {};
    try {
      failed.beginFrameTarget(320, 200);
      failed.present({ rect: [0, 0, 1280, 720], canvasW: 1280, canvasH: 720, post: 3 });
    } finally { console.warn = warn; }
    assert.equal(s.blits.at(-1).readFb, failed.target.fbo);
    assert.equal(s.blits.at(-1).drawFb, null);
    assert.equal(s.readFb, null, 'and the read binding back');
  } finally { setFrameTarget(null); }
});

test('AUDIT RETRO1 D3: the renderer hands the pass its viewport, its clear colour and ONE pass', () => {
  const { canvas, s } = stateGl();
  const r = new Renderer(canvas);
  r.setRetroSource(() => retroCfg());
  try {
    r.setClearColor([0.2, 0.3, 0.4, 1]);
    s.clears.length = 0;
    r.beginFrame(I, I, L, WORLD_FRAME);
    const worldClear = s.clears.find((c) => c.bits === (E.COLOR_BUFFER_BIT | E.DEPTH_BUFFER_BIT));
    assert.deepEqual(worldClear.viewport, [0, 0, 320, 200], 'the world pass over the image, not the canvas');
    assert.equal(worldClear.fb, r.retro.target.fbo);
    const pass = r.retro;
    r.drawScreenQuad(null, { x: 0, y: 0, w: 1, h: 1 });
    assert.ok(near(s.clearColor[0], 0.2) && near(s.clearColor[1], 0.3) && near(s.clearColor[2], 0.4), 'the clear colour the renderer\'s shadow claims');
    r.beginFrame(I, I, L, WORLD_FRAME);
    assert.equal(r.retro, pass, 'the same pass - not a new image (and LUT) a frame');
    r.drawScreenQuad(null, { x: 0, y: 0, w: 1, h: 1 });
  } finally { setFrameTarget(null); }
});

test('AUDIT RETRO1 D4: what loads under retro mode loads capped - the emission map and the tile array too, not only uploadTexture', () => {
  const { canvas } = stateGl();
  const r = new Renderer(canvas);
  r.setRetroSource(() => retroCfg({ mipmaps: false }));
  try {
    r.beginFrame(I, I, L, WORLD_FRAME);
    r.drawScreenQuad(null, { x: 0, y: 0, w: 1, h: 1 });
    const img = { width: 2, height: 2, colors: new Uint8Array(16) };
    const emit = r.uploadEmissionTexture(9, 0, img);
    const tiles = r.uploadTileArray(302, [img, img]);
    assert.equal(emit.params[E.TEXTURE_MAX_LEVEL], 0, 'the emission map');
    assert.equal(tiles.params[E.TEXTURE_MAX_LEVEL], 0, 'the tile array');
  } finally { setFrameTarget(null); }
});

test('AUDIT RETRO1 D5: a menu over a lane retro frame takes the canvas slot and frees nothing of the retro one; the slot swap drops the previous-depth claim', () => {
  const { canvas } = stateGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE); r.setAir(true);
  r.setRetroSource(() => retroCfg());
  try {
    r.beginFrame(I, I, L); r.drawScreenQuad(null, { x: 0, y: 0, w: 1, h: 1 });   // a menu first: the canvas slot exists
    r.beginFrame(I, I, L, WORLD_FRAME); r.drawScreenQuad(null, { x: 0, y: 0, w: 1, h: 1 });
    r.beginFrame(I, I, L, WORLD_FRAME); r.drawScreenQuad(null, { x: 0, y: 0, w: 1, h: 1 });
    const ap = r.air, kept = ap._frames.retro;
    assert.equal(ap.prevValid, true, 'two world frames: the retro slot has a previous depth');
    r.beginFrame(I, I, L);   // the SWAP back to the kept canvas slot
    assert.ok(![kept.tex, ...kept.depths].some((t) => t.deleted) && !kept.fbo.deleted, 'the retro slot\'s images live');
    assert.equal(ap.prevValid, false, 'the canvas slot\'s previous depth is no frame\'s previous');
    r.drawScreenQuad(null, { x: 0, y: 0, w: 1, h: 1 });
  } finally { setFrameTarget(null); }
});

test('AUDIT RETRO1 D6: SetRetroAspectViewport\'s floats are float32 - 1441x800 at 16:10 pillars 81 (double says 80) - and its pillar truncates toward zero', () => {
  assert.equal(Math.round(retroAspectViewportRect(1441, 800, RETRO_ASPECT.SIXTEEN_TEN).x * 1441), 81);
  assert.equal(Math.round(retroAspectViewportRect(801, 1080, RETRO_ASPECT.FOUR_THREE).x * 801), -319, '(801 - 1440) / 2 = -319.5: C#\'s integer division, not a floor');
});

test('AUDIT RETRO1 D7: the shader\'s ints are highp - at shift 0 the index arithmetic passes 65280, past mediump\'s 16 bits', () => {
  assert.match(RETRO_FS, /^precision highp int;$/m);
});

// ── E: cost and robustness ──────────

test('AUDIT RETRO1 E1: the LUT is built a time slice a frame - the image is shown plain until the table is whole, then palettized, uploaded once', () => {
  let n = 0;
  for (const _ of retroLutSteps(1)) n++;
  assert.equal(n, 256, 'shift 1: a step per row of 8x8x8 blocks');
  const { gl, s } = stateGl();
  let clock = 0;
  const pass = new RetroPass(gl, { build: (vs, fs) => { const p = gl.createProgram(); const a = gl.createShader(E.VERTEX_SHADER), b = gl.createShader(E.FRAGMENT_SHADER); gl.shaderSource(a, vs); gl.shaderSource(b, fs); gl.attachShader(p, a); gl.attachShader(p, b); gl.linkProgram(p); return p; }, now: () => (clock += 1), lutBudgetMs: 20 });
  try {
    const kinds = [];
    for (let f = 0; f < 40 && !pass.lut; f++) {
      pass.beginFrameTarget(320, 200);
      pass.present({ rect: [0, 0, 1280, 720], canvasW: 1280, canvasH: 720, post: 3, lutShift: 2 });
      kinds.push(pass.P.p.values.uKind[0]);
    }
    assert.ok(kinds.length > 1, `built over ${kinds.length} frames, not in one`);
    assert.ok(kinds.slice(0, -1).every((k) => k === 0), 'plain while it builds');
    assert.equal(kinds.at(-1), 2, 'palettized the frame it is whole');
    assert.deepEqual([pass.lut.tex.fmt, pass.lut.tex.w, pass.lut.size], [E.RGBA8, 64, 64]);
    assert.equal(s.draws.length, kinds.length, 'a present every frame all the same');
  } finally { setFrameTarget(null); }
  assert.deepEqual(src('render/retroPass.js').match(/export const RETRO_LUT_BUDGET_MS = (\d+);/)?.[1], '4');
});

test('AUDIT RETRO1 E2: retro mode off frees the LUT - Shift-F11 (the effect off, retro on) keeps it', () => {
  const { canvas } = stateGl();
  const r = new Renderer(canvas);
  let cfg = retroCfg({ post: 3 });
  r.setRetroSource(() => cfg);
  try {
    r.beginFrame(I, I, L, WORLD_FRAME); r.drawScreenQuad(null, { x: 0, y: 0, w: 1, h: 1 });
    const lut = r.retro.lut.tex;
    cfg = retroCfg({ post: 0 });
    r.beginFrame(I, I, L, WORLD_FRAME); r.drawScreenQuad(null, { x: 0, y: 0, w: 1, h: 1 });
    assert.equal(r.retro.lut?.tex, lut, 'the toggle keeps the table');
    cfg = null;
    r.beginFrame(I, I, L, WORLD_FRAME);
    assert.equal(lut.deleted, true, 'off frees it');
    assert.equal(r.retro.lut, null);
  } finally { setFrameTarget(null); }
});

test('AUDIT RETRO1 E3: a LUT that cannot be built shows the image plain and says so once; a present that throws still leaves the frame the canvas\'s', () => {
  const base = stateGl();
  const gl = new Proxy(base.gl, { get: (t, k) => (k === 'texImage3D' ? () => { throw new RangeError('out of memory'); } : t[k]) });   // the 8 MB upload refused
  const warn = console.warn; const said = [];
  console.warn = (...a) => said.push(a.join(' '));
  try {
    const pass = new RetroPass(gl, { build: (vs, fs) => { const p = gl.createProgram(); const a = gl.createShader(E.VERTEX_SHADER), b = gl.createShader(E.FRAGMENT_SHADER); gl.shaderSource(a, vs); gl.shaderSource(b, fs); gl.attachShader(p, a); gl.attachShader(p, b); gl.linkProgram(p); return p; } });
    for (let f = 0; f < 3; f++) {
      pass.beginFrameTarget(320, 200);
      assert.doesNotThrow(() => pass.present({ rect: [0, 0, 1280, 720], canvasW: 1280, canvasH: 720, post: 3, lutShift: 5 }));
      assert.equal(pass.P.p.values.uKind[0], 0, 'the image, plain');
    }
    assert.equal(said.filter((m) => m.includes('LUT')).length, 1, 'said once, and not retried');
    assert.equal(pass.lut, null);
    assert.ok(base.calls.some((c) => c[0] === 'deleteTexture'), 'the half-made texture freed');
    assert.deepEqual(base.calls.filter((c) => c[0] === 'pixelStorei').at(-1), ['pixelStorei', E.UNPACK_ALIGNMENT, 4], 'the unpack alignment back');
  } finally { console.warn = warn; setFrameTarget(null); }
  const { canvas } = stateGl();
  const r = new Renderer(canvas);
  r.setRetroSource(() => retroCfg());
  try {
    r.beginFrame(I, I, L, WORLD_FRAME);
    r.retro.present = () => { throw new Error('lost'); };
    assert.throws(() => r.drawScreenQuad(null, { x: 0, y: 0, w: 1, h: 1 }), /lost/);
    assert.equal(r._frameFbo, null, 'the frame is the canvas\'s');
    assert.equal(r._lastProgram, null, 'and no shadow speaks past it');
  } finally { setFrameTarget(null); }
});

test('AUDIT RETRO1 E4: a stored value that will not parse is said once a key and value, not once a read', () => {
  const warn = console.warn; const said = [];
  console.warn = (...a) => said.push(a.join(' '));
  _resetForTests();
  try {
    setValue('Video', 'PalettizationLUTShift', '1.5');
    for (let i = 0; i < 100; i++) getInt('Video', 'PalettizationLUTShift', 0, 7);
    assert.equal(said.length, 1);
    setValue('Video', 'PalettizationLUTShift', 'x');
    getInt('Video', 'PalettizationLUTShift', 0, 7);
    assert.equal(said.length, 2, 'a new bad value is said again');
  } finally { console.warn = warn; resetToDefaults(); _resetForTests(); }
});

test('AUDIT RETRO1 E7: the warm builds the present\'s program when retro mode is on - not the first retro frame', () => {
  const { canvas } = stateGl();
  const r = new Renderer(canvas);
  assert.equal(r.warmSteps().length, 5, 'no source: the five');
  let on = false;
  r.setRetroSource(() => (on ? retroCfg() : null));
  assert.equal(r.warmSteps().length, 6);
  r.warmSteps().at(-1)();
  assert.equal(r.retro, null, 'retro off: nothing built');
  on = true;
  r.warmSteps().at(-1)();
  assert.ok(r.retro?.P?.p, 'the program, built');
  assert.equal(r._lastProgram, null, 'and the program shadow dropped');
});

test('AUDIT RETRO1: the toggle survives the audit - Shift-F11 still flips the effect with no window open', () => {
  _resetRetroPostprocessing();
  assert.equal(hudShortcutKey({ code: 'F11', shiftKey: true }), true);
  assert.equal(toggleRetroPostprocessing(), true, 'flipped back');
  _resetRetroPostprocessing();
});
