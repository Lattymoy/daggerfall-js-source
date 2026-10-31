// START2 (2026-10-24, bible/06-Systems/Alternate-Starts-Arc.md sections 7-10; the owner: "Each new region will each have
// their own unique starting quest/dungeon within that region"): THE PROVINCES' STARTS - the start-choice page the
// character's making ends with, a province's start dungeon past the Bay (the nearest of the kinds its story wants near
// its capital, a quest item's marker in it), its quest played on DFU's machine to the Daggerfall gate, the commission in
// hand for a character born at no start, the world's start host, the writ of passage a ship's master honors, and the sea
// lanes a voyage past the Bay sails. The contract every start keeps is START1's test's, run for every name in
// START_QUESTS. Where ARENA2_PATH names the game's data, the freeware's own Tamriel: each province's dungeon as the host
// picks it, and a voyage to Daggerfall from each province's capital's waters.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  STARTS, BAY_START, START_QUESTS, HAND_START_QUEST, BAY_START_QUEST, START_SITE_ID_BASE, startSiteId, startOfSiteId, startByKey,
  homelandStart, isStartQuestName, MAIN_QUEST_OPENER,
} from '../../../src/systems/starts/starts.js';
import { START_PLACE_ROWS } from '../../../src/systems/starts/startPlaces.js';
import { startLairSites, wantMatches, START_SITE_MIN, START_SITE_REACH } from '../../../src/systems/starts/startSite.js';
import { lairCellOf, lairSite } from '../../../src/world/tamrielDungeons.js';
import { CAPITALS } from '../../../src/world/tamrielCapitals.js';
import { LOCATION_TYPES, DUNGEON_TYPES, REGION_NAMES } from '../../../src/formats/mapsFile.js';
import { GAME_START_QUESTS, gameStartQuests } from '../../../src/scenes/quest/questBridge.js';
import { createStartsHost, STARTS_TEXT, WRIT_PORT } from '../../../src/scenes/startsHost.js';
import { StartChoiceScreen, START_CHOICE_TEXT, startRowAt, startWords, wrapToWidth, START_ROW_TOP, START_ROW_H, START_X0, START_X1, START_BODY_W, START_BODY_LINES, START_LEAD_LINES } from '../../../src/ui/startChoice.js';
import { createChargenWindow } from '../../../src/systems/chargenSession.js';
import { ChargenFlow } from '../../../src/ui/chargen.js';
import { SKILLS } from '../../../src/systems/skills.js';
import { dungeonItemMarkerCount, SITE_TYPES, siteWorldPixel } from '../../../src/systems/quest/place.js';
import { placesTable } from '../../../src/systems/quest/tables.js';
import { sheetFor } from '../../../src/systems/questlines/qlSheets.js';
import { readObjectives, outcomeNow } from '../../../src/systems/questlines/qlLaw.js';
import { planRoute, planSeaLanes, LANE_CELL, LANE_MARGIN } from '../../../src/systems/travel/travelRoute.js';
import { createPassageHost } from '../../../src/scenes/naval/passageHost.js';
import { PASSAGE_TEXT } from '../../../src/systems/naval/passage.js';
import { setValue, getBool } from '../../../src/systems/settings/settings.js';
import { FACTION_TYPES } from '../../../src/formats/factionFile.js';
import { BUILDING_TYPES } from '../../../src/world/buildingNames.js';
import { ROOT, packMachine, loadTables } from '../../qlSources.mjs';
import { town, dungeon, rmbBlock, worldOf, SPAWN, ITEM } from '../../fb1004dTowns.mjs';
import { hostText } from '../../hostText.mjs';   // PIN MOVED (HOST-SPLIT TEST-PRESET): the world host whole

const DAY = 86400;
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');

// ── the registry ─────────────────────────────────────────────────

test('START2 the registry: the Bay\'s start first, then the seven provinces past it in the picker\'s order - each its own quest, province, capital, homeland and wanted dungeons - and the commission in hand last; each province\'s site a Quests-Places row of an id no MAPS.BSA place and no id lane of the port\'s own takes (mutants: a site\'s row unlaid, an id on the Bay\'s start, the homeland\'s fallback)', () => {
  assert.deepEqual(STARTS.map((s) => s.key), ['IliacBay', 'Skyrim', 'Morrowind', 'Imperial', 'BlackMarsh', 'Elsweyr', 'Valenwood', 'Sumurset']);
  assert.equal(BAY_START, STARTS[0]);
  assert.equal(BAY_START.quest, BAY_START_QUEST);
  assert.deepEqual([...START_QUESTS], [...STARTS.map((s) => s.quest), HAND_START_QUEST]);
  assert.equal(new Set(START_QUESTS).size, START_QUESTS.length, 'one quest a start');
  assert.ok(START_QUESTS.every(isStartQuestName) && !isStartQuestName(MAIN_QUEST_OPENER));
  loadTables();
  const places = placesTable();
  assert.equal(BAY_START.site, null, 'the Bay\'s start is Privateer\'s Hold\'s: MAPS.BSA\'s own row (PirateerHold1)');
  for (const s of STARTS.slice(1)) {
    assert.ok(s.province && CAPITALS.some((c) => c.key === s.capital && c.province === s.province), `${s.key}: its capital stands in its province`);
    assert.ok(s.lair.length >= 1 && s.lair.every((w) => w[0] in LOCATION_TYPES && (w[1] === '*' || w[1] in DUNGEON_TYPES)), `${s.key}: the dungeons it wants are MapsFile's kinds`);
    assert.ok(s.lair.every((w) => ['DungeonLabyrinth', 'DungeonKeep', 'DungeonRuin', 'Graveyard'].includes(w[0])), 'a lair\'s kinds (TESA8 LAIR_TYPES)');
    assert.ok(places.hasValue(s.site), `${s.key}: its row is laid`);
    assert.equal(Number(places.getValue('p1', s.site)), startSiteId(s), 'its p1 its site id');
    assert.equal(startOfSiteId(startSiteId(s)), s);
  }
  assert.equal(START_PLACE_ROWS.length, 7);
  assert.equal(startOfSiteId(START_SITE_ID_BASE), null, 'the Bay\'s start has no site of its own');
  assert.equal(startOfSiteId(START_SITE_ID_BASE - 1), null);
  assert.equal(startOfSiteId(START_SITE_ID_BASE + STARTS.length), null);
  assert.equal(startOfSiteId(0xc382), null, 'a MAPS.BSA id names no start');
  assert.ok(START_SITE_ID_BASE > 0xffff, 'past every MAPS.BSA LocationId (16 bits)');
  assert.ok(((START_SITE_ID_BASE + STARTS.length) >>> 20) < 0xa7, 'and below the port\'s own places\' id lanes (0xa7 and up)');
  // the homelands: the Bay High Rock's and Hammerfell's peoples', each other race its province's; the Imperial Province no race's
  const home = Object.fromEntries(['Breton', 'Redguard', 'Nord', 'DarkElf', 'HighElf', 'WoodElf', 'Khajiit', 'Argonian', null, 'Imperial'].map((r) => [r, homelandStart(r).key]));
  assert.deepEqual(home, { Breton: 'IliacBay', Redguard: 'IliacBay', Nord: 'Skyrim', DarkElf: 'Morrowind', HighElf: 'Sumurset', WoodElf: 'Valenwood', Khajiit: 'Elsweyr', Argonian: 'BlackMarsh', null: 'IliacBay', Imperial: 'IliacBay' });
  assert.deepEqual(startByKey('Imperial').homeland, []);
  assert.equal(startByKey('Nowhere'), null);
  // the bridge's first quests: the curse's and the start's
  assert.deepEqual([...gameStartQuests()], [...GAME_START_QUESTS], 'the Bay\'s by default');
  for (const q of START_QUESTS) assert.deepEqual([...gameStartQuests(q)], ['S0000977', q]);
  assert.deepEqual([...gameStartQuests('_BRISIEN')], ['S0000977', BAY_START_QUEST], 'never the main quest itself');
});

// ── a province's start dungeon ───────────────────────────────────

