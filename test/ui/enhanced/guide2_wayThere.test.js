// GUIDE2 (2026-09-29, Mac: "This is your baby. Take your time") - THE WAY THERE: the enhanced journal's where line and
// DFU's own logbook click (HandleQuestClicks) on the default skin, which never had it. Over the real producers - the
// quest bridge's walk, producer-minted Places, the lens's target - and the two faces mounted headless and driven:
//
//   THE WORDS - a target said in the find-place box's own phrase, one home (the classic logbook reads it from the lens);
//     the building only when the entry names it; "Somewhere in ... province" with the region alone; "(you are here)";
//     the note ("ask around") only when the player's map is KNOWN not to have the place - never where no map was asked.
//   THE PAUSE TAB - the where line under the quest's name; "Show on map" only with a place on the map and a door in
//     this host; the press is the page's own door law (a HANDOFF, then the door; a refused map resumes); an OLDER
//     entry's own place, the logbook's click on any entry, only where it is a way somewhere else.
//   THE CHRONICLE - the same line on every live quest's card, folded or open; the press closes the journal FIRST, then
//     asks the map, DFU's order, with the door read before the close empties the module; the deadline the pause tab
//     has always carried, live once a second off the walk alone, and a clock that stopped repaints the card.
//   THE FOUR HOSTS, by source - the street hands the door and both questions (its map door now answering whether a
//     map opened); a building hands the questions and no door (DFU refuses the map indoors); the dungeon and the
//     fixed-town route hand what they can answer and no door.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import '../../chargenDom.mjs';   // the minimal DOM - globals
import { REGION, RI, makeWorld, seededRolls } from '../../guideWorld.mjs';
import { createQuestBridge } from '../../../src/scenes/quest/questBridge.js';
import { entryTarget, targetWords, locationInRegionText, WHERE_TEXT } from '../../../src/ui/quest/questLens.js';
import { FIND_PLACE_TEXT } from '../../../src/ui/quest/questJournal.js';
import { mountEnhancedMenu } from '../../../src/ui/enhanced/enhancedMenu.js';
import { mountEnhancedChronicle } from '../../../src/ui/enhanced/enhancedChronicle.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

// NO LIVE TIMER RUNS IN THIS SUITE. Both faces arm a once-a-second interval over a live clock (the pause tab's QT-LIVE1
// timer, the chronicle's GUIDE2 deadline); a real one left armed by a failing assertion holds the process open instead
// of failing it - which is how this suite's first mutation campaign hung. Every interval is recorded here instead: its
// callback and period while it stands, gone when it is cleared, so a pin can fire one by hand and ask that none is left.
const intervals = new Map();
let nextInterval = 1;
globalThis.setInterval = (fn, ms) => { const id = nextInterval++; intervals.set(id, { fn, ms }); return id; };
globalThis.clearInterval = (id) => { intervals.delete(id); };
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const quiet = (fn) => { const w = console.warn, i = console.info; console.warn = () => {}; console.info = () => {}; try { return fn(); } finally { console.warn = w; console.info = i; } };

const WAY_SRC = [
  'Quest: __GWAY', 'DisplayName: The Way There', 'QRC:',
  'Message:  1010', ' Find _pub_ in __pub_.', '',
  'Message:  1011', ' Now go to ___keep_ in ____keep_.', '',
  'Message:  1012', ' Somewhere in ____keep_, they said.', '',
  'Message:  1013', ' Back to __pub_ it is.', '',
  'QBN:',
  'Place _pub_ local tavern',
  'Place _keep_ permanent Llugwych',
  'Clock _timer_ 3.00:00', '',
  '_timer_ task:', ' end quest', '',
  '_next_ task:', ' log 1011 step 1', '',
  '_vague_ task:', ' log 1012 step 2', '',
  '_back_ task:', ' log 1013 step 1', '',
  'log 1010 step 0',
  'start timer _timer_',
];

