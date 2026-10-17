// CLIMB1 (the Enhanced Climbing arc - bible/03-World/Parkour-Arc.md): THE
// LEDGE SENSOR, THE MANTLE AND THE VAULT. The laws (player/parkour.js), the
// sensor against a real Collider's boxes, the motor living them (a jump that
// mantles, a held jump that catches, a run that vaults, a classic climb that
// tops out), the switch that keeps the classic lane untouched, and the tick
// that bills them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parkourSkill, parkourReach, mantleDuration, vaultDuration, senseLedge, senseVault, planMantle, movePoint,
  capsuleFits, PARKOUR_REACH_MIN, PARKOUR_REACH_MAX, PARKOUR_AIR_REACH,
} from '../../src/player/parkour.js';
import { PlayerMotor, STEP_OFFSET, CAPSULE_RADIUS, CAPSULE_HEIGHT, CROUCH_HEIGHT } from '../../src/player/motor.js';
import { Collider } from '../../src/player/collider.js';
import { tickPlayerMinutes } from '../../src/systems/worldTick.js';
import { SKILLS } from '../../src/systems/skills.js';
import { parkourSwitchOn } from '../../src/scenes/shared.js';
import { FEATURES, checkFeature } from '../../src/systems/features.js';
import { setPref, PREF_DEFAULTS } from '../../src/systems/uiPrefs.js';
import { setUiSkin, uiSkin } from '../../src/systems/uiSkin.js';

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
/** An axis-aligned solid box, outward faces. */
function box(col, key, x0, y0, z0, x1, y1, z1) {
  const p = [x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1];
  const idx = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
  col.addMesh(key, new Float32Array(p), idx, I);
}
/** A floor, and a block whose face stands at z = 1 across the player's look (+z). */
function world(top, depth = 3, extra = null) {
  const col = new Collider(() => -100);
  col.addMesh('floor', new Float32Array([-10, 0, -10, 10, 0, -10, 10, 0, 10, -10, 0, 10]), [0, 1, 2, 0, 2, 3], I);
  box(col, 'block', -3, 0, 1, 3, top, 1 + depth);
  extra?.(col);
  return col;
}
const GEO = (high, low = STEP_OFFSET) => ({ low, high, radius: CAPSULE_RADIUS, stand: CAPSULE_HEIGHT, crouch: CROUCH_HEIGHT, height: CAPSULE_HEIGHT });
const FEET = [0, 0, 0.45];
const LOOK = [0, 0, 1];

test('CLIMB1: the skill the moves read - the classic chance\'s arithmetic, held to 0..100; the reach and the pace it buys', () => {
  assert.equal(parkourSkill({ climbing: 40 }), 40);
  assert.equal(parkourSkill({ climbing: 40, khajiit: true }), 70, 'the Khajiit +30');
  assert.equal(parkourSkill({ climbing: 40, khajiit: true, enhanced: true }), 100, 'the Climbing spell doubles after the racial arm, then the hold');
  assert.equal(parkourSkill({ climbing: 30, enhanced: true }), 60);
  assert.equal(parkourSkill({ climbing: 150 }), 100, 'past 100 the reach has nowhere further to go');
  assert.equal(parkourSkill({ climbing: -5 }), 0);
  assert.equal(parkourSkill(), 0);
  assert.equal(parkourReach(0), PARKOUR_REACH_MIN);
  assert.equal(parkourReach(100), PARKOUR_REACH_MAX);
  assert.ok(Math.abs(parkourReach(50) - 1.8) < 1e-9, 'a lip at the top of the head at Climbing 50');
  assert.ok(Math.abs(mantleDuration(2, 0) - 0.897) < 1e-9, 'a 2 m lip at Climbing 0');
  assert.ok(Math.abs(mantleDuration(2, 100) - 0.552) < 1e-9, 'and at 100');
  assert.ok(mantleDuration(1, 50) < mantleDuration(1.8, 50), 'a higher lip is a longer pull');
  assert.ok(vaultDuration(1, 50) < mantleDuration(1, 50), 'a vault is quicker than a mantle over the same lip');
  assert.ok(vaultDuration(1, 100) < vaultDuration(1, 0));
});

