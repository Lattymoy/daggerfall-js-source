// AUDIT STUDIO1 (2026-10-17, the owner: "Audit this and ensure perfection"; the record is
// bible/01-Overview/audits/Audit-Studio1.md): five cold lanes over the studio's frozen tree, every finding reproduced
// before it was fixed. What the fixes hold:
//
//   S1  the stand-in the studio covers: its picture stands in for a studio picture that will not load (A1), and gives
//       the studio's its size, its scale and its box - a billboard stands as big, a doll piece fits (A2)
//   S2  the boot waits for the registration alone; the port's own pictures decode after it, a few at a time (A3)
//   S3  an archive's first load waits for the studio's listing - a bounded while (A5) - so the first area is drawn in it
//   S4  a late picture lands only on the wear still current - a room repainted keeps its new paint (A4); a picture that
//       answers and is not decoded is decoded and worn late (A6)
//   S5  what the studio inherits: `lazy` (A7); a studio picture of one dye makes no dyed set of a stand-in (A8); a dye
//       the game never asks by is refused by name (A9)
//   S6  a listing that would not read is asked again; one not served is an answer (A11); the icons' cache keys on the
//       studio, and the wagon's icon asks for the install itself (U2, U3)
//   S7  the ground: a ground archive's set lays the studio's records in, the gate shut or open, at the largest
//       picture's size (D1)
//   S8  a ship's night twin is lit by its own emission picture where it has one (B4, D5)
//   S9  the check's notes: clear texels on a slot drawn solid, a name no painted model's slot; and the slots counted -
//       248, 29 of them cut-outs (D2, D6, D12)
//
// The pictures are the test's own (tools/pngIO.mjs): no game data (Port-Doctrine).
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writePng, readPng } from '../../../tools/pngIO.mjs';
import { setValue } from '../../../src/systems/settings/settings.js';
import {
  addVendorTextures, clearVendorTextures, clearTextureReplacements, setTextureReplacements, hasTextureReplacement,
  decodedTexture, preloadTextureArchive, preloadTextureRecord, isVendorArchive, vendorTextureStandIn, setTextureDeriveContext,
  holdTextureTiers, textureTiersSettled, studioRecordsOf, PRELOAD_CONCURRENCY, textureKey, addVendorTextures as addVendor, textureTierEpoch,
} from '../../../src/systems/textureReplacement.js';
import { APP_ROOT } from '../../../src/systems/appRoot.js';
import { LAST_CLASSIC_TEXTURE_ARCHIVE } from '../../../src/formats/textureFile.js';
import { registerCarrackArt, _resetCarrackArt } from '../../../src/world/ships/carrackArt.js';
import { registerLargeBoatArt, _resetLargeBoatArt } from '../../../src/world/ships/largeBoatArt.js';
import { townPictureEntries, TOWN_PICTURES } from '../../../src/world/townPictures.js';
import { installSurvivalIcons } from '../../../src/systems/survival/items.js';
import { installThunderlockIcons, PAPERDOLL_OFFSET } from '../../../src/systems/thunderlock.js';
import { yardArt, YARD_ARCHIVE } from '../../../src/world/merchantYards/merchantYardArt.js';
import { PORT_PAINTERS, PORT_ARCHIVE } from '../../../src/world/portArt.js';
import { lefayArt } from '../../../src/world/lefayArt.js';
import { LEFAY_ARCHIVE } from '../../../src/world/lefayMonument.js';
import {
  installStudioArt, studioLanded, studioUrl, studioFile, wearPainted, paintedReplacement, studioGeneration, _resetStudioArt, STUDIO_INDEX, STUDIO_HOLD_MS,
} from '../../../src/systems/studioArt/studioArt.js';
import { STUDIO_SETS, studioSlots, slotLabel } from '../../../src/systems/studioArt/studioSlots.js';
import { studioListing, pngSize, STUDIO_TREE, STUDIO_MAX_SIDE, STUDIO_MAX_BYTES } from '../../../scripts/studioArtIndex.mjs';
import { checkStudio, studioCli } from '../../../tools/studioArt.mjs';
import { createDataPipeline } from '../../../src/scenes/dataPipeline.js';
import { dfmodGroundLayers } from '../../../src/systems/dfmodTextures.js';
import { registerGalleonArt, galleonArt, _resetGalleonArt, GALLEON_ARCHIVE, GALLEON_NIGHT, TEX as GALLEON_TEX } from '../../../src/world/ships/galleonArt.js';
import { createComeSailAwayPool } from '../../../src/scenes/comeSailAway/comeSailAwayPool.js';
import { Boat } from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { HULL } from '../../../src/systems/naval/navalShips.js';
import { paintCaravanRoom, caravanRoomPictures } from '../../../src/scenes/caravanRoom.js';
import { WAGON_ARCHIVE, TEX as WAGON_TEX, lookRecord } from '../../../src/world/wagonArt.js';
import { toColor32 } from '../../../src/formats/color32Order.js';

const decode = async (bytes) => readPng(bytes);
/** A picture of the test's own, `w` x `h`, every texel `rgb` (alpha `a`). */
const picture = (w, h, rgb, a = 255) => writePng({ width: w, height: h, data: new Uint8Array(w * h * 4).map((_, i) => (i % 4 === 3 ? a : rgb[i % 4])) });
const red = (c32) => [c32.colors[0], c32.colors[1], c32.colors[2]];
/** A served studio (studio1_door's): `files` path -> PNG bytes; `gate` holds every answer until it opens; `asked` and
 *  the fetches in flight are counted. */
function served(files, { gate = null, index = true, fail = false } = {}) {
  const asked = [];
  let inFlight = 0, most = 0;
  const fetch = async (url) => {
    asked.push(url);
    if (fail) throw new Error('offline');
    inFlight++; most = Math.max(most, inFlight);
    try {
      if (gate) await gate;
      if (url === studioUrl(STUDIO_INDEX)) return index ? { ok: true, json: async () => ({ studio: 1, files: Object.keys(files) }) } : { ok: false, status: 404 };
      for (const [path, bytes] of Object.entries(files)) if (url === studioUrl(path)) return { ok: true, arrayBuffer: async () => Uint8Array.from(bytes).buffer };
      return { ok: false, status: 404 };
    } finally { inFlight--; }
  };
  return { fetch, asked, most: () => most };
}
function reset() {
  _resetStudioArt(); clearVendorTextures(); clearTextureReplacements(); _resetGalleonArt(); _resetCarrackArt(); _resetLargeBoatArt();
  setValue('Enhancements', 'AssetInjection', 'True');
  setTextureDeriveContext({ classicRgba: async () => null });
}
const turns = async (n = 5) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };
/** The browser's decode door (textureReplacement.js decodePng) given node's PNG reader, so the pipeline's own preload -
 *  which takes no decode of a test's - decodes as the game does. Restored by the caller. */
