// BAY-LEFT-MAPS C7 = E2 (2026-10-27, the owner after AUDIT LEFT IN THE BAY: "Every single thing here needs to be addressed.
// No exceptions."; bible/03-World/Arena-Provinces.md BAY-LEFT-MAPS C7) - A TOWN'S BOOK OF DISCOVERED BUILDINGS BY ITS OWN KEY.
//
// The building half of the discovery store was filed under `<regionIndex>:<name>` by every writer and reader (the door, the
// town map, the talk's reveals, the guild halls' reveals, the lockpick's anti-grind record, the quest re-stamps, a deed's
// residence). Past the Bay a province is ONE region and its names repeat - the registry's 907 listed places on 296 books,
// the Imperial City's 625 slices on 14 - so a door's plaque and the town map named another town's buildings, the I box
// counted its shops, a failed lock barred the same key in every town of the name, a quest's re-stamp landed in the wrong
// one. ONE key-maker now (systems/discovery.js townBookId): the Bay's key byte for byte, a place off the Bay's pixel ids its
// map id after it (`#<mapId>`, the automap's own way). A save from before lets the shared books past the Bay go, a deed's
// house keeping its residence in its own town's book.
import '../modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  townBookId, townBookOf, discoverBuilding, discoveredBuildings, getDiscoveredBuilding, setLastLockpickAttempt, getLastLockpickAttempt,
  snapshotDiscovery, restoreDiscovery, hasDiscoveredLocationId,
} from '../../src/systems/discovery.js';
import { countryPlaceId } from '../../src/world/tamrielCountry.js';
import { capitalPlaceId } from '../../src/world/tamrielCapitals.js';
import { arenaPlaceId } from '../../src/world/arenaLocations.js';
import { lairPlaceId } from '../../src/world/tamrielDungeons.js';
import { etherPlaceId } from '../../src/world/etherPlaces.js';
import { hostText } from '../hostText.mjs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
beforeEach(() => restoreDiscovery(null));

const DAGGERFALL = 1291010263;   // Daggerfall's own MapId (MAPS.BSA): its low 20 bits its pixel's id
const loc = (regionIndex, name, mapId) => ({ regionIndex, name, mapTableData: { mapId } });

test('BAY-LEFT-MAPS C7 THE KEY-MAKER: a Bay place\'s book is the key every save holds, byte for byte - a town of MAPS.BSA, a spawn on a Bay pixel, no id at all, no location at all; a place off the Bay\'s pixel ids (past the Bay, past the Veil) takes its map id after it (mutants: the id read on the Bay; the id never read; a whole id masked)', () => {
  assert.ok((DAGGERFALL & 0xfffff) < 500000, 'Daggerfall\'s id names its Bay pixel');
  assert.equal(townBookOf(loc(17, 'Daggerfall', DAGGERFALL)), '17:Daggerfall');
  assert.equal(townBookId(17, 'Daggerfall', DAGGERFALL), '17:Daggerfall');
  assert.equal(townBookId(5, 'Some Spawn', ((7 << 20) | (250 * 1000 + 400)) >>> 0), '5:Some Spawn', 'a spawn on a Bay pixel id');
  assert.equal(townBookId(3, 'Nowhere'), '3:Nowhere');
  assert.equal(townBookId(3, 'Nowhere', NaN), '3:Nowhere');
  assert.equal(townBookOf(null), '-1:', 'no location: the hosts\' own read, `-1:`');
  assert.equal(townBookOf({ regionIndex: 2, name: 'X' }), '2:X', 'a location with no map table');
  const PAST = [countryPlaceId(1234), capitalPlaceId(0, 3), arenaPlaceId({ provinceIndex: 2, id: 5 }), lairPlaceId(777), etherPlaceId({ cx: 3, cy: 4 })];
  for (const id of PAST) {
    assert.ok((id & 0xfffff) >= 500000, `${id}: off the Bay's pixel ids`);
    assert.equal(townBookId(64, 'Ingmik', id), `64:Ingmik#${id >>> 0}`);
    assert.equal(townBookOf(loc(64, 'Ingmik', id)), `64:Ingmik#${id >>> 0}`, 'its location\'s own id');
  }
});