test('START2 a province\'s start dungeon (systems/starts/startSite.js): each kind its story wants in its order, nearest the capital first, then any other lair - only lairs on their cells\' sites, in its own province, past the capital\'s doorstep and within reach, on no pixel another place takes; ties broken by the pixel, the same on every client (mutants: the want order, the province, the doorstep, the reach, the free test)', () => {
  const centre = lairSite(lairCellOf(4000, 300));   // on a cell's own site: one lair on the capital's doorstep
  // every cell's site within 60 of the capital, nearest first
  const sites = [];
  const seen = new Set();
  for (let dy = -60; dy <= 60; dy++) for (let dx = -60; dx <= 60; dx++) {
    const c = lairCellOf(centre.px + dx, centre.py + dy);
    if (c < 0 || seen.has(c)) continue;
    seen.add(c);
    const s = lairSite(c);
    sites.push({ ...s, d: Math.hypot(s.px - centre.px, s.py - centre.py) });
  }
  sites.sort((a, b) => a.d - b.d);
  const inReach = sites.filter((s) => s.d >= START_SITE_MIN && s.d <= START_SITE_REACH);
  const near = sites.find((s) => s.d < START_SITE_MIN), far = sites.find((s) => s.d > START_SITE_REACH);
  assert.ok(inReach.length > 12 && far && near, 'the cells about a capital');
  const [k0, k1, k2, k3, k4] = inReach;
  const crypt = inReach.at(-1);   // the farthest in reach
  const roll = new Map();
  const at = (s, type, dungeonType) => roll.set(`${s.px},${s.py}`, { type: LOCATION_TYPES[type], dungeonType: DUNGEON_TYPES[dungeonType] });
  at(k0, 'DungeonKeep', 'Mine');
  at(k1, 'DungeonLabyrinth', 'Mine');
  at(k2, 'DungeonLabyrinth', 'Crypt');   // another province's
  at(k3, 'DungeonLabyrinth', 'Crypt');   // a place stands on it
  at(k4, 'DungeonRuin', 'Coven');
  at(crypt, 'DungeonLabyrinth', 'Crypt');
  at(near, 'DungeonLabyrinth', 'Crypt');   // on the capital's doorstep
  at(far, 'DungeonLabyrinth', 'Crypt');   // out of reach
  const start = { province: 'Skyrim', lair: [['DungeonLabyrinth', 'Crypt'], ['DungeonLabyrinth', 'Mine']] };
  const world = {
    centre,
    rollAt: (x, y) => roll.get(`${x},${y}`) ?? null,
    free: (x, y) => !(x === k3.px && y === k3.py),
    provinceAt: (x, y) => (x === k2.px && y === k2.py ? 'Morrowind' : 'Skyrim'),
  };
  const out = startLairSites(start, world);
  assert.deepEqual(out.map((s) => [s.px, s.py, s.want]), [[crypt.px, crypt.py, 0], [k1.px, k1.py, 1], [k0.px, k0.py, -1], [k4.px, k4.py, -1]]);
  assert.deepEqual(startLairSites(start, world), out, 'the same answer asked again');
  assert.deepEqual(startLairSites({ ...start, lair: [['DungeonRuin', '*']] }, world).map((s) => s.want), [0, -1, -1, -1], 'a `*` any dungeon type of its kind');
  assert.deepEqual(startLairSites({ province: null, lair: [] }, world), [], 'the Bay\'s start finds none');
  assert.deepEqual(startLairSites(start, { ...world, centre: null }), [], 'a capital on no pixel: none');
  assert.ok(wantMatches(['Graveyard', 'Cemetery'], LOCATION_TYPES.Graveyard, DUNGEON_TYPES.Cemetery));
  assert.ok(!wantMatches(['Graveyard', 'Cemetery'], LOCATION_TYPES.DungeonKeep, DUNGEON_TYPES.Cemetery));
});

test('START2 a start dungeon holds a quest item\'s marker: the interior blocks\' item markers are counted, a border block\'s and a spawn marker never - a graveyard\'s five marker-free blocks are no start\'s (mutants: the border block counted, the spawn marker counted)', () => {
  const flat = (record) => ({ type: 3, position: record, xPos: 0, yPos: 0, zPos: 0, resources: { flatResource: { textureArchive: 199, textureRecord: record } } });
  const blocks = new Map([
    ['N0000001.RDB', { rdbBlock: { objectRootList: [{ rdbObjects: [flat(ITEM), flat(SPAWN), flat(ITEM)] }] } }],
    ['B0000001.RDB', { rdbBlock: { objectRootList: [{ rdbObjects: [flat(ITEM)] }] } }],
    ['N0000002.RDB', { rdbBlock: { objectRootList: [{ rdbObjects: [flat(SPAWN)] }, null] } }],
  ]);
  const of = (...names) => ({ dungeon: { blocks: names.map((blockName) => ({ blockName })) } });
  const get = (n) => blocks.get(n) ?? null;
  assert.equal(dungeonItemMarkerCount(get, of('N0000001.RDB', 'B0000001.RDB')), 2);
  assert.equal(dungeonItemMarkerCount(get, of('N0000002.RDB', 'B0000001.RDB')), 0, 'spawn markers alone, a border\'s item: none');
  assert.equal(dungeonItemMarkerCount(get, of('MISSING.RDB')), 0);
  assert.equal(dungeonItemMarkerCount(get, null), 0);
});

