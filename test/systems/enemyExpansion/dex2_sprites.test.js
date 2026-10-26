// DEX2 (bible/04-Characters/Enemy-Expansion.md section 6): DAGGERFALL ENEMY EXPANSION'S SPRITES ON THE TEXTURE DOOR - every
// picture the tables draw registered once and built from the player's own files (ARN3, 2026-10-26: the authors' own
// art and their repaints are gone; derived.json's records, the classic copies of dexStandIns.js and TES: Arena's
// sprites stand in), a stand-in's frames the registry's, the xml's scale ungated on a stand-in, a frame's emission map
// beside it, and DFU's two import rules held of the data.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEX_ART } from '../../../src/systems/enemyExpansion/dexArt.js';
import { dexSpriteEntries, dexXmlScales, installDexSprites, _resetDexSprites } from '../../../src/systems/enemyExpansion/dexSprites.js';
import { DEX_STAND_INS } from '../../../src/systems/enemyExpansion/dexStandIns.js';
import { addVendorTextures, clearVendorTextures, vendorTextureStandIn, vendorFrameCount, isVendorArchive, decodedTextureBytes, preloadTextureArchive } from '../../../src/systems/textureReplacement.js';
import { readPng, writePng } from '../../../tools/pngIO.mjs';
import { mobileBillboardSize } from '../../../src/world/rmbFlats.js';
import { billboardXmlScale, unregisterBillboardXml, registerBillboardXml } from '../../../src/world/billboardXml.js';
import { setValue } from '../../../src/systems/settings/settings.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');
const VENDOR = 'vendor/daggerfall-enemy-expansion';
const DERIVED = JSON.parse(rd(`${VENDOR}/derived.json`));
/** ARN3: the install with the player's TES: Arena never read - the classic copies and the derived pictures alone. */
const noArena = { arena: async () => 0 };

test('DEX2 every picture DFU imports is one entry, built from the player\'s own files - a record derived.json names, or (ARN3) a stand-in\'s copy where the authors\' art was; a picture past a gap is never registered', () => {
  const entries = dexSpriteEntries();
  const keys = entries.map((e) => `${e.archive}_${e.record}-${e.frame}_${e.map}`);
  assert.equal(new Set(keys).size, keys.length, 'no picture twice');
  for (const e of entries) {
    assert.equal(e.standIn, true, `${e.fileName}: a stand-in - no TEXTURE file carries ${e.archive}`);
    assert.ok(e.archive > 511, `${e.fileName}: a mod's archive`);
    assert.equal(typeof e.build, 'function', `${e.fileName}: built, never fetched - no file of the mod's is carried`);
    assert.equal(e.load, undefined, `${e.fileName}: nothing to load`);
  }
  // every record of every archive's layout has its frame 0 - the derived archives from derived.json, frame for frame
  for (const [a, art] of Object.entries(DEX_ART)) {
    const mine = entries.filter((e) => e.archive === Number(a) && e.map === 'Albedo');
    art.frames.forEach((n, r) => assert.ok(!n || mine.some((e) => e.record === r && e.frame === 0), `${a}_${r}-0`));
    if (DEX_STAND_INS[a]) continue;
    assert.equal(mine.length, art.frames.reduce((x, y) => x + y, 0), `${a}: every frame DFU imports`);
    for (const e of mine) assert.ok(Object.hasOwn(DERIVED, e.fileName), `${e.fileName} is derived.json's`);
  }
  // past a gap: never registered (1500_14-7 after 14-0; 1500_4-3..7 after 4-2 is missing)
  for (const name of ['1500_14-7', '1500_4-3', '1500_4-7']) assert.ok(!entries.some((e) => e.fileName === name), `${name} is past its record's gap - DFU never imports it`);
  // the emission: a frame's own map, the Will-o'-wisp's alone now (the Hell Hound's were the authors')
  const lit = entries.filter((e) => e.map === 'Emission');
  assert.deepEqual([...new Set(lit.map((e) => e.archive))], [1610]);
  assert.equal(lit.length, 200, 'its twenty records\' ten frames, each its map');
});

