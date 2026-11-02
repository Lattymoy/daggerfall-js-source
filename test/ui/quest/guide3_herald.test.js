// GUIDE3 (2026-09-29, Mac: "How can we set the foundation and improve the quest system substantially? Like really
// modernize it, make it more accessible", then, of the Quest Guide arc: "This is your baby. Take your time") - THE
// HERALD (ui/quest/questHerald.js, bible/06-Systems/Quest-Guide-Arc.md): a quest's news as a notice in the enhanced stack.
// Its laws, each over the real producers:
//
//   WHAT IT SAYS - the kind, the title, and one line: the newest entry's opening (the date header dropped, the
//     1996 wrap joined, the first sentence) or the time left; an ending says no more than that it ended.
//   ONE NOTICE PER QUEST - two pieces of news inside one notice's life are one notice, and the one that stands is
//     the ending, then the new quest, then the deadline, then the entry; the oldest quest's news goes first.
//   THE BRIDGE FEEDS IT - over the real bridge and machine, one look after each machine tick, and only while the
//     herald is listening: off (the switch, the classic skin, no page) there is no look at all, and a herald that
//     starts listening mid-game hears a baseline, never the backlog; a look that throws costs the news, never the
//     frame.
//   THE MACHINE NEVER KNOWS - a whole game ticked through the bridge with the herald listening and without it ends
//     in the same save, popups, topics, DFRandom seed, quest rolls and engine draws.
//   THE HUD'S CLOCK, THE STACK'S FACE - drawn on drawHud's one call, its clock is the HUD's (stopped under the hide
//     gate), each notice one toast of three weighted rows in the `aria-live` stack, and off it reaches its hide door.
//   ONE CALL, EVERY HOST - drawHud draws it outside the skin's gate, the bridge feeds it after the machine's tick,
//     the three hosts that hold quests tick the bridge, and the switch is a Features row.
//
// And the opening over the corpus: every message a quest LOGS opens with words, never the date, inside its cap.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { QuestMachine } from '../../../src/systems/quest/machine.js';
import { resetUid, ensureUidAtLeast } from '../../../src/systems/quest/quest.js';
import { createQuestBridge } from '../../../src/scenes/quest/questBridge.js';
import { makeWorld, seededRolls } from '../../guideWorld.mjs';   // the crafted world, the tables loaded
import { getSeed, srand } from '../../../src/formats/dfRandom.js';
import { quietLines } from '../../../src/ui/quest/questLens.js';
import { remainWords, entryOpening, OPENING_MAX, QUEST_URGENT_SECONDS } from '../../../src/ui/quest/questRail.js';
import {
  QuestHerald, questHerald, drawQuestHerald, heraldOn, heraldTimeLeft,
  HERALD_PREF, HERALD_OWNER, HERALD_SECONDS, HERALD_MAX, HERALD_WORDS,
} from '../../../src/ui/quest/questHerald.js';
import { destroyEnhancedNotice, enhancedNoticeKeys, _setNoticeClockForTests, ENHANCED_NOTICE_ID } from '../../../src/ui/enhanced/enhancedNotice.js';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { TRACKER_PREF } from '../../../src/ui/quest/questTracker.js';   // GUIDE4 listens to the same look: these pins hear the herald alone
import { MARKS_PREF } from '../../../src/ui/quest/questMarks.js';   // ...and GUIDE5's marks follow it too
import { PREF_DEFAULTS } from '../../../src/systems/uiPrefs.js';
import { FEATURES } from '../../../src/systems/features.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const VENDOR = join(ROOT, 'vendor', 'dfu-quests');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const quiet = (fn) => { const w = console.warn, i = console.info; console.warn = () => {}; console.info = () => {}; try { return fn(); } finally { console.warn = w; console.info = i; } };

// ---------------------------------------------------------------
// the page: a fake document the notice stack builds in, the skin by the URL's override (the one every mount reads)
// ---------------------------------------------------------------

function fakeNode(tag) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '',
    style: { setProperty(k, v) { this[k] = v; } }, dataset: {}, attrs: {},
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
    insertBefore(c, ref) { c.parent = n; const i = n.children.indexOf(ref); if (i < 0) n.children.push(c); else n.children.splice(i, 0, c); },
    setAttribute(k, v) { n.attrs[k] = v; },
    remove() { if (n.parent) { n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; } n.removed = true; },
  };
  return n;
}
function fakeDocument() {
  const doc = {};
  doc.createElement = (tag) => fakeNode(tag);
  doc.head = fakeNode('head'); doc.body = fakeNode('body');
  const byId = (n, id) => { if (n.id === id) return n; for (const c of n.children) { const f = byId(c, id); if (f) return f; } return null; };
  doc.getElementById = (id) => byId(doc.head, id) ?? byId(doc.body, id);
  return doc;
}
/** The page, the skin and the switches for one test; everything put back after. The tracker (GUIDE4) is off unless a
 *  pin asks: it hears the same look, and these pins are the herald's. */
