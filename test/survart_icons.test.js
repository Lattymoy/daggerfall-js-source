// SURV-ART (2026-09-19, Mac: "the sprites aren't showing at all") -
// CLIMATES & CALORIES' ART REACHED THE SCREEN AT NEITHER DOOR.
//
// The mod's sixteen PNGs were vendored, registered at boot
// (installSurvivalIcons), fetched and decoded. They drew nothing,
// because both of the port's icon doors dropped them on the last step
// and each did it in its own way:
//
//   THE GL DOOR (ui/itemScroller.js, ui/nativeInventory.js) asks the
//   pipeline for the archive and then gates on
//   `if (img.record < tex.recordCount)` before it uploads, measuring
//   with `tex.getSize(record)` inside. For a vendored archive the
//   pipeline hands back `vendorTextureStandIn`, which carried NEITHER
//   member - so the gate read `0 < undefined`, FALSE for every record
//   of every vendored archive, and the upload it guards never ran. No
//   texture, no size, nothing drawn. A stand-in for a file must answer
//   like the file.
//
//   THE DOM DOOR (ui/textureCanvas.js requestIcon, which the enhanced
//   HUD's quickslots and the enhanced inventory's tiles both draw
//   through) had no vendor arm at all. It went straight to
//   `getArchive`, which fetches TEXTURE.539 - a file that does not
//   exist, for an archive that is only ever the port's own art - and
//   cached the failure as a permanent miss, so every repaint drew the
//   two-letter initials fallback instead.
//
// These pins drive the real modules, because a source-text pin would
// have matched the broken code too: the first walks all sixteen
// through the GL door's own expression, the second runs requestIcon
// against a canvas stub and reads the pixels back out.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  addVendorTextures, clearVendorTextures, preloadTextureArchive, decodedTexture,
  vendorTextureStandIn, vendorRecordCount, isVendorArchive,
} from '../src/systems/textureReplacement.js';
import { VENDOR_ICON_FILES } from '../src/systems/survival/items.js';
import { color32Canvas } from '../src/ui/bitmapCanvas.js';

/** A decoded PNG whose every pixel says where it came from: the TOP
 *  row is red, the bottom row blue. Which way up it lands is then a
 *  thing a test can read rather than assume. */
const topDown = (w, h) => {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      data[o] = y === 0 ? 255 : 0;
      data[o + 2] = y === h - 1 ? 255 : 0;
      data[o + 3] = 255;
    }
  }
  return { width: w, height: h, data };
};

const ICON = Object.freeze({ w: 6, h: 4 });
function installFakeIcons() {
  clearVendorTextures();
  addVendorTextures(VENDOR_ICON_FILES.map((f) => {
    const m = /^(\d+)_(\d+)-(\d+)$/.exec(f);
    return { archive: Number(m[1]), record: Number(m[2]), frame: Number(m[3]), fileName: f, standIn: true, load: async () => new Uint8Array(8) };   // SURV-TENT: the icons are the stand-in kind
  }));
}
const ARCHIVES = [...new Set(VENDOR_ICON_FILES.map((f) => Number(f.split('_')[0])))];