function browserDecode() {
  const had = { createImageBitmap: globalThis.createImageBitmap, OffscreenCanvas: globalThis.OffscreenCanvas };
  globalThis.createImageBitmap = async (blob) => readPng(new Uint8Array(await blob.arrayBuffer()));
  globalThis.OffscreenCanvas = class { constructor() { this.img = null; } getContext() { return { drawImage: (img) => { this.img = img; }, getImageData: () => this.img }; } };
  return () => Object.assign(globalThis, had);
}

test('AUDIT STUDIO1 S1: the stand-in the studio covers stands in for a studio picture that will not load (her painted deck, never a hole), and gives the studio\'s picture its size, its scale and its box', async () => {
  reset();
  try {
    // A1: through her real registration - the studio's deck will not load (404), its trim is no PNG
    const s = served({ [`a/${GALLEON_ARCHIVE}_${GALLEON_TEX.trim}-0.png`]: new Uint8Array([1, 2, 3]) });
    await installStudioArt({ fetch: (u) => (u.includes(`_${GALLEON_TEX.deck}-0`) ? Promise.resolve({ ok: false, status: 404 }) : s.fetch(u)), decode: async (b) => readPng(b) });
    addVendorTextures([{ archive: GALLEON_ARCHIVE, record: GALLEON_TEX.deck, studio: true, fileName: 'studio:a/deck.png', load: async () => null }]);
    registerGalleonArt(addVendorTextures);
    await preloadTextureArchive(GALLEON_ARCHIVE, { decode });
    const painted = new Map(galleonArt());
    for (const rec of [GALLEON_TEX.deck, GALLEON_TEX.trim]) {
      const got = decodedTexture(GALLEON_ARCHIVE, rec);
      assert.ok(got, `${rec}: a picture, not a hole`);
      assert.ok(Buffer.from(got.colors).equals(Buffer.from(toColor32(painted.get(rec)).colors)), `${rec}: her own painted picture stands in`);
    }
    // a studio picture decoded before the art it covers registered (the boot's install, then her pool) is decoded again
    // with it: its box is hers
    reset();
    await installStudioArt({ fetch: served({ [`a/${GALLEON_ARCHIVE}_${GALLEON_TEX.deck}-0.png`]: picture(4, 4, [33, 0, 0]) }).fetch, decode });
    await studioLanded();
    assert.equal(vendorTextureStandIn(GALLEON_ARCHIVE).getBox(GALLEON_TEX.deck), null, 'decoded alone: no box yet');
    registerGalleonArt(addVendorTextures);
    await preloadTextureArchive(GALLEON_ARCHIVE, { decode });
    assert.deepEqual(vendorTextureStandIn(GALLEON_ARCHIVE).getBox(GALLEON_TEX.deck), { width: 64, height: 64 }, 'covered: her deck\'s box');
    assert.deepEqual(red(decodedTexture(GALLEON_ARCHIVE, GALLEON_TEX.deck)), [33, 0, 0], 'still the studio\'s picture');
    // A2: a stand-in built at a classic record's scale (a town's clutter, a DET flat) - the studio's at twice its size
    reset();
    const built = { width: 16, height: 24, data: new Uint8Array(16 * 24 * 4).fill(90), scale: { width: 64, height: 64 } };
    addVendorTextures([{ archive: 39100, record: 0, standIn: true, offset: { x: 2, y: 3 }, build: async () => built }]);
    addVendorTextures([{ archive: 39100, record: 0, studio: true, fileName: 'studio:a/39100_0-0.png', load: async () => picture(32, 48, [200, 10, 10]) }]);
    await preloadTextureArchive(39100, { decode });
    const t = vendorTextureStandIn(39100);
    assert.deepEqual(t.getSize(0), { width: 16, height: 24 }, 'it stands as big as the stand-in');
    assert.deepEqual(t.getScale(0), { width: 64, height: 64 }, 'at the stand-in\'s scale');
    assert.deepEqual(t.getBox(0), { width: 16, height: 24 }, 'the doll fits it to the stand-in\'s box');
    assert.deepEqual([t.getDFBitmap(0).width, t.getDFBitmap(0).height], [32, 48], 'drawn in the studio\'s own texels');
    assert.deepEqual(t.getOffset(0), { x: 2, y: 3 });
    assert.match(readFileSync(new URL('../../../src/ui/paperDoll.js', import.meta.url), 'utf8'), /const classic = tex\.vendor \? \(tex\.getBox\?\.\(record\) \?\? null\) : tex\.getSize\(record\);/, 'the doll\'s box for a stand-in is the studio\'s');
    // a stand-in with no studio picture keeps its own answers
    addVendorTextures([{ archive: 39101, record: 0, standIn: true, build: async () => built }]);
    await preloadTextureArchive(39101, { decode });
    assert.equal(vendorTextureStandIn(39101).getBox(0), null);
  } finally { reset(); }
});

test('AUDIT STUDIO1 S2: the boot waits for the registration alone - the port\'s own pictures decode after it, never more than PRELOAD_CONCURRENCY at once', async () => {
  reset();
  try {
    let open;
    const pictures = new Promise((r) => { open = r; });
    const files = {};
    for (let r = 0; r < 20; r++) files[`a/${WAGON_ARCHIVE}_${200 + r}-0.png`] = picture(2, 2, [r, 0, 0]);
    const index = served(files);
    const s = served(files, { gate: pictures });
    const fetch = (u) => (u === studioUrl(STUDIO_INDEX) ? index.fetch(u) : s.fetch(u));
    assert.equal(await installStudioArt({ fetch, decode }), 20, 'registered while every picture is still on its way');
    assert.equal(decodedTexture(WAGON_ARCHIVE, 200), null);
    await turns();
    assert.ok(s.most() > 0 && s.most() <= PRELOAD_CONCURRENCY, `at most ${PRELOAD_CONCURRENCY} fetched at once (${s.most()})`);
    open();
    await studioLanded();
    assert.deepEqual(red(decodedTexture(WAGON_ARCHIVE, 219)), [19, 0, 0], 'every one decoded when it lands');
    assert.match(readFileSync(new URL('../../../src/scenes/shared.js', import.meta.url), 'utf8'), /const studio = installStudioArt\(\)\.catch\(\(\) => 0\);/, 'the boot\'s Promise.all carries the registration');
  } finally { reset(); }
});

