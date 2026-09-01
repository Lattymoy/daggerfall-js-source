// ROAD-C c2/S5: THE NATIVE DUNGEON AUTOMAP WINDOW, pinned where nothing
// else can pin it.
//
// Flight 1's four modules are each pinned in isolation - the camera's
// arithmetic, the chrome's rects and press-hold machine, the bracket's
// save/return, the reveal model. NONE of those pins can catch the
// failure this stage actually risks, which is the ASSEMBLY: a verb table
// wired to the wrong camera function, a background arm that paints where
// DFU paints nothing, a pass that keeps the host's lighting, a window
// that reads the PLAYER's heading into the map compass. So every pin
// below drives the real window object and reads what it did.
//
// TWO HARNESSES, on purpose. The layout, order and background pins run
// on a recording stub (fast, and the assertions are rects and colours).
// The UNLIT pin runs on the REAL Renderer over the EV6 counting Proxy-GL,
// because half of that law is "and the bracket hands every global back" -
// which a stub renderer would be asserting about itself.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Renderer } from '../src/render/renderer.js';
import {
  AutomapWindow, AUTOMAP_BACKGROUNDS, BACKGROUND_HOTKEYS, GRID_CUTOUT,
  AUTOMAP_IMG, AUTOMAP_IMG_GRID_3D, HOTKEYS_DOWN, HOTKEYS_HELD, HOTKEY_VERBS,
  RENDER_MODES, signalAutomapReset, resetAutomapWindowState,
  automapCameraState, automapBackground, automapRenderMode, _setAutomapArt,
} from '../src/ui/automapWindow.js';
import {
  AUTOMAP_STRINGS, automapText, automapTooltipFor, shortcutOrFallback,
  AUTOMAP_FALLBACK_KEY, AUTOMAP_TOOLTIPS,
} from '../src/ui/automapText.js';
import {
  CHROME_RECTS, HOVER_LABEL, HOLD_BUTTONS, CLICK_BUTTONS, DUNGEON_ACTIONS,
} from '../src/ui/automapChrome.js';
import {
  VIEW_2D, VIEW_3D, cameraYawDeg, CAMERA_HEIGHT_VIEW_FROM_TOP,
  SCROLL_FORWARD_BACKWARD_SPEED, MOVE_PIVOT_FORWARD_BACKWARD_SPEED,
  DEFAULT_SLICING_BIAS_Y, DEFAULT_FIELD_OF_VIEW_3D, MOVE_UP_DOWN_SPEED,
} from '../src/ui/automapCamera.js';
import { AUTOMAP_PANEL_NATIVE_RECT } from '../src/render/renderer.js';
import { setValue, _resetForTests } from '../src/systems/settings.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');
const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

const FONT = { fnt: { fixedWidth: 6, fixedHeight: 7, glyphWidth: () => 5 }, tex: 'atlas' };
// A 320x200 canvas puts nativeMetrics at scale 1 with no letterbox, so
// every recorded rect IS a native rect and the assertions read as the C#.
const CANVAS = { width: 320, height: 200 };

const fakeArt = () => ({
  bg: { tex: 'AMAP00I0', w: 320, h: 200 },
  grid3d: { tex: 'AMAP01I0', w: 27, h: 19 },
  compass: { tex: 'COMPASS', w: 258 + 64, h: 13 },
  compassBox: { tex: 'COMPBOX', w: 69, h: 17 },
});

function stubRenderer(log) {
  const r = {
    canvas: CANVAS,
    uploadTexture: (a, k) => `tex:${a}/${k}`,
    releaseTexture: () => {},
    createBillboardBatch: () => ({}),
    destroyBillboardBatch: () => {},
    // c2/S7: the beacon bundles ride the ordinary mesh path
    createMesh: (model) => ({ stub: true, subMeshes: model.subMeshes }),
    destroyMesh: () => {},
    drawBillboards: (...a) => log.push(['drawBillboards', ...a]),
    drawMesh: (...a) => log.push(['drawMesh', ...a]),
    drawMeshWire: (...a) => log.push(['drawMeshWire', ...a]),   // c2/S6
    drawScreenQuad: (tex, dst, srcUv, color) => log.push(['quad', tex, { ...dst }, srcUv, color]),
    setClipY: (y) => log.push(['setClipY', y]),
    setAutomapMode: (m) => log.push(['setAutomapMode', m]),
    setAutomapWater: (lvl, rgba) => log.push(['setAutomapWater', lvl, rgba]),   // c2/S6
    setFog: (m) => log.push(['setFog', m]),
    setLighting: (a, s) => log.push(['setLighting', [...a], s]),
    setMoonlight: (m) => log.push(['setMoonlight', m]),
    setPointLights: (d) => log.push(['setPointLights', d.length]),
    setIndirectLight: (p, range) => log.push(['setIndirectLight', [...p], range]),
    setWindowEmission: (e) => log.push(['setWindowEmission', [...e]]),
    panelFrame: ({ rect, setup }, body) => {
      log.push(['panelFrame', { ...rect }]);
      setup?.();
      body();
      log.push(['endPanelFrame']);
    },
  };
  return r;
}

