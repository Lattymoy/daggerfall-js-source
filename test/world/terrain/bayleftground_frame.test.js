// BAY-LEFT-GROUND (2026-10-26, bible/03-World/Landforms.md "BAY-LEFT-GROUND"; the audit "no system left behind in the
// Bay", D5) - A RECORD'S LIFT PAST THE BAY. `landformLiftAt` answered 0 off the Bay's 1000 x 500, so a height a record
// wrote past the Bay was in the shaped frame, not DFU's: a save, a scene cache or an anchor loaded with the Landforms row
// off kept the lift there (AUDIT LANDFORMS C1/B4's case - a fall of over 100 HP). It answers on every pixel of the world's
// grid now (scenes/groundFrameHost.js), the frame's law is stamped beside the scale (`groundFrame`, GROUND_FRAME_LAW), and
// a record without the stamp, past the Bay, is put into DFU's frame by its own day's lift first - never lifted twice.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { WoodsFile } from '../../../src/formats/woodsFile.js';
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE, STREAMING_TERRAIN_SCALE, GROUND_FRAME_LAW, LIFT_FRAME_LAW, RECORD_GROUND_STAMP } from '../../../src/world/terrain/terrainSampler.js';
import { createLandforms, landformLift, landformSitesBeyond } from '../../../src/world/landforms.js';
import { StreamingWorldState } from '../../../src/world/streamingWorld.js';
import { groundWoods, dropGroundCache } from '../../../src/world/tamriel/tamrielGround.js';
import { setTamrielTrace } from '../../../src/world/tamriel/tamrielLand.js';
import { capitalPin } from '../../../src/world/tamrielCapitals.js';
import { recordFrame, createGroundFrame, framePixelAt } from '../../../src/scenes/groundFrameHost.js';
import { makeAnchor } from '../../../src/systems/teleportAnchor.js';
import { createSceneCache, cacheScene, restoreCachedScene, snapshotSceneCache, restoreSceneCache } from '../../../src/systems/sceneCache.js';
import { snapshotPlayer, restorePlayer } from '../../../src/systems/save/save.js';
import { syntheticWoodsBytes } from '../../landformWorld.mjs';
import { hostText } from '../../hostText.mjs';

const H = HEIGHTMAP_DIMENSION;
afterEach(() => { setTamrielTrace(null); dropGroundCache(); });
const world = () => { const w = new WoodsFile(); assert.equal(w.load(syntheticWoodsBytes()), true); return groundWoods(w); };

