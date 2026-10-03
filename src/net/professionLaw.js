// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF1 (2026-09-28, Mac: "Begin!"; "Life skills will utilize things
// like tree chopping, picking up ingredients, fishing, etc. Active player
// involvement and actual UI integration for life skills") - THE
// PROFESSIONS' LAW: the thirteen, their ranks and XP, the tiers, the
// specialisations, the day's cap, the Stores, Herbalism's two acts, the
// materials the Stores hold, and the Court writs. The record is
// bible/06-Systems/Professions-Arc.md (PROF0) 3, 5, 7, 11 and 22.
//
// ONLINE ONLY. Daggerfall has no crafting skill and its three makers use
// none (PROF0 law 1); a profession is a Ledger A departure, online's
// alone, and every point of it is the account service's to credit - it
// performed the harvest, the delivery (server-account/src/professions.js).
//
// A MATERIAL IS DFU'S OWN ITEM wherever DFU has one (law 2). An herb is
// a plant template in one of DFU's two plant groups - PlantIngredients1,
// named "(northern)" below template 18, and PlantIngredients2,
// "(southern)" (systems/itemInfo.js itemNameParts) - and a two-group
// plant takes its pixel's region's (FALL.EXE's REGION_RACES: a Breton
// region northern, a Redguard one southern), so the Stores keep such a
// plant as two materials and a withdrawal is the item DFU's own loot
// would have made. The names are DFU's, read on the client through
// templateByIndex; nothing here re-types one.
//
// Pure: no clock, no DOM, no network. Both ends read it.
// ═══════════════════════════════════════════════════════════════════

import { REGION_RACES } from '../formats/mapsTables.js';
import { attributeBand } from '../systems/foragingCore.js';   // Foraging's bands, one home (FORAGE0 14.4)
import { renownRate } from './renown.js';   // MERGE 2: a writ's Renown at every source's rate (RENOWN-ACCOUNT)

// ─── THE THIRTEEN (PROF0 3.1) ────────────────────────────────────────

/** Every profession, in the Professions tab's order: the five that gather, then the eight that craft. */
export const PROFESSIONS = Object.freeze([
  Object.freeze({ id: 'mining', name: 'Mining', kind: 'gathering' }),
  Object.freeze({ id: 'logging', name: 'Logging', kind: 'gathering' }),
  Object.freeze({ id: 'herbalism', name: 'Herbalism', kind: 'gathering' }),
  Object.freeze({ id: 'hunting', name: 'Hunting', kind: 'gathering' }),
  Object.freeze({ id: 'fishing', name: 'Fishing', kind: 'gathering' }),
  Object.freeze({ id: 'smithing', name: 'Smithing', kind: 'crafting' }),
  Object.freeze({ id: 'outfitting', name: 'Outfitting', kind: 'crafting' }),
  Object.freeze({ id: 'carpentry', name: 'Carpentry', kind: 'crafting' }),
  Object.freeze({ id: 'masonry', name: 'Masonry', kind: 'crafting' }),
  Object.freeze({ id: 'alchemy', name: 'Alchemy', kind: 'crafting' }),
  Object.freeze({ id: 'enchanting', name: 'Enchanting', kind: 'crafting' }),
  Object.freeze({ id: 'cooking', name: 'Cooking', kind: 'crafting' }),
  Object.freeze({ id: 'jewelcrafting', name: 'Jewelcrafting', kind: 'crafting' }),
]);
/** @type {Map<string, { id: string, name: string, kind: string }>} */
const BY_ID = new Map(PROFESSIONS.map((p) => [p.id, p]));
export const isProfession = (id) => typeof id === 'string' && BY_ID.has(id);
export const professionName = (id) => BY_ID.get(id)?.name ?? '';
export const isGathering = (id) => BY_ID.get(id)?.kind === 'gathering';

// ─── RANKS, XP, TIERS (PROF0 3.2) ────────────────────────────────────

/** A track runs 0 to 100. */
export const PROF_RANK_MAX = 100;
/** The rank names, each from the rank it starts at. */
export const RANK_NAMES = Object.freeze([
  Object.freeze(['Novice', 0]), Object.freeze(['Apprentice', 25]), Object.freeze(['Journeyman', 50]),
  Object.freeze(['Expert', 75]), Object.freeze(['Master', 100]),
]);
/** The XP a track holds at rank `n`: 10 x n^2 (Apprentice 6,250; Journeyman 25,000; Expert 56,250; Master 100,000). */
export const xpForRank = (n) => 10 * n * n;
/** The most XP a track holds - a Master's. */
export const PROF_XP_MAX = xpForRank(PROF_RANK_MAX);
/** A track's rank: the highest `n` whose XP it holds, 0 to 100 - exact: every 10 x n^2 is a perfect square's tenfold,
 *  whose root a double answers exactly (pinned over all 101 ranks and the XP one under each). */
export function rankOfXp(xp) {
  const x = Number.isFinite(xp) ? Math.max(0, Math.min(PROF_XP_MAX, Math.floor(xp))) : 0;
  return Math.floor(Math.sqrt(x / 10));
}
/** A rank's name: "Novice" to "Master". */
export const rankName = (rank) => RANK_NAMES.reduce((name, [n, at]) => (rank >= at ? n : name), RANK_NAMES[0][0]);
/** The rank each tier needs - tier t's is TIER_RANKS[t - 1] (PROF0 3.2's ladder). */
export const TIER_RANKS = Object.freeze([0, 10, 25, 40, 55, 70, 90]);
export const TIER_MAX = TIER_RANKS.length;
/** Whether a rank may work tier `tier`. */
export const tierOpen = (rank, tier) => Number.isSafeInteger(tier) && tier >= 1 && tier <= TIER_MAX && rank >= TIER_RANKS[tier - 1];
/** The highest tier a rank works. */
export const topTierOf = (rank) => TIER_RANKS.filter((r) => rank >= r).length;

/** A harvest's XP: 15 x tier, +50% for a clean act, a quarter for a node more than two tiers below the rank's top. */
export const HARVEST_XP_PER_TIER = 15;
export function harvestXp(tier, rank, clean) {
  let xp = HARVEST_XP_PER_TIER * tier;
  if (clean) xp = Math.floor((xp * 3) / 2);
  if (tier < topTierOf(rank) - 2) xp = Math.floor(xp / 4);
  return xp;
}
/** HERB-XP (2026-10-01 part four - Mac: "XP follows your rank"): a herb is picked at the highest tier the rank opens, as
 *  a haul is worked (haulTier). Herbs stop at tier 3, and harvestXp quarters a tier more than two below the rank's, so
 *  past rank 70 every herb was worth a quarter (3, 11 and 16 XP) and 70 to 100 took 107 full days. The herb's own tier
 *  still opens it (tierOpen) and is the harvest's; the Basket's food keeps its tier. */
export const herbXpTier = (rank) => topTierOf(rank);
/** A writ's XP: twice its Mark value - its pay (PROF0 3.2), to the profession its material is gathered by. */
export const writXp = (pay) => 2 * pay;
/** The crafter's limit (PROF0 3.2): two crafts above Journeyman. The crafts come with PROF3; the tab says it now. */
export const CRAFTS_ABOVE_JOURNEYMAN = 2;
export const JOURNEYMAN_RANK = 50;

// ─── SPECIALISATIONS (PROF0 3.3) ─────────────────────────────────────

/** The ranks a choice opens at. */
export const SPEC_RANKS = Object.freeze([50, 100]);
/** A change of mind: 1,000 Marks burnt, and the new one takes effect a week later (the old stands until then). */
export const RESPEC = Object.freeze({ marks: 1000, days: 7 });
/** `later`: the slice the choice waits for - named on its card, never chosen until then (AUDIT 29 A17). */
const spec = (id, name, text, later = null) => Object.freeze(later ? { id, name, text, later } : { id, name, text });
const pair = (a, b) => Object.freeze([a, b]);
/** Every profession's two choices at 50 and at 100 - the record's words. PROF1 gives Herbalism's their effect; the
 *  others take effect with their professions' slices (a track there holds no XP until then). */