test('ARN3 no picture of the authors\' is asked for: the stand-ins replace exactly the archives their art was in, and every copy builds from the player\'s classic records', async () => {
  const theirs = Object.entries(DEX_ART).filter(([, art]) => art.from !== 'derived').map(([a]) => Number(a));
  assert.deepEqual(Object.keys(DEX_STAND_INS).map(Number), theirs, 'every archive whose pictures were theirs, and no other');
  const asked = [];
  const ctx = { classicRgba: async (a, r, f) => { asked.push([a, r, f]); return { width: 2, height: 3, data: new Uint8Array(24) }; }, classicScale: async () => ({ width: -80, height: -80 }) };
  const one = (name) => dexSpriteEntries().find((e) => e.fileName === name);
  assert.deepEqual(await one('1504_0-1').build(ctx), { width: 2, height: 3, data: new Uint8Array(24) }, 'a repaint\'s copy: the frame it was painted over, at the mod\'s xml scale');
  assert.deepEqual(asked.at(-1), [482, 0, 1]);
  const barbarian = await one('1507_5-0').build(ctx);
  assert.deepEqual([asked.at(-1), barbarian.scale], [[488, 5, 0], { width: -80, height: -80 }], 'the classic Barbarian\'s own sprite, at its own record\'s scale');
});

test('DEX2 DFU\'s import rules hold of the index: every archive has its 0-0, and no record of an archive stops before its first frame', () => {
  for (const [a, art] of Object.entries(DEX_ART)) {
    assert.ok(art.frames[0] >= 1, `${a}_0-0: a custom archive imports nothing without it (GetMobileBillboardMaterial)`);
    assert.ok(art.frames.every((n) => n >= 1), `${a}: every record holds its frame 0 (records import from 0 to the first missing)`);
  }
});

test('DEX2 a stand-in\'s frames are the registry\'s - each record\'s own, as many as are registered - where it answered one for all, counted again when a registration moves the tiers (mutants: one frame; the counts never stale)', (t) => {
  t.after(() => { clearVendorTextures(); _resetDexSprites(); unregisterBillboardXml('daggerfall-enemy-expansion'); });
  clearVendorTextures();
  installDexSprites(noArena);
  const entries = dexSpriteEntries().filter((e) => e.map === 'Albedo');
  for (const [a, art] of Object.entries(DEX_ART)) {
    assert.ok(isVendorArchive(Number(a)), `${a} goes down the stand-in branch`);
    const tex = vendorTextureStandIn(Number(a));
    const counts = art.frames.map((_, r) => entries.filter((e) => e.archive === Number(a) && e.record === r).length);
    assert.equal(tex.recordCount, counts.length, `${a}'s records`);
    assert.deepEqual(counts.map((_, r) => tex.getFrameCount(r)), counts, `${a}'s frames by record`);
  }
  assert.equal(vendorFrameCount(1507, 5), 6, 'the Barbarian\'s (1507) attack: his own six again (TEXTURE.488 record 5) - the authors\' nineteen are gone');
  assert.equal(vendorFrameCount(1504, 5), DEX_ART[1504].frames[5], 'a repaint\'s copy keeps the mod\'s own frame count');
  // a gap ends a record's frames, as DFU's import stops at the first missing one
  addVendorTextures([0, 1, 3].map((frame) => ({ archive: 9601, record: 0, frame, standIn: true, load: async () => new Uint8Array(0) })));
  assert.equal(vendorFrameCount(9601, 0), 2, 'frames 0 and 1 - frame 3 past the gap is not imported');
  assert.equal(vendorFrameCount(9601, 7), 1, 'a record is at least its frame 0');
  // AUDIT DEX B10: the counts are kept per archive until a registration moves the tiers - and a registration does
  addVendorTextures([{ archive: 9601, record: 0, frame: 2, standIn: true, load: async () => new Uint8Array(0) }]);
  assert.equal(vendorFrameCount(9601, 0), 4, 'the gap filled: frames 0 to 3, counted again');
  assert.equal(vendorTextureStandIn(9601).getFrameCount(0), 4, 'and the stand-in answers it');
});

