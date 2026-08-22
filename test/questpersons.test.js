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
import { SITE_TYPES, Scopes } from '../src/systems/quest/place.js';
import { Table } from '../src/systems/quest/table.js';
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
  [304, { id: 304, type: 4, name: 'Skakmat', race: 11 }],                    // Individual with the oddball race
  [9, { id: 9, type: 0, name: 'Sheogorath', race: -1 }],                     // Daedra
  [26, { id: 26, type: 1, name: 'Akatosh the God', race: -1 }],              // God
  [510, { id: 510, type: 2, name: 'The Merchants', race: -1 }],
  [40, { id: 40, type: 2, name: 'The Mages Guild', race: -1 }],
  [42, { id: 42, type: 13, name: 'The Thieves Guild', race: -1 }],
  [82, { id: 82, type: 9, name: 'Akatosh', race: -1 }],
  [150, { id: 150, type: 6, name: 'The Vraseth', race: -1 }],                // VampireClan (the player's)
  [158, { id: 158, type: 6, name: 'The Selenu', race: -1 }],                 // VampireClan (the region's)
  [411, { id: 411, type: 10, name: 'The Host of the Horn', race: -1 }],      // KnightlyGuard
  [429, { id: 429, type: 8, name: 'The Beldama', race: -1 }],                // WitchesCoven
  [450, { id: 450, type: 9, name: 'Generic Temple', race: -1 }],
  [512, { id: 512, type: 2, name: 'The Prostitutes', race: -1 }],
  [242, { id: 242, type: 2, name: 'Nobles', race: -1 }],
  [844, { id: 844, type: 12, name: 'Generic Knightly Order', race: -1 }],
  [201, { id: 201, type: 15, name: 'People of Testshire', race: -1 }],
  [867, { id: 867, type: 14, name: 'Court of Testshire', race: -1 }],
]);

function makeWorld({ buildings = null, interiors = null, unloadedCurrent = false } = {}) {
  const townBuildings = buildings ?? [building(15), building(17), building(9)];
  const townInteriors = interiors ?? [[flat(11), flat(18)], [flat(11)], [flat(18)]];
  const townExterior = buildings ? townBuildings : [building(15), building(9)];
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
    currentRegionVampireClan: () => 158,
    playerVampireClan: () => 150,
    currentRegionRace: () => 3,   // GetRaceOfCurrentRegion is a RACES value - 3 is Nord
    _inside: null,
  };
  if (unloadedCurrent) world.currentLocation = () => ({ ...town, loaded: false });
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
  assert.equal(p.race, 1, "the record's race rides through - FactionRaces 3 is Races.Breton");
  assert.equal(p.factionRace, 3, 'and derives back to the record value for every mapped race');
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
  // the player-context site carries no building and no markers
  assert.equal(home.siteDetails.buildingKey, 0);
  assert.equal(home.siteDetails.magicNumberIndex, 0);
  assert.equal(home.siteDetails.questSpawnMarkers, null);
  assert.equal(home.sitePending, false);
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

  // a questor never places at home - and the refusal is CLEAN: the
  // quest survives the tick (a mutant that lets the questor through
  // either assigns the home or faults the quest on the markerless
  // player-context site, and a faulting quest is REMOVED)
  const m2 = makeMachine(makeWorld());
  m2.clicked = { factionID: 510, nameSeed: 1, gender: GENDERS.Male };
  const q2 = schedule(m2, ['Person _qg_ group Questor', '', ' create npc _qg_']);
  m2.tick();
  assert.equal(q2.getResource({ name: 'qg' }).assignedToHome, false);
  assert.equal(m2.quests.has(q2.uid), true, 'the refusing quest stays alive');

  // an individual atHome refuses the same way (Person.cs:414 guards
  // questor AND individual before any sitelink work; the dead
  // AssignHomeTown arm means there is no home place to refuse over)
  const m3 = makeMachine(makeWorld());
  const q3 = schedule(m3, ['Person _king_ named King_Gothryd atHome', '', ' create npc _king_']);
  m3.tick();
  assert.equal(q3.getResource({ name: 'king' }).homePlaceSymbol, null);
  assert.equal(q3.getResource({ name: 'king' }).assignedToHome, false);
  assert.equal(m3.quests.has(q3.uid), true);

  // HEADLESS create npc: no home place exists, PlaceAtHome refuses
  // without touching the null - the action still completes
  const m4 = new QuestMachine({ nowSeconds: () => 0 });
  const q4 = m4.scheduleQuest([...HEADER, 'Person _pp_ group Chemist', '', ' create npc _pp_'], 0, { rolls: () => 0.4 });
  m4.tick();
  assert.equal(m4.quests.has(q4.uid), true, 'the null-home refusal does not fault the quest');
  const startup4 = [...q4.tasks.values()][0];
  assert.equal(startup4.actions.every((a) => a.isComplete), true);
});