function onPage(fn, { skin = 'enhanced', herald = true, tracker = false, doc = fakeDocument() } = {}) {
  const had = Object.hasOwn(globalThis, 'location') ? globalThis.location : undefined;
  const hadDoc = Object.hasOwn(globalThis, 'document') ? globalThis.document : undefined;
  globalThis.location = { search: `?skin=${skin}` };
  if (doc) globalThis.document = doc;
  quiet(() => { setPref(HERALD_PREF, herald); setPref(TRACKER_PREF, tracker); setPref(MARKS_PREF, tracker); });   // the marks follow with the tracker
  const due = [];
  _setNoticeClockForTests((f, ms) => { const t = { f, ms, live: true }; due.push(t); return t; }, (t) => { if (t) t.live = false; });
  questHerald.clear();
  try { return fn(doc, { fire: (ms) => { for (const t of due.filter((x) => x.live && x.ms === ms)) { t.live = false; t.f(); } } }); } finally {
    if (had === undefined) delete globalThis.location; else globalThis.location = had;
    if (hadDoc === undefined) delete globalThis.document; else globalThis.document = hadDoc;
    quiet(() => { setPref(HERALD_PREF, true); setPref(TRACKER_PREF, true); setPref(MARKS_PREF, true); });
    questHerald.clear();
    destroyEnhancedNotice();
    _setNoticeClockForTests((f, ms) => setTimeout(f, ms), (t) => clearTimeout(t));
  }
}

// ---------------------------------------------------------------
// the quests
// ---------------------------------------------------------------

const HERALD_SRC = [
  'Quest: __GHERALD', 'DisplayName: Main Quest - The Herald', 'QRC:',
  'Message:  1010', '%qdt:', ' I agreed to find the ring. It is', ' gold, they say.', '',
  'Message:  1011', '%qdt:', ' I found the ring. I must return it', ' to the questor.', '',
  'Message:  1012', ' The deadline moved.', '',
  'Message:  1020', ' A popup the quest says.', '',
  'QBN:',
  'Clock _timer_ 2.0:00', '',
  '_timer_ task:', ' end quest', '',
  '_step1_ task:', ' log 1011 step 1', '',
  '_relog_ task:', ' log 1012 step 0', '',
  '_win_ task:', ' give pc nothing', ' end quest', '',
  'log 1010 step 0',
  'start timer _timer_',
];
const OTHER_SRC = (n) => [
  `Quest: __GOTHER${n}`, `DisplayName: Other ${n}`, 'QRC:',
  'Message:  1010', ` Other entry ${n}.`, '',
  'QBN:',
  'log 1010 step 0',
];
// GUIDE1's quiet-read quest: a Place, a questor, %god on the quest's rolls, %n on DFRandom, a `say`, a clock.
const QUIET_SRC = [
  'Quest: __GQUIET', 'DisplayName: The Quiet Read', 'QRC:',
  'Message:  1010', '%qdt:', " _qgiver_ asked me, in %god's name, to find %n at _pub_ in __pub_.", ' I have =timer_ days.', '',   // AUDIT GUIDE H1
  'Message:  1011', '%qdt:', ' %g said to look in ___keep_ of ____keep_.', '',
  'Message:  1020', ' _qgiver_ says: seek _pub_.', '',
  'QBN:',
  'Place _pub_ local tavern',
  'Place _keep_ permanent Llugwych',
  'Person _qgiver_ face 1 group Questor',
  'Clock _timer_ 1.00:00', '',
  '_timer_ task:', ' end quest', '',
  '_next_ task:', ' say 1020', ' log 1011 step 1', '',
  'log 1010 step 0',
  'start timer _timer_',
];
const SOURCES = { __GHERALD: HERALD_SRC, __GQUIET: QUIET_SRC, __GOTHER1: OTHER_SRC(1), __GOTHER2: OTHER_SRC(2), __GOTHER3: OTHER_SRC(3) };

function makeBridge({ world = null, clock, popups = [], dialogs = [] }) {
  return quiet(() => createQuestBridge({
    data: { readListTable: () => null, getQuestSourceLines: (n) => SOURCES[n] ?? null },
    world,
    classicSeconds: () => clock.now,
    playerEntity: { name: 'Hero', level: 3, gender: 'male' },
    getReputation: () => 0,
    dateTimeString: () => '13:30:00 on 4th of Morning Star, 3E405',
    midDateTimeString: () => '13:30:00 04 Morning Star 3E405',
    cityName: () => 'Bigtown',
    showPopup: (q, tokens) => popups.push(tokens.map((t) => t.text ?? '').join('|')),
    addDialog: (...a) => dialogs.push(a.join(':')),
  }));
}
const questOf = (b, name) => [...b.machine.quests.values()].find((q) => q.questName === name);
/** The bridge's own tick at the machine's pace (TICKS_PER_SECOND 10): every call is one machine tick. */
const beat = (b, n = 1) => quiet(() => { let fired = 0; for (let i = 0; i < n; i++) fired += b.tick(0.1) ? 1 : 0; return fired; });
/** What the herald would draw, as words. */
const said = (h = questHerald) => h.frame().rows.map((rows) => rows.map((r) => r.text));
/** Count the lens's looks. */
function countLooks(b) {
  const look = b.lens.look.bind(b.lens);
  const n = { looks: 0 };
  b.lens.look = (...a) => { n.looks++; return look(...a); };
  return n;
}

