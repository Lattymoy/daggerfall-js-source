// HCC (2026-09-23): THE FOLLOWING, PINNED BY EXECUTION - systems/horseFollow.js's breadcrumb path, the follow
// controller over a fake flat world, the wagon's trail and the grounded pose, all read off HorseFollowController /
// HorseFollowPath / TrailingWagonRuntime's trail methods in TrailingWagon.dll's IL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HorseFollowPath, HorseFollowController, WagonTrail, groundedPoseStep, calculateFollowSpeed, observedPlayerSpeed, acceleratedFollowSpeed,
  shouldEnterCombatEvasion, isQualifyingThreatState, tryFindGround, isStepClear, isDirectPathClear, tryChooseGroundedStep,
  PATH_SAMPLE_DISTANCE, PATH_RETAINED_DISTANCE, PATH_SEED_BEHIND, THREAT_CLEARANCE, GENTLE_SPEED, NORMAL_SPEED, CATCH_UP_SPEED, STRONG_CATCH_UP_SPEED, STOP_TARGET_DISTANCE,
} from '../src/systems/horseFollow.js';
import { WAGON_FOLLOW_DISTANCE, TELEPORT_DISTANCE, RETAINED_TRAIL_DISTANCE, NORMAL_GROUND_OFFSET } from '../src/systems/horseCartLaw.js';
import { quatForward } from '../src/world/quat.js';

/** A flat world at y = groundY, with an optional wall the sphere cast refuses to cross, and threats. */
function flatPhys({ groundY = 0, wallX = null, threats = [] } = {}) {
  const w = { now: 0, threats };
  return {
    w,
    now: () => w.now,
    raycastAll: (o, d, max) => (d[1] < 0 && o[1] >= groundY && o[1] - groundY <= max ? [{ point: [o[0], groundY, o[2]], distance: o[1] - groundY, normal: [0, 1, 0] }] : []),
    sphereCastClear: (o, r, d, dist) => (wallX === null ? true : !((o[0] <= wallX && o[0] + d[0] * dist + r >= wallX) || (o[0] >= wallX && o[0] + d[0] * dist - r <= wallX))),
    threats: () => w.threats,
  };
}
const visual = () => ({ interactive: true, pose: null, get isInteractive() { return this.interactive; }, tryGetGroundedPose() { return this.pose; }, applied: [], applyFollowingPose(p, f, s) { this.applied.push({ p: [...p], f: [...f], s }); this.pose = { position: [...p], forward: [...f] }; } });

test('HCC follow: the breadcrumb path samples every 8 cm, keeps 45 m, re-seeds on a 20 m jump, and answers a point N metres behind', () => {
  const p = new HorseFollowPath();
  assert.equal(p.count, 0);
  assert.equal(p.record([0, 0, 0], [0, 0, 1]), false, 'the first record seeds');
  assert.equal(p.count, 2);
  assert.deepEqual(p.points[0], [0, 0, -PATH_SEED_BEHIND]);
  assert.equal(p.record([0, 0, 0.05], [0, 0, 1]), true, 'under a sample: kept, no new point');
  assert.equal(p.count, 2);
  for (let z = 0.1; z <= 10; z += 0.1) p.record([0, 0, z], [0, 0, 1]);
  const behind = p.tryGetPointBehind([0, 0, 10], 2.5);
  assert.ok(behind && Math.abs(behind.target[2] - 7.5) < 0.11, `2.5 m behind along the path: ${behind?.target}`);
  assert.ok(behind.pathForward[2] > 0.99, 'the path\'s forward there');
  const far = p.tryGetPointBehind([0, 0, 10], 100);
  assert.deepEqual(far.target, p.points[0], 'a path shorter than asked answers its oldest point');
  assert.equal(new HorseFollowPath().tryGetPointBehind([0, 0, 0], 1), null, 'no path, no point');
  assert.equal(p.tryGetPointBehind([0, 0, 10], -1), null, 'a negative distance is no point');
  p.record([0, 0, 40], [0, 0, 1]);
  assert.equal(p.count, 2, 'a 30 m jump re-seeds behind the player');
  const q = new HorseFollowPath();
  for (let z = 0; z <= 60; z += 0.5) q.record([0, 0, z], [0, 0, 1]);
  let kept = 0; for (let i = 1; i < q.points.length; i++) kept += Math.hypot(q.points[i][0] - q.points[i - 1][0], q.points[i][2] - q.points[i - 1][2]);
  assert.ok(kept <= PATH_RETAINED_DISTANCE + 0.5 && kept > PATH_RETAINED_DISTANCE - 1, `pruned to ~45 m: ${kept}`);
  q.seedBehind([0, 0, 0], [0, 0, 1], [0, 0, -3]);
  assert.deepEqual(q.points, [[0, 0, -3], [0, 0, 0]]);
  q.offset([1, 2, 3]); assert.deepEqual(q.points[1], [1, 2, 3]); assert.deepEqual(q.lastPlayerPosition, [1, 2, 3]);
  q.clear(); assert.equal(q.count, 0);
  assert.equal(PATH_SAMPLE_DISTANCE, 0.08);
});

