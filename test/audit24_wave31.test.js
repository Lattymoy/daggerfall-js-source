// AUDIT 24, wave 31: the twelve-slice sweep's two effects highs - the
// normal-power concealment break, unported at every door, and the
// stat-zero kill.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  breakNormalPowerConcealment, handleAttackFromSource, NORMAL_POWER_CONCEALMENTS,
} from '../src/systems/concealment.js';
import { applySpell, tickActiveEffects, isInvisible, isBlending, isAShade } from '../src/systems/effects.js';
import { calculateAttackDamage } from '../src/combat/formulas.js';
import { killIfAnyLiveStatZero, REFRESH_MODS_DELAY, STAT_KEYS_ORDER } from '../src/systems/statMods.js';
import { tickPlayerMinutes, resetMagicRoundMarker } from '../src/systems/worldTick.js';
import { snapshotPlayer } from '../src/systems/save.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const concealed = (...kinds) => kinds.map((kind) => ({ kind, roundsRemaining: 30 }));

const WM_CS = new URL('../tools/parity/dfu/Assets/Scripts/Game/WeaponManager.cs', import.meta.url);
const EA_CS = new URL('../tools/parity/dfu/Assets/Scripts/Game/EnemyAttack.cs', import.meta.url);
const EEM_CS = new URL('../tools/parity/dfu/Assets/Scripts/Game/MagicAndEffects/EntityEffectManager.cs', import.meta.url);
const noDfu = !existsSync(WM_CS) || !existsSync(EA_CS) || !existsSync(EEM_CS);

test('audit24 wave31: the break ends the three NORMAL powers and nothing else', () => {
  assert.deepEqual([...NORMAL_POWER_CONCEALMENTS], ['chameleonNormal', 'invisNormal', 'shadeNormal']);
  const e = { activeEffects: [...concealed('invisNormal', 'shadeTrue', 'chameleonNormal'), { kind: 'levitate', roundsRemaining: 9 }] };
  assert.equal(breakNormalPowerConcealment(e), true);
  assert.deepEqual(e.activeEffects.map((a) => a.kind), ['shadeTrue', 'levitate'], 'the TRUE power and the buff survive');
  // and the folded readers still answer for the true power (IsAShade is
  // normal OR true) while the broken ones have gone quiet
  assert.equal(isAShade(e), true);
  assert.equal(isInvisible(e), false);
  assert.equal(isBlending(e), false);

  assert.equal(breakNormalPowerConcealment(e), false, 'nothing left to break');
  assert.equal(breakNormalPowerConcealment({ activeEffects: [] }), false);
  assert.equal(breakNormalPowerConcealment(null), false, 'DFU no-ops on a null source');
  assert.equal(handleAttackFromSource(null), false);
  assert.equal(handleAttackFromSource(undefined), false);
});

test('audit24 wave31: a landed hit ends the ATTACKER\'s concealment; a miss does not', () => {
  // The class-enemy hand-to-hand path: flat skills 40 vs the player's
  // agility 50, so the measured chance clamps to 3 and the hit roll
  // decides. No reflex gate on this arm, so dfRand is never consulted.
  // the TARGET is concealed too: DFU breaks on the source, never on the
  // thing that was hit - being struck while invisible does not reveal you.
  const target = () => ({ isPlayer: true, reflexes: 2, skills: 0, stats: { strength: 50, agility: 50, luck: 50 }, activeEffects: concealed('invisNormal') });
  const mk = () => ({
    isPlayer: false, isClass: true, level: 2, skills: 40,
    stats: { strength: 50, agility: 50, luck: 50 },
    activeEffects: concealed('invisNormal'),
  });

  const hitter = mk();
  const struck = target();
  const dmg = calculateAttackDamage(hitter, struck, { dfRand: () => 0, rolls: seq(0, 0.99, 0.02, 0) });
  assert.ok(dmg > 0, 'the fixture really lands damage');
  assert.equal(isInvisible(hitter), false, 'WeaponManager.cs:549-552 / EnemyAttack.cs:255-257');
  assert.equal(isInvisible(struck), true, 'and the source is the ATTACKER, not the thing hit');

  const misser = mk();
  const none = calculateAttackDamage(misser, target(), { dfRand: () => 0, rolls: seq(0, 0.99, 0.99, 0) });
  assert.equal(none, 0, 'the fixture really misses');
  assert.equal(isInvisible(misser), true, 'the `damage > 0` half of the guard is load-bearing');

  // the TRUE power is not touched by either
  const truePower = { ...mk(), activeEffects: concealed('invisTrue') };
  assert.ok(calculateAttackDamage(truePower, target(), { dfRand: () => 0, rolls: seq(0, 0.99, 0.02, 0) }) > 0);
  assert.equal(isInvisible(truePower), true, 'true Invisibility survives the swing');
});

