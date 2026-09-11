// AUDIT 65 XL-1 (2026-09-11) - DFU HAS TWO SWIM MEMBERS, AND THE PORT
// HAD ONE.
//
// PlayerEnterExit carries `isPlayerSwimming` (:44, :177-178) and
// LevitateMotor carries `IsSwimming`, which IS PlayerMotor.IsSwimming
// (PlayerMotor.cs:149-152). Inside a dungeon the two are written
// together off one block-water test (PlayerEnterExit.cs:384-392).
// ABOVE GROUND they part company, and the else arm says so outright
// (:415-421):
//
//     if (GameManager.Instance.StreamingWorld.PlayerTileMapIndex != 0)
//         isPlayerSwimming = false;
//     isPlayerSubmerged = false;
//     levitateMotor.IsSwimming = false;
//
// - the motor's flag is cleared with NO tile test at all, so outdoors
// FixedUpdate's swim/levitate early return (:322-326) is never taken
// and the grounded path carries GetSwimSpeed (:387, AUDIT 64 F0's
// `sunk` gate).
//
// The port had only `player.swimming`, and OT1 wired the exterior
// latch into it. `swimming` is a SETTER that raises
// PlayerMotor.CancelMovement on every transition (LevitateMotor
// :34-43 / SetSwimming :174-182), so each render frame wrote two
// edges - shared.applyMotorEffectFlags false, then the host's true -
// and the frame's one fixed step spent the cancel and returned: over
// a real Collider floor at Speed 50 / Swimming 30 the exterior
// swimmer travelled 0.0000 over 600 steps at 60 Hz. The sea was a
// wall. Said exactly (the refuters' correction to the finder): the
// freeze is total while a render frame runs ONE fixed step, which is
// every ordinary frame rate; a hitch frame that accumulates two or
// three steps lets the later ones through, because only the first
// spends the cancel. It was never "cannot move under any condition",
// and the vertical half is a red herring - DFU gives an exterior
// swimmer no float control either, levitateMotor.IsSwimming being
// false above ground.
//
// XL-1 gives the motor DFU's second member: `isPlayerSwimming`, a
// plain FIELD beside `sunk` that `_step` never reads. The exterior
// hosts write THAT; `player.swimming` keeps shared.js's unconditional
// false, which is :421 itself; the dungeon arms write BOTH; and the
// IsPlayerSwimming readers - the fatigue/Swimming tally
// (PlayerEntity.cs:410), the encounter roll (:489), the exhaustion
// collapse (:2406/:2426), the rest refusal (DaggerfallUI.cs:661) and
// HeadBobber (:101/:215) - follow the member they actually read.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PlayerMotor } from '../src/player/motor.js';
import { Collider } from '../src/player/collider.js';
import { applyMotorEffectFlags } from '../src/scenes/shared.js';
import { exteriorSwimming } from '../src/player/exteriorSurface.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel) => readFileSync(join(root, rel), 'utf8');

// PlayerSpeedChanger's own arithmetic, from the C# constants - NOT the
// port's helpers, so the pin measures the port against the reference
// rather than against itself.
const DF_WALK_BASE = 150;                 // PlayerSpeedChanger.cs:31
const CLASSIC_TO_UNITY = 39.5;            // :30 classicToUnitySpeedUnitRatio
/** GetWalkSpeed (:389-393). */
const csWalkSpeed = (liveSpeed) => {
  const drag = 0.5 * (100 - (liveSpeed >= 30 ? liveSpeed : 30));
  return (liveSpeed + DF_WALK_BASE - drag) / CLASSIC_TO_UNITY;
};
/** GetSwimSpeed (:418-422). */
const csSwimSpeed = (baseSpeed, swimSkill) => baseSpeed * (swimSkill / 200) + baseSpeed / 4;

const I4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const quad = (ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz) =>
  ({ positions: [ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz], indices: [0, 1, 2, 0, 2, 3] });
/** A real Collider with a real floor mesh - the lake bed a DFU
 *  exterior swimmer is grounded on (Player-Arc: "the outdoor swimmer
 *  is grounded on the lake bed with the replacement motor
 *  disengaged"). */
function floorCollider() {
  const col = new Collider(() => 0);
  const f = quad(-200, 0, -200, 200, 0, -200, 200, 0, 400, -200, 0, 400);
  col.addMesh('floor', f.positions, f.indices, I4);
  return col;
}

