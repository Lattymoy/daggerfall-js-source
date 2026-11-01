// DFU's quests in DFO's own words. A file in src/systems/quest/own/ is read in place of DFU's of its name;
// tools/ownQuestCheck.mjs holds it to DFU's logic - the same QBN, header, message ids, layouts, variants, macros,
// pronoun and journal bindings, letter signers and patches - and to our rules for the words (PLAIN-TEXT, TAMRIEL-WIDE,
// no run of DFU's words). Every own quest is checked here, and each rule is pinned on made-up data, so a rewrite can
// never break a quest.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  ROOT, OWN_DIR, DFU_DIR, OWN_CREDIT, SHARED_RUN, WIDTH, checkText, checkOwnQuest, ownQuestNames, scaffold, wrapBody, splitQuest,
  CARRIED_FIXES, dfuSource,
} from '../../tools/ownQuestCheck.mjs';
import { QUEST_FILES } from '../qlSources.mjs';
import { applyQuestPatches } from '../../src/systems/quest/questPatches.js';
import { applyQuestlinePatches, QL_PATCHES } from '../../src/systems/questlines/qlPatches.js';

const read = (p) => readFileSync(join(ROOT, p), 'utf8');
/** The Fighters Guild's twenty, OWN-WORDS1's first set. */
const FIRST_SET = ['M0B00Y00', 'M0B00Y06', 'M0B00Y07', 'M0B00Y15', 'M0B00Y16', 'M0B00Y17', 'M0B11Y18', 'M0B1XY01', 'M0B20Y02', 'M0B21Y19',
  'M0B30Y03', 'M0B30Y04', 'M0B30Y08', 'M0B40Y05', 'M0B50Y09', 'M0B60Y10', 'M0C00Y11', 'M0C00Y12', 'M0C00Y13', 'M0C00Y14'];

test('OWN-WORDS1 every own quest holds: DFU\'s logic, our words, and every rule of the checker', () => {
  const names = ownQuestNames();
  for (const n of FIRST_SET) assert.ok(names.includes(n), `${n} is ours`);
  for (const n of names) assert.deepEqual(checkOwnQuest(n), [], `${n}: node tools/ownQuestCheck.mjs ${n}`);
});

