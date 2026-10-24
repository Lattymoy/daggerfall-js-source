// TESA-BIOME (2026-10-24, bible/03-World/Tamriel-Biomes.md) - the biomes past the Bay: each province split into the
// zones its lore names, each zone's ground, air and jungle; Cyrodiil's jungle standing on the Bantha law past the Bay.
// AUDIT TESA-BIOME (bible/01-Overview/audits/Audit-Tesa-Biome.md): the seeds stood on the land in use, the peaks by
// range, a city's own ground, the Nibenay Valley's grassland; where ARENA2_PATH names the data, every zone and city
// pinned again on the player's own trace - the land the game runs on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  BIOMES, BIOME_BY_KEY, PEAKS_LIFT, BIOME_WANDER, SEED_SNAP, CITY_GROUND, BIOMES_VERSION, BIOME_CACHE_MAX, biomeAtPicture, wanderPoint,
  tamrielBiomeAt, biomeCacheSize, dropBiomeCache, biomeStamp, standSeeds,
} from '../../src/world/tamriel/tamrielBiomes.js';
import { PROVINCES, CITIES, provinceAt, rangeLift, rangeLiftBy, MOUNTAIN_RANGES } from '../../src/world/tamriel/tamrielGeography.js';
import { pictureToBay, bayToPicture, inBay, setTamrielFit, tamrielFrameInBay } from '../../src/world/tamriel/tamrielFrame.js';
import { tamrielClimateAt, groundAirClimateIndex, groundClimateIndex } from '../../src/world/tamriel/tamrielGround.js';
import { setTamrielTrace, tamrielLandVersion, provinceKeyBeyondBay, provinceKeyAt, PROVINCE_OF_ID } from '../../src/world/tamriel/tamrielLand.js';
import { CLIMATES } from '../../src/formats/mapsTables.js';
import { jungleField } from '../../src/world/jungle/jungleRegion.js';
import { banthaAreaHas } from '../../src/world/jungle/banthaArea.js';
import { createJungleHost } from '../../src/scenes/jungleHost.js';
import { inputsPrint } from '../../src/world/tamrielRoads.js';
import { setAirGround, pixelAir } from '../../src/systems/weather/airTemperature.js';
import { TERRAIN_SIZE as PIXEL_M } from '../../src/world/terrain/terrainSampler.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const city = (name) => CITIES.find((c) => c.name === name).at;
const cityProvince = (name) => CITIES.find((c) => c.name === name).province;
/** a Bay-coordinate pixel at a picture point */
const pixelAt = ([x, y]) => pictureToBay(x, y).map(Math.floor);
const zoneOfPlace = new Map(BIOMES.flatMap((b) => b.places.map((n) => [n, b.key])));
const spine = (name, k = 1) => MOUNTAIN_RANGES.find((r) => r.name === name).pts[k];

test('TESA-BIOME: every province is split into zones - each a land climate, its keys apart; every city is one zone\'s seed', () => {
  const keys = BIOMES.map((b) => b.key);
  assert.equal(new Set(keys).size, keys.length, 'keys apart');
  assert.equal(BIOMES.length, 43);
  for (const p of PROVINCES) {
    const zones = BIOMES.filter((b) => b.province === p.key);
    assert.ok(zones.length >= 3, `${p.key}: three zones at least`);
    assert.ok(zones.some((b) => b.seeds.length), `${p.key}: a seeded zone`);
  }
  for (const b of BIOMES) {
    assert.ok(PROVINCES.some((p) => p.key === b.province), b.key);
    assert.ok(Object.values(CLIMATES).includes(b.climate) && b.climate !== CLIMATES.Ocean, `${b.key}: a land climate`);
    if (b.air != null) assert.ok(Object.values(CLIMATES).includes(b.air), `${b.key}: its air a climate`);
    b.places.forEach((n, i) => {
      assert.equal(cityProvince(n), b.province, `${b.key}'s city ${n} is its own province's`);
      assert.deepEqual(b.seeds[i], city(n), `${b.key}: ${n}'s seed is the city's point`);
    });
    for (const [x, y] of b.seeds.slice(b.places.length)) assert.equal(provinceAt(x, y)?.key, b.province, `${b.key}'s heart ${x},${y} on its own province (the rings)`);
    assert.equal(BIOME_BY_KEY.get(b.key), b);
  }
  // AUDIT TESA-BIOME Z2/Z9: a seed named for a city IS the city - every one of TAMRIEL1's 67 seeds exactly one zone
  assert.deepEqual(CITIES.map((c) => c.name).filter((n) => !zoneOfPlace.has(n)), [], 'every city a zone\'s');
  assert.equal(BIOMES.flatMap((b) => b.places).length, CITIES.length, 'and no city two zones\'');
  assert.deepEqual(BIOMES.filter((b) => b.peaks === true).map((b) => b.province).sort(),
    ['Hammerfell', 'HighRock', 'Imperial', 'Morrowind', 'Skyrim', 'Sumurset'], 'six provinces have peaks');
  assert.deepEqual(BIOMES.filter((b) => Array.isArray(b.peaks)).map((b) => [b.key, [...b.peaks]]), [['morrowindRedMountain', ['Red Mountain']]]);
  assert.equal(BIOMES_VERSION, 2);
});

