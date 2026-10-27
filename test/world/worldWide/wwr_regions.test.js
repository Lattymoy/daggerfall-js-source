// WW-R (2026-10-24, bible/03-World/World-Wide.md WW-R): THE PROVINCES AS REGIONS - the owner: "Separate regions make
// sense". Each province past the Iliac Bay a region of its own after the Bay's 62; Daggerfall stays High Rock's.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  REGION_NAMES, REGION_RACES, REGION_NAME_BANKS, REGION_PEOPLE, PROVINCE_REGION_NAMES, BAY_REGION_COUNT, CYRODIIL_REGION,
  regionOfTheatre, theatreOfRegion, isProvinceRegion,
} from '../../../src/formats/mapsTables.js';
import { MapsFile } from '../../../src/formats/mapsFile.js';
import { groundMaps, groundPoliticIndex } from '../../../src/world/tamriel/tamrielGround.js';
import { theatreAt, THEATRE_KEYS, BAY_AREA_COUNT } from '../../../src/world/worldWide/worldGrid.js';
import { createWorldPlaces } from '../../../src/world/worldWide/worldPlaces.js';
import { setTamrielTrace, PROVINCE_OF_ID } from '../../../src/world/tamriel/tamrielLand.js';
import { CITIES, PROVINCES } from '../../../src/world/tamriel/tamrielGeography.js';
import { pictureToBay, setTamrielFit } from '../../../src/world/tamriel/tamrielFrame.js';
import { getNameBankOfRegion, BANK_TYPES } from '../../../src/characters/nameHelper.js';
import { REGION_COUNT, createRegionConditions } from '../../../src/systems/region/regionConditions.js';
import { BANK_REGION_COUNT, createBankAccounts, createHouses, padRegionTable, blankAccount } from '../../../src/systems/banking.js';
import { createRelations } from '../../../src/systems/livingWorld/relations.js';
import { CRIMES } from '../../../src/systems/court.js';
import { regionOk, bayRegionOk } from '../../../src/net/nodeLaw.js';
import { CHAT_REGION_COUNT, CHAT_BAY_REGIONS, chatRegionRoom, isChatRoom, SD_REGION_COUNT, relaySupportsProvinceRegions, PROVINCE_REGIONS_RELAY_MIN, RELAY_VERSION, WORLD_WIDE_RELAY_MIN } from '../../../src/net/wire.js';
import { REGION_CHANNELS, regionShardRoom, isRegionShard } from '../../../src/net/hubShards.js';
import { navalWireRecord, validNavalRecord } from '../../../src/systems/naval/navalWire.js';
import { politicClaimed } from '../../../src/systems/gate/gateSite.js';
import { LOCATION_TYPES } from '../../../src/formats/mapsFile.js';
import { codeOnly } from '../../codeOnly.mjs';

setTamrielTrace(null); setTamrielFit(null);   // the authored shape and fit: no player's picture in the suite

const src = (p) => codeOnly(readFileSync(new URL('../../../' + p, import.meta.url), 'utf8'));

/** FALL.EXE's races, the Bay's 62, as they were before WW-R. */
const BAY_RACES = [
  1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 1,
  0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 1,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0,
  0, 1,
];
const cityPixel = (name) => { const c = CITIES.find((x) => x.name === name); return pictureToBay(c.at[0], c.at[1]).map(Math.floor); };

test('WW-R the table: the Bay\'s 62 as they were, the nine provinces after them by their theatres - the map\'s names, the Imperial Province Cyrodiil - and each one\'s theatre its own (mutants: a province\'s number, the theatre\'s inverse)', () => {
  assert.equal(BAY_REGION_COUNT, 62);
  assert.equal(REGION_NAMES.length, 71);
  assert.deepEqual([REGION_NAMES[0], REGION_NAMES[16], REGION_NAMES[17], REGION_NAMES[61]], ["Alik'r Desert", 'Wrothgarian Mountains', 'Daggerfall', 'Cybiades']);
  assert.deepEqual(REGION_NAMES.slice(62), [...PROVINCE_REGION_NAMES]);
  for (let t = 1; t <= 9; t++) {
    const r = regionOfTheatre(t), key = PROVINCE_OF_ID[t];
    assert.equal(r, 61 + t);
    assert.equal(theatreOfRegion(r), t);
    assert.equal(isProvinceRegion(r), true);
    assert.equal(REGION_NAMES[r], key === 'Imperial' ? 'Cyrodiil' : PROVINCES.find((p) => p.key === key).name, `${key}`);
  }
  assert.equal(CYRODIIL_REGION, 70);
  assert.equal(REGION_NAMES[CYRODIIL_REGION], 'Cyrodiil');
  assert.deepEqual([regionOfTheatre(0), regionOfTheatre(10), regionOfTheatre(-1), theatreOfRegion(17), theatreOfRegion(71), theatreOfRegion(-1)], [-1, -1, -1, 0, -1, -1]);
  assert.deepEqual([isProvinceRegion(61), isProvinceRegion(17), isProvinceRegion(71)], [false, false, false]);
});

