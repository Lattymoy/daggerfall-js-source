import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  TEMPLATES, FIRST_DRUG_TEMPLATE, DRUG_POISON_OFFSET, VARIANT_CHANGEABLE,
  isLightSource, isPotion, isPotionRecipe, isParchment, isClothing, isMap, isDrug, isSpellbook,
  nextVariant, useItem, USE_TEXT, NO_SPELLS_TEXT_ID, MAP_TEXT_ID, expandItemMacro,
} from '../src/systems/useItem.js';
import { POISONS, POISON_START_VALUE, startPoison } from '../src/systems/poisons.js';
import { templateByIndex } from '../src/systems/itemTemplates.js';

const player = (over = {}) => ({ isPlayer: true, level: 5, career: {}, activeEffects: [], spells: [], ...over });

// ── the predicates (DaggerfallUnityItem.cs :316-371) ──────────────

test('U25: IsLightSource spans TWO groups - the Holy candle is not in UselessItems2', () => {
  assert.equal(isLightSource({ group: 'UselessItems2', templateIndex: TEMPLATES.Torch }), true);
  assert.equal(isLightSource({ group: 'UselessItems2', templateIndex: TEMPLATES.Lantern }), true);
  assert.equal(isLightSource({ group: 'UselessItems2', templateIndex: TEMPLATES.Candle }), true);
  assert.equal(isLightSource({ group: 'ReligiousItems', templateIndex: TEMPLATES.Holy_candle }), true);
  // the two items that sit BESIDE them in UselessItems2 are not lights
  assert.equal(isLightSource({ group: 'UselessItems2', templateIndex: TEMPLATES.Oil }), false);
  assert.equal(isLightSource({ group: 'UselessItems2', templateIndex: TEMPLATES.Bandage }), false);
  // ...and the group matters, not just the index
  assert.equal(isLightSource({ group: 'MiscItems', templateIndex: TEMPLATES.Torch }), false);
});

test('U25: the rest of the predicates, each on its own group + template', () => {
  assert.equal(isPotion({ group: 'UselessItems1', templateIndex: TEMPLATES.Glass_Bottle }), true);
  assert.equal(isPotion({ group: 'UselessItems1', templateIndex: 82 }), false, 'a glass JAR is not a potion');
  assert.equal(isPotionRecipe({ group: 'MiscItems', templateIndex: TEMPLATES.Potion_recipe }), true);
  assert.equal(isParchment({ group: 'UselessItems2', templateIndex: TEMPLATES.Parchment }), true);
  assert.equal(isClothing({ group: 'MensClothing' }), true);
  assert.equal(isClothing({ group: 'WomensClothing' }), true);
  assert.equal(isClothing({ group: 'Armor' }), false);
  assert.equal(isSpellbook({ templateIndex: TEMPLATES.Spellbook }), true);
  assert.equal(isDrug({ group: 'Drugs' }), true);
  // the map arm tests BOTH groups for the same template index
  assert.equal(isMap({ group: 'MiscItems', templateIndex: TEMPLATES.Map }), true);
  assert.equal(isMap({ group: 'Maps', templateIndex: TEMPLATES.Map }), true);
  assert.equal(isMap({ group: 'Weapons', templateIndex: TEMPLATES.Map }), false);
});

// ── NextVariant (:718-762) ────────────────────────────────────────

test('U25: only twelve men\'s and twelve women\'s garments change variant', () => {
  assert.equal(VARIANT_CHANGEABLE.size, 24);
  // the four DFU names by hand in each list, spot-checked at both ends
  for (const t of [154, 155, 161, 163, 172, 191, 192, 198, 200, 209]) {
    assert.equal(VARIANT_CHANGEABLE.has(t), true, `template ${t}`);
  }
  // the unchangeable shirts sit right beside the changeable ones and
  // are DFU's own point - 178/179 and 214/215 are named "unchangeable"
  for (const t of [178, 179, 214, 215, 141, 147, 113]) {
    assert.equal(VARIANT_CHANGEABLE.has(t), false, `template ${t}`);
  }
});

