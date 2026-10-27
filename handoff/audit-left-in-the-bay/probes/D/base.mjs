// Lane D probe harness: the freeware's trace, fit, the composed maps and woods (as rumarewater.test.js sets them).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const R = '/home/user/daggerfall-js-source/src/';
export const ARENA2 = process.env.ARENA2_PATH || '/home/claude/dfdata/arena2';
export const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
export const imp = (p) => import(R + p);
export async function setup({ compose = true } = {}) {
  const { DFPalette } = await imp('formats/dfPalette.js');
  const { preloadTamrielTrace } = await imp('ui/tamrielTrace.js');
  const { setTamrielTrace } = await imp('world/tamriel/tamrielLand.js');
  const { setTamrielFit } = await imp('world/tamriel/tamrielFrame.js');
  const { MapsFile } = await imp('formats/mapsFile.js');
  const { WoodsFile } = await imp('formats/woodsFile.js');
  const g = await imp('world/tamriel/tamrielGround.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal, indexedDBRef: null }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const rawMaps = new MapsFile(); rawMaps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const woods0 = new WoodsFile(); woods0.load(bytes('WOODS.WLD'));
  let woods = woods0;
  if (compose) { g.groundMaps(maps); woods = g.groundWoods(woods0); }
  return { maps, rawMaps, woods, woods0, g };
}
// sample places past the Bay (Bay coordinates): found below by name from the capitals / cities
