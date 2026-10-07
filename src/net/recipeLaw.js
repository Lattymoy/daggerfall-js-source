// @ts-check
// PROF3 (2026-09-28, Mac: "Lets keep moving") - THE RECIPE LAW: Smithing's recipes, the quality they are made at, the
// XP they give and the heat they are struck in. Design: bible/06-Systems/Professions-Arc.md 9.1-9.4 (the record) and
// 24 (PROF3 as built); the name is section 14's ("recipeLaw.js (to be written, with PROF3)"). PROF4 (2026-09-28, Mac:
// "Continue"; section 25): Carpentry's recipes beside them - the staves, bows, arrows, furniture, the Basket and the
// Ram Kit - and the plane they are drawn with; a recipe names its profession. PROF7 (2026-09-29, Mac: "Do it"; section
// 29): Outfitting's - the leather armour, DFU's clothing in its four cloths and its dyes, the rugs, tapestries and skins,
// the Fishing-Net - and the stitch they are sewn with; the Skinning Knife at the anvil; the Harpy-feathered arrows.
// PROF11 (Professions-Arc 3.2, 3.3, 9.3, 9.4): Masonry's - the Sculptor's four stone pieces for DECOR, the chisel the
// mason's bench strikes with, and the bench's XP (its cut and its mix are the forge's works' shape: professionLaw
// MASON_RECIPES).
// PROF9 (Professions-Arc 3.3, 9.3, 9.4; section 35): Cooking's - the four dishes of 9.3 at any fire, into the pack, the
// pan they are taken off the fire with, their effects (the feast's to the whole table), and Cooking's XP.
// PROF10 (Professions-Arc 3.3, 4.6, 9.3, 9.4; section 36): Jewelcrafting's - DFU's eight pieces of jewellery in Silver,
// Gold and Platinum (a Cloth Amulet in Linen, a Wand in Ironwood or Ghostwood), a gem set in the pieces that take one,
// the enchantment points the metal and the gem add, the jeweller's hand (a Goldsmith's Silver, a Gemcutter's gem), a
// Lapidary's Siege-cracked Gem, and the facet they are cut with.
//
// PURE, and both ends import it: the account service decides a craft by it (server-account/src/professions.js
// craftAtAnvil), the client draws the anvil by it (ui/profPages.js) and mints the piece by it (systems/smithItems.js).
//
// THE PIECE IS DFU'S. A recipe names a DFU template and a DFU material (ItemEnums.cs WeaponMaterialTypes; armour's
// ArmorMaterialTypes - plate 0x0200 + the metal, chain 0x0100); the item is minted by DFU's own law and the quality
// laid on it after. Not a DFU member: DFU crafts nothing. Ledger A (the professions' row).
import {
  INGOTS, TIER_RANKS, topTierOf, actBand, minedMaterial, WOODS, PINE_PLANK, RESIN, HEARTWOOD, LINEN, WOOL, BEAR_HIDE, CLOTHS, HIDES,
  CURED_LEATHER, HARDENED_LEATHER, SKINNING_KNIFE, COUNTER_ONLY, CUT_STONE, MORTAR, PROF_RANK_MAX,   // PROF11: the mason's stone
  GEMS, PEARL, SIEGE_GEM,   // PROF10: the gems a jeweller sets, and a Lapidary's Siege-cracked one
} from './professionLaw.js';
import { GROUP_TEMPLATE_INDICES } from '../systems/itemTemplatesData.js';   // PROF10: DFU's Jewellery enum, one home
import { CLOTHING_DYES } from '../characters/dyes.js';   // DFU's ten clothing dyes (DyeColors 0-9), one home
import { textCaught } from './nameFilter.js';   // TEXT-F1: a mark's words, read as a name's (nameFilter.js imports nothing)

// ─── THE METALS (PROF0 4.1) ──────────────────────────────────────────

/** The DFU material each ingot makes (WeaponMaterialTypes: Iron 0, Steel 1, Silver 2, Elven 3, Dwarven 4, Mithril 5,
 *  Adamantium 6, Ebony 7, Orcish 8, Daedric 9). Warforged Steel counts as Ebony, with a step (PROF0 4.7). */
export const INGOT_MATERIAL = Object.freeze({
  'ingot:iron': 0, 'ingot:steel': 1, 'ingot:silver': 2, 'ingot:moonstone': 3, 'ingot:dwarven': 4, 'ingot:mithril': 5,
  'ingot:adamantium': 6, 'ingot:ebony': 7, 'ingot:orichalcum': 8, 'ingot:daedric': 9, 'ingot:warforged': 7,
});
/** DFU's material names (itemInfo.js MATERIAL_NAMES), by material - the recipe's word for its metal. */
const METAL_WORDS = Object.freeze(['Iron', 'Steel', 'Silver', 'Elven', 'Dwarven', 'Mithril', 'Adamantium', 'Ebony', 'Orcish', 'Daedric']);
/** The ingot a Warforged piece is made from counts a quality step (PROF0 4.7, 9.2). */
export const WARFORGED = 'ingot:warforged';
/** DFU's armour materials (ItemEnums.cs ArmorMaterialTypes): leather, chain, and plate above the metal. */
export const ARMOR_LEATHER = 0x0000;
export const ARMOR_CHAIN = 0x0100;
export const ARMOR_PLATE = 0x0200;

// ─── THE PRODUCTS (PROF0 9.3) ────────────────────────────────────────

const TIN = 'metal:tin', COPPER = 'metal:copper', LEATHER = 'leather:cured', OAK = 'plank:oak', PINE = 'plank:pine';
/**
 * @typedef {{ id: string, name: string, kind: 'weapon'|'plate'|'shield'|'chain'|'tool'|'kit', templateIndex: number,
 *   ingots: number, also: readonly (readonly [string, number])[] }} Product
 */
/** @returns {Product} */
const product = (id, name, kind, templateIndex, ingots, also = []) => Object.freeze({ id, name, kind, templateIndex, ingots, also: Object.freeze(also.map((a) => Object.freeze(a))) });
/** The weapons (DFU 113-128 but the Staff, a carpenter's): the ingots and the fittings 9.3 asks. */
export const WEAPON_PRODUCTS = Object.freeze([
  product('dagger', 'Dagger', 'weapon', 113, 1, [[TIN, 1]]), product('tanto', 'Tanto', 'weapon', 114, 1, [[TIN, 1]]),
  product('shortsword', 'Shortsword', 'weapon', 116, 2, [[TIN, 1]]), product('wakizashi', 'Wakizashi', 'weapon', 117, 2, [[TIN, 1]]),
  product('broadsword', 'Broadsword', 'weapon', 118, 3, [[COPPER, 1], [LEATHER, 1]]),
  product('saber', 'Saber', 'weapon', 119, 3, [[COPPER, 1], [LEATHER, 1]]),
  product('longsword', 'Longsword', 'weapon', 120, 3, [[COPPER, 1], [LEATHER, 1]]),
  product('katana', 'Katana', 'weapon', 121, 3, [[COPPER, 1], [LEATHER, 1]]),
  product('mace', 'Mace', 'weapon', 124, 3, [[COPPER, 1], [LEATHER, 1]]),
  product('flail', 'Flail', 'weapon', 125, 3, [[COPPER, 1], [LEATHER, 1]]),
  product('warhammer', 'Warhammer', 'weapon', 126, 4, [[COPPER, 1], [OAK, 1]]),
  product('battleaxe', 'Battle Axe', 'weapon', 127, 4, [[COPPER, 1], [OAK, 1]]),
  product('waraxe', 'War Axe', 'weapon', 128, 4, [[COPPER, 1], [OAK, 1]]),
  product('claymore', 'Claymore', 'weapon', 122, 5, [[COPPER, 1], [LEATHER, 1]]),
  product('daikatana', 'Dai-katana', 'weapon', 123, 5, [[COPPER, 1], [LEATHER, 1]]),
]);
/** The plate (DFU 102-108): Cuirass 6 and 2 Cured Leather, Greaves 4, Helm 2, the pauldrons, Gauntlets and Boots 2. */
export const PLATE = Object.freeze([
  product('cuirass', 'Cuirass', 'plate', 102, 6, [[LEATHER, 2]]), product('greaves', 'Greaves', 'plate', 104, 4, [[LEATHER, 1]]),
  product('helm', 'Helm', 'plate', 107, 2, [[LEATHER, 1]]), product('lpauldron', 'Left Pauldron', 'plate', 105, 2, [[LEATHER, 1]]),
  product('rpauldron', 'Right Pauldron', 'plate', 106, 2, [[LEATHER, 1]]), product('gauntlets', 'Gauntlets', 'plate', 103, 2, [[LEATHER, 1]]),
  product('boots', 'Boots', 'plate', 108, 2, [[LEATHER, 1]]),
]);
/** The shields (DFU 109-112): the Buckler 3 and Cured Leather; Round, Kite and Tower 3, 4 and 5 and an Oak Plank. */
export const SHIELDS = Object.freeze([
  product('buckler', 'Buckler', 'shield', 109, 3, [[LEATHER, 1]]), product('roundshield', 'Round Shield', 'shield', 110, 3, [[OAK, 1]]),
  product('kiteshield', 'Kite Shield', 'shield', 111, 4, [[OAK, 1]]), product('towershield', 'Tower Shield', 'shield', 112, 5, [[OAK, 1]]),
]);
/** The chain (the plate's seven - DFU has no chain shield): the plate piece's ingots x 0.75 rounded up, nothing else. */
export const CHAIN = Object.freeze(PLATE.map((p) => product(`chain-${p.id}`, p.name, 'chain', p.templateIndex, Math.ceil(p.ingots * 0.75))));
/** Foraging's tools (FORAGE0 14.7), at Iron: their templates are Foraging's own (foragingLaw.js FT). PROF7: and the
 *  Skinning Knife (603, the port's own - FORAGE0 14.7's row), 1 Iron Ingot and 1 Pine Plank at rank 0. */
export const TOOLS = Object.freeze([
  product('woodaxe', 'Wood-Axe', 'tool', 1600, 2, [[PINE, 1]]), product('pickaxe', 'Pick-Axe', 'tool', 1601, 2, [[PINE, 1]]),
  product('sickle', 'Sickle', 'tool', 1602, 1, [[PINE, 1]]), product('spade', 'Spade', 'tool', 1606, 2, [[OAK, 1]]),
  product('knife', 'Skinning Knife', 'tool', SKINNING_KNIFE.templateIndex, 1, [[PINE, 1]]),
]);
/** A tool's tier: the Spade's rank 10 (FORAGE0 14.7) is tier 2's; the rest tier 1. */
const TOOL_TIER = Object.freeze({ spade: 2 });
/** The Repair Kit (PROF0 4.8's 692): one of its metal's ingots and a Cured Leather. */
export const KIT_PRODUCT = product('kit', 'Repair Kit', 'kit', 692, 1, [[LEATHER, 1]]);
export const REPAIR_KIT_TEMPLATE = 692;
/** What a kit gives back (PROF0 9.3): a quarter of an item's condition, once. */
/** REPAIR-EASE (2026-09-30, Mac: "Add repair items you can find by looting"): a FIELD Repair Kit - found in dungeon
 *  piles and on foes that carry loot, never crafted - mends any metal's weapon or armour, by less than a smith's kit. */
