// ARENA2 (2026-10-02): THE FLOOR'S INSTANCE (world/arenaFloor.js) - the colosseum stood on its own as a made dungeon
// level (the Burning Court's law: no fifth host): the made location, the made block carried out of ARENADAG.RMB (every
// model in its place against every other, the light flats as flats and as the dungeon's lights, the undercroft's stair
// and the gate's people left in the city), the start marker by the bout's kind, the blocks file answering one name
// more, the ways out as exit doors, the ring on the sand, and the seats sought on the tiers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  arenaFloorLocation, isArenaFloor, arenaFloorBlock, arenaFloorBlocks, arenaExitDoors, floorCentre, floorPoint, arenaRing,
  crowdSeats, pickSeats, ARENA_FLOOR_BLOCK, ARENA_FLOOR_BLOCK_INDEX, ARENA_FLOOR_LOCATION_ID, RING_R, SAND_R, SAND_Y_MODEL,
  TERRACE_UP, SEAT_UP_MIN, SEAT_UP_MAX, SEAT_R_MIN, ARRIVE, WAYS_OUT, ARENA_EXIT_W, ARENA_EXIT_H, ARENA_GROUND_MODEL,
} from '../src/world/arenaFloor.js';
import { GATE_ARENA_BLOCK_INDEX, GATE_ARENA_LOCATION_ID } from '../src/world/gateArena.js';
import { ARENA_BLOCK_INDEX } from '../src/world/arenaCity.js';
import { getModelMatrix, layoutRdbBlock } from '../src/world/rdbLayout.js';
import { seededRng } from '../src/systems/arenaLadder.js';
import { RING_SLACK_M } from '../src/systems/arenaBout.js';

const BLOCK = JSON.parse(readFileSync(new URL('../vendor/daggerfall-arena/Arena/ARENADAG.RMB.json', import.meta.url), 'utf8'));
const S = 0.025;

test('ARENA2 floor: the made location - the city\'s region and climate, map id 0, its own record id beside the court\'s', () => {
  const city = { regionIndex: 17, regionName: 'Daggerfall', climate: { worldClimate: 227, climateType: 2 } };
  const loc = arenaFloorLocation({ kind: 'watch', city });
  assert.equal(loc.arenaFloor, 'watch');
  assert.equal(loc.regionIndex, 17);
  assert.equal(loc.mapTableData.mapId, 0, 'no world room keys off it');
  assert.equal(loc.dungeon.recordElement.header.locationId, ARENA_FLOOR_LOCATION_ID);
  assert.notEqual(ARENA_FLOOR_LOCATION_ID, GATE_ARENA_LOCATION_ID);
  assert.deepEqual(loc.dungeon.blocks.map((b) => [b.blockName, b.isStartingBlock]), [[ARENA_FLOOR_BLOCK, true]]);
  assert.ok(isArenaFloor(loc));
  assert.ok(!isArenaFloor({ ...loc, arenaFloor: undefined }));
  assert.ok(!isArenaFloor({ arenaFloor: 'ladder' }), 'the record id makes it');
  assert.equal(arenaFloorLocation().arenaFloor, 'ladder');
  assert.ok(![GATE_ARENA_BLOCK_INDEX, ARENA_BLOCK_INDEX].includes(ARENA_FLOOR_BLOCK_INDEX));
});