const deps = (over = {}) => ({
  record: () => ({ revealed: new Set(), visitedThisRun: new Set(), entranceDiscovered: false }),
  model: { exploredPercentage: () => 0, length: 0 },
  drawList: [], dynamicDraws: [], texRemap: null,
  player: () => ({ feet: [10, 1, 20], eye: [10, 2.7, 20], yaw: 0 }),
  startMarker: null,
  blocks: [{ x: 0, z: 0, name: 'W0000000.RDB' }],
  arrowMesh: null,
  dungeonName: 'Privateer’s Hold',
  insideBuilding: false,
  ...over,
});

const quads = (log) => log.filter((c) => c[0] === 'quad');
const rectOf = (q) => [q[2].x, q[2].y, q[2].w, q[2].h];

function fresh(over = {}, { art = true } = {}) {
  _resetForTests();
  resetAutomapWindowState();
  _setAutomapArt(art ? fakeArt() : null);
  signalAutomapReset();
  return new AutomapWindow(deps(over));
}

// ─────────────────────────────────────────────────────────────────────
test('c2/S5 the layout table, re-pinned THROUGH the window - panel, grid cut, micro-map, compass, label', () => {
  const log = [];
  const w = fresh();
  try {
    // c2/S7: the status label's TEXT is no longer settable from
    // outside - UpdateMouseHoverOverText writes it every frame from the
    // pick - so the pointer goes over the middle of the panel, where
    // the player's own position beacon stands under the map camera.
    w.hover(160, 85);
    w.draw(stubRenderer(log), CANVAS, FONT, 1);
    assert.equal(w.hoverText, 'player position beacon');

    // the render panel: the geometry pass runs in dummyPanelAutomap's
    // own rect (1,1,318,169), NOT the whole canvas
    const panel = log.find((c) => c[0] === 'panelFrame');
    assert.ok(panel, 'the pass went through the renderer bracket');
    assert.deepEqual(panel[1], { x: 1, y: 1, w: 318, h: 169 });
    assert.deepEqual({ ...AUTOMAP_PANEL_NATIVE_RECT }, { x: 1, y: 1, w: 318, h: 169 });

    const qs = quads(log);
    // AMAP00I0 as the native panel background, whole screen (:354)
    assert.ok(qs.some((q) => q[1] === 'AMAP00I0' && rectOf(q).join() === '0,0,320,200'), 'the background art fills the screen');
    // the grid icon at (78,171,27x19) - in 2D it is a CROP of the
    // background's own pixels, which is exactly what GetPixels cuts
    const grid = qs.find((q) => rectOf(q).join() === '78,171,27,19');
    assert.ok(grid, 'the grid button icon lands on its own rect');
    assert.deepEqual({ ...GRID_CUTOUT }, { x: 78, y: 171, w: 27, h: 19 });
    assert.deepEqual({ ...CHROME_RECTS.grid }, GRID_CUTOUT, 'the cut IS the button rect');

    // the micro-map, at panelRenderOverlay's rect - x = 0, NOT 2
    const micro = qs.find((q) => String(q[1]).startsWith('tex:amap/micro-'));
    assert.ok(micro, 'the micro-map drew');
    assert.deepEqual(rectOf(micro), [0, 52, 28, 28], 'dummyPanelOverlay (:376-386), StretchToFill');

    // the compass, at dummyPanelCompass's position with COMPBOX's own size
    const box = qs.find((q) => q[1] === 'COMPBOX');
    assert.ok(box, 'the compass frame drew');
    assert.deepEqual(rectOf(box).slice(0, 2), [3, 172], 'dummyPanelCompass (:473-475)');
    const strip = qs.find((q) => q[1] === 'COMPASS');
    assert.deepEqual(rectOf(strip).slice(0, 2), [3 + 2, 172 + 2], 'the strip is inset by the 2px box outline');

    // the status label's anchor: y = 192, and NO shadow pass (DFU's
    // AddTextLabel, not AddDefaultShadowedTextLabel)
    const glyphs = qs.filter((q) => q[1] === 'atlas');
    assert.ok(glyphs.length > 0, 'the hover label drew');
    assert.equal(HOVER_LABEL.y, 192);
    for (const g of glyphs) assert.equal(g[2].y, 192, 'every glyph sits on the label line');
    assert.equal(new Set(glyphs.map((g) => g[2].x)).size, glyphs.length, 'one pass only - a shadow would double each glyph');
  } finally { _resetForTests(); resetAutomapWindowState(); }
});

test('c2/S5 the grid button swaps its icon with the view mode (:1746-1758)', () => {
  const w = fresh();
  try {
    const draw = () => { const log = []; w.draw(stubRenderer(log), CANVAS, null, 1); return quads(log); };
    assert.equal(automapCameraState().viewMode, VIEW_3D, 'the default view mode is 3D on purpose (:124)');
    let g = draw().find((q) => rectOf(q).join() === '78,171,27,19');
    assert.equal(g[1], 'AMAP01I0', '3D shows the alternative grid graphic');
    w.runVerb('ActionChangeAutomapGridMode');
    assert.equal(automapCameraState().viewMode, VIEW_2D);
    g = draw().find((q) => rectOf(q).join() === '78,171,27,19');
    assert.equal(g[1], 'AMAP00I0', '2D shows the icon cut from the background');
  } finally { _resetForTests(); resetAutomapWindowState(); }
});

