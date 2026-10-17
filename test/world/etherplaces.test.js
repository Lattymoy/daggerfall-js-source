// ETHER-PLACES (2026-10-11, the owner: "procedural islands with towns, dungeons") - THE ISLES' PLACES
// (bible/03-World/Eltheric-Ocean.md ETHER-PLACES): a port isle's town and a ruin isle's dungeon, each a non-mutating clone
// of one of the game's own places on its isle's centre pixel under its own id (a lane of its own, past every pixel id of
// the Bay), name and location index; the templates the game's own rows in map-id order; the world host's hooks - the
// build, the Overworld's far reads, a ruin's online wake, the ports. tools/mutants/etherplaces.json.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ETHER_PLACE_SALT, ETHER_PLACE_BASE, ETHER_REGION, ETHER_REGION_NAME, TOWN_BLOCKS, ELITE_BANDS, etherPlaceId, etherLocationIndex, isEtherPlaceId,
  etherTemplates, etherTemplateOf, synthesizeEtherLocation,
} from '../../src/world/etherPlaces.js';
import { isleOfCell, veilhaven, CELLS_W, CELLS_H, ETHER_BOX, ISLE_CELL_PX, VEIL_X, LEAGUE_PX } from '../../src/world/ethericSea.js';
import { LOCATION_TYPES, longitudeLatitudeToMapPixel } from '../../src/formats/mapsFile.js';
import { SALT_MAX } from '../../src/world/spawnedDungeons.js';
import { REGION_NAMES } from '../../src/formats/mapsTables.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
/** A place row as MAPS.BSA's reader shapes one - enough of it for the clone. */
const row = (id, type, { w = 1, h = 1, dungeon = false, spawned = false } = {}) => ({
  name: `Row ${id}`, regionIndex: 17, regionName: 'Daggerfall', politic: 145, climate: { climateType: 0 }, locationIndex: id,
  hasDungeon: dungeon, spawned,
  mapTableData: { mapId: id, locationType: type, longitude: 1, latitude: 2 },
  exterior: { exteriorData: { width: w, height: h, locationId: id, blockNames: [] }, buildings: [{ id: 1 }] },
  ...(dungeon ? { dungeon: { blocks: [{ name: 'B' }], recordElement: { header: { locationId: id } } } } : {}),
});
const isles = (() => { const out = []; for (let cy = 200; cy < 260; cy++) for (let cx = 300; cx < 360; cx++) { const i = isleOfCell(cx, cy); if (i) out.push(i); } return out; })();
const port = isles.find((i) => i.kind === 'port'), ruin = isles.find((i) => i.kind === 'ruin');

test('ETHER-PLACES the id: its own lane in the high 12 bits - never the spawns\' 1, the zone halls\' 7, the Ocean Holes\' 0x600 nor the Abyss Dungeons\' 2049 and up - and the cell\'s own number past every pixel id of the Bay; one id a cell, the whole sea inside 20 bits (mutants: the lane, the base, the cell\'s number)', () => {
  assert.equal(ETHER_PLACE_SALT, 0xe7); assert.equal(ETHER_PLACE_BASE, 500000);
  for (const used of [1, 7, 0x600]) assert.notEqual(ETHER_PLACE_SALT, used);
  assert.ok(ETHER_PLACE_SALT < 2049 && ETHER_PLACE_SALT <= SALT_MAX);
  const id = etherPlaceId(port);
  assert.equal(id >>> 20, ETHER_PLACE_SALT);
  assert.equal(id & 0xfffff, ETHER_PLACE_BASE + port.cy * CELLS_W + port.cx);
  assert.ok((id & 0xfffff) >= 500000, 'past getMapPixelID\'s ceiling: no place of the Bay shares it');
  assert.ok(ETHER_PLACE_BASE + (CELLS_H - 1) * CELLS_W + CELLS_W - 1 < 0x100000, 'the whole sea inside 20 bits');
  assert.equal(new Set(isles.map(etherPlaceId)).size, isles.length, 'one id a cell');
  assert.equal(isEtherPlaceId(id), true); assert.equal(isEtherPlaceId((1 << 20) | 4321), false, 'a spawn\'s');
  assert.equal(isEtherPlaceId((ETHER_PLACE_SALT << 20) | 499999), false, 'below the base');
  assert.ok(id > 0 && id <= 0xffffffff && Number.isInteger(id));
});

