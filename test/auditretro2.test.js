// AUDIT RETRO1, THE SECOND PASS (2026-09-24, Mac: "One more audit") - main
// merged in first (DISC22, OVH1-OVH4, FGH2H, QUEST-UID1), then five fresh
// lenses: the first pass's own fixes (F), integration with main and play
// (G), fidelity (H - records only), the pins and the docs (I), cost and
// robustness (J). Each pin below is one confirmed finding and fails with
// its fix reverted (tools/mutants/auditretro2.json):
//
//   F  the ?exterior modal foot (F1, in auditretro1's C8), a pack's per-frame
//      art uncapped (F2), the lane's resolve under a live scissor (F3), the
//      LUT's jobs and failures (F4-F7 with J3-J6), the first-person overlay
//      where retro off puts it, on either lane (F8/G4, in auditretro1's C2)
//   G  a stale held modifier (G1), the settings' page test (G2), the outdoor
//      hosts' action read (G3)
//   I  the pins the first pass lacked (I3-I6)
//   J  ?perf measures the present (J1), the LUT streamed a slab at a time
//      under a block cap (J3/J4), a lost context's null texture (J7)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  buildRetroLut, retroLutSteps, RETRO_FS, RetroPass, RETRO_LUT_MAX_BLOCKS, RETRO_LUT_BUDGET_MS,
} from '../src/render/retroPass.js';
import { setFrameTarget } from '../src/render/renderTarget.js';
import { Renderer, WORLD_FRAME } from '../src/render/renderer.js';
import { EL_LANE } from '../src/render/enhancedLighting.js';
import { drawRigSpriteBox } from '../src/render/characterSprite.js';
import { keyboardModifiers, MOD } from '../src/systems/dialogShortcuts.js';
import { routeKey } from '../src/ui/input.js';
import { retroToggleKey } from '../src/ui/hudShortcuts.js';
import { _resetRetroPostprocessing, retroPostprocessingEnabled } from '../src/systems/retroMode.js';
import { E, stateGl, presents, retroCfg, programBuilder } from './retroGl.mjs';
import { drawHud } from '../src/ui/hud.js';
import { nativeMetrics } from '../src/ui/nativePanel.js';
import { crosshairCentreY } from '../src/ui/hudCrosshair.js';
import { largeHudRect } from '../src/ui/hudLarge.js';
import { lootPanelBounds, PARCHMENT, parchmentImage, _setLootPanelSeamsForTests } from '../src/ui/classicLootPanel.js';
import { parseHexColor, DEFAULT_TOOLTIP_TEXT_BG } from '../src/ui/toolTip.js';
import { worldHoverFrame, destroyWorldPlaque } from '../src/ui/worldPlaque.js';
import { resetQuickLoot } from '../src/systems/quickLoot.js';
import { setUiSkin } from '../src/systems/uiSkin.js';
import { setUiPack } from '../src/systems/uiPack.js';
import { getString, setValue, _resetForTests as resetSettings } from '../src/systems/settings.js';
import { _resetForTests as resetPrefs } from '../src/systems/uiPrefs.js';
import { readPng } from '../tools/pngIO.mjs';

const src = (rel) => readFileSync(new URL(`../src/${rel}`, import.meta.url), 'utf8');
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const L = new Float32Array([0.3, 0.8, -0.2]);
const Q = { x: 0, y: 0, w: 1, h: 1 };
const palettize = (pass, lutShift) => { pass.beginFrameTarget(320, 200); pass.present({ rect: [0, 0, 1280, 720], canvasW: 1280, canvasH: 720, post: 3, lutShift }); return pass.P.p.values.uKind[0]; };
const quiet = (fn) => { const warn = console.warn, said = []; console.warn = (...a) => said.push(a.join(' ')); try { fn(said); } finally { console.warn = warn; } return said; };

// ── F: the first pass's own fixes ──────────

