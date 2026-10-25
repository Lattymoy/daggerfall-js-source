// WW-C2 (2026-10-24, bible/03-World/World-Wide.md WW-C, bible/11-Multiplayer/Wild-Zone.md section 25; the owner:
// "Cyrodil becomes the new open PvP area with the wrothgarian mountain area being retired in favor of this. Cryodil will
// be home to all abundent resources and everything else from the wrothgarian zone") - THE OPEN ZONE IS CYRODIIL: its
// mask the province whole on a grid of cells laid on the world (systems/wild/cyrodiilZone.js), its halls and its
// giants on it, a hall's key and room a world pixel's (net/wire.js), its ground the continent's own whatever the land
// switch (scenes/zoneHallsHost.js), a pose's pixel floored past the Bay, the maps over the continent, no gate in it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { cyrodiilMask, cyrodiilBox, inCyrodiil, CYRODIIL_THEATRE, CYRODIIL_CELL_PX } from '../../../src/systems/wild/cyrodiilZone.js';
import { wildInside, wildNear, wildRingAt, wildRingAnchors, wildEdgeChains, maskWorld, maskWorldBox, ringOfCell, WILD_REGION, WILD_RINGS, isWildRegion } from '../../../src/systems/wild/wildZone.js';
import { wildHallPicks, WILD_DUNGEONS_PER_RING, WILD_HALL_POOL_MAX } from '../../../src/systems/wild/wildDungeons.js';
import { wildGiantsAt, WILD_GIANT_COUNT, wildGiantRing } from '../../../src/systems/wild/wildGiants.js';
import { createZoneHalls } from '../../../src/scenes/zoneHallsHost.js';
import { theatreAt, areaOfDistrict, districtOf } from '../../../src/world/worldWide/worldGrid.js';
import { setTamrielTrace } from '../../../src/world/tamriel/tamrielLand.js';
import { CLIMATES, CYRODIIL_REGION, MAX_MAP_PIXEL_X, MAX_MAP_PIXEL_Y } from '../../../src/formats/mapsTables.js';
import { worldCoordToMapPixel as fileWorldToPixel } from '../../../src/formats/mapsFile.js';
import { worldCoordToMapPixel, mapPixelToWorldCoords } from '../../../src/world/streamingWorld.js';
import { sitePixelOfNative } from '../../../src/systems/serpent/serpentSite.js';
import {
  wdunHall, wdunRoomKey, wdunHallOfRoom, spawnedHallMapId, WDUN_WORLD_LANE, relaySupportsWdunWorld, WDUN_WORLD_RELAY_MIN,
  RELAY_VERSION, isWorldRoom, mapPixelOfWire, cellRoomOfWire, worldRoom, PIXEL_UNITS, WORLD_WIDE_RELAY_MIN,
} from '../../../src/net/wire.js';
import { summaryPixel } from '../../../src/ui/overworldModel.js';
import { zoneMapView, zoneMapLimits, ringPixels } from '../../../src/ui/wild/wildZoneMap.js';
import { fogPixels } from '../../../src/ui/wild/wildMapInk.js';
import { theatreGateAreas } from '../../../src/systems/gate/theatreGateSite.js';
import { GATE_REGION_MIN_PIXELS } from '../../../src/systems/gate/gateSite.js';
import { hostText } from '../../hostText.mjs';   // AUDIT TESA II (lane K's K6): the negative reads the host WHOLE (HOST-SPLIT 2, the second read)

const MAP_W = 1000, MAP_H = 500;
const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const mask = cyrodiilMask();
/** A stable hash, 0..1 - a scatter of places. */
const hash = (x, y) => { let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1); h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); return ((h ^ (h >>> 13)) >>> 0) / 4294967296; };

/** The Bay's WOODS alone - every read past it clamped to its edge, as WoodsFile is (TAMRIEL2's own stub, test/world/tamriel2.test.js). */
class BayWoods {
  constructor() { this.heightMapBuffer = new Uint8Array(MAP_W * MAP_H).fill(3); }
  getHeightMapValue(x, y) { return this.heightMapBuffer[Math.max(0, Math.min(MAP_H - 1, y)) * MAP_W + Math.max(0, Math.min(MAP_W - 1, x))]; }
  getHeightMapValuesRange1Dim(x0, y0, dim) { const d = new Uint8Array(dim * dim); for (let y = 0; y < dim; y++) for (let x = 0; x < dim; x++) d[x + y * dim] = this.getHeightMapValue(x0 + x, y0 + y); return d; }
  getLargeMapData() { const d = []; for (let i = 0; i < 5; i++) d.push(new Uint8Array(5).fill(3)); return d; }
  getLargeHeightMapValuesRange(x0, y0, dim) {
    const side = dim * 3, dst = new Uint8Array(side * side);
    for (let y = 0; y < dim; y++) for (let x = 0; x < dim; x++) {
      const src = this.getLargeMapData(x0 + x, y0 - y);
      for (let iy = 1; iy < 4; iy++) for (let ix = 1; ix < 4; ix++) dst[(y * 3 + iy - 1) * side + (x * 3 + ix - 1)] = src[ix][4 - iy];
    }
    return dst;
  }
}