test('CLIMB1: the sensor finds a lip in reach and where the body goes - risen off the face, then standing on the top', () => {
  for (const top of [0.7, 1.0, 1.5, 1.8]) {
    const l = senseLedge(world(top), FEET, LOOK, GEO(1.8));
    assert.equal(l.ok, true, `a ${top} m lip`);
    assert.ok(Math.abs(l.lipY - top) < 1e-6, 'the lip is the top of the face');
    assert.ok(Math.abs(l.rise - top) < 1e-6);
    assert.deepEqual(l.normal.map((v) => Math.round(v * 1000) / 1000 + 0), [0, 0, -1], 'the face\'s normal, toward the body');
    assert.ok(l.mantle, 'room on the top');
    assert.equal(l.mantle.crouch, false);
    const [ux, uy, uz] = l.mantle.up;
    assert.ok(Math.abs(uz - (1 - CAPSULE_RADIUS - 0.04)) < 1e-6 && Math.abs(uy - (top + 0.04)) < 1e-6 && ux === 0, 'risen: off the face by the radius and a gap, feet over the lip');
    const [tx, ty, tz] = l.mantle.top;
    assert.ok(Math.abs(tz - (1 + CAPSULE_RADIUS + 0.12)) < 1e-6 && Math.abs(ty - (top + 0.02)) < 1e-6 && tx === 0, 'on the top, past the face by the radius and the inset');
    assert.ok(capsuleFits(world(top), l.mantle.top, CAPSULE_HEIGHT));
  }
});

test('CLIMB1: the sensor refuses what the hands cannot take - out of reach, too far, too oblique, a pitched top, no room', () => {
  assert.equal(senseLedge(world(2.0), FEET, LOOK, GEO(1.8)).why, 'too-high', 'a lip above the reach');
  assert.equal(senseLedge(world(8.0), FEET, LOOK, GEO(1.8)).why, 'too-high', 'a wall that runs on above the reach has no lip in it');
  assert.equal(senseLedge(world(2.0), FEET, LOOK, GEO(2.1)).ok, true, 'the same lip in a longer reach');
  assert.equal(senseLedge(world(1.85), FEET, LOOK, GEO(1.8)).why, 'too-high', 'five centimetres past the reach, under the scan\'s last rung');
  assert.equal(senseLedge(world(1.5), [0, 0, -0.2], LOOK, GEO(1.8)).why, 'no-wall', 'the face beyond arm\'s length');
  const at = (deg) => [Math.sin((deg * Math.PI) / 180), 0, Math.cos((deg * Math.PI) / 180)];
  assert.equal(senseLedge(world(1.5), FEET, at(40), GEO(1.8)).ok, true, 'looking 40 degrees off square');
  assert.equal(senseLedge(world(1.5), FEET, at(60), GEO(1.8)).why, 'no-wall', 'looking 60 degrees off square');
  assert.equal(senseLedge(world(1.5), FEET, [0, 0, -1], GEO(1.8)).why, 'no-wall', 'looking away');
  // close enough that a 60-degree look still meets the face within reach:
  // the angle alone refuses it
  const near = [0, 0, 0.62];
  assert.equal(senseLedge(world(1.5), near, at(45), GEO(1.8)).ok, true, 'close in, 45 degrees off square');
  assert.equal(senseLedge(world(1.5), near, at(60), GEO(1.8)).why, 'no-wall', 'close in, 60 degrees off square is a glance, not a grab');
  // a lid 0.5 over the top: neither standing nor crouched fits there
  const lid = senseLedge(world(1.5, 3, (c) => box(c, 'lid', -3, 2.0, 1.2, 3, 3, 4)), FEET, LOOK, GEO(1.8));
  assert.equal(lid.ok, true, 'the lip is real');
  assert.equal(lid.mantle, null);
  assert.equal(lid.why, 'no-room');
  // a pitched top: a wedge rising from the face at 60 degrees
  const roof = new Collider(() => -100);
  roof.addMesh('floor', new Float32Array([-10, 0, -10, 10, 0, -10, 10, 0, 10, -10, 0, 10]), [0, 1, 2, 0, 2, 3], I);
  roof.addMesh('face', new Float32Array([-3, 0, 1, 3, 0, 1, 3, 1.2, 1, -3, 1.2, 1]), [0, 1, 2, 0, 2, 3], I);
  roof.addMesh('slope', new Float32Array([-3, 1.2, 1, 3, 1.2, 1, 3, 1.2 + 1.732 * 1.5, 2.5, -3, 1.2 + 1.732 * 1.5, 2.5]), [0, 2, 1, 0, 3, 2], I);
  const pitched = senseLedge(roof, FEET, LOOK, GEO(2.1));
  assert.ok(pitched.why === 'steep-top' || pitched.why === 'too-high', `a 60-degree roof is no top (${pitched.why})`);
  assert.equal(pitched.mantle ?? null, null);
});