test('AUDIT RETRO1 F2: a texture pack\'s art for an animated flat\'s frame is TryImportTexture\'s too - flagged, as the record\'s own swap is', () => {
  const dp = src('scenes/dataPipeline.js');
  assert.match(dp, /const replacement = !!swapFrame;[^\n]*\n\s+renderer\.uploadTexture\(archive, key, color32, \{ replacement \}\);/);
  assert.match(dp, /renderer\.uploadEmissionTexture\(archive, key, color32, \{ white: true, replacement \}\);/);
});

test('AUDIT RETRO1 F3: under the lane a screen scissor live at the frame\'s first quad is lifted for the passes and the resolve into the retro image, and put back', () => {
  const { canvas, s } = stateGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE); r.setAir(true);
  r.setRetroSource(() => retroCfg({ post: 0 }));
  try {
    r.beginFrame(I, I, L, WORLD_FRAME);
    r.setScreenScissor(100, 100, 50, 50);
    const box = [...s.scissor];
    s.draws.length = 0;
    r.drawScreenQuad(null, Q);
    const resolve = s.draws.find((d) => d.prog?.locs?.has('uGrade'));
    assert.equal(resolve.fb, r.retro.target.fbo, 'the resolve writes the retro image');
    assert.equal(resolve.scissorOn, false, 'whole - a canvas box above row 200 clipped it away');
    assert.equal(s.draws.filter((d) => d.prog?.locs?.has('uGrade') || d.fb !== null).every((d) => !d.scissorOn), true, 'every pass of the resolve');
    assert.equal(presents(s)[0].scissorOn, false, 'and the present');
    assert.ok(s.enabled.has(E.SCISSOR_TEST) && s.scissor.join() === box.join(), 'put back as it was');
    r.clearScreenScissor();
  } finally { setFrameTarget(null); }
  // ...and with retro off, where no present puts it back for the resolve
  const { canvas: c2, s: s2 } = stateGl();
  const r2 = new Renderer(c2);
  r2.setLightingLane(EL_LANE); r2.setAir(true);
  try {
    r2.beginFrame(I, I, L, WORLD_FRAME);
    r2.setScreenScissor(100, 100, 50, 50);
    s2.draws.length = 0;
    r2.drawScreenQuad(null, Q);
    assert.equal(s2.draws.find((d) => d.prog?.locs?.has('uGrade')).scissorOn, false, 'the resolve to the canvas, whole');
    assert.ok(s2.enabled.has(E.SCISSOR_TEST), 'the box back for the quad that asked for it');
    assert.equal(s2.draws.at(-1).scissorOn, true, 'and the quad drawn inside it');
    r2.clearScreenScissor();
  } finally { setFrameTarget(null); }
});

test('AUDIT RETRO1 F4/J6: a build for a shift the player has left is dropped - its half-filled texture freed - once the cached shift comes back', () => {
  const { gl } = stateGl();
  const pass = new RetroPass(gl, { build: programBuilder(gl), now: () => 0, lutMaxBlocks: 4 });
  try {
    for (let f = 0; f < 10 && !pass.lut; f++) palettize(pass, 5);
    const five = pass.lut.tex;
    assert.equal(palettize(pass, 0), 0, 'shift 0: a build begun, plain meanwhile');
    const job = pass._lutJob;
    assert.ok(job && job.shift === 0);
    assert.equal(palettize(pass, 5), 2, 'back to the table it has');
    assert.equal(pass._lutJob, null, 'the shift-0 build dropped');
    assert.equal(job.tex.deleted, true, 'and its texture freed');
    assert.equal(pass.lut.tex, five);
  } finally { setFrameTarget(null); }
});