export const SPECIALISATIONS = Object.freeze({
  mining: Object.freeze({
    50: pair(spec('prospector', 'Prospector', 'Surface veins within 200 m are marked on the compass; gems come a tenth more often.'),
      spec('deep-delver', 'Deep Delver', 'Dungeon veins yield +50%.')),
    100: pair(spec('motherlode-sense', 'Motherlode Sense', 'Motherlode warnings come 30 minutes ahead, not 10.'),   // PROF2b: its Motherlodes built - chosen as any
      spec('stonebreaker', 'Stonebreaker', 'Quarrying yields Cut Stone directly.')),
  }),
  logging: Object.freeze({
    50: pair(spec('lumberjack', 'Lumberjack', 'Two chops fewer a tree (three at least).'),
      spec('forester', 'Forester', 'Heartwood chance x2.')),
    100: pair(spec('charcoal-burner', 'Charcoal Burner', 'A log burns to 2 Charcoal, not 1.'),
      spec('timberwright', 'Timberwright', 'A log saws to 3 planks, not 2.')),
  }),
  herbalism: Object.freeze({
    50: pair(spec('gardener', 'Gardener', 'Common herbs yield +1.'),
      spec('botanist', 'Botanist', 'The steady window +50%.')),
    100: pair(spec('seasonal-eye', 'Seasonal Eye', 'Off-season herbs, at half the yield.'),
      spec('apothecarys-friend', "Apothecary's Friend", 'Every herb you pick counts as unbruised.')),
  }),
  hunting: Object.freeze({
    50: pair(spec('tracker', 'Tracker', 'Animals within 100 m are marked.'),
      spec('tanner', 'Tanner', 'Hides cure 1:1, not 2:1.')),
    100: pair(spec('trophy-hunter', 'Trophy Hunter', 'A trophy decor piece from a tier 5+ kill.', 'trophy'),   // PROF7: no piece to stand as
      spec('butcher', 'Butcher', 'Meat x2, and it spoils half as fast.')),
  }),
  fishing: Object.freeze({
    50: pair(spec('angler', 'Angler', 'The tug window +40%.'),
      spec('netter', 'Netter', "A school's haul +2 fish, not +1.")),
    100: pair(spec('deep-sea', 'Deep-Sea', "The sea's Pearl and Slaughterfish chances x2."),
      spec('pearl-diver', 'Pearl Diver', 'Pearl chance x3.')),
  }),
  smithing: Object.freeze({
    50: pair(spec('weaponsmith', 'Weaponsmith', 'Weapons +1 quality step.'),
      spec('armoursmith', 'Armoursmith', 'Armour +1 quality step.')),
    100: pair(spec('masterwright', 'Masterwright', 'Masterwork chance +5%.'),
      spec('quartermaster', 'Quartermaster', 'Ingots and repair kits x2.')),
  }),
  outfitting: Object.freeze({
    50: pair(spec('tailor', 'Tailor', 'Clothing +1 quality step.'),
      spec('leatherworker', 'Leatherworker', 'Leather armour +1 quality step.')),
    100: pair(spec('couturier', 'Couturier', 'Two-colour dyes.', 'two-colour'),   // PROF7: DFU's cloth takes one dye
      spec('saddler', 'Saddler', 'A wagon upgrade (Horse Cart and Cargo) of +100 kg.', 'wagon')),   // PROF7: DFU's wagon has one limit
  }),
  carpentry: Object.freeze({
    50: pair(spec('bowyer', 'Bowyer', 'Bows +1 quality step (arrows take none).'),
      spec('joiner', 'Joiner', 'Furniture at half the planks.')),
    100: pair(spec('siegewright', 'Siegewright', 'Rams +50% vitality; siege works a day sooner.'),   // PROF4: the sieges are SEAT2's - SEAT2b part two: chosen since (fortLaw.js SIEGEWRIGHT_DAYS, ramVitality)
      spec('master-joiner', 'Master Joiner', "Furniture carries the maker's mark.")),
  }),
  masonry: Object.freeze({
    // PROF11: the Quarryman's cut and the Sculptor's decor are the bench's (MASON_RECIPES, recipeLaw MASONRY_RECIPES); the
    // Builder's and the Fortifier's act on the fortifications SEAT2b builds (server-account/src/seatForts.js) - chosen
    // since SEAT2b, their law and helpers standing below (fortificationStone, wallsOnCapture)
    50: pair(spec('quarryman', 'Quarryman', 'Rough Stone cuts 1:1, not 2:1.'),
      spec('builder', 'Builder', 'Fortification projects need 10% less stone.')),
    100: pair(spec('fortifier', 'Fortifier', "Once a Season a seat's Walls skip their drop on capture."),
      spec('sculptor', 'Sculptor', 'Stone decor pieces.')),
  }),
  alchemy: Object.freeze({
    50: pair(spec('brewer', 'Brewer', '3 potions a brew at Journeyman.'),
      spec('distiller', 'Distiller', 'Potent chance +10%.')),
    100: pair(spec('master-alchemist', 'Master Alchemist', 'Potent is +40%, not +25%.'),
      spec('transmuter', 'Transmuter', 'Two of a DFU metal and a Mercury make one of the next up.')),
  }),
  enchanting: Object.freeze({
    50: pair(spec('efficient', 'Efficient', 'A further -5% cost.'),
      spec('disenchanter', 'Disenchanter', 'Arcane Essence x2.')),
    100: pair(spec('soulbinder', 'Soulbinder', 'Filled soul gems give +10% points.'),
      spec('runecaster', 'Runecaster', "A Masterwork's property chosen from three.")),
  }),
  cooking: Object.freeze({
    50: pair(spec('cook', 'Cook', '+1 serving a dish.'),
      spec('field-cook', 'Field Cook', "A campfire without a Campfire Kit's charge.")),
    100: pair(spec('chef', 'Chef', 'Feasts last +50%.'),
      spec('provisioner', 'Provisioner', 'Rations and dishes never spoil.')),
  }),
  jewelcrafting: Object.freeze({
    50: pair(spec('gemcutter', 'Gemcutter', 'A set gem adds +10% enchantment points.'),
      spec('goldsmith', 'Goldsmith', 'Silver counts as Gold.')),
    100: pair(spec('master-jeweller', 'Master Jeweller', 'Jewellery Masterwork chance +5%.'),
      spec('lapidary', 'Lapidary', 'Siege-cracked Gems set as any gem.')),
  }),
});
/** Whether `specId` is one of the two a profession offers at `rank` (50 or 100). */
export const specOk = (profession, rank, specId) => !!SPECIALISATIONS[profession]?.[rank]?.some((s) => s.id === specId && !s.later);
/** A choice's record, or null. */
export const specOf = (profession, rank, specId) => SPECIALISATIONS[profession]?.[rank]?.find((s) => s.id === specId) ?? null;
/**
 * The specialisations a track stands under at `nowS`: the chosen ones, a paid change taking the place of its rank's
 * choice once its week is out. `row` is the service's track row (spec50, spec100, respec_rank, respec_to, respec_at).
 * @returns {{ 50: string|null, 100: string|null }}
 */
export function specsAt(row, nowS) {
  const out = { 50: row?.spec50 ?? null, 100: row?.spec100 ?? null };
  if (row?.respec_to && Number.isSafeInteger(row?.respec_at) && nowS >= row.respec_at && (row.respec_rank === 50 || row.respec_rank === 100)) {
    out[row.respec_rank] = row.respec_to;
  }
  return out;
}

// ─── THE DAY, THE STORES, THE RATE (PROF0 6, 7, 20) ──────────────────

/** Harvests a gathering profession gives a character a UTC day - the Basket's among Herbalism's (FORAGE0 14.6). */
export const HARVESTS_PER_DAY = 60;
/** AUDIT 29 A3: and an account a UTC day, a profession - two characters' days. A character is an id the client names,
 *  so the character's sixty alone bounded nothing: invented ids filled a day each. */
export const HARVESTS_PER_ACCOUNT_DAY = 2 * HARVESTS_PER_DAY;
/** AUDIT 29 A5: the veins an account may work a UTC day in dungeons nobody has vouched for - one dungeon's most. A
 *  dungeon's id is the client's word, and an unconfirmed dungeon's least (Silver, tier 3, at any hour) was worth more
 *  than any unconfirmed pixel; a confirmed dungeon is bounded by the day's sixty alone. */
export const DEEP_UNCONFIRMED_PER_DAY = 4;
/** The Stores hold at most this many of any one material, own and bought together. */
export const STORES_MAX = 5000;
/** REFUSALS-LEARNED (AUDIT 2026-10-01 part four): the profession each node kind is worked under - the service's own
 *  (server-account/src/professions.js NODE_HARVESTS), so a refusal heard for a node names its profession. */
export const NODE_PROFESSIONS = Object.freeze({ herb: 'herbalism', vein: 'mining', boulder: 'mining', dvein: 'mining', tree: 'logging', body: 'hunting', haul: 'fishing' });
/** STORES-ROOM (AUDIT 2026-10-01 part four): WHETHER A MATERIAL'S STORES ARE FULL AS THE SERVICE COUNTS THEM - every
 *  origin, own, bought and gold-bought alike (professions.js cuts a yield to the room over all three). The gathering
 *  kinds read `held` - what a station may spend, never gold's (GOLD-MARKET's wall) - so with 4,000 own and 1,000 bought
 *  with gold the prompt said ready, the act played, the tool wore, and the service said `stores-full`. `book` the
 *  client's (its `store`, its caps; a book that keeps no origins answers by `held`). */
export function storesFullIn(book, material) {
  const s = book.store?.(material) ?? { own: book.held(material) };
  return (s.own | 0) + (s.bought | 0) + (s.gold | 0) >= (book.state?.caps?.stores ?? STORES_MAX);
}
/** One withdrawal to the pack, at most. */
export const WITHDRAW_MAX = 200;
/** Professions writes an account may make an hour (a harvest, a withdrawal, a delivery, a choice each count). */
export const PROF_OPS_MAX = 600;
export const PROF_OPS_WINDOW_S = 3600;
/** A harvest's `at` - the act's end on the shared clock - may be at most this far past (the queue's bound, PROF0 19)... */
export const HARVEST_LATE_S = 600;
/** ...and at most this far ahead of the service's clock (a client's clock a little fast). */
export const HARVEST_EARLY_S = 60;
/** The switch the service's config holds (PROFESSIONS_OPEN): off, dev (the developers alone), on. */
export const PROF_SWITCH = Object.freeze(['off', 'dev', 'on']);
export const profSwitchOf = (v) => (PROF_SWITCH.includes(v) ? v : 'off');
/** A request id, so an answer lost and asked again is answered again, never credited twice (MARKS_RID_RE's shape). */
export const PROF_RID_RE = /^[A-Za-z0-9_-]{8,40}$/;

// ─── HERBALISM'S ACTS (PROF0 5.2, FORAGE0 14.6) ──────────────────────

/** A common herb comes up by hand in this long, with no moment. The steady hand holds for `steadyS`, bruised by a turn
 *  past `steadyDeg` (x the band, x Botanist's) or a move past `moveM`. */
export const HERB_ACT = Object.freeze({ commonS: 0.8, steadyS: 2.5, steadyDeg: 3, moveM: 0.25, botanist: 1.5 });
/** The Basket's search: three finds glint in turn, each `glintS` long (`masterGlintS` at Master), a `gapS` between. */
export const BASKET_ACT = Object.freeze({ finds: 3, glintS: 1.0, masterGlintS: 1.4, gapS: 0.4 });
/** The attribute bands' widening of an act's window (FORAGE0 14.4), by Foraging's own band. */
export const ACT_BANDS = Object.freeze([0.85, 1.0, 1.15, 1.3]);
export const actBand = (attribute) => ACT_BANDS[attributeBand(attribute)];
/** The Basket's step by finds: all three +50%, two +25%, fewer none (FORAGE0 14.6). */
export const basketStep = (finds) => (finds >= 3 ? 1.5 : finds === 2 ? 1.25 : 1);

// ─── THE MATERIALS PROF1 STORES (PROF0 4.3, 4.8; FORAGE0 14.6) ───────

/** The Stores tab's families, in its filter row's order (PROF0 8). */
export const MATERIAL_FAMILIES = Object.freeze([
  Object.freeze(['metals', 'Ores and Metals']), Object.freeze(['wood', 'Wood']), Object.freeze(['herbs', 'Herbs']),
  Object.freeze(['hides', 'Hides and Cloth']), Object.freeze(['food', 'Food']), Object.freeze(['stone', 'Stone']),
  Object.freeze(['gems', 'Gems']), Object.freeze(['essences', 'Essences']), Object.freeze(['spoils', 'Spoils of War']),
  Object.freeze(['siege', 'Siege Works']),   // SEAT2b part two: the Ram Kit, made at the workbench (PROF0 4.8's 690)
]);
/** DFU's two plant groups (itemTemplatesData.js GROUP_TEMPLATE_INDICES), as the material keys write them. */
export const PLANT_GROUPS = Object.freeze({ p1: 'PlantIngredients1', p2: 'PlantIngredients2' });
/** The plants each group holds - DFU's own lists (itemTemplatesData.js; pinned equal there). */
export const PLANT_GROUP_TEMPLATES = Object.freeze({
  p1: Object.freeze([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 23, 25]),
  p2: Object.freeze([8, 9, 10, 11, 12, 13, 15, 16, 17, 21, 22, 24, 26, 27, 28, 29, 30, 31, 32]),
});
/** A region's plant group: FALL.EXE's race for it - Breton (0) northern, Redguard (1) southern. */
export const regionPlantGroup = (region) => (REGION_RACES[region] === 1 ? 'p2' : 'p1');
/** The group a plant picked in `region` is: the region's, where the plant is in it; else the one group it is in. */
export function plantGroupFor(templateIndex, region) {
  const g = regionPlantGroup(region);
  if (PLANT_GROUP_TEMPLATES[g].includes(templateIndex)) return g;
  const other = g === 'p1' ? 'p2' : 'p1';
  return PLANT_GROUP_TEMPLATES[other].includes(templateIndex) ? other : null;
}
/** An herb's material key: its group and its template, `p1:19` (Red Rose) - or null for a template no group holds. */
export const herbKey = (templateIndex, region) => {
  const g = plantGroupFor(templateIndex, region);
  return g ? `${g}:${templateIndex}` : null;
};
/** The Basket's foods, as the Stores keep them - the template is chosen when one is withdrawn (FORAGE0 14.6). */
export const FOOD_KEYS = Object.freeze(['food:apple', 'food:orange', 'food:mushroom', 'food:egg', 'food:meat', 'food:fish']);   // PROF7: a body's butchery - C&C's Raw Meat, and a Slaughterfish's Raw Fish (5.2's Fishing keeps the same)
/** Foraging's food code (BASKET_BLOCKS: 2 fruit, 3 Mushroom, 4 Egg) and the block's fruit, as a material key. */
export const foodKey = (code, fruit) => (code === 2 ? (fruit === 'Apple' ? 'food:apple' : 'food:orange') : code === 3 ? 'food:mushroom' : code === 4 ? 'food:egg' : null);
/** Marks value by tier (PROF0 4.8) - an herb's by its own rarity: common 1, uncommon 2, rare 5. */
export const TIER_VALUES = Object.freeze([1, 2, 4, 6, 9, 14, 40]);
export const HERB_VALUES = Object.freeze([1, 2, 5]);

