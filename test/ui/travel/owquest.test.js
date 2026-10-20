// OW-QUEST (2026-10-19, the owner, of the Overworld's gaps: "1. Do it"; bible/06-Systems/Travel-View.md OW-QUEST): WHERE
// THE QUESTS POINT, ON THE OVERWORLD. The held map's own marks (ui/quest/questMarks.js questMapMarks) - every active quest
// whose place is on the player's map - stand in the Overworld's marks (scenes/travelViewMarks.js) at their pixel's middle,
// a diamond in the journal's gold (ui/travel/travelViewHud.js questGlyph), the followed quest's filled and held at the edge;
// pressed, a journey there by the roads (scenes/world.js onTravelViewMark). Run over the real marks module, the real
// tracker and the real switch; the host's press pinned where it stands.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createTravelViewMarks, questMarkWords, QUEST_OW_TITLE_MAX } from '../../../src/scenes/travelViewMarks.js';
import { questGlyph, TV_QUEST_R } from '../../../src/ui/travel/travelViewHud.js';
import { QUEST_MARK_CSS, MARKS_PREF, questMapMarks } from '../../../src/ui/quest/questMarks.js';
import { timeLeftWords } from '../../../src/ui/quest/questRail.js';
import { patchLocaleTable, setLocale } from '../../../src/systems/textManager.js';
import { questTracker, _resetQuestTrackerForTests, TRACKER_PREF } from '../../../src/ui/quest/questTracker.js';
import { markShown, markGroup, TV_FILTER_GROUPS } from '../../../src/systems/travel/travelViewFilters.js';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { mapPixelToWorldCoords } from '../../../src/world/streamingWorld.js';
import { farDistanceText, PIXEL_KM } from '../../../src/systems/travel/travelFarPlaces.js';
import { hostText } from '../../hostText.mjs';

const quiet = (fn) => { const w = console.warn, i = console.info; console.warn = () => {}; console.info = () => {}; try { return fn(); } finally { console.warn = w; console.info = i; } };
const view = (id, title, town, clockSeconds = null) => ({ id, title, updatedAt: 0, clockSeconds, latest: { lines: [' An entry.'] },
  target: { find: { regionIndex: 0, regionName: 'Daggerfall', locationName: town } }, words: { where: `${town} in Daggerfall province`, town } });
const PIXELS = { Bigtown: { x: 200, y: 210 }, Smalltown: { x: 205, y: 212 } };

/** AUDIT OW-REVISITED L5-1: Smalltown a place the player knows, its rect off its pixel's middle (as the main quest's eight
 *  CUST dungeons stand); Bigtown none the place law answers (its mark at the pixel's middle). */
const SMALL = (() => { const o = mapPixelToWorldCoords(205, 212); return { cx: o.x + 6000, cz: o.z + 11000 }; })();
/** The marks module over a host with nothing else on the Overworld - its quest marks alone are the subject. */
function marksHost(over = {}) {
  const kept = [];
  const host = {
    TV_PLACE_LIFT: 12, _bandChase: new Map(), _bandSpent: new Set(), _hiddenPeers: new Set(), _lodesSensed: new Set(), _peerMapPoses: new Map(),
    _townOfMapId: new Map(), _tvBountyHold: new Map(), _tvLodeHold: new Map(), _tvPartyHold: new Map(), _tvVendorHold: {}, _tvWaypointHold: new Map(),
    _veils: new Set(), _wildStrangerIds: new Set(), bandMake: () => null, bandNowMs: () => 0, bandPlace: () => ({ x: 0, z: 0 }),
    cam: { pos: [0, 0, 0] }, carriageTown: () => false, csaOn: () => false, exteriorFoes: { foes: [] }, livingHideoutsHostOf: () => ({ marks: () => [] }),
    lodeSense: () => false, lodeWords: {}, motherlodeBook: { sensedAll: () => [] }, myGuildTag: () => null, params: new URLSearchParams(),
    player: { pos: [0, 0, 0] }, playerTravelPixel: () => ({ x: 200, y: 210 }), questPixel: (f) => PIXELS[f.locationName] ?? null,
    seaRaidPeerChase: () => null, townEcon: { tipFnAt: () => null },
    state: { worldCoords: () => { const o = mapPixelToWorldCoords(200, 210); return { x: o.x + 16384, z: o.z + 16384 }; } },
    travelViewBands: () => [], travelViewCamps: () => [], travelViewDungeons: () => [], travelViewFarPlaces: () => [], travelViewPlaces: () => [],
    travelViewRaiders: () => [], travellerBook: { live: () => [] }, tvRaid: { chase: new Map(), spent: new Set() },
    tvSceneKept: (h, x, z, lift) => { kept.push([x, z, lift, h]); return [x, lift, z]; },
    tvTrip: {}, tvTripLive: () => false, walkMode: true, wildCampKeys: () => new Set(), wildHidesPlayer: () => false,
    tvPlaceSummary: (px, py) => (px === 205 && py === 212 ? { pixel: { x: 205, y: 212 }, name: 'Smalltown' } : null), tvPlaceRect: () => SMALL,
    ...over,
  };
  return { kept, ...createTravelViewMarks(host) };
}

