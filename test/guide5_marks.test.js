// GUIDE5 (2026-09-29, Mac: "How can we set the foundation and improve the quest system substantially? Like really
// modernize it, make it more accessible", then, of the Quest Guide arc: "This is your baby. Take your time") - THE
// MARKS (ui/questMarks.js, bible/06-Systems/Quest-Guide-Arc.md): where a quest points, on the held map and the enhanced
// compass. Its laws, each over the real producers:
//
//   ONLY WHAT THE MAP HOLDS - a mark stands only for a target with `find` (DFU's own find-place gate: on the player's
//     map and not underfoot), at the place's map pixel resolved as the held map's goto resolves it; two quests at one
//     place are one mark naming both; a place named but not on the map gets the card's "ask around" note instead.
//   ONE MODEL, TWO FACES - the tracker's model hears every look while the card OR the marks are on, and the bridge
//     forgets what it followed when neither is.
//   THE HELD MAP - the marks ride the poll, stand in the legend as a diamond, answer a hover (after a raid, before the
//     place) with the quest's card, and are inked as a diamond above the place, the followed quest's filled.
//   THE COMPASS - one mark, the tracker's quest's place, a hollow gold diamond at the gate's bearing law, hidden (never
//     removed) without one.
//   ONE HOST, ITS LAWS - the street resolves, hands the map its marks and the compass its point (the pixel's middle,
//     on the street only); drawHud forwards it; the switch is a Features row; the module's imports stay light.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  questMapMarks, readQuestMarks, questMarksKey, marksOn, QUEST_FOLLOWED_TEXT,
  MARKS_PREF, QUEST_MARK_CSS, QUEST_LEGEND_TEXT, QUEST_HIT_PX, QUEST_MARK_LIFT,
} from '../src/ui/questMarks.js';
import { timeLeftWords } from '../src/ui/questRail.js';
import { questTracker, drawQuestTracker, _resetQuestTrackerForTests, TRACKER_PREF } from '../src/ui/questTracker.js';
import { HERALD_PREF } from '../src/ui/questHerald.js';
import { createQuestBridge } from '../src/scenes/questBridge.js';
import { makeWorld, seededRolls, REGION } from './guideWorld.mjs';
import { HeldMapWindow } from '../src/ui/heldMap.js';
import { toPaper, paintQuestMark, PEN } from '../src/ui/inkMap.js';
import { RAID_MARK_CSS, raidMapMarks } from '../src/ui/eventMapMarks.js';
import { CLIMATES, LOCATION_TYPES, getMapPixelID, longitudeLatitudeToMapPixel } from '../src/formats/mapsFile.js';
import { placePixelOf } from '../src/ui/travelMapWindow.js';   // AUDIT GUIDE O3: the goto law's one home
import { compassMarkerLerp } from '../src/ui/hud.js';
import { setPref, PREF_DEFAULTS, _resetForTests } from '../src/systems/uiPrefs.js';
import { FEATURES } from '../src/systems/features.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const quiet = (fn) => { const w = console.warn, i = console.info; console.warn = () => {}; console.info = () => {}; try { return fn(); } finally { console.warn = w; console.info = i; } };

/** A view as the lens hands it: its target's `find` present only for a place the player's map holds. */
const view = (id, { title = `Q${id}`, find = null, where = null, note = null, clockSeconds = null, updatedAt = 0 } = {}) =>
  ({ id, title, updatedAt, clockSeconds, latest: { lines: [' An entry.'] }, target: find ? { find } : { find: null }, words: where || note ? { where, note, town: where } : null });   // AUDIT GUIDE K2: the lens's words carry the town
const find = (locationName, regionName = REGION) => ({ regionIndex: 0, regionName, locationName });
const PIXELS = { Bigtown: { x: 3, y: 7 }, Llugwych: { x: 8, y: 2 } };
const pixelOf = (f) => PIXELS[f.locationName] ?? null;

// ---------------------------------------------------------------
// ONLY WHAT THE MAP HOLDS
// ---------------------------------------------------------------