test('TESA-BIOME: on the authored rings every city stands in its own zone, and every zone holds land', () => {
  setTamrielTrace(null); setTamrielFit(null);
  for (const c of CITIES) assert.equal(tamrielBiomeAt(...pixelAt(c.at))?.key, zoneOfPlace.get(c.name), c.name);
  const area = areas(4);
  for (const b of BIOMES) assert.ok((area.get(b.key) ?? 0) > 20, `${b.key} holds land (${area.get(b.key) ?? 0})`);
});

test('TESA-BIOME: Cyrodiil - the Nibenay Valley\'s grassland at the centre, enclosed by the jungle; Colovia and Blackwood jungle; the Gold Coast deciduous', () => {
  setTamrielTrace(null);
  const jungle = BIOMES.filter((b) => b.jungle).map((b) => b.key).sort();
  assert.deepEqual(jungle, ['blackMarshGloomire', 'cyrodiilBlackwood', 'cyrodiilColovia', 'cyrodiilNibenay'], 'and Blackwood across the border');
  assert.equal(BIOME_BY_KEY.get('cyrodiilNibenayValley').climate, CLIMATES.Woodlands, 'PGE1: "its center, the grassland of the Nibenay Valley"');
  assert.equal(BIOME_BY_KEY.get('cyrodiilNibenay').climate, CLIMATES.Rainforest);
  assert.equal(BIOME_BY_KEY.get('cyrodiilColovia').climate, CLIMATES.Rainforest, 'the owner\'s call');
  assert.equal(BIOME_BY_KEY.get('cyrodiilBlackwood').climate, CLIMATES.Swamp);
  assert.equal(BIOME_BY_KEY.get('blackMarshGloomire').climate, CLIMATES.Swamp);
  assert.equal(BIOME_BY_KEY.get('cyrodiilGoldCoast').climate, CLIMATES.Woodlands, '"deciduous forest and mangroves"');
  assert.equal(BIOME_BY_KEY.get('cyrodiilJerall').climate, CLIMATES.MountainWoods);
  // the valley about the Imperial City; a ring of the jungle round it
  const [ix, iy] = city('Imperial City');
  for (let a = 0; a < 16; a++) assert.equal(biomeAtPicture('Imperial', ix + Math.cos(a) * 2, iy + Math.sin(a) * 2)?.key, 'cyrodiilNibenayValley', `the valley ${a}`);
  let ring = 0, on = 0;
  for (let a = 0; a < 64; a++) {
    const x = ix + Math.cos(a / 64 * 2 * Math.PI) * 12, y = iy + Math.sin(a / 64 * 2 * Math.PI) * 12;
    if (provinceAt(x, y)?.key !== 'Imperial') continue;
    on++;
    if (biomeAtPicture('Imperial', x, y)?.jungle) ring++;
  }
  assert.ok(on > 30 && ring / on >= 0.9, `12 units out the jungle encloses it (${ring} of ${on})`);
});

