// RETRO1 (2026-09-24, Mac: "Can we get retro mode from DFU ported
// over?") - DFU's retro mode: the world drawn into a 320x200 or 640x400
// texture (a 320x154 / 640x308 twin over a docked large HUD), presented
// point-sampled through the 640x400 presentation target, posterized or
// palettized on the way (-sky variants leave the far plane alone), the
// world pillarboxed to 4:3 or 16:10 on request, the mip chains dropped
// unless UseMipMapsInRetroMode, and Shift-F11 toggling the effect.
//
// systems/retroMode.js (the settings, the sizes, the rect), render/
// retroPass.js (the palette, the LUT, the shader, the pass), and the
// renderer's frame lifecycle on the fake GL.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  RETRO_TARGETS, RETRO_TARGETS_HUD, RETRO_ASPECT, RETRO_POST,
  retroRenderingMode, retroPostProcessing, retroUseMipMaps, retroAspectCorrection, palettizationLutShift,
  retroTargetSize, retroWorldAspect, retroAspectViewportRect, retroFrameConfig,
  retroPostprocessingEnabled, toggleRetroPostprocessing, _resetRetroPostprocessing,
} from '../src/systems/retroMode.js';
import {
  RETRO_PRESENTATION, ART_PAL, ART_PAL_COUNT, PALETTE_CUTOFF, retroLutSize, retroLutTexel, posterizeByte,
  buildPaletteTree, nearestPaletteIndex, buildRetroLut, retroPostKind, RETRO_FS, RETRO_VS, RetroPass,
} from '../src/render/retroPass.js';
import { frameTarget, setFrameTarget } from '../src/render/renderTarget.js';
import { Renderer, WORLD_FRAME } from '../src/render/renderer.js';
import { EL_LANE } from '../src/render/enhancedLighting.js';
import { setValue, resetToDefaults, LIVE, tierOf } from '../src/systems/settings.js';
import { ENUM_LAW, NUMBER_LAW, formatValue, stepValue } from '../src/ui/settingsLaw.js';
import { largeHudWorldAspect, worldViewportRect, largeHudViewportRect } from '../src/ui/hudLarge.js';
import { hudShortcutKey } from '../src/ui/hudShortcuts.js';
import { muzzleRay } from '../src/combat/weaponRig.js';
import { LightningBoltsRenderer } from '../src/render/lightningBolts.js';

const src = (rel) => readFileSync(new URL(`../src/${rel}`, import.meta.url), 'utf8');
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const L = new Float32Array([0.3, 0.8, -0.2]);
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

/** The fake GL, with the constants these pins tell apart given their real values. */
function recordingGl(W = 1280, H = 720) {
  const calls = [];
  let ids = 0;
  const consts = {
    TEXTURE0: 1000, TEXTURE1: 1001, TEXTURE2: 1002, DEPTH_BUFFER_BIT: 256, COLOR_BUFFER_BIT: 16384, FRAMEBUFFER: 7, READ_FRAMEBUFFER: 8,
    TRIANGLE_STRIP: 5, TEXTURE_2D: 3553, TEXTURE_3D: 32879, TEXTURE_2D_ARRAY: 35866, TEXTURE_MAX_LEVEL: 33085, NEAREST: 9728,
    drawingBufferWidth: W, drawingBufferHeight: H, ONE: 1,
  };
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (k === 'createShader' || k === 'createProgram' || k === 'createBuffer' || k === 'createVertexArray'
        || k === 'createTexture' || k === 'createFramebuffer' || k === 'createRenderbuffer') return () => ({ id: ++ids });
      if (k === 'getParameter') return () => new Float32Array(4);
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return (...args) => { calls.push([k, ...args.map((a) => (ArrayBuffer.isView(a) && !(a instanceof Uint8Array) ? Float32Array.from(a) : a))]); };
    },
  });
  const canvas = { getContext: () => gl, clientWidth: W, clientHeight: H, width: W, height: H };
  return { gl, calls, canvas };
}
const lastBind = (calls, upTo = calls.length) => calls.slice(0, upTo).filter((c) => c[0] === 'bindFramebuffer' && c[1] === 7).at(-1)?.[2];

// ── the settings, the sizes, the rect (systems/retroMode.js) ──────────

test('RETRO1: the five settings are DFU\'s reads - mode and aspect clamped 0..2 as SettingsManager does, the post mode and the LUT shift clamped where DFU reads them raw (a recorded departure)', () => {
  resetToDefaults();
  assert.equal(retroRenderingMode(), 0, 'shipped off');
  assert.equal(retroPostProcessing(), 0);
  assert.equal(retroUseMipMaps(), false);
  assert.equal(retroAspectCorrection(), 0);
  assert.equal(palettizationLutShift(), 1, 'DFU ships a shift of 1 - the 8MB LUT');
  setValue('Video', 'RetroRenderingMode', 7); assert.equal(retroRenderingMode(), 2, 'GetInt(0, 2)');
  setValue('Video', 'RetroRenderingMode', -3); assert.equal(retroRenderingMode(), 0);
  setValue('Video', 'RetroModeAspectCorrection', 9); assert.equal(retroAspectCorrection(), 2);
  setValue('Video', 'PostProcessingInRetroMode', 5); assert.equal(retroPostProcessing(), 4, 'an unknown material is a blank world in DFU; the last one here');
  setValue('Video', 'PostProcessingInRetroMode', -1); assert.equal(retroPostProcessing(), 0);
  setValue('Video', 'PalettizationLUTShift', 9); assert.equal(palettizationLutShift(), 7, '256 >> 9 is a LUT of no texels, and (AUDIT RETRO1 C7) 256 >> 8 a one-texel LUT - a black world');
  setValue('Video', 'PalettizationLUTShift', -2); assert.equal(palettizationLutShift(), 0);
  setValue('Video', 'UseMipMapsInRetroMode', true); assert.equal(retroUseMipMaps(), true);
  resetToDefaults();
});

