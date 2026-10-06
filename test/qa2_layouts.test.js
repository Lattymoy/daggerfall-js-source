// QUEST-AUDIT II (bible/01-Overview/Quest-Audit-II.md): A QUEST'S STATE WHEN THE LAYOUT IT WAS MADE IN IS NOT THE ONE
// PLAYED. The town mods (WD3) lay a town anew; the port keeps a save's records in their own layout (systems/layoutPins.js)
// and chooses a quest's site, or seats its questor, again where the town stands otherwise (place.js reseatMovedSite,
// person.js reseatMovedQuestor). Four defects of that machinery, each reproduced on the real modules first:
//   HOUSE-HALL  a guild's questor met in a House2 (every Thieves Guild and Dark Brotherhood hall) was never seated
//               again, and its hall was left on a key naming a stranger's building;
//   PIN-SLEEP   a session whose pin could not be honoured (a pack that would not load) re-seated and RE-STAMPED the
//               quest's sites, and the town was pinned to that layout for good against the quest's other records;
//   SHARED-SEAT two party members whose towns stood apart moved the shared site to another building at every resync;
//   SITE-LINKS  every resync added another site link per Place.
// Fixtures as test/fb1003b_questor.test.js (a questor set up off a clicked NPC; clicks by collectInteriorPeople +
// staticNpcData; the town's people by questorCandidateBuildings) and test/fb1004dTowns.mjs (towns over the real
// world-data door and layout pins) build them.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { SITE_TYPES } from '../src/systems/quest/place.js';
import { staticNpcData } from '../src/characters/staticNpc.js';
import { collectInteriorPeople } from '../src/characters/interiorPeople.js';
import { questorCandidateBuildings, makeBuildingKey } from '../src/systems/talkTopics.js';
import { configureLayoutPins, _resetLayoutPins, layoutRecordsOf, pinsFrom, setLayoutPins, recordHeldBack } from '../src/systems/layoutPins.js';
import { registerWorldDataAsset, _resetWorldDataReplacement, installWorldDataReplacement } from '../src/formats/worldDataReplacement.js';
import { mapPixelToWorldCoord } from '../src/formats/mapsFile.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { loadTables, rmbBlock, town, worldOf, typeAtKey, mark, SPAWN } from './fb1004dTowns.mjs';
import { stringHash } from '../src/formats/netRuntime.js';
import { seededFirst } from '../src/systems/wind.js';

loadTables();

// ── a town of one block, its layout swapped under the quest (the questor's harness) ─────────────────────────────────
const MAP = 111, LOC_INDEX = 7, TOWN = 'Shesterwick', LOCATION_KEY = 4242;
const { House1, House2, GeneralStore, Tavern } = BUILDING_TYPES;
const TG = 42;           // the Thieves Guild: its halls' building faction
const TG_QUESTS = 804;   // its contact's faction - the guild service `Quests` (guildServices.js NPC_SERVICE)
const person = ({ x, z, position, factionID = TG_QUESTS, look = [182, 3] }) => ({ xPos: x, yPos: 0, zPos: z, position, factionID, flags: 0, textureArchive: look[0], textureRecord: look[1] });
const spawnMarker = { textureArchive: 199, textureRecord: 11, xPos: 40, yPos: 8, zPos: 60 };
const block = (entries) => ({ position: 5000, rmbBlock: { fldHeader: { buildingDataList: entries.map((e) => ({ buildingType: e.type, factionId: e.faction ?? 0, nameSeed: e.seed ?? 0 })), otherNames: null },
  subRecords: entries.map((e) => ({ interior: { blockFlatObjectRecords: [spawnMarker], blockPeopleRecords: e.people ?? [] } })) } });
const exteriorOf = (b) => b.rmbBlock.fldHeader.buildingDataList.map((d, i) => ({ buildingType: d.buildingType, factionId: d.factionId, nameSeed: 500 + i, locationId: 0, sector: 0, quality: 9 }));

