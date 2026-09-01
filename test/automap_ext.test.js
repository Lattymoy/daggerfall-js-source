// A2: THE AUTOMAP'S SECOND HALF - the exterior town map
// (ExteriorAutomap.cs + DaggerfallExteriorAutomapWindow.cs) and the
// grayscale prior-run presentation (DaggerfallAutomap.shader). The
// bitmap colour law byte for byte, the copy law (the cached block
// array feeds the navgrid and must never be mutated), DFU's
// nameplate collision solver, the zoom band with its memory, the
// M-outside dispatch, and the renderer's uAutomapMode seam.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ExteriorAutomapWindow, buildExteriorLayout, VIEW_MODES,
  BLOCK_PX, ZOOM_MIN, ZOOM_MAX, _resetZoomForTests,
} from '../src/ui/exteriorAutomapWindow.js';
import { nameplatesIntersect, resolveNameplates } from '../src/ui/nameplateLayout.js';
import { setValue, _resetForTests } from '../src/systems/settings.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');

const COLOURS = { temple: 0xffc37d45, shop: 0xff1855be, tavern: 0xff307555, house: 0xff283c45 };
const at = (bmp, x, yTop) => bmp.colors[yTop * bmp.width + x];
// one block whose byte grid is all zero except chosen cells
const block = (cells) => {
  const data = new Uint8Array(64 * 64);
  for (const [x, y, b] of cells) data[y * 64 + x] = b;
  return data;
};

test('A2 layout: the byte -> colour-group law digit for digit (ExteriorAutomap.cs:1482-1541)', () => {
  // bytes on row 0 (which lands at the TOP - byte row 0 is the north
  // edge through the per-block flip, :1481 = the navgrid law)
  const data = block([[0, 0, 12], [1, 0, 15], [2, 0, 1], [3, 0, 14], [4, 0, 16], [5, 0, 2], [6, 0, 24], [7, 0, 99], [8, 0, 25], [9, 0, 0xfb]]);
  const bmp = buildExteriorLayout(1, 1, [{ x: 0, y: 0, autoMap: data }], 'original', COLOURS);
  assert.equal(bmp.width, BLOCK_PX);
  assert.equal(at(bmp, 0, 0), COLOURS.temple, 'guildhall byte 12 takes the temple colour');
  assert.equal(at(bmp, 1, 0), COLOURS.temple, 'temple 15');
  assert.equal(at(bmp, 2, 0), COLOURS.shop, 'alchemist 1');
  assert.equal(at(bmp, 3, 0), COLOURS.shop, 'weaponsmith 14');
  assert.equal(at(bmp, 4, 0), COLOURS.tavern, 'tavern 16');
  assert.equal(at(bmp, 5, 0), COLOURS.house, 'house-for-sale 2');
  assert.equal(at(bmp, 6, 0), COLOURS.house, 'town23 24');
  // the unknown-byte arm decomposed into DFU's own channels
  // (r=255, g=0, b=the raw byte, a=255) rather than restating the
  // port's packing expression
  const dbg = at(bmp, 7, 0);
  assert.equal(dbg & 0xff, 255, 'debug red: r = 255');
  assert.equal((dbg >>> 8) & 0xff, 0, 'debug red: g = 0');
  assert.equal((dbg >>> 16) & 0xff, 99, 'debug red: b = the raw byte');
  assert.equal((dbg >>> 24) & 0xff, 255, 'debug red: opaque');
  assert.equal(at(bmp, 8, 0), 0, 'ship 25 hides outside showAll (:1519-1528)');
  assert.equal(at(bmp, 9, 0), 0, 'ground flat 0xfb strips in Original');
  assert.equal(at(bmp, 10, 0), 0, 'byte 0 is transparent');
  // the All view: showAll set colours as house, ground flats kept
  const all = buildExteriorLayout(1, 1, [{ x: 0, y: 0, autoMap: data }], 'all', COLOURS);
  assert.equal(at(all, 8, 0), COLOURS.house, 'ships colour in All');
  assert.equal(at(all, 9, 0), COLOURS.house, '0xfb (251) is IN the showAll set - kept in All');
  // THE COPY LAW: the cached block bytes are untouched (cityNavigation
  // carves the navgrid from this same array)
  assert.equal(data[9], 0xfb, 'the retained autoMapData is never mutated');
});

