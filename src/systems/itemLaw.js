// @ts-check
// ═══════════════════════════════════════════════════════════════════
// INT1 (2026-10-09, the INTEGRITY arc - bible/06-Systems/Integrity-Arc.md; Mac: "I want to do everything and do it
// properly"): THE ITEM LAW. One answer to one question - COULD AN HONEST CLIENT OF THIS PORT HAVE MINTED THIS ITEM? -
// asked by both ends: the account service of every item in a realm character's checkpoint, a listing, a trade and a
// vault deposit (server-account/src/judge.js), and the client of every item a peer hands it (systems/loot.js
// validLootItem, through setItemLaw - the law registers itself there, so loot.js owes it no import and the cycle the
// loot graph would make is never made).
//
// ═══ WHY THE WIRE'S VALIDATOR WAS NOT THE LAW ══════════════════════
//
// validLootItem checks each field's KIND (itemFields.js) and a handful of cross-checks (a set's marks, a Gilded record,
// an imprint, a curse, a socket). It does not ask whether the fields AGREE: the research for this arc fed it a piece
// with no rarity and seven Legendary-band affixes, a Magic sword at +40% damage, Wyrmbane on a common dagger, a Rare
// arrow, a sigil of power 12 on a Magic weapon, a Broker's price with no binding and a Legendary whose signature lines
// were rewritten - and it took every one. Each is a thing no producer in this tree mints, and each is a thing a market
// buyer pays for believing.
//
// ═══ A FINDING IS A PROOF, NEVER A GUESS ═══════════════════════════
//
// A finding holds a character's trade (the hold, judge.js) and refuses a piece on the wire, so the law carries only
// rules every honest producer keeps - pinned by test/int1_itemlaw.test.js, which mints through the producers
// themselves (the loot doors, the spoils, the Broker's days, the item maker, the Aetheric and Gilded records, the
// Reforge's hone and reforge, the curse and socket passes) and asserts no finding on any of it. Where the port carries a
// legacy shape (a Regalia's fire at 50, a Broker ware sold before its binding, a classic save's raw words) the law
// accepts it. Where the honest bound lives in data this tree does not carry - a DFU magic item's rows and its price are
// MAGIC.DEF's and SPELLS.STD's, the player's own ARENA2 - the law checks only what holds for every row (the classic
// type range, the artifact's own effect on an artifact) and says so: those items are bounded by the wealth budget and
// the item ids (judge.js), never proven here.
//
// ═══ VALUE IS NOT A FINDING ═══════════════════════════════════════
//
// An item's `value` has honest numbers on both sides of any formula (a book's printed price under its template's, a
// shelf potion at double, a deed at its house's price), so a ceiling would refuse honest items. The law refuses only a
// value that is no price at all (not a finite non-negative number), and `itemWorth` - what the wealth measure counts -
// takes the smaller of the value and a generous ceiling. A forged value buys gold only at a counter, and gold is the
// budget's to bound.
// ═══════════════════════════════════════════════════════════════════

import { validItemField, ITEM_FIELDS } from './itemFields.js';
import { ITEM_TEMPLATES, templateByIndex, itemBaseValue, isAmmunition } from './itemTemplates.js';
import { GROUP_TEMPLATE_INDICES } from './itemTemplatesData.js';
import { WAGON_KINDS } from './wagonKinds.js';   // WAGONS2 (AUDIT): a wagon's kind and its price
import { TRANSPORT_SMALL_CART } from './itemTemplates.js';
import {
  AFFIX_KINDS, AFFIX_RANGES, AFFIX_COUNTS, RARE_FLAVOURS, kindParams, validAffix, legendaryById, legendariesFor, isGarment,
  CLOTHING_GROUPS, validImprint, validCurse, validSocket, isCursed, affixesWorth, RARE_ENCHANT_WORTH, EXALTED_WORTH, rarityOf,
  GEM_GRADE_TEMPLATES,   // GEM2
} from './lootRarity.js';
import { ROLLED_TIERS } from './rarityTier.js';
import { validSetMarks, aethericById, AETHERIC_WORTH } from './aetheric.js';
import { validGildedMarks, GILDED_WORTH } from './gilded.js';
import { SIGIL_BANDS, sigilFloor, validSigil } from './sigil.js';
import { setPieceKind, setById, WORLD_SET_IDS } from './sigilSets.js';
import { BROKER_PRICES } from './sigilBroker.js';
import { ENCHANTMENT_TYPES } from '../formats/magicDef.js';
import { enchantmentSettings, forcedEnchantments, hasItemMakerFlag, ITEM_MAKER_FLAGS, ENCHANTMENT_EXCLUSIONS, SOUL_COUNT } from './enchantmentCatalogue.js';
import { itemEnchantmentPower, craftedJewelRecipe, MAX_ENCHANTMENTS } from './enchanting.js';
import { isStackable, ARROW_TEMPLATE, GOLD_TEMPLATE, GLASS_BOTTLE_TEMPLATE } from './inventory.js';
import { setItemLaw, LOOT_STACK_MAX, ITEM_GROUP_NAME_BY_CLASS } from './loot.js';
import { CREATE_ITEM_ROWS, MENS_PLAIN_ROBES, WOMENS_PLAIN_ROBES } from './createItemRows.js';
import { cardById } from '../net/iliacCards.js';
import { PROVENANCE_RE, REPAIR_KIT_TEMPLATE } from '../net/recipeLaw.js';
import { ILIAC_CARD_TEMPLATE, CARD_BINDER_TEMPLATE, BINDER_DECKS_MAX } from './iliacItems.js';
import { POTENT } from '../net/alchemyLaw.js';
import { RRI_TEMPLATES } from './rriItems.js';
import { BANDAGE_TEMPLATE } from './rriRealism.js';
import { FORAGING_TEMPLATES } from './foragingLaw.js';
import { REST_ITEM_ROWS } from './restItemRows.js';
import { DEEP_WATERS_FISH_TEMPLATES } from './deepWatersFishRows.js';
// THE PORT'S OWN TEMPLATES register as their homes load (itemTemplates.js registerCustomTemplates). A headless reader -
// the account service - loads none of the game, so the homes that register at import are imported here for exactly
// that; the four whose homes pull the UI in (foraging, rest, Deep Waters' fish, Roleplay & Realism: Items) hand the law
// their rows from leaves instead, read beside the registry (lawTemplate) and never put into it - so a client with the
// mod switched off does not start knowing its items.
import './profTemplates.js';
import './survival/items.js';
import './thunderlock.js';
import './gateSpoils.js';
import './ayleidStones.js';
import './gems.js';   // GEM2: the graded gems' rows
import './walletItem.js';
import './livingWorld/keepsake.js';
import './legacy/heirloom.js';
import './comeSailAwayItems.js';
import './naval/navalStores.js';