test('AUDIT STUDIO1 S3: an archive\'s first load waits for the studio\'s listing - the pipeline\'s own getTexture - and a hold never waits past its bound', async () => {
  reset();
  const restore = browserDecode();
  try {
    let open;
    const gate = new Promise((r) => { open = r; });
    addVendorTextures([{ archive: 39200, record: 0, standIn: true, build: async () => ({ width: 2, height: 2, data: new Uint8Array(16).fill(50) }) }]);
    installStudioArt({ fetch: served({ 'a/39200_0-0.png': picture(2, 2, [210, 0, 0]) }, { gate }).fetch, decode });
    assert.ok(textureTiersSettled(), 'the listing is held');
    const pipe = createDataPipeline({ renderer: { uploadTexture() {}, uploadEmissionTexture() {} }, arch: null, palette: null, fetch: async (n) => { throw new Error(`no ${n} here`); } });
    let got = false;
    const asked = pipe.getTexture(39200).then(() => { got = true; });
    await turns();
    assert.equal(got, false, 'the archive waits while the listing is on its way');
    open();
    await asked;
    assert.deepEqual(red(decodedTexture(39200, 0)), [210, 0, 0], 'and is decided with the studio\'s picture in it - the first area drawn in it');
    assert.equal(textureTiersSettled(), null, 'nothing held once it landed: the next load takes no extra turn');
    // bounded: a listing that never answers is waited for `atMost` and no longer
    const t0 = Date.now();
    await holdTextureTiers(new Promise(() => {}), 30);
    assert.ok(Date.now() - t0 < 1000, 'the hold let go at its bound');
    assert.equal(textureTiersSettled(), null);
    assert.ok(STUDIO_HOLD_MS > 0 && STUDIO_HOLD_MS <= 5000, 'the studio\'s bound is a few seconds');
  } finally { restore(); reset(); }
});

test('AUDIT STUDIO1 S4: a late picture lands only on the wear still current - a room repainted while one was on its way keeps its new paint; a picture that answers and is not decoded is decoded and worn late', async () => {
  reset();
  try {
    // A4: the real paintCaravanRoom - floor paint 2 has a studio picture; the room is repainted to paint 3 before it lands
    const floor2 = lookRecord(WAGON_TEX.roomFloor, 2);
    let open;
    const gate = new Promise((r) => { open = r; });
    const install = installStudioArt({ fetch: served({ [`a/${WAGON_ARCHIVE}_${floor2}-0.png`]: picture(2, 2, [77, 1, 1]) }, { gate }).fetch, decode });
    const ups = [];
    const renderer = { uploadTexture: (a, r, c) => ups.push([r, c]), evictTexture() {} };
    paintCaravanRoom(renderer, { f: 2 });
    paintCaravanRoom(renderer, { f: 3 });
    const live = caravanRoomPictures({ f: 3 }).find(([, , from]) => from === lookRecord(WAGON_TEX.roomFloor, 3))[0];
    const before = ups.filter(([r]) => r === live).at(-1)[1];
    open();
    await install; await studioLanded(); await turns();
    const last = ups.filter(([r]) => r === live).at(-1)[1];
    assert.equal(last, before, 'the floor keeps paint 3: paint 2\'s studio picture landed on no wear');
    assert.ok(!ups.some(([r, c]) => r === live && c.colors[0] === 77), 'paint 2\'s picture never went up');
    // A6: a player's loose picture of a wagon record registered after the install, never decoded: worn late
    reset();
    await installStudioArt({ fetch: served({}).fetch, decode });
    setTextureReplacements([`${WAGON_ARCHIVE}_2-0.png`], async () => picture(2, 2, [5, 6, 7]));
    const puts = [];
    wearPainted(WAGON_ARCHIVE, 2, () => 'painted', (p, how) => puts.push([p, how]), {});
    // the loose pick's decode needs the browser's decode in the game; the test's here
    await preloadTextureRecord(WAGON_ARCHIVE, 2, 0, 'Albedo', null, { decode });
    await turns();
    assert.equal(puts[0][0], 'painted');
    assert.deepEqual([red(puts[1][0]), puts[1][1]], [[5, 6, 7], { replaced: true, late: true }], 'the loose picture worn when it decoded');
  } finally { reset(); }
});