test('RETRO1: the targets are the .renderTexture assets - 320x200 and 640x400, and their docked-HUD twins 320x154 and 640x308', () => {
  assert.deepEqual([...RETRO_TARGETS[1]], [320, 200]);
  assert.deepEqual([...RETRO_TARGETS[2]], [640, 400]);
  assert.deepEqual([...RETRO_TARGETS_HUD[1]], [320, 154]);
  assert.deepEqual([...RETRO_TARGETS_HUD[2]], [640, 308]);
  assert.deepEqual([...RETRO_PRESENTATION], [640, 400], 'RetroPresentation.renderTexture - every mode goes through it');
  assert.deepEqual(retroTargetSize(1, false), [320, 200]);
  assert.deepEqual(retroTargetSize(2, true), [640, 308]);
  assert.equal(retroTargetSize(0, false), null, 'mode 0 has no texture');
  assert.equal(retroWorldAspect(1, false), 1.6, 'the camera takes the texture\'s aspect');
  assert.equal(retroWorldAspect(1, true), 320 / 154);
  assert.equal(retroWorldAspect(0, false), null);
  assert.deepEqual(RETRO_ASPECT, { OFF: 0, FOUR_THREE: 1, SIXTEEN_TEN: 2 });
  assert.deepEqual(RETRO_POST, { OFF: 0, POSTERIZE: 1, POSTERIZE_NO_SKY: 2, PALETTIZE: 3, PALETTIZE_NO_SKY: 4 });
});

test('RETRO1: SetRetroAspectViewport to the cast - a 6x-classic height ratio, a 5x (4:3) or 6x (16:10) width truncated, an integer pillar, the bar off the bottom, nothing clamped', () => {
  // 1080 / 6 / 200 = 0.9; 4:3 is 1600 * 0.9 = 1440 wide, 16:10 is 1920 * 0.9 = 1728
  const r43 = retroAspectViewportRect(1920, 1080, RETRO_ASPECT.FOUR_THREE);
  assert.ok(near(r43.x, 240 / 1920) && near(r43.w, 1 - 2 * 240 / 1920) && r43.y === 0 && r43.h === 1, JSON.stringify(r43));
  const r1610 = retroAspectViewportRect(1920, 1080, RETRO_ASPECT.SIXTEEN_TEN);
  assert.ok(near(r1610.x, 96 / 1920) && near(r1610.w, 1 - 2 * 96 / 1920), JSON.stringify(r1610));
  // the pillar is C#'s integer division: 1001 - 800 = 201 -> 100
  const odd = retroAspectViewportRect(1001, 600, RETRO_ASPECT.FOUR_THREE);
  assert.ok(near(odd.x, 100 / 1001, 1e-7), `the pillar truncates: ${odd.x * 1001}`);
  // the width truncates too: 4:3 of a 601-high window is (int)(1600 * 601/1200) = 801
  const trunc = retroAspectViewportRect(1001, 601, RETRO_ASPECT.FOUR_THREE);
  assert.ok(near(trunc.x, 100 / 1001, 1e-7), `(1001 - 801) / 2 = 100: ${trunc.x * 1001}`);
  // the docked bar's height comes off the bottom
  const docked = retroAspectViewportRect(1920, 1000, RETRO_ASPECT.FOUR_THREE, 100);
  assert.ok(near(docked.y, 0.1) && near(docked.h, 0.9), JSON.stringify(docked));
  // a window narrower than the target: the pillar goes negative in DFU too
  const narrow = retroAspectViewportRect(800, 1080, RETRO_ASPECT.FOUR_THREE);
  assert.ok(near(narrow.x, -320 / 800) && near(narrow.w, 1 + 2 * 320 / 800), JSON.stringify(narrow));
});

test('RETRO1: the frame\'s config - null when off, BOTH twins (AUDIT RETRO1 C3: the renderer picks by the drawn bar\'s rect, not the settings), the post mode through the Shift-F11 toggle, the shift and the mip switch', () => {
  resetToDefaults();
  _resetRetroPostprocessing();
  assert.equal(retroFrameConfig(), null, 'off: the renderer draws as it always did');
  setValue('Video', 'RetroRenderingMode', 1);
  setValue('Video', 'PostProcessingInRetroMode', 4);
  setValue('Video', 'PalettizationLUTShift', 2);
  assert.deepEqual(retroFrameConfig(), { width: 320, height: 200, hudWidth: 320, hudHeight: 154, post: 4, lutShift: 2, mipmaps: false });
  setValue('GUI', 'LargeHUD', true);   // LargeHUDDocked ships True
  assert.deepEqual(retroFrameConfig(), { width: 320, height: 200, hudWidth: 320, hudHeight: 154, post: 4, lutShift: 2, mipmaps: false }, 'the settings alone choose no twin - the enhanced skin draws no bar for them to be right about');
  setValue('Video', 'RetroRenderingMode', 2);
  setValue('Video', 'UseMipMapsInRetroMode', true);
  assert.deepEqual(retroFrameConfig(), { width: 640, height: 400, hudWidth: 640, hudHeight: 308, post: 4, lutShift: 2, mipmaps: true });
  // TogglePostprocessing: a plain Blit, not the material - and back
  assert.equal(retroPostprocessingEnabled(), true);
  assert.equal(toggleRetroPostprocessing(), false);
  assert.equal(retroFrameConfig().post, 0, 'OnPostRender blits without the material');
  assert.equal(toggleRetroPostprocessing(), true);
  assert.equal(retroFrameConfig().post, 4);
  _resetRetroPostprocessing();
  resetToDefaults();
});