test('SURV-ART: the stand-in answers the GL door’s own gate, for all sixteen', async () => {
  installFakeIcons();
  // BEFORE A SINGLE BYTE IS FETCHED. The count comes off the REGISTRY,
  // not off what has decoded so far: the GL door builds the stand-in
  // inside the same await that preloads, and a PNG still in flight (or
  // one that would not decode) must not shrink the archive under the
  // caller that is about to ask for its record - that reads as "no
  // such record" and is the bug again by another route.
  assert.equal(vendorRecordCount(538), 3, 'raw meat\u2019s three records, undecoded');
  assert.ok(vendorTextureStandIn(538).recordCount >= 3, 'and the stand-in agrees before any decode');
  for (const a of ARCHIVES) await preloadTextureArchive(a, { decode: async () => topDown(ICON.w, ICON.h) });

  for (const f of VENDOR_ICON_FILES) {
    const [archive, rest] = f.split('_');
    const record = Number(rest.split('-')[0]);
    const tex = vendorTextureStandIn(Number(archive));
    // itemScroller.js / nativeInventory.js, verbatim - this read
    // `0 < undefined` and every icon fell out of the frame here
    assert.ok(record < tex.recordCount, `${f}: the gate refuses its own record (recordCount ${tex.recordCount})`);
    assert.deepEqual(tex.getSize(record), { width: ICON.w, height: ICON.h }, `${f}: no size`);
    assert.ok(tex.getSize(record).width > 0, `${f}: a zero width draws nothing`);
  }
  // the count is one past the highest RECORD, per archive, and comes
  // off the registry - raw meat has three, an apple two, the skin one
  assert.equal(vendorRecordCount(538), 3);
  assert.equal(vendorRecordCount(532), 2);
  assert.equal(vendorRecordCount(539), 1);
  assert.equal(vendorRecordCount(600), 0, 'an archive nothing vendored');
  // and the out-of-range answer is TextureFile.getSize's own
  assert.deepEqual(vendorTextureStandIn(539).getSize(1), { width: 0, height: 0 });
  clearVendorTextures();
});

test('SURV-ART: the DOM door draws a vendored record, right way up', async () => {
  installFakeIcons();
  await preloadTextureArchive(539, { decode: async () => topDown(ICON.w, ICON.h) });
  assert.ok(isVendorArchive(539), 'the waterskin’s archive is the port’s own art');
  assert.ok(decodedTexture(539, 0, 0), 'and it is decoded');

  // the canvas the DOM arm builds, with the pixels readable
  let put = null;
  const canvasStub = () => ({
    width: 0, height: 0,
    getContext: () => ({
      createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: (img) => { put = img; },
      drawImage: () => {},
      imageSmoothingEnabled: true,
    }),
    toDataURL: () => 'data:image/png;base64,STUB',
  });
  globalThis.document = { createElement: canvasStub };
  try {
    const c = color32Canvas(decodedTexture(539, 0, 0), { scale: 1 });
    assert.ok(c, 'a canvas');
    assert.equal(c.width, ICON.w);
    assert.equal(c.height, ICON.h);
    // THE FLIP. `decodedTexture` hands back color32 order (row 0 is the
    // picture's BOTTOM - formats/color32Order.js), and a canvas is
    // top-down, so the canvas's first row must be the PNG's first row:
    // red, not blue. Without the reversal every mod icon in the DOM
    // would draw upside down, which is SW4 one door along.
    assert.deepEqual([...put.data.slice(0, 4)], [255, 0, 0, 255], 'the canvas’ top row is the picture’s top row');
    const last = (ICON.h - 1) * ICON.w * 4;
    assert.deepEqual([...put.data.slice(last, last + 4)], [0, 0, 255, 255], 'and its bottom row the picture’s bottom');

    // requestIcon itself: a vendored archive answers, and a record
    // past the end is refused rather than fetched
    const { requestIcon } = await import('../src/ui/textureCanvas.js');
    assert.equal(requestIcon(539, 0, { scale: 1 }), null, 'cold, as every requestIcon is');
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(requestIcon(539, 0, { scale: 1 }), 'data:image/png;base64,STUB', 'and warm on the next repaint');
    assert.equal(requestIcon(539, 7, { scale: 1 }), null, 'a record the archive has not got');
  } finally {
    delete globalThis.document;
    clearVendorTextures();
  }
});

