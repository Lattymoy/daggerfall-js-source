// WAYOUT1 (the delve arc, 2026-10-05 - the player, on the dungeon blocks: "removing the esoteric nature of dungeons").
//
// THE WAY OUT ON THE COMPASS: the held map's walked trail walked back to the way in - a breadth-first field over the
// cells stood in, each walked teleporter an edge from its entrance to its exit - and the compass pointing at the farthest
// cell along it the eye can see (systems/wayOut.js, scenes/dungeonContext.js wayOutMark, ui/enhancedHud.js).
// bible/03-World/Delve-Arc.md, WAYOUT1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  WAY_PREF, WAY_MARK_CSS, WAY_STEP_DY, WAY_SNAP_M, WAY_LOOK_CELLS, WAY_HERE_M, WAY_FIELD_S, WAY_REFIELD_S,
  trailCells, nearestCell, wayField, wayPoint, createWayOut, cellColumn, stepKey, stepHitCuts, WAY_STEP_END_M,
} from '../src/systems/wayOut.js';
import { automapTrailTick, TRAIL_FILL_M, SCAN_INTERVAL_S, teleporterConnection } from '../src/systems/automap.js';
import { walkSpeed, runSpeed } from '../src/player/motor.js';
import { QUEST_MARK_CSS } from '../src/ui/questMarks.js';
import { FEATURES } from '../src/systems/features.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
/** A trail stood through the real tick: feet at each [x, y, z] (the eye 1.6 m above them, the tick's own height). */
function walk(points) {
  const rec = { trail: new Set() };
  for (const p of points) automapTrailTick(rec, [p[0], p[1] + 1.6, p[2]], 1.6);
  return rec.trail;
}
/** A corridor of cells along x from x0 to x1 at z, height y. */
const run = (x0, x1, z = 0, y = 0) => Array.from({ length: Math.abs(x1 - x0) + 1 }, (_, i) => [x0 + Math.sign(x1 - x0) * i + 0.5, y, z + 0.5]);
const ALL = () => true;

test('WAYOUT1: the constants', () => {
  assert.equal(WAY_PREF, 'dungeonWayOut');
  assert.deepEqual([WAY_STEP_DY, WAY_SNAP_M, WAY_LOOK_CELLS, WAY_HERE_M, WAY_FIELD_S, WAY_REFIELD_S, TRAIL_FILL_M], [1, 2.5, 14, 3, 1, 10, 3]);
  assert.notEqual(WAY_MARK_CSS, QUEST_MARK_CSS);
});

test('WAYOUT1: the trail\'s cells - the tick\'s own keys, at each cell\'s middle, indexed by column', () => {
  const t = walk([[0.2, 0, 0.2], [1.7, 0, 0.3], [1.9, 0.5, 0.1], [1.2, 6, 0.6]]);
  const c = trailCells(t);
  assert.deepEqual(c.pts, [[0.5, 0, 0.5], [1.5, 0, 0.5], [1.5, 0.5, 0.5], [1.5, 6, 0.5]]);
  assert.deepEqual(c.col.get(cellColumn(1, 0)), [1, 2, 3], 'three heights over one column');
  assert.notEqual(cellColumn(1, 0), cellColumn(0, 1));
  assert.notEqual(cellColumn(-1, 0), cellColumn(0, -1));
  assert.deepEqual(trailCells(new Set(['x,y,z', '1,2'])).pts, [], 'a key it cannot read is no cell');
  assert.deepEqual(trailCells(null).pts, []);
  // AUDIT DELVE B2: parsed once, added to - the cells already read are not read again
  const grow = new Set(['0,0,0', '1,0,0']);
  const cc = trailCells(grow);
  const first = cc.pts[0];
  grow.add('2,0,0');
  assert.equal(trailCells(grow, cc), cc);
  assert.equal(cc.pts.length, 3);
  assert.equal(cc.pts[0], first, 'the first cells kept, not re-parsed');
  assert.equal(cc.read, 3);
});