/** The law's version - a finding names the law that found it, so a law loosened later can be asked again. TECH1 moved it
 *  to 2: a weapon's technique line (systems/lootRarity.js AFFIX_KINDS.technique) is lawful from it on, so a finding a law
 *  of 1 made against one is a finding to ask again. */
export const ITEM_LAW_VERSION = 2;

const T = ENCHANTMENT_TYPES;
const TYPE_KEY = Object.freeze(Object.fromEntries(Object.entries(T).map(([k, v]) => [v, k])));
/** The templates whose homes cannot load headless, by index - their rows, as the homes register them. */
const LAW_ONLY = new Map(/** @type {any[]} */ ([...RRI_TEMPLATES, ...FORAGING_TEMPLATES, ...REST_ITEM_ROWS, ...DEEP_WATERS_FISH_TEMPLATES]).map((t) => [t.index, t]));
/** A template the port knows: the live registry's row, or a law-only row. */
export const lawTemplate = (/** @type {unknown} */ i) => (Number.isInteger(i) ? templateByIndex(i) ?? LAW_ONLY.get(/** @type {number} */ (i)) ?? null : null);

/** The groups a classic template stands in (GROUP_TEMPLATE_INDICES, inverted): a few stand in two - gold is Currency and
 *  MiscItems, the map Maps and MiscItems, the plants Plant1 and Plant2. */
const CLASSIC_GROUPS = (() => {
  /** @type {Map<number, string[]>} */
  const m = new Map();
  for (const [g, list] of Object.entries(GROUP_TEMPLATE_INDICES)) for (const i of list) m.set(i, [...(m.get(i) ?? []), g]);
  return m;
})();
/** THE PORT'S OWN TEMPLATES' GROUPS. A custom row carries no group (registerCustomTemplates takes none): the producer
 *  writes it. Every index not named here is UselessItems2's - the custom items' own group. Pinned by the producer sweep
 *  (test/int1_itemlaw.test.js): every custom index a producer mints, in the group it mints it in. */
export const CUSTOM_TEMPLATE_GROUPS = Object.freeze({
  Weapons: Object.freeze([513, 514, 560, 561]),
  Armor: Object.freeze([515, 516, 517, 518, 519, 520, 521, 522, 523, 524, 525, 526]),
  Gems: Object.freeze([570, 571, ...GEM_GRADE_TEMPLATES]),   // GEM2: the graded gems (systems/gems.js)
  Jewellery: Object.freeze([]),
  Furniture: Object.freeze([696, 697, 698, 699]),
});
const CUSTOM_GROUP_OF = new Map(Object.entries(CUSTOM_TEMPLATE_GROUPS).flatMap(([g, list]) => list.map((i) => /** @type {[number, string]} */ ([i, g]))));
/** The groups a template may be minted in. */
export function templateGroups(/** @type {number} */ i) {
  if (i < ITEM_TEMPLATES.length) return CLASSIC_GROUPS.get(i) ?? [];
  return [CUSTOM_GROUP_OF.get(i) ?? 'UselessItems2'];
}

/** The armour materials a piece may carry: leather, chain (and the classic second chain), the ten plates. */
const ARMOR_MATERIALS = Object.freeze([0x0000, 0x0100, 0x0103, 0x0200, 0x0201, 0x0202, 0x0203, 0x0204, 0x0205, 0x0206, 0x0207, 0x0208, 0x0209]);
/** The poisons a foe's blade carries (poisons.js POISON_START_VALUE and its eight - pinned equal by
 *  test/int1_itemlaw.test.js: the Worker bundles no poisons.js, whose diseases ride with it), or none (-1). */
const LAW_POISON_FIRST = 128, LAW_POISON_LAST = 135;
/** The souls a trap may hold: a monster's (enchantmentCatalogue SOUL_COUNT, EnemyBasics' first 43) and a person's - DFU's
 *  kill door traps any foe's mobile id (mysticism.js attemptSoulTrap; only Azura's Star asks `< 128`), a guard's and a
 *  knight's among them (AUDIT INT: a human soul's gem was a finding). The item maker reads only the first. */
const soulLawful = (/** @type {unknown} */ v) => isInt(v) && ((/** @type {number} */ (v) >= 0 && /** @type {number} */ (v) < SOUL_COUNT) || (/** @type {number} */ (v) >= HUMAN_SOUL_FIRST && /** @type {number} */ (v) <= HUMAN_SOUL_LAST));
/** The people a foe may be (mobileTypes.js: Mage 128 to the City Watch's knight 146). */
const HUMAN_SOUL_FIRST = 128, HUMAN_SOUL_LAST = 146;
/** DFU's Soul Gem - the one item a soul is trapped in, beside Azura's Star (the table's tenth artifact, createArtifact's
 *  index 9 - ARTIFACT_RECORDS). */