test('U25: NextVariant cycles to zero at the TEMPLATE\'s variant count', () => {
  const total = templateByIndex(165)?.variants;
  assert.ok(total > 1, 'the Short shirt has variants in the shipping data');
  const shirt = { group: 'MensClothing', templateIndex: 165, variant: 0 };
  for (let i = 1; i < total; i++) {
    assert.equal(nextVariant(shirt), true);
    assert.equal(shirt.variant, i);
  }
  assert.equal(nextVariant(shirt), true);
  assert.equal(shirt.variant, 0, 'wraps at TotalVariants');
  // an item outside the set never moves
  const boots = { group: 'MensClothing', templateIndex: 149, variant: 0 };
  assert.equal(nextVariant(boots), false);
  assert.equal(boots.variant, 0);
});

// ── the ladder (:1661-1817) ───────────────────────────────────────

test('U25: a light source lights, douses, and refuses when empty', () => {
  const e = player();
  const torch = { group: 'UselessItems2', templateIndex: TEMPLATES.Torch, name: 'Torch', currentCondition: 10, maxCondition: 10 };
  assert.deepEqual(useItem(torch, [torch], { entity: e }), { kind: 'lit', text: 'You light the Torch.' });
  assert.equal(e.lightSource, torch);
  // using the SAME one douses it
  assert.deepEqual(useItem(torch, [torch], { entity: e }), { kind: 'doused', text: 'You douse the Torch.' });
  assert.equal(e.lightSource, null);
  // a SECOND light swaps rather than doubling
  const candle = { group: 'UselessItems2', templateIndex: TEMPLATES.Candle, name: 'Candle', currentCondition: 5 };
  useItem(torch, [torch], { entity: e });
  useItem(candle, [candle], { entity: e });
  assert.equal(e.lightSource, candle);
  // and a burnt-out one says so without becoming the light source
  const dead = { group: 'UselessItems2', templateIndex: TEMPLATES.Torch, name: 'Torch', currentCondition: 0 };
  assert.equal(useItem(dead, [dead], { entity: e }).kind, 'empty');
  assert.equal(e.lightSource, candle, 'unchanged');
});

test('U25: oil refuels a lantern ONLY when the whole bottle fits', () => {
  const lantern = { group: 'UselessItems2', templateIndex: TEMPLATES.Lantern, name: 'Lantern', currentCondition: 10, maxCondition: 100 };
  const oil = { group: 'UselessItems2', templateIndex: TEMPLATES.Oil, name: 'Oil', currentCondition: 50 };
  const bag = [lantern, oil];
  const r = useItem(oil, bag, {});
  assert.equal(r.kind, 'refuelled');
  assert.equal(r.text, 'You refuel your Lantern with a bottle of oil.');
  assert.equal(lantern.currentCondition, 60);
  assert.equal(bag.includes(oil), false, 'the bottle is gone');
  // a nearly full lantern refuses - DFU does not top it up partially
  const full = { group: 'UselessItems2', templateIndex: TEMPLATES.Lantern, name: 'Lantern', currentCondition: 80, maxCondition: 100 };
  const oil2 = { group: 'UselessItems2', templateIndex: TEMPLATES.Oil, name: 'Oil', currentCondition: 50 };
  const bag2 = [full, oil2];
  assert.equal(useItem(oil2, bag2, {}).kind, 'full');
  assert.equal(full.currentCondition, 80);
  assert.equal(bag2.includes(oil2), true, 'and the bottle is kept');
  // a STACK of oil splits one off
  const l3 = { group: 'UselessItems2', templateIndex: TEMPLATES.Lantern, currentCondition: 0, maxCondition: 100 };
  const stack = { group: 'UselessItems2', templateIndex: TEMPLATES.Oil, currentCondition: 50, stackCount: 3 };
  const bag3 = [l3, stack];
  assert.equal(useItem(stack, bag3, {}).kind, 'refuelled');
  assert.equal(stack.stackCount, 2);
  assert.equal(bag3.length, 2);
});