test('AUDIT STUDIO1 S5: the studio inherits `lazy`; a studio picture of one dye makes no dyed set of a stand-in; a dye the game never asks by is refused by name', async () => {
  reset();
  try {
    // A7: over a lazy entry (Diverse Weapons' icons): the archive's preload fetches neither
    let loads = 0;
    addVendorTextures([{ archive: 39300, record: 0, lazy: true, load: async () => { loads++; return picture(2, 2, [1, 1, 1]); } }]);
    addVendorTextures([{ archive: 39300, record: 0, studio: true, load: async () => { loads++; return picture(2, 2, [2, 2, 2]); } }]);
    addVendorTextures([{ archive: 39300, record: 1, studio: true, load: async () => { loads++; return picture(2, 2, [3, 3, 3]); } }]);
    addVendorTextures([{ archive: 39300, record: 1, lazy: true, load: async () => { loads++; return picture(2, 2, [4, 4, 4]); } }]);
    await preloadTextureArchive(39300, { decode });
    assert.equal(loads, 0, 'lazy either way round: decoded when asked, never by the archive\'s preload');
    // A8: the Thunderlock's way - ONE undyed stand-in picture, asked by the item's dye
    addVendorTextures([{ archive: 39301, record: 0, standIn: true, load: async () => picture(2, 2, [9, 9, 9]) }]);
    assert.equal(hasTextureReplacement(39301, 0, 0, 'Albedo', 'Iron'), true);
    addVendorTextures([{ archive: 39301, record: 0, dye: 'Dwarven', studio: true, load: async () => picture(2, 2, [8, 8, 8]) }]);
    assert.equal(hasTextureReplacement(39301, 0, 0, 'Albedo', 'Iron'), true, 'an Iron ask still finds the stand-in');
    assert.equal(hasTextureReplacement(39301, 0, 0, 'Albedo', 'Dwarven'), true, 'a Dwarven ask the studio\'s');
    // A9: only the dyes GetName prints
    for (const ok of ['Iron', 'Elven', 'Daedric', 'Blue']) assert.ok(studioFile(`a/233_5-0_${ok}.png`), ok);
    for (const no of ['Silver', 'iron', 'Unchanged', 'Chain', 'SilverOrElven', 'Iorn', 'Albedo']) assert.equal(studioFile(`a/233_5-0_${no}.png`), null, no);
    const dir = mkdtempSync(join(tmpdir(), 'auditstudio1-'));
    try {
      mkdirSync(join(dir, STUDIO_TREE, 'a'), { recursive: true });
      writeFileSync(join(dir, STUDIO_TREE, 'artists.json'), JSON.stringify({ artists: [{ folder: 'a', name: 'a', approved: 'the test' }] }));
      writeFileSync(join(dir, STUDIO_TREE, 'a', '233_5-0_Silver.png'), picture(2, 2, [1, 1, 1]));
      assert.match(studioListing(dir).problems[0], /a dye after it as the game asks it: _Iron, never _iron or _Silver/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  } finally { reset(); }
});

test('AUDIT STUDIO1 S6: a listing that would not read is asked again, one not served is an answer; the icons\' cache keys on the studio; the wagon\'s icon asks for the install itself', async () => {
  reset();
  try {
    const failing = served({}, { fail: true });
    assert.equal(await installStudioArt({ fetch: failing.fetch, decode }), 0);
    const files = { 'a/38181_1-0.png': picture(2, 2, [1, 2, 3]) };
    const ok = served(files);
    const gen = studioGeneration();
    assert.equal(await installStudioArt({ fetch: ok.fetch, decode }), 1, 'the next boot asks again');
    assert.equal(studioGeneration(), gen + 1, 'a registration moves the generation');
    const none = served(files, { index: false });
    _resetStudioArt();
    assert.equal(await installStudioArt({ fetch: none.fetch, decode }), 0);
    assert.equal(await installStudioArt({ fetch: ok.fetch, decode }), 0, 'not served is an answer: kept');
    assert.equal(ok.asked.filter((u) => u === studioUrl(STUDIO_INDEX)).length, 1);
    const canvas = readFileSync(new URL('../../../src/ui/textureCanvas.js', import.meta.url), 'utf8');
    assert.match(canvas, /const iconsGeneration = \(\) => `\$\{dfmodGeneration\(\)\}:\$\{studioGeneration\(\)\}`;/);
    assert.match(canvas, /if \(_fittedGen !== iconsGeneration\(\)\)/, 'the fitted pictures too');
    assert.match(readFileSync(new URL('../../../src/systems/studioArt/studioArt.js', import.meta.url), 'utf8'), /export async function studioLanded\(\) \{\n {2}const n = await installStudioArt\(\);/, 'landed asks the install');
  } finally { reset(); }
});

test('AUDIT STUDIO1 S7: the ground - a ground archive\'s set lays the studio\'s records in, the gate shut or open, every layer at the largest picture\'s size', async () => {
  reset();
  try {
    // a classic TEXTURE file of the test's own: four 4 x 4 records, each its own grey
    const tex = { recordCount: 4, getDFBitmap: (r) => r, getColor32: (r) => ({ width: 4, height: 4, colors: new Uint8ClampedArray(64).fill(40 + r) }) };
    addVendorTextures([{ archive: 302, record: 2, studio: true, fileName: 'studio:a/302_2-0.png', load: async () => picture(8, 8, [220, 30, 30]) }]);
    addVendorTextures([{ archive: 302, record: 3, fileName: 'a pack of the port\'s', load: async () => picture(4, 4, [1, 1, 1]) }]);
    assert.deepEqual(studioRecordsOf(302), [2], 'the studio\'s records alone');
    for (const gate of ['False', 'True']) {
      setValue('Enhancements', 'AssetInjection', gate);
      const layers = await dfmodGroundLayers(302, tex, { decode });
      assert.equal(layers?.length, 4, `Replace Game Artwork ${gate}: a set`);
      assert.ok(layers.every((l) => l.width === 8 && l.height === 8), 'every layer at the studio\'s 8 x 8');
      assert.deepEqual(red(layers[2]), [220, 30, 30], 'its record the studio\'s');
      assert.deepEqual([layers[0].colors[0], layers[3].colors[0]], [40, 43], 'the rest Daggerfall\'s own, each texel a block');
    }
    assert.equal(await dfmodGroundLayers(303, tex, { decode }), null, 'an archive the studio has no record of: the classic set stands (the gate open, nothing dressing it)');
  } finally { reset(); }
});

test('AUDIT STUDIO1 S8: a ship\'s night twin is lit by its own emission picture where it has one (the studio\'s), else by her painted glass', async () => {
  reset();
  try {
    const twin = GALLEON_NIGHT[GALLEON_TEX.sternWindows0];
    await installStudioArt({ fetch: served({ [`a/${GALLEON_ARCHIVE}_${twin}-0_Emission.png`]: picture(8, 8, [250, 200, 90]) }).fetch, decode });
    await studioLanded();
    const fileFetch = async (url) => {
      const bytes = readFileSync(fileURLToPath(url));
      return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
    };
    const glow = [];
    const renderer = {
      createMesh: (model) => ({ model, buffers: [{}, {}], bounds: [0, 0, 0, 0], subMeshes: model.subMeshes.map((x) => ({ ...x, _bounds: [0, 0, 0, 0] })) }),
      drawMesh() {}, updateMeshVertices() {}, createBillboardBatch: () => ({}), destroyBillboardBatch() {}, destroyMesh() {},
      uploadEmissionTexture: (archive, record, c32) => glow.push({ archive, record, c32 }),
    };
    const texture = () => ({ recordCount: 200, getSize: () => ({ width: 40, height: 64 }), getScale: () => ({ width: 0, height: 0 }) });
    const pipeline = { getTexture: async (a) => { if (isVendorArchive(a)) await preloadTextureArchive(a, { decode }); return texture(); }, uploadRecord() {}, getGpuMesh: async (id) => ({ classic: id }) };
    const pool = createComeSailAwayPool({ renderer, pipeline, fetchFn: fileFetch, log: { warn() {} } });
    assert.equal(await pool.preload(), true);
    pool.spawnNow(new Boat(HULL.SmallShip, 0), { position: [0, 0, 0], rotation: [0, 0, 0, 1] });
    for (let i = 0; i < 100 && glow.length < Object.keys(GALLEON_NIGHT).length; i++) { pool.draw(); await new Promise((r) => setTimeout(r, 10)); }
    const lit = glow.find((g) => g.archive === GALLEON_ARCHIVE && g.record === twin);
    assert.ok(lit, 'her twin lit');
    assert.deepEqual([lit.c32.width, red(lit.c32)], [8, [250, 200, 90]], 'by the studio\'s emission picture');
    const other = glow.find((g) => g.archive === GALLEON_ARCHIVE && g.record === GALLEON_NIGHT[GALLEON_TEX.sternWindows1]);
    assert.equal(other?.c32.width, 64, 'a twin with none: her painted glass\'s glow');
  } finally { reset(); }
});

test('AUDIT STUDIO1 S9: the check\'s notes - clear texels on a slot drawn solid, a name no painted model\'s slot; and the slots counted, 248 of them, 29 cut-outs', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'auditstudio1-'));
  try {
    mkdirSync(join(dir, STUDIO_TREE, 'a'), { recursive: true });
    writeFileSync(join(dir, STUDIO_TREE, 'artists.json'), JSON.stringify({ artists: [{ folder: 'a', name: 'a', approved: 'the test' }] }));
    const put = (name, bytes) => writeFileSync(join(dir, STUDIO_TREE, 'a', name), bytes);
    put('38181_1-0--holes.png', picture(64, 64, [9, 9, 9], 0));   // the cart's side boards, drawn solid
    put('38181_11-0--glass.png', picture(64, 64, [9, 9, 9], 0));   // the caravan's side, its glass cut
    put('3818_1-0--typo.png', picture(64, 64, [9, 9, 9]));   // a digit dropped
    put('38181_1-1--frame.png', picture(64, 64, [9, 9, 9]));   // the frame mistyped
    const { problems, notes } = await checkStudio(dir);
    const said = (f) => [...problems, ...notes].filter((n) => n.startsWith(`a/${f}:`));
    assert.deepEqual(problems.map((p) => p.split(':')[0]), ['a/38181_1-1--frame.png'], 'a painted model\'s record that is no slot is a problem: no door asks for it (AUDIT STUDIO1 C10)');
    assert.match(said('38181_1-0--holes.png')[0], /clear texels, and cart side boards - Weathered oak is drawn solid - they come out black/);
    assert.deepEqual(said('38181_11-0--glass.png'), [], 'a cut-out slot\'s clear texels are its holes');
    assert.match(said('3818_1-0--typo.png')[0], /archive 3818 is none of the painted models'/);
    assert.match(said('38181_1-1--frame.png')[0], /Wagons, carts and the caravan has no picture 38181_1-1/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
  const counts = Object.fromEntries(STUDIO_SETS.map((s) => [s.id, studioSlots(s).length]));
  assert.deepEqual(counts, { wagons: 86, galleon: 25, carrack: 27, largeboat: 17, hangings: 48, yards: 14, port: 26, lefay: 5 });
  const cut = STUDIO_SETS.flatMap((s) => studioSlots(s)).filter((s) => s.cutout).map((s) => s.key);
  assert.equal(cut.length, 29);
  assert.ok(['38181_11-0', '38131_6-0', '38131_21-0', '38141_6-0', '38141_21-0', '38231_28-0'].every((k) => cut.includes(k)), 'the caravan\'s glass, the ships\' stern windows by day, the beacon\'s flame');
  assert.ok(!cut.includes(`38131_${GALLEON_NIGHT[GALLEON_TEX.sternWindows0]}-0`), 'a night twin is whole');
});

test('AUDIT STUDIO1 S10: the folder\'s plumbing - a folder git ignores is refused (nothing in it would be committed), a name the web or Windows cannot carry is refused, what an artist\'s computer leaves is passed over, a link is refused and a dangling one costs no crash; the templates go where they are told', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'auditstudio1-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: dir });
    writeFileSync(join(dir, '.gitignore'), 'scratch/\n');
    const tree = join(dir, STUDIO_TREE);
    for (const f of ['a/scratch', 'a/x']) mkdirSync(join(tree, f), { recursive: true });
    writeFileSync(join(tree, 'artists.json'), JSON.stringify({ artists: [{ folder: 'a', name: 'a', approved: 'the test' }] }));
    const put = (name, bytes) => writeFileSync(join(tree, 'a', name), bytes);
    put('scratch/38181_2-0.png', picture(64, 64, [9, 9, 9]));   // C4: in a folder .gitignore passes over
    put('38181_3-0--my cart #1.png', picture(64, 64, [9, 9, 9]));   // C6: the web reads `#` as no file's
    put('38181_4-0--caf\u00e9.png', picture(64, 64, [9, 9, 9]));   // C5/C6: git quotes it
    mkdirSync(join(tree, 'a', 'CON'), { recursive: true });
    writeFileSync(join(tree, 'a', 'CON', '38181_5-0.png'), picture(64, 64, [9, 9, 9]));   // C6: Windows keeps the name
    mkdirSync(join(tree, 'a', 'wagons.'), { recursive: true });
    writeFileSync(join(tree, 'a', 'wagons.', '38181_10-0.png'), picture(64, 64, [9, 9, 9]));   // C6: Windows drops a name's last dot
    put('.DS_Store', 'finder');   // C7: passed over
    put('._38181_6-0.png', 'appledouble');
    put('38181_7-0.png', picture(64, 64, [9, 9, 9]));
    symlinkSync(join(tree, 'a', '38181_7-0.png'), join(tree, 'a', '38181_8-0.png'));   // C8: a link
    symlinkSync(join(tree, 'a', 'gone.png'), join(tree, 'a', '38181_9-0.png'));   // C8: a dangling link
    const { listing, problems } = await checkStudio(dir);
    assert.deepEqual(listing.files, ['a/38181_7-0.png', 'a/scratch/38181_2-0.png']);
    const said = (f) => problems.find((p) => p.startsWith(`${f}:`)) ?? '';
    assert.match(said('a/scratch/38181_2-0.png'), /git ignores it \(\.gitignore's `scratch\/`\), so it would never be committed/);
    assert.match(said('a/38181_3-0--my cart #1.png'), /letters, digits and _ \. - only/);
    assert.match(said('a/38181_4-0--caf\u00e9.png'), /letters, digits and _ \. - only/);
    assert.match(said('a/CON/38181_5-0.png'), /letters, digits and _ \. - only/);
    assert.match(said('a/wagons./38181_10-0.png'), /a letter or digit at each end/);
    assert.match(said('a/38181_8-0.png'), /a link, not a picture/);
    assert.match(said('a/38181_9-0.png'), /a link, not a picture/);
    assert.ok(!problems.some((p) => p.startsWith('a/.DS_Store') || p.startsWith('a/._')), 'litter passed over, never said');
    assert.equal(problems.length, 7);
    // a dangling file the walk finds but cannot read is said, not thrown
    assert.doesNotThrow(() => studioListing(dir));
  } finally { rmSync(dir, { recursive: true, force: true }); }
  // C4: the checkout's own pattern is anchored - an artist's folder of that name is committed
  assert.match(readFileSync(new URL('../../../.gitignore', import.meta.url), 'utf8'), /^\/studio-templates\/$/m);
  // C11: a templates folder named is the caller's, relative to where they stand
  const out = mkdtempSync(join(tmpdir(), 'auditstudio1-tpl-'));
  try {
    execFileSync(process.execPath, [fileURLToPath(new URL('../../../tools/studioArt.mjs', import.meta.url)), 'templates', 'mine'], { cwd: out });
    assert.ok(existsSync(join(out, 'mine', 'wagons', '38181_1-0--cart-side-boards-weathered-oak.png')));
  } finally { rmSync(out, { recursive: true, force: true }); }
});

// ---- AUDIT STUDIO1 lane E: the pins its survivors asked for (K1-K17), each through its real producer where one exists ----

/** A served studio of real Responses (TEST THE SHAPE THE PRODUCER MINTS: a 404 is a page, not a missing method). */
function responses(files, { gate = null, root = undefined } = {}) {
  const asked = [];
  const fetch = async (url) => {
    asked.push(url);
    if (gate) await gate;
    if (url === studioUrl(STUDIO_INDEX, root)) return new Response(JSON.stringify({ studio: 1, files: Object.keys(files) }), { status: 200 });
    for (const [path, bytes] of Object.entries(files)) if (url === studioUrl(path, root)) return new Response(bytes, { status: 200 });
    return new Response('<!doctype html>not here', { status: 404 });
  };
  return { fetch, asked };
}
/** A picture whose top row is white (its rows' order shows). */
const topWhite = (w, h, rgb) => { const data = new Uint8Array(w * h * 4); for (let i = 0; i < w * h; i++) data.set(i < w ? [255, 255, 255, 255] : [...rgb, 255], i * 4); return writePng({ width: w, height: h, data }); };

test('AUDIT STUDIO1 S11 (lane E K1-K3, K9, K10): the studio\'s own law - its URLs under the site\'s root, the install\'s answers to real responses, each name\'s frame, map and dye kept, the classic boundary, and landed waiting for the install', async () => {
  // K1: under the site root (APP_ROOT, never the document), every segment encoded, slashes kept; a root of the caller's
  assert.equal(studioUrl('a b/38181_1-0--#1.png', 'http://x/game/'), 'http://x/game/art/studio/a%20b/38181_1-0--%231.png');
  assert.equal(studioUrl(STUDIO_INDEX), new URL('art/studio/index.json', APP_ROOT).href);
  reset();
  try {
    const rooted = responses({ 'a/38181_1-0.png': picture(2, 2, [6, 6, 6]) }, { root: 'http://x/game/' });
    assert.equal(await installStudioArt({ fetch: rooted.fetch, root: 'http://x/game/', decode }), 1);
    assert.equal(rooted.asked[0], 'http://x/game/art/studio/index.json', 'the listing under the root given');
    await studioLanded();
    assert.ok(rooted.asked.includes('http://x/game/art/studio/a/38181_1-0.png'), 'and its pictures');
    // K2: a listing with no files, or a 404 that carries JSON, is nothing - and never a throw
    reset();
    assert.equal(await installStudioArt({ fetch: async () => new Response('{"studio":1}', { status: 200 }), decode }), 0);
    assert.equal(await studioLanded(), 0, 'landed answers too');
    reset();
    assert.equal(await installStudioArt({ fetch: async () => new Response(JSON.stringify({ studio: 1, files: ['a/38181_1-0.png'] }), { status: 404 }), decode }), 0);
    assert.equal(hasTextureReplacement(WAGON_ARCHIVE, 1), false);
    // K3: each name's frame, map and dye registered as it says
    reset();
    const iron = studioFile('a/233_6-0_Iron.png');
    await installStudioArt({ fetch: responses({ 'a/38181_1-2.png': picture(2, 2, [1, 1, 1]), 'a/233_5-0_Normal.png': picture(2, 2, [2, 2, 2]), 'a/233_6-0_Iron.png': picture(2, 2, [3, 3, 3]) }).fetch, decode });
    assert.equal(hasTextureReplacement(WAGON_ARCHIVE, 1, 2), true);
    assert.equal(hasTextureReplacement(WAGON_ARCHIVE, 1, 0), false);
    assert.equal(hasTextureReplacement(233, 5, 0, 'Normal'), true);
    assert.equal(hasTextureReplacement(233, 5, 0), false, 'a normal map is never worn as the picture');
    assert.equal(hasTextureReplacement(233, 6, 0, 'Albedo', iron.dye), true);
    assert.equal(hasTextureReplacement(233, 6, 0), false);
    await studioLanded();
    assert.deepEqual(red(decodedTexture(WAGON_ARCHIVE, 1, 2)), [1, 1, 1], 'a port archive\'s frame decoded at the install');
    // K9: TEXTURE.511 is Daggerfall's (left to its load), 512 past it (decoded at the install)
    reset();
    assert.equal(LAST_CLASSIC_TEXTURE_ARCHIVE, 511);
    await installStudioArt({ fetch: responses({ 'a/511_0-0.png': picture(2, 2, [1, 1, 1]), 'a/512_0-0.png': picture(2, 2, [2, 2, 2]) }).fetch, decode });
    await studioLanded();
    assert.equal(decodedTexture(511, 0), null);
    assert.deepEqual(red(decodedTexture(512, 0)), [2, 2, 2]);
    // K10: landed waits for the install in flight; a late picture keeps its rows; one that will not decode is no picture
    reset();
    let open;
    const gate = new Promise((r) => { open = r; });
    const install = installStudioArt({ fetch: responses({ 'a/38221_0-0.png': topWhite(2, 3, [40, 50, 60]), 'a/38221_1-0.png': new Uint8Array([1, 2, 3]) }, { gate }).fetch, decode });
    let landed = false;
    studioLanded().then(() => { landed = true; });
    const puts = [];
    wearPainted(38221, 0, () => 'painted', (p, how) => puts.push([p, how]), { topDown: true });
    await turns();
    assert.equal(landed, false, 'the icon waits for the install');
    open();
    await install; await studioLanded(); await turns();
    assert.equal(landed, true);
    assert.equal(puts.length, 2);
    assert.deepEqual([...puts[1][0].colors.subarray(0, 3)], [255, 255, 255], 'the late picture top-down too: its white row first');
    assert.equal(paintedReplacement(38221, 1, { topDown: true }), null);
  } finally { reset(); }
});

test('AUDIT STUDIO1 S12 (lane E K4-K8): the registry\'s merges through the real producers - the install\'s own entries hold against a ship registered after; a mod\'s record of a real archive makes no stand-in; the studio over a mod picture already decoded; an absorbed registration counted, the doll\'s place kept; two non-studio registrations, the later whole', async () => {
  reset();
  try {
    // K4
    await installStudioArt({ fetch: responses({ [`a/${GALLEON_ARCHIVE}_${GALLEON_TEX.deck}-0.png`]: picture(4, 4, [200, 10, 10]) }).fetch, decode });
    assert.ok(registerGalleonArt(addVendorTextures) > 0);
    await preloadTextureArchive(GALLEON_ARCHIVE, { decode });
    assert.deepEqual(red(decodedTexture(GALLEON_ARCHIVE, GALLEON_TEX.deck)), [200, 10, 10]);
    // K5: Climates & Calories' tent - one record of the real TEXTURE.050 - under the studio's (the game's order: the
    // mod's icons register as its module loads, the studio at the boot)
    reset();
    assert.ok(installSurvivalIcons({ fetchBytes: async () => picture(2, 2, [1, 2, 3]) }) > 0);
    await installStudioArt({ fetch: responses({ 'a/50_7-0.png': picture(2, 2, [5, 5, 5]) }).fetch, decode });
    assert.equal(isVendorArchive(50), false, 'TEXTURE.050 is a real file: no stand-in branch for it');
    await preloadTextureArchive(50, { decode });
    assert.deepEqual(red(decodedTexture(50, 7)), [5, 5, 5]);
    // K6: the studio over a mod's picture already decoded (its fileName its key - Climates & Calories' icons)
    reset();
    assert.ok(installSurvivalIcons({ fetchBytes: async () => picture(2, 2, [1, 2, 3]) }) > 0);
    await preloadTextureArchive(532, { decode });
    assert.deepEqual(red(decodedTexture(532, 0)), [1, 2, 3]);
    await installStudioArt({ fetch: responses({ 'a/532_0-0.png': picture(2, 2, [9, 8, 7]) }).fetch, decode });
    await studioLanded();
    assert.deepEqual(red(decodedTexture(532, 0)), [9, 8, 7]);
    assert.equal(isVendorArchive(532), true);
    // K7: the Thunderlock's icons under the studio's: the doll's place theirs; a registration the studio absorbs is
    // counted and moves the tiers' epoch, and its missing offset leaves the place as it was
    reset();
    assert.equal(installThunderlockIcons({ fetchBytes: async () => picture(2, 2, [1, 2, 3]) }), 5);
    await installStudioArt({ fetch: responses({ 'a/560_0-0.png': picture(2, 2, [4, 5, 6]) }).fetch, decode });
    assert.deepEqual(vendorTextureStandIn(560).getOffset(0), PAPERDOLL_OFFSET);
    assert.equal(isVendorArchive(560), true);
    const epoch = textureTierEpoch();
    assert.equal(addVendor([{ archive: 560, record: 0, standIn: true, fileName: 'later', load: async () => picture(2, 2, [1, 2, 3]) }]), 1, 'absorbed, and counted');
    assert.notEqual(textureTierEpoch(), epoch, 'a scene asks its archives again');
    assert.deepEqual(vendorTextureStandIn(560).getOffset(0), PAPERDOLL_OFFSET, 'the first place on the doll holds');
    // K8: between two non-studio registrations the later replaces the earlier - mark, place and picture
    reset();
    addVendor([{ archive: 562, record: 0, standIn: true, offset: { x: 1, y: 1 }, fileName: 'one', load: async () => picture(2, 2, [1, 1, 1]) }]);
    addVendor([{ archive: 562, record: 0, fileName: 'two', load: async () => picture(2, 2, [2, 2, 2]) }]);
    assert.equal(isVendorArchive(562), false);
    assert.deepEqual(vendorTextureStandIn(562).getOffset(0), { x: 0, y: 0 });
    await preloadTextureArchive(562, { decode });
    assert.deepEqual(red(decodedTexture(562, 0)), [2, 2, 2]);
  } finally { reset(); }
});

const plain = (w, h) => writePng({ width: w, height: h, data: new Uint8Array(w * h * 4).fill(200) });
const header = (w, h) => { const b = Buffer.from(plain(1, 1)); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; };
const ROSTER = { artists: [{ folder: 'trashBattery', name: 'trashBattery', approved: 't' }, { folder: 'Redclaw', name: 'Redclaw', approved: 't' }] };
function tree(files, roster = ROSTER) {
  const at = mkdtempSync(join(tmpdir(), 'auditstudio1-'));
  const dir = join(at, STUDIO_TREE);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'artists.json'), JSON.stringify(roster));
  for (const [path, bytes] of Object.entries(files)) { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), bytes); }
  return at;
}
const listed = (files, roster) => { const at = tree(files, roster); try { return studioListing(at); } finally { rmSync(at, { recursive: true, force: true }); } };

