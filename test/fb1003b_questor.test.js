// QUESTOR-MOVED (FIELD BUGS 2026-10-03b, Discord "Bugged Quest", twice: RyuDouro - "me and my friend cant deliver quest
// because the NPC to deliver no longer exists in the same shop"; TutucoGOD - "I can't deliver a quest because the NPC
// doesn't exist on the location provide"). Both are merchant quests (K0C00Y09, K0C00Y05) whose `_qgiver_` is
// `group Questor`: the shopkeeper clicked at the offer, known to the return click by the four numbers the building's
// own block mints (QuestMachine.IsNPCDataEqual). Taken before the town mods (WD3), online, where nothing pins a save's
// town, the questor's town now stands in Beautiful Cities' / Villages' layout and those numbers name nobody - the one
// record AUDIT WD3 S5 left unmended. Person.reseatMovedQuestor seats the questor again in the town as it stands.
//
// Every fixture from its producer (TEST THE SHAPE THE PRODUCER MINTS): the quest's Person and its hall by the real
// setup chain off a clicked NPC (SetupQuestorNPC, AssignHomeTown -> ConfigureFromPlayerLocation); every click by the
// host's own derivation (collectInteriorPeople + staticNpcData, questBridge.clickNpc's); the building the player stands
// in by the town talk's directory walk (talkTopics.js questorCandidateBuildings); a party member's copy by the share
// envelope (getShareableQuestData -> receiveSharedQuest / updateSharedQuest).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import { loadQuestTables } from '../src/systems/quest/tables.js';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { staticNpcData, staticNpcName } from '../src/characters/staticNpc.js';
import { collectInteriorPeople } from '../src/characters/interiorPeople.js';
import { questorCandidateBuildings, makeBuildingKey } from '../src/systems/talkTopics.js';
import { configureLayoutPins, recordStands, _resetLayoutPins } from '../src/systems/layoutPins.js';
import { mapPixelToWorldCoord } from '../src/formats/mapsFile.js';

{
  const T = new URL('../vendor/dfu-quests/Tables/', import.meta.url);
  const s = {};
  for (const f of readdirSync(T)) if (f.endsWith('.txt')) s[f.replace('.txt', '')] = readFileSync(new URL(f, T), 'utf8').replace(/^﻿/, '');
  loadQuestTables(s);
}
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// ---- one town, in Daggerfall's layout and in a town mod's ----

const MAP = 111, LOC_INDEX = 7, TOWN = 'Shesterwick';
const ALCHEMIST = 0, LIBRARY = 10, TAVERN = 15;
const MERCHANTS = 510;
const LIBRARIAN = Object.freeze({ archive: 182, record: 3 });   // the questor's look
const building = (buildingType, nameSeed) => ({ buildingType, factionId: 0, nameSeed, locationId: 0, sector: 0, quality: 9 });
/** The location's building list: the names each layout's buildings draw (mergeNamedBuildings, by type in order). */
const EXTERIOR = [building(ALCHEMIST, 555), building(LIBRARY, 777), building(TAVERN, 333)];
const person = ({ x, z, position, factionID = MERCHANTS, look = LIBRARIAN }) =>
  ({ xPos: x, yPos: 0, zPos: z, position, factionID, flags: 0, textureArchive: look.archive, textureRecord: look.record });
const spawnMarker = { textureArchive: 199, textureRecord: 11, xPos: 40, yPos: 8, zPos: 60 };
/** An RMB block of `entries` ({ type, people, markers }), record i at building key (0,0,i). */
const rmb = (entries) => ({
  position: 5000,
  rmbBlock: {
    fldHeader: { buildingDataList: entries.map((e) => ({ buildingType: e.type, factionId: 0, nameSeed: 0 })), otherNames: null },
    subRecords: entries.map((e) => ({ interior: { blockFlatObjectRecords: e.markers ? [spawnMarker] : [], blockPeopleRecords: e.people ?? [] } })),
  },
});
/** Daggerfall's own block: an apothecary (quest markers) and the library, its librarian at the counter. */
const CLASSIC = rmb([
  { type: ALCHEMIST, markers: true, people: [person({ x: 10, z: 10, position: 100, factionID: 0, look: { archive: 182, record: 5 } })] },
  { type: LIBRARY, people: [person({ x: 100, z: 200, position: 900 })] },
]);
/** The town mod's: a tavern first (a merchant regular in the librarian's own look), the apothecary, then the library -
 *  a customer by the door, an apprentice of the librarian's faction in another look, and the librarian standing
 *  elsewhere. */