export const FIELD_KIT_REPAIR = 0.15;
export const KIT_REPAIR = 0.25;
/** KIT-CEILING (2026-10-01, the economy arc - bible/06-Systems/Economy-Arc.md: field repair stays partial): no kit, a
 *  field kit or a smith's, mends a piece past three quarters of its condition - the overhaul's normal band (a blade at
 *  61-75% strikes at its own damage); the sharp edge above it is a smith's work. */
export const KIT_CEILING = 0.75;

/** The metals a recipe is made in: every ingot but the Daedric's and the Warforged's for the tools (Iron alone). */
const SMITH_INGOTS = Object.freeze(INGOTS.map((i) => i.key));
const KIT_INGOTS = Object.freeze(SMITH_INGOTS.filter((k) => k !== WARFORGED));

/**
 * @typedef {{ id: string, product: string, name: string, kind: string, family: string,
 *   profession: 'smithing'|'carpentry'|'outfitting'|'masonry'|'cooking'|'jewelcrafting', templateIndex: number, metal: string|null, wood?: string|null,
 *   material: number, tier: number, rank: number, stack?: number, later?: string, group?: string, cloth?: string,
 *   leather?: string, dyes?: boolean, spec?: string, gem?: string|null, pattern: string, madeOf: string,
 *   inputs: readonly { key: string, n: number }[] }} Recipe
 *   PROF11: `spec` the specialisation at 100 a recipe asks besides its rank (the Sculptor's stone decor)
 *   PROF9: a dish's `kind` is 'dish' and its `family` 'dishes'
 *   PROF10: a piece of jewellery's `kind` is 'jewel', its `family` 'jewellery', its `gem` the gem it sets (or null)
 *   CRAFT2: `pattern` the piece's word whatever it is made of (patternsOf - "Longsword"), `madeOf` what this recipe makes
 *   it of ("Mithril"; "" where a pattern is made one way)
 */
const FAMILY = Object.freeze({ weapon: 'weapons', plate: 'armour', shield: 'armour', chain: 'armour', tool: 'tools', kit: 'kits' });
/** @returns {Recipe} */
function recipeOf(p, metal) {
  const m = INGOT_MATERIAL[metal];
  const tier = p.kind === 'tool' ? (TOOL_TIER[p.id] ?? 1) : minedMaterial(metal).tier;
  const material = p.kind === 'plate' || p.kind === 'shield' ? ARMOR_PLATE + m : p.kind === 'chain' ? ARMOR_CHAIN : p.kind === 'weapon' ? m : 0;
  const word = metal === WARFORGED ? 'Warforged' : METAL_WORDS[m];
  const name = p.kind === 'chain' ? `Chain ${p.name}` : p.kind === 'tool' ? p.name : `${word} ${p.name}`;
  return Object.freeze({
    id: `${p.id}:${metal.slice('ingot:'.length)}`, product: p.id, name, kind: p.kind, family: FAMILY[p.kind], profession: 'smithing',
    templateIndex: p.templateIndex, metal, material, tier, rank: TIER_RANKS[tier - 1],
    pattern: p.kind === 'chain' ? `Chain ${p.name}` : p.name, madeOf: word,   // CRAFT2
    inputs: Object.freeze([Object.freeze({ key: metal, n: p.ingots }), ...p.also.map(([key, n]) => Object.freeze({ key, n }))]),
  });
}
/** EVERY RECIPE the anvil knows, in its window's order: the weapons, the plate, the shields at every metal; the chain
 *  at Steel; the tools at Iron; the kits at every metal. */
export const SMITH_RECIPES = Object.freeze([
  ...[...WEAPON_PRODUCTS, ...PLATE, ...SHIELDS].flatMap((p) => SMITH_INGOTS.map((metal) => recipeOf(p, metal))),
  ...CHAIN.map((p) => recipeOf(p, 'ingot:steel')),
  ...TOOLS.map((p) => recipeOf(p, 'ingot:iron')),
  ...KIT_INGOTS.map((metal) => recipeOf(KIT_PRODUCT, metal)),
]);

// ─── CARPENTRY (PROF0 9.3, 25) ───────────────────────────────────────

/** A staff's or bow's DFU material is its wood's tier's (9.3): Pine Iron, Oak Steel, Cherry Silver, Teak Elven,
 *  Mahogany Mithril; the two tier-6 woods split between the tier's metals - Ironwood Adamantium, Ghostwood Ebony. */
export const WOOD_MATERIAL = Object.freeze({ pine: 0, oak: 1, cherry: 2, teak: 3, mahogany: 5, ironwood: 6, ghostwood: 7 });
/** DFU's weapons Carpentry makes: the Staff (115), the Short Bow (129), the Long Bow (130), the Arrow (131). */
export const STAFF_TEMPLATE = 115, SHORT_BOW_TEMPLATE = 129, LONG_BOW_TEMPLATE = 130, ARROWS_TEMPLATE = 131;
/** Arrows a craft makes - one stack, DFU's own most (CreateWeapon's arrow arm rolls 1-20). */
export const ARROWS_STACK = 20;
/** DFU's Twigs (a plant of both lands - PlantIngredients1 and 2, template 8), as the Stores keep it twice. */
export const TWIGS_NORTH = 'p1:8', TWIGS_SOUTH = 'p2:8';
/** The Ram Kit (PROF0 4.8's 690) - a siege work, rank 60 (9.3). */
export const RAM_KIT_TEMPLATE = 690;
export const RAM_KIT_RANK = 60;
const woodName = (id) => WOODS.find((w) => w.id === id)?.name ?? id;
const woodTier = (id) => WOODS.find((w) => w.id === id)?.tier ?? 1;
/** @returns {Recipe} */
function carpentry({ id, name, kind, family, templateIndex, wood = null, tier = wood ? woodTier(wood) : 1, rank = TIER_RANKS[tier - 1], material = 0, inputs, stack = 0, later = null, pattern = name, madeOf = wood ? woodName(wood) : '' }) {
  return Object.freeze({
    id, product: id.slice(0, id.indexOf(':')), name, kind, family, profession: 'carpentry', templateIndex, metal: null,
    wood: wood ? `plank:${wood}` : null, material, tier, rank, ...(stack ? { stack } : {}), ...(later ? { later } : {}), pattern, madeOf,   // CRAFT2
    inputs: Object.freeze(inputs.map(([key, n]) => Object.freeze({ key, n }))),
  });
}
const plank = (w) => `plank:${w}`;
/** The four woods of DFU's furniture (templates 221-232: Oak, Cherry, Mahogany, Teak, each at its offset). */
/** @type {ReadonlyArray<[string, number]>} */
const FURNITURE_WOODS = Object.freeze([['oak', 0], ['cherry', 1], ['mahogany', 2], ['teak', 3]]);
/** DFU's four beds by their rarity column (1 Plain Single, 2 Plain Double, 3 Fancy Single, 4 Fancy Double) - each the
 *  wood of that tier (PROF0 25): FOUND, a bed names no wood. */
/** @type {ReadonlyArray<[string, string, number, string]>} */
const BEDS = Object.freeze([
  ['bed-plain-single', 'Plain Single Bed', 217, 'pine'], ['bed-plain-double', 'Plain Double Bed', 219, 'oak'],
  ['bed-fancy-single', 'Fancy Single Bed', 218, 'cherry'], ['bed-fancy-double', 'Fancy Double Bed', 220, 'teak'],
]);
/** EVERY RECIPE the workbench knows, in its window's order: the staves and bows at every wood; the arrows (the northern
 *  Twigs', the southern's and - PROF7 - the Harpy's feathers'); the furniture; the Basket; the Ram Kit (named, never made
 *  - PROF0 25). */
export const CARPENTRY_RECIPES = Object.freeze([
  ...WOODS.map((w) => carpentry({ id: `staff:${w.id}`, name: `${w.name} Staff`, kind: 'staff', family: 'staves', templateIndex: STAFF_TEMPLATE, wood: w.id, material: WOOD_MATERIAL[w.id], inputs: [[plank(w.id), 3]], pattern: 'Staff' })),
  ...WOODS.map((w) => carpentry({ id: `shortbow:${w.id}`, name: `${w.name} Short Bow`, kind: 'bow', family: 'bows', templateIndex: SHORT_BOW_TEMPLATE, wood: w.id, material: WOOD_MATERIAL[w.id], inputs: [[plank(w.id), 3], [RESIN.key, 1]], pattern: 'Short Bow' })),
  ...WOODS.map((w) => carpentry({ id: `longbow:${w.id}`, name: `${w.name} Long Bow`, kind: 'bow', family: 'bows', templateIndex: LONG_BOW_TEMPLATE, wood: w.id, material: WOOD_MATERIAL[w.id], inputs: [[plank(w.id), 4], [RESIN.key, 1]], pattern: 'Long Bow' })),
  carpentry({ id: 'arrows:north', name: 'Arrows (northern Twigs)', kind: 'arrows', family: 'arrows', templateIndex: ARROWS_TEMPLATE, wood: 'pine', stack: ARROWS_STACK, inputs: [[PINE_PLANK.key, 1], ['ingot:iron', 1], [TWIGS_NORTH, 4]], pattern: 'Arrows', madeOf: 'northern Twigs' }),
  carpentry({ id: 'arrows:south', name: 'Arrows (southern Twigs)', kind: 'arrows', family: 'arrows', templateIndex: ARROWS_TEMPLATE, wood: 'pine', stack: ARROWS_STACK, inputs: [[PINE_PLANK.key, 1], ['ingot:iron', 1], [TWIGS_SOUTH, 4]], pattern: 'Arrows', madeOf: 'southern Twigs' }),
  // PROF7 (PROF0 9.3's own fletching, waiting on Hunting since PROF4): one Harpy Feathers for the four Twigs - the same
  // quiver, since an arrow takes no quality for "one step lower" to act on (PROF0 25, 29)
  carpentry({ id: 'arrows:harpy', name: 'Arrows (Harpy Feathers)', kind: 'arrows', family: 'arrows', templateIndex: ARROWS_TEMPLATE, wood: 'pine', stack: ARROWS_STACK, inputs: [[PINE_PLANK.key, 1], ['ingot:iron', 1], ['hide:harpy', 1]], pattern: 'Arrows', madeOf: 'Harpy Feathers' }),
  ...FURNITURE_WOODS.map(([w, i]) => carpentry({ id: `table-large:${w}`, name: `Large ${woodName(w)} Table`, kind: 'furniture', family: 'furniture', templateIndex: 221 + i, wood: w, inputs: [[plank(w), 6]], pattern: 'Large Table' })),
  ...FURNITURE_WOODS.map(([w, i]) => carpentry({ id: `table-small:${w}`, name: `Small ${woodName(w)} Table`, kind: 'furniture', family: 'furniture', templateIndex: 225 + i, wood: w, inputs: [[plank(w), 3]], pattern: 'Small Table' })),
  ...FURNITURE_WOODS.map(([w, i]) => carpentry({ id: `chair:${w}`, name: `${woodName(w)} Chair`, kind: 'furniture', family: 'furniture', templateIndex: 229 + i, wood: w, inputs: [[plank(w), 2]], pattern: 'Chair' })),
  ...BEDS.map(([p, name, t, w]) => carpentry({ id: `${p}:${w}`, name, kind: 'furniture', family: 'furniture', templateIndex: t, wood: w, inputs: [[plank(w), 8], [LINEN.key, 2]] })),
  carpentry({ id: 'basket:pine', name: 'Basket', kind: 'tool', family: 'tools', templateIndex: 1607, wood: 'pine', inputs: [[PINE_PLANK.key, 2]] }),
  carpentry({ id: 'ramkit:oak', name: 'Ram Kit', kind: 'siege', family: 'siege', templateIndex: RAM_KIT_TEMPLATE, wood: 'oak', tier: 5, rank: RAM_KIT_RANK, inputs: [[plank('oak'), 40], ['ingot:iron', 20], [BEAR_HIDE.key, 4]] }),
]);
// ─── OUTFITTING (PROF0 9.3, 29) ──────────────────────────────────────