const FORWARD = { forward: 1, strafe: 0, run: false, jump: false, up: false, down: false };
const NO_EFFECTS = { activeEffects: [] };

/**
 * The EXTERIOR HOST FRAME, in world.js's / exterior.js's own order:
 *   capture _wasSwimming -> applyMotorEffectFlags -> player.update(dt)
 *   -> player.onExteriorWater -> the exteriorSwimming write.
 * `target` selects which member the last step writes: 'host' is the
 * shipped law (PlayerEnterExit.isPlayerSwimming), 'motor' is OT1's
 * pre-XL-1 wiring (levitateMotor.IsSwimming) kept as the control.
 */
function swimHarness({ target, water, steps, warm = 0 }) {
  const m = new PlayerMotor(floorCollider(), { speed: 50, running: 30, swimming: 30 });
  m.pos = [0, 0, 0];
  m.grounded = true;
  const frame = () => {
    const was = !!(target === 'host' ? m.isPlayerSwimming : m.swimming);   // read BEFORE the clear
    applyMotorEffectFlags(m, NO_EFFECTS);                                   // shared.js: player.swimming = false (:421)
    m.update(1 / 60, FORWARD, 0);
    m.onExteriorWater = water;                                              // OnExteriorWaterMethod.Swimming
    const v = exteriorSwimming({ wasSwimming: was, sunk: !!m.sunk, unsunk: m.heightAction === 'unsink', tileIndex: water ? 0 : 5 });
    if (target === 'host') m.isPlayerSwimming = v;
    else m.swimming = v;
  };
  for (let i = 0; i < warm; i++) frame();   // settle: the sink arms on the second water frame
  const z0 = m.pos[2];
  for (let i = 0; i < steps; i++) frame();
  return { m, dz: m.pos[2] - z0 };
}

test('AUDIT 65 XL-1: the exterior swimmer TRAVELS - one second of forward is GetSwimSpeed, and the frame leaves no cancel pending', () => {
  const walk = csWalkSpeed(50);
  const swim = csSwimSpeed(walk, 30);
  assert.ok(Math.abs(walk - 4.4303797) < 1e-6, `GetWalkSpeed(50) = ${walk}`);
  assert.ok(Math.abs(swim - 1.7721519) < 1e-6, `GetSwimSpeed = ${swim}`);

  // Dry land first, so the harness itself is known to move.
  const dry = swimHarness({ target: 'host', water: false, steps: 60 });
  assert.ok(Math.abs(dry.dz - walk) < 1e-2, `dry: 60 steps travels GetWalkSpeed (${dry.dz})`);
  assert.equal(dry.m.sunk, false);

  // Deep water, from a settled state: one second of 1/60 steps covers
  // exactly GetSwimSpeed, and `speed` IS the swim speed - AUDIT 64 F0's
  // gate (PlayerMotor.cs:387) is reached because the motor's own flag
  // stayed false, which is :421.
  const wet = swimHarness({ target: 'host', water: true, steps: 60, warm: 5 });
  assert.equal(wet.m.sunk, true, 'DoSinking armed (controllerSink)');
  assert.equal(wet.m.isPlayerSwimming, true, 'PlayerEnterExit.isPlayerSwimming is up');
  assert.equal(wet.m.swimming, false, 'levitateMotor.IsSwimming is DOWN outdoors (:421, no tile test)');
  assert.ok(Math.abs(wet.dz - swim) < 1e-2, `water: 60 steps travels GetSwimSpeed (${wet.dz} vs ${swim})`);
  assert.ok(Math.abs(wet.m.speed - swim) < 1e-9, 'UpdateSpeed wrote the swim speed into the field');
  // No double edge: a steady-state water frame leaves nothing for the
  // next fixed step to spend (PlayerMotor.cs:286-294).
  assert.equal(wet.m.cancelMovement, false, 'no CancelMovement pending after a steady-state water frame');
  // ten seconds of it, so a latch that closes late cannot pass
  const long = swimHarness({ target: 'host', water: true, steps: 600, warm: 5 });
  assert.ok(Math.abs(long.dz - swim * 10) < 1e-2, `water: 600 steps travels 10 x GetSwimSpeed (${long.dz})`);

  // THE CONTROL - OT1's target, measured. Writing the same value into
  // `player.swimming` arms CancelMovement twice a frame and the one
  // fixed step spends it: the swimmer does not move at all, at any
  // distance, though `speed` is still the swim speed.
  const frozen = swimHarness({ target: 'motor', water: true, steps: 600, warm: 5 });
  assert.equal(frozen.dz, 0, 'the pre-XL-1 wiring freezes the swimmer solid');
  assert.equal(frozen.m.cancelMovement, true, 'with a cancel pending on every frame');
});