test('OW-QUEST the words: the first quest\'s title (the followed one first) cut at a word to QUEST_OW_TITLE_MAX with how many more stand there, and under it the distance and its time left (mutants: the count dropped; the cut unmade; the time left dropped)', () => {
  assert.equal(QUEST_OW_TITLE_MAX, 40);
  assert.deepEqual(questMarkWords({ quests: [{ title: 'The First Road', left: '3 days' }] }, '4.2 km'), { label: 'The First Road', sub: '4.2 km · 3 days' });
  assert.deepEqual(questMarkWords({ quests: [{ title: 'The First Road', left: '' }, { title: 'Same Town', left: '' }] }, '4.2 km'), { label: 'The First Road (+1)', sub: '4.2 km' });
  const long = questMarkWords({ quests: [{ title: 'A Very Long Quest Title That Will Not Fit The Mark At All', left: '' }] }, '1 km');
  assert.ok(long.label.length <= QUEST_OW_TITLE_MAX, long.label);
  assert.match(long.label, /^A Very Long Quest Title That Will Not…$/, 'cut at a word, an ellipsis');
  assert.equal(questMarkWords({ label: 'Bigtown', quests: [] }, '1 km').label, 'Bigtown', 'no title: the mark\'s own label');
});

test('OW-QUEST the marks: each quest place on the player\'s map a mark at its pixel\'s middle, the followed one filled and held at the edge with the distance, the rest where they lie; pressable; the card the held map\'s; none under the switch off (mutants: the pixel\'s corner; every quest held; the followed one not held; not pressable; the switch unread)', () => {
  const hadDoc = globalThis.document;
  globalThis.document ??= { createElement: () => ({}) };   // a page: marksOn's own premise
  quiet(() => { setPref(TRACKER_PREF, true); setPref(MARKS_PREF, true); });
  _resetQuestTrackerForTests();
  try {
    questTracker.hear({ quests: [view('1', 'The First Road', 'Bigtown', 90000), view('2', 'The Second Road', 'Smalltown')], events: [] });
    questTracker.toggle('2');
    const { travelViewMarks, kept } = marksHost();
    const quests = travelViewMarks().filter((m) => m.key.startsWith('quest:'));
    assert.deepEqual(quests.map((m) => [m.key, m.kind, m.edge, m.pick]), [['quest:200,210', 'quest', false, true], ['quest:205,212', 'quest tracked', true, true]]);
    // PIN MOVED (AUDIT OW-REVISITED L5-1): a known place's mark stands at the PLACE's middle (its rect's, as its plate and
    // the journey's end stand); a place the law does not answer at its pixel's middle
    const o = mapPixelToWorldCoords(200, 210);
    assert.ok(kept.some(([x, z, lift]) => x === SMALL.cx && z === SMALL.cz && lift === 12), 'the place\'s own middle, a place\'s lift');
    assert.ok(kept.some(([x, z]) => x === o.x + 16384 && z === o.z + 16384), 'unknown to the place law: the pixel\'s middle');
    const followed = quests.find((m) => m.kind === 'quest tracked');
    assert.equal(followed.label, 'The Second Road');
    const here = mapPixelToWorldCoords(200, 210);
    assert.equal(followed.sub, farDistanceText((Math.hypot(SMALL.cx - here.x - 16384, SMALL.cz - here.z - 16384) / 32768) * PIXEL_KM), 'its distance, exactly (AUDIT OW-REVISITED L5-3)');
    assert.equal(followed.tip.title, 'The Second Road', 'the held map\'s card');
    assert.match(quests[0].sub, /·/, 'a clock: the time left beside the distance');
    // the switch off: none
    quiet(() => setPref(MARKS_PREF, false));
    assert.equal(marksHost().travelViewMarks().filter((m) => m.key.startsWith('quest:')).length, 0, 'the quest marks\' own switch');
  } finally {
    _resetQuestTrackerForTests();
    quiet(() => setPref(MARKS_PREF, true));
    if (hadDoc === undefined) delete globalThis.document; else globalThis.document = hadDoc;
  }
});

