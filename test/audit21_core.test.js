// AUDIT 21 - the CORE-SYSTEMS lane. Five findings, each of which made a
// ported mechanic unreachable rather than merely wrong, and two pin-quality
// ones where the shipped code was right and reverting it was invisible.
//
// The shape they share is this project's most repeated: DEAD / NEVER-APPLIED
// CODE. A formula reads a field nothing mints, a caller drops an argument, a
// gate has no producer. Each pin below is behavioural - it drives the real
// function and asserts the observable outcome - because a source regex cannot
// see whether a computed value is used, which is exactly how F5 survived.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { makeEnemyEntity, loadMonsterCareer } from '../src/characters/enemyEntity.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { savingThrow, careerTolerance, EFFECT_FLAGS, ELEMENTS } from '../src/systems/spellcast.js';
import {
  adjustmentsToHit, adrenalineRushToHit, calculateSuccessfulHit,
  ADRENALINE_RUSH_MODIFIER, IMPROVED_ADRENALINE_RUSH_MODIFIER,
} from '../src/combat/formulas.js';
import {
  tickPlayerMinutes, worldMinutes, setWorldMinutes, advanceWorldMinutes,
  resetMagicRoundMarker, MAX_CATCHUP_ROUNDS, CLASSIC_MINUTES_PER_SECOND,
} from '../src/systems/worldTick.js';
import { silenceBlocksCast, isSilenced } from '../src/systems/mysticism.js';
import { buffKind } from '../src/systems/effects.js';
import { SPECIAL_ABILITY_BITS } from '../src/systems/specialAdvantages.js';
import { SKILLS } from '../src/systems/skills.js';
import { RACES } from '../src/systems/races.js';
import { FATIGUE_LOSS } from '../src/systems/statMods.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;
const fetchBytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));

const sinksFor = (log = {}) => ({
  hurt: (n) => { log.hurt = (log.hurt ?? 0) + n; },
  heal: () => {}, drainMagicka: () => {}, restoreMagicka: () => {},
  drainFatigue: (n) => { log.fatigue = (log.fatigue ?? 0) + n; },
  restoreFatigue: () => {}, say: () => {},
});

test('AUDIT 21 F1: an enemy CARRIES its career, so tolerances are not all Normal',
  { skip: skipReal }, async () => {
    // EnemyEntity.SetEnemyCareer keeps the parsed ENEMY{nnn}.CFG record, and
    // DaggerfallEntity.Career is what SavingThrow reads for all seven
    // tolerance channels (FormulaHelper.cs:1478-1526). makeEnemyEntity took
    // `career` as an argument, flattened ONE field out of it, and dropped the
    // rest - so `target.career ?? {}` was an empty object and every enemy in
    // the game read Normal to Fire, Frost, Shock, Magic, Poison, Disease and
    // Paralysis.
    const career = await loadMonsterCareer(26, fetchBytes);      // Fire Daedra
    assert.ok(career, 'the Fire Daedra career must load from the real archive');
    assert.equal(career.immunityFlags, 0x08, 'ENEMY026.CFG carries Fire immunity');
    assert.equal(careerTolerance(career, EFFECT_FLAGS.Fire), 'Immune');

    const e = makeEnemyEntity(26, ENEMY_BASICS[26], career, 5);
    assert.equal(e.career, career, 'the entity must CARRY the career, not just one field off it');

    // The consequence, measured rather than argued: an Immune target saves
    // fully on every roll (savingThrow >= 100 returns 0), where the empty
    // career rolled the ordinary 50-base save and let the daedra burn.
    for (let i = 0; i < 200; i++) {
      assert.equal(savingThrow(ELEMENTS.Fire, EFFECT_FLAGS.Fire, e), 0,
        'a Fire Daedra takes ZERO fire damage, every single roll');
    }
    // and a channel it is NOT immune to still rolls
    const frost = new Set();
    for (let i = 0; i < 200; i++) frost.add(savingThrow(ELEMENTS.Frost, EFFECT_FLAGS.Frost, e));
    assert.ok(frost.size > 1, 'Frost is not immune, so it still varies - the fix is not a blanket zero');
  });