test('c2/S5 the four backgrounds: three colour triples, and ORIGINAL draws no fill at all', () => {
  // the values, against the three Color[] loops (:311-347)
  assert.equal(AUTOMAP_BACKGROUNDS.original, null);
  assert.deepEqual([...AUTOMAP_BACKGROUNDS.alternative1], [0.0, 0.0, 0.0, 1.0]);
  assert.deepEqual([...AUTOMAP_BACKGROUNDS.alternative2], [0.2, 0.1, 0.3, 1.0]);
  assert.deepEqual([...AUTOMAP_BACKGROUNDS.alternative3], [0.3, 0.1, 0.2, 1.0]);

  const w = fresh();
  try {
    const panelFill = () => {
      const log = [];
      w.draw(stubRenderer(log), CANVAS, null, 1);
      return quads(log).filter((q) => q[1] === null && rectOf(q).join() === '1,1,318,169');
    };
    assert.equal(automapBackground(), 'original');
    assert.deepEqual(panelFill(), [],
      'ORIGINAL assigns BackgroundTexture = null (:1704): nothing is painted over the map area, '
      + 'which is what lets AMAP00I0 show through the ~2% clear - an opaque fill deletes the feature');
    // each hotkey selects its own arm, and each paints its own colour
    for (const [button, name] of Object.entries(BACKGROUND_HOTKEYS)) {
      w.input(shortcutOrFallback(button, null).code, null);
      assert.equal(automapBackground(), name, button);
      const fills = panelFill();
      if (name === 'original') { assert.deepEqual(fills, []); continue; }
      assert.equal(fills.length, 1, `${name} paints the render panel's rect exactly once`);
      assert.deepEqual([...fills[0][4]], [...AUTOMAP_BACKGROUNDS[name]]);
    }
  } finally { _resetForTests(); resetAutomapWindowState(); }
});

// ─────────────────────────────────────────────────────────────────────
test('c2/S5 OnPush: the reset signal is consumed EXACTLY ONCE, and the second open takes the other arm', () => {
  _resetForTests();
  resetAutomapWindowState();
  _setAutomapArt(null);
  try {
    const d = deps();
    signalAutomapReset();
    const w = new AutomapWindow(d);           // the reset arm
    assert.equal(automapCameraState().fov3D, DEFAULT_FIELD_OF_VIEW_3D);
    assert.equal(automapRenderMode(), 'Transparent');

    // Change two things the RESET arm restores and the other arm does
    // not: the 3D field of view (:585) and the camera's orientation
    // (ResetCameraTransformView3D LookAt's from a fixed direction).
    w.runVerb('ActionDecreaseCameraFieldOfView', 0.2);   // 45 - 50*0.2
    w.runVerb('ActionRotateCameraLeft', 1);
    const fov = automapCameraState().fov3D;
    assert.equal(fov, DEFAULT_FIELD_OF_VIEW_3D - 10);
    // CLOSE first: OnPop is what commits the live transform into the
    // mode's backup slot (:645-654), so a rotation the player never
    // closed on is not the state a reopen restores - DFU's own shape.
    w.input('KeyM', { code: 'KeyM' });
    w.tick(0.016);
    const fwd = [...automapCameraState().savedView3D.fwd];

    // reopen with NO new signal: the flag was erased by the first push
    new AutomapWindow(d);
    assert.equal(automapCameraState().fov3D, fov,
      'the signal was consumed by the FIRST push - a second open must not reset the lens');
    assert.deepEqual(automapCameraState().fwd.map((v) => +v.toFixed(9)), fwd.map((v) => +v.toFixed(9)),
      'nor the orientation OnPop saved');
    // ...and a fresh signal does reset both
    signalAutomapReset();
    new AutomapWindow(d);
    assert.equal(automapCameraState().fov3D, DEFAULT_FIELD_OF_VIEW_3D, 'a new signal resets again');
    assert.notDeepEqual(automapCameraState().fwd.map((v) => +v.toFixed(6)), fwd.map((v) => +v.toFixed(6)));
  } finally { _resetForTests(); resetAutomapWindowState(); }
});

test('c2/S5 OnPush: the per-host default render mode - cutout in a building, transparent in a dungeon (:587-596)', () => {
  _resetForTests();
  try {
    resetAutomapWindowState(); _setAutomapArt(null);
    signalAutomapReset();
    new AutomapWindow(deps({ insideBuilding: true }));
    assert.equal(automapRenderMode(), 'Cutout', 'inside a building: floors above are distracting');
    resetAutomapWindowState();
    signalAutomapReset();
    new AutomapWindow(deps({ insideBuilding: false }));
    assert.equal(automapRenderMode(), 'Transparent', 'inside a dungeon or palace');
    assert.deepEqual([...RENDER_MODES], ['Cutout', 'Wireframe', 'Transparent'], 'the enum order (Automap.cs:197-202)');
  } finally { _resetForTests(); resetAutomapWindowState(); }
});

