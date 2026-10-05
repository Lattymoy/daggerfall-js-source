// FIELD BUGS 2026-10-05 DEATH-HOLDS (Discord, BrixBlox: "Paralysis time still continues after death" - "after dying
// to a ghost the paralysis effect still continued after respawning").
//
// DFU's death ends every effect (PlayerEntity.cs:1199-1213 OnDeath -> EntityEffectManager.Entity_OnDeath :2163-2167
// -> WipeAllBundles :772-779). The port's online revival is its own (systems/deathRespawn.js reviveForPlay) and it
// kept everything but three drains - so a Paralyze the killer landed woke with the player, every round left (the death
// screen holds the tick and skipDeadMinutes runs no magic round). The effects here are minted by the real producer,
// applySpell, not hand-built (TEST THE SHAPE THE PRODUCER MINTS).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reviveForPlay, DEATH_HOLDS, LETHAL_DRAINS } from '../src/systems/deathRespawn.js';
import { applySpell, entityIsParalyzed, isSilencedEffect } from '../src/systems/effects.js';

const fx = (type, subType, mag = 5, dur = 10) => ({
  type, subType,
  magnitudeBaseLow: mag, magnitudeBaseHigh: mag, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
  durationBase: dur, durationMod: 0, durationPerLevel: 1, chanceBase: 100, chanceMod: 0, chancePerLevel: 1,
});
const PARALYZE = fx(0, 255);               // the ghost's / the spider's
const SILENCE = fx(19, 255);               // the Wraith's
const DRAIN_FATIGUE = fx(1, 1);            // Continuous Damage - Fatigue
const DRAIN_MAGICKA = fx(1, 2);            // Continuous Damage - Spell Points
const SINKS = { hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} };
const GHOST = { entity: { name: 'Ghost', activeEffects: [] } };
const player = () => ({ maxHealth: 40, health: 0, maxMagicka: 20, magicka: 0, fatigue: 0,
  stats: { strength: 50, endurance: 50, willpower: 0, agility: 50 }, career: {}, activeEffects: [] });
const cast = (p, effects) => applySpell({ name: 'Curse', element: 4, rangeType: 1, effects }, 10, p, SINKS, () => 0, GHOST, { bypassSavingThrows: true });

test('DEATH-HOLDS: a revival ends the paralysis the killer cast - the reported case, through the producer', () => {
  const p = player();
  cast(p, [PARALYZE]);
  assert.ok(entityIsParalyzed(p), 'the ghost\'s paralysis landed (the producer minted it)');
  const out = reviveForPlay(p, { force: true });
  assert.equal(entityIsParalyzed(p), false, 'the player stands up able to move');
  assert.deepEqual(out.released, ['paralyze'], 'and the revival says what it ended');
});

test('DEATH-HOLDS: the silence and the fatigue and magicka drains end too; a disease and an infection stay', () => {
  const p = player();
  cast(p, [SILENCE, DRAIN_FATIGUE, DRAIN_MAGICKA]);
  p.activeEffects.push({ kind: 'disease', disease: 7 }, { kind: 'disease', disease: 30, infection: 'vampirism' });
  const kinds = new Set(p.activeEffects.map((a) => a.kind));
  for (const k of ['silenced', 'continuousDamageFatigue', 'continuousDamageSpellPoints']) assert.ok(kinds.has(k), `the producer minted ${k}`);
  assert.ok(isSilencedEffect(p));
  const out = reviveForPlay(p, { force: true });
  assert.equal(isSilencedEffect(p), false, 'the Wraith\'s silence does not outlive the death');
  assert.deepEqual(out.released.sort(), ['continuousDamageFatigue', 'continuousDamageSpellPoints', 'silenced']);
  assert.deepEqual(p.activeEffects.map((a) => a.kind), ['disease', 'disease'], 'the KEPT list stands: a disease and an infection are not cured by dying');
  assert.ok(p.activeEffects.some((a) => a.infection === 'vampirism'));
});

test('DEATH-HOLDS: a dead player revived without `force` - a save of a dead player loaded online (save.js), the re-heal after the respawn\'s teleport - wakes free too (AUDIT FB1005 D1)', () => {
  const p = player();
  cast(p, [PARALYZE, SILENCE]);
  assert.ok(entityIsParalyzed(p) && isSilencedEffect(p));
  const out = reviveForPlay(p);
  assert.equal(out.revived, true);
  assert.equal(entityIsParalyzed(p), false, 'dead is enough');
  assert.deepEqual(out.released.sort(), ['paralyze', 'silenced']);
});

test('DEATH-HOLDS: a living release ends nothing - the holds are a death\'s, not a free cure', () => {
  const p = player();
  p.health = 30;
  cast(p, [PARALYZE]);
  const out = reviveForPlay(p);
  assert.deepEqual(out.released, []);
  assert.ok(entityIsParalyzed(p), 'a living player keeps what holds them');
});

test('DEATH-HOLDS: the lists are what they say - the holds named, none of them a lethal drain, and the old "kept" sentence gone', () => {
  assert.deepEqual([...DEATH_HOLDS], ['paralyze', 'silenced', 'continuousDamageFatigue', 'continuousDamageSpellPoints']);
  for (const k of DEATH_HOLDS) assert.ok(!LETHAL_DRAINS.includes(k), `${k} is a hold, not a drain - two lists, two reasons`);
  const src = readFileSync(new URL('../src/systems/deathRespawn.js', import.meta.url), 'utf8');
  assert.ok(!/^\/\/ {3}graveyard, for free\. Paralysis is kept/m.test(src), 'the comment that kept the paralysis is retired');
  assert.match(src, /const released = \(dead \|\| force\) \? endDeathHolds\(entity\) : \[\];/);
});