test('GUIDE5 ONLY WHAT THE MAP HOLDS - a mark for each quest whose target the player\'s map holds (`find`), at the host\'s pixel for it; none for a place the host cannot place or a target without `find`; two quests at one place are one mark naming both, the followed one\'s if either; the card: one quest\'s title, where and the time left - several: how many, where, each with its time (mutants: a mark without `find`; the pixel read wrong; one mark a quest; the tracked flag lost; the time dropped)', () => {
  const views = [
    view('1', { title: 'The First Road', find: find('Bigtown'), where: `Bigtown in ${REGION} province`, clockSeconds: 90000 }),
    view('2', { title: 'Not On The Map', where: `Llugwych in ${REGION} province`, note: 'Not on your map yet. Ask around for directions.' }),
    view('3', { title: 'Nowhere Known', find: find('Atlantis') }),
    view('4', { title: 'The Second Road', find: find('Llugwych'), where: `Llugwych in ${REGION} province` }),
    view('5', { title: 'Same Town', find: find('Bigtown'), where: `Bigtown in ${REGION} province` }),
  ];
  const marks = questMapMarks(views, '4', pixelOf);
  assert.deepEqual(marks, [
    { key: 'quest:3,7', px: 3, py: 7, tracked: false, label: `The First Road / Same Town - Bigtown in ${REGION} province`,
      tip: { title: '2 quests', lines: [`Bigtown in ${REGION} province`, `The First Road - ${timeLeftWords(90000)}`, 'Same Town'] },
      quests: [{ title: 'The First Road', left: timeLeftWords(90000) }, { title: 'Same Town', left: '' }] },   // AUDIT GUIDE K8: named on the place card
    { key: 'quest:8,2', px: 8, py: 2, tracked: true, label: `The Second Road - Llugwych in ${REGION} province`,
      tip: { title: 'The Second Road', lines: [`Llugwych in ${REGION} province`] },
      quests: [{ title: 'The Second Road', left: '' }] },
  ]);
  assert.equal(questMapMarks([views[0], views[4]], '1', pixelOf)[0].tracked, true, 'the followed quest listed first at a shared place keeps the mark followed');
  const one = questMapMarks([views[0]], '1', pixelOf);
  assert.deepEqual(one[0].tip, { title: 'The First Road', lines: [`Bigtown in ${REGION} province`, timeLeftWords(90000)] });
  assert.equal(one[0].tracked, true);
  assert.deepEqual(questMapMarks(views, null, () => { throw new Error('no map'); }), [], 'a resolver that throws places nothing');
  assert.deepEqual(questMapMarks(null, null, pixelOf), []);
  const noWords = questMapMarks([view('9', { find: find('Bigtown') })], null, pixelOf);
  assert.equal(noWords[0].label, 'Q9 - Bigtown', 'no words from the lens: the place\'s own name');

  // the resolver: the held map's goto law over the host's maps (AUDIT GUIDE O3: one home, ui/travelMapWindow.js
  // placePixelOf - the host reads it through its memo; questMarks.js's copy retired)
  const region = { mapNameLookup: new Map([['Bigtown', 1]]), mapTable: [{ longitude: 0, latitude: 0 }, { longitude: 12345, latitude: 23456 }] };
  const maps = { getRegionByName: (n) => (n === REGION ? region : null) };
  const at = (f) => placePixelOf(maps, f.regionName, f.locationName);
  assert.deepEqual(at(find('Bigtown')), longitudeLatitudeToMapPixel(12345, 23456));
  assert.equal(at(find('Nowhere')), null, 'a place the region has not');
  assert.equal(at(find('Bigtown', 'Elsewhere')), null, 'a region the maps have not');
  assert.equal(placePixelOf(null, REGION, 'Bigtown'), null);
});

test('GUIDE5 ONLY WHAT THE MAP HOLDS - the host\'s marks read and checked as the raids are: a throw, junk or a pixel off the bay is nothing; each mark\'s centre is its pixel\'s; the key moves with what a player can see (mutants: an off-bay pixel kept; the key blind to the followed quest)', () => {
  const size = { width: 10, height: 10 };
  assert.deepEqual(readQuestMarks(() => { throw new Error('x'); }, size), []);
  assert.deepEqual(readQuestMarks(() => 'junk', size), []);
  assert.deepEqual(readQuestMarks(undefined, size), []);
  const read = readQuestMarks(() => [{ key: 'quest:3,7', px: 3, py: 7, tracked: true, label: 'A', tip: { title: 'A', lines: [] } },
    { px: 10, py: 1 }, { px: -1, py: 1 }, { px: 1.5, py: 1 }, null, { px: 2, py: 2 }], size);
  assert.deepEqual(read.map((m) => [m.key, m.x, m.y, m.tracked]), [['quest:3,7', 3.5, 7.5, true], ['quest:2,2', 2.5, 2.5, false]]);
  const k1 = questMarksKey(read);
  assert.notEqual(questMarksKey([{ ...read[0], tracked: false }, read[1]]), k1, 'the followed quest changed: repaint');
  assert.notEqual(questMarksKey([{ ...read[0], label: 'B' }, read[1]]), k1, 'what it says changed: repaint');
  assert.equal(questMarksKey(read), k1);
});