/** The real bridge over the crafted world, the quest started and ticked. */
function wayBridge() {
  const clock = { now: 50000 };
  const b = quiet(() => createQuestBridge({
    data: { readListTable: () => null, getQuestSourceLines: (n) => (n === '__GWAY' ? WAY_SRC : null) },
    world: makeWorld(),
    classicSeconds: () => clock.now,
    playerEntity: { name: 'Hero', level: 3, gender: 'male' },
    getReputation: () => 0,
    dateTimeString: () => 'D', midDateTimeString: () => 'M', cityName: () => 'Bigtown',
  }));
  quiet(() => b.machine.startQuestByName('__GWAY', 0, { rolls: seededRolls() }));
  quiet(() => { b.machine.tick(); b.machine.tick(); });
  const q = [...b.machine.quests.values()].find((x) => x.questName === '__GWAY');
  const step = (task) => { clock.now += 10; q.startTask({ name: task }); quiet(() => { b.machine.tick(); b.machine.tick(); }); };
  return { b, q, clock, step };
}
const all = (root, cls) => root.querySelectorAll('.' + cls);
const one = (root, cls) => { const n = all(root, cls); assert.equal(n.length, 1, `one .${cls}`); return n[0]; };
const buttonsIn = (node) => node.querySelectorAll('button');

// ---------------------------------------------------------------
// THE WORDS
// ---------------------------------------------------------------

test('GUIDE2 THE WORDS - a target in the find-place box\'s own phrase, one home (the classic logbook\'s FIND_PLACE_TEXT reads it from the lens): the building first when the entry names it, then "{town} in {region} province"; the region alone as "Somewhere in ... province"; "(you are here)" underfoot, with no way there; the note only when the player\'s map is KNOWN not to have a named place - not with the region alone, not underfoot, and never where no map was asked (onMap null); nothing to say is null (mutants: the note on an unasked map; the note underfoot; the building dropped; the phrase drifted)', () => {
  const { q, step } = wayBridge();
  const at = (id, where) => { const w = targetWords(entryTarget(q.getMessage(id), where)); if (w) delete w.town; return w; };   // AUDIT GUIDE K2's town: its own pin below
  const map = (onMap, here = 'Elsewhere') => ({ canFindPlace: () => onMap, currentLocationName: () => here });

  assert.equal(FIND_PLACE_TEXT.locationInRegion, locationInRegionText, 'one home for locationInRegionProvince');
  assert.equal(targetWords(entryTarget(q.getMessage(1010), map(true))).town, `Bigtown in ${REGION} province`, 'AUDIT GUIDE K2: the place without its building - what a shared map mark says');
  assert.equal(locationInRegionText('Daggerfall', 'Daggerfall'), 'Daggerfall in Daggerfall province', 'DFU\'s words, verbatim');

  assert.deepEqual(at(1010, map(false)), { where: 'The Feather and Dog, Bigtown', note: WHERE_TEXT.offMap, find: null }, 'AUDIT GUIDE W1: off the map, the entry\'s own names - the town, not its region');
  assert.deepEqual(at(1010, map(true)), { where: `The Feather and Dog, Bigtown in ${REGION} province`, note: null, find: { regionIndex: RI, regionName: REGION, locationName: 'Bigtown' } });
  assert.deepEqual(at(1010, map(true, 'Bigtown')), { where: `The Feather and Dog, Bigtown in ${REGION} province (you are here)`, note: null, find: null }, 'underfoot: said so, and nowhere to travel to');
  assert.deepEqual(at(1010, map(false, 'Bigtown')).note, WHERE_TEXT.offMap, 'AUDIT GUIDE W2: a map that says no says the Bigtown underfoot is another of the name - the note stands');
  assert.deepEqual(at(1010, { currentLocationName: () => 'Bigtown' }).where, `The Feather and Dog, Bigtown in ${REGION} province (you are here)`, 'no map to ask: the name is the claim, DFU\'s gate');
  assert.deepEqual(at(1010, {}), { where: 'The Feather and Dog, Bigtown', note: null, find: null }, 'no map asked: the entry\'s own names (AUDIT GUIDE W1: the town, not its region), no note and no door');
  assert.deepEqual(at(1011, map(false)), { where: `Llugwych in ${REGION} province`, note: WHERE_TEXT.offMap, find: null });
  assert.deepEqual(at(1012, map(false)), { where: `Somewhere in ${REGION} province`, note: null, find: null }, 'the region said and the town not: nothing to ask about by name');
  assert.deepEqual(at(1012, map(true)), { where: `Llugwych in ${REGION} province`, note: null, find: { regionIndex: RI, regionName: REGION, locationName: 'Llugwych' } }, 'on the map, DFU\'s box would name it');
  assert.equal(targetWords(null), null);
  assert.equal(targetWords({ locationName: null, regionName: null, buildingName: null }), null, 'a target that names nothing says nothing');
  assert.equal(WHERE_TEXT.somewhere('Wayrest'), 'Somewhere in Wayrest province');
  step('next');   // (the bridge is live - the words above were off producer-minted Places)
});

