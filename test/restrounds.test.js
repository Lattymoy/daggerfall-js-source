// REST-ROUNDS (Discord, 2026-09-27: "So, when you rest, spell effects don't wear off. I found this out while training
// my magic skills. As such, you can stack them for thousands of rounds ... I've acomplished permanent true
// invisibility, waterbreathing, regenerate health, etc.").
//
// Offline a rested hour is sixty magic rounds: the ticker's RaiseTime runs the jump through the one tick. Online the
// shared clock is nobody's to move (WORLD5), so the same RaiseTime ran the world's few real seconds - and RESTX2's
// sub-tick end, the session's own minute, reached the encounter roll and the dungeon's arm and nothing else. A night
// outdoors or in a building healed every hour and aged no effect; cast, rest the magicka back, cast again, and the
// incumbent's rounds stacked for good. The ticker spends that minute on the rounds now, as the dungeon's arm does.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createPlayerTicker } from '../src/scenes/shared.js';
import { RestSession, REST_WAIT_PER_HOUR, REST_TEXT } from '../src/systems/restSession.js';
import { setSharedClock, setWorldMinutes, alignEntityClocks, resetMagicRoundMarker } from '../src/systems/worldTick.js';
import { applySpell } from '../src/systems/effects.js';
import { newSurvival } from '../src/systems/survival/needs.js';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import { RACES } from '../src/systems/races.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** Regenerate (18,255) cast on self - the report's own "regenerate health" - for 600 rounds. */
const REGENERATE = { element: 4, rangeType: 0, effects: [{ type: 18, subType: 255, magnitudeBaseLow: 1, magnitudeBaseHigh: 1, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 0, durationBase: 600, durationMod: 0, durationPerLevel: 0 }] };
const player = () => ({
  isPlayer: true, name: 'P', raceId: RACES.Breton, level: 1, health: 50, maxHealth: 50, magicka: 10, maxMagicka: 10, fatigue: 3200,
  stats: { strength: 50, endurance: 50, willpower: 50, agility: 50, luck: 50, intelligence: 50, personality: 50, speed: 50 },
  skills: 30, skillUses: [], items: [], career: {}, activeEffects: [],
});
const cast = (e) => applySpell(REGENERATE, 1, e, {}, () => 0);
const regen = (e) => e.activeEffects.find((a) => a.kind === 'regenerate')?.roundsRemaining ?? 0;

/** One lane's world: offline the port's own clock at 1000, online a shared clock the test moves. */
function lane(online, tickerOpts = {}) {
  const e = player();
  const t = { clock: 1000.4 };
  if (online) {
    setSharedClock(() => t.clock);
    alignEntityClocks(e, Math.floor(t.clock));
  } else {
    setSharedClock(null);
    setWorldMinutes(1000);
    e.lastGameMinutes = 1000;
  }
  resetMagicRoundMarker(1000);
  const ticker = createPlayerTicker(e, tickerOpts);
  /** A rested night through the REAL session, with the hosts' rest dep: `(n, sharedEnd) => ticker.advance(n, sharedEnd)`.
   *  The shared clock moves as the real seconds do (TimeScale 12: a rested hour's 0.75 s is 9 game seconds). */
  const rest = (hours) => {
    const s = new RestSession('timed', hours, {
      advanceMinutes: (n, sharedEnd) => ticker.advance(n, sharedEnd),
      tickVitals: () => false, enemiesNearby: () => false, fullyHealed: () => false, dead: () => false,
      sharedMinutes: online ? () => t.clock : () => null,
    });
    let r = null;
    for (let i = 0; i < 10000 && !r; i++) { if (online) t.clock += (REST_WAIT_PER_HOUR * 12) / 60 / 6; r = s.tick(REST_WAIT_PER_HOUR / 6); }
    return r;
  };
  return { e, t, ticker, rest };
}
const done = () => setSharedClock(null);

test('REST-ROUNDS: an eight-hour rest ONLINE ages a spell effect by its 480 rounds, as the same night offline does', () => {
  try {
    const off = lane(false);
    cast(off.e);
    const castRounds = regen(off.e);
    assert.equal(off.rest(8)?.textId, REST_TEXT.wakeUp);
    const on = lane(true);
    cast(on.e);
    assert.equal(regen(on.e), castRounds);
    assert.equal(on.rest(8)?.textId, REST_TEXT.wakeUp);
    assert.equal(regen(off.e), castRounds - 480, 'offline: sixty rounds a rested hour (the control)');
    assert.equal(regen(on.e), regen(off.e), 'online: the same night, the same rounds - it was every round of the cast');
  } finally { done(); }
});