test('AUDIT 65 XL-1: isPlayerSwimming is a plain FIELD - no setter, no cancelMovement, and _step never reads it', () => {
  // A setter here would rebuild the bug: the host rewrites the flag
  // every frame, so any transition that armed CancelMovement would be
  // spent by the very next fixed step.
  assert.equal(Object.getOwnPropertyDescriptor(PlayerMotor.prototype, 'isPlayerSwimming'), undefined,
    'isPlayerSwimming must not be an accessor on the prototype');
  const m = new PlayerMotor(new Collider(() => 0));
  assert.equal(m.isPlayerSwimming, false, 'declared false in the constructor');
  assert.ok(Object.prototype.hasOwnProperty.call(m, 'isPlayerSwimming'), 'it is an own data field');
  m.cancelMovement = false;
  m.isPlayerSwimming = true;
  assert.equal(m.cancelMovement, false, 'the host flag never arms CancelMovement');
  m.isPlayerSwimming = false;
  assert.equal(m.cancelMovement, false, 'neither edge does');
  // ...while `swimming` still does, on BOTH transitions - that is
  // LevitateMotor's property and the reason the two cannot be one.
  m.swimming = true;
  assert.equal(m.cancelMovement, true, 'levitateMotor.IsSwimming arms it (SetSwimming :174)');
  m.cancelMovement = false;
  m.swimming = false;
  assert.equal(m.cancelMovement, true, 'and on the way out (:182)');

  // The motor's CODE mentions the host flag exactly once: the
  // declaration. Every other mention is prose.
  const code = src('src/player/motor.js').split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  const hits = code.match(/isPlayerSwimming/g) ?? [];
  assert.equal(hits.length, 1, `motor code names isPlayerSwimming ${hits.length} times - it must only declare it`);
  assert.match(code, /this\.isPlayerSwimming = false;/, 'the declaration is the one');
});

test('AUDIT 65 XL-1: neither exterior host assigns the latch to the motor flag - both write PlayerEnterExit.isPlayerSwimming', () => {
  const WRITE = "player.isPlayerSwimming = exteriorSwimming({ wasSwimming: _wasSwimming, sunk: !!player.sunk, unsunk: player.heightAction === 'unsink', tileIndex: _surf.tileIndex });";
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = src(host);
    // THE ABSENCE. `player.swimming = exteriorSwimming(` in any shape
    // is the bug, whatever it is spelled around.
    assert.equal(/player\.swimming\s*=\s*exteriorSwimming\s*\(/.test(s), false,
      `${host}: the exterior latch must never be assigned to player.swimming (levitateMotor.IsSwimming)`);
    const write = s.indexOf(WRITE);
    assert.ok(write > 0, `${host}: the latch is written to player.isPlayerSwimming`);
    // The carry is read from the SAME member, before the clear.
    const read = s.indexOf('const _wasSwimming = !!player.isPlayerSwimming;');
    const clear = s.indexOf('applyMotorEffectFlags(player, playerEntity);');
    const surf = s.indexOf('const _surf = exteriorSurfaceNow();');
    assert.ok(read > 0 && clear > 0 && read < clear, `${host}: _wasSwimming is the host flag, read before the per-frame clear`);
    assert.ok(surf > 0 && write > surf && write > clear, `${host}: the write follows the surface model and the clear`);
  }
  // And the clear itself is untouched: shared.js still writes :421.
  assert.match(src('src/scenes/shared.js'), /player\.swimming = false;/,
    'applyMotorEffectFlags still clears levitateMotor.IsSwimming every exterior frame');
});

