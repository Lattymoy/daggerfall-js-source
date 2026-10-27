// Lane C probe setup: the freeware's trace at its fit, MAPS.BSA, the Arena templates, TESA's rows on a registry.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const R = '/home/user/daggerfall-js-source/src/';
export const ARENA2 = process.env.ARENA2_PATH ?? '/home/claude/dfdata/arena2';
export const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
export const imp = (p) => import(R + p);

export async function setup() {
  const { DFPalette } = await imp('formats/dfPalette.js');
  const { preloadTamrielTrace } = await imp('ui/tamrielTrace.js');
  const { setTamrielTrace, tamrielTrace } = await imp('world/tamriel/tamrielLand.js');
  const { setTamrielFit } = await imp('world/tamriel/tamrielFrame.js');
  const { MapsFile } = await imp('formats/mapsFile.js');
  const { arenaTemplates, arenaTemplateOf } = await imp('world/arenaLocations.js');
  const { arenaPixels } = await imp('world/arenaPlaces.js');
  const { pastBayPlaceRows, PAST_BAY_SOURCE } = await imp('world/pastBayRows.js');
  const { createWorldPlaces } = await imp('world/worldWide/worldPlaces.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const rows = [];
  for (let r = 0; r < maps.regionCount; r++) {
    if (!maps.getRegion(r)) continue;
    for (let l = 0; l < maps.baseLocationCount(r); l++) { const loc = maps.getLocation(r, l); if (loc?.exterior?.exteriorData) rows.push(loc); }
  }
  const t = arenaTemplates(rows);
  const px = arenaPixels();
  const tesaRows = pastBayPlaceRows({ pixels: px, templateOf: (p) => arenaTemplateOf(t, p), capitals: true });
  const places = createWorldPlaces();
  places.register(PAST_BAY_SOURCE, tesaRows);
  return { maps, gameRows: rows, templates: t, px, tesaRows, places, tamrielTrace };
}
