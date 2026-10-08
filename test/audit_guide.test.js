// AUDIT GUIDE (2026-09-29, Mac: "Lets do an audit on this before we merge") - the Quest Guide arc (GUIDE1-GUIDE5)
// read by eight lenses over a frozen tree before it merges: bible/01-Overview/Audit-Guide.md. Each pin FAILED on the
// unfixed tree for its finding's reason; each fix in src carries an `AUDIT GUIDE <ID>` comment.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import './chargenDom.mjs';   // the minimal DOM - globals (the journal faces mount on it)
import { resetUid, ensureUidAtLeast } from '../src/systems/quest/quest.js';
import { createQuestBridge } from '../src/scenes/questBridge.js';
import { makeWorld, seededRolls } from './guideWorld.mjs';
import { setPref } from '../src/systems/uiPrefs.js';
import { QuestLens } from '../src/ui/questLens.js';
import { QUEST_URGENT_SECONDS } from '../src/ui/questRail.js';
import { QuestHerald, questHerald, drawQuestHerald, HERALD_PREF, HERALD_SECONDS, HERALD_MAX } from '../src/ui/questHerald.js';
import { questTracker, drawQuestTracker, trackButton, TRACKER_PREF, _resetQuestTrackerForTests } from '../src/ui/questTracker.js';
import { MARKS_PREF } from '../src/ui/questMarks.js';
import { hideHudTextSurfaces } from '../src/ui/hud.js';
import { destroyEnhancedNotice, _setNoticeClockForTests } from '../src/ui/enhancedNotice.js';
import { mountEnhancedMenu } from '../src/ui/enhancedMenu.js';
import { mountEnhancedChronicle } from '../src/ui/enhancedChronicle.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const quiet = (fn) => { const w = console.warn, i = console.info; console.warn = () => {}; console.info = () => {}; try { return fn(); } finally { console.warn = w; console.info = i; } };

// no live timer runs here: the journal faces' once-a-second intervals are recorded and dropped
globalThis.setInterval = () => 0;
globalThis.clearInterval = () => {};
globalThis.window ??= globalThis;   // the journal faces read the window's size

/** The page's skin and the three switches for one test; everything put back after. */
function withSwitches(fn, { herald = false, tracker = false, marks = false, skin = 'enhanced' } = {}) {
  const had = Object.hasOwn(globalThis, 'location') ? globalThis.location : undefined;
  globalThis.location = { search: `?skin=${skin}` };
  quiet(() => { setPref(HERALD_PREF, herald); setPref(TRACKER_PREF, tracker); setPref(MARKS_PREF, marks); });
  questHerald.clear();
  _resetQuestTrackerForTests();
  try { return fn(); } finally {
    if (had === undefined) delete globalThis.location; else globalThis.location = had;
    quiet(() => { setPref(HERALD_PREF, true); setPref(TRACKER_PREF, true); setPref(MARKS_PREF, true); });
    questHerald.clear();
    _resetQuestTrackerForTests();
  }
}
/** The switches, flipped inside a test. */
const switches = ({ herald, tracker, marks }) => quiet(() => {
  if (herald != null) setPref(HERALD_PREF, herald);
  if (tracker != null) setPref(TRACKER_PREF, tracker);
  if (marks != null) setPref(MARKS_PREF, marks);
});

// ---------------------------------------------------------------
// the quests
// ---------------------------------------------------------------

// A deadline the journal NAMES (=deadline_) and a closing clock it does not - the quest's own way of ending itself an
// hour after the player is done (A0C01Y09's _shortdelay_, _BRISIEN's _oneday_).
const NAMED = [
  'Quest: __ANAMED', 'DisplayName: The Named Deadline', 'QRC:',
  'Message:  1010', ' I have =deadline_ days to find the ring.', '',
  'Message:  1011', ' I found the ring.', '',
  'QBN:',
  'Clock _deadline_ 3.00:00',
  'Clock _closing_ 01:00', '',
  '_deadline_ task:', ' end quest', '',
  '_closing_ task:', ' end quest', '',
  '_found_ task:', ' log 1011 step 1', ' start timer _closing_', '',
  'log 1010 step 0',
  'start timer _deadline_',
];
// _BRISIEN's shape: an entry with no deadline in its words, and a one-day clock that only ends the quest.
const UNNAMED = [
  'Quest: __AUNNAMED', 'DisplayName: The Unnamed Clock', 'QRC:',
  'Message:  1010', ' I met a lady in a tavern room.', '',
  'QBN:',
  'Clock _oneday_ 1.00:00', '',
  '_oneday_ task:', ' end quest', '',
  'log 1010 step 0',
  'start timer _oneday_',
];
// A quest that writes its entries again: the same step and message re-logged (P0B10L07's loop), then a new message.
const RELOG = [
  'Quest: __ARELOG', 'DisplayName: The Loop', 'QRC:',
  'Message:  1010', ' Throttle the knight.', '',
  'Message:  1011', ' The knight is dead.', '',
  'QBN:',
  '_again_ task:', ' log 1010 step 0', '',
  '_done_ task:', ' log 1011 step 1', '',
  'log 1010 step 0',
];
const PLAIN = (n, title) => [
  `Quest: __APLAIN${n}`, `DisplayName: ${title}`, 'QRC:',
  'Message:  1010', ` The first of ${title}.`, '',
  'Message:  1011', ` The second of ${title}.`, '',
  'QBN:',
  '_next_ task:', ' log 1011 step 1', '',
  '_win_ task:', ' give pc nothing', ' end quest', '',
  'log 1010 step 0',
];
// Two entries, two places (GUIDE4's first road): a look asks the map about the latest entry's alone.
const TWO = [
  'Quest: __ATWO', 'DisplayName: Two Places', 'QRC:',
  'Message:  1010', ' Find _pub_ in __pub_.', '',
  'Message:  1011', ' Now go to ___keep_ in ____keep_.', '',
  'QBN:',
  'Place _pub_ local tavern',
  'Place _keep_ permanent Llugwych', '',
  '_next_ task:', ' log 1011 step 1', '',
  'log 1010 step 0',
];
const SOURCES = { __ANAMED: NAMED, __AUNNAMED: UNNAMED, __ARELOG: RELOG, __APLAIN1: PLAIN(1, 'Quest X'), __APLAIN2: PLAIN(2, 'Quest Y'), __ATWO: TWO };

function makeBridge({ clock, questWhere = undefined, world = makeWorld() }) {
  return quiet(() => createQuestBridge({
    data: { readListTable: () => null, getQuestSourceLines: (n) => SOURCES[n] ?? null },
    world,
    classicSeconds: () => clock.now,
    playerEntity: { name: 'Hero', level: 3, gender: 'male' },
    getReputation: () => 0,
    dateTimeString: () => '13:30:00 on 4th of Morning Star, 3E405',
    midDateTimeString: () => '13:30:00 04 Morning Star 3E405',
    cityName: () => 'Bigtown',
    showPopup: () => {},
    addDialog: () => {},
    ...(questWhere ? { questWhere } : {}),
  }));
}
const questOf = (b, name) => [...b.machine.quests.values()].find((q) => q.questName === name);
const start = (b, name, seed = 7) => quiet(() => b.machine.startQuestByName(name, 0, { rolls: seededRolls(seed) }));
const beat = (b, clock, n = 1, step = 1) => quiet(() => { for (let i = 0; i < n; i++) { clock.now += step; b.tick(0.1); } });
const said = (h = questHerald) => h.frame().rows.map((rows) => rows.map((r) => r.text));
const viewOf = (b, name) => b.lens.look({}).quests.find((v) => v.questName === name);
/** Every lens event across a run, by listening in on the look. */
function eventsOf(b) {
  const look = b.lens.look.bind(b.lens);
  const all = [];
  b.lens.look = (...a) => { const r = look(...a); all.push(...r.events.map((e) => `${e.type} ${e.title}`)); return r; };
  return all;
}

// ---------------------------------------------------------------
// H1 / L2 - a deadline is one the journal names
// ---------------------------------------------------------------

/** TRACK-ONLY (2026-10-08): the card shows a TRACKED quest alone - these pins read the card for the quest the journal
 *  follows, so they track it first, as a player does with the journal's Track button. */
const pinFrame = () => { const t = questTracker.tracked(); if (t && !questTracker.isPinned(t.id)) questTracker.toggle(t.id); return questTracker.frame(); };