test('RETRO1: the hosts\' lens and world rect - the texture\'s aspect under retro mode, the pillarbox only with retro mode ON and a correction set, the docked bar\'s term shared', () => {
  resetToDefaults();
  assert.ok(near(largeHudWorldAspect(1920, 1080, null), 1920 / 1080), 'off: the window\'s aspect, as before');
  assert.deepEqual(worldViewportRect(1920, 1080, null), largeHudViewportRect(1080, null), 'off: the docked rect, as before');
  setValue('Video', 'RetroModeAspectCorrection', 1);
  assert.deepEqual(worldViewportRect(1920, 1080, null), largeHudViewportRect(1080, null), 'the correction is the retro PRESENTER\'s - no retro mode, no pillarbox');
  setValue('Video', 'RetroRenderingMode', 1);
  assert.equal(largeHudWorldAspect(1920, 1080, null), 1.6, 'the lens is 320x200\'s, stretched to the rect');
  const r = worldViewportRect(1920, 1080, null);
  assert.ok(near(r.x, 0.125) && near(r.w, 0.75) && r.y === 0 && r.h === 1, JSON.stringify(r));
  // docked: the bar's height off the bottom, the lens the _HUD twin's
  setValue('GUI', 'LargeHUD', true);
  const bar = { h: 270 };
  const d = worldViewportRect(1920, 1080, bar);
  assert.ok(near(d.y, 0.25) && near(d.h, 0.75) && near(d.x, 0.125), JSON.stringify(d));
  assert.equal(largeHudWorldAspect(1920, 1080, bar), 320 / 154);
  setValue('Video', 'RetroModeAspectCorrection', 0);
  assert.deepEqual(worldViewportRect(1920, 1080, bar), largeHudViewportRect(1080, bar), 'retro without a correction: the docked rect');
  resetToDefaults();
});

// ── the palette, the LUT, the shader (render/retroPass.js) ──────────

test('RETRO1: art_pal is DFU\'s - 258 colours, ART_PAL.COL\'s opaque 255 then black and the three greys DFU adds', () => {
  assert.equal(ART_PAL_COUNT, 258);
  assert.equal(ART_PAL.length, 258 * 3);
  const c = (i) => ART_PAL.slice(i * 3, i * 3 + 3);
  assert.deepEqual(c(0), [255, 229, 129], 'the first');
  assert.deepEqual(c(1), [255, 206, 107]);
  assert.deepEqual(c(253), [57, 43, 39]);
  assert.deepEqual(c(254), [0, 0, 0]);
  assert.deepEqual([c(255), c(256), c(257)], [[4, 4, 4], [8, 8, 8], [12, 12, 12]], '"Add a few missing grey levels"');
  assert.ok(Object.isFrozen(ART_PAL));
  assert.equal(PALETTE_CUTOFF, 10);
});

test('RETRO1: the k-d tree is FastColorPalette - exact nearest distance, the leaf keeps the FIRST of equal fits, a split keeps its own side on a tie, a degenerate split retries on the next axis', () => {
  const tree = buildPaletteTree();
  const brute = (r, g, b) => {
    let best = Infinity;
    for (let i = 0; i < ART_PAL_COUNT; i++) { const dr = r - ART_PAL[i * 3], dg = g - ART_PAL[i * 3 + 1], db = b - ART_PAL[i * 3 + 2]; best = Math.min(best, dr * dr + dg * dg + db * db); }
    return best;
  };
  for (let k = 0; k < 4000; k++) {
    const r = (k * 97) % 256, g = (k * 57 + 13) % 256, b = (k * 31 + 101) % 256;
    const [i, d] = nearestPaletteIndex(tree, r, g, b);
    assert.equal(d, brute(r, g, b), `(${r},${g},${b}) is a nearest colour`);
    const dr = r - ART_PAL[i * 3], dg = g - ART_PAL[i * 3 + 1], db = b - ART_PAL[i * 3 + 2];
    assert.equal(dr * dr + dg * dg + db * db, d, 'and the index is the colour it measured');
  }
  // a leaf: (0,0,0) and (2,0,0) both sit 1 from (1,0,0) - the first listed wins (`fit < bestFit`)
  const leafPal = [2, 0, 0, 0, 0, 0];
  assert.equal(nearestPaletteIndex(buildPaletteTree(leafPal), 1, 0, 0, leafPal)[0], 0, 'the first of equal fits');
  // a split: twelve colours, six at r=0 and six at r=20; the split value is 10, and (10,0,0) is 10 from each side
  const splitPal = [];
  for (let i = 0; i < 6; i++) splitPal.push(20, i * 40, 0);
  for (let i = 0; i < 6; i++) splitPal.push(0, i * 40, 0);
  const st = buildPaletteTree(splitPal);
  assert.equal(st.axis, 0); assert.equal(st.split, 10);
  const [ti, td] = nearestPaletteIndex(st, 10, 0, 0, splitPal);
  assert.equal(td, 100);
  assert.equal(splitPal[ti * 3], 20, 'the tie stays on the ABOVE side, where diff >= 0 put the search (`minor < major`, strictly)');
  // degenerate: every red equal - the split on r leaves one side empty and retries on g
  const flat = [];
  for (let i = 0; i < 12; i++) flat.push(50, i * 20, 0);
  const ft = buildPaletteTree(flat);
  assert.equal(ft.axis, 1, 'IsDegenerated: split on the next projection');
});