const SOUL_TRAP_TEMPLATE = 274, AZURAS_STAR = 9;
/** A conjured item's group and template (createItemRows.js CREATE_ITEM_ROWS - a piece of armour, a steel weapon, the
 *  robes of either cut) - the only items that vanish. */
const SUMMONED = new Set(CREATE_ITEM_ROWS.flatMap((/** @type {any} */ r) => (r.kind === 'robes'
  ? [`MensClothing:${MENS_PLAIN_ROBES}`, `WomensClothing:${WOMENS_PLAIN_ROBES}`]
  : [`${r.kind === 'armor' ? 'Armor' : 'Weapons'}:${r.templateIndex}`])));
/** A Potent potion's share (net/alchemyLaw.js POTENT): a Journeyman's, a Master's. */
const POTENT_SHARES = Object.freeze([POTENT.pct, POTENT.masterPct]);
/** The skeleton key's world texture (mysticism.js castBySkeletonKey) - an artifact's alone. */
const SKELETON_KEY_TEXTURE = Object.freeze({ archive: 432, record: 20 });
/** An artifact's index (createArtifact: `(i << 1) | 1`, i in 0..22). */
const ARTIFACT_BITFIELD_MAX = 45;
/** The provenance id the service mints for a crafted piece (net/recipeLaw.js's, re-exported for the judge). */
export { PROVENANCE_RE };
/** INT4: a valuable piece's id (systems/itemIds.js mints it): 16 hex. */
export const ITEM_UID_RE = /^[0-9a-f]{16}$/;
/** The prices the Broker takes, in stones. */
const BROKER_STONES = new Set(Object.values(BROKER_PRICES));

/** Roleplay & Realism: Items' bandage (rriRealism.js): it stacks under the mod's bandaging - a setting each client keeps,
 *  so the law takes a stack either way. */
const BANDAGE = Object.freeze({ group: 'UselessItems2', templateIndex: BANDAGE_TEMPLATE });
/** Whether a piece's kind stacks: inventory.js isStackable's law (a worn mark and a quest's aside - a quest's "Item _x_
 *  gold" is one stack the quest hands over), its row's own word read through the law's templates (a row a headless
 *  reader never registered), and the bandage. */
const stacks = (/** @type {any} */ item, /** @type {any} */ row) => isStackable({ ...item, equipSlot: undefined, questItem: undefined }) || row?.isIngredient === true || row?.stackable === true
  || (item.group === BANDAGE.group && item.templateIndex === BANDAGE.templateIndex);
/** Gold is a count, not a stack the wire carries: a purse dropped, a wagon's coin, a death in the wild lay piles past the
 *  wire's bound (loot.js LOOT_STACK_MAX) in an honest save. */
const stackMax = (/** @type {any} */ item) => (item.group === 'Currency' && item.templateIndex === GOLD_TEMPLATE ? Number.MAX_SAFE_INTEGER : LOOT_STACK_MAX);
const isInt = (/** @type {unknown} */ v) => Number.isInteger(v);
const has = (/** @type {any} */ o, /** @type {string} */ k) => o[k] !== undefined && o[k] !== null;
/** A deep copy of a plain record, for the cross-checks that write as they read (validSetMarks rewrites a sigil). */
const copyOf = (/** @type {any} */ v) => JSON.parse(JSON.stringify(v));

/**
 * THE FINDINGS on one item: an array of short codes, empty for an item an honest client could have minted. Pure, and it
 * never writes the item. `opts.receiver` (the wire's door) skips the marks only the receiver writes - `equipSlot`,
 * `questItem` and `acquired` are stripped there, never judged.
 * @param {unknown} v @param {{ receiver?: boolean }} [opts]
 * @returns {string[]}
 */
