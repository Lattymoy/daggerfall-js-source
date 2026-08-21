// Q3-ii - PERSON WORLD BINDING: Person.cs's Setup*NPC chain over a
// crafted world seam with a persistent-faction-store mock - the
// identification ladder (named/group/factionType/faction), the
// Questor arm off the machine's last-clicked NPC (which brings the
// audit-III addResource auto-track LIVE), the career and faction-type
// mappings against the vendored Quests-Factions table, the Assign*
// chain in C#'s order (race bank, gender, the HUD-face quirk, the
// display name through classic srand, home-town generation), and the
// three unblocked actions: ChangeReputeWith (the propagating
// overload), ReputeExceedsDo, CreateNpc/PlaceAtHome.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadQuestTables } from '../src/systems/quest/tables.js';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { SITE_TYPES } from '../src/systems/quest/place.js';
import { GENDERS } from '../src/characters/nameHelper.js';
import { mapPixelToWorldCoord } from '../src/formats/mapsFile.js';

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'dfu-quests');
const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');

function loadTables() {
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) {
    if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = read(join(VENDOR, 'Tables', f));
  }
  loadQuestTables(sources);
}
loadTables();

// ---- the crafted world: one town with a marker'd store + a faction store ----

const flat = (record, x = 40, y = 8, z = 60) => ({ textureArchive: 199, textureRecord: record, xPos: x, yPos: y, zPos: z });
const building = (buildingType, { factionId = 0, nameSeed = 777 } = {}) =>
  ({ buildingType, factionId, nameSeed, locationId: 0, sector: 0, quality: 9 });

const FACTIONS = new Map([
  [364, { id: 364, type: 4, name: 'King Gothryd', race: 3, region: 17 }],   // Individual
  [9, { id: 9, type: 0, name: 'Sheogorath', race: -1 }],                     // Daedra
  [510, { id: 510, type: 2, name: 'The Merchants', race: -1 }],
  [40, { id: 40, type: 2, name: 'The Mages Guild', race: -1 }],
  [82, { id: 82, type: 9, name: 'Akatosh', race: -1 }],
  [450, { id: 450, type: 9, name: 'Generic Temple', race: -1 }],
  [242, { id: 242, type: 2, name: 'Nobles', race: -1 }],
  [201, { id: 201, type: 15, name: 'People of Testshire', race: -1 }],
  [867, { id: 867, type: 14, name: 'Court of Testshire', race: -1 }],
]);

function makeWorld() {
  const townBuildings = [building(15), building(17), building(9)];
  const townInteriors = [[flat(11), flat(18)], [flat(11)], [flat(18)]];
  const townExterior = [building(15), building(9)];
  const block = {
    position: 5000,
    rmbBlock: {
      fldHeader: { buildingDataList: townBuildings, otherNames: null },
      subRecords: townBuildings.map((_, i) => ({ interior: { blockFlatObjectRecords: townInteriors[i] ?? [] } })),
    },
  };
  const world0 = mapPixelToWorldCoord(100, 100);
  const town = {
    loaded: true, regionIndex: 0, regionName: 'Testshire', name: 'Bigtown', locationIndex: 0,
    hasDungeon: false, mapTableData: { mapId: 111, locationType: 0, dungeonType: -1 },
    exterior: {
      buildings: townExterior,
      recordElement: { header: { x: world0.x, y: world0.y } },
      exteriorData: { locationId: 0x400, width: 1, height: 1, blockNames: ['TESTAA00.RMB'] },
    },
    dungeon: null,
  };
  const region = { name: 'Testshire', locationCount: 1, mapTable: [{ mapId: 111, locationType: 0, dungeonType: -1 }] };
  const world = {
    maps: {
      regionCount: 1,
      getRegion: () => region,
      getLocation: () => town,
      getLocationByName: () => town,
      getRmbBlockName: () => 'TESTAA00.RMB',
      readLocationIdFast: () => 0x400,
      getClimateIndex: () => 231,
    },
    getBlock: () => block,
    currentLocation: () => town,
    currentRegionIndex: () => 0,
    currentLocationIndex: () => 0,
    isPlayerInLocationRect: () => true,
    playerInside: () => world._inside,
    isHouseOwned: () => false,
    playerPixel: () => ({ x: 100, y: 100 }),
    buildingNameOpts: () => ({}),
    getFactionData: (id) => FACTIONS.get(id) ?? null,
    findFactionsOfType: (t) => [...FACTIONS.values()].filter((f) => f.type === t),
    currentRegionPeople: () => 201,
    currentRegionCourt: () => 867,
    currentRegionFaction: () => 201,
    currentRegionRace: () => 3,
    _inside: null,
  };
  return world;
}