test('audit24 wave31: damage BY AN EFFECT breaks the caster\'s concealment (HandleAttackFromSource)', () => {
  const dmg = { type: 4, subType: 0, magnitudeBaseLow: 10, magnitudeBaseHigh: 10, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 0 };
  const target = () => ({ stats: { willpower: 50 }, career: {}, health: 30, maxHealth: 40 });
  const casterEntity = { activeEffects: concealed('chameleonNormal') };
  let hurt = 0;
  applySpell({ element: 0, rangeType: 0, effects: [dmg] }, 1, target(), { hurt: (n) => { hurt += n; } }, seq(0),
    { entity: casterEntity, sinks: {} });
  assert.equal(hurt, 10);
  assert.equal(isBlending(casterEntity), false, 'DamageHealthFromSource -> HandleAttackFromSource on the CASTER');

  // and the same on the per-round door: the entry carries its caster
  // (IEntityEffect.Caster) so every round of a Continuous Damage Health
  // keeps breaking it, exactly as DamageHealth.MagicRound does.
  const cont = { type: 1, subType: 0, magnitudeBaseLow: 3, magnitudeBaseHigh: 3, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, durationBase: 5, durationMod: 0, durationPerLevel: 1 };
  const caster2 = { activeEffects: [] };
  const victim = target();
  applySpell({ element: 0, rangeType: 0, effects: [cont] }, 1, victim, { hurt: () => {} }, seq(0), { entity: caster2, sinks: {} });
  const entry = victim.activeEffects.find((a) => a.kind === 'continuousDamage');
  assert.ok(entry, 'the continuous entry exists');
  assert.equal(entry.caster, caster2, 'and it remembers who cast it');
  caster2.activeEffects = concealed('shadeNormal');
  tickActiveEffects(victim, { hurt: () => {} });
  assert.equal(isAShade(caster2), false, 'the round broke it');
});

test('audit24 wave31: the caster reference never reaches the save envelope', () => {
  // It is a live scene reference, not state - and putting the player (or,
  // through a foe, the whole scene) inside the snapshot is how a save
  // stops being serializable.
  const entity = {
    stats: {}, skills: [], skillUses: [], items: [], activeEffects: [
      { kind: 'continuousDamage', roundsRemaining: 4, casterLevel: 1, caster: { name: 'a live entity' }, effect: { magnitudeBaseLow: 1 } },
    ],
  };
  const snap = snapshotPlayer(entity, {});
  assert.equal('caster' in snap.activeEffects[0], false, 'dropped, as RestoreInstancedBundleSaveData re-resolves it');
  assert.equal(snap.activeEffects[0].roundsRemaining, 4, 'the rest of the entry survives');
  assert.equal(entity.activeEffects[0].caster.name, 'a live entity', 'and the LIVE entry keeps it');
  assert.doesNotThrow(() => JSON.stringify(snap));
});