const CUSTOMER = (position = 1100) => person({ x: 5, z: 5, position, factionID: 0, look: { archive: 182, record: 7 } });
const APPRENTICE = (position = 1150) => person({ x: 60, z: 60, position, look: { archive: 182, record: 4 } });
const MOD = rmb([
  { type: TAVERN, people: [person({ x: 30, z: 30, position: 400 })] },
  { type: ALCHEMIST, markers: true, people: [] },
  { type: LIBRARY, people: [CUSTOMER(), APPRENTICE(), person({ x: 340, z: 80, position: 1200 })] },
]);
const HOUSE1 = 17;

const FACTIONS = new Map([
  [MERCHANTS, { id: MERCHANTS, type: 2, name: 'The Merchants', race: -1 }],
  [201, { id: 201, type: 15, name: 'People of Testshire', race: -1 }],
  [867, { id: 867, type: 14, name: 'Court of Testshire', race: -1 }],
]);

/** The quest world over the town; `t.block` / `t.exterior` are the layout it stands in, `t.inside` the building the
 *  player is in. */
function makeTown() {
  const w0 = mapPixelToWorldCoord(100, 100);
  const t = { block: CLASSIC, exterior: EXTERIOR, inside: null };
  const location = () => ({
    loaded: true, regionIndex: 0, regionName: 'Testshire', name: TOWN, locationIndex: LOC_INDEX,
    hasDungeon: false, mapTableData: { mapId: MAP, locationType: 0, dungeonType: -1 },
    exterior: { buildings: t.exterior, recordElement: { header: { x: w0.x, y: w0.y } }, exteriorData: { locationId: 0x400, width: 1, height: 1, blockNames: ['TESTAA00.RMB'] } },
    dungeon: null,
  });
  const region = { name: 'Testshire', locationCount: 1, mapTable: [{ mapId: MAP, locationType: 0, dungeonType: -1 }], mapNameLookup: new Map([[TOWN, 0]]) };
  t.world = {
    maps: { regionCount: 1, getRegion: () => region, getLocation: () => location(), getLocationByName: () => location(), getRmbBlockName: () => 'TESTAA00.RMB', readLocationIdFast: () => 0x400 },
    getBlock: () => t.block,
    currentLocation: () => location(),
    currentRegionIndex: () => 0,
    currentLocationIndex: () => LOC_INDEX,
    isPlayerInLocationRect: () => true,
    playerInside: () => (t.inside ? { building: t.inside } : null),
    isHouseOwned: () => false,
    playerPixel: () => ({ x: 100, y: 100 }),
    buildingNameOpts: () => ({}),
    getFactionData: (id) => FACTIONS.get(id) ?? null,
    findFactionsOfType: (type) => [...FACTIONS.values()].filter((f) => f.type === type),
    currentRegionPeople: () => 201,
    currentRegionCourt: () => 867,
    currentRegionFaction: () => 201,
    currentRegionRace: () => 3,
  };
  return t;
}
/** The town's buildings as the town talk's directory walk lists them (the building record the player stands in). */
const buildingsOf = (t) => {
  const loc = t.world.currentLocation();
  return questorCandidateBuildings(loc.exterior.buildings, [{ dfBlock: t.block, x: 0, y: 0 }], { locationIndex: LOC_INDEX, mapId: MAP, nameOpts: { locationName: TOWN, regionName: 'Testshire' } });
};
/** A click on person `i` of building record `rec` - the host's derivation (worldModes openStaticNpc -> questBridge.clickNpc). */
const clickOf = (t, rec, i) => staticNpcData(collectInteriorPeople(t.block.rmbBlock.subRecords[rec])[i], { mapId: MAP, locationIndex: LOC_INDEX, buildingKey: makeBuildingKey(0, 0, rec) });

