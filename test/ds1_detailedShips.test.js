// DS1 (2026-09-25, Mac: "All mods attached are to be compatible and
// implemented 1:1") - DETAILED SHIPS 1.0.0 (Cliffworms).
//
// Held here: the vendored files against the shipped manifest (the xml
// scales read back, the author's own pictures pixel for pixel, the nine
// derived pictures' specs); the derived-texture door (the composition,
// the spec round trip, a build entry through the texture registry, the
// stand-in's scale and archive); the pipeline's three DS1 seams (a mod
// archive nobody supplies, a stand-in's record 3 that IsExteriorWindow
// reads as a window, a registered model asked before ARCH3D) and the
// dungeon's (a model nobody supplies is GetModelData's false, never a
// thrown scene); the model registry; the DET stand-ins (ten meshes that
// face their normals, twenty-four sprites, three drawn dolphins); the
// install; the switch, the room and the credit - and, with ARENA2_PATH
// set, that the nine derived pictures rebuild the AUTHOR'S pictures out
// of the player's own TEXTURE files (their hashes are pinned below, the
// pictures never are), and that every DET piece the rebuilt ship records
// place is stood in, and nothing else.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import { readPng } from '../tools/pngIO.mjs';
import { buildDerivedPicture, composeDerivedPicture, classicRecordRgba, deriveSpec } from '../src/formats/derivedTexture.js';
import { addVendorTextures, clearVendorTextures, setTextureDeriveContext, preloadTextureArchive, decodedTexture, vendorTextureStandIn, textureReplacementBytes, isVendorArchive, setTextureReplacements, clearTextureReplacements } from '../src/systems/textureReplacement.js';
import { registerCustomModel, unregisterCustomModel, customModelFor, hasCustomModel, emptyModel, _resetCustomModels } from '../src/world/customModels.js';
import { MeshBuilder, DET_MODELS, DET_SEGMENT_UNITS, DET_FLAT_STAND_INS, DET_DOLPHIN_RECORDS, drawDolphin, DOLPHIN_SCALE, installDetStandIns, _resetDetStandIns } from '../src/world/detStandIns.js';
import { DETAILED_SHIPS_VENDOR, DETAILED_SHIPS_OWN_ART, DETAILED_SHIPS_DERIVED, DETAILED_SHIPS_XML, installDetailedShipsArt, _resetDetailedShipsArt, detailedShipsOn } from '../src/systems/detailedShips.js';
import { billboardXmlScale, unregisterBillboardXml } from '../src/world/billboardXml.js';
import { billboardSize } from '../src/world/rmbFlats.js';
import { createDataPipeline, LAST_CLASSIC_TEXTURE_ARCHIVE } from '../src/scenes/dataPipeline.js';
import { color32Bytes } from '../src/render/renderer.js';
import { MOD_SETTINGS, setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { ONLINE_ROOM_MOD_KEYS, ONLINE_PLAYERS_OWN_MODS } from '../src/systems/onlineLane.js';
import { CREDITS } from '../src/ui/credits.js';
import { BlocksFile } from '../src/formats/blocksFile.js';
import { rebuildWorldDataPatch } from '../src/formats/worldDataPatch.js';
import { TextureFile } from '../src/formats/textureFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR = join(ROOT, 'vendor/detailed-ships');
const ARENA2 = process.env.ARENA2_PATH;
const HAVE_ARENA2 = !!ARENA2 && existsSync(join(ARENA2, 'BLOCKS.BSA'));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/** A picture's pixels with every clear pixel zeroed, hashed with its size - how the pins below name a picture without carrying it. */
function pictureHash({ width, height, data }) {
  const d = new Uint8Array(data);
  for (let i = 0; i < width * height; i++) if (d[i * 4 + 3] === 0) d.fill(0, i * 4, i * 4 + 4);
  return createHash('sha256').update(Buffer.from([width & 255, width >> 8, height & 255, height >> 8])).update(d).digest('hex');
}

/** The author's thirteen pictures, as pictureHash names them (measured off the shipped bundle, `detailed ships.dfmod`). */
const AUTHOR_PICTURES = Object.freeze({
  '1210_1-0': ['61x19', '3428c0dda1553ba941ee073dfe3a10538bba42bd59a15660d55e4ca2905176cc'],
  '1210_3-0': ['43x22', '3d621c4818c7a3d2247991c8855165179926015968a5b2b5d11c9a2d3ac03b72'],
  '1210_4-0': ['51x30', '8d9c65a72475c72863b312e13b772e0cd22067a2dd7185a55a11ab3e08cbbf77'],
  '1210_8-0': ['38x31', '5da1f0ed3b666d8038579939adbda70a4f4e4c643b5920c4da5ed6ebbfa44b0f'],
  '1210_9-0': ['38x31', 'c3f625a7ca5b80537e7e54760979a980e8e8ea8030673c56be226bd1ebdbdc25'],
  '1210_10-0': ['7x15', '179480e328ff27eaf9fe346d157ac636a19d7fbb85bc65c1b839d0d8f17bcaf8'],
  '1210_11-0': ['7x15', 'cfba4d477152ed57c3e9f84209e540ddceb849e63cfaea5195e597663ab81ffd'],
  '1210_12-0': ['7x15', 'ede9c17e81d6107ac27a4fbdbb6d819c5f17fc16a71f0573018d243db6cf79c9'],
  '1210_17-0': ['34x27', '8b27f788964ac0a847ab18de9287018a624a1d47c1e31583755872b90819ecd2'],
  '1210_18-0': ['29x24', '33c0005db315e4fd5b41b7f6947bf7e5bbe9909f214fcff6d0951e234289812c'],
  '1210_19-0': ['10x26', 'ea066fa3ede8cae97a14696e8bfb78d06dddae25dc122a122846ccfac1f3d110'],
  '1210_20-0': ['10x26', '91f083afaa4632387fb91c232abda0ddfd4f015af1fbb0945e18123cd5a48262'],
  '1230_30-0': ['117x176', 'b5ba949fc2fd9a42a8279c544015abebc05498fe5aa927a7265321bee707de02'],
});

function resetAll() {
  _resetDetailedShipsArt(); _resetDetStandIns(); _resetCustomModels(); clearVendorTextures();
  unregisterBillboardXml(DETAILED_SHIPS_VENDOR); setTextureDeriveContext(null); _resetModSettings();
}

/** A deterministic picture: a few clear pixels, the rest a colour of (x, y). */
function synthetic(width, height, seed = 1) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if ((x * 7 + y * 3 + seed) % 5 === 0) continue;   // clear, index-0 black
      data[i] = (x * 31 + seed) & 255; data[i + 1] = (y * 17 + seed) & 255; data[i + 2] = (x * y + seed) & 255; data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

// ---- the vendored files against the shipped manifest ---------------------

test('DS1 the manifest: the shipped one verbatim - no script, thirteen pictures, six xml, two ship records, DET a required peer', () => {
  const m = JSON.parse(read('vendor/detailed-ships/detailed-ships.dfmod.json'));
  assert.equal(m.ModTitle, 'Detailed Ships');
  assert.equal(m.ModVersion, '1.0.0');
  assert.equal(m.ModAuthor, 'Cliffworms');
  assert.equal(m.GUID, '9d7ff75b-ff75-4306-b6a6-607456d5d7fb');
  assert.deepEqual(m.Dependencies, [{ Name: 'daggerfall expanded textures', IsOptional: false, IsPeer: true, Version: '1.2.0' }]);
  const base = (f) => f.split('/').pop();
  const pictures = m.Files.filter((f) => /\.png$/i.test(f)).map((f) => base(f).replace(/\.png$/i, '')).sort();
  const xml = m.Files.filter((f) => /\.xml$/i.test(f)).map((f) => base(f).replace(/\.xml$/i, '')).sort();
  const worldData = m.Files.filter((f) => /\/WorldData\//.test(f)).map(base).sort();
  assert.equal(m.Files.length, 21);
  assert.equal(m.Files.filter((f) => /\.(cs|dll)$/i.test(f)).length, 0, 'no code');
  assert.deepEqual(pictures, Object.keys(AUTHOR_PICTURES).sort(), 'the thirteen pictures the pins name');
  assert.deepEqual(worldData, ['SHIPAA00.RMB-390-building0.json', 'SHIPAA01.RMB-630-building0.json']);
  // every picture is carried one way or the other - the author's file, or a spec over a classic record - never both, never neither
  const own = new Set(DETAILED_SHIPS_OWN_ART), derived = new Set(Object.keys(DETAILED_SHIPS_DERIVED));
  for (const p of pictures) assert.ok(own.has(p) !== derived.has(p), `${p}: exactly one of file and spec`);
  assert.equal(own.size + derived.size, 13);
  // the xml table below restates the six files
  assert.deepEqual(Object.entries(DETAILED_SHIPS_XML).flatMap(([a, recs]) => Object.keys(recs).map((r) => `${a}_${r}-0`)).sort(), xml);
});

test('DS1 the six xml files: the bundle\'s text, read back into the table the port registers', () => {
  const files = readdirSync(join(VENDOR, 'Textures')).filter((f) => f.endsWith('.xml')).sort();
  assert.equal(files.length, 6);
  for (const f of files) {
    const text = readFileSync(join(VENDOR, 'Textures', f), 'utf8');
    const [, archive, record] = /^(\d+)_(\d+)-0\.xml$/.exec(f);
    const sx = Number(/<scaleX>([^<]+)<\/scaleX>/.exec(text)[1]), sy = Number(/<scaleY>([^<]+)<\/scaleY>/.exec(text)[1]);
    assert.deepEqual(DETAILED_SHIPS_XML[archive][record], [sx, sy], f);
  }
  assert.deepEqual(DETAILED_SHIPS_XML[1210][1], [0.5, 0.5]);
  assert.deepEqual(DETAILED_SHIPS_XML[1230][30], [0.2, 0.2], 'the statue is drawn big and shown at a fifth');
});

test('DS1 the author\'s own four pictures: the vendored PNGs are the bundle\'s pixels exactly (the statue King of Worms\' and Zoran\'s)', () => {
  const pngs = readdirSync(join(VENDOR, 'Textures')).filter((f) => f.endsWith('.png')).map((f) => f.replace(/\.png$/, '')).sort();
  assert.deepEqual(pngs, [...DETAILED_SHIPS_OWN_ART].sort(), 'no classic picture ships as a file');
  for (const name of DETAILED_SHIPS_OWN_ART) {
    const pic = readPng(readFileSync(join(VENDOR, 'Textures', `${name}.png`)));
    const [size, hash] = AUTHOR_PICTURES[name];
    assert.equal(`${pic.width}x${pic.height}`, size, name);
    assert.equal(pictureHash(pic), hash, `${name}: the author's pixels`);
  }
});

test('DS1 the nine derived pictures: classic records by archive and number, the author\'s pixels as edits - five whole, four painted', () => {
  const specs = DETAILED_SHIPS_DERIVED;
  assert.deepEqual(Object.keys(specs).sort(), ['1210_1-0', '1210_17-0', '1210_18-0', '1210_19-0', '1210_20-0', '1210_3-0', '1210_4-0', '1210_8-0', '1210_9-0']);
  for (const [name, s] of Object.entries(specs)) {
    assert.ok(Array.isArray(s.from) && s.from[0] <= LAST_CLASSIC_TEXTURE_ARCHIVE, `${name}: from a classic archive`);
    const [w, h] = AUTHOR_PICTURES[name][0].split('x').map(Number);
    if (s.size) assert.deepEqual(s.size, [w, h], `${name}: the picture's own size`);
    for (const [x, y, c] of s.edits ?? []) {
      assert.ok(x >= 0 && y >= 0 && x < w && y < h, `${name}: an edit on the picture`);
      assert.match(c, /^[0-9a-f]{8}$/, name);
    }
  }
  // the whole ones: a map and two scrolls (TEXTURE.209), a loaf and a ham (TEXTURE.211), moved to 1210 so an xml can size them
  for (const [name, from] of [['1210_1-0', [209, 8]], ['1210_3-0', [209, 5]], ['1210_4-0', [209, 6]], ['1210_17-0', [211, 31]], ['1210_18-0', [211, 40]]]) {
    assert.deepEqual(specs[name], { from }, name);
  }
  // the painted ones: fruit in the empty basket, and two bottles a row lower with a cork on
  assert.deepEqual([specs['1210_8-0'].from, specs['1210_8-0'].edits.length], [[205, 9], 166]);
  assert.deepEqual([specs['1210_9-0'].from, specs['1210_9-0'].edits.length], [[205, 9], 188]);
  for (const [name, rec] of [['1210_19-0', 13], ['1210_20-0', 16]]) {
    const s = specs[name];
    assert.deepEqual([s.from, s.size, s.at, s.edits.length], [[205, rec], [10, 26], [0, 1], 18], name);
    assert.ok(s.edits.every(([, y]) => y <= 3), `${name}: the author painted the top four rows and nothing else`);
  }
});

// ---- the derived-texture door ----------------------------------------------

test('DS1 composeDerivedPicture: the record placed at `at` on a picture of `size`, clipped; the edits laid over; the rest clear', () => {
  const src = synthetic(4, 3, 2);
  const pic = composeDerivedPicture({ from: [1, 2], size: [5, 5], at: [2, 1], edits: [[0, 0, '11223344'], [4, 4, 'aabbccff']] }, src);
  assert.deepEqual([pic.width, pic.height], [5, 5]);
  const px = (p, x, y) => [...p.data.subarray((y * p.width + x) * 4, (y * p.width + x) * 4 + 4)];
  assert.deepEqual(px(pic, 0, 0), [0x11, 0x22, 0x33, 0x44], 'an edit');
  assert.deepEqual(px(pic, 4, 4), [0xaa, 0xbb, 0xcc, 0xff], 'an edit over the record');
  assert.deepEqual(px(pic, 1, 1), [0, 0, 0, 0], 'off the record and unedited: clear');
  assert.deepEqual(px(pic, 2, 1), px(src, 0, 0), 'the record\'s top-left lands at `at`');
  assert.deepEqual(px(pic, 4, 3), px(src, 2, 2));
  assert.deepEqual(composeDerivedPicture({ from: [1, 2] }, src).data, src.data, 'no size and no at: the record itself');
  assert.throws(() => composeDerivedPicture({ from: [1, 2], edits: [[4, 0, '00000000']] }, src), /off a 4x3 picture/);
});

test('DS1 deriveSpec: a picture comes back from its record and its spec exactly, a clear pixel clear in both is never an edit, a picture that IS the record carries none', () => {
  const src = synthetic(9, 7, 3);
  assert.deepEqual(deriveSpec([5, 1], src, src), { from: [5, 1] });
  for (let seed = 0; seed < 40; seed++) {
    const pic = synthetic(10, 8, seed);
    const at = [seed % 3 - 1, (seed >> 2) % 3 - 1];
    const spec = deriveSpec([5, 1], pic, src, at);
    assert.deepEqual(composeDerivedPicture(spec, src).data, pic.data, `seed ${seed}`);
  }
  // Unity bled colour under a clear pixel ("Alpha Is Transparency"): a clear pixel over a clear one is equal
  const bled = { width: src.width, height: src.height, data: new Uint8Array(src.data) };
  for (let i = 0; i < bled.width * bled.height; i++) if (bled.data[i * 4 + 3] === 0) bled.data.fill(77, i * 4, i * 4 + 3);
  assert.deepEqual(deriveSpec([5, 1], bled, src), { from: [5, 1] });
});

test('DS1 classicRecordRgba: the palette\'s colours, index 0 clear (TextureReader\'s billboard cutout); a missing record is refused', async () => {
  const palette = { getRed: (i) => i, getGreen: (i) => 255 - i, getBlue: (i) => (i * 3) & 255 };
  const pic = classicRecordRgba({ width: 3, height: 1, data: Uint8Array.from([0, 1, 200]) }, palette);
  assert.deepEqual([...pic.data], [0, 255, 0, 0, 1, 254, 3, 255, 200, 55, 88, 255]);
  await assert.rejects(buildDerivedPicture({ from: [209, 8] }, async () => null), /209_8-0 is not in the player's data/);
  const src = synthetic(3, 2);
  const got = await buildDerivedPicture({ from: [7, 4, 2] }, async (a, r, f) => (a === 7 && r === 4 && f === 2 ? src : null));
  assert.deepEqual(got.data, src.data, 'the frame is asked for');
});

test('DS1 a build entry on the texture door: built from the pipeline\'s own records, decoded bottom-up, gated, sized by the scale it carries - and never handed out as a file', async () => {
  resetAll();
  const src = synthetic(6, 4, 9);
  assert.equal(addVendorTextures([{ archive: 9901, record: 2, standIn: true, fileName: 'probe', gate: () => gateOn, build: async (ctx) => ({ ...(await buildDerivedPicture({ from: [205, 9] }, ctx.classicRgba)), scale: { width: -64, height: 32 } }) }]), 1);
  let gateOn = true;
  const asked = [];
  // no pipeline up: the build is refused (its classic art is not here) and the archive preload says so, never throws
  const warn = console.warn; const warns = []; console.warn = (...a) => warns.push(a.join(' '));
  try { await preloadTextureArchive(9901); } finally { console.warn = warn; }
  assert.equal(decodedTexture(9901, 2), null);
  assert.match(warns.join(' | '), /probe would not decode: .*no pipeline is up/);
  setTextureDeriveContext({ classicRgba: async (a, r, f) => { asked.push([a, r, f]); return src; } });
  await preloadTextureArchive(9901);
  assert.deepEqual(asked, [[205, 9, 0]]);
  const d = decodedTexture(9901, 2);
  assert.deepEqual([d.width, d.height], [6, 4]);
  assert.deepEqual([...d.colors.subarray(0, 24)], [...src.data.subarray(3 * 24, 4 * 24)], 'row 0 of the upload is the picture\'s bottom row');
  const t = vendorTextureStandIn(9901);
  assert.equal(t.archive, 9901, 'billboardSize reads the archive to lay an xml scale on');
  assert.equal(t.recordCount, 3);
  assert.deepEqual(t.getScale(2), { width: -64, height: 32 }, 'the scale the build carried - TextureFile.getScale\'s shape');
  assert.deepEqual(t.getScale(0), { width: 0, height: 0 }, 'a record with no picture: zero, never {x, y}');
  const size = billboardSize(t, 2);
  assert.ok(Math.abs(size.w - (6 - 1) * 0.025) < 1e-9 && Math.abs(size.h - (4 + 0) * 0.025) < 1e-9, JSON.stringify(size));   // trunc(6 * -0.25) = -1, trunc(4 * 0.125) = 0
  // a player's loose-file pack is up (M-TEX): its loader must not be asked for a picture that is built, never a file
  const looseAsked = [];
  setTextureReplacements([], async (name) => { looseAsked.push(name); return new Uint8Array([1, 2, 3]); });
  assert.equal(await textureReplacementBytes(9901, 2), null, 'a derived picture has no file to hand over');
  assert.deepEqual(looseAsked, []);
  clearTextureReplacements();
  gateOn = false;
  assert.equal(decodedTexture(9901, 2), null, 'behind its switch');
  resetAll();
});

// ---- the pipeline's DS1 seams ------------------------------------------------

function fakeRenderer() {
  return {
    uploads: [], emissions: [], meshes: [],
    uploadTexture(a, r, c) { color32Bytes(c, `uploadTexture(${a}, ${r})`); this.uploads.push(`${a}_${r}`); },
    uploadEmissionTexture(a, r) { this.emissions.push(`${a}_${r}`); },
    createMesh(m) { this.meshes.push(m); return { mesh: m }; },
  };
}

test('DS1 the pipeline: a mod archive nobody supplies stands in empty and is said once; a classic archive that will not load still throws', async () => {
  resetAll();
  assert.equal(LAST_CLASSIC_TEXTURE_ARCHIVE, 511);
  const renderer = fakeRenderer();
  const pipe = createDataPipeline({ renderer, arch: null, palette: null, fetch: async (n) => { throw new Error(`no ${n} here`); } });
  const warn = console.warn; const warns = []; console.warn = (...a) => warns.push(a.join(' '));
  try {
    const t = await pipe.getTexture(10027);
    assert.equal(t.vendor, true);
    assert.equal(t.recordCount, 0, 'every upload door gates on it - the billboard stands invisible, as in DFU');
    assert.equal(await pipe.getTexture(10027), t, 'cached: said once');
    await assert.rejects(pipe.getTexture(LAST_CLASSIC_TEXTURE_ARCHIVE), /no TEXTURE\.511 here/, 'the player\'s own data missing is still an error');
  } finally { console.warn = warn; }
  assert.equal(warns.filter((w) => /TEXTURE\.10027: no such archive and no mod picture/.test(w)).length, 1);
  resetAll();
});

test('DS1 the pipeline: a stand-in\'s record 3 is no window (IsExteriorWindow reads archive % 100) - uploaded, no mask asked of a bitmap it has not got', async () => {
  resetAll();
  const pic = synthetic(5, 5, 4);
  addVendorTextures([{ archive: 1210, record: 3, standIn: true, fileName: '1210_3-0', build: async () => pic }]);
  const renderer = fakeRenderer();
  const pipe = createDataPipeline({ renderer, arch: null, palette: null, fetch: async (n) => { throw new Error(`no ${n} here`); } });
  const t = await pipe.getTexture(1210);
  assert.equal(t.vendor, true);
  pipe.uploadRecord(1210, 3);
  assert.deepEqual(renderer.uploads, ['1210_3']);
  assert.deepEqual(renderer.emissions, [], 'a mod picture\'s billboard material carries no window emission (GetStaticBillboardMaterial)');
  resetAll();
});

test('DS1 the pipeline: a registered model is asked before ARCH3D (MeshReplacement first), uploaded with its textures, kept for the collider', async () => {
  resetAll();
  addVendorTextures([{ archive: 1210, record: 3, standIn: true, fileName: '1210_3-0', build: async () => synthetic(4, 4) }]);
  const m = new MeshBuilder();
  m.box([1210, 3], [0, 0.5, 0], [1, 1, 1]);
  const model = m.build();
  let built = 0;
  registerCustomModel(99001, () => { built++; return model; });
  const renderer = fakeRenderer();
  const arch = { getRecordIndex: (id) => { throw new Error(`ARCH3D asked for ${id}`); } };
  const pipe = createDataPipeline({ renderer, arch, palette: null, fetch: async (n) => { throw new Error(`no ${n} here`); } });
  const gpu = await pipe.getGpuMesh(99001);
  assert.equal(gpu.mesh, model);
  assert.deepEqual(renderer.uploads, ['1210_3'], 'its texture uploaded as a model\'s');
  assert.equal(pipe.cpuModels.get(99001).positions, model.positions);
  assert.deepEqual(pipe.cpuModels.get(99001).doors, []);
  assert.equal(built, 1);
  unregisterCustomModel(99001);
  resetAll();
});

test('DS1 the dungeon: a model neither ARCH3D nor the registry answers is GetModelData\'s false - nothing drawn, said by name, never a thrown dungeon', () => {
  const src = read('src/scenes/dungeonContext.js');
  const body = /const getModelPre = \(id\) => \{[\s\S]*?\n {2}\};/.exec(src)?.[0];
  assert.ok(body, 'getModelPre is where it was');
  assert.ok(body.indexOf('customModelFor(id)') >= 0 && body.indexOf('customModelFor(id)') < body.indexOf('arch.getRecordIndex(id)'), 'the registry first, as MeshReplacement is');
  assert.match(body, /preModels\.set\(id, emptyModel\(\)\)/);
  assert.doesNotMatch(body, /throw /);
  const e = emptyModel();
  assert.deepEqual([e.positions.length, e.indices.length, e.subMeshes, e.doors], [0, 0, [], []]);
});

test('DS1 the model registry: built once, behind its switch, forgotten when unregistered', () => {
  _resetCustomModels();
  let on = true, builds = 0;
  registerCustomModel('45081', () => { builds++; return emptyModel(); }, () => on);
  assert.equal(hasCustomModel(45081), true);
  const a = customModelFor(45081);
  assert.equal(customModelFor(45081), a);
  assert.equal(builds, 1);
  on = false;
  assert.equal(customModelFor(45081), null);
  assert.equal(hasCustomModel(45081), false);
  on = true;
  unregisterCustomModel(45081);
  assert.equal(customModelFor(45081), null);
  _resetCustomModels();
});

// ---- the DET stand-ins -------------------------------------------------------

test('DS1 the ten stand-in models: every face faces its normal, every index lands, every texture is the player\'s own, and each stands where its placements say', () => {
  assert.deepEqual(Object.keys(DET_MODELS).map(Number).sort((a, b) => a - b), [45081, 45082, 45110, 45121, 45145, 45161, 45162, 45164, 45190, 45191]);
  const bounds = {};
  for (const [id, build] of Object.entries(DET_MODELS)) {
    const m = build();
    const nv = m.positions.length / 3;
    assert.equal(m.normals.length, nv * 3, id);
    assert.equal(m.uvs.length, nv * 2, id);
    assert.deepEqual(m.doors, [], id);
    let covered = 0;
    for (const s of m.subMeshes) {
      assert.ok(s.textureArchive <= LAST_CLASSIC_TEXTURE_ARCHIVE, `${id}: classic textures only`);
      assert.equal(s.startIndex, covered, `${id}: submeshes tile the index list`);
      covered += s.primitiveCount * 3;
    }
    assert.equal(covered, m.indices.length, id);
    const P = (i) => [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]];
    for (let t = 0; t < m.indices.length; t += 3) {
      const [i0, i1, i2] = [m.indices[t], m.indices[t + 1], m.indices[t + 2]];
      assert.ok(i0 < nv && i1 < nv && i2 < nv, `${id}: index in range`);
      const [a, b, c] = [P(i0), P(i1), P(i2)];
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const n = [m.normals[i0 * 3], m.normals[i0 * 3 + 1], m.normals[i0 * 3 + 2]];
      assert.ok(Math.abs(Math.hypot(...n) - 1) < 1e-5, `${id}: unit normals`);
      assert.ok(cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] > 0, `${id}: triangle ${t / 3} faces its normal (the port's front face)`);
    }
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < nv; i++) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], m.positions[i * 3 + k]); hi[k] = Math.max(hi[k], m.positions[i * 3 + k]); }
    bounds[id] = { lo, hi };
  }
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  // the rope and the staff: one segment long - the author stacks them 85 units apart - standing on their foot
  for (const id of [45081, 45110]) assert.ok(near(bounds[id].lo[1], 0) && near(bounds[id].hi[1], DET_SEGMENT_UNITS * 0.025), `${id}: ${JSON.stringify(bounds[id])}`);
  assert.ok(near(bounds[45081].hi[0], 0.035), 'rope-thin');
  // the hanging pieces hang from their hook; the floor pieces stand on the floor
  for (const id of [45145, 45162]) assert.ok(near(bounds[id].hi[1], 0) && bounds[id].lo[1] < -0.5, `${id} hangs`);
  for (const id of [45164, 45190, 45191, 45082, 45121, 45161]) assert.ok(near(bounds[id].lo[1], 0), `${id} stands on its origin`);
});