test('OW-QUEST the look: never filtered (a quest is the point, not clutter); the held map\'s diamond in the journal\'s gold - the followed one filled, the rest hollow - on the dots\' black edge (mutants: a filter group; the fill always; the fill never)', () => {
  assert.equal(markGroup('quest'), null);
  assert.equal(markGroup('quest tracked'), null);
  const off = Object.fromEntries(TV_FILTER_GROUPS.map((g) => [g, false]));
  assert.equal(markShown({ kind: 'quest' }, off), true, 'every switch off: still shown');
  const ctx = () => { const ops = []; return { ops, fillStyle: '#111', strokeStyle: '#222', lineWidth: 1, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() { ops.push(['stroke', this.strokeStyle, this.lineWidth]); }, fill() { ops.push(['fill', this.fillStyle]); } }; };
  const a = ctx();
  questGlyph(a, 10, 10, true);
  assert.deepEqual(a.ops, [['stroke', '#000', 4], ['stroke', QUEST_MARK_CSS, 2], ['fill', QUEST_MARK_CSS]], 'followed: edged and filled');
  assert.deepEqual([a.fillStyle, a.strokeStyle, a.lineWidth], ['#111', '#222', 1], 'the brush handed back');
  const b = ctx();
  questGlyph(b, 10, 10, false);
  assert.ok(!b.ops.some((op) => op[0] === 'fill'), 'the rest: hollow');
  assert.equal(TV_QUEST_R, 7);
  const hud = readFileSync(new URL('../../../src/ui/travel/travelViewHud.js', import.meta.url), 'utf8');
  assert.match(hud, /if \(k === 'quest'\) return k;/, 'its own look');
  assert.match(hud, /\} else if \(look === 'quest'\) \{[^\n]*\n\s+questGlyph\(g, x, y, \/\\btracked\\b\/\.test\(m\.kind \?\? ''\)\);/, 'drawn as its diamond');
});

test('OW-QUEST the host: the quest marks read the host\'s own place law (questPixel, the compass\'s and the held map\'s), and a pressed diamond is a journey by the roads to its place - its summary from the pixel, wherever on the map it lies (mutants: the press unread; the pixel\'s numbers swapped)', () => {
  const w = hostText('src/scenes/world.js');
  assert.match(w, /createTravelViewMarks\(\{[^]*?playerTravelPixel, questPixel, seaRaidPeerChase,[^]*?\}\);/, 'handed the place law');
  assert.match(w, /const qp = \/\^quest:\(\\d\+\),\(\\d\+\)\$\/\.exec\(key\);[^\n]*\n\s+const plate = qp \? \{ summary: tvPlaceSummary\(Number\(qp\[1\]\), Number\(qp\[2\]\)\) \} : /, 'the press: its place by its pixel');
  assert.match(w, /if \(plate\?\.summary && travelViewCanGo\(\)\) travelViewRouteTo\(plate\.summary\);/, 'by the roads, where the view may go');
});

