#!/usr/bin/env node
// FIELD BUGS 2026-10-22b (bible/01-Overview/bugs/Field-Bugs-2026-10-22b.md): EVERY PERSON A QUEST'S `create npc` HOMES,
// CHECKED ACROSS THE PLAYER'S OWN MAP. Each quest named is started through the real parser and machine from questor towns
// of every region (the player's MAPS.BSA and BLOCKS.BSA, both town packs on the door as the game loads them -
// test/fb1004dArena.mjs), ticked once, and each person a `create npc` of it names is checked on what the player depends on:
// (a `create npc` that has run, after the start-up's tick - one a later task runs is not asked; a questor or an
// individual, whom PlaceAtHome refuses, neither):
//   - assigned: `create npc` gave them their home (Person.PlaceAtHome) - the talk's Where is reads it;
//   - a building: the site names a building of its town as the town is laid out now (the key's block and record) - a
//     house, or the building their group keeps (Person.cs AssignHomeTown: a healer's shop, a noble's palace);
//   - held: a marker of the home holds them (the selected one or a spawn marker - the two the mount reads);
//   - linked: the quest holds a site link to the house (the mount finds it by that);
//   - findable: the town's name is its region's first of that name (Region.MapNameLookup - the travel map's find and the
//     name lookups answer the first);
//   - in region: the home is in the questor's region (a person's first ask never takes another town's, AUDIT QA2).
//
//   ARENA2_PATH=<the player's arena2> node tools/createNpcSweep.mjs                    The Courier and The Delivery Boy
//   ARENA2_PATH=<...> node tools/createNpcSweep.mjs A0C00Y11 A0C01Y03 --towns 6 --seeds 3
//
// Prints each quest's runs and the runs that broke a check, by kind with examples; exit 1 when any did. Said and not
// failed: a home in another region, and a quest NOT MADE in a town - one its region cannot hold (no library on the Isle of
// Balfiera: QuestListsManager offers another, DFU's own) or a story quest made only in its own context. Nothing of ARENA2
// is written. MODS=0 sweeps Daggerfall's own towns.
import { isMain } from './lib/isMain.mjs';

/**
 * Sweep `quests`: `towns` questor towns of each region (spread through its table), `seeds` starts each.
 * @param {string[]} quests
 * @param {{ towns?: number, seeds?: number, mods?: boolean }} [opts]
 */