test('TESA-BIOME: the peaks by range - each range\'s spine its province\'s peaks; Red Mountain its own, never the Velothi\'s snow; the Colovian Highlands and the Tenmar Hills never', () => {
  setTamrielTrace(null);
  assert.equal(PEAKS_LIFT, 0.62);
  assert.equal(biomeAtPicture('Imperial', ...spine('Jerall Mountains', 1))?.key, 'cyrodiilJerall');
  assert.equal(biomeAtPicture('Skyrim', ...spine('Throat of the World', 1))?.key, 'skyrimPeaks');
  assert.equal(biomeAtPicture('Sumurset', ...spine('Eton Nir', 0))?.key, 'summersetEtonNir');
  assert.equal(biomeAtPicture('Morrowind', ...spine('Velothi Mountains', 1))?.key, 'morrowindVelothi');
  assert.equal(biomeAtPicture('Hammerfell', ...spine('Dragontail Mountains', 1))?.key, 'hammerfellDragontail');
  // AUDIT TESA-BIOME Z6/L2: Red Mountain - ash and an air of its own, the Velothi wall's peaks not its
  for (const k of [0, 1]) assert.equal(biomeAtPicture('Morrowind', ...spine('Red Mountain', k))?.key, 'morrowindRedMountain', `Red Mountain ${k}`);
  const rm = BIOME_BY_KEY.get('morrowindRedMountain');
  assert.equal(rm.air, CLIMATES.Desert2, 'the volcano\'s warm air');
  assert.ok(rangeLiftBy(...spine('Red Mountain', 0), (n) => n !== 'Red Mountain') < PEAKS_LIFT, 'no other range lifts it');
  for (const name of ['Colovian Highlands', 'Tenmar Hills']) {
    const r = MOUNTAIN_RANGES.find((x) => x.name === name);
    assert.ok(r.gain < PEAKS_LIFT, name);
    for (const p of r.pts) assert.ok(rangeLift(...p) < PEAKS_LIFT, `${name} at ${p}`);
  }
  assert.equal(rangeLift(140, 100), rangeLiftBy(140, 100), 'rangeLift is every range\'s');
  // a hair under the line stays its zone's - Skyrim's peaks have no seeds, so only the line stands them
  const [x, y] = spine('Throat of the World', 1);
  let off = 0; while (rangeLift(x, y + off) >= PEAKS_LIFT) off += 0.05;
  assert.notEqual(biomeAtPicture('Skyrim', x, y + off)?.key, 'skyrimPeaks', 'below the line, the seeded zone');
  assert.equal(biomeAtPicture('Skyrim', x, y + off - 0.1)?.key, 'skyrimPeaks', 'and just above it, the peaks');
});

test('TESA-BIOME: a city\'s own ground - within CITY_GROUND of its stood seed a point is the city\'s zone, before the peaks and the wander', () => {
  setTamrielTrace(null);
  assert.equal(CITY_GROUND, 1.5);
  // Bruma stands on the Jerall's flank: the zone its own, a peaks zone with seeds, either way; a range-crowned city elsewhere
  const seeds = standSeeds();
  for (const [prov, list] of seeds) {
    for (const [b, sx, sy, isCity] of list) {
      if (!isCity) continue;
      for (const [dx, dy] of [[0, 0], [1.4, 0], [0, -1.4], [-1, 1]]) assert.equal(biomeAtPicture(prov, sx + dx, sy + dy), b, `${b.key} at ${dx},${dy}`);
    }
  }
  // a heart stood on another zone's city gives way (Gilane's coast on the freeware trace): none stands within CITY_GROUND
  for (const list of seeds.values()) {
    const cities = list.filter((s) => s[3]);
    for (const s of list) if (!s[3]) assert.ok(!cities.some((c) => c[0] !== s[0] && Math.hypot(c[1] - s[1], c[2] - s[2]) < CITY_GROUND), `${s[0].key}'s heart`);
  }
  // a synthetic trace that makes it happen: the Imperial province four pixels about the Imperial City's corner (178, 96) -
  // the Nibenay's five hearts within SEED_SNAP all stand 0.71 from the city, and give way to it
  const w = 320, h = 200, land = new Uint8Array(w * h), province = new Uint8Array(w * h);
  for (let y = 95; y <= 96; y++) for (let x = 177; x <= 178; x++) { land[y * w + x] = 1; province[y * w + x] = 9; }
  setTamrielTrace({ w, h, land, province, dist: null });
  try {
    assert.equal(PROVINCE_OF_ID[9], 'Imperial');
    assert.deepEqual(standSeeds().get('Imperial').map(([b, x, y, isCity]) => [b.key, x, y, isCity]), [['cyrodiilNibenayValley', 178, 96, true]]);
  } finally { setTamrielTrace(null); }
});