test('BAY-LEFT-MAPS C7 TWO PLACES OF ONE NAME, TWO BOOKS: a building found in one hamlet of Skyrim is not found in another of its name; a failed lock bars its own town\'s door alone; the Bay\'s one book as before (mutants: the id never read)', () => {
  const a = loc(64, 'Ingmik', countryPlaceId(10)), b = loc(64, 'Ingmik', countryPlaceId(11));
  discoverBuilding(townBookOf(a), { buildingKey: 0x10203, name: 'The Bent Spoon', buildingType: 15 });
  assert.deepEqual(discoveredBuildings(townBookOf(a)).map((r) => r.displayName), ['The Bent Spoon']);
  assert.deepEqual(discoveredBuildings(townBookOf(b)), [], 'the other Ingmik knows none of it');
  setLastLockpickAttempt(townBookOf(a), 0x10203, 41);
  assert.equal(getLastLockpickAttempt(townBookOf(a), 0x10203), 41);
  assert.equal(getLastLockpickAttempt(townBookOf(b), 0x10203), 0, 'its door unbarred');
  const bay = loc(17, 'Daggerfall', DAGGERFALL);
  discoverBuilding(townBookOf(bay), { buildingKey: 7, name: 'The Shop', buildingType: 1 });
  assert.equal(getDiscoveredBuilding('17:Daggerfall', 7)?.displayName, 'The Shop', 'the Bay\'s book is the one it was');
});

test('BAY-LEFT-MAPS C7 A SAVE FROM BEFORE: a Bay book restores byte for byte; a shared book past the Bay (a province\'s region, no map id) is let go - but a deed\'s house in it keeps its residence, in its own town\'s book; a book of the new key restores as it is; the locations half untouched (mutants: the old books kept; the deed\'s record lost; the deed carried by another name; a book\'s own records under a carried one; a carried one dropped by its town\'s book)', () => {
  const sliceId = capitalPlaceId(1, 3);
  const snap = {
    buildings: {
      '17:Daggerfall': { 7: { buildingKey: 7, displayName: 'The Shop', factionId: 0, quality: 3, buildingType: 1, lastLockpickAttempt: 0, customUserDisplayName: 'Mine', isOverrideName: false, oldDisplayName: null } },
      '64:Solitude Market': {
        5: { buildingKey: 5, displayName: 'A shop of another slice', buildingType: 1 },
        9: { buildingKey: 9, displayName: 'Bran\'s residence', buildingType: 2, isOverrideName: true, oldDisplayName: 'Residence' },
      },
      [`64:Ingmik#${countryPlaceId(10)}`]: { 3: { buildingKey: 3, displayName: 'The Bent Spoon', buildingType: 15 } },
      '19:Foo': { 2: { buildingKey: 2, displayName: 'A Betony house', buildingType: 2 } },
    },
    locations: { 250500: { regionName: 'Daggerfall', locationName: 'X' }, [sliceId]: { regionName: 'Skyrim', locationName: 'Solitude Market' } },
  };
  const houses = Array.from({ length: 71 }, (_, r) => ({ regionIndex: r, location: '', mapId: 0, buildingKey: 0 }));
  houses[64] = { regionIndex: 64, location: 'Solitude Market', mapId: sliceId, buildingKey: 9 };
  houses[17] = { regionIndex: 17, location: 'Daggerfall', mapId: DAGGERFALL, buildingKey: 7 };
  restoreDiscovery(JSON.parse(JSON.stringify(snap)), { houses });
  const out = snapshotDiscovery();
  assert.deepEqual(out.buildings['17:Daggerfall'], snap.buildings['17:Daggerfall'], 'the Bay\'s book, byte for byte');
  assert.equal(out.buildings['64:Solitude Market'], undefined, 'the shared book past the Bay let go');
  assert.deepEqual(Object.keys(out.buildings[`64:Solitude Market#${sliceId}`] ?? {}), ['9'], 'the deed\'s house in its own slice\'s book, alone');
  assert.equal(out.buildings[`64:Solitude Market#${sliceId}`][9].displayName, 'Bran\'s residence');
  assert.deepEqual(out.buildings[`64:Ingmik#${countryPlaceId(10)}`], { 3: { buildingKey: 3, displayName: 'The Bent Spoon', buildingType: 15, customUserDisplayName: '', isOverrideName: false, oldDisplayName: null } });
  assert.deepEqual(Object.keys(out.buildings['19:Foo']), ['2'], 'a Bay region\'s book kept, whatever stood past the Veil');
  assert.deepEqual(Object.keys(out.locations).sort(), ['250500', String(sliceId)].sort(), 'the locations half its own law');
  assert.equal(hasDiscoveredLocationId(sliceId), true);
  // no deeds: the shared book goes whole; a deed of another town's name carries nothing
  restoreDiscovery(JSON.parse(JSON.stringify(snap)));
  assert.equal(Object.keys(snapshotDiscovery().buildings).filter((k) => k.startsWith('64:Solitude')).length, 0);
  houses[64] = { ...houses[64], location: 'Solitude Docks' };
  restoreDiscovery(JSON.parse(JSON.stringify(snap)), { houses });
  assert.equal(Object.keys(snapshotDiscovery().buildings).filter((k) => k.startsWith('64:Solitude')).length, 0, 'another town\'s deed carries nothing');
  // a book of the new key beside an old one (no save writes both; the law is whole either way): its own records over a
  // carried one, whichever stood first, and a carried one beside its own
  houses[64] = { ...houses[64], location: 'Solitude Market' };
  const after = JSON.parse(JSON.stringify(snap));
  after.buildings[`64:Solitude Market#${sliceId}`] = { 4: { buildingKey: 4, displayName: 'A house of its own', buildingType: 2 }, 9: { buildingKey: 9, displayName: 'Bran\'s house, renamed', buildingType: 2 } };
  restoreDiscovery(after, { houses });
  let book = snapshotDiscovery().buildings[`64:Solitude Market#${sliceId}`];
  assert.deepEqual([Object.keys(book), book[9].displayName], [['4', '9'], 'Bran\'s house, renamed'], 'the book after the old one');
  const before = { buildings: { [`64:Solitude Market#${sliceId}`]: after.buildings[`64:Solitude Market#${sliceId}`], ...snap.buildings }, locations: snap.locations };
  restoreDiscovery(JSON.parse(JSON.stringify(before)), { houses });
  book = snapshotDiscovery().buildings[`64:Solitude Market#${sliceId}`];
  assert.deepEqual([Object.keys(book), book[9].displayName], [['4', '9'], 'Bran\'s house, renamed'], 'the book before the old one');
  const apart = { buildings: { ...snap.buildings, [`64:Solitude Market#${sliceId}`]: { 4: { buildingKey: 4, displayName: 'A house of its own', buildingType: 2 } } }, locations: snap.locations };
  restoreDiscovery(JSON.parse(JSON.stringify(apart)), { houses });
  book = snapshotDiscovery().buildings[`64:Solitude Market#${sliceId}`];
  assert.deepEqual([Object.keys(book), book[9].displayName], [['4', '9'], 'Bran\'s residence'], 'the carried one beside its own');
  // the save hands the deeds in, restored before the discoveries
  const S = read('src/systems/save/save.js');
  const at = S.indexOf('restoreDiscovery(snap.discovery, { houses: allDeeds(entity.houses) });');   // PIN MOVED (HOUSES-3): every region's three
  assert.ok(at > 0 && S.indexOf('entity.houses = snap.houses?.length') < at, 'with the deeds restored above');
});

