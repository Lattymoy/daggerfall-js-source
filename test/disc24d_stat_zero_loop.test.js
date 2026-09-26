// DISC24-D (2026-09-24, Lynk on Discord, "Stuck in death loop": "After leveling up to 5 online and putting stats in my
// character had low health so I rested then when I woke up it was stuck in a constant death loop").
//
// THE LOOP: a live stat at 0 kills every 0.2 real seconds whatever the health (systems/statMods.js
// killIfAnyLiveStatZero - DFU's UpdateEntityMods tail). A disease's daily roll accumulates UNBOUNDED negative statMods
// (Plague: 3..30 a day off seven stats), and a rest runs no real seconds - so a disease day that lands while the player
// sleeps leaves a live 0 that kills on the first frame after waking. The revival (systems/deathRespawn.js
// reviveForPlay, the one door for all four online revivals) restored the health, KEPT the disease - rightly - and kept
// its stat damage with it: stood up, and killed again on the next frame, for ever.
//
// Driven through the real disease course (systems/diseases.js), the real stat-zero kill and the real revival.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviveForPlay, liftZeroedStats, respawnHealth } from '../src/systems/deathRespawn.js';
import { startDisease, updateDiseases, DISEASES } from '../src/systems/diseases.js';
import { killIfAnyLiveStatZero, liveStat, STAT_KEYS_ORDER, REFRESH_MODS_DELAY } from '../src/systems/statMods.js';

const STATS = { strength: 40, intelligence: 50, willpower: 45, agility: 55, endurance: 35, personality: 40, speed: 50, luck: 45 };
const player = () => ({ isPlayer: true, level: 5, health: 12, maxHealth: 60, fatigue: 1000, stats: { ...STATS }, activeEffects: [] });
/** Frames of play at 60 Hz: the stat-zero kill's own cadence, the death through the one damage door. */
function play(p, seconds) {
  let deaths = 0;
  const sinks = { hurt: (n) => { p.health -= n; if (p.health <= 0) deaths++; } };
  for (let t = 0; t < seconds * 60 && p.health > 0; t++) killIfAnyLiveStatZero(p, sinks, 1 / 60);
  return deaths;
}

test('DISC24-D: the loop as Lynk had it - a plague day in the night zeroes a stat, and the revival no longer hands it back', () => {
  const p = player();
  const entry = startDisease(p, DISEASES.Plague, 100, () => 0);
  assert.ok(entry, 'the plague took');
  // the rest: two plague days land while the player sleeps (max rolls - 30 a day off seven stats)
  updateDiseases(p, 102, { hurt: () => {} }, () => 0.9999);
  assert.equal(liveStat(p, 'endurance'), 0, 'endurance is gone under the plague');
  assert.equal(p.health > 0, true, 'and the rest itself killed no one - it runs no real seconds');
  // waking: the first frames kill
  assert.equal(play(p, 1), 1, 'dead on waking - DFU\'s own law, and right');
  // the revival, as the online respawn makes it
  const out = reviveForPlay(p, { force: true });
  assert.ok(out.lifted.includes('endurance'), `the zeroed stats are named (${out.lifted})`);
  for (const s of STAT_KEYS_ORDER) assert.ok(liveStat(p, s) > 0, `${s} stands (${liveStat(p, s)})`);
  // the loop: before the fix this died again inside the first 0.2 s, every time
  assert.equal(play(p, 10), 0, 'ten seconds of play and no second death');
  assert.ok(p.health > 0);
  // the disease is KEPT - its course and its clock; only the hold that would kill today is eased
  assert.ok(p.activeEffects.some((a) => a === entry && !a.ended), 'the plague is still on the player');
  assert.equal(entry.lastDay, 102, 'its clock untouched');
  assert.ok(entry.statMods.endurance < 0, 'and it still weighs on the stat - eased, not cured');
});

test('DISC24-D: a lifted stat stands at the respawn fraction of its permanent value - the health\'s law - and no higher', () => {
  const p = player();
  p.activeEffects.push({ kind: 'disease', disease: DISEASES.Plague, statMods: { strength: -90, agility: -10 } });
  const out = reviveForPlay(p, { force: true });
  assert.deepEqual(out.lifted, ['strength']);
  assert.equal(liveStat(p, 'strength'), respawnHealth(STATS.strength), 'half the permanent 40');
  assert.equal(p.activeEffects[0].statMods.strength, -(STATS.strength - respawnHealth(STATS.strength)), 'the hold given back all but the lift');
  assert.equal(liveStat(p, 'agility'), STATS.agility - 10, 'a stat that is not at zero is not touched');
  // the fatigue floor is measured AFTER the lift: its ceiling is (live STR + live END) x 64
  const q = player(); q.fatigue = 0;
  q.activeEffects.push({ kind: 'disease', disease: DISEASES.Plague, statMods: { strength: -90 } });
  reviveForPlay(q, { force: true });
  assert.equal(q.fatigue, respawnHealth((respawnHealth(STATS.strength) + STATS.endurance) * 64));
});

test('DISC24-D: disease damage is eased first, then a drain; two diseases on one stat are eased in turn', () => {
  const p = player();
  p.activeEffects.push(
    { kind: 'disease', disease: 1, statMods: { speed: -30 } },
    { kind: 'disease', disease: 3, statMods: { speed: -30 } },
    { kind: 'drainAttribute', stat: 'speed', magnitude: 20 },
  );
  assert.equal(liveStat(p, 'speed'), 0);
  assert.deepEqual(liftZeroedStats(p), ['speed']);
  assert.equal(liveStat(p, 'speed'), respawnHealth(STATS.speed));
  assert.equal(p.activeEffects[0].statMods.speed, 0, 'the first disease\'s hold eased whole');
  assert.equal(p.activeEffects[1].statMods.speed, -5, 'the second eased only as far as the lift');
  assert.equal(p.activeEffects[2].magnitude, 20, 'the drain untouched - the diseases were enough');
  const q = player();
  q.activeEffects.push({ kind: 'drainAttribute', stat: 'luck', magnitude: 30 }, { kind: 'transferAttribute', stat: 'luck', magnitude: 30 });
  assert.deepEqual(liftZeroedStats(q), ['luck'], 'a drain and a transfer together can zero a stat, and are eased');
  assert.equal(liveStat(q, 'luck'), respawnHealth(STATS.luck));
});

test('DISC24-D: every revival path lifts - a death with no force (prison, the dead load), the respawn, and a living release caught between two kill ticks', () => {
  const dead = player(); dead.health = 0;
  dead.activeEffects.push({ kind: 'disease', disease: 1, statMods: { willpower: -80 } });
  assert.deepEqual(reviveForPlay(dead).lifted, ['willpower']);
  assert.equal(play(dead, 2), 0);
  const living = player();
  living.activeEffects.push({ kind: 'disease', disease: 1, statMods: { willpower: -10 } });
  assert.deepEqual(reviveForPlay(living).lifted, [], 'nothing at zero: nothing eased - it is not a cure');
  assert.equal(living.activeEffects[0].statMods.willpower, -10);
  // alive with a live 0 - the window between two of the kill's 0.2 s ticks - is the death, REFRESH_MODS_DELAY away
  const caught = player();
  caught.activeEffects.push({ kind: 'disease', disease: 1, statMods: { speed: -70 } });
  assert.ok(caught.health > 0 && liveStat(caught, 'speed') === 0 && REFRESH_MODS_DELAY > 0);
  assert.deepEqual(reviveForPlay(caught).lifted, ['speed'], 'a release that hands over a live 0 hands over the death');
  assert.equal(play(caught, 2), 0);
});