/** The leather armour (9.3): DFU's seven body pieces at Leather (ArmorMaterialTypes 0 - DFU has every one in leather),
 *  in Cured Leather, or in Hardened Leather for "the tier 4-6 leathers' step" - a quality step, as a Warforged ingot's. */
export const LEATHER_PIECES = Object.freeze([
  ['cuirass', 'Cuirass', 102, 6], ['greaves', 'Greaves', 104, 4], ['helm', 'Helm', 107, 2], ['lpauldron', 'Left Pauldron', 105, 2],
  ['rpauldron', 'Right Pauldron', 106, 2], ['gauntlets', 'Gauntlets', 103, 2], ['boots', 'Boots', 108, 2],
].map((a) => Object.freeze(a)));
/**
 * DFU's CLOTHING (MensClothing 141-181, WomensClothing 182-216), each its 9.3 size - small a bolt, middle two, large
 * three, boots a bolt and a Cured Leather. Every one takes a dye: AUDIT 32 L3 - DFU's "unchangeable" shirts (178, 179,
 * 214, 215) are the ones whose VARIANT Use never changes (systems/useItem.js VARIANT_CHANGEABLE), and DFU's shelf and
 * loot dye them as any other garment (systems/shopStock.js); the loom refused them a dye, sewing them in Blue's table. 9.3
 * names most; DECIDED for the rest: the Loincloth small, the Wrap and the Peasant Blouse middle, the Toga large (PROF0
 * 29). DFU's look-alike shirts are told apart by their own enum names (ItemEnums.cs), as the startingGear port quotes them.
 */
export const GARMENTS = Object.freeze([
  [141, 'Straps', 's'], [142, 'Armbands', 's'], [143, 'Kimono', 'l'], [144, 'Fancy Armbands', 's'], [145, 'Sash', 's'],
  [146, 'Eodoric', 'm'], [147, 'Shoes', 's'], [148, 'Tall Boots', 'b'], [149, 'Boots', 'b'], [150, 'Sandals', 's'],
  [151, 'Casual Pants', 'm'], [152, 'Breeches', 'm'], [153, 'Short Skirt', 'm'], [154, 'Casual Cloak', 'l'],
  [155, 'Formal Cloak', 'l'], [156, 'Khajiit Suit', 'l'], [157, 'Dwynnen Surcoat', 'l'], [158, 'Short Tunic', 'm'],
  [159, 'Formal Tunic', 'm'], [160, 'Toga', 'l'], [161, 'Reversible Tunic', 'm'], [162, 'Loincloth', 's'],
  [163, 'Plain Robes', 'l'], [164, 'Priest Robes', 'l'], [165, 'Short Shirt', 'm'], [166, 'Short Shirt, belted', 'm'],
  [167, 'Long Shirt', 'm'], [168, 'Long Shirt, belted', 'm'], [169, 'Short Shirt, closed', 'm'],
  [170, 'Short Shirt, closed (second cut)', 'm'], [171, 'Long Shirt, closed', 'm'], [172, 'Long Shirt, closed (second cut)', 'm'],
  [173, 'Open Tunic', 'm'], [174, 'Wrap', 'm'], [175, 'Long Skirt', 'm'], [176, 'Anticlere Surcoat', 'l'],
  [177, 'Challenger Straps', 's'], [178, 'Short Shirt, unchangeable', 'm'], [179, 'Long Shirt, unchangeable', 'm'],
  [180, 'Vest', 'm'], [181, 'Champion Straps', 's'],
  [182, 'Brassiere', 's'], [183, 'Formal Brassiere', 's'], [184, 'Peasant Blouse', 'm'], [185, 'Eodoric', 'm'],
  [186, 'Shoes', 's'], [187, 'Tall Boots', 'b'], [188, 'Boots', 'b'], [189, 'Sandals', 's'], [190, 'Casual Pants', 'm'],
  [191, 'Casual Cloak', 'l'], [192, 'Formal Cloak', 'l'], [193, 'Khajiit Suit', 'l'], [194, 'Formal Eodoric', 'm'],
  [195, 'Evening Gown', 'l'], [196, 'Day Gown', 'l'], [197, 'Casual Dress', 'l'], [198, 'Strapless Dress', 'l'],
  [199, 'Loincloth', 's'], [200, 'Plain Robes', 'l'], [201, 'Priestess Robes', 'l'], [202, 'Short Shirt', 'm'],
  [203, 'Short Shirt, belted', 'm'], [204, 'Long Shirt', 'm'], [205, 'Long Shirt, belted', 'm'], [206, 'Short Shirt, closed', 'm'],
  [207, 'Short Shirt, closed and belted', 'm'], [208, 'Long Shirt, closed', 'm'], [209, 'Long Shirt, closed and belted', 'm'],
  [210, 'Open Tunic', 'm'], [211, 'Wrap', 'm'], [212, 'Long Skirt', 'm'], [213, 'Tights', 's'],
  [214, 'Short Shirt, unchangeable', 'm'], [215, 'Long Shirt, unchangeable', 'm'], [216, 'Vest', 'm'],
].map((a) => Object.freeze(a)));
/** The bolts a garment's size asks (9.3). */
export const GARMENT_BOLTS = Object.freeze({ s: 1, m: 2, l: 3, b: 1 });
/** DFU's clothing groups: the men's and the women's. */
export const garmentGroup = (templateIndex) => (templateIndex <= 181 ? 'MensClothing' : 'WomensClothing');
/** DFU's rugs, tapestries and skins (Furniture 237-245), in 9.3's cloth: rugs 3 Wool, tapestries 4 Wool - FOUND, DFU's
 *  furniture takes no dye, so "a dye" has nothing to colour - and the skins of a pelt, Large two, Small one. */
export const RUGS = Object.freeze([[237, 'Small Plain Rug'], [238, 'Large Plain Rug'], [239, 'Small Fine Rug'], [240, 'Large Fine Rug']]);
export const TAPESTRIES = Object.freeze([[241, 'Large Tapestry'], [242, 'Medium Tapestry'], [243, 'Small Tapestry']]);
/** The pelts the skins are cut from: a fur's hide, never silk, chitin, scales, feathers or shell. */
export const PELTS = Object.freeze(['hide:rat', 'hide:bat', 'hide:bear', 'hide:tiger']);
/** The Fishing-Net (FORAGE0 14.7): Foraging's 1603, 2 Linen Bolt, rank 0. */
export const FISHING_NET_TEMPLATE = 1603;
const tierOfKey = (key) => minedMaterial(key)?.tier ?? 1;
/** @returns {Recipe} */
function outfitting({ id, name, kind, family, templateIndex, tier, material = 0, inputs, pattern = name, madeOf = '', ...more }) {
  return Object.freeze({
    id, product: id.slice(0, id.indexOf(':')), name, kind, family, profession: 'outfitting', templateIndex, metal: null,
    material, tier, rank: TIER_RANKS[tier - 1], ...more, pattern, madeOf, inputs: Object.freeze(inputs.map(([key, n]) => Object.freeze({ key, n }))),
  });
}
/** EVERY RECIPE the loom knows, in its window's order: the leather armour in its two leathers; every garment in each
 *  cloth; the rugs, tapestries and skins; the Fishing-Net. */
export const OUTFITTING_RECIPES = Object.freeze([
  ...LEATHER_PIECES.flatMap(([id, name, t, n]) => [CURED_LEATHER, HARDENED_LEATHER].map((l) => outfitting({
    id: `leather-${id}:${l === CURED_LEATHER ? 'cured' : 'hardened'}`, name: `${l === CURED_LEATHER ? 'Leather' : 'Hardened Leather'} ${name}`,
    kind: 'leather', family: 'leather', templateIndex: /** @type {number} */ (t), tier: l.tier, material: ARMOR_LEATHER,
    leather: l.key, inputs: [[l.key, /** @type {number} */ (n)]], pattern: /** @type {string} */ (name), madeOf: l.name,   // CRAFT2
  }))),
  ...GARMENTS.flatMap(([t, name, size]) => CLOTHS.map((c) => outfitting({
    id: `garment-${t}:${c.key.slice('cloth:'.length)}`, name: `${c.name.replace(/ Bolt$/, '')} ${name}`, kind: 'garment', family: 'clothing',
    templateIndex: /** @type {number} */ (t), tier: c.tier, group: garmentGroup(t), cloth: c.key, dyes: true, pattern: /** @type {string} */ (name), madeOf: c.name.replace(/ Bolt$/, ''),
    inputs: [[c.key, GARMENT_BOLTS[/** @type {string} */ (size)]], ...(size === 'b' ? [[CURED_LEATHER.key, 1]] : [])],
  }))),
  ...RUGS.map(([t, name]) => outfitting({ id: `rug-${t}:wool`, name: /** @type {string} */ (name), kind: 'furniture', family: 'furnishings', templateIndex: /** @type {number} */ (t), tier: WOOL.tier, inputs: [[WOOL.key, 3]], madeOf: 'Wool' })),
  ...TAPESTRIES.map(([t, name]) => outfitting({ id: `tapestry-${t}:wool`, name: /** @type {string} */ (name), kind: 'furniture', family: 'furnishings', templateIndex: /** @type {number} */ (t), tier: WOOL.tier, inputs: [[WOOL.key, 4]], madeOf: 'Wool' })),
  ...PELTS.flatMap((p) => [[244, 'Large Skins', 2], [245, 'Small Skins', 1]].map(([t, name, n]) => outfitting({
    id: `skins-${t}:${p.slice('hide:'.length)}`, name: `${name} (${HIDES.find((h) => h.key === p)?.name ?? p})`, kind: 'furniture', family: 'furnishings',
    templateIndex: /** @type {number} */ (t), tier: tierOfKey(p), inputs: [[p, /** @type {number} */ (n)]],
    pattern: /** @type {string} */ (name), madeOf: HIDES.find((h) => h.key === p)?.name ?? p,   // CRAFT2
  }))),
  outfitting({ id: 'fishingnet:linen', name: 'Fishing-Net', kind: 'tool', family: 'tools', templateIndex: FISHING_NET_TEMPLATE, tier: LINEN.tier, inputs: [[LINEN.key, 2]], madeOf: 'Linen' }),
]);
/** A garment's dyes (9.3: "itemDye.js's colours"): DFU's ten clothing dyes; a crafted garment is sewn in the one the
 *  crafter chose, or none (DFU's Unchanged). */
