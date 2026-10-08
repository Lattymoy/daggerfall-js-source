// PROF12 (2026-10-02) - THE ALCHEMY AND ENCHANTING LAYERS' LAW, PINNED (src/net/alchemyLaw.js; professionLaw.js's goods and
// transmutations; recipeLaw.js cookXp's steps; systems/potionRecipes.js, DFU's twenty's one home): every number the record
// and its DECIDEDs set, deepEqual against the module (A PIN MUST FAIL). bible/06-Systems/Professions-Arc.md 3.3, 4.1, 4.5,
// 9.3, 37; Seats-Arc 7.5.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import * as leaf from '../src/systems/potionRecipes.js';
import * as potions from '../src/systems/potions.js';
import * as effects from '../src/systems/effects.js';
import {
  POTIONS, POTION_PRICE_TIERS, potionTier, potionById, ingredientKeys, keyTemplate, brewSpends, brewKeys, brewFirstPays, brewCount, potentChance,
  potentPct, potentOk, potentEffect, POTENT, brewXp, templatePoints, piecePoints, essenceOf, ESSENCE_POINTS, disenchantXp, DISENCHANT_XP,
  enchantDiscountPct, enchantGold, ENCHANT_DISCOUNT,
  potentLasts, magnitudeDefault,   // AUDIT PROF12 A3
  potentAble,   // AUDIT PROF-541 B3
} from '../src/net/alchemyLaw.js';
import {
  REAGENTS, APOTHECARY_STOCK, COUNTER_ONLY, ARCANE_ESSENCE, ALCHEMY_FEE, ENCHANT_FEE, TRANSMUTE_RECIPES, TRANSMUTE_LADDER, TRANSMUTER, workSpecOk,
  smeltRecipe, stockOf, materialOf, MATERIAL_FAMILIES, gemTierOfPrice, PLANT_GROUP_TEMPLATES, SPECIALISATIONS, specOk,
  NO_PACK_FORM, withdrawable, topTierOf, TRANSMUTE_IN,   // AUDIT PROF12 E1, E2, E3
} from '../src/net/professionLaw.js';
import { recipeById, cookXp, FIRST_CRAFT_XP, firstCraftPays } from '../src/net/recipeLaw.js';
import { GROUP_TEMPLATE_INDICES } from '../src/systems/itemTemplatesData.js';

