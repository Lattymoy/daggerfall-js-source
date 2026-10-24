// TESA-BIOME (2026-10-24, bible/03-World/Tamriel-Biomes.md) - the biomes past the Bay: each province split into the
// zones its lore names, each zone's ground, air and jungle; Cyrodiil's jungle standing on the Bantha law past the Bay.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BIOMES, BIOME_BY_KEY, PEAKS_LIFT, BIOME_WANDER, biomeAtPicture, wanderPoint, tamrielBiomeAt, biomeCacheSize, dropBiomeCache, biomeStamp,
} from '../../src/world/tamriel/tamrielBiomes.js';
import { PROVINCES, CITIES, provinceAt, rangeLift, MOUNTAIN_RANGES } from '../../src/world/tamriel/tamrielGeography.js';
import { pictureToBay, bayToPicture, inBay } from '../../src/world/tamriel/tamrielFrame.js';
import { tamrielClimateAt, groundAirClimateIndex, groundClimateIndex } from '../../src/world/tamriel/tamrielGround.js';
import { setTamrielTrace, tamrielLandVersion, provinceKeyBeyondBay } from '../../src/world/tamriel/tamrielLand.js';
import { CLIMATES } from '../../src/formats/mapsTables.js';
import { jungleField } from '../../src/world/jungle/jungleRegion.js';
import { banthaAreaHas } from '../../src/world/jungle/banthaArea.js';
import { createJungleHost } from '../../src/scenes/jungleHost.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const city = (name) => CITIES.find((c) => c.name === name).at;
const biomeOfCity = (name) => { const c = CITIES.find((x) => x.name === name); return biomeAtPicture(c.province, c.at[0], c.at[1])?.key; };
/** a Bay-coordinate pixel at a picture point */
const pixelAt = ([x, y]) => pictureToBay(x, y).map(Math.floor);

test('TESA-BIOME: every province is split into zones - each a climate of the land, its keys apart, its seeds on its own province', () => {
  const keys = BIOMES.map((b) => b.key);
  assert.equal(new Set(keys).size, keys.length, 'keys apart');
  for (const p of PROVINCES) {
    const zones = BIOMES.filter((b) => b.province === p.key);
    assert.ok(zones.length >= 2, `${p.key}: two zones at least`);
    assert.ok(zones.some((b) => !b.peaks || b.seeds.length), `${p.key}: a seeded zone`);
  }
  for (const b of BIOMES) {
    assert.ok(PROVINCES.some((p) => p.key === b.province), b.key);
    assert.ok(Object.values(CLIMATES).includes(b.climate) && b.climate !== CLIMATES.Ocean, `${b.key}: a land climate`);
    if (b.air != null) assert.ok(Object.values(CLIMATES).includes(b.air), `${b.key}: its air a climate`);
    for (const [x, y] of b.seeds) assert.equal(provinceAt(x, y)?.key, b.province, `${b.key}'s seed ${x},${y} stands on its own province`);
    assert.equal(BIOME_BY_KEY.get(b.key), b);
  }
  assert.equal(BIOMES.filter((b) => b.peaks).length, 6, 'six provinces have peaks: Skyrim, High Rock, Hammerfell, Summerset, Morrowind, Cyrodiil');
});