test('WW-C2 THE ZONE IS CYRODIIL, WHOLE: every cell whose middle is the Imperial Province\'s, on one lattice over the world; never the Bay; kept while the picture stands, built again when it moves (mutants: a cell by its corner; the lattice the box\'s; the cache never moved)', () => {
  assert.equal(WILD_REGION, CYRODIIL_REGION);
  assert.ok(isWildRegion(CYRODIIL_REGION) && !isWildRegion(16), 'the Wrothgarian Mountains retired');
  assert.ok(mask?.box, 'the picture holds the Imperial Province');
  assert.equal(mask.cell, CYRODIIL_CELL_PX);
  assert.equal(mask.ox % CYRODIIL_CELL_PX, 0, 'the world\'s one lattice');
  assert.equal(mask.oy % CYRODIIL_CELL_PX, 0);
  const mid = Math.floor(CYRODIIL_CELL_PX / 2);
  let cells = 0, checked = 0;
  for (let cy = 0; cy < mask.height; cy++) {
    for (let cx = 0; cx < mask.width; cx++) {
      const inside = mask.inside[cy * mask.width + cx] === 1;
      cells += inside ? 1 : 0;
      if ((cx * 7 + cy * 13) % 11) continue;
      const [x, y] = maskWorld(mask, cx, cy);
      assert.equal(inside, theatreAt(x + mid, y + mid) === CYRODIIL_THEATRE, `cell ${cx},${cy}: its middle's province`);
      assert.equal(wildInside(mask, x + 1, y + 3), inside, 'every pixel of a cell its cell\'s');
      checked++;
    }
  }
  assert.ok(checked > 10_000 && cells > 100_000, `a province's zone (${cells} cells, ${cells * 16} pixels)`);
  const box = /** @type {any} */ (cyrodiilBox());
  const wb = /** @type {any} */ (maskWorldBox(mask));
  assert.ok(wb.x0 >= box.x0 - CYRODIIL_CELL_PX && wb.x1 <= box.x1 + CYRODIIL_CELL_PX, 'the zone inside the picture\'s box of the province');
  for (const [x, y] of [[0, 0], [999, 0], [0, 499], [999, 499], [500, 250]]) assert.ok(!wildNear(mask, x, y), `the Bay's ${x},${y}: never near the zone`);
  assert.ok(MAX_MAP_PIXEL_X <= wb.x0 && MAX_MAP_PIXEL_Y > 0, 'the zone lies east of the Bay\'s map');
  // the heart: deep in the province, named by the anchors, and the inside of a zone pixel its province's
  const [heart] = wildRingAnchors(mask);
  assert.equal(heart.ring, WILD_RINGS);
  assert.equal(wildRingAt(heart.x, heart.y, mask), WILD_RINGS);
  assert.ok(inCyrodiil(heart.x, heart.y));
  const [edge] = wildEdgeChains(mask);
  assert.ok(edge.every((p) => (p.x - mask.ox) % CYRODIIL_CELL_PX === 0 && (p.y - mask.oy) % CYRODIIL_CELL_PX === 0), 'the edge on the cells\' corners, on the world');
  // kept, then built again when the picture moves - the same zone off the same picture
  assert.equal(cyrodiilMask(), mask, 'kept while the picture stands');
  setTamrielTrace(null);   // the authored shape again: the version moves
  const again = cyrodiilMask();
  assert.notEqual(again, mask, 'built again');
  assert.deepEqual([again.width, again.height, again.ox, again.oy, again.maxDepth], [mask.width, mask.height, mask.ox, mask.oy, mask.maxDepth], 'the same zone off the same picture');
});

