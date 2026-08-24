// X10: DISPEL MAGIC (6,0) - the bundle picker, and the BUNDLE TAG the
// port needed to have one. DFU groups live effects into
// LiveEffectBundles, one per cast; the port's activeEffects is flat,
// so a bundle here is the range of entries one applySpell pushed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applySpell, isDispelMagic, isDispelCreature } from '../src/systems/effects.js';
import { buildCustomSpell, blankEffectSettings } from '../src/systems/spellMaker.js';
import { effectByKey } from '../src/systems/spellEffects.js';
import {
  liveBundles, dispelBundle, dispellableBundles, DISPEL_MAGIC_TEXT, DISPELLABLE_BUNDLE_TYPES,
} from '../src/systems/mysticism.js';

const player = () => ({ stats: { luck: 50, willpower: 50 }, skills: [], activeEffects: [], level: 1, maxMagicka: 40 });
const castOn = (ent, slots, name, heldItem = null) => applySpell(
  { ...buildCustomSpell({ slots: slots.map((x) => ({ type: x[0], subType: x[1],
    settings: { ...blankEffectSettings(), durationBase: 10 } })), rangeType: 0 }), name },
  1, ent, {}, () => 0.5, null, heldItem ? { heldItem } : {});

test('X10: one cast is one BUNDLE - every entry it pushes shares an id, a name and a type', () => {
  const e = player();
  // a two-effect spell: Levitate (14,255) + Water Walking (31,255)
  castOn(e, [[14, 255], [31, 255]], 'Airy Step');
  assert.equal(e.activeEffects.length, 2);
  const [a, b] = e.activeEffects;
  assert.equal(a.bundleId, b.bundleId, 'both entries belong to the same cast');
  assert.equal(a.bundleName, 'Airy Step');
  assert.equal(a.bundleType, 'Spell');
  // A DIFFERENT spell is a different bundle.
  castOn(e, [[25, 255]], 'Slowfall');
  assert.equal(new Set(e.activeEffects.map((x) => x.bundleId)).size, 2);

  // A LIKE-KIND RECAST does NOT make a second bundle here, and that is
  // a modelling difference worth stating rather than papering over.
  // DFU's AssignBundle adds the new bundle to instancedBundles even
  // when the effect inside it merges into an incumbent via AddState,
  // so DFU's picker would show two entries for two casts of Levitate.
  // The port has no separate bundle list - a bundle IS the entries a
  // cast pushed - and an incumbent recast pushes none, so it stays one.
  // The port's answer is arguably the more coherent of the two (there
  // is only one levitation to dispel), but it IS a difference.
  const before = new Set(e.activeEffects.map((x) => x.bundleId)).size;
  castOn(e, [[14, 255]], 'Airy Step');
  assert.equal(new Set(e.activeEffects.map((x) => x.bundleId)).size, before,
    'an incumbent recast merges, so it adds no bundle');
});

test('X10: liveBundles groups them, and an item cast is a HeldMagicItem bundle', () => {
  const e = player();
  castOn(e, [[14, 255], [31, 255]], 'Airy Step');
  castOn(e, [[25, 255]], 'Feather Fall', { equipSlot: 1, currentCondition: 100 });
  const bundles = liveBundles(e);
  assert.equal(bundles.length, 2);
  const spell = bundles.find((b) => b.name === 'Airy Step');
  const item = bundles.find((b) => b.name === 'Feather Fall');
  assert.equal(spell.entries.length, 2, 'the two-effect spell is ONE bundle of two');
  assert.equal(spell.bundleType, 'Spell');
  assert.equal(item.bundleType, 'HeldMagicItem', 'an equipped-item cast is the other type');
  // DFU allows dispelling item effects - "confirmed classic allows
  // player to dispel effects from items"
  assert.deepEqual([...DISPELLABLE_BUNDLE_TYPES], ['Spell', 'HeldMagicItem']);
  assert.equal(dispellableBundles(bundles).length, 2, 'both are offered');
});

test('X10: an ENDED entry and an UNTAGGED one are not bundles', () => {
  const e = player();
  castOn(e, [[14, 255]], 'Levitate');
  e.activeEffects[0].ended = true;
  assert.equal(liveBundles(e).length, 0, 'an ended entry is not live magic');
  // an entry from no cast at all belongs to no bundle - inventing one
  // would let the picker offer something it cannot coherently remove
  e.activeEffects.push({ kind: 'levitate', roundsRemaining: 5 });
  assert.equal(liveBundles(e).length, 0, 'an untagged entry is skipped, not lumped in');
});