test('TESA-BIOME: the lore\'s places stand in the lore\'s zones', () => {
  const want = {
    'Imperial City': 'cyrodiilNibenay', Cheydinhal: 'cyrodiilNibenay', Bravil: 'cyrodiilNibenay', Leyawiin: 'cyrodiilBlackwood',
    Chorrol: 'cyrodiilColovia', Skingrad: 'cyrodiilColovia', Anvil: 'cyrodiilGoldCoast', Kvatch: 'cyrodiilGoldCoast', Bruma: 'cyrodiilJerall',
    Solitude: 'skyrimFrozenCoast', Dawnstar: 'skyrimFrozenCoast', Winterhold: 'skyrimFrozenCoast', Whiterun: 'skyrimTundra',
    Morthal: 'skyrimTundra', Falkreath: 'skyrimPinewood', Riften: 'skyrimPinewood', Markarth: 'skyrimReach',
    Mournhold: 'morrowindDeshaan', Tear: 'morrowindDeshaan', Necrom: 'morrowindDeshaan', "Ald'ruhn": 'morrowindAshlands',
    Vivec: 'morrowindBitterCoast', Blacklight: 'morrowindVelothiFoot',
    Helstrom: 'blackMarshHist', Blackrose: 'blackMarshHist', Stormhold: 'blackMarshFens', Thorn: 'blackMarshFens', Gideon: 'blackMarshFens',
    Lilmoth: 'blackMarshMurkmire', Soulrest: 'blackMarshMurkmire', Archon: 'blackMarshMurkmire',
    Torval: 'elsweyrPelletine', Senchal: 'elsweyrPelletine', Riverhold: 'elsweyrAnequina', Rimmen: 'elsweyrAnequina', Orcrest: 'elsweyrAnequina',
    Falinesti: 'valenwoodGrahtwood', 'Elden Root': 'valenwoodGrahtwood', Woodhearth: 'valenwoodCoast', Haven: 'valenwoodCoast',
    Arenthia: 'valenwoodReapersMarch', Alinor: 'summersetVineCoast', Dusk: 'summersetVineCoast', Firsthold: 'summersetAuridon',
    Taneth: 'hammerfellCoast', Gilane: 'hammerfellCoast', Rihad: 'hammerfellCoast', Skaven: 'hammerfellAlikr', Elinhir: 'hammerfellCraglorn',
    Dragonstar: 'hammerfellCraglorn', Shornhelm: 'highRockRivenspire', Northpoint: 'highRockGlenumbra',
  };
  for (const [name, key] of Object.entries(want)) assert.equal(biomeOfCity(name), key, name);
});

test('TESA-BIOME: Cyrodiil is jungle - the Nibenay, the Colovian uplands and Blackwood on Rainforest and Swamp under the jungle, the Gold Coast and the Jerall not', () => {
  const jungle = BIOMES.filter((b) => b.jungle).map((b) => b.key).sort();
  assert.deepEqual(jungle, ['cyrodiilBlackwood', 'cyrodiilColovia', 'cyrodiilNibenay']);
  assert.equal(BIOME_BY_KEY.get('cyrodiilNibenay').climate, CLIMATES.Rainforest);
  assert.equal(BIOME_BY_KEY.get('cyrodiilColovia').climate, CLIMATES.Rainforest);
  assert.equal(BIOME_BY_KEY.get('cyrodiilBlackwood').climate, CLIMATES.Swamp);
  assert.equal(BIOME_BY_KEY.get('cyrodiilGoldCoast').climate, CLIMATES.Subtropical);
  assert.equal(BIOME_BY_KEY.get('cyrodiilJerall').climate, CLIMATES.MountainWoods);
  assert.ok(BIOMES.every((b) => !b.jungle || b.province === 'Imperial'), 'the jungle is Cyrodiil\'s alone past the Bay');
});

test('TESA-BIOME: the peaks - a range lifting past PEAKS_LIFT is its province\'s peaks; the Colovian Highlands and the Tenmar Hills never are', () => {
  assert.equal(PEAKS_LIFT, 0.62);
  const spine = (name, k = 1) => MOUNTAIN_RANGES.find((r) => r.name === name).pts[k];
  assert.equal(biomeAtPicture('Imperial', ...spine('Jerall Mountains', 1))?.key, 'cyrodiilJerall');
  assert.equal(biomeAtPicture('Skyrim', ...spine('Throat of the World', 1))?.key, 'skyrimPeaks');
  assert.equal(biomeAtPicture('Sumurset', ...spine('Eton Nir', 0))?.key, 'summersetEtonNir');
  assert.equal(biomeAtPicture('Morrowind', ...spine('Velothi Mountains', 1))?.key, 'morrowindVelothi');
  for (const name of ['Colovian Highlands', 'Tenmar Hills']) {
    const r = MOUNTAIN_RANGES.find((x) => x.name === name);
    assert.ok(r.gain < PEAKS_LIFT, name);
    for (const p of r.pts) assert.ok(rangeLift(...p) < PEAKS_LIFT, `${name} at ${p}`);
  }
  // a hair under the line stays its zone's - Skyrim's peaks have no seeds, so only the line stands them
  const [x, y] = spine('Throat of the World', 1);
  let off = 0; while (rangeLift(x, y + off) >= PEAKS_LIFT) off += 0.05;
  assert.notEqual(biomeAtPicture('Skyrim', x, y + off)?.key, 'skyrimPeaks', 'below the line, the seeded zone');
  assert.equal(biomeAtPicture('Skyrim', x, y + off - 0.1)?.key, 'skyrimPeaks', 'and just above it, the peaks');
});