// ── a province's start, played ───────────────────────────────────
// A lair past the Bay in the port's own shapes - in no MAPS.BSA table: the quest finds it through the world's start seam
// (questWorld.js startSiteOfId) alone - its one block holding an item marker and a spawn marker; the city of Daggerfall;
// Woodcroft Hall, where Lady Brisienna can take a room; a farm.
const LAIR_FLAT = (record, x, y, z) => ({ type: 3, position: record, xPos: x, yPos: y, zPos: z, resources: { flatResource: { textureArchive: 199, textureRecord: record } } });
const LAIR_BLOCK = { position: 0, rdbBlock: { objectRootList: [{ rdbObjects: [LAIR_FLAT(ITEM, 800, -40, 1200), LAIR_FLAT(SPAWN, 200, -40, 300)] }] } };
const LAIR_MAP_ID = ((0x340 << 20) | 0x80000 | 12345) >>> 0;   // a lair's lane (world/tamrielDungeons.js lairPlaceId)
function province({ siteAnswers = true } = {}) {
  loadTables();
  const lair = dungeon({ name: 'The Haunt of Baringon', locationIndex: 99, mapId: LAIR_MAP_ID, dungeonType: 8, block: 'N0000099.RDB', regionIndex: 17, regionName: 'Daggerfall' });
  const city = town({ name: 'Daggerfall', locationIndex: 0, mapId: 1291010263, grid: ['CITY.RMB'] });
  city.exterior.exteriorData.locationId = 0xc36a;
  const inn = town({ name: 'Woodcroft Hall', locationIndex: 1, mapId: 5002, grid: ['INN.RMB'] });
  inn.exterior.buildings.push({ buildingType: BUILDING_TYPES.Tavern, factionId: 0, nameSeed: 100, quality: 10 });
  const farm = town({ name: 'Ashwick Farm', locationIndex: 2, mapId: 5003, grid: ['FARM.RMB'] });
  // Privateer's Hold, as the Bay has it: _BRISIEN names it (`Place PiratesHold permanent PirateerHold1`)
  const hold = dungeon({ name: "Privateer's Hold", locationIndex: 3, mapId: 187853213, dungeonType: 0, block: 'S0000999.RDB' });
  hold.exterior.exteriorData.locationId = 0xc381;
  const locations = [city, inn, farm, hold];
  const blocks = new Map([['N0000099.RDB', LAIR_BLOCK], ['S0000999.RDB', LAIR_BLOCK], ['CITY.RMB', rmbBlock('CITY.RMB', [{ type: BUILDING_TYPES.Palace }])],
    ['INN.RMB', rmbBlock('INN.RMB', [{ type: BUILDING_TYPES.Tavern }])], ['FARM.RMB', rmbBlock('FARM.RMB', [{ type: BUILDING_TYPES.House1 }])]]);
  const where = { loc: lair, inside: { dungeon: true } };
  const said = [], discovered = [], removed = [], given = [], asked = [];
  const base = worldOf({ locations, blocks });
  const world = {
    ...base,
    getFactionData: (id) => ({ ...base.getFactionData(id), type: FACTION_TYPES.Individual }),
    currentLocation: () => where.loc, playerInside: () => where.inside, isPlayerInLocationRect: () => !where.inside,
    currentLocationIndex: () => locations.indexOf(where.loc),
    discoverLocation: (_r, l) => discovered.push(l), mountCurrentSiteQuestResources: () => {},
    startSiteOfId: (id) => { asked.push(id); return siteAnswers && startOfSiteId(id) ? lair : null; },
  };
  const now = { s: 1e6 };
  const m = packMachine({
    nowSeconds: () => now.s, skySeconds: () => 100 * DAY + 12 * 3600, world,
    showPopup: (q, tokens) => said.push({ quest: q.questName, text: (tokens ?? []).map((t) => t.text).join(' ').replace(/\s+/g, ' ').trim() }),
    isPlayerInTown: () => !where.inside, giveItemToPlayer: (it) => given.push(it), removeItemFromPlayer: (it) => removed.push(it), carriesQuestItem: () => true,
  });
  const at = (p) => { where.loc = p === 'lair' ? lair : p === 'city' ? city : farm; where.inside = p === 'lair' ? { dungeon: true } : null; };
  const tick = (n = 1) => { for (let i = 0; i < n; i++) { now.s += 60; m.tick(); } };
  const quest = (name) => [...m.quests.values()].find((q) => q.questName === name && !q.questTombstoned) ?? null;
  return { m, at, tick, quest, said, discovered, removed, given, asked, lair };
}
const textOf = (q, id) => q.getMessage(id).getTextTokens(-1, () => 0).map((t) => t.text).join(' ').replace(/\s+/g, ' ').trim();
const logOf = (q) => [...q.activeLogMessages.values()].map((l) => [l.stepID, l.messageID]);
/** Each province's tie to the main story, in the words it finds beside the commission. */
const TIES = {
  _STARTSK: /The Underking sleeps\. His heart does not\./,
  _STARTMW: /For the Walking God\. To the Iliac Bay\./,
  _STARTIC: /The Emperor's own\. Open it when you will\./,
  _STARTBM: /no bigger than a fist\. Its tag reads: "To Wayrest\."/,
  _STARTEL: /To the Queen of Sentinel, who pays in gold\./,
  _STARTVW: /Septim, to Mynisera, Queen of Daggerfall/,
  _STARTSU: /The Mantella is no jewel\. It is a soul/,
};

for (const start of STARTS.slice(1)) {
  test(`START2 ${start.key}'s start, played: its site the world's start dungeon (no MAPS.BSA place), the commission at its item marker, the wake; found, its tie to the main story; opened, the orders and the writ, Daggerfall revealed; in Daggerfall's streets _BRISIEN begins and the start ends (mutants: the site seam, the tie's words, the gate)`, () => {
    const p = province();
    const q = p.m.startQuestByName(start.quest);
    assert.ok(q, `${start.quest} starts`);
    assert.deepEqual(p.asked, [startSiteId(start)], 'its Place asked the world for its own site, by its id');
    p.tick(2);
    const lair = q.getPlace({ name: 'lair' });
    assert.equal(lair.siteDetails.siteType, SITE_TYPES.Dungeon);
    assert.equal(lair.siteDetails.mapId, LAIR_MAP_ID);
    assert.equal(lair.siteDetails.locationName, 'The Haunt of Baringon');
    assert.deepEqual(lair.siteDetails.selectedMarker.targetResources?.map((s) => s.name), ['commission'], 'the commission at the dungeon\'s item marker');
    assert.deepEqual(lair.siteDetails.selectedMarker.flatPosition, { x: 800 * 0.025, y: 40 * 0.025, z: 1200 * 0.025 });
    assert.deepEqual(p.said.map((s) => [s.quest, s.text]), [[start.quest, textOf(q, 1020)]], 'one page at the wake');
    assert.deepEqual(logOf(q), [[0, 1010]]);
    assert.match(textOf(q, 1010), /The Haunt of Baringon\./, 'the journal names the dungeon');
    assert.deepEqual(p.discovered, ['The Haunt of Baringon'], 'and the travel map shows it');
    p.said.length = 0;
    p.now?.s;   // (the clock is the harness's)
    const item = q.getItem({ name: 'commission' });
    item.setPlayerClicked();
    p.tick(1);
    assert.equal(p.said.length, 1);
    assert.match(p.said[0].text, TIES[start.quest], 'its tie to the main story');
    assert.match(p.said[0].text, /When you break the seal is yours to choose\./);
    assert.deepEqual(logOf(q), [[1, 1011]]);
    p.said.length = 0;
    item.useClicked = true;
    p.tick(1);
    assert.deepEqual(logOf(q), [[2, 1012]]);
    assert.match(textOf(q, 1012), /His writ pays my passage on any ship bound there\./);
    assert.match(textOf(q, 1030), /This letter is Our writ of passage\. Any master in a harbor of the Empire will carry you to Daggerfall at Our expense\./);
    assert.deepEqual(p.discovered, ['The Haunt of Baringon', 'Daggerfall']);
    p.at('wilds');
    p.tick(3);
    assert.ok(p.quest(start.quest) && !p.quest('_BRISIEN'), 'nowhere but Daggerfall');
    p.at('city');
    p.tick(5);
    assert.equal(p.quest(start.quest), null, 'the start has ended');
    assert.ok(p.quest('_BRISIEN') && p.quest('S0000999'), 'the main quest begun in Daggerfall');
    assert.equal(outcomeNow(q, sheetFor(start.quest))?.id, 'reported');
  });
}

test('START2 a start whose site the world cannot name yet is not started: its Place throws where DFU\'s unknown id throws, and nothing of it runs (mutants: the throw)', () => {
  const p = province({ siteAnswers: false });
  assert.equal(p.m.startQuestByName('_STARTSK'), null);
  assert.equal(p.quest('_STARTSK'), null);
});

test('START2 the sheet of a province\'s start: the find marked on its dungeon, the opening once it is held, the order marked on Daggerfall once read', () => {
  for (const start of STARTS.slice(1)) {
    const p = province();
    const q = p.m.startQuestByName(start.quest);
    const sheet = sheetFor(start.quest);
    assert.equal(sheet?.family, 'MainQuest');
    const states = () => Object.fromEntries(readObjectives(q, sheet).map((o) => [o.id, o.state]));
    p.tick(2);
    assert.deepEqual(states(), { find: 'open', open: 'hidden', report: 'hidden' }, start.key);
    assert.deepEqual(readObjectives(q, sheet).map((o) => o.mark), ['lair', null, 'daggerfall']);
    q.getItem({ name: 'commission' }).setPlayerClicked();
    p.tick(1);
    q.getItem({ name: 'commission' }).useClicked = true;
    p.tick(1);
    assert.deepEqual(states(), { find: 'done', open: 'done', report: 'open' });
  }
});

test('START2 the commission in hand (_STARTHD): a character born at no start holds it from the first tick - given, never a reward\'s window - and the same gate begins the main quest in Daggerfall (mutants: given by `give pc`, the gate)', () => {
  const p = province();
  p.at('wilds');
  const q = p.m.startQuestByName(HAND_START_QUEST);
  p.tick(2);
  assert.equal(p.given.length, 1, 'in the pack');
  assert.match(p.said[0]?.text ?? '', /pressed an oilskin case into your hands/);
  assert.deepEqual(logOf(q), [[0, 1010]]);
  assert.doesNotMatch(rd('src/systems/starts/quests/_STARTHD.txt'), /give pc/, 'given by `get item`: GivePc\'s plain form is a reward\'s window, its silent one waits for a town by day');
  q.getItem({ name: 'commission' }).useClicked = true;
  p.tick(1);
  assert.deepEqual(p.discovered, ['Daggerfall']);
  p.at('city');
  p.tick(5);
  assert.equal(p.quest(HAND_START_QUEST), null);
  assert.ok(p.quest('_BRISIEN'));
  const sheet = sheetFor(HAND_START_QUEST);
  assert.deepEqual(sheet.objectives.map((o) => o.id), ['open', 'report']);
});

