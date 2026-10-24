// @ts-check
// THE FLEET (HOLDINGS, 2026-10-03 - bible/03-World/Holdings.md; Mac: "You can also do this with ships instead of relying
// on a deed item ... Ships show their values, current health, and option to repair if theres crew (even if youre away)
// ... Introducing the new ship upgrade system. Allowing you to improve capacity, speed, health, damage, etc. This can
// utilize foraging items used within the world. Loaned ships shouldnt be able to be upgraded until the loan is paid off.
// This also introduces the ability to change your ship name for others to see ... Ship deeds can now be replaced in
// favor of the new enhanced plus UI tabs on the pause menu").
//
// THE LEDGER - every ship the player holds title to, by her number (the UID her deed placed her by, Come Sail Away's
// own; systems/comeSailAway/comeSailAway.js GetPlacedBoatWithUID): her hull and rig, her worth, the name her captain gave her, her
// refits, the bank's claim on her while the loan she was bought on stands, and the port she was last laid up at.
//
// THE BOOK - her TITLE. A deed (Come Sail Away's item 1321) no longer rides in the pack: it is entered here, and the mod's
// every law that asks for a deed - a ship's pick-up (PackBoat's deedInPack), her parts placed (takePlaceItem's swap),
// her summoning (the deed's placing) - finds it here as it found it in the pack (the book is a collection of the same
// deed items, by the same UIDs). A deed found in the pack - an older save's, a shelf's, the console's - is entered the
// first time the ledger is asked (`titleDeedsIn`).
//
// WHERE SHE IS is never stored: it is read off the world each time (afloat: a boat of hers stands; packed: her parts are
// in the pack; laid up: neither, her title in the book) - scenes/fleetHost.js. Nothing here touches a host.

import { mintDeed, BOAT_DEED_TEMPLATE, BOAT_PARTS_TEMPLATE } from './comeSailAway/comeSailAwayItems.js';
import { HULL_NAMES, HULL_PRICES, VARIANT_NAMES, HULL_VARIANT_COUNTS } from './comeSailAway/comeSailAwayBoat.js';
import { checkName, textCaught } from '../net/nameFilter.js';
import { shipFlagOf } from './naval/shipFlag.js';   // SHIP-COLOURS: her flag, through its door
import { liveryOf, LIVERY_PARTS, isPaint } from './naval/shipLivery.js';   // SHIP-LIVERY: her paint, through its door
import { fittingsOf } from './naval/deckFittings.js';   // DECK-PROPS: her fittings, through their door
import { plateMetal } from './armorMaterials.js';   // REFIT-ORES: a piece of plate's metal
import { isLocked } from './item/itemLock.js';   // REFIT-ORES: a locked piece is never melted down
import { isBound } from './item/itemBound.js';   // REFIT-ORES: nor a bound one
import { isSummoned } from './inventory.js';   // AUDIT 2: nor a conjured one
import { WEAPONS } from '../characters/weapons.js';
import { t } from './textManager.js';   // REFIT-ORES: a metal's hint in the player's language

export const FLEET_SAVE_VENDOR = 'Fleet';
export const FLEET_SAVE_VERSION = 1;
/** A ship's name: printable ASCII, this long at most (the wire carries it to every other player). */
export const SHIP_NAME_MAX = 24;

// ── THE NAME ─────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * A name a captain gives her, as it is kept and said: the printable ASCII of it (the wire's own band - net/wire.js
 * sanitizeName's), its runs of spaces closed, trimmed, SHIP_NAME_MAX at most; and allowed by the name filter every
 * player's name passes (net/nameFilter.js checkName) - and AUDIT 657 T4, word by word as a rank's name is (textCaught):
 * a ship's name is words ("Laden Gull"), checkName reads them as one, and a word the lists catch stood in one beside its
 * others - said to every crew that sees her (comeSailAwayWire.js shipNameOf judges her name again by this). An empty name
 * is her hull's again. Answers `{ ok, name, reason }`. Pure.
 */
export function shipNameVerdict(raw) {
  let s = '';
  for (const ch of String(raw ?? '')) { const c = ch.charCodeAt(0); if (c >= 32 && c <= 126) s += ch; }
  s = s.replace(/\s+/g, ' ').trim().slice(0, SHIP_NAME_MAX).trim();
  if (!s) return { ok: true, name: '', reason: null };
  const v = checkName(s);
  const caught = v.ok ? textCaught(s) : null;
  if (caught) return { ok: false, name: '', reason: `That name reads as "${caught}". Please pick another.` };
  return v.ok ? { ok: true, name: s, reason: null } : { ok: false, name: '', reason: v.reason ?? 'That name will not do.' };
}
/** What she is called where a line names her: her own name, else her hull's ("Small Ship 'I'"). */
export const shipLabel = (rec) => (rec?.name ? rec.name : `${HULL_NAMES[rec?.hull] ?? 'Boat'} '${VARIANT_NAMES[rec?.variant | 0] ?? 'I'}'`);

