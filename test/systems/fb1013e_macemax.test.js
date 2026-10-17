// MACE-MAX (FIELD BUGS 2026-10-13e, a player: "Molag bal mace do nothing" - "It's effect is not working and it's
// extremely fragile"; the tooltip: THE MACE OF MOLAG BAL, "drains its victims of spell points and gives them to the
// bearer. If the victim has no spell points, he is drained of strength, which is also transferred to the wielder.
// Using the Mace of Molag Bal can actually give its bearer more spell points or more strength than he would have
// fully rested").
//
// The strength arm - the arm nearly every foe answers, having no magicka - raised the wielder's strength MOD and not
// its MAX (MaceOfMolagBalEffect.cs:138-139 raises both; DaggerfallStats.GetLiveStatValue clamps at MaxStatValue +
// maxMods, :155-161), so a wielder at 100 gained nothing at all. The magicka arm's overflow raised the live max only
// at the next round, so a second strike in one round counted the first's overflow again (:117-123 raise it at once).
// And the live effect, a Held bundle in DFU that taking the Mace off removes, outlived the unequip.
//
// Everything through the real producers: the Mace minted by createArtifact off DFU's own MAGIC.DEF row
// (test/dfuMagicItems.mjs, read by readMagicDef), a character by createCharacter, worn by equipItem, a foe by
// makeEnemyEntity (a caster's magicka by setEnemySpells), the blow by calculateAttackDamage, the payload by
// doItemEnchantmentPayloads, the round by runMagicRoundsFor, the save by snapshotPlayer/restorePlayer.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readMagicDef, MAGIC_ITEM_RECORD_SIZE } from '../../src/formats/magicDef.js';
import { createArtifact } from '../../src/systems/loot/loot.js';
import { DFU_MAGIC_ITEMS } from '../dfuMagicItems.mjs';
import { createCharacter } from '../../src/systems/chargen.js';
import { equipItem, unequipItem } from '../../src/systems/equip.js';
import { calculateAttackDamage } from '../../src/combat/formulas.js';
import { doItemEnchantmentPayloads, PAYLOAD, setDefaultEnchantCtx } from '../../src/systems/enchantments.js';
import { ARTIFACTS, MACE_MAX_INCREASE_ROUNDS, maceState, hasArtifactSubtype } from '../../src/systems/artifactEffects.js';
import { makeEnemyEntity } from '../../src/characters/enemy/enemyEntity.js';
import { ENEMY_BASICS } from '../../src/characters/enemy/enemyBasics.js';
import { MOBILE_TYPES } from '../../src/characters/mobile/mobileTypes.js';
import { setEnemySpells } from '../../src/systems/enemySpells.js';
import { liveStat, MAX_STAT_VALUE } from '../../src/systems/statMods.js';
import { runMagicRoundsFor } from '../../src/systems/worldTick.js';
import { snapshotPlayer, restorePlayer } from '../../src/systems/save/save.js';
import { SKILLS } from '../../src/systems/skills.js';

// ── DFU's MAGIC.DEF as its bytes (the tree carries no ARENA2): MagicItemTemplates.txt's rows, 62 bytes each ──
function magicDefBytes(records) {
  const buf = new Uint8Array(4 + records.length * MAGIC_ITEM_RECORD_SIZE);
  const v = new DataView(buf.buffer);
  v.setInt32(0, records.length, true);
  let o = 4;
  for (const r of records) {
    for (let i = 0; i < r.name.length && i < 31; i++) buf[o + i] = r.name.charCodeAt(i);
    o += 32;
    buf[o++] = r.type; buf[o++] = r.group; buf[o++] = r.groupIndex ?? 0;
    for (let i = 0; i < 10; i++) { v.setInt8(o++, r.ench?.[i]?.[0] ?? -1); v.setInt8(o++, r.ench?.[i]?.[1] ?? 0); }
    v.setInt16(o, r.uses ?? 100, true); o += 2;
    v.setInt32(o, r.value ?? 0, true); o += 4;
    buf[o++] = r.material ?? 0;
  }
  return buf;
}
const MAGIC = readMagicDef(magicDefBytes(DFU_MAGIC_ITEMS));
/** The artifacts' own order (type 1 and 2), the Mace third - SetArtifact's ArtifactIndex 2. */
const mintMace = () => createArtifact(MAGIC, 2);