// ---------------------------------------------------------------
// THE PAUSE TAB
// ---------------------------------------------------------------

/** Mount the pause window on its Quests tab over a host's bag (`over` replaces a hook; undefined removes it) and run
 *  `fn` with it - unmounted whatever `fn` does, because the tab arms a live timer that would otherwise hold the process. */
function withPauseTab(bridge, over, fn) {
  const t = pauseTab(bridge, over);
  try { return fn(t); } finally { t.menu.unmount(); assert.equal(intervals.size, 0, 'the tab\'s timer went with it'); }
}
function pauseTab(bridge, over = {}) {
  const acts = [];
  const doors = [];
  const hooks = {
    questLog: () => bridge.questLog(),
    canFindPlace: () => true,
    currentLocationName: () => 'Elsewhere',
    showQuestPlace: (find) => { doors.push(find); acts.push('door'); return true; },
    ...over,
  };
  for (const k of Object.keys(hooks)) if (hooks[k] === undefined) delete hooks[k];
  const host = globalThis.document.createElement('div');
  const menu = mountEnhancedMenu(host, { mode: 'pause', hooks, onAction: (a) => acts.push(a), at: 'quests' });
  return { host, menu, acts, doors };
}

test('GUIDE2 THE PAUSE TAB, mounted and pressed: the where line under the quest\'s name says where its LATEST entry sends the player; "Show on map" stands only with a place on the map AND a door in this host, labelled with the place; a press is the page\'s own door law - a HANDOFF first, then the door with the find-place payload, and a map the host refuses RESUMES; with no door the line stands alone; a place not on the map says to ask; with no map asked there is no note and no door (mutants: the button without a door; the door before the handoff; no resume on a refusal; the latest entry\'s place taken from the first)', () => {
  const { b, step } = wayBridge();
  step('next');   // latest: "Now go to Llugwych" - the first entry named the tavern in Bigtown

  withPauseTab(b, {}, (t) => {
    const where = one(t.host, 'px-qwhere');
    assert.equal(one(where, 'px-qwhere-place').textContent, `Llugwych in ${REGION} province`, 'the LATEST entry\'s place');
    const go = buttonsIn(where);
    assert.equal(go.length, 1);
    assert.equal(go[0].textContent, WHERE_TEXT.show);
    assert.equal(go[0].attrs['aria-label'], `Show on map: Llugwych in ${REGION} province`, 'AUDIT GUIDE U12: its own words first');
    go[0].click();
    assert.deepEqual(t.acts, ['handoff', 'door'], 'the page goes down as a handoff FIRST - no relock under the map - and then the map is asked for');
    assert.deepEqual(t.doors, [{ regionIndex: RI, regionName: REGION, locationName: 'Llugwych' }], 'and the map is asked for with the place');
  });
  const refused = [];
  withPauseTab(b, { showQuestPlace: (find) => { refused.push(find); return false; } }, (t) => {
    buttonsIn(one(t.host, 'px-qwhere'))[0].click();
    assert.deepEqual(t.acts, ['handoff', 'resume'], 'a map the host refused (it said why): the page resumes rather than leave nothing up');
    assert.deepEqual(refused, [{ regionIndex: RI, regionName: REGION, locationName: 'Llugwych' }]);
    assert.equal(refused.length, 1);
  });
  withPauseTab(b, { showQuestPlace: undefined }, (t) => {
    assert.equal(buttonsIn(one(t.host, 'px-qwhere')).length, 0, 'no door in this host, no button - the line stands');
  });
  withPauseTab(b, { canFindPlace: () => false }, (t) => {
    const off = one(t.host, 'px-qwhere');
    assert.equal(buttonsIn(off).length, 0, 'not on the map: no way there');
    assert.equal(one(off, 'px-qwhere-note').textContent, WHERE_TEXT.offMap);
  });
  withPauseTab(b, { canFindPlace: undefined }, (t) => {
    const unasked = one(t.host, 'px-qwhere');
    assert.equal(all(unasked, 'px-qwhere-note').length, 0, 'no map asked: no note');
    assert.equal(buttonsIn(unasked).length, 0);
  });
});

