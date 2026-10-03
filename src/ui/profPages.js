// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF1 (2026-09-28, Mac: "actual UI integration for life skills") -
// THE PROFESSIONS AND STORES PAGES of the character sheet: two pages on
// the pause window's Stats rail (ui/enhancedMenu.js), beside Character,
// Attributes and Skills - the sheet's own bones (bible/06-Systems/
// Professions-Arc.md 8, 21, 22). Online only, and only while the
// professions are this account's: the host registers its book here
// (`setProfessionsPages`), and a page with nothing behind it is never
// drawn (PX14's drawn door).
//
//   THE PROFESSIONS PAGE - the thirteen in two groups, Gathering and
//   Crafting, each a row with its rank, its rank's name and a thin bar;
//   the chosen one below: the XP to the next rank, today's harvests, the
//   specialisation cards at 50 and 100 (choose one - a change of mind
//   costs 1,000 Marks and a week, and is pressed twice), the unlocks by
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
import {
  PROFESSIONS, SPECIALISATIONS, SPEC_RANKS, RESPEC, xpForRank, rankName, PROF_RANK_MAX, TIER_RANKS, CRAFTS_ABOVE_JOURNEYMAN,
  JOURNEYMAN_RANK, MATERIAL_FAMILIES, HARVESTS_PER_DAY, HIDES_PER_DAY, HIGH_HIDES_PER_DAY, HAULS_PER_DAY, WITHDRAW_MAX, professionName, SMELT_RECIPES, SMELT_MAX, FORGE_FEE,
  withdrawable, stockOf, STOCK_MAX, BURN_RECIPES, SAW_RECIPES, WORKBENCH_FEE, WOODS, workPer, workSpecRank, CURE_RECIPES,
  WEAVE_RECIPES, LOOM_FEE, CLOTHS, WEAVERS_STOCK, STANDARD_SILK,
  MASON_RECIPES, MASON_FEE, workOpen,   // PROF11: the mason's bench
  JEWEL_FEE,   // PROF10: the jeweller's bench
  ALCHEMY_FEE, ENCHANT_FEE, TRANSMUTE_RECIPES, TRANSMUTER, APOTHECARY_STOCK,   // PROF12: the alchemy and enchanting stations
  STORES_MAX, ARCANE_ESSENCE,   // AUDIT PROF-541 B8: a disenchant's room in the Stores
} from '../net/professionLaw.js';
import {
  POTIONS, brewKeys, brewSpends, brewCount, potentChance, potentPct, potentLasts, potentAble, brewXp, brewFirstPays, ingredientKeys, DISTILLER, POTENT,
  enchantDiscountPct, DISENCHANTER, disenchantXp, essenceOf,
} from '../net/alchemyLaw.js';   // PROF12: Alchemy's brew, Enchanting's layer and Disenchanting
import {
  RECIPES, recipeOpen, qualityOdds, QUALITY_NAMES, HEAT_ACT, takesQuality, recipeInputs, takesHeartwood, PLANE_ACT, STITCH_ACT,
  GARMENT_DYES, MASONRY_RECIPES, CHISEL_ACT, chiselStrikes, chiselMarkS, SCULPTOR,   // PROF11: the Sculptor's stone and the chisel
  COOKING_RECIPES, dishOf, dishEffectText, dishHand, craftCount, cookXp, panCount, panWindow, HAND_PROVISIONER,   // PROF9: the fire's dishes and the pan
  JEWELCRAFTING_RECIPES, JEWEL_PIECES, jewelBases, jewelHand, jewelPointsPct, jewelPoints, takesCracked, masterworkSpec, facetCount,
  facetWindow, LAPIDARY, JEWEL_HAND_GOLDSMITH, JEWEL_HAND_GEMCUTTER, craftXp, gemWord,   // PROF10: the jeweller's pieces and the facet
  recipeById,   // AUDIT PROF12 E2: a disenchant's XP is its piece's recipe's tier
} from '../net/recipeLaw.js';
import { createStitchAct } from '../systems/stitchAct.js';
import { createChiselAct } from '../systems/chiselAct.js';   // PROF11
import { createPanAct } from '../systems/panAct.js';   // PROF9
import { createFacetAct } from '../systems/facetAct.js';   // PROF10
import { templateByIndex } from '../systems/itemTemplates.js';   // PROF10: a piece's DFU template - its enchantment points
import { DYE_NAMES } from '../characters/dyes.js';
import { isTextEntryTarget, isDomControlTarget } from './input.js';   // AUDIT 30 A9: a field's keys and a button's are their own
import { createHeatAct } from '../systems/heatAct.js';
import { createPlaneAct } from '../systems/planeAct.js';
import { material } from '../net/nodeLaw.js';
import { marksText } from '../net/marksLaw.js';   // AUDIT 32 R13: "1 Drake", as the Market tab says it
import { accountRefusalText } from '../net/accountClient.js';
import { getPref, setPref } from '../systems/uiPrefs.js';

/**
 * @typedef {object} ProfPagesProvider
 * @property {any} book                                   net/profBook.js - the character's professions
 * @property {(key: string) => string} name               a material's name (systems/profItems.js materialLabel)
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
 * @property {() => ({ kind: 'shop'|'home', fee: number }|null)} [workbench]   PROF4: the workbench the player stands at
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
 *   pack's crafted pieces an enchanting station may take apart, each its Essence (AUDIT PROF12 E2: and its recipe, the XP's tier)
 * @property {(provenance: string) => Promise<{ ok: boolean, text: string }>} [disenchant]   PROF12: a piece taken apart
 */
