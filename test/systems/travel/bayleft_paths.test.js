// BAY-LEFT-MAPS C10 (2026-10-27, the owner after AUDIT LEFT IN THE BAY: "Every single thing here needs to be addressed. No
// exceptions."; bible/06-Systems/Travel-Options.md BAY-LEFT-MAPS) - TRAVEL OPTIONS' ROADS PAST THE BAY.
//
// Basic Roads' path data is the Bay's 1000 x 500 table (world/road/pathData.js dataPoint), and every read past it
// answered 0: on every road past the Bay Follow Paths said "no path", the junction map was blank (its section skipped
// every pixel off the table, and the host read `y * 1000 + x` - another row past the Bay's edge), and a walk on a road ran
// at the open ground's rate (the host's travellerOnRoad, RATE-LAW: x60, not x100). Past the table a road's and a track's
// byte are the roads past the Bay's own (world/arenaRoads.js arenaRoadByte - ROADS 1's compass, the bits the table
// holds); on the table every byte is the mod's, unchanged. The layer here is the producer's own: a region built by
// world/tamrielRoads.js buildTamrielRegion and installed by setArenaRoads, as the roads' host installs it.
import '../../modsOff.js';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  pathsDataPoint, roadsDataPoint, dataPoint, tablePathsDataPoint, PATH_ROADS, PATH_TRACKS, PATH_RIVERS, PATH_STREAMS,
} from '../../../src/world/road/pathData.js';
import { playerOnPathAt, mapPixelWorldOrigin } from '../../../src/systems/travel/travelPaths.js';
import { setArenaRoads, beyondPixel, beyondKey } from '../../../src/world/arenaRoads.js';
import { regionLattice, regionOf, buildTamrielRegion } from '../../../src/world/tamrielRoads.js';
import { LOCATION_TYPES as T } from '../../../src/formats/mapsFile.js';
import { drawMapSection } from '../../../src/ui/travel/travelPathsOverlay.js';
import { pathFreePixel } from '../../../src/world/spawnedDungeons.js';
import { readTravelOptionsSettings, createTravelOptions } from '../../../src/systems/travel/travelOptions.js';
import { TRAVEL_OPTIONS_TEXT } from '../../../src/systems/travel/travelOptionsText.js';
import { TravelControlUI } from '../../../src/ui/travel/travelControlUI.js';
import { rectOf } from '../../../src/systems/travel/travelAutopilot.js';
import { modSetting } from '../../../src/systems/modSettings.js';
import { setPaceGround, setTravelPace, _resetTravelPace } from '../../../src/systems/travel/travelPace.js';   // PACE-DIALS: the road's x100 is the player's dial
import { hostText } from '../../hostText.mjs';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
afterEach(() => { setArenaRoads(null); _resetTravelPace(); });

/** A region of the roads past the Bay north of the Bay's corner, built as its worker builds it (AUDIT TESA II R8's grid). */
function builtRegion() {
  let s = 9;
  const rnd = () => { s = (s * 1103515245 + 12345) >>> 0; return s / 2 ** 32; };
  const region = regionOf(regionLattice({ x0: 0, y0: -1000, w: 800, h: 300 }), 0, 0);
  const places = [];
  for (let k = 0; k < 120; k++) places.push({ x: region.core.x0 + Math.floor(rnd() * 600), y: region.core.y0 + Math.floor(rnd() * 250), type: [T.TownCity, T.TownHamlet, T.TownVillage, T.Tavern, T.HomeFarms][k % 5] });
  return buildTamrielRegion({ region, places, nodes: [], obstacles: [], gates: [], heightAt: () => 30 });
}
let _built = null;
const built = () => (_built ??= builtRegion());
/** The Bay's table, every byte a road and a track (lane C's probe p9's network), and a river. */
const bayNet = () => {
  const all = new Uint8Array(1000 * 500).fill(0xff);
  return { roads: all, tracks: all, rivers: new Uint8Array(1000 * 500).fill(0x81), streams: null, source: 'basic-roads' };
};
/** A road pixel past the Bay that carries an east-west run: the follow's own fixture. */
const roadPixel = (out) => {
  for (const [key, b] of out.roads) { const [x, y] = beyondPixel(key); if ((b & 32) && (b & 2)) return { x, y, b }; }
  return null;
};

