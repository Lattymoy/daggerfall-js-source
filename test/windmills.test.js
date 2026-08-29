import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  WINDMILL_MODELS, ROTOR_AXIS, ROTOR_SIGN, CALM_ROTOR_DEG_PER_SEC,
  STALL_WIND, FURL_DEG_PER_SEC, ROTOR_GAIN,
  windSpeed, rotorRate, rotorPhase, advanceRotor, rotorMatrix,
} from '../src/world/windmills.js';
import { WEATHER_SKY, easeWeather, weatherRow } from '../src/render/enhancedSky.js';
import { identity, trs, transformPoint } from '../src/world/mat4.js';

// W1 - THE WINDMILL'S TURN.
//
// The module is pure, so every law here is held with synthetic wind and
// synthetic placement - no ARENA2, no GL. What it CANNOT hold is the
// half that needs real data: whether model 41600 is a windmill in
// ARCH3D.BSA and where its hub sits. Those are FLAGGED in the module
// and belong to the wiring slice; nothing below pretends otherwise.

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// ---------------------------------------------------------------------------
// The wind reading, and the anchor that ties it to the sky.
// ---------------------------------------------------------------------------

test('W1: windSpeed is the row LENGTH, not either component', () => {
  // The killing fixture is a row whose components differ from each other
  // and from the magnitude, so reading [0], reading [1], or summing them
  // all give a different answer.
  assert.ok(near(windSpeed([0.03, 0.04]), 0.05));
  assert.equal(windSpeed(null), 0);
  assert.equal(windSpeed([0, 0]), 0);
});

test('W1: fair weather turns at the classic 13 deg/s, from the sky\'s own row', () => {
  // THE ANCHOR. Not 13 asserted back at itself: the gain is derived, so
  // this reads the shipped sunny row through the whole chain and only
  // passes if that derivation is right. Re-tune WEATHER_SKY.sunny and
  // this still passes - which is the point - but break the derivation
  // and it fails.
  assert.ok(near(rotorRate(WEATHER_SKY.sunny.wind), CALM_ROTOR_DEG_PER_SEC, 1e-12),
    `sunny turns at ${rotorRate(WEATHER_SKY.sunny.wind)}, not ${CALM_ROTOR_DEG_PER_SEC}`);
  assert.ok(ROTOR_GAIN > 0);
});

test('W1: the rotor is still at and below the stall, and never past the furl', () => {
  assert.equal(rotorRate([STALL_WIND, 0]), 0, 'at the stall exactly, still');
  assert.equal(rotorRate([STALL_WIND * 0.5, 0]), 0);
  assert.equal(rotorRate([0, 0]), 0);
  // A gale is capped, not scaled - thunder would otherwise blur.
  assert.equal(rotorRate(WEATHER_SKY.thunder.wind), FURL_DEG_PER_SEC);
  assert.equal(rotorRate([10, 10]), FURL_DEG_PER_SEC, 'no wind runs past the furl');
});

test('W1: the rate is monotone in the wind, and strictly so below the furl', () => {
  const rows = Object.entries(WEATHER_SKY)
    .map(([k, v]) => [k, windSpeed(v.wind), rotorRate(v.wind)])
    .sort((a, b) => a[1] - b[1]);
  for (let i = 1; i < rows.length; i++) {
    assert.ok(rows[i][2] >= rows[i - 1][2],
      `${rows[i][0]} blows harder than ${rows[i - 1][0]} and turns slower`);
    if (rows[i][2] < FURL_DEG_PER_SEC) {
      assert.ok(rows[i][2] > rows[i - 1][2],
        `${rows[i][0]} and ${rows[i - 1][0]} turn identically below the furl`);
    }
  }
  // ...and the shipped rows really do span the interesting range: the
  // calmest crawls, the wildest furls. A tuning that flattened them all
  // to one speed would satisfy the monotone check above and nothing else.
  assert.ok(rotorRate(WEATHER_SKY.fog.wind) > 0, 'fog stills the mill outright');
  assert.ok(rotorRate(WEATHER_SKY.fog.wind) < CALM_ROTOR_DEG_PER_SEC / 2,
    'fog should CRAWL - that is what the stall floor is for');
  assert.equal(rotorRate(WEATHER_SKY.rain.wind), FURL_DEG_PER_SEC);
});

