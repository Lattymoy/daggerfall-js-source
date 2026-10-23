// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF12 (2026-10-02, Mac: "2 and 4"; "lets just finish out everything
// before merge") - THE ALCHEMY AND ENCHANTING LAYERS, AND DISENCHANTING:
// the law both ends read. bible/06-Systems/Professions-Arc.md 1, 2, 3.3,
// 4.1, 4.3, 4.5, 9.3, 9.4 and 37 (as built).
//
// LAW 1: DFU'S MAKERS STAY 1:1. "Alchemy and Enchanting are layers over
// them" (section 2): DFU's potion maker (pack ingredients) and its item
// maker are untouched and earn nothing online - the service never sees
// them. Alchemy's door is the BREWING ACT at an alchemy station (9.3):
// the ingredients from the Stores, and the service runs DFU'S OWN RECIPE
// LAW on them - POTION_RECIPES and the order-independent ingredient hash
// DFU keys it by, IMPORTED (systems/potionRecipes.js), never copied - so
// the same twenty recipes, and no new ones, make the same potions into
// the pack. No act (9.4: "Alchemy, Enchanting: none - DFU's windows stay
// 1:1"). Enchanting's layer is a discount on DFU's item maker's gold (a
// discount on the player's own item, which cheats no one) and its XP is
// what the service sees: Disenchanting a provenance piece into Arcane
// Essence (680).
//
// Pure: no clock, no DOM, no network. The service bundles it (with the
// item table's JSON - DFU's enchantment budgets, one home - and the
// recipe leaf); the client draws and mints by it.
// ═══════════════════════════════════════════════════════════════════
import { POTION_RECIPES, potionRecipeKey, potionKeyFromCauldron } from '../systems/potionRecipes.js';   // DFU's twenty, one home (law 1)
import {
  TIER_RANKS, PLANT_GROUP_TEMPLATES, METALS, GEMS, PEARL, PARTS, REAGENTS, COUNTER_ONLY, topTierOf, JOURNEYMAN_RANK, PROF_RANK_MAX,
} from './professionLaw.js';
import { craftXp, jewelPoints, firstCraftPays } from './recipeLaw.js';   // AUDIT PROF12 E2: a disenchant's XP the piece's recipe's
import TEMPLATES_JSON from '../characters/itemTemplates.json' with { type: 'json' };   // DFU's ItemTemplates.txt verbatim - each template's enchantment budget

// ─── THE BREW (9.3) ──────────────────────────────────────────────────

/**
 * THE ALCHEMIST'S LADDER - DECIDED: 9.3 sets no rank on DFU's twenty, and every one must be brewable by someone, so a
 * potion's tier is its DFU price's (POTION_RECIPES `price` - the worth DFU itself puts on it): 50 gold or less tier 1 (the
 * Novice's - Stamina, Orc Strength, Healing, Water Walking), 75 tier 2, 100 tier 3, 125 tier 4, 200 tier 5, 250 tier 6
 * (Invisibility), and Purification's 500 tier 7 - the Master's crown. Every tier holds one at least, so XP needs no
 * "follows the rank" (3.2's own, PROF10's ladder).
 */
export const POTION_PRICE_TIERS = Object.freeze([50, 75, 100, 125, 200, 250]);
export const potionTier = (price) => { const i = POTION_PRICE_TIERS.findIndex((p) => price <= p); return i < 0 ? POTION_PRICE_TIERS.length + 1 : i + 1; };
/**
 * @typedef {{ id: string, name: string, tier: number, rank: number, key: number, price: number,
 *   ingredients: readonly number[] }} Potion
 */
/** DFU's twenty as the station lists them, in DFU's own order: `id` the recipe's name (DFU's localisation key), `name` its
 *  display name, `key` the broker's (potionRecipeKey over the pre-sorted ingredients - DFU's dictionary key). */
/** @type {readonly Potion[]} */
export const POTIONS = Object.freeze(/** @type {any[]} */ (POTION_RECIPES).map((r) => {
  const tier = potionTier(r.price);
  return Object.freeze({ id: r.name, name: r.displayName, tier, rank: TIER_RANKS[tier - 1], key: potionRecipeKey(r.ingredients), price: r.price, ingredients: r.ingredients });
}));
const BY_ID = new Map(POTIONS.map((p) => [p.id, p]));
/** A potion by its recipe's name ('healing'), or null. */
export const potionById = (id) => (typeof id === 'string' ? BY_ID.get(id) ?? null : null);