// ─── THE MATERIALS PROF2 STORES (PROF0 4.1, 4.5, 4.6, 4.8, 23) ────────

/**
 * @typedef {{ key: string, family: string, tier: number, templateIndex: number, group?: string, name?: string,
 *   icon?: readonly number[]|null, dye?: string|null, value?: number }} MinedRow a mined (or smelted) material's row - or a stock's (PROF3)
 */
/** A DFU item's material row: its key, family, tier, DFU group and template. @returns {MinedRow} */
const dfu = (key, family, tier, group, templateIndex) => Object.freeze({ key, family, tier, group, templateIndex });
/** A new template's (600-699, PROF0 4.8): its key, family, tier and template - DFU's picture it borrows, and the DFU
 *  dye that recolours it (systems/itemDye.js; `dye` a DYE_COLORS name, over the WeaponsAndArmor swatch, or null). A
 *  silver one is DFU's Silver - Unchanged, as a silver blade is (dyes.js). @returns {MinedRow} */
const made = (key, family, tier, templateIndex, name, icon, dye) => Object.freeze({ key, family, tier, templateIndex, name, icon, dye });

/** DFU's metals (MetalIngredients, itemTemplatesData.js) at PROF0 4.1's tiers: Iron, Tin, Copper, Lead, Sulphur 1;
 *  Lodestone, Mercury 2; Silver 3; Gold 4; Platinum 5 - and Brass, smelted from Copper and Tin, 2. */
export const METALS = Object.freeze([
  dfu('metal:iron', 'metals', 1, 'MetalIngredients', 71), dfu('metal:tin', 'metals', 1, 'MetalIngredients', 66),
  dfu('metal:copper', 'metals', 1, 'MetalIngredients', 72), dfu('metal:lead', 'metals', 1, 'MetalIngredients', 70),
  dfu('metal:sulphur', 'metals', 1, 'MetalIngredients', 69), dfu('metal:lodestone', 'metals', 2, 'MetalIngredients', 68),
  dfu('metal:mercury', 'metals', 2, 'MetalIngredients', 65), dfu('metal:silver', 'metals', 3, 'MetalIngredients', 73),
  dfu('metal:gold', 'metals', 4, 'MetalIngredients', 74), dfu('metal:platinum', 'metals', 5, 'MetalIngredients', 75),
  dfu('metal:brass', 'metals', 2, 'MetalIngredients', 67),
]);
/** DFU's pictures the new templates borrow (TEXTURE.254): Lodestone's lump, Iron's bar. */
export const ICON_LODESTONE = Object.freeze([254, 66]);
export const ICON_IRON = Object.freeze([254, 63]);
/** The new ores (610-615): Moonstone 4, Dwarven Scrap 4, Mithril 5, Adamantium 6, Ebony 6, Orichalcum 6. */
export const ORES = Object.freeze([
  made('ore:moonstone', 'metals', 4, 610, 'Moonstone Ore', ICON_LODESTONE, 'Elven'),
  made('ore:dwarven', 'metals', 4, 611, 'Dwarven Scrap', ICON_LODESTONE, 'Dwarven'),
  made('ore:mithril', 'metals', 5, 612, 'Mithril Ore', ICON_LODESTONE, 'Mithril'),
  made('ore:adamantium', 'metals', 6, 613, 'Adamantium Ore', ICON_LODESTONE, 'Adamantium'),
  made('ore:ebony', 'metals', 6, 614, 'Ebony Ore', ICON_LODESTONE, 'Ebony'),
  made('ore:orichalcum', 'metals', 6, 615, 'Orichalcum Ore', ICON_LODESTONE, 'Orcish'),
]);
/** The ingots (620-630), each its DFU material's tier and dye. Daedric (7) and Warforged Steel (6: counts as Ebony
 *  with a step, a Siege Honour's) are registered with the rest; nothing in PROF2 makes them. */
export const INGOTS = Object.freeze([
  made('ingot:iron', 'metals', 1, 620, 'Iron Ingot', ICON_IRON, 'Iron'),
  made('ingot:steel', 'metals', 2, 621, 'Steel Ingot', ICON_IRON, 'Steel'),
  made('ingot:silver', 'metals', 3, 622, 'Silver Ingot', ICON_IRON, 'Silver'),
  made('ingot:moonstone', 'metals', 4, 623, 'Moonstone Ingot', ICON_IRON, 'Elven'),
  made('ingot:dwarven', 'metals', 4, 624, 'Dwarven Ingot', ICON_IRON, 'Dwarven'),
  made('ingot:mithril', 'metals', 5, 625, 'Mithril Ingot', ICON_IRON, 'Mithril'),
  made('ingot:adamantium', 'metals', 6, 626, 'Adamantium Ingot', ICON_IRON, 'Adamantium'),
  made('ingot:ebony', 'metals', 6, 627, 'Ebony Ingot', ICON_IRON, 'Ebony'),
  made('ingot:orichalcum', 'metals', 6, 628, 'Orichalcum Ingot', ICON_IRON, 'Orcish'),
  made('ingot:daedric', 'metals', 7, 629, 'Daedric Ingot', ICON_IRON, 'Daedric'),
  made('ingot:warforged', 'metals', 6, 630, 'Warforged Steel Ingot', ICON_IRON, 'Steel'),
]);
/** Stone (PROF0 4.5): Rough Stone quarried, tier 1; Cut Stone cut from it 2 : 1, tier 2. Lodestone's grey lump as it
 *  is - FACT, DFU's Grey is a clothing dye (dyes.js CLOTHING_STARTS), and no metal's swatch is a stone's. */
export const STONES = Object.freeze([
  made('stone:rough', 'stone', 1, 673, 'Rough Stone', ICON_LODESTONE, null),
  made('stone:cut', 'stone', 2, 674, 'Cut Stone', ICON_LODESTONE, null),
]);
/** PROF11 (PROF0 4.5, 4.8: 675): MORTAR - made ten at a time at the mason's bench from 1 Sulphur, 1 Lead and 5 Rough
 *  Stone; tier 2, worth 2 Marks (4.8's tier value). 4.8's "DFU Lodestone, greyed" as Rough and Cut Stone are drawn: the
 *  grey lump as it is, undyed (DFU's Grey is a clothing dye - dyes.js CLOTHING_STARTS - and no metal's swatch is a
 *  stone's). Registered beside them (systems/profTemplates.js MASONRY_TEMPLATE_ROWS), never gathered: the bench's alone. */
export const MORTAR = made('stone:mortar', 'stone', 2, 675, 'Mortar', ICON_LODESTONE, null);
/** PROF11: the stone the mason works - Rough Stone (the quarry's) and Cut Stone (the cut's). */
export const ROUGH_STONE = STONES[0];
export const CUT_STONE = STONES[1];
/** Every new template PROF11 registers, by template (the Sculptor's four stone pieces are recipeLaw's STONE_DECOR). */
export const MASONRY_TEMPLATES = Object.freeze([MORTAR]);
/** A gem's tier by its DFU price's band (PROF0 23): to 10 gold 2, to 50 3, to 100 4, to 250 5, past it 6. */
export const gemTierOfPrice = (price) => (price <= 10 ? 2 : price <= 50 ? 3 : price <= 100 ? 4 : price <= 250 ? 5 : 6);
/** DFU's eight gems (Gems, itemTemplatesData.js), each at its price's tier (Ruby 250, Emerald 425, Sapphire 375,
 *  Diamond 500, Jade 10, Turquoise 50, Malachite 25, Amber 100 - itemTemplates.json). The Pearl is Fishing's (PEARL, PROF8). */
export const GEMS = Object.freeze([
  dfu('gem:ruby', 'gems', gemTierOfPrice(250), 'Gems', 0), dfu('gem:emerald', 'gems', gemTierOfPrice(425), 'Gems', 1),
  dfu('gem:sapphire', 'gems', gemTierOfPrice(375), 'Gems', 2), dfu('gem:diamond', 'gems', gemTierOfPrice(500), 'Gems', 3),
  dfu('gem:jade', 'gems', gemTierOfPrice(10), 'Gems', 4), dfu('gem:turquoise', 'gems', gemTierOfPrice(50), 'Gems', 5),
  dfu('gem:malachite', 'gems', gemTierOfPrice(25), 'Gems', 6), dfu('gem:amber', 'gems', gemTierOfPrice(100), 'Gems', 7),
]);
/** DFU's Diamond's picture (TEXTURE.254 record 3), the one the Siege-cracked Gem borrows. */
export const ICON_DIAMOND = Object.freeze([254, 3]);
/** THE SIEGE-CRACKED GEM (4.7, 4.8: 678): a Siege Honour's Spoils, a gem only war yields - the Diamond's tier, on the
 *  Diamond's own picture. DECIDED (AUDIT-SEATS): undyed and without 4.8's "cracked overlay" - the icon's one door is a
 *  dye (systems/itemTemplates.js inventoryItemImage), no overlay crosses the renderers; the name says what it is.
 *  Mining never strikes one: GEMS is the glint's table, and this row is not in it. */
export const SIEGE_GEM = made('gem:siege', 'gems', gemTierOfPrice(500), 678, 'Siege-cracked Gem', ICON_DIAMOND, null);
/** Every new template PROF2 registers, by template. */
export const MINING_TEMPLATES = Object.freeze([...ORES, ...INGOTS, ...STONES]);

// ─── THE WOODS PROF4 STORES (PROF0 4.2, 4.8, 25) ─────────────────────

/** DFU's pictures the woods borrow (law 6, PROF0 4.8): a log and Heartwood Twigs' (TEXTURE.254 record 9); a plank the
 *  Staff's (TEXTURE.207 record 7 - a length of worked wood, drawn as DFU draws an Iron Staff: its Iron dye); Resin
 *  Aloe's (254/23); Charcoal Lodestone's lump. FOUND: 4.8's "Small Oak Table's board" has no picture (DFU's furniture
 *  templates carry world texture 0/0). The woods are not tinted apart - PROF0 25: DFU's two swatches are clothing's and
 *  metal's, and a twig's picture is neither's (unverified without the player's data - FLAGGED to Mac's eye). */
