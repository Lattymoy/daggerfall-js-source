// PWR1 (2026-10-23, bible/05-Combat/Power-Arc.md section 4; Mac: "I want people to have power fantasy but I also want
// this to be balanced", then "Lets do all of it ... do it right. No band aids or short cuts"): ONE POWER BUDGET - every
// source on a named channel, SUMMED (never chained) and landed through one curve: whole to the knee, then approaching the
// ceiling, half again the knee. Each knee pinned to the system whose unconditional most it is; the doors that read the
// channels driven through their own registries; what stands outside the sum - a power that turns a blow or a spell whole
// on its own clock, the skill's own climb, the flat points - kept out of it.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  POWER_CHANNELS, CHANNEL_IDS, CEILING_OVER_KNEE, budgeted, landedShare, openLedger, ledgerShare, registerEvadeSource,
  registerGuardSource, evadeChances, rollEvade, guardSum, guardHurt, landGain, _resetPowerBudgetForTests, _setPowerBudgetRandForTests,
} from '../../../src/systems/power/powerBudget.js';
import { registerWeaponBlowMod, registerWeaponDamageMod, weaponBlowMods, weaponBlowGain, weaponDamageMods, registerEntityFold, computeEntityMods, entityModsOf, newMods } from '../../../src/systems/entityMods.js';
import { SWING_PACE_MOST, swingPacePct, swingPaceSum, registerSwingPaceMod } from '../../../src/characters/weaponStates.js';
import '../../../src/combat/swingLaw.js';   // the pace curve handed to the leaf, as every rig has it
import { tryAbsorption, registerAbsorptionChance, portAbsorbSum } from '../../../src/systems/absorption.js';
import { castRate, castSpeedSum, registerCastSpeedMod } from '../../../src/systems/castSpeed.js';
import { BLOW_CAP, CAST_COST_CAP, STAT_DEFS } from '../../../src/net/firmament/firmamentLaw.js';
import { AFFIX_RANGES, LEGENDARY_POWERS, ARCANE_LEGENDARIES } from '../../../src/systems/loot/lootRarity.js';
import { LEECH_CAP, CAST_SPEED_CAP } from '../../../src/systems/loot/lootPowers.js';
import { EFFECTIVE_SKILL_MAX, SKILL_SOFT_CAP } from '../../../src/systems/skillSoftcap.js';
import { WEAPON_POTENCY_PER_POINT } from '../../../src/systems/weaponMastery.js';
import { SIGIL_SETS } from '../../../src/systems/sigil/sigilSets.js';
import { powerBudgetRows } from '../../../src/systems/power/powerSheet.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const near = (a, b) => Math.abs(a - b) < 1e-9;

test('PWR1 THE CURVE: whole to the knee; past it knee + e x S / (S + e), approaching the ceiling and never reaching it; every channel\'s ceiling half again its knee; nothing, a price or an unknown channel passes whole (mutants: the ceiling ratio; the hyperbola\'s numerator; the knee read strictly)', () => {
  assert.equal(CEILING_OVER_KNEE, 1.5);
  assert.deepEqual(CHANNEL_IDS, ['blow', 'roll', 'guard', 'evade', 'spell', 'castCut', 'pierce', 'absorb', 'castSpeed', 'pace', 'leech', 'regen', 'manaRegen', 'killHeal', 'killMana', 'skill', 'armor', 'resist']);
  for (const id of CHANNEL_IDS) {
    const { knee, ceiling } = POWER_CHANNELS[id];
    assert.equal(ceiling, knee * 1.5, `${id}: half again`);
    assert.equal(budgeted(id, knee), knee, `${id}: the knee itself is whole`);
    assert.equal(budgeted(id, knee / 2), knee / 2, `${id}: under it, whole`);
    const S = ceiling - knee;
    for (const e of [1, S, 10 * S, 1000 * S]) assert.ok(near(budgeted(id, knee + e), knee + (e * S) / (S + e)), `${id}: ${e} past the knee`);
    assert.ok(near(budgeted(id, knee + S), knee + S / 2), `${id}: the span past the knee lands half of it`);
    assert.ok(budgeted(id, 1e12) < ceiling, `${id}: never the ceiling`);
    assert.ok(budgeted(id, knee + 2) > budgeted(id, knee + 1), `${id}: every piece still adds`);
  }
  assert.equal(budgeted('blow', -20), -20, 'a price passes whole');
  assert.equal(budgeted('no-such-channel', 500), 500);
  assert.equal(budgeted('blow', Number.NaN), 0);
  assert.equal(landedShare('blow', 0), 1);
  assert.ok(near(landedShare('blow', 60), budgeted('blow', 60) / 60));
});