test('BAY-LEFT-GROUND D5 the frame\'s law: past the Bay a record is DFU\'s frame both ways now; one written before the stamp stood the shaped ground of its day, and is put into DFU\'s frame by that day\'s lift before the lift goes on - never twice, its height over the ground exact; on the Bay a record without the stamp is DFU\'s frame already; the row off, as it came (mutants: the old law\'s step dropped; taken on the Bay too; taken from a stamped record)', () => {
  const now = (x) => 100 + x, before = (x) => 40 + x;   // the lift at a spot now and on the old law's ground
  const liftAt = (x, z, o = {}) => (o.before ? before(x) : now(x));
  const ground = 500;   // DFU's ground at the spot; the shaped ground now ground + now(x), then ground + before(x)
  const state = { compensation: [0, 7, 0], localFromWorld: (nx, nz) => [nx - 100, nz - 200] };
  const heightAt = (x) => ground + now(x) + 7;
  const past = recordFrame({ landform: true, liftAt, heightAt, state, bayAt: () => false });
  const bay = recordFrame({ landform: true, liftAt, heightAt, state, bayAt: () => true });
  const off = 3.5, x = 12;
  // written now, past the Bay: DFU's frame, back exactly
  const w = past.groundFrameHeight(ground + now(x) + off, x, 0);
  assert.equal(w, ground + off, 'written past the Bay: the lift at its spot off');
  assert.equal(past.restandHeight(w, x, 0, STREAMING_TERRAIN_SCALE, GROUND_FRAME_LAW), ground + now(x) + off, 'read with its stamp: the lift on, once');
  // written before the stamp, past the Bay: the shaped ground of its day plus its off
  const old = ground + before(x) + off;
  assert.equal(past.restandHeight(old, x, 0, STREAMING_TERRAIN_SCALE, null), ground + now(x) + off, 'its day\'s lift off, today\'s on: the same off over today\'s ground');
  assert.equal(past.restandHeight(old, x, 0, STREAMING_TERRAIN_SCALE, undefined), ground + now(x) + off);
  assert.notEqual(past.restandHeight(old, x, 0, STREAMING_TERRAIN_SCALE, GROUND_FRAME_LAW), ground + now(x) + off, 'read as stamped it would stand the lift twice');
  // on the Bay a record before the stamp was DFU's frame already
  assert.equal(bay.restandHeight(ground + off, x, 0, STREAMING_TERRAIN_SCALE, null), ground + now(x) + off);
  assert.equal(bay.restandHeight(ground + off, x, 0, STREAMING_TERRAIN_SCALE, GROUND_FRAME_LAW), ground + now(x) + off);
  // the row off: every record as it came, stamped or not
  const plain = recordFrame({ landform: false, liftAt, heightAt: () => ground + 7, state, bayAt: () => false });
  assert.equal(plain.restandHeight(ground + off, x, 0, STREAMING_TERRAIN_SCALE, GROUND_FRAME_LAW), ground + off);
  assert.equal(plain.restandHeight(old, x, 0, STREAMING_TERRAIN_SCALE, null), old, 'an old record past the Bay keeps what it always kept with the row off');
  const plainBay = recordFrame({ landform: false, liftAt, heightAt: () => ground + 7, state, bayAt: () => true });
  assert.equal(plain.restandHeight(old, x, 0, 1.5, null), plainBay.restandHeight(old, x, 0, 1.5, null), 'the row off, a record of the prefab\'s scale past the Bay: stood again as on the Bay - no old law\'s step');
  assert.equal(plain.groundFrameHeight(ground + off, x, 0), ground + off);
  assert.deepEqual({ ...RECORD_GROUND_STAMP }, { terrainScale: STREAMING_TERRAIN_SCALE, groundFrame: GROUND_FRAME_LAW });
  assert.equal(GROUND_FRAME_LAW, 6);   // PIN MOVED (FB1029 ACROSS-EDGE): 5 - the ground about a town rose to meet it (test/world/fb1029_ground.test.js); PIN MOVED (FB1028 TOWN-GROUND): 4 - a town's blend moved DFU's own ground (test/world/terrain/fb1028_townground_frame.test.js); PIN MOVED (RELIEF-PEAKS): 3 - DFU's own ground past the Bay moved (its large map's law); D5's own law is LIFT_FRAME_LAW, 2 (test/world/reliefpeaks.test.js)
  assert.equal(LIFT_FRAME_LAW, 2);
});

/** The world host's own frame over a stream at (X0, Y0) on the synthetic world's continent, a town past the Bay by its site. */
function frameHost(X0, Y0, { built = new Map(), landform = true, asked = [] } = {}) {
  const woods = world();
  const m = capitalPin({ name: 'Mournhold', province: 'Morrowind' });
  const town = { px: m.px + 6, py: m.py };
  const beyond = landformSitesBeyond([{ px: town.px, py: town.py, loc: { exterior: { exteriorData: { width: 8, height: 8, blockNames: ['X'] } }, mapTableData: { locationType: 0 } } }]);
  const state = new StreamingWorldState();
  state.init(X0, Y0);
  state.compensation = [12.5, 9, -40.25];
  const heightCell = TERRAIN_SIZE / (H - 1);
  const here = () => createLandforms({ woods, beyond }), was = () => createLandforms({ woods });
  const host = createGroundFrame({
    _liftLocationAt: (x, y) => { asked.push([x, y]); return null; }, blocks: {}, built, heightAt: () => -Infinity, heightCell, landform, landformsHere: ({ before = false } = {}) => (before ? was() : here()),
    beyondSites: { generation: () => 1 }, maps: {}, terrainGen: { roads: () => null }, state, woods,
  });
  const scene = (px, py, sx, sy) => { const t = state.pixelTranslation(px, py); return [t[0] + sx * heightCell, t[2] + sy * heightCell]; };
  return { host, scene, woods, town, here, was, state };
}