test('U25: THE DRUG BUG, preserved - the item is consumed and nothing is inflicted', () => {
  // DFU: `(Poisons)item.TemplateIndex + 66` with a comment saying the
  // drug poisons are 136-139 and the templates 78-81 - which needs 58,
  // not 66. 78 + 66 = 144, outside the enum, so
  // GetClassicPoisonEffectKey formats a key nothing is registered
  // under and AssignBundle instantiates nothing.
  assert.equal(FIRST_DRUG_TEMPLATE, 78);
  assert.equal(DRUG_POISON_OFFSET, 66);
  assert.equal(FIRST_DRUG_TEMPLATE + DRUG_POISON_OFFSET, 144);
  assert.equal(POISONS.Indulcet, 136, 'which is where the comment says it should land');
  const e = player();
  const drug = { group: 'Drugs', templateIndex: 78, name: 'Indulcet' };
  const bag = [drug];
  const r = useItem(drug, bag, { entity: e });
  assert.equal(r.kind, 'drugged');
  assert.equal(r.poisonType, 144);
  assert.equal(r.inflicted, false);
  assert.deepEqual(e.activeEffects, [], 'no effect - this is the bug, verbatim');
  assert.equal(bag.length, 0, 'and the drug is eaten anyway');
  // the guard that makes it "nothing" rather than "undefined": an
  // unregistered type starts no poison
  assert.equal(startPoison(player(), 144, 0, () => 0), null);
  assert.equal(startPoison(player(), POISON_START_VALUE + 11, 0, () => 0) !== null, true, 'the last real one still works');
});

test('U25: the spellbook opens, or says 12 when empty', () => {
  const book = { group: 'MiscItems', templateIndex: TEMPLATES.Spellbook };
  assert.deepEqual(useItem(book, [book], { spellCount: () => 0 }), { kind: 'noSpells', textId: NO_SPELLS_TEXT_ID });
  assert.equal(NO_SPELLS_TEXT_ID, 12);
  assert.deepEqual(useItem(book, [book], { spellCount: () => 3 }), { kind: 'spellbook' });
});

test('U25: a map and a potion leave the pack; the doll (no collection) keeps them', () => {
  const map = { group: 'MiscItems', templateIndex: TEMPLATES.Map };
  const bag = [map];
  const r = useItem(map, bag, {});
  assert.equal(r.kind, 'map');
  assert.equal(r.textId, MAP_TEXT_ID);
  assert.equal(bag.length, 0);
  // UseItem(item) from the paperdoll passes NO collection, and the map
  // arm is guarded on it
  const map2 = { group: 'MiscItems', templateIndex: TEMPLATES.Map };
  assert.notEqual(useItem(map2, null, {}).kind, 'map');
  const potion = { group: 'UselessItems1', templateIndex: TEMPLATES.Glass_Bottle };
  const bag2 = [potion];
  assert.equal(useItem(potion, bag2, {}).kind, 'potion');
  assert.equal(bag2.length, 0);
});

test('U25: the catch-all is NextVariant, and an enchanted item runs its payload on top', () => {
  const shirt = { group: 'MensClothing', templateIndex: 165, name: 'Short shirt', variant: 0 };
  assert.equal(useItem(shirt, [shirt], {}).kind, 'variant');
  const rock = { group: 'Gems', templateIndex: 0, name: 'Ruby' };
  assert.deepEqual(useItem(rock, [rock], {}), { kind: 'none' });
  // AUDIT 22 F9: the payload runs after the WHOLE CHAIN, not only
  // after the catch-all. DFU's arms are one if/else ladder with no
  // returns, so an enchanted item does its ordinary thing AND fires
  // its Used payload - and the ordinary thing must still be visible
  // in the result, which is what the old `kind: 'enchanted'`
  // overwrite destroyed.
  const ring = { group: 'Jewellery', templateIndex: 133, name: 'Ring' };
  const r = useItem(ring, [ring], { isEnchanted: () => true });
  assert.equal(r.enchanted, true);
  assert.equal(r.closesWindow, true);
  assert.equal(r.kind, 'none', 'a ring has no ladder arm of its own');
  // an enchanted TORCH still lights, and still fires the payload
  const e = player();
  const torch = { group: 'UselessItems2', templateIndex: TEMPLATES.Torch, name: 'Torch', currentCondition: 5 };
  const lit = useItem(torch, [torch], { entity: e, isEnchanted: () => true });
  assert.equal(lit.kind, 'lit', 'the arm still ran');
  assert.equal(lit.enchanted, true, 'and so did the payload');
  assert.equal(e.lightSource, torch);
  // an enchanted POTION is drunk AND fires it
  const bag = [{ group: 'UselessItems1', templateIndex: TEMPLATES.Glass_Bottle, name: 'Potion' }];
  const drunk = useItem(bag[0], bag, { isEnchanted: () => true });
  assert.equal(drunk.kind, 'potion');
  assert.equal(drunk.enchanted, true);
  assert.equal(bag.length, 0);
});

