// BOOT-FREEZE (2026-10-20, bible/07-Rendering/Performance-Priority.md BOOT-FREEZE): the probe's reading of a CPU profile
// (tools/bootFreezeProbe.mjs longTasks) - the main thread's long tasks off the samples themselves, the first world frame
// found by its mark, and each task attributed by its stacks. Held on a profile made here: a task is a run of samples
// that are not (idle), closed by an idle gap longer than IDLE_GAP_MS and joined across a shorter one; the mark is where
// `__bootFreezeFirstFrame` was sampled; a function stands once a sample in its inclusive time however deep it recurses;
// the profile's bookkeeping frames are no function's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { longTasks } from '../../tools/bootFreezeProbe.mjs';

const W = 'http://localhost:5243/src/fixture/host.mjs', B = 'http://localhost:5243/src/fixture/reader.mjs';   // a profile's frames, no file of ours
const node = (id, functionName, url = '', children = [], lineNumber = 0) => ({ id, callFrame: { functionName, url, lineNumber }, children });
/** root -> (idle), (program), bootWorld -> getBlock -> getBlock (recursing), the mark, frame. */
const NODES = [
  node(1, '(root)', '', [2, 3, 4, 7, 8]),
  node(2, '(idle)'), node(3, '(program)'),
  node(4, 'bootWorld', W, [5], 10), node(5, 'getBlock', B, [6], 21), node(6, 'getBlock', B, [], 21),
  node(7, '__bootFreezeFirstFrame'), node(8, 'frame', W, [], 32),
];
/** Samples 1 ms apart from t = 0 (the profile's clock in microseconds). */
function profileOf(ids) {
  return { nodes: NODES, startTime: 5_000_000, samples: ids, timeDeltas: ids.map((_, i) => (i === 0 ? 0 : 1000)) };
}

test('BOOT-FREEZE longTasks: tasks split at an idle gap past IDLE_GAP_MS and join across a shorter one; the first world frame read off its mark; each task attributed (mutants: every gap a split; the mark never found; a recursing function counted twice; the bookkeeping counted as a function)', () => {
  // 0-1 idle | 2-6 boot (a 2 ms idle inside, joined) | 7-12 idle (6 ms: a split) | 13 mark | 14-16 frame | 17 idle
  const ids = [2, 2, 4, 5, 2, 6, 3, 2, 2, 2, 2, 2, 2, 7, 8, 8, 8, 2];
  const r = longTasks(profileOf(ids), { minTaskMs: 2, idleGapMs: 4, top: 10 });
  assert.equal(r.firstFrameAtMs, 13, 'the mark\'s sample');
  assert.equal(r.long.length, 2);
  const [boot, after] = r.long;
  assert.deepEqual([boot.atMs, boot.fromFirstMs, boot.ms], [2, -11, 5], 'the boot task, its short idle joined');
  assert.deepEqual(boot.inclusive, [['bootWorld src/fixture/host.mjs:11', 3], ['getBlock src/fixture/reader.mjs:22', 2]], 'getBlock once a sample however deep; (program) no function');
  assert.equal(boot.busyMs, 4);
  assert.deepEqual([after.atMs, after.fromFirstMs, after.ms], [13, 0, 4]);
  assert.deepEqual(after.inclusive.map(([k]) => k), ['frame src/fixture/host.mjs:33', '__bootFreezeFirstFrame']);
  assert.equal(r.frozenAfterFirstMs, 4);
  assert.deepEqual(r.boot.inclusive[0], ['bootWorld src/fixture/host.mjs:11', 3]);
  assert.deepEqual(r.afterFirst.inclusive[0], ['frame src/fixture/host.mjs:33', 3]);
});

test('BOOT-FREEZE longTasks: a profile with no mark is read whole as the boot, and says the first frame was not found (the probe\'s own judgement reads it)', () => {
  const r = longTasks(profileOf([4, 5, 6, 4, 2]), { minTaskMs: 1, idleGapMs: 4 });
  assert.equal(r.firstFrameAtMs, null);
  assert.equal(r.afterFirst, null);
  assert.equal(r.frozenAfterFirstMs, null);
  assert.equal(r.long[0].fromFirstMs, null);
  assert.equal(r.boot.busyMs, 4);
});