test('A2 layout: block grid placement + the double row flip lands north at the top', () => {
  // a 2x1 grid; block (1,0) gets a byte at its LAST row (y=63), which
  // the per-block flip sends to the block's world-southmost row -
  // for a 1-block-tall grid that is the BOTTOM of the drawn bitmap
  const bmp = buildExteriorLayout(2, 1, [
    { x: 0, y: 0, autoMap: block([[0, 0, 16]]) },
    { x: 1, y: 0, autoMap: block([[5, 63, 16]]) },
  ], 'original', COLOURS);
  assert.equal(bmp.width, 128);
  assert.equal(at(bmp, 0, 0), COLOURS.tavern, 'block (0,0) byte row 0 -> top-left');
  assert.equal(at(bmp, 64 + 5, 63), COLOURS.tavern, 'block (1,0) byte row 63 -> bottom row');
  assert.equal(buildExteriorLayout(1, 1, [{ x: 0, y: 0, autoMap: null }], 'original', COLOURS).colors[0], 0, 'a block without bytes stays transparent');
});

test('A2 nameplates: the intersect predicate with its exact boundaries (CheckIntersectionOfNameplates :993-1010)', () => {
  const P = (x, y, w = 40, h = 10) => ({ x, y, w, h, offY: 0 });
  assert.equal(nameplatesIntersect(P(0, 0), P(10, 5)), true, 'overlapping');
  assert.equal(nameplatesIntersect(P(0, 0), P(10, 10)), false, '|dy| == ySize misses (strict <)');
  assert.equal(nameplatesIntersect(P(0, 0), P(40, 5)), false, '|dx| == leftmost width misses');
  assert.equal(nameplatesIntersect(P(0, 0, 20), P(30, 0, 60)), false, 'the LEFTMOST width rules: 30 >= 20');
  assert.equal(nameplatesIntersect(P(30, 0, 60), P(0, 0, 20)), false, 'argument order does not change the leftmost');
});

test('A2 nameplates: the solver parts a pair, shoves off a crowd, and surrenders a "*" (ComputeNameplateOffsets :1147-1377)', () => {
  // a clean pair at the same spot: half-shifted apart, no stars
  const pair = resolveNameplates([{ x: 0, y: 100, w: 40, h: 10 }, { x: 0, y: 100, w: 40, h: 10 }]);
  assert.equal(Math.abs(pair[0].offY - pair[1].offY), 10, 'parted by exactly ySize (the half-bias each)');
  assert.equal(pair.some((p) => p.replaced), false);
  // untouched plates stay put
  const calm = resolveNameplates([{ x: 0, y: 0, w: 40, h: 10 }, { x: 0, y: 50, w: 40, h: 10 }]);
  assert.deepEqual(calm.map((p) => p.offY), [0, 0]);
  // a middle plate entangled with two placed neighbours moves clear
  const trio = resolveNameplates([
    { x: 0, y: 0, w: 40, h: 10 },
    { x: 0, y: 7, w: 40, h: 10 },   // overlaps both neighbours
    { x: 0, y: 15, w: 40, h: 10 },
  ]);
  const ys = trio.map((r, i) => [0, 7, 15][i] + r.offY).sort((a, b) => a - b);
  assert.ok(ys[1] - ys[0] >= 10 - 1e-9 && ys[2] - ys[1] >= 10 - 1e-9, `all three clear after the solve: ${ys}`);
  assert.equal(trio.some((p) => p.replaced), false);
  // five plates on one spot: two escape by the whole-height hop, the
  // rest surrender as "*" (:1365-1376)
  const five = resolveNameplates(Array.from({ length: 5 }, () => ({ x: 0, y: 100, w: 40, h: 10 })));
  assert.equal(five.filter((p) => p.replaced).length, 3);
});