test('DS1 the stand-in flats: twenty-four DET records as the player\'s own sprites, three dolphins drawn - one leap, the animal riding the picture\'s upper part', () => {
  const recs = Object.entries(DET_FLAT_STAND_INS).flatMap(([a, rs]) => Object.entries(rs).map(([r, from]) => [`${a}_${r}`, from]));
  assert.equal(recs.length, 24);
  for (const [name, [a, r]] of recs) assert.ok(a <= LAST_CLASSIC_TEXTURE_ARCHIVE && Number.isInteger(r), name);
  assert.deepEqual(DET_FLAT_STAND_INS[10010][38], [201, 8], 'the ship\'s cat is a cat');
  assert.deepEqual(DET_DOLPHIN_RECORDS, [29, 30, 31]);
  assert.deepEqual(DOLPHIN_SCALE, { width: 384, height: 384 });
  const hashes = [
    '9c9c067e529a87c7769ca090629f1906dd0462373a274199040d4105df328d42',
    '5752d0d1f5185ecb84f8cf24e3343a6999334919eec5aa4d0dbb8476209751fd',
    '8a5337edee8f4ffad843fe783f999d775ddfbb62e3ebe63ba3b27c1ba0b5e1c6',
  ];
  for (let k = 0; k < 3; k++) {
    const d = drawDolphin(k);
    assert.deepEqual([d.width, d.height], [40, 56]);
    const op = (x, y) => x >= 0 && y >= 0 && x < d.width && y < d.height && d.data[(y * d.width + x) * 4 + 3] !== 0;
    let count = 0, maxY = -1;
    const seen = new Set();
    let components = 0;
    for (let y = 0; y < d.height; y++) {
      for (let x = 0; x < d.width; x++) {
        if (!op(x, y)) continue;
        count++; maxY = Math.max(maxY, y);
        assert.ok([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => op(x + a, y + b)), `pose ${k}: no stray pixel at ${x},${y}`);
        if (seen.has(y * d.width + x)) continue;
        components++;
        const stack = [[x, y]]; seen.add(y * d.width + x);
        while (stack.length) {
          const [a, b] = stack.pop();
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (op(a + dx, b + dy) && !seen.has((b + dy) * d.width + a + dx)) { seen.add((b + dy) * d.width + a + dx); stack.push([a + dx, b + dy]); }
        }
      }
    }
    assert.equal(components, 1, `pose ${k}: one animal`);
    assert.ok(count > 200 && count < 300, `pose ${k}: ${count} pixels`);
    assert.ok(maxY < 0.55 * d.height, `pose ${k}: the animal in the upper part (lowest row ${maxY})`);
    assert.equal(createHash('sha256').update(d.data).digest('hex'), hashes[k], `pose ${k}: the drawing`);
  }
});