test('BAY-LEFT-MAPS C7 ONE KEY-MAKER: every host and module that writes or reads the building half takes townBookId / townBookOf - the world host (the door\'s key, the talk\'s reveals and reads, the guild halls\' reveal, the quest\'s undiscover and its moved site, the I box, a deed inherited, Roleplay Realism\'s armorer, Daggerfall\'s own), the town map, the town talk, the fixed city; no `<region>:<name>` literal stands as a book (mutants: the door\'s key back; the town map\'s key back; the talk\'s reveal back)', () => {
  const W = hostText('src/scenes/world.js');
  for (const re of [
    /discoveryLocationId: \(\) => townBookOf\(_questLoc\(\)\),/,
    /const undiscoverBuildingHere = \(buildingKey, buildingName\) => undiscoverBuilding\(\n\s+townBookOf\(_questLoc\(\)\), buildingKey, true, buildingName \?\? null\);/,
    /const town = townBookId\(was\?\.regionIndex \?\? -1, was\?\.locationName \?\? '', was\?\.mapId\);/,
    /const locationId = townBookOf\(dfLoc\);/,
    /getAnyBuilding: \(buildingKey\) => discoveredBuildings\(townBookOf\(_questLoc\(\)\)\)/,
    /discoverBuilding: \(buildingKey\) => discoverBuilding\(\n\s+townBookOf\(_questLoc\(\)\),/,
    /return loc\?\.name \? discoveredBuildings\(townBookOf\(loc\)\) : \[\];/,
    /discoverBuilding\(townBookId\(region, row\.location, row\.mapId\), \{ buildingKey: key, buildingType: TALK_BUILDING_TYPES\.House1 \}, name\)/,
    /if \(arm && armRec\) discoverBuilding\(townBookOf\(_musicLoc\), armRec, arm\.name\);/,
    /const locId = townBookOf\(city\);/,
  ]) assert.match(W, re);
  assert.match(read('src/scenes/exteriorAutomapToggle.js'), /const locId = townBookOf\(dfLoc\);/);
  assert.match(read('src/scenes/townTalk.js'), /if \(h\.reveal\) discoverBuilding\(townBookId\(regionNow\(\), cityName\(\), topics\?\.mapId\), building, null, questBuildingSource\);/);
  const E = read('src/scenes/exterior.js');
  assert.equal(E.split('townBookId(dfLocation.regionIndex, dfLocation.name ?? locationName, dfLocation.mapTableData?.mapId)').length - 1, 4, 'the fixed city\'s four (the Bay\'s own key by the same law)');
  // the sweep: no `${...regionIndex...}:${...name...}` literal left in a host as a book (the dungeon's place hold is no book)
  const raw = /`\$\{[^`]*region(?:Index|Now)[^`}]*\}:\$\{[^`]*(?:name|Name|location)\b[^`]*\}`/g;
  for (const [file, text] of [['world.js', W], ['exterior.js', E], ['exteriorAutomapToggle.js', read('src/scenes/exteriorAutomapToggle.js')], ['townTalk.js', read('src/scenes/townTalk.js')], ['worldModes.js', hostText('src/scenes/worldModes.js')]]) {
    const left = (text.match(raw) ?? []).filter((m) => !/locationIndex/.test(m) && !/^`\$\{dfLocation\.regionIndex\}:\$\{dfLocation\.name\}`$/.test(m) && !/^`\$\{regionIndex\}:\$\{name\}`$/.test(m));
    assert.deepEqual(left, [], `${file}: every book by the key-maker`);
  }
  assert.match(hostText('src/scenes/worldModes.js'), /placeHoldOf\('dungeon', `\$\{dfLocation\.regionIndex\}:\$\{dfLocation\.name\}`\)/, 'the one left: a dungeon\'s place hold (PLACE-LRU), no book');
  assert.match(hostText('src/scenes/worldModes.js'), /const locId = discoveryLocationId\?\.\(\) \?\? null;/, 'the interior host reads the world host\'s key-maker');
});

// ── ON THE PLAYER'S DATA ──────────────────────────────────────────────────────────────────────────────────────────

const ARENA2 = process.env.ARENA2_PATH ?? '';
const HAS = !!ARENA2 && ['MAPS.BSA', 'ART_PAL.COL', 'TAMRIEL2.IMG', 'TMAP00I0.IMG', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(ARENA2, f)));