test('CLIMB1: the probe starts where the wall stops, not at a fixed height - a counter under a low ceiling is a crouch onto it', () => {
  // the ceiling's slab at 2.3 sits where a fixed probe (feet + reach + 0.3)
  // would start inside it and meet its underside
  const col = world(1.0, 3, (c) => box(c, 'ceil', -10, 2.3, -10, 10, 2.6, 10));
  const l = senseLedge(col, FEET, LOOK, GEO(2.1));
  assert.equal(l.ok, true);
  assert.ok(Math.abs(l.lipY - 1.0) < 1e-6);
  assert.ok(l.mantle, 'a way onto it');
  assert.equal(l.mantle.crouch, true, '1.3 m of room: crouched, not standing');
  // and a crawlspace: the lid over the top only, the room in front of it open
  const crawl = senseLedge(world(1.0, 3, (c) => box(c, 'lid', -3, 2.2, 1.2, 3, 3, 4)), FEET, LOOK, GEO(1.8));
  assert.equal(crawl.mantle?.crouch, true);
  // a ceiling over the body's own head that stops the rise
  const low = senseLedge(world(1.5, 3, (c) => box(c, 'ceil', -10, 2.0, -10, 10, 2.3, 0.9)), FEET, LOOK, GEO(1.8));
  assert.equal(low.why, 'no-room-up', 'the column over the head is shut');
  // at the edge of reach, a slab over the head that ends before the risen
  // body and clears the midpoint's: the rise leaves this column on its way
  // up and would clip it - only the column's own ray sees it
  const edge = world(1.5, 3, (c) => box(c, 'eave', -10, 2.6, -10, 10, 2.9, 0.24));
  const far = [0, 0, 0.2];
  const eave = senseLedge(edge, far, LOOK, GEO(1.8));
  assert.equal(eave.mantle?.crouch, true, 'the eave over the body\'s own head stops a standing rise - a crouched one passes under it (AUDIT CLIMB1: the sensor tries the crouch before it gives up)');
  assert.equal(senseLedge(world(1.5), far, LOOK, GEO(1.8)).ok && !!senseLedge(world(1.5), far, LOOK, GEO(1.8)).mantle, true, 'and without it the same reach climbs');
});

