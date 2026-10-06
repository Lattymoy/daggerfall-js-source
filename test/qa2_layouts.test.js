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
import { configureLayoutPins, _resetLayoutPins, layoutRecordsOf, pinsFrom, setLayoutPins, recordHeldBack, recordStands, admitPinnedPacks } from '../src/systems/layoutPins.js';
import { registerWorldDataAsset, _resetWorldDataReplacement, installWorldDataReplacement } from '../src/formats/worldDataReplacement.js';
import { mapPixelToWorldCoord } from '../src/formats/mapsFile.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { loadTables, rmbBlock, town, worldOf, typeAtKey, mark, SPAWN } from './fb1004dTowns.mjs';
import { stringHash } from '../src/formats/netRuntime.js';
import { seededFirst } from '../src/systems/wind.js';
import { getSeed, setSeed } from '../src/formats/dfRandom.js';

loadTables();

// ── a town of one block, its layout swapped under the quest (the questor's harness) ─────────────────────────────────
const MAP = 111, LOC_INDEX = 7, TOWN = 'Shesterwick', LOCATION_KEY = 4242;
const { House1, House2, GeneralStore, Tavern, Temple } = BUILDING_TYPES;
const TG = 42;           // the Thieves Guild: its halls' building faction
const TG_QUESTS = 804;   // its contact's faction - the guild service `Quests` (guildServices.js NPC_SERVICE)
const AKATOSH = 26, HOUR = 92, KYNARETH = 35, PRIEST = 240;   // a temple's god, Daggerfall's Akatosh order, its quest-giver
const TEMPLE_NAMES = { [AKATOSH]: 'The Akatosh Chantry', [HOUR]: 'The Order of the Hour', [KYNARETH]: 'The Temple of Kynareth' };
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
  const factions = new Map([[TG, { id: TG, type: 2, name: 'The Thieves Guild', race: -1 }], [TG_QUESTS, { id: TG_QUESTS, type: 3, name: 'The Shadow Schemers', race: -1, parent: TG }], [201, { id: 201, type: 15, name: 'People', race: -1 }], [867, { id: 867, type: 14, name: 'Court', race: -1 }],
    // FACTION.TXT's Akatosh (26), the Order of the Hour under it (92 - Daggerfall's Akatosh temples), Kynareth (35), and the temples' quest-giver (240)
    [AKATOSH, { id: AKATOSH, type: 1, name: 'Akatosh', race: -1 }], [HOUR, { id: HOUR, type: 2, name: 'The Order of the Hour', race: -1, parent: AKATOSH }], [KYNARETH, { id: KYNARETH, type: 1, name: 'Kynareth', race: -1 }], [PRIEST, { id: PRIEST, type: 3, name: 'Temple Quest Givers', race: -1, parent: 450 }]]);
  const region = { name: 'Testshire', locationCount: 1, mapTable: [{ mapId: MAP, locationType: 0, dungeonType: -1 }], mapNameLookup: new Map([[TOWN, 0]]) };
  t.world = { maps: { regionCount: 1, getRegion: () => region, getLocation: () => location(), getLocationByName: () => location(), getRmbBlockName: () => 'TESTAA00.RMB', readLocationIdFast: () => 0x400 },
    getBlock: () => t.block, currentLocation: () => location(), currentRegionIndex: () => 0, currentLocationIndex: () => LOC_INDEX, isPlayerInLocationRect: () => true,
    playerInside: () => (t.inside ? { building: t.inside } : null), isHouseOwned: () => false, playerPixel: () => ({ x: 100, y: 100 }), buildingNameOpts: () => ({}),
    getFactionData: (id) => factions.get(id) ?? null, findFactionsOfType: (type) => [...factions.values()].filter((f) => f.type === type),
    currentRegionPeople: () => 201, currentRegionCourt: () => 867, currentRegionFaction: () => 201, currentRegionRace: () => 3 };
  t.buildings = () => questorCandidateBuildings(location().exterior.buildings, [{ dfBlock: t.block, x: 0, y: 0 }], { locationIndex: LOC_INDEX, mapId: MAP, nameOpts: { ...t.world.buildingNameOpts(), locationName: TOWN, regionName: 'Testshire' } });
  t.click = (record, i = 0) => staticNpcData(collectInteriorPeople(t.block.rmbBlock.subRecords[record])[i], { mapId: MAP, locationIndex: LOC_INDEX, buildingKey: makeBuildingKey(0, 0, record) });
  t.machine = new QuestMachine({ nowSeconds: () => 0, world: t.world, getReputation: () => 0, changeReputation: () => {}, lastNPCClicked: () => t.clicked });
  t.typeAt = (key) => t.block.rmbBlock.fldHeader.buildingDataList[key & 0xff]?.buildingType ?? null;
  /** The questor met where they stand (record `record` of the block in force), and their quest's return click. */
  t.takeContract = (record, { questFaction = 0 } = {}) => {
    const b = t.buildings()[record];
    t.inside = { buildingKey: b.buildingKey, name: b.buildingName, buildingType: b.buildingType, factionId: b.factionId };
    t.clicked = t.click(record);
    const quest = t.machine.scheduleQuest(['Quest: __CONTRACT', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'Person _qgiver_ group Questor', '', 'variable _pad_', '_qgclicked_ task:', '  clicked npc _qgiver_'], 0, { rolls: () => 0.4 });
    t.machine.tick();
    t.inside = null;
    quest.factionId = questFaction;   // GetFactionIdForGuild's: a holy order's quest takes its hall's faction
    const qgiver = quest.getResource({ name: 'qgiver' });
    return { quest, qgiver, hall: quest.getPlace(qgiver.homePlaceSymbol), handsIn: (rec) => { t.machine.setLastNPCClicked(t.click(rec)); t.machine.tick(); return [...quest.tasks.values()].find((tk) => tk.symbol?.name === 'qgclicked')?.triggered ?? false; } };
  };
  return t;
}
const pins = (vendorOn) => configureLayoutPins({ vendorOn, vendorVersion: () => '0.5.0', locationKeyOfMapId: (id) => (id === MAP ? LOCATION_KEY : null), gridOf: () => null });
const BC = (v) => v === 'beautiful-cities';

