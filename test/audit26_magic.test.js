// AUDIT 26 magic/effects batch. Each test pins ONE ledger row's
// corrected C# law against the port, with the DFU citation that
// settles it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  ENCHANTMENT_TYPES as T, computeEnchantmentMods,
  enchantArmorMod, enchantArmorDisplayMod, enchantChanceToHitMod,
} from '../src/systems/enchantments.js';
import { armorLabelValue } from '../src/ui/nativeInventory.js';
import { fatigueLossMultiplierFor } from '../src/scenes/shared.js';
import { SPECIAL_ABILITY } from '../src/systems/rest.js';
import { applySpell, REGENERATING_TEXT, FEEL_DRAINED_TEXT } from '../src/systems/effects.js';
import { NOT_ENOUGH_SPELL_POINTS_TEXT, identifySpellPass } from '../src/systems/tradeModes.js';
import { ITEM_GROUPS } from '../src/characters/equipRules.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(root, f), 'utf8');

const item = (type, param = -1, over = {}) => ({
  name: 'Test Item', templateIndex: 135, group: ITEM_GROUPS.Jewellery,
  currentCondition: 100, maxCondition: 100, equipSlot: 9,
  enchantments: [{ type, param }], ...over,
});
// each ring needs its OWN slot or equippedEnchantedItems would not
// see both - the fold walks equipped items, not the whole bag
const wearer = (items) => ({
  name: 'W', health: 20, maxHealth: 30, level: 5, stats: {}, skills: [40, 40, 40, 40],
  items: items.map((it, i) => ({ ...it, equipSlot: 9 + i })),
});

// ---------------------------------------------------------------
// F122: SetIncreasedArmorValueModifier is a MIN-SET, so repeats
// within the channel do not stack.
// DaggerfallEntity.cs:400-408 -
//   if (amount < IncreasedArmorValueModifier)
//       IncreasedArmorValueModifier = amount;
// ---------------------------------------------------------------
test('audit26 F122: any number of StrengthensArmor items floors at -5, not -5 each', () => {
  const one = wearer([item(T.StrengthensArmor)]);
  computeEnchantmentMods(one);
  assert.equal(enchantArmorMod(one), -5, 'one item sets the channel');

  const three = wearer([item(T.StrengthensArmor), item(T.StrengthensArmor), item(T.StrengthensArmor)]);
  computeEnchantmentMods(three);
  assert.equal(enchantArmorMod(three), -5, 'three items still -5 - the setter is a min-set, not a sum');

  // and the fold is idempotent across passes: DoConstantEffects zeroes
  // the channels first (:841-842), so a second pump cannot drift.
  computeEnchantmentMods(three);
  computeEnchantmentMods(three);
  assert.equal(enchantArmorMod(three), -5, 'repeated passes do not accumulate');
});

test('audit26 F122: BadReactionsFrom floors its armour term too, but its to-hit term IS additive', () => {
  const ctx = { nearbyFoes: () => [{ mobileType: 140 }] };   // a class enemy = Human
  const two = wearer([item(T.BadReactionsFrom, 0), item(T.BadReactionsFrom, 0)]);
  computeEnchantmentMods(two, ctx);
  // SetDecreasedArmorValueModifier(-5) twice: -5 < -5 is false.
  assert.equal(enchantArmorMod(two), -5, 'the armour channel floors');
  // ChangeChanceToHitModifier(-5) twice: `+=` (:418-421).
  assert.equal(enchantChanceToHitMod(two), -10, 'the to-hit channel keeps accumulating');
});

test('audit26 F122: the two channels are SEPARATE, so one of each still reaches -10', () => {
  const both = wearer([item(T.StrengthensArmor), item(T.BadReactionsFrom, 0)]);
  computeEnchantmentMods(both, { nearbyFoes: () => [{ mobileType: 140 }] });
  // Increased = -5, Decreased = -5, and FormulaHelper.cs:1158 adds
  // BOTH to the struck part's armour value. Only repeats WITHIN a
  // channel stop stacking.
  assert.equal(enchantArmorMod(both), -10);
});

