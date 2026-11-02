// DIAL-CLASSIC (2026-10-12, Mac: "the arena2 files look for those symbols green should be the skills based on the face of
// your character youve choosen, blue magic, yellow inventory and red map, make the icons fit to each other sizewise"):
// under DFO Grimoire the Tab dial's doors wear Daggerfall's own art, read off the player's ARENA2 when the dial rises -
// the face the player wears, and the HUD bar's star, sack and scroll cut off their stone (ui/dialClassicArt.js).
// Photographed at the change over a real ARENA2: every door 76-80 px tall, for each of three Breton faces.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CLASSIC_DIAL, CLASSIC_ICON_SCALE, CLASSIC_FACE_SCALE, CLASSIC_FACE_MAX, CLASSIC_BAR_FILE, faceScale, paintedBox, spansOf, cutBarIcon, faceSourceOf } from '../../src/ui/dialClassicArt.js';
import { LARGE_HUD_RECTS, LARGE_HUD_W, LARGE_HUD_H } from '../../src/ui/hud/hudLarge.js';
import { raceArt } from '../../src/systems/races.js';
import { kitCss, G, GRIMOIRE_DIALS, grimoireDial, setGrimoireDial } from '../../src/ui/grimoireDress.js';
import { setPref, getPref, PREF_DEFAULTS, _resetForTests } from '../../src/systems/uiPrefs.js';
import { DIAL_ICONS, dialArtName } from '../../src/ui/grimoireArt.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('DIAL-CLASSIC the three icons are cut from their own buttons on the bar: each box inside its button, a row of spans for every row, in order and inside (mutants: a box off its button; a row missing)', () => {
  assert.equal(CLASSIC_BAR_FILE, 'MAIN00I0.IMG');
  const button = { magic: 'spellbook', items: 'inventory', map: 'map' };
  assert.deepEqual(Object.keys(CLASSIC_DIAL), ['magic', 'items', 'map']);
  for (const [k, { box: [x, y, w, h], rows }] of Object.entries(CLASSIC_DIAL)) {
    const [bx, by, bw, bh] = LARGE_HUD_RECTS[button[k]];
    assert.ok(x >= bx && y >= by && x + w <= bx + bw && y + h <= by + bh && x + w <= LARGE_HUD_W && y + h <= LARGE_HUD_H, `${k}: inside the ${button[k]} button`);
    assert.equal(rows.length, h, `${k}: a row of spans for each of its rows`);
    let filled = 0;
    rows.forEach((row, i) => {
      let last = -1;
      for (const [a, b] of spansOf(row)) { assert.ok(a > last && b > a && b <= w, `${k} row ${i}`); last = b; filled += b - a; }
    });
    assert.ok(filled > w * h * 0.45, `${k}: the icon fills its box`);
  }
});

test('DIAL-CLASSIC a cut keeps the icon\'s pixels and clears the stone\'s; the sizes match - the icons at four to one, every face trimmed and at three (mutants: the mask ignored; the face untrimmed; a face at its own size)', () => {
  const W = 320, H = 46;
  const bar = { width: W, height: H, data: new Uint8Array(W * H).fill(7) };
  const palette = { get: (i) => ({ r: i, g: i, b: i }) };
  const cut = cutBarIcon(bar, palette, 'map');
  const [, , w, h] = CLASSIC_DIAL.map.box;
  assert.deepEqual([cut.width, cut.height, cut.scale], [w, h, CLASSIC_ICON_SCALE]);
  const inMask = (x, y) => spansOf(CLASSIC_DIAL.map.rows[y]).some(([a, b]) => x >= a && x < b);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) assert.equal(cut.rgba[(y * w + x) * 4 + 3], inMask(x, y) ? 255 : 0, `(${x}, ${y})`);
  for (const k of Object.keys(CLASSIC_DIAL)) { const hh = CLASSIC_DIAL[k].box[3] * CLASSIC_ICON_SCALE; assert.ok(hh >= 76 && hh <= 80, `${k} ${hh}px tall`); }
  // every face at three to one (Mac: "the head with the blue hair looks too small ... check all heads if they match like
  // the red haired") - the red-haired Breton 30x29 at 90x87, the blue-haired 26x35 at 78x105 - and only a head past
  // 36 pixels a side fitted to CLASSIC_FACE_MAX
  assert.equal(CLASSIC_FACE_SCALE, 3);
  assert.equal(faceScale(30, 29), 3);
  assert.equal(faceScale(26, 35), 3);
  assert.equal(faceScale(36, 30), 3);
  assert.equal(Math.round(41 * faceScale(30, 41)), CLASSIC_FACE_MAX, 'a 41-pixel head fitted to the most');
  // a face is trimmed to what is painted: a clear margin is not the head
  const pic = { width: 6, height: 5, data: new Uint8Array(30) };
  pic.data[1 * 6 + 2] = 9; pic.data[3 * 6 + 4] = 9;
  assert.deepEqual(paintedBox(pic), [2, 1, 3, 3]);
  assert.equal(paintedBox({ width: 2, height: 2, data: new Uint8Array(4) }), null);
});