function makeMachine(t, deps = {}) {
  const m = new QuestMachine({ nowSeconds: () => 0, world: t.world, getReputation: () => 0, changeReputation: () => {}, lastNPCClicked: () => m.clicked, ...deps });
  m.clicked = null;
  return m;
}
// K0C00Y09's / K0C00Y05's questor half, verbatim in shape: the merchant clicked is `_qgiver_`, and the return is `clicked npc _qgiver_`
const QUEST = ['Quest: __QM', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'Person _qgiver_ group Questor', '', 'variable _pad_', '_qgclicked_ task:', '  clicked npc _qgiver_'];
const BEFORE_THE_MODS = () => configureLayoutPins({ vendorOn: () => false, vendorVersion: () => '', locationKeyOfMapId: (id) => (id === MAP ? 4242 : null), gridOf: () => null });
const THE_MODS_NOW = () => configureLayoutPins({ vendorOn: (v) => v === 'beautiful-cities', vendorVersion: () => '0.5.0', locationKeyOfMapId: (id) => (id === MAP ? 4242 : null), gridOf: () => null });

/** The offer, before the mods: the player in the library, the librarian clicked, the quest taken. */
function takeQuestBeforeTheMods(t, m) {
  BEFORE_THE_MODS();
  const lib = buildingsOf(t).find((b) => b.buildingType === LIBRARY);
  t.inside = { buildingKey: lib.buildingKey, name: lib.buildingName, buildingType: LIBRARY, factionId: 0 };
  m.clicked = clickOf(t, 1, 0);
  const quest = m.scheduleQuest(QUEST, 0, { rolls: () => 0.4 });
  m.tick();
  const qg = quest.getResource({ name: 'qgiver' });
  return { quest, qg, hall: quest.getPlace(qg.homePlaceSymbol), libName: lib.buildingName, classicClick: m.clicked };
}
const triggered = (quest) => [...quest.tasks.values()].find((tk) => tk.symbol?.name === 'qgclicked')?.triggered ?? false;
const four = (d) => [d.hash, d.mapID, d.nameSeed, d.buildingKey];

