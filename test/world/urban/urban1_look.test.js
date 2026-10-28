// URBANIZER U1 (2026-10-26; KPbICA's spec, forwarded by the owner: "Buildings assets should utilize more cut stones, bricks,
// half-timbering"; bible/03-World/Urban-Fabric.md section 2): a town past the Bay wears its PROVINCE's building set -
// Daggerfall's own stone, brick and half-timber sets (ClimateSwaps.ApplyClimate's bases) - its ground still its zone's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TOWN_LOOK, TOWN_LOOK_ZONES, townLookBase, withTownLook } from '../../../src/world/urban/townLook.js';
import { BIOMES } from '../../../src/world/tamriel/tamrielBiomes.js';
import { PROVINCE_OF_ID } from '../../../src/world/tamriel/tamrielLand.js';
import { CLIMATE_BASE_TYPES as B, getWorldClimateSettings } from '../../../src/formats/mapsFile.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

test('URBANIZER U1 the provinces\' sets: Skyrim the Mountain\'s stone and timber, High Rock and Cyrodiil the Temperate\'s half-timbering and brick, Hammerfell, Summerset, Elsweyr and Morrowind the Desert\'s sandstone and stucco, Valenwood and Black Marsh the Swamp\'s timber; every province past the Bay named (mutants: a province\'s set moved)', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(TOWN_LOOK).map(([k, v]) => [k, v.base])), {
    Skyrim: B.Mountain, HighRock: B.Temperate, Hammerfell: B.Desert, Sumurset: B.Desert, Valenwood: B.Swamp,
    Elsweyr: B.Desert, BlackMarsh: B.Swamp, Morrowind: B.Desert, Imperial: B.Temperate,
  });
  assert.deepEqual(Object.keys(TOWN_LOOK).sort(), Object.values(PROVINCE_OF_ID).sort(), 'one set a province');
  for (const v of Object.values(TOWN_LOOK)) assert.ok(v.why.length > 10, 'each says why');
});

test('URBANIZER U1 the zones of another stone: Wrothgar, the ash country and the Velothi Mountains and the Jerall the Mountain\'s, Blackwood the Swamp\'s - each a zone of its province (mutants: a zone\'s set moved; a zone left to its province)', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(TOWN_LOOK_ZONES).map(([k, v]) => [k, v.base])), {
    highRockWrothgar: B.Mountain, morrowindAshlands: B.Mountain, morrowindRedMountain: B.Mountain, morrowindVelothi: B.Mountain,
    cyrodiilJerall: B.Mountain, cyrodiilBlackwood: B.Swamp,
  });
  for (const key of Object.keys(TOWN_LOOK_ZONES)) assert.ok(BIOMES.some((b) => b.key === key), `${key} a zone of the biomes`);
  assert.equal(townLookBase('Morrowind', 'morrowindAshlands'), B.Mountain, 'the zone\'s own');
  assert.equal(townLookBase('Morrowind', 'morrowindDeshaan'), B.Desert, 'else the province\'s');
  assert.equal(townLookBase('Morrowind', null), B.Desert);
  assert.equal(townLookBase('Nowhere', null), null, 'a province the table does not name: none');
  assert.equal(townLookBase(null, null), null);
});

test('URBANIZER U1 measured over every zone: the towns whose buildings move off their zone\'s set - Skyrim\'s tundra and pinewoods to stone (Daggerfall\'s MountainWoods is Temperate), Morrowind\'s lowlands and Mournhold\'s Deshaan off the Breton frames, Summerset\'s Auridon, the Jerall to stone, Cyrodiil\'s jungles to half-timbering (mutants: the zone ignored)', () => {
  const moved = BIOMES.filter((b) => townLookBase(b.province, b.key) !== getWorldClimateSettings(b.climate).climateType).map((b) => b.key).sort();
  assert.deepEqual(moved, [
    'cyrodiilColovia', 'cyrodiilJerall', 'cyrodiilNibenay', 'elsweyrTenmar', 'hammerfellDragontail', 'morrowindAscadian', 'morrowindBitterCoast',
    'morrowindDeshaan', 'morrowindGrazelands', 'morrowindStonefalls', 'morrowindTelvanni', 'morrowindVelothiFoot', 'skyrimPinewood', 'skyrimTundra',
    'summersetAuridon', 'summersetEtonNir', 'valenwoodReapersMarch',
  ]);
});

test('URBANIZER U1 the climate a town stands in: only its buildings\' set moves (its ground, its trees, its sky and its people its zone\'s), the zone\'s own kept beside it; the same settings where it already wears it (mutants: the whole climate swapped; the set unmoved)', () => {
  const zone = getWorldClimateSettings(232);   // MountainWoods: Daggerfall's Temperate
  const town = withTownLook(zone, B.Mountain);
  assert.equal(town.climateType, B.Mountain);
  assert.equal(town.zoneClimateType, zone.climateType);
  for (const k of ['worldClimate', 'groundArchive', 'natureArchive', 'skyBase', 'people']) assert.equal(town[k], zone[k], k);
  assert.ok(Object.isFrozen(town));
  assert.equal(withTownLook(zone, zone.climateType), zone, 'already its own');
  assert.equal(withTownLook(zone, null), zone);
  assert.equal(withTownLook(null, B.Mountain), null);
});

test('URBANIZER U1 the host by source: every place past the Bay - Arena\'s places, the countryside\'s towns and the capitals but the Imperial City - stood in its province\'s set (scenes/tamrielPlacesHost.js); a lair keeps its zone\'s (mutants: a site unwired; the Imperial City dressed)', () => {
  const h = rd('src/scenes/tamrielPlacesHost.js');
  assert.match(h, /synthesizeArenaLocation\(template, place, \{ regionIndex, regionName: REGION_NAMES\[regionIndex\], politic: 128 \+ regionIndex, climate: townClimateAt\(px, py, getWorldClimateSettings\(maps\.getClimateIndex\(px, py\)\)\) \}\)/);
  assert.match(h, /synthesizeCountryLocation\(pick\.template, \{ px, py, type: pick\.type, name \}, \{ regionIndex, regionName: REGION_NAMES\[regionIndex\], politic: 128 \+ regionIndex, climate: townClimateAt\(px, py, getWorldClimateSettings\(maps\.getClimateIndex\(px, py\)\)\) \}\)/);
  assert.match(h, /climate: at\.k === 0 \? getWorldClimateSettings\(maps\.getClimateIndex\(px, py\)\) : townClimateAt\(px, py, getWorldClimateSettings\(maps\.getClimateIndex\(px, py\)\)\)/);
  assert.match(h, /synthesizeLairLocation\([^\n]+climate: getWorldClimateSettings\(maps\.getClimateIndex\(px, py\)\) \}\)/, 'a lair its zone\'s');
  assert.equal((h.match(/townClimateAt\(/g) ?? []).length, 3);
});
