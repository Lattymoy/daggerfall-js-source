// AUDIT 24, wave 30: the twelve-slice sweep's two survival highs -
// the broker frozen under the rest window, and OnMonsterHit unwired
// above ground.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  runMagicRounds, tickPlayerMinutes, resetMagicRoundMarker,
  setWorldMinutes, worldMinutes, MAX_CATCHUP_ROUNDS,
} from '../src/systems/worldTick.js';
import { RestSession, MINUTES_PER_TICK, REST_WAIT_PER_HOUR, REST_TEXT } from '../src/systems/restSession.js';
import { createPlayerTicker } from '../src/scenes/shared.js';
import { onMonsterHit } from '../src/systems/diseases.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';
import { FATIGUE_MULTIPLIER } from '../src/systems/effects.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

// A 1-point-per-round Continuous Damage Health, the audit21_core shape.
const bleed = (rounds) => ({
  kind: 'continuousDamage', roundsRemaining: rounds, casterLevel: 1, saveScaled: false,
  effect: { magnitudeBaseLow: 1, magnitudeBaseHigh: 1, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1 },
});

/**
 * The dungeon host's rest deps, in both shapes: `broker: false` is what
 * dungeonContext shipped before this wave (bump the clock, run the spawn
 * catch-up, and leave the magic rounds to "the round loop"), `broker: true`
 * is DFU's - EntityEffectBroker.Update running under Time.timeScale = 0.
 */
function restRun({ broker, hours = 3, health = 100, healPerHour = 5, bleedRounds = 600 }) {
  const entity = {
    health, maxHealth: health, fatigue: 100000, magicka: 0, maxMagicka: 0,
    level: 1, skills: {}, activeEffects: [bleed(bleedRounds)],
  };
  const trace = [];
  const sinks = {
    hurt: (n) => { entity.health -= n; },
    heal: (n) => { entity.health = Math.min(entity.maxHealth, entity.health + n); },
    drainMagicka: () => {}, restoreMagicka: () => {},
    drainFatigue: () => {}, restoreFatigue: () => {},
    say: () => {},
  };
  setWorldMinutes(1000);
  resetMagicRoundMarker(1000);
  const deps = {
    advanceMinutes: (n) => {
      const start = worldMinutes();
      setWorldMinutes(start + n);
      if (broker) runMagicRounds({ entity, fromMinute: start, toMinute: worldMinutes(), sinks });
    },
    tickVitals: () => {
      sinks.heal(healPerHour);
      trace.push(entity.health);
      return entity.health >= entity.maxHealth;
    },
    fullyHealed: () => entity.health >= entity.maxHealth,
    enemiesNearby: () => false,
    dead: () => entity.health <= 0,
  };
  const session = new RestSession('timed', hours, deps);
  let out = null;
  for (let i = 0; i < 5000 && !out; i++) out = session.tick(REST_WAIT_PER_HOUR / MINUTES_PER_TICK);
  return { out, entity, trace, after: worldMinutes() };
}

test('audit24 wave30: the broker runs UNDER the rest window, minute by minute', () => {
  // DaggerfallRestWindow raises world time; EntityEffectBroker.Update
  // (:202-240) is a MonoBehaviour Update and Time.timeScale = 0 does not stop
  // it - which is exactly what its own comment is for: "Effect system must be
  // able to update while game is paused but game time still passes, e.g. rest
  // or fast travel". The port held the whole gameplay frame at dungeon.js's
  // overlay gate, so a rested night fired ZERO rounds.
  // 100 health, a 1-point bleed per game minute, 5 health back each rested
  // hour: hour one closes at 45 and the sleeper dies 110 minutes in.
  const fixed = restRun({ broker: true });
  assert.equal(fixed.out.died, true, 'a Continuous Damage Health kills the sleeper');
  assert.equal(fixed.after - 1000, 110, 'and the rest ends there, not when the hours run out');
  assert.deepEqual(fixed.trace, [45], 'one hourly heal landed, and it could not keep up');
  assert.equal(fixed.entity.activeEffects[0].roundsRemaining, 600 - 110, 'one round per rested minute');

  const broken = restRun({ broker: false });
  assert.equal(broken.out.died, false, 'without the broker the bleed cannot reach the sleeper');
  assert.equal(broken.after - 1000, 180, 'he sleeps the whole three hours');
  assert.equal(broken.out.textId, REST_TEXT.wakeUp);
  assert.deepEqual(broken.trace, [100, 100, 100], 'and wakes at full health');
  assert.equal(broken.entity.activeEffects[0].roundsRemaining, 600, 'not one round ran');
});