export const ICON_TWIGS = Object.freeze([254, 9]);
export const ICON_STAFF = Object.freeze([207, 7]);
export const ICON_ALOE = Object.freeze([254, 23]);
/** The seven woods (4.2), each its tier: Pine 1, Oak 2, Cherry 3, Teak 4, Mahogany 5, Ironwood and Ghostwood 6. */
export const WOODS = Object.freeze([
  Object.freeze({ id: 'pine', name: 'Pine', tier: 1 }), Object.freeze({ id: 'oak', name: 'Oak', tier: 2 }),
  Object.freeze({ id: 'cherry', name: 'Cherry', tier: 3 }), Object.freeze({ id: 'teak', name: 'Teak', tier: 4 }),
  Object.freeze({ id: 'mahogany', name: 'Mahogany', tier: 5 }), Object.freeze({ id: 'ironwood', name: 'Ironwood', tier: 6 }),
  Object.freeze({ id: 'ghostwood', name: 'Ghostwood', tier: 6 }),
]);
/** The logs (635-641) and the planks (645-651), in the woods' order. */
export const LOGS = Object.freeze(WOODS.map((w, i) => made(`log:${w.id}`, 'wood', w.tier, 635 + i, `${w.name} Log`, ICON_TWIGS, null)));
export const PLANKS = Object.freeze(WOODS.map((w, i) => made(`plank:${w.id}`, 'wood', w.tier, 645 + i, `${w.name} Plank`, ICON_STAFF, 'Iron')));
/** A wood's id from a log's or a plank's key (`log:oak` -> `oak`), or null. */
export const woodOf = (key) => (typeof key === 'string' && /^(log|plank):[a-z]+$/.test(key) && WOODS.some((w) => w.id === key.slice(key.indexOf(':') + 1)) ? key.slice(key.indexOf(':') + 1) : null);
/** Charcoal (PROF0 4.2): burnt from a log, tier 1 - the Steel recipe names it; the smith's stock sells it (PROF3). */
export const CHARCOAL = made('wood:charcoal', 'wood', 1, 652, 'Charcoal', ICON_LODESTONE, null);
/** Resin (4.2): one tree in four, tier 1 - a bow's string-wax. Heartwood (4.2, PROF0 25): 2% a Clean Cut, one material
 *  (4.8 gives it one template), tier 4 - one stands in for a plank in any recipe that asks one, and is a quality step. */
export const RESIN = made('wood:resin', 'wood', 1, 653, 'Resin', ICON_ALOE, null);
export const HEARTWOOD = made('wood:heartwood', 'wood', 4, 654, 'Heartwood', ICON_TWIGS, null);
/** Every new template PROF4 registers, by template. */
export const WOOD_TEMPLATES = Object.freeze([...LOGS, ...PLANKS, CHARCOAL, RESIN, HEARTWOOD]);
/**
 * SEAT2b part two (PROF0 4.8: "690 | Ram Kit | Stores (a siege work)"; Seats-Arc 4.2, 6.2): THE RAM KIT AS THE STORES HOLD
 * IT - made at the workbench (recipeLaw.js `ramkit:oak`, Carpentry 60), delivered by a seat writ to a pledged challenger's
 * Siege Camp, sent at the Turning to the siege the camp won where a Gatehouse stands (fortLaw.js campSpent). A siege work
 * never leaves the Stores (NO_PACK_FORM): its whole road is the writ's. DECIDED: its tier the recipe's (5) and its worth
 * the inputs' at their tiers' values (40 Oak Planks 80, 20 Iron Ingots 20, 4 Bear Hides 8 - 108), so a writ's pay and the
 * influence a delivery raises (4.2: "own units at their value") keep the materials' - a tier's 9 would make a kit worth
 * less than its hides.
 */
export const RAM_KIT = Object.freeze({ ...made('work:ram', 'siege', 5, 690, 'Ram Kit', ICON_IRON, null), value: 108 });
// ─── THE HIDES PROF7 STORES (PROF0 4.4, 4.5, 4.8, 29) ────────────────

/** DFU's pictures the hides and the cloth borrow (law 6). FOUND (PROF0 29): 4.8's "DFU Small Skins" and "Large Skins"
 *  and "Small Tapestry" have none - DFU's furniture templates carry world texture 0/0 - so a pelt is Nymph Hair's lock
 *  (TEXTURE.254 record 55), silk Mummy Wrappings' (41), a scale, chitin or shell Fairy Dragon's Scales' (37), a feather
 *  Gryphon's (53), and leather and a bolt a dropped garment's own flat (TEXTURE.204 record 0). Unverified without the
 *  player's data, as the woods' pictures are - the one flag above holds both (one blocker, one site). */
export const ICON_HAIR = Object.freeze([254, 55]);
export const ICON_WRAPPINGS = Object.freeze([254, 41]);
export const ICON_SCALES = Object.freeze([254, 37]);
export const ICON_FEATHER = Object.freeze([254, 53]);
export const ICON_GARMENT = Object.freeze([204, 0]);
/** DFU's MobileTypes (characters/mobileTypes.js, generated from DaggerfallUnityEnums.cs) of the ten foes 4.4 skins. */
const MOB = Object.freeze({
  Rat: 0, GiantBat: 3, GrizzlyBear: 4, SabertoothTiger: 5, Spider: 6, Slaughterfish: 11, Harpy: 13, GiantScorpion: 20,
  Dragonling: 34, DragonlingAlternate: 40, Dreugh: 41,
});
/** A DFU creature part a body may give (4.4's "a chance of the DFU ingredient"), at its price's tier as a gem is
 *  (PROF0 23's bands): Big Tooth 8 gold, Spider's Venom 22, Giant Scorpion Stinger 25, Dragon's Scales 375. */
export const PARTS = Object.freeze([
  dfu('part:tooth', 'hides', gemTierOfPrice(8), 'MiscellaneousIngredients1', 56),
  dfu('part:venom', 'hides', gemTierOfPrice(22), 'CreatureIngredients1', 41),
  dfu('part:stinger', 'hides', gemTierOfPrice(25), 'CreatureIngredients2', 47),
  dfu('part:dragonscale', 'hides', gemTierOfPrice(375), 'CreatureIngredients2', 46),
]);
/**
 * @typedef {MinedRow & { foes: readonly number[], part: string|null, meat: string|null, cures: string|null }} HideRow
 *   a hide's row: the foes it is skinned from, the DFU part a body may give, what its butchery gives, what it cures to
 */
/** @returns {HideRow} */
const hide = (key, templateIndex, name, tier, icon, foes, part, meat, cures) =>
  Object.freeze({ ...made(key, 'hides', tier, templateIndex, name, icon, null), foes: Object.freeze(foes), part, meat, cures });
/**
 * THE TEN HIDES (4.4, templates 655-664 in its order), each its foes, tier, DFU part (4.4's column), its butchery (C&C's
 * own animals: SURV2's MEAT_BY_TYPE - Rat, Giant Bat, Grizzly Bear, Sabretooth Tiger, Spider, Giant Scorpion - Raw Meat;
 * its FISH_BY_TYPE's Slaughterfish Raw Fish; the Harpy, the Dreugh and the Dragonling none, as C&C gives their bodies
 * none) and its cure: tiers 1-3 to Cured Leather, 4-6 to Hardened Leather (4.4) - but Spider Silk, woven to a Silk Bolt
 * (4.5), and Harpy Feathers, which fletch (9.3's arrows), never cure (PROF0 29).
 */
export const HIDES = Object.freeze([
  hide('hide:rat', 655, 'Rat Pelt', 1, ICON_HAIR, [MOB.Rat], null, 'food:meat', 'leather:cured'),
  hide('hide:bat', 656, 'Bat Leather', 2, ICON_HAIR, [MOB.GiantBat], null, 'food:meat', 'leather:cured'),
  hide('hide:bear', 657, 'Bear Hide', 2, ICON_HAIR, [MOB.GrizzlyBear], 'part:tooth', 'food:meat', 'leather:cured'),
  hide('hide:tiger', 658, 'Tiger Pelt', 3, ICON_HAIR, [MOB.SabertoothTiger], 'part:tooth', 'food:meat', 'leather:cured'),
  hide('hide:spider', 659, 'Spider Silk', 3, ICON_WRAPPINGS, [MOB.Spider], 'part:venom', 'food:meat', null),
  hide('hide:scorpion', 660, 'Scorpion Chitin', 4, ICON_SCALES, [MOB.GiantScorpion], 'part:stinger', 'food:meat', 'leather:hardened'),
  hide('hide:slaughterfish', 661, 'Slaughterfish Scales', 4, ICON_SCALES, [MOB.Slaughterfish], null, 'food:fish', 'leather:hardened'),
  hide('hide:harpy', 662, 'Harpy Feathers', 5, ICON_FEATHER, [MOB.Harpy], null, null, null),
  hide('hide:dreugh', 663, 'Dreugh Shell', 5, ICON_SCALES, [MOB.Dreugh], null, null, 'leather:hardened'),
  hide('hide:dragonling', 664, 'Dragonling Scale', 6, ICON_SCALES, [MOB.Dragonling, MOB.DragonlingAlternate], 'part:dragonscale', null, 'leather:hardened'),
]);
/** The hide a foe's body gives, by its MobileTypes value, or null for a body no knife takes a hide from. */
export const hideOfFoe = (mobileType) => (Number.isSafeInteger(mobileType) ? HIDES.find((h) => h.foes.includes(mobileType)) ?? null : null);
/** Hunting's Bear Hide - the Ram Kit's (PROF0 25). */
export const BEAR_HIDE = HIDES[2];
/** The leathers (4.4: 665, 666): Cured the cure of tiers 1-3, their middle, tier 2; Hardened of tiers 4-6, tier 5. */
export const CURED_LEATHER = made('leather:cured', 'hides', 2, 665, 'Cured Leather', ICON_GARMENT, null);
export const HARDENED_LEATHER = made('leather:hardened', 'hides', 5, 666, 'Hardened Leather', ICON_GARMENT, null);
/** The cloth (4.5, 668-671), each its step (9.3: Linen 1, Wool 2, Silk 4, Standard-bearer's Silk 5). Linen and Wool are
 *  never gathered - the Weavers' counter sells them; a Silk Bolt is woven from Spider Silk; Standard-bearer's Silk is a
 *  Siege Honour's Spoils (4.7). */
export const LINEN = made('cloth:linen', 'hides', 1, 668, 'Linen Bolt', ICON_GARMENT, null);
export const WOOL = made('cloth:wool', 'hides', 2, 669, 'Wool Bolt', ICON_GARMENT, null);
export const SILK = made('cloth:silk', 'hides', 4, 670, 'Silk Bolt', ICON_GARMENT, null);
export const STANDARD_SILK = made('cloth:standard', 'hides', 5, 671, "Standard-bearer's Silk", ICON_GARMENT, null);
export const CLOTHS = Object.freeze([LINEN, WOOL, SILK, STANDARD_SILK]);
/** Every new template PROF7 registers, by template: the hides, the leathers, the cloth. */
export const HIDE_TEMPLATES = Object.freeze([...HIDES, CURED_LEATHER, HARDENED_LEATHER, ...CLOTHS]);

// ─── HUNTING (PROF0 5.2, 6, 29) ──────────────────────────────────────

/** The day's hides an ACCOUNT takes (PROF0 6: Hunting is bounded, not witnessed - the tier is the client's claim, and the
 *  cap is the whole defence), and of them the most of tiers `HIGH_HIDE_TIER` and past it. */
export const HIDES_PER_DAY = 30;
export const HIGH_HIDES_PER_DAY = 3;
export const HIGH_HIDE_TIER = 5;
/** A body's DFU part (4.4): one body in four, lost with a torn pelt (PROF0 29). */
export const PART_CHANCE = 0.25;
/** A body's butchery (PROF0 29): one Raw Meat (or Raw Fish) into the Stores; a Butcher's two (3.3). */
export const BUTCHERY = Object.freeze({ meat: 1, butcher: 2 });
/** A hide's yield before the act (PROF0 6): one; a clean pelt x1.5, the fraction a chance (the act's bound). */
export const HIDE_YIELD = 1;
/** The act's bound on a yield (PROF0 5.1): +50% at most. */
export const ACT_YIELD_MAX = 1.5;
/** A Tracker's marks (3.3): the animals within this many metres. */
export const TRACKER_M = 100;
/** THE SKINNING KNIFE (PROF0 4.8, FORAGE0 14.2): 603 - 0.5 kg, 50 uses, 100 gold, rarity 10, a group-9 tool on DFU's
 *  Dagger's picture (TEXTURE.207 record 5); online shelves only. */