test('AUDIT DELVE: the trail is filled between the scan\'s samples - a run\'s 1.6 m step leaves no gap; a jump past TRAIL_FILL_M (a teleporter, a fall) fills nothing', () => {
  const rec = { trail: new Set() };
  automapTrailTick(rec, [0.5, 1.6, 0.5], 1.6);
  assert.equal(automapTrailTick(rec, [2.1, 1.6, 0.5], 1.6), true);
  assert.deepEqual([...rec.trail], ['0,0,0', '1,0,0', '2,0,0'], 'the cell between, stood in');
  automapTrailTick(rec, [3.4, 1.6, 1.9], 1.6);   // a diagonal: the cells it crosses
  assert.ok(rec.trail.has('3,0,1'));
  const far = { trail: new Set() };
  automapTrailTick(far, [0.5, 1.6, 0.5], 1.6);
  automapTrailTick(far, [0.5 + TRAIL_FILL_M + 0.1, 1.6, 0.5], 1.6);
  assert.equal(far.trail.size, 2, 'a jump past the fill is not walked');
  // a stair taken at a run: the heights between, in half-metre steps
  const st = { trail: new Set() };
  automapTrailTick(st, [0.5, 1.6, 0.5], 1.6);
  automapTrailTick(st, [2.5, 2.6, 0.5], 1.6);
  assert.deepEqual([...st.trail], ['0,0,0', '1,0.5,0', '2,1,0']);
});

test('WAYOUT1: the nearest cell, within the snap', () => {
  const c = trailCells(walk(run(0, 5)));
  assert.equal(nearestCell(c, [3.4, 0, 0.5]), 3);
  assert.equal(nearestCell(c, [3.4, 0, 2.5]), 3, 'two metres off the corridor');
  assert.equal(nearestCell(c, [3.4, 0, 3.5]), -1, 'past the snap');
  assert.equal(nearestCell(c, null), -1);
});

test('WAYOUT1: the field - a step within a metre of height, both ways; a teleporter from its entrance to its exit only', () => {
  // a corridor 0..5, a stair up from 5 (half a metre a cell) to a landing at 2 m, then a second corridor at 2 m
  const pts = [...run(0, 5), [6.5, 0.5, 0.5], [7.5, 1, 0.5], [8.5, 1.5, 0.5], [9.5, 2, 0.5], ...run(10, 14, 0, 2)];
  const c = trailCells(walk(pts));
  const exit = nearestCell(c, [0.5, 0, 0.5]);
  const f = wayField(c, exit);
  const far = nearestCell(c, [14.5, 2, 0.5]);
  let i = far, steps = 0;
  while (i !== exit && steps < 100) { i = f.next[i]; steps++; }
  assert.equal(i, exit, 'the far end walks back down the stair to the way in');
  assert.equal(steps, 14);
  // a cell a storey above, not joined by a stair, has no way out
  const cliff = trailCells(walk([...run(0, 3), [4.5, 3, 0.5], [5.5, 3, 0.5]]));
  const ff = wayField(cliff, nearestCell(cliff, [0.5, 0, 0.5]));
  assert.equal(ff.next[nearestCell(cliff, [5.5, 3, 0.5])], -1, 'a 3 m drop is no step');
  // a teleporter: the far room is reached only through it (entrance at 0..2's end, exit in a room at x 50)
  const tp = trailCells(walk([...run(0, 2), ...run(50, 53)]));
  const e = nearestCell(tp, [0.5, 0, 0.5]);
  const there = nearestCell(tp, [50.5, 0, 0.5]), here = nearestCell(tp, [2.5, 0, 0.5]);
  const back = wayField(tp, e, [[here, there]]);   // walked from here (0..2) out at there (50)
  assert.equal(back.next[nearestCell(tp, [53.5, 0, 0.5])], -1, 'the one-way teleporter does not lead back');
  const fwd = wayField(tp, e, [[there, here]]);   // a teleporter in the far room leading back to the way in's corridor
  const fromFar = nearestCell(tp, [53.5, 0, 0.5]);
  assert.notEqual(fwd.next[fromFar], -1, 'its entrance leads out');
  assert.equal(fwd.jump[there], 1, 'and that step is a jump');
  assert.equal(fwd.next[there], here);
  assert.deepEqual([...wayField(tp, -1).next].every((v) => v === -1), true, 'no way in, no field');
});

