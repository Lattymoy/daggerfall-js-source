// DUEL1 (2026-09-24, Mac: duels - asked, "Yes: weapons, bows, spells"; "Loser drops to 1HP"): THE BLOW BETWEEN TWO
// DUELLISTS, DRIVEN. The stub the defender stands up from the wire's sheet IS the striker, to the formula - the same
// damage roll for roll as the striker's own entity would deal, with DFU's formula and with the physical-combat
// overhaul; its numbers never pop on the defender's HUD; the floor that stops a duel's blow at 1 health (and only a
// duel's); the duel's spell tagged, floored over time and its families alone; where a blow may be claimed from; and the
// hosts by source (the melee arm first, the shaft, the spell marks, the sinks, the doors).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  duelAttackerOf, duelWeaponOf, duelStub, resolveDuelStrike, duelBlowPlausible, duelSpellOf, duelSpellFromWire, duelSwingOf,
  DUEL_SPELL_TYPES, DUEL_MELEE_SLACK_M, DUEL_POS_SLACK_M,
} from '../src/combat/duelCombat.js';
import { calculateAttackDamage, setPlayerAttackHook, reportPlayerAttack } from '../src/combat/formulas.js';
import { installPcaao, uninstallPcaao } from '../src/combat/pcaao.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { hurtPlayer, setDeathPresenter, setAvoidDeathHook, registerDuelFell, duelSpare } from '../src/characters/playerEntity.js';
import { applySpell, tickActiveEffects } from '../src/systems/effects.js';
import { SKILLS } from '../src/systems/skills.js';
import { WEAPON_REACH, SWING_MODS } from '../src/combat/playerWeapon.js';
import { validDuelData, DUEL_LEVEL_MAX, DUEL_STAT_MAX, DUEL_SWINGS } from '../src/net/wire.js';
import { DUEL_RADIUS_M, NATIVES_PER_M } from '../src/net/duelSession.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const lcg = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
const stats = (o = {}) => ({ strength: 62, intelligence: 40, willpower: 45, agility: 58, endurance: 55, personality: 40, speed: 52, luck: 47, ...o });
const skillsAll = (v) => Object.fromEntries(Array.from({ length: 35 }, (_, i) => [i, v]));
const mkPlayer = (o = {}) => ({ isPlayer: true, level: 9, raceId: 2, stats: stats(), skills: skillsAll(35), career: { attackModifierFlags: 0, weaponArmorShieldsBitfield: 0x00070000, abilityFlagsAndSpellPointsBitfield: 0 }, health: 70, maxHealth: 80, items: [], activeEffects: [], armorValues: [60, 70, 80, 65, 90, 100, 75], reflexes: 2, biographyAvoidHitMod: 0, ...o });
const SWORD = 118;   // a Long Blade's template (characters/weapons.js weaponSkillUsed)
const AXE = 127;     // an Axe's - a weapon whose skill slot is NOT the long blade's

/** The frame a striker's host would send, through the relay's own law. */
function strikeFrom(attacker, weapon, { by = 'melee', sw = 'StrikeDown', at } = {}) {
  const w = duelWeaponOf(weapon);
  return validDuelData({ to: 'peer-0002', s: 'abc123def0', k: 'strike', n: 1, by, p: [1000, 0, 1000], a: duelAttackerOf(attacker, weapon), ...(w ? { w } : {}), sw, ...(at ? { at } : {}) });
}
const clone = (o) => JSON.parse(JSON.stringify(o));

