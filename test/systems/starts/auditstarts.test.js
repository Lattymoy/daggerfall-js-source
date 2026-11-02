// AUDIT STARTS (2026-10-25, bible/01-Overview/audits/Audit-Starts.md; the owner: "Audit this and ensure its perfect"):
// THE PINS OF THE STARTS' AUDIT - START1 to START3 read against the code that runs them, in five lanes (the quests, the
// world host, the voyages, the page and the map, the pins themselves), and every fix here held to the shape its
// producer mints: the held map's past-Bay picks (U1, U2, U4), the lens past the Bay (U5), the start page's press and
// both its faces (U3, U10, P3, P8), the chargen door's race and order (P4), the open zone online (W2), a birth's reload
// into its own dungeon (W3), a load before the story began (W5), the bridge's start (P2), the Questlines page (P7), the
// goto's glide (P9), the doorstep (P10), the quest layer's start seam (P11), the main quest's first look (Q2), and the
// sea lanes' corner, helm, wide box, landfall and no-ladder laws (P5, V4, V5, V6). Where ARENA2_PATH names the game's
// data, the freeware's own Tamriel: Daggerfall to every port past the Bay, every port's open water to Daggerfall, and
// the classic rows' widths in every language the page is drafted in.
import '../../modsOff.js';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { STARTS, START_QUESTS, HAND_START_QUEST, startByKey, startOfSiteId } from '../../../src/systems/starts/starts.js';
import { startLairSites, START_SITE_MIN } from '../../../src/systems/starts/startSite.js';
import { lairCellOf, lairSite } from '../../../src/world/tamrielDungeons.js';
import { LOCATION_TYPES, DUNGEON_TYPES, mapPixelToLongitudeLatitude } from '../../../src/formats/mapsFile.js';
import { createStartsHost, STARTS_TEXT } from '../../../src/scenes/startsHost.js';
import { createQuestBridge } from '../../../src/scenes/quest/questBridge.js';
import { createQuestWorld } from '../../../src/scenes/questWorld.js';
import { StartChoiceScreen, START_ROW_TOP, START_ROW_H, START_X0, startRowAt } from '../../../src/ui/startChoice.js';
import { drawStartChoiceFace, releaseStartChoiceFace, startChoiceFaceOwner, _setStartFaceClockForTests } from '../../../src/ui/enhanced/enhancedStartChoice.js';
import { _frameForTests, DRAW_FRAMES_UNDRAWN } from '../../../src/ui/drawWatchdog.js';
import { createChargenWindow } from '../../../src/systems/chargenSession.js';
import { ChargenFlow } from '../../../src/ui/chargen.js';
import { LevelingChoiceScreen } from '../../../src/ui/levelingChoice.js';
import { SKILLS } from '../../../src/systems/skills.js';
import { ORL_VENDOR } from '../../../src/systems/oblivionLeveling.js';
import { setModSetting } from '../../../src/systems/modSettings.js';
import { entryTarget, targetWords, WHERE_TEXT } from '../../../src/ui/quest/questLens.js';
import { canFindPlace } from '../../../src/ui/travel/travelMapWindow.js';
import { HeldMapWindow } from '../../../src/ui/heldMap.js';
import { tamrielInkFor } from '../../../src/ui/tamrielInk.js';
import { setCapitalsStanding } from '../../../src/world/tamrielCapitals.js';
import { buildWildMask } from '../../../src/systems/wild/wildZone.js';
import { CYRODIIL_THEATRE } from '../../../src/systems/wild/cyrodiilZone.js';
import { PROVINCE_OF_ID } from '../../../src/world/tamriel/tamrielLand.js';
import { createQuestlines } from '../../../src/systems/questlines/qlLayer.js';
import { QUESTLINES_PREF, readObjectives } from '../../../src/systems/questlines/qlLaw.js';
import { sheetFor } from '../../../src/systems/questlines/qlSheets.js';
import { setTutorialHandler, markTutorialSeen, forgetTutorialsSeen, _resetTutorialTriggerForTests } from '../../../src/systems/tutorials.js';
import { setPref, _resetForTests } from '../../../src/systems/uiPrefs.js';
import { planRoute, planSeaLanes, VOYAGE_LANDFALL_PX, LANE_MARGIN } from '../../../src/systems/travel/travelRoute.js';
import { FACTION_TYPES } from '../../../src/formats/factionFile.js';
import { BUILDING_TYPES } from '../../../src/world/buildingNames.js';
import { ROOT, packMachine, loadTables, questSource } from '../../qlSources.mjs';
import { town, dungeon, rmbBlock, worldOf, SPAWN, ITEM } from '../../fb1004dTowns.mjs';

const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const skin = (v) => { _resetForTests(); globalThis.location = { search: `?skin=${v}` }; };
afterEach(() => { _resetForTests(); delete globalThis.location; delete globalThis.document; });

/** Skyrim's start dungeon past the Bay (test/systems/starts/start3_pastbay_marks.test.js's), its row where TESA8 writes it. */
const LAIR_PX = { x: 1203, y: -88 };
const LAIR_MAP_ID = ((0x340 << 20) | 0x80000 | 12345) >>> 0;
const FLAT = (record, x, y, z) => ({ type: 3, position: record, xPos: x, yPos: y, zPos: z, resources: { flatResource: { textureArchive: 199, textureRecord: record } } });
const LAIR_BLOCK = { position: 0, rdbBlock: { objectRootList: [{ rdbObjects: [FLAT(ITEM, 800, -40, 1200), FLAT(SPAWN, 200, -40, 300)] }] } };

/** A province's start played on DFU's machine: its lair past the Bay, the city of Daggerfall, the wilds between. */
function played() {
  loadTables();
  const lair = dungeon({ name: 'The Haunt of Baringon', locationIndex: 99, mapId: LAIR_MAP_ID, dungeonType: 8, block: 'N0000099.RDB', regionIndex: 64, regionName: 'Skyrim' });
  const ll = mapPixelToLongitudeLatitude(LAIR_PX.x, LAIR_PX.y);
  lair.mapTableData = { ...lair.mapTableData, longitude: ll.x, latitude: ll.y };
  const city = town({ name: 'Daggerfall', locationIndex: 0, mapId: 1291010263, grid: ['CITY.RMB'] });
  city.exterior.exteriorData.locationId = 0xc36a;
  const inn = town({ name: 'Woodcroft Hall', locationIndex: 1, mapId: 5002, grid: ['INN.RMB'] });
  inn.exterior.buildings.push({ buildingType: BUILDING_TYPES.Tavern, factionId: 0, nameSeed: 100, quality: 10 });
  const farm = town({ name: 'Ashwick Farm', locationIndex: 2, mapId: 5003, grid: ['FARM.RMB'] });
  const hold = dungeon({ name: "Privateer's Hold", locationIndex: 3, mapId: 187853213, dungeonType: 0, block: 'S0000999.RDB' });
  hold.exterior.exteriorData.locationId = 0xc381;
  const locations = [city, inn, farm, hold];
  const blocks = new Map([['N0000099.RDB', LAIR_BLOCK], ['S0000999.RDB', LAIR_BLOCK], ['CITY.RMB', rmbBlock('CITY.RMB', [{ type: BUILDING_TYPES.Palace }])],
    ['INN.RMB', rmbBlock('INN.RMB', [{ type: BUILDING_TYPES.Tavern }])], ['FARM.RMB', rmbBlock('FARM.RMB', [{ type: BUILDING_TYPES.House1 }])]]);
  const base = worldOf({ locations, blocks });
  const where = { loc: lair, inside: { dungeon: true } };
  const world = {
    ...base,
    getFactionData: (id) => ({ ...base.getFactionData(id), type: FACTION_TYPES.Individual }),
    currentLocation: () => where.loc, playerInside: () => where.inside, isPlayerInLocationRect: () => !where.inside,
    currentLocationIndex: () => locations.indexOf(where.loc),
    discoverLocation: () => {}, mountCurrentSiteQuestResources: () => {},
    startSiteOfId: (id) => (startOfSiteId(id) ? lair : null),
  };
  const now = { s: 1e6 };
  const m = packMachine({ nowSeconds: () => now.s, skySeconds: () => 100 * 86400 + 12 * 3600, world, showPopup: () => {}, isPlayerInTown: () => !where.inside, giveItemToPlayer: () => {}, removeItemFromPlayer: () => {}, carriesQuestItem: () => true });
  const at = (p) => { where.loc = p === 'lair' ? lair : p === 'city' ? city : farm; where.inside = p === 'lair' ? { dungeon: true } : null; };
  const tick = (n = 1) => { for (let i = 0; i < n; i++) { now.s += 60; m.tick(); } };
  const quest = (name) => [...m.quests.values()].find((q) => q.questName === name && !q.questTombstoned) ?? null;
  return { m, at, tick, quest, lair };
}
/** The start host over `machine` (test/systems/starts/start2_provinces.test.js host()'s shape). */
const startsHost = (o = {}) => createStartsHost({
  params: new URLSearchParams(o.params ?? 'classic=1'), pastBay: true,
  quests: () => ({ startSiteOfId: () => null, respawnLatched: async () => {} }),
  teleport: async () => {}, landReady: Promise.resolve(), talk: { say: () => {} }, machine: () => o.machine ?? null,
});