// Daggerfall's own: a general store and the Thieves Guild's hall (a House2, faction 42) with its contact
const CLASSIC_HALL = { type: House2, faction: TG, people: [person({ x: 100, z: 200, position: 900 })] };
const CLASSIC = block([{ type: GeneralStore }, CLASSIC_HALL]);
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
    // AUDIT QA2: a record made in the layout the town stands in this session stands - held back or not, never unseated
    const here = t.machine.scheduleQuest(['Quest: __HERE', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'Place _bar_ local tavern', '', 'variable _pad_'], 0, { rolls: () => 0 }); t.machine.tick();
    const bar = here.getPlace({ name: 'bar' }), barKey = bar.siteDetails.buildingKey;
    t.machine.reseatMovedSites(t.world);
    assert.equal(bar.siteDetails.buildingKey, barKey, 'a record that stands, untouched');
    assert.equal(bar.siteDetails.unseated, undefined);
    assert.equal(inn.siteDetails.buildingKey, 0, 'the errand\'s site still asleep');
    // the next session, the pack loads: the records ask for the mod's layout alone, and it stands
    pins(BC); setLayoutPins(pinsFrom(layoutRecordsOf({ sites: t.machine.getAllActiveQuestSites(), questors: t.machine.getAllActiveQuestors() })));
    assert.equal(recordHeldBack({ mapId: MAP }), false, 'a new session holds nothing back');
    t.block = MOD;
    t.machine.reseatMovedSites(t.world);
    assert.equal(inn.siteDetails.buildingKey, innKey, 'the errand\'s site seated back');
    assert.equal(c.handsIn(0), true, 'the contract handed in');
    // the host's half: its pin loop is layoutPins' admitPinnedPacks (run below), and the set reaches the pins
    const WORLD = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
    assert.ok(WORLD.includes('const { dropped, heldBack } = await admitPinnedPacks(pins, ensureWorldDataPack);'));
    assert.ok(WORLD.includes('const changed = setLayoutPins(pins, { heldBack, missing: worldDataPacksMissing() });'));
  } finally { _resetLayoutPins(); }
});