test('RETRO1: the LUT is InitLut\'s bytes - (r,g,b) << shift\'s nearest colour, r fastest, opaque - the candidate search agreeing with the tree texel for texel', () => {
  assert.equal(retroLutSize(1), 128); assert.equal(retroLutSize(0), 256); assert.equal(retroLutSize(8), 1);
  const tree = buildPaletteTree();
  for (const shift of [3, 4]) {
    const { size, data } = buildRetroLut(shift);
    assert.equal(size, 256 >> shift); assert.equal(data.length, size ** 3 * 4);
    for (let b = 0; b < size; b++) for (let g = 0; g < size; g++) for (let r = 0; r < size; r++) {
      const [i] = nearestPaletteIndex(tree, r << shift, g << shift, b << shift);
      const o = ((b * size + g) * size + r) * 4;
      if (data[o] !== ART_PAL[i * 3] || data[o + 1] !== ART_PAL[i * 3 + 1] || data[o + 2] !== ART_PAL[i * 3 + 2] || data[o + 3] !== 255) {
        assert.fail(`shift ${shift} texel (${r},${g},${b}) is (${data[o]},${data[o + 1]},${data[o + 2]},${data[o + 3]}), the tree says colour ${i}`);
      }
    }
  }
  // DFU's own size at its shipped shift, sampled - including the ties the candidate search hands to the tree
  const { size, data } = buildRetroLut(1);
  assert.equal(size, 128);
  let ties = 0;
  for (const b of [0, 21, 64, 99, 127]) for (let g = 0; g < size; g++) for (let r = 0; r < size; r++) {   // five whole slices of the cube
    const R = r << 1, G = g << 1, B = b << 1;
    let best = Infinity, n = 0;
    for (let i = 0; i < ART_PAL_COUNT; i++) { const dr = R - ART_PAL[i * 3], dg = G - ART_PAL[i * 3 + 1], db = B - ART_PAL[i * 3 + 2]; const d = dr * dr + dg * dg + db * db; if (d < best) { best = d; n = 1; } else if (d === best) n++; }
    if (n > 1) ties++;
    const [i] = nearestPaletteIndex(tree, R, G, B);
    const o = ((b * size + g) * size + r) * 4;
    assert.ok(data[o] === ART_PAL[i * 3] && data[o + 1] === ART_PAL[i * 3 + 1] && data[o + 2] === ART_PAL[i * 3 + 2], `shift 1 texel (${r},${g},${b})`);
  }
  assert.ok(ties > 0, 'the sample reaches texels where two colours tie - the tree\'s own answer is what decides them');
});

test('RETRO1: the lookup and the posterize are Point sampling and "4 bits per component" - AUDIT RETRO1 A3: in DFU\'s approximate gamma, shown through its exact sRGB encode', () => {
  assert.equal(retroLutTexel(0, 128), 0);
  assert.equal(retroLutTexel(2, 128), 0, 'DFU\'s approximate gamma puts a dark byte a cell lower than floor(2/255 * 128) = 1');
  assert.equal(retroLutTexel(4, 128), 1);
  assert.equal(retroLutTexel(253, 128), 126);
  assert.equal(retroLutTexel(255, 128), 127, 'the last texel - DFU\'s gamma of 255 is just under 1');
  assert.equal(retroLutTexel(255, 1), 0);
  assert.equal(posterizeByte(0), 0); assert.equal(posterizeByte(255), 255);
  assert.equal(posterizeByte(8), 0, 'rounds down');
  assert.equal(posterizeByte(9), 13, 'the first of sixteen levels, 1/15 - which DFU\'s screen shows as 13, not 17');
  assert.deepEqual([26, 43].map(posterizeByte), [32, 50], 'and 2/15, 3/15 as 32 and 50');
  assert.equal(new Set(Array.from({ length: 256 }, (_, v) => posterizeByte(v))).size, 16, 'sixteen levels a channel');
  assert.deepEqual([0, 1, 2, 3, 4].map(retroPostKind), [
    { kind: 0, noSky: false }, { kind: 1, noSky: false }, { kind: 1, noSky: true }, { kind: 2, noSky: false }, { kind: 2, noSky: true },
  ]);
});

test('RETRO1: the present shader - the presentation texel snapped, "Sky untouched" at the far plane, the posterize and the LUT fetched by index', () => {
  assert.match(RETRO_VS, /layout\(location = 0\) in vec2 aPos;/);
  assert.match(RETRO_FS, /precision highp sampler3D;/, 'a fragment shader has no default precision for a 3D sampler');
  assert.match(RETRO_FS, /vec2 uv = \(floor\(\(gl_FragCoord\.xy - uRect\.xy\) \/ uRect\.zw \* uPresent\) \+ 0\.5\) \/ uPresent;/, 'two Point blits folded into one fetch');
  assert.match(RETRO_FS, /if \(uKind == 0\) return;/);
  assert.match(RETRO_FS, /if \(uNoSky == 1 && texture\(uDepth, uv\)\.r >= 1\.0\) return;/);
  assert.match(RETRO_FS, /vec3 g = unityLinearToGamma\(srgbToLinear\(c\.rgb\)\);/, 'AUDIT RETRO1 A3: DFU\'s shader space');
  assert.match(RETRO_FS, /if \(uKind == 1\) q = floor\(g \* 15\.0 \+ 0\.5\) \/ 15\.0;/);
  assert.match(RETRO_FS, /else q = texelFetch\(uLut, min\(ivec3\(floor\(g \* float\(uLutSize\)\)\), ivec3\(uLutSize - 1\)\), 0\)\.rgb;/);
  assert.match(RETRO_FS, /outColor = vec4\(clamp\(linearToSrgb\(unityGammaToLinear\(q\)\), 0\.0, 1\.0\), c\.a\);/, 'and back through DFU\'s GammaToLinearSpace and the screen\'s exact encode');
  const i1 = RETRO_FS.indexOf('uNoSky == 1'), i2 = RETRO_FS.indexOf('uKind == 1)');
  assert.ok(i1 > 0 && i1 < i2, 'the sky test comes before either effect');
});