test('AUDIT 21 F2: Adrenaline Rush is APPLIED, not merely decoded', () => {
  // FormulaHelper.cs:1163-1183, called from CalculateSuccessfulHit at :811.
  // The Ledger listed this as INERT "because the consuming subsystem does not
  // exist" - the consumer is CalculateSuccessfulHit, which is live.
  const rusher = (health, maxHealth) => ({
    career: { abilityFlagsAndSpellPointsBitfield: SPECIAL_ABILITY_BITS.adrenalineRush },
    health, maxHealth, isPlayer: true, stats: {}, skills: {},
  });
  const plain = (health, maxHealth) => ({
    career: { abilityFlagsAndSpellPointsBitfield: 0 },
    health, maxHealth, isPlayer: true, stats: {}, skills: {},
  });

  // maxHealth 96 -> the gate is health < 96/8 = 12, C# integer division.
  assert.equal(adrenalineRushToHit(rusher(11, 96), plain(50, 96)), ADRENALINE_RUSH_MODIFIER);
  assert.equal(adrenalineRushToHit(rusher(12, 96), plain(50, 96)), 0, 'strictly BELOW maxHealth/8');
  assert.equal(adrenalineRushToHit(plain(11, 96), plain(50, 96)), 0, 'no ability, no bonus');

  // the TARGET half SUBTRACTS - a near-dead rusher is easier to finish off
  assert.equal(adrenalineRushToHit(plain(50, 96), rusher(11, 96)), -ADRENALINE_RUSH_MODIFIER);
  // and both at once cancel, which is what the two independent ifs mean
  assert.equal(adrenalineRushToHit(rusher(11, 96), rusher(11, 96)), 0);

  // INTEGER DIVISION, not a float. maxHealth 100 -> C# `MaxHealth / 8` is 12,
  // not 12.5, so health 12 is NOT below the gate. A float gate would pay the
  // bonus here, which makes this the assertion that tells the two apart.
  assert.equal(adrenalineRushToHit(rusher(12, 100), plain(50, 100)), 0,
    'trunc(100/8) = 12, and 12 < 12 is false');
  assert.equal(adrenalineRushToHit(rusher(11, 100), plain(50, 100)), ADRENALINE_RUSH_MODIFIER);

  // the improved modifier is reachable if an enchantment ever mints it
  const improved = { ...rusher(11, 96), improvedAdrenalineRush: true };
  assert.equal(adrenalineRushToHit(improved, plain(50, 96)), IMPROVED_ADRENALINE_RUSH_MODIFIER);
  assert.notEqual(ADRENALINE_RUSH_MODIFIER, IMPROVED_ADRENALINE_RUSH_MODIFIER);

  // AND IT REACHES THE LADDER, which is the half a constants pin would miss -
  // the finding was that the value was computed and never added.
  //
  // Walk the hit roll until it flips and compare the boundary. chanceToHitMod
  // 80 puts the total safely inside the 3..97 clamp; at the fixture's default
  // the chance floors at 3 and BOTH flip at the same roll, which is how a
  // careless version of this pin would have passed.
  const target = { isPlayer: true, armor: 0, stats: { agility: 50, luck: 50 }, skills: {} };
  const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
  const flipAt = (attacker, mod) => {
    for (let r = 0; r < 100; r++) {
      if (!calculateSuccessfulHit(attacker, target, mod, 0, seq(0.5, r / 100))) return r;
    }
    return 100;
  };
  const stats = { agility: 50, luck: 50, speed: 50, strength: 50 };
  const rushA = { ...rusher(11, 96), stats }, plainA = { ...plain(11, 96), stats };
  assert.equal(flipAt(rushA, 80) - flipAt(plainA, 80), ADRENALINE_RUSH_MODIFIER,
    'the rush shifts the hit boundary by exactly its modifier');
  assert.equal(flipAt(rushA, 100) - flipAt(plainA, 100), ADRENALINE_RUSH_MODIFIER,
    'at a second point on the curve, so it is not a coincidence of one clamp');
});