test('TESA-BIOME: the border wanders - two octaves of value noise move the point before the nearest seed is asked', () => {
  assert.deepEqual(BIOME_WANDER.map((o) => [o.cell, o.amp]), [[9, 2.4], [3, 0.7]]);
  let movedX = 0, movedY = 0, max = 0;
  for (let x = 120; x < 300; x += 7) for (let y = 20; y < 180; y += 7) {
    const [wx, wy] = wanderPoint(x, y);
    if (Math.abs(wx - x) > 0.01) movedX++;
    if (Math.abs(wy - y) > 0.01) movedY++;
    max = Math.max(max, Math.hypot(wx - x, wy - y));
  }
  assert.ok(movedX > 100 && movedY > 100, 'it moves, on both axes');
  assert.ok(max <= Math.hypot(3.1, 3.1) + 1e-9, 'no farther than its amplitudes');
  // along a straight run between two zones, the crossing is not the bisector's
  const flips = [];
  for (let y = 60; y < 120; y += 0.5) {
    const a = biomeAtPicture('Imperial', 150, y)?.key, b = biomeAtPicture('Imperial', 150, y + 0.5)?.key;
    if (a !== b) flips.push(y);
  }
  assert.ok(flips.length >= 1);
  // the zone is the WANDERED point's nearest seed - read at the point itself, the border would be the seeds' bisectors
  const nearest = (prov, px, py) => {
    let best = null, bd = Infinity;
    for (const b of BIOMES) if (b.province === prov) for (const [sx, sy] of b.seeds) { const d = (sx - px) ** 2 + (sy - py) ** 2; if (d < bd) { bd = d; best = b; } }
    return best;
  };
  let bent = 0;
  for (let x = 120; x < 200; x += 1.5) for (let y = 60; y < 130; y += 1.5) {
    const z = biomeAtPicture('Imperial', x, y);
    if (z && !z.peaks && z !== nearest('Imperial', x, y)) bent++;
  }
  assert.ok(bent > 0, 'the border bends off the bisectors');
});

test('TESA-BIOME: a pixel past the Bay reads its zone; the Bay\'s own pixels and the sea read none; the cache drops when the land moves', () => {
  setTamrielTrace(null);
  dropBiomeCache();
  assert.equal(tamrielBiomeAt(500, 250), null, 'the Bay\'s own');
  assert.equal(tamrielBiomeAt(...pixelAt([10, 10])), null, 'the sea');
  const ic = pixelAt(city('Imperial City'));
  assert.ok(!inBay(...ic));
  assert.equal(tamrielBiomeAt(...ic)?.key, 'cyrodiilNibenay');
  assert.ok(biomeCacheSize() >= 1);
  const v = tamrielLandVersion();
  setTamrielTrace(null);   // a new install, the same shape
  assert.ok(tamrielLandVersion() > v);
  assert.equal(tamrielBiomeAt(...ic)?.key, 'cyrodiilNibenay');
  assert.equal(biomeCacheSize(), 1, 'the old pixels dropped with the land they were read on');
  // the stamp a reader keys its own zones by: still while the land is, moved with it
  const s0 = biomeStamp();
  assert.equal(biomeStamp(), s0);
  setTamrielTrace(null);
  assert.ok(biomeStamp() > s0, 'the land moved: the stamp moves');
  // a pixel reads its zone at its centre
  dropBiomeCache();
  const anvil = pixelAt(city('Anvil')), chey = pixelAt(city('Cheydinhal'));   // a run across the Gold Coast, Colovia and the Nibenay
  let read = 0, borders = 0;
  for (let y = Math.min(anvil[1], chey[1]) - 20; y <= Math.max(anvil[1], chey[1]) + 20; y += 4) {
    let last = null;
    for (let x = anvil[0]; x <= chey[0]; x++) {
      const prov = provinceKeyBeyondBay(x, y);
      if (!prov) continue;
      const z = tamrielBiomeAt(x, y);
      assert.equal(z, biomeAtPicture(prov, ...bayToPicture(x + 0.5, y + 0.5)), `${x},${y}`);
      if (last && z !== last) borders++;
      last = z;
      read++;
    }
  }
  assert.ok(read > 2000 && borders > 20, `${read} pixels, ${borders} borders crossed`);
});

