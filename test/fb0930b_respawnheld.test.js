// RESPAWN-HELD (2026-09-30, FIELD BUGS 2026-09-30b - BrixBlox's "Spawned in the air after dying": "One time I died in a
// dungeon, and for some reason I respawned high enough in the air to kill me with fall damage"; bible/01-Overview/
// Field-Bugs-2026-09-30b.md). RESPAWN-GROUND stood the eye on the new pixel and read the right one, and the landing
// found the ground - but the FRAMES of the teleport's awaited build still stepped the motor. An outdoor death's screen
// holds it through the await (townTalk's slot outlives it); a dungeon's went with forceExitToExterior before the await,
// so the body, stood over the new pixel at the dungeon's own height, fell through the half-built world onto the models'
// colliders as each went in, and the frame billed the landing before the arrival's player.spawn. The frame now holds the
// motor while the arrival's latch is up. Driven through the REAL StreamingWorldState, Collider, PlayerMotor,
// floorLanding and applyFallLanding, with the host's own lines lifted off world.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { StreamingWorldState } from '../src/world/streamingWorld.js';
import { TERRAIN_SIZE, HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE } from '../src/world/terrainSampler.js';
import { floorLanding } from '../src/player/enterExit.js';
import { Collider } from '../src/player/collider.js';
import { PlayerMotor } from '../src/player/motor.js';
import { applyFallLanding, adjustFallStart } from '../src/scenes/shared.js';

const W = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
const between = (start, end, from = 0) => { const i = W.indexOf(start, from); assert.ok(i >= 0, start); const j = W.indexOf(end, i); assert.ok(j > i, end); return W.slice(i, j + end.length); };
const HEIGHT = between('const heightAt = (x, z, terrainOnly = false) => {', '\n  };').replace('const heightAt = ', 'return ');
const TELEPORT = W.indexOf('  async function _teleportToPixel(');
const TP = W.slice(TELEPORT, W.indexOf('\n  }\n', TELEPORT));
const EYE = between('    const eye = walkMode ? player.pos : cam.pos;', '\n    }\n', TELEPORT);
const HELD = /\n\s*const _seasonHeld = ([^;\n]+);/.exec(W);
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
/** The frame's hold, lifted: is the motor held with no re-skin hold and the arrival's latch up or down. */
const heldWhile = (straightening) => new Function('_seasonHoldKey', '_seasonStraightening', '_partyArrivalPending', `return ${HELD[1]};`)(null, straightening, false);
/** The teleport's RESPAWN-GROUND eye lines, lifted. */
const standEye = (player, cam) => new Function('walkMode', 'player', 'cam', 'TERRAIN_SIZE', `${EYE}\nreturn cam.pos;`)(true, player, cam, TERRAIN_SIZE);
/** A closed box's triangles, pixel-local - the dungeon's own entrance model (a keep, a tower, a ruin). */
function boxMesh(x0, y0, z0, x1, y1, z1) {
  const P = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
  const indices = [];
  for (const [a, b, c, d] of [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]]) indices.push(a, b, c, a, c, d);
  return { positions: new Float32Array(P.flat()), indices: new Uint32Array(indices) };
}
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

const D = { x: 300, y: 250 };   // the dungeon's pixel - a dungeon death's respawn lands on it
const H = 100;   // the pixel's ground, pixel-local
const KEEP = { at: TERRAIN_SIZE / 2, half: 30, tall: 18 };   // the entrance model at the location's centre
const COMP = -150;   // a vertical recentre the exterior carried in (a walk over the hills): ResetStreamingWorld keeps it

/**
 * One respawn out of a dungeon, 60 frames a second through the teleport's awaited build: the keep's collider goes in
 * between breaths at 0.6 s, the pixel publishes at 2.2 s and the landing follows in the same task. `held` is the
 * frame's answer while the arrival's latch is up.
 */
function respawn({ body, held, diedFalling = null }) {
  const state = new StreamingWorldState(3);
  state.compensation[1] = COMP;
  const g = ground(state);
  state.init(D.x, D.y);
  const motor = new PlayerMotor(g.collider);
  motor.spawn(...body);
  if (diedFalling) motor.restoreFall(diedFalling);   // a death mid-fall: the dungeon's death screen held the motor, so the fall rode it here
  const player = { get pos() { return motor.pos; }, spawn: (x, y, z) => motor.spawn(x, y, z), eyeAt: () => [motor.pos[0], motor.pos[1] + 1.6, motor.pos[2]] };
  let cam = { pos: player.eyeAt() };
  cam.pos = standEye(player, cam);
  const entity = { health: 60, maxHealth: 120 };   // reviveForPlay: half
  let lost = 0, fell = 0, modelIn = false, feet = null;
  const hurt = (n) => { lost += n; entity.health -= n; };
  const bill = () => { fell = Math.max(fell, motor.landedFallDistance || 0); applyFallLanding(entity, motor.landedFallDistance || 0, { hurt }); };
  for (let f = 0; f < 60 * 5; f++) {
    const t = f / 60;
    if (!modelIn && t >= 0.6) {
      const m = boxMesh(KEEP.at - KEEP.half, H, KEEP.at - KEEP.half, KEEP.at + KEEP.half, H + KEEP.tall, KEEP.at + KEEP.half);
      g.collider.addMesh(`${D.x},${D.y}`, m.positions, m.indices, IDENTITY, () => state.pixelTranslation(D.x, D.y, [0, 0, 0]));
      modelIn = true;
    }
    if (t >= 2.2) {   // built.set, then the teleport's tail: its floor ray from the edge of the location, beside the keep
      g.build(D.x, D.y, H);
      const pos = floorLanding(g.collider, [KEEP.at - KEEP.half - 12, H + state.compensation[1] + 2, KEEP.at], ARRIVAL_REACH, ARRIVAL_LIFT);
      motor.spawn(pos[0], pos[1], pos[2]);
      feet = pos[1];
      break;
    }
    // the world frame: the motor held or stepped, and a held frame bills nothing (holdFrame clears the report)
    if (held) motor.holdFrame();
    else motor.update(1 / 60, { forward: 0, strafe: 0 }, 0, 0);
    bill();
    cam = { pos: player.eyeAt() };
    const r = state.update(cam.pos);
    if (r.offset) { adjustFallStart(motor, r.offset[1]); motor.offsetOrigin(r.offset); }
  }
  for (let i = 0, stood = 0; i < 600 && stood < 5; i++) {   // the arrival stood a few frames: it lands where it was put
    motor.update(1 / 60, { forward: 0, strafe: 0 }, 0, 0);
    bill();
    stood = motor.grounded ? stood + 1 : 0;
  }
  return { fell, lost, dead: entity.health <= 0, feet, ground: H + COMP };
}