test('DIAL-CLASSIC the face is the one the player wears - the race\'s heads at the chosen face (mutant: face 0 for everyone)', () => {
  assert.deepEqual(faceSourceOf({ race: 'Breton', gender: 'female', faceIndex: 2 }), { file: raceArt('Breton', 'female').heads, record: 2 });
  assert.deepEqual(faceSourceOf({ race: 'Redguard', gender: 'male', faceIndex: 5 }), { file: raceArt('Redguard', 'male').heads, record: 5 });
});

test('DIAL-CLASSIC worn door by door over the pack\'s paintings, pixels square; read each time the dial rises, by the world host\'s data door (mutants: no fallback to the pack; the hook never called)', () => {
  const css = kitCss();
  for (const k of Object.keys(DIAL_ICONS)) {
    assert.ok(css.includes(`[data-grim-icon="${k}"] .px-c { width: calc(var(--dial-classic-w-${k}, `), `${k}: its width`);
    assert.ok(css.includes(`background-image: var(--dial-classic-${k}, var(--grim-${dialArtName(k)}, none));`), `${k}: the pack's until its own is read`);
  }
  assert.ok(css.includes(`${G}:not([data-grim-dial="pack"])[data-grim-dial-art="classic"] .px-dial .px-arm[data-grim-icon] .px-c { image-rendering: pixelated; }`));
  const d = src('src/ui/pixelDial.js');
  const open = d.slice(d.indexOf('export function openPixelDial('));
  assert.ok(open.indexOf('_onOpen?.()') > 0 && open.indexOf('_onOpen?.()') < open.indexOf('mountPixelDial(document.body'), 'asked as it rises');
  const w = src('src/scenes/world.js');
  assert.match(w, /setClassicDialSource\(\{ fetchBytes, palette, entity: \(\) => playerEntity \}\);\n\s*setDialOpenHook\(\(\) => refreshClassicDial\(\)\);/);
});

test('DIAL-PACK (Mac: "add the old Tab selector as optional to the overhaul option"): the Grimoire card\'s Tab dial row - Daggerfall\'s icons by default, the pack\'s paintings kept as the choice; the classic rules stand only off it (mutants: the default the pack; the classic rules unscoped)', () => {
  _resetForTests();
  assert.deepEqual(Object.keys(GRIMOIRE_DIALS), ['classic', 'pack']);
  assert.equal(PREF_DEFAULTS.grimoireDial, 'classic');
  assert.equal(grimoireDial(), 'classic');
  setPref('grimoireDial', 'runes');
  assert.equal(grimoireDial(), 'classic', 'a bad value reads as the default');
  const doc = { documentElement: { dataset: {} } };
  assert.equal(setGrimoireDial('pack', doc), true);
  assert.deepEqual([getPref('grimoireDial'), doc.documentElement.dataset.grimDial], ['pack', 'pack']);
  assert.equal(setGrimoireDial('runes', doc), false);
  const css = kitCss();
  for (const k of Object.keys(DIAL_ICONS)) {
    assert.ok(css.includes(`${G} .px-dial .px-arm[data-grim-icon="${k}"] .px-c { width: calc(`) && css.includes(`background-image: var(--grim-${dialArtName(k)}, none);`), `${k}: the pack's painting, the base`);
    assert.ok(css.includes(`${G}:not([data-grim-dial="pack"]) .px-dial .px-arm[data-grim-icon="${k}"] .px-c { width: calc(var(--dial-classic-w-${k}, `), `${k}: Daggerfall's, off the pack's choice`);
  }
  assert.match(src('src/ui/enhanced/enhancedMenu.js'), /card\.append\(choiceRow\('Tab dial', GRIMOIRE_DIALS, grimoireDial\(\), \(id\) => setGrimoireDial\(id\)\)\);/);
  assert.match(src('src/ui/grimoireDress.js'), /root\.dataset\.grimDial = grimoireDial\(\);/);
  _resetForTests();
});