test('WW-C2 THE HALLS AND THE GIANTS ON CYRODIIL: every tier its count, each hall in its own tier and the province, a hall\'s key and room a world pixel\'s - the room the halls\' lane, read back; the giants two a tier, inside; the ground asked a few hundred times (mutants: the hall on the grid\'s number; the room the Bay\'s lane; the giants\' every cell asked)', () => {
  const m = cyrodiilMask();
  let asked = 0;
  const free = (x, y) => { asked++; return hash(x, y) > 0.15; };
  const halls = wildHallPicks(m, free, 20500);
  assert.deepEqual([1, 2, 3, 4].map((r) => halls.filter((h) => h.ring === r).length), [...WILD_DUNGEONS_PER_RING]);
  assert.ok(asked <= WILD_RINGS * WILD_HALL_POOL_MAX * 3, `the ground asked ${asked} times`);
  for (const h of halls) {
    assert.equal(wildRingAt(h.x, h.y, m), h.ring, `${h.key}: in its own tier`);
    assert.ok(inCyrodiil(h.x, h.y) && free(h.x, h.y), `${h.key}: the province's, on free ground`);
    assert.equal(h.key, `${h.x},${h.y}`);
    assert.equal(wdunHall(h.key), h.key, 'its key is the wire\'s');
    const room = /** @type {string} */ (wdunRoomKey(h.key));
    assert.ok(isWorldRoom(room));
    assert.equal(spawnedHallMapId(h.x, h.y) >>> 28, WDUN_WORLD_LANE, 'the halls\' lane');
    assert.equal(wdunHallOfRoom(room), h.key, 'its room read back');
  }
  assert.equal(new Set(halls.map((h) => wdunRoomKey(h.key))).size, halls.length, 'a room a hall');
  asked = 0;
  const giants = wildGiantsAt(m, free, 1.78e12);
  assert.equal(giants.length, WILD_GIANT_COUNT);
  for (const g of giants) assert.equal(wildRingAt(g.x, g.y, m), wildGiantRing(g.g), `giant ${g.g} in its tier`);
  assert.ok(asked < 1500, `the giants asked the ground ${asked} times - never every cell`);
});

test('WW-C2 THE HALLS\' GROUND IS THE CONTINENT\'S: a client streaming the Bay alone (its maps the Bay\'s, its woods clamped) stands Cyrodiil\'s halls - the province\'s climate and the authored heights - never on a place or beside one; a hall stood in the index on the halls\' lane, its region Cyrodiil (mutants: the maps\' climate read past the Bay; the woods unground; the places unread; the lane the spawns\')', () => {
  const m = cyrodiilMask();
  const places = new Set();
  const index = new Map();
  index.set('500,250', { name: 'Old Keep', hasDungeon: true, dungeon: { blocks: [{}] }, exterior: { exteriorData: { width: 1, height: 1 } }, mapTableData: { mapId: 1234, locationType: 7, dungeonType: 0 }, regionIndex: 17 });
  let moved = 0;
  const bayMaps = { getClimateIndex: () => CLIMATES.Ocean, getRegionIndexAt: () => 0, getPoliticIndex: () => 128 };   // past the Bay: the sea's clamp
  const zh = createZoneHalls({ maps: bayMaps, woods: new BayWoods(), places: { at: (x, y) => (places.has(`${x},${y}`) ? { x, y } : null) }, locationIndex: index, isMainStory: () => false, dayNow: () => 20500, indexMoved: () => { moved++; } });
  const halls = zh.activeOf(m);
  assert.deepEqual([1, 2, 3, 4].map((r) => halls.filter((h) => h.ring === r).length), [...WILD_DUNGEONS_PER_RING], 'the province\'s ground, not the Bay\'s clamp');
  const h = halls[0];
  assert.equal(zh.free(h.x, h.y), true);
  places.add(`${h.x + 1},${h.y}`);
  assert.equal(zh.free(h.x, h.y), false, 'beside a place: never');
  places.clear();
  assert.equal(zh.activeOf(m), halls, 'kept for the day');
  const loc = zh.standOf(m, h.x, h.y);
  assert.ok(loc, 'stood');
  assert.equal(loc.mapTableData.mapId, spawnedHallMapId(h.x, h.y), 'on the halls\' lane');
  assert.equal(loc.regionIndex, CYRODIIL_REGION, 'its region Cyrodiil\'s, whatever the Bay\'s maps say');
  assert.equal(loc.politic, 128 + CYRODIIL_REGION);
  assert.deepEqual(loc.wildHall, { ring: h.ring, key: h.key });
  assert.equal(loc.name, `Elite Old Keep (${h.x},${h.y})`);
  assert.ok(index.get(h.key) === loc && zh.keys.has(h.key) && moved === 1, 'in the index, its key kept, the index moved');
  assert.equal(zh.standOf(m, h.x, h.y), loc, 'stood once a day');
  assert.equal(zh.standOf(m, h.x + 7, h.y + 7), null, 'no hall, nothing stood');
  // the pixel the hall's dungeon stands at reads back as its own (formats/mapsFile.js longitudeLatitudeToMapPixel's law)
  assert.deepEqual([Math.trunc(loc.mapTableData.longitude / 128), 499 - Math.trunc(loc.mapTableData.latitude / 128)], [h.x, h.y]);
});