test('HEADLESS: with no world seam the chain pends LOUDLY and the corpus parse stands', () => {
  const m = new QuestMachine({ nowSeconds: () => 0 });
  const q = m.scheduleQuest([...HEADER, 'Person _pp_ group Chemist', '', 'variable _pad_'], 0, { rolls: () => 0 });
  const p = q.getResource({ name: 'pp' });
  assert.equal(p.npcPending, true);
  assert.equal(p.displayName, '');
  assert.equal(p.factionData, null);
  // the pending fields hold their C# defaults untouched
  assert.equal(p.factionId, 0, 'the getter answers the zero faction');
  assert.equal(p.faceIndex, -1);
  assert.equal(p.nameSeed, -1);
  assert.equal(p.factionRace, -1);
  assert.equal(p.isIndividualAtHome, false);
  assert.equal(p.homePlaceSymbol, null);
});

// ---- the Q3-ii VERIFY pins (QUEST AUDIT VI's mutation campaign) ----

test('a FAILED faction lookup binds the exact zero record; the Chemist row walks the p2 gate to the alchemist', () => {
  // faction Chemist -> Quests-Factions p3 = 0 -> the persistent store
  // has no faction 0 -> C#'s default struct stands in whole
  const world = makeWorld({
    buildings: [building(0), building(17)],            // an alchemist + a house
    interiors: [[flat(11), flat(18)], [flat(11)]],
  });
  const m = makeMachine(world);
  const q = schedule(m, ['Person _z_ faction Chemist', '', 'variable _pad_']);
  const p = q.getResource({ name: 'z' });
  assert.equal(p.factionId, 0);
  assert.deepEqual(p.factionData, {
    id: 0, parent: 0, type: 0, name: '', rep: 0, summon: 0, region: 0,
    power: 0, flags: 0, ruler: 0,
    ally1: 0, ally2: 0, ally3: 0, enemy1: 0, enemy2: 0, enemy3: 0,
    face: 0, race: 0, flat1: 0, flat2: 0, sgroup: 0, ggroup: 0,
    minf: 0, maxf: 0, vam: 0, rank: 0,
  }, "C#'s default FactionData struct, field for field - every int 0");
  // id 0 blocks the Individual/Daedra record-name arm (type 0 IS
  // Daedra) - the display name draws from the bank instead
  assert.ok(p.displayName.length > 0, 'the id!==0 gate keeps the name-bank draw');
  assert.equal(p.factionRace, 0, 'race 0 IS FactionRaces.Nord - a failed lookup yields a Nord, NOT the region race');
  // Chemist (0,0,0) passes the home gate: p2=0 -> placesTable key
  // 'alchemist' -> the type-0 building at block index 0 (the packed
  // key 0 reads as the 1<<24 directory sentinel)
  const home = q.getPlace(p.homePlaceSymbol);
  assert.equal(home.siteDetails.buildingKey, 1 << 24, 'the alchemist, not the house fallback');
});

