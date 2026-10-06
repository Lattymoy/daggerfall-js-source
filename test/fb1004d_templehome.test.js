// TEMPLE-HOME (FIELD BUGS 2026-10-04d, the town-mods audit: "34 Arkay temples have no house"). Beautiful Villages
// replaces the location files of 34 of Arkay's standalone temples (ReligionTemple) with its TEMPASA2 alone: the temple
// and 25 House5, and no House1-4 - the only houses Place.cs seats a quest's people in. A quest person given no scope
// has a home in the town it is set up in half the time (Person.cs AssignHomeTown: `Place _x_home_ local house`), which
// finds no house there and throws: the quest is never made, and the temple's questor answers "You're too late..."
// (TEXT.RSC 600). Measured at the 34 with the questor clicked (16 draws each): C0B00Y01 failed 505 of 544, C0B00Y03 273
// of 544; in Daggerfall's own temples (TEMPAAA0, its houses round the temple) neither ever fails. DFU does the same
// with the mod installed. (C0B00Y02 fails at every standalone temple, Daggerfall's own too: it needs a local tavern.)
//
// THE FIX, the port's existing curation (systems/layoutPins.js CURATED_CLASSIC, AUDIT WD3 G2's): the 34 are served
// Daggerfall's own, named BY THEIR KEYS - the mod replaces their location files, so a grid read off a host's index is
// the mod's or Daggerfall's by when it was read (world.js fills its index before the pins can ask a type or a grid),
// and only the key answers alike, from the door's first read. The housing promise holds as for the taverns: a record a
// save made there in the mod's layout pins the mod back in (the save's pin wins), a record made now is stamped
// classic. The twelve villages that lay TEMPASA2 out among their own houses keep the author's layout.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CURATED_CLASSIC, curatedOut, pinAt, layoutStampAt, stampVendors, pinsFrom, setLayoutPins, configureLayoutPins, _resetLayoutPins, CLASSIC_LAYOUT } from '../src/systems/layoutPins.js';
import { registerWorldDataAsset, _resetWorldDataReplacement, installWorldDataReplacement, latchWorldDataDoor, getDFLocationReplacementData, locationReplacementFilename } from '../src/formats/worldDataReplacement.js';
import { setValue } from '../src/systems/settings.js';
import { makeLocationKey } from '../src/systems/worldDataVariants.js';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { Place, VALID_HOUSE_TYPES } from '../src/systems/quest/place.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { ROW_CODECS } from '../src/formats/worldDataPack.js';
import { patchJson } from '../src/formats/worldDataJson.js';
import { loadTables, worldOf, questScript } from './fb1004dTowns.mjs';
import { SKIP, BV, BC, packJson, openTowns, everyLocation, seeded } from './fb1004dArena.mjs';

loadTables();
const TEMPLES = CURATED_CLASSIC.find((c) => c.why === 'a temple with no house')?.locations ?? [];
const BURNING_PROPHET = makeLocationKey(1, 44);   // Burning Prophet of Arkay, the first of them
const STAMP = `${BV}@1.4.2`;

const CLASSIC = Symbol('a piece of the player\'s data');
function packValue(P, v) {
  if (Array.isArray(v)) return v.map((x) => (x !== null && typeof x === 'object' ? packValue(P, x) : x));
  if (v === null || typeof v !== 'object') return v;
  const k = Object.keys(v).find((key) => key.startsWith('$') && key !== '$o');
  if (!k) return Object.fromEntries(Object.entries(v).map(([key, x]) => [key, x !== null && typeof x === 'object' ? packValue(P, x) : x]));
  if (k === '$c') return CLASSIC;
  let node;
  if (k === '$n') { const n = P.nodes[v.$n]; node = packValue(P, typeof n === 'string' ? JSON.parse(n) : n); }
  else if (k === '$r') { node = []; for (let i = 0; i < v.$r.length; i += 2) for (let n = 0; n < v.$r[i + 1]; n++) node.push(v.$r[i]); }
  else node = v[k].map((row) => (Array.isArray(row) || typeof row === 'number' ? ROW_CODECS[k](row) : packValue(P, row)));
  return v.$o ? patchJson(node, v.$o.map((op) => (op[0] === 's' || op[0] === 'i' ? [op[0], op[1], packValue(P, op[2])] : op))) : node;
}
const entryOf = (P, name) => { const e = P.files[name]; return typeof e === 'string' ? JSON.parse(e) : e; };
function setAt(P, name, path) {
  for (let file = name; file;) {
    const [, base, ops] = entryOf(P, file);
    const op = ops.find((o) => o[0] === 's' && o[1].join('.') === path);
    if (op) return packValue(P, op[2]);
    file = base[0] === 'f' ? base[1] : null;
  }
  return undefined;
}