export const GARMENT_DYES = CLOTHING_DYES;
/** Whether `dye` may be asked of recipe `r`: a garment that takes one, and one of DFU's ten - or none asked at all. */
export const dyeOk = (r, dye) => (dye == null ? true : !!r && r.kind === 'garment' && r.dyes === true && Number.isInteger(dye) && GARMENT_DYES.includes(dye));

// ─── PROF11: MASONRY'S STONE DECOR (PROF0 3.3, 9.3) ─────────────────

/** The Sculptor (3.3: "Sculptor - stone decor pieces"), Masonry's choice at 100 - the one door to the stone decor. */
export const SCULPTOR = 'sculptor';
/**
 * THE SCULPTOR'S FOUR (9.3: "stone decor (Sculptor): a column, a bench, a font, a statue plinth (DECOR pieces)").
 * DECIDED, each:
 * - ITS TEMPLATE: 696-699, the last four of the professions' range (4.8 names none of them; the stone's own 673-675 run
 *   into the Siege-cracked Gem's 678) - DFU's Furniture group, as Carpentry's tables are, so a piece is DELIVERED among
 *   the home's things and never carried (DECOR2b's furnishings; systems/decorFurnish.js), its picture in a list the
 *   stone's own lump (Lodestone's, greyed - 4.8's stone row).
 * - ITS SHAPE IN A ROOM: ONE of Daggerfall's own models, named by World of Daggerfall's table of them
 *   (vendor/world-of-daggerfall/Scripts/LocationHelper.cs) - the Column its "Marble Pillar" (62315), the Bench its
 *   "Marble Slab" (62322 - a seat of stone), the Font its "Fountain 1" (41220 - the stone basin Climates & Calories drinks
 *   from as a trough, survival/items.js WATER_SOURCE_MODELS), the Plinth its "Stone Pedestal" (74091). A table chooses
 *   its look among the game's furniture (DECOR2b); a carving is the one shape the Sculptor cut. Unverified against the
 *   player's ARENA2 here - the woods' and hides' open flag holds them (Mac's eye).
 * - ITS STONE: Cut Stone and Mortar (9.3: "Cut Stone and Mortar (4.5); stone decor"), the larger the piece the more -
 *   the Column 12 and 3, the Font 10 and 3, the Bench 8 and 2, the Plinth 6 and 2 - a carving a Master's week of the
 *   quarry's stone, never a single afternoon's.
 * - ITS RANK: Cut Stone's tier (2) and its rank (10) - the quality's margin is the Master's own (100 - 10: the 45+ row,
 *   a Master's work) - and its door the SCULPTOR's choice (`spec`, recipeOpen), which only a Master makes.
 * - ITS WORTH: in gold, the furniture's way (its quality the condition's multiplier on it): the Column 150, the Font
 *   120, the Bench 90, the Plinth 60; its weight a piece of stone's (200, 150, 120, 80 kg) - delivered, never carried.
 */
export const STONE_DECOR = Object.freeze([
  Object.freeze({ id: 'column', name: 'Stone Column', templateIndex: 696, model: 62315, cut: 12, mortar: 3, price: 150, weight: 200 }),
  Object.freeze({ id: 'bench', name: 'Stone Bench', templateIndex: 697, model: 62322, cut: 8, mortar: 2, price: 90, weight: 120 }),
  Object.freeze({ id: 'font', name: 'Stone Font', templateIndex: 698, model: 41220, cut: 10, mortar: 3, price: 120, weight: 150 }),
  Object.freeze({ id: 'plinth', name: 'Statue Plinth', templateIndex: 699, model: 74091, cut: 6, mortar: 2, price: 60, weight: 80 }),
]);
/** The stone decor's templates. */
export const STONE_DECOR_TEMPLATES = Object.freeze(STONE_DECOR.map((d) => d.templateIndex));
/** The one DFU model a stone piece stands as, by its template, or null for anything else. */
export const stoneDecorModel = (templateIndex) => STONE_DECOR.find((d) => d.templateIndex === templateIndex)?.model ?? null;
/** EVERY RECIPE the mason's bench carves (its cut and its mix are works - professionLaw MASON_RECIPES): the four, in
 *  9.3's order, `kind` furniture (minted among the home's things, systems/smithItems.js), `family` stonework. */
/** @type {readonly Recipe[]} */
export const MASONRY_RECIPES = Object.freeze(STONE_DECOR.map((d) => Object.freeze({
  id: `${d.id}:stone`, product: d.id, name: d.name, kind: 'furniture', family: 'stonework', profession: 'masonry',
  templateIndex: d.templateIndex, metal: null, material: 0, tier: CUT_STONE.tier, rank: TIER_RANKS[CUT_STONE.tier - 1], spec: SCULPTOR,
  pattern: d.name, madeOf: '',   // CRAFT2: one way each
  inputs: Object.freeze([Object.freeze({ key: CUT_STONE.key, n: d.cut }), Object.freeze({ key: MORTAR.key, n: d.mortar })]),
})));

// ─── PROF9: COOKING'S DISHES (PROF0 3.3, 9.3; section 35) ────────────

/**
 * THE FOUR DISHES (9.3: "Cooking (any campfire, hearth or brazier ...). Every input comes from the Stores ... and every
 * dish goes to the pack"), 4.8's templates 685-688, each its inputs as 9.3 writes them and its effect. DECIDED, each:
 * - ITS RANK: the Novice's two are the hunter's and the fisher's - Hunter's Stew and Fisherman's Supper at rank 0 (tier
 *   1); the Orchard Tart at rank 10 (tier 2: its Yellow Berries an uncommon herb, 4.3); the Feast of the Hearth at 9.3's
 *   rank 70 (tier 6).
 * - ITS HERB: Root Bulb, Green Leaves and Yellow Berries grow in both of DFU's plant groups (professionLaw
 *   PLANT_GROUP_TEMPLATES), so the Stores keep each twice and a dish of one is two recipes, the northern herb's and the
 *   southern's - the arrows' Twigs' law (PROF0 25). The dish is the same dish either way.
 * - ITS EFFECT (`effect`): `stats` the attributes it raises and by how much, `stamina` the share a stamina lasts longer
 *   (the Tart: 9.3's "stamina regained +20%" - FOUND: Daggerfall regains stamina only by rest and spells, so the Tart's
 *   is the bar's: every minute's drain divided by 1.2, a bar a fifth longer), `minutes` how long, in game minutes (a
 *   magic round each), and `party` the feast's - the whole party at the table (PARTY-BUFFS' frame).
 * - ITS SERVINGS: one dish a cook, a Cook's two (3.3: "+1 serving a dish") - craftCount.
 */
/**
 * @typedef {{ id: string, name: string, templateIndex: number, tier: number, herb: number|null, herbName: string|null,
 *   inputs: readonly (readonly (string|number)[])[],
 *   effect: { stats?: Readonly<Record<string, number>>, stamina?: number, minutes: number, party?: boolean } }} Dish
 */
/** @type {readonly Dish[]} */
export const DISHES = Object.freeze([
  Object.freeze({ id: 'stew', name: 'Hunter\'s Stew', templateIndex: 685, tier: 1, herb: 13, herbName: 'Root Bulb',
    inputs: Object.freeze([Object.freeze(['food:meat', 2]), Object.freeze(['food:mushroom', 1])]),
    effect: Object.freeze({ stats: Object.freeze({ endurance: 5 }), minutes: 120 }) }),
  Object.freeze({ id: 'supper', name: 'Fisherman\'s Supper', templateIndex: 686, tier: 1, herb: 9, herbName: 'Green Leaves',
    inputs: Object.freeze([Object.freeze(['food:fish', 2]), Object.freeze(['food:egg', 1])]),
    effect: Object.freeze({ stats: Object.freeze({ agility: 5 }), minutes: 120 }) }),
  Object.freeze({ id: 'tart', name: 'Orchard Tart', templateIndex: 687, tier: 2, herb: 17, herbName: 'Yellow Berries',
    inputs: Object.freeze([Object.freeze(['food:apple', 2]), Object.freeze(['food:egg', 1])]),
    effect: Object.freeze({ stamina: 20, minutes: 240 }) }),
  Object.freeze({ id: 'feast', name: 'Feast of the Hearth', templateIndex: 688, tier: 6, herb: null, herbName: null,
    inputs: Object.freeze([Object.freeze(['food:meat', 4]), Object.freeze(['food:fish', 4]), Object.freeze(['food:apple', 2]),
      Object.freeze(['food:orange', 2]), Object.freeze(['food:mushroom', 2]), Object.freeze(['food:egg', 2])]),
    effect: Object.freeze({ stats: Object.freeze({ strength: 5, endurance: 5, willpower: 5 }), minutes: 1440, party: true }) }),
]);
/** The dishes' templates (4.8's 685-688). */
export const DISH_TEMPLATES = Object.freeze(DISHES.map((d) => d.templateIndex));
/** A dish's row by its product id ('stew'), its recipe's id ('stew:north') or its template (685), or null. */
export const dishOf = (what) => (typeof what === 'number' ? DISHES.find((d) => d.templateIndex === what)
  : typeof what === 'string' ? DISHES.find((d) => d.id === what || what.startsWith(`${d.id}:`)) : null) ?? null;
/** @returns {Recipe} */
function dishRecipe(d, suffix, herbKey, word) {
  return Object.freeze({
    id: `${d.id}:${suffix}`, product: d.id, name: word ? `${d.name} (${word} ${d.herbName})` : d.name, kind: 'dish', family: 'dishes',
    profession: 'cooking', templateIndex: d.templateIndex, metal: null, material: 0, tier: d.tier, rank: TIER_RANKS[d.tier - 1],
    pattern: d.name, madeOf: word ? `${word} ${d.herbName}` : '',   // CRAFT2: the herb's way
    inputs: Object.freeze([...d.inputs, ...(herbKey ? [[herbKey, 1]] : [])].map(([key, n]) => Object.freeze({ key: String(key), n: Number(n) }))),
  });
}
/** EVERY RECIPE THE FIRE KNOWS, in its window's order: each herb dish twice (the northern herb's, the southern's), then
 *  the feast. */
/** @type {readonly Recipe[]} */
export const COOKING_RECIPES = Object.freeze(DISHES.flatMap((d) => (d.herb == null ? [dishRecipe(d, 'hearth', null, null)]
  : [dishRecipe(d, 'north', `p1:${d.herb}`, 'northern'), dishRecipe(d, 'south', `p2:${d.herb}`, 'southern')])));
/** The Cook (3.3: "+1 serving a dish"), Cooking's choice at 50; the Chef and the Provisioner its two at 100. */
export const COOK = 'cook', CHEF = 'chef', PROVISIONER = 'provisioner';
/** The Chef (3.3: "feasts last +50%"): a feast's time, half again. */
export const CHEF_FEAST = 1.5;
/**
 * THE COOK'S HAND (the record's `f`, the service's `products.hand`): what of the cook's choice at 100 a dish carries
 * wherever it goes - 1 a Chef's FEAST (it lasts half again, 3.3), 2 a Provisioner's dish (it never spoils, 3.3); none for
 * a Chef's other dishes (a Chef's choice is a feast's) and every other piece. DECIDED: the dish's, never its eater's - a
 * Chef's feast bought at the market lasts as long in the buyer's hands as in the Chef's.
 */