test('WAYOUT1: where the compass points - the farthest cell seen within the look, never past a jump', () => {
  const c = trailCells(walk(run(0, 30)));
  const f = wayField(c, nearestCell(c, [0.5, 0, 0.5]));
  const from = nearestCell(c, [30.5, 0, 0.5]);
  assert.deepEqual(wayPoint(c, f, from, ALL), [16.5, 0, 0.5], 'fourteen cells along');
  assert.deepEqual(wayPoint(c, f, from, (p) => p[0] > 25), [25.5, 0, 0.5], 'the farthest it can see');
  assert.deepEqual(wayPoint(c, f, from, (p) => p[0] > 25 || p[0] < 20), [16.5, 0, 0.5], 'the farthest it can see, past a stretch it cannot (a corridor that turns back into sight)');
  assert.deepEqual(wayPoint(c, f, from, () => false), [29.5, 0, 0.5], 'seeing none, the first step');
  assert.equal(wayPoint(c, f, -1, ALL), null);
  assert.deepEqual(wayPoint(c, f, nearestCell(c, [0.5, 0, 0.5]), ALL), [0.5, 0, 0.5], 'at the way in itself: its own cell');
  // a jump: the mark stands on the teleporter until it is taken
  const tp = trailCells(walk([...run(0, 2), ...run(50, 60)]));
  const fld = wayField(tp, nearestCell(tp, [0.5, 0, 0.5]), [[nearestCell(tp, [55.5, 0, 0.5]), nearestCell(tp, [2.5, 0, 0.5])]]);
  assert.deepEqual(wayPoint(tp, fld, nearestCell(tp, [60.5, 0, 0.5]), ALL), [55.5, 0, 0.5]);
  assert.deepEqual(wayPoint(tp, fld, nearestCell(tp, [55.5, 0, 0.5]), ALL), [55.5, 0, 0.5], 'standing on it, it is under the player');
});

test('WAYOUT1: the host\'s reader - gone at the way in, the crow\'s line with no walked way, the field kept while the trail is', () => {
  const w = createWayOut();
  const trail = walk(run(0, 20));
  const exitAt = [0.5, 0, 0.5];
  assert.equal(w.aim(trail, null, exitAt, [2, 0, 0.5], ALL, 0), null, 'within three metres of the way in');
  assert.deepEqual(w.aim(trail, null, exitAt, [20.5, 0, 0.5], ALL, 0), [6.5, 0.5], 'along the trail');
  assert.deepEqual(w.aim(new Set(), null, exitAt, [20.5, 0, 0.5], ALL, 0), [0.5, 0.5], 'no trail (another run\'s record, at once): the way in, as the crow flies');
  assert.equal(w.aim(trail, null, null, [5, 0, 0], ALL, 0), null);
  assert.equal(w.aim(trail, null, exitAt, null, ALL, 0), null);
  // the field is rebuilt when the trail grows, but not more than once a second
  const v = createWayOut();
  const t2 = walk(run(0, 10));
  v.aim(t2, null, exitAt, [10.5, 0, 0.5], ALL, 0);
  for (const p of run(11, 30)) automapTrailTick({ trail: t2 }, [p[0], 1.6, p[2]], 1.6);
  assert.deepEqual(v.aim(t2, null, exitAt, [30.5, 0, 0.5], ALL, 0.5), [0.5, 0.5], 'within the second: the old field, which has no cell here (the crow)');
  assert.deepEqual(v.aim(t2, null, exitAt, [30.5, 0, 0.5], ALL, 1.2), [16.5, 0.5], 'after it: rebuilt');
  // a walked teleporter is read off the record's own shape
  const tp = walk([...run(0, 2), ...run(50, 60)]);
  const portals = [{ entrance: { pos: [55.5, 0.5, 0.5] }, exit: { pos: [2.5, 0.5, 0.5] } }];
  assert.deepEqual(createWayOut().aim(tp, portals, exitAt, [60.5, 0, 0.5], ALL, 0), [55.5, 0.5]);
});

/** A walk through the REAL tick at `speed` m/s, sampled every SCAN_INTERVAL_S: along `legs` ([x, y, z] corners). */
function tickWalk(legs, speed) {
  const rec = { trail: new Set() };
  const step = speed * SCAN_INTERVAL_S;
  let at = legs[0].slice();
  automapTrailTick(rec, [at[0], at[1] + 1.6, at[2]], 1.6);
  for (const to of legs.slice(1)) {
    for (;;) {
      const d = Math.hypot(to[0] - at[0], to[1] - at[1], to[2] - at[2]);
      if (d <= step) { at = to.slice(); automapTrailTick(rec, [at[0], at[1] + 1.6, at[2]], 1.6); break; }
      at = at.map((v, k) => v + (to[k] - v) * (step / d));
      automapTrailTick(rec, [at[0], at[1] + 1.6, at[2]], 1.6);
    }
  }
  return rec.trail;
}