test('c2/S5 OnPush: the DOUBLE REFOCUS re-centres BOTH cameras and leaves each one\'s orientation alone', () => {
  _resetForTests();
  resetAutomapWindowState();
  _setAutomapArt(null);
  try {
    const at = (feet) => deps({ player: () => ({ feet, eye: [feet[0], feet[1] + 1.7, feet[2]], yaw: 0 }) });
    signalAutomapReset();
    const w = new AutomapWindow(at([0, 0, 0]));
    // turn BOTH cameras away from their reset orientation, each in its
    // own mode, so a refocus that ignored orientation would show
    w.runVerb('ActionRotateCameraLeft', 1);                  // 3D camera turns
    const fwd3D = [...automapCameraState().fwd];
    w.runVerb('ActionChangeAutomapGridMode');                // -> 2D
    w.runVerb('ActionRotateCameraLeft', 1);                  // 2D camera turns
    const up2D = [...automapCameraState().up];
    w.runVerb('ActionChangeAutomapGridMode');                // -> 3D (the live mode at close)

    // the player has walked a long way; reopen with NO reset signal
    new AutomapWindow(at([100, 0, -60]));
    const s = automapCameraState();
    assert.equal(s.viewMode, VIEW_3D, 'the live view mode is restored last (:625-635)');
    assert.deepEqual(s.fwd.map((v) => +v.toFixed(9)), fwd3D.map((v) => +v.toFixed(9)),
      '3D kept ITS orientation across the refocus');
    // the 3D arm re-places the camera its own distance back along its
    // own forward, so the player sits dead ahead of it
    const toPlayer = [100 - s.pos[0], 0 - s.pos[1], -60 - s.pos[2]];
    const len = Math.hypot(...toPlayer);
    assert.ok(Math.abs(toPlayer[0] / len - s.fwd[0]) < 1e-6
      && Math.abs(toPlayer[2] / len - s.fwd[2]) < 1e-6, '3D is framed on the player again');
    // and the 2D camera was refocused too, keeping ITS orientation
    assert.deepEqual(s.savedViewFromTop.up.map((v) => +v.toFixed(9)), up2D.map((v) => +v.toFixed(9)),
      '2D kept ITS orientation - the map does not snap back to north');
    assert.deepEqual([s.savedViewFromTop.pos[0], s.savedViewFromTop.pos[2]], [100, -60],
      '2D moves in X and Z only (:1833-1839) - the top-down height is left alone');
    assert.equal(s.savedViewFromTop.pos[1], 1.7 + CAMERA_HEIGHT_VIEW_FROM_TOP,
      'and that height is still the eye + 150 the 2D reset gave it (:1160-1164)');
    // the pivots go back to the player in BOTH modes on every push (:575)
    assert.deepEqual(s.pivot2D, [100, 0, -60]);
    assert.deepEqual(s.pivot3D, [100, 0, -60]);
  } finally { _resetForTests(); resetAutomapWindowState(); }
});