test('PWR1 THE KNEES: each the most one system gives unconditionally on its channel, read from that system (mutants: any knee moved off its source)', () => {
  const k = (id) => POWER_CHANNELS[id].knee;
  assert.equal(k('blow'), BLOW_CAP, 'the sky\'s blow group');
  assert.equal(k('blow'), AFFIX_RANGES.slayer.legendary[1], '...and a Legendary slayer line\'s top');
  assert.equal(k('roll'), AFFIX_RANGES.damage.legendary[1], 'a Legendary damage line\'s top');
  assert.equal(k('guard'), STAT_DEFS.blowTaken.max, 'the sky\'s blowTaken');
  assert.equal(k('evade'), LEGENDARY_POWERS['ravens-wings'].chance, 'the Raven');
  assert.equal(k('spell'), STAT_DEFS.spellPower.max, 'the sky\'s spellPower');
  assert.equal(k('castCut'), CAST_COST_CAP, 'the sky\'s castCost group');
  assert.equal(k('pierce'), ARCANE_LEGENDARIES.find((r) => r.id === 'eye-of-magnus').power.points, 'the Eye of Magnus');
  assert.equal(k('absorb'), SIGIL_SETS.mora.tiers[2].values.absorb[1], 'Mora\'s Eye at its top');
  assert.equal(k('castSpeed'), CAST_SPEED_CAP, 'the loot\'s cast speed cap');
  assert.equal(k('pace'), Math.round((EFFECTIVE_SKILL_MAX - SKILL_SOFT_CAP) * WEAPON_POTENCY_PER_POINT * 100), 'the Short Blade\'s climb past 100');
  assert.equal(k('leech'), LEECH_CAP, 'the loot\'s leech cap');
  assert.equal(k('regen'), STAT_DEFS.hpRegen.max, 'the sky\'s hpRegen (tenths)');
  assert.equal(k('manaRegen'), STAT_DEFS.mpRegen.max, 'the sky\'s mpRegen (tenths)');
  assert.equal(k('killHeal'), LEGENDARY_POWERS['gortwogs-cleaver'].heal, 'Orc Rage');
  assert.equal(k('killMana'), LEGENDARY_POWERS['worms-tooth'].pct, 'Soul Siphon');
  assert.equal(k('skill'), AFFIX_RANGES.skill.legendary[1], 'a Legendary skill line\'s top');
  assert.equal(k('armor'), AFFIX_RANGES.armor.legendary[1], 'a Legendary armour line\'s top');
  assert.equal(k('resist'), AFFIX_RANGES.resist.legendary[1], 'a Legendary resistance line\'s top');
  assert.equal(SWING_PACE_MOST, POWER_CHANNELS.pace.ceiling, 'the leaf\'s restated ceiling is the channel\'s');
});

test('PWR1 THE BLOW: every modifier asked at the blow itself, the gains SUMMED and landed through the blow channel - never chained; the skill\'s own multiplies the landed blow, then the flat points add (mutants: the chain back; the skill\'s own summed; the flat summed; the flat before the skill\'s own)', () => {
  const foe = { isPlayer: false, health: 100, maxHealth: 100 };
  const me = { isPlayer: true, health: 100, maxHealth: 100 };
  _resetPowerBudgetForTests();
  registerWeaponBlowMod('pwr1-a', (w, d) => d + d * 0.2);
  registerWeaponBlowMod('pwr1-b', (w, d) => d + d * 0.2);
  try {
    assert.equal(weaponBlowGain(null, 100, me, foe), 40, 'each of the blow itself: 20 and 20');
    assert.equal(weaponBlowMods(null, 100, me, foe), 100 + Math.floor(budgeted('blow', 40)), 'summed past the knee, on the curve (136) - the chain was 144');
    registerWeaponBlowMod('pwr1-b', (w, d) => d + d * 0.05);
    assert.equal(weaponBlowMods(null, 100, me, foe), 125, 'under the knee: whole');
    registerWeaponBlowMod('pwr1-skill', (w, d) => d * 2, { outside: 'skill' });
    registerWeaponBlowMod('pwr1-flat', (w, d) => d + 5, { outside: 'flat' });
    assert.equal(weaponBlowMods(null, 100, me, foe), 125 * 2 + 5, 'the landed blow doubled by the skill\'s own, then the flat');
    assert.equal(weaponBlowGain(null, 100, me, foe), 25, 'neither in the channel\'s sum');
  } finally { for (const n of ['pwr1-a', 'pwr1-b', 'pwr1-skill', 'pwr1-flat']) registerWeaponBlowMod(n, null); }
  // the real registrations: the climb is the skill's own, the sears flat, every other source in the sum
  assert.match(rd('src/systems/weaponMastery.js'), /\nregisterWeaponBlowMod\(WEAPON_MASTERY, weaponMasteryBlow, \{ outside: 'skill' \}\);/);
  assert.match(rd('src/systems/loot/lootPowers.js'), /\nregisterWeaponBlowMod\(LOOT_SEAR, lootSear, \{ outside: 'flat' \}\);/);
  assert.match(rd('src/systems/sigil/sigilSetPowers.js'), /\nregisterWeaponBlowMod\(SIGIL_SETS_SEAR, setSear, \{ outside: 'flat' \}\);/);
  // the fraction a landed share leaves is carried on the weapon, and the Stats page's estimate keeps none
  const w = {};
  const lands = [1, 2, 3].map(() => landGain('blow', 10, 5, w));
  assert.deepEqual(lands, [13, 14, 14], 'a blow of 10 asked +50%: 3.86 a blow, the fraction carried');
  _resetPowerBudgetForTests();
  assert.deepEqual([landGain('blow', 10, 5, w, true), landGain('blow', 10, 5, w, true)], [13, 13], 'an estimate carries nothing');
});

