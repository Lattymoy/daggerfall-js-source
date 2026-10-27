// RPT1026-WORLD TRAFFIC-REAL (two private reports, 2026-10-22 and 10-24: pirates on the large map at sea within
// seconds of each other, and an encounter failing every couple of seconds): THE SEA'S TRAFFIC COMES ON THE PLAYER'S
// OWN MINUTES. The real naval
// host over Come Sail Away's real pool (test/navalSea.mjs), a boat at her helm on open water, stepped as the world host
// steps it (world.js naval.frame(dt * worldTimeScale())) at the Overworld's x60 and at a helm's x1; and the director's
// law itself (systems/naval/navalDirector.js trafficSeconds).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sea } from '../../navalSea.mjs';
import { _setTimeScaleForTest } from '../../../src/systems/timeScale.js';
import { createNavalDirector, trafficSeconds, FIRST_ROLL_S, SPAWN_EVERY } from '../../../src/systems/naval/navalDirector.js';

const FPS = 30;
/** `seconds` of real time at the world's time scale `scale`: each frame the world's dt times the scale, as world.js hands
 *  the sea its frame. Answers the ships the sea launched over it, in order. */
function sail(h, seconds, scale) {
  _setTimeScaleForTest(scale);
  const seen = new Set();
  try {
    for (let i = 0; i < seconds * FPS; i++) {
      h.host.frame((1 / FPS) * scale);
      for (const s of h.host.stat().ships) seen.add(s.id);
    }
  } finally { _setTimeScaleForTest(1); }
  return [...seen];
}

test('TRAFFIC-REAL: at the Overworld\'s x60 the sea rolls for a ship on the real clock - none before its first wait\'s real half minute, where the sea\'s own clock launched the first in under a second and four more within twenty, each 760 to 940 m off (mutant: the wait counts the sea\'s seconds)', async () => {
  const h = await sea({ hull: 2, settings: { ShipsAtSea: 'many' } });
  assert.deepEqual(sail(h, FIRST_ROLL_S - 2, 60), [], `no ship in the first ${FIRST_ROLL_S - 2} real seconds at x60`);
  const first = sail(h, 3, 60);
  assert.ok(first.length >= 1, 'the first roll comes at its real half minute');
  const later = sail(h, SPAWN_EVERY[0] - 2, 60);
  assert.equal(later.filter((id) => !first.includes(id)).length, 0, `and the next waits SPAWN_EVERY's ${SPAWN_EVERY[0]} real seconds at least - never a ship a second or two`);
});

test('TRAFFIC-REAL: at a helm\'s x1 the sea\'s seconds are the real ones - the traffic as it was: the first ship after FIRST_ROLL_S, a second within SPAWN_EVERY of it', async () => {
  const h = await sea({ hull: 2, settings: { ShipsAtSea: 'many' } });
  assert.deepEqual(sail(h, FIRST_ROLL_S - 1, 1), []);
  const first = sail(h, 2, 1);
  assert.ok(first.length >= 1, 'the first roll at its half minute');
  const more = sail(h, SPAWN_EVERY[1] + 1, 1);
  assert.ok(more.some((id) => !first.includes(id)), 'another within the longest wait');
});

test('TRAFFIC-REAL the law: a step\'s wait spends the real clock\'s advance when the host hands one (the first read spends none), the step\'s own dt when it does not; never negative; a reset forgets the last read, so the time ashore is never a wait spent', () => {
  assert.equal(trafficSeconds(60, 10, 9), 1, 'x60: a frame\'s sixty sea seconds are one real second');
  assert.equal(trafficSeconds(60, 10, null), 0, 'the first read');
  assert.equal(trafficSeconds(2, undefined, 5), 2, 'no clock handed: the sea\'s');
  assert.equal(trafficSeconds(-3, undefined, null), 0);
  assert.equal(trafficSeconds(1, 5, 9), 0, 'a clock run back spends nothing');
  const ctx = (real) => ({ density: 4, player: [0, 0, 0], players: [[0, 0, 0]], level: 3, ships: [], isOpenWater: () => true, nearPort: false, notoriety: 0, seedBase: 7, seaY: 0, real });
  const d = createNavalDirector({ random: () => 0.1 });
  let real = 0;
  for (let i = 0; i < FIRST_ROLL_S - 1; i++) assert.equal(d.step(600, ctx(real++)).spawn, null, 'six hundred sea seconds a step, one real one');
  assert.notEqual(d.step(600, ctx(real + 1)).spawn, null, 'the first roll at its real half minute');
  d.reset();
  assert.equal(d.step(600, ctx(real + 1000)).spawn, null, 'after a reset the first read spends nothing - a thousand seconds ashore are no wait');
});
