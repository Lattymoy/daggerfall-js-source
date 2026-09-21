import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  WAGON_MODEL, WAGON_REACH, OFFSET_LAST_SEED, SPAWN_BEHIND, FOLLOW_TRIGGER, TELEPORT_TRIGGER, FOLLOW_DISTANCE,
  PROBE_BACK, PROBE_UP, PROBE_DOWN, GROUND_LIFT, WOBBLE_SPEED, WAGON_INFO_TEXT,
  wobbleRoll, lookAtEuler, updateWagon, freshWagon, wagonMatrix, checkWagon, createEotbWagon, eotbWagon,
} from '../src/player/eotbWagon.js';
import { raceActivation } from '../src/player/activationRace.js';
import {
  mwViewFrame, mwViewRebase, mwViewDrawWagon, mwViewWagonTargets, mwViewWagonActivate, mwViewAttachWagon,
  setEotbBodyReady, setEotbPlayerState, eotbLane,
} from '../src/player/mwView.js';
import { eotbCamera } from '../src/player/eotbCamera.js';
import { mwCamera } from '../src/player/mwCamera.js';
import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { trs } from '../src/world/mat4.js';

// ═══ EOTB-IL: THE CART ═══════════════════════════════════════════════
//
// `SpawnWagon` / `UpdateWagon` / `CheckWagon`, the three rows the scope
// ledger carried as NOT DONE ("ShowCart, the wagon that follows") until
// the assembly was read. Every number here is an IL literal, cited in
// player/eotbWagon.js beside the law that carries it.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');
const r3 = (n) => Number(n.toFixed(3)) + 0;
const v3 = (v) => v.map(r3);

test('EOTB-IL wagon: the constants are the IL literals', () => {
  assert.equal(WAGON_MODEL, 41239);            // IL_1e4d, IL_1eef
  assert.equal(WAGON_REACH, 3.2);              // IL_1f00
  assert.deepEqual(OFFSET_LAST_SEED, [0, 0, -2.5]);   // IL_1e62-IL_1e71: Vector3.forward * -2.5
  assert.equal(SPAWN_BEHIND, 10);              // IL_1fa2
  assert.equal(FOLLOW_TRIGGER, 2.5);           // IL_1fe8
  assert.equal(TELEPORT_TRIGGER, 10);          // IL_1ff1
  assert.equal(FOLLOW_DISTANCE, 2.49);         // IL_2023
  assert.equal(PROBE_BACK, 0.6);               // IL_2054
  assert.equal(PROBE_UP, 2);                   // IL_2074
  assert.equal(PROBE_DOWN, 10);                // IL_2097
  assert.equal(GROUND_LIFT, 1);                // IL_20c4
  assert.equal(WOBBLE_SPEED, 10);              // IL_214a
  assert.equal(WAGON_INFO_TEXT, 'You see your wagon');   // IL_2280
});

test('EOTB-IL wagon: the wobble is sin(10t) times (3 + sin t), halved-and-lowered on a path', () => {
  // IL_2151-IL_2167: 2 + (sin t + 1); IL_217a-IL_2196: 1 + (sin t + 1) * 0.5; IL_2198-IL_21a8: sin(t * 10) * amp
  for (const t of [0, 0.3, 1, 2.7, 10.1]) {
    assert.equal(r3(wobbleRoll(t)), r3(Math.sin(t * 10) * (2 + (Math.sin(t) + 1))));
    assert.equal(r3(wobbleRoll(t, true)), r3(Math.sin(t * 10) * (1 + (Math.sin(t) + 1) * 0.5)));
  }
});

