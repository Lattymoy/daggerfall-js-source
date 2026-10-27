// TS9 on the real terrain job: the TS9 test's walled city (a Bay template outlined and walled), its pixel built on the Bay
// (the test's case) and on a real pixel past the Bay with the roads layer's road through it (the curved painter)
import { setup, imp, bytes } from './setup.mjs';
const { woods: raw, ground, maps } = await setup();
const { BlocksFile } = await imp('src/formats/blocksFile.js');
const { longitudeLatitudeToMapPixel, mapPixelToLongitudeLatitude } = await imp('src/formats/mapsFile.js');
const { generatePixelTerrain } = await imp('src/world/terrain/terrainGen.js');
const { setLocationTiles, townRoadRing } = await imp('src/world/terrain/terrainTiles.js');
const { installWorldDataReplacement, bindWorldDataBlocks } = await imp('src/formats/worldData/worldDataReplacement.js');
const { installTownOutline, outlineTownLocation, townOutlineBlockJson } = await imp('src/world/townOutline.js');
const { standTownWall } = await imp('src/world/townWalls.js');
const { arenaTemplates } = await imp('src/world/arenaLocations.js');
const { unwalledLocation, RING } = await imp('src/world/townShape.js');
const { setArenaRoads, beyondKey } = await imp('src/world/arenaRoads.js');
const { DIR } = await imp('src/world/road/roadNetwork.js');
const { TILE } = await imp('src/world/road/roadPainter.js');
const ROADISH = [TILE.road, TILE.roadDirt, TILE.roadGrass];
const { inBay } = await imp('src/world/tamriel/tamrielFrame.js');
const { theatreAt } = await imp('src/world/worldWide/worldGrid.js');
maps.autoDiscard = false;
const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
installWorldDataReplacement(); bindWorldDataBlocks(blocks); installTownOutline();
const bay = maps.getLocationByName('Daggerfall', 'Gothway Garden');
const rows = [];
for (let r = 0; r < 62; r++) { const reg = maps.getRegion(r); if (!reg) continue; for (let l = 0; l < reg.locationCount; l++) { const lc = maps.getLocation(r, l); if (lc) rows.push(unwalledLocation(lc)); } }
const t = arenaTemplates(rows)['city-state'][9];
const io = { classicOf: (n) => blocks.readClassicBlock(blocks.getBlockIndex(blocks.checkName(n))), servedOf: (n) => blocks.getBlockByName(n) };
const D = 128;
const run = (px, py, label) => {
  const ll = mapPixelToLongitudeLatitude(px, py);
  const city = outlineTownLocation({ ...t, mapTableData: { ...t.mapTableData, mapId: ((0xa7 << 20) | 500009) >>> 0, longitude: ll.longitude ?? ll[0], latitude: ll.latitude ?? ll[1] } }, io);
  if (city.outline?.walled) standTownWall(city, t.exterior.exteriorData.blockNames, io, townOutlineBlockJson);
  const tilemap = new Uint8Array(D * D), rect = setLocationTiles(city, maps, blocks, tilemap);
  const roads = new Uint8Array(1000 * 500); if (inBay(px, py)) roads[py * 1000 + px] = DIR.N | DIR.S | DIR.E | DIR.W;
  setArenaRoads(inBay(px, py) ? null : { roads: new Map([[beyondKey(px, py), DIR.N | DIR.S | DIR.E | DIR.W]]), tracks: new Map(), join: new Map() });
  const g = generatePixelTerrain({ woods: ground, px, py, tilemap, locationRect: rect, hasLocation: true, climateType: 0, roads: { roads, tracks: new Uint8Array(1000 * 500), smooth: true } });
  const ring = townRoadRing(g.townGround);
  let whole = 0, wholePainted = 0, halves = 0, halvesPainted = 0;
  for (let i = 0; i < ring.length; i++) {
    if (!ring[i]) continue;
    const v = g.tilemap[i];
    if (ring[i] === RING.road) { whole++; if ((v & 0x3f) === TILE.road) wholePainted++; } else { halves++; if (v && v !== 0xff && ROADISH.includes(v & 0x3f)) halvesPainted++; }
  }
  console.log(label, `(${px},${py}) inBay ${inBay(px, py)} theatre ${theatreAt(px, py)}: ring tiles ${whole} (painted ${wholePainted}), half-tile codes ${halves} (painted ${halvesPainted})`);
};
const p = longitudeLatitudeToMapPixel(bay.mapTableData.longitude, bay.mapTableData.latitude);
run(p.x, p.y, 'the TS9 test\'s case, a Bay pixel');
run(1500, 300, 'past the Bay');
run(1900, 700, 'past the Bay');
run(2100, 1000, 'past the Bay');
