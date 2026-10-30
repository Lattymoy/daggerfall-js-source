// THE STAND-IN DOOR AND THE DET STAND-INS. Held here: the derived-texture door (the composition, the spec round trip, a
// build entry through the texture registry, the stand-in's scale and archive); the pipeline's three seams (a mod archive
// nobody supplies, a stand-in's record 3 that IsExteriorWindow reads as a window, a registered model asked before
// ARCH3D) and the dungeon's (a model nobody supplies is GetModelData's false, never a thrown scene); the model registry;
// and the DET stand-ins the town mods place (ten meshes that face their normals, the sprites, the install).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildDerivedPicture, composeDerivedPicture, classicRecordRgba, deriveSpec } from '../../src/formats/derivedTexture.js';
import { addVendorTextures, clearVendorTextures, setTextureDeriveContext, preloadTextureArchive, decodedTexture, vendorTextureStandIn, textureReplacementBytes, isVendorArchive, setTextureReplacements, clearTextureReplacements } from '../../src/systems/textureReplacement.js';
import { registerCustomModel, unregisterCustomModel, customModelFor, hasCustomModel, emptyModel, _resetCustomModels } from '../../src/world/customModels.js';
import { MeshBuilder, DET_MODELS, DET_SEGMENT_UNITS, DET_FLAT_STAND_INS, DET_FLAT_DRAWINGS, DET_TOWN_FLATS, DET_OLD_ARCHIVES, installDetStandIns, _resetDetStandIns } from '../../src/world/detStandIns.js';
import { TOWN_PICTURE_ARCHIVE, TOWN_PICTURES } from '../../src/world/townPictures.js';
import { STAND_IN_SPRITES } from '../../src/world/standInSprites.js';
import { billboardSize } from '../../src/world/rmbFlats.js';
import { createDataPipeline, LAST_CLASSIC_TEXTURE_ARCHIVE } from '../../src/scenes/dataPipeline.js';
import { color32Bytes } from '../../src/render/renderer.js';
import { _resetModSettings } from '../../src/systems/modSettings.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

