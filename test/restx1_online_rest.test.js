import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { RestSession, REST_TEXT, FREE_REST_HOUR_CAP, MINUTES_PER_TICK } from '../src/systems/restSession.js';

// ═══ RESTX1: ONLINE, A REST WAITS FOR NOTHING ═════════════════════
//
// Mac, 2026-09-15: "for online I want to change the rest mechanic to
// not use any time. Basically rest just becomes the way to regain."
//
// The thing that was actually wrong is not the obvious one. Online a
// rest has never been able to MOVE the clock - `worldTick
// .setWorldMinutes` refuses every local write while the shared clock
// stands - so WORLD5 made the rest honest by PACING it off that clock.
// Correct, and the price was the whole complaint: an hour is five real
// minutes at DFU's TimeScale, so eight hours of rest is forty real
// minutes of watching a counter.
//
// The waiting is gone. What these pins hold is that the LADDER did not
// go with it: the same hours, the same per-hour vitals, the same enemy
// checks, the same rent - and no minutes, because none were available.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

/** The session's host deps, counting everything a rest can spend. */
const deps = (over = {}) => {
  const d = {
    minutes: 0, quests: 0, hours: 0, ends: [],
    advanceMinutes(n, end) { d.minutes += n; d.ends.push(end); },
    tickQuests() { d.quests++; },
    tickVitals() { d.hours++; return false; },
    enemiesNearby: () => false, fullyHealed: () => false, dead: () => false,
    ...over,
  };
  return d;
};
/** Online is "the shared clock is standing" - the one thing the session
 *  can see, and exactly what `createRestDeps` hands it. */
const ONLINE = () => 8000;
const OFFLINE = () => null;

test('RESTX1: a rest ONLINE resolves at once and spends NOTHING - no minutes, no quest ticks', () => {
  let healed = false;
  const d = deps({ sharedMinutes: ONLINE, tickVitals() { d.hours++; healed = d.hours >= 6; return healed; }, fullyHealed: () => healed });
  const s = new RestSession('full', 0, d);
  const r = s.tick(1 / 60);   // ONE frame
  assert.equal(r?.textId, REST_TEXT.healed, 'one frame, and the rest is finished - "You are healed."');
  assert.equal(d.hours, 6, 'the hours really ran: six hours of vitals');
  assert.equal(s.totalHours, 6);
  assert.equal(d.minutes, 0, 'AND NOT ONE MINUTE PASSED - the whole point');
  assert.equal(d.quests, 0, 'no minutes means no quest tick, no magic round, no disease, no encounter');
  assert.deepEqual(d.ends, [], 'the host is never handed a span it would have to read a clock for');
});

test('RESTX1: a TIMED rest online spends its hours at once, and the dial still means hours of regain', () => {
  const d = deps({ sharedMinutes: ONLINE });
  const s = new RestSession('timed', 8, d);
  const r = s.tick(1 / 60);
  assert.equal(r?.textId, REST_TEXT.wakeUp);
  assert.equal(d.hours, 8, 'eight hours asked for, eight hours of vitals paid');
  assert.equal(d.minutes, 0);
  assert.equal(d.quests, 0);
});

test('RESTX1: OFFLINE is untouched - the window’s own timer still paces every mode', () => {
  // The offline lane is DFU's, and nothing here may reach it: a frame
  // of 1/60 s banks less than one sub-tick's wait, so one frame moves
  // ten minutes at most and the rest goes on.
  const d = deps({ sharedMinutes: OFFLINE });
  const s = new RestSession('timed', 8, d);
  for (let f = 0; f < 5; f++) assert.equal(s.tick(1 / 60), null, 'five frames is not eight hours');
  assert.equal(d.hours, 0, 'not one hour yet');
  assert.equal(d.minutes, MINUTES_PER_TICK, 'one sub-tick of real time, as the timer always gave');
  assert.ok(d.quests >= 1, 'and offline the quest machine still rides the rested minutes');
});

test('RESTX1: LOITER online still WAITS - passing time is the whole of what loiter is for', () => {
  // The distinction is the design, not an oversight. Loiter recovers
  // nothing by design; a loiter that resolved at once would do
  // literally nothing. Online it rides the shared clock exactly as
  // WORLD5 left it, and test/auditworld5.test.js C7/C8 hold that.
  let clock = 8000;
  const d = deps({ sharedMinutes: () => clock });
  const s = new RestSession('loiter', 2, d);
  assert.equal(s.tick(1 / 60), null, 'the clock has not moved, so neither has the loiter');
  assert.equal(d.minutes, 0);
  let r = null;
  for (let i = 0; i < 40 && !r; i++) { clock += MINUTES_PER_TICK; r = s.tick(1 / 60); }
  assert.equal(r?.textId, REST_TEXT.loiterDone);
  assert.equal(d.minutes, 120, 'two hours of loiter is two hours of the WORLD’s clock, taken as it passes');
  assert.equal(s.totalHours, 2);
});

