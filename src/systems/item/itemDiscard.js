// @ts-check
// BOUND-DESTROY (FIELD FEEDBACK 2026-10-31, "Soulbound items need to be disposable, certain aetheric sets and hearth
// offerings."): A BOUND PIECE NOTHING ELSE TAKES IS DESTROYED, asked first. A bound piece leaves for nowhere but the
// wagon and the player's own storage (itemBound.js), so the Wyrd's Raiment, a ware the Broker sold unpriced and the
// festival's bowls stayed for good. Gear bound by its own mark goes from the pack here; the Soul Cakes and Hearth
// Offerings are the account service's counts, so they go there (`setCountedDiscard`), or the next answer restacks them.
// A realm-locked copy has no mark: the ledger holds it while it reads it, and its lock lifts to the usual ways out.
// Not a DFU member: Daggerfall has no bound piece and no destroy. Ledger A.
import { templateByIndex } from './itemTemplates.js';
import { isLocked, lockedText } from './itemLock.js';
import { isEquipped } from '../equip.js';
import { dismantleStones } from '../sigil/sigilBroker.js';
import { SOUL_CAKE_TEMPLATE, HEARTH_OFFERING_TEMPLATE } from '../../net/festivalLaw.js';
import { festivalRefusalText } from '../festival/festivalWords.js';
import { t } from '../textManager.js';

/** The faces the account service counts, by template: the count each is let go from (server-account/src/festival.js
 *  discardFestival). A Weir Key is counted too (eg_keys), but it is a gate's key, kept. */
export const COUNTED_FACES = Object.freeze({ [SOUL_CAKE_TEMPLATE]: 'cakes', [HEARTH_OFFERING_TEMPLATE]: 'bowls' });
/** The count a piece is a face of, or null. */
export const countedKind = (/** @type {any} */ item) => (item?.group === 'UselessItems2' && Object.hasOwn(COUNTED_FACES, item?.templateIndex)
  ? COUNTED_FACES[/** @type {keyof typeof COUNTED_FACES} */ (item.templateIndex)] : null);

/**
 * Why a piece may not be destroyed now, or null. 'not': no mark binds it (it has the usual ways out). 'kept': its ROW
 * binds it - the game's tokens: the Embers, Shards and Portal Stones are coin each spent where it pays; the Wallet, the
 * Card Binder and the Dwarven Dragon are one each and hold what they hold; a Weir Key is the service's count. 'dismantle':
 * the Broker pays for it, offered instead. 'quest', 'worn' (taken off first) and 'locked' (LOCK1, the player's word).
 * @param {any} item
 */
export function discardRefusal(item) {
  if (!item || typeof item !== 'object') return 'not';
  if (!countedKind(item)) {
    if (templateByIndex(item.templateIndex)?.bound === true) return 'kept';
    if (item.bound !== true) return 'not';
    if (dismantleStones(item) > 0) return 'dismantle';
  }
  if (item.questItem) return 'quest';
  if (isEquipped(item)) return 'worn';
  if (isLocked(item)) return 'locked';
  return null;
}
/** Whether a piece may be destroyed now. */
export const discardable = (/** @type {any} */ item) => discardRefusal(item) == null;

/**
 * THE DESTROY, MADE, on a pack (`items`, the list itself): the piece or the whole stack out - all of it or none of it.
 * Refused (`{ ok: false, reason }`, nothing moved) as discardRefusal refuses, 'gone' for a piece not in the pack, and
 * 'counted' for a face the service counts (destroyPiece asks it). Answers `{ ok: true, count }`.
 * @param {any} item @param {{ items: any[] }} at
 */
export function discardItem(item, { items }) {
  if (!Array.isArray(items) || !items.includes(item)) return { ok: false, reason: 'gone' };
  const why = discardRefusal(item) ?? (countedKind(item) ? 'counted' : null);
  if (why) return { ok: false, reason: why };
  items.splice(items.indexOf(item), 1);
  return { ok: true, count: Math.max(1, item.stackCount ?? 1) };
}

/** The service's door for the counted faces: `(kind, n) => Promise<{ ok, text }>` (systems/festival/festivalClient.js
 *  sets it at import), or null - every face refused 'offline'. */
let _counted = /** @type {((kind: string, n: number) => Promise<{ ok: boolean, text?: string }>) | null} */ (null);
export function setCountedDiscard(/** @type {any} */ fn) { _counted = typeof fn === 'function' ? fn : null; }

/**
 * THE DESTROY, AS BOTH SKINS ASK IT: gear through discardItem, answered at once; a counted face through the service's
 * door, answered by a promise once its count is let go and the pack restacked to the answer. Either way `{ ok, reason?,
 * text? }` - `text` the service's own refusal.
 * @param {any} item @param {{ items: any[] }} at
 * @returns {{ ok: boolean, reason?: string, text?: string, count?: number } | Promise<{ ok: boolean, reason?: string, text?: string }>}
 */
export function destroyPiece(item, { items }) {
  const kind = countedKind(item);
  if (!kind) return discardItem(item, { items });
  if (!Array.isArray(items) || !items.includes(item)) return { ok: false, reason: 'gone' };
  const why = discardRefusal(item);
  if (why) return { ok: false, reason: why };
  if (!_counted) return { ok: false, reason: 'offline', text: festivalRefusalText('offline') };
  return _counted(kind, Math.max(1, item.stackCount ?? 1)).catch(() => null)
    .then((r) => (r?.ok ? { ok: true } : { ok: false, reason: 'service', text: r?.text || festivalRefusalText('offline') }));
}

/** The words: the card's act, the question and its warning, the classic offer under a refusal, and what was done. */
export const destroyAct = () => t('inventory.destroy.act', 'Destroy');
export const destroyAsk = (/** @type {string} */ name, /** @type {number} */ n) => [
  t('inventory.destroy.ask', 'Destroy {name}?', { name }),
  t('inventory.destroy.gone', '{n, plural, one {It is gone for good. This cannot be undone.} other {All # are gone for good. This cannot be undone.}}', { n }),
];
export const destroyInstead = (/** @type {number} */ n) => t('inventory.destroy.instead', '{n, plural, one {Destroy it instead? It is gone for good.} other {Destroy all # instead? They are gone for good.}}', { n });
export const destroyedText = (/** @type {string} */ name) => t('inventory.destroy.done', 'Destroyed: {name}.', { name });
/** A refusal's words by its reason - the lock's and the worn piece's; null where the act was never offered. */
export const destroyRefusalText = (/** @type {string} */ name, /** @type {string|undefined} */ why) => (why === 'locked' ? lockedText(name)
  : why === 'worn' ? t('inventory.destroy.worn', 'Take off {name} before destroying it.', { name }) : null);
