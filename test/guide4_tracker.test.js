// GUIDE4 (2026-09-29, Mac: "How can we set the foundation and improve the quest system substantially? Like really
// modernize it, make it more accessible", then, of the Quest Guide arc: "This is your baby. Take your time") - THE
// TRACKER (ui/questTracker.js, bible/06-Systems/Quest-Guide-Arc.md): the quest you follow, as a card on the HUD. Its
// laws, each over the real producers:
//
//   WHICH QUEST - the one the player tracks, else the one the journal last changed (started, updated, urgent), else the
//     one written last; an ending lets go of both; nothing to follow, nothing drawn.
//   THE WORDS - the title (a main quest marked), the newest entry's opening under the card's own cap, where it points
//     in the lens's words, the time left in the journal's, urgent under a day.
//   THE PLAYER'S CHOICE IS KEPT - per character, in DFU's per-mod save slot, by the quest's uid; following is not kept.
//   THE BRIDGE FEEDS IT - every look, the baseline included, and the look answers the host's two questions, so the
//     card can say "(you are here)"; no face listening, no look.
//   THE MACHINE NEVER KNOWS - a whole game ticked with the tracker (and the host's questions) and without.
//   THE CARD - built once and updated, not rebuilt; hidden under the HUD's gate; its height published for the party
//     list to step under; off, it reaches its hide door.
//   THE JOURNAL'S TOGGLE - one Track button in both enhanced journal faces, and the journal opens on the HUD's quest.
//   ONE CALL, EVERY HOST - drawHud draws it outside the skin's gate, the hosts hand their questions, the party list
//     steps under it, the switch is a Features row, and its imports never reach the quest machine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import './chargenDom.mjs';   // the minimal DOM - globals (the journal faces mount on it)
import { resetUid, ensureUidAtLeast } from '../src/systems/quest/quest.js';
import { createQuestBridge } from '../src/scenes/questBridge.js';
import { REGION, makeWorld, seededRolls } from './guideWorld.mjs';
import { getSeed, srand } from '../src/formats/dfRandom.js';
import { entryOpening, remainWords } from '../src/ui/questRail.js';
import {
  QuestTracker, questTracker, drawQuestTracker, trackerOn, trackButton, _resetQuestTrackerForTests,
  TRACKER_PREF, TRACKER_ID, TRACKER_SAVE, TRACKER_OPENING_MAX, TRACKER_HEIGHT_VAR, TRACKER_GAP, TRACKER_WORDS,
} from '../src/ui/questTracker.js';
import { HERALD_PREF } from '../src/ui/questHerald.js';
import { MARKS_PREF } from '../src/ui/questMarks.js';   // GUIDE5: the marks follow the same model - off in these pins unless asked
import { modSaveRecords, restoreModSaveRecords, newGameModSaveRecords, registeredModSaveVendors } from '../src/systems/modSaveData.js';
import { setPref, PREF_DEFAULTS } from '../src/systems/uiPrefs.js';
import { FEATURES } from '../src/systems/features.js';
import { PARTY_CSS } from '../src/ui/partyPanel.js';
import { mountEnhancedMenu } from '../src/ui/enhancedMenu.js';
import { mountEnhancedChronicle } from '../src/ui/enhancedChronicle.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const quiet = (fn) => { const w = console.warn, i = console.info; console.warn = () => {}; console.info = () => {}; try { return fn(); } finally { console.warn = w; console.info = i; } };

// NO LIVE TIMER RUNS IN THIS SUITE (GUIDE2's law): the journal faces arm once-a-second intervals over a live clock;
// every one is recorded here instead, and every mount asserts none is left standing.
const intervals = new Map();
let nextInterval = 1;
globalThis.setInterval = (fn, ms) => { const id = nextInterval++; intervals.set(id, { fn, ms }); return id; };
globalThis.clearInterval = (id) => { intervals.delete(id); };

/** The switches for one test (the tracker on, the herald and the marks off unless asked), put back after, the model
 *  reset. */
function withSwitches(fn, { tracker = true, herald = false, marks = false } = {}) {
  quiet(() => { setPref(TRACKER_PREF, tracker); setPref(HERALD_PREF, herald); setPref(MARKS_PREF, marks); });
  _resetQuestTrackerForTests();
  try { return fn(); } finally {
    quiet(() => { setPref(TRACKER_PREF, true); setPref(HERALD_PREF, true); setPref(MARKS_PREF, true); });
    _resetQuestTrackerForTests();
  }
}

// ---------------------------------------------------------------
// the quests
// ---------------------------------------------------------------

