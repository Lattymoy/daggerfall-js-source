// ROAD-H, the seasons/texture lane - the two items AUDIT 62 left over.
//
// H3 THE PER-KEY SEASONS REFRESH. Seasons of the Iliac Bay answers a
// season install with RefreshLoadedNatureBatches, which decides PER
// BATCH on the ARCHIVE: it walks the scene's DaggerfallBillboardBatches
// (il.txt 0x08a4) and re-applies only the ones whose archive it has
// ever managed - forced, because SetMaterial's early return tests
// `archive == currentArchive` (DaggerfallBillboardBatch.cs:283-284)
// and currentArchive is the archive INDEX (:73, :360), which the mod's
// atlas swap leaves alone, so an unforced walk would refresh nothing.
// The port answers the refresh with a teardown, so it adds a filter of
// its own - the install generation, translation 1 / AUDIT 61, since a
// re-apply is free there and a teardown here. AUDIT 62 F4 gave that
// teardown DFU's archive filter but left it all-or-nothing: one stale
// pixel anywhere rebuilt the whole grid. Per key now, and the classic
// winter flip - a different law, older than this mod - still sweeps
// every key.
//
// H4 THE TEXTURE-REPLACEMENT SWAP. A user texture pack's PNG decodes
// through the DOM to `{ width, height, data }`, TOP row first; the
// upload path reads `color32.colors` (renderer.js:1842) and every
// texture it uploads is BOTTOM-up (getColor32, baseImageFile.js:123 /
// BaseImageFile.cs:250, with UNPACK_FLIP_Y_WEBGL off). So the first
// swapped record a pack covered threw on `undefined.buffer`, and would
// have drawn upside-down once named. DFU has neither problem for one
// reason: `TryImportTextureFromDisk` builds the replacement with
// `Texture2D.LoadImage` (TextureReplacement.cs:1041-1056) and the
// result goes into the very slot `SetPixels32(GetColor32(...))` fills
// for the classic texture (TextureReader.cs:261-267) - a Texture2D is
// bottom-up either way. THAT is the value pinned below: a replacement
// and the classic texture it displaces upload IDENTICAL bytes.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createSeasonReskin } from '../src/world/seasonReskin.js';
import { SeasonHelper, managedArchivesForSeason } from '../src/systems/seasonsIliacBay.js';
import { SEASONS } from '../src/systems/gameDate.js';
import { createDataPipeline } from '../src/scenes/dataPipeline.js';
import { Renderer } from '../src/render/renderer.js';
import { TextureFile, texName } from '../src/formats/textureFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';
import {
  clearTextureReplacements, setTextureReplacements, preloadTextureArchive, decodedTexture,
} from '../src/systems/textureReplacement.js';
import { setValue } from '../src/systems/settings.js';

// ═══ H3 - the refresh, per key ══════════════════════════════════════════

const tex = (name, w = 8, h = 8) => ({ name, width: w, height: h, image: { width: w, height: h, data: new Uint8Array(w * h * 4) } });
const fullSet = (prefix, n, from = 1) => Array.from({ length: n - from }, (_, i) => tex(`${prefix}${i + from}.png`));

