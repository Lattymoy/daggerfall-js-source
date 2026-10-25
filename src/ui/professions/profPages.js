// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF1 (2026-09-28, Mac: "actual UI integration for life skills") -
// THE PROFESSIONS AND STORES PAGES of the character sheet: the
// Professions page on the pause window's Stats rail (ui/enhanced/enhancedMenu.js),
// beside Character, Attributes and Skills, and the Stores page on its
// Holdings rail (HOLDINGS, 2026-10-03, moved it there with the other
// things the player holds) - the sheet's own bones (bible/06-Systems/
// Professions-Arc.md 8, 21, 22). Online only, and only while the
// professions are this account's: the host registers its book here
// (`setProfessionsPages`), and a page with nothing behind it is never
// drawn (PX14's drawn door).
//
//   THE PROFESSIONS PAGE - the thirteen in two groups, Gathering and
//   Crafting, each a row with its rank, its rank's name and a thin bar;
//   the chosen one below: the XP to the next rank, today's harvests, the
//   specialisation cards at 50 and 100 (choose one - a change of mind
//   is free for a day after a choice, then costs 1,000 Marks and locks
//   the next for a week - PERK-TRIAL - and is pressed twice), the unlocks by
//   rank, and the crafter's limit.
//   THE STORES PAGE - the materials with their counts, own and bought;
//   the families to filter by, a search, the sort; a material's action:
//   Withdraw to pack, a quantity. (Delivering to a writ is the Notice
//   Board's Work tab; listing comes with the market, PROF5.) PROF2: THE
//   FORGE under it - the smelts, while the player stands at a forge (a
//   Weaponsmith's or an Armorer's, its fee a smelt; a home's forge).
//   PROF3: THE ANVIL beside it. PROF4: the Forge burns logs to Charcoal,
//   and THE WORKBENCH - the saws and Carpentry's recipes, with the plane
//   - while the player stands at one (a Furniture Store's, its fee a
//   craft or a saw; a home's workbench). PROF7: THE LOOM - the tanning
//   rack's cures, the weave, and Outfitting's recipes with the stitch and
//   a garment's dye - at a Clothing Store (its fee a craft, a cure or a
//   weave) or a home's loom. PROF11: THE MASON'S BENCH - the cut (Rough
//   Stone to Cut Stone) and the mix (Mortar) with the chisel, and the
//   Sculptor's stone decor - at a General Store (its fee a cut, a mix
//   or a carving) or a home's mason's bench. PROF9: THE FIRE - Cooking's
//   dishes with the pan, at any lit fire (a campfire, a hearth, a
//   brazier), no fee. PROF10: THE JEWELLER'S BENCH - Jewelcrafting's
//   pieces by piece, metal and gem, with the facet, at a Pawn Shop or a
//   Gem Store (its fee a piece) or a home's jeweller's bench. PROF12:
//   THE ALCHEMY STATION - DFU's twenty brewed from the Stores (no act:
//   DFU's windows stay 1:1), the Apothecaries' sixteen bought where a
//   cauldron is short, a Transmuter's transmutations - at an Alchemist's
//   (its fee a brew) or a home's alchemy station; THE ENCHANTING STATION
//   - the pack's crafted pieces disenchanted into Arcane Essence, at a
//   Mages Guild hall (its fee a piece) or a home's enchanting station.
//
// The pages draw with the menu's own kit (its `el`, divider and meter,
// handed in), so they are the sheet's pages and not a second window.
// ═══════════════════════════════════════════════════════════════════
import { clampCarried, carriedTotal, DEPOSIT_MAX, BAG_WORDS, LOOSE_ORIGIN } from '../../net/bagLaw.js';   // BAG1: what a character carries; CLOTH-GEMS: a station's loose units, spent first
import {
  PROFESSIONS, SPECIALISATIONS, SPEC_RANKS, RESPEC, xpForRank, rankName, PROF_RANK_MAX, TIER_RANKS, CRAFTS_ABOVE_JOURNEYMAN, specTrialShown,   // PERK-TRIAL
  JOURNEYMAN_RANK, MATERIAL_FAMILIES, HIGH_HIDES_PER_DAY, WITHDRAW_MAX, professionName, SMELT_RECIPES, SMELT_MAX, FORGE_FEE,
  withdrawable, stockOf, STOCK_MAX, BURN_RECIPES, SAW_RECIPES, WORKBENCH_FEE, WOODS, workPer, workSpecRank, CURE_RECIPES,
  WEAVE_RECIPES, SPIN_RECIPES, LINEN, LOOM_FEE, WEAVERS_STOCK, STANDARD_SILK,   // CLOTH-GEMS: the loom's Linen and Wool
  gemGradeOfKey,   // CLOTH-GEMS: a gem's grade at the jeweller's bench
  MASON_RECIPES, MASON_FEE, workOpen,   // PROF11: the mason's bench
  JEWEL_FEE,   // PROF10: the jeweller's bench
  ALCHEMY_FEE, ENCHANT_FEE, TRANSMUTE_RECIPES, TRANSMUTER, APOTHECARY_STOCK,   // PROF12: the alchemy and enchanting stations
  STORES_MAX, ARCANE_ESSENCE,   // AUDIT PROF-541 B8: a disenchant's room in the Stores
  smeltRecipe,   // CRAFT1: a chain's works said
  trackOf, disciplinesOf, disciplineName, specDiscipline,   // CRAFT3: five crafts of eight disciplines
  SURVEYOR, specOf,   // MINE-PERKS: Mining 100's Surveyor, whose own word witnesses the ground; its name, the card's
  craftLimitOf,   // CRAFT-LIMIT-SAID: the crafter's limit over a track, as the service's decisions bind it
} from '../../net/professionLaw.js';
import { xpPct } from '../../net/firmament/firmamentLaw.js';   // CRAFT-LIMIT-SAID: the Firmament's hand on a craft's XP, as the service applies it
import { GEM_GRADES } from '../../systems/loot/gemGrades.js';   // CLOTH-GEMS: the grades the jeweller's bench lists, poorest first
import { firmamentStats } from '../../systems/firmamentLive.js';   // CRAFT-LIMIT-SAID: the stars in force
import {
  POTIONS, brewKeys, brewSpends, brewCount, potentChance, potentPct, potentLasts, potentAble, brewXp, brewFirstXp, ingredientKeys, DISTILLER, POTENT,   // FIRST-BUDGET: a brew's first, Provisioning's first-make share
  enchantDiscountPct, DISENCHANTER, disenchantXp, essenceOf,
  piecePoints, ESSENCE_POINTS,   // DISENCHANT-SAID: the station's list made here, and a piece under one Essence said
} from '../../net/alchemyLaw.js';   // PROF12: Alchemy's brew, Enchanting's layer and Disenchanting
import {
  RECIPES, recipeOpen, qualityOdds, QUALITY_NAMES, HEAT_ACT, takesQuality, rollsQuality, recipeInputs, takesHeartwood, PLANE_ACT, STITCH_ACT,
  GARMENT_DYES, MASONRY_RECIPES, CHISEL_ACT, chiselStrikes, chiselMarkS, SCULPTOR,   // PROF11: the Sculptor's stone and the chisel
  COOKING_RECIPES, dishOf, dishEffectText, dishHand, craftCount, cookXp, panCount, panWindow, HAND_PROVISIONER,   // PROF9: the fire's dishes and the pan
  JEWELCRAFTING_RECIPES, JEWEL_PIECES, jewelBases, jewelHand, jewelPointsPct, jewelPoints, takesCracked, masterworkSpec, facetCount,
  facetWindow, LAPIDARY, JEWEL_HAND_GOLDSMITH, JEWEL_HAND_GEMCUTTER, gemWord,   // PROF10: the jeweller's pieces and the facet
  recipeById,   // AUDIT PROF12 E2: a disenchant's XP is its piece's recipe's tier
  counterMade,   // CLOTH-GEMS: the recipes AUDIT 32 S1 judges by their units
  patternsOf,   // CRAFT2: a station lists its patterns, the material chosen from what is held
} from '../../net/recipeLaw.js';
import { craftXpLine, dishFirstLine, masonWorksFirstLine, capLine, paidXp, limitRuleLine } from '../craftXpWords.js';   // CRAFT-FIRST-SHOWN: what a craft pays, and its first, said in its box; CRAFT-LIMIT-SAID: as the service credits it
import { temperableRecipe, temperCost, temperXp, REFORGE_RANK, REFORGE_ESSENCE, reforgeEssence } from '../../net/temperLaw.js';   // CRAFT4: the temper and the Reforge with Essence
import { reforgeCount } from '../../systems/loot/lootRarity.js';   // REFORGE-REPLACE: the reforges a piece has taken - its next price
import { createStitchAct } from '../../systems/stitchAct.js';
import { createChiselAct } from '../../systems/chiselAct.js';   // PROF11
import { createPanAct } from '../../systems/panAct.js';   // PROF9
import { createFacetAct } from '../../systems/facetAct.js';   // PROF10
import { templateByIndex } from '../../systems/item/itemTemplates.js';   // PROF10: a piece's DFU template - its enchantment points
import { itemLongName } from '../../systems/item/itemInfo.js';   // DISENCHANT-SAID: a piece the station lists, named as the pack names it
import { tradeRefusal } from '../../systems/tradePack.js';   // DISENCHANT-SAID: a piece that may not leave the pack is not the station's (PROF12)
import { isLocked } from '../../systems/item/itemLock.js';   // DISENCHANT-SAID: nor a locked one (PROF5)
import { DYE_NAMES } from '../../characters/dyes.js';
import { isTextEntryTarget, isDomControlTarget } from '../input.js';   // AUDIT 30 A9: a field's keys and a button's are their own
import { createHeatAct } from '../../systems/heatAct.js';
import { createPlaneAct } from '../../systems/planeAct.js';
import { material } from '../../net/nodeLaw.js';
import { marksText } from '../../net/marksLaw.js';   // AUDIT 32 R13: "1 Drake", as the Market tab says it
import { accountRefusalText } from '../../net/accountClient.js';
import { chainPlan, chainNeeded, chainYield, storesRoom } from '../../net/chainLaw.js';   // CRAFT1: the works a craft's inputs want first
import { getPref, setPref } from '../../systems/uiPrefs.js';
import { pictureNode } from '../menu/menuGlyphs.js';   // MENU-ORDER: a material's picture, the host's
import { t, localizedText, formatMessage, formatNumber, intlLocale } from '../../systems/textManager.js';   // L10N4: the pages' words in the player's language; the smith's lone metals, Leather, Arrows and All are DFU's own

/**
 * @typedef {object} ProfPagesProvider
 * @property {any} book                                   net/profBook.js - the character's professions
 * @property {(key: string) => string} name               a material's name (systems/professions/profItems.js materialLabel)
 * @property {(key: string, wake: () => void) => ({ src: string, w: number, h: number }|null)} [picture]   MENU-ORDER: a material's picture (ui/menu/menuPicture.js), null while made
 * @property {(key: string, qty: number) => Promise<{ ok: boolean, text: string }>} withdraw   out of the Stores, into the pack
 * @property {() => ({ kind: 'shop'|'home', fee: number }|null)} [forge]   PROF2: the forge the player stands at, or null
 * @property {(recipe: string, count: number, opts?: { clean?: boolean }) => Promise<{ ok: boolean, text: string }>} [smelt]   PROF2: a
 *   smelt, its fee paid; PROF11: or a mason's work, `clean` the chisel's report
 * @property {() => Promise<any>} [settle]   AUDIT 29 C4: the kept withdrawals asked again (the Stores page opened)
 * @property {(recipe: string, opts: { clean: boolean, heartwood?: boolean, dye?: number|null, cracked?: boolean }) => Promise<{ ok: boolean, text: string }>} [craft]
 *   PROF3: a craft at the anvil (PROF4: or the workbench, by the recipe's profession; PROF7: or the loom, a garment's
 *   `dye`; PROF10: or the jeweller's bench, a Lapidary's `cracked` gem), its pieces made and its fee paid
 * @property {(material: string, qty: number, counter?: string) => Promise<{ ok: boolean, text: string }>} [stock]   PROF3: the
 *   smith's stock (PROF4: and the furnisher's; PROF7: the Weavers' at the tailor's loom - `counter`)
 * @property {() => number} [heatBand]   PROF3: the heat's attribute band (recipeLaw heatBand)
 * @property {() => ({ kind: 'shop'|'home', fee: number, who?: string, yard?: boolean }|null)} [workbench]   PROF4: the workbench the player stands at; CARP-YARD: a joinery's names its carpenter (`who`) and is a yard's (`yard`)
 * @property {() => number} [planeBand]   PROF4: the plane's attribute band (recipeLaw planeBand)
 * @property {() => number} [purse]   AUDIT 30 U13: the gold the player carries - a station's fee the purse cannot meet is
 *   not offered (the heat was struck, and then the smith refused)
 * @property {() => ({ kind: 'shop'|'home', fee: number }|null)} [loom]   PROF7: the loom the player stands at
 * @property {() => number} [stitchBand]   PROF7: the stitch's attribute band (recipeLaw stitchBand)
 * @property {() => 'MensClothing'|'WomensClothing'} [clothing]   PROF7: the clothing the loom shows first - the player's own,
 *   as DFU's Clothing Store shelves it
 * @property {() => (number|null)} [marks]   AUDIT 32 P6: the Marks held (the Bank's book), or null unknown - a counter's
 *   purchase the balance cannot meet is held and said
 * @property {() => boolean} [marksOpen]   AUDIT 32 P6: whether Marks are struck at all - a counter is offered only then
 * @property {() => ({ kind: 'shop'|'home', fee: number }|null)} [mason]   PROF11: the mason's bench the player stands at
 * @property {() => number} [chiselBand]   PROF11: the chisel's attribute band (recipeLaw chiselBand)
 * @property {() => ({ kind: 'fire', fee: number }|null)} [fire]   PROF9: the fire the player stands at (a campfire, a hearth, a
 *   brazier - within C&C's reach of its flame), or null
 * @property {() => number} [panBand]   PROF9: the pan's attribute band (recipeLaw panBand)
 * @property {() => boolean} [skillet]   PROF9: whether the pack holds C&C's Skillet (the pan's window half again)
 * @property {() => number} [cookSteps]   AUDIT PROF-541 K7: the town Apothecary's steps a dish's XP takes here (0 where my guild holds no hall)
 * @property {() => ({ kind: 'shop'|'home', fee: number }|null)} [jeweller]   PROF10: the jeweller's bench the player stands at
 * @property {() => number} [facetBand]   PROF10: the facet's attribute band (recipeLaw facetBand)
 * @property {() => number} [jewelSteps]   AUDIT PROF-541 R2-C6: the town Apothecary's quality steps a piece takes here (0 where my guild holds no hall)
 * @property {() => ({ kind: 'shop'|'home', fee: number }|null)} [alchemy]   PROF12: the alchemy station the player stands at
 * @property {(potion: string, keys: string[]) => Promise<{ ok: boolean, text: string }>} [brew]   PROF12: a brew, its potions
 *   into the pack and its fee paid
 * @property {() => number} [alchemySteps]   AUDIT PROF-541 B4: the Apothecary's steps of the town the station stands in,
 *   where the player's guild holds it (fortLaw stationSteps) - 0 elsewhere
 * @property {() => ({ kind: 'shop'|'home', fee: number }|null)} [enchanter]   PROF12: the enchanting station the player stands at
 * @property {() => Array<{ provenance: string, name: string, points: number, essence: number, recipe?: string }>} [disenchantable]   PROF12: the
 *   pack's crafted pieces the enchanting station lists (disenchantableOf), each its points and its Essence (AUDIT PROF12 E2:
 *   and its recipe, the XP's tier) - the pieces it may take apart, and (DISENCHANT-SAID) those whose points make no
 *   Essence, `essence` 0, which the page greys with the reason and the station never takes apart
 * @property {(provenance: string) => Promise<{ ok: boolean, text: string }>} [disenchant]   PROF12: a piece taken apart
 * @property {(where: 'anvil'|'loom') => Array<{ item: any, name: string, recipe: string, quality: number, provenance: string|null }>} [temperable]
 *   CRAFT4: the pack's pieces the station's craft tempers (the smith's at the anvil, the tailor's at the loom), each its
 *   recipe and its quality
 * @property {(offer: { item: any, name: string, recipe: string, quality: number, provenance: string|null }) => Promise<{ ok: boolean, text: string }>} [temper]
 *   CRAFT4: a temper, the step laid on the piece and the station's fee paid
 * @property {() => Array<{ item: any, name: string, tier: string, lines: Array<{ index: number, text: string }> }>} [reforgeable]
 *   CRAFT4: the pack's known Magic and Rare pieces an Enchanter reforges with Essence, each line it may roll
 * @property {(offer: { item: any, name: string, tier: string }, index: number) => Promise<{ ok: boolean, text: string }>} [essenceReforge]
 *   CRAFT4: a line replaced for Arcane Essence (REFORGE-REPLACE: by another kind)
 * @property {(plan: { material: string, qty: number, order: string }[]) => Promise<{ ok: boolean, text: string, kept?: boolean }[]>} [deposit]   BAG1:
 *   carried units of a material - out of the bag and the pack - into the Stores; FB1020c ONE-SAVE: a plan of put-ins as
 *   one batch (profBook.js depositMany - one save for them all), one answer a put-in, in order
 * @property {() => boolean} [inTown]   BAG1: whether the Stores are reached here - in a town, indoors or out
 * @property {(key: string) => number} [room]   BAG1: how many more units of a material the bag and the pack can take
 * @property {(key: string) => number} [carriedHeld]   BAG1: how many units of a material the bag and the pack hold
 * @property {() => string[]} [heldKeys]   UNCOUNTED: every material the bag, the pack and the wagon hold an item of
 * @property {() => ({ has: boolean, kg: number, max: number, count?: number })} [bag]   BAG1: the Materials Bag - held, its load and
 *   its limit (AUDIT2: and how many pieces its list holds)
 * @property {() => ({ moved: number, left: number })} [emptyBag]   AUDIT2 BAG1 H1/U2: every piece in the bag into the pack, as much
 *   as the pack carries - anywhere, on either skin
 */
let _provider = /** @type {ProfPagesProvider|null} */ (null);
/** BAG-CRAFT (FIELD BUGS 2026-10-09d, Mac: "I just want players to also be able to craft from their inventory, not just
 *  the store"): WHAT A STATION MAY WORK OF A MATERIAL - every station's read, one home: the book's `workable` (the Stores,
 *  and the bag, the pack and the wagon counted or not - net/profBook.js); a book that has none answers its `held`. */
const workOf = (/** @type {any} */ book, /** @type {string} */ k) => (typeof book?.workable === 'function' ? book.workable(k) : book.held(k));
/** The host's book, or null to take the pages down (offline, a closed switch, the host gone). */
export function setProfessionsPages(p) { _provider = p ?? null; }
/** What a locked specialisation's card says it waits for (professionLaw.js `later`). */
const LATER_WORDS = Object.freeze({
  get SEAT2() { return t('prof.page.later.seat2', 'Comes with the sieges'); }, get SEAT2b() { return t('prof.page.later.seat2b', 'Comes with the fortifications'); },   // PROF11: the Builder's and the Fortifier's
  // PROF7 (Professions-Arc.md 29): what DFU gives these nothing to stand as - for Mac
  get trophy() { return t('prof.page.later.trophy', 'Comes when trophies are added'); },
  get 'two-colour'() { return t('prof.page.later.twoColour', 'Comes when cloth can take a second dye'); },   // AUDIT 32 R11: never "DFU" where a player reads it; BR5: nor the game's name - the original game, the classic
  get wagon() { return t('prof.page.later.wagon', 'Comes when wagons can be upgraded'); },
});
/** Whether the pages stand: a book, and the professions this account's. */
export const profPagesShown = () => !!_provider && _provider.book?.state?.open === true;
/** AUDIT 29 B2: whether a Forge works here - the professions the account's (the pages shown). A home's Forge station is
 *  offered, and sold, only while it does: its 50,000 gold bought a piece that did nothing offline, or for an account the
 *  switch had not opened to. CLASSIC-PAGES: on either skin - the Stores page opens on the classic skin too
 *  (ui/pauseDoor.js openPauseFlow), where AUDIT 29 B2 held the classic skin out because its pause had no pages. */
export const forgeOffered = () => profPagesShown();
/** What a Forge station says when it cannot be worked here. */
export const FORGE_COLD_LINE = 'The forge is cold. Smelting is done online, from your Stores page.';
/** L10N4: the cold lines in the player's language - the constants stay the English the tests compare against. */
export const forgeColdLine = () => t('prof.page.cold.forge', FORGE_COLD_LINE);
/** PROF4 (bible/06-Systems/Professions-Arc.md 25): the home stations the Stores page works - the forge and the workbench -
 *  offered, sold and worked only where it is (forgeOffered's gate, AUDIT 29 B2). */
export const PROF_STATIONS = Object.freeze(['forge', 'workbench', 'loom', 'mason', 'jeweller']);   // PROF7: the loom; PROF11: the mason's bench; PROF10: the jeweller's
export const WORKBENCH_COLD_LINE = 'The workbench is bare. Carpentry is done online, from your Stores page.';
export const LOOM_COLD_LINE = 'The loom is still. Outfitting is done online, from your Stores page.';
export const MASON_COLD_LINE = 'The mason\'s bench is idle. Masonry is done online, from your Stores page.';   // PROF11
export const JEWEL_COLD_LINE = 'The jeweler\'s bench is bare. Jewelcrafting is done online, from your Stores page.';   // PROF10
export const stationColdLine = (station) => (station === 'workbench' ? t('prof.page.cold.workbench', WORKBENCH_COLD_LINE) : station === 'loom' ? t('prof.page.cold.loom', LOOM_COLD_LINE)
  : station === 'mason' ? t('prof.page.cold.mason', MASON_COLD_LINE) : station === 'jeweller' ? t('prof.page.cold.jeweller', JEWEL_COLD_LINE) : forgeColdLine());
/** L10N4: a frozen row `[id, label]` whose label is read when it is read (in the player's language) - the shape the
 *  rails and the pins destructure. */
const wordRow = (id, label) => {
  const row = [id];
  Object.defineProperty(row, 1, { enumerable: true, get: label });
  return Object.freeze(row);
};
/** STATION-DOOR (bible/01-Overview/bugs/Field-Bugs-2026-10-11f.md): the home stations whose press opens Daggerfall's maker AND
 *  whose profession's act is this page's - each the act's word, as the press's chooser offers it beside the maker. A
 *  200,000-gold enchanting station opened the item maker alone, and Disenchanting stood at the foot of this page with no
 *  door from the station to it. */
export const STORES_ACT_STATIONS = Object.freeze({ alchemy: 'Brew', enchant: 'Disenchant' });
/** STATION-DOOR: the station whose section the next draw of this page scrolls to - set by a station's press, read once. */
let _storesFocus = /** @type {string|null} */ (null);
export function focusStoresStation(kind) { _storesFocus = typeof kind === 'string' ? kind : null; }
/** STATION-DOOR: a station's head on this page, named so a press can land on it - the page scrolled to it once, after the
 *  draw has put it in the window (the settings rail's own landing, enhancedMenu.js optScrollTo). */
function stationHead(divider, words, kind) {
  const head = divider(words);
  head.id = `prof-station-${kind}`;
  if (_storesFocus === kind) {
    _storesFocus = null;
    globalThis.requestAnimationFrame?.(() => globalThis.document?.getElementById(head.id)?.scrollIntoView?.({ block: 'start' }));
  }
  return head;
}
/** The rail's rows the pages add. */
export const PROF_PAGE_SECTIONS = Object.freeze([wordRow('professions', () => t('prof.page.rail.professions', 'Professions')), wordRow('stores', () => t('prof.page.rail.stores', 'Stores'))]);

/** What the Professions page has chosen, and a change of specialisation pressed once (the second press buys it). */
let _sel = 'herbalism';
let _armed = null;
/** AUDIT PERK-TRIAL P1: whether the armed card said its change was free (its choice's day of trial) - the second press
 *  buys what the card said, never what the clock says by then. */

/** AUDIT PERK-TRIAL P6: a moment as the player's language writes a day and a time - the day of the month, the month's
 *  short name, the hour and minute on a 24-hour clock - in UTC, the professions' clock, and said to be UTC. Here and not
 *  in textManager.js, which the relay bundles (test/net/relayversion.test.js): a page's words are no deploy. */