test('AUDIT GUIDE H1/L2: the HUD\'s faces count down only a clock the quest\'s own journal NAMES (a `=clock_` in a logged entry) - a closing clock started after the player is done is no deadline: no "Under a day left", no gold time on the card; the pause tab\'s "Time remains" keeps main\'s tightest counting clock (DEAD-CLOCK, PX5) (mutants: the named test dropped; the tightest kept for the lens)', () => withSwitches(() => {
  resetUid(); ensureUidAtLeast(1000);
  const clock = { now: 50000 };
  const b = makeBridge({ clock });
  beat(b, clock, 2);
  const events = eventsOf(b);
  start(b, '__ANAMED');
  beat(b, clock, 3);
  const q = questOf(b, '__ANAMED');
  let v = viewOf(b, '__ANAMED');
  assert.ok(Math.abs(v.clockSeconds - 3 * 86400) < 120, `the named deadline: ${v.clockSeconds}`);
  assert.equal(v.urgent, false);
  quiet(() => q.startTask({ name: 'found' }));
  beat(b, clock, 3);
  v = viewOf(b, '__ANAMED');
  assert.ok(v.clockSeconds > 2 * 86400, `the closing hour is not the deadline: ${v.clockSeconds}`);
  assert.equal(v.urgent, false, 'not urgent');
  assert.ok(!events.some((e) => e.startsWith('urgent')), `no deadline news: ${events}`);
  assert.match(pinFrame()?.time ?? '', /^2 days 2\d hours left$/, 'the card counts the named deadline, not the closing hour');
  assert.equal(pinFrame()?.urgent, false, 'no gold');
  const row = b.questLog().active.find((r) => r.questName === '__ANAMED');
  assert.ok(row.clockSeconds <= 3600, 'the pause tab keeps DEAD-CLOCK\'s tightest counting clock (main\'s, PX5 - Mac\'s call)');

  // _BRISIEN's shape: a clock the journal never names is no one's deadline on the HUD
  start(b, '__AUNNAMED');
  beat(b, clock, 3);
  const u = viewOf(b, '__AUNNAMED');
  assert.equal(u.clockSeconds, null, 'no named clock, no count');
  assert.equal(u.urgent, false);
  assert.ok(!events.some((e) => e === 'urgent The Unnamed Clock'), 'no "Under a day left" for the lady\'s closing day');

  // and a named deadline under a day IS news
  clock.now += 2 * 86400 + 3600;
  beat(b, clock, 3);
  assert.ok(events.includes('urgent The Named Deadline'), `the named deadline under a day: ${events}`);
}, { herald: true, tracker: true }));

// ---------------------------------------------------------------
// O2 / H2 / L1 - a load clears the herald
// ---------------------------------------------------------------

test('AUDIT GUIDE O2/H2/L1: a load leaves none of the unloaded game\'s news standing - the herald\'s notices go with the lens\'s baseline, so a loaded quest with the same uid is never announced under the old game\'s verdict (mutant: the clear dropped)', () => withSwitches(() => {
  resetUid(); ensureUidAtLeast(1000);
  const clock = { now: 50000 };
  const b = makeBridge({ clock });
  beat(b, clock, 2);
  start(b, '__APLAIN1');
  beat(b, clock, 3);
  const save = quiet(() => b.snapshot());
  quiet(() => questOf(b, '__APLAIN1').startTask({ name: 'win' }));
  beat(b, clock, 4);
  assert.deepEqual(said().at(-1).slice(0, 2), ['Quest completed', 'Quest X'], 'the old game\'s verdict stands');
  quiet(() => b.restore(save));
  assert.deepEqual(said(), [], 'the load takes it down');
  beat(b, clock, 3);
  quiet(() => questOf(b, '__APLAIN1').startTask({ name: 'next' }));
  beat(b, clock, 3);
  assert.deepEqual(said().map((r) => r.slice(0, 2)), [['Journal updated', 'Quest X']], 'the loaded quest\'s news is its own');
}, { herald: true }));

// ---------------------------------------------------------------
// L4 - a face that throws costs its news, never the frame
// ---------------------------------------------------------------

test('AUDIT GUIDE L4: a listener that throws (the herald\'s hear, the tracker\'s) is contained in the bridge\'s tick like a look that throws - the machine ticks, the tick returns, and it is said once (mutant: the hears outside the try)', () => withSwitches(() => {
  resetUid(); ensureUidAtLeast(1000);
  const clock = { now: 50000 };
  const b = makeBridge({ clock });
  const herald = questHerald.hear, tracker = questTracker.hear;
  const warned = [];
  const warn = console.warn;
  try {
    questHerald.hear = () => { throw new Error('a bug in a face'); };
    questTracker.hear = () => { throw new Error('a bug in the card'); };
    console.warn = (...a) => warned.push(a.join(' '));
    start(b, '__APLAIN1');
    for (let i = 0; i < 10; i++) { clock.now += 1; assert.doesNotThrow(() => b.tick(0.1)); }
    assert.equal(warned.filter((w) => /quest herald/.test(w)).length, 1, `said once: ${warned}`);
  } finally { questHerald.hear = herald; questTracker.hear = tracker; console.warn = warn; }
}, { herald: true, tracker: true }));

// ---------------------------------------------------------------
// O1 / T7 / H9 - the dungeon's window
// ---------------------------------------------------------------

/** A page the notice stack and the card both build in (test/guide3_herald.test.js's, with a root for the card's
 *  published height). */
function fakePage() {
  const node = (tag) => {
    const n = {
      tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', offsetHeight: 60,
      style: { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } }, dataset: {}, attrs: {},
      append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
      insertBefore(c, ref) { c.parent = n; const i = n.children.indexOf(ref); if (i < 0) n.children.push(c); else n.children.splice(i, 0, c); },
      setAttribute(k, v) { n.attrs[k] = v; }, getAttribute(k) { return n.attrs[k]; },
      remove() { if (n.parent) { n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; } n.removed = true; },
    };
    return n;
  };
  const doc = { createElement: node, head: node('head'), body: node('body'), documentElement: node('html') };
  const byId = (n, id) => { if (n.id === id) return n; for (const c of n.children) { const f = byId(c, id); if (f) return f; } return null; };
  doc.getElementById = (id) => byId(doc.head, id) ?? byId(doc.body, id);
  doc.all = () => { const out = []; const walk = (n) => { for (const c of n.children) { out.push(c); walk(c); } }; walk(doc.body); return out; };
  return doc;
}

test('AUDIT GUIDE O1/T7/H9: the hide door a dungeon window takes (hud.js hideHudTextSurfaces - both dungeon hosts return above drawHud while a window is up) hides the herald\'s notices and the tracker\'s card, their clocks stopped and the card\'s height withdrawn (mutants: either hide dropped)', () => withSwitches(() => {
  const was = globalThis.document, raf = globalThis.requestAnimationFrame;
  const doc = globalThis.document = fakePage();
  globalThis.requestAnimationFrame = () => 0;   // the draw watchdog's frame clock: chargenDom's runs synchronously
  const root = doc.documentElement;
  _setNoticeClockForTests(() => ({}), () => {});
  try {
    questHerald.hear({ quests: [], events: [{ type: 'completed', id: '1', title: 'Q' }] });
    questTracker.hear({ quests: [{ id: '2', title: 'Card', latest: { lines: [' A line.'] }, updatedAt: 1 }], events: [] });
    questTracker.toggle('2');   // TRACK-ONLY
    drawQuestHerald({ dt: 0.1, doc });
    drawQuestTracker({ doc });
    const card = doc.getElementById('enhanced-questtracker');
    assert.ok(card && card.style.display !== 'none', 'the card stands');
    const left = questHerald.rows[0].left;
    for (let i = 0; i < 30; i++) hideHudTextSurfaces(null);   // the dungeon's frames under its window
    assert.equal(card.style.display, 'none', 'the card hides under the window');
    assert.equal(root.style['--dfquest-h'], '0px', 'and gives the party list its line back');
    const toasts = doc.all().filter((n) => /^notice notice-toast\b/.test(n.className));
    assert.ok(toasts.length && toasts.every((n) => n.style.display === 'none'), `the notice hides: ${toasts.map((n) => `${n.className}:${n.style.display}`)}`);
    assert.equal(questHerald.rows[0].left, left, 'its clock stopped, as under any window');
  } finally {
    destroyEnhancedNotice();
    _resetQuestTrackerForTests();
    globalThis.document = was;
    globalThis.requestAnimationFrame = raf;
    _setNoticeClockForTests((f, ms) => setTimeout(f, ms), (t) => clearTimeout(t));
  }
}, { herald: true, tracker: true }));

// ---------------------------------------------------------------
// H4 / O4 - news is a new entry, not a new time
// ---------------------------------------------------------------