// ── THE REFITS ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** The materials a refit takes, and what in the world each is: a Foraging find (the Wood-Axe's Wood Bundle), an
 *  alchemist's shelf (Iron, a Pine Branch - DFU's own ingredients, the Sickle's quests' finds), or online a Stores
 *  good withdrawn to the pack (a plank or a log, an ingot, resin - net/professionLaw.js). Each item counts one. */
/** REFIT-ORES: a metal's store - its label, its metal (`metal`), its ingots' templates, and its hint in the player's language. */
const metalStore = (label, metal, templates, hint) => Object.freeze({ label, templates: Object.freeze(templates), metal, get hint() { return hint(); } });
export const MATERIALS = Object.freeze({
  timber: Object.freeze({ label: 'Timber', hint: 'Wood Bundles (gathered with a Wood-Axe), planks or logs', templates: Object.freeze([1604, 645, 646, 647, 648, 649, 650, 651, 635, 636, 637, 638, 639, 640, 641]) }),
  iron: Object.freeze({ label: 'Iron', hint: 'Iron from an alchemist, or iron and steel ingots', templates: Object.freeze([71, 620, 621]) }),
  pitch: Object.freeze({ label: 'Pitch', hint: 'Pine Branches for their resin, or Resin itself', templates: Object.freeze([14, 653]) }),
  // REFIT-ORES (2026-10-17, bible/03-World/Naval-Refit.md REFIT-ORES): the metals of DFU's ladder past iron - each its
  // forge's ingot (net/professionLaw.js 621-629; the Warforged Steel ingot, 630, counts as Ebony), or a weapon or a piece
  // of plate of that metal melted down (`metal`: DFU's WeaponMaterialTypes, and ArmorMaterialTypes' plate over it) - never
  // one worn, a quest's, or enchanted (`meltable`)
  steel: metalStore('Steel', 1, [621], () => t('naval.ore.steel', 'Steel ingots, or a steel weapon or plate melted down')),
  silver: metalStore('Silver', 2, [622], () => t('naval.ore.silver', 'Silver ingots, or a silver weapon or plate melted down')),
  elven: metalStore('Elven', 3, [623], () => t('naval.ore.elven', 'Moonstone ingots, or an elven weapon or plate melted down')),
  dwarven: metalStore('Dwarven', 4, [624], () => t('naval.ore.dwarven', 'Dwarven ingots, or a dwarven weapon or plate melted down')),
  mithril: metalStore('Mithril', 5, [625], () => t('naval.ore.mithril', 'Mithril ingots, or a mithril weapon or plate melted down')),
  adamantium: metalStore('Adamantium', 6, [626], () => t('naval.ore.adamantium', 'Adamantium ingots, or an adamantium weapon or plate melted down')),
  ebony: metalStore('Ebony', 7, [627, 630], () => t('naval.ore.ebony', 'Ebony or Warforged Steel ingots, or an ebony weapon or plate melted down')),
  orcish: metalStore('Orcish', 8, [628], () => t('naval.ore.orcish', 'Orichalcum ingots, or an orcish weapon or plate melted down')),
  daedric: metalStore('Daedric', 9, [629], () => t('naval.ore.daedric', 'Daedric ingots, or a daedric weapon or plate melted down')),
});
/** REFIT-ORES: an item's metal (DFU's WeaponMaterialTypes, 0 iron to 9 Daedric) - a weapon's, or a piece of plate's
 *  (armorMaterials.js plateMetal) - or null for anything else (leather, chain, cloth, an ingot, an arrow). */
export function refitMetalOf(item) {
  const m = item?.material;
  if (!Number.isInteger(m)) return null;
  if (item.group === 'Weapons') return item.templateIndex !== WEAPONS.Arrow && m >= 0 && m <= 9 ? m : null;
  return item.group === 'Armor' ? plateMetal(m) : null;
}
/** REFIT-ORES: whether a piece may be melted down for its metal - a PLAIN piece alone, because the refit takes its metal
 *  unasked (takeMaterials, after the ingots): never one worn, locked (item/itemLock.js), bound (item/itemBound.js), a
 *  quest's, an artifact, a sigil's (systems/aetheric.js) or a player's make (`provenance`, a minted piece's mark); never
 *  enchanted, DFU's way or the item maker's (inventory.js isEnchanted); never graded past Common - a rolled tier, its
 *  affixes, a Legendary's record, DFU's magic mark (loot/lootRarity.js rarityEligible's own list) - nor socketed. AUDIT 2:
 *  nor conjured (Create Item's, inventory.js isSummoned): a cast's steel paid a Steel tier from magicka. */