test('AUDIT RETRO1 F5/J5: a failed shift is tried again once the shift or retro mode changes - a transient failure no longer costs the session its palette', () => {
  const base = stateGl();
  let refuse = 1;
  const gl = new Proxy(base.gl, { get: (t, k) => (k === 'texSubImage3D' && refuse > 0 ? () => { refuse--; throw new RangeError('out of memory'); } : t[k]) });
  const said = quiet(() => {
    const pass = new RetroPass(gl, { build: programBuilder(gl), now: () => 0 });
    try {
      assert.equal(palettize(pass, 5), 0, 'the failure: plain');
      assert.equal(palettize(pass, 5), 0, 'the same shift: not tried again');
      assert.equal(palettize(pass, 6), 2, 'another shift builds');
      assert.equal(palettize(pass, 5), 2, 'and the failed one, come back to, is tried again');
      refuse = 1;
      palettize(pass, 4);
      pass.dropLut();   // retro mode off
      assert.equal(pass._lutFailed, null, 'retro off forgets the failure');
      assert.equal(palettize(pass, 4), 2);
    } finally { setFrameTarget(null); }
  });
  assert.equal(said.filter((m) => m.includes('LUT')).length, 2, 'each failure said once');
});

test('AUDIT RETRO1 F6/J5: WebGL reports a failed allocation through getError, not a throw - the table is not cached incomplete (black), and a slab goes up with the unpack flags off', () => {
  const base = stateGl();
  let err = 0;
  const gl = new Proxy(base.gl, {
    get: (t, k) => (k === 'getError' ? () => { const e = err; err = 0; return e; }
      : k === 'texStorage3D' ? (...a) => { t.texStorage3D(...a); err = 0x0505; } : t[k]),   // OUT_OF_MEMORY
  });
  const said = quiet(() => {
    const pass = new RetroPass(gl, { build: programBuilder(gl), now: () => 0 });
    try {
      assert.equal(palettize(pass, 5), 0, 'plain, never black');
      assert.equal(pass.lut, null, 'nothing cached');
      assert.ok(base.calls.some((c) => c[0] === 'deleteTexture'), 'the dead texture freed');
    } finally { setFrameTarget(null); }
  });
  assert.equal(said.length, 1);
  // the flags: FLIP_Y and PREMULTIPLY off before every slab
  const { gl: g2, calls } = stateGl();
  const pass = new RetroPass(g2, { build: programBuilder(g2), now: () => 0 });
  try { palettize(pass, 5); } finally { setFrameTarget(null); }
  const up = calls.findIndex((c) => c[0] === 'texSubImage3D');
  const before = calls.slice(0, up).filter((c) => c[0] === 'pixelStorei');
  assert.deepEqual(before.slice(-2).map((c) => [c[1], c[2]]), [[E.UNPACK_FLIP_Y_WEBGL, false], [E.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false]]);
});

test('AUDIT RETRO1 F7/J3/J4: the LUT is built a block at a time, never more than RETRO_LUT_MAX_BLOCKS a frame however coarse the clock, streamed into its texture a z-slab at a time', () => {
  assert.equal(RETRO_LUT_MAX_BLOCKS, 128);
  let first = null;
  for (const v of retroLutSteps(0)) { if (v) { first = v; break; } }
  assert.equal(first.data.length, 256 * 256 * 8 * 4, 'shift 0 holds one 2 MiB slab, not the 64 MiB table');
  assert.equal(buildRetroLut(4).data.length, 16 ** 3 * 4, 'buildRetroLut still lays the whole table');
  // a clock that never moves: the cap alone ends a slice
  const { gl, calls, s } = stateGl();
  const pass = new RetroPass(gl, { build: programBuilder(gl), now: () => 0 });
  try {
    let frames = 0, kinds = [];
    while (!pass.lut && frames < 100) { kinds.push(palettize(pass, 2)); frames++; }
    assert.equal(frames, Math.ceil((8 ** 3 + 8) / RETRO_LUT_MAX_BLOCKS), 'shift 2: 512 blocks and 8 slabs, 128 steps a frame');
    assert.ok(kinds.slice(0, -1).every((k) => k === 0) && kinds.at(-1) === 2, 'plain until whole');
    assert.equal(calls.filter((c) => c[0] === 'texSubImage3D').length, 8, 'a slab of 8 layers at a time');
    assert.equal(calls.filter((c) => c[0] === 'texImage3D').length, 0, 'never the whole table at once');
    assert.equal(pass.lut.tex.layers.size, 64);
    assert.equal(s.units[2][E.TEXTURE_3D] ?? null, null);
  } finally { setFrameTarget(null); }
  // the SHIPPED pass: 4 ms a frame - on a clock that moves 1 ms a read, a 520-step build takes ~130 frames
  const { gl: g2 } = stateGl();
  let clock = 0;
  const shipped = new RetroPass(g2, { build: programBuilder(g2), now: () => (clock += 1) });
  try {
    let frames = 0;
    while (!shipped.lut && frames < 1000) { palettize(shipped, 2); frames++; }
    assert.ok(frames >= 520 / RETRO_LUT_BUDGET_MS - 5, `the default budget holds: ${frames} frames`);
  } finally { setFrameTarget(null); }
});

