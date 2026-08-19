// S19b: poisons - the 12 variants, minute ticks, drug completion,
// InflictPoison gates, weapon-poison rolls + the formulas seam.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  POISONS, POISON_START_VALUE, TOTAL_POISON_VARIANTS, isDrugType,
  MIN_MINUTES_TO_POISON, MAX_MINUTES_TO_POISON, MIN_ROUNDS_OF_POISON, MAX_ROUNDS_OF_POISON,
  startPoison, updatePoisons, curePoisonEntry, inflictPoison, rollEnemyWeaponPoison,
} from '../src/systems/poisons.js';
import { tickActiveEffects, healAttributeDamage } from '../src/systems/effects.js';
import { liveStat } from '../src/systems/statMods.js';
import { calculateAttackDamage } from '../src/combat/formulas.js';
import { WEAPONS } from '../src/characters/weapons.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';
import { YOU_FEEL_SOMEWHAT_BAD } from '../src/systems/diseases.js';

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const P = (level = 5) => ({
  isPlayer: true, level, career: {}, health: 40, maxHealth: 40, magicka: 30, maxMagicka: 30, fatigue: 6400,
  stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
});
const sinkRec = () => {
  const rec = { hurt: 0, fatDrained: 0, fatRestored: 0, spDrained: 0, spRestored: 0 };
  rec.sinks = {
    hurt: (n) => { rec.hurt += n; },
    drainFatigue: (n) => { rec.fatDrained += n; },
    restoreFatigue: (n) => { rec.fatRestored += n; },
    drainMagicka: (n) => { rec.spDrained += n; },
    restoreMagicka: (n) => { rec.spRestored += n; },
  };
  return rec;
};

test('poisons: the enum + timing tables pinned (weapon poisons 0-7, drugs 8-11)', () => {
  assert.equal(TOTAL_POISON_VARIANTS, 12);
  assert.equal(POISONS.Nux_Vomica, 128);
  assert.equal(POISONS.Aegrotat, 139);
  assert.equal(POISON_START_VALUE, 128);
  // Arsenic: 10/10 minutes to start, 20-1000 rounds (the long burn)
  const a = POISONS.Arsenic - 128;
  assert.deepEqual([MIN_MINUTES_TO_POISON[a], MAX_MINUTES_TO_POISON[a], MIN_ROUNDS_OF_POISON[a], MAX_ROUNDS_OF_POISON[a]], [10, 10, 20, 1000]);
  // Moonseed strikes instantly (0 start), 1-4 rounds
  const m = POISONS.Moonseed - 128;
  assert.deepEqual([MIN_MINUTES_TO_POISON[m], MAX_MINUTES_TO_POISON[m], MIN_ROUNDS_OF_POISON[m], MAX_ROUNDS_OF_POISON[m]], [0, 0, 1, 4]);
  assert.ok(!isDrugType(POISONS.Thyrwort));
  for (const d of [POISONS.Indulcet, POISONS.Sursum, POISONS.Quaesto_Vil, POISONS.Aegrotat]) assert.ok(isDrugType(d));
});

test('poisons: Start rolls, the incumbent no-stack (rolls still consumed), the waiting countdown', () => {
  const p = P();
  // Nux Vomica: minutesToStart Range(4,5) roll 0 -> 4; rounds
  // Range(3,11) roll 0.5 -> 3+4 = 7
  const entry = startPoison(p, POISONS.Nux_Vomica, 100, seq(0, 0.5));
  assert.equal(entry.state, 'waiting');
  assert.equal(entry.minutesToStart, 4);
  assert.equal(entry.minutesRemaining, 7);
  assert.equal(entry.lastMinute, 100);
  // Same poison again: AddState is a no-op - but BOTH Start rolls
  // consume (the discarded instance rolled them in DFU too)
  let rolls = 0;
  assert.equal(startPoison(p, POISONS.Nux_Vomica, 101, () => { rolls++; return 0; }), null);
  assert.equal(rolls, 2);
  assert.equal(p.activeEffects.length, 1);
  // Minutes 101-103: the waiting countdown, no damage
  const rec = sinkRec();
  updatePoisons(p, 103, rec.sinks, seq(0));
  assert.equal(rec.hurt, 0);
  assert.equal(entry.state, 'waiting');
  assert.equal(entry.minutesToStart, 1);
  // Minute 104: countdown hits 0 -> Active AND the first tick lands
  // the same minute (Range(2,12) roll 0 -> 2)
  let alerts = 0;
  updatePoisons(p, 104, rec.sinks, seq(0), (msg) => { alerts++; assert.equal(msg, YOU_FEEL_SOMEWHAT_BAD); });
  assert.equal(entry.state, 'active');
  assert.equal(rec.hurt, 2);
  assert.equal(alerts, 1);
  assert.equal(entry.minutesRemaining, 6);
});

