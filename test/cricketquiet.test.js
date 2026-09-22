// CRICKET-QUIET (2026-09-22, Mac: "The cricket noise at night is way too
// persistent. I want to make a change that lowers its occurrence and
// persistence, but doesn't remove it as a sound"). DFU plays
// AmbientCrickets at full volume from nightfall to dawn without a break;
// the night now sings in CHORUSES - quieter, swelling in and dying away,
// with silent spells between.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AmbientEffects, CRICKET_CHORUS, AMBIENT_CRICKETS_LOOP } from '../src/systems/ambientEffects.js';

const stub = () => {
  const loops = [];
  return {
    loops,
    engine: {
      play3d: () => 2, playOneShot: () => 2,
      loop(index, volume) {
        const h = { index, volumes: [volume], stopped: false, stop() { this.stopped = true; }, setVolume(v) { this.volumes.push(v); } };
        loops.push(h);
        return h;
      },
    },
  };
};
const live = (loops) => loops.filter((h) => !h.stopped);
const run = (a, seconds, dt = 0.1) => { for (let t = 0; t < seconds - 1e-9; t += dt) a.update(dt, {}); };

test('CRICKET-QUIET: a clear night opens with a chorus that swells in, holds below full volume and dies away', () => {
  const { engine, loops } = stub();
  const a = new AmbientEffects({ minWait: 5, maxWait: 25 }, engine, () => 0);   // every roll its minimum
  a.setPreset('clearNight');
  a.update(0.1, {});
  assert.equal(loops.length, 1, 'the night opens singing, as DFU\'s does');
  assert.equal(loops[0].index, AMBIENT_CRICKETS_LOOP);
  assert.equal(loops[0].volumes[0], 0, 'the loop opens silent - no pop at full volume');
  run(a, CRICKET_CHORUS.fade);
  const peak = Math.max(...loops[0].volumes);
  assert.ok(Math.abs(peak - CRICKET_CHORUS.volume) < 1e-9, `it swells to ${CRICKET_CHORUS.volume}, not DFU's 1`);
  assert.ok(CRICKET_CHORUS.volume < 1);
  run(a, CRICKET_CHORUS.bout[0] - CRICKET_CHORUS.fade - 0.1 - 0.5);
  assert.ok(loops[0].volumes.at(-1) < CRICKET_CHORUS.volume, 'dying away at the end of the chorus');
  run(a, 1);
  assert.ok(loops[0].stopped, 'the chorus ends - the loop is stopped, not left running silent');
});

test('CRICKET-QUIET: a quiet spell follows, then the next chorus - the crickets are never gone for good', () => {
  const { engine, loops } = stub();
  const a = new AmbientEffects({ minWait: 5, maxWait: 25 }, engine, () => 0);
  a.setPreset('clearNight');
  run(a, CRICKET_CHORUS.bout[0] + 0.5);
  assert.equal(live(loops).length, 0);
  run(a, CRICKET_CHORUS.quiet[0] - 1);
  assert.equal(live(loops).length, 0, 'silent through the quiet spell');
  run(a, 2);
  assert.equal(loops.length, 2, 'the next chorus opens');
  assert.equal(live(loops).length, 1);
});

test('CRICKET-QUIET: over a whole night the crickets sing a minority of the time - DFU sang all of it', () => {
  const { engine, loops } = stub();
  let i = 0;
  const rng = () => ((i++ * 0.6180339887) % 1);   // a spread of rolls, deterministic
  const a = new AmbientEffects({ minWait: 5, maxWait: 25 }, engine, rng);
  a.setPreset('clearNight');
  let singing = 0, total = 0;
  for (let t = 0; t < 3600; t += 0.5) {
    a.update(0.5, {});
    total += 0.5;
    if (live(loops).length) singing += 0.5;
  }
  const share = singing / total;
  const [b0, b1] = CRICKET_CHORUS.bout, [q0, q1] = CRICKET_CHORUS.quiet;
  const expected = ((b0 + b1 - 1) / 2) / ((b0 + b1 - 1) / 2 + (q0 + q1 - 1) / 2);
  assert.ok(share > 0.1 && share < 0.5, `singing ${Math.round(share * 100)}% of the hour`);
  assert.ok(Math.abs(share - expected) < 0.1, `near the constants' own duty ${Math.round(expected * 100)}%`);
  assert.ok(loops.length >= 10, `${loops.length} choruses in an hour - it keeps coming back`);
});

test('CRICKET-QUIET: dawn, a storm or a video stop it; the chorus resumes after a video', () => {
  const { engine, loops } = stub();
  const a = new AmbientEffects({ minWait: 5, maxWait: 25 }, engine, () => 0);
  a.setPreset('clearNight');
  run(a, 5);
  a.setMuted(true);
  assert.ok(loops[0].stopped, 'a video stops the chorus');
  a.update(0.1, {});
  assert.equal(loops.length, 1, 'nothing re-opens while muted');
  a.setMuted(false);
  a.update(0.1, {});
  assert.equal(live(loops).length, 1, 'mid-chorus, the loop re-opens after the video');
  a.setPreset('sunnyDay');
  assert.equal(live(loops).length, 0, 'day stops it');
  run(a, 200);
  assert.equal(loops.length, 2, 'and no chorus starts by day');
});