test('DS1 installDetStandIns: the ten models and twenty-seven flats, behind the switch it is handed; a flat is built from its classic record and sized by it', async () => {
  resetAll();
  let on = true;
  assert.equal(installDetStandIns(() => on), 27);
  assert.equal(installDetStandIns(() => on), 0, 'once');
  for (const id of Object.keys(DET_MODELS)) assert.equal(hasCustomModel(id), true, id);
  on = false;
  for (const id of Object.keys(DET_MODELS)) assert.equal(hasCustomModel(id), false, `${id} off with the mod`);
  on = true;
  for (const a of [10009, 10010, 10021, 10025, 10027]) assert.ok(isVendorArchive(a), `${a} stands in`);
  const cat = synthetic(29, 24, 5);
  setTextureDeriveContext({
    classicRgba: async (a, r) => (a === 201 && r === 8 ? cat : synthetic(3, 3)),
    classicScale: async (a, r) => (a === 201 && r === 8 ? { width: 12, height: 12 } : { width: 0, height: 0 }),
  });
  await preloadTextureArchive(10010);
  await preloadTextureArchive(10009);
  const d = decodedTexture(10010, 38);
  assert.deepEqual([d.width, d.height, d.recordScale], [29, 24, { width: 12, height: 12 }]);
  assert.deepEqual(vendorTextureStandIn(10010).getScale(38), { width: 12, height: 12 }, 'as big as the cat Daggerfall draws');
  const dolphin = decodedTexture(10009, 30);
  assert.deepEqual([dolphin.width, dolphin.height, dolphin.recordScale], [40, 56, DOLPHIN_SCALE]);
  on = false;
  assert.equal(decodedTexture(10010, 38), null);
  resetAll();
});