// ─────────────────────────────────────────────────────────────────────
test('c2/S5 THE PASS IS UNLIT, and the bracket hands every global back (the real Renderer, EV6 Proxy-GL)', () => {
  const stub = new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation' || k === 'getAttribLocation') return () => ({});
      if (k === 'createTexture' || k === 'createBuffer' || k === 'createVertexArray'
        || k === 'createProgram' || k === 'createShader' || k === 'createFramebuffer') return () => ({});
      if (k === 'getParameter') return () => new Float32Array([0, 0, 0, 0]);
      if (typeof k === 'string' && k.toUpperCase() === k) return k;
      return () => {};
    },
  });
  const canvas = { getContext: () => stub, clientWidth: 320, clientHeight: 200, width: 320, height: 200 };
  const r = new Renderer(canvas);

  _resetForTests();
  resetAutomapWindowState();
  _setAutomapArt(null);
  try {
    // a distinctive HOST state on every global the pass could clobber
    const entryAmbient = new Float32Array([0.4, 0.42, 0.5]);
    const entryEmission = new Float32Array([0.11, 0.22, 0.33]);
    r.setLighting(entryAmbient, 0.55);
    r.setFog('exp', 0.02);
    r.setMoonlight({ scale: 0.3, dir: [0, 1, 0], color: [0.6, 0.6, 0.8] });
    r.setWindowEmission(entryEmission);
    r.setPointLights(new Float32Array([1, 2, 3, 4]), null, null);
    r.setIndirectLight([1, 2, 3], 7, new Float32Array([0.9, 0.9, 0.9]));
    r.setClipY(12.5);
    r.setAutomapMode(0);

    // snapshot the lighting AT EVERY GEOMETRY DRAW - the law is about
    // what the shader sees, not about which setter was called
    const snaps = [];
    r.drawMesh = () => snaps.push({
      ambient: [...r._ambient], sun: r._sunScale, fog: r._fogMode, moon: r._moonScale,
      points: r._pointLights.length, indirectRange: r._indirect[3], emission: [...r._windowEmission],
      mode: r._automapMode,
    });

    const rec = { revealed: new Set(['a']), visitedThisRun: new Set(['a']), entranceDiscovered: false };
    const w = new AutomapWindow(deps({
      record: () => rec,
      drawList: [{ key: 'a', mesh: {}, matrix: new Float32Array(16) }],
    }));
    w.draw(r, canvas, null, 1);

    assert.ok(snaps.length >= 1, 'the revealed row drew');
    for (const s of snaps) {
      assert.deepEqual(s.ambient, [1, 1, 1],
        'DaggerfallAutomap.shader has NO light term - the geometry runs at the identity, not A1\'s 0.9');
      assert.equal(s.sun, 0, 'no sun');
      assert.equal(s.fog, 0, 'NoFogCamera (:2017)');
      assert.equal(s.moon, 0, 'no moon');
      assert.equal(s.points, 0, 'no point lights');
      assert.equal(s.indirectRange, 0, 'no indirect');
      assert.deepEqual(s.emission, [0, 0, 0], 'no window emission');
    }
    assert.equal(snaps[0].mode, 1, 'visited-this-run draws in COLOUR (mode 1)');

    // ...and the frame the host draws NEXT is the frame it would have
    // drawn had the window never opened
    assert.deepEqual([...r._ambient], [...entryAmbient], 'ambient came back');
    assert.equal(r._sunScale, 0.55);
    assert.equal(r._fogMode, 2, 'exp fog came back');
    assert.equal(r._moonScale, 0.3);
    assert.deepEqual([...r._windowEmission], [...entryEmission]);
    assert.equal(r._pointLights.length, 4);
    assert.equal(r._indirect[3], 7);
    assert.equal(r._clipY, 12.5);
    assert.equal(r._automapMode, 0);
  } finally { _resetForTests(); resetAutomapWindowState(); }
});

// ─────────────────────────────────────────────────────────────────────
test('c2/S5 the chrome verbs really reach the camera - press-HOLD, both mouse buttons, one poll per frame', () => {
  const w = fresh();
  try {
    w.runVerb('ActionChangeAutomapGridMode');   // -> 2D, where the up axis is map north
    const before = [...automapCameraState().pos];
    // LEFT hold on the forward button, one frame of 0.5s
    w.pointer('down', CHROME_RECTS.forward.x + 2, 175, 0);
    w.tick(0.5);
    const moved = automapCameraState().pos;
    assert.ok(Math.abs((moved[2] - before[2]) - SCROLL_FORWARD_BACKWARD_SPEED * 0.5) < 1e-9,
      'ActionMoveForward at scrollForwardBackwardSpeed 50/s, not a per-press step');
    // it keeps running while held, and STOPS on the release
    w.tick(0.5);
    assert.ok(Math.abs((automapCameraState().pos[2] - before[2]) - SCROLL_FORWARD_BACKWARD_SPEED) < 1e-9);
    w.pointer('up', CHROME_RECTS.forward.x + 2, 175, 0);
    w.tick(0.5);
    assert.ok(Math.abs((automapCameraState().pos[2] - before[2]) - SCROLL_FORWARD_BACKWARD_SPEED) < 1e-9,
      'the release ends the hold');

    // the RIGHT button on the same rect is a DIFFERENT verb - the pivot
    const pivot = [...automapCameraState().pivot2D];
    w.pointer('down', CHROME_RECTS.forward.x + 2, 175, 2);
    w.tick(1);
    assert.ok(Math.abs((automapCameraState().pivot2D[2] - pivot[2]) - MOVE_PIVOT_FORWARD_BACKWARD_SPEED) < 1e-9,
      'ActionMoveRotationPivotAxisForward at 10/s - the arrows move the PIVOT on the right button');
    assert.deepEqual(automapCameraState().pos, moved.map((v, i) => (i === 2 ? before[2] + SCROLL_FORWARD_BACKWARD_SPEED : v)),
      'and the camera itself did not move with it');
    w.pointer('up', CHROME_RECTS.forward.x + 2, 175, 2);

    // the EXIT button closes on RELEASE, as Unity's OnMouseClick does
    w.pointer('down', CHROME_RECTS.exit.x + 2, 175, 0);
    assert.equal(w.done, false, 'a press alone is not a click');
    w.pointer('up', CHROME_RECTS.exit.x + 2, 175, 0);
    assert.equal(w.done, true, 'ActionExit');
  } finally { _resetForTests(); resetAutomapWindowState(); }
});