test('AUDIT OW-REVISITED L5-2 / L5-4 / L5-5: TRACK-ONLY on the Overworld - nothing tracked, nothing filled and nothing held at the edge (the journal\'s followed or latest quest is no screen\'s); a mark\'s point kept between frames and let go when its quest is done; a journey bound for the tracked quest\'s place holds ITS end at the edge, one arrow a place; the diamond\'s arrow and words in the journal\'s gold (mutants: tracked() for shown(); the hold never freed; the hold made every frame; two arrows; the gold dropped)', () => {
  const hadDoc = globalThis.document;
  globalThis.document ??= { createElement: () => ({}) };
  quiet(() => { setPref(TRACKER_PREF, true); setPref(MARKS_PREF, true); });
  _resetQuestTrackerForTests();
  try {
    questTracker.hear({ quests: [view('1', 'The First Road', 'Bigtown', 90000), view('2', 'The Second Road', 'Smalltown')], events: [] });
    assert.ok(questTracker.tracked(), 'the premise: the journal follows one');
    const { travelViewMarks, kept } = marksHost();
    const untracked = travelViewMarks().filter((m) => m.key.startsWith('quest:'));
    assert.deepEqual(untracked.map((m) => [m.kind, m.edge]), [['quest', false], ['quest', false]], 'nothing tracked: none filled, none at the edge');
    // the hold: one point a mark, kept between frames; a quest done lets it go, and it comes back fresh
    questTracker.toggle('2');
    const h1 = (travelViewMarks(), kept.at(-1)[3]);
    travelViewMarks();
    assert.equal(kept.at(-1)[3], h1, 'the same point next frame');
    questTracker.hear({ quests: [view('1', 'The First Road', 'Bigtown', 90000)], events: [] });
    travelViewMarks();
    questTracker.hear({ quests: [view('1', 'The First Road', 'Bigtown', 90000), view('2', 'The Second Road', 'Smalltown')], events: [] });
    if (!questTracker.isPinned('2')) questTracker.toggle('2');
    const back = travelViewMarks().find((m) => m.key === 'quest:205,212');
    assert.ok(back, 'the premise: it came back');
    assert.notEqual(kept.filter((k) => k[0] === SMALL.cx).at(-1)[3], h1, 'let go when it was done: a fresh point');
    // a journey bound there: its own end is held, the diamond where it lies
    const bound = marksHost({ tvTrip: { plan: { summary: { mapId: 9, pixel: { x: 205, y: 212 }, name: 'Smalltown' } }, natives: [], end: { x: SMALL.cx, z: SMALL.cz, kind: 'dest', label: 'Smalltown' } }, tvTripLive: () => true });
    const marks = bound.travelViewMarks();
    const q = marks.find((m) => m.key === 'quest:205,212');
    assert.equal(q.kind, 'quest tracked', 'the premise: the tracked quest');
    assert.equal(q.edge, false, 'the diamond not held: the journey\'s end is');
    assert.equal(marks.filter((m) => m.edge && Math.abs((m.at?.[0] ?? 0) - SMALL.cx) < 1).length, 1, 'one arrow for the place');
  } finally {
    _resetQuestTrackerForTests();
    if (hadDoc === undefined) delete globalThis.document; else globalThis.document = hadDoc;
  }
  const hud = readFileSync(new URL('../../../src/ui/travel/travelViewHud.js', import.meta.url), 'utf8');
  assert.match(hud, /look === 'bounty' \? C\.bounty : look === 'quest' \? QUEST_MARK_CSS : look === 'waypoint'/, 'its arrow in the gold');
  assert.match(hud, /look === 'stranger' \? C\.stranger : look === 'quest' \? QUEST_MARK_CSS : C\.bone;   \/\/ OWS3/, 'its words in the gold');
});

test('AUDIT OW-REVISITED L5-6: THE MARK\'S TIME LINE IN THE PLAYER\'S LANGUAGE - OW-QUEST put the quest faces\' time left under every quest mark, always shown, and it was English in every language; the held map\'s card for several quests too ("N quests", "+N more") (mutants: the count English; the phrase English; the card\'s count English)', () => {
  assert.equal(timeLeftWords(2 * 86400 + 3 * 3600), '2 days 3 hours left', 'English as it was');
  assert.equal(timeLeftWords(3600 + 60), '1 hour 1 min left');
  try {
    patchLocaleTable('de', 'Port_Strings', [['quest.remain.daysHours', '{d, plural, one {# Tag} other {# Tage}} {h, plural, one {# Stunde} other {# Stunden}}'],
      ['quest.remain.left', 'noch {time}'], ['quest.mark.many', '{n, plural, one {# Quest} other {# Quests}}'], ['quest.mark.more', '+{n} weitere']]);
    setLocale('de');
    assert.equal(timeLeftWords(2 * 86400 + 3 * 3600), 'noch 2 Tage 3 Stunden');
    assert.equal(questMarkWords({ quests: [{ title: 'Q', left: timeLeftWords(86400 + 3600) }] }, '4,4 km').sub, '4,4 km · noch 1 Tag 1 Stunde', 'under the mark');
    const many = Array.from({ length: 9 }, (_, i) => view(String(i), `Quest ${i}`, 'Bigtown'));
    const tip = quiet(() => questMapMarks(many, null, (f) => PIXELS[f.locationName] ?? null))[0]?.tip;
    assert.equal(tip?.title, '9 Quests', 'the card\'s count');
    assert.match(tip.lines.at(-1), /^\+\d+ weitere$/, 'and how many more');
  } finally { setLocale('en'); }
});