test('SURV-ART: both doors keep the arm that reaches the vendored art', () => {
  const read = (p) => readFileSync(p, 'utf8');
  // the GL door's gate and its measurement, at both call sites - the
  // two lines the stand-in has to satisfy
  for (const f of ['src/ui/itemScroller.js', 'src/ui/nativeInventory.js']) {
    assert.match(read(f), /if \(img\.record < tex\.recordCount\) \{/, `${f}: the gate`);
    assert.match(read(f), /sizes\.set\(key, tex\.getSize\(img\.record\)\)/, `${f}: the measurement`);
  }
  // the stand-in answers both
  const rep = read('src/systems/textureReplacement.js');
  assert.match(rep, /\n\s*recordCount,\n/, 'the stand-in carries recordCount');
  assert.match(rep, /getSize: \(record\) =>/, 'and getSize');
  // the DOM door's vendor arm stands BEFORE getArchive, or the fetch
  // that cannot succeed caches the miss first
  const dom = read('src/ui/textureCanvas.js');
  assert.ok(dom.indexOf('if (isVendorArchive(archive)) {') < dom.indexOf('getArchive(archive).then('), 'the vendor arm comes first');
  assert.match(dom, /const canvas = color32Canvas\(img, \{ scale \}\);/, 'and draws the decoded PNG without a palette');
});

// SURV-TENT (2026-09-19, Mac handed over the shipped bundle) - THE
// TENT'S TWO RESKINS, AND THE KIND OF VENDORED FILE THEY ARE.
//
// The camp stands the mod's tent as model 41606 (survival/camp.js
// TENT_MODEL) and the mod dresses it by overriding two records of REAL
// ARENA2 archives: a 32x32 tan canvas at 50_7-0 and a 64x8 dark pole
// at 67_10-0. They were the last two of the mod's twenty pictures left
// out, so the tent wore whatever the base game put on that model.
//
// THEY ARE NOT THE SAME KIND OF FILE AS THE ICONS ABOVE, and the
// difference is the whole of this pin. An icon's archive (532-539)
// exists ONLY as the port's art - there is no TEXTURE.532 and never
// will be - so the pipeline stands a shell in for the file. TEXTURE.050
// and TEXTURE.067 are real files carrying dozens of other records, and
// a stand-in for either would answer 1x1 for every one of them: every
// wall and floor drawn from archive 50, gone. Nothing about the archive
// NUMBER says which it is, so the registration says, and this holds it.

import { installSurvivalIcons, VENDOR_TENT_FILES } from '../src/systems/survival/items.js';
import { hasTextureReplacement } from '../src/systems/textureReplacement.js';
import { TENT_MODEL } from '../src/systems/survival/camp.js';

test('SURV-TENT: the tent’s art is carried, and does NOT stand in for its archive', async () => {
  assert.deepEqual([...VENDOR_TENT_FILES], ['50_7-0', '67_10-0']);
  for (const f of VENDOR_TENT_FILES) {
    const b = readFileSync(`vendor/climates-calories/Textures/${f}.png`);
    assert.equal(b[25], 6, `${f} is RGBA, as the other sixteen are`);
  }
  // the sizes the shipped bundle's Texture2Ds carry
  const sizeOf = (f) => { const b = readFileSync(`vendor/climates-calories/Textures/${f}.png`); return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }; };
  assert.deepEqual(sizeOf('50_7-0'), { width: 32, height: 32 }, 'the canvas');
  assert.deepEqual(sizeOf('67_10-0'), { width: 64, height: 8 }, 'the pole');

  clearVendorTextures();
  const n = installSurvivalIcons({ fetchBytes: async () => new Uint8Array(readFileSync('vendor/climates-calories/Textures/50_7-0.png')) });
  assert.equal(n, 18, 'sixteen icons and the tent’s two');

  // the swap arm finds them, ungated - they are the port's own art
  assert.equal(hasTextureReplacement(50, 7), true, 'the canvas is registered');
  assert.equal(hasTextureReplacement(67, 10), true, 'and the pole');

  // ...and THE ARCHIVES ARE STILL REAL. This answering true would send
  // TEXTURE.050 down the stand-in branch in scenes/dataPipeline.js and
  // cost every other record in it.
  assert.equal(isVendorArchive(50), false, 'TEXTURE.050 is still fetched');
  assert.equal(isVendorArchive(67), false, 'and TEXTURE.067');
  assert.equal(vendorRecordCount(50), 0, 'no stand-in shell for a real archive');
  assert.equal(vendorRecordCount(67), 0);
  // the icons' archives, by contrast, are the port's own whole
  assert.equal(isVendorArchive(532), true);
  assert.equal(isVendorArchive(539), true);

  // and the tent they dress is the mod's own model
  assert.equal(TENT_MODEL, 41606);
  clearVendorTextures();
});
