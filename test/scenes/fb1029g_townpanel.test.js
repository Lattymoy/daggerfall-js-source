// NOTICE-PANEL (bible/01-Overview/bugs/Field-Bugs-2026-10-29g.md row 5; the owner, 2026-10-29: "remove the notice board
// prop from all cities", its replacement "a detailed drop down from the compass that shows the town name, guild control,
// prosperity and clickable notice board button ... always be present when inside a city and go away when leaving a
// city. This goes for any settlement"): the view (ui/hud/townPanel.js), the host (scenes/townPanelHost.js), the lines
// (net/townEconLaw.js townPanelLinesOf, systems/town/townEcon.js panelLinesAt), and the wiring - a town past the Bay
// (Alinor) beside the Bay's (Daggerfall), and the boards' places kept for the siege field's Market.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createTownPanel, TOWN_PANEL_TEXT, townPanelKitCss } from '../../src/ui/hud/townPanel.js';
import { createTownPanelHost, TOWN_PANEL_READ_MS, panelTownOf, PANEL_TOWN_TYPES } from '../../src/scenes/townPanelHost.js';
import { LOCATION_TYPES } from '../../src/formats/mapsFile.js';
import { compassAnchorOf } from '../../src/ui/hud/hud.js';
import { CAPITALS, capitalPlaceId, capitalSliceOrdinal, capitalSliceName, capitalCentrePixel, capitalSpanPixels, capitalDims } from '../../src/world/tamrielCapitals.js';
import { pastBayPlaceRows } from '../../src/world/pastBayRows.js';
import { createWorldPlaces } from '../../src/world/worldWide/worldPlaces.js';
import { createTownTable } from '../../src/world/worldWide/townTable.js';
import { countryOrdinal, countryPlaceId, countryPixelOfId } from '../../src/world/tamrielCountry.js';
import { tamrielSeatsOf } from '../../src/systems/town/townSeats.js';
import { townPanelLinesOf, townEconomyLine, townPriceLine, townAreaLine, TOWN_REASONS } from '../../src/net/townEconLaw.js';
import { seatTipOf } from '../../src/net/townSeatLaw.js';
import { createTownEcon } from '../../src/systems/town/townEcon.js';
import { FRAME_ROLES } from '../../src/ui/enhanced/enhancedFrame.js';
import { HUD_PIECES } from '../../src/ui/hud/hudLayout.js';
import { PREF_DEFAULTS, getPref, setPref } from '../../src/systems/uiPrefs.js';
import { siegeFieldOf } from '../../src/systems/siegeField.js';
import { hostText } from '../hostText.mjs';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

/** A page just big enough for the panel: nodes with a working class list, listeners and a query for the compass column. */
class El {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.parentNode = null; this.attrs = {}; this.listeners = {}; this.cls = new Set(); this._text = ''; this.hidden = false; this.style = {}; this.blurred = 0; }
  blur() { this.blurred++; }
  set className(v) { this.cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get className() { return [...this.cls].join(' '); }
  get classList() {
    const c = this.cls;
    return { add: (k) => c.add(k), remove: (k) => c.delete(k), contains: (k) => c.has(k), toggle: (k, on = !c.has(k)) => { if (on) c.add(k); else c.delete(k); return on; } };
  }
  append(...ns) { for (const n of ns) { n.parentNode?.children.splice(n.parentNode.children.indexOf(n), 1); n.parentNode = this; this.children.push(n); } }
  replaceChildren(...ns) { this.children = []; this._text = ''; this.append(...ns); }
  remove() { if (this.parentNode) { this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; } }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k]; }
  addEventListener(t, f) { (this.listeners[t] ??= []).push(f); }
  fire(t) { let stopped = false; for (const f of this.listeners[t] ?? []) f({ type: t, stopPropagation: () => { stopped = true; } }); return stopped; }
  set textContent(t) { this.children = []; this._text = String(t); }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
  all() { return this.children.flatMap((c) => [c, ...c.all()]); }
  byClass(k) { return this.all().filter((n) => n.cls.has(k)); }
}
function page({ compass = true } = {}) {
  const body = new El('body');
  const top = new El('div');
  if (compass) { const hud = new El('div'); hud.className = 'hud'; top.className = 'hud-top'; hud.append(top); body.append(hud); }
  const doc = {
    body, createElement: (t) => new El(t),
    getElementById: (id) => body.all().find((n) => n.id === id) ?? null,
    querySelector: (sel) => (sel === '.hud .hud-top' && compass ? top : null),
  };
  return { doc, body, top };
}
const one = (root, k) => root.byClass(k)[0];
/** Alinor as the producers mint it (AUDIT FB1029g P1: TEST THE SHAPE THE PRODUCER MINTS - its own map id and pixel). */
const ALINOR_K = CAPITALS.findIndex((c) => c.key === 'alinor');
const ALINOR_ID = capitalPlaceId(ALINOR_K, 0), ALINOR_AT = capitalCentrePixel(ALINOR_K);

