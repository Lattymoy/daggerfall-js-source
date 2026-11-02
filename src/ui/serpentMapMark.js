// @ts-check
// SERPENT1 (2026-10-04, Mac: "a large scale sea serpent in the ocean"): THE SERPENT'S RING ON THE HELD MAP - the gate's
// ring's twin (ui/gate/gateMapMark.js), read by its own reader (readGateMark - the same `{day, cx, cy, r, label, phase, tip}`
// from systems/serpent/serpentOmen.js mapMark()) and painted by its own painter (ui/ink/inkMap.js paintGateRing) in the sea's colours.
// The host hands the held map `serpent: () => mark|null`; the classic region page draws no serpent (a province's sheet
// shows little of the open sea it hunts) - the held map, the chat and the compass say where it is. Design:
// bible/11-Multiplayer/Sea-Serpent.md section 2.
//
// Not a DFU member. Ledger A (SERPENT1).

/** The ring's ink and the fill under it - a sea-green apart from the gate's red, the party's green and every dot. */
export const SERPENT_RING_MAP_CSS = '#3fd6c6';
export const SERPENT_FILL_CSS = 'rgba(40, 200, 185, 0.14)';
export const SERPENT_LEGEND_TEXT = 'Sea serpent';
/** The painter's colours (ui/ink/inkMap.js paintGateRing's `ink`). */
export const SERPENT_MAP_INK = Object.freeze({ ring: SERPENT_RING_MAP_CSS, fill: SERPENT_FILL_CSS });