test('AUDIT STUDIO1 S13 (lane E K11-K13): the listing - each limit by number on both sides, the boundary byte, any case of .png, the sort that keeps a slot, each roster fault alone, a roster that is no list, and a PNG\'s header read whole', () => {
  assert.equal(STUDIO_MAX_SIDE, 2048);
  assert.equal(STUDIO_MAX_BYTES, 4 * 1024 * 1024);
  const top = plain(4, 4);
  const l = listed({
    'Redclaw/38181_1-0.png': header(64, STUDIO_MAX_SIDE + 1),
    'Redclaw/38181_2-0.png': header(64, 0),
    'Redclaw/38181_3-0.PNG': plain(4, 4),
    'Redclaw/38181_4-0.png': Buffer.concat([top, Buffer.alloc(STUDIO_MAX_BYTES - top.length)]),
    'Redclaw/38181_6-0.png': header(STUDIO_MAX_SIDE, STUDIO_MAX_SIDE),
    'Red/38181_5-0.png': plain(4, 4),
    'Red-claw/38181_5-0.png': plain(4, 4),
  }, { artists: [...ROSTER.artists, { folder: 'Red', name: 'Red', approved: 't' }, { folder: 'Red-claw', name: 'Rc', approved: 't' }] });
  assert.deepEqual(l.files, ['Red-claw/38181_5-0.png', 'Redclaw/38181_3-0.PNG', 'Redclaw/38181_4-0.png', 'Redclaw/38181_6-0.png'], 'the exact limits pass; each side past them, a side of 0 and the second of a slot do not');
  assert.equal(l.problems.length, 3);
  for (const bad of [{ folder: 'trash Battery', name: 'x', approved: 'y' }, { folder: '../up', name: 'x', approved: 'y' }, { folder: '', name: 'x', approved: 'y' }, { folder: 'ok', name: '', approved: 'y' }, { folder: 'ok', approved: 'y' }, { folder: 'ok', name: 'x', approved: '' }, { folder: 'NUL', name: 'x', approved: 'y' }]) {
    const one = listed({ 'Redclaw/38181_1-0.png': plain(4, 4) }, { artists: [bad, ROSTER.artists[1]] });
    assert.deepEqual(one.files, ['Redclaw/38181_1-0.png'], JSON.stringify(bad));
    assert.deepEqual(one.roster.map((a) => a.folder), ['Redclaw'], JSON.stringify(bad));
    assert.equal(one.problems.length, 1, JSON.stringify(bad));
  }
  assert.deepEqual(listed({ 'Redclaw/38181_1-0.png': plain(4, 4) }, { artists: {} }).files, [], 'a roster that is no list: no artist, and no throw');
  assert.equal(listed({}, { artists: [{ folder: 'Redclaw', name: 'a', approved: 'b' }, { folder: 'redclaw', name: 'c', approved: 'd' }] }).roster.length, 1);
  assert.equal(pngSize(Buffer.from(plain(1, 1)).subarray(0, 23)), null, '23 bytes are too few');
  const notIhdr = Buffer.from(plain(1, 1)); notIhdr.write('IDAT', 12, 'latin1');
  assert.equal(pngSize(notIhdr), null, 'IHDR first');
  const badSig = Buffer.from(plain(1, 1)); badSig[6] = 0;
  assert.equal(pngSize(badSig), null, 'the whole signature');
});

