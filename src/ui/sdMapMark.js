// @ts-check
// SD2c (2026-10-06, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 4): THE SUPER DUNGEON'S RING
// ON THE HELD MAP - the gate's ring's twin (ui/gateMapMark.js), read by its reader (readGateMark - the same
// `{day, cx, cy, r, label, phase, tip}`, systems/sdOmen.js sdMapMark, the slot in the day's place) and painted by its
// painter (ui/inkMap.js paintGateRing) in the Hollow's brass. Once it is found it is news: ringed on its own pixel - a
// place now, not an area. The classic region page draws no Super dungeon (a native window, and DFU has none - the
// NATIVE-WINDOW RULE); the held map, the chat, the compass and the Timers window say where it is.
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).

/** The ring's ink and the fill under it - the omen's brass (render/sdOmenPass.js SD_OMEN_COLOR), apart from the gate's
 *  red, the serpent's sea-green, the party's green and every dot. */
export const SD_RING_MAP_CSS = '#e8b24a';
export const SD_FILL_CSS = 'rgba(232, 178, 74, 0.16)';
export const SD_LEGEND_TEXT = 'Super Dungeon';
/** The painter's colours (ui/inkMap.js paintGateRing's `ink`). */
export const SD_MAP_INK = Object.freeze({ ring: SD_RING_MAP_CSS, fill: SD_FILL_CSS });