test('GUIDE5 ONLY WHAT THE MAP HOLDS - a place the entry names but the map does not hold gets no mark and the card\'s quiet note instead: the talk arc\'s "ask around" (mutants: the note dropped)', () => {
  quiet(() => { setPref(TRACKER_PREF, true); setPref(MARKS_PREF, true); });
  _resetQuestTrackerForTests();
  try {
    questTracker.hear({ quests: [view('2', { title: 'Not On The Map', where: `Llugwych in ${REGION} province`, note: 'Not on your map yet. Ask around for directions.' })], events: [] });
    assert.equal(questTracker.frame().note, 'Not on your map yet. Ask around for directions.');
    assert.deepEqual(questMapMarks(questTracker.views, '2', pixelOf), [], 'no mark');
    // the card says it: its quiet row under the place
    const writes = [];
    const node = () => { const n = { children: [], style: {}, attrs: {}, className: '', _t: '', get textContent() { return this._t; }, set textContent(v) { writes.push(v); this._t = v; }, append(...c) { n.children.push(...c); }, setAttribute(k, v) { n.attrs[k] = v; }, remove() { n.removed = true; } }; return n; };
    const page = { createElement: node, head: node(), body: node(), documentElement: node(), getElementById: () => null };
    const hadDoc = globalThis.document;
    globalThis.document ??= page;
    try {
      drawQuestTracker({ doc: page });
      const card = page.body.children.find((n) => n.id === 'enhanced-questtracker');
      const note = card.children.find((n) => n.className === 'qtrack-note');
      assert.equal(note.textContent, 'Not on your map yet. Ask around for directions.', 'the card\'s quiet note');
      assert.equal(note.style.display, '');
    } finally { if (hadDoc === undefined) delete globalThis.document; else globalThis.document = hadDoc; }
    questTracker.hear({ quests: [view('1', { find: find('Bigtown'), where: `Bigtown in ${REGION} province` })], events: [] });
    assert.equal(questTracker.frame().note, '', 'a place on the map needs no note');
    const hadPage = globalThis.document;
    globalThis.document ??= page;   // a page, so the skin is the only answer
    try {
      assert.equal(marksOn(), true, 'the premise: the enhanced skin, the switch on, a page');
      globalThis.location = { search: '?skin=classic' };
      assert.equal(marksOn(), false, 'the classic skin: DFU\'s map and compass mark nothing');
    } finally { delete globalThis.location; if (hadPage === undefined) delete globalThis.document; else globalThis.document = hadPage; }
  } finally { _resetQuestTrackerForTests(); }
});

// ---------------------------------------------------------------
// ONE MODEL, TWO FACES
// ---------------------------------------------------------------

const MARK_SRC = [
  'Quest: __GMARK', 'DisplayName: The Marked Road', 'QRC:',
  'Message:  1010', ' Find _pub_ in __pub_.', '',
  'QBN:',
  'Place _pub_ local tavern',
  'log 1010 step 0',
];