test('AUDIT STUDIO1 S14 (lane E K14, K15, E13): the tool - the check carries the folder\'s problems and notes a stretch either way and by a sixty-fourth; `check` answers 1 on a problem and 0 on none, `list` names each studio picture beside its slot, an unknown command 2; `templates` writes a PNG a slot, each named for its key', async () => {
  const at = tree({ 'stranger/38181_2-0.png': plain(4, 4), 'Redclaw/38181_3-0.png': plain(64, 128), 'Redclaw/38181_2-0.png': plain(65, 64) });
  try {
    const { problems, notes } = await checkStudio(at);
    assert.ok(problems.some((p) => p.startsWith('stranger/38181_2-0.png:')));
    assert.deepEqual(notes.map((n) => n.split(':')[0]).sort(), ['Redclaw/38181_2-0.png', 'Redclaw/38181_3-0.png']);
    const said = [];
    assert.equal(await studioCli(['check'], { at, log: (l) => said.push(l) }), 1);
    assert.ok(said.some((l) => l.startsWith('PROBLEM: stranger/38181_2-0.png')));
    said.length = 0;
    assert.equal(await studioCli(['list'], { at, log: (l) => said.push(l) }), 0);
    assert.ok(said.some((l) => /^ {2}38181_3-0 .*running gear {3}<- studio: Redclaw\/38181_3-0\.png$/.test(l)), 'list names the studio\'s picture beside its slot');
    assert.equal(await studioCli(['bogus'], { at, log: () => {} }), 2);
  } finally { rmSync(at, { recursive: true, force: true }); }
  const clean = tree({ 'Redclaw/38181_1-0.png': plain(64, 64) });
  try { assert.equal(await studioCli(['check'], { at: clean, log: () => {} }), 0); } finally { rmSync(clean, { recursive: true, force: true }); }
  const out = mkdtempSync(join(tmpdir(), 'auditstudio1-tpl-'));
  try {
    assert.equal(await studioCli(['templates', out], { log: () => {} }), 0);
    const names = readdirSync(out, { recursive: true }).filter((f) => String(f).endsWith('.png'));
    assert.equal(names.length, 248);
    for (const f of names) assert.ok(studioFile(`a/${String(f).split('/').pop()}`), f);
    assert.ok(pngSize(readFileSync(join(out, String(names[0])))));
  } finally { rmSync(out, { recursive: true, force: true }); }
});

