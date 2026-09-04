// ---------------------------------------------------------------------------
// CD - THE CITATION IS PART OF THE CLAIM (ROAD-E fix-D, 2026-09-02).
//
// Wave E's review found the same defect four times over, and every
// instance was a POINTER rather than a behaviour: a comment, a status
// page or a test header naming a line that had been exact one commit
// earlier and named a stranger at the merge.
//
//   - `ui/spellMakerWindow.js` declared "RECORDED DEPARTURES" and closed
//     the first with "Ledger A carries the widget row already
//     (Port-Ledger.md:701)". Section A carried no widget row at all -
//     the AUDIT 17m / F7 shape, a claim of approval standing in for one -
//     and :686 was the stat-colour NIT row by then. The row exists now
//     (Ledger A, TB1) and the sites cite it BY NAME.
//   - `Road-To-1-1.md` and `Port-Status-2026-09-02.md` both said the
//     wave left 17 open flags, one of them as the falsifiable claim
//     that "`regenOpenFlags --check` now answers 17". Six lanes each
//     retired a flag against their own 19-row base and none could see
//     the others; the tool answers 13.
//   - every Port-Ledger row identifier in Port-Status section 2 moved
//     when the wave inserted two rows above section C, so fourteen
//     `:NNN` cites named unrelated rows, as did the section's own bounds.
//   - three in-range comments and two test headers cited sibling-lane
//     files at lines those lanes had just moved.
//
// A line number is a claim like any other, and the only durable answer
// is to make it CHECKABLE: each pin below reads the citation out of the
// document that makes it and resolves it against the file it names. Bump
// any one of them by a line and the suite goes red at the citation, not
// three waves later at a reader.
// ---------------------------------------------------------------------------
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const lines = (rel) => read(rel).split('\n');

const LEDGER = 'bible/01-Overview/Port-Ledger.md';
const STATUS = 'bible/01-Overview/Port-Status-2026-09-02.md';
const ROAD = 'bible/01-Overview/Road-To-1-1.md';

/** The Ledger's line N, 1-based, as the citations write it. */
const ledgerLine = (n) => lines(LEDGER)[n - 1] ?? '';

/** A heading's line number, 1-based. */
function headingLine(rel, heading) {
  const at = lines(rel).findIndex((l) => l.startsWith(heading));
  assert.notEqual(at, -1, `${rel} has no heading ${heading}`);
  return at + 1;
}

/** Table rows in a line range: the doc's own `awk '/^\|/ && !/^\|---/'`. */
function tableRows(lo, hi) {
  const L = lines(LEDGER);
  const out = [];
  for (let n = lo; n <= hi; n++) {
    const s = L[n - 1];
    if (/^\|/.test(s) && !/^\|---/.test(s)) out.push({ n, s });
  }
  return out;
}
const struck = (s) => /^\|\s*(\*\*)?~~/.test(s);

