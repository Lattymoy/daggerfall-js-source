// @ts-check
// ═══════════════════════════════════════════════════════════════════
// AUDIT SEA VENTURES B3 (2026-10-22, the owner: "Audit this and ensure perfection"; bible/03-World/Eltheric-Ocean.md
// SHIP-PVP) - A WRECKED SHIP'S HOLD, SHUT WHILE HER WRECK MAY BE BOARDED. The prize is read off her record as it stands
// when her wreck is carried (server-account/src/seaWreck.js); the hold opens from anywhere (CARGO-ANYWHERE, scenes/
// holdDoor.js), so in the boarding window an honest page emptied it into the pack, or packed or laid up the boat, and a
// boarded wreck took nothing. From the referee's wreck of her (scenes/naval/navalPvp.js `wreck`) until her own carry lands
// (scenes/seaWreckHost.js) - SEA_HOLD_SHUT_MS at most - her hold opens to no one, and she is neither packed nor laid up
// (comeSailAway.js OpenCargo, PackBoat, LayUpBoat; holdDoor.js). Kept in the page's storage across a reload.
// A modified page holds its own save between checkpoints: named in the record (KNOWN, NAMED).
// ═══════════════════════════════════════════════════════════════════
import { appStorage } from '../appStorage.js';
import { t } from '../textManager.js';

/** The hold is shut this long at most (ms): the boarding window (seaRef.js SEA_REF.boardMs, 180 s) and a minute for her
 *  carry - it opens at once when her carry lands. */
export const SEA_HOLD_SHUT_MS = 240_000;
/** Where the shut holds are kept. */
export const SEA_HOLD_SHUT_KEY = 'dfo.sea.holdShut';

/** @type {Map<number, number>} uid -> shut until (ms) */
const shut = new Map();
let read = false;
const storage = () => { try { return appStorage(); } catch { return null; } };
function load() {
  if (read) return;
  read = true;
  try {
    const o = JSON.parse(storage()?.getItem(SEA_HOLD_SHUT_KEY) ?? '{}');
    for (const [k, v] of Object.entries(o && typeof o === 'object' ? o : {})) if (Number.isSafeInteger(Number(k)) && Number.isFinite(v)) shut.set(Number(k), v);
  } catch { /* nothing kept */ }
}
const save = () => { try { storage()?.setItem(SEA_HOLD_SHUT_KEY, JSON.stringify(Object.fromEntries(shut))); } catch { /* kept by this page alone */ } };

/** Her hold shut: her wreck may be boarded. */
export function shutSeaHold(/** @type {unknown} */ uid, now = Date.now()) {
  load();
  if (!(Number.isSafeInteger(uid) && /** @type {number} */ (uid) > 0)) return;
  shut.set(/** @type {number} */ (uid), now + SEA_HOLD_SHUT_MS);
  save();
}
/** Her hold open again: her wreck carried. */
export function openSeaHold(/** @type {unknown} */ uid) {
  load();
  if (shut.delete(/** @type {number} */ (uid))) save();
}
/** Is boat `uid`'s hold shut now? */
export function seaHoldShut(/** @type {unknown} */ uid, now = Date.now()) {
  load();
  const until = shut.get(/** @type {number} */ (uid));
  if (until == null) return false;
  if (now < until) return true;
  shut.delete(/** @type {number} */ (uid));
  save();
  return false;
}
/** What a page says of a shut hold. */
export const seaHoldShutText = () => t('sea.pvp.holdShut', 'Her hold is shut while her wreck may be boarded.');
