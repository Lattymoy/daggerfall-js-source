// FIELD BUGS 2026-10-14 (INLAND-PORTS) - a player, in the bug-reports channel, "Shipyard & light house near pond": the
// travel map at Ilessan Hills (the Charter of Ilessan Hills - the region's capital, in its hills) and a night scene of the
// town's lighthouse and shipyard standing beside a small pond.
//
// The shipyard law (systems/portPlaces.js isPortTown) stood the port's places in every town that is a port BY ITS DATA
// (portTownByData: Travel Options' harbours or Daggerfall's PortTownAndUnknown byte) - and the data is no coast. The byte's
// 0x10 is the region capitals' mark, and Hazelnut's table copied the byte's list: Ilessan Hills has no water within eight
// map pixels, so world/portSites.js seaField found no sea either way and stood both at the town's middle - beside a pond
// in its own blocks. Its low four bits name the sides water lies on, a lake's or a one-pixel pond's as the sea's.
//
// Now a port town is a port by its data THAT THE OPEN SEA BEARS ON (world/portSites.js portTownOnSea): a pixel of the
// map's water that reaches the map's border (openSeaOf - Deep Waters' own flood of the sea) within SEA_RING of the
// town's, the ring the shipyard reads its bearing off. The harbour board's ports are the same towns (world.js
// navalPortList asks seaBears too), and the bearing is read off the open sea.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { openSeaOf, seaBears, portTownOnSea, seaBearing, seaField, townSeaOf, SEA_RING } from '../../../src/world/portSites.js';
import { isPortTown, isPortTownType, portTownByData } from '../../../src/systems/portPlaces.js';
import { PORT_LOCATION_IDS, hasPort } from '../../../src/systems/travel/travelPorts.js';
import { MapsFile, LOCATION_TYPES, getPixelFromPixelID, mapPixelToLongitudeLatitude, longitudeLatitudeToMapPixel } from '../../../src/formats/mapsFile.js';
import { WoodsFile } from '../../../src/formats/woodsFile.js';
import { hostText } from '../../hostText.mjs';
import { BlocksFile } from '../../../src/formats/blocksFile.js';
import { buildMapDict } from '../../../src/systems/map/mapDirectory.js';
import { isWaterPixel } from '../../../src/ui/overworldModel.js';
import { crownOf } from '../../../src/systems/naval/navalShips.js';
import { boardFor, deliveryPort, SITE_PX } from '../../../src/systems/naval/harbourBoard.js';
import { chartSite } from '../../../src/systems/naval/treasureCharts.js';
import { layoutLocation } from '../../../src/world/locationLayout.js';
import { NAV_CELLS_PER_BLOCK, tileWeight } from '../../../src/world/city/cityNavigation.js';

const W = hostText('src/scenes/world.js');   // the world host whole - its pixel build stands in src/scenes/pixelBuild.js (HOST-SPLIT 2)

/** A raster's water as the one water law answers it: `rows` of '~' (water) and '.' (land), y down. */
const raster = (rows) => (x, y) => rows[y]?.[x] === '~';
/** A mask's pixels, `x,y`. */
const pixelsOf = (mask, width) => [...mask].flatMap((v, i) => (v ? [`${i % width},${(i - (i % width)) / width}`] : []));

test('INLAND-PORTS THE OPEN SEA: the one water law\'s pixels flooded eight-way from the map\'s border - a channel in from any edge, round a corner, is the sea; a lake and a pond the map draws inland are not (mutants: four-way, every water pixel a seed, the far edges unseeded)', () => {
  const rows = [
    '~.........~.',   // the sea at the west edge, an inlet at the north edge
    '~...........',
    '~.......~~..',   // a lake of three, inland
    '~~~.....~...',
    '...~........',   // the channel turns a corner: (2,3) to (3,4), a diagonal
    '....~.......',
    '......~.....',   // a pond of one
    '..........~.',   // an inlet at the south edge
  ];
  const mask = openSeaOf(raster(rows), 12, 8);
  assert.equal(mask.length, 12 * 8);
  assert.deepEqual(pixelsOf(mask, 12).sort(), ['0,0', '10,0', '0,1', '0,2', '0,3', '1,3', '2,3', '3,4', '4,5', '10,7'].sort());
  // the same map, its sea's only way out at the east edge
  const east = openSeaOf(raster(['....', '.~~~', '....']), 4, 3);
  assert.deepEqual(pixelsOf(east, 4), ['1,1', '2,1', '3,1']);
  assert.deepEqual([...openSeaOf(() => true, 0, 5)], [], 'no map, no sea');
});