// ── the held map past the Bay ────────────────────────────────────

/** Just enough document for the held map's chrome, its card's buttons readable, a canvas's pen a sink. */
globalThis.ImageData ??= class { constructor(d, w, h) { if (typeof d === 'number') { h = w; w = d; d = new Uint8ClampedArray(w * h * 4); } this.data = d; this.width = w; this.height = h ?? d.length / 4 / w; } };
const pen = () => new Proxy({}, {
  get: (t, k) => (k in t ? t[k] : k === 'createImageData' || k === 'getImageData' ? (w = 1, h = 1) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h })
    : k === 'measureText' ? () => ({ width: 1 }) : () => ({ addColorStop() {} })),
  set: (t, k, v) => { t[k] = v; return true; },
});
function fakeDocument() {
  const node = (tag) => {
    const n = {
      tag, children: [], style: {}, dataset: {}, classList: { toggle() {}, add() {}, remove() {} },
      append(...k) { n.children.push(...k); }, remove() { n.removed = true; },
      addEventListener() {}, removeEventListener() {}, setPointerCapture() {}, querySelectorAll: () => [],
      className: '', textContent: '', id: '', attrs: {}, setAttribute(k, v) { n.attrs[k] = v; },
      set innerHTML(v) { n.children = []; }, get innerHTML() { return ''; }, getContext: () => pen(), width: 0, height: 0,
    };
    return n;
  };
  return { createTextNode: (t) => ({ textContent: t, nodeType: 3 }), createElementNS: (_ns, t) => node(t), createElement: (t) => node(t), getElementById: () => null, head: node('head'), body: node('body'), addEventListener() {}, removeEventListener() {} };
}
const nodesOf = (n) => [n, ...(n?.children ?? []).flatMap(nodesOf)];
const buttonsOf = (win) => nodesOf(win._chrome.card).filter((n) => n.tag === 'button').map((n) => n.textContent);
function heldMap(deps = {}) {
  const win = new HeldMapWindow({
    getPlayerPixel: () => ({ x: 5, y: 5 }), getClimateIndex: () => 231, woods: { heightMapBuffer: new Uint8Array(100).fill(10) }, mapSize: { width: 10, height: 10 },
    gold: () => 1e6, goldPieces: () => 1e6, hasHorse: false, hasCart: false, hasShip: false, diseaseCount: () => 0, poisonCount: () => 0, ...deps,
  });
  for (let i = 0; i < 20; i++) win.tick(0.05);   // the sheet up: its card drawn while the phase is the map's
  win._tamriel = true;
  return win;
}

test('AUDIT STARTS U1/U2 the held map, PIN MOVED (TRAVEL-EVERYWHERE, TESA-NO-FAST retired): a quest\'s place past the Bay is travelled to as a Bay place is - Travel here on its card, its panel by every door; on the teleport map it is a portal\'s end, as a Bay place is, and bare land a portal\'s end on the stone\'s map alone - picked and named alone on the guild\'s, and no confirm sends the portal there (mutants: the card\'s button, the panel\'s gate, the confirm\'s gate, the portal test)', () => {
  skin('enhanced');
  globalThis.document = fakeDocument();
  setCapitalsStanding(true);
  try {
    // the travel map: picked, named, its journey offered
    // the world's one law of a place past the Bay (scenes/mapPlacesHost.js tvPlaceSummary): the lair known by the quest's naming
    const law = (px, py, named) => (named ? { locationType: LOCATION_TYPES.DungeonLabyrinth } : null);
    const quest = { px: LAIR_PX.x, py: LAIR_PX.y, placeName: 'The Haunt of Baringon' };
    let win = heldMap({ pastBayPlace: law });
    const lair = win._questPlace(quest);
    assert.deepEqual([lair.pastBay, lair.portal, lair.place], [true, true, true], 'a lair: a place');
    win._select(lair);
    assert.equal(win._selected?.name, 'The Haunt of Baringon');
    assert.deepEqual(buttonsOf(win), ['Travel here'], 'Travel here on its card');
    win._openPanel('travel');
    assert.equal(win._panel, 'travel', 'and its journey');
    win.dispose?.();
    // the teleport map: the lair a portal's end, bare land none on the guild's map
    const ported = [];
    win = heldMap({ onTeleport: (p) => ported.push(p), pastBayPlace: law });
    win.activateTeleportationTravel();
    win._select(win._questPlace(quest));
    assert.equal(win._panel, 'teleport', 'its confirm opens itself');
    win._confirmTeleport(true);
    for (let i = 0; i < 200 && !win.done; i++) win.tick(0.05);
    assert.deepEqual(ported.map((p) => p.pixel), [LAIR_PX], 'and the portal goes');
    win.dispose?.();
    ported.length = 0;
    win = heldMap({ onTeleport: (p) => ported.push(p), pastBayPlace: law });
    win.activateTeleportationTravel();
    const bare = win._pastBayPick(LAIR_PX.x, LAIR_PX.y, 'x');
    assert.equal(bare.portal, false, 'bare land: no portal\'s end on the guild\'s map');
    win._select(bare);
    assert.equal(win._panel ?? null, null, 'no confirm opens on it');
    assert.deepEqual(buttonsOf(win), [], 'and its card offers none');
    win._openPanel('teleport');
    win._confirmTeleport(true);
    for (let i = 0; i < 200 && !win.done; i++) win.tick(0.05);
    assert.deepEqual(ported, [], 'no portal sent there, whoever asks');
    win.dispose?.();
    // a city's pixel past the Bay is TESA2's portal end, as its own press picks it
    const city = tamrielInkFor(null).cities.find((c) => c.pixel);
    assert.ok(city, 'a capital the world stands');
    win = heldMap({ onTeleport: (p) => ported.push(p), pastBayPlace: () => ({ locationType: LOCATION_TYPES.TownCity }) });   // the world knows a city by its kind (OW-BEYOND-KNOWN)
    win.activateTeleportationTravel();
    const at = win._pastBayPick(city.pixel.x, city.pixel.y, city.name);
    assert.equal(at.portal, true, `${city.name}: a portal's end`);
    win._select(at);
    assert.equal(win._panel, 'teleport', 'its confirm opens itself');
    win._confirmTeleport(true);
    for (let i = 0; i < 200 && !win.done; i++) win.tick(0.05);
    assert.deepEqual(ported.map((p) => p.pixel), [city.pixel], 'and the portal goes');
    win.dispose?.();
  } finally { setCapitalsStanding(false); }
});