test('AUDIT RETRO1 I4: the LUT\'s lifecycle - a shift changed mid-build builds the new shift, the old table is freed, retro off drops the build, and shift 0\'s bytes are DFU\'s', () => {
  const { gl } = stateGl();
  const pass = new RetroPass(gl, { build: programBuilder(gl), now: () => 0, lutMaxBlocks: 3 });
  try {
    palettize(pass, 1);
    for (let f = 0; f < 400 && !pass.lut; f++) palettize(pass, 2);
    assert.deepEqual([pass.lut.shift, pass.lut.size, pass.lut.tex.w], [2, 64, 64], 'the new shift\'s table, not the old build\'s');
    const two = pass.lut.tex;
    for (let f = 0; f < 400 && pass.lut.shift !== 5; f++) palettize(pass, 5);
    assert.equal(two.deleted, true, 'the old table freed');
    palettize(pass, 3);
    const job = pass._lutJob;
    pass.dropLut();
    assert.equal(pass._lutJob, null, 'retro off drops the build');
    assert.equal(job.tex.deleted, true);
  } finally { setFrameTarget(null); }
  assert.equal(createHash('sha256').update(buildRetroLut(0).data).digest('hex'), 'd44aef3ae44ac342477f0a1598c07323974f02432632c16dd617ba924df433ec', 'shift 0, the finest - where the candidate bound\'s `<=` decides two texels');
});

test('AUDIT RETRO1 I5: what the present hands the shader - the 640x400 presentation texel, the image fetched unflipped, a full-screen strip', () => {
  const { gl, calls } = stateGl();
  const pass = new RetroPass(gl, { build: programBuilder(gl), now: () => 0 });
  try {
    palettize(pass, 5);
    assert.deepEqual(pass.P.p.values.uPresent, [640, 400]);
    assert.deepEqual(Array.from(calls.find((c) => c[0] === 'bufferData')[2]), [-1, -1, 1, -1, -1, 1, 1, 1]);
  } finally { setFrameTarget(null); }
  assert.match(RETRO_FS, /\n {2}vec4 c = texture\(uColor, uv\);\n/);
});

// ── G: integration ──────────

test('AUDIT RETRO1 G1: a held modifier the event does not report is stale - Shift-F11 with a lost Alt keyup is still the toggle, F11 with a lost Shift keyup is still QuickLoad', () => {
  const ev = (o) => ({ code: 'F11', key: 'F11', shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, target: null, preventDefault() {}, ...o });
  assert.equal(keyboardModifiers(ev({ shiftKey: true }), new Set(['AltLeft', 'ShiftLeft'])), MOD.LeftShift | MOD.Shift);
  assert.equal(keyboardModifiers(ev({}), new Set(['ShiftLeft'])), MOD.None);
  assert.equal(keyboardModifiers({ code: 'F11' }, new Set(['ShiftLeft'])), MOD.LeftShift | MOD.Shift, 'an event with no flags leaves the Set its say');
  let loads = 0;
  const ctx = { uiOverlayActive: true, overlayIsNative: false, overlayInput() {}, quickLoad: () => { loads++; } };
  _resetRetroPostprocessing();
  assert.equal(retroToggleKey(ev({ shiftKey: true }), new Set(['AltLeft'])), true);
  routeKey(ev({ shiftKey: true }), ctx, null, new Set(['AltLeft', 'ShiftLeft']));
  assert.equal(loads, 0, 'no quickload');
  routeKey(ev({}), ctx, null, new Set(['ShiftLeft']));
  assert.equal(loads, 1, 'F11 under the death screen loads');
  assert.equal(retroPostprocessingEnabled(), true);
  _resetRetroPostprocessing();
});

