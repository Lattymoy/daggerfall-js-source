// RETRO-UI (FIELD BUGS 2026-10-03, Skibbster on Discord: "Retro mode aspect ratio doesn't include weapon sprite, UI etc
// etc" - the vitals in the left bar, the compass and a bow's tip in the right; and "a lot of elements dont account for the
// black bars"). DFU hands the pillarboxed rect to DaggerfallUI as CustomScreenRect (ViewportChanger.cs :138-140): the HUD,
// the large HUD, the weapon, the casting hands and the horse lay out in it. The port pillarboxed the world alone. Driven
// through the real drawHud, the real large-HUD law and the real weapon draw over a renderer whose screen offset moves its
// quads as the real one's does (renderer.js drawScreenQuad).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { uiCanvas, onUiScreen, toUiPoint, fromUiPoint, _resetUiScreenForTests } from '../../src/ui/uiScreen.js';
import { drawHud, largeHudBar } from '../../src/ui/hud/hud.js';
import { dockedLargeHudHeight, worldViewportRect } from '../../src/ui/hud/hudLarge.js';
import { drawFpsWeapon, WEAPON_TYPES } from '../../src/combat/fpsWeapon.js';
import { muzzleRay } from '../../src/combat/weapon/weaponRig.js';
import { setUiSkin } from '../../src/systems/uiSkin.js';
import { setValue, _resetForTests as resetSettings } from '../../src/systems/settings/settings.js';
import { _resetForTests as resetPrefs } from '../../src/systems/uiPrefs.js';

const src = (rel) => readFileSync(new URL(`../../src/${rel}`, import.meta.url), 'utf8');
const CANVAS = { width: 1920, height: 1080, clientWidth: 1920, clientHeight: 1080 };
/** A recording renderer whose screen offset moves its quads, as renderer.js drawScreenQuad's does. */
const recorder = () => ({
  quads: [], _o: [0, 0],
  setScreenOffset(x, y) { this._o = [x, y]; }, get screenOffset() { return this._o; },
  uploadTexture: (_a, rec) => ({ r: rec }),
  drawScreenQuad(tex, dst) { this.quads.push({ tex, x: dst.x + this._o[0], y: dst.y + this._o[1], w: dst.w, h: dst.h }); },
});
function withRetro(aspect, fn) {
  resetSettings(); resetPrefs(); _resetUiScreenForTests();
  setUiSkin('classic');
  setValue('Video', 'RetroRenderingMode', aspect ? 1 : 0);
  setValue('Video', 'RetroModeAspectCorrection', aspect);
  try { return fn(); } finally { resetSettings(); resetPrefs(); _resetUiScreenForTests(); }
}
const font = { fnt: { fixedHeight: 7, fixedWidth: 5, glyphWidth: () => 5, glyphs: [], chars: [] } };
const art = { health: { tex: 'h', w: 4, h: 32 }, fatigue: { tex: 'f', w: 4, h: 32 }, magicka: { tex: 'm', w: 4, h: 32 }, compass: { tex: 'c', w: 322, h: 17 }, compassBox: { tex: 'b', w: 69, h: 17 }, breathNormal: { tex: 'n', w: 1, h: 1 }, breathShort: { tex: 's', w: 1, h: 1 } };
const vitals = { health: 40, maxHealth: 50, magicka: 20, maxMagicka: 20, fatigue: 6400, stats: { strength: 50, endurance: 50 } };

test('RETRO-UI the UI canvas: under the 4:3 pillarbox at 1920x1080 the 2D layer lays out on 1440x1080 at x 240 - the world rect\'s own pillar - with the screen\'s client size kept (a swing reads the screen); at 16:10 96 a side; off, the canvas itself (mutants: the canvas always; the pillar not the world\'s)', () => {
  withRetro(1, () => {
    const ui = uiCanvas(CANVAS);
    assert.deepEqual([ui.width, ui.height, ui.uiRect.x, ui.clientWidth], [1440, 1080, 240, 1920]);
    assert.equal(uiCanvas(ui), ui, 'a UI canvas answers itself');
    const world = worldViewportRect(1920, 1080, null);
    assert.ok(Math.abs(world.x * 1920 - 240) < 1e-6, 'the world\'s pillar, the same 240');
    assert.deepEqual(toUiPoint(250, 900), [10, 900], 'a click, into the layer');
    assert.deepEqual(fromUiPoint(ui, 10, 900), [250, 900], 'and back');
  });
  withRetro(2, () => assert.equal(uiCanvas(CANVAS).uiRect.x, 96));
  withRetro(0, () => {
    assert.equal(uiCanvas(CANVAS), CANVAS);
    assert.deepEqual(toUiPoint(250, 900), [250, 900]);
  });
});

