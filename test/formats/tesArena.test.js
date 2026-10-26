// ARN1: TES: Arena's readers - GLOBAL.BSA, PAL.COL and *.CFA (src/formats/tesArena/). The synthetic half runs
// everywhere; the corpus half reads Bethesda's free Arena 1.06 when TES_ARENA_PATH names its ARENA folder
// (`sh tools/fetch-arena.sh` puts it at /home/claude/arenadata/ARENA - never in the repo).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { TesArenaBsa, TES_ARENA_BSA_ENTRY_SIZE } from '../../src/formats/tesArena/tesArenaBsa.js';
import { TesArenaCfaFile, TES_ARENA_CFA_LUT_OFFSET } from '../../src/formats/tesArena/tesArenaCfa.js';
import { loadTesArenaPalette } from '../../src/formats/tesArena/tesArenaPalette.js';

const ARENA = process.env.TES_ARENA_PATH;
const skipReal = !ARENA || !existsSync(join(ARENA, 'GLOBAL.BSA')) ? 'TES_ARENA_PATH not set or missing - real-data validation skipped' : false;

/** A GLOBAL.BSA of `files` ({ name: Uint8Array }), compressed flags by name. */
function makeBsa(files, compressed = {}) {
  const names = Object.keys(files);
  const body = names.reduce((n, k) => n + files[k].length, 0);
  const out = new Uint8Array(2 + body + names.length * TES_ARENA_BSA_ENTRY_SIZE);
  const v = new DataView(out.buffer);
  v.setUint16(0, names.length, true);
  let at = 2;
  for (const k of names) { out.set(files[k], at); at += files[k].length; }
  names.forEach((k, i) => {
    const e = 2 + body + i * TES_ARENA_BSA_ENTRY_SIZE;
    for (let c = 0; c < k.length; c++) out[e + c] = k.charCodeAt(c);
    v.setUint16(e + 12, compressed[k] ? 1 : 0, true);
    v.setUint32(e + 14, files[k].length, true);
  });
  return out;
}

/** A one-frame CFA: `packed` the row bytes (sent as one RLE literal run), `lut` from byte 76. */
function makeCfa({ w, h = 1, wc, bpp, lut = [], packed }) {
  const headerSize = TES_ARENA_CFA_LUT_OFFSET + lut.length;
  const out = new Uint8Array(headerSize + 1 + packed.length);
  const v = new DataView(out.buffer);
  v.setUint16(0, w, true); v.setUint16(2, h, true); v.setUint16(4, wc, true);
  out[10] = bpp; out[11] = 1; v.setUint16(12, headerSize, true);
  out.set(lut, TES_ARENA_CFA_LUT_OFFSET);
  out[headerSize] = packed.length - 1;   // a literal run of every packed byte
  out.set(packed, headerSize + 1);
  return out;
}

test('ARN1 GLOBAL.BSA: a u16 count, the files from byte 2 end to end, a footer of 12-byte names, flags and sizes', () => {
  const bsa = new TesArenaBsa(makeBsa({ 'A.CFA': Uint8Array.of(1, 2, 3), 'pal.col': Uint8Array.of(9) }));
  assert.equal(bsa.count, 2);
  assert.deepEqual(bsa.names, ['A.CFA', 'PAL.COL']);
  assert.deepEqual([...bsa.get('a.cfa')], [1, 2, 3], 'a name is found whatever its case');
  assert.deepEqual([...bsa.get('PAL.COL')], [9], 'the second file starts where the first ended');
  assert.equal(bsa.get('NONE.CFA'), null);
  assert.throws(() => new TesArenaBsa(makeBsa({ 'A.CFA': Uint8Array.of(1) }, { 'A.CFA': true })).get('A.CFA'), /compressed/);
  const bad = makeBsa({ 'A.CFA': Uint8Array.of(1, 2) });
  new DataView(bad.buffer).setUint32(bad.length - 4, 1, true);   // a size that leaves a gap before the footer
  assert.throws(() => new TesArenaBsa(bad), /the files end/);
});