test('DUEL1 THE STUB IS THE STRIKER: the defender\'s resolution off the wire\'s sheet deals, roll for roll, what the striker\'s own entity would deal to the same defender - DFU\'s formula and the physical-combat overhaul alike, weapon or fist (mutants: a skill read off the wrong slot; the race dropped; the career\'s expertise lost; the swing mods ignored; the condition lost)', () => {
  for (const pcaao of [false, true]) {
    if (pcaao) installPcaao({ read: (k) => ({ Enabled: true, equipmentDamageEnhanced: true, armorHitFormulaRedone: true, criticalStrikesIncreaseDamage: true, conditionBasedEffectiveness: true, softMaterialRequirements: true, fixedStrengthDamageModifier: true })[k] ?? false, other: () => undefined });
    try {
      for (const [label, weapon] of [['longsword', createWeapon(SWORD, 3, () => 0.5)], ['axe', createWeapon(AXE, 2, () => 0.5)], ['fist', null]]) {
        if (weapon) weapon.currentCondition = Math.round(weapon.maxCondition * 0.8);
        const attacker = mkPlayer({ skills: { ...skillsAll(35), [SKILLS.LongBlade]: 64, [SKILLS.Axe]: 88, [SKILLS.HandToHand]: 41, [SKILLS.CriticalStrike]: 27, [SKILLS.Backstabbing]: 12 } });
        const frame = strikeFrom(attacker, weapon);
        assert.ok(frame, 'the sheet passes the relay\'s law');
        let total = 0;
        for (let seed = 1; seed <= 60; seed++) {
          const d1 = mkPlayer({ level: 7, raceId: 1 }), d2 = clone(d1);
          const w1 = weapon ? { ...weapon } : null;
          const swing = SWING_MODS.StrikeDown;
          const real = calculateAttackDamage(attacker, d1, { weapon: w1, damageMod: swing.damage, toHitMod: swing.toHit, rolls: lcg(seed), dfRand: () => 0 });
          const duel = resolveDuelStrike(frame, d2, { rolls: lcg(seed) });
          assert.equal(duel.dmg, real, `${pcaao ? 'PCAAO' : 'DFU'} ${label} seed ${seed}`);
          assert.equal(duel.hit, real > 0);
          total += real;
        }
        assert.ok(total > 0, `${label}: some blows land`);
      }
    } finally { if (pcaao) uninstallPcaao(); }
  }
});

test('DUEL1 the sheet the wire carries: level and attributes clamped at the honest ceilings (the sender clamps, so an honest frame is never refused), the weapon\'s own skill in the first slot, the career\'s bitfields, the weapon as template, material and condition percent - a bare hand none (mutants: an over-cap level refused instead of clamped; the skill slot off the wrong template)', () => {
  const big = mkPlayer({ level: 45, stats: stats({ strength: 130 }), skills: { ...skillsAll(20), [SKILLS.LongBlade]: 150 } });
  const a = duelAttackerOf(big, createWeapon(SWORD, 3, () => 0.5));
  assert.equal(a.lv, DUEL_LEVEL_MAX);
  assert.equal(a.st[0], DUEL_STAT_MAX);
  assert.equal(a.sk[0], 100, 'Long Blade, the longsword\'s, clamped');
  assert.equal(duelAttackerOf(big, null).sk[0], 20, 'a fist\'s first slot is HandToHand');
  assert.deepEqual(a.cf, [0, 0x00070000, 0]);
  assert.ok(validDuelData({ to: 'peer-0002', s: 'abc123def0', k: 'strike', n: 1, by: 'melee', p: [1, 1, 1], a }), 'clamped, it passes');
  const w = createWeapon(SWORD, 3, () => 0.5);
  w.currentCondition = Math.round(w.maxCondition / 4);
  assert.deepEqual(duelWeaponOf(w), { t: SWORD, m: 3, c: 25 });
  assert.equal(duelWeaponOf(null), null);
  const { stub, weapon } = duelStub(a, { t: SWORD, m: 3, c: 25 });
  assert.equal(stub.peer, true, 'marked: the formula\'s HUD report stays quiet on the defender\'s machine');
  assert.equal(weapon.currentCondition, Math.round(weapon.maxCondition * 0.25), 'a FRESH weapon at the striker\'s condition');
  assert.equal(duelSwingOf('StrikeUp'), 'StrikeUp');
  assert.equal(duelSwingOf('Idle'), undefined);
  assert.deepEqual(Object.keys(SWING_MODS).sort(), [...DUEL_SWINGS].sort(), 'the wire\'s swings are the formula\'s');
});

