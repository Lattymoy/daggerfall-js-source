// RESPAWN-GROUND (2026-09-30, FIELD BUGS 2026-09-30 - lumin's "Respawning high in the air after death": "Sometimes after
// I die, I respawn high in the air and then fall to the ground, dying again ... I was dying inside a dungeon and it would
// respawn me high above a nearby city"; itzHaikyuu and BEWP, "still happening"; bible/01-Overview/
// Field-Bugs-2026-09-30.md). Two faults, both of a death in a dungeon. The respawn read the pixel AFTER the exit, when
// playerTravelPixel no longer answers the dungeon's entrance and reads the dungeon's own coordinates through the open
// world's origin - a neighbour; and the teleport's awaited build ran frames that fed the dungeon-frame eye to the
// streamer, which moved the whole new world a pixel over mid-build, so the landing (reckoned on the pixel at its unmoved
// place) stood over nothing built and hung ARRIVAL_LIFT up: a 42-unit fall, 185 health. Driven through the REAL
// StreamingWorldState, Collider, floorLanding and PlayerMotor, with the host's own lines lifted off world.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { StreamingWorldState, worldCoordToMapPixel } from '../../src/world/streamingWorld.js';
import { TERRAIN_SIZE, HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE } from '../../src/world/terrain/terrainSampler.js';
import { floorLanding } from '../../src/player/enterExit.js';
import { Collider } from '../../src/player/collider.js';
import { PlayerMotor } from '../../src/player/motor.js';

const W = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
const between = (start, end, from = 0) => { const i = W.indexOf(start, from); assert.ok(i >= 0, start); const j = W.indexOf(end, i); assert.ok(j > i, end); return W.slice(i, j + end.length); };
const TRAVEL = between('function playerTravelPixel() {', '\n  }');
const HEIGHT = between('const heightAt = (x, z, terrainOnly = false) => {', '\n  };').replace('const heightAt = ', 'return ');
const TELEPORT = W.indexOf('  async function _teleportToPixel(');
const EYE = between('    const eye = walkMode ? player.pos : cam.pos;', '\n    }\n', TELEPORT);
const ARRIVAL_LIFT = Number(/const ARRIVAL_LIFT = (\d+);/.exec(W)[1]);
const ARRIVAL_REACH = Number(/const ARRIVAL_REACH = (\d+);/.exec(W)[1]);

const worldHeight = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;
const heightCell = TERRAIN_SIZE / (HEIGHTMAP_DIMENSION - 1);
/** The host's own ground over `built` (its heightAt, lifted) - one flat pixel at `h` a build. */
function ground(state) {
  const built = new Map();
  const heightAt = new Function('state', 'built', 'TERRAIN_SIZE', 'HEIGHTMAP_DIMENSION', 'heightCell', 'worldHeight', 'deepWaters', '_htT', HEIGHT)(
    state, built, TERRAIN_SIZE, HEIGHTMAP_DIMENSION, heightCell, worldHeight, null, [0, 0, 0]);
  const build = (px, py, h) => built.set(`${px},${py}`, { px, py, samples: new Float32Array(HEIGHTMAP_DIMENSION ** 2).fill(h / worldHeight) });
  return { heightAt, build, collider: new Collider(heightAt) };
}
/** The host's playerTravelPixel, lifted, over `modes`, `state` and a walking player. */
const travelPixel = (modes, state, player) => new Function('modes', 'state', 'walkMode', 'player', 'cam', 'worldCoordToMapPixel', `${TRAVEL}; return playerTravelPixel;`)(
  modes, state, true, player, null, worldCoordToMapPixel);
/** The teleport's new lines, lifted: the eye put on the new pixel. */
const standEye = (walkMode, player, cam) => new Function('walkMode', 'player', 'cam', 'TERRAIN_SIZE', `${EYE}\nreturn cam.pos;`)(walkMode, player, cam, TERRAIN_SIZE);

const D = { x: 300, y: 250 };   // the dungeon's pixel
const GROUND = 20;
const BODY = [-20, -3.5, 12];   // a death one block west of the dungeon's starting block - its own frame, signed