const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
const CAREER = {
  name: 'Knight', hitPointsPerLevel: 12, advancementMultiplier: 1.0,
  strength: 60, intelligence: 60, willpower: 45, agility: 55, endurance: 60, personality: 40, speed: 50, luck: 50,
  primarySkills: [SKILLS.BluntWeapon, SKILLS.Axe, SKILLS.CriticalStrike],
  majorSkills: [SKILLS.LongBlade, SKILLS.Dodging, SKILLS.Jumping],
  minorSkills: [SKILLS.ShortBlade, SKILLS.Archery, SKILLS.Running, SKILLS.Swimming, SKILLS.Climbing, SKILLS.Medical],
};
/** A character at 100 Strength, the Mace in hand. */
function wielder() {
  const p = { isPlayer: true, reflexes: 2, items: [] };
  createCharacter(p, CAREER, 0, { rolls: () => 0.5 });
  p.level = 10;
  p.stats.strength = MAX_STAT_VALUE;
  p.skills[SKILLS.BluntWeapon] = 60;
  const mace = mintMace();
  p.items.push(mace);
  equipItem(p, mace);
  return { p, mace };
}
/** An orc - no spells, so no magicka: the strength arm's foe. */
const dryFoe = () => Object.assign(makeEnemyEntity(MOBILE_TYPES.Orc, ENEMY_BASICS[MOBILE_TYPES.Orc], null, 10, lcg(3)), { activeEffects: [] });
/** A caster: SetEnemySpells' pool (10 x level + 100). */
const casterFoe = () => {
  const f = dryFoe();
  setEnemySpells(f, [], new Map());
  return f;
};

/** Math.random answers `values` in turn while `fn` runs (the payload's save and 1d6 are DFU's Random, the port's
 *  Math.random); says how many it answered. */
function withRandom(values, fn) {
  const real = Math.random;
  const q = [...values];
  let used = 0;
  Math.random = () => { used++; return q.length ? q.shift() : 0.5; };
  try { return { out: fn(), used }; } finally { Math.random = real; }
}
/** One landed blow of the Mace through the real formula, its payload's save failed (a Dice100 of 100) and its 1d6
 *  rolled from `d6` (Random.Range(1, 7): 1 + floor(r x 6)). */
function strike(p, mace, foe, d6 = 0.5, rolls = lcg(11)) {
  let r;
  do {
    r = withRandom([0.99, d6], () => calculateAttackDamage(p, foe, { weapon: mace, rolls }));
  } while (r.out === 0);   // a miss runs no payload (MaceOfMolagBalEffect.cs:85, sourceDamage == 0)
  return r.out;
}

let clock = 10_000;
setDefaultEnchantCtx({ now: () => clock });   // a host's mounted clock (hostEnchant.js createEnchantCtx's `now`)
const sinksFor = (e) => ({ hurt: (n) => { e.health -= n; }, heal: () => {}, drainMagicka: () => {}, restoreMagicka: () => {}, drainFatigue: () => {}, restoreFatigue: () => {}, say: () => {} });