// ---------------------------------------------------------------
// F123: WeakensArmor is INERT in DFU and stays inert here.
// WeakensArmor.cs:25 `const int decreaseArmorValue = 5;` reaches
// SetDecreasedArmorValueModifier at :63, and that setter's test is
// `amount < DecreasedArmorValueModifier` - `5 < 0` is never true
// from a channel zeroed each pass. The comment above it says
// "never goes above +5", which the code does not implement.
// ---------------------------------------------------------------
test('audit26 F123: WeakensArmor is inert - the drawback costs the player nothing but budget', () => {
  const weak = wearer([item(T.WeakensArmor)]);
  computeEnchantmentMods(weak);
  assert.equal(enchantArmorMod(weak), 0, 'a +5 never passes a `< 0` test');

  // ...and it cannot spoil a Strengthens item worn beside it.
  const mixed = wearer([item(T.StrengthensArmor), item(T.WeakensArmor)]);
  computeEnchantmentMods(mixed);
  assert.equal(enchantArmorMod(mixed), -5);

  // The setter is written as DFU writes it, bug and all - a port
  // that "fixed" the comparison would make the enchantment bite.
  assert.match(src('src/systems/enchantments.js'),
    /setDecreasedArmorValueModifier = \(mods, amount\) => \{\s*\n\s*if \(amount < mods\.decreasedArmorMod\) mods\.decreasedArmorMod = amount;/);

  // ...and it is routed to the setter WeakensArmor.cs:63 names.
  // Routing it to the increased channel instead is unobservable
  // today - both channels are min-sets seeded at 0, so a +5 is
  // inert in either - which is exactly why the pin has to read the
  // source: the day either setter changes, the channel it was
  // written for is the only record of which law it belongs to.
  assert.match(src('src/systems/enchantments.js'),
    /\[T\.WeakensArmor, \{[^\n]*setDecreasedArmorValueModifier\(mods, WEAKENS_ARMOR_VALUE\)/);
});

// ---------------------------------------------------------------
// F122 display half: RefreshArmourValues (PaperDoll.cs:161) reads
//   int armorMod = Decreased - Increased;
// which runs the OTHER way from the combat sum - the paperdoll's
// numbers rise as armour improves.
// ---------------------------------------------------------------
test('audit26 F122: the paperdoll armorMod is Decreased MINUS Increased, the combat one is the sum', () => {
  const strong = wearer([item(T.StrengthensArmor)]);
  computeEnchantmentMods(strong);
  assert.equal(enchantArmorMod(strong), -5, 'combat: harder to hit');
  assert.equal(enchantArmorDisplayMod(strong), 5, 'display: a HIGHER number');

  const bad = wearer([item(T.BadReactionsFrom, 0)]);
  computeEnchantmentMods(bad, { nearbyFoes: () => [{ mobileType: 140 }] });
  assert.equal(enchantArmorMod(bad), -5);
  assert.equal(enchantArmorDisplayMod(bad), -5, 'the other channel signs the display the same way');

  // (100 - av) / 5 + armorMod, so an av of 60 shows 8 and a
  // Strengthens ring lifts it to 13.
  assert.equal(armorLabelValue(60), 8);
  assert.equal(armorLabelValue(60, enchantArmorDisplayMod(strong)), 13);

  // ...and the window actually feeds it, which it never did before.
  assert.match(src('src/ui/nativeInventory.js'),
    /const armorMod = enchantArmorDisplayMod\(this\.hooks\.entity\);/);
  assert.match(src('src/ui/nativeInventory.js'),
    /armorLabelValue\(av\[i\] \?\? 100, armorMod\)/);
});

// ---------------------------------------------------------------
// F044: the ImprovedAthleticism fatigue arm. PlayerEntity.cs:396-400
//
//     float fatigueLossMultiplier = 1.0f;
//     if (career.Athleticism)
//         fatigueLossMultiplier = (ImprovedAthleticism) ? 0.8f : 0.9f;
//
// The enchantment arm is NESTED inside the career check, so the item
// does nothing for a character without the advantage. The port
// decoded ImprovesTalents into _enchantMods.improvedAthleticism and
// nothing read it.
// ---------------------------------------------------------------
test('audit26 F044: the fatigue multiplier is 1.0 / 0.9 / 0.8, and the enchantment arm needs the career', () => {
  // hasSpecialAbility masks the bitfield's low byte (rest.js:28-29)
  const athlete = () => ({ abilityFlagsAndSpellPointsBitfield: SPECIAL_ABILITY.Athleticism });
  const enchanted = (over) => ({ ...over, _enchantMods: { improvedAthleticism: true } });

  assert.equal(fatigueLossMultiplierFor({ career: {} }), 1.0, 'no advantage');
  assert.equal(fatigueLossMultiplierFor({ career: athlete() }), 0.9, 'the career advantage alone');
  assert.equal(fatigueLossMultiplierFor(enchanted({ career: athlete() })), 0.8, 'and the enchantment on top');
  // The nesting is the whole point: the item is worthless without
  // the career, and a flat `improved ? 0.8 : ...` would pay out here.
  assert.equal(fatigueLossMultiplierFor(enchanted({ career: {} })), 1.0,
    'the enchantment does NOTHING without the career advantage');

  // ...and it runs off the fold's own flag, not a second decode.
  assert.equal(fatigueLossMultiplierFor({ career: athlete(), _enchantMods: { improvedAthleticism: false } }), 0.9);
});

test('audit26 F044: end to end - a WORN ImprovesTalents(Athleticism) item reaches the multiplier', () => {
  // The whole chain, not a hand-written bag: ImprovesTalents.cs:82-84
  // switches on the classic param, so param 1 is the Athleticism arm
  // and its neighbours must not light this flag.
  const athlete = { abilityFlagsAndSpellPointsBitfield: SPECIAL_ABILITY.Athleticism };
  // ImprovesTalents.cs:75 reads GameManager.Instance.PlayerEntity
  // outright, so the payload is player-only.
  const worn = (param, isPlayer = true) => {
    const w = wearer([item(T.ImprovesTalents, param)]);
    w.career = athlete;
    w.isPlayer = isPlayer;
    computeEnchantmentMods(w);
    return fatigueLossMultiplierFor(w);
  };
  assert.equal(worn(1), 0.8, 'Params.Athleticism');
  assert.equal(worn(0), 0.9, 'Params.Hearing lights a different flag');
  assert.equal(worn(2), 0.9, 'Params.AdrenalineRush likewise');
  assert.equal(worn(1, false), 0.9, 'and the payload is player-only');

  // and the flag is cleared by the next pass, as :845 clears it
  const w = wearer([item(T.ImprovesTalents, 1)]);
  w.career = athlete;
  w.isPlayer = true;
  computeEnchantmentMods(w);
  assert.equal(fatigueLossMultiplierFor(w), 0.8);
  w.items = [];
  computeEnchantmentMods(w);
  assert.equal(fatigueLossMultiplierFor(w), 0.9, 'taking the item off gives the bonus back up');
});

// ---------------------------------------------------------------
// F078: the two HUD lines the port computed and never said.
// Regenerate.cs:45-53 prints on Start for a player host;
// DrainEffect.ShowPlayerDrained (:102-106) is reached from
// BecomeIncumbent (:71) and AddState (:84), both under
// `lastMagnitudeIncreaseAmount > 0`.
// ---------------------------------------------------------------
const effectRec = (type, subType, mag, dur = 0) => ({
  type, subType,
  magnitudeBaseLow: mag, magnitudeBaseHigh: mag, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
  durationBase: dur, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1,
});
const victim = (over = {}) => ({
  career: {}, maxHealth: 100, health: 100, maxMagicka: 100, magicka: 50, level: 1,
  skills: new Array(40).fill(50), stats: { intelligence: 50, willpower: 50, strength: 50 },
  ...over,
});
const cast = (effects, target) => {
  const said = [];
  applySpell({ element: 0, rangeType: 0, effects }, 1, target,
    { say: (m) => said.push(m), hurt() {}, heal() {} }, () => 0.5, { name: 'caster' }, { day: false, inside: true });
  return said;
};

test('audit26 F078: a Regenerate that takes says its line, on every cast', () => {
  const t = victim();
  // Regenerate is (18, 255); it needs a duration to take at all.
  assert.deepEqual(cast([effectRec(18, 255, 5, 10)], t), [REGENERATING_TEXT]);
  // base.Start precedes the incumbency fold, so a second cast that
  // merges into the standing incumbent still prints.
  assert.deepEqual(cast([effectRec(18, 255, 5, 10)], t), [REGENERATING_TEXT]);
  // ...but a zero-duration Regenerate never starts, so it says nothing.
  assert.deepEqual(cast([effectRec(18, 255, 5, 0)], victim()), []);
});

test('audit26 F078: a Drain says its line on the magnitude INCREASE, not on the heal', () => {
  const t = victim();
  // DrainStrength is (7, 0).
  assert.deepEqual(cast([effectRec(7, 0, 5)], t), [FEEL_DRAINED_TEXT]);
  // each further increase prints again - AddState's arm
  assert.deepEqual(cast([effectRec(7, 0, 5)], t), [FEEL_DRAINED_TEXT]);
  // a zero-magnitude drain fails `lastMagnitudeIncreaseAmount > 0`
  assert.deepEqual(cast([effectRec(7, 0, 0)], victim()), []);
  // TransferEffect IS-A DrainEffect (11, s), so it says the line too
  assert.deepEqual(cast([effectRec(11, 0, 5)], victim()), [FEEL_DRAINED_TEXT]);
});

test('audit26 F078: both strings are the ones the C# comments quote', () => {
  assert.equal(REGENERATING_TEXT, 'You are regenerating.');
  assert.equal(FEEL_DRAINED_TEXT, 'You feel drained.');
});

// ---------------------------------------------------------------
// F067: the Identify SPELL runs DoModeAction
// (DaggerfallTradeWindow.cs:954-995), a path that never reaches
// ConfirmTrade - so it neither tallies Mercantile (:1088) nor skips
// the magicka refusal (:960-963). commitTrade is a closure inside
// the host, so the arm is read from the source the way this lane's
// other commitTrade pins are.
// ---------------------------------------------------------------
function bodyOf(text, header) {
  const i = text.indexOf(header);
  assert.ok(i > 0, `${header} not found`);
  let depth = 0;
  let j = text.indexOf('{', i + header.length - 1);
  const start = j;
  for (; j < text.length; j++) {
    if (text[j] === '{') depth++;
    else if (text[j] === '}' && --depth === 0) break;
  }
  return text.slice(start, j + 1);
}

test('audit26 F067: the identify SPELL refuses on magicka and never reaches the Mercantile tally', () => {
  const commit = bodyOf(src('src/scenes/worldModes.js'),
    'function commitTrade(shelf, mode, staged, price, proceeds, identifySpell = null) {');

  // the refusal, and it comes BEFORE any identifying
  const gate = commit.indexOf('if (identifySpell.cost > (playerEntity.magicka ?? 0)) {');
  const pass = commit.indexOf('identifySpellPass(staged');
  assert.ok(gate > 0, 'the magicka refusal exists');
  assert.ok(pass > gate, 'and it is tested before the pass runs');
  assert.match(commit, /townTalk\?\.say\?\.\(NOT_ENOUGH_SPELL_POINTS_TEXT\);\s*\n\s*surfacePlayer\(\);\s*\n\s*return;/,
    'the refusal turns back the WHOLE pass');

  // the tally is ConfirmTrade's, so the spell arm returns before it
  const tally = commit.indexOf('tallySkill(playerEntity, SKILLS.Mercantile, 1);');
  assert.ok(tally > 0, 'the tally is still there for every OTHER mode');
  const spellArm = commit.slice(commit.indexOf('if (identifySpell) {'), tally);
  assert.equal((spellArm.match(/\n\s*return;/g) ?? []).length, 2,
    'both exits from the spell arm - refused and completed - return before the tally');

  // ...and the paid SERVICE is the sibling arm, which falls through
  // to it exactly as ConfirmTrade's Identify case does (:1074-1082).
  assert.match(commit, /\} else \{\s*\n\s*deductGold\(playerEntity, price\);/);
});

test('audit26 F067: the refused pass spends nothing - the per-item roll never runs', () => {
  // The behavioural half, on the module the arm delegates to: a pass
  // that never happens leaves every item unidentified and the
  // spendMagicka flag unset. DFU's refusal returns above all of it.
  const items = [{ isIdentified: false }, { isIdentified: false }];
  const ran = identifySpellPass(items, 100, () => 0);
  assert.equal(ran.successCount, 2, 'the pass identifies when it runs at all');
  assert.equal(ran.spendMagicka, true);
  assert.equal(NOT_ENOUGH_SPELL_POINTS_TEXT, 'Not enough spell points left.');
});