test('audit24 wave30: the rest rounds are INTERLEAVED with the hourly heal, not banked', () => {
  // The old shape did not merely delay the rounds - the marker fired the whole
  // backlog on the first frame AFTER the window closed, by which time every
  // hour of healing had already been applied. Order is the whole bug.
  const entity = {
    health: 500, maxHealth: 500, fatigue: 100000, magicka: 0, maxMagicka: 0,
    level: 1, skills: {}, activeEffects: [bleed(600)],
  };
  const sinks = {
    hurt: (n) => { entity.health -= n; }, heal: (n) => { entity.health += n; },
    drainMagicka: () => {}, restoreMagicka: () => {},
    drainFatigue: () => {}, restoreFatigue: () => {}, say: () => {},
  };
  setWorldMinutes(1000); resetMagicRoundMarker(1000);
  const atHour = [];
  const deps = {
    advanceMinutes: (n) => {
      const start = worldMinutes();
      setWorldMinutes(start + n);
      runMagicRounds({ entity, fromMinute: start, toMinute: worldMinutes(), sinks });
    },
    tickVitals: () => { atHour.push(entity.activeEffects[0].roundsRemaining); return false; },
    fullyHealed: () => false, enemiesNearby: () => false, dead: () => false,
  };
  const s = new RestSession('timed', 3, deps);
  let out = null;
  for (let i = 0; i < 5000 && !out; i++) out = s.tick(REST_WAIT_PER_HOUR / MINUTES_PER_TICK);
  assert.deepEqual(atHour, [540, 480, 420], 'sixty rounds have already run by each hourly heal');

  // and the ordinary frame after the rest has nothing left to catch up - the
  // marker moved with the rest, exactly as the broker's lastGameMinute does.
  const r = tickPlayerMinutes({ entity, classicMinutes: worldMinutes(), dt: 1 / 60, sinks });
  assert.equal(r.rounds, 0, 'no post-rest burst');
});

test('audit24 wave30: runMagicRounds keeps the broker\'s cap and its load re-anchor', () => {
  // The extraction must not change the marker's laws - fromMinute is the
  // clock BEFORE the step precisely so a rewind still reads as a load.
  const e = { health: 500, maxHealth: 500, level: 1, skills: {}, activeEffects: [] };
  const sinks = { hurt: () => {}, heal: () => {}, drainFatigue: () => {}, say: () => {} };
  resetMagicRoundMarker(0);
  assert.equal(runMagicRounds({ entity: e, fromMinute: 0, toMinute: 30240, sinks }), MAX_CATCHUP_ROUNDS);
  resetMagicRoundMarker(9000);
  assert.equal(runMagicRounds({ entity: e, fromMinute: 20, toMinute: 21, sinks }), 1,
    'a rewound clock re-anchors and runs only its own minute');
  // half-open, DFU's `for (i = 0; i < catchupRounds; i++)`
  resetMagicRoundMarker(100);
  assert.equal(runMagicRounds({ entity: e, fromMinute: 100, toMinute: 100.99, sinks }), 0, 'a partial minute is no round');
  assert.equal(runMagicRounds({ entity: e, fromMinute: 100.99, toMinute: 101, sinks }), 1);
});

test('audit24 wave30: the dungeon rest advance runs BOTH halves of the broker event', () => {
  const src = rd('src/scenes/dungeonContext.js');
  const i = src.indexOf('advanceMinutes: (n) => {');
  const arm = src.slice(i, src.indexOf('onRestFinished:', i));
  assert.ok(i > 0 && arm.length > 200, 'the rest advance arm was found');
  // wave 32 reshaped this: the window is CLAIMED once (that is the broker) and
  // then run on the player and on every foe - one raise, every manager.
  assert.ok(arm.includes('const _w = claimMagicRounds(start, classicMinutesRef.value);'),
    'the window is claimed once for the advance');
  assert.ok(arm.includes("runMagicRoundsFor(playerEntity, _w.from, _w.to, { sinks: playerSinks,"),
    'the PLAYER half runs across it, through this host\'s one set of doors');
  // OnNewMagicRound is a GLOBAL event - every EntityEffectManager in the scene
  // subscribes - and the frame body's foe loop anchors on the clock at the top
  // of the frame, so these minutes were lost rather than merely late.
  assert.ok(arm.includes('runMagicRoundsFor(f.entity, _w.from, _w.to, { sinks: foeSinks(f) });'), 'the FOE half runs too');
  assert.ok(arm.indexOf('claimMagicRounds') < arm.indexOf('intermittentEnemySpawn'),
    'the broker before the spawn catch-up, as the two Updates run');
  // the comment that said the round loop would catch up is GONE - it described
  // a line that was not there (dungeon.js returns at the overlay gate first).
  assert.ok(!arm.includes('the round loop catches the magic rounds up'), 'the false comment is retired');
});