let _provider = /** @type {ProfPagesProvider|null} */ (null);
/** The host's book, or null to take the pages down (offline, a closed switch, the host gone). */
export function setProfessionsPages(p) { _provider = p ?? null; }
/** What a locked specialisation's card says it waits for (professionLaw.js `later`). */
const LATER_WORDS = Object.freeze({
  SEAT2: 'Comes with the sieges', SEAT2b: 'Comes with the fortifications',   // PROF11: the Builder's and the Fortifier's
  // PROF7 (Professions-Arc.md 29): what DFU gives these nothing to stand as - for Mac
  trophy: 'Waits on a trophy to stand as', 'two-colour': 'Waits on a second dye Daggerfall\'s cloth can take', wagon: 'Waits on a wagon upgrade to hold',   // AUDIT 32 R11: Daggerfall, never "DFU", where a player reads it
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
/** PROF4 (bible/06-Systems/Professions-Arc.md 25): the home stations the Stores page works - the forge and the workbench -
 *  offered, sold and worked only where it is (forgeOffered's gate, AUDIT 29 B2). */
export const PROF_STATIONS = Object.freeze(['forge', 'workbench', 'loom', 'mason', 'jeweller']);   // PROF7: the loom; PROF11: the mason's bench; PROF10: the jeweller's
export const WORKBENCH_COLD_LINE = 'The workbench is bare. Carpentry is done online, from your Stores page.';
export const LOOM_COLD_LINE = 'The loom is still. Outfitting is done online, from your Stores page.';
export const MASON_COLD_LINE = 'The mason\'s bench is idle. Masonry is done online, from your Stores page.';   // PROF11
export const JEWEL_COLD_LINE = 'The jeweller\'s bench is bare. Jewelcrafting is done online, from your Stores page.';   // PROF10
export const stationColdLine = (station) => (station === 'workbench' ? WORKBENCH_COLD_LINE : station === 'loom' ? LOOM_COLD_LINE
  : station === 'mason' ? MASON_COLD_LINE : station === 'jeweller' ? JEWEL_COLD_LINE : FORGE_COLD_LINE);
/** The rail's rows the pages add. */
export const PROF_PAGE_SECTIONS = Object.freeze([Object.freeze(['professions', 'Professions']), Object.freeze(['stores', 'Stores'])]);

/** What the Professions page has chosen, and a change of specialisation pressed once (the second press buys it). */
let _sel = 'herbalism';
let _armed = null;
/** The Professions page's last refusal, said under the cards. */
let _profWord = null;
/** The Stores page's filter, search, sort, the material chosen and the quantity to withdraw. */
const _stores = { family: null, query: '', sort: 'tier', picked: null, qty: 1, word: null, busy: false, settledAt: -Infinity };
/** PROF2: the forge's counts by recipe, a smelt in flight, and its last word. */
const _forge = { counts: /** @type {Record<string, number>} */ ({}), busy: false, word: /** @type {string|null} */ (null) };
/** PROF3: the anvil's family and metal shown, the recipe chosen, the heat being struck, a craft in flight and its word. */
const _anvil = {
  family: 'weapons', metal: 'ingot:iron', picked: /** @type {string|null} */ (null), act: /** @type {any} */ (null),
  busy: false, crafting: false, word: /** @type {string|null} */ (null), els: /** @type {any} */ (null), off: /** @type {(() => void)|null} */ (null),
  strike: /** @type {((e?: any) => void)|null} */ (null), heartwood: false,   // AUDIT 32 P1: strike takes the press's event, its moment
  /** AUDIT 30 A3: the recipe the heat under way makes, and its Heartwood - what the page shows may not be */
  actRecipe: /** @type {string|null} */ (null), actWood: false,
};
/** PROF4: the workbench's family and wood shown, the recipe chosen, the plane being drawn, a craft in flight, its word,
 *  the saws' counts and whether a Heartwood stands in for a plank. */
const _bench = {
  family: 'staves', wood: 'plank:pine', picked: /** @type {string|null} */ (null), act: /** @type {any} */ (null),
  busy: false, crafting: false, word: /** @type {string|null} */ (null), counts: /** @type {Record<string, number>} */ ({}), heartwood: false,
  actRecipe: /** @type {string|null} */ (null), actWood: false,   // AUDIT 30 A3: the plane's own recipe
};
/** PROF7: the loom's family, cloth and clothing shown, the recipe chosen, the dye, the stitch being sewn, a craft in
 *  flight and its word, the cures' and the weave's counts. */
const _loom = {
  family: 'leather', cloth: 'cloth:linen', clothing: /** @type {string|null} */ (null), picked: /** @type {string|null} */ (null),
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
/** PROF9: the fire - the dish chosen, the pan on the fire and what it cooks (`actRecipe`), a dish in flight, its word. */
const _cook = {
  picked: /** @type {string|null} */ (null), act: /** @type {any} */ (null), crafting: false, word: /** @type {string|null} */ (null),
  els: /** @type {any} */ (null), off: /** @type {(() => void)|null} */ (null), take: /** @type {((e?: any) => void)|null} */ (null),
  actRecipe: /** @type {string|null} */ (null),
};
/** PROF10: the jeweller's bench - the piece and its base shown, the recipe chosen, a Heartwood for a Wand's plank and a
 *  Lapidary's Siege-cracked Gem for the gem, the facet being cut and what it cuts (`actRecipe`, its stand-ins), a piece
 *  in flight, its word. */
const _jewel = {
  piece: 'ring', base: 'silver', picked: /** @type {string|null} */ (null), heartwood: false, cracked: false,
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
/** AUDIT 30 U20: the one row a smelt, burn or saw is under way on - its button alone says so. */
let _workingOn = /** @type {string|null} */ (null);
/**
 * AUDIT 32 P2: ONE ACT A PAGE - the station whose act is under way, other than `me`'s, or null. A home with a forge and a
 * loom showed both, and one Space struck the heat AND stitched (two capture listeners on the one document): a craft the
 * player never finished spent its ingot. Every station's Craft waits on the others'.
 * @param {object} me
 */
const handsAt = (me) => (me !== _anvil && _anvil.act ? 'the anvil' : me !== _bench && _bench.act ? 'the workbench' : me !== _loom && _loom.act ? 'the loom'
  : me !== _mason && _mason.act ? 'the mason\'s bench' : me !== _cook && _cook.act ? 'the fire'
    : me !== _jewel && _jewel.act ? 'the jeweller\'s bench' : null);   // PROF11; PROF9: the fire; PROF10: the jeweller's bench
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
/** AUDIT 30 U13: a station's fee the purse cannot meet - its words, or null. */
function purseShort(station, who, per) {
  const p = _provider;
  if (!station || station.kind !== 'shop' || !(station.fee > 0) || typeof p?.purse !== 'function') return null;
  const have = p.purse();
  return have < station.fee ? `The ${who} asks ${station.fee} gold ${per}; you carry ${have}.` : null;
}
/** What a Stores material of the smith's stock says in place of a withdrawal. */
export const STOCK_STAYS_LINE = 'It stays at the bench: the anvil and the workbench spend it, and it comes to the pack once its own craft is practised.';   // PROF4: a counter's good with no pack form - none since PROF7 registered them all (NO_PACK_FORM empty), kept for a material to come
/** SEAT2b part two: what a siege work (the Ram Kit) says in place of a withdrawal - its road is a Siege Camp's writ. */
export const SIEGE_STAYS_LINE = 'A siege work stays in the Stores: a writ for your guild\'s Siege Camp carries it to the siege, delivered at a Notice Board\'s Work tab.';
/** AUDIT PROF12 E1: what Arcane Essence says in place of a withdrawal - it never goes to the pack (NO_PACK_FORM). */
export const ESSENCE_STAYS_LINE = 'Arcane Essence stays in the Stores: it never goes to the pack, and it is sold on the Market tab from here.';
/**
 * AUDIT 32 P12: ESCAPE SETS AN ACT DOWN before it closes the window (AUDIT 31's law: Escape closes a form before the
 * window) - the heat, the plane or the stitch under way let go, nothing spent, and said. It closed the pause window, and
 * the act was dropped silently with the page. True when there was one.
 */
export function setDownProfAct() {
  if (_anvil.act) { _anvil.act.cancel(); endHeat(); _anvil.word = 'You let the ingot cool; nothing is spent.'; return true; }
  if (_bench.act) { _bench.act.cancel?.(); _bench.act = null; _bench.actRecipe = null; _bench.word = 'You set the plane down; nothing is spent.'; return true; }
  if (_loom.act) { _loom.act.cancel(); endStitch(); _loom.word = 'You set the needle down; nothing is spent.'; return true; }
  if (_mason.act) { _mason.act.cancel(); endChisel(); _mason.word = CHISEL_DOWN_LINE; return true; }   // PROF11
  if (_cook.act) { _cook.act.cancel(); endPan(); _cook.word = PAN_DOWN_LINE; return true; }   // PROF9
  if (_jewel.act) { _jewel.act.cancel(); endFacet(); _jewel.word = FACET_DOWN_LINE; return true; }   // PROF10
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
  endChisel(); _mason.word = null; _mason.picked = null; _mason.counts = {};   // PROF11
  endPan(); _cook.word = null; _cook.picked = null; _cook.crafting = false;   // PROF9
  endFacet(); _jewel.word = null; _jewel.piece = 'ring'; _jewel.base = 'silver'; _jewel.picked = null; _jewel.crafting = false; _jewel.heartwood = false; _jewel.cracked = false;   // PROF10
  _alchemy.word = null; _alchemy.picked = null; _alchemy.crafting = false; _alchemy.counts = {};   // PROF12
  _enchant.word = null; _enchant.armed = null;   // PROF12
}

/** What the Professions page says a harvest earns for each profession PROF1 gathers, by tier. */
const UNLOCKS = Object.freeze({
  herbalism: Object.freeze([['Common herbs, and the Basket\'s food', 1], ['Uncommon herbs', 2], ['Rare herbs', 3]]),
  // PROF2: the metals by their tiers (PROF0 4.1), the stone and the dungeons' deep veins
  mining: Object.freeze([['Iron, Tin, Copper, Lead, Sulphur; quarrying', 1], ['Lodestone, Mercury', 2], ['Silver; the dungeons\' deep veins', 3],
    ['Gold, Moonstone, Dwarven Scrap', 4], ['Platinum, Mithril', 5], ['Adamantium, Ebony, Orichalcum', 6]]),
  // PROF4: the woods by their tiers (PROF0 4.2); Smithing's metals and Carpentry's woods by theirs
  logging: Object.freeze([['Pine', 1], ['Oak', 2], ['Cherry', 3], ['Teak', 4], ['Mahogany', 5], ['Ironwood, Ghostwood', 6]]),
  // AUDIT 30 U19: the Spade is rank 10's. PROF7 (FOUND): that note once swallowed Silver, Elven and Dwarven, and Mithril
  smithing: Object.freeze([['Iron; the Wood-Axe, Pick-Axe, Sickle and Skinning Knife', 1], ['Steel; the chain; the Spade', 2],
    ['Silver', 3], ['Elven, Dwarven', 4], ['Mithril', 5], ['Adamantium, Ebony, Orcish; Warforged', 6], ['Daedric', 7]]),
  carpentry: Object.freeze([['Pine: staves, bows, arrows, the Basket, a plain single bed', 1], ['Oak: tables, chairs, a plain double bed', 2],
    ['Cherry: a fancy single bed', 3], ['Teak: a fancy double bed', 4], ['Mahogany', 5], ['Ironwood, Ghostwood: staves and bows', 6]]),
  // PROF7: the hides by their tiers (PROF0 4.4); Outfitting's leathers and cloths by theirs (9.3)
  hunting: Object.freeze([['Rat Pelt', 1], ['Bat Leather, Bear Hide', 2], ['Tiger Pelt, Spider Silk', 3], ['Scorpion Chitin, Slaughterfish Scales', 4],
    ['Harpy Feathers, Dreugh Shell', 5], ['Dragonling Scale', 6]]),
  // AUDIT 32 R4: the skins by their pelt's tier (the Rat's open at 0, the Bat's and the Bear's at 10, the Tiger's at 25),
  // and Standard-bearer's Silk said for what it waits on
  outfitting: Object.freeze([['Linen clothing; the Rat\'s skins; the Fishing-Net', 1], ['Cured Leather armour; Wool clothing, rugs and tapestries; the Bat\'s and the Bear\'s skins', 2],
    ['The Tiger\'s skins', 3], ['Silk clothing', 4], ['Hardened Leather armour; Standard-bearer\'s Silk clothing (its silk comes with the sieges)', 5]]),
  // PROF8: every haul is Raw Fish - the rank sets its XP (a haul is worked at the rank's own tier); the sea's finds need
  // the ground the witnesses confirmed, and no rank
  fishing: Object.freeze([['Raw Fish in any water; a school\'s extra fish; at sea on confirmed ground a Pearl or a Slaughterfish; a trophy', 1]]),
  // PROF11: the bench's two works by their ranks - the cut Rough Stone's (tier 1), the mix Mortar's (tier 2); the
  // Sculptor's stone decor comes with its card at 100
  masonry: Object.freeze([['Cut Stone, from Rough Stone', 1], ['Mortar, from Sulphur, Lead and Rough Stone', 2]]),
  // PROF9: the four dishes by their ranks (9.3; recipeLaw DISHES) - a dish's XP follows the rank, not the dish
  cooking: Object.freeze([['Hunter\'s Stew, Fisherman\'s Supper', 1], ['Orchard Tart', 2], ['Feast of the Hearth', 6]]),
  // PROF10: the jeweller's ladder (recipeLaw JEWEL_METALS) - Silver and the Cloth Amulet at 0, Gold at 25, Platinum at 55,
  // the Wand (its Ironwood or Ghostwood) at 70
  jewelcrafting: Object.freeze([['Silver pieces; the Cloth Amulet', 1], ['Gold pieces', 3], ['Platinum pieces', 5], ['The Wand, in Ironwood or Ghostwood', 6]]),
  // PROF12: the alchemist's ladder (alchemyLaw POTIONS - a potion's tier its DFU price's), DFU's twenty by their ranks
  alchemy: Object.freeze([1, 2, 3, 4, 5, 6, 7].map((t) => Object.freeze([POTIONS.filter((p) => p.tier === t).map((p) => p.name).join(', '), t]))),
});
/** PROF4 (FOUND): Smithing was practised from PROF3 and the page never said so - its cards stood locked. PROF7: Hunting
 *  and Outfitting. */
const PRACTISED = Object.freeze(['herbalism', 'mining', 'hunting', 'fishing', 'logging', 'smithing', 'outfitting', 'carpentry', 'masonry', 'cooking', 'jewelcrafting', 'alchemy', 'enchanting']);   // PROF8: Fishing; PROF11: Masonry; PROF9: Cooking; PROF10: Jewelcrafting; PROF12: Alchemy and Enchanting
/** PROF8: how a haul is made, as the page says it. */
export const FISHING_HOW = 'With a Fishing-Net in your pack, stand in water, swim, or stand at sea, at any hour. Hold the use key to wind the net and let go to throw it; when the floats dip, press it again; then hold it to raise the band over the net\'s weight and let go to lower it - keep the weight inside to fill the net. Cast toward a rising school for an extra fish.';
/** FIELD BUGS 2026-09-30b (TOOL-SAID): how the other three gathering professions gather, as the page says it - the page
 *  said it for Hunting and Fishing alone, and players used the tools from the pack. TOOL-USE: a tool's Use at the node
 *  (the hotbar's, a quick slot's) is the key's; from the pack it only points the way. */
export const GATHER_HOW = Object.freeze({
  herbalism: 'Walk up to an herb patch in the wilderness until the prompt shows, then press the use key: common herbs come by hand, the rest need a Sickle in your pack. With a Basket, the act choice key searches the patch for food instead. Using the Sickle or the Basket from your hotbar or quick slot at the patch is the same as the key - the Sickle picks the herbs, the Basket searches for food. Used from your pack, they only point the way.',
  mining: 'With a Pick-Axe in your pack, walk up to an ore vein or a boulder in the wilderness, or a vein in a dungeon, until the prompt shows, then press the use key. Using the Pick-Axe from your hotbar or quick slot there is the same as the key. Used from your pack, it only points the way.',
  logging: 'With a Wood-Axe in your pack, walk up to a tree in the wilderness until the prompt shows, then press the use key. Only some trees in each area can be felled each day. Using the Wood-Axe from your hotbar or quick slot there is the same as the key. Used from your pack, it only points the way.',
});
/** TOOL-SAID: the empty Stores say where their goods come from - a node's act (TOOL-USE: the key's, or the tool's Use
 *  there), never a tool used from the pack. */
export const STORES_EMPTY_LINE = 'Your Stores are empty. What you gather online is kept here: press the use key at an herb patch, a tree, an ore vein or a boulder, a body you felled, or in water with a net - or use the Sickle, Basket, Pick-Axe, Wood-Axe, Skinning Knife or Fishing-Net from your hotbar or quick slot there. A tool used from your pack gathers nothing: it only points the way.';   // TOUCH-HOLD: the knife's Use
/** PROF12: how Alchemy is practised, as the Professions page says it. */
export const ALCHEMY_HOW = 'Alchemy is brewed at an alchemy station - an Alchemist\'s, or your own home\'s - from your Stores: Daggerfall\'s own twenty recipes, their herbs, metals and gems gathered, the rest from the Apothecaries\' counter. Daggerfall\'s potion maker, with the ingredients in your pack, stays as it was and earns nothing here.';
/** PROF12: how Enchanting is practised, and what its rank takes off the item maker's gold. */
export const ENCHANTING_HOW = (pct) => `Enchanting rises by disenchanting crafted pieces into Arcane Essence at an enchanting station - a Mages Guild hall, or your own home's. Daggerfall's item maker stays as it was${pct > 0 ? `; your rank takes ${pct}% off its gold` : '; from Journeyman your rank takes a share off its gold'}.`;
/** PROF12: ENCHANTING'S LAYER OVER DFU'S ITEM MAKER (9.3) - the share off its gold, percent: online, the professions this
 *  account's, by the Enchanting track's rank (and an Efficient's at 50); none else. The item maker reads it (worldModes). */
export function enchantGoldPct() {
  if (!profPagesShown()) return 0;
  const t = _provider?.book?.track?.('enchanting');
  return enchantDiscountPct(t?.rank ?? 0, t?.specs?.[50] ?? null);
}
/** A craft practised in part - what raises it now (none since PROF4: Smithing's is whole). */
const PARTLY = Object.freeze({});

/** The line a track's XP makes: "11,900 / 12,250 XP" to the next rank, or the Master's total. */
export function xpLine(track) {
  if (track.rank >= PROF_RANK_MAX) return `${track.xp.toLocaleString('en-US')} XP - Master`;
  return `${track.xp.toLocaleString('en-US')} / ${xpForRank(track.rank + 1).toLocaleString('en-US')} XP`;
}
/** How many crafts stand above Journeyman (PROF0 3.2's limit). */
export const craftsAboveJourneyman = (tracks) => PROFESSIONS.filter((p) => p.kind === 'crafting' && (tracks.get(p.id)?.rank ?? 0) > JOURNEYMAN_RANK).length;

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
    list.append(divider(group === 'gathering' ? 'Gathering' : 'Crafting'));
    for (const prof of PROFESSIONS.filter((x) => x.kind === group)) {
      const t = book.track(prof.id);
      const row = el('button', `prof-row${prof.id === _sel ? ' on' : ''}`);
      row.type = 'button';
      row.append(el('span', 'prof-name', prof.name), el('span', 'prof-rank', `${rankName(t.rank)} ${t.rank}`));
      const floor = xpForRank(t.rank), next = xpForRank(Math.min(PROF_RANK_MAX, t.rank + 1));
      row.append(meter(t.rank >= PROF_RANK_MAX ? 1 : t.xp - floor, t.rank >= PROF_RANK_MAX ? 1 : next - floor, ''));
      row.onclick = () => { _sel = prof.id; _armed = null; rerender(); };
      list.append(row);
    }
  }
  const pane = el('div', 'prof-pane');
  const t = book.track(_sel);
  const title = el('div', 'prof-title');
  title.append(el('h3', null, professionName(_sel)), el('span', 'prof-rankline', t.rank >= PROF_RANK_MAX ? 'Master 100' : `${rankName(t.rank)}  ${t.rank} -> ${t.rank + 1}`));
  pane.append(title, el('p', 'prof-xp', xpLine(t)));
  const practised = PRACTISED.includes(_sel);
  if (!practised) pane.append(el('p', 'px-note', PARTLY[_sel] ?? 'This profession is not practised in the Bay yet.'));
  if (_sel === 'hunting') {
    // PROF7: Hunting's day is the account's (PROF0 6) - its hides, every character's together, and the rare ones
    const h = book.state.hunt ?? { hides: 0, high: 0 };
    pane.append(el('p', 'prof-today', `Today: ${h.hides} of ${book.state.caps?.hides ?? HIDES_PER_DAY} hides, ${h.high} of ${book.state.caps?.highHides ?? HIGH_HIDES_PER_DAY} of tiers 5-6 - your account's, across your characters`));
    // TOUCH-HOLD: the knife's Use, as the Sickle's - it holds the knife, so the line is drawn with no key held
    pane.append(el('p', 'px-note', 'A body your own blow felled, with a Skinning Knife in your pack: the act choice key searches it instead. Hold the use key on the first point of the line and draw the knife along it - or use the Skinning Knife from your hotbar or quick slot at the body: it holds the knife for you, and you draw the line by looking.'));
  } else if (_sel === 'fishing') {
    // PROF8: Fishing's day is the account's too (PROF0 6) - its hauls, every character's together
    pane.append(el('p', 'prof-today', `Today: ${book.state.hauls ?? 0} of ${book.state.caps?.hauls ?? HAULS_PER_DAY} hauls - your account's, across your characters`));
    pane.append(el('p', 'px-note', FISHING_HOW));
  } else if (_sel === 'enchanting') {
    // PROF12: Enchanting's layer said where its rank is read - the item maker's gold, and what raises it
    pane.append(el('p', 'px-note', ENCHANTING_HOW(enchantDiscountPct(t.rank, t.specs?.[50] ?? null))));
  } else if (_sel === 'alchemy') {
    pane.append(el('p', 'px-note', ALCHEMY_HOW));
  } else if (PROFESSIONS.find((x) => x.id === _sel)?.kind === 'gathering' && practised) {
    pane.append(el('p', 'prof-today', `Today: ${book.state.today?.[_sel] ?? 0} of ${book.state.caps?.harvests ?? HARVESTS_PER_DAY} harvests`));
    if (GATHER_HOW[_sel]) pane.append(el('p', 'px-note', GATHER_HOW[_sel]));   // TOOL-SAID
  }
  // THE SPECIALISATIONS: two cards a rank, the chosen one lit; a change of mind pressed twice
  for (const r of SPEC_RANKS) {
    pane.append(divider(`At ${r}`));
    const cards = el('div', 'prof-specs');
    const chosen = t.specs?.[r] ?? null;
    for (const s of SPECIALISATIONS[_sel][r]) {
      const card = el('button', `prof-spec${chosen === s.id ? ' on' : ''}${t.respec?.to === s.id && t.respec?.rank === r ? ' coming' : ''}`);
      card.type = 'button';
      card.append(el('b', null, s.name), el('span', null, s.text));
      const locked = t.rank < r || !practised || !!s.later;   // AUDIT 29 A17: a choice whose slice is to come is named, never chosen
      card.disabled = locked || chosen === s.id || !!t.respec;
      if (s.later) card.append(el('i', 'prof-cost', LATER_WORDS[s.later] ?? 'Comes with a later work'));
      const armedHere = _armed === `${r}|${s.id}`;
      if (!locked && chosen && chosen !== s.id && !t.respec) card.append(el('i', 'prof-cost', armedHere ? `Press again: ${RESPEC.marks.toLocaleString('en-US')} silver, in effect in ${RESPEC.days} days` : `Change: ${RESPEC.marks.toLocaleString('en-US')} silver`));
      if (t.respec?.to === s.id && t.respec?.rank === r) card.append(el('i', 'prof-cost', `In effect from ${new Date(t.respec.at * 1000).toUTCString().slice(0, 16)}`));
      card.onclick = async () => {
        if (chosen && !armedHere) { _armed = `${r}|${s.id}`; rerender(); return; }
        _armed = null;
        const res = await book.choose(_sel, r, s.id);
        _profWord = res?.ok ? null : accountRefusalText(res?.error);
        rerender();
      };
      cards.append(card);
    }
    if (t.rank < r) cards.append(el('p', 'px-note', `Chosen at ${r}.`));
    pane.append(cards);
  }
  if (_profWord) pane.append(el('p', 'prof-word', _profWord));
  if (UNLOCKS[_sel]) {
    pane.append(divider('Unlocks'));
    for (const [what, tier] of UNLOCKS[_sel]) {
      const r = el('div', `px-stat${t.rank >= TIER_RANKS[tier - 1] ? '' : ' prof-locked'}`);
      r.append(el('span', 'k', what), el('span', 'v', `rank ${TIER_RANKS[tier - 1]}`));
      pane.append(r);
    }
  }
  pane.append(el('p', 'prof-limit', `Crafts above Journeyman: ${craftsAboveJourneyman(book.state.tracks)} of ${CRAFTS_ABOVE_JOURNEYMAN}`));
  // GENTLE ACTS (PROF0 5.1): the accessibility choice, beside the acts it changes
  const gentle = el('label', 'prof-gentle');
  const box = el('input');
  box.type = 'checkbox';
  box.checked = getPref('gentleActs') === true;
  box.onchange = () => { setPref('gentleActs', !!box.checked); rerender(); };
  gentle.append(box, document.createTextNode(' Gentle acts - every act completes plainly: no bruise, no glint to find, and no clean bonus'));
  pane.append(gentle);
  cols.append(list, pane);
  detail.append(cols);
}

/** The Stores' materials as the page lists them: filtered by family and search, sorted by tier, name or count. */
export function storesRows(stores, { family = null, query = '', sort = 'tier' } = {}, nameOf = (k) => k) {
  const q = String(query ?? '').trim().toLowerCase();
  const rows = [...stores.values()].map((s) => {
    const m = material(s.material);
    return { ...s, name: nameOf(s.material), family: m?.family ?? null, tier: m?.tier ?? 0, value: m?.value ?? 0, total: s.own + s.bought + (s.gold | 0) };   // GOLD-MARKET: what gold bought is held too
  }).filter((r) => r.total > 0 && (!family || r.family === family) && (!q || r.name.toLowerCase().includes(q)));
  const byName = (a, b) => a.name.localeCompare(b.name);
  rows.sort(sort === 'name' ? byName : sort === 'count' ? (a, b) => (b.total - a.total) || byName(a, b) : (a, b) => (a.tier - b.tier) || byName(a, b));
  return rows;
}

/** A Stores card's split: own, bought and (GOLD-MARKET) bought with gold - "own" alone where nothing was bought. */
export function storesSplit(r) {
  const gold = r.gold | 0;
  if (!gold) return r.bought ? `${r.own} own · ${r.bought} bought` : 'own';
  return [r.own ? `${r.own} own` : null, r.bought ? `${r.bought} bought` : null, `${gold} bought with gold`].filter(Boolean).join(' · ');
}
/** GOLD-MARKET: what the page says of a material gold bought (Professions-Arc 10.8's wall). */
export const GOLD_GOODS_LINE = 'Bought with gold: to your pack, or back on the market for gold. No station, craft, writ or silver sale takes it.';

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
  if ((book.pendingWithdrawals || book.pendingCrafts) && p.settle && Date.now() - _stores.settledAt > 30_000) { _stores.settledAt = Date.now(); p.settle().then(rerender, () => {}); }
  const head = el('div', 'prof-storehead');
  const search = el('input', 'prof-search');
  search.type = 'search'; search.placeholder = 'Search'; search.value = _stores.query;
  search.setAttribute?.('data-focus', 'stores-search');
  search.oninput = () => {
    _stores.query = search.value;
    rerender();   // AUDIT 32 P13: the window keeps the caret where the typing left it (P3) - this put it at the end every key
  };
  const sort = el('select', 'prof-sort');
  for (const [v, w] of [['tier', 'Sort by tier'], ['name', 'Sort by name'], ['count', 'Sort by count']]) { const o = el('option', null, w); o.value = v; if (v === _stores.sort) o.selected = true; sort.append(o); }
  sort.onchange = () => { _stores.sort = sort.value; rerender(); };
  head.append(search, sort);
  const fams = el('div', 'prof-families');
  for (const [id, word] of [[null, 'All'], ...MATERIAL_FAMILIES]) {
    const b = el('button', `prof-family${_stores.family === id ? ' on' : ''}`, word);
    b.type = 'button';
    b.onclick = () => { _stores.family = id; rerender(); };
    fams.append(b);
  }
  detail.append(divider('The Stores'), head, fams);
  const rows = storesRows(book.state.stores, _stores, p.name);
  const grid = el('div', 'prof-grid');
  if (!rows.length) grid.append(el('p', 'px-note', book.state.stores.size ? 'Nothing in the Stores matches.' : STORES_EMPTY_LINE));
  for (const r of rows) {
    const card = el('button', `prof-mat${_stores.picked === r.material ? ' on' : ''}`);
    card.type = 'button';
    card.append(el('b', null, r.name), el('span', 'prof-count', r.total.toLocaleString('en-US')), el('span', 'prof-split', storesSplit(r)));
    card.onclick = () => { _stores.picked = r.material; _stores.qty = Math.min(_stores.qty, r.total) || 1; _stores.word = null; rerender(); };
    grid.append(card);
  }
  detail.append(grid);
  const pick = rows.find((r) => r.material === _stores.picked);
  if (pick) {
    const bar = el('div', 'prof-matbar');
    bar.append(el('span', 'prof-matline', `${pick.name} x${pick.total} - tier ${pick.tier} - ${pick.value} silver each`));
    const qty = el('input', 'prof-qty');
    qty.type = 'number'; qty.min = '1'; qty.max = String(Math.min(WITHDRAW_MAX, pick.total)); qty.value = String(Math.min(_stores.qty, pick.total, WITHDRAW_MAX));
    qty.oninput = () => { _stores.qty = Math.max(1, Math.min(WITHDRAW_MAX, pick.total, Math.floor(Number(qty.value) || 1))); };
    const go = el('button', 'act primary', _stores.busy ? 'Sending...' : 'Withdraw to pack');
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
      ? 'Withdrawn, a material is an item in your pack and never goes back into the Stores. Writs are delivered at a Notice Board\'s Work tab.'
      : pick.family === 'essences' ? ESSENCE_STAYS_LINE : pick.family === 'siege' ? SIEGE_STAYS_LINE : STOCK_STAYS_LINE));   // SEAT2b part two: a siege work's road
    if ((pick.gold | 0) > 0) detail.append(el('p', 'px-note', GOLD_GOODS_LINE));
  }
  if (_stores.word) detail.append(el('p', 'prof-word', _stores.word));
  drawForge(detail, rerender, kit);
  drawAnvil(detail, rerender, kit);   // PROF3
  drawWorkbench(detail, rerender, kit);   // PROF4
  drawLoom(detail, rerender, kit);   // PROF7
  drawMasonBench(detail, rerender, kit);   // PROF11
  drawCookFire(detail, rerender, kit);   // PROF9
  drawJewellerBench(detail, rerender, kit);   // PROF10
  drawAlchemyStation(detail, rerender, kit);   // PROF12
  drawEnchantingStation(detail, rerender, kit);   // PROF12
}