function townWithLayouts() {
  const t = { block: null, inside: null };
  const w0 = mapPixelToWorldCoord(100, 100);
  const location = () => ({ loaded: true, regionIndex: 0, regionName: 'Testshire', name: TOWN, locationIndex: LOC_INDEX, hasDungeon: false, mapTableData: { mapId: MAP, locationType: 0, dungeonType: -1 },
    exterior: { buildings: exteriorOf(t.block), recordElement: { header: { x: w0.x, y: w0.y } }, exteriorData: { locationId: 0x400, width: 1, height: 1, blockNames: ['TESTAA00.RMB'] } }, dungeon: null });
  const factions = new Map([[TG, { id: TG, type: 2, name: 'The Thieves Guild', race: -1 }], [TG_QUESTS, { id: TG_QUESTS, type: 3, name: 'The Shadow Schemers', race: -1, parent: TG }], [201, { id: 201, type: 15, name: 'People', race: -1 }], [867, { id: 867, type: 14, name: 'Court', race: -1 }]]);
  const region = { name: 'Testshire', locationCount: 1, mapTable: [{ mapId: MAP, locationType: 0, dungeonType: -1 }], mapNameLookup: new Map([[TOWN, 0]]) };
  t.world = { maps: { regionCount: 1, getRegion: () => region, getLocation: () => location(), getLocationByName: () => location(), getRmbBlockName: () => 'TESTAA00.RMB', readLocationIdFast: () => 0x400 },
    getBlock: () => t.block, currentLocation: () => location(), currentRegionIndex: () => 0, currentLocationIndex: () => LOC_INDEX, isPlayerInLocationRect: () => true,
    playerInside: () => (t.inside ? { building: t.inside } : null), isHouseOwned: () => false, playerPixel: () => ({ x: 100, y: 100 }), buildingNameOpts: () => ({}),
    getFactionData: (id) => factions.get(id) ?? null, findFactionsOfType: (type) => [...factions.values()].filter((f) => f.type === type),
    currentRegionPeople: () => 201, currentRegionCourt: () => 867, currentRegionFaction: () => 201, currentRegionRace: () => 3 };
  t.buildings = () => questorCandidateBuildings(location().exterior.buildings, [{ dfBlock: t.block, x: 0, y: 0 }], { locationIndex: LOC_INDEX, mapId: MAP, nameOpts: { locationName: TOWN, regionName: 'Testshire' } });
  t.click = (record, i = 0) => staticNpcData(collectInteriorPeople(t.block.rmbBlock.subRecords[record])[i], { mapId: MAP, locationIndex: LOC_INDEX, buildingKey: makeBuildingKey(0, 0, record) });
  t.machine = new QuestMachine({ nowSeconds: () => 0, world: t.world, getReputation: () => 0, changeReputation: () => {}, lastNPCClicked: () => t.clicked });
  t.typeAt = (key) => t.block.rmbBlock.fldHeader.buildingDataList[key & 0xff]?.buildingType ?? null;
  /** The questor met where they stand (record `record` of the block in force), and their quest's return click. */
  t.takeContract = (record) => {
    const b = t.buildings()[record];
    t.inside = { buildingKey: b.buildingKey, name: b.buildingName, buildingType: b.buildingType, factionId: TG };
    t.clicked = t.click(record);
    const quest = t.machine.scheduleQuest(['Quest: __CONTRACT', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'Person _qgiver_ group Questor', '', 'variable _pad_', '_qgclicked_ task:', '  clicked npc _qgiver_'], 0, { rolls: () => 0.4 });
    t.machine.tick();
    t.inside = null;
    const qgiver = quest.getResource({ name: 'qgiver' });
    return { quest, qgiver, hall: quest.getPlace(qgiver.homePlaceSymbol), handsIn: (rec) => { t.machine.setLastNPCClicked(t.click(rec)); t.machine.tick(); return [...quest.tasks.values()].find((tk) => tk.symbol?.name === 'qgclicked')?.triggered ?? false; } };
  };
  return t;
}
const pins = (vendorOn) => configureLayoutPins({ vendorOn, vendorVersion: () => '0.5.0', locationKeyOfMapId: (id) => (id === MAP ? LOCATION_KEY : null), gridOf: () => null });
const BC = (v) => v === 'beautiful-cities';