test('NOTICE-PANEL the view: the town\'s name heads it, its lines under it, the Notice Board with its count of new notes and the Bounty Board where hunts are kept; the heading folds it to the name; a press is the panel\'s alone (mutants: the count unsaid; the bounty offered everywhere; a press reaching the world)', () => {
  const { doc, top } = page();
  const pressed = [];
  let folded = null;
  const p = createTownPanel({ doc, onNotice: () => pressed.push('notice'), onBounty: () => pressed.push('bounty'), onFold: (f) => { folded = f; } });
  assert.equal(p.shown, false, 'made hidden');
  assert.equal(p.el.parentNode, top, 'AUDIT FB1029g P4: seated from its making - the HUD editor\'s preview before the first town');
  p.show({ name: 'Daggerfall', lines: ['Under the Crown Charter of Daggerfall: unheld', 'Economy: Steady (50/100). Market flat.'], unseen: 3, bounty: true });
  assert.equal(p.el.parentNode, top, 'under the compass, in its column');
  assert.equal(p.shown, true);
  assert.equal(one(p.el, 'dftown-name').textContent, 'Daggerfall');
  assert.deepEqual(p.el.byClass('dftown-line').map((n) => n.textContent), ['Under the Crown Charter of Daggerfall: unheld', 'Economy: Steady (50/100). Market flat.']);
  const [notice, bounty] = p.el.byClass('dftown-btn');
  assert.equal(notice.textContent, `${TOWN_PANEL_TEXT.notice}3 new`);
  assert.ok(notice.cls.has('primary'), 'the Notice Board is what the panel is for');
  assert.equal(bounty.hidden, false);
  assert.equal(notice.fire('mousedown'), true, 'the hosts swing from a window mousedown - the press never reaches them');
  notice.fire('click'); bounty.fire('click');
  assert.deepEqual(pressed, ['notice', 'bounty']);
  assert.deepEqual([notice.blurred, bounty.blurred], [1, 1], 'AUDIT FB1029g P14: a press lets go of the focus - the next Space is no press');
  p.show({ name: 'Daggerfall', lines: [], unseen: 0, bounty: false });
  assert.equal(bounty.hidden, true, 'no hunts kept: no Bounty Board');
  assert.equal(one(p.el, 'dftown-new').textContent, '', 'nothing new: no count');
  one(p.el, 'dftown-head').fire('click');
  assert.equal(folded, true);
  assert.ok(p.el.cls.has('folded') && p.folded);
  p.hide();
  assert.equal(p.shown, false);
  assert.equal(one(p.el, 'dftown-name').textContent, '', 'AUDIT FB1029g P4: out of town its heading is the preview\'s, not the last town\'s');
  p.show({ name: 'Wayrest', lines: ['x'], unseen: 0 });
  assert.equal(one(p.el, 'dftown-name').textContent, 'Wayrest', 'drawn again in the next town');
  const lone = page({ compass: false });
  const q = createTownPanel({ doc: lone.doc });
  q.show({ name: 'Alinor', lines: [] });
  assert.ok(q.el.parentNode === lone.body && q.el.cls.has('fixed'), 'no compass column (the classic skin): on its own');
  q.place({ right: 0, bottom: 104 });
  assert.ok(q.el.cls.has('at-compass') && q.el.style.right === '0px' && q.el.style.bottom === '104px', 'AUDIT FB1029g P6, P13: on the classic compass, off the popup text at the top');
  q.place(null);
  assert.ok(!q.el.cls.has('at-compass') && q.el.style.bottom === '', 'no compass drawn: under the top edge');
  p.place({ right: 0, bottom: 104 });
  assert.ok(!p.el.cls.has('at-compass'), 'the enhanced HUD\'s column is its own place');
  assert.deepEqual([TOWN_PANEL_TEXT.unseen(1), TOWN_PANEL_TEXT.unseen(0)], ['1 new', ''], 'AUDIT FB1029g P10: the count is the panel\'s word, in the player\'s language');
  assert.match(src('src/ui/hud/townPanel.js'), /t\('town\.panel\.new', '\{n, plural, one \{# new\} other \{# new\}\}', \{ n \}\)/);
});

