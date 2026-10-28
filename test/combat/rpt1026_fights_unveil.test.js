// RPT1026-FIGHTS STRIKE-UNVEILS (a private report: in the open PvP zone a Chameleon - and, it said, any invisibility -
// stayed up after its wearer attacked a player): a blow between players is rolled on a STUB of the striker's
// sheet against the neutral stand-in (combat/duelCombat.js resolveDuelStrike, INT8), and the formula's tail takes the
// normal-power concealment off ITS attacker - the stub (formulas.js calculateAttackDamage,
// EntityEffectManager.BreakNormalPowerConcealmentEffects). So a Chameleon, an Invisibility or a Shadow of the striker's own
// stood through every blow on a player - in the zone, a duel, a siege, a Royal Tourney. The striker's own entity is named
// now, and a blow that lands damage unveils it. tools/mutants/rpt1026_fights.json.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveDuelStrike, duelAttackerOf, duelWeaponOf, duelStandIn } from '../../src/combat/duelCombat.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { applySpell } from '../../src/systems/effects.js';

const lcg = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
const stats = { strength: 62, intelligence: 40, willpower: 45, agility: 58, endurance: 55, personality: 40, speed: 52, luck: 47 };
const mkPlayer = () => ({ isPlayer: true, level: 9, raceId: 2, stats: { ...stats }, skills: Object.fromEntries(Array.from({ length: 35 }, (_, i) => [i, 60])), career: { attackModifierFlags: 0, weaponArmorShieldsBitfield: 0x00070000, abilityFlagsAndSpellPointsBitfield: 0 }, health: 70, maxHealth: 80, items: [], activeEffects: [], armorValues: [60, 70, 80, 65, 90, 100, 75], reflexes: 2, biographyAvoidHitMod: 0 });
const SWORD = 118;
/** A concealment of mine, as my own cast lays it (systems/effects.js applySpell - CasterOnly, ten rounds). */
function veiled(p, sub, variant) {
  const e = { type: sub, subType: variant, durationBase: 10, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1, magnitudeBaseLow: 0, magnitudeBaseHigh: 0, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1 };
  applySpell({ name: 'Veil', rangeType: 0, element: 4, effects: [e] }, 9, p, {}, () => 0.5, { entity: p });
}
const kinds = (p) => p.activeEffects.filter((a) => !a.ended).map((a) => a.kind);
/** A strike of `p`'s that the roll lands, and one it does not: the seeds that roll each. */
function strike(p, striker, hit) {
  const weapon = createWeapon(SWORD, 2, () => 0.5);
  const d = { by: 'melee', a: duelAttackerOf(p, weapon), w: duelWeaponOf(weapon) };
  for (let seed = 1; seed < 400; seed++) {
    const probe = resolveDuelStrike(d, duelStandIn(), { rolls: lcg(seed) });
    if ((probe.dmg > 0) !== hit) continue;
    return resolveDuelStrike(d, duelStandIn(striker), { rolls: lcg(seed) });
  }
  throw new Error('no seed rolls it');
}

test('RPT1026-FIGHTS STRIKE-UNVEILS A BLOW ON A PLAYER THAT LANDS UNVEILS ITS STRIKER: Chameleon, Invisibility and Shadow of the normal power end on my blow that lands damage (they stood through it - the formula\'s tail broke the stub\'s), not on a miss; the TRUE ones stand, as DFU\'s do (mutants: the striker never unveiled; unveiled on a miss)', () => {
  for (const [sub, kind] of [[23, 'chameleonNormal'], [13, 'invisNormal'], [24, 'shadeNormal']]) {
    const p = mkPlayer();
    veiled(p, sub, 0);
    assert.deepEqual(kinds(p), [kind], `${kind} laid`);
    assert.equal(strike(p, null, true).hit, true);
    assert.deepEqual(kinds(p), [kind], 'with no striker named: the report - it stands through a landed blow');
    assert.equal(strike(p, p, false).hit, false);
    assert.deepEqual(kinds(p), [kind], 'a miss unveils nothing (DFU: the tail breaks it on damage alone)');
    assert.equal(strike(p, p, true).hit, true);
    assert.deepEqual(kinds(p), [], `${kind}: gone with the blow that landed`);
  }
  const t = mkPlayer();
  veiled(t, 23, 1);
  const trueKind = kinds(t);
  assert.equal(trueKind.length, 1);
  strike(t, t, true);
  assert.deepEqual(kinds(t), trueKind, 'a true Chameleon stands');
});

test('RPT1026-FIGHTS STRIKE-UNVEILS EVERY BLOW BETWEEN PLAYERS NAMES ITS STRIKER: the world host\'s four - a duel\'s, a work\'s, a battle\'s and the zone\'s (the zone\'s halls reach it through wildStrike) - each hands the player as the striker (mutants: the zone\'s blow unnamed)', () => {
  const W = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.equal(W.split('= resolveDuelStrike(').length - 1, 4, 'four blows between players');
  const named = W.match(/= resolveDuelStrike\(\{[^\n]*?\}, duelStandIn\(playerEntity\)\);/g) ?? [];
  assert.equal(named.length, 4, 'each names its striker');
  assert.match(W, /const wildStrikeOut = \(to, by, weapon, swing, drawMs = 0, \{ off = false \} = \{\}\) => \{\n\s+if \(!wildFair\(to\)\) return false;\n[^\n]*\n[^\n]*\n\s+const r = resolveDuelStrike\(\{[^\n]*\}, duelStandIn\(playerEntity\)\);/, 'the zone\'s');
});