test('DEX2 a stand-in\'s xml scale applies whatever AssetInjection says - its pictures are the port\'s own; a classic sprite\'s waits for the switch, as DFU\'s mobile unit does', (t) => {
  t.after(() => { setValue('Enhancements', 'AssetInjection', 'False'); clearVendorTextures(); _resetDexSprites(); unregisterBillboardXml('daggerfall-enemy-expansion'); });
  clearVendorTextures();
  installDexSprites(noArena);
  assert.deepEqual(billboardXmlScale(1530, 0), { x: 1.3, y: 1.3 }, 'the archive xml\'s scale, registered');
  assert.deepEqual(dexXmlScales()[1504][0], [0.7265625, 0.7265625], 'a repaint\'s copy keeps the scale written for its sprite');
  assert.equal(dexXmlScales()[1507], undefined, 'ARN3: a copy of another sprite stands at its own record\'s scale, not the authors\' art\'s');
  setValue('Enhancements', 'AssetInjection', 'False');
  const standIn = { vendor: true, archive: 1530, getSize: () => ({ width: 100, height: 100 }), getScale: () => ({ width: 0, height: 0 }) };
  const classic = { archive: 1530, getSize: () => ({ width: 100, height: 100 }), getScale: () => ({ width: 0, height: 0 }) };
  const base = mobileBillboardSize(classic, 0);
  const scaled = mobileBillboardSize(standIn, 0);
  assert.ok(Math.abs(scaled.w - base.w * 1.3) < 1e-9 && Math.abs(scaled.h - base.h * 1.3) < 1e-9, 'the stand-in at 1.3, the switch off');
  setValue('Enhancements', 'AssetInjection', 'True');
  assert.ok(Math.abs(mobileBillboardSize(classic, 0).w - base.w * 1.3) < 1e-9, 'and a classic texture under the switch, as before');
});

test('DEX2 A STAND-IN\'S XML-SCALED SIZE IS ONE CACHED OBJECT (AUDIT DEX B7): mobileBillboardSize answers the same object for a texture\'s record frame after frame - it minted two a call, per foe per frame - and a new registration, a table registered again or a registrant\'s switch moves it (mutants: the cache never kept; blind to a switch; blind to a registration)', (t) => {
  t.after(() => { unregisterBillboardXml('b7-later'); unregisterBillboardXml('daggerfall-enemy-expansion'); clearVendorTextures(); _resetDexSprites(); });
  clearVendorTextures();
  installDexSprites(noArena);
  const standIn = { vendor: true, archive: 1530, getSize: () => ({ width: 100, height: 100 }), getScale: () => ({ width: 0, height: 0 }) };
  const one = mobileBillboardSize(standIn, 0);
  assert.equal(mobileBillboardSize(standIn, 0), one, 'the same object, asked again');
  const base = { w: one.w / 1.3, h: one.h / 1.3 };
  // a later registrant that names the record answers - a NEW registration moves it
  let on = true;
  const later = { 1530: { 0: [2, 3] } };
  registerBillboardXml('b7-later', later, () => on);
  const two = mobileBillboardSize(standIn, 0);
  assert.notEqual(two, one);
  assert.ok(Math.abs(two.w - base.w * 2) < 1e-9 && Math.abs(two.h - base.h * 3) < 1e-9, 'the later registrant\'s scale');
  assert.equal(mobileBillboardSize(standIn, 0), two, 'and kept');
  // its switch turned off: the mod's own scale again, with no registration between
  on = false;
  const three = mobileBillboardSize(standIn, 0);
  assert.ok(Math.abs(three.w - base.w * 1.3) < 1e-9, 'the switch is read at every ask');
  on = true;
  assert.ok(Math.abs(mobileBillboardSize(standIn, 0).w - base.w * 2) < 1e-9, 'and on again');
  // the same table registered again after an edit - its array the same, its numbers not
  later[1530][0][0] = 4;
  registerBillboardXml('b7-later', later, () => on);
  assert.ok(Math.abs(mobileBillboardSize(standIn, 0).w - base.w * 4) < 1e-9, 'a registration moves it, whatever it holds');
  // another record of the texture is its own entry
  assert.notEqual(mobileBillboardSize(standIn, 1), mobileBillboardSize(standIn, 0));
  assert.equal(mobileBillboardSize(standIn, 1), mobileBillboardSize(standIn, 1));
});