test('AUDIT 21 F3: the biography avoid-hit modifier is read, and DFU SUBTRACTS it', () => {
  // FormulaHelper.cs:1236-1239. biography.js has minted this from the real
  // BIOG*.TXT since S3e/U13 and save.js has persisted it since AUDIT 17h;
  // adjustmentsToHit did not take the attacker/target discriminant at all,
  // and its comment claimed the questionnaire was "pending".
  const player = (mod) => ({ isPlayer: true, biographyAvoidHitMod: mod });
  assert.equal(adjustmentsToHit(player(0)), -50);
  // every populated BIOG*.TXT that carries the answer carries TH -5, and DFU
  // SUBTRACTS - so a negative TH is a PENALTY: the character is EASIER to hit
  assert.equal(adjustmentsToHit(player(-5)), -45, 'TH -5 makes the player easier to hit, not safer');
  assert.equal(adjustmentsToHit(player(5)), -55);
  assert.equal(adjustmentsToHit({ isPlayer: true }), -50, 'absent means zero, not NaN');

  // it applies ONLY to the player, which is what `target == player` means
  assert.equal(adjustmentsToHit({ isPlayer: false, isClass: true, biographyAvoidHitMod: -5 }), -50);
  // and the monster +40 still stands alongside it
  assert.equal(adjustmentsToHit({ isPlayer: false, isClass: false }), -10);
});

test('AUDIT 21 F4: magic rounds CATCH UP across a clock jump, capped at 2880', () => {
  // EntityEffectBroker.Update (:202-240) keeps its OWN lastGameMinute so that
  // "effects continue to operate during rest or fast travel". The port
  // anchored on whatever the clock read at the START of the frame, so minutes
  // added by anyone else produced ZERO rounds - rest a spell off for free.
  const before = worldMinutes();
  try {
    const mkEffect = () => ({
      kind: 'continuousDamage', roundsRemaining: 60, casterLevel: 1, saveScaled: false,
      effect: { magnitudeBaseLow: 1, magnitudeBaseHigh: 1, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1 },
    });
    const mk = () => ({ health: 500, maxHealth: 500, fatigue: 100000, magicka: 200, level: 1,
      skills: {}, activeEffects: [mkEffect()] });

    // an ordinary frame first, so the marker is established as it is in play
    const e = mk(); const log = {};
    setWorldMinutes(0); resetMagicRoundMarker(0);
    tickPlayerMinutes({ entity: e, classicMinutes: worldMinutes(), dt: 1 / 60, sinks: sinksFor(log) });

    advanceWorldMinutes(480);                     // an eight-hour rest
    const r = tickPlayerMinutes({ entity: e, classicMinutes: worldMinutes(), dt: 1 / 60, sinks: sinksFor(log) });
    assert.equal(r.rounds, 480, 'every minute somebody else added is a magic round');
    assert.equal(e.activeEffects.length, 0, 'a 60-round effect EXPIRES across an 8-hour rest');
    assert.equal(log.hurt, 60, 'and it dealt its 60 rounds of damage rather than being slept off free');

    // THE CAP. maxCatchupDays = 2 (EntityEffectBroker.cs:36). A 21-day prison
    // sentence steps the clock 30,240 minutes; without the cap the framework
    // spins on empty for all of them.
    const e2 = mk();
    setWorldMinutes(0); resetMagicRoundMarker(0);
    tickPlayerMinutes({ entity: e2, classicMinutes: worldMinutes(), dt: 1 / 60, sinks: sinksFor() });
    advanceWorldMinutes(30240);
    const r2 = tickPlayerMinutes({ entity: e2, classicMinutes: worldMinutes(), dt: 1 / 60, sinks: sinksFor() });
    assert.equal(r2.rounds, MAX_CATCHUP_ROUNDS);
    assert.equal(MAX_CATCHUP_ROUNDS, 2880, '2 days of game minutes');

    // A LOAD re-anchors instead of catching up - the clock moving BACKWARDS is
    // DFU's LoadInProgress case, and a restored save must not fire the cap's
    // worth of rounds against effects that expired in the saved game.
    const e3 = mk();
    setWorldMinutes(9000); resetMagicRoundMarker(9000);
    tickPlayerMinutes({ entity: e3, classicMinutes: worldMinutes(), dt: 1 / 60, sinks: sinksFor() });
    setWorldMinutes(20);                          // load an older save
    const r3 = tickPlayerMinutes({ entity: e3, classicMinutes: worldMinutes(), dt: 1 / 60, sinks: sinksFor() });
    assert.equal(r3.rounds, 0, 'a rewound clock fires no rounds at all');
    assert.equal(e3.activeEffects.length, 1, 'and the loaded effect is intact');
    // and the marker RE-ANCHORS rather than staying in the future: without
    // that, the loaded game's effects stay frozen until the clock climbs all
    // the way back to where the marker was left, which is the real cost and
    // is invisible on the rewind frame itself.
    advanceWorldMinutes(3);
    const r3b = tickPlayerMinutes({ entity: e3, classicMinutes: worldMinutes(), dt: 1 / 60, sinks: sinksFor() });
    assert.equal(r3b.rounds, 3, 'the frame AFTER a load ticks normally');

    // an ORDINARY frame is still exactly one round per classic minute
    const e4 = mk();
    setWorldMinutes(0); resetMagicRoundMarker(0);
    const r4 = tickPlayerMinutes({ entity: e4, classicMinutes: 0, dt: 5, sinks: sinksFor() });
    assert.equal(r4.rounds, 1, '5 real seconds at 12x is one classic minute, one round');
  } finally {
    setWorldMinutes(before);
    resetMagicRoundMarker(null);
  }
});