test('BAY-LEFT-MAPS C10 THE TABLE UNCHANGED: on the Bay every byte of every array is the mod\'s own, whatever layer stands past it (mutants: the layer read on the table)', () => {
  const out = built();
  setArenaRoads({ roads: out.roads, tracks: out.tracks, join: new Map([[0, 0xff]]) });
  const net = { roads: new Uint8Array(1000 * 500), tracks: new Uint8Array(1000 * 500), rivers: new Uint8Array(1000 * 500), streams: null };
  for (let i = 0; i < net.roads.length; i += 997) { net.roads[i] = i & 0xff; net.tracks[i] = (i >> 3) & 0xff; net.rivers[i] = (i >> 5) & 0xff; }
  for (let y = 0; y < 500; y += 7) for (let x = 0; x < 1000; x += 13) {
    const i = x + y * 1000;
    assert.deepEqual([PATH_ROADS, PATH_TRACKS, PATH_RIVERS, PATH_STREAMS].map((t) => dataPoint(net, t, x, y)), [net.roads[i], net.tracks[i], net.rivers[i], 0]);
  }
  assert.equal(pathsDataPoint(net, 0, 0), net.roads[0] | net.tracks[0], 'the Bay\'s corner: its own bytes, not the join\'s layer');
});

test('BAY-LEFT-MAPS C10 PAST THE TABLE: a road\'s and a track\'s byte are the roads past the Bay\'s, a river\'s and a stream\'s none, and no layer is no road; the table-only read (the jungle\'s roadside) answers 0 there (mutants: past the table 0 as before; the tracks read as the roads; the rivers read from the layer; the jungle reading the layer)', () => {
  const out = built();
  const net = bayNet();
  const [key] = out.tracks.keys();
  const [tx, ty] = beyondPixel(key);
  assert.equal(pathsDataPoint(net, tx, ty), 0, 'no layer installed: no road past the Bay, as before');
  setArenaRoads({ roads: out.roads, tracks: out.tracks });
  let n = 0;
  for (const [k, b] of out.roads) {
    const [x, y] = beyondPixel(k);
    assert.equal(roadsDataPoint(net, x, y), b);
    assert.equal(pathsDataPoint(net, x, y), b | (out.tracks.get(k) ?? 0));
    assert.equal(dataPoint(net, PATH_RIVERS, x, y), 0);
    assert.equal(tablePathsDataPoint(net, x, y), 0, 'the table alone');
    n++;
  }
  assert.ok(n > 50, `the region's roads (${n})`);
  assert.equal(dataPoint(net, PATH_TRACKS, tx, ty), out.tracks.get(key), 'a track\'s byte its own');
  assert.equal(tablePathsDataPoint(net, 500, 250), pathsDataPoint(net, 500, 250), 'on the table the two agree');
  assert.match(read('src/world/jungle/jungleRoadside.js'), /const bits = net \? tablePathsDataPoint\(net, px, py\) : 0;/, 'the roadside pairs stand on the table\'s straight lanes alone');
});

/** Travel Options with its follow key, standing at a pixel (to1_travelOptions.test.js's rig). */
function rig(pixel, yaw) {
  const net = { roads: new Uint8Array(1000 * 500), tracks: new Uint8Array(1000 * 500), source: 'basic-roads' };
  const o = mapPixelWorldOrigin(pixel.x, pixel.y);
  const state = { pos: { x: o.x + 16384, z: o.z + 16384 }, pixel, yaw };
  const said = [];
  const ui = new TravelControlUI({});
  const settings = readTravelOptionsSettings((vendor, key) => (vendor === 'roads-hazelnut' ? key === 'Enabled' : modSetting(vendor, key)));
  const to = createTravelOptions({
    settings, ui, roads: () => net, worldPos: () => state.pos, mapPixel: () => state.pixel, yaw: () => state.yaw, setFacing: () => {},
    currentLocation: () => null, hasCurrentLocation: () => false, localizedCurrentLocationName: () => '', localizedLocationName: (s) => s?.name ?? '',
    climateIndex: () => 231, entity: () => ({ health: 50, maxHealth: 50, fatigue: 64 * 50, luck: 50, stealth: 50 }), enemiesNearby: () => false,
    diseaseCount: () => 0, say: (l) => said.push(l), messageBox: () => {}, setTimeScale: () => {}, now: () => 0, worldTimeNow: () => 0,
    roll100: () => 100, pushWindow: (w) => w.show(), locationWorldRect: (s) => { const q = mapPixelWorldOrigin(s.pixel.x, s.pixel.y); return rectOf(q.x + 16000, q.z + 16000, 768, 768); },
    locationTileRect: () => null,
  });
  return { to, ui, said, net, state };
}