test('AUDIT STARTS U4 the zone map: its card is down, so a press on a quest\'s diamond inside the zone is the zone\'s own journey, as a hall\'s is (PVPJOURNEY) - outside the zone, or on the armed map, no panel (mutants: the zone\'s press, the zone\'s bound)', () => {
  skin('enhanced');
  globalThis.document = fakeDocument();
  const ZONE_PX = { x: 1600, y: 300 };   // a quest's place inside Cyrodiil, the open zone, past the Bay
  const mask = buildWildMask({ width: 50, height: 50, ox: 1500, oy: 200, cell: 4, inZone: () => true });
  for (const armed of [false, true]) {
    const win = heldMap({ wildMask: () => mask });
    if (armed) win.activateTeleportationTravel();
    win._zoneMap = true;
    win._onSheet = () => true;
    win._markerAt = () => null;
    let quest = { px: ZONE_PX.x, py: ZONE_PX.y, placeName: 'Fortress of Tibercles' };
    win._questAt = () => quest;
    win._pickAt(0, 0);
    assert.equal(win._selected?.name, 'Fortress of Tibercles', 'picked');
    assert.equal(win._panel ?? null, armed ? null : 'travel', armed ? 'the armed map: no portal into the zone' : 'the zone\'s journey, its legend\'s Begin');
    win._closePanel?.();
    win._selected = null;
    quest = { px: LAIR_PX.x, py: LAIR_PX.y, placeName: 'The Haunt of Baringon' };   // Skyrim's: past the Bay, outside the zone
    win._pickAt(0, 0);
    assert.equal(win._panel ?? null, null, 'outside the zone no journey');
    win.dispose?.();
  }
});

test('AUDIT STARTS P9 the journal\'s find of a place past the Bay glides the map to its pixel as it picks it (mutants: the glide dropped)', () => {
  skin('enhanced');
  globalThis.document = fakeDocument();
  const win = heldMap();
  const glides = [];
  win._focusOn = (x, y) => glides.push([x, y]);
  win.gotoPlace({ siteDetails: { regionIndex: 64, regionName: 'Skyrim', locationName: 'The Haunt of Baringon', worldPixel: LAIR_PX } });
  win._consumeGotoPlace();
  assert.deepEqual(glides, [[LAIR_PX.x + 0.5, LAIR_PX.y + 0.5]]);
  assert.equal(win._selected?.name, 'The Haunt of Baringon');
  win.dispose?.();
});

test('AUDIT STARTS U5 the lens past the Bay: standing in a start\'s dungeon is "(you are here)" whatever map the player keeps - the classic\'s, or the continent put away - and a site past the Bay off their map promises no directions the Bay\'s map never gives; a Bay site keeps AUDIT GUIDE W2\'s law (mutants: the past-Bay here, the note\'s words)', () => {
  const p = played();
  const q = p.m.startQuestByName(STARTS[1].quest);
  p.tick(2);
  const message = q.getMessage(1010);
  const lens = (onMap, current) => targetWords(entryTarget(message, { canFindPlace: () => onMap, currentLocationName: () => current }));
  for (const onMap of [true, false]) {
    const here = lens(onMap, 'The Haunt of Baringon');
    assert.equal(here.where, `The Haunt of Baringon in Skyrim province (${WHERE_TEXT.here})`, `the map ${onMap ? 'draws' : 'lacks'} it: here`);
    assert.equal(here.note, null, 'and nothing owed');
  }
  const away = lens(false, 'Daggerfall');
  assert.equal(away.note, WHERE_TEXT.offMapPastBay);
  assert.doesNotMatch(away.note, /yet|ask/i, 'no promise');
  // the Bay's start's Privateer's Hold: a place the map lacks is never here (W2)
  const ib = p.m.startQuestByName('_STARTIB');
  p.tick(2);
  const bay = targetWords(entryTarget(ib.getMessage(1010), { canFindPlace: () => false, currentLocationName: () => "Privateer's Hold" }));
  assert.deepEqual([bay.where.includes(WHERE_TEXT.here), bay.note], [false, WHERE_TEXT.offMap]);
  // the host's door: the site handed on, the continent's switch read
  skin('enhanced');
  setPref('tamrielMap', false);
  const off = targetWords(entryTarget(message, { canFindPlace: (r, n, site) => canFindPlace(null, null, r, n, () => null, site), currentLocationName: () => 'The Haunt of Baringon' }));
  assert.match(off.where, /\(you are here\)$/);
});

// ── the start page ───────────────────────────────────────────────

const STUB_FONT = { fnt: { glyphs: new Map(), ascent: 6, lineHeight: 8, fixedHeight: 8, fixedWidth: 6, glyphWidth: () => 5, glyphSpacing: 1 }, tex: 'T' };
/** The classic face drawn at 320x200: each glyph's native y. */
function classicDraw(screen) {
  const ys = [];
  screen.draw({ drawScreenQuad: (tex, dst) => { if (tex === 'T') ys.push(dst.y); } }, { width: 320, height: 200 }, STUB_FONT);
  return [...new Set(ys)].sort((a, b) => a - b);
}
/** A document for the Plus face (its rows' aria, disabled and classes readable). */
function faceDocument() {
  const byId = new Map();
  const node = (tag) => {
    const n = {
      tag, children: [], style: {}, dataset: {}, attrs: {}, className: '', textContent: '', id: '', disabled: false,
      classList: { _s: new Set(), toggle(c, on) { if (on) this._s.add(c); else this._s.delete(c); }, add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } },
      append(...k) { n.children.push(...k); for (const c of k) if (c.id) byId.set(c.id, c); }, remove() { n.removed = true; },
      setAttribute(k, v) { n.attrs[k] = v; }, getAttribute(k) { return n.attrs[k]; }, addEventListener() {},
    };
    return n;
  };
  return { createElement: (t) => node(t), getElementById: (id) => byId.get(id) ?? null, head: node('head'), body: node('body') };
}