test('BAY-LEFT-GROUND D5 the host\'s lift answers on every pixel of the world\'s grid: past the Bay the kernel\'s own field there (the shaped ground less DFU\'s), by the old law the ground before its sites - the two parting by a town past the Bay and one away from it; off the grid none (mutants: the Bay\'s bound kept; the old law\'s landforms the new\'s)', () => {
  const asked = [];
  const { host, scene, woods, town, here, was } = frameHost(3830, 760, { asked });
  const at = (px, py, sx, sy, lf) => landformLift(woods, px, py, sx, sy, null, H, lf()) * STREAMING_TERRAIN_SCALE;
  // beside the town past the Bay (its east neighbour, pulled to its level)
  const [x, z] = scene(town.px + 1, town.py, 20.5, 64.25);
  const nowLift = host.landformLiftAt(x, z), oldLift = host.landformLiftAt(x, z, { before: true });
  assert.ok(Math.abs(nowLift - at(town.px + 1, town.py, 20.5, 64.25, here)) < 1e-9, `the field there (${nowLift.toFixed(2)})`);
  assert.ok(Math.abs(oldLift - at(town.px + 1, town.py, 20.5, 64.25, was)) < 1e-9, `the old law's (${oldLift.toFixed(2)})`);
  assert.ok(Math.abs(nowLift) > 1 && Math.abs(nowLift - oldLift) > 0.5, `past the Bay a lift, the site's pull in it (${nowLift.toFixed(2)} against ${oldLift.toFixed(2)})`);
  // far from any site past the Bay: one lift by either law
  const [fx, fz] = scene(town.px - 12, town.py + 4, 40, 40);
  assert.ok(Math.abs(host.landformLiftAt(fx, fz) - host.landformLiftAt(fx, fz, { before: true })) < 1e-9);
  assert.ok(Math.abs(host.landformLiftAt(fx, fz)) > 0.01, 'and a lift - it was 0 past the Bay');
  // off the world's grid: none, and nothing asked for it - no place, no field (its keys are the grid's: worldPixelKey)
  asked.length = 0;
  assert.equal(host.landformLiftAt(...scene(9000, 0, 10, 10)), 0);
  assert.deepEqual(asked, [], 'no place asked off the grid');
  // the frame's pixel is the stream's own
  assert.deepEqual(framePixelAt(frameHost(3830, 760).state, ...scene(town.px, town.py, 64, 64)), [town.px, town.py]);
});

