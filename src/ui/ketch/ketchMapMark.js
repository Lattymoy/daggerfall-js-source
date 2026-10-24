// @ts-check
// KETCH (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md section 2, the held map): THE SKY-KETCH ON THE HELD MAP - the gate's ring's
// twin (ui/gate/gateMapMark.js), read by its reader (readGateMark - `{day, cx, cy, r, label, phase, tip}`, scenes/ketch/
// ketchClient.js mapMark) and painted by its painter (ui/ink/inkMap.js paintGateRing), in the aether's blue: a ring about
// Daggerfall while she is in its sky - sighted, keeping station, weighing anchor - and her card under the pointer. She is
// not a place in MAPS.BSA, so the classic region page draws none (the NATIVE-WINDOW RULE); the held map, the chat and the
// Timers window say where she is.
//
// Not a DFU member. Ledger A (KETCH).
import { t } from '../../systems/textManager.js';

/** The ring's ink and the fill under it - the aether's blue-white (world/ketch/ketchArt.js KT_RAMP.aether), apart from the
 *  gate's red, the serpent's sea-green, the Abyss Dungeon's brass, the arch's gold and the party's green. Her herald's card
 *  edge (net/herald/heraldCard.js HERALD_FAMILIES.ketch) is this colour too. */
export const KT_RING_CSS = '#7cc4ff';
export const KT_FILL_CSS = 'rgba(124, 196, 255, 0.18)';
/** The legend's word - the English identity; shown through ketchLegendText (L10N4, as the Motherlode's - ui/lodeMapMark.js). */
export const KT_LEGEND_TEXT = 'The Sky-Ketch';
export const ketchLegendText = () => t('ketch.legend', KT_LEGEND_TEXT);
/** The ring's reach about Daggerfall's pixel (map pixels). */
export const KT_RING_R = 1.6;
/** The painter's colours (ui/ink/inkMap.js paintGateRing's `ink`). */
export const KT_MAP_INK = Object.freeze({ ring: KT_RING_CSS, fill: KT_FILL_CSS });