test('INLAND-PORTS THE SEA BEARS: a pixel of the sea within SEA_RING (2) of the town\'s - the ring its bearing is read off, its own pixel too; three off is none, and no sea law is none (mutants: the ring a pixel short or long)', () => {
  assert.equal(SEA_RING, 2);
  const at = (sx, sy) => (x, y) => x === sx && y === sy;
  assert.equal(seaBears(50, 50, at(52, 50)), true, 'two east');
  assert.equal(seaBears(50, 50, at(48, 48)), true, 'two north-west, the ring\'s corner');
  assert.equal(seaBears(50, 50, at(50, 50)), true, 'its own pixel');
  assert.equal(seaBears(50, 50, at(53, 50)), false, 'three east');
  assert.equal(seaBears(50, 50, at(50, 47)), false, 'three north');
  assert.equal(seaBears(50, 50, null), false);
  // a bearing stands wherever the sea bears: the ring the places are set by is this one
  for (const [x, y] of [[52, 50], [48, 48], [51, 49]]) assert.notDeepEqual(seaBearing(50, 50, at(x, y)), [0, 0]);
});

/** A location as MapsFile mints one (getLocation: the region's map table row, the exterior's data), standing at a pixel. */
const place = ({ px, py, type = LOCATION_TYPES.TownCity, byte = 0, mapId = 1 }) => {
  const ll = mapPixelToLongitudeLatitude(px, py);
  return { name: 'X', mapTableData: { mapId, locationType: type, longitude: ll.x, latitude: ll.y }, exterior: { exteriorData: { portTownAndUnknown: byte } } };
};

test('INLAND-PORTS THE TOWNS (the report): a city the byte\'s 0x10 marks, on Travel Options\' table, with a pond beside it and no open sea within two is NO port town - though its data says so; two pixels off the open sea (Daggerfall\'s, Sentinel\'s and Wayrest\'s) it is; a village whose byte names a lake\'s side is none; a tomb on the sea none (mutants: the sea not asked, the data not asked, any water the sea)', () => {
  // the Bay's corner of a map: the sea along the west edge (x 0..1), a lake at (20,10) beside the village at (21,10), a
  // pond at (31,10) beside the capital at (30,10)
  const rows = Array.from({ length: 20 }, (_, y) => Array.from({ length: 40 }, (_, x) => (x <= 1 || (y === 10 && (x === 20 || x === 31)) ? '~' : '.')).join(''));
  const isWater = raster(rows);
  const mask = openSeaOf(isWater, 40, 20);
  const sea = (x, y) => x >= 0 && y >= 0 && x < 40 && y < 20 && mask[y * 40 + x] === 1;
  const table = (id) => id === 7;   // Travel Options' harbours: the capital's map id alone
  const capital = place({ px: 30, py: 10, byte: 0x10, mapId: 7 });
  assert.equal(portTownByData(capital, table), true, 'its data calls it a port - the table and the byte');
  assert.equal(seaBears(30, 10, isWater), true, 'the pond beside it is water by the one law');
  assert.equal(portTownOnSea(capital, table, sea), false, 'no open sea within two: no port');
  assert.equal(isPortTown(capital, portTownOnSea(capital, table, sea)), false, 'no shipyard, no lighthouse');
  const crown = place({ px: 3, py: 5, byte: 0x10 });
  assert.equal(portTownOnSea(crown, () => false, sea), true, 'the sea two pixels off: a port (the crowns\' capitals)');
  assert.equal(portTownOnSea(place({ px: 4, py: 5, byte: 0x10 }), () => false, sea), false, 'three off: none');
  const village = place({ px: 21, py: 10, type: LOCATION_TYPES.TownVillage, byte: 4 });   // the west side's water - the lake's
  assert.equal(portTownOnSea(village, () => false, sea), false, 'a lake inland is no sea');
  const hamlet = place({ px: 2, py: 12, type: LOCATION_TYPES.TownHamlet, byte: 4 });
  assert.equal(isPortTown(hamlet, portTownOnSea(hamlet, () => false, sea)), true, 'a hamlet on the sea\'s shore');
  const tomb = place({ px: 2, py: 14, type: LOCATION_TYPES.DungeonLabyrinth, byte: 1 });
  assert.equal(isPortTown(tomb, portTownOnSea(tomb, () => false, sea)), false, 'a tomb on the sea stands none');
  assert.equal(portTownOnSea(place({ px: 2, py: 12, byte: 0 }), () => false, sea), false, 'on the sea, no port by its data: none');
  assert.equal(portTownOnSea(hamlet, () => false, null), false, 'no sea law, no port');
  assert.equal(portTownOnSea(null, () => true, sea), false);
});

