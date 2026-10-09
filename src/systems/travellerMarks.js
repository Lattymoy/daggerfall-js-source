// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TV3 - THE TRAVELLERS, REGION-WIDE: THE CLIENT'S HALF (bible/06-Systems/Travel-View.md).
//
// Mac (2026-09-27): "being able to see other players traveling also";
// his call: "Region-wide from the start". The wire's law - the mark's
// shape, the gates, the relay that keeps and fans it - is net/wire.js
// (validTravellerMark, TRAV_*); what is here is the client's own:
//
//   - THE MARK OF ME: native world coordinates to {px, py, fx, fy, h, m,
//     tv} - the map pixel, where in it to a 256th each way, the heading
//     to a 256th of a turn, the way I go and whether a journey drives me
//     - and back again for a mark someone else sent.
//   - WHEN TO SEND IT (`travellerDue`): a pixel crossed, a change of way
//     or journey, and a refresh every TRAV_KEEPALIVE_MS standing still -
//     never while ALONE in the region (the cost law: a frame wakes the
//     region's object, and nobody is there to see it; the room's join
//     tells me when someone arrives), and a CLEAR once, when I go indoors
//     or hide ("Show me to travellers in my region", on by default).
//   - THE BOOK of the others' marks: put, dropped on a leave, the whole
//     room's replaced on a welcome, and stale after TRAV_STALE_MS.
//
// PURE: numbers and maps. The host (scenes/world.js) reads the pose and
// the pref; the session (net/online.js) holds the socket.
// ═══════════════════════════════════════════════════════════════════
import { TRAV_KEEPALIVE_MS, TRAV_STALE_MS, TRAV_MODES, WORLD_PIXEL_BOUND } from '../net/wire.js';

/** Native world units per map pixel (MapsFile.WorldMapTerrainDim; world/streamingWorld.js NATIVE_PIXEL). */
const NATIVE_PIXEL = 32768;
/** The mark's fraction step, native units: a 256th of a pixel (128 units, 3.2 m). */
export const TRAV_FRACTION = NATIVE_PIXEL / 256;

/** OWS1 (2026-09-28, the player's ask: "being able to see other players sailing in the overworld"): the mark's way at
 *  sea - TRAV_MODES' ship, the one the frame always carried and nothing sent. A traveller at a helm, or aboard a boat,
 *  sends it (the world host's `csaBoatUnderMe`). */
export const TRAV_SHIP = TRAV_MODES.indexOf('ship');
/** OWS1: a mark that says its traveller is at sea. */
export const isShipMark = (p) => p?.m === TRAV_SHIP;

/** The mark's way (`m`) for the port's transport mode (systems/transport.js TRANSPORT_MODES' strings). */
export function travelModeIndex(mode) {
  const i = TRAV_MODES.indexOf(String(mode ?? '').toLowerCase());
  return i < 0 ? 0 : i;
}

/** The heading byte for a yaw (radians, 0 north, clockwise - forwardOf's own): a 256th of a turn. */
export const headingByte = (yaw) => {
  const t = (((yaw / (2 * Math.PI)) % 1) + 1) % 1;
  return Math.round(t * 256) & 255;
};
/** ...and back: the yaw a heading byte names. */
export const yawOfHeading = (h) => (h / 256) * 2 * Math.PI;

/**
 * THE MARK OF ME: native `x`/`z` (world units, the pixel's south-west corner at mapPixelToWorldCoords), the yaw, the
 * way and the journey. The pixel is worldCoordToMapPixel's own (y counts south: 499 - z / pixel) on the Bay; TV-BEYOND
 * (2026-10-09): past it the mark is the world's too (net/wire.js WORLD_PIXEL_BOUND) - it was clamped onto the Bay, a
 * traveller beyond it marked at the edge - its pixel floored there, so its 256ths stay 0..255 either side of the corner.
 * @returns {{px:number, py:number, fx:number, fy:number, h:number, m:number, tv:number}}
 */
