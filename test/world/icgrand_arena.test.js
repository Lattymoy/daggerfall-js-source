// IC-GRAND (2026-10-26, the owner: "The arena in daggerfall needs to replace the collisium we currently have in IC. Dont
// remove it from daggerfall."; bible/11-Multiplayer/Arena.md IC-GRAND, bible/03-World/Arena-Provinces.md IC-GRAND) - THE
// IMPERIAL CITY'S ARENA DAGGERFALL'S, pinned: TESA11's Colosseum of the port's own gone (its model, its builder, its ground
// law, its gate); Kamer's arena block (ARENADAG.RMB - his colosseum 864102, his props, his lights, the gate's people and
// the 43600 stair) laid in the Arena District's heart cell, served by the same port block Daggerfall's is; its stair the
// undercroft's door there too; Daggerfall's own arena as it stood.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { IMPERIAL, IMPERIAL_MODELS, IMPERIAL_ARENA_CODE, imperialArenaCell, imperialArenaAt, imperialCell, imperialDistrictAt, imperialBearing, imperialRoadAt, districtHeart } from '../../src/world/imperialCity.js';
import { CAPITALS, synthesizeCapitalLocation, ownBlockOf } from '../../src/world/tamrielCapitals.js';
import { sliceOfCell } from '../../src/world/imperialBlocks.js';
import { fabricKeptClear, CLEAR } from '../../src/world/imperialFabric.js';
import { ARENA_BLOCK, ARENA_BLOCK_INDEX, ARENA_CELL, ARENA_GATE_PEOPLE, isArenaCity, standsArena, standArenaInLocation, undercroftLocation, isArenaUndercroft, isUndercroftDoor } from '../../src/world/arena/arenaCity.js';
import * as capitalImperial from '../../src/world/capitalImperial.js';
import * as imperialCity from '../../src/world/imperialCity.js';
import { BLOCK_M } from '../../src/world/spawnedDungeons.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const IC = CAPITALS[0], N = 25, B = BLOCK_M;
const fh = { rmbBlock: { fldHeader: { numBlockDataRecords: 1, buildingDataList: [{ buildingType: 9, factionId: 0, quality: 5 }] } } };
const base = { name: 'B', regionIndex: 26, regionName: 'Imperial', politic: 154, climate: {}, hasDungeon: false, mapTableData: { mapId: 9, locationType: 0 }, exterior: { exteriorData: { blockNames: ['X'], width: 1, height: 1 }, buildings: [] } };
const names = new Map(['GENR', 'ARMR', 'ALCH', 'GEMS', 'BOOK', 'PAWN', 'BANK', 'TVRN', 'RESI', 'FIGH', 'TEMP', 'LIBR', 'THIE', 'MAGE'].map((k) => [k, [`${k}AA00.RMB`]]));
const slice = (s) => synthesizeCapitalLocation({ cap: IC, k: 0, s }, { base, names, blockOf: (n) => (n.startsWith('TES') || n === ARENA_BLOCK ? null : fh), px: 1, py: 1 });

test('IC-GRAND THE COLOSSEUM GONE - TESA11\'s Colosseum of the port\'s own retired: no measures, no model, no builder, no gate law (mutants: its model back; its measures back)', () => {
  assert.equal(Object.hasOwn(IMPERIAL, 'colosseum'), false);
  assert.equal(Object.values(IMPERIAL_MODELS).includes(910205), false);
  assert.equal(Object.hasOwn(IMPERIAL_MODELS, 'colosseum'), false);
  assert.equal('buildColosseum' in capitalImperial, false);
  assert.equal('colosseumGate' in imperialCity, false);
  assert.doesNotMatch(read('src/world/capitalModels.js'), /buildColosseum|colosseum\]/);
});

