// TR4 - THE SHIP: TransportManager's ship arm (:79-84, :360-402), the
// last slice of the transport arc and the reason TR3's picker had
// `shipAvailable: false` nailed shut.
//
// The OWNERSHIP half was already ported, by the bank arc rather than
// this one: `banking.js` carries ShipType, the two prices, the two
// map-pixel coords, `ownedShipType`/`ownsShip`/`shipCoords` and
// `assignShipToPlayer`, and `save.js` persists `ownedShip`. Nothing
// here re-states any of it.
//
// What was missing is that "Ship" is not a mode you travel IN - DFU's
// own comment on the enum says "(not a real player transport mode)".
// Picking it is a TELEPORT, and the mode lands back on Foot:
//
//   NOT on the ship -> remember where you are, go to the ship's map
//   pixel with a RandomStartMarker reposition.
//   ON the ship     -> go back to where you were remembered, with NO
//   reposition, and forget the memory.
//
// `boardShipPosition` is the whole state, and IsOnShip (:79-84) is the
// question "do I have a memory AND am I standing on the ship's pixel" -
// so a player who owns a ship, boards, saves, and loads somewhere else
// is NOT on the ship and boarding again would overwrite the memory.
// That is DFU's behaviour and the port keeps it.
//
// The terrain-sampler check (:373-379) has no counterpart: the port has
// one sampler and no version, so the `RandomStartMarker` fallback it
// guards can never fire. Recorded, not invented.

import { ownsShip, shipCoords } from './banking.js';
import { TRANSPORT_MODES } from './transport.js';

/** StreamingWorld.RepositionMethods, the two this arm uses. */
export const REPOSITION = Object.freeze({ None: 'None', RandomStartMarker: 'RandomStartMarker' });

/**
 * IsOnShip (:79-84): a remembered boarding AND the player standing on
 * the ship's own map pixel.
 */
export function isOnShip(player, boardShipPosition, mapPixel) {
  const coords = shipCoords(player);
  return !!boardShipPosition && !!coords && !!mapPixel
    && mapPixel.x === coords.x && mapPixel.y === coords.y;
}

/**
 * UpdateMode's ship arm (:360-402), as a decision. The caller does the
 * teleport and the fade; this answers WHERE to go, WHAT to remember,
 * and with which reposition.
 *
 * @returns {{go:{x:number,y:number}, reposition:string,
 *            boardShipPosition:object|null, mode:string}|null}
 *          null when the player owns no ship - DFU reaches
 *          GetShipCoords() null and would throw, but the picker's row
 *          is disabled without one, so the port answers "nothing".
 */
export function shipTransition(player, { boardShipPosition = null, mapPixel = null, position = null } = {}) {
  const coords = shipCoords(player);
  if (!ownsShip(player) || !coords) return null;
  if (isOnShip(player, boardShipPosition, mapPixel)) {
    // Disembark: back to the remembered spot, exactly, and forget it.
    return {
      go: { x: boardShipPosition.mapPixel.x, y: boardShipPosition.mapPixel.y },
      reposition: REPOSITION.None,
      restore: boardShipPosition,
      boardShipPosition: null,
      mode: TRANSPORT_MODES.Foot,
    };
  }
  // Board: remember where we are, and land at a start marker.
  return {
    go: { x: coords.x, y: coords.y },
    reposition: REPOSITION.RandomStartMarker,
    restore: null,
    boardShipPosition: position,
    mode: TRANSPORT_MODES.Foot,
  };
}