test('GUIDE5 ONE MODEL, TWO FACES - the tracker\'s model hears every look while the card OR the marks are on (the marks alone keep it fed, the host\'s questions asked); with neither on, the bridge forgets what it followed and keeps the player\'s choice; the herald alone never feeds it (mutants: the marks not a face; the forget dropped; the herald feeding the model)', () => {
  const doc = globalThis.document;
  globalThis.document ??= {};
  _resetQuestTrackerForTests();
  try {
    quiet(() => { setPref(TRACKER_PREF, false); setPref(MARKS_PREF, true); setPref(HERALD_PREF, false); });
    assert.equal(marksOn(), true);
    const clock = { now: 1000 };
    const questWhere = { canFindPlace: () => true, currentLocationName: () => 'Elsewhere' };
    const b = quiet(() => createQuestBridge({
      data: { readListTable: () => null, getQuestSourceLines: (n) => (n === '__GMARK' ? MARK_SRC : null) },
      world: makeWorld(), classicSeconds: () => clock.now, playerEntity: { name: 'Hero', level: 3, gender: 'male' },
      getReputation: () => 0, dateTimeString: () => 'D', midDateTimeString: () => 'M', cityName: () => 'Bigtown', questWhere,
    }));
    quiet(() => b.machine.startQuestByName('__GMARK', 0, { rolls: seededRolls() }));
    quiet(() => b.tick(0.1));
    assert.equal(questTracker.views.length, 1, 'the marks alone keep the model fed');
    assert.deepEqual(questTracker.views[0].target.find, { regionIndex: questTracker.views[0].target.find.regionIndex, regionName: REGION, locationName: 'Bigtown' }, 'the host\'s questions were asked: the place is on the map');
    questTracker.toggle(questTracker.views[0].id);
    quiet(() => setPref(MARKS_PREF, false));
    quiet(() => b.tick(0.1));
    assert.deepEqual([questTracker.views, questTracker.follow], [[], null], 'neither face on: the bridge forgets what was followed');
    assert.notEqual(questTracker.pinned, null, 'the player\'s choice is the save\'s and stays');
    quiet(() => setPref(HERALD_PREF, true));
    quiet(() => b.tick(0.1));
    assert.deepEqual(questTracker.views, [], 'the herald alone looks, and never feeds the model');
  } finally {
    quiet(() => { setPref(TRACKER_PREF, true); setPref(MARKS_PREF, true); setPref(HERALD_PREF, true); });
    _resetQuestTrackerForTests();
    if (doc === undefined) delete globalThis.document; else globalThis.document = doc;
  }
});

// ---------------------------------------------------------------
// THE HELD MAP
// ---------------------------------------------------------------

function fakeDocument() {
  const node = () => {
    const n = {
      children: [], style: {}, dataset: {}, classList: { toggle() {}, add() {}, remove() {} },
      append(...k) { n.children.push(...k); },
      remove() { n.removed = true; },
      addEventListener() {}, removeEventListener() {},
      setPointerCapture() {}, querySelectorAll: () => [],
      set innerHTML(v) { n.children = []; }, get innerHTML() { return ''; },
    };
    return n;
  };
  return { createElement: () => node(), getElementById: () => null, head: node(), body: node(), addEventListener() {}, removeEventListener() {} };
}
function withDocument(fn) {
  const had = globalThis.document;
  globalThis.document = fakeDocument();
  try { return fn(globalThis.document); } finally { if (had === undefined) delete globalThis.document; else globalThis.document = had; }
}
const skin = (v) => { _resetForTests(); globalThis.location = { search: `?skin=${v}` }; };
const mkWin = (extra = {}) => new HeldMapWindow({
  getPlayerPixel: () => ({ x: 5, y: 5 }), getClimateIndex: () => CLIMATES.Woodlands,
  woods: { heightMapBuffer: new Uint8Array(100).fill(10) }, mapSize: { width: 10, height: 10 },
  gold: () => 10000, goldPieces: () => 10000, hasHorse: false, hasCart: false, hasShip: false,
  diseaseCount: () => 0, poisonCount: () => 0, ...extra,
});
function recordingCtx() {
  const calls = [];
  const state = {};
  return new Proxy({}, {
    get: (_, k) => {
      if (k === 'calls') return calls;
      if (k === 'measureText') return (t) => ({ width: t.length * 6 });
      if (k in state) return state[k];
      return (...args) => { calls.push({ fn: k, args, strokeStyle: state.strokeStyle, fillStyle: state.fillStyle }); };
    },
    set: (_, k, v) => { state[k] = v; return true; },
  });
}
const aimView = (win, ox, oy, scale) => { win._layout(); win._view = { ox, oy, scale }; win._goal = { ...win._view }; };
const markOf = (px, py, tracked, label = 'The First Road - Bigtown', title = 'The First Road') =>
  ({ key: `quest:${px},${py}`, px, py, tracked, label, tip: { title, lines: ['Bigtown in Devilrock province', '1 day left'] } });

