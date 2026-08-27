// MT-ii - ONE ENEMY'S BLOW ON ANOTHER: EnemyAttack.ApplyDamageToNonPlayer
// (:303-392), the payload that had no port because until MT-i no foe
// could hold a foe as its target - and the KNOCKBACK GUARD that looks
// like WeaponManager's and is not.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { applyDamageToNonPlayer } from '../src/scenes/hostCombat.js';
import {
  KB_UNIT, enemyKnockbackApplies, weaponKnockbackApplies,
  weaponKnockbackSpeed, enemyWeightClassicUnits,
} from '../src/combat/formulas.js';
import { EnemyAI } from '../src/characters/enemyMotor.js';
import { PLAYER_TARGET } from '../src/characters/enemyTargets.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const clearCollider = () => ({
  raycast: () => Infinity,
  capsuleCast: () => ({ dist: Infinity, key: null }),
  move: () => ({ grounded: true }),
});
const mkFoe = (feet, { isClass = false, weight = 80, parry = false, health = 30, gender = 'male' } = {}) => {
  const ai = new EnemyAI(clearCollider(), feet, 0);
  return {
    ai,
    entity: { isClass, gender, health, maxHealth: health, team: 'Orcs', basics: { team: 'Orcs', weight, parrySounds: parry, bloodIndex: 2 } },
  };
};