test('AUDIT STARTS U3/U10 the classic face: drawn where its hit test reads it - each row on its band, the chosen start\'s story under them - and a press answers only for the start whose story it drew: a phone\'s tap (its hover and its press in one gesture) selects, a second answers; up wraps past the shut (P8), and neither key nor hover rests on a shut start (mutants: the press\'s story, the draw\'s rows, up as down, the hover\'s shut)', () => {
  const got = [];
  const s = new StartChoiceScreen((k) => got.push(k), { race: 'Nord', open: (st) => st.key !== 'Sumurset' });
  const ys = classicDraw(s);
  for (let i = 0; i < STARTS.length; i++) assert.ok(ys.includes(START_ROW_TOP + i * START_ROW_H), `row ${i + 1} on its band`);
  assert.equal(startRowAt(START_X0 + 4, START_ROW_TOP + 1 * START_ROW_H + 3), 1, 'the hit test the same table');
  assert.equal(s.options[s.cursor].id, 'Skyrim', 'the Nord\'s homeland first');
  // the tap: hover and press with no frame between - selected, its story drawn next, the next press answers
  const row = (i) => START_ROW_TOP + i * START_ROW_H + 2;
  s.hover(START_X0 + 4, row(3));
  assert.equal(s.click(START_X0 + 4, row(3)), false, 'no story of it drawn yet');
  assert.deepEqual([s.options[s.cursor].id, got], ['Imperial', []]);
  classicDraw(s);
  assert.equal(s.click(START_X0 + 4, row(3)), true);
  assert.deepEqual(got, ['Imperial']);
  // the keys: up from the top wraps to the last open start, past a shut one; a hover on a shut row moves nothing
  const k = new StartChoiceScreen(() => {}, { race: 'Breton', open: (st) => st.key !== 'Sumurset' });
  assert.equal(k.cursor, 0);
  k.input('ArrowUp');
  assert.equal(k.options[k.cursor].id, 'Valenwood', 'up: the last open start, Sumurset shut');
  k.input('ArrowDown');
  assert.equal(k.cursor, 0, 'down wraps back');
  k.hover(START_X0 + 4, row(7));
  assert.equal(k.cursor, 0, 'a hover on the shut row rests nowhere');
  k.hoverIndex(7);
  assert.equal(k.cursor, 0);
});

test('AUDIT STARTS U3/P3/U10 the Plus face (the default skin\'s): one row a start, its story beside it, a shut row disabled with why; a row answers its own start - once its story is up, a phone\'s tap selecting first - the face goes with the answer, a new page takes the face, and the watchdog takes it down when the draws stop (mutants: the row\'s own start, the face kept for a new page, the press\'s story)', () => {
  skin('enhanced');
  const doc = faceDocument();
  globalThis.document = doc;
  const fired = [];
  _setStartFaceClockForTests((fn) => { fired.push(fn); return fired.length; }, () => {});
  try {
    const got = [];
    const s = new StartChoiceScreen((key) => got.push(key), { race: 'Khajiit', open: (st) => st.key !== 'Imperial', why: (st) => (st.key === 'Imperial' ? 'the open zone online' : null) });
    s.draw(null, { width: 320, height: 200 }, null);
    const root = startChoiceFaceOwner() === s ? nodesOf(doc.body).find((n) => n.id === 'enhanced-start-choice') : null;
    assert.ok(root, 'the face up');
    const rows = nodesOf(root).filter((n) => n.className === 'stc-opt');
    assert.equal(rows.length, STARTS.length);
    assert.deepEqual(rows.map((r) => r.dataset.id), STARTS.map((st) => st.key));
    assert.equal(rows[s.cursor].attrs['aria-checked'], 'true', 'the cursor\'s row checked');
    assert.equal(s.options[s.cursor].id, 'Elsweyr', 'the Khajiit\'s homeland first');
    const story = nodesOf(root).find((n) => n.className.includes('stc-detail-body'));
    assert.equal(story.textContent, s.options[s.cursor].body, 'its story beside the list');
    const shut = rows[3];
    assert.equal(shut.disabled, true);
    assert.ok(nodesOf(shut).some((n) => n.textContent === 'the open zone online'), 'shut, with the host\'s why');
    // a tap on Skyrim's row: its pointer enters and presses in one gesture - selected, nothing answered
    rows[1].onpointerenter({ pointerType: 'touch' });
    rows[1].onclick();
    assert.deepEqual([s.options[s.cursor].id, got], ['Skyrim', []]);
    s.draw(null, { width: 320, height: 200 }, null);
    assert.equal(story.textContent, s.options[1].body, 'its story up');
    // the shut row answers nothing
    rows[3].onclick();
    rows[3].onclick();
    assert.deepEqual(got, []);
    // the second press: Skyrim's own start, and the face goes with the answer
    rows[1].onclick();
    assert.deepEqual(got, ['Skyrim']);
    assert.equal(startChoiceFaceOwner(), null);
    assert.equal(root.removed, true);
    // a new page takes the face from one still up; the watchdog takes it down when its draws stop
    const a = new StartChoiceScreen(() => {}), b = new StartChoiceScreen(() => {});
    a.draw(null, { width: 320, height: 200 }, null);
    const aRoot = nodesOf(doc.body).filter((n) => n.id === 'enhanced-start-choice').at(-1);
    drawStartChoiceFace(b, doc);
    assert.equal(startChoiceFaceOwner(), b, 'the new page\'s face');
    assert.equal(aRoot.removed, true, 'the old one gone');
    _frameForTests(DRAW_FRAMES_UNDRAWN);   // frames went by undrawn
    fired.at(-1)();
    assert.equal(startChoiceFaceOwner(), null, 'the draws stopped: the face down');
    releaseStartChoiceFace(b);
  } finally { _setStartFaceClockForTests(setTimeout, clearTimeout); }
});

/** A character made through the wizard to its summary (start2's madeTo), of RACE_TEMPLATES' `race`-th race. */
const career = {
  name: 'W', hitPointsPerLevel: 12, advancementMultiplier: 1.0, strength: 60, intelligence: 40, willpower: 45, agility: 55, endurance: 60, personality: 40, speed: 50, luck: 50,
  primarySkills: [SKILLS.LongBlade, SKILLS.Axe, SKILLS.CriticalStrike], majorSkills: [SKILLS.BluntWeapon, SKILLS.Dodging, SKILLS.Jumping],
  minorSkills: [SKILLS.ShortBlade, SKILLS.Archery, SKILLS.Running, SKILLS.Swimming, SKILLS.Climbing, SKILLS.Medical],
};
function madeTo(startChoice, race = 0) {
  let result = null;
  const w = createChargenWindow(new ChargenFlow([{ name: 'Warrior', career }], () => 0), { onDone: (r) => { result = r; }, startChoice });
  const key = (code, n = 1) => { for (let i = 0; i < n; i++) w.input(code); };
  key('ArrowDown', race);
  key('Enter'); key('KeyM'); key('Enter'); key('Enter');
  for (const c of 'KeyM KeyA KeyC'.split(' ')) w.input(c);
  key('Enter'); key('Enter');
  key('Equal', 6); key('Enter');
  key('Equal', 6); key('ArrowDown', 3);
  key('Equal', 6); key('ArrowDown', 3);
  key('Equal', 6); key('Enter');
  key('Enter'); key('Enter');
  return { w, result: () => result };
}

test('AUDIT STARTS P4 the chargen door hands the page the race the wizard made - a Nord\'s homeland, Skyrim, first and the answer of a page torn down - and asks it after the leveling question (mutants: the race unread, the page asked first)', () => {
  const nord = madeTo({ open: () => true }, 2);
  assert.ok(nord.w.levelingPrompt instanceof StartChoiceScreen, 'the page, the only question with the mod off');
  assert.equal(nord.w.levelingPrompt.options[nord.w.levelingPrompt.cursor].id, 'Skyrim', 'the Nord\'s homeland');
  nord.w.dispose();
  assert.equal(nord.result().startKey, 'Skyrim', 'torn down: the homeland\'s');
  setModSetting(ORL_VENDOR, 'Enabled', true);
  try {
    const both = madeTo({ open: () => true }, 2);
    assert.ok(both.w.levelingPrompt instanceof LevelingChoiceScreen, 'the leveling question first');
    both.w.input('Enter');
    for (let i = 0; i < 3 && !(both.w.levelingPrompt instanceof StartChoiceScreen); i++) both.w.input('Enter');
    assert.ok(both.w.levelingPrompt instanceof StartChoiceScreen, 'the page after it, last');
    both.w.input('Enter');
    assert.equal(both.result().startKey, 'Skyrim');
    assert.ok(both.result().levelingSystem);
  } finally { setModSetting(ORL_VENDOR, 'Enabled', false); }
});