// Daggerfall's own: a general store and the Thieves Guild's hall (a House2, faction 42) with its contact
const CLASSIC = block([{ type: GeneralStore }, { type: House2, faction: TG, people: [person({ x: 100, z: 200, position: 900 })] }]);
// the mod's: a stranger's House1 where the hall stood, and the hall at record 2 - its contact laid anew, another look
const MODDED = block([{ type: GeneralStore }, { type: House1, people: [person({ x: 5, z: 5, position: 50, factionID: 0, look: [182, 7] })] },
  { type: House2, faction: TG, people: [person({ x: 340, z: 80, position: 1200, look: [182, 21] })] }]);
// a layout with no hall of the guild at all
const HALLLESS = block([{ type: GeneralStore }, { type: House1, people: [person({ x: 5, z: 5, position: 50, factionID: 0, look: [182, 7] })] }]);

test('QUEST-AUDIT II HOUSE-HALL: a Thieves Guild contract taken in Daggerfall\'s layout of the town is handed in once it stands in the mod\'s - the contact (faction 804, the guild\'s Quests service) seated again on the guild\'s contact in the hall wherever it stands, laid anew in another look, the hall following; where no hall of the guild stands, the hall is UNSEATED, never left on a key naming a stranger\'s house (mutants: the guild rung unread, the hall left on its key)', () => {
  const t = townWithLayouts();
  try {
    pins(() => false); t.block = CLASSIC;
    const c = t.takeContract(1);
    assert.equal(t.typeAt(c.hall.siteDetails.buildingKey), House2, 'met in the guild\'s hall');
    // the town stands in the mod's layout now (online: the classic home that pinned it was sold)
    pins(BC); t.block = MODDED;
    assert.equal(t.machine.reseatMovedSites(t.world), 1, 'the contact moved');
    assert.equal(c.qgiver.questorData.buildingKey, makeBuildingKey(0, 0, 2), 'on the guild\'s contact in the hall as it stands');
    assert.equal(c.hall.siteDetails.buildingKey, makeBuildingKey(0, 0, 2), 'the hall with them');
    assert.equal(c.hall.siteDetails.unseated, undefined);
    assert.equal(c.handsIn(2), true, 'the return click hands in');
    // a town with no hall of the guild: the hall names no building, and the stranger's house is no quest's
    const u = townWithLayouts();
    pins(() => false); u.block = CLASSIC;
    const d = u.takeContract(1);
    pins(BC); u.block = HALLLESS;
    u.machine.reseatMovedSites(u.world);
    assert.equal(d.hall.siteDetails.buildingKey, 0, 'unseated');
    assert.equal(d.hall.siteDetails.unseated.buildingKey, makeBuildingKey(0, 0, 1), 'its record kept');
    assert.equal(u.machine.isActiveQuestBuilding(MAP, makeBuildingKey(0, 0, 1), House1), false, 'the stranger\'s House1 is no quest\'s');
    // back in the layout it was met in, the hall is seated back on its own key
    pins(() => false); u.block = CLASSIC;
    u.machine.reseatMovedSites(u.world);
    assert.equal(d.hall.siteDetails.buildingKey, makeBuildingKey(0, 0, 1), 'seated back');
    assert.equal(d.handsIn(1), true);
    // unseated, then seated anew by its questor in a layout with a hall: the old record goes - the pins ask for the
    // layout the hall stands in alone (else the town was asked for both, and might stand in the one it no longer has)
    const v = townWithLayouts();
    pins(() => false); v.block = CLASSIC;
    const e = v.takeContract(1);
    pins(BC); v.block = HALLLESS; v.machine.reseatMovedSites(v.world);
    assert.equal(e.hall.siteDetails.buildingKey, 0, 'unseated first');
    v.block = MODDED; v.machine.reseatMovedSites(v.world);
    assert.equal(e.hall.siteDetails.buildingKey, makeBuildingKey(0, 0, 2), 'seated anew with the contact');
    assert.equal(e.hall.siteDetails.unseated, undefined, 'its old record gone');
    assert.deepEqual(layoutRecordsOf({ sites: [e.hall.siteDetails] }).map((r) => r.stamp), ['beautiful-cities@0.5.0']);
  } finally { _resetLayoutPins(); }
});