test('CLIMB1: the vault - a top that ends within a stride with room beyond it; a deep top is mantled, a walled far side is not vaulted', () => {
  const fenceCol = world(1.0, 0.2);
  const fence = senseLedge(fenceCol, FEET, LOOK, GEO(1.8));
  assert.equal(fence.ok, true);
  assert.equal(fence.mantle, null, 'no room to stand on a fence\'s top');
  assert.equal(fence.why, 'no-top');
  const v = senseVault(fenceCol, FEET, fence, GEO(1.8));
  assert.ok(v, 'the fence is vaulted');
  assert.ok(Math.abs(v.depth - 0.2) < 0.02, `the far edge is the fence's own back (${v.depth.toFixed(3)})`);
  const thin = world(1.0, 0.13);
  const t13 = senseVault(thin, FEET, senseLedge(thin, FEET, LOOK, GEO(1.8)), GEO(1.8));
  assert.ok(t13 && Math.abs(t13.depth - 0.13) < 0.015, `to a centimetre, between the profile's steps (${t13?.depth.toFixed(3)} - AUDIT CLIMB1: bisected)`);
  assert.ok(v.over[2] > 1.2 + CAPSULE_RADIUS && Math.abs(v.over[1] - 1.08) < 1e-6, 'the body leaves it past the far edge, clear of the top');
  const deepCol = world(1.0, 3);
  assert.equal(senseVault(deepCol, FEET, senseLedge(deepCol, FEET, LOOK, GEO(1.8)), GEO(1.8)), null, 'a 3 m top is climbed onto, not vaulted');
  const walled = world(1.0, 0.2, (c) => box(c, 'wall', -3, 0, 1.5, 3, 4, 2));
  assert.equal(senseVault(walled, FEET, senseLedge(walled, FEET, LOOK, GEO(1.8)), GEO(1.8)), null, 'no room past the far edge');
  const tall = world(1.5, 0.2);
  assert.equal(senseVault(tall, FEET, senseLedge(tall, FEET, LOOK, GEO(1.8)), GEO(1.8)), null, 'a lip over the waist is not vaulted');
});

test('CLIMB1: the path - it rises to `up` and steps over to the top, never nearer the face than `up`', () => {
  const col = world(1.5);
  const l = senseLedge(col, FEET, LOOK, GEO(1.8));
  const m = planMantle(FEET, l, 50);
  assert.deepEqual(movePoint(m, 0), FEET);
  assert.deepEqual(movePoint(m, m.split), m.up);
  assert.deepEqual(movePoint(m, 1).map((v) => Math.round(v * 1e6) / 1e6), m.to.map((v) => Math.round(v * 1e6) / 1e6));
  for (let t = 0; t <= m.split; t += 0.01) {
    const p = movePoint(m, t);
    assert.ok(p[2] <= m.up[2] + 1e-9, `t=${t.toFixed(2)}: the rise keeps off the face`);
    assert.ok(capsuleFits(col, p, CAPSULE_HEIGHT), `t=${t.toFixed(2)}: the body fits`);
  }
  for (let t = m.split; t <= 1; t += 0.01) assert.ok(capsuleFits(col, movePoint(m, t), CAPSULE_HEIGHT), `t=${t.toFixed(2)}: the step over fits`);
  // the resolve reverts a body it would have to push up into a ceiling, so
  // its push reads nothing for a head through a slab: the ray is the headroom
  const lid = world(1.0, 3, (c) => box(c, 'ceil', -10, 2.3, -10, 10, 2.6, 10));
  assert.ok(lid.penetrationAt([0, 1.02, 1.47], CAPSULE_HEIGHT) < 0.03, 'the push alone reads a head through the slab as clear');
  assert.equal(capsuleFits(lid, [0, 1.02, 1.47], CAPSULE_HEIGHT), false, 'standing does not fit under a 1.3 m gap');
  assert.equal(capsuleFits(lid, [0, 1.02, 1.47], CROUCH_HEIGHT), true, 'crouching does');
});

