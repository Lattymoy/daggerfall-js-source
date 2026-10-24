// FB1020h SITE-NAMED (FIELD BUGS 2026-10-20h, report 2: "the Orrery quest's blank building name"). The Hour That Was
// Not's two steps, Brass at Dusk (QLHR01) and The Orrery of Endings (QLHR02), draw `Place _temple_ remote temple` when
// the line's runner starts them - wherever the player stands. A temple is named by its faction's first child, a guild
// hall by its faction (FormulaHelper.cs:3139-3162), through the town host's one name bag (scenes/townTalk.js nameOpts),
// and the bag answered null wherever no town's topics stood: on the road, the quest's temple was named '' and kept so,
// and its sheet, letter, journal, talk and map read "Meet Prior Anselm Vey at  in Wildertown". DFU reads the faction
// names from PlayerEntity.FactionData wherever the player stands. The bag now answers its faction half once FACTION.TXT
// is read, a town or none; and a save carrying a nameless building site has it named again at the load's re-seat
// (Place.nameSiteAgain, machine.js _reseatMovedOf). tools/mutants/fb1020h_sitenamed.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createTownTalk } from '../../../src/scenes/townTalk.js';
import { generateBuildingName, BUILDING_TYPES } from '../../../src/world/buildingNames.js';
import { getNameBankOfRegion } from '../../../src/characters/nameHelper.js';
import { SITE_TYPES, Place, townBlockGrid } from '../../../src/systems/quest/place.js';
import { makeBuildingKey } from '../../../src/systems/talk/talkTopics.js';
import { quietText } from '../../../src/ui/quest/questLens.js';
import { sheetFor } from '../../../src/systems/questlines/qlSheets.js';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { QUESTLINES_PREF } from '../../../src/systems/questlines/qlLaw.js';
import { getSeed, setSeed } from '../../../src/formats/dfRandom.js';
import { _resetLayoutPins, configureLayoutPins } from '../../../src/systems/layoutPins.js';
import { packMachine, questSource } from '../../qlSources.mjs';
import { rmbBlock, town, worldOf } from '../../fb1004dTowns.mjs';
import { ARENA2, HAVE_ARENA2, SKIP, openTowns, everyLocation } from '../../fb1004dArena.mjs';

setPref(QUESTLINES_PREF, true);
const DAGGERFALL = 17;

/** FACTION.TXT as the file writes it (tab depth for a child), read by the game's own reader through the town host - a
 *  god whose first child names its temples, and a guild named for itself. */
const FACTION_TXT = [
  '#26', 'type: 1', 'name: Akatosh',
  '\t#92', '\ttype: 9', '\tname: The Akatosh Chantry',
  '\t\t#93', '\t\ttype: 3', '\t\tname: The Order of the Hour',
  '#40', 'type: 2', 'name: The Mages Guild',
].join('\r\n');

const quiet = async (fn) => { const w = console.warn; console.warn = () => {}; try { return await fn(); } finally { console.warn = w; } };

/** The town host's talk as world.js makes it - its FACTION.TXT `factions` (the player's, or FACTION_TXT), read on the
 *  boot's ensureLoaded; `topics` none: the player on the road. */
async function townTalkOf({ factions = null, topics = null, regionIndex = DAGGERFALL } = {}) {
  const fetchBytes = async (f) => {
    if (f === 'FACTION.TXT' && factions) return factions;
    if (ARENA2 && HAVE_ARENA2 && f === 'TEXT.RSC') return new Uint8Array(readFileSync(join(ARENA2, f)));
    throw new Error(`this pin serves no ${f}`);
  };
  const talk = createTownTalk({ renderer: {}, canvas: { width: 320, height: 200 }, fetchBytes, playerEntity: { name: 'P', stats: {} }, regionIndex: () => regionIndex, topics });
  await quiet(() => talk.ensureLoaded());
  return talk;
}
const ownFactions = () => new TextEncoder().encode(FACTION_TXT);
/** world.js's own wiring of the quest world's bag (`buildingNameOpts: () => townTalk.nameOpts?.() ?? {}`), held by
 *  test/systems/quest/interiorseams.test.js. */
const bagOf = (talk) => () => talk.nameOpts?.() ?? {};

