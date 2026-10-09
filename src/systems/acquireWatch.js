// @ts-check
// ═══════════════════════════════════════════════════════════════════
// ACQUIRE1 (2026-10-09, Mac: "I want to develop a popup for when you obtain something of rarity including weapons,
// armor, the new cards, etc - something akin to a destiny loot popup notification"; bible/10-UI/Loot-Banner.md) -
// WHAT ARRIVED IN THE PLAYER'S KEEPING, AND IN WHAT TIER.
//
// THE PROBLEM. There is no one door an item comes through. A take from a body or a chest tells the LOOT8 listeners
// (inventory.js tellTaken), but a purchase, the Sigil Broker's sale, a quest's reward, a gate's or a raid's spoils, a
// craft, a trade, the market and a card all `addItem` straight into the pack - and a take from the wagon or the
// Materials Bag tells the listeners as if it were new. A popup hung on any one door misses the rest or lies.
//
// SO THE PACK IS WATCHED, NOT THE DOORS. Once a frame (ui/hud.js drawHud - the one call every host makes, with the
// player entity it already passes) the watcher reads the player's three own lists - the pack, the wagon, the Materials
// Bag - and answers what is NEW there:
//   - A piece that could ever announce (`markable`: a weapon, a piece of armour or clothing, jewellery, an artifact, a
//     card) is marked `acquired` the first frame it stands in one of the lists. An unmarked one there is an ARRIVAL. The
//     mark is a declared item field (itemFields.js) - it rides the save and the house's chest, so a piece taken back out
//     of the player's own storage, or picked back up off the ground, is not new; and it is the RECEIVER's mark (loot.js
//     validLootItem strips it with equipSlot and questItem), so a piece another player hands over - a trade, the zone's
//     remains, the market, a room's chest - is new to its taker.
//   - A CARD stacks, and a card that lands on a stack the player already holds merges into it and is gone as a record.
//     So a card's arrival is its COUNT rising: the three lists' total of each card, frame to frame, less what a marked
//     record new to the lists brought (a stack of the player's own back from a chest).
//   - Moving a piece between the three lists is never an arrival: a whole move carries the same marked record, a split
//     mints a record of a card whose total did not rise.
// A NEW BASELINE, NOT A FLOOD: the first frame of an entity, a new pack (a load replaces the lists - save.js
// restorePlayer), and every frame before and at the end of character creation (its kit and the starter deck) are read
// and marked, and announce nothing.
//
// WHAT ANNOUNCES is a tier at or over `BANNER_MIN_TIER` (Rare): a card its catalog's tier (net/iliacCards.js - printed on
// its face, whatever loot rarity's switch says), any other piece the tier the pack shows it in (lootRarity.js
// rarityAttr - none with loot rarity off, none for Common).
//
// PURE: no DOM, no clock. The face (ui/lootBanner.js) builds its banners from what this answers.
// ═══════════════════════════════════════════════════════════════════

import { rarityAttr, RARITIES } from './lootRarity.js';
import { isIliacCard } from './iliacItems.js';
import { cardById } from '../net/iliacCards.js';
import { isAmmunition } from './itemTemplates.js';

/** The item field the watcher writes: true, or absent (itemFields.js declares it). */
export const ACQUIRED_FIELD = 'acquired';
/** The lowest tier a banner announces (Mac's pick: Rare and up - Common and Magic keep the small pickup feed). */
export const BANNER_MIN_TIER = 'rare';
/** The tiers that announce LOUDLY - the bigger banner and its fanfare (Mac's pick: Aetheric, Artifact, Gilded). */
export const BANNER_BIG_TIER = 'aetheric';

/** The groups whose pieces can wear a tier (lootRarity.js rarityEligible's - a weapon not ammunition, armour, jewellery,
 *  a garment - plus what already wears one). */
const TIERED_GROUPS = new Set(['Weapons', 'Armor', 'Jewellery', 'MensClothing', 'WomensClothing']);

/** Whether a piece could ever announce, and so carries the mark: a card, an artifact, a piece of a tiered group. */
export function markable(item) {
  if (!item || typeof item !== 'object') return false;
  if (isIliacCard(item) || item.artifact === true) return true;
  return TIERED_GROUPS.has(item.group) && !(item.group === 'Weapons' && isAmmunition(item));
}

/** The tier a piece announces itself in: a card its catalog's, any other the pack's (null with loot rarity off, or for
 *  Common). */
export function acquiredTier(item) {
  if (!item) return null;
  if (isIliacCard(item)) {
    const t = cardById(item.card)?.tier;
    return typeof t === 'string' && RARITIES[t] ? t : null;
  }
  return rarityAttr(item);
}

