// M-TEX - user-supplied TEXTURES, the second domain of DFU's
// asset-injection layer. Everything here was mutation-proven.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TEXTURE_MAPS, textureName, textureEntry, textureKey,
  setTextureReplacements, clearTextureReplacements, textureReplacementCount,
  hasTextureReplacement, textureReplacementBytes,
  preloadTextureArchive, decodedTexture, decodedTextureCount,
} from '../src/systems/textureReplacement.js';
import { setValue } from '../src/systems/settings.js';

const src = (rel) => readFileSync(new URL(`../src/${rel}`, import.meta.url), 'utf8');
const on = () => setValue('Enhancements', 'AssetInjection', 'True');
const off = () => setValue('Enhancements', 'AssetInjection', 'False');

test('texture: GetName verbatim - the 000 pad is on the ARCHIVE only', () => {
  // TextureReplacement.cs:725-736. `003_5-0`, not `003_005-000`: the
  // record and frame are never padded, and a pack named the other way
  // would match nothing.
  assert.equal(textureName(3, 5, 0), '003_5-0');
  assert.equal(textureName(300, 12, 7), '300_12-7');
  assert.equal(textureName(3, 5, 0, 'Albedo'), '003_5-0', 'Albedo carries NO suffix - it is the default');
  assert.equal(textureName(3, 5, 0, 'Normal'), '003_5-0_Normal');
  // dye FIRST, map LAST - the order DFU writes them in
  assert.equal(textureName(3, 5, 0, 'Normal', 'Red'), '003_5-0_Red_Normal');
  assert.equal(textureName(3, 5, 0, 'Albedo', 'Red'), '003_5-0_Red');
  assert.deepEqual([...TEXTURE_MAPS], ['Albedo', 'Normal', 'Height', 'Emission', 'MetallicGloss', 'Mask']);
});

test('texture: parsing a supplied name, and what it refuses', () => {
  assert.deepEqual(textureEntry('003_5-0.png'),
    { archive: 3, record: 5, frame: 0, map: 'Albedo', dye: null, fileName: '003_5-0.png' });
  assert.equal(textureEntry('003_5-0_Normal.png').map, 'Normal');
  // the two optional suffixes are both bare words, so the MAP is
  // identified by BEING a TextureMap name and whatever sits in front
  // of it is the dye
  const dyed = textureEntry('003_5-0_Red_Normal.png');
  assert.equal(dyed.dye, 'Red');
  assert.equal(dyed.map, 'Normal');
  assert.equal(textureEntry('003_5-0_Red.png').dye, 'Red');
  assert.equal(textureEntry('003_5-0_Red.png').map, 'Albedo');
  // a picked directory hands back paths on some browsers
  assert.equal(textureEntry('pack/textures/003_5-0.png')?.archive, 3);
  // .PNG is a png
  assert.equal(textureEntry('003_5-0.PNG')?.archive, 3);

  // what a real pack folder also contains
  assert.equal(textureEntry('readme.txt'), null);
  assert.equal(textureEntry('preview.jpg'), null, 'only png here - DFU seeks png alone');
  assert.equal(textureEntry('.png'), null, 'a dotfile is not a texture');
  // shapes this format cannot express are REFUSED, not guessed at
  assert.equal(textureEntry('notanumber_5-0.png'), null);
  assert.equal(textureEntry('003_5.png'), null, 'no frame');
  assert.equal(textureEntry('003_5-0_a_b_Normal.png'), null, 'two tokens before the map');
});

test('texture: the FRAME is part of the key, so a partial pack stays partial', () => {
  // DFU imports animated flats frame by frame. Replacing frame 0 of a
  // torch and nothing else must leave the other frames classic.
  assert.equal(textureKey(3, 5, 0), '3_5-0');
  assert.notEqual(textureKey(3, 5, 0), textureKey(3, 5, 1));
  assert.equal(textureKey(3, 5, 0, 'Albedo'), '3_5-0', 'Albedo adds nothing, matching the name law');
  assert.equal(textureKey(3, 5, 0, 'Normal'), '3_5-0_Normal');
  // the key is NUMERIC, so the archive pad does not leak into it
  assert.equal(textureKey('003', '5', '0'), '3_5-0');
});

