// MW-D41 - THE PEGAS HORSE ASSEMBLY, pinned over the CRAFTED fixtures
// (the mod's own files are the player's and never enter this repo -
// the license IS the architecture; the real-data run is the MW-D
// staging law's, owed to the player's session). animated.nif carries
// exactly what the assembly consumes: a skinned rig with inline
// tracks and text-key groups, so it stands in for both the mesh and
// the .kf sides of the loose archive.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeLooseArchive } from '../src/scenes/dataSource.js';
import { loadPegasHorse, horseMeshPath, horseKfPath, HORSE_CLIPS, HORSE_SOUNDS } from '../src/systems/pegasHorse.js';

const ANIMATED = new Uint8Array(readFileSync(new URL('./fixtures/mw/animated.nif', import.meta.url)));

function stubRenderer(counts = {}) {
  counts.uploads = 0; counts.texes = 0; counts.freed = 0;
  return {
    gl: {
      deleteVertexArray: () => { counts.freed++; },
      deleteBuffer: () => { counts.freed++; },
      deleteTexture: () => { counts.freed++; },
    },
    createCharacterMesh: (packed, opts) => ({ vao: {}, buffers: [{}], floats: packed.length, opts }),
    createCharacterTexture: () => { counts.texes++; return {}; },
    updateCharacterMesh: () => { counts.uploads++; },
  };
}

const horseArchive = () => makeLooseArchive(new Map([
  [horseMeshPath(1), ANIMATED],
  [horseKfPath(1), ANIMATED],
]));

test('MW-D41: the assembly stands up over the archives seam and the clip drive deforms the mesh', () => {
  const counts = {};
  const r = stubRenderer(counts);
  const horse = loadPegasHorse({ renderer: r, archives: [horseArchive()], variant: 1 });
  assert.equal(horse.ok, true, `stage ${horse.stage}: ${horse.error ?? ''}`);
  assert.ok(horse.mesh.opts.uv, 'the character mesh carries UVs');
  assert.equal(horse.mesh.ranges.length, 1, 'one skinned piece, one range');
  assert.ok(horse.groups.some((g) => String(g).toLowerCase() === 'idle'), 'the clip index lists Idle');

  assert.equal(horse.setClip(HORSE_CLIPS.still), true, 'Idle arms');
  horse.advance(0.25);
  assert.equal(counts.uploads, 1, 'one re-upload per advance');
  // the fixture's Idle deliberately holds still; its Move group is the
  // deforming one - arm it and the skin must leave the pose behind
  assert.equal(horse.setClip('Move'), true, 'the moving group arms');
  const before = [...horse.mesh.ranges[0].piece.positions.slice(0, 6)];
  horse.advance(0.4);
  const after = [...horse.mesh.ranges[0].piece.positions.slice(0, 6)];
  assert.notDeepEqual(after, before, 'the skin moved under the clip');
  assert.equal(counts.uploads, 2);
});

test('MW-D41: a missing gait answers false and KEEPS the armed clip - the caller falls back a gait', () => {
  const r = stubRenderer();
  const horse = loadPegasHorse({ renderer: r, archives: [horseArchive()] });
  assert.equal(horse.setClip('Idle'), true);
  const st = horse.clipState;
  assert.equal(horse.setClip('Runforward'), false, 'the fixture has no run group');
  assert.equal(horse.clipState, st, 'the armed clip stands - no dead horse mid-ride');
  assert.equal(horse.group, 'Idle');
});

test('MW-D41: the missing-data law - no files, half the files, garbage files', () => {
  const r = stubRenderer();
  assert.equal(loadPegasHorse({ renderer: r, archives: [] }).stage, 'data', 'nothing attached');
  const meshOnly = makeLooseArchive(new Map([[horseMeshPath(1), ANIMATED]]));
  assert.equal(loadPegasHorse({ renderer: r, archives: [meshOnly] }).stage, 'data', 'no .kf, no horse');
  const garbage = makeLooseArchive(new Map([
    [horseMeshPath(1), new Uint8Array(64)],
    [horseKfPath(1), new Uint8Array(64)],
  ]));
  assert.equal(loadPegasHorse({ renderer: r, archives: [garbage] }).stage, 'parse', 'bad bytes fail loudly, never throw');
});

test('MW-D41: dispose frees what the build made', () => {
  const counts = {};
  const r = stubRenderer(counts);
  const horse = loadPegasHorse({ renderer: r, archives: [horseArchive()] });
  horse.dispose();
  assert.ok(counts.freed >= 2, 'vao and buffers freed');
});

test('MW-D41: the license IS the architecture - paths in the data-files frame, zero baked assets', () => {
  // the module may carry only CODE: the mod's meshes, coats and sounds
  // stay the player's own, resolved at runtime like ARENA2
  const src = readFileSync('src/systems/pegasHorse.js', 'utf8');
  assert.ok(src.length < 16000, 'no asset payload hides in the module');
  assert.ok(!/base64|fromCharCode|data:application/i.test(src), 'no encoded blobs');
  assert.equal(horseMeshPath(7), 'meshes/maxhorse/xhorse7.nif');
  assert.equal(horseKfPath(7), 'meshes/maxhorse/xhorse7.kf');
  for (const p of Object.values(HORSE_SOUNDS)) {
    assert.match(p, /^sound\/cr\/maxhorse\/[a-z0-9_]+\.wav$/, 'sound keys are canonical loose paths');
  }
  assert.deepEqual(Object.values(HORSE_CLIPS), ['Idle', 'Walkforward', 'Runforward'],
    'the gait map speaks the .kf\'s own group names');
});
