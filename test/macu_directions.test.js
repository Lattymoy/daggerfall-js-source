// MAC-U (2026-09-18, Mac, with the screenshot): "any directions I get look like two messages at once, like it
// changes mid-sentence" - "It's really easy. You'll want to go The Greensley Residence is south of where we're
// standing." / "You'll find it The Greensley Residence is a ways south of here."
//
// THE DATA, NOT THE CODE. The answer frames (TEXT.RSC 7270-7274, 7285-7289) each carry their own subject and end
// in %hnt - "You'll want to go %hnt.", "Sure. %key is %hnt." - and %hnt is GetKeySubjectBuildingHint's 7333 draw.
// Classic's 7333 is nine whole sentences ("%loc is %di of here"), so classic fused them too. Daggerfall Unity reads
// its Internal_RSC string table BEFORE the file (TextProvider.cs:167-188) and its table trims 7333 to the phrase
// the frames expect ("%di of here"). The port now carries that row (src/formats/rscTable.js) and TextRsc reads it
// first, in DFU's order.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TextRsc, RSC, encodeRscRecord, rscTableBytes } from '../src/formats/textRsc.js';
import { INTERNAL_RSC, parseRscMarkup, parseRscCsv } from '../src/formats/rscTable.js';
import { expandRandomTextRecord } from '../src/systems/talkMacros.js';
import { AnswerPipeline } from '../src/systems/answerPipeline.js';
import { QUESTION_TYPE } from '../src/systems/topicTree.js';
import { expandAnswerRecord } from '../src/systems/talkSession.js';
import { DIRECTION_TEXT_ID } from '../src/systems/talkTopics.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

/** A TEXT.RSC in memory: { id: [variants] } in the file's own layout (the header's record table, then the bytes). */
function buildRsc(records) {
  const ids = Object.keys(records).map(Number);
  const headerLength = (ids.length + 1) * 6;
  const bodies = ids.map((id) => encodeRscRecord(records[id]));
  const total = 2 + ids.length * 6 + bodies.reduce((n, b) => n + b.length, 0);
  const bytes = new Uint8Array(total);
  const v = new DataView(bytes.buffer);
  v.setUint16(0, headerLength, true);
  let o = 2, off = 2 + ids.length * 6;
  ids.forEach((id, i) => {
    v.setUint16(o, id, true); v.setUint32(o + 2, off, true); o += 6;
    bytes.set(bodies[i], off); off += bodies[i].length;
  });
  return bytes;
}

/** Classic's 7333, as the shipped TEXT.RSC carries it (the shape the T4 probe printed: "Vintage Elixirs is a ways
 *  south of here"). Two variants stand in for the nine. */
const CLASSIC_7333 = ['%loc is %di of here', "%loc is %di of where we're standing"];
const FRAMES_7271 = ["It's really easy. You'll want to go %hnt.", 'I guess I can tell ya it\'s %hnt.'];
const BYTES = buildRsc({ 7271: FRAMES_7271, 7332: ['... Let me just mark %loc here on your map'], 7333: CLASSIC_7333 });

test('MAC-U: the carried 7333 row is DFU\'s Internal_RSC row, verbatim - nine compass phrases, none naming the building', () => {
  const csv = parseRscCsv(rd('vendor/dfu-text/Internal_RSC.csv'));
  assert.deepEqual(INTERNAL_RSC[DIRECTION_TEXT_ID], parseRscMarkup(csv.get(DIRECTION_TEXT_ID)),
    'the row in code is the vendored table\'s row');
  const rows = INTERNAL_RSC[7333];
  assert.equal(rows.length, 9);
  assert.ok(rows.every((r) => r.includes('%di')), 'every variant is a compass phrase');
  assert.ok(rows.every((r) => !r.includes('%loc') && !r.includes('%key')), 'no variant names the building - the frame does');
  // the importer's markup, read as plain text: a literal newline is stripped, [/record] splits, [/end] closes,
  // the three break markups are the break byte, a prefixed markup carries nothing
  assert.deepEqual(parseRscMarkup('a\nb[/record]\nc[/center]d[/pos:x=20,y=0]e[/end]\n'), ['ab', 'c\nde']);
  // and 7332 (the reveal) is the same in both, so it is NOT carried: the file's own row stands
  assert.equal(parseRscMarkup(csv.get(7332)).length, 7);
  assert.equal(INTERNAL_RSC[7332], undefined);
});