test('RESPAWN-HELD the latch: the arrival\'s latch is up from the teleport\'s first awaits until its build resolves, nothing is awaited between its drop and the landing, and the frame holds the motor - and bills no landing - while it is up; a dungeon death\'s respawn leaves the dungeon (and its screen\'s hold) before it awaits (mutant: the latch out of the hold)', () => {
  const up = TP.indexOf('_seasonStraightening = true;');
  const down = TP.indexOf('finally { _seasonStraightening = false; }');
  const landing = TP.indexOf('if (walkMode) { player.spawn(pos[0], pos[1], pos[2]); playerSpawned = true; }');
  assert.ok(up > 0 && down > up && landing > down, 'up, down, then the landing');
  assert.ok(TP.indexOf('await ') > up, 'the latch is up before the first await');
  assert.ok(!/\bawait\b/.test(TP.slice(down, landing).replace('resolveArrival ? await resolveArrival(pos) : null', 'null')), 'nothing awaited between the latch\'s drop and the landing - no frame steps a body the latch let go');
  assert.match(TP, /const resolved = resolveArrival \? await resolveArrival\(pos\) : null;/);
  assert.equal(new Function('_seasonHoldKey', '_seasonStraightening', '_partyArrivalPending', `return ${HELD[1]};`)(null, false, true), true, 'party validation also holds the motor');
  assert.equal(heldWhile(true), true, 'an arrival holds the motor');
  assert.equal(heldWhile(false), false, 'and nothing else here does');
  assert.match(W, /if \(_overlayHeld \|\| _seasonHeld \|\| _rideHeld\) player\.holdFrame\(\);/);   // PIN MOVED (WAGONS1): a rider's held motor too
  assert.match(W, /if \(!_overlayHeld && !_seasonHeld && !_rideHeld\) player\.update\(dt,/);
  assert.match(W, /if \(!_seasonHeld\) applyFallLanding\(playerEntity, player\.landedFallDistance,/);
  // why the dungeon needed it: its death screen is the mode's own, and the exit takes it before the await
  const r0 = W.indexOf('  function respawnOnlinePlayer() {');
  const r = W.slice(r0, W.indexOf('\n  }\n', r0));
  const exit = r.indexOf("if (mode !== 'exterior') modes?.forceExitToExterior();");
  assert.ok(exit > 0 && exit < r.indexOf('await _teleportToPixel(land.x, land.y'), 'the exit before the await');
});

test('RESPAWN-HELD the fall: a dungeon death whose height stands above the entrance\'s roof in the new world falls onto the keep mid-build and dies of it with the motor stepped; held, it arrives on the ground with nothing billed - and a death mid-fall carries none of its fall across (mutant: the latch out of the hold)', () => {
  const west = [-20, -3.5, 12];   // RESPAWN-GROUND's body: off the square, stood on its centre at the dungeon's height
  const over = [TERRAIN_SIZE / 2, -3.5, TERRAIN_SIZE / 2];   // already on the square (not re-stood), over the keep
  const before = respawn({ body: west, held: false });
  assert.ok(-3.5 > H + KEEP.tall + COMP, 'the dungeon\'s height stands above the keep\'s roof');
  assert.ok(before.fell > 20 && before.dead, `stepped: a ${before.fell.toFixed(1)}-unit fall onto the keep, ${before.lost} health - the report`);
  const after = respawn({ body: west, held: heldWhile(true) });
  assert.equal(after.fell, 0, 'held: no fall billed');
  assert.equal(after.lost, 0);
  assert.ok(Math.abs(after.feet - after.ground) < 1e-6, 'and the arrival stands on the ground');
  const falling = respawn({ body: over, held: heldWhile(true), diedFalling: { above: 16, velY: -17.9 } });
  assert.equal(falling.fell, 0, 'a death 16 units into a fall: the landing re-anchors it, nothing carried');
  assert.equal(falling.lost, 0);
  assert.ok(respawn({ body: over, held: false, diedFalling: { above: 16, velY: -17.9 } }).dead, 'stepped, the same death dies again');
});