test('X10: the picker hides a bundle with nothing to show (ShowIcon is per BUNDLE)', () => {
  // DispelMagic.cs:100-112 - "at least one effect with remaining
  // rounds must want to show an icon". The port's showIcon-false set
  // is the armed Open/Lock markers, the only ShowSpellIcon = false
  // classes that leave a lasting entry.
  const e = player();
  castOn(e, [[17, 255]], 'Open');   // armed marker only
  const armed = liveBundles(e);
  if (armed.length) {
    assert.equal(armed[0].showIcon, false, 'an armed-marker bundle shows nothing');
    assert.equal(dispellableBundles(armed).length, 0, 'so the picker does not list it');
  }
  // a bundle with ANY ordinary member does show
  castOn(e, [[17, 255], [14, 255]], 'Open and Rise');
  const mixed = liveBundles(e).find((b) => b.name === 'Open and Rise');
  assert.equal(mixed.showIcon, true, 'one icon-showing member carries the whole bundle');
});

test('X10: dispelling removes the WHOLE bundle, and a self-cast never gets to resist', () => {
  const e = player();
  castOn(e, [[14, 255], [31, 255]], 'Airy Step');
  castOn(e, [[25, 255]], 'Slowfall');
  const [first] = liveBundles(e);
  assert.equal(e.activeEffects.length, 3);
  // THE ASYMMETRY: "player self-cast spells are always dispelled,
  // otherwise use Chance roll" - so a hopeless roll still succeeds.
  const r = dispelBundle(e, first.bundleId, { selfCast: true, roll01: 0.99, chance: 1 });
  assert.equal(r.removed, 2, 'both entries of that cast, and only those');
  assert.equal(r.alert, 'dispelMagicSuccess');
  assert.equal(e.activeEffects.length, 1, 'the other bundle is untouched');
  assert.equal(liveBundles(e)[0].name, 'Slowfall');
});

test('X10: a bundle cast AT you DOES get a roll, and a failure removes nothing', () => {
  const e = player();
  castOn(e, [[14, 255]], 'Foreign Levitate');
  const [b] = liveBundles(e);
  const miss = dispelBundle(e, b.bundleId, { selfCast: false, roll01: 0.99, chance: 30 });
  assert.deepEqual(miss, { removed: 0, alert: 'dispelMagicFailed' });
  assert.equal(e.activeEffects.length, 1, 'a failed dispel consumes nothing');
  const hit = dispelBundle(e, b.bundleId, { selfCast: false, roll01: 0.0, chance: 30 });
  assert.equal(hit.removed, 1);
  assert.equal(hit.alert, 'dispelMagicSuccess');
  // dispelling a bundle that is not there is a no-op, not a throw
  assert.deepEqual(dispelBundle(e, 9999, { selfCast: true }), { removed: 0, alert: null });
});

test('X10: the cast opens a picker, lands nothing, and does NOT refund', () => {
  // Identify refunds its own cost before opening its window; DFU is
  // explicit that Dispel Magic does not - "confirmed in classic that
  // Dispel Magic spell point cost is applied when casting even if
  // player cancels popup. So not refunding spell points at cast time
  // here like Identify."
  const e = player();
  const out = applySpell(
    buildCustomSpell({ slots: [{ type: 6, subType: 0, settings: { ...blankEffectSettings(), chanceBase: 55, chanceMod: 0 } }], rangeType: 0 }),
    1, e, {}, () => 0.99, null, {});
  assert.equal(out.skipped, 0, 'the library honours Dispel Magic now');
  assert.deepEqual(out.dispelMagic, { chance: 55 }, 'the chance travels to the picker');
  assert.equal(out.identify, undefined, 'and no refund payload - that is Identify\'s alone');
  assert.deepEqual(e.activeEffects, [], 'nothing lands on the caster');
  // it is not a creature dispel
  assert.equal(isDispelMagic({ type: 6, subType: 0 }), true);
  assert.equal(isDispelCreature({ type: 6, subType: 0 }), false);
  assert.equal(effectByKey('6,0').ported, true);
  // a FOE takes nothing - "target must be player"
  const foe = { ...player(), mobileType: 15 };
  const onFoe = applySpell(
    buildCustomSpell({ slots: [{ type: 6, subType: 0, settings: { ...blankEffectSettings() } }], rangeType: 1 }),
    1, foe, {}, () => 0.5, null, {});
  assert.equal(onFoe.dispelMagic, undefined);
});

test('X10: the two outcome lines are the classic strings', () => {
  assert.deepEqual({ ...DISPEL_MAGIC_TEXT }, {
    dispelMagicSuccess: 'Dispel magic was a success...',
    dispelMagicFailed: 'Dispel magic failed...',
  });
});