test('ETHER-PLACES the location index: its own negative a cell - never -1, a spawn\'s (the questors\' pool and the layout pins key on it) (mutants: the offset, the sign)', () => {
  const ix = isles.map(etherLocationIndex);
  assert.ok(ix.every((v) => v <= -1000));
  assert.equal(new Set(ix).size, ix.length);
  assert.equal(etherLocationIndex(port), -(1000 + port.cy * CELLS_W + port.cx));
});

test('ETHER-PLACES the templates: the game\'s rows - towns hamlets and villages of TOWN_BLOCKS.port blocks, havens towns of TOWN_BLOCKS.haven, never main-story or with a dungeon under it, never a spawn; ruins dungeons with blocks, one block where any is - each list in map-id order (mutants: each filter, the order)', () => {
  // PIN MOVED (AUDIT CAPTAIN'S SEA P1): Veilhaven's a hamlet of six to twelve - MAPS.BSA's villages are 2 or 4 blocks and its
  // cities 30 and more, so the havens of villages and cities were always none; twelve the most its small isle stands dry
  assert.deepEqual([...TOWN_BLOCKS.port], [2, 6]); assert.deepEqual([...TOWN_BLOCKS.haven], [6, 12]);
  const rows = [
    row(30, LOCATION_TYPES.TownHamlet, { w: 2, h: 1 }), row(10, LOCATION_TYPES.TownVillage, { w: 2, h: 2 }), row(20, LOCATION_TYPES.TownVillage, { w: 1, h: 1 }),
    row(40, LOCATION_TYPES.TownVillage, { w: 3, h: 3 }), row(45, LOCATION_TYPES.TownHamlet, { w: 3, h: 3 }), row(50, LOCATION_TYPES.TownCity, { w: 3, h: 3 }), row(60, LOCATION_TYPES.TownCity, { w: 5, h: 5 }),
    row(70, LOCATION_TYPES.TownVillage, { w: 2, h: 2, dungeon: true }), row(80, LOCATION_TYPES.TownHamlet, { w: 2, h: 1, spawned: true }), row(90, LOCATION_TYPES.HomeFarms, { w: 2, h: 1 }),
    row(110, LOCATION_TYPES.DungeonRuin, { w: 2, h: 1, dungeon: true }), row(105, LOCATION_TYPES.DungeonKeep, { w: 1, h: 1, dungeon: true }), row(100, LOCATION_TYPES.DungeonLabyrinth, { w: 1, h: 1, dungeon: true }),
    row(666, LOCATION_TYPES.TownHamlet, { w: 2, h: 1 }),
    row(46, LOCATION_TYPES.TownHamlet, { w: 4, h: 4 }), row(47, LOCATION_TYPES.TownHamlet, { w: 4, h: 3 }),
    { ...row(48, LOCATION_TYPES.TownHamlet, { w: 3, h: 3 }), ether: '1,1' },   // AUDIT CAPTAIN'S SEA P3: an isle's own place is never a template
  ];
  const t = etherTemplates(rows, (id) => id === 666);
  assert.deepEqual(t.towns.map((l) => l.mapTableData.mapId), [10, 30], 'hamlets and villages of two to six blocks, by id');
  assert.deepEqual(t.havens.map((l) => l.mapTableData.mapId), [40, 45, 47], 'Veilhaven\'s: a hamlet or a village of six to twelve - never a city, never sixteen');
  assert.deepEqual(t.ruins.map((l) => l.mapTableData.mapId), [100, 105], 'the one-block dungeons, by id');
  assert.deepEqual(etherTemplates([row(110, LOCATION_TYPES.DungeonRuin, { w: 2, h: 1, dungeon: true })]).ruins.map((l) => l.mapTableData.mapId), [110], 'none of one block: any');
  assert.deepEqual(etherTemplates(null), { towns: [], havens: [], ruins: [] });
});

test('ETHER-PLACES the template an isle clones: a port\'s a town, Veilhaven\'s a haven (a town where none is), a ruin\'s a ruin, off the isle\'s own hash; a wild isle and a rock none (mutants: each kind\'s list, the hash)', () => {
  const t = { towns: [row(1, 1), row(2, 1), row(3, 2)], havens: [row(9, 0)], ruins: [row(5, 10, { dungeon: true }), row(6, 10, { dungeon: true })] };
  assert.ok(t.towns.includes(etherTemplateOf(t, port)));
  assert.ok(t.ruins.includes(etherTemplateOf(t, ruin)));
  assert.equal(etherTemplateOf(t, veilhaven()), t.havens[0]);
  assert.ok(t.towns.includes(etherTemplateOf({ ...t, havens: [] }, veilhaven())), 'no haven: a town');
  assert.equal(etherTemplateOf(t, isles.find((i) => i.kind === 'wild')), null);
  assert.equal(etherTemplateOf(t, isles.find((i) => i.kind === 'rock')), null);
  assert.equal(etherTemplateOf({ towns: [], havens: [], ruins: [] }, port), null);
  const picks = new Set(isles.filter((i) => i.kind === 'port').map((i) => etherTemplateOf(t, i)));
  assert.equal(picks.size, 3, 'the hash spreads the ports over the towns');
});