// ---------------------------------------------------------------
// WHAT IT SAYS / ONE NOTICE PER QUEST - the queue, pure
// ---------------------------------------------------------------

const view = (id, lines, clockSeconds = null) => ({ id, latest: { lines }, clockSeconds });
const DATED = (...lines) => ['Sundas the 1st of Morning Star:', ...lines];

test('GUIDE3 WHAT IT SAYS - each news is its kind, the quest\'s title and one line: a new quest and a new entry the newest entry\'s opening (the date header dropped, the wrap joined, the first sentence), a deadline the time left in the journal\'s own words, an ending nothing more; a main quest\'s title is marked; news the herald does not know is not said (mutants: each word; the line off the first entry; the header kept; the main mark dropped)', () => {
  const h = new QuestHerald();
  h.hear({
    quests: [view('7', DATED(' I agreed to find the ring. It is', ' gold.')), view('8', [' Other entry.', ' More.'], 90000), view('9', DATED(' The first.'), 3600)],
    events: [
      { type: 'started', id: '7', title: 'The Herald', main: true },
      { type: 'updated', id: '8', title: 'Other', main: false, entries: ['8|0|1010|5'] },
      { type: 'urgent', id: '9', title: 'Third', main: false, clockSeconds: 86399 },
      { type: 'shouted', id: '10', title: 'Nothing' },
    ],
  });
  assert.deepEqual(h.frame(), {
    ids: [1, 2, 3],
    rows: [
      [{ text: 'New quest - Main Quest', cls: 'herald-kind' }, { text: 'The Herald', cls: 'herald-title main' }, { text: 'I agreed to find the ring.', cls: 'herald-line' }],   // AUDIT GUIDE H10: a main quest SAID
      [{ text: 'Journal updated', cls: 'herald-kind' }, { text: 'Other', cls: 'herald-title' }, { text: 'Other entry.', cls: 'herald-line' }],
      [{ text: 'Under a day left', cls: 'herald-kind' }, { text: 'Third', cls: 'herald-title' }, { text: '23 hours 59 min left', cls: 'herald-line' }],
    ],
  });
  assert.equal(heraldTimeLeft(86399), `${remainWords(86399)} left`, 'the journal\'s own "Time remains" count, one home');
  const e = new QuestHerald();
  e.hear({ quests: [], events: [{ type: 'completed', id: '1', title: 'Won', main: false }, { type: 'ended', id: '2', title: 'Lost', main: false }] });
  assert.deepEqual(said(e), [['Quest completed', 'Won'], ['Quest ended', 'Lost']], 'an ending says only that it ended - no line row at all');
  assert.deepEqual(Object.keys(HERALD_WORDS), ['started', 'updated', 'objective', 'urgent', 'completed', 'ended'], 'the lens\'s six events, each with a word (QL2: an objective done)');
  const n = new QuestHerald();
  n.hear({ quests: [], events: [{ type: 'updated', id: '4', title: 'No view' }] });
  assert.deepEqual(said(n), [['Journal updated', 'No view']], 'a quest the look did not carry has no line to say');

  // the opening itself
  assert.equal(entryOpening(DATED(' I agreed to find the ring. It is gold.')), 'I agreed to find the ring.');
  const guild = [' The Fighters Guild of', ' Daggerfall has hired', ' me to kill a troublesome werewolf,', ' wereboar, or whatever, in its lair,', ' Castle Llugwych. The beast needs'];
  assert.equal(entryOpening(guild), 'The Fighters Guild of Daggerfall has hired me to kill a troublesome werewolf, wereboar, or whatever, in its lair, Castle Llugwych.', 'the wrap joined, the first sentence whole under OPENING_MAX');
  assert.equal(entryOpening(guild, 100), 'The Fighters Guild of Daggerfall has hired me to kill a troublesome werewolf, wereboar\u2026', 'past the cap: cut at a word, never on a small word ("or"), the comma dropped, an ellipsis');
  assert.equal(entryOpening(['I must find the ring of the king before the moon turns.'], 24), 'I must find the ring\u2026', 'a small word at the cut goes: "the ring of..." says less than "the ring..."');
  assert.equal(entryOpening(['Hmm... he said. Then more.']), 'Hmm... he said.', 'a stop is a sentence\'s end only before a capital');
  assert.equal(entryOpening(['One two three four, five six seven.'], 20), 'One two three four\u2026', 'a cut after a comma drops the comma');
  assert.equal(entryOpening(['Loredas the 23rd of Sun\'s Dawn:', ' Go.']), 'Go.', 'every day and month name is a header');
  assert.equal(entryOpening(['He said the 1st of it:', ' go']), 'He said the 1st of it: go', 'a line that is not a date is words');
  assert.equal(entryOpening([' Written on', 'Sundas the 1st of Morning Star:', ' and sealed.']), 'Written on Sundas the 1st of Morning Star: and sealed.', 'only the FIRST line can be the header: a date inside the words is words');
  assert.equal(entryOpening(DATED()), '', 'a header alone is no opening');
  assert.equal(entryOpening(null), '');
  assert.equal(entryOpening(['x'.repeat(150)]).length, OPENING_MAX, 'a word longer than the cap is cut at the cap');
});