// ═══ CD1: the spell maker's declared departure has a row that EXISTS ═══
test('CD1: Ledger A row TB1 exists, in section A, and names the windows that cite it', () => {
  const aStart = headingLine(LEDGER, '## A. Approved departures from DFU');
  const aEnd = headingLine(LEDGER, '## A-note (H1)');
  const rows = tableRows(aStart, aEnd).filter((r) => !/^\| What \|/.test(r.s));
  const tb1 = rows.filter((r) => /^\| TB1:/.test(r.s));
  assert.equal(tb1.length, 1, 'section A carries exactly one TB1 row');

  // The row must be about the thing the sites say it is about, and it
  // must NAME them - the doctrine gate reads the Ledger for the file,
  // and "the Ledger mentions this basename somewhere" was satisfied
  // vacuously by a STRUCK section-C row when this defect shipped.
  const row = tb1[0].s;
  assert.match(row, /DaggerfallInputMessageBox/);
  for (const f of ['src/ui/spellMakerWindow.js', 'src/ui/itemMakerWindow.js',
    'src/ui/spellbookWindow.js', 'src/ui/travelMapWindow.js', 'src/ui/automapWindow.js']) {
    assert.ok(row.includes(f), `Ledger A row TB1 does not name ${f}`);
  }

  // ...and the two sites that declare the departure cite it BY NAME, with
  // no bare Ledger line number left to rot.
  for (const f of ['src/ui/spellMakerWindow.js', 'src/ui/itemMakerWindow.js']) {
    const text = read(f);
    // Comments WRAP - flagsweep.js learned the same lesson - so the
    // citation is read off the unwrapped prose, not off one line.
    const flat = text.replace(/^\s*(\/\/|\*)\s?/gm, '').replace(/\s+/g, ' ');
    assert.match(flat, /Ledger A row TB1/, `${f} does not cite the row by name`);
    assert.equal(/Port-Ledger\.md:\d+/.test(text), false,
      `${f} still cites the Ledger by line number, which is what rotted`);
  }

  // ...and the gate that should have caught the missing row can SEE this
  // file. `\bDEPARTURE\b` is false on "RECORDED DEPARTURES" - the plural
  // is how the claim got past test/doctrine.test.js for a whole wave -
  // so the trailing S is pinned here the way EE0 pins the render gate's
  // own line: as the text of the guard, because the guard's population
  // is otherwise invisible from outside it.
  assert.match(read('test/doctrine.test.js'), /!\/\\bDEPARTURES\?\\b\/\.test\(text\)/,
    'the doctrine gate no longer scans the PLURAL departure shout');

  // AUDIT 58 (records): the SAME shape, found again in a file the
  // doctrine gate cannot see. `ui/pauseWindow.js` drew the port's build
  // tag where DaggerfallPauseOptionsWindow.cs draws VersionInfo, and
  // closed the sentence with "(Ledger A: VersionInfo strings are DFU's
  // identity, not this port's)" - a live departure claiming an approval
  // nobody had written: section A carried no version row at all, and
  // doctrine.test.js:238 skips the file because it shouts no DEPARTURE
  // token. The row exists now and, like TB1, is cited BY NAME.
  const verRows = rows.filter((r) => /THE PAUSE WINDOW'S VERSION LINE IS THE PORT'S OWN BUILD TAG/.test(r.s));
  assert.equal(verRows.length, 1, 'section A carries exactly one pause-window version row');
  for (const f of ['src/ui/pauseWindow.js', 'src/buildTag.js']) {
    assert.ok(verRows[0].s.includes(f), `the version row does not name ${f}`);
  }
  const pause = read('src/ui/pauseWindow.js');
  const pauseFlat = pause.replace(/^\s*(\/\/|\*)\s?/gm, '').replace(/\s+/g, ' ');
  assert.match(pauseFlat, /Ledger A carries it as THE PAUSE WINDOW'S VERSION LINE IS THE PORT'S OWN BUILD TAG/,
    'pauseWindow.js does not cite the version row by name');
  assert.equal(/Port-Ledger\.md:\d+/.test(pause), false,
    'pauseWindow.js cites the Ledger by line number, which is what rots');
  // ...and the departure it describes is still LIVE, or the row is the lie.
  assert.match(pause, /import \{ BUILD_TAG \} from '\.\.\/buildTag\.js';/,
    'the version line no longer draws the port build tag - re-read the Ledger row before editing this');
  assert.match(pause, /const ver = `project-dagger \$\{BUILD_TAG\}`;/,
    'the substituted string is not the one the Ledger row records');

  // AUDIT 58 (seams): THE SAME SHAPE, EIGHT MORE TIMES. `grep` over
  // section A for each of these basenames returned nothing while every
  // one of them declared its departure ALREADY RECORDED; the doctrine
  // gate reported approval because a STRUCK section-C row mentioned the
  // basename somewhere on the page. Each row below now exists, unstruck,
  // inside section A, names the file it approves, and is cited BY NAME
  // from that file - no bare Ledger line number left to rot. The gate
  // that would have caught all eight is pinned as text in
  // test/doctrine.test.js, the way the plural shout is pinned above.
  const SEAMS = [
    [/THE MUSIC REPLACEMENT FOLDER IS A USER PICK, AND ITS EXTENSIONS ARE A SET/,
      ['src/systems/musicReplacement.js']],
    [/THE FUZZY FIND COMPUTES IN DOUBLES AND COLLATES ORDINALLY/,
      ['src/systems/editDistance.js']],
    [/TRAVEL WEATHER IS APPLIED ON EVERY ARRIVAL, NOT FROZEN AFTER THE FIRST LOAD/,
      ['src/systems/weatherSim.js']],
    [/THE CONVERSATION SAVE STORES `dictQuestInfo` AS PLAIN DATA/,
      ['src/systems/topicTree.js']],
    [/THE COLOR PICKER'S FOUR HOST SEAMS/, ['src/ui/colorPicker.js']],
    [/ART LANDS ASYNC, AND A MISSING RECORD COSTS THE PICTURE RATHER THAN THE SESSION/,
      ['src/ui/hudEscortFaces.js', 'src/ui/nativeTalk.js']],
    [/THE TOWN MAP'S PLATE LABEL AND ROTATION ARROW ARE THE PORT'S OWN PIXELS/,
      ['src/ui/exteriorAutomapWindow.js']],
    [/E ACTIVATES BESIDE MOUSE0, AND THE SWING IS ROUTED OFF THE RAW BUTTON/,
      ['src/ui/input.js']],
  ];
  for (const [title, files] of SEAMS) {
    const hit = rows.filter((r) => title.test(r.s) && !struck(r.s));
    assert.equal(hit.length, 1, `section A carries exactly one unstruck row for ${title}`);
    for (const f of files) {
      assert.ok(hit[0].s.includes(f), `the ${title} row does not name ${f}`);
      const flat = read(f).replace(/^\s*(\/\/|\*)\s?/gm, '').replace(/\s+/g, ' ');
      assert.match(flat, new RegExp(title.source),
        `${f} does not cite its Ledger A row by name`);
      assert.equal(/Port-Ledger\.md:\d+/.test(read(f)), false,
        `${f} cites the Ledger by line number, which is what rots`);
    }
  }

  // ...and the AUDIT 58 gate itself, pinned as TEXT for the same reason
  // the plural shout is: its population is invisible from outside it, so
  // a later edit that drops the strike filter, drops the section bound,
  // or widens the search back to the whole page has to go red HERE
  // rather than three waves later at a reader.
  const gate = read('test/doctrine.test.js');
  assert.match(gate, /const A_BOUNDS = \['## A\. Approved departures from DFU', '## A-note \(H1\)'\];/,
    'the AUDIT 58 gate no longer bounds its search to section A');
  assert.match(gate, /\.filter\(\(l\) => !\/\^\\\|\\s\*\(\\\*\\\*\)\?~~\/\.test\(l\)\)/,
    'the AUDIT 58 gate no longer filters STRUCK rows out - a struck row is not an approval');
  assert.match(gate, /const RECORDED_CLAIM =/,
    'the AUDIT 58 gate no longer recognises a RECORDED-departure claim');

  // Port-Status counts section A; the count moves when a row is added.
  const m = /section A carries \*\*(\d+) rows, (\d+) struck - (\d+) standing/.exec(read(STATUS));
  assert.ok(m, 'Port-Status no longer states section A\'s tally');
  assert.equal(Number(m[1]), rows.length, 'Port-Status\' section A row count drifted');
  assert.equal(Number(m[2]), rows.filter((r) => struck(r.s)).length, 'section A struck count drifted');
  assert.equal(Number(m[3]), rows.length - rows.filter((r) => struck(r.s)).length,
    'section A standing count is not rows minus struck');

  // AUDIT 58 R1 (f): ...and the ORDINALS in the same sentence, which the
  // three digits above never touched. Every row this table had ever
  // gained was APPENDED, so "the Nth is X" and "N rows" moved together
  // and the arithmetic hid the difference; AUDIT 58 F5 inserted a row at
  // position 2 and the sentence went two ways wrong at once - WIND1 was
  // still called the 65th when it had become the 66th, and the new row
  // was given the end-of-table ordinal of a row it had pushed down.
  const ORDINALS = [[/\(the (\d+)(?:st|nd|rd|th) is WIND1/, /THE WIND \(WIND1/],
    [/the (\d+)(?:st|nd|rd|th) is the re-integrated road system/, /^\| \*\*ROADS 22-25/]];
  for (const [pick, anchor] of ORDINALS) {
    const hit = pick.exec(read(STATUS));
    assert.ok(hit, `Port-Status' section A tally no longer states ${anchor}'s ordinal`);
    const at = rows[Number(hit[1]) - 1];
    assert.ok(at, `the stated ordinal ${hit[1]} is past the end of section A`);
    assert.match(at.s, anchor, `section A row ${hit[1]} is not the row the tally calls it`);
  }
});

// ═══ CD2: the open-flag count is the tool's, in every page that states it ═══
test('CD2: both status pages state the open-flag count Home.md actually holds', () => {
  // The list is regenerated by tools/regenOpenFlags.mjs and pinned
  // entry-for-entry by test/audit18_bible_docs.test.js; what is pinned
  // here is only that the PROSE agrees with it. Six lanes each retired a
  // flag against a 19-row base, each wrote "leaving 17", and the squash
  // made all three sentences false at once.
  const home = lines('bible/Home.md');
  const at = home.findIndex((l) => l.startsWith('## Open flags'));
  assert.notEqual(at, -1, 'Home.md has no "## Open flags" heading');
  let count = 0;
  for (let i = at + 1; i < home.length; i++) {
    if (/^#{1,2} /.test(home[i])) break;
    if (/^- `src\/.+:\d+` - /.test(home[i])) count++;
  }
  assert.ok(count > 0, 'the open-flag list is empty - the parser missed it');

  const road = /That leaves \*\*(\d+)\*\* open flags/.exec(read(ROAD));
  assert.ok(road, 'Road-To-1-1.md no longer states the open-flag count');
  assert.equal(Number(road[1]), count, 'Road-To-1-1.md\'s open-flag count drifted from Home.md');

  const stated = [...read(STATUS).matchAll(/regenOpenFlags\.mjs --check` answers (\d+)/g)]
    .map((m) => Number(m[1]));
  assert.ok(stated.length >= 2, 'Port-Status no longer states what the tool answers');
  for (const n of stated) assert.equal(n, count, 'a Port-Status count drifted from Home.md');

  // AUDIT 58 (records): the two "answers N" sentences were the only
  // thing pinned here, so Port-Status went on stating THREE other
  // current figures in prose the gate never read - "(10 after Wave E's
  // seven closures and QX1's eighth)" at the head, "twelve sites and
  // six rows" in the one-sentence version, and a list-1 heading that
  // said TWELVE STAND over a list whose own arithmetic paragraph said
  // seven. Prose is a count like any other, so the PROSE is pinned:
  // every figure below is read out of the page and compared with the
  // list Home.md actually holds.
  const WORDS = { seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
    thirteen: 13, fourteen: 14, seventeen: 17, nineteen: 19 };
  const statusText = read(STATUS);
  const prose = [
    [/(\d+) stand after Wave E/, 'the head paragraph\'s "N stand" figure'],
    [/worked that list down to \*\*(\w+) sites/, 'the one-sentence version\'s site count'],
    [/## 1\. The nineteen open flags this was measured over - (\w+) STAND/, 'the list-1 heading'],
    [/\*\*(\w+) sites carry a blocker\*\*/, 'the Overall section\'s blocker count'],
  ];
  for (const [pick, what] of prose) {
    const hit = pick.exec(statusText);
    assert.ok(hit, `Port-Status no longer states ${what}`);
    const n = /^\d+$/.test(hit[1]) ? Number(hit[1]) : WORDS[hit[1].toLowerCase()];
    assert.ok(n !== undefined, `${what} is written as "${hit[1]}", which this pin cannot read as a number`);
    assert.equal(n, count, `${what} drifted from Home.md's open-flag list`);
  }

  // ...and the LIST ITSELF, which is what a reader counts. A closure
  // that strikes nothing leaves a live-sounding row behind, and the
  // heading above cannot see it: three entries stood as blocked in
  // list 1 while the same page struck them in section 2.
  const doc = lines(STATUS);
  const lo = doc.findIndex((l) => l.startsWith('## 1. The nineteen open flags'));
  const hi = doc.findIndex((l) => l.startsWith('## 2. '));
  assert.ok(lo > 0 && hi > lo, 'Port-Status list 1 not found');
  const body = doc.slice(lo, hi);
  // One bullet may name two SITES (playerTorch's pair, "**`:12`** and
  // **`:51`**"), and the list is a list of sites, so sites are what is
  // counted: the bullet's own line plus its continuation.
  let sites = 0;
  body.forEach((l, i) => {
    if (!/^- \*\*`src\//.test(l)) return;
    sites += `${l}\n${body[i + 1] ?? ''}`.split('**`src/').length - 1;
  });
  assert.equal(sites, count,
    `list 1 carries ${sites} unstruck sites against Home.md's ${count} - a closure struck nothing`);

  // ...and the wave's six closures are NAMED, because "leaving 17" was
  // readable only as long as nobody asked which two.
  const roadText = read(ROAD);
  for (const site of ['combat/fpsSpellCasting.js:178', 'characters/enemyCasting.js:91',
    'systems/inventory.js:48', 'systems/talkMacros.js:268', 'ui/hudLarge.js:75',
    'ui/exteriorAutomapWindow.js:96']) {
    assert.ok(roadText.includes(site), `Road-To-1-1.md does not name the retired flag ${site}`);
  }
});

// ═══ CD3: every Ledger row Port-Status cites by line still IS that row ═══
const SECTION_2_ROWS = [
  [1, /FaceUVTool's 1,803-UV residual/],
  [2, /HIDDEN ResetBonusPool control/],
  [3, /ListBox SELECTS on the first click/],
  [4, /THE QUEST MACHINE/],
  [5, /THE CLASSIC `\.SAV` READER/],
  [6, /THE KEYBINDING REGISTRY/],
  [7, /THE STANDALONE DUNGEON HOST HAS NO TRADE WINDOW/],
  [8, /THREE PROBES THE T2 SWEEP FOUND STALE/],
  [9, /UseItem's UNBUILT DESTINATIONS/],
  [10, /FAST TRAVEL residue/],
  [11, /PatchRegionIndex legacy-save fix/],
  [12, /THE MAGIC CRAFTING WINDOWS/],
  [13, /THE TALK MANAGER/],
  [14, /Biography GP arm ledger note/],
];

test('CD3: Port-Status section 2 row identifiers resolve to the rows they describe', () => {
  const doc = lines(STATUS);
  const from = doc.findIndex((l) => l.startsWith('## 2. Port-Ledger section C'));
  const to = doc.findIndex((l) => l.startsWith('## 3. '));
  assert.ok(from > 0 && to > from, 'Port-Status section 2 not found');
  const body = doc.slice(from, to);

  const cited = new Map();
  for (const l of body) {
    const m = /^(\d+)\. .*?`:(\d+)`/.exec(l);
    if (m) cited.set(Number(m[1]), Number(m[2]));
  }
  assert.equal(cited.size, SECTION_2_ROWS.length,
    `section 2 lists ${cited.size} numbered rows, the pin knows ${SECTION_2_ROWS.length}`);

  const wrong = [];
  for (const [item, anchor] of SECTION_2_ROWS) {
    const n = cited.get(item);
    assert.ok(n, `section 2 item ${item} carries no row identifier`);
    if (!anchor.test(ledgerLine(n))) {
      wrong.push(`item ${item} -> Port-Ledger.md:${n} is ${JSON.stringify(ledgerLine(n).slice(0, 70))}`);
    }
  }
  assert.deepEqual(wrong, [], 'a section-2 identifier names a row it does not describe');

  // the two cites that live outside the numbered list
  const text = read(STATUS);
  const pending = /plus `:(\d+)`, struck at its head/.exec(text);
  assert.ok(pending, 'section 2 no longer names the struck-with-a-live-clause row');
  assert.match(ledgerLine(Number(pending[1])), /THE KEYBINDING REGISTRY/);
  for (const m of text.matchAll(/(?:rides row|are ledger row) `:(\d+)`/g)) {
    assert.match(ledgerLine(Number(m[1])), /FaceUVTool's 1,803-UV residual/,
      'a loose FaceUVTool row cite names another row');
  }

  // AUDIT 58 (records): the PROSE form, which nothing read. Three
  // "Ledger row NNN" cites outside the numbered list were stale by the
  // same six lines section 2 was re-resolved for and this pin never
  // saw, because they carry no backtick-colon shape - "Ledger row
  // 574's adjudication" landed on the vampirism row, "row 562's" on
  // RespawnPlayer, "row 511's" on quest monster names. They are
  // written in section 2's own `:NNN` idiom now, and resolved here.
  const PROSE_ROWS = [
    [/Ledger row `:(\d+)`'?s? one residue is the phone path/, /THE CLASSIC `\.SAV` READER/],
    [/Ledger row `:(\d+)`'?s residue list is spent/, /FAST TRAVEL residue/],
  ];
  for (const [pick, anchor] of PROSE_ROWS) {
    const hit = pick.exec(text);
    assert.ok(hit, `Port-Status no longer carries the prose row cite ${anchor}`);
    assert.match(ledgerLine(Number(hit[1])), anchor, 'a prose "Ledger row" cite names another row');
  }
  const dungeonCites = [...text.matchAll(/Ledger row `:(\d+)`(?:'s adjudication|\. The two WINDOWS)/g)];
  assert.equal(dungeonCites.length, 2, 'the standalone-dungeon adjudication is no longer cited twice');
  for (const m of dungeonCites) {
    assert.match(ledgerLine(Number(m[1])), /THE STANDALONE DUNGEON HOST HAS NO TRADE WINDOW/,
      'the standalone-dungeon adjudication cites another row');
  }

  // ...and the section's own bounds and tallies, which drifted with them
  const b = /Section C's table is \*\*(\d+) rows\*\* between `Port-Ledger\.md:(\d+)` and\s*`:(\d+)`/.exec(text);
  assert.ok(b, 'section 2 no longer states section C\'s bounds');
  const [stated, lo, hi] = [Number(b[1]), Number(b[2]), Number(b[3])];
  const cEnd = headingLine(LEDGER, '## D. THE BOARD');
  const rows = tableRows(lo, hi);
  assert.equal(rows.length, stated, 'section C\'s stated row count drifted');
  assert.equal(lo, tableRows(headingLine(LEDGER, '## C. DFU features'), cEnd)
    .find((r) => r.n > lo - 2 && !/^\| Feature \|/.test(r.s)).n, 'the low bound is not a table row');
  assert.match(ledgerLine(hi), /^\|/, 'the high bound is not a table row');
  assert.equal(/^\|/.test(ledgerLine(hi + 1)), false, 'the high bound is not section C\'s LAST row');

  const s = /\*\*(\d+) are struck\.\*\* Of the (\d+) that/.exec(text);
  assert.ok(s, 'section 2 no longer states the struck tally');
  const isStruck = rows.filter((r) => struck(r.s)).length;
  assert.equal(Number(s[1]), isStruck, 'section C\'s struck count drifted');
  assert.equal(Number(s[2]), rows.length - isStruck, 'the unstruck count is not rows minus struck');
});

// ═══ CD4: the in-source citations the wave invalidated resolve again ═══
/** `<file> ... :<line>` cited from a comment, and what must be on it. */
const SOURCE_CITES = [
  ['src/systems/quest/questMacros.js', /ui\/travelMapWindow\.js:(\d+) after it\)/,
    'src/ui/travelMapWindow.js', /\.replace\('%tcn', name\)/],
  ['tools/toneProbe.mjs', /`native` \(townTalk\.js:(\d+), true only/,
    'src/scenes/townTalk.js', /native: !!overlay\?\.conversation/],
  ['tools/worldWhereIsProbe.mjs', /townTalk's live slot \(townTalk\.js:(\d+)\)/,
    'src/scenes/townTalk.js', /overlay: !!overlay/],
];

test('CD4: every citation Wave E moved names the line it means', () => {
  const bad = [];
  for (const [from, pick, target, want] of SOURCE_CITES) {
    const m = pick.exec(read(from));
    assert.ok(m, `${from} no longer carries the citation this pins`);
    const line = lines(target)[Number(m[1]) - 1] ?? '';
    if (!want.test(line)) bad.push(`${from} -> ${target}:${m[1]} is ${JSON.stringify(line.slice(0, 60))}`);
  }
  assert.deepEqual(bad, [], 'a comment cites a line that is no longer what it claims');

  // The Ledger row that shipped the two ported probes says they are
  // "verified against the SEAMS they read - each named with its live
  // line". That sentence is only true while the range resolves.
  const probes = lines(LEDGER).find((l) => /THREE PROBES THE T2 SWEEP FOUND STALE/.test(l));
  assert.ok(probes, 'the THREE PROBES row is gone');
  const r = /scenes\/townTalk\.js:(\d+)-(\d+)/.exec(probes);
  assert.ok(r, 'the THREE PROBES row no longer names townTalk\'s seam');
  const seam = lines('src/scenes/townTalk.js').slice(Number(r[1]) - 1, Number(r[2])).join('\n');
  assert.match(seam, /overlay: !!overlay/, 'the row\'s townTalk range misses the overlay slot');
  assert.match(seam, /native: !!overlay\?\.conversation/, 'the row\'s townTalk range misses the native slot');
});

// ═══ CD5: every `Port-Ledger.md:NNN` cite in the tree resolves ═══
const LEDGER_CITES = [
  // file, then the row each `Port-Ledger.md:NNN` in it means, in order
  ['src/systems/passiveSpecials.js', [/ENCHANTING, WHOLE/]],
  ['test/faceuvresidue.test.js', [/FaceUVTool's 1,803-UV residual/]],
  ['test/probehygiene.test.js', [/THREE PROBES THE T2 SWEEP FOUND STALE/]],
  ['bible/09-Testing/Testing.md', [/THREE PROBES THE T2 SWEEP FOUND STALE/,
    /FaceUVTool's 1,803-UV residual/]],
];

test('CD5: a `Port-Ledger.md:NNN` cite anywhere in the tree lands on its own row', () => {
  const bad = [];
  for (const [file, anchors] of LEDGER_CITES) {
    const hits = [...read(file).matchAll(/Port-Ledger\.md:(\d+)/g)];
    assert.equal(hits.length, anchors.length,
      `${file} carries ${hits.length} Ledger line cites, the pin knows ${anchors.length}`);
    hits.forEach((h, i) => {
      if (!anchors[i].test(ledgerLine(Number(h[1])))) {
        bad.push(`${file} -> Port-Ledger.md:${h[1]} is ${JSON.stringify(ledgerLine(Number(h[1])).slice(0, 70))}`);
      }
    });
  }
  assert.deepEqual(bad, [], 'a Ledger line cite names another row');
});

// ═══ CD6: Port-Status' src-file cites resolve, and a blanket bump reddens ═══
//
// AUDIT 58 R1 (e). The AUDIT 58 F5 wave inserted one Ledger row and
// re-resolved the `:NNN` identifiers that moved with it - correctly. The
// same pass also added +1 to four cites into `src/ui/hud.js` and
// `src/ui/nativeInventory.js`, two files that wave did not touch at all,
// so three cites that had been EXACT became wrong (`:456` -> `:457`, a
// comment; `:459` -> `:460`, the body of the enhanced branch instead of
// the branch; `:470` -> `:471`, the wrong field) and a fourth stale one
// stayed stale. CD3 resolves Ledger ROW identifiers and never looks at a
// `src/` path, which is why a numeric sweep over this page was invisible.
// These are the page's src-file cites, each read out of the page and
// resolved against the line it names.
const STATUS_SOURCE_CITES = [
  // the ui-hud row: one full cite and three bare `:N` continuations
  ['| **ui-hud** |', /`(?:ui\/hud\.js)?:(\d+)`/g, 'src/ui/hud.js', [
    /const rig = updateHudVitals\(/,
    /drawNearDeathFlicker\(renderer, canvas, cur/,
    /if \(isEnhanced\(\) && typeof document/,
    /detected: detected \?\? null,/,
  ]],
];

test('CD6: every `src/` line Port-Status cites is the line it describes', () => {
  const doc = lines(STATUS);
  const bad = [];
  for (const [rowStart, pick, target, anchors] of STATUS_SOURCE_CITES) {
    const row = doc.find((l) => l.startsWith(rowStart));
    assert.ok(row, `Port-Status has no row starting ${rowStart}`);
    const cites = [...row.matchAll(pick)].map((m) => Number(m[1]));
    assert.equal(cites.length, anchors.length,
      `${rowStart} carries ${cites.length} ${target} cites, the pin knows ${anchors.length}`);
    cites.forEach((n, i) => {
      const line = lines(target)[n - 1] ?? '';
      if (!anchors[i].test(line)) bad.push(`${rowStart} -> ${target}:${n} is ${JSON.stringify(line.slice(0, 60))}`);
    });
  }

  // item 9's RecordLocationFromMap clause, whose pair was stale on both
  // sides of the bump: it now names the hook itself, as a range, and the
  // host arm that fills it.
  const text = read(STATUS);
  const hook = /`ui\/nativeInventory\.js:(\d+)-(\d+)`/.exec(text);
  assert.ok(hook, 'Port-Status no longer cites the nativeInventory reveal hook');
  const slice = lines('src/ui/nativeInventory.js').slice(Number(hook[1]) - 1, Number(hook[2])).join('\n');
  assert.match(slice, /RecordLocationFromMap's DiscoverRandomLocation/, 'the cited range is not the reveal hook');
  assert.match(slice, /revealMap: this\.hooks\.revealMap \?\? null,/, 'the cited range misses the hook itself');
  const host = /`scenes\/world\.js:(\d+)`/.exec(text);
  assert.ok(host, 'Port-Status no longer cites the host arm that fills it');
  assert.match(lines('src/scenes/world.js')[Number(host[1]) - 1] ?? '', /revealMap: \(\) => revealLocation\('readMap'\)/,
    'the world.js cite is not the arm that fills the reveal hook');

  assert.deepEqual(bad, [], 'a Port-Status src cite names a line it does not describe');
});
