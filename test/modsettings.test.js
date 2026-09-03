// ROADS 24: A VENDORED MOD'S OWN SWITCHES. Basic Roads' SmoothRoads and
// RiversAndStreams, with the mod's own names, defaults and descriptions,
// under the Mods pane, carried on the network object into the kernel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MOD_SETTINGS, modSetting, setModSetting, _resetModSettings } from '../src/systems/modSettings.js';

test('ROADS 24: the switches are the mod\u2019s own - names, defaults, descriptions', () => {
  _resetModSettings();
  const m = MOD_SETTINGS['roads-hazelnut'];
  assert.equal(m.title, 'Basic Roads');
  assert.equal(m.keys.SmoothRoads.default, true);
  assert.equal(m.keys.RiversAndStreams.default, false);
  assert.match(m.keys.SmoothRoads.description, /light smoothing of road surfaces/);
  assert.match(m.keys.RiversAndStreams.description, /rivers and streams on terrain/);
  assert.equal(modSetting('roads-hazelnut', 'SmoothRoads'), true, 'default read');
  assert.equal(modSetting('roads-hazelnut', 'RiversAndStreams'), false);
  setModSetting('roads-hazelnut', 'RiversAndStreams', true);
  assert.equal(modSetting('roads-hazelnut', 'RiversAndStreams'), true, 'flipped');
  assert.throws(() => modSetting('roads-hazelnut', 'PathEditingEnabled'), /not a declared switch/, 'the mod\u2019s editor switches are not carried');
  _resetModSettings();
  assert.equal(modSetting('roads-hazelnut', 'RiversAndStreams'), false, 'reset forgets');
});