test('poisons: minute catch-up runs to Complete; negative mods persist until healed', () => {
  const p = P();
  const rec = sinkRec();
  // Drothweed: start Range(5,11) roll 0 -> 5; rounds Range(5,31) roll 0 -> 5
  const entry = startPoison(p, POISONS.Drothweed, 0, seq(0, 0));
  // Jump 100 minutes: 5 waiting + 5 active ticks, each str -Range(5,10)
  // roll 0 -> -5, agi/spd -Range(1,5) -> -1
  updatePoisons(p, 100, rec.sinks, seq(0));
  assert.equal(entry.state, 'complete');
  assert.equal(entry.statMods.strength, -25);
  assert.equal(entry.statMods.agility, -5);
  assert.equal(liveStat(p, 'strength'), 25);
  // Complete rounds keep the entry (attribute damage persists)
  updatePoisons(p, 101, rec.sinks, seq(0));
  assert.ok(!entry.ended);
  tickActiveEffects(p, rec.sinks);
  assert.equal(p.activeEffects.length, 1);
  // Heal all three stats - the NEXT CompletePoison round cures
  healAttributeDamage(p, 'strength', 99);
  healAttributeDamage(p, 'agility', 99);
  healAttributeDamage(p, 'speed', 99);
  assert.equal(liveStat(p, 'strength'), 50);
  assert.ok(!entry.ended);   // healing never ends the poison directly
  updatePoisons(p, 102, rec.sinks, seq(0));
  assert.ok(entry.ended);    // "outcome identical to curing directly"
  tickActiveEffects(p, rec.sinks);
  assert.equal(p.activeEffects.length, 0);
});

test('poisons: drugs push POSITIVE mods, stripped once on Complete; fatigue/magicka x64 rules', () => {
  const p = P();
  const rec = sinkRec();
  // Sursum: start Range(1,5) roll 0 -> 1; rounds Range(2,3) roll 0 -> 2
  const entry = startPoison(p, POISONS.Sursum, 0, seq(0, 0));
  // 3 minutes: 1 waiting + 2 active (int -Range(10,30) roll 0 -> -10,
  // str +Range(5,20) -> +5 each)
  updatePoisons(p, 3, rec.sinks, seq(0));
  assert.equal(entry.state, 'complete');
  assert.equal(entry.statMods.intelligence, -20);
  assert.equal(entry.statMods.strength, 10);
  assert.equal(liveStat(p, 'strength'), 60);   // the drug's high
  // The next round strips the positive mods ONCE - the crash
  updatePoisons(p, 4, rec.sinks, seq(0));
  assert.equal(entry.statMods.strength, 0);
  assert.ok(entry.positiveStatsRemoved);
  assert.ok(!entry.ended);   // int damage remains
  assert.equal(liveStat(p, 'strength'), 50);
  assert.equal(liveStat(p, 'intelligence'), 30);
  // Somnalius fatigue drains x64 (DecreaseFatigue assignMultiplier
  // true); Quaesto Vil restores x64; Aegrotat magicka raw
  const q = P();
  const qr = sinkRec();
  startPoison(q, POISONS.Somnalius, 0, seq(0, 0));   // start 0, rounds 2
  updatePoisons(q, 1, qr.sinks, seq(0));             // Range(10,100) roll 0 -> 10
  assert.equal(qr.fatDrained, 10 * 64);
  const w = P();
  const wr = sinkRec();
  startPoison(w, POISONS.Quaesto_Vil, 0, seq(0, 0)); // start 2, rounds 1
  updatePoisons(w, 3, wr.sinks, seq(0));             // wil -1, fatigue +5*64
  assert.equal(wr.fatRestored, 5 * 64);
  const v = P();
  const vr = sinkRec();
  startPoison(v, POISONS.Aegrotat, 0, seq(0, 0));    // start 0, rounds 5
  updatePoisons(v, 1, vr.sinks, seq(0));             // end -1, magicka +5 RAW
  assert.equal(vr.spRestored, 5);
});