export const SKINNING_KNIFE = Object.freeze({ templateIndex: 603, name: 'Skinning Knife', weight: 0.5, hitPoints: 50, price: 100, rarity: 10, icon: Object.freeze([207, 5]) });
/** The knife's checks (FORAGE0 14.3), in the order Foraging's tools ask theirs: never inside (a body lies where it fell -
 *  PROF0 17.1) nor daylight (foes die at night), and its lines in Foraging's voice - the knife is the port's own. */
export const KNIFE_CHECKS = Object.freeze(['town', 'sea', 'enemies', 'encumbered']);
export const KNIFE_REFUSALS = Object.freeze({
  town: 'You cannot skin in a settlement!', sea: 'You cannot skin out here!',
  enemies: 'You cannot skin with enemies nearby!', encumbered: 'You cannot skin when fully encumbered!',
});
/** AUDIT 32 H4: the knife's checks of the ground - no act of the player's changes them while the body lies there - asked
 *  by the plan, so a body in a settlement or at sea is no ready node and E goes on to its loot (AUDIT 29 C1's law); the
 *  words the prompt says them in. The foe and the load stay the act's own checks. */
export const KNIFE_WHERE = Object.freeze(['town', 'sea']);
export const KNIFE_WHERE_WORDS = Object.freeze({ town: 'not in a settlement', sea: 'not out here' });
/** SETTLE-SAID (FIELD BUGS 2026-10-01, "it gives a notification but you cant mine"): the same for a node of the ground -
 *  a vein, a boulder, a patch, a tree: the settlement's check (a town, a farm, a temple, a tavern - its footprint and a
 *  block round it) is the act's (FORAGE0 14.3), and the plan said such a node was ready - E, or the tool's Use, then
 *  played no act and said "You cannot mine in a settlement!". The plan asks it, and the prompt says it. */
export const GROUND_WHERE = Object.freeze(['town']);
export const GROUND_WHERE_WORDS = Object.freeze({ town: 'not in a settlement' });

// ─── PROF8: FISHING WITH THE NET (PROF0 5.2, 6; Appendix B) ─────────
//
// The Fishing-Net is Foraging's own (1603, FORAGE0 6.4: in water, swimming, or at sea). A haul names no node: like
// Hunting, Fishing is BOUNDED, NOT WITNESSED - forty hauls an account a day - its pixel the client's word, read for the
// ground the witnesses confirmed (the sea's finds) and its day.

/** The catch in the Stores: Raw Fish (FOOD_KEYS), tier 1, a Mark (5.2) - the species named in the toast alone. */
export const FISH_KEY = 'food:fish';
/** The sea's find: DFU's Pearl (MiscellaneousIngredients2, template 77; 150 gold, so tier 5 by its price's band). */
export const PEARL = dfu('gem:pearl', 'gems', gemTierOfPrice(150), 'MiscellaneousIngredients2', 77);
/** A Slaughterfish in the net: its scales (PROF7's hide), and its body the heaviest haul - a fish more. */
export const SLAUGHTERFISH_SCALES = 'hide:slaughterfish';
/** Hauls an ACCOUNT a day (PROF0 6) - not a character's: Fishing's whole bound. */
export const HAULS_PER_DAY = 40;
/** A haul's fish before the act (PROF0 6). */
export const HAUL_YIELD = Object.freeze([1, 2]);
/** A school's fish on top (PROF0 6) - a Netter's two (3.3). */
export const SCHOOL_FISH = Object.freeze({ plain: 1, netter: 2 });
/** The finds, a haul each (5.2): at sea, on ground the witnesses confirmed, a Pearl 1 in 50 (a Pearl Diver's x3, a
 *  Deep-Sea's x2) and a Slaughterfish 1 in 100 (a Deep-Sea's x2); a trophy 1 in 200 anywhere. */
export const FISH_CHANCE = Object.freeze({ pearl: 1 / 50, slaughterfish: 1 / 100, trophy: 1 / 200, pearlDiver: 3, deepSea: 2 });
/** XP FOLLOWS THE RANK (Mac, 2026-09-30: "XP follows your rank"): a haul is worked at the highest tier the rank opens.
 *  Raw Fish is tier 1, and a tier more than two below the rank's is quartered (harvestXp), so a haul worked at its
 *  catch's tier would have held Fishing at a Novice's pace for good; at the rank's own tier it climbs as the others do. */
export const haulTier = (rank) => topTierOf(rank);
/**
 * THE ACT (PROF0 5.2): hold to wind the throw, 0.3-1.5 s, and the net flies 3-12 m; the wait, 5-30 s - halved in the
 * first and last daylight hours (07:00, 17:00), doubled in a storm; the tug, 600 ms to haul (an Angler's +40%); the
 * haul - the net's weight wanders the bar, the tension band rises while held and falls when let go, 20% of the bar at
 * Novice to 30% at Master; the weight kept inside fills the meter (`fillS` inside, OPEN) within 20 s; 2 s outside, in
 * all, and it comes in plain. The band's own speeds are OPEN.
 */
export const FISH_ACT = Object.freeze({
  windMinS: 0.3, windMaxS: 1.5, throwMinM: 3, throwMaxM: 12, waitMinS: 5, waitMaxS: 30, tugS: 0.6, angler: 1.4,
  bandLo: 0.2, bandHi: 0.3, haulS: 20, slipS: 2, fillS: 6, rise: 0.9, fall: 0.7, drift: 0.35,
});
/** The tension band's width at a rank, a share of the bar: 20% at Novice, 30% at Master. */
export const fishBand = (rank) => FISH_ACT.bandLo + (FISH_ACT.bandHi - FISH_ACT.bandLo) * Math.max(0, Math.min(1, rank / PROF_RANK_MAX));
/** The tug's window, seconds (an Angler's +40%). */
export const tugWindow = (angler = false) => FISH_ACT.tugS * (angler ? FISH_ACT.angler : 1);
/** The wait's multiplier: the first and last daylight hours halve it, a storm doubles it. */
export const waitMult = (hour, storm = false) => (hour === 7 || hour === 17 ? 0.5 : 1) * (storm ? 2 : 1);
/** The throw's distance for a wind held `s` seconds: 3 m at 0.3 s, 12 m at 1.5 s, straight between. */
export const throwM = (s) => {
  const t = Math.max(0, Math.min(1, (s - FISH_ACT.windMinS) / (FISH_ACT.windMaxS - FISH_ACT.windMinS)));
  return FISH_ACT.throwMinM + t * (FISH_ACT.throwMaxM - FISH_ACT.throwMinM);
};

// ─── PROF12: THE ALCHEMIST'S AND THE ENCHANTER'S GOODS (PROF0 4.5, 4.8, 9.3; section 37) ───

/** DFU's Ectoplasm's picture (TEXTURE.254 record 39), the one Arcane Essence borrows (4.8: "DFU Ectoplasm, tinted"). */
export const ICON_ECTOPLASM = Object.freeze([254, 39]);
/**
 * THE APOTHECARIES' SIXTEEN (4.5: "the sixteen DFU ingredients that DFU's potion recipes need and no gathering route
 * yields (FACT, POTION_RECIPES) ... at a fifth of DFU's price in Marks, rounded up"): each DFU's own ingredient in its own
 * group (itemTemplatesData.js; withdrawn, DFU's item - profItems.js mintMaterialItem), in 4.5's order, `value` its counter
 * price - 4.5's own numbers, pinned equal to a fifth of itemTemplates.json's basePrice rounded up (test/prof12_law.test.js)
 * - and its tier its price's, as a body's part is (gemTierOfPrice). The Stores' family the Essences': DECIDED, the
 * alchemist's and the enchanter's goods share one filter (8's "Essences"), no new one.
 */
const reagent = (key, group, templateIndex, price, value) => Object.freeze({ ...dfu(key, 'essences', gemTierOfPrice(price), group, templateIndex), value });
export const REAGENTS = Object.freeze([
  reagent('reagent:werewolf-blood', 'CreatureIngredients1', 33, 25, 5),
  reagent('reagent:fairy-dragon-scales', 'CreatureIngredients1', 35, 90, 18),
  reagent('reagent:unicorn-horn', 'CreatureIngredients3', 37, 200, 40),
  reagent('reagent:ectoplasm', 'CreatureIngredients1', 39, 60, 12),
  reagent('reagent:troll-blood', 'CreatureIngredients1', 42, 20, 4),
  reagent('reagent:snake-venom', 'CreatureIngredients1', 43, 10, 2),
  reagent('reagent:mummy-wrappings', 'CreatureIngredients2', 49, 40, 8),
  reagent('reagent:saint-hair', 'CreatureIngredients1', 54, 200, 40),
  reagent('reagent:small-tooth', 'MiscellaneousIngredients1', 58, 2, 1),
  reagent('reagent:pure-water', 'MiscellaneousIngredients1', 59, 25, 5),
  reagent('reagent:rain-water', 'MiscellaneousIngredients1', 60, 10, 2),
  reagent('reagent:orc-blood', 'CreatureIngredients1', 61, 20, 4),
  reagent('reagent:elixir-vitae', 'MiscellaneousIngredients1', 62, 30, 6),
  reagent('reagent:nectar', 'MiscellaneousIngredients1', 63, 15, 3),
  reagent('reagent:ichor', 'MiscellaneousIngredients1', 64, 20, 4),
  reagent('reagent:ivory', 'MiscellaneousIngredients2', 76, 13, 3),
]);
/**
 * ARCANE ESSENCE (4.8: "680 | Arcane Essence | Stores | DFU Ectoplasm, tinted"): Disenchanting's yield (9.3), the Stores'
 * Essences. DECIDED: tier 3 and its Marks value 4 - an Essence is a hundred points of a crafted piece's budget, worth more
 * than a common herb and less than a gem; undyed (Mortar's finding, PROF11: DFU's dye swatch reaches no ingredient's
 * picture), its name telling it from the Ectoplasm whose lump it wears.
 */
export const ARCANE_ESSENCE = made('essence:arcane', 'essences', 3, 680, 'Arcane Essence', ICON_ECTOPLASM, null);
export const ESSENCE_TEMPLATES = Object.freeze([ARCANE_ESSENCE]);
/**
 * PROF12 (9.3: "the brewing act at an alchemy station"): WHERE THE ALCHEMY STATION STANDS. DECIDED: 9.3 names a station
 * and no shop - so a home's `alchemy` station (HOME-STATIONS' first, its 50,000 licence; a hall member's as the others'), or
 * an ALCHEMIST's, open for trade (DFU's own potion seller, its insideOpenShop latch - AUDIT 29 D4's law), at every other
 * station's use fee: 50 gold a brew or a transmutation, the purse's. The service cannot see the station (as it cannot see
 * the forge, PROF0 23): the inputs are the Stores' and their units the bound.
 */
export const ALCHEMY_FEE = 50;
/**
 * PROF12 (9.3: "Disenchanting (new, at any enchanting station)"): WHERE IT IS DONE. DECIDED: a home's `enchant` station
 * (HOME-STATIONS', its 200,000 licence; a hall member's) or a MAGES GUILD hall - the house of DFU's own item maker - at the
 * stations' use fee, 50 gold a piece. The service cannot see the station either: the piece is the service's, its provenance
 * the bound.
 */