export function travellerMarkOf({ x, z, yaw = 0, mode = 'Foot', journey = false }) {
  const cx = Math.max((1 - WORLD_PIXEL_BOUND) * NATIVE_PIXEL, Math.min(WORLD_PIXEL_BOUND * NATIVE_PIXEL - 1, x));
  const cz = Math.max((500 - WORLD_PIXEL_BOUND) * NATIVE_PIXEL, Math.min((499 + WORLD_PIXEL_BOUND) * NATIVE_PIXEL - 1, z));
  const px = Math.floor(cx / NATIVE_PIXEL), pzRow = Math.floor(cz / NATIVE_PIXEL);
  const fx = Math.min(255, Math.floor((cx - px * NATIVE_PIXEL) / TRAV_FRACTION));
  const fy = Math.min(255, Math.floor((cz - pzRow * NATIVE_PIXEL) / TRAV_FRACTION));
  return { px, py: 499 - pzRow, fx, fy, h: headingByte(yaw), m: travelModeIndex(mode), tv: journey ? 1 : 0 };
}

/** A mark's place in native world units - the middle of its 256th. */
export function travellerWorldOf(p) {
  const zRow = 499 - p.py;
  return { x: p.px * NATIVE_PIXEL + (p.fx + 0.5) * TRAV_FRACTION, z: zRow * NATIVE_PIXEL + (p.fy + 0.5) * TRAV_FRACTION };
}

/**
 * WHEN TO SEND: 'send' (the mark), 'clear' (null - I went indoors, or hid) or null (nothing). `st` is what the relay
 * holds of me - `{ last, at }`, the last mark sent (null: none, or cleared) and when - and the host resets it when the
 * region's room changes (a new room holds nothing of mine). The session's own floor (TRAV_SEND_MIN_MS) paces what this
 * asks for; a 'send' it refuses is asked again the next frame.
 * @param {{ last: any, at: number }} st
 * @param {{ now: number, mark: any, alone: boolean, shown: boolean }} q - `shown`: outdoors AND the switch on
 */
export function travellerDue(st, { now, mark, alone, shown }) {
  if (!shown || !mark) return st.last ? 'clear' : null;
  if (alone) return null;
  const l = st.last;
  if (!l) return 'send';
  if (l.px !== mark.px || l.py !== mark.py || l.m !== mark.m || l.tv !== mark.tv) return 'send';
  if (now - st.at >= TRAV_KEEPALIVE_MS) return 'send';
  return null;
}

/**
 * THE BOOK of the others' marks in my region: `put` a frame's (a null mark takes them out), `drop` a leave, `reset`
 * a welcome's whole room, `live` what is not stale.
 */
export function createTravellerBook() {
  const marks = new Map();
  const put = (f, now) => {
    if (!f?.id) return;
    if (!f.p) { marks.delete(f.id); return; }
    // AUDIT DEEP T3-6: a welcome's row carries its age (`ag`, seconds) - it is that old here too
    const age = Number.isFinite(f.ag) && f.ag > 0 ? f.ag * 1000 : 0;
    marks.set(f.id, { id: f.id, name: f.name ?? '', sub: f.sub ?? null, title: f.title ?? null, glyphs: f.glyphs ?? [], lv: f.lv ?? null, gt: f.gt ?? null, p: f.p, at: now - age });   // OVERWORLD NAMES: the whole badge
  };
  return {
    put,
    drop(id) { marks.delete(id); },
    reset(list, now) { marks.clear(); for (const f of list ?? []) put(f, now); },
    clear() { marks.clear(); },
    /** The marks heard within TRAV_STALE_MS - the rest pruned on the way. */
    live(now) {
      const out = [];
      for (const [id, m] of marks) { if (now - m.at > TRAV_STALE_MS) marks.delete(id); else out.push(m); }
      return out;
    },
    get size() { return marks.size; },
  };
}