const TEMPLATES = JSON.parse(readFileSync(new URL('../src/characters/itemTemplates.json', import.meta.url), 'utf8'));
const tpl = (i) => TEMPLATES.find((t) => t.index === i);
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('PROF12 law: DFU\'s twenty have ONE home - the leaf (systems/potionRecipes.js) that the service bundles, re-exported by potions.js (the same objects) and imported, never copied, by the Alchemy layer; Heal-SpellPoints\' key beside the one recipe that names it, re-exported by the effect engine', () => {
  assert.equal(potions.POTION_RECIPES, leaf.POTION_RECIPES);
  assert.equal(potions.potionRecipeKey, leaf.potionRecipeKey);
  assert.equal(potions.POTION_DEFAULT_TEXTURE_RECORD, leaf.POTION_DEFAULT_TEXTURE_RECORD);
  assert.equal(effects.HEAL_SPELL_POINTS_KEY, leaf.HEAL_SPELL_POINTS_KEY);
  assert.equal(leaf.HEAL_SPELL_POINTS_KEY, 'Heal-SpellPoints');
  assert.equal(leaf.POTION_RECIPES.find((r) => r.name === 'restorePower').effect, 'Heal-SpellPoints');
  assert.doesNotMatch(src('src/systems/potionRecipes.js'), /^import /m, 'the leaf imports nothing');
  assert.match(src('src/net/alchemyLaw.js'), /import \{ POTION_RECIPES, potionRecipeKey, potionKeyFromCauldron \} from '\.\.\/systems\/potionRecipes\.js';/);
  assert.doesNotMatch(src('src/net/alchemyLaw.js'), /ingredients: \[\d/, 'no recipe typed again');
  assert.deepEqual(POTIONS.map((p) => p.id), leaf.POTION_RECIPES.map((r) => r.name));
  for (const p of POTIONS) assert.equal(p.key, leaf.potionRecipeKey(leaf.POTION_RECIPES.find((r) => r.name === p.id).ingredients), p.id);
});

test('PROF12 law: THE ALCHEMIST\'S LADDER (DECIDED) - a potion\'s tier its DFU price\'s: 50 or less 1, 75 2, 100 3, 125 4, 200 5, 250 6, Purification\'s 500 7 - every tier holding one; its rank the tier\'s', () => {
  assert.deepEqual(POTION_PRICE_TIERS, [50, 75, 100, 125, 200, 250]);
  assert.deepEqual([25, 50, 51, 75, 76, 100, 125, 126, 200, 250, 251, 500].map(potionTier), [1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 7, 7]);
  assert.deepEqual(POTIONS.map((p) => [p.id, p.tier, p.rank]), [
    ['resistFire', 2, 10], ['resistFrost', 2, 10], ['resistShock', 2, 10], ['resistPoison', 4, 40], ['slowFalling', 3, 25], ['waterBreathing', 3, 25],
    ['chameleonForm', 5, 55], ['invisibility', 6, 70], ['shadowForm', 5, 55], ['cureDisease', 3, 25], ['purification', 7, 90], ['curePoison', 5, 55],
    ['orcStrength', 1, 0], ['freeAction', 4, 40], ['stamina', 1, 0], ['healing', 1, 0], ['healTrue', 3, 25], ['restorePower', 2, 10],
    ['levitation', 4, 40], ['waterWalking', 1, 0],
  ]);
  assert.equal(potionById('healing').name, 'Healing');
  assert.equal(potionById('nope'), null);
  assert.equal(potionById(7), null);
});

test('PROF12 law: THE APOTHECARIES\' SIXTEEN (4.5) - exactly the ingredients DFU\'s twenty need and no gathering yields, each DFU\'s own in its own group, at 4.5\'s price (a fifth of DFU\'s, rounded up - pinned to itemTemplates.json), its tier its price\'s, the Essences\' family; the counter sells them bought, and only them; never gathered (COUNTER_ONLY)', () => {
  const needed = [...new Set(leaf.POTION_RECIPES.flatMap((r) => r.ingredients))].sort((a, b) => a - b);
  const gathered = (t) => PLANT_GROUP_TEMPLATES.p1.includes(t) || PLANT_GROUP_TEMPLATES.p2.includes(t) || ingredientKeys(t).some((k) => !k.startsWith('reagent:'));
  assert.deepEqual(needed.filter((t) => !gathered(t)), REAGENTS.map((r) => r.templateIndex).sort((a, b) => a - b), 'the sixteen');
  assert.equal(REAGENTS.length, 16);
  assert.deepEqual(REAGENTS.map((r) => [r.templateIndex, r.value]), [[33, 5], [35, 18], [37, 40], [39, 12], [42, 4], [43, 2], [49, 8], [54, 40], [58, 1], [59, 5], [60, 2], [61, 4], [62, 6], [63, 3], [64, 4], [76, 3]], '4.5\'s prices, its order');
  for (const r of REAGENTS) {
    const t = tpl(r.templateIndex);
    assert.equal(r.value, Math.ceil(t.basePrice / 5), `${t.name}: a fifth of DFU's ${t.basePrice}`);
    assert.equal(r.tier, gemTierOfPrice(t.basePrice), t.name);
    assert.ok(GROUP_TEMPLATE_INDICES[r.group].includes(r.templateIndex), `${t.name} in ${r.group}`);
    assert.equal(r.key, `reagent:${t.name.toLowerCase().replace(/'s\b/g, '').replace(/[^a-z]+/g, '-')}`, 'its key DFU\'s name');
    assert.equal(r.family, 'essences');
    assert.deepEqual(stockOf(r.key), { key: r.key, marks: r.value, counter: 'apothecaries' });
    assert.ok(COUNTER_ONLY.includes(r.key));
    assert.deepEqual(materialOf(r.key, () => null), { key: r.key, family: 'essences', tier: r.tier, value: r.value, group: r.group, templateIndex: r.templateIndex });
  }
  assert.deepEqual(APOTHECARY_STOCK.map((x) => x.key), REAGENTS.map((r) => r.key));
  assert.deepEqual(COUNTER_ONLY.slice(0, 2), ['cloth:linen', 'cloth:wool']);
  assert.deepEqual(MATERIAL_FAMILIES.map(([id]) => id), ['metals', 'wood', 'herbs', 'hides', 'food', 'stone', 'gems', 'essences', 'spoils', 'siege'], 'no new filter');
  assert.deepEqual([ALCHEMY_FEE, ENCHANT_FEE], [50, 50]);
  assert.deepEqual([ARCANE_ESSENCE.key, ARCANE_ESSENCE.family, ARCANE_ESSENCE.tier, ARCANE_ESSENCE.templateIndex, ARCANE_ESSENCE.name, [...ARCANE_ESSENCE.icon]],
    ['essence:arcane', 'essences', 3, 680, 'Arcane Essence', [254, 39]]);
  assert.equal(materialOf('essence:arcane', () => null).value, 4);
  assert.equal(stockOf('essence:arcane'), null, 'Essence is never sold by a counter');
});

test('PROF12 law: THE CAULDRON - every ingredient of the twenty held in the Stores (an herb its northern and southern, the rest its one row); DFU\'s own hash decides (any order), a wrong ingredient, size or key none; the station fills from the group held more of; no 500 for a cauldron wholly of the counter\'s goods (Water Breathing, Levitation)', () => {
  for (const p of POTIONS) for (const t of p.ingredients) assert.ok(ingredientKeys(t).length, `${p.id}: ${t}`);
  assert.deepEqual(ingredientKeys(16), ['p1:16', 'p2:16']);
  assert.deepEqual(ingredientKeys(14), ['p1:14']);
  assert.deepEqual(ingredientKeys(32), ['p2:32']);
  assert.deepEqual([ingredientKeys(65), ingredientKeys(3), ingredientKeys(77), ingredientKeys(56), ingredientKeys(42), ingredientKeys(999)],
    [['metal:mercury'], ['gem:diamond'], ['gem:pearl'], ['part:tooth'], ['reagent:troll-blood'], []]);
  assert.deepEqual([keyTemplate('p2:16'), keyTemplate('p1:32'), keyTemplate('metal:mercury'), keyTemplate('reagent:ivory'), keyTemplate('gem:siege'), keyTemplate(null)], [16, null, 65, 76, null, null]);
  const h = potionById('healing');
  const keys = ['p1:16', 'reagent:troll-blood', 'reagent:elixir-vitae', 'metal:mercury'];
  assert.deepEqual(brewSpends(h, keys), keys.map((key) => ({ key, n: 1 })));
  assert.deepEqual(brewSpends(h, [...keys].reverse())?.length, 4, 'any order');
  assert.deepEqual(brewSpends(h, ['p2:16', ...keys.slice(1)])?.[0], { key: 'p2:16', n: 1 }, 'the southern Red Berries too');
  assert.equal(brewSpends(h, ['p1:9', ...keys.slice(1)]), null);
  assert.equal(brewSpends(h, keys.slice(1)), null);
  assert.equal(brewSpends(h, [...keys, 'metal:mercury']), null);
  assert.equal(brewSpends(h, 'p1:16'), null);
  assert.equal(brewSpends(null, keys), null);
  assert.deepEqual(brewSpends(potionById('purification'), ['gem:diamond', 'p2:31', 'reagent:ectoplasm', 'reagent:mummy-wrappings', 'part:tooth', 'reagent:rain-water', 'reagent:elixir-vitae', 'reagent:nectar']).length, 8, 'the eight-ingredient purification');
  assert.deepEqual(brewKeys(h, (k) => ({ 'p2:16': 3, 'p1:16': 1 })[k] ?? 0), ['p2:16', 'reagent:troll-blood', 'reagent:elixir-vitae', 'metal:mercury']);
  assert.deepEqual(brewKeys(h, () => 0)[0], 'p1:16', 'the northern on a tie');
  assert.deepEqual(POTIONS.filter((p) => !brewFirstPays(p)).map((p) => p.id), ['waterBreathing', 'levitation']);
  assert.equal(brewFirstPays(null), false);
});

test('PROF12 law: THE BREW - its potions (one below Journeyman, two at it, a Brewer\'s three, three at Master); Potent\'s chance (none below Expert, 10 at it, 20 at Master; +5 an unbruised herb, +10 a Distiller, +10 an Apothecary\'s step; at most 100) and its share (+25, a Master Alchemist\'s +40); the magnitudes raised by it, rounded; XP 20 x the tier, quartered, +500 the first', () => {
  assert.deepEqual([0, 49, 50, 99, 100].map((r) => brewCount(r)), [1, 1, 2, 2, 3]);
  assert.deepEqual([brewCount(50, 'brewer'), brewCount(49, 'brewer'), brewCount(100, 'brewer'), brewCount(50, 'distiller')], [3, 1, 3, 2]);
  // AUDIT PROF-541 R2-S1: a potion wholly of the Apothecaries' goods brews one whatever the rank or the Brewer; another its rank's
  for (const id of ['waterBreathing', 'levitation']) assert.deepEqual([brewCount(100, 'brewer', potionById(id)), brewCount(50, 'brewer', potionById(id)), brewCount(0, null, potionById(id))], [1, 1, 1], id);
  assert.deepEqual([brewCount(100, null, potionById('healing')), brewCount(50, 'brewer', potionById('healing')), brewCount(50, null, null)], [3, 3, 2]);
  assert.deepEqual(POTENT, { expert: 10, master: 20, expertRank: 75, unbruised: 5, distiller: 10, apothecary: 10, pct: 25, masterPct: 40 });
  assert.deepEqual([0, 74, 75, 99, 100].map((r) => potentChance(r)), [0, 0, 10, 10, 20]);
  assert.equal(potentChance(0, { unbruised: 3 }), 15);
  assert.equal(potentChance(50, { distiller: true }), 10);
  assert.equal(potentChance(0, { steps: 2 }), 20);
  assert.equal(potentChance(100, { distiller: true, unbruised: 8, steps: 2 }), 90);
  assert.equal(potentChance(100, { distiller: true, unbruised: 20, steps: 2 }), 100);
  assert.equal(potentChance(75, { unbruised: -2, steps: 1.5 }), 10, 'a count that is none is none');
  assert.deepEqual([potentPct(), potentPct('master-alchemist'), potentPct('transmuter')], [25, 40, 25]);
  assert.deepEqual([25, 40, 0, 30, null].map(potentOk), [true, true, false, false, false]);
  const e = { type: 10, subType: 8, magnitudeBaseLow: 5, magnitudeBaseHigh: 5, magnitudeLevelBase: 9, magnitudeLevelHigh: 9, durationBase: 1, chanceBase: 1 };
  assert.deepEqual(potentEffect(e, 25), { ...e, magnitudeBaseLow: 6, magnitudeBaseHigh: 6, magnitudeLevelBase: 11, magnitudeLevelHigh: 11 });
  assert.deepEqual(potentEffect(e, 40), { ...e, magnitudeBaseLow: 7, magnitudeBaseHigh: 7, magnitudeLevelBase: 13, magnitudeLevelHigh: 13 });
  assert.equal(potentEffect(e, 30), e, 'a share no brew makes moves nothing');
  const h = potionById('healing'), inv = potionById('invisibility');
  assert.deepEqual([brewXp(h, 0), brewXp(h, 0, true), brewXp(inv, 70), brewXp(h, 55)], [20, 20 + FIRST_CRAFT_XP, 120, 5], 'a tier-1 brew past rank 55 quartered');
});

test('PROF12 law: THE TRANSMUTER (3.3; 4.1: "Mercury (Alchemy\'s Transmuter)"; AUDIT PROF12 E3, Mac: "2 + Mercury -> 1") - two of a metal and a Mercury make one of the next up the ladder (Tin, Copper, Silver, Gold, Platinum) at the alchemy station, no XP, its door the choice at 100; the Transmuter\'s card chosen', () => {
  assert.deepEqual(TRANSMUTE_LADDER, ['metal:tin', 'metal:copper', 'metal:silver', 'metal:gold', 'metal:platinum']);
  assert.deepEqual(TRANSMUTE_RECIPES.map((r) => [r.id, r.out, r.inputs.map((i) => [i.key, i.n]), r.station, r.xp, r.per]), [
    ['transmute:tin', 'metal:copper', [['metal:tin', 2], ['metal:mercury', 1]], 'alchemy', null, 1],
    ['transmute:copper', 'metal:silver', [['metal:copper', 2], ['metal:mercury', 1]], 'alchemy', null, 1],
    ['transmute:silver', 'metal:gold', [['metal:silver', 2], ['metal:mercury', 1]], 'alchemy', null, 1],
    ['transmute:gold', 'metal:platinum', [['metal:gold', 2], ['metal:mercury', 1]], 'alchemy', null, 1],
  ]);
  assert.deepEqual(TRANSMUTER, { profession: 'alchemy', rank: 100, id: 'transmuter' });
  const r = smeltRecipe('transmute:gold');
  assert.deepEqual([workSpecOk(r, { 50: null, 100: 'transmuter' }), workSpecOk(r, { 50: 'transmuter', 100: null }), workSpecOk(r, { 100: 'master-alchemist' }), workSpecOk(r, null)], [true, false, false, false]);
  assert.equal(workSpecOk(smeltRecipe('ingot:iron'), null), true, 'every other work asks none');
  for (const id of ['brewer', 'distiller']) assert.ok(specOk('alchemy', 50, id), id);
  for (const id of ['master-alchemist', 'transmuter']) assert.ok(specOk('alchemy', 100, id), id);
  for (const id of ['efficient', 'disenchanter']) assert.ok(specOk('enchanting', 50, id), id);
  assert.deepEqual(SPECIALISATIONS.enchanting[100].map((s) => s.id), ['soulbinder', 'runecaster']);
});

test('PROF12 law: DISENCHANTING (9.3) - the points a piece carried its DFU template\'s budget (itemTemplates.json), a jewel\'s its own (Gold and a gem: 2,160), a dish\'s, a carving\'s and a tool\'s none; an Essence a hundred, a Disenchanter\'s two; XP 5 x the PIECE\'s tier an Essence before the doubling (AUDIT PROF12 E2)', () => {
  assert.deepEqual([templatePoints(120), templatePoints(135), templatePoints(685), templatePoints(1600)], [tpl(120).enchantmentPoints, 1800, 0, 0]);
  assert.deepEqual([piecePoints(recipeById('longsword:mithril')), piecePoints(recipeById('ring:gold:ruby')), piecePoints(recipeById('ring:silver'), 1), piecePoints(recipeById('stew:north')), piecePoints(recipeById('column:stone')), piecePoints(recipeById('woodaxe:iron')), piecePoints(null)],
    [600, 2160, 1980, 0, 0, 0, 0]);
  assert.equal(ESSENCE_POINTS, 100);
  assert.deepEqual([essenceOf(2160), essenceOf(2160, true), essenceOf(99), essenceOf(600), essenceOf(-5), essenceOf('x')], [21, 42, 0, 6, 0, 0]);
  assert.equal(DISENCHANT_XP, 5);
  const ring = recipeById('ring:gold:ruby');
  assert.deepEqual([disenchantXp(ring, 0, 21), disenchantXp(ring, 69, 21), disenchantXp(ring, 70, 21), disenchantXp(ring, 0, 0), disenchantXp(ring, 0, 1.5), disenchantXp(null, 0, 21)], [315, 315, 78, 0, 0, 0]);
});

test('PROF12 law: ENCHANTING\'S LAYER (9.3: "cost -10% at Journeyman, -20% at Master (Efficient -5% more)") - the share off the item maker\'s gold by the rank, an Efficient\'s at 50 more; the gold rounded up, none asked none off', () => {
  assert.deepEqual(ENCHANT_DISCOUNT, { journeyman: 10, master: 20, efficient: 5 });
  assert.deepEqual([0, 49, 50, 99, 100].map((r) => enchantDiscountPct(r)), [0, 0, 10, 10, 20]);
  assert.deepEqual([enchantDiscountPct(50, 'efficient'), enchantDiscountPct(100, 'efficient'), enchantDiscountPct(49, 'efficient'), enchantDiscountPct(50, 'disenchanter'), enchantDiscountPct(null)], [15, 25, 0, 10, 0]);
  assert.deepEqual([enchantGold(500, 10), enchantGold(501, 10), enchantGold(500, 25), enchantGold(500, 0), enchantGold(500)], [450, 451, 375, 500, 500]);
});

test('PROF12 law: THE APOTHECARY\'S STEP for a dish (DECIDED: a dish takes no quality, so a step is the clean pan\'s half again) - 20 at rank 0, 30 a step, a clean pan and two steps 50; Cooking\'s plain law unchanged', () => {
  assert.deepEqual([cookXp(0), cookXp(0, { clean: true }), cookXp(0, { steps: 1 }), cookXp(0, { steps: 2 }), cookXp(0, { clean: true, steps: 2 }), cookXp(100, { clean: true, steps: 1 })], [20, 30, 30, 40, 50, 280]);
  assert.deepEqual([0, 10, 25, 40, 55, 70, 90, 100].map((r) => cookXp(r)), [20, 40, 60, 80, 100, 120, 140, 140]);
  assert.deepEqual([0, 55, 100].map((r) => cookXp(r, { clean: true })), [30, 150, 210]);
  assert.equal(cookXp(0, { steps: -3 }), 20);
});

// ─── AUDIT PROF12 (2026-10-03): E1, E2, A3, E3 ───────────────────────

test('AUDIT PROF12 E1 law: Arcane Essence has no pack form (NO_PACK_FORM) - it sold to any shop at 32 gold a unit; the Apothecaries\' sixteen beside it in the Essences\' family still withdraw', () => {
  assert.deepEqual([...NO_PACK_FORM], ['work:ram', ARCANE_ESSENCE.key]);
  assert.equal(withdrawable('essence:arcane'), false);
  for (const r of REAGENTS) assert.equal(withdrawable(r.key), true, r.key);
});

test('AUDIT PROF12 E2 law: a disenchant\'s XP is 5 x THE PIECE\'s recipe tier an Essence (craftXp\'s rule, never the rank\'s tier), quartered more than two tiers below the rank\'s top, and none for a piece made wholly of the counter\'s goods (firstCraftPays)', () => {
  const silver = recipeById('ring:silver'), gold = recipeById('ring:gold:ruby'), mithril = recipeById('longsword:mithril'), robes = recipeById('garment-163:linen');
  assert.deepEqual([silver.tier, gold.tier, mithril.tier, robes.tier], [1, 3, 5, 1]);
  assert.deepEqual([0, 39, 40, 100].map((r) => disenchantXp(silver, r, 18)), [90, 90, 22, 22], 'a Silver Ring\'s 18: full to rank 39, a quarter from 40 (tier 4 works)');
  assert.deepEqual([0, 89, 90, 100].map((r) => disenchantXp(mithril, r, 6)), [150, 150, 150, 150], 'a Mithril piece is never more than two below');
  assert.deepEqual([0, 50, 100].map((r) => disenchantXp(robes, r, 7)), [0, 0, 0], 'the counter\'s Linen: Essence, never XP');
  assert.equal(firstCraftPays(robes), false);
  for (const r of [silver, gold, mithril]) assert.equal(disenchantXp(r, 0, 10), 5 * r.tier * 10, r.id);
  for (const rank of [0, 40, 70, 100]) for (const r of [silver, gold, mithril]) {
    assert.equal(disenchantXp(r, rank, 4), r.tier < topTierOf(rank) - 2 ? Math.floor((5 * r.tier * 4) / 4) : 5 * r.tier * 4, `${r.id} at ${rank}`);
  }
});

test('AUDIT PROF12 A3 law (Mac: "Potent lasts longer"): the fourteen potions whose magnitude is DFU\'s default have their DURATION raised by the share - and their chance where it is their own - the six with a magnitude keep theirs; a Resist Fire lasts 25% (a Master Alchemist\'s 40%) longer', () => {
  const lasts = POTIONS.filter(potentLasts).map((p) => p.id);
  assert.deepEqual(lasts, ['resistFire', 'resistFrost', 'resistShock', 'resistPoison', 'slowFalling', 'waterBreathing', 'chameleonForm', 'invisibility', 'shadowForm', 'cureDisease', 'curePoison', 'freeAction', 'levitation', 'waterWalking']);
  assert.deepEqual(POTIONS.filter((p) => !potentLasts(p)).map((p) => p.id), ['purification', 'orcStrength', 'stamina', 'healing', 'healTrue', 'restorePower']);
  assert.equal(potentLasts(null), false);
  assert.deepEqual([magnitudeDefault({}), magnitudeDefault({ magnitudeBaseLow: 5 }), magnitudeDefault({ magnitudeBaseLow: 1, magnitudeLevelHigh: 1 })], [true, false, true]);
  const effectOf = (id) => potions.potionBundle(potionById(id).key).effects[0];
  // RESIST FIRE at level 10: 11 rounds - 14 Potent (+25%), 15 a Master Alchemist's (+40%); its 110% chance raised the same
  const fire = effectOf('resistFire');
  const [p25, p40] = [potentEffect(fire, 25, 10), potentEffect(fire, 40, 10)];
  assert.deepEqual([effects.rollDuration(fire, 10), effects.rollDuration(p25, 10), effects.rollDuration(p40, 10)], [11, 14, 15]);
  assert.deepEqual([effects.chanceValue(fire, 10), effects.chanceValue(p25, 10), effects.chanceValue(p40, 10)], [110, 138, 154]);
  assert.deepEqual([p25.magnitudeBaseLow, p25.magnitudeLevelHigh, p25.durationMod, p25.durationPerLevel], [1, 1, 1, 1], 'nothing else moves');
  assert.deepEqual([effects.rollDuration(potentEffect(fire, 25, 1), 1), effects.rollDuration(potentEffect(fire, 25, 0), 0)], [3, 3], 'a level-1 drinker\'s 2 rounds 3 (the half rounds up); DFU\'s clamp of the multiplier at 1 kept');
  // INVISIBILITY has no chance of its own: its duration alone
  const inv = effectOf('invisibility');
  const pi = potentEffect(inv, 25, 10);
  assert.deepEqual([effects.rollDuration(pi, 10), effects.chanceValue(pi, 10), pi.chanceBase], [14, effects.chanceValue(inv, 10), inv.chanceBase]);
  // CURE DISEASE (an instant effect): its own chance raised
  const cure = effectOf('cureDisease');
  assert.deepEqual([effects.chanceValue(cure, 5), effects.chanceValue(potentEffect(cure, 25, 5), 5)], [51, 64]);
  // HEALING keeps its magnitude law, its duration untouched
  const heal = effectOf('healing');
  const ph = potentEffect(heal, 25, 10);
  assert.deepEqual([ph.magnitudeBaseLow, ph.magnitudeLevelBase, ph.durationBase, ph.chanceBase], [6, 11, heal.durationBase, heal.chanceBase]);
  assert.equal(potentEffect(fire, 30, 10), fire, 'a share no brew makes moves nothing');
});

test('AUDIT PROF12 E3 law (Mac: "2 + Mercury -> 1"): the Transmuter\'s recipe is two of a metal and a Mercury for one of the next, and its card says so', () => {
  assert.equal(TRANSMUTE_IN, 2);
  for (const r of TRANSMUTE_RECIPES) assert.deepEqual(r.inputs.map((i) => i.n), [2, 1], r.id);
  assert.equal(SPECIALISATIONS.provisioning[100].find((sp) => sp.id === 'transmuter')?.text, 'Two of a DFU metal and a Mercury make one of the next up.');   // PIN MOVED (CRAFT3): SPECIALISATIONS is keyed by track - the Transmuter's card stands under Provisioning, Alchemy's craft
});

test('AUDIT PROF-541 B1 law: a cauldron is its recipe\'s own ingredients - DFU\'s int32 hash collides (a Purification with Jade for its Diamond: 4 9 17 27 33 60 62 63; a Healing of 17 19 62 65), and a collision answers no potion; the recipe\'s own, in any order, still does', () => {
  const k = (t) => ingredientKeys(t)[0];
  for (const [id, set] of [['purification', [4, 9, 17, 27, 33, 60, 62, 63]], ['healing', [17, 19, 62, 65]], ['healing', [17, 20, 39, 65]]]) {
    const p = potionById(id);
    assert.equal(leaf.potionKeyFromCauldron(set), p.key, `${id}: DFU's hash takes ${set}`);
    assert.equal(brewSpends(p, set.map(k)), null, `${id}: ${set} is no recipe of it`);
    assert.notEqual(brewSpends(p, [...p.ingredients].reverse().map(k)), null, `${id}: its own, reversed`);
  }
});

test('AUDIT PROF-541 B3 law: a potion is Potent-able unless it is a Cure (DFU\'s family 3) of the default magnitude with no second effect - Cure Disease and Cure Poison, instants whose chance a drink bypasses; Purification (its magnitude, its Heal and Invisibility) stays', () => {
  assert.deepEqual(POTIONS.filter((p) => !potentAble(p)).map((p) => p.id), ['cureDisease', 'curePoison']);
  assert.equal(potentAble(null), false);
  assert.equal(potentAble(potionById('purification')), true);
});