export const ENCHANT_FEE = 50;

// ─── THE SMITH'S STOCK (PROF0 24) ────────────────────────────────────

/** PROF3: the fittings Smithing's recipes ask (PROF0 9.3) that no profession yielded then - Hunting's Cured Leather
 *  (665: 4.4's cure of tier 1-3 hides, their middle, tier 2) and Logging's Oak and Pine Planks (646 tier 2, 645 tier
 *  1) and Charcoal. The smith's forge sells them into the Stores for Marks: a counter's goods (4.5), bought, never own.
 *  PROF4 and PROF7 yield all four now; the counter stands, at twice their worth. */
/** PROF4: Logging's own planks now (their templates registered, PROF0 25). */
export const OAK_PLANK = PLANKS[1];
export const PINE_PLANK = PLANKS[0];
/** A counter's price, a unit: twice the material's Marks value (4.8) - a gatherer's own undersells it once the
 *  professions that yield it come (PROF4, PROF7). The smith's, in its window's order. */
const stock = (counter) => (m) => Object.freeze({ key: m.key, marks: 2 * TIER_VALUES[m.tier - 1], counter });
export const SMITH_STOCK = Object.freeze([CURED_LEATHER, OAK_PLANK, PINE_PLANK, CHARCOAL].map(stock('smith')));
/** PROF4 (PROF0 25): the furnisher's stock - a Furniture Store's counter, the bed's Linen (4.5's 2 Marks) until the
 *  Weavers' counter stands on the Market tab (PROF5). */
export const FURNISHER_STOCK = Object.freeze([LINEN].map(stock('furnisher')));
/** PROF5 (PROF0 26): the Weavers' counter on the Market tab (4.5) - Linen Bolt 2 and Wool Bolt 3 Marks a bolt, 4.5's own
 *  prices (twice the value would make Wool 4). Linen at the furnisher's stock the same 2, so the counters never part. */
export const WEAVERS_STOCK = Object.freeze([
  Object.freeze({ key: LINEN.key, marks: 2, counter: 'weavers' }), Object.freeze({ key: WOOL.key, marks: 3, counter: 'weavers' }),
]);
/** PROF12 (PROF0 4.5): the Apothecaries' counter on the Market tab beside the Weavers' - the sixteen at their own prices
 *  (REAGENTS' `value`), straight into the Stores, bought, never own: a Marks sink, never a purse-gold purchase. Without it
 *  the brewing act could make none of the twenty potions. */
export const APOTHECARY_STOCK = Object.freeze(REAGENTS.map((r) => Object.freeze({ key: r.key, marks: /** @type {number} */ (r.value), counter: 'apothecaries' })));
/** AUDIT 32 S1 (Mac, 2026-09-30: "Whatever you think is best"): the goods ONLY a counter sells - 4.5's Linen and Wool,
 *  never gathered. A recipe made wholly of them earns its craft's XP and no first-craft bonus (recipeLaw firstCraftPays).
 *  The smith's stock is not among them: every one of its goods is gathered too. A counter that sells what nothing
 *  gathers adds its goods here. */
export const COUNTER_ONLY = Object.freeze([LINEN.key, WOOL.key, ...REAGENTS.map((r) => r.key)]);   // PROF12: the Apothecaries' sixteen, never gathered
/** Every counter's goods. The service cannot see a counter (as it cannot see the forge): it sells any of them wherever
 *  it is asked, and the client asks at the counter's shop - a lie buys the same goods at the same price. */
export const STOCKS = Object.freeze([...SMITH_STOCK, ...FURNISHER_STOCK, ...WEAVERS_STOCK, ...APOTHECARY_STOCK]);   // PROF12: the Apothecaries'
export const stockOf = (key) => STOCKS.find((s) => s.key === key) ?? null;
/** Units a purchase, at most. */
export const STOCK_MAX = 100;
/** The materials with no pack form - none since PROF7, which registered the hides', the leathers' and the cloth's
 *  templates (PROF4 the planks' and Charcoal's before it), until SEAT2b part two made the Ram Kit: a siege work never
 *  leaves the Stores but by a Siege Camp's writ. AUDIT PROF12 E1: nor does Arcane Essence - in the pack it sold to any
 *  shop at its DFU worth (32 gold), a gold faucet a ring's 18 Essence deep and a silver-to-gold road around the Bank's
 *  rate; its uses are the Stores' (the market, Runecaster's roll to come), and it stays where they read it. */
export const NO_PACK_FORM = Object.freeze(['work:ram', 'essence:arcane']);   // SEAT2b part two: a siege work's road is the writ's (RAM_KIT); AUDIT PROF12 E1: Arcane Essence's the Stores'
/** Whether the Stores may give a material to the pack. */
export const withdrawable = (key) => !NO_PACK_FORM.includes(key);
const MINED = new Map([...METALS, ...ORES, ...INGOTS, ...STONES, ...GEMS, SIEGE_GEM, PEARL, ...WOOD_TEMPLATES, ...HIDE_TEMPLATES, ...PARTS, ...MASONRY_TEMPLATES, RAM_KIT, ...REAGENTS, ARCANE_ESSENCE].map((m) => [m.key, m]));   // PROF7: the hides, leathers, cloth and a body's DFU parts; PROF8: the sea's Pearl; AUDIT-SEATS: the Siege-cracked Gem; PROF11: the bench's Mortar; SEAT2b part two: the Ram Kit; PROF12: the Apothecaries' sixteen and Arcane Essence
/** A mined (or smelted) material's row, or null. */
export const minedMaterial = (key) => MINED.get(key) ?? null;
/** PROF5: every registered material's key, in the registry's order - the market's catalogue beside the herbs and foods. */
export const MINED_KEYS = Object.freeze([...MINED.keys()]);

/**
 * A material's standing: `{ key, family, tier, value, group?, templateIndex? }`, or null for a key the Stores never
 * hold. An herb's tier and value are its COMMONEST place's (nodeLaw herbTier): a plant common anywhere is a common
 * herb's worth everywhere - the one price a market can hold. A metal, ore, ingot, stone or gem is its row's.
 * @param {string} key
 * @param {(templateIndex: number) => number|null} herbTier nodeLaw's herbTier
 * @returns {{ key: string, family: string, tier: number, value: number, group?: string, templateIndex?: number }|null}
 */
export function materialOf(key, herbTier) {
  if (typeof key !== 'string') return null;
  const m = /^(p1|p2):(0|[1-9]\d{0,2})$/.exec(key);   // AUDIT 30 L1: one spelling - `p1:08` is no key (AUDIT 29 A1's law)
  if (m) {
    const templateIndex = Number(m[2]);
    if (!PLANT_GROUP_TEMPLATES[m[1]].includes(templateIndex)) return null;
    const tier = herbTier(templateIndex);
    if (!tier) return null;
    return { key, family: 'herbs', tier, value: HERB_VALUES[tier - 1], group: PLANT_GROUPS[m[1]], templateIndex };
  }
  if (FOOD_KEYS.includes(key)) return { key, family: 'food', tier: 1, value: TIER_VALUES[0] };
  const r = MINED.get(key);
  if (r) return { key, family: r.family, tier: r.tier, value: r.value ?? TIER_VALUES[r.tier - 1], ...(r.group ? { group: r.group } : {}), templateIndex: r.templateIndex };   // SEAT2b part two: a row's own worth (the Ram Kit's)
  return null;
}
/** Which profession gathers a material - a writ's XP goes to it. PROF4: wood is Logging's (a writ asks only logs). */
export const professionOfFamily = (family) => (family === 'herbs' || family === 'food' ? 'herbalism'
  : family === 'metals' || family === 'stone' || family === 'gems' ? 'mining' : family === 'wood' ? 'logging' : null);

// ─── MINING'S ACT (PROF0 5.2, 23; FORAGE0 14.4) ──────────────────────

/** The strikes a node takes by its tier: 4 (1-2), 5 (3-4), 7 (5-6). */
export const strikesFor = (tier) => (tier <= 2 ? 4 : tier <= 4 ? 5 : 7);
/** The glint: five points, one glinting `glintS` (`masterGlintS` at Master) x the Pick-Axe's band, a strike within
 *  `radiusDeg` of it counting double; one strike a `swingS`. The points' box: `spreadYawDeg` x `spreadPitchDeg` about
 *  the node's centre. */
export const MINE_ACT = Object.freeze({ points: 5, glintS: 1.2, masterGlintS: 2.0, radiusDeg: 2.5, swingS: 0.45, spreadYawDeg: 7, spreadPitchDeg: 4 });
/** The most strikes a finish can hold on the glint - every one of them, each counting two. */
export const glintsMax = (tier) => Math.ceil(strikesFor(tier) / 2);
/** A gem: 3% a strike on the glint (a Prospector's x1.1), on a confirmed pixel or dungeon only. */
export const GEM_CHANCE = 0.03;
export const PROSPECTOR_GEM = 1.1;
/** Deep Delver's dungeon veins, x1.5. */
export const DEEP_DELVER_MULT = 1.5;
/** Rough Stone cut at the rock: two make one (PROF0 4.5; Quarryman's 1 : 1 is the bench's, not the rock's). */
export const CUT_RATIO = 2;
/** The Pick-Axe's attribute pair (FORAGE0 14.4): (INT + AGI) / 2 - Foraging's average, the IL's Agility. */
export const pickAxeBand = ({ intelligence, agility }) => actBand(Math.trunc((intelligence + agility) / 2));

// ─── LOGGING'S ACT (PROF0 5.2, 25; FORAGE0 14.4) ─────────────────────

/** The chops a tree takes by its tier: 5 (1-2), 6 (3-4), 8 (5-6); a Lumberjack two fewer, three at least. */
export const chopsFor = (tier, lumberjack = false) => Math.max(3, (tier <= 2 ? 5 : tier <= 4 ? 6 : 8) - (lumberjack ? 2 : 0));
/**
 * THE RING: a circle shrinks from `ringFrom` times the notch's radius onto it over `ringS`, and on past it to
 * `ringTo`, then starts again; a chop while it stands within the band of the notch - `bandNovice` of its radius to
 * `bandMaster` at Master, x the Wood-Axe's band - is a Clean Cut, worth two chops. One chop a `swingS`; the tree creaks at
 * `creakAt` of its chops.
 */
export const CHOP_ACT = Object.freeze({ ringS: 0.9, ringFrom: 3, ringTo: 0.5, bandNovice: 0.12, bandMaster: 0.2, swingS: 0.45, creakAt: 0.5 });
/** The ring's band at a rank, x the attribute band: 12% at Novice to 20% at Master. */
export const ringBand = (rank, band = 1) => (CHOP_ACT.bandNovice + (CHOP_ACT.bandMaster - CHOP_ACT.bandNovice) * Math.max(0, Math.min(100, rank)) / 100) * band;
/** The most Clean Cuts a finish can hold - every chop clean, each counting two. */
export const cutsMax = (tier, lumberjack = false) => Math.ceil(chopsFor(tier, lumberjack) / 2);
/** The Wood-Axe's attribute pair (FORAGE0 14.4): (INT + STR) / 2 - Foraging's own. */
export const woodAxeBand = ({ intelligence, strength }) => actBand(Math.trunc((intelligence + strength) / 2));
/** Heartwood: 2% a Clean Cut (a Forester's x2), one at most, on confirmed ground. Resin: one tree in four. */
export const HEARTWOOD_CHANCE = 0.02;
export const FORESTER_MULT = 2;
export const RESIN_CHANCE = 0.25;