test('AUDIT 21 F5: Silence has a PRODUCER, so the gate it feeds can fire', () => {
  // The gate was ported (mysticism.js) and the effect was not, so
  // `entity.isSilenced` had no writer anywhere in src/ - the only two were
  // test fixtures - and silenceBlocksCast was a constant false for every
  // entity in the game while the file header said "SILENCE IS WIRED".
  //
  // The pin that let it through read dungeonContext.js with readFileSync and
  // matched a regex. A regex cannot see that the value the gate reads is
  // never produced, which is why this pin drives the fold instead.
  // Through the CLASSIC KEY, not a hand-built kind: the producer is the
  // (19,255) row in BUFF_KINDS, and a pin that builds `{ kind: 'silenced' }`
  // itself proves only that the fold reads what the test wrote.
  assert.equal(buffKind({ type: 19, subType: 255 }), 'silenced',
    "Silence.cs:29 MakeClassicKey(19, 255) - the row that gives the gate a producer");
  const silenced = { activeEffects: [{ kind: buffKind({ type: 19, subType: 255 }), roundsRemaining: 10 }] };
  const clear = { activeEffects: [] };

  assert.equal(isSilenced(silenced), true, 'the active effect IS the flag');
  assert.equal(isSilenced(clear), false);
  assert.equal(silenceBlocksCast(silenced), true);
  assert.equal(silenceBlocksCast(clear), false);
  // Silence.cs gates only spells that COST spell points (EntityEffectManager
  // :1934 sits inside the cost path) - a free cast goes through.
  assert.equal(silenceBlocksCast(silenced, { costsSpellPoints: false }), false);
  // the raw flag still forces it, so a host or a save can set it directly
  assert.equal(silenceBlocksCast({ isSilenced: true }), true);
  // and an expired bundle un-silences without anything having to clear a flag
  silenced.activeEffects.length = 0;
  assert.equal(silenceBlocksCast(silenced), false);
});