test('GUIDE2 THE PAUSE TAB - an OLDER entry\'s own place, the classic logbook\'s click on ANY entry: drawn in the trail only where it is a way somewhere (on the map, a door here) and not the place the quest points now; pressed, the same handoff and the same door; off the map, or with no door, the trail says nothing of places (mutants: the older link without a door; the latest place offered twice; the note in the trail)', () => {
  const { b, step } = wayBridge();
  step('next');
  withPauseTab(b, {}, (t) => {
    const trail = all(t.host, 'px-qentry-where');
    assert.equal(trail.length, 1, 'the first entry named the tavern - a different place, on the map');
    assert.equal(one(trail[0], 'px-qentry-where-place').textContent, `The Feather and Dog, Bigtown in ${REGION} province`);
    buttonsIn(trail[0])[0].click();
    assert.deepEqual(t.acts, ['handoff', 'door']);
    assert.deepEqual(t.doors, [{ regionIndex: RI, regionName: REGION, locationName: 'Bigtown' }]);
  });
  withPauseTab(b, { canFindPlace: () => false }, (t) => {
    assert.equal(all(t.host, 'px-qentry-where').length, 0, 'off the map: no way to offer, and the trail carries no note');
  });
  withPauseTab(b, { showQuestPlace: undefined }, (t) => {
    assert.equal(all(t.host, 'px-qentry-where').length, 0, 'no door: nothing to press');
  });
  // the latest entry sends the player back to Bigtown: the older entry's place IS the one offered above, so the trail
  // does not offer it a second time
  const { b: b3, step: step3 } = wayBridge();
  step3('back');
  withPauseTab(b3, {}, (t) => {
    assert.equal(one(t.host, 'px-qwhere-place').textContent, `Bigtown in ${REGION} province`);
    assert.equal(all(t.host, 'px-qentry-where').length, 0, 'the place the quest points now is offered once, above');
  });
  // a quest of one entry: its place is offered once, above, and the trail - which it does not have - says nothing
  const { b: b2 } = wayBridge();
  withPauseTab(b2, {}, (t) => {
    assert.equal(all(t.host, 'px-qentry-where').length, 0, 'a single entry has no trail');
    assert.equal(one(t.host, 'px-qwhere-place').textContent, `The Feather and Dog, Bigtown in ${REGION} province`);
  });
});

// ---------------------------------------------------------------
// THE CHRONICLE
// ---------------------------------------------------------------

function chronicle(deps) {
  globalThis.window ??= globalThis;   // the chronicle listens on window; the minimal DOM's listeners are the global's
  const host = globalThis.document.createElement('div');
  const view = mountEnhancedChronicle(host, { section: 'quests', ...deps });
  return { host, view };
}
/** Mount, run, and destroy whatever `fn` does - a live card arms a real timer that would otherwise hold the process. */
function withChronicle(deps, fn) {
  const c = chronicle(deps);
  try { return fn(c); } finally { c.view.destroy(); assert.equal(intervals.size, 0, 'the deadline\'s interval went with it'); }
}