export const HAND_CHEF = 1, HAND_PROVISIONER = 2;
export function dishHand(r, spec100) {
  if (!r || r.kind !== 'dish') return null;
  if (spec100 === PROVISIONER) return HAND_PROVISIONER;
  if (spec100 === CHEF && dishOf(r.id)?.effect.party === true) return HAND_CHEF;
  return null;
}
/** A dish's effect's minutes - a Chef's feast half again. */
export const dishMinutes = (d, hand = null) => (d?.effect.party === true && hand === HAND_CHEF ? Math.round(d.effect.minutes * CHEF_FEAST) : d?.effect.minutes ?? 0);
/** DFU's attribute order (statMods.js STAT_KEYS_ORDER - pinned equal): a Fortify Attribute's subType. */
const STAT_SUBTYPE = Object.freeze({ strength: 0, intelligence: 1, willpower: 2, agility: 3, endurance: 4, personality: 5, speed: 6, luck: 7 });
/** The level a dish's effect is laid on at - the cast frame's own most (net/wire.js CAST_LEVEL_MAX, pinned equal), so
 *  a feast shared through ALLY-CAST's frame lasts exactly as long at the table as at its eater's. */
export const DISH_LEVEL = 30;
/** A dish's icon in the HUD's buff row (DFU's spell icons): the one every dish shows. */
export const DISH_ICON = 3;
/**
 * A DISH'S EFFECT AS DFU'S OWN BUNDLE (the effect engine's Fortify Attribute, type 9 - effects.js applySpell): a
 * CasterOnly spell record of Magic, a Fortify entry an attribute, each `magnitude` exactly (low = high, nothing a
 * level) and `minutes` rounds at DISH_LEVEL (durationMod x the level: a magic round is a game minute) - the shape the
 * cast frame carries (net/wire.js validCastData: every component a byte), so the feast reaches the party as it lands on
 * its eater. Null for a dish that raises no attribute (the Tart's stamina is the port's own, cookItems.js).
 */
export function dishSpell(d, hand = null) {
  const stats = Object.entries(d?.effect?.stats ?? {});
  if (!stats.length) return null;
  const minutes = dishMinutes(d, hand);
  return {
    name: d.name, element: 4, rangeType: 0, icon: DISH_ICON,
    effects: stats.map(([stat, n]) => ({
      type: 9, subType: STAT_SUBTYPE[stat], durationBase: 0, durationMod: Math.round(minutes / DISH_LEVEL), durationPerLevel: 1,
      chanceBase: 0, chanceMod: 0, chancePerLevel: 1, magnitudeBaseLow: n, magnitudeBaseHigh: n, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
    })),
  };
}
/** What a dish does, as its card and the fire's list say it: "Endurance +5 for 2 hours". */
export function dishEffectText(d, hand = null) {
  if (!d) return '';
  const m = dishMinutes(d, hand);
  const span = m === 1440 ? 'a day' : m === 2160 ? 'a day and a half' : `${m / 60} hours`;
  if (d.effect.stamina) return `Stamina lasts a fifth longer for ${span}`;
  const names = Object.keys(d.effect.stats).map((k) => k[0].toUpperCase() + k.slice(1));
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
  return `${list} +${Object.values(d.effect.stats)[0]} for ${span}${d.effect.party ? ', for the whole party at your table' : ''}`;
}

// ─── PROF10: JEWELCRAFTING (PROF0 3.3, 4.6, 9.3, 9.4; section 36) ────

/**
 * THE JEWELLER'S METALS (4.1: "Gold, Platinum (Jewelcrafting)"; 9.3: "1 Silver, Gold or Platinum"): DFU's own three, as
 * the Stores keep them (professionLaw METALS - the raw metal a vein gives, never the smith's Silver Ingot: a jeweller works
 * the precious metal itself), each the enchantment points it adds to the piece (9.3: "Silver +0%, Gold +10%, Platinum
 * +20%"). DECIDED - THE JEWELLER'S LADDER: a piece's tier is its metal's place on the jeweller's own track, not the
 * Mining tier the vein is struck at (4.1's 3, 4 and 5) - the three precious metals are Jewelcrafting's whole ladder, as
 * Iron to Daedric are the smith's, and at 4.1's tiers a Novice jeweller had nothing to make: Silver at the Novice's door
 * (tier 1, rank 0), Gold at the Apprentice's (tier 3, rank 25), Platinum at its own 4.1 tier (5, rank 55).
 */
export const JEWEL_METALS = Object.freeze([
  Object.freeze({ id: 'silver', key: 'metal:silver', word: 'Silver', tier: 1, points: 0 }),
  Object.freeze({ id: 'gold', key: 'metal:gold', word: 'Gold', tier: 3, points: 10 }),
  Object.freeze({ id: 'platinum', key: 'metal:platinum', word: 'Platinum', tier: 5, points: 20 }),
]);
/** The Cloth Amulet's cloth (9.3: "1 Linen"), Linen's own tier (1, rank 0); the Wand's woods (9.3: "Ironwood or
 *  Ghostwood Planks"), their own tier (6, rank 70) - the jeweller's crown piece. Neither adds points: 9.3 names the metals'. */
const JEWEL_CLOTH = Object.freeze({ id: 'linen', key: LINEN.key, word: '', tier: LINEN.tier, points: 0 });
const JEWEL_WOODS = Object.freeze(['ironwood', 'ghostwood'].map((w) => Object.freeze({ id: w, key: `plank:${w}`, word: woodName(w), tier: woodTier(w), points: 0 })));
/** THE GEMS A JEWELLER SETS (4.6): DFU's eight (professionLaw GEMS - the veins') and the sea's Pearl (DFU 77, Fishing's).
 *  The Siege-cracked Gem is none of them - a Lapidary's stands in for any (LAPIDARY, recipeInputs). */
export const JEWEL_GEMS = Object.freeze([...GEMS.map((g) => g.key), PEARL.key]);
/** A gem's word, DFU's template's name ('gem:ruby' Ruby - pinned equal to the rows, test/prof10_law.test.js). */
export const gemWord = (key) => (typeof key === 'string' && key.startsWith('gem:') ? key[4].toUpperCase() + key.slice(5) : '');
/**
 * THE EIGHT PIECES (9.3: "Ring - 1 Silver, Gold or Platinum (+ a gem); Mark - 1 metal + 1 gem; Bracelet - 2 metal; Bracer
 * - 2 metal + 1 Cured Leather; Amulet - 2 metal + 1 gem; Torc - 3 metal; Cloth Amulet - 1 Linen + 1 gem; Wand - 2 Ironwood
 * or Ghostwood Planks + 1 gem"), in 9.3's order: each DFU's own Jewellery template, read by its place in DFU's Jewellery
 * enum (itemTemplatesData.js GROUP_TEMPLATE_INDICES, IMPORTED - ItemEnums.cs: Amulet, Bracer, Ring, Bracelet, Mark, Torc,
 * Cloth_amulet, Wand), `word` its name (9.3's, DFU's template name - pinned equal: the service's bundle carries no item
 * table), `n` the units of its metal (or cloth, or planks), `gem` whether it takes one ('may' the Ring's "(+ a gem)",
 * 'yes', or none), `also` the rest.
 */
const jewelPiece = (id, word, enumAt, n, gem = null, also = []) => Object.freeze({ id, word, templateIndex: GROUP_TEMPLATE_INDICES.Jewellery[enumAt], n, gem, also: Object.freeze(also.map((a) => Object.freeze(a))) });
export const JEWEL_PIECES = Object.freeze([
  jewelPiece('ring', 'Ring', 2, 1, 'may'),
  jewelPiece('mark', 'Mark', 4, 1, 'yes'),
  jewelPiece('bracelet', 'Bracelet', 3, 2),
  jewelPiece('bracer', 'Bracer', 1, 2, null, [[CURED_LEATHER.key, 1]]),
  jewelPiece('amulet', 'Amulet', 0, 2, 'yes'),
  jewelPiece('torc', 'Torc', 5, 3),
  jewelPiece('clothamulet', 'Cloth Amulet', 6, 1, 'yes'),
  jewelPiece('wand', 'Wand', 7, 2, 'yes'),
]);
/** The bases a piece is made of: the Cloth Amulet its Linen, the Wand its two woods, every other piece the three metals. */
export const jewelBases = (pieceId) => (pieceId === 'clothamulet' ? [JEWEL_CLOTH] : pieceId === 'wand' ? [...JEWEL_WOODS] : [...JEWEL_METALS]);
/** @returns {Recipe} */
function jewelRecipe(p, base, gem) {
  return Object.freeze({
    id: `${p.id}:${base.id}${gem ? `:${gem.slice('gem:'.length)}` : ''}`, product: p.id, name: [base.word, gemWord(gem), p.word].filter(Boolean).join(' '),
    kind: 'jewel', family: 'jewellery', profession: 'jewelcrafting', templateIndex: p.templateIndex,
    metal: base.key.startsWith('metal:') ? base.key : null, wood: base.key.startsWith('plank:') ? base.key : null,
    cloth: base.key.startsWith('cloth:') ? base.key : null, gem: gem ?? null, material: 0, tier: base.tier, rank: TIER_RANKS[base.tier - 1],
    pattern: p.word, madeOf: [base.word || 'Linen', gemWord(gem)].filter(Boolean).join(' '),   // CRAFT2
    inputs: Object.freeze([[base.key, p.n], ...p.also, ...(gem ? [[gem, 1]] : [])].map(([key, n]) => Object.freeze({ key: String(key), n: Number(n) }))),
  });
}
/** EVERY RECIPE THE JEWELLER'S BENCH KNOWS, in its window's order: each piece in 9.3's order, each of its bases, the plain
 *  piece where it may go without a gem (the Ring), then a recipe a gem - DFU's eight and the Pearl. */
/** @type {readonly Recipe[]} */
export const JEWELCRAFTING_RECIPES = Object.freeze(JEWEL_PIECES.flatMap((p) => jewelBases(p.id).flatMap((base) => [
  ...(p.gem === 'yes' ? [] : [jewelRecipe(p, base, null)]),
  ...(p.gem ? JEWEL_GEMS.map((g) => jewelRecipe(p, base, g)) : []),
])));
/** Jewelcrafting's four (3.3): the Gemcutter and the Goldsmith at 50, the Master Jeweller and the Lapidary at 100. */
export const GEMCUTTER = 'gemcutter', GOLDSMITH = 'goldsmith', MASTER_JEWELLER = 'master-jeweller', LAPIDARY = 'lapidary';
/** A set gem's points (9.3: "a set gem +10%"), and a Gemcutter's more (3.3: "a set gem adds +10% enchantment points"). */
export const GEM_POINTS = 10;
export const GEMCUTTER_POINTS = 10;
/**
 * THE JEWELLER'S HAND (the record's `f`, the service's `products.hand` - the cook's column, PROF9): what of the jeweller's
 * choice at 50 a piece carries wherever it goes - 1 a GOLDSMITH's Silver piece (3.3: "Silver counts as Gold" - DECIDED: the
 * piece's points, and so its worth, are Gold's +10%; its rank stays Silver's, the metal it was made of), 2 a GEMCUTTER's
 * gemmed piece (its gem +20%, not +10%); none for a Goldsmith's Gold or Platinum, a Gemcutter's piece with no gem, and
 * every other piece. A choice at 50 is one of the two, so a piece carries one hand at most. DECIDED: the piece's, never
 * its wearer's - a Gemcutter's ring bought at the market holds its points in the buyer's hands.
 */