test('AUDIT RETRO1 G2/G3: the settings\' page test comes after the forced table (a dozen reads a frame); the outdoor hosts\' action read never sees Shift-F11', () => {
  assert.match(src('systems/onlineLane.js'), /return Object\.hasOwn\(ONLINE_FORCED_SETTINGS\[section\] \?\? \{\}, key\) && isOnlinePage\(search\)/);
  for (const f of ['scenes/world.js', 'scenes/exterior.js']) {
    assert.match(src(f), /const acts = retroToggleKey\(e, keys\) \? \[\] : actionsOf\(e, keys\);/, f);   // UXB1-S: every action a shared key carries, none under the chord
  }
});

test('AUDIT RETRO1 G5: DISC22-C\'s loot panel stands beside the crosshair where it is - re-centred into a docked bar\'s strip - and clear of a large-HUD bar drawn before it, docked or not', async () => {
  const canvas = { width: 1920, height: 1080 };
  const m = nativeMetrics(canvas);   // 5x, 40 px of letterbox above and below
  assert.deepEqual(lootPanelBounds(m, crosshairCentreY(1080, 0), 1080), { centreY: 100, bottom: 200 }, 'the plain HUD: the native screen\'s middle and foot, where it always stood');
  const font = { fnt: { fixedHeight: 7, fixedWidth: 5, glyphWidth: () => 5, glyphs: [], chars: [] } };
  const art = { health: { tex: 'h', w: 4, h: 32 }, fatigue: { tex: 'f', w: 4, h: 32 }, magicka: { tex: 'm', w: 4, h: 32 }, compass: { tex: 'c', w: 322, h: 17 }, compassBox: { tex: 'b', w: 69, h: 17 }, breathNormal: { tex: 'n', w: 1, h: 1 }, breathShort: { tex: 's', w: 1, h: 1 } };
  const vitals = { health: 50, maxHealth: 50, magicka: 20, maxMagicka: 20, fatigue: 6400, stats: { strength: 50, endurance: 50 } };
  let pile = [];
  const hover = () => worldHoverFrame({
    eye: [0, 0, 0], dir: [0, 0, 1], collider: { raycast: () => Infinity },
    targets: () => [{ key: 'loot:7', aabb: { min: [-1, -1, 1], max: [1, 1, 2] }, distance: 1, reach: 3.2 }],
    name: () => ({ title: 'Loot Pile' }), contents: () => pile,
  });
  const r = { quads: [], uploadTexture: (_a, rec) => ({ r: rec }), drawScreenQuad(tex, dst, uv, color) { this.quads.push({ tex, dst, color }); } };
  const frame = (large) => { hover(); r.quads.length = 0; drawHud(r, canvas, art, vitals, 0, 0, { font, largeHud: { art: { main: { tex: 'tex:MAIN00I0' } }, alignment: 0, mode: 'info', ...large } }); };
  const span = (qs) => [Math.min(...qs.map((q) => q.dst.y)), Math.max(...qs.map((q) => q.dst.y + q.dst.h))];
  resetSettings(); resetPrefs(); resetQuickLoot();
  setUiSkin('classic');
  _setLootPanelSeamsForTests({ fetch: async () => new Uint8Array(readFileSync(new URL(`../public/art/${PARCHMENT.file}`, import.meta.url))), decode: async (b) => readPng(b) });
  try {
    setValue('GUI', 'LargeHUD', true);
    // (a) DOCKED - the bar 46 * 1920/320 = 276 px, the crosshair re-centred to (1080 - 276) / 2 = 402. The panel stood
    // on the screen's own 540
    setValue('GUI', 'LargeHUDDocked', true);
    pile = [{ name: 'Ruby' }, { name: 'Steel Longsword' }, { name: 'Leather Cuirass' }, { name: 'Gold' }];
    frame({ docked: true }); frame({ docked: true });   // the first frame paints the bar
    const bg = parseHexColor(getString('GUI', 'ToolTipBackgroundColor'), DEFAULT_TOOLTIP_TEXT_BG);
    const box = r.quads.find((q) => q.tex === null && q.dst.w === 120 * m.s && String(q.color) === String(bg));
    assert.ok(box, 'DFU\'s tooltip box, drawn');
    const [top, foot] = span([box]);
    assert.ok(Math.abs((top + foot) / 2 - 402) <= m.s, `centred on the crosshair's row, 402 - not the screen's 540 (${(top + foot) / 2})`);
    // ...and the parchment, four rows: it reached 835, over the bar's top at 804
    setUiPack('grimoire');
    parchmentImage(r);
    await new Promise((res) => setTimeout(res, 30));
    frame({ docked: true });
    const sheet = r.quads.filter((q) => q.tex?.r === PARCHMENT.file);
    assert.equal(sheet.length, 3, 'Mac\'s parchment, in its three pieces');
    const [pTop, pFoot] = span(sheet);
    assert.ok(Math.abs((pTop + pFoot) / 2 - 402) <= m.s && pFoot <= 804, `the parchment beside the crosshair and above the bar (${pTop}..${pFoot})`);
    // (b) UNDOCKED at LargeHUDUndockedScale 1 - the crosshair on the screen's middle, the bar an overlay whose top is
    // 1080 - 46 * 5 = 850. The tallest list (six rows and "and 3 more") centred there reached 875; it stands above it
    setValue('GUI', 'LargeHUDDocked', false);
    pile = Array.from({ length: 9 }, (_, i) => ({ name: `Thing ${i}` }));
    const bar = largeHudRect(canvas, { docked: false, undockedScale: 1, alignment: 0 });
    frame({ docked: false, undockedScale: 1 }); frame({ docked: false, undockedScale: 1 });
    const [, uFoot] = span(r.quads.filter((q) => q.tex?.r === PARCHMENT.file));
    assert.equal(bar.y, 850);
    assert.ok(uFoot <= bar.y, `clear of the undocked bar it is drawn after (${uFoot} against ${bar.y})`);
  } finally {
    setUiPack('none'); _setLootPanelSeamsForTests(); destroyWorldPlaque(); resetQuickLoot(); resetPrefs(); resetSettings();
  }
});

