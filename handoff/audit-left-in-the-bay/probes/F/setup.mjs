// shared setup: loads the PR head's modules (scratch copy) over the freeware
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
export const ROOT = process.env.SRC_ROOT ?? '/tmp/claude-0/-home-user-daggerfall-js-source/dae0405a-f226-582d-9131-f2490d1f38e5/scratchpad/audit/F/head';
const ARENA2 = process.env.ARENA2_PATH ?? '/home/claude/dfdata/arena2';
export const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
export const imp = (p) => import(join(ROOT, p));
export const FIT = { ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 };
export async function setup({ maps: wantMaps = true } = {}) {
  globalThis.atob ??= (s) => Buffer.from(s, 'base64').toString('binary');
  const { DFPalette } = await imp('src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await imp('src/ui/tamrielTrace.js');
  const { setTamrielTrace } = await imp('src/world/tamriel/tamrielLand.js');
  const { setTamrielFit } = await imp('src/world/tamriel/tamrielFrame.js');
  const { WoodsFile } = await imp('src/formats/woodsFile.js');
  const { groundWoods, groundMaps } = await imp('src/world/tamriel/tamrielGround.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  const trace = await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal, indexedDBRef: null });
  setTamrielTrace(trace);
  setTamrielFit(FIT);
  const woods = new WoodsFile(); woods.load(bytes('WOODS.WLD'));
  let maps = null;
  if (wantMaps) {
    const { MapsFile } = await imp('src/formats/mapsFile.js');
    maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
    groundMaps(maps);
  }
  return { trace, woods, ground: groundWoods(woods), maps };
}