test('WW-R the people: the Bay\'s races FALL.EXE\'s and their banks the races\' - Daggerfall High Rock\'s Bretons, Sentinel Hammerfell\'s Redguards; a province\'s its own - a Nord\'s bank in Skyrim, the Imperial\'s for an Argonian (NameHelper\'s own) and for Cyrodiil, whose people stand as Bretons (mutants: the Bay\'s races, a province\'s bank, Cyrodiil\'s body)', () => {
  assert.deepEqual(REGION_RACES.slice(0, 62), BAY_RACES);
  assert.deepEqual(REGION_NAME_BANKS.slice(0, 62), BAY_RACES, 'the Bay\'s bank its race, MapsFile.GetNameBankOfRegion\'s');
  assert.deepEqual(REGION_RACES.slice(62), [0, 1, 2, 3, 4, 5, 6, 7, 0]);
  assert.deepEqual(REGION_NAME_BANKS.slice(62), [BANK_TYPES.Breton, BANK_TYPES.Redguard, BANK_TYPES.Nord, BANK_TYPES.DarkElf, BANK_TYPES.HighElf, BANK_TYPES.WoodElf, BANK_TYPES.Khajiit, BANK_TYPES.Imperial, BANK_TYPES.Imperial]);
  assert.deepEqual(REGION_PEOPLE.slice(62), ['Breton', 'Redguard', 'Nord', 'DarkElf', 'HighElf', 'WoodElf', 'Khajiit', 'Argonian', 'Imperial']);
  assert.deepEqual([REGION_PEOPLE[17], REGION_PEOPLE[20]], ['Breton', 'Redguard'], 'Daggerfall is High Rock\'s, Sentinel Hammerfell\'s');
  for (let r = 0; r < 71; r++) assert.equal(getNameBankOfRegion(r), REGION_NAME_BANKS[r]);
  assert.equal(getNameBankOfRegion(64), BANK_TYPES.Nord);
  assert.equal(getNameBankOfRegion(-1), BANK_TYPES.Breton);
  assert.equal(REGION_PEOPLE.length, 71);
});

test('WW-R the politic map past the Bay: a province\'s land its region\'s (128 + its region), the sea about it no region\'s, the Bay to the byte - so MapsFile.getRegionIndexAt names the province under the player (mutants: the Bay composed, a province\'s politic, the clamp)', () => {
  const bayPolitic = (x, y) => (x >= 0 && y >= 0 && x < 1000 && y < 500 ? 128 + ((x + y) % 62) : -1);
  const maps = Object.create(MapsFile.prototype);
  maps.getPoliticIndex = bayPolitic;
  maps.getClimateIndex = () => 231;
  groundMaps(maps);
  for (const [x, y] of [[0, 0], [207, 213], [999, 499], [500, 250]]) {
    assert.equal(maps.getPoliticIndex(x, y), bayPolitic(x, y));
    assert.equal(maps.getRegionIndexAt(x, y), (x + y) % 62, 'the Bay\'s region');
  }
  const [sx, sy] = cityPixel('Solitude');
  assert.equal(theatreAt(sx, sy), THEATRE_KEYS.indexOf('Skyrim'));
  assert.equal(maps.getRegionIndexAt(sx, sy), 64, 'Skyrim');
  for (const [name, key] of [['Wayrest', null], ['Mournhold', 'Morrowind'], ['Imperial City', 'Imperial'], ['Riften', 'Skyrim']]) {
    const c = CITIES.find((x) => x.name === name);
    if (!c || !key) continue;
    const [x, y] = cityPixel(name);
    assert.equal(maps.getRegionIndexAt(x, y), regionOfTheatre(THEATRE_KEYS.indexOf(key)), name);
  }
  assert.equal(maps.getRegionIndexAt(-8000, -8000), 0, 'off the continent: the PAK\'s off-map answer, clamped as always');
  assert.equal(groundPoliticIndex(() => 7)(sx, sy), 128 + 64);
  assert.equal(groundPoliticIndex(() => 7)(5, 5), 7);
  // the region's name and number by MapsFile; no MAPS.BSA record (getRegion null, as an empty Bay region)
  const m = Object.create(MapsFile.prototype);
  Object.defineProperty(m, 'regionCount', { value: 62 });
  assert.deepEqual([m.getRegionName(64), m.getRegionName(70), m.getRegionName(71), m.getRegionName(17)], ['Skyrim', 'Cyrodiil', '', 'Daggerfall']);
  assert.deepEqual([m.getRegionIndex('Skyrim'), m.getRegionIndex('Cyrodiil'), m.getRegionIndex('Nowhere')], [64, 70, -1]);
  // the Bay's gate scan reads the Bay's politic alone
  assert.deepEqual([politicClaimed(128 + 61), politicClaimed(128 + 62), politicClaimed(128 + 105)], [true, false, true]);
  assert.equal(BAY_AREA_COUNT, 62, 'an area is never a province\'s region');
});