export function itemFindings(v, opts = {}) {
  /** @type {Set<string>} */
  const out = new Set();
  if (!v || typeof v !== 'object' || Array.isArray(v)) return ['shape'];
  const item = /** @type {any} */ (v);
  // ── the shape: every declared field its declared kind ───────────────
  for (const k of Object.keys(item)) {
    if (!Object.hasOwn(ITEM_FIELDS, k) || item[k] == null) continue;   // absent is absent - a food stage writes its textures undefined
    if (validItemField(k, item[k]) === undefined) out.add('shape');
  }
  if (!isInt(item.templateIndex)) return ['template'];
  // ── identity: a template the port knows, in a group it stands in ─────
  const t = lawTemplate(item.templateIndex);
  if (!t) return ['template'];
  if (typeof item.group !== 'string' || !templateGroups(item.templateIndex).includes(item.group)) out.add('group');
  // ── material: a weapon's ladder, an armour's three makes ─────────────
  if (has(item, 'material')) {
    if (item.group === 'Weapons' && !(isInt(item.material) && item.material >= 0 && item.material <= 9)) out.add('material');
    if (item.group === 'Armor' && !ARMOR_MATERIALS.includes(item.material)) out.add('material');
  }
  // ── condition and the stack ─────────────────────────────────────────
  if (has(item, 'currentCondition') && has(item, 'maxCondition') && item.currentCondition > item.maxCondition) out.add('condition');
  if (has(item, 'stackCount') && item.stackCount > 1) {
    if (item.stackCount > stackMax(item) || !stacks(item, t)) out.add('stack');
  }
  // ── the price: a number at all ──────────────────────────────────────
  if (item.value !== undefined && !(typeof item.value === 'number' && Number.isFinite(item.value) && item.value >= 0 && item.value <= Number.MAX_SAFE_INTEGER)) out.add('value');
  // ── the classic words only a classic save writes ─────────────────────
  const classic = has(item, 'typeDependentData');
  if (has(item, 'flags') && item.flags !== 0 && !classic) out.add('flags');
  // ── a conjured item: only Create Item's, and it vanishes ─────────────
  if (has(item, 'timeForItemToDisappear') && item.timeForItemToDisappear > 0 && !SUMMONED.has(`${item.group}:${item.templateIndex}`)) out.add('summoned');
  // ── a poisoned blade, a trapped soul, an artifact's marks ────────────
  if (has(item, 'poisonType') && item.poisonType !== -1 && !(item.group === 'Weapons' && item.poisonType >= LAW_POISON_FIRST && item.poisonType <= LAW_POISON_LAST)) out.add('poison');
  if (has(item, 'trappedSoulType') && item.trappedSoulType !== -1
    && !((item.templateIndex === SOUL_TRAP_TEMPLATE || (item.artifact === true && isInt(item.artifactIndexBitfield) && item.artifactIndexBitfield >> 1 === AZURAS_STAR)) && soulLawful(item.trappedSoulType))) out.add('soul');
  if (has(item, 'artifactIndexBitfield')) {
    const b = item.artifactIndexBitfield;
    if (item.artifact !== true || !isInt(b) || b < 1 || b > ARTIFACT_BITFIELD_MAX || (b & 1) !== 1) out.add('artifact');
  }
  if (item.worldTextureArchive === SKELETON_KEY_TEXTURE.archive && item.worldTextureRecord === SKELETON_KEY_TEXTURE.record && item.artifact !== true) out.add('artifact');
  // ── the craft's marks ───────────────────────────────────────────────
  if (has(item, 'provenance') && !PROVENANCE_RE.test(item.provenance)) out.add('provenance');
  if (has(item, 'uid') && !ITEM_UID_RE.test(item.uid)) out.add('uid');
  if (has(item, 'quality') && !has(item, 'provenance') && item.quality !== 2 && item.quality !== 3) out.add('crafted');   // a found piece tempered reaches 3 (temperLaw TEMPER_TOP)
  if ((has(item, 'kitMetal') || item.fieldKit === true) && item.templateIndex !== REPAIR_KIT_TEMPLATE) out.add('crafted');
  if (has(item, 'hand') && !(item.group === 'Jewellery' && has(item, 'provenance'))) out.add('crafted');
  if (has(item, 'potent') && !(item.templateIndex === GLASS_BOTTLE_TEMPLATE && POTENT_SHARES.includes(item.potent))) out.add('crafted');
  if (has(item, 'card') && !(item.templateIndex === ILIAC_CARD_TEMPLATE && cardById(item.card))) out.add('card');
  if (has(item, 'decks') && !(item.templateIndex === CARD_BINDER_TEMPLATE && Array.isArray(item.decks) && item.decks.length <= BINDER_DECKS_MAX
    && item.decks.every((/** @type {any} */ d) => Array.isArray(d?.cards) && d.cards.every((/** @type {string} */ c) => cardById(c))))) out.add('card');
  // ── a wagon's mark: on DFU's Small Cart alone, and a marked kind at its own price (WAGONS2 AUDIT: a row marked a
  //    Caravan at the cart's 150 sold as a Caravan at the cart's price) ──
  if ((has(item, 'wagonKind') || has(item, 'wagonLook') || has(item, 'wagonEntry')) && item.templateIndex !== TRANSPORT_SMALL_CART) out.add('wagon');
  if (has(item, 'wagonKind') && item.wagonKind !== 'cart' && !(item.value >= (WAGON_KINDS[item.wagonKind]?.value ?? Infinity))) out.add('wagon');
  // ── the Broker's binding ────────────────────────────────────────────
  if (has(item, 'stonesPaid') && !(item.bound === true && BROKER_STONES.has(item.stonesPaid))) out.add('bound');
  // ── the ladder, the records, the sigil and the enchantments ──────────
  for (const f of tierFindings(item)) out.add(f);
  for (const f of sigilFindings(item)) out.add(f);
  for (const f of enchantmentFindings(item)) out.add(f);
  if (!opts.receiver && has(item, 'equipSlot') && item.stackCount > 1) out.add('stack');
  return [...out].sort();
}

/** Whether an item is one an honest client could have minted. */
export const lawfulItem = (/** @type {unknown} */ v, /** @type {{ receiver?: boolean }} */ opts = {}) => itemFindings(v, opts).length === 0;

// ── the ladder ───────────────────────────────────────────────────────

/** A line minted by a socket's gem (LOOT20) - its own, fixed, always last. */
const isGemLine = (/** @type {any} */ a) => a?.gem != null;
/** The groups a rolled tier may stand on (lootRarity.js rarityEligible's - a weapon, a piece of armour, a jewel, a
 *  garment). */
const TIER_GROUPS = Object.freeze(['Weapons', 'Armor', 'Jewellery', ...CLOTHING_GROUPS]);
/** The marks only a rolled tier carries. */
const TIER_MARKS = Object.freeze(['legendary', 'exalted', 'reforged', 'honed', 'imprint', 'socket', 'sockets', 'cursed']);   // GEM1: and the socket list