const listed = (v) => Array.isArray(v) && v.length > 0;
export const meltable = (item) => !!item && item.equipSlot == null && !isLocked(item) && !isBound(item) && !isSummoned(item) && !item.questItem
  && !item.artifact && !item.sigil && typeof item.provenance !== 'string'
  && !listed(item.enchantments) && !listed(item.customEnchantments)
  && !item.magic && (item.rarity == null || item.rarity === 'common') && !listed(item.affixes) && !item.legendary
  && item.socket == null && !listed(item.sockets);
/** Whether `item` is one of `kind`: its template, or (an ore) a meltable piece of its metal. */
const isOf = (item, kind) => { const m = MATERIALS[kind]; return !!m && !!item && (m.templates.includes(item.templateIndex) || (m.metal != null && refitMetalOf(item) === m.metal && meltable(item))); };
/** The four refits, each UPGRADE_TIERS deep: what it betters, by how much a tier, and what it is built of. Guns only on
 *  a hull that carries them. */
export const UPGRADE_LINES = Object.freeze([
  Object.freeze({ id: 'hold', label: 'Hold', what: 'More cargo before the ship slows', per: 0.2, effect: 'cargo', mats: Object.freeze(['timber', 'iron']), guns: false }),
  Object.freeze({ id: 'rigging', label: 'Rigging', what: 'Speed under sail', per: 0.04, effect: 'speed', mats: Object.freeze(['timber', 'pitch']), guns: false }),
  Object.freeze({ id: 'hull', label: 'Hull', what: 'Hull and sail strength', per: 0.1, effect: 'hull', mats: Object.freeze(['timber', 'pitch', 'iron']), guns: false }),
  Object.freeze({ id: 'guns', label: 'Guns', what: 'Broadside damage', per: 0.08, effect: 'guns', mats: Object.freeze(['iron', 'pitch']), guns: true }),
]);
/** The shipwright's own three tiers - timber, iron and pitch. */
export const BASE_TIERS = 3;
/**
 * REFIT-ORES (2026-10-17, the owner: "making improvements to the ship upgrade system" - a player's ask: "levels unlock
 * upgrading with ores from steel to Ebony and beyond"; bible/03-World/Naval-Refit.md REFIT-ORES): PAST THE THIRD TIER, A
 * TIER A METAL - DFU's ladder from Steel to Daedric, each a captain's level to reach (systems/naval/captainTree.js levelOf:
 * earned at sea), its gold for a Small Ship, its metal's count; each also asks her line's first material at the third
 * tier's count. An ore tier betters her by ORE_PER of a shipwright's tier.
 */