test('ROADS 24: the switches reach the kernel on both paths, and the Mods pane shows them', () => {
  const host = readFileSync('src/scenes/world.js', 'utf8');
  assert.match(host, /smooth: modSetting\('roads-hazelnut', 'SmoothRoads'\), water: modSetting\('roads-hazelnut', 'RiversAndStreams'\)/, 'read as the world loads');
  assert.match(host, /setRoadsData\(\{ \.\.\.his, \.\.\.roadSwitches \}/, 'on his data');
  assert.match(host, /setRoads\(settlementsOf\(maps\), logRoads, roadSwitches\)/, 'and on the fallback');
  const worker = readFileSync('src/world/terrainGenWorker.js', 'utf8');
  assert.match(worker, /\.\.\.\(m\.switches \?\? \{\}\)/, 'the worker attaches them to the built network');
  const menu = readFileSync('src/ui/enhancedMenu.js', 'utf8');
  assert.match(menu, /for \(const \[vendor, mod\] of Object\.entries\(MOD_SETTINGS\)\)/, 'the Mods pane lists every vendored mod\u2019s switches');
  assert.match(menu, /setModSetting\(vendor, key, !modSetting\(vendor, key\)\)/, 'a click flips one');
});

// AUDIT 54 F3: THE SWITCH HAS TO CROSS THE SEAM, NOT JUST BE READ AT THE
// CALL SITE. The pin above matched the source text of the call and of the
// fallback arm; nothing asserted that setRoadsData or the worker's his-data
// arm FORWARDS `smooth`. All three rebuilt the network object field by
// field and kept `water` while dropping `smooth`, so on the vendored Basic
// Roads path - the one the game takes - `roads.smooth` reached the kernel
// as `undefined`, `undefined !== false` ran the smoother anyway, and the
// host logged ", smoothing off" on the exact path where smoothing still
// ran. These three drive the wires instead of reading them.
test('ROADS 24 / AUDIT 54 F3: setRoadsData carries `smooth` into the network this thread keeps', async () => {
  const { TerrainGenClient } = await import('../src/world/terrainGenClient.js');
  const net = () => ({ roads: new Uint8Array(8), tracks: new Uint8Array(8) });
  const client = new TerrainGenClient({ woods: null });   // no bytes -> no worker
  client.setRoadsData({ ...net(), smooth: false, water: false });
  assert.equal(client.roads().smooth, false, 'SmoothRoads off reaches the kernel as false');
  assert.equal(client.roads().water, false, 'and the sibling switch still does');
  client.setRoadsData({ ...net(), smooth: true, water: true });
  assert.equal(client.roads().smooth, true, 'and on as true');
  assert.equal(client.roads().water, true);
  client.setRoadsData(net());
  assert.equal(client.roads().smooth, true, 'a caller with no switches keeps the kernel’s default-on gate');
});

test('ROADS 24 / AUDIT 54 F3: the copy posted to the worker carries `smooth` too', async () => {
  const { TerrainGenClient } = await import('../src/world/terrainGenClient.js');
  const posted = [];
  const fake = { postMessage: (m) => posted.push(m), terminate() {} };
  const client = new TerrainGenClient({
    woods: null, woodsBytes: new Uint8Array(8), workerFactory: () => fake,
  });
  client.setRoadsData({ roads: new Uint8Array(8), tracks: new Uint8Array(8), smooth: false, water: false });
  const sent = posted.at(-1);
  assert.equal(sent.t, 'roads');
  assert.equal(sent.net.smooth, false, 'the switch crosses the wire');
  client.setRoadsData({ roads: new Uint8Array(8), tracks: new Uint8Array(8), smooth: true });
  assert.equal(posted.at(-1).net.smooth, true);
});

test('ROADS 24 / AUDIT 54 F3: the worker’s his-data arm honours `smooth` - the kernel’s heights prove it', async () => {
  // The worker's `roads` is module-private, so this drives the REAL message
  // loop end to end: init, his network, one job - and reads the answer's
  // heights. With the switch on, smoothRoadHeights runs over the road tiles
  // it just painted; with it off, the samples are the unsmoothed ones.
  const { MAP_WIDTH, MAP_HEIGHT } = await import('../src/formats/woodsFile.js');
  const posted = [];
  const prevPost = globalThis.postMessage;
  const prevOn = globalThis.onmessage;
  globalThis.postMessage = (msg) => posted.push(msg);
  try {
    await import('../src/world/terrainGenWorker.js');
    globalThis.onmessage({ data: { t: 'init', woodsBytes: syntheticWoods(MAP_WIDTH, MAP_HEIGHT) } });
    assert.notEqual(posted.at(-1)?.t, 'error', 'the synthetic WOODS loads');
    const px = 400, py = 200;
    const run = (smooth) => {
      const roads = new Uint8Array(MAP_WIDTH * MAP_HEIGHT);
      roads[py * MAP_WIDTH + px] = 0xff;   // every direction: a painted crossroads
      globalThis.onmessage({ data: { t: 'roads', net: { roads, tracks: new Uint8Array(MAP_WIDTH * MAP_HEIGHT), water: false, smooth } } });
      globalThis.onmessage({ data: { t: 'job', px, py, stride: 1, tilemap: new Uint8Array(128 * 128), locationRect: null, hasLocation: false, climateType: 302 } });
      const done = posted.at(-1);
      assert.equal(done.t, 'done', done.message ?? '');
      return done.samples;
    };
    const off = run(false);
    const on = run(true);
    assert.notDeepEqual(Array.from(on), Array.from(off), 'the switch changes the heights the kernel returns');
    const unset = run(undefined);
    assert.deepEqual(Array.from(unset), Array.from(on), 'omitted still means on - the kernel’s `!== false`');
  } finally {
    globalThis.postMessage = prevPost;
    globalThis.onmessage = prevOn;
  }
});

// AUDIT 54 F3 (R1): AND THE FOURTH REBUILD, ON THE OTHER PATH. The three
// pins above walk the VENDORED arm, where the worker replies `net: null`.
// On the OURS arm the worker replies with a two-field slice of the network
// it built (for the map), and the client's reply handler rebuilt `_roads`
// from those two fields alone - dropping the switches, and locking them
// out for good, since `_roadsFallback()` early-returns once `_roads` is
// set. Every same-thread build after that - a worker job error, a worker
// death, a solo `generate()` - then smoothed with SmoothRoads off. This
// drives the REAL client with a fake worker and reads the kernel's heights.
test('ROADS 24 / AUDIT 54 F3: the worker\u2019s roads REPLY keeps the switches - the same-thread kernel\u2019s heights prove it', async () => {
  const { TerrainGenClient } = await import('../src/world/terrainGenClient.js');
  const { WoodsFile, MAP_WIDTH, MAP_HEIGHT } = await import('../src/formats/woodsFile.js');
  const bytes = syntheticWoods(MAP_WIDTH, MAP_HEIGHT);
  const px = 400, py = 200;
  const warn = console.warn;
  console.warn = () => {};
  try {
    const run = async (smooth) => {
      const woods = new WoodsFile();
      assert.equal(woods.load(bytes.slice()), true, 'the synthetic WOODS loads');
      const fake = { postMessage() {}, terminate() {} };
      const client = new TerrainGenClient({ woods, woodsBytes: bytes.slice(), workerFactory: () => fake });
      // the ours path: a settlement list, the switches, and the worker's
      // reply carrying the built network back for the map
      client.setRoads([{ x: px, y: py, type: 0 }], null, { smooth, water: false });
      const roads = new Uint8Array(MAP_WIDTH * MAP_HEIGHT);
      roads[py * MAP_WIDTH + px] = 0xff;   // every direction: a painted crossroads
      fake.onmessage({ data: { t: 'roads', net: { roads, tracks: new Uint8Array(MAP_WIDTH * MAP_HEIGHT) } } });
      assert.equal(client.roads().smooth, smooth, 'the reply arm kept the switch');
      // ...and now the worker fails this job, so the SAME-THREAD kernel
      // answers it with whatever `_roads` is holding.
      const answer = client.generate({
        px, py, stride: 1, tilemap: new Uint8Array(128 * 128),
        locationRect: null, hasLocation: false, climateType: 302,
      });
      fake.onmessage({ data: { t: 'error', message: 'worker job failed' } });
      return (await answer).samples;
    };
    const off = await run(false);
    const on = await run(true);
    assert.notDeepEqual(Array.from(on), Array.from(off),
      'SmoothRoads off must reach the fallback kernel - the heights are identical, so it did not');
  } finally {
    console.warn = warn;
  }
});

/** The synthetic WOODS.WLD of test/terrain.test.js - no ARENA2 needed. */
function syntheticWoods(W, H) {
  const offsetsStart = 32 + 28 * 4;
  const cellsStart = offsetsStart + W * H * 4;
  const heightMapOffset = cellsStart + 2 * (22 + 25);
  const bytes = new Uint8Array(heightMapOffset + W * H);
  const v = new DataView(bytes.buffer);
  v.setUint32(0, W * H * 4, true);
  v.setUint32(4, W, true);
  v.setUint32(8, H, true);
  v.setUint32(16, cellsStart, true);
  v.setUint32(28, heightMapOffset, true);
  for (let i = 0; i < W * H; i++) v.setUint32(offsetsStart + i * 4, cellsStart, true);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) bytes[heightMapOffset + y * W + x] = (x + y) & 0xff;
  return bytes;
}