test('RETRO-UI the classic HUD: every quad drawHud lays under the 4:3 pillarbox stands inside it - the vitals off its left edge (250, not 10), the compass flush with its right (1680, not 1920); without the pillarbox, as before (mutants: drawHud on the canvas; the offset not applied)', () => {
  const frame = (aspect) => withRetro(aspect, () => {
    const r = recorder();
    drawHud(r, CANVAS, art, vitals, 0, 0, { font });
    assert.deepEqual(r._o, [0, 0], 'the offset put back');
    return r.quads;
  });
  const boxed = frame(1);
  assert.ok(boxed.length > 5, `the HUD drew (${boxed.length} quads)`);
  for (const q of boxed) assert.ok(q.x >= 240 - 1e-6 && q.x + q.w <= 1680 + 1e-6, `inside the pillarbox: ${q.tex} at ${q.x}..${q.x + q.w}`);
  const left = Math.min(...boxed.filter((q) => ['h', 'f', 'm'].includes(q.tex)).map((q) => q.x));
  assert.ok(left >= 250 && left < 300, `the vitals off the picture's left edge (${left})`);
  const compass = boxed.find((q) => q.tex === 'b');
  assert.ok(Math.abs(compass.x + compass.w - 1680) < 1e-6, `the compass flush with the picture's right (${compass.x + compass.w})`);
  const plain = frame(0);
  assert.ok(Math.min(...plain.map((q) => q.x)) < 240, 'off: the vitals at the screen\'s edge, as ever');
});