test('QUEST-AUDIT II HOUSE-HALL: only a GUILD\'s questor is found by its faction - a questor of no guild service met in a house (a commoner) is not seated on another house\'s person of that faction; its hall is unseated (mutant: every faction found)', () => {
  const t = townWithLayouts();
  try {
    const commoner = (position, x) => person({ x, z: 10, position, factionID: 0, look: [182, 5] });
    pins(() => false); t.block = block([{ type: GeneralStore }, { type: House2, people: [commoner(900, 100)] }]);
    const c = t.takeContract(1);
    pins(BC); t.block = block([{ type: GeneralStore }, { type: House1 }, { type: House2, people: [commoner(1200, 340)] }]);
    t.machine.reseatMovedSites(t.world);
    assert.equal(c.qgiver.questorData.buildingKey, makeBuildingKey(0, 0, 1), 'the commoner\'s record kept');
    assert.equal(c.hall.siteDetails.buildingKey, 0, 'the hall unseated');
  } finally { _resetLayoutPins(); }
});

test('QUEST-AUDIT II PIN-SLEEP: a session whose pin cannot be honoured leaves the quest\'s records ASLEEP - the errand\'s site unseated with its own stamp, the guild contact unmoved - and the next session, the pack loading, stands the town in their layout again: the site seated back, the contact handed in (before: the site was re-seated and re-stamped classic, the town pinned classic for good, the contract never handed in) (mutants: the held-back towns unread, by the site, by the questor; the host\'s set unpassed)', () => {
  const t = townWithLayouts();
  const CL = block([{ type: Tavern }, { type: House2, faction: TG, people: [person({ x: 100, z: 200, position: 900 })] }]);
  const MOD = block([{ type: House2, faction: TG, people: [person({ x: 340, z: 80, position: 1200 })] }, { type: GeneralStore }, { type: Tavern }]);
  try {
    // taken with Beautiful Cities on: an errand's `local tavern`, then the guild's contract
    pins(BC); t.block = MOD;
    const errand = t.machine.scheduleQuest(['Quest: __ERRAND', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'Place _inn_ local tavern', '', 'variable _pad_'], 0, { rolls: () => 0.4 }); t.machine.tick();
    const inn = errand.getPlace({ name: 'inn' });
    const innKey = inn.siteDetails.buildingKey;
    const c = t.takeContract(0);
    assert.equal(inn.siteDetails.layout, 'beautiful-cities@0.5.0');
    // a session whose pack would not load: the host drops the pin (world.js applyLayoutPins) and the town stands classic
    pins(() => false); t.block = CL;
    setLayoutPins(new Map(), { heldBack: [LOCATION_KEY] });
    assert.equal(recordHeldBack({ mapId: MAP }), true);
    t.machine.reseatMovedSites(t.world);
    assert.equal(inn.siteDetails.buildingKey, 0, 'the errand\'s site asleep');
    assert.equal(inn.siteDetails.unseated.layout, 'beautiful-cities@0.5.0', 'its stamp its own');
    assert.equal(c.qgiver.questorData.layout, 'beautiful-cities@0.5.0', 'the contact unmoved');
    assert.equal(c.qgiver.questorData.buildingKey, makeBuildingKey(0, 0, 0));
    // the next session, the pack loads: the records ask for the mod's layout alone, and it stands
    pins(BC); setLayoutPins(pinsFrom(layoutRecordsOf({ sites: t.machine.getAllActiveQuestSites(), questors: t.machine.getAllActiveQuestors() })));
    assert.equal(recordHeldBack({ mapId: MAP }), false, 'a new session holds nothing back');
    t.block = MOD;
    t.machine.reseatMovedSites(t.world);
    assert.equal(inn.siteDetails.buildingKey, innKey, 'the errand\'s site seated back');
    assert.equal(c.handsIn(0), true, 'the contract handed in');
    const WORLD = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
    assert.match(WORLD, /for \(const v of \[\.\.\.pin\.in\]\) if \(!\(await ensureWorldDataPack\(v\)\)\) \{ pin\.in\.delete\(v\); dropped\+\+; heldBack\.add\(key\); \}/);
    assert.match(WORLD, /const changed = setLayoutPins\(pins, \{ heldBack \}\);/);
  } finally { _resetLayoutPins(); }
});