// ── I: the pins the first pass lacked ──────────

test('AUDIT RETRO1 I3: a cleared screen scissor stays cleared - the present never re-arms a box the 2D pass let go', () => {
  const { canvas, s } = stateGl();
  const r = new Renderer(canvas);
  r.setRetroSource(() => retroCfg());
  try {
    r.beginFrame(I, I, L, WORLD_FRAME); r.drawScreenQuad(null, Q);
    r.setScreenScissor(100, 100, 50, 50); r.drawScreenQuad(null, Q); r.clearScreenScissor();
    r.beginFrame(I, I, L, WORLD_FRAME); r.drawScreenQuad(null, Q);
    assert.equal(s.enabled.has(E.SCISSOR_TEST), false);
  } finally { setFrameTarget(null); }
});

test('AUDIT RETRO1 I6: the half-pinned fixes - a replacement\'s emission map passed by the sweep, a panel resolving the lane before its scissor and its body, the bright pass over a menu frame\'s whole image, the span over a docked strip, a sprite texel never 0, the host\'s strip back when retro turns off', () => {
  // (a) the sweep passes a replacement's emission map by
  {
    const { canvas } = stateGl();
    const r = new Renderer(canvas);
    let cfg = retroCfg({ mipmaps: true });
    r.setRetroSource(() => cfg);
    try {
      r.beginFrame(I, I, L, WORLD_FRAME); r.drawScreenQuad(null, Q);
      const img = { width: 2, height: 2, colors: new Uint8Array(16) };
      const emit = r.uploadEmissionTexture(8, 0, img, { replacement: true });
      emit.params[E.TEXTURE_MAX_LEVEL] = 'untouched';
      cfg = retroCfg({ mipmaps: false });
      r.beginFrame(I, I, L, WORLD_FRAME); r.drawScreenQuad(null, Q);
      assert.equal(emit.params[E.TEXTURE_MAX_LEVEL], 'untouched');
    } finally { setFrameTarget(null); }
  }
  // (b) no retro, the lane: a panel opened before the first quad resolves the frame first, unscissored - and
  // before its body draws: a panel with no clear quad (clear: null) drew on the canvas and the frame's first
  // screen quad then composited the owed frame over it (F3's lifted scissor made `scissorOn` alone blind to it)
  {
    const { canvas, s } = stateGl();
    const r = new Renderer(canvas);
    r.setLightingLane(EL_LANE); r.setAir(true);
    const isGrade = (d) => d.prog?.locs?.has('uGrade');
    try {
      r.beginFrame(I, I, L, WORLD_FRAME);
      s.draws.length = 0;
      let atBody = -1;
      r.panelFrame({ proj: I, view: I, lightDir: L, rect: { x: 10, y: 20, w: 100, h: 100 }, clear: null }, () => { atBody = s.draws.filter(isGrade).length; });
      assert.equal(atBody, 1, 'the owed frame is on the canvas before the panel draws over it');
      r.drawScreenQuad(null, Q);
      const grades = s.draws.filter(isGrade);
      assert.equal(grades.length, 1, 'and not composited again over the panel');
      assert.equal(grades[0].scissorOn, false, 'before the panel\'s own scissor');
    } finally { setFrameTarget(null); }
  }
  // (c) the bright pass reads a menu frame's whole image too
  {
    const { canvas } = stateGl();
    const r = new Renderer(canvas);
    r.setLightingLane(EL_LANE); r.setAir(true);
    r.setRetroSource(() => retroCfg({ post: 0 }));
    try {
      r.beginFrame(I, I, L, WORLD_FRAME); r.drawScreenQuad(null, Q);
      r.beginFrame(I, I, L); r.drawScreenQuad(null, Q);
      assert.deepEqual(r.air.programs.bright.p.values.uRect, [0, 0, 1280, 720]);
    } finally { setFrameTarget(null); }
  }
  // (d) the span over a docked strip, and a texel never 0 for a fine pixel on a tall canvas
  {
    const { canvas } = stateGl(1280, 720);
    const r = new Renderer(canvas);
    r.setRetroSource(() => retroCfg());
    try {
      r.setWorldViewport({ x: 0, y: 0.25, w: 1, h: 0.75 });
      r.beginFrame(I, I, L, WORLD_FRAME);
      assert.deepEqual(r.retroImageSpan, [154, 540], 'the _HUD image over the strip\'s 540 rows');
      r.drawScreenQuad(null, Q);
    } finally { setFrameTarget(null); }
    const sized = [];
    const rend = { retroImageSpan: [200, 1440], renderCharacterSprite: (_m, _r, _p, _v, pw, ph) => { sized.push([pw, ph]); return {}; }, drawCharacterSpriteQuad() {} };
    drawRigSpriteBox(rend, { clientWidth: 2560, clientHeight: 1440 }, {}, I, { center: [0, 0, 0], halfW: 0.25, halfH: 0.5 }, I, I, [0, 0, -10], 3);
    assert.deepEqual(sized[0], [50, 100], 'MW_ARM_PIXEL 3 over 1440 rows is 0.42 of an image pixel - one, not none');
  }
  // (e) the frame retro turns off on gives the world the host's strip back
  {
    const { canvas, s } = stateGl();
    const r = new Renderer(canvas);
    let cfg = retroCfg();
    r.setRetroSource(() => cfg);
    try {
      r.setWorldViewport({ x: 0, y: 0.25, w: 1, h: 0.75 });
      r.beginFrame(I, I, L, WORLD_FRAME);   // no quad: owed
      cfg = null;
      r.setWorldViewport({ x: 0, y: 0.25, w: 1, h: 0.75 });
      r.beginFrame(I, I, L, WORLD_FRAME);
      assert.deepEqual(s.viewport, [0, 180, 1280, 540]);
      r.drawScreenQuad(null, Q);
    } finally { setFrameTarget(null); }
  }
});