test('MACE-MAX: a wielder at 100 Strength striking a dry foe gains the drained Strength past 100 - its max mod AND its mod, as ChangeStatMaxMod and ChangeStatMod raise both (MaceOfMolagBalEffect.cs:138-139); the foe loses it; the bill is DFU\'s (mutants: the max mod not added; the clamp ignoring max mods)', () => {
  const { p, mace } = wielder();
  assert.equal(hasArtifactSubtype(mace, ARTIFACTS.MaceOfMolagBal), true, 'the producer\'s Mace: SetArtifact\'s enchantment record');
  assert.deepEqual([mace.material, mace.maxCondition, mace.currentCondition], [9, 1500, 1500], 'Daedric, 1500 uses');
  assert.equal(liveStat(p, 'strength'), 100);
  const foe = dryFoe();
  assert.equal(foe.magicka ?? 0, 0, 'an orc casts nothing - the strength arm');
  const foeStr = liveStat(foe, 'strength');

  const before = mace.currentCondition;
  const d = strike(p, mace, foe, 0.5);   // 1 + floor(0.5 x 6) = 4
  assert.equal(liveStat(foe, 'strength'), foeStr - 4, 'the foe is drained of 4 (DrainTargetStrength)');
  const st = maceState(p);
  assert.deepEqual([st.statMaxMods.strength, st.statMods.strength], [4, 4], 'the live effect carries the drain twice: max and mod');
  assert.equal(liveStat(p, 'strength'), 104, 'more strength than fully rested - 100 lifted to 104');
  // THE BILL IS DFU'S, no more: DamageEquipment's (10 x D + 50) / 100 for the blow and the payload's durabilityLoss =
  // sourceDamage (:147-151) - nothing billed twice, no multiplier of the port's on either
  assert.equal(before - mace.currentCondition, Math.trunc((10 * d + 50) / 100) + d, 'wear(D) + D');

  // a second strike accumulates both (1 + floor(0.99 x 6) = 6)
  strike(p, mace, foe, 0.99);
  assert.deepEqual([st.statMaxMods.strength, st.statMods.strength], [10, 10]);
  assert.equal(liveStat(p, 'strength'), 110);
  // THE CEILING IS THE CLAMP'S, max mods in it: a Fortify on top lifts the value, the max mods alone lift the ceiling
  p.activeEffects.push({ kind: 'fortifyAttribute', stat: 'strength', magnitude: 20, roundsRemaining: 5 });
  assert.equal(liveStat(p, 'strength'), MAX_STAT_VALUE + 10, '130 clamped at MaxStatValue + maxMods');
  // MergeStatMaxMods walks every live effect, whatever made it; an ended one's are not live
  p.activeEffects.push({ kind: 'fortifyAttribute', stat: 'strength', magnitude: 0, roundsRemaining: 5, statMaxMods: { strength: 5 } });
  assert.equal(liveStat(p, 'strength'), MAX_STAT_VALUE + 15);
  p.activeEffects.at(-1).ended = true;
  assert.equal(liveStat(p, 'strength'), MAX_STAT_VALUE + 10);
  p.activeEffects.splice(-2, 2);
  assert.equal(liveStat(p, 'intelligence'), p.stats.intelligence, 'the max mods are the stat\'s own - no other moves');
});

test('MACE-MAX: the bonus ends with the effect - the twelve-minute decay in the real magic round (SetStatMaxMod and SetStatMod to 0, :72-77), and taking the Mace off (UnequipHeldItem removes the Held bundle, EntityEffectManager.cs:1073-1083) (mutant: the unequip ends nothing)', () => {
  const { p, mace } = wielder();
  const foe = dryFoe();
  clock = 20_000;
  strike(p, mace, foe, 0.5);
  assert.equal(liveStat(p, 'strength'), 104);
  assert.equal(maceState(p).lastStrikeTime, 20_000, 'the strike stamps the host clock');
  // twelve rounds, the last at minute 20,012: `now > lastStrikeTime + 12` is false - the bonus stands
  assert.equal(runMagicRoundsFor(p, 20_000, 20_000 + MACE_MAX_INCREASE_ROUNDS, { sinks: sinksFor(p) }), MACE_MAX_INCREASE_ROUNDS);
  assert.equal(liveStat(p, 'strength'), 104, 'at the boundary nothing moves');
  runMagicRoundsFor(p, 20_000 + MACE_MAX_INCREASE_ROUNDS, 20_000 + MACE_MAX_INCREASE_ROUNDS + 1, { sinks: sinksFor(p) });   // minute 20,013
  assert.equal(liveStat(p, 'strength'), 100, 'past it, mod and max mod both gone');
  assert.deepEqual([maceState(p).statMaxMods, maceState(p).statMods], [{}, {}]);

  // the unequip: the live effect goes, and with it every increase it held
  clock = 30_000;
  strike(p, mace, foe, 0.99);
  assert.equal(liveStat(p, 'strength'), 106);
  unequipItem(p, mace);
  assert.equal(maceState(p), null, 'the Held bundle is removed');
  assert.equal(liveStat(p, 'strength'), 100, 'a Mace in the pack lifts nothing');
  equipItem(p, mace);
  assert.equal(liveStat(p, 'strength'), 100, 'worn again, a fresh live effect - nothing carried over');
});

