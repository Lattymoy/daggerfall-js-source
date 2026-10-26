// @ts-check
// WHEN THE ONLINE CHARACTER IS SAVED, OUTSIDE THE EVENTS THAT SAVE AT ONCE (bible/06-Systems/Realm-Arc.md, SEAT-SAVES
// and SAVES-SAID). The world host builds one and calls it; the checkpoint itself and its gate stay the host's
// (scenes/world.js onlineCheckpoint).
//
// - Every frame of play: the periodic checkpoint when it is due (onlineCheckpoint.js checkpointWhenDue), and then the
//   word to the player when the realm has held nothing new of theirs for a while (realmUnsavedNotice.js).
// - When the tab loses the seat: one checkpoint at once. The seat goes when the player opens the character, or another
//   of the account's characters, somewhere else. If that took this character, its lease is dead, the put is refused
//   `lease` and the tab goes to the Online door now - not up to a checkpoint period later, playing on with nothing
//   saved. If it did not, the save lands as any other.

import { checkpointWhenDue } from './onlineCheckpoint.js';
import { watchRealmUnsaved } from './realmUnsavedNotice.js';

/**
 * @typedef {import('./realmUnsavedNotice.js').RealmSaveSession & { idle?: (run: () => unknown) => unknown }} CheckpointSession
 */

/**
 * @param {{ session: CheckpointSession | null, checkpoint: () => unknown, lastAt: () => number, say: (text: string) => void, now?: () => number }} o
 *   `session` the realm session (null for a character saved to its slots), `checkpoint` the host's online checkpoint
 *   (gated by the host), `lastAt` when it last ran (the frame's clock), `say` a line on the HUD, `now` the session's
 *   own clock.
 */
export function createOnlineCheckpointClock({ session, checkpoint, lastAt, say, now = () => Date.now() }) {
  const unsaved = session ? watchRealmUnsaved(session, { say, now }) : null;
  return {
    /** A frame of play, alive: the periodic checkpoint if it is due, then the word if the realm holds nothing new. */
    frame(/** @type {number} */ nowMs) {
      checkpointWhenDue(nowMs, lastAt(), session, checkpoint);
      unsaved?.tick();
    },
    /** The tab just lost the seat: a realm character is saved at once, so a lease another device took is heard now. */
    seatLost() {
      if (!session || session.lost) return;
      checkpoint();
    },
  };
}
