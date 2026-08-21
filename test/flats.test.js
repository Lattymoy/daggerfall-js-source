// FLATS.CFG - FlatsFile.cs, the port's TWELFTH format reader. It
// carries the two things every person in the world has been missing: a
// flat's CAPTION (the quest macro =symbol_ resolves through it, and Q4
// declared `world.flatCaption(archive, record)` as a seam with no
// production provider) and its FACE INDEX into TFAC00I0.RCI - the
// portrait the talk window's empty 64x64 frame wants.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { FlatsFile, flatId, reverseFlatId, flatGender, flatCensored } from '../src/formats/flatsFile.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2) ? 'ARENA2_PATH not set' : false;

const block = (a, r, caption, gender, u2, u3, face) =>
  `${a} ${r}\n${caption}\n${gender}\n${u2}\n${u3}\n${face}`;

test('FLATS: the flat ID is archive<<7 + record, and it reverses', () => {
  // GetFlatID / ReverseFlatID. Records run 0..127, which is the seven
  // bits - a record of 128 would collide with the next archive, and
  // the reverse masks with 0x7f rather than trusting the input.
  assert.equal(flatId(182, 4), 182 * 128 + 4);
  assert.deepEqual(reverseFlatId(flatId(182, 4)), { archive: 182, record: 4 });
  assert.deepEqual(reverseFlatId(flatId(334, 127)), { archive: 334, record: 127 });
  // the mask is real: a record past 7 bits wraps into the archive
  assert.deepEqual(reverseFlatId(flatId(1, 128)), { archive: 2, record: 0 });
});

test('FLATS: blocks parse, and a DUPLICATE keeps the FIRST', () => {
  // `if (!flatsDict.ContainsKey(flatID)) Add(...)` - a plain
  // assignment would let the LAST definition win.
  const f = new FlatsFile().load([
    block(182, 4, 'young lady in green', '2', 0, 0, 12),
    block(182, 4, 'a later duplicate', '1', 0, 0, 99),
    block(334, 7, 'town guard', '1', 0, 0, 3),
  ].join('\n\n'));
  assert.equal(f.count, 2);
  assert.equal(f.caption(182, 4), 'young lady in green', 'the FIRST block wins');
  assert.equal(f.faceIndex(182, 4), 12);
  assert.equal(f.caption(334, 7), 'town guard');
  // a flat that is not in the file answers nothing, not undefined
  assert.equal(f.getFlatData(999, 0), null);
  assert.equal(f.caption(999, 0), null);
  assert.equal(f.faceIndex(999, 0), -1);
});

test('FLATS: a line of SPACES is not a block separator (kept as written)', () => {
  // IsNullOrEmpty runs on the RAW line and the Trim happens after, so
  // a whitespace-only line joins the block as an empty string and
  // shifts every field below it. DFU's behaviour; reproduced because a
  // "tidier" reader would parse a different file than classic does.
  const txt = `182 4\nyoung lady in green\n2\n0\n0\n12\n   \n334 7\ntown guard\n1\n0\n0\n3`;
  const f = new FlatsFile().load(txt);
  // one block, not two: the spaces did NOT split it
  assert.equal(f.count, 1);
  assert.equal(f.caption(182, 4), 'young lady in green');
  // and a REAL blank line does split it
  const g = new FlatsFile().load(txt.replace('   \n', '\n'));
  assert.equal(g.count, 2);
});

test('FLATS: the filename guard is a silent no-op, and CRLF parses', () => {
  // Load(): a path that does not end in FLATS.CFG returns without
  // touching the dictionary - it is not an error.
  const f = new FlatsFile().load(block(182, 4, 'x', '2', 0, 0, 12), 'FACTION.TXT');
  assert.equal(f.count, 0);
  // the real file ships with DOS line endings
  const g = new FlatsFile().load(block(182, 4, 'x', '2', 0, 0, 12).replace(/\n/g, '\r\n'));
  assert.equal(g.faceIndex(182, 4), 12);
});

test('FLATS: a malformed block THROWS rather than travelling as NaN', () => {
  // int.Parse throws; Number() would answer NaN, and a NaN face index
  // travels silently and picks a portrait at random.
  assert.throws(() => new FlatsFile().load('182 4 5\ncap\n2\n0\n0\n12'), /Invalid flat format/);
  assert.throws(() => new FlatsFile().load('182 4\ncap\n2\n0\n0'), /expected 6/);
  assert.throws(() => new FlatsFile().load(block(182, 4, 'cap', '2', 0, 0, 'x')), /not an integer/);
});

test('FLATS: gender reads through the ChildGard "?" mark', () => {
  // "values are 1 for male, 2 for female. If preceded by a '?', in
  // classic the flat would be censored in ChildGard mode." ChildGard
  // is not ported, so the port reads the gender through the mark
  // rather than dropping the flat - but it can still SEE the mark.
  assert.equal(flatGender('1'), 'male');
  assert.equal(flatGender('2'), 'female');
  assert.equal(flatGender('?2'), 'female');
  assert.equal(flatCensored('?2'), true);
  assert.equal(flatCensored('2'), false);
  assert.equal(flatGender('0'), null, 'anything else is neither');
  assert.equal(flatGender(undefined), null);
});

test('FLATS: the real FLATS.CFG parses whole', { skip: skipReal }, () => {
  const f = new FlatsFile().load(new Uint8Array(readFileSync(join(ARENA2, 'FLATS.CFG'))));
  assert.ok(f.count > 100, `parsed ${f.count} flats`);
  for (const [id, flat] of f.flats) {
    assert.equal(id, flatId(flat.archive, flat.record));
    assert.ok(flat.record >= 0 && flat.record <= 127, `record ${flat.record} fits seven bits`);
    assert.equal(typeof flat.caption, 'string');
    assert.ok(Number.isInteger(flat.faceIndex));
    // the face index is an index into TFAC00I0.RCI, which the port
    // reads as exactly 503 records
    assert.ok(flat.faceIndex >= -1 && flat.faceIndex < 503, `face ${flat.faceIndex} is in TFAC range`);
  }
});