test('the WHOLE career table: every Quests-Factions career row lands on its C# switch arm', () => {
  const CAREERS = {
    Chemist: 510, Group_1: 510, Armorer: 510, Banker: 510,
    Group_4: 201,   // C#'s switch SKIPS careerID 4 (case 3 jumps to case 5) - Group_4 falls to the region's People
    Bookseller: 510, Tailor: 510, Carpenter: 510, Jeweler: 510, Shopkeeper: 510,
    Librarian: 510, Spellcaster: 40, Pawnbroker: 510, Smith: 510, Cleric: 450,
    Innkeeper: 510, Noble: 242,
    Resident1: 201, Resident2: 201, Resident3: 201, Resident4: 201,   // 17-20 fall to the region's People
    Questor: 201,                                                     // 21 (virtual, nothing clicked)
  };
  for (const [career, factionId] of Object.entries(CAREERS)) {
    const m = makeMachine(makeWorld());
    const q = schedule(m, [`Person _a_ group ${career}`, '', 'variable _pad_']);
    assert.equal(q.getResource({ name: 'a' }).factionId, factionId, career);
  }
});

test('the factionType switch, arm by arm, over the persistent-store mock', () => {
  const one = (decl, rolls = () => 0.4) => {
    const m = makeMachine(makeWorld());
    return schedule(m, [`Person _x_ ${decl}`, '', 'variable _pad_']).getResource({ name: 'x' });
  };
  const at = (decl, roll) => {
    const m = makeMachine(makeWorld());
    return schedule(m, [`Person _x_ ${decl}`, '', 'variable _pad_'], { rolls: () => roll }).getResource({ name: 'x' });
  };
  assert.equal(one('factionType Daedra').factionId, 9, 'random Daedra draw');
  assert.equal(one('factionType God').factionId, 26, 'random God draw');
  assert.equal(one('factionType Person').factionId, 364, 'random Individual draw');
  const witch = one('factionType Witches_Coven');
  assert.equal(witch.factionId, 429, 'random WitchesCoven draw');
  assert.equal(witch.npcGender, GENDERS.Female, 'covens force Female');
  assert.equal(one('factionType Vampire_Clan').factionId, 158, "the region's vampire clan");
  assert.equal(one('factionType Province').factionId, 201, 'the region faction');
  assert.equal(one('factionType Knightly_Guard').factionId, 411, 'ORDERS sorted ascending, index 4 at roll 0.4');
  assert.equal(one('factionType Magic_User').factionId, 40, 'the Mages Guild hardcode');
  assert.equal(one('factionType Generic_Group').factionId, 450, 'roll < 0.5 answers 450');
  assert.equal(at('factionType Generic_Group local', 0.9).factionId, 844, 'roll >= 0.5 answers 844');
  assert.equal(one('factionType Thieves_Den').factionId, 42, 'the Thieves Guild hardcode');
  assert.equal(one('factionType People').factionId, 201, "the region's People");
  // the Faction row carries p3 = -1: C#'s KEPT BUG assigns the raw
  // Range(0,4) INDEX as the type - roll 0.4 draws 1 = God
  assert.equal(one('factionType Faction').factionId, 26, 'the -1 quirk lands on the God pool');
});

test('the negative-p2 careers read p3, and 10000 folds to 0 (the player-faction fold)', () => {
  const m = makeMachine(makeWorld());
  const q = schedule(m, ['Person _a_ group Local_4.10k', '', 'variable _pad_']);
  assert.equal(q.getResource({ name: 'a' }).factionId, 510, 'p2=-4 -> p3=10000 -> 0 -> Merchants');
});

test('missing table rows warn and fall through to the zero binding, never a throw', () => {
  for (const decl of ['named No_Such_Person', 'faction No_Such_Faction', 'factionType No_Such_Type', 'group No_Such_Career']) {
    const m = makeMachine(makeWorld());
    const q = schedule(m, [`Person _x_ ${decl}`, '', 'variable _pad_']);
    const p = q.getResource({ name: 'x' });
    assert.equal(p.factionId, 0, decl);
    assert.equal(p.npcPending, false, `${decl} still binds the rest of the chain`);
    assert.ok(p.displayName.length > 0, `${decl} draws a bank name`);
    assert.equal(p.race, 3, `${decl} zero record race 0 = Races.Nord, kept`);
    assert.equal(p.factionRace, 0, `${decl} and back to FactionRaces.Nord`);
  }
});

