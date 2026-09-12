// HM1 - THE HELM'S BLACK BOX (2026-09-12).
//
// Mac: "some armor (mostly helmets) have a black background (paperdoll
// not morrowind)."
//
// Index 0xFF is Daggerfall's MASK: the halo around a helm that erases
// the hair. ItemHelper.cs GetInventoryImage -> GetItemImage(item,
// removeMask: true) strips it before an icon is built, and
// PaperDollRenderer.cs:435 strips it for the doll too, then draws each
// item layer through DaggerfallPaperDoll.shader whose second pass
// clears the masked fragments "to expose background". The port's two
// icon rasterizers cut out index 0 alone and drew 0xFF as ART_PAL's
// 255 - the black box - and the doll skipped it, so the hair showed
// through a helm.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { changeMask, emptyBitmap } from '../src/formats/baseImageFile.js';
import { texName } from '../src/formats/textureFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';
import { createDataPipeline } from '../src/scenes/dataPipeline.js';
import { preloadPaperDollArt, refreshPaperDoll, paperDollPixels, PAPERDOLL_W, PAPERDOLL_H, PAPERDOLL_ORIGIN } from '../src/ui/paperDoll.js';
import { equipItem } from '../src/systems/equip.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');

test('HM1: changeMask is ImageProcessing.ChangeMask - 0xFF becomes the cutout, on a clone', () => {
  const bmp = { width: 3, height: 1, data: new Uint8Array([0xff, 5, 0]), palette: 'pal' };
  const out = changeMask(bmp);
  assert.deepEqual([...out.data], [0, 5, 0], 'the mask is index 0 now, the rest untouched');
  assert.deepEqual([...bmp.data], [0xff, 5, 0], 'the CACHED record keeps its mask (the doll still needs it)');
  assert.equal(out.width, 3); assert.equal(out.palette, 'pal');
  assert.deepEqual([...changeMask(bmp, 9).data], [9, 5, 0], 'replaceWith, as the C# takes it');
  assert.deepEqual(changeMask(null), emptyBitmap(), 'a null bitmap answers the empty one (the C# does)');
});

test('HM1: the DOM icon strips the mask (GetInventoryImage), and so do the classic pack\'s two drawers', () => {
  assert.match(src('src/ui/textureCanvas.js'), /const bmp = changeMask\(got\.file\.getDFBitmap\(record, 0\)\);/,
    'requestIcon rasterizes the mask-stripped clone');
  for (const f of ['src/ui/nativeInventory.js', 'src/ui/itemScroller.js']) {
    assert.match(src(f), /icons\.uploadRecord\(img\.archive, img\.record, \{ mips: false, removeMask: true \}\);/,
      `${f} asks the pipeline for the mask-stripped UI variant`);
  }
});

/** One-record TEXTURE archive, uncompressed, stride 256 (the shape
 *  test/roadh_seasons_tex.test.js builds). */
function textureBytes(width, height, indices) {
  const recPos = 46, RECORD_HEADER = 28;
  const bytes = new Uint8Array(recPos + RECORD_HEADER + 256 * height);
  const v = new DataView(bytes.buffer);
  v.setInt16(0, 1, true);
  v.setInt32(28, recPos, true);
  v.setInt16(recPos + 4, width, true);
  v.setInt16(recPos + 6, height, true);
  v.setUint32(recPos + 10, 256 * height, true);
  v.setUint32(recPos + 14, RECORD_HEADER, true);
  v.setUint16(recPos + 20, 1, true);
  for (let y = 0; y < height; y++) bytes.set(indices.subarray(y * width, (y + 1) * width), recPos + RECORD_HEADER + y * 256);
  return bytes;
}

