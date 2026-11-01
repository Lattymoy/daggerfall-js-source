// NO-BETHESDA2 (2026-10-31; the owner: "ensuring they are not implemented"): HANDHELD TORCHES' AND CLIMATES & CALORIES'
// PICTURES THAT ARE DAGGERFALL'S OWN ARE REBUILT, NOT CARRIED. Each one's spec (tools/classicDerive.mjs; OWN-WORK4 moved
// the two listings beside their readers) is built by systems/rebuiltPicture.js from the player's TEXTURE file in the
// spec's palette. In CI: every picture is a spec or ours, never both and never neither, and none is fetched. With
// ARENA2_PATH: every spec builds the pixels the mod's PNG gave, as the browser decoded it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import { createClassicPictures } from '../../src/formats/classicPictures.js';
import { rebuiltPicture } from '../../src/systems/rebuiltPicture.js';
import { derivedTorchSpec, torchPicture, inTorchSet, DROPPED_ARCHIVE } from '../../src/systems/handheldTorches.js';
import { TORCH_ART, TORCH_OVER } from '../../src/systems/handheldTorchesArt.js';
import { derivedIconSpec, ownIconSpec, installSurvivalIcons, VENDOR_TENT_FILES } from '../../src/systems/survival/itemIcons.js';
import { VENDOR_ICON_FILES } from '../../src/systems/survival/items.js';
import {
  clearVendorTextures, preloadTextureArchive, decodedTextureTopDown, setTextureDeriveContext, textureDeriveContext, isVendorArchive,
} from '../../src/systems/textureReplacement.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
// OWN-WORK4 (2026-10-31): the two folders are retired; their spec listings moved beside the code that reads them
const HT = 'src/systems/handheldTorchesDerived.json', CC = 'src/systems/survival/derivedIcons.json';
const listing = (path) => JSON.parse(read(path));

test('NO-BETHESDA2: every picture Handheld Torches drew is a spec or ours - never both, never neither', () => {
  // OWN-WORK4: the 39 the release's manifest named, as a literal - its manifest left the tree with its folder
  const lit = (r, n) => [0, 1, 2, 3, 4].slice(0, n).flatMap((f) => [`${DROPPED_ARCHIVE}_${r}-${f}`, `${DROPPED_ARCHIVE}_${r}-${f}_Emission`]);
  const names = [...lit(0, 4), ...lit(1, 5), ...lit(2, 5), ...[10, 11, 12].map((r) => `${DROPPED_ARCHIVE}_${r}-0`), ...[0, 1].flatMap((r) => [0, 1, 2, 3].map((f) => `112359_${r}-${f}`))];
  assert.equal(names.length, 39);
  const specs = listing(HT);
  const kinds = (n) => [Object.hasOwn(TORCH_ART, n), Object.hasOwn(TORCH_OVER, n), derivedTorchSpec(n) != null].filter(Boolean).length;
  for (const n of names) assert.equal(kinds(n), 1, `${n}: a spec, ours or ours over the player's record - exactly one`);
  assert.deepEqual(Object.keys(specs).filter((n) => !names.includes(n)), [], 'a spec for a picture the mod never shipped');
  assert.equal(Object.keys(TORCH_ART).length, 17, 'ours (OWN-WORK4): the hand\'s eight, the dropped torch\'s four and their emission twins, the doused torch');
  assert.equal(existsSync(join(root, 'vendor/handheld-torches')), false, 'no file of the release\'s is carried');
  assert.equal(Object.keys(specs).length, 20, 'Daggerfall\'s own: the candle\'s and the holy candle\'s lit flats and their twins');
  assert.deepEqual(Object.keys(TORCH_OVER), ['112358_11-0', '112358_12-0'], 'OWN-WORK4: the doused two carried the author\'s pixels - ours now, our rule over the lit candle');
  for (const [n, s] of Object.entries(specs)) {
    assert.equal(s.edits, undefined, `${n}: Daggerfall's record alone, no other hand's pixels`);
    assert.match(n, new RegExp(`^${DROPPED_ARCHIVE}_(1|2)-\\d(_Emission)?$`), `${n}: only the lit candles are rebuilt`);
    assert.deepEqual(s.from.slice(0, 2), [210, /^112358_1-/.test(n) ? 3 : 4], `${n}: TEXTURE.210, the candle record 3, the holy candle 4`);
    assert.equal(s.pal, 'PAL.PAL', `${n}: the palette the author's copy was drawn in`);
  }
});