export async function sweepCreateNpc(quests, { towns = 4, seeds = 2, mods = true } = {}) {
  const { openTowns, seeded, SKIP } = await import('../test/fb1004dArena.mjs');
  if (SKIP) throw new Error(SKIP);
  const { loadTables, questScript, keyParts } = await import('../test/fb1004dTowns.mjs');
  const { QuestMachine } = await import('../src/systems/quest/machine.js');
  const { SITE_TYPES } = await import('../src/systems/quest/place.js');
  const { longitudeLatitudeToMapPixel } = await import('../src/formats/mapsFile.js');
  const { FactionFile, FACTION_TYPES } = await import('../src/formats/factionFile.js');
  const { getPeopleOfCurrentRegion, getCourtOfCurrentRegion, findFactions } = await import('../src/systems/talk/talk.js');
  const { REGION_RACES } = await import('../src/formats/mapsTables.js');
  const { readFileSync } = await import('node:fs');
  loadTables();
  const { maps, blocks } = await openTowns({ mods });
  // the player's own FACTION.TXT - a named person's faction must be the individual it is (Person.cs SetupIndividualNPC)
  const factions = new FactionFile();
  factions.load(new Uint8Array(readFileSync(`${process.env.ARENA2_PATH}/FACTION.TXT`)));
  const dict = factions.factionDict;
  const out = [];
  for (const name of quests) {
    const result = { quest: name, runs: 0, people: 0, ok: 0, /** @type {Record<string, { n: number, eg: string[] }>} */ broke: {} };
    const broke = (/** @type {string} */ kind, /** @type {string} */ eg) => { const k = (result.broke[kind] ??= { n: 0, eg: [] }); k.n++; if (k.eg.length < 4) k.eg.push(eg); };
    for (let r = 0; r < maps.regionCount; r++) {
      const region = maps.getRegion(r);
      if (!region?.locationCount) continue;
      const own = [];
      for (let l = 0; l < region.locationCount; l++) if (region.mapTable[l].locationType <= 2) own.push(l);   // TownCity, TownHamlet, TownVillage
      const step = Math.max(1, Math.floor(own.length / towns));
      for (const l of own.filter((_, i) => i % step === 0).slice(0, towns)) {
        const here = maps.getLocation(r, l);
        const world = {
          maps, getBlock: (/** @type {string} */ n) => blocks.getBlockByName(n), currentLocation: () => here,
          currentRegionIndex: () => r, currentLocationIndex: () => l, currentRegionName: () => region.name,
          isPlayerInLocationRect: () => true, playerInside: () => null, isHouseOwned: () => false, isPlayerHome: () => false,
          playerPixel: () => longitudeLatitudeToMapPixel(here.mapTableData.longitude, here.mapTableData.latitude),
          getClimateIndex: (/** @type {number} */ x, /** @type {number} */ y) => maps.getClimateIndex(x, y),
          buildingNameOpts: () => ({}), getFactionData: (/** @type {number} */ id) => factions.getFaction(id),
          findFactionsOfType: (/** @type {number} */ type) => [...dict.values()].filter((f) => f.type === type),
          currentRegionPeople: () => getPeopleOfCurrentRegion(dict, r)?.id ?? -1, currentRegionCourt: () => getCourtOfCurrentRegion(dict, r)?.id ?? -1,
          currentRegionFaction: () => findFactions(dict, { type: FACTION_TYPES.Province, region: r })[0]?.id ?? -1,   // the world host's _regionFaction
          currentRegionRace: () => REGION_RACES[r] + 1,   // and its currentRegionRace
        };
        for (let s = 1; s <= seeds; s++) {
          result.runs++;
          const tag = `${region.name}/${here.name}#${s}`;
          const machine = new QuestMachine({ nowSeconds: () => 0, world, getReputation: () => 0, changeReputation: () => {} });
          const quest = machine.parseQuestForLists(questScript(name), 0, { rolls: seeded(s * 7919 + l) });
          if (!quest) { broke('not made', tag); continue; }
          try { machine.startQuestImmediate(quest); machine.tick(); } catch (e) { broke('start threw', `${tag}: ${/** @type {Error} */ (e).message}`); continue; }
          const created = new Set([...quest.tasks.values()].flatMap((t) => t.actions).filter((a) => a.constructor?.typeName === 'CreateNpc' && a.isComplete).map((a) => a.npcSymbol?.name));
          let fine = true;
          for (const p of [...quest.resources.values()].filter((x) => x.isPerson && created.has(x.symbol?.name) && !x.isQuestor && !x.isIndividualNPC)) {
            result.people++;
            const who = `${tag} _${p.symbol.name}_`;
            const assigned = p.getAssignedPlaceSymbol();
            if (!assigned) { broke('not assigned', who); fine = false; continue; }
            const sd = quest.getPlace(assigned)?.siteDetails;
            if (sd?.siteType !== SITE_TYPES.Building || !(sd.buildingKey > 0)) { broke('no building', who); fine = false; continue; }
            const reg = maps.getRegion(sd.regionIndex);
            const index = reg.mapTable.findIndex((/** @type {{ mapId: number }} */ t) => t.mapId === sd.mapId);
            const at = `${who} -> ${sd.regionName}/${sd.locationName}`;
            if (sd.regionIndex !== r) broke('another region', at);
            if (reg.mapNameLookup?.get?.(sd.locationName) !== index) { broke('not findable by name', at); fine = false; }
            const town = maps.getLocation(sd.regionIndex, index);
            const [x, y, rec] = keyParts(sd.buildingKey >= 0x1000000 ? 0 : sd.buildingKey);   // BuildingDirectory's key 0 is 1 << 24 (talkTopics.js makeBuildingKey)
            const ed = town.exterior.exteriorData;
            const block = ed.blockNames[y * ed.width + x];
            const type = blocks.getBlockByName(block)?.rmbBlock?.fldHeader?.buildingDataList?.[rec]?.buildingType;
            if (!Number.isInteger(type) || type < 0) { broke('no building as laid out', `${at} ${block}#${rec}`); fine = false; }   // BuildingTypes.None is -1; Alchemist is 0
            const holds = (/** @type {any} */ m) => (m?.targetResources ?? []).some((/** @type {any} */ t) => t.name === p.symbol.name);
            if (![sd.selectedMarker, ...(sd.questSpawnMarkers ?? [])].some(holds)) { broke('held by no marker', at); fine = false; }
            if (!machine.getSiteLinks(SITE_TYPES.Building, sd.mapId, sd.buildingKey)?.some((/** @type {any} */ k) => k.questUID === quest.uid)) { broke('no link of its own', at); fine = false; }
          }
          if (fine) result.ok++;
        }
      }
    }
    out.push(result);
  }
  return out;
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = (/** @type {string} */ f, /** @type {number} */ d) => { const i = args.indexOf(f); return i >= 0 ? Number(args.splice(i, 2)[1]) : d; };
  const towns = flag('--towns', 4), seeds = flag('--seeds', 2);
  const quests = args.length ? args : ['A0C00Y15', 'A0C00Y14'];
  const results = await sweepCreateNpc(quests, { towns, seeds, mods: process.env.MODS !== '0' });
  let bad = 0;
  for (const r of results) {
    console.log(`${r.quest}: ${r.ok}/${r.runs} runs whole, ${r.people} people checked`);
    for (const [kind, k] of Object.entries(r.broke)) { console.log(`  ${kind}: ${k.n}  e.g. ${k.eg.join(' | ')}`); if (kind !== 'another region' && kind !== 'not made') bad += k.n; }
  }
  process.exit(bad ? 1 : 0);
}