test('DUEL1 the numbers are the STRIKER\'s: the defender\'s resolution never pops a number on the defender\'s HUD; the striker\'s HUD hears the answer through the one seam (mutants: the defender\'s HUD popping the opponent\'s numbers; the striker\'s silent)', () => {
  const heard = [];
  setPlayerAttackHook((r) => heard.push(r));
  try {
    resolveDuelStrike(strikeFrom(mkPlayer(), null), mkPlayer(), { rolls: lcg(3) });
    assert.equal(heard.length, 0, 'the defender resolved the blow and its HUD heard nothing');
    calculateAttackDamage(mkPlayer(), mkPlayer(), { rolls: lcg(3) });
    assert.equal(heard.length, 1, 'a player\'s own blow still reports');
    reportPlayerAttack({ hit: true, damage: 9 });
    assert.equal(heard.at(-1).damage, 9, 'the result, on the striker\'s HUD');
  } finally { setPlayerAttackHook(null); }
});

test('DUEL1 THE FLOOR: a blow with `spare` that would kill leaves the player at ONE and says so once - no death, no avoid-death roll; a blow that does not reach zero is an ordinary blow; without `spare` death is death (mutants: the floor at 0; spare told on every blow; the presenter reached)', () => {
  let died = 0, avoided = 0, spared = 0;
  setDeathPresenter(() => { died++; });
  setAvoidDeathHook(() => { avoided++; return false; });
  try {
    const e = { health: 10, maxHealth: 80, activeEffects: [] };
    hurtPlayer(e, 4, { spare: () => { spared++; } });
    assert.deepEqual([e.health, spared, died], [6, 0, 0], 'not a killing blow');
    hurtPlayer(e, 6, { spare: () => { spared++; } });
    assert.deepEqual([e.health, spared, died, avoided], [1, 1, 0, 0], 'a blow of EXACTLY the health left is a killing blow, and it stops at one');
    e.health = 6;
    hurtPlayer(e, 50, { spare: () => { spared++; } });
    assert.deepEqual([e.health, spared, died, avoided], [1, 2, 0, 0], 'so does an overkill');
    hurtPlayer(e, 3, { spare: () => { spared++; } });
    assert.deepEqual([e.health, spared], [1, 3], 'at one, any duel blow is the fall');
    hurtPlayer(e, 3);
    assert.deepEqual([e.health, died], [0, 1], 'a wolf in the ring kills as it always has');
    // the one registration: duelSpare says it to the duel
    let fell = 0;
    registerDuelFell(() => { fell++; });
    const f = { health: 2, maxHealth: 80, activeEffects: [] };
    hurtPlayer(f, 9, { spare: duelSpare });
    assert.deepEqual([f.health, fell], [1, 1]);
  } finally { setDeathPresenter(null); setAvoidDeathHook(null); registerDuelFell(null); }
});

test('DUEL1 THE DUEL\'S SPELL: its bundles are tagged the duel\'s (never merged with the target\'s own), each round of its damage over time reaches the sink WITH its entry, and the shared ticker floors that damage at 1; the families that travel are the fight\'s alone (mutants: the tag dropped; the entry not handed on; a Dispel or a Heal travelling)', () => {
  const cont = { type: 1, subType: 0, magnitudeBaseLow: 3, magnitudeBaseHigh: 3, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, durationBase: 5, durationMod: 0, durationPerLevel: 1, chanceBase: 100 };
  const victim = { stats: { willpower: 50 }, career: {}, health: 30, maxHealth: 40, activeEffects: [] };
  applySpell({ element: 0, rangeType: 2, effects: [cont] }, 1, victim, { hurt: () => {} }, () => 0.99, null, { duelCast: true });
  const entry = victim.activeEffects.find((a) => a.kind === 'continuousDamage');
  assert.ok(entry?.bundleDuel, 'tagged the duel\'s');
  const seen = [];
  tickActiveEffects(victim, { hurt: (n, a) => seen.push([n, !!a?.bundleDuel]) }, () => 0.99);   // a high roll: no save this round
  assert.ok(seen.length && seen.every(([, duel]) => duel), 'every round hands its entry on');
  const mine = { stats: { willpower: 50 }, career: {}, health: 30, maxHealth: 40, activeEffects: [] };
  applySpell({ element: 0, rangeType: 2, effects: [cont] }, 1, mine, { hurt: () => {} }, () => 0.99, null, {});
  assert.equal(mine.activeEffects.find((a) => a.kind === 'continuousDamage')?.bundleDuel, undefined, 'an ordinary spell is not the duel\'s');
  assert.match(rd('src/scenes/shared.js'), /hurt: \(n, a = null\) => hurtPlayer\(entity, n, a\?\.bundleDuel \? \{ spare: duelSpare \} : undefined\)/, 'the one ticker every host shares floors the duel\'s rounds');
  // the families
  assert.deepEqual([...DUEL_SPELL_TYPES].sort((x, y) => x - y), [0, 1, 4, 5, 7, 19]);
  const fire = { name: 'Fire Storm', element: 0, rangeType: 4, icon: 2, effects: [{ type: 4, subType: 0 }, { type: 10, subType: 8 }, { type: 6, subType: 0 }] };
  assert.deepEqual(duelSpellOf(fire).effects.map((e) => e.type), [4], 'the damage travels; the heal and the dispel stay home');
  assert.equal(duelSpellOf({ effects: [{ type: 10, subType: 8 }] }), null, 'a heal is no blow');
  const landed = duelSpellFromWire({ name: 'x', element: 1, rangeType: 3, effects: [{ type: 12, subType: 255 }, { type: 0, subType: 255 }] });
  assert.deepEqual(landed.effects.map((e) => e.type), [0], 'a crafted soul trap lands nothing; the paralysis does');
  assert.equal(landed.rangeType, 3, 'at the range it reached me by - the save is owed');
  assert.equal(duelSpellFromWire({ effects: [{ type: 12, subType: 255 }] }), null);
});