test('poisons: InflictPoison - career immunity, the save, level-1 immunity, bypass', () => {
  // Career Poison-immune (immunityFlags bit 4) vetoes outright
  const imm = { ...P(), career: { immunityFlags: 4 } };
  assert.equal(inflictPoison(imm, POISONS.Moonseed, false, { rolls: () => { throw new Error('no roll'); } }), null);
  // A full save (roll 1 vs throw 55) resists a non-bypass poison
  assert.equal(inflictPoison(P(), POISONS.Moonseed, false, { rolls: seq(0) }), null);
  // Level 1 target: the classic rat immunity (save passes, then the
  // level gate refuses)
  assert.equal(inflictPoison(P(1), POISONS.Moonseed, false, { rolls: seq(0.99) }), null);
  // bypassResistance skips the save entirely (still 2 Start rolls)
  const p = P();
  let rolls = 0;
  const entry = inflictPoison(p, POISONS.Moonseed, true, { rolls: () => { rolls++; return 0; }, currentMinute: 9 });
  assert.equal(entry.poison, POISONS.Moonseed);
  assert.equal(entry.lastMinute, 9);
  assert.equal(rolls, 2);
});

test('poisons: the enemy weapon-poison roll + the formulas inflict-once seam', () => {
  // Level gate; eligibility: class enemies + Orc/Centaur/OrcSergeant
  assert.equal(rollEnemyWeaponPoison(MOBILE_TYPES.Orc, 1, seq(0)), null);
  assert.equal(rollEnemyWeaponPoison(MOBILE_TYPES.Rat, 5, seq(0)), null);
  // Orc at 5%: roll 0.04 -> 4 < 5 succeeds; poison Range(128,136)
  // roll 0.99 -> 128 + 7 = Thyrwort (weapon poisons only)
  assert.equal(rollEnemyWeaponPoison(MOBILE_TYPES.Orc, 5, seq(0.04, 0.99)), POISONS.Thyrwort);
  assert.equal(rollEnemyWeaponPoison(MOBILE_TYPES.Orc, 5, seq(0.05)), null);   // 5 >= 5 fails
  // Assassin rolls 60%
  assert.equal(rollEnemyWeaponPoison(MOBILE_TYPES.Assassin, 5, seq(0.59, 0)), POISONS.Nux_Vomica);
  // The formulas seam: a damaging weapon hit fires onInflictPoison
  // ONCE and clears the weapon's poison
  const M = { isPlayer: false, isClass: true, level: 5, skills: 200, stats: { strength: 50, agility: 50, luck: 50 } };
  const T = { isPlayer: true, armor: 0, skills: 0, stats: { strength: 50, agility: 50, luck: 50 } };
  const weapon = { name: 'Longsword', templateIndex: WEAPONS.Longsword, material: 1, flags: 0, poisonType: POISONS.Moonseed };
  const hits = [];
  // rolls: [struck, crit fail, hitRoll, damageRoll, backstab] - skill
  // 200 clamps the chance to 97, roll .02 hits
  const dmg = calculateAttackDamage(M, T, {
    weapon, rolls: seq(0, 0.99, 0.02, 0.99, 0.5),
    onInflictPoison: (att, tgt, pt) => hits.push(pt),
  });
  assert.ok(dmg > 0);
  assert.deepEqual(hits, [POISONS.Moonseed]);
  assert.equal(weapon.poisonType, -1);   // cleared - one infection per poisoning
  calculateAttackDamage(M, T, { weapon, rolls: seq(0, 0.99, 0.02, 0.99, 0.5), onInflictPoison: (a, t, pt) => hits.push(pt) });
  assert.equal(hits.length, 1);
  // A MISS leaves the poison on the blade
  const w2 = { ...weapon, poisonType: POISONS.Arsenic };
  calculateAttackDamage(M, T, { weapon: w2, rolls: seq(0, 0.99, 0.99), onInflictPoison: (a, t, pt) => hits.push(pt) });
  assert.equal(hits.length, 1);
  assert.equal(w2.poisonType, POISONS.Arsenic);
});

test('poisons: cure + the save round-trip carries the poison entry', async () => {
  const { snapshotPlayer, restorePlayer } = await import('../src/systems/save.js');
  const p = P();
  const entry = startPoison(p, POISONS.Thyrwort, 0, seq(0, 0));
  updatePoisons(p, 3, sinkRec().sinks, seq(0));   // 2 waiting + 1 active: wil -5, per -10
  assert.equal(liveStat(p, 'willpower'), 45);
  const snap = snapshotPlayer(p, {});
  const fresh = { stats: { ...p.stats } };
  restorePlayer(fresh, snap);
  assert.equal(fresh.activeEffects[0].poison, POISONS.Thyrwort);
  assert.equal(fresh.activeEffects[0].state, entry.state);
  assert.equal(liveStat(fresh, 'willpower'), 45);
  // curePoisonEntry expires it; the statMods lift on removal
  curePoisonEntry(entry);
  assert.equal(entry.state, 'complete');
  tickActiveEffects(p, {});
  assert.equal(p.activeEffects.length, 0);
  assert.equal(liveStat(p, 'willpower'), 50);
});