test('DS1 installDetailedShipsArt: thirteen pictures on archives 1210 and 1230, the six xml scales, the stand-ins - all behind the mod\'s own switch', async () => {
  resetAll();
  const fetched = [];
  const fetchBytes = async (name) => { fetched.push(name); return new Uint8Array(readFileSync(join(VENDOR, 'Textures', `${name}.png`))); };
  assert.equal(installDetailedShipsArt({ fetchBytes }), 13);
  assert.equal(installDetailedShipsArt({ fetchBytes }), 0, 'once');
  assert.equal(detailedShipsOn(), true, 'on by default');
  assert.deepEqual(billboardXmlScale(1210, 3), { x: 0.75, y: 0.75 });
  assert.deepEqual(billboardXmlScale(1230, 30), { x: 0.2, y: 0.2 });
  assert.equal(hasCustomModel(45164), true);
  setTextureDeriveContext({ classicRgba: async () => synthetic(61, 19), classicScale: async () => ({ width: 0, height: 0 }) });
  await preloadTextureArchive(1230, { decode: async (bytes) => readPng(bytes) });
  await preloadTextureArchive(1210, { decode: async (bytes) => readPng(bytes) });
  assert.deepEqual(fetched.sort(), [...DETAILED_SHIPS_OWN_ART].sort(), 'the four files fetched, and only they');
  const statue = decodedTexture(1230, 30);
  assert.deepEqual([statue.width, statue.height], [117, 176]);
  const t = vendorTextureStandIn(1230);
  assert.equal(t.recordCount, 31);
  const size = billboardSize(t, 30);
  assert.ok(Math.abs(size.w - 117 * 0.025 * 0.2) < 1e-9 && Math.abs(size.h - 176 * 0.025 * 0.2) < 1e-9, 'the picture\'s own size, then the xml\'s fifth');
  assert.ok(decodedTexture(1210, 1), 'a derived picture built');
  setModSetting(DETAILED_SHIPS_VENDOR, 'Enabled', false);
  assert.equal(decodedTexture(1230, 30), null);
  assert.equal(billboardXmlScale(1230, 30), null);
  assert.equal(hasCustomModel(45164), false);
  resetAll();
});