const BVP = packJson(BV), BCP = packJson(BC);
const keyOfFile = (n) => { const [, r, l] = /^location-(\d+)-(\d+)\.json$/.exec(n); return makeLocationKey(Number(r), Number(l)); };
/** Every location file of Beautiful Villages' pack that lays TEMPASA2 out alone - read off the pack, whatever the
 *  curation lists. */
const ALONE = Object.keys(BVP.files).filter((n) => /^location-\d+-\d+\.json$/.test(n))
  .filter((n) => JSON.stringify(setAt(BVP, n, 'Exterior.ExteriorData.BlockNames')) === '["TEMPASA2.RMB"]').map(keyOfFile).sort((a, b) => a - b);

/** The pins as world.js's boot first holds them: the mods loaded, and no town's type or grid known yet. */
function boot({ typeOf = () => null, gridOf = () => null } = {}) {
  _resetLayoutPins(); _resetWorldDataReplacement(); installWorldDataReplacement();
  configureLayoutPins({ vendorOn: (v) => v === BV || v === BC, vendorVersion: (v) => ({ [BV]: '1.4.2', [BC]: '0.5.0' })[v], locationTypeOf: typeOf, gridOf });
}

test('TEMPLE-HOME, the curation: the 34 temples are kept from Beautiful Villages by their keys - before any type or grid is known (world.js\'s boot) as after - their records stamped classic, and a record a save made there in the mod pinning it back in; another temple, and a village laying TEMPASA2 out, as the mod has them (mutants: the key unasked; asked only once a type is known)', () => {
  boot();
  registerWorldDataAsset(locationReplacementFilename(1, 44), {}, null, { priority: 10, vendor: BV });
  assert.deepEqual([...(curatedOut(BURNING_PROPHET) ?? [])], [BV], 'no type, no grid: the key answers');
  assert.deepEqual([...pinAt(BURNING_PROPHET).out], [BV], 'the door serves Daggerfall\'s own temple');
  assert.equal(stampVendors(layoutStampAt(BURNING_PROPHET)).has(BV), false, 'a record made there is stamped as it stands, without the mod');
  assert.equal(TEMPLES.length, 34);
  for (const key of TEMPLES) assert.deepEqual([...(curatedOut(key) ?? [])], [BV], `the temple ${key}`);
  // the grid a host holds is the mod's (TEMPASA2) or Daggerfall's (TEMPAAA0) by when it read it: the answer is the same
  const OTHER_TEMPLE = makeLocationKey(1, 46), VILLAGE = makeLocationKey(5, 430);
  for (const grid of [['TEMPASA2.RMB'], ['TEMPAAA0.RMB']]) {
    boot({ typeOf: (k) => (k === VILLAGE ? 2 : 5), gridOf: (k) => (k === VILLAGE ? ['TEMPASA2.RMB', 'FARMAA01.RMB'] : grid) });
    registerWorldDataAsset(locationReplacementFilename(1, 44), {}, null, { priority: 10, vendor: BV });
    assert.deepEqual([...(curatedOut(BURNING_PROPHET) ?? [])], [BV], `the grid read as ${grid}`);
    assert.equal(layoutStampAt(BURNING_PROPHET), CLASSIC_LAYOUT, 'stamped classic');
    assert.equal(curatedOut(OTHER_TEMPLE), null, 'a temple the mod gives houses keeps the mod');
    assert.equal(curatedOut(VILLAGE), null, 'a village laying TEMPASA2 out among its houses is the author\'s');
  }
  // THE HOUSING PROMISE: a save's own pin wins
  assert.equal(pinsFrom([{ locationKey: BURNING_PROPHET, stamp: CLASSIC_LAYOUT, kind: 'quest' }]).size, 0, 'a classic record needs no pin');
  const kept = pinsFrom([{ locationKey: BURNING_PROPHET, stamp: STAMP, kind: 'quest' }]).get(BURNING_PROPHET);
  assert.deepEqual([[...kept.out], [...kept.in]], [[], [BV]], 'a quest\'s temple taken there in the mod keeps the mod\'s temple for that save');
  setLayoutPins(new Map([[BURNING_PROPHET, kept]]));
  assert.equal(layoutStampAt(BURNING_PROPHET), STAMP);
  setLayoutPins(new Map());
});