test('AUDIT 65 XL-1: every IsPlayerSwimming reader moved to the host flag, and every IsSwimming reader stayed on the motor', () => {
  // PlayerEnterExit.IsPlayerSwimming - these five pairs.
  const MOVED = [
    // PlayerEntity.cs:2406/:2426, CollapseFromExhaustion
    [/swimming: !!player\.isPlayerSwimming, entity: playerEntity,/, 'the exhaustion collapse'],
    // PlayerEntity.cs:489, "Don't spawn encounters while player is swimming"
    [/player\.isPlayerSwimming\) \? null : intermittentEnemySpawn\(\{|const hit = player\.isPlayerSwimming \? null : intermittentEnemySpawn\(\{/, 'the encounter roll'],
    // DaggerfallUI.cs:661, cannotRestNow
    [/enemiesNearby: outdoorRestDeps\.enemiesNearby\(\),\s*\n\s*swimming: !!player\.isPlayerSwimming,/, 'the rest refusal'],
    // HeadBobber.cs:101 GetBobbingStyle + :215 ApplySimpleBouncing
    [/bob = headBobber\.update\(dt, cam, \{[\s\S]{0,240}swimming: !!player\.isPlayerSwimming,/, 'the head bob style and bounce'],
    // PlayerEntity.cs:410, the fatigue band + the Swimming tally
    [/runningTally: player\.isRunning && !player\.riding,\s*\n\s*swimming: player\.isPlayerSwimming,/, 'the fatigue/Swimming tally'],
  ];
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = src(host);
    for (const [re, what] of MOVED) assert.match(s, re, `${host}: ${what} must read PlayerEnterExit.IsPlayerSwimming`);
  }
  // PlayerMotor.IsSwimming - these stay, and they are the reason the
  // member had to split rather than be renamed.
  // PlayerFootsteps.cs:230 `if (!playerMotor.IsSwimming)`
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(src(host), /grounded: player\.grounded, swimming: player\.swimming, levitating: player\.levitating,/,
      `${host}: the footstep stride still reads playerMotor.IsSwimming`);
  }
  assert.match(src('src/systems/footsteps.js'), /if \(!m\.swimming\) \{/, 'PlayerFootsteps.cs:230 is the motor flag');
  // PassiveSpecialsEffect.cs:136 reads PlayerMotor.IsSwimming
  assert.match(src('src/scenes/worldModes.js'), /isSwimming: \(\) => !!player\?\.swimming,/,
    'passiveSpecials reads PlayerMotor.IsSwimming (PassiveSpecialsEffect.cs:136)');
  // PlayerMotor.cs:323, the swim/levitate zero-and-return
  assert.match(src('src/player/motor.js'), /if \(this\.levitating \|\| this\.swimming\) \{/,
    'the LevitateMotor branch is the motor flag (PlayerMotor.cs:323)');
  // PlayerHeightChanger's forced-swim crouch arms
  assert.match(src('src/player/motor.js'), /\} else if \(this\.swimming && !this\.forcedSwimCrouch && !this\.grounded\) \{/,
    'DecideHeightAction\'s forced-swim crouch is the motor flag');
});

test('AUDIT 65 XL-1: THE FOUR HOSTS - both dungeon arms write BOTH members, the interior arm clears both, the exterior hosts write only the host flag', () => {
  const BOTH = /player\.isPlayerSwimming = player\.swimming = surf != null && player\.pos\[1\] \+ player\.height \/ 2 \+ 50 \* 0\.025 - 0\.95 < surf;/;
  // PlayerEnterExit.cs:384-392 - the dungeon branch sets isPlayerSwimming
  // AND levitateMotor.IsSwimming off the one blockWaterLevel test.
  assert.match(src('src/scenes/worldModes.js'), BOTH, 'worldModes (the world-hosted dungeon) writes both members');
  assert.match(src('src/scenes/dungeon.js'), BOTH, 'the standalone ?dungeon host writes both members');
  // The interior arm: no blockWaterLevel and no water tile, so both are
  // false (applyMotorEffectFlags is the motor half, :421).
  assert.match(src('src/scenes/worldModes.js'),
    /applyMotorEffectFlags\(player, playerEntity\);\s+player\.isPlayerSwimming = false;/,
    'the interior arm clears the host flag beside the motor flag');
  // The exterior hosts do NOT write the motor flag at all - that is
  // shared.js's line and nothing else's.
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const writes = (src(host).match(/^\s*player\.swimming\s*=/gm) ?? []);
    assert.deepEqual(writes, [], `${host}: no host-side write to levitateMotor.IsSwimming`);
  }
});