test('c2/S5 the compass reads the MAP camera, never the player - including at the 2D gimbal lock', () => {
  const w = fresh();
  try {
    w.runVerb('ActionChangeAutomapGridMode');   // 2D: the camera looks straight down
    const s0 = automapCameraState();
    assert.ok(Math.abs(s0.fwd[1] + 1) < 1e-9, 'straight down - fwd carries no yaw at all');
    assert.equal(cameraYawDeg(s0), 0);
    w.runVerb('ActionRotateCameraLeft', 1);     // 50 degrees per second
    const turned = cameraYawDeg(automapCameraState());
    assert.ok(turned > 0.001 && turned < 359.999,
      'the 2D compass turns - reading eulerAngles.y off `fwd` here would answer a constant forever');
    // the PLAYER never moved, so a compass on the player's heading
    // would have stayed put
    assert.equal(w.deps.player().yaw, 0);
    assert.match(src('src/ui/automapWindow.js'), /compassHeading01\(cameraYawDeg\(_cam\)\)/);
  } finally { _resetForTests(); resetAutomapWindowState(); }
});

test('c2/S5 the toggle-close is TWO-PHASE: the key defers, the next frame closes; OnPop saves the live transform', () => {
  const w = fresh();
  try {
    w.runVerb('ActionMoveUpstairs', 1);
    const lifted = automapCameraState().pos[1];
    w.input('KeyM', { code: 'KeyM' });
    assert.equal(w.isCloseWindowDeferred, true, 'the press raises the latch (:721-726)');
    assert.equal(w.done, false, 'and does NOT close in the same event - the press that opens the map would close it');
    w.tick(0.016);
    assert.equal(w.done, true, 'the deferred close drains on the next frame');
    assert.equal(automapCameraState().savedView3D.pos[1], lifted, 'OnPop saved the LIVE mode\'s transform (:645-654)');
    // Escape takes the same door - ":719 is one statement"
    const w2 = fresh();
    w2.input('Escape', { code: 'Escape' });
    assert.equal(w2.done, false);
    w2.tick(0.016);
    assert.equal(w2.done, true);
  } finally { _resetForTests(); resetAutomapWindowState(); }
});

test('c2/S5 the hotkey table: two classes, every row bound to a verb, and no verb invented', () => {
  // the DOWN class is IsDownWith (:736-781); the HELD class is
  // IsPressedWith (:783-870), and it is the one the port approximates
  assert.equal(HOTKEYS_DOWN.length, 12);   // c2/S6 added DFU's four render-mode rows (:747-763)
  assert.equal(HOTKEYS_HELD.length, 22);
  for (const b of [...HOTKEYS_DOWN, ...HOTKEYS_HELD]) {
    if (BACKGROUND_HOTKEYS[b]) continue;   // the four background arms are state, not camera verbs
    assert.ok(HOTKEY_VERBS[b], `${b} has a verb`);
  }
  // every hotkey verb is also a verb some BUTTON raises, or is one of
  // the four keyboard-only ones DFU's chrome has no button for
  const tableVerbs = new Set(Object.values(DUNGEON_ACTIONS)
    .flatMap((e) => [e.leftClick, e.rightClick, e.leftHold, e.rightHold, e.wheelUp, e.wheelDown]).filter(Boolean));
  const keyboardOnly = [
    'ActionRotateCameraYZUp', 'ActionRotateCameraYZDown', 'ActionZoomIn', 'ActionZoomOut',
    // c2/S6: the render modes have no button in either window - the
    // Return cycle and the three direct keys are all there is
    'ActionSwitchToNextAutomapRenderMode', 'ActionSwitchToAutomapRenderModeTransparent',
    'ActionSwitchToAutomapRenderModeWireframe', 'ActionSwitchToAutomapRenderModeCutout',
  ];
  for (const v of Object.values(HOTKEY_VERBS)) {
    assert.ok(tableVerbs.has(v) || keyboardOnly.includes(v), `${v} is a chrome verb or a keyboard-only one`);
  }
  // the slice hotkey really moves the slice, at moveUpDownSpeed
  const w = fresh();
  try {
    const b0 = automapCameraState().slicingBiasY;
    w.input('PageUp', { code: 'PageUp', ctrlKey: true });   // AutomapIncreaseSliceLevel = Ctrl-PageUp
    assert.ok(Math.abs((automapCameraState().slicingBiasY - b0) - MOVE_UP_DOWN_SPEED * 0.016) < 1e-9
      || automapCameraState().slicingBiasY === b0, 'the modifier form resolves through the shortcut table');
    w.tick(0.5);
    w.input('PageUp', { code: 'PageUp', ctrlKey: true });
    assert.ok(automapCameraState().slicingBiasY > b0, 'Ctrl-PageUp raises the slice');
  } finally { _resetForTests(); resetAutomapWindowState(); }
});

