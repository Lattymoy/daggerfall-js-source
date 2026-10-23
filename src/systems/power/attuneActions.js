// PWR2 (2026-10-23, bible/05-Combat/Power-Arc.md section 5): ATTUNEMENT'S DOORS - attuning a piece, releasing one, and
// the settle that keeps a character's stamps true. The law of what is awake is systems/power/attunement.js (a leaf);
// this file is what moves it, and what it asks of the scene.
//
//   attune(entity, item)   a piece of mine with a power, out of combat, while fewer than three are attuned (Mac: "3, swap
//                          out of combat"); a worn one wakes at once - its powers, its folds, and a Daggerfall artifact's
//                          equip payloads (systems/enchantments.js wakeItemPayloads).
//   release(entity, item)  out of combat: the piece's power sleeps, and a worn artifact's equip payloads end.
//   settleAttunement(entity)  at every equip change and as a save loads: a stale stamp - an attuned piece beyond the
//                          three latest (one put down in a chest and taken up again) - is cleared; and while there is
//                          room, a worn piece with a power is attuned for the player, out of combat (a fresh character's
//                          first Legendary needs no visit to a window; a character from before PWR2 wakes its first three
//                          worn powers in the table's order, and the rest sleep until chosen - Mac: "Nothing taken,
//                          extras sleep").
//
// OUT OF COMBAT is the rest's own question (systems/encounters.js areEnemiesNearby - GameManager.AreEnemiesNearby) over
// the scene the player stands in (systems/playerDoor.js - every host's magic engine publishes it), so no host is touched.
//
// Not a DFU member: Ledger A (PWR2).

import { attunable, attunedStamp, stampedPieces, attunedPieces, ATTUNE_MOST, attunementOn, attuneRoom, registerAttunementSwitch } from './attunement.js';
import { lootRarityOn } from '../loot/lootRarity.js';
import { areEnemiesNearby } from '../encounters.js';
import { playerDoor } from '../playerDoor.js';
import { addEquipChangeListener, equipTableOf } from '../equip.js';
import { computeEntityMods } from '../entityMods.js';
import { wakeItemPayloads, sleepItemPayloads } from '../enchantments.js';
import { t } from '../textManager.js';

/** Whether a foe near me is in the fight (the rest's own question, over the running scene's foes). */
export const inCombat = () => { try { return areEnemiesNearby(playerDoor()?.foes?.() ?? []); } catch { return false; } };

/** Whether `item` is worn by `entity` now. */
const worn = (entity, item) => !!entity?.equip && equipTableOf(entity).includes(item);
/** The next stamp a character gives: one past its latest (stamps order the attunements; the latest three wake). */
const nextStamp = (entity) => (Array.isArray(entity?.items) ? entity.items.reduce((m, it) => Math.max(m, attunedStamp(it)), 0) : 0) + 1;

/** Wake or sleep a worn piece's powers now: its artifact payloads, and the folds every power reads. */
function refold(entity, item, awake) {
  if (worn(entity, item)) {
    try { if (awake) wakeItemPayloads(entity, item); else sleepItemPayloads(entity, item); } catch { /* a payload is not the choice's problem */ }
  }
  computeEntityMods(entity);
}

/** Why `item` may not be attuned by `entity` now, or null. */
export function attuneRefusal(entity, item, { combat = inCombat() } = {}) {
  if (!attunementOn()) return t('attune.refuse.off', 'Attunement is off while Loot Rarity is off.');
  if (!attunable(item) || !entity?.items?.includes(item)) return t('attune.refuse.none', 'This has no power to attune.');
  if (stampedPieces(entity).slice(0, ATTUNE_MOST).includes(item)) return t('attune.refuse.already', 'You are already attuned to it.');
  if (combat) return t('attune.refuse.combat', 'You cannot attune with enemies nearby.');
  if (attuneRoom(entity) <= 0) return t('attune.refuse.full', 'You are attuned to {n} pieces already. Release one first.', { n: ATTUNE_MOST });
  return null;
}
/** ATTUNE: answers `{ ok, text }`. */
export function attune(entity, item, opts = {}) {
  const why = attuneRefusal(entity, item, opts);
  if (why) return { ok: false, text: why };
  item.attuned = nextStamp(entity);
  refold(entity, item, true);
  return { ok: true, text: t('attune.done', 'You attune to {name}.', { name: String(item.name ?? 'it') }) };
}
/** Why `item` may not be released now, or null. */
export function releaseRefusal(entity, item, { combat = inCombat() } = {}) {
  if (!attunedStamp(item) || !entity?.items?.includes(item)) return t('attune.refuse.notAttuned', 'You are not attuned to it.');
  if (combat) return t('attune.refuse.combatRelease', 'You cannot release an attunement with enemies nearby.');
  return null;
}
/** RELEASE: answers `{ ok, text }`. */
export function release(entity, item, opts = {}) {
  const why = releaseRefusal(entity, item, opts);
  if (why) return { ok: false, text: why };
  delete item.attuned;
  refold(entity, item, false);
  return { ok: true, text: t('attune.released', 'You release your attunement to {name}.', { name: String(item.name ?? 'it') }) };
}