test('BAY-LEFT-MAPS C10 FOLLOW PATHS PAST THE BAY: on a road past the Bay, facing along it, the follow key begins a leg on the road at the road\'s rate; with no layer it says there is no path, as it did on every road past the Bay (mutants: past the table 0 as before)', () => {
  _resetTravelPace(); setPaceGround(true); setTravelPace('speed', 100);   // the dial at its top, as TO1's own pins stand it
  const out = built();
  const at = roadPixel(out);
  assert.ok(at, 'a road running east-west past the Bay');
  const before = rig({ x: at.x, y: at.y }, 90);
  assert.equal(before.to.followPath(), false);
  assert.deepEqual(before.said, [TRAVEL_OPTIONS_TEXT.MsgNoPath], 'the old answer past the Bay');
  setArenaRoads({ roads: out.roads, tracks: out.tracks });
  const r = rig({ x: at.x, y: at.y }, 90);
  assert.equal(r.to.followPath(), true);
  assert.equal(r.ui.destinationName, TRAVEL_OPTIONS_TEXT.MsgFollowRoad);
  assert.equal(r.to.road, true);
  assert.deepEqual([r.ui.timeAcceleration, r.ui.onRoad], [100, true], 'RATE-LAW: a road\'s x100 past the Bay too');
  // the rate law's lane read - the host's travellerOnRoad - at the road pixel's middle
  const o = mapPixelWorldOrigin(at.x, at.y);
  assert.notEqual(playerOnPathAt(pathsDataPoint(r.net, at.x, at.y), o.x + 16384, o.z + 16384, at.x, at.y), 0, 'on the road: x100, not the open ground\'s x60');
});

test('BAY-LEFT-MAPS C10 THE JUNCTION MAP PAST THE BAY: the section about a road past the Bay draws its roads (it skipped every pixel off the Bay\'s table), and the host reads each byte through dataPoint, never `y * 1000 + x` (mutants: the section held to the Bay; the host\'s row read back)', () => {
  const out = built();
  setArenaRoads({ roads: out.roads, tracks: out.tracks });
  const at = roadPixel(out);
  const net = bayNet();
  const buf = new Uint32Array(100 * 100);
  let asked = 0;
  drawMapSection(buf, { originX: at.x - 10, originY: at.y - 10, width: 20, height: 20 }, { pathsAt: (x, y, t) => { asked++; return dataPoint(net, t, x, y); }, locationAt: () => null, colorOf: () => null });
  assert.equal(asked, 800, 'every pixel of the section asked, roads and tracks');
  assert.ok(buf.some((v) => v), 'its roads drawn');
  const off = new Uint32Array(100 * 100);
  drawMapSection(off, { originX: 8200, originY: 0, width: 20, height: 20 }, { pathsAt: () => { throw new Error('off the world: never asked'); }, locationAt: () => null, colorOf: () => null });
  assert.ok(off.every((v) => v === 0), 'off the world\'s grid nothing is asked or drawn');
  const host = hostText('src/scenes/world.js');
  assert.match(host, /return net\?\.source === 'basic-roads' \? dataPoint\(net, type, x, y\) : 0;/);
  assert.doesNotMatch(host, /arr\[y \* 1000 \+ x\]/);
});

test('BAY-LEFT-MAPS C10 A SPAWN PAST THE BAY OFF ITS ROADS: the spawns\' road test reads the roads past the Bay (WP4\'s spawns there rely on it) - a road pixel is no spawn\'s, open ground is (mutants: past the table 0 as before)', () => {
  const out = built();
  const net = bayNet();
  const at = roadPixel(out);
  assert.equal(pathFreePixel(net, at.x, at.y), true, 'no layer: no road there');
  setArenaRoads({ roads: out.roads, tracks: out.tracks });
  assert.equal(pathFreePixel(net, at.x, at.y), false, 'a road past the Bay stands no ruin');
  const open = [];
  for (let x = at.x - 40; x < at.x + 40; x++) if (!out.roads.has(beyondKey(x, at.y)) && !out.tracks.has(beyondKey(x, at.y))) open.push(x);
  assert.ok(open.length > 0 && open.every((x) => pathFreePixel(net, x, at.y)), 'the open ground beside it is free');
});
