// @ts-check
// SCALE2c (2026-10-10; bible/11-Multiplayer/Scale-Arc.md SCALE2c): A FULL FOES FRAME THAT SAYS NOTHING IS SAID ONCE.
// In a cell every client streams its own foes whenever anyone else is there, and a FULL frame went every FOES_FULL_MS
// even from a player with nothing in the world at all - no foe, no camp, no horse, no boat, no ring, no portal. Its
// whole word was "none", said again every two seconds to everyone in range: in a crowded city about 128 such frames a
// second came to each client, and they spent the room's 4 MiB/s foes budget (the relay drops past it, silently) that
// real fights need. A full frame's work at a reader is to take down what the owner no longer has; once "none" has been
// said, saying it again takes down nothing, and a reader's own staleness sweep (FOES_STALE_MS) lets the owner go with
// nothing to take. So a quiet full frame is sent once - the first after anything else - and not again until the owner
// has something to say. A room change says it once more, to the new room.

/** The frame's own bookkeeping - its sequence, its room, its full bit - which says nothing about the world. */
export const FOES_FRAME_OWN = Object.freeze(['n', 'k', 'full']);

/** Whether a built foes frame says nothing: every other field absent, null, or an empty list. A field this does not
 *  know with any other value is something said - an unknown shape counts as news, so the frame goes. */
export function quietFoesFrame(frame) {
  if (!frame || typeof frame !== 'object' || Array.isArray(frame)) return false;
  for (const key of Object.keys(frame)) {
    if (FOES_FRAME_OWN.includes(key)) continue;
    const v = frame[key];
    if (v == null || (Array.isArray(v) && v.length === 0)) continue;
    return false;
  }
  return true;
}

/** One stream's memory of what its room last heard: asked before a built frame goes, told after. A frame may be left
 *  unsaid only when it is full, in a cell, says nothing, and the same room's last frame from this stream said the same -
 *  so "none" is always said once to each room, and anything else always goes. */
export function quietFoesGate() {
  let saidIn = null; // the room whose last frame from this stream was a quiet full one
  return {
    skip(frame, { full, cell, room }) {
      return !!(cell && full && room != null && saidIn === room && quietFoesFrame(frame));
    },
    sent(frame, { full, room }, ok = true) {
      saidIn = ok && full && room != null && quietFoesFrame(frame) ? room : null;
    }, // a world room's quiet frame is remembered too - `skip` alone asks for a cell
  };
}