test('TEMPLE-HOME, the door: a temple\'s location is served Daggerfall\'s own from the FIRST read - world.js fills its index before the pins know a town\'s type or grid - while a temple off the list is served the mod\'s, and a save\'s pin brings the mod\'s back', () => {
  boot();
  setValue('Enhancements', 'AssetInjection', 'True');
  latchWorldDataDoor();
  const json = (name) => ({ Name: name, MapTableData: { MapId: 7, LocationType: 'ReligionTemple' }, Exterior: { BuildingCount: 26, ExteriorData: { BlockNames: ['TEMPASA2.RMB'], Width: 1, Height: 1 } } });
  registerWorldDataAsset(locationReplacementFilename(1, 44), json('Burning Prophet of Arkay'), null, { priority: 10, vendor: BV });
  registerWorldDataAsset(locationReplacementFilename(1, 46), json('Another Temple'), null, { priority: 10, vendor: BV });
  assert.equal(getDFLocationReplacementData(1, 44), null, 'Burning Prophet of Arkay: no replacement - MAPS.BSA\'s own temple');
  assert.deepEqual(getDFLocationReplacementData(1, 46)?.exterior.exteriorData.blockNames, ['TEMPASA2.RMB'], 'a temple off the list: the mod\'s');
  setLayoutPins(new Map([[BURNING_PROPHET, { out: new Set(), in: new Set([BV]), stamp: STAMP, why: 'quest' }]]));
  assert.deepEqual(getDFLocationReplacementData(1, 44)?.exterior.exteriorData.blockNames, ['TEMPASA2.RMB'], 'a save holding a record made there in the mod: the mod\'s temple');
  setLayoutPins(new Map());
  setValue('Enhancements', 'AssetInjection', 'False');
  _resetWorldDataReplacement();
});

test('TEMPLE-HOME, the list against the vendored pack (no game data): the location files of Beautiful Villages\' pack that lay TEMPASA2 out alone are 34 of Arkay\'s temples, Beautiful Cities carrying none of them; TEMPASA2\'s buildings are the temple and House5s, no house a quest seats anyone in; and the curation lists exactly those 34', () => {
  assert.equal(ALONE.length, 34);
  for (const key of ALONE) {
    const file = locationReplacementFilename(key % 100, Math.floor(key / 100));
    assert.equal(BCP.files[file], undefined, `${BC} does not carry ${file}`);
    assert.match(entryOf(BVP, file)[1][3], / of Arkay$/, `${file} is one of Arkay's temples`);
  }
  const types = setAt(BVP, 'TEMPASA2.RMB.json', 'RmbBlock.FldHeader.BuildingDataList').map((b) => BUILDING_TYPES[b.BuildingType] ?? b.BuildingType);
  assert.deepEqual([...new Set(types)].sort((a, b) => a - b), [BUILDING_TYPES.Temple, BUILDING_TYPES.House5], 'the temple and House5s');
  assert.ok(!types.some((t) => VALID_HOUSE_TYPES.includes(t)), 'no House1-4 (Place.cs validHouseTypes)');
  assert.deepEqual([...TEMPLES].sort((a, b) => a - b), ALONE, 'the curation lists every one, and no other');
});

// ---- the player's own temples ----

/** Where a quest person's local home (AssignHomeTown's `Place _x_home_ local house`) asked in `loc` is placed: 'here',
 *  'near' (QUEST-AUDIT II NEAR-SITE - another town's house, where the mods took the town's), or null where it throws. */
function homePlaced(t, loc) {
  const world = { ...t.world(loc), currentLocation: () => loc };
  const say = console.log, warn = console.warn; console.log = () => {}; console.warn = () => {};
  try {
    const home = new Place({ uid: 3, resources: new Map(), hooks: { world }, rolls: () => 0.3 }, 'Place _contact_home_ local house');
    return home.siteDetails.mapId === loc.mapTableData.mapId ? 'here' : 'near';
  } catch { return null; } finally { console.log = say; console.warn = warn; }
}
/** The temple quest `name` asked of the temple's questor in `loc` (the player inside, the questor clicked) with the
 *  draws `rolls`: the quest, or null where its parse failed. */