// ── the world's start host ───────────────────────────────────────

/** The start host over stand-ins: `o.chosen` the page's answer, `o.params` the boot's, `o.site` what the quest layer names. */
function host(o = {}) {
  const log = { asked: [], moved: [], teleported: [], said: [], then: [] };
  const lair = { name: 'Castle Zanai', mapTableData: { longitude: 0, latitude: 0 }, hasDungeon: true };
  const h = createStartsHost({
    params: new URLSearchParams(o.params ?? 'classic=1'), pastBay: o.pastBay ?? true,
    quests: () => ({
      startSiteOfId: (id) => { log.asked.push(id); return o.site === undefined ? lair : o.site; },
      respawnLatched: async (loc) => { if (o.moveThrows) throw new Error('no'); log.moved.push(loc.name); },
    }),
    teleport: async (x, y, _local, opts) => { log.teleported.push([x, y]); log.reposition = opts?.reposition; },
    landReady: o.landReady ?? Promise.resolve(), talk: { say: (t) => log.said.push(t) },
    machine: () => o.machine ?? null, ready: o.ready, landWaitMs: o.landWaitMs,
  });
  return { h, log, lair };
}

test('START2 the start host: the Bay\'s start where the boot stood Privateer\'s Hold (?classic), the commission in hand anywhere else; a province\'s start waits on the land past the Bay, moves the character into its dungeon (or to its door, StartInDungeon off), and only then starts its quest; none found or the move refused, it says so and the Bay\'s start is theirs; once a character (mutants: the move before the quest, the wait, the fallback)', async () => {
  const was = getBool('Startup', 'StartInDungeon');
  try {
    setValue('Startup', 'StartInDungeon', 'True');
    let a = host();
    await a.h.begin((q) => a.log.then.push(q));
    assert.deepEqual(a.log.then, ['_STARTIB']);
    assert.deepEqual(a.log.asked, []);
    a = host({ params: 'world=1' });
    await a.h.begin((q) => a.log.then.push(q));
    assert.deepEqual(a.log.then, [HAND_START_QUEST], 'a character the boot stood elsewhere');
    // a province: the land waited on, the dungeon the quest layer's, the move, then the quest
    let land;
    const ready = new Promise((r) => { land = r; });
    a = host({ landReady: ready });
    a.h.choose('Elsweyr');
    const order = [];
    const going = a.h.begin((q) => { order.push(['then', q, a.log.moved.length]); });
    await Promise.resolve();
    assert.deepEqual(a.log.asked, [], 'nothing asked before the land past the Bay has its trace');
    land();
    await going;
    assert.deepEqual(a.log.asked, [startSiteId(startByKey('Elsweyr'))]);
    assert.deepEqual(a.log.moved, ['Castle Zanai'], 'into its dungeon');
    assert.deepEqual(order, [['then', '_STARTEL', 1]], 'its quest once they stand there');
    let settled = false;
    a.h.settled.then(() => { settled = true; });
    await Promise.resolve();
    assert.equal(settled, true, 'a birth online waits on this');
    await a.h.begin((q) => order.push(q));
    assert.equal(order.length, 1, 'once a character');
    // the boot's world first: a province's move never races the classic start's own entry
    let stands = false;
    a = host({ ready: () => stands });
    const late = a.h.begin((q) => a.log.then.push(q), 'Morrowind');
    await new Promise((r) => setTimeout(r, 30));
    assert.deepEqual([a.log.asked, a.log.moved], [[], []], 'nothing moved while the world is still standing up');
    stands = true;
    await late;
    assert.deepEqual([a.log.moved, a.log.then], [['Castle Zanai'], ['_STARTMW']], 'begin(then, key): the page\'s answer handed with it');
    // StartInDungeon off: to its door - its pixel, on a start marker (AUDIT STARTS W6: never the pixel's middle)
    setValue('Startup', 'StartInDungeon', 'False');
    a = host();
    a.h.choose('Skyrim');
    await a.h.begin((q) => a.log.then.push(q));
    assert.deepEqual(a.log.moved, []);
    assert.deepEqual(a.log.teleported, [[0, 499]], 'to its pixel (its row\'s longitude and latitude)');
    assert.equal(a.log.reposition, 'RandomStartMarker', 'on the pixel\'s start marker');
    assert.deepEqual(a.log.then, ['_STARTSK']);
    setValue('Startup', 'StartInDungeon', 'True');
    // none found: said, and the Bay's - the player still where the boot stood them
    a = host({ site: null });
    a.h.choose('Valenwood');
    await a.h.begin((q) => a.log.then.push(q));
    assert.deepEqual(a.log.said, [STARTS_TEXT.noSite]);
    assert.deepEqual(a.log.then, ['_STARTIB']);
    // AUDIT STARTS W4: the move refused may have left the player anywhere - the commission in hand, true wherever they stand
    a = host({ moveThrows: true });
    a.h.choose('Valenwood');
    await a.h.begin((q) => a.log.then.push(q));
    assert.deepEqual([a.log.said, a.log.then], [[], [HAND_START_QUEST]]);
    // AUDIT STARTS Q6: the land's trace that never landed names no dungeon (one named on the authored shape stands no lair
    // once it lands) - said, the Bay's
    a = host({ landReady: new Promise(() => {}), landWaitMs: 5 });
    a.h.choose('Skyrim');
    await a.h.begin((q) => a.log.then.push(q));
    assert.deepEqual([a.log.asked, a.log.said, a.log.then], [[], [STARTS_TEXT.noSite], ['_STARTIB']]);
    // AUDIT STARTS Q5: a load that lands while the start waits is the game now - nothing moved, nothing begun over it
    const mach = { restores: 0, quests: new Map() };
    let landNow;
    a = host({ machine: mach, landReady: new Promise((r) => { landNow = r; }) });
    a.h.choose('Skyrim');
    const waiting = a.h.begin((q) => a.log.then.push(q));
    mach.restores = 1;
    landNow();
    await waiting;
    assert.deepEqual([a.log.asked, a.log.moved, a.log.then], [[], [], []], 'the loaded game\'s own story');
    // AUDIT STARTS Q6: a start its Place refused after the move is no start - the commission handed over in its place
    const begun = [];
    const empty = { restores: 0, quests: new Map(), startQuestByName: (n) => begun.push(n) };
    a = host({ machine: empty });
    a.h.choose('Skyrim');
    await a.h.begin((q) => a.log.then.push(q));
    assert.deepEqual([a.log.then, begun], [['_STARTSK'], [HAND_START_QUEST]]);
    // the land past the Bay off: no province is open, and one asked for is the Bay's without a wait
    a = host({ pastBay: false });
    assert.equal(a.h.open(startByKey('Skyrim')), false);
    assert.equal(a.h.open(BAY_START), true);
    a.h.choose('Skyrim');
    await a.h.begin((q) => a.log.then.push(q));
    assert.deepEqual([a.log.asked, a.log.then], [[], ['_STARTIB']]);
    // the page's answer, else the boot's ?start=, else the Bay's; a key no start has is no answer
    a = host({ params: 'classic=1&start=Sumurset' });
    a.h.choose('Atlantis');
    assert.equal(a.h.start.key, 'Sumurset');
    a.h.choose('Morrowind');
    assert.equal(a.h.start.key, 'Morrowind');
  } finally { setValue('Startup', 'StartInDungeon', was ? 'True' : 'False'); }
});

