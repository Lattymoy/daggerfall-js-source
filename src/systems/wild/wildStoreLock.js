// @ts-check
// ═══════════════════════════════════════════════════════════════════
// AUDIT PVP-EASE L2-1 (2026-10-26, the owner chose "Combat lock" - bible/11-Multiplayer/Wild-Zone.md section 4,
// STORE-KEEPS; bible/01-Overview/audits/Audit-PvP-Ease.md) - THE COMBAT LOCK ON STORING. STORE-KEEPS made the cart, a
// companion's pack, a ship's hold, a chest and a sworn one's kit storage no death in the open zone takes, and every one of
// them opens from anywhere in the zone: a fighter at 1 HP moved its whole bag and purse into them, and a player's kill
// cost it one worn piece at most. For WILD_STORE_LOCK_MS after a player's blow - given or taken, a sword's, a spell's or
// a ship's gun's - nothing may be stored; taking out is never locked.
//
// A leaf of its own: the inventory's law asks it (systems/inventorySession.js storeRefusalOf), and the account Worker
// bundles that law - the zone's own leaf (wildZone.js, which re-exports this) is no part of it. The world host notes a
// blow (world.js wildHpIn), the sea's guns theirs (scenes/naval/seaBroadsides.js), and a fall at another's hand locks it a
// pick's minute further (wildZone.js wildDeathAtHand).
// Not a DFU member: Daggerfall Unity has no other players.
// ═══════════════════════════════════════════════════════════════════
import { t } from '../textManager.js';

/** How long after a player's blow nothing may be stored, ms. */
export const WILD_STORE_LOCK_MS = 60_000;

let _blowAt = -Infinity;
/** A player's blow landed - mine on another or another's on me: storing locked WILD_STORE_LOCK_MS from `at`.
 *  @param {number} [at] */
export const noteWildBlow = (at = Date.now()) => {
  _blowAt = Math.max(_blowAt, at);
};
/** The lock's words, with the seconds it has left. @param {number} s */
export const storeLockedText = (s) =>
  t(
    'wild.store.locked',
    'You cannot store anything for {s, plural, one {# more second} other {# more seconds}} after fighting another player.',
    { s },
  );
/** Why nothing may be stored now - the words said - or null. @param {number} [now] */
export function wildStoreRefusal(now = Date.now()) {
  const left = WILD_STORE_LOCK_MS - (now - _blowAt);
  return left > 0 ? storeLockedText(Math.ceil(left / 1000)) : null;
}