test('TESA-BIOME: the border wanders - two octaves of value noise move the point before the nearest seed is asked', () => {
  setTamrielTrace(null);
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
  // AUDIT TESA-BIOME P9: the wander's own shape, golden (its amplitudes, its two octaves, its smoothstep)
  const near = (a, b) => assert.ok(Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9, `${a} ~ ${b}`);
  near(wanderPoint(150.3, 90.7), [149.4822460755438, 89.80378067966484]);
  near(wanderPoint(240.1, 40.2), [239.676599692093, 41.88318641705413]);
  // the zone is the WANDERED point's nearest seed - read at the point itself, the border would be the seeds' bisectors
  const list = standSeeds().get('Imperial');
  const nearest = (px, py) => { let best = null, bd = Infinity; for (const [b, sx, sy] of list) { const d = (sx - px) ** 2 + (sy - py) ** 2; if (d < bd) { bd = d; best = b; } } return best; };
  let bent = 0;
  for (let x = 120; x < 200; x += 1.5) for (let y = 60; y < 130; y += 1.5) {
    const z = biomeAtPicture('Imperial', x, y);
    if (z && !z.peaks && list.every(([, sx, sy]) => Math.hypot(sx - x, sy - y) >= CITY_GROUND) && z !== nearest(x, y)) bent++;
  }
  assert.ok(bent > 0, 'the border bends off the bisectors');
});

test('TESA-BIOME: the seeds stand on the land in use - a seed off its province\'s land moved onto the nearest of it within SEED_SNAP, one with none left out', () => {
  assert.equal(SEED_SNAP, 18);
  // a synthetic trace: the Imperial province alone, a block at x 170..189, y 90..99 - the Imperial City on it, Cheydinhal (200, 90)
  // eleven units east of it, Anvil (138, 112) past the reach
  const w = 320, h = 200, land = new Uint8Array(w * h), province = new Uint8Array(w * h);
  const imperialId = Number(Object.keys(PROVINCE_OF_ID).find((k) => PROVINCE_OF_ID[k] === 'Imperial'));
  for (let y = 90; y < 100; y++) for (let x = 170; x < 190; x++) { land[y * w + x] = 1; province[y * w + x] = imperialId; }
  setTamrielTrace({ w, h, land, province, dist: null });
  try {
    assert.equal(provinceKeyAt(178.5, 96.5), 'Imperial');
    const list = standSeeds().get('Imperial');
    const of = (key) => list.filter(([b]) => b.key === key).map(([, x, y]) => [x, y]);
    assert.deepEqual(of('cyrodiilNibenayValley')[0], city('Imperial City'), 'on the land: where it stands');
    assert.ok(of('cyrodiilNibenay').some(([x, y]) => x === 189.5 && y === 90.5), 'Cheydinhal moved onto the block\'s nearest pixel');
    assert.ok(list.every(([, x, y]) => provinceKeyAt(x, y) === 'Imperial'), 'every stood seed on the province');
    assert.deepEqual(of('cyrodiilGoldCoast'), [], 'the Gold Coast past the reach: left out');
    assert.equal(biomeAtPicture('Imperial', 172.5, 92.5)?.province, 'Imperial');
  } finally { setTamrielTrace(null); }
});