test('START2 the writ: an opened start\'s commission is the Crown\'s writ of passage to the city of Daggerfall - that port alone, while the start runs, once its seal is broken; over the quest the machine runs, into the harbor\'s list (AUDIT STARTS Q1, V2, V3: the task by the name the machine files it under, an ended start none, the Bay\'s letter none) (mutants: the port, the seal, the task\'s name, the ended start, the Bay\'s)', () => {
  const region = REGION_NAMES.indexOf(WRIT_PORT.region);
  const daggerfall = { name: 'Daggerfall', region }, wayrest = { name: 'Wayrest', region: REGION_NAMES.indexOf('Wayrest') };
  const p = province();
  const { h } = host({ machine: p.m });
  assert.equal(h.writ(daggerfall), false, 'no start running');
  const q = p.m.startQuestByName('_STARTSK');
  p.tick(2);
  assert.equal(h.writ(daggerfall), false, 'sealed');
  const item = q.getItem({ name: 'commission' });
  item.setPlayerClicked();
  p.tick(1);
  assert.equal(h.writ(daggerfall), false, 'found, its seal still whole');
  item.useClicked = true;
  p.tick(1);
  assert.equal(h.writ(daggerfall), true, 'its seal broken: the Crown\'s writ');
  assert.equal(h.writ(wayrest), false, 'Daggerfall\'s alone');
  assert.equal(h.writ({ name: 'Daggerfall', region: region + 1 }), false, 'the city, not a namesake');
  // the harbor's list, through the writ the machine answers
  const at = harbor(h.writ);
  assert.ok(at.rows().some((r) => /^Daggerfall - .*, by writ$/.test(r)), at.rows().join(' | '));
  p.at('wilds');
  p.tick(2);
  p.at('city');
  p.tick(5);
  assert.equal(p.quest('_STARTSK'), null, 'the start has ended in Daggerfall');
  assert.ok([...p.m.quests.values()].some((x) => x.questName === '_STARTSK' && x.questTombstoned), 'its tombstone kept a week, its seal still broken');
  assert.equal(h.writ(daggerfall), false, 'an ended start\'s writ is spent');
  // the Bay's start: its letter is no writ
  const b = province();
  const bh = host({ machine: b.m }).h;
  const ib = b.m.startQuestByName('_STARTIB');
  b.tick(2);
  const bi = ib.getItem({ name: 'commission' });
  bi.setPlayerClicked();
  b.tick(1);
  bi.useClicked = true;
  b.tick(1);
  assert.ok(ib.getTask({ name: 'opened' })?.getTriggerValue?.(), 'the Bay\'s commission opened');
  assert.equal(bh.writ(daggerfall), false, 'the Bay\'s letter carries no writ');
});

/** A friendly master at a harbor (scenes/naval/passageHost.js), `writ` the host's: her list's rows, and the log. */
function harbor(writ) {
  const log = { shown: [], said: [], paid: [] };
  const ports = [{ key: '207,213', name: 'Daggerfall', px: 207, py: 213, region: REGION_NAMES.indexOf('Daggerfall') }, { key: '600,200', name: 'Sentinel', px: 600, py: 200, region: 0 }];
  const rt = { AllBoats: [], state: { CurrentBoat: null }, sailing: false, isSailing() { return this.sailing; }, StartSailing(b) { this.sailing = true; this.state.CurrentBoat = b; } };
  const naval = { charter: (id, record) => { log.charter = record; const b = { uid: 1, hull: 2, charter: record, GameObject: { position: [0, 0, 0] }, Cargo: { Items: [] } }; rt.AllBoats.push(b); return b; }, charterSailed: () => true };
  const ph = createPassageHost({
    naval: () => naval, csa: () => rt, ports: () => ports, here: () => null, pixel: () => ({ x: 1564, y: -435 }), ether: () => false,
    place: (pl) => ({ name: pl.name, pixel: { x: pl.px, y: pl.py } }), canGo: () => true, route: () => true, travel: () => null, journeyTo: () => null,
    busy: () => false, standsOn: () => false, remount: () => {}, player: { transportMode: 'foot', feetAt: () => [0, 0, 0], spawn: () => {} },
    gold: () => 3, pay: (n) => log.paid.push(n), pack: () => [], talk: { say: (t) => log.said.push(t), showOverlay: (w) => log.shown.push(w) },
    writ,
  });
  assert.equal(ph.offer({ id: 's', name: 'The Fair Silk', captain: null, hull: 2 }), true);
  return { ph, log, rows: () => log.shown[0].items };
}