test('ETHER-PLACES the clone: the template never written; its ids the place\'s (the map row\'s, the exterior\'s, the dungeon\'s), its longitude and latitude the isle\'s centre pixel, its name the isle\'s, its region the isles\' and its own index; a port\'s exterior a harbour\'s; a ruin of the deep elite (mutants: each field)', () => {
  const tpl = row(10, LOCATION_TYPES.TownVillage, { w: 2, h: 2 });
  const before = JSON.stringify(tpl);
  const loc = synthesizeEtherLocation(tpl, port, { regionIndex: ETHER_REGION, regionName: REGION_NAMES[ETHER_REGION], politic: 128 + ETHER_REGION, climate: { climateType: 9 } });   // PIN MOVED (AUDIT CAPTAIN'S SEA P8): the world's word, its region's own name
  assert.equal(JSON.stringify(tpl), before, 'the template untouched');
  const id = etherPlaceId(port);
  assert.equal(loc.mapTableData.mapId, id); assert.equal(loc.exterior.exteriorData.locationId, id);
  assert.equal(loc.exterior.exteriorData.mapId, id, 'AUDIT CAPTAIN\'S SEA P12: and its exterior\'s map id');
  assert.equal(loc.mapTableData.locationType, LOCATION_TYPES.TownVillage);
  assert.deepEqual(longitudeLatitudeToMapPixel(loc.mapTableData.longitude, loc.mapTableData.latitude), { x: port.px, y: port.py }, 'its pixel, round the map\'s own law');
  assert.equal(loc.name, port.name);
  assert.equal(loc.regionIndex, 19); assert.equal(REGION_NAMES[ETHER_REGION], 'Betony', 'the Bay\'s westernmost isle');
  assert.equal(loc.regionName, 'Betony'); assert.equal(loc.politic, 147); assert.deepEqual(loc.climate, { climateType: 9 });
  assert.equal(synthesizeEtherLocation(tpl, port).regionName, ETHER_REGION_NAME, 'no word: the isles\' own words');
  assert.equal(loc.locationIndex, etherLocationIndex(port));
  assert.equal(loc.exterior.exteriorData.portTownAndUnknown, 1, 'a harbour - the port\'s ships, its quays');
  assert.equal(loc.ether, port.key); assert.equal(loc.etherKind, 'port');
  assert.ok(!loc.spawned, 'never a spawn: no clock, no announcement, no expiry');
  assert.equal(loc.elite, undefined);
  assert.equal(loc.exterior.buildings, tpl.exterior.buildings, 'its buildings the template\'s');
  const dt = row(100, LOCATION_TYPES.DungeonLabyrinth, { dungeon: true });
  const shallowRuin = isles.find((i) => i.kind === 'ruin' && !ELITE_BANDS.includes(i.band));
  const r = synthesizeEtherLocation(dt, shallowRuin ?? ruin);
  assert.equal(r.dungeon.recordElement.header.locationId, etherPlaceId(shallowRuin ?? ruin), 'the dungeon\'s room and save key');
  assert.equal(dt.dungeon.recordElement.header.locationId, 100, 'its template\'s untouched');
  assert.equal(r.exterior.exteriorData.portTownAndUnknown, 0, 'a ruin is no harbour');   // PIN MOVED (AUDIT CAPTAIN'S SEA P10): its template's port byte never kept
  assert.equal(synthesizeEtherLocation({ ...dt, exterior: { ...dt.exterior, exteriorData: { ...dt.exterior.exteriorData, portTownAndUnknown: 8 } } }, shallowRuin ?? ruin).exterior.exteriorData.portTownAndUnknown, 0, 'not even a template that was one');
  assert.equal(r.regionIndex, ETHER_REGION, 'the defaults');
  assert.deepEqual([...ELITE_BANDS], ['deep', 'abyss']);
  const deep = { ...ruin, px: Math.round(VEIL_X - 60 * LEAGUE_PX), band: 'deep' };
  assert.equal(synthesizeEtherLocation(dt, deep).elite, true, 'a ruin of the Deep Aether is elite');
  const reaches = { ...ruin, px: Math.round(VEIL_X - 20 * LEAGUE_PX) };
  assert.equal(synthesizeEtherLocation(dt, reaches).elite, undefined);
  assert.ok(ETHER_BOX.x0 + 300 * ISLE_CELL_PX > 0);
});

