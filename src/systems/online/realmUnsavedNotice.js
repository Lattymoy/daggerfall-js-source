// @ts-check
// THE PLAYER IS TOLD WHEN THEIR PROGRESS HAS NOT REACHED THE REALM (FIELD BUGS 2026-10-25, guild standing and quests
// reset; bible/06-Systems/Realm-Arc.md, SAVES-SAID).
//
// A realm character's checkpoint that the service refuses for a while (its own error, the request rate) or never
// answers (no network) waits on this device: the session keeps the newest save here and sends it again at the next
// checkpoint (realmSaves.js RESCUE-SAVE). Only a save pressed by hand said so. A player could play for hours with
// nothing reaching the realm, then open the character on another device - which plays the realm's older save - and lose
// all of it. Now the HUD says it once the saves have been failing for a whole checkpoint period, again each period
// while they still fail, and once more when a save lands again.
//
// A single failed put says nothing: the next checkpoint usually lands. The session's own end (another tab or device
// took the character, it was deleted, the account signed out) is said at the Online door, so a lost session says
// nothing here.

import { ONLINE_CHECKPOINT_MS } from './onlineCheckpoint.js';
import { t } from '../textManager.js';

/** How long the saves fail before the player is told: one whole checkpoint period, so one failed put is silent. */
export const REALM_UNSAVED_SAY_AFTER_MS = ONLINE_CHECKPOINT_MS;
/** How often the warning is said again while the saves still fail. */
export const REALM_UNSAVED_SAY_EVERY_MS = ONLINE_CHECKPOINT_MS;

/** The warning, with how long the saves have failed, in the player's language. */
export const realmUnsavedText = (/** @type {number} */ minutes) =>
  t('realm.unsaved.warning', 'Your progress has not reached the realm for {minutes, plural, one {# minute} other {# minutes}}. This device is keeping it. Play this character only here until the realm takes it.', { minutes });
/** Said once when a save lands after a warning, in the player's language. */
export const realmSavedAgainText = () => t('realm.unsaved.reachedAgain', 'Your progress reached the realm again.');

/**
 * The part of a realm session (realmSaves.js createRealmSession) the notice reads and wires.
 * @typedef {object} RealmSaveSession
 * @property {number | null} missedSince when the first put since the last that landed failed, or null
 * @property {string | null} lost why the session ended, or null while it stands
 * @property {(() => void) | null} onCheckpointAnswered told after each run of puts the realm answered
 */

/**
 * Watches a realm session's saves and tells the player while they fail. Wires itself to the session's
 * `onCheckpointAnswered`, so the host makes it once and calls nothing else.
 * @param {RealmSaveSession} session
 * @param {{ say: (text: string) => void, now?: () => number }} hooks - `now` must be the session's own clock
 * @returns {{ heard: () => void }}
 */
export function watchRealmUnsaved(session, { say, now = () => Date.now() }) {
  /** When the last warning was said, or null when none was said since a save last landed. */
  let warnedAt = /** @type {number | null} */ (null);

  const heard = () => {
    if (session.lost) return;
    const failingSince = session.missedSince;
    const at = now();
    if (failingSince == null) {
      if (warnedAt == null) return;
      warnedAt = null;
      say(realmSavedAgainText());
      return;
    }
    if (at - failingSince < REALM_UNSAVED_SAY_AFTER_MS) return;
    if (warnedAt != null && at - warnedAt < REALM_UNSAVED_SAY_EVERY_MS) return;
    warnedAt = at;
    say(realmUnsavedText(Math.floor((at - failingSince) / 60_000)));
  };

  session.onCheckpointAnswered = heard;
  return { heard };
}