// ---- the switch, the room, the credit, the patches ---------------------------

test('DS1 the switch, the room and the credit: one Enabled on by default; the room\'s online (one deck); Cliffworms, King of Worms and Zoran named', () => {
  const def = MOD_SETTINGS[DETAILED_SHIPS_VENDOR];
  assert.equal(def.author, 'Cliffworms');
  assert.deepEqual(Object.keys(def.keys), ['Enabled']);
  assert.equal(def.keys.Enabled.default, true);
  assert.deepEqual(ONLINE_ROOM_MOD_KEYS[DETAILED_SHIPS_VENDOR], { Enabled: true });
  assert.ok(!ONLINE_PLAYERS_OWN_MODS.includes(DETAILED_SHIPS_VENDOR));
  const row = CREDITS.mods.find((m) => m.vendor?.includes(DETAILED_SHIPS_VENDOR));
  assert.equal(row.author, 'Cliffworms');
  assert.match(row.what, /King of Worms/);
  assert.match(row.what, /Zoran/);
  assert.match(row.terms, /as long as I am credited as the author/);
  const readme = read('vendor/detailed-ships/README.md');
  assert.match(readme, /The mod may\s+be distributed\/translated without my authorization as long as I am\s+credited as the author/);
  assert.match(readme, /King of Worms and Zoran/);
});

