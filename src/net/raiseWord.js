// @ts-check
// AUDIT WORLD-EVENTS L1-1, L1-4 (bible/01-Overview/audits/Audit-World-Events.md; the owner, asked what Resurrect should mean
// in the Spire and the Sky-Ketch: "Raise before the fall"): MY RESURRECT, SAID TO THE ROOM THAT KEEPS THE DEATH. A made
// level's room records a raise itself - the Hour's realm (net/superDungeon/sdLaw.js sdMayRaise), the Spire's breach (net/
// eliteGates/egBrain.js egRezMember), the Sky-Ketch (net/ketch/ketchBrain.js voyageWord's `rz`) - so a body rises there only
// when a living friend's spell was cast at it; anywhere else this says nothing, and the party pose's call (systems/
// resurrect.js `rz`) is the raise, the fallen's own page deciding. The world host calls it from its Resurrect's door
// (scenes/world.js raiseFallenDoor).
import { isSdRoom } from './superDungeon/sdLaw.js';
import { isEgRoom } from './eliteGates/egLaw.js';
import { isKetchRoom } from './ketch/ketchLaw.js';

/** The raise of account `to` said down my socket to the room I stand in, when it keeps its deaths. Answers whether a word
 *  went. @param {any} online the session (net/online.js) @param {string} to */
export function sendRaiseWord(online, to) {
  const room = online?.room;
  if (!room || typeof to !== 'string' || !to) return false;
  if (isSdRoom(room)) return !!online.sendSdRaise?.(to);
  if (isEgRoom(room)) return !!online.sendEg?.('rz', { to });
  if (isKetchRoom(room)) return !!online.sendKetch?.('rz', { to });
  return false;
}