// ---------------------------------------------------------------------------
// The integration. This is the law the module exists to get right.
// ---------------------------------------------------------------------------

test('W1: the angle is INTEGRATED - a weather change never teleports the blades', () => {
  // Ten minutes of fair weather, then the sim flips to rain and the
  // host eases the row across. Every frame must move the blades by at
  // most one frame's worth of turn.
  //
  // SETTLE_SECONDS is 500 and not the round 600 for a reason worth
  // writing down: the contrast at the bottom of this test compares the
  // naive `rate * elapsed` at two rates, and at 600 s those two land on
  // the SAME angle - the rates differ by 27 deg/s and 27 * 600 is
  // exactly 45 full turns. The first draft of this fixture was that
  // degenerate, and a contrast that cannot tell the two spellings apart
  // proves nothing about the one it is guarding.
  const SETTLE_SECONDS = 500;
  const state = { angle: 0 };
  const dt = 1 / 60;
  let row = weatherRow('sunny');
  for (let i = 0; i < SETTLE_SECONDS * 60; i++) advanceRotor(state, dt, row.wind);

  const settled = state.angle;
  const target = weatherRow('rain');
  let worst = 0;
  for (let i = 0; i < 30 * 60; i++) {
    row = easeWeather(row, target, dt);
    const before = state.angle;
    const after = advanceRotor(state, dt, row.wind);
    const moved = (after - before + 360) % 360;
    worst = Math.max(worst, moved);
  }
  assert.ok(worst <= FURL_DEG_PER_SEC * dt + 1e-9,
    `the blades jumped ${worst} degrees in one frame - the cap is ${FURL_DEG_PER_SEC * dt}`);

  // ...and the naive spelling this pin exists to forbid really would
  // jump. `angle = rate * elapsed` re-prices the whole ten minutes at
  // the new rate the instant the weather moves.
  const elapsed = SETTLE_SECONDS;
  const naiveBefore = (rotorRate(weatherRow('sunny').wind) * elapsed) % 360;
  const naiveAfter = (rotorRate(weatherRow('rain').wind) * elapsed) % 360;
  assert.ok(Math.abs(naiveAfter - naiveBefore) > 1,
    'the fixture no longer distinguishes integrating from multiplying');
  assert.ok(settled >= 0 && settled < 360);
});

test('W1: the angle wraps into [0, 360) and a bad dt cannot move it', () => {
  const state = { angle: 359 };
  advanceRotor(state, 1, WEATHER_SKY.thunder.wind);
  assert.ok(state.angle >= 0 && state.angle < 360, `angle escaped: ${state.angle}`);

  const still = { angle: 12.5 };
  advanceRotor(still, 0, WEATHER_SKY.thunder.wind);
  assert.equal(still.angle, 12.5, 'a zero frame turned the mill');
  advanceRotor(still, -5, WEATHER_SKY.thunder.wind);
  assert.equal(still.angle, 12.5, 'a negative dt turned the mill backwards');
  advanceRotor(still, NaN, WEATHER_SKY.thunder.wind);
  assert.equal(still.angle, 12.5, 'a NaN frame poisoned the angle');
});

test('W1: two mills a block apart are not a chorus line, and are stable', () => {
  const a = rotorPhase(112, 340);
  assert.equal(a, rotorPhase(112, 340), 'the same site drew two different phases');
  assert.ok(a >= 0 && a < 360);
  const spread = new Set();
  for (let i = 0; i < 64; i++) spread.add(Math.floor(rotorPhase(100 + i, 200) / 30));
  assert.ok(spread.size >= 8, `64 neighbouring mills fell into ${spread.size} phase buckets`);
});

