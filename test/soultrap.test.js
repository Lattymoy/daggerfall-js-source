// X5: SOUL TRAP - the effect, the kill-time intercept, and the gem.
// The school's most interesting arm, because one of its four outcomes
// REFUSES the death it was called to resolve.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applySpell } from '../src/systems/effects.js';
import { buildCustomSpell, blankEffectSettings } from '../src/systems/spellMaker.js';
import { effectByKey } from '../src/systems/spellEffects.js';
import {
  attemptSoulTrap, fillEmptyTrap, soulTrapNameSuffix, SOUL_TRAP_TEXT, SOUL_TRAP_TEMPLATE,
} from '../src/systems/mysticism.js';
import { expandItemInfo } from '../src/systems/itemInfo.js';

const foe = (mobileType) => ({
  stats: { luck: 50, willpower: 50 }, skills: [], activeEffects: [],
  level: 1, health: 20, maxHealth: 20, mobileType,
});
const gem = (soul = null) => ({ group: 'MiscItems', templateIndex: SOUL_TRAP_TEMPLATE, trappedSoulType: soul });
// chanceMod 0 pins the stored chance to chanceBase exactly (the blank
// settings default chanceMod/chancePerLevel to 1, so a level-1 caster
// would otherwise carry a +1 from the per-level term).
// chanceBase 60 -> a 0.5 roll succeeds, a 0.7 roll fails.
const castTrap = (target, chanceBase = 60) => applySpell(
  buildCustomSpell({ slots: [{ type: 12, subType: 255, settings: { ...blankEffectSettings(), durationBase: 10, chanceBase, chanceMod: 0 } }], rangeType: 1 }),
  1, target, {}, () => 0.99, null, {});

test('X5 Soul Trap: the CAST never fails - ChanceSuccess is hardcoded true', () => {
  // SoulTrap.cs:47-52 returns true "so that effect is always attached
  // to entity. Chance will be re-rolled using RollTrapChance() when
  // entity is slain". The cast above rolls 0.99 against a chance of
  // 60 - a certain failure for any ordinary chance-gated effect - and
  // the trap attaches anyway.
  const m = foe(15);   // a skeleton: EnemyMonster
  const out = castTrap(m);
  assert.equal(out.skipped, 0, 'the library honours Soul Trap now');
  assert.equal(out.chanceFailed, undefined, 'the cast-time chance gate never runs');
  assert.deepEqual(m.activeEffects.map((a) => a.kind), ['soulTrap']);
  assert.equal(out.trapAlert, 'trapActive');
  // the chance is FROZEN on the entry for the kill-time re-roll
  assert.equal(m.activeEffects[0].chance, 60);
  assert.equal(effectByKey('12,255').ported, true);
});

test('X5 Soul Trap: it refuses HUMANOIDS out loud and everything else in silence', () => {
  // BecomeIncumbent (:64-87). The humanoid arm `break`s, so it falls
  // through to AddHUDText and DOES speak; the default arm `return`s
  // first and is therefore silent. Getting those two the same way
  // round is the whole point of the gate.
  const bandit = foe(128);   // EnemyClass
  const out = castTrap(bandit);
  assert.equal(out.trapAlert, 'trapHumanoid', 'the humanoid refusal SPEAKS');
  assert.deepEqual(bandit.activeEffects, [], 'and the effect resigns at once');
  // anything with no mobile identity at all (the player) is silent
  const self = foe(undefined);
  const out2 = castTrap(self);
  assert.equal(out2.trapAlert, undefined, 'the default arm returns before the message');
  assert.deepEqual(self.activeEffects, []);
});

test('X5 Soul Trap: a recast stacks ROUNDS and cannot sharpen a running trap', () => {
  const m = foe(15);
  castTrap(m, 20);
  const first = m.activeEffects[0].roundsRemaining;
  const out = castTrap(m, 90);
  assert.equal(m.activeEffects.length, 1, 'one incumbent, not two');
  assert.ok(m.activeEffects[0].roundsRemaining > first, 'AddState stacks the rounds');
  assert.equal(m.activeEffects[0].chance, 20, 'and the incumbent KEEPS its own chance');
  assert.equal(out.trapAlert, undefined, 'BecomeIncumbent speaks only for a NEW incumbent');
});

test('X5 Soul Trap: the kill-time roll, and the arm that REFUSES the death', () => {
  const items = [gem()];
  // no trap at all: dies normally, silently
  assert.deepEqual(attemptSoulTrap(foe(15), 15, items, 0.0),
    { allowDeath: true, alert: null, filled: null });

  // trap + a failed roll: dies normally, "Trap failed."
  const failed = foe(15); castTrap(failed);
  const r1 = attemptSoulTrap(failed, 15, items, 0.7);
  assert.equal(r1.allowDeath, true);
  assert.equal(r1.alert, 'trapFail');
  assert.equal(items[0].trappedSoulType, null, 'a failed roll fills nothing');

  // trap + a passed roll + an empty gem: dies, soul taken
  const caught = foe(15); castTrap(caught);
  const r2 = attemptSoulTrap(caught, 15, items, 0.5);
  assert.equal(r2.allowDeath, true);
  assert.equal(r2.alert, 'trapSuccess');
  assert.equal(items[0].trappedSoulType, 15, 'the skeleton is in the gem');
  assert.equal(r2.filled, items[0]);

  // trap + a passed roll + NO empty gem: the entity does NOT die
  const tethered = foe(15); castTrap(tethered);
  const r3 = attemptSoulTrap(tethered, 15, items, 0.5);
  assert.equal(r3.allowDeath, false, 'DFU keeps the entity "tethered to life"');
  assert.equal(r3.alert, 'trapNoneEmpty');
  assert.equal(r3.filled, null);
});