test('MT-ii: the foe knockback guard is NOT the player\'s - different binding, different entity\'s class', () => {
  const threshold = 5 / KB_UNIT;
  const w80 = enemyWeightClassicUnits(false, 'male', 80);
  const midShove = weaponKnockbackSpeed(10, w80);
  assert.ok(midShove > threshold, 'one blow leaves a weighted monster over the decay threshold');
  // THE BINDING. WeaponManager: `speed<=5 && targetIsClass || weight>0`
  // - a weighted monster is re-shoved by every landed PLAYER hit.
  assert.equal(weaponKnockbackApplies(midShove, false, 80), true, 'the player chain-shoves it (:578-580)');
  // EnemyAttack: `speed<=5 && (attackerIsClass || weight>0)` - the
  // threshold governs EVERY foe-dealt shove.
  assert.equal(enemyKnockbackApplies(midShove, false, 80), false, 'one enemy never chain-shoves another (:336-337)');
  assert.equal(enemyKnockbackApplies(midShove, true, 80), false, 'not even a class attacker - the && is outside');
  assert.equal(enemyKnockbackApplies(0, false, 80), true, 'a settled weighted target takes it');
  // WHOSE CLASS. The foe arm reads the ATTACKER's; a weight-0 spectral
  // target is knocked only when its ATTACKER is a class enemy.
  assert.equal(enemyKnockbackApplies(0, true, 0), true, 'class attacker vs a Weight-0 ghost: shoved');
  assert.equal(enemyKnockbackApplies(0, false, 0), false, 'monster attacker vs the same ghost: not');
  // ...where the player-side arm reads the TARGET's class for that test
  assert.equal(weaponKnockbackApplies(0, true, 0), true, 'the player\'s arm asks whether the TARGET is a class');
  // and the two live apart, each cited at its own home
  const f = rd('src/combat/formulas.js');
  assert.match(f, /entityBehaviour` in WeaponManager is the enemy/, 'the divergence is written LOUDLY, not inferred');
});

test('MT-ii: the landed blow - damage, blood, knockback, health, and the struck foe turns on its attacker', () => {
  const attacker = mkFoe([0, 0, 0], { isClass: true });
  const target = mkFoe([0, 0, 1.5]);
  const dealt = [];
  const blood = [];
  const sounds = [];
  const dmg = applyDamageToNonPlayer(attacker, target, {
    weapon: null, direction: [0, 0, 1], rolls: () => 0.5,
    calculateAttackDamage: () => 7,
    dealDamage: (t, d) => { dealt.push([t, d]); t.entity.health -= d; },
    audio: { play3d: (clip) => sounds.push(clip) },
    hitEffects: { showBloodSplash: (idx, at) => blood.push([idx, at]) },
  });
  assert.equal(dmg, 7, 'the source returns the damage it dealt');
  assert.deepEqual(dealt, [[target, 7]], 'DecreaseHealth rides the TARGET pool\'s own damageFoe - death runs whole');
  assert.equal(target.entity.health, 23);
  assert.equal(blood.length, 1, 'ShowBloodSplash at the target (:325-333)');
  assert.equal(blood[0][0], 2, 'the target\'s BloodIndex');
  assert.ok(Math.abs(blood[0][1][1] - target.ai.height / 8) < 1e-9, 'centre + height/8');
  assert.ok(target.ai.knockbackSpeed > 0, 'the knockback landed (settled target, class attacker)');
  assert.deepEqual(target.ai.knockbackDir, [0, 0, 1], 'along the attack ray');
  assert.equal(target.ai.target, attacker, 'MakeEnemyHostileToAttacker (:389-391) - it turns on whoever hit it');
  assert.ok(target.ai.giveUpTimer > 0, 'and pursues');
  assert.ok(sounds.length >= 1, 'PlayHitSound at the target (:323)');
});

test('MT-ii: a MISS deals nothing, still reaches DecreaseHealth, and parry vs miss picks its own sound site', () => {
  const attacker = mkFoe([0, 0, 0]);
  const plain = mkFoe([0, 0, 1.5], { parry: false });
  const at = [];
  applyDamageToNonPlayer(attacker, plain, {
    weapon: null, rolls: () => 0.5,
    calculateAttackDamage: () => 0,
    dealDamage: () => {},
    audio: { play3d: (clip, where) => at.push(where[2]) },
  });
  assert.equal(plain.ai.knockbackSpeed, 0, 'no damage, no shove');
  assert.deepEqual(at, [0], 'the whiff rings at the ATTACKER (`sounds.PlayMissSound`, :373)');
  // a ParrySounds target with a WEAPON and an arrow flag rings at the target
  const parrier = mkFoe([0, 0, 1.5], { parry: true });
  const at2 = [];
  applyDamageToNonPlayer(attacker, parrier, {
    weapon: { templateIndex: 120, material: 3 }, bowAttack: true, rolls: () => 0.5,
    calculateAttackDamage: () => 0,
    dealDamage: () => {},
    audio: { play3d: (clip, where) => at2.push(where[2]) },
  });
  assert.deepEqual(at2, [1.5], 'PlayParrySound rings at the TARGET (:374-375)');
});

test('MT-ii: the payload does NOT carry the player-only riders - no monster special, no flash, no Dodging', () => {
  const src = rd('src/scenes/hostCombat.js');
  const body = src.slice(src.indexOf('export function applyDamageToNonPlayer'));
  const fn = body.slice(0, body.indexOf('\n}\n') + 3);
  for (const forbidden of ['onMonsterHit', 'flashPlayerDamage', 'Dodging', 'onPlayerHurt']) {
    assert.ok(!fn.includes(forbidden), `${forbidden} is the PLAYER's rider - FormulaHelper's monster arm never fires foe-to-foe`);
  }
  assert.match(src, /a rat biting an orc infects\s*\n\s*\*\s*nothing/, 'and the rule is recorded, not merely absent');
});

test('MT-ii: a null target returns 0 without touching anything (:305-306)', () => {
  const attacker = mkFoe([0, 0, 0]);
  let called = 0;
  assert.equal(applyDamageToNonPlayer(attacker, null, {
    calculateAttackDamage: () => { called++; return 9; }, dealDamage: () => { called++; },
  }), 0);
  assert.equal(called, 0, 'no damage roll, no health write');
  assert.notEqual(PLAYER_TARGET, null, 'the player sentinel is a real object, never the null arm');
});

// ---- MT-iii: the two quest actions the infighting slice retires ----
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { MOBILE_TEAMS } from '../src/characters/enemyTargets.js';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'dfu-quests');
const tsrc = {};
for (const f of readdirSync(join(VENDOR, 'Tables'))) {
  if (f.endsWith('.txt')) tsrc[f.replace('.txt', '')] = readFileSync(join(VENDOR, 'Tables', f), 'utf8').replace(/^﻿/, '');
}
loadQuestTables(tsrc);

const QHEADER = ['Quest: __MT', 'QRC:', 'Message:  1011', ' x', '', 'QBN:'];
function mkQuestMachine(instances = []) {
  const m = new QuestMachine({
    world: {
      currentRegionIndex: () => 0, isPlayerInLocationRect: () => true,
      currentLocation: () => ({ loaded: true, mapTableData: { locationType: 0 } }),
      getFactionData: () => null,
    },
    questFoeInstances: (sym) => instances.filter((i) => i.symbolName === sym?.name),
  });
  return m;
}
const sched = (m, qbn) => m.scheduleQuest([...QHEADER, ...qbn], 0, { rolls: () => 0.4 });

test('MT-iii: ChangeFoeTeam writes EVERY live instance, by number or by enum NAME; an unknown name THROWS', () => {
  const insts = [
    { symbolName: 'ally', entity: { team: 'Daedra' }, behaviour: { targetSymbol: { name: 'ally' } } },
    { symbolName: 'ally', entity: { team: 'Daedra' }, behaviour: { targetSymbol: { name: 'ally' } } },
    { symbolName: 'other', entity: { team: 'Orcs' }, behaviour: { targetSymbol: { name: 'other' } } },
  ];
  const m = mkQuestMachine(insts);
  sched(m, [' change foe _ally_ team PlayerAlly', '', 'Foe _ally_ is Giant', '']);
  m.tick();
  assert.equal(insts[0].entity.team, 'PlayerAlly', 'the whole WAVE flips, not just the coupled instance');
  assert.equal(insts[1].entity.team, 'PlayerAlly');
  assert.equal(insts[2].entity.team, 'Orcs', 'another symbol is untouched');
  // the NUMERIC spelling, the same enum
  const insts2 = [{ symbolName: 'ally', entity: { team: 'Daedra' }, behaviour: { targetSymbol: { name: 'ally' } } }];
  const m2 = mkQuestMachine(insts2);
  sched(m2, [' change foe _ally_ team 1', '', 'Foe _ally_ is Giant', '']);
  m2.tick();
  assert.equal(insts2[0].entity.team, MOBILE_TEAMS[1], 'team 1 IS PlayerAlly');
  assert.throws(() => sched(mkQuestMachine(), [' change foe _x_ team Wombles', '', 'Foe _x_ is Giant', '']),
    /not a known team from MobileTeams enum/);
});

test('MT-iii: ChangeFoeInfighting writes IsAttackableByAI; Convert.ToBoolean takes true/false and nothing else', () => {
  const insts = [{ symbolName: 'q', entity: { team: 'Orcs' }, behaviour: { targetSymbol: { name: 'q' }, isAttackableByAI: false } }];
  const m = mkQuestMachine(insts);
  sched(m, [' change foe _q_ infighting true', '', 'Foe _q_ is Giant', '']);
  m.tick();
  assert.equal(insts[0].behaviour.isAttackableByAI, true, 'the quest foe becomes a legal AI target');
  const insts2 = [{ symbolName: 'q', entity: {}, behaviour: { targetSymbol: { name: 'q' }, isAttackableByAI: true } }];
  const m2 = mkQuestMachine(insts2);
  sched(m2, [' change foe _q_ infighting False', '', 'Foe _q_ is Giant', '']);
  m2.tick();
  assert.equal(insts2[0].behaviour.isAttackableByAI, false, 'Convert.ToBoolean is CASE-insensitive');
  assert.throws(() => sched(mkQuestMachine(), [' change foe _q_ infighting yes', '', 'Foe _q_ is Giant', '']),
    /not recognized as a valid Boolean/, 'anything else is a FormatException, and the quest drops');
});

test('MT-iii: no instance standing leaves BOTH actions live - SetComplete sits inside the loop', () => {
  const m = mkQuestMachine([]);   // the wave has not spawned yet
  const q = sched(m, [' change foe _q_ team PlayerAlly', ' change foe _q_ infighting true', '', 'Foe _q_ is Giant', '']);
  m.tick();
  const startup = [...q.tasks.values()][0];
  for (const name of ['ChangeFoeTeam', 'ChangeFoeInfighting']) {
    const act = startup.actions.find((a) => a.constructor.name === name);
    assert.equal(act.isComplete, false, `${name} retries next tick - C# completes INSIDE the instance walk`);
  }
  // and the HEADLESS arm: a machine with no host door idles the same way
  const bare = new QuestMachine({ world: { currentRegionIndex: () => 0, isPlayerInLocationRect: () => true, currentLocation: () => ({ loaded: true, mapTableData: { locationType: 0 } }), getFactionData: () => null } });
  const q2 = sched(bare, [' change foe _q_ team PlayerAlly', '', 'Foe _q_ is Giant', '']);
  bare.tick();
  assert.equal([...q2.tasks.values()][0].actions[0].isComplete, false, 'an absent door idles the arm, never throws');
});

test('MT-iii: the guard list is down to FOUR, and both rows became real registry templates', () => {
  const a = rd('src/systems/quest/actions.js');
  const guards = a.slice(a.indexOf('const GUARD_PATTERNS'), a.indexOf('const guard ='));
  assert.ok(!guards.includes('ChangeFoeInfighting:'), 'the guard row is GONE - retiring a flag deletes the sentence');
  assert.ok(!guards.includes('ChangeFoeTeam:'), 'both of them');
  assert.match(a, /new ChangeFoeInfighting\(null\),\n\s*new ChangeFoeTeam\(null\),/, 'the C#-order registry slots are real templates now');
  const rows = (guards.match(/^ {2}\w+: \//gm) ?? []).length;
  assert.equal(rows, 4, 'CastEffectDo, WorldUpdate, ClickedFoe, PromptMulti - and each names its blocker');
  for (const blocker of ['CastEffectDo', 'WorldUpdate', 'ClickedFoe', 'PromptMulti']) {
    assert.ok(guards.includes(`- ${blocker}`) || guards.includes(`${blocker} /`) || guards.includes(`${blocker}:`), `${blocker} still names itself`);
  }
});
