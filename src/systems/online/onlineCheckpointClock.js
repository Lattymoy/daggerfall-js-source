// @ts-check
// When the online character is saved outside the events that save at once (bible/06-Systems/Realm-Arc.md, SEAT-SAVES
// and SAVES-SAID). The checkpoint and its gate stay the world host's (scenes/world.js onlineCheckpoint).
// - Every frame: the periodic checkpoint when due (onlineCheckpoint.js checkpointWhenDue), then the word to the player
//   when the realm has held nothing new for a while (realmUnsavedNotice.js).
// - When the tab loses the seat: one checkpoint at once. If another device took this character, the put is refused
//   `lease` and the tab goes to the Online door now, not a checkpoint period later with nothing saved.
// Neither runs before the world stands: a save made before the classic start's dungeon never matches an idle one.

import { checkpointWhenDue } from './onlineCheckpoint.js';
import { watchRealmUnsaved } from './realmUnsavedNotice.js';

/**
 * @typedef {import('./realmUnsavedNotice.js').RealmSaveSession & { idle?: (run: () => unknown) => unknown }} CheckpointSession
 */

/**
 * @param {{ session: CheckpointSession | null, checkpoint: () => unknown, lastAt: () => number, say: (text: string) => void, now?: () => number, stands?: () => boolean }} o
 *   `session` the realm session (null for a slot save), `checkpoint` the host's gated online checkpoint, `lastAt` when
 *   it last ran, `say` a HUD line, `now` the session's clock, `stands` whether the boot's start is done.
 */
export function createOnlineCheckpointClock({
  session,
  checkpoint,
  lastAt,
  say,
  now = () => Date.now(),
  stands = () => true,
}) {
  const unsaved = session ? watchRealmUnsaved(session, { say, now }) : null;
  return {
    /** A frame of play, alive: the periodic checkpoint if it is due, then the word if the realm holds nothing new. */
    frame(/** @type {number} */ nowMs) {
      if (stands()) checkpointWhenDue(nowMs, lastAt(), session, checkpoint);
      unsaved?.tick();
    },
    /** The tab just lost the seat: a realm character is saved at once, so a lease another device took is heard now. */
    seatLost() {
      if (!stands()) return; // the first standing frame's checkpoint is due at once, and hears the lease then
      if (!session || session.lost) return;
      checkpoint();
    },
  };
}
