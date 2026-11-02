// TESA6 (2026-10-12, the owner: "Do it" - the ports; bible/03-World/Arena-Provinces.md TESA6) - THE PORTS PAST THE BAY,
// pinned. A port stands on its own province's shore (world/arenaPlaces.js standArenaPixels) and its clone answers a harbour
// (world/arenaLocations.js); the host's ports past the Bay answer as the Etheric Sea's do. TESA12: a port is a lore city
// TAMRIEL1 sets on the sea (world/tamriel/tamrielGeography.js CITIES' `port`) - A.EXE's coastal list, its unpacker, its print and
// its card went with Arena.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { SHORE_REACH, PIXEL_REACH, pictureSea, standArenaPixels, arenaPixels } from '../src/world/arenaPlaces.js';
import { synthesizeArenaLocation } from '../src/world/arenaLocations.js';
import { setTamrielTrace, tamrielTrace } from '../src/world/tamriel/tamrielLand.js';
import { setTamrielFit, inBay, pictureToBay } from '../src/world/tamriel/tamrielFrame.js';
import { LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { hostText } from './hostText.mjs';   // HOST-SPLIT (at the merge of main): the world host read whole - its pixel build stands in scenes/pixelBuild.js

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
afterEach(() => { setTamrielTrace(null); setTamrielFit(null); });

function rectTrace(rects) {
  const w = 320, h = 200, land = new Uint8Array(w * h), province = new Uint8Array(w * h);
  for (const [id, x0, y0, x1, y1] of rects) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { land[y * w + x] = 1; province[y * w + x] = id; }
  return { w, h, land, province };
}
/** A model's place by hand: Skyrim's (the lane's third), its slot, kind, name and picture point, a port where `port`. */
const at = (id, kind, name, px, py, port = false) => ({ province: 'Skyrim', provinceIndex: 2, id, kind, name, px, py, snapped: 0, ...(port ? { port: true } : {}) });
// Skyrim (the trace's 3) on a block of land from picture (110, 20) to (210, 80); High Rock's beside it east; ten Bay pixels a picture pixel
const setUp = () => {
  setTamrielFit({ ox: 400, oy: 500, ppu: 10 });
  setTamrielTrace(rectTrace([[3, 110, 20, 210, 80], [1, 210, 20, 230, 80]]));
  return { places: [
    at(0, 'city-state', 'Solitude', 130.55, 25.5, true),   // a port 5.5 picture pixels below the north coast, on a pixel's centre line
    at(2, 'city-state', 'Whiterun', 160.5, 50.5),         // inland, no port
    at(5, 'city-state', 'Riften', 180.5, 50.5, true),     // the lore's port, the coast 300 Bay pixels off: none
  ] };
};

test('TESA6 the shore: a port stands on the nearest pixel of its own province\'s land beside the picture\'s sea - straight to the coast - within SHORE_REACH; a place the lore sets on the sea past it, or no port, stands as any and is none; the sea is the picture\'s, never another province\'s land (mutant: the flag read, the sea, the own land, the reach, the lore\'s word kept)', () => {
  assert.deepEqual([SHORE_REACH, PIXEL_REACH], [100, 3]);
  const model = setUp();
  const s = standArenaPixels(model, tamrielTrace());
  const sol = s.stood.find((p) => p.name === 'Solitude');
  assert.equal(sol.port, true);
  const [x, y] = pictureToBay(130.55, 25.5);
  assert.equal(sol.by, -300, 'north to the coast, the land\'s first row (picture 20 is Bay -300)');
  assert.equal(sol.bx, Math.floor(x), 'straight north');
  assert.ok(pictureSea(tamrielTrace(), sol.bx, sol.by - 1) && !pictureSea(tamrielTrace(), sol.bx, sol.by));
  const wr = s.stood.find((p) => p.name === 'Whiterun');
  assert.deepEqual([wr.bx, wr.by, 'port' in wr], [...pictureToBay(160.5, 50.5).map(Math.floor), false], 'no port: under its point');
  const rf = s.stood.find((p) => p.name === 'Riften');
  assert.deepEqual([rf.bx, rf.by, 'port' in rf], [...pictureToBay(180.5, 50.5).map(Math.floor), false], 'the coast past SHORE_REACH: under its point, and the lore\'s word not kept');
  assert.ok(Math.abs(y - sol.by) <= SHORE_REACH);
  // the east edge is High Rock's land, not the sea: a port there goes to Skyrim's own coast, never across
  const e = standArenaPixels({ places: [at(1, 'city-state', 'Eastmarch', 209.5, 25.5, true)] }, tamrielTrace()).stood[0];
  assert.equal(e.port, true);
  assert.ok(e.bx < 1700 && e.by === -300, `onto Skyrim's north coast, not at High Rock's border (${e.bx}, ${e.by})`);
  assert.ok(!inBay(e.bx, e.by));
});

test('TESA6 a pinned port (TESA10b): a lore port pinned on a capital\'s pixel beside the picture\'s sea is a port - Solitude\'s docks; pinned inland it is none, the lore\'s word not kept; a place no lore sets on the sea none wherever it is pinned (mutant: the pin\'s port, the sea\'s ring)', () => {
  setUp();
  const sol = at(0, 'city-state', 'Solitude', 130.55, 25.5, true), wr = at(2, 'city-state', 'Whiterun', 160.5, 50.5);
  const pinAt = (bx, by) => (p) => (p.name === 'Solitude' || p.name === 'Whiterun' ? { px: p.name === 'Solitude' ? bx : bx + 10, py: by } : null);
  const coast = standArenaPixels({ places: [sol, wr] }, tamrielTrace(), pinAt(905, -300));
  assert.deepEqual(coast.stood.map((p) => [p.name, p.pinned, !!p.port, 'port' in p]), [['Solitude', true, true, true], ['Whiterun', true, false, false]]);
  const inland = standArenaPixels({ places: [sol] }, tamrielTrace(), pinAt(905, -200));
  assert.deepEqual(inland.stood.map((p) => [p.name, p.pinned, 'port' in p]), [['Solitude', true, false]]);
});

test('TESA6 the clone: a port answers a harbour (portTownAndUnknown 1) and says so in `arena`; any other place none (mutant: the byte, the flag)', () => {
  const tpl = { name: 'T', regionIndex: 17, regionName: 'R', politic: 145, mapTableData: { mapId: 40, locationType: LOCATION_TYPES.TownCity }, exterior: { exteriorData: { width: 6, height: 7, locationId: 40, mapId: 40, portTownAndUnknown: 0 }, buildings: [] } };
  const place = { province: 'Skyrim', provinceIndex: 2, id: 0, kind: 'city-state', name: 'Solitude', bx: 1049, by: -300 };
  const port = synthesizeArenaLocation(tpl, { ...place, port: true });
  assert.equal(port.exterior.exteriorData.portTownAndUnknown, 1);
  assert.equal(port.arena.port, true);
  const not = synthesizeArenaLocation({ ...tpl, exterior: { ...tpl.exterior, exteriorData: { ...tpl.exterior.exteriorData, portTownAndUnknown: 1 } } }, place);
  assert.equal(not.exterior.exteriorData.portTownAndUnknown, 0, 'never the template\'s');
  assert.equal(not.arena.port, false);
});

test('TESA6 the host: an Arena port past the Bay answers where the Bay\'s ports are asked - Come Sail Away\'s port town, the naval host\'s port (the nearest Bay crown\'s office - BAY-LEFT-SEA, the pixel\'s region), the harbour book\'s town, the nearest port\'s name and way, the waters\' port distance - and a city made a port is cloned again and built again (mutant: an arm, the crown, the clone\'s check, the sweep). PIN MOVED (AUDIT TESA II P7/P5): TESA\'s places are the world\'s registry\'s (world/pastBayRows.js), so past the Bay the port test, the port here, the nearest port and the waters\' distance are WW3\'s over them (world/worldWide/worldPorts.js - its port\'s region the province\'s, WW-R); the harbour book\'s town is still this host\'s', () => {
  const w = hostText('src/scenes/world.js');
  assert.match(w, /const arenaPortAt = \(x, y\) => \{\n\s*if \(!_arenaTemplates \|\| onTheBay\(x, y\)\) return null;\n\s*const q = arenaPlaceOnPixel\(x, y\);\n\s*return q\?\.port \? q : null;\n\s*\};/);
  assert.doesNotMatch(w, /arenaPorts\(\)|arenaPortOf/, 'the host\'s own list past the Bay and its port record gone - the world\'s ports answer');
  assert.match(w, /if \(etherSea && inEther\(x, y\)\) return !!etherPortAt\(x, y\);[^\n]*\n\s+if \(!onTheBay\(x, y\)\) return worldPorts\.at\(x, y\);/, 'Come Sail Away\'s port town (and with it navalNearPort)');
  assert.match(w, /const port = boardPortAt\(navalPortList\(\), p\.x, p\.y\);/, 'the naval host\'s port here - the board\'s list\'s, past the Bay too');
  assert.match(w, /const aq = !isle && !onTheBay\(p\.x, p\.y\) \? arenaPortNear\(p\.x, p\.y\) : null; \/\/ TESA6: an Arena port's town, its harbour sounded as any port's\n\s*const aloc = aq \? capitalLocationAt\(aq\.bx, aq\.by\) \|\| arenaLocationAt\(aq\.bx, aq\.by\) : null; \/\/ AUDIT-TESA A4-F2: a capital's own\n\s*\/\/ AUDIT-TESA A4-F3: its book key the town's own port id, as docksBerthOf reads it - the Docks row and the docks' wait\n\s*\/\/ read the berth back by it \(WW3's law at the merge: worldPorts\.js portIdOfLocation, the world's key past the Bay\)\n\s*if \(aloc\?\.exterior\?\.exteriorData\)\n\s*add\(\{ id: portIdOfLocation\(aloc\), loc: aloc, x: aq\.bx, y: aq\.by, name: aq\.name \}\);/, 'PIN MOVED (AUDIT-TESA A4-F2/F3): the harbour book - a capital\'s own, keyed by its map id');   // PIN MOVED (the fourth merge of main into #1184): one list of the towns near, each once (RPT1026-WORLD FAR-QUAY)
  assert.match(w, /\n\s+return worldPorts\.nearestNamed\(here, worldLanes\.bayPorts\(\) \?\? \[\]\);/, 'the nearest port past the Bay - WW3\'s over both');
  assert.match(w, /d = Math\.min\(d, worldPorts\.nearestPx\(p\.x, p\.y\) \?\? Infinity\);/, 'the waters\' port distance');
  assert.match(w, /had\.arena\.id === place\.id && had\.arena\.port === !!place\.port\) return had;/);
  assert.match(w, /`\$\{place\.provinceIndex\}\|\$\{place\.id\}\|\$\{!!place\.port\}`/);
  assert.match(read('src/world/worldWide/worldPorts.js'), /region: p\.region,\n\s*area: p\.area,\n\s*theatre: p\.theatre,\n\s*crown: crownAt\(p\.px, p\.py\)/, 'a port past the Bay: its province\'s region, the nearest Bay crown\'s office');   // PIN MOVED (BAY-LEFT-SEA, the owner's call taken): a harbourmaster past the Bay keeps the nearest Bay crown's board
});

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL', 'WOODS.WLD'].every((f) => existsSync(join(ARENA2, f)));
test('TESA6 with ARENA2: on the player\'s own trace 28 of the lore\'s 30 ports stand on their shore, each beside the ground\'s sea', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const { DFPalette } = await import('../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../src/ui/tamrielTrace.js');
  const { WoodsFile } = await import('../src/formats/woodsFile.js');
  const { groundWoods } = await import('../src/world/tamriel/tamrielGround.js');
  const { isWaterPixel } = await import('../src/ui/overworldModel.js');   // AUDIT TESA II P11: the ground's own water - WATER_BYTE (5) is SHORE_BYTE too, the coast's land
  const { tamrielClimateAt } = await import('../src/world/tamriel/tamrielGround.js');
  const { plateauDry } = await import('../src/world/spawnedDungeons.js');
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  const woods = new WoodsFile(); woods.load(bytes('WOODS.WLD'));
  const g = groundWoods(woods);
  const { CITIES } = await import('../src/world/tamriel/tamrielGeography.js');
  const ports = arenaPixels().stood.filter((p) => p.port && CITIES.some((c) => c.port && c.name === p.name));   // PIN MOVED (FIELD BUGS 2026-10-28b COAST-PORT): the lore's - the coast's own are fb1028b_seasquare's
  assert.equal(ports.length, 28, 'PIN MOVED (TESA12): the lore\'s ports, not A.EXE\'s 51');
  for (const p of ports) {
    // PIN MOVED (AUDIT TESA II P11): the sea beside it is the ground's WATER (isWaterPixel - the Ocean climate, or a byte at
    // the ocean's floor), never `<= WATER_BYTE`, which the coast's own land at SHORE_BYTE answers too: moved 8 pixels
    // inland, 12 of the 28 still passed that
    assert.ok([[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].some(([dx, dy]) => isWaterPixel(tamrielClimateAt(p.bx + dx, p.by + dy), g.getHeightMapValue(p.bx + dx, p.by + dy))), `${p.name}: the sea beside it`);
    // AUDIT TESA II P8: on a plateau above the beach, every port but a capital's (its pin keeps its pixel)
    if (!p.pinned) assert.ok(plateauDry(g, p.bx, p.by), `${p.name}: above the beach`);
  }
});