test('AUDIT QA2 PIN-SLEEP: the host\'s pin loop, run (layoutPins.js admitPinnedPacks, lifted out of world.js applyLayoutPins): a pin into a pack that will not load loses it and holds its town back, a pin whose pack loads keeps it and holds nothing; a held-back town holds back its own records only; and a record whose OWN stamp names a pack switched on that did not load this session sleeps in any town - online the room\'s pins name only its homes\' towns (mutants: the town unheld, the key unkept, one town holding every town back, the missing packs unread)', async () => {
  try {
    const pinsOf = () => new Map([[17, { in: new Set(['beautiful-villages']), out: new Set(), stamp: 'beautiful-villages@1.4.2', why: 'quest' }], [217, { in: new Set(['beautiful-cities']), out: new Set(), stamp: 'beautiful-cities@0.5.0', why: 'house' }]]);
    const p = pinsOf();
    const { dropped, heldBack } = await admitPinnedPacks(p, async (v) => v === 'beautiful-cities');
    assert.equal(dropped, 1);
    assert.deepEqual([...heldBack], [17], 'the town whose pack would not load, by its key');
    assert.deepEqual([...p.get(17).in], [], 'its pin lets nothing in');
    assert.deepEqual([...p.get(217).in], ['beautiful-cities'], 'the other kept');
    configureLayoutPins({ locationKeyOfMapId: (id) => ({ 1: 17, 2: 217, 3: 317 })[id] ?? null });
    setLayoutPins(new Map(), { heldBack });
    assert.equal(recordHeldBack({ mapId: 1 }), true);
    assert.equal(recordHeldBack({ mapId: 2, layout: 'classic' }), false, 'another town\'s record');
    // online: Beautiful Villages switched on, its pack fetch failed - no pin names the town, the record's stamp does
    setLayoutPins(new Map(), { missing: ['beautiful-villages'] });
    assert.equal(recordHeldBack({ mapId: 3, layout: 'beautiful-villages@1.4.2' }), true, 'made in the layout that did not load');
    assert.equal(recordHeldBack({ mapID: 3, layout: 'beautiful-villages@1.4.2' }), true, 'a questor\'s record');
    assert.equal(recordHeldBack({ mapId: 3, layout: 'classic' }), false, 'made in Daggerfall\'s');
    assert.equal(recordHeldBack({ mapId: 3, layout: 'beautiful-cities@0.5.0' }), false, 'made in a layout that loaded');
  } finally { _resetLayoutPins(); }
});

test('AUDIT QA2 HOUSE-HALL: a questor whose OWN person stands on their own key in the town as it stands now - a building the mods kept as Daggerfall laid it - is seated there: the record and the hall restamped, the hall never unseated, the click handing in. A commoner met in a residence (no guild: before, its hall was unseated and the house shut to it); a contact in a town of two halls of its guild, the other hall first (before, moved to it) (mutant: rung 0 unread)', () => {
  const resident = person({ x: 30, z: 30, position: 77, factionID: 0, look: [182, 9] });
  const t = townWithLayouts();
  try {
    pins(() => false); t.block = block([{ type: GeneralStore }, { type: House1, people: [resident] }]);
    const c = t.takeContract(1);
    pins(BC); t.block = block([{ type: GeneralStore }, { type: House1, people: [resident] }, { type: Tavern }]);
    assert.equal(t.machine.reseatMovedSites(t.world), 1, 'the record restamped');
    assert.equal(c.qgiver.questorData.buildingKey, makeBuildingKey(0, 0, 1), 'on their own key');
    assert.equal(c.hall.siteDetails.buildingKey, makeBuildingKey(0, 0, 1), 'the hall on it');
    assert.equal(c.hall.siteDetails.unseated, undefined, 'never unseated');
    const q = c.qgiver.questorData;
    assert.equal(recordStands({ mapId: q.mapID, buildingKey: q.buildingKey, layout: q.layout }), true, 'the questor\'s record stands in the town as it stands');
    assert.equal(recordStands(c.hall.siteDetails), true, 'and the hall\'s');
    assert.equal(c.handsIn(1), true, 'the click hands in');
    // a Thieves Guild contact in the hall the mods kept, another hall of the guild ahead of it holding one of the same look
    const u = townWithLayouts();
    pins(() => false); u.block = CLASSIC;
    const d = u.takeContract(1);
    pins(BC); u.block = block([{ type: House2, faction: TG, people: [person({ x: 7, z: 9, position: 31 })] }, CLASSIC_HALL]);
    u.machine.reseatMovedSites(u.world);
    assert.equal(d.qgiver.questorData.buildingKey, makeBuildingKey(0, 0, 1), 'their own hall');
    assert.equal(d.handsIn(1), true);
  } finally { _resetLayoutPins(); }
});

