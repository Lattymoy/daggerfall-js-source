// TOWN-SHAPES TS9 (2026-10-26, the owner: "Roads around the city arent properly blended when they are angled";
// bible/03-World/Town-Shapes.md TS9): a town's road ring (the mod's "Paint roads around locations", round its outline
// since TS2) is painted whole - the painter's skip guard passed by every ring tile off the location rect and off the
// pixel's centre cross and diagonals, so a town's ring stood as bars across its roads and stubs on its diagonals - and its
// angled edges are blended with the road's own diagonal edge (47 over dirt, 55 over grass), as a diagonal road's flanks
// are: a step's notch outside takes a half tile with its road toward the ring, a step's corner inside one with its road
// away from the town's ground. Pinned on the ring's law, on the painter (its turns read off the mod's own flanks), and on
// real towns of the Bay and past it (ARENA2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { townRoadRing } from '../../../src/world/terrain/terrainTiles.js';
import { RING } from '../../../src/world/townShape.js';
import { paintRoads, TILE } from '../../../src/world/road/roadPainter.js';
import { DIR } from '../../../src/world/road/roadNetwork.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !['MAPS.BSA', 'BLOCKS.BSA', 'WOODS.WLD'].every((f) => existsSync(join(ARENA2 ?? '', f))) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;
const D = 128;
/** A town's ground: a square with its north-west corner cut on a 45-degree stair (x + y > 70 kept), y north. */
function stairTown() {
  const mask = new Uint8Array(D * D);
  for (let y = 40; y < 88; y++) for (let x = 40; x < 88; x++) if (!(x - 40 < 24 && 87 - y < 24 && (x - 40) + (87 - y) < 24)) mask[y * D + x] = 1;
  return mask;
}
const at = (a, x, y) => a[y * D + x];

test('TS9 the ring\'s law: whole road off the town\'s ground within two and a half of it; along a straight side no half tile; on a 45-degree side every step\'s notch outside a half with its road toward the ring, every step\'s corner inside one with its road away from the town - one straight edge each way (mutants: the notches unblended; the corners unblended; a notch turned wrong)', () => {
  const mask = stairTown(), ring = townRoadRing(mask);
  // a straight side (the south, y = 40): the ring under it whole, nothing halved
  for (let x = 60; x < 80; x++) { assert.equal(at(ring, x, 39), RING.road); assert.equal(at(ring, x, 38), RING.road); assert.equal(at(ring, x, 37), 0, 'two and a half: two rows'); }
  // the cut: the town's ground is x + y > 70 (x - 40 + 87 - y >= 24) in the north-west; the ring runs outside it
  let notches = 0, corners = 0;
  for (let y = 66; y < 86; y++) for (let x = 42; x < 62; x++) {
    const v = at(ring, x, y);
    if (v === RING.SE) {
      // a notch: off the ring and the ground, the ring south and east of it
      assert.ok(!at(mask, x, y) && at(ring, x, y - 1) === RING.road && at(ring, x + 1, y) === RING.road, `(${x}, ${y}) a notch`);
      notches++;
    }
    if (v === RING.NW) {
      // a corner: the ground south and east of it - its road away, north-west
      assert.ok(at(mask, x, y - 1) && at(mask, x + 1, y), `(${x}, ${y}) a corner on the ground's stair`);
      corners++;
    }
    assert.ok(![RING.NE, RING.SW].includes(v), `(${x}, ${y}): no half turned across the stair`);
  }
  assert.ok(notches >= 15 && corners >= 15, `the stair blended both sides (${notches} notches, ${corners} corners)`);
  // every outer step blended: a tile off the ring and the ground with the ring at its south and east and neither at its
  // north and west is a half, never bare
  for (let y = 1; y < D - 1; y++) for (let x = 1; x < D - 1; x++) {
    if (at(ring, x, y) || at(mask, x, y)) continue;
    const s = at(ring, x, y - 1) === RING.road, e = at(ring, x + 1, y) === RING.road, n = at(ring, x, y + 1), w = at(ring, x - 1, y);
    if (s && e && !n && !w && !at(mask, x, y + 1) && !at(mask, x - 1, y)) assert.fail(`(${x}, ${y}) a bare step`);
  }
});