test('RESPAWN-GROUND the pixel: a dungeon death reads its pixel while the dungeon stands - the entrance - and never after the exit, when the same body reads as the neighbour west (mutants: the read put back after the exit)', () => {
  const r = W.slice(W.indexOf('  function respawnOnlinePlayer() {'), W.indexOf('\n  }\n', W.indexOf('  function respawnOnlinePlayer() {')));
  const read = r.indexOf('const px = ohReturn?.pixel ?? playerTravelPixel();');
  assert.ok(read > 0 && r.indexOf('const px = ohReturn?.pixel ?? playerTravelPixel();', read + 1) < 0, 'read once');
  assert.ok(read < r.indexOf('Promise.resolve().then('), 'before the rise is scheduled');
  assert.ok(read < r.indexOf('forceExitToExterior()'), 'before any exit');
  // why the order is the law: the body's own coordinates, read either side of the exit
  const state = new StreamingWorldState(3);
  state.init(D.x, D.y);
  const modes = { mode: 'dungeon' };
  const pixel = travelPixel(modes, state, { pos: [...BODY] });
  assert.deepEqual(pixel(), D, 'in the dungeon: its entrance');
  modes.mode = 'exterior';
  assert.deepEqual(pixel(), { x: D.x - 1, y: D.y }, 'after the exit: the neighbour');
});

test('RESPAWN-GROUND the landing: a teleport that leaves a dungeon stands the eye on the new pixel before its build is awaited - the frames of the wait move no world, and the arrival lands on the ground, billing no fall; an open-world eye is left where it is (mutants: the eye left in the dungeon\'s frame; every eye moved; the camera alone moved)', () => {
  const run = (fixed) => {
    const state = new StreamingWorldState(3);
    const g = ground(state);
    state.init(D.x, D.y);   // the dungeon's pixel, where the respawn now lands
    const motor = new PlayerMotor(g.collider);
    motor.spawn(...BODY);
    const cam = { pos: [BODY[0], BODY[1] + 1.6, BODY[2]] };
    const player = { pos: motor.pos, spawn: (x, y, z) => motor.spawn(x, y, z), eyeAt: () => [motor.pos[0], motor.pos[1] + 1.6, motor.pos[2]] };
    if (fixed) cam.pos = standEye(true, player, cam);
    g.build(D.x, D.y, GROUND);   // the awaited first build publishes...
    const frame = state.update(cam.pos);   // ...while a frame of the wait feeds the streamer the eye
    // the landing: the pixel's centre, a pixel-local spot (locationLandingFor's frame too), dropped by the floor ray
    const raw = [TERRAIN_SIZE / 2, GROUND + state.compensation[1] + 2, TERRAIN_SIZE / 2];
    const pos = floorLanding(g.collider, raw, ARRIVAL_REACH, ARRIVAL_LIFT);
    g.build(state.current.x, state.current.y, GROUND);   // whatever stands under the eye builds a moment later
    motor.spawn(pos[0], pos[1], pos[2]);
    let fell = 0;
    for (let i = 0, stood = 0; i < 2000 && stood < 5; i++) {   // the landing is billed the frame after the feet touch
      motor.update(1 / 60, { forward: 0, strafe: 0 }, 0, 0);
      fell = Math.max(fell, motor.landedFallDistance || 0);
      stood = motor.grounded ? stood + 1 : 0;
    }
    return { moved: frame.pixelChanged, fell, feet: pos[1] };
  };
  const before = run(false);
  assert.equal(before.moved, true, 'the dungeon-frame eye moved the new world a pixel over');
  assert.ok(before.fell > 30, `and the arrival fell ${before.fell.toFixed(1)} units - the report's fall`);
  const after = run(true);
  assert.equal(after.moved, false, 'no world moves while it builds');
  assert.ok(Math.abs(after.feet - GROUND) < 1e-6, 'the arrival stands on the ground');
  assert.equal(after.fell, 0, 'and falls nowhere');
  // an eye already on the pixel - every open-world teleport - is not touched; a fly camera moves alone
  let spawned = 0;
  const onPixel = { pos: [100, 5, 700], spawn: () => { spawned++; }, eyeAt: () => [0, 0, 0] };
  const cam = { pos: [100, 6.6, 700] };
  assert.deepEqual(standEye(true, onPixel, cam), [100, 6.6, 700]);
  assert.equal(spawned, 0);
  assert.deepEqual(standEye(false, onPixel, { pos: [-5, 60, 12] }), [TERRAIN_SIZE / 2, 60, TERRAIN_SIZE / 2], 'the fly camera to the centre, its height kept');
  assert.equal(spawned, 0, 'and no body placed');
  // every side of the square: west, east, south, north - and its own two edges are on it
  for (const off of [[-0.01, 30], [TERRAIN_SIZE, 30], [30, -0.01], [30, TERRAIN_SIZE]]) {
    assert.deepEqual(standEye(false, onPixel, { pos: [off[0], 60, off[1]] }), [TERRAIN_SIZE / 2, 60, TERRAIN_SIZE / 2], `off the pixel at ${off}`);
  }
  for (const on of [[0, 0], [TERRAIN_SIZE - 0.01, TERRAIN_SIZE - 0.01]]) assert.deepEqual(standEye(false, onPixel, { pos: [on[0], 60, on[1]] }), [on[0], 60, on[1]], `on it at ${on}`);
});