test('EOTB-IL wagon: LookAt gives Unity’s Euler - yaw atan2(x, z), pitch -asin(y) - in the order mat4.trs composes', () => {
  const z = (e) => ({ yaw: r3(e.yaw), pitch: r3(e.pitch) });
  assert.deepEqual(z(lookAtEuler([0, 0, 0], [0, 0, 5])), { yaw: 0, pitch: 0 });
  assert.equal(r3(lookAtEuler([0, 0, 0], [5, 0, 0]).yaw), 90);
  assert.equal(r3(lookAtEuler([0, 0, 0], [0, 5, 5]).pitch), -45, 'looking UP is a negative Unity pitch');
  assert.deepEqual(z(lookAtEuler([1, 1, 1], [1, 1, 1])), { yaw: 0, pitch: 0 }, 'a zero vector is the identity');
  // and the matrix built from it points +Z at the target: the third
  // column of trs(0,0,0, pitch, yaw, 0) is the forward
  const e = lookAtEuler([0, 0, 0], [3, 4, 0]);
  const m = trs(0, 0, 0, e.pitch, e.yaw, 0);
  assert.deepEqual(v3([m[8], m[9], m[10]]), v3([0.6, 0.8, 0]));
});

const frame = (over = {}) => ({ dt: 1 / 60, showCart: true, cart: true, bodyPos: [0, 0.9, 0], bodyForward: [0, 0, 1], onExteriorPath: false, raycast: null, ...over });

test('EOTB-IL wagon: off the setting or off the cart it is hidden and nothing else moves (IL_1f18-IL_1f39, IL_2225-IL_223e)', () => {
  let w = freshWagon();
  assert.equal(w.active, false);
  assert.equal(w.pos, null);
  const off = updateWagon(w, frame({ showCart: false }));
  assert.equal(off.active, false);
  assert.equal(off.pos, null);
  const foot = updateWagon(w, frame({ cart: false }));
  assert.equal(foot.active, false);
  // an active cart hides on foot, and its position is KEPT (SetActive(false) only)
  w = updateWagon(w, frame());
  assert.equal(w.active, true);
  const hidden = updateWagon(w, frame({ cart: false }));
  assert.equal(hidden.active, false);
  assert.deepEqual(hidden.pos, w.pos);
  assert.equal(wagonMatrix(hidden), null, 'and nothing draws');
});

test('EOTB-IL wagon: the first frame shows it ten metres behind the body, then it settles at 2.49 (IL_1f5e-IL_1fb1, IL_2023)', () => {
  const w = updateWagon(freshWagon(), frame({ bodyPos: [0, 0.9, 0], bodyForward: [0, 0, 1] }));
  assert.equal(w.active, true);
  // spawned at body - forward*10 = (0, 0.9, -10): |delta| = 10, not > 10,
  // so it FOLLOWS (far) along the delta to 2.49 behind
  assert.deepEqual(v3(w.pos), [0, 0.9, -2.49]);
  assert.equal(r3(w.yaw), 0, 'LookAt the body: facing +z');
  assert.equal(r3(w.pitch), 0);
  assert.notEqual(w.roll, 0, 'moving this frame, so it wobbles');
  assert.deepEqual(v3(w.offsetLast), [0, 0, 10], 'the offset remembered is the delta BEFORE the move (IL_21ef)');
});

test('EOTB-IL wagon: within 2.5 m it stays put, LookAt still runs and the roll is cleared (IL_1fe8, IL_2129-IL_213f)', () => {
  let w = updateWagon(freshWagon(), frame());
  const parked = w.pos;
  // the body steps 2 m sideways: |delta| = sqrt(4 + 2.49^2) ~ 3.19 > 2.5 -> follows.
  // a smaller step of 0.3 m: ~2.508 > 2.5 too. So step 0.2: ~2.498 < 2.5 -> stays
  w = updateWagon(w, frame({ bodyPos: [0.2, 0.9, 0] }));
  assert.deepEqual(w.pos, parked, 'no move under the trigger');
  assert.equal(w.roll, 0, 'LookAt cleared the roll');
  assert.equal(r3(w.yaw), r3(Math.atan2(0.2, 2.49) * 180 / Math.PI), 'but it turned to face the body');
  assert.deepEqual(v3(w.offsetLast), v3([0.2, 0, 2.49]), 'and the delta is still remembered');
});