const TRACK_A = [
  'Quest: __GTRACKA', 'DisplayName: Main Quest - The First Road', 'QRC:',
  'Message:  1010', '%qdt:', ' Find _pub_ in __pub_. The road is', ' long and the night is longer.', ' I have =timer_ days.', '',   // AUDIT GUIDE H1: a deadline the journal names
  'Message:  1011', '%qdt:', ' Now go to ___keep_ in ____keep_.', '',
  'QBN:',
  'Place _pub_ local tavern',
  'Place _keep_ permanent Llugwych',
  'Clock _timer_ 3.00:00', '',
  '_timer_ task:', ' end quest', '',
  '_next_ task:', ' log 1011 step 1', '',
  '_win_ task:', ' give pc nothing', ' end quest', '',
  'log 1010 step 0',
  'start timer _timer_',
];
const TRACK_B = [
  'Quest: __GTRACKB', 'DisplayName: The Second Road', 'QRC:',
  'Message:  1010', ' A plain entry with no place.', '',
  'Message:  1011', ' A second entry.', '',
  'QBN:',
  '_next_ task:', ' log 1011 step 1', '',
  '_win_ task:', ' give pc nothing', ' end quest', '',
  'log 1010 step 0',
];
// GUIDE1's quiet-read quest, for the machine's pin: a Place, a questor, %god on the quest's rolls, %n on DFRandom, a
// `say`, a clock that runs out.
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
const SOURCES = { __GTRACKA: TRACK_A, __GTRACKB: TRACK_B, __GQUIET: QUIET_SRC };

function makeBridge({ clock, questWhere = undefined, popups = [], dialogs = [] }) {
  return quiet(() => createQuestBridge({
    data: { readListTable: () => null, getQuestSourceLines: (n) => SOURCES[n] ?? null },
    world: makeWorld(),
    classicSeconds: () => clock.now,
    playerEntity: { name: 'Hero', level: 3, gender: 'male' },
    getReputation: () => 0,
    dateTimeString: () => '13:30:00 on 4th of Morning Star, 3E405',
    midDateTimeString: () => '13:30:00 04 Morning Star 3E405',
    cityName: () => 'Bigtown',
    showPopup: (q, tokens) => popups.push(tokens.map((t) => t.text ?? '').join('|')),
    addDialog: (...a) => dialogs.push(a.join(':')),
    ...(questWhere ? { questWhere } : {}),
  }));
}
const questOf = (b, name) => [...b.machine.quests.values()].find((q) => q.questName === name);
const beat = (b, n = 1) => quiet(() => { for (let i = 0; i < n; i++) b.tick(0.1); });
const start = (b, name, seed = 7) => quiet(() => b.machine.startQuestByName(name, 0, { rolls: seededRolls(seed) }));
function countLooks(b) {
  const look = b.lens.look.bind(b.lens);
  const n = { looks: 0, wheres: [] };
  b.lens.look = (where) => { n.looks++; n.wheres.push(where); return look(where); };
  return n;
}

// ---------------------------------------------------------------
// WHICH QUEST / THE WORDS - the model, pure
// ---------------------------------------------------------------

const view = (id, { title = `Q${id}`, updatedAt = 0, lines = [' An entry.'], clockSeconds = null, main = false, where = null } = {}) =>
  ({ id, title, main, updatedAt, latest: { lines }, clockSeconds, urgent: clockSeconds != null && clockSeconds < 86400, words: where ? { where } : null });