test('TS9 the painter: a ring tile painted wherever it stands (past the rect, off the cross and the diagonals), whole as road, a half as the diagonal\'s own edge turned as the mod turns its flanks - over grass 55, over dirt 47, over the sea none, never over an arm\'s road (mutants: the guard unwidened; the halves unpainted; a half over the sea; the turns crossed)', () => {
  // the mod's own flanks: a NE-SW road's tile at x = y + 1 (its road north and west) and at x + 1 = y (south and east);
  // a NW-SE road's at the mirror (north and east; south and west)
  const grass = new Uint8Array(129 * 129).fill(TILE.grass);
  const ne = new Uint8Array(D * D); paintRoads(grass, ne, DIR.NE | DIR.SW, 0);
  const nw = new Uint8Array(D * D); paintRoads(grass, nw, DIR.NW | DIR.SE, 0);
  const flank = { [RING.NW]: at(ne, 31, 30), [RING.SE]: at(ne, 30, 31), [RING.NE]: at(nw, 127 - 31, 30), [RING.SW]: at(nw, 127 - 30, 31) };
  for (const v of Object.values(flank)) assert.equal(v & 0x3f, TILE.roadGrass, 'a flank is the diagonal\'s edge over grass');
  // a ring of every code, past a small rect and off the cross and the diagonals
  const rect = { xMin: 60, xMax: 68, yMin: 60, yMax: 68, ring: new Uint8Array(D * D) };
  const spots = { [RING.road]: [10, 20], [RING.NW]: [11, 20], [RING.NE]: [12, 20], [RING.SE]: [13, 20], [RING.SW]: [14, 20] };
  for (const [code, [x, y]] of Object.entries(spots)) rect.ring[y * D + x] = Number(code);
  const tiles = new Uint8Array(D * D), paths = new Uint8Array(D * D);
  paintRoads(grass, tiles, DIR.N | DIR.S, 0, rect, 129, { paths });
  assert.equal(at(tiles, 10, 20), TILE.road, 'whole: road, past the rect');
  for (const code of [RING.NW, RING.NE, RING.SE, RING.SW]) {
    const [x, y] = spots[code];
    assert.equal(at(tiles, x, y), flank[code], `the half toward ${Object.keys(RING).find((k) => RING[k] === code)} turned as the mod's flank with its road there`);
    assert.equal(at(paths, x, y), 1, 'a path the painter wrote');
  }
  // over dirt the dirt edge; over the sea nothing
  const ground = Uint8Array.from(grass); ground[20 * 129 + 11] = TILE.dirt; ground[20 * 129 + 12] = TILE.water;
  const t2 = new Uint8Array(D * D);
  paintRoads(ground, t2, DIR.N | DIR.S, 0, rect, 129);
  assert.equal(at(t2, 11, 20) & 0x3f, TILE.roadDirt);
  assert.equal(at(t2, 12, 20), 0, 'the sea keeps its tile');
  // no road through the pixel: no ring
  const none = new Uint8Array(D * D);
  paintRoads(grass, none, 0, DIR.E | DIR.W, rect, 129);
  assert.equal(at(none, 10, 20), 0);
  // an arm's road is never halved: a half on the N-S arm's own column
  const armRect = { xMin: 0, xMax: 1, yMin: 0, yMax: 1, ring: new Uint8Array(D * D) };
  armRect.ring[20 * D + 63] = RING.NW;
  const t3 = new Uint8Array(D * D);
  paintRoads(grass, t3, DIR.N | DIR.S, 0, armRect, 129);
  assert.equal(at(t3, 63, 20), TILE.road, 'the arm\'s road kept');
});