test('the race fold: only FactionRaces 0..7 map; Skakmat 11 falls through to the region', () => {
  // GetRaceFromFactionRace's switch has no arm for 11/17/18/19 - the
  // fall-through Races.None folds to the region race.
  //
  // AUDIT 24 (the seven-slice sweep): THE TWO ENUMS ARE NOT THE SAME
  // NUMBERS. AssignRace's fallback is GetRaceOfCurrentRegion(), a
  // RACES value, and the port used to store it straight into
  // factionRace, a FACTIONRACES field - so a region of Nords (Races 3)
  // produced FactionRaces 3, which is Breton. Every regionally-folded
  // Person carried a race that named someone else. `race` is C#'s own
  // field now and factionRace is derived from it.
  const m = makeMachine(makeWorld());
  const q = schedule(m, ['Person _sk_ named Skakmat', '', 'variable _pad_']);
  assert.equal(q.getResource({ name: 'sk' }).factionId, 304);
  assert.equal(q.getResource({ name: 'sk' }).race, 3, 'race 11 is unmapped - the region Races, Nord');
  assert.equal(q.getResource({ name: 'sk' }).factionRace, 0,
    'and Nord is FactionRaces 0, not 3 - 3 would have been Breton');
  // and with NO regional race on the seam, the -1 default stands
  const bare = makeWorld();
  delete bare.currentRegionRace;
  const m2 = makeMachine(bare);
  const q2 = schedule(m2, ['Person _sk_ named Skakmat', '', 'variable _pad_']);
  assert.equal(q2.getResource({ name: 'sk' }).race, -1);
  assert.equal(q2.getResource({ name: 'sk' }).factionRace, -1, 'None both ways');
});

test('faction 512 forces Female through the display-name arm', () => {
  const m = makeMachine(makeWorld());
  // The_Prostitutes -> p3 512; the mock record is type Group (2), so
  // only the id===512 half of the OR can fire
  const q = schedule(m, ['Person _w_ faction The_Prostitutes', '', 'variable _pad_'], { rolls: () => 0.4 });
  const p = q.getResource({ name: 'w' });
  assert.equal(p.factionId, 512);
  assert.equal(p.npcGender, GENDERS.Female, 'roll 0.4 would be Male - the 512 arm overrode it');
});

test('the gender roll: >= 0.5 is Female, exactly 0.5 is Female, the explicit token wins', () => {
  const at = (decl, roll) => {
    const m = makeMachine(makeWorld());
    return schedule(m, [`Person _x_ ${decl}`, '', 'variable _pad_'], { rolls: () => roll }).getResource({ name: 'x' });
  };
  assert.equal(at('group Chemist local', 0.6).npcGender, GENDERS.Female);
  assert.equal(at('group Chemist local', 0.5).npcGender, GENDERS.Female, 'the strict < 0.5 boundary');
  assert.equal(at('male group Chemist local', 0.6).npcGender, GENDERS.Male, 'the parsed token skips the roll');
  assert.equal(at('female group Chemist', 0.4).npcGender, GENDERS.Female);
});

test('AssignHUDFace rolls Range(0,10) exactly: roll 0.95 answers face 9', () => {
  const m = makeMachine(makeWorld());
  const q = schedule(m, ['Person _x_ face 3 group Chemist local', '', 'variable _pad_'], { rolls: () => 0.95 });
  assert.equal(q.getResource({ name: 'x' }).faceIndex, 9, 'floor(0.95*10), the parsed 3 ignored');
});

test('the Temple draw at roll 0.9 still answers 82: 450 is truly OUT of the pool', () => {
  const m = makeMachine(makeWorld());
  const q = schedule(m, ['Person _t_ factionType Temple local', '', 'variable _pad_'], { rolls: () => 0.9 });
  assert.equal(q.getResource({ name: 't' }).factionId, 82, 'a high roll would land on 450 were it pooled');
});

test('nameSeed -1 draws the injectable engine roll 0..999 verbatim', () => {
  const m = makeMachine(makeWorld());
  const q = schedule(m, ['Person _x_ group Chemist local', '', 'variable _pad_'], { rolls: () => 0.9995 });
  const p = q.getResource({ name: 'x' });
  assert.equal(p.nameSeed, 999, 'floor(0.9995*1000) - the Range(0,1000) surface');
  assert.ok(p.displayName.length > 0);
});

