// DECOR-MODFLATS (2026-09-27, Discord: "Above #49 decorations stopped working. Most sprites decorations are invisable
// above this number").
//
// "DECORATION 49" ONWARD WERE THE MODS' FLATS. The catalogue is read out of the world's own blocks, and the ships
// Detailed Ships lays in them carry its own flats (archives 1210 and 1230) and the DET flats the port stands in (10009
// to 10027). A decoration is named by its place in id order, so they were "Decoration 49" onward - after the classic
// ones, the last of which is 254's. The piece law stopped at archive 999: the piece being placed was never a piece, so
// its ghost never stood and Place did nothing. And their pictures in the list asked the DOM door (ui/textureCanvas.js
// loadIcon), whose wait was four turns past the classic file's read - a mod's picture has no classic file, and decodes
// in its own time, so it landed after the answer was read and the panel kept "none to be had" for it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decorWhatOf, decorPieceOf, DECOR_ARCHIVE_MAX } from '../src/net/decorLaw.js';
import { collectDecor, decorCatalogue } from '../src/systems/decorCatalogue.js';
import { addVendorTextures, clearVendorTextures, setTextureDeriveContext, setTextureReplacements, clearTextureReplacements, preloadTextureRecord } from '../src/systems/textureReplacement.js';
import { loadIcon, textureArchive } from '../src/ui/textureCanvas.js';
import { settle, toolRig, placeFrom, rmb } from './decorFakes.mjs';

const piece = (flat) => ({ id: 'p1', model: null, flat, pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 20 });

test('DECOR-MODFLATS the law: Detailed Ships\' own flats and the DET stand-ins are pieces - an archive to five digits; past them, none (mutant: the bound back at 999)', () => {
  assert.equal(DECOR_ARCHIVE_MAX, 99_999);
  for (const flat of [[1210, 1], [1230, 30], [10009, 29], [10010, 38], [10027, 14]]) {
    assert.deepEqual(decorWhatOf({ model: null, flat }), { model: null, flat }, JSON.stringify(flat));
    assert.deepEqual(decorPieceOf(piece(flat))?.flat, flat, `${flat}: stored and read back`);
  }
  assert.equal(decorWhatOf({ model: null, flat: [100_000, 0] }), null);
});

test('DECOR-MODFLATS the catalogue: a mod\'s flat in a town block is a decoration, numbered after the classic ones - the report\'s "#49"', () => {
  const decor = decorCatalogue(collectDecor([rmb([], [[254, 10], [1210, 1], [200, 3], [10027, 3]])])).filter((e) => e.kind === 'decor');
  assert.deepEqual(Object.fromEntries(decor.map((e) => [e.name, e.flat.join('.')])),
    { 'Decoration 1': '200.3', 'Decoration 2': '254.10', 'Decoration 3': '1210.1', 'Decoration 4': '10027.3' });
});

test('DECOR-MODFLATS the placement: a mod\'s flat chosen from the catalogue flies as its ghost, and Place stands it in the room (mutant: the bound back at 999 - no ghost drawn, and Place does nothing)', async () => {
  const rig = toolRig({ gold: 500, extraFlats: [[1210, 1]] });
  await placeFrom(rig, 'f1210.1');
  await settle();
  rig.frame();
  const ghost = rig.tool.ghost();
  assert.deepEqual(ghost?.flat, [1210, 1], 'a piece where the eye meets the room');
  const [batch] = rig.tool.batches();
  assert.deepEqual([batch?.archive, batch?.record], [1210, 1], 'and its picture drawn there');
  rig.win.fire('mousedown', { button: 0 });
  await settle();
  assert.deepEqual(rig.standing.map((p) => p.flat), [[1210, 1]], 'placed');
  assert.deepEqual(rig.w.paid, [ghost.paid], 'and paid for, as any piece');
});

/** A canvas node has none of: the DOM door's canvas, stubbed as test/dw3_icons.test.js stubs it (`fail`: it throws). */
function withCanvas(fail = false) {
  const had = globalThis.document;
  let n = 0;
  globalThis.document = {
    createElement: () => {
      if (fail) throw new Error('no canvas');
      return {
        width: 0, height: 0,
        getContext: () => ({ createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }), putImageData() {}, drawImage() {}, imageSmoothingEnabled: true }),
        toDataURL: () => `data:image/png;base64,STUB${++n}`,
      };
    },
  };
  return () => { globalThis.document = had; };
}

/** A mod's picture (a stand-in the port builds), held until `release()` - its own decode's time. */
function slowPicture(archive, record) {
  let release = () => {};
  const gate = new Promise((r) => { release = r; });
  setTextureDeriveContext({ classicRgba: async () => null });
  addVendorTextures([{ archive, record, fileName: `modflat-${archive}_${record}`, standIn: true, build: async () => { await gate; return { width: 2, height: 2, data: new Uint8Array(16).fill(200) }; } }]);
  return () => release();
}

test('DECOR-MODFLATS the picture: the DOM door waits for a mod\'s picture - landing after the classic file\'s read has failed, it is the answer, not "none to be had" (mutant: the old four turns)', async () => {
  const restore = withCanvas();
  const release = slowPicture(10027, 3);
  try {
    const pending = loadIcon(10027, 3, { scale: 1 });
    await textureArchive(10027);   // the classic read: no such file
    for (let i = 0; i < 8; i++) await Promise.resolve();   // and the old wait's four turns long spent
    release();
    assert.match(await pending ?? '', /^data:image\/png;base64,STUB/, 'the mod\'s picture');
    assert.match(await loadIcon(10027, 3, { scale: 1 }) ?? '', /^data:image\/png;base64,STUB/, 'warm after');
  } finally { restore(); clearVendorTextures(); setTextureDeriveContext(null); }
});

test('DECOR-MODFLATS the picture: one that throws while it is drawn answers none - the wait is never left hanging, on the vendored arm or the replacement\'s (mutants: the throw unsettled; a miss unsettled)', async () => {
  const restore = withCanvas(true);
  const release = slowPicture(10027, 4);
  const warn = console.warn;
  console.warn = () => {};
  const late = () => new Promise((r) => setTimeout(() => r('hung'), 500));
  try {
    const pending = loadIcon(10027, 4, { scale: 1 });
    release();
    assert.equal(await Promise.race([pending, late()]), null, 'a mod\'s own picture');
    // a classic record's replacement, decoded, whose drawing throws: the replacement arm's own catch settles it
    setTextureReplacements(['213_18-0.png'], async () => new Uint8Array([1]));
    await preloadTextureRecord(213, 18, 0, 'Albedo', null, { decode: async () => ({ width: 2, height: 2, data: new Uint8Array(16).fill(90) }) });
    assert.equal(await Promise.race([loadIcon(213, 18, { scale: 1 }), late()]), null, 'a replacement');
  } finally { console.warn = warn; restore(); clearTextureReplacements(); clearVendorTextures(); setTextureDeriveContext(null); }
});
