// @ts-check
// EG-F (2026-10-12, the Elite Gates arc, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 2,
// the held map): AN ELITE BREACH'S ARCH ON THE HELD MAP - the gate's ring's twin (ui/gate/gateMapMark.js), read by its reader
// (readGateMark - `{day, cx, cy, r, label, phase, tip}`, scenes/eliteGates/egArch.js mapMark) and painted by its painter (ui/ink/inkMap.js
// paintGateRing), in the arch's gold. The company's alone, while its arch stands: it is not a place in MAPS.BSA, so the
// classic region page draws none (the NATIVE-WINDOW RULE); the held map, the compass, the chat's sight line and the Timers
// window say where it is.
//
// Not a DFU member. Ledger A (ELITE-GATES).

/** The ring's ink and the fill under it - the arch's gold (scenes/eliteGates/egArch.js EG_ARCH_GOLD), apart from the gate's red, the
 *  serpent's sea-green, the Abyss Dungeon's brass and the party's green. */
export const EG_ARCH_RING_CSS = '#ffd56a';
export const EG_ARCH_FILL_CSS = 'rgba(255, 213, 106, 0.18)';
export const EG_ARCH_LEGEND_TEXT = 'Elite Breach';
/** The painter's colours (ui/ink/inkMap.js paintGateRing's `ink`). */
export const EG_ARCH_MAP_INK = Object.freeze({ ring: EG_ARCH_RING_CSS, fill: EG_ARCH_FILL_CSS });