test('audit24 wave31: a live stat at zero kills the host, on the broker\'s own 0.2s cadence', () => {
  assert.equal(REFRESH_MODS_DELAY, 0.2, 'EntityEffectManager.refreshModsDelay');
  const mk = () => {
    const e = {
      health: 25, maxHealth: 25,
      stats: Object.fromEntries(STAT_KEYS_ORDER.map((k) => [k, 40])),
      activeEffects: [{ kind: 'drainAttribute', stat: 'strength', magnitude: 40 }],
    };
    return e;
  };
  const hits = [];
  const sinks = (e) => ({ hurt: (n) => { hits.push(n); e.health -= n; } });

  // the cadence is real: DFU resets the timer to zero rather than
  // subtracting, and does not fire until it is STRICTLY past the delay.
  const e = mk();
  assert.equal(killIfAnyLiveStatZero(e, sinks(e), 0.1), false, 'not yet');
  assert.equal(e.health, 25);
  assert.equal(killIfAnyLiveStatZero(e, sinks(e), 0.1), false, 'exactly 0.2 is not PAST 0.2');
  assert.equal(killIfAnyLiveStatZero(e, sinks(e), 0.05), true);
  assert.equal(e.health, 0, 'CurrentHealth = 0');
  // and it went through the SINK, not a raw field write: `hurt` is the one
  // damage door, which is what runs the death presenter (DFU's CurrentHealth
  // setter raises OnDeath the same way). A raw `entity.health = 0` here
  // would leave a corpse walking around with the HUD still up.
  assert.deepEqual(hits, [25], 'DecreaseHealth(CurrentHealth) through the door');

  // THE RESET IS TO ZERO, not a subtract, and it happens on every FIRING -
  // including one that finds nothing. Without it the check would run every
  // frame from then on, which is not the cadence DFU gives it.
  const later = mk();
  later.activeEffects = [];                              // nothing to find yet
  assert.equal(killIfAnyLiveStatZero(later, sinks(later), 0.3), false, 'it fired and found nothing');
  later.activeEffects = [{ kind: 'drainAttribute', stat: 'strength', magnitude: 40 }];
  assert.equal(killIfAnyLiveStatZero(later, sinks(later), 0.05), false, 'the timer restarted at zero');
  assert.equal(later.health, 25);
  assert.equal(killIfAnyLiveStatZero(later, sinks(later), 0.2), true, 'and fires again 0.2s on');

  // a stat drained only part way is not a stat at zero
  const alive = mk();
  alive.activeEffects[0].magnitude = 39;
  assert.equal(killIfAnyLiveStatZero(alive, sinks(alive), 1), false);
  assert.equal(alive.health, 25);

  // an entity that has never recorded the stat is not an entity drained
  // to death - foes and fixtures carry partial blocks, and liveStat's
  // `?? 0` default would otherwise kill every one of them.
  const partial = { health: 10, stats: { strength: 40 }, activeEffects: [] };
  assert.equal(killIfAnyLiveStatZero(partial, sinks(partial), 1), false);
  assert.equal(partial.health, 10);

  // already dead: DecreaseHealth has nothing left to take
  const dead = mk();
  dead.health = 0;
  assert.equal(killIfAnyLiveStatZero(dead, sinks(dead), 1), false);

  // and it is EVERY stat, not just strength
  for (const stat of STAT_KEYS_ORDER) {
    const v = mk();
    v.activeEffects = [{ kind: 'drainAttribute', stat, magnitude: 40 }];
    assert.equal(killIfAnyLiveStatZero(v, sinks(v), 1), true, `${stat} at zero kills`);
  }
});