test('AUDIT DELVE (B1/C1/E3): through the real tick at the motor\'s own speeds, an L-shaped corridor walked or run is a way out along it - never the crow\'s line through the wall', () => {
  const legs = [[0.5, 0, 0.5], [30.5, 0, 0.5], [30.5, 0, 30.5]];   // 30 m east, then 30 m north
  const exitAt = [0.5, 0, 0.5], feet = [30.5, 0, 30.5];
  const speeds = [walkSpeed(50), walkSpeed(100), runSpeed(50, 50), runSpeed(100, 100)];
  assert.ok(runSpeed(50, 50) * SCAN_INTERVAL_S > 1.5, 'a run\'s sample is more than a cell from the last');
  for (const v of speeds) {
    const trail = tickWalk(legs, v);
    const c = trailCells(trail);
    const f = wayField(c, nearestCell(c, exitAt));
    const reached = [...f.next].filter((x) => x >= 0).length;
    assert.equal(reached, c.pts.length, `${v.toFixed(2)} m/s: every cell walks out`);
    const aim = createWayOut().aim(trail, null, exitAt, feet, (p) => p[0] > 30, 0);   // the corner's wall: only the north leg in sight
    assert.equal(aim[0], 30.5, `${v.toFixed(2)} m/s: the mark turns the corner the player turned, down the north leg`);
    assert.ok(aim[1] > 1, `${v.toFixed(2)} m/s: not the way in itself`);
  }
  // and a stair run down at 45 degrees: every tread a step
  const stair = tickWalk([[0.5, 0, 0.5], [10.5, 0, 0.5], [20.5, 10, 0.5]], runSpeed(50, 50));
  const sc = trailCells(stair);
  const sf = wayField(sc, nearestCell(sc, exitAt));
  assert.notEqual(sf.next[nearestCell(sc, [20.5, 10, 0.5])], -1, 'the top of the stair walks down');
});

test('AUDIT DELVE C4: the field\'s steps - diagonal, a metre up but not a metre and a half, the same column a little up; two storeys within the snap are told apart by height', () => {
  const diag = trailCells(new Set(['0,0,0', '1,0,1', '2,0,2']));
  const df = wayField(diag, 0);
  assert.equal(df.next[2], 1, 'a diagonal is a step');
  assert.equal(df.next[1], 0);
  const up = trailCells(new Set(['0,0,0', '1,1,0', '2,2.5,0']));
  const uf = wayField(up, 0);
  assert.equal(uf.next[1], 0, 'a metre up is a step');
  assert.equal(uf.next[2], -1, 'a metre and a half is not');
  const col = trailCells(new Set(['0,0,0', '0,0.5,0', '0,1.5,0']));
  assert.deepEqual([...wayField(col, 0).next], [0, 0, 1], 'the same column, a little up: a ramp\'s cell over a cell');
  // two floors stacked 2 m apart: the snap is in three dimensions, so the feet find their own storey's cell
  const two = trailCells(new Set(['0,0,0', '1,0,0', '0,2,0', '1,2,0']));
  assert.equal(nearestCell(two, [1.5, 2, 0.5]), 3, 'the upper storey\'s cell');
  assert.equal(nearestCell(two, [1.5, 0, 0.5]), 1, 'the lower\'s');
  assert.equal(stepKey(3, 9), stepKey(9, 3), 'a step either way round is one');
});

