// @ts-check
// DECK-PROPS (2026-10-17, the owner: "Allowing prop placement on the ship itself and inside if not already enabled";
// bible/03-World/Naval-Refit.md DECK-PROPS) - A SHIP'S DECK FITTINGS: the law. The port's own; pure.
//
// INSIDE was enabled already: her cabin below (SAILING-CABINS) is a room the decorator furnishes as a house is
// (scenes/worldModes.js decorRoomHere's `ship`). ON HER DECK nothing could stand: Come Sail Away's hulls carry the mod's
// own fittings alone (its ModelHelpers - classic models hung in the prefab). A captain's fittings are fittings of that
// kind: each a classic model Daggerfall stands in its rooms - its crates and its chests (the house containers World
// Tooltips names, systems/worldTooltips.js) - set on her open deck at a point of her own frame
// (her MeshObject's, the frame her deck is baked in - systems/naval/navalDeck.js) and turned about up, a model in her
// tree as the mod's are: drawn with her, rocking with her, standing in her colliders (one walks round a crate, climbs
// onto a chest) - scenes/comeSailAway/deckFittingsHost.js.
//
// A FITTING is `{ m, x, z, yaw }`: `m` its model (DECK_FITTINGS'), `x`/`z` its place on her deck (metres, her frame),
// `yaw` its turn (a sixteenth of a turn a step, 0-15). Its height is her deck's under it, read when it stands. At most
// DECK_FITTINGS_MAX, none nearer another than FITTING_GAP, none past FITTING_REACH from her middle.
//
// THE WORD: her fittings ride the boats' word (systems/comeSailAway/comeSailAwayWire.js `d`) as four numbers each - its
// model's place in DECK_FITTINGS, x and z in decimetres, its turn (`fittingsCode`); a reader takes them through the door
// (`fittingsOfCode`), a list it refuses read as none.

/** The fittings a captain may stand on her deck: each `[model, kind]` - the house containers by the names the game
 *  gives them (systems/worldTooltips.js CONTAINER_NAME_GROUPS: its Crates and its Chests - the decorator's own names for
 *  them, systems/decor/decorCatalogue.js). Their order is the word's (`fittingsCode`): new ones go at the end. */
export const DECK_FITTINGS = Object.freeze([
  ...[41815, 41816, 41817, 41818, 41819, 41820, 41821, 41822, 41823, 41824, 41825, 41826, 41827, 41828, 41829, 41830, 41831, 41832, 41833, 41834].map((m) => Object.freeze([m, 'crate'])),
  ...[41811, 41812, 41813].map((m) => Object.freeze([m, 'chest'])),
]);
const MODELS = new Map(DECK_FITTINGS.map(([m, kind], i) => [m, { i, kind }]));
/** The most fittings a ship carries. */
export const DECK_FITTINGS_MAX = 24;
/** The least room between two fittings' places (metres). */
export const FITTING_GAP = 0.6;
/** The farthest a fitting stands from her middle (metres) - a Carrack's length and some. */
export const FITTING_REACH = 40;
/** A fitting's turn, in sixteenths of a turn. */
export const YAW_STEPS = 16;

/** Whether `m` is a fitting's model. */
export const isFitting = (m) => MODELS.has(m);
/** A fitting's kind ('crate' or 'chest'), or null. */
export const fittingKind = (m) => MODELS.get(m)?.kind ?? null;
/** A fitting's turn in degrees about up (world/quat.js quatAngleAxis's). */
export const yawDegrees = (yaw) => ((yaw % YAW_STEPS) / YAW_STEPS) * 360;

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
/** A place on her deck to the decimetre (the word's own). */
const dm = (v) => Math.round(v * 10) / 10;
/**
 * Her fittings through the door: each a known model at a finite place within FITTING_REACH, its turn 0-15 - a fitting
 * that is none of these left out, one nearer one before it than FITTING_GAP left out, the first DECK_FITTINGS_MAX kept.
 * Places to the decimetre. Pure.
 */
export function fittingsOf(raw) {
  const out = [];
  for (const f of Array.isArray(raw) ? raw : []) {
    if (out.length >= DECK_FITTINGS_MAX) break;
    if (!f || typeof f !== 'object' || !isFitting(f.m) || !finite(f.x) || !finite(f.z)) continue;
    const x = dm(f.x), z = dm(f.z);
    if (Math.hypot(x, z) > FITTING_REACH) continue;
    if (out.some((o) => Math.hypot(o.x - x, o.z - z) < FITTING_GAP)) continue;
    const yaw = Number.isInteger(f.yaw) ? ((f.yaw % YAW_STEPS) + YAW_STEPS) % YAW_STEPS : 0;
    out.push({ m: f.m, x, z, yaw });
  }
  return out;
}
/** Her fittings as the word's numbers: four each (its model's place in DECK_FITTINGS, x and z in decimetres, its turn). */
export function fittingsCode(list) {
  const out = [];
  for (const f of fittingsOf(list)) out.push(MODELS.get(f.m).i, Math.round(f.x * 10), Math.round(f.z * 10), f.yaw);
  return out;
}
/** The word's numbers as her fittings - [] for none, or numbers that are not four a fitting. */
export function fittingsOfCode(code) {
  if (!Array.isArray(code) || code.length % 4 || code.length > DECK_FITTINGS_MAX * 4 || !code.every(Number.isInteger)) return [];
  const raw = [];
  for (let i = 0; i < code.length; i += 4) raw.push({ m: DECK_FITTINGS[code[i]]?.[0], x: code[i + 1] / 10, z: code[i + 2] / 10, yaw: code[i + 3] });
  return fittingsOf(raw);
}
/** A list's key - two lists alike are one key (the host's "has it changed"). */
export const fittingsKey = (list) => fittingsCode(list).join(',');