/** The ladder's findings: a tier only where a door rolls one, its lines its tier's, a record's lines its record's. */
function tierFindings(/** @type {any} */ item) {
  /** @type {string[]} */
  const out = [];
  const tier = item.rarity;
  const lines = Array.isArray(item.affixes) ? item.affixes : [];
  if (tier === 'aetheric') return aethericFindings(item);
  if (tier === 'gilded' || has(item, 'gilded')) return validGildedMarks(copyOf(item)) ? [] : ['gilded'];
  if (has(item, 'aetheric')) return ['aetheric'];
  if (tier == null) {
    // no tier: no line, and none of a tier's marks
    if (lines.length || TIER_MARKS.some((k) => has(item, k))) out.push('rarity');
    return out;
  }
  if (!ROLLED_TIERS.includes(tier)) return ['rarity'];   // 'common' and 'artifact' are the ladder's words for a reading, never written
  if (!TIER_GROUPS.includes(item.group) || item.artifact === true || item.magic === true || item.questItem === true) return ['rarity'];
  if (item.group === 'Weapons' && isAmmunition(item) && tier !== 'magic') return ['rarity'];   // AUDIT-THUNDERLOCK F4: a Pellet stack rolled Magic before it - kept, never more
  // every line: a kind the group may carry, a param the kind names on this piece, a value inside the widest band
  const own = lines.filter((a) => !isGemLine(a));
  const gems = lines.filter(isGemLine);
  if (gems.length && !isGemLine(lines[lines.length - 1])) out.push('affixes');   // a gem's line is set last
  for (const a of own) {
    if (!validAffix(a) || !AFFIX_KINDS[a.id].groups.includes(item.group)) { out.push('affixes'); continue; }
    const params = kindParams(a.id, item);
    if (params && !params.includes(a.param)) out.push('affixes');
  }
  // no kind repeated (a kind with params: no param repeated)
  const seen = new Set(own.map((a) => (AFFIX_KINDS[a?.id]?.params ? `${a.id}:${a.param}` : a?.id)));
  if (seen.size !== own.length) out.push('affixes');
  // TECH1 (bible/05-Combat/Weapon-Techniques.md): A TECHNIQUE LINE - one at most, of the piece's own family (kindParams,
  // above, already refused another family's), and the piece's LAST own line: the door's technique pass is its last draw,
  // so the Exalted's line and a curse's stand before it, and only a set gem's comes after. It is no number and no proc:
  // the counts below are the other lines'.
  const techs = own.filter((a) => AFFIX_KINDS[a?.id]?.technique);
  if (techs.length > 1 || (techs.length === 1 && own[own.length - 1] !== techs[0])) out.push('affixes');
  const body = own.filter((a) => !AFFIX_KINDS[a?.id]?.technique);
  if (!validCurse(item)) out.push('curse');
  if (!validSocket(item)) out.push('socket');
  if (!validImprint(item)) out.push('imprint');
  if ((has(item, 'socket') || has(item, 'sockets')) && (has(item, 'provenance') || item.bound === true)) out.push('socket');   // GEM1: the list as the string
  const procs = body.filter((a) => AFFIX_KINDS[a?.id]?.proc);
  const numbers = body.filter((a) => !AFFIX_KINDS[a?.id]?.proc);
  if (tier === 'magic' || tier === 'rare') {
    const [lo, hi] = AFFIX_COUNTS[tier];
    // a curse's line is one more - and stays when the temple lifts the curse (lootCurse.js liftCurse keeps it, by design;
    // AUDIT INT: 405 of 760 lifted Rares were findings). A Rare may carry one past its count, cursed or lifted
    const extra = tier === 'rare' ? 1 : 0;
    if (numbers.length < lo || numbers.length > hi + extra || procs.length > 1) out.push('affixes');
    for (const a of own) {
      const band = AFFIX_RANGES[a?.id]?.[tier];
      if (band && !(a.value >= band[0] && a.value <= band[1])) out.push('affixes');
    }
    if (has(item, 'legendary') || item.exalted === true) out.push('rarity');
    if (has(item, 'reforged') && !(item.reforged < own.length)) out.push('reforged');
    if (tier === 'rare') {
      const flavour = firstOwnRow(item);
      const flavours = RARE_FLAVOURS[item.group] ?? RARE_FLAVOURS.Jewellery;
      if (!flavour || !flavours.some((f) => f.type === flavour.type && f.param === flavour.param)) out.push('enchantments');
    }
    return out;
  }
  // a Legendary: its record, its record's lines, then one Exalted line or one curse line, then a gem's
  const rec = legendaryById(item.legendary);
  if (!rec || !legendariesFor(item).some((l) => l.id === rec.id)) return [...out, 'legendary'];
  const sig = rec.affixes;
  if (body.length < sig.length) return [...out, 'legendary'];
  for (const a of techs) {   // TECH1: a Legendary's technique line, rolled in the Legendary band
    const band = AFFIX_RANGES.technique.legendary;
    if (!(a.value >= band[0] && a.value <= band[1])) out.push('affixes');
  }
  for (let i = 0; i < sig.length; i++) {
    const a = body[i], w = sig[i];
    // a record's line is its record's kind and param, never past its value - a signature is never reforged or honed
    if (a?.id !== w.id || (a.param ?? null) !== (w.param ?? null) || !(a.value >= 1 && a.value <= w.value)) out.push('legendary');
  }
  const extra = body.slice(sig.length);
  if (extra.length > 1) out.push('affixes');
  if (extra.length === 1) {
    const a = extra[0];
    const band = AFFIX_RANGES[a?.id]?.legendary;
    const top = band ? Math.ceil((band[0] + band[1]) / 2) : Infinity;
    const onRecord = sig.some((w) => w.id === a?.id && (w.param ?? null) === (a?.param ?? null));
    if (!band || a.value < top || a.value > band[1] || onRecord) out.push('affixes');
    // an Exalted's line, a curse's - or a curse's the temple lifted (no mark of either, and a number, as a curse's is:
    // AUDIT INT, every lifted Legendary was a finding)
    if (item.exalted !== true && AFFIX_KINDS[a?.id]?.proc) out.push(isCursed(item) ? 'curse' : 'affixes');
  } else if (item.exalted === true || isCursed(item)) out.push('affixes');   // an Exalted's line or a curse's, never neither
  if (item.exalted === true && isCursed(item)) out.push('curse');
  if (has(item, 'reforged') && !(item.exalted === true && item.reforged === sig.length)) out.push('reforged');
  if (has(item, 'honed') && item.exalted !== true) out.push('honed');
  const first = firstOwnRow(item);
  if (!first || first.type !== rec.enchantment?.type || first.param !== rec.enchantment?.param) out.push('enchantments');
  return out;
}