test('QUESTOR-MOVED: a questor met before the town mods is seated again in their town as it stands - in the building the journal names, on the person of their faction and look there; the return click hands the quest in, the hall keeps its name at its new key, both stamped with the layout that stands, the questor keeps theirs and the NPC answers to it (mutants: the questor never asked; the struct\'s mapID handed to recordStands; the name rung dropped; the person\'s look rung dropped; the questor unstamped; the hall left behind; the hall unstamped; the name never answered; the name always answered)', () => {
  const t = makeTown();
  const m = makeMachine(t);
  try {
    const { quest, qg, hall, libName, classicClick } = takeQuestBeforeTheMods(t, m);
    assert.equal(qg.isQuestor, true);
    assert.deepEqual(four(qg.questorData), four(classicClick), 'the librarian clicked is the questor');
    assert.equal('layout' in qg.questorData, false, 'met in Daggerfall\'s own layout (no stamp: a record from before the mods reads the same)');
    assert.deepEqual([hall.siteDetails.buildingKey, hall.siteDetails.buildingName], [makeBuildingKey(0, 0, 1), libName]);
    assert.equal(m.movedQuestorName?.(classicClick) ?? null, null, 'a questor where they were met answers to the NPC\'s own name, DFU\'s');
    const name = qg.displayName, seed = qg.nameSeed;

    // #545: the town mods serve the town, and online a save's records pin nothing
    THE_MODS_NOW();
    t.block = MOD;
    const modLibrarian = clickOf(t, 2, 2);
    m.setLastNPCClicked(modLibrarian);
    assert.equal(qg.hasPlayerClicked, false, 'unmended: the librarian as the town now stands is nobody\'s questor');
    assert.equal(m.reseatMovedSites(t.world), 1, 'the questor moved');
    assert.deepEqual([hall.siteDetails.buildingKey, hall.siteDetails.buildingName], [makeBuildingKey(0, 0, 2), libName],
      'the hall is the library as it stands now (its own name), not the tavern holding a regular in the same look, nor the town\'s apothecary');
    assert.deepEqual(four(qg.questorData), four(modLibrarian), 'the librarian there - not the customer by the door, nor the apprentice of their faction in another look');
    assert.equal(hall.siteDetails.layout, 'beautiful-cities@0.5.0', 'the hall stamped with it too');
    assert.equal(qg.questorData.layout, 'beautiful-cities@0.5.0', 'stamped with the layout the town stands in');
    assert.equal(recordStands({ mapId: qg.questorData.mapID, buildingKey: qg.questorData.buildingKey, layout: qg.questorData.layout }), true);
    assert.deepEqual([qg.displayName, qg.nameSeed], [name, seed], 'the questor keeps the journal\'s name');
    assert.equal(m.movedQuestorName(modLibrarian), name, 'and the librarian answers to it (worldModes npcDisplayName)');
    assert.notEqual(staticNpcName(modLibrarian), name, 'which is not the name the block would give them');

    for (const [rec, i] of [[2, 0], [2, 1], [0, 0]]) {   // the customer; the apprentice; the tavern's regular in the librarian's look
      m.setLastNPCClicked(clickOf(t, rec, i));
      assert.equal(qg.hasPlayerClicked, false, `record ${rec} person ${i} is not the questor`);
      assert.equal(m.movedQuestorName(clickOf(t, rec, i)), null);
    }
    m.setLastNPCClicked(modLibrarian);
    assert.equal(qg.hasPlayerClicked, true, 'the return click finds the questor');
    m.tick();
    assert.equal(triggered(quest), true, '`clicked npc _qgiver_` fires: the quest can be handed in');
    assert.equal(m.reseatMovedSites(t.world), 0, 'and stands');
  } finally { _resetLayoutPins(); }
});

