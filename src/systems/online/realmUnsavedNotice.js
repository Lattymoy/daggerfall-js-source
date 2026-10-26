// @ts-check
// THE PLAYER IS TOLD WHEN THEIR PROGRESS HAS NOT REACHED THE REALM (FIELD BUGS 2026-10-25, guild standing and quests
// reset; bible/06-Systems/Realm-Arc.md, SAVES-SAID).
//
// A realm character's checkpoint that the service refuses for a while (its own error, the request rate) or never
// answers (no network) waits on this device: the session keeps the newest save here and sends it again at the next
// checkpoint (realmSaves.js RESCUE-SAVE). A checkpoint the host never hands over - its gate shut by a duel, or by a walk
// of the clock still waiting - is kept nowhere. Either way a player could play for hours with nothing reaching the
// realm, then open the character on another device, which plays the realm's older save, and lose all of it.
//
// So the HUD says it once the realm has held nothing of this tab's for a whole checkpoint period, measured from the last
// save it held (the join, a put that landed, or a periodic save the realm already held but for its clock), again each
// period while that stands, and once more when a save lands again. The words say whether this device keeps the progress
// (a put failed) or not (none was sent). A put still out is waited for: the next checkpoint usually lands. The session's
// own end (another tab or device took the character, it was deleted, the account signed out) is said at the Online
// door, so a lost session says nothing here.

import { ONLINE_CHECKPOINT_MS } from './onlineCheckpoint.js';
import { t } from '../textManager.js';

/** How long the realm holds nothing new of this tab's before the player is told: one whole checkpoint period. */
export const REALM_UNSAVED_SAY_AFTER_MS = ONLINE_CHECKPOINT_MS;
/** How often the warning is said again while the realm still holds nothing new. */
export const REALM_UNSAVED_SAY_EVERY_MS = ONLINE_CHECKPOINT_MS;

/** The warning while puts fail and this device keeps the save, with how long, in the player's language. */
export const realmUnsavedText = (/** @type {number} */ minutes) =>
  t('realm.unsaved.warning', 'Your progress has not reached the realm for {minutes, plural, one {# minute} other {# minutes}}. This device is keeping it. Play this character only here until the realm takes it.', { minutes });
/** The warning while no save was sent at all (the checkpoint's gate shut), with how long, in the player's language. */
export const realmNotSavedText = (/** @type {number} */ minutes) =>
  t('realm.unsaved.notSent', 'Your progress has not been saved to the realm for {minutes, plural, one {# minute} other {# minutes}}. It is saved when what you are doing ends.', { minutes });
/** Said once when a save lands after a warning, in the player's language. */
export const realmSavedAgainText = () => t('realm.unsaved.reachedAgain', 'Your progress reached the realm again.');

/**
 * The part of a realm session (realmSaves.js createRealmSession) the notice reads and wires.
 * @typedef {object} RealmSaveSession
 * @property {number} savedAt when the realm last held this tab's progress (the session's clock)
 * @property {number | null} missedSince when the first put since the last that landed failed, or null
 * @property {boolean} busy whether a put is out or a save waits for one
 * @property {string | null} lost why the session ended, or null while it stands
 * @property {(() => void) | null} onCheckpointAnswered told after each run of puts the realm answered
 */

/**
 * Watches a realm session's saves and tells the player while the realm holds nothing new of theirs. Wires itself to the
 * session's `onCheckpointAnswered`; the host also calls `tick()` from its frame, so a gate that stays shut is heard.
 * @param {RealmSaveSession} session
 * @param {{ say: (text: string) => void, now?: () => number }} hooks - `now` must be the session's own clock
 * @returns {{ heard: () => void, tick: () => void }}
 */
export function watchRealmUnsaved(session, { say, now = () => Date.now() }) {
  /** When the last warning was said, or null when none was said since the realm last held a save. */
  let warnedAt = /** @type {number | null} */ (null);

  const heard = () => {
    if (session.lost) return;
    const at = now();
    const unsavedFor = at - session.savedAt;
    if (unsavedFor < REALM_UNSAVED_SAY_AFTER_MS) {
      if (warnedAt == null) return;
      warnedAt = null;
      say(realmSavedAgainText());
      return;
    }
    const failing = session.missedSince != null;
    if (session.busy && !failing) return;   // a put is out: its answer decides
    if (warnedAt != null && at - warnedAt < REALM_UNSAVED_SAY_EVERY_MS) return;
    warnedAt = at;
    const minutes = Math.floor(unsavedFor / 60_000);
    say(failing ? realmUnsavedText(minutes) : realmNotSavedText(minutes));
  };

  session.onCheckpointAnswered = heard;
  return { heard, tick: heard };
}
