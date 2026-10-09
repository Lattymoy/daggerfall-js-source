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
import {
  AFFIX_KINDS, AFFIX_RANGES, AFFIX_COUNTS, RARE_FLAVOURS, kindParams, validAffix, legendaryById, legendariesFor, isGarment,
  CLOTHING_GROUPS, validImprint, validCurse, validSocket, isCursed, affixesWorth, RARE_ENCHANT_WORTH, EXALTED_WORTH, rarityOf,
} from './lootRarity.js';
import { ROLLED_TIERS } from './rarityTier.js';
import { validSetMarks, aethericById, AETHERIC_WORTH } from './aetheric.js';
import { validGildedMarks, GILDED_WORTH } from './gilded.js';
import { SIGIL_BANDS, sigilFloor, validSigil } from './sigil.js';
import { setPieceKind, setById, WORLD_SET_IDS } from './sigilSets.js';
import { BROKER_PRICES } from './sigilBroker.js';
import { ENCHANTMENT_TYPES } from '../formats/magicDef.js';
import { enchantmentSettings, forcedEnchantments, hasItemMakerFlag, ITEM_MAKER_FLAGS, ENCHANTMENT_EXCLUSIONS } from './enchantmentCatalogue.js';
import { itemEnchantmentPower, craftedJewelRecipe, MAX_ENCHANTMENTS } from './enchanting.js';
import { isStackable, ARROW_TEMPLATE } from './inventory.js';
import { setItemLaw, LOOT_STACK_MAX } from './loot.js';
import { CREATE_ITEM_ROWS, MENS_PLAIN_ROBES, WOMENS_PLAIN_ROBES } from './createItemRows.js';
import { cardById } from '../net/iliacCards.js';
import { PROVENANCE_RE } from '../net/recipeLaw.js';
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
import './walletItem.js';
import './iliacItems.js';
import './livingWorld/keepsake.js';
import './legacy/heirloom.js';
import './comeSailAwayItems.js';
import './naval/navalStores.js';

/** The law's version - a finding names the law that found it, so a law loosened later can be asked again. */
export const ITEM_LAW_VERSION = 1;

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
  Gems: Object.freeze([570, 571]),
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
/** The poisons a foe's blade carries (poisons.js POISON_START_VALUE and its eight), or none (-1). */
const POISON_MIN = 128, POISON_MAX = 135;
/** A soul a trap may hold (enchantmentCatalogue SOUL_COUNT: EnemyBasics' first 43). */
const SOUL_MAX = 42;
/** DFU's Soul Gem - the one item a soul is trapped in, beside Azura's Star (an artifact). */
const SOUL_TRAP_TEMPLATE = 274;
/** A conjured item's group and template (createItemRows.js CREATE_ITEM_ROWS - a piece of armour, a steel weapon, the
 *  robes of either cut) - the only items that vanish. */
const SUMMONED = new Set(CREATE_ITEM_ROWS.flatMap((/** @type {any} */ r) => (r.kind === 'robes'
  ? [`MensClothing:${MENS_PLAIN_ROBES}`, `WomensClothing:${WOMENS_PLAIN_ROBES}`]
  : [`${r.kind === 'armor' ? 'Armor' : 'Weapons'}:${r.templateIndex}`])));
