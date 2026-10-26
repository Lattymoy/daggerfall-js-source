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
import { SITE_TYPES } from '../../../src/systems/quest/place.js';
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
        // the nearest slice that holds its kind: none nearer the centre holds a building of its type and faction
        const kind = place.siteBuilding(L.questWorld);
        const dOf = (q) => Math.max(Math.abs(q.x - 2069), Math.abs(q.y - 658));
        let nearest = null;
        for (const sl of L.questWorld.capitalSlicesNear(L.questWorld.currentLocation())) {
          if (!sl.exterior.buildings.some((b) => b.buildingType === kind.buildingType && (b.factionId ?? 0) === (kind.factionId ?? 0))) continue;
          nearest = longitudeLatitudeToMapPixel(sl.mapTableData.longitude, sl.mapTableData.latitude);
          break;
        }
        assert.ok(nearest && dOf(p) <= dOf(nearest), `${name} ${place.symbol.name}: the nearest slice of its kind (${p.x},${p.y})`);
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
  assert.ok(table.some((row) => /\| Skyrim \(Solitude\) \|.*\(building\) @ (\d+),(-?\d+)/.test(row) && (([, x, y]) => Math.max(Math.abs(x - 1569), Math.abs(y + 430)) <= 24)(/@ (\d+),(-?\d+)/.exec(row))), 'a Skyrim courier\'s town near');
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