test('AUDIT 21 F8: an Argonian pays no swimming fatigue, and burns no roll for it', () => {
  // PlayerEntity.cs:410-415. C#'s `&&` short-circuits on the race test, so an
  // Argonian never pays the penalty AND never consumes the Dice100 - the same
  // roll-consumption law AUDIT 21 F5 found in the court.
  const mk = (raceId) => ({ health: 500, maxHealth: 500, fatigue: 100000, magicka: 200,
    level: 1, raceId, skills: { [SKILLS.Swimming]: 20 }, skillUses: {} });
  const swim = (raceId, rolls) => {
    const log = {};
    tickPlayerMinutes({ entity: mk(raceId), classicMinutes: 0, dt: 5, sinks: sinksFor(log),
      activity: { running: false, swimming: true }, rolls });
    return log.fatigue ?? 0;
  };
  // Swimming 20, roll 99 -> the FailedRoll succeeds -> the penalty lands
  assert.equal(swim(RACES.Breton, () => 0.99), FATIGUE_LOSS.Swimming);
  assert.equal(swim(RACES.Argonian, () => 0.99), FATIGUE_LOSS.Default,
    'an Argonian pays the DEFAULT loss in the water, never the swimming one');
  // and on a passed roll everyone pays the default, so the pin is not just
  // reading a constant
  assert.equal(swim(RACES.Breton, () => 0.01), FATIGUE_LOSS.Default);
  assert.notEqual(FATIGUE_LOSS.Swimming, FATIGUE_LOSS.Default);

  // THE SHORT-CIRCUIT. A roll drawn where DFU draws none shifts every later
  // roll from the same generator, so count the draws rather than the outcome.
  const counting = () => { draws++; return 0.99; };
  let draws = 0;
  tickPlayerMinutes({ entity: mk(RACES.Breton), classicMinutes: 0, dt: 5, sinks: sinksFor(),
    activity: { running: false, swimming: true }, rolls: counting });
  const bretonDraws = draws;
  draws = 0;
  tickPlayerMinutes({ entity: mk(RACES.Argonian), classicMinutes: 0, dt: 5, sinks: sinksFor(),
    activity: { running: false, swimming: true }, rolls: counting });
  assert.equal(draws, bretonDraws - 1, 'the Argonian arm consumes exactly ONE fewer roll');

  // TallySkill sits OUTSIDE the condition - an Argonian still trains Swimming
  const arg = mk(RACES.Argonian);
  arg.skillUses[SKILLS.Swimming] = 0;
  tickPlayerMinutes({ entity: arg, classicMinutes: 0, dt: 5, sinks: sinksFor(),
    activity: { running: false, swimming: true }, rolls: () => 0.99 });
  assert.ok((arg.skillUses?.[SKILLS.Swimming] ?? 0) > 0, 'and still tallies the skill');
});

test('AUDIT 26: the per-minute fatigue band leads with CLIMBING, 22 a minute', () => {
  // PlayerEntity.cs:403-413, in source order:
  //     int amount = (int)(DefaultFatigueLoss * fatigueLossMultiplier);
  //     if (climbingMotor != null && climbingMotor.IsClimbing)
  //         amount = (int)(ClimbingFatigueLoss * fatigueLossMultiplier);
  //     else if (playerMotor.IsRunning && !playerMotor.IsStandingStill) ...
  //     else if (IsPlayerSwimming) ...
  // Constants at :109-113: Default 11, Climbing 22, Running 88, Swimming 44.
  const mk = () => ({ health: 500, maxHealth: 500, fatigue: 100000, magicka: 200,
    level: 1, raceId: RACES.Breton, skills: { [SKILLS.Swimming]: 20 }, skillUses: {} });
  const paid = (activity, rolls = () => 0.99) => {
    const log = {};
    tickPlayerMinutes({ entity: mk(), classicMinutes: 0, dt: 5, sinks: sinksFor(log), activity, rolls });
    return log.fatigue ?? 0;
  };
  assert.deepEqual([
    paid({}),
    paid({ climbing: true }),
    paid({ running: true }),
    paid({ swimming: true }),
  ], [11, 22, 88, 44], 'DefaultFatigueLoss 11, ClimbingFatigueLoss 22, Running 88, Swimming 44');

  // THE ORDER. Climbing wins over a held Run key, and over the water:
  // it is the FIRST arm, so neither later branch can be reached.
  assert.equal(paid({ climbing: true, running: true }), FATIGUE_LOSS.Climbing);
  assert.equal(paid({ climbing: true, swimming: true }), FATIGUE_LOSS.Climbing);
  // ...and, being the first arm, it draws no Swimming roll at all.
  let draws = 0;
  paid({ climbing: true, swimming: true }, () => { draws++; return 0.99; });
  assert.equal(draws, 0, 'the climbing arm short-circuits the swimming Dice100');
});

