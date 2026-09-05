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
//     (Port-Ledger.md:703)". Section A carried no widget row at all -
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
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dfuFile, missingDfu } from './dfuRoot.mjs';   // PY1: DFU_PATH, then the in-tree sparse clone

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');
/** The tracked files under a directory - test/doctrine.test.js's own
 *  population, so a walk here and a walk there see the same tree. */
const tracked = (dir) => execFileSync('git', ['ls-files', dir], { cwd: root, encoding: 'utf8' })
  .split('\n').filter(Boolean);
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

  // ROAD-G G7 (records sweep): THE SAME SHAPE ONE POPULATION WIDER. The
  // gate below scanned only files that SHOUT the departure token, so the
  // other half of AUDIT 21 F7's finding - a `src/` site citing "Ledger A"
  // where no row on that page names the file - went on recurring
  // unwatched: seventeen files were in that state at HEAD. Three of them
  // were genuinely owed a row and it is written; the rest resolved
  // against a row that already existed (the engine-PRNG rule's live
  // roster, the dungeon-seed bullet, the main-menu EXIT row) or had a
  // comment that was simply WRONG - `ui/transportWindow.js` claimed the
  // port's own letters where DFU binds all five buttons out of
  // `DialogShortcuts.txt`, and ROAD-G G7 wired them instead.
  const G7 = [
    // ROAD-G G7 (review): the row says "The three sites cite this row BY
    // NAME" and the pin ran one file of three, so motor.js and
    // climbing.js kept the bare `Ledger A` this whole block exists to
    // abolish - and climbing.js' only `Ledger A` was the engine-PRNG
    // rule's, a different row. All three are named here now, which is
    // what makes the row's own sentence the thing that runs.
    [/THE `AdvancedClimbing` SCAFFOLDING IS OFF-ROAD/,
      ['src/player/moveScanner.js', 'src/player/motor.js', 'src/player/climbing.js']],
    [/THE MERCHANT SERVICE POPUP'S ACCELERATORS ARE THE PORT'S OWN/,
      ['src/ui/merchantServiceWindow.js']],
    [/THE PORT'S CLOCK IS A SCALAR/,
      ['src/systems/repairService.js', 'src/systems/quest/quest.js']],
  ];
  for (const [title, files] of G7) {
    const hit = rows.filter((r) => title.test(r.s) && !struck(r.s));
    assert.equal(hit.length, 1, `section A carries exactly one unstruck row for ${title}`);
    for (const f of files) {
      assert.ok(hit[0].s.includes(f), `the ${title} row does not name ${f}`);
      const flat = read(f).replace(/^\s*(\/\/|\*)\s?/gm, '').replace(/\s+/g, ' ');
      assert.match(flat, new RegExp(title.source), `${f} does not cite its Ledger A row by name`);
      assert.equal(/Port-Ledger\.md:\d+/.test(read(f)), false,
        `${f} cites the Ledger by line number, which is what rots`);
    }
  }
  // ROAD-G G7 (review): the AdvancedClimbing row named a method
  // PlayerMoveScanner.cs does not carry - `FindGroundPosition`/
  // `HitDistance`, which is PlayerMotor/EnemyMotor's ground drop - and
  // hung the anti-bump cite (:190-194) off the scanner, where it lands
  // inside `AssignAdjacentSurface`: the OFF-ROAD half of the row's own
  // dichotomy. The port's site had it right, so the row is resolved
  // against it - same pair, same span - and the anti-bump cite has to
  // carry the class it belongs to.
  const climbRow = rows.find((r) => /THE `AdvancedClimbing` SCAFFOLDING IS OFF-ROAD/.test(r.s));
  const probe = /`FindStep`\/`StepHitDistance` \((:\d+-\d+)\)/.exec(climbRow.s);
  assert.ok(probe, 'the AdvancedClimbing row no longer names PlayerMoveScanner\'s classic step probe');
  assert.match(climbRow.s, /anti-bump term \(AcrobatMotor\.cs:\d+-\d+\)/,
    'the row hangs the anti-bump cite off PlayerMoveScanner, where it is AssignAdjacentSurface');
  assert.ok(read('src/player/moveScanner.js').includes(`FindStep / StepHitDistance (${probe[1]})`),
    'the row\'s step-probe span is not the one the port\'s own site cites');

  // ...and the WIDENING itself, pinned as text: the population is
  // invisible from outside the gate, so narrowing it back to the shout
  // has to go red here rather than at the next unrowed cite.
  assert.match(read('test/doctrine.test.js'), /&& !\/Ledger A\/\.test\(text\)\) continue;/,
    'the doctrine gate no longer scans files that CITE Ledger A');
  // The engine-PRNG rule keeps a ROSTER because it is a class rule, not
  // a path row - that is the one line a new UnityEngine.Random site has
  // to touch, and it is what the widened gate resolves them against.
  //
  // ROAD-G G7 (review): this pin used to read NINE hard-coded names out
  // of that roster, which is a presence check with no direction - and
  // the roster it was checking was a hand list, nineteen sites short of
  // the tree on the commit that called it LIVE. Every one of the missing
  // sites named the rule verbatim to license an injectable roll, and the
  // doctrine gate passed them only because their BASENAMES happen to
  // appear on this page from unrelated rows. So the assertion runs the
  // other way now: walk src/, keep every file that cites the rule, and
  // demand the roster carry it. A roster that goes stale reddens HERE.
  const prng = rows.find((r) => /THE ENGINE-PRNG RULE/.test(r.s));
  assert.ok(prng, 'section A has no engine-PRNG rule row');
  const citesPrng = (f) => {
    // comments WRAP, so the cite is read off the unwrapped prose - the
    // same flatten the AUDIT 58 loop above uses. `engine- PRNG` is a
    // hyphen broken across two comment lines (quest/quest.js), and
    // `engine PRNG` is the older spelling (classQuestions.js).
    const flat = read(f).replace(/^\s*(\/\/|\*)\s?/gm, '').replace(/\s+/g, ' ');
    return /engine-? ?PRNG/i.test(flat) || /UnityEngine\.Random.{0,60}Ledger A/i.test(flat);
  };
  const prngSites = tracked('src').filter((f) => f.endsWith('.js') && citesPrng(f));
  // ...and the population, so a rewording cannot quietly empty the walk
  // the way `\bDEPARTURE\b` emptied the doctrine gate against the plural.
  assert.ok(prngSites.length >= 35,
    `only ${prngSites.length} src/ files cite the engine-PRNG rule - the spelling moved and this walk went quiet`);
  assert.deepEqual(prngSites.filter((f) => !prng.s.includes(f)), [],
    'these src/ files cite the engine-PRNG rule and the row\'s LIVE ROSTER does not name them.\n'
    + 'The roster is the one line the widened doctrine gate resolves a class-rule cite against,\n'
    + 'so a site missing from it is approved by basename accident, not by this page.');
  // The AUDIT 21 sites that carry the rule in older words - a bare
  // `rolls = Math.random` seam, or `Ledger A` on the engine identity -
  // never match a spelling walk, so they are kept as an explicit floor.
  for (const f of ['src/systems/chargen.js', 'src/scenes/townTalk.js',
    'src/systems/answerPipeline.js']) {
    assert.ok(prng.s.includes(f), `the engine-PRNG roster does not name ${f}`);
  }
  // and the dungeon-seed bullet, which is the same shape one row up.
  const seed = lines(LEDGER).find((l) => /THE DUNGEON SEED IS THE LocationId/.test(l));
  assert.ok(seed, 'the dungeon-seed approval lost its name');
  for (const f of ['src/characters/dungeonEnemies.js', 'src/world/dungeonTextures.js']) {
    assert.ok(seed.includes(f), `the dungeon-seed bullet does not name ${f}`);
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
const EX = 'src/scenes/exterior.js';
const SOURCE_CITES = [
  ['src/systems/quest/questMacros.js', /ui\/travelMapWindow\.js:(\d+) after it\)/,
    'src/ui/travelMapWindow.js', /\.replace\('%tcn', name\)/],
  ['tools/toneProbe.mjs', /`native` \(townTalk\.js:(\d+), true only/,
    'src/scenes/townTalk.js', /native: !!overlay\?\.conversation/],
  ['tools/worldWhereIsProbe.mjs', /townTalk's live slot \(townTalk\.js:(\d+)\)/,
    'src/scenes/townTalk.js', /overlay: !!overlay/],

  // ═══ ROAD-G G7 (2026-09-04): THE `exterior.js` SWEEP ═══
  //
  // Thirty-six `exterior.js:NNN` cites stood across `src/` comments,
  // bible pages and test headers, and they were stale BEFORE Wave F -
  // the fixed-city host has taken a slice in nearly every wave since
  // the numbers were written, so a cite that was exact at U44 was six
  // hundred lines out by HEAD. `playerEntity.js`'s was never right at
  // all: the commit that introduced it landed on the town-talk topics
  // table, not on a chargen line. Each is re-resolved BY CONTENT here
  // and pinned, so the class cannot go quiet again - a wave that moves
  // the line goes red at the citation instead of at a reader.
  ['src/characters/playerEntity.js', /exterior\.js:(\d+) and applyHeadlessChargen/,
    EX, /createChargenFlow\(fetchBytes\)\.then/],
  ['src/combat/weaponRig.js', /\(exterior\.js:(\d+), world\.js:2113\)/,
    EX, /^ {4}say: \(l\) => townTalk\.say\(l\),$/],
  ['src/scenes/dungeonContext.js', /exterior\.js:(\d+) and worldModes\.js:4627/,
    EX, /onPlayerArrowHitFoe: \(m, t\) => playerArrowHitFoe\(/],
  ['src/systems/advancement.js', /exterior\.js:(\d+)\/:1253/, EX, /^ {4}onLevelUp: \(\) => \{$/],
  ['src/systems/advancement.js', /exterior\.js:788\/:(\d+)/, EX, /^ {4}onLevelUp: \(\) => \{$/],
  ['src/systems/chargenSession.js', /exterior\.js:(\d+)\/:1000-1002/,
    EX, /from '\.\.\/systems\/chargenSession\.js'/],
  ['src/systems/equip.js', /world\.js:1336, exterior\.js:(\d+)\)/,
    EX, /if \(playerEntity\.chargenDone\) seedStartingEquipment\(playerEntity\);/],
  ['src/systems/loot.js', /world\.js:1348 and exterior\.js:(\d+)/,
    EX, /loadMagicRegistries\(fetchBytes\)\.then/],
  ['src/systems/potions.js', /exterior\.js:(\d+)\) and useItem\.js:257/,
    EX, /drinkPotion: \(key\) => magic\.drinkPotion\(key\)/],
  ['src/systems/startingGear.js', /world\.js:1336 and exterior\.js:(\d+) seed it/,
    EX, /if \(playerEntity\.chargenDone\) seedStartingEquipment\(playerEntity\);/],
  ['src/ui/pauseWindow.js', /world\.js:4092, exterior\.js:(\d+),/,
    EX, /if \(act === 'Escape' && pauseDoorReady\(\)\) \{ hudCtx\.togglePause\(\); return; \}/],
  ['src/ui/restWindow.js', /world\.js:4072, exterior\.js:(\d+),/,
    EX, /if \(act === 'Rest'\) \{ e\.preventDefault\(\); hudCtx\.toggleRest\(\); return; \}/],
  ['test/daychange.test.js', /exterior\.js:(\d+), world\.js:674/, EX, /playerTicker\.advance\(60\);/],
  ['test/overlayreentry.test.js', /exterior\.js:(\d+) and world\.js:1924/,
    EX, /if \(townTalk\.overlay\?\.isRestWindow\) townTalk\.closeOverlay\?\.\(\);/],
  ['test/overlayreentry.test.js', /exterior\.js:(\d+), world\.js:1924/,
    EX, /if \(townTalk\.overlay\?\.isRestWindow\) townTalk\.closeOverlay\?\.\(\);/],
  ['test/probehygiene.test.js', /keydown ladder, exterior\.js:(\d+)-1997/,
    EX, /addEventListener\('keydown', \(e\) => \{/],
  ['test/probehygiene.test.js', /exterior\.js:(\d+)-1016 and world\.js's copy/,
    EX, /if \(!playerEntity\.chargenDone && params\.has\('class'\)\) \{/],
  ['test/roade_up_seam.test.js', /exterior\.js:(\d+)\/:2075/,
    EX, /if \(act === 'Rest'\) \{ e\.preventDefault\(\); hudCtx\.toggleRest\(\); return; \}/],
  ['test/roade_up_seam.test.js', /exterior\.js:2067\/:(\d+)/,
    EX, /if \(act === 'Escape' && pauseDoorReady\(\)\) \{ hudCtx\.togglePause\(\); return; \}/],
  ['bible/01-Overview/Audit-58.md', /`src\/scenes\/exterior\.js:(\d+)` now/, EX, /setDefaultEnchantCtx/],
  ['bible/06-Systems/Systems-Arc.md', /`exterior\.js:(\d+)`, `world\.js:669`/, EX, /playerTicker\.advance\(60\);/],
  ['bible/09-Testing/Testing.md', /keydown ladder \(exterior\.js:(\d+)-1997\)/,
    EX, /addEventListener\('keydown', \(e\) => \{/],
  ['bible/10-UI/UI-Arc.md', /exterior\.js:(\d+)\. It is the only window/, EX, /createSpellbookWindow\(\{/],
  ['bible/10-UI/Settings-Screen-Spec.md', /`exterior\.js:(\d+)`, `dungeon\.js:677`/, EX, /^ {6}fieldOfView\(\),$/],
  // ROAD-G G7 (review): the entry above reads the exterior number out of
  // that sentence and nothing else, so the sentence's ANCHOR cite - the
  // function the other five read - was the one cite in it no pin
  // touched, and it named line 24 of a 23-line file. It is read here.
  ['bible/10-UI/Settings-Screen-Spec.md', /`src\/ui\/viewSettings\.js:(\d+)` is `fieldOfView\(\)`/,
    'src/ui/viewSettings.js', /^export const fieldOfView = \(\) =>/],
  // ...and the Ledger's own, which carry the same rot: a struck row's
  // "Original finding" is a dated snapshot, so where its subject still
  // stands the cite is re-resolved and where the fix DELETED the
  // subject the number is gone and the seam is named instead.
  ['bible/01-Overview/Port-Ledger.md', /`exterior\.js:(\d+)`, `dungeonContext\.js:1156`/,
    EX, /drinkPotion: \(key\) => magic\.drinkPotion\(key\)/],
  ['bible/01-Overview/Port-Ledger.md', /`world\.js:3406`, `exterior\.js:(\d+)`/,
    EX, /renderer\.setWindowEmission\(windowEmissionRGB\(/],
  ['bible/01-Overview/Port-Ledger.md', /`world\.js:539`, `exterior\.js:(\d+)` pass `getNameBankOfRegion`/,
    EX, /nameBank: getNameBankOfRegion\(dfLocation\.regionIndex\),/],
  ['bible/01-Overview/Port-Ledger.md', /rig sprite \(`exterior\.js:(\d+)`/, EX, /drawCharacterSprite\(renderer, canvas, rig/],
  // ROAD-G G1 (review): BOTH ends, because the half-shifted range is
  // exactly the defect this file exists to catch - the leading number
  // was re-resolved and the trailing one left where it was, leaving a
  // range that cannot exist (`exterior.js:1075-1042`).
  ['bible/01-Overview/Port-Ledger.md', /`exterior\.js:(\d+)-1087` build `createDetectFeed`/,
    EX, /const detectFeed = createDetectFeed\(playerEntity, \{/],
  ['bible/01-Overview/Port-Ledger.md', /`exterior\.js:1077-(\d+)` build `createDetectFeed`/,
    EX, /^ {2}\}\);$/],
  ['bible/01-Overview/Port-Ledger.md', /`world\.js:868`, `exterior\.js:(\d+)`/,
    EX, /const droppedLoot = createDroppedLoot\(/],
  ['bible/01-Overview/Port-Ledger.md', /createTownTalk passes no engine, `exterior\.js:(\d+)-850`/,
    EX, /const townTalk = createTownTalk\(\{/],
  ['bible/01-Overview/Port-Ledger.md', /at HEAD `exterior\.js:(\d+)` answers/,
    EX, /inTownOutside: _isPlayerInTownStrict\(\),/],
  ['bible/01-Overview/Port-Ledger.md', /\(`_isPlayerInTownStrict`, `exterior\.js:(\d+)`\)/,
    EX, /const _isPlayerInTownStrict = \(\) => _musicInLocationRect\(\)/],
  ['bible/01-Overview/Port-Ledger.md', /`exterior\.js:(\d+)-3074` return on modal frames/,
    EX, /if \(modes\.frame\(dt, now\)\) \{/],
  ['bible/01-Overview/Port-Ledger.md', /`exterior\.js:3050-(\d+)` return on modal frames/,
    EX, /^ {4}\}$/],
  ['bible/01-Overview/Port-Ledger.md', /`exterior\.js:(\d+)`\), and `ambientEffects\.js:90-114`/,
    EX, /ambience\.update\(dt, \{ playerPos: eye, inside: false \}\)/],
];

// The DELETED subjects, which no longer have a line to name: the
// sweep's other half is that a cite whose code the row's own fix
// removed says so, rather than carrying a number that lands on a
// stranger. Pinned as the absence.
const NO_LINE_LEFT = [
  [/`world\.js:3626-3629` and its `exterior\.js` twin, both DELETED by FX1/, 'no loot'],
  [/`exterior\.js`'s inline rest-deps twin - DELETED, see the strike/, 'inTownOutside: true'],
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

  // ROAD-G G7: THE PROBE FLEET, which carries ONE cite fourteen times.
  // Thirteen probe headers quote the same seam - townTalk.keydown first
  // in the exterior host's keydown ladder, the trap T2 was written about
  // - and copying a stale number thirteen times is how a wrong line
  // becomes folklore. They are read as a SET here: one range, resolved
  // at both ends, so the next reader who moves the ladder fixes all
  // fourteen at once or goes red.
  const probeSrc = readdirSync(join(root, 'tools')).filter((f) => f.endsWith('.mjs'))
    .map((f) => ['tools/' + f, read('tools/' + f)]);
  const exLines = lines(EX);
  const ranged = new Set();
  for (const [f, text] of probeSrc) {
    for (const m of text.matchAll(/exterior\.js:(\d+)-(\d+)/g)) ranged.add(`${m[1]}-${m[2]}|${f}`);
  }
  assert.ok(ranged.size >= 13, `only ${ranged.size} probes cite the keydown ladder - the fleet's header moved`);
  const spans = new Set([...ranged].map((r) => r.split('|')[0]));
  assert.equal(spans.size, 1, `the fleet quotes ${spans.size} different ladder ranges: ${[...spans].join(', ')}`);
  const [lo, hi] = [...spans][0].split('-').map(Number);
  assert.match(exLines[lo - 1] ?? '', /addEventListener\('keydown', \(e\) => \{/,
    'the probes\' ladder range no longer starts at the keydown listener');
  assert.match(exLines[hi - 1] ?? '', /if \(townTalk\.keydown\(e\)\) return;/,
    'the probes\' ladder range no longer ends at the swallow');
  // ...and the one single-line cite in the fleet, the shot-ready flag
  // bootProbe refuses to wait on outside shot mode.
  const boot = /__shotReady` is set only in shot mode \(exterior\.js:(\d+)/.exec(read('tools/bootProbe.mjs'));
  assert.ok(boot, 'bootProbe no longer cites the shot-ready flag');
  assert.match(exLines[Number(boot[1]) - 1] ?? '', /window\.__shotReady = true;/,
    'bootProbe\'s shot-ready cite names another line');

  // ROAD-G G7: the two Ledger clauses whose subject the fix DELETED
  // name the seam instead of a line, and the deleted code is really
  // gone - a "the number is retired" note over live code is the same
  // lie one step further on.
  const ledgerText = read(LEDGER);
  const ex = read(EX);
  for (const [claim, absent] of NO_LINE_LEFT) {
    assert.match(ledgerText, claim, 'a Ledger clause stopped naming its deleted seam');
    assert.equal(ex.includes(absent), false,
      `the Ledger says this exterior.js code is deleted and it is still there: ${absent}`);
  }

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
//
// ROAD-G G7 (review): the roster below is what the pin actually walks,
// and it was two files short of the sweep that wrote it. `Port-Status`
// carries three of these cites and none was read here - two of them had
// been bumped +3 arithmetically and landed on the `.SAV` reader instead
// of the keybinding-registry row they quote. And `tools/parity` spells
// it `Port-Ledger row :NNN`, which the extraction below could not even
// see, so its cite sat on a section-C row three off from the FaceUV
// harness row it means. Both spellings are read now.
const LEDGER_CITES = [
  // file, then the row each `Port-Ledger.md:NNN` in it means, in order
  ['src/systems/passiveSpecials.js', [/ENCHANTING, WHOLE/]],
  ['test/faceuvresidue.test.js', [/FaceUVTool's 1,803-UV residual/]],
  ['test/probehygiene.test.js', [/THREE PROBES THE T2 SWEEP FOUND STALE/]],
  ['bible/09-Testing/Testing.md', [/THREE PROBES THE T2 SWEEP FOUND STALE/,
    /FaceUVTool's 1,803-UV residual/]],
  ['bible/01-Overview/Port-Status-2026-09-02.md',
    [/THE KEYBINDING REGISTRY/, /THE KEYBINDING REGISTRY/, /VidFile: a MID-STREAM PALETTE/]],
  ['tools/parity/prepare.sh', [/FaceUVTool's 1,803-UV residual/]],
];

test('CD5: a `Port-Ledger.md:NNN` cite anywhere in the tree lands on its own row', () => {
  const bad = [];
  for (const [file, anchors] of LEDGER_CITES) {
    const hits = [...read(file).matchAll(/Port-Ledger(?:\.md:| row :)(\d+)/g)];
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
  // ROAD-G G7: the ONE `src/scenes/exterior.js` row on this page that is
  // still OPEN. Its identifier was the triage's `:1033`, three whole
  // slices out of date by HEAD - TP2 narrowed the refusal and moved it,
  // and nothing re-resolved the row that names it. The STRUCK rows keep
  // the measurement's numbers, which the page now says outright; an
  // unstruck row is a live claim and has to name a live line.
  ['- **`src/scenes/exterior.js:', /exterior\.js:(\d+)/g, 'src/scenes/exterior.js', [
    /TP2 INTERIM - THE ONE ARM THIS HOST CANNOT TAKE/,
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

// ---------------------------------------------------------------------------
// CD7 (ROAD-G G1 review, 2026-09-04): A RANGE WHOSE END PRECEDES ITS
// START IS NOT A CITATION AT ALL.
//
// The G1 lane re-resolved ~180 `:NNN` cites after moving code in four
// hosts, and the pass advanced only the LEADING number of every
// multi-number citation: `cityGuards.js:710-664`, `world.js:4849-4825`,
// `worldModes.js:996 against :959`. Forty of them came out as ranges
// that cannot exist, and every pin in this file was green throughout,
// because each one resolves a single number a human chose to list.
//
// This pin needs no list. It reads every tracked source, test, tool and
// bible page and refuses any citation into a PORT file (`*.js`/`*.mjs`)
// whose second number is smaller than its first - the range form
// `A-B`, the slash pair `A/:B` and the `A against :B` form alike. C#
// reference cites are exempt: DFU's own members are legitimately cited
// out of order (a caller at :481 against its callee at :409).
// MUTANT: put any one of the forty back and this goes red.
// ---------------------------------------------------------------------------
test('CD7: no citation into a port file names a range that runs backwards', () => {
  const CITE = /([A-Za-z0-9_./-]+\.(?:js|mjs)):(\d+)\s*(?:-|\/:|\/|\s+against\s+:)\s*:?(\d+)/g;
  const walk = (dir) => readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) => {
    if (e.name === 'node_modules' || e.name.startsWith('.')) return [];
    const rel = `${dir}/${e.name}`;
    return e.isDirectory() ? walk(rel) : (/\.(js|mjs|md)$/.test(e.name) ? [rel] : []);
  });
  const backwards = [];
  // this file alone is exempt: it QUOTES the corrupted forms above, as
  // the record of what the check is for.
  for (const rel of ['src', 'test', 'tools', 'bible'].flatMap(walk).filter((r) => r !== 'test/citedrift.test.js')) {
    lines(rel).forEach((l, i) => {
      for (const m of l.matchAll(CITE)) {
        if (Number(m[3]) < Number(m[2])) backwards.push(`${rel}:${i + 1}: ${m[0]}`);
      }
    });
  }
  assert.deepEqual(backwards, [], 'a citation names a range whose end precedes its start');
});

// ═══ CD8: the cites the ROAD-G G4 REVIEW re-resolved ═══
//
// G4 swept `ui/listPicker.js:259` - a line the E-group's edits had
// moved - to `:291` at four sites, and :291 is `this.syncScrollBar();`.
// The sentence at every one of those sites names the port's ONE reading
// of `InputManager.GetMouseButton(0)`, which is the line AFTER it. The
// same slice left three `ui/listPicker.js` cites standing in the Ledger
// row it re-wrote (a double-click test that is 70 lines further down, a
// "two-way index sync" that is the constructor body, a `release()` that
// is a keyboard arm), re-resolved a `release()` cite correctly on the
// Port-Status copy of the identical claim, and wrote four host cites in
// `systems/chargenSession.js`'s hover docstring that name a pointerdown
// arm, a quicksave return, an `attachTouch` call and a line of PX26
// prose. A near-miss is the worst kind of citation - it survives the
// glance that would catch a wild one - so each is resolved BY CONTENT
// here rather than by eye.
//
// The C# halves cannot be resolved from inside this repo when the
// reference tree is absent (Port-Doctrine keeps DFU an EXTERNAL
// reference), so they are pinned in two parts: the NAME, which is a
// text claim this suite can always hold, and the LINE, resolved through
// `dfuRoot.mjs` whenever a checkout is there.
const DFU_BOOK = 'Assets/Scripts/Game/UserInterfaceWindows/DaggerfallSpellBookWindow.cs';
const DFU_ICONS = 'Assets/Scripts/Game/UserInterfaceWindows/SpellIconPickerWindow.cs';
const dfuLines = (rel) => readFileSync(dfuFile(rel), 'utf8').split('\n');

test('CD8: the ROAD-G G4 review\'s re-resolved cites name the lines they mean', () => {
  const lp = lines('src/ui/listPicker.js');
  const bad = [];

  // (1) THE BUTTON READ, cited from four files. `:291` is the sync
  // call; the GetMouseButton(0) poll the sentences name is `:292`.
  for (const f of ['src/ui/chargen.js', 'src/ui/chargenArt.js',
    'src/ui/spellbookWindow.js', 'test/chargenpointer.test.js']) {
    const hits = [...read(f).matchAll(/listPicker\.js:(\d+)(?!-)/g)];
    assert.equal(hits.length, 1, `${f} carries ${hits.length} single-line listPicker cites, the pin knows 1`);
    const line = lp[Number(hits[0][1]) - 1] ?? '';
    if (!/this\.scrollBar\.update\(!!\(e\?\.buttons & 1\), vy\)/.test(line)) {
      bad.push(`${f} -> listPicker.js:${hits[0][1]} is ${JSON.stringify(line.slice(0, 60))}`);
    }
  }

  // (2) THE LEDGER'S OWN LISTBOX ROW, which carries three of them.
  const row = lines(LEDGER).find((l) => /DFU's ListBox SELECTS on the first click/.test(l));
  assert.ok(row, 'the Ledger\'s ListBox row is gone');

  const dbl = /`ui\/listPicker\.js:(\d+)-(\d+)` runs the real MouseClick/.exec(row);
  assert.ok(dbl, 'the ListBox row no longer cites the double-click test');
  assert.match(lp[Number(dbl[1]) - 1] ?? '', /index >= 0 && index < this\.items\.length/,
    'the double-click cite does not start at the row guard');
  const dblSpan = lp.slice(Number(dbl[1]) - 1, Number(dbl[2])).join('\n');
  assert.match(dblSpan, /DOUBLE_CLICK_DELAY_MS/, 'the cited range holds no DOUBLE_CLICK_DELAY_MS test');
  assert.match(dblSpan, /if \(wasDouble\) \{ this\._lastRowClick = null; this\._use\(\); \}/,
    'the cited range never reaches _use()');

  const sync = /with `listPicker\.js:(\d+)-(\d+)` \(`syncScrollBar`\)/.exec(row);
  assert.ok(sync, 'the ListBox row no longer cites the two-way index sync');
  assert.match(lp[Number(sync[1]) - 1] ?? '', /^ {2}syncScrollBar\(\) \{$/,
    'the sync cite does not start at syncScrollBar');
  const syncSpan = lp.slice(Number(sync[1]) - 1, Number(sync[2])).join('\n');
  assert.match(syncSpan, /this\.scrollIndex = bar\.scrollIndex;/, 'the cited range misses the FROM-the-bar arm');
  assert.match(syncSpan, /bar\.setScrollIndexWithoutRaisingScrollEvent\(this\.scrollIndex\);/,
    'the cited range misses the TO-the-bar arm');

  const rel = /`ListPickerWindow\.release\(\)`, `listPicker\.js:(\d+)`/.exec(row);
  assert.ok(rel, 'the ListBox row no longer cites the picker\'s release()');
  assert.match(lp[Number(rel[1]) - 1] ?? '', /^ {2}release\(\) \{ this\.scrollBar\.draggingThumb = false; \}$/,
    'the release() cite names another line');

  // (3) THE WIZARD SESSION'S FOUR HOST CITES, in the docstring over the
  // seam G4 extended. Comments WRAP, so they are read off flat prose.
  const flat = read('src/systems/chargenSession.js')
    .replace(/^\s*(\/\/|\*)\s?/gm, '').replace(/\s+/g, ' ');
  const talk = /townTalk\.js:(\d+)-(\d+), the route itself :(\d+)\)/.exec(flat);
  assert.ok(talk, 'the hover docstring no longer cites townTalk\'s hover seam');
  const tt = lines('src/scenes/townTalk.js');
  assert.match(tt[Number(talk[1]) - 1] ?? '', /^ {2}function hover\(e\) \{$/,
    'the townTalk range does not start at the hover seam');
  assert.match(tt[Number(talk[2]) - 1] ?? '', /^ {2}\}$/, 'the townTalk range does not end at the seam\'s close');
  assert.match(tt[Number(talk[3]) - 1] ?? '', /overlay\.hover\(v \? v\[0\] : -1, v \? v\[1\] : -1, e\);/,
    'the townTalk route cite is not the route');
  const ctx = /`overlayHover` \(:(\d+)\)/.exec(flat);
  assert.ok(ctx, 'the hover docstring no longer cites dungeonContext\'s overlayHover');
  assert.match(lines('src/scenes/dungeonContext.js')[Number(ctx[1]) - 1] ?? '',
    /overlayHover\(vx, vy, e = null\) \{ activeOverlay\?\.hover\?\.\(vx, vy, e\); \},/,
    'the overlayHover cite names another line');
  const feeds = /dungeon\.js:(\d+) and worldModes\.js:(\d+) both feed/.exec(flat);
  assert.ok(feeds, 'the hover docstring no longer names the two hosts that feed it');
  assert.match(lines('src/scenes/dungeon.js')[Number(feeds[1]) - 1] ?? '',
    /ctx\.overlayHover\?\.\(v \? v\[0\] : -1, v \? v\[1\] : -1, e\);/, 'the dungeon.js feed cite names another line');
  assert.match(lines('src/scenes/worldModes.js')[Number(feeds[2]) - 1] ?? '',
    /dungeonCtx\.overlayHover\?\.\(v \? v\[0\] : -1, v \? v\[1\] : -1, e\);/,
    'the worldModes.js feed cite names another line (the interior slot\'s own hover is a different route)');

  assert.deepEqual(bad, [], 'a ROAD-G G4 cite names a line it does not describe');
});

test('CD8b: the C# members ROAD-G G4 names EXIST, and at the lines it cites', () => {
  // `UpdateSpellsList` is not a member of DaggerfallSpellBookWindow -
  // nor of anything else in the reference tree - and the block the
  // three sites describe is inside `UpdateSelection` (:507). The port's
  // behaviour was right; the name resolved to a stranger, in a repo
  // whose own rule is that a line number is a claim like any other.
  // MUTANT: put either wrong cite back.
  const SITES = [
    'src/ui/spellbookWindow.js',
    'bible/01-Overview/Port-Ledger.md',
    'bible/10-UI/UI-Arc.md',
  ];
  for (const f of SITES) {
    const text = read(f);
    assert.equal(/UpdateSpellsList/.test(text), false, `${f} still names a member DFU does not have`);
    assert.match(text.replace(/\s+/g, ' '), /UpdateSelection`?'s scroller block \(:507, :509-512\)/,
      `${f} does not cite UpdateSelection's scroller block`);
  }
  const icons = read('src/ui/spellIconPickerWindow.js');
  const icon = /Scroller_OnScroll's UpdateSelectedIcon \(:(\d+)\)/.exec(icons);
  assert.ok(icon, 'the icon picker no longer cites Scroller_OnScroll\'s UpdateSelectedIcon');
  // The LITERAL, held here because the reference tree is external and
  // this half of the pin has to work without it: :248 is the
  // ScrollIndex copy, :249 is the call the sentence's argument rests
  // on. The line is RESOLVED below wherever a checkout exists.
  assert.equal(icon[1], '249', 'the UpdateSelectedIcon cite moved off the call it names');

  // ...and the numbers themselves, whenever the reference tree is
  // there. PY1's rule: DFU is an external reference, so this half
  // SKIPS without a checkout rather than failing.
  if (missingDfu(DFU_BOOK, DFU_ICONS)) return;
  const book = dfuLines(DFU_BOOK);
  assert.match(book[506] ?? '', /protected virtual void UpdateSelection\(\)/,
    'DaggerfallSpellBookWindow.cs:507 is no longer UpdateSelection');
  assert.match(book.slice(508, 512).join('\n'), /spellsListScrollBar\.Reset\(/,
    ':509-512 is no longer the scroller block');
  assert.match(dfuLines(DFU_ICONS)[Number(icon[1]) - 1] ?? '', /UpdateSelectedIcon\(\);/,
    'the icon picker\'s UpdateSelectedIcon cite names another line');
});

test('CD8c: the sentinel guard the docs claim is on ALL THREE drag machines', () => {
  // The rationale this pin corrects was written as fact in three
  // places - the Ledger row, UI-Arc's G4 section and Testing.md's row
  // all said the (-1,-1) sentinel was kept out of "both drag machines"
  // while the slice had shipped THREE, and the wizard's was the one
  // without the arm. A wording that outlives the code it describes is
  // the same defect as a stale line number, so both halves are held:
  // the guard is live in all three windows, and no page says "both".
  // MUTANT: drop the guard from `ui/chargen.js`, or restore the "both
  // drag machines" wording.
  const GUARDED = [
    ['src/ui/spellbookWindow.js', /!this\.top && vy >= 0 && this\._syncScrollBar\(\)\.update\(/],
    ['src/ui/spellIconPickerWindow.js', /if \(vx >= 0 && vy >= 0\) this\._syncScroller\(\)\.update\(/],
    ['src/ui/chargen.js', /if \(vy >= 0 && this\.pickBar\.update\(/],
  ];
  for (const [f, re] of GUARDED) assert.match(read(f), re, `${f}'s drag takes the fabricated (-1,-1)`);
  for (const f of [LEDGER, 'bible/10-UI/UI-Arc.md', 'bible/09-Testing/Testing.md']) {
    assert.equal(/both drag machines/i.test(read(f)), false, `${f} still says the sentinel is kept out of BOTH`);
  }
  assert.match(read(LEDGER), /sentinel kept out of ALL THREE drag machines/,
    'the Ledger row no longer states the count it was corrected to');
});