// ─── HUNTING'S ACT (PROF0 5.2, 29; FORAGE0 14.4) ─────────────────────

/**
 * THE TRACE: a dotted line of `4 + tier` points over the carcass (5 to 9 - PROF0 5.2), drawn with the crosshair: E held
 * within `startDeg` of the first point and along the line to the last (the Sickle's hold - attack is the weapon's). The points stand across `spanYawDeg`
 * of the body's face, a zigzag of up to `spanPitchDeg`. The score is 1 less the mean deviation over the tolerance -
 * `tolDeg` at Novice, half again at Master (`masterWiden`), x the knife's band - measured along the line the crosshair
 * drew every `stepDeg` (AUDIT 30 A1: a jump between two frames is its chord, never a free leap). A trace that took `minS`
 * to `maxS` and scored `clean` or more is a clean pelt; one under `torn` is torn. Gentle acts hold E `gentleS`.
 */
export const TRACE_ACT = Object.freeze({
  minPoints: 5, maxPoints: 9, spanYawDeg: 14, spanPitchDeg: 3, startDeg: 2.5, tolDeg: 3, masterWiden: 0.5,
  stepDeg: 0.25, minS: 0.6, maxS: 6, clean: 0.8, torn: 0.4, gentleS: 1.2,
});
/** The trace's points by the body's tier: 4 + tier, 5 at tier 1 to 9 at tier 5 and past it. */
export const tracePoints = (tier) => Math.max(TRACE_ACT.minPoints, Math.min(TRACE_ACT.maxPoints, 4 + (tier | 0)));
/** The trace's tolerance at a rank, x the knife's band (degrees). */
export const traceTolerance = (rank, band = 1) => TRACE_ACT.tolDeg * band * (1 + TRACE_ACT.masterWiden * Math.max(0, Math.min(100, rank)) / 100);
/** The Skinning Knife's attribute pair (FORAGE0 14.4): (INT + AGI) / 2, on Foraging's four bands. */
export const knifeBand = ({ intelligence, agility }) => actBand(Math.trunc((intelligence + agility) / 2));

// ─── SMELTING (PROF0 4.1, 23) ────────────────────────────────────────

/** A smelt, most units a request. */
export const SMELT_MAX = 100;
/** The use fee a Weaponsmith's or Armorer's forge asks, a smelt (gold, the purse's). */
export const FORGE_FEE = 50;
/** PROF4: a Furniture Store's workbench asks the same, a craft or a saw. */
export const WORKBENCH_FEE = 50;
/** PROF7 (PROF0 9.3): a Clothing Store's loom and tanning rack asks the same, a craft, a cure or a weave. */
export const LOOM_FEE = 50;
/**
 * PROF11 (PROF0 9.3: "Masonry (a mason's bench)"): WHERE THE BENCH STANDS. DECIDED: 9.3 names no shop for it (the forge
 * a Weaponsmith's or an Armorer's, the loom a Clothing Store's; PROF4 gave the workbench to the Furniture Store), and
 * Daggerfall has no stonemason's - so a GENERAL STORE's mason's bench, open for trade (its insideOpenShop latch, AUDIT 29
 * D4), at the others' use fee - 50 gold a cut, a mix or a carving, the purse's - or a home's `mason` station (HOME-
 * STATIONS' seventh, its licence the workbench's 50,000 - net/decorLaw.js), as the workbench and the loom stand. The
 * General Store because it is the one shop every town of a size keeps and the trades' own: its shelves already sell the
 * Pick-Axe that quarries the stone (FORAGE0 14.2's online shelves). The service cannot see the bench (as it cannot see
 * the forge, PROF0 23): the inputs are the Stores' and their units the bound; the client asks only where it stands.
 */
export const MASON_FEE = 50;
/**
 * PROF9 (PROF0 9.3: "Cooking (any campfire, hearth or brazier ...)"): THE FIRE COOKING IS DONE AT. DECIDED: any LIT fire
 * within Climates & Calories' own reach of its flame (survival/camp.js BY_FIRE_REACH) - a campfire (anyone's, a peer's
 * included), a hearth or a brazier (survival/hearth.js's world fires) - in the street, a building and a dungeon, in every
 * tier of the arc (scenes/camps.js fireNear: the world's fire, as a rest's place reads it). No fee: a fire is nobody's.
 * The service cannot see the fire (as it cannot see the forge, PROF0 23): the inputs are the Stores' and their units the
 * bound; the client asks only where one burns.
 */
export const COOK_FIRE = Object.freeze({ kind: 'fire', fee: 0 });
/**
 * PROF10 (PROF0 9.3: "Jewelcrafting (a jeweller's bench, or any Pawn Shop or Gem store for 50 gold)"): WHERE THE
 * JEWELLER'S BENCH STANDS - a Pawn Shop's or a Gem Store's, open for trade (its insideOpenShop latch, AUDIT 29 D4's law),
 * at 9.3's own fee - 50 gold a piece, the purse's - or a home's `jeweller` station (HOME-STATIONS' eighth, its licence
 * the workbench's 50,000 - net/decorLaw.js), as the loom and the mason's bench stand. The service cannot see the bench (as
 * it cannot see the forge, PROF0 23): the inputs are the Stores' and their units the bound; the client asks only where it
 * stands.
 */
export const JEWEL_FEE = 50;
/**
 * A forge's or a workbench's work, no act (PROF0 4.1, 4.2, 25): `out` made from `inputs`, `per` a unit - or `more.per`
 * for a character standing under `more.spec`, their `more.profession`'s choice at `more.rank` (100 unless it says: a
 * Quartermaster's ingots, a Charcoal Burner's charcoal, a Timberwright's planks; PROF7 a Tanner's leather, a choice at
 * 50); `station` where it is done; `xp` the track it raises (10 x the product's tier a unit) or null (a log's XP was
 * its fall's - PROF0 25; a hide's its skinning's - PROF0 29).
 */
const recipe = (id, out, inputs, { station = 'forge', per = 1, more = null, xp = 'smithing' } = {}) =>
  Object.freeze({ id, out, inputs: Object.freeze(inputs.map(([key, n]) => Object.freeze({ key, n }))), station, per, more, xp });
const QUARTERMASTER = Object.freeze({ profession: 'smithing', spec: 'quartermaster', per: 2 });
const ingot = (id, inputs) => recipe(id, id, inputs, { more: QUARTERMASTER });
/** The forge's recipes, in the window's order: two of a raw metal an ingot; Steel an Iron Ingot and a Charcoal; Brass
 *  a Copper and a Tin. Daedric waits on its heart and its stone (PROF0 23). */
export const SMELT_RECIPES = Object.freeze([
  ingot('ingot:iron', [['metal:iron', 2]]),
  ingot('ingot:steel', [['ingot:iron', 1], ['wood:charcoal', 1]]),
  ingot('ingot:silver', [['metal:silver', 2]]),
  recipe('metal:brass', 'metal:brass', [['metal:copper', 1], ['metal:tin', 1]]),   // Brass is a metal, not an ingot (PROF3)
  ingot('ingot:moonstone', [['ore:moonstone', 2]]),
  ingot('ingot:dwarven', [['ore:dwarven', 2]]),
  ingot('ingot:mithril', [['ore:mithril', 2]]),
  ingot('ingot:adamantium', [['ore:adamantium', 2]]),
  ingot('ingot:ebony', [['ore:ebony', 2]]),
  ingot('ingot:orichalcum', [['ore:orichalcum', 2]]),
]);
/** PROF4 (PROF0 4.2, 25): a log burns to a Charcoal at a forge (a Charcoal Burner's two); a log saws to two planks of its
 *  wood at a workbench (a Timberwright's three). No XP. */
export const BURN_RECIPES = Object.freeze(LOGS.map((l) => recipe(`burn:${woodOf(l.key)}`, CHARCOAL.key, [[l.key, 1]],
  { more: Object.freeze({ profession: 'logging', spec: 'charcoal-burner', per: 2 }), xp: null })));
export const SAW_RECIPES = Object.freeze(LOGS.map((l) => recipe(`saw:${woodOf(l.key)}`, `plank:${woodOf(l.key)}`, [[l.key, 1]],
  { station: 'workbench', per: 2, more: Object.freeze({ profession: 'logging', spec: 'timberwright', per: 3 }), xp: null })));
/** PROF7 (PROF0 4.4, 4.5, 29): a hide cures to its leather at the tanning rack - two a leather, a Tanner's one (a unit
 *  of work two hides, and a Tanner's makes two); Spider Silk weaves to a Silk Bolt at the loom, three a bolt. The rack
 *  and the loom are Outfitting's one station. No XP: a hide's was its skinning's, as a log's was its fall's (PROF0 25). */
export const CURE_RECIPES = Object.freeze(HIDES.filter((h) => h.cures).map((h) => recipe(`cure:${h.key.slice('hide:'.length)}`, /** @type {string} */ (h.cures), [[h.key, 2]],
  { station: 'loom', more: Object.freeze({ profession: 'hunting', spec: 'tanner', per: 2, rank: 50 }), xp: null })));
export const WEAVE_RECIPES = Object.freeze([recipe('weave:silk', SILK.key, [['hide:spider', 3]], { station: 'loom', xp: null })]);
/** PROF11 (PROF0 4.5): Mortar a mix makes - "ten at a time". */
export const MORTAR_BATCH = 10;
/** PROF11 (3.3): the Quarryman's cut - "Rough Stone cuts 1:1, not 2:1" - a choice at 50: a unit of the cut is two Rough
 *  Stone, and a Quarryman's makes two Cut Stone of them (the Tanner's shape, PROF7). The bench's alone - the cut at the
 *  rock stays CUT_RATIO's 2 : 1 (PROF0 23). */
const QUARRYMAN = Object.freeze({ profession: 'masonry', spec: 'quarryman', per: 2, rank: 50 });
/**
 * A MASON'S WORK (PROF11): the forge's work's shape at the mason's bench (`station: 'mason'`), raising Masonry - and
 * unlike every other work, a CRAFT's law: `tier` the rank it asks (TIER_RANKS - `rank`, read by workOpen), its XP the
 * craft's (recipeLaw masonXp: 20 a tier a unit, +500 the first, 3.2) and its act the chisel (`act`, 9.4). DECIDED: the
 * cut's tier is its stone's - Rough Stone's 1, as a smith's recipe is its ingot's and a carpenter's its wood's (PROF3,
 * PROF4), so a Novice mason has work at rank 0 as every other craft does; Mortar's its own 2 (4.5), at rank 10.
 */
const masonWork = (id, out, inputs, tier, opts = {}) => Object.freeze({
  ...recipe(id, out, inputs, { station: 'mason', xp: 'masonry', ...opts }), tier, rank: TIER_RANKS[tier - 1], act: 'chisel',
});
/** PROF11 (PROF0 4.5, 9.3): THE MASON'S BENCH's works - Cut Stone from Rough Stone 2 : 1 (a Quarryman's 1 : 1), and
 *  Mortar ten at a time from 1 Sulphur, 1 Lead and 5 Rough Stone - in its window's order. */