test('HM1: uploadRecord(removeMask) uploads the 0xFF pixels as cutouts; without it they stay opaque; the cached record keeps them', async () => {
  const palette = new DFPalette(); palette.makeGrayscale();
  const bytes = textureBytes(2, 2, new Uint8Array([0xff, 5, 0, 0xff]));
  const log = [];
  const renderer = { uploadTexture: (a, r, c32, opts) => { log.push({ a, r, alpha: [...c32.colors].filter((_, i) => i % 4 === 3), opts }); return 'tex'; }, uploadEmissionTexture: () => {} };
  const pipe = createDataPipeline({ renderer, arch: { getRecordIndex: () => -1, getMesh: () => null }, palette, fetch: async (name) => (name === 'FLATS.CFG' ? new Uint8Array(0) : bytes) });
  const tex = await pipe.getTexture(245);
  pipe.uploadRecord(245, 0, { mips: false, removeMask: true });
  pipe.uploadRecord(245, 0, { mips: false });
  assert.equal(log.length, 2);
  assert.equal(log[0].alpha.filter((a) => a === 0).length, 3, 'stripped: the two mask pixels join the one index-0 cutout');
  assert.equal(log[1].alpha.filter((a) => a === 0).length, 1, 'not stripped: only index 0 is the cutout (the world-art law stands)');
  assert.deepEqual([...tex.getDFBitmap(0, 0).data], [0xff, 5, 0, 0xff], 'the archive\'s cached record was cloned, not edited');
  assert.equal(texName(245), 'TEXTURE.245');
});

// ── THE DOLL: the mask is a hole to the background ────────────────
// A headless art set - BG/BODY/FACE built as real IMG/CIF bytes, the
// helm record through a fake archive - so the compose runs the real
// layer walk. The background is index 5 everywhere; the body, index
// 9, covers the whole doll; the head, index 7, sits where the helm
// goes; the helm is a 4x4: a ring of 0xFF (the mask), a 2x2 centre of
// 0x10, index-0 corners.
function imgBytes(xOff, yOff, w, h, fill) {
  const b = new Uint8Array(12 + w * h);
  const v = new DataView(b.buffer);
  v.setInt16(0, xOff, true); v.setInt16(2, yOff, true); v.setInt16(4, w, true); v.setInt16(6, h, true);
  v.setUint16(10, w * h, true);
  b.fill(fill, 12);
  return b;
}

test('HM1: on the doll a helm\'s mask pixels show the BACKGROUND (the shader\'s second pass), its cutouts the layers under it', async () => {
  const [orgX, orgY] = PAPERDOLL_ORIGIN;
  const HX = orgX + 40, HY = orgY + 10;   // where the helm and the head go
  const palette = { get: (i) => ({ r: i, g: i, b: i }) };
  const fetchBytes = async (name) => {
    if (name.startsWith('SCBG')) return imgBytes(0, 0, 320, 200, 5);
    if (name.startsWith('BODY')) return imgBytes(orgX, orgY, PAPERDOLL_W, PAPERDOLL_H, 9);
    if (name.startsWith('FACE')) return imgBytes(HX, HY, 4, 4, 7);   // a plain CIF: one IMG-headed record
    throw new Error(`unexpected art ${name}`);
  };
  const helm = new Uint8Array([
    0x00, 0xff, 0xff, 0x00,
    0xff, 0x10, 0x10, 0xff,
    0xff, 0x10, 0x10, 0xff,
    0x00, 0xff, 0xff, 0x00,
  ]);
  const getTexture = async () => ({ recordCount: 64, getOffset: () => ({ x: HX, y: HY }), getDFBitmap: () => ({ width: 4, height: 4, data: helm, palette }) });
  const renderer = { uploadTexture: () => 'tex', releaseTexture: () => {}, drawScreenQuad: () => {} };
  await preloadPaperDollArt({ renderer, palette, getTexture, fetchBytes }, { race: 'Breton', gender: 'male', faceIndex: 0 });
  const e = { items: [] };
  equipItem(e, { group: 'Armor', templateIndex: 107, material: 0, name: 'Helm' });
  await refreshPaperDoll(e);
  const px = paperDollPixels();
  const at = (x, y) => px.rgba[((HY - orgY + y) * PAPERDOLL_W + (HX - orgX + x)) * 4];
  assert.equal(at(1, 1), 0x10, 'the helm itself');
  assert.equal(at(0, 0), 7, 'an index-0 corner: the head under it shows, as ever');
  assert.equal(at(1, 0), 5, 'a MASK pixel: the background - the hair is erased, not drawn through');
  assert.equal(at(0, 1), 5, 'on every side of the helm');
  assert.equal(px.rgba[((HY - orgY + 6) * PAPERDOLL_W + (HX - orgX)) * 4], 9, 'below the helm the body stands');
  assert.equal(px.rgba[((HY - orgY + 1) * PAPERDOLL_W + (HX - orgX + 1)) * 4 + 3], 255, 'and every doll pixel stays opaque');
});