/** The Repair Kit's template (profTemplates.js), the Glass Bottle's (a potion's), a card's and a Card Binder's. */
const KIT_TEMPLATE = 692, BOTTLE_TEMPLATE = 83, CARD_TEMPLATE = 581, BINDER_TEMPLATE = 582;
/** A Card Binder holds at most this many decks (iliacItems.js). */
const BINDER_DECKS_MAX = 12;
/** A Potent potion's share (net/alchemyLaw.js): a Journeyman's 25, a Master's 40. */
const POTENT_SHARES = Object.freeze([25, 40]);
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
const GOLD_TEMPLATE = 276;
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
  if (has(item, 'poisonType') && item.poisonType !== -1 && !(item.group === 'Weapons' && item.poisonType >= POISON_MIN && item.poisonType <= POISON_MAX)) out.add('poison');
  if (has(item, 'trappedSoulType') && item.trappedSoulType !== -1
    && !((item.templateIndex === SOUL_TRAP_TEMPLATE || item.artifact === true) && isInt(item.trappedSoulType) && item.trappedSoulType >= 0 && item.trappedSoulType <= SOUL_MAX)) out.add('soul');
  if (has(item, 'artifactIndexBitfield')) {
    const b = item.artifactIndexBitfield;
    if (item.artifact !== true || !isInt(b) || b < 1 || b > ARTIFACT_BITFIELD_MAX || (b & 1) !== 1) out.add('artifact');
  }
  if (item.worldTextureArchive === SKELETON_KEY_TEXTURE.archive && item.worldTextureRecord === SKELETON_KEY_TEXTURE.record && item.artifact !== true) out.add('artifact');
  // ── the craft's marks ───────────────────────────────────────────────
  if (has(item, 'provenance') && !PROVENANCE_RE.test(item.provenance)) out.add('provenance');
  if (has(item, 'uid') && !ITEM_UID_RE.test(item.uid)) out.add('uid');
  if (has(item, 'quality') && !has(item, 'provenance') && item.quality !== 2 && item.quality !== 3) out.add('crafted');   // a found piece tempered reaches 3 (temperLaw TEMPER_TOP)
  if ((has(item, 'kitMetal') || item.fieldKit === true) && item.templateIndex !== KIT_TEMPLATE) out.add('crafted');
  if (has(item, 'hand') && !(item.group === 'Jewellery' && has(item, 'provenance'))) out.add('crafted');
  if (has(item, 'potent') && !(item.templateIndex === BOTTLE_TEMPLATE && POTENT_SHARES.includes(item.potent))) out.add('crafted');
  if (has(item, 'card') && !(item.templateIndex === CARD_TEMPLATE && cardById(item.card))) out.add('card');
  if (has(item, 'decks') && !(item.templateIndex === BINDER_TEMPLATE && item.decks.length <= BINDER_DECKS_MAX
    && item.decks.every((/** @type {any} */ d) => d.cards.every((/** @type {string} */ c) => cardById(c))))) out.add('card');
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
const TIER_MARKS = Object.freeze(['legendary', 'exalted', 'reforged', 'honed', 'imprint', 'socket', 'cursed']);

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
  if (!validCurse(item)) out.push('curse');
  if (!validSocket(item)) out.push('socket');
  if (!validImprint(item)) out.push('imprint');
  if (has(item, 'socket') && (has(item, 'provenance') || item.bound === true)) out.push('socket');
  const procs = own.filter((a) => AFFIX_KINDS[a?.id]?.proc);
  const numbers = own.filter((a) => !AFFIX_KINDS[a?.id]?.proc);
  if (tier === 'magic' || tier === 'rare') {
    const [lo, hi] = AFFIX_COUNTS[tier];
    const cursed = isCursed(item) ? 1 : 0;
    if (numbers.length < lo || numbers.length > hi + cursed || procs.length > 1) out.push('affixes');
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
  if (own.length < sig.length) return [...out, 'legendary'];
  for (let i = 0; i < sig.length; i++) {
    const a = own[i], w = sig[i];
    // a record's line is its record's kind and param, never past its value - a signature is never reforged or honed
    if (a?.id !== w.id || (a.param ?? null) !== (w.param ?? null) || !(a.value >= 1 && a.value <= w.value)) out.push('legendary');
  }
  const extra = own.slice(sig.length);
  if (extra.length > 1) out.push('affixes');
  if (extra.length === 1) {
    const a = extra[0];
    const band = AFFIX_RANGES[a?.id]?.legendary;
    const top = band ? Math.ceil((band[0] + band[1]) / 2) : Infinity;
    const onRecord = sig.some((w) => w.id === a?.id && (w.param ?? null) === (a?.param ?? null));
    if (!band || a.value < top || a.value > band[1] || onRecord) out.push('affixes');
    if (item.exalted !== true && !isCursed(item)) out.push('affixes');
    if (isCursed(item) && AFFIX_KINDS[a?.id]?.proc) out.push('curse');
  } else if (item.exalted === true || isCursed(item)) out.push('affixes');
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

/** The enchantments' findings: rows the catalogue knows, an artifact's effect on an artifact, the maker's rows within
 *  the maker's law and the item's budget. */
function enchantmentFindings(/** @type {any} */ item) {
  /** @type {string[]} */
  const out = [];
  if (Array.isArray(item.customEnchantments) && item.customEnchantments.length) out.push('enchantments');   // nothing in this tree writes it
  const rows = Array.isArray(item.enchantments) ? item.enchantments : [];
  if (!rows.length) return out;
  if (rows.length > MAX_ENCHANTMENTS + 1) return [...out, 'enchantments'];   // DFU's cap keeps eleven (enchanting.js applyEnchantments)
  for (const e of rows) {
    if (!(e.type >= T.None && e.type <= T.SpecialArtifactEffect) || !(e.param >= -128 && e.param <= 127)) return [...out, 'enchantments'];
    if (e.type === T.SpecialArtifactEffect && item.artifact !== true) return [...out, 'artifact'];
  }
  const legacy = item.magic === true || item.artifact === true || classicSlots(rows);
  const maker = rows.filter(isMakerRow);
  const found = rows.filter((e) => !isMakerRow(e));
  if (!legacy) {
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
/** What one item is worth to the wealth measure: its price, never past its ceiling, times its stack. A letter of credit
 *  is gold (realmGoldLaw.js liquidWorthOf counts it) and is not an item's worth here. */
export function itemWorth(/** @type {any} */ item) {
  if (!item || typeof item !== 'object') return 0;
  const value = typeof item.value === 'number' && Number.isFinite(item.value) && item.value > 0 ? item.value : 0;
  const stack = isInt(item.stackCount) && item.stackCount > 1 ? item.stackCount : 1;
  return Math.min(value, worthCeiling(item)) * stack;
}

setItemLaw(itemFindings);
