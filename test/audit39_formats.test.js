// AUDIT 39 (the 528-agent adversarial sweep), the format findings whose
// harnesses live nowhere else. Each test names the reference member it
// pins.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CifRciFile } from '../src/formats/cifRciFile.js';
import { readMagicDef, MAGIC_ITEM_RECORD_SIZE } from '../src/formats/magicDef.js';
import { TextRsc, RSC } from '../src/formats/textRsc.js';
import { parseNif } from '../src/formats/mwNifFile.js';
import { flattenNif } from '../src/formats/mwNifMesh.js';
import { composeMovementGroup, MW_WEAPON_TYPE } from '../src/formats/mwFirstPerson.js';
import { composeWornArmor } from '../src/formats/mwItemMap.js';
import { ARMOR_ENUM } from '../src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';

test('audit39 formats: a WEAPON CIF whose TotalSize is 0 FAILS the load, it does not spin', () => {
  // ReadWeaponCif's only stride is the file's own TotalSize
  // (CifRciFile.cs:466), so a 0 leaves the read head where it started.
  // DFU survives that on its fixed `new Record[64]` (:33): the 65th write
  // throws IndexOutOfRange, Read()'s catch swallows it and Load returns
  // false. The port grew a plain array and looped forever, pushing
  // records until the tab died.
  const bytes = new Uint8Array(400);
  const v = new DataView(bytes.buffer);
  v.setUint16(0, 8, true);        // width
  v.setUint16(2, 8, true);        // height
  v.setUint16(4, 8, true);        // last frame width
  v.setUint16(6 + 0, 0, true);    // xOffset
  v.setUint16(8, 0, true);        // last frame y offset
  v.setUint16(10, 0, true);       // data length
  v.setUint16(12, 1, true);       // one non-zero frame offset -> frameCount 1
  v.setUint16(12 + 62, 0, true);  // TOTAL SIZE 0 - the non-advancing stride
  const f = new CifRciFile();
  const started = Date.now();
  assert.equal(f.load(bytes, 'WEAPON09.CIF'), false, 'the load fails, exactly as DFU\'s does');
  assert.ok(Date.now() - started < 2000, 'and it returns');
  assert.equal(f.recordCount, 0, 'and reports no records - DFU\'s totalRecords stays 0 on a failure');
});

test('audit39 formats: MAGIC.DEF names trim TRAILING nulls only', () => {
  // MagicItemsFile.cs:87 reads the name with a NON-ZERO readLength
  // (nameLength = 32), and FileProxy.ReadCString skips its terminator scan
  // whenever readLength != 0 (FileProxy.cs:383-390): what comes back is
  // `Encoding.UTF8.GetString(...).TrimEnd('\0')`, so an embedded NUL and
  // its stale tail SURVIVE. The port truncated at the first NUL - the same
  // law AUDIT 24 fixed rumorFile.js under.
  const buf = new Uint8Array(4 + MAGIC_ITEM_RECORD_SIZE);
  new DataView(buf.buffer).setInt32(0, 1, true);
  const name = 'Ring\0stale';
  for (let i = 0; i < name.length; i++) buf[4 + i] = name.charCodeAt(i);
  const [item] = readMagicDef(buf);
  assert.equal(item.name, 'Ring\0stale', 'the tail after the embedded NUL stays');
  assert.ok(!item.name.endsWith('\0'), 'and the padding still comes off');
});

test('audit39 formats: the variant step-back gates on TOKENS, not on surviving rows', () => {
  // TextProvider.cs:231 is `index = (tokenStreams[index].Length == 0 ?
  // index - 1 : index);` - the picked stream's TOKEN count. A variant made
  // only of break bytes holds ONE formatting token, so DFU renders it as a
  // blank line; the port measured linesById's rows, which drop trailing
  // empties, so it showed the PREVIOUS variant instead.
  const rsc = (rec) => {
    const head = [12, 0, 132, 3, 14, 0, 0, 0];   // one record, id 900, offset 14
    const bytes = new Uint8Array(14 + rec.length);
    bytes.set(head, 0);
    bytes.set(rec, 14);
    return new TextRsc().load(bytes);
  };
  const A = [...'aa'].map((c) => c.charCodeAt(0));
  // variant 1 is a lone JustifyCenter: one token in DFU, zero rows here
  const breakOnly = rsc(A.concat([RSC.SubrecordSeparator, RSC.JustifyCenter, RSC.EndOfRecord]));
  assert.equal(breakOnly.variantCount(900), 2);
  assert.deepEqual(breakOnly.variantLinesById(900, () => 0.99), [],
    'the break-only variant renders blank - it does NOT fall back to "aa"');
  // and the genuinely empty trailing stream (0xFF 0xFE) still steps back
  const empty = rsc(A.concat([RSC.SubrecordSeparator, RSC.EndOfRecord]));
  assert.deepEqual(empty.variantLinesById(900, () => 0.99).map((r) => r.text), ['aa'],
    'FTD-1 stands: an empty stream steps back one variant');
});