// ── the start host ───────────────────────────────────────────────

test('AUDIT STARTS W2 online the Imperial Province is the open zone, its dungeons sealed: a character born online is not offered its start - shut on the page with why - and offline it stands (mutants: the zone\'s start offered online)', () => {
  const imperial = startByKey('Imperial');
  assert.equal(imperial.province, PROVINCE_OF_ID[CYRODIIL_THEATRE], 'the zone\'s province is the start\'s');
  const online = startsHost({ params: 'online=1&realmnew=1' }).page;
  assert.equal(online.open(imperial), false);
  assert.equal(online.why(imperial), STARTS_TEXT.openZone);
  for (const s of STARTS.filter((x) => x !== imperial)) assert.equal(online.open(s), true, `${s.key}: open online`);
  const offline = startsHost().page;
  assert.equal(offline.open(imperial), true, 'offline the province is no zone');
  assert.equal(offline.why(imperial), null);
  // the page reads the host's why
  const page = new StartChoiceScreen(() => {}, { race: 'Breton', open: online.open, why: online.why });
  const row = page.options.find((o) => o.id === 'Imperial');
  assert.deepEqual([row.locked, row.lockNote], [true, STARTS_TEXT.openZone]);
});

test('AUDIT STARTS W3 a load at a running province start\'s own dungeon, its commission still in it, resumes inside - through the quest\'s own entry - where ONLINE-UNDERGROUND-LOAD1 woke every other online load at the door; once the commission is found, or the start ended, or at another pixel, the law stands (mutants: the pixel, the commission found, the province\'s alone, both doors in world.js)', () => {
  const p = played();
  const h = startsHost({ machine: p.m });
  assert.equal(h.resumesAt(LAIR_PX), false, 'no start running');
  const q = p.m.startQuestByName(STARTS[1].quest);
  p.tick(2);
  assert.equal(h.resumesAt(LAIR_PX), true, 'its dungeon, the commission in it');
  assert.equal(h.resumesAt({ x: LAIR_PX.x + 1, y: LAIR_PX.y }), false, 'another pixel');
  assert.equal(h.resumesAt(null), false);
  q.getItem({ name: 'commission' }).setPlayerClicked();
  p.tick(1);
  assert.equal(h.resumesAt(LAIR_PX), false, 'the commission found: the dungeon is no start of theirs now');
  // the hand's is no province's dungeon, nor is any other quest's place at the pixel
  const b = played();
  b.m.startQuestByName(HAND_START_QUEST);
  b.tick(2);
  assert.equal(startsHost({ machine: b.m }).resumesAt(LAIR_PX), false);
  const other = { questName: 'M0B00Y06', getPlace: () => ({ siteDetails: { worldPixel: LAIR_PX } }), getTask: () => null };
  assert.equal(startsHost({ machine: { quests: new Map([[1, other]]) } }).resumesAt(LAIR_PX), false, 'a quest taken, not a start');
  // the world host asks it at both doors: the online wake, and the entry by the quest's own instance
  const W = rd('src/scenes/world.js');
  assert.match(W, /else if \(onlineOn && !\(pixel\.x === getInt\('Startup', 'StartCellX'\) && pixel\.y === getInt\('Startup', 'StartCellY'\)\) && !starts\.resumesAt\(pixel\)\) \{/);
  assert.match(W, /modes\?\.startInDungeon\?\.\(\{ locationKey: extras\.locationKey, fromLoad: true, recorded: starts\.resumesAt\(pixel\) \? undefined : extras\.dungeon \?\? \{\} \}\)/);
});

test('START-INSTANCE (FIELD BUGS 2026-10-30g) the door asks whether a dungeon is a running province start\'s own, its commission still in it - by its map id, as resumesAt asks by its pixel (mutants: the commission found still counted; any map id)', () => {
  const p = played();
  const h = startsHost({ machine: p.m });
  assert.equal(h.lairOpen(LAIR_MAP_ID), false, 'no start running');
  const q = p.m.startQuestByName(STARTS[1].quest);
  p.tick(2);
  assert.equal(h.lairOpen(LAIR_MAP_ID), true, 'its dungeon, the commission in it');
  assert.equal(h.lairOpen(LAIR_MAP_ID - 2 ** 32), true, 'the map id read unsigned (AUDIT S4: its signed spelling)');
  assert.equal(h.lairOpen(LAIR_MAP_ID + 1), false, 'another dungeon');
  assert.equal(h.lairOpen(undefined), false);
  q.getItem({ name: 'commission' }).setPlayerClicked();
  p.tick(1);
  assert.equal(h.lairOpen(LAIR_MAP_ID), false, 'the commission found');
  assert.match(rd('src/scenes/world.js'), /\n {4}startLair: \(mapId\) => starts\.lairOpen\(mapId\),/, 'the world host hands it to the door');
});

test('AUDIT STARTS W5 a save from before the story began - no start, no curse, no main quest - loads with the commission handed over and the curse beside it; a story begun, a start running, or a save from before the story was kept is left alone; both load doors ask (mutants: the healing, the begun story\'s check)', () => {
  const machine = (o = {}) => ({ storyLegacy: false, storyStarted: new Set(), quests: new Map(), begun: [], startQuestByName(n) { this.begun.push(n); }, ...o });
  let m = machine();
  assert.equal(startsHost({ machine: m }).restored(), true);
  assert.deepEqual(m.begun, ['S0000977', HAND_START_QUEST], 'the commission in hand, the curse beside it');
  for (const o of [{ storyStarted: new Set(['S0000977']) }, { storyLegacy: true }, { quests: new Map([[1, { questName: '_STARTSK' }]]) }, { quests: new Map([[1, { questName: '_BRISIEN' }]]) }]) {
    m = machine(o);
    assert.equal(startsHost({ machine: m }).restored(), true);
    assert.deepEqual(m.begun, [], `left alone: ${JSON.stringify(Object.keys(o))}`);
  }
  assert.equal(startsHost().restored(), true, 'no machine: nothing to heal');
  const W = rd('src/scenes/world.js');
  assert.equal([...W.matchAll(/_questStarted = starts\.restored\(\);/g)].length, 2, 'the two load doors');
});

test('AUDIT STARTS Q5 the machine counts its restores - what a start on its way reads to know a load landed under it, and drops itself (mutants: the count)', () => {
  const p = played();
  p.m.startQuestByName(STARTS[1].quest);
  p.tick(2);
  const before = p.m.restores ?? 0;
  p.m.restoreSaveData(structuredClone(p.m.getSaveData()));
  assert.equal(p.m.restores, before + 1);
});

test('AUDIT STARTS U6/U7 the drafted words: French says a ship\'s own name bare, as its passage family does ("The Gilded Cog", "Le navire" carry their own article); Bulgarian keeps Daggerfall, the Iliac Bay and Sentinel in Latin, as its catalog and the quests do', () => {
  const csv = (lang) => { const out = new Map(); for (const line of rd(`locales/${lang}/Port_Strings.csv`).split(/\r?\n/)) { const m = /^([^,]+),"((?:[^"]|"")*)"$/.exec(line); if (m) out.set(m[1], m[2].replace(/""/g, '"')); } return out; };
  const fr = csv('fr');
  for (const k of ['passage.booked', 'passage.bookedWrit']) assert.doesNotMatch(fr.get(k), /\b(Le|La|Les) \{ship\}/, k);
  const bg = csv('bg');
  for (const [k, v] of bg) if (k.startsWith('start.')) assert.doesNotMatch(v, /Даггерфол|Илиак|Сентинел/, k);
  assert.match(bg.get('start.IliacBay.title'), /^Iliac Bay$/);
});