// ── J: cost and robustness ──────────

test('AUDIT RETRO1 J1: `?perf` measures the retro present - and the LUT slice inside it - before it closes the frame, on either lane', () => {
  for (const lane of [false, true]) {
    const { canvas } = stateGl();
    const r = new Renderer(canvas);
    if (lane) { r.setLightingLane(EL_LANE); r.setAir(true); }
    r.setRetroSource(() => retroCfg());
    const seen = [];
    r._perf = { begin() { seen.push('begin'); }, mark(n) { seen.push(`mark:${n}`); }, end() { seen.push('end'); }, stop() { seen.push('stop'); }, frame() { seen.push('frame'); return null; } };
    try {
      r.beginFrame(I, I, L, WORLD_FRAME);
      const present = r.retro.present.bind(r.retro);
      r.retro.present = (o) => { seen.push('present'); return present(o); };
      r.drawScreenQuad(null, Q);
      const p = seen.indexOf('present');
      assert.ok(p > 0, `${lane ? 'lane' : 'classic'}: presented`);
      assert.equal(seen[p - 1], 'mark:retro', 'its own span');
      assert.ok(seen.indexOf('end', p) > p && !seen.slice(0, p).includes('end'), 'the frame closes after it');
    } finally { setFrameTarget(null); }
  }
});

