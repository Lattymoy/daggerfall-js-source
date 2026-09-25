// DISC25-B (2026-09-25, kurkku on Discord: "hands on the enhanced map sprite go over the black bars in retro mode" -
// "1996 Fantasy ruined", with a shot of the held map's gauntlets and its top row standing out over the pillars).
//
// DFU lays every window out in DaggerfallUI.CustomScreenRect while the retro pillarbox is up - `new Rect(pillarWidth,
// 0, Screen.width - pillarWidth * 2, Screen.height)` (ViewportChanger.cs:139-140). The port's 2D kept the whole
// canvas (a departure RETRO1 recorded), and the held map is a whole-window DOM root: at 1920x1080 in 4:3 its painting
// ran from x 95 to 1825 over a pillarbox of 240 to 1680. The root is inset to the pillars now; the Morrowind arm's
// lane keeps the canvas, as AUDIT RETRO1 C2 pins.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { retroScreenRect, retroAspectViewportRect, RETRO_ASPECT } from '../src/systems/retroMode.js';
import { setValue, resetToDefaults } from '../src/systems/settings.js';
import { HeldMapWindow, HELD_MAP_HEIGHT, SPRITE_ART_FOOT, SPRITE } from '../src/ui/heldMap.js';

/** Just enough document for the window's chrome (heldmap.test.js's own stub, trimmed). */
function fakeDocument() {
  const node = () => {
    const n = {
      children: [], style: {}, dataset: {}, classList: { toggle() {}, add() {}, remove() {} },
      append(...k) { n.children.push(...k); },
      remove() { n.removed = true; },
      addEventListener() {}, removeEventListener() {},
      setPointerCapture() {}, querySelectorAll: () => [],
      className: '', textContent: '', id: '', attrs: {},
      setAttribute(k, v) { n.attrs[k] = v; },
      set innerHTML(v) { n.children = []; }, get innerHTML() { return ''; },
    };
    return n;
  };
  return { createElement: () => node(), getElementById: () => null, head: node(), body: node(), addEventListener() {}, removeEventListener() {} };
}
const win = () => new HeldMapWindow({
  getPlayerPixel: () => ({ x: 5, y: 5 }), getClimateIndex: () => 302,
  woods: { heightMapBuffer: new Uint8Array(100).fill(10) }, mapSize: { width: 10, height: 10 },
  gold: () => 0, goldPieces: () => 0, hasHorse: false, hasCart: false, hasShip: false,
  diseaseCount: () => 0, poisonCount: () => 0,
});
function withWindow(fn) {
  globalThis.document = fakeDocument();
  const saved = [globalThis.innerWidth, globalThis.innerHeight];
  globalThis.innerWidth = 1920; globalThis.innerHeight = 1080;
  try { return fn(); } finally {
    delete globalThis.document;
    [globalThis.innerWidth, globalThis.innerHeight] = saved;
    resetToDefaults();
  }
}
const retro = (mode, aspect) => { setValue('Video', 'RetroRenderingMode', mode); setValue('Video', 'RetroModeAspectCorrection', aspect); };

test('DISC25-B: retroScreenRect is CustomScreenRect - the pillars in whole pixels, full height, only with retro mode ON and a correction set', () => {
  resetToDefaults();
  assert.equal(retroScreenRect(1920, 1080), null, 'off');
  retro(0, RETRO_ASPECT.FOUR_THREE);
  assert.equal(retroScreenRect(1920, 1080), null, 'a correction without retro mode is no pillarbox (RETRO1\'s own law)');
  retro(1, RETRO_ASPECT.OFF);
  assert.equal(retroScreenRect(1920, 1080), null, 'retro mode without a correction fills the screen');
  retro(1, RETRO_ASPECT.FOUR_THREE);
  // 1080/6/200 = 0.9; 320*5*0.9 = 1440 wide; (1920-1440)/2 = 240 a side
  assert.deepEqual(retroScreenRect(1920, 1080), { x: 240, y: 0, w: 1440, h: 1080 });
  retro(2, RETRO_ASPECT.SIXTEEN_TEN);
  // 320*6*0.9 = 1728; 96 a side
  assert.deepEqual(retroScreenRect(1920, 1080), { x: 96, y: 0, w: 1728, h: 1080 });
  // and it is the world rect's own pillar - one arithmetic, two cuts
  const world = retroAspectViewportRect(1920, 1080, RETRO_ASPECT.SIXTEEN_TEN);
  assert.equal(world.x, Math.fround(96 / 1920));
  // narrower than the target: DFU's pillar goes negative, a DOM inset may not
  retro(1, RETRO_ASPECT.FOUR_THREE);
  assert.equal(retroScreenRect(1000, 1080), null);
  assert.equal(retroScreenRect(0, 1080), null);
  assert.match(readFileSync(new URL('../src/systems/retroMode.js', import.meta.url), 'utf8'),
    /const pillarWidth = retroPillarWidth\(screenW, screenH, aspect\);/, 'the world rect cuts from the same pillar');
  resetToDefaults();
});

test('DISC25-B: the held map stands inside the pillarbox - its root inset to the pillars, its painting across the retro screen alone', () => {
  withWindow(() => {
    resetToDefaults();
    const plain = win();
    for (let i = 0; i < 20; i++) plain.tick(0.05);
    assert.equal(plain._chrome.root.style.left, '', 'no pillarbox: the root is the stylesheet\'s whole window');
    const wide = { ...plain._stage };
    plain.dispose();

    retro(1, RETRO_ASPECT.FOUR_THREE);
    const w = win();
    for (let i = 0; i < 20; i++) w.tick(0.05);
    assert.equal(w._chrome.root.style.left, '240px');
    assert.equal(w._chrome.root.style.right, '240px');
    // the painting is laid across the 1440 the root now has: at this height it is wider than that, so it is fitted
    const sh = 1080 * HELD_MAP_HEIGHT / SPRITE_ART_FOOT, sw = sh * SPRITE.w / SPRITE.h;
    assert.ok(sw > 1440, 'the painting at full height is wider than the retro screen');
    assert.equal(w._stage.w, 1440, 'so it is fitted to it');
    assert.ok(w._stage.x >= 0 && w._stage.x + w._stage.w <= 1440, 'and lies inside the root, which lies inside the bars');
    assert.ok(wide.w > 1440, `without the pillarbox it ran out over them (${wide.w})`);
    // the Morrowind arm's lane keeps the canvas (AUDIT RETRO1 C2)
    w._lane = 'hands';
    w._layout();
    assert.equal(w._chrome.root.style.left, '', 'the arm lane is inset by nothing');
    w._lane = 'sprite';
    w._layout();
    assert.equal(w._chrome.root.style.left, '240px', 'and the painting\'s lane takes the pillars back');
    w.dispose();
  });
});