test('GUIDE2 THE CHRONICLE, mounted and pressed: every live quest\'s card carries its where line under its head, and keeps it when the card is shut; "Show on map" with a place on the map and a door; the press closes the journal FIRST and then asks the map - DFU\'s FindPlace_OnButtonClick order - with the door read before the close empties the window; no door, no button (mutants: the door read after the close; the map before the close; the line hidden when shut)', () => {
  const { b, step } = wayBridge();
  step('next');
  const order = [];
  let c = null;
  c = chronicle({
    questLog: () => b.questLog(),
    canFindPlace: () => true,
    currentLocationName: () => 'Elsewhere',
    showQuestPlace: (find) => { order.push(['door', find]); return true; },
    onExit: () => { order.push(['exit']); c.view.destroy(); },
  });
  try {
    const where = one(c.host, 'cr-where');
    assert.equal(one(where, 'cr-whereplace').textContent, `Llugwych in ${REGION} province`);
    assert.equal(intervals.size, 1, 'a live card with a clock arms the deadline');
    // shut the card: the where line stands
    one(c.host, 'cr-fold').click();
    assert.equal(all(c.host, 'cr-where').length, 1, 'the quest\'s state stands on a shut card, as its title does');
    const go = buttonsIn(one(c.host, 'cr-where')).find((x) => x.textContent === WHERE_TEXT.show);
    assert.ok(go, 'the way there');
    go.click();
    assert.deepEqual(order, [['exit'], ['door', { regionIndex: RI, regionName: REGION, locationName: 'Llugwych' }]],
      'the journal closes, THEN the map is asked for with the place - and the door was read before the close emptied the window');
    assert.equal(intervals.size, 0, 'and the close took the deadline\'s interval with it');
  } finally {
    c.view.destroy();
  }

  withChronicle({ questLog: () => b.questLog(), canFindPlace: () => true, currentLocationName: () => 'Elsewhere' }, (bare) => {
    assert.equal(buttonsIn(one(bare.host, 'cr-where')).filter((x) => x.textContent === WHERE_TEXT.show).length, 0, 'no door, no button');
  });
});