test('AUDIT STARTS W8 the boot\'s ?start= is a dev door of its boot alone: an online page, a birth\'s and a load\'s address drop it, and so does every front door\'s choice (mutants: a door keeping it)', () => {
  assert.match(rd('src/systems/online/onlineLane.js'), /export const BOOT_DOOR_KEYS = Object\.freeze\(\[\n\s*'load',\n\s*'online',\n\s*'loadkey',\n\s*'test',\n\s*'classic',\n\s*'classicload',\n\s*'realm',\n\s*'realmnew',\n\s*'legacyborn',\n\s*'region',\n\s*'loc',\n\s*'seat',\n\s*'start',\n\s*\]\);/);
  const P = rd('src/systems/legacy/places.js');
  assert.equal([...P.matchAll(/for \(const k of \[[^\]]*'start'\]\) p\.delete\(k\);/g)].length, 2, 'a birth\'s address and a load\'s');
  assert.equal([...rd('src/main.js').matchAll(/params\.delete\('start'\);/g)].length, 2, 'and both front doors\' choices (MAC-N3: BOOT_DOOR_KEYS is what main.js decides)');
});

test('AUDIT STARTS P2 the bridge starts the start it is handed: the commission in hand\'s with the curse, and a name no start has is the Bay\'s (mutants: the start unpassed)', () => {
  loadTables();
  const started = [];
  const bridge = createQuestBridge({
    data: { readListTable: () => '', getQuestSourceLines: (n) => questSource(n) },
    world: null, classicSeconds: () => 0, playerEntity: { level: 1, name: 'Tester' },
    onQuestStarted: (q) => started.push(q.questName),
  });
  bridge.initAtGameStart(HAND_START_QUEST);
  assert.deepEqual(started, ['S0000977', HAND_START_QUEST]);
});

test('AUDIT STARTS P7 no start\'s quest pops the Tutorials\' Questlines page - every one of START_QUESTS is a quest a new character is started on, never one taken (mutants: the Bay\'s alone skipped)', () => {
  setPref(QUESTLINES_PREF, true);
  forgetTutorialsSeen();
  _resetTutorialTriggerForTests();
  const popped = [];
  setTutorialHandler((id) => { popped.push(id); markTutorialSeen(id); return true; });
  try {
    const layer = createQuestlines({ machine: { quests: new Map() } });
    for (const questName of START_QUESTS) {
      assert.ok(sheetFor(questName), `${questName} has a sheet`);
      layer.stamp({ questName });
    }
    assert.deepEqual(popped, []);
    layer.stamp({ questName: 'M0B00Y06' });
    assert.deepEqual(popped, ['questlines'], 'the first quest taken');
  } finally { setTutorialHandler(null); _resetForTests(); }
});

test('AUDIT STARTS Q2 the main quest\'s opener, begun in Daggerfall\'s streets by a start\'s commission, reads nothing done at its first look - no objective the start had already met, no news for the herald (mutants: the cave\'s escape back)', () => {
  const p = played();
  const q = p.m.startQuestByName(STARTS[1].quest);
  p.tick(2);
  const item = q.getItem({ name: 'commission' });
  item.setPlayerClicked();
  p.tick(1);
  item.useClicked = true;
  p.tick(1);
  p.at('wilds');
  p.tick(2);
  p.at('city');
  p.tick(5);
  const br = p.quest('_BRISIEN');
  assert.ok(br, 'the opener begun in Daggerfall');
  const states = readObjectives(br, sheetFor('_BRISIEN')).map((o) => o.state);
  assert.ok(!states.includes('done'), `nothing done at its first look (${states.join(', ')})`);
});

test('AUDIT STARTS P10 a lair on the capital\'s doorstep - two pixels off its centre - is never a start\'s; one three off is (mutants: the doorstep)', () => {
  const site = lairSite(lairCellOf(4000, 300));
  const centre = { px: site.px + 2, py: site.py };
  const world = {
    centre,
    rollAt: () => ({ type: LOCATION_TYPES.DungeonLabyrinth, dungeonType: DUNGEON_TYPES.Crypt }),
    free: () => true, provinceAt: () => 'Skyrim',
  };
  const out = startLairSites({ province: 'Skyrim', lair: [['DungeonLabyrinth', 'Crypt']] }, world);
  assert.equal(START_SITE_MIN, 3);
  assert.ok(out.length > 0);
  assert.ok(!out.some((s) => s.px === site.px && s.py === site.py), 'the doorstep\'s lair left out');
  assert.ok(Math.hypot(out[0].px - centre.px, out[0].py - centre.py) >= 3, 'the nearest taken past it');
});

test('AUDIT STARTS P11/W5 the quest layer\'s start seam: a start\'s site id names its lair as the quest layer sizes it, the first with a quest item\'s marker; another id none; and the move into it is latched - no load, save or Recall while it builds (mutants: a non-start id answered, the latch)', async () => {
  const lair = { name: 'The Haunt', mapTableData: { longitude: 0, latitude: 0 }, hasDungeon: false };
  const asked = [];
  let latchedDuring = null;
  const host = {
    params: new URLSearchParams(), maps: { getLocation: () => null }, blocks: { getBlockByName: () => null },
    provinceQuestPlaces: { startLairAt: (start, usable) => { asked.push([start.key, typeof usable]); return lair; } },   // PIN MOVED (AUDIT RELEASE R2-5, hostseam): the start lair rides the places past the Bay
    _respawnAtSite: async () => { latchedDuring = host._respawning; },
  };
  const { questWorld: qw } = createQuestWorld(host);
  assert.equal(qw.startSiteOfId(0x5a7000 + 1), lair, 'Skyrim\'s');
  assert.deepEqual(asked, [['Skyrim', 'function']], 'asked with the quest layer\'s own weighing');
  assert.equal(qw.startSiteOfId(12345), null, 'no start\'s id');
  assert.equal(asked.length, 1, 'and the host never asked for it');
  await qw.respawnLatched(lair);
  assert.equal(latchedDuring, true, 'latched while the dungeon builds');
  assert.equal(host._respawning, false, 'and let go');
  const refusing = { ...host, _respawnAtSite: async () => { throw new Error('refused'); } };
  await assert.rejects(createQuestWorld(refusing).questWorld.respawnLatched(lair));
  assert.equal(refusing._respawning, false, 'let go when the move fails too');
});

// ── the sea lanes ────────────────────────────────────────────────

