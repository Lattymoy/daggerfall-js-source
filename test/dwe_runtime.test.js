// DW-E1 (2026-09-25) - ILIAC PUDDLE NO MORE 1.2.2's RUNTIME PLUMBING (jet082), PINNED:
// DeepWaterRuntime's transient reset, post-transition refresh and work gates, and TransientObjectTracker - what the
// fish, the foes, the loot and the decorations hang off. The expectations are the C#'s (clean/puddle/
// DeepWaterRuntime.cs, TransientObjectTracker.cs), spelled out here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  loadStarted, loadFinished, teleported, locationLoadBegan, locationLoadEnded, terrainUpdateBegan, terrainUpdateEnded,
  onTransientReset, setPostTransitionRefresh, canRunLightRuntimeWork, canRunHeavyRuntimeWork, loadGraceActive,
  canMutateTerrainData, pumpDeepWaterRuntime, postTransitionRefreshPending, resetDeepWaterRuntime,
  LOAD_GRACE_SECONDS, LOCATION_LOAD_STUCK_SECONDS,
} from '../src/world/deepWaterRuntime.js';
import { TransientObjectTracker } from '../src/world/deepWaterTransients.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('DW-E1: the work gates - light work while playing and no load runs; heavy work after the grace; terrain mutation also waits out a terrain pass (mutants: each gate)', () => {
  resetDeepWaterRuntime();
  assert.equal(canRunLightRuntimeWork(true), true);
  assert.equal(canRunLightRuntimeWork(false), false, 'IsPlayingGame false: no work at all');
  assert.equal(canRunHeavyRuntimeWork(0, true), true);
  assert.equal(loadGraceActive(0), false);
  loadStarted();
  assert.equal(canRunLightRuntimeWork(true), false, 'SaveLoadManager.LoadInProgress');
  assert.equal(canRunHeavyRuntimeWork(1e9, true), false);
  assert.equal(loadGraceActive(1e9), true);
  loadFinished(100);
  assert.equal(canRunLightRuntimeWork(true), true, 'the load landed');
  assert.equal(canRunHeavyRuntimeWork(100 + LOAD_GRACE_SECONDS - 0.01, true), false, 'heavy work waits the 1.5 s');
  assert.equal(canRunHeavyRuntimeWork(100 + LOAD_GRACE_SECONDS, true), true, 'realtime >= heavyWorkResumeTime');
  assert.equal(loadGraceActive(100 + LOAD_GRACE_SECONDS, false), true, 'not playing: the grace holds (CanRunHeavyRuntimeWork is false)');
  assert.equal(canMutateTerrainData(200, true), true);
  terrainUpdateBegan();
  assert.equal(canMutateTerrainData(200, true), false, 'a terrain pass is running');
  terrainUpdateEnded();
  locationLoadBegan(200);
  assert.equal(canMutateTerrainData(200, true), false, 'a location is loading');
  assert.equal(loadGraceActive(200 + LOCATION_LOAD_STUCK_SECONDS + 0.01), false, 'stuck past 12 s: the count is dropped');
  assert.equal(loadGraceActive(200), false, 'and stays dropped');
  locationLoadBegan(300); locationLoadEnded(); locationLoadEnded();
  assert.equal(loadGraceActive(300), false, 'an end without a begin never goes below zero');
  resetDeepWaterRuntime();
});

test('DW-E1: OnTransientReset - a load starting and a teleport reset the transition and tell every subscriber, in order; the refresh is pending after a teleport and a landed load, not a started one, and runs once terrain may be touched (mutants: the pending flags, the pump gate)', () => {
  resetDeepWaterRuntime();
  const heard = [];
  const offA = onTransientReset(() => heard.push('a'));
  const offB = onTransientReset(() => heard.push('b'));
  let refreshed = 0;
  setPostTransitionRefresh(() => refreshed++);
  try {
    locationLoadBegan(0);
    teleported(10);
    assert.deepEqual(heard, ['a', 'b'], 'every subscriber, in the order it subscribed');
    assert.equal(loadGraceActive(10), true, '1.5 s of grace');
    assert.equal(loadGraceActive(10 + LOAD_GRACE_SECONDS), false, 'the location count went with the reset');
    assert.equal(postTransitionRefreshPending(), true, 'a teleport leaves the refresh pending');
    pumpDeepWaterRuntime(10.5, true);
    assert.equal(refreshed, 0, 'not inside the grace');
    terrainUpdateBegan();
    pumpDeepWaterRuntime(20, true);
    assert.equal(refreshed, 0, 'not while a terrain pass runs');
    terrainUpdateEnded();
    pumpDeepWaterRuntime(20, false);
    assert.equal(refreshed, 0, 'not while the game does not play');
    pumpDeepWaterRuntime(20, true);
    assert.equal(refreshed, 1, 'RefreshPlayerArea, once');
    pumpDeepWaterRuntime(21, true);
    assert.equal(refreshed, 1, 'and not again');
    loadStarted();
    assert.deepEqual(heard, ['a', 'b', 'a', 'b']);
    assert.equal(postTransitionRefreshPending(), false, 'a started load clears it');
    loadFinished(30);
    assert.equal(postTransitionRefreshPending(), true, 'the landed load sets it');
    assert.deepEqual(heard, ['a', 'b', 'a', 'b'], 'OnLoad is no transient reset');
    offA();
    teleported(40);
    assert.deepEqual(heard.slice(4), ['b'], 'an unsubscribed listener hears nothing');
  } finally {
    offA(); offB(); setPostTransitionRefresh(null); resetDeepWaterRuntime();
  }
});