export const JEWEL_HAND_GOLDSMITH = 1, JEWEL_HAND_GEMCUTTER = 2;
export function jewelHand(r, spec50) {
  if (!r || r.kind !== 'jewel') return null;
  if (spec50 === GOLDSMITH && r.metal === JEWEL_METALS[0].key) return JEWEL_HAND_GOLDSMITH;
  if (spec50 === GEMCUTTER && r.gem) return JEWEL_HAND_GEMCUTTER;
  return null;
}
/** Whether hand `f` is one a recipe's piece may carry: a Goldsmith's on a Silver piece, a Gemcutter's on a gemmed one. */
export const jewelHandOk = (r, f) => r?.kind === 'jewel' && ((f === JEWEL_HAND_GOLDSMITH && r.metal === JEWEL_METALS[0].key) || (f === JEWEL_HAND_GEMCUTTER && !!r.gem));
/** THE POINTS A PIECE ADDS (9.3: "The piece's enchantment points: Silver +0%, Gold +10%, Platinum +20%, a set gem +10%
 *  (Gemcutter +10% more)"), percent over its DFU template's: its metal's (a Goldsmith's Silver Gold's), and its gem's. */
export function jewelPointsPct(r, hand = null) {
  if (!r || r.kind !== 'jewel') return 0;
  const metal = hand === JEWEL_HAND_GOLDSMITH && r.metal === JEWEL_METALS[0].key ? JEWEL_METALS[1].points : JEWEL_METALS.find((m) => m.key === r.metal)?.points ?? 0;
  return metal + (r.gem ? GEM_POINTS + (hand === JEWEL_HAND_GEMCUTTER ? GEMCUTTER_POINTS : 0) : 0);
}
/** A piece's enchantment points - its DFU template's (`templatePoints`, the Ring's 1,800) and the share it adds, floored:
 *  the budget DFU's item maker reads off the piece (systems/enchanting.js itemEnchantmentPower). */
export const jewelPoints = (r, templatePoints, hand = null) => Math.floor((Math.max(0, Number(templatePoints) || 0) * (100 + jewelPointsPct(r, hand))) / 100);
/** Whether a recipe takes a Lapidary's Siege-cracked Gem (3.3: "Siege-cracked Gems set as any gem"): a piece that sets a
 *  gem - the cracked one stands in for the recipe's, and the piece is the recipe's (its gem the one chosen). */
export const takesCracked = (r) => !!r && r.kind === 'jewel' && !!r.gem;
/** The specialisations at 100 that add Masterwork points (MASTERWRIGHT_POINTS): Smithing's Masterwright (3.3) and - PROF10
 *  - Jewelcrafting's Master Jeweller ("jewellery Masterwork chance +5%"). CRAFT3: both are the Smithing track's to
 *  choose now (one at 100), so each acts on its own discipline's work as it did - the Masterwright's on the smith's, the
 *  Master Jeweller's on the jeweller's (`r` the recipe; none asked, the smith's). */
export const masterworkSpec = (spec100, r = null) => (r?.profession === 'jewelcrafting' ? spec100 === MASTER_JEWELLER : spec100 === 'masterwright');

// ─── PROF10: THE FACET (PROF0 9.4) ───────────────────────────────────

/**
 * "The facet: a slow turn stopped where the gem catches the light (a 10-degree window)". DECIDED: a piece is cut in
 * `facets` facets (a gemmed piece `gemFacets` - the gem's crown its own), each a slow turn of the stone from 0 at
 * `degPerS` (a turn in six seconds) toward the light, which stands at a bearing the bench draws each facet (`lightLo` to
 * `lightHi` - never where the turn begins); the turn STOPPED while the stone stands within the window about the light -
 * `windowDeg` wide x the attribute band, widening by `masterWiden` at Master - catches it. Let pass `turns` times round
 * and the facet is lost. Every facet caught is a clean act. Each stop at least `gapS` after the last.
 */
export const FACET_ACT = Object.freeze({ facets: 3, gemFacets: 5, degPerS: 60, windowDeg: 10, masterWiden: 0.5, turns: 2, lightLo: 60, lightHi: 300, gapS: 0.3 });
/** Jewelcrafting's attribute pair - DECIDED: (WIL + LUC) / 2, the patience to let the stone turn and the fortune of where
 *  it breaks (no other act reads Luck), on Foraging's four bands. */
export const facetBand = ({ willpower, luck }) => actBand(Math.trunc((willpower + luck) / 2));
/** The facets a recipe's piece takes: a gemmed piece's five, every other piece's three. */
export const facetCount = (r) => (r?.gem ? FACET_ACT.gemFacets : FACET_ACT.facets);
/** The facet's window at a rank, x the band: degrees wide, centred on the light - 10 at Novice to 15 at Master. */
export const facetWindow = (rank, band = 1) => FACET_ACT.windowDeg * band * (1 + (FACET_ACT.masterWiden * Math.max(0, Math.min(PROF_RANK_MAX, rank))) / PROF_RANK_MAX);
/** The angle between two bearings, degrees: 0 to 180. */
export const bearingGap = (a, b) => { const d = Math.abs((((a - b) % 360) + 360) % 360); return Math.min(d, 360 - d); };

/** Every recipe, the anvil's, the workbench's and (PROF7) the loom's - PROF11: and the mason's bench's carvings; PROF9:
 *  and the fire's dishes; PROF10: and the jeweller's bench's pieces. */
export const RECIPES = Object.freeze([...SMITH_RECIPES, ...CARPENTRY_RECIPES, ...OUTFITTING_RECIPES, ...MASONRY_RECIPES, ...COOKING_RECIPES, ...JEWELCRAFTING_RECIPES]);
const BY_ID = new Map(RECIPES.map((r) => [r.id, r]));
/** A recipe by its id (`longsword:mithril`, `chain-cuirass:steel`, `kit:iron`, `table-small:oak`), or null. */
export const recipeById = (id) => (typeof id === 'string' ? BY_ID.get(id) ?? null : null);

// ─── CRAFT2: PATTERNS, NOT A MATRIX (Professions-Arc 41.2) ─────────────

/**
 * A RECIPE'S PATTERN: the piece it makes, whatever it is made of - its `product` (`longsword`, `chain-cuirass`,
 * `garment-163`, `arrows`, `stew`, `ring`). A station lists its patterns, and the material is chosen from what is held
 * (ui/profPages.js); the service's recipes stand as they are - a craft still asks `longsword:mithril`. FACT, pinned: no
 * product id is two professions'.
 * @param {Recipe|null} r
 */
export const recipePattern = (r) => r?.product ?? null;   // AUDIT24 one-home: not src/tools/depthCopyCheck.js's patternOf (a depth pattern, no kin)
/**
 * @typedef {{ id: string, name: string, recipes: readonly Recipe[] }} Pattern
 */
/** The patterns `list` makes, in its own order: each once (its first recipe's place), its recipes - its materials - in
 *  theirs. @param {readonly Recipe[]} list @returns {Pattern[]} */
export function patternsOf(list) {
  /** @type {Map<string, { id: string, name: string, recipes: Recipe[] }>} */
  const by = new Map();
  for (const r of list) {
    if (!by.has(r.product)) by.set(r.product, { id: r.product, name: r.pattern, recipes: [] });
    by.get(r.product)?.recipes.push(r);
  }
  return [...by.values()];
}
/** Every recipe unlocks by rank (the found ones come with the writs, PROF6); a recipe whose slice is to come (`later`)
 *  is named and never made. PROF11: a recipe that asks a specialisation (`spec` - the Sculptor's stone decor) opens
 *  only to a track standing under it at 100 (`specs`, specsAt's `{ 50, 100 }`) - asked without, it is shut. */
export const recipeOpen = (r, rank, specs = null) => !!r && !r.later && rank >= r.rank && (!r.spec || specs?.[100] === r.spec);
/** Whether a recipe may take a Heartwood for one of its planks (PROF0 25): it asks a plank and takes a quality. */
export const takesHeartwood = (r) => !!r && takesQuality(r) && r.inputs.some((i) => i.key.startsWith('plank:'));
/**
 * WHAT A CRAFT SPENDS (PROF0 25): the recipe's inputs - a Joiner's furniture at half the planks, rounded up; a Heartwood
 * standing in for one plank where the recipe takes one; PROF10: a Siege-cracked Gem for the gem (`cracked`, a Lapidary's).
 * Both ends spend and show by this.
 * @param {Recipe} r @param {{ heartwood?: boolean, joiner?: boolean, cracked?: boolean }} [opts]
 */
export function recipeInputs(r, { heartwood = false, joiner = false, cracked = false } = {}) {
  let inputs = r.inputs.map((i) => ({ key: i.key, n: joiner && r.family === 'furniture' && i.key.startsWith('plank:') ? Math.ceil(i.n / 2) : i.n }));
  if (heartwood && takesHeartwood(r)) {
    const p = /** @type {{ key: string, n: number }} */ (inputs.find((i) => i.key.startsWith('plank:')));
    p.n -= 1;
    inputs = [...inputs.filter((i) => i.n > 0), { key: HEARTWOOD.key, n: 1 }];
  }
  // PROF10: a Lapidary's Siege-cracked Gem stands in for the piece's gem (3.3: "set as any gem") - the asker's door to it
  // is the Lapidary's choice, which the service asks first (professions.js craftAtAnvil, `prof-lapidary`)
  if (cracked && takesCracked(r)) inputs = inputs.map((i) => (i.key === r.gem ? { key: SIEGE_GEM.key, n: i.n } : i));
  return inputs;
}

// ─── THE QUALITY (PROF0 9.2) ─────────────────────────────────────────

export const QUALITIES = Object.freeze(['crude', 'standard', 'fine', 'superior', 'masterwork']);
export const QUALITY_NAMES = Object.freeze(['Crude', 'Standard', 'Fine', 'Superior', 'Masterwork']);
export const MASTERWORK = 4;
/** The roll by the margin (the smith's rank minus the recipe's): each row's odds, Crude to Masterwork, of 100. */
export const QUALITY_ROWS = Object.freeze([
  Object.freeze({ upTo: 9, odds: Object.freeze([20, 60, 20, 0, 0]) }),
  Object.freeze({ upTo: 24, odds: Object.freeze([0, 50, 40, 10, 0]) }),
  Object.freeze({ upTo: 44, odds: Object.freeze([0, 20, 50, 28, 2]) }),
  Object.freeze({ upTo: Infinity, odds: Object.freeze([0, 0, 40, 52, 8]) }),
]);
/** Masterwright's points of Masterwork (3.3), taken off the row's lowest quality. */
export const MASTERWRIGHT_POINTS = 5;
/** The odds a margin rolls on, Masterwright's points laid in. */
export function qualityOdds(margin, { masterwright = false } = {}) {
  const odds = [...QUALITY_ROWS.find((r) => Math.max(0, margin) <= r.upTo).odds];
  if (masterwright) {
    let left = MASTERWRIGHT_POINTS;
    for (let q = 0; q < MASTERWORK && left > 0; q++) { const take = Math.min(left, odds[q]); odds[q] -= take; left -= take; }
    odds[MASTERWORK] += MASTERWRIGHT_POINTS - left;
  }
  return odds;
}
/** The quality a unit `u` in [0, 1) rolls on the odds. */
export function rollQuality(u, odds) {
  let at = u * 100;
  for (let q = 0; q < odds.length; q++) { if (at < odds[q]) return q; at -= odds[q]; }
  return odds.length - 1;
}
/** The steps a craft takes, each source at most one (PROF0 9.2): the clean act (the honest bound, 5.1), the family's
 *  specialisation (Weaponsmith the weapons, Armoursmith the plate, the chain and the shields; PROF4: Bowyer the bows;
 *  PROF7: Tailor the clothing, Leatherworker the leather armour), a Warforged ingot, a Heartwood or (PROF7) Hardened
 *  Leather - one step between them (9.2's "Heartwood or a Warforged ingot"; 9.3's "the tier 4-6 leathers' step"). */
