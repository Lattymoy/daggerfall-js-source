// AUDIT RELEASE R2-5 ON THE FREEWARE (2026-10-26, bible/01-Overview/audits/Audit-Release-R2.md R2-5;
// bible/06-Systems/Quest-Arc.md "AUDIT RELEASE R2-5"): where ARENA2_PATH names the freeware, a questor in each of three
// provinces end to end over the world the build stands (test/systems/quest/r25World.mjs) - the law's own pins are
// test/systems/quest/auditrelease_r25.test.js. Split from it so a mutant its fixtures kill runs in seconds.
import '../../modsOff.js';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { PROVINCE_LAIR_REACH, PROVINCE_LAIR_COUNT, PROVINCE_LAIR_ROLLS, sliceQuestName, questView } from '../../../src/scenes/quest/questProvinceSites.js';
import { REGION_NAMES } from '../../../src/formats/mapsTables.js';
import { longitudeLatitudeToMapPixel } from '../../../src/formats/mapsFile.js';
import { SITE_TYPES, Place, siteIndexGives } from '../../../src/systems/quest/place.js';
import { Symbol as QuestSymbol } from '../../../src/systems/quest/symbol.js';
import { QUEST_REACH_TUNING } from '../../../src/systems/quest/questReach.js';
import { createProvinceWarm, WARM_PER_TICK } from '../../../src/scenes/quest/questProvinceWarm.js';

// ─── WITH ARENA2: A QUESTOR IN EACH OF THREE PROVINCES, END TO END ─────────────────────────────

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['MAPS.BSA', 'BLOCKS.BSA', 'WOODS.WLD', 'CLIMATE.PAK', 'POLITIC.PAK', 'FACTION.TXT', 'TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL'].every((f) => existsSync(join(ARENA2, f)));

/** The givers: each a capital's hall (the Imperial City's district slice of its kind), its quest list's quest whose sites
 *  leave town, and a Daedra summoned in each province. */
const GIVERS = [
  ['Solitude', [1569, -430], 'Skyrim', [['Fighters Guild', 'M0B00Y07', 41], ['Mages Guild', 'N0B00Y06', 40], ['temple', 'C0B00Y00', 0], ['social (commoner)', 'A0C00Y00', 0], ['Daedra (Azura)', 'T0C00Y00', 0]]],
  ['Mournhold', [3293, 550], 'Morrowind', [['Fighters Guild', 'M0B00Y07', 41], ['Mages Guild', 'N0B00Y06', 40], ['temple', 'C0B00Y00', 0], ['social (commoner)', 'A0C00Y00', 0], ['Daedra (Hircine)', 'X0C00Y00', 0]]],
  ['Imperial City, Arena District', [2074, 658], 'Cyrodiil', [['Fighters Guild', 'M0B00Y07', 41]]],
  ['Imperial City, Arcane University', [2076, 664], 'Cyrodiil', [['Mages Guild', 'N0B00Y06', 40]]],
  ['Imperial City, Temple District', [2066, 660], 'Cyrodiil', [['temple', 'C0B00Y00', 0], ['social (commoner)', 'A0C00Y00', 0], ['Daedra (Azura)', 'T0C00Y00', 0]]],
];
/** The quests whose start puts a target at a site past the Bay (a foe at a lair, an item at an inn); the others place theirs
 *  in a later task (M0B00Y07 its bear, C0B00Y00 its ghosts at the house). */
const PLACED_AT_START = /^(N0B00Y06|T0C00Y00|X0C00Y00|A0C00Y00)$/;