test('GUIDE3 ONE NOTICE PER QUEST - two pieces of news for one quest inside one notice\'s life are one notice (its id kept, its clock restarted): a new quest stays new while its entries land, a deadline outranks an entry and says the time the look carries now, an ending is the last word; the fourth quest\'s news pushes the oldest out; the clock is real seconds and ends a notice at HERALD_SECONDS (mutants: a notice per event; the rank inverted; the clock not restarted; the cap off by one; a tick that ignores dt)', () => {
  const h = new QuestHerald();
  h.hear({ quests: [view('7', DATED(' First entry.'))], events: [{ type: 'started', id: '7', title: 'The Herald', main: true }] });
  h.tick(5);
  assert.equal(h.rows[0].left, HERALD_SECONDS - 5);
  h.hear({ quests: [view('7', DATED(' Second entry.'), 90000)], events: [{ type: 'updated', id: '7', title: 'The Herald', main: true, entries: ['k'] }] });
  assert.deepEqual(h.frame().ids, [1], 'one notice');
  assert.deepEqual(said(h), [['New quest - Main Quest', 'The Herald', 'Second entry.']], 'still new - with the newest entry\'s words');
  assert.equal(h.rows[0].left, HERALD_SECONDS, 'the clock restarted for the new words');
  h.hear({ quests: [view('7', DATED(' Second entry.'), 80000)], events: [{ type: 'urgent', id: '7', title: 'The Herald', main: true, clockSeconds: 80000 }] });
  assert.deepEqual(said(h), [['New quest - Main Quest', 'The Herald', 'Second entry.']], 'a new quest outranks its first deadline');

  const u = new QuestHerald();
  u.hear({ quests: [view('5', [' An entry.'], 90000)], events: [{ type: 'updated', id: '5', title: 'Q', main: false }] });
  u.hear({ quests: [view('5', [' An entry.'], 86000)], events: [{ type: 'urgent', id: '5', title: 'Q', main: false, clockSeconds: 86000 }] });
  assert.deepEqual(said(u), [['Under a day left', 'Q', `${remainWords(86000)} left`]], 'a deadline outranks an entry');
  u.hear({ quests: [view('5', [' Newer.'], 80000)], events: [{ type: 'updated', id: '5', title: 'Q', main: false }] });
  assert.deepEqual(said(u), [['Under a day left', 'Q', `${remainWords(80000)} left`]], '...and an entry after it leaves the deadline standing, with the time the look carries NOW');
  u.hear({ quests: [], events: [{ type: 'completed', id: '5', title: 'Q', main: false }] });
  assert.deepEqual(said(u), [['Quest completed', 'Q']], 'an ending is the last word');
  u.hear({ quests: [view('5', [' After.'], 70000)], events: [{ type: 'updated', id: '5', title: 'Q', main: false }] });
  assert.deepEqual(said(u), [['Quest completed', 'Q']], '...and nothing outranks it');
  assert.deepEqual(u.frame().ids, [1]);

  const m = new QuestHerald();
  for (let i = 1; i <= HERALD_MAX + 1; i++) m.hear({ quests: [], events: [{ type: 'started', id: String(i), title: `Q${i}` }] });
  assert.deepEqual(m.rows.map((r) => r.title), ['Q2', 'Q3', 'Q4'], `HERALD_MAX (${HERALD_MAX}): the oldest news goes first`);
  assert.deepEqual(m.frame().ids, [2, 3, 4], 'each keeps its own id, so the stack slides out only the one that left');

  const c = new QuestHerald();
  c.hear({ quests: [], events: [{ type: 'ended', id: '1', title: 'Q' }] });
  c.tick(0); c.tick(NaN); c.tick(-3);
  assert.equal(c.rows[0].left, HERALD_SECONDS, 'no time, no tick');
  c.tick(HERALD_SECONDS - 0.01);
  assert.equal(c.rows.length, 1);
  c.tick(0.02);
  assert.equal(c.rows.length, 0, 'gone at HERALD_SECONDS');
  c.hear({ quests: [], events: [{ type: 'ended', id: '1', title: 'Q' }] });
  assert.deepEqual(c.frame().ids, [2], 'news after a notice ended is a NEW notice: it slides in again');
});