test('NO-BETHESDA2: every picture Climates & Calories draws is a spec or ours - one of them, never two, never none', () => {
  const drawn = [...VENDOR_ICON_FILES, ...VENDOR_TENT_FILES];
  // OWN-WORK3 (2026-10-31): the twenty pictures Climates & Calories 1.7.1's manifest named, as a literal - the manifest left the tree
  const names = ['532_0-0', '532_1-0', '533_0-0', '533_1-0', '534_0-0', '534_1-0', '535_0-0', '535_1-0', '536_0-0', '536_1-0', '537_0-0', '537_1-0',
    '538_0-0', '538_1-0', '538_2-0', '539_0-0', '50_7-0', '67_10-0', 'RALZARTAVERN', 'BLANKMENU_TAVERN'];
  assert.deepEqual(names.filter((n) => !drawn.includes(n)), ['RALZARTAVERN', 'BLANKMENU_TAVERN'], 'the port draws all but the two tavern menus');
  // PIN MOVED (NO-BETHESDA3, then OWN-WORK4, 2026-10-31): every picture not Daggerfall's own is ours (itemIcons.js OWN_ICONS)
  for (const n of drawn) assert.equal([derivedIconSpec(n) != null, ownIconSpec(n) != null].filter(Boolean).length, 1, `${n}: a spec or ours - exactly one`);
  // PIN MOVED (OWN-AUDIT, 2026-11-01): the mouldy cooked fish was a spec of the plain fish - it is our mould now
  assert.deepEqual(drawn.filter((n) => ownIconSpec(n)), ['532_0-0', '532_1-0', '533_0-0', '533_1-0', '534_0-0', '534_1-0', '535_0-0', '535_1-0', '536_0-0', '536_1-0', '537_0-0', '537_1-0', '538_0-0', '538_1-0', '538_2-0', '539_0-0'], 'ours: the spoiled faces, raw meat and the waterskin');
  const specs = listing(CC);
  assert.deepEqual(Object.keys(specs).sort(), ['50_7-0', '67_10-0'], 'the tent\'s two (OWN-WORK4: the mouldy bread carried the author\'s mould; OWN-AUDIT: the mouldy fish was the plain fish - both ours)');
  assert.deepEqual(specs['50_7-0'], { from: [50, 7, 0], pal: 'PAL.PAL' }, 'the tent\'s canvas IS TEXTURE.050 record 7');
  assert.deepEqual(specs['67_10-0'], { from: [67, 10, 0], pal: 'PAL.PAL' }, 'the pole IS TEXTURE.067 record 10');
  assert.ok(Object.values(specs).every((spec) => !spec.edits), 'no spec carries another hand\'s pixels');
  assert.equal(existsSync(join(root, 'vendor/climates-calories')), false, 'OWN-WORK4: no file of the release\'s is carried');
});

/** A one-record, one-frame, uncompressed TEXTURE file (test/formats/classicpictures.test.js's). */
function textureFile(width, height, pixel) {
  const recordAt = 26 + 20, dataOffset = 28;
  const bytes = new Uint8Array(recordAt + dataOffset + 256 * height);
  const v = new DataView(bytes.buffer);
  v.setInt16(0, 1, true);
  v.setInt32(26 + 2, recordAt, true);
  v.setInt16(recordAt + 4, width, true); v.setInt16(recordAt + 6, height, true);
  v.setInt16(recordAt + 8, 0, true);
  v.setUint32(recordAt + 14, dataOffset, true);
  v.setUint16(recordAt + 20, 1, true);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) bytes[recordAt + dataOffset + y * 256 + x] = pixel(x, y);
  return bytes;
}

