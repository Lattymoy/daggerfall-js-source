// EVENT-TIP (2026-09-28, Mac: "I also want to add a tooltip to the map for these type of events. I think we should
// fold in the raid PR in the repo, since it has a new type of world event also"): the world's events on the held map -
// the Oblivion Gate's ring and the towns under a raid - each answering a hover with its card (ui/eventMapMarks.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  raidMapMarks, readRaidMarks, raidMarksKey, readTip, tipKey, placeTip, raidPartyWord,
  RAID_MARK_CSS, RAID_LEGEND_TEXT, RAID_TIP_TITLE, TIP_LINES_MAX, TIP_TEXT_MAX, RAID_HIT_PX,
} from '../../src/ui/eventMapMarks.js';
import { RAID_DURATION_MINUTES } from '../../src/systems/raidingParties.js';
import { createGateOmen, gateTip } from '../../src/systems/gate/gateOmen.js';
import { readGateMark, GATE_RING_CSS } from '../../src/ui/gate/gateMapMark.js';
import { gateTimes, gatePhase, gateCountdown, countdownText, gateModsOf, GATE_COLLAPSE_MS } from '../../src/net/gate/gateLaw.js';
import { gateModsWords } from '../../src/net/gate/gateMods.js';   // WB8c: tonight's marks on the card
import { HeldMapWindow, TAP_TIP_S } from '../../src/ui/heldMap.js';
import { toPaper, paintRaidMark } from '../../src/ui/ink/inkMap.js';
import { CLIMATES, LOCATION_TYPES, getMapPixelID } from '../../src/formats/mapsFile.js';
import { _resetForTests } from '../../src/systems/uiPrefs.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

// ── the harness: soc6's own (test/ui/soc6_partymap.test.js) - just enough document, a recording context ──
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
  globalThis.document = fakeDocument();
  try { return fn(globalThis.document); } finally { delete globalThis.document; }
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
const cardText = (win) => win._chrome.tip.children.map((c) => c.textContent);

/** A raid record as systems/raidingParties.js rollRaids mints it. */
const raid = (over = {}) => ({
  regionIndex: 17, locationIndex: 3, startDay: 700, locationName: 'Gothway Garden', type: 2,
  startMinute: 700 * 1440 + 600, endMinute: 700 * 1440 + 600 + RAID_DURATION_MINUTES,
  killed: 0, attackAmount: 20, cleansed: false, announced: false, struck: false, px: 3, py: 7, ...over,
});
const NOW = 700 * 1440 + 650;   // fifty minutes into that raid
const regionName = (r) => (r === 17 ? 'Daggerfall' : '');

test('EVENT-TIP: a raid is marked while it RUNS - begun, not withdrawn, not cleansed - at its town, in the words a hover asks for', () => {
  const marks = raidMapMarks([
    raid(),
    raid({ locationName: 'Later', startMinute: NOW + 10, endMinute: NOW + 130 }),
    raid({ locationName: 'Over', startMinute: NOW - 200, endMinute: NOW - 80 }),
    raid({ locationName: 'Held', cleansed: true }),
    raid({ locationName: 'Nowhere', px: 3.5 }),
  ], NOW, { regionName });
  assert.deepEqual(marks.map((m) => m.label), ['Gothway Garden - under attack'], 'the one running now, and it alone');
  const [m] = marks;
  assert.deepEqual({ key: m.key, px: m.px, py: m.py }, { key: '17:3:700', px: 3, py: 7 });
  assert.deepEqual(m.tip, { title: RAID_TIP_TITLE, lines: ['Gothway Garden, Daggerfall', 'Orcs attacking', 'Withdraws at 12:00'] });
  // the deaths, once some are known here; never past the target
  assert.deepEqual(raidMapMarks([raid({ killed: 12 })], NOW, { regionName })[0].tip.lines, ['Gothway Garden, Daggerfall', 'Orcs attacking', '12 of 20 driven off', 'Withdraws at 12:00']);
  assert.equal(raidMapMarks([raid({ killed: 99 })], NOW, { regionName })[0].tip.lines[2], '20 of 20 driven off');
  assert.deepEqual([0, 1, 2].map(raidPartyWord), ['Knights', 'Bandits', 'Orcs'], 'raidTypeName\'s words');
  assert.equal(raidMapMarks([raid({ type: 1 })], NOW)[0].tip.lines[0], 'Gothway Garden', 'no province: the town alone');
  assert.deepEqual(raidMapMarks(null, NOW), []);
  assert.equal(raidMapMarks([raid()], raid().endMinute)[0], undefined, 'the minute it ends it is gone');
  assert.equal(raidMapMarks([raid()], raid().startMinute).length, 1, 'the minute it begins it stands');
  assert.equal(raidMapMarks([raid({ endMinute: 700 * 1440 + 1440 + 5 })], NOW)[0].tip.lines.at(-1), 'Withdraws at 00:05', 'the game\'s clock, past midnight');
});