test('WW-R a place past the Bay is its province\'s region\'s - never a provider\'s word for a Bay region (mutant: the provider\'s region past the Bay)', () => {
  const [sx, sy] = cityPixel('Solitude');
  const places = createWorldPlaces();
  places.register('beyond', [{ mapId: 1, name: 'Solitude', px: sx, py: sy, type: LOCATION_TYPES.TownCity, region: 17 }]);
  places.register('bay', [{ mapId: 2, name: 'Daggerfall', px: 207, py: 213, type: LOCATION_TYPES.TownCity, region: 17 }]);
  assert.equal(places.at(sx, sy).region, 64);
  assert.equal(places.at(207, 213).region, 17);
});

test('WW-R the stores a region keeps: the law\'s, the banks\' and the houses\' the world\'s regions; a save\'s 62 padded on its restore, its rows kept; a crime in Skyrim Skyrim\'s (mutants: the store\'s length, the padding)', async () => {
  assert.equal(REGION_COUNT, 71);
  assert.equal(BANK_REGION_COUNT, 71);
  assert.equal(createRegionConditions().length, 71);
  assert.equal(createBankAccounts().length, 71);
  assert.equal(createHouses(71).length, 71);
  const saved = createBankAccounts(62);
  saved[17].accountGold = 500;
  const padded = padRegionTable(saved, blankAccount);
  assert.equal(padded, saved, 'the table itself, padded');
  assert.equal(padded.length, 71);
  assert.equal(padded[17].accountGold, 500);
  assert.deepEqual(padded[64], blankAccount(64));
  const { snapshotPlayer, restorePlayer } = await import('../../../src/systems/save/save.js');
  const e = { name: 'Rin', stats: {}, skills: [], skillUses: [], items: [], spells: [], activeEffects: [], level: 1, bankAccounts: createBankAccounts(62), houses: createHouses(62) };
  e.bankAccounts[3].accountGold = 77;
  const back = { stats: {}, items: [] };
  restorePlayer(back, snapshotPlayer(e, {}));
  assert.deepEqual([back.bankAccounts.length, back.houses.length, back.bankAccounts[3].accountGold, back.bankAccounts[70].regionIndex, back.houses[70].regionIndex], [71, 71, 77, 70, 70]);
  const law = createRelations();
  assert.equal(law.report({ crime: CRIMES.Theft, region: 64, at: 1, witnesses: ['a'] }), true);
  assert.equal(law.report({ crime: CRIMES.Theft, region: 71, at: 1, witnesses: ['a'] }), false);
});