test('the home scope law: unstated scope rolls ONLY over a loaded town with buildings', () => {
  // one building is enough for the roll (the > 0 gate)
  const m1 = makeMachine(makeWorld({ buildings: [building(17)], interiors: [[flat(11)]] }));
  const q1 = schedule(m1, ['Person _x_ group Shopkeeper', '', 'variable _pad_'], { rolls: () => 0.4 });
  const home1 = q1.getPlace(q1.getResource({ name: 'x' }).homePlaceSymbol);
  assert.equal(home1.scope, Scopes.Local, 'roll 0.4 under a loaded, built town goes local');

  // an UNLOADED current location forces remote - and the one-town
  // region's dart board excludes the player's own town, so the remote
  // search fails with ITS message, proving the local arm never ran
  const m2 = makeMachine(makeWorld({ unloadedCurrent: true }));
  assert.throws(
    () => schedule(m2, ['Person _x_ group Shopkeeper', '', 'variable _pad_'], { rolls: () => 0.4 }),
    /remote site/, 'forced remote, not a 0.4 local roll');

  // a loaded town with ZERO buildings forces remote the same way
  const m3 = makeMachine(makeWorld({ buildings: [], interiors: [] }));
  assert.throws(
    () => schedule(m3, ['Person _x_ group Shopkeeper', '', 'variable _pad_'], { rolls: () => 0.4 }),
    /remote site/, 'the buildings.length > 0 gate');
});

test('residence homes: Resident4 takes house4 by ROW; a Questor home is a plain house even beside a house5', () => {
  // house1 (17) first, house4 (20) second: the Resident4 row (0,20,0)
  // passes the gate and names house4 - the wildcard would have taken
  // the FIRST house at roll 0.4
  const m1 = makeMachine(makeWorld({ buildings: [building(17), building(20)], interiors: [[flat(11)], [flat(11)]] }));
  const q1 = schedule(m1, ['Person _x_ group Resident4', '', 'variable _pad_'], { rolls: () => 0.4 });
  const home1 = q1.getPlace(q1.getResource({ name: 'x' }).homePlaceSymbol);
  assert.equal(home1.siteDetails.buildingKey, 1, 'the type-20 house at index 1');

  // Questor (0,21,0) FAILS the p2<=20 gate -> 'house' -> the type-21
  // house5 next door is invisible to the wildcard set
  const m2 = makeMachine(makeWorld({ buildings: [building(21), building(17)], interiors: [[flat(11)], [flat(11)]] }));
  const q2 = schedule(m2, ['Person _x_ group Questor', '', 'variable _pad_'], { rolls: () => 0.4 });
  const home2 = q2.getPlace(q2.getResource({ name: 'x' }).homePlaceSymbol);
  assert.equal(home2.siteDetails.buildingKey, 1, 'the type-17 house at index 1, never the house5');
});

test('Table.getKeyForValue answers the FIRST matching row (Table.cs:285-297)', () => {
  const t = new Table(['schema: *key,v', 'a, 1', 'b, 1', 'c, 2']);
  assert.equal(t.getKeyForValue('v', '1'), 'a', 'row 0 wins');
  assert.equal(t.getKeyForValue('v', '2'), 'c');
  assert.equal(t.getKeyForValue('v', '9'), null, 'no match answers null');
  assert.throws(() => t.getKeyForValue('nope', '1'), /does not exist/);
});

test('ChangeReputeWith carries the SIGN: a positive amount moves reputation up', () => {
  const m = makeMachine(makeWorld());
  schedule(m, [
    'Person _pp_ group Chemist', '',
    ' change repute with _pp_ by +22', '',
    'variable _pad_',
  ]);
  m.tick();
  assert.deepEqual(m.of('changeReputation'), [['changeReputation', 510, 22, true]]);
});

test("C#'s DEAD ARM: an atHome individual gets NO home - isIndividualAtHome is assigned AFTER AssignHomeTown", () => {
  // Person.cs:275 runs AssignHomeTown, :278 assigns the field the
  // arm reads - so the individual half can never fire during setup
  const m = makeMachine(makeWorld());
  const q = schedule(m, ['Person _king_ named King_Gothryd atHome', '', 'variable _pad_']);
  const p = q.getResource({ name: 'king' });
  assert.equal(p.homePlaceSymbol, null, 'no player-location home place is built');
  assert.equal(p.isIndividualAtHome, true, 'the post-hoc field assignment still lands');
  assert.equal([...q.resources.values()].filter((r) => r.isPlace).length, 0, 'no Place resource joined the quest');
});