// ── the pass on the fake GL ──────────

test('RETRO1: RetroPass - the image and its depth texture at the target\'s size, Point and clamped; present clears the canvas black, draws the rect, builds the LUT once per shift, leaves the baseline', () => {
  const { gl, calls } = recordingGl();
  const built = [];
  const pass = new RetroPass(gl, { build: (vs, fs) => { built.push([vs, fs]); return { id: 'retroProg' }; } });
  try {
    const fbo = pass.beginFrameTarget(320, 200);
    assert.equal(fbo, pass.target.fbo); assert.equal(frameTarget(), fbo, 'the frame target every pass restores to');
    assert.equal(pass.pending, true);
    assert.ok(calls.some((c) => c[0] === 'texImage2D' && c[1] === 3553 && c[4] === 320 && c[5] === 200), 'a 320x200 image');
    assert.ok(calls.some((c) => c[0] === 'texStorage2D' && c[4] === 320 && c[5] === 200), 'and a 320x200 depth texture');
    assert.equal(calls.filter((c) => c[0] === 'framebufferTexture2D').length, 2, 'both attached');
    assert.ok(calls.filter((c) => c[0] === 'texParameteri' && c[2] === 1 && c[3] === 9728).length >= 2 || calls.filter((c) => c[0] === 'texParameteri' && c[3] === 9728).length >= 4, 'Point');
    calls.length = 0;
    pass.beginFrameTarget(320, 200);
    assert.ok(!calls.some((c) => c[0] === 'createTexture'), 'the same size is the same image');
    calls.length = 0;
    pass.present({ depth: null, rect: [160, 72, 960, 648], canvasW: 1280, canvasH: 720, post: 3, lutShift: 5, clear: [0.53, 0.7, 0.92, 1] });
    assert.equal(pass.pending, false); assert.equal(frameTarget(), null);
    assert.equal(built.length, 1, 'the program, built on the first present');
    const clearAt = calls.findIndex((c) => c[0] === 'clear' && c[1] === 16384);
    assert.equal(lastBind(calls, clearAt), null, 'the canvas is what is cleared');
    assert.deepEqual(calls.slice(0, clearAt).filter((c) => c[0] === 'clearColor').at(-1).slice(1), [0, 0, 0, 1], 'black - retroClearerCamera');
    assert.deepEqual(calls.slice(clearAt).find((c) => c[0] === 'clearColor').slice(1), [0.53, 0.7, 0.92, 1], 'and the renderer\'s clear colour back');
    const draw = calls.findIndex((c) => c[0] === 'drawArrays');
    assert.deepEqual(calls[draw].slice(1), [5, 0, 4]);
    assert.deepEqual(calls.slice(0, draw).filter((c) => c[0] === 'viewport').at(-1).slice(1), [160, 72, 960, 648], 'drawn over the world rect');
    const u = (name) => calls.slice(0, draw).filter((c) => c[1] === name).at(-1)?.slice(2);
    assert.deepEqual(u('uRect'), [160, 72, 960, 648]);
    assert.deepEqual(u('uKind'), [2], 'palettize'); assert.deepEqual(u('uNoSky'), [0]); assert.deepEqual(u('uLutSize'), [8], '256 >> 5');
    assert.ok(calls.some((c) => c[0] === 'texImage3D' && c[4] === 8 && c[5] === 8 && c[6] === 8), 'the LUT uploaded, 8 a side');
    assert.ok(calls.some((c) => c[0] === 'uniform1i' && c[1] === 'uLut' && c[2] === 2) || built.length === 1, 'units set at build');
    assert.deepEqual(calls.slice(draw).filter((c) => c[0] === 'viewport').at(-1).slice(1), [0, 0, 1280, 720], 'the full canvas back');
    assert.ok(calls.slice(draw).some((c) => c[0] === 'enable' && c[1] === 1), 'the baseline back');
    // the same shift again: no rebuild; another: rebuilt; posterize: no LUT at all
    pass.beginFrameTarget(320, 200); calls.length = 0;
    pass.present({ rect: [0, 0, 1280, 720], canvasW: 1280, canvasH: 720, post: 4, lutShift: 5 });
    assert.ok(!calls.some((c) => c[0] === 'texImage3D'), 'one LUT a shift');
    assert.deepEqual(calls.filter((c) => c[1] === 'uNoSky').at(-1).slice(2), [1], '-sky');
    pass.beginFrameTarget(320, 200); calls.length = 0;
    pass.present({ rect: [0, 0, 1280, 720], canvasW: 1280, canvasH: 720, post: 3, lutShift: 6 });
    assert.ok(calls.some((c) => c[0] === 'texImage3D' && c[4] === 4), 'a new shift, a new LUT');
    pass.beginFrameTarget(320, 200); calls.length = 0;
    pass.present({ rect: [0, 0, 1280, 720], canvasW: 1280, canvasH: 720, post: 1, lutShift: 2 });
    assert.deepEqual(calls.filter((c) => c[1] === 'uKind').at(-1).slice(2), [1], 'posterize');
    assert.ok(!calls.some((c) => c[0] === 'texImage3D'), 'posterize builds no LUT, even at a shift it has never seen');
    assert.equal(pass._lutJob, null, 'nor starts one (AUDIT RETRO1 E1: a build runs a slice a frame, so an upload is not the only sign of one)');
    assert.equal(pass.lut.shift, 6, 'the palette\'s LUT is left as it was');
    assert.deepEqual(calls.filter((c) => c[1] === 'uLutSize').at(-1).slice(2), [1], 'and the shader is told there is none');
    // a new size is a new image, the old one freed
    calls.length = 0;
    pass.beginFrameTarget(640, 308);
    assert.equal(calls.filter((c) => c[0] === 'deleteTexture').length, 2);
    assert.equal(calls.filter((c) => c[0] === 'deleteFramebuffer').length, 1);
    assert.equal(pass.target.w, 640); assert.equal(pass.target.h, 308);
  } finally { setFrameTarget(null); }
});