/** A motor on a world, the enhanced climb mounted, and a scripted input. */
function drive(col, { skill = 50, enabled = true, climbing = null, z = 0.4, steps = 150, input }) {
  const m = new PlayerMotor(col, { speed: 50, running: 30 }, {
    climbing,
    parkour: { enabled: () => enabled, inputs: () => ({ climbing: skill }) },
  });
  m.spawn(0, 0.02, z);
  const log = { started: [], maxY: 0, fell: 0, airborneAtStart: null, climbingAtStart: null, eyeLag: 0 };
  for (let i = 0; i < steps; i++) {
    const wasGrounded = m.grounded;
    m.update(1 / 60, { forward: 0, strafe: 0, run: false, jump: false, ...input(i, m) }, 0);
    if (m.parkoured) {
      log.started.push([i, m.parkoured]);
      if (log.airborneAtStart == null) { log.airborneAtStart = !wasGrounded; log.climbingAtStart = !!m.climb?.isClimbing; }
    }
    // the render eye rides the move's own feet, not the stair filter's lag
    if (m.mantling) log.eyeLag = Math.max(log.eyeLag, Math.abs(m.eyeAt()[1] - m.eye[1] - (m._prevPos[1] - m.pos[1]) * (1 - m._alpha)));
    log.maxY = Math.max(log.maxY, m.pos[1]);
    if (log.started.length) log.fell = Math.max(log.fell, m.landedFallDistance);   // not the spawn's settle
  }
  return { m, log };
}
const tap = (at = 10) => (i) => ({ jump: i === at });

test('CLIMB1 LIVE: Jump pressed at a ledge climbs onto it - one mantle, standing on the top, no fall billed', () => {
  const { m, log } = drive(world(1.5), { input: tap() });
  assert.deepEqual(log.started, [[10, 'mantle']], 'the press is the mantle, once');
  assert.equal(m.mantling, false, 'and it ended');
  assert.equal(m.grounded, true);
  assert.ok(Math.abs(m.pos[1] - 1.5) < 0.03, `on the top (y=${m.pos[1].toFixed(3)})`);
  assert.ok(m.pos[2] > 1.3, 'past the lip');
  assert.equal(m.crouching, false);
  assert.equal(log.fell, 0);
  assert.ok(log.maxY < 1.6, 'the path never flings the body over the top');
  assert.ok(log.eyeLag < 1e-4, `the eye rides the move, not MAC1's stair filter (lag ${log.eyeLag.toFixed(4)})`);
});

test('CLIMB1 LIVE: the Climbing skill sets the pace - the same lip is a quicker pull at 100 than at 0', () => {
  const took = (skill) => {
    const { m } = drive(world(1.5), { skill, input: tap(), steps: 11 });
    let n = 0;
    while (m.mantling && n < 200) { m.update(1 / 60, { forward: 0, strafe: 0, run: false, jump: false }, 0); n++; }
    return n;
  };
  const slow = took(0), fast = took(100);
  assert.ok(Math.abs(slow / 60 - mantleDuration(1.5, 0)) < 0.05, `Climbing 0: ${(slow / 60).toFixed(2)} s`);
  assert.ok(Math.abs(fast / 60 - mantleDuration(1.5, 100)) < 0.05, `Climbing 100: ${(fast / 60).toFixed(2)} s`);
  assert.ok(fast < slow);
});