test('ARENA2 floor: the made block - every ARENADAG model in its place (y + 4, z + 4096), the stair and the people left in the city', () => {
  const blk = arenaFloorBlock('ladder');
  const objs = blk.rdbBlock.objectRootList[0].rdbObjects;
  const models = objs.filter((o) => o.type === 0x01);
  const src = BLOCK.RmbBlock.Misc3dObjectRecords.filter((o) => Number(o.ModelIdNum) !== 43600);
  // AUDIT PRE-MERGE 1003 W1: and the city's ground under them, the last model (test/audit1003_world.test.js)
  assert.equal(models.length, src.length + 1, 'every misc model but the undercroft\'s stair, and the ground');
  assert.equal(blk.rdbBlock.modelReferenceList[models[src.length].resources.modelResource.modelIndex].modelIdNum, ARENA_GROUND_MODEL);
  assert.ok(!blk.rdbBlock.modelReferenceList.some((r) => r.modelIdNum === 43600));
  assert.ok(blk.rdbBlock.modelReferenceList.some((r) => r.modelIdNum === 864102), 'the colosseum');
  for (let i = 0; i < src.length; i++) {
    const o = src[i], m = models[i];
    assert.equal(blk.rdbBlock.modelReferenceList[m.resources.modelResource.modelIndex].modelIdNum, Number(o.ModelIdNum));
    // the RMB misc frame (world/rmbLayout.js): (X, -Y - 4, Z + 4096) x scale - the RDB's getModelMatrix lands it there
    const mat = getModelMatrix(m);
    assert.ok(Math.abs(mat[12] - o.XPos * S) < 1e-4 && Math.abs(mat[13] - (-o.YPos - 4) * S) < 1e-4 && Math.abs(mat[14] - (o.ZPos + 4096) * S) < 1e-4, `model ${o.ModelIdNum} in its place`);
    assert.equal(m.resources.modelResource.yRotation, o.YRotation | 0);
    assert.equal(m.resources.modelResource.actionResource.flags, 0, 'nothing acts');
  }
  const flats = objs.filter((o) => o.type === 0x03 && o.resources.flatResource.textureArchive === 210);
  const lights = objs.filter((o) => o.type === 0x02);
  const srcLights = BLOCK.RmbBlock.MiscFlatObjectRecords.filter((f) => f.TextureArchive === 210);
  assert.equal(flats.length, srcLights.length);
  assert.equal(lights.length, srcLights.length, 'each torch and brazier is a dungeon light too');
  assert.ok(lights.every((l) => l.resources.lightResource.radius > 0));
  assert.ok(!objs.some((o) => o.type === 0x03 && [182, 183].includes(o.resources.flatResource.textureArchive)), 'the gate\'s people stand at the city\'s gate');
  // the start marker, by kind
  const marker = (k) => arenaFloorBlock(k).rdbBlock.objectRootList[0].rdbObjects.find((o) => o.resources.flatResource.textureArchive === 199);
  const c = floorCentre();
  const at = (m) => [m.xPos * S - c[0], -m.yPos * S - c[1], m.zPos * S - c[2]];
  const l = at(marker('ladder')), w = at(marker('watch'));
  assert.ok(Math.abs(l[0] - ARRIVE.ladder.at[0]) < 0.05 && Math.abs(l[2]) < 0.05 && Math.abs(l[1] - 0.4) < 0.05, 'a fighter on their mark on the sand');
  assert.ok(Math.abs(w[1] - (TERRACE_UP + 0.4)) < 0.05 && Math.abs(w[2] - ARRIVE.watch.at[1]) < 0.05, 'a watcher on the terrace');
  assert.equal(marker('ladder').resources.flatResource.textureRecord, 10, 'the start marker 199.10');
  assert.equal(marker('ladder').resources.flatResource.soundIndex, 0, 'no water');
  // the RDB layout reads it as a dungeon block
  const lay = layoutRdbBlock(blk, ARENA_FLOOR_BLOCK_INDEX, true, () => ({ positions: new Float32Array(0), indices: new Uint32Array(0), subMeshes: [], doors: [] }));
  assert.equal(lay.placements.length, models.length);
  assert.equal(lay.startMarkers.length, 1);
});

test('ARENA2 floor: the frame - the sand\'s centre is the colosseum\'s place with its floor taken off; the ring inside the sand', () => {
  const o = BLOCK.RmbBlock.Misc3dObjectRecords.find((x) => Number(x.ModelIdNum) === 864102);
  const c = floorCentre();
  assert.ok(Math.abs(c[0] - o.XPos * S) < 1e-9);
  assert.ok(Math.abs(c[1] - ((-o.YPos - 4) * S + SAND_Y_MODEL)) < 1e-9);
  assert.ok(Math.abs(c[2] - (o.ZPos + 4096) * S) < 1e-9);
  assert.ok(c[1] > -0.5 && c[1] < 1, 'the sand stands about the block\'s ground');
  assert.deepEqual(floorPoint(1, 2, 3), [c[0] + 1, c[1] + 3, c[2] + 2]);
  assert.deepEqual(arenaRing(), { centre: [...c], radius: RING_R });
  assert.ok(RING_R + RING_SLACK_M < SAND_R, 'a ring-out happens on the sand, before the wall');
  // the braziers stand at the sand's long ends
  const braziers = BLOCK.RmbBlock.MiscFlatObjectRecords.filter((f) => f.TextureArchive === 210 && f.TextureRecord === 19);
  for (const b of braziers) { const d = Math.hypot(b.XPos * S - c[0], (b.ZPos + 4096) * S - c[2]); assert.ok(d > RING_R && d < SAND_R + 1, `a brazier at ${d.toFixed(1)} m`); }
});