test('IC-GRAND DAGGERFALL\'S ARENA IN THE ARENA DISTRICT - its block in the cell under the arena\'s point (bearing 90, at its heart where its avenue meets the middle ring road), the same port block Daggerfall\'s is (one index, no copy), its slice\'s grid naming it; the fabric kept off its cell and a street round it (mutants: the cell another; the block a copy)', () => {
  assert.deepEqual([IMPERIAL.arena.b, IMPERIAL.arena.r], [90, IMPERIAL.heart]);
  const [r, c] = imperialArenaCell(), [x, z] = imperialArenaAt();
  assert.equal(imperialCell(r, c), IMPERIAL_ARENA_CODE);
  assert.equal(imperialDistrictAt(x, z), 'Arena District');
  assert.ok(Math.abs(imperialBearing(x, z) - 90) < 1 && Math.abs(Math.hypot(x, z) - IMPERIAL.heart) < B, 'at the district\'s heart');
  assert.deepEqual(districtHeart('Arena District').map((v) => Math.round(v) + 0), [IMPERIAL.heart, 0]);
  assert.deepEqual(ownBlockOf(IC, IMPERIAL_ARENA_CODE), { name: ARENA_BLOCK, external: true }, 'Daggerfall\'s own block, served by its own door');
  assert.equal(ARENA_BLOCK_INDEX, 900100);
  const s = sliceOfCell(r, c), loc = slice(s), ed = loc.exterior.exteriorData;
  assert.equal(loc.name, 'Arena District');
  const sx = s % N, sy = Math.floor(s / N), at = (7 - (r - sy * 8)) * 8 + (c - sx * 8);
  assert.equal(ed.blockNames[at], ARENA_BLOCK, 'the grid\'s own cell');
  assert.equal(ed.blockNames.filter((n) => n === ARENA_BLOCK).length, 1);
  for (const [dx, dz] of [[0, 0], [B / 2 - 2, 0], [0, -(B / 2 - 2)], [B / 2 + CLEAR.arena - 1, 0]]) assert.equal(fabricKeptClear(x + dx, z + dz), true, `the fabric off it at ${dx},${dz}`);
  // the district's roads meet at it: its avenue along its north edge, its middle ring road out of its south edge
  const z0 = z - B / 2, z1 = z + B / 2;
  assert.ok(imperialRoadAt(x, z0 - 5)?.kind === 'avenue', 'the avenue at its north edge');
  assert.ok(imperialRoadAt(Math.sqrt(IMPERIAL.heart ** 2 - (z1 + 5) ** 2), z1 + 5)?.kind === 'ring', 'the ring road out of its south edge');
});

test('IC-GRAND ITS STAIR THE UNDERCROFT\'S DOOR - a place stands the arena where it is Daggerfall city or its grid lays the arena\'s block (standsArena), so the 43600 stair in the Imperial City\'s arena takes the hosts to Kamer\'s undercroft too, a record of its own under that place (mutants: Daggerfall alone; any city)', () => {
  const [r, c] = imperialArenaCell(), loc = slice(sliceOfCell(r, c));
  assert.equal(isArenaCity(loc), false);
  assert.equal(standsArena(loc), true);
  assert.equal(standsArena(slice(sliceOfCell(r, c) - 1)), false, 'a slice without it');
  assert.equal(standsArena({ regionIndex: 17, locationIndex: 1231 }), true, 'Daggerfall city');
  assert.equal(standsArena({ regionIndex: 17, locationIndex: 5, exterior: { exteriorData: { blockNames: ['GENRAA00.RMB'] } } }), false);
  const u = undercroftLocation(loc);
  assert.ok(isArenaUndercroft(u) && u.hasDungeon && u.regionIndex === loc.regionIndex && u.exterior === loc.exterior, 'its undercroft under the city');
  assert.equal(isUndercroftDoor({ dfBlock: { name: ARENA_BLOCK }, door: { doorType: 3 } }, 3), true);
  assert.match(read('src/scenes/world.js'), /if \(!isUndercroftDoor\(e, DOOR_TYPE\.DUNGEON_ENTRANCE\) \|\| !standsArena\(city\)\) return \{ dfLocation: city, group: e\.pixelKey \};/);
  // the build marks the pixel that lays the block an arena's (its stage, its Herald) whatever the city
  assert.match(read('src/scenes/pixelBuild.js'), /if \(b\.blockName === ARENA_BLOCK\) arenaOrigin = \[originMatrix\[12\], originMatrix\[13\], originMatrix\[14\]\];/);
});

test('IC-GRAND DAGGERFALL KEEPS ITS OWN - the city\'s cell (4, 3) is the arena\'s in every read of Daggerfall, its edit asked of Daggerfall alone (the Imperial City\'s slices untouched by it); the gate\'s people Daggerfall\'s court\'s, the Royal Guard\'s and the people\'s (RECORDED: the same block stands them in the Imperial City - its factions the owner\'s to say) (mutants: the edit on any city; the cell moved)', () => {
  assert.deepEqual(ARENA_CELL, [4, 3]);
  const [r, c] = imperialArenaCell(), loc = slice(sliceOfCell(r, c)), before = JSON.stringify(loc.exterior.exteriorData.blockNames);
  assert.equal(standArenaInLocation(loc, null, { getBlockByName: () => null }), null, 'no edit of the Imperial City');
  assert.equal(JSON.stringify(loc.exterior.exteriorData.blockNames), before);
  assert.deepEqual([...new Set(ARENA_GATE_PEOPLE.map((p) => p.faction))].sort((a, b) => a - b), [372, 518, 595]);
  assert.match(read('src/world/arena/arenaCity.js'), /export function standArenaInLocation\(dfLocation, maps, blocksFile\) \{\n\s+if \(!isArenaCity\(dfLocation\)\) return null;/);
});