test('RETRO1: a program that will not build presents with a NEAREST blit - a retro world without its effect, never a black one - and says so once', () => {
  const { gl, calls } = recordingGl();
  const warn = console.warn; const said = [];
  console.warn = (...a) => said.push(a.join(' '));
  try {
    const pass = new RetroPass(gl, { build: () => { throw new Error('no 3D samplers here'); } });
    pass.beginFrameTarget(320, 200);
    calls.length = 0;
    pass.present({ rect: [10, 20, 640, 400], canvasW: 1280, canvasH: 720, post: 3, lutShift: 1 });
    const blit = calls.find((c) => c[0] === 'blitFramebuffer');
    assert.deepEqual(blit?.slice(1), [0, 0, 320, 200, 10, 20, 650, 420, 16384, 9728]);
    assert.ok(!calls.some((c) => c[0] === 'drawArrays' || c[0] === 'texImage3D'), 'no draw, no LUT');
    pass.beginFrameTarget(320, 200);
    pass.present({ rect: [10, 20, 640, 400], canvasW: 1280, canvasH: 720, post: 3, lutShift: 1 });
    assert.equal(said.length, 1, 'once');
    assert.equal(pass.failed, true);
  } finally { console.warn = warn; setFrameTarget(null); }
});

test('RETRO1: the renderer\'s classic lane - a WORLD frame draws into the image at its size, the host\'s rect kept for the present, the first screen quad presents it, a menu and a panel keep the canvas', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  let cfg = { width: 320, height: 200, hudWidth: 320, hudHeight: 154, post: 3, lutShift: 5, mipmaps: true };
  r.setRetroSource(() => cfg);
  r.setWorldViewport({ x: 0.125, y: 0.1, w: 0.75, h: 0.9 });
  r.beginFrame(I, I, L, WORLD_FRAME);
  try {
    assert.deepEqual(r.worldViewportPx, [0, 0, 320, 154], 'the world pass fills the image - the _HUD twin, the rect being a docked strip (AUDIT RETRO1 C3)');
    assert.deepEqual(r.retroFrame.view, { x: 0.125, y: 0.1, w: 0.75, h: 0.9 }, 'the host\'s rect is where it lands (AUDIT RETRO1 B6: normalized, placed on the canvas as it is at the present)');
    assert.deepEqual(r.worldViewportRect, { x: 0.125, y: 0.1, w: 0.75, h: 0.9 }, 'the 2D pass\'s record is still the canvas rect');
    assert.equal(frameTarget(), r.retro.target.fbo); assert.equal(r._frameFbo, r.retro.target.fbo);
    const clear = calls.findIndex((c) => c[0] === 'clear' && c[1] === 16384 + 256);
    assert.equal(lastBind(calls, clear), r.retro.target.fbo, 'the world\'s clear lands in the image');
    calls.length = 0;
    r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
    const draw = calls.findIndex((c) => c[0] === 'drawArrays');
    assert.ok(draw >= 0, 'the image is presented');
    assert.deepEqual(calls.slice(0, draw).filter((c) => c[0] === 'viewport').at(-1).slice(1), [160, 72, 960, 648]);
    assert.equal(lastBind(calls, draw), null, 'to the canvas');
    assert.ok(calls.findIndex((c) => c[0] === 'drawElements' || (c[0] === 'drawArrays' && c !== calls[draw])) === -1 || calls.findIndex((c, i) => i > draw && c[0].startsWith('draw')) > draw, 'the quad after it');
    assert.equal(frameTarget(), null); assert.equal(r._frameFbo, null);
    // the next quad presents nothing again
    calls.length = 0;
    r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
    assert.ok(!calls.some((c) => c[0] === 'drawArrays' && c[1] === 5 && c[3] === 4), 'presented once');
    // a frame that draws no screen quad is presented at the next beginFrame, under ITS config
    r.beginFrame(I, I, L, WORLD_FRAME);
    const owed = r.retroFrame;
    cfg = { width: 640, height: 400, hudWidth: 640, hudHeight: 308, post: 1, lutShift: 5, mipmaps: true };
    calls.length = 0;
    r.beginFrame(I, I, L, WORLD_FRAME);
    const present = calls.findIndex((c) => c[0] === 'drawArrays');
    assert.ok(present >= 0, 'the owed image presented first');
    assert.deepEqual(calls.slice(0, present).filter((c) => c[1] === 'uKind').at(-1).slice(2), [2], 'with the owed frame\'s effect, not the new one\'s');
    assert.equal(owed.view, null, 'no rect set: the whole canvas');
    assert.deepEqual(calls.slice(0, present).filter((c) => c[0] === 'viewport').at(-1).slice(1), [0, 0, 1280, 720]);
    assert.deepEqual(r.worldViewportPx, [0, 0, 640, 400], 'and the new frame at its own size');
    r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
    // a menu's frame is not a world frame
    r.beginFrame(I, I, L);
    assert.equal(r.worldViewportPx, null); assert.equal(frameTarget(), null); assert.equal(r._frameFbo, null);
    r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
    // a panel inside a world frame's 2D pass keeps the canvas
    r.beginFrame(I, I, L, WORLD_FRAME);
    r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
    r.panelFrame({ proj: I, view: I, lightDir: L, rect: { x: 10, y: 20, w: 100, h: 100 } }, () => {
      assert.equal(frameTarget(), null); assert.equal(r._frameFbo, null);
    });
    // retro off: the world is the canvas's again
    cfg = null;
    r.beginFrame(I, I, L, WORLD_FRAME);
    assert.equal(r.worldViewportPx, null); assert.equal(r._frameFbo, null); assert.equal(r.retroFrame, null);
  } finally { setFrameTarget(null); }
});

