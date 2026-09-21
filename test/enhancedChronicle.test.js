// PX24 - THE CHRONICLE: the logbook and the history as ONE window.
//
// Mac: "with the logbook and history, I want them as one detailed UI."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chronicleModel, chronicleLines, chronicleEntry, CHRONICLE_SECTIONS } from '../src/ui/enhancedChronicle.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const T = (text) => ({ formatting: 'text', text });

test('MAC-K2: FOUR sections, and QUESTS leads them - the L key opens what it is named for', () => {
  // THE PIN THAT HAD TO BE REVERSED. It read "three sections, and
  // QUESTS are deliberately not among them", and asserted
  // `doesNotMatch(cr, /questLog/)` - the defect written down as a law.
  // The reasoning behind it was about duplication and it was sound;
  // what it got wrong was WHICH DOOR. `LogBook` is InputManager's own
  // name for the L key, this is the window it opens, and what a player
  // pressing it got was their notebook. Mac, 2026-09-15: "Logbook not
  // reflecting quests."
  assert.deepEqual(CHRONICLE_SECTIONS.map(([id]) => id), ['quests', 'notes', 'messages', 'history']);
  assert.equal(CHRONICLE_SECTIONS[0][1], 'Quests', 'and it leads, because it is what the key is for');

  // the classic window's four modes all have a page here now
  const jr = read('src/ui/questJournal.js');
  assert.match(jr, /JOURNAL_MODES = Object\.freeze\(\['activeQuests', 'finishedQuests', 'notebook', 'messages'\]\)/);
  const ids = new Set(CHRONICLE_SECTIONS.map(([id]) => id));
  for (const want of ['quests', 'notes', 'messages']) assert.ok(ids.has(want), want);

  // AND THE DUPLICATION THE OLD PIN FEARED IS ANSWERED WHERE IT LIVES.
  // Not by leaving quests out of the window named after them, but by
  // one walk and one rail: the chronicle imports them rather than
  // re-deriving, and so does the pause tab.
  const cr = read('src/ui/enhancedChronicle.js');
  assert.match(cr, /from '\.\/questRail\.js'/, 'the chronicle takes the shared rail');
  assert.match(read('src/ui/enhancedMenu.js'), /from '\.\/questRail\.js'/, 'and so does the pause tab');
  assert.doesNotMatch(cr, /getLogMessages|remainingTimeInSeconds/,
    'neither face walks the machine itself - that is scenes/questBridge.js questLog()');
  assert.match(read('src/scenes/questBridge.js'), /questLog\(\) \{/, 'the one walk');
  assert.match(read('src/ui/chronicleDoor.js'), /QUESTS ARE IN IT, and MAC-K2 is why/);
});

test('PX24 model: each section from its own source, and the orders differ on purpose', () => {
  const nb = {
    getNotes: () => [[T('a note')], [T('another')], []],
    getMessages: () => [[T('first')], [T('second')]],
  };
  const m = chronicleModel({ notebook: () => nb, entity: { backStory: ['line one', '', 'line two'] } });
  assert.deepEqual(m.notes.map((e) => e.body), [['a note'], ['another']], 'an empty entry is dropped');
  assert.deepEqual(m.messages.map((e) => e.body), [['first'], ['second']]);
  assert.deepEqual(m.history, ['line one', 'line two'], 'backStory is already lines');
  // No notebook at all is not a crash - a host may open this before one exists.
  assert.deepEqual(chronicleModel({}), { quests: [], notes: [], messages: [], history: [] });

  // MAC-K2: THE QUESTS SECTION, driven. One entry per quest, the title
  // as its head and the trail as its body, NEWEST STEP FIRST - the log
  // arrives oldest-first from the machine and the last thing you were
  // told is the thing you opened the window for.
  const q = chronicleModel({
    questLog: () => ({
      active: [
        { id: 7, name: 'Main Quest: Lysandus\u2019 Revenge', questName: 'S0000011', messages: [[T('go to Daggerfall')], [T('find the ghost')]] },
        { id: 8, name: 'A Rat Problem', questName: 'M0B00Y00', messages: [[T('kill the rats')]] },
        { id: 9, name: 'Silent', questName: 'M0B00Y01', messages: [] },
      ],
      finished: [[{ formatting: 'highlight', text: 'The Riddle completed at 3 Hearthfire:' }, T('you solved it')]],
    }),
  });
  assert.deepEqual(q.quests.map((e) => e.head),
    ['Lysandus\u2019 Revenge', 'A Rat Problem', 'The Riddle \u2014 completed 3 Hearthfire'],
    'the kind label comes off the title, and the archive follows the live ones');
  assert.deepEqual(q.quests[0].body, ['find the ghost', 'go to Daggerfall'], 'newest step first');
  assert.deepEqual(q.quests[2] && q.quests[2].body, ['you solved it']);
  assert.equal(q.quests.length, 3, 'a quest that has written NOTHING is not a row - the machine says so, not this window');
  // and a host with no quest source at all is not a crash and not a lie
  assert.deepEqual(chronicleModel({ questLog: () => null }).quests, []);
  assert.deepEqual(m.notes.map((e) => e.head), [null, null], 'no highlight, no head - and that is honest');
  // The token flattener is the journal's own set.
  assert.deepEqual(chronicleLines([T('x'), { formatting: 'nope', text: 'y' }]), ['x']);
  assert.deepEqual(chronicleLines(null), []);
  // MESSAGES newest first (the ring is oldest-first and the last thing
  // you were told is what you opened this for); NOTES keep the
  // player's own order, because MoveNote is a law they arranged.
  const cr = read('src/ui/enhancedChronicle.js');
  assert.match(cr, /const list = section === 'messages'\n\s*\? rows\.map\(\(e, i\) => \(\{ e, i \}\)\)\.reverse\(\)/,
    'and the index rides along, because remove needs the TRUE position');
  assert.match(read('src/systems/notebook.js'), /MoveNote/);
});

test('PX24 door: one seam, and the CLASSIC skin keeps its two windows', () => {
  const door = read('src/ui/chronicleDoor.js');
  // The enhanced merge is an ENHANCED idea: the classic windows are
  // different art, different layouts and different laws.
  assert.match(door, /if \(section === 'history'\) \{\s*\n\s*return playerHistoryArtLoaded\(\) \? new PlayerHistoryWindow/);
  assert.match(door, /return new QuestJournalWindow\(\{/);
  assert.match(door, /export const chronicleDoorReady = \(\) => isEnhanced\(\) \|\| questJournalArtLoaded\(\);/);
  assert.match(door, /export const historyDoorReady = \(\) => isEnhanced\(\) \|\| playerHistoryArtLoaded\(\);/,
    'each half keeps its own art gate, so a host that can open one still gets the one');
  // The world questions only a host with a map can answer are passed
  // through, not invented here.
  for (const dep of ['currentLocationName', 'canFindPlace', 'gotoPlace']) assert.ok(door.includes(dep), dep);
});

test('PX24: the window is the family\'s, not a fourth dialect', () => {
  const cr = read('src/ui/enhancedChronicle.js');
  const css = read('src/ui/enhancedStyle.js');
  for (const cls of ['px-journal', 'px-qrail', 'px-qdetail', 'px-qname', 'px-qwing']) {
    assert.ok(cr.includes(cls), `${cls} is the journal's own bones`);
  }
  // The head is the same three-zone bar the spellbook wears - and it is
  // SHARED rather than copied, which is what the first render caught:
  // scoped to .sb-shell alone it left this window's head stacked left.
  assert.match(css, /\.sb-shell \.sb-top, \.cr-shell \.sb-top \{ display: grid; grid-template-columns: 1fr auto 1fr;/);
  // PX24b: the entries are CARDS with dated heads now, not divider-
  // separated paragraphs, so this window no longer draws a divider.
  assert.doesNotMatch(cr, /px-divword/);
  assert.match(read('src/ui/enhancedStyle.js'), /\.cr-shell \.cr-entry \{ max-width: 66ch;[\s\S]{0,120}border: 2px solid/);
  // The history is ONE page: the classic pages because it draws into a
  // fixed 320x200 panel, and a DOM column scrolls.
  assert.match(cr, /ONE PAGE, NOT PAGINATED/);
  assert.doesNotMatch(cr, /pageStartLine|MAX_PAGE_LINES/);
});

// ── PX24b: THE FIRST DRAFT WAS THIN, AND LOST TWO THINGS ──────────
// Mac: "you can do better than this." He was right on both counts.
test('PX24b: an entry keeps its DATED HEAD - the notebook wrote one and the first draft dropped it', () => {
  // PlayerNotebook._createNote puts a HIGHLIGHT token first: the
  // dated header, from the host's own clock and city (notebook.js:106).
  // Flattening every token to a string turned that into just another
  // line, and the window numbered entries 1, 2, 3 instead.
  const H = (text) => ({ formatting: 'highlight', text });
  const e = chronicleEntry([H('11 Frostfall, 3E 405 in Daggerfall:'), T('The smith owes me a favour.')]);
  assert.deepEqual(e, { head: '11 Frostfall, 3E 405 in Daggerfall:', body: ['The smith owes me a favour.'] });
  // A CONTINUATION page files with NO header (notebook.js:97-107) and
  // comes back headless rather than borrowing the previous one.
  assert.deepEqual(chronicleEntry([T('...and the rest of it.')]), { head: null, body: ['...and the rest of it.'] });
  assert.deepEqual(chronicleEntry(null), { head: null, body: [] });
  const cr = read('src/ui/enhancedChronicle.js');
  // PX24c narrowed this: the continued fallback is the NOTE's alone,
  // because a message never has a head at all - see the PX24c pin.
  assert.match(cr, /: '\\u2014 continued \\u2014'\);/,
    'and a note whose page split says "continued" rather than inventing a date');
  assert.doesNotMatch(cr, /pxDivider\(String\(/, 'the meaningless 1, 2, 3 dividers are gone');
});

test('PX24b: the player may WRITE - the first draft was read-only, which is a loss', () => {
  // The classic notebook has AddNote and RemoveNote. A prettier window
  // that can do less is not an improvement.
  const cr = read('src/ui/enhancedChronicle.js');
  assert.match(cr, /deps\.notebook\(\)\.addNote\(text\);/, 'the notebook\'s own AddNote - it stamps the date itself');
  assert.match(cr, /deps\.notebook\(\)\.removeNote\(i\);/);
  const nb = read('src/systems/notebook.js');
  assert.match(nb, /addNote\(str, index = -1\) \{/);
  assert.match(nb, /removeNote\(index\) \{ this\.notes\.splice\(index, 1\); \}/);
  // Both arms appear only when there IS a notebook - a host may open
  // this before one exists, and a control that cannot act is the
  // drawn-door bug.
  assert.match(cr, /if \(section === 'notes' && deps\.notebook\?\.\(\)\) \{/);
  assert.match(cr, /if \(section === 'notes' && deps\.notebook\?\.\(\)\) \{\n\s*const rm = el\('button', 'cr-rm'/);
  // The draft survives a re-render, or every keystroke that triggers
  // one would eat what was typed.
  assert.match(cr, /^let draft = '';/m);
  assert.match(cr, /input\.oninput = \(\) => \{ draft = input\.value; \};/);
  // A thumb can reach the remove.
  assert.match(read('src/ui/enhancedStyle.js'), /@media \(pointer: coarse\) \{ \.cr-shell \.cr-rm \{ min-width: 44px; min-height: 44px; \} \}/);
});

// ── PX24c: MESSAGES AND HISTORY GET THE SAME LOOK ─────────────────
test('PX24c: a message has NO head, and PX24b printed a lie on every one', () => {
  // addMessage builds [{formatting:'center', text:''}, {text: str}]
  // (notebook.js:123). It never writes a highlight, so a message has no
  // dated head, ever - and PX24b's fallback printed "- continued -" on
  // all fifty. A continuation is a NOTE whose page split; a message
  // simply has no header to begin with.
  const nb = read('src/systems/notebook.js');
  assert.match(nb, /const message = \[\{ formatting: 'center', text: '' \}, \{ formatting: 'text', text: str \}\];/);
  const cr = read('src/ui/enhancedChronicle.js');
  assert.match(cr, /const head = e\.head \?\? \(section === 'messages'\n\s*\? \(i === rows\.length - 1 \? 'Most recent' : null\)\n\s*: '\\u2014 continued \\u2014'\);/,
    'the continued fallback is the NOTE\'s alone');
  assert.match(cr, /if \(!head\) top\.classList\.add\('cr-headless'\);/);
  assert.match(read('src/ui/enhancedStyle.js'), /\.cr-shell \.cr-head\.cr-headless \{ padding-bottom: 0;/);
  // THE RING UNWRAPS ITSELF - checked, not assumed. getMessages walks
  // from nextMessageIndex round to it, so what comes back is already
  // chronological even after the fiftieth overwrites the first; the
  // window's reverse is right BECAUSE of that, not by luck.
  assert.match(nb, /for \(let i = this\.nextMessageIndex; i < this\.messages\.length; i\+\+\) result\.push/);
  assert.match(nb, /for \(let i = 0; i < this\.nextMessageIndex; i\+\+\) result\.push/);
  assert.match(cr, /The ring DOES unwrap correctly/);
});

test('PX24c: the history says WHO it is about, and the family shares its parts', () => {
  const cr = read('src/ui/enhancedChronicle.js');
  // The entity carries race, career and level - the same three the
  // pause window's Stats page reads - and a life story with nobody's
  // name on it is a page of prose. Each part only if it is there.
  assert.match(cr, /const who = \[deps\.entity\?\.race, deps\.entity\?\.career\?\.name\]\.filter\(Boolean\)\.join\(' '\);/);
  assert.match(cr, /Number\.isFinite\(deps\.entity\?\.level\) \? `Level \$\{deps\.entity\.level\}` : null/);
  assert.match(cr, /if \(who \|\| lvl\) \{/, 'no identity, no line');
  // THE THIRD SCOPING FAULT, and the pin that ends it: the framed
  // window's shared parts are shared, not scoped to one member. The
  // head was PX24's, the divider PX23's, the chip this one's.
  const css = read('src/ui/enhancedStyle.js');
  for (const [part, sel] of [
    ['the head', /\.sb-shell \.sb-top, \.cr-shell \.sb-top \{/],
    ['the chip row', /\.sb-shell \.sb-frame, \.cr-shell \.sb-frame \{/],
    ['the chip', /\.sb-shell \.sb-chip, \.cr-shell \.sb-chip \{/],
    ['the rail count', /\.sb-shell \.sb-cost, \.cr-shell \.sb-cost \{/],
  ]) assert.match(css, sel, `${part} is the FAMILY's, not one window's`);
});

// ── PX24d: A DOOR WITH NO CALLERS IS UNREACHABLE UI ───────────────
// Mac: "the new chronicles UI is nowhere to be found ingame." It was
// not: PX24 built ui/chronicleDoor.js and the window behind it and
// then hung the door on NOTHING - zero callers - so every host still
// constructed the classic QuestJournalWindow directly, and PX25's
// Chronicle button on the Stats page opened the classic journal.
test('PX24d: EVERY enhanced door has a host that calls it', () => {
  // The general law, so the next unhung door fails here rather than in
  // play. A door module exists to be the ONE way in; one with no
  // caller is a window nobody can reach.
  const hosts = ['src/scenes/world.js', 'src/scenes/exterior.js',
    'src/scenes/dungeonContext.js', 'src/scenes/worldModes.js'].map(read).join('\n');
  for (const [door, fn] of [
    ['chronicleDoor', 'createChronicleWindow'],
    ['spellbookDoor', 'createSpellbookWindow'],
    ['charSheetDoor', 'createCharSheetWindow'],
    ['inventoryDoor', 'createInventoryWindow'],
    ['pauseDoor', 'openPauseFlow'],
  ]) {
    assert.ok(hosts.includes(`${fn}(`), `${door}: no host calls ${fn} - the door opens on nothing`);
    assert.ok(hosts.includes(`from '../ui/${door}.js'`), `${door} is imported by a host`);
  }
});

test('PX24d: the journal goes through the door, on every host that has one', () => {
  // world.js owns the only makeJournal in the host bag, so worldModes
  // reaches the chronicle through it; the dungeon has its own; the
  // exterior has NO journal at all and honestly builds none, which is
  // why PX25 gave it no Chronicle button.
  const world = read('src/scenes/world.js');
  assert.match(world, /const makeJournalWindow = \(mode\) => \{[\s\S]{0,900}return createChronicleWindow\(\{/);
  assert.doesNotMatch(world, /return new QuestJournalWindow\(\{/, 'the host no longer builds the classic window itself');
  assert.match(world, /makeJournal: \(mode\) => makeJournalWindow\(mode\)/, 'and the host bag carries it for worldModes');
  const dungeon = read('src/scenes/dungeonContext.js');
  // AUDIT 39 (#38) moved the pin, not the law: the dungeon's chronicle
  // is now built by one `makeJournalWindow(mode)` - world.js's shape -
  // because the pause window's Chronicle button needs the WINDOW back
  // (its slot still holds the pause overlay it has just closed), while
  // the key doors go on mounting it themselves.
  assert.match(dungeon, /function makeJournalWindow\(mode\) \{[\s\S]{0,900}return createChronicleWindow\(\{\n\s*\.\.\.questJournalHooks\(\),/);
  assert.match(dungeon, /activeOverlay = makeJournalWindow\(mode\);/, 'and _openJournal still mounts it');
  assert.doesNotMatch(dungeon, /activeOverlay = new QuestJournalWindow\(/);
  const ext = read('src/scenes/exterior.js');
  assert.doesNotMatch(ext, /new QuestJournalWindow\(/, 'the exterior reaches the classic window through the door too');

  // MAC-K2: THE MAPPING IS CHECKED AS A POPULATION, and this is the
  // hole a mutation campaign found. The loop was `[world, dungeon]` -
  // a hand-written pair from a day when `exterior.js` had no journal -
  // so reverting THAT host's mapping back to 'notes' changed nothing
  // any pin could see. It is the host a player walking round a town is
  // in, which makes it the one the bug was reported from.
  //
  // Every host that opens the chronicle must map every classic mode.
  const opened = [];
  for (const h of ['exterior', 'world', 'worldModes', 'dungeonContext']) {
    const src = read(`src/scenes/${h}.js`);
    if (!src.includes('createChronicleWindow(')) continue;
    opened.push(h);
    assert.match(src, /section: mode === 'messages' \? 'messages'\n\s*: \(mode === 'notebook' \? 'notes' : 'quests'\),/,
      `${h}.js must send each classic mode to the page that holds what it names`);
    assert.match(src, /\bmode,/, `${h}.js must still give the classic window its own mode`);

    // ...and DRIVEN, so a mapping that is merely SPELLED does not pass.
    const m = /section: (mode === 'messages' \? 'messages'\n\s*: \(mode === 'notebook' \? 'notes' : 'quests'\)),/.exec(src);
    // eslint-disable-next-line no-new-func
    const map = new Function('mode', `return (${m[1]});`);
    assert.equal(map('activeQuests'), 'quests', `${h}.js: the L key lands on Quests`);
    assert.equal(map('finishedQuests'), 'quests');
    assert.equal(map('notebook'), 'notes', 'and the N key on Notes');
    assert.equal(map('messages'), 'messages');
  }
  assert.deepEqual(opened, ['exterior', 'world', 'dungeonContext'],
    'the three hosts that build a chronicle - worldModes reaches it through the outer host bag');
});
