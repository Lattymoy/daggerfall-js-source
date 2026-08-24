// X7: IDENTIFY - the unidentified-item state, the guild service, and
// the spell that opens the same window for free.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  itemIsIdentified, calculateItemIdentifyCost, identifySpellPass, identifiedTallyText,
  tradeCost, localClickDecision,
} from '../src/systems/tradeModes.js';
import { expandItemInfo } from '../src/systems/itemInfo.js';
import { serviceDestination } from '../src/systems/guildServiceFlow.js';
import { applySpell } from '../src/systems/effects.js';
import { buildCustomSpell, blankEffectSettings } from '../src/systems/spellMaker.js';
import { effectByKey } from '../src/systems/spellEffects.js';
import { HOLIDAYS } from '../src/systems/holidays.js';

const ench = () => [{ type: 0, param: 1 }];
const BROADSWORD = 118;   // the real template index, not a guess
const magic = (over = {}) => ({ group: 'Weapons', templateIndex: BROADSWORD, value: 1000, stackCount: 1, enchantments: ench(), ...over });
const mundane = (over = {}) => ({ group: 'Weapons', templateIndex: BROADSWORD, value: 1000, stackCount: 1, ...over });

test('X7: identified is DERIVED - an unenchanted item is ALWAYS identified', () => {
  // GetIsIdentified (DaggerfallUnityItem.cs:1821-1827):
  //   if (!IsEnchanted) return true;
  //   return (flags & identifiedMask) > 0;
  // The port read `item.isIdentified` raw, so a plain iron dagger came
  // back undefined -> falsy -> UNIDENTIFIED, and the Identify service
  // would have charged to identify it. Only the FLAGGED-null
  // destination kept that off the screen.
  assert.equal(itemIsIdentified(mundane()), true, 'no magic, nothing to learn');
  assert.equal(itemIsIdentified(mundane({ isIdentified: false })), true,
    'and the flag cannot make an unenchanted item unknown');
  assert.equal(itemIsIdentified(magic()), false, 'an enchanted item starts unknown');
  assert.equal(itemIsIdentified(magic({ isIdentified: true })), true);
  assert.equal(itemIsIdentified(null), true);
  // customEnchantments count too - inventory.isEnchanted reads both
  assert.equal(itemIsIdentified({ customEnchantments: [{ id: 1 }] }), false);
});

test('X7: the mode charges for the unknown and refuses the known', () => {
  const ctx = { quality: 10 };
  assert.deepEqual(tradeCost('Identify', [mundane()], ctx), { cost: 0, modeActionEnabled: false },
    'a mundane pack offers nothing to identify');
  assert.deepEqual(tradeCost('Identify', [magic({ isIdentified: true })], ctx), { cost: 0, modeActionEnabled: false });
  const live = tradeCost('Identify', [magic()], ctx);
  assert.equal(live.cost, calculateItemIdentifyCost(1000));
  assert.equal(live.modeActionEnabled, true);
  // staging follows the same derivation
  assert.equal(localClickDecision('Identify', magic(), {}).kind, 'stage');
  assert.equal(localClickDecision('Identify', mundane(), {}).kind, 'refuse');
  // in SPELL mode an already-known item can still be staged (:823)
  assert.equal(localClickDecision('Identify', magic({ isIdentified: true }), { usingIdentifySpell: true }).kind, 'stage');
});

test('X7: the cost is (25 * value) >> 8, and the Witches Festival makes it free', () => {
  assert.equal(calculateItemIdentifyCost(1000), (25 * 1000) >> 8);
  assert.equal(calculateItemIdentifyCost(1000), 97);
  assert.equal(calculateItemIdentifyCost(1000, { holidayId: HOLIDAYS.Witches_Festival }), 0);
  // the guild hook applies AFTER the shift - though no DFU guild
  // actually overrides ReducedIdentifyCost, so identity is the real
  // behaviour and the hook is the seam for a mod
  assert.equal(calculateItemIdentifyCost(1000, { reducedIdentifyCost: (c) => c >> 1 }), 48);
});