test('EVENT-TIP: the host\'s raids are read and checked as the party is - a throw, junk or a pixel off the bay is nothing; a card is bounded text', () => {
  assert.deepEqual(readRaidMarks(() => { throw new Error('x'); }), []);
  assert.deepEqual(readRaidMarks(() => 'raids'), []);
  assert.deepEqual(readRaidMarks(undefined), []);
  const size = { width: 10, height: 10 };
  const marks = readRaidMarks(() => [...raidMapMarks([raid()], NOW, { regionName }), { px: 12, py: 1 }, { px: -1, py: 1 }, null, { px: 1.5, py: 1 }], size);
  assert.equal(marks.length, 1);
  assert.deepEqual({ x: marks[0].x, y: marks[0].y }, { x: 3.5, y: 7.5 }, 'the pixel\'s centre');
  assert.ok(Object.isFrozen(marks[0]) && Object.isFrozen(marks[0].tip) && Object.isFrozen(marks[0].tip.lines));
  const long = readTip({ title: 'T'.repeat(200), lines: ['a', '', 'b'.repeat(200), 3, 'c', 'd', 'e', 'f'] });
  assert.equal(long.title.length, TIP_TEXT_MAX);
  assert.ok(long.lines.length <= TIP_LINES_MAX && long.lines.every((l) => l.length <= TIP_TEXT_MAX));
  assert.deepEqual(long.lines.slice(0, 3), ['a', 'b'.repeat(TIP_TEXT_MAX), '3'], 'an empty line dropped, a number said as text');
  assert.equal(readTip({ lines: ['a'] }), null, 'no title, no card');
  assert.equal(readTip('card'), null);
  assert.equal(tipKey(readTip({ title: 'A', lines: ['b', 'c'] })), 'A\nb\nc');
  assert.equal(tipKey(null), '');
  assert.notEqual(raidMarksKey(readRaidMarks(() => raidMapMarks([raid()], NOW, { regionName }))), raidMarksKey(readRaidMarks(() => raidMapMarks([raid({ killed: 3 })], NOW, { regionName }))), 'a death repaints');
});

test('EVENT-TIP: the card stands beside the pointer, turns to the other side where the screen would cut it, and never leaves the screen', () => {
  assert.deepEqual(placeTip(100, 100, 200, 80, 1000, 800), { left: 116, top: 116 });
  assert.deepEqual(placeTip(900, 100, 200, 80, 1000, 800), { left: 684, top: 116 }, 'turned left at the right edge');
  assert.deepEqual(placeTip(100, 760, 200, 80, 1000, 800), { left: 116, top: 664 }, 'turned up at the foot');
  assert.deepEqual(placeTip(5, 5, 400, 300, 300, 200), { left: 8, top: 8 }, 'a card wider than the screen keeps its corner on it');
});