test('AUDIT DELVE C4/C9: the reader - over the way in but a storey up is not there; a moved way in and a walked teleporter rebuild at once; reset forgets; a step the eye cannot see along at all is cut', () => {
  const trail = walk(run(0, 20));
  const exitAt = [0.5, 0, 0.5];
  const w = createWayOut();
  assert.equal(w.aim(trail, null, exitAt, [1.5, 0, 0.5], ALL, 0), null, 'at the way in');
  assert.deepEqual(w.aim(trail, null, exitAt, [1.5, 2.5, 0.5], ALL, 0), [0.5, 0.5], 'over it a storey up: not there, and the trail has no cell up here (the crow)');
  // the way in moved: rebuilt at once, whatever the clock says
  assert.deepEqual(w.aim(trail, null, exitAt, [20.5, 0, 0.5], ALL, 0), [6.5, 0.5]);
  assert.deepEqual(w.aim(trail, null, [20.5, 0, 0.5], [0.5, 0, 0.5], ALL, 0.1), [14.5, 0.5], 'the way in at the other end');
  // a teleporter walked after the field was built, both its ends already on the trail: rebuilt at once
  const tp = walk([...run(0, 2), ...run(50, 60)]);
  const v = createWayOut();
  assert.deepEqual(v.aim(tp, [], exitAt, [60.5, 0, 0.5], ALL, 0), [0.5, 0.5], 'no teleporter yet: the crow');
  const portals = [teleporterConnection({ pos: [55.5, 0, 0.5] }, { pos: [2.5, 0, 0.5] }).conn];   // C7: the record's own shape, its offsets in
  assert.ok(portals[0].entrance.pos[1] !== 0 || portals[0].exit.pos[1] !== 0, 'the producer lifts its ends');
  assert.deepEqual(v.aim(tp, portals, exitAt, [60.5, 0, 0.5], ALL, 0.1), [55.5, 0.5], 'walked: the mark stands on the teleporter at once');
  // reset: the next aim reads the trail whole, at once - a field the trail outgrew is built again within the second
  const r = createWayOut();
  const rt = walk(run(0, 10));
  r.aim(rt, null, exitAt, [10.5, 0, 0.5], ALL, 0);
  for (const p of run(11, 30)) automapTrailTick({ trail: rt }, [p[0], 1.6, p[2]], 1.6);
  r.reset();
  assert.deepEqual(r.aim(rt, null, exitAt, [30.5, 0, 0.5], ALL, 0.1), [16.5, 0.5], 'reset, and read whole: not the old field\'s crow');
  // C9: two corridors a thin wall apart - z 0 and z 1, joined only at their far end (x 20) - and the player at the
  // start of the second: the grid makes every cell of one a neighbour of the other's; the host's static geometry says
  // which steps cross the wall, each asked once
  const pair = new Set([...walk(run(0, 20, 0)), ...walk(run(20, 0, 1))]);
  const wall = (p, q) => Math.floor(p[2]) === Math.floor(q[2]) || (p[0] > 19 && q[0] > 19);   // only at x 20 do they join
  let asks = 0;
  const counted = (p, q) => { asks++; return wall(p, q); };
  const cutter = createWayOut();
  const aim = cutter.aim(pair, null, exitAt, [3.5, 0, 1.5], ALL, 0, counted);
  assert.equal(aim[1], 1.5, 'the mark runs down the player\'s own corridor, not through the wall');
  assert.ok(aim[0] > 3.5, 'toward the far end where the two join');
  assert.deepEqual(createWayOut().aim(pair, null, exitAt, [3.5, 0, 1.5], ALL, 0)[1], 0.5, 'without the host\'s word, through the wall (the grid alone)');
  const first = asks;
  cutter.aim(pair, null, exitAt, [3.5, 0, 1.5], ALL, 5, counted);
  assert.equal(asks, first, 'each step asked once and kept');
  // a long trail is asked over a few builds: clear until asked
  // a wall is BETWEEN the cells: a hit near either end is the cell's own wall - a middle a little behind the face the
  // player walked along (the capsule's 0.35 in a one-metre cell: up to 0.15) - and nothing to cut
  assert.equal(WAY_STEP_END_M, 0.25);
  assert.ok(0.5 - 0.35 < WAY_STEP_END_M, 'the most a middle stands behind a wall square to the grid is inside the end');
  assert.equal(stepHitCuts(0.5, 1), true, 'the thin wall between two corridors');
  assert.equal(stepHitCuts(0.15, 1), false, 'the face the walked cell\'s middle stands behind');
  assert.equal(stepHitCuts(0.9, 1), false, 'and at the far end');
  assert.equal(stepHitCuts(0.7, Math.SQRT2), true, 'a diagonal step\'s middle');
  assert.equal(stepHitCuts(Infinity, 1), false, 'nothing met');
  const few = createWayOut({ stepAsks: 10 });
  assert.equal(few.aim(pair, null, exitAt, [3.5, 0, 1.5], ALL, 0, wall)[1], 0.5, 'ten asks: the far steps not yet asked, taken as clear');
  let t = 0, last = null;
  for (let k = 0; k < 40; k++) last = few.aim(pair, null, exitAt, [3.5, 0, 1.5], ALL, t += 1, wall);
  assert.equal(last[1], 1.5, 'asked over the builds that follow, it finds the way');
});