test('TS9 with ARENA2: a town of the Bay and a walled city past it - every ring tile painted (none bare where the guard passed it by), every outer step on dry ground blended', { skip: skipReal }, async () => {
  const { MapsFile, longitudeLatitudeToMapPixel } = await import('../../../src/formats/mapsFile.js');
  const { WoodsFile } = await import('../../../src/formats/woodsFile.js');
  const { BlocksFile } = await import('../../../src/formats/blocksFile.js');
  const { generatePixelTerrain } = await import('../../../src/world/terrain/terrainGen.js');
  const { setLocationTiles } = await import('../../../src/world/terrain/terrainTiles.js');
  const { installWorldDataReplacement, bindWorldDataBlocks } = await import('../../../src/formats/worldData/worldDataReplacement.js');
  const { installTownOutline, outlineTownLocation, townOutlineBlockJson } = await import('../../../src/world/townOutline.js');
  const { standTownWall } = await import('../../../src/world/townWalls.js');
  const { arenaTemplates } = await import('../../../src/world/arenaLocations.js');
  const { unwalledLocation } = await import('../../../src/world/townShape.js');
  const b = (f) => new Uint8Array(readFileSync(join(ARENA2, f)));
  const maps = new MapsFile(); maps.load(b('MAPS.BSA'), b('CLIMATE.PAK'), b('POLITIC.PAK')); maps.autoDiscard = false;
  const woods = new WoodsFile(); woods.load(b('WOODS.WLD'));
  const blocks = new BlocksFile(); blocks.load(b('BLOCKS.BSA'));
  installWorldDataReplacement(); bindWorldDataBlocks(blocks); installTownOutline();
  const bay = maps.getLocationByName('Daggerfall', 'Gothway Garden');
  const p = longitudeLatitudeToMapPixel(bay.mapTableData.longitude, bay.mapTableData.latitude);
  const rows = [];
  for (let r = 0; r < 62; r++) { const reg = maps.getRegion(r); if (!reg) continue; for (let l = 0; l < reg.locationCount; l++) { const lc = maps.getLocation(r, l); if (lc) rows.push(unwalledLocation(lc)); } }
  const t = arenaTemplates(rows)['city-state'][9];
  const io = { classicOf: (n) => blocks.readClassicBlock(blocks.getBlockIndex(blocks.checkName(n))), servedOf: (n) => blocks.getBlockByName(n) };
  const city = outlineTownLocation({ ...t, mapTableData: { ...t.mapTableData, mapId: ((0xa7 << 20) | 500009) >>> 0, longitude: bay.mapTableData.longitude, latitude: bay.mapTableData.latitude } }, io);
  if (city.outline?.walled) standTownWall(city, t.exterior.exteriorData.blockNames, io, townOutlineBlockJson);
  for (const [what, loc] of [['Gothway Garden', bay], [`${t.name} past the Bay`, city]]) {
    const tilemap = new Uint8Array(D * D), rect = setLocationTiles(loc, maps, blocks, tilemap);
    const roads = new Uint8Array(1000 * 500); roads[p.y * 1000 + p.x] = DIR.N | DIR.S | DIR.E | DIR.W;
    const g = generatePixelTerrain({ woods, px: p.x, py: p.y, tilemap, locationRect: rect, hasLocation: true, climateType: 0, roads: { roads, tracks: new Uint8Array(1000 * 500), smooth: true } });
    // the ring as the job laid it: off the town's ground (townGroundMask, on its own samples), which the job answers
    const ground = g.townGround;
    assert.ok(ground, `${what}: the job answers its ground`);
    const ring = townRoadRing(ground);
    let whole = 0, halves = 0, painted = 0;
    for (let i = 0; i < ring.length; i++) {
      if (!ring[i]) continue;
      const v = g.tilemap[i];
      if (ring[i] === RING.road) { whole++; if ((v & 0x3f) === TILE.road || v === 0xff) painted++; else assert.ok(v !== 0, `${what}: a ring tile (${i % D}, ${Math.floor(i / D)}) bare`); }
      else if (v !== 0 && v !== 0xff) { halves++; assert.ok([TILE.roadDirt, TILE.roadGrass, TILE.road].includes(v & 0x3f), `${what}: a half its edge (${v})`); }
    }
    assert.ok(whole > 200 && painted > whole * 0.9, `${what}: the ring whole (${painted} of ${whole})`);
    assert.ok(halves > 8, `${what}: its angled edges blended (${halves})`);
  }
});