function askTemple(t, loc, name, rolls) {
  t.maps.getRmbBlockName(loc, 0, 0);
  const block = t.blocks.getBlockByName(loc.exterior.exteriorData.blockNames[0]);
  const record = block.rmbBlock.fldHeader.buildingDataList.findIndex((b) => b.buildingType === BUILDING_TYPES.Temple);
  const temple = { buildingKey: record, name: 'the temple', buildingType: BUILDING_TYPES.Temple, factionId: block.rmbBlock.fldHeader.buildingDataList[record].factionId };
  const world = { ...worldOf({ locations: [], blocks: new Map(), regionIndex: loc.regionIndex, regionName: loc.regionName }), maps: t.maps, getBlock: (n) => t.blocks.getBlockByName(n),
    currentLocation: () => loc, currentRegionIndex: () => loc.regionIndex, currentLocationIndex: () => loc.locationIndex, currentRegionName: () => loc.regionName,
    isPlayerInLocationRect: () => false, playerInside: () => ({ building: temple }) };
  const machine = new QuestMachine({ nowSeconds: () => 0, world, getReputation: () => 0, changeReputation: () => {} });
  machine.lastNPCClicked = { mapID: loc.mapTableData.mapId, buildingKey: temple.buildingKey, factionID: temple.factionId, nameSeed: 77, gender: 0, nameBank: 0, context: 1 };
  const say = console.log, warn = console.warn; console.log = () => {}; console.warn = () => {};
  try { return machine.parseQuestForLists(questScript(name), 0, { rolls }); } catch { return null; } finally { console.log = say; console.warn = warn; }
}

test('TEMPLE-HOME, gated on ARENA2_PATH: with both packs on, each of the 34 stands Daggerfall\'s own temple (TEMPAAA0), where a person\'s local home is placed and C0B00Y01 and C0B00Y03 are always made; a save pinning the mod back in stands its TEMPASA2, which holds no house - PIN MOVED (QUEST-AUDIT II NEAR-SITE): the mods took the temple\'s houses, so the home and the two quests\' houses are taken in the nearest towns, and the two are always made where the audit found them fail - and every other temple of the world has a house of its own under the mods', { skip: SKIP }, async () => {
  const say = console.log; console.log = () => {};
  let t;
  try { t = await openTowns({ mods: true }); } finally { console.log = say; }
  const locOf = (key) => t.maps.getLocation(key % 100, Math.floor(key / 100));
  const DRAWS = 8, QUESTS = ['C0B00Y01', 'C0B00Y03'];
  const failed = { ours: { C0B00Y01: 0, C0B00Y03: 0 }, mods: { C0B00Y01: 0, C0B00Y03: 0 } };
  for (const key of ALONE) {
    const loc = locOf(key);
    assert.equal(loc.mapTableData.locationType, 5, `${loc.name}: a ReligionTemple`);
    assert.deepEqual(loc.exterior.exteriorData.blockNames, ['TEMPAAA0.RMB'], `${loc.name}: Daggerfall's own temple`);
    assert.equal(homePlaced(t, loc), 'here', `${loc.name}: a local home`);
    for (const q of QUESTS) for (let i = 1; i <= DRAWS; i++) if (!askTemple(t, loc, q, seeded(i * 7919 + key))) failed.ours[q]++;
    t.LP.setLayoutPins(new Map([[key, { out: new Set(), in: new Set([BV]), stamp: STAMP, why: 'quest' }]]));
    const modded = locOf(key);
    assert.deepEqual(modded.exterior.exteriorData.blockNames, ['TEMPASA2.RMB'], `${loc.name}: the save's pin stands the mod's temple`);
    assert.equal(homePlaced(t, modded), 'near', `${loc.name}: no house for a local home there - the nearest town's`);
    for (const q of QUESTS) for (let i = 1; i <= DRAWS; i++) if (!askTemple(t, modded, q, seeded(i * 7919 + key))) failed.mods[q]++;
    t.LP.setLayoutPins(new Map());
  }
  const asked = ALONE.length * DRAWS;
  assert.deepEqual(failed.ours, { C0B00Y01: 0, C0B00Y03: 0 }, `never failing in Daggerfall's temples (${asked} asks each)`);
  // PIN MOVED (QUEST-AUDIT II NEAR-SITE): 15 in 16 and 1 in 2 of these failed before
  assert.deepEqual(failed.mods, { C0B00Y01: 0, C0B00Y03: 0 }, `never failing in the mod's temple either (${asked} asks each)`);
  // no other temple of the world is left without a house by the mods
  const bare = [];
  for (const { r, l, loc: other } of everyLocation(t.maps)) {
    if (other?.mapTableData?.locationType !== 5 || ALONE.includes(makeLocationKey(r, l))) continue;
    if (homePlaced(t, other) !== 'here') bare.push(other.name);
  }
  assert.deepEqual(bare, []);
});