test('AUDIT DELVE B2: the field is built again only when the player stands off it, or every WAY_REFIELD_S while the trail grows under a player on it', () => {
  const trail = walk(run(0, 20));
  const exitAt = [0.5, 0, 0.5];
  const w = createWayOut();
  let asks = 0;
  const clear = () => { asks++; return true; };   // a build asks the new steps: the count says when one ran
  w.aim(trail, null, exitAt, [20.5, 0, 0.5], ALL, 0, clear);
  const first = asks;
  assert.ok(first > 0);
  for (const p of run(21, 25)) automapTrailTick({ trail }, [p[0], 1.6, p[2]], 1.6);
  // the player still on the old field: the trail grew, but the way it has is a way - no rebuild before WAY_REFIELD_S
  assert.deepEqual(w.aim(trail, null, exitAt, [20.5, 0, 0.5], ALL, 2, clear), [6.5, 0.5]);
  assert.equal(asks, first, 'on the field: not built again');
  assert.deepEqual(w.aim(trail, null, exitAt, [25.5, 0, 0.5], ALL, 2.5, clear), [11.5, 0.5], 'off it: rebuilt (a second since)');
  assert.ok(asks > first, 'off it: built again');
  // and every WAY_REFIELD_S while the trail grows under a player on it
  for (const p of run(26, 28)) automapTrailTick({ trail }, [p[0], 1.6, p[2]], 1.6);
  const before = asks;
  w.aim(trail, null, exitAt, [25.5, 0, 0.5], ALL, 2.5 + WAY_REFIELD_S - 0.1, clear);
  assert.equal(asks, before, 'not yet');
  w.aim(trail, null, exitAt, [25.5, 0, 0.5], ALL, 2.5 + WAY_REFIELD_S, clear);
  assert.ok(asks > before, 'the refield');
});

test('WAYOUT1: the dungeon hands the compass its way out once the way in is found; both HUD doors carry it', () => {
  const s = src('src/scenes/dungeonContext.js');
  assert.match(s, /if \(!isEnhanced\(\) \|\| getPref\(WAY_PREF\) === false \|\| !feet \|\| !eye \|\| !sm \|\| !automapRec\?\.entranceDiscovered\) \{ _wayAt = null; return null; \}/);
  assert.match(s, /_wayAt = wayOut\.aim\(automapRec\.trail, automapRec\.teleporters\?\.values\?\.\(\) \?\? null, \[sm\.x, sm\.y, sm\.z\], feet, sees, t, wayStepClear\);/);
  // AUDIT DELVE C9: a step asked of the dungeon's own geometry alone, waist high - a door or a mover walked through is no wall
  assert.match(s, /return !stepHitCuts\(collider\.raycast\(a, \[dx \/ len, dy \/ len, dz \/ len\], len, PROF_VEIN_ONLY\), len\);/);
  assert.match(s, /const PROF_VEIN_ONLY = Object\.freeze\(\{ only: Object\.freeze\(\['dungeon'\]\) \}\);/);
  assert.match(s, /wayOut: wayOutMark\(playerFeet, eye\),/);
  const hud = src('src/ui/hud.js');
  assert.match(hud, /gate = null, quest = null, wayOut = null, party = null,/);
  assert.match(hud, /wayOut: wayOut \?\? null,/);
  const eh = src('src/ui/enhancedHud.js');
  assert.match(eh, /drawWayOutMark\(opts\.wayOut \?\? null, opts\.playerXZ \?\? null, heading01\);/);
  assert.match(eh, /questMark: null, wayOutMark: null,/);
});

test('WAYOUT1: the Features row - Enhanced, on by default, the player\'s own online', () => {
  const f = FEATURES.find((x) => x.id === 'dungeon-way-out');
  assert.ok(f);
  assert.deepEqual(f.kinds, ['enhanced']);
  assert.deepEqual({ ...f.control }, { store: 'prefs', key: WAY_PREF, initial: true, online: 'player' });
});