test('CLIMB1 LIVE: Jump held in the air catches a lip the jump brings into reach - and a lip past the reach is not caught', () => {
  // CLIMB2 (Mac's "Jump is the grab": Forward climbs up): with Forward held the catch climbs straight on over the lip,
  // as at CLIMB1; without it the lip is HELD - test/player/climb2.test.js has the hang
  const held = (i) => ({ jump: i >= 10 && i < 40, forward: i >= 5 && i < 40 ? 1 : 0 });
  const high = drive(world(2.3), { skill: 100, input: held });
  assert.equal(high.log.started.length, 1, 'caught once');
  assert.equal(high.log.started[0][1], 'mantle');
  assert.equal(high.log.airborneAtStart, true, 'the catch was in the air, not a grounded mantle');
  assert.ok(Math.abs(high.m.pos[1] - 2.3) < 0.03, 'and it ends on the top');
  const hung = drive(world(2.3), { skill: 100, input: (i) => ({ jump: i >= 10 && i < 40 }) });
  assert.deepEqual(hung.log.started.map((e) => e[1]), ['catch'], 'no Forward: the lip is caught and held');
  assert.equal(hung.m.hanging, true);
  const low = drive(world(2.3), { skill: 0, input: (i) => ({ jump: i >= 10 && i < 40 }) });   // (with Forward the hands would take the wall - CLIMB2's grab)
  assert.deepEqual(low.log.started, [], `out of reach at Climbing 0 (${(PARKOUR_REACH_MIN + PARKOUR_AIR_REACH).toFixed(2)} m of hands over a 0.5 m jump)`);
  assert.ok(low.log.maxY < 1, 'the jump went up and came down');
  // a tapped jump, no hold: the grounded press missed (the lip is out of the
  // standing reach), and the tap arms the catch for the jump it makes (Mac,
  // 2026-10-01: "Take care of what is left including a jump catching a ledge" -
  // the first cut asked the key held, and a tap caught nothing)
  const tapped = drive(world(2.3), { skill: 100, input: tap() });
  assert.deepEqual(tapped.log.started.map((e) => e[1]), ['catch'], 'Jump is the grab: a tap catches');
  assert.equal(tapped.m.hanging, true);
});

test('CLIMB1 LIVE: Jump at a run vaults a fence - over it, onward, and down; without Forward it is climbed over; a deep top is climbed onto', () => {
  const run = drive(world(1.0, 0.2), { input: (i) => ({ forward: i >= 5 && i < 60 ? 1 : 0, jump: i === 10 }) });
  assert.deepEqual(run.log.started, [[10, 'vault']]);
  assert.equal(run.m.grounded, true);
  assert.ok(run.m.pos[2] > 1.2 + CAPSULE_RADIUS, `beyond the fence (z=${run.m.pos[2].toFixed(2)})`);
  assert.ok(Math.abs(run.m.pos[1]) < 0.05, 'on the ground past it');
  // the same press standing still: a fence has no top to stand on - it is CLIMBED over (AUDIT CLIMB1 G3, the
  // clamber: a climb, so a mantle's tally), onto the floor just behind it, never vaulted
  const still = drive(world(1.0, 0.2), { input: tap() });
  assert.deepEqual(still.log.started, [[10, 'mantle']], 'no Forward, no vault - a clamber');
  assert.ok(still.m.pos[2] > 1.2 && Math.abs(still.m.pos[1]) < 0.05, `over it and down (${[...still.m.pos].map((v) => v.toFixed(2))})`);
  // no fence to vault on a deep top: a run and a Jump climbs onto it
  const deep = drive(world(1.0, 3), { input: (i) => ({ forward: i >= 5 && i < 45 ? 1 : 0, jump: i === 10 }) });
  assert.deepEqual(deep.log.started, [[10, 'mantle']]);
  assert.ok(Math.abs(deep.m.pos[1] - 1.0) < 0.03);
});

test('CLIMB1 LIVE: a top with a crouch\'s room ends crouched, the eye sinking across the move', () => {
  const { m, log } = drive(world(1.0, 3, (c) => box(c, 'ceil', -10, 2.3, -10, 10, 2.6, 10)), { input: tap() });
  assert.deepEqual(log.started, [[10, 'mantle']]);
  assert.equal(m.crouching, true);
  assert.equal(m.height, CROUCH_HEIGHT);
  assert.ok(Math.abs(m.pos[1] - 1.0) < 0.03);
});