test('R2-5 with ARENA2: a Fighters Guild, a Mages Guild, a temple, a social giver and a Daedra in Skyrim, Morrowind and Cyrodiil each offer work that leaves town, the same draw in a second client\'s game at the pixel - every remote site a place the build stands in the giver\'s province, found by its name, on the held map by its pixel, its target placed when the player arrives; the quest saved, the world forgotten and loaded again on the Bay, every site the same place; and a Bay giver\'s sites the Bay\'s as before (the table printed)', { skip: HAVE ? false : 'ARENA2_PATH not set (or a file missing) - the freeware end to end skipped', timeout: 900_000 }, async () => {
  const { standWorldPastBay, questLayerAt } = await import('./r25World.mjs');
  const { loadTables, questSource } = await import('../../qlSources.mjs');
  const { addQuestResourceObjects } = await import('../../../src/systems/quest/sceneMount.js');
  const { readQuestMarks } = await import('../../../src/ui/quest/questMarks.js');
  const { tamrielFrameInBay, inBay } = await import('../../../src/world/tamriel/tamrielFrame.js');
  loadTables();
  const world = await standWorldPastBay(ARENA2);
  const { standAt, lairsNear } = world.places.provinceQuestPlaces;
  // THE BOUND, BY COUNT: at a pixel no table read before, at most PROVINCE_LAIR_ROLLS first rolls (here every one of them,
  // the lairs asked for unbounded), the nearest PROVINCE_LAIR_COUNT where that many stand, and the same cells again cost none
  const many = lairsNear(2600, 300, PROVINCE_LAIR_REACH, Infinity, PROVINCE_LAIR_ROLLS);
  assert.equal(lairsNear.rolled, PROVINCE_LAIR_ROLLS, 'the rolls bounded');
  assert.ok(many.length > PROVINCE_LAIR_COUNT && many.length <= PROVINCE_LAIR_ROLLS, `${many.length} lairs of ${PROVINCE_LAIR_ROLLS} cells`);
  const near = lairsNear(2600, 300, PROVINCE_LAIR_REACH, PROVINCE_LAIR_COUNT, PROVINCE_LAIR_ROLLS);
  assert.equal(lairsNear.rolled, 0, 'the cells kept');
  assert.equal(near.length, PROVINCE_LAIR_COUNT, 'the nearest, counted');
  // R2-5d: THE BOUND IS THE PIXEL'S - at a pixel no call read before, the lairs of its PROVINCE_LAIR_ROLLS nearest cells;
  // after the whole reach is read (a warm client), the same: a warm client reads no further than a cold one
  const cold = lairsNear(2650, 250, PROVINCE_LAIR_REACH, Infinity, PROVINCE_LAIR_ROLLS);
  lairsNear(2650, 250, PROVINCE_LAIR_REACH, Infinity, 100000);
  assert.deepEqual(lairsNear(2650, 250, PROVINCE_LAIR_REACH, Infinity, PROVINCE_LAIR_ROLLS), cold, 'warm or cold, the same lairs');
  // every lair a table lists stands as itself - its pixel free of the places the build stands first (IC's outskirts' towns)
  for (const l of lairsNear(2069, 658, 24)) assert.equal(standAt(l.px, l.py)?.mapTableData.mapId, l.mapId, `${l.name} @ ${l.px},${l.py} stands as the lair`);
  QUEST_REACH_TUNING.override = true;   // NEARBY-QUESTS, as the game's default has it (systems/features.js 'nearby-quests')
  after(() => { QUEST_REACH_TUNING.override = null; });
  const table = [];
  const quiet = (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; } };
  const seeded = (seed) => () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
  /** A quest offered at `pixel` by `giver`: parsed, started, each remote site checked; answers the quest and its layer. */
  const offer = async (where, pixel, province, giver, name, factionID) => {
    const location = standAt(pixel[0], pixel[1]);
    assert.ok(location?.loaded, `${where} stands`);
    const L = await questLayerAt(world, { pixel: { x: pixel[0], y: pixel[1] }, location });
    // R2-5d: the province made ready in idle time first (the player walked in), each tick bounded by count
    const warm = createProvinceWarm({ provinces: L.questWorld.provinceSites, regionNow: () => REGION_NAMES.indexOf(province), origin: () => ({ x: pixel[0], y: pixel[1] }) });
    for (let n = 0; !warm.done(); n++) { assert.ok(warm.tick() <= WARM_PER_TICK, 'a tick bounded'); assert.ok(n < 2000); }
    const stoodBefore = world.locationIndex.size;
    L.machine.setLastNPCClicked({ hash: 1, mapID: location.mapTableData.mapId, nameSeed: 7, buildingKey: 0, factionID, gender: 0 });
    const t0 = Date.now();
    const quest = quiet(() => L.machine.parseQuestForLists(questSource(name, true), factionID, { rolls: seeded(name.length * 31 + pixel[0]) }));
    const ms = Date.now() - t0;
    assert.ok(quest, `${where}: the ${giver}'s ${name} is offered (it parsed: work, not "no work")`);
    assert.equal(world.locationIndex.size, stoodBefore, `${where} ${name}: no place stood for the first time while asking for work (${ms} ms)`);
    // ONE DRAW FOR EVERY CLIENT: another quest layer at the same pixel (a party member's game), the same roll - the same sites
    const twin = await questLayerAt(world, { pixel: { x: pixel[0], y: pixel[1] }, location });
    twin.machine.setLastNPCClicked({ hash: 1, mapID: location.mapTableData.mapId, nameSeed: 7, buildingKey: 0, factionID, gender: 0 });
    const again = quiet(() => twin.machine.parseQuestForLists(questSource(name, true), factionID, { rolls: seeded(name.length * 31 + pixel[0]) }));
    const sitesOf = (q) => [...q.resources.values()].filter((x) => x.isPlace).map((x) => `${x.symbol.name}=${x.siteDetails?.mapId}:${x.siteDetails?.buildingKey}`);
    assert.deepEqual(sitesOf(again), sitesOf(quest), `${where} ${name}: the same draw`);
    quiet(() => { L.machine.startQuestImmediate(quest); quest.update(); });   // its start-up task runs at its first update
    // every site past the Bay, local ones too (R2-5b/c: a capital's slice under its quest name), found again by its name
    for (const x of [...quest.resources.values()].filter((y) => y.isPlace && y.siteDetails?.worldPixel)) {
      assert.equal(L.questWorld.maps.getLocationByName(x.siteDetails.regionName, x.siteDetails.locationName)?.mapTableData.mapId, x.siteDetails.mapId, `${where} ${name} ${x.symbol.name} -> ${x.siteDetails.locationName}: found by its name`);
    }
    const r = REGION_NAMES.indexOf(province);
    const remote = [...quest.resources.values()].filter((x) => x.isPlace && x.scope === 'remote');
    assert.ok(remote.length, `${name}: a site that leaves town`);
    let placed = 0;
    for (const place of remote) {
      const sd = place.siteDetails;
      const at = `${where} ${name} ${place.symbol.name} -> ${sd.locationName}`;
      assert.equal(sd.regionIndex, r, `${at}: in ${province}`);
      assert.equal(sd.regionName, province);
      assert.ok(sd.worldPixel && !inBay(sd.worldPixel.x, sd.worldPixel.y), `${at}: its own pixel past the Bay (START3)`);
      assert.equal(world.maps.getRegionIndexAt(sd.worldPixel.x, sd.worldPixel.y), r, `${at}: the politic map's ${province}`);
      const stood = questView(standAt(sd.worldPixel.x, sd.worldPixel.y));   // R2-5b: a capital slice under its quest name
      assert.ok(stood?.loaded && stood.name === sd.locationName && stood.mapTableData.mapId === sd.mapId, `${at}: the place the build stands on its pixel`);
      assert.equal(L.questWorld.maps.getLocationByName(sd.regionName, sd.locationName)?.mapTableData.mapId, sd.mapId, `${at}: found by its name`);
      assert.equal(readQuestMarks(() => [{ px: sd.worldPixel.x, py: sd.worldPixel.y }], { width: 1000, height: 500 }, tamrielFrameInBay()).length, 1, `${at}: its mark on the held map`);
      if (sd.siteType === SITE_TYPES.Building) assert.ok(place.siteBuilding(L.questWorld), `${at}: its building stands in the town`);
      if (sd.siteType === SITE_TYPES.Dungeon) assert.equal(place.fitSiteToBuild(L.questWorld), false, `${at}: its markers the dungeon's as the build lays it`);
      // the player arrives: the machine's links at the site stand what the quest put there
      const stands = [];
      const adapter = { currentMapId: () => sd.mapId, findBehaviours: () => [], loadInProgress: () => false,
        standNPC: (o) => { stands.push(`npc ${o.person.symbol.name}`); return {}; }, standFoe: (o) => { stands.push(`foe ${o.foe.symbol.name}`); return {}; }, standItem: (o) => { stands.push(`item ${o.item.symbol.name}`); return {}; } };
      quiet(() => addQuestResourceObjects(L.machine, adapter, sd.siteType, sd.siteType === SITE_TYPES.Building ? sd.buildingKey : 0));
      placed += stands.length;
      table.push(`| ${giver} | ${province} (${where}) | ${name} | ${place.symbol.name}: ${sd.locationName} (${['', 'town', 'dungeon', 'building'][sd.siteType]}) @ ${sd.worldPixel.x},${sd.worldPixel.y} | yes | yes | ${stands.join(', ') || '- (later in the quest)'} | ${ms} ms |`);
    }
    return { quest, L, placed };
  };
  const kept = [];
  for (const [where, pixel, province, givers] of GIVERS) {
    for (const [giver, name, factionID] of givers) {
      const { quest, L, placed } = await offer(where, pixel, province, giver, name, factionID);
      if (PLACED_AT_START.test(name)) assert.ok(placed > 0, `${where} ${name}: a target placed on arrival`);
      if (name === 'T0C00Y00' || name === 'M0B00Y07') kept.push({ where, province, data: L.machine.getSaveData(), uid: quest.uid });
    }
  }
  // R2-5c: THE CENTRE'S LOCAL SITES - a questor in the Imperial City's centre slice (no building stands there) gives work
  // whose local sites are the city's nearest district slices', under their quest names, found again by them
  {
    const centre = standAt(2069, 658);
    assert.equal(centre?.exterior?.buildings?.length, 0, 'the centre stands no building');
    for (const [giver, name, factionID] of [['Mages Guild', 'N0B20Y02', 40], ['social (commoner)', 'A0C00Y06', 0]]) {   // each asks the centre for a home it has none of (the probe's: 'Could not find local site ... in Cyrodiil/Imperial City')
      const L = await questLayerAt(world, { pixel: { x: 2069, y: 658 }, location: centre });
      L.machine.setLastNPCClicked({ hash: 1, mapID: centre.mapTableData.mapId, nameSeed: 7, buildingKey: 0, factionID, gender: 0 });
      const t0 = Date.now();
      const quest = quiet(() => L.machine.parseQuestForLists(questSource(name, true), factionID, { rolls: seeded(name.length * 31 + 2069) }));
      const ms = Date.now() - t0;
      assert.ok(quest, `the centre's ${giver} offers ${name} (its local sites the city's)`);
      quiet(() => { L.machine.startQuestImmediate(quest); quest.update(); });
      const local = [...quest.resources.values()].filter((x) => x.isPlace && x.scope === 'local' && x.siteDetails?.worldPixel);
      assert.ok(local.length, `${name}: a local site`);
      for (const place of local) {
        const sd = place.siteDetails, p = sd.worldPixel;
        assert.equal(sliceQuestName(p.x, p.y), sd.locationName, `${name} ${place.symbol.name}: a slice of the city, under its quest name`);
        // the first slice, nearest the centre first, whose own search gives the site's kind (the order itself is pinned on
        // its fixture: auditrelease_r25.test.js R2-5c). PIN MOVED (AUDIT SHIP-READY S11): the search leaves out a building a
        // quest holds (_isBuildingAssigned, Place.cs's), this quest's own site among them, so the site's slice gives its kind
        // by holding it - IC-STAIRS' doors left quarter 34 one Mages Guild hall, and the search walked on past it
        const law = place.declaredSiteLaw();
        let first = null;
        for (const sl of L.questWorld.capitalSlicesNear(L.questWorld.currentLocation())) if (sl.mapTableData.mapId === sd.mapId || place._searchTownSites(L.questWorld, sl, law.p2, law.p3).found.length) { first = sl; break; }
        assert.equal(first?.mapTableData.mapId, sd.mapId, `${name} ${place.symbol.name}: the nearest slice that gives its kind (${p.x},${p.y})`);
        assert.equal(L.questWorld.maps.getLocationByName(sd.regionName, sd.locationName)?.mapTableData.mapId, sd.mapId, `${sd.locationName}: found by its name`);
        assert.ok(place.siteBuilding(L.questWorld), `${sd.locationName}: its building stands`);
        table.push(`| ${giver} | Cyrodiil (Imperial City, the centre) | ${name} | ${place.symbol.name} (local): ${sd.locationName} (building) @ ${p.x},${p.y} | yes | yes | - | ${ms} ms |`);
      }
    }
  }
  // R2-5e: THE COUNTRYSIDE - the nearest countryside places stand as themselves, and a Skyrim giver's remote building is
  // near: within the countryside's reach of Solitude for at least one of them
  const { countryNear } = world.places.provinceQuestPlaces;
  const rural = countryNear(1569, -430, 24, 16, 32);
  assert.ok(rural.length >= 8, `${rural.length} countryside places near Solitude`);
  for (const c of rural) assert.equal(standAt(c.px, c.py)?.mapTableData.mapId, c.mapId, `${c.name} @ ${c.px},${c.py} stands as itself`);
  assert.ok(countryNear.rolled <= 32);
  assert.ok(countryNear(1569, -430, 24, Infinity, 5).length <= 5, 'at most the pixels it may read');
  // round the Imperial City, among its outskirts' Arena towns, every countryside row stands as itself: no row on a pixel the build stands an Arena place or a capital on
  for (const c of countryNear(2069, 658, 24, Infinity, 64)) assert.equal(standAt(c.px, c.py)?.mapTableData.mapId, c.mapId, `${c.name} @ ${c.px},${c.py} stands as itself`);
  assert.ok(table.some((row) => /\| Skyrim \(Solitude\) \|.*\(building\) @ (\d+),(-?\d+)/.test(row) && (([, x, y]) => Math.max(Math.abs(Number(x) - 1569), Math.abs(Number(y) + 430)) <= 24)(/@ (\d+),(-?\d+)/.exec(row))), 'a Skyrim courier\'s town near');
  // R2-5b: the Imperial City a destination - a remote site drawn in one of its district slices, under its quest name
  assert.ok(table.some((row) => / \| Cyrodiil .*: [A-Za-z ]+ District, quarter \d+ \(building\)/.test(row)), 'a site in a district slice of the Imperial City');
  // the lairs' work at a new questor's pixel, bounded
  lairsNear(2600, 200, PROVINCE_LAIR_REACH, PROVINCE_LAIR_COUNT, PROVINCE_LAIR_ROLLS);
  assert.ok(lairsNear.rolled <= PROVINCE_LAIR_ROLLS, `${lairsNear.rolled} first rolls`);
  // SAVE, RELOG: nothing stood any more, the player on the Bay (Daggerfall's pixel) - every site found again by its name
  const bay = world.maps.getLocationByName('Daggerfall', 'Daggerfall');
  const bayPixel = longitudeLatitudeToMapPixel(bay.mapTableData.longitude, bay.mapTableData.latitude);
  for (const { where, data, uid } of kept) {
    world.locationIndex.clear();
    const L = await questLayerAt(world, { pixel: bayPixel, location: bay });
    quiet(() => L.machine.restoreSaveData(structuredClone(data)));
    const q = L.machine.getQuest(uid);
    assert.ok(q, `${where}: the quest loaded`);
    for (const place of [...q.resources.values()].filter((x) => x.isPlace && x.siteDetails?.worldPixel)) {   // R2-5b: its local sites too (a capital slice's under its quest name)
      const sd = place.siteDetails;
      // the region's name lookup first, as quest/place.js siteTown and fitSiteToBuild and questRepair.js's re-lay read it
      const idx = L.questWorld.maps.getRegion(sd.regionIndex).mapNameLookup.get(sd.locationName);
      assert.equal(L.questWorld.maps.getLocation(sd.regionIndex, idx)?.mapTableData.mapId, sd.mapId, `${where} ${sd.locationName}: its region's lookup finds it after the load, from the Bay`);
      assert.equal(L.questWorld.maps.getLocationByName(sd.regionName, sd.locationName)?.mapTableData.mapId, sd.mapId, `${where} ${sd.locationName}: found again after the load, from the Bay`);
      if (sd.siteType === SITE_TYPES.Dungeon) assert.equal(place.fitSiteToBuild(L.questWorld), false, `${sd.locationName}: the same dungeon`);
      if (sd.siteType === SITE_TYPES.Building) assert.ok(place.siteBuilding(L.questWorld), `${sd.locationName}: the same building`);
    }
  }
  // THE BAY UNCHANGED: a Fighters Guild in Daggerfall draws the Bay's own places (MAPS.BSA's region, no pixel of its own)
  const L = await questLayerAt(world, { pixel: bayPixel, location: bay });
  const quest = quiet(() => L.machine.parseQuestForLists(questSource('M0B00Y07', true), 41, { rolls: seeded(7) }));
  assert.ok(quest, 'the Bay\'s guild offers work');
  for (const place of [...quest.resources.values()].filter((x) => x.isPlace)) {
    assert.ok(place.siteDetails.regionIndex < 62 && !place.siteDetails.worldPixel, `${place.symbol.name}: ${place.siteDetails.locationName} the Bay's`);
    table.push(`| Fighters Guild | the Bay (Daggerfall) | M0B00Y07 | ${place.symbol.name}: ${place.siteDetails.locationName} (${place.siteDetails.regionName}) | yes | MAPS.BSA | - | - |`);
  }
  console.log(['| giver | province | quest | site | resolves | marker | placed on arrival | parse |', '|---|---|---|---|---|---|---|---|', ...table].join('\n'));
});