test('TESA-BIOME: a pixel past the Bay reads its zone at its centre; the Bay\'s own pixels and the sea read none; the cache and the stamp move with the land, and with it alone', () => {
  setTamrielTrace(null); setTamrielFit(null);
  dropBiomeCache();
  assert.equal(tamrielBiomeAt(500, 250), null, 'the Bay\'s own');
  assert.equal(tamrielBiomeAt(...pixelAt([10, 10])), null, 'the sea');
  const ic = pixelAt(city('Imperial City'));
  assert.ok(!inBay(...ic));
  assert.equal(tamrielBiomeAt(...ic)?.key, 'cyrodiilNibenayValley');
  assert.ok(biomeCacheSize() >= 1);
  const v = tamrielLandVersion();
  setTamrielTrace(null);   // a new install, the same shape
  assert.ok(tamrielLandVersion() > v);
  assert.equal(biomeCacheSize(), 0, 'the old pixels dropped with the land they were read on (the size the land\'s as it stands - Z11)');
  assert.equal(tamrielBiomeAt(...ic)?.key, 'cyrodiilNibenayValley');
  const s0 = biomeStamp();
  assert.equal(biomeStamp(), s0);
  setTamrielFit(null);   // the same numbers installed again (AUDIT TESA-BIOME Z11): nothing moves
  assert.equal(biomeStamp(), s0, 'a fit the same as the last moves no stamp');
  setTamrielFit({ ox: 862, oy: 976, ppu: 18.75 });
  assert.ok(biomeStamp() > s0, 'a fit moved: the stamp moves');
  setTamrielFit(null);
  setTamrielTrace(null);
  assert.ok(biomeStamp() > s0 + 1, 'the land moved: the stamp moves');
  // AUDIT TESA-BIOME Z10: the key is exact for every pixel the game can ask - two far apart never share an answer
  dropBiomeCache();
  assert.equal(tamrielBiomeAt(...ic)?.key, 'cyrodiilNibenayValley');
  assert.equal(tamrielBiomeAt(ic[0] + 1, ic[1] - 32768), null, 'a pixel far north of it is no zone of the land');
  // the cache is bounded: past BIOME_CACHE_MAX it drops whole, and answers stay the land's (P9)
  dropBiomeCache();
  for (let k = 0; k <= BIOME_CACHE_MAX; k++) tamrielBiomeAt(-4000 - (k % 4096), -4000 - Math.floor(k / 4096));
  assert.ok(biomeCacheSize() <= BIOME_CACHE_MAX && biomeCacheSize() >= 1, `bounded (${biomeCacheSize()})`);
  assert.equal(tamrielBiomeAt(...ic)?.key, 'cyrodiilNibenayValley');
  // a pixel reads its zone at its centre
  dropBiomeCache();
  const anvil = pixelAt(city('Anvil')), chey = pixelAt(city('Cheydinhal'));   // a run across the Gold Coast, Colovia, the valley and the Nibenay
  let readN = 0, borders = 0;
  for (let y = Math.min(anvil[1], chey[1]) - 20; y <= Math.max(anvil[1], chey[1]) + 20; y += 4) {
    let last = null;
    for (let x = anvil[0]; x <= chey[0]; x++) {
      const prov = provinceKeyBeyondBay(x, y);
      if (!prov) continue;
      const z = tamrielBiomeAt(x, y);
      assert.equal(z, biomeAtPicture(prov, ...bayToPicture(x + 0.5, y + 0.5)), `${x},${y}`);
      if (last && z !== last) borders++;
      last = z;
      readN++;
    }
  }
  assert.ok(readN > 2000 && borders > 20, `${readN} pixels, ${borders} borders crossed`);
});

test('TESA-BIOME: the ground past the Bay is its zone\'s climate, and the air its zone\'s air - Morrowind\'s ash warm, the Bay untouched', () => {
  setTamrielTrace(null);
  assert.equal(tamrielClimateAt(...pixelAt(city('Imperial City'))), CLIMATES.Woodlands, 'the valley\'s grass');
  assert.equal(tamrielClimateAt(...pixelAt(city('Cheydinhal'))), CLIMATES.Rainforest);
  assert.equal(tamrielClimateAt(...pixelAt(city('Leyawiin'))), CLIMATES.Swamp);
  assert.equal(tamrielClimateAt(...pixelAt(city('Riverhold'))), CLIMATES.Desert2);
  assert.equal(tamrielClimateAt(...pixelAt(city('Torval'))), CLIMATES.Subtropical);
  assert.equal(tamrielClimateAt(...pixelAt(city('Corinthe'))), CLIMATES.Rainforest, 'the Tenmar');
  const ald = pixelAt(city("Ald'ruhn"));
  assert.equal(tamrielClimateAt(...ald), CLIMATES.Mountain, 'grey volcanic ground');
  const bay = () => 77;
  assert.equal(groundAirClimateIndex(bay)(...ald), CLIMATES.Desert2, 'its air the hot dry south\'s');
  assert.equal(groundClimateIndex(bay)(...ald), CLIMATES.Mountain);
  assert.equal(groundAirClimateIndex(bay)(...pixelAt(city('Vivec'))), CLIMATES.Subtropical, 'the Ascadian Isles\' warm air');
  assert.equal(groundAirClimateIndex(bay)(...pixelAt(city('Whiterun'))), CLIMATES.MountainWoods, 'no air of its own: the ground\'s');
  assert.equal(groundAirClimateIndex(bay)(500, 250), 77, 'the Bay\'s own');
  assert.equal(tamrielClimateAt(...pixelAt([10, 10])), CLIMATES.Ocean, 'the sea');
});