/** A town of the Daggerfall region holding a temple of Akatosh and a house (the Prior's home) - its RMB block and its
 *  MAPS.BSA directory, whose entry gives the temple its seed and faction (mergeNamedBuildings) - and the quest machine's
 *  world seam over it (fb1004dTowns.mjs), the player out on the road. */
function roadWorld(bag) {
  const buildings = [{ type: BUILDING_TYPES.Temple, faction: 26, seed: 7 }, { type: BUILDING_TYPES.House1, seed: 9 }];
  const blocks = new Map([['TEMPLE.RMB', rmbBlock('TEMPLE.RMB', buildings)]]);
  const gothham = town({ name: 'Gothham', locationIndex: 0, mapId: 4711, grid: ['TEMPLE.RMB'] });
  gothham.exterior.buildings = buildings.map((b) => ({ buildingType: b.type, factionId: b.faction ?? 0, nameSeed: b.seed, quality: 10 }));
  return { ...worldOf({ locations: [gothham], blocks, current: null }), buildingNameOpts: bag };
}
const machineOn = (world) => packMachine({ world, getReputation: () => 0, changeReputation: () => {} });
const temple = (quest) => [...quest.resources.values()].find((r) => r.isPlace && r.symbol?.name === 'temple');
/** A quest's message, expanded as the journal and the letter read it (Message.getTextTokensByVariant, the macro helper's
 *  read): its lines, each trimmed. */
const said = (quest, id) => quest.getMessage(id).getTextTokensByVariant(0).map((t) => String(t.text ?? '').trim()).filter(Boolean);
/** The questline sheet's first objective, in the window's quiet read. */
const objective = (quest) => quietText(quest, sheetFor(quest.questName).objectives[0].text);

test('SITE-NAMED the bag off a town: with no town\'s topics (the road) the town host\'s name bag names a temple by its god\'s first child and a guild hall by its faction - FACTION.TXT as the game reads it - its name bank by the player\'s region and no town pair; in a town, the town pair as before (mutants: the topics gate back; the town pair, the region read off a missing town)', async () => {
  const road = await townTalkOf({ factions: ownFactions() });
  const bag = road.nameOpts();
  assert.notEqual(bag, null, 'the road answers a bag');
  assert.deepEqual([
    generateBuildingName(7, BUILDING_TYPES.Temple, { ...bag, factionId: 26 }),
    generateBuildingName(7, BUILDING_TYPES.GuildHall, { ...bag, factionId: 40 }),
    bag.locationName, bag.regionName, bag.shownLocationName, bag.shownRegionName, bag.nameBank,
  ], ['The Akatosh Chantry', 'The Mages Guild', undefined, undefined, undefined, undefined, getNameBankOfRegion(DAGGERFALL)]);
  const inTown = await townTalkOf({ factions: ownFactions(), topics: { locationName: 'Gothham', regionName: 'Daggerfall', regionIndex: DAGGERFALL, mapId: 4711, exteriorBuildings: [], blocks: [] } });
  const tb = inTown.nameOpts();
  assert.deepEqual([generateBuildingName(7, BUILDING_TYPES.Temple, { ...tb, factionId: 26 }), tb.locationName, tb.regionName, tb.shownLocationName],
    ['The Akatosh Chantry', 'Gothham', 'Daggerfall', 'Gothham']);
});

test('SITE-NAMED the Orrery\'s sentence: The Hour That Was Not\'s steps started on the road draw their temple in Gothham and name it - the sheet, the letter and the journal read "The Akatosh Chantry", never "at  in Gothham" (mutants: the topics gate back)', async () => {
  const road = await townTalkOf({ factions: ownFactions() });
  const world = roadWorld(bagOf(road));
  for (const name of ['QLHR01', 'QLHR02']) {
    const quest = machineOn(world).parseQuestForLists(questSource(name), 0, { rolls: () => 0 });
    assert.ok(quest, name);
    // the letter's line first: before the fix it read the field's own sentence ("I have gone on to  in Gothham,")
    assert.equal(said(quest, 1011).find((l) => / in Gothham[,.]$/.test(l)), name === 'QLHR01' ? 'I am a guest of The Akatosh Chantry in Gothham.' : 'I have gone on to The Akatosh Chantry in Gothham,');
    const site = temple(quest).siteDetails;
    assert.deepEqual([site.siteType, site.locationName, site.buildingName], [SITE_TYPES.Building, 'Gothham', 'The Akatosh Chantry'], name);
    if (name === 'QLHR01') assert.equal(objective(quest), 'Meet Prior Anselm Vey of the Order of the Hour at The Akatosh Chantry in Gothham');
    else {
      assert.equal(objective(quest), 'Meet Prior Anselm Vey at The Akatosh Chantry in Gothham');
      assert.ok(said(quest, 1010).includes('me at The Akatosh Chantry in Gothham, to tell me what the'), said(quest, 1010).join('|'));
    }
  }
});

