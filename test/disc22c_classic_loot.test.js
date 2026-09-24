// DISC22-C (2026-09-24, Satranath on Discord: "no hotbar or quickloot on grimoire either, i think i will stick with
// the enhanced ui"; Mac: "The screenshot of the parchment is a spritesheet to be used for the loot menu (grimoire UI)").
//
// THE GAP: quick loot's law never had DOM in it, but the one gate over the whole resolve (worldPlaqueOn - enhanced
// and not touch) was the DOM plaque's, so on the classic skins no frame was resolved, no row was ever lit, and the
// wheel, P, J and the take all fell through to the inventory window. The resolve runs on both skins now; the classic
// face is a canvas panel drawn from drawHud - Mac's parchment under the GrimoireUI pack, DFU's tooltip box without.
//
// Driven through the real hover seam (worldHoverFrame), the real quick-loot selection and the real panel with Mac's
// real PNG (decoded off disk by tools/pngIO.mjs - node has no createImageBitmap).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { worldHoverFrame, destroyWorldPlaque, classicPlaqueOn } from '../src/ui/worldPlaque.js';
import { quickLootRow, quickLootWheel, resetQuickLoot } from '../src/systems/quickLoot.js';
import { classicLootFrame } from '../src/systems/classicLootFrame.js';
import { setUiSkin } from '../src/systems/uiSkin.js';
import { setPref, _resetForTests as resetPrefs } from '../src/systems/uiPrefs.js';
import { setUiPack } from '../src/systems/uiPack.js';
import { drawLootPanel, lootPanelLayout, parchmentImage, PARCHMENT, PARCHMENT_LIT, _setLootPanelSeamsForTests } from '../src/ui/classicLootPanel.js';
import { readPng } from '../tools/pngIO.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const pile = [{ name: 'Ruby', stackCount: 3 }, { name: 'Steel Longsword' }, { name: 'Leather Cuirass' }];
const hover = () => worldHoverFrame({
  eye: [0, 0, 0], dir: [0, 0, 1], collider: { raycast: () => Infinity },
  targets: () => [{ key: 'loot:7', aabb: { min: [-1, -1, 1], max: [1, 1, 2] }, distance: 1, reach: 3.2 }],
  name: () => ({ title: 'Loot Pile' }), contents: () => pile,
});
const font = { fnt: { fixedHeight: 7, glyphWidth: () => 5, glyphs: [], chars: [] } };
const renderer = () => {
  const quads = [], uploads = [];
  return { quads, uploads, uploadTexture: (a, r, px) => { uploads.push({ a, r, w: px.width, h: px.height }); return { r }; }, drawScreenQuad: (tex, dst, src, color) => quads.push({ tex, dst, src, color }) };
};
const m = { ox: 0, oy: 0, s: 1 };
const settle = () => new Promise((r) => setTimeout(r, 30));

test('DISC22-C: on the classic skin the hover resolves a loot frame, lights a row and leaves it for the HUD - no DOM', () => {
  resetPrefs(); resetQuickLoot();
  setUiSkin('classic');
  assert.equal(typeof document, 'undefined', 'a node host: nothing here may reach the DOM plaque');
  assert.equal(classicPlaqueOn(), true, 'quick loot is on by default, so the classic face is too');
  const f = hover();
  assert.equal(f?.kind, 'items');
  assert.deepEqual(f.rows.map((r) => r.name), ['Ruby', 'Steel Longsword', 'Leather Cuirass']);
  assert.equal(classicLootFrame(null).frame, f, 'the frame drawHud draws');
  assert.equal(quickLootRow(f), 0, 'the first row is lit - the old gate left nothing lit, so the take opened the window');
  assert.equal(classicLootFrame(null).lit, 0, 'and the lit row rides with it');
  assert.equal(quickLootWheel(1), true, 'the wheel moves it');
  hover();
  assert.equal(classicLootFrame(null).lit, 1);
  // quick loot off: the classic HUD is DFU's again - nothing resolved, nothing lit
  setPref('quickLoot', false);
  assert.equal(hover(), null);
  assert.equal(classicLootFrame(null), null);
  destroyWorldPlaque(); resetPrefs(); resetQuickLoot();
});

test('DISC22-C: a frame is drawn only in the frame it was resolved in', () => {
  resetPrefs(); resetQuickLoot();
  setUiSkin('classic');
  const f = hover();
  assert.equal(classicLootFrame(null).frame, f);
  assert.equal(classicLootFrame(12345), null, 'a later frame, with no hover asked, draws nothing stale');
  destroyWorldPlaque(); resetQuickLoot();
});