test('RESTX1: the ladder is the same ladder - a foe, a prevented rest and the rent all still land, per hour', () => {
  // A free rest is not a shortcut past the rules. Every rung DFU runs
  // between the hours still runs; only the waiting between them is gone.
  let foes = false;
  const dFoe = deps({ sharedMinutes: ONLINE, tickVitals() { dFoe.hours++; foes = dFoe.hours >= 3; return false; }, enemiesNearby: () => foes });
  const sFoe = new RestSession('timed', 9, dFoe);
  const rFoe = sFoe.tick(1 / 60);
  assert.equal(rFoe?.enemyBroke, true, 'the foe that wandered in on the third hour broke the rest');
  assert.equal(dFoe.hours, 3, 'and it broke it THERE - the remaining six hours were not paid');

  let block = null;
  const dStop = deps({ sharedMinutes: ONLINE, preventedRestMessage: () => block, tickVitals() { dStop.hours++; block = dStop.hours >= 2 ? 'The ritual is not finished.' : null; return false; } });
  const sStop = new RestSession('timed', 9, dStop);
  const rStop = sStop.tick(1 / 60);
  assert.equal(rStop?.prevented, true);
  assert.equal(rStop?.text, 'The ritual is not finished.');
  assert.equal(dStop.hours, 2);

  const dRent = deps({ sharedMinutes: ONLINE });
  const sRent = new RestSession('timed', 9, dRent, 3);   // three hours left on the room
  const rRent = sRent.tick(1 / 60);
  assert.equal(rRent?.rentExpired, true, 'the room ran out on the third hour and the landlord still speaks');
  assert.equal(dRent.hours, 3);
});

test('RESTX1: a free rest yields the frame at the cap, and picks the rest up on the next one', () => {
  // The cap is a CHUNK, not a stop: `full` has no counter of its own,
  // so nothing else would stop one frame spinning. It always converges
  // anyway - a free rest passes no minutes for a disease to drain
  // through, and all three recovery rates clamp above zero - so this is
  // insurance. Driven, because an untested guard is a guess.
  let healed = false;
  const d = deps({ sharedMinutes: ONLINE, tickVitals() { d.hours++; healed = d.hours >= FREE_REST_HOUR_CAP + 10; return healed; }, fullyHealed: () => healed });
  const s = new RestSession('full', 0, d);
  assert.equal(s.tick(1 / 60), null, 'the first frame took its chunk and yielded');
  assert.equal(d.hours, FREE_REST_HOUR_CAP, 'exactly the cap, and not one hour more');
  assert.equal(s.tick(1 / 60)?.textId, REST_TEXT.healed, 'the next frame finishes it');
  assert.equal(d.hours, FREE_REST_HOUR_CAP + 10);
  assert.equal(d.minutes, 0, 'and still not one minute, over both frames');
});

test('AUDIT RESTX F1: in the free lane an hour that heals nothing pays nothing - the rate limit time used to provide', () => {
  // `restVitals` tallies Medical every hour, and in DFU that tally is
  // rate-limited by the hour COSTING TIME. RESTX1 removed the cost and
  // the rate limit went with it: a timed rest at full health called
  // tickVitals unconditionally, so "rest 99 hours" was 99 Medical
  // tallies in one frame, on one click, repeatable for ever. Offline
  // the same 99 hours costs 74 real seconds of watching a counter,
  // which is the limit DFU was relying on.
  //
  // Pinned by COUNT, from three sides: nothing is paid for an hour that
  // heals nothing, every healing hour still is, and the PACED lanes
  // keep DFU's unconditional tally because there the hour was spent.
  const run = (mode, hours, { free, healed }) => {
    let paid = 0;
    const d = deps({
      sharedMinutes: free ? ONLINE : OFFLINE,
      tickVitals() { paid++; return false; },
      fullyHealed: () => healed,
    });
    const s = new RestSession(mode, hours, d);
    let r = null;
    for (let f = 0; f < 400 && !r; f++) r = s.tick(free ? 1 / 60 : 1);
    return { paid, hours: s.totalHours };
  };
  assert.equal(run('timed', 99, { free: true, healed: true }).paid, 0,
    'FREE and already whole: ninety-nine hours asked for, nothing paid - the farm is closed');
  assert.equal(run('timed', 99, { free: true, healed: false }).paid, 99,
    'FREE and hurt: every hour that heals still pays, so the mechanic is unchanged for the player it is for');
  assert.equal(run('timed', 9, { free: false, healed: true }).paid, 9,
    'PACED (offline): DFU\u2019s unconditional tally stands - there the hour really was spent');
  // ...and the mode that already had the guard is untouched: `full`
  // returns at the top of tick() when whole, so it never reaches here.
  const dFull = deps({ sharedMinutes: ONLINE, fullyHealed: () => true });
  assert.equal(new RestSession('full', 0, dFull).tick(1 / 60)?.textId, REST_TEXT.healed);
  assert.equal(dFull.hours, 0, 'a `full` rest by a whole body pays nothing and never did');
});

test('RESTX1: the law is read off the SHARED CLOCK, in one place, and the hosts are not asked', () => {
  // OL1's shape: a lane is not forced at a mount site, because a port
  // that forces at forty-seven sites is a port where the forty-eighth
  // is missed. The session asks `sharedMinutes` - the dep it already
  // had - and the four hosts are untouched by this slice.
  const src = read('src/systems/restSession.js');
  assert.match(src, /_free\(\) \{\s*\n\s*return this\.mode !== 'loiter' && Number\.isFinite\(this\.deps\.sharedMinutes\?\.\(\)\);/,
    'the predicate is the mode and the shared clock, and nothing else');
  // the ONE place time is spent, and it is inside the gate
  const loop = src.slice(src.indexOf('while (this._takeSubTick()) {'), src.indexOf('this._minutesOfHour += MINUTES_PER_TICK;'));
  assert.match(loop, /if \(!this\._free\(\)\) \{/, 'the clock jump is not gated');
  assert.match(loop, /this\.deps\.advanceMinutes\(MINUTES_PER_TICK, this\._sharedAt\);/);
  assert.match(loop, /this\.deps\.tickQuests\?\.\(\);/, 'the quest tick rides the same sub-tick and must share its gate');
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) {
    assert.doesNotMatch(read(host), /_free\(\)|FREE_REST_HOUR_CAP/, `${host}: THE FOUR HOSTS - the lane is read in the session, not spelled at a mount site`);
  }
});