/** The host's open sea, lifted off world.js and run over a map of the test's (`isWater`) and the ether's switch. */
function hostOpenSea({ isWater, width, height, ether = false, inEther = () => false, tamriel = false }) {
  const m = /\n {2}(let _openSea = null;\n {2}const openSea = \(x, y\) => \{\n[\s\S]*?\n {2}\};)\n/.exec(W);
  assert.ok(m, 'the host\'s open sea moved');
  let asked = 0;
  const seaPixel = (x, y) => { asked++; return isWater(x, y); };
  // eslint-disable-next-line no-new-func
  const openSea = new Function('etherSea', 'inEther', 'seaPixel', 'MAP_WIDTH', 'MAP_HEIGHT', 'openSeaOf', 'tamrielLand', `${m[1]}\nreturn openSea;`)(ether, inEther, seaPixel, width, height, openSeaOf, tamriel);
  return { openSea, asked: () => asked };
}

test('INLAND-PORTS THE HOST\'S OPEN SEA, run: a pixel of the Bay\'s map is the flood\'s - flooded once, the first time it is asked; past the Veil the Eltheric Ocean\'s own water round its isles; past the map\'s edge the continent\'s sea only where the land beyond the Bay stands (AUDIT CAPTAIN\'S SEA B10), else none (mutants: the ether\'s arm dropped, the map\'s bounds unasked, B10\'s edge dropped)', () => {
  const rows = ['~.....', '~..~..', '~.....'];
  const { openSea, asked } = hostOpenSea({ isWater: raster(rows), width: 6, height: 3 });
  assert.equal(asked(), 0, 'nothing flooded before a town asks');
  assert.equal(openSea(0, 1), true, 'the sea at the edge');
  assert.equal(openSea(3, 1), false, 'a pond inland');
  assert.equal(asked(), 18, 'the map flooded once');
  assert.equal(openSea(0, 2), true);
  assert.equal(asked(), 18, 'and never again');
  assert.equal(openSea(-1, 1), false, 'off the map');
  assert.equal(openSea(6, 1), false);
  // the ether's box past the map's north: its water is the open ocean round its isles
  const ether = hostOpenSea({ isWater: (x, y) => (y < 0 ? !(x === 10 && y === -50) : raster(rows)(x, y)), width: 6, height: 3, ether: true, inEther: (x, y) => y < 0 });
  assert.equal(ether.openSea(11, -50), true, 'the Eltheric Ocean beside an isle');
  assert.equal(ether.openSea(10, -50), false, 'the isle\'s land');
  assert.equal(ether.asked(), 2, 'no flood for the ether');
  assert.equal(hostOpenSea({ isWater: () => true, width: 6, height: 3, ether: false, inEther: () => true }).openSea(1, -5), false, 'the switch off: no ether, off the map');
  // B10: past the map's edge, the continent's water where the land beyond the Bay stands - and nothing else there
  const beyond = (x, y) => (x < 0 ? y !== 1 : raster(rows)(x, y));   // west of the map: the sea, a headland at row 1
  const tam = hostOpenSea({ isWater: beyond, width: 6, height: 3, tamriel: true });
  assert.deepEqual([tam.openSea(-3, 0), tam.openSea(-3, 1), tam.openSea(3, 1)], [true, false, false], 'the continent\'s sea, its land, and the Bay\'s pond still none');
  assert.equal(hostOpenSea({ isWater: beyond, width: 6, height: 3 }).openSea(-3, 0), false, 'the land beyond the Bay off: nothing streams past the edge');
});

