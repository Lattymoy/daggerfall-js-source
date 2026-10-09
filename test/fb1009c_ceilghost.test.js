// FIELD BUGS 2026-10-09c - CEIL-GHOST, the Discord's "Ghost companion isn't showing health bar - clipping into ceiling"
// ("Title says it all").
//
// A ghost is mobile 18, Spectral: the motor flies it. A following companion steers its feet at the leader's
// (enemyMotor.js _followTicks), and the flyers' floor lift - DFU's "Stop fliers from moving too near the floor during
// combat" - read a leader a hair below it as a descent and turned it up: it climbed till its feet were a metre off the
// floor or its body met the ceiling, its 2.6 m into the roof. Its bar stood 0.3 m over its top - over the ceiling - and
// the sight test hid it. The lift is combat's alone now (never while following), and the bar stands under the ceiling
// over the body (ui/navalHud.js crewBarPoint). `01-Overview/Field-Bugs-2026-10-09c.md`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EnemyAI } from '../src/characters/enemyMotor.js';
import { Collider } from '../src/player/collider.js';
import { runTargetMachine } from '../src/characters/enemyTargets.js';
import { crewBarPoint, CREW_BAR_LIFT, CREW_BAR_UNDER_CEILING, CREW_BAR_FROM } from '../src/ui/navalHud.js';

const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const UP = new Uint32Array([0, 1, 2, 0, 2, 3]), DOWN = new Uint32Array([0, 2, 1, 0, 3, 2]);
/** A floor at 0 and a ceiling at `ceil` (facing down). */
function passage(ceil) {
  const c = new Collider(() => -100);
  c.addMesh('floor', new Float32Array([-80, 0, -80, 80, 0, -80, 80, 0, 80, -80, 0, 80]), UP, I);
  if (ceil != null) c.addMesh('ceil', new Float32Array([-80, ceil, -80, 80, ceil, -80, 80, ceil, 80, -80, ceil, 80]), DOWN, I);
  return c;
}
const GHOST = 2.6;   // a ghost's body (its idle sprite's height; Spectral keeps the whole of it)

/** A companion of `behaviour` following a leader whose feet stand `dy` below the floor's own height - the frame's
 *  rounding, a rug, a step - walking 3 s and standing 2, for `seconds`; answers its highest feet. */
function follow(behaviour, dy, seconds, ceil = 3.4) {
  const ai = new EnemyAI(passage(ceil), [0, 0, 0], 0, { liveSpeed: 50, behaviour, height: GHOST, centreOffset: GHOST / 2 });
  ai.isHostile = false;
  const leader = [0, dy, 3], trail = [];
  ai.follow = { feet: () => leader, stop: 2.5, trail: () => trail };
  const body = { ai, entity: { team: 'PlayerAlly', mobileTeam: 'PlayerAlly', health: 20, basics: { team: 'PlayerAlly' } }, companion: 'k' };
  const senses = { gameMinutes: 0, playerStealth: 0, rolls: () => 0.5, targeting: (a, pf, dt) => runTargetMachine(body, [body], pf, dt, { infighting: true, playerEntity: { health: 100 } }) };
  let top = -Infinity, t = 0;
  for (let i = 0; i < 60 * seconds; i++) {
    const dt = 1 / 60; t += dt;
    if (t % 5 < 3) leader[2] += 5 * dt;
    const last = trail[trail.length - 1];
    if (!last || Math.hypot(leader[0] - last[0], leader[2] - last[2]) >= 0.75) trail.push([...leader]);
    ai.update(dt, leader, senses);
    top = Math.max(top, ai.feet[1]);
  }
  assert.ok(ai.feet[2] > 20, 'it followed');
  return top;
}

test('CEIL-GHOST: a ghost following a leader a millimetre or five centimetres below it keeps the floor - the floor lift is combat\'s (mutant: the lift while following)', () => {
  assert.ok(new EnemyAI(passage(3.4), [0, 0, 0], 0, { behaviour: 'Spectral', height: GHOST }).flies, 'a Spectral body is a flyer to the motor');
  for (const dy of [-0.001, -0.05]) {
    const top = follow('Spectral', dy, 12);
    assert.ok(top < 0.01, `its feet stayed on the floor (highest ${top.toFixed(3)} with the leader ${dy} m down) - not ${(3.4 - GHOST).toFixed(1)} m up, its top in the ceiling`);
  }
});

test('CEIL-GHOST: the bar stands CREW_BAR_LIFT over the body - and under the ceiling over it, never under CREW_BAR_FROM over the feet', () => {
  assert.deepEqual([CREW_BAR_LIFT, CREW_BAR_UNDER_CEILING, CREW_BAR_FROM], [0.3, 0.25, 0.2]);
  const feet = [1, 0, 2];
  assert.deepEqual(crewBarPoint(feet, GHOST, passage(null)), [1, GHOST + 0.3, 2], 'open sky: over its top');
  assert.deepEqual(crewBarPoint(feet, 1.8, passage(3.4)), [1, 2.1, 2], 'a ceiling over the bar\'s height is no matter');
  const under = crewBarPoint(feet, GHOST, passage(2.8));
  assert.ok(Math.abs(under[1] - (2.8 - CREW_BAR_UNDER_CEILING)) < 1e-6, `a ghost under a 2.8 m roof wears its bar at ${under[1]}, under the roof`);
  assert.equal(crewBarPoint([0, 0, 0], GHOST, passage(0.3))[1], CREW_BAR_FROM, 'never into the floor: a roof at its shins');
  assert.deepEqual(crewBarPoint(feet, GHOST, null), [1, GHOST + 0.3, 2], 'no collider asked: over its top');
});

test('CEIL-GHOST by source: the one bar drawer (world.js navalCrewBars - worldModes.js and dungeonContext.js call it, exterior.js stands no companion) stands each bar at crewBarPoint, in the place\'s own collider, and projects and sight-tests that point', () => {
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  const fn = w.slice(w.indexOf('function navalCrewBars('), w.indexOf('drawCrewBars(points,', w.indexOf('function navalCrewBars(')));
  assert.match(fn, /const head = crewBarPoint\(feet, f\.ai\.height \?\? CAPSULE_HEIGHT, player\.collider\);/);
  assert.match(fn, /projectToScreen\(head, /);
  assert.match(fn, /crewSight\.blocked\(player\.collider, eye, key, head\)/);
  assert.doesNotMatch(fn, /\+ 0\.3/, 'no second lift of its own');
});