test('EVENT-TIP: the gate\'s card - where, when it next moves (the countdown\'s own words), and who holds it or that he fell', () => {
  const t = gateTimes(740);
  const site = { place: 'Copperham, Wrothgarian Mountains', near: 'Copperham', px: 400, py: 200, spot: [409.6, 409.6], ring: { cx: 400.3, cy: 200.6, r: 2 } };
  const at = (ms, fell = null) => { const phase = gatePhase(t, ms, fell); return gateTip({ site, phase, t }, gateCountdown(t, ms, phase), fell); };
  const marks = (day) => { const w = gateModsWords(gateModsOf(day)); return `${w.charAt(0).toUpperCase()}${w.slice(1)}`; };
  assert.deepEqual(at(t.omenAt + 1000), { title: 'Dagon\'s Breach', lines: ['Near Copperham, Wrothgarian Mountains', `Opens in ${countdownText(t.openAt - t.omenAt - 1000)}`, 'Valkynaz Ruhn, Warden of the Burning Gate', marks(740)] });   // WB8c: and tonight's marks while he stands
  assert.equal(marks(740), 'The Storm-Crowned - Vengeful, Dagon\'s Favoured');   // WB11a: the nine-trial rotation's (it was Vengeful, Soul-Hungry)
  assert.equal(at(t.openAt + 1000).lines[1], `Open. Seals in ${countdownText(t.sealAt - t.openAt - 1000)}`);
  assert.equal(at(t.sealAt + 2000).lines[1], 'Sealed. Collapses in 9:58', 'GATE-COLLAPSE: the sealed hours say when they end');
  assert.equal(at(t.wrathAt + 1000).lines[1], 'Collapsing');
  assert.deepEqual(at(t.openAt + 65_000, t.openAt + 60_000).lines.slice(1), ['Collapsing', 'Valkynaz Ruhn has fallen'], 'a kill: collapsing, and he fell');
  // the omen's mark carries it, and the map reads it through
  const clock = { now: t.sealAt + 2000 };
  const omen = createGateOmen({ now: () => clock.now, site: () => site, say: () => {}, localTime: () => '14:52' });
  omen.frame();
  const mark = omen.mapMark();
  assert.deepEqual(mark.tip, at(t.sealAt + 2000));
  assert.deepEqual(readGateMark(() => mark, { width: 1000, height: 500 }).tip, { title: 'Dagon\'s Breach', lines: mark.tip.lines });
  assert.equal(readGateMark(() => ({ ...mark, tip: 'x' }), { width: 1000, height: 500 }).tip, null, 'a card that is not one reads as none');
  clock.now = t.wrathAt + GATE_COLLAPSE_MS; omen.frame();
  assert.equal(omen.mapMark(), null, 'gone: no ring, no card');
});