test('WW-R the account service: a node\'s region any of the world\'s (a province\'s ground gathered); the books a town keeps the Bay\'s 62, their tables\' CHECKs\' - by name in every one (mutants: the node\'s region the Bay\'s, a town book the world\'s)', () => {
  assert.deepEqual([regionOk(0), regionOk(61), regionOk(64), regionOk(70), regionOk(71), regionOk(-1)], [true, true, true, true, false, false]);
  assert.deepEqual([bayRegionOk(0), bayRegionOk(61), bayRegionOk(62), bayRegionOk(70)], [true, true, false, false]);
  // PIN MOVED (WW7-5, World-Wide.md WW7-5): the town books every region's - the world's towns past the Bay stand (ww7_books.test.js)
  for (const f of ['market', 'writs', 'contracts', 'cards', 'npcReceipts', 'npcHalls', 'npcChapters', 'seaBounty']) {
    const s = src(`server-account/src/${f}.js`);
    assert.match(s, /regionOk\b[^\n]*\} from '\.\.\/\.\.\/src\/net\/nodeLaw\.js'/, `${f}: the world's regions`);
    assert.doesNotMatch(s, /bayRegionOk/, `${f}: no town book the Bay's alone`);
  }
  assert.doesNotMatch(src('src/net/npcChapterLaw.js'), /bayRegionOk/);
  const prof = src('server-account/src/professions.js');
  assert.match(prof, /if \(!isBody && \(!climateHolds\(n\.kind, climate\) \|\| !regionOk\(region\)\)\) return \{ error: 'prof-pixel' \};/, 'a node: the world\'s');
  assert.match(prof, /if \(!regionOk\(region\)\) return \{ error: 'bad-region' \};[^\n]*\s*const day = utcDay\(nowS\);\s*const halls = chaptersOpenFor\(player, env\);/, 'a writ board: the world\'s (WW7-5)');
});

test('WW-R the relay: a province\'s channel opens (PROVINCE-SLEEP: unsplit) where the relay keeps them (the world-wide relay, net/wire.js WORLD_WIDE_RELAY_MIN - world255 on its branch), a client on an older one keeps its region tab off past the Bay; the Abyss census every region\'s (WW5); the naval wire the Bay\'s regions alone (mutants: the channels\' count, the gate, the census, the wire)', () => {
  assert.equal(CHAT_REGION_COUNT, REGION_NAMES.length, 'pinned equal (not imported: the relay\'s graph)');
  assert.equal(REGION_CHANNELS, CHAT_REGION_COUNT);
  assert.equal(CHAT_BAY_REGIONS, BAY_REGION_COUNT);
  assert.equal(SD_REGION_COUNT, CHAT_REGION_COUNT);   // PIN MOVED (WW5, bible/03-World/World-Wide.md WW5): the census counts every region's channel - each lane its own regions (net/superDungeon/sdLaw.js sdLaneRegions), a crowd in Skyrim drawing Skyrim's Hollow
  for (let r = 0; r < 71; r++) {
    assert.equal(isChatRoom(chatRegionRoom(r)), true, `region ${r}`);
    for (let k = 0; k < 4; k++) assert.equal(isRegionShard(regionShardRoom(r, k)), r < 62);   // PIN MOVED (PROVINCE-SLEEP): a province's channel is one, unsplit (test/net/sleepcost.test.js)
  }
  assert.deepEqual([chatRegionRoom(64), chatRegionRoom(64, false), chatRegionRoom(17, false), chatRegionRoom(71)], ['chat:region.64', null, 'chat:region.17', null]);
  assert.equal(PROVINCE_REGIONS_RELAY_MIN, WORLD_WIDE_RELAY_MIN);   // PIN MOVED (AUDIT TESA II Z2): 256 (world255 on its branch), then 260 at the merge with main - one number now, the world-wide relay's
  assert.deepEqual([relaySupportsProvinceRegions(`world${WORLD_WIDE_RELAY_MIN - 1}`), relaySupportsProvinceRegions(`world${WORLD_WIDE_RELAY_MIN}`), relaySupportsProvinceRegions(RELAY_VERSION)], [false, true, true], 'the relay before the world-wide one opens no province\'s channel');
  const ship = (region) => ({ n: 1, classId: 'merchantGalleon', variant: 0, pos: [0, 0, 0], yaw: 0, speed: 0, sails: 0, hull: 1, sail: 1, crew: 1, state: 'afloat', heel: 0, seed: 5, gen: 0, region });
  const word = navalWireRecord({ ships: [ship(64), ship(17)] });
  assert.deepEqual(word.s.map((w) => w.at(-1)), [-1, 17], 'a province\'s region never on the wire - an older build refuses the whole word');
  assert.ok(validNavalRecord(word));
  const wire = src('src/scenes/world.js');
  assert.match(wire, /chatRegionRoom\(index, !!chatLinks\.get\('world'\)\?\.provinceRegionsOk\)/);
  assert.match(src('src/net/online.js'), /this\.provinceRegionsOk = relaySupportsProvinceRegions\(relayV\);/);
  assert.match(wire, /groundMaps\(maps\);/);
  assert.match(src('src/scenes/townTalk.js'), /const npcRaceNow = \(\) => REGION_PEOPLE\[regionNow\(\)\] \?\? 'Breton';/);
});