// ---------------------------------------------------------------
// THE BRIDGE FEEDS IT
// ---------------------------------------------------------------

test('GUIDE3 THE BRIDGE FEEDS IT - over the real bridge and machine: one look after each machine tick and none between; the first look is a baseline; a quest started is "New quest" with its first entry\'s words, a step it logs keeps the notice new, a step logged again is "Journal updated", a payout "Quest completed" and a clock run out "Quest ended" (mutants: news before the tick; a look between ticks; the baseline heard)', () => {
  onPage(() => {
    assert.equal(heraldOn(), true, 'the premise: the enhanced skin, the switch on, a page');
    const clock = { now: 1000 };
    const b = makeBridge({ clock });
    const n = countLooks(b);
    assert.equal(quiet(() => b.tick(0.05)), false, 'under a tenth of a second: no machine tick');
    assert.equal(n.looks, 0, 'no machine tick, no look');
    assert.equal(beat(b), 1);
    assert.equal(n.looks, 1, 'one look after the machine\'s tick');
    assert.deepEqual(said(), [], 'the first look is the baseline');

    quiet(() => b.machine.startQuestByName('__GHERALD', 0, { rolls: seededRolls() }));
    beat(b);
    assert.deepEqual(said(), [['New quest', 'The Herald', 'I agreed to find the ring.']]);
    assert.equal(questHerald.rows[0].main, false, 'DisplayName\'s "Main Quest -" is the title\'s label; `main` is the quest list\'s (findQuestMeta), and this one is on none');
    const q = questOf(b, '__GHERALD');
    clock.now = 1010; q.startTask({ name: 'step1' }); beat(b);
    assert.deepEqual(said(), [['New quest', 'The Herald', 'I found the ring.']], 'a step logged while the quest is news keeps it new, with the new words');
    questHerald.clear();
    clock.now = 1020; q.startTask({ name: 'relog' }); beat(b);
    assert.deepEqual(said(), [['Journal updated', 'The Herald', 'The deadline moved.']]);
    beat(b, 3);
    assert.equal(questHerald.rows.length, 1, 'nothing new, nothing said - the notice only ages');
    assert.equal(n.looks, 7);
    questHerald.clear();
    clock.now += 10; q.startTask({ name: 'win' }); beat(b, 6);
    assert.deepEqual(said(), [['Quest completed', 'The Herald']]);

    questHerald.clear();
    clock.now = 50000;
    quiet(() => b.machine.startQuestByName('__GHERALD', 0, { rolls: seededRolls() }));
    beat(b);
    questHerald.clear();
    clock.now += 2 * 86400 + 1; beat(b, 6);
    assert.deepEqual(said(), [['Quest ended', 'The Herald']], 'its clock run out: the notebook files it as ended');
  });
});

test('GUIDE3 THE BRIDGE FEEDS IT - only while the herald listens: the switch off, the classic skin or no page, and there is no look at all (a player who never hears it never pays for it); a herald that starts listening mid-game hears a baseline, never the backlog; a look that throws costs the news and one warning, never the frame (mutants: the look before the gate; the backlog heard; the catch dropped; a warning a tick)', () => {
  onPage(() => {
    const clock = { now: 1000 };
    const b = makeBridge({ clock });
    const n = countLooks(b);
    beat(b);
    quiet(() => setPref(HERALD_PREF, false));
    assert.equal(heraldOn(), false);
    quiet(() => b.machine.startQuestByName('__GHERALD', 0, { rolls: seededRolls() }));
    beat(b, 3);
    assert.equal(n.looks, 1, 'the switch off: no look');
    const q = questOf(b, '__GHERALD');
    clock.now = 1010; q.startTask({ name: 'step1' }); beat(b);
    quiet(() => setPref(HERALD_PREF, true));
    beat(b);
    assert.deepEqual(said(), [], 'switched on: the quest started and its step logged while it was off are the baseline, not news');
    clock.now = 1020; q.startTask({ name: 'relog' }); beat(b);
    assert.deepEqual(said(), [['Journal updated', 'The Herald', 'The deadline moved.']], '...and what happens after is heard');
    const looks = n.looks;

    globalThis.location = { search: '?skin=classic' };
    assert.equal(heraldOn(), false, 'the classic skin: DFU says nothing');
    beat(b, 2);
    assert.equal(n.looks, looks, 'the classic skin: no look');
    globalThis.location = { search: '?skin=enhanced' };
    const doc = globalThis.document;
    delete globalThis.document;
    try {
      assert.equal(heraldOn(), false, 'no page (node, headless): nothing to hear it');
      beat(b, 2);
      assert.equal(n.looks, looks, 'no page: no look');
    } finally { globalThis.document = doc; }

    // a look that throws
    b.lens.look = () => { throw new Error('a broken entry'); };
    const warned = [];
    const w = console.warn;
    console.warn = (...a) => warned.push(a.join(' '));
    let fired;
    try { fired = [b.tick(0.1), b.tick(0.1), b.tick(0.1)]; } finally { console.warn = w; }
    assert.deepEqual(fired, [true, true, true], 'the machine ticked each time - the frame carried on');
    assert.equal(warned.length, 1, 'one warning, not one a tick');
    assert.match(warned[0], /\[quest herald\] the lens could not look \(a broken entry\)/);
  });
});