test('GUIDE2 THE CHRONICLE\'S DEADLINE - the "Time remains" the pause tab has carried since PX5, on the window the L key opens: urgent under a day in the pause tab\'s own words; live once a second off the host\'s WALK alone (no entry is read for it); a clock that stopped under the window repaints the card; the interval has one owner - cleared by every render and by destroy (mutants: the timer never armed; the interval left running after destroy; a stopped clock left standing; the words drifted from the pause tab\'s)', () => {
  const { b, clock } = wayBridge();
  intervals.clear();
  let reads = 0;
  const c = chronicle({ questLog: () => { reads++; return b.questLog(); }, canFindPlace: () => true, currentLocationName: () => 'Elsewhere' });
  try {
    assert.equal(one(c.host, 'cr-timer').textContent, 'Time remains: 3 days');
    assert.equal(intervals.size, 1, 'one interval, armed after the spans exist');
    const [[firstId, first]] = [...intervals];
    assert.equal(first.ms, 1000);
    clock.now += 2 * 86400 + 3600 + 5;   // under a day, the clock charged on the live read
    const before = reads;
    first.fn();
    assert.equal(reads, before + 1, 'the walk, read once for the tick');
    assert.equal(one(c.host, 'cr-timer').textContent, 'Time remains: 22 hours 59 min');
    assert.match(one(c.host, 'cr-timer').className, /\burgent\b/, 'urgent gold under a day, as the pause tab');
    // the clock runs out: the quest ends under the window, and the card repaints (no timer, no quest)
    clock.now += 86400;
    quiet(() => { for (let i = 0; i < 6; i++) b.machine.tick(); });
    first.fn();
    assert.equal(all(c.host, 'cr-timer').length, 0, 'a stopped clock repaints the card');
    assert.equal(intervals.has(firstId), false, 'the repaint cleared the old interval');
    assert.equal(intervals.size, 0, 'and armed none - there is no clock left to watch');
  } finally {
    c.view.destroy();
  }
  assert.equal(intervals.size, 0, 'destroy leaves nothing standing');
  const src = rd('src/ui/enhanced/enhancedChronicle.js');
  assert.match(src, /destroy\(\) \{\n\s*disarmClocks\(\);/, 'destroy clears it');
  assert.match(src, /function render\(\) \{\n\s*disarmClocks\(\);/, 'every render clears it first');
  assert.equal((src.match(/setInterval\(/g) ?? []).length, 1, 'one interval in the window');
});

// ---------------------------------------------------------------
// THE FOUR HOSTS, by source
// ---------------------------------------------------------------

test('GUIDE2 THE FOUR HOSTS, by source: the street (world.js) hands the pause tab the door and both questions, and its map door answers whether a map opened - true once it is in the slot, false for every refusal; its journal builder offers the enhanced chronicle the door only where the map opens (the builder is the interior\'s too); a building (worldModes.js) hands the questions and no door; the dungeon (dungeonContext.js) takes the questions through the same delegation the Share button rides, and no door; the fixed-town route (exterior.js) answers the city it stands in and hands no map question and no door (mutants: the door handed indoors; the refusals answering nothing; the success answering nothing)', () => {
  const w = rd('src/scenes/world.js');
  const door = w.slice(w.indexOf('const toggleTravelMap = (gotoPlace = null) => {'), w.indexOf('/** GUIDE2: THE JOURNAL\'S WAY THERE'));
  const callback = door.slice(door.indexOf('_travelMap = buildTravelMapWindow({'), door.indexOf('if (!_travelMap)'));
  const outside = door.replace(callback, '');
  assert.equal((outside.match(/return false;/g) ?? []).length, 9, 'nine refusals, each answering that no map opened');
  assert.doesNotMatch(outside, /return;/, 'no refusal answers nothing');
  assert.match(outside, /townTalk\.showOverlay\(_travelMap\);\n\s*return true;\n\s*\};/, 'the one success, once the map is in the slot');
  assert.doesNotMatch(callback, /return false;/, 'the travel callback inside it keeps its own answers');
  assert.match(w, /const showQuestPlace = \(find\) => toggleTravelMap\(\{ siteDetails: find \}\);/, 'the find-place payload, as both maps read it');
  const pause = w.slice(w.indexOf('const pauseDoorHooks = () => ({'), w.indexOf('  const keys = new Set();', w.indexOf('const pauseDoorHooks = () => ({')));
  for (const k of ['currentLocationName: () => _questLoc()?.name ?? \'\'', 'canFindPlace: (regionName, name) => canFindPlace(maps, mapDict, regionName, name)', 'showQuestPlace: (find) => showQuestPlace(find)']) {
    assert.ok(pause.includes(k), `the street's pause bag: ${k}`);
  }
  assert.match(w, /showQuestPlace: \(modes\?\.mode \?\? 'exterior'\) === 'exterior' \? \(find\) => showQuestPlace\(find\) : undefined,/, 'the journal builder: the door only where the map opens');
  assert.match(w, /questCanFindPlace: \(regionName, name\) => canFindPlace\(maps, mapDict, regionName, name\),\n\s*questLocationName: \(\) => _questLoc\(\)\?\.name \?\? '',/, 'the questions, handed on to the other hosts');

  const m = rd('src/scenes/worldModes.js');
  const interior = m.slice(m.indexOf('const interiorPauseHooks = () => ({'), m.indexOf('});', m.indexOf('const interiorPauseHooks = () => ({')));
  assert.ok(interior.includes('canFindPlace: host.questCanFindPlace,') && interior.includes('currentLocationName: host.questLocationName,'), 'a building asks the street');
  assert.doesNotMatch(interior, /showQuestPlace/, 'and hands no door: DFU refuses the map indoors');
  assert.match(m, /questCanFindPlace: host\.questCanFindPlace, questLocationName: host\.questLocationName,/, 'delegated into the dungeon');

  const d = rd('src/scenes/dungeonContext.js');
  assert.equal((d.match(/canFindPlace: opts\.questCanFindPlace,/g) ?? []).length, 2, 'the dungeon\'s journal and its pause tab both ask');
  assert.equal((d.match(/currentLocationName: opts\.questLocationName,/g) ?? []).length, 2);
  assert.doesNotMatch(d, /showQuestPlace/, 'and neither opens a map - this context owns none');

  const e = rd('src/scenes/exterior.js');
  assert.match(e, /currentLocationName: \(\) => dfLocation\.name \?\? locationName,\n\s*\}\);/, 'the fixed-town route\'s pause tab: the city it stands in');
  assert.doesNotMatch(e, /showQuestPlace|canFindPlace: \(/, 'no map asked, no map opened');
});