test("Person.Tick's auto-home hot-place: entering the home building places the NPC, once, permanently", () => {
  const world = makeWorld();
  const m = makeMachine(world);
  const q = schedule(m, ['Person _shop_ group Shopkeeper', '', 'variable _pad_'], { rolls: () => 0.4 });
  const p = q.getResource({ name: 'shop' });
  const home = q.getPlace(p.homePlaceSymbol);
  m.tick();
  assert.equal(p.assignedToHome, false, 'dormant while the player is elsewhere');
  world._inside = { building: { buildingKey: home.siteDetails.buildingKey } };
  m.tick();
  assert.equal(p.assignedToHome, true, 'the player entered - hot-placed');
  assert.equal(p.assignedPlaceSymbol.name, home.symbol.name);
  assert.deepEqual(home.siteDetails.selectedMarker.targetResources.map((s) => s.name), ['shop']);
  assert.equal(m.siteLinks.length, 1);
  m.tick();
  assert.equal(m.siteLinks.length, 1, 'permanent - never re-fires');
});

test('ChangeReputeWith fires ONCE ever: a task rearm must not repeat the reputation move', () => {
  const m = makeMachine(makeWorld());
  const q = schedule(m, [
    'Person _pp_ group Chemist', '',
    '_t_ task:', ' change repute with _pp_ by -5', '',
    'variable _pad_',
  ]);
  const t = q.getTask({ name: 't' });
  t.start(); m.tick();
  assert.equal(m.of('changeReputation').length, 1);
  t.clear(); t.start(); m.tick();
  assert.equal(m.of('changeReputation').length, 1, 'allowRearm=false held the action complete');
});

test('a P0 quest reads the PLAYER vampire clan; every other quest the region clan', () => {
  const m = makeMachine(makeWorld());
  const q = m.scheduleQuest(['Quest: P0TEST00', 'QRC:', 'Message:  1011', ' x', '', 'QBN:',
    'Person _v_ factionType Vampire_Clan', '', 'variable _pad_'], 0, { rolls: () => 0.4 });
  assert.equal(q.getResource({ name: 'v' }).factionId, 150, "the $CUREVAM/P0 arm reads the player's clan");
});

test('the Generic split at exactly 0.5 answers 844 (the strict < boundary)', () => {
  const m = makeMachine(makeWorld());
  const q = schedule(m, ['Person _g_ factionType Generic_Group local', '', 'variable _pad_'], { rolls: () => 0.5 });
  assert.equal(q.getResource({ name: 'g' }).factionId, 844);
});

test('the home scope roll: >= 0.5 goes REMOTE on a loaded, built town', () => {
  // the one-town dart board makes remote fail loudly, proving the arm
  const m1 = makeMachine(makeWorld());
  assert.throws(
    () => schedule(m1, ['Person _x_ group Shopkeeper', '', 'variable _pad_'], { rolls: () => 0.6 }),
    /remote site/, 'roll 0.6 is remote');
  const m2 = makeMachine(makeWorld());
  assert.throws(
    () => schedule(m2, ['Person _x_ group Shopkeeper', '', 'variable _pad_'], { rolls: () => 0.5 }),
    /remote site/, 'exactly 0.5 is remote - the strict < boundary');
});

test('an absent getReputation dep reads 0 (the unknown-faction law), holding ReputeExceedsDo shut', () => {
  const m = new QuestMachine({ nowSeconds: () => 0, world: makeWorld() });
  const q = m.scheduleQuest([...HEADER,
    'Person _pp_ group Chemist', '',
    ' repute with _pp_ exceeds 1 do _liked_', '',
    'variable _liked_',
  ], 0, { rolls: () => 0.4 });
  m.tick(); m.tick();
  assert.equal(q.getTask({ name: 'liked' }).getTriggerValue(), false, '0 < 1 keeps waiting');
});