test('EVENT-TIP on the held map: the raids ride the party\'s poll, stand in the legend and on the sheet in their own crimson', () => {
  skin('enhanced');
  withDocument(() => {
    let raids = [raid()];
    let reads = 0;
    const win = mkWin({ raids: () => { reads++; return raidMapMarks(raids, NOW, { regionName }); } });
    assert.equal(reads, 1, 'the marks stand WITH the window');
    assert.deepEqual(win._raids.map((m) => m.key), ['17:3:700']);
    const legend = win._chrome.legend.children.map((c) => c.textContent).filter(Boolean);
    assert.ok(legend.includes(RAID_LEGEND_TEXT), 'the legend explains the mark');
    raids = [];
    win.tick(0.3);
    assert.deepEqual(win._raids, [], 'withdrawn: gone at the next poll');
    raids = [raid(), raid({ locationIndex: 4, locationName: 'Ashfield', px: 8, py: 2 })];
    win.tick(0.3);
    assert.equal(win._raids.length, 2);
    // the sheet: a ring about each town and its crossed blades, in the raid's crimson
    aimView(win, 0, 0, 20);
    const ctx = recordingCtx();
    win._chrome.ink.getContext = () => ctx;
    win._dirty = true;
    win._paint();
    const rings = ctx.calls.filter((c) => c.fn === 'arc' && c.strokeStyle === RAID_MARK_CSS);
    assert.equal(rings.length, 2, 'a ring a town');
    const [x, y] = toPaper(win._view, 3.5, 7.5);
    assert.ok(rings.some((c) => Math.abs(c.args[0] - x) < 1e-9 && Math.abs(c.args[1] - y) < 1e-9), 'about the town\'s own pixel');
    assert.ok(ctx.calls.some((c) => c.fn === 'stroke' && c.strokeStyle === RAID_MARK_CSS), 'and its blades');
    win.dispose();
  });
  // the mark, on its own: the ring breathes and the blades cross above it
  const ctx = recordingCtx();
  paintRaidMark(ctx, { ox: 0, oy: 0, scale: 10 }, { x: 5, y: 5 }, 0.5);
  const arc = ctx.calls.find((c) => c.fn === 'arc');
  assert.deepEqual(arc.args.slice(0, 3), [50, 50, 10]);
  const moves = ctx.calls.filter((c) => c.fn === 'moveTo').map((c) => c.args);
  assert.deepEqual(moves.slice(0, 2), [[45, 27], [55, 27]], 'two blades from their tips, above the ring');
  assert.notEqual(RAID_MARK_CSS, GATE_RING_CSS);
});