// AUDIT DEX B5: A MOBILE'S PICTURES ARE THE GPU'S ONCE UPLOADED. Every picture of an archive was decoded to RGBA on the CPU
// when the archive first loaded and kept for the session - the mod's 5,500 shipped pictures were ~350 MB of it - where DFU
// imports a mobile's pictures `readOnly: true` (TextureReplacement.cs:574, :609): on the GPU alone. Driven through the
// real pipeline and the real renderer's upload door (a stub context), with PNGs decoded as the browser decodes them
// (disc22d_flail_icon's stub). ARN3: the mod's own files are gone, so two archives of the test's own stand in - one
// plain (9801), one with an emission map beside each frame (9802) - registered as the door registers any readOnly art.
const PLAIN = 9801, LIT = 9802;
const picture = (w, h, v) => writePng({ width: w, height: h, data: new Uint8Array(w * h * 4).fill(v) });
const ART = new Map();   // file name -> PNG bytes
for (const [rec, n] of [[0, 4], [1, 4], [5, 6]]) for (let f = 0; f < n; f++) ART.set(`${PLAIN}_${rec}-${f}`, picture(30 + rec, 40 + f, 100 + f));
for (let f = 0; f < 3; f++) { ART.set(`${LIT}_0-${f}`, picture(20, 24, 50)); ART.set(`${LIT}_0-${f}_Emission`, picture(20, 24, 200)); }
const pngBytes = (name) => { const b = ART.get(name); return b.readUInt32BE(16) * b.readUInt32BE(20) * 4; };
function uploadRenderer(Renderer) {
  let made = 0;
  const gl = new Proxy({}, { get: (_, k) => (k === 'createTexture' ? () => ({ id: ++made }) : typeof k === 'string' && /^[A-Z_0-9]+$/.test(k) ? 1 : () => {}) });
  const r = Object.create(Renderer.prototype);
  Object.assign(r, { gl, textures: new Map(), emissionTextures: new Map(), emissionWhite: new Set(), _texKeysByBase: new Map(), _texBaseOf: new Map(), _replacements: new Set(), _placeholders: new Set(), _texGen: 0, _retroMips: false });
  return r;
}
const landed = async () => { for (let i = 0; i < 20; i++) await new Promise((res) => setTimeout(res, 5)); };