test('GUIDE4 WHICH QUEST - the tracked quest, else the one the journal last changed (started, updated or urgent), else the one written last; an ending lets go of the followed and the tracked alike; a toggle on the tracked quest stops tracking it; forgetting keeps the choice; nothing to follow, nothing drawn (mutants: the order of the three inverted; an ending that keeps the pin; the news not followed; forget dropping the choice)', () => {
  const t = new QuestTracker();
  assert.equal(t.frame(), null, 'no quest: the card says nothing');
  t.hear({ quests: [view('1', { updatedAt: 10 }), view('2', { updatedAt: 20 }), view('3', { updatedAt: 5 })], events: [] });
  assert.equal(t.tracked().id, '2', 'a baseline: the quest written last');
  assert.equal(t.frame(), null, 'TRACK-ONLY (the owner: "When you dont track a quest it should never appear on the screen!"): followed, never shown');
  t.hear({ quests: [view('1', { updatedAt: 10 }), view('2', { updatedAt: 20 }), view('3', { updatedAt: 5 })], events: [{ type: 'urgent', id: '3' }] });
  assert.equal(t.tracked().id, '3', 'news: the quest the journal last changed, whatever it was written');
  t.hear({ quests: [view('1', { updatedAt: 30 }), view('2', { updatedAt: 20 }), view('3', { updatedAt: 5 })], events: [{ type: 'updated', id: '1' }] });
  assert.equal(t.tracked().id, '1');
  assert.equal(t.toggle('2'), '2', 'the journal\'s Track');
  assert.equal(t.tracked().id, '2', 'the tracked quest outranks the news');
  t.hear({ quests: [view('1', { updatedAt: 40 }), view('2', { updatedAt: 20 })], events: [{ type: 'started', id: '1' }] });
  assert.equal(t.tracked().id, '2', '...whatever the news');
  assert.equal(t.frame().pinned, true);
  t.hear({ quests: [view('1', { updatedAt: 40 })], events: [{ type: 'completed', id: '2' }] });
  assert.equal(t.pinned, null, 'a finished quest is tracked no more');
  assert.equal(t.tracked().id, '1', '...and the card follows the news again');
  t.hear({ quests: [view('4', { updatedAt: 50 }), view('5', { updatedAt: 60 })], events: [{ type: 'ended', id: '1' }] });
  assert.equal(t.follow, null, 'the followed quest ended');
  assert.equal(t.tracked().id, '5', 'the one written last');
  assert.equal(t.toggle('4'), '4');
  assert.equal(t.toggle('4'), null, 'Track pressed again: tracking stops');
  assert.equal(t.toggle(null), null);
  t.toggle('4');
  t.forget();
  assert.deepEqual([t.views, t.follow, t.pinned], [[], null, '4'], 'a load forgets what it saw and followed, never what the player chose');
  assert.equal(t.frame(), null, '...and says nothing until the next look');
  t.hear({ quests: [view('5', { updatedAt: 60 })], events: [] });
  assert.equal(t.tracked().id, '5', 'a tracked quest the look does not carry is followed no more (the quest it names is not in the journal)');
  assert.equal(t.frame(), null, 'TRACK-ONLY: and the card shows nothing - an untracked quest is on no screen');
  assert.equal(t.shown(), null);
  const tie = new QuestTracker();
  tie.hear({ quests: [view('7', { updatedAt: 9 }), view('8', { updatedAt: 9 })], events: [] });
  assert.equal(tie.tracked().id, '7', 'a tie: the walk\'s order (the journal\'s)');
});

test('GUIDE4 THE WORDS - the title (a main quest marked), the newest entry\'s opening under the card\'s own cap, where it points in the lens\'s words, the time left in the journal\'s words and urgent under a day; a quest with no clock and no place says neither (mutants: the herald\'s cap on the card; the time without its word; the urgent flag dropped)', () => {
  const t = new QuestTracker();
  const long = ['Sundas the 1st of Morning Star:', ' The Fighters Guild of Daggerfall has hired me to kill a troublesome', ' werewolf, wereboar, or whatever, in its lair, Castle Llugwych.'];
  t.hear({ quests: [view('1', { title: 'The Beast', main: true, lines: long, clockSeconds: 80000, where: `Llugwych in ${REGION} province` })], events: [] });
  assert.equal(t.frame(), null, 'TRACK-ONLY: the main quest untracked says nothing');
  t.toggle('1');
  assert.deepEqual(t.frame(), {
    id: '1', title: 'The Beast', main: true, pinned: true,
    opening: entryOpening(long, TRACKER_OPENING_MAX),
    where: `Llugwych in ${REGION} province`,
    note: '',
    time: `Main Quest - ${remainWords(80000)} left`,   // AUDIT GUIDE U11: a main quest said on the time row
    urgent: true,
  });
  assert.equal(TRACKER_OPENING_MAX, 64, 'two lines of the card, cut at a word');
  assert.ok(t.frame().opening.length <= TRACKER_OPENING_MAX && t.frame().opening.endsWith('…'), 'two short lines: the card is quieter than the herald');
  assert.equal(t.frame().time, `${TRACKER_WORDS.main} - ${TRACKER_WORDS.left(80000)}`);
  const plain = new QuestTracker();
  plain.hear({ quests: [view('2', { lines: [' Just words.'] })], events: [] });
  plain.toggle('2');
  assert.deepEqual([plain.frame().where, plain.frame().time, plain.frame().urgent, plain.frame().main], ['', '', false, false]);
  assert.equal(plain.frame().opening, 'Just words.');
});

// ---------------------------------------------------------------
// THE PLAYER'S CHOICE IS KEPT
// ---------------------------------------------------------------