test('TESA-BIOME: the ground past the Bay is its zone\'s climate, and the air its zone\'s air - Morrowind\'s ash warm, the Bay untouched', () => {
  setTamrielTrace(null);
  assert.equal(tamrielClimateAt(...pixelAt(city('Imperial City'))), CLIMATES.Rainforest);
  assert.equal(tamrielClimateAt(...pixelAt(city('Leyawiin'))), CLIMATES.Swamp);
  assert.equal(tamrielClimateAt(...pixelAt(city('Riverhold'))), CLIMATES.Desert2);
  assert.equal(tamrielClimateAt(...pixelAt(city('Torval'))), CLIMATES.Subtropical);
  const ald = pixelAt(city("Ald'ruhn"));
  assert.equal(tamrielClimateAt(...ald), CLIMATES.Mountain, 'grey volcanic ground');
  const bay = () => 77;
  assert.equal(groundAirClimateIndex(bay)(...ald), CLIMATES.Desert2, 'its air the hot dry south\'s');
  assert.equal(groundClimateIndex(bay)(...ald), CLIMATES.Mountain);
  assert.equal(groundAirClimateIndex(bay)(...pixelAt(city('Whiterun'))), CLIMATES.MountainWoods, 'no air of its own: the ground\'s');
  assert.equal(groundAirClimateIndex(bay)(500, 250), 77, 'the Bay\'s own');
  assert.equal(tamrielClimateAt(...pixelAt([10, 10])), CLIMATES.Ocean, 'the sea');
});

test('TESA-BIOME: the jungle field reads past the Bay through `beyond` - Cyrodiil\'s jungle inside, the Bay\'s own field unchanged to the bit', () => {
  setTamrielTrace(null);
  const beyond = (x, y) => !!tamrielBiomeAt(x, y)?.jungle;
  const W = 1000, H = 500;
  const plain = jungleField({ width: W, height: H, insideAt: banthaAreaHas });
  const wide = jungleField({ width: W, height: H, insideAt: banthaAreaHas, beyond });
  for (let y = 270; y < 360; y += 3) for (let x = 590; x < 1000; x += 5) assert.equal(wide.at(x, y), plain.at(x, y), `${x},${y}`);
  for (let y = 0; y < H; y += 41) for (const x of [0, 999]) assert.equal(wide.at(x, y), plain.at(x, y), `the edge ${x},${y}`);
  const ic = pixelAt(city('Imperial City'));
  assert.equal(plain.at(...ic), -(plain.reach + 0.5), 'off the map the Bay\'s field reads outside');
  assert.equal(wide.inside(...ic), 1);
  assert.ok(wide.at(...ic) > wide.reach, 'deep in the Nibenay');
  const anvil = pixelAt(city('Anvil'));
  assert.equal(wide.inside(...anvil), 0, 'the Gold Coast is not jungle');
  // the host keeps its field until the zones' stamp moves (the trace landing, a fit), then makes it again
  let jungle = true, stamp = 1;
  const host = createJungleHost({ renderer: { _focus: new Float32Array(4), setJungleHaze() {} }, maps: {}, insideAt: () => false, mapWidth: 4, mapHeight: 4,
    stateOf: () => ({ mapOrigin: { x: 0, y: 0 }, compensation: [0, 0, 0], pixelTranslation: (px, py, o = [0, 0, 0]) => o }), builtOf: () => new Map(), heightAt: () => 0, haze: false, trees: { door: true },
    beyond: (x, y) => jungle && x >= 20 && x < 60 && y >= 20 && y < 60, version: () => stamp });
  assert.ok(host.job(40, 40), 'past the map, its zone\'s jungle');
  assert.equal(host.job(200, 200), null, 'nowhere near it: none');
  jungle = false;
  assert.ok(host.job(40, 40), 'the stamp unmoved: the field kept');
  stamp++;
  assert.equal(host.job(40, 40), null, 'the stamp moved: the field made again');
});