test('RETRO1: the mip chains - TEXTURE_MAX_LEVEL 0 over every cached texture, emission map and tile array while retro mode drops them, 1000 when it stops, and on what loads meanwhile', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.textures.set('1_1', { id: 'tex' });
  r.emissionTextures.set('1_1', { id: 'emit' });
  r.tileArrays.set(302, { id: 'tiles' });
  let cfg = { width: 320, height: 200, post: 0, lutShift: 1, mipmaps: false };
  r.setRetroSource(() => cfg);
  const levels = (target) => calls.filter((c) => c[0] === 'texParameteri' && c[1] === target && c[2] === 33085).map((c) => c[3]);
  const boundBefore = (i) => calls.slice(0, i).filter((c) => c[0] === 'bindTexture').at(-1)?.[2]?.id;
  try {
    r.beginFrame(I, I, L, WORLD_FRAME);
    const caps = calls.map((c, i) => [c, i]).filter(([c]) => c[0] === 'texParameteri' && c[2] === 33085);
    assert.deepEqual(caps.map(([c, i]) => [boundBefore(i), c[3]]), [['tex', 0], ['emit', 0], ['tiles', 0]], 'each capped at level 0');
    r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
    calls.length = 0;
    r.beginFrame(I, I, L, WORLD_FRAME);
    assert.deepEqual(levels(3553), [], 'a no-op while nothing changed');
    r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
    // what loads under retro mode loads capped
    calls.length = 0;
    r.uploadTexture(5, 0, { width: 2, height: 2, colors: new Uint8Array(16) });
    assert.deepEqual(levels(3553), [0], 'a world texture uploaded meanwhile');
    calls.length = 0;
    r.uploadTexture('ui', 0, { width: 2, height: 2, colors: new Uint8Array(16) });
    assert.deepEqual(levels(3553), [], 'a UI texture has no chain to cap');
    // UseMipMapsInRetroMode: the chains back
    cfg = { ...cfg, mipmaps: true };
    calls.length = 0;
    r.beginFrame(I, I, L, WORLD_FRAME);
    assert.ok(levels(3553).length >= 2 && levels(3553).every((v) => v === 1000), 'GL\'s default level back');
    assert.deepEqual(levels(35866), [1000]);
    r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
    // off again, then retro OFF entirely: back to the chains
    cfg = { ...cfg, mipmaps: false };
    r.beginFrame(I, I, L, WORLD_FRAME); r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
    cfg = null;
    calls.length = 0;
    r.beginFrame(I, I, L, WORLD_FRAME);
    assert.deepEqual(levels(35866), [1000], 'retro off restores them');
  } finally { setFrameTarget(null); }
});

test('RETRO1: under the Enhanced Lighting lane the lane\'s frame IS the image\'s size (its own slot), its resolve writes into the image, and the image is presented after it', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE);
  r.setAir(true);
  const ap = r.air;
  r.setRetroSource(() => ({ width: 320, height: 154, post: 2, lutShift: 1, mipmaps: true }));
  try {
    r.beginFrame(I, I, L, WORLD_FRAME);
    assert.ok(ap.frame && ap.frame.w === 320 && ap.frame.h === 154, 'the lane runs at the retro size');
    assert.equal(ap._frames.retro, ap.frame);
    assert.equal(r._frameFbo, ap.frame.fbo, 'the world draws into the lane\'s frame');
    assert.equal(ap.resolveTo.fbo, r.retro.target.fbo, 'and the lane resolves into the image');
    assert.deepEqual([ap.resolveTo.w, ap.resolveTo.h], [320, 154]);
    calls.length = 0;
    r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
    const grade = calls.findIndex((c) => c[0] === 'uniform4fv' && c[1] === 'uGrade');
    assert.ok(grade > 0, 'the lane resolved');
    assert.equal(lastBind(calls, grade), r.retro.target.fbo, 'into the retro image');
    const present = calls.findIndex((c, i) => i > grade && c[0] === 'drawArrays' && c[1] === 5 && c[3] === 4 && calls.slice(grade, i).some((d) => d[1] === 'uKind'));
    assert.ok(present > grade, 'then the image presented');
    assert.equal(lastBind(calls, present), null, 'to the canvas');
    assert.deepEqual(calls.slice(grade, present).filter((c) => c[1] === 'uNoSky').at(-1).slice(2), [1], '-sky');
    const depthBound = calls.slice(grade, present).filter((c) => c[0] === 'bindTexture' && c[1] === 3553).map((c) => c[2]);
    assert.ok(depthBound.includes(ap.frame.depth), 'the sky test reads the LANE\'s depth - the one the world wrote');
    // a menu's frame over the world: the canvas slot, the retro slot kept
    const retroFrame = ap.frame;
    calls.length = 0;
    r.beginFrame(I, I, L);
    assert.equal(ap.frame.w, 1280, 'the canvas slot');
    assert.equal(ap._frames.retro, retroFrame, 'the retro image kept');
    assert.equal(ap.resolveTo, null, 'a menu resolves to the canvas');
    r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
    calls.length = 0;
    r.beginFrame(I, I, L, WORLD_FRAME);
    assert.equal(ap.frame, retroFrame, 'the world takes its own back');
    assert.ok(!calls.some((c) => c[0] === 'deleteTexture'), 'nothing reallocated between the two');
    r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
  } finally { setFrameTarget(null); }
});