test('ARENA2 floor: the blocks file answers one name more; every other goes to the real one', () => {
  const real = { getBlockIndex: (n) => (n === 'X.RDB' ? 7 : -1), getBlock: (i) => (i === 7 ? 'real' : null) };
  const f = arenaFloorBlocks(real, 'watch');
  assert.equal(f.getBlockIndex(ARENA_FLOOR_BLOCK), ARENA_FLOOR_BLOCK_INDEX);
  assert.equal(f.getBlock(ARENA_FLOOR_BLOCK_INDEX).name, ARENA_FLOOR_BLOCK);
  assert.equal(f.getBlockIndex('X.RDB'), 7);
  assert.equal(f.getBlock(7), 'real');
  const bare = arenaFloorBlocks(null);
  assert.equal(bare.getBlockIndex('X.RDB'), -1);
  assert.equal(bare.getBlock(7), null);
});

test('ARENA2 floor: the ways out - the sand\'s gate and the terrace\'s stair, exit doors a body tall facing into the floor', () => {
  const doors = arenaExitDoors();
  assert.equal(doors.length, WAYS_OUT.length);
  const c = floorCentre();
  doors.forEach((d, i) => {
    assert.equal(d.arena, true);
    assert.deepEqual([d.size.x, d.size.y], [ARENA_EXIT_W, ARENA_EXIT_H]);
    assert.equal(d.matrix[12], c[0] + WAYS_OUT[i].at[0]);
    assert.equal(d.matrix[14], c[2] + WAYS_OUT[i].at[1]);
    const n = d.normal, toward = [-WAYS_OUT[i].at[0], -WAYS_OUT[i].at[1]];
    assert.ok(n.x * toward[0] + n.z * toward[1] > 0, 'facing into the floor');
  });
});

test('ARENA2 floor: the seats - sought on the tiers by the ground under them, none on the sand or a roof; picked by the seed', () => {
  // a made bowl: sand to 19.5, a terrace at 6.9 to 26, the tiers at 12.6 to 38, a roof of 15.4 over one arc
  const heightAt = (x, z) => {
    const r = Math.hypot(x, z);
    if (r < 19.5) return 0;
    if (r < 26) return 6.9;
    if (r < 38) return Math.atan2(z, x) > 2.5 ? 15.4 : 12.6;
    return null;
  };
  const seats = crowdSeats(heightAt);
  assert.ok(seats.length > 600, `${seats.length} seats`);
  for (const s of seats) {
    assert.ok(s.y >= SEAT_UP_MIN && s.y <= SEAT_UP_MAX);
    assert.ok(Math.hypot(s.x, s.z) >= SEAT_R_MIN - 1e-9);
  }
  assert.ok(seats.some((s) => s.y === 6.9) && seats.some((s) => s.y === 12.6), 'the terrace and the tiers');
  assert.ok(!seats.some((s) => s.y === 15.4), 'none on a roof');
  assert.ok(seats.some((s) => s.best) && seats.some((s) => !s.best));
  for (const s of seats.filter((x) => x.best)) assert.ok(Math.abs(s.z) > Math.abs(s.x), 'the best over the long sides');
  const a = pickSeats(seats, 140, seededRng(4)), b = pickSeats(seats, 140, seededRng(4));
  assert.equal(a.length, 140);
  assert.deepEqual(a, b);
  assert.equal(new Set(a).size, 140, 'no seat twice');
  assert.equal(pickSeats(seats, 1e6, seededRng(1)).length, seats.length);
  assert.equal(pickSeats(seats, -3, seededRng(1)).length, 0);
  assert.deepEqual(crowdSeats(() => null), []);
});