/**
 * THE SETTLE: stale stamps cleared (beyond the latest three), then - out of combat, while there is room - every worn
 * piece with a power attuned in the table's order. Answers whether anything changed (the caller folds again then).
 */
export function settleAttunement(entity, { combat = inCombat() } = {}) {
  if (!entity?.isPlayer || entity.peer || !Array.isArray(entity.items) || !attunementOn()) return false;
  let changed = false;
  for (const it of stampedPieces(entity).slice(ATTUNE_MOST)) { delete it.attuned; changed = true; }
  if (!combat && entity.equip) {
    for (const it of equipTableOf(entity)) {
      if (attuneRoom(entity) <= 0) break;
      if (!it || !attunable(it) || attunedStamp(it)) continue;
      it.attuned = nextStamp(entity);
      try { wakeItemPayloads(entity, it); } catch { /* as above */ }
      changed = true;
    }
  }
  if (changed) computeEntityMods(entity);
  return changed;
}

/**
 * PWR4 (bible/05-Combat/Power-Arc.md section 7; Mac: "two more saved Firmament trees and attunement sets, swappable out of
 * combat"): THE ATTUNEMENT SET A SKY CARRIES. Each sky kept aside (1, 2) keeps the attunements it was set aside with -
 * by the pieces' ids (systems/item/itemIds.js: every valuable piece online carries one), in the save's `attuneSkies`. As
 * the sky in force is exchanged with slot `slot` (net/firmament/firmamentBook.js swap, on its success), the attunements
 * in force go with it and the slot's come back: every piece attuned now released, each of the slot's that is still held
 * attuned again (three at most, the slot's order) - a worn one's powers and payloads woken or put to sleep at once. A
 * slot never set aside before brings nothing back, and the attunements in force stand.
 */
export function swapAttunementSet(entity, slot) {
  if (!entity || !Array.isArray(entity.items) || !(slot === 1 || slot === 2)) return false;
  const was = attunedPieces(entity);
  const out = was.map((it) => it.uid).filter((u) => typeof u === 'string');
  const want = Array.isArray(entity.attuneSkies?.[slot]) ? entity.attuneSkies[slot] : null;
  entity.attuneSkies = { ...(entity.attuneSkies ?? {}), [slot]: out };
  if (!want) return false;
  for (const it of stampedPieces(entity)) delete it.attuned;
  for (const uid of want.slice(0, ATTUNE_MOST)) {
    const it = entity.items.find((x) => x?.uid === uid && attunable(x));
    if (it) it.attuned = nextStamp(entity);
  }
  const now = attunedPieces(entity);
  for (const it of new Set([...was, ...now])) {
    if (!worn(entity, it) || was.includes(it) === now.includes(it)) continue;
    try { if (now.includes(it)) wakeItemPayloads(entity, it); else sleepItemPayloads(entity, it); } catch { /* as above */ }
  }
  computeEntityMods(entity);
  return true;
}

addEquipChangeListener((entity) => { settleAttunement(entity); });   // every equip, unequip and the save's rebuildEquipState
// THE SWITCH: attunement binds while the ladder is on (Settings > Features, Loot Rarity) - and only where these doors are
// loaded (systems/loot/lootPowers.js imports this file, as every host does), so no piece sleeps where nothing could
// attune it; read late, so the cycle through the ladder never reads it unmade
registerAttunementSwitch(() => lootRarityOn());