test('HCC follow: the speeds - gentle within the follow distance, normal, catch-up at 6 m, strong at 12 m, and the accelerated-travel law', () => {
  assert.equal(calculateFollowSpeed(0.1, 1, false, 3), 0, 'at the target: stop');
  assert.ok(Math.abs(calculateFollowSpeed(0.2, 2.5, false, 3) - (GENTLE_SPEED + (NORMAL_SPEED - GENTLE_SPEED) * 0.2 / 3)) < 1e-9, 'just past the stop: near the gentle floor');
  assert.ok(Math.abs(calculateFollowSpeed(1.5, 2.5, false, 3) - (GENTLE_SPEED + (NORMAL_SPEED - GENTLE_SPEED) * 0.5)) < 1e-9, 'halfway to the follow distance: halfway between gentle and normal');
  assert.equal(calculateFollowSpeed(3, 4, false, 3), NORMAL_SPEED);
  assert.equal(calculateFollowSpeed(5, 6, false, 3), CATCH_UP_SPEED);
  assert.equal(calculateFollowSpeed(5, 9, false, 3), (CATCH_UP_SPEED + STRONG_CATCH_UP_SPEED) / 2, 'halfway from 6 to 12 m');
  assert.equal(calculateFollowSpeed(5, 13, false, 3), STRONG_CATCH_UP_SPEED);
  assert.equal(calculateFollowSpeed(2, 4, true, 3), 6, 'evading: 6');
  assert.equal(STOP_TARGET_DISTANCE, 0.18);
  assert.equal(observedPlayerSpeed([0, 0, 0], [3, 0, 4], 0.5, true), 10);
  assert.equal(observedPlayerSpeed([0, 0, 0], [3, 0, 4], 0.5, false), 0);
  assert.equal(observedPlayerSpeed([0, 0, 0], [3, 0, 4], 0, true), 0);
  assert.equal(acceleratedFollowSpeed(2.8, 0, 10, 3), 2.8);
  assert.equal(acceleratedFollowSpeed(2.8, 10, 3, 3), 12, 'the player\'s speed plus the 2 m/s floor');
  assert.equal(acceleratedFollowSpeed(2.8, 10, 23, 3), 22, 'plus 0.75 per metre of excess, capped at 12');
  assert.equal(acceleratedFollowSpeed(2.8, 10, 100, 3), 22);
  assert.equal(shouldEnterCombatEvasion(true, 1), true); assert.equal(shouldEnterCombatEvasion(false, 5), false); assert.equal(shouldEnterCombatEvasion(true, 0), false);
  assert.equal(isQualifyingThreatState(true, true, false, true, true), true);
  assert.equal(isQualifyingThreatState(true, true, true, true, true), false, 'an ally is no threat');
  assert.equal(isQualifyingThreatState(true, false, false, true, true), false); assert.equal(isQualifyingThreatState(true, true, false, false, true), false);
  assert.equal(isQualifyingThreatState(true, true, false, true, false), false); assert.equal(isQualifyingThreatState(false, true, false, true, true), false);
});

test('HCC follow: the ground probe, the sphere-cast step and the seven detour angles', () => {
  const phys = flatPhys({ groundY: 1 });
  assert.deepEqual(tryFindGround(phys, [3, 5, 4]), [3, 1, 4]);
  assert.equal(tryFindGround(flatPhys({ groundY: -100 }), [0, 0, 0]), null, 'beyond the 40 m probe');
  assert.equal(isStepClear(phys, [0, 1, 0], [1, 0, 0], 1), true);
  const walled = flatPhys({ wallX: 1.3 });
  assert.equal(isStepClear(walled, [0, 0, 0], [1, 0, 0], 1), false, 'the wall 1.3 m ahead: the 1.05 sweep plus the 0.35 body meets it');
  assert.equal(isStepClear(flatPhys({ wallX: 1.5 }), [0, 0, 0], [1, 0, 0], 1), true, 'a hair beyond the body: clear');
  assert.equal(isDirectPathClear(walled, [0, 0, 0], [5, 0, 0]), false);
  assert.equal(isDirectPathClear(phys, [0, 1, 0], [5, 1, 0]), true);
  const near = flatPhys({ wallX: 0.8 });
  const g = tryChooseGroundedStep(near, [0, 0, 0], [1, 0, 0], 0.5);
  assert.ok(g, 'a detour was found');
  assert.ok(g[0] < 0.8 - 0.35, 'and it does not cross the wall');
  assert.ok(Math.abs(g[2]) > 0.4, 'the first clear angle is 60 degrees off: a side step');
  assert.deepEqual(tryChooseGroundedStep(walled, [0, 0, 0], [1, 0, 0], 0.5), [0.5, 0, 0], 'a wall further off: straight ahead is clear');
  const cliff = flatPhys({ groundY: 0 });
  const orig = cliff.raycastAll;
  cliff.raycastAll = (o, d, max) => (Math.hypot(o[0], o[2]) > 0.2 ? [{ point: [o[0], 3, o[2]], distance: o[1] - 3, normal: [0, 1, 0] }] : orig(o, d, max));
  assert.equal(tryChooseGroundedStep(cliff, [0, 0, 0], [1, 0, 0], 0.5), null, 'a three-metre step up is refused on every angle');
});