test('GUIDE4 THE PLAYER\'S CHOICE IS KEPT - the tracked quest rides DFU\'s per-mod save slot under the port\'s own name, by uid: a save writes it, a load restores it and forgets what the last game followed, a save without the record (or a record that is not one) tracks nothing, and a new character tracks nothing (mutants: the slot unregistered; the load keeping the follow; a junk record taken)', () => {
  withSwitches(() => {
    assert.ok(registeredModSaveVendors().includes(TRACKER_SAVE), 'registered when the module loads, as the Broker\'s record is');
    questTracker.toggle('1042');
    assert.deepEqual(modSaveRecords()[TRACKER_SAVE], { pinned: '1042' }, 'a save writes the choice');
    questTracker.hear({ quests: [view('9')], events: [{ type: 'updated', id: '9' }] });
    restoreModSaveRecords({ [TRACKER_SAVE]: { pinned: '2001' } });
    assert.deepEqual([questTracker.pinned, questTracker.follow, questTracker.views], ['2001', null, []], 'a load: the save\'s choice, and nothing of the last game');
    restoreModSaveRecords({});
    assert.equal(questTracker.pinned, null, 'a save taken before the tracker: its NewSaveData');
    for (const junk of [{ pinned: 42 }, { pinned: '' }, 'x', null]) {
      questTracker.toggle('5');
      restoreModSaveRecords({ [TRACKER_SAVE]: junk });
      assert.equal(questTracker.pinned, null, `a record that is not one tracks nothing: ${JSON.stringify(junk)}`);
    }
    questTracker.toggle('7');
    newGameModSaveRecords();
    assert.equal(questTracker.pinned, null, 'a new character tracks nothing');
  });
});

// ---------------------------------------------------------------
// THE BRIDGE FEEDS IT
// ---------------------------------------------------------------

test('GUIDE4 THE BRIDGE FEEDS IT - over the real bridge and machine: the tracker hears every look, the BASELINE too (a quest running at the first look is on the card at once), follows the news, keeps a tracked quest through it and lets go at its ending; the look answers the host\'s own two questions, so the card says "(you are here)"; with neither face listening there is no look at all (mutants: the baseline withheld; the host\'s questions not asked; a look with no face)', () => {
  withSwitches(() => {
    const clock = { now: 1000 };
    const questWhere = { canFindPlace: () => true, currentLocationName: () => 'Bigtown' };
    const b = makeBridge({ clock, questWhere });
    const n = countLooks(b);
    start(b, '__GTRACKA');
    beat(b);
    assert.equal(n.looks, 1);
    assert.equal(n.wheres[0], questWhere, 'the host\'s questions, handed to the look');
    // TRACK-ONLY (the owner: "When you dont track a quest it should never appear on the screen!"): the baseline is
    // FOLLOWED at once (the journal opens on it), and on no screen until it is tracked
    assert.equal(questTracker.frame(), null, 'running, untracked: on no screen');
    assert.equal(questTracker.tracked().title, 'The First Road', 'the baseline is followed at once - the quests as they stand');
    const a = questOf(b, '__GTRACKA');
    questTracker.toggle(String(a.uid));
    let f = questTracker.frame();
    assert.equal(f.title, 'The First Road', 'tracked: on the card');
    assert.equal(f.opening, 'Find The Feather and Dog in Bigtown.');
    assert.equal(f.where, `The Feather and Dog, Bigtown in ${REGION} province (you are here)`, 'the host said where the player stands');
    assert.equal(f.time, `${remainWords(3 * 86400)} left`);
    assert.equal(f.pinned, true);
    questTracker.toggle(String(a.uid));
    assert.equal(questTracker.frame(), null, 'untracked again: gone from the screen');

    clock.now = 1100; start(b, '__GTRACKB', 9); beat(b);
    assert.equal(questTracker.tracked().title, 'The Second Road', 'a new quest is news: the journal follows it');
    assert.equal(questTracker.frame(), null, '...and the screen shows nothing of it');
    clock.now = 1200; a.startTask({ name: 'next' }); beat(b);
    assert.equal(questTracker.tracked().title, 'The First Road', 'the first quest wrote: the journal follows it back');
    questTracker.toggle(String(a.uid));
    f = questTracker.frame();
    assert.equal(f.opening, `Now go to Llugwych in ${REGION}.`, 'the newest entry\'s opening');
    questTracker.toggle(String(a.uid));
    const bq = questOf(b, '__GTRACKB');
    questTracker.toggle(String(bq.uid));
    clock.now = 1300; a.startTask({ name: 'win' }); beat(b, 6);
    f = questTracker.frame();
    assert.equal(f.title, 'The Second Road', 'tracked: the other quest\'s ending is not this card\'s news');
    assert.equal(f.pinned, true);
    clock.now = 1400; bq.startTask({ name: 'win' }); beat(b, 6);
    assert.equal(questTracker.frame(), null, 'the tracked quest ended: let go, and with nothing left to follow the card says nothing');
    assert.equal(questTracker.pinned, null);

    const looks = n.looks;
    quiet(() => setPref(TRACKER_PREF, false));
    beat(b, 3);
    assert.equal(n.looks, looks, 'neither face listening: no look at all');
    quiet(() => { setPref(TRACKER_PREF, true); });
    const d = globalThis.document;
    delete globalThis.document;
    try {
      assert.equal(trackerOn(), false, 'no page (node, headless): no card to draw, and so nothing worth a look');
      beat(b, 2);
      assert.equal(n.looks, looks, 'no page: no look');
    } finally { globalThis.document = d; }
    quiet(() => { setPref(TRACKER_PREF, false); setPref(HERALD_PREF, true); });
    beat(b);
    assert.equal(n.looks, looks + 1, 'the herald alone still looks');
  });
});