test('AUDIT 22 F5: RemoveOne takes THIS record, not the first of its template', () => {
  // Every potion is the same Glass_Bottle template and differs only by
  // recipe, so removing "the first item with this template index"
  // drinks the wrong bottle.
  const a = { group: 'UselessItems1', templateIndex: TEMPLATES.Glass_Bottle, name: 'Cure Disease' };
  const b = { group: 'UselessItems1', templateIndex: TEMPLATES.Glass_Bottle, name: 'Free Action' };
  const bag = [a, b];
  useItem(b, bag, {});
  assert.deepEqual(bag, [a], 'the SECOND bottle was drunk');
  // and a stack decrements rather than vanishing
  const stack = { group: 'UselessItems1', templateIndex: TEMPLATES.Glass_Bottle, stackCount: 3 };
  const bag2 = [stack];
  useItem(stack, bag2, {});
  assert.equal(stack.stackCount, 2);
  assert.equal(bag2.length, 1);
});

test('AUDIT 22 F4: the oil arm searches the LOCAL pack, whatever list the click came from', () => {
  // DFU reads localItems.GetItem(...) at :1791 - so oil clicked on a
  // loot pile still refuels the lantern in your own bag.
  const lantern = { group: 'UselessItems2', templateIndex: TEMPLATES.Lantern, name: 'Lantern', currentCondition: 0, maxCondition: 100 };
  const oil = { group: 'UselessItems2', templateIndex: TEMPLATES.Oil, name: 'Oil', currentCondition: 20 };
  const pile = [oil];          // the oil lives on the ground
  const localItems = [lantern];   // the lantern is in the pack
  const r = useItem(oil, pile, { localItems });
  assert.equal(r.kind, 'refuelled');
  assert.equal(lantern.currentCondition, 20);
  assert.equal(pile.length, 0, 'and the bottle leaves the list it lived in');
  // without the local pack there is no lantern to find
  const oil2 = { group: 'UselessItems2', templateIndex: TEMPLATES.Oil, currentCondition: 20 };
  assert.equal(useItem(oil2, [oil2], {}).kind, 'full');
});

test('U25: a potion RECIPE cannot be used', () => {
  const recipe = { group: 'MiscItems', templateIndex: TEMPLATES.Potion_recipe, name: 'Potion recipe' };
  assert.equal(useItem(recipe, [recipe], {}).text, USE_TEXT.cannotUseThis);
});

test('AUDIT 22 F1: a QUEST item still runs the whole ladder', () => {
  // DFU's quest block returns in ONE case: the quest system is
  // WATCHING the item and it is neither parchment nor clothing. Every
  // other quest item falls through to the ladder underneath - which
  // is why a quest letter reads and a quest torch lights. The port
  // returned for all of them.
  const e = player();
  const torch = { group: 'UselessItems2', templateIndex: TEMPLATES.Torch, name: 'Torch', currentCondition: 9, questItem: true };
  const r = useItem(torch, [torch], { entity: e });
  assert.equal(r.kind, 'lit', 'a quest torch lights');
  assert.equal(e.lightSource, torch);
  assert.equal(r.questItem, true, 'and the flag rides the result for the quest machine');
  // a quest garment still cycles its variant
  const cloak = { group: 'MensClothing', templateIndex: 154, variant: 0, questItem: true };
  assert.equal(useItem(cloak, [cloak], {}).kind, 'variant');
  assert.equal(cloak.variant, 1);
  // and an ordinary item carries no such flag
  assert.equal(useItem({ group: 'Gems', templateIndex: 0 }, [], {}).questItem, undefined);
});

test('U25: the %it macro takes the item\'s own name', () => {
  assert.equal(expandItemMacro('You light the %it.', { name: 'Lantern' }), 'You light the Lantern.');
  assert.equal(expandItemMacro('%it', { templateIndex: 247 }), templateByIndex(247).name);
});