test('TESA-BIOME: the air\'s kept tiles follow the land - a ground whose version moves drops them (AUDIT TESA-BIOME Z5); the roads\' regions are keyed by the zones\' law (Z3)', () => {
  let climate = CLIMATES.Desert, version = 1;
  setAirGround({ climateAt: () => climate, groundAt: () => 0, version: () => version });
  try {
    const hot = pixelAir(1200, -300).mean;
    climate = CLIMATES.Mountain;
    assert.equal(pixelAir(1200, -300).mean, hot, 'the version unmoved: kept');
    version++;
    assert.ok(pixelAir(1200, -300).mean < hot, 'the land moved: read again');
  } finally { setAirGround(null); }
  assert.match(read('src/systems/weather/airGround.js'), /version: biomeStamp,/, 'the law\'s map carries the zones\' stamp');
  const base = { woodsBytes: new Uint8Array(64), fit: null, trace: null, spec: {}, nodes: [], obstacles: [], gates: [], held: [] };
  assert.match(read('src/world/tamrielRoads.js'), /const text = JSON\.stringify\(\[spec, nodes, obstacles, gates, held, ROAD_DIALS, BIOMES_VERSION\]\);/);
  assert.equal(typeof inputsPrint(base), 'string');
});

test('TESA-BIOME: the jungle field reads past the Bay through `beyond` - Cyrodiil\'s jungle inside, the Bay\'s own field unchanged to the bit', () => {
  setTamrielTrace(null);
  const beyond = (x, y) => !!tamrielBiomeAt(x, y)?.jungle;
  const W = 1000, H = 500;
  const plain = jungleField({ width: W, height: H, insideAt: banthaAreaHas });
  const wide = jungleField({ width: W, height: H, insideAt: banthaAreaHas, beyond });
  for (let y = 270; y < 360; y += 3) for (let x = 590; x < 1000; x += 5) assert.equal(wide.at(x, y), plain.at(x, y), `${x},${y}`);
  for (let y = 0; y < H; y += 41) for (const x of [0, 999]) assert.equal(wide.at(x, y), plain.at(x, y), `the edge ${x},${y}`);
  const ch = pixelAt(city('Cheydinhal'));
  assert.equal(plain.at(...ch), -(plain.reach + 0.5), 'off the map the Bay\'s field reads outside');
  assert.equal(wide.inside(...ch), 1);
  assert.ok(wide.at(...pixelAt([200, 100])) > wide.reach, 'deep in the Nibenay\'s ring');
  assert.equal(wide.inside(...pixelAt(city('Imperial City'))), 0, 'the valley\'s grassland is not jungle');
  assert.equal(wide.inside(...pixelAt(city('Anvil'))), 0, 'the Gold Coast is not jungle');
  // a far pixel's distance is the float32 the map's typed array keeps (P9 J1), and a capped field answers the same after its
  // maps drop (J2/J3: the answers are pure, a dropped pixel read again)
  const far = wide.at(...pixelAt([200, 100]));
  assert.equal(Math.fround(far), far);
  // and along the valley's eastern edge, where a distance is a diagonal's (no half-step a float64 and a float32 both hold)
  const [vx, vy] = pixelAt(city('Imperial City'));
  let ex = 0;
  while (wide.inside(vx + ex, vy) === 0 && ex < 400) ex++;
  const edge = [];
  for (let dy = -150; dy <= 150; dy += 3) for (let k = -6; k <= 6; k++) edge.push(wide.at(vx + ex + k, vy + dy));
  assert.ok(edge.some((d) => d * 2 !== Math.round(d * 2)), 'a diagonal distance among them');
  for (const d of edge) assert.equal(Math.fround(d), d);
  const tiny = jungleField({ width: W, height: H, insideAt: banthaAreaHas, beyond, beyondMax: 8 });
  const probe = [[200, 100], [192, 106], [170, 94], [205, 128], [138, 112]].map(pixelAt);
  const first = probe.map((p) => [tiny.inside(...p), tiny.at(...p)]);
  for (let k = 0; k < 40; k++) tiny.at(...pixelAt([180 + k, 120]));   // past the cap many times over
  assert.deepEqual(probe.map((p) => [tiny.inside(...p), tiny.at(...p)]), first, 'the same answers after the drops');
  assert.deepEqual(first, probe.map((p) => [wide.inside(...p), wide.at(...p)]), 'and the uncapped field\'s');
  // the host keeps its field until the zones' stamp moves (the trace landing, a fit), then makes it again
  let jungle = true, stamp = 1;
  const host = createJungleHost({ renderer: { _focus: new Float32Array(4), setJungleHaze() {} }, maps: {}, insideAt: () => false, mapWidth: 4, mapHeight: 4,
    stateOf: () => ({ mapOrigin: { x: 0, y: 0 }, compensation: [0, 0, 0], pixelTranslation: (px, py, o = [0, 0, 0]) => { o[0] = px * PIXEL_M; o[1] = 0; o[2] = -py * PIXEL_M; return o; } }),
    builtOf: () => new Map(), heightAt: () => 0, haze: false, trees: { door: true },
    beyond: (x, y) => jungle && x >= 20 && x < 60 && y >= 20 && y < 60, version: () => stamp });
  const [fx, fz] = [40.5 * PIXEL_M, -39.5 * PIXEL_M];   // the middle of pixel (40, 40)
  assert.ok(host.job(40, 40), 'past the map, its zone\'s jungle');
  assert.equal(host.floorClaims(fx, fz), true, 'deep in it, its floor');
  assert.equal(host.job(200, 200), null, 'nowhere near it: none');
  jungle = false;
  assert.ok(host.job(40, 40), 'the stamp unmoved: the field kept');
  stamp++;
  assert.equal(host.job(40, 40), null, 'the stamp moved: the field made again');
  assert.equal(host.floorClaims(fx, fz), false, 'and the floor\'s kept 3x3 with it (AUDIT TESA-BIOME J: the same pixel asked again)');
});