test('AUDIT STUDIO1 S15 (lane E K16): the slots are the keys the game asks under - each set\'s real registration or its host\'s archive - named, sorted and painted as the game paints them', async () => {
  const set = (id) => STUDIO_SETS.find((x) => x.id === id);
  const keysOf = (id) => studioSlots(set(id)).map((x) => x.key);
  const captured = (register) => { let entries = []; register((e) => { entries = e; return e.length; }); return entries; };
  reset();
  const ships = { galleon: captured(registerGalleonArt), carrack: captured(registerCarrackArt), largeboat: captured(registerLargeBoatArt) };
  reset();
  for (const [id, entries] of Object.entries(ships)) {
    assert.deepEqual(new Set(keysOf(id)), new Set(entries.map((e) => textureKey(e.archive, e.record, 0))), `${id}: her registration's records, night twins and all`);
    for (const x of studioSlots(set(id))) {
      const e = entries.find((y) => y.record === x.record);
      const [a, b] = [await x.picture(), await e.build()];
      assert.deepEqual(a && [a.width, a.height, [...a.data]], b && [b.width, b.height, [...b.data]], `${id} ${x.key}: the picture she wears`);
    }
  }
  assert.deepEqual(new Set(keysOf('hangings')), new Set(townPictureEntries(() => true).map((e) => textureKey(e.archive, e.record, 0))));
  for (const x of studioSlots(set('hangings'))) {
    assert.equal(x.name, TOWN_PICTURES[x.record].name);
    assert.deepEqual([...(await x.picture()).data], [...(await TOWN_PICTURES[x.record].draw()).data]);
  }
  assert.deepEqual(keysOf('yards'), yardArt().map(([r]) => textureKey(YARD_ARCHIVE, r, 0)));
  assert.deepEqual(new Set(keysOf('port')), new Set(PORT_PAINTERS.map(([r]) => textureKey(PORT_ARCHIVE, r, 0))));
  for (const x of studioSlots(set('port'))) assert.deepEqual([...(await x.picture()).data], [...PORT_PAINTERS.find(([r]) => r === x.record)[1]().colors]);
  assert.deepEqual(keysOf('lefay'), lefayArt().map(([r]) => textureKey(LEFAY_ARCHIVE, r, 0)));
  assert.equal(set('wagons').archive, WAGON_ARCHIVE);
  let total = 0;
  for (const st of STUDIO_SETS) {
    const slots = studioSlots(st);
    total += slots.length;
    assert.deepEqual(slots.map((x) => x.record), slots.map((x) => x.record).sort((u, v) => u - v), `${st.id} in record order`);
    for (const x of slots) assert.ok(typeof x.name === 'string' && x.name && !/undefined|[A-Z]{2}|[a-z][A-Z]/.test(x.name), `${st.id} ${x.key}: "${x.name}"`);
    assert.equal(new Set(slots.map((x) => x.name)).size, slots.length, `${st.id}: a name a slot`);
  }
  assert.equal(total, 248);
  const name = (id, rec) => studioSlots(set(id)).find((x) => x.record === rec)?.name;
  assert.equal(name('galleon', GALLEON_TEX.hullSide0), 'hull side 0');
  assert.equal(name('galleon', GALLEON_TEX.deck), 'deck');
  assert.ok(studioSlots(set('galleon')).some((x) => / - at night$/.test(x.name)));
  assert.equal(name('lefay', lefayArt()[2][0]), 'gilt point');
  assert.equal(name('lefay', lefayArt()[4][0]), 'bronze edge');
  assert.equal(name('yards', yardArt()[1][0]), 'plank');
  assert.equal(studioSlots(set('wagons'))[0].name, 'floorboards');
  assert.equal(name('wagons', WAGON_TEX.harness), 'harness straps');
  assert.equal(slotLabel(' (Red) tapestry! '), 'red-tapestry');
});

test('AUDIT STUDIO1 S16 (lane E K17): the studio is wired - its plugin serves and builds the listing, and its page is built', async () => {
  const cfg = (await import('../../../vite.config.js')).default;
  assert.ok(cfg.plugins.some((p) => p?.name === 'studio-art-index'), 'the listing is served and built (scripts/studioArtIndex.mjs)');
  assert.equal(cfg.build.rollupOptions.input.studio, 'studio.html');
});