test('MACE-MAX: a save round trip keeps the max mods - saved with their effect as effectData.statMaxMods is (EntityEffectManager.cs:2269), detached from the live entry the moment the snapshot is taken (mutant: the max mods not copied)', () => {
  const { p, mace } = wielder();
  const foe = dryFoe();
  clock = 40_000;
  strike(p, mace, foe, 0.5);
  assert.equal(liveStat(p, 'strength'), 104);
  const snap = snapshotPlayer(p, { classicMinutes: clock });
  strike(p, mace, foe, 0.99);   // after the snapshot - the live entry moves on, the save does not
  assert.equal(liveStat(p, 'strength'), 110);
  const loaded = { isPlayer: true, items: [] };
  restorePlayer(loaded, JSON.parse(JSON.stringify(snap)));
  const st = maceState(loaded);
  assert.deepEqual([st?.statMaxMods, st?.statMods], [{ strength: 4 }, { strength: 4 }], 'the save\'s own, as it was taken');
  assert.equal(liveStat(loaded, 'strength'), 104, 'the loaded wielder stands past 100 as he was saved');
  assert.equal(st.lastStrikeTime, 40_000, 'and the decay\'s clock with it (CustomSaveData_v1.lastStrikeTime)');
});

test('MACE-MAX: two strikes in one round on a caster raise the max by DFU\'s amount, at once - ChangeMaxMagickaModifier(overflow) the moment it is drained (:117-123), not at the next round (the repro: two 10-point drains on a full pool, 20 not 30) (mutant: the immediate raise removed)', () => {
  const { p, mace } = wielder();
  const full = p.maxMagicka;
  assert.ok(full > 0 && p.magicka === full, 'a full pool (the live accessor - chargen.js defineLiveMaxMagicka)');
  const foe = casterFoe();
  assert.equal(foe.magicka, 10 * foe.level + 100, 'SetEnemySpells\' pool');
  // the report's repro through the real dispatcher: two Strikes of 10 inside one round
  for (let i = 0; i < 2; i++) withRandom([0.99], () => doItemEnchantmentPayloads(PAYLOAD.Strikes, mace, { entity: p, target: foe, damage: 10 }));
  assert.equal(maceState(p).maxMagickaIncrease, 20, 'each strike\'s overflow is its own drain - 10 + 10');
  assert.equal(p.maxMagicka, full + 20, 'the live max moved at once, before any round');
  assert.equal(p.magicka, full + 20, 'and holds every point drained');
  // the round's fold re-applies the tally (ConstantEffect, :62-63) - the same max, nothing counted again
  clock += 1;
  runMagicRoundsFor(p, clock - 1, clock, { sinks: sinksFor(p) });
  assert.equal(p.maxMagicka, full + 20);
  assert.equal(p.magicka, full + 20, 'no point clamped away');

  // and through the real blow: two landed strikes, each overflow its own drain
  const q = wielder();
  const caster = casterFoe();
  const top = q.p.maxMagicka;
  const d1 = strike(q.p, q.mace, caster);
  const d2 = strike(q.p, q.mace, caster);
  assert.equal(maceState(q.p).maxMagickaIncrease, d1 + d2);
  assert.equal(q.p.maxMagicka, top + d1 + d2);
  assert.equal(q.p.magicka, top + d1 + d2);
});