// ---------------------------------------------------------------
// THE MACHINE NEVER KNOWS
// ---------------------------------------------------------------

test('GUIDE4 THE MACHINE NEVER KNOWS - a whole game ticked through the bridge (a Place, a questor, %god on the quest\'s rolls, %n on DFRandom, a `say`, a clock that runs out), once with the tracker listening and the host\'s two questions asked at every look, once with no face at all: the same save, popups, talk topics, DFRandom seed, quest rolls and engine draws (mutants: the loud read in the look; the reveal left on)', () => {
  const run = (tracking) => withSwitches(() => {
    srand(99);
    resetUid(); ensureUidAtLeast(1000);
    const mr = Math.random;
    let s = 12345, draws = 0;
    Math.random = () => { draws++; s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
    try {
      const clock = { now: 20000 };
      const popups = [], dialogs = [];
      const b = makeBridge({ clock, popups, dialogs, questWhere: { canFindPlace: () => true, currentLocationName: () => 'Bigtown' } });
      const rolls = seededRolls(3);
      beat(b);
      quiet(() => b.machine.startQuestByName('__GQUIET', 0, { rolls }));
      beat(b, 3);
      questTracker.toggle(String(questOf(b, '__GQUIET').uid));   // TRACK-ONLY: the card shows a tracked quest alone
      const seen = questTracker.frame();
      const q = questOf(b, '__GQUIET');
      clock.now += 60; q.startTask({ name: 'next' });
      beat(b, 4);
      clock.now += 86400 + 60;
      beat(b, 6);
      return { save: JSON.stringify(b.snapshot()), popups, dialogs, seed: getSeed(), rolls: rolls.calls, draws, seen };
    } finally { Math.random = mr; }
  }, { tracker: tracking });
  const on = run(true);
  const off = run(false);
  assert.equal(on.save, off.save, 'the same save');
  assert.deepEqual(on.popups, off.popups, 'the same popups');
  assert.ok(on.popups.length >= 1);
  assert.deepEqual(on.dialogs, off.dialogs, 'the same talk topics, in the same order');
  assert.equal(on.seed, off.seed, 'the same DFRandom state');
  assert.equal(on.rolls, off.rolls, 'the same draws from the quest\'s rolls');
  assert.equal(on.draws, off.draws, 'the same draws from the engine');
  assert.match(on.seen.where, /The Feather and Dog, Bigtown in .* province \(you are here\)/, 'the card saw the quest - its questor\'s tavern, underfoot');
  assert.equal(off.seen, null, 'no face: nothing seen');
});

// ---------------------------------------------------------------
// THE CARD
// ---------------------------------------------------------------

/** A page the card builds on: text writes counted, the root's variables recorded. */
function cardPage() {
  const writes = { text: 0 };
  const node = (tag) => {
    const n = {
      tagName: tag.toUpperCase(), children: [], parent: null, className: '', id: '', attrs: {}, _t: '', offsetHeight: 0,
      style: { display: '', setProperty(k, v) { this[k] = v; } },
      get textContent() { return this._t; }, set textContent(v) { writes.text++; this._t = String(v); },
      append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
      setAttribute(k, v) { n.attrs[k] = v; },
      remove() { if (n.parent) { n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; } n.removed = true; },
    };
    return n;
  };
  const doc = { createElement: node, head: node('head'), body: node('body'), documentElement: node('html') };
  const byId = (n, id) => { if (n.id === id) return n; for (const c of n.children) { const f = byId(c, id); if (f) return f; } return null; };
  doc.getElementById = (id) => byId(doc.head, id) ?? byId(doc.body, id);
  return { doc, writes, vars: doc.documentElement.style };
}
const rowsOf = (card) => {
  const [head, line, where, note, time] = card.children;
  return { mark: head.children[0], title: head.children[1], line, where, note, time };
};

test('GUIDE4 THE CARD - built once on the page, aria-hidden (the herald speaks), its rows the frame\'s words; a still frame writes nothing; a row with nothing to say is hidden; a main quest and an urgent clock are classes; under the HUD\'s gate it hides and publishes no height; its height, plus a gap, is published for the party list only when what it says changed; off (the switch, the classic skin) it is taken off the page and the last game\'s follow forgotten, the choice kept (mutants: rebuilt every frame; the height published while hidden; the hide door skipped)', () => {
  withSwitches(() => {
    const { doc, writes, vars } = cardPage();
    assert.equal(drawQuestTracker({ doc }), null, 'nothing to follow: nothing on the page');
    assert.equal(doc.getElementById(TRACKER_ID), null);
    questTracker.hear({ quests: [view('1', { title: 'The Beast', main: true, lines: [' Kill it.'], clockSeconds: 80000, where: 'Llugwych in Devilrock province' })], events: [] });
    // TRACK-ONLY (the owner: "When you dont track a quest it should never appear on the screen!"): followed, never drawn
    assert.equal(drawQuestTracker({ doc }), null, 'an untracked quest: nothing on the page');
    assert.equal(doc.getElementById(TRACKER_ID), null);
    questTracker.toggle('1');
    const f = drawQuestTracker({ doc });
    const card = doc.getElementById(TRACKER_ID);
    assert.ok(card, 'tracked: built');
    assert.equal(card.attrs['aria-hidden'], 'true');
    assert.equal(card.className, 'qtrack main urgent');
    const r = rowsOf(card);
    assert.deepEqual([r.mark.textContent, r.title.textContent, r.line.textContent, r.where.textContent, r.time.textContent],
      ['◆', 'The Beast', 'Kill it.', 'Llugwych in Devilrock province', f.time], 'tracked: the filled mark');
    assert.equal(vars[TRACKER_HEIGHT_VAR], '0px', 'a card of no measured height publishes none');
    const w = writes.text;
    drawQuestTracker({ doc });
    assert.equal(writes.text, w, 'a still frame writes nothing');
    card.offsetHeight = 64;
    questTracker.hear({ quests: [view('1', { title: 'The Beast', main: true, lines: [' Kill it, now.'], clockSeconds: 80000, where: 'Llugwych in Devilrock province' })], events: [] });
    drawQuestTracker({ doc });
    assert.equal(r.line.textContent, 'Kill it, now.');
    assert.equal(vars[TRACKER_HEIGHT_VAR], `${64 + TRACKER_GAP}px`, 'what it says changed: measured and published for the party list');
    assert.equal(doc.getElementById(TRACKER_ID), card, 'the same card - updated, not rebuilt');
    questTracker.hear({ quests: [view('1', { title: 'The Beast', lines: [' Kill it.'] })], events: [] });
    drawQuestTracker({ doc });
    assert.equal(card.className, 'qtrack', 'no longer main or urgent');
    assert.equal(r.where.style.display, 'none', 'a row with nothing to say is hidden');
    assert.equal(r.time.style.display, 'none');

    drawQuestTracker({ doc, hidden: true });
    assert.equal(card.style.display, 'none', 'under a window');
    assert.equal(vars[TRACKER_HEIGHT_VAR], '0px', 'and the party list takes the line back');
    drawQuestTracker({ doc });
    assert.equal(card.style.display, '');
    assert.equal(vars[TRACKER_HEIGHT_VAR], `${64 + TRACKER_GAP}px`, 'shown again: re-measured');

    quiet(() => setPref(TRACKER_PREF, false));
    assert.equal(drawQuestTracker({ doc }), null);
    assert.ok(card.removed, 'off: taken off the page');
    assert.equal(vars[TRACKER_HEIGHT_VAR], '0px');
    assert.equal(questTracker.views.length, 1, 'the model is not the card\'s to forget (GUIDE5: the marks follow it too - the bridge forgets it when neither face is on)');
    assert.equal(questTracker.pinned, '1', 'and the choice is kept');
    quiet(() => setPref(TRACKER_PREF, true));
    questTracker.hear({ quests: [view('1')], events: [] });
    drawQuestTracker({ doc });
    const again = doc.getElementById(TRACKER_ID);
    assert.ok(again && again !== card, 'on again: a new card');
    globalThis.location = { search: '?skin=classic' };
    try {
      assert.equal(trackerOn(), false, 'the classic skin: DFU\'s HUD says nothing of quests');
      drawQuestTracker({ doc });
      assert.ok(again.removed);
    } finally { delete globalThis.location; }
  });
});

// ---------------------------------------------------------------
// THE JOURNAL'S TOGGLE
// ---------------------------------------------------------------

function twoQuests() {
  const clock = { now: 1000 };
  const b = makeBridge({ clock });
  start(b, '__GTRACKA');
  quiet(() => { b.machine.tick(); b.machine.tick(); });   // the first quest writes its entry at 1000
  clock.now = 1100;
  start(b, '__GTRACKB', 9);
  quiet(() => { b.machine.tick(); b.machine.tick(); });   // ...the second at 1100: it is the one written last
  return { b, a: questOf(b, '__GTRACKA'), bq: questOf(b, '__GTRACKB') };
}
function withPauseTab(b, fn) {
  const host = globalThis.document.createElement('div');
  const menu = mountEnhancedMenu(host, { mode: 'pause', hooks: { questLog: () => b.questLog() }, onAction: () => {}, at: 'quests' });
  try { return fn(host, menu); } finally { menu.unmount(); assert.equal(intervals.size, 0, 'the tab\'s timer went with it'); }
}
const pinsIn = (host) => host.querySelectorAll('.qtrack-pin');
const selectedTitle = (host) => host.querySelector('.px-qname').querySelectorAll('h3')[0].textContent;

test('GUIDE4 THE JOURNAL\'S TOGGLE - the pause window\'s Quests tab: one Track button beside the clock, a toggle (aria-pressed, labelled with the quest) that tracks the quest on the HUD and, pressed again, stops; the tab OPENS on the quest the HUD shows; with the tracker off there is no button and the tab opens on the first row (mutants: the button without the switch; the toggle one-way; the journal ignoring the HUD)', () => {
  withSwitches(() => {
    const { b, a, bq } = twoQuests();
    questTracker.hear(b.lens.look());   // what the bridge's tick hands it
    withPauseTab(b, (host) => {
      assert.equal(selectedTitle(host), 'The Second Road', 'the tab opens on the HUD\'s quest - the one written last');
      let pins = pinsIn(host);
      assert.equal(pins.length, 1, 'one toggle, on the quest shown');
      assert.equal(pins[0].textContent, TRACKER_WORDS.track);
      assert.equal(pins[0].attrs['aria-pressed'], 'false');
      assert.equal(pins[0].attrs['aria-label'], TRACKER_WORDS.trackLabel('The Second Road'));
      pins[0].click();
      assert.equal(questTracker.pinned, String(bq.uid), 'tracked');
      pins = pinsIn(host);
      assert.equal(pins[0].textContent, TRACKER_WORDS.track, 'AUDIT GUIDE T6/U13: the same words - the state is aria-pressed (the toggle changed in place, T5)');
      assert.equal(pins[0].attrs['aria-pressed'], 'true');
      assert.equal(pins[0].attrs['aria-label'], TRACKER_WORDS.trackLabel('The Second Road'), 'AUDIT GUIDE T6/U13: one name');
      pins[0].click();
      assert.equal(questTracker.pinned, null, 'pressed again: tracking stops');
    });
    questTracker.toggle(String(a.uid));
    withPauseTab(b, (host) => {
      assert.equal(selectedTitle(host), 'The First Road', 'the tracked quest is the one the journal opens on');
      assert.equal(pinsIn(host)[0].attrs['aria-pressed'], 'true');
    });
    quiet(() => setPref(TRACKER_PREF, false));
    withPauseTab(b, (host) => {
      assert.equal(pinsIn(host).length, 0, 'the tracker off: no toggle');
      assert.equal(selectedTitle(host), 'The First Road', 'and the first row, as before GUIDE4');
    });
  });
});

test('GUIDE4 THE JOURNAL\'S TOGGLE - the chronicle: every live quest\'s card carries the same Track toggle (one home, ui/questTracker.js trackButton) in its state line, a card with no place and no clock included; pressed, the quest is tracked and the window redraws with the choice; the tracker off, none (mutants: the toggle only where there is a place; the chronicle\'s own copy)', () => {
  withSwitches(() => {
    const { b, bq } = twoQuests();
    globalThis.window ??= globalThis;
    const host = globalThis.document.createElement('div');
    globalThis.document.body.append(host);   // on the page, as the chronicle is: a press answers every toggle there
    const view2 = mountEnhancedChronicle(host, { section: 'quests', questLog: () => b.questLog() });
    try {
      let pins = pinsIn(host);
      assert.equal(pins.length, 2, 'both live quests - the second has no place and no clock');
      const second = pins.find((p) => p.attrs['aria-label'] === TRACKER_WORDS.trackLabel('The Second Road'));
      const first = pins.find((p) => p !== second);
      assert.ok(second && first);
      first.click();   // the first tracked, then the second: the first's toggle must let go
      assert.deepEqual(pinsIn(host).map((p) => p.attrs['aria-pressed']).sort(), ['false', 'true']);
      second.click();
      assert.equal(questTracker.pinned, String(bq.uid));
      pins = pinsIn(host);
      assert.deepEqual(pins.map((p) => p.attrs['aria-pressed']).sort(), ['false', 'true'], 'redrawn: one tracked');
    } finally { view2.destroy(); host.remove(); assert.equal(intervals.size, 0); }
    quiet(() => setPref(TRACKER_PREF, false));
    const host2 = globalThis.document.createElement('div');
    const view3 = mountEnhancedChronicle(host2, { section: 'quests', questLog: () => b.questLog() });
    try { assert.equal(pinsIn(host2).length, 0, 'the tracker off: none'); } finally { view3.destroy(); }
    assert.equal(typeof trackButton, 'function');
  });
});

// ---------------------------------------------------------------
// ONE CALL, EVERY HOST
// ---------------------------------------------------------------

test('GUIDE4 ONE CALL, EVERY HOST - drawHud draws the card on its one call, outside the skin\'s gate, on the HUD\'s hide gate; the bridge feeds the tracker every look and asks the host\'s questions; the street hands both questions, the fixed-town route the one it can answer; the party list steps under the card; the Toggle has one home; the switch is a Features row, on and the player\'s own online; and the tracker\'s imports never reach the quest machine (mutants: the draw inside the gate; the host\'s questions dropped; the party list over the card)', () => {
  const hud = rd('src/ui/hud.js');
  const call = hud.indexOf('\n  drawQuestTracker({ hidden: cursorActive || !hudRenderEnabled() });');
  const gate = hud.indexOf("if (isEnhanced() && typeof document !== 'undefined') {\n    drawLevelNotices(");
  assert.ok(call > 0 && gate > call, 'drawHud draws the card before (outside) the enhanced gate');
  const bridge = rd('src/scenes/questBridge.js');
  assert.match(bridge, /const seen = lens\.look\(ctx\.questWhere \?\? \{\}\);\n\s*if \(follow\) questTracker\.hear\(seen\);\n\s*if \(herald\) questHerald\.hear\(seen\);/, 'every look reaches the tracker\'s model while a face follows, the baseline too (AUDIT GUIDE L4: inside the try now; H11: the herald\'s baseline is the lens\'s)');
  assert.match(bridge, /if \(!follow && \(questTracker\.views\.length \|\| questTracker\.follow != null\)\) questTracker\.forget\(\);/, 'no face following: the bridge forgets what was followed');
  assert.match(bridge, /lens\.reset\(\);[^\n]*\n\s*questTracker\.forget\(\);/, 'a load forgets what the last game followed');
  assert.match(rd('src/scenes/world.js'), /questWhere: \{ canFindPlace: \(regionName, name\) => canFindPlace\(maps, mapDict, regionName, name, questPlacePixel\), currentLocationName: \(\) => _questLoc\(\)\?\.name \?\? '' \},/, 'the street: both questions (AUDIT GUIDE O3: through the host\'s memo)');
  assert.match(rd('src/scenes/exterior.js'), /questWhere: \{ currentLocationName: \(\) => dfLocation\.name \?\? locationName \},/, 'the fixed-town route: the city it stands in, no map to ask');
  assert.match(PARTY_CSS, /\.dfparty \{[^}]*top: calc\(92px \+ var\(--dfquest-h, 0px\)/, 'the party list steps under the card');
  assert.match(PARTY_CSS, /\.dfparty\.touch \{ top: calc\(76px \+ var\(--dfquest-h, 0px\)/);
  assert.equal(TRACKER_HEIGHT_VAR, '--dfquest-h');
  for (const f of ['src/ui/enhancedMenu.js', 'src/ui/enhancedChronicle.js']) {
    assert.match(rd(f), /trackButton\(document, /, `${f} draws the one toggle`);
    assert.doesNotMatch(rd(f), /qtrack-pin|TRACKER_WORDS/, `${f} keeps no copy of it`);
  }
  const row = FEATURES.find((f) => f.id === 'quest-tracker');
  assert.ok(row);
  assert.deepEqual([row.group, row.kinds, row.control.store, row.control.key, row.control.initial, row.control.online],
    ['interface', ['enhanced'], 'prefs', TRACKER_PREF, true, 'player']);
  assert.equal(FEATURES.findIndex((f) => f.id === 'quest-tracker'), FEATURES.findIndex((f) => f.id === 'quest-herald') + 1, 'beside the herald');
  assert.equal(PREF_DEFAULTS[TRACKER_PREF], true);
  // THE HUD STAYS LIGHT (GUIDE3's lesson): the HUD imports the tracker, so its imports never reach the quest machine.
  const reach = new Set();
  const walk = (f) => {
    if (reach.has(f)) return;
    reach.add(f);
    for (const m of readFileSync(join(ROOT, f), 'utf8').matchAll(/^\s*(?:import|export)\s[^'"]*?from\s+['"](\.[^'"]+)['"]|^\s*import\s+['"](\.[^'"]+)['"]|\bimport\(\s*['"](\.[^'"]+)['"]\s*\)/gm)) walk(join(dirname(f), m[1] ?? m[2] ?? m[3]).replace(/\\/g, '/'));   // AUDIT GUIDE O6: a bare and a dynamic import too
  };
  walk('src/ui/questTracker.js');
  for (const f of ['src/ui/questLens.js', 'src/systems/quest/place.js', 'src/systems/quest/machine.js', 'src/ui/hud.js']) {
    assert.equal(reach.has(f), false, `the tracker's imports reach ${f}`);
  }
});