/** The item's first enchantment row that no maker laid (the rolled flavour, the record's own). */
const firstOwnRow = (/** @type {any} */ item) => (Array.isArray(item.enchantments) ? item.enchantments : []).find((e) => !isMakerRow(e)) ?? null;

/** An Aetheric piece: its record, minted whole (aetheric.js validSetMarks), and none of a roll's marks. */
function aethericFindings(/** @type {any} */ item) {
  if (!validSetMarks(copyOf(item))) return ['aetheric'];
  if (TIER_MARKS.some((k) => has(item, k)) || (Array.isArray(item.enchantments) && item.enchantments.length)) return ['aetheric'];
  return [];
}

// ── the sigil ────────────────────────────────────────────────────────

/** A sigil only as the win, the Broker or a record stamps one: a weapon's power inside its tier's band and over the
 *  fight's floor, a set the world's (or the piece's own Aetheric record's), never on a piece no door laddered. */
function sigilFindings(/** @type {any} */ item) {
  const s = item.sigil;
  if (s == null) return [];
  if (!validSigil(s)) return ['sigil'];
  if (item.rarity === 'aetheric') return [];   // aethericFindings held it to its record
  const kind = setPieceKind(item);
  if (!kind || item.artifact === true || item.questItem === true || item.rarity === 'gilded' || has(item, 'provenance')) return ['sigil'];
  const tier = rarityOf(item);
  const band = SIGIL_BANDS[tier];
  if (!band) return ['sigil'];   // a common piece carries none
  if (s.power !== undefined && (kind !== 'weapon' || s.power < sigilFloor(tier, s.party) || s.power > band[1])) return ['sigil'];
  if (s.set !== undefined && (!WORLD_SET_IDS.includes(s.set) || setById(s.set)?.aetheric)) return ['sigil'];
  return [];
}

// ── the enchantments ─────────────────────────────────────────────────

/** A row the item maker laid: the catalogue's settings row, its type made the classic number (enchanting.js
 *  applyEnchantments) - it carries the settings' `enchantCost`. */
const isMakerRow = (/** @type {any} */ e) => e != null && typeof e === 'object' && e.enchantCost !== undefined;
/** The groups the item maker takes (ui/itemMakerWindow.js itemMakerFilter). */
const MAKER_GROUPS = Object.freeze(['Weapons', 'Armor', 'Gems', 'Jewellery', ...CLOTHING_GROUPS]);
/** A classic save's ten slots, kept whole by its importer (classicSave.js classicItemFromRecord) - `None` among them. */
const classicSlots = (/** @type {any[]} */ rows) => rows.length === 10 && rows.some((e) => e?.type === T.None);

// ── DFU's magic items, by its own table ──────────────────────────────
//
// DFU's MagicItemTemplates.txt (Assets/Resources, "a JSON dump of fixed MAGIC.DEF" - DFU's ItemHelper; MIT) is MAGIC.DEF
// as DFU reads it: 36 regular magic items, each ONE enchantment, and 23 artifacts, each a fixed set. The port reads the
// player's own MAGIC.DEF (shared.js loadMagicRegistries), which DFU's fixes may differ from in a row's PARAM - never in
// the rows' kinds or their count - so the law holds the kinds and the counts, and leaves the params to the catalogue's
// range. Pinned to the file's rows by test/int1_itemlaw.test.js.

/** The kinds a regular magic item's one row is (every RegularMagicItem row of the table). */
export const REGULAR_MAGIC_TYPES = Object.freeze([T.CastWhenUsed, T.CastWhenHeld, T.CastWhenStrikes, T.VampiricEffect, T.AbsorbsSpells, T.EnhancesSkill]);
/** The artifacts in the table's order (createArtifact's index - `artifactIndexBitfield >> 1`): each one's ItemGroups
 *  number and index in it, and its rows' kinds. */