/** The Stores' rows that are DFU ingredients, by template: the metals, the gems, the sea's Pearl, a body's parts and the
 *  Apothecaries' sixteen (an herb is its group's - PLANT_GROUP_TEMPLATES). */
const DFU_ROWS = new Map([...METALS, ...GEMS, PEARL, ...PARTS, ...REAGENTS].map((m) => [m.templateIndex, m]));
/** THE STORES' KEYS A DFU INGREDIENT IS HELD UNDER: an herb its northern and its southern (`p1:16`, `p2:16`) where its
 *  plant grows in both of DFU's groups, every other ingredient its one row's. Empty for a template the Stores never hold. */
export function ingredientKeys(templateIndex) {
  const herbs = ['p1', 'p2'].filter((g) => PLANT_GROUP_TEMPLATES[g].includes(templateIndex)).map((g) => `${g}:${templateIndex}`);
  if (herbs.length) return herbs;
  const row = DFU_ROWS.get(templateIndex);
  return row ? [row.key] : [];
}
/** The DFU template a Stores key holds (an herb's, a metal's, a gem's, a part's, a reagent's), or null. */
export function keyTemplate(key) {
  if (typeof key !== 'string') return null;
  const m = /^(p1|p2):(0|[1-9]\d{0,2})$/.exec(key);
  if (m) return PLANT_GROUP_TEMPLATES[m[1]].includes(Number(m[2])) ? Number(m[2]) : null;
  for (const row of DFU_ROWS.values()) if (row.key === key) return row.templateIndex;
  return null;
}
/**
 * WHAT A BREW SPENDS - DFU'S OWN LAW: `keys` the cauldron's contents as the Stores hold them, one key an ingredient (an
 * herb's group the brewer's choice), answered as `[{ key, n }]` when the templates they hold hash, sorted, to the potion's
 * own key (potionKeyFromCauldron - DFU's MixCauldron, "there is no ingredient comparison anywhere"), else null: a key the
 * Stores never hold, a cauldron of another size, or one no recipe of this potion answers. AUDIT PROF-541 B1: AND the
 * sorted templates ARE the recipe's own ingredients - the int32 hash collides (Purification of Jade for its Diamond,
 * templates 4 9 17 27 33 60 62 63; a Healing of 17 19 62 65), and a cauldron DFU's own maker would brew only by the
 * collision bought the Master's crown with cheap goods. DFU's hash is still asked first (law 1: its key, imported).
 * @param {Potion|null} potion @param {unknown} keys
 */
export function brewSpends(potion, keys) {
  if (!potion || !Array.isArray(keys) || keys.length !== potion.ingredients.length) return null;
  const templates = keys.map(keyTemplate);
  if (templates.some((t) => t == null)) return null;
  if (potionKeyFromCauldron(/** @type {number[]} */ (templates)) !== potion.key) return null;
  const sorted = (/** @type {readonly number[]} */ a) => [...a].sort((x, y) => x - y).join(',');
  if (sorted(/** @type {number[]} */ (templates)) !== sorted(potion.ingredients)) return null;   // AUDIT PROF-541 B1: the recipe's own, never a collision
  const out = new Map();
  for (const k of /** @type {string[]} */ (keys)) out.set(k, (out.get(k) ?? 0) + 1);
  return [...out].map(([key, n]) => ({ key, n }));
}
/** The cauldron a station fills for a potion from what the Stores hold (`held(key)`): each ingredient's key, an herb's the
 *  group the Stores hold more of (the northern on a tie). */
export function brewKeys(potion, held = (/** @type {string} */ k) => 0) {
  if (!potion) return [];
  return potion.ingredients.map((t) => {
    const keys = ingredientKeys(t);
    return keys.reduce((best, k) => (held(k) > held(best) ? k : best), keys[0]);
  });
}
/** Whether a brew's first time pays FIRST_CRAFT_XP (AUDIT 32 S1's law, recipeLaw firstCraftPays): not for a potion made
 *  wholly of goods only a counter sells (the Apothecaries' sixteen - Levitation's Ectoplasm, Pure Water and Nectar). */
export const brewFirstPays = (potion) => !!potion && !potion.ingredients.every((t) => ingredientKeys(t).every((k) => COUNTER_ONLY.includes(k)));