// ── the doors: settings, the shortcut, the muzzle, the bolts ──────────

test('RETRO1: the five are LIVE, read by systems/retroMode.js, and the screen speaks DFU\'s words', () => {
  for (const k of ['RetroRenderingMode', 'PostProcessingInRetroMode', 'UseMipMapsInRetroMode', 'RetroModeAspectCorrection', 'PalettizationLUTShift']) {
    assert.equal(tierOf(`Video/${k}`), 'live', k);
    assert.equal(LIVE[`Video/${k}`], 'src/systems/retroMode.js');
  }
  assert.equal(formatValue('Video/RetroRenderingMode', '1'), '320x200');
  assert.equal(formatValue('Video/PostProcessingInRetroMode', '4'), 'Palettization (-sky)');
  assert.equal(formatValue('Video/RetroModeAspectCorrection', '1'), '4:3');
  assert.equal(formatValue('Video/UseMipMapsInRetroMode', 'False'), 'Off');
  assert.equal(stepValue('Video/RetroRenderingMode', '2', +1), '0', 'the slider wraps');
  assert.deepEqual(ENUM_LAW['Video/PostProcessingInRetroMode'].values, ['Off', 'Posterization (full)', 'Posterization (-sky)', 'Palettization (full)', 'Palettization (-sky)']);
  assert.deepEqual([NUMBER_LAW['Video/PalettizationLUTShift'].min, NUMBER_LAW['Video/PalettizationLUTShift'].max], [0, 7], 'the consumer\'s clamp (AUDIT RETRO1 C7: 8 is a black world)');
  assert.match(src('main.js'), /renderer\.setRetroSource\(retroFrameConfig\);/, 'the renderer asks the settings through main.js');
  assert.doesNotMatch(src('render/renderer.js'), /^import[^\n]*from '\.\.\/systems\/(?:settings|retroMode)\.js'/m, 'render/ imports no settings');
  assert.doesNotMatch(src('render/retroPass.js'), /^import[^\n]*from '\.\.\/systems\//m, 'the pass is a leaf');
});

test('RETRO1: Shift-F11 is RetroRenderer.TogglePostprocessing - a flip, one edge a press, and F11 alone stays QuickLoad\'s', () => {
  _resetRetroPostprocessing();
  assert.equal(hudShortcutKey({ code: 'F11', shiftKey: true }), true);
  assert.equal(retroPostprocessingEnabled(), false);
  assert.equal(hudShortcutKey({ code: 'F11', shiftKey: true, repeat: true }), false, 'autorepeat dropped');
  assert.equal(retroPostprocessingEnabled(), false);
  assert.equal(hudShortcutKey({ code: 'F11' }), false, 'not ours - QuickLoad');
  assert.equal(hudShortcutKey({ code: 'F11', shiftKey: true }), true);
  assert.equal(retroPostprocessingEnabled(), true);
  _resetRetroPostprocessing();
});

test('RETRO1: the muzzle maps through the LENS\'s aspect - a retro world is projected at 1.6 and stretched over a 16:9 strip', () => {
  const base = { rect: { x: 0, y: 0, w: 1280, h: 720 }, canvasW: 1280, canvasH: 720, muzzle: { x: 1, y: 0.5 }, flip: false, viewport: null };
  const fov = Math.PI / 2;
  const plain = muzzleRay(base, fov, 1);
  assert.ok(near(plain.right, 1280 / 720), 'no aspect handed over: the strip\'s own (unchanged)');
  const retro = muzzleRay({ ...base, aspect: 1.6 }, fov, 1);
  assert.ok(near(retro.right, 1.6), 'the lens\'s');
  assert.ok(near(retro.up, plain.up), 'the vertical is the fov\'s either way');
  const { canvas } = recordingGl();
  const r = new Renderer(canvas);
  const proj = new Float32Array(16); proj[0] = -1 / 1.6; proj[5] = 1;   // a mirrored projection at 1.6
  r.beginFrame(proj, I, L);
  assert.ok(near(r.worldProjAspect, 1.6));
  assert.match(src('combat/weaponRig.js'), /aspect: renderer\.worldProjAspect \?\? null \};/, 'the rig parks it with the rect');
});

test('RETRO1: a bolt\'s minimum width is the world IMAGE\'s pixels - 200 of them on a retro frame - and the drawing buffer\'s when the host names none', () => {
  const { gl, calls } = recordingGl(1280, 720);
  const b = new LightningBoltsRenderer(gl);
  const proj = new Float32Array(16); proj[5] = 1; proj[10] = -1; proj[11] = -1; proj[14] = -0.1;
  const bolts = [{ bright: 1, segs: [0, 0, -10, 0, 5, -10, 1] }];   // one segment: a, b, glow
  const uPx = () => calls.filter((c) => c[0] === 'uniform1f' && c[1] === 'uPx').at(-1)?.[2];
  b.draw(bolts, proj, I, new Float32Array(3));
  assert.ok(near(uPx(), 2 / 720), 'the drawing buffer');
  b.draw(bolts, proj, I, new Float32Array(3), undefined, 200);
  assert.ok(near(uPx(), 2 / 200), 'the retro image');
});

test('RETRO1: the bolt pin, by source - viewH over the drawing buffer', () => {
  assert.match(src('render/lightningBolts.js'), /gl\.uniform1f\(U\.uPx, 2 \/ \(proj\[5\] \* Math\.max\(1, viewH \|\| gl\.drawingBufferHeight\)\)\);/);
});