const VOYAGE = { start: 'sea', goal: 'land', voyage: true, again: false };
/** PIN MOVED (PLAN-SLICES): the most cells a voyage's plan spends (its floods, its lanes and its landfall - travelRoute.js `tally`). */
const VOYAGE_CELLS_MAX = 450000;   // measured 392,822 and 393,363 (the two floods and the lanes): some twenty frames at PLAN_FRAME_CELLS
/** A ladder that says it was climbed. */
const ladder = (rungs = [6, 20, 60]) => { const seen = { climbed: false }; return { seen, margins: { [Symbol.iterator]: () => { seen.climbed = true; return rungs[Symbol.iterator](); } } }; };
/** The 8-connected pixels a -> b (Bresenham), a first. */
const lineOf = (a, b) => {
  const out = [a]; let { x, y } = a;
  const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y), sx = a.x < b.x ? 1 : -1, sy = a.y < b.y ? 1 : -1;
  let err = dx - dy;
  while (x !== b.x || y !== b.y) { const e2 = 2 * err; if (e2 > -dy) { err -= dy; x += sx; } if (e2 < dx) { err += dx; y += sy; } out.push({ x, y }); }
  return out;
};
// PIN MOVED (SEA-TAUT, Field-Bugs-2026-10-29g): a sailed step is a straight run over open water now - each pixel of its
// line a boat's step - and every other step one pixel
const stepsSailed = (plan, isWater) => {
  for (let i = 1; i < plan.pixels.length; i++) {
    const a = plan.pixels[i - 1], b = plan.pixels[i];
    if (plan.kinds[i - 1] !== 'sea') { assert.equal(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)), 1, 'one pixel a step'); continue; }
    const line = lineOf(a, b);
    for (let k = 1; k < line.length; k++) {
      const p = line[k - 1], q = line[k];
      assert.ok(isWater(q.x, q.y), 'sailed on water');
      assert.ok(p.x === q.x || p.y === q.y || isWater(q.x, p.y) || isWater(p.x, q.y), `never through a corner of the land (${p.x},${p.y} -> ${q.x},${q.y})`);
    }
  }
};

test('AUDIT STARTS P5 the lanes never sail through a corner of the land: a wall whose two halves meet at a corner, the way past it round its far end (mutants: the corner\'s step)', () => {
  // the wall at x 600 north of y 0 and x 601 south of it: its halves touch at a corner, the only gap a boat cannot take
  const land = (x, y) => (y >= -250 && y < 0 && x === 600) || (y >= 0 && y <= 2000 && x === 601);
  const isle = (x, y) => Math.abs(x - 200) <= 1 && Math.abs(y - 200) <= 1;
  const isWater = (x, y) => !land(x, y) && !isle(x, y);
  const plan = planRoute({ x: 1500, y: 10 }, { x: 200, y: 200 }, { isWater, sea: VOYAGE });
  assert.ok(plan);
  stepsSailed(plan, isWater);
  assert.ok(Math.min(...plan.pixels.map((p) => p.y)) < -250, 'round the wall\'s north end');
});

test('AUDIT STARTS V6 any helm\'s crossing with an end past the table sails the lanes first - not only a booked voyage\'s - and one ashore never; V4 a booked voyage the lanes cannot sail is no voyage, said at once without the box\'s ladder, where a boat of my own still climbs it (mutants: the voyage\'s alone, the ladder after a voyage)', () => {
  const isle = (x, y) => Math.abs(x - 200) <= 1 && Math.abs(y - 200) <= 1;
  const isWater = (x, y) => !isle(x, y);
  const from = { x: 1100, y: 203 }, to = { x: 200, y: 200 }, mine = { start: 'sea', goal: 'land', again: false };
  const lanes = planSeaLanes(from, to, { isWater, sea: mine });
  assert.ok(lanes);
  const l1 = ladder();
  assert.deepEqual(planRoute(from, to, { isWater, sea: mine, margins: l1.margins }).pixels, lanes.pixels, 'my own boat\'s crossing: the lanes\' route');
  assert.equal(l1.seen.climbed, false, 'no box asked');
  const l2 = ladder();
  const ashore = planRoute(from, to, { isWater, sea: { start: 'land', goal: 'land' }, margins: l2.margins });
  assert.equal(l2.seen.climbed, true, 'ashore with a boat to hand: the box');
  assert.ok(ashore);
  // no way by the lanes: a port walled in on every side
  const pen = (x, y) => Math.max(Math.abs(x - 200), Math.abs(y - 200)) === 20;
  const shut = (x, y) => !isle(x, y) && !pen(x, y);
  const v = ladder();
  assert.equal(planRoute(from, to, { isWater: shut, sea: VOYAGE, margins: v.margins }), null);
  assert.equal(v.seen.climbed, false, 'a voyage: no ladder after the lanes said none');
  const b = ladder([6]);
  planRoute(from, to, { isWater: shut, sea: mine, margins: b.margins });
  assert.equal(b.seen.climbed, true, 'my own boat: the box still asked');
});

test('AUDIT STARTS V5 a lane the first box holds none of is asked once more over a wider one - round a wall whose end lies past LANE_MARGIN (mutants: the wide box)', () => {
  const end = -100 - LANE_MARGIN - 200;   // past the first box's reach north of the two ends
  const wall = (x, y) => x >= 600 && x <= 640 && y >= end && y <= 3000;
  const isle = (x, y) => Math.abs(x - 200) <= 1 && Math.abs(y - 200) <= 1;
  const isWater = (x, y) => !wall(x, y) && !isle(x, y);
  const from = { x: 1500, y: -100 }, to = { x: 200, y: 200 };
  assert.equal(planSeaLanes(from, to, { isWater, sea: VOYAGE }), null, 'the first box: none');
  const plan = planRoute(from, to, { isWater, sea: VOYAGE });
  assert.ok(plan, 'the wider one');
  assert.ok(Math.min(...plan.pixels.map((p) => p.y)) < end, 'round the wall\'s far end');
  stepsSailed(plan, isWater);
});

test('AUDIT STARTS V4 ashore at a port the coast stands on water: every neighbour water too, so no landfall onto it - the voyage lands on the nearest dry ground within VOYAGE_LANDFALL_PX; and the landfall\'s box reaches past an end beyond the table, round water the boat cannot sail (mutants: the dry ground\'s goal, the end\'s pad)', () => {
  // a port two pixels off its isle's shore, on open water
  const isle = (x, y) => x >= 1199 && x <= 1205 && y >= -91 && y <= -85;
  const isWater = (x, y) => !isle(x, y);
  const to = { x: 1196, y: -88 };
  const plan = planRoute({ x: 1500, y: -88 }, to, { isWater, sea: VOYAGE });
  assert.ok(plan, 'a voyage');
  const fall = plan.kinds.indexOf('landfall');
  const ashore = plan.pixels[fall + 1] ?? plan.pixels.at(-1);
  assert.ok(fall > 0 && !isWater(ashore.x, ashore.y), 'ashore on dry ground');
  assert.ok(Math.max(Math.abs(ashore.x - to.x), Math.abs(ashore.y - to.y)) <= VOYAGE_LANDFALL_PX, 'within reach of the port');
  assert.ok(!isWater(plan.pixels.at(-1).x, plan.pixels.at(-1).y), 'and it ends ashore');
  stepsSailed(plan, isWater);
  // a port on land west of an inland lake that runs south from a row north of the sea's nearest water to it: the walk
  // round the lake's north end lies north of both the landfall's ends
  const lake = (x, y) => x === 1102 && y >= -53;
  const water = (x, y) => x >= 1104 || lake(x, y);
  const home = { x: 1101, y: -50 };
  const round = planRoute({ x: 1500, y: -50 }, home, { isWater: water, sea: VOYAGE });
  assert.ok(round, 'a voyage to it');
  assert.deepEqual(round.pixels.at(-1), home, 'ashore at the port itself');
  assert.ok(Math.min(...round.pixels.map((p) => p.y)) < -53, 'round the lake\'s north end');
});

// ── the game's own Tamriel ───────────────────────────────────────

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['MAPS.BSA', 'WOODS.WLD', 'TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL', 'FONT0003.FNT'].every((f) => existsSync(join(ARENA2, f)));
const skipReal = HAVE ? false : 'ARENA2_PATH not set or missing - real-data validation skipped';

