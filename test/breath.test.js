// P18: the underwater breath laws - PlayerEntity.FixedUpdate's clause
// (PlayerEntity.cs:322-343) and the DeepBreath guild fold
// (GuildManager.cs:388-394 / Temple.cs:440-448). The classic-update
// cadence and the submergence geometry are the host's
// (dungeonContext.breathTick) and stay under the host suites.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deepBreath, breathStep } from '../src/systems/breath.js';
import { maxBreath } from '../src/systems/statMods.js';
import { RACES } from '../src/systems/races.js';
import { templeOf } from '../src/systems/guildVariants.js';
import { GUILDS, joinGuild } from '../src/systems/guilds.js';

const NOW = { year: 405, dayOfYear: 1 };

test('breath: DeepBreath is the identity for every guild but Kynareth', () => {
  assert.equal(deepBreath(undefined, 25), 25);
  assert.equal(deepBreath({}, 25), 25);
  const memberships = {};
  joinGuild(memberships, GUILDS.FightersGuild, NOW);
  joinGuild(memberships, templeOf('Mara'), NOW);   // a TEMPLE, but not Kynareth's
  memberships[templeOf('Mara').guildGroup].rank = 9;
  assert.equal(deepBreath(memberships, 25), 25);
});

test('breath: Kynareth scales the refill by (10 + rank) / 10, truncated - the whole rank ladder', () => {
  // Temple.DeepBreath (Temple.cs:445): (int)(((10f + rank) / 10) * duration),
  // on doubles per the Ledger A FaceUVTool row (Mono widens float math).
  const memberships = {};
  const m = joinGuild(memberships, templeOf('Kynareth'), NOW);
  const ladder = [];
  for (let rank = 0; rank <= 9; rank++) {
    m.rank = rank;
    ladder.push(deepBreath(memberships, 25));
  }
  assert.deepEqual(ladder, [25, 27, 30, 32, 35, 37, 40, 42, 45, 47]);
  // The precision edge the Mono call decides: rank 4 x 45 is 62 on
  // doubles where float32 arithmetic lands on 63.
  m.rank = 4;
  assert.equal(deepBreath(memberships, 45), 62);
  // Another guild in the fold changes nothing (identity chain).
  joinGuild(memberships, GUILDS.FightersGuild, NOW);
  assert.equal(deepBreath(memberships, 45), 62);
});

test('breath: a dive from empty fills through the guild fold, and the 19th classic update drains', () => {
  const entity = { stats: { endurance: 50 }, raceId: RACES.Breton, guildMemberships: {} };
  const m = joinGuild(entity.guildMemberships, templeOf('Kynareth'), NOW);
  m.rank = 5;
  assert.equal(maxBreath(entity), 25);
  const state = { tally: 0 };
  assert.equal(breathStep(entity, true, state), null);
  assert.equal(entity.currentBreath, 37, 'DeepBreath(MaxBreath): trunc(1.5 * 25)');
  // breathUpdateTally: 18 more updates increment; the one after drains.
  for (let i = 0; i < 18; i++) breathStep(entity, true, state);
  assert.equal(entity.currentBreath, 37);
  breathStep(entity, true, state, () => 0);
  assert.equal(entity.currentBreath, 36);
  assert.equal(state.tally, 0, 'the drain resets the tally');
  // Surfacing zeroes the counter (:342); WaterBreathing while
  // submerged rides the same else (:323 gates the whole clause).
  breathStep(entity, false, state);
  assert.equal(entity.currentBreath, 0);
  entity.activeEffects = [{ kind: 'waterBreathing' }];
  entity.currentBreath = 12;
  breathStep(entity, true, state);
  assert.equal(entity.currentBreath, 0);
});

test('breath: the Argonian coin refund rides the SAME tick as the drain (PlayerEntity.cs:331-333)', () => {
  const drainTick = (entity, roll) => {
    const state = { tally: 19 };   // past 18: this step drains
    return breathStep(entity, true, state, roll);
  };
  // Range(0, 2) == 1 re-adds the point; 0 does not; the race gates it.
  const argonian = { stats: { endurance: 50 }, raceId: RACES.Argonian, currentBreath: 20 };
  drainTick(argonian, () => 1);
  assert.equal(argonian.currentBreath, 20, 'drain then refund, net zero');
  drainTick(argonian, () => 0);
  assert.equal(argonian.currentBreath, 19);
  const breton = { stats: { endurance: 50 }, raceId: RACES.Breton, currentBreath: 20 };
  drainTick(breton, () => 1);
  assert.equal(breton.currentBreath, 19, 'the coin is Argonian-only');
  // The refund lands BEFORE the drowned check: an Argonian at 1 breath
  // whose coin lands 1 does NOT drown on that tick.
  argonian.currentBreath = 1;
  assert.equal(drainTick(argonian, () => 1), null);
  assert.equal(argonian.currentBreath, 1);
  assert.equal(drainTick(argonian, () => 0), 'drowned');
  assert.equal(argonian.currentBreath, 0);
});

test('AUDIT 26 F117: the step records IsPlayerSubmerged, which the death door reads', () => {
  // Temple.AvoidDeath (Temple.cs:452) reads
  // PlayerEnterExit.IsPlayerSubmerged at the killing blow, and the
  // port's one damage door has no geometry to answer it with. The
  // host already hands the flag to breathStep every classic update, so
  // it is recorded here rather than computed twice.
  const e = { health: 20, maxHealth: 20, currentBreath: 10, raceId: RACES.Breton };
  breathStep(e, true, { tally: 0 });
  assert.equal(e.submerged, true);
  breathStep(e, false, { tally: 0 });
  assert.equal(e.submerged, false, 'and surfacing clears it');
});