export const ARTIFACT_RECORDS = Object.freeze([
  [25, 2, [T.SpecialArtifactEffect]], [3, 0, [T.SpecialArtifactEffect]], [3, 11, [T.SpecialArtifactEffect]], [25, 2, [T.SpecialArtifactEffect]],
  [15, 11, [T.SpecialArtifactEffect]], [7, 0, [T.SpecialArtifactEffect]], [3, 2, [T.SpecialArtifactEffect]], [25, 2, [T.SpecialArtifactEffect]],
  [25, 0, [T.SpecialArtifactEffect]], [25, 0, [T.SpecialArtifactEffect]],
  [3, 13, [T.CastWhenStrikes, T.CastWhenStrikes]],   // Volendrung
  [25, 2, [T.CastWhenHeld, T.CastWhenUsed, T.CastWhenUsed]],   // Warlock's Ring
  [3, 17, [T.CastWhenStrikes, T.CastWhenStrikes, T.CastWhenStrikes]],   // Auriel's Bow
  [25, 0, [T.CastWhenHeld, T.CastWhenUsed, T.AbsorbsSpells]],   // Necromancer's Amulet
  [3, 9, [T.CastWhenUsed, T.CastWhenUsed, T.CastWhenUsed, T.EnhancesSkill]],   // Chrysamere
  [2, 0, [T.RegensHealth, T.CastWhenUsed, T.CastWhenUsed]],   // Lord's Mail
  [3, 2, [T.CastWhenHeld, T.RegensHealth]],   // Staff of Magnus
  [25, 2, [T.CastWhenUsed, T.CastWhenHeld]],   // Ring of Khajiit
  [2, 0, [T.StrengthensArmor, T.CastWhenUsed, T.CastWhenUsed, T.CastWhenUsed]],   // Ebony Mail
  [2, 10, [T.CastWhenUsed, T.CastWhenHeld, T.CastWhenUsed, T.StrengthensArmor]],   // Auriel's Shield
  [2, 10, [T.CastWhenHeld, T.CastWhenUsed]],   // Spell Breaker
  [25, 5, [T.CastWhenUsed, T.EnhancesSkill]],   // Skeleton's Key
  [3, 8, [T.CastWhenStrikes, T.CastWhenStrikes, T.CastWhenUsed, T.EnhancesSkill]],   // Ebony Blade
].map((/** @type {any} */ [group, index, types]) => Object.freeze({ group: /** @type {number} */ (group), index: /** @type {number} */ (index), types: /** @type {number[]} */ (types) })));
/** The rows a piece's table record leaves room for: every live row's kind, counted, within the record's. */
const withinKinds = (/** @type {any[]} */ rows, /** @type {number[]} */ types) => {
  const left = [...types];
  for (const e of rows) {
    if (e.type === T.None) continue;
    const i = left.indexOf(e.type);
    if (i < 0) return false;
    left.splice(i, 1);
  }
  return true;
};
/** A regular magic item (createRegularMagicItem): one row - a kind the table's regular items carry. */
function regularMagicFindings(/** @type {any[]} */ found) {
  const live = found.filter((e) => e.type !== T.None);
  return live.length === 1 && REGULAR_MAGIC_TYPES.includes(live[0].type) ? [] : ['enchantments'];
}
/** An artifact (createArtifact, or a classic save's - legacyArtifactIndexBitfieldCheck): its index, its record's template,
 *  its record's rows' kinds. */
function artifactFindings(/** @type {any} */ item, /** @type {any[]} */ found) {
  const b = item.artifactIndexBitfield;
  const rec = isInt(b) && (b & 1) === 1 ? ARTIFACT_RECORDS[b >> 1] : null;
  if (!rec) return ['artifact'];
  if (item.templateIndex !== GROUP_TEMPLATE_INDICES[ITEM_GROUP_NAME_BY_CLASS[rec.group]]?.[rec.index]) return ['artifact'];
  return withinKinds(found, rec.types) ? [] : ['artifact'];
}

/** A CLASSIC SAVE'S PIECE: ten slots kept whole by its importer (classicSave.js classicItemFromRecord), `None` among them
 *  - an offline character's, come into the realm through customs. The classic item maker's own law is not this tree's,
 *  so the law takes the piece as it stands, and the realm keeps it the character's: no route of the service hands it to
 *  another player (realm.js prepareRealmRecord, realmTrade.js - 'piece-legacy'; RESTORE's word for what customs brings,
 *  Mac: "Keep all, can't sell"). AUDIT INT: ten slots dressed so carried any nine powers to the market. */
export const classicPiece = (/** @type {any} */ item) => !!item && typeof item === 'object' && item.artifact !== true && item.magic !== true
  && Array.isArray(item.enchantments) && classicSlots(item.enchantments);

/** The enchantments' findings: rows the catalogue knows, an artifact's effect on an artifact, the maker's rows within
 *  the maker's law and the item's budget. */
function enchantmentFindings(/** @type {any} */ item) {
  /** @type {string[]} */
  const out = [];
  if (Array.isArray(item.customEnchantments) && item.customEnchantments.length) out.push('enchantments');   // nothing in this tree writes it
  const rows = Array.isArray(item.enchantments) ? item.enchantments : [];
  // DFU's own magic is never without its rows - an artifact's or a magic item's flag on a piece without them is a word
  if (!rows.length) return item.artifact === true ? [...out, 'artifact'] : item.magic === true ? [...out, 'enchantments'] : out;
  if (rows.length > MAX_ENCHANTMENTS + 1) return [...out, 'enchantments'];   // DFU's cap keeps eleven (enchanting.js applyEnchantments)
  for (const e of rows) {
    if (!e || typeof e !== 'object') return [...out, 'enchantments'];   // AUDIT INT: a null row threw, and the checkpoint with it
    if (!(e.type >= T.None && e.type <= T.SpecialArtifactEffect) || !(e.param >= -128 && e.param <= 127)) return [...out, 'enchantments'];
    if (e.type === T.SpecialArtifactEffect && item.artifact !== true) return [...out, 'artifact'];
  }
  const maker = rows.filter(isMakerRow);
  const found = rows.filter((e) => !isMakerRow(e));
  // DFU'S OWN MAGIC (AUDIT INT: `magic: true` carried any ten rows; `artifact: true` any power) - proven by DFU's table
  if (item.artifact === true) out.push(...artifactFindings(item, found));
  else if (item.magic === true) out.push(...regularMagicFindings(found));
  else if (!classicSlots(rows)) {
    // found rows: a rolled tier's flavour or record (tierFindings held it), a curse's drawback (validCurse), a crafted
    // jewel's roll - never anything else on an item no MAGIC.DEF made
    const tier = item.rarity;
    const expected = (tier === 'rare' || tier === 'legendary' ? 1 : 0) + (isCursed(item) ? 1 : 0);
    if (found.length > expected) out.push('enchantments');
  }
  if (maker.length) out.push(...makerFindings(item, rows, maker));
  return out;
}

/** The item maker's own law over the rows it laid (enchanting.js enchantDecision, enchantmentCatalogue.js pickEnchantment):
 *  each row the catalogue costs; the group the window takes; a weapon's effect on a weapon; one of a kind where the kind
 *  allows one; no excluded pair; a soul's forced rows whole, beside their soul; and every chosen row's cost - the
 *  catalogue's, never the cost a row says of itself - within the item's power. */