test('SITE-NAMED a save\'s nameless temple is named at the load: a quest drawn while the bag answered nothing (before this fix on the road; still, before FACTION.TXT is read) is saved with its temple named \'\', and the load\'s re-seat (world.js applyLayoutPins) names it from its building - the sheet reading true, DFRandom put back, the Prior\'s home kept, and a site with no building here, a house and a bag with no faction left alone (mutants: the re-seat unhooked; a named site named again; the layout gate dropped; a residence named again; the seed left moved; an empty name taken)', async () => {
  _resetLayoutPins();
  try {
    const before = machineOn(roadWorld(() => ({})));
    const quest = before.parseQuestForLists(questSource('QLHR02'), 0, { rolls: () => 0 });
    before.startQuestImmediate(quest);
    assert.equal(temple(quest).siteDetails.buildingName, '', 'the shape the empty bag mints');
    assert.equal(objective(quest), 'Meet Prior Anselm Vey at in Gothham', 'the field\'s sentence');
    const save = JSON.parse(JSON.stringify(before.getSaveData()));
    const home = [...quest.resources.values()].find((r) => r.isPlace && r.symbol?.name === 'prior_home').siteDetails.buildingName;

    const road = await townTalkOf({ factions: ownFactions() });
    const after = machineOn(roadWorld(bagOf(road)));
    after.restoreSaveData(save);
    const loaded = after.getQuest(quest.uid);
    setSeed(4242);
    assert.equal(after.reseatMovedSites(), 0, 'no site moved: a name is no move');
    assert.equal(getSeed(), 4242, 'GetName seeds DFRandom - the state is put back');
    assert.equal(temple(loaded).siteDetails.buildingName, 'The Akatosh Chantry');
    assert.equal(objective(loaded), 'Meet Prior Anselm Vey at The Akatosh Chantry in Gothham');
    assert.equal([...loaded.resources.values()].find((r) => r.isPlace && r.symbol?.name === 'prior_home').siteDetails.buildingName, home, 'the Prior\'s home keeps its name');
    assert.equal(temple(loaded).nameSiteAgain(after.deps.world), false, 'a named site is left alone');

    // a nameless site with no building here: unseated (key 0), and one whose record names another layout than its town
    // stands in now (Gothham classic: the layout pins told where it is, and no town mod on)
    configureLayoutPins({ vendorOn: () => false, vendorVersion: () => '', locationKeyOfMapId: (id) => (id === 4711 ? DAGGERFALL : null), gridOf: () => ['TEMPLE.RMB'], locationTypeOf: () => 2 });
    const unseated = Object.assign(new Place(), { siteDetails: { ...temple(loaded).siteDetails, buildingName: '', buildingKey: 0 } });
    const elsewhere = Object.assign(new Place(), { siteDetails: { ...temple(loaded).siteDetails, buildingName: '', layout: 'beautiful-cities@0.5.0' } });
    assert.deepEqual([unseated.nameSiteAgain(after.deps.world), elsewhere.nameSiteAgain(after.deps.world), unseated.siteDetails.buildingName, elsewhere.siteDetails.buildingName], [false, false, '', '']);
    // a nameless house is no blank this law draws a surname for (a residence's name is a roll, never ''): Gothham's House1
    const house = Object.assign(new Place(), { siteDetails: { ...temple(loaded).siteDetails, buildingName: '', buildingKey: makeBuildingKey(0, 0, 1) } });
    assert.equal(house.nameSiteAgain(after.deps.world), false);
    // and a bag with no faction to name the temple by (a load before FACTION.TXT is read) changes nothing - the next load asks again
    const unread = Object.assign(new Place(), { siteDetails: { ...temple(loaded).siteDetails, buildingName: '' } });
    assert.deepEqual([unread.nameSiteAgain(roadWorld(() => ({}))), unread.siteDetails.buildingName, unread.nameSiteAgain(after.deps.world), unread.siteDetails.buildingName], [false, '', true, 'The Akatosh Chantry']);
  } finally { _resetLayoutPins(); }
});

