// RPT1026-WORLD DARK-ROOM (two private reports, 2026-10-24 and 10-26: an inn with not one lamp lit; Westhead Moor's The
// Howling Mug, black from wall to wall): A ROOM DAGGERFALL LIGHTS WITH NOTHING IS LIT AS DFU LIGHTS A ROOM
// BY AMBIENT ALONE. The room's lights from the producer the interior host reads (world/interior/interiorLayout.js
// layoutInterior over the player's BLOCKS.BSA and ARCH3D.BSA, then collectInteriorLights - scenes/interiorContext.js
// lightsOf); the law (world/interior/interiorLights.js roomAmbient) and both interior hosts' line by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { dfMeshToModel } from '../../../src/world/meshReader.js';
import { layoutInterior } from '../../../src/world/interior/interiorLayout.js';
import { collectInteriorLights, roomAmbient, INTERIOR_AMBIENT, INTERIOR_NIGHT_AMBIENT, INTERIOR_AMBIENT_ONLY, INTERIOR_NIGHT_AMBIENT_ONLY } from '../../../src/world/interior/interiorLights.js';
import { Arch3dFile } from '../../../src/formats/arch3dFile.js';
import { BlocksFile } from '../../../src/formats/blocksFile.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;
const ROOT = new URL('../../../', import.meta.url);
const src = (p) => readFileSync(new URL(p, ROOT), 'utf8');

/** A room's lights as the interior host gathers them: its flats laid out, its archive-210 ones lamps. */
function roomLights(blockName, record) {
  const blocks = new BlocksFile();
  blocks.load(new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), 'BLOCKS.BSA'))));
  const arch = new Arch3dFile();
  arch.load(new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), 'ARCH3D.BSA'))));
  const cache = new Map();
  const getModel = (id) => { if (!cache.has(id)) cache.set(id, dfMeshToModel(arch.getMesh(arch.getRecordIndex(id)), () => ({ width: 1, height: 1 }))); return cache.get(id); };
  const idx = blocks.getBlockIndex(blockName);
  const interior = layoutInterior(blocks.getBlock(idx), idx, record, getModel);
  return { interior, lights: collectInteriorLights(interior.flats, () => ({ w: 1, h: 1 })) };
}

test('DARK-ROOM: The Howling Mug (MARKAA01.RMB #0) lays out its room and hangs no lamp - it is lit at DFU\'s ambient-only level, by day and by night; a tavern with lamps keeps the clock\'s ambient to the bit (mutant: every room at InteriorAmbientLight\'s 0.18)', { skip: skipReal }, () => {
  const mug = roomLights('MARKAA01.RMB', 0);
  assert.ok(mug.interior.placements.length > 0, 'a room with its furniture');
  assert.equal(mug.lights.length, 0, 'and no archive-210 flat: no lamp');
  assert.deepEqual([...roomAmbient(INTERIOR_AMBIENT, mug.lights)], [0.8, 0.8, 0.8], 'by day: InteriorAmbientLight_AmbientOnly');
  assert.deepEqual([...roomAmbient(INTERIOR_NIGHT_AMBIENT, mug.lights)], [0.5, 0.5, 0.5], 'by night: InteriorNightAmbientLight_AmbientOnly');
  const lit = roomLights('MAGEAA00.RMB', 0);   // the mages' hall interior.test.js pins: 17 lamps
  assert.equal(lit.lights.length, 17);
  assert.equal(roomAmbient(INTERIOR_AMBIENT, lit.lights), INTERIOR_AMBIENT, 'a lit room: the clock\'s day ambient, the same array');
  assert.equal(roomAmbient(INTERIOR_NIGHT_AMBIENT, lit.lights), INTERIOR_NIGHT_AMBIENT, 'and its night');
});

test('DARK-ROOM the law: DFU\'s own ambient-only pair (PlayerAmbientLight.cs:29-30); a lamp in the list counts as a lamp; none, or no list, is a room with none', () => {
  assert.deepEqual([...INTERIOR_AMBIENT_ONLY], [0.8, 0.8, 0.8]);
  assert.deepEqual([...INTERIOR_NIGHT_AMBIENT_ONLY], [0.5, 0.5, 0.5]);
  assert.equal(roomAmbient(INTERIOR_AMBIENT, [{ record: 24 }]), INTERIOR_AMBIENT);
  assert.equal(roomAmbient(INTERIOR_AMBIENT, null), INTERIOR_AMBIENT_ONLY);
  assert.equal(roomAmbient(INTERIOR_NIGHT_AMBIENT, []), INTERIOR_NIGHT_AMBIENT_ONLY);
});

test('DARK-ROOM by source: both interior hosts light the room through roomAmbient over the lamps the room was built with (AUDIT RPT1026 J1: never its live list) - the world\'s building (worldModes.js) and the ?interior bench (interior.js) - on the sky\'s night', () => {
  assert.ok(src('src/scenes/worldModes.js').includes('renderer.setLighting(new Float32Array(roomAmbient(isNight(skyMinutes() % 1440) ? INTERIOR_NIGHT_AMBIENT : INTERIOR_AMBIENT, interiorCtx.roomLamps)), 0);'));   // PIN MOVED (AUDIT RPT1026 J1): the lamps the room was built with
  assert.ok(src('src/scenes/interior.js').includes('renderer.setLighting(new Float32Array(roomAmbient(isNight(skyMinutes() % 1440) ? INTERIOR_NIGHT_AMBIENT : INTERIOR_AMBIENT, ctx.roomLamps)), 0);'));
});