export const ORE_TIERS = Object.freeze([
  Object.freeze({ ore: 'steel', level: 3, gold: 6000, n: 4 }),
  Object.freeze({ ore: 'silver', level: 5, gold: 9000, n: 4 }),
  Object.freeze({ ore: 'elven', level: 8, gold: 13000, n: 5 }),
  Object.freeze({ ore: 'dwarven', level: 11, gold: 18000, n: 5 }),
  Object.freeze({ ore: 'mithril', level: 14, gold: 24000, n: 6 }),
  Object.freeze({ ore: 'adamantium', level: 17, gold: 32000, n: 6 }),
  Object.freeze({ ore: 'ebony', level: 20, gold: 42000, n: 7 }),
  Object.freeze({ ore: 'orcish', level: 24, gold: 55000, n: 7 }),
  Object.freeze({ ore: 'daedric', level: 28, gold: 70000, n: 8 }),
]);
export const ORE_PER = 0.5;
export const UPGRADE_TIERS = BASE_TIERS + ORE_TIERS.length;
/** A tier's numeral, I to XII (0 none). */
export const REFIT_NUMERALS = Object.freeze(['-', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']);
/** A tier's gold and each material's count, for a Small Ship - times her hull's share (HULL_UPGRADE_SCALE). */
export const TIER_GOLD = Object.freeze([600, 1500, 3500]);
export const TIER_MATS = Object.freeze([3, 6, 10]);
export const HULL_UPGRADE_SCALE = Object.freeze([0.5, 0.75, 1, 1.75, 2.5]);
const lineOf = (id) => UPGRADE_LINES.find((l) => l.id === id) ?? null;
const tierOf = (rec, id) => Math.max(0, Math.min(UPGRADE_TIERS, rec?.upgrades?.[id] | 0));
/** What her next tier of `line` costs: `{ gold, mats: [{ kind, n }], level }` - `level` the captain's level it asks (1:
 *  none; REFIT-ORES' metal tiers) - or null past the last. Pure. */
export function upgradeCost(hull, id, tier) {
  const line = lineOf(id);
  if (!line || !(tier >= 0 && tier < UPGRADE_TIERS)) return null;
  const k = HULL_UPGRADE_SCALE[hull] ?? 1;
  const n = (c) => Math.max(1, Math.round(c * k));
  if (tier < BASE_TIERS) return { gold: Math.round((TIER_GOLD[tier] * k) / 10) * 10, mats: line.mats.map((kind) => ({ kind, n: n(TIER_MATS[tier]) })), level: 1 };
  const ore = ORE_TIERS[tier - BASE_TIERS];
  return { gold: Math.round((ore.gold * k) / 10) * 10, mats: [{ kind: ore.ore, n: n(ore.n) }, { kind: line.mats[0], n: n(TIER_MATS[BASE_TIERS - 1]) }], level: ore.level };
}
/** What a line betters her by at `tier` (0.4: +40%) - its `per` a shipwright's tier, REFIT-ORES: ORE_PER of it a metal's. */
export function refitShare(id, tier) {
  const t = Math.max(0, Math.min(UPGRADE_TIERS, tier | 0)), per = lineOf(id)?.per ?? 0;
  return Math.min(t, BASE_TIERS) * per + Math.max(0, t - BASE_TIERS) * per * ORE_PER;
}
/** Her refits as the sea and the helm read them - each a multiple of her build's own: `cargo` her hold's threshold,
 *  `speed` her way and its coming on, `hull` her hull's and canvas's whole, `guns` her shot's harm. Pure. */
export function refitOf(rec) {
  const at = (id) => Math.round((1 + refitShare(id, tierOf(rec, id))) * 10000) / 10000;
  return { cargo: at('hold'), speed: at('rigging'), hull: at('hull'), guns: at('guns') };
}
/** The words for a line at a tier ("Cargo +40%"). */
export const refitWords = (id, tier) => { const l = lineOf(id); return l ? `${l.label} ${REFIT_NUMERALS[tier] ?? tier}` : ''; };
/** How many of `kind` stand in `lists` (each item a template of the kind, its stack counted). Pure. */
export function materialCount(lists, kind) {
  let n = 0;
  for (const list of lists) for (const it of list ?? []) if (isOf(it, kind)) n += Math.max(1, it.stackCount | 0 || 1);
  return n;
}
/** REFIT-ORES: of `n` of `kind` out of `lists`, how many would be pieces melted down - takeMaterials takes every ingot
 *  first, so only what the ingots leave short (0 for a material no piece is melted for). A piece is one measure of its
 *  metal, a blade or a helm alike. Pure. */
export function meltCount(lists, kind, n) {
  const m = MATERIALS[kind];
  if (!m || m.metal == null) return 0;
  let ingots = 0;
  for (const list of lists) for (const it of list ?? []) if (it && m.templates.includes(it.templateIndex)) ingots += Math.max(1, it.stackCount | 0 || 1);
  return Math.max(0, Math.min(n, materialCount(lists, kind)) - ingots);
}
/** AUDIT 2: whether `tpl`, one of `kind`'s templates, is another store's too (a steel ingot: Iron's and Steel's). */
const lentTemplate = (kind, tpl) => Object.keys(MATERIALS).some((k) => k !== kind && MATERIALS[k].templates.includes(tpl));
/** AUDIT 2: the order a tier's stores are taken in - a store no piece is melted for first (Iron, Timber, Pitch: its ingots
 *  and bundles alone), then a metal's, which melts down what the ingots leave it. A steel ingot is Iron's last (its
 *  templates' order) and Steel's first, so Iron takes one only when no iron is to hand, and Steel melts a blade for what
 *  it lent: taken ore first, 10 steel ingots and 4 steel swords failed a Small Ship's Guns Steel (4 Steel, 10 Iron) the
 *  stores could pay. Stable: the stores of a kind keep their order. */
const takeOrder = (mats) => [...mats].sort((a, b) => Number(MATERIALS[a.kind]?.metal != null) - Number(MATERIALS[b.kind]?.metal != null));
/** Whether every one of `mats` (`{ kind, n }`) can be taken out of `lists` together - a thing taken for one is not there
 *  for the next (REFIT-ORES: a steel ingot is Steel's and Iron's both), taken in `takeOrder`. Pure: tried on copies. */
export function materialsFor(lists, mats) {
  const copy = lists.map((l) => (l ?? []).map((it) => (it ? { ...it } : it)));
  return takeOrder(mats).every((m) => takeMaterials(copy, m.kind, m.n));
}
/** AUDIT 2: every one of `mats` taken out of `lists` as `materialsFor` tried them (`takeOrder`) - all or none. Answers
 *  whether they were taken. */
export function takeAllMaterials(lists, mats) {
  if (!materialsFor(lists, mats)) return false;
  for (const m of takeOrder(mats)) takeMaterials(lists, m.kind, m.n);
  return true;
}
/** AUDIT 2: of each of `mats`, taken together (`takeOrder`), how many would be pieces melted down - in `mats`' own order
 *  (meltCount's, after the stores before it have taken their share: the steel ingots Iron takes are not Steel's). Pure. */
export function meltCounts(lists, mats) {
  const copy = lists.map((l) => (l ?? []).map((it) => (it ? { ...it } : it)));
  const melt = new Map();
  for (const m of takeOrder(mats)) { melt.set(m, meltCount(copy, m.kind, m.n)); takeMaterials(copy, m.kind, m.n); }
  return mats.map((m) => melt.get(m) ?? 0);
}
/** `n` of `kind` taken out of `lists`, the first list first (a stack thinned, an item gone at its last) - all or none.
 *  Answers whether they were taken. */
export function takeMaterials(lists, kind, n) {
  if (materialCount(lists, kind) < n) return false;
  let left = n;
  // REFIT-ORES: the ingots first, every list over, and only then a piece melted down. AUDIT 2: a store's OWN ingots before
  // one another store counts too (a steel ingot, Iron's and Steel's both) - Iron took the pack's first, and a Steel tier's
  // ingots went to an Iron store with iron ingots to hand
  const t = MATERIALS[kind].templates, lent = t.filter((tpl) => lentTemplate(kind, tpl)), own = t.filter((tpl) => !lent.includes(tpl));
  const ingots = [own, lent].filter((ts) => ts.length).map((ts) => (it) => !!it && ts.includes(it.templateIndex));
  for (const take of [...ingots, (it) => isOf(it, kind)]) for (const list of lists) {
    for (let i = 0; list && i < list.length && left > 0;) {
      const it = list[i];
      if (!take(it)) { i++; continue; }
      const have = Math.max(1, it.stackCount | 0 || 1);
      if (have > left) { it.stackCount = have - left; left = 0; break; }
      left -= have;
      list.splice(i, 1);
    }
  }
  return true;
}

// ── THE BANK'S CLAIM ─────────────────────────────────────────────────────────────────────────────────────────────────
// SHIP-CREDIT WITHDRAWN (2026-10-08, Mac: "Remove ship buying loan from the bank"): no counter sells a boat on the bank's
// credit any more, so no purchase stamps a claim. A ship bought on it before carries hers in the save (`credit`, read
// back by restoreFleetSaveData) and keeps it - no refit while it stands - until that bank is owed nothing.
/**
 * The loan she was bought on, while it stands: the bank of `credit.region` still owed, by the loan that bought her (its
 * due date the one her purchase set - a loan taken there since for something else is not hers). Answers
 * `{ region, owed }` or null. Pure.
 */
export function loanOwed(rec, accounts) {
  const c = rec?.credit;
  if (!c || !Array.isArray(accounts)) return null;
  const a = accounts[c.region];
  // AUDIT HOLDINGS F4: owed while her region's bank is owed anything at all - its due date is no mark of the loan that
  // bought her (borrowing more puts it later, the Empire calling the debt in sets it to now, and either lifted her claim
  // with the loan unpaid); cleared for good once the Fleet sees nothing owed there (`settleCredit`)
  if (!a || !(a.loanTotal > 0)) return null;
  return { region: c.region, owed: a.loanTotal };
}
/** AUDIT HOLDINGS F4: every claim whose region's bank is owed nothing now cleared for good - the loan that bought her
 *  repaid (a later one is no claim of hers). Answers how many were cleared. */
export function settleCredit(accounts) {
  if (!Array.isArray(accounts)) return 0;
  let n = 0;
  for (const r of _ships.values()) if (r.credit && !(accounts[r.credit.region]?.loanTotal > 0)) { r.credit = null; n++; }
  return n;
}

// ── THE LEDGER ───────────────────────────────────────────────────────────────────────────────────────────────────────
const _ships = new Map();   // uid -> record
const _book = [];           // her title: the deed items, Come Sail Away's own shape (mintDeed)
const upgradesBlank = () => ({ hold: 0, rigging: 0, hull: 0, guns: 0 });
const isUid = (v) => Number.isSafeInteger(v) && v > 0;
/** AUDIT SHIPYARDS L1-2 (RESTORE's "Keep all, can't sell", a DFU deed's law, for Come Sail Away's ships): THE SHIPS THAT
 *  CAME INTO THE REALM THROUGH CUSTOMS, by number - each stays the player's and sails, and no shipyard buys her
 *  (systems/shipyards.js saleRefusal). Weightless and uncounted at customs (net/realm/realmGoldLaw.js liquidWealthOf counts none
 *  of the Fleet), a ship sold online was an offline fortune crossed whole. A number is a ship's for life, so a crossed
 *  ship stays crossed - parts, deed, standing or laid up. */
const _crossed = new Set();
const hullOk = (h) => Number.isInteger(h) && h >= 0 && h < HULL_NAMES.length;
/** AUDIT HOLDINGS F7: a variant her hull has - the Large Boat's seven, every other hull's one (SpawnBoat throws on any
 *  other: a hostile save's Large Boat 8 threw from the page's Summon). */
const variantOk = (hull, v) => Number.isInteger(v) && v >= 0 && v < Math.max(1, HULL_VARIANT_COUNTS[hull] ?? 0);
/** AUDIT HOLDINGS F7: the most a save may hold, and her worth's ceiling (gold). */
export const FLEET_MAX = 256;
/** How many crossed numbers a save keeps (every ship and boat item a crossing found, and room past them). */
export const CROSSED_MAX = 4096;
/** Whether ship `uid` came into the realm through customs. */
export const fleetCrossed = (uid) => _crossed.has(uid);
/**
 * CUSTOMS ON A SAVE'S SHIPS, in place (systems/realmCustoms.js applyCustoms): every ship number the save holds - the
 * Fleet's records, Come Sail Away's placed boats (`placedBoats`, its record's own), every boat deed and parts item in
 * `itemLists` - entered in the Fleet's record's `crossed`, the record made where the save had none. Answers how many
 * numbers it found. Pure on its arguments.
 * @param {any} modData a save's `modData` @param {any[][]} [itemLists] @param {any[]|null} [placedBoats]
 */
export function crossFleetData(modData, itemLists = [], placedBoats = null) {
  if (!modData || typeof modData !== 'object') return 0;
  const uids = new Set();
  for (const r of Array.isArray(modData[FLEET_SAVE_VENDOR]?.ships) ? modData[FLEET_SAVE_VENDOR].ships : []) if (isUid(r?.uid)) uids.add(r.uid);
  for (const b of Array.isArray(placedBoats) ? placedBoats : []) if (isUid(b?.UID)) uids.add(b.UID);
  for (const list of itemLists) {
    for (const it of Array.isArray(list) ? list : []) if ((it?.templateIndex === BOAT_DEED_TEMPLATE || it?.templateIndex === BOAT_PARTS_TEMPLATE) && isUid(it.UID)) uids.add(it.UID);
  }
  if (!uids.size) return 0;
  const rec = modData[FLEET_SAVE_VENDOR] && typeof modData[FLEET_SAVE_VENDOR] === 'object' ? modData[FLEET_SAVE_VENDOR] : (modData[FLEET_SAVE_VENDOR] = newFleetSaveData());
  const all = new Set((Array.isArray(rec.crossed) ? rec.crossed : []).filter(isUid));
  for (const u of uids) all.add(u);
  rec.crossed = [...all].slice(0, CROSSED_MAX);
  return uids.size;
}
export const SHIP_VALUE_MAX = 10000000;
/** A deed's hull and variant, read as Come Sail Away reads them (`hull * 10 + variant`). */
const hullOfItem = (it) => Math.floor((it?.message | 0) / 10);
const variantOfItem = (it) => (it?.message | 0) % 10;

/** Her record, made the first time she is named (an older deed's ship, a prize, a purchase). */
function recordFor(uid, hull, variant, value) {
  let r = _ships.get(uid);
  if (!r) {
    r = { uid, hull, variant, value: Number.isFinite(value) ? value : HULL_PRICES[hull] ?? 0, name: '', upgrades: upgradesBlank(), credit: null, port: null, colours: null, livery: null, cabin: 0, deck: [], plaque: false };   // SHIP-PLAQUE: `plaque` her name on her bows; DECK-PROPS: `deck` her fittings   // SHIP-COLOURS: `colours` her flag (null: the mod's pennant); SHIP-LIVERY: `livery` her paint (null: as built), `cabin` her cabin's stain (0: as built)
    _ships.set(uid, r);
  }
  return r;
}
export const fleetShip = (uid) => _ships.get(uid) ?? null;
export const fleetShips = () => [..._ships.values()];
/** The book: the live list of her titles (the collection Come Sail Away places a deed from, and takes it out of). */
export const fleetBook = () => _book;
/** Her title in the book, by her number. */
export const titleOf = (uid) => _book.find((it) => it?.UID === uid) ?? null;
/**
 * A DEED ENTERED: taken out of `from` (the list it lay in - the pack - or none), into the book, her record made or
 * kept; `port` where she waits. A deed already in the book is not entered twice. Answers her record, or null for an
 * item that is no deed.
 */
export function titleDeed(deed, { from = null, port = null } = {}) {
  if (deed?.templateIndex !== BOAT_DEED_TEMPLATE || !isUid(deed.UID) || !hullOk(hullOfItem(deed))) return null;
  if (from) { const i = from.indexOf(deed); if (i >= 0) from.splice(i, 1); }
  if (!titleOf(deed.UID)) _book.push(deed);
  const r = recordFor(deed.UID, hullOfItem(deed), variantOfItem(deed), deed.value);
  if (port) r.port = port;
  return r;
}
/** Every deed in `pack` entered (an older save's, a shelf's, the console's). Answers how many. */
export function titleDeedsIn(pack, opts = {}) {
  let n = 0;
  // AUDIT HOLDINGS F2: never the deed a placing holds (`except`) - entered mid-placing, the placing spent its small
  // boat's deed out of the pack, where it no longer lay, and her title stayed in the book while she stood
  for (const it of [...(pack ?? [])]) if (it?.templateIndex === BOAT_DEED_TEMPLATE && it !== opts.except && titleDeed(it, { ...opts, from: pack })) n++;
  return n;
}
/** A boat of the player's standing with no title (a small boat's parts placed - its deed spent, as the mod spends one;
 *  her parts in the pack) given her record, so her name and her refits are hers. */
export function knowShip(uid, hull, variant, value) {
  if (!isUid(uid) || !hullOk(hull)) return null;
  const r = recordFor(uid, hull, variantOk(hull, variant) ? variant : 0, value);
  // AUDIT HOLDINGS F3: her rig as she stands now (a Large Boat's picked again) - her record and her title with it, so a
  // ship laid up and called back keeps the rig she was sent away in
  if (r.hull === hull && variantOk(hull, variant) && r.variant !== variant) {
    r.variant = variant;
    const t = titleOf(uid);
    if (t) { const fresh = mintDeed(r.hull, variant, uid, t.value); t.message = fresh.message; t.name = fresh.name; }
  }
  return r;
}
/** AUDIT HOLDINGS F8: a record no ship answers (a prize whose claim failed after her title was entered) forgotten. */
export function forgetShip(uid) {
  _ships.delete(uid);
  const i = _book.findIndex((it) => it?.UID === uid);
  if (i >= 0) _book.splice(i, 1);
}
/** Her name given (`shipNameVerdict`'s): answers the verdict. */
export function renameShip(uid, raw) {
  const r = _ships.get(uid);
  if (!r) return { ok: false, name: '', reason: 'No such ship of yours.' };
  const v = shipNameVerdict(raw);
  if (v.ok) { r.name = v.name; if (!r.name) r.plaque = false; }   // SHIP-PLAQUE: a name taken off takes her board with it
  return v;
}
/** SHIP-COLOURS (bible/03-World/Naval-Refit.md): her flag set - systems/naval/shipFlag.js shipFlagOf's, or null (none:
 *  she flies the mod's pennant). Answers whether she has it now. */
export function setShipColours(uid, raw) {
  const r = _ships.get(uid);
  if (!r) return false;
  const f = raw == null ? null : shipFlagOf(raw);
  if (raw != null && !f) return false;
  r.colours = f;
  return true;
}
/** SHIP-LIVERY (bible/03-World/Naval-Refit.md): her paint set - systems/naval/shipLivery.js liveryOf's, the parts her hull
 *  does not take made none - or null (as built). Answers whether she has it now. */
export function setShipLivery(uid, raw) {
  const r = _ships.get(uid);
  if (!r || (raw != null && typeof raw !== 'object')) return false;
  const l = raw == null ? null : liveryOf(raw, r.hull);
  if (raw != null && !l && !LIVERY_PARTS.every((p) => !raw[p])) return false;   // a paint that is none at all is as built; one the door refuses is refused
  r.livery = l;
  return true;
}
/** SHIP-LIVERY (CABIN-LOOK): her cabin's stain - a paint's index (systems/naval/shipLivery.js SHIP_PAINTS), 0 as built.
 *  Answers whether she has it now. */
export function setShipCabin(uid, paint) {
  const r = _ships.get(uid);
  if (!r || !isPaint(paint)) return false;
  r.cabin = paint;
  return true;
}
/** SHIP-PLAQUE (bible/03-World/Naval-Refit.md): her name shown on her bows, or not - her captain's choice, a named ship's
 *  alone (an unnamed one has none to show). Answers whether it is as asked now. */
export function setShipPlaque(uid, on) {
  const r = _ships.get(uid);
  if (!r || typeof on !== 'boolean' || (on && !r.name)) return false;
  r.plaque = on;
  return true;
}
/** DECK-PROPS (bible/03-World/Naval-Refit.md): her deck's fittings set - systems/naval/deckFittings.js fittingsOf's (a
 *  fitting it refuses left out). Answers whether she has them now. */
export function setShipFittings(uid, raw) {
  const r = _ships.get(uid);
  if (!r || !Array.isArray(raw)) return false;
  r.deck = fittingsOf(raw);
  return true;
}
/** A refit's tier added (the caller has paid). */
export function addRefit(uid, id) {
  const r = _ships.get(uid);
  if (!r || !lineOf(id) || tierOf(r, id) >= UPGRADE_TIERS) return false;
  r.upgrades[id] = tierOf(r, id) + 1;
  return true;
}
/** The port she was laid up at (`{ name }`), or null. */
export function setShipPort(uid, port) { const r = _ships.get(uid); if (r) r.port = port ? { name: String(port.name ?? ''), ...(port.ether ? { ether: true } : {}) } : null; }   // AUDIT CAPTAIN'S SEA P5: and which side of the Veil she lies
/** Her title made again where none is (a crewed ship's parts placed swap back to her deed - the mod's takePlaceItem). */
export function retitle(uid) {
  const r = _ships.get(uid);
  if (!r || titleOf(uid)) return titleOf(uid);
  const d = mintDeed(r.hull, r.variant, uid, r.value);
  _book.push(d);
  return d;
}

// ── THE SAVE ─────────────────────────────────────────────────────────────────────────────────────────────────────────
export function newFleetSaveData() { return { v: FLEET_SAVE_VERSION, ships: [], crossed: [] }; }
export function fleetSaveData() {
  return {
    v: FLEET_SAVE_VERSION,
    ships: [..._ships.values()].map((r) => ({ uid: r.uid, hull: r.hull, variant: r.variant, value: r.value, name: r.name, upgrades: { ...r.upgrades },
      credit: r.credit ? { ...r.credit } : null, port: r.port ? { ...r.port } : null, title: !!titleOf(r.uid), ...(r.colours ? { colours: { ...r.colours } } : {}), ...(r.livery ? { livery: { ...r.livery } } : {}), ...(r.cabin ? { cabin: r.cabin } : {}), ...(r.deck?.length ? { deck: r.deck.map((f) => ({ ...f })) } : {}), ...(r.plaque ? { plaque: true } : {}) })),   // SHIP-COLOURS; SHIP-LIVERY; DECK-PROPS; SHIP-PLAQUE
    crossed: [..._crossed],   // AUDIT SHIPYARDS L1-2: the numbers that came through customs
  };
}
/** A save's record restored - every field read as it may be (a record made by hand, a newer build's): an unknown
 *  hull, a bad number, a name the filter refuses, left out or put right. */
export function restoreFleetSaveData(data) {
  _ships.clear();
  _book.length = 0;
  _crossed.clear();
  for (const u of (Array.isArray(data?.crossed) ? data.crossed : []).slice(0, CROSSED_MAX)) if (isUid(u)) _crossed.add(u);
  // AUDIT HOLDINGS F7: a save read as it may be - FLEET_MAX records at most, one a number (a second of the same uid
  // entered a second title), her variant one her hull has, her worth within [0, SHIP_VALUE_MAX], her port's name the
  // printable text a name keeps
  for (const s of (Array.isArray(data?.ships) ? data.ships : []).slice(0, FLEET_MAX)) {
    if (!s || !isUid(s.uid) || !hullOk(s.hull) || _ships.has(s.uid)) continue;
    const variant = variantOk(s.hull, s.variant) ? s.variant : 0;
    const r = recordFor(s.uid, s.hull, variant, Number.isFinite(s.value) ? Math.max(0, Math.min(SHIP_VALUE_MAX, s.value)) : undefined);
    const v = shipNameVerdict(s.name);
    r.name = v.ok ? v.name : '';
    for (const l of UPGRADE_LINES) r.upgrades[l.id] = Math.max(0, Math.min(UPGRADE_TIERS, Number(s.upgrades?.[l.id]) | 0));
    r.credit = s.credit && Number.isInteger(s.credit.region) && s.credit.region >= 0 ? { region: s.credit.region, due: Number.isFinite(s.credit.due) ? s.credit.due : 0 } : null;
    const port = typeof s.port?.name === 'string' ? printable(s.port.name).slice(0, 64) : '';
    r.port = s.port && typeof s.port.name === 'string' ? { name: port, ...(s.port.ether === true ? { ether: true } : {}) } : null;   // AUDIT CAPTAIN'S SEA P5: her side of the Veil kept
    r.colours = shipFlagOf(s.colours);   // SHIP-COLOURS: her flag, as it may be (none, or one the door refuses: her pennant)
    r.livery = liveryOf(s.livery, r.hull);   // SHIP-LIVERY: her paint, as it may be (none, or one the door refuses: as built)
    r.cabin = isPaint(s.cabin) ? s.cabin : 0;   // CABIN-LOOK: her cabin's stain
    r.deck = fittingsOf(s.deck);   // DECK-PROPS: her fittings, as the door takes them
    r.plaque = s.plaque === true && !!r.name;   // SHIP-PLAQUE: her name on her bows - a named ship's
    if (s.title) _book.push(mintDeed(r.hull, r.variant, r.uid, r.value));
  }
}
/** Printable ASCII alone (a line break or a tab a space), runs of white space closed. */
const printable = (raw) => { let t = ''; for (const ch of String(raw ?? '')) { const c = ch.charCodeAt(0); if (c >= 32 && c <= 126) t += ch; else if (/\s/.test(ch)) t += ' '; } return t.replace(/\s+/g, ' ').trim(); };
/** The ledger as a mod's save slot (systems/modSaveData.js registerModSaveData). */
export const fleetSaveSlot = Object.freeze({ newSaveData: newFleetSaveData, getSaveData: fleetSaveData, restoreSaveData: restoreFleetSaveData });
/** Tests: an empty ledger. */
export function _resetFleetForTests() { _ships.clear(); _book.length = 0; _crossed.clear(); }
export { BOAT_DEED_TEMPLATE, BOAT_PARTS_TEMPLATE };