test('CLIMB1 LIVE: the classic climb tops out - a lip coming into the climber\'s reach is climbed over, not shoved over', () => {
  const climbing = { inputs: () => ({ climbing: 50, luck: 50 }), tally: () => {}, rolls: () => 0, say: () => {} };
  // Forward held up the wall, let go once the body stands on the top
  let seen = false, onTop = false;
  const { m, log } = drive(world(4.0), {
    climbing, z: 0.6, steps: 400,
    input: (i, mm) => {
      if (mm.mantling) seen = true;
      else if (seen) onTop = true;
      return { forward: onTop ? 0 : 1 };
    },
  });
  assert.equal(log.started.length, 1, 'one top-out');
  assert.equal(log.started[0][1], 'mantle');
  assert.equal(log.climbingAtStart, false, 'the climb it came out of ends as the mantle starts');
  assert.equal(m.climb.isClimbing, false);
  assert.equal(m.grounded, true);
  assert.ok(Math.abs(m.pos[1] - 4.0) < 0.03, `standing on the top (y=${m.pos[1].toFixed(2)})`);
});

test('CLIMB1 LIVE: the switch off is the classic lane - the press is a jump, and no move ever starts', () => {
  const { m, log } = drive(world(1.5), { enabled: false, input: tap() });
  assert.deepEqual(log.started, []);
  assert.ok(log.maxY > 0.3 && log.maxY < 0.8, `a plain jump (apex ${log.maxY.toFixed(2)})`);
  assert.ok(m.pos[1] < 0.1, 'and back on the floor');
  // no deps at all: the motor holds no parkour and the step never asks
  const bare = new PlayerMotor(world(1.5), { speed: 50, running: 30 });
  assert.equal(bare.parkour, null);
  assert.equal(bare.mantling, false);
});

test('CLIMB1 LIVE: a move rides the world\'s recentre, and a placement cancels it', () => {
  const col = world(1.5);
  const m = new PlayerMotor(col, { speed: 50, running: 30 }, { parkour: { enabled: () => true, inputs: () => ({ climbing: 50 }) } });
  m.spawn(0, 0.02, 0.4);
  for (let i = 0; i < 20; i++) m.update(1 / 60, { forward: 0, strafe: 0, run: false, jump: i === 10 }, 0);
  assert.equal(m.mantling, true, 'mid-move');
  const to = [...m._pkMove.to];
  m.offsetOrigin([10, 0, -5]);
  assert.deepEqual(m._pkMove.to, [to[0] + 10, to[1], to[2] - 5], 'the path shifted with the world');
  m.spawn(3, 0.02, 0.4);
  assert.equal(m.mantling, false, 'a placement is never the end of a mantle');
  m.update(1 / 60, { forward: 0, strafe: 0, run: false, jump: false }, 0);
  assert.ok(Math.abs(m.pos[0] - 3) < 1e-6, 'nothing drags the body back onto the old path');
});

test('CLIMB1: the tick bills a mantle and a vault as one exertion each - a jump\'s fatigue, the skill each one used', () => {
  const run = (activity) => {
    const entity = { level: 1, health: 50, maxHealth: 50, fatigue: 6400, magicka: 0, stats: {}, skills: new Array(35).fill(30), skillUses: new Array(35).fill(0), items: [], activeEffects: [] };
    let drained = 0;
    tickPlayerMinutes({ entity, classicMinutes: 10.2, dt: 0.001, activity, fatigueMultiplier: 1, rolls: () => 0.5, sinks: { drainFatigue: (d) => { drained += d; } } });
    return { drained, uses: entity.skillUses };
  };
  const none = run({ standing: true });
  const jump = run({ standing: true, jumped: true });
  const mantle = run({ standing: true, parkoured: 'mantle' });
  const vault = run({ standing: true, parkoured: 'vault' });
  assert.ok(jump.drained > none.drained, 'a jump costs');
  assert.equal(mantle.drained, jump.drained, 'a mantle costs a jump\'s fatigue');
  assert.equal(vault.drained, jump.drained, 'and so does a vault');
  assert.equal(mantle.uses[SKILLS.Climbing], 1, 'a mantle trains Climbing');
  assert.equal(mantle.uses[SKILLS.Jumping], 0);
  assert.equal(vault.uses[SKILLS.Jumping], 1, 'a vault trains Jumping');
  assert.equal(vault.uses[SKILLS.Climbing], 0);
});