test('HCC follow: the controller walks the horse along the player\'s path, stops behind them, and reports its speed', () => {
  const phys = flatPhys();
  const c = new HorseFollowController();
  assert.equal(c.isInitialized, false);
  c.begin(phys, [0, 0, -3], [0, 0, 1], [0, 0, 0], [0, 0, 1]);
  assert.equal(c.isInitialized, true);
  const v = visual(); v.pose = { position: [0, 0, -3], forward: [0, 0, 1] };
  const dt = 1 / 30;
  let z = 0;
  for (let i = 0; i < 300; i++) {
    z += 2.0 * dt; phys.w.now += dt;
    assert.equal(c.tick(phys, { position: [0, 1, z], forward: [0, 0, 1] }, v, 3, false, false, dt), true);
  }
  assert.ok(c.actualHorizontalSpeed > 0.5, `the horse is moving: ${c.actualHorizontalSpeed}`);
  assert.ok(c.position[2] < z && c.position[2] > z - 8, `behind the player: horse ${c.position[2]} player ${z}`);
  for (let i = 0; i < 300; i++) { phys.w.now += dt; c.tick(phys, { position: [0, 1, z], forward: [0, 0, 1] }, v, 3, false, false, dt); }
  assert.ok(Math.abs(z - c.position[2] - 3) < 0.6, `it settles about the follow distance behind: ${z - c.position[2]}`);
  assert.ok(c.actualHorizontalSpeed < 0.1, 'and stands still');
  assert.equal(c.position[1], 0, 'grounded on the flat');
  assert.ok(v.applied.length > 0 && v.applied.at(-1).s === c.actualHorizontalSpeed, 'the visual is posed every tick with the speed');
  v.interactive = false;
  const before = [...c.position];
  phys.w.now += dt;
  assert.equal(c.tick(phys, { position: [0, 1, z + 5], forward: [0, 0, 1] }, v, 3, false, false, dt), false, 'a visual that is not interactive is not driven');
  assert.deepEqual(c.position, before);
  c.offset([10, 0, 0]); assert.equal(c.position[0], before[0] + 10);
  c.resetTransient(); assert.equal(c.isInitialized, false);
});

test('HCC follow: a teleporting player re-seeds the path; a re-grounded visual far away snaps the controller to it', () => {
  const phys = flatPhys();
  const c = new HorseFollowController();
  c.begin(phys, [0, 0, -3], [0, 0, 1], [0, 0, 0], [0, 0, 1]);
  const v = visual(); v.pose = { position: [0, 0, -3], forward: [0, 0, 1] };
  const dt = 1 / 30;
  phys.w.now += dt; c.tick(phys, { position: [0, 1, 0.1], forward: [0, 0, 1] }, v, 3, false, false, dt);
  v.pose = { position: [100, 0, 100], forward: [0, 0, 1] };   // the stationary visual re-grounded elsewhere (a relocation)
  phys.w.now += dt; c.tick(phys, { position: [100, 1, 103], forward: [0, 0, 1] }, v, 3, false, false, dt);
  assert.ok(Math.abs(c.position[0] - 100) < 1 && Math.abs(c.position[2] - 100) < 1.5, `snapped to the visual: ${c.position}`);
});