test('EVENT-TIP on the held map: the hover asks a party member, a raided town, a place, the gate\'s ring, the province - in that order - and the ring and the town answer with their cards', () => {
  skin('enhanced');
  withDocument(() => {
    const t = gateTimes(741);
    const town = { id: getMapPixelID(3, 7), mapID: 1, regionIndex: 17, mapIndex: 0, locationType: LOCATION_TYPES.TownCity, discovered: true };
    const inRing = { id: getMapPixelID(6, 5), mapID: 2, regionIndex: 17, mapIndex: 1, locationType: LOCATION_TYPES.TownCity, discovered: true };
    let fell = null;
    const clock = { now: t.openAt + 1000 };
    const omen = createGateOmen({ now: () => clock.now, site: () => ({ place: 'Copperham, Daggerfall', near: 'Copperham', px: 6, py: 4, spot: [409.6, 409.6], ring: { cx: 6.5, cy: 4.5, r: 2 } }), say: () => {}, fellAt: () => fell });
    omen.frame();
    const win = mkWin({
      gate: () => omen.mapMark(),
      raids: () => raidMapMarks([raid()], NOW, { regionName }),
      mapDict: new Map([[town.id, town], [inRing.id, inRing]]),
      maps: { regionCount: 18, getRegion: () => ({ mapNames: ['Gothway Garden', 'Copperham'] }), getPoliticIndex: () => 128 + 17 },
    });
    win.tick(0);   // the first tick lays the sheet out - spent before the view is aimed, so the view stands still under the pointer
    aimView(win, 0, 0, 20);
    win._phase = 'map';
    // the raided town: its card, and the hand (a press still picks the town under it)
    const [rx, ry] = toPaper(win._view, 3.5, 7.5);
    const onRaid = win._hoverLabel(rx, ry);
    assert.deepEqual({ label: onRaid.label, cursor: onRaid.cursor }, { label: 'Gothway Garden - under attack', cursor: 'pointer' });
    assert.deepEqual(onRaid.tip.lines, ['Gothway Garden, Daggerfall', 'Orcs attacking', 'Withdraws at 12:00']);
    assert.equal(win._hoverLabel(rx, ry - 18).tip?.title, RAID_TIP_TITLE, 'its blades are the raid\'s too');
    assert.equal(win._raidAt(rx + RAID_HIT_PX + 1, ry), null, 'past the reach, not the raid');
    // a place inside the ring answers as the place; the ring's own ground answers with the gate's card
    const [tx, ty] = toPaper(win._view, 6.5, 5.5);
    const onTown = win._hoverLabel(tx, ty);
    assert.equal(onTown.tip, undefined, 'a town in the ring is the town');
    assert.match(onTown.label, /Copperham/);
    const [gx, gy] = toPaper(win._view, 5.2, 3.4);
    const onRing = win._hoverLabel(gx, gy);
    assert.equal(onRing.tip.title, 'Dagon\'s Breach');
    assert.deepEqual(onRing.tip.lines, ['Near Copperham, Daggerfall', `Open. Seals in ${countdownText(t.sealAt - clock.now)}`, 'Valkynaz Ruhn, Warden of the Burning Gate', 'The Burning - Unyielding, Echoing', 'The Captive']);   // WB14b: and its portent; WB8c: day 741's marks (WB11a's rotation - they were the Venom-Blooded, Scarring and Grudge-Bearer)
    assert.equal(onRing.label, `Dagon's Breach - seals in ${countdownText(t.sealAt - clock.now)}`);
    const [ox, oy] = toPaper(win._view, 9.5, 9.5);
    assert.equal(win._hoverLabel(ox, oy).tip, undefined, 'past the ring: the province, no card');
    const [cx2, cy2] = toPaper(win._view, 8.2, 6.2);
    assert.equal(win._hoverLabel(cx2, cy2).tip, undefined, 'the ring is round: its square\'s corner is not the gate\'s (2.4 map pixels off)');
    // THE CARD: written at the pointer, its words as text, hidden when nothing under the pointer has one
    globalThis.innerWidth = 1000; globalThis.innerHeight = 800;   // a viewport for the card to stand in
    win._hoverAt = { sx: gx, sy: gy, cx: 300, cy: 200 };
    win._showTip(onRing.tip, 300, 200);
    assert.equal(win._chrome.tip.style.display, 'block');
    assert.deepEqual(cardText(win), ['Dagon\'s Breach', ...onRing.tip.lines]);
    assert.deepEqual([win._chrome.tip.style.left, win._chrome.tip.style.top], ['316px', '216px']);
    // a STILL pointer's card follows the poll: the gate seals under it
    clock.now = t.sealAt + 2000; omen.frame();
    win.tick(0.3);
    assert.deepEqual(cardText(win).slice(0, 3), ['Dagon\'s Breach', 'Near Copperham, Daggerfall', 'Sealed. Collapses in 9:58']);
    assert.equal(win._chrome.label.textContent, 'Dagon\'s Breach - sealed, collapses in 9:58', 'and the label with it');
    // ...and goes when the gate does
    clock.now = t.wrathAt + GATE_COLLAPSE_MS; omen.frame();
    win.tick(0.3);
    assert.equal(win._chrome.tip.style.display, 'none');
    win._showTip(onRaid.tip, 10, 10);
    win._beginClose(null);
    assert.equal(win._chrome.tip.style.display, 'none', 'no card rides the sheet down');
    delete globalThis.innerWidth; delete globalThis.innerHeight;
    win.dispose();
  });
});