/** The host's port list (the harbour board's), lifted off world.js and run over a map directory and an open sea of the
 *  test's (test/systems/naval/fb1013c_porttowns.test.js's own lift, the sea handed). */
function hostPortList({ dict, maps, openSea }) {
  const list = /\n {2}(let _navalPortList = null;\n {2}const navalPortList = \(\) => \{\n[\s\S]*?\n {2}\};)\n/.exec(W);
  assert.ok(list, 'the host\'s port list moved');
  // eslint-disable-next-line no-new-func
  return new Function('mapDict', 'maps', 'PORT_LOCATION_IDS', 'isPortTownType', 'getPixelFromPixelID', 'navalCrownOf', 'navalCapitals', 'seaBears', 'openSea',
    `${list[1]}\nreturn navalPortList;`)(dict, maps, PORT_LOCATION_IDS, isPortTownType, getPixelFromPixelID, crownOf, () => [], seaBears, openSea)();
}

test('INLAND-PORTS THE HOST: the pixel\'s build and the town\'s places ask portOnSea (a port by its data on the open sea), the bearing is read off the open sea, the open sea stands above the stream; the harbour board\'s ports, run, are the towns the open sea bears on - no board in a capital in the hills or by a lake (mutants: the board\'s sea unasked, the host asking the data alone, the bearing off any water)', () => {
  assert.match(W, /\n {2}const portOnSea = \(dfLocation\) => portTownOnSea\(dfLocation, hasPort, openSea\);\n/);
  assert.equal((W.match(/isPortTown\(dfLocation, portOnSea\(dfLocation\)\)/g) ?? []).length, 2, 'the pixel\'s build and townPlacesFor');
  assert.doesNotMatch(W, /isPortTown\(dfLocation, portTownByData\(|portByData/, 'nothing asks the data alone');
  assert.match(W, /const bearing = seaBearing\(lp\.x, lp\.y, openSea\);/);
  assert.match(W, /\n {4}_openSea \?\?= openSeaOf\(seaPixel, MAP_WIDTH, MAP_HEIGHT\);\n/);
  // BOOT-TDZ: declared above the stream, as seaPixel is - the boot's first build reads it
  const decl = W.indexOf('\n  const openSea = (x, y) => {'), places = W.indexOf('\n  function townPlacesFor(');
  assert.ok(decl > W.indexOf('\n  const seaPixel = (x, y) =>') && decl < places, 'beside seaPixel, before the towns\' places');
  // the board: three of Travel Options' harbours - a capital, a village by a lake, a hamlet on the sea's shore
  const ids = [...new Set(PORT_LOCATION_IDS)].slice(0, 3);
  const px = ids.map((id) => getPixelFromPixelID(id));
  const names = ['Ilessan Hills', 'Lakeside', 'Shore'];
  const dict = new Map(ids.map((id, i) => [id, { id, mapID: id, regionIndex: 0, mapIndex: i, locationType: [LOCATION_TYPES.TownCity, LOCATION_TYPES.TownVillage, LOCATION_TYPES.TownHamlet][i] }]));
  const maps = { getRegion: () => ({ mapNames: names }) };
  // the sea: the map's west edge and a channel along the shore town's row to the pixel beside it; a pond by the village
  const isWater = (x, y) => x === 0 || (y === px[2].y && x < px[2].x) || (x === px[1].x + 1 && y === px[1].y);
  const mask = openSeaOf(isWater, 1000, 500);
  const openSea = (x, y) => x >= 0 && y >= 0 && x < 1000 && y < 500 && mask[y * 1000 + x] === 1;
  assert.equal(openSea(px[1].x + 1, px[1].y), false, 'the village\'s pond is no sea');
  assert.deepEqual(hostPortList({ dict, maps, openSea }).map((p) => p.name), ['Shore']);
  assert.deepEqual(hostPortList({ dict, maps, openSea: () => true }).map((p) => p.name), names, 'the sea all round: every town');
});

/** The harbour office's `seaAt` as the host hands it (world.js's office deps), over the host's open sea and a one water
 *  law of the test's (`isWater`) - lifted and run. */
function hostSeaAt({ isWater, width, height }) {
  const m = /\n {4}seaAt: (.+?), {3}\/\//.exec(W);
  assert.ok(m, 'the harbour office\'s seaAt moved');
  const { openSea } = hostOpenSea({ isWater, width, height });
  // eslint-disable-next-line no-new-func
  return new Function('openSea', 'seaPixel', 'tamrielLand', 'MAP_WIDTH', 'MAP_HEIGHT', `return (${m[1]});`)(openSea, isWater, false, width, height);
}

test('INLAND-PORTS SEAAT (Mac, 2026-10-15: "Fix harbour seaAt too"): the harbour office\'s sea is the open sea - 300 days of a board\'s bounties and salvages, and the treasure charts off its port, never sited on a lake inland that lies within their reach, though the lake holds open water all round; a port beside a lake takes no cargo (mutant: seaAt the one water law again)', () => {
  // the sea down the map's west edge (x 12 and under); a lake of five by five inland, its middle seven pixels east of the port
  const W2 = 60, H2 = 40;
  const lake = (x, y) => x >= 19 && x <= 23 && y >= 18 && y <= 22;
  const isWater = (x, y) => x >= 0 && y >= 0 && x < W2 && y < H2 && (x <= 12 || lake(x, y));
  const seaAt = hostSeaAt({ isWater, width: W2, height: H2 });
  const HOME = { key: '14,20', name: 'Home', px: 14, py: 20, region: 17, crown: 'Daggerfall' };
  assert.ok(SITE_PX.near <= 6 && SITE_PX.far >= 8, 'the lake\'s open middle lies within a site\'s reach');
  assert.deepEqual([seaAt(21, 20), seaAt(2, 20), seaAt(-1, 20)], [false, true, false], 'the lake no sea, the edge\'s sea, nothing past the map');
  let sited = 0, west = 0;
  for (let day = 0; day < 300; day++) {
    for (const o of boardFor({ port: HOME, crown: 'Daggerfall', day, level: 5, ports: [HOME], seaAt })) {
      if (!o.target) continue;
      sited++;
      assert.equal(lake(o.target.px, o.target.py), false, `${o.kind} on day ${day} sited on the lake (${o.target.px}, ${o.target.py})`);
      if (o.target.px <= 12) west++;
    }
  }
  assert.ok(sited > 20 && west === sited, `every site on the open sea (${west} of ${sited})`);
  for (let seed = 0; seed < 200; seed++) {
    const c = chartSite(seed, [HOME], seaAt);
    assert.ok(c && !lake(c.px, c.py), `a chart's cache on the lake (seed ${seed})`);
  }
  assert.equal(deliveryPort({ px: 24, py: 20 }, seaAt), false, 'a port by the lake: no cargo goes there');
  assert.equal(deliveryPort({ px: 13, py: 20 }, seaAt), true);
});

// ─── THE REAL MAP ────────────────────────────────────────────────────────────────────────────────────────────────────

const ARENA2 = process.env.ARENA2_PATH;
const HAS_ARENA2 = !!ARENA2 && existsSync(ARENA2);

/** The 49 towns the open sea does not bear on, by region: 36 of the 39 region capitals the byte's 0x10 marks, and 13 by a
 *  lake or a pond inland, or more than two pixels off the sea. */
const LOST = Object.freeze([
  'Abibon-gora', 'Alcaire', 'Alik\'ra', 'Anticlere', 'Antyphyllos', 'Ayasofya', 'Bergama', 'Bhoriane', 'Blackhead', 'Cathlech',
  'Daenia', 'Dragontail', 'Dwynnen', 'Ephesus', 'Gavaudon', 'Glenpoint', 'Glenumbra', 'Ilessan Hills', 'Isfeho', 'Kairou',
  'Kaluhbia', 'Kambria', 'Koegria', 'Kozanset', 'Lainlyn', 'Menevia', 'Mogahanu', 'Morascubia', 'Mournoth', 'Myrkwasa',
  'Northmoor', 'Phrygias', 'Pothago', 'Santaki', 'Satakalaam', 'Shalgora', 'Singbrugh', 'Tigonus', 'Totambu', 'Tulune',
  'Tuncart', 'Urvaius', 'Warvale', 'Whitebrone Hall', 'Whitefort', 'Whitewych Commons', 'Wrothgaria', 'Ykalon', 'Zagyry-Thar',
]);

test('INLAND-PORTS (ARENA2): on the real map - the open sea one body of 179,926 pixels, the 81 lakes and ponds inland none of it; of the 155 towns that are ports by their data, 106 have the open sea within two and stand the port\'s places, the 49 others named - 36 capitals the byte\'s 0x10 marks, Ilessan Hills among them, whose places stood at its middle beside its own ponds; Daggerfall, Sentinel and Wayrest kept; no kept town\'s bearing moves', { skip: !HAS_ARENA2 && 'ARENA2_PATH not set' }, () => {
  const maps = new MapsFile();
  assert.equal(maps.load(new Uint8Array(readFileSync(join(ARENA2, 'MAPS.BSA'))), new Uint8Array(readFileSync(join(ARENA2, 'CLIMATE.PAK'))), new Uint8Array(readFileSync(join(ARENA2, 'POLITIC.PAK')))), true);
  maps.autoDiscard = false;
  const woods = new WoodsFile();
  assert.equal(woods.load(new Uint8Array(readFileSync(join(ARENA2, 'WOODS.WLD')))), true);
  const dict = buildMapDict(maps);
  const seaPixel = (x, y) => isWaterPixel(maps.getClimateIndex(x, y), woods.getHeightMapValue(x, y));   // the world's one water law
  const mask = openSeaOf(seaPixel, 1000, 500);
  const openSea = (x, y) => x >= 0 && y >= 0 && x < 1000 && y < 500 && mask[y * 1000 + x] === 1;
  assert.equal(mask.reduce((n, v) => n + v, 0), 179926, 'the open sea');
  // the water left out, in its bodies (eight-way, as the flood)
  const seen = new Uint8Array(1000 * 500);
  let lakes = 0, largest = 0;
  for (let i = 0; i < seen.length; i++) {
    if (seen[i] || mask[i] || !seaPixel(i % 1000, (i - (i % 1000)) / 1000)) continue;
    lakes++;
    let n = 0;
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const c = /** @type {number} */ (stack.pop()), cx = c % 1000, cy = (c - cx) / 1000;
      n++;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = cx + dx, y = cy + dy, k = y * 1000 + x;
        if (x >= 0 && y >= 0 && x < 1000 && y < 500 && !seen[k] && seaPixel(x, y)) { seen[k] = 1; stack.push(k); }
      }
    }
    largest = Math.max(largest, n);
  }
  assert.deepEqual([lakes, largest], [81, 54], 'the lakes and ponds inland');

  const byData = [], kept = [], lost = [];
  for (const s of dict.values()) {
    const loc = maps.getLocation(s.regionIndex, s.mapIndex);
    if (!isPortTown(loc, portTownByData(loc, hasPort))) continue;
    byData.push(loc);
    (isPortTown(loc, portTownOnSea(loc, hasPort, openSea)) ? kept : lost).push(loc);
  }
  assert.deepEqual([byData.length, kept.length, lost.length], [155, 106, 49]);
  assert.deepEqual(lost.map((l) => l.name).sort(), [...LOST].sort());
  const capitals = byData.filter((l) => l.exterior.exteriorData.portTownAndUnknown === 0x10);
  assert.deepEqual([capitals.length, capitals.filter((l) => lost.includes(l)).length], [39, 36], 'the capitals\' mark, 36 of its towns off the open sea');
  assert.deepEqual(capitals.filter((l) => kept.includes(l)).map((l) => l.name).sort(), ['Daggerfall', 'Sentinel', 'Wayrest'], 'the crowns\' capitals two pixels off it');
  for (const l of kept) {
    const p = longitudeLatitudeToMapPixel(l.mapTableData.longitude, l.mapTableData.latitude);
    assert.deepEqual(seaBearing(p.x, p.y, openSea), seaBearing(p.x, p.y, seaPixel), `${l.name}: its shipyard stands where it stood`);
  }

  // THE REPORT'S TOWN: a city of the hills, a port by its data, no water within eight pixels - its places stood at its middle
  const ih = maps.getLocationByName('Ilessan Hills', 'Ilessan Hills');
  const ip = longitudeLatitudeToMapPixel(ih.mapTableData.longitude, ih.mapTableData.latitude);
  assert.deepEqual([ih.mapTableData.locationType, ih.exterior.exteriorData.portTownAndUnknown, hasPort(ih.mapTableData.mapId), portTownByData(ih, hasPort)], [LOCATION_TYPES.TownCity, 0x10, true, true]);
  let near = Infinity;
  for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) if (seaPixel(ip.x + dx, ip.y + dy)) near = Math.min(near, Math.max(Math.abs(dx), Math.abs(dy)));
  assert.equal(near, Infinity, 'no water within eight pixels');
  assert.equal(portTownOnSea(ih, hasPort, openSea), false, 'no port town now');
  const blocks = new BlocksFile();
  assert.equal(blocks.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA')))), true);
  const yl = layoutLocation(ih, maps, blocks, { enhanced: true, windmills: true });
  const bearing = seaBearing(ip.x, ip.y, seaPixel);
  const own = townSeaOf(yl, bearing);
  assert.deepEqual([bearing, own.cells, seaField(own.width, own.height, own, bearing).kind], [[0, 0], 0, 'middle'], 'the old law\'s field: the town\'s middle');
  // its blocks' own ponds - open water cells, none reaching the grid's edge (townSeaOf's water test)
  const N = NAV_CELLS_PER_BLOCK, ponds = new Set();
  for (const b of yl.blocks) {
    const fld = b.dfBlock?.rmbBlock?.fldHeader;
    for (let i = 0; i < N * N; i++) {
      const rec = fld?.groundData?.groundTiles?.[(i % N) >> 2]?.[Math.floor(i / N) >> 2]?.textureRecord;
      if (fld?.autoMapData?.[i] === 0 && Number.isInteger(rec) && tileWeight(rec & 0x3f, { enhancedWater: true }) === 0) ponds.add(b.blockName);
    }
  }
  assert.deepEqual([...ponds].sort(), ['BANKAL01.RMB', 'BOOKAL00.RMB', 'DARKAA02.RMB', 'FIGHAA02.RMB', 'GRVEAL41.RMB', 'MAGEAA05.RMB', 'RESIAL10.RMB', 'THIEAL00.RMB'], 'ponds in eight of its blocks - the Mages Guild\'s beside the market at its middle');
  assert.deepEqual([yl.blocks[24].blockName, yl.blocks[25].blockName], ['MARKAA00.RMB', 'MAGEAA05.RMB'], 'the market the middle of its seven by seven, the Mages Guild east of it');
});