// ─────────────────────────────────────────────────────────────────────
test('c2/S5 the art-less fallback still draws the map and still takes keys', () => {
  const log = [];
  const w = fresh({}, { art: false });
  try {
    w.draw(stubRenderer(log), CANVAS, FONT, 1);
    // the geometry pass is UNCHANGED - the art is chrome, not the map
    const panel = log.find((c) => c[0] === 'panelFrame');
    assert.deepEqual(panel[1], { x: 1, y: 1, w: 318, h: 169 });
    const qs = quads(log);
    assert.ok(qs.some((q) => q[1] === null && rectOf(q).join() === '0,0,320,200'), 'a flat backdrop stands in for AMAP00I0');
    for (const name of [...CLICK_BUTTONS.filter((n) => n !== 'compass'), ...HOLD_BUTTONS]) {
      const r = CHROME_RECTS[name];
      assert.ok(qs.some((q) => rectOf(q).join() === [r.x, r.y, r.w, r.h].join()), `${name} still has a face`);
    }
    assert.equal(qs.some((q) => q[1] === 'COMPBOX'), false, 'no compass without COMPASS/COMPBOX');
    // and it is a live window, not a picture
    w.runVerb('ActionChangeAutomapGridMode');
    assert.equal(automapCameraState().viewMode, VIEW_2D);
    w.input('KeyM', { code: 'KeyM' });
    w.tick(0.016);
    assert.equal(w.done, true);
  } finally { _resetForTests(); resetAutomapWindowState(); }
});

// ─────────────────────────────────────────────────────────────────────
test('c2/S5 the tooltip block is Internal_Strings.csv:874-890, byte for byte', () => {
  // TRANSCRIBED A SECOND TIME on purpose: the module and this pin are
  // independent copies of the CSV, so a typo in either one shows here.
  // The literal two-character \\r is the CSV's own escape - ui/toolTip.js
  // collapses it (UpdateTextRows :243-245) and nothing re-spells it.
  assert.equal(AUTOMAP_STRINGS.automapToolTipTextGridButton,
    'left click: switch between 2D top view and 3D view (hotkey: {0})'
    + '\\rright click: reset rot. axis to player pos (hotkey: {1})'
    + '\\rmouse wheel up while over btn: inc. perspective (only 3D mode)'
    + '\\rmouse wheel down while over btn: dec. perspective (only 3D mode)');
  assert.equal(AUTOMAP_STRINGS.automapToolTipForwardButton,
    'left click: move viewpoint forward (hotkey: {0})\\rright click: move rotation axis forward (hotkey: {1})');
  assert.equal(AUTOMAP_STRINGS.automapToolTipBackwardButton,
    'left click: move viewpoint backwards (hotkey: {0})\\rright click: move rotation axis backwards (hotkey: {1})');
  assert.equal(AUTOMAP_STRINGS.automapToolTipLeftButton,
    'left click: move viewpoint to the left (hotkey: {0})\\rright click: move rotation axis to the left (hotkey: {1})');
  assert.equal(AUTOMAP_STRINGS.automapToolTipRightButton,
    'left click: move viewpoint to the right (hotkey: {0})\\rright click: move rotation axis to the right (hotkey: {1})');
  assert.equal(AUTOMAP_STRINGS.automapToolTipRotateLeftButton,
    'left click: rotate dungeon to the left (hotkey: {0})\\rright click: rotate camera to the left (hotkey: {1})');
  assert.equal(AUTOMAP_STRINGS.automapToolTipRotateRightButton,
    'left click: rotate dungeon to the right (hotkey: {0})\\rright click: rotate camera to the right (hotkey: {1})');
  const stairs = (dir, sliceDir) => `left click: ${dir} viewpoint (hotkey: {0})`
    + `\\rright click: ${sliceDir} slice level (hotkey: {1})`
    + '\\rslice level can also be adjusted by holding down middle mouse btn'
    + '\\r\\rhint: different render modes may show hidden geometry:'
    + '\\rhotkey {2}: cutout mode\\rhotkey {3}: wireframe mode\\rhotkey {4}: transparent mode'
    + '\\rswitch between modes with return key\\r';
  assert.equal(AUTOMAP_STRINGS.automapToolTipUpstairsButton, stairs('increase', 'increase'));
  assert.equal(AUTOMAP_STRINGS.automapToolTipDownstairsButton, stairs('decrease', 'decrease'));
  assert.equal(AUTOMAP_STRINGS.automapToolTipPanelCompass,
    'left click: toggle focus (hotkey: {0})'
    + '\\rbeacons: red ... player, green ... entrance, blue ... rotation axis'
    + '\\r\\rright click: reset view (hotkey: {1})'
    + '\\r\\rdouble-click left mouse btn in window to create+edit marker note'
    + '\\rdouble-click left mouse btn (+Ctrl key) in window to create marker'
    + '\\rdouble-click left mouse btn on a marker to add/edit a note'
    + '\\rdouble-click right mouse btn on a marker to delete it'
    + '\\rdouble-click right mouse btn in window to position rotation axis'
    + '\\rdouble-click middle mouse btn in window to center view'
    + '\\rdouble-click left mouse btn on discovered portal marker to jump'
    + '\\rto connected teleporter portal');
  // :884-890 - GetMouseHoverOverText's seven answers, S7's consumers
  assert.deepEqual([
    AUTOMAP_STRINGS.automapPlayerPositionBeacon, AUTOMAP_STRINGS.automapRotationPivotAxis,
    AUTOMAP_STRINGS.automapEntranceExitPositionBeacon, AUTOMAP_STRINGS.automapEntranceExit,
    AUTOMAP_STRINGS.automapPlayerMarker, AUTOMAP_STRINGS.automapTeleporterEntrance,
    AUTOMAP_STRINGS.automapTeleporterExit,
  ], ['player position beacon', 'rotation pivot axis', 'entrance/exit position beacon',
    'entrance/exit', 'player marker', 'teleporter (entrance)', 'teleporter (exit)']);
});