test('AUDIT GUIDE H4/O4: an entry written again - the same step and message at a new time (P0B10L07 re-logs on every click; a shared quest\'s resync rewrites the times) - is no news; a new message at the step is (mutant: the time kept in the news key)', () => withSwitches(() => {
  resetUid(); ensureUidAtLeast(1000);
  const clock = { now: 50000 };
  const b = makeBridge({ clock });
  beat(b, clock, 2);
  const events = eventsOf(b);
  start(b, '__ARELOG');
  beat(b, clock, 3, 60);
  const q = questOf(b, '__ARELOG');
  for (let i = 0; i < 3; i++) { quiet(() => q.startTask({ name: 'again' })); beat(b, clock, 3, 60); }
  assert.deepEqual(events, ['started The Loop'], `the same words again are not news: ${events}`);
  quiet(() => q.startTask({ name: 'done' }));
  beat(b, clock, 3, 60);
  assert.deepEqual(events, ['started The Loop', 'updated The Loop'], 'a new entry is');
}, { herald: true }));

// ---------------------------------------------------------------
// L8 / T8 - a look after a gap is a baseline
// ---------------------------------------------------------------

test('AUDIT GUIDE L8/T8: after a stretch with every face off, the first look is a baseline, not a diff against the look before the gap - the card follows the quest written LAST, not the last in the walk\'s order (mutant: the gap\'s reset dropped)', () => withSwitches(() => {
  resetUid(); ensureUidAtLeast(1000);
  const clock = { now: 1000 };
  const b = makeBridge({ clock });
  start(b, '__APLAIN1');
  beat(b, clock, 2);
  start(b, '__APLAIN2');
  beat(b, clock, 3);
  switches({ tracker: false });
  beat(b, clock, 2);
  clock.now = 5000; quiet(() => questOf(b, '__APLAIN2').startTask({ name: 'next' }));
  clock.now = 9000; quiet(() => questOf(b, '__APLAIN1').startTask({ name: 'next' }));   // X is written LAST
  beat(b, clock, 3);
  switches({ tracker: true });
  beat(b, clock, 2);
  assert.equal(questTracker.tracked()?.title, 'Quest X', 'the quest the journal changed last (TRACK-ONLY: followed by the journal, shown only once tracked)');
}, { tracker: true }));

test('AUDIT GUIDE H11: the herald\'s baseline is the lens\'s - switched on while the tracker\'s look ran, there is no backlog, and the news of the tick it came on in is heard (the bridge\'s own flag dropped that tick); switched on after a stretch with no look, the backlog is the baseline (mutant: the first tick dropped)', () => withSwitches(() => {
  resetUid(); ensureUidAtLeast(1000);
  const clock = { now: 1000 };
  const b = makeBridge({ clock });
  start(b, '__APLAIN1');
  beat(b, clock, 3);
  switches({ herald: true });
  quiet(() => questOf(b, '__APLAIN1').startTask({ name: 'next' }));
  beat(b, clock, 1);
  assert.deepEqual(said().map((r) => r.slice(0, 2)), [['Journal updated', 'Quest X']], 'the tick the herald came on in: its news heard');
  questHerald.clear();
  switches({ herald: false, tracker: false });
  beat(b, clock, 2);
  start(b, '__APLAIN2');
  beat(b, clock, 2);
  switches({ herald: true });
  beat(b, clock, 2);
  assert.deepEqual(said(), [], 'the quest begun while nothing looked is the baseline, not news');
}, { tracker: true }));

// ---------------------------------------------------------------
// T3 - a tracked quest that is gone is tracked no more
// ---------------------------------------------------------------

test('AUDIT GUIDE T3: the tracked quest is let go when it is gone, even while no face follows it - so no save carries a uid a later quest can be minted under (mutant: the bridge\'s check dropped)', () => withSwitches(() => {
  resetUid(); ensureUidAtLeast(1000);
  const clock = { now: 1000 };
  const b = makeBridge({ clock });
  start(b, '__APLAIN1');
  beat(b, clock, 3);
  const q = questOf(b, '__APLAIN1');
  questTracker.toggle(String(q.uid));
  assert.equal(questTracker.pinned, String(q.uid));
  switches({ tracker: false, marks: false, herald: true });
  beat(b, clock, 2);
  quiet(() => q.startTask({ name: 'win' }));
  beat(b, clock, 4);
  assert.equal(questTracker.pinned, null, 'the finished quest is tracked no more');
  questTracker.pinned = '999999';
  beat(b, clock, 1);
  assert.equal(questTracker.pinned, null, 'nor a uid no quest has');
}, { tracker: true }));

// ---------------------------------------------------------------
// T2 / U4 - the choice has a control wherever it steers something
// ---------------------------------------------------------------

test('AUDIT GUIDE T2/U4: with the card off and the marks on, the tracked choice still steers the compass and the filled diamond - so both journal faces keep the Track toggle, and open on the followed quest (mutants: either gate back to the card alone)', () => withSwitches(() => {
  resetUid(); ensureUidAtLeast(1000);
  const clock = { now: 1000 };
  const b = makeBridge({ clock });
  start(b, '__APLAIN1');
  beat(b, clock, 2);
  const host = document.createElement('div');
  const menu = mountEnhancedMenu(host, { mode: 'pause', hooks: { questLog: () => b.questLog() }, onAction: () => {}, at: 'quests' });
  try { assert.ok(host.querySelectorAll('.qtrack-pin').length >= 1, 'the pause tab\'s toggle'); } finally { menu.unmount?.(); }
  const host2 = document.createElement('div');
  const chron = mountEnhancedChronicle(host2, { section: 'quests', questLog: () => b.questLog() });
  try { assert.ok(host2.querySelectorAll('.qtrack-pin').length >= 1, 'the chronicle\'s toggle'); } finally { chron.destroy?.(); }
}, { tracker: false, marks: true }));

// ---------------------------------------------------------------
// H5 / H6 / H7 - the herald's queue
// ---------------------------------------------------------------

const hv = (id, clockSeconds = null, lines = [' An entry.']) => ({ id, latest: { lines }, clockSeconds, urgent: Number.isFinite(clockSeconds) && clockSeconds < QUEST_URGENT_SECONDS });

test('AUDIT GUIDE H5: the queue lets the least news go first - a merged notice is the newest, and past HERALD_MAX an entry goes before a deadline, a deadline before a new quest or an ending, the oldest among equals; four events in one look keep the three that matter most (mutants: the merge kept in its slot; eviction by position)', () => {
  const h = new QuestHerald();
  h.hear({ quests: [hv('A'), hv('B'), hv('C')], events: [{ type: 'started', id: 'A', title: 'A' }, { type: 'started', id: 'B', title: 'B' }, { type: 'started', id: 'C', title: 'C' }] });
  h.hear({ quests: [], events: [{ type: 'completed', id: 'A', title: 'A' }] });
  h.hear({ quests: [hv('D')], events: [{ type: 'started', id: 'D', title: 'D' }] });
  assert.deepEqual(said(h).map((r) => r.slice(0, 2).join(' ')), ['New quest C', 'Quest completed A', 'New quest D'], 'A\'s ending is the newest news: B, the oldest of the rest, goes');
  const one = new QuestHerald();
  one.hear({ quests: [hv('1', 80000), hv('2'), hv('3'), hv('4')], events: [
    { type: 'urgent', id: '1', title: 'Q1', clockSeconds: 80000 }, { type: 'updated', id: '2', title: 'Q2' },
    { type: 'ended', id: '3', title: 'Q3' }, { type: 'completed', id: '4', title: 'Q4' },
  ] });
  assert.deepEqual(one.rows.map((r) => r.title).sort(), ['Q1', 'Q3', 'Q4'], 'the routine entry goes, the deadline and the endings stand');
  assert.equal(one.rows.length, HERALD_MAX);
});

test('AUDIT GUIDE H6: a deadline\'s notice that waited under a window says the time left NOW when it shows again - a rest of ten hours is not "23 hours" (mutant: the refresh dropped)', () => {
  const h = new QuestHerald();
  h.hear({ quests: [hv('7', 86200)], events: [{ type: 'urgent', id: '7', title: 'The Deadline', clockSeconds: 86200 }] });
  assert.match(said(h)[0][2], /^23 hours/);
  h.hear({ quests: [hv('7', 50200)], events: [] });   // the look after the rest: no news, a new count
  h.refresh();   // the HUD shows again
  assert.match(said(h)[0][2], /^13 hours/, 'the count the journal says now');
});

test('AUDIT GUIDE H7: a merged notice keeps "Under a day left" only while the quest is under a day - a clock that moved out, or stopped, takes the deadline\'s rank with it (mutant: the rank kept regardless)', () => {
  const h = new QuestHerald();
  h.hear({ quests: [hv('7', 86000)], events: [{ type: 'urgent', id: '7', title: 'Moving', clockSeconds: 86000 }] });
  h.hear({ quests: [hv('7', 3 * 86400)], events: [{ type: 'updated', id: '7', title: 'Moving' }] });
  assert.deepEqual(said(h)[0].slice(0, 2), ['Journal updated', 'Moving'], 'three days: the entry, not a deadline');
  const s = new QuestHerald();
  s.hear({ quests: [hv('8', 86000)], events: [{ type: 'urgent', id: '8', title: 'Stopped', clockSeconds: 86000 }] });
  s.hear({ quests: [hv('8', null)], events: [{ type: 'updated', id: '8', title: 'Stopped' }] });
  assert.deepEqual(said(s)[0].slice(0, 2), ['Journal updated', 'Stopped'], 'no clock: no deadline');
});