function utcMoment(ms) {
  try { return new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC', timeZoneName: 'short' }).format(new Date(ms)); } catch { return ''; }
}
let _armedFree = false;
/** The Professions page's last refusal, said under the cards. */
let _profWord = null;
/** The Stores page's filter, search, sort, the material chosen and the quantity to withdraw. */
const _stores = { family: null, query: '', sort: 'tier', picked: null, qty: 1, word: null, busy: false, settledAt: -Infinity, awayPick: null };   // MENU-ORDER: the away station whose words are shown
/** BAG1: the Stores page's own words for a carrying book. */
export const BAG_PAGE_WORDS = Object.freeze({
  noBag: 'You have no Materials Bag: what you gather goes into your pack. Every General Store sells one.',
  // AUDIT2 BAG1 U11: the pack takes what the bag has no room for too, and a deposit takes from the wagon last
  takenNote: 'A material you take out goes into your Materials Bag, then your pack. Put it back from your bag, pack or wagon in any town.',
  allIn: 'Put everything in',
  /** AUDIT2 BAG1 H1/U2: the bag emptied into the pack - the classic inventory draws no bag, and a food rotted in it held it */
  emptyBag: 'Empty your bag into your pack',
  emptied: (moved, left) => `${moved.toLocaleString('en-US')} moved into your pack.${left > 0 ? ` ${left.toLocaleString('en-US')} stay in your bag: your pack can carry no more.` : ''}`,
  /** AUDIT2 BAG1 U1: a material whose Stores are full, passed over by Put everything in without asking */
  storesFull: 'Your Stores can\'t hold any more of it.',
  /** FB1020c ONE-SAVE: a put-in the counting-house has not answered yet - its goods out of the bag, asked again later (the
   *  world host's BAG_DEPOSIT_KEPT_TEXT, this its one home) */
  kept: 'The counting-house is slow to answer. Your goods are on their way to the Stores.',
  /** AUDIT BAG1: what went in, and each material that would not with its reason - a refusal partway said only itself, and
   *  the units that had gone in were never said; `stop` the counting-house's silence, which ends the run */
  allInDone: (n, refused = [], stop = null) => [
    `${n.toLocaleString('en-US')} put in the Stores.`,
    ...refused.map((r) => `${r.name}: ${r.text ?? 'not put in.'}`),
    ...(stop ? [stop] : []),
  ].join(' '),
  /** UNCOUNTED (FIELD BUGS 2026-10-09c, "Some ingredients won't let you store them": Troll's Blood and Orc's Blood from a
   *  dungeon, and what a friend was traded): units held that the service never handed out (law 3) - a card's split, and
   *  the picked bar's why. The page listed none of them and said nothing. */
  uncountedSplit: (n) => `${n.toLocaleString('en-US')} loose`,
  /** LOOT-LOOSE (FIELD BUGS 2026-10-15c, "a lot of alchemy and some other ingredients when looted from a dungeon are
   *  unstorable"; Mac: "Store as loose"): Put in takes them now - as loose, a station's alone (BAG-CRAFT's origin). */
  uncounted: 'Materials you loot, buy at a shop or get from another player go into your Stores as loose goods. Crafting stations can use them, but writs, guild Stores and the market only take what you gathered.',   // BAG-CRAFT: a station's put-in takes it, loose
});
/** AUDIT2 BAG1 U1: how many more units of a row's material the Stores take - their bound less what they hold, every
 *  origin (the deposit's own decision, server-account/src/professions.js depositStores). */
export const storesRoomOf = (book, row) => Math.max(0, (book?.state?.caps?.stores ?? STORES_MAX) - ((row?.own | 0) + (row?.bought | 0) + (row?.gold | 0) + (row?.loose | 0)));   // AUDIT BAG-CRAFT A1: every origin fills it
/** BAG1: the page's rows for a carrying book - every material the Stores hold or the character carries, each with its
 *  Stores split (`own`, `bought`, `gold`) and `carried`: what the bag and the pack hold of it that the service counts.
 *  UNCOUNTED: and, with `heldKeys` (every material held), `uncounted` - what is held past the count, which no Put in takes. */
export function carryRows(book, carriedHeld, heldKeys = null) {
  const out = new Map();
  for (const [k, s] of book.state.stores) out.set(k, { ...s, carried: 0 });
  for (const k of new Set([...(book.state.carried?.keys?.() ?? []), ...(heldKeys?.() ?? [])])) {
    const held = carriedHeld?.(k) ?? 0;
    const n = carriedTotal(clampCarried(book.carried(k), held));   // every origin, as far as the pack still holds it
    const uncounted = heldKeys ? Math.max(0, held - Math.max(0, n)) : 0;
    if (n <= 0 && uncounted <= 0) continue;
    const row = out.get(k) ?? { material: k, own: 0, bought: 0, carried: 0 };
    row.carried = Math.max(0, n);
    if (uncounted > 0) row.uncounted = uncounted;
    out.set(k, row);
  }
  return out;
}
/** PROF2: the forge's counts by recipe, a smelt in flight, and its last word. */
const _forge = { counts: /** @type {Record<string, number>} */ ({}), busy: false, word: /** @type {string|null} */ (null) };
/** PROF3: the anvil's family shown, the recipe chosen, the heat being struck, a craft in flight and its word. CRAFT2: the
 *  pattern picked and what the last was made of (`madeOf` - the next pattern's first choice, pickedOf). */
const _anvil = {
  family: 'weapons', pattern: /** @type {string|null} */ (null), madeOf: /** @type {string|null} */ (null), picked: /** @type {string|null} */ (null), act: /** @type {any} */ (null),
  busy: false, crafting: false, word: /** @type {string|null} */ (null), els: /** @type {any} */ (null), off: /** @type {(() => void)|null} */ (null),
  strike: /** @type {((e?: any) => void)|null} */ (null), heartwood: false,   // AUDIT 32 P1: strike takes the press's event, its moment
  /** AUDIT 30 A3: the recipe the heat under way makes, and its Heartwood - what the page shows may not be */
  actRecipe: /** @type {string|null} */ (null), actWood: false,
};
/** PROF4: the workbench's family shown, the recipe chosen, the plane being drawn, a craft in flight, its word, the saws'
 *  counts and whether a Heartwood stands in for a plank. CRAFT2: the pattern picked, and what the last was made of. */
const _bench = {
  family: 'staves', pattern: /** @type {string|null} */ (null), madeOf: /** @type {string|null} */ (null), picked: /** @type {string|null} */ (null), act: /** @type {any} */ (null),
  busy: false, crafting: false, word: /** @type {string|null} */ (null), counts: /** @type {Record<string, number>} */ ({}), heartwood: false,
  actRecipe: /** @type {string|null} */ (null), actWood: false,   // AUDIT 30 A3: the plane's own recipe
};
/** PROF7: the loom's family and clothing shown, the recipe chosen, the dye, the stitch being sewn, a craft in flight and
 *  its word, the cures' and the weave's counts. CRAFT2: the pattern picked, and what the last was made of. */
const _loom = {
  family: 'leather', pattern: /** @type {string|null} */ (null), madeOf: /** @type {string|null} */ (null), clothing: /** @type {string|null} */ (null), picked: /** @type {string|null} */ (null),
  dye: /** @type {number|null} */ (null), act: /** @type {any} */ (null), busy: false, crafting: false, word: /** @type {string|null} */ (null),
  counts: /** @type {Record<string, number>} */ ({}), els: /** @type {any} */ (null), off: /** @type {(() => void)|null} */ (null),
  stitch: /** @type {((e?: any) => void)|null} */ (null),   // AUDIT 32 P1: the press's event, its moment
  actRecipe: /** @type {string|null} */ (null), actDye: /** @type {number|null} */ (null),   // AUDIT 30 A3's law: the stitch's own recipe and dye
};
/** PROF11: the mason's bench - the carving chosen, the chisel being struck and what it makes (`actWhat`: a work and
 *  its count, or a carving), a work or a carving in flight, its word, the works' counts. */
const _mason = {
  picked: /** @type {string|null} */ (null), act: /** @type {any} */ (null), busy: false, crafting: false,
  word: /** @type {string|null} */ (null), counts: /** @type {Record<string, number>} */ ({}), els: /** @type {any} */ (null),
  off: /** @type {(() => void)|null} */ (null), strike: /** @type {((e?: any) => void)|null} */ (null),
  actWhat: /** @type {{ kind: 'work'|'carve', id: string, count: number }|null} */ (null),
};
/** PROF9: the fire - the dish chosen, the pan on the fire and what it cooks (`actRecipe`), a dish in flight, its word.
 *  CRAFT2: the dish picked (its pattern), and the herb's way the last was cooked. */
const _cook = {
  pattern: /** @type {string|null} */ (null), madeOf: /** @type {string|null} */ (null),
  picked: /** @type {string|null} */ (null), act: /** @type {any} */ (null), crafting: false, word: /** @type {string|null} */ (null),
  els: /** @type {any} */ (null), off: /** @type {(() => void)|null} */ (null), take: /** @type {((e?: any) => void)|null} */ (null),
  actRecipe: /** @type {string|null} */ (null),
};
/** PROF10: the jeweller's bench - the piece and its base shown, the recipe chosen, a Heartwood for a Wand's plank and a
 *  Lapidary's Siege-cracked Gem for the gem, the facet being cut and what it cuts (`actRecipe`, its stand-ins), a piece
 *  in flight, its word. */
const _jewel = {
  piece: 'ring', base: 'silver', grade: 'plain', picked: /** @type {string|null} */ (null), heartwood: false, cracked: false,   // CLOTH-GEMS: the gems' grade shown
  act: /** @type {any} */ (null), crafting: false, word: /** @type {string|null} */ (null), els: /** @type {any} */ (null),
  off: /** @type {(() => void)|null} */ (null), stop: /** @type {((e?: any) => void)|null} */ (null),
  actRecipe: /** @type {string|null} */ (null), actWood: false, actCracked: false,
};
/** PROF12: the alchemy station - the potion chosen, a brew in flight and its word, the transmutations' counts and busy. */
const _alchemy = {
  picked: /** @type {string|null} */ (null), crafting: false, word: /** @type {string|null} */ (null),
  counts: /** @type {Record<string, number>} */ ({}), busy: false,
};
/** PROF12: the enchanting station - the piece pressed once (a disenchant is pressed twice), one in flight and its word. */
const _enchant = { armed: /** @type {string|null} */ (null), busy: false, word: /** @type {string|null} */ (null) };
/** CRAFT4: the temper - the piece in flight, the station its word is (the anvil's or the loom's) and the word; the
 *  Reforge with Essence's piece in flight and its word. */
const _temper = { busy: /** @type {any} */ (null), where: /** @type {string|null} */ (null), word: /** @type {string|null} */ (null) };
const _essReforge = { busy: /** @type {any} */ (null), word: /** @type {string|null} */ (null) };
/** AUDIT 30 U20: the one row a smelt, burn or saw is under way on - its button alone says so. */
let _workingOn = /** @type {string|null} */ (null);
/**
 * AUDIT 32 P2: ONE ACT A PAGE - the station whose act is under way, other than `me`'s, or null. A home with a forge and a
 * loom showed both, and one Space struck the heat AND stitched (two capture listeners on the one document): a craft the
 * player never finished spent its ingot. Every station's Craft waits on the others'.
 * @param {object} me
 */
const handsAt = (me) => (me !== _anvil && (_anvil.act || _anvil.crafting) ? 'anvil' : me !== _bench && (_bench.act || _bench.crafting) ? 'workbench'
  : me !== _loom && (_loom.act || _loom.crafting) ? 'loom' : me !== _mason && (_mason.act || _mason.crafting) ? 'mason'
    : me !== _cook && (_cook.act || _cook.crafting) ? 'fire' : me !== _jewel && (_jewel.act || _jewel.crafting) ? 'jeweller' : null);   // PROF11; PROF9: the fire; PROF10: the jeweller's bench; AUDIT CRAFT1 N1: a craft in flight (its chain's works) holds the hands as its act does
/** What a station says while the hands are at another (`at`, handsAt's). */
const handsLine = (at) => t('prof.page.hands', 'Your hands are at {at, select, anvil {the anvil} workbench {the workbench} loom {the loom} mason {the mason\'s bench} fire {the fire} other {the jeweler\'s bench}}. Finish there first.', { at });
/** AUDIT CRAFT1 F1: whether a craft RUNNING ITS CHAIN is in flight at any bench - the chain may run any station's works,
 *  so no work row is pressed under it (a press would spend what the chain planned on). A craft of what is held keeps
 *  AUDIT 32 P5's word: a station's works stay live under it. */
const chaining = () => [_anvil, _bench, _loom, _mason, _jewel].some((s) => s.crafting && s.chained === true);
/**
 * AUDIT 32 P1: AN ACT'S PRESS BUTTON (the heat's Strike, the stitch's Stitch) - pressed on the pointer's DOWN, the focus
 * left where it was (the click comes on the release: a tap on the beat was scored 90-150 ms late, and a phone has no
 * Space), and a click nobody pointed at (a screen reader's) pressed once; its Space and Enter are the act's key loop's.
 * @param {Function} el @param {string} word @param {(e?: any) => void} press
 */
function actButton(el, word, press) {
  const b = el('button', 'act primary', word);
  b.type = 'button';
  let pointed = false;
  b.onpointerdown = (e) => { e?.preventDefault?.(); pointed = true; press(e); };
  b.onclick = (e) => { if (pointed) { pointed = false; return; } press(e); };
  return b;
}
/** AUDIT 32 P1: how long after the act's last frame a press came, seconds - its event's own time (the loops' clock is
 *  the event's, performance.now's), or none. */
const pressLead = (e, frameAt) => (e && Number.isFinite(e.timeStamp) && Number.isFinite(frameAt) ? (e.timeStamp - frameAt) / 1000 : 0);
/** AUDIT 32 P1/P2/P4: an act's keys - Space and Enter anywhere but a field or another control (the act's own button is
 *  its), one act a press (no second capture listener hears it), a held key's repeats no presses. */
function actKey(e, ownButton, press) {
  if (isTextEntryTarget(e.target) || (isDomControlTarget(e.target) && e.target !== ownButton)) return;   // AUDIT 30 A9: a field's Space, a button's Enter
  if (e.code !== 'Space' && e.code !== 'Enter' && e.code !== 'NumpadEnter') return;
  e.preventDefault?.(); e.stopImmediatePropagation?.(); e.stopPropagation?.();
  if (!e.repeat) press(e);
}
/** AUDIT 30 U13: a station's fee the purse cannot meet - its words, or null. `which` the station (L10N4: each its own
 *  sentence: 'forge', 'anvil', 'workbench', 'loom', 'mason', 'jeweller', 'alchemy', 'enchanter'; CRAFT4's 'temperAnvil' and
 *  'temperLoom'). */
function purseShort(station, which) {
  const p = _provider;
  if (!station || station.kind !== 'shop' || !(station.fee > 0) || typeof p?.purse !== 'function') return null;
  const have = p.purse();
  if (have >= station.fee) return null;
  const a = { fee: station.fee, have };
  switch (which) {
    case 'forge': return t('prof.page.purse.forge', 'The smith asks {fee} gold a smelt; you carry {have}.', a);
    case 'anvil': return t('prof.page.purse.anvil', 'The smith asks {fee} gold a craft; you carry {have}.', a);
    case 'workbench': return t('prof.page.purse.workbench', 'The {who, select, carpenter {carpenter} other {furnisher}} asks {fee} gold a craft or a saw; you carry {have}.', { ...a, who: station.who ?? 'furnisher' });   // CARP-YARD: a joinery's carpenter
    case 'loom': return t('prof.page.purse.loom', 'The tailor asks {fee} gold a craft, a cure or a weave; you carry {have}.', a);
    case 'mason': return t('prof.page.purse.mason', 'The mason asks {fee} gold a cut, a mix or a carving; you carry {have}.', a);
    case 'jeweller': return t('prof.page.purse.jeweller', 'The jeweler asks {fee} gold a piece; you carry {have}.', a);
    case 'alchemy': return t('prof.page.purse.alchemy', 'The alchemist asks {fee} gold a brew; you carry {have}.', a);
    case 'temperAnvil': return t('prof.page.purse.temperAnvil', 'The smith asks {fee} gold a temper; you carry {have}.', a);   // CRAFT4
    case 'temperLoom': return t('prof.page.purse.temperLoom', 'The tailor asks {fee} gold a temper; you carry {have}.', a);
    default: return t('prof.page.purse.enchanter', 'The enchanter asks {fee} gold a piece; you carry {have}.', a);
  }
}
/** What a Stores material of the smith's stock says in place of a withdrawal. */
export const STOCK_STAYS_LINE = 'It stays at the bench for the anvil and the workbench to use.';   // PROF4: a counter's good with no pack form - none since PROF7 registered them all (NO_PACK_FORM empty), kept for a material to come
const stockStaysLine = () => t('prof.page.stores.stockStays', STOCK_STAYS_LINE);
/** SEAT2b part two: what a siege work (the Ram Kit) says in place of a withdrawal - its road is a Siege Camp's writ. */
export const SIEGE_STAYS_LINE = 'Siege works stay in your Stores. Deliver them to your guild\'s Siege Camp with a writ on a Notice Board\'s Work tab.';
const siegeStaysLine = () => t('prof.page.stores.siegeStays', SIEGE_STAYS_LINE);
/** AUDIT PROF12 E1: what Arcane Essence says in place of a withdrawal - it never goes to the pack (NO_PACK_FORM). */
export const ESSENCE_STAYS_LINE = 'Arcane Essence stays in your Stores and can\'t go to your pack. Sell it on the Market tab.';
const essenceStaysLine = () => t('prof.page.stores.essenceStays', ESSENCE_STAYS_LINE);
/** What setting the heat, the plane and the needle down says. */
const heatDownLine = () => t('prof.page.anvil.down', 'You let the ingot cool; nothing is spent.');
const planeDownLine = () => t('prof.page.bench.down', 'You set the plane down; nothing is spent.');
const needleDownLine = () => t('prof.page.loom.down', 'You set the needle down; nothing is spent.');
/** BAG1: what a material with no pack form says where Withdraw would stand - an essence's, a siege work's, the stock's -
 *  one law for the Stores page and the bag's page beside it (L10N4: in the player's language). */
const staysLine = (pick) => (pick.family === 'essences' ? essenceStaysLine() : pick.family === 'siege' ? siegeStaysLine() : stockStaysLine());
/**
 * AUDIT 32 P12: ESCAPE SETS AN ACT DOWN before it closes the window (AUDIT 31's law: Escape closes a form before the
 * window) - the heat, the plane or the stitch under way let go, nothing spent, and said. It closed the pause window, and
 * the act was dropped silently with the page. True when there was one.
 */
export function setDownProfAct() {
  if (_anvil.act) { _anvil.act.cancel(); endHeat(); _anvil.word = heatDownLine(); return true; }
  if (_bench.act) { _bench.act.cancel?.(); _bench.act = null; _bench.actRecipe = null; _bench.word = planeDownLine(); return true; }
  if (_loom.act) { _loom.act.cancel(); endStitch(); _loom.word = needleDownLine(); return true; }
  if (_mason.act) { _mason.act.cancel(); endChisel(); _mason.word = chiselDownLine(); return true; }   // PROF11
  if (_cook.act) { _cook.act.cancel(); endPan(); _cook.word = panDownLine(); return true; }   // PROF9
  if (_jewel.act) { _jewel.act.cancel(); endFacet(); _jewel.word = facetDownLine(); return true; }   // PROF10
  return false;
}
/** Whether an act is under way on the Stores page (the back stack's question). */
export const profActUnderWay = () => !!(_anvil.act || _bench.act || _loom.act || _mason.act || _cook.act || _jewel.act);   // PROF11: the chisel; PROF9: the pan; PROF10: the facet
/** A fresh visit starts plain (the menu calls it with its own reset). */
export function resetProfPages() {
  _armed = null; _profWord = null; _stores.word = null; _stores.picked = null; _stores.qty = 1; _forge.word = null; _forge.counts = {};
  endHeat(); _anvil.word = null; _anvil.picked = null; _anvil.heartwood = false;
  _bench.act?.cancel(); _bench.act = null; _bench.actRecipe = null; _bench.word = null; _bench.picked = null; _bench.counts = {}; _bench.heartwood = false;   // PROF4
  endStitch(); _loom.word = null; _loom.picked = null; _loom.counts = {}; _loom.dye = null;   // PROF7
  for (const st of [_anvil, _bench, _loom, _cook]) { st.pattern = null; st.madeOf = null; }   // CRAFT2
  endChisel(); _mason.word = null; _mason.picked = null; _mason.counts = {};   // PROF11
  endPan(); _cook.word = null; _cook.picked = null; _cook.crafting = false;   // PROF9
  _anvil.chained = _bench.chained = _loom.chained = _mason.chained = _jewel.chained = false;   // AUDIT CRAFT1 F1
  endFacet(); _jewel.word = null; _jewel.piece = 'ring'; _jewel.base = 'silver'; _jewel.grade = 'plain'; _jewel.picked = null; _jewel.crafting = false; _jewel.heartwood = false; _jewel.cracked = false;   // PROF10
  _alchemy.word = null; _alchemy.picked = null; _alchemy.crafting = false; _alchemy.counts = {};   // PROF12
  _enchant.word = null; _enchant.armed = null;   // PROF12
}

/** What the Professions page says a harvest earns for each profession PROF1 gathers, by tier - and a craft's
 *  discipline makes (CRAFT3: a merged craft's are its two disciplines', unlocksOf). L10N4: each a function, its words
 *  read when the page is drawn (in the player's language); the smith's lone metals are DFU's own words. */
const UNLOCKS = Object.freeze({
  herbalism: () => [[t('prof.page.unlocks.herbalism1', 'Common herbs, and the Basket\'s food'), 1], [t('prof.page.unlocks.herbalism2', 'Uncommon herbs'), 2], [t('prof.page.unlocks.herbalism3', 'Rare herbs'), 3]],
  // PROF2: the metals by their tiers (PROF0 4.1), the stone and the dungeons' deep veins
  mining: () => [[t('prof.page.unlocks.mining1', 'Iron, Tin, Copper, Lead, Sulphur; quarrying'), 1], [t('prof.page.unlocks.mining2', 'Lodestone, Mercury'), 2], [t('prof.page.unlocks.mining3', 'Silver; the dungeons\' deep veins'), 3],
    [t('prof.page.unlocks.mining4', 'Gold, Moonstone, Dwarven Scrap'), 4], [t('prof.page.unlocks.mining5', 'Platinum, Mithril'), 5], [t('prof.page.unlocks.mining6', 'Adamantium, Ebony, Orichalcum'), 6]],
  // PROF4: the woods by their tiers (PROF0 4.2); Smithing's metals and Carpentry's woods by theirs
  logging: () => [[t('prof.page.unlocks.logging1', 'Pine'), 1], [t('prof.page.unlocks.logging2', 'Oak'), 2], [t('prof.page.unlocks.logging3', 'Cherry'), 3], [t('prof.page.unlocks.logging4', 'Teak'), 4],
    [t('prof.page.unlocks.logging5', 'Mahogany'), 5], [t('prof.page.unlocks.logging6', 'Ironwood, Ghostwood'), 6]],
  // AUDIT 30 U19: the Spade is rank 10's. PROF7 (FOUND): that note once swallowed Silver, Elven and Dwarven, and Mithril
  smithing: () => [[t('prof.page.unlocks.smithing1', 'Iron; the Wood-Axe, Pick-Axe, Sickle and Skinning Knife'), 1], [t('prof.page.unlocks.smithing2', 'Steel; the chain; the Spade'), 2],
    [localizedText('silver', 'Silver'), 3], [t('prof.page.unlocks.smithing4', 'Elven, Dwarven'), 4], [localizedText('mithril', 'Mithril'), 5], [t('prof.page.unlocks.smithing6', 'Adamantium, Ebony, Orcish; Warforged'), 6],
    [localizedText('daedric', 'Daedric'), 7]],
  carpentry: () => [[t('prof.page.unlocks.carpentry1', 'Pine: staves, bows, arrows, the Basket, a plain single bed'), 1], [t('prof.page.unlocks.carpentry2', 'Oak: tables, chairs, a plain double bed'), 2],
    [t('prof.page.unlocks.carpentry3', 'Cherry: a fancy single bed'), 3], [t('prof.page.unlocks.carpentry4', 'Teak: a fancy double bed'), 4], [t('prof.page.unlocks.logging5', 'Mahogany'), 5],
    [t('prof.page.unlocks.carpentry6', 'Ironwood, Ghostwood: staves and bows'), 6]],
  // PROF7: the hides by their tiers (PROF0 4.4) - DEX-HIDES (FIELD BUGS 2026-10-20h): Daggerfall Enemy Expansion's three
  // with them; Outfitting's leathers and cloths by theirs (9.3)
  hunting: () => [[t('prof.page.unlocks.hunting1', 'Rat Pelt, Mudcrab Chitin'), 1], [t('prof.page.unlocks.hunting2', 'Bat Leather, Bear Hide, Wolf Pelt, Boar Hide'), 2], [t('prof.page.unlocks.hunting3', 'Tiger Pelt, Spider Silk'), 3],
    [t('prof.page.unlocks.hunting4', 'Scorpion Chitin, Slaughterfish Scales'), 4], [t('prof.page.unlocks.hunting5', 'Harpy Feathers, Dreugh Shell'), 5], [t('prof.page.unlocks.hunting6', 'Dragonling Scale'), 6]],
  // AUDIT 32 R4: the skins by their pelt's tier (the Rat's open at 0, the Bat's, the Bear's, the Wolf's and the Boar's at
  // 10 - DEX-HIDES - the Tiger's at 25),
  // and Standard-bearer's Silk said for what it waits on
  outfitting: () => [[t('prof.page.unlocks.outfitting1', 'Linen clothing; the Rat\'s skins; the Fishing-Net'), 1],
    [t('prof.page.unlocks.outfitting2', 'Cured Leather armor; Wool clothing, rugs and tapestries; the Bat\'s, the Bear\'s, the Wolf\'s and the Boar\'s skins'), 2],
    [t('prof.page.unlocks.outfitting3', 'The Tiger\'s skins'), 3], [t('prof.page.unlocks.outfitting4', 'Silk clothing'), 4],
    [t('prof.page.unlocks.outfitting5', 'Hardened Leather armor; Standard-bearer\'s Silk clothing (its silk comes with the sieges)'), 5]],
  // PROF8: every haul is Raw Fish - the rank sets its XP (a haul is worked at the rank's own tier); the sea's finds need
  // the ground the witnesses confirmed, and no rank
  fishing: () => [[t('prof.page.unlocks.fishing1', 'Raw Fish in any water; extra fish from a school; a Pearl or a Slaughterfish at sea on witnessed ground; a trophy'), 1]],
  // PROF11: the bench's two works by their ranks - the cut Rough Stone's (tier 1), the mix Mortar's (tier 2); the
  // Sculptor's stone decor comes with its card at 100
  masonry: () => [[t('prof.page.unlocks.masonry1', 'Cut Stone, from Rough Stone'), 1], [t('prof.page.unlocks.masonry2', 'Mortar, from Sulphur, Lead and Rough Stone'), 2]],
  // PROF9: the four dishes by their ranks (9.3; recipeLaw DISHES) - a dish's XP follows the rank, not the dish
  cooking: () => [[t('prof.page.unlocks.cooking1', 'Hunter\'s Stew, Fisherman\'s Supper'), 1], [t('prof.page.unlocks.cooking2', 'Orchard Tart'), 2], [t('prof.page.unlocks.cooking6', 'Feast of the Hearth'), 6]],
  // PROF10: the jeweller's ladder (recipeLaw JEWEL_METALS) - Silver and the Cloth Amulet at 0, Gold at 25, Platinum at 55,
  // the Wand (its Ironwood or Ghostwood) at 70
  jewelcrafting: () => [[t('prof.page.unlocks.jewelcrafting1', 'Silver pieces; the Cloth Amulet'), 1], [t('prof.page.unlocks.jewelcrafting3', 'Gold pieces'), 3],
    [t('prof.page.unlocks.jewelcrafting5', 'Platinum pieces'), 5], [t('prof.page.unlocks.jewelcrafting6', 'The Wand, in Ironwood or Ghostwood'), 6]],
  // PROF12: the alchemist's ladder (alchemyLaw POTIONS - a potion's tier its DFU price's), DFU's twenty by their ranks
  alchemy: () => [1, 2, 3, 4, 5, 6, 7].map((tier) => [POTIONS.filter((p) => p.tier === tier).map((p) => p.name).join(', '), tier]),
});
/**
 * CRAFT3: WHAT A TRACK UNLOCKS, by tier - a craft of two disciplines their two lists in one, each line its discipline's
 * name ("Jewelcrafting: Gold pieces"), by the rank it opens at (a discipline's first where two share one).
 * @returns {ReadonlyArray<readonly [string, number]>|null}
 */
export function unlocksOf(track) {
  const of = disciplinesOf(track);
  if (of.length < 2) return UNLOCKS[track]?.() ?? null;   // L10N4: UNLOCKS' rows are read when asked
  return of.flatMap((d, i) => (UNLOCKS[d]?.() ?? []).map(([what, tier]) => ({ what: `${disciplineName(d)}: ${what}`, tier, i })))
    .sort((a, b) => a.tier - b.tier || a.i - b.i).map((u) => Object.freeze([u.what, u.tier]));
}
/** PROF4 (FOUND): Smithing was practised from PROF3 and the page never said so - its cards stood locked. PROF7: Hunting
 *  and Outfitting. CRAFT3: the five crafts. */
const PRACTISED = Object.freeze(['herbalism', 'mining', 'hunting', 'fishing', 'logging', 'smithing', 'building', 'outfitting', 'provisioning', 'enchanting']);   // PROF8: Fishing; PROF11: Masonry; PROF9: Cooking; PROF10: Jewelcrafting; PROF12: Alchemy and Enchanting - CRAFT3: Building and Provisioning theirs
/** PROF8: how a haul is made, as the page says it. */
export const FISHING_HOW = 'With a Fishing-Net in your pack, fish while standing or swimming in water, or aboard a ship, at any hour. Hold the use key to draw back and release to cast. When the floats dip, press it again. Then hold to raise the band and release to lower it, keeping the net\'s weight inside the band to fill the net. Cast at a rising school for an extra fish.';
/** FIELD BUGS 2026-09-30b (TOOL-SAID): how the other three gathering professions gather, as the page says it - the page
 *  said it for Hunting and Fishing alone, and players used the tools from the pack. TOOL-USE: a tool's Use at the node
 *  (the hotbar's, a quick slot's) is the key's; from the pack it only points the way. */
const GATHER_HOW_HERBALISM = 'Press the use key at a patch of herbs in the wilderness. Common herbs need no tool; the rest need a Sickle in your pack. With a Basket, the patch\'s list also lets you search it for food. The Sickle and the Basket can be used from your hotbar or quick slots as well. Used from your pack, a tool only tells you where it can be used.';
const GATHER_HOW_MINING = 'Press the use key at a vein of ore or a boulder in the wilderness, or at a vein in a dungeon. You need a Pick-Axe in your pack. The pick can also be used from your hotbar or quick slots. Used from your pack, a tool only tells you where it can be used.';
const GATHER_HOW_LOGGING = 'Press the use key at a tree in the wilderness. You need a Wood-Axe in your pack. Only some trees in each place can be felled each day. The axe can also be used from your hotbar or quick slots. Used from your pack, a tool only tells you where it can be used.';
export const GATHER_HOW = Object.freeze({ herbalism: GATHER_HOW_HERBALISM, mining: GATHER_HOW_MINING, logging: GATHER_HOW_LOGGING });
/** L10N4: how a gathering profession gathers, in the player's language (GATHER_HOW the English). */
const gatherHow = (id) => (id === 'herbalism' ? t('prof.page.how.herbalism', GATHER_HOW_HERBALISM) : id === 'mining' ? t('prof.page.how.mining', GATHER_HOW_MINING)
  : id === 'logging' ? t('prof.page.how.logging', GATHER_HOW_LOGGING) : '');
/** UNWITNESSED-ORE (FIELD BUGS 2026-10-09e, "Mining veins": hundreds of Iron veins in the mountains and not one of
 *  Silver, Gold, Platinum or Mithril, read as a bug): the ground's own law, said on the Mining page - a vein holds its
 *  ground's rarer ores only where three players have gathered (net/nodeLaw.js witnessedFact, UNCONFIRMED_VEIN_TIER).
 *  ORE-MAP: and where to read it for a place - the world map's ore card (ui/oreMapTip.js). */
export const MINING_GROUND_LINE = 'Veins hold Silver at most until three different players, each with an account at least a week old, have gathered on that ground. Then Gold, Platinum and Mithril in the mountains, and the region\'s own ore, can appear. Deep veins in dungeons hold Silver anywhere. Point at open ground on the world map to see what its veins hold and whether it has been witnessed yet.';
/** L10N4: MINING_GROUND_LINE in the player's language. */
const miningGroundLine = () => t('prof.page.how.miningGround', MINING_GROUND_LINE);
/** AUDIT MINE-PERKS (the cold pass, 8): what the line above means for a Surveyor - the Mining page told them "Silver at
 *  most" while their own word witnesses the ground (net/nodeLaw.js vein `surveyed`). Said under it, theirs alone. */
export const MINING_SURVEYOR_LINE = 'As a {name}, you need no witnesses: your veins can give any ore the land holds. A region\'s own ore still needs the other players.';
const miningSurveyorLine = () => t('prof.page.how.miningSurveyor', MINING_SURVEYOR_LINE, { name: specOf('mining', 100, SURVEYOR)?.name ?? '' });
/** TOOL-SAID: the empty Stores say where their goods come from - a node's act (TOOL-USE: the key's, or the tool's Use
 *  there), never a tool used from the pack. */
/** AUDIT (2026-10-04): the empty Stores on BAG1's page - a carrying book's harvest goes into the bag or the pack, never
 *  straight into the Stores, so STORES_EMPTY_LINE (an older book's, below) said where its goods go wrongly there. */
export const STORES_EMPTY_CARRY_LINE = 'Your Stores are empty. What you gather goes into your Materials Bag or pack. Put it in here in any town.';
export const STORES_EMPTY_LINE = 'Your Stores are empty. What you gather online goes here. Press the use key at an herb patch, a tree, an ore vein, a boulder or a creature you killed, or in water with a net. You can also use the matching tool from your hotbar or a quick slot. Tools used from your pack gather nothing.';   // TOUCH-HOLD: the knife's Use
const storesEmptyLine = () => t('prof.page.stores.empty', STORES_EMPTY_LINE);
const storesEmptyCarryLine = () => t('prof.page.stores.emptyCarry', STORES_EMPTY_CARRY_LINE);
/** PROF12: how Alchemy is practised, as the Professions page says it. FB1018D CRAFT-HOWTO: with what the bag and the pack
 *  hold too - "with what your Stores hold" stood from before BAG-CRAFT, and the brew reads the station's own (workOf).
 *  POTION-DOOR (Professions-Arc 52): a Mages Guild hall a station, and its potion maker the brew's door there. */
export const ALCHEMY_HOW = 'Brew at an alchemy station (an Alchemist\'s, a Mages Guild hall or your own home) from the Stores page, with what you carry or keep in your Stores. The potion maker brews at a station too, for the same experience. There are 20 recipes, the same as the classic potion maker\'s. Herbs, metals and gems are gathered; the rest are bought from the Apothecaries\' counter. A potion maker anywhere else, such as a temple\'s, still works, but what it mixes earns no Provisioning experience.';
const fishingHow = () => t('prof.page.how.fishing', FISHING_HOW);
const alchemyHow = () => t('prof.page.how.alchemy', ALCHEMY_HOW);
/**
 * FB1018D CRAFT-HOWTO (FIELD BUGS 2026-10-18d, the Discord's #bug-reports, MoonGeneral: "for the crafting side of this
 * mechanic i have no clue on how to start it ... when it comes to the crafting skills you no explanation there"): HOW A
 * CRAFT IS PRACTISED, as the page says it - each crafting profession's paragraph where a gathering one's stands
 * (GATHER_HOW, TOOL-SAID), each a function read when the page is drawn (L10N4, UNLOCKS' shape). Provisioning's brew is
 * ALCHEMY_HOW's and Enchanting's whole word ENCHANTING_HOW's; this says the rest. The port's own: DFU has no crafting
 * profession (Ledger A, the professions' row). Every claim is the code's:
 * - WHERE: a station is worked on the Stores page while the player stands at it (drawStationTiles' `here`, the
 *   provider's station question): a Weaponsmith's or an Armorer's forge and anvil, a Pawn Shop's or a Gem Store's
 *   jeweller's bench, a Furniture Store's workbench, a General Store's mason's bench, a Clothing Store's loom - or the
 *   home's own (scenes/worldModes.js forgeHere, jewellerHere, workbenchHere, masonHere, loomHere); a joinery's bench
 *   (scenes/world.js workbenchHere, CARP-YARD); any lit fire (professionLaw COOK_FIRE; worldModes cookFireHere).
 * - WHAT: the forge's smelts (professionLaw SMELT_RECIPES - two ore an ingot), the anvil's weapons, armour and tools
 *   (recipeLaw SMITH_RECIPES) and from raw ore its chain's smelts (net/chainLaw.js chainPlan, CRAFT1); the workbench's
 *   saws (SAW_RECIPES) and its staves, bows, arrows and furniture (CARPENTRY_RECIPES); the mason's cut and mix
 *   (MASON_RECIPES - Rough Stone, quarried); the loom's cures (CURE_RECIPES - hides, skinned) and its pieces
 *   (OUTFITTING_RECIPES), its Linen woven from Root Tendrils and its Wool spun from furs (CLOTH-GEMS: WEAVE_RECIPES,
 *   SPIN_RECIPES) or bought (COUNTER_ONLY; WEAVERS_STOCK, at a Clothing Store's loom and the Market tab - and Linen at a
 *   furnisher's counter too, FURNISHER_STOCK: AUDIT FB1018D L1-9), the first-time bonus only the made cloth's (AUDIT 32
 *   S1, judged by the units); a dish's meat, fish, herbs and Basket's food (recipeLaw DISHES), into the pack.
 * - XP: a smelt's (smeltXp) and a piece's (craftXp), a mason's work's (masonXp), a dish's (cookXp) and a brew's, each on
 *   its craft's track (trackOf); a saw and a cure none (`xp: null`).
 */
export const CRAFT_HOW = Object.freeze({
  smithing: () => t('prof.page.how.smithing', 'Smithing is done at a forge: a Weaponsmith\'s, an Armorer\'s or one in your own home. Open the Stores page there (Holdings > Stores). The Forge smelts the ore you mine into ingots, and the Anvil makes weapons, armor and tools from them, or from raw ore by smelting it first. Jewelry is made at a jeweler\'s bench: a Pawn Shop\'s, a Gem Store\'s or one in your own home. Smelting and every piece you make earn Smithing experience.'),
  building: () => t('prof.page.how.building', 'Carpentry is done at a workbench: a Furniture Store\'s, a joinery\'s or one in your own home; Masonry at a mason\'s bench: a General Store\'s or one in your own home. Open the Stores page there (Holdings > Stores). The workbench saws the logs you fell into planks and makes staves, bows, arrows and furniture; the mason\'s bench cuts the stone you quarry and mixes Mortar. Every piece, cut and mix earns Building experience; sawing earns none.'),
  outfitting: () => t('prof.page.how.outfitting', 'Outfitting is done at a loom: a Clothing Store\'s or one in your own home. Open the Stores page there (Holdings > Stores). The loom\'s tanning rack cures the hides you skin into leather, the loom weaves Root Tendrils into Linen and spins furs into Wool, and it makes leather armor, clothing, rugs, tapestries and the Fishing-Net. The Weavers sell Linen and Wool too, at a Clothing Store\'s loom or a Notice Board\'s Market, but only cloth you make yourself earns a first-time bonus. Every piece earns Outfitting experience; curing, weaving and spinning earn none.'),
  provisioning: () => t('prof.page.how.cooking', 'Cook at any lit fire, such as a campfire, a hearth or a brazier: stand close to its flame and open the Stores page (Holdings > Stores). Dishes are made from the meat you skin, the fish you net, herbs and the food a Basket finds, and go to your pack. Brewing and cooking both earn Provisioning experience.'),   // beside ALCHEMY_HOW: Provisioning's cooking (CRAFT3)
});
/**
 * POTION-DOOR (bible/06-Systems/Professions-Arc.md 52; SaberGGaming's report, 2026-10-25): THE POTION MAKER'S DOOR TO THE
 * BREW (scenes/potionMakerHost.js) - online, the pages standing: `station` whether the player stands at an alchemy station
 * (the provider's - an Alchemist's, a Mages Guild hall, a home's), `held` what the Stores alone hold of a material (the
 * station's read of them; what is carried the maker lists as DFU's own items), the brewer's rank and the station's fee,
 * and the brew itself - the Stores page's own (its fee, its potions minted on the answer, its words). Null offline or
 * with the pages shut: DFU's maker as it is.
 */
export function potionMakerDoor() {
  const p = _provider;
  if (!profPagesShown() || !p) return null;
  const book = p.book;
  return Object.freeze({
    station: typeof p.brew === 'function' && !!p.alchemy?.(),
    held: (/** @type {string} */ k) => Number(typeof book?.storesWorkable === 'function' ? book.storesWorkable(k) : book?.held?.(k)) || 0,
    rank: () => book?.track?.('alchemy')?.rank ?? 0,
    fee: () => p.alchemy?.()?.fee ?? 0,
    brew: (/** @type {string} */ id, /** @type {string[]} */ keys) => /** @type {NonNullable<typeof p.brew>} */ (p.brew)(id, keys),
  });
}
/** PROF12: how Enchanting is practised, and what its rank takes off the item maker's gold. */
export const ENCHANTING_HOW = (pct) => t('prof.page.how.enchanting', 'Enchanting improves as you break crafted pieces down into Arcane Essence at an enchanting station, in a Mages Guild hall or your own home, from the Stores page. The item maker works as it always has{off, select, yes {, and your rank takes {pct}% off its prices} other {. From Journeyman on, your rank lowers its prices}}.',
  { off: pct > 0 ? 'yes' : 'no', pct });   // L10N4: one sentence, its rank's share a select
/** PROF12: ENCHANTING'S LAYER OVER DFU'S ITEM MAKER (9.3) - the share off its gold, percent: online, the professions this
 *  account's, by the Enchanting track's rank (and an Efficient's at 50); none else. The item maker reads it (worldModes). */
export function enchantGoldPct() {
  if (!profPagesShown()) return 0;
  const t = _provider?.book?.track?.('enchanting');
  return enchantDiscountPct(t?.rank ?? 0, t?.specs?.[50] ?? null);
}
/** A craft practised in part - what raises it now (none since PROF4: Smithing's is whole). */
const PARTLY = Object.freeze({});

/** The line a track's XP makes: "11,900 / 12,250 XP" to the next rank, or the Master's total. CRAFT-LIMIT-SAID (FIELD
 *  BUGS 2026-10-18f): a craft the crafter's limit holds (`limit`, professionLaw craftLimitOf) its ceiling - "26,009 /
 *  26,009 XP - the crafter's limit holds it at rank 50" - where "26,009 / 26,010 XP" read as one XP from rank 51. AUDIT
 *  FB1018f L5-3: only at the rank it is held at (the limit's `rank`) - a third craft at 10 keeps its next rank's figure,
 *  "1,005 / 1,210 XP", where it read "1,005 / 26,009 XP - the crafter's limit holds it at rank 50"; L5-2: and one past its
 *  cap its own XP and rank, "36,000 / 36,000 XP - ... at rank 60", never "36,000 / 26,009 XP - ... at rank 50". */
export function xpLine(track, limit = null) {
  if (track.rank >= PROF_RANK_MAX) return t('prof.page.xpMaster', '{xp, number} XP - Master', { xp: track.xp });
  if (limit?.by?.length && track.rank >= limit.rank) return t('prof.page.xpHeld', '{xp, number} / {cap, number} XP - the crafter\'s limit holds it at rank {rank}', { xp: track.xp, cap: Math.max(limit.cap, track.xp), rank: limit.rank });
  return t('prof.page.xp', '{xp, number} / {next, number} XP', { xp: track.xp, next: xpForRank(track.rank + 1) });
}
/** CRAFT-LIMIT-SAID: the crafts that stand above Journeyman, in the tab's order. */
export const craftsPastJourneyman = (tracks) => PROFESSIONS.filter((p) => p.kind === 'crafting' && (tracks.get(p.id)?.rank ?? 0) > JOURNEYMAN_RANK).map((p) => p.id);
/** How many crafts stand above Journeyman (PROF0 3.2's limit). */
export const craftsAboveJourneyman = (tracks) => craftsPastJourneyman(tracks).length;
/** CRAFT-LIMIT-SAID (FIELD BUGS 2026-10-18f): WHAT A STATION'S ACTS ARE PAID UNDER, read as the service pays them - the
 *  crafter's limit over the craft's track, off the book's tracks (professionLaw craftLimitOf; the service's decisions bind
 *  craftXpCap of the same ranks), and the Firmament's percent on its XP (FIRM1: the stars in force; the service scales by
 *  its own firmStatsOf). ui/craftXpWords.js says them. @param {any} book @param {string} id a craft or a discipline */
export const craftPayOf = (book, id) => ({ limit: craftLimitOf(book?.state?.tracks?.values?.() ?? [], id), pct: xpPct(firmamentStats(), trackOf(id)) });
/** CLOTH-GEMS (AUDIT 32 S1, judged by the units - bible/06-Systems/Professions-Arc.md 50): WHETHER A CRAFT OF `r` WOULD
 *  SPEND THE CHARACTER'S OWN UNITS ALONE, as the book reads them. A station spends loose units first, then bought ones
 *  (bagLaw STATION_ORIGINS), so none of either may stand in the Stores, nor a bought one among what the bag and the pack
 *  carry counted (a station's shortfall puts those in before the own ones). What the pack holds past the service's count
 *  goes in loose, after the counted - the service's decision is the word, and its answer says it (`firstPaid`). */
export const ownSpend = (book, r) => !!r && r.inputs.every((/** @type {{ key: string }} */ i) => {
  const s = book?.store?.(i.key) ?? {};
  return !((s.bought | 0) > 0) && !((s[LOOSE_ORIGIN] | 0) > 0) && !((book?.carried?.(i.key)?.bought | 0) > 0);
});

/**
 * THE PROFESSIONS PAGE.
 * @param {HTMLElement} detail @param {() => void} rerender
 * @param {{ el: Function, divider: (w: string) => HTMLElement, meter: (now: number, max: number, tone: string) => HTMLElement }} kit
 */
/** AUDIT 29 C1: a stale state read again - the page drawn again only once a NEW read has answered. The book hands a
 *  read inside its backoff the last answer at once, and redrawing on that drew, found it stale and asked again: a
 *  loop of draws that starved the tab. */
function readStale(book, rerender) {
  if (!book.stale?.()) return;
  const before = book.state.readAt;
  book.refresh().then(() => { if (book.state.readAt !== before) rerender(); }, () => {});
}
export function drawProfessionsPage(detail, rerender, kit) {
  const p = _provider;
  if (!p) return;
  const { el, divider, meter } = kit;
  const book = p.book;
  readStale(book, rerender);
  const cols = el('div', 'prof-cols');
  const list = el('div', 'prof-list');
  for (const group of ['gathering', 'crafting']) {
    list.append(divider(group === 'gathering' ? t('prof.page.gathering', 'Gathering') : t('prof.page.crafting', 'Crafting')));
    for (const prof of PROFESSIONS.filter((x) => x.kind === group)) {
      const tr = book.track(prof.id);
      const row = el('button', `prof-row${prof.id === _sel ? ' on' : ''}`);
      row.type = 'button';
      row.append(el('span', 'prof-name', prof.name), el('span', 'prof-rank', t('prof.page.rankOf', '{rankName} {rank}', { rankName: rankName(tr.rank), rank: tr.rank })));
      const floor = xpForRank(tr.rank), next = xpForRank(Math.min(PROF_RANK_MAX, tr.rank + 1));
      row.append(meter(tr.rank >= PROF_RANK_MAX ? 1 : tr.xp - floor, tr.rank >= PROF_RANK_MAX ? 1 : next - floor, ''));
      row.onclick = () => { _sel = prof.id; _armed = null; rerender(); };
      list.append(row);
    }
  }
  const pane = el('div', 'prof-pane');
  const tr = book.track(_sel);
  const title = el('div', 'prof-title');
  title.append(el('h3', null, professionName(_sel)), el('span', 'prof-rankline', tr.rank >= PROF_RANK_MAX ? t('prof.page.master', 'Master 100')
    : t('prof.page.rankNext', '{rankName}  {rank} -> {next}', { rankName: rankName(tr.rank), rank: tr.rank, next: tr.rank + 1 })));
  pane.append(title, el('p', 'prof-xp', xpLine(tr, craftLimitOf(book.state?.tracks?.values?.() ?? [], _sel))));   // CRAFT-LIMIT-SAID: a held craft its ceiling
  const practised = PRACTISED.includes(_sel);
  if (!practised) pane.append(el('p', 'px-note', PARTLY[_sel] ?? t('prof.page.notPractised', 'This profession is not practiced in the Bay yet.')));
  if (_sel === 'hunting') {
    // PROF7: Hunting's day is the account's (PROF0 6) - its hides, every character's together, and the rare ones (CAP-OFF:
    // the hides a count, the rare ones' three the day's one bound)
    const h = book.state.hunt ?? { hides: 0, high: 0 };
    pane.append(el('p', 'prof-today', t('prof.page.today.hides', 'Today: {hides, plural, one {# hide} other {# hides}}, {high} of {highCap} of grades 5 and 6 (shared by all your characters)',
      { hides: h.hides, high: h.high, highCap: book.state.caps?.highHides ?? HIGH_HIDES_PER_DAY })));
    // TOUCH-HOLD: the knife's Use, as the Sickle's - it holds the knife, so the line is drawn with no key held
    pane.append(el('p', 'px-note', t('prof.page.how.hunting', 'With a Skinning Knife in your pack, you can skin a creature you killed. Hold the use key at the start of the line and drag the knife along it. Used from your hotbar or a quick slot, the knife is held for you: follow the line with your eyes. The carcass\'s list also lets you search it.')));
  } else if (_sel === 'fishing') {
    // PROF8: Fishing's day is the account's too (PROF0 6) - its hauls, every character's together (CAP-OFF: a count)
    const hauls = book.state.hauls ?? 0;
    pane.append(el('p', 'prof-today', t('prof.page.today.hauls', 'Today: {hauls, plural, one {# haul} other {# hauls}} (shared by all your characters)', { hauls })));
    pane.append(el('p', 'px-note', fishingHow()));
  } else if (_sel === 'enchanting') {
    // PROF12: Enchanting's layer said where its rank is read - the item maker's gold, and what raises it
    pane.append(el('p', 'px-note', ENCHANTING_HOW(enchantDiscountPct(tr.rank, tr.specs?.[50] ?? null))));
  } else if (_sel === trackOf('alchemy')) {   // CRAFT3: Provisioning's brewing
    pane.append(el('p', 'px-note', alchemyHow()));
    pane.append(el('p', 'px-note', CRAFT_HOW.provisioning()));   // FB1018D CRAFT-HOWTO: and its cooking
  } else if (Object.hasOwn(CRAFT_HOW, _sel)) {
    pane.append(el('p', 'px-note', CRAFT_HOW[_sel]()));   // FB1018D CRAFT-HOWTO: Smithing, Building, Outfitting
  } else if (PROFESSIONS.find((x) => x.id === _sel)?.kind === 'gathering' && practised) {
    const today = book.state.today?.[_sel] ?? 0;   // CAP-OFF: the day's harvests, a count against no cap
    pane.append(el('p', 'prof-today', t('prof.page.today.harvests', 'Today: {n, plural, one {# harvest} other {# harvests}}', { n: today })));
    if (GATHER_HOW[_sel]) pane.append(el('p', 'px-note', gatherHow(_sel)));   // TOOL-SAID
    if (_sel === 'mining') pane.append(el('p', 'px-note', miningGroundLine()));   // UNWITNESSED-ORE
    if (_sel === 'mining' && tr.specs?.[100] === SURVEYOR) pane.append(el('p', 'px-note', miningSurveyorLine()));   // MINE-PERKS
  }
  // THE SPECIALISATIONS: two cards a rank (CRAFT3: a merged craft's four, each its discipline's), the chosen one lit; a
  // change of mind pressed twice - free once where the five crafts' merge lost a choice (`free`); PERK-TRIAL: free and at
  // once on the choice's day of trial (`trial`), else 1,000 silver and at once, and the week after a paid change locked
  const two = disciplinesOf(_sel).length > 1;
  const nowS = Date.now() / 1000;
  const when = (at) => utcMoment(at * 1000);   // AUDIT PERK-TRIAL P6: in the player's language
  for (const r of SPEC_RANKS) {
    pane.append(divider(t('prof.page.specs.at', 'At {rank}', { rank: r })));
    const cards = el('div', 'prof-specs');
    const chosen = tr.specs?.[r] ?? null;
    const trial = !!chosen && specTrialShown(tr, r, nowS);   // PERK-TRIAL: the choice's day of trial
    const lock = Number(tr.lock ?? 0) > nowS ? Number(tr.lock) : null;   // PERK-TRIAL: the week after a paid change
    for (const s of SPECIALISATIONS[_sel][r]) {
      const card = el('button', `prof-spec${chosen === s.id ? ' on' : ''}${tr.respec?.to === s.id && tr.respec?.rank === r ? ' coming' : ''}`);
      card.type = 'button';
      card.append(el('b', null, s.name), el('span', null, s.text));
      if (two) card.append(el('i', 'prof-of', disciplineName(specDiscipline(s.id))));   // CRAFT3: whose choice it is
      const locked = tr.rank < r || !practised || !!s.later;   // AUDIT 29 A17: a choice whose slice is to come is named, never chosen
      const free = tr.free?.includes(r) === true;   // CRAFT3: the merge's free change
      // FIRST-PICK (FIELD BUGS 2026-10-16b): a change on its way - PERK-TRIAL: or the week's lock after one - gates a paid
      // CHANGE, as the service's chooseSpec refuses one (prof-respec-pending); never a rank's first choice, the merge's
      // free change, nor a choice on its day of trial, which it answers first
      const waits = !!chosen && (!!tr.respec || lock !== null) && !free && !trial;
      card.disabled = locked || chosen === s.id || waits;
      if (s.later) card.append(el('i', 'prof-cost', LATER_WORDS[s.later] ?? t('prof.page.later.any', 'Comes in a later update')));
      const armedHere = _armed === `${r}|${s.id}` && _armedFree === trial;   // AUDIT PERK-TRIAL P1: a card armed free whose day ran out on the screen is armed no more - pressed again, it arms at the price it says now
      if (!locked && chosen && chosen !== s.id && !waits) {
        card.append(el('i', 'prof-cost', free ? (armedHere ? t('prof.page.specs.respecFreeArmed', 'Press again: free, in effect at once') : t('prof.page.specs.respecFree', 'Change: free, once'))
          : trial ? (armedHere ? t('prof.page.specs.respecFreeArmed', 'Press again: free, in effect at once') : t('prof.page.specs.respecTrial', 'Change: free until {date}', { date: when(tr.trial[r]) }))
            : armedHere ? t('prof.page.specs.respecNowArmed', 'Press again: {cost, number} silver, in effect at once. The next change waits {days, plural, one {# day} other {# days}}', { cost: RESPEC.marks, days: RESPEC.days })   // AUDIT PERK-TRIAL P5: the lock said before it is paid for
              : t('prof.page.specs.respec', 'Change: {cost, number} silver', { cost: RESPEC.marks })));
      }
      if (chosen === s.id && waits && lock !== null) card.append(el('i', 'prof-cost', t('prof.page.specs.lockedUntil', 'Next change from {date}', { date: when(lock) })));   // PERK-TRIAL
      if (tr.respec?.to === s.id && tr.respec?.rank === r) card.append(el('i', 'prof-cost', t('prof.page.specs.inEffect', 'In effect from {date}', { date: new Date(tr.respec.at * 1000).toUTCString().slice(0, 16) })));
      card.onclick = async () => {
        if (chosen && !armedHere) { _armed = `${r}|${s.id}`; _armedFree = trial; rerender(); return; }
        _armed = null;
        const res = await book.choose(_sel, r, s.id, chosen ? { trial: _armedFree } : {});   // AUDIT PERK-TRIAL P1: as the card said it
        _profWord = res?.ok ? null : accountRefusalText(res?.error);
        rerender();
      };
      cards.append(card);
    }
    if (tr.rank < r) cards.append(el('p', 'px-note', t('prof.page.specs.chosenAt', 'Chosen at {rank}.', { rank: r })));
    pane.append(cards);
  }
  if (_profWord) pane.append(el('p', 'prof-word', _profWord));
  if (unlocksOf(_sel)) {
    pane.append(divider(t('prof.page.unlocks', 'Unlocks')));
    for (const [what, tier] of unlocksOf(_sel) ?? []) {
      const r = el('div', `px-stat${tr.rank >= TIER_RANKS[tier - 1] ? '' : ' prof-locked'}`);
      r.append(el('span', 'k', what), el('span', 'v', rankWord(TIER_RANKS[tier - 1])));
      pane.append(r);
    }
  }
  pane.append(el('p', 'prof-limit', t('prof.page.limit', 'Crafts above Journeyman: {n} of {max}', { n: craftsAboveJourneyman(book.state.tracks), max: CRAFTS_ABOVE_JOURNEYMAN })));
  // CRAFT-LIMIT-SAID (FIELD BUGS 2026-10-18f): what the count does - which two, that the others stop at 50, and for good; the
  // count's own line, never a pane's how-to note (FB1018D CRAFT-HOWTO reads those)
  pane.append(el('p', 'prof-limit prof-rule', limitRuleLine(craftsPastJourneyman(book.state.tracks))));
  // GENTLE ACTS (PROF0 5.1): the accessibility choice, beside the acts it changes
  const gentle = el('label', 'prof-gentle');
  const box = el('input');
  box.type = 'checkbox';
  box.checked = getPref('gentleActs') === true;
  box.onchange = () => { setPref('gentleActs', !!box.checked); rerender(); };
  gentle.append(box, document.createTextNode(` ${t('prof.page.gentle', 'Gentle work: crafting and gathering need no timing, with no bruises, no glints to find and no bonus for clean work')}`));
  pane.append(gentle);
  cols.append(list, pane);
  detail.append(cols);
}

/** The Stores' materials as the page lists them: filtered by family and search, sorted by tier, name or count. */
export function storesRows(stores, { family = null, query = '', sort = 'tier' } = {}, nameOf = (k) => k) {
  const q = String(query ?? '').trim().toLowerCase();
  const rows = [...stores.values()].map((s) => {
    const m = material(s.material);
    return { ...s, name: nameOf(s.material), family: m?.family ?? null, tier: m?.tier ?? 0, value: m?.value ?? 0, total: s.own + s.bought + (s.gold | 0) + (s.loose | 0), carried: s.carried | 0, uncounted: s.uncounted | 0 };   // AUDIT BAG-CRAFT A1: and what a station's put-in brought loose; GOLD-MARKET: what gold bought is held too; BAG1: what is carried beside it; UNCOUNTED: and held past the count
  }).filter((r) => r.total + r.carried + r.uncounted > 0 && (!family || r.family === family) && (!q || r.name.toLowerCase().includes(q)));
  const byName = (a, b) => a.name.localeCompare(b.name);
  rows.sort(sort === 'name' ? byName : sort === 'count' ? (a, b) => (b.total - a.total) || byName(a, b) : (a, b) => (a.tier - b.tier) || byName(a, b));
  return rows;
}

/** A Stores card's split: own, bought and (GOLD-MARKET) bought with gold - "own" alone where nothing was bought. AUDIT
 *  BAG-CRAFT A1: and what a station's put-in brought from the pack, loose. FB1020h ESSENCE-LOOSE: a material with no pack
 *  form (Arcane Essence, a Ram Kit) never came from the pack itself - its loose units were MADE of goods that did (a piece
 *  of them disenchanted, a kit of them built), and say so. */
export function storesSplit(r) {
  const gold = r.gold | 0, loose = r.loose | 0;
  const own = () => t('prof.page.stores.own', '{n} own', { n: r.own }), bought = () => t('prof.page.stores.bought', '{n} bought', { n: r.bought });
  if (!gold && !loose) return r.bought ? `${own()} · ${bought()}` : t('prof.page.stores.ownOnly', 'own');
  const fromPack = () => (withdrawable(r.material) ? t('prof.page.stores.fromPack', '{n} from your pack', { n: loose }) : t('prof.page.stores.fromPackGoods', '{n} made from pack goods', { n: loose }));
  return [r.own ? own() : null, r.bought ? bought() : null, gold ? t('prof.page.stores.boughtGold', '{n} bought with gold', { n: gold }) : null,
    loose ? fromPack() : null].filter(Boolean).join(' · ');
}
/** GOLD-MARKET: what the page says of a material gold bought (Professions-Arc 10.8's wall). */
export const GOLD_GOODS_LINE = 'Bought with gold. It can go to your pack or be sold on the market for gold, but no station, craft, writ or silver sale takes it.';
/** FB1020h ESSENCE-LOOSE: and of one with no pack form (Arcane Essence of a piece bought with gold) - it never goes to the
 *  pack (AUDIT PROF12 E1), so the line no longer says it can. */
export const GOLD_STAYS_LINE = 'Bought with gold, or made from a piece bought with gold. It can be sold on the market for gold, but no station, craft, writ or silver sale takes it.';
const goldGoodsLine = (/** @type {string} */ m) => (withdrawable(m) ? t('prof.page.stores.goldGoods', GOLD_GOODS_LINE) : t('prof.page.stores.goldStays', GOLD_STAYS_LINE));
/** AUDIT BAG-CRAFT A1: what the page says of a material a station's put-in brought from the pack - the stations' wall. */
export const LOOSE_GOODS_LINE = 'From your pack. Stations can use it, or it can go back to your pack. Writs, guilds and sales only take what you gathered or took from your Stores.';
/** FB1020h ESSENCE-LOOSE: and of one with no pack form, made of such goods (Arcane Essence of a piece made from them) -
 *  the stations' wall, its pack never offered. */
export const LOOSE_MADE_LINE = 'Made from goods from your pack. Stations can use it, but writs, guilds and sales only take what you gathered or took from your Stores.';
const looseGoodsLine = (/** @type {string} */ m) => (withdrawable(m) ? t('prof.page.stores.looseGoods', LOOSE_GOODS_LINE) : t('prof.page.stores.looseMade', LOOSE_MADE_LINE));

/**
 * THE STORES PAGE.
 * @param {HTMLElement} detail @param {() => void} rerender
 * @param {{ el: Function, divider: (w: string) => HTMLElement }} kit
 */
export function drawStoresPage(detail, rerender, kit) {
  const p = _provider;
  if (!p) return;
  const { el, divider } = kit;
  const book = p.book;
  readStale(book, rerender);
  // AUDIT 29 C4: a withdrawal kept (its answer lost) is asked again when the Stores are opened - not only at the next read
  // PROF5 (FOUND): a kept craft settles too - `pendingCrafts` had no reader, so a craft whose answer was lost waited for an
  // unrelated withdrawal
  // BAG1: and a deposit whose answer was lost
  if ((book.pendingWithdrawals || book.pendingCrafts || book.pendingDeposits) && p.settle && Date.now() - _stores.settledAt > 30_000) { _stores.settledAt = Date.now(); p.settle().then(rerender, () => {}); }
  const head = el('div', 'prof-storehead');
  const search = el('input', 'prof-search');
  search.type = 'search'; search.placeholder = t('prof.page.stores.search', 'Search'); search.value = _stores.query;
  search.setAttribute?.('data-focus', 'stores-search');
  search.oninput = () => {
    _stores.query = search.value;
    rerender();   // AUDIT 32 P13: the window keeps the caret where the typing left it (P3) - this put it at the end every key
  };
  const sort = el('select', 'prof-sort');
  for (const [v, w] of [['tier', t('prof.page.stores.sortTier', 'Sort by grade')], ['name', t('prof.page.stores.sortName', 'Sort by name')], ['count', t('prof.page.stores.sortCount', 'Sort by count')]]) { const o = el('option', null, w); o.value = v; if (v === _stores.sort) o.selected = true; sort.append(o); }
  sort.onchange = () => { _stores.sort = sort.value; rerender(); };
  head.append(search, sort);
  const fams = el('div', 'prof-families');
  for (const [id, word] of [[null, localizedText('all', 'All')], ...MATERIAL_FAMILIES]) {
    const b = el('button', `prof-family${_stores.family === id ? ' on' : ''}`, word);
    b.type = 'button';
    b.onclick = () => { _stores.family = id; rerender(); };
    fams.append(b);
  }
  detail.append(divider(t('prof.page.stores.title', 'The Stores')), head, fams);
  // BAG1: A CARRYING BOOK's page - what is stored and what is carried, side by side; Take out and Put in, in a town
  if (book.carrying?.() === true) { drawCarryStores(detail, rerender, kit); return; }
  const rows = storesRows(book.state.stores, _stores, p.name);
  const grid = el('div', 'prof-grid');
  if (!rows.length) grid.append(el('p', 'px-note', book.state.stores.size ? t('prof.page.stores.noMatch', 'Nothing in the Stores matches.') : storesEmptyLine()));
  for (const r of rows) {
    const card = el('button', `prof-mat${_stores.picked === r.material ? ' on' : ''}`);
    card.type = 'button';
    card.append(matName(el, r, rerender), el('span', 'prof-count', formatNumber(r.total)), el('span', 'prof-split', storesSplit(r)));
    card.onclick = () => { _stores.picked = r.material; _stores.qty = Math.min(_stores.qty, r.total) || 1; _stores.word = null; rerender(); };
    grid.append(card);
  }
  detail.append(grid);
  const pick = rows.find((r) => r.material === _stores.picked);
  if (pick) {
    const bar = el('div', 'prof-matbar');
    bar.append(el('span', 'prof-matline', t('prof.page.stores.matLine', '{name} x{n}, grade {tier}, {value} silver each', { name: pick.name, n: pick.total, tier: pick.tier, value: pick.value })));
    const qty = el('input', 'prof-qty');
    qty.type = 'number'; qty.min = '1'; qty.max = String(Math.min(WITHDRAW_MAX, pick.total)); qty.value = String(Math.min(_stores.qty, pick.total, WITHDRAW_MAX));
    qty.oninput = () => { _stores.qty = Math.max(1, Math.min(WITHDRAW_MAX, pick.total, Math.floor(Number(qty.value) || 1))); };
    const go = el('button', 'act primary', _stores.busy ? t('prof.page.stores.sending', 'Sending...') : t('prof.page.stores.withdraw', 'Withdraw to pack'));
    go.type = 'button';
    go.disabled = _stores.busy || !withdrawable(pick.material);   // PROF3: the smith's stock stays at the bench
    go.onclick = async () => {
      if (_stores.busy) return;
      _stores.busy = true; rerender();
      const res = await p.withdraw(pick.material, Math.max(1, Math.min(_stores.qty, pick.total, WITHDRAW_MAX)));
      _stores.busy = false;
      _stores.word = res?.text ?? null;
      rerender();
    };
    if (withdrawable(pick.material)) bar.append(qty, go);   // AUDIT PROF12 E1: no Withdraw offered for a material with no pack form
    detail.append(bar);
    detail.append(el('p', 'px-note', withdrawable(pick.material)
      ? t('prof.page.stores.withdrawNote', 'A withdrawn material becomes an item in your pack and can\'t go back into the Stores. Writs are delivered on a Notice Board\'s Work tab.')
      : staysLine(pick)));   // SEAT2b part two: a siege work's road
    if ((pick.gold | 0) > 0) detail.append(el('p', 'px-note', goldGoodsLine(pick.material)));
    if ((pick.loose | 0) > 0) detail.append(el('p', 'px-note', looseGoodsLine(pick.material)));   // AUDIT BAG-CRAFT A1: an older book's page (another device's put-in)
  }
  if (_stores.word) detail.append(el('p', 'prof-word', _stores.word));
  drawStationTiles(detail, rerender, kit, [
    ['forge', (d) => drawForge(d, rerender, kit)],
    ['anvil', (d) => drawAnvil(d, rerender, kit)],   // PROF3
    ['temper-anvil', (d) => drawTemper(d, rerender, kit, 'anvil')],   // CRAFT4: the smith's temper
    ['workbench', (d) => drawWorkbench(d, rerender, kit)],   // PROF4
    ['loom', (d) => drawLoom(d, rerender, kit)],   // PROF7
    ['temper-loom', (d) => drawTemper(d, rerender, kit, 'loom')],   // CRAFT4: the tailor's
    ['mason', (d) => drawMasonBench(d, rerender, kit)],   // PROF11
    ['fire', (d) => drawCookFire(d, rerender, kit)],   // PROF9
    ['jeweller', (d) => drawJewellerBench(d, rerender, kit)],   // PROF10
    ['alchemy', (d) => drawAlchemyStation(d, rerender, kit)],   // PROF12
    ['enchant', (d) => drawEnchantingStation(d, rerender, kit)],   // PROF12
  ]);
}

/** MENU-ORDER (2026-10-12): a material card's name with its picture before it - the item the Stores withdraw it as, the
 *  host's to make (`picture`); none (no data, or not made yet) is the name alone. */
function matName(el, r, rerender) {
  const n = el('b', null, r.name);
  const pic = pictureNode(_provider?.picture?.(r.material, rerender) ?? null, el, 'prof-matpic');
  if (pic) { if (n.prepend) n.prepend(pic); else n.append(pic); }
  return n;
}
/** MENU-ORDER (2026-10-12): THE STATIONS AS TILES - each its picture and its short name, the ones worked here lit. */
export const STATION_TILES = Object.freeze({
  forge: ['Forge', 'forge'], anvil: ['Anvil', 'anvil'], 'temper-anvil': ['Temper (anvil)', 'temper'], workbench: ['Workbench', 'saw'],
  loom: ['Loom', 'spool'], 'temper-loom': ['Temper (loom)', 'temper'], mason: ['Mason\'s bench', 'chisel'], fire: ['Fire', 'fire'],
  jeweller: ['Jeweler\'s bench', 'gem'], alchemy: ['Alchemy', 'flask'], enchant: ['Enchanting', 'rune'],
});
/** AUDIT MENU-ORDER C2: WHERE A STATION IS WORKED, by the provider's own word - its station here, or none. A section read
 *  for a press said "Away" at a forge with nothing to temper (its words alone: none to temper), and hid the word a last
 *  piece tempered or disenchanted left there. */
export const STATION_AT = Object.freeze({
  forge: 'forge', anvil: 'forge', 'temper-anvil': 'forge', workbench: 'workbench', loom: 'loom', 'temper-loom': 'loom',
  mason: 'mason', fire: 'fire', jeweller: 'jeweller', alchemy: 'alchemy', enchant: 'enchanter',
});
/** MENU-ORDER: what a tile says under its name - worked here, or where it is worked (its words, under the tiles, on a press). */
export const STATION_TILE_WORDS = Object.freeze({
  get here() { return t('prof.page.tile.here', 'Here'); }, get away() { return t('prof.page.tile.away', 'Away'); },
  get hint() { return t('prof.page.tile.hint', 'Click a station to see where to use it.'); },
});
/** MENU-ORDER: whether a station's section can be worked from here - it draws a press (a button, a field, a choice); one
 *  that draws words alone ("is done at...") is a station the player is away from. Walked by hand, as every fake document
 *  the pins stand on has children and a tag. */
export function stationWorkable(node) {
  for (const c of node?.children ?? []) {
    if (/^(button|input|select|textarea)$/i.test(String(c.tagName ?? c.tag ?? ''))) return true;
    if (stationWorkable(c)) return true;
  }
  return false;
}
/** FIELD BUGS 2026-10-14 STORES-CRASH: walked by iteration, as stationWorkable walks - a browser's `children` is an
 *  HTMLCollection, with no `.some`, so a station's press (the Joinery's bench) threw here, before the press was spent,
 *  and every later Stores page threw with it. */
const holdsHead = (node, id) => {
  if (node?.id === id) return true;
  for (const c of node?.children ?? []) if (holdsHead(c, id)) return true;
  return false;
};
/**
 * MENU-ORDER: THE STATIONS, TILED. A row of tiles, one a station - its picture, its name, Here or Away - over the
 * stations. A station worked here stands below the tiles as it always has, and its tile takes the player to it; one the
 * player is away from shows its words (where it is worked, what it costs there) only when its tile is pressed - the
 * section is kept, hidden, so nothing it says is lost - where nine "is done at" paragraphs stood one after another. A
 * station a press asked the page to land on (STATION-DOOR) is shown.
 */
function drawStationTiles(detail, rerender, kit, list) {
  const { el } = kit;
  const focus = _storesFocus;   // stationHead spends it as it draws
  const drawn = [];
  for (const [id, draw] of list) {
    const box = el('div', 'prof-station');
    draw(box);
    if (!(box.children?.length)) continue;
    const at = /** @type {any} */ (_provider)?.[STATION_AT[id]];
    const here = typeof at === 'function' ? !!at() : stationWorkable(box);   // C2: the provider's word; a press in it where it has none
    if (!here && focus && holdsHead(box, `prof-station-${focus}`)) _stores.awayPick = id;
    drawn.push({ id, box, here });
  }
  if (!drawn.length) return;
  const tiles = el('div', 'prof-stations');
  for (const { id, box, here } of drawn) {
    const [name, icon] = STATION_TILES[id] ?? [id, 'station'];
    const t = el('button', `prof-stile${here ? ' here' : ''}${!here && _stores.awayPick === id ? ' on' : ''}`);
    t.type = 'button';
    t.setAttribute('data-dficon', icon);   // a fake document's node has no dataset
    t.setAttribute('data-station', id);
    if (!here) t.setAttribute('aria-expanded', _stores.awayPick === id ? 'true' : 'false');   // AUDIT MENU-ORDER U15: an away tile opens its words
    t.append(el('span', 'prof-stile-name', name), el('span', 'prof-stile-state', here ? STATION_TILE_WORDS.here : STATION_TILE_WORDS.away));
    t.onclick = () => {
      if (here) { box.scrollIntoView?.({ block: 'start', behavior: 'smooth' }); return; }
      _stores.awayPick = _stores.awayPick === id ? null : id;
      rerender();
    };
    tiles.append(t);
  }
  detail.append(tiles);
  const away = drawn.filter((d) => !d.here);
  if (away.length) {
    const notes = el('div', 'prof-awaynotes');
    for (const { id, box } of away) { box.hidden = _stores.awayPick !== id; notes.append(box); }
    if (!away.some((d) => d.id === _stores.awayPick) && !drawn.some((d) => d.here)) notes.append(el('p', 'prof-stile-hint', STATION_TILE_WORDS.hint));
    detail.append(notes);
  }
  for (const { box, here } of drawn) if (here) detail.append(box);
}

/**
 * BAG1: THE STORES PAGE FOR A CARRYING BOOK (bible/06-Systems/Materials-Bag.md): the bag's load first (or that there is
 * none, and where one is sold), then every material stored or carried - each card its Stores count and split and what
 * the bag and the pack hold of it - and, for the one picked, TAKE OUT (the Stores into the bag, then the pack, as many as
 * fit) and PUT IN (the bag and the pack into the Stores); both only in a town (`inTown`), where the Stores are kept. Put
 * everything in empties what is carried into the Stores at once. The stations below read both.
 */
function drawCarryStores(detail, rerender, kit) {
  const p = /** @type {ProfPagesProvider} */ (_provider);
  const { el } = kit;
  const book = p.book;
  const town = p.inTown?.() === true;
  const bag = p.bag?.() ?? { has: false, kg: 0, max: 0 };
  detail.append(el('p', 'px-note prof-bagline', bag.has ? `Materials Bag: ${bag.kg.toFixed(1)} / ${bag.max} kg` : BAG_PAGE_WORDS.noBag));
  if (!town) detail.append(el('p', 'px-note', BAG_WORDS.town));
  // AUDIT2 BAG1 H1/U2: THE BAG EMPTIED INTO THE PACK - anywhere, on either skin: the classic inventory draws no bag, and a
  // piece no Put in takes (a food that rotted in it) held the bag loaded for good, never to be sold
  if ((bag.count ?? 0) > 0 && p.emptyBag) {
    const empty = el('button', 'act', BAG_PAGE_WORDS.emptyBag);
    empty.type = 'button';
    empty.disabled = _stores.busy;
    empty.onclick = () => {
      if (_stores.busy) return;
      const r = p.emptyBag?.() ?? { moved: 0, left: 0 };
      _stores.word = BAG_PAGE_WORDS.emptied(r.moved | 0, r.left | 0);
      rerender();
    };
    detail.append(empty);
  }
  const all = carryRows(book, p.carriedHeld, p.heldKeys);
  const rows = storesRows(all, _stores, p.name);
  // AUDIT BAG1: whatever the filter shows - the button puts in everything carried, and a search that hid the carried
  // materials hid the button with them
  const carriedAny = [...all.values()].some((r) => r.carried + (r.uncounted | 0) > 0);   // LOOT-LOOSE: and the loose
  if (carriedAny) {
    const allIn = el('button', 'act', _stores.busy ? 'Sending...' : BAG_PAGE_WORDS.allIn);
    allIn.type = 'button';
    allIn.disabled = _stores.busy || !town || !p.deposit;
    if (!town) allIn.title = BAG_WORDS.town;
    allIn.onclick = async () => {
      if (_stores.busy || !p.deposit) return;
      _stores.busy = true; rerender();
      // AUDIT BAG1: a material refused (its Stores full) is said and passed over - the rest still go in; the counting-house
      // silent (a deposit kept) ends the run, its goods on their way
      // FB1020c ONE-SAVE: every put-in planned first, then ONE batch (the provider's deposit - profBook.js depositMany): one
      // save for them all, where a put-in a material each waited on a save of the whole game, in series, every button held
      const refused = [], plan = [];
      for (const r of storesRows(carryRows(book, p.carriedHeld, p.heldKeys), {}, p.name)) {
        // AUDIT2 BAG1 U1: as many as the Stores have room for - a material whose Stores are full is said, never asked
        let room = storesRoomOf(book, r);
        const held = r.carried + (r.uncounted | 0);
        if (held > 0 && room < 1) { refused.push({ name: r.name, text: BAG_PAGE_WORDS.storesFull }); continue; }
        // LOOT-LOOSE: what the service counts by `all` (every origin as it was), then the rest held as loose (`work`)
        for (const [n, order] of /** @type {[number, string][]} */ ([[r.carried, 'all'], [r.uncounted | 0, 'work']])) {
          for (let left = Math.min(n, room); left > 0; left -= DEPOSIT_MAX) {
            const qty = Math.min(left, DEPOSIT_MAX);
            plan.push({ material: r.material, qty, order, name: r.name });
            room -= qty;
          }
        }
      }
      const answers = plan.length ? await p.deposit(plan) : [];
      let moved = 0, stop = null;
      const said = new Set();
      for (const [i, res] of answers.entries()) {
        if (res?.ok) moved += plan[i].qty;
        else if (res?.kept) stop ??= res.text ?? null;
        else if (!said.has(plan[i].material)) { said.add(plan[i].material); refused.push({ name: plan[i].name, text: res?.text ?? null }); }
      }
      _stores.busy = false;
      _stores.word = BAG_PAGE_WORDS.allInDone(moved, refused, stop);
      rerender();
    };
    detail.append(allIn);
  }
  const grid = el('div', 'prof-grid');
  if (!rows.length) grid.append(el('p', 'px-note', all.size ? t('prof.page.stores.noMatch', 'Nothing in the Stores matches.') : storesEmptyCarryLine()));
  for (const r of rows) {
    const card = el('button', `prof-mat${_stores.picked === r.material ? ' on' : ''}`);
    card.type = 'button';
    card.append(matName(el, r, rerender), el('span', 'prof-count', r.total.toLocaleString('en-US')),
      el('span', 'prof-split', [r.total ? storesSplit(r) : null, r.carried ? `${r.carried.toLocaleString('en-US')} carried` : null, r.uncounted ? BAG_PAGE_WORDS.uncountedSplit(r.uncounted) : null].filter(Boolean).join(' · ')));
    card.onclick = () => { _stores.picked = r.material; _stores.qty = Math.max(1, Math.min(_stores.qty, Math.max(r.total, r.carried))); _stores.word = null; rerender(); };
    grid.append(card);
  }
  detail.append(grid);
  const pick = rows.find((r) => r.material === _stores.picked);
  if (pick) {
    const bar = el('div', 'prof-matbar');
    bar.append(el('span', 'prof-matline', `${pick.name} - ${pick.total} stored, ${pick.carried} carried - tier ${pick.tier} - ${pick.value} silver each`));
    const room = Math.max(0, p.room?.(pick.material) ?? 0);
    const outMost = Math.min(WITHDRAW_MAX, pick.total, room);
    const inMost = Math.min(DEPOSIT_MAX, pick.carried + (pick.uncounted | 0), storesRoomOf(book, pick));   // AUDIT2 BAG1 U1: and the Stores' room; LOOT-LOOSE: and the loose
    const most = Math.max(1, outMost, inMost);
    const qty = el('input', 'prof-qty');
    qty.type = 'number'; qty.min = '1'; qty.max = String(most); qty.value = String(Math.min(_stores.qty, most));
    qty.setAttribute('aria-label', 'How many');   // AUDIT2 BAG1 U14: the field said what it counts
    qty.oninput = () => { _stores.qty = Math.max(1, Math.min(most, Math.floor(Number(qty.value) || 1))); };
    const run = (fn) => async () => {
      if (_stores.busy) return;
      _stores.busy = true; rerender();
      const res = await fn();
      _stores.busy = false;
      _stores.word = res?.text ?? null;
      rerender();
    };
    const take = el('button', 'act primary', _stores.busy ? 'Sending...' : 'Take out');
    take.type = 'button';
    take.disabled = _stores.busy || !town || outMost < 1 || !withdrawable(pick.material);
    take.title = !town ? BAG_WORDS.town : room < 1 ? BAG_WORDS.noRoom : '';
    take.onclick = run(() => p.withdraw(pick.material, Math.max(1, Math.min(_stores.qty, outMost))));
    const put = el('button', 'act', _stores.busy ? 'Sending...' : 'Put in');
    put.type = 'button';
    put.disabled = _stores.busy || !town || inMost < 1 || !p.deposit;
    put.title = !town ? BAG_WORDS.town : pick.carried + (pick.uncounted | 0) > 0 && inMost < 1 ? BAG_PAGE_WORDS.storesFull : '';
    // LOOT-LOOSE: the counted units first, by `all` (a `work` order moves no gold's), then the loose by `work`
    // FB1020c ONE-SAVE: the two as one batch - one save
    put.onclick = run(async () => {
      const q = Math.max(1, Math.min(_stores.qty, inMost)), counted = Math.min(q, pick.carried);
      const plan = [...(counted > 0 ? [{ material: pick.material, qty: counted, order: 'all' }] : []), ...(q > counted ? [{ material: pick.material, qty: q - counted, order: 'work' }] : [])];
      const answers = (await p.deposit?.(plan)) ?? [];
      const failed = answers.find((res) => !res?.ok);
      const went = answers.reduce((n, res, i) => n + (res?.ok ? plan[i].qty : 0), 0);
      if (failed) return went > 0 ? { ...failed, text: BAG_PAGE_WORDS.allInDone(went, [], failed.text ?? null) } : failed;
      return answers.length > 1 ? { ...answers[1], text: BAG_PAGE_WORDS.allInDone(q) } : answers[0];
    });
    if (withdrawable(pick.material)) bar.append(qty, take, put);
    detail.append(bar);
    // AUDIT2 BAG1 U14: why Take out or Put in is shut, drawn - a title is no word on a touch screen
    if (town && withdrawable(pick.material)) {
      const why = [pick.total > 0 && room < 1 ? BAG_WORDS.noRoom : null, pick.carried + (pick.uncounted | 0) > 0 && inMost < 1 ? BAG_PAGE_WORDS.storesFull : null].filter(Boolean);
      if (why.length) detail.append(el('p', 'px-note prof-why', why.join(' ')));
    }
    if (pick.uncounted > 0) detail.append(el('p', 'px-note prof-why', BAG_PAGE_WORDS.uncounted));   // UNCOUNTED: what Put in makes of them (LOOT-LOOSE)
    detail.append(el('p', 'px-note', withdrawable(pick.material) ? BAG_PAGE_WORDS.takenNote
      : staysLine(pick)));
    if ((pick.gold | 0) > 0) detail.append(el('p', 'px-note', goldGoodsLine(pick.material)));
    if ((pick.loose | 0) > 0) detail.append(el('p', 'px-note', looseGoodsLine(pick.material)));   // AUDIT BAG-CRAFT A1: a carrying book's page
  }
  if (_stores.word) detail.append(el('p', 'prof-word', _stores.word));
  drawStationTiles(detail, rerender, kit, [   // MENU-ORDER
    ['forge', (d) => drawForge(d, rerender, kit)],
    ['anvil', (d) => drawAnvil(d, rerender, kit)],
    ['temper-anvil', (d) => drawTemper(d, rerender, kit, 'anvil')],   // FB1020c TEMPER-CARRIED: CRAFT4's temper, here too - every live book carries
    ['workbench', (d) => drawWorkbench(d, rerender, kit)],
    ['loom', (d) => drawLoom(d, rerender, kit)],
    ['temper-loom', (d) => drawTemper(d, rerender, kit, 'loom')],   // FB1020c TEMPER-CARRIED: the tailor's
    ['mason', (d) => drawMasonBench(d, rerender, kit)],
    ['fire', (d) => drawCookFire(d, rerender, kit)],
    ['jeweller', (d) => drawJewellerBench(d, rerender, kit)],
    ['alchemy', (d) => drawAlchemyStation(d, rerender, kit)],
    ['enchant', (d) => drawEnchantingStation(d, rerender, kit)],
  ]);
}

/** What the Stores make of a recipe now: the most it can smelt (every input's units over its need), to SMELT_MAX. */
export function smeltable(r, held) {
  let n = SMELT_MAX;
  for (const inp of r.inputs) n = Math.min(n, Math.floor(held(inp.key) / inp.n));
  return Math.max(0, n);
}

/** A work's inputs as its row says them: "2 Iron Ore (14) + 1 Coal (3)". */
const workIns = (r, p, held) => r.inputs.map((inp) => t('prof.page.work.input', '{n} {name} ({held})', { n: inp.n, name: p.name(inp.key), held: held(inp.key) })).join(' + ');
/** A work's yield as its row names it: "Charcoal x2" where a unit makes more than one. */
const workOut = (name, per) => (per > 1 ? t('prof.page.work.out', '{name} x{n}', { name, n: per }) : name);
/** "rank 25" - what a recipe or an unlock asks. */
const rankWord = (rank) => t('prof.page.rankN', 'rank {rank}', { rank });
/** A craft's head: "Iron Longsword - rank 0". */
const craftHead = (name, rank) => t('prof.page.craft.head', '{name} - rank {rank}', { name, rank });
/** A craft's input as the Stores hold it: "Iron Ingot 2 / 3 (2 stored)". */
const inputLine = (name, have, need) => t('prof.page.craft.input', '{name} {have} / {need} ({held} stored)', { name, have: Math.min(have, need), need, held: have });
/** A station's rank: "Smithing 12 (Apprentice)." */
const rankLine = (id, rank) => t('prof.page.rankLine', '{profession} {rank} ({rankName}).', { profession: professionName(id), rank, rankName: rankName(rank) });
/** The odds a margin rolls on: "Standard 60% | Fine 40%". */
const oddsText = (odds) => odds.map((o, q) => (o ? `${QUALITY_NAMES[q]} ${o}%` : null)).filter(Boolean).join(' | ');
const craftWord = () => t('prof.page.craft.go', 'Craft');
const strikeWord = () => t('prof.page.act.strike', 'Strike');
/** A bench's button while its work is in flight (the mason's, the jeweller's). */
const benchBusyWord = () => t('prof.page.craft.atBench', 'At the bench...');
const quickWord = () => t('prof.page.craft.quick', 'Quick craft');

/**
 * A forge's or a workbench's rows of no-act work (PROF2's smelts; PROF4's burns and saws): each recipe's inputs as the
 * Stores hold them, how many it can make, a count and its button - its yield a unit said where it is more than one.
 */
function workRows(detail, rerender, el, recipes, state, verb, busyVerb, go, short = null, hold = false) {
  hold = hold || chaining();   // AUDIT CRAFT1 F1: held under a craft running its chain
  const p = /** @type {ProfPagesProvider} */ (_provider);
  const book = p.book;
  const held = (k) => workOf(book, k);
  const cards = el('div', 'prof-works');   // MENU-ORDER: the works a grid of cards - what it makes, from what, how many, the press
  detail.append(cards);
  for (const r of recipes) {
    const most = smeltable(r, held);
    const row = el('div', `prof-smelt${most ? '' : ' prof-locked'}`);
    // PROF7: the choice that raises a work is read at its own rank - a Tanner's at 50
    const per = workPer(r, r.more ? { [r.more.profession]: book.track(r.more.profession)?.specs?.[workSpecRank(r)] ?? null } : {});
    row.append(el('b', null, workOut(p.name(r.out), per)), el('span', 'prof-split', workIns(r, p, held)));
    const qty = el('input', 'prof-qty');
    qty.type = 'number'; qty.min = '1'; qty.max = String(Math.max(1, most));
    qty.value = String(Math.max(1, Math.min(state.counts[r.id] ?? 1, Math.max(1, most))));
    qty.oninput = () => { state.counts[r.id] = Math.max(1, Math.min(SMELT_MAX, Math.floor(Number(qty.value) || 1))); };
    const b = el('button', 'act', state.busy && _workingOn === r.id ? busyVerb : verb);
    b.type = 'button';
    b.disabled = state.busy || hold || most < 1 || !!short;   // AUDIT 32 P5: `hold` - an act under way at the station
    b.onclick = async () => {
      if (state.busy || hold) return;
      state.busy = true; _workingOn = r.id; rerender();
      const res = await go(r.id, Math.max(1, Math.min(state.counts[r.id] ?? 1, smeltable(r, held))));
      state.busy = false; _workingOn = null;
      state.word = res?.text ?? null;
      rerender();
    };
    row.append(qty, b);
    cards.append(row);
  }
}

/**
 * COUNTER-GATES (AUDIT 2026-10-01 part four): A COUNTER'S BUY, ONE HOME - the loom's AUDIT 32 P6 law for every counter:
 * offered only while Marks are struck, the price held or said before the press (the anvil's and the workbench's offered
 * it whatever the balance, and with Marks shut, and refused it after). `state` the station's page state (its `busy`, its
 * `word`); `who` the counter the button names ('smith', 'furnisher', 'weavers', 'apothecaries' - L10N4: its words the
 * pattern's); `counter` the Weavers' own door, where the stock is theirs.
 * @param {HTMLElement} line
 */
function counterBuy(line, { el, p, state, rerender, key, need, sale, who, counter = null }) {
  if (!p.stock || p.marksOpen?.() === false) return;
  const balance = p.marks?.() ?? null;
  const shortOf = Number.isSafeInteger(balance) && balance < sale.marks * need;
  const buy = el('button', 'act', t('prof.page.buy', 'Buy {n} from {who, select, smith {the smith} furnisher {the furnisher} weavers {the Weavers} other {the Apothecaries}} - {cost} silver', { n: need, who, cost: sale.marks * need }));
  buy.type = 'button';
  buy.disabled = state.busy || shortOf;
  if (shortOf) line.append(el('span', 'prof-split', t('prof.page.buy.hold', 'you hold {balance}', { balance: marksText(balance) })));   // AUDIT 32 R13: "1 Drake"
  buy.onclick = async () => {
    if (state.busy) return;
    state.busy = true; rerender();
    const res = await (counter ? p.stock(key, Math.min(STOCK_MAX, need), counter) : p.stock(key, Math.min(STOCK_MAX, need)));
    state.busy = false; state.word = res?.text ?? null; rerender();
  };
  line.append(buy);
}

/**
 * PROF2: THE FORGE (bible/06-Systems/Professions-Arc.md 4.1, 23) - under the Stores, the smelts: each recipe's inputs
 * as the Stores hold them, how many it can make, a count and Smelt; PROF4: and the logs burnt to Charcoal. Only at a
 * forge: a Weaponsmith's or an Armorer's, whose use fee is paid a smelt, or the player's own home forge.
 * @param {HTMLElement} detail @param {() => void} rerender @param {{ el: Function, divider: (w: string) => HTMLElement }} kit
 */
function drawForge(detail, rerender, { el, divider }) {
  const p = _provider;
  if (!p?.forge || !p.smelt) return;
  const book = p.book;
  const forge = p.forge();
  detail.append(divider(t('prof.page.forge', 'The Forge')));
  if (!forge) {
    detail.append(el('p', 'px-note', t('prof.page.forge.away', 'Smelting is done at a forge: a Weaponsmith\'s or an Armorer\'s ({fee} gold a smelt), or your own home\'s forge.', { fee: FORGE_FEE })));
    return;
  }
  detail.append(el('p', 'px-note', forge.kind === 'shop' ? t('prof.page.forge.shop', 'The smith\'s forge - {fee} gold a smelt.', { fee: forge.fee }) : t('prof.page.forge.home', 'Your forge.')));
  const short = purseShort(forge, 'forge');
  if (short) detail.append(el('p', 'px-note prof-short', short));
  workRows(detail, rerender, el, SMELT_RECIPES, _forge, t('prof.page.forge.smelt', 'Smelt'), t('prof.page.forge.smelting', 'Smelting...'), (id, n) => p.smelt(id, n), short);
  // PROF4: the logs a forge burns - those the Stores hold (a log a Charcoal; a Charcoal Burner's two)
  const burns = BURN_RECIPES.filter((r) => workOf(book, r.inputs[0].key) > 0);
  if (burns.length) workRows(detail, rerender, el, burns, _forge, t('prof.page.forge.burn', 'Burn'), t('prof.page.forge.burning', 'Burning...'), (id, n) => p.smelt(id, n), short);
  if (r0Charcoal(book)) {
    const line = el('p', 'px-note', t('prof.page.forge.charcoal', 'Steel needs Charcoal. Burn a log here to make it, or buy it from the smith.'));
    // CHARCOAL-BUY (AUDIT 2026-10-01 part four): and here is where - the smith's stock was bought only on an anvil
    // recipe short of an input, and no anvil recipe takes Charcoal, so its counter never stood: a smith who fells no
    // tree smelted no Steel. At a smith's forge, the Charcoal a Steel smelt asks, from the counter
    const sale = stockOf('wood:charcoal');
    const steel = SMELT_RECIPES.find((r) => r.inputs.some((i) => i.key === 'wood:charcoal'));
    const need = steel?.inputs.find((i) => i.key === 'wood:charcoal')?.n ?? 1;
    if (sale && forge.kind === 'shop') counterBuy(line, { el, p, state: _forge, rerender, key: 'wood:charcoal', need, sale, who: 'smith' });
    detail.append(line);
  }
  if (_forge.word) detail.append(el('p', 'prof-word', _forge.word));
}
/** Whether the Steel line needs its word: no Charcoal held. */
const r0Charcoal = (book) => workOf(book, 'wood:charcoal') < 1;

// ─── PROF3: THE ANVIL (bible/06-Systems/Professions-Arc.md 9, 24) ─────

/** The anvil's families, in its row's order, and the metals a family is made in. */
const toolsWord = () => t('prof.page.family.tools', 'Tools');
export const ANVIL_FAMILIES = Object.freeze([wordRow('weapons', () => t('prof.page.family.weapons', 'Weapons')), wordRow('armour', () => t('prof.page.family.armour', 'Armour')),
  wordRow('tools', toolsWord), wordRow('kits', () => t('prof.page.family.kits', 'Repair Kits'))]);
/** The recipes the anvil makes for a family - at a metal where one is named (the tools are Iron's alone; the chain is
 *  Steel's). CRAFT2: the anvil lists them as patterns (patternsOf), every metal under its piece. */
export const anvilRecipes = (family, metal = null) => RECIPES.filter((r) => r.profession === 'smithing' && r.family === family && (metal == null || family === 'tools' || r.metal === metal));
/** PROF4: what a craft spends as this character would spend it - a Joiner's half the planks, a Heartwood for one. */
const spendsOf = (r, book, heartwood) => recipeInputs(r, { heartwood: heartwood && takesHeartwood(r), joiner: book.track(r.profession)?.specs?.[50] === 'joiner' });
/** Whether the Stores make a recipe now - its inputs, or (PROF4) what it would spend (`inputs`). */
export const craftable = (r, held, inputs = r.inputs) => inputs.every((inp) => held(inp.key) >= inp.n);

// ─── CRAFT1: THE CHAIN (bible/06-Systems/Professions-Arc.md 41) ─────

/** CRAFT1: the chain a recipe's inputs want from what is held (net/chainLaw.js) - null where they are held as they stand. */
export function chainOf(inputs, book) {
  // AUDIT CRAFT1 F6: a carrying book's `held` reads the pack, the bag and the wagon each call - once a key a plan
  const seen = new Map();
  const held = (k) => { if (!seen.has(k)) seen.set(k, workOf(book, k)); return seen.get(k); };
  return chainNeeded(inputs, held) ? chainPlan(inputs, held, { track: (prof) => book.track(prof), room: (k) => storesRoom(book.store(k)) }) : null;
}
/** CRAFT1: whether inputs not held as they stand are made from what is (the craft runs the chain first, profBook craft). */
export const fromRaw = (inputs, book) => chainOf(inputs, book)?.ok === true;
/** A recipe row's word: held now, made from raw, or wanting its inputs. */
export const makeWord = (can, raw) => (can ? t('prof.page.craft.canMake', 'can make now') : raw ? t('prof.page.craft.fromRaw', 'can make from raw') : t('prof.page.craft.wants', 'needs materials'));   // L10N4: in the player's language (the recipe rows' words, where CRAFT1 moved them)
/** A work's verb, as the stations' own rows say it ('Smelt', 'Burn', 'Saw', 'Cure', 'Weave', 'Cut', 'Mix'). */
const workVerb = (id) => { const v = String(id).split(':')[0]; return ['burn', 'saw', 'cure', 'weave', 'cut', 'mix'].includes(v) ? v : 'smelt'; };
/**
 * CRAFT1: THE CHAIN SAID under a recipe whose inputs are not held as they stand - the works the craft runs first and the
 * goods they take ("Refined first: smelt Iron Ingot x3, ... - from Iron x6, ..."), or what the bottom of the chain is
 * short of. Answers the plan (null where none is wanted).
 */
export function chainNote(box, el, p, book, inputs) {
  const plan = chainOf(inputs, book);
  if (!plan) return null;
  if (!plan.ok) {
    if (plan.short.length) box.append(el('p', 'px-note prof-short', `Not enough raw materials: short of ${plan.short.map((s) => `${p.name(s.key)} x${s.n}`).join(', ')}.`));
    // AUDIT CRAFT1 F1: the Stores' room - every origin counts against it, the gold-bought units too
    if (plan.full.length) box.append(el('p', 'px-note prof-short', `Your Stores have no room for the ${plan.full.map((s) => p.name(s.key)).join(', ')} it would refine.`));
    return plan;
  }
  const made = new Map();
  for (const w of plan.works) {
    const r = smeltRecipe(w.id);
    if (!r) continue;
    const k = `${workVerb(w.id)} ${p.name(r.out)}`;
    made.set(k, (made.get(k) ?? 0) + w.count * chainYield(r, (prof) => book.track(prof)));
  }
  const raw = plan.spent.filter((s) => !inputs.some((i) => i.key === s.key));
  box.append(el('p', 'px-note prof-chain', `Refined first: ${[...made].map(([k, n]) => `${k} x${n}`).join(', ')}${raw.length ? ` - from ${raw.map((s) => `${p.name(s.key)} x${s.n}`).join(', ')}` : ''}. The refining earns its own experience, and anything left over stays in your Stores.`));
  return plan;
}

// ─── CRAFT2: PATTERNS, NOT A MATRIX (bible/06-Systems/Professions-Arc.md 41) ─────

/**
 * @typedef {{ open: boolean, can: boolean, raw: boolean, share: number }} Standing
 * CRAFT2: a recipe as a station stands it - `open` at the rank, `can` its inputs held as they stand, `raw` made from raw
 * goods (CRAFT1's chain), and `share` the part of its inputs' units held (0 to 1).
 */
/** CRAFT2: a station's standing read once a recipe a draw - `of` the station's own (its spends, its rank, its chain). */
export function standings(/** @type {(r: any) => Standing} */ of) {
  const seen = new Map();
  return (/** @type {any} */ r) => { if (!seen.has(r.id)) seen.set(r.id, of(r)); return /** @type {Standing} */ (seen.get(r.id)); };
}
/** CRAFT2: the part of `inputs`' units `held` holds, 0 to 1. */
export const heldShare = (/** @type {readonly { key: string, n: number }[]} */ inputs, /** @type {(k: string) => number} */ held) => {
  const all = inputs.reduce((n, i) => n + i.n, 0);
  return all > 0 ? inputs.reduce((n, i) => n + Math.min(i.n, Math.max(0, held(i.key))), 0) / all : 0;
};
/** CRAFT2: how far a standing goes - made now 3, from raw 2, open 1, shut 0. */
const reach = (/** @type {Standing} */ s) => (!s.open ? 0 : s.can ? 3 : s.raw ? 2 : 1);
/** The highest-tier first - the table's order among a tier (a pattern stands its materials low first, the Warforged after
 *  the Daedric). */
const byTier = (/** @type {readonly any[]} */ rs) => [...rs].sort((a, b) => b.tier - a.tier);
/**
 * CRAFT2: WHAT A PICKED PATTERN IS MADE OF, chosen from what is held: what the last craft here was made of (`madeOf`)
 * where this pattern is made of it and it can be made, now or from raw; else the highest tier made now, then the highest
 * made from raw; else the open one holding the most of its inputs (the Mithril Longsword for three Mithril Ingots, its
 * leather still to buy); else the last craft's material, else the pattern's first.
 * @param {{ recipes: readonly any[] }} pattern @param {(r: any) => Standing} stand @param {string|null} [madeOf]
 */
export function pickedOf(pattern, stand, madeOf = null) {
  const same = pattern.recipes.find((r) => r.madeOf === madeOf) ?? null;
  if (same && reach(stand(same)) >= 2) return same;
  const top = byTier(pattern.recipes);
  const best = top.find((r) => reach(stand(r)) === 3) ?? top.find((r) => reach(stand(r)) === 2);
  if (best) return best;
  let most = null;
  for (const r of top) if (stand(r).open && stand(r).share > 0 && (!most || stand(r).share > stand(most).share)) most = r;
  return most ?? same ?? pattern.recipes[0];
}
/** CRAFT2: the recipe a pattern's row speaks for - the one that goes furthest (the first of the table's among equals),
 *  or where none is open the lowest rank it asks. */
export function patternLead(/** @type {{ recipes: readonly any[] }} */ pattern, /** @type {(r: any) => Standing} */ stand) {
  let lead = pattern.recipes[0];
  for (const r of pattern.recipes) {
    const a = reach(stand(r)), b = reach(stand(lead));
    if (a > b || (a === 0 && b === 0 && r.rank < lead.rank)) lead = r;
  }
  return lead;
}
/**
 * CRAFT2: THE PATTERNS A STATION LISTS - each piece once whatever it is made of (recipeLaw patternsOf), its word the
 * furthest its materials go (`word` the station's own, of the recipe that goes furthest); picking one chooses what it is
 * made of from what is held (pickedOf).
 * @param {HTMLElement} detail @param {Function} el @param {readonly any[]} list @param {any} state @param {() => void} rerender
 * @param {{ stand: (r: any) => Standing, word: (r: any, s: Standing) => string, locked?: boolean }} how
 */
export function patternRows(detail, el, list, state, rerender, { stand, word, locked = false }) {
  const grid = el('div', 'prof-recipes');   // MENU-ORDER: the patterns a grid of cards, not a column of lines
  detail.append(grid);
  for (const pt of patternsOf(list)) {
    const lead = patternLead(pt, stand);
    const s = stand(lead);
    const row = el('button', `prof-recipe${state.pattern === pt.id ? ' on' : ''}${s.can || s.raw ? '' : ' prof-locked'}`);
    row.type = 'button';
    row.disabled = locked;
    row.append(el('b', null, pt.name), el('span', 'prof-split', word(lead, s)));
    row.onclick = () => { const r = pickedOf(pt, stand, state.madeOf); state.pattern = pt.id; state.picked = r.id; state.madeOf = r.madeOf; rerender(); };
    grid.append(row);
  }
}
/** CRAFT2: the recipe a station's box is for - the picked one, where it is still of the pattern shown in `list`. */
export const pickedIn = (/** @type {readonly any[]} */ list, /** @type {any} */ state) => list.find((x) => x.id === state.picked && x.product === state.pattern) ?? null;
/**
 * CRAFT2: WHAT THE PICKED PATTERN IS MADE OF, a button each of its materials (none where it is made one way) - the one
 * chosen marked, one that cannot be made now or from raw dimmed, one past the rank naming the rank it asks.
 * @param {HTMLElement} box @param {Function} el @param {readonly any[]} list @param {any} r @param {any} state
 * @param {() => void} rerender @param {(r: any) => Standing} stand @param {boolean} [locked]
 */
export function materialRow(box, el, list, r, state, rerender, stand, locked = false) {
  const made = list.filter((x) => x.product === r.product);
  if (made.length < 2) return;
  const row = el('div', 'prof-families prof-metals prof-made');
  for (const x of made) {
    const s = stand(x);
    const b = el('button', `prof-family${x.id === r.id ? ' on' : ''}${s.can || s.raw ? '' : ' prof-locked'}`, s.open ? x.madeOf : `${x.madeOf} - rank ${x.rank}`);
    b.type = 'button';
    b.disabled = locked;
    b.onclick = () => { state.picked = x.id; state.madeOf = x.madeOf; rerender(); };
    row.append(b);
  }
  box.append(row);
}

/** The heat let go: its loop and its keys. */
function endHeat() {
  _anvil.off?.();
  _anvil.off = null;
  _anvil.strike = null;
  _anvil.act = null;
  _anvil.els = null;
  _anvil.actRecipe = null; _anvil.actWood = false;
}
/** The heat's frame: the glow ticked, its bar drawn, the act ended when the page is gone; the craft asked on the third
 *  strike. */
function heatLoop(rerender, finish) {
  const raf = globalThis.requestAnimationFrame?.bind(globalThis) ?? ((fn) => setTimeout(() => fn(Date.now()), 16));
  const caf = globalThis.cancelAnimationFrame?.bind(globalThis) ?? clearTimeout;
  let last = null, id = 0, live = true, inStep = false;
  const reduced = !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const clock = () => globalThis.performance?.now?.() ?? Date.now();
  // the next frame - never inside this one (a frame source that answers at once, as a test's does, is a timer's then)
  const next = () => { id = raf(() => { if (inStep) setTimeout(step, 16); else step(); }); };
  const step = () => {
    if (!live || !_anvil.act) return;
    inStep = true;
    try {
      const els = _anvil.els;
      if (!els?.bar || els.bar.isConnected === false) { _anvil.act.cancel(); endHeat(); return; }   // the page shut under the act: nothing spent
      const t = clock();
      const dt = last == null ? 0 : Math.min(0.1, (t - last) / 1000);
      last = t;
      _anvil.act.tick(dt);
      const g = _anvil.act.glow;
      els.marker.style.left = `${(g * 100).toFixed(1)}%`;
      if (!reduced) els.bar.style.setProperty?.('--heat', g.toFixed(3));
      els.bar.classList.toggle('prof-inband', _anvil.act.inBand);
      next();
    } finally { inStep = false; }
  };
  const strike = (e) => {
    const a = _anvil.act;
    if (!a) return;
    const hit = a.strike(pressLead(e, last));   // AUDIT 32 P1: at the press's own moment
    if (hit == null) return;
    _anvil.els?.marks?.[a.state.strikes.length - 1]?.classList.add(hit ? 'hit' : 'miss');
    if (a.state.done) { const clean = a.report().clean; endHeat(); finish(clean); }
  };
  const key = (e) => actKey(e, _anvil.els?.hit, strike);
  globalThis.document?.addEventListener?.('keydown', key, true);
  // AUDIT 31: the first frame once the page that drew the heat is in the document - a frame source that answers at once
  // (a test's) ran it inside the draw, and a bar not yet attached read as "the page shut under the act"
  Promise.resolve().then(() => { if (live) next(); });
  _anvil.off = () => { live = false; caf(id); globalThis.document?.removeEventListener?.('keydown', key, true); };
  return strike;
}

/**
 * PROF3: THE ANVIL - beside the forge (section 24: the anvil stands wherever the forge does), named and not pictured: the
 * families and the metals, each recipe with its inputs as the Stores hold them, the rank it asks and the odds the smith's
 * margin rolls on; the smith's stock where a fitting is short (a smith's forge alone); Craft (the heat) and Quick craft.
 * @param {HTMLElement} detail @param {() => void} rerender @param {{ el: Function, divider: (w: string) => HTMLElement }} kit
 */
function drawAnvil(detail, rerender, { el, divider }) {
  const p = _provider;
  if (!p?.forge || !p.craft) return;
  const book = p.book;
  const forge = p.forge();
  detail.append(divider(t('prof.page.anvil', 'The Anvil')));
  if (!forge) {
    endHeat();
    detail.append(el('p', 'px-note', t('prof.page.anvil.away', 'Smithing is done at an anvil, beside a forge: a Weaponsmith\'s or an Armorer\'s ({fee} gold a craft), or your own home\'s forge.', { fee: FORGE_FEE })));
    return;
  }
  const rank = book.track('smithing')?.rank ?? 0;
  const specs = book.track('smithing')?.specs ?? {};
  detail.append(el('p', 'px-note', `${forge.kind === 'shop' ? t('prof.page.anvil.shop', 'The smith\'s anvil - {fee} gold a craft.', { fee: forge.fee }) : t('prof.page.anvil.home', 'Your anvil.')} ${rankLine('smithing', rank)}`));
  const short = purseShort(forge, 'anvil');
  if (short) detail.append(el('p', 'px-note prof-short', short));
  // AUDIT 30 A2: Gentle acts switched on under a heat lets it cool - nothing is spent, and the craft is a plain one
  if (_anvil.act && getPref('gentleActs') === true) { _anvil.act.cancel(); endHeat(); _anvil.word = heatDownLine(); }
  // AUDIT 30 A3: nothing else is picked while the heat is struck - the heat makes the recipe it began on
  const striking = !!_anvil.act;
  const held = (k) => workOf(book, k);
  const fams = el('div', 'prof-families');
  for (const [id, word] of ANVIL_FAMILIES) {
    const b = el('button', `prof-family${_anvil.family === id ? ' on' : ''}`, word);
    b.type = 'button';
    b.disabled = striking;
    b.onclick = () => { _anvil.family = id; _anvil.picked = null; _anvil.pattern = null; rerender(); };
    fams.append(b);
  }
  detail.append(fams);
  // CRAFT2: the family's patterns, every metal under its piece - the metal chosen from what is held (pickedOf)
  const list = anvilRecipes(_anvil.family);
  const stand = standings((x) => {
    const sp = spendsOf(x, book, false);
    const open = recipeOpen(x, rank), can = open && craftable(x, held, sp);
    return { open, can, raw: open && !can && fromRaw(sp, book), share: heldShare(sp, held) };   // CRAFT1: made from raw
  });
  patternRows(detail, el, list, _anvil, rerender, { stand, word: (x, s) => (s.open ? makeWord(s.can, s.raw) : rankWord(x.rank)), locked: striking });
  const r = pickedIn(list, _anvil);
  if (r) {
    const box = el('div', 'prof-craft');
    box.append(el('b', null, craftHead(r.name, r.rank)));
    materialRow(box, el, list, r, _anvil, rerender, stand, striking);   // CRAFT2: its metals
    const spends = spendsOf(r, book, _anvil.heartwood);
    for (const inp of spends) {
      const have = held(inp.key);
      const line = el('div', `prof-input${have >= inp.n ? '' : ' prof-short'}`);
      line.append(el('span', null, inputLine(p.name(inp.key), have, inp.n)));
      const sale = stockOf(inp.key);
      if (sale && have < inp.n && forge.kind === 'shop') counterBuy(line, { el, p, state: _anvil, rerender, key: inp.key, need: inp.n - have, sale, who: 'smith' });   // COUNTER-GATES
      box.append(line);
    }
    const chain = chainNote(box, el, p, book, spends);   // CRAFT1: the works it runs first
    _anvil.chained = chain?.ok === true;   // AUDIT CRAFT1 F1: a craft pressed now runs its chain - the work rows held under it
    if (rollsQuality(r) && recipeOpen(r, rank)) {   // CRAFT5: a Repair Kit's quality too
      const odds = qualityOdds(rank - r.rank, { masterwright: specs[100] === 'masterwright' });
      box.append(el('p', 'px-note', t('prof.page.anvil.odds', 'Quality chances: {odds}. They get better the further your rank ({rank}) is above the recipe\'s ({need}). Land every strike while the glow is in the band to raise the result one quality.', { odds: oddsText(odds), rank, need: r.rank })));
    }
    if (recipeOpen(r, rank)) box.append(el('p', 'px-note', craftXpLine(r, rank, professionName('smithing'), craftPayOf(book, 'smithing'))));   // CRAFT-FIRST-SHOWN; CRAFT-LIMIT-SAID: as the service credits it
    if (r.kind === 'kit') box.append(el('p', 'px-note', KIT_REACH_LINE));
    heartwoodToggle(box, el, r, book, _anvil, rerender, striking);   // PROF4: a Heartwood for a plank - the axes, hammers, shields, the Spade
    const gentle = getPref('gentleActs') === true;
    const elsewhere = handsAt(_anvil);   // AUDIT 32 P2
    if (elsewhere && !_anvil.act) box.append(el('p', 'px-note', handsLine(elsewhere)));
    const ready = recipeOpen(r, rank) && (craftable(r, held, spends) || chain?.ok === true) && !_anvil.busy && !_anvil.crafting && !_anvil.act && !elsewhere && !short;
    // AUDIT 30 A3: a craft bound to its recipe and its Heartwood when the heat began, never to the page's pick at its end;
    // AUDIT 32 P5: its own flag in flight - a stock purchase answered under it re-offered Craft mid-craft
    const craftOf = (id, wood) => async (clean) => {
      _anvil.crafting = true; rerender();
      const res = await p.craft(id, { clean: clean && getPref('gentleActs') !== true, heartwood: wood });
      _anvil.crafting = false; _anvil.word = res?.text ?? null; rerender();
    };
    const finish = craftOf(r.id, _anvil.heartwood && takesHeartwood(r));
    if (_anvil.act) {
      // THE HEAT: the glow's bar, its band, the strikes so far
      const panel = el('div', 'prof-heat');
      const bar = el('div', 'prof-heatbar');
      const band = el('div', 'prof-heatband');
      band.style.left = `${(_anvil.act.state.lo * 100).toFixed(1)}%`;
      band.style.width = `${((_anvil.act.state.hi - _anvil.act.state.lo) * 100).toFixed(1)}%`;
      const marker = el('div', 'prof-heatmark');
      bar.append(band, marker);
      const marks = el('div', 'prof-strikes');
      const dots = [];
      for (let i = 0; i < HEAT_ACT.strikes; i++) { const d = el('span', `prof-strike${i < _anvil.act.state.strikes.length ? (_anvil.act.state.strikes[i] ? ' hit' : ' miss') : ''}`, 'o'); dots.push(d); marks.append(d); }
      const hit = actButton(el, strikeWord(), (e) => _anvil.strike?.(e));   // AUDIT 32 P1
      const cancel = el('button', 'act', t('prof.page.anvil.cool', 'Let it cool'));
      cancel.type = 'button';
      cancel.onclick = () => { _anvil.act?.cancel(); endHeat(); _anvil.word = heatDownLine(); rerender(); };
      panel.append(el('span', 'prof-heatword', t('prof.page.anvil.heat', 'The heat: strike while the glow is in the band (Space)')), bar, marks, hit, cancel);
      box.append(panel);
      _anvil.els = { bar, marker, marks: dots, hit };
      if (!_anvil.off) _anvil.strike = heatLoop(rerender, craftOf(_anvil.actRecipe ?? r.id, _anvil.actRecipe ? _anvil.actWood : _anvil.heartwood && takesHeartwood(r)));
    } else {
      const go = el('button', 'act primary', _anvil.crafting ? t('prof.page.anvil.crafting', 'At the anvil...') : craftWord());
      go.type = 'button';
      go.disabled = !ready;
      go.onclick = () => {
        if (gentle) { void finish(false); return; }   // Gentle acts: a plain craft, no heat
        _anvil.act = createHeatAct({ band: p.heatBand?.() ?? 1 });
        _anvil.actRecipe = r.id; _anvil.actWood = _anvil.heartwood && takesHeartwood(r);
        rerender();
      };
      const quick = el('button', 'act', quickWord());
      quick.type = 'button';
      quick.disabled = !ready;
      quick.onclick = () => { void finish(false); };
      box.append(go, quick);
    }
    detail.append(box);
  }
  if (_anvil.word) detail.append(el('p', 'prof-word', _anvil.word));
}

// ─── PROF4: THE WORKBENCH (bible/06-Systems/Professions-Arc.md 4.2, 9.3, 9.4, 25) ─────

/** A Heartwood for one of a recipe's planks (PROF0 25) - a quality step, one with a Warforged ingot; offered where the
 *  recipe asks a plank and takes a quality, and the Stores hold one. */
function heartwoodToggle(box, el, r, book, state, rerender, locked = false) {
  if (!takesHeartwood(r)) { state.heartwood = false; return; }
  const have = workOf(book, 'wood:heartwood');
  if (have < 1) { state.heartwood = false; return; }
  const lab = el('label', 'prof-gentle');
  const cb = el('input');
  cb.type = 'checkbox';
  cb.checked = state.heartwood === true;
  cb.disabled = locked;   // AUDIT 30 A3: the act under way keeps the wood it began with
  cb.onchange = () => { state.heartwood = !!cb.checked; rerender(); };
  lab.append(cb, globalThis.document.createTextNode(` ${t('prof.page.heartwood', 'Use a Heartwood for a plank one grade better ({n} stored)', { n: have })}`));
  box.append(lab);
}
/** The workbench's families, in its row's order: staves and bows by wood, the arrows, the furniture by wood, the Basket,
 *  the Ram Kit. */
export const BENCH_FAMILIES = Object.freeze([wordRow('staves', () => t('prof.page.family.staves', 'Staves')), wordRow('bows', () => t('prof.page.family.bows', 'Bows')),
  wordRow('arrows', () => localizedText('Arrows', 'Arrows')), wordRow('furniture', () => t('prof.page.family.furniture', 'Furniture')), wordRow('tools', toolsWord),
  wordRow('siege', () => t('prof.page.family.siege', 'Siege'))]);
/** The woods a family is shown by - every wood for the staves and bows, DFU's furniture's four and the beds' for the
 *  furniture; none for the rest. */
const WOODS_OF = Object.freeze({ staves: WOODS.map((w) => `plank:${w.id}`), bows: WOODS.map((w) => `plank:${w.id}`), furniture: ['plank:pine', 'plank:oak', 'plank:cherry', 'plank:mahogany', 'plank:teak'] });
/** The recipes the workbench makes for a family - at a wood where one is named. CRAFT2: listed as patterns, every wood
 *  under its piece. */
export const benchRecipes = (family, wood = null) => RECIPES.filter((r) => r.profession === 'carpentry' && r.family === family && (wood == null || !WOODS_OF[family] || r.wood === wood));
/** What the plane's board says of its act, for the page and the pins. */
export const planeWord = (rep) => (rep ? (rep.clean ? t('prof.page.plane.clean', 'A clean pass, true to the grain.') : rep.seconds < PLANE_ACT.minS ? t('prof.page.plane.quick', 'Too quick. Draw the plane slowly.')
  : rep.seconds > PLANE_ACT.maxS ? t('prof.page.plane.slow', 'Too slow. The stroke wandered.') : t('prof.page.plane.strayed', 'The plane strayed from the grain.')) : '');

/**
 * THE PLANE'S BOARD: the grain drawn across it, the player's stroke over it as they draw, the pointer's press, draw and
 * release fed to the act; the craft asked when the pass reaches the foot.
 */
function planeBoard(el, act, finish, rerender) {
  const NS = 'http://www.w3.org/2000/svg';
  const doc = globalThis.document;
  const board = el('div', 'prof-board');
  const svg = doc.createElementNS?.(NS, 'svg');
  const pts = [];
  const trail = svg ? doc.createElementNS(NS, 'polyline') : null;
  if (svg) {
    svg.setAttribute('viewBox', '0 0 100 40');
    svg.setAttribute('preserveAspectRatio', 'none');
    const grain = doc.createElementNS(NS, 'polyline');
    const g = [];
    for (let i = 0; i <= 40; i++) { const x = i / 40; g.push(`${(x * 100).toFixed(1)},${(20 - act.grain(x) * 20).toFixed(2)}`); }
    grain.setAttribute('points', g.join(' '));
    grain.setAttribute('class', 'prof-grain');
    trail.setAttribute('class', 'prof-trail');
    const head = doc.createElementNS(NS, 'rect');
    head.setAttribute('x', '0'); head.setAttribute('y', '0'); head.setAttribute('width', String(PLANE_ACT.headX * 100)); head.setAttribute('height', '40');
    head.setAttribute('class', 'prof-boardhead');
    svg.append(head, grain, trail);
    board.append(svg);
  }
  const at = (e) => {
    const r = board.getBoundingClientRect?.() ?? { left: 0, top: 0, width: 1, height: 1 };
    const x = Math.max(0, Math.min(1, (e.clientX - r.left) / (r.width || 1)));
    const y = -(((e.clientY - r.top) / (r.height || 1)) * 2 - 1);
    return [x, y];
  };
  const now = () => (globalThis.performance?.now?.() ?? Date.now()) / 1000;
  const done = () => { const rep = act.report(); finish(rep?.clean === true, rep); };
  // AUDIT 30 A2: a board drawn anew lost whatever drag the old one had - no release ever reached it
  if (act.state.planing) act.release();
  board.onpointerdown = (e) => {
    const [x, y] = at(e);
    if (!act.press(x, y, now())) return;
    board.setPointerCapture?.(e.pointerId);
    pts.length = 0; pts.push(`${(x * 100).toFixed(1)},${(20 - y * 20).toFixed(2)}`);
    trail?.setAttribute('points', pts.join(' '));
  };
  board.onpointermove = (e) => {
    if (!act.state.planing) return;
    // AUDIT 30 A2: the plane moves while it is held - a pointer passing over with nothing pressed lets go of the pass
    if (!((e.buttons ?? 1) & 1)) { act.release(); rerender(); return; }
    if (board.isConnected === false) { act.cancel(); return; }
    const [x, y] = at(e);
    act.move(x, y, now());
    pts.push(`${(x * 100).toFixed(1)},${(20 - y * 20).toFixed(2)}`);
    trail?.setAttribute('points', pts.join(' '));
    if (act.state.done) done();
  };
  board.onpointerup = () => { if (act.state.planing) { act.release(); rerender(); } };
  board.onpointercancel = board.onpointerup;
  return board;
}

/**
 * PROF4: THE WORKBENCH - the sawing (a log to planks), and Carpentry's recipes by family and wood, each with its inputs
 * as the Stores hold them (a Joiner's half the planks; a Heartwood for one), the rank it asks and the odds; the
 * furnisher's Linen where a bed wants it (a Furniture Store's alone); Craft (the plane) and Quick craft. Only at a
 * workbench: a Furniture Store's, its fee a craft or a saw, or the player's own home's - CARP-YARD: or a joinery's in the
 * street (systems/merchantYards.js YARD_BENCH: its carpenter paid the same fee; the landing a press on it makes).
 * @param {HTMLElement} detail @param {() => void} rerender @param {{ el: Function, divider: (w: string) => HTMLElement }} kit
 */
function drawWorkbench(detail, rerender, { el, divider }) {
  const p = _provider;
  if (!p?.workbench || !p.craft || !p.smelt) return;
  const book = p.book;
  const bench = p.workbench();
  detail.append(stationHead(divider, t('prof.page.bench', 'The Workbench'), 'workbench'));   // CARP-YARD: a joinery's press lands here
  if (!bench) {
    _bench.act?.cancel(); _bench.act = null; _bench.actRecipe = null;
    detail.append(el('p', 'px-note', t('prof.page.bench.away', 'Carpentry is done at a workbench: a Furniture Store\'s or a joinery\'s ({fee} gold a craft or a saw), or your own home\'s.', { fee: WORKBENCH_FEE })));
    return;
  }
  const rank = book.track('carpentry')?.rank ?? 0;
  const who = bench.who ?? 'furnisher';   // CARP-YARD: a joinery's carpenter
  detail.append(el('p', 'px-note', `${bench.kind === 'shop' ? t('prof.page.bench.shop', 'The {who, select, carpenter {carpenter} other {furnisher}}\'s workbench - {fee} gold a craft or a saw.', { who, fee: bench.fee }) : t('prof.page.bench.home', 'Your workbench.')} ${rankLine('carpentry', rank)}`));
  const short = purseShort(bench, 'workbench');
  if (short) detail.append(el('p', 'px-note prof-short', short));
  // AUDIT 30 A2: Gentle acts switched on under a pass sets the plane down - nothing spent, the craft a plain one
  if (_bench.act && getPref('gentleActs') === true) { _bench.act.cancel(); _bench.act = null; _bench.actRecipe = null; _bench.word = planeDownLine(); }
  const planing = !!_bench.act;   // AUDIT 30 A3: nothing else picked while the plane is drawn
  // THE SAW: the logs the Stores hold, to planks (a Timberwright's three)
  const saws = SAW_RECIPES.filter((r) => workOf(book, r.inputs[0].key) > 0);
  if (saws.length) workRows(detail, rerender, el, saws, _bench, t('prof.page.bench.saw', 'Saw'), t('prof.page.bench.sawing', 'Sawing...'), (id, n) => p.smelt(id, n), short, !!_bench.act);   // AUDIT 32 P5: held while planing
  else detail.append(el('p', 'px-note', t('prof.page.bench.noLogs', 'A log saws into two planks here. Logs come from Logging.')));
  const held = (k) => workOf(book, k);
  const fams = el('div', 'prof-families');
  for (const [id, word] of BENCH_FAMILIES) {
    const b = el('button', `prof-family${_bench.family === id ? ' on' : ''}`, word);
    b.type = 'button';
    b.disabled = planing;
    b.onclick = () => { _bench.family = id; _bench.picked = null; _bench.pattern = null; rerender(); };
    fams.append(b);
  }
  detail.append(fams);
  // CRAFT2: the family's patterns, every wood (an arrow's fletching) under its piece - chosen from what is held
  const list = benchRecipes(_bench.family);
  const stand = standings((x) => {
    const sp = spendsOf(x, book, false);
    const open = !x.later && recipeOpen(x, rank), can = open && craftable(x, held, sp);
    return { open, can, raw: open && !can && fromRaw(sp, book), share: heldShare(sp, held) };   // CRAFT1: made from raw (a log sawn first)
  });
  patternRows(detail, el, list, _bench, rerender, { stand, word: (x, s) => (x.later ? LATER_WORDS.SEAT2 : s.open ? makeWord(s.can, s.raw) : rankWord(x.rank)), locked: planing });
  const r = pickedIn(list, _bench);
  if (r) {
    const box = el('div', 'prof-craft');
    box.append(el('b', null, craftHead(r.name, r.rank)));
    materialRow(box, el, list, r, _bench, rerender, stand, planing);   // CRAFT2: its woods
    const spends = spendsOf(r, book, _bench.heartwood);
    for (const inp of spends) {
      const have = held(inp.key);
      const line = el('div', `prof-input${have >= inp.n ? '' : ' prof-short'}`);
      line.append(el('span', null, inputLine(p.name(inp.key), have, inp.n)));
      const sale = stockOf(inp.key);
      if (sale?.counter === 'furnisher' && have < inp.n && bench.kind === 'shop' && !bench.yard) counterBuy(line, { el, p, state: _bench, rerender, key: inp.key, need: inp.n - have, sale, who: 'furnisher' });   // COUNTER-GATES
      box.append(line);
    }
    const chain = chainNote(box, el, p, book, spends);   // CRAFT1: the works it runs first
    _bench.chained = chain?.ok === true;   // AUDIT CRAFT1 F1: a craft pressed now runs its chain - the work rows held under it
    if (r.later) box.append(el('p', 'px-note', t('prof.page.later.anyLine', 'Comes with a later work.')));   // a recipe named before its slice (none since SEAT2b part two)
    else if (r.kind === 'siege') box.append(el('p', 'px-note', t('prof.page.bench.ramKit', 'A Ram Kit goes to your Stores. Deliver it to your guild\'s Siege Camp with a seat writ. If the camp wins a Right of Siege, it goes to the battle against a Gatehouse.')));   // SEAT2b part two: a siege work's road
    else if (r.kind === 'arrows') box.append(el('p', 'px-note', t('prof.page.bench.arrows', 'Makes a quiver of 20 arrows. Arrows have no quality.')));
    else if (r.family === 'furniture') box.append(el('p', 'px-note', t('prof.page.bench.furniture', 'Furniture goes to your things. Place it in a room of your own with Decorate.')));
    if (takesQuality(r) && recipeOpen(r, rank)) {
      const odds = qualityOdds(rank - r.rank, { masterwright: false });
      box.append(el('p', 'px-note', t('prof.page.bench.odds', 'Quality chances: {odds}. They get better the further your rank ({rank}) is above the recipe\'s ({need}). Draw the plane true to the grain to raise the result one quality.', { odds: oddsText(odds), rank, need: r.rank })));
    }
    if (!r.later && recipeOpen(r, rank)) box.append(el('p', 'px-note', craftXpLine(r, rank, professionName('carpentry'), craftPayOf(book, 'carpentry'))));   // CRAFT-FIRST-SHOWN: Building's; CRAFT-LIMIT-SAID
    heartwoodToggle(box, el, r, book, _bench, rerender, planing);
    const gentle = getPref('gentleActs') === true;
    const elsewhere = handsAt(_bench);   // AUDIT 32 P2
    if (elsewhere && !_bench.act) box.append(el('p', 'px-note', handsLine(elsewhere)));
    const ready = !r.later && recipeOpen(r, rank) && (craftable(r, held, spends) || chain?.ok === true) && !_bench.busy && !_bench.crafting && !_bench.act && !elsewhere && !short;
    // AUDIT 30 A3: the pass makes the recipe it began on, with its Heartwood - never the page's pick when it lands; AUDIT 32
    // P5: its own flag in flight, as the loom's
    const craftOf = (id, wood) => async (clean, rep = null) => {
      _bench.act = null; _bench.actRecipe = null;
      _bench.crafting = true; rerender();
      const res = await p.craft(id, { clean: clean && getPref('gentleActs') !== true, heartwood: wood });
      _bench.crafting = false; _bench.word = [planeWord(rep), res?.text ?? ''].filter(Boolean).join(' ') || null; rerender();
    };
    const finish = craftOf(r.id, _bench.heartwood && takesHeartwood(r));
    if (_bench.act) {
      // THE PLANE: draw along the grain from its head to its foot
      const panel = el('div', 'prof-plane');
      panel.append(el('span', 'prof-heatword', t('prof.page.plane.how', 'The plane: press at the top of the board and draw along the grain to the bottom')));
      const planed = craftOf(_bench.actRecipe ?? r.id, _bench.actRecipe ? _bench.actWood : _bench.heartwood && takesHeartwood(r));
      panel.append(planeBoard(el, _bench.act, (clean, rep) => { void planed(clean, rep); }, rerender));
      if (_bench.act.state.slips) panel.append(el('span', 'prof-split', t('prof.page.plane.slips', '{n, plural, one {let go # time - start again at the head} other {let go # times - start again at the head}}', { n: _bench.act.state.slips })));
      const cancel = el('button', 'act', t('prof.page.plane.setDown', 'Set the plane down'));
      cancel.type = 'button';
      cancel.onclick = () => { _bench.act?.cancel(); _bench.act = null; _bench.actRecipe = null; _bench.word = planeDownLine(); rerender(); };
      panel.append(cancel);
      box.append(panel);
    } else {
      const go = el('button', 'act primary', _bench.crafting ? t('prof.page.bench.crafting', 'At the workbench...') : craftWord());
      go.type = 'button';
      go.disabled = !ready;
      go.onclick = () => {
        if (gentle) { void finish(false); return; }   // Gentle acts: a plain craft, no plane
        _bench.act = createPlaneAct({ rank, band: p.planeBand?.() ?? 1 });
        _bench.actRecipe = r.id; _bench.actWood = _bench.heartwood && takesHeartwood(r);
        rerender();
      };
      const quick = el('button', 'act', quickWord());
      quick.type = 'button';
      quick.disabled = !ready;
      quick.onclick = () => { void finish(false); };
      box.append(go, quick);
    }
    detail.append(box);
  }
  if (_bench.word) detail.append(el('p', 'prof-word', _bench.word));
}

// ─── PROF7: THE LOOM AND THE TANNING RACK (bible/06-Systems/Professions-Arc.md 4.4, 4.5, 9.3, 9.4, 29) ─────

/** The loom's families, in its row's order: the leather armour, the clothing, the rugs, tapestries and skins, the
 *  Fishing-Net. */
export const LOOM_FAMILIES = Object.freeze([wordRow('leather', () => localizedText('leather', 'Leather')), wordRow('clothing', () => t('prof.page.family.clothing', 'Clothing')),
  wordRow('furnishings', () => t('prof.page.family.furnishings', 'Furnishings')), wordRow('tools', toolsWord)]);
/** DFU's two clothing groups, as the loom's row names them. */
const CLOTHING_ROW = Object.freeze([wordRow('MensClothing', () => t('prof.page.loom.mens', 'Men\'s')), wordRow('WomensClothing', () => t('prof.page.loom.womens', 'Women\'s'))]);
/** The recipes the loom makes for a family - a garment of the group shown, of the cloth where one is named. CRAFT2: listed
 *  as patterns, every cloth under its garment. */
export const loomRecipes = (family, cloth = null, clothing = 'MensClothing') => RECIPES.filter((r) => r.profession === 'outfitting' && r.family === family
  && (family !== 'clothing' || ((cloth == null || r.cloth === cloth) && r.group === clothing)));
/** A dye's name as the loom says it ("Dark Brown"). */
export const dyeWord = (dye) => DYE_WORDS[DYE_NAMES[dye]]?.() ?? String(DYE_NAMES[dye] ?? dye).replace(/([a-z])([A-Z])/g, '$1 $2');
/** L10N4: DFU's ten clothing dyes as the loom says them, in the player's language. */
const DYE_WORDS = Object.freeze({
  Blue: () => t('prof.page.dye.blue', 'Blue'), Grey: () => t('prof.page.dye.grey', 'Grey'), Red: () => t('prof.page.dye.red', 'Red'),
  DarkBrown: () => t('prof.page.dye.darkBrown', 'Dark Brown'), Purple: () => t('prof.page.dye.purple', 'Purple'), LightBrown: () => t('prof.page.dye.lightBrown', 'Light Brown'),
  White: () => t('prof.page.dye.white', 'White'), Aquamarine: () => t('prof.page.dye.aquamarine', 'Aquamarine'), Yellow: () => t('prof.page.dye.yellow', 'Yellow'),
  Green: () => t('prof.page.dye.green', 'Green'),
});

/** Tests: the loom's state - its stitch ticked by hand, as a frame would. */
export const _loomForTests = () => _loom;
/** The stitch let go: its loop and its keys. */
function endStitch() {
  _loom.off?.();
  _loom.off = null;
  _loom.stitch = null;
  _loom.act = null;
  _loom.els = null;
  _loom.actRecipe = null; _loom.actDye = null;
}
/** The stitch's frame: the beat ticked and its marker drawn, the act ended when the page is gone; the craft asked on the
 *  eighth stitch (the heat's loop, a beat for a glow). */
function stitchLoop(finish) {
  const raf = globalThis.requestAnimationFrame?.bind(globalThis) ?? ((fn) => setTimeout(() => fn(Date.now()), 16));
  const caf = globalThis.cancelAnimationFrame?.bind(globalThis) ?? clearTimeout;
  let last = null, id = 0, live = true, inStep = false;
  const clock = () => globalThis.performance?.now?.() ?? Date.now();
  const next = () => { id = raf(() => { if (inStep) setTimeout(step, 16); else step(); }); };
  const step = () => {
    if (!live || !_loom.act) return;
    inStep = true;
    try {
      const els = _loom.els;
      if (!els?.bar || els.bar.isConnected === false) { _loom.act.cancel(); endStitch(); return; }   // the page shut under the act: nothing spent
      const t = clock();
      const dt = last == null ? 0 : Math.min(0.1, (t - last) / 1000);
      last = t;
      _loom.act.tick(dt);
      els.marker.style.left = `${(_loom.act.beat * 100).toFixed(1)}%`;
      els.bar.classList.toggle('prof-inband', _loom.act.onBeat);
      next();
    } finally { inStep = false; }
  };
  const stitch = (e) => {
    const a = _loom.act;
    if (!a) return;
    const hit = a.stitch(pressLead(e, last));   // AUDIT 32 P1: at the press's own moment
    if (hit == null) return;
    _loom.els?.marks?.[a.state.stitches.length - 1]?.classList.add(hit ? 'hit' : 'miss');
    if (a.state.done) { const clean = a.report().clean; endStitch(); finish(clean); }
  };
  const key = (e) => actKey(e, _loom.els?.hit, stitch);
  globalThis.document?.addEventListener?.('keydown', key, true);
  Promise.resolve().then(() => { if (live) next(); });
  _loom.off = () => { live = false; caf(id); globalThis.document?.removeEventListener?.('keydown', key, true); };
  return stitch;
}

/**
 * PROF7: THE LOOM - the tanning rack's cures (a hide to its leather, a Tanner's 1:1) and the weave (Spider Silk to a Silk
 * Bolt), then Outfitting's recipes by family (a garment by its cloth and its clothing, the men's or the women's), each
 * with its inputs as the Stores hold them, the rank it asks and the odds; the Weavers' Linen and Wool where the Stores
 * are short (a Clothing Store's alone); a garment's dye; Craft (the stitch) and Quick craft. Only at a loom: a Clothing
 * Store's, its fee a craft, a cure or a weave, or the player's own home's.
 * @param {HTMLElement} detail @param {() => void} rerender @param {{ el: Function, divider: (w: string) => HTMLElement }} kit
 */
function drawLoom(detail, rerender, { el, divider }) {
  const p = _provider;
  if (!p?.loom || !p.craft || !p.smelt) return;
  const book = p.book;
  const loom = p.loom();
  detail.append(divider(t('prof.page.loom', 'The Loom')));
  if (!loom) {
    endStitch();
    detail.append(el('p', 'px-note', t('prof.page.loom.away', 'Outfitting, and the tanning of hides, is done at a loom: a Clothing Store\'s ({fee} gold a craft, a cure or a weave), or your own home\'s.', { fee: LOOM_FEE })));
    return;
  }
  const rank = book.track('outfitting')?.rank ?? 0;
  const specs = book.track('outfitting')?.specs ?? {};
  detail.append(el('p', 'px-note', `${loom.kind === 'shop' ? t('prof.page.loom.shop', 'The tailor\'s loom and tanning rack - {fee} gold a craft, a cure or a weave.', { fee: loom.fee }) : t('prof.page.loom.home', 'Your loom.')} ${rankLine('outfitting', rank)}`));
  const short = purseShort(loom, 'loom');
  if (short) detail.append(el('p', 'px-note prof-short', short));
  // AUDIT 30 A2's law: Gentle acts switched on under a stitch sets the needle down - nothing spent, the craft a plain one
  if (_loom.act && getPref('gentleActs') === true) { _loom.act.cancel(); endStitch(); _loom.word = needleDownLine(); }
  const sewing = !!_loom.act;
  // THE TANNING RACK AND THE LOOM'S OWN WORK: the hides the Stores hold, cured; Spider Silk, woven
  const cures = CURE_RECIPES.filter((r) => workOf(book, r.inputs[0].key) > 0);
  if (cures.length) workRows(detail, rerender, el, cures, _loom, t('prof.page.loom.cure', 'Cure'), t('prof.page.loom.curing', 'Curing...'), (id, n) => p.smelt(id, n), short, sewing);   // AUDIT 32 P5: held while sewing
  else detail.append(el('p', 'px-note', t('prof.page.loom.noHides', 'Two hides cure into one leather here (one hide for a Tanner). Hides come from skinning bodies you kill (Hunting).')));
  const weaves = WEAVE_RECIPES.filter((r) => workOf(book, r.inputs[0].key) > 0);
  if (weaves.length) workRows(detail, rerender, el, weaves, _loom, t('prof.page.loom.weave', 'Weave'), t('prof.page.loom.weaving', 'Weaving...'), (id, n) => p.smelt(id, n), short, sewing);
  // CLOTH-GEMS: furs spun to Wool (SPIN_RECIPES) - and, where the Stores and the pack hold no goods for either, where the
  // loom's Linen and Wool come from
  const spins = SPIN_RECIPES.filter((r) => workOf(book, r.inputs[0].key) > 0);
  if (spins.length) workRows(detail, rerender, el, spins, _loom, t('prof.page.loom.spin', 'Spin'), t('prof.page.loom.spinning', 'Spinning...'), (id, n) => p.smelt(id, n), short, sewing);
  if (!spins.length && !weaves.some((r) => r.out === LINEN.key)) detail.append(el('p', 'px-note', t('prof.page.loom.noCloth', 'Two Root Tendrils weave into a Linen Bolt here, and two furs - a Rat, Wolf or Tiger Pelt, a Boar or Bear Hide - spin into a Wool Bolt. Root Tendrils grow in the mountain woods, the haunted woods and the swamps.')));
  const held = (k) => workOf(book, k);
  const fams = el('div', 'prof-families');
  for (const [id, word] of LOOM_FAMILIES) {
    const b = el('button', `prof-family${_loom.family === id ? ' on' : ''}`, word);
    b.type = 'button';
    b.disabled = sewing;
    b.onclick = () => { _loom.family = id; _loom.picked = null; _loom.pattern = null; rerender(); };
    fams.append(b);
  }
  detail.append(fams);
  const clothing = _loom.clothing ?? p.clothing?.() ?? 'MensClothing';
  if (_loom.family === 'clothing') {
    const row = el('div', 'prof-families prof-metals');
    for (const [id, word] of CLOTHING_ROW) {
      const b = el('button', `prof-family${clothing === id ? ' on' : ''}`, word);
      b.type = 'button';
      b.disabled = sewing;
      b.onclick = () => { _loom.clothing = id; _loom.picked = null; _loom.pattern = null; rerender(); };
      row.append(b);
    }
    detail.append(row);
  }
  // CRAFT2: the family's patterns (a garment of the clothing shown), every cloth or leather under its piece - chosen from
  // what is held
  const list = loomRecipes(_loom.family, null, clothing);
  const stand = standings((x) => {
    const open = recipeOpen(x, rank), can = open && craftable(x, held);
    return { open, can, raw: open && !can && fromRaw(x.inputs, book), share: heldShare(x.inputs, held) };   // CRAFT1: made from raw
  });
  patternRows(detail, el, list, _loom, rerender, { stand, word: (x, s) => (s.open ? makeWord(s.can, s.raw) : rankWord(x.rank)), locked: sewing });
  const r = pickedIn(list, _loom);
  if (r) {
    const box = el('div', 'prof-craft');
    box.append(el('b', null, craftHead(r.name, r.rank)));
    materialRow(box, el, list, r, _loom, rerender, stand, sewing);   // CRAFT2: its cloths, its leathers, its pelts
    // AUDIT 32 P8: Standard-bearer's Silk says where it comes from - a siege's Spoils (PROF0 4.7), the one door to its 76
    // garments; AUDIT-SEATS: the sieges yield it now (townSeatLaw.js SIEGE_SPOILS), so no longer "nothing yields it yet"
    if (r.cloth === STANDARD_SILK.key) box.append(el('p', 'px-note', t('prof.page.loom.silk', '{name} comes only from the sieges, as a Siege Honor\'s Spoils.', { name: p.name(r.cloth) })));
    for (const inp of r.inputs) {
      const have = held(inp.key);
      const line = el('div', `prof-input${have >= inp.n ? '' : ' prof-short'}`);
      line.append(el('span', null, inputLine(p.name(inp.key), have, inp.n)));
      const sale = WEAVERS_STOCK.find((x) => x.key === inp.key);   // the Weavers' Linen and Wool (4.5), at the tailor's
      // AUDIT 32 P6: the Marks the purchase asks, held or said before the press (the Market tab's counter's law, AUDIT 30
      // U12/U13) - it was offered whatever the balance, and refused after; COUNTER-GATES: the one counter's buy now
      if (sale && have < inp.n && loom.kind === 'shop') counterBuy(line, { el, p, state: _loom, rerender, key: inp.key, need: inp.n - have, sale, who: 'weavers', counter: 'weavers' });
      box.append(line);
    }
    const chain = chainNote(box, el, p, book, r.inputs);   // CRAFT1: the works it runs first
    _loom.chained = chain?.ok === true;   // AUDIT CRAFT1 F1: a craft pressed now runs its chain - the work rows held under it
    if (r.family === 'furnishings') box.append(el('p', 'px-note', t('prof.page.loom.furnishings', 'Furnishings go to your things. Place them in a room of your own with Decorate.')));
    // A GARMENT'S DYE (9.3: "itemDye.js's colours"): one of DFU's ten, chosen here and sewn in, or none (AUDIT 32 L3:
    // every garment takes one, DFU's "unchangeable" shirts too - the word is their variant's)
    if (r.kind === 'garment' && r.dyes === true) {
      const dyes = el('div', 'prof-families prof-metals');
      const none = el('button', `prof-family${_loom.dye == null ? ' on' : ''}`, t('prof.page.loom.undyed', 'Undyed'));
      none.type = 'button';
      none.disabled = sewing;
      none.onclick = () => { _loom.dye = null; rerender(); };
      dyes.append(none);
      for (const d of GARMENT_DYES) {
        const b = el('button', `prof-family${_loom.dye === d ? ' on' : ''}`, dyeWord(d));
        b.type = 'button';
        b.disabled = sewing;
        b.onclick = () => { _loom.dye = d; rerender(); };
        dyes.append(b);
      }
      box.append(dyes);
    }
    if (takesQuality(r) && recipeOpen(r, rank)) {
      const odds = qualityOdds(rank - r.rank, { masterwright: false });
      const a = { odds: oddsText(odds), rank, need: r.rank };
      box.append(el('p', 'px-note', specs[50] === 'tailor' && r.family === 'clothing' ? t('prof.page.loom.oddsTailor', 'Quality chances: {odds}. They get better the further your rank ({rank}) is above the recipe\'s ({need}). Press every stitch on the beat to raise the result one quality. Being a Tailor raises clothing one more.', a)
        : specs[50] === 'leatherworker' && r.family === 'leather' ? t('prof.page.loom.oddsLeather', 'Quality chances: {odds}. They get better the further your rank ({rank}) is above the recipe\'s ({need}). Press every stitch on the beat to raise the result one quality. Being a Leatherworker raises leather one more.', a)
          : t('prof.page.loom.odds', 'Quality chances: {odds}. They get better the further your rank ({rank}) is above the recipe\'s ({need}). Press every stitch on the beat to raise the result one quality.', a)));
    }
    // CRAFT-FIRST-SHOWN: its XP and its first's - CLOTH-GEMS: wholly of cloth, its first the made cloth's alone (AUDIT 32
    // S1, judged by the units: ownSpend)
    if (recipeOpen(r, rank)) box.append(el('p', 'px-note', craftXpLine(r, rank, professionName('outfitting'), craftPayOf(book, 'outfitting'), ownSpend(book, r))));   // CRAFT-LIMIT-SAID
    const gentle = getPref('gentleActs') === true;
    const dye = r.kind === 'garment' && r.dyes === true ? _loom.dye : null;
    const elsewhere = handsAt(_loom);   // AUDIT 32 P2
    if (elsewhere && !_loom.act) box.append(el('p', 'px-note', handsLine(elsewhere)));
    const ready = recipeOpen(r, rank) && (craftable(r, held) || chain?.ok === true) && !_loom.busy && !_loom.crafting && !_loom.act && !elsewhere && !short;
    // AUDIT 30 A3's law: the stitch makes the recipe it began on, in the dye it began in; AUDIT 32 P5: a craft's own flag
    // in flight - a cure answered under it cleared the loom's one flag, and Craft was offered again mid-craft
    const craftOf = (id, d) => async (clean) => {
      _loom.crafting = true; rerender();
      const res = await p.craft(id, { clean: clean && getPref('gentleActs') !== true, dye: d });
      _loom.crafting = false; _loom.word = res?.text ?? null; rerender();
    };
    const finish = craftOf(r.id, dye);
    if (_loom.act) {
      // THE STITCH: the needle's beat along its bar, the band a stitch lands on, the stitches so far
      const panel = el('div', 'prof-heat');
      const bar = el('div', 'prof-heatbar');
      const w = _loom.act.state.w;
      for (const [left, width] of [[0, w / 2], [1 - w / 2, w / 2]]) {
        const band = el('div', 'prof-heatband');
        band.style.left = `${(left * 100).toFixed(1)}%`;
        band.style.width = `${(width * 100).toFixed(1)}%`;
        bar.append(band);
      }
      const marker = el('div', 'prof-heatmark');
      bar.append(marker);
      const marks = el('div', 'prof-strikes');
      const dots = [];
      for (let i = 0; i < STITCH_ACT.stitches; i++) { const d = el('span', `prof-strike${i < _loom.act.state.stitches.length ? (_loom.act.state.stitches[i] ? ' hit' : ' miss') : ''}`, 'o'); dots.push(d); marks.append(d); }
      const hit = actButton(el, t('prof.page.loom.stitch', 'Stitch'), (e) => _loom.stitch?.(e));   // AUDIT 32 P1
      const cancel = el('button', 'act', t('prof.page.loom.setDown', 'Set the needle down'));
      cancel.type = 'button';
      cancel.onclick = () => { _loom.act?.cancel(); endStitch(); _loom.word = needleDownLine(); rerender(); };
      panel.append(el('span', 'prof-heatword', t('prof.page.loom.how', 'The stitch: press on the beat, {n} in a row (Space)', { n: STITCH_ACT.stitches })), bar, marks, hit, cancel);
      box.append(panel);
      _loom.els = { bar, marker, marks: dots, hit };
      if (!_loom.off) _loom.stitch = stitchLoop(craftOf(_loom.actRecipe ?? r.id, _loom.actRecipe ? _loom.actDye : dye));
    } else {
      const go = el('button', 'act primary', _loom.crafting ? t('prof.page.loom.crafting', 'At the loom...') : craftWord());
      go.type = 'button';
      go.disabled = !ready;
      go.onclick = () => {
        if (gentle) { void finish(false); return; }   // Gentle acts: a plain craft, no stitch
        _loom.act = createStitchAct({ band: p.stitchBand?.() ?? 1 });
        _loom.actRecipe = r.id; _loom.actDye = dye;
        rerender();
      };
      const quick = el('button', 'act', quickWord());
      quick.type = 'button';
      quick.disabled = !ready;
      quick.onclick = () => { void finish(false); };
      box.append(go, quick);
    }
    detail.append(box);
  }
  if (_loom.word) detail.append(el('p', 'prof-word', _loom.word));
}

// ─── PROF11: THE MASON'S BENCH (bible/06-Systems/Professions-Arc.md 4.5, 9.3, 9.4) ─────

/** What setting the chisel down says. */
export const CHISEL_DOWN_LINE = 'You set the chisel down; nothing is spent.';
const chiselDownLine = () => t('prof.page.mason.down', CHISEL_DOWN_LINE);
/** Tests: the bench's state - its chisel ticked by hand, as a frame would. */
export const _masonForTests = () => _mason;
/** The chisel let go: its loop, its keys and what it was making. */
function endChisel() {
  _mason.off?.();
  _mason.off = null;
  _mason.strike = null;
  _mason.act = null;
  _mason.els = null;
  _mason.actWhat = null;
}
/** The chisel's stone redrawn from the act: the marked line lit, the line the chisel is set on shown. */
function paintChisel() {
  const a = _mason.act, els = _mason.els;
  if (!a || !els?.lines) return;
  els.lines.forEach((b, i) => { b.classList.toggle('marked', i === a.mark); b.classList.toggle('at', i === a.state.at); });
  els.stone?.classList.toggle('prof-inband', a.onMark);
}
/**
 * THE CHISEL'S KEYS (AUDIT 32 P1/P2/P4's law, the act's own and no other's): the arrows move the chisel a line; a digit
 * (1 to CHISEL_ACT.lines) sets it on that line and strikes; Space and Enter strike where it is set (actKey). A field's
 * keys stay the field's; a held key's repeats strike nothing.
 */
function chiselKey(e, strike) {
  if (isTextEntryTarget(e.target)) return;
  const d = e.code === 'ArrowUp' || e.code === 'ArrowLeft' ? -1 : e.code === 'ArrowDown' || e.code === 'ArrowRight' ? 1 : 0;
  const digit = /^(?:Digit|Numpad)([1-9])$/.exec(e.code ?? '');
  const line = digit ? Number(digit[1]) - 1 : -1;
  if (!d && !(line >= 0 && line < CHISEL_ACT.lines)) { actKey(e, _mason.els?.hit, strike); return; }
  e.preventDefault?.(); e.stopImmediatePropagation?.(); e.stopPropagation?.();
  if (e.repeat) return;
  if (d) { _mason.act?.move(d); paintChisel(); return; }
  _mason.act?.aim(line);
  strike(e);
}
/** The chisel's frame: the mark ticked and the stone drawn, the act ended when the page is gone; the work asked on the
 *  last strike (the stitch's loop, a stone for a beat). */
function chiselLoop(finish) {
  const raf = globalThis.requestAnimationFrame?.bind(globalThis) ?? ((fn) => setTimeout(() => fn(Date.now()), 16));
  const caf = globalThis.cancelAnimationFrame?.bind(globalThis) ?? clearTimeout;
  let last = null, id = 0, live = true, inStep = false;
  const clock = () => globalThis.performance?.now?.() ?? Date.now();
  const next = () => { id = raf(() => { if (inStep) setTimeout(step, 16); else step(); }); };
  const step = () => {
    if (!live || !_mason.act) return;
    inStep = true;
    try {
      const els = _mason.els;
      if (!els?.stone || els.stone.isConnected === false) { _mason.act.cancel(); endChisel(); return; }   // the page shut under the act: nothing spent
      const t = clock();
      const dt = last == null ? 0 : Math.min(0.1, (t - last) / 1000);
      last = t;
      _mason.act.tick(dt);
      paintChisel();
      next();
    } finally { inStep = false; }
  };
  const strike = (e) => {
    const a = _mason.act;
    if (!a) return;
    const hit = a.strike(pressLead(e, last));   // AUDIT 32 P1: at the press's own moment
    if (hit == null) return;
    _mason.els?.marks?.[a.state.strikes.length - 1]?.classList.add(hit ? 'hit' : 'miss');
    if (a.state.done) { const clean = a.report().clean; endChisel(); finish(clean); } else paintChisel();
  };
  const key = (e) => chiselKey(e, strike);
  globalThis.document?.addEventListener?.('keydown', key, true);
  Promise.resolve().then(() => { if (live) next(); });
  _mason.off = () => { live = false; caf(id); globalThis.document?.removeEventListener?.('keydown', key, true); };
  return strike;
}
/** The verb a mason's work is done with on its button: the cut's "Cut", the mix's "Mix". */
export const masonVerb = (id) => (id === 'cut:stone' ? t('prof.page.mason.cut', 'Cut') : t('prof.page.mason.mix', 'Mix'));

/**
 * PROF11: THE MASON'S BENCH - the works (Rough Stone cut to Cut Stone, a Quarryman's two a cut; Mortar mixed ten at a
 * time), each its inputs as the Stores hold them, the rank it asks, a count, and the chisel (or Quick); then the
 * Sculptor's stone decor - the column, the bench, the font, the plinth - each its stone, the odds, Craft (the chisel)
 * and Quick craft. THE CHISEL (9.4): the stone's lines, the marked one lit and moving by the glint's rule; a press on a
 * line strikes it (the arrows and a digit set the chisel, Space and Enter strike), every strike true a clean act - a
 * carving's quality step, a work's half again of its XP. Only at a mason's bench: a General Store's, its fee a cut, a mix
 * or a carving, or the player's own home's.
 * @param {HTMLElement} detail @param {() => void} rerender @param {{ el: Function, divider: (w: string) => HTMLElement }} kit
 */
function drawMasonBench(detail, rerender, { el, divider }) {
  const p = _provider;
  if (!p?.mason || !p.smelt) return;
  const book = p.book;
  const bench = p.mason();
  detail.append(divider(t('prof.page.mason', 'The Mason\'s Bench')));
  if (!bench) {
    endChisel();
    detail.append(el('p', 'px-note', t('prof.page.mason.away', 'Masonry is done at a mason\'s bench: a General Store\'s ({fee} gold a cut, a mix or a carving), or your own home\'s.', { fee: MASON_FEE })));
    return;
  }
  const track = book.track('masonry');
  const rank = track?.rank ?? 0;
  const specs = track?.specs ?? {};
  detail.append(el('p', 'px-note', `${bench.kind === 'shop' ? t('prof.page.mason.shop', 'The mason\'s bench - {fee} gold a cut, a mix or a carving.', { fee: bench.fee }) : t('prof.page.mason.home', 'Your mason\'s bench.')} ${rankLine('masonry', rank)}`));
  const short = purseShort(bench, 'mason');
  if (short) detail.append(el('p', 'px-note prof-short', short));
  // AUDIT 30 A2's law: Gentle acts switched on under the chisel sets it down - nothing spent, the work a plain one
  if (_mason.act && getPref('gentleActs') === true) { _mason.act.cancel(); endChisel(); _mason.word = chiselDownLine(); }
  const striking = !!_mason.act;
  const gentle = getPref('gentleActs') === true;
  const elsewhere = handsAt(_mason);   // AUDIT 32 P2: one act a page
  const held = (k) => workOf(book, k);
  // WHAT THE CHISEL'S END ASKS (AUDIT 30 A3's law: the work it began on): a work its count, by the forge's route; a
  // carving its craft
  const finishFor = (what) => async (clean) => {
    const c = clean === true && getPref('gentleActs') !== true;
    if (what.kind === 'work') {
      _mason.busy = true; _workingOn = what.id; rerender();
      const res = await p.smelt(what.id, what.count, { clean: c });
      _mason.busy = false; _workingOn = null; _mason.word = res?.text ?? null; rerender();
      return;
    }
    _mason.crafting = true; rerender();
    const res = p.craft ? await p.craft(what.id, { clean: c }) : null;
    _mason.crafting = false; _mason.word = res?.text ?? null; rerender();
  };
  /** @returns {any} a work's (MASON_RECIPES) or a carving's (MASONRY_RECIPES) recipe */
  const recipeOfWhat = (what) => (what.kind === 'work' ? MASON_RECIPES : MASONRY_RECIPES).find((x) => x.id === what.id) ?? null;
  const begin = (what) => {
    if (gentle) { void finishFor(what)(false); return; }   // Gentle acts: a plain work, no chisel
    _mason.act = createChiselAct({ strikes: chiselStrikes(recipeOfWhat(what)), markS: chiselMarkS(rank, p.chiselBand?.() ?? 1) });
    _mason.actWhat = what;
    rerender();
  };
  // THE CHISEL under way: the stone's lines, the marked one lit, the strikes so far
  if (_mason.act && _mason.actWhat) {
    const what = _mason.actWhat;
    const r = recipeOfWhat(what);
    const label = what.kind === 'work' ? t('prof.page.chisel.work', '{name}, {n, plural, one {# time} other {# times}}', { name: p.name(r?.out ?? ''), n: what.count }) : (r?.name ?? '');
    const panel = el('div', 'prof-heat prof-chisel');
    panel.append(el('span', 'prof-heatword', t('prof.page.chisel.how', 'The chisel ({what}): strike the marked line {n, plural, one {once} other {# times}}. Press the line, or set the chisel with the arrows and strike with Space', { what: label, n: _mason.act.state.need })));
    const stone = el('div', 'prof-stone');
    const lines = [];
    for (let i = 0; i < CHISEL_ACT.lines; i++) {
      const b = el('button', `prof-chisel-line${i === _mason.act.mark ? ' marked' : ''}${i === _mason.act.state.at ? ' at' : ''}`, String(i + 1));
      b.type = 'button';
      b.setAttribute?.('aria-label', t('prof.page.chisel.line', 'Strike line {n}', { n: i + 1 }));
      // AUDIT 32 P1's law: struck on the pointer's DOWN, its own moment; a click nobody pointed at (a screen reader's) once
      let pointed = false;
      b.onpointerdown = (e) => { e?.preventDefault?.(); pointed = true; _mason.act?.aim(i); _mason.strike?.(e); };
      b.onclick = (e) => { if (pointed) { pointed = false; return; } _mason.act?.aim(i); _mason.strike?.(e); };
      lines.push(b);
      stone.append(b);
    }
    const marks = el('div', 'prof-strikes');
    const dots = [];
    for (let i = 0; i < _mason.act.state.need; i++) { const d = el('span', `prof-strike${i < _mason.act.state.strikes.length ? (_mason.act.state.strikes[i] ? ' hit' : ' miss') : ''}`, 'o'); dots.push(d); marks.append(d); }
    const hit = actButton(el, strikeWord(), (e) => _mason.strike?.(e));
    const cancel = el('button', 'act', t('prof.page.chisel.setDown', 'Set the chisel down'));
    cancel.type = 'button';
    cancel.onclick = () => { _mason.act?.cancel(); endChisel(); _mason.word = chiselDownLine(); rerender(); };
    panel.append(stone, marks, hit, cancel);
    detail.append(panel);
    _mason.els = { stone, lines, marks: dots, hit };
    if (!_mason.off) _mason.strike = chiselLoop(finishFor(what));
  }
  // THE WORKS: the cut and the mix, each the rank it asks
  for (const r of MASON_RECIPES) {
    const open = workOpen(r, rank);
    const most = open ? smeltable(r, held) : 0;
    // the Quarryman's two a cut - a choice read at its own rank (50), as the Tanner's
    const per = workPer(r, r.more ? { [r.more.profession]: book.track(r.more.profession)?.specs?.[workSpecRank(r)] ?? null } : {});
    const row = el('div', `prof-smelt prof-mason${most ? '' : ' prof-locked'}`);
    const ins = workIns(r, p, held);
    row.append(el('b', null, workOut(p.name(r.out), per)), el('span', 'prof-split', open ? ins : t('prof.page.work.insRank', '{inputs} - rank {rank}', { inputs: ins, rank: r.rank })));
    const qty = el('input', 'prof-qty');
    qty.type = 'number'; qty.min = '1'; qty.max = String(Math.max(1, most));
    qty.value = String(Math.max(1, Math.min(_mason.counts[r.id] ?? 1, Math.max(1, most))));
    qty.oninput = () => { _mason.counts[r.id] = Math.max(1, Math.min(SMELT_MAX, Math.floor(Number(qty.value) || 1))); };
    const count = () => Math.max(1, Math.min(_mason.counts[r.id] ?? 1, smeltable(r, held)));
    const shut = _mason.busy || _mason.crafting || striking || most < 1 || !!short || !!elsewhere;
    const acts = el('span', 'prof-workacts');
    const go = el('button', 'act', _mason.busy && _workingOn === r.id ? benchBusyWord() : masonVerb(r.id));
    go.type = 'button';
    go.disabled = shut;
    go.onclick = () => { if (!go.disabled) begin({ kind: 'work', id: r.id, count: count() }); };
    const quick = el('button', 'act', t('prof.page.mason.quick', 'Quick'));
    quick.type = 'button';
    quick.disabled = shut;
    quick.onclick = () => { if (!quick.disabled) void finishFor({ kind: 'work', id: r.id, count: count() })(false); };
    acts.append(go, quick);
    row.append(qty, acts);
    detail.append(row);
  }
  detail.append(el('p', 'px-note', held('stone:rough') > 0
    ? t('prof.page.mason.works', 'Two Rough Stone are cut into one Cut Stone (two for a Quarryman). Sulphur, Lead and five Rough Stone mix into ten Mortar. Hit the marked line with every strike for half again as much Building experience.')
    : t('prof.page.mason.noStone', 'Rough Stone is quarried from the boulders of the rock fields with a Pick-Axe (Mining).')));
  detail.append(el('p', 'px-note', masonWorksFirstLine(rank, professionName('masonry'), craftPayOf(book, 'masonry'))));   // CRAFT-FIRST-SHOWN: a work's first, the service's (smeltAtForge); CRAFT-LIMIT-SAID
  if (elsewhere && !_mason.act) detail.append(el('p', 'px-note', handsLine(elsewhere)));
  // THE SCULPTOR'S STONE DECOR (3.3, 9.3): a column, a bench, a font, a statue plinth
  detail.append(el('p', 'px-note', specs[100] === SCULPTOR ? t('prof.page.mason.decor', 'Stone decor, carved for a room of your own:')
    : t('prof.page.mason.decorSculptor', 'Stone decor, such as columns, benches, fonts and statue plinths, is carved by a Sculptor (a Masonry choice at 100).')));
  for (const r of MASONRY_RECIPES) {
    const open = recipeOpen(r, rank, specs);
    const can = open && craftable(r, held);
    const raw = open && !can && fromRaw(r.inputs, book);   // CRAFT1
    const row = el('button', `prof-recipe${_mason.picked === r.id ? ' on' : ''}${can || raw ? '' : ' prof-locked'}`);
    row.type = 'button';
    row.disabled = striking;
    row.append(el('b', null, r.name), el('span', 'prof-split', open ? makeWord(can, raw) : t('prof.page.mason.sculptors', 'a Sculptor\'s')));
    row.onclick = () => { _mason.picked = r.id; rerender(); };
    detail.append(row);
  }
  const r = MASONRY_RECIPES.find((x) => x.id === _mason.picked);
  if (r && p.craft) {
    const box = el('div', 'prof-craft');
    box.append(el('b', null, t('prof.page.mason.carvingHead', '{name} - a Sculptor\'s', { name: r.name })));
    for (const inp of r.inputs) {
      const have = held(inp.key);
      const line = el('div', `prof-input${have >= inp.n ? '' : ' prof-short'}`);
      line.append(el('span', null, inputLine(p.name(inp.key), have, inp.n)));
      box.append(line);
    }
    const chain = chainNote(box, el, p, book, r.inputs);   // CRAFT1: the works it runs first
    _mason.chained = chain?.ok === true;   // AUDIT CRAFT1 F1: a craft pressed now runs its chain - the work rows held under it
    box.append(el('p', 'px-note', t('prof.page.mason.decorGoes', 'Stone decor goes to your things. Place it in a room of your own with Decorate.')));
    const open = recipeOpen(r, rank, specs);
    if (open) {
      const odds = qualityOdds(rank - r.rank, { masterwright: false });
      box.append(el('p', 'px-note', t('prof.page.mason.odds', 'Quality chances: {odds}. They get better the further your rank ({rank}) is above the recipe\'s ({need}). Hit the marked line with every strike to raise the result one quality.', { odds: oddsText(odds), rank, need: r.rank })));
      box.append(el('p', 'px-note', craftXpLine(r, rank, professionName('masonry'), craftPayOf(book, 'masonry'))));   // CRAFT-FIRST-SHOWN; CRAFT-LIMIT-SAID
    }
    const ready = open && (craftable(r, held) || chain?.ok === true) && !_mason.busy && !_mason.crafting && !_mason.act && !elsewhere && !short;
    const go = el('button', 'act primary', _mason.crafting ? benchBusyWord() : craftWord());
    go.type = 'button';
    go.disabled = !ready;
    go.onclick = () => { if (!go.disabled) begin({ kind: 'carve', id: r.id, count: 1 }); };
    const quick = el('button', 'act', quickWord());
    quick.type = 'button';
    quick.disabled = !ready;
    quick.onclick = () => { if (!quick.disabled) void finishFor({ kind: 'carve', id: r.id, count: 1 })(false); };
    box.append(go, quick);
    detail.append(box);
  }
  if (_mason.word) detail.append(el('p', 'prof-word', _mason.word));
}

// ─── PROF9: THE FIRE (bible/06-Systems/Professions-Arc.md 9.3, 9.4, 35) ─────

/** What setting the pan aside says. */
export const PAN_DOWN_LINE = 'You take the pan off the fire; nothing is spent.';
const panDownLine = () => t('prof.page.fire.down', PAN_DOWN_LINE);
/** Where Cooking is done, said away from a fire. */
export const FIRE_AWAY_LINE = 'Cook at a fire, such as a campfire, a hearth or a brazier. Stand close to its flame. Your dishes go to your pack.';
const fireAwayLine = () => t('prof.page.fire.away', FIRE_AWAY_LINE);
/** Tests: the fire's state - its pan ticked by hand, as a frame would. */
export const _cookForTests = () => _cook;
/** The pan let go: its loop, its keys and what it was cooking. */
function endPan() {
  _cook.off?.();
  _cook.off = null;
  _cook.take = null;
  _cook.act = null;
  _cook.els = null;
  _cook.actRecipe = null;
}
/** The pan's bar redrawn from the act: its heat, the window lit while the pan is done, the pans so far. */
function paintPan(reduced = false) {
  const a = _cook.act, els = _cook.els;
  if (!a || !els?.bar) return;
  els.marker.style.left = `${(Math.min(1, a.state.heat) * 100).toFixed(1)}%`;
  if (!reduced) els.bar.style.setProperty?.('--heat', a.state.heat.toFixed(3));
  els.bar.classList.toggle('prof-inband', a.inWindow);
  const n = a.state.takes.length;
  for (let i = 0; i < (els.marks?.length ?? 0); i++) {
    els.marks[i].classList.toggle('hit', i < n && a.state.takes[i] === true);
    els.marks[i].classList.toggle('miss', i < n && a.state.takes[i] === false);
  }
}
/** The pan's frame: its heat ticked and drawn, the act ended when the page is gone; the dish asked when the last pan is
 *  off - taken, or burnt on the fire (the heat's loop, a pan for a glow). */
function panLoop(finish) {
  const raf = globalThis.requestAnimationFrame?.bind(globalThis) ?? ((fn) => setTimeout(() => fn(Date.now()), 16));
  const caf = globalThis.cancelAnimationFrame?.bind(globalThis) ?? clearTimeout;
  let last = null, id = 0, live = true, inStep = false;
  const reduced = !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const clock = () => globalThis.performance?.now?.() ?? Date.now();
  const next = () => { id = raf(() => { if (inStep) setTimeout(step, 16); else step(); }); };
  const ended = () => { const clean = _cook.act?.report().clean === true; endPan(); finish(clean); };
  const step = () => {
    if (!live || !_cook.act) return;
    inStep = true;
    try {
      const els = _cook.els;
      if (!els?.bar || els.bar.isConnected === false) { _cook.act.cancel(); endPan(); return; }   // the page shut under the act: nothing spent
      const t = clock();
      const dt = last == null ? 0 : Math.min(0.1, (t - last) / 1000);
      last = t;
      _cook.act.tick(dt);
      if (_cook.act.state.done) { ended(); return; }   // the last pan burnt on the fire
      paintPan(reduced);
      next();
    } finally { inStep = false; }
  };
  const take = (e) => {
    const a = _cook.act;
    if (!a) return;
    const ok = a.take(pressLead(e, last));   // AUDIT 32 P1: at the press's own moment
    if (ok == null) return;
    if (a.state.done) ended(); else paintPan(reduced);
  };
  const key = (e) => actKey(e, _cook.els?.hit, take);
  globalThis.document?.addEventListener?.('keydown', key, true);
  Promise.resolve().then(() => { if (live) next(); });
  _cook.off = () => { live = false; caf(id); globalThis.document?.removeEventListener?.('keydown', key, true); };
  return take;
}

/**
 * PROF9: THE FIRE - Cooking's dishes (9.3), each its inputs as the Stores hold them, the rank it asks, its effect and its
 * servings (a Cook's two); Cook (the pan, 9.4) and Quick cook. THE PAN: the dish's pans in turn, each heating from raw
 * to burnt along a bar with its window on it - wider at a higher rank, with a better (INT + PER) / 2, and half again with
 * C&C's Skillet in the pack; Space, Enter or "Take it off" takes the pan off, every pan done a clean act (half again the
 * Cooking XP). At any lit fire - a campfire (anyone's), a hearth, a brazier - for no fee: a fire is nobody's. C&C's own
 * cooking (a Raw Fish over the flame) is the fire's own menu, the mod's, untouched (scenes/camps.js openCook).
 * @param {HTMLElement} detail @param {() => void} rerender @param {{ el: Function, divider: (w: string) => HTMLElement }} kit
 */
function drawCookFire(detail, rerender, { el, divider }) {
  const p = _provider;
  if (!p?.fire || !p.craft) return;
  const book = p.book;
  const fire = p.fire();
  detail.append(stationHead(divider, t('prof.page.fire', 'The Fire'), 'fire'));   // AUDIT DECOR-USE D2: a cooking station's press lands here
  if (!fire) {
    endPan();
    detail.append(el('p', 'px-note', fireAwayLine()));
    return;
  }
  const track = book.track('cooking');
  const rank = track?.rank ?? 0;
  const specs = track?.specs ?? {};
  const skillet = p.skillet?.() === true;
  detail.append(el('p', 'px-note', `${t('prof.page.fire.here', 'A fire to cook at.')} ${rankLine('cooking', rank)} ${skillet ? t('prof.page.fire.skillet', 'Your Skillet widens the pan\'s window.') : t('prof.page.fire.noSkillet', 'A Skillet in your pack would widen the pan\'s window.')}`));
  // AUDIT 30 A2's law: Gentle acts switched on under the pan takes it off - nothing spent, the dish a plain one
  if (_cook.act && getPref('gentleActs') === true) { _cook.act.cancel(); endPan(); _cook.word = panDownLine(); }
  const gentle = getPref('gentleActs') === true;
  const elsewhere = handsAt(_cook);   // AUDIT 32 P2: one act a page
  const held = (k) => workOf(book, k);
  // WHAT THE PAN'S END ASKS (AUDIT 30 A3's law: the dish it began on)
  const finishFor = (id) => async (clean) => {
    _cook.crafting = true; rerender();
    const res = await p.craft(id, { clean: clean === true && getPref('gentleActs') !== true });
    _cook.crafting = false; _cook.word = res?.text ?? null; rerender();
  };
  if (_cook.act && _cook.actRecipe) {
    const panel = el('div', 'prof-heat prof-pan');
    panel.append(el('span', 'prof-heatword', t('prof.page.fire.how', 'The pan ({dish}): take each pan off when it is done, inside the window (Space). {n, plural, one {# pan} other {# pans}}', { dish: dishOf(_cook.actRecipe)?.name ?? '', n: _cook.act.state.need })));
    const bar = el('div', 'prof-heatbar prof-panbar');
    const band = el('div', 'prof-heatband');
    band.style.left = `${(_cook.act.state.lo * 100).toFixed(1)}%`;
    band.style.width = `${((_cook.act.state.hi - _cook.act.state.lo) * 100).toFixed(1)}%`;
    const marker = el('div', 'prof-heatmark');
    bar.append(band, marker);
    const marks = el('div', 'prof-strikes');
    const dots = [];
    for (let i = 0; i < _cook.act.state.need; i++) {
      const t = _cook.act.state.takes[i];
      const d = el('span', `prof-strike${t === true ? ' hit' : t === false ? ' miss' : ''}`, 'o');
      dots.push(d);
      marks.append(d);
    }
    const hit = actButton(el, t('prof.page.fire.take', 'Take it off'), (e) => _cook.take?.(e));
    const cancel = el('button', 'act', t('prof.page.fire.setAside', 'Set the pan aside'));
    cancel.type = 'button';
    cancel.onclick = () => { _cook.act?.cancel(); endPan(); _cook.word = panDownLine(); rerender(); };
    panel.append(bar, marks, hit, cancel);
    detail.append(panel);
    _cook.els = { bar, marker, marks: dots, hit };
    if (!_cook.off) _cook.take = panLoop(finishFor(_cook.actRecipe));
  }
  // THE DISHES (9.3), in the fire's order - CRAFT2: each dish once, the herb's way chosen from what is held
  const stand = standings((x) => {
    const open = recipeOpen(x, rank, specs), can = open && craftable(x, held);   // the rank the dish asks, and its inputs held
    return { open, can, raw: false, share: heldShare(x.inputs, held) };
  });
  patternRows(detail, el, COOKING_RECIPES, _cook, rerender, { stand, word: (x, s) => (s.open ? (s.can ? t('prof.page.fire.canCook', 'can cook now') : t('prof.page.craft.wants', 'needs materials')) : rankWord(x.rank)), locked: !!_cook.act });
  const r = pickedIn(COOKING_RECIPES, _cook);
  if (r) {
    const box = el('div', 'prof-craft');
    box.append(el('b', null, craftHead(r.name, r.rank)));
    materialRow(box, el, COOKING_RECIPES, r, _cook, rerender, stand, !!_cook.act);   // CRAFT2: the herb's two ways
    for (const inp of r.inputs) {
      const have = held(inp.key);
      const line = el('div', `prof-input${have >= inp.n ? '' : ' prof-short'}`);
      line.append(el('span', null, inputLine(p.name(inp.key), have, inp.n)));
      box.append(line);
    }
    const hand = dishHand(r, specs[100]);
    const serves = craftCount(r, specs[100], specs[50]);
    const steps = Math.max(0, Math.trunc(Number(p.cookSteps?.()) || 0));   // AUDIT PROF-541 K7: the town Apothecary's steps where my guild holds it
    const effect = dishEffectText(dishOf(r.id), hand);
    box.append(el('p', 'px-note', hand === HAND_PROVISIONER ? t('prof.page.fire.effectKept', '{effect}. Yours never spoil.', { effect }) : t('prof.page.fire.effect', '{effect}.', { effect })));
    // CRAFT-LIMIT-SAID: the pans' XP as the service scales it (the Firmament's percent), and none said where the track can take none
    const pay = craftPayOf(book, 'cooking'), clean = paidXp(cookXp(rank, { clean: true, steps }), { pct: pay.pct });
    box.append(el('p', 'px-note', `${serves > 1 ? t('prof.page.fire.servesTwo', 'Two servings (a Cook\'s), into your pack.') : t('prof.page.fire.servesOne', 'One serving, into your pack.')} ${pay.limit.room === 0 ? t('prof.page.fire.pansOnly', '{pans, plural, one {# pan} other {# pans}}.', { pans: panCount(r) }) : t('prof.page.fire.pans',
      '{pans, plural, one {# pan} other {# pans}}. Take every pan off in time for {steps, plural, =0 {half as much again as its {xp} {profession} experience} one {{clean} {profession} experience instead of {xp}, with the town Apothecary\'s step in both} other {{clean} {profession} experience instead of {xp}, with the town Apothecary\'s # steps in both}}.',
      { pans: panCount(r), steps, xp: paidXp(steps > 0 ? cookXp(rank, { steps }) : cookXp(rank), { pct: pay.pct }), clean, profession: professionName('cooking') })}`));   // AUDIT PROF-541 K7: the XP the service pays (cookXp's steps); CRAFT3: the craft's own name
    const first = dishFirstLine(r, professionName('cooking'), pay, clean);   // CRAFT-FIRST-SHOWN: the dish's first, laid on beside the pans' XP; CRAFT-LIMIT-SAID: or the limit's line
    if (first) box.append(el('p', 'px-note', first));
    const ready = recipeOpen(r, rank, specs) && craftable(r, held) && !_cook.crafting && !_cook.act && !elsewhere;
    const go = el('button', 'act primary', _cook.crafting ? t('prof.page.fire.cooking', 'At the fire...') : t('prof.page.fire.cook', 'Cook'));
    go.type = 'button';
    go.disabled = !ready;
    go.onclick = () => {
      if (go.disabled) return;
      if (gentle) { void finishFor(r.id)(false); return; }   // Gentle acts: a plain dish, no pan
      _cook.act = createPanAct({ pans: panCount(r), done: panWindow(rank, p.panBand?.() ?? 1, skillet) });
      _cook.actRecipe = r.id;
      rerender();
    };
    const quick = el('button', 'act', t('prof.page.fire.quick', 'Quick cook'));
    quick.type = 'button';
    quick.disabled = !ready;
    quick.onclick = () => { if (!quick.disabled) void finishFor(r.id)(false); };
    box.append(go, quick);
    detail.append(box);
  }
  detail.append(el('p', 'px-note', t('prof.page.fire.sources', 'Raw Meat comes from skinning, Raw Fish from the net, the Mushroom, the Egg, the Apple and the Orange from the Basket, and herbs from their patches. All go into your Materials Bag, then your pack. A Raw Fish from your pack or bag cooked over the flame is a plain meal and gives no Cooking experience.')));   // FB1020c BAG-COOK: the bag first since BAG1, and the fire's Cook food reads it
  if (elsewhere && !_cook.act) detail.append(el('p', 'px-note', handsLine(elsewhere)));
  if (_cook.word) detail.append(el('p', 'prof-word', _cook.word));
}

// ─── PROF10: THE JEWELLER'S BENCH (bible/06-Systems/Professions-Arc.md 9.3, 9.4, 36) ─────

/** What setting the stone down says. */
export const FACET_DOWN_LINE = 'You set the stone down; nothing is spent.';
const facetDownLine = () => t('prof.page.jewel.down', FACET_DOWN_LINE);
/** Tests: the bench's state - its facet ticked by hand, as a frame would. */
export const _jewelForTests = () => _jewel;
/** The recipes the bench lists for a piece in a base (its metal, its Linen, its wood): the plain piece, then a gem each -
 *  CLOTH-GEMS (Professions-Arc 50): of one GRADE of gem (`grade`, gemGrades.js GEM_GRADES'), the plain grade DFU's eight
 *  and the Pearl with the gemless piece. */
export const jewelRecipes = (piece, base, grade = 'plain') => JEWELCRAFTING_RECIPES.filter((r) => r.product === piece && r.id.split(':')[1] === base && (gemGradeOfKey(r.gem) ?? 'plain') === grade);
/** CLOTH-GEMS: a gem grade's word on the bench's row (the plain grade's the gems DFU has; the four the port's rows'). */
export function gemGradeWord(grade) {
  switch (grade) {
    case 'chipped': return t('prof.page.jewel.grade.chipped', 'Chipped');
    case 'flawed': return t('prof.page.jewel.grade.flawed', 'Flawed');
    case 'flawless': return t('prof.page.jewel.grade.flawless', 'Flawless');
    case 'perfect': return t('prof.page.jewel.grade.perfect', 'Perfect');
    default: return t('prof.page.jewel.grade.plain', 'Plain gems');
  }
}
/** What the bench says a piece's points are: "1,980 enchantment points (+10%)", its DFU template's and the share added. */
export function jewelPointsLine(r, hand = null) {
  const pct = jewelPointsPct(r, hand);
  const pts = jewelPoints(r, templateByIndex(r.templateIndex)?.enchantmentPoints ?? 0, hand);
  return pct ? t('prof.page.jewel.pointsPct', '{pts, number} enchantment points (+{pct}%)', { pts, pct }) : t('prof.page.jewel.points', '{pts, number} enchantment points', { pts });
}
/** The facet let go: its loop, its keys and what it was cutting. */
function endFacet() {
  _jewel.off?.();
  _jewel.off = null;
  _jewel.stop = null;
  _jewel.act = null;
  _jewel.els = null;
  _jewel.actRecipe = null; _jewel.actWood = false; _jewel.actCracked = false;
}
/** The facet's dial redrawn from the act: the stone's bearing along the turn, the window lit while it stands in the light,
 *  the facets so far. */
function paintFacet(reduced = false) {
  const a = _jewel.act, els = _jewel.els;
  if (!a || !els?.bar) return;
  els.marker.style.left = `${((a.bearing / 360) * 100).toFixed(1)}%`;
  if (!reduced) els.gem?.style?.setProperty?.('transform', `rotate(${a.bearing.toFixed(1)}deg)`);
  els.band.style.left = `${(((a.state.light - a.state.half) / 360) * 100).toFixed(1)}%`;
  els.bar.classList.toggle('prof-inband', a.inWindow);
  const n = a.state.cuts.length;
  for (let i = 0; i < (els.marks?.length ?? 0); i++) {
    els.marks[i].classList.toggle('hit', i < n && a.state.cuts[i] === true);
    els.marks[i].classList.toggle('miss', i < n && a.state.cuts[i] === false);
  }
}
/** The facet's frame: the stone turned and drawn, the act ended when the page is gone; the piece asked when the last
 *  facet ends - stopped, or let go round (the pan's loop, a stone for a pan). */
function facetLoop(finish) {
  const raf = globalThis.requestAnimationFrame?.bind(globalThis) ?? ((fn) => setTimeout(() => fn(Date.now()), 16));
  const caf = globalThis.cancelAnimationFrame?.bind(globalThis) ?? clearTimeout;
  let last = null, id = 0, live = true, inStep = false;
  const reduced = !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const clock = () => globalThis.performance?.now?.() ?? Date.now();
  const next = () => { id = raf(() => { if (inStep) setTimeout(step, 16); else step(); }); };
  const ended = () => { const clean = _jewel.act?.report().clean === true; endFacet(); finish(clean); };
  const step = () => {
    if (!live || !_jewel.act) return;
    inStep = true;
    try {
      const els = _jewel.els;
      if (!els?.bar || els.bar.isConnected === false) { _jewel.act.cancel(); endFacet(); return; }   // the page shut under the act: nothing spent
      const t = clock();
      const dt = last == null ? 0 : Math.min(0.1, (t - last) / 1000);
      last = t;
      _jewel.act.tick(dt);
      if (_jewel.act.state.done) { ended(); return; }   // the last facet let go round
      paintFacet(reduced);
      next();
    } finally { inStep = false; }
  };
  const stop = (e) => {
    const a = _jewel.act;
    if (!a) return;
    const ok = a.stop(pressLead(e, last));   // AUDIT 32 P1: at the press's own moment
    if (ok == null) return;
    if (a.state.done) ended(); else paintFacet(reduced);
  };
  const key = (e) => actKey(e, _jewel.els?.hit, stop);
  globalThis.document?.addEventListener?.('keydown', key, true);
  Promise.resolve().then(() => { if (live) next(); });
  _jewel.off = () => { live = false; caf(id); globalThis.document?.removeEventListener?.('keydown', key, true); };
  return stop;
}

/**
 * PROF10: THE JEWELLER'S BENCH - Jewelcrafting's pieces (9.3) by piece (DFU's eight) and base (Silver, Gold or Platinum;
 * the Cloth Amulet's Linen; the Wand's Ironwood or Ghostwood), each recipe a gem (the Ring's plain one first), its inputs as
 * the Stores hold them, the rank it asks, the odds (a Master Jeweller's Masterwork points), the piece's enchantment points
 * (the metal's, the gem's and the jeweller's hand - a Goldsmith's Silver, a Gemcutter's gem); a Heartwood for a Wand's
 * plank; a Lapidary's Siege-cracked Gem for the gem; Craft (the facet, 9.4) and Quick craft. THE FACET: the stone turns
 * slowly along the dial toward the light, its window drawn about it - wider at a higher rank and a better (WIL + LUC) / 2;
 * Space, Enter or "Stop the turn" stops it, every facet caught a clean act (a quality step). Only at a jeweller's bench: a
 * Pawn Shop's or a Gem Store's, its fee a piece, or the player's own home's.
 * @param {HTMLElement} detail @param {() => void} rerender @param {{ el: Function, divider: (w: string) => HTMLElement }} kit
 */
function drawJewellerBench(detail, rerender, { el, divider }) {
  const p = _provider;
  if (!p?.jeweller || !p.craft) return;
  const book = p.book;
  const bench = p.jeweller();
  detail.append(divider(t('prof.page.jewel', 'The Jeweler\'s Bench')));
  if (!bench) {
    endFacet();
    detail.append(el('p', 'px-note', t('prof.page.jewel.away', 'Jewelcrafting is done at a jeweler\'s bench: a Pawn Shop\'s or a Gem Store\'s ({fee} gold a piece), or your own home\'s.', { fee: JEWEL_FEE })));
    return;
  }
  const track = book.track('jewelcrafting');
  const rank = track?.rank ?? 0;
  const specs = track?.specs ?? {};
  detail.append(el('p', 'px-note', `${bench.kind === 'shop' ? t('prof.page.jewel.shop', 'The jeweler\'s bench - {fee} gold a piece.', { fee: bench.fee }) : t('prof.page.jewel.home', 'Your jeweler\'s bench.')} ${rankLine('jewelcrafting', rank)}`));
  const short = purseShort(bench, 'jeweller');
  if (short) detail.append(el('p', 'px-note prof-short', short));
  // AUDIT 30 A2's law: Gentle acts switched on under the facet sets the stone down - nothing spent, the piece a plain one
  if (_jewel.act && getPref('gentleActs') === true) { _jewel.act.cancel(); endFacet(); _jewel.word = facetDownLine(); }
  const cutting = !!_jewel.act;
  const gentle = getPref('gentleActs') === true;
  const elsewhere = handsAt(_jewel);   // AUDIT 32 P2: one act a page
  const held = (k) => workOf(book, k);
  // THE PIECES, then the piece's bases
  const pieces = el('div', 'prof-families');
  for (const pc of JEWEL_PIECES) {
    const b = el('button', `prof-family${_jewel.piece === pc.id ? ' on' : ''}`, pc.word);
    b.type = 'button';
    b.disabled = cutting;
    b.onclick = () => { _jewel.piece = pc.id; _jewel.picked = null; rerender(); };   // its base kept where the piece is made of it (a Ring's Gold an Amulet's)
    pieces.append(b);
  }
  detail.append(pieces);
  const bases = jewelBases(_jewel.piece);
  if (!bases.some((b) => b.id === _jewel.base)) _jewel.base = bases[0].id;
  if (bases.length > 1) {
    const row = el('div', 'prof-families prof-metals');
    for (const base of bases) {
      const b = el('button', `prof-family${_jewel.base === base.id ? ' on' : ''}`, base.word);
      b.type = 'button';
      b.disabled = cutting;
      b.onclick = () => { _jewel.base = base.id; _jewel.picked = null; rerender(); };
      row.append(b);
    }
    detail.append(row);
  }
  // CLOTH-GEMS: the gems' grade, where the piece sets one - DFU's own (plain), and the port's four (Gem-Sockets 4); a graded
  // gem in the pack is put in by the loose door when the piece is made (the station's shortfall, as any looted gem's)
  if (!JEWEL_PIECES.find((x) => x.id === _jewel.piece)?.gem) _jewel.grade = 'plain';
  else {
    const row = el('div', 'prof-families prof-metals');
    for (const g of GEM_GRADES) {
      const b = el('button', `prof-family${_jewel.grade === g ? ' on' : ''}`, gemGradeWord(g));
      b.type = 'button';
      b.disabled = cutting;
      b.onclick = () => { _jewel.grade = g; _jewel.picked = null; rerender(); };
      row.append(b);
    }
    detail.append(row);
  }
  const crackedHeld = held('gem:siege');
  const lapidary = specs[100] === LAPIDARY;
  /** What the piece spends as this jeweller would: a Heartwood for a plank, a Siege-cracked Gem for the gem. */
  const spendsFor = (r, wood, cracked) => recipeInputs(r, { heartwood: wood && takesHeartwood(r), cracked: cracked && lapidary && takesCracked(r) });
  const list = jewelRecipes(_jewel.piece, _jewel.base, _jewel.grade);
  for (const r of list) {
    const open = recipeOpen(r, rank);
    const can = open && (craftable(r, held) || (lapidary && takesCracked(r) && craftable(r, held, spendsFor(r, false, true))));
    const raw = open && !can && fromRaw(r.inputs, book);   // CRAFT1
    const row = el('button', `prof-recipe${_jewel.picked === r.id ? ' on' : ''}${can || raw ? '' : ' prof-locked'}`);
    row.type = 'button';
    row.disabled = cutting;
    row.append(el('b', null, r.name), el('span', 'prof-split', open ? makeWord(can, raw) : rankWord(r.rank)));
    row.onclick = () => { _jewel.picked = r.id; rerender(); };
    detail.append(row);
  }
  // WHAT THE FACET'S END ASKS (AUDIT 30 A3's law: the piece, the Heartwood and the cracked gem it began with)
  const finishFor = (id, wood, cracked) => async (clean) => {
    _jewel.crafting = true; rerender();
    const res = await p.craft(id, { clean: clean === true && getPref('gentleActs') !== true, heartwood: wood, cracked });
    _jewel.crafting = false; _jewel.word = res?.text ?? null; rerender();
  };
  const r = list.find((x) => x.id === _jewel.picked);
  if (r) {
    const box = el('div', 'prof-craft');
    box.append(el('b', null, craftHead(r.name, r.rank)));
    if (!(lapidary && takesCracked(r) && crackedHeld > 0)) _jewel.cracked = false;
    const spends = spendsFor(r, _jewel.heartwood, _jewel.cracked);
    for (const inp of spends) {
      const have = held(inp.key);
      const line = el('div', `prof-input${have >= inp.n ? '' : ' prof-short'}`);
      line.append(el('span', null, inputLine(p.name(inp.key), have, inp.n)));
      box.append(line);
    }
    const chain = chainNote(box, el, p, book, spends);   // CRAFT1: the works it runs first
    _jewel.chained = chain?.ok === true;   // AUDIT CRAFT1 F1: a craft pressed now runs its chain - the work rows held under it
    const hand = jewelHand(r, specs[50]);
    box.append(el('p', 'px-note', t('prof.page.jewel.pointsNote', '{points}{hand, select, goldsmith { - a Goldsmith\'s Silver, counted as Gold} gemcutter { - a Gemcutter\'s gem} other {}}. The item maker spends them{wand, select, yes {} other {, beside a Masterwork\'s own enchantment}}.',
      { points: jewelPointsLine(r, hand), hand: hand === JEWEL_HAND_GOLDSMITH ? 'goldsmith' : hand === JEWEL_HAND_GEMCUTTER ? 'gemcutter' : 'none', wand: r.product === 'wand' ? 'yes' : 'no' })));   // AUDIT PROF10 J2: it takes a crafted piece with its Rare roll (itemMakerWindow.js itemMakerFilter); AUDIT PROF-541 J5: a Wand rolls none (lootRarity.js rarityEligible: no slot)
    if (recipeOpen(r, rank)) {
      const odds = qualityOdds(rank - r.rank, { masterwright: masterworkSpec(specs[100], r) });   // CRAFT3: the Master Jeweller's, on a jewel
      // AUDIT PROF-541 R2-C6: and the town Apothecary's quality steps the service adds (professions.js seatStepsFor)
      const steps = Math.max(0, Math.trunc(Number(p.jewelSteps?.()) || 0));
      box.append(el('p', 'px-note', t('prof.page.jewel.odds', 'Quality chances: {odds}. They get better the further your rank ({rank}) is above the recipe\'s ({need}). Stop every turn where the stone catches the light to raise the result one quality.{steps, plural, =0 {} one { The town\'s Apothecary raises it one more.} other { The town\'s Apothecary raises it # more.}}',
        { odds: oddsText(odds), rank, need: r.rank, steps })));
      box.append(el('p', 'px-note', craftXpLine(r, rank, professionName('jewelcrafting'), craftPayOf(book, 'jewelcrafting'))));   // CRAFT-FIRST-SHOWN: its XP moved here, beside its first's; CRAFT-LIMIT-SAID
    }
    heartwoodToggle(box, el, r, book, _jewel, rerender, cutting);   // a Wand's plank (4.2: Heartwood "worth one quality step in any recipe")
    if (lapidary && takesCracked(r) && crackedHeld > 0) {
      // A LAPIDARY'S SIEGE-CRACKED GEM (3.3: "set as any gem") - the piece is the recipe's, its gem the one chosen
      const lab = el('label', 'prof-gentle');
      const cb = el('input');
      cb.type = 'checkbox';
      cb.checked = _jewel.cracked === true;
      cb.disabled = cutting;
      cb.onchange = () => { _jewel.cracked = !!cb.checked; rerender(); };
      lab.append(cb, globalThis.document.createTextNode(` ${t('prof.page.jewel.cracked', 'Set a Siege-cracked Gem as the {gem} ({n} stored)', { gem: gemWord(r.gem), n: crackedHeld })}`));
      box.append(lab);
    }
    const ready = recipeOpen(r, rank) && (craftable(r, held, spends) || chain?.ok === true) && !_jewel.crafting && !_jewel.act && !elsewhere && !short;
    if (elsewhere && !_jewel.act) box.append(el('p', 'px-note', handsLine(elsewhere)));
    const wood = _jewel.heartwood && takesHeartwood(r), crack = _jewel.cracked === true && lapidary && takesCracked(r);
    if (_jewel.act && _jewel.actRecipe) {
      // THE FACET: the dial, the light's window on it, the stone's bearing, the facets so far
      const panel = el('div', 'prof-heat prof-facet');
      panel.append(el('span', 'prof-heatword', t('prof.page.jewel.how', 'The facet ({name}) - stop the turn where the stone catches the light (Space): {n, plural, one {# facet} other {# facets}}', { name: r.name, n: _jewel.act.state.need })));
      const bar = el('div', 'prof-heatbar prof-facetbar');
      const band = el('div', 'prof-heatband');
      band.style.left = `${(((_jewel.act.state.light - _jewel.act.state.half) / 360) * 100).toFixed(1)}%`;
      band.style.width = `${(((2 * _jewel.act.state.half) / 360) * 100).toFixed(1)}%`;
      const marker = el('div', 'prof-heatmark');
      bar.append(band, marker);
      const gem = el('span', 'prof-gem', '<>');
      const marks = el('div', 'prof-strikes');
      const dots = [];
      for (let i = 0; i < _jewel.act.state.need; i++) {
        const c = _jewel.act.state.cuts[i];
        const d = el('span', `prof-strike${c === true ? ' hit' : c === false ? ' miss' : ''}`, 'o');
        dots.push(d);
        marks.append(d);
      }
      const hit = actButton(el, t('prof.page.jewel.stop', 'Stop the turn'), (e) => _jewel.stop?.(e));
      const cancel = el('button', 'act', t('prof.page.jewel.setDown', 'Set the stone down'));
      cancel.type = 'button';
      cancel.onclick = () => { _jewel.act?.cancel(); endFacet(); _jewel.word = facetDownLine(); rerender(); };
      panel.append(gem, bar, marks, hit, cancel);
      box.append(panel);
      _jewel.els = { bar, band, marker, gem, marks: dots, hit };
      if (!_jewel.off) _jewel.stop = facetLoop(finishFor(_jewel.actRecipe, _jewel.actWood, _jewel.actCracked));
    } else {
      const go = el('button', 'act primary', _jewel.crafting ? benchBusyWord() : craftWord());
      go.type = 'button';
      go.disabled = !ready;
      go.onclick = () => {
        if (go.disabled) return;
        if (gentle) { void finishFor(r.id, wood, crack)(false); return; }   // Gentle acts: a plain piece, no facet
        _jewel.act = createFacetAct({ facets: facetCount(r), windowDeg: facetWindow(rank, p.facetBand?.() ?? 1) });
        _jewel.actRecipe = r.id; _jewel.actWood = wood; _jewel.actCracked = crack;
        rerender();
      };
      const quick = el('button', 'act', quickWord());
      quick.type = 'button';
      quick.disabled = !ready;
      quick.onclick = () => { if (!quick.disabled) void finishFor(r.id, wood, crack)(false); };
      box.append(go, quick);
    }
    detail.append(box);
  }
  detail.append(el('p', 'px-note', t('prof.page.jewel.sources', 'Silver, Gold and Platinum come from veins (Mining), gems from a clean strike on a vein\'s glint, the Pearl from nets at sea and Linen from the Weavers. Your pieces go to your pack.')));
  if (_jewel.word) detail.append(el('p', 'prof-word', _jewel.word));
}

// ─── PROF12: THE ALCHEMY STATION (bible/06-Systems/Professions-Arc.md 9.3, 37) ─────

/** What the station says a potion's cauldron wants, and its word for the Apothecaries'. */
const ALCHEMY_AWAY = 'Alchemy is brewed at an alchemy station: an Alchemist\'s or a Mages Guild hall ({fee} gold a brew), or your own home\'s. Your potions go to your pack.';   // POTION-DOOR: the Mages Guild's hall a station
export const ALCHEMY_AWAY_LINE = formatMessage(ALCHEMY_AWAY, { fee: ALCHEMY_FEE });   // the English, as the tests compare it
const alchemyAwayLine = () => t('prof.page.alchemy.away', ALCHEMY_AWAY, { fee: ALCHEMY_FEE });
/** Tests: the station's state. */
export const _alchemyForTests = () => _alchemy;
/** The potion line a brew's chance says: "Potent 30% (+25% magnitude)" - AUDIT PROF12 A3: a potion whose magnitude is DFU's
 *  default "(lasts 25% longer)" (alchemyLaw potentLasts), and the station's line, no potion picked, "(+25% magnitude or
 *  duration)". AUDIT PROF-541 B4: `steps` the town's Apothecary's (+10 a step - the service's own sum, potentChance);
 *  B3: a Cure that is never Potent (alchemyLaw potentAble) says so, and no chance. */
export const POTENT_NONE_LINE = 'Never Potent (a cure acts at once)';
export function potentLine(rank, specs, unbruised = 0, potion = null, steps = 0) {
  if (potion && !potentAble(potion)) return t('prof.page.alchemy.neverPotent', POTENT_NONE_LINE);
  const c = potentChance(rank, { distiller: specs?.[50] === DISTILLER, unbruised, steps });
  const pct = potentPct(specs?.[100] ?? null);
  return !potion ? t('prof.page.alchemy.potentAny', 'Potent {c}% (+{pct}% magnitude or duration)', { c, pct })
    : potentLasts(potion) ? t('prof.page.alchemy.potentLasts', 'Potent {c}% (lasts {pct}% longer)', { c, pct }) : t('prof.page.alchemy.potent', 'Potent {c}% (+{pct}% magnitude)', { c, pct });
}
/**
 * PROF12: THE ALCHEMY STATION - DFU's twenty (alchemyLaw POTIONS, its own order), each its rank (its price's tier), the
 * chosen one's cauldron as the Stores hold it (an herb's group the one held more of - brewKeys), what a brew makes (1-3
 * potions; a Novice's 2 since CRAFT-PAYS) and its Potent chance, the XP; Brew (no act - 9.4: "DFU's windows stay 1:1"); an ingredient the Apothecaries
 * sell, bought where it is short (4.5); and a Transmuter's transmutations (two of a metal and a Mercury into the next).
 * Only at an alchemy station: an Alchemist's, its fee a brew, or the player's own home's.
 * @param {HTMLElement} detail @param {() => void} rerender @param {{ el: Function, divider: (w: string) => HTMLElement }} kit
 */
function drawAlchemyStation(detail, rerender, { el, divider }) {
  const p = _provider;
  if (!p?.alchemy || !p.brew) return;
  const book = p.book;
  const station = p.alchemy();
  detail.append(stationHead(divider, t('prof.page.alchemy', 'The Alchemy Station'), 'alchemy'));   // STATION-DOOR
  if (!station) {
    detail.append(el('p', 'px-note', alchemyAwayLine()));
    return;
  }
  const track = book.track('alchemy');
  const rank = track?.rank ?? 0;
  const specs = track?.specs ?? {};
  const n = brewCount(rank, specs[50]);
  const steps = Math.max(0, Math.trunc(Number(p.alchemySteps?.()) || 0));   // AUDIT PROF-541 B4: the town's Apothecary; R2-C3: a whole step or none, as cookSteps
  const brewLine = t('prof.page.alchemy.brew', '{profession} {rank} ({rankName}): {n, plural, one {a potion} other {# potions}} a brew; {potent}{withSteps, select, yes { (the Apothecary\'s +{apothecary}% with it)} other {}}, +{unbruised}% for each herb you picked unbruised.',
    { profession: professionName('alchemy'), rank, rankName: rankName(rank), n, potent: potentLine(rank, specs, 0, null, steps), withSteps: steps > 0 ? 'yes' : 'no', apothecary: POTENT.apothecary * steps, unbruised: POTENT.unbruised });
  detail.append(el('p', 'px-note', `${station.kind === 'shop' ? t('prof.page.alchemy.shop', 'The alchemist\'s station - {fee} gold a brew.', { fee: station.fee }) : t('prof.page.alchemy.home', 'Your alchemy station.')} ${brewLine}${n > 1 ? ` ${t('prof.page.alchemy.counterOne', 'A potion made only from the Apothecaries\' goods brews just one.')}` : ''}`));   // AUDIT PROF-541 R2-S1
  const short = purseShort(station, 'alchemy');
  if (short) detail.append(el('p', 'px-note prof-short', short));
  const held = (k) => workOf(book, k);
  for (const potion of POTIONS) {
    const open = rank >= potion.rank;
    const keys = brewKeys(potion, held);
    const spends = brewSpends(potion, keys) ?? [];
    const can = open && spends.every((i) => held(i.key) >= i.n);
    const row = el('button', `prof-recipe${_alchemy.picked === potion.id ? ' on' : ''}${can ? '' : ' prof-locked'}`);
    row.type = 'button';
    row.append(el('b', null, potion.name), el('span', 'prof-split', open ? (can ? t('prof.page.alchemy.canBrew', 'can brew now') : t('prof.page.alchemy.wants', 'needs ingredients')) : rankWord(potion.rank)));
    row.onclick = () => { _alchemy.picked = potion.id; rerender(); };
    detail.append(row);
  }
  const potion = POTIONS.find((x) => x.id === _alchemy.picked);
  if (potion) {
    const box = el('div', 'prof-craft');
    box.append(el('b', null, craftHead(potion.name, potion.rank)));
    const keys = brewKeys(potion, held);
    const spends = brewSpends(potion, keys) ?? [];
    for (const inp of spends) {
      const have = held(inp.key);
      const line = el('div', `prof-input${have >= inp.n ? '' : ' prof-short'}`);
      line.append(el('span', null, inputLine(p.name(inp.key), have, inp.n)));
      // 4.5: the Apothecaries' counter - an ingredient no gathering yields, bought where the cauldron is short of it
      const sale = APOTHECARY_STOCK.find((x) => x.key === inp.key);
      if (sale && have < inp.n) counterBuy(line, { el, p, state: _alchemy, rerender, key: inp.key, need: inp.n - have, sale, who: 'apothecaries', counter: 'apothecaries' });
      box.append(line);
    }
    const gathered = potentAble(potion) ? potion.ingredients.filter((t) => ingredientKeys(t).some((k) => k.startsWith('p'))).length : 0;   // AUDIT PROF-541 B3: a cure's herbs add nothing
    const made = brewCount(rank, specs[50], potion);   // AUDIT PROF-541 R2-S1: the counter's goods alone brew one
    // CRAFT-LIMIT-SAID: the brew's XP as the service pays it (its ?10 the Firmament's percent on brewXp, its ?11 the first's
    // whole - FIRST-BUDGET: Provisioning's first-make share, brewFirstXp), and the limit's line in its
    // place where the track cannot take it
    const pay = craftPayOf(book, 'alchemy'), profession = professionName('alchemy');   // CRAFT3: the craft's own name
    const xp = paidXp(brewXp(potion, rank), { pct: pay.pct }), more = brewFirstXp(potion);
    box.append(el('p', 'px-note', [
      t('prof.page.alchemy.made', '{n, plural, one {A potion} other {# potions}} a brew.', { n: made }),
      t('prof.page.alchemy.potentLine', '{potent}{gathered, select, yes { - and +{unbruised}% for each of its herbs you picked unbruised} other {}}.', { potent: potentLine(rank, specs, 0, potion, steps), gathered: gathered ? 'yes' : 'no', unbruised: POTENT.unbruised }),
      // CRAFT-FIRST-SHOWN: a potion wholly of the Apothecaries' goods says why its first lays on nothing (AUDIT 32 S1's law, brewFirstPays - brewFirstXp 0)
      capLine(profession, pay, xp + more)
        || (more > 0 ? t('prof.page.alchemy.xpFirst', '{xp} {profession} experience, and {more, number} the first time.', { xp, profession, more }) : t('prof.page.alchemy.xpShop', '{xp} {profession} experience. It is made only from the Apothecaries\' goods, so it earns no first-time bonus.', { xp, profession })),
    ].join(' ')));
    const ready = rank >= potion.rank && spends.length > 0 && spends.every((i) => held(i.key) >= i.n) && !_alchemy.crafting && !short;
    const go = el('button', 'act primary', _alchemy.crafting ? t('prof.page.alchemy.brewing', 'Brewing...') : t('prof.page.alchemy.go', 'Brew'));
    go.type = 'button';
    go.disabled = !ready;
    go.onclick = async () => {
      if (go.disabled || _alchemy.crafting) return;
      _alchemy.crafting = true; rerender();
      const res = await p.brew(potion.id, keys);
      _alchemy.crafting = false; _alchemy.word = res?.text ?? null; rerender();
    };
    box.append(go);
    detail.append(box);
  }
  // A TRANSMUTER'S TRANSMUTATIONS (3.3; AUDIT PROF12 E3): two of a metal and a Mercury into the next up the ladder
  if (p.smelt) {
    if (specs[100] === TRANSMUTER.id) workRows(detail, rerender, el, TRANSMUTE_RECIPES, _alchemy, t('prof.page.alchemy.transmute', 'Transmute'), t('prof.page.alchemy.transmuting', 'Transmuting...'), (id, k) => /** @type {any} */ (p.smelt)(id, k), short);
    else detail.append(el('p', 'px-note', t('prof.page.alchemy.transmuter', 'A Transmuter (an Alchemy choice at 100) turns two of a metal and a Mercury into one of the next metal up: Tin, Copper, Silver, Gold, Platinum.')));
  }
  detail.append(el('p', 'px-note', t('prof.page.alchemy.sources', 'Herbs come from Herbalism, metals and gems from veins, the Pearl from the sea and body parts from Hunting. Buy the rest at the Apothecaries\' counter. Your potions go to your pack.')));
  if (_alchemy.word) detail.append(el('p', 'prof-word', _alchemy.word));
}

// ─── PROF12: THE ENCHANTING STATION (bible/06-Systems/Professions-Arc.md 9.3, 37) ─────

const ENCHANT_AWAY = 'Disenchanting is done at an enchanting station: a Mages Guild hall ({fee} gold a piece), or your own home\'s. A crafted piece comes apart into Arcane Essence in your Stores.';
export const ENCHANT_AWAY_LINE = formatMessage(ENCHANT_AWAY, { fee: ENCHANT_FEE });   // the English, as the tests compare it
const enchantAwayLine = () => t('prof.page.enchant.away', ENCHANT_AWAY, { fee: ENCHANT_FEE });
/** Tests: the station's state. */
export const _enchantForTests = () => _enchant;
/** AUDIT PROF-541 B8: a piece whose Essence the Stores have no room for. */
export const ENCHANT_FULL_LINE = (room) => t('prof.page.enchant.full', 'Your Stores have room for {n} more Arcane Essence, not enough for this piece.', { n: Math.max(0, room) });
/** DISENCHANT-SAID: a piece whose points make no Essence - listed, greyed, and why (alchemyLaw ESSENCE_POINTS). */
export const ENCHANT_UNDER_LINE = (points) => t('prof.page.enchant.under', '{points, number} points. One Arcane Essence needs {per, number}.', { points, per: ESSENCE_POINTS });
/**
 * DISENCHANT-SAID (FIELD BUGS 2026-10-19f; the owner, 2026-10-19: "List them greyed with the reason"): THE PIECES THE
 * ENCHANTING STATION LISTS, made here and wired by the host (scenes/world.js `disenchantable`), never in it. A player's
 * private report: crafted greaves and pauldrons could not be disenchanted, and the station never said why. PROF12 (9.3,
 * 37) gives a piece its DFU template's enchantment points, one Essence a hundred - Greaves 50, either Pauldron 40, so
 * none at any metal (alchemyLaw piecePoints, essenceOf), and the service refuses them (`prof-no-essence`); the host's
 * list dropped them (`essence > 0`), and the page explained only an empty list. Now the list keeps them: the pack's
 * crafted pieces (a provenance and a recipe - loot never comes apart) that may leave the pack (tradePack tradeRefusal:
 * not worn, bound or a quest's; itemLock isLocked) and carry no market act (`kept`, the market's and the writs' hold),
 * each its points, its Essence (a Disenchanter's twice - `book`'s Enchanting at 50) and its recipe (AUDIT PROF12 E2: the
 * XP's tier). A piece whose form carries enchantment points but under a hundred stays on it with `essence` 0, and the
 * page greys it with the reason; a form with none at all (a dish, a tool, a Repair Kit, the mason's stone) is no
 * enchanter's piece and is left off, as before. No change to the law or the service.
 * @param {any[]|null|undefined} items the pack @param {{ kept?: (provenance: string) => boolean, book?: any }} [o]
 * @returns {Array<{ provenance: string, name: string, points: number, essence: number, recipe: string }>}
 */
export function disenchantableOf(items, { kept = () => false, book = null } = {}) {
  const disenchanter = book?.track?.('enchanting')?.specs?.[50] === DISENCHANTER;
  return (items ?? []).filter((it) => it?.provenance && typeof it.recipe === 'string' && !tradeRefusal(it) && !isLocked(it) && !kept(it.provenance))
    .map((it) => {
      const r = recipeById(it.recipe);
      const points = r?.kind === 'jewel' && Number.isSafeInteger(it.enchantmentPoints) ? it.enchantmentPoints : piecePoints(r);
      return { provenance: it.provenance, name: itemLongName(it), points, essence: essenceOf(points, disenchanter), recipe: it.recipe };
    }).filter((x) => x.points > 0);
}
/**
 * PROF12: THE ENCHANTING STATION - the pack's crafted pieces (a provenance - loot is never disenchanted), each the Arcane
 * Essence it would give (a hundred of its enchantment points an Essence, a Disenchanter's twice) and the XP; Disenchant,
 * pressed twice (the piece is gone). Only at an enchanting station: a Mages Guild hall, its fee a piece, or a home's.
 * @param {HTMLElement} detail @param {() => void} rerender @param {{ el: Function, divider: (w: string) => HTMLElement }} kit
 */
function drawEnchantingStation(detail, rerender, { el, divider }) {
  const p = _provider;
  if (!p?.enchanter || !p.disenchant || !p.disenchantable) return;
  const book = p.book;
  const station = p.enchanter();
  detail.append(stationHead(divider, t('prof.page.enchant', 'The Enchanting Station'), 'enchant'));   // STATION-DOOR
  if (!station) {
    detail.append(el('p', 'px-note', enchantAwayLine()));
    return;
  }
  const track = book.track('enchanting');
  const rank = track?.rank ?? 0;
  const specs = track?.specs ?? {};
  const pct = enchantDiscountPct(rank, specs[50] ?? null);
  detail.append(el('p', 'px-note', `${station.kind === 'shop' ? t('prof.page.enchant.shop', 'The guild\'s enchanter - {fee} gold a piece.', { fee: station.fee }) : t('prof.page.enchant.home', 'Your enchanting station.')} ${pct
    ? t('prof.page.enchant.rankPct', '{profession} {rank} ({rankName}): the item maker costs {pct}% less.', { profession: professionName('enchanting'), rank, rankName: rankName(rank), pct }) : rankLine('enchanting', rank)}`));
  const short = purseShort(station, 'enchanter');
  if (short) detail.append(el('p', 'px-note prof-short', short));
  const pieces = p.disenchantable();
  // AUDIT PROF-541 B8: the Essence's room - every origin counted, as the service counts it (storesFullIn's sum) -
  // FB1020h ESSENCE-LOOSE: its loose units too (storesRoomOf)
  const ess = book.store?.(ARCANE_ESSENCE.key) ?? { own: workOf(book, ARCANE_ESSENCE.key) };
  const room = storesRoomOf(book, ess);
  // DISENCHANT-SAID: said when no piece gives Essence - a piece listed under one stands greyed below, its reason beside it
  if (!pieces.some((pc) => pc.essence >= 1)) detail.append(el('p', 'px-note', t('prof.page.enchant.none', 'No crafted piece in your pack has enough enchantment to give Essence. Only pieces a player crafted online can be taken apart.')));
  // CRAFT-LIMIT-SAID: each piece's XP as the service credits it (the Firmament's percent on disenchantXp, under the room the
  // track has left), and the limit's line once where it holds one of them under what it earns
  const pay = craftPayOf(book, 'enchanting');
  // CLOTH-GEMS: a piece made wholly of cloth gives its XP only where its maker's own cloth made it and it was never sold
  // (alchemyLaw disenchantXp's `own`, the piece's bought_with on the service) - the station cannot see that, so it says the
  // figure such a piece gives and, once, the rule
  const ownXp = (/** @type {any} */ pc) => disenchantXp(recipeById(pc.recipe), rank, essenceOf(pc.points), true);
  const capped = capLine(professionName('enchanting'), pay, Math.max(0, ...pieces.map((pc) => paidXp(ownXp(pc), { pct: pay.pct }))));
  if (capped) detail.append(el('p', 'px-note', capped));
  if (pieces.some((pc) => pc.essence >= 1 && counterMade(recipeById(pc.recipe)))) detail.append(el('p', 'px-note', t('prof.page.enchant.cloth', 'A piece made only of cloth gives Enchanting experience only if its maker wove or spun that cloth and it was never sold.')));
  for (const pc of pieces) {
    // DISENCHANT-SAID (the owner: "List them greyed with the reason"): a piece under one Essence - greyed, its reason, its
    // Disenchant never pressed (the service would refuse it: prof-no-essence)
    if (!(pc.essence >= 1)) {
      const row = el('div', 'prof-smelt prof-locked');
      const b = el('button', 'act', t('prof.page.enchant.go', 'Disenchant'));
      b.type = 'button';
      b.disabled = true;
      row.append(el('b', null, pc.name), el('span', 'prof-split', ENCHANT_UNDER_LINE(pc.points)), b);
      detail.append(row);
      continue;
    }
    const row = el('div', 'prof-smelt');
    const base = essenceOf(pc.points);
    const gives = { points: pc.points, essence: pc.essence, xp: paidXp(disenchantXp(recipeById(pc.recipe), rank, base, true), pay) };   // CLOTH-GEMS: an own piece's (the rule said above)
    row.append(el('b', null, pc.name), el('span', 'prof-split', specs[50] === DISENCHANTER
      ? t('prof.page.enchant.givesTwo', '{points, number} points: {essence} Arcane Essence, +{xp} Enchanting experience (two for a Disenchanter)', gives)
      : t('prof.page.enchant.gives', '{points, number} points: {essence} Arcane Essence, +{xp} Enchanting experience', gives)));
    const armed = _enchant.armed === pc.provenance;
    const b = el('button', 'act', _enchant.busy && armed ? t('prof.page.enchant.busy', 'Taking it apart...') : armed ? t('prof.page.enchant.armed', 'Press again to destroy it') : t('prof.page.enchant.go', 'Disenchant'));
    b.type = 'button';
    const full = pc.essence > room;   // AUDIT PROF-541 B8: the service would refuse it (stores-full) - said, never pressed
    if (full) row.append(el('span', 'prof-short', ENCHANT_FULL_LINE(room)));
    b.disabled = _enchant.busy || !!short || full;
    b.onclick = async () => {
      if (_enchant.busy) return;
      if (!armed) { _enchant.armed = pc.provenance; rerender(); return; }
      _enchant.busy = true; rerender();
      const res = await /** @type {any} */ (p.disenchant)(pc.provenance);
      _enchant.busy = false; _enchant.armed = null; _enchant.word = res?.text ?? null; rerender();
    };
    row.append(b);
    detail.append(row);
  }
  if (_enchant.word) detail.append(el('p', 'prof-word', _enchant.word));
  drawEssenceReforge(detail, rerender, { el, divider }, rank, short);   // CRAFT4
}

// ─── CRAFT4: THE TEMPER AND THE REFORGE WITH ESSENCE (bible/06-Systems/Professions-Arc.md 41.7) ─────

/** CRAFT5 (Professions-Arc 41.8): what a Repair Kit's box says - its work, and the reach its quality gives. */
export const KIT_REACH_LINE = 'A Repair Kit restores a quarter of the condition of a weapon or armor of its metal, once. It repairs up to three quarters, or nine tenths with a Superior or Masterwork kit.';
/** What the temper says it is, at the anvil and at the loom. */
export const TEMPER_HOW = (where) => (where === 'loom'
  ? 'A tailor tempers leather armor or a garment one grade better, up to Superior. It takes a found or made piece of Rare or below, half its recipe\'s leather or bolts, and that recipe\'s rank.'
  : 'A smith tempers a weapon or a piece of metal armor one grade better, up to Superior. It takes a found or made piece of Rare or below, half its recipe\'s ingots, and that recipe\'s rank.');
/** What the temper says with nothing to take. */
export const TEMPER_NONE = 'Nothing in your pack can be tempered here. Legendary, Aetheric, artifact and Sigil pieces can\'t be tempered, Superior and Masterwork pieces are already at the top, and worn pieces must be taken off first.';
/** Tests: the temper's state and the Reforge with Essence's. */
export const _temperForTests = () => _temper;
export const _essReforgeForTests = () => _essReforge;
/**
 * CRAFT4: THE TEMPER - at the anvil the smith's pieces of the pack (a weapon, plate, a shield, chain), at the loom the
 * tailor's (leather armour, a garment): each a quality step better, up to Superior, for half its recipe's main input
 * from the Stores (temperLaw temperCost) and the craft's XP, at the recipe's rank. Loot and made pieces alike, Rare or
 * below (law 7). Only where the station stands.
 * @param {HTMLElement} detail @param {() => void} rerender @param {{ el: Function, divider: (w: string) => HTMLElement }} kit
 * @param {'anvil'|'loom'} where
 */
function drawTemper(detail, rerender, { el, divider }, where) {
  const p = _provider;
  if (!p?.temperable || !p.temper) return;
  const station = (where === 'loom' ? p.loom?.() : p.forge?.()) ?? null;
  if (!station) return;
  const craft = where === 'loom' ? 'outfitting' : 'smithing';
  const book = p.book;
  const rank = book.track(craft)?.rank ?? 0;
  detail.append(divider(where === 'loom' ? 'Temper at the Loom' : 'Temper at the Anvil'), el('p', 'px-note', TEMPER_HOW(where)));
  const short = purseShort(station, where === 'loom' ? 'temperLoom' : 'temperAnvil');   // L10N4: purseShort takes the station, its sentence its own
  if (short) detail.append(el('p', 'px-note prof-short', short));
  const pieces = p.temperable(where);
  if (!pieces.length) detail.append(el('p', 'px-note', TEMPER_NONE));
  // CRAFT-LIMIT-SAID: each temper's XP as the service credits it (the Firmament's percent on temperXp, under the room the
  // track has left), and the limit's line once where it holds one of them under what it earns
  const pay = craftPayOf(book, craft);
  const tempered = pieces.map((pc) => recipeById(pc.recipe)).filter((r) => temperableRecipe(r));
  const held = capLine(professionName(craft), pay, Math.max(0, ...tempered.map((r) => paidXp(temperXp(r, rank), { pct: pay.pct }))));
  if (held) detail.append(el('p', 'px-note', held));
  for (const pc of pieces) {
    const r = recipeById(pc.recipe);
    if (!temperableRecipe(r)) continue;
    const cost = temperCost(r);
    const open = rank >= r.rank, have = workOf(book, cost.key) >= cost.n;
    const row = el('div', 'prof-smelt');
    row.append(el('b', null, pc.name), el('span', 'prof-split', `${QUALITY_NAMES[pc.quality]} to ${QUALITY_NAMES[pc.quality + 1]} - ${cost.n} ${p.name(cost.key)}, +${paidXp(temperXp(r, rank), pay)} ${professionName(craft)} XP`));
    if (open && !have) row.append(el('span', 'prof-short', `Needs ${cost.n} ${p.name(cost.key)}.`));
    const b = el('button', 'act', _temper.busy === pc.item ? 'Tempering...' : open ? 'Temper' : `${professionName(craft)} ${r.rank}`);
    b.type = 'button';
    b.disabled = !!_temper.busy || !!short || !open || !have || !!handsAt(null);
    b.onclick = async () => {
      if (_temper.busy) return;
      _temper.busy = pc.item; _temper.where = where; _temper.word = null; rerender();
      const res = await /** @type {any} */ (p.temper)(pc);
      _temper.busy = null; _temper.word = res?.text ?? null; rerender();
    };
    row.append(b);
    detail.append(row);
  }
  if (_temper.word && _temper.where === where) detail.append(el('p', 'prof-word', _temper.word));
}

/** What the Reforge with Essence says it is, and below its rank. */
/** REFORGE-REPLACE (the owner: "Replace, price rises"): a line is replaced by another kind, any line, the price doubling. */
export const ESSENCE_REFORGE_HOW = () => t('prof.page.reforge.how', 'An Enchanter replaces one line of a Magic piece with a line of another kind for {magic} Arcane Essence, or of a Rare piece for {rare}. Any line can be reforged, and each reforge doubles the price of the next on that piece.', { magic: REFORGE_ESSENCE.magic, rare: REFORGE_ESSENCE.rare });
export const ESSENCE_REFORGE_RANK_LINE = () => t('prof.page.reforge.rank', 'From Enchanting {rank}, you can replace one line of a Magic or Rare piece with a line of another kind here, for Arcane Essence.', { rank: REFORGE_RANK });   // REFORGE-REPLACE: a line replaced, never rolled again
export const ESSENCE_REFORGE_NONE = 'Nothing in your pack can be reforged. It takes an identified Magic or Rare piece you are not wearing.';
/**
 * CRAFT4: THE REFORGE WITH ESSENCE - at the enchanting station, an Enchanter of rank 50's: each known Magic and Rare piece
 * of the pack, each line it may replace (the Loot arc's own Reforge, lootRarity.js reforgeAffix), for 2 or 5 Arcane
 * Essence from the Stores - never gold's units - doubled for every reforge the piece has taken (REFORGE-REPLACE).
 * @param {HTMLElement} detail @param {() => void} rerender @param {{ el: Function, divider: (w: string) => HTMLElement }} kit
 * @param {number} rank @param {string|null} short
 */
function drawEssenceReforge(detail, rerender, { el, divider }, rank, short) {
  const p = _provider;
  if (!p?.reforgeable || !p.essenceReforge) return;
  detail.append(divider('Reforge with Essence'));
  if (rank < REFORGE_RANK) { detail.append(el('p', 'px-note', ESSENCE_REFORGE_RANK_LINE())); return; }
  detail.append(el('p', 'px-note', ESSENCE_REFORGE_HOW()));
  const ess = p.book.store?.(ARCANE_ESSENCE.key) ?? { own: workOf(p.book, ARCANE_ESSENCE.key) };
  const have = (ess.own | 0) + (ess.bought | 0) + (ess.loose | 0);   // never gold's units, as the service spends - FB1020h ESSENCE-LOOSE: a station's, its loose too
  const pieces = p.reforgeable();
  if (!pieces.length) detail.append(el('p', 'px-note', ESSENCE_REFORGE_NONE));
  for (const pc of pieces) {
    const n = reforgeEssence(pc.tier, reforgeCount(pc.item));   // REFORGE-REPLACE: its next reforge's, doubled for each it has taken
    if (!n) continue;
    const row = el('div', 'prof-smelt');
    row.append(el('b', null, pc.name), el('span', 'prof-split', `${n} Arcane Essence a line`));
    if (have < n) row.append(el('span', 'prof-short', `Needs ${n} Arcane Essence; your Stores hold ${have}.`));
    // FB1017 REFORGE-STACK: a press a line, in a block of their own under the piece - in the row's button track (one cell,
    // `.prof-smelt .act`) every press drew on the first and the name was squeezed to nothing
    const presses = el('div', 'prof-lines');
    for (const line of pc.lines) {
      const b = el('button', 'act', _essReforge.busy === pc.item ? 'Reforging...' : `Reforge: ${line.text}`);
      b.type = 'button';
      b.disabled = !!_essReforge.busy || !!short || have < n;
      b.onclick = async () => {
        if (_essReforge.busy) return;
        _essReforge.busy = pc.item; _essReforge.word = null; rerender();
        const res = await /** @type {any} */ (p.essenceReforge)(pc, line.index);
        _essReforge.busy = null; _essReforge.word = res?.text ?? null; rerender();
      };
      presses.append(b);
    }
    row.append(presses);
    detail.append(row);
  }
  if (_essReforge.word) detail.append(el('p', 'prof-word', _essReforge.word));
}
