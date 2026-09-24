// HUD-ICON1 (2026-09-24, Mac: "the classic interaction (grab, info etc) ui element is missing the sprite and is just
// large text").
//
// THE BUG: U38 drew the interaction mode as its NAME in the HUD font, standing in for DFU's icon pictures, which live
// in Unity's Resources folder and were not in the sparse clone. Under the shipped style ("classic", displayScale 3)
// that name was three times the HUD font - large text where DFU shows a small sprite. The sixteen icons are DFU's own
// MIT art, so they are vendored and drawn now, at DFU's size law, in both arms (HUDInteractionModeIcon.cs :87-129).
//
// Driven through the real draw (ui/hudCrosshair.js) with the REAL vendored PNGs; only
// the fetch and the decode are seams (the file off disk, through tools/pngIO.mjs - node has no createImageBitmap).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drawCrosshairAndModeIcon, modeIconPosition, iconResScale } from '../src/ui/hudCrosshair.js';
import { modeIcon, modeIconSet, MODE_ICON_SUFFIX, _setModeIconSeamsForTests } from '../src/ui/modeIcons.js';
import { HUD_BORDER, HUD_NATIVE_BAR_WIDTH } from '../src/ui/hud.js';
import { setInteractionMode } from '../src/player/interactionMode.js';
import { setValue, _resetForTests } from '../src/systems/settings.js';
import { readPng } from '../tools/pngIO.mjs';   // the node-side decoder the shipped-art tests use (the browser's is createImageBitmap)

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LISTING = JSON.parse(readFileSync(join(root, 'vendor/dfu-icons/dfu-icons.files.json'), 'utf8'));
const onDisk = async (url) => new Uint8Array(readFileSync(join(root, 'public/art/dfu-icons', decodeURIComponent(new URL(url).pathname.split('/').pop()))));

/** A renderer that records its uploads and draws. */
const fakeRenderer = () => {
  const uploads = [], quads = [];
  return {
    uploads, quads,
    uploadTexture: (archive, record, px, opts) => { uploads.push({ archive, record, w: px.width, h: px.height, opts }); return { record }; },
    drawScreenQuad: (tex, r) => quads.push({ tex, r }),
  };
};
/** A font that fails the test if the mode's NAME is ever drawn with it - the bug this closes. */
const font = { fnt: { fixedHeight: 7, glyphWidth: () => { throw new Error('the word was drawn in place of the picture'); } } };
const settle = () => new Promise((r) => setTimeout(r, 30));

test('HUD-ICON1: the sixteen icons are DFU\'s own, byte for byte as the listing pins them', () => {
  assert.equal(LISTING.Files.length, 16);
  assert.equal(LISTING.License, 'MIT');
  for (const path of LISTING.Files) {
    const name = path.split('/').pop();
    const file = join(root, 'public/art/dfu-icons', name);
    assert.ok(existsSync(file), `${name} is vendored`);
    assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'), LISTING.Sha256[name], `${name} is the pinned bytes`);
  }
});

test('HUD-ICON1: LoadAssets\' switch - the style picks the set (:143-183)', () => {
  assert.equal(modeIconSet('classic'), 'classic');
  assert.equal(modeIconSet('ClassicXhair'), 'classic');
  assert.equal(modeIconSet('monochrome'), 'mono');
  assert.equal(modeIconSet('colour'), 'colour');
  assert.equal(modeIconSet('colourxhair'), 'colour');
  assert.equal(modeIconSet('icon'), 'icon');
  assert.equal(modeIconSet('minimal'), 'icon', '"minimal" is the icon set at its own scale');
  assert.equal(modeIconSet('nonsense'), 'icon');
  assert.deepEqual(Object.values(MODE_ICON_SUFFIX), ['steal', 'grab', 'info', 'talk'], 'the port\'s dialogue is DFU\'s talk');
});