/** The Brewer (3.3: "3 potions a brew at Journeyman"), the Distiller ("Potent chance +10%") - Alchemy's choices at 50; the
 *  Master Alchemist ("Potent is +40%, not +25%") and the Transmuter (professionLaw TRANSMUTER) its two at 100. */
export const BREWER = 'brewer', DISTILLER = 'distiller', MASTER_ALCHEMIST = 'master-alchemist';
/** THE POTIONS A BREW MAKES (9.3: "2 potions at Journeyman and 3 at Master (Brewer 3 at Journeyman)"): DECIDED one below
 *  Journeyman - DFU's own maker's one a mix. AUDIT PROF-541 R2-S1: `potion` the brew's - one made wholly of goods only a
 *  counter sells (!brewFirstPays: Water Breathing, Levitation) makes ONE whatever the rank or the Brewer, else the
 *  Apothecaries' silver (a fifth of DFU's price) brewed into three potions sold online at half the shop's would be gold
 *  past the Bank (11 silver to 165 gold).
 *  CRAFT-PAYS (2026-10-21, the Discord's #feature-feedback: "The profit margin is also extremely low or even a loss";
 *  Professions-Arc.md section 48): TWO BELOW JOURNEYMAN, not one. A Novice's brew was one potion for the station's fee and
 *  a cauldron of herbs - a loss against the drop it competed with, on the very rungs a brewer climbs by brewing. The rungs
 *  above stand (two at Journeyman, a Brewer's three, three at Master): `prof_brews.count` is CHECKed 1 to 3
 *  (migration 0070), so a fourth is a table's rebuild, not a number's change. The counter's goods still brew one. */
export function brewCount(rank, spec50 = null, potion = null) {
  if (potion && !brewFirstPays(potion)) return 1;
  if (rank >= PROF_RANK_MAX) return 3;
  if (rank >= JOURNEYMAN_RANK) return spec50 === BREWER ? 3 : 2;
  return 2;
}
/** POTENT (9.3: "Potent (+25% magnitude, named so) at 10% at Expert and 20% at Master, +5% an unbruised herb"): the
 *  chances, percent. `apothecary` the Seats' hall's (Seats-Arc 7.5: "+1 step" a tier - DECIDED, a step is Expert's
 *  rung, +10). */
export const POTENT = Object.freeze({ expert: 10, master: 20, expertRank: 75, unbruised: 5, distiller: 10, apothecary: 10, pct: 25, masterPct: 40 });
/**
 * A BREW'S POTENT CHANCE, percent of 100: the rank's (none below Expert, 10 at Expert, 20 at Master), +5 an unbruised herb
 * among its ingredients (DECIDED: at any rank - the herb's gift, not the brewer's), +10 a Distiller's, +10 a step of the
 * Apothecary of the town it is brewed in; at most 100. One roll a brew: its potions are Potent together or not at all
 * (one cauldron).
 */
export function potentChance(rank, { distiller = false, unbruised = 0, steps = 0 } = {}) {
  const base = rank >= PROF_RANK_MAX ? POTENT.master : rank >= POTENT.expertRank ? POTENT.expert : 0;
  const u = Number.isSafeInteger(unbruised) && unbruised > 0 ? unbruised : 0;
  const st = Number.isSafeInteger(steps) && steps > 0 ? steps : 0;
  return Math.min(100, base + POTENT.unbruised * u + (distiller ? POTENT.distiller : 0) + POTENT.apothecary * st);
}
/** A Potent potion's share of magnitude: +25%, a Master Alchemist's +40% (3.3). */
export const potentPct = (spec100 = null) => (spec100 === MASTER_ALCHEMIST ? POTENT.masterPct : POTENT.pct);
/** Whether a potent share is one a brew may carry - the item's field's bound (itemFields `potent`). */
export const potentOk = (pct) => pct === POTENT.pct || pct === POTENT.masterPct;
/** A Potent potion's magnitudes (DFU's EffectSettings' four magnitude fields - potions.js potionBundle's settings): each
 *  raised by the share, rounded; nothing else of the bundle moves. */
export const POTENT_FIELDS = Object.freeze(['magnitudeBaseLow', 'magnitudeBaseHigh', 'magnitudeLevelBase', 'magnitudeLevelHigh']);
/** AUDIT PROF12 A3: whether settings carry DFU's DEFAULT magnitude - every one of the four fields 1 (DefaultEffectSettings,
 *  potions.js; a recipe's `settings` name only what differs) - the fourteen potions whose effect has no magnitude to raise
 *  (the Resists, Slow Falling, Water Breathing, Chameleon Form, Invisibility, Shadow Form, the Cures, Free Action,
 *  Levitation, Water Walking). */