test('DEX2 A MOBILE\'S PICTURES ARE THE GPU\'S ONCE UPLOADED (AUDIT DEX B5): an archive decoded whole at its first load (as DFU imports it) and let go of, picture by picture, as the upload takes it, its stand-in measuring as before; a refresh decodes none back; a frame whose GPU copy was evicted draws nothing until it is decoded again, a hit asks nothing, and an emission map comes back with its albedo (mutants: the release never made; the preload decodes the released; the pending picture uploaded; a hit decoded; the size forgotten; the map after its albedo)', async (t) => {
  const was = { cib: globalThis.createImageBitmap, oc: globalThis.OffscreenCanvas };
  globalThis.createImageBitmap = async (blob) => ({ ...readPng(new Uint8Array(await blob.arrayBuffer())), close() {} });
  globalThis.OffscreenCanvas = class {
    constructor(w, h) { this.width = w; this.height = h; }
    getContext() { let bmp = null; return { drawImage: (b) => { bmp = b; }, getImageData: () => ({ width: bmp.width, height: bmp.height, data: new Uint8ClampedArray(bmp.data) }) }; }
  };
  t.after(() => { globalThis.createImageBitmap = was.cib; globalThis.OffscreenCanvas = was.oc; clearVendorTextures(); });
  clearVendorTextures();
  let slowMaps = false;   // an emission map's load held back - the albedo, asked beside it, would land first
  const load = (name) => async () => {
    if (slowMaps && /_Emission$/.test(name)) await new Promise((res) => setTimeout(res, 60));
    return new Uint8Array(ART.get(name));
  };
  addVendorTextures([...ART.keys()].map((name) => {
    const [, a, rec, f, map] = /^(\d+)_(\d+)-(\d+)(?:_(\w+))?$/.exec(name);
    return { archive: Number(a), record: Number(rec), frame: Number(f), map: map ?? 'Albedo', standIn: true, readOnly: true, fileName: name, load: load(name) };
  }));
  const { Renderer } = await import('../../../src/render/renderer.js');
  const { createDataPipeline } = await import('../../../src/scenes/dataPipeline.js');
  const r = uploadRenderer(Renderer);
  const pipe = createDataPipeline({ renderer: r, arch: null, palette: null, fetch: async (n) => { throw new Error(`no ${n} here`); } });
  const frames = (a) => [...ART.keys()].filter((n) => n.startsWith(`${a}_`) && !n.endsWith('_Emission')).map((n) => /_(\d+)-(\d+)$/.exec(n).slice(1).map(Number));
  const before = decodedTextureBytes();
  const plain = await pipe.getTexture(PLAIN);
  const whole = frames(PLAIN).reduce((n, [rec, f]) => n + pngBytes(`${PLAIN}_${rec}-${f}`), 0);
  assert.equal(frames(PLAIN).length, 14);
  assert.equal(decodedTextureBytes() - before, whole, 'the first load decodes every picture DFU imports');
  const sizes = [0, 1, 5].map((rec) => plain.getSize(rec));
  assert.deepEqual(sizes.map((z) => [z.width, z.height]), [[30, 40], [31, 40], [35, 40]], 'measured off its pictures');
  for (const [rec, f] of frames(PLAIN)) pipe.uploadRecordFrame(PLAIN, rec, f);
  assert.equal(r.textures.size, 14, 'every frame on the GPU');
  assert.equal(decodedTextureBytes() - before, 0, 'and none on the CPU');
  assert.deepEqual([0, 1, 5].map((rec) => plain.getSize(rec)), sizes, 'the stand-in measures as before: a picture let go keeps its size');
  await preloadTextureArchive(PLAIN);
  assert.equal(decodedTextureBytes() - before, 0, 'an archive\'s refresh (a tier\'s epoch moved) decodes nothing the GPU holds');
  // PLACE-LRU let a frame's GPU copy go, and a foe draws it again
  r.evictTexture(`${PLAIN}_5#3`);
  pipe.uploadRecordFrame(PLAIN, 5, 3);
  assert.equal(r.textures.has(`${PLAIN}_5#3`), false, 'on its way: nothing at its key - the draw asks again');
  await landed();
  assert.equal(decodedTextureBytes() - before, pngBytes(`${PLAIN}_5-3`), 'decoded again, that frame alone');
  pipe.uploadRecordFrame(PLAIN, 5, 3);
  assert.ok(r.textures.has(`${PLAIN}_5#3`), 'and drawn');
  assert.equal(decodedTextureBytes() - before, 0, 'and let go');
  pipe.uploadRecordFrame(PLAIN, 5, 2);
  await landed();
  assert.equal(decodedTextureBytes() - before, 0, 'a frame the GPU holds asks no decode');
  // and at the renderer's own door: a picture on its way, asked under a key the GPU holds, is not decoded; under an
  // empty key it is
  let asks = 0;
  const onItsWay = { width: 1, height: 1, colors: new Uint8ClampedArray(4), pending: () => { asks++; } };
  r.uploadTexture(PLAIN, '5#2', onItsWay);
  assert.equal(asks, 0, 'a hit asks no decode');
  r.uploadTexture(PLAIN, '9#0', onItsWay);
  assert.equal(asks, 1, 'an empty key asks it');
  // an emissive archive's frame: its map evicted with it, both back together (the map decoded before its albedo)
  await pipe.getTexture(LIT);
  for (const [rec, f] of frames(LIT)) pipe.uploadRecordFrame(LIT, rec, f);
  assert.equal(decodedTextureBytes() - before, 0, 'the lit archive\'s pictures and maps, all on the GPU');
  assert.ok(r.emissionTextures.has(`${LIT}_0#0`), 'its own map');
  r.evictTexture(`${LIT}_0#0`); r.evictEmissionTexture(`${LIT}_0#0`);
  slowMaps = true;
  for (let i = 0; i < 60 && !r.textures.has(`${LIT}_0#0`); i++) { pipe.uploadRecordFrame(LIT, 0, 0); await new Promise((res) => setTimeout(res, 5)); }   // a foe drawn, frame after frame
  assert.ok(r.textures.has(`${LIT}_0#0`), 'drawn again');
  assert.ok(r.emissionTextures.has(`${LIT}_0#0`), 'and its map with it - never the albedo first, unlit for good');
  assert.equal(decodedTextureBytes() - before, 0);
});