test('HCC follow: combat evasion - a qualifying threat within 15 m sends the horse to a safe ring point, and it clears three seconds after the last', () => {
  const phys = flatPhys({ threats: [] });
  const c = new HorseFollowController();
  c.begin(phys, [0, 0, -3], [0, 0, 1], [0, 0, 0], [0, 0, 1]);
  const v = visual(); v.pose = { position: [0, 0, -3], forward: [0, 0, 1] };
  const dt = 1 / 30;
  for (let i = 0; i < 30; i++) { phys.w.now += dt; c.tick(phys, { position: [0, 1, 0], forward: [0, 0, 1] }, v, 3, true, false, dt); }
  assert.equal(c.isCombatEvading, false);
  phys.w.threats = [[0, 0, -4]];   // a foe right by the horse
  for (let i = 0; i < 400; i++) { phys.w.now += dt; c.tick(phys, { position: [0, 1, 0], forward: [0, 0, 1] }, v, 3, true, false, dt); }
  assert.equal(c.isCombatEvading, true);
  const d = Math.hypot(c.position[0] - 0, c.position[2] + 4);
  assert.ok(d >= THREAT_CLEARANCE - 1, `it moved clear of the threat: ${d}`);
  assert.ok(c.isThreatSafe(c.position), 'and stands safe');
  phys.w.threats = [];
  for (let i = 0; i < 30; i++) { phys.w.now += dt; c.tick(phys, { position: [0, 1, 0], forward: [0, 0, 1] }, v, 3, true, false, dt); }
  assert.equal(c.isCombatEvading, true, 'still evading inside the three-second grace');
  phys.w.now += 3.1;
  c.tick(phys, { position: [0, 1, 0], forward: [0, 0, 1] }, v, 3, true, false, dt);
  assert.equal(c.isCombatEvading, false, 'clear after three seconds without a threat');
  phys.w.threats = [[0, 0, -4]];
  for (let i = 0; i < 20; i++) { phys.w.now += dt; c.tick(phys, { position: [0, 1, 0], forward: [0, 0, 1] }, v, 3, true, false, dt); }
  assert.equal(c.isCombatEvading, true);
  c.clearCombatEvasion(phys);
  assert.equal(c.isCombatEvading, false, 'the setting turned off clears it at once');
  for (let i = 0; i < 20; i++) { phys.w.now += dt; c.tick(phys, { position: [0, 1, 0], forward: [0, 0, 1] }, v, 3, false, false, dt); }
  assert.equal(c.isCombatEvading, false, 'and with avoidance off no threat matters');
});

test('HCC follow: the wagon\'s trail keeps 7 m, discards on a 20 m jump, and the grounded pose settles a metre over the ground, smoothed', () => {
  const t = new WagonTrail();
  assert.equal(t.isDiscontinuity([0, 0, 0]), true, 'nothing observed yet');
  t.seed([0, 0, 0], [0, 0, 1]);
  assert.equal(t.points.length, 2);
  assert.equal(t.isDiscontinuity([0, 0, 1]), false);
  assert.equal(t.isDiscontinuity([0, 0, TELEPORT_DISTANCE + 1]), true);
  for (let z = 0; z <= 20; z += 0.05) t.record([0, 1, z], [0, 0, 1]);
  let kept = 0; for (let i = 1; i < t.points.length; i++) kept += Math.hypot(...[0, 1, 2].map((k) => t.points[i][k] - t.points[i - 1][k]));
  assert.ok(kept <= RETAINED_TRAIL_DISTANCE + 0.1 && kept > RETAINED_TRAIL_DISTANCE - 0.5, `~7 m kept: ${kept}`);
  const tp = t.trailingPoint([0, 1, 20]);
  assert.ok(tp && Math.abs(tp.target[2] - (20 - WAGON_FOLLOW_DISTANCE)) < 0.1, `2.5 m behind: ${tp?.target}`);
  assert.equal(t.isDiscontinuity([0, 1, 20], [0, 1, -40]), true, 'the wagon itself 60 m away is a discontinuity');
  t.offset([0, 5, 0]); assert.equal(t.points[0][1], 6);
  t.clear(); assert.equal(t.points.length, 0);
  const phys = flatPhys();
  let w = { position: [0, 0, 0], rotation: [0, 0, 0, 1], active: false, lastValidPosition: [0, 0, 0], lastValidRotation: [0, 0, 0, 1], hasLastValid: false };
  w = groundedPoseStep(phys, w, [3, 5, 4], [0, 0, 1], 1 / 30);
  assert.equal(w.active, true, 'the first grounded pose shows at once');
  assert.deepEqual(w.position, [3, NORMAL_GROUND_OFFSET, 4], 'a metre over the ground along its normal');
  w = groundedPoseStep(phys, w, [3, 5, 14], [1, 0, 0], 1 / 30);
  assert.ok(w.position[2] > 4 && w.position[2] < 14, 'the position eases toward the new target');
  const f = quatForward(w.rotation);
  assert.ok(f[0] > 0.05 && f[0] < 0.99, 'the rotation slerps toward the new forward');
  const gone = groundedPoseStep(flatPhys({ groundY: -1000 }), w, [3, 5, 14], [1, 0, 0], 1 / 30);
  assert.equal(gone.active, true, 'no ground this frame: the last valid pose stands');
  const fresh = groundedPoseStep(flatPhys({ groundY: -1000 }), { ...w, hasLastValid: false, active: false }, [3, 5, 14], [1, 0, 0], 1 / 30);
  assert.equal(fresh.active, false, 'no ground and no last pose: nothing shows');
});