test('SITE-NAMED with the player\'s data: The Orrery of Endings started on the road in the Daggerfall region names its temple - FACTION.TXT, MAPS.BSA and BLOCKS.BSA, the town host\'s own bag - and so does every step of the pack a line or a parent starts that draws a temple or a guild hall, and a palace is its castle (mutants: the topics gate back)', { skip: SKIP }, async () => {
  const road = await townTalkOf({ factions: new Uint8Array(readFileSync(join(ARENA2, 'FACTION.TXT'))) });
  const { maps, world: seam } = await openTowns({ mods: false });
  const world = {
    ...seam(null), currentRegionIndex: () => DAGGERFALL, currentLocationIndex: () => -1, currentRegionName: () => maps.getRegion(DAGGERFALL).name,
    playerPixel: () => null, getFactionData: (id) => road.factionDict?.get(id) ?? null, buildingNameOpts: bagOf(road),
  };
  const seeded = () => { let s = 0x1234; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; };
  const quest = machineOn(world).parseQuestForLists(questSource('QLHR02'), 0, { rolls: seeded() });
  assert.equal(said(quest, 1011).find((l) => l.startsWith('I have gone on to')), 'I have gone on to The Temple of Kynareth in Infinite Idol of Kynareth,');
  const site = temple(quest).siteDetails;
  const loc = maps.getLocation(DAGGERFALL, maps.getRegion(DAGGERFALL).mapNameLookup.get(site.locationName));
  const b = temple(quest).siteBuilding(world);
  assert.equal(b.buildingType, BUILDING_TYPES.Temple);
  const own = generateBuildingName(b.nameSeed, b.buildingType, { ...road.nameOpts(), locationName: loc.name, regionName: loc.regionName, factionId: b.factionId });
  assert.deepEqual([site.locationName, site.buildingName, own], ['Infinite Idol of Kynareth', 'The Temple of Kynareth', 'The Temple of Kynareth']);
  assert.equal(objective(quest), 'Meet Prior Anselm Vey at The Temple of Kynareth in Infinite Idol of Kynareth');
  // the pack's other starts the player may be anywhere for: the main story's S0000008 (`start quest 8` in S0000015) and
  // the lines' steps drawing a temple or a Mages Guild hall
  const named = {};
  for (const [name, sym] of [['S0000008', 'temple'], ['QLHR01', 'temple'], ['QLBD01', 'hall'], ['QLCH01', 'hall'], ['QLTF04', 'hall']]) {
    const q = machineOn(world).parseQuestForLists(questSource(name), 0, { rolls: seeded() });
    named[name] = [...q.resources.values()].find((r) => r.isPlace && r.symbol?.name === sym)?.siteDetails?.buildingName;
  }
  assert.deepEqual(named, { S0000008: 'The School of Julianos', QLHR01: 'The Temple of Kynareth', QLBD01: 'The Mages Guild', QLCH01: 'The Mages Guild', QLTF04: 'The Mages Guild' });
  // the region's every temple and guild hall the quest walk offers, named off a town: none blank
  const blank = [];
  let n = 0;
  for (const { r, loc: town2 } of everyLocation(maps)) {
    if (r !== DAGGERFALL || !town2?.loaded || !town2.exterior?.exteriorData) continue;
    for (const type of [BUILDING_TYPES.Temple, BUILDING_TYPES.GuildHall]) {
      for (const { summary } of Place.prototype._townBuildingsOfType.call({}, town2, townBlockGrid(world, town2), type, 0)) {
        n++;
        if (!generateBuildingName(summary.nameSeed, type, { ...road.nameOpts(), locationName: town2.name, regionName: town2.regionName, factionId: summary.factionId })) blank.push(`${town2.name}:${type}:${summary.factionId}`);
      }
    }
  }
  assert.deepEqual([n > 0, blank], [true, []]);
  // found on the way: a palace drawn on the road is the city's castle (TEXT.RSC 475, the bag's palaceName), never "Palace"
  assert.equal(generateBuildingName(0, BUILDING_TYPES.Palace, { ...road.nameOpts(), locationName: 'Daggerfall', regionName: 'Daggerfall' }), 'Castle Daggerfall');
});
