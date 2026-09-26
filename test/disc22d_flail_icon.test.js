// DISC22-D (2026-09-24, kurkku on Discord, over a classic inventory: "Steel light flail sprite doesn't show up").
//
// THE BUG: the Light Flail is Roleplay Realism Items' template 514, an archive that exists only as the mod's PNGs, one
// per metal (514_0-0_Steel.png), registered LAZY - decoded when drawn, as DFU's GetItemImage imports it
// (ItemHelper.cs:458). AUDIT-DW F1 made that decode an OPTIONAL hook on the host's icons object, and none of the seven
// scenes that build the object passed it: nothing was decoded, the upload threw on an empty image, the drawer's catch
// swallowed it, and its warm set never asked again - the cell drew no flail, on the classic and Grimoire skins alike.
// The enhanced door failed on its own route: it preloaded the whole archive (which skips a lazy entry) and read the
// record with no dye, which no metal's file answers.
//
// Driven through the real data pipeline, the real list drawer with the icons object EXACTLY as the scenes build it,
// the real renderer's colour gate, and the mod's real PNGs; only the browser's decode is stubbed (node has none), over
// tools/pngIO.mjs so the pixels are the file's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPng } from '../tools/pngIO.mjs';
import { installRoleplayRealismItems } from '../src/systems/rriInstall.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { WEAPON_MATERIALS } from '../src/characters/weapons.js';
import { inventoryItemImage } from '../src/systems/itemTemplates.js';
import { makeIconDrawer } from '../src/ui/itemScroller.js';
import { createDataPipeline } from '../src/scenes/dataPipeline.js';
import { color32Bytes } from '../src/render/renderer.js';
import { loadIcon } from '../src/ui/textureCanvas.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const fetched = [];
installRoleplayRealismItems({ fetchBytes: async (n) => { fetched.push(n); return new Uint8Array(readFileSync(join(ROOT, 'public/art/roleplay-realism-items', `${n}.png`))); } });
// the browser's decode (textureReplacement.js decodePng), over the file's own pixels
globalThis.createImageBitmap = async (blob) => ({ ...readPng(new Uint8Array(await blob.arrayBuffer())), close() {} });
globalThis.OffscreenCanvas = class {
  constructor(w, h) { this.width = w; this.height = h; }
  getContext() { let bmp = null; return { drawImage: (b) => { bmp = b; }, getImageData: () => ({ width: bmp.width, height: bmp.height, data: new Uint8ClampedArray(bmp.data) }) }; }
};
const settle = () => new Promise((r) => setTimeout(r, 50));
const flail = () => createWeapon(514, WEAPON_MATERIALS.Steel);

test('DISC22-D: the classic list draws the Steel Light Flail, with the icons object as the scenes build it', async () => {
  const img = inventoryItemImage(flail());
  assert.deepEqual([img.archive, img.record], [514, 0], 'the address was always right - Roleplay Realism Items\' own archive');
  const uploads = [], drawn = [];
  const renderer = {
    textures: new Map(),
    // the real renderer's gate: an image with no colours throws, as the GL upload does
    uploadTexture(a, r, c, o = {}) { color32Bytes(c, `uploadTexture(${a}, ${r})`); const k = `${a}_${r}${o.variant ?? ''}`; uploads.push({ k, w: c.width, h: c.height }); this.textures.set(k, { k }); return this.textures.get(k); },
    uploadEmissionTexture() {},
    drawScreenQuad(tex) { drawn.push(tex.k); },
  };
  const pipe = createDataPipeline({ renderer, arch: null, palette: null, fetch: async (n) => { throw new Error(`no ARENA2 here: ${n}`); } });
  // world.js:5461, exterior.js:2548, dungeonContext.js:1647/2322, worldModes.js:2362/4459/4475 - no preload hook
  const draw = makeIconDrawer({ getTexture: pipe.getTexture, uploadRecord: pipe.uploadRecord, textures: renderer.textures });
  const m = { ox: 0, oy: 0, s: 1 };
  draw(renderer, m, flail(), [0, 0, 60, 200], 0);
  await settle();
  assert.ok(fetched.includes('514_0-0_Steel'), 'the Steel file is fetched when the flail is drawn (the bug: nothing was)');
  assert.deepEqual(uploads, [{ k: '514_0#ui_Steel', w: 48, h: 76 }], 'uploaded under its metal\'s UI variant, at the file\'s size');
  assert.equal(draw(renderer, m, flail(), [0, 0, 60, 200], 0), true);
  assert.deepEqual(drawn, ['514_0#ui_Steel'], 'and drawn');
});

test('DISC22-D: the enhanced door draws it too - this record, by its metal (a Daedric one here, so its file is its own ask)', async () => {
  const daedric = createWeapon(514, WEAPON_MATERIALS.Daedric);
  fetched.length = 0;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }), putImageData() {}, drawImage() {}, imageSmoothingEnabled: true }), toDataURL: () => 'data:image/png;base64,FLAIL' }) };
  const warn = console.warn; const warns = []; console.warn = (...a) => warns.push(a.join(' '));
  try {
    await loadIcon(514, 0, { scale: 2, dye: inventoryItemImage(daedric).dye });   // the dye as itemLine hands it
    await settle();
    const url = await loadIcon(514, 0, { scale: 2, dye: inventoryItemImage(daedric).dye });   // the dye as itemLine hands it
    assert.equal(url, 'data:image/png;base64,FLAIL', `a picture, not the initials (warned: ${warns.join(' | ')})`);
    assert.deepEqual(fetched, ['514_0-0_Daedric'], 'the metal\'s own file - not the bare 514_0-0 every metal would then share');
  } finally { console.warn = warn; delete globalThis.document; }
});

test('DISC22-D: the two enhanced trade screens ask by the item\'s metal, as the pack does', () => {
  // DISC24-B: every enhanced list asks through the pack's ONE picture door, and that door asks by the dye
  for (const f of ['src/ui/enhancedTrade.js', 'src/ui/enhancedPlayerTrade.js']) {
    assert.match(readFileSync(join(ROOT, f), 'utf8'), /linePictureUrl\(line, \{ scale: 2, onReady:/, f);
  }
  assert.match(readFileSync(join(ROOT, 'src/ui/enhancedInventory.js'), 'utf8'),
    /if \(line\.image\) return requestIcon\(line\.image\.archive, line\.image\.record, \{ scale, dye: line\.image\.dye, onReady \}\);/);
});