test('PWR1 THE ROLL: the weapon\'s own lines, its gems and its heirloom each asked at the roll, summed, landed through the roll channel (mutants: the chain back)', () => {
  registerWeaponDamageMod('pwr1-r1', (w, d) => d + d * 0.3);
  registerWeaponDamageMod('pwr1-r2', (w, d) => d + d * 0.3);
  try {
    assert.equal(weaponDamageMods({ group: 'Weapons' }, 100), 100 + Math.floor(budgeted('roll', 60)), '60% past the knee of 40: 56.7');
  } finally { registerWeaponDamageMod('pwr1-r1', null); registerWeaponDamageMod('pwr1-r2', null); }
});

test('PWR1 THE LEDGER: sources that pay one after another (a blow\'s leeches, a round\'s regenerations, a kill\'s heals) land as the curve over their sum, whatever their order; with no ledger open a source takes its own whole (mutants: each source curved alone; the order read)', () => {
  const a = openLedger('leech');
  const got = [a.take(8), a.take(8), a.take(8)];
  assert.ok(near(got.reduce((s, x) => s + x, 0), budgeted('leech', 24)), 'the three land as the curve over 24');
  assert.equal(got[0], 8, 'the first under the knee whole');
  const b = openLedger('leech');
  const back = [b.take(16), b.take(8)];
  assert.ok(near(back[0] + back[1], budgeted('leech', 24)), 'in another order, the same whole');
  assert.equal(a.sum, 24);
  assert.equal(ledgerShare(null, 12), 12, 'a door that opened none: whole');
  assert.equal(ledgerShare(openLedger('killHeal'), 12), budgeted('killHeal', 12));
  // the doors open them
  assert.match(rd('src/combat/formulas.js'), /leech: openLedger\('leech'\)/, 'a blow\'s leeches');
  assert.match(rd('src/systems/worldTick.js'), /regen: openLedger\('regen'\), manaRegen: openLedger\('manaRegen'\)/, 'a round\'s');
  assert.match(rd('src/systems/playerKills.js'), /heal: openLedger\('killHeal'\), mana: openLedger\('killMana'\)/, 'a kill\'s');
});