test('RETRO-UI the large HUD: docked under the pillarbox it is the picture\'s width - DFU\'s 46/320 of 1440, 207 px, not the canvas\'s 276 (AUDIT RETRO1 A2 closed) - the world strip above it takes that height, and a click at the bar\'s place on the canvas finds it (mutants: the bar on the canvas; the click not mapped)', () => {
  withRetro(1, () => {
    setValue('GUI', 'LargeHUD', true);
    setValue('GUI', 'LargeHUDDocked', true);
    const r = recorder();
    const draw = () => drawHud(r, CANVAS, art, vitals, 0, 0, { font, largeHud: { art: { main: { tex: 'tex:MAIN00I0' } }, alignment: 0, mode: 'info', docked: true } });
    draw(); draw();
    const bar = largeHudBar();
    assert.ok(bar, 'the bar drawn');
    assert.deepEqual([bar.w, Math.trunc(bar.h)], [1440, 207]);
    assert.equal(dockedLargeHudHeight(bar), 207);
    const world = worldViewportRect(1920, 1080, bar);
    assert.ok(Math.abs(world.y * 1080 - 207) < 1e-3, 'the world strip ends at the bar\'s top (DFU\'s float32 share)');
    const main = r.quads.find((q) => q.tex === 'tex:MAIN00I0');
    assert.ok(main && Math.abs(main.x - 240) < 1e-6 && Math.abs(main.w - 1440) < 1e-6, `the bar at the picture's place (${main?.x}, ${main?.w})`);
  });
  const hl = src('ui/hud/hudLarge.js');
  assert.match(hl, /const hit = largeHudClick\(largeHudBar\(\), \.\.\.toUiPoint\(px, py\), button\);/);
  assert.match(hl, /_overBar = !!largeHudPoint\(bar, \.\.\.toUiPoint\(/);
  assert.match(src('ui/hud/hudActiveSpells.js'), /pointToNative\(nativeMetrics\(uiCanvas\(canvas\)\), \.\.\.toUiPoint\(/, 'the spell icons\' tooltip and right-click the same');
});

test('RETRO-UI the viewmodel and the horse: a right-aligned weapon\'s edge is the picture\'s (FPSWeapon\'s screenRect, CustomScreenRect), the rig and the mount lay out on the UI canvas and draw at its place, and the gun\'s muzzle is measured back on the real canvas (mutants: the rig on the canvas; the draw not bracketed; the muzzle in the layer\'s pixels)', () => {
  withRetro(1, () => {
    const r = recorder();
    const ui = uiCanvas(CANVAS);
    const art = { weaponType: WEAPON_TYPES.Melee ?? 1, anims: [{ Record: 0, Alignment: 2, Offset: 0 }], records: [{ width: 120, height: 80, frames: ['w0'] }] };
    onUiScreen(r, ui, () => drawFpsWeapon(r, ui, art, 'Idle', 0, { flipHorizontal: false, offsetHeight: 0 }));
    const q = r.quads[0];
    assert.ok(Math.abs(q.x + q.w - 1680) < 1e-6, `flush with the picture's right edge (${q.x + q.w}), not the screen's 1920`);
    assert.deepEqual(r._o, [0, 0]);
  });
  const rig = src('combat/weapon/weaponRig.js');
  assert.match(rig, /const cv = \(\) => uiCanvas\(typeof canvas === 'function' \? canvas\(\) : canvas\);/);
  assert.match(rig, /return onUiScreen\(renderer, cv\(\), \(\) => drawInner\(\{ paralyzed \}\)\);/);
  assert.match(rig, /const \[rx, ry\] = fromUiPoint\(canvas, rect\.x, rect\.y\), real = canvas\.canvas \?\? canvas;/);
  assert.match(rig, /const drawn = \{ rect: \{ \.\.\.rect, x: rx, y: ry \}, canvasW: real\.width, canvasH: real\.height,/, 'the muzzle on the real canvas');
  // what that buys, through the real muzzleRay: a muzzle at the picture's middle column, measured on the real canvas,
  // leaves straight ahead; the same rect left in the layer's pixels (240 short) would leave off to the left
  const drawn = (x) => ({ rect: { x, y: 600, w: 200, h: 200 }, canvasW: 1920, canvasH: 1080, muzzle: { x: 0.5, y: 0.5 }, flip: false, viewport: null, aspect: 1920 / 1080 });
  const ahead = muzzleRay(drawn(860), 1.2);
  const short = muzzleRay(drawn(620), 1.2);
  assert.ok(ahead && short, 'rays');
  const side = (r) => r.right;
  assert.ok(Math.abs(side(ahead)) < 1e-6 && Math.abs(side(short)) > 0.05, `the shot from the barrel (${side(ahead)}), not 240 px off (${side(short)})`);
  const mount = src('player/mountRig.js');
  assert.match(mount, /const canvasOf = \(\) => uiCanvas\(typeof canvas === 'function' \? canvas\(\) : canvas\);/);
  assert.match(mount, /onUiScreen\(renderer, ui, \(\) => \{/);
});

test('RETRO-UI the enhanced skin: the HUD\'s root stands inside the pillars, as the held map does (DISC25-B), and the pieces fixed at the screen\'s edges apart from it read the pillar - the notices, the quest tracker, the status line, the revenant\'s cards (mutants: the root not inset; a piece at the screen\'s edge)', () => {
  const hud = src('ui/enhanced/enhancedHud.js');
  assert.match(hud, /wearUiPillar\(document, host\);/);
  assert.match(hud, /root\.style\.left = inset; root\.style\.right = inset;/);
  assert.match(hud, /doc\.documentElement\?\.style\?\.setProperty\?\.\('--ui-pillar', inset\)/);
  const sheet = src('ui/enhanced/enhancedStyle.js');
  assert.match(sheet, /\.notice-stack \{\n\s*position: fixed; right: var\(--ui-pillar, 0px\);/);
  assert.match(sheet, /\.qtrack \{\n\s*position: fixed; right: calc\(8px \+ var\(--ui-pillar, 0px\)/);
  assert.match(sheet, /\.hudstatus \{ position: fixed; left: calc\(8px \+ var\(--ui-pillar, 0px\)/);
  assert.match(src('ui/revenant/revenantCard.js'), /left: calc\(12px \+ var\(--ui-pillar, 0px\)/);
});
