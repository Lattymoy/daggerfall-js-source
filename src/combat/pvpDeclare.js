// @ts-check
// PVP-VITALS (2026-10-30, net/wild/pvpVitals.js): WHAT MY GAME TELLS THE REFEREE IT SPENT. While my flag is up the relay
// owns my health's rises and my magicka and fatigue, so it must hear of a potion I drank and a PvP bar spell I cast on
// myself (a party member's gift is its own cast frame, paid where the relay passes it). Each is queued here and leaves on
// the next health report (net/siege/refereeHealthMirror.js). My harmful casts carry their number (`c`): one cast's area,
// landing on several players, is paid for once. A leaf but for the cast hook.
import { registerPlayerCastListener } from '../systems/playerCasts.js';
import { DECLARE, DECLARES_PER_REPORT, KIT_ORDER } from '../net/wild/pvpVitals.js';

const queue = /** @type {number[]} */ ([]);
/** The most declarations held while none can leave (offline): the newest are kept. */
const QUEUE_MAX = 32;
const push = (code) => {
  queue.push(code);
  if (queue.length > QUEUE_MAX) queue.shift();
};
let castNo = 0;

/** A potion of `kind` ('health', 'magicka', 'other' - combat/pvpPotions.js pvpPotionKind) drunk in a fight. */
export function declarePotion(kind) {
  push(kind === 'health' ? DECLARE.hpPotion : kind === 'magicka' ? DECLARE.mpPotion : DECLARE.otherPotion);
}
/** A PvP bar spell (`id`, systems/wild/pvpKit.js) cast on myself. */
export function declareKitSelf(id) {
  const i = KIT_ORDER.indexOf(id);
  if (i >= 0 && id !== 'damage') push(DECLARE.kit + i);
}
/** The declarations owed, at most a report's worth - left queued until `sent` says they went. */
export const pendingDeclares = () => queue.slice(0, DECLARES_PER_REPORT);
export function declaresSent(n) {
  queue.splice(0, n);
}
/** My last cast's number, for a harmful cast's frame. */
export const pvpCastNo = () => castNo;
/** Pins only. */
export function resetPvpDeclares() {
  queue.length = 0;
  castNo = 0;
}

registerPlayerCastListener('pvp-vitals', () => {
  castNo = castNo >= 1_000_000 ? 1 : castNo + 1;
});