test('DS1 the ship patches: based on the ships\' own records, the author\'s files\' sha256, the author\'s placements inserted', () => {
  const load = (f) => JSON.parse(readFileSync(join(VENDOR, 'WorldDataPatches', f), 'utf8'));
  const small = load('SHIPAA00.RMB-390-building0.json'), large = load('SHIPAA01.RMB-630-building0.json');
  assert.deepEqual(small.base, { kind: 'building', block: 'SHIPAA00.RMB', index: 390, record: 0 });
  assert.deepEqual(large.base, { kind: 'building', block: 'SHIPAA01.RMB', index: 630, record: 0 });
  assert.equal(small.sha256, '23ec33c9575c2ed9ad5e2fe9759247f87eda88cdee8b8f63e0b7da7bc422afef');
  assert.equal(large.sha256, 'be04b9c9d7b090d01fc1fa2093d05974b47cbf3141d97a34145271925eed0620');
  assert.equal(small.ops.length, 450);
  assert.equal(large.ops.length, 1707);
  // every DET piece and every mod picture the ops name has its stand-in or its picture
  const names = new Set();
  const walk = (v) => {
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (!v || typeof v !== 'object') return;
    if (Number.isInteger(v.ModelIdNum) && v.ModelIdNum >= 45000 && v.ModelIdNum < 46000) names.add(`m${v.ModelIdNum}`);
    if (Number.isInteger(v.TextureArchive) && v.TextureArchive > LAST_CLASSIC_TEXTURE_ARCHIVE) names.add(`${v.TextureArchive}_${v.TextureRecord}`);
    Object.values(v).forEach(walk);
  };
  for (const p of [small, large]) for (const op of p.ops) walk(op[2]);
  for (const n of names) {
    if (n.startsWith('m')) assert.ok(DET_MODELS[n.slice(1)], `${n}: stood in`);
    else {
      const [a, r] = n.split('_').map(Number);
      const ours = a === 1210 || a === 1230 ? AUTHOR_PICTURES[`${a}_${r}-0`] : a === 10009 ? DET_DOLPHIN_RECORDS.includes(r) : DET_FLAT_STAND_INS[a]?.[r];
      assert.ok(ours, `${n}: a picture stands there`);
    }
  }
  assert.equal([...names].filter((n) => n.startsWith('m')).length, 10);
});