test('ROAD-H H3: the mod\'s archive filter decides per KEY, and the sweep rebuilds those alone', async () => {
  // A three-pixel grid at the instant of a season install:
  //   0,0 - stale (built under an older install) on a MANAGED archive
  //   1,0 - stale, but on 503, which no season manages
  //   2,0 - on a managed archive, and already built under this install
  // DFU's own filter admits two of these three: vanillaAtlasByArchive
  // is what the walk asks (so 1,0, on the unmanaged 503, is never
  // asked), and its forced SetMaterial re-applies 0,0 AND 2,0. This
  // host cannot re-apply in place - 2,0 already wears the installed
  // atlas and rebuilding it would be a teardown for nothing - so the
  // install-generation filter (translation 1 / AUDIT 61) drops it too.
  // One key comes back.
  const built = new Map();
  const reskin = createSeasonReskin();
  const state = { season: SEASONS.Summer };
  const helper = new SeasonHelper({
    currentSeason: () => state.season,
    recordCount: async () => 33,
    load: async (prefix) => fullSet(prefix, 33),
    refresh: () => reskin.markStale(helper, built),   // world.js's seam, verbatim
    warn: () => {},
  });
  state.season = SEASONS.Fall;
  await helper.apply(false);                       // installs 504/506/508/510
  assert.deepEqual(managedArchivesForSeason(SEASONS.Fall), [504, 506, 508, 510]);
  const older = helper.generation;
  // The after-travel refresh: OnPostFastTravel's forced apply installs
  // Winter (505/507/509) and arms the flag OnUpdateTerrainsEnd spends
  // once the destination ring stands - by which time some of that ring
  // has been rebuilt under the new install and some was carried over.
  state.season = SEASONS.Winter;
  await helper.onPostFastTravel();
  built.set('0,0', { _seasonsGen: older, batches: [{ archive: 504 }, { archive: 182 }] });
  built.set('1,0', { _seasonsGen: older, batches: [{ archive: 503 }] });
  built.set('2,0', { _seasonsGen: helper.generation, batches: [{ archive: 505 }] });
  assert.equal(helper.manages(503), false, '500-503 are in no season\'s set');
  assert.equal(helper.manages(504), true, 'ever managed, not managed now');

  assert.equal(helper.onUpdateTerrainsEnd(), true);   // -> refresh()
  assert.equal(reskin.pending, true, 'a stale managed pixel stands, so there is something to re-skin');
  assert.deepEqual(reskin.take(built), ['0,0'],
    'the one key DFU\'s archive filter admits that this host has not already re-skinned');
  assert.equal(reskin.pending, false, 'and taking it spends the pending re-skin');

  // The CLASSIC winter flip is not the mod's refresh and never was: the
  // ground atlas, the tile set and the climate swaps of every pixel
  // turn with the two-valued climate season (the ROAD A1 law,
  // DaggerfallLocation.Update's lastSeason test). It still sweeps all
  // three, whatever the mod's filter says about them.
  reskin.markAll();
  assert.deepEqual(reskin.take(built).sort(), ['0,0', '1,0', '2,0']);
});

test('ROAD-H H3: a marked key that has left the grid is dropped, and the teleport clears the lot', () => {
  const reskin = createSeasonReskin();
  const built = new Map([['0,0', {}]]);
  reskin.mark('0,0');
  reskin.mark('9,9');   // streamed out between the mark and the frame
  assert.deepEqual(reskin.take(built), ['0,0'],
    'there is no batch at 9,9 to re-apply - FindObjectsOfType would not return it');
  // The teleport's own teardown is a real unload that rebuilds
  // everything: the frame's re-skin has nothing left to re-skin.
  reskin.mark('0,0');
  reskin.markAll();
  reskin.clear();
  assert.equal(reskin.pending, false);
  assert.deepEqual(reskin.take(built), []);
});

// ═══ H4 - the swap uploads, and uploads the right way up ════════════════

/** The recording Proxy-GL the render pins share. */
function recordingRenderer(log) {
  const stub = new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation' || k === 'getAttribLocation') return () => ({});
      if (k === 'createTexture' || k === 'createBuffer' || k === 'createVertexArray'
        || k === 'createProgram' || k === 'createShader' || k === 'createFramebuffer') return () => ({});
      if (k === 'getParameter') return () => new Float32Array([0, 0, 0, 0]);
      if (typeof k === 'string' && k.toUpperCase() === k) return k;
      return (...args) => { log.push([k, ...args]); };
    },
  });
  const canvas = { getContext: () => stub, clientWidth: 64, clientHeight: 64, width: 64, height: 64 };
  const r = new Renderer(canvas);
  log.length = 0;
  return r;
}
const uploads = (log) => log.filter((c) => c[0] === 'texImage2D').map((c) => c[c.length - 1]);