test('AUDIT 21 F7: swimming TALLIES the skill (the shipped line was unpinned)', () => {
  // Deleting `tallySkill(entity, SKILLS.Swimming)` left all 1138 tests green.
  // That is the "a skill that feeds every X could never advance" shape AUDIT
  // 18 fixed for CriticalStrike and Backstabbing, one delete away from
  // returning.
  const e = { health: 500, maxHealth: 500, fatigue: 100000, magicka: 200, level: 1,
    raceId: RACES.Breton, skills: { [SKILLS.Swimming]: 20 }, skillUses: { [SKILLS.Swimming]: 0 } };
  tickPlayerMinutes({ entity: e, classicMinutes: 0, dt: 5, sinks: sinksFor(),
    activity: { running: false, swimming: true }, rolls: () => 0.5 });
  assert.equal(e.skillUses?.[SKILLS.Swimming], 1, 'one minute of swimming is one Swimming use');
  // and NOT while running, which is the neighbouring band
  const r = { ...e, skills: { [SKILLS.Swimming]: 20 }, skillUses: { [SKILLS.Swimming]: 0 } };
  tickPlayerMinutes({ entity: r, classicMinutes: 0, dt: 5, sinks: sinksFor(),
    activity: { running: true, swimming: false }, rolls: () => 0.5 });
  assert.ok(!(r.skillUses?.[SKILLS.Swimming] > 0), 'running is not swimming');
});

test('AUDIT 21 F6: the chargen reflexes pick reaches the entity and the save', async () => {
  // Two separate one-line reverts (chargenSession's assignment, save.js's
  // ENTITY_FIELDS row) each left all 1138 tests green, which would return
  // every character to Average reflexes with the suite reporting clean.
  const { finishChargen } = await import('../src/systems/chargenSession.js');
  const { snapshotPlayer, restorePlayer } = await import('../src/systems/save.js');

  // A minimal but REAL chargen result: applyCharacter needs a career and the
  // rolled stats, and nothing else here cares.
  const career = { name: 'Warrior', hitPointsPerLevel: 12, abilityFlagsAndSpellPointsBitfield: 0x1000,
    primarySkills: [], majorSkills: [], minorSkills: [] };
  const stats = { strength: 50, intelligence: 50, willpower: 50, agility: 50,
    endurance: 50, personality: 50, speed: 50, luck: 50 };
  const result = { career, careerIndex: 0, name: 'Test', gender: 'male', race: 'Breton',
    raceId: RACES.Breton, faceIndex: 0, stats, skills: {}, reflexes: 0, backStory: [] };

  const entity = { health: 50, maxHealth: 50, skills: {}, stats: {}, items: [] };
  finishChargen(entity, result, null, { rolls: () => 0.5 });
  assert.equal(entity.reflexes, 0, 'the pick must reach the entity - both consumers read it there');
  // and a result WITHOUT a pick leaves whatever is there, per the null guard
  const kept = { health: 50, maxHealth: 50, skills: {}, stats: {}, items: [], reflexes: 3 };
  finishChargen(kept, { ...result, reflexes: null }, null, { rolls: () => 0.5 });
  assert.equal(kept.reflexes, 3, 'no pick does not reset to Average');

  const other = { health: 50, maxHealth: 50, skills: {}, stats: {}, items: [], reflexes: 4 };
  const restored = { health: 1, maxHealth: 1, skills: {}, stats: {}, items: [] };
  restorePlayer(restored, snapshotPlayer(other));
  assert.equal(restored.reflexes, 4, 'and survive a save round trip');
});
