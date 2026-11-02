// FIELD BUGS 2026-10-01 part four (CLIMB-NODE) - found answering "minig is broken doesnt work": a vein stands at the
// foot of its rock (PROF2), and CLIMB2's free climb starts after Forward is held against any face for its start time
// (0.6 s, 0.3 s at Climbing 100; online always) - so a player who walked into the rock to reach the ore climbed it, and
// lost the target and the act. Asked, Mac chose "Hold it at nodes": while a profession's node is under the look (its
// prompt up) or an act plays, the walk-in start is held, and its count begins again when it lets go. A jump's grab
// and a mantle are a jump's, and are not held. The real motor over the real collider (test/player/climb2.test.js's wall), the
// hold as `parkourDeps` hands it, and the world host's own wiring read off its source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { PlayerMotor } from '../../src/player/motor.js';
import { Collider } from '../../src/player/collider.js';
import { freeStartSeconds } from '../../src/player/parkour.js';
import { parkourDeps } from '../../src/scenes/shared.js';

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const BOX_IDX = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
const boxAt = (x0, y0, z0, x1, y1, z1) => new Float32Array([x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]);
/** A floor and a rock face at z = 1 across the look (+z), `top` metres high. */
function wall(top) {
  const col = new Collider(() => -100);
  col.addMesh('floor', new Float32Array([-20, 0, -20, 20, 0, -20, 20, 0, 20, -20, 0, 20]), [0, 1, 2, 0, 2, 3], I);
  col.addMesh('rock', boxAt(-3, 0, 1, 3, top, 4), BOX_IDX, I);
  return col;
}
/** A motor at the rock's face, the enhanced climb on at Climbing 100, `hold` the parkour deps' own. */
function atRock(top, hold) {
  const m = new PlayerMotor(wall(top), { speed: 50, running: 30 }, { parkour: { enabled: () => true, inputs: () => ({ climbing: 100 }), say: () => {}, tally: () => {}, hold } });
  m.spawn(0, 0.02, 0.6);
  return m;
}
const STEP = 1 / 60;

test('CLIMB-NODE: the report - Forward held against the rock beside a vein starts no free climb while its node is under the look or an act plays; with none it climbs, as CLIMB2 does (mutants: the hold never asked; the hold read backwards)', () => {
  const start = freeStartSeconds(100);
  const steps = Math.ceil((start * 3) / STEP);
  let held = false;
  const free = atRock(6, () => false);
  for (let i = 0; i < steps; i++) { free.update(STEP, { forward: 1, strafe: 0, jump: false }, 0); held ||= free.onWall; }
  assert.equal(held, true, 'no node: Forward held three start-times climbs the face');
  const node = atRock(6, () => true);
  held = false;
  for (let i = 0; i < steps * 2; i++) { node.update(STEP, { forward: 1, strafe: 0, jump: false }, 0); held ||= node.onWall; }
  assert.equal(held, false, 'a node under the look: never, however long it is held');
});

test('CLIMB-NODE: the count begins again when the node lets go - a hold that ends late starts the climb a whole start time after, not at once (mutants: the count kept through the hold)', () => {
  const start = freeStartSeconds(100);
  let holding = false;
  const m = atRock(6, () => holding);
  // pressed into the rock for most of the start time, no node yet...
  const most = Math.floor((start * 0.8) / STEP);
  for (let i = 0; i < most; i++) m.update(STEP, { forward: 1, strafe: 0, jump: false }, 0);
  assert.equal(m.onWall, false, 'not yet');
  // ...then a node comes under the look and holds it well past the start time...
  holding = true;
  for (let i = 0; i < Math.ceil((start * 2) / STEP); i++) m.update(STEP, { forward: 1, strafe: 0, jump: false }, 0);
  assert.equal(m.onWall, false);
  // ...then the node lets go (the vein mined, the look turned): not a step later, a whole start time later
  holding = false;
  let at = -1;
  for (let i = 0; i < Math.ceil((start * 3) / STEP) && at < 0; i++) {
    m.update(STEP, { forward: 1, strafe: 0, jump: false }, 0);
    if (m.onWall) at = i;
  }
  assert.ok(at >= 0, 'it climbs once let go');
  assert.ok(at * STEP >= start - STEP * 2, `a start time after the hold (${(at * STEP).toFixed(2)} s of ${start} s)`);
});

test('CLIMB-NODE: a jump is not held - Forward and Jump at the face still grab it, and a low rock is still mantled, with the node under the look', () => {
  let grabbed = false;
  const g = atRock(6, () => true);
  for (let i = 0; i < 90; i++) { g.update(STEP, { forward: 1, strafe: 0, jump: i >= 10 && i < 40 }, 0); grabbed ||= g.onWall; }
  assert.equal(grabbed, true, 'the jump\'s grab takes the wall');
  let mantled = false;
  const low = atRock(1.2, () => true);
  for (let i = 0; i < 90; i++) { low.update(STEP, { forward: 1, strafe: 0, jump: i >= 10 && i < 40 }, 0); mantled ||= low.mantling; }
  assert.equal(mantled, true, 'the low rock is mantled');
});

test('CLIMB-NODE: the wiring - parkourDeps hands the host\'s hold through, and the world host holds while a node is targeted or an act plays; the fixed city and the standalone dungeon stand no nodes and pass none (mutants: the deps drop it; the host asks the act alone; the host asks the target alone)', () => {
  const e = { stats: { strength: 50, endurance: 50, agility: 50 }, skills: [], items: [], activeEffects: [] };
  const hold = () => true;
  assert.equal(parkourDeps(e, null, { hold }).hold, hold, 'handed through');
  assert.equal(parkourDeps(e).hold, null, 'none by default');
  const src = (p) => readFileSync(new URL(`../../src/scenes/${p}`, import.meta.url), 'utf8');
  assert.match(src('world.js'), /parkour: parkourDeps\(playerEntity, \(l\) => townTalk\?\.say\(l\), \{ hold: \(\) => !!gatherHost && \(gatherHost\.acting\(\) \|\| !!gatherHost\.target\) \}\) \}\);/);
  for (const host of ['exterior.js', 'dungeon.js']) assert.doesNotMatch(src(host), /parkourDeps\([^)]*hold/, `${host} passes no hold`);
});