test('texture: DFU\'s AssetInjection gate, checked inside the lookup', () => {
  clearTextureReplacements();
  on();
  assert.equal(setTextureReplacements(['003_5-0.png', 'readme.txt'], async () => new Uint8Array([1])), 1);
  assert.equal(textureReplacementCount(), 1);
  assert.equal(hasTextureReplacement(3, 5, 0), true);
  assert.equal(hasTextureReplacement(3, 5, 1), false, 'a frame the pack does not cover');
  off();
  assert.equal(hasTextureReplacement(3, 5, 0), false, 'the gate refuses everything');
  on();
  clearTextureReplacements();
  assert.equal(hasTextureReplacement(3, 5, 0), false);
});

test('texture: bytes NEVER throw - a broken pack costs that texture', async () => {
  on();
  setTextureReplacements(['003_5-0.png'], async () => new Uint8Array([1, 2, 3]));
  assert.deepEqual([...(await textureReplacementBytes(3, 5, 0))], [1, 2, 3]);
  setTextureReplacements(['003_5-0.png'], async () => { throw new Error('quota'); });
  assert.equal(await textureReplacementBytes(3, 5, 0), null);
  setTextureReplacements(['003_5-0.png'], async () => new Uint8Array(0));
  assert.equal(await textureReplacementBytes(3, 5, 0), null, 'an empty file is as absent as no file');
  setTextureReplacements(['003_5-0.png'], null);
  assert.equal(await textureReplacementBytes(3, 5, 0), null, 'registered names with no loader');
  clearTextureReplacements();
});

test('texture: decode-ahead fills the SYNC cache, per archive', async () => {
  on();
  clearTextureReplacements();
  const img = { width: 2, height: 2, data: new Uint8Array(16) };
  setTextureReplacements(['003_5-0.png', '004_1-0.png'], async () => new Uint8Array([1]));
  // nothing decoded until an archive is actually loaded
  assert.equal(decodedTexture(3, 5, 0), null);

  assert.equal(await preloadTextureArchive(3, { decode: async () => img }), 1,
    'only THIS archive decodes - the other pack file is left alone');
  assert.equal(decodedTexture(3, 5, 0), img);
  assert.equal(decodedTexture(4, 1, 0), null, 'archive 4 has not been asked for yet');

  // idempotent: a second pass re-decodes nothing
  assert.equal(await preloadTextureArchive(3, { decode: async () => img }), 0);

  // a decode that throws costs THAT texture and leaves the rest
  setTextureReplacements(['005_1-0.png', '005_2-0.png'], async () => new Uint8Array([1]));
  let n = 0;
  await preloadTextureArchive(5, { decode: async () => { if (n++ === 0) throw new Error('bad png'); return img; } });
  assert.equal(decodedTextureCount() >= 1, true, 'the good one still landed');

  // the gate applies here too - no decoding at all when it is off
  clearTextureReplacements();
  setTextureReplacements(['003_5-0.png'], async () => new Uint8Array([1]));
  off();
  assert.equal(await preloadTextureArchive(3, { decode: async () => img }), 0);
  assert.equal(decodedTexture(3, 5, 0), null);
  on();
  clearTextureReplacements();
});

test('texture: a new pick does not inherit the old pick\'s pixels', async () => {
  on();
  clearTextureReplacements();
  const first = { width: 1, height: 1, data: new Uint8Array(4) };
  setTextureReplacements(['003_5-0.png'], async () => new Uint8Array([1]));
  await preloadTextureArchive(3, { decode: async () => first });
  assert.equal(decodedTexture(3, 5, 0), first);
  // clear must drop the DECODED cache too, or swapping packs shows the
  // previous pack's art for anything the new one does not cover
  clearTextureReplacements();
  assert.equal(decodedTexture(3, 5, 0), null);
  assert.equal(decodedTextureCount(), 0);
});