test('audit24 wave30: OnMonsterHit rides EVERY monster melee door and no other', () => {
  // FormulaHelper.cs:660-662 calls OnMonsterHit only in the WEAPONLESS branch
  // and only when the attacker is a monster (`AIAttacker.EntityType !=
  // EnemyClass`). So: every host's monster-melee call must pass the rider, and
  // the arrow paths and the city watch must NOT. Both directions, because a
  // gate has a blind spot until somebody looks for it from the other side.
  const files = ['src/scenes/dungeonContext.js', 'src/scenes/exteriorFoes.js',
    'src/scenes/cityGuards.js', 'src/scenes/world.js', 'src/combat/playerWeapon.js'];
  const sites = [];
  for (const f of files) {
    const src = rd(f);
    for (const m of src.matchAll(/calculateAttackDamage\(/g)) {
      // slice the call by matching parens, so the window cannot under- or
      // over-reach when the argument object grows.
      let depth = 0, end = m.index;
      for (let k = m.index + 'calculateAttackDamage'.length; k < src.length; k++) {
        if (src[k] === '(') depth++;
        else if (src[k] === ')') { depth--; if (depth === 0) { end = k; break; } }
      }
      const call = src.slice(m.index, end + 1);
      sites.push({ file: f, line: src.slice(0, m.index).split('\n').length, call });
    }
  }
  assert.equal(sites.length, 7, 'seven damage doors in the port - classify any eighth');

  const monsterMelee = sites.filter((s) => /^calculateAttackDamage\(f\.entity, (foeDeps\.)?playerEntity,/.test(s.call));
  assert.equal(monsterMelee.length, 2, 'the dungeon host and the exterior pool');
  assert.deepEqual(monsterMelee.map((s) => s.file).sort(),
    ['src/scenes/dungeonContext.js', 'src/scenes/exteriorFoes.js']);
  for (const s of monsterMelee) {
    assert.ok(s.call.includes('onMonsterHit: (att, tgt, hit) => onMonsterHit(att, tgt, hit, {'),
      `${s.file}:${s.line} must pass the special-attack rider`);
    assert.ok(s.call.includes('castParalyze:'), `${s.file}:${s.line} carries the spider/scorpion free-cast`);
    // InflictDisease stamps the entry's lastDay, and the classic day is
    // elapsed minutes / 1440 (PlayerEntity.cs:263) - both hosts, one unit.
    assert.ok(/currentDay: Math\.floor\([^\n]*\/ MINUTES_PER_DAY\)/.test(s.call),
      `${s.file}:${s.line} stamps the disease day in classic days`);
    assert.ok(/sinks: (playerSinks|foeDeps\.playerSinks)/.test(s.call) || s.call.includes('sinks: playerSinks'),
      `${s.file}:${s.line} drains through the host's player sinks`);
  }
  for (const s of sites.filter((x) => !monsterMelee.includes(x))) {
    assert.ok(!s.call.includes('onMonsterHit'),
      `${s.file}:${s.line} is an arrow, a watchman or the player - DFU calls no rider there`);
  }
});

test('audit24 wave30: the exterior pool binds the paralyze free-cast the way the dungeon does', () => {
  const xf = rd('src/scenes/exteriorFoes.js');
  assert.ok(xf.includes("const sp = spellsByIndex?.()?.get(SPIDER_TOUCH_SPELL_INDEX);"),
    'the pool reads the SPELLS.STD map through its own accessor (it is a FUNCTION dep here, unlike the dungeon\'s map)');
  assert.ok(xf.includes('if (sp) castSpellFrom(f, sp, playerFeet, true);'),
    'SetReadySpell(spell, noSpellPointCost: true) - the cast is free and skips the silence gate');
  // ONE binding of the shared executor for this pool, not two.
  assert.equal(xf.split('castEnemySpell(f,').length - 1, 1);
  assert.equal((xf.match(/(?<!function )castSpellFrom\(f, /g) ?? []).length, 2, 'the decision and the rider both use it');
});

test('audit24 wave30: the host ticker exposes the ONE set of player sinks, exhaustion and all', () => {
  // The rider's nymph/lamia arm is FatigueDamage - "every 1 pt of health
  // damage = 2 pts of fatigue damage" - and a pool that minted its own drain
  // would write the field and miss DaggerfallEntity's OnExhausted.
  const entity = { health: 20, maxHealth: 20, fatigue: 500 * 64, level: 2, skills: {}, isPlayer: true, activeEffects: [] };
  let collapsed = 0;
  const ticker = createPlayerTicker(entity, { onExhausted: () => { collapsed++; } });
  assert.ok(ticker.sinks && typeof ticker.sinks.drainFatigue === 'function', 'the sinks are reachable');

  onMonsterHit({ careerIndex: MOBILE_TYPES.Nymph }, entity, 7, { sinks: ticker.sinks });
  assert.equal(entity.fatigue, 500 * 64 - 7 * 2 * FATIGUE_MULTIPLIER, 'damage x2 x64, DamageFatigueFromSource\'s stored units');
  assert.equal(collapsed, 0);

  onMonsterHit({ careerIndex: MOBILE_TYPES.Lamia }, entity, 5000, { sinks: ticker.sinks });
  assert.equal(entity.fatigue, 0, 'clamped at zero');
  assert.equal(collapsed, 1, 'and the collapse fired through the host presenter');
});