test('START2 the writ at a harbor: her master lists the writ\'s port for nothing, asks nothing of the purse, and the booking pays nothing (passageHost.js `writ`) (mutants: the fare kept, the question\'s purse)', () => {
  const { log, rows: rowsOf } = harbor((port) => port.name === 'Daggerfall');
  const rows = rowsOf();
  assert.ok(rows.some((r) => /^Daggerfall - .*, by writ$/.test(r)), rows.join(' | '));
  assert.ok(rows.some((r) => /^Sentinel - .*, \d+ gold$/.test(r)), 'the others at their fares');
  log.shown[0]._pick(rows.findIndex((r) => r.startsWith('Daggerfall')));
  assert.deepEqual(log.shown[1].rows, PASSAGE_TEXT.askWrit('The Fair Silk', 'Daggerfall'), 'nothing asked of a purse of three gold');
  assert.match(log.shown[1].rows[1], /The Emperor's writ of passage pays your fare\./);
  log.shown[1].answer(true);
  assert.deepEqual(log.paid, [0], 'the Crown pays: nothing from the purse');
  assert.equal(log.charter?.fare, 0, 'her record says so');
  assert.equal(log.said.at(-1), PASSAGE_TEXT.bookedWrit('The Fair Silk', 'Daggerfall'));
});

// ── the start-choice page ────────────────────────────────────────

test('START2 the start page (ui/startChoice.js): the eight starts in their order, the race\'s homeland chosen first and tagged; a start the host cannot stand shut with why; up/down skip it, 1 to 8 pick, Enter takes the cursor, a press on a row picks it - one answer (mutants: the homeland\'s cursor, the shut pick, the row\'s hit)', () => {
  let got = [];
  const nord = new StartChoiceScreen((k) => got.push(k), { race: 'Nord' });
  assert.deepEqual(nord.options.map((o) => o.id), STARTS.map((s) => s.key));
  assert.equal(nord.options[nord.cursor].id, 'Skyrim', 'a Nord\'s homeland first');
  assert.deepEqual(nord.options.filter((o) => o.homeland).map((o) => o.id), ['Skyrim']);
  assert.equal(nord.defaultId, 'Skyrim', 'what a question torn down answers');
  nord.input('confirm');
  nord.input('Digit1');
  assert.deepEqual(got, ['Skyrim'], 'one answer');
  got = [];
  const breton = new StartChoiceScreen((k) => got.push(k), { race: 'Breton' });
  assert.equal(breton.cursor, 0);
  breton.input('ArrowDown'); breton.input('ArrowDown');
  assert.equal(breton.options[breton.cursor].id, 'Morrowind');
  breton.input('char:8');
  assert.deepEqual(got, ['Sumurset']);
  // shut: the land past the Bay off
  got = [];
  const shut = new StartChoiceScreen((k) => got.push(k), { race: 'Khajiit', open: () => false });
  assert.equal(shut.cursor, 0, 'the homeland shut: the Bay\'s');
  assert.ok(shut.options.slice(1).every((o) => o.locked && o.lockNote === START_CHOICE_TEXT.shut) && !shut.options[0].locked);
  shut.input('ArrowDown');
  assert.equal(shut.cursor, 0, 'the cursor never rests on a shut start');
  shut.input('Digit6');
  assert.deepEqual(got, [], 'nor does a key pick one');
  shut.input('Enter');
  assert.deepEqual(got, ['IliacBay']);
  // the pointer: a row's own band
  got = [];
  const click = new StartChoiceScreen((k) => got.push(k));
  assert.equal(startRowAt(START_X0 + 4, START_ROW_TOP + 3 * START_ROW_H + 2), 3);
  assert.equal(startRowAt(START_X0 - 1, START_ROW_TOP + 2), -1);
  assert.equal(startRowAt(START_X1 - 1, START_ROW_TOP + STARTS.length * START_ROW_H + 1), -1, 'under the list: the story, no row');
  click.hover(START_X0 + 4, START_ROW_TOP + 5 * START_ROW_H + 1);
  assert.equal(click.options[click.cursor].id, 'Elsweyr');
  // AUDIT STARTS U3: a press answers for the start whose story the page drew - on another row it selects (a phone's tap)
  assert.equal(click.click(START_X0 + 4, START_ROW_TOP + 6 * START_ROW_H + 1), false);
  assert.deepEqual([click.options[click.cursor].id, got], ['Valenwood', []]);
  click.draw({ drawScreenQuad() {} }, { width: 320, height: 200 }, { fnt: { glyphs: new Map(), ascent: 6, lineHeight: 8, fixedHeight: 8, fixedWidth: 6, glyphWidth: () => 5, glyphSpacing: 1 }, tex: 'T' });
  assert.equal(click.click(START_X0 + 4, START_ROW_TOP + 6 * START_ROW_H + 1), true);
  assert.deepEqual(got, ['Valenwood']);
  assert.equal(click.done, true);
  // every start has its words
  for (const s of STARTS) { const w = startWords(s); assert.ok(w.title && w.where && w.body.length > 60, s.key); }
  assert.deepEqual(wrapToWidth('a bb ccc dddd', 7, (t) => t.length), ['a bb', 'ccc', 'dddd']);
});

/** A character made through the wizard to its summary (test/systems/orl1_leveling.test.js's walk). */
const career = {
  name: 'W', hitPointsPerLevel: 12, advancementMultiplier: 1.0, strength: 60, intelligence: 40, willpower: 45, agility: 55, endurance: 60, personality: 40, speed: 50, luck: 50,
  primarySkills: [SKILLS.LongBlade, SKILLS.Axe, SKILLS.CriticalStrike], majorSkills: [SKILLS.BluntWeapon, SKILLS.Dodging, SKILLS.Jumping],
  minorSkills: [SKILLS.ShortBlade, SKILLS.Archery, SKILLS.Running, SKILLS.Swimming, SKILLS.Climbing, SKILLS.Medical],
};
function madeTo(startChoice) {
  let result = null;
  const w = createChargenWindow(new ChargenFlow([{ name: 'Warrior', career }], () => 0), { onDone: (r) => { result = r; }, startChoice });
  const key = (code, n = 1) => { for (let i = 0; i < n; i++) w.input(code); };
  key('Enter'); key('KeyM'); key('Enter'); key('Enter');
  for (const c of 'KeyM KeyA KeyC'.split(' ')) w.input(c);
  key('Enter'); key('Enter');
  key('Equal', 6); key('Enter');
  key('Equal', 6); key('ArrowDown', 3);
  key('Equal', 6); key('ArrowDown', 3);
  key('Equal', 6); key('Enter');
  key('Enter'); key('Enter');   // reflexes, summary -> the door's questions
  return { w, result: () => result };
}

test('START2 the chargen door asks where the story begins LAST, after every other question, in the one overlay - and only a host that can stand a start past the Bay asks; one start open is no choice (mutants: the question unasked, asked first, asked of a host with the Bay alone)', () => {
  const { w, result } = madeTo({ open: () => true });
  for (let i = 0; i < 4 && !(w.levelingPrompt instanceof StartChoiceScreen); i++) w.input('Enter');   // the leveling and the lineage questions, where they are put
  assert.ok(w.levelingPrompt instanceof StartChoiceScreen, 'the start page, last');
  assert.equal(w.done, false);
  assert.equal(w.levelingPrompt.options[w.levelingPrompt.cursor].id, 'IliacBay', 'the walk\'s Breton: the Bay first');
  w.input('char:4');
  assert.equal(w.done, true);
  assert.equal(result().startKey, 'Imperial', 'the answer rides the result');
  // a host with no land past the Bay, or with every province shut: no page
  for (const startChoice of [null, { open: () => false }]) {
    const other = madeTo(startChoice);
    for (let i = 0; i < 4 && !other.w.done; i++) {
      assert.ok(!(other.w.levelingPrompt instanceof StartChoiceScreen));
      other.w.input('Enter');
    }
    assert.equal(other.w.done, true);
    assert.equal(other.result().startKey, undefined);
  }
  // torn down mid-question: the homeland's start, as every question's default
  const torn = madeTo({ open: () => true });
  for (let i = 0; i < 4 && !(torn.w.levelingPrompt instanceof StartChoiceScreen); i++) torn.w.input('Enter');
  torn.w.dispose();
  assert.equal(torn.result().startKey, 'IliacBay');
});

// ── the sea lanes ────────────────────────────────────────────────

test('START2 LONG-VOYAGE (travelRoute.js planSeaLanes): a booked voyage whose port lies past the Bay\'s table sails round the land the box planner cannot leave its bounds to pass - from her helm, every step a boat\'s, ashore only at her port; another boat\'s crossing takes the lanes only where the box found none; a traveller ashore never (mutants: the lanes unasked, a step through a corner, the landfall anywhere)', () => {
  // a sea with one wall of land from y -250 south past the table's foot, a harbor isle at the port, the ship north-east
  const wall = (x, y) => x >= 600 && x <= 640 && y >= -250 && y <= 2000;   // the south shut past the lanes' own box
  const isle = (x, y) => Math.abs(x - 200) <= 1 && Math.abs(y - 200) <= 1;
  const isWater = (x, y) => !wall(x, y) && !isle(x, y);
  const from = { x: 1500, y: -100 }, to = { x: 200, y: 200 };
  const voyage = { start: 'sea', goal: 'land', voyage: true, again: false };
  assert.equal(planRoute(from, to, { isWater, sea: voyage, lanes: false, margins: [6, 20, 60] }), null, 'the box\'s own rungs find none');
  const plan = planRoute(from, to, { isWater, sea: voyage });
  assert.ok(plan, 'the lanes do');
  assert.deepEqual(plan.pixels[0], from);
  assert.deepEqual(plan.pixels.at(-1), to);
  assert.equal(plan.kinds.length, plan.pixels.length - 1);
  assert.ok(Math.min(...plan.pixels.map((p) => p.y)) < -250, 'round the wall\'s north end, past the box\'s bounds (the map and its two ends: y -100 at the least)');
  // PIN MOVED (SEA-TAUT, Field-Bugs-2026-10-29g): a sailed step is a straight run over open water - each pixel of its line
  // a boat's step - and every other step one pixel
  for (let i = 1; i < plan.pixels.length; i++) {
    const a = plan.pixels[i - 1], b = plan.pixels[i];
    if (plan.kinds[i - 1] !== 'sea') { assert.ok(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) === 1, 'one pixel a step'); continue; }
    let { x, y } = a;
    const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y), sx = a.x < b.x ? 1 : -1, sy = a.y < b.y ? 1 : -1;
    for (let err = dx - dy; x !== b.x || y !== b.y;) {
      const px = x, py = y, e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
      assert.ok(isWater(x, y), 'sailed on water');
      assert.ok(px === x || py === y || isWater(x, py) || isWater(px, y), 'never through a corner of the land');
    }
  }
  const fall = plan.kinds.indexOf('landfall');
  assert.ok(fall > 0 && plan.kinds.slice(0, fall).every((k) => k === 'sea'), 'sailed all the way');
  assert.ok(plan.kinds.slice(fall + 1).every((k) => ['road', 'track', 'open'].includes(k)), 'ashore once, then walked');
  const ashoreAt = plan.pixels[fall];
  assert.ok(Math.max(Math.abs(ashoreAt.x - to.x), Math.abs(ashoreAt.y - to.y)) <= 3);
  // a boat of my own at her helm: the box first, the lanes when it finds none
  const mine = planRoute(from, to, { isWater, sea: { start: 'sea', goal: 'land', again: false }, margins: [6, 20, 60] });
  assert.ok(mine && mine.kinds.includes('landfall'));
  assert.equal(planSeaLanes(from, to, { isWater, sea: { start: 'land', goal: 'land' } }), null, 'ashore with a boat to hand: never the lanes');
  assert.equal(planSeaLanes(from, { x: 620, y: 0 }, { isWater, sea: voyage }), null, 'a port with no water about it');
  assert.ok(LANE_MARGIN > 250 && LANE_CELL === 8);
});