/**
 * A TEXTURE.### file, built here: the container has no ARENA2 and the
 * arms under test are the pipeline's own. One record; one frame is the
 * stride-256 uncompressed layout, more than one is the frame-offset
 * list and the transparent-run codec (textureFile.js `_readImage`).
 */
function textureBytes({ width, height, frames }) {
  const RECORD_HEADER = 28;
  const recPos = 26 + 20;
  const body = [];
  if (frames.length === 1) {
    for (let y = 0; y < height; y++) {
      const row = new Uint8Array(256);
      row.set(frames[0].subarray(y * width, (y + 1) * width), 0);
      body.push(row);
    }
  } else {
    const encoded = frames.map((f) => {
      const out = [];
      out.push(width & 0xff, (width >> 8) & 0xff, height & 0xff, (height >> 8) & 0xff);
      for (let y = 0; y < height; y++) out.push(0, width, ...f.subarray(y * width, (y + 1) * width));
      return new Uint8Array(out);
    });
    const table = new Uint8Array(frames.length * 4);
    const tv = new DataView(table.buffer);
    let at = table.length;
    encoded.forEach((f, i) => { tv.setInt32(i * 4, at, true); at += f.length; });
    body.push(table, ...encoded);
  }
  const dataLen = body.reduce((n, b) => n + b.length, 0);
  const bytes = new Uint8Array(recPos + RECORD_HEADER + dataLen);
  const v = new DataView(bytes.buffer);
  v.setInt16(0, 1, true);                    // one record
  v.setInt16(26, 0, true);                   // record header: type1
  v.setInt32(26 + 2, recPos, true);          // ...and where the record is
  v.setInt16(recPos + 4, width, true);
  v.setInt16(recPos + 6, height, true);
  v.setInt16(recPos + 8, 0, true);           // COMPRESSION_FORMATS.Uncompressed
  v.setUint32(recPos + 10, dataLen, true);
  v.setUint32(recPos + 14, RECORD_HEADER, true);   // dataOffset, from the record
  v.setUint16(recPos + 20, frames.length, true);
  let at = recPos + RECORD_HEADER;
  for (const b of body) { bytes.set(b, at); at += b.length; }
  return bytes;
}

/** The same picture a browser decode would hand back: RGBA, TOP row
 *  first. Built by reversing a getColor32 buffer row by row, here, so
 *  the pin owes nothing to the module that does the reversing. */
function asDecodedPng(color32) {
  const { width, height, colors } = color32;
  const row = width * 4;
  const data = new Uint8Array(row * height);
  for (let y = 0; y < height; y++) data.set(colors.slice(y * row, (y + 1) * row), (height - 1 - y) * row);
  return { width, height, data };
}

/** A grey ART_PAL: index i is (i,i,i), so the pins can tell one palette
 *  entry from another (an unloaded DFPalette is all red by design). */
const PALETTE = new DFPalette();
PALETTE.makeGrayscale();
const PIPE = { arch: { getRecordIndex: () => -1, getMesh: () => null }, palette: PALETTE };