// ─── WITH ARENA2: THE IMPERIAL CITY'S SLICES' SITES INDEX (R2-5f), COLD AT THE CENTRE ─────────────────────

/** Quests-Places' town rows (p1 0): random, house, shop, each building type, the guild halls by faction. */
const TOWN_ROWS = [[-1, 0], [-1, 1], [-1, 2], ...Array.from({ length: 24 }, (_, t) => (t === 11 ? [[11, 0], [11, 40], [11, 41]] : [[t, 0]])).flat()];

test('R2-5f with ARENA2: the Imperial City\'s slices\' sites index - cold at the centre, a Mages Guild\'s (N0B20Y02) and a commoner\'s (A0C00Y06) local sites the city gives stand one slice a search, the one the index picks (the stands equal the slices picked: 2 and 3), the draw the walk\'s over every slice nearest first, which stands far more; a temple\'s remote house2 in the Temple District stands only slices whose index holds one, the same draw as darts that stand every slice they land on; none of the city\'s own cells made for a walk; every slice a site may stand in read off its clone before it stands, the clone the slice the build then stands and its index the search\'s own answer there for each town row of Quests-Places (mutants: the city\'s admit; the dart\'s refusal; the index and the count not handed on; the seams - the index, the refusal, the slice read; the slice read off its stood self, or stood; its Arena slot)', { skip: HAVE ? false : 'ARENA2_PATH not set (or a file missing) - the freeware end to end skipped', timeout: 900_000 }, async () => {
  const { standWorldPastBay, questLayerAt } = await import('./r25World.mjs');
  const { loadTables, questSource } = await import('../../qlSources.mjs');
  const { imperialBlockOf } = await import('../../../src/world/imperialBlocks.js');
  const { capitalSpanPixels, capitalPixel, CAPITALS } = await import('../../../src/world/tamrielCapitals.js');
  const { isUnsitedSlice } = await import('../../../src/scenes/quest/questProvinceSites.js');
  loadTables();
  QUEST_REACH_TUNING.override = true;   // NEARBY-QUESTS, as the game's default has it
  after(() => { QUEST_REACH_TUNING.override = null; });
  const world = await standWorldPastBay(ARENA2);   // its own: no slice of the city stood, no index read
  const pqp = world.places.provinceQuestPlaces;
  // what the quest layer stands and makes: a slice's stands by whom (the city's search, or anything else), the city's own cells
  let inCity = 0;
  const cityStands = [], sliceStands = [], ownMade = [];
  const blocks = Object.create(world.blocks, { getBlockByName: { value: (name) => { if (imperialBlockOf(name)) ownMade.push(name); return world.blocks.getBlockByName(name); } } });
  const counted = { ...world, blocks, places: { ...world.places, provinceQuestPlaces: { ...pqp, standAt: (x, y) => {
    if (sliceQuestName(x, y) != null) (inCity ? cityStands : sliceStands).push(`${x},${y}`);
    return pqp.standAt(x, y);
  } } } };
  /** The quest layer's city search, its stands told apart: every step of the generator is the city's. */
  const watchCity = (qw) => {
    const raw = qw.capitalSlicesNear;
    qw.capitalSlicesNear = (loc, admits) => {
      const it = raw(loc, admits)[Symbol.iterator]();
      const step = (fn) => { inCity++; try { return fn(); } finally { inCity--; } };
      return { [Symbol.iterator]: () => ({ next: () => step(() => it.next()), return: (v) => step(() => it.return?.(v) ?? { done: true, value: v }) }) };
    };
  };
  /** The walk as before R2-5f: every slice nearest first stood and searched, every dart's slice stood and walked. */
  const unindexed = (qw) => { const raw = qw.capitalSlicesNear; qw.capitalSlicesNear = (loc) => raw(loc); qw.siteIndexRefuses = () => false; };
  const quiet = (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; } };
  const seeded = (seed) => () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
  const sitesOf = (q) => [...q.resources.values()].filter((x) => x.isPlace).map((x) => `${x.symbol.name}=${x.siteDetails?.mapId}:${x.siteDetails?.buildingKey}`);
  const parse = async (at, location, name, factionID, prep) => {
    const L = await questLayerAt(counted, { pixel: { x: at[0], y: at[1] }, location });
    prep(L.questWorld);
    L.machine.setLastNPCClicked({ hash: 1, mapID: location.mapTableData.mapId, nameSeed: 7, buildingKey: 0, factionID, gender: 0 });
    cityStands.length = 0; sliceStands.length = 0; ownMade.length = 0;
    const quest = quiet(() => L.machine.parseQuestForLists(questSource(name, true), factionID, { rolls: seeded(name.length * 31 + at[0]) }));
    assert.ok(quest, `${name} is offered at ${location.name}`);
    return { L, quest, city: cityStands.length, slices: new Set(sliceStands), made: ownMade.length };
  };
  // COLD AT THE CENTRE (no building stands there): each local site the city gives stands the one slice its search picked
  const centre = pqp.standAt(2069, 658);
  assert.equal(centre?.exterior?.buildings?.length, 0, 'the centre stands no building');
  for (const [name, factionID, sites] of [['N0B20Y02', 40, 2], ['A0C00Y06', 0, 3]]) {
    const { L, quest, city, made } = await parse([2069, 658], centre, name, factionID, watchCity);
    const fromCity = [...quest.resources.values()].filter((x) => x.isPlace && x.siteDetails?.nearSite && x.siteDetails.worldPixel && sliceQuestName(x.siteDetails.worldPixel.x, x.siteDetails.worldPixel.y) != null);
    assert.equal(fromCity.length, sites, `${name}: its local sites the city gave`);
    assert.equal(L.questWorld.provinceSites.picked(), sites, `${name}: one slice picked a search`);
    assert.equal(city, L.questWorld.provinceSites.picked(), `${name}: the stands equal the slices picked`);
    assert.equal(made, 0, `${name}: none of the city's own cells made for a walk`);
    // the same draw as the walk over every slice, nearest first, that stands each it reads
    const before = await parse([2069, 658], centre, name, factionID, (qw) => { watchCity(qw); unindexed(qw); });
    assert.deepEqual(sitesOf(before.quest), sitesOf(quest), `${name}: the same draw`);
    assert.ok(before.city > city * 4, `${name}: the walk without the index stood ${before.city} slices, the index ${city}`);
  }
  // A REMOTE DART on a slice whose index holds no building of its kind misses unstood: a temple's remote house2, from the
  // Temple District
  {
    const temple = pqp.standAt(2066, 660);
    const { L, quest, slices, made } = await parse([2066, 660], temple, 'C0B00Y00', 0, () => {});
    const house = [...quest.resources.values()].find((x) => x.isPlace && x.scope === 'remote');
    assert.ok(slices.size > 0, 'the darts landed on slices of the city');
    for (const k of slices) {
      const [x, y] = k.split(',').map(Number);
      assert.ok(siteIndexGives(L.questWorld.provinceSites.sliceIndexAt(x, y), house.declaredSiteLaw().p2, 0), `${sliceQuestName(x, y)} stood: its index holds a house2 (or any house, its fallback)`);
    }
    assert.equal(made, 0, 'none of the city\'s own cells made for a walk');
    const before = await parse([2066, 660], temple, 'C0B00Y00', 0, unindexed);
    assert.deepEqual(sitesOf(before.quest), sitesOf(quest), 'the same draw');
    assert.ok(before.slices.size > slices.size, `the darts without the index stood ${before.slices.size} slices, with it ${slices.size}`);
  }
  // EVERY SLICE A SITE MAY STAND IN, in a world of its own (none of them stood): read off its clone before it stands (nothing
  // stood), the clone the slice the build then stands, and its index the search's own answer there for every town row
  const fresh = await standWorldPastBay(ARENA2), fq = fresh.places.provinceQuestPlaces;
  const L = await questLayerAt(fresh, { pixel: { x: 2069, y: 658 }, location: fq.standAt(2069, 658) });
  const qw = L.questWorld;
  const place = new Place(null);
  place.symbol = new QuestSymbol('_site_');
  let cold = 0, gives = 0;
  const same = (clone, stood, at) => {
    assert.equal(clone.name, stood.name, `${at}: its name`);
    assert.equal(clone.mapTableData.mapId, stood.mapTableData.mapId, `${at}: its map id`);
    assert.deepEqual(clone.exterior.exteriorData.blockNames, stood.exterior.exteriorData.blockNames, `${at}: its blocks`);
    assert.deepEqual(clone.exterior.buildings, stood.exterior.buildings, `${at}: its directory`);
    assert.deepEqual(clone.arena ?? null, stood.arena ?? null, `${at}: its Arena slot`);
  };
  for (const { x, y } of capitalSpanPixels(0)) {
    if (isUnsitedSlice(x, y)) continue;
    const at = `${sliceQuestName(x, y)} @ ${x},${y}`, size = fresh.locationIndex.size;
    assert.equal(fresh.locationIndex.has(`${x},${y}`), false, `${at}: not stood yet`);
    const index = qw.provinceSites.sliceIndexAt(x, y);
    const clone = fq.sliceAt(x, y);
    assert.equal(fresh.locationIndex.size, size, `${at}: read, not stood`);
    const stood = fq.standAt(x, y);
    assert.notEqual(clone, stood, `${at}: read off a clone`);
    same(clone, stood, at);
    assert.equal(fq.sliceAt(x, y), stood, `${at}: once stood, the stood slice`);
    cold++;
    for (const [p2, p3] of TOWN_ROWS) {
      const found = place._searchTownSites(qw, questView(stood), p2, p3).found.length > 0;
      assert.equal(siteIndexGives(index, p2, p3), found, `${at} ${p2}/${p3}: the index is the search's answer`);
      if (found) gives++;
    }
  }
  assert.equal(cold, 257, 'every slice a site may stand in (R2-5b), read cold');
  assert.ok(gives > 500, `${gives} (slice, row) pairs give a site`);
  // a capital of one slice: its clone carries its Arena place's slot as the build stands it
  const sol = capitalPixel(CAPITALS[1]);
  const solClone = fq.sliceAt(sol.px, sol.py);
  assert.ok(solClone.arena, 'Solitude stands its Arena city\'s slot');
  same(solClone, fq.standAt(sol.px, sol.py), 'Solitude');
});