test('AUDIT RETRO1 J7: a lost context\'s null texture is no WeakSet key - a replacement upload, and OVH2\'s alpha art, does what a classic one does, nothing', () => {
  const { gl: base, canvas } = stateGl();
  const lost = new Proxy(base, { get: (t, k) => (k === 'createTexture' ? () => null : t[k]) });
  canvas.getContext = () => lost;
  const r = new Renderer(canvas);
  const img = { width: 2, height: 2, colors: new Uint8Array(16) };
  assert.doesNotThrow(() => r.uploadTexture(7, 0, img, { replacement: true }));
  assert.doesNotThrow(() => r.uploadEmissionTexture(7, 0, img, { replacement: true }));
  assert.doesNotThrow(() => r.uploadTexture(7, 1, img, { alpha: true }), 'OVH2\'s `_alphaArt` add, the same shape (a pack\'s soft-edged art, the loot parchment)');
});

test('AUDIT RETRO1 J8: a menu\'s frame resolved through the lane opens no `?perf` span - the world frame\'s meter had closed, and the `air` zone it opened stayed open through the rAF wait to the next world frame', () => {
  const { canvas } = stateGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE); r.setAir(true);
  const seen = [];
  r._perf = { begin() { seen.push('begin'); }, mark(n) { seen.push(`mark:${n}`); }, end() { seen.push('end'); }, stop() { seen.push('stop'); }, frame() { seen.push('frame'); return null; } };
  try {
    r.beginFrame(I, I, L, WORLD_FRAME); r.drawScreenQuad(null, Q);
    assert.ok(seen.includes('mark:air') && seen.at(-1) === 'frame', 'a world frame: its air span, closed with the frame');
    seen.length = 0;
    r.beginFrame(I, I, L); r.drawScreenQuad(null, Q);   // a menu or a video over the world - still the lane's frame, still resolved
    assert.deepEqual(seen, [], 'nothing opened after the meter closed');
  } finally { setFrameTarget(null); }
});
