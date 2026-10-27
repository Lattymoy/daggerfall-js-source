// PORT-SHIPS (bible/03-World/Holdings.md section 7, PORT-SHIPS) - EVERY PORT ON THE GROUND THE GAME BUILDS, off the player's own
// ARENA2 (tools/fetch-data.sh; ARENA2_PATH): the Bay's port towns (the port law's - world/portSites.js portTownOnSea over the
// open sea, as test/portTerrain.mjs and the harbour board read it) and every port past the Bay (the capitals' harbour
// slices a port to their own byte, and Arena's ports - BAY-LEFT-SEA's 29), each location read as the game reads it (the
// world-data door's edits: the Bay's walled cities on their outline, TS7; a city past the Bay outlined and walled, TS3/TS4;
// a capital's slice), each map pixel's ground as scenes/pixelBuild.js has the terrain kernel make it (world/terrain/
// terrainGen.js generatePixelTerrain over setLocationTiles' stamp - its tiles and its samples; Deep Waters off). Read as the
// world host reads them: a tile's record 0 is water (world.js navalIsWater's no-Deep-Waters arm), and the ground over the
// sea's top is surfaceAt's less tvSeaY's (the harbour book's `ground`). Positions world metres, x east, z north. Built once a
// process; null without ARENA2.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHarbourBook } from '../src/systems/naval/harbourBook.js';
import { harbourKeep } from '../src/systems/naval/harbourKeep.js';
import { berthSize, BERTH_HULL, BERTH_QUAY_IN, BERTH_QUAY_ENDS, HARBOUR_REACH, BERTH_DRY_M, BOW_TAPER, STERN_TAPER } from '../src/systems/naval/shipLife.js';
import { CAPITALS, capitalDims, SOLITUDE } from '../src/world/tamrielCapitals.js';
import { ALINOR, TORVAL } from '../src/world/capitalPlans.js';
import { IMPERIAL, imperialBearing, bridgeLine, causewayLines } from '../src/world/imperialCity.js';
import { townWallOf } from '../src/world/townWalls.js';

export const ARENA2 = process.env.ARENA2_PATH;
export const HAS_PORT_WORLD = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL', 'WOODS.WLD', 'MAPS.BSA', 'BLOCKS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(ARENA2, f)));
/** The freeware's fit of the Tamriel picture (test/world/worldWide/bayleftsea_capitals.test.js's). */
export const PORT_WORLD_FIT = Object.freeze({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });

let _world;
/** The world, built once - or null without ARENA2. Leaves the trace and the fit set (the caller's `done` clears them). */
export async function portShipsWorld() {
  if (_world !== undefined) return _world;
  if (!HAS_PORT_WORLD) return (_world = null);
  globalThis.atob ??= (s) => Buffer.from(s, 'base64').toString('binary');
  const bytes = (n) => new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), n)));
  const { setTamrielTrace } = await import('../src/world/tamriel/tamrielLand.js');
  const { setTamrielFit, inBay } = await import('../src/world/tamriel/tamrielFrame.js');
  const { DFPalette } = await import('../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../src/ui/tamrielTrace.js');
  const { MapsFile, REGION_NAMES, getWorldClimateSettings, longitudeLatitudeToMapPixel } = await import('../src/formats/mapsFile.js');
  const { BlocksFile } = await import('../src/formats/blocksFile.js');
  const { WoodsFile } = await import('../src/formats/woodsFile.js');
  const { groundMaps, groundWoods } = await import('../src/world/tamriel/tamrielGround.js');
  const wd = await import('../src/formats/worldData/worldDataReplacement.js');
  const tc = await import('../src/world/tamrielCapitals.js');
  const { installCapitals } = await import('../src/world/capitalModels.js');
  const { isMainStoryDungeon } = await import('../src/world/dungeon/dungeonTextures.js');
  const { arenaPixels } = await import('../src/world/arenaPlaces.js');
  const { arenaTemplates, arenaTemplateOf, synthesizeArenaLocation } = await import('../src/world/arenaLocations.js');
  const { outlineTownLocation, townOutlineBlockJson, installTownOutline } = await import('../src/world/townOutline.js');
  const { standTownWall } = await import('../src/world/townWalls.js');
  const { townClimateAt } = await import('../src/world/urban/townLook.js');
  const { buildMapDict, locationSummaryAt } = await import('../src/systems/map/mapDirectory.js');
  const { isWaterPixel } = await import('../src/ui/overworldModel.js');
  const { openSeaOf, portTownOnSea } = await import('../src/world/portSites.js');
  const { isPortTown } = await import('../src/systems/portPlaces.js');
  const { hasPort } = await import('../src/systems/travel/travelPorts.js');
  const { generatePixelTerrain } = await import('../src/world/terrain/terrainGen.js');
  const { setLocationTiles } = await import('../src/world/terrain/terrainTiles.js');
  const { surfaceHeightAt } = await import('../src/world/terrain/terrainSurface.js');
  const { TERRAIN_SIZE, SCALED_OCEAN_ELEVATION, STREAMING_TERRAIN_SCALE } = await import('../src/world/terrain/terrainSampler.js');
  const { locationWorldRect } = await import('../src/world/streamingWorld.js');
  const { GLOBAL_SCALE } = await import('../src/world/meshReader.js');

  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal, indexedDBRef: null }));
  setTamrielFit(PORT_WORLD_FIT);
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK')); maps.autoDiscard = false;
  const rows = [];
  for (let r = 0; r < maps.regionCount; r++) { if (!maps.getRegion(r)) continue; for (let l = 0; l < maps.baseLocationCount(r); l++) { const loc = maps.getLocation(r, l); if (loc) rows.push(loc); } }
  const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
  const woods0 = new WoodsFile(); woods0.load(bytes('WOODS.WLD'));
  groundMaps(maps);
  const woods = groundWoods(woods0);
  wd.installWorldDataReplacement(); wd.bindWorldDataBlocks(blocks);
  installCapitals({ addTextures: () => 0 });
  installTownOutline();   // the Bay's walled cities read on their outline from here (TS7)
  const base = tc.capitalBase(rows, isMainStoryDungeon), names = tc.cityBlockNames(rows);
  const pinPort = (k) => { const c = tc.capitalCentrePixel(k); return !!(c && arenaPixels()?.byPixel.get(`${c.px},${c.py}`)?.port); };
  const io = { classicOf: (n) => blocks.readClassicBlock(blocks.getBlockIndex(blocks.checkName(n))), servedOf: (n) => blocks.getBlockByName(n) };
  const templates = arenaTemplates(rows, isMainStoryDungeon);
  const dict = buildMapDict(maps);
  const kept = new Map();
  /** The location a pixel stands, as the world host reads it (tamrielPlacesHost.js capitalLocationAt / arenaLocationAt; the
   *  Bay's MAPS.BSA row through the door). */
  const locationAt = (px, py) => {
    const key = `${px},${py}`;
    if (kept.has(key)) return kept.get(key);
    let loc = null;
    if (inBay(px, py)) {
      const s = locationSummaryAt(dict, px, py);
      loc = s ? maps.getLocation(s.regionIndex, s.locationIndex ?? s.mapIndex) : null;
    } else if (tc.capitalOnPixel(px, py)) {
      const on = tc.capitalOnPixel(px, py);
      loc = tc.synthesizeCapitalLocation(on, { base, names, blockOf: (n) => blocks.getBlockByName(n), px, py, pinPort: pinPort(on.k) });
    } else {
      const place = arenaPixels()?.byPixel.get(key), template = place ? arenaTemplateOf(templates, place) : null;
      if (template) {
        const regionIndex = maps.getRegionIndexAt(px, py);
        loc = outlineTownLocation(synthesizeArenaLocation(template, place, { regionIndex, regionName: REGION_NAMES[regionIndex], politic: 128 + regionIndex, climate: townClimateAt(px, py, getWorldClimateSettings(maps.getClimateIndex(px, py))) }), io, { round: tc.imperialOutskirts(px, py) });
        if (loc.outline?.walled) standTownWall(loc, template.exterior.exteriorData.blockNames, io, townOutlineBlockJson);
      }
    }
    kept.set(key, loc?.exterior?.exteriorData ? loc : null);
    return kept.get(key);
  };
  const terr = new Map();
  /** A map pixel's ground as the pixel's build has the kernel make it: its tiles and its samples. */
  const terrainAt = (px, py) => {
    const key = `${px},${py}`;
    if (!terr.has(key)) {
      const tm = new Uint8Array(128 * 128), loc = locationAt(px, py);
      const rect = loc ? setLocationTiles(loc, maps, blocks, tm) : null;
      const t = generatePixelTerrain({ woods, px, py, tilemap: tm, locationRect: rect, hasLocation: !!loc, climateType: getWorldClimateSettings(maps.getClimateIndex(px, py)).climateType, flattenAt: loc?.capital?.flattenAt ?? null });
      terr.set(key, { tiles: t.tilemapBytes, samples: t.samples });
    }
    return terr.get(key);
  };
  const pixelOf = (x, z) => [Math.floor(x / TERRAIN_SIZE), 499 - Math.floor(z / TERRAIN_SIZE)];
  /** world.js navalIsWater's no-Deep-Waters arm: the tile's record 0. */
  const isWater = (x, z) => {
    const [px, py] = pixelOf(x, z);
    const tx = Math.min(127, Math.max(0, Math.trunc(((x - px * TERRAIN_SIZE) / TERRAIN_SIZE) * 128)));
    const tz = Math.min(127, Math.max(0, Math.trunc(((z - (499 - py) * TERRAIN_SIZE) / TERRAIN_SIZE) * 128)));
    return (terrainAt(px, py).tiles[tz * 128 + tx] >> 2) === 0;
  };
  const SEA_Y = SCALED_OCEAN_ELEVATION * STREAMING_TERRAIN_SCALE;
  /** The ground over the sea's top (m): world.js surfaceAt less tvSeaY (Deep Waters off). */
  const ground = (x, z) => {
    const [px, py] = pixelOf(x, z);
    return surfaceHeightAt(terrainAt(px, py).samples, x - px * TERRAIN_SIZE, z - (499 - py) * TERRAIN_SIZE) - SEA_Y;
  };
  /** A town's footprint in the scene (navalHarbourNear's rect, metres). */
  const rectOf = (loc, px, py) => {
    const r = locationWorldRect(loc, px, py);
    return { minX: r.minX * GLOBAL_SCALE, maxX: r.maxX * GLOBAL_SCALE, minZ: r.minZ * GLOBAL_SCALE, maxZ: r.maxZ * GLOBAL_SCALE };
  };
  // the Bay's port towns, the port law's (test/portTerrain.mjs's selection)
  const seaPixel = (x, y) => isWaterPixel(maps.getClimateIndex(x, y), woods0.getHeightMapValue(x, y));
  const mask = openSeaOf(seaPixel, 1000, 500);
  const openSea = (x, y) => x >= 0 && y >= 0 && x < 1000 && y < 500 && mask[y * 1000 + x] === 1;
  const bay = [];
  for (const s of dict.values()) {
    const row = maps.getLocation(s.regionIndex, s.mapIndex);
    if (!row?.mapTableData || !isPortTown(row, portTownOnSea(row, hasPort, openSea))) continue;
    const p = longitudeLatitudeToMapPixel(row.mapTableData.longitude, row.mapTableData.latitude);
    const loc = locationAt(p.x, p.y);
    if (loc?.name === row.name) bay.push({ name: row.name, px: p.x, py: p.y, loc });
  }
  // past the Bay: each capital's harbour slice that is a port to its own byte, then Arena's ports
  const pastBay = [];
  tc.CAPITALS.forEach((cap, k) => {
    const s = tc.capitalHarbourSlice(cap), at = tc.capitalSpanPixels(k)[s];
    if (!at || !tc.capitalSlicePort(k, s, pinPort(k))) return;
    const loc = locationAt(at.x, at.y);
    if (loc) pastBay.push({ name: loc.name, px: at.x, py: at.y, loc });
  });
  for (const [key, p] of arenaPixels().byPixel) {
    const [px, py] = key.split(',').map(Number);
    if (!p.port || tc.capitalOnPixel(px, py)) continue;
    const loc = locationAt(px, py);
    if (loc) pastBay.push({ name: p.name, px, py, loc });
  }
  const done = () => { setTamrielTrace(null); setTamrielFit(null); };
  return (_world = { maps, blocks, locationAt, terrainAt, isWater, ground, rectOf, bay, pastBay, done, SEA_Y });
}