test('audit24 wave31: the host tick runs the kill check, and rest cannot', () => {
  const e = {
    health: 25, maxHealth: 25, level: 1, skills: {}, activeEffects: [{ kind: 'drainAttribute', stat: 'endurance', magnitude: 60 }],
    stats: Object.fromEntries(STAT_KEYS_ORDER.map((k) => [k, 40])),
  };
  const sinks = { hurt: (n) => { e.health -= n; }, heal: () => {}, drainFatigue: () => {}, drainMagicka: () => {}, say: () => {} };
  resetMagicRoundMarker(0);
  tickPlayerMinutes({ entity: e, classicMinutes: 0, dt: 0.3, sinks });
  assert.equal(e.health, 0, 'the entity tick carries it, so every host gets it');

  // DFU's is Update()'s refreshMods timer and Time.deltaTime is ZERO under
  // a paused UI, so a rest cannot kill you this way however long it runs -
  // which is why this does NOT ride runMagicRounds.
  const src = rd('src/systems/worldTick.js');
  assert.ok(src.includes('killIfAnyLiveStatZero(entity, sinks, dt);'), 'in the tick');
  const rmr = src.slice(src.indexOf('export function runMagicRounds'), src.indexOf('export function tickPlayerMinutes'));
  assert.ok(!rmr.includes('killIfAnyLiveStatZero'), 'and NOT in the broker catch-up');

  // every entity has an EntityEffectManager, so the foes get it too
  const dc = rd('src/scenes/dungeonContext.js');
  assert.ok(dc.includes('for (const f of foes) if (!f.dead) killIfAnyLiveStatZero(f.entity, foeSinks(f), dt);'),
    'the dungeon pool runs it per frame');
});

test('audit24 wave31: the C# really does break at every CalculateAttackDamage caller', { skip: noDfu }, () => {
  // The port puts the break at the tail of calculateAttackDamage rather
  // than at its seven callers. That is only the same law if DFU's OWN
  // caller set is exactly the set that breaks - so read it, rather than
  // trusting the comment that says so.
  const wm = readFileSync(WM_CS, 'utf8');
  const ea = readFileSync(EA_CS, 'utf8');
  const eem = readFileSync(EEM_CS, 'utf8');
  const calls = [];
  for (const [name, src] of [['WeaponManager.cs', wm], ['EnemyAttack.cs', ea], ['EntityEffectManager.cs', eem]]) {
    for (const m of src.matchAll(/FormulaHelper\.CalculateAttackDamage\(/g)) {
      calls.push({ name, line: src.slice(0, m.index).split('\n').length, src });
    }
  }
  assert.equal(calls.length, 3, 'three callers in the tree - one in WeaponManager, two in EnemyAttack');
  assert.deepEqual(calls.map((c) => c.name), ['WeaponManager.cs', 'EnemyAttack.cs', 'EnemyAttack.cs']);
  for (const c of calls) {
    // the guarded break sits within a few lines of every one of them
    const after = c.src.split('\n').slice(c.line - 1, c.line + 6).join('\n');
    assert.match(after, /IsMagicallyConcealedNormalPower && damage > 0/, `${c.name}:${c.line} guards on damage > 0`);
    assert.match(after, /BreakNormalPowerConcealmentEffects/, `${c.name}:${c.line} breaks`);
  }
  // and the break itself ends exactly the three NORMAL subclasses
  const fn = eem.slice(eem.indexOf('public static void BreakNormalPowerConcealmentEffects'));
  const body = fn.slice(0, fn.indexOf('\n        }\n') + 1);
  assert.deepEqual([...body.matchAll(/EndIncumbentEffect<(\w+)>/g)].map((m) => m[1]),
    ['ChameleonNormal', 'InvisibilityNormal', 'ShadowNormal']);
  // ...and the stat-zero kill is still where wave 31 read it
  assert.match(eem, /\/\/ Kill host if any stat is reduced to 0 live total\s*\n\s*for \(int i = 0; i < DaggerfallStats\.Count; i\+\+\)\s*\n\s*\{\s*\n\s*if \(entityBehaviour\.Entity\.Stats\.GetLiveStatValue\(i\) == 0\)/);
  assert.match(eem, /const float refreshModsDelay = 0\.2f;/);
});
