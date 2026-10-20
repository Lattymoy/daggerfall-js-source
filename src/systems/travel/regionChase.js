// @ts-check
// ═══════════════════════════════════════════════════════════════════
// OW-CHASE-RANGE (2026-10-19, the owner, of the Overworld's gaps: "4. Fix it"; bible/06-Systems/Travel-View.md
// OW-CHASE-RANGE): A CHASE SEEN AS FAR AS ITS BAND IS DRAWN.
//
// TV7b said a chase on the chaser's cell foes frame, and the relay fans that frame RANGE_PIXELS (3) about its sender,
// while the Overworld draws the bands BAND_REACH_PX (6) about the viewer - so a player three to six pixels from a chaser
// saw the band at its own wander, and kept seeing it after it was spent unless their cell's ledger heard (TV7b's recorded
// limit, AUDIT OW3's, OW6's). The region already has a word that reaches past the cell: each traveller's mark (TV3, the
// region's channel). The chaser's trav frame now carries its chase words BESIDE its mark (world230: `bd` the bands', `sr`
// the raiders' - the foes frame's own two words; AUDIT OW-REVISITED L4-1: as a key of the mark every older client dropped
// the traveller whole), said when a chase begins or ends or a band is spent, and again every TRAV_CHASE_REFRESH_MS while a
// chase runs; a reader hears them through the bands' and the raiders' own hearing, the word standing TRAV_BAND_HOLD_MS -
// and (AUDIT OW-REVISITED) as the cell's word does:
//   - at every distance its sender could share a band with the reader (L4-4: past the cell's reach only, a chase went
//     unseen for up to seven seconds at the hand-over), a fresh cell word for the same id preferred (the bands' hearing);
//     never from a sender farther (L4-5: any traveller in the region could spend every band about a reader);
//   - WITHDRAWN when the chaser's next mark no longer names it, their mark is cleared, they leave, or a welcome no longer
//     lists them (L4-2 / L6-2: a far chase stood drawn twenty-five seconds after it ended);
//   - a spent band and raider of a life gone by never said (L4-6: they filled the word's slots).
//
// What it is not: a mark is said only by a traveller who shows themselves to the region ("Show me to travellers", on by
// default - TV3) and only in their region's channel - a chaser who hides, or one across a region's border, is heard as
// before, within the cell's three pixels. A chase's place is the mark's, said at most once a TRAV_CHASE_REFRESH_MS.
//
// PURE: words in, words out. The host (scenes/world.js) says the mark and hears the region.
// ═══════════════════════════════════════════════════════════════════
import { BANDS_WIRE_MAX, BAND_REACH_PX, BAND_CELL_PX } from './travelBands.js';
import { RAIDER_REACH_PX, RAIDER_CELL_PX } from '../seaRaiders.js';
import { TRAV_CHASE_REFRESH_MS } from '../travellerMarks.js';

/** How long a chase heard from the region stands: two refreshes and a half - one missed (the room over its budget, a
 *  frame refused) and the band is still drawn where it ran. */
export const TRAV_BAND_HOLD_MS = 2.5 * TRAV_CHASE_REFRESH_MS;
/** AUDIT OW-REVISITED L4-5: the farthest a sender may stand (map pixels, from the reader) for its words to be heard - a band
 *  about the reader (bandNearMe: its reach and its cell) chased by a sender beside it, and a pixel to spare; a raider's the
 *  same by the sea's reaches. */
export const REGION_BANDS_NEAR_PX = BAND_REACH_PX + BAND_CELL_PX + 1;
export const REGION_RAIDERS_NEAR_PX = RAIDER_REACH_PX + RAIDER_CELL_PX + 1;

/** The life an id names (`b<cx>.<cy>.<life>`, `r...`), or NaN. */
const lifeOf = (id) => Number(String(id).split('.').pop());

/** One word for the region: the chases first, then the spent of this life and the last (AUDIT OW-REVISITED L4-6: a
 *  spent one of a life gone by is no reader's), at most BANDS_WIRE_MAX. */
function regionWord(word, life) {
  const all = word ?? [];
  return [...all.filter((e) => e[3] === 1), ...all.filter((e) => e[3] !== 1 && lifeOf(e[0]) >= life - 1)].slice(0, BANDS_WIRE_MAX);
}
/** The words a mark carries beside it: `bd` the bands' word, `sr` the raiders' (each chaseWordOf's own, each its own
 *  slots), the lives `bandLife` and `raidLife` the spent are kept for. */
export function regionChaseWords(bandWord, raidWord, bandLife, raidLife) {
  return { bd: regionWord(bandWord, bandLife), sr: regionWord(raidWord, raidLife) };
}

/** The chase words a region's frame says that are mine to hear - each word from a sender near enough to share its chase
 *  with me (REGION_BANDS_NEAR_PX, REGION_RAIDERS_NEAR_PX): `{ bd, sr }` (empty where none), or null for a frame with no
 *  mark. `me` my map pixel. */
export function regionChaseHeard(f, me) {
  if (!f?.p || !me) return null;
  const d = Math.max(Math.abs(f.p.px - me.x), Math.abs(f.p.py - me.y));
  return { bd: d <= REGION_BANDS_NEAR_PX && Array.isArray(f.bd) ? f.bd : [], sr: d <= REGION_RAIDERS_NEAR_PX && Array.isArray(f.sr) ? f.sr : [] };
}

/** AUDIT OW-REVISITED L4-2: a far chaser's word withdrawn - from `peers` (the bands' or the raiders' peer book: id ->
 *  { from, hold, ... }), every entry the region heard from `from` (its `hold` the region's) that `keep` (ids, or null for
 *  none) no longer names. */
export function regionChaseWithdraw(peers, from, keep = null) {
  for (const [id, p] of peers) if (p.from === from && p.hold === TRAV_BAND_HOLD_MS && !keep?.has(id)) peers.delete(id);
}