test('WW-C2 THE PIXEL PAST THE BAY: a world point\'s map pixel is FLOORED - DFU\'s truncation on the Bay, the pixel it stands in past its west and south edges; every copy of the law alike (mutants: one copy truncated)', () => {
  const N = 32768;
  for (const [px, py] of [[0, 0], [999, 499], [2400, 900], [-300, 1200], [1500, 600]]) {
    const c = mapPixelToWorldCoords(px, py);
    for (const [fx, fz] of [[0.5, 0.5], [0.01, 0.99], [0.99, 0.01]]) {
      const x = c.x + fx * N, z = c.z + fz * N;
      assert.deepEqual(worldCoordToMapPixel(x, z), { x: px, y: py }, `${px},${py} at (${fx}, ${fz})`);
      assert.deepEqual(fileWorldToPixel(x, z), { x: px, y: py });
      assert.deepEqual(mapPixelOfWire(x / N * PIXEL_UNITS, z / N * PIXEL_UNITS), [px, py]);
      assert.deepEqual(sitePixelOfNative(x / N * PIXEL_UNITS, z / N * PIXEL_UNITS), [px, py]);
      assert.equal(cellRoomOfWire(x / N * PIXEL_UNITS, z / N * PIXEL_UNITS), worldRoom(px, py));
    }
  }
  assert.deepEqual(worldCoordToMapPixel(-1, -1), { x: -1, y: 500 }, 'a hair past the corner is the pixel past it');
  assert.deepEqual(worldCoordToMapPixel(1, 1), { x: 0, y: 499 }, 'on the Bay, DFU\'s own');
});

test('WW-C2 THE MAPS: the zone\'s ink and its views are on the world - the fog\'s and the rings\' canvases at the grid\'s corner, the zone map\'s view and limits round its world box; a hall\'s summary carries its own pixel (mutants: the ink on the grid\'s numbers; the summary\'s pixel off its id)', () => {
  const m = cyrodiilMask();
  const wb = /** @type {any} */ (maskWorldBox(m));
  const fog = /** @type {any} */ (fogPixels(m));
  const [bx, by] = maskWorld(m, m.box.x0, m.box.y0);
  assert.deepEqual([fog.x0, fog.y0], [bx, by]);
  assert.equal(fog.w, (m.box.x1 - m.box.x0 + 1) * fog.res, 'a few canvas pixels a cell');
  assert.ok(fog.w * fog.h < 4_000_000, 'a province\'s canvas held small');
  const rings = /** @type {any} */ (ringPixels(m));
  assert.deepEqual([rings.x0, rings.y0], [bx, by]);
  const view = /** @type {any} */ (zoneMapView(m, { paperW: 1200, paperH: 800 }));
  const cx = view.ox + (1200 - 300) / (2 * view.scale), cy = view.oy + 800 / (2 * view.scale);
  assert.ok(Math.abs(cx - (wb.x0 + wb.x1 + 1) / 2) < 1 && Math.abs(cy - (wb.y0 + wb.y1 + 1) / 2) < 1, 'the view centred on the zone\'s world box');
  const lim = /** @type {any} */ (zoneMapLimits(m, { paperW: 1200, paperH: 800 }));
  assert.ok(lim.pan.x0 < wb.x0 && lim.pan.x1 > wb.x1 && lim.pan.y0 < wb.y0 && lim.pan.y1 > wb.y1, 'the pan round the world box');
  assert.deepEqual(summaryPixel({ id: spawnedHallMapId(2400, 900), pixel: { x: 2400, y: 900 } }), { x: 2400, y: 900 }, 'a hall\'s own pixel');
  assert.deepEqual(summaryPixel({ id: 250 * 1000 + 500 }), { x: 500, y: 250 }, 'a Bay place\'s off its id, as ever');
  // the held map paints the zone over the continent, and the zone map always on it
  const held = rd('src/ui/heldMap.js');
  // PIN MOVED (ZONE-NAMES-OVER): over the continent's land and under its names (its `under`), else after it
  assert.match(held, /part: 'over', under: paintZone, nameless: zoneMask \? \(c\) => wildInside\(zoneMask, c\.x, c\.y\) : null \}\);\n\s+if \(!zoneDone\) paintZone\(\);/, 'the zone over the continent\'s ink');
  assert.match(rd('src/ui/tamrielInk.js'), /stroke\(ink\.borders, 1\.4, PEN\.region, \[4, 3\]\);\n(?:\s+\/\/[^\n]*\n)*\s+opts\.under\?\.\(\);/, 'over the land, the roads and the borders');
  assert.match(held, /const continentOn = this\._tamriel \|\| this\._zoneMap;/);   // PIN MOVED (ZOOM-FAST)
  assert.doesNotMatch(rd('src/ui/travel/travelMapWindow.js'), /_drawWildPage|_drawWildOverview|wildPictureZone/, 'the classic map\'s zone layer retired');
});