test('REST-ROUNDS: the exploit as reported - cast, rest the magicka back, cast again - stacks no more online than offline', () => {
  try {
    const cycle = (l) => { for (let i = 0; i < 3; i++) { cast(l.e); l.rest(8); } return regen(l.e); };
    const off = cycle(lane(false));
    const on = cycle(lane(true));
    assert.equal(on, off, 'three casts and three nights');
    const single = lane(true);
    cast(single.e);
    assert.ok(on < 3 * regen(single.e) - 1000, `the three nights took their ${3 * 480} rounds (left ${on})`);
  } finally { done(); }
});

test('REST-ROUNDS: after an online night the frames re-anchor on the shared clock - the night is never run twice - and real time ticks on', () => {
  try {
    const on = lane(true);
    cast(on.e);
    on.rest(8);
    const morning = regen(on.e);
    for (let f = 0; f < 30; f++) { on.t.clock += 0.02; on.ticker.tick(1 / 60); }
    assert.equal(regen(on.e), morning, 'thirty frames later: the rested window was not claimed again');
    on.t.clock += 5;
    on.ticker.tick(1 / 60);
    assert.equal(regen(on.e), morning - 5, 'and five game minutes are five rounds');
  } finally { done(); }
});

test('REST-ROUNDS: the rested window is fanned out to the foe pools too - one broker event, every manager', () => {
  try {
    const on = lane(true);
    const foe = { entity: player() };
    cast(foe.entity);
    const before = regen(foe.entity);
    const windows = [];
    on.ticker.subscribe((from, to) => { windows.push(to - from); for (let r = from; r < to; r++) foe.entity.activeEffects.forEach((a) => { if (a.roundsRemaining > 0) a.roundsRemaining--; }); });
    on.rest(2);
    assert.equal(windows.reduce((a, b) => a + b, 0), 120, 'two hours of rounds reached the subscriber');
    assert.equal(regen(foe.entity), before - 120);
  } finally { done(); }
});

test('REST-ROUNDS by source: every rest the four hosts drive hands the sub-tick\'s end to its rounds - the ticker (outdoors, the party mirror, a building, the fixed city) or the dungeon\'s own arm', () => {
  const hosts = { 'src/scenes/world.js': 2, 'src/scenes/worldModes.js': 1, 'src/scenes/dungeonContext.js': 1, 'src/scenes/exterior.js': 1 };
  for (const [f, want] of Object.entries(hosts)) {
    const s = src(f);
    const bodies = [...s.matchAll(/advanceMinutes: \(n, sharedEnd\) => ([^\n]*)/g)].map((m) => m[1]);
    assert.equal(bodies.length, want, `${f}: its rest deps take the sub-tick's end`);
    for (const b of bodies) assert.match(b, /(?:playerTicker|interiorTicker)\.advance\(n, sharedEnd\)|_restAdvance\(n, sharedEnd\)/, `${f}: ...and spend it on the rounds: ${b.slice(0, 80)}`);
  }
  // the one session call that hands it over, in every lane
  assert.match(src('src/systems/restSession.js'), /this\.deps\.advanceMinutes\(MINUTES_PER_TICK, online \? this\._onlineSimMinutes : null\);/);
});

/** A bed at noon in the town - the host's reader while the player sleeps (world.js survivalEnv: `resting`, and
 *  `sleeping` the rest's kind). */
const BED = { climateIndex: 232, month: 6, hour: 12, weather: 'sunny', inSunlight: false, resting: true, sleeping: 'bed', byFire: false, insideBuilding: true };

test('REST-ROUNDS / AUDIT RISE-REST F2: an online night in a bed pays the NEEDS as the offline night does - the sleep debt cleared, the thirst risen - where it paid a minute of them', () => {
  _resetForTests(); setPref('survival', 'hard');
  try {
    const night = (online) => {
      const l = lane(online, { survivalEnv: () => BED });
      l.e.survival = newSurvival(1000);
      l.e.survival.sleepDebt = 10;   // ten hours owed (the debt is hours; a bed pays 1.5 an hour)
      assert.equal(l.rest(8)?.textId, REST_TEXT.wakeUp);
      return { ...l.e.survival };
    };
    const off = night(false);
    const on = night(true);
    assert.equal(off.sleepDebt, 0, 'the control: offline eight hours in a bed cleared ten owed');
    assert.ok(off.thirst > 0, 'and the night was thirsty');
    assert.equal(on.sleepDebt, off.sleepDebt, 'online: the same debt paid - it paid a minute of it');
    assert.equal(on.thirst, off.thirst, 'and the same thirst');
    assert.equal(on.lastMinute, 1480, 'the record\'s marker stands at the night\'s end, ahead of the world, so the next frame pays it no second time');
  } finally { _resetForTests(); done(); }
});