test('X5 Soul Trap: the tether is not a one-off - the next blow rolls again', () => {
  // Because the effect stays, a fresh killing blow re-enters the
  // intercept. The entity dies the moment a roll FAILS, or a gem
  // frees up - so an unfillable trap makes a target unkillable for
  // as long as the spell runs.
  const m = foe(15); castTrap(m);
  const full = [gem(3)];
  assert.equal(attemptSoulTrap(m, 15, full, 0.5).allowDeath, false, 'blow 1: tethered');
  assert.equal(attemptSoulTrap(m, 15, full, 0.5).allowDeath, false, 'blow 2: still tethered');
  assert.equal(attemptSoulTrap(m, 15, full, 0.9).allowDeath, true, 'a FAILED roll lets it die');
  // and freeing a gem lets the next success land
  const withRoom = [gem(3), gem()];
  assert.equal(attemptSoulTrap(m, 15, withRoom, 0.5).allowDeath, true);
  assert.equal(withRoom[1].trappedSoulType, 15);
});

test('X5 Soul Trap: an ENDED trap is not a trap', () => {
  const m = foe(15); castTrap(m);
  m.activeEffects[0].ended = true;
  const r = attemptSoulTrap(m, 15, [gem()], 0.0);
  assert.deepEqual(r, { allowDeath: true, alert: null, filled: null });
});

test('X5 gems: the predicate is GROUP + TEMPLATE, which is what DFU searches by', () => {
  // The old default matched it.name === 'Soul trap'. The port's items
  // carry no `name` at all and the template's is "Soul Trap", so it
  // could never fire on a real item - masked only because nothing
  // called this function.
  assert.equal(SOUL_TRAP_TEMPLATE, 274);
  const real = gem();
  assert.equal(fillEmptyTrap([real], 15), real);
  // a name-only impostor is NOT a soul trap
  assert.equal(fillEmptyTrap([{ name: 'Soul trap', trappedSoulType: null }], 15), null);
  // nor is another MiscItem
  assert.equal(fillEmptyTrap([{ group: 'MiscItems', templateIndex: 132, trappedSoulType: null }], 15), null);
});

test('X5 gems: Azura\'s Star takes the soul first, and it is a REAL identity in the port', () => {
  // ROAD-U: the identity is the ENCHANTMENT the Star carries -
  // SpecialArtifactEffect with ArtifactsSubTypes.Azuras_Star (9), the
  // pair SoulTrap.cs:129 hands ContainsEnchantment - and both the
  // mint (createArtifact) and a classic import carry it. It used to be
  // a boolean only the mint wrote, so this fixture proved nothing an
  // imported Star could satisfy.
  const star = { enchantments: [{ type: 26, param: 9 }], trappedSoulType: null };
  const ordinary = gem();
  assert.equal(fillEmptyTrap([ordinary, star], 15), star, 'the Star wins wherever it sits');
  assert.equal(ordinary.trappedSoulType, null);
});

test('X5 the gem shows its soul - %hs stops printing "Nothing" over a full trap', () => {
  // ItemHelper.ResolveItemLongName's tail (:352-368), and the port's
  // own item-info macro that had no producer until the trap could fire.
  assert.equal(expandItemInfo('%hs', gem(15)), 'Skeletal Warrior');
  assert.equal(expandItemInfo('%hs', gem()), 'Nothing', 'an EMPTY trap still reads Nothing');
  // an explicit soul still wins over the item's own
  assert.equal(expandItemInfo('%hs', gem(15), { soul: 'Something Else' }), 'Something Else');
  // the bracketed name law, for a list label
  assert.equal(soulTrapNameSuffix(gem(15), (t) => (t === 15 ? 'Skeletal Warrior' : null)), ' (Skeletal Warrior)');
  assert.equal(soulTrapNameSuffix(gem(), () => 'x'), '', 'DFU left the "(empty)" alternative commented out');
  assert.equal(soulTrapNameSuffix({ group: 'Weapons', templateIndex: 274 }, () => 'x'), '');
});

test('X5: the five HUD lines are the classic strings', () => {
  assert.deepEqual({ ...SOUL_TRAP_TEXT }, {
    trapActive: 'Trap active.',
    trapHumanoid: 'Trap will not work on humanoids.',
    trapSuccess: 'Trapped soul.',
    trapFail: 'Trap failed.',
    trapNoneEmpty: 'You have no empty soul traps!',
  });
});