// ---- with the player's own data ---------------------------------------------

test('DS1 with ARENA2: the nine derived pictures rebuild the AUTHOR\'S pictures out of the player\'s TEXTURE files', { skip: HAVE_ARENA2 ? false : 'ARENA2_PATH not set' }, async () => {
  const palette = new DFPalette();
  palette.load(new Uint8Array(readFileSync(join(ARENA2, 'ART_PAL.COL'))));
  const files = new Map();
  const classicRgba = async (archive, record, frame = 0) => {
    if (!files.has(archive)) {
      const name = `TEXTURE.${String(archive).padStart(3, '0')}`;
      const t = new TextureFile();
      assert.ok(t.load(new Uint8Array(readFileSync(join(ARENA2, name))), name, palette), name);
      files.set(archive, t);
    }
    const bm = files.get(archive).getDFBitmap(record, frame);
    return bm?.width ? classicRecordRgba(bm, palette) : null;
  };
  for (const [name, spec] of Object.entries(DETAILED_SHIPS_DERIVED)) {
    const pic = await buildDerivedPicture(spec, classicRgba);
    const [size, hash] = AUTHOR_PICTURES[name];
    assert.equal(`${pic.width}x${pic.height}`, size, name);
    assert.equal(pictureHash(pic), hash, `${name}: the author's picture, pixel for visible pixel`);
  }
  // every DET flat's stand-in is a record the player's data has
  for (const recs of Object.values(DET_FLAT_STAND_INS)) {
    for (const [a, r] of Object.values(recs)) assert.ok(await classicRgba(a, r), `${a}_${r}`);
  }
});

