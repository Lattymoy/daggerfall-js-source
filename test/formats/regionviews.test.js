// REGION-VIEWS (2026-10-20, the owner: "do your own performance pass ... go deep"; bible/07-Rendering/Performance-Priority.md
// REGION-VIEWS) - A REGION'S FOUR RECORDS READ WHERE MAPS.BSA HOLDS THEM. MapsFile keeps one region resident
// (autoDiscard, as MapsFile.cs does), so every walk over the regions - the boot's map dictionary and index, a quest's
// places, the ports, the sea lanes, the raids - read every region again, and each read COPIED its four records (357 KB a
// region on the mean, 22 MB a walk): 364 regions read by a boot's 40th frame, half a second of copying and its
// collection in the profile of a boot into the world. The readers only ever read them, so BsaFile.getRecordView hands
// them over as views; getRecordBytes stays the copy (DFU's ReadBytes) every other reader takes. Held here: the view is
// the record's bytes on the archive's own buffer, and the copy still a copy; a region's records are views, read through
// their own offsets (a record never starts at the buffer's first byte), decoded as off copies. Over the real data
// (the record): every region and every classic location of MAPS.BSA, 30,564 reads, the same off views as off copies.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BsaFile } from '../../src/formats/bsaFile.js';
import { MapsFile } from '../../src/formats/mapsFile.js';
import { PAK_WIDTH, PAK_HEIGHT } from '../../src/formats/pakFile.js';

/** A NameRecord BSA of `records` ([name, bytes]). */
function bsaOf(records) {
  const NAME_FIELD = 14, ENTRY = 18;
  const out = new Uint8Array(4 + records.reduce((a, [, b]) => a + b.length, 0) + ENTRY * records.length);
  const v = new DataView(out.buffer);
  v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true);
  let pos = 4;
  for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; }
  for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; }
  return out;
}
/** A PAK of one value. */
function pakOf(value) {
  const bytes = new Uint8Array(PAK_HEIGHT * 4 + PAK_HEIGHT * 3), v = new DataView(bytes.buffer);
  for (let row = 0; row < PAK_HEIGHT; row++) { const off = PAK_HEIGHT * 4 + row * 3; v.setUint32(row * 4, off, true); v.setUint16(off, PAK_WIDTH, true); bytes[off + 2] = value; }
  return bytes;
}
/** A region's MAPNAMES (a count, then 32-byte names) and MAPTABLE (17-byte rows), as MAPS.BSA holds them. */
function regionRecords(names) {
  const mapNames = new Uint8Array(4 + 32 * names.length);
  new DataView(mapNames.buffer).setUint32(0, names.length, true);
  names.forEach((n, i) => { for (let c = 0; c < n.length; c++) mapNames[4 + 32 * i + c] = n.charCodeAt(c); });
  const mapTable = new Uint8Array(17 * names.length), t = new DataView(mapTable.buffer);
  names.forEach((_, i) => { t.setInt32(17 * i, 1000 + i, true); t.setUint32(17 * i + 4, (i + 2) << 8 | (3 << 25), true); t.setInt32(17 * i + 8, (40 + i) << 8, true); mapTable[17 * i + 12] = i; t.setUint32(17 * i + 13, 7 * i, true); });
  return [['MAPPITEM.000', new Uint8Array([1, 2, 3, 4])], ['MAPDITEM.000', new Uint8Array([5, 6, 7, 8])], ['MAPTABLE.000', mapTable], ['MAPNAMES.000', mapNames]];
}
const MAPS = () => bsaOf([...regionRecords(['Daggerfall', 'Ripton', 'Copperhold Orchard']), ...regionRecords(['Wayrest'])]);
const mapsOf = (bytes) => { const m = new MapsFile(); assert.equal(m.load(bytes, pakOf(1), pakOf(2)), true); return m; };
const decoded = (r) => JSON.stringify({ ...r, mapNameLookup: [...r.mapNameLookup], mapIdLookup: [...r.mapIdLookup] });

test('REGION-VIEWS getRecordView is a record\'s bytes on the archive\'s own buffer - the bytes getRecordBytes copies, null past the directory; getRecordBytes is still a copy (DFU\'s ReadBytes, owed to a reader that edits) (mutant: the view a copy)', () => {
  const bytes = bsaOf([['A.000', new Uint8Array([9, 8, 7])], ['B.000', new Uint8Array([1, 2, 3, 4, 5])]]);
  const bsa = new BsaFile(bytes);
  const view = bsa.getRecordView(1), copy = bsa.getRecordBytes(1);
  assert.deepEqual([...view], [1, 2, 3, 4, 5]);
  assert.deepEqual([...copy], [...view]);
  assert.equal(view.buffer, bytes.buffer, 'a view of the archive');
  assert.equal(view.byteOffset, 4 + 3, 'at the record\'s own place');
  assert.notEqual(copy.buffer, bytes.buffer, 'the copy its own');
  assert.equal(bsa.getRecordView(2), null);
  assert.equal(bsa.getRecordView(-1), null);
});

test('REGION-VIEWS a region\'s four records are views of MAPS.BSA, read through their own offsets, and decode as off copies - the region, read again after another, the same (mutant: copied as before)', () => {
  const bytes = MAPS();
  const maps = mapsOf(bytes);
  const a = decoded(maps.getRegion(0));
  const rec = maps._regions[0];
  for (const k of ['mapPItem', 'mapDItem', 'mapTable', 'mapNames']) assert.equal(rec[k].buffer, bytes.buffer, `${k} a view of MAPS.BSA`);
  assert.equal(maps.getRegion(0).mapNames.join('|'), 'Daggerfall|Ripton|Copperhold Orchard');
  assert.deepEqual(maps.getRegion(0).mapTable.map((r) => [r.mapId, r.longitude, r.latitude, r.dungeonType, r.key]), [[1000, 2, 40, 0, 0], [1001, 3, 41, 1, 7], [1002, 4, 42, 2, 14]]);
  assert.equal(maps.getRegion(1).mapNames.join('|'), 'Wayrest', 'the next region read');
  assert.equal(decoded(maps.getRegion(0)), a, 'the first read again - off its views, the same');
  // the same archive read off copies (getRecordBytes' own, as before REGION-VIEWS)
  const copies = mapsOf(MAPS());
  copies._bsa.getRecordView = copies._bsa.getRecordBytes;
  assert.equal(decoded(copies.getRegion(0)), a);
  assert.equal(decoded(copies.getRegion(1)), decoded(maps.getRegion(1)));
});