test('c2/S5 the hotkey substitution, and ShortcutOrFallback re-pointing a colliding shortcut at Home', () => {
  // the default table: grid is Space / Ctrl-Backspace
  const tip = automapTooltipFor('grid', 'KeyM');
  assert.ok(tip.includes('(hotkey: Space)'), tip);
  assert.ok(tip.includes('(hotkey: Ctrl-Backspace)'), tip);
  assert.equal(/\{\d\}/.test(tip), false, 'every slot was filled');
  // ...and if the player binds AutoMap to Space, the grid shortcut
  // moves to the fallback key rather than fighting the open/close key
  const collided = automapTooltipFor('grid', 'Space');
  assert.ok(collided.includes(`(hotkey: ${AUTOMAP_FALLBACK_KEY})`), collided);
  assert.equal(collided.includes('(hotkey: Space)'), false);
  assert.equal(shortcutOrFallback('AutomapSwitchAutomapGridMode', 'Space').code, 'Home');
  assert.equal(shortcutOrFallback('AutomapResetRotationPivotAxisView', 'Backspace').code, 'Home',
    'the test is the KEY CODE alone - the modifier does not save Ctrl-Backspace');
  // which rects carry a tooltip: the nine buttons and the compass -
  // NOT the exit button and NOT the render panel (:395-490)
  assert.deepEqual(Object.keys(AUTOMAP_TOOLTIPS).sort(),
    ['backward', 'compass', 'downstairs', 'forward', 'grid', 'left', 'right', 'rotateLeft', 'rotateRight', 'upstairs'].sort());
  assert.equal(automapTooltipFor('exit', 'KeyM'), null);
  assert.equal(automapTooltipFor('panel', 'KeyM'), null);
  // an unknown key answers '' rather than throwing
  assert.equal(automapText('nope'), '');
});

// ─────────────────────────────────────────────────────────────────────
test('c2/S5 SOURCE PINS: the host preloads the art, raises the reset signal, and the chrome is no longer orphaned', () => {
  const ctx = src('src/scenes/dungeonContext.js');
  assert.match(ctx, /preloadAutomapArt\(\{ renderer, fetchBytes, palette \}\)/, 'the art warms at the dungeon mount');
  assert.match(ctx, /\.catch\(\(e\) => console\.warn\('\[automap\] native map art unavailable; keyed fallback:/,
    'and a failure costs the ART, never the map');
  assert.match(ctx, /signalAutomapReset\(\);/, 'InitWhenInInteriorOrDungeon raises the reset flag (:2490-2494)');
  assert.match(ctx, /insideBuilding: false,/, 'and the dungeon host is never inside a building');
  // the window really is the chrome's consumer - flight 1's staging
  // exemption in test/enhancedPause.test.js is deleted with this stage
  const w = src('src/ui/automapWindow.js');
  assert.match(w, /from '\.\/automapChrome\.js'/);
  assert.match(w, /from '\.\/automapCamera\.js'/);
  assert.match(w, /from '\.\/automapText\.js'/);
  assert.equal(/staged = \['src\/ui\/automapChrome\.js'\]/.test(src('test/enhancedPause.test.js')), false,
    'the staging exemption is gone, so the orphan sweep is unconditional again');
  // ONE HOME: the compass strip is drawn by hud.js's own drawer in both
  // windows, not re-implemented here
  assert.match(w, /drawCompassStrip\(renderer, _art,/);
  assert.match(src('src/ui/hud.js'), /export function drawCompassStrip\(/);
  assert.equal(/COMPASS_BOX_OUTLINE/.test(w), false, 'the strip law lives in ONE file');
});

// ── DATA-GATED ───────────────────────────────────────────────────────
test('c2/S5 the two IMGs load and the grid cutout fits inside AMAP00I0', { skip: skipReal }, async () => {
  const { ImgFile } = await import('../src/formats/imgFile.js');
  const { PaletteFile } = await import('../src/formats/paletteFile.js');
  const pal = new PaletteFile();
  pal.load(readFileSync(join(ARENA2, 'ART_PAL.COL')));
  const read = (name) => {
    const img = new ImgFile();
    img.load(new Uint8Array(readFileSync(join(ARENA2, name))), name, pal);
    return img.getDFBitmap();
  };
  const bg = read(AUTOMAP_IMG);
  assert.equal(bg.width, 320);
  assert.equal(bg.height, 200);
  assert.ok(GRID_CUTOUT.x + GRID_CUTOUT.w <= bg.width && GRID_CUTOUT.y + GRID_CUTOUT.h <= bg.height,
    'the 27x19 cut at (78,171) is inside the background');
  const grid = read(AUTOMAP_IMG_GRID_3D);
  assert.ok(grid.width >= GRID_CUTOUT.w && grid.height >= GRID_CUTOUT.h,
    `AMAP01I0 covers the 27x19 button (got ${grid.width}x${grid.height})`);
});