test('ETHER-PLACES by source: the world host keeps the isles\' templates off the classic rows before they go, builds an isle\'s pixel through etherPlaceAt (stood in the index once), never clones a spawn past the Veil, wakes an isle\'s ruin\'s sleeper at its own door, and answers its region the isles\' (mutants: each seam)', () => {
  const src = read('src/scenes/world.js');
  assert.match(src, /const _etherTemplates = etherSea \? etherTemplates\(_classicRows \?\? _hubRows\.map\(classicRow\)\.filter\(Boolean\), isMainStoryDungeon\) : null;\n  _classicRows = null;/);
  assert.match(src, /if \(etherSea && inEther\(px, py\)\) return etherPlaceAt\(px, py\);/);
  const body = src.slice(src.indexOf('function etherPlaceAt(px, py) {'), src.indexOf('/** AUDIT OW4 D4: THE CLONE a pixel\'s spawn IS'));
  assert.match(body, /if \(had\?\.ether\) return had;/);
  assert.match(body, /if \(!isle \|\| isle\.px !== px \|\| isle\.py !== py\) return null;/);
  assert.match(body, /synthesizeEtherLocation\(template, isle, \{ regionIndex: ETHER_REGION, regionName: REGION_NAMES\[ETHER_REGION\] \?\? ETHER_REGION_NAME, politic: 128 \+ ETHER_REGION, climate: getWorldClimateSettings\(isle\.climate\) \}\)/);   // PIN MOVED (AUDIT CAPTAIN'S SEA P8)
  assert.match(body, /_locIndexGen \+= 1;\n    locationIndex\.set\(key, loc\);/);
  assert.match(src, /params\.has\('online'\) && !inEtherLaw\(x, y\) && spawnsDungeon\(_spawnSalt, x, y\)/);
  assert.match(src, /const wake = inEther\(from\.x, from\.y\) \? \{ kind: 'dungeon', mapPixel: \{ x: from\.x, y: from\.y \} \} : undergroundWakeSpot/);
  assert.match(src, /etherSea && inEther\(px, py\) \? ETHER_SEA_NAME : REGION_NAMES\[maps\.getRegionIndexAt\(px, py\)\]/, 'the loading screen');
  assert.match(src, /etherSea && inEther\(px\.x, px\.y\) \? ETHER_SEA_NAME : maps\.getRegionName/, 'the Overworld\'s line');
});

test('ETHER-PORTS by source: a port isle answers as a port to the Come Sail Away deeds, the naval host\'s waters, the harbour book (its town\'s harbour sounded - its quays) and the harbour office (no crown\'s); the Eltheric freeport\'s harbourmaster its own tab; the crown\'s waters none past the Veil (mutants: each seam)', () => {
  const src = read('src/scenes/world.js');
  assert.match(src, /if \(etherSea && inEther\(x, y\)\) return !!etherPortAt\(x, y\);/);
  assert.match(src, /const etherPortOf = \(i\) => \(\{ key: `\$\{i\.px\},\$\{i\.py\}`, name: i\.name, px: i\.px, py: i\.py, region: ETHER_REGION, crown: null, ether: true \}\);/);
  assert.match(src, /return i && i\.kind === 'port' && i\.px === x && i\.py === y \? i : null;/);
  assert.match(src, /const isle = etherSea && inEther\(p\.x, p\.y\) \? etherPortNear\(p\.x, p\.y\) : null;/);
  assert.match(src, /if \(loc\?\.exterior\?\.exteriorData\) town = \{ id: `ether:\$\{isle\.key\}`, loc, x: isle\.px, y: isle\.py, name: isle\.name, reach: ETHER_HARBOUR_REACH \};/);   // PIN MOVED (AUDIT CAPTAIN'S SEA H1): sounded out to its isle's shore
  assert.match(src, /_navalPortHereAt = \{ key, port: isle \? etherPortOf\(isle\) : null \};/);
  assert.match(src, /etherSea && inEther\(p\.x, p\.y\) \? null : navalCrownOf\(/);
  assert.match(src, /if \(port\?\.ether\) \{ const o = etherHost\.office\(port\);/);
});
