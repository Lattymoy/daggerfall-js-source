// Probe: can gates stand past the Bay if lanes 1..8 opened? Runs the real theatre scan over the registry with TESA's places.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const R = '/home/user/daggerfall-js-source/src/';
globalThis.atob ??= (s) => Buffer.from(s, 'base64').toString('binary');
const A2 = process.env.ARENA2_PATH;
const bytes = (n) => new Uint8Array(readFileSync(join(A2, n)));
const { DFPalette } = await import(R + 'formats/dfPalette.js');
const { preloadTamrielTrace } = await import(R + 'ui/tamrielTrace.js');
const { setTamrielTrace, tamrielLandVersion } = await import(R + 'world/tamriel/tamrielLand.js');
const { setTamrielFit } = await import(R + 'world/tamriel/tamrielFrame.js');
const { MapsFile } = await import(R + 'formats/mapsFile.js');
const { WoodsFile } = await import(R + 'formats/woodsFile.js');
const { groundMaps, groundWoods, tamrielClimateAt } = await import(R + 'world/tamriel/tamrielGround.js');
const { createWorldPlaces } = await import(R + 'world/worldWide/worldPlaces.js');
const { bayPlaceRows, BAY_SOURCE } = await import(R + 'world/worldWide/bayPlaces.js');
const { pastBayPlaceRows } = await import(R + 'world/pastBayRows.js');
const { arenaPixels } = await import(R + 'world/arenaPlaces.js');
const { createTheatreGateScans } = await import(R + 'scenes/gate/gateLanes.js');
const { theatreGateAreas, findTheatreGateSite } = await import(R + 'systems/gate/theatreGateSite.js');
const { gateSeaPixel } = await import(R + 'systems/gate/gateSite.js');
const { gateNumber, gateAt } = await import(R + 'net/gate/gateLaw.js');
const { THEATRE_KEYS } = await import(R + 'world/worldWide/worldGrid.js');
const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal, indexedDBRef: null }));
setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
const woods = new WoodsFile(); woods.load(bytes('WOODS.WLD'));
groundMaps(maps);
const rows = [];
for (let r = 0; r < maps.regionCount; r++) { if (!maps.getRegion(r)) continue; for (let l = 0; l < maps.baseLocationCount(r); l++) { const loc = maps.getLocation(r, l); if (loc?.exterior?.exteriorData) rows.push(loc); } }
const places = createWorldPlaces();
places.register(BAY_SOURCE, bayPlaceRows(rows));
const tesa = pastBayPlaceRows({ pixels: arenaPixels(), templateOf: () => ({ exterior: { exteriorData: { width: 1, height: 1 } } }), capitals: true });
places.register('tesa', tesa);
console.log('tesa rows', tesa.length);
const ground = groundWoods(woods);
const scans = createTheatreGateScans({ places, land: tamrielLandVersion, open: () => true,
  wet: (x, y) => gateSeaPixel(tamrielClimateAt(x, y), ground.getHeightMapValue(x, y)) });
const t0 = Date.now();
console.log('theatres with ground (all lanes open):', scans.theatres(), `${Date.now() - t0} ms`);
for (let t = 1; t <= 9; t++) {
  const s = scans.scanOf(t);
  const listed = [...places.inTheatre(t)].length;
  const areas = theatreGateAreas(s);
  let px = 0; for (const [, l] of s.byArea) px += l.length;
  console.log(THEATRE_KEYS[t], 'listed', listed, 'gate towns', s.towns.length, 'areas', s.byArea.size, 'areas>=24', areas.length, 'pixels', px);
}
const today = gateAt(Date.now()).day;
for (let t = 1; t <= 8; t++) {
  const out = [];
  for (let d = today; d < today + 3; d++) { const site = scans.siteOf(gateNumber(d, t)); out.push(site ? `${site.place} @${site.px},${site.py}` : 'none'); }
  console.log(THEATRE_KEYS[t], out.join(' | '));
}
// How many distinct pixels the scans' neighbour test asks the registry (each one a pixel-provider roll in the game)
const { scanTheatreGate } = await import(R + 'systems/gate/theatreGateSite.js');
const { theatreAt, areaAt } = await import(R + 'world/worldWide/worldGrid.js');
const asked = new Set(); let calls = 0;
const t1 = Date.now();
for (let t = 1; t <= 8; t++) scanTheatreGate({ towns: places.inTheatre(t), placeAt: (x, y) => { calls++; asked.add(`${x},${y}`); return places.at(x, y); }, inTheatre: (x, y) => theatreAt(x, y) === t, areaAt: (x, y) => areaAt(x, y, () => -1), wet: (x, y) => gateSeaPixel(tamrielClimateAt(x, y), ground.getHeightMapValue(x, y)), theatre: t });
console.log(`8 theatres: placeAt calls ${calls}, distinct pixels ${asked.size}, ${Date.now() - t1} ms (list providers only)`);