// ---------------------------------------------------------------
// THE MACHINE NEVER KNOWS
// ---------------------------------------------------------------

test('GUIDE3 THE MACHINE NEVER KNOWS - a whole game ticked through the bridge (a Place, a questor, %god on the quest\'s rolls, %n on DFRandom, a `say`, a clock that runs out), once with the herald listening and once without: the same save, popups, talk topics, DFRandom seed, quest rolls and engine draws - and the herald heard the quest begin, move and end (mutants: the loud read in the look; the reveal left on; the look off the machine\'s own rolls)', () => {
  const run = (listening) => onPage(() => {
    srand(99);
    resetUid(); ensureUidAtLeast(1000);   // DaggerfallUnity.NextUID is global and seeds %n: both games mint the same uids
    const mr = Math.random;
    let s = 12345, draws = 0;
    Math.random = () => { draws++; s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
    try {
      const clock = { now: 20000 };
      const popups = [], dialogs = [];
      const b = makeBridge({ world: makeWorld(), clock, popups, dialogs });
      const heard = [];
      const hear = questHerald.hear.bind(questHerald);
      questHerald.hear = (seen) => { heard.push(...seen.events.map((e) => e.type)); return hear(seen); };
      try {
        const rolls = seededRolls(3);
        beat(b);
        quiet(() => b.machine.startQuestByName('__GQUIET', 0, { rolls }));
        beat(b, 3);
        const q = questOf(b, '__GQUIET');
        clock.now += 60; q.startTask({ name: 'next' });
        beat(b, 4);
        clock.now += 86400 + 60;
        beat(b, 6);
        return { save: JSON.stringify(b.snapshot()), popups, dialogs, seed: getSeed(), rolls: rolls.calls, draws, heard, words: said() };
      } finally { delete questHerald.hear; }
    } finally { Math.random = mr; }
  }, { herald: listening });
  const on = run(true);
  const off = run(false);
  assert.equal(on.save, off.save, 'the same save');
  assert.deepEqual(on.popups, off.popups, 'the same popups');
  assert.ok(on.popups.length >= 1, 'the `say` was heard');
  assert.deepEqual(on.dialogs, off.dialogs, 'the same talk topics, in the same order');
  assert.ok(on.dialogs.length >= 1, 'the machine\'s own reads revealed topics - the herald\'s look added none');
  assert.equal(on.seed, off.seed, 'the same DFRandom state');
  assert.equal(on.rolls, off.rolls, 'the same draws from the quest\'s rolls');
  assert.equal(on.draws, off.draws, 'the same draws from the engine - the look drew none');
  assert.deepEqual(on.heard, ['started', 'urgent', 'updated', 'ended'], 'the herald heard the quest begin, cross its last day, move and end');
  assert.deepEqual(off.heard, [], 'unheard, the herald was never fed');
  assert.deepEqual(on.words, [['Quest ended', 'The Quiet Read']], 'one notice, and its last word');
});

// ---------------------------------------------------------------
// THE HUD'S CLOCK, THE STACK'S FACE
// ---------------------------------------------------------------

test('GUIDE3 THE HUD\'S CLOCK, THE STACK\'S FACE - a notice is one toast in the `aria-live` stack, its rows in three weights; under the HUD\'s hide gate it hides and its clock stops; shown again it runs out and slides away; off (the switch, the classic skin) the queue empties and the toasts leave (mutants: a row class dropped; the clock ticking while hidden; the hide door skipped)', () => {
  onPage((doc, clock) => {
    questHerald.hear({ quests: [view('7', DATED(' I agreed.'))], events: [{ type: 'started', id: '7', title: 'The Herald', main: true }] });
    let out = drawQuestHerald({ dt: 1 });
    assert.equal(out.length, 1);
    const panel = out[0];
    const stack = doc.getElementById(ENHANCED_NOTICE_ID);
    assert.equal(stack.attrs['aria-live'], 'polite', 'the stack is read aloud where the parchment never was');
    assert.equal(panel.attrs['aria-hidden'], 'true', 'AUDIT GUIDE H3: the herald\'s toast is silent in it - the herald speaks each notice whole through its own region (test/ui/quest/audit_guide.test.js)');
    assert.equal(panel.className, 'notice notice-toast notice-in', 'a toast: no hint, never dismissed');
    assert.equal(panel.dataset.owner, `${HERALD_OWNER}:${questHerald.frame().ids[0]}`, 'keyed by the notice\'s own id under the herald');
    const rows = panel.children[0].children;
    assert.deepEqual(rows.map((r) => [r.className, r.textContent]), [
      ['notice-row herald-kind', 'New quest - Main Quest'], ['notice-row herald-title main', 'The Herald'], ['notice-row herald-line', 'I agreed.'],
    ]);
    assert.equal(panel.children.find((c) => c.className === 'notice-hint'), undefined, 'no "click or press a key" on news');
    assert.equal(questHerald.rows[0].left, HERALD_SECONDS - 1);

    out = drawQuestHerald({ hidden: true, dt: 100 });
    assert.equal(panel.style.display, 'none', 'hidden under a window');
    assert.equal(questHerald.rows[0].left, HERALD_SECONDS - 1, 'and its clock stopped: news waits for the window to close');
    assert.equal(panel.className, 'notice notice-toast notice-in', 'hidden, not released');
    drawQuestHerald({ dt: 0.5 });
    assert.equal(panel.style.display, '');
    drawQuestHerald({ dt: HERALD_SECONDS });
    assert.equal(panel.className, 'notice notice-toast notice-out', 'run out: it slides away');
    assert.deepEqual(questHerald.rows, []);
    clock.fire(700); clock.fire(260);
    assert.ok(panel.removed, 'and the node goes with it');

    // off: the switch
    questHerald.hear({ quests: [], events: [{ type: 'ended', id: '9', title: 'Lost' }] });
    const [again] = drawQuestHerald({ dt: 0.1 });
    quiet(() => setPref(HERALD_PREF, false));
    assert.deepEqual(drawQuestHerald({ dt: 0.1 }), []);
    assert.equal(again.className, 'notice notice-toast notice-out', 'switched off: the toast leaves');
    assert.deepEqual(questHerald.rows, [], '...and the queue empties');
    assert.deepEqual(enhancedNoticeKeys(), []);
    // off: the classic skin
    quiet(() => setPref(HERALD_PREF, true));
    questHerald.hear({ quests: [], events: [{ type: 'ended', id: '9', title: 'Lost' }] });
    const [third] = drawQuestHerald({ dt: 0.1 });
    globalThis.location = { search: '?skin=classic' };
    drawQuestHerald({ dt: 0.1 });
    assert.equal(third.className, 'notice notice-toast notice-out', 'the classic skin: DFU says nothing');
    assert.deepEqual(questHerald.rows, []);
  });
});

// ---------------------------------------------------------------
// ONE CALL, EVERY HOST
// ---------------------------------------------------------------

test('GUIDE3 ONE CALL, EVERY HOST - drawHud draws the herald on its one call, OUTSIDE the skin\'s gate so off still reaches its hide door, on LV2\'s hide gate and the frame\'s seconds; the bridge hears the news after the machine\'s tick; the three hosts that hold quests tick the bridge and all four draw the HUD; the switch is a Features row on by default and the player\'s own online; the opening and the words have one home each (mutants: the draw inside the gate; news before the tick; the row\'s default)', () => {
  const hud = rd('src/ui/hud/hud.js');
  const call = hud.indexOf('\n  drawQuestHerald({ hidden: cursorActive || !hudRenderEnabled(), dt });\n');   // its own statement, at the body's level
  const gate = hud.indexOf("if (isEnhanced() && typeof document !== 'undefined') {\n    drawLevelNotices(");
  assert.ok(call > 0 && gate > call, 'drawHud draws the herald, before (outside) the enhanced gate');
  const bridge = rd('src/scenes/quest/questBridge.js');
  // PIN MOVED (QL1): the questlines' layer latches what each stamped quest showed between the tick and the news, so the
  // news it carries (an objective done) is the tick's own
  assert.match(bridge, /machine\.tick\(\);\n\s*updateTimer = 0;\n(?:\s*questlines\.look\(\);[^\n]*\n)?\s*news\(\);\n\s*return true;/, 'the news is heard after the machine\'s tick, on the tick that fired');
  assert.match(bridge, /const herald = heraldOn\(\), follow = followOn\(\);\n[\s\S]*?\n\s*if \(!herald && !follow\) \{ lookedLast = false; return; \}\n[\s\S]*?\n\s*try \{\n\s*const seen = lens\.look\(ctx\.questWhere \?\? \{\}\);/,
    'the gate stands before the look: no face listening, no look (GUIDE4 made the tracker a face, GUIDE5 the marks; AUDIT GUIDE T2 named the pair followOn)');
  const hosts = { 'src/scenes/world.js': /questBridge\.tick\(dt\)/, 'src/scenes/worldModes.js': /questBridge\?\.tick\(dt\)/, 'src/scenes/exterior.js': /questBridge\?\.tick\(dt\)/ };
  for (const [f, re] of Object.entries(hosts)) assert.match(rd(f), re, `${f} ticks the bridge`);
  for (const f of ['src/scenes/world.js', 'src/scenes/worldModes.js', 'src/scenes/exterior.js', 'src/scenes/dungeonContext.js']) {
    assert.match(rd(f), /\bdrawHud\(/, `${f} draws the HUD - the herald's one call`);
  }
  const row = FEATURES.find((f) => f.id === 'quest-herald');
  assert.ok(row, 'the switch is a Features row');
  assert.deepEqual([row.group, row.kinds, row.control.store, row.control.key, row.control.initial, row.control.online],
    ['interface', ['enhanced'], 'prefs', HERALD_PREF, true, 'player']);
  assert.equal(PREF_DEFAULTS[HERALD_PREF], true, 'RF4: the shelf derives the default from the row');
  // one home each
  assert.match(rd('src/ui/quest/questHerald.js'), /import \{ entryOpening, timeLeftWords, QUEST_URGENT_SECONDS \} from '\.\/questRail\.js';/, 'the opening, the time left and the day: the rail\'s, one home each (GUIDE5 gave the phrase its home; AUDIT GUIDE H7 the day)');
  for (const f of ['src/ui/quest/questHerald.js', 'src/ui/quest/questLens.js', 'src/scenes/quest/questBridge.js', 'src/ui/hud/hud.js']) {
    assert.doesNotMatch(rd(f), /DAY_NAMES|MONTH_NAMES/, `${f} keeps no copy of the date header`);
  }
  // THE HUD STAYS LIGHT. drawHud imports the herald, and the first full run of this slice met the cycle that makes
  // costly: place.js -> talkTopics -> ... -> save.js -> hudEscortFaces -> hud.js -> (the herald) -> the lens ->
  // place.js, whose SITE_TYPES the lens read at load before place.js had finished - a ReferenceError in every suite
  // that loaded the quest layer first. So the herald's own static imports must never reach the quest machine.
  const reach = new Set();
  const walk = (f) => {
    if (reach.has(f)) return;
    reach.add(f);
    const text = readFileSync(join(ROOT, f), 'utf8');
    for (const m of text.matchAll(/^\s*(?:import|export)\s[^'"]*?from\s+['"](\.[^'"]+)['"]|^\s*import\s+['"](\.[^'"]+)['"]|\bimport\(\s*['"](\.[^'"]+)['"]\s*\)/gm)) walk(join(dirname(f), m[1] ?? m[2] ?? m[3]).replace(/\\/g, '/'));   // AUDIT GUIDE O6: a bare and a dynamic import too
  };
  walk('src/ui/quest/questHerald.js');
  for (const f of ['src/ui/quest/questLens.js', 'src/systems/quest/place.js', 'src/systems/quest/machine.js', 'src/ui/hud/hud.js']) {
    assert.equal(reach.has(f), false, `the herald's imports reach ${f}`);
  }
  assert.equal(QUEST_URGENT_SECONDS, 86400, 'the "Under a day left" line is the lens\'s urgent crossing, one number');
});

// ---------------------------------------------------------------
// the opening over the corpus
// ---------------------------------------------------------------

test('GUIDE3 THE OPENING over the corpus - every message a quest of the 265 LOGS opens with words: never the date header, never past OPENING_MAX, cut with an ellipsis only where the first sentence is longer (the counts pinned) (mutants: the header kept; the cap off; the first sentence missed)', () => {
  const m = new QuestMachine({ nowSeconds: () => 100000, addDialog: () => {} });
  let logged = 0, headed = 0, cut = 0;
  const empty = [];
  srand(4242);
  for (const f of readdirSync(join(VENDOR, 'Quests')).filter((x) => x.endsWith('.txt')).sort()) {
    const src = readFileSync(join(VENDOR, 'Quests', f), 'utf8').replace(/^﻿/, '').split(/\r\n|\r|\n/);
    const ids = new Set(src.flatMap((l) => { const mm = /^\s*log (\d+) step \d+\s*$/.exec(l); return mm ? [Number(mm[1])] : []; }));
    if (!ids.size) continue;
    const q = quiet(() => m.scheduleQuest(src, 0, { rolls: seededRolls(logged + 1) }));
    for (const id of ids) {
      const msg = q.messages.get(id);
      if (!msg) continue;
      logged++;
      const lines = quiet(() => quietLines(msg));
      const opening = entryOpening(lines);
      if (/^\S+ the \d{1,2}(st|nd|rd|th) of /.test(lines?.[0] ?? '')) headed++;
      if (!opening) { empty.push(`${f}:${id}`); continue; }
      assert.ok(opening.length <= OPENING_MAX, `${f}:${id} opens past the cap: ${opening}`);
      assert.doesNotMatch(opening, /^\S+ the \d{1,2}(st|nd|rd|th) of [^:]+:/, `${f}:${id} opens with the date`);
      if (opening.endsWith('…')) cut++;
    }
  }
  assert.deepEqual(empty, [], 'every logged entry has words to open with');
  assert.deepEqual({ logged, headed, cut }, { logged: 408, headed: 395, cut: 55 },   // AUDIT GUIDE W4: a stop inside a closing quote ends a sentence (P0A01L00:1015)
    'the 408 entries the corpus logs: 395 open on the %qdt header, and 56 first sentences run past OPENING_MAX (at 100 it was 159)');
});