function resetAll() {
  _resetDetStandIns(); _resetCustomModels(); clearVendorTextures(); setTextureDeriveContext(null); _resetModSettings();
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

test('STAND-INS composeDerivedPicture: the record placed at `at` on a picture of `size`, clipped; the edits laid over; the rest clear', () => {
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

test('STAND-INS deriveSpec: a picture comes back from its record and its spec exactly, a clear pixel clear in both is never an edit, a picture that IS the record carries none', () => {
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

test('STAND-INS classicRecordRgba: the palette\'s colours, index 0 clear (TextureReader\'s billboard cutout); a missing record is refused', async () => {
  const palette = { getRed: (i) => i, getGreen: (i) => 255 - i, getBlue: (i) => (i * 3) & 255 };
  const pic = classicRecordRgba({ width: 3, height: 1, data: Uint8Array.from([0, 1, 200]) }, palette);
  assert.deepEqual([...pic.data], [0, 255, 0, 0, 1, 254, 3, 255, 200, 55, 88, 255]);
  await assert.rejects(buildDerivedPicture({ from: [209, 8] }, async () => null), /209_8-0 is not in the player's data/);
  const src = synthetic(3, 2);
  const got = await buildDerivedPicture({ from: [7, 4, 2] }, async (a, r, f) => (a === 7 && r === 4 && f === 2 ? src : null));
  assert.deepEqual(got.data, src.data, 'the frame is asked for');
});

test('STAND-INS a build entry on the texture door: built from the pipeline\'s own records, decoded bottom-up, gated, sized by the scale it carries - and never handed out as a file', async () => {
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

// ---- the pipeline's seams ---------------------------------------------------

function fakeRenderer() {
  return {
    uploads: [], emissions: [], meshes: [],
    uploadTexture(a, r, c) { color32Bytes(c, `uploadTexture(${a}, ${r})`); this.uploads.push(`${a}_${r}`); },
    uploadEmissionTexture(a, r) { this.emissions.push(`${a}_${r}`); },
    createMesh(m) { this.meshes.push(m); return { mesh: m }; },
  };
}

test('STAND-INS the pipeline: a mod archive nobody supplies stands in empty and is said once; a classic archive that will not load still throws', async () => {
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

test('STAND-INS the pipeline: a stand-in\'s record 3 is no window (IsExteriorWindow reads archive % 100) - uploaded, no mask asked of a bitmap it has not got', async () => {
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

test('STAND-INS the pipeline: a registered model is asked before ARCH3D (MeshReplacement first), uploaded with its textures, kept for the collider', async () => {
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

test('STAND-INS the dungeon: a model neither ARCH3D nor the registry answers is GetModelData\'s false - nothing drawn, said by name, never a thrown dungeon', () => {
  const src = read('src/scenes/dungeonContext.js');
  const body = /const getModelPre = \(id\) => \{[\s\S]*?\n {2}\};/.exec(src)?.[0];
  assert.ok(body, 'getModelPre is where it was');
  assert.ok(body.indexOf('customModelFor(id)') >= 0 && body.indexOf('customModelFor(id)') < body.indexOf('arch.getRecordIndex(id)'), 'the registry first, as MeshReplacement is');
  assert.match(body, /preModels\.set\(id, emptyModel\(\)\)/);
  assert.doesNotMatch(body, /throw /);
  const e = emptyModel();
  assert.deepEqual([e.positions.length, e.indices.length, e.subMeshes, e.doors], [0, 0, [], []]);
});

test('STAND-INS the model registry: built once, behind its switch, forgotten when unregistered', () => {
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

test('STAND-INS the ten stand-in models: every face faces its normal, every index lands, every texture is the player\'s own, and each stands where its placements say', () => {
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
      assert.ok(s.textureArchive <= LAST_CLASSIC_TEXTURE_ARCHIVE || s.textureArchive === TOWN_PICTURE_ARCHIVE, `${id}: classic textures, or the port's own drawn cloth (WD3)`);
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
  // DET's wooden pillars: one segment long - the towns stack them 85 units apart - standing on their foot: squared
  // timbers, six and eight units, as DET's catalogue and the towns' mantels and rafters read them
  for (const id of [45081, 45110]) assert.ok(near(bounds[id].lo[1], 0) && near(bounds[id].hi[1], DET_SEGMENT_UNITS * 0.025), `${id}: ${JSON.stringify(bounds[id])}`);
  assert.ok(near(bounds[45081].hi[0], 3 * 0.025) && near(bounds[45110].hi[0], 4 * 0.025), 'a six-unit and an eight-unit timber');
  // the cloth hangs from its rod (DET's tapestries); the floor pieces stand on the floor
  for (const id of [45145, 45161, 45162, 45164]) assert.ok(bounds[id].hi[1] <= 0.02 && bounds[id].lo[1] < -0.5, `${id} hangs`);
  for (const id of [45190, 45191, 45082, 45121]) assert.ok(near(bounds[id].lo[1], 0), `${id} stands on its origin`);
});

test('STAND-INS the stand-in flats: DET records as the player\'s own sprites or the port\'s drawings', () => {
  const recs = Object.entries(DET_FLAT_STAND_INS).flatMap(([a, rs]) => Object.entries(rs).map(([r, from]) => [`${a}_${r}`, from]));
  assert.equal(recs.length, 17);
  for (const [name, [a, r]] of recs) assert.ok(a <= LAST_CLASSIC_TEXTURE_ARCHIVE && Number.isInteger(r), name);
  // a record is what DET's catalogue names it - a rat, cheese and cabbage, porridge, broken bottles, a rolling pin;
  // drawn, as Daggerfall has none of them
  for (const [a, r] of [[10010, 38], [10021, 5], [10021, 9], [10021, 12], [10021, 16], [10025, 0], [10027, 3]]) assert.ok(STAND_IN_SPRITES[DET_FLAT_DRAWINGS[a][r][0]], `${a}_${r} drawn`);
  assert.equal(DET_FLAT_DRAWINGS[10010][38][0], 'brownRat', 'a rat (DET: Brown Rat)');
  assert.deepEqual(DET_FLAT_STAND_INS[10025][3], [205, 17], 'a large sack (DET: Large Sack)');
  assert.deepEqual(DET_FLAT_STAND_INS[10027][0], [208, 0], 'a tiny globe (DET: Tiny Globe)');
});

test('STAND-INS installDetStandIns: the models, the flats and the cloth behind every switch it is handed (WD3: OR\'d); a flat is built from its classic record and sized by it, or drawn', async () => {
  resetAll();
  let on = true;
  const recs = (t) => Object.values(t).reduce((n, rs) => n + Object.keys(rs).length, 0);
  const tables = [DET_FLAT_STAND_INS, DET_FLAT_DRAWINGS, DET_TOWN_FLATS];
  const old = Object.values(DET_OLD_ARCHIVES).reduce((n, a) => n + tables.reduce((m, t) => m + Object.keys(t[a] ?? {}).length, 0), 0);
  assert.equal(installDetStandIns(() => on), tables.map(recs).reduce((a, b) => a + b) + old + TOWN_PICTURES.length);
  assert.equal(installDetStandIns(() => on), 0, 'once');
  for (const id of Object.keys(DET_MODELS)) assert.equal(hasCustomModel(id), true, id);
  on = false;
  for (const id of Object.keys(DET_MODELS)) assert.equal(hasCustomModel(id), false, `${id} off with its switch`);
  on = true;
  for (const a of [10009, 10010, 10021, 10025, 10027, TOWN_PICTURE_ARCHIVE]) assert.ok(isVendorArchive(a), `${a} stands in`);
  const globe = synthetic(29, 24, 5);
  setTextureDeriveContext({
    classicRgba: async (a, r) => (a === 208 && r === 0 ? globe : synthetic(3, 3)),
    classicScale: async (a, r) => (a === 208 && r === 0 ? { width: 12, height: 12 } : { width: 0, height: 0 }),
  });
  await preloadTextureArchive(10027);
  await preloadTextureArchive(10010);
  await preloadTextureArchive(10009);
  const d = decodedTexture(10027, 0);
  assert.deepEqual([d.width, d.height, d.recordScale], [29, 24, { width: 12, height: 12 }]);
  assert.deepEqual(vendorTextureStandIn(10027).getScale(0), { width: 12, height: 12 }, 'as big as the globe Daggerfall draws');
  const rat = decodedTexture(10010, 38), drawn = STAND_IN_SPRITES.brownRat();
  assert.deepEqual([rat.width, rat.height, rat.recordScale], [drawn.width, drawn.height, { width: 0, height: 0 }], 'the rat drawn, at a pixel a classic unit');
  on = false;
  assert.equal(decodedTexture(10027, 0), null);
  assert.equal(decodedTexture(10010, 38), null);
  // WD3: a second switch keeps them on while the first is off
  let towns = true;
  installDetStandIns(() => towns);
  assert.equal(hasCustomModel(45081), true, 'on for the towns');
  assert.ok(decodedTexture(10010, 38), 'the rat stands for the towns too');
  towns = false;
  assert.equal(hasCustomModel(45081), false, 'off with both');
  resetAll();
});