test('DEX2 a readOnly picture on its way is asked once at a time, and one that will not decode is asked no more until the tiers move (AUDIT DEX B5; mutant: asked every frame)', async (t) => {
  t.after(() => clearVendorTextures());
  clearVendorTextures();
  let loads = 0;
  addVendorTextures([{ archive: 9701, record: 0, frame: 0, standIn: true, readOnly: true, load: async () => { loads++; return new Uint8Array(0); } }]);   // a file that will not decode
  await preloadTextureArchive(9701);
  assert.equal(loads, 1, 'the archive\'s load');
  const stand = vendorTextureStandIn(9701);
  const p = stand.getColor32(stand.getDFBitmap(0, 0));
  assert.equal(typeof p.pending, 'function', 'a picture on its way');
  assert.deepEqual([p.width, p.height, [...p.colors]], [1, 1, [0, 0, 0, 0]], 'clear');
  for (let i = 0; i < 5; i++) { p.pending(); await landed(); }   // five frames, each finding its key empty
  assert.equal(loads, 2, 'asked once, and not again when it would not decode');
  addVendorTextures([{ archive: 9701, record: 1, frame: 0, standIn: true, load: async () => new Uint8Array(0) }]);   // the tiers move
  stand.getColor32(stand.getDFBitmap(0, 0)).pending();
  await landed();
  assert.equal(loads, 3, 'asked again under the new tiers');
});

