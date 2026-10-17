// @ts-check
// POI-2 (2026-10-14; bible/06-Systems/POI-Editor-Arc.md): A POI'S MARK ON BOTH WORLD MAPS - every approved POI whose
// document asks for one (`marker.show`), a circle on its pixel with its label, from the moment an approver lets it into
// the world; a builder's own draft on the builder's own maps (POI-3).
//
// The host hands the maps a FUNCTION (`pois: () => marks[]`, beside MINE-PERKS' `lodes`) and neither map learns what a
// POI is: a mark is the bounty's circle in map pixels - `{cx, cy, r, label}` - read by the bounty's reader
// (ui/bounty/bountyMapMark.js readBountyMarks) and painted by its painter (ui/ink/inkMap.js paintBountyRing; the classic page's
// bountyRingTexels), in the POIs' own violet.
//
// Not a DFU member. Ledger A (POI).
import { BOUNTY_RING_R } from '../bounty/bountyMapMark.js';
import { t } from '../../systems/textManager.js';   // L10N4: the words through the text core

/** The held map's ink - a deep violet, read on the parchment as the bounty's black and the lode's teal are, and apart
 *  from every other circle's colour. */
export const POI_RING_CSS = '#5a2d8c';
export const POI_FILL_CSS = 'rgba(90, 45, 140, 0.16)';
/** The classic region page's texel - a bright violet over its land. */
export const POI_DOT_RGB = Object.freeze([186, 120, 255]);
/** AUDIT POI R7: the most POI circles a map draws - its own cap, not the bounty's eight (a hunter's four and room for a
 *  party): a realm's approved POIs are many more, and every one marked must show. */
export const POI_MARKS_MAX = 256;
/** The legend's word, and the reader's fallback label. */
export const poiLegendText = () => t('poi.map.legend', 'Point of interest');

/**
 * The host's POI marks (scenes/poiHost.js marks: `{ px, py, label }` each) as the maps' circles, centred on the pixel.
 * @param {ReadonlyArray<{ px: number, py: number, label?: string }>} marks
 * @returns {Array<{ cx: number, cy: number, r: number, label: string }>}
 */
export const poiMapMarks = (marks) => (marks ?? []).map((m) => ({ cx: m.px + 0.5, cy: m.py + 0.5, r: BOUNTY_RING_R, label: m.label || poiLegendText() }));
