// SQUEEZE1 (2026-09-26, Ashley on the Discord: "have to kill a giant, its disappearing after a basically random amount
// of time entering the dungeon"). A giant's capsule is its idle sprite's height - 3.4 m is ordinary (SetupDemoEnemy) -
// and a quest giant is stood at a QuestSpawn marker, which is laid for a body the player's size. Under a ceiling lower
// than it, the collider's head push was the last word of every pass: it dragged the body's lower sphere under the
// floor, a hair a frame, and the giant fell out of the level. A doorway's lintel already stopped such a body, as DFU's
// CharacterController does; only a body already under the low ceiling sank. A body taller than any stance the player
// takes keeps its floor now (player/collider.js _resolveCapsule): its head stays in the ceiling, and it stands.
// Driven over the real collider, with made slabs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Collider } from '../src/player/collider.js';
import { RIDE_HEIGHT } from '../src/player/motor.js';

const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
/** A quad from four corners, both windings - a face is a face to the collider either way. */
function quad(c, key, a, b, d, e) {
  const p = new Float32Array([...a, ...b, ...d, ...e]);
  c.addMesh(key, p, new Uint32Array([0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]), I);
}
/** A floor at 0 and a ceiling at `ceil`, forty units square. */
function room(ceil) {
  const c = new Collider();
  quad(c, 'dungeon', [-20, 0, -20], [-20, 0, 20], [20, 0, 20], [20, 0, -20]);
  quad(c, 'dungeon', [-20, ceil, -20], [20, ceil, -20], [20, ceil, 20], [-20, ceil, 20]);
  return c;
}
/** A foe's motor, as enemyMotor.js drives it: gravity, reset on the ground, walking back and forth. */
function walk(c, feet, height, seconds, { vx = 2, turn = true, keepFloor = false } = {}) {
  const dt = 1 / 60;
  let velY = 0, lowest = feet[1], grounded = false;
  for (let i = 0; i < seconds * 60; i++) {
    velY = Math.max(-20, velY - 9.81 * dt);
    const dir = turn && i % 240 >= 120 ? -1 : 1;
    const r = c.move(feet, vx * dt * dir, velY * dt, 0, height, true, keepFloor);
    grounded = r.grounded;
    if (r.grounded) velY = 0;
    lowest = Math.min(lowest, feet[1]);
  }
  return { lowest, grounded };
}

test('SQUEEZE1: a body taller than its room stands on the floor - it sank a hair a frame and fell out of the level', () => {
  for (const [ceil, height] of [[3.0, 3.6], [2.6, 3.6], [2.2, 3.6], [2.6, 4.4], [3.2, 3.4]]) {
    const feet = [0, 0.001, 0];
    const { lowest, grounded } = walk(room(ceil), feet, height, 10);
    assert.ok(lowest > -0.01, `a ${height} body under a ${ceil} ceiling: lowest ${lowest.toFixed(3)} - it fell to -18`);
    assert.ok(Math.abs(feet[1]) < 0.01, `and stands on the floor after ten seconds (${feet[1].toFixed(3)})`);
    assert.equal(grounded, true, 'grounded, so its motor keeps no fall');
  }
});

test('SQUEEZE1: what the guard leaves alone - a room it fits, a fall to the floor, a doorway too low, the player\'s stances', () => {
  // it fits: it walks, on the floor
  const fits = [0, 0.001, 0];
  assert.ok(Math.abs(walk(room(4.2), fits, 3.6, 5).lowest) < 0.01);
  // dropped under the low ceiling from above the floor - not on a floor yet, so it falls to it, not held in the air
  const drop = [0, 0.8, 0];
  walk(room(3.0), drop, 3.6, 3, { vx: 0 });
  assert.ok(Math.abs(drop[1]) < 0.01, `it lands (${drop[1].toFixed(3)})`);
  // a room six high, a corridor three high past a lintel at x = 2: the lintel stops it, as DFU's controller's sweep does
  const c = new Collider();
  quad(c, 'dungeon', [-20, 0, -20], [-20, 0, 20], [40, 0, 20], [40, 0, -20]);
  quad(c, 'dungeon', [-20, 6, -20], [2, 6, -20], [2, 6, 20], [-20, 6, 20]);
  quad(c, 'dungeon', [2, 3, -20], [40, 3, -20], [40, 3, 20], [2, 3, 20]);
  quad(c, 'dungeon', [2, 3, -20], [2, 3, 20], [2, 6, 20], [2, 6, -20]);
  const giant = [-6, 0.001, 0], player = [-6, 0.001, 0];
  walk(c, giant, 3.6, 15, { vx: 3, turn: false });
  walk(c, player, 1.8, 15, { vx: 3, turn: false });
  assert.ok(giant[0] < 2 && Math.abs(giant[1]) < 0.01, `the giant waits at the doorway (${giant[0].toFixed(2)}, ${giant[1].toFixed(3)})`);
  assert.ok(player[0] > 30 && Math.abs(player[1]) < 0.01, 'the player walks on through');
  // the player's tallest stance is under the line: its resolve is the one it had
  assert.equal(RIDE_HEIGHT, 2.6);
  const col = readFileSync(new URL('../src/player/collider.js', import.meta.url), 'utf8');
  assert.match(col, /const tall = height > RIDE_HEIGHT \|\| !!this\._keepFloor;/, 'past the player\'s tallest stance - or any foe, by its motor\'s word (AUDIT pre-merge S2)');
  assert.match(col, /\} else this\._resolveSphere\(low, CAPSULE_RADIUS, out, standCeil, true\);/, 'a body the player\'s size resolves its lower sphere as it did');
  assert.match(col, /const floorFeet = tall && out\.hitCeiling \? lowFloor - CAPSULE_RADIUS : -Infinity;/);
  assert.match(col, /feet\[1\] = Math\.max\(entryY, floorFeet\); break;/, 'the too-tight revert takes no tall body under its floor');
});