// ---------------------------------------------------------------
// O3 / L5 - the cost of a look
// ---------------------------------------------------------------

test('AUDIT GUIDE O3/L5: a look asks the host\'s map once per quest (the latest entry\'s target - no face reads an older one\'s) and parses no archive; the host keeps a place\'s map pixel once a session, so the look, the compass and the map\'s poll never re-read a region (mutants: every entry\'s target; the archive parsed; the memo dropped)', async () => {
  resetUid(); ensureUidAtLeast(1000);
  const clock = { now: 1000 };
  const b = makeBridge({ clock });
  start(b, '__ATWO');
  quiet(() => questOf(b, '__ATWO').startTask({ name: 'next' }));
  quiet(() => b.tick(0.1));
  const asks = [];
  const walk = b.questLog();
  const lens = new QuestLens({ questLog: () => ({ active: walk.active, ended: [], get finished() { throw new Error('the archive was parsed'); } }) });
  let seen;
  assert.doesNotThrow(() => { seen = quiet(() => lens.look({ canFindPlace: (r, n) => { asks.push(`${r}/${n}`); return true; } })); }, 'no archive parsed');
  assert.equal(asks.length, 1, `the map asked once, for the latest entry: ${asks}`);
  assert.equal(seen.quests[0].entries[0].target, null, 'an older entry carries no target');
  assert.ok(seen.quests[0].target?.locationName, 'the latest does');
  const { placePixelMemo } = await import('../src/ui/travelMapWindow.js');
  let reads = 0;
  const region = { mapNameLookup: new Map([['Bigtown', 0]]), mapTable: [{ longitude: 1000, latitude: 2000 }] };
  const maps = { getRegionByName: (n) => { reads++; return n === 'Devilrock' ? region : null; } };
  const pixelOf = placePixelMemo();
  const first = pixelOf(maps, 'Devilrock', 'Bigtown');
  for (let i = 0; i < 50; i++) assert.deepEqual(pixelOf(maps, 'Devilrock', 'Bigtown'), first);
  assert.equal(pixelOf(maps, 'Devilrock', 'Nowhere'), null);
  pixelOf(maps, 'Devilrock', 'Nowhere');
  assert.equal(reads, 2, 'one read per place a session, a miss included');
  const world = rd('src/scenes/world.js');
  assert.match(world, /const questPlacePixel = placePixelMemo\(\);/, 'the host holds one memo');
  assert.match(world, /canFindPlace: \(regionName, name\) => canFindPlace\(maps, mapDict, regionName, name, questPlacePixel\)/, 'the look\'s map question asks it');
  assert.match(world, /const questPixel = \(find\) => questPlacePixel\(maps, find\?\.regionName \?\? '', find\?\.locationName \?\? ''\);/, 'and the compass and the map\'s marks');
});

// ---------------------------------------------------------------
// L3 - the quiet read is quiet for a quest letter too
// ---------------------------------------------------------------

const LETTER = [
  'Quest: __ALETTER', 'DisplayName: The Letter', 'QRC:',
  'Message:  1010', ' I was given _letter_ to carry.', '',
  'Message:  1030', ' My friend,', ' come quickly.', ' Signed, at _pub_.', '',
  'QBN:',
  'Place _pub_ local tavern',
  'Item _letter_ letter used 1030', '',
  'log 1010 step 0',
];

test('AUDIT GUIDE L3: a look at an entry that names a quest LETTER (Item.expandMacro -> questLetterName -> expandLetterSignoff, DFU\'s own path) opens no talk topic and draws nothing from the engine\'s Math.random - the quiet read quiets the letter\'s signoff and its variant roll as it quiets the entry\'s own (mutants: the hooks kept loud; the engine roll kept)', async () => {
  const { quietLines } = await import('../src/ui/questLens.js');
  resetUid(); ensureUidAtLeast(1000);
  const clock = { now: 1000 };
  const topics = [];
  const b = quiet(() => createQuestBridge({
    data: { readListTable: () => null, getQuestSourceLines: (n) => (n === '__ALETTER' ? LETTER : null) },
    world: makeWorld(), classicSeconds: () => clock.now, playerEntity: { name: 'Hero', level: 3, gender: 'male' },
    addDialog: (...a) => topics.push(a.join(':')), dialogLink: (...a) => topics.push(`link:${a.join(':')}`),
  }));
  start(b, '__ALETTER');
  const q = questOf(b, '__ALETTER');
  assert.ok(q?.getItem?.({ name: 'letter' }), 'the letter stands');
  const before = topics.length;
  const mr = Math.random;
  let draws = 0;
  Math.random = () => { draws++; return mr(); };
  let lines;
  try { lines = quiet(() => quietLines(q.getMessage(1010))); } finally { Math.random = mr; }
  assert.ok(lines?.join(' ').includes('Letter'), `the letter is named as the journal names it: ${lines}`);
  assert.deepEqual(topics.slice(before), [], 'no topic opened by a look');
  assert.equal(draws, 0, 'no engine draw');
  assert.equal(Math.random, mr, 'the engine\'s roll put back');
});

// ---------------------------------------------------------------
// L6 - a kept line is read again each game hour
// ---------------------------------------------------------------

test('AUDIT GUIDE L6: the lens reads a kept entry again each game hour, so a line whose macro reads the world as it is (a clock\'s days with Journal Countdowns on - 10C00Y00:1020\'s "I have =1stparton_ days") says on the card what the journal says now (mutant: the hourly re-read dropped)', () => withSwitches(() => {
  resetUid(); ensureUidAtLeast(1000);
  const clock = { now: 50000 };
  const b = makeBridge({ clock, world: { ...makeWorld(), showClocksAsCountdown: () => true } });
  beat(b, clock, 2);
  start(b, '__ANAMED');
  beat(b, clock, 3);
  assert.match(pinFrame()?.opening ?? '', /I have 3 days/, 'day one');
  clock.now += 2 * 86400;
  beat(b, clock, 3);
  assert.match(questTracker.frame()?.opening ?? '', /I have 1 days/, `two days on, the journal's own words: ${questTracker.frame()?.opening}`);
}, { tracker: true }));

// ---------------------------------------------------------------
// T5 / T6 / U3 / U13 / U14 - the Track toggle
// ---------------------------------------------------------------

test('AUDIT GUIDE T6/U13: the Track toggle keeps ONE name - its words and its label say "Track", aria-pressed carries the state (WAI-ARIA APG: a toggle\'s label never changes with its state) (mutant: the label flipped)', () => withSwitches(() => {
  const b1 = trackButton(document, '7', 'The Ring');
  const btn = b1.querySelector('.qtrack-pin') ?? b1;
  assert.equal(btn.getAttribute('aria-pressed'), 'false');
  const label = btn.getAttribute('aria-label'), words = btn.textContent;
  btn.click();
  assert.equal(btn.getAttribute('aria-pressed'), 'true', 'pressed');
  assert.equal(btn.getAttribute('aria-label'), label, 'the same name');
  assert.equal(btn.textContent, words, 'the same words');
  assert.match(label, /^Track The Ring/, 'the visible word begins the name (WCAG 2.5.3)');
}, { tracker: true }));

test('AUDIT GUIDE T5/U3: pressing Track changes the toggle IN PLACE - the focus stays on it and no face is rebuilt under the player (the chronicle kept its scroll) - and every other toggle on the page follows: one quest is tracked (mutant: the face re-rendered)', () => withSwitches(() => {
  resetUid(); ensureUidAtLeast(1000);
  const clock = { now: 1000 };
  const b = makeBridge({ clock });
  start(b, '__APLAIN1'); beat(b, clock, 2);
  start(b, '__APLAIN2'); beat(b, clock, 2);
  const host = document.createElement('div');
  document.body.append(host);
  const chron = mountEnhancedChronicle(host, { section: 'quests', questLog: () => b.questLog() });
  try {
    const pins = host.querySelectorAll('.qtrack-pin');
    assert.equal(pins.length, 2, 'a toggle per live quest');
    pins[0].focus();
    pins[0].click();
    assert.equal(document.activeElement, pins[0], 'the focus stays on the toggle pressed');
    assert.deepEqual(host.querySelectorAll('.qtrack-pin'), pins, 'the same nodes: nothing rebuilt');
    assert.deepEqual(pins.map((p) => p.getAttribute('aria-pressed')), ['true', 'false']);
    pins[1].click();
    assert.deepEqual(pins.map((p) => p.getAttribute('aria-pressed')), ['false', 'true'], 'the other follows: one tracked quest');
  } finally { chron.destroy?.(); host.remove(); }
}, { tracker: true }));