test('A2 window: the zoom band, the remembered level, and the reset-on-new-location setting (window :460-461, :513-533, :1004-1014)', () => {
  _resetForTests(); _resetZoomForTests();
  try {
    const deps = (id) => ({
      locationName: 'T', locationId: id, gridW: 2, gridH: 2,
      blocks: [], playerPos: () => [102.4, 0, 102.4], playerYaw: () => 0,
      directory: () => [], discovered: () => [],
    });
    const w = new ExteriorAutomapWindow(deps('r:A'));
    assert.equal(w.orthoSize, 64, 'start = ExteriorMapDefaultZoomLevel(8) * 8 blocks');
    assert.deepEqual(w.center, [64, 64], 'opens over the player (location-local / 1.6, north-up rows)');
    w.input('minus'); w.input('minus');
    assert.equal(w.orthoSize, 100);
    for (let i = 0; i < 20; i++) w.input('minus');
    assert.equal(w.orthoSize, ZOOM_MAX, 'the far clamp (minZoom 250 - DFU names invert the meaning)');
    for (let i = 0; i < 40; i++) w.input('plus');
    assert.equal(w.orthoSize, ZOOM_MIN, 'the near clamp (25)');
    // reopen in the SAME location: the level is remembered
    assert.equal(new ExteriorAutomapWindow(deps('r:A')).orthoSize, ZOOM_MIN);
    // a NEW location with the reset setting (default True) recomputes
    assert.equal(new ExteriorAutomapWindow(deps('r:B')).orthoSize, 64);
    // with the reset setting off, the level carries across locations
    new ExteriorAutomapWindow(deps('r:B')).input('minus');
    setValue('Map', 'ExteriorMapResetZoomLevelOnNewLocation', false);
    assert.equal(new ExteriorAutomapWindow(deps('r:C')).orthoSize, 80);
    // view modes cycle original -> extra -> all -> original
    const v = new ExteriorAutomapWindow(deps('r:C'));
    assert.equal(v.mode, 'original');
    v.input('char:v'); assert.equal(v.mode, 'extra');
    v.input('char:v'); assert.equal(v.mode, 'all');
    v.input('char:v'); assert.equal(v.mode, VIEW_MODES[0]);
    // pan steps a quarter of the half-view; M and Escape close
    const c0 = [...v.center];
    v.input('up');
    assert.equal(c0[1] - v.center[1], v.orthoSize * 0.25);
    v.input('char:m');
    assert.equal(v.done, true);
  } finally { _resetForTests(); _resetZoomForTests(); }
});

test('A2 wiring pins: the M-outside dispatch in both exterior hosts, gated on a location (DaggerfallUI.cs:633-650)', () => {
  // I2: the dispatch reads the ACTION, not the raw code - M is its
  // registry default (inputActions ResetDefaults :1027) and rebinding
  // it moves the town map with it, as DFU's does.
  // U43 collapsed the per-arm guards into ONE gate per host - the
  // ladder and the large HUD's panels now open the same windows
  // through one hudCtx - so the pin follows the law to its new shape
  // rather than to the line it used to sit on. The gate and the arm
  // are checked separately, and the arm must be INSIDE the gate.
  const GATE = "if (!townTalk.overlayActive && (modes?.mode ?? 'exterior') === 'exterior') {";
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const h = src(host);
    const g = h.indexOf(GATE);
    assert.ok(g > 0, `${host}: the ladder is gated once, on the overlay AND the mode`);
    const arm = h.indexOf("if (act === 'AutoMap') { hudCtx.toggleAutomap(); return; }");
    assert.ok(arm > g, `${host}: and M-outside sits inside that gate`);
  }
  const w = src('src/scenes/world.js');
  assert.match(w, /if \(!dfLoc \|\| !b\?\.locBlocks \|\| !b\.locOrigin\) return;/, 'empty wilderness opens nothing');
  const e = src('src/scenes/exterior.js');
  assert.match(e, /new ExteriorAutomapWindow\(/);
  assert.match(src('src/systems/inputActions.js'), /\['KeyM', 'AutoMap'\]/, 'and M is that action\'s default');
});

