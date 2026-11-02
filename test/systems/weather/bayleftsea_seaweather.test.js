// BAY-LEFT-SEA (2026-10-26; the audit "no system left behind in the Bay", item 22 - D4): WEATHER BORN AT SEA PAST THE BAY
// IS THE SEA'S - systems/weather/weatherMap.js climateOfField takes the composed map's Ocean past the Bay's edge, where it
// had read the nearest Bay edge's climate (the Mountain's: a third of a winter's births at sea snowed). On the freeware's
// composed maps: a winter's weather at the Sea of Ghosts, the Topal Bay and the Padomaic, the old law beside the new
// (bible/07-Rendering/Weather-Arc.md BAY-LEFT-SEA).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { weatherAt } from '../../../src/systems/weather/weatherMap.js';
import { fieldOfPixelLocal } from '../../../src/systems/weather/weatherField.js';
import { CLIMATES, MAX_MAP_PIXEL_X, MAX_MAP_PIXEL_Y } from '../../../src/formats/mapsFile.js';
import { setTamrielTrace } from '../../../src/world/tamriel/tamrielLand.js';
import { setTamrielFit } from '../../../src/world/tamriel/tamrielFrame.js';

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL', 'MAPS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(ARENA2, f)));
const YEAR = 405 * 360 * 1440;
const off = (x, y) => x < 0 || y < 0 || x >= MAX_MAP_PIXEL_X || y >= MAX_MAP_PIXEL_Y;
/** A winter's 400 words at a sea pixel: twenty by twenty points 40 m apart, the first month and a half of ten years. */
function winterAt(px, py, climateAt) {
  const words = {};
  for (let d = 0; d < 400; d++) {
    const [x, z] = fieldOfPixelLocal(px, py, (d % 20) * 40, Math.floor(d / 20) * 40);
    const w = weatherAt(x, z, YEAR + (d % 10) * 360 * 1440 + (15 + (d % 30)) * 1440 + ((d * 37) % 1440), climateAt).word;
    words[w] = (words[w] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(words).sort());
}

const realSkip = HAVE ? false : 'ARENA2_PATH not set (sh tools/fetch-data.sh)';
test('BAY-LEFT-SEA (ARENA2): a winter at sea past the Bay is the sea\'s - the Ocean\'s fog where the nearest Bay edge\'s Mountain had snowed (mutant: the Ocean past the map read as the edge again)', { skip: realSkip }, async () => {
  globalThis.atob ??= (s) => Buffer.from(s, 'base64').toString('binary');
  const bytes = (n) => new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), n)));
  const { DFPalette } = await import('../../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../../src/ui/tamrielTrace.js');
  const { MapsFile } = await import('../../../src/formats/mapsFile.js');
  const { groundMaps } = await import('../../../src/world/tamriel/tamrielGround.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal, indexedDBRef: null }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  try {
    const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
    groundMaps(maps);
    const climateAt = (x, y) => maps.getClimateIndex(x, y);   // the host's composed map (world.js's weather reads it)
    // the law before: the Ocean past the map read as its nearest edge (a map answering -1 there reads the edge, as it does)
    const before = (x, y) => { const c = climateAt(x, y); return off(x, y) && c === CLIMATES.Ocean ? -1 : c; };
    const seas = { 'Sea of Ghosts': [1900, -620], 'Topal Bay': [2100, 1900], Padomaic: [3600, 1600] };
    for (const [, [x, y]] of Object.entries(seas)) assert.equal(climateAt(x, y), CLIMATES.Ocean);
    assert.deepEqual(Object.fromEntries(Object.entries(seas).map(([n, [x, y]]) => [n, [winterAt(x, y, before), winterAt(x, y, climateAt)]])), {
      'Sea of Ghosts': [{ cloudy: 57, fog: 6, overcast: 109, snow: 142, sunny: 86 }, { cloudy: 78, fog: 93, overcast: 113, snow: 62, sunny: 54 }],
      'Topal Bay': [{ cloudy: 77, fog: 10, overcast: 124, snow: 110, sunny: 79 }, { cloudy: 67, fog: 83, overcast: 96, snow: 46, sunny: 108 }],
      Padomaic: [{ cloudy: 79, fog: 10, overcast: 82, snow: 189, sunny: 40 }, { cloudy: 122, fog: 64, overcast: 111, snow: 64, sunny: 39 }],
    });
  } finally { setTamrielTrace(null); setTamrielFit(null); }
});