test('GUIDE5 THE HELD MAP - the quests ride the party\'s poll (read WITH the window, and again as they change), stand in the legend as a gold diamond, and are inked as a diamond above the place: the followed quest\'s filled, the rest hollow, both edged in the pen\'s ink (mutants: the poll skipped; the legend blind to quests; every diamond filled; the diamond on the place)', () => {
  skin('enhanced');
  withDocument(() => {
    let marks = [markOf(3, 7, true)];
    let reads = 0;
    const win = mkWin({ quests: () => { reads++; return marks; } });
    assert.equal(reads, 1, 'the marks stand WITH the window');
    assert.deepEqual(win._quests.map((m) => [m.key, m.tracked]), [['quest:3,7', true]]);
    assert.deepEqual(win._quests[0].tip, { title: 'The First Road', lines: ['Bigtown in Devilrock province', '1 day left'] }, 'the card, bounded by the world events\' own reader');
    const legend = win._chrome.legend.children;
    const text = legend.map((c) => c.textContent).filter(Boolean);
    assert.ok(text.includes(QUEST_FOLLOWED_TEXT), 'the legend explains the mark (AUDIT GUIDE U16: the followed kind, as drawn)');
    const dot = legend[legend.findIndex((c) => c.textContent === QUEST_FOLLOWED_TEXT) - 1];
    assert.equal(dot.style.background, PEN.line, 'filled with the pen\'s ink');
    assert.equal(dot.style.border, `2px solid ${QUEST_MARK_CSS}`, 'edged in gold');
    assert.match(dot.style.transform, /rotate\(45deg\)/, 'the legend\'s dot is the mark\'s own diamond');
    marks = [];
    win.tick(0.3);
    assert.deepEqual(win._quests, [], 'a quest gone: its mark goes at the next poll');
    marks = [markOf(3, 7, true), markOf(8, 2, false, 'The Second Road - Llugwych', 'The Second Road')];
    win.tick(0.3);
    assert.equal(win._quests.length, 2);
    aimView(win, 0, 0, 20);
    const ctx = recordingCtx();
    win._chrome.ink.getContext = () => ctx;
    win._dirty = true;
    win._paint();
    const fills = ctx.calls.filter((c) => c.fn === 'fill' && c.fillStyle === PEN.line);
    assert.equal(fills.length, 1, 'the followed quest\'s diamond filled (AUDIT GUIDE U16: with the pen\'s ink), the other hollow');
    const golds = ctx.calls.filter((c) => c.fn === 'stroke' && c.strokeStyle === QUEST_MARK_CSS);
    assert.equal(golds.length, 2, 'both edged in gold');
    win.dispose();
  });
  // the mark on its own: the diamond QUEST_MARK_LIFT above the place, tied to it, the pen's ink under the gold
  const ctx = recordingCtx();
  paintQuestMark(ctx, { ox: 0, oy: 0, scale: 10 }, { x: 5, y: 5, tracked: false });
  const moves = ctx.calls.filter((c) => c.fn === 'moveTo').map((c) => c.args);
  assert.deepEqual(moves[0], [50, 45], 'the tie leaves the place');
  assert.deepEqual(moves[1], [50, 50 - QUEST_MARK_LIFT - 6], 'the diamond\'s top, above the place');
  assert.equal(ctx.calls.some((c) => c.fn === 'fill'), false, 'hollow when not followed');
  assert.ok(ctx.calls.some((c) => c.fn === 'stroke' && c.strokeStyle === PEN.line), 'edged in the pen\'s ink');
  assert.notEqual(QUEST_MARK_CSS, RAID_MARK_CSS);
});

