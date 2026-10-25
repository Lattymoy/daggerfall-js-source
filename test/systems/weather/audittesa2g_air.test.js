// AUDIT TESA II G3 (AUDIT TESA-BIOME Z5, its fix whole): the air's map and the snowpack are the land's as it stood - when the
// zones' stamp moves (the trace and the relief landing after the boot, a fit) the air's ground drops its kept fields and
// tops (systems/weather/airGround.js lawAirGround) and the snowpack its points and systems (snowpack.js SnowpackLattice
// fresh), as the air's tiles already did. A summit read before the relief landed had kept the authored ground's 255 m for
// its 1,785 for the session. bible/07-Rendering/Biome-Precipitation.md, bible/01-Overview/audits/Audit-Tesa-Biome.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { SnowpackLattice } from '../../../src/systems/weather/snowpack.js';
import { setAirGround } from '../../../src/systems/weather/airTemperature.js';

test('AUDIT TESA II G3: the snowpack forgets its points and its systems when the air\'s ground moves, and keeps them while it stands (mutants: the version unread; the points kept)', () => {
  let v = 1;
  const ground = { climateAt: () => 228, groundAt: () => 100, topAt: () => 900, version: () => v };
  setAirGround(ground);
  try {
    const lat = new SnowpackLattice({ climateAt: () => 228 });
    const t = 600000;
    const p = lat.point(10, 10, t);
    assert.equal(lat.point(10, 10, t), p, 'kept while the ground stands');
    lat._systems.set(1, []);
    const births = lat._births;
    v = 2;
    const q = lat.point(10, 10, t);
    assert.notEqual(q, p, 'made again on the moved ground');
    assert.equal(lat._systems.size, 0, 'the systems born on the old climates let go');
    assert.notEqual(lat._births, births, 'the births read afresh (the weather map\'s memo keys them by the read)');
    assert.equal(lat.point(10, 10, t), q, 'and kept again');
  } finally { setAirGround(null); }
});

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'WOODS.WLD', 'MAPS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK', 'ART_PAL.COL'].every((f) => existsSync(join(ARENA2, f)));
test('AUDIT TESA II G3 with ARENA2: a summit past the Bay read before the trace lands reads its relief\'s ground after (mutants: the fields and tops kept)', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const fetchBytes = async (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const { DFPalette } = await import('../../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../../src/ui/tamrielTrace.js');
  const { WoodsFile } = await import('../../../src/formats/woodsFile.js');
  const { MapsFile } = await import('../../../src/formats/mapsFile.js');
  const { setTamrielFit, pictureToBay } = await import('../../../src/world/tamriel/tamrielFrame.js');
  const { setTamrielTrace } = await import('../../../src/world/tamriel/tamrielLand.js');
  const { groundWoods, dropGroundCache } = await import('../../../src/world/tamriel/tamrielGround.js');
  const { lawAirGround } = await import('../../../src/systems/weather/airGround.js');
  const pal = new DFPalette(); pal.load(await fetchBytes('ART_PAL.COL'), 'ART_PAL.COL');
  const woods = new WoodsFile(); woods.load(await fetchBytes('WOODS.WLD'));
  const maps = new MapsFile(); maps.load(await fetchBytes('MAPS.BSA'), await fetchBytes('CLIMATE.PAK'), await fetchBytes('POLITIC.PAK'));
  setTamrielTrace(null); dropGroundCache();
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  try {
    const air = lawAirGround({ woods: groundWoods(woods), maps, landforms: false });
    const [sx, sy] = pictureToBay(171.75, 63.75).map(Math.floor);   // Skyrim's summit on the trace
    const before = air.topAt(sx, sy), groundBefore = air.groundAt((sx + 0.5) * 819.2, (499 - sy + 0.5) * 819.2);
    setTamrielTrace(await preloadTamrielTrace({ fetchBytes, palette: pal })); dropGroundCache();
    const fresh = lawAirGround({ woods: groundWoods(woods), maps, landforms: false });
    const after = air.topAt(sx, sy);
    assert.ok(before < 600, `the authored ground before (${before} m)`);
    assert.equal(after, fresh.topAt(sx, sy), 'the relief\'s after, as a map made now reads it');
    assert.ok(after > 1500, `Skyrim's summit (${after} m)`);
    assert.notEqual(air.groundAt((sx + 0.5) * 819.2, (499 - sy + 0.5) * 819.2), groundBefore, 'the mean ground read afresh');
  } finally { setTamrielTrace(null); setTamrielFit(null); dropGroundCache(); }
});