/** What the Stores make of a recipe now: the most it can smelt (every input's units over its need), to SMELT_MAX. */
export function smeltable(r, held) {
  let n = SMELT_MAX;
  for (const inp of r.inputs) n = Math.min(n, Math.floor(held(inp.key) / inp.n));
  return Math.max(0, n);
}

/**
 * A forge's or a workbench's rows of no-act work (PROF2's smelts; PROF4's burns and saws): each recipe's inputs as the
 * Stores hold them, how many it can make, a count and its button - its yield a unit said where it is more than one.
 */
function workRows(detail, rerender, el, recipes, state, verb, busyVerb, go, short = null, hold = false) {
  const p = /** @type {ProfPagesProvider} */ (_provider);
  const book = p.book;
  const held = (k) => book.held(k);
  for (const r of recipes) {
    const most = smeltable(r, held);
    const row = el('div', `prof-smelt${most ? '' : ' prof-locked'}`);
    // PROF7: the choice that raises a work is read at its own rank - a Tanner's at 50
    const per = workPer(r, r.more ? { [r.more.profession]: book.track(r.more.profession)?.specs?.[workSpecRank(r)] ?? null } : {});
    const ins = r.inputs.map((inp) => `${inp.n} ${p.name(inp.key)} (${held(inp.key)})`).join(' + ');
    row.append(el('b', null, `${p.name(r.out)}${per > 1 ? ` x${per}` : ''}`), el('span', 'prof-split', ins));
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
    detail.append(row);
  }
}