test('EVENT-TIP by source: the host hands the map the raids running now, the pointer writes the card, and leaving or pressing takes it down', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /gate: \(\) => gateOmen\?\.mapMark\(\) \?\? null,\n(?:\s*\/\/[^\n]*\n)*\s*raids: \(\) => \(raidingPartiesOn\(\) \? raidMapMarks\(raidState\(\)\.raids, worldMinutes\(\), \{ regionName: \(r\) => REGION_NAMES\[r\] \?\? '', localTime: sharedClockOn\(\) \? eventLocalTime : null, relay: raidRelayState \}\) : \[\]\),/,
    'beside the gate, on the raids\' own clock, none while the mod is off - and (TIME1) online the withdrawal said in local time; (FIELD BUGS 2026-10-11g RAID-WORD, PIN MOVED) the town\'s ledger its count');
  const h = read('src/ui/heldMap.js');
  assert.match(h, /this\._hoverAt = tab \? null : \{ sx: hx, sy: hy, cx: e\.clientX, cy: e\.clientY \};\n\s*this\._showTip\(tab \? null : hit\?\.tip \?\? null, e\.clientX, e\.clientY\);/);
  assert.match(h, /stage\.addEventListener\('pointerleave', \(e\) => \{ if \(e\.pointerType !== 'mouse' && this\._tipUntil !== null\) return; this\._hoverAt = null; this\._showTip\(null\); \}\);/, 'WB13c: a tap\'s card outlives the finger\'s leaving');
  assert.match(h, /stage\.addEventListener\('pointerdown', \(\) => \{ this\._hoverAt = null; this\._tipUntil = null; this\._showTip\(null\); \}\);/);
  assert.match(h, /if \(gateMoved\) this\._refreshTip\(\);/, 'a poll that moved the marks refreshes the card under a still pointer');
  assert.match(read('src/ui/enhanced/enhancedStyle.js'), /\.hmtip \{ position: absolute; z-index: 3; display: none; pointer-events: none;/, 'the card never takes the pointer');
  // the classic page is DFU's window: it draws the gate's ring, and no raids and no card
  const classic = read('src/ui/travel/travelMapWindow.js');
  assert.doesNotMatch(classic, /deps\.raids|hmtip|eventMapMarks/);
});

test('WB13c a finger has no hover: a tap on the breach\'s ring shows its card and its label for TAP_TIP_S, then the card goes; a tap on bare ground shows none; only a finger\'s tap asks (mutants: never shown on a tap; held for ever; a mouse\'s click shows it too)', () => {
  skin('enhanced');
  withDocument(() => {
    const t = gateTimes(741);
    const clock = { now: t.openAt + 1000 };
    const omen = createGateOmen({ now: () => clock.now, site: () => ({ place: 'Copperham, Daggerfall', near: 'Copperham', px: 6, py: 4, spot: [409.6, 409.6], ring: { cx: 6.5, cy: 4.5, r: 2 } }), say: () => {}, fellAt: () => null });
    omen.frame();
    const win = mkWin({ gate: () => omen.mapMark(), maps: { regionCount: 18, getRegion: () => ({ mapNames: [] }), getPoliticIndex: () => 128 + 17 } });
    win.tick(0);
    aimView(win, 0, 0, 20);
    win._phase = 'map';
    globalThis.innerWidth = 390; globalThis.innerHeight = 844;   // a phone held upright
    const [gx, gy] = toPaper(win._view, 5.2, 3.4);
    win._tapTip(gx, gy, 120, 300);
    assert.equal(win._chrome.tip.style.display, 'block');
    assert.equal(cardText(win)[0], 'Dagon\'s Breach');
    assert.match(win._chrome.label.textContent, /^Dagon's Breach - seals in /, 'and its label');
    win.tick(TAP_TIP_S - 0.1);
    assert.equal(win._chrome.tip.style.display, 'block', 'held while it is read');
    win.tick(0.2);
    assert.equal(win._chrome.tip.style.display, 'none', 'then gone');
    assert.equal(win._tipUntil, null);
    const [ox, oy] = toPaper(win._view, 9.5, 9.5);
    win._tapTip(ox, oy, 120, 300);
    assert.deepEqual([win._chrome.tip.style.display, win._tipUntil], ['none', null], 'past the ring: no card to hold');
    delete globalThis.innerWidth; delete globalThis.innerHeight;
    win.dispose();
  });
  assert.equal(TAP_TIP_S, 4);
  assert.match(read('src/ui/heldMap.js'), /this\._sheet\?\.pickAt\?\.\(px, py\);\n\s*if \(e\.pointerType !== 'mouse'\) this\._tapTip\(px, py, e\.clientX, e\.clientY\);/, 'the press still picks; a finger\'s also shows the card');
});