test('BAY-LEFT-GROUND D5 the lift\'s field is the sites\' own: made again when their generation moves - the town past the Bay gone, its pull gone with it (mutants: the field kept across the generation)', () => {
  const woods = world();
  const m = capitalPin({ name: 'Mournhold', province: 'Morrowind' });
  const town = { px: m.px + 6, py: m.py };
  const beyond = landformSitesBeyond([{ px: town.px, py: town.py, loc: { exterior: { exteriorData: { width: 8, height: 8, blockNames: ['X'] } }, mapTableData: { locationType: 0 } } }]);
  const state = new StreamingWorldState();
  state.init(3830, 760);
  const heightCell = TERRAIN_SIZE / (H - 1);
  let table = beyond, gen = 1;
  const host = createGroundFrame({
    _liftLocationAt: () => null, blocks: {}, built: new Map(), heightAt: () => -Infinity, heightCell, landform: true,
    landformsHere: ({ before = false } = {}) => createLandforms({ woods, beyond: before ? null : table }),
    beyondSites: { generation: () => gen }, maps: {}, terrainGen: { roads: () => null }, state, woods,
  });
  const t = state.pixelTranslation(town.px + 1, town.py), x = t[0] + 20.5 * heightCell, z = t[2] + 64.25 * heightCell;
  const pulled = host.landformLiftAt(x, z), bare = host.landformLiftAt(x, z, { before: true });
  assert.ok(Math.abs(pulled - bare) > 0.5, `the site's pull (${pulled.toFixed(2)} against ${bare.toFixed(2)})`);
  table = null; gen = 2;   // the town gone: a new table, a new generation
  assert.ok(Math.abs(host.landformLiftAt(x, z) - bare) < 1e-9, 'the field made again on the new table');
});

test('BAY-LEFT-GROUND D5 a record past the Bay goes out and comes back over the real lift: written now, exact; written before the stamp on the old law\'s ground, the same height over today\'s (mutants: the lift past the Bay 0; the old law\'s step)', () => {
  const { host, scene, town } = frameHost(3830, 760);
  const [x, z] = scene(town.px + 1, town.py, 20.5, 64.25);
  const dfu = 250, off = 2.25;
  // PIN MOVED (RELIEF-PEAKS, GROUND_FRAME_LAW 3): DFU's own ground past the Bay moved since (its large map's law), so a
  // record written then stood DFU's ground of its day - today's less the move (test/world/reliefpeaks.test.js)
  const moved = host.groundMovedAt(x, z);
  assert.ok(Math.abs(moved) > 0.5, `DFU's own ground moved here (${moved.toFixed(2)})`);
  const shapedNow = dfu + host.landformLiftAt(x, z), shapedThen = dfu - moved + host.landformLiftAt(x, z, { before: true });
  const w = host.groundFrameHeight(shapedNow + off, x, z);
  assert.ok(Math.abs(w - (dfu + off)) < 1e-9, 'into DFU\'s frame');
  assert.ok(Math.abs(host.restandHeight(w, x, z, STREAMING_TERRAIN_SCALE, GROUND_FRAME_LAW) - (shapedNow + off)) < 1e-9, 'and back');
  assert.ok(Math.abs(host.restandHeight(shapedThen + off, x, z, STREAMING_TERRAIN_SCALE, null) - (shapedNow + off)) < 1e-9, 'a record of the old law: its off over today\'s ground');
});

test('BAY-LEFT-GROUND D5 every record that carries an exterior height stamps its frame\'s law beside its scale, and every store keeps it - the save, the scene cache, the anchor; a record before it reads null (mutants: a store dropping it)', () => {
  const entity = { items: [], stats: {} };
  const snap = snapshotPlayer(entity, {});
  assert.equal(snap.groundFrame, GROUND_FRAME_LAW);
  assert.equal(snap.terrainScale, STREAMING_TERRAIN_SCALE);
  assert.equal(restorePlayer(entity, JSON.parse(JSON.stringify(snap))).groundFrame, GROUND_FRAME_LAW, 'the save keeps it');
  const { groundFrame: _drop, ...older } = snap;
  assert.equal(restorePlayer(entity, older).groundFrame, null, 'a save from before it');
  const a = makeAnchor({ pixel: { x: 1, y: 2 }, nativeX: 0, nativeZ: 0, y: 5, ...RECORD_GROUND_STAMP });
  assert.deepEqual([a.terrainScale, a.groundFrame], [STREAMING_TERRAIN_SCALE, GROUND_FRAME_LAW], 'the anchor');
  assert.equal(makeAnchor({ pixel: { x: 1, y: 2 }, nativeX: 0, nativeZ: 0, y: 5 }).groundFrame, null);
  const cache = createSceneCache();
  cacheScene(cache, 'A', { droppedPiles: [], ...RECORD_GROUND_STAMP });
  const round = restoreSceneCache(createSceneCache(), JSON.parse(JSON.stringify(snapshotSceneCache(cache))));
  const entry = restoreCachedScene(round, 'A');   // a restore takes the entry
  assert.equal(entry.groundFrame, GROUND_FRAME_LAW, 'the scene cache');
  cacheScene(cache, 'B', { droppedPiles: [], terrainScale: STREAMING_TERRAIN_SCALE });
  assert.equal(restoreCachedScene(cache, 'B').groundFrame, null);
  for (const r of [snap, a, entry]) assert.equal(Object.hasOwn(r, 'landforms'), false, 'no word of the row (AUDIT LANDFORMS C1)');
});