export const magnitudeDefault = (s) => POTENT_FIELDS.every((f) => (s?.[f] ?? 1) === 1);
/** AUDIT PROF12 A3: whether settings name a CHANCE of their own (any of the three away from DFU's default 1) - the Resists',
 *  the Cures' and Free Action's - an effect that has one. */
const CHANCE_FIELDS = Object.freeze(['chanceBase', 'chanceMod', 'chancePerLevel']);
const chanceOwn = (s) => CHANCE_FIELDS.some((f) => (s?.[f] ?? 1) !== 1);
/**
 * A POTENT POTION AS IT IS DRUNK (9.3: "+25% magnitude"): its four magnitude fields raised by the share, rounded. AUDIT
 * PROF12 A3 (Mac, 2026-10-03: "Potent lasts longer"): an effect whose magnitude is DFU's default (magnitudeDefault) has none
 * to raise - +25% of 1 rounds to 1, and the fourteen such potions' Potent did nothing - so its DURATION is raised by the
 * same share instead, and its CHANCE where it has one of its own (chanceOwn): each the rounds or the percent DFU would give
 * at `casterLevel` (effects.js rollDuration and chanceValue, verbatim), the share of it added to the base, rounded - the
 * settings stay whole numbers, as DFU's are. Nothing else of the bundle moves.
 */
export function potentEffect(effect, pct, casterLevel = 1) {
  if (!effect || !potentOk(pct)) return effect;
  const out = { ...effect };
  if (!magnitudeDefault(out)) {
    for (const f of POTENT_FIELDS) if (Number.isFinite(out[f])) out[f] = Math.round((out[f] * (100 + pct)) / 100);
    return out;
  }
  const level = Number.isFinite(casterLevel) ? Math.max(0, casterLevel) : 1;
  const raise = (base, plus, per, min1) => {
    if (!Number.isFinite(base) || !Number.isFinite(plus)) return base;
    let mult = Math.floor(level / Math.max(1, Number(per) || 1));
    if (min1 && mult < 1) mult = 1;   // rollDuration's clamp (DFU SetDuration); chanceValue has none
    return base + Math.round(((base + plus * mult) * pct) / 100);
  };
  out.durationBase = raise(out.durationBase, out.durationMod, out.durationPerLevel, true);
  if (chanceOwn(out)) out.chanceBase = raise(out.chanceBase, out.chanceMod, out.chancePerLevel, false);
  return out;
}
const RECIPE_BY_ID = new Map(/** @type {any[]} */ (POTION_RECIPES).map((r) => [r.name, r]));
/** AUDIT PROF12 A3: whether a potion's Potent lasts longer (its magnitude DFU's default) rather than raising its magnitude -
 *  the station's and the brew's words. */
export const potentLasts = (potion) => !!potion && magnitudeDefault(RECIPE_BY_ID.get(potion.id)?.settings ?? {});
/** AUDIT PROF-541 B3: WHETHER A POTION CAN BE POTENT AT ALL - not a Cure (DFU's effect family 3: Cure Disease, Cure
 *  Poison) of DFU's default magnitude with no second effect: an INSTANT (effects.js, "chance-only instants") with no
 *  duration to last longer, and its chance bypassed as it is drunk (DrinkPotion's BypassChance, hostMagic.js) - so Potent
 *  raised nothing and only its name and worth moved. Purification's magnitude and its Heal and Invisibility stay Potent.
 *  The brew's roll (alchemy.js), the station's line and the potions' mint read it. */
export function potentAble(potion) {
  const r = potion ? RECIPE_BY_ID.get(potion.id) : null;
  if (!r) return false;
  return !(/^3,/.test(String(r.effect)) && !(r.secondary?.length) && magnitudeDefault(r.settings ?? {}));
}
/** A brew's XP (3.2: "a craft 20 x tier x units, +500 the first time a recipe is made"): a brew is one unit, whatever it
 *  makes (a Brewer's third potion earns nothing more, as a Cook's second serving does not, PROF9), at its potion's tier,
 *  quartered more than two tiers below the rank's top. */
export const brewXp = (potion, rank, first = false) => craftXp(potion.tier, rank, first);

// ─── DISENCHANTING (9.3) ─────────────────────────────────────────────