/** The rank of a tier (lootRarity.js RARITIES), -1 for none. */
export const tierRank = (tier) => (tier && RARITIES[tier] ? RARITIES[tier].rank : -1);
/** Whether a piece in this tier announces at all. */
export const tierAnnounces = (tier) => tierRank(tier) >= RARITIES[BANNER_MIN_TIER].rank;
/** Whether a piece in this tier announces loudly. */
export const tierIsBig = (tier) => tierRank(tier) >= RARITIES[BANNER_BIG_TIER].rank;
/** Whether a piece announces when it arrives. */
export const announces = (item) => tierAnnounces(acquiredTier(item));
/** Whether a piece is the player's already - it has stood in their keeping (the mark). */
export const isAcquired = (item) => item?.[ACQUIRED_FIELD] === true;

// ── THE CODEX'S DOOR ────────────────────────────────────────────────
// LOOT10's first find of a Legendary, an Aetheric or a Gilded record says "<name> - a Legendary! It joins your codex."
// and chimes (systems/lootCodex.js noteFind). On Enhanced Plus the banner announces the same piece in the same breath,
// so the codex hands its find to a PRESENTER - the banner's (ui/lootBanner.js) - which says it on the banner, or
// declines and the codex says its line as it always has. The slot lives here, a leaf both reach, so the HUD's graph
// never imports the codex and the codex never imports a face (systems/notify.js's law: the model decides, the face draws).
let _findPresenter = null;
/** The banner's presenter, or null to take it away. */
export function setCodexFindPresenter(fn) { _findPresenter = typeof fn === 'function' ? fn : null; }
/** Hand a first find to the presenter: true when it said it (and the codex says nothing), false otherwise. */
export function presentCodexFind(item, kind) {
  try { return !!_findPresenter?.(item, kind); } catch { return false; }
}

const listsOf = (entity) => [entity?.items, entity?.wagonItems, entity?.bagItems].filter(Array.isArray);
const countOf = (item) => (Number.isInteger(item?.stackCount) && item.stackCount > 0 ? item.stackCount : 1);

/**
 * THE WATCHER. `observe(entity)` once a frame answers the arrivals since the last frame, `[{ item, count, tier }]` - the
 * pieces in the order the lists hold them, every announcing tier only (`tierAnnounces`) - and marks what it read.
 */
export function createAcquireWatch() {
  let lastEntity = null;
  let lastItems = null;
  let lastDone = null;
  /** card id -> the three lists' count of it, last frame */
  let totals = new Map();
  /** the card records standing in the lists last frame */
  let held = new Set();
  /** records that can never announce - read once (a record's group and template do not change) */
  const never = new WeakSet();

  function observe(entity) {
    if (!entity || typeof entity !== 'object') return [];
    const done = entity.chargenDone === true;
    // a new baseline: a new entity, a new pack (a load), the creation and the frame it ends
    const prime = entity !== lastEntity || entity.items !== lastItems || !done || lastDone !== done;
    lastEntity = entity;
    lastItems = entity.items;
    lastDone = done;
    /** @type {{ item: any, count: number, tier: string }[]} */
    const arrivals = [];
    const nowTotals = new Map();
    /** card id -> what marked records new to the lists brought (the player's own stack back) */
    const movedIn = new Map();
    /** card id -> a record to stand for its arrival (an unmarked one when there is one) */
    const face = new Map();
    const nowHeld = new Set();
    for (const list of listsOf(entity)) {
      for (const item of list) {
        if (!item || typeof item !== 'object' || never.has(item)) continue;
        if (!markable(item)) { never.add(item); continue; }
        if (isIliacCard(item)) {
          const id = item.card;
          const n = countOf(item);
          nowTotals.set(id, (nowTotals.get(id) ?? 0) + n);
          if (!held.has(item) && isAcquired(item)) movedIn.set(id, (movedIn.get(id) ?? 0) + n);
          if (!face.has(id) || !isAcquired(item)) face.set(id, item);
          nowHeld.add(item);
          item[ACQUIRED_FIELD] = true;
          continue;
        }
        if (isAcquired(item)) continue;
        item[ACQUIRED_FIELD] = true;
        if (prime) continue;
        const tier = acquiredTier(item);
        if (tierAnnounces(tier)) arrivals.push({ item, count: countOf(item), tier });
      }
    }
    if (!prime) {
      for (const [id, total] of nowTotals) {
        const rose = total - (totals.get(id) ?? 0) - (movedIn.get(id) ?? 0);
        if (rose <= 0) continue;
        const item = face.get(id);
        const tier = acquiredTier(item);
        if (tierAnnounces(tier)) arrivals.push({ item, count: rose, tier });
      }
    }
    totals = nowTotals;
    held = nowHeld;
    return arrivals;
  }

  return {
    observe,
    /** Forget the baseline: the next frame is a new one (tests, a host's reset). */
    reset() { lastEntity = null; lastItems = null; lastDone = null; totals = new Map(); held = new Set(); },
  };
}
