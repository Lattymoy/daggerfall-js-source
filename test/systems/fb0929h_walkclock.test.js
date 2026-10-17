// FIELD BUGS 2026-09-29h (WALK-CLOCK) - ThetaDecay: "Guild rank time not advancing (online). I tried traveling back and
// forth between towns, which took 32 total days. I met all the reqs for a guild rank bump and wasn't able to get one."
// Mac, on the batch's first answer: "Dont worry abour DFU."
//
// A guild's 28 days (Guild.cs) are stamped and read on the character's own clock (LIVED1). Online the shared clock is the
// world's and moves for nobody, and the frame's tick reads it alone - so an accelerated walk (Travel Options' walk, the
// Overworld's journey) charged the character's clock its REAL minutes: a thirty-two-day ride, a few hours lived. The
// walk's minutes past the world's are raised on the character's own clock now, the door a rest already uses.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPlayerTicker } from '../../src/scenes/shared.js';
import {
  setSharedClock, setWorldMinutes, ownMinutes, setOwnMinutes, alignEntityClocks, resetMagicRoundMarker, sharedClockOn,
  CLASSIC_MINUTES_PER_SECOND, MINUTES_PER_DAY,
} from '../../src/systems/worldTick.js';
import { dateFromClassicMinutes } from '../../src/systems/gameDate.js';
import { daySinceZero, DAYS_BETWEEN_RANK_CHANGES } from '../../src/systems/guild/guilds.js';
import { RACES } from '../../src/systems/races.js';

afterEach(() => { setSharedClock(null); });

const W = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
/** The frame's own raise, lifted off world.js. */
function walkRaiseOf() {
  const m = /\n\s*const walkRaise = ([^\n]+);\n/.exec(W);
  assert.ok(m, 'the frame no longer names its walk raise');
  // eslint-disable-next-line no-new-func
  return new Function('sharedClockOn', 'travelScale', 'dt', 'CLASSIC_MINUTES_PER_SECOND', `return ${m[1]};`);
}
const player = () => ({
  isPlayer: true, name: 'P', raceId: RACES.Breton, level: 5, health: 60, maxHealth: 60, magicka: 10, maxMagicka: 10, fatigue: 6000,
  stats: { strength: 50, endurance: 50, willpower: 50, agility: 50, luck: 50, intelligence: 50, personality: 50, speed: 50 },
  skills: 30, skillUses: [], items: [], career: {}, activeEffects: [],
});

test('WALK-CLOCK: the frame raises the walk\'s minutes past the world\'s - online, and only while the clock is accelerated; the tick is handed it (mutants: never raised; raised offline)', () => {
  const raise = walkRaiseOf();
  assert.equal(raise(() => true, 40, 1, CLASSIC_MINUTES_PER_SECOND), 39 * CLASSIC_MINUTES_PER_SECOND, 'x40 online: 39 of every 40 minutes the world did not move');
  assert.equal(raise(() => true, 1, 1, CLASSIC_MINUTES_PER_SECOND), 0, 'x1: the world\'s own minutes are the walk\'s');
  assert.equal(raise(() => false, 40, 1, CLASSIC_MINUTES_PER_SECOND), 0, 'offline the scaled dt charges the one calendar');
  assert.match(W, /\n\s*\}, dt \* timeScaleMult \* travelScale, walkRaise\);/, 'the frame\'s tick is handed the raise (and the real seconds it always had)');
});

test('WALK-CLOCK: thirty-two days walked at x40 online are thirty-two days of the character\'s - a guild\'s wait opens, and the world\'s clock moved its real minutes alone', () => {
  const raise = walkRaiseOf();
  const t = { clock: 100 * MINUTES_PER_DAY };
  setSharedClock(() => t.clock);
  setOwnMinutes(t.clock);
  const e = player();
  e.lastGameMinutes = t.clock;
  alignEntityClocks(e, t.clock);
  resetMagicRoundMarker(t.clock);
  const ticker = createPlayerTicker(e);
  const joined = daySinceZero(dateFromClassicMinutes(ownMinutes()));
  const S = 40, dt = 10;   // ten real seconds a frame, for the pin's pace
  const frames = Math.round((32 * MINUTES_PER_DAY) / (S * dt * CLASSIC_MINUTES_PER_SECOND));
  const world0 = t.clock, own0 = ownMinutes();
  for (let i = 0; i < frames; i++) {
    t.clock += dt * CLASSIC_MINUTES_PER_SECOND;   // the relay's clock, at the classic rate
    ticker.tick(dt * S, { running: false, runningTally: false, swimming: false }, dt * S, raise(sharedClockOn, S, dt, CLASSIC_MINUTES_PER_SECOND));
  }
  const lived = ownMinutes() - own0, worldMoved = t.clock - world0;
  assert.ok(Math.abs(lived - 32 * MINUTES_PER_DAY) < 1, `the character lived the ride (${(lived / MINUTES_PER_DAY).toFixed(2)} days)`);
  assert.ok(Math.abs(worldMoved - (32 * MINUTES_PER_DAY) / S) < 1, 'the world\'s clock its real minutes alone');
  const today = daySinceZero(dateFromClassicMinutes(ownMinutes()));
  assert.ok(today >= joined + DAYS_BETWEEN_RANK_CHANGES, `the rank's 28 days are behind them (${today - joined})`);
});