// ── a party whose two members' towns stand apart (the re-seat harness, test/fb1004d_reseatgaps.test.js's) ─────────
const PARTY_MAP = 4242, PARTY_KEY = 17 + 100 * 958, BV = 'beautiful-villages';
function party() {
  _resetLayoutPins(); _resetWorldDataReplacement(); installWorldDataReplacement();
  registerWorldDataAsset('location-17-958.json', {}, null, { priority: 10, vendor: BV });
  const state = { on: true };
  configureLayoutPins({ vendorOn: (v) => state.on && v === BV, vendorVersion: () => '1.4.2', locationKeyOfMapId: (id) => (id === PARTY_MAP ? PARTY_KEY : null), gridOf: () => ['VILLAGE.RMB'] });
  const side = (buildings) => {
    const loc = town({ name: 'Aldleigh', locationIndex: 0, mapId: PARTY_MAP, grid: ['VILLAGE.RMB'] });
    const world = worldOf({ locations: [loc], blocks: new Map([['VILLAGE.RMB', rmbBlock('VILLAGE.RMB', buildings)]]), current: loc });
    return { loc, world, m: new QuestMachine({ nowSeconds: () => 0, world, getReputation: () => 0, changeReputation: () => {} }) };
  };
  return { state, side };
}
const CLASSIC_VILLAGE = [{ type: House2 }, { type: Tavern, markers: [mark(SPAWN, 40, 0, 40)] }];
const MODDED_VILLAGE = [{ type: Tavern, markers: [mark(SPAWN, 10, 0, 10)] }, { type: GeneralStore }, { type: Tavern, markers: [mark(SPAWN, 20, 0, 20)] }, { type: Tavern, markers: [mark(SPAWN, 30, 0, 30)] }];
const GEM_QUEST = ['Quest: __PARTY', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'Item _gem_ sapphire', 'Place _inn_ local tavern', '', '\tplace item _gem_ at _inn_', '', 'variable _done_'];
const innOf = (q) => q.getPlace({ name: 'inn' }).siteDetails;

