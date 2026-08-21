// U7: the rest session machine - cadence, interrupts, completion.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RestSession, MINUTES_PER_TICK, REST_WAIT_PER_HOUR, LOITER_WAIT_PER_HOUR,
  loiterLimitHours, REST_TEXT,
} from '../src/systems/restSession.js';

const deps = (over = {}) => {
  const d = {
    minutes: 0, vitalTicks: 0,
    advanceMinutes(n) { d.minutes += n; },
    tickVitals() { d.vitalTicks++; return false; },
    fullyHealed: () => false,
    enemiesNearby: () => false,
    dead: () => false,
    ...over,
  };
  return d;
};

test('rest: the sub-tick law - waitPerHour / minutesPerTick (the DFU divisor quirk; audit 16f)', () => {
  // DFU divides by the CONSTANT minutesPerTick (10), not the 6 ticks
  // an hour takes - a rested hour passes in 6 x 0.075 = 0.45 real
  // seconds (loiter 6 x 0.125 = 0.75). Quirk preserved.
  assert.equal(MINUTES_PER_TICK, 10);
  assert.equal(REST_WAIT_PER_HOUR, 0.75);
  assert.equal(LOITER_WAIT_PER_HOUR, 1.25);
  const d = deps();
  const s = new RestSession('timed', 3, d);
  s.tick(0.225);                          // 3 sub-ticks at 0.075 -> 30 classic minutes
  assert.equal(d.minutes, 30);
  assert.equal(d.vitalTicks, 0);          // no full hour yet
  s.tick(0.225);
  assert.equal(d.minutes, 60);
  assert.equal(d.vitalTicks, 1);          // the hour landed one vitals tick
  assert.equal(s.hoursRemaining, 2);
  // Loiter runs slower: the same real time buys fewer sub-ticks
  const dl = deps();
  const sl = new RestSession('loiter', 2, dl);
  sl.tick(0.45);                          // floor(0.45 / 0.125) = 3 sub-ticks
  assert.equal(dl.minutes, 30);
});

test('rest: completions - timed wakes on 353, full ends healed on 350 (instantly when already), loiter 349 with NO vitals', () => {
  // Timed: the final hour returns the wake text
  const d = deps();
  const s = new RestSession('timed', 1, d);
  const r = s.tick(REST_WAIT_PER_HOUR + 0.01);
  assert.deepEqual(r, { textId: REST_TEXT.wakeUp, enemyBroke: false, died: false });
  assert.equal(d.vitalTicks, 1);
  // Full rest: tickVitals returning healed ends on "You are healed."
  const d2 = deps({ tickVitals() { d2.vitalTicks++; return d2.vitalTicks >= 2; } });
  d2.vitalTicks = 0;
  const s2 = new RestSession('full', 0, d2);
  assert.equal(s2.tick(REST_WAIT_PER_HOUR + 0.01), null);
  const r2 = s2.tick(REST_WAIT_PER_HOUR + 0.01);
  assert.equal(r2.textId, REST_TEXT.healed);
  // Starting a full rest already healed ends immediately, no hour waited
  const d3 = deps({ fullyHealed: () => true });
  const r3 = new RestSession('full', 0, d3).tick(0.01);
  assert.equal(r3.textId, REST_TEXT.healed);
  assert.equal(d3.minutes, 0);
  // Loiter: hours pass, vitals never tick, ends on 349
  const d4 = deps({ tickVitals() { throw new Error('loiter recovered vitals'); } });
  const s4 = new RestSession('loiter', 1, d4);
  const r4 = s4.tick(LOITER_WAIT_PER_HOUR + 0.01);
  assert.equal(r4.textId, REST_TEXT.loiterDone);
  assert.equal(d4.minutes, 60);
  // SETT: a live store read now; with no override it reports DFU's
  // shipped LoiterLimitInHours=3, the classic cap the window enforces
  assert.equal(loiterLimitHours(), 3);
  // AUDIT 18: a 0-hour timed request ends on the FIRST frame with no
  // time passing - DaggerfallRestWindow.Update tests
  // `hoursRemaining < 1` BEFORE calling TickRest (:225-226). The
  // pinned-quirk shape (one full hour) was never DFU's.
  const d5 = deps();
  const r5 = new RestSession('timed', 0, d5).tick(0.4);
  assert.equal(r5.textId, REST_TEXT.wakeUp);
  assert.equal(d5.minutes, 0);
  assert.equal(d5.vitalTicks, 0);
});

test('rest: interrupts - enemies break at the hour on 354 (before vitals), death ends at once, endEarly texts', () => {
  const d = deps({ enemiesNearby: () => true, tickVitals() { throw new Error('vitals ticked past an enemy break'); } });
  const s = new RestSession('timed', 5, d);
  const r = s.tick(REST_WAIT_PER_HOUR + 0.01);
  assert.deepEqual(r, { textId: REST_TEXT.enemiesNearby, enemyBroke: true, died: false });
  assert.equal(d.minutes, 60);   // the hour's time still passed
  // Death (disease/poison through the raised hours) ends immediately -
  // the death screen owns the message
  const d2 = deps({ dead: () => true });
  const r2 = new RestSession('full', 0, d2).tick(0.01);
  assert.ok(r2.died);
  assert.equal(r2.textId, null);
  // The early end (Escape / the rest key): the mode's own finish text
  assert.equal(new RestSession('timed', 4, deps()).endEarly().textId, REST_TEXT.wakeUp);
  assert.equal(new RestSession('loiter', 2, deps()).endEarly().textId, REST_TEXT.loiterDone);
});
