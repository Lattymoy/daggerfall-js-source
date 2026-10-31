// @ts-check
// THE HANDS FULL (the Ketch's carry, scenes/ketch/ketchClient.js; DELVE II's flame and weights, scenes/delve/delveBodies.js):
// a piece carried in both hands puts the readied weapon up, and readying it again lets the piece go. One law for every
// carry, so a player learns it once. Pure.

/** A readied weapon lets the piece go; the hands are given back this long before the room's word is waited on again (ms). */
export const CARRY_LET_GO_MS = 1500;
/**
 * A step a frame: a carrier's readied weapon put up (`sheathe`), said once (`handsFull`); readied again after that, the
 * piece let go - said (`letGo`) only when the word left (AUDIT KETCH L3-6: said when the drop never went, the cell still in
 * the room's hands), else the weapon put up again and the drop asked next frame. Pure.
 * @param {{ carrying: boolean, sheathed: (boolean|undefined), forced: boolean, letGoAt: number }} st @param {number} t
 * @param {() => boolean} sendDrop @returns {{ forced: boolean, letGoAt?: number, sheathe?: boolean, say?: ('handsFull'|'letGo'|null) }}
 */
export function carryStep(st, t, sendDrop) {
  if (!st.carrying) return { forced: false };
  if (t - st.letGoAt < CARRY_LET_GO_MS) return { forced: st.forced }; // the hands given back while the room hears the piece let go
  if (st.forced && st.sheathed === false)
    return sendDrop() ? { forced: false, letGoAt: t, say: 'letGo' } : { forced: true, sheathe: true };
  if (!st.sheathed) return { forced: true, sheathe: true, say: st.forced ? null : 'handsFull' };
  return { forced: true };
}