// ── the NIF reader/flattener findings ───────────────────────────────────
// A hand-built 4.0.0.2 file, the way test/fixtures/mw/generate.py writes
// extras.nif: no record carries a size, so every byte of every record has
// to be in step or the file ends.
const sstr = (t) => {
  const b = new Uint8Array(4 + t.length);
  new DataView(b.buffer).setUint32(0, t.length, true);
  for (let i = 0; i < t.length; i++) b[4 + i] = t.charCodeAt(i);
  return b;
};
const cat = (...parts) => {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
const pack = (fmt, ...vals) => {
  // fmt: string of 'i' (int32), 'I' (uint32), 'H' (uint16), 'B' (byte), 'f'
  const sizes = { i: 4, I: 4, H: 2, B: 1, f: 4 };
  const size = [...fmt].reduce((n, c) => n + sizes[c], 0);
  const b = new Uint8Array(size);
  const v = new DataView(b.buffer);
  let o = 0;
  [...fmt].forEach((c, k) => {
    if (c === 'i') v.setInt32(o, vals[k], true);
    else if (c === 'I') v.setUint32(o, vals[k], true);
    else if (c === 'H') v.setUint16(o, vals[k], true);
    else if (c === 'B') v.setUint8(o, vals[k]);
    else v.setFloat32(o, vals[k], true);
    o += sizes[c];
  });
  return b;
};
/** NiNode/NiSwitchNode-shaped payload: NiObjectNET + AVObject + children. */
function nodePayload(name, children, translation, tail = new Uint8Array(0)) {
  return cat(
    sstr(name), pack('ii', -1, -1), pack('H', 0),
    pack('fff', ...translation),
    pack('fffffffff', 1, 0, 0, 0, 1, 0, 0, 0, 1),
    pack('f', 1), pack('fff', 0, 0, 0),
    pack('I', 0),                                  // properties
    pack('I', 0),                                  // no bounding volume
    cat(pack('I', children.length), ...children.map((c) => pack('i', c))),
    pack('I', 0),                                  // effects
    tail,
  );
}
function nifOf(records, roots = [0]) {
  return cat(
    new Uint8Array([...'NetImmerse File Format, Version 4.0.0.2\n'].map((c) => c.charCodeAt(0))),
    pack('II', 0x04000002, records.length),
    ...records.map(([type, payload]) => cat(sstr(type), payload)),
    cat(pack('I', roots.length), ...roots.map((r) => pack('i', r))),
  );
}

test('audit39 formats: an internal NiSourceTexture with no pixel data carries NO ref', () => {
  // texture.cpp:13-21 - below 10.0.1.4 the byte after `mExternal` IS
  // hasData, and `mData.read(nif)` (one int32) happens only when it is
  // set. Reading it unconditionally over-reads four bytes, and a 4.0.0.2
  // stream has no record sizes to resynchronize from - the Marker node
  // below is what says the reader stayed in step.
  const texture = cat(
    sstr('tex'), pack('ii', -1, -1),               // NiObjectNET
    pack('B', 0),                                  // external = 0
    pack('B', 0),                                  // hasData = 0 -> no ref follows
    pack('III', 0, 0, 0),                          // pixel layout, mipmaps, alpha
    pack('B', 1),                                  // isStatic
  );
  const nif = parseNif(nifOf([
    ['NiNode', nodePayload('Root', [2], [0, 0, 0])],
    ['NiSourceTexture', texture],
    ['NiNode', nodePayload('Marker', [], [7, 8, 9])],
  ]));
  assert.equal(nif.records[1].hasData, false);
  assert.equal(nif.records[1].pixelData, -1, 'no ref was consumed');
  assert.equal(nif.records[2].name, 'Marker');
  assert.deepEqual(Array.from(nif.records[2].translation), [7, 8, 9], 'the reader stayed in step');
});

test('audit39 formats: the flattener walks EVERY NiNode-derived class and draws NiTriStrips', () => {
  // nifloader.cpp:932-937 recurses `ninode->mChildren` for whatever casts
  // to Nif::NiNode - NiSwitchNode/NiLODNode/NiSortAdjustNode/
  // NiCollisionSwitch included - and isTypeNiGeometry (:160-166) treats
  // NiTriStrips as geometry beside NiTriShape. The port parsed all six and
  // then dropped them on the floor.
  const geomData = (extra) => cat(
    pack('H', 3), pack('I', 1),                    // 3 vertices, has vertices
    pack('fff', 0, 0, 0), pack('fff', 1, 0, 0), pack('fff', 0, 1, 0),
    pack('I', 0),                                  // has normals
    pack('ffff', 0, 0, 0, 1),                      // bound centre + radius
    pack('I', 0),                                  // has colours
    pack('H', 0), pack('I', 0),                    // no UV sets
    extra,
  );
  // NiTriStripsData: numTriangles, numStrips, strip lengths, then strips.
  const strips = cat(
    pack('HH', 2, 2),
    pack('HH', 6, 2),                              // lengths: one real strip, one short
    pack('HHHHHH', 0, 1, 2, 2, 0, 1),              // two degenerate joins inside
    pack('HH', 0, 1),                              // a 2-index strip: dropped whole
  );
  const shapePayload = (name) => cat(
    sstr(name), pack('ii', -1, -1), pack('H', 0),
    pack('fff', 0, 0, 0),
    pack('fffffffff', 1, 0, 0, 0, 1, 0, 0, 0, 1),
    pack('f', 1), pack('fff', 0, 0, 0),
    pack('I', 0), pack('I', 0),
    pack('ii', 4, -1),                             // data ref, skin ref
  );
  const nif = parseNif(nifOf([
    ['NiNode', nodePayload('Root', [1], [0, 0, 0])],
    ['NiSortAdjustNode', nodePayload('Sorted', [2], [0, 0, 0], pack('Ii', 0, -1))],
    ['NiSwitchNode', nodePayload('Switch', [3], [0, 0, 0], pack('I', 0))],
    ['NiTriStrips', shapePayload('Strips')],
    ['NiTriStripsData', geomData(strips)],
  ]));
  const batches = flattenNif(nif);
  assert.equal(batches.length, 1, 'the switch/sort subtree is walked, not pruned');
  assert.equal(batches[0].name, 'Strips');
  // GL's strip winding: even triangles keep their order, odd ones swap the
  // first two corners, and the degenerate joins (1,2,2 and 2,2,0) drop out
  // exactly as GL drops them. The 2-index strip contributes nothing
  // (nifloader.cpp:1613 - `if (strip.size() < 3) continue;`).
  assert.deepEqual(Array.from(batches[0].indices), [0, 1, 2, 0, 2, 1]);
});

test('audit39r R18: a switch shows ONE branch and a LOD ONE level, not the union', () => {
  // nifloader.cpp:907-924 hangs a NiSwitchNode's children off an
  // osg::Switch built with `setNewChildDefaultValue(false);
  // setSingleChildOn(mInitialIndex)` (:568-575) and a NiLODNode's off an
  // osg::LOD with one DISTANCE_FROM_EYE_POINT range per level (:553-565):
  // exactly one subtree draws. F8 walked the subtrees but emitted every
  // branch and every level superimposed, leaving the parsed `index` and
  // `lodLevels` dead.
  const triData = cat(
    pack('H', 3), pack('I', 1),                    // 3 vertices, has vertices
    pack('fff', 0, 0, 0), pack('fff', 1, 0, 0), pack('fff', 0, 1, 0),
    pack('I', 0),                                  // no normals
    pack('ffff', 0, 0, 0, 1),                      // bound centre + radius
    pack('I', 0),                                  // no colours
    pack('H', 0), pack('I', 0),                    // no UV sets
    pack('H', 1), pack('I', 3), pack('HHH', 0, 1, 2),
    pack('H', 0),                                  // no match groups
  );
  const shape = (name, dataRef) => cat(
    sstr(name), pack('ii', -1, -1), pack('H', 0),
    pack('fff', 0, 0, 0),
    pack('fffffffff', 1, 0, 0, 0, 1, 0, 0, 0, 1),
    pack('f', 1), pack('fff', 0, 0, 0),
    pack('I', 0), pack('I', 0),
    pack('ii', dataRef, -1),                       // data ref, skin ref
  );
  const drawn = (records) => flattenNif(parseNif(nifOf(records))).map((b) => b.name);

  const switchTree = (index) => [
    ['NiNode', nodePayload('Root', [1], [0, 0, 0])],
    ['NiSwitchNode', nodePayload('Switch', [2, 3], [0, 0, 0], pack('I', index))],
    ['NiTriShape', shape('Branch0', 4)],
    ['NiTriShape', shape('Branch1', 4)],
    ['NiTriShapeData', triData],
  ];
  assert.deepEqual(drawn(switchTree(1)), ['Branch1'], 'the index the file names, and only it');
  assert.deepEqual(drawn(switchTree(0)), ['Branch0']);
  // An index past the last child leaves no branch on, exactly as an
  // out-of-range setSingleChildOn does.
  assert.deepEqual(drawn(switchTree(7)), []);

  // NiLODNode inherits the switch index but the reference routes it to the
  // LOD wrapper instead, so the RANGES decide: a flattener has no eye, and
  // reads the LOD at its own centre - distance 0, the nearest level. The
  // index below is 1 on purpose; the near level still wins.
  const lodTail = cat(
    pack('I', 1),                                  // switch index (ignored here)
    pack('fff', 0, 0, 0),                          // LOD centre
    pack('I', 2), pack('ff', 0, 100), pack('ff', 100, 1e9),
  );
  assert.deepEqual(drawn([
    ['NiNode', nodePayload('Root', [1], [0, 0, 0])],
    ['NiLODNode', nodePayload('Lod', [2, 3], [0, 0, 0], lodTail)],
    ['NiTriShape', shape('Near', 4)],
    ['NiTriShape', shape('Far', 4)],
    ['NiTriShapeData', triData],
  ]), ['Near']);
  // A plain NiNode-alias keeps every child - only Switch and LOD select.
  assert.deepEqual(drawn([
    ['NiNode', nodePayload('Root', [1], [0, 0, 0])],
    ['NiSortAdjustNode', nodePayload('Sorted', [2, 3], [0, 0, 0], pack('Ii', 0, -1))],
    ['NiTriShape', shape('A', 4)],
    ['NiTriShape', shape('B', 4)],
    ['NiTriShapeData', triData],
  ]), ['A', 'B']);
});

test('audit39 formats: a spell stance TURNS on the prefixed group', () => {
  // character.cpp:676-687 - "Spellcasting stance turning is a special
  // case": the short group PREFIXES the movement name. The port only ever
  // suffixed, so it asked for "turnleftspell" (a name no .kf carries) and
  // "spellturnleft" - which the port's own LOOPING_ANIMATIONS lists - was
  // unreachable.
  const has = (set) => (n) => set.has(n);
  assert.deepEqual(
    composeMovementGroup('turnleft', MW_WEAPON_TYPE.Spell, has(new Set(['spellturnleft', 'turnleft']))),
    { group: 'spellturnleft', walked: false });
  assert.deepEqual(
    composeMovementGroup('turnright', MW_WEAPON_TYPE.Spell, has(new Set(['spellturnright']))),
    { group: 'spellturnright', walked: false });
  // a miss falls to fallbackShortWeaponGroup, and a spell is not a real
  // weapon, so that is the BARE base at once (:604-611) - never the
  // 1h/2c suffix ladder.
  assert.deepEqual(
    composeMovementGroup('turnleft', MW_WEAPON_TYPE.Spell, has(new Set(['turnleft', 'turnleft1h']))),
    { group: 'turnleft', walked: false });
  // and the special case is TURNING only: walking with a readied spell
  // still suffixes (character.cpp:684-687).
  assert.deepEqual(
    composeMovementGroup('walkforward', MW_WEAPON_TYPE.Spell, has(new Set(['walkforwardspell']))),
    { group: 'walkforwardspell', walked: false });
});

test('audit39 formats: a worn hair part keeps its part NAME, so the hair filter still fires', () => {
  // npcanimation.cpp:799-801 - PRT_Hair is the one part whose geometry
  // filter is not its attach bone. The binder tests that by name
  // (mwFirstPerson.js), and composeRefs labels every worn add
  // "<part> (<record id>)" for the notes - so a worn hair piece arrived as
  // "hair (wig)" and filtered on the bone "head" instead.
  const armors = [{
    id: 'iron_helmet', model: 'h.nif', name: '', enchanted: false,
    parts: [{ part: 1, male: 'b_hair', female: null }],
  }];
  const bodyPool = [{ id: 'b_hair', model: 'm/hair.nif' }];
  const worn = composeWornArmor({
    pieces: [{ templateIndex: ARMOR_ENUM.Helm, material: ARMOR_MATERIAL.Iron }],
    armors, bodyPool, female: false,
  });
  const add = worn.adds.find((a) => a.recordId === 'b_hair');
  assert.equal(add.partName, 'hair', 'the bare part name rides along');
  assert.equal(add.slot, 'hair (iron_helmet)', 'the label still names the record for the notes');
  // and the two seams that carry it: the binder keys on the part name,
  // the build passes it through.
  const fp = readFileSync('src/formats/mwFirstPerson.js', 'utf8');
  assert.match(fp, /const geomFilter = \(part\.partName \?\? part\.slot\) === 'hair' \? 'hair' : bone;/);
  const arm = readFileSync('src/combat/fpArm.js', 'utf8');
  assert.match(arm, /partBytes\.push\(\{ slot: row\.slot, partName: row\.partName, bones: row\.bones/);
});
