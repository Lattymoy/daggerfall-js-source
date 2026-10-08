// @ts-check
// CARDS10 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 29): ILIAC HAND'S PICTURE ON THE CLOTH - pure, the
// Hold'em scene's way (world/cardScene.js): what the game's state says is where a card is, and this says how it lies and
// how it got there. Section 3, DECIDED: "the physics is the picture, never the rules".
//
// THE LAY. The three holdings lie in a row across the table's middle, square to the line between the two players; each
// player's cards at a holding stand in a column from it toward his own chair, a little apart and each a little higher
// than the one before (no two plates on one plane). Every card is turned to be read from the chair whose eyes look at it
// (the viewer's - the cloth is his picture): its top away from him. A face-down card is a back.
//
// THE THROW. A card that comes onto the cloth (its uid not seen before) is thrown from its owner's edge of the table on
// an arc to its place over THROW_S, the hand's own pace (cardMotion.js); a card that leaves it is simply gone (to its
// owner's discard - the panel counts it). Closed-form in time: a skipped frame lands on the same pose.
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).
import { CARD_W, CARD_L, CARD_T, ARC_HEIGHT } from './cardMotion.js';

/** MEASURE (CARDS10): the holdings' spacing across the table, a side's first card off its holding toward its owner, the
 *  step between a side's cards, and each card's rise over the one before. */
export const ILIAC_HOLD_GAP = CARD_W * 1.9;
export const ILIAC_SIDE_IN = CARD_L * 1.05;
export const ILIAC_SIDE_STEP = CARD_L * 0.42;
export const ILIAC_SIDE_RISE = CARD_T * 1.5;
/** MEASURE (CARDS10): a card's throw from its owner's edge to its place, in seconds. */
export const ILIAC_THROW_S = 0.42;

/**
 * The places for a game at a table: `frame` the table's (cardTables.js tableFrame), `seat0` and `seat1` the two
 * players' seats' feet (game seats 0 and 1), `viewer` the seat whose picture it is. Answers the holdings' spots, each
 * side's spot function and its edge, and the yaw the cards are read at.
 * @param {{centre: number[], halfShort?: number, halfLong?: number}} frame @param {number[]} seat0 @param {number[]} seat1 @param {number} viewer
 */
export function iliacPlaces(frame, seat0, seat1, viewer = 0) {
  const c = frame.centre, top = c[1];
  // toward each seat across the cloth (the two chairs face one another, or near it)
  const toward = (f) => { const dx = f[0] - c[0], dz = f[2] - c[2], n = Math.hypot(dx, dz) || 1; return [dx / n, dz / n]; };
  const d0 = toward(seat0), d1raw = toward(seat1);
  // a second chair beside the first (not across) still lays its side opposite: the row stands square to seat 0's line
  const d1 = d0[0] * d1raw[0] + d0[1] * d1raw[1] > -0.2 ? [-d0[0], -d0[1]] : d1raw;
  const dirs = [d0, d1];
  const across = [-d0[1], d0[0]];
  const me = dirs[viewer === 1 ? 1 : 0];
  const yaw = Math.atan2(-me[0], -me[1]);   // the card's top (+Z) points away from the viewer
  const holding = (h) => [c[0] + across[0] * (h - 1) * ILIAC_HOLD_GAP, top + CARD_T / 2, c[2] + across[1] * (h - 1) * ILIAC_HOLD_GAP];
  const side = (h, p, i) => {
    const b = holding(h), d = dirs[p];
    const out = ILIAC_SIDE_IN + i * ILIAC_SIDE_STEP;
    return [b[0] + d[0] * out, top + CARD_T / 2 + (i + 1) * ILIAC_SIDE_RISE, b[2] + d[1] * out];
  };
  const reach = Math.max(0.25, (frame.halfShort ?? 0.4) - CARD_L * 0.4);
  const edge = (p) => [c[0] + dirs[p][0] * reach, top + 0.12, c[2] + dirs[p][1] * reach];
  return { holding, side, edge, yaw, viewer };
}

/**
 * THE PICTURE at `t` (seconds): every card the view shows, `[{card, pos, yaw, uid}]` - `card` the catalog id, or null for
 * a back. `view` an iliacView (its holdings' sides by seat); `landed` the clock each uid came onto the cloth (the caller
 * keeps it - iliacLanded); a card still in its throw rides its arc from its owner's edge.
 * @param {any} view @param {ReturnType<typeof iliacPlaces>} places @param {number} t @param {Map<number, number>} landed
 */
export function iliacPoses(view, places, t, landed) {
  const out = [];
  if (!view) return out;
  view.holdings.forEach((hd, h) => {
    out.push({ card: hd.id, pos: places.holding(h), yaw: places.yaw, uid: `h${h}` });
    hd.sides.forEach((list, p) => list.forEach((c, i) => {
      const rest = places.side(h, p, i);
      const at = landed.get(c.uid);
      const k = at === undefined ? 1 : Math.max(0, Math.min(1, (t - at) / ILIAC_THROW_S));
      let pos = rest;
      if (k < 1) {
        const from = places.edge(p);
        const e = k * k * (3 - 2 * k);
        pos = [from[0] + (rest[0] - from[0]) * e, from[1] + (rest[1] - from[1]) * e + Math.sin(Math.PI * k) * ARC_HEIGHT, from[2] + (rest[2] - from[2]) * e];
      }
      out.push({ card: c.down ? null : (c.form ?? c.id ?? null), pos, yaw: places.yaw + (k < 1 ? (1 - k) * 0.6 : 0), uid: c.uid });
    }));
  });
  return out;
}

/**
 * The landing book moved on to a new view: each uid on the board not in `landed` came on at `t`; uids no longer on the
 * board are forgotten. A card first seen at a game's start (`settled`) lies where it is, unthrown. In place; answers it.
 * @param {Map<number, number>} landed @param {any} view @param {number} t @param {boolean} [settled]
 */
export function iliacLanded(landed, view, t, settled = false) {
  const on = new Set();
  for (const hd of view?.holdings ?? []) for (const list of hd.sides) for (const c of list) {
    on.add(c.uid);
    if (!landed.has(c.uid)) landed.set(c.uid, settled ? -Infinity : t);
  }
  for (const uid of [...landed.keys()]) if (!on.has(uid)) landed.delete(uid);
  return landed;
}