test('HUD-ICON1: the shipped "classic" style draws DFU\'s classic GRAB sprite in the corner, at its own size - not the word', async () => {
  _resetForTests();
  _setModeIconSeamsForTests({ fetch: onDisk, decode: async (b) => readPng(b) });
  setInteractionMode('grab');
  const renderer = fakeRenderer();
  const canvas = { width: 1280, height: 800 };
  const scale = 4;
  // the first frame asks, and the whole set loads (LoadAssets loads all four at once)
  drawCrosshairAndModeIcon(renderer, canvas, null, { cursorActive: false, scale, border: HUD_BORDER, barWidth: HUD_NATIVE_BAR_WIDTH });
  await settle();
  assert.deepEqual(renderer.uploads.map((u) => u.record).sort(), ['classic-grab.png', 'classic-info.png', 'classic-steal.png', 'classic-talk.png']);
  assert.ok(renderer.uploads.every((u) => u.opts.alpha === true && !u.opts.smooth), 'real alpha, sampled Point (GUIFilterMode 0)');
  renderer.quads.length = 0;
  drawCrosshairAndModeIcon(renderer, canvas, font, { cursorActive: false, scale, border: HUD_BORDER, barWidth: HUD_NATIVE_BAR_WIDTH });
  const icon = renderer.quads.find((q) => q.tex?.record === 'classic-grab.png');
  assert.ok(icon, 'the classic grab picture is drawn (the bug: the word GRAB at three times the font)');
  // Size = size * displayScale / resScale (:118-121): 18x19 * 3 / 1 at scale 4
  assert.equal(icon.r.w, 18 * 3 / iconResScale(scale));
  assert.equal(icon.r.h, 19 * 3 / iconResScale(scale));
  const [x, y] = modeIconPosition(canvas.height, scale, icon.r.h, HUD_BORDER, HUD_NATIVE_BAR_WIDTH);
  assert.deepEqual([icon.r.x, icon.r.y], [x, y], 'at DFU\'s own corner (:129)');
  assert.equal(renderer.quads.filter((q) => q.tex === null).length, 2, 'and the plain crosshair beside it; no stand-in plate');
  _setModeIconSeamsForTests();
  _resetForTests();
});

test('HUD-ICON1: at a low HUD scale the corner icon is scaled DOWN by resScale, as DFU does (:107)', async () => {
  _resetForTests();
  _setModeIconSeamsForTests({ fetch: onDisk, decode: async (b) => readPng(b) });
  setValue('GUI', 'InteractionModeIcon', 'icon');
  setInteractionMode('info');
  const renderer = fakeRenderer();
  drawCrosshairAndModeIcon(renderer, { width: 640, height: 400 }, null, { cursorActive: false, scale: 2, border: HUD_BORDER, barWidth: HUD_NATIVE_BAR_WIDTH });
  await settle();
  renderer.quads.length = 0;
  drawCrosshairAndModeIcon(renderer, { width: 640, height: 400 }, font, { cursorActive: false, scale: 2, border: HUD_BORDER, barWidth: HUD_NATIVE_BAR_WIDTH });
  const icon = renderer.quads.find((q) => q.tex?.record === 'icon-info.png');
  assert.ok(icon);
  assert.equal(icon.r.w, 64 * 0.8 / 1.5, 'iconScale 0.8, resScale 3/2 at scale 2');
  _setModeIconSeamsForTests();
  _resetForTests();
});

test('HUD-ICON1: in an xhair style the picture IS the crosshair, centred at size x displayScale with NO resScale (:87-97)', async () => {
  _resetForTests();
  _setModeIconSeamsForTests({ fetch: onDisk, decode: async (b) => readPng(b) });
  setValue('GUI', 'InteractionModeIcon', 'classicxhair');
  setInteractionMode('steal');
  const renderer = fakeRenderer();
  const canvas = { width: 640, height: 400 };
  drawCrosshairAndModeIcon(renderer, canvas, null, { cursorActive: false, scale: 2 });
  await settle();
  renderer.quads.length = 0;
  drawCrosshairAndModeIcon(renderer, canvas, font, { cursorActive: false, scale: 2 });
  assert.equal(renderer.quads.length, 1, 'the picture alone - not the cross');
  const { tex, r } = renderer.quads[0];
  assert.equal(tex.record, 'classic-steal.png');
  assert.deepEqual([r.w, r.h], [22 * 3, 17 * 3]);
  assert.deepEqual([r.x + r.w / 2, r.y + r.h / 2], [320, 200], 'centred on the viewport');
  // Grab keeps the plain crosshair
  setInteractionMode('grab');
  renderer.quads.length = 0;
  drawCrosshairAndModeIcon(renderer, canvas, font, { cursorActive: false, scale: 2 });
  assert.ok(renderer.quads.every((q) => q.tex === null) && renderer.quads.length === 2);
  _setModeIconSeamsForTests();
  _resetForTests();
});

test('HUD-ICON1: a picture that does not load leaves the mode\'s name - a missing file never costs the indicator', async () => {
  _resetForTests();
  _setModeIconSeamsForTests({ fetch: async () => { throw new Error('404'); } });
  setValue('GUI', 'InteractionModeIcon', 'colour');
  setInteractionMode('dialogue');
  const renderer = fakeRenderer();
  const warn = console.warn; console.warn = () => {};
  try {
    assert.equal(modeIcon(renderer, 'colour', 'dialogue'), null, 'loading');
    await settle();
    assert.equal(modeIcon(renderer, 'colour', 'dialogue'), null, 'failed');
  } finally { console.warn = warn; }
  assert.equal(renderer.uploads.length, 0);
  _setModeIconSeamsForTests();
  _resetForTests();
});