test('QUESTOR-MOVED: the rungs below the journal\'s name - a hall the mod renamed is found by a person of the questor\'s faction and look, in a named building only; a same-named hall with nobody in it is passed over; in the named hall the person of the questor\'s faction in a new look, else the first person there (mutants: the hall\'s look rung dropped; an unnamed building taken; the empty hall taken; the faction rung dropped; the first-person rung dropped)', () => {
  /** The quest taken before the mods, then the town in `block` / `exterior`: the questor's record and hall after the load's reseat. */
  const after = (block, exterior = EXTERIOR) => {
    const t = makeTown();
    const m = makeMachine(t);
    try {
      const r = takeQuestBeforeTheMods(t, m);
      THE_MODS_NOW();
      t.block = block; t.exterior = exterior;
      return { ...r, t, moved: m.reseatMovedSites(t.world), named: (type) => buildingsOf(t).find((b) => b.buildingType === type)?.buildingName };
    } finally { _resetLayoutPins(); }
  };
  const RENAMED = [building(ALCHEMIST, 555), building(LIBRARY, 778), building(TAVERN, 333)];   // the library draws another name
  {
    // a house first, a merchant in the librarian's look at home in it; the library renamed
    const r = after(rmb([
      { type: HOUSE1, people: [person({ x: 2, z: 2, position: 30 })] },
      { type: ALCHEMIST, markers: true, people: [person({ x: 1, z: 1, position: 50, factionID: 0, look: { archive: 182, record: 5 } })] },
      { type: LIBRARY, people: [CUSTOMER(), person({ x: 340, z: 80, position: 1200 })] },
    ]), RENAMED);
    assert.notEqual(r.named(LIBRARY), r.libName, 'the mod\'s library answers to another name');
    assert.equal(r.moved, 1);
    assert.deepEqual([r.hall.siteDetails.buildingKey, r.hall.siteDetails.buildingName], [makeBuildingKey(0, 0, 2), r.named(LIBRARY)], 'the named building holding the questor\'s faction and look - not the house');
    assert.deepEqual(four(r.qg.questorData), four(clickOf(r.t, 2, 1)));
  }
  {
    // the journal's library stands, nobody in it; the tavern holds a merchant in the librarian's look
    const r = after(rmb([
      { type: TAVERN, people: [person({ x: 30, z: 30, position: 400 })] },
      { type: LIBRARY, people: [] },
    ]));
    assert.equal(r.named(LIBRARY), r.libName);
    assert.equal(r.moved, 1);
    assert.equal(r.hall.siteDetails.buildingKey, makeBuildingKey(0, 0, 0), 'an empty hall is passed over');
    assert.deepEqual(four(r.qg.questorData), four(clickOf(r.t, 0, 0)));
  }
  {
    // the journal's library: a customer, then the questor's faction in a new look
    const r = after(rmb([
      { type: ALCHEMIST, markers: true, people: [] },
      { type: LIBRARY, people: [CUSTOMER(), APPRENTICE(1200)] },
    ]));
    assert.equal(r.moved, 1);
    assert.deepEqual([r.hall.siteDetails.buildingKey, r.hall.siteDetails.buildingName], [makeBuildingKey(0, 0, 1), r.libName]);
    assert.deepEqual(four(r.qg.questorData), four(clickOf(r.t, 1, 1)), 'the merchant in a new look, not the customer');
  }
  {
    // the journal's library: only a customer
    const r = after(rmb([
      { type: ALCHEMIST, markers: true, people: [] },
      { type: LIBRARY, people: [CUSTOMER()] },
    ]));
    assert.equal(r.moved, 1);
    assert.deepEqual(four(r.qg.questorData), four(clickOf(r.t, 1, 0)), 'the first person there');
  }
});

test('QUESTOR-MOVED: a town with no building to seat the questor in keeps the record - and the hall is never chosen again by a Place\'s own law: minted from where the player stood, its P2 of 0 read as Alchemist and moved the journal\'s `__qgiver_` to the town\'s apothecary (mutants: the Scopes.None guard dropped; the hall\'s look rung widened to any building with people)', () => {
  const t = makeTown();
  const m = makeMachine(t);
  try {
    const { qg, hall, libName, classicClick } = takeQuestBeforeTheMods(t, m);
    THE_MODS_NOW();
    t.exterior = [building(ALCHEMIST, 555), building(LIBRARY, 778), building(TAVERN, 333)];
    t.block = rmb([
      { type: ALCHEMIST, markers: true, people: [person({ x: 1, z: 1, position: 50, factionID: 0, look: { archive: 182, record: 5 } })] },
      { type: LIBRARY, people: [person({ x: 5, z: 5, position: 1100, factionID: 0, look: { archive: 182, record: 7 } })] },
    ]);
    // PIN MOVED (QUEST-AUDIT II HOUSE-HALL): the hall is UNSEATED, never left on a key its layout no longer names (here
    // the library again by chance; in the Thieves Guild's town a stranger's house) - its record kept, never the apothecary
    assert.equal(m.reseatMovedSites(t.world), 1, 'the hall unseated, nothing chosen again');
    assert.deepEqual(four(qg.questorData), four(classicClick), 'the questor\'s record as it was');
    assert.deepEqual([hall.siteDetails.buildingKey, hall.siteDetails.buildingName], [0, libName], 'the hall names no building, its name kept');
    assert.equal(hall.siteDetails.unseated.buildingKey, makeBuildingKey(0, 0, 1), 'its record kept - and never the apothecary\'s');
  } finally { _resetLayoutPins(); }
});