function makerFindings(/** @type {any} */ item, /** @type {any[]} */ rows, /** @type {any[]} */ maker) {
  if (!MAKER_GROUPS.includes(item.group) || (item.group === 'Weapons' && item.templateIndex === ARROW_TEMPLATE)) return ['enchantments'];   // the window lists every weapon but the Arrow (itemMakerFilter)
  if (item.rarity === 'aetheric' || item.rarity === 'gilded') return ['enchantments'];
  /** @type {any[]} */
  const chosen = [];
  /** @type {Map<string, any[]>} */
  const forcedBy = new Map();
  for (const e of maker) {
    const key = TYPE_KEY[e.type];
    const parent = typeof e.parentEnchantment === 'string' ? e.parentEnchantment : 0;
    const row = key ? enchantmentSettings(key, e.param, { parent }) : null;
    if (!row) return ['enchantments'];
    if (parent) forcedBy.set(parent, [...(forcedBy.get(parent) ?? []), { key, param: e.param }]);
    else chosen.push({ key, param: e.param, cost: row.enchantCost });
  }
  // a soul's forced rows: beside their SoulBound, and exactly its set
  for (const [parent, got] of forcedBy) {
    const m = /^SoulBound:(-?\d+)$/.exec(parent);
    if (!m) return ['enchantments'];
    const p = Number(m[1]);
    if (!chosen.some((c) => c.key === 'SoulBound' && c.param === p)) return ['enchantments'];
    const want = forcedEnchantments('SoulBound', p);
    const all = want ? [...want.powers, ...want.sideEffects].map((w) => `${w.type}:${w.param}`).sort() : [];
    if (all.join('|') !== got.map((g) => `${g.key}:${g.param}`).sort().join('|')) return ['enchantments'];
  }
  // the window's filters over the rows a player chose
  const counts = new Map();
  for (const c of chosen) {
    if (hasItemMakerFlag(c.key, ITEM_MAKER_FLAGS.WeaponOnly) && item.group !== 'Weapons') return ['enchantments'];
    // one of a kind where the kind allows one - a kind that allows many takes even its one setting twice (the window's
    // own: primaryPick's single-setting arm adds it again, past the list's filter), within the budget below
    const many = hasItemMakerFlag(c.key, ITEM_MAKER_FLAGS.AllowMultiplePrimaryInstances) || hasItemMakerFlag(c.key, ITEM_MAKER_FLAGS.AllowMultipleSecondaryInstances);
    counts.set(c.key, (counts.get(c.key) ?? 0) + 1);
    if (counts.get(c.key) > 1 && !many) return ['enchantments'];
    const ex = /** @type {any} */ (ENCHANTMENT_EXCLUSIONS)[c.key];
    if (ex?.pairs?.some((/** @type {string} */ o) => chosen.some((d) => d.key === o))) return ['enchantments'];
    if (ex?.sameParam?.some((/** @type {string} */ o) => chosen.some((d) => d.key === o && d.param === c.param))) return ['enchantments'];
  }
  // the budget: the chosen rows and a crafted jewel's kept rows, against the item's power
  const kept = craftedJewelRecipe(item) ? rows.filter((e) => !isMakerRow(e)) : [];
  let cost = chosen.reduce((s, c) => s + c.cost, 0);
  for (const e of kept) {
    const key = TYPE_KEY[e.type];
    const row = key ? enchantmentSettings(key, e.param) : null;
    if (!row) return ['enchantments'];
    cost += row.enchantCost;
  }
  if (cost > itemEnchantmentPower(item, lawTemplate)) return ['enchantments'];
  return [];
}

// ── what the wealth measure counts ───────────────────────────────────

/** A generous ceiling on an item's honest price: its base (doubled twice over - a fur, a shelf potion, a quality), its
 *  lines', a Rare's and an Exalted's worth, an Aetheric's or a Gilded's, and a margin for a soul, a jewel's gem and a
 *  potent brew. A MAGIC.DEF item's own price is the player's data's, never this tree's: its ceiling is the margin's
 *  tenfold. */
export const WORTH_MARGIN = 10_000;
export function worthCeiling(/** @type {any} */ item) {
  if (!item || typeof item !== 'object' || !lawTemplate(item.templateIndex)) return 0;
  const base = itemBaseValue(item, lawTemplate) * 4;
  const lines = affixesWorth(Array.isArray(item.affixes) ? item.affixes.filter(validAffix) : [], item);
  const legacy = item.magic === true || item.artifact === true ? WORTH_MARGIN * 10 : 0;
  return base + lines + RARE_ENCHANT_WORTH + EXALTED_WORTH + (aethericById(item.aetheric) ? AETHERIC_WORTH : 0) + (has(item, 'gilded') ? GILDED_WORTH : 0) + WORTH_MARGIN + legacy;
}
/** What one item is worth to the wealth measure: its price, never past its ceiling and never under what the piece IS - its
 *  base and its lines' worth (AUDIT INT: a forged piece priced at nothing was worth nothing to the budget) - times its
 *  stack. A letter of credit is gold (realmGoldLaw.js liquidWorthOf counts it) and is not an item's worth here. */
export function itemWorth(/** @type {any} */ item) {
  if (!item || typeof item !== 'object' || !lawTemplate(item.templateIndex)) return 0;
  const value = typeof item.value === 'number' && Number.isFinite(item.value) && item.value > 0 ? item.value : 0;
  const stack = isInt(item.stackCount) && item.stackCount > 1 ? item.stackCount : 1;
  const floor = itemBaseValue(item, lawTemplate) + affixesWorth(Array.isArray(item.affixes) ? item.affixes.filter(validAffix) : [], item);
  return Math.max(Math.min(value, worthCeiling(item)), floor) * stack;
}

setItemLaw(itemFindings);