test('AUDIT GUIDE U14: the quest the HUD follows is SAID where the choice is made - its toggle carries "On the HUD" (the card is aria-hidden: this is where a screen reader learns it), followed or tracked alike (mutant: the note dropped)', () => withSwitches(() => {
  questTracker.hear({ quests: [{ id: '1', title: 'A', updatedAt: 10, latest: { lines: [' a'] } }, { id: '2', title: 'B', updatedAt: 5, latest: { lines: [' b'] } }], events: [] });
  const a = trackButton(document, '1', 'A'), bb = trackButton(document, '2', 'B');
  assert.match(a.textContent, /On the HUD/, 'the followed quest');
  assert.doesNotMatch(bb.textContent, /On the HUD/);
  (bb.querySelector('.qtrack-pin') ?? bb).click();
  assert.match(bb.textContent, /On the HUD/, 'tracked, it is the HUD\'s');
}, { tracker: true }));

// ---------------------------------------------------------------
// H10 / U11 - a main quest is said, not only coloured
// ---------------------------------------------------------------

test('AUDIT GUIDE H10/U11: a main quest is SAID - the herald\'s kind row names it and the card\'s time row does - never colour alone (WCAG 1.4.1; the arc\'s LAW 5) (mutants: either word dropped)', () => withSwitches(() => {
  const h = new QuestHerald();
  h.hear({ quests: [hv('7')], events: [{ type: 'started', id: '7', title: 'Lady Brisienna', main: true }, { type: 'started', id: '8', title: 'Side', main: false }] });
  assert.deepEqual(said(h).map((r) => r[0]), ['New quest - Main Quest', 'New quest']);
  questTracker.hear({ quests: [{ id: '1', title: 'Lady Brisienna', main: true, updatedAt: 1, latest: { lines: [' a'] }, clockSeconds: null }], events: [] });
  if (!questTracker.isPinned('1')) questTracker.toggle('1');   // TRACK-ONLY
  assert.equal(questTracker.frame().time, 'Main Quest', 'the time row says it, a clock or none');
  questTracker.hear({ quests: [{ id: '1', title: 'Lady Brisienna', main: true, updatedAt: 1, latest: { lines: [' a'] }, clockSeconds: 90000 }], events: [] });
  assert.match(questTracker.frame().time, /^Main Quest - 1 day/);
}, { tracker: true }));

// ---------------------------------------------------------------
// H3 / U19 - the news is spoken
// ---------------------------------------------------------------

test('AUDIT GUIDE H3/U19: the herald speaks through a live region of its own that stands before the news and after it - each notice once, whole (kind, title, line), when it first shows, a merge spoken whole again; its toasts in the stack are aria-hidden so nothing is said twice or in pieces (mutants: the region rebuilt with the news; a merge unsaid; the toasts not hidden)', () => withSwitches(() => {
  const was = globalThis.document, raf = globalThis.requestAnimationFrame;
  const doc = globalThis.document = fakePage();
  globalThis.requestAnimationFrame = () => 0;
  _setNoticeClockForTests(() => ({}), () => {});
  try {
    drawQuestHerald({ dt: 0.1, doc });
    const live = doc.getElementById('quest-herald-live');
    assert.ok(live, 'the region stands before any news');
    assert.equal(live.attrs['aria-live'], 'polite');
    assert.equal(live.attrs['aria-atomic'], 'true');
    questHerald.hear({ quests: [hv('7', null, [' I agreed to find the ring.'])], events: [{ type: 'started', id: '7', title: 'The Ring' }] });
    drawQuestHerald({ hidden: true, dt: 0.1, doc });
    assert.equal(live.textContent, '', 'unsaid while the HUD is hidden - it waits, as the notice does');
    drawQuestHerald({ dt: 0.1, doc });
    assert.equal(live.textContent, 'New quest: The Ring. I agreed to find the ring.', 'said whole, once it shows');
    const toast = doc.all().find((n) => /^notice notice-toast\b/.test(n.className));
    assert.equal(toast.attrs['aria-hidden'], 'true', 'the toast itself is silent');
    drawQuestHerald({ hidden: true, dt: 0.1, doc });
    drawQuestHerald({ dt: 0.1, doc });
    assert.equal(live.textContent, 'New quest: The Ring. I agreed to find the ring.', 'shown again: not said again');
    questHerald.hear({ quests: [], events: [{ type: 'completed', id: '7', title: 'The Ring' }] });
    drawQuestHerald({ dt: 0.1, doc });
    assert.equal(live.textContent, 'Quest completed: The Ring.', 'a merge is said whole');
    for (let i = 0; i < 100; i++) drawQuestHerald({ dt: 0.1, doc });
    assert.equal(questHerald.rows.length, 0, 'the news has gone');
    assert.equal(doc.getElementById('quest-herald-live'), live, 'the region stands after it');
  } finally {
    destroyEnhancedNotice();
    globalThis.document = was;
    globalThis.requestAnimationFrame = raf;
    _setNoticeClockForTests((f, ms) => setTimeout(f, ms), (t) => clearTimeout(t));
  }
}, { herald: true }));

// ---------------------------------------------------------------
// the card's corner - T1/D1, U1, U5-U10, U17, U18, H8, O5/T4/U2
// ---------------------------------------------------------------

test('AUDIT GUIDE T1/D1, U1, U7: the card steps aside - its line kept, so the party list never jumps - for what stands in its corner a while: the Overworld\'s block at the top of a touch screen, a narrow screen\'s chat lines, a journey\'s junction disc (mutants: each rule dropped)', async () => {
  const { ENHANCED_CSS } = await import('../src/ui/enhancedStyle.js');
  const css = ENHANCED_CSS.replace(/\s+/g, ' ');
  assert.match(css, /:root\[data-tview-block="top"\] \.qtrack,/, 'the Overworld\'s block (main\'s OW-NOTICES attribute)');
  assert.match(css, /body:has\(\.travelpanel-junction\.show\) \.qtrack \{ visibility: hidden; \}/, 'the junction disc (enhancedTravelControl.js .show)');
  assert.match(css, /@media \(max-width: 720px\) \{ body:has\(\.dfchat-peek:not\(:empty\)\) \.qtrack \{ visibility: hidden; \} \}/, 'a narrow screen\'s chat lines (chatPanel.js empties the peek when none show)');
});