test('NO-BETHESDA2: a rebuilt picture comes from the player\'s record in its own palette, its clear pixels 0,0,0,0 as a canvas decode reads them', async () => {
  const pal = new Uint8Array(768);
  for (let i = 0; i < 256; i++) pal.set([i, 255 - i, 7], i * 3);
  const files = { 'TEXTURE.210': textureFile(3, 2, (x, y) => (x === 0 && y === 0 ? 0 : 10 + x + y * 3)), 'PAL.PAL': pal };
  const art = createClassicPictures(async (n) => { if (!files[n]) throw new Error(`${n}: missing`); return files[n]; });
  // one pixel the record draws made clear by the author (colour kept under it in the file), one repainted
  const pic = await rebuiltPicture({ from: [210, 0, 0], pal: 'PAL.PAL', edits: [[1, 0, '3a3a3a00'], [2, 1, '090807ff']] }, art);
  const at = (x, y) => [...pic.data.subarray((y * 3 + x) * 4, (y * 3 + x) * 4 + 4)];
  assert.deepEqual(at(0, 0), [0, 0, 0, 0], 'index 0: clear');
  assert.deepEqual(at(1, 0), [0, 0, 0, 0], 'the author\'s clear pixel: no colour under it');
  assert.deepEqual(at(2, 0), [12, 243, 7, 255], 'the record\'s pixel, in PAL.PAL');
  assert.deepEqual(at(2, 1), [9, 8, 7, 255], 'the author\'s pixel');
  await assert.rejects(rebuiltPicture({ from: [211, 0, 0], pal: 'PAL.PAL' }, art), /missing/, 'no such file: the build refuses');
});

test('NO-BETHESDA2: a torch picture a spec names takes the build path; ours is painted; nothing is fetched; the probe admits both', async () => {
  const asked = [];
  const art = { build: async (spec) => { asked.push(spec); return { width: 2, height: 1, data: new Uint8Array([9, 9, 9, 0, 1, 2, 3, 255]) }; } };
  const pic = await torchPicture('112358_1-0', { art });
  assert.deepEqual(asked, [derivedTorchSpec('112358_1-0')], 'built from its own spec');
  assert.deepEqual([...pic.data], [0, 0, 0, 0, 1, 2, 3, 255]);
  const own = await torchPicture('112358_0-0', { art: { build: async () => assert.fail('our own picture was built from classic art') } });
  assert.deepEqual([own.width, own.height], [31, 34], 'OWN-WORK4: the dropped torch, painted at the release\'s size');
  assert.equal(await torchPicture('112358_0-9'), null, 'none past the last frame');
  await assert.rejects(torchPicture('112358_2-4', { art: { build: async () => { throw new Error('TEXTURE.210: missing'); } } }), /missing/,
    'no TEXTURE.210: refused, which the loaders read as the frame missing');
  // a candle's frame is admitted by its spec, a torch's by our recipe, a frame past the last by neither
  assert.equal(inTorchSet('112358_1-4.png'), true);
  assert.equal(inTorchSet('112358_11-0.png'), true);
  assert.equal(inTorchSet('112358_1-5.png'), false, 'the probe\'s miss past the candle\'s fifth frame');
  assert.equal(inTorchSet('112358_0-0.png'), true, 'ours');
  assert.equal(inTorchSet('112358_0-4.png'), false, 'past our fourth frame');
  // both default loaders go through it
  for (const [f, fn] of [['src/systems/handheldTorches.js', 'defaultLoadSprite'], ['src/scenes/droppedTorches.js', 'defaultLoadTexture']]) {
    assert.match(read(f), new RegExp(`async function ${fn}\\(record, frame\\) \\{\\n[^\\n]*\\n\\s*const pic = await torchPicture\\(`), `${f}: ${fn}`);
  }
});

