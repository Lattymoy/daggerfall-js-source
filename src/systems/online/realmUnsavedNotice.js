// @ts-check
// The player is told when their progress has not reached the realm (FIELD BUGS 2026-10-25, guild standing and quests
// reset; bible/06-Systems/Realm-Arc.md, SAVES-SAID). A checkpoint the service refuses or never answers waits on this
// device (realmSaves.js RESCUE-SAVE); one the host never hands over (a duel, a clock walk) is kept nowhere. Either way
// a player could play for hours with nothing in the realm, then lose it all on another device.
// So the HUD says it after a whole checkpoint period with no save held since the last one (the join, a landed put, or
// a save held but for its clock), again each period, and once more when a save lands. The words say whether this
// device keeps the progress. A put still out is waited for. A lost session is said at the Online door, not here.

import { ONLINE_CHECKPOINT_MS } from './onlineCheckpoint.js';
import { t } from '../textManager.js';

/** How long the realm holds nothing new of this tab's before the player is told: one whole checkpoint period. */
export const REALM_UNSAVED_SAY_AFTER_MS = ONLINE_CHECKPOINT_MS;
/** How often the warning is said again while the realm still holds nothing new. */
export const REALM_UNSAVED_SAY_EVERY_MS = ONLINE_CHECKPOINT_MS;

/** The warning while puts fail and this device keeps the save, with how long, in the player's language. */
export const realmUnsavedText = (/** @type {number} */ minutes) =>
  t(
    'realm.unsaved.warning',
    'Your progress has not reached the realm for {minutes, plural, one {# minute} other {# minutes}}. This device is keeping it. Play this character only here until the realm takes it.',
    { minutes },
  );
/** The warning while no save was sent at all (the checkpoint's gate shut), with how long, in the player's language. */
export const realmNotSavedText = (/** @type {number} */ minutes) =>
  t(
    'realm.unsaved.notSent',
    'Your progress has not been saved to the realm for {minutes, plural, one {# minute} other {# minutes}}. It is saved when what you are doing ends.',
    { minutes },
  );
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
    if (session.busy && !failing) return; // a put is out: its answer decides
    if (warnedAt != null && at - warnedAt < REALM_UNSAVED_SAY_EVERY_MS) return;
    warnedAt = at;
    const minutes = Math.floor(unsavedFor / 60_000);
    say(failing ? realmUnsavedText(minutes) : realmNotSavedText(minutes));
  };

  session.onCheckpointAnswered = heard;
  return { heard, tick: heard };
}