test('AUDIT GUIDE U8: the card\'s top clears the compass and the foe frame at the HUD\'s own scale - the card carries the HUD\'s --hud-scale, and a touch screen\'s top is the larger of its line and the compass\'s foot (mutants: the scale not copied; the touch top fixed)', async () => {
  const { ENHANCED_CSS } = await import('../src/ui/enhancedStyle.js');
  withSwitches(() => {
    const was = globalThis.document;
    const doc = globalThis.document = fakePage();
    const hud = doc.createElement('div');
    hud.className = 'hud';
    hud.style.getPropertyValue = (k) => (k === '--hud-scale' ? '1.5' : '');
    doc.body.append(hud);
    doc.querySelector = (sel) => (sel === '.hud' ? hud : null);
    try {
      questTracker.hear({ quests: [{ id: '1', title: 'Q', updatedAt: 1, latest: { lines: [' a'] } }], events: [] });
      questTracker.toggle('1');   // TRACK-ONLY
      drawQuestTracker({ doc });
      assert.equal(doc.getElementById('enhanced-questtracker').style['--hud-scale'], '1.5', 'the HUD\'s own scale, on the card');
    } finally { _resetQuestTrackerForTests(); globalThis.document = was; }
  }, { tracker: true });
  const css = ENHANCED_CSS.replace(/\s+/g, ' ');
  assert.match(css, /--qt-clear: calc\(18px \+ 28px \* var\(--hud-scale, 1\) \+ 30px\);/, 'the compass\'s foot at the scale');
  assert.match(css, /\.qtrack\.touch \{ top: calc\(max\(76px, var\(--qt-clear\)\) \+ env\(safe-area-inset-top, 0px\)\); \}/, 'a touch screen');
  assert.match(css, /body:has\(\.hud-foe\.on\) \.qtrack \{ --qt-clear: calc\(18px \+ 28px \* var\(--hud-scale, 1\) \+ 30px \+ 46px \* var\(--hud-scale, 1\)\); \}/, 'the foe bar on a narrow one');
  assert.match(css, /\.qtrack, \.qtrack\.touch \{ top: calc\(max\(104px, var\(--qt-clear\)\) \+ env\(safe-area-inset-top, 0px\)\);/, 'a phone');
});

test('AUDIT GUIDE O5/T4/U2: the card re-measures whenever its box changes (a phone turned, a window resized, the face arriving late) - a ResizeObserver on the card republishes the party list\'s line, not only a change of words (mutant: the observer dropped)', () => withSwitches(() => {
  const was = globalThis.document, RO = globalThis.ResizeObserver;
  const doc = globalThis.document = fakePage();
  const observers = [];
  globalThis.ResizeObserver = class { constructor(fn) { this.fn = fn; observers.push(this); } observe(n) { this.node = n; } disconnect() { this.gone = true; } };
  try {
    questTracker.hear({ quests: [{ id: '1', title: 'Q', updatedAt: 1, latest: { lines: [' a'] } }], events: [] });
    questTracker.toggle('1');   // TRACK-ONLY
    drawQuestTracker({ doc });
    const card = doc.getElementById('enhanced-questtracker');
    const root = doc.documentElement;
    assert.equal(root.style['--dfquest-h'], '68px', 'measured once: 60 + the gap');
    assert.equal(observers.length, 1);
    assert.equal(observers[0].node, card, 'the card is observed');
    card.offsetHeight = 26;   // turned to landscape: the short-screen rule hides three rows, the words the same
    drawQuestTracker({ doc });
    assert.equal(root.style['--dfquest-h'], '68px', 'no words changed: the draw does not re-measure');
    observers[0].fn([]);
    assert.equal(root.style['--dfquest-h'], '34px', 'the observer did');
    _resetQuestTrackerForTests();
    assert.equal(observers[0].gone, true, 'and is let go with the card');
  } finally { _resetQuestTrackerForTests(); globalThis.document = was; if (RO === undefined) delete globalThis.ResizeObserver; else globalThis.ResizeObserver = RO; }
}, { tracker: true }));

test('AUDIT GUIDE U9, U10, U17, U18, H8: the card\'s plate is the toast\'s and its dim rows lighter (4.5:1 over snow); forced colours keep a plate; a full party is cut at the window\'s foot, not pushed off it; the decorative place mark is never read aloud; a short screen keeps the herald\'s kind and title (mutants: each)', async () => {
  const { ENHANCED_CSS } = await import('../src/ui/enhancedStyle.js');
  const { PARTY_CSS } = await import('../src/ui/partyPanel.js');
  const css = ENHANCED_CSS.replace(/\s+/g, ' ');
  assert.match(css, /background: linear-gradient\(90deg, rgba\(10,12,17,0\) 0%, rgba\(10,12,17,0\.82\) 32%\);/, 'U9: the plate');
  assert.match(css, /\.qtrack-line \{ font-size: 12px; line-height: 1\.3; color: #cdc3a7;/, 'U9: the opening');
  assert.match(css, /\.qtrack-note \{ font-size: 11px; line-height: 1\.3; color: #b0a993;/, 'U9: the note');
  assert.match(css, /@media \(forced-colors: active\) \{ \.qtrack \{ background-color: Canvas; \} \}/, 'U10');
  assert.match(PARTY_CSS.replace(/\s+/g, ' '), /max-height: calc\(100dvh - 100px - var\(--dfquest-h, 0px\)/, 'U17');
  for (const sel of ['.px-qwhere-place::before', '.cr-shell .cr-whereplace::before', '.qtrack-where::before']) {
    const at = css.indexOf(`${sel} {`);
    assert.ok(at >= 0 && /content: '\\25c8' \/ '';/.test(css.slice(at, at + 120)), `U18: ${sel}`);
  }
  assert.match(css, /@media \(max-height: 520px\) \{ \.notice\.notice-toast \.notice-row\.herald-line \{ display: none; \} \}/, 'H8');
});

// ---------------------------------------------------------------
// W1 / W2 / W3 / W4 / W5 / W6 / U12 - the way there
// ---------------------------------------------------------------

// The GUIDE world with Llugwych (the permanent place) moved to ANOTHER region: an entry names the town and not its
// region (W1), and a player can stand in some other place of the same name (W2).
const AWAY = [
  'Quest: __AWAY', 'DisplayName: Way Audit', 'QRC:',
  'Message:  1010', ' The letter must reach __keep_ before the snows.', '',
  'QBN:',
  'Place _keep_ permanent Llugwych', '',
  'log 1010 step 0',
];
function awayQuest() {
  const w = makeWorld();
  const baseGet = w.maps.getLocation;
  w.maps.getLocation = (r, l) => { const loc = baseGet(r, l); return loc?.name === 'Llugwych' ? { ...loc, regionIndex: 23, regionName: 'Wayrest' } : loc; };
  resetUid(); ensureUidAtLeast(1000);
  const b = quiet(() => createQuestBridge({
    data: { readListTable: () => null, getQuestSourceLines: (n) => (n === '__AWAY' ? AWAY : null) },
    world: w, classicSeconds: () => 50000, playerEntity: { name: 'Hero', level: 3, gender: 'male' },
  }));
  start(b, '__AWAY');
  quiet(() => { b.machine.tick(); b.machine.tick(); });
  return { b, q: questOf(b, '__AWAY') };
}

test('AUDIT GUIDE W1: an entry that names a place\'s town and not its region says the region only when DFU\'s find-place box would (the place on the player\'s map) or the player stands in it - THE LAWS 2, the GUIDE2 Ledger row (mutant: the town\'s name unlocking the region)', async () => {
  const { entryTarget, targetWords, WHERE_TEXT } = await import('../src/ui/questLens.js');
  const { q } = awayQuest();
  const off = targetWords(entryTarget(q.getMessage(1010), { canFindPlace: () => false, currentLocationName: () => '' }));
  assert.deepEqual([off.where, off.note], ['Llugwych', WHERE_TEXT.offMap], 'off the map: the name the entry says, and the talk arc\'s answer');
  const on = targetWords(entryTarget(q.getMessage(1010), { canFindPlace: () => true, currentLocationName: () => '' }));
  assert.equal(on.where, 'Llugwych in Wayrest province', 'on the map: the box\'s own words');
});

test('AUDIT GUIDE W2: "(you are here)" is a claim - never made when the player\'s map says the place is not on it (you cannot stand in a place your map lacks: a place of the same name elsewhere is not it); the find box keeps DFU\'s own name-only gate (mutant: the claim on the name alone)', async () => {
  const { entryTarget, targetWords, WHERE_TEXT } = await import('../src/ui/questLens.js');
  const { q } = awayQuest();
  const t = entryTarget(q.getMessage(1010), { canFindPlace: () => false, currentLocationName: () => 'Llugwych' });
  const w = targetWords(t);
  assert.equal(t.here, false, 'not here');
  assert.deepEqual([w.where, w.note], ['Llugwych', WHERE_TEXT.offMap], 'no claim, no region revealed, the note kept');
  assert.equal(t.find, null, 'HandleQuestClicks\' gate: a place of the player\'s own location\'s name offers no box');
  const at = targetWords(entryTarget(q.getMessage(1010), { canFindPlace: () => true, currentLocationName: () => 'Llugwych' }));
  assert.equal(at.where, `Llugwych in Wayrest province (${WHERE_TEXT.here})`, 'standing in it, on the map: here');
});

test('AUDIT GUIDE W3: the where line and its "Show on map" ask isEnhanced() like every face (THE LAWS 4) - the classic pause window\'s Controls path into the tabbed window (DISC22-B) draws the Quests tab without them (mutant: the gate dropped)', () => {
  const { b } = awayQuest();
  const hooks = { questLog: () => b.questLog(), canFindPlace: () => true, currentLocationName: () => '', showQuestPlace: () => true };
  const draw = (skin) => withSwitches(() => {
    const host = document.createElement('div');
    const menu = mountEnhancedMenu(host, { mode: 'pause', hooks, onAction: () => {}, at: 'quests' });
    try { return host.querySelectorAll('.px-qwhere').length; } finally { menu.unmount?.(); }
  }, { skin });
  assert.ok(draw('enhanced') >= 1, 'the enhanced skin: the where line');
  assert.equal(draw('classic'), 0, 'the classic skin: none');
});

test('AUDIT GUIDE W4: an opening is a SENTENCE - a stop inside a closing quote ends it, an abbreviation or an initial does not, a capital beyond ASCII starts the next, and the date header is dropped on the first line that has words (mutants: each)', async () => {
  const { entryOpening } = await import('../src/ui/questRail.js');
  assert.equal(entryOpening(['I must visit St. Delyn before dawn. Then home.']), 'I must visit St. Delyn before dawn.', 'St.');
  assert.equal(entryOpening(['Speak to Jolin D. Ferrow at once. He waits.']), 'Speak to Jolin D. Ferrow at once.', 'an initial');
  assert.equal(entryOpening(['I received a letter from my "family." I have been told to slay one.']), 'I received a letter from my "family."', 'a closing quote');
  assert.equal(entryOpening(['Find the ring. Élan knows where.']), 'Find the ring.', 'a capital beyond ASCII');
  assert.equal(entryOpening(['', 'Sundas the 1st of Morning Star:', ' Go now. Quickly.']), 'Go now.', 'the header on the first line with words');
});

test('AUDIT GUIDE W5, W6, U12: the trail offers a place once by its region AND its name (two towns may share one); the fixed-town route\'s buildings ask the location question the chronicle and the card ask; "Show on map" is named with its own words first (WCAG 2.5.3) (mutants: each)', async () => {
  const { WHERE_TEXT } = await import('../src/ui/questLens.js');
  const menu = rd('src/ui/enhancedMenu.js');
  assert.match(menu, /skip && said\.find\?\.locationName === skip\.locationName && said\.find\?\.regionName === skip\.regionName/, 'W5');
  assert.match(rd('src/scenes/exterior.js'), /questLocationName: \(\) => dfLocation\.name \?\? locationName,/, 'W6');
  assert.match(WHERE_TEXT.showLabel('Llugwych in Wayrest province'), /^Show on map: Llugwych in Wayrest province$/, 'U12');
});

// ---------------------------------------------------------------
// K1-K8, U15, U16 - the marks on the held map
// ---------------------------------------------------------------

const heldMapKit = async () => {
  const { HeldMapWindow } = await import('../src/ui/heldMap.js');
  const { toPaper, PEN, paintQuestMark } = await import('../src/ui/inkMap.js');
  const { getMapPixelID, LOCATION_TYPES, CLIMATES } = await import('../src/formats/mapsFile.js');
  const qm = await import('../src/ui/questMarks.js');
  const { _resetForTests } = await import('../src/systems/uiPrefs.js');
  const town = { id: getMapPixelID(3, 7), mapID: 1, regionIndex: 17, mapIndex: 0, locationType: LOCATION_TYPES.TownCity, discovered: true };
  const crypt = { id: getMapPixelID(6, 4), mapID: 2, regionIndex: 17, mapIndex: 1, locationType: LOCATION_TYPES.DungeonRuin, discovered: true };
  const mk = (extra = {}) => new HeldMapWindow({
    getPlayerPixel: () => ({ x: 5, y: 5 }), getClimateIndex: () => CLIMATES.Woodlands,
    woods: { heightMapBuffer: new Uint8Array(100).fill(10) }, mapSize: { width: 10, height: 10 },
    gold: () => 10000, goldPieces: () => 10000, hasHorse: false, hasCart: false, hasShip: false,
    diseaseCount: () => 0, poisonCount: () => 0,
    mapDict: new Map([[town.id, town], [crypt.id, crypt]]),
    maps: { regionCount: 18, getRegion: () => ({ mapNames: ['Bigtown', 'The Crypt'] }), getPoliticIndex: () => 128 + 17 },
    ...extra,
  });
  const aim = (win) => { win._layout(); win._view = { ox: 0, oy: 0, scale: 20 }; win._goal = { ...win._view }; win._phase = 'map'; };
  const mark = (px, py, tracked, title = 'The First Road', extra = {}) => ({ key: `quest:${px},${py}`, px, py, tracked, label: `${title} - Bigtown`, tip: { title, lines: ['Bigtown in Daggerfall province', '1 day left'] }, quests: [{ title, left: '1 day left' }], ...extra });
  return { mk, aim, mark, toPaper, PEN, paintQuestMark, qm, _resetForTests };
};
/** The held map's page (test/guide5_marks.test.js's shape): nodes that take listeners and classes, a text that a card
 *  line can be read back from. */
function mapPage() {
  const node = () => {
    const n = {
      children: [], style: {}, dataset: {}, attrs: {}, className: '', _text: '',
      classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
      append(...k) { n.children.push(...k); },
      remove() { n.removed = true; },
      addEventListener() {}, removeEventListener() {},
      setAttribute(a, v) { n.attrs[a] = v; }, getAttribute(a) { return n.attrs[a]; },
      setPointerCapture() {}, querySelectorAll: () => [],
      set innerHTML(v) { n.children = []; }, get innerHTML() { return ''; },
      set textContent(v) { n._text = String(v); n.children = []; },
      get textContent() { return n._text + n.children.map((c) => (typeof c === 'string' ? c : c.textContent ?? '')).join(''); },
    };
    return n;
  };
  return { createElement: () => node(), getElementById: () => null, head: node(), body: node(), addEventListener() {}, removeEventListener() {} };
}
const onMapPage = (fn) => {
  const had = globalThis.document, hadLoc = globalThis.location;
  globalThis.location = { search: '?skin=enhanced' };
  globalThis.document = mapPage();
  try { return fn(); } finally { globalThis.document = had; if (hadLoc === undefined) delete globalThis.location; else globalThis.location = hadLoc; }
};

test('AUDIT GUIDE K1/K4/U15: a press on a quest\'s diamond picks its place - the diamond stands above the place, out of the place mark\'s reach, and the press started a journey to the bare pixel north of it; a place whose kind the key hides is picked from its own record, the goto\'s way (mutants: the quest not asked; the hidden place not picked)', async () => {
  const k = await heldMapKit();
  k._resetForTests();
  onMapPage(() => {
    const win = k.mk({ quests: () => [k.mark(3, 7, true), k.mark(6, 4, false, 'The Crypt Errand')] });
    win.tick(0); k.aim(win);
    const [x, y] = k.toPaper(win._view, 3.5, 7.5);
    win._pickAt(x, y - k.qm.QUEST_MARK_LIFT);
    assert.ok(win._selected && !win._selected.coords, `the place picked, not a bare pixel: ${win._selected?.name ?? 'nothing'}`);
    assert.deepEqual([Math.floor(win._selected.x), Math.floor(win._selected.y)], [3, 7], 'the quest\'s place');
    win._select(null);
    win.filters.dungeons = true;   // MAP-KEY: the crypt's kind hidden
    win._marksDirty = true; win._model = null; win._ensureWorldModel?.();
    const [cx, cy] = k.toPaper(win._view, 6.5, 4.5);
    win._pickAt(cx, cy - k.qm.QUEST_MARK_LIFT);
    assert.ok(win._selected && !win._selected.coords, 'the hidden place\'s quest still picks its place');
    assert.deepEqual([Math.floor(win._selected.x), Math.floor(win._selected.y)], [6, 4]);
    win.dispose();
  });
});

test('AUDIT GUIDE K8/U15: the place card names the quests that point at the place - where a keyboard or a finger that never hovers learns them (mutant: the line dropped)', async () => {
  const k = await heldMapKit();
  k._resetForTests();
  onMapPage(() => {
    const win = k.mk({ quests: () => [k.mark(3, 7, true, 'The First Road', { quests: [{ title: 'The First Road', left: '1 day left' }, { title: 'The Other Road', left: '' }] })] });
    win.tick(0); k.aim(win);
    const [x, y] = k.toPaper(win._view, 3.5, 7.5);
    win._pickAt(x, y);
    const card = win._chrome.card;
    const text = JSON.stringify(card.children.map((c) => c.textContent));
    assert.match(text, /The First Road - 1 day left/, text);
    assert.match(text, /The Other Road/);
    win.dispose();
  });
});

test('AUDIT GUIDE K2/K5: a mark two quests share says the town alone and each quest on its own line with its own building, the followed quest first; past the card\'s lines it says how many more; a line keeps its time and a label keeps its place (mutants: the first quest\'s building for all; the followed not first; no "more"; the time cut)', async () => {
  const k = await heldMapKit();
  const find = { regionIndex: 17, regionName: 'Devilrock', locationName: 'Bigtown' };
  const v = (id, title, building, seconds = null) => ({ id, title, clockSeconds: seconds, target: { find, buildingName: building },
    words: { where: building ? `${building}, Bigtown in Devilrock province` : 'Bigtown in Devilrock province', town: 'Bigtown in Devilrock province' } });
  const px = () => ({ x: 3, y: 7 });
  // the followed quest names a building and comes second: its building is not the town's, and it is listed first
  const two = k.qm.questMapMarks([v('1', 'The Town Errand', null), v('2', 'The Tavern Errand', 'The Feather and Dog')], '2', px)[0];
  assert.equal(two.tip.lines[0], 'Bigtown in Devilrock province', 'the town alone');
  assert.equal(two.tip.lines[1], 'The Tavern Errand (The Feather and Dog)', 'the followed quest first, with its own building');
  assert.equal(two.tip.lines[2], 'The Town Errand', 'each with its own building');
  assert.match(two.label, /Bigtown in Devilrock province$/, 'the label keeps the town');
  assert.doesNotMatch(two.label, /Feather and Dog/, 'not one quest\'s building');
  const many = k.qm.questMapMarks(Array.from({ length: 6 }, (_, i) => v(String(i), `A Very Long Quest Title Number ${i} Of The Western Reach`, null, 90000)), '5', px)[0];
  assert.equal(many.tip.title, '6 quests');
  assert.ok(many.tip.lines.length <= 5, 'inside the card\'s five lines');
  assert.match(many.tip.lines[1], /^A Very Long Quest Title Number 5/, 'the followed one first');
  assert.match(many.tip.lines.at(-1), /^\+\d more$/, 'how many more');
  for (const l of many.tip.lines) assert.ok(l.length <= 80, `inside 80: ${l}`);
  assert.ok(many.tip.lines.slice(1, -1).every((l) => /1 day 1 hour left$/.test(l)), 'each keeps its time whole');
  assert.ok(many.label.length <= 120 && /Bigtown in Devilrock province/.test(many.label), `the label keeps its place: ${many.label}`);
});

test('AUDIT GUIDE K7: a quest at a raided town stands its diamond clear of the raid\'s blades, and the diamond answers as the quest (mutants: the lift not raised; the raid first on the diamond)', async () => {
  const k = await heldMapKit();
  const { raidMapMarks } = await import('../src/ui/eventMapMarks.js');
  k._resetForTests();
  onMapPage(() => {
    const raid = { raidId: 1, regionIndex: 17, locationIndex: 0, locationName: 'Bigtown', px: 3, py: 7, type: 0, startMinute: 0, endMinute: 999999, attackAmount: 5, killed: 0 };
    const win = k.mk({ quests: () => [k.mark(3, 7, true)], raids: () => raidMapMarks([raid], 10, { regionName: () => 'Daggerfall' }) });
    win.tick(0); k.aim(win);
    assert.ok(Number.isFinite(k.qm.QUEST_RAID_LIFT) && k.qm.QUEST_RAID_LIFT >= 18 + k.qm.QUEST_HIT_PX, 'a lift clear of the blades\' reach');
    assert.equal(win._quests[0].lift, k.qm.QUEST_RAID_LIFT, 'lifted over the blades');
    const [x, y] = k.toPaper(win._view, 3.5, 7.5);
    assert.equal(win._hoverLabel(x, y - k.qm.QUEST_RAID_LIFT).tip?.title, 'The First Road', 'the diamond is the quest\'s');
    assert.match(win._hoverLabel(x, y - 18).label, /under attack/, 'the blades still the raid\'s');
    // between them both reaches meet (the blades 18 up, the diamond 42, each 16 about): the diamond answers first
    const mid = y - (18 + k.qm.QUEST_RAID_LIFT) / 2;
    assert.ok(win._raidAt(x, mid) && win._questAt(x, mid, { diamondOnly: true }), 'a point in both reaches');
    assert.equal(win._hoverLabel(x, mid).tip?.title, 'The First Road', 'where both reach, the diamond is the quest\'s');
    win.dispose();
  });
});

test('AUDIT GUIDE U16: the followed quest\'s diamond is filled with the pen\'s INK (8:1 on the paper), not the gold (2:1) - and the legend names both kinds (mutants: the gold fill; the legend\'s one dot)', async () => {
  const k = await heldMapKit();
  const calls = [];
  const st = {};
  const ctx = new Proxy({}, { get: (_, p) => (p in st ? st[p] : (...a) => calls.push({ fn: p, fillStyle: st.fillStyle })), set: (_, p, v) => { st[p] = v; return true; } });
  k.paintQuestMark(ctx, { ox: 0, oy: 0, scale: 10 }, { x: 5, y: 5, tracked: true });
  const fills = calls.filter((c) => c.fn === 'fill');
  assert.equal(fills.length, 1);
  assert.equal(fills[0].fillStyle, k.PEN.line, 'filled with the ink');
  k._resetForTests();
  onMapPage(() => {
    const win = k.mk({ quests: () => [k.mark(3, 7, true), k.mark(6, 4, false, 'Other')] });
    win.tick(0);
    const words = win._chrome.legend.children.map((c) => c.textContent).filter(Boolean);
    assert.ok(words.includes(k.qm.QUEST_LEGEND_TEXT) && words.includes(k.qm.QUEST_FOLLOWED_TEXT), `both: ${words}`);
    win.dispose();
  });
});

test('AUDIT GUIDE K3/K6: while a place is picked the card stands above the foot (the foot\'s buttons took the card\'s Travel press), and a phone\'s legend wraps inside the foot rather than running off the screen (mutants: each rule)', async () => {
  const { ENHANCED_CSS } = await import('../src/ui/enhancedStyle.js');
  const css = ENHANCED_CSS.replace(/\s+/g, ' ');
  assert.match(css, /\.hmroot\.hmcardup \.hmcard \{ z-index: 1; \}/, 'K3');
  const wrap = css.indexOf('.hmlegend { flex: 1 1 auto; flex-wrap: wrap; min-width: 0; }');
  assert.ok(wrap > 0, 'K6: the legend wraps');
  const block = css.lastIndexOf('@media', wrap);
  assert.ok(css.slice(block, block + 30).startsWith('@media (max-width: 860px) {') && !css.slice(block, wrap).includes('@media (', 7), 'K6: on a phone');
});

// ---------------------------------------------------------------
// O6 - the HUD stays light, every way a module can be reached
// ---------------------------------------------------------------

/** Every relative import a module makes - `from '...'`, a bare `import '...'`, and a literal `import('...')` - comments
 *  stripped (test/importGraph.mjs's reading, with the dynamic form). */
function reachOf(entries) {
  const seen = new Set();
  const walk = (f) => {
    if (seen.has(f)) return;
    seen.add(f);
    let src;
    try { src = readFileSync(join(ROOT, f), 'utf8'); } catch { return; }
    src = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[ \t])\/\/[^\n]*/gm, '$1');
    for (const m of src.matchAll(/\bfrom\s+['"](\.[^'"]+)['"]|\bimport\s+['"](\.[^'"]+)['"]|\bimport\(\s*['"](\.[^'"]+)['"]\s*\)/g)) {
      walk(join(dirname(f), m[1] ?? m[2] ?? m[3]).replace(/\\/g, '/'));
    }
  };
  for (const e of entries) walk(e);
  return seen;
}

test('AUDIT GUIDE O6: THE HUD STAYS LIGHT, walked from the HUD itself (hud.js, enhancedHud.js) and through every way a module is reached - a static import, a bare side-effect import, a literal dynamic import(): none reaches the lens, place.js or the machine (the cycle GUIDE3 met); and the arc\'s three pins read those forms too (mutant: a bare import of the lens from a HUD face)', () => {
  const reach = reachOf(['src/ui/hud.js', 'src/ui/enhancedHud.js']);
  assert.ok(reach.size > 100, `the walk is the HUD's whole graph: ${reach.size}`);
  for (const f of ['src/ui/questLens.js', 'src/systems/quest/place.js', 'src/systems/quest/machine.js']) assert.equal(reach.has(f), false, `the HUD reaches ${f}`);
  for (const t of ['test/guide3_herald.test.js', 'test/guide4_tracker.test.js', 'test/guide5_marks.test.js']) {
    assert.match(rd(t), /import\\\(/, `${t} reads a dynamic import`);
  }
});

test('AUDIT GUIDE D1: the Overworld\'s held edge marks stand clear of the quest card, as of the HUD\'s other furniture (mutant: the card left out)', () => {
  assert.match(rd('src/ui/travelViewHud.js'), /const FURNITURE = '[^']*\.qtrack';/);
});

test('AUDIT GUIDE H6 (the draw): the frame that shows the HUD again after a window refreshes a waiting deadline\'s count (mutant: the call dropped from the draw)', () => withSwitches(() => {
  const was = globalThis.document, raf = globalThis.requestAnimationFrame;
  const doc = globalThis.document = fakePage();
  globalThis.requestAnimationFrame = () => 0;
  _setNoticeClockForTests(() => ({}), () => {});
  try {
    questHerald.hear({ quests: [hv('7', 86200)], events: [{ type: 'urgent', id: '7', title: 'The Deadline', clockSeconds: 86200 }] });
    drawQuestHerald({ dt: 0.1, doc });
    drawQuestHerald({ hidden: true, dt: 0.1, doc });   // the rest window opens
    questHerald.hear({ quests: [hv('7', 50200)], events: [] });   // ten hours pass under it
    drawQuestHerald({ dt: 0.1, doc });   // it closes
    assert.match(said()[0][2], /^13 hours/, 'the count as it stands');
  } finally {
    destroyEnhancedNotice();
    globalThis.document = was;
    globalThis.requestAnimationFrame = raf;
    _setNoticeClockForTests((f, ms) => setTimeout(f, ms), (t) => clearTimeout(t));
  }
}, { herald: true }));