export function qualitySteps(r, { clean = false, spec50 = null, heartwood = false } = {}) {
  let steps = clean ? 1 : 0;
  if ((spec50 === 'weaponsmith' && r.family === 'weapons') || (spec50 === 'armoursmith' && r.family === 'armour')
    || (spec50 === 'bowyer' && r.family === 'bows') || (spec50 === 'tailor' && r.family === 'clothing')
    || (spec50 === 'leatherworker' && r.family === 'leather')) steps++;
  if (r.metal === WARFORGED || r.leather === HARDENED_LEATHER.key || (heartwood && takesHeartwood(r))) steps++;
  return steps;
}
/** The quality a craft is made at: the roll, then the steps; nothing past Masterwork. */
export const craftQuality = (rolled, steps) => Math.min(MASTERWORK, rolled + Math.max(0, steps));

/** What a quality does to the piece (PROF0 9.2): its condition's and its weight's multipliers, and its Loot Rarity
 *  roll; the maker's mark is Masterwork's. */
export const QUALITY_EFFECTS = Object.freeze([
  Object.freeze({ condition: 0.75, weight: 1, rarity: null }),
  Object.freeze({ condition: 1, weight: 1, rarity: null }),
  Object.freeze({ condition: 1.15, weight: 0.95, rarity: null }),
  Object.freeze({ condition: 1.3, weight: 0.9, rarity: 'magic' }),
  Object.freeze({ condition: 1.3, weight: 0.9, rarity: 'rare' }),
]);
/** A tool's life by its quality (FORAGE0 14.7): Crude 37 uses, Standard 50, Fine 57, Superior and Masterwork 65. */
export const TOOL_LIFE = Object.freeze([37, 50, 57, 65, 65]);
/** Whether a recipe's piece takes a quality at all: a Repair Kit does not (it is measured by its work); PROF4: nor
 *  arrows (DFU mints a quiver at condition 0 - nothing for a quality to act on) nor the Ram Kit (a siege work). */
export const takesQuality = (r) => r.kind !== 'kit' && r.kind !== 'arrows' && r.kind !== 'siege' && r.kind !== 'dish';   // PROF9: nor a dish - it is eaten, and its worth is its effect
/** PROF4: a Master Joiner's furniture carries the maker's mark at any quality (PROF0 3.3); a Masterwork always does. */
export const carriesMark = (r, quality, spec100 = null) => quality === MASTERWORK || (r?.family === 'furniture' && spec100 === 'master-joiner');

// ─── THE XP AND THE COUNT (PROF0 3.2, 3.3) ───────────────────────────

export const CRAFT_XP_PER_TIER = 20;
export const FIRST_CRAFT_XP = 500;
/** A craft's XP (Smithing's, Carpentry's or Outfitting's): 20 x its tier - a quarter for a recipe more than two tiers below the rank's top - and 500 the
 *  first time the character makes it (where firstCraftPays). */
export function craftXp(tier, rank, first) {
  const xp = CRAFT_XP_PER_TIER * tier;
  return (tier < topTierOf(rank) - 2 ? Math.floor(xp / 4) : xp) + (first ? FIRST_CRAFT_XP : 0);
}
/**
 * AUDIT 32 S1 (Mac: "Whatever you think is best"): whether a recipe's first craft lays on FIRST_CRAFT_XP - not for a
 * recipe made wholly of goods only a counter sells (professionLaw COUNTER_ONLY, the Weavers' Linen and Wool). 3.2's +500
 * rewards a recipe learnt from the world's goods; the counter's supply has no end, and its 152 recipes (144 garments,
 * the rugs and tapestries, the Fishing-Net) bought a fresh character Outfitting 87 for 811 Marks and no hide. A boot (a bolt and a
 * Cured Leather) and every other recipe keep it - a gatherer's own leather and planks earn what 3.2 promised them.
 * @param {Recipe|null} r
 */
export const firstCraftPays = (r) => !!r && !(r.inputs.length > 0 && r.inputs.every((i) => COUNTER_ONLY.includes(i.key)));
/**
 * CRAFT2 (Professions-Arc 41.2, Mac: "Lets do it"): WHAT A FIRST CRAFT IS COUNTED BY - its PATTERN AT ITS TIER
 * (`longsword@6`): the first Adamantium, Ebony, Orcish or Warforged Longsword is the first of tier 6, whichever is made, and
 * a track climbs by making what is wanted, not by walking the matrix of a piece and its every material. It was each
 * recipe's own id; it holds both its exceptions: AUDIT PROF-541 J7 (Mac, 2026-10-03: "Once per piece and base") - a
 * jewel's base is its tier (Silver 1, Gold 3, Platinum 5), so `ring@3` is `ring:gold` whichever gem is set first - and
 * AUDIT PROF-541 R2-S7 - a dish's two herbs' ways are one dish at one tier (`stew@1`). The Wand's two woods share tier 6:
 * one first now, not two. Null for no recipe. AUDIT 32 S1 stands beside it (firstCraftPays): FACT, pinned - no pattern at
 * a tier holds both a recipe that pays and one wholly of the counter's goods.
 * @param {Recipe|null} r
 */
export const firstCraftKey = (r) => (!r ? null : `${r.product}@${r.tier}`);
/** CRAFT2: the recipes a first craft is counted among - every recipe of its pattern at its tier, in the table's order (the
 *  service's `recipe IN (...)`: any one of them made before, and this one is no first). At most 18 (the Wand at tier 6:
 *  two woods, nine gems). */
const KIN = new Map();
for (const r of RECIPES) KIN.set(firstCraftKey(r), [...(KIN.get(firstCraftKey(r)) ?? []), r.id]);
export const firstCraftKin = (r) => (!r ? [] : Object.freeze([...(KIN.get(firstCraftKey(r)) ?? [r.id])]));
/** The pieces a craft makes: one, a Quartermaster's kit two (3.3); PROF9: a Cook's dish two (3.3: "+1 serving a dish" -
 *  a choice at 50). */
export const craftCount = (r, spec100, spec50 = null) => ((r.kind === 'kit' && spec100 === 'quartermaster') || (r.kind === 'dish' && spec50 === COOK) ? 2 : 1);

// ─── THE HEAT (PROF0 9.4) ────────────────────────────────────────────

/**
 * The ingot's glow rises and falls, `periodS` a breath; three strikes, each at least `gapS` after the last, and a strike
 * while the glow stands in the band - from `bandLo`, `bandW` wide x the attribute band - is a hit. Three hits are a
 * clean act.
 */
export const HEAT_ACT = Object.freeze({ strikes: 3, periodS: 2.0, bandLo: 0.62, bandW: 0.2, gapS: 0.35 });
/** Smithing's attribute pair (PROF0 24): (STR + AGI) / 2, on Foraging's four bands. */
export const heatBand = ({ strength, agility }) => actBand(Math.trunc((strength + agility) / 2));
/** The glow at `t` seconds into the act, 0 cold to 1 white: it starts cold and breathes. */
export const glowAt = (t) => 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / HEAT_ACT.periodS);
/** The band a heat act is struck in: [lo, hi], never past white. */
export function heatWindow(band = 1) {
  const w = HEAT_ACT.bandW * band;
  const hi = Math.min(1, HEAT_ACT.bandLo + w);
  return [hi - w, hi];
}

// ─── THE MAKER'S MARK AND THE PROVENANCE (PROF0 9.1, 9.2) ────────────

/** A provenance id: 16 hex digits from the service's CSPRNG, unique across the server. */
export const PROVENANCE_RE = /^[0-9a-f]{16}$/;
// ─── THE PLANE (PROF0 9.4, 25) ───────────────────────────────────────

/**
 * The grain runs across the board, a gentle wave its own each act (`waveA` of the half-height, `waves` along it); the
 * player presses at its head (x at most `headX`) and draws to its foot (`footX`). A pass whose mean deviation from the
 * grain is within the tolerance - `tol` of the half-height, x the attribute band, widening by `masterWiden` at Master -
 * and that took `minS` to `maxS` is clean.
 */
/** AUDIT 30 A1: `step` - the widest stretch of the board one sample stands for; a stroke's jump between two pointer events is
 *  measured along its chord at this spacing, so a flick is scored as the straight line it drew. */
export const PLANE_ACT = Object.freeze({ tol: 0.18, masterWiden: 0.5, minS: 1.2, maxS: 4, headX: 0.08, footX: 0.98, waveA: 0.35, waves: 1.5, step: 0.025 });
/** Carpentry's attribute pair (PROF0 25): (AGI + WIL) / 2, a steady hand, on Foraging's four bands. */
export const planeBand = ({ agility, willpower }) => actBand(Math.trunc((agility + willpower) / 2));
/** The plane's tolerance at a rank, x the band. */
export const planeTolerance = (rank, band = 1) => PLANE_ACT.tol * band * (1 + PLANE_ACT.masterWiden * Math.max(0, Math.min(100, rank)) / 100);
/** The grain's line at `x` in [0, 1] for an act's `phase`: a share of the half-height, up positive. */
export const grainAt = (x, phase) => PLANE_ACT.waveA * Math.sin(2 * Math.PI * (PLANE_ACT.waves * x + phase));

// ─── THE STITCH (PROF0 9.4, 29) ──────────────────────────────────────

/**
 * PROF7 - "presses on a beat, eight in a row": the needle's beat comes every `beatS`; a stitch pressed while the beat
 * stands within the band - `bandW` of the beat wide, centred on it, x the attribute band - is on the beat. Eight
 * stitches, each at least `gapS` after the last; all eight on the beat are a clean act.
 */
export const STITCH_ACT = Object.freeze({ stitches: 8, beatS: 0.75, bandW: 0.2, gapS: 0.25 });
/** Outfitting's attribute pair (PROF0 29): (AGI + SPD) / 2 - a quick, sure hand on the beat, Foraging's four bands. */
export const stitchBand = ({ agility, speed }) => actBand(Math.trunc((agility + speed) / 2));
/** Where the beat stands at `t` seconds, 0 to 1 - the beat itself at 0 (and 1). */
export const beatAt = (t) => ((t / STITCH_ACT.beatS) % 1 + 1) % 1;
/** Whether the beat at phase `u` is within a band `w` wide centred on it. */
export const onBeat = (u, w) => u <= w / 2 || u >= 1 - w / 2;