test('GUIDE5 THE HELD MAP - the hover asks a raided town, then a quest\'s place, then the place itself: the quest answers with its card on its diamond or on its place, and the hand stays where a press still picks the place (mutants: the quest before the raid; the diamond out of reach; the card dropped)', () => {
  skin('enhanced');
  withDocument(() => {
    const town = { id: getMapPixelID(3, 7), mapID: 1, regionIndex: 17, mapIndex: 0, locationType: LOCATION_TYPES.TownCity, discovered: true };
    const raided = { id: getMapPixelID(8, 2), mapID: 2, regionIndex: 17, mapIndex: 1, locationType: LOCATION_TYPES.TownCity, discovered: true };
    const raid = { raidId: 1, regionIndex: 17, locationIndex: 1, locationName: 'Ashfield', px: 8, py: 2, type: 0, startMinute: 0, endMinute: 999999, attackAmount: 5, killed: 0 };
    const win = mkWin({
      quests: () => [markOf(3, 7, true), markOf(8, 2, false, 'The Raided Road - Ashfield', 'The Raided Road')],
      raids: () => raidMapMarks([raid], 10, { regionName: () => 'Daggerfall' }),
      mapDict: new Map([[town.id, town], [raided.id, raided]]),
      maps: { regionCount: 18, getRegion: () => ({ mapNames: ['Bigtown', 'Ashfield'] }), getPoliticIndex: () => 128 + 17 },
    });
    win.tick(0);
    aimView(win, 0, 0, 20);
    win._phase = 'map';
    const [qx, qy] = toPaper(win._view, 3.5, 7.5);
    const onPlace = win._hoverLabel(qx, qy);
    assert.deepEqual({ label: onPlace.label, cursor: onPlace.cursor, title: onPlace.tip?.title }, { label: 'The First Road - Bigtown', cursor: 'pointer', title: 'The First Road' }, 'the place answers as its quest, and a press still picks the place');
    assert.equal(win._hoverLabel(qx, qy - QUEST_MARK_LIFT).tip?.title, 'The First Road', 'its diamond is the quest\'s too');
    assert.equal(win._questAt(qx + QUEST_HIT_PX + 1, qy), null, 'past the reach, not the quest');
    const [rx, ry] = toPaper(win._view, 8.5, 2.5);
    assert.match(win._hoverLabel(rx, ry).label, /under attack/, 'a raided town answers as its raid first');
    win.dispose();
  });
});

// ---------------------------------------------------------------
// THE COMPASS
// ---------------------------------------------------------------

const mkEl = () => ({
  className: '', textContent: '', id: '', children: [], dataset: {},
  style: { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } },
  classList: { _s: new Set(), add(...c) { c.forEach((x) => this._s.add(x)); }, remove(...c) { c.forEach((x) => this._s.delete(x)); }, contains(c) { return this._s.has(c); }, toggle() {} },
  attrs: {},
  setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k]; },
  removeAttribute(a) { delete this.attrs[a]; }, remove() {},
  append(...c) { this.children.push(...c); }, appendChild(c) { this.children.push(c); return c; },
  replaceChildren(...c) { this.children = c; }, addEventListener() {},
});
const findAll = (n, cls, out = []) => { if (String(n.className ?? '').split(/\s+/).includes(cls)) out.push(n); for (const c of n.children ?? []) findAll(c, cls, out); return out; };

test('GUIDE5 THE COMPASS - one mark, the tracker\'s quest\'s place: a hollow diamond in the marks\' gold on the enhanced strip at the gate\'s bearing law, clamped to the strip; no point, no mark - hidden and never removed (mutants: the mark never placed; the gate\'s filled orange; the node rebuilt)', async () => {
  const prev = globalThis.document;
  globalThis.document = { createElement: mkEl, createElementNS: () => mkEl(), getElementById: () => null, head: mkEl(), body: mkEl() };
  const { drawEnhancedHud, destroyEnhancedHud } = await import('../src/ui/enhancedHud.js');
  const { clearQuickslots } = await import('../src/systems/quickslots.js');
  clearQuickslots();
  const me = { health: 40, maxHealth: 80, magicka: 0, maxMagicka: 10, fatigue: 100, items: [], equip: { slots: {} }, lightSource: null };
  const frame = (quest) => drawEnhancedHud(me, 0, 0, { weapon: null, weaponSheathed: true, playerXZ: [0, 0], quest });
  try {
    frame([0, 500]);
    const root = document.body.children.find((n) => n.className === 'hud');
    const marks = findAll(root, 'hud-quest');
    assert.equal(marks.length, 1);
    const m = marks[0];
    assert.ok(m.style.cssText.includes(`border:2px solid ${QUEST_MARK_CSS}`), 'hollow, edged in the marks\' gold');
    assert.ok(!m.style.cssText.includes('#ff5a2a'), 'never the gate\'s orange');
    assert.equal(m.style.left, `${(compassMarkerLerp([0, 500], [0, 0], 0) * 100).toFixed(1)}%`);
    frame([0, -500]);
    const behind = m.style.left;
    assert.ok(behind === '0.0%' || behind === '100.0%', 'a place behind pins to an end of the strip');
    frame(null);
    assert.equal(m.style.display, 'none', 'no place: hidden');
    frame([500, 0]);
    assert.equal(findAll(root, 'hud-quest')[0], m, 'the same node, shown again');
    assert.equal(m.style.display, '');
  } finally {
    destroyEnhancedHud();
    clearQuickslots();
    globalThis.document = prev;
  }
});