/**
 * COUNTER-GATES (AUDIT 2026-10-01 part four): A COUNTER'S BUY, ONE HOME - the loom's AUDIT 32 P6 law for every counter:
 * offered only while Marks are struck, the price held or said before the press (the anvil's and the workbench's offered
 * it whatever the balance, and with Marks shut, and refused it after). `state` the station's page state (its `busy`, its
 * `word`); `who` the counter as the button names it; `counter` the Weavers' own door, where the stock is theirs.
 * @param {HTMLElement} line
 */
function counterBuy(line, { el, p, state, rerender, key, need, sale, who, counter = null }) {
  if (!p.stock || p.marksOpen?.() === false) return;
  const balance = p.marks?.() ?? null;
  const shortOf = Number.isSafeInteger(balance) && balance < sale.marks * need;
  const buy = el('button', 'act', `Buy ${need} from ${who} - ${sale.marks * need} silver`);
  buy.type = 'button';
  buy.disabled = state.busy || shortOf;
  if (shortOf) line.append(el('span', 'prof-split', `you hold ${marksText(balance)}`));   // AUDIT 32 R13: "1 Drake"
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
  detail.append(divider('The Forge'));
  if (!forge) {
    detail.append(el('p', 'px-note', `Smelting is done at a forge: a Weaponsmith's or an Armorer's (${FORGE_FEE} gold a smelt), or your own home's forge.`));
    return;
  }
  detail.append(el('p', 'px-note', forge.kind === 'shop' ? `The smith's forge - ${forge.fee} gold a smelt.` : 'Your forge.'));
  const short = purseShort(forge, 'smith', 'a smelt');
  if (short) detail.append(el('p', 'px-note prof-short', short));
  workRows(detail, rerender, el, SMELT_RECIPES, _forge, 'Smelt', 'Smelting...', (id, n) => p.smelt(id, n), short);
  // PROF4: the logs a forge burns - those the Stores hold (a log a Charcoal; a Charcoal Burner's two)
  const burns = BURN_RECIPES.filter((r) => book.held(r.inputs[0].key) > 0);
  if (burns.length) workRows(detail, rerender, el, burns, _forge, 'Burn', 'Burning...', (id, n) => p.smelt(id, n), short);
  if (r0Charcoal(book)) {
    const line = el('p', 'px-note', 'Steel wants Charcoal: a log burns to it here (Logging\'s), and the smith sells it.');
    // CHARCOAL-BUY (AUDIT 2026-10-01 part four): and here is where - the smith's stock was bought only on an anvil
    // recipe short of an input, and no anvil recipe takes Charcoal, so its counter never stood: a smith who fells no
    // tree smelted no Steel. At a smith's forge, the Charcoal a Steel smelt asks, from the counter
    const sale = stockOf('wood:charcoal');
    const steel = SMELT_RECIPES.find((r) => r.inputs.some((i) => i.key === 'wood:charcoal'));
    const need = steel?.inputs.find((i) => i.key === 'wood:charcoal')?.n ?? 1;
    if (sale && forge.kind === 'shop') counterBuy(line, { el, p, state: _forge, rerender, key: 'wood:charcoal', need, sale, who: 'the smith' });
    detail.append(line);
  }
  if (_forge.word) detail.append(el('p', 'prof-word', _forge.word));
}
/** Whether the Steel line needs its word: no Charcoal held. */
const r0Charcoal = (book) => book.held('wood:charcoal') < 1;

// ─── PROF3: THE ANVIL (bible/06-Systems/Professions-Arc.md 9, 24) ─────