test('EOTB-IL wagon: past ten metres the LAST offset is the direction, not the new delta (IL_2000-IL_200b, IL_21f6-IL_221f)', () => {
  let w = updateWagon(freshWagon(), frame());
  // offsetLast is now (0, 0, 10) from the spawn frame; a second frame at rest overwrites it with (0,0,2.49)
  w = updateWagon(w, frame());
  assert.deepEqual(v3(w.offsetLast), [0, 0, 2.49]);
  // the body teleports 50 m to +x: the cart keeps its OLD relative
  // direction (behind, along +z), so it lands at body - (0,0,1)*2.49
  w = updateWagon(w, frame({ bodyPos: [50, 0.9, 0] }));
  assert.deepEqual(v3(w.pos), [50, 0.9, -2.49]);
  assert.deepEqual(v3(w.offsetLast), [0, 0, 2.49], 'after a teleport the remembered offset is measured AFTER the move');
});

test('EOTB-IL wagon: the ground probe - 0.6 behind the cart’s own forward, 2 up, 10 down; the hit plus ONE metre, then 2.49 re-measured (IL_2034-IL_2115)', () => {
  let w = updateWagon(freshWagon(), frame());
  const casts = [];
  // ground at y = -3 under the target: the probe from y = 0.9 + 2 down finds it 5.9 away
  const raycast = (o, d, max) => { casts.push({ o: v3(o), d, max }); return 5.9; };
  w = updateWagon(w, frame({ bodyPos: [0, 0.9, 6], raycast }));
  assert.equal(casts.length, 1);
  assert.deepEqual(casts[0].d, [0, -1, 0]);
  assert.equal(casts[0].max, 10);
  // target before the probe: body - normalized(delta)*2.49 = (0, 0.9, 3.51); the cart faced +z (yaw 0) so the origin is 0.6 behind: z 2.91, y 2.9
  assert.deepEqual(casts[0].o, v3([0, 2.9, 3.51 - 0.6]));
  // grounded target y = (2.9 - 5.9) + 1 = -2; then re-measured 2.49 from the body toward (0, -2, 3.51)
  const d = [0 - 0, 0.9 - -2, 6 - 3.51];   // body - grounded
  const l = Math.hypot(...d);
  assert.deepEqual(v3(w.pos), v3([0 - d[0] / l * 2.49, 0.9 - d[1] / l * 2.49, 6 - d[2] / l * 2.49]));
  assert.ok(w.pitch < 0, 'and it looks UP at the body from below');
  // no hit: the target stands as measured
  const w2 = updateWagon(w, frame({ bodyPos: [0, 0.9, 12], raycast: () => null }));
  assert.equal(r3(w2.pos[1] - 0.9), r3((w.pos[1] - 0.9) / Math.hypot(w.pos[0], w.pos[1] - 0.9, w.pos[2] - 12) * 2.49), 'body - normalized(body - cart) * 2.49: the cart stays below');
});

test('EOTB-IL wagon: the wobble reads the exterior path and Unity’s clock (IL_2169-IL_2196)', () => {
  let a = updateWagon(freshWagon(), frame({ dt: 0.5 }));
  let b = updateWagon(freshWagon(), frame({ dt: 0.5, onExteriorPath: true }));
  assert.equal(r3(a.roll), r3(wobbleRoll(0.5, false)));
  assert.equal(r3(b.roll), r3(wobbleRoll(0.5, true)));
  assert.notEqual(r3(a.roll), r3(b.roll));
  assert.equal(a.time, 0.5, 'the clock is the sum of the frames');
});