// ---------------------------------------------------------------- the test's own reading of a port

const BLOCK = 102.4;
/** Inside a polygon. */
const inside = (pts, x, z) => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
};
const segD = (x, z, [ax, az], [bx, bz]) => {
  const ux = bx - ax, uz = bz - az, l = ux * ux + uz * uz, t = l ? Math.max(0, Math.min(1, ((x - ax) * ux + (z - az) * uz) / l)) : 0;
  return Math.hypot(x - ax - ux * t, z - az - uz * t);
};
/** This test's own reading of a port's town at a scene point: 'walls' (inside them or on them), 'pier', 'stack', 'arch',
 *  'way' - or null. A capital by its measures (the anchor's metres), a walled town by its registered wall's line (its
 *  length 9.6 m thick); a town with no wall of its own, nothing. */
export function townAt(port, rect) {
  const { loc } = port;
  if (loc.capital) {
    const cap = CAPITALS[loc.capital.k], D = capitalDims(cap), sx = loc.capital.s % D.w, sy = Math.floor(loc.capital.s / D.w);
    const ax = rect.minX + (cap.anchor[0] - sx * 8) * BLOCK, az = rect.maxZ - (cap.anchor[1] - sy * 8) * BLOCK;
    const rectWalls = (W, open) => (dx, dz) => dx >= W.west - W.thick / 2 && dx <= W.east + W.thick / 2 && dz >= W.north - W.thick / 2 && dz <= W.south + (open ? 0 : W.thick / 2);
    const piers = (Q) => (dx, dz) => dz >= Math.min(Q.edge, Q.pierTo) && dz <= Math.max(Q.edge, Q.pierTo) && Q.piers.some((p) => Math.abs(dx - p) <= Q.pierW / 2);
    const laws = {
      solitude: [['walls', rectWalls(SOLITUDE.wall, false)], ['pier', piers(SOLITUDE.docks)],
        ['stack', (dx, dz) => Math.hypot(dx - SOLITUDE.stack.x, dz - SOLITUDE.stack.z) <= SOLITUDE.stack.r + 11],
        ['arch', (dx, dz) => dx >= SOLITUDE.stack.x && dx <= SOLITUDE.arch.to && Math.abs(dz) <= SOLITUDE.arch.w / 2 + 4]],
      alinor: [['walls', rectWalls(ALINOR.wall, true)], ['pier', piers(ALINOR.quay)]],
      torval: [['walls', rectWalls(TORVAL.wall, true)], ['pier', piers(TORVAL.quay)]],
      'imperial-city': [['walls', (dx, dz) => Math.hypot(dx, dz) <= IMPERIAL.cityWall.r + IMPERIAL.cityWall.thick / 2],
        ['pier', (dx, dz) => { const r = Math.hypot(dx, dz), b = imperialBearing(dx, dz), W = IMPERIAL.waterfront; return r >= W.r1 && r <= W.pierTo && W.piers.some((p) => Math.abs(((b - p + 540) % 360) - 180) * (Math.PI / 180) * r <= W.pierW / 2); }],
        ['way', (dx, dz) => [...causewayLines(), bridgeLine()].some(([a, b]) => segD(dx, dz, a, b) <= IMPERIAL.bridge.w / 2)]],
    }[cap.key] ?? [];
    return (x, z) => { const dx = x - ax, dz = az - z; for (const [what, at] of laws) if (at(dx, dz)) return what; return null; };
  }
  const wall = loc.outline?.walled ? townWallOf(loc) : null;
  if (!wall) return () => null;
  const line = wall.line.map(([x, z]) => [rect.minX + x, rect.minZ + z]);
  return (x, z) => (inside(line, x, z) || line.some((p, i) => segD(x, z, line[(i + line.length - 1) % line.length], p) <= 4.8) ? 'walls' : null);
}
/** A berth's ship (her template's footprint) and her quay, every metre: [x, z]. */
export function shipAndQuay(b) {
  const { halfWidth, bowZ, aftZ } = berthSize(BERTH_HULL), fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), lx = -b.normal[0], lz = -b.normal[1], out = [];
  for (let z = aftZ - BERTH_QUAY_ENDS; z <= bowZ + BERTH_QUAY_ENDS; z += 1) for (let x = -halfWidth; x <= halfWidth + BERTH_QUAY_IN; x += 1) out.push([b.pos[0] + fx * z + lx * x, b.pos[1] + fz * z + lz * x]);
  return out;
}
/** The highest the ground stands over the sea's top under her waterplane (her beam drawn in to her stem and her stern),
 *  every metre. */