test('ROAD-H H4: a swapped RECORD uploads the same bytes the classic texture would - and its emission mask with it', async () => {
  setValue('Enhancements', 'AssetInjection', 'True');
  clearTextureReplacements();
  // Archive 87 record 0 is the fireplace: auto-emissive (TextureReader
  // .cs:809-1023) and no exterior window, so uploadRecord takes the
  // albedo arm AND the "just reuse albedo map" emission arm (:301-308).
  const indices = new Uint8Array([1, 2, 3, 4]);   // a 2x2 of four palette entries
  const bytes = textureBytes({ width: 2, height: 2, frames: [indices] });
  const classic = new TextureFile();
  assert.equal(classic.load(bytes, texName(87), PALETTE), true, 'the hand-built archive reads back');
  const want = classic.getColor32(classic.getDFBitmap(0, 0), 0);

  // Through the PRODUCTION door, not the test seam: a pack file is
  // registered and `preloadTextureArchive` is what decodes it. The
  // conversion has to be on THIS path - it is the only one a real pack
  // takes - and the picture is four distinct palette entries, so a
  // dropped row reversal here cannot hide behind a uniform raster.
  setTextureReplacements(['087_0-0.png'], async () => new Uint8Array([1]));
  assert.equal(await preloadTextureArchive(87, { decode: async () => asDecodedPng(want) }), 1,
    'the registered pack file decodes');
  const swap = decodedTexture(87, 0, 0);
  assert.ok(swap && swap.colors, 'the door answers a COLOR32 - `colors` is the field the upload reads');
  assert.deepEqual([...swap.colors], [...want.colors],
    'and it is already in getColor32 order coming out of the door itself');

  const log = [];
  const renderer = recordingRenderer(log);
  const pipe = createDataPipeline({ renderer, ...PIPE, fetch: async (name) => (name === 'FLATS.CFG' ? new Uint8Array(0) : bytes) });
  await pipe.getTexture(87);
  pipe.uploadRecord(87, 0);

  const sent = uploads(log);
  assert.equal(sent.length, 2, 'the albedo and the auto-emissive mask, both uploaded');
  for (const buf of sent) {
    assert.deepEqual(new Uint8Array(buf), new Uint8Array(want.colors.buffer),
      'a replacement lands in the slot SetPixels32(GetColor32(...)) fills - same bytes, same way up');
  }
  clearTextureReplacements();
});

test('ROAD-H H4: a swapped FRAME uploads the same bytes its classic frame would', async () => {
  setValue('Enhancements', 'AssetInjection', 'True');
  clearTextureReplacements();
  // Archive 210 record 0 frame 1: emissive too, so the frame arm's own
  // mask (a torch's every frame is self-lit) rides the same colour32.
  const f0 = new Uint8Array([1, 2, 3, 4]);
  const f1 = new Uint8Array([5, 6, 7, 8]);
  const bytes = textureBytes({ width: 2, height: 2, frames: [f0, f1] });
  const classic = new TextureFile();
  assert.equal(classic.load(bytes, texName(210), PALETTE), true);
  const want = classic.getColor32(classic.getDFBitmap(0, 1), 0);
  assert.notDeepEqual([...want.colors], [...classic.getColor32(classic.getDFBitmap(0, 0), 0).colors],
    'the two frames really differ, or this pin would pass on the wrong one');

  setTextureReplacements(['210_0-1.png'], async () => new Uint8Array([1]));
  assert.equal(await preloadTextureArchive(210, { decode: async () => asDecodedPng(want) }), 1);
  const log = [];
  const renderer = recordingRenderer(log);
  const pipe = createDataPipeline({ renderer, ...PIPE, fetch: async (name) => (name === 'FLATS.CFG' ? new Uint8Array(0) : bytes) });
  await pipe.getTexture(210);
  pipe.uploadRecordFrame(210, 0, 1);

  const sent = uploads(log);
  assert.equal(sent.length, 2, 'the frame and its emission mask');
  for (const buf of sent) {
    assert.deepEqual(new Uint8Array(buf), new Uint8Array(want.colors.buffer));
  }
  clearTextureReplacements();
});

test('ROAD-H H4: the picture really is the other way up on the way in', () => {
  // The guard on the pin above: `asDecodedPng` must hand the door a
  // TOP-row-first raster, or "same bytes out" would be true of a door
  // that does nothing at all.
  const classic = new TextureFile();
  classic.palette = PALETTE;
  const want = classic.getColor32({ width: 1, height: 2, data: new Uint8Array([9, 21]) }, -1);
  const png = asDecodedPng(want);
  assert.notDeepEqual([...png.data], [...want.colors], 'the decoded PNG is NOT in getColor32 order');
  assert.deepEqual([...png.data.slice(0, 4)], [...want.colors.slice(4, 8)], 'its first row is the picture\'s top');
});