// ---------------------------------------------------------------
// ONE HOST, ITS LAWS
// ---------------------------------------------------------------

test('GUIDE5 ONE HOST, ITS LAWS - the street resolves a place with the held map\'s goto law, hands the held map every quest\'s place while the marks are on, and hands the compass the tracker\'s quest\'s place (the pixel\'s middle, the party marks\' own sum) on the street alone; drawHud forwards it and the enhanced HUD draws it; the classic map is DFU\'s and gets none; the switch is a Features row beside the tracker\'s; the module stays light (mutants: the marks off the switch; the compass indoors; the point off the pixel\'s middle; the forward dropped)', () => {
  const W = rd('src/scenes/world.js');
  assert.match(W, /const questPixel = \(find\) => questPlacePixel\(maps, find\?\.regionName \?\? '', find\?\.locationName \?\? ''\);/, 'AUDIT GUIDE O3: the host\'s memo - the held map\'s goto law (placePixelOf), read once a place');
  assert.match(W, /quests: \(\) => \(marksOn\(\) \? questMapMarks\(questTracker\.views, questTracker\.tracked\(\)\?\.id \?\? null, questPixel\) : \[\]\),/);
  assert.match(W, /const questCompassMark = \(\) => \{\n\s*if \(!marksOn\(\) \|\| \(modes\?\.mode \?\? 'exterior'\) !== 'exterior'\) return null;\n\s*const find = questTracker\.tracked\(\)\?\.target\?\.find;\n\s*const p = find \? questPixel\(find\) : null;\n\s*if \(!p\) return null;\n\s*const t = state\.pixelTranslation\(p\.x, p\.y\);\n\s*return \[t\[0\] \+ TERRAIN_SIZE \/ 2, t\[2\] \+ TERRAIN_SIZE \/ 2\];/);
  assert.match(W, /quest: (?:vendorCompassMark\(\) \?\? )?(?:townQuestCompassMark\(\) \?\? )?questCompassMark\(\),   \/\/ GUIDE5/);   // HOME-VENDOR: a trader's waypoint first, while it is set
  assert.match(rd('src/ui/hud.js'), /quest: quest \?\? null,   \/\/ GUIDE5/);
  assert.match(rd('src/ui/enhancedHud.js'), /drawQuestMark\(opts\.quest \?\? null, opts\.playerXZ \?\? null, heading01\);   \/\/ GUIDE5/);
  assert.doesNotMatch(rd('src/ui/travelMapWindow.js'), /quests/, 'the classic travel map is DFU\'s: a player who chose DFU\'s maps chose its look');
  const row = FEATURES.find((f) => f.id === 'quest-marks');
  assert.ok(row);
  assert.deepEqual([row.group, row.kinds, row.control.store, row.control.key, row.control.initial, row.control.online],
    ['interface', ['enhanced'], 'prefs', MARKS_PREF, true, 'player']);
  assert.equal(FEATURES.findIndex((f) => f.id === 'quest-marks'), FEATURES.findIndex((f) => f.id === 'quest-tracker') + 1, 'beside the tracker');
  assert.equal(PREF_DEFAULTS[MARKS_PREF], true);
  // THE HUD STAYS LIGHT: the enhanced HUD imports the marks' gold, the bridge their switch - neither reaches the machine
  const reach = new Set();
  const walk = (f) => {
    if (reach.has(f)) return;
    reach.add(f);
    for (const m of readFileSync(join(ROOT, f), 'utf8').matchAll(/^\s*(?:import|export)\s[^'"]*?from\s+['"](\.[^'"]+)['"]|^\s*import\s+['"](\.[^'"]+)['"]|\bimport\(\s*['"](\.[^'"]+)['"]\s*\)/gm)) walk(join(dirname(f), m[1] ?? m[2] ?? m[3]).replace(/\\/g, '/'));   // AUDIT GUIDE O6: a bare and a dynamic import too
  };
  walk('src/ui/questMarks.js');
  for (const f of ['src/ui/questLens.js', 'src/systems/quest/place.js', 'src/systems/quest/machine.js', 'src/ui/hud.js', 'src/formats/mapsFile.js', 'src/systems/raidingParties.js']) {
    assert.equal(reach.has(f), false, `the marks' imports reach ${f}`);
  }
  assert.equal(typeof drawQuestTracker, 'function');
});