test('DISC22-C: under GrimoireUI the panel is Mac\'s parchment, cut at its two gold rules and grown to the rows', async () => {
  resetPrefs(); resetQuickLoot();
  setUiSkin('classic');
  setUiPack('grimoire');
  _setLootPanelSeamsForTests({ fetch: async () => new Uint8Array(readFileSync(join(ROOT, 'public/art', PARCHMENT.file))), decode: async (b) => readPng(b) });
  const r = renderer();
  assert.equal(parchmentImage(r), null, 'loading');
  await settle();
  assert.deepEqual(r.uploads, [{ a: 'art', r: PARCHMENT.file, w: 106, h: 180 }], 'Mac\'s sheet, at its own size');
  const f = hover();
  assert.equal(drawLootPanel(r, m, font, f, 1), true);
  const sheet = r.quads.filter((q) => q.tex?.r === PARCHMENT.file);
  assert.equal(sheet.length, 3, 'three pieces: the top with its rule, the body, the bottom with its rule');
  const v = (q) => [Math.round(q.src.v0 * 180), Math.round(q.src.v1 * 180)];
  assert.deepEqual(sheet.map(v), [[0, 40], [40, 140], [140, 180]]);
  assert.deepEqual(sheet.map((q) => q.dst.h), [40, 3 * 8 + 6, 40], 'the body is as tall as the three rows, not the 100 px it is drawn at');
  assert.ok(r.quads.some((q) => q.tex === null && q.color === PARCHMENT_LIT), 'the lit row is banded');
  // the body grows with the pile
  const big = lootPanelLayout({ rows: Array(6).fill({ name: 'x' }), rest: 3 }, 7, { parchment: true });
  const small = lootPanelLayout({ rows: [{ name: 'x' }] }, 7, { parchment: true });
  assert.ok(big.h > small.h && big.middle === 6 * 8 + 6);
  // Mac's sheet, byte for byte, beside its provenance row
  assert.match(readFileSync(join(ROOT, 'test/doctrine.test.js'), 'utf8'), /\['public\/art\/grimoire-loot-parchment\.png', "OURS - Mac's own parchment/);
  setUiPack('none'); _setLootPanelSeamsForTests(); destroyWorldPlaque(); resetQuickLoot();
});

test('DISC22-C: without the pack it is DFU\'s tooltip box; a frame with no loot list draws nothing', async () => {
  resetPrefs(); resetQuickLoot();
  setUiSkin('classic');
  setUiPack('none');
  _setLootPanelSeamsForTests({ fetch: async () => new Uint8Array(readFileSync(join(ROOT, 'public/art', PARCHMENT.file))), decode: async (b) => readPng(b) });
  const r = renderer();
  parchmentImage(r); await settle();   // the sheet is loaded and ready - the pack alone decides the face
  assert.ok(parchmentImage(r));
  const f = hover();
  assert.equal(drawLootPanel(r, m, font, f, 0), true);
  assert.equal(r.quads.filter((q) => q.tex?.r === PARCHMENT.file).length, 0, 'no parchment without the pack');
  assert.ok(r.quads[0].tex === null && r.quads[0].color.length === 4, 'the tooltip box first');
  assert.equal(drawLootPanel(r, m, font, { kind: 'name', title: 'Marcus', rows: [] }, -1), false, 'a name is not a loot list');
  assert.equal(drawLootPanel(r, m, font, null, -1), false);
  _setLootPanelSeamsForTests(); destroyWorldPlaque(); resetQuickLoot();
});

test('DISC22-C: drawHud draws it on both classic branches, and the DOM plaque stays the enhanced skin\'s', () => {
  const hud = readFileSync(join(ROOT, 'src/ui/hud.js'), 'utf8');
  assert.equal((hud.match(/drawClassicLoot\(renderer, canvas, font\);/g) ?? []).length, 2, 'the large-HUD branch and the plain one');
  assert.match(hud, /const loot = classicLootFrame\(frameMark\(\)\);/);
  assert.match(hud, /if \(loot\) drawLootPanel\(renderer, nativeMetrics\(canvas\), font, loot\.frame, loot\.lit, at\);/);   // AUDIT RETRO1 G5: `at` - beside the reticle where it is, above the bar
  // hud.js reads a LEAF: reaching for systems/quickLoot.js from here closed an import ring (itemTransfer.js initialised
  // before its own constants), so the frame module imports nothing at all
  assert.doesNotMatch(hud, /from '\.\.\/systems\/quickLoot\.js'/);
  assert.doesNotMatch(readFileSync(join(ROOT, 'src/systems/classicLootFrame.js'), 'utf8'), /^import /m);
  const wp = readFileSync(join(ROOT, 'src/ui/worldPlaque.js'), 'utf8');
  assert.match(wp, /if \(dom\) showWorldPlaque\(frame, plaqueAnchor\(canvas\)\);\s*\n\s*else setClassicLootFrame\(frame, frameMark\(\), quickLootRow\(frame\)\);/);
});