test('BAY-LEFT-GROUND D5 the world host: the lift\'s place past the Bay the build\'s own, the old law\'s landforms the Bay\'s table alone, the frame handed both; the four writers stamp the frame\'s law and every reader hands it on (mutants: each seam)', () => {
  const w = hostText('src/scenes/world.js');
  assert.match(w, /const _liftLocationAt = \(x, y\) => \(onTheBay\(x, y\) \? spawnGroundPlace\.groundLocationAt\(x, y, locationIndex\.get\(`\$\{x\},\$\{y\}`\)\) : _locationToBuild\(x, y\)\);/);
  assert.match(w, /const landformsHere = \(\{ before = false \} = \{\}\) => \(landform \? createLandforms\(\{ woods, roads: terrainGen\.roads\(\), sites: _landformSites, beyond: before \? null : beyondSites\.beyond\(\), climates: _landformClimates, ranges: !before \}\) : null\);/, 'the old law\'s landforms: the Bay\'s table alone');   // PIN MOVED (RELIEF-PEAKS): the old law's landforms without the ranges, which a record written then never stood
  assert.match(w, /createGroundFrame\(\{[^\n]*\n\s+_liftLocationAt, blocks, built, heightAt, heightCell, landform, landformsHere, maps, terrainGen, beyondSites,\n/);
  assert.match(readFileSync(new URL('../../../src/scenes/groundFrameHost.js', import.meta.url), 'utf8'), /field = landformLiftField\(host\.woods, px, py, rect, HEIGHTMAP_DIMENSION, landformsHere\(\{ before \}\), about\);/, 'the lift asks the law it reads by');   // PIN MOVED (FB1029 ACROSS-EDGE): and the towns it meets
  assert.equal((w.match(/\.\.\.RECORD_GROUND_STAMP/g) ?? []).length, 4, 'the scene cache, the deck, the anchor, a remains\' place');
  assert.match(w, /restandHeight\(p\[1\], x, z, savedScale, extras\.groundFrame\)/, 'the camps left outside');
  assert.match(w, /restandHeight\(y, x, z, was, arrived\.groundFrame\)/, 'the scene cache');
  assert.match(w, /scaleOf\(t\.restore\.terrainScale\), t\.restore\.groundFrame\)/, 'the deck');
  assert.match(w, /scaleOf\(a\.terrainScale\), a\.groundFrame\)/, 'the anchor');
  assert.match(w, /restandHeight\(y, x, z, was, extras\.groundFrame\); \};/, 'the save\'s rows');
  assert.match(w, /restandHeight\(w\.y \?\? 2, lx, lz, was, extras\.groundFrame\)/, 'the save\'s player');
  assert.match(w, /anchorLanding\(\{ \.\.\.place\.world, nativeX: place\.world\.x, nativeZ: place\.world\.z \}\)\[1\]/, 'a remains\' place: the record whole, its stamp with it');
  assert.doesNotMatch(readFileSync(new URL('../../../src/scenes/groundFrameHost.js', import.meta.url), 'utf8'), /MAP_WIDTH|MAP_HEIGHT/, 'no Bay bound left');
});