test('CLIMB1: the switch - the enhanced skin, the row, and ?parkour=off; the classic skin keeps the classic climb offline, and online the skin is not asked', () => {
  const skin = uiSkin(); const pref = PREF_DEFAULTS.enhancedClimbing;
  assert.equal(pref, true, 'on by default');
  try {
    setUiSkin('enhanced'); setPref('enhancedClimbing', true);
    assert.equal(parkourSwitchOn(''), true);
    assert.equal(parkourSwitchOn('?parkour=off'), false, 'the kill door');
    assert.equal(parkourSwitchOn('?parkour=on'), true, 'any other value is not the door');
    setPref('enhancedClimbing', false);
    assert.equal(parkourSwitchOn(''), false, 'the row is the switch');
    setPref('enhancedClimbing', true); setUiSkin('classic');
    assert.equal(parkourSwitchOn(''), false, 'offline, the classic skin climbs DFU\'s way whatever the row says');
    assert.equal(parkourSwitchOn('?online=1'), true, 'online the skin is the player\'s own look, and the room climbs one way (OVH3)');
    assert.equal(parkourSwitchOn('?online=1&parkour=off'), false, 'the kill door still shuts it');
  } finally { setUiSkin(skin); setPref('enhancedClimbing', pref); }
  const row = FEATURES.find((f) => f.id === 'enhanced-climbing');
  assert.ok(row);
  assert.deepEqual(checkFeature(row), []);
  assert.deepEqual([...row.kinds], ['enhanced']);
  assert.equal(row.control.key, 'enhancedClimbing');
  assert.equal(row.control.online, true, 'on for everyone online: nobody crosses a rooftop a way another cannot');
});

test('CLIMB1: every host mounts the enhanced climb and reports its edge - the three motors, the five activity reports', () => {
  const read = (f) => readFileSync(new URL(`../../src/scenes/${f}.js`, import.meta.url), 'utf8');
  for (const f of ['world', 'exterior', 'dungeon']) {
    const s = read(f);
    // AUDIT CLIMB2 H7: and every host its HUD line (the grip's failing, a refused climb) - the standalone dungeon's too
    assert.match(s, /new PlayerMotor\([^\n]*climbing: climbingDeps\([^\n]*\), parkour: parkourDeps\(playerEntity, \(l\) => (townTalk\?\.say|ctx\.hudSay\?\.)\(l\)(?:, \{ hold: \(\) => [^\n]*?\})?\) \}\);/, `${f}: the motor is handed the deps and the HUD's line`);   // PIN MOVED (CLIMB-NODE, FIELD BUGS 2026-10-01): and the world host's hold
    assert.match(s, /import \{[^}]*\bparkourDeps\b[^}]*\} from '\.\/shared\.js';/, `${f}: imported from the one home`);
  }
  assert.match(read('world'), /jumped: player\.jumped,[^\n]*\n\s*parkoured: player\.parkoured,/);
  assert.match(read('exterior'), /jumped: player\.jumped,\n\s*parkoured: player\.parkoured,/);
  const modes = read('worldModes');
  assert.match(modes, /jumped: player\.jumped,[^\n]*\n\s*parkoured: player\.parkoured,/, 'the interior ticker');
  assert.match(modes, /dungeonCtx\.reportActivity\?\.\(\{[^\n]*jumped: player\.jumped, parkoured: player\.parkoured,/, 'the dungeon mode\'s report');
  assert.match(read('dungeon'), /ctx\.reportActivity\?\.\(\{[^\n]*jumped: player\.jumped, parkoured: player\.parkoured,/, 'the dungeon host\'s report');
  const ctx = read('dungeonContext');
  assert.match(ctx, /reportActivity\(\{[^}]*parkoured = null[^}]*\} = \{\}\)/);
  assert.match(ctx, /_activity\.parkoured = parkoured;/);
});