test('MAC-U: TextRsc reads a table row before the file, in the file\'s own byte shape - every reader sees one kind of record', () => {
  const rsc = new TextRsc().load(BYTES);
  assert.deepEqual(rsc.plainText(7333), [...INTERNAL_RSC[7333]], 'plainText answers the table, not the classic bytes');
  assert.equal(rsc.variantCount(7333), 9);
  assert.equal(rsc.variantTokensById(7333, () => 0.15).map((t) => t.text).join(''), "%di of where we're standing");
  assert.deepEqual(rsc.linesById(7333).map((r) => r.text), ['%di of here']);
  assert.equal(rsc.hasRecord(7333), true);
  // a record the table does not carry reads from the file
  assert.deepEqual(rsc.plainText(7332), ['... Let me just mark %loc here on your map']);
  assert.deepEqual(rsc.plainText(7271), FRAMES_7271);
  // a table row the file lacks entirely still answers (DFU: the table is asked first, the file only for a miss)
  const bare = new TextRsc().load(buildRsc({ 7271: FRAMES_7271 }));
  assert.equal(bare.hasRecord(7333), true);
  assert.equal(bare.plainText(7333).length, 9);
  // { table: null } is the classic file alone - what a test that measures classic bytes asks for
  const classic = new TextRsc().load(BYTES, { table: null });
  assert.deepEqual(classic.plainText(7333), CLASSIC_7333);
  assert.equal(classic.hasRecord(7333), true);
  // the encoder: NewLine for a break, SubrecordSeparator between variants, EndOfRecord last, '?' outside the file's range
  assert.deepEqual([...encodeRscRecord(['a\nb', 'cé'])], [0x61, RSC.NewLine, 0x62, RSC.SubrecordSeparator, 0x63, 0x3f, RSC.EndOfRecord]);
  assert.equal(rscTableBytes(null).size, 0);
  assert.equal(rscTableBytes().get(7333).at(-1), RSC.EndOfRecord);
});

/** The live chain: the answer pipeline (GetAnswerWhereIs's frame, %hnt -> GetKeySubjectBuildingHint -> 7333, %di ->
 *  the compass, %loc -> the key subject) over the talk MCP, on the given TEXT.RSC. */
function spoken(rsc, { frame = 0, hint = 0.15 } = {}) {
  const ctx = {};
  const pipeline = new AnswerPipeline({
    expandRandomTextRecord: (id) => expandRandomTextRecord(id, ctx),
    rolls: () => 0.99,   // above the 0.35 reveal chance: the direction arm
    buildingCompassDirection: () => 'south',
    isPlayerInside: () => false,
  });
  pipeline.currentQuestionListItem = { questionType: QUESTION_TYPE.LocalBuilding, questID: 0, key: '' };
  pipeline.currentKeySubject = 'The Greensley Residence';
  pipeline.currentKeySubjectType = 'Building';
  ctx.pipeline = pipeline;
  ctx.randomTokens = (id) => rsc.variantTokensById(id, () => (id === 7271 ? frame / FRAMES_7271.length + 0.01 : hint));
  return expandRandomTextRecord(7271, ctx);
}

test('MAC-U: the classic talk box speaks one sentence - the frame names the building, the hint gives the way', () => {
  const rsc = new TextRsc().load(BYTES);
  assert.equal(spoken(rsc), "It's really easy. You'll want to go south of where we're standing.");
  assert.equal(spoken(rsc, { frame: 1, hint: 0.01 }), "I guess I can tell ya it's south of here.");
  assert.equal(spoken(rsc, { hint: 0.25 }), "It's really easy. You'll want to go that way, just keep going south.");
  // the counter-example, held by name: the classic bytes alone fuse two sentences (Mac's screenshot)
  const classic = new TextRsc().load(BYTES, { table: null });
  assert.equal(spoken(classic), "It's really easy. You'll want to go The Greensley Residence is south of here.");
});

test('MAC-U: townTalk\'s own chain (the mobile townsperson) and its no-data fallback speak the phrase, not the sentence', () => {
  assert.equal(expandAnswerRecord("You'll want to go %hnt.", { hint: 'south of here' }), "You'll want to go south of here.");
  assert.equal(expandAnswerRecord('Sure. %key is %hnt.', { hint: 'a way south of here', key: 'The Greensley Residence' }),
    'Sure. The Greensley Residence is a way south of here.');
  const src = rd('src/scenes/townTalk.js');
  assert.match(src, /h\.reveal \? '\.\.\. Let me just mark %loc here on your map' : '%di of here'\)/,
    'the direction fallback is the table\'s phrase');
  assert.doesNotMatch(src, /'%loc is %di of here'/, 'the classic sentence is gone from the fallback');
});

test('MAC-U: by source - the reader asks the table first, and the default table is the carried rows', () => {
  const src = rd('src/formats/textRsc.js');
  assert.match(src, /load\(bytes, \{ table = INTERNAL_RSC \} = \{\}\)/, 'load defaults to DFU\'s rows');
  assert.match(src, /this\._table = rscTableBytes\(table\);/);
  assert.match(src, /bytesById\(id\) \{\n\s+const row = this\._table\.get\(id\);\n\s+if \(row\) return row;/, 'bytesById reads the table before the file');
  assert.match(src, /hasRecord\(id\) \{ return this\._table\.has\(id\) \|\| this\._byId\.has\(id\); \}/);
  assert.doesNotMatch(rd('src/formats/rscTable.js'), /^import /m, 'the table is data with no imports (no cycle with the reader)');
});