test('DUEL1 WHERE A BLOW MAY COME FROM: the striker\'s claimed feet near where the defender sees them, and a swing within a weapon\'s reach of the defender with a trailing pose\'s slack; a shaft or a spell within the ring\'s width (mutants: a swing from across the ring landing; a claim far from the body seen accepted)', () => {
  const me = [100000, 0, 100000];
  const at = (m) => [me[0] + m * NATIVES_PER_M, 0, me[2]];
  const melee = (p) => ({ k: 'strike', by: 'melee', p });
  assert.equal(duelBlowPlausible(melee(at(2)), me, at(2), DUEL_RADIUS_M), true);
  assert.equal(duelBlowPlausible(melee(at(WEAPON_REACH + DUEL_MELEE_SLACK_M - 0.1)), me, at(WEAPON_REACH + DUEL_MELEE_SLACK_M - 0.1), DUEL_RADIUS_M), true);
  assert.equal(duelBlowPlausible(melee(at(WEAPON_REACH + DUEL_MELEE_SLACK_M + 0.5)), me, at(WEAPON_REACH + DUEL_MELEE_SLACK_M + 0.5), DUEL_RADIUS_M), false, 'a swing from out of reach');
  assert.equal(duelBlowPlausible(melee(at(2)), me, at(2 + DUEL_POS_SLACK_M + 1), DUEL_RADIUS_M), false, 'a claim far from where they stand');
  assert.equal(duelBlowPlausible(melee(at(2)), me, null, DUEL_RADIUS_M), false, 'a striker not placed');
  assert.equal(duelBlowPlausible({ k: 'strike', by: 'arrow', p: at(20) }, me, at(20), DUEL_RADIUS_M), true, 'a shaft across the ring');
  assert.equal(duelBlowPlausible({ k: 'spell', p: at(2 * DUEL_RADIUS_M + DUEL_POS_SLACK_M + 1) }, me, at(2 * DUEL_RADIUS_M + DUEL_POS_SLACK_M + 1), DUEL_RADIUS_M), false, 'from beyond the ring');
});