/** The freeware's Tamriel's sea as the world host reads it: the trace at its fit, the ground past the Bay. */
async function realSea() {
  const { DFPalette } = await import('../../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../../src/ui/tamrielTrace.js');
  const { setTamrielTrace } = await import('../../../src/world/tamriel/tamrielLand.js');
  const { setTamrielFit } = await import('../../../src/world/tamriel/tamrielFrame.js');
  const { WoodsFile } = await import('../../../src/formats/woodsFile.js');
  const { groundWoods, groundClimateIndex } = await import('../../../src/world/tamriel/tamrielGround.js');
  const { routeGround } = await import('../../../src/systems/travel/travelRoute.js');
  const { WATER_BYTE } = await import('../../../src/world/roadsProducer.js');
  const { longitudeLatitudeToMapPixel } = await import('../../../src/formats/mapsFile.js');
  const { loadMaps } = await import('../../arena1Data.mjs');
  const fb = async (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const pal = new DFPalette(); pal.load(await fb('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: fb, palette: pal }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  const maps = loadMaps();
  maps.getClimateIndex = groundClimateIndex(maps.getClimateIndex.bind(maps));
  const w = new WoodsFile(); w.load(await fb('WOODS.WLD'));
  const woods = groundWoods(w);
  const rg = routeGround(maps.getClimateIndex, (x, y) => w.getHeightMapValue(x, y), WATER_BYTE, 1000, 500, (x, y) => woods.getHeightMapValue(x, y) > WATER_BYTE);
  const df = maps.getLocationByName('Daggerfall', 'Daggerfall');
  const dp = longitudeLatitudeToMapPixel(df.mapTableData.longitude, df.mapTableData.latitude);
  return { rg, dp, reset: () => { setTamrielTrace(null); setTamrielFit(null); } };
}
/** The nearest open water to `p` within 3 pixels, ring by ring: water whose sailed reach holds more than a pond's
 *  sixteen pixels (a ship never berths in a puddle of the trace's coast). */
function openWaterNear(p, isWater) {
  const open = (f) => {
    const seen = new Set([`${f.x},${f.y}`]), q = [f];
    while (q.length && seen.size <= 16) {
      const a = q.shift();
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const b = { x: a.x + dx, y: a.y + dy }, k = `${b.x},${b.y}`;
        if (!seen.has(k) && isWater(b.x, b.y) && (dx === 0 || dy === 0 || isWater(b.x, a.y) || isWater(a.x, b.y))) { seen.add(k); q.push(b); }
      }
    }
    return seen.size > 16;
  };
  for (let r = 0; r <= 3; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const f = { x: p.x + dx, y: p.y + dy };
    if (Math.max(Math.abs(dx), Math.abs(dy)) === r && isWater(f.x, f.y) && open(f)) return f;
  }
  return null;
}

test('AUDIT STARTS V4/V7 on the freeware\'s Tamriel: from the nearest open water to each of the 35 ports past the Bay a voyage reaches Daggerfall, and from Daggerfall\'s each of them - ashore once, within reach of the port (on it, but where the coast stands it on water), each planned in under a second and a half (mutants: the landfall\'s goals, its pad)', { skip: skipReal }, async () => {
  const t = await realSea();
  const { arenaPixels, setArenaStanding } = await import('../../../src/world/arenaPlaces.js');
  setArenaStanding(true);
  try {
    const ports = arenaPixels().stood.filter((p) => p.port);
    assert.equal(ports.length, 35);   // PIN MOVED (FIELD BUGS 2026-10-28b COAST-PORT): 28, and the seven places the sea bears on
    const home = openWaterNear(t.dp, t.rg.isWater);
    assert.ok(home, 'Daggerfall\'s harbor');
    let most = 0;   // PIN MOVED (PLAN-SLICES): a plan's cells, an op count - the journey's plan is made a slice of PLAN_FRAME_CELLS a frame, and a clock on a shared runner is a flake
    const timed = (f, to) => { const tally = { n: 0 }; const plan = planRoute(f, to, { ...t.rg, sea: VOYAGE, tally }); most = Math.max(most, tally.n); return plan; };
    const ashoreOnce = (plan, name) => {
      const fall = plan.kinds.indexOf('landfall');
      assert.ok(fall > 0 && plan.kinds.slice(0, fall).every((k) => k === 'sea') && !plan.kinds.slice(fall + 1).some((k) => k === 'sea' || k === 'landfall'), `${name}: sailed, then ashore once`);
    };
    for (const p of ports) {
      const port = { x: p.bx, y: p.by };
      const berth = openWaterNear(port, t.rg.isWater);
      assert.ok(berth, `${p.name}: open water by it`);
      const out = timed(berth, t.dp);
      assert.ok(out, `${p.province} ${p.name}: a voyage to Daggerfall`);
      assert.deepEqual(out.pixels.at(-1), t.dp);
      ashoreOnce(out, p.name);
      const back = timed(home, port);
      assert.ok(back, `Daggerfall: a voyage to ${p.province} ${p.name}`);
      ashoreOnce(back, p.name);
      const end = back.pixels.at(-1);
      const onIt = end.x === port.x && end.y === port.y;
      const beside = t.rg.isWater(port.x, port.y) && !t.rg.isWater(end.x, end.y) && Math.max(Math.abs(end.x - port.x), Math.abs(end.y - port.y)) <= VOYAGE_LANDFALL_PX;
      assert.ok(onIt || beside, `${p.name}: ashore at it (${end.x},${end.y} for ${port.x},${port.y})`);
    }
    assert.ok(most <= VOYAGE_CELLS_MAX, `the largest plan ${most} cells`);
  } finally { setArenaStanding(false); t.reset(); }
});

test('AUDIT STARTS U8/W2 on the freeware: in FONT0003 the passage list\'s writ row stays inside the picker\'s art for every wind in every language the classic face draws it in, and online the Imperial Province\'s shut row fits the page\'s list (mutants: the row\'s words)', { skip: skipReal }, async () => {
  const { FntFile } = await import('../../../src/formats/fntFile.js');
  const { measureText } = await import('../../../src/ui/text.js');
  const { START_X1 } = await import('../../../src/ui/startChoice.js');
  const fnt = new FntFile(); fnt.load(new Uint8Array(readFileSync(join(ARENA2, 'FONT0003.FNT'))));
  const csv = (lang) => { const out = new Map(); for (const line of rd(`locales/${lang}/Port_Strings.csv`).split(/\r?\n/)) { const m = /^([^,]+),"((?:[^"]|"")*)"$/.exec(line); if (m) out.set(m[1], m[2].replace(/""/g, '"')); } return out; };
  const WINDS = ['north', 'northEast', 'east', 'southEast', 'south', 'southWest', 'west', 'northWest'];
  for (const lang of ['en', 'cs', 'da', 'de', 'es', 'fr', 'id', 'it', 'nb', 'pt-BR', 'ro']) {
    const r = csv(lang);
    for (const w of WINDS) {
      const row = r.get('passage.rowWrit').replace('{port}', 'Daggerfall').replace('{wind}', r.get(`passage.wind.${w}`));
      assert.ok(measureText(fnt, row) <= 174, `${lang} ${w}: "${row}" ${measureText(fnt, row)} px of the list's 174 inside the art (ui/listPicker.js: x 26 of 200)`);
    }
    const shut = `> 4. ${r.get('start.Imperial.title')} - ${r.get('start.openZone')}`;
    assert.ok(START_X0 + measureText(fnt, shut) <= START_X1, `${lang}: "${shut}"`);
  }
});
