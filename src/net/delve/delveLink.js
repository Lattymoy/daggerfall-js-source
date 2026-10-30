// @ts-check
// DELVE II (DLV3, bible/03-World/Delve-II.md section 7): THE ONE LINK between the online session and the dungeon's
// encounters. The world wires the session to it once (scenes/world.js bootWorld: `online.onDelve = wireDelve(online)`);
// the dungeon's encounter host attaches as it is built and detaches at its teardown. A page with no session, or a
// session at a relay that keeps no encounter (net/wire.js relaySupportsDelve), has no wire: the host stands down online.

/** @type {{ send: (w: any) => boolean, ready: () => boolean } | null} */
let wire = null;
/** @type {((w: any) => void) | null} */
let hearer = null;

/** The session's doors wired: answers the hearing for its `onDelve`. @param {any} online the net/online.js session */
export function wireDelve(online) {
  wire = { send: (w) => !!online?.sendDelve?.(w), ready: () => !!online?.delveReady?.() };
  return (w) => hearer?.(w);
}
/** Whether a word would leave a socket now: a session at a relay that keeps the dungeon's encounters, in its room. */
export const delveWireReady = () => !!wire?.ready();
/** A word to the room (net/wire.js validDelveIn, without its `t`): answers whether it left. */
export const sendDelveWord = (w) => !!wire?.send(w);
/** The host that hears the room's words, attached; answers its detaching. */
export function attachDelveHearer(fn) {
  hearer = fn;
  return () => {
    if (hearer === fn) hearer = null;
  };
}
/** For the tests: the wire as a pin sets it. */
export function _setDelveWireForTests(w) {
  wire = w;
}