test('AUDIT pre-merge S1: a floor-keeping body\'s head never grounds - the report\'s own giant, walked off a ledge under a flat ceiling, falls into the pit instead of walking on through the air (its head stood on the ceiling\'s top face)', () => {
  const c = new Collider();
  quad(c, 'dungeon', [-20, 0, -20], [-20, 0, 20], [0, 0, 20], [0, 0, -20]);   // the ledge
  quad(c, 'dungeon', [0, -3, -20], [0, -3, 20], [40, -3, 20], [40, -3, -20]);   // the pit's floor
  quad(c, 'dungeon', [0, -3, -20], [0, -3, 20], [0, 0, 20], [0, 0, -20]);   // the ledge's face
  quad(c, 'dungeon', [-20, 3, -20], [40, 3, -20], [40, 3, 20], [-20, 3, 20]);   // one flat ceiling over both
  const giant = [-6, 0.001, 0];
  walk(c, giant, 3.4, 20, { vx: 2, turn: false, keepFloor: true });
  assert.ok(!(giant[0] > 1 && giant[1] > -1), `never over the pit at the ledge's height (${giant[0].toFixed(2)}, ${giant[1].toFixed(2)}) - it walked there through the air`);
  assert.ok(giant[1] < -2.9 || giant[0] < 0.5, `in the pit, or held at its edge (${giant[0].toFixed(2)}, ${giant[1].toFixed(2)})`);
  const src = readFileSync(new URL('../src/player/collider.js', import.meta.url), 'utf8');
  assert.match(src, /this\._resolveSphere\(high, CAPSULE_RADIUS, out, standCeil, axis === 0, tall && axis !== 0\);/, 'the head a wall to a floor-keeping body, as a mid-body contact is');
});

test('AUDIT pre-merge S2: every FOE keeps its floor by its motor\'s word, whatever its height - a 1.8 to 2.6 m body under a lower ceiling sank and fell out of the level; the motor passes the flag at every move', () => {
  for (const [ceil, height] of [[2.0, 2.4], [1.8, 2.2], [2.2, 2.6], [1.5, 1.8]]) {
    const feet = [0, 0.001, 0];
    const { lowest, grounded } = walk(room(ceil), feet, height, 10, { keepFloor: true });
    assert.ok(lowest > -0.01, `a ${height} foe under a ${ceil} ceiling stays on its floor (lowest ${lowest.toFixed(3)})`);
    assert.equal(grounded, true);
  }
  const m = readFileSync(new URL('../src/characters/enemyMotor.js', import.meta.url), 'utf8');
  const sites = [...m.matchAll(/this\.collider\.move\(this\.feet,[^;]*\);/g)].map((x) => x[0]);
  assert.equal(sites.length, 6);
  for (const site of sites) assert.match(site, /, this\.height, true, FOE_KEEPS_FLOOR\);$/, site);
  assert.match(m, /const FOE_KEEPS_FLOOR = true;/);
  const c = readFileSync(new URL('../src/player/collider.js', import.meta.url), 'utf8');
  assert.match(c, /move\(feet, dx, dy, dz, height = CAPSULE_HEIGHT, snap = true, keepFloor = false\) \{\n\s*const was = this\._keepFloor;\n\s*this\._keepFloor = !!keepFloor;\n\s*try \{ return this\._move\(feet, dx, dy, dz, height, snap\); \} finally \{ this\._keepFloor = was; \}/, 'the player never passes it: its stances resolve as they did');
});