test('AUDIT QA2 HOUSE-HALL: the guild rung asks the questor\'s own look before the guild\'s faction - a town of two Thieves Guild halls under the mods, the first holding a contact of another look, the second one of the contact\'s own (mutant: the faction asked first)', () => {
  const t = townWithLayouts();
  try {
    pins(() => false); t.block = CLASSIC;
    const c = t.takeContract(1);
    pins(BC); t.block = block([{ type: House2, faction: TG, people: [person({ x: 7, z: 9, position: 31, look: [182, 9] })] }, { type: GeneralStore },
      { type: House2, faction: TG, people: [person({ x: 340, z: 80, position: 1200 })] }]);
    t.machine.reseatMovedSites(t.world);
    assert.equal(c.qgiver.questorData.buildingKey, makeBuildingKey(0, 0, 2), 'the hall of the contact\'s own look');
    assert.equal(c.handsIn(2), true);
  } finally { _resetLayoutPins(); }
});

test('AUDIT QA2 HOUSE-HALL: a temple\'s quest-giver (240, in every god\'s temple) is seated only in a temple of the quest\'s own god - the town mods\' Akatosh temple carries Akatosh (26) where Daggerfall\'s carries the Order of the Hour (92, under 26), and the town\'s Temple of Kynareth, ahead of it with a priest of the same look, is not the quest\'s (mutant: the guild\'s halls unasked)', () => {
  const priest = (x, position) => person({ x, z: 40, position, factionID: PRIEST, look: [182, 23] });
  const t = townWithLayouts();
  try {
    t.world.buildingNameOpts = () => ({ templeName: (id) => TEMPLE_NAMES[id] ?? '' });
    pins(() => false); t.block = block([{ type: GeneralStore }, { type: Temple, faction: HOUR, people: [priest(100, 900)] }]);
    const c = t.takeContract(1, { questFaction: HOUR });
    assert.equal(c.hall.siteDetails.buildingName, 'The Order of the Hour');
    pins(BC); t.block = block([{ type: Temple, faction: KYNARETH, people: [priest(60, 300)] }, { type: GeneralStore }, { type: Temple, faction: AKATOSH, people: [priest(80, 400)] }]);
    assert.equal(t.machine.reseatMovedSites(t.world), 1);
    assert.equal(c.qgiver.questorData.buildingKey, makeBuildingKey(0, 0, 2), 'the Akatosh temple');
    assert.equal(c.hall.siteDetails.buildingName, 'The Akatosh Chantry', 'the hall with them');
    assert.equal(c.handsIn(2), true);
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
    let first = true;   // A's own pick the first tavern, and any later roll of its own another (AUDIT QA2: so a copy chosen again by its own roll shows too)
    const quest = A.m.parseQuestForLists(GEM_QUEST, 0, { rolls: () => (first ? (first = false, 0) : 0.7) });
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

const GEM_LATER = ['Quest: __PARTYL', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'Item _gem_ sapphire', 'Place _inn_ local tavern', '', '_go_ task:', '\tplace item _gem_ at _inn_', '', 'variable _done_'];
test('AUDIT QA2 SHARED-SEAT: the copy that keeps its own building takes what the partner places AFTER the share on one of its building\'s own markers - it had selected none (DFU\'s "none", no spot) and the gem rode it nowhere, the interior mount throwing on its flatPosition; where the partner\'s site stands in this copy\'s town the partner\'s is the quest\'s, and an own site in another town is never kept (mutants: the standing test, the partner\'s-stands guard, the same-town guard)', () => {
  const { state, side } = party();
  try {
    const A = side(MODDED_VILLAGE), B = side(CLASSIC_VILLAGE);
    state.on = true;
    const quest = A.m.parseQuestForLists(GEM_LATER, 0, { rolls: () => 0 });
    A.m.startQuestImmediate(quest); A.m.tick();
    state.on = false;
    const bq = B.m.receiveSharedQuest(structuredClone(A.m.getShareableQuestData(quest.uid)));
    assert.equal(innOf(bq).selectedMarker.flatPosition, undefined, 'B has placed nothing: none selected');
    state.on = true;
    quest.getTask({ name: 'go' }).start(); A.m.tick();
    assert.deepEqual(innOf(quest).selectedMarker.targetResources.map((x) => x.name), ['gem'], 'A placed the gem');
    state.on = false;
    B.m.updateSharedQuest(quest.questName, structuredClone(A.m.getShareableQuestData(quest.uid)));
    const sm = innOf(bq).selectedMarker;
    assert.deepEqual(sm.targetResources.map((x) => x.name), ['gem'], 'the gem, on B\'s side');
    assert.ok(sm.flatPosition, 'on a marker with a spot');
    const spots = [...(innOf(bq).questSpawnMarkers ?? []), ...(innOf(bq).questItemMarkers ?? [])].map((k) => JSON.stringify(k.flatPosition));
    assert.ok(spots.includes(JSON.stringify(sm.flatPosition)), 'one of B\'s own building\'s markers');
    assert.equal(typeAtKey(B.world, B.loc, innOf(bq).buildingKey), Tavern, 'in B\'s own tavern');
    // an own site in another town is never kept: the partner's site, chosen again in B's town
    innOf(bq).mapId = 9999;
    B.m.updateSharedQuest(quest.questName, structuredClone(A.m.getShareableQuestData(quest.uid)));
    assert.equal(innOf(bq).mapId, PARTY_MAP, 'the quest\'s town');
    // where the partner's site stands in B's town (both members in the mods' layout now), the partner's is the quest's
    const C = side(MODDED_VILLAGE);
    state.on = true;
    const cq = C.m.receiveSharedQuest(structuredClone(A.m.getShareableQuestData(quest.uid)));
    innOf(cq).buildingKey = makeBuildingKey(0, 0, 3);   // C's copy drifted to another of the village's taverns
    C.m.updateSharedQuest(quest.questName, structuredClone(A.m.getShareableQuestData(quest.uid)));
    assert.equal(innOf(cq).buildingKey, innOf(quest).buildingKey, 'A\'s tavern, which stands for C');
  } finally { _resetLayoutPins(); _resetWorldDataReplacement(); }
});

test('QUEST-AUDIT II SHARED-SEAT: a shared copy chooses again by ONE die per share and Place - two members in the same layout, each rolling its own dice, given the same envelope from a member whose town stood apart land in the same tavern on the same marker; a quest no one shares - AUDIT QA2: a save loaded alone with its share kept among them - keeps its own roll (mutants: the die unseeded, the die drawn without a party, the arrival not yet a shared copy)', () => {
  const { state, side } = party();
  const realRandom = Math.random;
  try {
    const B = side(CLASSIC_VILLAGE);
    state.on = false;
    const quest = B.m.parseQuestForLists(GEM_QUEST, 0);
    B.m.startQuestImmediate(quest); B.m.tick();
    // a share whose die for this Place lands on another tavern than a die of no Place would (AUDIT QA2: one die per share AND Place)
    const pick = (id, sym) => Math.floor(seededFirst(stringHash(`${id}|reseat|${sym}|0`)) * 3);
    quest.shareId = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'].map((x) => `share-${x}`).find((id) => pick(id, 'inn') !== pick(id, ''));
    const envelope = B.m.getShareableQuestData(quest.uid);
    assert.equal(envelope.shareId, quest.shareId, 'a shared copy carries its share');
    state.on = true;
    const landed = [0.05, 0.95].map((r) => {
      Math.random = () => r;   // each member's own dice, as unlike as they come
      const C = side(MODDED_VILLAGE);
      const q = C.m.receiveSharedQuest(structuredClone(envelope));
      return { key: innOf(q).buildingKey, marker: innOf(q).selectedMarker.flatPosition };
    });
    assert.equal(typeAtKey(side(MODDED_VILLAGE).world, side(MODDED_VILLAGE).loc, landed[0].key), Tavern);
    assert.deepEqual(landed[0], landed[1], 'one tavern, one marker');
    assert.equal(landed[0].key & 0xff, [0, 2, 3][pick(envelope.shareId, 'inn')], 'the tavern the share\'s die for `inn` picks');
    // AUDIT QA2: a copy no longer kept in step - a save loaded alone, its shareId kept for good, no party - chooses again
    // by its OWN roll, as every quest no one shares (actions.js PickOneOf's gate, sharedCopy)
    const TAVERNS = [0, 2, 3];   // MODDED_VILLAGE's taverns, by record
    const die = Math.floor(seededFirst(stringHash(`${envelope.shareId}|reseat|inn|0`)) * 3);
    const own = die === 2 ? 0 : 0.99;
    const D = side(MODDED_VILLAGE);
    D.m.restoreSaveData(structuredClone(B.m.getSaveData()));
    const dq = [...D.m.quests.values()][0];
    assert.equal(dq.shareId, envelope.shareId, 'the save keeps its share');
    dq.rolls = () => own;
    D.m.reseatMovedSites(D.world);
    assert.equal(innOf(dq).buildingKey & 0xff, TAVERNS[Math.floor(own * 3)], 'its own roll, not the share\'s die');
  } finally { Math.random = realRandom; _resetLayoutPins(); _resetWorldDataReplacement(); }
});

test('AUDIT QA2 SHARED-SEAT: two members seated in one house by the share\'s die name it alike - a residence\'s name is drawn from the share and the building, never from each member\'s own DFRandom state, and that state is put back (mutant: the name unseeded)', () => {
  const { state, side } = party();
  const HOME_QUEST = ['Quest: __PARTYH', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'Item _gem_ sapphire', 'Place _home_ local house', '', '\tplace item _gem_ at _home_', '', 'variable _done_'];
  const MOD_HOUSES = [{ type: House1, markers: [mark(SPAWN, 10, 0, 10)] }, { type: GeneralStore }, { type: House1, markers: [mark(SPAWN, 20, 0, 20)] }, { type: House2, markers: [mark(SPAWN, 30, 0, 30)] }];
  try {
    const B = side([{ type: House1, markers: [mark(SPAWN, 40, 0, 40)] }]);
    state.on = false;
    const quest = B.m.parseQuestForLists(HOME_QUEST, 0);
    B.m.startQuestImmediate(quest); B.m.tick();
    const envelope = B.m.getShareableQuestData(quest.uid);
    state.on = true;
    const landed = [11, 977].map((seed) => {
      setSeed(seed);   // each member's own DFRandom state, as unlike as they come
      const C = side(MOD_HOUSES);
      const sd = C.m.receiveSharedQuest(structuredClone(envelope)).getPlace({ name: 'home' }).siteDetails;
      return { key: sd.buildingKey, name: sd.buildingName, C };
    });
    assert.equal(landed[0].key, landed[1].key, 'one house');
    assert.match(landed[0].name, /Residence/);
    assert.equal(landed[0].name, landed[1].name, 'one name');
    // the state put back: a member's DFRandom goes on as it would have
    const place = [...landed[0].C.m.quests.values()][0].getPlace({ name: 'home' });
    place._die = () => 0.5;
    setSeed(4242);
    place._getBuildingName(landed[0].C.world, House1, landed[0].C.loc, { buildingType: House1, nameSeed: 1 }, landed[0].key);
    place._die = null;
    assert.equal(getSeed(), 4242);
  } finally { _resetLayoutPins(); _resetWorldDataReplacement(); }
});

test('QUEST-AUDIT II SITE-LINKS: a resync makes each Place\'s site link again, never once more - twenty each way leave one link per Place on each member, and another quest\'s links stand (mutants: the old links kept, every quest\'s links dropped)', () => {
  const { state, side } = party();
  try {
    state.on = true;
    const A = side(MODDED_VILLAGE), B = side(MODDED_VILLAGE);
    const quest = A.m.parseQuestForLists(GEM_QUEST, 0);
    A.m.startQuestImmediate(quest); A.m.tick();
    // AUDIT QA2: and a quest of A's own no one shares, its link standing through every resync of the other
    const solo = A.m.parseQuestForLists(['Quest: __SOLO', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'Item _ring_ sapphire', 'Place _bar_ local tavern', '', '\tplace item _ring_ at _bar_', '', 'variable _done_'], 0);
    A.m.startQuestImmediate(solo); A.m.tick();
    const bq = B.m.receiveSharedQuest(structuredClone(A.m.getShareableQuestData(quest.uid)));
    for (let i = 0; i < 20; i++) {
      A.m.updateSharedQuest(quest.questName, structuredClone(B.m.getShareableQuestData(bq.uid)));
      B.m.updateSharedQuest(quest.questName, structuredClone(A.m.getShareableQuestData(quest.uid)));
    }
    const linksOf = (m, q) => m.siteLinks.filter((l) => l.questUID === q.uid);
    assert.equal(linksOf(A.m, quest).length, 1);
    assert.equal(linksOf(B.m, bq).length, 1);
    assert.equal(A.m.getSiteLinks(SITE_TYPES.Building, PARTY_MAP, innOf(quest).buildingKey).length, 1, 'the building\'s mount finds it once');
    assert.equal(linksOf(A.m, solo).length, 1, 'another quest\'s link untouched');
  } finally { _resetLayoutPins(); _resetWorldDataReplacement(); }
});