test('EOTB-IL wagon: CheckWagon - Info names it, every other mode opens the pack with the wagon (IL_227d-IL_22a4)', () => {
  assert.equal(checkWagon('info'), 'info');
  for (const m of ['steal', 'grab', 'dialogue', undefined]) assert.equal(checkWagon(m), 'inventory');
  const said = [];
  let opened = 0;
  const w = createEotbWagon();
  assert.equal(w.activate('info', { say: (l) => said.push(l) }), 'info');
  assert.deepEqual(said, ['You see your wagon']);
  assert.equal(w.activate('grab', { openInventoryWithWagon: () => { opened += 1; } }), 'inventory');
  assert.equal(opened, 1);
});

test('EOTB-IL wagon: the machine - the body is feet + height/2 facing the yaw, the mesh comes from the host’s pipeline, the target is the mesh’s box', async () => {
  const w = createEotbWagon();
  const loads = [];
  const cpu = new Map([[41239, { positions: new Float32Array([-1, 0, -2, 1, 1, 2]) }]]);
  w.attach({ getGpuMesh: async (id) => { loads.push(id); return { id }; }, cpuModels: cpu });
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(loads, [41239], 'SpawnWagon builds model 41239');
  assert.deepEqual(w.targets(), [], 'inactive: nothing to pick');
  const s = w.tick(1 / 60, { feet: [0, 0, 0], yaw: Math.PI / 2, height: 1.8, cart: true });
  assert.equal(s.active, true);
  assert.deepEqual(v3(s.pos), v3([-2.49, 0.9, 0]), 'facing +x, the cart 2.49 behind at the capsule centre');
  const drawn = [];
  assert.equal(w.draw({ drawMesh: (g, m) => drawn.push([g, m]) }), true);
  assert.equal(drawn[0][0].id, 41239);
  const t = w.targets(76.8);
  assert.equal(t.length, 1);
  assert.equal(t[0].key, 'eotbWagon');
  assert.equal(t[0].distance, 76.8);
  assert.equal(t[0].reach, 3.2);
  assert.ok(t[0].aabb.min[0] < -2.49 && t[0].aabb.max[0] > -2.49, 'the box is the mesh’s, placed');
  // the setting off hides it
  setModSetting('eye-of-the-beholder', 'Graphics.ShowCart', false);
  try {
    assert.equal(w.tick(1 / 60, { feet: [0, 0, 0], yaw: 0, cart: true }).active, false);
  } finally { _resetModSettings(); }
  // the floating origin
  w.tick(1 / 60, { feet: [0, 0, 0], yaw: 0, cart: true });
  const before = w.state().pos;
  w.rebase([100, 0, 0]);
  assert.deepEqual(v3(w.state().pos), v3([before[0] + 100, before[1], before[2]]));
});

test('EOTB-IL wagon: the race - the cart is one more thing under the one ray, absent it changes nothing', () => {
  const at = (key, distance) => ({ key, distance, reach: 3.2 });
  const base = raceActivation({ corpse: at('c', 5), pile: at('p', 4), torch: at('t', 3), doorDistance: 6 });
  assert.equal(base.wagonWins, false);
  assert.equal(base.torchWins, true);
  assert.equal(base.nonPersonRival, 3);
  const w = raceActivation({ corpse: at('c', 5), pile: at('p', 4), torch: at('t', 3), wagon: at('w', 2), doorDistance: 6 });
  assert.equal(w.wagonWins, true);
  assert.equal(w.torchWins, false, 'the torch must beat the cart too');
  assert.equal(w.nonPersonRival, 2, 'and every other arm measures against it');
  const far = raceActivation({ torch: at('t', 3), wagon: at('w', 3.5), doorDistance: 6 });
  assert.equal(far.wagonWins, false);
  assert.equal(far.torchWins, true);
});