test('DEX2 the install registers the pictures at Start, whatever the switch; a frame\'s emission map rides beside it in the pipeline (by source)', () => {
  assert.match(rd('src/systems/enemyExpansion/dexInstall.js'), /registerCustomEnemyName\([^\n]*\n {2}installDexSprites\(\);/, 'in the ALWAYS half, beside the names');
  const pipe = rd('src/scenes/dataPipeline.js');
  assert.match(pipe, /const lit = swapFrame \? decodedTexture\(archive, record, frame, 'Emission'\) : null;/, 'only beside an imported frame');
  assert.match(pipe, /if \(lit\) \{\s*\n\s*renderer\.uploadEmissionTexture\(archive, key, lit, \{ white: true, replacement: true \}\);/, 'under the frame\'s own key, lit white');
});

test('DEX2 SetupDemoEnemy\'s renderer for every mobile: the ghost shader by a Spectral row - the classic Ghost and the mod\'s wraiths alike - or a mod\'s word, and NoShadow casting none (mutant: the ghost by archive alone; NoShadow ignored)', async (t) => {
  const { setupFoeLook, foeWearsGhost, registerFoeGhost, _resetFoeGhosts } = await import('../../../src/characters/enemy/foeLook.js');
  const { ghostShaded, billboardBlended } = await import('../../../src/render/renderer.js');
  const { installEnemyExpansion, _resetEnemyExpansion } = await import('../../../src/systems/enemyExpansion/dexInstall.js');
  const { clearCustomEnemies } = await import('../../../src/characters/enemy/customEnemies.js');
  const { _resetMintRowEditors } = await import('../../../src/characters/enemy/enemyEntity.js');
  t.after(() => { _resetFoeGhosts(); _resetEnemyExpansion(); clearCustomEnemies(); _resetMintRowEditors(); clearVendorTextures(); _resetDexSprites(); unregisterBillboardXml('daggerfall-enemy-expansion'); });
  installEnemyExpansion({ on: true, log: () => {} });
  const ghost = setupFoeLook({ archive: 273 }, 18);
  assert.deepEqual([ghost.ghost, ghost.noShadow], [true, true], 'the Ghost (18): Spectral, NoShadow');
  const wraith = setupFoeLook({ archive: 1612 }, 273);
  assert.deepEqual([wraith.ghost, wraith.noShadow], [true, true], 'the mod\'s Gloom Wraith (273), on an archive of its own');
  assert.ok(ghostShaded(wraith) && billboardBlended(wraith), 'drawn in the blended phase with the ghost\'s cut - the archive alone never said so');
  const hound = setupFoeLook({ archive: 1601 }, 264);
  assert.deepEqual([hound.ghost, hound.noShadow], [undefined, undefined], 'the Hell Hound: General, casting');
  assert.ok(!ghostShaded(hound) && !billboardBlended(hound));
  assert.equal(setupFoeLook(null, 18), null, 'no batch, nothing');
  registerFoeGhost((id) => id === 264);
  assert.ok(foeWearsGhost(264), 'a mod\'s word (the Transparent property\'s door)');
  assert.ok(ghostShaded({ archive: 273 }), 'and the classic ghosts\' archives stand as they did');
});

// AUDIT DEX B4: the ghost shader by a Spectral row is TWO sites of the billboard pass, not one predicate - the opaque
// phase leaves a ghost-shaded batch to the blended one, and the blended phase sets uSpectral by it. Either reverted to
// the archive (`isSpectralArchive(b.archive)`) survived every pin: the predicate's own test cannot see the loop.
/** The billboard pass over a stub context (test/scenes/mac4_billboardkey.test.js's), recording each draw: the picture
 *  bound, whether blending was on, and the uSpectral the program held. */
async function billboardPass() {
  const { Renderer } = await import('../../../src/render/renderer.js');
  const U_SPECTRAL = { u: 'uSpectral' };
  const draws = [];
  let bound = null, blend = false, spectral = null;
  const gl = new Proxy({}, {
    get: (_, k) => {
      if (typeof k !== 'string') return undefined;
      if (k === 'bindTexture') return (target, tex) => { if (tex?.name) bound = tex.name; };
      if (k === 'enable') return (cap) => { if (cap === 'BLEND') blend = true; };
      if (k === 'disable') return (cap) => { if (cap === 'BLEND') blend = false; };
      if (k === 'uniform1i') return (loc, v) => { if (loc === U_SPECTRAL) spectral = v; };
      if (k === 'drawElements') return () => { draws.push({ tex: bound, blend, spectral }); };
      if (k === k.toUpperCase()) return k;
      return () => 0;
    },
  });
  const r = Object.create(Renderer.prototype);
  r.gl = gl;
  r.textures = new Map(); r.emissionTextures = new Map();
  r.stats = { draws: 0, programBinds: 0, vaoBinds: 0, texBinds: 0 };
  r._pointLights = []; r._proj = new Float32Array(16); r._view = new Float32Array(16);
  r._camPos = new Float32Array(3); r._indirect = new Float32Array(4); r._indirectColor = new Float32Array(3);
  r._fogColor = new Float32Array(3); r._fogMode = 0; r._fogDensity = 0; r._fogRange = new Float32Array(2);
  r._clockLit = false; r._bbFog = {}; r.bbProgram = {}; r.bbUSpectral = U_SPECTRAL;
  return { r, draws };
}

test('DEX2 THE BILLBOARD PASS DRAWS A SPECTRAL ROW\'S MOBILE AS ITS GHOST (AUDIT DEX B4): a mod\'s wraith on an archive of its own is left out of the opaque phase and drawn once, blended, with uSpectral on; a General row\'s foe beside it drawn once, opaque, plain - by the pass itself (mutants: either site by the archive alone)', async (t) => {
  const { setupFoeLook } = await import('../../../src/characters/enemy/foeLook.js');
  const { installEnemyExpansion, _resetEnemyExpansion } = await import('../../../src/systems/enemyExpansion/dexInstall.js');
  const { clearCustomEnemies } = await import('../../../src/characters/enemy/customEnemies.js');
  const { _resetMintRowEditors } = await import('../../../src/characters/enemy/enemyEntity.js');
  const { _resetFoeGhosts } = await import('../../../src/characters/enemy/foeLook.js');
  t.after(() => { _resetFoeGhosts(); _resetEnemyExpansion(); clearCustomEnemies(); _resetMintRowEditors(); clearVendorTextures(); _resetDexSprites(); unregisterBillboardXml('daggerfall-enemy-expansion'); });
  installEnemyExpansion({ on: true, log: () => {} });
  const { r, draws } = await billboardPass();
  r.textures.set('1622_0#0', { name: 'wraith' }); r.textures.set('1614_0#0', { name: 'hound' });
  const at = (archive) => ({ archive, record: '0#0', size: { w: 1, h: 1 }, origin: [0, 0, -3], vao: {}, indexCount: 6 });
  const wraith = setupFoeLook(at(1622), 273), hound = setupFoeLook(at(1614), 264);   // the Gloom Wraith (Spectral), the Hell Hound (General)
  assert.deepEqual([wraith.ghost, hound.ghost], [true, undefined], 'the producer\'s shapes');
  r.drawBillboards([wraith, hound], [1, 0, 0], [0, 1, 0]);
  assert.deepEqual(draws.filter((d) => d.tex === 'wraith'), [{ tex: 'wraith', blend: true, spectral: 1 }], 'the wraith: once, blended, as the ghost');
  assert.deepEqual(draws.filter((d) => d.tex === 'hound'), [{ tex: 'hound', blend: false, spectral: 0 }], 'the hound: once, opaque, plain');
  assert.equal(draws.length, 2);
});

test('DEX2 AN OVERWORLD BAND WEARS ITS LEAD\'S LOOK (AUDIT DEX B6): world/bandSprites.js dresses the batch it makes as SetupDemoEnemy does - a Spectral row\'s band its ghost, a NoShadow row\'s casting none, a General row\'s plain (mutant: the batch undressed)', async (t) => {
  const { createBandSprites } = await import('../../../src/world/bandSprites.js');
  const { ENEMY_BASICS } = await import('../../../src/characters/enemy/enemyBasics.js');
  const { installEnemyExpansion, _resetEnemyExpansion } = await import('../../../src/systems/enemyExpansion/dexInstall.js');
  const { clearCustomEnemies } = await import('../../../src/characters/enemy/customEnemies.js');
  const { _resetMintRowEditors } = await import('../../../src/characters/enemy/enemyEntity.js');
  const { _resetFoeGhosts } = await import('../../../src/characters/enemy/foeLook.js');
  t.after(() => { _resetFoeGhosts(); _resetEnemyExpansion(); clearCustomEnemies(); _resetMintRowEditors(); clearVendorTextures(); _resetDexSprites(); unregisterBillboardXml('daggerfall-enemy-expansion'); });
  installEnemyExpansion({ on: true, log: () => {} });
  const made = new Map();   // archive -> the batch the band made
  const renderer = { textures: new Map(), createBillboardBatch: (archive, record, size) => { const b = { archive, record, size }; made.set(archive, b); return b; }, destroyBillboardBatch() {} };
  const tex = { getFrameCount: () => 1, getSize: () => ({ width: 64, height: 64 }), getScale: () => ({ width: 0, height: 0 }) };
  const bands = createBandSprites({ renderer, getTexture: async () => tex, uploadRecordFrame: () => {} });
  const lead = [[283, 'the Will-o\'-wisp'], [274, 'the Faded Ghost'], [28, 'the Vampire'], [7, 'an Orc']];
  const list = lead.map(([mobileType], i) => ({ id: `b${i}`, mobileType, feet: [i * 3, 0, -10], distM: 50 }));
  bands.sync(list, { dt: 0 });
  await new Promise((r) => setTimeout(r, 0));
  for (let i = 0; i < 4; i++) bands.sync(list, { dt: 1 });
  const look = ([id, name]) => { const b = made.get(ENEMY_BASICS[id].maleTexture); assert.ok(b, `${name}'s band stands`); return [b.ghost, b.noShadow]; };
  assert.deepEqual(look(lead[0]), [true, true], 'Spectral, NoShadow: the ghost, casting none');
  assert.deepEqual(look(lead[1]), [true, true]);
  assert.deepEqual(look(lead[2]), [undefined, true], 'NoShadow alone');
  assert.deepEqual(look(lead[3]), [undefined, undefined], 'General: plain, casting');
  assert.equal(bands.batches().length, 4);
  bands.clear();
});

test('DEX2 the hosts wear the look where they make the batch, and the shadow pass casts no ghost (by source)', () => {
  for (const [f, n] of [['src/scenes/dungeonContext.js', 2], ['src/scenes/exteriorFoes.js', 1]]) {
    assert.equal(rd(f).match(/const batch = setupFoeLook\(renderer\.createBillboardBatch\(archive, 0, \{ w: 1, h: 1 \}, \[\[0, 0, 0\]\]\), (?:e\.)?mobileType\);/g)?.length, n, `${f}: its mobile arms`);
  }
  const sp = rd('src/render/shadowPass.js');
  assert.match(sp, /\|\| isSpectral\(b\.archive\) \|\| b\.ghost\) continue;/);
  assert.match(sp, /f\.isSpectral\(b\.archive\) \|\| b\.ghost\) continue;/);
  assert.match(rd('src/systems/enemyExpansion/dexInstall.js'), /registerFoeGhost\(\(id\) => dexProperties\(id\)\?\.isTransparent === true\);/, 'the Transparent arm, while the mod is loaded');
});