test('PWR1 THE DOOR: every evasion\'s chance summed into ONE roll through the evade channel, its voice the source the roll fell on; every guard summed through the guard channel, whole points, a carry for a foe\'s blows and one for every other hurt (mutants: a roll a source; the voice the first always; the guard chained; one carry for both)', () => {
  _resetPowerBudgetForTests();
  const said = [];
  registerEvadeSource('pwr1-e1', { chance: (e, ctx) => (ctx.blow ? 15 : 0), said: () => said.push('one') });
  registerEvadeSource('pwr1-e2', { chance: (e, ctx) => (ctx.blow ? 10 : 0), said: () => said.push('two') });
  try {
    const me = { isPlayer: true };
    const blow = { blow: true, attacker: null };
    assert.deepEqual(evadeChances(me, blow).filter(([n]) => n.startsWith('pwr1')), [['pwr1-e1', 15], ['pwr1-e2', 10]]);
    assert.deepEqual(evadeChances(me, { blow: false, attacker: null }).filter(([n]) => n.startsWith('pwr1')), [], 'a fall is no blow');
    const landed = budgeted('evade', 25);
    _setPowerBudgetRandForTests(() => (landed - 0.01) / 100);
    assert.equal(rollEvade(me, blow), true, 'under the landed chance: missed');
    assert.deepEqual(said, ['two'], 'the roll fell in the second\'s share');
    _setPowerBudgetRandForTests(() => 0);
    said.length = 0; rollEvade(me, blow);
    assert.deepEqual(said, ['one'], 'and at its foot, the first\'s');
    _setPowerBudgetRandForTests(() => landed / 100);
    assert.equal(rollEvade(me, blow), false, 'at the landed chance: it lands');
  } finally { registerEvadeSource('pwr1-e1', null); registerEvadeSource('pwr1-e2', null); _resetPowerBudgetForTests(); }
  registerGuardSource('pwr1-g1', (e, ctx) => (ctx.blow ? 25 : -20));   // a price on every other hurt (a keystone's)
  registerGuardSource('pwr1-g2', (e, ctx) => (ctx.blow ? 25 : 0));
  try {
    const me = { isPlayer: true };
    assert.equal(guardSum(me, { blow: true, attacker: null }), 50);
    assert.equal(guardHurt(me, 100, { blow: true, attacker: null }), 100 - Math.floor(budgeted('guard', 50)), 'summed past the knee: 37.5 lighter, the chain was 43.75');
    _resetPowerBudgetForTests();
    const kinds = [true, false, true, false].map((blow) => guardHurt(me, 3, { blow, attacker: null }));
    assert.deepEqual(kinds, [2, 3, 2, 4], 'a blow lighter by 1.125 a hurt, every other heavier by 0.6 - each kind carries its own (one carry: [2, 3, 3, ...])');
  } finally { registerGuardSource('pwr1-g1', null); registerGuardSource('pwr1-g2', null); _resetPowerBudgetForTests(); }
  const door = rd('src/characters/playerEntity.js');
  assert.match(door, /if \(ctx\.blow && playerBlowEvaded\(entity\)\) return false;[^\n]*\n[\s\S]{0,600}if \(ctx\.blow && rollEvade\(entity, ctx\)\) return false;\s*dmg = guardHurt\(entity, dmg, ctx\);[\s\S]{0,80}dmg = playerDamageMods\(entity, dmg\);/, 'the events first, then the one roll, then the guard, then the modifiers that are no percent');
});