test('NO-BETHESDA2: a Climates & Calories picture a spec names reaches the texture door built, never fetched - its own palette, not the door\'s context', async () => {
  const was = textureDeriveContext();
  clearVendorTextures();
  setTextureDeriveContext({ classicRgba: async () => assert.fail('the door\'s context is ART_PAL alone - the spec\'s palette is the build\'s') });
  try {
    const asked = [];
    const art = { build: async (spec) => { asked.push(spec.from.join('_')); return { width: 1, height: 2, data: new Uint8Array([40, 41, 42, 255, 9, 9, 9, 0]) }; } };
    assert.equal(installSurvivalIcons({ art }), 18);
    const decode = async () => assert.fail('OWN-WORK4: no survival picture is a file');
    await preloadTextureArchive(534, { decode });
    assert.deepEqual(asked, ['211_31_0', '211_31_0'], 'the mouldy and the rotten bread: our rot over the player\'s bread');
    await preloadTextureArchive(536, { decode });
    await preloadTextureArchive(50, { decode });
    assert.deepEqual([...decodedTextureTopDown(50, 7).rgba], [40, 41, 42, 255, 0, 0, 0, 0], 'a rebuilt picture, top-down, its clear pixel 0,0,0,0 (OWN-AUDIT: the tent\'s, the fish being ours)');
    await preloadTextureArchive(67, { decode });
    assert.deepEqual(asked.slice(4), ['50_7_0', '67_10_0'], 'the tent\'s canvas and pole, built');
    assert.equal(isVendorArchive(50), false, 'TEXTURE.050 is still the player\'s file');
  } finally {
    setTextureDeriveContext(was);
    clearVendorTextures();
  }
});

// The prints of the pictures the mods' PNGs gave, decoded as a browser decodes them (a clear pixel 0,0,0,0): sha256
// of `WxH:` and the RGBA, first 16 hex digits. Taken from the PNGs before they left the tree. A print is no picture.
const PRINTS = Object.freeze({
  '112358_1-0': 'd2de1d03893dda78', '112358_1-1': '5fd1159b19abea3d', '112358_1-2': 'e483e993e979c949', '112358_1-3': '44b0bc7c3e9dd81a',
  '112358_1-4': 'ea0be431a5da7cad', '112358_11-0': 'f5ddea25d8fe2dcc', '112358_12-0': '238fe2baa2c67eea', '112358_2-0': 'ed4b9761697881c6',
  '112358_2-1': '8e75d8baf1e2051d', '112358_2-2': '7448bdf40aaa3405', '112358_2-3': '0ca42a659d96198d', '112358_2-4': 'ea21e5e919afd2b9',
  '50_7-0': 'b7c0d92a74e31875', '534_0-0': '0b26d527d991a4e2', '536_0-0': 'af7fa8af9e9c3a78', '67_10-0': 'cc90ed7a2c7ac3c7',   // 536_0-0: the plain fish, kept to say ours is not it
});
const printOf = (p) => createHash('sha256').update(`${p.width}x${p.height}:`).update(p.data).digest('hex').slice(0, 16);
const ARENA2 = process.env.ARENA2_PATH;

test('NO-BETHESDA2 (ARENA2): every spec builds, from the player\'s own files, the pixels the mod\'s PNG gave', { skip: !ARENA2 && 'ARENA2_PATH not set' }, async () => {
  const art = createClassicPictures(async (n) => readFileSync(join(ARENA2, n)));
  const specs = { ...listing(HT), ...listing(CC) };
  const sizes = {};
  for (const [n, spec] of Object.entries(specs)) {
    const pic = await rebuiltPicture(spec, art);
    sizes[n] = [pic.width, pic.height];
    assert.equal(printOf(pic), PRINTS[n.replace(/_Emission$/, '')], `${n}: the picture the PNG gave`);
  }
  assert.equal(Object.keys(specs).length, 22, 'OWN-AUDIT (2026-11-01): less the mouldy cooked fish, ours');
  // PIN MOVED (SURV-TENT, survart_icons.test.js): the canvas and the pole are the sizes the bundle's Texture2Ds carry
  assert.deepEqual(sizes['50_7-0'], [32, 32], 'the canvas');
  assert.deepEqual(sizes['67_10-0'], [64, 8], 'the pole');
  assert.deepEqual([sizes['112358_1-0'], sizes['112358_2-0']], [[9, 19], [15, 21]], 'the candle 9x19, the holy candle 15x21 (the vendor README)');
});