test('OWN-WORDS1 the loader reads our file in place of DFU\'s - the browser\'s pack and its node twin (mutants: the glob dropped; DFU\'s text read first)', () => {
  const pack = read('src/scenes/quest/questData.js');
  assert.match(pack, /import\.meta\.glob\('\.\.\/\.\.\/systems\/quest\/own\/\*\.txt'/);
  const left = [...pack.matchAll(/vendor\/dfu-quests\/Quests\/([^'*]+)\.txt'/g)].map((m) => m[1]);
  assert.deepEqual(left, ['__DEMO01'], 'the DFU files the pack still reads');
  assert.doesNotMatch(pack, /vendor\/dfu-quests\/Quests\/\*\.txt/, 'DFU\'s quest text is not bundled');
  const own = new Set(ownQuestNames());
  for (const f of readdirSync(join(ROOT, DFU_DIR)).filter((n) => n.endsWith('.txt'))) {
    const n = f.slice(0, -4);
    assert.ok(own.has(n) || left.includes(n), `${n}: an own file, or on the pack's list of DFU's`);
  }
  for (const n of ownQuestNames()) {
    const f = QUEST_FILES.get(n.toUpperCase());
    assert.equal(f.dir, 'dfu', `${n} stays DFU's quest`);
    assert.equal(f.path.replace(/\\/g, '/').endsWith(`${OWN_DIR}/${n}.txt`), true, `${n} is read from ${OWN_DIR}`);
  }
  assert.equal(QUEST_FILES.get('__DEMO01').path.replace(/\\/g, '/').endsWith(`${DFU_DIR}/__DEMO01.txt`), true, 'a quest with no own file is DFU\'s');
});

test('OWN-WORDS1 the port\'s patches still find their text in ours: M0B11Y18\'s QBN patch, the three Fighters Guild branches; a patch on DFU\'s words is caught (mutants: the patch layers unread)', () => {
  const text = read(`${OWN_DIR}/M0B11Y18.txt`);
  assert.notEqual(applyQuestPatches('M0B11Y18', text), text, 'AUDIT QA3 C3\'s patch applies to our file');
  for (const n of ['M0B21Y19', 'M0B50Y09', 'M0B60Y10']) {
    assert.ok(QL_PATCHES.has(n), `${n} carries a branch`);
    assert.ok(applyQuestlinePatches(n, read(`${OWN_DIR}/${n}.txt`)).includes('Message:  1900'), `${n}'s branch applies to our file`);
  }
  assert.ok(applyQuestPatches('C0B00Y02', read(`${OWN_DIR}/C0B00Y02.txt`)).includes('Message:  1027'), 'SHAM-TRAIL\'s entry in our file');
  const moved = scaffold('C0B00Y02').replace('\tplace npc _hooker_ at _tavern_ \n', '\tplace npc _hooker_ at _tavern_\n');
  assert.ok(checkText('C0B00Y02', moved, read(`${DFU_DIR}/C0B00Y02.txt`)).some((p) => /^QUEST-PATCH: C0B00Y02 holds/.test(p)));
});

test('OWN-WORDS2 a port fix our file carries: A0C00Y10\'s journal names the inn\'s own town and its patch is gone, so DFU\'s file is read with the fix, and DFU\'s `___giver_` back in ours fails (mutants: the carried fix unread)', () => {
  assert.deepEqual(Object.keys(CARRIED_FIXES), ['A0C00Y10']);
  const own = read(`${OWN_DIR}/A0C00Y10.txt`);
  assert.match(dfuSource('A0C00Y10'), / _inn_ in ___inn_ in six hours\./, 'DFU\'s words, with QUEST-AUDIT III DUEL-TOWN\'s fix');
  assert.deepEqual(checkText('A0C00Y10', own, dfuSource('A0C00Y10')), []);
  const back = checkText('A0C00Y10', own.replace(' in ___inn_,', ' in ___giver_,'), dfuSource('A0C00Y10'));
  assert.ok(back.some((p) => /^message 1003: macros dropped ___inn_, added ___giver_$/.test(p)), back.join('\n'));
  assert.ok(checkText('A0C00Y10', own, read(`${DFU_DIR}/A0C00Y10.txt`)).some((p) => /^message 1003: macros/.test(p)), 'not DFU\'s file as shipped');
});

test('OWN-WORDS1 a scaffold is DFU\'s quest with every message a TODO naming what it keeps - it fails on the TODOs alone', () => {
  const s = scaffold('M0C00Y11');
  assert.ok(s.startsWith(`${OWN_CREDIT}\n`));
  assert.equal(splitQuest(s).qbn, splitQuest(read(`${DFU_DIR}/M0C00Y11.txt`)).qbn, 'DFU\'s QBN, verbatim');
  assert.match(s, /QuestorOffer: {2}\[1000\]\n<ce> TODO _qgiver_ %pcn\n/);
  assert.match(s, /QuestLogEntry: {2}\[1010\]\n%qdt:\n TODO ___qgiver_ _house_\n/);
  const problems = checkText('M0C00Y11', s, read(`${DFU_DIR}/M0C00Y11.txt`));
  assert.ok(problems.length > 0 && problems.every((p) => /still says TODO/.test(p)), problems.join('\n'));
});

// ---- the rules, on made-up data: a DFU-shaped script and its rewrite that holds
const QBN = ['QBN:', 'Item _letter_ letter used 1013', 'Person _qgiver_ group Questor', 'Person _friend_ face 1 group Resident2 remote',
  'Place _inn_ local tavern', 'Place _keep_ remote dungeon', '', 'log 1011 step 0'];
const DFU = ['Messages: 4', 'Quest: __OWNT', 'DisplayName: The Test', 'QRC:', '',
  'QuestorOffer:  [1000]', '<ce> Will _qgiver_ pay %pcn to clean _inn_ today?', '',
  'Message:  1011', '%qdt:', ' _qgiver_ sent me to _inn_ and then to _keep_.', '',
  'Message:  1012', '<ce> _friend_ waved. %G smiled at _qgiver_.', '',
  'Message:  1013', 'Dear %pcn,', ' ', ' Come at once.', ' ', '<ce> _qgiver_', '', '', ...QBN].join('\n');
const OWN = [OWN_CREDIT, 'Messages: 4', 'Quest: __OWNT', 'DisplayName: The Test', 'QRC:', '',
  'QuestorOffer:  [1000]', '<ce> %pcn, _qgiver_ pays well', '<ce> for a clean _inn_. Yes?', '',
  'Message:  1011', '%qdt:', ' First _inn_ for _qgiver_, then on to _keep_.', '',
  'Message:  1012', '<ce> _friend_ nods. %G grins at _qgiver_.', '',
  'Message:  1013', 'Dear %pcn,', ' ', ' Hurry.', ' ', '<ce> _qgiver_', '', '', ...QBN].join('\n');
const check = (own, dfu = DFU) => checkText('__OWNT', own, dfu);
const swap = (a, b) => { assert.ok(OWN.includes(a), a); return OWN.replace(a, b); };
const fails = (own, re) => { const p = check(own); assert.ok(p.some((x) => re.test(x)), `${re} in:\n${p.join('\n')}`); };

test('OWN-WORDS1 the made-up rewrite holds, and the checker\'s constants are the rule\'s', () => {
  assert.deepEqual(check(OWN), []);
  assert.equal(SHARED_RUN, 6);
  assert.deepEqual({ ...WIDTH }, { max: 60, centre: 40, plain: 34 });
});

test('OWN-WORDS1 DFU\'s logic is held: the QBN byte for byte, the header\'s fields, the credit, the ids, a line read as a header (mutants: each comparison dropped)', () => {
  fails(swap('log 1011 step 0', 'log 1011 step 1'), /QBN differs from DFU's at its line 8/);
  fails(swap('DisplayName: The Test', 'DisplayName: Another'), /header's fields/);
  fails(OWN.replace(`${OWN_CREDIT}\n`, ''), /no OWN-WORDS credit line/);
  fails(swap('Message:  1012\n<ce> _friend_ nods. %G grins at _qgiver_.\n\n', ''), /messages missing: 1012/);
  fails(swap('Message:  1013\n', 'Message:  1099\n<ce> More.\n\nMessage:  1013\n'), /DFU's script does not have: 1099/);
  fails(swap(' Hurry.', ' Hurry.\nQuest: __OTHER'), /reads as a header field/);
});

test('OWN-WORDS1 each message keeps its shape: layout, variants, macros, two macros in one word (mutants: each comparison dropped)', () => {
  fails(swap('<ce> _friend_ nods.', '_friend_ nods.'), /message 1012: layout plain, DFU's is centre/);
  fails(swap('<ce> _friend_ nods. %G grins at _qgiver_.', '<ce> _friend_ nods. %G grins at _qgiver_.\n<--->\n<ce> _friend_ is here.'), /message 1012: 2 variants, DFU's has 1/);
  fails(swap('<ce> %pcn, _qgiver_ pays well', '<ce> _qgiver_ pays well'), /message 1000: macros dropped %pcn/);
  fails(swap('%G grins at _qgiver_.', '%G grins at _qgiver_ by _keep_.'), /message 1012: macros added _keep_/);
  fails(swap(' First _inn_ for _qgiver_, then on to _keep_.', ' First _inn_/_keep_ for _qgiver_.'), /"_inn_\/_keep_" holds two macros in one word/);
  assert.deepEqual(check(swap('%G grins at', '%g grins at')), [], 'the capital is the sentence\'s: %G and %g are one macro');
});

test('OWN-WORDS1 what a macro reads stays the same: a pronoun\'s person, the journal\'s last place and person, a letter\'s signer (mutants: the walk\'s order; the signer unread)', () => {
  fails(swap('<ce> _friend_ nods. %G grins at _qgiver_.', '<ce> %G grins at _qgiver_. _friend_ nods.'), /message 1012: a pronoun or %di reads someone else/);
  fails(swap(' First _inn_ for _qgiver_, then on to _keep_.', ' First _keep_ for _qgiver_, then on to _inn_.'), /message 1011: the journal's way points elsewhere/);
  fails(swap(' Hurry.\n \n<ce> _qgiver_', ' Hurry, says _qgiver_.\n \n<ce> Yours,'), /message 1013: _letter_'s last line names the letter/);
});

test('OWN-WORDS1 the words are ours and plain: PLAIN-TEXT\'s limits and padding, no run of DFU\'s words, no TODO, the width, TAMRIEL-WIDE (mutants: each rule dropped)', () => {
  fails(swap(' Hurry.', ` ${Array(41).fill('Hurry.').join(' ')}`), /message 1013: past PLAIN-TEXT - 4\d words \(40 at most\)/);
  fails(swap(' Hurry.', ` ${Array(26).fill('hurry').join(' ')}.`), /a sentence of 28 \(25 at most\)/);
  fails(swap(' Hurry.', ' Simply hurry.'), /padding/);
  fails(swap('<ce> %pcn, _qgiver_ pays well\n<ce> for a clean _inn_. Yes?', '<ce> You can call me _qgiver_.\n<ce> Normally %pcn cleans _inn_.'), /message 1000: keeps DFU's words "you can call me _qgiver_ normally"/);
  fails(swap(' Hurry.', ' TODO'), /message 1013: still says TODO/);
  fails(swap(' Hurry.', ` ${'Hurry '.repeat(10).trim()}.`), /message 1013: a line of 61 characters \(40 at most\)/);
  fails(swap('<ce> _friend_ nods.', '<ce> _friend_ nods in the Iliac Bay.\n<ce>'), /names the Bay's own places \("Iliac"\)/);
  assert.deepEqual(check(swap('<ce> _friend_ nods.', '<ce> _friend_ nods in the Iliac Bay.\n<ce>').replace(OWN_CREDIT, `${OWN_CREDIT}\n-- BAY-OWN: a test set in the Bay`)), [],
    'a quest set in the Bay says why, and may name it');
});

test('OWN-WORDS1 the wrap: one kind of line flows together, as even as the width allows; a signature, <--->, %qdt:, a bare <ce> and a line of spaces stay (mutants: kinds merged; the lead uncounted; the last word alone)', () => {
  assert.deepEqual(wrapBody(['<ce> one two three four five six seven'], 20), ['<ce> one two three four', '<ce> five six seven']);
  assert.deepEqual(wrapBody(['<ce> We part here.', '<ce>', '<ce> _traitor_', '<ce> __palace_'], 40), ['<ce> We part here.', '<ce>', '<ce> _traitor_', '<ce> __palace_']);
  assert.deepEqual(wrapBody(['%qdt:', ' alpha beta gamma delta epsilon'], 16), ['%qdt:', ' alpha beta', ' gamma delta', ' epsilon']);
  assert.deepEqual(wrapBody(['Dear %pcn,', ' ', ' a b c d e f', '    g h'], 10), ['Dear %pcn,', ' ', ' a b c', ' d e f', '    g h']);
  assert.deepEqual(wrapBody(['bare words that flow on', 'and on'], 14), ['bare words', 'that flow', 'on and on'], 'greedy would leave "and on" for last');
  assert.deepEqual(wrapBody(['<ce> a b', '        <--->', '<ce> c'], 40), ['<ce> a b', '<--->', '<ce> c']);
});

test('OWN-WORDS2 the questline patches\' own messages share no six-word run with DFU\'s quest text (mutants: a Bethesda sentence back)', async () => {
  const { sharedRunsIn } = await import('../../tools/ownQuestCheck.mjs');
  const { readdirSync, readFileSync } = await import('node:fs');
  const dir = new URL('../../src/systems/questlines/patches/', import.meta.url);
  const strings = (o, out = []) => { if (typeof o === 'string') out.push(o); else if (o && typeof o === 'object') for (const v of Object.values(o)) strings(v, out); return out; };
  const found = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.json'))) {
    for (const s of strings(JSON.parse(readFileSync(new URL(f, dir), 'utf8')))) for (const r of sharedRunsIn(s)) found.push(`${f}: "${r}"`);
  }
  assert.deepEqual(found, []);
  assert.deepEqual(sharedRunsIn('As you pick up the _clothing_ you hear the soft rustle of paper.'), ['as you pick up the _clothing_', 'you pick up the _clothing_ you', 'pick up the _clothing_ you hear', 'up the _clothing_ you hear the', 'the _clothing_ you hear the soft', '_clothing_ you hear the soft rustle', 'you hear the soft rustle of', 'hear the soft rustle of paper'], 'a Bethesda sentence is found');
});