test('A2 review: every townTalk overlay drop frees the occupant (the A1 death-presenter lesson on THIS slot)', () => {
  // uploadTexture memoizes forever, so a window replaced or dropped
  // without dispose leaks its texture AND leaves a live cache key -
  // the exact A1 bug, one slot over. All four clear-points covered.
  // THE FOUR CLEAR-POINTS BECAME ONE at the 2026-08-29 recursion fix
  // (townTalk.dropOverlay), so this reads the seam and then checks that
  // every drop still goes through it - which is strictly stronger than
  // the four literals it replaces: those could only fail for the four
  // sites they named, and a FIFTH drop added tomorrow passed them all.
  const t = src('src/scenes/townTalk.js');
  const seam = t.match(/function dropOverlay\([\s\S]*?\n {2}}/)?.[0] ?? '';
  assert.ok(seam.includes('win.dispose?.()'), 'the one drain frees the occupant');
  assert.match(t, /outgoing\?\.dispose\?\.\(\);/, 'showOverlay frees what it replaces');
  // Nothing else in the module may dispose the slot - a drop that
  // sidesteps the seam is both a leak and a way back into the crash.
  const strays = [...t.matchAll(/^.*\boverlay\??\.dispose\?\.\(\).*$/gm)].map((m) => m[0].trim());
  assert.deepEqual(strays, [], `a drop bypasses dropOverlay:\n  ${strays.join('\n  ')}`);
  for (const site of ['if (overlay?.done) dropOverlay();', 'dropOverlay(false)'])
    assert.ok(t.includes(site), `a clear-point stopped going through the seam: ${site}`);
  // and the exterior window really exposes one
  assert.match(src('src/ui/exteriorAutomapWindow.js'), /dispose\(\) \{/);
});

test('A2 grayscale pins: the shader law and the two-tier dungeon pass (DaggerfallAutomap.shader:102-110)', () => {
  const r = src('src/render/renderer.js');
  assert.match(r, /1\.0 - clamp\(sliceDist \/ 20\.0, 0\.0, 0\.6\)/, 'the slice-distance dim, floored at 40%');
  assert.match(r, /dot\(outColor\.rgb, vec3\(0\.3, 0\.59, 0\.11\)\)/, 'the luminance weights digit for digit');
  assert.match(r, /setAutomapMode\(m\) \{/, 'the immediate-upload setter');
  const aw = src('src/ui/automapWindow.js');
  // c2/S6 named the six presentations and moved the two-tier split
  // into _partitionDraws, so the LAW reads through the names now - the
  // draw groups are still issued colour-then-grayscale, and the
  // prior-run predicate is still "revealed but not visited this run".
  assert.match(aw, /AUTOMAP_MODE\.BELOW_COLOUR\);[\s\S]{0,400}AUTOMAP_MODE\.BELOW_GRAY\);/, 'visited draws colour, prior-run grayscale');
  // RE-BASELINED at ROAD-C c2/S8: DFU's two bits are INDEPENDENT -
  // MeshRenderer.enabled says drawn, RENDER_IN_GRAYSCALE says which
  // tier - and HideAll (Automap.cs:2450-2464) clears the first without
  // touching the second, so `revealed` had to become the gate and the
  // tier a choice made inside it. Both halves are pinned, because
  // collapsing them back into one conditional is exactly the mistake.
  assert.match(aw, /if \(!rec\.revealed\.has\(key\)\) return;/, 'revealed IS the draw gate (MeshRenderer.enabled)');
  assert.match(aw, /const row = run\.has\(key\) \? visited : prior;/, 'the prior-run predicate (RENDER_IN_GRAYSCALE)');
  assert.match(aw, /setClipY\(null\);\n\s*renderer\.setAutomapMode\(AUTOMAP_MODE\.OFF\);/, 'beacons ride neither the slice nor the tint');
  // PIN MOVED, ROAD-C c2/S2: the automap mode is one of the globals
  // renderer.panelFrame saves and returns in its own finally, so the
  // window's hand-rolled restore list is gone. The throwing-body
  // proof lives in test/roadc_panelframe.test.js, where it runs
  // against the bracket instead of against this file's text.
  assert.match(aw, /renderer\.panelFrame\(\{/, 'the pass runs inside the renderer\'s bracket');
  assert.match(src('src/render/renderer.js'), /automapMode: this\._automapMode,/, 'and the bracket saves the mode by name');
  assert.match(src('src/render/renderer.js'), /this\.setAutomapMode\(s\.automapMode\);/, 'and hands it back');
});