test('EOTB-IL wagon: through the seam - the view frame ticks it, the lane gates the three doors, the rebase moves it', () => {
  _resetModSettings();
  setEotbBodyReady(() => true);
  setEotbPlayerState(() => ({ motion: { height: 1.8, forward: 0, standing: true } }));
  mwCamera.restore({ firstPerson: true, baseDistance: mwCamera.baseDistance() });
  eotbCamera.loadSettings(null);
  eotbCamera.toggleOffset(false);
  const cpu = new Map([[41239, { positions: new Float32Array([-1, 0, -2, 1, 1, 2]) }]]);
  mwViewAttachWagon({ getGpuMesh: async () => ({ id: 41239 }), cpuModels: cpu });
  try {
    assert.equal(eotbLane(), true);
    const f = { fpEye: [0, 1.6, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, dt: 1 / 60, raycast: () => null };
    mwViewFrame({ ...f, cart: false });
    assert.equal(eotbWagon.state().active, false, 'on foot: no cart');
    assert.deepEqual(mwViewWagonTargets(76.8), []);
    mwViewFrame({ ...f, cart: true });
    assert.equal(eotbWagon.state().active, true, 'in first person too (LateUpdate runs UpdateWagon before the offset gate)');
    assert.deepEqual(v3(eotbWagon.state().pos), [0, 0.9, -2.49]);
    mwViewRebase([0, 0, 1000]);
    assert.deepEqual(v3(eotbWagon.state().pos), [0, 0.9, 997.51]);
    const said = [];
    assert.equal(mwViewWagonActivate('info', { say: (l) => said.push(l) }), 'info');
    assert.deepEqual(said, ['You see your wagon']);
    // the lane shut: no cart, no pick, no activation, no draw
    setEotbBodyReady(() => false);
    assert.deepEqual(mwViewWagonTargets(76.8), []);
    assert.equal(mwViewWagonActivate('info', {}), null);
    assert.equal(mwViewDrawWagon({ drawMesh() { throw new Error('drew off the lane'); } }), false);
  } finally {
    eotbWagon.reset();
    mwViewAttachWagon(null);
    setEotbBodyReady(null);
    setEotbPlayerState(null);
    eotbCamera.toggleOffset(false);
    _resetModSettings();
  }
});

test('EOTB-IL wagon: BOTH exterior hosts carry the three doors, and the interior hosts say why they do not', () => {
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = rd(host);
    assert.match(s, /mwViewAttachWagon\(\{ getGpuMesh, cpuModels \}\)/, `${host}: SpawnWagon's mesh through the host's pipeline`);
    assert.match(s, /cart: player\.transportMode === TRANSPORT_MODES\.Cart, onExteriorPath: _surfPath/, `${host}: UpdateWagon's two host facts on the frame`);
    assert.match(s, /_surfPath = !!_surf\.path;/, `${host}: OnExteriorPath from the frame's surface model`);
    assert.match(s, /mwViewDrawWagon\(renderer/, `${host}: drawn in the world pass`);
    assert.match(s, /const _wagonPick = pickActivatableHit\(cam\.pos, useFwd, mwViewWagonTargets\(RAY_DISTANCE\), collider\)/, `${host}: picked by the one ray`);
    assert.match(s, /wagon: _wagonPick,/, `${host}: raced`);
    assert.match(s, /if \(_race\.wagonWins\) \{ if \(_wagonPick\.distance > _wagonPick\.reach\) setMidScreenText\(TOO_FAR_AWAY_TEXT\); else mwViewWagonActivate\(getInteractionMode\(\), \{ say: [^}]+, openInventoryWithWagon: \(\) => townTalk\.showOverlay\(makeInventoryWindow\(EOTB_WAGON_PACK\)\) \}\); \}/,
      `${host}: CheckWagon's two arms, refusing out of reach as every family does`);
    assert.match(s, /const EOTB_WAGON_PACK = Object\.freeze\(\{ dungeon: Object\.freeze\(\{ wagonPrompt: true \}\) \}\);/, `${host}: AllowDungeonWagonAccess, as the dungeon's own door spells it`);
  }
  // the seam records why the interior hosts have no cart
  assert.match(rd('src/player/mwView.js'), /never exists inside/);
});