/** DFU's enchantment budget by template (itemTemplates.json `enchantmentPoints`): a template the table does not hold (the
 *  port's own 600-699 and Foraging's tools) carries none. */
const POINTS = new Map(/** @type {any[]} */ (TEMPLATES_JSON).map((t) => [t.index, Number(t.enchantmentPoints) || 0]));
export const templatePoints = (templateIndex) => POINTS.get(templateIndex) ?? 0;
/**
 * THE POINTS A PIECE CARRIED (9.3: "one per 100 enchantment points it carried"). DECIDED: the budget the piece itself
 * carries to DFU's item maker - its DFU template's (GetItemEnchantmentPower's base), a piece of jewellery its own (PROF10's
 * metal and gem shares, jewelPoints, by its hand) - what the service knows of it from its record, never the client's word.
 * The metal's multiplier DFU lays on a weapon's or armour's budget is the item maker's (enchanting.js), and not laid on
 * here: an Essence is the form's, the metal's worth its quality's. A recipe's piece the table holds no budget for (a dish,
 * a carving, a tool) carries none.
 */
export function piecePoints(r, hand = null) {
  if (!r) return 0;
  const base = templatePoints(r.templateIndex);
  return r.kind === 'jewel' ? jewelPoints(r, base, hand) : base;
}
/** A hundred points an Essence (9.3); a Disenchanter's twice (3.3: "Arcane Essence x2"). */
export const ESSENCE_POINTS = 100;
export const DISENCHANTER = 'disenchanter';
export const essenceOf = (points, disenchanter = false) => Math.floor(Math.max(0, Number(points) || 0) / ESSENCE_POINTS) * (disenchanter ? 2 : 1);
/**
 * A DISENCHANT's ENCHANTING XP. DECIDED: 9.3 says Enchanting's XP comes from what the service sees, and names no number:
 * 5 an Essence the piece yields before a Disenchanter's doubling, x THE PIECE's tier - its recipe's, as a craft's XP is
 * (recipeLaw craftXp) - QUARTERED more than two tiers below the rank's top, and NONE for a piece made wholly of goods only a
 * counter sells (recipeLaw firstCraftPays). AUDIT PROF12 E2: it was the RANK's tier, never quartered, so the counter's
 * Linen (its robes and cloaks) bought Enchanting to Master for 992 silver - the cheapest track of all; the piece's
 * own tier makes a ring's Essence the jeweller's work it was, and a Master's old Silver Ring the quarter a Master's old
 * craft is. A Gold Ruby Ring's 21 Essence: 315 XP below rank 70, 78 past it.
 * @param {{ tier: number, inputs: readonly { key: string }[] }|null} r the piece's recipe (recipeLaw recipeById)
 */
export const DISENCHANT_XP = 5;
export function disenchantXp(r, rank, essence) {
  if (!firstCraftPays(/** @type {any} */ (r)) || !Number.isSafeInteger(r?.tier)) return 0;
  const tier = /** @type {number} */ (r?.tier);
  const xp = DISENCHANT_XP * tier * (Number.isSafeInteger(essence) && essence > 0 ? essence : 0);
  return tier < topTierOf(rank) - 2 ? Math.floor(xp / 4) : xp;
}

// ─── ENCHANTING'S LAYER OVER THE ITEM MAKER (9.3) ────────────────────

/** "cost -10% at Journeyman, -20% at Master (Efficient -5% more)" - percent off DFU's item maker's gold. */
export const ENCHANT_DISCOUNT = Object.freeze({ journeyman: 10, master: 20, efficient: 5 });
export const EFFICIENT = 'efficient';
/** The share off an enchanter's gold at a rank (an Efficient's at 50 more): online, the professions this account's. */
export function enchantDiscountPct(rank, spec50 = null) {
  const r = Number.isSafeInteger(rank) ? rank : 0;
  const base = r >= PROF_RANK_MAX ? ENCHANT_DISCOUNT.master : r >= JOURNEYMAN_RANK ? ENCHANT_DISCOUNT.journeyman : 0;
  return base + (r >= JOURNEYMAN_RANK && spec50 === EFFICIENT ? ENCHANT_DISCOUNT.efficient : 0);
}
/** DFU's gold cost with the share off - DECIDED rounded up: the enchanter keeps the fraction. */
export const enchantGold = (gold, pct = 0) => (pct > 0 ? Math.ceil((Math.max(0, gold) * (100 - pct)) / 100) : gold);