test('BAY-LEFT-MAPS C7 on the player\'s data: the registry\'s 907 listed places past the Bay stand on 907 books (lane C\'s p6 and lane E: 296 before, the Imperial City\'s 625 slices on 14), and every one of MAPS.BSA\'s towns keeps its book byte for byte', { skip: !HAS && 'no ARENA2_PATH' }, async () => {
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const { DFPalette } = await import('../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../src/ui/tamrielTrace.js');
  const { setTamrielTrace } = await import('../../src/world/tamriel/tamrielLand.js');
  const { setTamrielFit } = await import('../../src/world/tamriel/tamrielFrame.js');
  const { MapsFile } = await import('../../src/formats/mapsFile.js');
  const { arenaTemplates, arenaTemplateOf } = await import('../../src/world/arenaLocations.js');
  const { arenaPixels } = await import('../../src/world/arenaPlaces.js');
  const { pastBayPlaceRows, PAST_BAY_SOURCE } = await import('../../src/world/pastBayRows.js');
  const { createWorldPlaces } = await import('../../src/world/worldWide/worldPlaces.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });   // the freeware's fit
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const rows = [];
  let bay = 0;
  for (let r = 0; r < maps.regionCount; r++) {
    if (!maps.getRegion(r)) continue;
    for (let l = 0; l < maps.baseLocationCount(r); l++) {
      const l0 = maps.getLocation(r, l);
      if (!l0) continue;
      assert.equal(townBookOf(l0), `${l0.regionIndex}:${l0.name}`, `${l0.name}: the Bay's book byte for byte`);
      bay++;
      if (l0.exterior?.exteriorData) rows.push(l0);
    }
  }
  assert.ok(bay > 15000, `${bay} of the Bay's places`);
  const tesa = pastBayPlaceRows({ pixels: arenaPixels(), templateOf: (p) => arenaTemplateOf(arenaTemplates(rows), p), capitals: true });
  const places = createWorldPlaces();
  places.register(PAST_BAY_SOURCE, tesa);
  const old = new Set(), books = new Set();
  for (const p of tesa) {
    const region = places.at(p.px, p.py)?.region;
    old.add(`${region}:${p.name}`);
    books.add(townBookId(region, p.name, p.mapId));
  }
  assert.deepEqual([tesa.length, old.size, books.size], [907, 296, 907]);
});