test('ARN1 CFA: packed values most significant bit first, looked up in the table at byte 76; 8 bits are indices untranslated', () => {
  // 1,2,3,4,5 at three bits: 001 010 011 100 101 0 -> 0x29 0xca
  const lut = [0, 10, 20, 30, 40, 50, 60, 70];
  const three = new TesArenaCfaFile().load(makeCfa({ w: 5, wc: 2, bpp: 3, lut, packed: Uint8Array.of(0x29, 0xca) }), 'T.CFA');
  assert.deepEqual([...three.frames[0]], [10, 20, 30, 40, 50]);
  // past the row's last byte the demux reads zeros: a sixth value at four bits from one byte is the table's 0
  const four = new TesArenaCfaFile().load(makeCfa({ w: 3, wc: 1, bpp: 4, lut: [0, 7, 8], packed: Uint8Array.of(0x12) }), 'F.CFA');
  assert.deepEqual([...four.frames[0]], [7, 8, 0]);
  const eight = new TesArenaCfaFile().load(makeCfa({ w: 3, wc: 3, bpp: 8, packed: Uint8Array.of(5, 0, 200) }), 'E.CFA');
  assert.deepEqual([...eight.frames[0]], [5, 0, 200]);
  assert.deepEqual(eight.getSize(), { width: 3, height: 1 });
  assert.equal(eight.getDFBitmap(0, 1).data, null, 'no second frame');
});

test('ARN1 PAL.COL: 776 bytes, its length and version 0xb123 in the header, the rest DFPalette\'s', () => {
  const ok = new Uint8Array(776);
  const v = new DataView(ok.buffer);
  v.setUint32(0, 776, true); v.setUint32(4, 0xb123, true);
  ok[8 + 3] = 255;   // index 1's red
  assert.equal(loadTesArenaPalette(ok).getRed(1), 255);
  const wrong = ok.slice(); new DataView(wrong.buffer).setUint32(4, 0xb124, true);
  assert.throws(() => loadTesArenaPalette(wrong), /version/);
  assert.throws(() => loadTesArenaPalette(ok.subarray(0, 768)), /776/);
});

const md5 = (frames) => { const h = createHash('md5'); for (const f of frames) h.update(f); return h.digest('hex'); };

test('ARN1 THE CORPUS (Arena 1.06): GLOBAL.BSA closes, every CFA decodes, and one of each bit depth is its own pixels', { skip: skipReal }, () => {
  const bsa = new TesArenaBsa(new Uint8Array(readFileSync(join(ARENA, 'GLOBAL.BSA'))));
  loadTesArenaPalette(new Uint8Array(readFileSync(join(ARENA, 'PAL.COL'))));
  assert.equal(bsa.count, 2441);
  const cfas = bsa.names.filter((n) => n.endsWith('.CFA'));
  assert.equal(cfas.length, 340);
  for (const n of cfas) assert.ok(new TesArenaCfaFile().load(bsa.get(n), n).frames.length > 0, n);
  // decoded by this reader and by an independent one (ARN1's prototype) to the same indices, every file of the 340
  const pins = {
    1: ['LGLIT02.CFA', 16, 50, 3, 'ea2c744411d022bf29151dd5194447de'],
    2: ['BLOODEXP.CFA', 51, 44, 5, '7db757c8d044d959fbadf770221c0ea2'],
    3: ['DUST.CFA', 32, 31, 5, '17b4ebb3cef689731cea8b40e5a8327c'],
    4: ['01SHIELD.CFA', 33, 46, 9, 'c718106c83921f32b70ac8d5f6ced202'],
    5: ['01AXE.CFA', 89, 58, 3, 'd26be14cf597e588bba8a48ae3ef4e08'],
    6: ['01BAXE.CFA', 47, 86, 3, '6af50215b716a98929d62ae3573c75cd'],
    7: ['01PLTATT.CFA', 71, 107, 3, '93fd996196804daf0ef5166540748763'],
    8: ['GHOST1.CFA', 100, 99, 12, 'c92ccc21624090271a1ca0667f222bd0'],
  };
  for (const [bpp, [name, w, h, n, hash]] of Object.entries(pins)) {
    const c = new TesArenaCfaFile().load(bsa.get(name), name);
    assert.deepEqual([c.header.bitsPerPixel, c.header.widthUncompressed, c.header.height, c.header.frameCount, md5(c.frames)], [Number(bpp), w, h, n, hash], name);
  }
});