test('WW-C2 NO WORLD EVENT IN THE ZONE, AND THE WIRE: a theatre\'s gate never opens in Cyrodiil\'s areas; a hall\'s word only to a relay that reads a world pixel\'s key (mutants: Cyrodiil\'s areas open; the old relay asked)', () => {
  const area = (px, py) => { const [cx, cy] = districtOf(px, py); return areaOfDistrict(theatreAt(px, py), cx, cy); };
  const scan = { byArea: new Map([[area(2400, 900), new Int32Array(GATE_REGION_MIN_PIXELS)], [area(2000, -200), new Int32Array(GATE_REGION_MIN_PIXELS)]]) };
  assert.equal(theatreAt(2000, -200), 3, 'Skyrim\'s');
  assert.deepEqual(theatreGateAreas(/** @type {any} */ (scan)), [area(2000, -200)], 'Skyrim\'s area, never Cyrodiil\'s');
  assert.equal(WDUN_WORLD_RELAY_MIN, WORLD_WIDE_RELAY_MIN);   // PIN MOVED (AUDIT TESA II Z2): 256 (world255 on its branch), then 260 at the merge with main - one number now, the world-wide relay's
  assert.ok(relaySupportsWdunWorld(RELAY_VERSION) && relaySupportsWdunWorld(`world${WORLD_WIDE_RELAY_MIN}`) && !relaySupportsWdunWorld(`world${WORLD_WIDE_RELAY_MIN - 1}`), 'the relay before the world-wide one reads no hall of Cyrodiil\'s');
  const online = rd('src/net/online.js');
  assert.match(online, /if \(w\.h && !seaVaultCell\(w\.h\) && !this\.wdunWorldOk\) return false;/, 'a hall\'s key to an older hub: never sent');
  assert.match(online, /this\.wdunWorldOk = relaySupportsWdunWorld\(relayV\);/);
  assert.equal(wdunHall('8192,0'), null, 'past the world\'s grid: no hall');
});

test('WW-C2 THE HOST: the zone\'s mask is Cyrodiil\'s wherever the mountains\' was read; the frame stands the zone by its ring alone; the halls are scenes/zoneHallsHost.js\'s, built above the pixel builder; a hall\'s summary its own pixel (mutants: the region test kept; the module unwired)', () => {
  const w = rd('src/scenes/world.js');
  assert.doesNotMatch(hostText('src/scenes/world.js'), /wildMaskOf|wildHallFree|wildHallStandOf|isWildRegion\(_questRegionIndex/, 'the mountains\' readers gone');   // PIN MOVED (AUDIT TESA II K6): the host whole
  assert.match(w, /setWildMask\(cyrodiilMask\(\)\);/);
  assert.match(w, /const wildMapMask = \(\) => \(_onlineWorldSession\(\) \? cyrodiilMask\(\) : null\);/);
  assert.match(w, /const here = seaRing > 0 \|\| \(_onlineWorldSession\(\) && !!online\?\.wildOk && playerSpawned && \(\(\) => \{ const px = playerTravelPixel\(\); return !!px && wildRingAt\(px\.x, px\.y\) > 0; \}\)\(\)\);/);
  assert.ok(w.indexOf('const zoneHalls = createZoneHalls(') < w.indexOf('const spawnedDungeonAt = (px, py) => {'), 'built above the builder (BOOT-TDZ2)');
  assert.match(w, /id: spawnedHallMapId\(h\.x, h\.y\), pixel: \{ x: h\.x, y: h\.y \},/);
  assert.match(rd('src/scenes/zoneHallsHost.js'), /const land = woods\?\.isTamrielGround \? woods : groundWoods\(woods\);[^\n]*\n\s*const ground = createSpawnGround\(land\);/);
});