test('DS1 with ARENA2: the rebuilt ships place exactly the DET pieces the port stands in, and mod pictures only of the thirteen', { skip: HAVE_ARENA2 ? false : 'ARENA2_PATH not set' }, () => {
  const blocks = new BlocksFile();
  assert.ok(blocks.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA')))));
  const models = new Set(), flats = new Set(), pictures = new Set();
  let people = 0;
  for (const f of ['SHIPAA00.RMB-390-building0.json', 'SHIPAA01.RMB-630-building0.json']) {
    const json = rebuildWorldDataPatch(JSON.parse(readFileSync(join(VENDOR, 'WorldDataPatches', f), 'utf8')), blocks);
    for (const side of ['Exterior', 'Interior']) {
      const s = json.RmbSubRecord[side];
      for (const m of s.Block3dObjectRecords) if (!(m.ModelIdNum < 45000 || m.ModelIdNum >= 46000)) models.add(m.ModelIdNum);
      for (const fl of s.BlockFlatObjectRecords) {
        if (fl.TextureArchive === 1210 || fl.TextureArchive === 1230) pictures.add(`${fl.TextureArchive}_${fl.TextureRecord}-0`);
        else if (fl.TextureArchive > LAST_CLASSIC_TEXTURE_ARCHIVE) flats.add(`${fl.TextureArchive}_${fl.TextureRecord}`);
      }
      people += s.BlockPeopleRecords.length;
    }
  }
  assert.deepEqual([...models].sort(), Object.keys(DET_MODELS).map(Number).sort());
  const stood = [...Object.entries(DET_FLAT_STAND_INS).flatMap(([a, rs]) => Object.keys(rs).map((r) => `${a}_${r}`)), ...DET_DOLPHIN_RECORDS.map((r) => `10009_${r}`)];
  assert.deepEqual([...flats].sort(), stood.sort(), 'twenty-seven DET flat records, each stood in');
  for (const p of pictures) assert.ok(AUTHOR_PICTURES[p], p);
  assert.equal(people, 10, 'three sailors on the small ship, seven on the large');
});
