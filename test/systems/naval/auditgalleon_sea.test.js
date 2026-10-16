// AUDIT GALLEON (2026-10-02, Mac: "Audit this. It must be perfect") - THE SEA: the branch's runtime changes to the sea's
// captains and the pool her art rides in, each pinned where it had none. Each pin failed on its mutant (the record's
// tools/mutants/auditgalleon_sea.json); the code as it stood (886da9b19) passes them - these laws were right, unpinned.
//   T2    an errand held on its detour too takes the next abeam the other way, and an arriving ship shortens sail from
//         ARRIVE_EASE_M out (SHIP-LIFE A STALL's laws, unreached once the new galleon's first detour cleared its hulk);
//   T3    past her range a side reloading bends in to close on a runner by CHASE_MARGIN of her pace (AUDIT NAV2 F21's
//         bend, whose one kill was the F25 duels' by chance - the five-gun galleon changed them);
//   T4(b) the pool puts her pictures on the texture door as it loads her (her every face drew nothing without them), and
//         uploads her stern gallery a cut-out (its glass seen through) and its night twin whole and glowing when her
//         meshes are made, the twins drawn in their slices' place while the lanterns are lit (DF-LOOK);
//   T4(c) a boarding's last leg into a sounded berth skips the lookout only when the boat lies still, her way there is
//         not lost, the berth is open and she is within her lookout's reach of it - each guard on its own.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createSeaShip, stepCaptain, windShare, WIND_RATED, CHASE_MARGIN, __boardCourse } from '../../../src/systems/naval/navalAI.js';
import { HULL, hullBuild, classById } from '../../../src/systems/naval/navalShips.js';
import { createComeSailAwayPool, NIGHT_REMAP } from '../../../src/scenes/comeSailAway/comeSailAwayPool.js';
import { Boat } from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { GALLEON_ARCHIVE, GALLEON_TEX_SIZE, TEX, BANDS, GALLEON_NIGHT, _resetGalleonArt } from '../../../src/world/ships/galleonArt.js';
import { isVendorArchive, vendorRecordCount, clearVendorTextures, preloadTextureArchive } from '../../../src/systems/textureReplacement.js';
import { findHarbour, createWaterGrid, stepErrand, STALL_S, DETOUR_M, ARRIVE_EASE_M, ARRIVE_SAILS } from '../../../src/systems/naval/shipLife.js';

