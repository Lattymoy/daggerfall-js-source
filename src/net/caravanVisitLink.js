// @ts-check
// WAGONS2-VISIT (2026-10-09): A CARAVAN I VISIT STANDS WHILE ITS CELL SAYS SO. Inside another player's caravan my primary
// session stands in the caravan's own room (net/privateInterior.js caravanRoomOf), and the cell that keeps the caravan's
// record (HCC-PARK - net/wire.js's park law) is no room of mine: a caravan driven off, parked again elsewhere, or gone
// with its owner's record would leave me in a room that stands nowhere. This is the cell's LISTENER - a second session on
// my primary's own identity (net/sailingCabinLink.js's way), joined to the caravan's cell with no presence (no pose: it
// stands nobody there and says nothing but its hello and its heartbeat), hearing the cell's parked teams on its welcome
// (`parks`) and every change after (`park`). While the caravan's record (its owner key `k`) is a parked caravan where it
// stood when I stepped in (`at`, natives, within CARAVAN_STANDS_NATIVES), I stay; anything else - its record dropped, not
// in the welcome's list, no longer parked, no longer a caravan, moved - is `onGone`, said once a visit, in the host's own
// frame (`tick`), never inside a socket's callback - and said again on the next frame while the host answers false (a
// door being walked through holds it). Its paint changed is `onLook`. It is left (close) before my primary joins the
// cell itself - the host closes it ahead of its primary's join once no visit stands (scenes/world.js), and with the seat
// and the page - so the relay never closes it as my own id replaced, and it forwards no superseding: the seat is my primary's to lose. Pure of any scene.
import { OnlineSession } from './online.js';
import { cellRoomOfWire } from './wire.js';
import { validHccRecord, HCC_WIRE_KIND } from '../systems/horseCartWire.js';

import { CARAVAN_STANDS_NATIVES } from '../systems/caravanRoom.js';   // the caravan the room stands on, where it stands - one reach for the visit and the owner's own room
export { CARAVAN_STANDS_NATIVES };

/** Whether a cell's record (`raw`, the park record's `r`) is a caravan still parked where `at` says (natives). */
export function caravanStands(raw, at) {
  const w = raw == null ? null : validHccRecord(raw)?.w;
  return !!w && w.kind === HCC_WIRE_KIND.Deployed && w.model === 'caravan' && Array.isArray(at)
    && Math.abs(w.position[0] - at[0]) <= CARAVAN_STANDS_NATIVES && Math.abs(w.position[2] - at[2]) <= CARAVAN_STANDS_NATIVES;
}

/** `onGone(why)` the caravan moved on or went ('gone') or its door shut on me ('shut'); `onLook(look)` its owner painted
 *  it again; `may(w, visit)` (WAGONS2-VISIT AUDIT) whether its door, as its record's word says it now (`w` the record's
 *  wagon - its `entry` and `guild`), still opens to me. */
export function createCaravanVisitLink({ onGone, onLook = null, may = null, Session = OnlineSession }) {
  let link = null, source = null, visit = null, cell = null, gone = false, due = false, lookKey = null, why = 'gone';
  function close() {
    link?.leave(); link = null; source = null; visit = null; cell = null; gone = false; due = false; lookKey = null; why = 'gone';
  }
  /** A word about the caravan's record (null: none). */
  function judge(raw) {
    if (gone || !visit) return;
    if (!caravanStands(raw, visit.at)) { gone = true; due = true; why = 'gone'; return; }
    const w = validHccRecord(raw)?.w ?? null;
    if (may && w && !may(w, visit)) { gone = true; due = true; why = 'shut'; return; }   // WAGONS2-VISIT (AUDIT): its door shut on me while I stood in it - out, as a moved caravan's visitor is
    const look = w?.look ?? null;
    const key = JSON.stringify(look);
    if (key !== lookKey) { lookKey = key; onLook?.(look); }
  }
  return {
    close,
    /** Every frame: `main` my primary session, `v` the visit I stand in (scenes/worldModes.js caravanVisit - its room,
     *  its owner key `k`, where its record stood `at`, its paint `look`) or null. */
    tick(main, v) {
      if (!main || !v || main.terminal || typeof v.k !== 'string' || !Array.isArray(v.at)) { close(); return; }
      const room = (typeof v.cell === 'string' && v.cell) || cellRoomOfWire(v.at[0], v.at[2]);   // WAGONS2-VISIT (AUDIT): the cell that keeps its record (where it was read), else the one its pose names
      // the handoff: never beside my own primary (stepping out joins that very cell)
      if (!room || main.room === room || main.inRoom?.(room)) { close(); return; }
      if (source !== main || visit?.k !== v.k || visit?.room !== v.privateRoom) {
        close();
        source = main; cell = room; visit = { k: v.k, at: [...v.at], room: v.privateRoom, owner: v.cabinOwner ?? null }; lookKey = JSON.stringify(v.look ?? null);
        link = new Session({ url: main.url, id: main.id, secret: main.secret, name: main.name, look: main.look, mintToken: main.mintToken, presence: false });
        link.onParks = (r, list) => { if (r === cell) judge((Array.isArray(list) ? list : []).find((e) => e?.k === visit?.k)?.r ?? null); };
        link.onPark = (r, e) => { if (r === cell && e?.k === visit?.k) judge(e.r ?? null); };
      }
      if (link.room !== cell) link.join(cell, null);
      link.tick();
      if (due) { due = false; if (onGone?.(why) === false) due = true; }
    },
  };
}