test('DUEL1 hosts by source: the swing reaches my opponent before any pool and is theirs when it left; my shaft on them is a strike and a foe\'s stops on them; my harmful spells meet them as a mark (touch, missile, blast, area) through the duel\'s door; the defender resolves on its own sheet with the floor and answers; the travel map, a journey, rest and every door refuse a duellist (mutants: the melee arm after the pools; the shaft\'s damage dealt at home; the spell sink unfloored; a door out of the ring)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /if \(duelMeleeHit\(cam\.pos, makeInView\(proj, view, multiply\)\)\) \{\s*\n\s*tallySwingSkills\(playerEntity, weaponRig\.playerWeapon\.weapon\);\s*\n\s*surfacePlayer\(\);\s*\n\s*\} else if \(!cityGuards\.resolvePlayerHit/, 'the duel arm first, the ladder after');
  assert.match(w, /\.filter\(\(t\) => !t\.dead && t\.ai\)\.map\(\(t\) => \(\{ feet: t\.ai\.feet, ref: t \}\)\), \.\.\.duelArrowTargets\(\)\]/);
  assert.match(w, /onFoeHit: \(m, t\) => \(t\?\.duel \? undefined : exteriorFoes\.arrowHitFoe\(m, t\)\)/);
  assert.match(w, /onPlayerArrowHitFoe: \(m, t\) => \(t\?\.duel \? duelStrikeOut\('arrow', m\.weapon \?\? null, 'StrikeDown', weaponRig\.playerWeapon\?\.lastDrawMs \?\? 0\) : playerArrowHitFoe\(m, t, \{/);
  assert.match(w, /castAtDuel: \(id, sp\) => duelSpellOut\(id, sp\),/);
  assert.match(w, /hurt: \(n\) => \{ if \(n > 0\) hurtPlayer\(playerEntity, n, _duelScope \? \{ spare: duelSpare \} : undefined\); \}/);
  assert.match(w, /_duelScope = true;\s*\n\s*try \{ magic\.applySpellToPlayer\(spell, d\.level, null, \{ duelCast: true \}\); \} finally \{ _duelScope = false; \}/);
  assert.match(w, /const r = resolveDuelStrike\(d, playerEntity, \{ backFacing: isBackFacing\(cam\.yaw, player\.feetAt\(\), from\) \}\);\s*\n\s*if \(r\.dmg > 0\) \{\s*\n\s*hurtPlayer\(playerEntity, r\.dmg, \{ spare: duelSpare \}\);/);
  assert.match(w, /if \(!duelBlowPlausible\(d, \[\.\.\._duelTrail\.map\(\(e\) => e\.p\), campToWire\(player\.feetAt\(\)\)\], duelWorldOf\(duel\.peer\), DUEL_RADIUS_M\)\) return null;/, 'AUDIT DUEL1 B6: the trail of my own feet, now last');
  assert.match(w, /if \(duelEnemyNear\(\) \|\| areEnemiesNearby\(\[\.\.\.cityGuards\.guards, \.\.\.exteriorFoes\.foes\]\)\) \{\s*\n\s*townTalk\.say\(CANNOT_TRAVEL_ENEMIES_TEXT\);/, 'the travel map');
  assert.equal((w.match(/enemiesNearby: \(\) => duelEnemyNear\(\) \|\| areEnemiesNearby\(/g) ?? []).length, 2, 'rest and a journey');
  assert.match(w, /duelHolds: \(\) => duelEnemyNear\(\),/);
  const m = rd('src/scenes/worldModes.js');
  assert.match(m, /if \(!isBash && \(hit\.door\.doorType === DOOR_TYPE\.DUNGEON_ENTRANCE \|\| hit\.door\.doorType === DOOR_TYPE\.BUILDING\) && host\.duelHolds\?\.\(\)\) \{ setMidScreenText\(DUEL_DOOR_TEXT\); return true; \}/, 'no door out of the ring');
  const h = rd('src/scenes/hostMagic.js');
  assert.match(h, /const marks = \[\.\.\.allyMarksFor\(sp\), \.\.\.duelMarksFor\(sp\)\];/, 'a touch');
  assert.match(h, /else if \(t\?\.duel\) giveToDuel\(t, sp\);/);
  assert.match(h, /for \(const t of sweepFoes\(eye, EXPLOSION_RADIUS, duelMarksFor\(sp\)\)\) giveToDuel\(t, sp\);/, 'an area around me');
  assert.match(h, /if \(duel && caster\?\.entity === playerEntity\) for \(const t of sweepFoes\(pos, EXPLOSION_RADIUS, duelMarksFor\(spell\)\)\) giveToDuel\(t, spell\);/, 'a blast');
  assert.match(h, /if \(m\.duel\) \{\s*\n\s*const hitFoe = duelMarksFor\(m\.spell\)\.find\(\(p\) => missileHitsCapsule\(m\.pos, p\.ai\.feet, p\.ai\.height, PLAYER_BODY_RADIUS\)\);/, 'a missile');
  assert.match(h, /duel: !!duelSpellOf\(sp\) \}\);/);
});