function makeMachine(world, deps = {}) {
  const calls = [];
  const capture = (name) => (...args) => calls.push([name, ...args]);
  const m = new QuestMachine({
    nowSeconds: () => 0,
    world,
    changeReputation: capture('changeReputation'),
    getReputation: (fid) => { calls.push(['getReputation', fid]); return m.rep; },
    lastNPCClicked: () => m.clicked,
    ...deps,
  });
  m.rep = 0;
  m.clicked = null;
  m.calls = calls;
  m.of = (name) => calls.filter((c) => c[0] === name);
  return m;
}

const HEADER = ['Quest: __QN', 'QRC:', 'Message:  1011', ' x', '', 'QBN:'];
const schedule = (m, qbn, { rolls = () => 0.4 } = {}) => m.scheduleQuest([...HEADER, ...qbn], 0, { rolls });

// ---------------------------------------------------------------

test('named individual: faction identity, display name from the record, NO generated home', () => {
  const m = makeMachine(makeWorld());
  const q = schedule(m, ['Person _king_ named King_Gothryd', '', 'variable _pad_']);
  const p = q.getResource({ name: 'king' });
  assert.equal(p.npcPending, false);
  assert.equal(p.isIndividualNPC, true);
  assert.equal(p.factionId, 364, 'Quests-Factions p3 for King_Gothryd');
  assert.equal(p.displayName, 'King Gothryd', 'an Individual reads the faction record NAME');
  assert.equal(p.homePlaceSymbol, null, 'individuals get no generated home');
  assert.equal(p.factionRace, 3, "the record's race rides through");
});

test('a Daedra named NPC binds like an individual; a non-individual named target THROWS', () => {
  const m = makeMachine(makeWorld());
  const q = schedule(m, ['Person _mad_ named Sheogorath', '', 'variable _pad_']);
  assert.equal(q.getResource({ name: 'mad' }).displayName, 'Sheogorath');
  // The_Fighters_Guild resolves to faction 41 - not in the store, so
  // GetFactionData throws and the quest fails to compile (verbatim)
  const m2 = makeMachine(makeWorld());
  assert.throws(() => schedule(m2, ['Person _x_ named The_Fighters_Guild', '', 'variable _pad_']),
    /Could not find faction data for FactionID 41/);
});

test('group Questor + a clicked NPC: the questor binds and the audit-III auto-track goes LIVE', () => {
  const m = makeMachine(makeWorld());
  m.clicked = { factionID: 510, nameSeed: 4242, gender: GENDERS.Female };
  const q = schedule(m, ['Person _qgiver_ group Questor', '', 'variable _pad_']);
  const p = q.getResource({ name: 'qgiver' });
  assert.equal(p.isQuestor, true);
  assert.equal(p.factionId, 510);
  assert.equal(p.nameSeed, 4242, "the clicked NPC's name seed");
  assert.equal(p.npcGender, GENDERS.Female, 'questors keep the clicked gender - AssignGender skips them');
  assert.ok(p.displayName.length > 0, 'the display name drew through srand(nameSeed)');
  // Quest.cs:879-881, live at last: the incoming questor auto-tracks
  assert.equal(q.questors.has('qgiver'), true);
  // the questor home configures from the player location (a Town here)
  const home = q.getPlace(p.homePlaceSymbol);
  assert.equal(home.siteDetails.siteType, SITE_TYPES.Town);
  assert.equal(home.siteDetails.locationName, 'Bigtown');
});

test('group Questor with NOTHING clicked: the virtual-NPC fallback goes through the career table to the regional people', () => {
  const m = makeMachine(makeWorld());
  const q = schedule(m, ['Person _qgiver_ group Questor', '', 'variable _pad_']);
  const p = q.getResource({ name: 'qgiver' });
  assert.equal(p.isQuestor, false, 'no click, no questor - the quest still compiles');
  assert.equal(p.factionId, 201, "the Questor row's careerID 21 falls to GetPeopleOfCurrentRegion");
});

test('the career mapping: Chemist->Merchants, Spellcaster->Mages, Cleric->Generic Temple, Noble->Nobles', () => {
  // One machine per person: every career home here falls back to the
  // mock town's single house, and the same-quest assigned-building
  // exclusion (pinned in questplaces) forbids two Places sharing it.
  const cases = [['Chemist', 510], ['Spellcaster', 40], ['Cleric', 450], ['Noble', 242]];
  for (const [career, factionId] of cases) {
    const m = makeMachine(makeWorld());
    const q = schedule(m, [`Person _a_ group ${career}`, '', 'variable _pad_']);
    const p = q.getResource({ name: 'a' });
    assert.equal(p.factionId, factionId, career);
    // a career person's display name comes from the name banks
    assert.ok(p.displayName.length > 0, `${career} display name`);
  }
});