const near = (a, b, eps, what) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b}`);
const open = () => true;
const WIND = [0, 0, 1.5];
/** shiplife.test.js's coast: land north of z = 200 and a headland x 300-400 reaching south to z = -300, a town behind. */
const coast = (x, z) => !(z > 200 || (x > 300 && x < 400 && z > -300));
const TOWN = { minX: -100, maxX: 100, minZ: 220, maxZ: 420 };
/** The captains' door to the errands over the coast: one harbour, its grids, every berth free. */
function lifeOn(harbour) {
  const grids = new Map();
  const grid = (h) => grids.get(h) ?? (grids.set(h, createWaterGrid({ isWater: coast, hull: h })), grids.get(h));
  return { harbour: (k) => (k === 'port' ? harbour : null), grid, free: () => true, harbours: () => [{ key: 'port', harbour, free: () => true }] };
}

test('AUDIT GALLEON T2: an errand held on its detour too takes the next DETOUR_M abeam the other way (the first lay across what held her) - her galleon dead in the open water STALL_S, then STALL_S more on her detour (SHIP-LIFE A STALL\'s law: the new galleon\'s first detour cleared its hulk, and the other side was never asked)', () => {
  const life = lifeOn(findHarbour({ rect: TOWN, isWater: coast }));
  const ship = createSeaShip({ id: 's', seed: 5, classId: 'navyCutter', pos: [-300, 0, -200], yaw: Math.PI / 2 });
  assert.equal(ship.hull, HULL.SmallShip);
  ship.errand = { kind: 'arrive', harbour: 'port', berth: 0, path: null, i: 0 };
  const held = () => { for (let t = 0; t < STALL_S + 0.05; t += 0.1) { ship.speed = 0; stepErrand(ship, 0.1, life); } return ship.errand; };
  const first = held();
  assert.ok(first.detour, `a detour after ${STALL_S} s held`);
  const side1 = first.side, d1 = [...first.detour];
  near(Math.hypot(d1[0] - ship.pos[0], d1[1] - ship.pos[2]), DETOUR_M, 1e-6, 'abeam, DETOUR_M off');
  const second = held();
  assert.ok(second.detour && second.side === -side1, `held on her detour (side ${side1}), the next the other way (side ${second.side})`);
  near(Math.hypot(second.detour[0] - d1[0], second.detour[1] - d1[1]), 2 * DETOUR_M, 1e-6, 'abeam the other way');
});

test('AUDIT GALLEON T2: an arriving ship shortens sail from ARRIVE_EASE_M out - full sail beyond it, her share of it inside (ARRIVE_SAILS at the least) - so her last leg comes in under BERTH_WAY to moor (SHIP-LIFE\'s arrival, reached by the A STALL test alone - unreached once the new galleon\'s first detour cleared its hulk)', () => {
  const harbour = findHarbour({ rect: TOWN, isWater: coast });
  const life = lifeOn(harbour);
  const b = harbour.berths[0];
  const sailsAt = (back) => {
    // her galleon on her last leg in, `back` m out from her berth along its approach line, under way
    const dx = b.approach[0] - b.pos[0], dz = b.approach[1] - b.pos[1], k = back / Math.hypot(dx, dz);
    const at = [b.pos[0] + dx * k, b.pos[1] + dz * k];
    const ship = createSeaShip({ id: 's', seed: 5, classId: 'navyCutter', pos: [at[0], 0, at[1]], yaw: Math.atan2(-dx, -dz) });
    ship.speed = 5;
    ship.errand = { kind: 'arrive', harbour: 'port', berth: 0, path: [at, [b.pos[0], b.pos[1]]], i: 1 };
    return stepErrand(ship, 0.1, life).sails;
  };
  assert.equal(sailsAt(ARRIVE_EASE_M + 120), 1, 'full sail beyond ARRIVE_EASE_M');
  near(sailsAt(ARRIVE_EASE_M / 2), 0.5, 1e-6, 'her share of it inside');
  assert.equal(sailsAt(15), ARRIVE_SAILS, 'ARRIVE_SAILS at the last');
});

test('AUDIT GALLEON T3: past her range, her broadsides reloading, she bends in on a runner steeply enough to close on it by CHASE_MARGIN of her pace - a brig, a cutter and a sloop, a runner making 0.45 of her pace straight away from 1.3 of her range, on a beam wind either side and one 45 degrees on her bow, each brought inside her range within 20 s (AUDIT NAV2 F21: the flat RANGE_BEND sailed her abeam and the range opened)', () => {
  assert.ok(CHASE_MARGIN > 0);
  for (const classId of ['pirateBrig', 'navyCutter', 'pirateSloop']) {
    for (const wind of [[WIND_RATED, 0, 0], [-WIND_RATED, 0, 0], [1.06, 0, -1.06]]) {
      const cls = classById(classId);
      const s = createSeaShip({ id: 's', seed: 1, classId, pos: [0, 0, 0], yaw: 0, temper: 'bold' });
      s.speed = 6;
      const v = 0.45 * cls.speed * windShare(Math.hypot(...wind));
      const me = { id: 'me', kind: 'player', pos: [0, 0, 1.3 * cls.range], vel: [0, 0, v], speed: v, yaw: 0, hull: HULL.SmallShip };
      let within = null;
      for (let t = 0; t < 20 && within == null; t += 0.1) {
        me.pos = [0, 0, me.pos[2] + v * 0.1];
        s.guns.fired('starboard'); s.guns.fired('port');   // reloading: no lay holds her abeam
        stepCaptain(s, { now: t, dt: 0.1, seaY: 0, wind, isWater: () => true, contacts: [me], random: () => 0.5, notoriety: () => 100 });
        if (Math.hypot(me.pos[0] - s.pos[0], me.pos[2] - s.pos[2]) <= cls.range) within = t;
      }
      assert.equal(s.mode, 'engage', `${classId} fights her`);
      assert.ok(within != null, `a ${classId} closes on the runner inside her range (${cls.range} m) within 20 s, wind ${wind}`);
    }
  }
});

test('AUDIT GALLEON T4(c): a boarding\'s last leg skips the lookout (`berthing`) only into a sounded berth - the boat lying still, her way there not lost, the berth open, she within her lookout\'s reach of it; each guard dropped alone let the lookout go (to a boat under way she steers a lead point off the sounded leg)', () => {
  const b = hullBuild(HULL.SmallShip);
  // a pirate galleon 60 m abeam of a Large Boat lying head north: her berth on the boat's starboard side
  const pirate = (o = {}) => createSeaShip({ id: 'p', seed: 1, classId: 'pirateBrig', pos: o.pos ?? [60, 0, 0], yaw: -Math.PI / 2, temper: 'bold' });
  const boat = (o = {}) => ({ id: 'b', pos: [0, 0, 0], vel: o.vel ?? [0, 0, 0], yaw: 0, hull: HULL.LargeBoat });
  assert.equal(pirate().hull, HULL.SmallShip, 'her galleon');
  const sound = __boardCourse(pirate(), boat(), WIND, open);
  assert.equal(sound.berthing, true, 'the last leg into a sounded berth');
  const berth = sound.goal;
  assert.ok(berth[0] > 0 && Math.abs(berth[2]) < 1e-9, `her berth abeam to starboard (${berth.map((v) => v.toFixed(2))})`);
  // the boat under way: a lead point off the leg - the lookout keeps her
  assert.equal(__boardCourse(pirate(), boat({ vel: [0, 0, 3] }), WIND, open).berthing, false, 'to a boat under way');
  // her way there lost (the leg blocked and no way round, as routeTo left it): the lookout keeps her
  const lost = pirate();
  lost.route = { goal: [...berth], wp: null, at: lost.clock, lost: true };
  assert.equal(__boardCourse(lost, boat(), WIND, open).berthing, false, 'her way lost');
  // the berth not open - her stem's place on either side of the boat is a rock - though the leg to it sounds clear
  const rocks = [[berth[0], b.bowZ], [-berth[0], b.bowZ]];
  const rocky = (x, z) => rocks.every(([rx, rz]) => Math.hypot(x - rx, z - rz) > 2);
  assert.ok(rocks.every(([rx, rz]) => Math.abs(rz) > b.halfWidth + 4 + 2), 'the rocks off the leg\'s swath');
  assert.equal(__boardCourse(pirate(), boat(), WIND, rocky).berthing, false, 'the berth not open');
  // beyond her lookout's reach of it
  assert.equal(__boardCourse(pirate({ pos: [600, 0, 0] }), boat(), WIND, open).berthing, false, 'beyond her lookout');
});

test('AUDIT GALLEON T4(b): the pool puts every picture of hers on the texture door as it loads her model - stand-ins of GALLEON_ARCHIVE before any mesh of hers asks (without them TEXTURE.38131 would not load and her every face drew nothing) - and her meshes made, uploads each stern-gallery slice a cut-out - its glass seen through (DF-LOOK, DF-ART II kept: Mac, "windows should always be see through") - and nothing else of hers; and with each its NIGHT TWIN, whole, its glow its emission (a replacement\'s), the one thing of hers that glows - drawn in its slice\'s place while the lanterns are lit and never by day (DF-ART III kept: "See-through by day, lit at night"), one remap night after night, a host\'s own remap kept under it (mutants: the twin unglowing, the night remap dropped, worn by day)', async () => {
  const fileFetch = async (url) => {
    const bytes = readFileSync(fileURLToPath(url));
    return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
  };
  const glow = [], draws = [];
  const renderer = {
    createMesh: (model) => ({ model, buffers: [{}, {}], bounds: [0, 0, 0, 0], subMeshes: model.subMeshes.map((x) => ({ ...x, _bounds: [0, 0, 0, 0] })) }),
    drawMesh: (gpu, m, remap) => draws.push(remap), updateMeshVertices() {}, createBillboardBatch: (archive, record, size, centers, opts) => ({ archive, record, size, centers, opts }),
    destroyBillboardBatch() {}, destroyMesh() {},
    uploadEmissionTexture: (archive, record, color32, opts) => glow.push({ archive, record, w: color32?.width, h: color32?.height, opts }),
  };
  const texture = () => ({ recordCount: 100, getSize: () => ({ width: 40, height: 64 }), getScale: () => ({ width: 0, height: 0 }) });
  const uploads = [];
  // the real pipeline's vendor arm (scenes/dataPipeline.js getTexture): a stand-in archive's pictures built at its first ask
  const pipeline = { getTexture: async (a) => { if (isVendorArchive(a)) await preloadTextureArchive(a); return texture(); }, uploadRecord: (archive, record, opts) => uploads.push({ archive, record, opts }), getGpuMesh: async (id) => ({ classic: id }) };
  // AUDIT GN2-TS10: as a process that never loaded her stands - a galleon pool loaded earlier in the process (any pool
  // test before this one) had put her on the door and spent the once of her registration
  clearVendorTextures();
  _resetGalleonArt();
  assert.equal(isVendorArchive(GALLEON_ARCHIVE), false, 'not on the door before her model loads');
  const pool = createComeSailAwayPool({ renderer, pipeline, fetchFn: fileFetch, log: { warn() {} } });
  assert.equal(await pool.preload(), true);
  assert.equal(isVendorArchive(GALLEON_ARCHIVE), true, 'her pictures stand in for GALLEON_ARCHIVE');
  assert.equal(vendorRecordCount(GALLEON_ARCHIVE), Math.max(...Object.values(GALLEON_NIGHT)) + 1, 'every picture of hers, her night twins the last');
  pool.spawnNow(new Boat(HULL.SmallShip, 0), { position: [0, 0, 0], rotation: [0, 0, 0, 1] });
  const hers = () => uploads.filter((u) => u.archive === GALLEON_ARCHIVE);
  for (let i = 0; i < 100 && !BANDS.sternWindows.recs.every((r) => hers().some((u) => u.record === r)); i++) { pool.draw(); await new Promise((r) => setTimeout(r, 10)); }
  for (let i = 0; i < 5; i++) { pool.draw(); await new Promise((r) => setTimeout(r, 10)); }
  const cut = [...new Set(hers().filter((u) => u.opts?.cutout).map((u) => u.record))].sort((x, y) => x - y);
  assert.deepEqual(cut, [...BANDS.sternWindows.recs].sort((x, y) => x - y), 'each slice of her stern windows a cut-out, nothing else of hers');
  assert.ok(hers().every((u) => u.opts?.opaque === true), 'every picture of hers a model\'s');
  const twins = Object.values(GALLEON_NIGHT).sort((x, y) => x - y);
  assert.deepEqual([...new Set(hers().filter((u) => twins.includes(u.record)).map((u) => u.record))].sort((x, y) => x - y), twins, 'each night twin uploaded with her');
  assert.ok(hers().filter((u) => twins.includes(u.record)).every((u) => !u.opts.cutout), 'her night twins whole');
  assert.deepEqual([...new Set(glow.map((g) => `${g.archive}_${g.record}`))].sort(), twins.map((n) => `${GALLEON_ARCHIVE}_${n}`).sort(), 'her night twins glow, nothing else of hers');
  for (const g of glow) {
    assert.deepEqual([g.w, g.h], [GALLEON_TEX_SIZE, GALLEON_TEX_SIZE], 'its mask the picture\'s own size');
    assert.equal(g.opts?.replacement, true, 'a replacement\'s glow (no TEXTURE file is hers)');
  }
  // drawn: by day as she is, at night through her twins
  const remapOf = (world, host = null) => { pool.frame(0, world); draws.length = 0; pool.draw(renderer, host); assert.ok(draws.length > 0, 'drawn'); return draws; };
  assert.ok(remapOf({ cityLightsOn: false }).every((m) => m === null), 'by day: her glass open, no remap');
  const night = remapOf({ cityLightsOn: true });
  assert.ok(night.every((m) => m === NIGHT_REMAP), 'at night: one remap');
  for (const [r, n] of Object.entries(GALLEON_NIGHT)) assert.equal(NIGHT_REMAP.get(`${GALLEON_ARCHIVE}_${r}`), `${GALLEON_ARCHIVE}_${n}`, `slice ${r} drawn as its twin ${n}`);
  assert.equal(NIGHT_REMAP.size, 4, 'the galleon\'s two stern slices and the carrack\'s two transom slices, nothing else');
  const host = new Map([['1_2', '3_4']]);
  const merged = remapOf({ cityLightsOn: true }, host)[0];
  assert.ok(merged.get('1_2') === '3_4' && merged.get(`${GALLEON_ARCHIVE}_${TEX.sternWindows0}`) === `${GALLEON_ARCHIVE}_${GALLEON_NIGHT[TEX.sternWindows0]}`, 'a host\'s remap kept, her twins with it');
  assert.equal(remapOf({ cityLightsOn: true }, host)[0], merged, 'the same remap night after night');
  assert.ok(remapOf({ cityLightsOn: false }, host).every((m) => m === host), 'by day the host\'s own');
});