/** A tracked object at (x, 0, z). */
const obj = (x, z) => {
  const o = { x, z, dead: false, destroyedBy: 0, destroyed: () => o.dead, position: () => [o.x, 0, o.z], destroy: () => { o.dead = true; o.destroyedBy++; } };
  return o;
};

test('DW-E1: TransientObjectTracker - Add skips a null, Clear destroys the live, Release hands every one to the queue, Prune drops the dead and the far then the farthest past the cap (mutants: the flat distance, the cap loop, the dead-first rule)', () => {
  const t = new TransientObjectTracker();
  t.add(null);
  assert.equal(t.count, 0, 'Add: a null is not added');
  const a = obj(1, 0), b = obj(5, 0), c = obj(0, 9);
  t.add(a); t.add(b); t.add(c);
  b.dead = true;
  t.clear();
  assert.equal(t.count, 0);
  assert.deepEqual([a.destroyedBy, b.destroyedBy, c.destroyedBy], [1, 0, 1], 'Clear destroys only what is still there');

  const q = [];
  const d = obj(1, 1), e = obj(2, 2);
  e.dead = true;
  t.add(d); t.add(e);
  t.release((o) => q.push(o));
  assert.deepEqual(q, [e, d], 'Release queues every object, last first, the dead included');
  assert.equal(t.count, 0);

  // Prune: flat distance (y ignored) against the max, then the cap by distance
  const near = obj(3, 4), far = obj(30, 40), mid = obj(6, 8), mid2 = obj(-9, 0), gone = obj(1, 1);
  gone.dead = true;
  t.add(near); t.add(far); t.add(mid); t.add(gone); t.add(mid2);
  t.prune([0, 1000, 0], 49.9, 10);
  assert.equal(far.destroyedBy, 1, 'past 49.9 m flat: destroyed (the height 1000 m apart does not count)');
  assert.deepEqual(t.objects, [near, mid, mid2], 'the dead dropped, the far removed');
  t.prune([0, 0, 0], 100, 2);
  assert.deepEqual(t.objects, [near, mid2], 'over the cap of 2: the farthest (mid, 10 m) goes');
  assert.equal(mid.destroyedBy, 1);
  mid2.dead = true;
  const other = obj(0, 1);
  t.add(other);
  t.prune([0, 0, 0], 100, 5);
  assert.deepEqual(t.objects, [near, other], 'the first sweep drops the dead');
  t.objects.push(null);
  t.prune([0, 0, 0], 100, 1);
  assert.equal(t.count, 1, 'down to the cap');
  t.prune([0, 0, 0], 100, -3);
  assert.equal(t.count, 0, 'a negative cap is zero');
});

test('DW-E1: the world host drives the runtime - the terrain pass is the stream\'s busy spell, the pump runs after the deferred builds (pins)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const _dwPass = !!\(building \|\| queue\.length \|\| inFlight\.size\);\n\s+if \(_dwPass !== _dwTerrainPass\) \{ _dwTerrainPass = _dwPass; if \(_dwPass\) dwTerrainUpdateBegan\(\); else dwTerrainUpdateEnded\(\); \}\n\s+if \(deepWaters\.pump\(\) && dwDecor\) dwDecor\.refreshPlayerArea\(\);[^\n]*\n\s+pumpDeepWaterRuntime\(performance\.now\(\) \/ 1000, dwPlaying\(\)\);/);
  // IsPlayingGame: no window over the game - read late, because the gates are asked during boot's promotes, before the
  // talk host (the windows' owner) exists
  assert.match(w, /let _dwOverlayUp = \(\) => false;\n\s+const dwPlaying = \(\) => !_dwOverlayUp\(\);/);
  assert.match(w, /const gamePaused = \(\) => townTalk\.overlayActive \|\| \(modes\?\.overlayHeld \?\? false\);\n\s+_dwOverlayUp = \(\) => gamePaused\(\);/, 'AUDIT DW-F: every stack over the frame - IsPlayingGame asks of every window, a building\'s and a dungeon\'s too');
});