/** Each zone's pixel count over the frame (every `stride`th pixel), on the land as it stands. */
function areas(stride) {
  const f = tamrielFrameInBay(), out = new Map();
  for (let y = f.y0; y < f.y0 + f.h; y += stride) for (let x = f.x0; x < f.x0 + f.w; x += stride) {
    const b = tamrielBiomeAt(x, y);
    if (b) out.set(b.key, (out.get(b.key) ?? 0) + 1);
  }
  return out;
}

// ── AUDIT TESA-BIOME Z1/Z2: THE LAND THE GAME RUNS ON - the player's own trace off the freeware data at its fit ─────────
const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'MAP.PAL', 'ART_PAL.COL'].every((f) => existsSync(join(ARENA2, f)));
test('TESA-BIOME with ARENA2: on the player\'s own trace every zone holds land and every city\'s stood place is in its own zone - the Tenmar, the Frozen Coast and Gilane among them', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const { DFPalette } = await import('../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../src/ui/tamrielTrace.js');
  const { arenaPixels, setArenaStanding } = await import('../../src/world/arenaPlaces.js');
  const fetchBytes = async (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const pal = new DFPalette(); pal.load(await fetchBytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes, palette: pal }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });   // the freeware's fit (test/ui/tamriel4.test.js)
  setArenaStanding(true);
  try {
    const area = areas(3);
    for (const b of BIOMES) assert.ok((area.get(b.key) ?? 0) >= 9, `${b.key} holds land on the trace (${area.get(b.key) ?? 0})`);
    assert.ok(area.get('elsweyrTenmar') > 500, 'the Tenmar (it held none)');
    assert.ok(area.get('skyrimFrozenCoast') > 1000, 'the Frozen Coast');
    const stood = arenaPixels().stood.filter((p) => p.kind === 'city-state');
    for (const c of CITIES) {
      const s = stood.find((p) => p.name === c.name);
      assert.ok(s, `${c.name} stands`);
      assert.equal(tamrielBiomeAt(s.bx, s.by)?.key, zoneOfPlace.get(c.name), `${c.name} at its stood pixel`);
    }
    for (const [prov, list] of standSeeds()) for (const [, x, y] of list) assert.equal(provinceKeyAt(x, y), prov, `a stood seed of ${prov}`);
  } finally { setArenaStanding(false); setTamrielTrace(null); setTamrielFit(null); }
});