test('PWR1 WHAT STAYS OUTSIDE: a power that turns a blow or a spell whole on its own clock rolls its own (Phantom Strike\'s window, the Wardwright\'s Prismatic Ward) before the channel\'s one roll; Unbroken\'s halving is the death save\'s tail at the damage door (mutants: the window summed; the halving in the guard)', () => {
  assert.match(rd('src/systems/martialPowers.js'), /\nregisterPlayerBlowEvasion\(MARTIAL_POWERS, martialEvade\);/);
  assert.match(rd('src/systems/arcanePowers.js'), /\nregisterAbsorptionChance\(ARCANE_POWERS, pathAbsorbChance, \{ outside: true \}\);/);
  assert.match(rd('src/systems/sigil/sigilSetPowers.js'), /export function setDamageMod\(entity, dmg\) \{\s*let d = unbrokenHalves\(entity, dmg\);/);
  assert.doesNotMatch(rd('src/systems/sigil/sigilSetPowers.js'), /halvedUntil[^\n]*pct \+= 50/, 'never in the guard channel');
  // the absorption door, driven: a window of 40 rolls alone, then the port's summed through the channel
  const dmg = { type: 4, subType: 0, magnitudeBaseLow: 20, magnitudeBaseHigh: 20, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1 };
  const target = () => ({ isPlayer: true, career: {}, maxMagicka: 200, magicka: 0, level: 1, skills: new Array(40).fill(50), stats: { intelligence: 50, willpower: 50 }, activeEffects: [] });
  registerAbsorptionChance('pwr1-window', () => 40, { outside: true });
  registerAbsorptionChance('pwr1-a', () => 30);
  registerAbsorptionChance('pwr1-b', () => 30);
  try {
    assert.equal(portAbsorbSum(target()), 60, 'the window is no part of the sum');
    const seq = (...v) => { let i = 0; return () => v[i++] ?? 0.99; };
    assert.ok(tryAbsorption(dmg, 0, target(), { rolls: seq(0.39) }) > 0, 'the window\'s own roll, its words whole');
    assert.ok(tryAbsorption(dmg, 0, target(), { rolls: seq(0.5, (budgeted('absorb', 60) - 0.5) / 100) }) > 0, 'then the channel\'s one roll at its landed chance');
    assert.equal(tryAbsorption(dmg, 0, target(), { rolls: seq(0.5, (budgeted('absorb', 60) + 0.5) / 100) }), 0);
  } finally { for (const n of ['pwr1-window', 'pwr1-a', 'pwr1-b']) registerAbsorptionChance(n, null); }
});

test('PWR1 THE PACE AND THE CAST: the swing\'s pace and the casting speed summed and landed through their channels - the leaf handed its curve by the swing law (mutants: the curve not handed; the cast\'s sum uncurved)', () => {
  registerSwingPaceMod('pwr1-p1', () => 40);
  registerSwingPaceMod('pwr1-p2', () => 30);
  try {
    const ctx = { entity: { isPlayer: true }, weaponType: 0, usingRightHand: true };
    assert.ok(swingPaceSum(ctx) >= 70);
    assert.ok(near(swingPacePct(ctx), budgeted('pace', swingPaceSum(ctx))), 'on the curve');
    assert.ok(swingPacePct(ctx) < SWING_PACE_MOST);
  } finally { registerSwingPaceMod('pwr1-p1', null); registerSwingPaceMod('pwr1-p2', null); }
  assert.match(rd('src/combat/swingLaw.js'), /registerSwingPaceCurve\(\(pct\) => budgeted\('pace', pct\)\)/);
  assert.doesNotMatch(rd('src/characters/weaponStates.js'), /^import /m, 'the leaf stays a leaf');
  registerCastSpeedMod('pwr1-c', () => 60);
  try {
    const me = { isPlayer: true, stats: { speed: 50 }, activeEffects: [] };
    assert.equal(castSpeedSum(me), 60);
    assert.ok(near(castRate(me), 1 + budgeted('castSpeed', 60) / 100));
  } finally { registerCastSpeedMod('pwr1-c', null); }
});

test('PWR1 THE FOLDS: what every fold gives one skill, one body part and one element lands through its channel for MY entity - whole points, what the curve held back kept for the Stats page; a peer\'s and a foe\'s folds their own (mutants: the folds unbudgeted; the cut unrecorded; a foe\'s budgeted)', () => {
  registerEntityFold('pwr1-f1', () => { const m = newMods(); m.skills[18] = 30; m.resist.fire = 40; m.armorParts[2] = 15; return m; });
  registerEntityFold('pwr1-f2', () => { const m = newMods(); m.skills[18] = 20; m.resist.fire = 40; m.armorParts[2] = 10; return m; });
  try {
    const me = { isPlayer: true, items: [], stats: {}, skills: new Array(35).fill(50) };
    const mods = computeEntityMods(me);
    assert.equal(mods.skills[18], Math.floor(budgeted('skill', 50)));
    assert.equal(mods.resist.fire, Math.floor(budgeted('resist', 80)));
    assert.equal(mods.armorParts[2], Math.floor(budgeted('armor', 25)));
    assert.deepEqual(entityModsOf(me).budgetCut.map((c) => [c.channel, String(c.key), c.sum]), [['skill', '18', 50], ['armor', '2', 25], ['resist', 'fire', 80]]);
    const foe = { isPlayer: false, items: [], stats: {}, skills: 50 };
    assert.equal(computeEntityMods(foe).skills[18], 50, 'a foe\'s folds are its own law');
    const peer = { isPlayer: true, peer: true, items: [], stats: {}, skills: new Array(35).fill(50) };
    assert.equal(computeEntityMods(peer).skills[18], 50, 'a peer\'s stand-in too');
  } finally { registerEntityFold('pwr1-f1', null); registerEntityFold('pwr1-f2', null); }
});

test('PWR1 THE STATS PAGE: the power budget\'s rows - each channel with a standing sum, what it sums and what lands, through the doors\' own readers; none for an empty channel (mutants: the rows read the curve off a copy; an empty channel listed)', () => {
  registerCastSpeedMod('pwr1-sheet', () => 45);
  try {
    const me = { isPlayer: true, items: [], stats: { speed: 50 }, skills: new Array(35).fill(50), activeEffects: [] };
    computeEntityMods(me);
    const rows = powerBudgetRows(me, {});
    const cs = rows.find((r) => r.channel === 'castSpeed');
    assert.deepEqual([cs.sum, cs.landed, cs.knee, cs.ceiling, cs.unit], [45, budgeted('castSpeed', 45), 30, 45, '%']);
    assert.ok(!rows.some((r) => r.channel === 'evade' || r.channel === 'blow'), 'nothing on them, no rows');
  } finally { registerCastSpeedMod('pwr1-sheet', null); }
  assert.match(rd('src/ui/statsCard.js'), /const budget = powerBudgetRows\(entity, \{ weapon: s\.weapon, foe: foe\.entity/, 'the card reads them');
});