/** The anvil's families, in its row's order, and the metals a family is made in. */
export const ANVIL_FAMILIES = Object.freeze([['weapons', 'Weapons'], ['armour', 'Armour'], ['tools', 'Tools'], ['kits', 'Repair Kits']]);
const METAL_ROW = Object.freeze([
  ['ingot:iron', 'Iron'], ['ingot:steel', 'Steel'], ['ingot:silver', 'Silver'], ['ingot:moonstone', 'Elven'], ['ingot:dwarven', 'Dwarven'],
  ['ingot:mithril', 'Mithril'], ['ingot:adamantium', 'Adamantium'], ['ingot:ebony', 'Ebony'], ['ingot:orichalcum', 'Orcish'],
  ['ingot:daedric', 'Daedric'], ['ingot:warforged', 'Warforged'],
]);
/** The recipes the anvil lists for a family at a metal (the tools are Iron's alone; the chain is Steel's). */
export const anvilRecipes = (family, metal) => RECIPES.filter((r) => r.profession === 'smithing' && r.family === family && (family === 'tools' || r.metal === metal));
/** PROF4: what a craft spends as this character would spend it - a Joiner's half the planks, a Heartwood for one. */
const spendsOf = (r, book, heartwood) => recipeInputs(r, { heartwood: heartwood && takesHeartwood(r), joiner: book.track(r.profession)?.specs?.[50] === 'joiner' });
/** Whether the Stores make a recipe now - its inputs, or (PROF4) what it would spend (`inputs`). */
export const craftable = (r, held, inputs = r.inputs) => inputs.every((inp) => held(inp.key) >= inp.n);

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
  detail.append(divider('The Anvil'));
  if (!forge) {
    endHeat();
    detail.append(el('p', 'px-note', `Smithing is done at an anvil, beside a forge: a Weaponsmith's or an Armorer's (${FORGE_FEE} gold a craft), or your own home's forge.`));
    return;
  }
  const rank = book.track('smithing')?.rank ?? 0;
  const specs = book.track('smithing')?.specs ?? {};
  detail.append(el('p', 'px-note', `${forge.kind === 'shop' ? `The smith's anvil - ${forge.fee} gold a craft.` : 'Your anvil.'} Smithing ${rank} (${rankName(rank)}).`));
  const short = purseShort(forge, 'smith', 'a craft');
  if (short) detail.append(el('p', 'px-note prof-short', short));
  // AUDIT 30 A2: Gentle acts switched on under a heat lets it cool - nothing is spent, and the craft is a plain one
  if (_anvil.act && getPref('gentleActs') === true) { _anvil.act.cancel(); endHeat(); _anvil.word = 'You let the ingot cool; nothing is spent.'; }
  // AUDIT 30 A3: nothing else is picked while the heat is struck - the heat makes the recipe it began on
  const striking = !!_anvil.act;
  const held = (k) => book.held(k);
  const fams = el('div', 'prof-families');
  for (const [id, word] of ANVIL_FAMILIES) {
    const b = el('button', `prof-family${_anvil.family === id ? ' on' : ''}`, word);
    b.type = 'button';
    b.disabled = striking;
    b.onclick = () => { _anvil.family = id; _anvil.picked = null; rerender(); };
    fams.append(b);
  }
  detail.append(fams);
  if (_anvil.family !== 'tools') {
    const metals = el('div', 'prof-families prof-metals');
    for (const [id, word] of METAL_ROW) {
      if (_anvil.family === 'kits' && id === 'ingot:warforged') continue;
      const b = el('button', `prof-family${_anvil.metal === id ? ' on' : ''}`, word);
      b.type = 'button';
      b.disabled = striking;
      b.onclick = () => { _anvil.metal = id; _anvil.picked = null; rerender(); };
      metals.append(b);
    }
    detail.append(metals);
  }
  const list = anvilRecipes(_anvil.family, _anvil.metal);
  for (const r of list) {
    const open = recipeOpen(r, rank);
    const can = open && craftable(r, held, spendsOf(r, book, false));
    const row = el('button', `prof-recipe${_anvil.picked === r.id ? ' on' : ''}${can ? '' : ' prof-locked'}`);
    row.type = 'button';
    row.disabled = striking;
    row.append(el('b', null, r.name), el('span', 'prof-split', open ? (can ? 'can make now' : 'wants its inputs') : `rank ${r.rank}`));
    row.onclick = () => { _anvil.picked = r.id; rerender(); };
    detail.append(row);
  }
  const r = list.find((x) => x.id === _anvil.picked);
  if (r) {
    const box = el('div', 'prof-craft');
    box.append(el('b', null, `${r.name} - rank ${r.rank}`));
    const spends = spendsOf(r, book, _anvil.heartwood);
    for (const inp of spends) {
      const have = held(inp.key);
      const line = el('div', `prof-input${have >= inp.n ? '' : ' prof-short'}`);
      line.append(el('span', null, `${p.name(inp.key)} ${Math.min(have, inp.n)} / ${inp.n} (${have} stored)`));
      const sale = stockOf(inp.key);
      if (sale && have < inp.n && forge.kind === 'shop') counterBuy(line, { el, p, state: _anvil, rerender, key: inp.key, need: inp.n - have, sale, who: 'the smith' });   // COUNTER-GATES
      box.append(line);
    }
    if (takesQuality(r) && recipeOpen(r, rank)) {
      const odds = qualityOdds(rank - r.rank, { masterwright: specs[100] === 'masterwright' });
      box.append(el('p', 'px-note', `Your rank ${rank}, margin ${rank - r.rank}: ${odds.map((o, q) => (o ? `${QUALITY_NAMES[q]} ${o}` : null)).filter(Boolean).join(' | ')}. A clean heat is a step better.`));
    } else if (!takesQuality(r)) box.append(el('p', 'px-note', 'A Repair Kit mends a quarter of a piece\'s condition, up to three quarters, once - a weapon or armour of its metal.'));
    heartwoodToggle(box, el, r, book, _anvil, rerender, striking);   // PROF4: a Heartwood for a plank - the axes, hammers, shields, the Spade
    const gentle = getPref('gentleActs') === true;
    const elsewhere = handsAt(_anvil);   // AUDIT 32 P2
    if (elsewhere && !_anvil.act) box.append(el('p', 'px-note', `Your hands are at ${elsewhere} - finish there first.`));
    const ready = recipeOpen(r, rank) && craftable(r, held, spends) && !_anvil.busy && !_anvil.crafting && !_anvil.act && !elsewhere && !short;
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
      const hit = actButton(el, 'Strike', (e) => _anvil.strike?.(e));   // AUDIT 32 P1
      const cancel = el('button', 'act', 'Let it cool');
      cancel.type = 'button';
      cancel.onclick = () => { _anvil.act?.cancel(); endHeat(); _anvil.word = 'You let the ingot cool; nothing is spent.'; rerender(); };
      panel.append(el('span', 'prof-heatword', 'The heat - strike while the glow is in the band (Space)'), bar, marks, hit, cancel);
      box.append(panel);
      _anvil.els = { bar, marker, marks: dots, hit };
      if (!_anvil.off) _anvil.strike = heatLoop(rerender, craftOf(_anvil.actRecipe ?? r.id, _anvil.actRecipe ? _anvil.actWood : _anvil.heartwood && takesHeartwood(r)));
    } else {
      const go = el('button', 'act primary', _anvil.crafting ? 'At the anvil...' : 'Craft');
      go.type = 'button';
      go.disabled = !ready;
      go.onclick = () => {
        if (gentle) { void finish(false); return; }   // Gentle acts: a plain craft, no heat
        _anvil.act = createHeatAct({ band: p.heatBand?.() ?? 1 });
        _anvil.actRecipe = r.id; _anvil.actWood = _anvil.heartwood && takesHeartwood(r);
        rerender();
      };
      const quick = el('button', 'act', 'Quick craft');
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
  const have = book.held('wood:heartwood');
  if (have < 1) { state.heartwood = false; return; }
  const lab = el('label', 'prof-gentle');
  const cb = el('input');
  cb.type = 'checkbox';
  cb.checked = state.heartwood === true;
  cb.disabled = locked;   // AUDIT 30 A3: the act under way keeps the wood it began with
  cb.onchange = () => { state.heartwood = !!cb.checked; rerender(); };
  lab.append(cb, globalThis.document.createTextNode(` Use a Heartwood for a plank - a step better (${have} stored)`));
  box.append(lab);
}
/** The workbench's families, in its row's order: staves and bows by wood, the arrows, the furniture by wood, the Basket,
 *  the Ram Kit. */
export const BENCH_FAMILIES = Object.freeze([['staves', 'Staves'], ['bows', 'Bows'], ['arrows', 'Arrows'], ['furniture', 'Furniture'], ['tools', 'Tools'], ['siege', 'Siege']]);
/** The woods a family is shown by - every wood for the staves and bows, DFU's furniture's four and the beds' for the
 *  furniture; none for the rest. */
const WOODS_OF = Object.freeze({ staves: WOODS.map((w) => `plank:${w.id}`), bows: WOODS.map((w) => `plank:${w.id}`), furniture: ['plank:pine', 'plank:oak', 'plank:cherry', 'plank:mahogany', 'plank:teak'] });
/** The recipes the workbench lists for a family at a wood. */
export const benchRecipes = (family, wood) => RECIPES.filter((r) => r.profession === 'carpentry' && r.family === family && (!WOODS_OF[family] || r.wood === wood));
/** What the plane's board says of its act, for the page and the pins. */
export const planeWord = (rep) => (rep ? (rep.clean ? 'A clean pass - true to the grain.' : rep.seconds < PLANE_ACT.minS ? 'Too quick - a plane is drawn, not flicked.' : rep.seconds > PLANE_ACT.maxS ? 'Too slow - the stroke wandered.' : 'The plane strayed from the grain.') : '');

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
 * workbench: a Furniture Store's, its fee a craft or a saw, or the player's own home's.
 * @param {HTMLElement} detail @param {() => void} rerender @param {{ el: Function, divider: (w: string) => HTMLElement }} kit
 */
function drawWorkbench(detail, rerender, { el, divider }) {
  const p = _provider;
  if (!p?.workbench || !p.craft || !p.smelt) return;
  const book = p.book;
  const bench = p.workbench();
  detail.append(divider('The Workbench'));
  if (!bench) {
    _bench.act?.cancel(); _bench.act = null; _bench.actRecipe = null;
    detail.append(el('p', 'px-note', `Carpentry is done at a workbench: a Furniture Store's (${WORKBENCH_FEE} gold a craft or a saw), or your own home's.`));
    return;
  }
  const rank = book.track('carpentry')?.rank ?? 0;
  detail.append(el('p', 'px-note', `${bench.kind === 'shop' ? `The furnisher's workbench - ${bench.fee} gold a craft or a saw.` : 'Your workbench.'} Carpentry ${rank} (${rankName(rank)}).`));
  const short = purseShort(bench, 'furnisher', 'a craft or a saw');
  if (short) detail.append(el('p', 'px-note prof-short', short));
  // AUDIT 30 A2: Gentle acts switched on under a pass sets the plane down - nothing spent, the craft a plain one
  if (_bench.act && getPref('gentleActs') === true) { _bench.act.cancel(); _bench.act = null; _bench.actRecipe = null; _bench.word = 'You set the plane down; nothing is spent.'; }
  const planing = !!_bench.act;   // AUDIT 30 A3: nothing else picked while the plane is drawn
  // THE SAW: the logs the Stores hold, to planks (a Timberwright's three)
  const saws = SAW_RECIPES.filter((r) => book.held(r.inputs[0].key) > 0);
  if (saws.length) workRows(detail, rerender, el, saws, _bench, 'Saw', 'Sawing...', (id, n) => p.smelt(id, n), short, !!_bench.act);   // AUDIT 32 P5: held while planing
  else detail.append(el('p', 'px-note', 'A log saws to two planks here. Logs come from the woods (Logging).'));
  const held = (k) => book.held(k);
  const fams = el('div', 'prof-families');
  for (const [id, word] of BENCH_FAMILIES) {
    const b = el('button', `prof-family${_bench.family === id ? ' on' : ''}`, word);
    b.type = 'button';
    b.disabled = planing;
    b.onclick = () => { _bench.family = id; _bench.picked = null; if (WOODS_OF[id] && !WOODS_OF[id].includes(_bench.wood)) _bench.wood = WOODS_OF[id][0]; rerender(); };
    fams.append(b);
  }
  detail.append(fams);
  if (WOODS_OF[_bench.family]) {
    const woods = el('div', 'prof-families prof-metals');
    for (const id of WOODS_OF[_bench.family]) {
      const b = el('button', `prof-family${_bench.wood === id ? ' on' : ''}`, p.name(id).replace(/ Plank$/, ''));
      b.type = 'button';
      b.disabled = planing;
      b.onclick = () => { _bench.wood = id; _bench.picked = null; rerender(); };
      woods.append(b);
    }
    detail.append(woods);
  }
  const list = benchRecipes(_bench.family, _bench.wood);
  if (!list.length) detail.append(el('p', 'px-note', 'Nothing of that wood.'));
  for (const r of list) {
    const open = recipeOpen(r, rank);
    const can = open && craftable(r, held, spendsOf(r, book, false));
    const row = el('button', `prof-recipe${_bench.picked === r.id ? ' on' : ''}${can ? '' : ' prof-locked'}`);
    row.type = 'button';
    row.disabled = planing;
    row.append(el('b', null, r.name), el('span', 'prof-split', r.later ? LATER_WORDS.SEAT2 : open ? (can ? 'can make now' : 'wants its inputs') : `rank ${r.rank}`));
    row.onclick = () => { _bench.picked = r.id; rerender(); };
    detail.append(row);
  }
  const r = list.find((x) => x.id === _bench.picked);
  if (r) {
    const box = el('div', 'prof-craft');
    box.append(el('b', null, `${r.name} - rank ${r.rank}`));
    const spends = spendsOf(r, book, _bench.heartwood);
    for (const inp of spends) {
      const have = held(inp.key);
      const line = el('div', `prof-input${have >= inp.n ? '' : ' prof-short'}`);
      line.append(el('span', null, `${p.name(inp.key)} ${Math.min(have, inp.n)} / ${inp.n} (${have} stored)`));
      const sale = stockOf(inp.key);
      if (sale?.counter === 'furnisher' && have < inp.n && bench.kind === 'shop') counterBuy(line, { el, p, state: _bench, rerender, key: inp.key, need: inp.n - have, sale, who: 'the furnisher' });   // COUNTER-GATES
      box.append(line);
    }
    if (r.later) box.append(el('p', 'px-note', 'Comes with a later work.'));   // a recipe named before its slice (none since SEAT2b part two)
    else if (r.kind === 'siege') box.append(el('p', 'px-note', 'A Ram Kit goes to your Stores - a seat writ carries it to your guild\'s Siege Camp, and a camp that wins a Right of Siege sends it to the battle where a Gatehouse stands.'));   // SEAT2b part two: a siege work's road
    else if (r.kind === 'arrows') box.append(el('p', 'px-note', `Twenty arrows, one quiver - an arrow takes no quality.`));
    else if (r.family === 'furniture') box.append(el('p', 'px-note', 'Furniture goes among your things, to set down in a room of your own (Decorate).'));
    if (takesQuality(r) && recipeOpen(r, rank)) {
      const odds = qualityOdds(rank - r.rank, { masterwright: false });
      box.append(el('p', 'px-note', `Your rank ${rank}, margin ${rank - r.rank}: ${odds.map((o, q) => (o ? `${QUALITY_NAMES[q]} ${o}` : null)).filter(Boolean).join(' | ')}. A clean pass of the plane is a step better.`));
    }
    heartwoodToggle(box, el, r, book, _bench, rerender, planing);
    const gentle = getPref('gentleActs') === true;
    const elsewhere = handsAt(_bench);   // AUDIT 32 P2
    if (elsewhere && !_bench.act) box.append(el('p', 'px-note', `Your hands are at ${elsewhere} - finish there first.`));
    const ready = !r.later && recipeOpen(r, rank) && craftable(r, held, spends) && !_bench.busy && !_bench.crafting && !_bench.act && !elsewhere && !short;
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
      panel.append(el('span', 'prof-heatword', 'The plane - press at the board\'s head and draw along the grain to its foot'));
      const planed = craftOf(_bench.actRecipe ?? r.id, _bench.actRecipe ? _bench.actWood : _bench.heartwood && takesHeartwood(r));
      panel.append(planeBoard(el, _bench.act, (clean, rep) => { void planed(clean, rep); }, rerender));
      if (_bench.act.state.slips) panel.append(el('span', 'prof-split', `let go ${_bench.act.state.slips} time${_bench.act.state.slips === 1 ? '' : 's'} - start again at the head`));
      const cancel = el('button', 'act', 'Set the plane down');
      cancel.type = 'button';
      cancel.onclick = () => { _bench.act?.cancel(); _bench.act = null; _bench.actRecipe = null; _bench.word = 'You set the plane down; nothing is spent.'; rerender(); };
      panel.append(cancel);
      box.append(panel);
    } else {
      const go = el('button', 'act primary', _bench.crafting ? 'At the workbench...' : 'Craft');
      go.type = 'button';
      go.disabled = !ready;
      go.onclick = () => {
        if (gentle) { void finish(false); return; }   // Gentle acts: a plain craft, no plane
        _bench.act = createPlaneAct({ rank, band: p.planeBand?.() ?? 1 });
        _bench.actRecipe = r.id; _bench.actWood = _bench.heartwood && takesHeartwood(r);
        rerender();
      };
      const quick = el('button', 'act', 'Quick craft');
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
export const LOOM_FAMILIES = Object.freeze([['leather', 'Leather'], ['clothing', 'Clothing'], ['furnishings', 'Furnishings'], ['tools', 'Tools']]);
/** DFU's two clothing groups, as the loom's row names them. */
const CLOTHING_ROW = Object.freeze([['MensClothing', 'Men\'s'], ['WomensClothing', 'Women\'s']]);
/** The recipes the loom lists for a family - a garment of the cloth and the group shown. */
export const loomRecipes = (family, cloth, clothing) => RECIPES.filter((r) => r.profession === 'outfitting' && r.family === family
  && (family !== 'clothing' || (r.cloth === cloth && r.group === clothing)));
/** A dye's name as the loom says it ("Dark Brown"). */
export const dyeWord = (dye) => String(DYE_NAMES[dye] ?? dye).replace(/([a-z])([A-Z])/g, '$1 $2');

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
  detail.append(divider('The Loom'));
  if (!loom) {
    endStitch();
    detail.append(el('p', 'px-note', `Outfitting, and the tanning of hides, is done at a loom: a Clothing Store's (${LOOM_FEE} gold a craft, a cure or a weave), or your own home's.`));
    return;
  }
  const rank = book.track('outfitting')?.rank ?? 0;
  const specs = book.track('outfitting')?.specs ?? {};
  detail.append(el('p', 'px-note', `${loom.kind === 'shop' ? `The tailor's loom and tanning rack - ${loom.fee} gold a craft, a cure or a weave.` : 'Your loom.'} Outfitting ${rank} (${rankName(rank)}).`));
  const short = purseShort(loom, 'tailor', 'a craft, a cure or a weave');
  if (short) detail.append(el('p', 'px-note prof-short', short));
  // AUDIT 30 A2's law: Gentle acts switched on under a stitch sets the needle down - nothing spent, the craft a plain one
  if (_loom.act && getPref('gentleActs') === true) { _loom.act.cancel(); endStitch(); _loom.word = 'You set the needle down; nothing is spent.'; }
  const sewing = !!_loom.act;
  // THE TANNING RACK AND THE LOOM'S OWN WORK: the hides the Stores hold, cured; Spider Silk, woven
  const cures = CURE_RECIPES.filter((r) => book.held(r.inputs[0].key) > 0);
  if (cures.length) workRows(detail, rerender, el, cures, _loom, 'Cure', 'Curing...', (id, n) => p.smelt(id, n), short, sewing);   // AUDIT 32 P5: held while sewing
  else detail.append(el('p', 'px-note', 'Two hides cure to a leather here (a Tanner\'s one). Hides come from the bodies your own blow fells (Hunting).'));
  const weaves = WEAVE_RECIPES.filter((r) => book.held(r.inputs[0].key) > 0);
  if (weaves.length) workRows(detail, rerender, el, weaves, _loom, 'Weave', 'Weaving...', (id, n) => p.smelt(id, n), short, sewing);
  const held = (k) => book.held(k);
  const fams = el('div', 'prof-families');
  for (const [id, word] of LOOM_FAMILIES) {
    const b = el('button', `prof-family${_loom.family === id ? ' on' : ''}`, word);
    b.type = 'button';
    b.disabled = sewing;
    b.onclick = () => { _loom.family = id; _loom.picked = null; rerender(); };
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
      b.onclick = () => { _loom.clothing = id; _loom.picked = null; rerender(); };
      row.append(b);
    }
    for (const c of CLOTHS) {
      const b = el('button', `prof-family${_loom.cloth === c.key ? ' on' : ''}`, c.name.replace(/ Bolt$/, ''));
      b.type = 'button';
      b.disabled = sewing;
      b.onclick = () => { _loom.cloth = c.key; _loom.picked = null; rerender(); };
      row.append(b);
    }
    detail.append(row);
  }
  const list = loomRecipes(_loom.family, _loom.cloth, clothing);
  // AUDIT 32 P8: Standard-bearer's Silk says where it comes from - a siege's Spoils (PROF0 4.7), the one door to its 76
  // garments; AUDIT-SEATS: the sieges yield it now (townSeatLaw.js SIEGE_SPOILS), so no longer "nothing yields it yet"
  if (_loom.family === 'clothing' && _loom.cloth === STANDARD_SILK.key) detail.append(el('p', 'px-note', `${p.name(_loom.cloth)} comes with the sieges - a Siege Honour's Spoils.`));
  for (const r of list) {
    const open = recipeOpen(r, rank);
    const can = open && craftable(r, held);
    const row = el('button', `prof-recipe${_loom.picked === r.id ? ' on' : ''}${can ? '' : ' prof-locked'}`);
    row.type = 'button';
    row.disabled = sewing;
    row.append(el('b', null, r.name), el('span', 'prof-split', open ? (can ? 'can make now' : 'wants its inputs') : `rank ${r.rank}`));
    row.onclick = () => { _loom.picked = r.id; rerender(); };
    detail.append(row);
  }
  const r = list.find((x) => x.id === _loom.picked);
  if (r) {
    const box = el('div', 'prof-craft');
    box.append(el('b', null, `${r.name} - rank ${r.rank}`));
    for (const inp of r.inputs) {
      const have = held(inp.key);
      const line = el('div', `prof-input${have >= inp.n ? '' : ' prof-short'}`);
      line.append(el('span', null, `${p.name(inp.key)} ${Math.min(have, inp.n)} / ${inp.n} (${have} stored)`));
      const sale = WEAVERS_STOCK.find((x) => x.key === inp.key);   // the Weavers' Linen and Wool (4.5), at the tailor's
      // AUDIT 32 P6: the Marks the purchase asks, held or said before the press (the Market tab's counter's law, AUDIT 30
      // U12/U13) - it was offered whatever the balance, and refused after; COUNTER-GATES: the one counter's buy now
      if (sale && have < inp.n && loom.kind === 'shop') counterBuy(line, { el, p, state: _loom, rerender, key: inp.key, need: inp.n - have, sale, who: 'the Weavers', counter: 'weavers' });
      box.append(line);
    }
    if (r.family === 'furnishings') box.append(el('p', 'px-note', 'Furnishings go among your things, to set down in a room of your own (Decorate).'));
    // A GARMENT'S DYE (9.3: "itemDye.js's colours"): one of DFU's ten, chosen here and sewn in, or none (AUDIT 32 L3:
    // every garment takes one, DFU's "unchangeable" shirts too - the word is their variant's)
    if (r.kind === 'garment' && r.dyes === true) {
      const dyes = el('div', 'prof-families prof-metals');
      const none = el('button', `prof-family${_loom.dye == null ? ' on' : ''}`, 'Undyed');
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
      box.append(el('p', 'px-note', `Your rank ${rank}, margin ${rank - r.rank}: ${odds.map((o, q) => (o ? `${QUALITY_NAMES[q]} ${o}` : null)).filter(Boolean).join(' | ')}. A clean stitch is a step better${specs[50] === 'tailor' && r.family === 'clothing' ? ', and a Tailor\'s clothing another' : specs[50] === 'leatherworker' && r.family === 'leather' ? ', and a Leatherworker\'s leather another' : ''}.`));
    }
    const gentle = getPref('gentleActs') === true;
    const dye = r.kind === 'garment' && r.dyes === true ? _loom.dye : null;
    const elsewhere = handsAt(_loom);   // AUDIT 32 P2
    if (elsewhere && !_loom.act) box.append(el('p', 'px-note', `Your hands are at ${elsewhere} - finish there first.`));
    const ready = recipeOpen(r, rank) && craftable(r, held) && !_loom.busy && !_loom.crafting && !_loom.act && !elsewhere && !short;
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
      const hit = actButton(el, 'Stitch', (e) => _loom.stitch?.(e));   // AUDIT 32 P1
      const cancel = el('button', 'act', 'Set the needle down');
      cancel.type = 'button';
      cancel.onclick = () => { _loom.act?.cancel(); endStitch(); _loom.word = 'You set the needle down; nothing is spent.'; rerender(); };
      panel.append(el('span', 'prof-heatword', `The stitch - press on the beat, ${STITCH_ACT.stitches} in a row (Space)`), bar, marks, hit, cancel);
      box.append(panel);
      _loom.els = { bar, marker, marks: dots, hit };
      if (!_loom.off) _loom.stitch = stitchLoop(craftOf(_loom.actRecipe ?? r.id, _loom.actRecipe ? _loom.actDye : dye));
    } else {
      const go = el('button', 'act primary', _loom.crafting ? 'At the loom...' : 'Craft');
      go.type = 'button';
      go.disabled = !ready;
      go.onclick = () => {
        if (gentle) { void finish(false); return; }   // Gentle acts: a plain craft, no stitch
        _loom.act = createStitchAct({ band: p.stitchBand?.() ?? 1 });
        _loom.actRecipe = r.id; _loom.actDye = dye;
        rerender();
      };
      const quick = el('button', 'act', 'Quick craft');
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
export const masonVerb = (id) => (id === 'cut:stone' ? 'Cut' : 'Mix');

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
  detail.append(divider('The Mason\'s Bench'));
  if (!bench) {
    endChisel();
    detail.append(el('p', 'px-note', `Masonry is done at a mason's bench: a General Store's (${MASON_FEE} gold a cut, a mix or a carving), or your own home's.`));
    return;
  }
  const track = book.track('masonry');
  const rank = track?.rank ?? 0;
  const specs = track?.specs ?? {};
  detail.append(el('p', 'px-note', `${bench.kind === 'shop' ? `The mason's bench - ${bench.fee} gold a cut, a mix or a carving.` : 'Your mason\'s bench.'} Masonry ${rank} (${rankName(rank)}).`));
  const short = purseShort(bench, 'mason', 'a cut, a mix or a carving');
  if (short) detail.append(el('p', 'px-note prof-short', short));
  // AUDIT 30 A2's law: Gentle acts switched on under the chisel sets it down - nothing spent, the work a plain one
  if (_mason.act && getPref('gentleActs') === true) { _mason.act.cancel(); endChisel(); _mason.word = CHISEL_DOWN_LINE; }
  const striking = !!_mason.act;
  const gentle = getPref('gentleActs') === true;
  const elsewhere = handsAt(_mason);   // AUDIT 32 P2: one act a page
  const held = (k) => book.held(k);
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
    const label = what.kind === 'work' ? `${p.name(r?.out ?? '')}, ${what.count} ${what.count === 1 ? 'time' : 'times'}` : (r?.name ?? '');
    const panel = el('div', 'prof-heat prof-chisel');
    panel.append(el('span', 'prof-heatword', `The chisel (${label}) - strike the marked line, ${_mason.act.state.need} strikes: press the line, or set the chisel with the arrows and strike with Space`));
    const stone = el('div', 'prof-stone');
    const lines = [];
    for (let i = 0; i < CHISEL_ACT.lines; i++) {
      const b = el('button', `prof-chisel-line${i === _mason.act.mark ? ' marked' : ''}${i === _mason.act.state.at ? ' at' : ''}`, String(i + 1));
      b.type = 'button';
      b.setAttribute?.('aria-label', `Strike line ${i + 1}`);
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
    const hit = actButton(el, 'Strike', (e) => _mason.strike?.(e));
    const cancel = el('button', 'act', 'Set the chisel down');
    cancel.type = 'button';
    cancel.onclick = () => { _mason.act?.cancel(); endChisel(); _mason.word = CHISEL_DOWN_LINE; rerender(); };
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
    const ins = r.inputs.map((inp) => `${inp.n} ${p.name(inp.key)} (${held(inp.key)})`).join(' + ');
    row.append(el('b', null, `${p.name(r.out)}${per > 1 ? ` x${per}` : ''}`), el('span', 'prof-split', open ? ins : `${ins} - rank ${r.rank}`));
    const qty = el('input', 'prof-qty');
    qty.type = 'number'; qty.min = '1'; qty.max = String(Math.max(1, most));
    qty.value = String(Math.max(1, Math.min(_mason.counts[r.id] ?? 1, Math.max(1, most))));
    qty.oninput = () => { _mason.counts[r.id] = Math.max(1, Math.min(SMELT_MAX, Math.floor(Number(qty.value) || 1))); };
    const count = () => Math.max(1, Math.min(_mason.counts[r.id] ?? 1, smeltable(r, held)));
    const shut = _mason.busy || _mason.crafting || striking || most < 1 || !!short || !!elsewhere;
    const acts = el('span', 'prof-workacts');
    const go = el('button', 'act', _mason.busy && _workingOn === r.id ? 'At the bench...' : masonVerb(r.id));
    go.type = 'button';
    go.disabled = shut;
    go.onclick = () => { if (!go.disabled) begin({ kind: 'work', id: r.id, count: count() }); };
    const quick = el('button', 'act', 'Quick');
    quick.type = 'button';
    quick.disabled = shut;
    quick.onclick = () => { if (!quick.disabled) void finishFor({ kind: 'work', id: r.id, count: count() })(false); };
    acts.append(go, quick);
    row.append(qty, acts);
    detail.append(row);
  }
  detail.append(el('p', 'px-note', held('stone:rough') > 0
    ? 'Two Rough Stone cut to a Cut Stone (a Quarryman\'s two); Sulphur, Lead and five Rough Stone mix to ten Mortar. A clean chisel - every strike on the marked line - earns half again its Masonry XP.'
    : 'Rough Stone is quarried from the boulders of the rock fields with a Pick-Axe (Mining).'));
  if (elsewhere && !_mason.act) detail.append(el('p', 'px-note', `Your hands are at ${elsewhere} - finish there first.`));
  // THE SCULPTOR'S STONE DECOR (3.3, 9.3): a column, a bench, a font, a statue plinth
  detail.append(el('p', 'px-note', specs[100] === SCULPTOR ? 'Stone decor, carved for a room of your own:' : 'Stone decor - a column, a bench, a font, a statue plinth - is carved by a Sculptor (Masonry\'s choice at 100).'));
  for (const r of MASONRY_RECIPES) {
    const open = recipeOpen(r, rank, specs);
    const can = open && craftable(r, held);
    const row = el('button', `prof-recipe${_mason.picked === r.id ? ' on' : ''}${can ? '' : ' prof-locked'}`);
    row.type = 'button';
    row.disabled = striking;
    row.append(el('b', null, r.name), el('span', 'prof-split', open ? (can ? 'can make now' : 'wants its inputs') : 'a Sculptor\'s'));
    row.onclick = () => { _mason.picked = r.id; rerender(); };
    detail.append(row);
  }
  const r = MASONRY_RECIPES.find((x) => x.id === _mason.picked);
  if (r && p.craft) {
    const box = el('div', 'prof-craft');
    box.append(el('b', null, `${r.name} - a Sculptor's`));
    for (const inp of r.inputs) {
      const have = held(inp.key);
      const line = el('div', `prof-input${have >= inp.n ? '' : ' prof-short'}`);
      line.append(el('span', null, `${p.name(inp.key)} ${Math.min(have, inp.n)} / ${inp.n} (${have} stored)`));
      box.append(line);
    }
    box.append(el('p', 'px-note', 'Stone decor goes among your things, to set down in a room of your own (Decorate).'));
    const open = recipeOpen(r, rank, specs);
    if (open) {
      const odds = qualityOdds(rank - r.rank, { masterwright: false });
      box.append(el('p', 'px-note', `Your rank ${rank}, margin ${rank - r.rank}: ${odds.map((o, q) => (o ? `${QUALITY_NAMES[q]} ${o}` : null)).filter(Boolean).join(' | ')}. A clean chisel is a step better.`));
    }
    const ready = open && craftable(r, held) && !_mason.busy && !_mason.crafting && !_mason.act && !elsewhere && !short;
    const go = el('button', 'act primary', _mason.crafting ? 'At the bench...' : 'Craft');
    go.type = 'button';
    go.disabled = !ready;
    go.onclick = () => { if (!go.disabled) begin({ kind: 'carve', id: r.id, count: 1 }); };
    const quick = el('button', 'act', 'Quick craft');
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
/** Where Cooking is done, said away from a fire. */
export const FIRE_AWAY_LINE = 'Cooking is done at a fire - a campfire, a hearth or a brazier: stand within reach of its flame. Your dishes go to your pack.';
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
  detail.append(divider('The Fire'));
  if (!fire) {
    endPan();
    detail.append(el('p', 'px-note', FIRE_AWAY_LINE));
    return;
  }
  const track = book.track('cooking');
  const rank = track?.rank ?? 0;
  const specs = track?.specs ?? {};
  const skillet = p.skillet?.() === true;
  detail.append(el('p', 'px-note', `A fire to cook at. Cooking ${rank} (${rankName(rank)}). ${skillet ? 'Your Skillet widens the pan\'s window.' : 'A Skillet in your pack would widen the pan\'s window.'}`));
  // AUDIT 30 A2's law: Gentle acts switched on under the pan takes it off - nothing spent, the dish a plain one
  if (_cook.act && getPref('gentleActs') === true) { _cook.act.cancel(); endPan(); _cook.word = PAN_DOWN_LINE; }
  const gentle = getPref('gentleActs') === true;
  const elsewhere = handsAt(_cook);   // AUDIT 32 P2: one act a page
  const held = (k) => book.held(k);
  // WHAT THE PAN'S END ASKS (AUDIT 30 A3's law: the dish it began on)
  const finishFor = (id) => async (clean) => {
    _cook.crafting = true; rerender();
    const res = await p.craft(id, { clean: clean === true && getPref('gentleActs') !== true });
    _cook.crafting = false; _cook.word = res?.text ?? null; rerender();
  };
  if (_cook.act && _cook.actRecipe) {
    const panel = el('div', 'prof-heat prof-pan');
    panel.append(el('span', 'prof-heatword', `The pan (${dishOf(_cook.actRecipe)?.name ?? ''}) - take each pan off while it is done, in the window (Space): ${_cook.act.state.need} pans`));
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
    const hit = actButton(el, 'Take it off', (e) => _cook.take?.(e));
    const cancel = el('button', 'act', 'Set the pan aside');
    cancel.type = 'button';
    cancel.onclick = () => { _cook.act?.cancel(); endPan(); _cook.word = PAN_DOWN_LINE; rerender(); };
    panel.append(bar, marks, hit, cancel);
    detail.append(panel);
    _cook.els = { bar, marker, marks: dots, hit };
    if (!_cook.off) _cook.take = panLoop(finishFor(_cook.actRecipe));
  }
  // THE DISHES (9.3), in the fire's order
  for (const r of COOKING_RECIPES) {
    const open = recipeOpen(r, rank, specs), can = open && craftable(r, held);   // the rank the dish asks, and its inputs held
    const row = el('button', `prof-recipe${_cook.picked === r.id ? ' on' : ''}${can ? '' : ' prof-locked'}`);
    row.type = 'button';
    row.disabled = !!_cook.act;
    row.append(el('b', null, r.name), el('span', 'prof-split', open ? (can ? 'can cook now' : 'wants its inputs') : `rank ${r.rank}`));
    row.onclick = () => { _cook.picked = r.id; rerender(); };
    detail.append(row);
  }
  const r = COOKING_RECIPES.find((x) => x.id === _cook.picked);
  if (r) {
    const box = el('div', 'prof-craft');
    box.append(el('b', null, `${r.name} - rank ${r.rank}`));
    for (const inp of r.inputs) {
      const have = held(inp.key);
      const line = el('div', `prof-input${have >= inp.n ? '' : ' prof-short'}`);
      line.append(el('span', null, `${p.name(inp.key)} ${Math.min(have, inp.n)} / ${inp.n} (${have} stored)`));
      box.append(line);
    }
    const hand = dishHand(r, specs[100]);
    const serves = craftCount(r, specs[100], specs[50]);
    const steps = Math.max(0, Math.trunc(Number(p.cookSteps?.()) || 0));   // AUDIT PROF-541 K7: the town Apothecary's steps where my guild holds it
    box.append(el('p', 'px-note', `${dishEffectText(dishOf(r.id), hand)}.${hand === HAND_PROVISIONER ? ' Yours never spoil.' : ''}`));
    box.append(el('p', 'px-note', `${serves > 1 ? 'Two servings (a Cook\'s)' : 'One serving'}, into your pack. ${panCount(r)} pans; every pan taken off done is a clean pan, ${steps > 0 ? `${cookXp(rank, { clean: true, steps })} Cooking XP to a plain dish's ${cookXp(rank, { steps })} - the town's Apothecary's ${steps === 1 ? 'step' : `${steps} steps`} in both` : `half again its ${cookXp(rank)} Cooking XP`}.`));   // AUDIT PROF-541 K7: the XP the service pays (cookXp's steps)
    const ready = recipeOpen(r, rank, specs) && craftable(r, held) && !_cook.crafting && !_cook.act && !elsewhere;
    const go = el('button', 'act primary', _cook.crafting ? 'At the fire...' : 'Cook');
    go.type = 'button';
    go.disabled = !ready;
    go.onclick = () => {
      if (go.disabled) return;
      if (gentle) { void finishFor(r.id)(false); return; }   // Gentle acts: a plain dish, no pan
      _cook.act = createPanAct({ pans: panCount(r), done: panWindow(rank, p.panBand?.() ?? 1, skillet) });
      _cook.actRecipe = r.id;
      rerender();
    };
    const quick = el('button', 'act', 'Quick cook');
    quick.type = 'button';
    quick.disabled = !ready;
    quick.onclick = () => { if (!quick.disabled) void finishFor(r.id)(false); };
    box.append(go, quick);
    detail.append(box);
  }
  detail.append(el('p', 'px-note', 'Raw Meat comes from a body you skin, Raw Fish from the net, the Mushroom, the Egg, the Apple and the Orange from the Basket, and the herbs from their patches - into your Stores. A Raw Fish cooked over the flame from your pack stays a plain meal, and teaches no Cooking.'));
  if (elsewhere && !_cook.act) detail.append(el('p', 'px-note', `Your hands are at ${elsewhere} - finish there first.`));
  if (_cook.word) detail.append(el('p', 'prof-word', _cook.word));
}

// ─── PROF10: THE JEWELLER'S BENCH (bible/06-Systems/Professions-Arc.md 9.3, 9.4, 36) ─────

/** What setting the stone down says. */
export const FACET_DOWN_LINE = 'You set the stone down; nothing is spent.';
/** Tests: the bench's state - its facet ticked by hand, as a frame would. */
export const _jewelForTests = () => _jewel;
/** The recipes the bench lists for a piece in a base (its metal, its Linen, its wood): the plain piece, then a gem each. */
export const jewelRecipes = (piece, base) => JEWELCRAFTING_RECIPES.filter((r) => r.product === piece && r.id.split(':')[1] === base);
/** What the bench says a piece's points are: "1,980 enchantment points (+10%)", its DFU template's and the share added. */
export function jewelPointsLine(r, hand = null) {
  const pct = jewelPointsPct(r, hand);
  const pts = jewelPoints(r, templateByIndex(r.templateIndex)?.enchantmentPoints ?? 0, hand);
  return `${pts.toLocaleString('en-US')} enchantment points${pct ? ` (+${pct}%)` : ''}`;
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
  detail.append(divider('The Jeweller\'s Bench'));
  if (!bench) {
    endFacet();
    detail.append(el('p', 'px-note', `Jewelcrafting is done at a jeweller's bench: a Pawn Shop's or a Gem Store's (${JEWEL_FEE} gold a piece), or your own home's.`));
    return;
  }
  const track = book.track('jewelcrafting');
  const rank = track?.rank ?? 0;
  const specs = track?.specs ?? {};
  detail.append(el('p', 'px-note', `${bench.kind === 'shop' ? `The jeweller's bench - ${bench.fee} gold a piece.` : 'Your jeweller\'s bench.'} Jewelcrafting ${rank} (${rankName(rank)}).`));
  const short = purseShort(bench, 'jeweller', 'a piece');
  if (short) detail.append(el('p', 'px-note prof-short', short));
  // AUDIT 30 A2's law: Gentle acts switched on under the facet sets the stone down - nothing spent, the piece a plain one
  if (_jewel.act && getPref('gentleActs') === true) { _jewel.act.cancel(); endFacet(); _jewel.word = FACET_DOWN_LINE; }
  const cutting = !!_jewel.act;
  const gentle = getPref('gentleActs') === true;
  const elsewhere = handsAt(_jewel);   // AUDIT 32 P2: one act a page
  const held = (k) => book.held(k);
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
  const crackedHeld = held('gem:siege');
  const lapidary = specs[100] === LAPIDARY;
  /** What the piece spends as this jeweller would: a Heartwood for a plank, a Siege-cracked Gem for the gem. */
  const spendsFor = (r, wood, cracked) => recipeInputs(r, { heartwood: wood && takesHeartwood(r), cracked: cracked && lapidary && takesCracked(r) });
  const list = jewelRecipes(_jewel.piece, _jewel.base);
  for (const r of list) {
    const open = recipeOpen(r, rank);
    const can = open && (craftable(r, held) || (lapidary && takesCracked(r) && craftable(r, held, spendsFor(r, false, true))));
    const row = el('button', `prof-recipe${_jewel.picked === r.id ? ' on' : ''}${can ? '' : ' prof-locked'}`);
    row.type = 'button';
    row.disabled = cutting;
    row.append(el('b', null, r.name), el('span', 'prof-split', open ? (can ? 'can make now' : 'wants its inputs') : `rank ${r.rank}`));
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
    box.append(el('b', null, `${r.name} - rank ${r.rank}`));
    if (!(lapidary && takesCracked(r) && crackedHeld > 0)) _jewel.cracked = false;
    const spends = spendsFor(r, _jewel.heartwood, _jewel.cracked);
    for (const inp of spends) {
      const have = held(inp.key);
      const line = el('div', `prof-input${have >= inp.n ? '' : ' prof-short'}`);
      line.append(el('span', null, `${p.name(inp.key)} ${Math.min(have, inp.n)} / ${inp.n} (${have} stored)`));
      box.append(line);
    }
    const hand = jewelHand(r, specs[50]);
    box.append(el('p', 'px-note', `${jewelPointsLine(r, hand)}${hand === JEWEL_HAND_GOLDSMITH ? ' - a Goldsmith\'s Silver, counted as Gold' : hand === JEWEL_HAND_GEMCUTTER ? ' - a Gemcutter\'s gem' : ''}. The item maker spends them${r.product === 'wand' ? '' : ', beside a Masterwork\'s own enchantment'}.`));   // AUDIT PROF10 J2: it takes a crafted piece with its Rare roll (itemMakerWindow.js itemMakerFilter); AUDIT PROF-541 J5: a Wand rolls none (lootRarity.js rarityEligible: no slot)
    if (recipeOpen(r, rank)) {
      const odds = qualityOdds(rank - r.rank, { masterwright: masterworkSpec(specs[100]) });
      // AUDIT PROF-541 R2-C6: and the town Apothecary's quality steps the service adds (professions.js seatStepsFor)
      const steps = Math.max(0, Math.trunc(Number(p.jewelSteps?.()) || 0));
      box.append(el('p', 'px-note', `Your rank ${rank}, margin ${rank - r.rank}: ${odds.map((o, q) => (o ? `${QUALITY_NAMES[q]} ${o}` : null)).filter(Boolean).join(' | ')}${steps > 0 ? ` (+${steps} ${steps === 1 ? 'step' : 'steps'} from the town's Apothecary)` : ''}. A clean facet is a step better; ${craftXp(r.tier, rank, false)} Jewelcrafting XP.`));
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
      lab.append(cb, globalThis.document.createTextNode(` Set a Siege-cracked Gem as the ${gemWord(r.gem)} (${crackedHeld} stored)`));
      box.append(lab);
    }
    const ready = recipeOpen(r, rank) && craftable(r, held, spends) && !_jewel.crafting && !_jewel.act && !elsewhere && !short;
    if (elsewhere && !_jewel.act) box.append(el('p', 'px-note', `Your hands are at ${elsewhere} - finish there first.`));
    const wood = _jewel.heartwood && takesHeartwood(r), crack = _jewel.cracked === true && lapidary && takesCracked(r);
    if (_jewel.act && _jewel.actRecipe) {
      // THE FACET: the dial, the light's window on it, the stone's bearing, the facets so far
      const panel = el('div', 'prof-heat prof-facet');
      panel.append(el('span', 'prof-heatword', `The facet (${r.name}) - stop the turn where the stone catches the light (Space): ${_jewel.act.state.need} facets`));
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
      const hit = actButton(el, 'Stop the turn', (e) => _jewel.stop?.(e));
      const cancel = el('button', 'act', 'Set the stone down');
      cancel.type = 'button';
      cancel.onclick = () => { _jewel.act?.cancel(); endFacet(); _jewel.word = FACET_DOWN_LINE; rerender(); };
      panel.append(gem, bar, marks, hit, cancel);
      box.append(panel);
      _jewel.els = { bar, band, marker, gem, marks: dots, hit };
      if (!_jewel.off) _jewel.stop = facetLoop(finishFor(_jewel.actRecipe, _jewel.actWood, _jewel.actCracked));
    } else {
      const go = el('button', 'act primary', _jewel.crafting ? 'At the bench...' : 'Craft');
      go.type = 'button';
      go.disabled = !ready;
      go.onclick = () => {
        if (go.disabled) return;
        if (gentle) { void finishFor(r.id, wood, crack)(false); return; }   // Gentle acts: a plain piece, no facet
        _jewel.act = createFacetAct({ facets: facetCount(r), windowDeg: facetWindow(rank, p.facetBand?.() ?? 1) });
        _jewel.actRecipe = r.id; _jewel.actWood = wood; _jewel.actCracked = crack;
        rerender();
      };
      const quick = el('button', 'act', 'Quick craft');
      quick.type = 'button';
      quick.disabled = !ready;
      quick.onclick = () => { if (!quick.disabled) void finishFor(r.id, wood, crack)(false); };
      box.append(go, quick);
    }
    detail.append(box);
  }
  detail.append(el('p', 'px-note', 'Silver, Gold and Platinum come from the veins (Mining), the gems from a clean strike on a vein\'s glint, the Pearl from the sea\'s nets; Linen from the Weavers. Your pieces go to your pack.'));
  if (_jewel.word) detail.append(el('p', 'prof-word', _jewel.word));
}

// ─── PROF12: THE ALCHEMY STATION (bible/06-Systems/Professions-Arc.md 9.3, 37) ─────

/** What the station says a potion's cauldron wants, and its word for the Apothecaries'. */
export const ALCHEMY_AWAY_LINE = `Alchemy is brewed at an alchemy station: an Alchemist's (${ALCHEMY_FEE} gold a brew), or your own home's. Your potions go to your pack.`;
/** Tests: the station's state. */
export const _alchemyForTests = () => _alchemy;
/** The potion line a brew's chance says: "Potent 30% (+25% magnitude)" - AUDIT PROF12 A3: a potion whose magnitude is DFU's
 *  default "(lasts 25% longer)" (alchemyLaw potentLasts), and the station's line, no potion picked, "(+25% magnitude or
 *  duration)". AUDIT PROF-541 B4: `steps` the town's Apothecary's (+10 a step - the service's own sum, potentChance);
 *  B3: a Cure that is never Potent (alchemyLaw potentAble) says so, and no chance. */
export const POTENT_NONE_LINE = 'Never Potent (a cure acts at once)';
export function potentLine(rank, specs, unbruised = 0, potion = null, steps = 0) {
  if (potion && !potentAble(potion)) return POTENT_NONE_LINE;
  const c = potentChance(rank, { distiller: specs?.[50] === DISTILLER, unbruised, steps });
  const pct = potentPct(specs?.[100] ?? null);
  const what = !potion ? `+${pct}% magnitude or duration` : potentLasts(potion) ? `lasts ${pct}% longer` : `+${pct}% magnitude`;
  return `Potent ${c}% (${what})`;
}
/**
 * PROF12: THE ALCHEMY STATION - DFU's twenty (alchemyLaw POTIONS, its own order), each its rank (its price's tier), the
 * chosen one's cauldron as the Stores hold it (an herb's group the one held more of - brewKeys), what a brew makes (1-3
 * potions) and its Potent chance, the XP; Brew (no act - 9.4: "DFU's windows stay 1:1"); an ingredient the Apothecaries
 * sell, bought where it is short (4.5); and a Transmuter's transmutations (two of a metal and a Mercury into the next).
 * Only at an alchemy station: an Alchemist's, its fee a brew, or the player's own home's.
 * @param {HTMLElement} detail @param {() => void} rerender @param {{ el: Function, divider: (w: string) => HTMLElement }} kit
 */
function drawAlchemyStation(detail, rerender, { el, divider }) {
  const p = _provider;
  if (!p?.alchemy || !p.brew) return;
  const book = p.book;
  const station = p.alchemy();
  detail.append(divider('The Alchemy Station'));
  if (!station) {
    detail.append(el('p', 'px-note', ALCHEMY_AWAY_LINE));
    return;
  }
  const track = book.track('alchemy');
  const rank = track?.rank ?? 0;
  const specs = track?.specs ?? {};
  const n = brewCount(rank, specs[50]);
  const steps = Math.max(0, Math.trunc(Number(p.alchemySteps?.()) || 0));   // AUDIT PROF-541 B4: the town's Apothecary; R2-C3: a whole step or none, as cookSteps
  detail.append(el('p', 'px-note', `${station.kind === 'shop' ? `The alchemist's station - ${station.fee} gold a brew.` : 'Your alchemy station.'} Alchemy ${rank} (${rankName(rank)}): ${n === 1 ? 'a potion' : `${n} potions`} a brew; ${potentLine(rank, specs, 0, null, steps)}${steps > 0 ? ` (the Apothecary's +${POTENT.apothecary * steps}% with it)` : ''}, +${POTENT.unbruised}% for each herb you picked unbruised.${n > 1 ? ' A potion wholly of the Apothecaries\' goods brews one.' : ''}`));   // AUDIT PROF-541 R2-S1
  const short = purseShort(station, 'alchemist', 'a brew');
  if (short) detail.append(el('p', 'px-note prof-short', short));
  const held = (k) => book.held(k);
  for (const potion of POTIONS) {
    const open = rank >= potion.rank;
    const keys = brewKeys(potion, held);
    const spends = brewSpends(potion, keys) ?? [];
    const can = open && spends.every((i) => held(i.key) >= i.n);
    const row = el('button', `prof-recipe${_alchemy.picked === potion.id ? ' on' : ''}${can ? '' : ' prof-locked'}`);
    row.type = 'button';
    row.append(el('b', null, potion.name), el('span', 'prof-split', open ? (can ? 'can brew now' : 'wants its ingredients') : `rank ${potion.rank}`));
    row.onclick = () => { _alchemy.picked = potion.id; rerender(); };
    detail.append(row);
  }
  const potion = POTIONS.find((x) => x.id === _alchemy.picked);
  if (potion) {
    const box = el('div', 'prof-craft');
    box.append(el('b', null, `${potion.name} - rank ${potion.rank}`));
    const keys = brewKeys(potion, held);
    const spends = brewSpends(potion, keys) ?? [];
    for (const inp of spends) {
      const have = held(inp.key);
      const line = el('div', `prof-input${have >= inp.n ? '' : ' prof-short'}`);
      line.append(el('span', null, `${p.name(inp.key)} ${Math.min(have, inp.n)} / ${inp.n} (${have} stored)`));
      // 4.5: the Apothecaries' counter - an ingredient no gathering yields, bought where the cauldron is short of it
      const sale = APOTHECARY_STOCK.find((x) => x.key === inp.key);
      if (sale && have < inp.n) counterBuy(line, { el, p, state: _alchemy, rerender, key: inp.key, need: inp.n - have, sale, who: 'the Apothecaries', counter: 'apothecaries' });
      box.append(line);
    }
    const gathered = potentAble(potion) ? potion.ingredients.filter((t) => ingredientKeys(t).some((k) => k.startsWith('p'))).length : 0;   // AUDIT PROF-541 B3: a cure's herbs add nothing
    const made = brewCount(rank, specs[50], potion);   // AUDIT PROF-541 R2-S1: the counter's goods alone brew one
    box.append(el('p', 'px-note', `${made === 1 ? 'A potion' : `${made} potions`} a brew. ${potentLine(rank, specs, 0, potion, steps)}${gathered ? ` - and +${POTENT.unbruised}% for each of its herbs you picked unbruised` : ''}. ${brewXp(potion, rank, false)} Alchemy XP${brewFirstPays(potion) ? `, and ${brewXp(potion, rank, true) - brewXp(potion, rank, false)} the first time` : ''}.`));
    const ready = rank >= potion.rank && spends.length > 0 && spends.every((i) => held(i.key) >= i.n) && !_alchemy.crafting && !short;
    const go = el('button', 'act primary', _alchemy.crafting ? 'Brewing...' : 'Brew');
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
    if (specs[100] === TRANSMUTER.id) workRows(detail, rerender, el, TRANSMUTE_RECIPES, _alchemy, 'Transmute', 'Transmuting...', (id, k) => /** @type {any} */ (p.smelt)(id, k), short);
    else detail.append(el('p', 'px-note', 'A Transmuter - Alchemy\'s choice at 100 - turns two of a metal and a Mercury into one of the next: Tin, Copper, Silver, Gold, Platinum.'));
  }
  detail.append(el('p', 'px-note', 'Herbs come from the wilderness (Herbalism), metals and gems from the veins, the Pearl from the sea, a body\'s parts from Hunting; the rest from the Apothecaries\' counter. Your potions go to your pack.'));
  if (_alchemy.word) detail.append(el('p', 'prof-word', _alchemy.word));
}

// ─── PROF12: THE ENCHANTING STATION (bible/06-Systems/Professions-Arc.md 9.3, 37) ─────

export const ENCHANT_AWAY_LINE = `Disenchanting is done at an enchanting station: a Mages Guild hall (${ENCHANT_FEE} gold a piece), or your own home's. A crafted piece comes apart into Arcane Essence in your Stores.`;
/** Tests: the station's state. */
export const _enchantForTests = () => _enchant;
/** AUDIT PROF-541 B8: a piece whose Essence the Stores have no room for. */
export const ENCHANT_FULL_LINE = (room) => `Your Stores hold room for ${Math.max(0, room)} more Arcane Essence - not this piece's.`;
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
  detail.append(divider('The Enchanting Station'));
  if (!station) {
    detail.append(el('p', 'px-note', ENCHANT_AWAY_LINE));
    return;
  }
  const track = book.track('enchanting');
  const rank = track?.rank ?? 0;
  const specs = track?.specs ?? {};
  const pct = enchantDiscountPct(rank, specs[50] ?? null);
  detail.append(el('p', 'px-note', `${station.kind === 'shop' ? `The guild's enchanter - ${station.fee} gold a piece.` : 'Your enchanting station.'} Enchanting ${rank} (${rankName(rank)})${pct ? `: the item maker's gold ${pct}% less` : ''}.`));
  const short = purseShort(station, 'enchanter', 'a piece');
  if (short) detail.append(el('p', 'px-note prof-short', short));
  const pieces = p.disenchantable();
  // AUDIT PROF-541 B8: the Essence's room - every origin counted, as the service counts it (storesFullIn's sum)
  const ess = book.store?.(ARCANE_ESSENCE.key) ?? { own: book.held(ARCANE_ESSENCE.key) };
  const room = (book.state?.caps?.stores ?? STORES_MAX) - ((ess.own | 0) + (ess.bought | 0) + (ess.gold | 0));
  if (!pieces.length) detail.append(el('p', 'px-note', 'No crafted piece in your pack carries enough enchantment to give Essence. Only a piece a crafter made online comes apart - never loot.'));
  for (const pc of pieces) {
    const row = el('div', 'prof-smelt');
    const base = essenceOf(pc.points);
    row.append(el('b', null, pc.name), el('span', 'prof-split', `${pc.points.toLocaleString('en-US')} points - ${pc.essence} Arcane Essence, +${disenchantXp(recipeById(pc.recipe), rank, base)} Enchanting XP${specs[50] === DISENCHANTER ? ' (a Disenchanter\'s two)' : ''}`));
    const armed = _enchant.armed === pc.provenance;
    const b = el('button', 'act', _enchant.busy && armed ? 'Taking it apart...' : armed ? 'Press again: it is gone' : 'Disenchant');
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
}
