// @ts-check
// AUDIT TAMRIEL-WIDE B4/C7 (2026-10-28, bible/06-Systems/Online-Arc.md STAFF1): THE STAFF'S /tp PAST
// THE BAY, the client's half. net/staffCommands.js read `/tp <x> <y>` on the Bay's 1000 x 500 - a province's pixel was
// refused and a signed one taken for a place's name - and the world host's place search read the location index and
// TESA's stood places alone. staffCommands.js is in the relay's bundle (its isStaff), so the world's grammar is read
// here, ahead of it: a change there is a relay release.
import { parseStaffCommand, STAFF_HELP_LINES } from '../net/staffCommands.js';
import { worldPixelOk } from '../net/wire.js';
import { BAY_THEATRE } from '../world/worldWide/worldGrid.js';

const TP_XY = /^\/tp\s+(-?\d+)\s+(-?\d+)$/i;
/** The Bay's bound in the relay's own help line (no new words: the line is staffCommands.js's, translated with it). */
const BAY_BOUND = / \(x 0-999, y 0-499\)$/;

/** A staff line as parseStaffCommand reads it, but `/tp <x> <y>` a pixel of the world's grid (worldPixelOk), either
 *  sign - one off it answered as a bare /tp is, with the command's usage. @param {string} text
 *  @param {{ god?: boolean, fly?: boolean }} [now] */
export function parseStaffLine(text, now = {}) {
  const m = TP_XY.exec(String(text ?? '').trim());
  if (!m) return parseStaffCommand(text, now);
  const px = Number(m[1]), py = Number(m[2]);
  if (!worldPixelOk(px) || !worldPixelOk(py)) return parseStaffCommand('/tp');
  return { cmd: 'tp', px, py };
}

/** The lines `/staff` shows, the pixel's line without the Bay's bound. */
export const staffHelpLines = () => STAFF_HELP_LINES.map((l) => l.replace(BAY_BOUND, ''));

/**
 * THE PLACES `/tp <place>` searches (net/staffCommands.js findPlace), in the order it always read them - the location
 * index's, then TESA's stood places on no indexed pixel - and after them the registry's listed places past the Bay
 * (world/worldWide/worldPlaces.js) on a pixel neither holds: a province's capitals, cities, towns and villages.
 * @param {{ locationIndex: Map<string, { name: string }>, stood?: Iterable<{ name: string, bx: number, by: number }> | null,
 *   registry?: { all: () => readonly { name: string, px: number, py: number, theatre: number }[] } | null }} o
 */
export function staffTpPlaces({ locationIndex, stood = null, registry = null }) {
  const places = [...locationIndex.entries()].map(([k, loc]) => { const [px, py] = k.split(',').map(Number); return { name: loc.name, px, py }; });
  const held = new Set(locationIndex.keys());
  for (const a of stood ?? []) if (!locationIndex.has(`${a.bx},${a.by}`)) { places.push({ name: a.name, px: a.bx, py: a.by }); held.add(`${a.bx},${a.by}`); }
  for (const p of registry?.all() ?? []) if (p.theatre !== BAY_THEATRE && !held.has(`${p.px},${p.py}`)) places.push({ name: p.name, px: p.px, py: p.py });
  return places;
}