test('X7: an unidentified item hides its NAME and its MATERIAL', () => {
  // ResolveItemName (:271-272) falls back to the template name, so an
  // enchanted blade reads "Broadsword" rather than whatever it is
  // really called; ResolveItemLongName (:301-303) then drops the
  // material prefix too, so a Daedric one does not announce itself.
  const named = magic({ name: 'Blade of Fire', material: 5 });
  assert.equal(expandItemInfo('%it', named), 'Broadsword', 'the magic name is hidden');
  assert.equal(expandItemInfo('%mat', named), '', 'and so is the material');
  const known = { ...named, isIdentified: true };
  assert.equal(expandItemInfo('%it', known), 'Blade of Fire');
  assert.notEqual(expandItemInfo('%mat', known), '');
  // a mundane item was never hidden in the first place
  assert.equal(expandItemInfo('%mat', mundane({ material: 5 })), expandItemInfo('%mat', known));
  // an ARTIFACT shares the material half (`!IsIdentified || IsArtifact`)
  assert.equal(expandItemInfo('%mat', { ...known, artifact: true }), '');
});

test('X7 spell: the pass rolls PER ITEM, counts the already-known as successes, and spends once', () => {
  const a = magic(), b = magic(), c = magic({ isIdentified: true });
  // every roll succeeds
  const all = identifySpellPass([a, b, c], 100, () => 0);
  assert.equal(all.successCount, 3);
  assert.equal(all.total, 3);
  assert.equal(all.identified.length, 2, 'the already-known one needed no roll');
  assert.equal(all.spendMagicka, true);
  // every roll fails - the known one STILL counts (:970-975)
  const none = identifySpellPass([magic(), magic(), magic({ isIdentified: true })], 50, () => 0.99);
  assert.equal(none.successCount, 1, 'the tally is "how many do you now know"');
  assert.equal(none.identified.length, 0, 'and a failed roll consumes nothing');
  // an EMPTY list spends no magicka (:985-986)
  assert.equal(identifySpellPass([], 100, () => 0).spendMagicka, false);
  assert.equal(identifiedTallyText(1, 3), '1 out of 3 identified.');
});

test('X7 spell: the cast REFUNDS its own cost, floored at 5, and lands on nobody', () => {
  // Identify.cs:50-56. The effect does not attach to anything - it
  // hands the host two numbers and gets out of the way.
  const player = () => ({ stats: { luck: 50, willpower: 50 }, skills: [], activeEffects: [], level: 1, maxMagicka: 40 });
  const cast = (chanceBase) => applySpell(
    buildCustomSpell({ slots: [{ type: 40, subType: 255, settings: { ...blankEffectSettings(), chanceBase, chanceMod: 0 } }], rangeType: 0 }),
    1, player(), {}, () => 0.5, null, {});
  const out = cast(50);
  assert.equal(out.skipped, 0, 'the library honours Identify now');
  assert.ok(out.identify, 'and answers the window payload');
  assert.equal(out.identify.chance, 50, 'ChanceFunction.Custom - the chance travels, it is not rolled here');
  assert.ok(out.identify.refund >= 5, 'the refund never drops below 5');
  assert.equal(out.buffs, undefined, 'nothing was applied to the caster');
  // a FOE target takes nothing at all ("target must be player")
  const foe = { ...player(), mobileType: 15 };
  const onFoe = applySpell(
    buildCustomSpell({ slots: [{ type: 40, subType: 255, settings: { ...blankEffectSettings() } }], rangeType: 1 }),
    1, foe, {}, () => 0.5, null, {});
  assert.equal(onFoe.identify, undefined);
  assert.deepEqual(foe.activeEffects, []);
  assert.equal(effectByKey('40,255').ported, true);
});

test('X7: the service destination is no longer a FLAGGED null', () => {
  assert.equal(serviceDestination('Identify'), 'guildServiceIdentify');
});