test('texture: the pipeline decodes AHEAD and overrides SYNCHRONOUSLY', () => {
  const p = src('scenes/dataPipeline.js');
  // the decode rides the await that already exists, per archive
  assert.match(p, /await preloadTextureArchive\(archive\)\.catch\(\(\) => \{\}\);/);
  assert.ok(p.indexOf('await preloadTextureArchive') < p.indexOf('textureFiles.set(archive, t)'),
    'decoded before the archive is published, or a draw could beat it');
  // both upload paths override, and the FRAME one keys by frame
  // AUDIT 39 F49 MOVED THESE TWO PINS: the override still decides the
  // pixels, but the chosen colour32 is now NAMED, because the
  // auto-emissive arm reuses that same albedo as its emission map
  // (TextureReader.cs:301-308) - a pack's replacement must light the
  // lantern it replaces, not the classic art beside it.
  assert.match(p, /const swap = decodedTexture\(archive, record, 0\);/);
  assert.match(p, /const color32 = swap \?\? t\.getColor32\(bitmap, 0\);/);
  assert.match(p, /renderer\.uploadTexture\(archive, record, color32\);/);
  assert.match(p, /const swapFrame = decodedTexture\(archive, record, frame\);/);
  assert.match(p, /const color32 = swapFrame \?\? t\.getColor32\(bitmap, 0\);/);
  assert.match(p, /renderer\.uploadTexture\(archive, key, color32\);/);
  // BELOW the spectral arm: that path builds albedo AND an emission
  // mask from one remap, and replacing half would light a ghost by a
  // texture it no longer wears
  assert.ok(p.indexOf('isSpectralArchive') < p.indexOf('const swap = decodedTexture'),
    'the spectral path must return before the override');
});

test('texture: BOTH packs have a URL door, and one trip can set up both', () => {
  // ?music shipped first and ?textures did not follow it, which left
  // the texture pick reachable only from the settings row - the same
  // asymmetry that makes a feature look absent. Both doors now, and a
  // player setting up for the first time can ask for both at once
  // rather than making two trips.
  const m = src('main.js');
  assert.match(m, /params\.has\('music'\) \|\| params\.has\('textures'\)/);
  assert.match(m, /if \(params\.has\('music'\)\) await ds\.pickMusicFolder\(\);/);
  assert.match(m, /if \(params\.has\('textures'\)\) await ds\.pickTextureFolder\(\);/);
  // ...and BEHIND the data gate, not around it: the picker needs the
  // same IndexedDB the ingest opens.
  const block = m.slice(m.indexOf("params.has('music') || params.has('textures')"));
  assert.ok(block.indexOf('await ensureData();') < block.indexOf('pickMusicFolder'),
    'the data gate runs first');
});

test('texture: registration rides the ONE bootstrap, and the row reports it', () => {
  assert.match(src('scenes/shared.js'), /setTextureReplacements\(names, loadTextureFile\)/);
  assert.match(src('scenes/shared.js'), /Promise\.all\(\[sound, songs, replacements, textures, morrowind\]\)/);
  // the settings row offers BOTH picks, and the alternate carries its
  // own KEY because the dialog has no button hit-testing to choose
  // with - a button that looked clickable and did nothing would be the
  // dead affordance this project keeps finding
  const w = src('ui/settingsWindow.js');
  assert.match(w, /if \(code === 'KeyT' && this\.dialog\.onAlt\)/);
  assert.match(w, /label: 'T - Textures'/, 'and the button says which key');
  assert.match(w, /textureReplacementCount\(\)/);
  // both stores exist and the upgrade creates what is MISSING
  const d = src('scenes/dataSource.js');
  // R6 RE-AIMED THIS, as M-TEX re-aimed it before: a fourth domain
  // (the DERIVED store) joined the list, and a pin spelling the list
  // out breaks on every new domain while proving nothing extra. The
  // LAW is membership - this store is an ASSET store, listed apart
  // from the ARENA2 one - so that is what is asserted now.
  assert.match(d, /const ASSET_STORES = \[[^\]]*\bTEXTURE_STORE\b[^\]]*\];/);
  // R6: the version literal moved to 5 with the derived store. What
  // these pins actually protect is that the open is VERSIONED at all
  // and that the upgrade creates only what is MISSING - an existing
  // player must gain the new store and keep every byte of the old
  // ones. A hardcoded number breaks on every domain and proves
  // nothing the `contains` guard below does not already say.
  assert.match(d, /indexedDB\.open\(DB_NAME, \d+\)/);
  assert.match(d, /for \(const name of ASSET_STORES\)/);
});