// ─── PROF11: THE CHISEL (PROF0 9.4) ──────────────────────────────────

/**
 * "Strikes on marked lines that the glint's rule moves": the stone at the bench is scored with `lines` lines (the
 * glint's five points, MINE_ACT), one MARKED at a time; the mark stands `markS` (`masterMarkS` at Master) x the
 * attribute band and then moves to another line - and it moves after every strike too: the Pick-Axe's glint's rule
 * (PROF0 5.2), a line for a point. A strike lands on the line the chisel is set on; on the marked line it is true. A
 * cut or a mix takes `strikes` (Mining's tier 1-2 count - the bench's stone is tiers 1-2), a carving `carveStrikes`
 * (Mining's deepest veins', 5-6 - the Sculptor's finest work); each at least `gapS` after the last (the glint's swing);
 * every one true is a clean act.
 */
export const CHISEL_ACT = Object.freeze({ lines: 5, strikes: 4, carveStrikes: 7, markS: 1.2, masterMarkS: 2.0, gapS: 0.45 });
/** Masonry's attribute pair - DECIDED: (STR + END) / 2, the mallet's weight and the arm that keeps it up all day (no
 *  other act reads Endurance), on Foraging's four bands. */
export const chiselBand = ({ strength, endurance }) => actBand(Math.trunc((strength + endurance) / 2));
/** The strikes a work or a recipe's chisel takes: a carving's (the stone decor) seven, a cut's or a mix's four. */
export const chiselStrikes = (r) => (r?.family === 'stonework' ? CHISEL_ACT.carveStrikes : CHISEL_ACT.strikes);
/** How long a mark stands, seconds: 1.2 (2.0 at Master) x the band - the glint's own numbers. */
export const chiselMarkS = (rank, band = 1) => (rank >= PROF_RANK_MAX ? CHISEL_ACT.masterMarkS : CHISEL_ACT.markS) * band;

// ─── PROF11: THE BENCH'S XP (PROF0 3.2) ─────────────────────────────

/**
 * Masonry's tier for a work's XP, at a rank. DECIDED - XP FOLLOWS THE RANK (Mac, PROF8: "XP follows your rank"): the
 * bench's stone sits on tiers 1-2 and nothing higher (4.5), so at the craft's own tier a quarter falls on it from rank 40
 * (Cut Stone) and 55 (Mortar) and Masonry could never climb to its Sculptor or its Fortifier (100); worked at the rank's
 * own tier, as a haul is, it climbs as every other craft does. The recipe's tier still gates its rank (workOpen).
 */
export const masonTier = (rank) => topTierOf(rank);
/**
 * A MASON'S WORK's XP (3.2: "a craft 20 x tier x units, +500 the first time a recipe is made"): 20 x the rank's tier
 * (masonTier) a unit of work - a cut, a mix - never a product (a Quarryman's second Cut Stone earns nothing more, as a
 * Quartermaster's second ingot does not, PROF0 24); half again for a CLEAN chisel (DECIDED: the Stores keep no quality,
 * so the clean act's step is the clean act's +50% - 3.2's harvest law, Mining's at the rock, PROF0 23); and 500 the
 * first time the character does it (where firstCraftPays - the service reads `first` in its decision).
 */
export function masonXp(units, rank, { clean = false, first = false } = {}) {
  let xp = CRAFT_XP_PER_TIER * masonTier(rank) * (Number.isSafeInteger(units) && units > 0 ? units : 0);
  if (clean) xp = Math.floor((xp * 3) / 2);
  return xp + (first ? FIRST_CRAFT_XP : 0);
}

// ─── PROF9: THE PAN (PROF0 9.4) ──────────────────────────────────────

/**
 * "The fire: take the pan off in its window (the Skillet's is wider)". DECIDED: a dish is cooked in `pans` pans in turn (a
 * feast `feastPans` - a table's worth), each on the fire from cold: its heat climbs from 0 (raw) to 1 (burnt) in
 * `burnS` seconds x a pace the fire draws each pan (`paceLo` to `paceHi` - no two pans cook alike), and the pan is DONE
 * while its heat stands in the window - from `lo`, `w` wide x the attribute band, widening by `masterWiden` at Master,
 * and x `skillet` with C&C's Skillet in the pack. A pan taken off in its window is done; taken off early it is raw; left
 * to 1 it burns and the next goes on. Every pan done is a clean act. Each take at least `gapS` after the last.
 */
export const PAN_ACT = Object.freeze({ pans: 3, feastPans: 5, burnS: 3.0, lo: 0.6, w: 0.12, masterWiden: 0.5, skillet: 1.5, paceLo: 0.85, paceHi: 1.2, gapS: 0.3 });
/** Cooking's attribute pair - DECIDED: (INT + PER) / 2, the cook's judgement and a host's touch (no other act reads
 *  Personality), on Foraging's four bands. */
export const panBand = ({ intelligence, personality }) => actBand(Math.trunc((intelligence + personality) / 2));
/** The pans a recipe's dish takes: a feast's five, every other dish's three. */
export const panCount = (r) => (dishOf(r?.id ?? '')?.effect.party === true ? PAN_ACT.feastPans : PAN_ACT.pans);
/** The pan's window at a rank, x the band, x C&C's Skillet: [lo, hi], never past 0.95 (a pan is never done at burnt). */
export function panWindow(rank, band = 1, skillet = false) {
  const w = PAN_ACT.w * band * (1 + (PAN_ACT.masterWiden * Math.max(0, Math.min(PROF_RANK_MAX, rank))) / PROF_RANK_MAX) * (skillet ? PAN_ACT.skillet : 1);
  return [PAN_ACT.lo, Math.min(0.95, PAN_ACT.lo + w)];
}

// ─── PROF9: COOKING'S XP (PROF0 3.2) ─────────────────────────────────

/**
 * A DISH's XP (3.2: "a craft 20 x tier x units, +500 the first time a recipe is made"). DECIDED - XP FOLLOWS THE RANK
 * (Mac, PROF8; Masonry's law, PROF11): four dishes, three of them tiers 1-2, would be quartered from rank 40 and Cooking
 * could never reach its Chef - so a dish is cooked at the rank's own tier, 20 x it a cook (never a serving: a Cook's
 * second earns nothing more, as a Quartermaster's second kit does not), half again for a CLEAN PAN (DECIDED: a dish
 * takes no quality, so the clean act's step is its +50% - the bench's law). The first time's 500 is the service's to lay
 * on, in its decision (firstCraftPays).
 * PROF12 (Seats-Arc 7.5: the Apothecary - "members in Alchemy, Cooking, Jewelcrafting here: +1 step" a tier): DECIDED, a
 * dish takes no quality, so a hall's step is what the clean pan's step is - half again of the dish's XP, a step each
 * (`steps`, the Apothecary's tiers where the cook's guild holds the town): a clean pan in a tier-2 Apothecary's town
 * two and a half times the plain dish's.
 */
export function cookXp(rank, { clean = false, steps = 0 } = {}) {
  const xp = CRAFT_XP_PER_TIER * topTierOf(rank);
  const n = (clean ? 1 : 0) + (Number.isSafeInteger(steps) && steps > 0 ? steps : 0);
  return Math.floor((xp * (2 + n)) / 2);
}

/** A maker's name as the mark keeps it: the character's name at the moment of making (PROF0 18), trimmed, at most 32. */
export const MAKER_MAX = 32;
export function makerName(name) {
  if (typeof name !== 'string') return null;
  // AUDIT 30 L3: a lone surrogate dropped before the cut (by code point - no lookbehind, SAFARI1), and a pair the cut
  // would split dropped whole - a name as the record signs it is well-formed, so it stays in its bound and reads back
  const whole = Array.from(name.replace(/[\u0000-\u001f\u007f]/g, '')).filter((ch) => !/^[\ud800-\udfff]$/.test(ch)).join('').trim();
  let n = whole.slice(0, MAKER_MAX);
  if (/[\ud800-\udbff]$/.test(n)) n = n.slice(0, -1);
  n = n.trim();
  return n.length ? n : null;
}
/** TEXT-F1 (2026-10-07, Mac: "Any human input elements need filtering"): A MARK AS IT MAY BE SIGNED AND SHOWN - makerName's,
 *  and none whose words the filter catches (net/nameFilter.js textCaught): a character's name is the player's own
 *  typing, and the mark carries it to every holder of the piece, every shelf and every market. Null for none - the piece
 *  is made, unmarked. makerName stays the SHAPE law (decorLaw.js reads it to tell a forged mark from a true one). */
export function makerMark(name) {
  const n = makerName(name);
  return n && !textCaught(n) ? n : null;
}
/** A Masterwork's name: "Silverthorn's Mithril Longsword". */
export const markedName = (maker, name) => `${maker}'s ${name}`;
/** The lines a crafted piece's tooltip and card carry above its powers (PROF0 9.2): its quality and its maker - or a
 *  Repair Kit's work. Nothing for a piece no anvil or workbench made - CRAFT4: but a found piece a temper raised, its quality. AUDIT PROF-541 R2-C4: `points` a jewel's points
 *  as the item maker reads them (systems/enchanting.js craftedJewelPoints, client-side - this law is the Worker's too),
 *  the item's own where none is handed in. */
export function pieceLines(item, points = null) {
  if (item?.fieldKit === true) return [`Mends ${Math.round(FIELD_KIT_REPAIR * 100)}% of a weapon's or armour's condition, up to ${Math.round(KIT_CEILING * 100)}%, once`];   // REPAIR-EASE: a looted kit has no provenance; KIT-CEILING
  // CRAFT4: a found piece a temper raised says its quality (temperLaw.js - Fine or Superior; a found piece is Standard)
  if (!item || typeof item.provenance !== 'string' || !PROVENANCE_RE.test(item.provenance)) return Number.isInteger(item?.quality) && item.quality > 1 && item.quality < MASTERWORK ? [QUALITY_NAMES[item.quality]] : [];
  if (Number.isInteger(item.kitMetal)) return [`Mends a quarter of a ${METAL_WORDS[item.kitMetal] ?? ''} piece's condition, up to ${Math.round(KIT_CEILING * 100)}%, once`];   // KIT-CEILING
  if (recipeById(item.recipe)?.kind === 'dish') {   // PROF9: a dish says what it does, its keeping and its cook
    const out = [dishEffectText(dishOf(item.recipe), item.chef === true ? HAND_CHEF : null)];
    if (item.noRot === true) out.push('Never spoils');
    if (typeof item.maker === 'string' && item.maker) out.push(`Cooked by ${item.maker}`);
    return out;
  }
  const out = [];
  if (Number.isInteger(item.quality) && item.quality >= 0 && item.quality <= MASTERWORK) out.push(QUALITY_NAMES[item.quality]);
  if (typeof item.maker === 'string' && item.maker) out.push(`Made by ${item.maker}`);
  // PROF10: a piece of jewellery says the points its metal and its gem gave it - the budget the item maker reads
  const pts = Number.isSafeInteger(points) ? points : item.enchantmentPoints;
  if (recipeById(item.recipe)?.kind === 'jewel' && Number.isSafeInteger(pts)) out.push(`${pts.toLocaleString('en-US')} enchantment points`);
  return out;
}