export function groundUnder(b, ground) {
  const { halfWidth, bowZ, aftZ } = berthSize(BERTH_HULL), L = bowZ - aftZ, fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), sx = fz, sz = -fx;
  let top = -Infinity;
  for (let z = aftZ; z <= bowZ; z += 1) {
    const w = halfWidth * Math.max(0, Math.min(1, (bowZ - z) / (BOW_TAPER * L), (z - aftZ) / (STERN_TAPER * L)));
    for (let s = -w; s <= w + 1e-6; s += Math.max(1, w / 4)) top = Math.max(top, ground(b.pos[0] + fx * z + sx * s, b.pos[1] + fz * z + sz * s));
  }
  return top;
}
/** A port's harbour through the book - its own reach, then the port law's ring (FB1020c) - as the world host hands it:
 *  `laws` its town's keep and the ground, or none (the water alone, as it was). */
export function soundPort(w, port, laws) {
  const rect = w.rectOf(port.loc, port.px, port.py);
  const keep = laws ? harbourKeep(port.loc, rect) : null;
  const book = createHarbourBook({ harbourNear: () => ({ key: port.name, name: port.name, rect, reach: HARBOUR_REACH, ready: () => true, keep }), isWater: (x, z) => w.isWater(x, z), ...(laws ? { ground: w.ground } : {}) });
  book.step(0);
  return { rect, keep, berths: book.get(port.name)?.harbour?.berths ?? [] };
}
/** Each port's berths and the ones standing wrong: [name, berths, [what each wrong one stands on]]. */
export function measurePorts(w, ports, laws) {
  const out = [];
  for (const port of ports) {
    const { rect, keep, berths } = soundPort(w, port, laws), town = townAt(port, rect), wrong = [];
    for (const b of berths) {
      const hits = new Set();
      for (const [x, z] of shipAndQuay(b)) { const t = town(x, z); if (t) hits.add(t); }
      if (groundUnder(b, w.ground) > BERTH_DRY_M) hits.add('land');
      if (hits.size) wrong.push([...hits].sort().join('+'));
    }
    out.push({ name: port.name, port, rect, keep, berths, wrong });
  }
  return out;
}