test('factionType arms: Temple draws a random temple EXCLUDING 450; Court reads the region court', () => {
  const m1 = makeMachine(makeWorld());
  const q1 = schedule(m1, ['Person _t_ factionType Temple', '', 'variable _pad_']);
  assert.equal(q1.getResource({ name: 't' }).factionId, 82, 'the only non-450 temple in the store');
  const m2 = makeMachine(makeWorld());
  const q2 = schedule(m2, ['Person _crt_ factionType Court', '', 'variable _pad_']);
  assert.equal(q2.getResource({ name: 'crt' }).factionId, 867);
});

test('home generation: the faction row picks the building type (Shopkeeper p2=9 -> generalstore), local by the roll', () => {
  const m = makeMachine(makeWorld());
  const q = schedule(m, ['Person _shop_ group Shopkeeper', '', 'variable _pad_'], { rolls: () => 0.4 });
  const p = q.getResource({ name: 'shop' });
  const home = q.getPlace(p.homePlaceSymbol);
  assert.ok(home, 'the home Place was added to the quest');
  assert.equal(home.symbol.name, 'shop_home', '_%name%_home_');
  assert.equal(home.siteDetails.siteType, SITE_TYPES.Building);
  assert.equal(home.siteDetails.buildingKey, 2, 'the generalstore record (getKeyForValue p2=9), locally scoped at roll<0.5');
});

test('the HUD-face quirk and the gender roll ride the injectable rolls', () => {
  const m = makeMachine(makeWorld());
  const q = schedule(m, ['Person _pp_ face 7 group Chemist', '', 'variable _pad_'], { rolls: () => 0.4 });
  const p = q.getResource({ name: 'pp' });
  assert.equal(p.faceIndex, 4, 'the PARSED face 7 is IGNORED - AssignHUDFace always rolls Range(0,10)');
  assert.equal(p.npcGender, GENDERS.Male, 'roll 0.4 < 0.5 is Male');
});

test('ChangeReputeWith moves the person faction through the PROPAGATING overload; missing person completes silently', () => {
  const m = makeMachine(makeWorld());
  const q = schedule(m, [
    'Person _pp_ group Chemist', '',
    ' change repute with _pp_ by -20',
    ' change repute with _ghost_ by +5',
  ]);
  m.tick();
  assert.deepEqual(m.of('changeReputation'), [['changeReputation', 510, -20, true]]);
  const startup = [...q.tasks.values()][0];
  assert.equal(startup.actions.every((a) => a.isComplete), true, 'the missing-person arm completes without a call');
});

test('ReputeExceedsDo waits at the bar and fires once reputation reaches it', () => {
  const m = makeMachine(makeWorld());
  const q = schedule(m, [
    'Person _pp_ group Chemist', '',
    ' repute with _pp_ exceeds 10 do _liked_', '',
    'variable _liked_',
  ]);
  m.rep = 5;
  m.tick(); m.tick();
  assert.equal(q.getTask({ name: 'liked' }).getTriggerValue(), false, 'below the bar it keeps checking');
  m.rep = 10;
  m.tick();
  assert.equal(q.getTask({ name: 'liked' }).getTriggerValue(), true, 'reaching the bar starts the task (>= in effect: NOT < min)');
});

test('CreateNpc places the person at home (SiteLink + marker); questors refuse PlaceAtHome', () => {
  const m = makeMachine(makeWorld());
  const q = schedule(m, [
    'Person _shop_ group Shopkeeper', '',
    ' create npc _shop_',
  ], { rolls: () => 0.4 });
  m.tick();
  const p = q.getResource({ name: 'shop' });
  const home = q.getPlace(p.homePlaceSymbol);
  assert.equal(p.assignedToHome, true);
  assert.equal(p.assignedPlaceSymbol.name, home.symbol.name);
  assert.deepEqual(home.siteDetails.selectedMarker.targetResources.map((s) => s.name), ['shop']);
  assert.equal(m.siteLinks.length, 1);

  // a questor never places at home
  const m2 = makeMachine(makeWorld());
  m2.clicked = { factionID: 510, nameSeed: 1, gender: GENDERS.Male };
  const q2 = schedule(m2, ['Person _qg_ group Questor', '', ' create npc _qg_']);
  m2.tick();
  assert.equal(q2.getResource({ name: 'qg' }).assignedToHome, false);
});

test('HEADLESS: with no world seam the chain pends LOUDLY and the corpus parse stands', () => {
  const m = new QuestMachine({ nowSeconds: () => 0 });
  const q = m.scheduleQuest([...HEADER, 'Person _pp_ group Chemist', '', 'variable _pad_'], 0, { rolls: () => 0 });
  const p = q.getResource({ name: 'pp' });
  assert.equal(p.npcPending, true);
  assert.equal(p.displayName, '');
  assert.equal(p.factionData, null);
});