// ---------------------------------------------------------------------------
// The transform.
// ---------------------------------------------------------------------------

test('W1: the hub is the one point a spin leaves alone', () => {
  // A mill standing well away from the origin, turned a third of the
  // way round. If the spin were composed OUTSIDE the model matrix the
  // whole mill would swing across the field, and the hub would move.
  const model = trs(120, 3, -47, 0, 30, 0);
  const hub = [0, 2.5, 0.4];
  const still = transformPoint(model, ...hub);
  const spun = transformPoint(rotorMatrix(model, hub, 120), ...hub);
  for (let i = 0; i < 3; i++) {
    assert.ok(near(still[i], spun[i], 1e-4),
      `the hub moved on axis ${i}: ${still[i]} -> ${spun[i]}`);
  }
});

test('W1: a full turn is a no-op, and a blade tip really moves', () => {
  const model = identity();
  const hub = [0, 2, 0];
  const tip = [0, 3.5, 0];   // a metre and a half up the sail from the hub
  const full = transformPoint(rotorMatrix(model, hub, 360), ...tip);
  for (let i = 0; i < 3; i++) assert.ok(near(full[i], tip[i], 1e-4), 'a full turn moved the tip');

  const quarter = transformPoint(rotorMatrix(model, hub, 90), ...tip);
  assert.ok(Math.hypot(quarter[0] - tip[0], quarter[1] - tip[1]) > 1,
    'a quarter turn left the tip where it was');
  // The sail sweeps a circle about the hub: the radius is preserved.
  const r0 = Math.hypot(tip[0] - hub[0], tip[1] - hub[1]);
  const r1 = Math.hypot(quarter[0] - hub[0], quarter[1] - hub[1]);
  assert.ok(near(r0, r1, 1e-4), `the sail changed length: ${r0} -> ${r1}`);
});

test('W1: the rotor turns the way Kamer\'s does - clockwise seen from +Z', () => {
  // ROTOR_SIGN is negative, so a sail at 12 o'clock goes to 3 o'clock.
  const spun = transformPoint(rotorMatrix(identity(), [0, 0, 0], 90), 0, 1, 0);
  assert.ok(near(spun[0], 1, 1e-4) && near(spun[1], 0, 1e-4),
    `+Y should turn to +X, got [${spun[0]}, ${spun[1]}]`);
  assert.equal(ROTOR_SIGN, -1);
  assert.equal(ROTOR_AXIS, 'z');
  // Z is the axis, so it is the coordinate a Z-spin cannot change.
  assert.ok(near(transformPoint(rotorMatrix(identity(), [0, 0, 0], 47), 0, 1, 0.75)[2], 0.75, 1e-4));
});

test('W1: the roller axis is a different axis, not a different sign', () => {
  // SpinTime_Roller.cs turns about local X. A point on the X axis is the
  // one an X-spin leaves alone, which a Z-spin would move.
  const onX = transformPoint(rotorMatrix(identity(), [0, 0, 0], 90, 'x'), 1, 0, 0);
  assert.ok(near(onX[0], 1, 1e-4) && near(onX[1], 0, 1e-4) && near(onX[2], 0, 1e-4));
  const byZ = transformPoint(rotorMatrix(identity(), [0, 0, 0], 90, 'z'), 1, 0, 0);
  assert.ok(!near(byZ[1], 0, 1e-4), 'the axis argument is being ignored');
});

test('W1: the model table names what it spins, and nothing else', () => {
  // A model id here that is NOT a mill turns something that should stand
  // still - so the table stays small and every entry says what it is.
  assert.deepEqual(Object.keys(WINDMILL_MODELS).sort(), ['21411', '41600', '41601']);
  for (const kind of Object.values(WINDMILL_MODELS)) {
    assert.ok(kind === 'windmill' || kind === 'watermill', `unknown rotor kind ${kind}`);
  }
  assert.ok(Object.isFrozen(WINDMILL_MODELS));
});