test('QUEST-AUDIT II SHARED-SEAT: two party members whose towns stand apart (one client\'s pack would not load) each keep the shared site in their OWN building through every resync, what the quest placed carried onto it - before, the modded member\'s site and its gem moved to another tavern at each one (mutants: the own site unkept, the partner\'s targets dropped)', () => {
  const { state, side } = party();
  try {
    const A = side(MODDED_VILLAGE), B = side(CLASSIC_VILLAGE);
    state.on = true;
    const quest = A.m.parseQuestForLists(GEM_QUEST, 0, { rolls: () => 0 });   // A's own pick: the first tavern
    // a share whose re-seat die would pick ANOTHER of A's three taverns - so a copy chosen again, not kept, shows
    quest.shareId = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((x) => `share-${x}`).find((id) => Math.floor(seededFirst(stringHash(`${id}|reseat|inn|0`)) * 3) >= 1);
    assert.ok(quest.shareId, 'such a share');
    A.m.startQuestImmediate(quest); A.m.tick();
    const aKey = innOf(quest).buildingKey;
    assert.equal(aKey & 0xff, 0, 'A chose its first tavern');
    state.on = false;
    const bq = B.m.receiveSharedQuest(structuredClone(A.m.getShareableQuestData(quest.uid)));
    const bKey = innOf(bq).buildingKey;
    assert.equal(typeAtKey(B.world, B.loc, bKey), Tavern, 'B chose a tavern of its own town');
    for (let i = 0; i < 6; i++) {
      state.on = true; A.m.updateSharedQuest(quest.questName, structuredClone(B.m.getShareableQuestData(bq.uid)));
      assert.equal(innOf(quest).buildingKey, aKey, `resync ${i + 1}: A's tavern stays A's`);
      assert.deepEqual(innOf(quest).selectedMarker.targetResources.map((s) => s.name), ['gem'], 'the gem with it');
      state.on = false; B.m.updateSharedQuest(quest.questName, structuredClone(A.m.getShareableQuestData(quest.uid)));
      assert.equal(innOf(bq).buildingKey, bKey, `resync ${i + 1}: B's tavern stays B's`);
    }
  } finally { _resetLayoutPins(); _resetWorldDataReplacement(); }
});

test('QUEST-AUDIT II SHARED-SEAT: a shared copy chooses again by ONE die per share and Place - two members in the same layout, each rolling its own dice, given the same envelope from a member whose town stood apart land in the same tavern on the same marker; a quest no one shares keeps its own roll (mutant: the die unseeded)', () => {
  const { state, side } = party();
  const realRandom = Math.random;
  try {
    const B = side(CLASSIC_VILLAGE);
    state.on = false;
    const quest = B.m.parseQuestForLists(GEM_QUEST, 0);
    B.m.startQuestImmediate(quest); B.m.tick();
    const envelope = B.m.getShareableQuestData(quest.uid);
    assert.ok(envelope.shareId, 'a shared copy carries its share');
    state.on = true;
    const landed = [0.05, 0.95].map((r) => {
      Math.random = () => r;   // each member's own dice, as unlike as they come
      const C = side(MODDED_VILLAGE);
      const q = C.m.receiveSharedQuest(structuredClone(envelope));
      return { key: innOf(q).buildingKey, marker: innOf(q).selectedMarker.flatPosition };
    });
    assert.equal(typeAtKey(side(MODDED_VILLAGE).world, side(MODDED_VILLAGE).loc, landed[0].key), Tavern);
    assert.deepEqual(landed[0], landed[1], 'one tavern, one marker');
  } finally { Math.random = realRandom; _resetLayoutPins(); _resetWorldDataReplacement(); }
});

test('QUEST-AUDIT II SITE-LINKS: a resync makes each Place\'s site link again, never once more - twenty each way leave one link per Place on each member (mutant: the old links kept)', () => {
  const { state, side } = party();
  try {
    state.on = true;
    const A = side(MODDED_VILLAGE), B = side(MODDED_VILLAGE);
    const quest = A.m.parseQuestForLists(GEM_QUEST, 0);
    A.m.startQuestImmediate(quest); A.m.tick();
    const bq = B.m.receiveSharedQuest(structuredClone(A.m.getShareableQuestData(quest.uid)));
    for (let i = 0; i < 20; i++) {
      A.m.updateSharedQuest(quest.questName, structuredClone(B.m.getShareableQuestData(bq.uid)));
      B.m.updateSharedQuest(quest.questName, structuredClone(A.m.getShareableQuestData(quest.uid)));
    }
    const linksOf = (m, q) => m.siteLinks.filter((l) => l.questUID === q.uid);
    assert.equal(linksOf(A.m, quest).length, 1);
    assert.equal(linksOf(B.m, bq).length, 1);
    assert.equal(A.m.getSiteLinks(SITE_TYPES.Building, PARTY_MAP, innOf(quest).buildingKey).length, 1, 'the building\'s mount finds it once');
  } finally { _resetLayoutPins(); _resetWorldDataReplacement(); }
});