export const MASON_RECIPES = Object.freeze([
  masonWork('cut:stone', CUT_STONE.key, [[ROUGH_STONE.key, CUT_RATIO]], ROUGH_STONE.tier, { more: QUARRYMAN }),
  masonWork('mix:mortar', MORTAR.key, [['metal:sulphur', 1], ['metal:lead', 1], [ROUGH_STONE.key, 5]], MORTAR.tier, { per: MORTAR_BATCH }),
]);
/** PROF12 (3.3: "Transmuter - two of a DFU metal and a Mercury make one of the next up (Tin, Copper, Silver, Gold,
 *  Platinum)" - AUDIT PROF12 E3; 4.1: "Mercury (Alchemy's Transmuter)"): the ladder, in its order. */
export const TRANSMUTE_LADDER = Object.freeze(['metal:tin', 'metal:copper', 'metal:silver', 'metal:gold', 'metal:platinum']);
/** The Transmuter - Alchemy's choice at 100 - the one door to a transmutation (`spec`, smeltAtForge's `prof-transmuter`). */
export const TRANSMUTER = Object.freeze({ profession: 'alchemy', rank: 100, id: 'transmuter' });
/** Two of a metal a transmutation takes, and the Mercury that turns them (4.1) - AUDIT PROF12 E3 (Mac: "2 + Mercury -> 1"):
 *  Mac's choice, 2026-10-03, over 3.3's three - a Mercury and two of a metal make one of the next. */
export const TRANSMUTE_IN = 2;
export const TRANSMUTE_MERCURY = 1;
/**
 * PROF12: THE TRANSMUTATIONS - a work at the alchemy station (`station: 'alchemy'`), the forge's shape: two of a metal and
 * one Mercury make one of the next up the ladder, a unit of work at a time (SMELT_MAX a request). DECIDED: the Mercury is
 * 4.1's ("Mercury (Alchemy's Transmuter)") - the metal that turns the others, spent once a transmutation; no XP (`xp: null`):
 * a Transmuter stands at 100, where the track is full; and the door is the choice at 100 (`spec`), asked by the service
 * before anything moves. Own only where every unit that went in was (the smelt's origin, smeltOrigin).
 */
export const TRANSMUTE_RECIPES = Object.freeze(TRANSMUTE_LADDER.slice(0, -1).map((from, i) => Object.freeze({
  ...recipe(`transmute:${from.slice('metal:'.length)}`, TRANSMUTE_LADDER[i + 1], [[from, TRANSMUTE_IN], ['metal:mercury', TRANSMUTE_MERCURY]], { station: 'alchemy', xp: null }),
  spec: TRANSMUTER,
})));
/** PROF12: whether a work's choice (`r.spec` - the Transmuter's) stands for a track's choices (specsAt's `{ 50, 100 }`) -
 *  every work that asks none is open. */
export const workSpecOk = (r, specs) => !r?.spec || specs?.[r.spec.rank] === r.spec.id;
/** Every work of the forge, the workbench and the loom - PROF11: and the mason's bench; PROF12: and the alchemy station's
 *  transmutations - by its id. */
export const WORK_RECIPES = Object.freeze([...SMELT_RECIPES, ...BURN_RECIPES, ...SAW_RECIPES, ...CURE_RECIPES, ...WEAVE_RECIPES, ...MASON_RECIPES, ...TRANSMUTE_RECIPES]);
export const smeltRecipe = (id) => WORK_RECIPES.find((r) => r.id === id) ?? null;
/** PROF11: whether a rank may do a work - a mason's asks its tier's rank (masonWork); every other work asks none. */
export const workOpen = (r, rank) => !!r && rank >= (r.rank ?? 0);
/** The rank a work's raising choice is made at: its own (a Tanner's 50), else 100. */
export const workSpecRank = (r) => r.more?.rank ?? 100;
/** The products a unit of work makes, for a character whose choices at the work's rank are `specsAt` ({ profession: spec }
 *  - the choice at workSpecRank, PROF7; the choices at 100 before it). */
export const workPer = (r, specsAt = {}) => (r.more && specsAt?.[r.more.profession] === r.more.spec ? r.more.per : r.per);
/** Smithing XP a smelt: 10 x its tier a unit (PROF0 4.1) - a quarter for a recipe more than two tiers below the smith's
 *  rank's top (3.2's "a node or recipe"; AUDIT 29 A7: a Master smelting Iron took it whole). */
export function smeltXp(tier, units, rank = 0) {
  const xp = 10 * tier * units;
  return tier < topTierOf(rank) - 2 ? Math.floor(xp / 4) : xp;
}
/**
 * THE ORIGIN OF A SMELT'S UNITS (PROF0 7, 23): `count` products, each input spent bought-first (`bought[i]` the
 * bought units of input i the Stores hold). Product j takes input i's units j*n_i .. (j+1)*n_i - 1 in that order, so
 * it is bought when any of them is: the bought products are the most any input's bought units reach.
 * @returns {{ own: number, bought: number }}
 */
export function smeltOrigin(r, count, bought) {
  let b = 0;
  r.inputs.forEach((inp, i) => { b = Math.max(b, Math.ceil(Math.min(Math.max(0, bought[i] ?? 0), inp.n * count) / inp.n)); });
  b = Math.min(count, b);
  return { own: count - b, bought: b };
}
/** THE CRAFTER'S LIMIT (PROF0 3.2): a character raises at most two crafts past Journeyman. A craft that is not one of
 *  them while two others are stops at rank 50 - the XP one short of rank 51. `ranks` every crafting track's rank. */
export function craftXpCap(profession, ranks) {
  const past = Object.entries(ranks ?? {}).filter(([p, r]) => p !== profession && BY_ID.get(p)?.kind === 'crafting' && r > JOURNEYMAN_RANK).length;
  return past >= CRAFTS_ABOVE_JOURNEYMAN ? xpForRank(JOURNEYMAN_RANK + 1) - 1 : PROF_XP_MAX;
}

// ─── PROF11: THE BUILDER AND THE FORTIFIER - SEAT2b'S TO CALL (PROF0 3.3; SEAT0 7.5) ───
//
// Masonry's two seat choices act on what SEAT2b builds - the fortification projects (SEAT0 7.5: each tier's materials
// delivered to the seat's stockpile by writs) and a capture's tier down ("When the seat changes hands each drops one
// tier") - and no fortification stands yet. So the law and its helpers stand here, pure and pinned
// (test/prof11_law.test.js), for SEAT2b to call; which member's choice stands for a seat (a project's Builder, a
// capture's Fortifier) is SEAT2b's to say. Both are chosen now - they cost nothing until a seat reads them.

/** The Builder (3.3: "fortification projects need 10% less stone"): the share of a project's stone taken off, percent. */
export const BUILDER_STONE_OFF_PCT = 10;
/** Whether a track stands as a Builder - its choice at 50 (specsAt's shape, `{ 50, 100 }`). */
export const isBuilder = (specs) => specs?.[50] === 'builder';
/**
 * The stone a fortification project needs: `need` units, a Builder's a tenth fewer - rounded UP (DECIDED: a need of
 * whole units is never cut by more than 3.3's tenth; every SEAT0 7.5 count is a multiple of ten, so its 400 is 360 and
 * its 1,600 1,440 exactly). A need that is no whole count is none.
 */
export function fortificationStone(need, builder = false) {
  if (!Number.isSafeInteger(need) || need <= 0) return 0;
  return builder ? Math.ceil((need * (100 - BUILDER_STONE_OFF_PCT)) / 100) : need;
}
/**
 * A project's needs (`{ [material]: units }` - SEAT0 7.5's "400 Cut Stone, 100 Oak Planks"), a Builder's stone cut
 * (fortificationStone) - the stone the Stores' 'stone' family holds (Cut Stone, the 7.5 table's; Rough Stone and Mortar
 * where a project asks them); every other material, and the Marks (no material), as asked. A fresh object.
 */
export function fortificationNeeds(needs, builder = false) {
  const out = {};
  for (const [key, n] of Object.entries(needs ?? {})) out[key] = minedMaterial(key)?.family === 'stone' ? fortificationStone(n, builder) : n;
  return out;
}
/** The Fortifier (3.3: "once a Season a seat's Walls skip their drop on capture"): the saves a Fortifier has a Season. */
export const FORTIFIER_SAVES_A_SEASON = 1;
/** The one work a Fortifier keeps from its drop: the Walls (SEAT0 7.5's first row) - every other drops its tier. */
export const FORTIFIER_WORK = 'walls';
/** Whether a track stands as a Fortifier - its choice at 100. */
export const isFortifier = (specs) => specs?.[100] === 'fortifier';
/** SEAT2b part two (3.3: "Siegewright - Rams +50% vitality; siege works a day sooner"): a character standing as a
 *  Siegewright - Carpentry's choice at 100 (`specs` its Carpentry track's, specsAt). */
export const isSiegewright = (specs) => specs?.[100] === 'siegewright';
/** Whether a Fortifier who has saved Walls `saves` times this Season (SEAT2b keeps the count, a Season's) may save more. */
export const fortifierReady = (saves = 0) => (Number.isSafeInteger(saves) ? saves : FORTIFIER_SAVES_A_SEASON) < FORTIFIER_SAVES_A_SEASON;
/**
 * A seat's WALLS AT A CAPTURE (SEAT0 7.5: one tier down): `{ tier, saved }` - kept at their tier, and the save `saved`
 * (SEAT2b counts it to the Fortifier's Season), where a Fortifier stands for them whose Season's save is unspent; else
 * one tier down. Walls at tier 0 have no drop to skip and spend no save. `fortifier` - whether a Fortifier stands for
 * the seat's Walls; `saves` - the saves that Fortifier has spent this Season.
 */
export function wallsOnCapture(tier, { fortifier = false, saves = 0 } = {}) {
  const t = Number.isSafeInteger(tier) && tier > 0 ? tier : 0;
  if (t === 0) return { tier: 0, saved: false };
  if (fortifier === true && fortifierReady(saves)) return { tier: t, saved: true };
  return { tier: t - 1, saved: false };
}

// ─── COURT WRITS (PROF0 11) ──────────────────────────────────────────

/** A region's Court writs a UTC day: 6 x max(1, ceil(active / 100)). */
export const courtWritCount = (active) => 6 * Math.max(1, Math.ceil(Math.max(0, Number(active) || 0) / 100));
/** Court writs an account fills a UTC day - the faucet's cap (MARKS_FAUCETS.writ). */
export const COURT_WRITS_PER_DAY = 3;
/** The units a writ of each tier asks, in tens (so the pay and the Renown are whole): [least, most]. */
export const WRIT_UNITS = Object.freeze({
  1: Object.freeze([20, 50]), 2: Object.freeze([10, 40]), 3: Object.freeze([10, 30]), 4: Object.freeze([10, 30]),
  5: Object.freeze([10, 20]), 6: Object.freeze([10, 20]), 7: Object.freeze([10, 10]),
});
/** A writ's pay: units x the material's Marks value x 1.2. */
export const writPay = (units, value) => (units * value * 6) / 5;
/** A writ's Renown XP: 25 x tier x units / 10 at the full rate - MERGE 2 (main's RENOWN-ACCOUNT, Mac: "reducing the
 *  accumulation of renown from resources a bit"): at renown.js RENOWN_RATE_PCT, three quarters, taken by its one door
 *  (renownRate, floored to a whole XP), as every other source's is. A tier-2 writ of 30 units, 150 at the full rate,
 *  pays 112. */
export const writRenown = (tier, units) => renownRate((25 * tier * units) / 10);
/** The weights the day's ordinary writs draw their tier by (the nodes' 40 / 25 / 15 / 10 over tiers 1-4). */
export const WRIT_TIER_WEIGHTS = Object.freeze([40, 25, 15, 10]);