test('NOTICE-PANEL the frame is the kit\'s: the panel a plate over the world, its buttons the kit\'s presses and the Notice Board its brass; the classic skin wears the kit\'s copy (mutants: a role dropped)', () => {
  assert.ok(FRAME_ROLES.panel.includes('body .dftown-panel'));
  assert.ok(FRAME_ROLES.button.includes('body .dftown-panel .dftown-btn'));
  assert.ok(FRAME_ROLES.primary.includes('body .dftown-panel .dftown-btn.primary'));
  const kit = townPanelKitCss();
  assert.match(kit, /body \.dftown-panel \{/);
  assert.match(kit, /body \.dftown-panel \.dftown-btn\.primary \{ border-color:/);
  assert.doesNotMatch(kit, /\.lv-ok|\.bounty-shell/, 'cut to the panel\'s own selectors');
});

test('NOTICE-PANEL the host: shown in a settlement, taken down out of one and under anything that covers it; its lines read again once a second, at once in a new town; its fold kept; its town known while covered (mutants: shown under a window; read every frame; the count unsaid; the fold forgotten)', () => {
  const { doc } = page();
  let town = { mapId: 1291010263, px: 207, py: 213, name: 'Daggerfall', shown: 'Daggerfall' };
  let covered = false, now = 0, reads = 0;
  const host = createTownPanelHost({
    doc, town: () => town, covered: () => covered, now: () => now,
    panelLines: (id) => { reads++; return [`town ${id}`]; }, unseen: () => 2, bounty: () => true,
  });
  host.frame();
  const el = doc.body.all().find((n) => n.cls.has('dftown-panel'));
  assert.ok(el.cls.has('on'));
  assert.deepEqual(el.byClass('dftown-line').map((n) => n.textContent), ['town 1291010263']);
  assert.equal(one(el, 'dftown-new').textContent, '2 new');
  now = TOWN_PANEL_READ_MS - 1; host.frame();
  assert.equal(reads, 1, 'within the second: not read again');
  now = TOWN_PANEL_READ_MS; host.frame();
  assert.equal(reads, 2);
  town = { mapId: ALINOR_ID, px: ALINOR_AT.px, py: ALINOR_AT.py, name: 'Alinor', shown: 'Alinor' };   // past the Bay
  host.frame();
  assert.equal(reads, 3, 'a new town: at once');
  assert.equal(one(el, 'dftown-name').textContent, 'Alinor');
  one(el, 'dftown-head').fire('click');
  assert.equal(getPref('townPanelFolded'), true, 'folded to its name, and kept so');
  one(el, 'dftown-head').fire('click');
  assert.equal(getPref('townPanelFolded'), false);
  covered = true; host.frame();
  assert.ok(!el.cls.has('on'), 'covered: taken down');
  assert.equal(host.town()?.name, 'Alinor', 'but its town is known (the heartbeat reads it)');
  covered = false; town = null; host.frame();
  assert.ok(!el.cls.has('on'), 'out of the settlement: gone');
  assert.equal(host.town(), null);
  setPref('townPanelFolded', true);
  const again = page();
  createTownPanelHost({ doc: again.doc, town: () => null, covered: () => false }).frame();
  assert.ok(again.doc.body.all().find((n) => n.cls.has('dftown-panel'))?.cls.has('folded'), 'AUDIT FB1029g P8: a fold kept is a fold read back');
  setPref('townPanelFolded', false);
});

test('NOTICE-PANEL the Notice Board\'s press: online the town\'s Notice Board, the mill\'s sign pinned first and its heading row left to the window; offline, or not yet open, DFU\'s rumour box under the name as shown; the Bounty Board the bounty window by the town\'s pixel and MAPS name (mutants: the name row on the card; the box never shown)', () => {
  const { doc } = page();
  const town = { mapId: 1291010263, px: 207, py: 213, name: 'Daggerfall', shown: 'Chutedague' };
  const asked = [], boxes = [], hunts = [];
  let open = true;
  const host = createTownPanelHost({
    doc, town: () => town, covered: () => false, news: () => null,
    openNotice: (t, rumour) => { asked.push([t, rumour]); return open; },
    showBox: (w) => boxes.push(w), bounty: () => true, openBounty: (t) => { hunts.push(t); return true; },
  });
  host.frame();
  const el = doc.body.all().find((n) => n.cls.has('dftown-panel'));
  const [notice, bounty] = el.byClass('dftown-btn');
  notice.fire('click');
  assert.deepEqual(asked[0], [{ mapId: 1291010263, px: 207, py: 213, name: 'Daggerfall', bountyLine: true }, []], 'the name row is the window\'s heading, not a card');
  assert.equal(boxes.length, 0);
  open = false;
  notice.fire('click');
  assert.equal(boxes.length, 1, 'not open: DFU\'s box');
  assert.deepEqual(boxes[0].lines, ['Chutedague'], 'the town as the player\'s language shows it (PlayerActivate.cs:721)');
  bounty.fire('click');
  assert.deepEqual(hunts, [{ px: 207, py: 213, name: 'Daggerfall' }]);
});

const unheldCrown = { key: ALINOR_ID, name: 'Alinor', tier: 'crown', region: 66, pixel: [ALINOR_AT.px, ALINOR_AT.py], holder: null };
test('NOTICE-PANEL the lines: guild control first - a seat\'s own card, else the area\'s holder - then the economy, the prices and the reason; a region with no seat says nothing of control, and nor do seats not known (mutants: control left out; the area\'s line where no seat can hold it)', () => {
  const p = 62, prev = 60;
  const econ = [townEconomyLine(p, prev), townPriceLine(p)];
  const seat = townPanelLinesOf({ p, prev, seat: unheldCrown }, 0);
  assert.deepEqual(seat, [...seatTipOf(unheldCrown, 0).lines, ...econ], 'Alinor, past the Bay: its own Charter\'s lines, then its economy');
  const area = townPanelLinesOf({ p, prev, area: unheldCrown });
  assert.deepEqual(area, [townAreaLine(unheldCrown), ...econ], 'a town in a seat\'s bailiwick: the area\'s holder');
  assert.deepEqual(townPanelLinesOf({ p, prev, area: null }), econ, 'no seat in the region: nobody\'s to hold - left out');
  assert.deepEqual(townPanelLinesOf({ p, prev }), econ, 'the seats not known: left out');
  assert.deepEqual(townPanelLinesOf({ p, prev, area: null, raided: true }), [...econ, TOWN_REASONS.raid], 'the strongest reason last');
});

test('NOTICE-PANEL the reading: a town\'s lines online, by its map id, in the Bay and past it; none offline or for a place with no economy (mutants: read offline)', () => {
  const towns = new Map([[1291010263, { name: 'Daggerfall', px: 207, py: 213, region: 17, type: 0 }], [ALINOR_ID, { name: 'Alinor', px: ALINOR_AT.px, py: ALINOR_AT.py, region: 66, type: 0 }], [9, { name: 'A Farm', px: 1, py: 1, region: 17, type: 3 }]]);
  let online = true;
  const econ = createTownEcon({ online: () => online, townOf: (id) => towns.get(id), seatAt: (id) => (id === ALINOR_ID ? unheldCrown : null), seats: () => [unheldCrown], raidedAt: () => false, nowMs: () => 0 });
  const alinor = econ.panelLinesAt(ALINOR_ID);
  assert.deepEqual(alinor.slice(0, 1), seatTipOf(unheldCrown, 0).lines.slice(0, 1), 'Alinor: its Charter first');
  assert.match(alinor.at(-2), /^Economy: /);
  const dagger = econ.panelLinesAt(1291010263);
  assert.match(dagger[0], /^Economy: /, 'region 17 holds no seat in this list: no control line');
  assert.deepEqual(econ.panelLinesAt(9), [], 'no economy: the name alone');
  online = false;
  assert.deepEqual(econ.panelLinesAt(1291010263), [], 'offline: DFU\'s, no card');
});

test('NOTICE-PANEL the wiring: the settlement is the Stores\' own reach (a city, hamlet or village, its streets and buildings, never below), framed above the modal gate; the boards\' places kept for the siege field\'s Market alone; the panel movable and its fold kept (mutants: the places dropped from the field; the name unshown)', () => {
  const w = hostText('src/scenes/world.js');
  assert.match(w, /const settlementHere = \(\) => \(_storesReached\(\) \? panelTownOf\(_musicLoc, playerTravelPixel\(\), getLocalizedLocationName\) : null\);/);
  // AUDIT FB1029g P5, P8: the whole of what covers it - the classic skin's HUD toggle with it
  assert.match(w, /covered: \(\) => townTalk\.overlayActive \|\| townTalk\.hudCovered \|\| \(modes\?\.hudCovered \?\? false\) \|\| gamePaused\(\) \|\| !!townTalk\.hudHidden \|\| !hudRenderEnabled\(\) \|\| !!travelView\?\.active\n\s*\|\| !!travelOptions\?\.isTravelActive/);
  assert.match(w, /anchor: classicCompassAnchor,/, 'AUDIT FB1029g P6, P13: the classic compass\'s corner');
  assert.match(w, /questSyncTick\(\);\n\s*townPanel\.frame\(\);/, 'every mode: a town\'s buildings are the town');
  assert.match(w, /\|\| !!travelOptions\?\.isTravelActive \|\| !!arenaBouts\.bout\(\) \|\| !!csaAboard\.aboard \|\| !!csaRuntime\?\.state\?\.CurrentBoat,/, 'the journey bar, the versus bar and the helm stand under the compass');
  const b = hostText('src/scenes/pixelBuild.js');
  assert.match(b, /gates: pixelGates\.map\(\(g\) => \(\{ box: g\.entry\?\._box \}\)\), boards: pixelBoards, bounty: pixelBoardSplit, centre:/, 'the siege field\'s Market, the same on every machine');
  const at = (x) => ({ box: [x, 0, 0, x + 1, 2, 1] });
  const frames = new Map([[1, { at: [0, 0, 0], box: [-5, 0, -5, 5, 8, 5], door: { a: [-1, 0, 5], b: [1, 0, 5] } }]]);
  const field = siegeFieldOf({ frames, palaceKeys: [1], boards: [at(10), at(40)], bounty: new Set([0]), centre: [0, 0] });
  assert.deepEqual(field.banners[1], [40.5, 0.5], 'the Market stands at the rumour board\'s place, not the middle');
  assert.deepEqual(siegeFieldOf({ frames, palaceKeys: [1], centre: [0, 0] }).banners[1], [0, 0], 'with no place, the middle');
  const piece = HUD_PIECES.find((x) => x.id === 'town');
  assert.equal(piece?.sel, '.hud .dftown-panel');
  assert.equal(piece.dummy, true, 'a preview to move out of town');
  assert.match(src('src/ui/hud/hudLayout.js'), /\.hud \.dftown-panel\[data-hm-dummy\]:not\(\.on\) \{ display: flex !important;/);
  assert.equal(PREF_DEFAULTS.townPanelFolded, false);
});

test('AUDIT FB1029g P2, P7: the panel\'s town is a city, a hamlet or a village (never a farm, a manor, a lone tavern or a temple); a capital over several pixels is one town - its own id, name and centre, the slice a district line - past the Bay as in it (mutants: DFU\'s seven types; a capital\'s slice its own town)', () => {
  const at = { x: 207, y: 213 }, shownOf = (id, n) => `${n}*`;
  const town = (type) => panelTownOf({ name: 'P', mapTableData: { mapId: 99, locationType: type } }, at, shownOf);
  for (const t of Object.values(LOCATION_TYPES)) assert.equal(!!town(t), PANEL_TOWN_TYPES.has(t), `type ${t}`);
  assert.deepEqual([...PANEL_TOWN_TYPES].sort(), [LOCATION_TYPES.TownCity, LOCATION_TYPES.TownHamlet, LOCATION_TYPES.TownVillage]);
  assert.deepEqual(town(LOCATION_TYPES.TownCity), { mapId: 99, px: 207, py: 213, name: 'P', shown: 'P*' });
  assert.equal(panelTownOf({ name: 'P', mapTableData: { mapId: 99, locationType: 0 } }, null, shownOf), null, 'no pixel: none');
  const k = CAPITALS.findIndex((c) => c.key === 'alinor'), cap = CAPITALS[k], centre = capitalCentrePixel(k);
  assert.ok(centre && capitalDims(cap).h === 2, 'Alinor: a centre and its harbour below it');
  const slice = (s) => ({ name: capitalSliceName(cap, s), mapTableData: { mapId: capitalPlaceId(k, capitalSliceOrdinal(cap, s)), locationType: 0 }, capital: { key: cap.key, k, s } });
  const harbour = panelTownOf(slice(1), { x: centre.px, y: centre.py + 1 }, shownOf);
  assert.deepEqual(harbour, { mapId: capitalPlaceId(k, 0), px: centre.px, py: centre.py, name: 'Alinor', shown: 'Alinor*', district: 'Alinor Harbour*' });
  assert.deepEqual(panelTownOf(slice(0), { x: centre.px, y: centre.py }, shownOf), { mapId: capitalPlaceId(k, 0), px: centre.px, py: centre.py, name: 'Alinor', shown: 'Alinor*' }, 'the centre: no district');
});

test('AUDIT FB1029g P1: past the Bay the registry holds every capital\'s every slice as the build lays it, and finds a countryside place by its id unasked - so a harbour\'s and a village\'s panel say their control and prosperity (mutants: a capital\'s square read; the id never read back)', () => {
  const rows = pastBayPlaceRows({ pixels: null, templateOf: () => null, capitals: true });
  CAPITALS.forEach((cap, k) => {
    const want = capitalSpanPixels(k).map(({ x, y }) => `${x},${y}`).sort();
    const got = rows.filter((r) => (r.mapId >>> 0) === capitalPlaceId(k, 0) || (r.location != null && want.includes(`${r.px},${r.py}`))).map((r) => `${r.px},${r.py}`).sort();
    assert.deepEqual(got, want, `${cap.name}: every slice, on its own pixel`);
  });
  const k = CAPITALS.findIndex((c) => c.key === 'alinor'), cap = CAPITALS[k], centre = capitalCentrePixel(k);
  const harbourRow = rows.find((r) => r.mapId === capitalPlaceId(k, 1));
  assert.deepEqual(harbourRow && [harbourRow.name, harbourRow.px, harbourRow.py, harbourRow.w, harbourRow.h], ['Alinor Harbour', centre.px, centre.py + 1, 8, 8], 'its eight-by-eight slice below the centre');
  const places = createWorldPlaces();
  places.register('past-bay', rows);
  const vx = centre.px + 6, vy = centre.py - 4, vid = countryPlaceId(countryOrdinal(vx, vy));
  places.registerPixels('tesa-country', (x, y) => (x === vx && y === vy ? { mapId: vid, name: 'A Sumurset village', px: x, py: y, type: LOCATION_TYPES.TownVillage } : null), countryPixelOfId);
  assert.equal(places.byMapId(vid)?.name, 'A Sumurset village', 'found by its id before anything asked its pixel');
  assert.match(src('src/scenes/tamrielPlacesHost.js'), /worldPlaces\.registerPixels\(TESA_SOURCES\.country, countryRow, countryPixelOfId\);/, 'the host registers its countryside so');
  const seats = tamrielSeatsOf({ capitals: [{ key: capitalPlaceId(k, 0), name: cap.name, px: centre.px, py: centre.py, region: places.byMapId(capitalPlaceId(k, 0)).region }] }).map((x) => ({ ...x, holder: null }));
  const townOf = createTownTable(() => places);
  const econ = createTownEcon({ online: () => true, townOf: (id) => townOf.get(id), seatAt: (id) => seats.find((x) => x.key === id) ?? null, seats: () => seats, raidedAt: () => false, nowMs: () => Date.UTC(2026, 9, 29) });
  const village = econ.panelLinesAt(vid);
  assert.match(village[0] ?? '', /^Under the Crown Charter of Summerset/, 'the village\'s control - its area\'s holder');
  assert.match(village[1] ?? '', /^Economy: /, 'and its prosperity');
  // FOUNDATION F1: the harbour slice stands on the picture's sea and was in no province (region -1); now its capital's,
  // it names its control before its economy, as the village does
  const harbourLines = econ.panelLinesAt(capitalPlaceId(k, 1));
  assert.match(harbourLines[0] ?? '', /^Under the Crown Charter of Summerset/, 'the harbour slice\'s control - its province\'s');
  assert.match(harbourLines[1] ?? '', /^Economy: /, 'the harbour slice has its economy');
});

test('AUDIT FB1029g P6, P13: on the classic skin the panel stands on the compass the HUD last drew - the corner box over its Detect row, or the large bar\'s compass - in the page\'s pixels whatever the canvas\'s own (mutants: the box unrecorded; the canvas\'s pixels read as the page\'s)', () => {
  const canvas = (w, h, rect) => ({ width: w, height: h, getBoundingClientRect: () => rect });
  const page = { left: 0, top: 0, width: 1920, height: 1080, right: 1920, bottom: 1080 };
  assert.deepEqual(compassAnchorOf({ x: 1800, y: 900, w: 120, canvas: canvas(1920, 1080, page) }, 1920, 1080), { right: 0, bottom: 180 });
  assert.deepEqual(compassAnchorOf({ x: 3600, y: 1800, w: 240, canvas: canvas(3840, 2160, page) }, 1920, 1080), { right: 0, bottom: 180 }, 'a device-pixel canvas: its pixels halved to the page\'s');
  assert.deepEqual(compassAnchorOf({ x: 1700, y: 950, w: 100, canvas: canvas(1920, 1080, { ...page, left: 100, width: 1720, right: 1820 }) }, 1920, 1080).bottom, 130);
  assert.equal(compassAnchorOf(null, 1920, 1080), null, 'no classic compass drawn: none');
  const hud = src('src/ui/hud/hud.js');
  assert.match(hud, /const \{ bw, bh \} = drawCompassStrip\(renderer, art, bx, by, s, heading01\);\n\s*lastCompassBox = \{ x: bx, y: by - DETECT_MARKER_H \* s, w: bw, canvas \};/, 'the corner box, over its Detect row');
  assert.match(hud, /if \(bar\) lastCompassBox = \{ x: bar\.x \+ cb\[0\] \* bar\.s, y: bar\.y, w: cb\[2\] \* bar\.s, canvas \};/, 'the large bar\'s compass, over the bar');
  assert.match(hud, /lastCompassBox = null;   \/\/ NOTICE-PANEL: set again only where a classic compass is drawn below\n\s*const ui = uiCanvas\(canvas\);/, 'none where none is drawn');
});