// ── the game's own Tamriel ───────────────────────────────────────

const ARENA2 = process.env.ARENA2_PATH;
/** PIN MOVED (PLAN-SLICES): the most cells a voyage's plan spends (its floods, its lanes and its landfall - travelRoute.js `tally`). */
const VOYAGE_CELLS_MAX = 450000;   // measured 392,822 and 393,363 (the two floods and the lanes): some twenty frames at PLAN_FRAME_CELLS
const HAVE = !!ARENA2 && ['MAPS.BSA', 'BLOCKS.BSA', 'WOODS.WLD', 'TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL'].every((f) => existsSync(join(ARENA2, f)));
const skipReal = HAVE ? false : 'ARENA2_PATH not set or missing - real-data validation skipped';

/** The freeware's Tamriel as the world host reads it: the trace at its fit, the ground past the Bay, the lairs' rows,
 *  rates and blocks, and the host's own place module over them (scenes/tamrielPlacesHost.js). */
async function realTamriel() {
  const { DFPalette } = await import('../../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../../src/ui/tamrielTrace.js');
  const { setTamrielTrace } = await import('../../../src/world/tamriel/tamrielLand.js');
  const { setTamrielFit } = await import('../../../src/world/tamriel/tamrielFrame.js');
  const { WoodsFile } = await import('../../../src/formats/woodsFile.js');
  const { groundWoods, groundMaps } = await import('../../../src/world/tamriel/tamrielGround.js');
  const { countryCounts, countryTemplates } = await import('../../../src/world/tamrielCountry.js');
  const { lairTemplates, lairPools } = await import('../../../src/world/tamrielDungeons.js');
  const { isMainStoryDungeon } = await import('../../../src/world/dungeon/dungeonTextures.js');
  const { createTamrielPlaces } = await import('../../../src/scenes/tamrielPlacesHost.js');
  const { loadMaps, loadBlocks } = await import('../../arena1Data.mjs');
  const fb = async (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const pal = new DFPalette(); pal.load(await fb('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: fb, palette: pal }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });   // the freeware's fit (test/ui/tamriel4.test.js)
  const maps = loadMaps(), blocks = loadBlocks();
  const bayClimate = maps.getClimateIndex.bind(maps);
  const rows = [];
  for (let r = 0; r < maps.regionCount; r++) { const reg = maps.getRegion(r); if (reg) for (let l = 0; l < reg.locationCount; l++) { const loc = maps.getLocation(r, l); if (loc) rows.push(loc); } }
  const _countryTemplates = countryTemplates(rows, isMainStoryDungeon);   // the lairs stand under the countryside's door (world.js)
  const _countryCounts = countryCounts(_countryTemplates, bayClimate);
  const _lairTemplates = lairTemplates(rows, isMainStoryDungeon);
  const _lairCounts = countryCounts(_lairTemplates, bayClimate);
  // AUDIT TAMRIEL-WIDE D-test: composed as world.js composes it - the climate AND the politic (WW-R's), so a lair past the
  // Bay carries its province's region; the climate alone left every lair in region 0
  groundMaps(maps);
  const w = new WoodsFile(); w.load(await fb('WOODS.WLD'));
  const woods = groundWoods(w);
  const locationIndex = new Map();
  let gen = 0;
  const places = createTamrielPlaces({
    _arenaTemplates: null, _capitalBase: null, _capitalNames: null, _countryCounts, _countryTemplates, _lairCounts, _lairPools: lairPools(_lairTemplates),
    _lairTemplates, arenaJoinLand: null, arenaRoadsLanded: null, blocks, locationIndex, maps, tamrielLand: null, terrainGen: null, woodsBytes: null,
    get _locIndexGen() { return gen; }, set _locIndexGen(v) { gen = v; }, get woods() { return woods; },
  });
  return { places, blocks, maps, woods, w, locationIndex, reset: () => { setTamrielTrace(null); setTamrielFit(null); } };
}

test('START2 on the freeware\'s Tamriel: every province\'s start dungeon is a lair of a kind its story wants, in its own province and its province\'s region, within 35 pixels of its capital, a quest item\'s marker in it, stood in the world\'s index as its pixel\'s build stands it (mutants: the marker\'s weighing, the want order; AUDIT TAMRIEL-WIDE: the politic uncomposed)', { skip: skipReal }, async () => {
  const t = await realTamriel();
  try {
    const { provinceKeyBeyondBay } = await import('../../../src/world/tamriel/tamrielLand.js');
    const { capitalPixel } = await import('../../../src/world/tamrielCapitals.js');
    const { longitudeLatitudeToMapPixel } = await import('../../../src/formats/mapsFile.js');
    const { tamrielFrameInBay } = await import('../../../src/world/tamriel/tamrielFrame.js');
    const usable = (l) => dungeonItemMarkerCount((n) => t.blocks.getBlockByName(n), l) > 0;
    const regions = {};
    for (const start of STARTS.slice(1)) {
      const loc = t.places.startLairAt(start, usable);
      if (loc) regions[start.key] = loc.regionIndex;
      assert.ok(loc, `${start.key}: a dungeon`);
      const p = longitudeLatitudeToMapPixel(loc.mapTableData.longitude, loc.mapTableData.latitude);
      const centre = capitalPixel(CAPITALS.find((c) => c.key === start.capital));
      const d = Math.hypot(p.x - centre.px, p.y - centre.py);
      assert.ok(d >= START_SITE_MIN && d <= 35, `${start.key}: ${d.toFixed(1)} pixels from its capital`);
      assert.equal(provinceKeyBeyondBay(p.x, p.y), start.province);
      // START3: its site keeps that pixel, off the Bay's table, inside the continent's frame the held map reads marks over
      assert.deepEqual(siteWorldPixel(loc), { x: p.x, y: p.y }, `${start.key}: the site's own pixel`);
      const f = tamrielFrameInBay();
      assert.ok(p.x >= f.x0 && p.y >= f.y0 && p.x < f.x0 + f.w && p.y < f.y0 + f.h, `${start.key}: inside the continent's frame`);
      // a kind its story wants - the first, but for the Imperial City's: IC-RING stood the city in the middle of Lake
      // Rumare's ring, and no labyrinth that is a prison stands within reach of it there; its keep that is one does
      const want = start.lair.findIndex((k) => wantMatches(k, loc.mapTableData.locationType, loc.mapTableData.dungeonType));
      assert.equal(want, start.key === 'Imperial' ? 1 : 0, `${start.key}: the kind its story wants (${loc.name})`);
      assert.ok(usable(loc) && loc.country?.dungeon && loc.hasDungeon, 'a lair with a quest item\'s marker');
      assert.equal(t.locationIndex.get(`${p.x},${p.y}`), loc, 'stood in the index');
      assert.equal(t.places.lairLocationAt(p.x, p.y), loc, 'the one the pixel\'s build stands');
      assert.equal(t.places.startLairAt(start, usable), loc, 'and the same asked again');
    }
    // AUDIT TAMRIEL-WIDE D-test: each lair stands in its province's region (WW-R's 62..70), never the Bay's 0, measured
    assert.deepEqual(regions, { Skyrim: 64, Morrowind: 65, Imperial: 70, BlackMarsh: 69, Elsweyr: 68, Valenwood: 67, Sumurset: 66 });
    // a graveyard is never a start's: Solitude's nearest lairs are cemeteries, marker-free - a story that wanted one first
    // is given the next kind it wants
    const graves = { ...startByKey('Skyrim'), lair: [['Graveyard', 'Cemetery'], ['DungeonLabyrinth', 'VampireHaunt']] };
    const taken = t.places.startLairAt(graves, usable);
    assert.equal(taken.mapTableData.locationType, LOCATION_TYPES.DungeonLabyrinth, `not a graveyard (${taken.name})`);
    assert.ok(usable(taken));
  } finally { t.reset(); }
});

test('START2 on the freeware\'s Tamriel: a voyage from every port past the Bay to the city of Daggerfall sails the lanes - its port reached, ashore only there, each planned in under three seconds (mutants: the lanes\' margin, the floods)', { skip: skipReal }, async () => {
  const t = await realTamriel();
  try {
    const { routeGround } = await import('../../../src/systems/travel/travelRoute.js');
    const { WATER_BYTE } = await import('../../../src/world/roadsProducer.js');
    const { longitudeLatitudeToMapPixel } = await import('../../../src/formats/mapsFile.js');
    const { arenaPixels, setArenaStanding } = await import('../../../src/world/arenaPlaces.js');
    setArenaStanding(true);
    try {
      const rg = routeGround(t.maps.getClimateIndex, (x, y) => t.w.getHeightMapValue(x, y), WATER_BYTE, 1000, 500, (x, y) => t.woods.getHeightMapValue(x, y) > WATER_BYTE);
      const df = t.maps.getLocationByName('Daggerfall', 'Daggerfall');
      const dp = longitudeLatitudeToMapPixel(df.mapTableData.longitude, df.mapTableData.latitude);
      const voyage = { start: 'sea', goal: 'land', voyage: true, again: false };
      // every port past the Bay - the provinces' starts' ways home among them - from the water about it a voyage reaches
      const ports = arenaPixels().stood.filter((p) => p.port);
      assert.equal(ports.length, 35, 'TESA12\'s 28 ports and COAST-PORT\'s seven');   // PIN MOVED (FIELD BUGS 2026-10-28b COAST-PORT)
      let most = 0;   // PIN MOVED (PLAN-SLICES): a plan's cells, an op count, never a clock (a flake on a shared runner)
      for (const p of ports) {
        let routed = null;
        for (let dy = -3; dy <= 3 && !routed; dy++) for (let dx = -3; dx <= 3 && !routed; dx++) {
          const f = { x: p.bx + dx, y: p.by + dy };
          if (!rg.isWater(f.x, f.y)) continue;
          const tally = { n: 0 };
          const plan = planRoute(f, dp, { ...rg, sea: voyage, tally });
          most = Math.max(most, tally.n);
          if (plan) routed = plan;
        }
        assert.ok(routed, `${p.province} ${p.name}: a voyage to Daggerfall`);
        assert.deepEqual(routed.pixels.at(-1), dp, `${p.name}: ashore at Daggerfall`);
        const fall = routed.kinds.indexOf('landfall');
        assert.ok(fall > 0 && routed.kinds.slice(0, fall).every((k) => k === 'sea') && !routed.kinds.slice(fall + 1).some((k) => k === 'sea' || k === 'landfall'), `${p.name}: sailed, then ashore once`);
      }
      assert.ok(STARTS.slice(1).filter((s) => s.key !== 'Imperial').every((s) => ports.some((p) => p.province === s.province)), 'every province start but the Imperial Province\'s has a port of its own');
      assert.ok(most <= VOYAGE_CELLS_MAX, `the largest plan ${most} cells`);
    } finally { setArenaStanding(false); }
  } finally { t.reset(); }
});

test('START2 on the freeware: the start page\'s classic face fits the native screen in FONT0003 - each row within the list\'s band, each start\'s story within its four lines', { skip: skipReal }, async () => {
  const { FntFile } = await import('../../../src/formats/fntFile.js');
  const { measureText } = await import('../../../src/ui/text.js');
  const fnt = new FntFile(); fnt.load(new Uint8Array(readFileSync(join(ARENA2, 'FONT0003.FNT'))));
  const measure = (s) => measureText(fnt, s);
  const screen = new StartChoiceScreen(() => {}, { race: 'Nord', open: (s) => s.key !== 'Elsweyr' });
  screen.options.forEach((o, i) => {
    const tag = o.locked ? ` - ${o.lockNote}` : o.homeland ? ` (${START_CHOICE_TEXT.homeland})` : '';
    assert.ok(START_X0 + measure(`> ${i + 1}. ${o.title}${tag}`) <= START_X1, `${o.id}'s row`);
    assert.ok(measure(o.where) <= START_BODY_W, `${o.id}'s where`);
    assert.ok(wrapToWidth(o.body, START_BODY_W, measure).length <= START_BODY_LINES, `${o.id}'s story in ${START_BODY_LINES} lines`);
  });
  assert.ok(wrapToWidth(START_CHOICE_TEXT.lead, START_BODY_W, measure).length <= START_LEAD_LINES, 'the lead in its three');
  assert.ok(measure(START_CHOICE_TEXT.hint(STARTS.length)) <= 320);
});

// ── the hosts' wiring ────────────────────────────────────────────

test('START2 the world host wires the start host (scenes/startsHost.js) and grows no logic of its own: the page through the chargen door, the answer into its OnStartGame, the quests and the welcome once the character stands where their story begins, a birth online after it, the quest layer\'s start seam, and the writ at the passage; the fixed city\'s bench hands the commission (mutants: each line)', () => {
  const W = hostText('src/scenes/world.js');
  assert.match(W, /const starts = createStartsHost\(\{ params, pastBay: !!_lairTemplates, quests: \(\) => questWorld,\n\s+teleport: _teleportToPixel, landReady: arenaTraced, talk: townTalk, machine: \(\) => questBridge\?\.machine, ready: _worldReady \}\);/);   // PIN MOVED (AUDIT BAY-LEFT, its packages merged): world.js's one readiness, the homes' sweep's and the start's too
  assert.match(W, /starts\.begin\(\(start\) => \{ questBridge\.initAtGameStart\(start\); startTutorialTour\(\); \}, startKey\);/);
  assert.match(W, /if \(!questBridge\) \{ _questStartPending = startKey \?\? true; return; \}/, 'the answer kept while the bridge is still to come');
  assert.match(W, /if \(_questStartPending\) questInitAtGameStart\(_questStartPending\);/, 'and handed on when it comes');
  assert.match(W, /startChoice: starts\.page,/);
  assert.match(W, /questInitAtGameStart\(r\.startKey\);/);
  assert.match(W, /if \(realmNew\) starts\.settled\.then\(realmBirth\)\.catch\(/);
  assert.match(W, /writ: starts\.writ \}\);/);
  assert.match(W, /lairLocationAt, nearestTownOf, provinceQuestPlaces, tamrielPlaceName \} = createTamrielPlaces\(/);   // PIN MOVED (TESA x AUDIT TESA II): P2's nearest town beside it; PIN MOVED (AUDIT RELEASE R2-5): the start lair rides the places past the Bay
  assert.match(W, /playerTravelPixel, provinceQuestPlaces, questSiteMovedHere, talkBuildingCompassDirection/);   // PIN MOVED (AUDIT RELEASE R2-5)
  assert.match(rd('src/scenes/tamrielPlacesHost.js'), /refresh: registerTamrielPlaces, startLairAt,/);
  assert.match(rd('src/scenes/questWorld.js'), /const startLairAt = provinceQuestPlaces\?\.startLairAt;/);   // PIN MOVED (AUDIT RELEASE R2-5, hostseam): the places' own, no host read the game never hands
  const Q = rd('src/scenes/questWorld.js');
  assert.match(Q, /startSiteOfId: \(id\) => \{\n\s+const start = startOfSiteId\(id\);\n\s+const loc = start \? startLairAt\?\.\(start, \(l\) => dungeonItemMarkerCount\(\(name\) => blocks\.getBlockByName\(name\), questSized\(l\)\) > 0\) : null;\n\s+return loc \? questSized\(loc\) : null;/);
  assert.match(rd('src/scenes/exterior.js'), /questBridge\.initAtGameStart\(HAND_START_QUEST\);/);
  assert.match(rd('src/systems/quest/place.js'), /let location = start \? world\.startSiteOfId\?\.\(this\.p1\) \?\? null : findQuestLocation\(world\.maps, this\.p1\);/);
});
