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
  WAY_PREF, WAY_MARK_CSS, WAY_STEP_DY, WAY_SNAP_M, WAY_LOOK_CELLS, WAY_HERE_M, WAY_FIELD_S,
  trailCells, nearestCell, wayField, wayPoint, createWayOut,
} from '../src/systems/wayOut.js';
import { automapTrailTick } from '../src/systems/automap.js';
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
  assert.deepEqual([WAY_STEP_DY, WAY_SNAP_M, WAY_LOOK_CELLS, WAY_HERE_M, WAY_FIELD_S], [1, 2.5, 14, 3, 1]);
  assert.notEqual(WAY_MARK_CSS, QUEST_MARK_CSS);
});

test('WAYOUT1: the trail\'s cells - the tick\'s own keys, at each cell\'s middle, indexed by column', () => {
  const t = walk([[0.2, 0, 0.2], [1.7, 0, 0.3], [1.9, 0.5, 0.1], [1.2, 6, 0.6]]);
  const c = trailCells(t);
  assert.deepEqual(c.pts, [[0.5, 0, 0.5], [1.5, 0, 0.5], [1.5, 0.5, 0.5], [1.5, 6, 0.5]]);
  assert.deepEqual(c.col.get('1,0'), [1, 2, 3], 'three heights over one column');
  assert.deepEqual(trailCells(new Set(['x,y,z', '1,2'])).pts, [], 'a key it cannot read is no cell');
  assert.deepEqual(trailCells(null).pts, []);
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

test('WAYOUT1: the dungeon hands the compass its way out once the way in is found; both HUD doors carry it', () => {
  const s = src('src/scenes/dungeonContext.js');
  assert.match(s, /if \(!isEnhanced\(\) \|\| getPref\(WAY_PREF\) === false \|\| !feet \|\| !eye \|\| !sm \|\| !automapRec\?\.entranceDiscovered\) \{ _wayAt = null; return null; \}/);
  assert.match(s, /_wayAt = wayOut\.aim\(automapRec\.trail, automapRec\.teleporters\?\.values\?\.\(\) \?\? null, \[sm\.x, sm\.y, sm\.z\], feet, sees, t\);/);
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