test('QUESTOR-MOVED: "me and my friend" - a party member\'s copy taken before the mods is mended as it ARRIVES (a fresh share and a resync), its hall\'s site link following; never before the host knows its towns\' layouts, and the load\'s reseat mends it then, the link with it (mutants: the receive unmended; the resync unmended; the layouts gate ignored; the hall\'s link left behind)', () => {
  const t = makeTown();
  const sender = makeMachine(t);
  try {
    const { quest, classicClick } = takeQuestBeforeTheMods(t, sender);
    const envelope = () => structuredClone(sender.getShareableQuestData(quest.uid));
    const sent = envelope();
    THE_MODS_NOW();
    t.block = MOD;
    const modLibrarian = clickOf(t, 2, 2);
    const hallLink = (m, q) => m.siteLinks.find((l) => l.questUID === q.uid && /_qgiver_home_/.test(l.placeSymbol?.original ?? l.placeSymbol?.name ?? ''));

    // the friend's machine: the towns' layouts known
    const friend = makeMachine(t);
    const got = friend.receiveSharedQuest(sent);
    const fq = got.getResource({ name: 'qgiver' });
    assert.deepEqual(four(fq.questorData), four(modLibrarian), 'mended on arrival');
    assert.equal(hallLink(friend, got).buildingKey, makeBuildingKey(0, 0, 2), 'its hall\'s link made at the new key');
    friend.setLastNPCClicked(modLibrarian);
    friend.tick();
    assert.equal(triggered(got), true, 'the friend hands it in at the librarian');
    // a resync from a copy still from before the mods brings the old questor back - and is mended as it lands
    const behind = makeMachine(t);
    const second = behind.receiveSharedQuest(sent);
    const bq = second.getResource({ name: 'qgiver' });
    assert.deepEqual(four(bq.questorData), four(modLibrarian));
    assert.ok(behind.updateSharedQuest(quest.questName, envelope()), 'the resync lands');
    assert.deepEqual(four(second.getResource({ name: 'qgiver' }).questorData), four(modLibrarian), 'mended again on the resync');

    // online, before the service has said the towns' layouts: left for the load's reseat
    let known = false;
    const early = makeMachine({ ...t, world: { ...t.world, townLayoutsKnown: () => known } });
    const eq = early.receiveSharedQuest(envelope());
    assert.deepEqual(four(eq.getResource({ name: 'qgiver' }).questorData), four(classicClick), 'not mended before the layouts are known');
    assert.equal(hallLink(early, eq).buildingKey, makeBuildingKey(0, 0, 1), 'its link at the old key');
    known = true;
    assert.equal(early.reseatMovedSites(), 1, 'the load\'s reseat (world.js applyLayoutPins) mends it');
    assert.deepEqual(four(eq.getResource({ name: 'qgiver' }).questorData), four(modLibrarian));
    assert.equal(hallLink(early, eq).buildingKey, makeBuildingKey(0, 0, 2), 'and the hall\'s link follows');
  } finally { _resetLayoutPins(); }
});

test('QUESTOR-MOVED: the hosts - the world\'s quest seam says when its towns\' layouts are known (applyLayoutPins\' own gate); the interior\'s one name derivation asks for a moved questor\'s name first (mutants: the seam always known; the name preference dropped)', () => {
  assert.match(src('src/scenes/world.js'), /\n {4}townLayoutsKnown: \(\) => !homeLayoutsOnline \|\| _serverLayoutRecords !== null,/);
  assert.match(src('src/scenes/world.js'), /const reseated = homeLayoutsOnline && _serverLayoutRecords === null \? 0 : \(questBridge\?\.machine\?\.reseatMovedSites\?\.\(\) \?\? 0\);/, 'the load\'s gate it mirrors');
  assert.match(src('src/scenes/worldModes.js'), /return questBridge\?\.machine\?\.movedQuestorName\?\.\(npcData\) \?\? staticNpcName\(npcData, /);
});
