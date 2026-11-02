// @ts-check
// ═══════════════════════════════════════════════════════════════════
// CROWN-HALL (2026-10-02, Mac: "Build that next" - the crown's hall
// after SEAT-HALL's palace): A CROWN'S CASTLE AS ITS HOLDER'S HALL
// (bible/11-Multiplayer/Seats-Arc.md 7.2: "Crown: the castle is the
// hall - its throne room carries the holder's banners, the roster board
// and the Stores chest, and no decor").
//
// THE THRONE ROOM is where the crown's ruler holds court: the region's
// Province faction's first child, when it is an Individual, IS the
// ruler (MacroHelper.GetLordNameForFaction's own law - talk.js
// lordNameForFaction), and the castle's static NPC carrying that
// faction id stands in the throne room (Gothryd, Eadwyre, Akorithi).
// DECIDED: the pieces are placed about that person, measured in the
// dungeon's own collider - no castle's layout is written down here.
//
//   - THE BANNERS: two, on the wall behind the ruler (the nearest
//     surface round the throne, over its back - the room opens the
//     other way), a pace and a half either side, the cloth's top under
//     the ceiling;
//   - THE ROSTER BOARD and THE STORES CHEST: Daggerfall's own board
//     model and chest model, standing on the floor a few paces into the
//     room, one either side of the aisle, each where a clear line runs
//     to it from the throne and the floor under it is the throne
//     room's.
//
// A castle where no such person stands, or where the collider finds no
// floor under them, stands none of it (said nowhere - the castle is as
// Daggerfall has it). Pure: the host hands the faction dict, the people
// and the collider's ray.
// ═══════════════════════════════════════════════════════════════════
import { FACTION_TYPES } from '../formats/factionFile.js';
import { BANNER_H_M } from '../render/bannerPass.js';
import { BULLETIN_BOARD_MODEL_ID } from '../world/rmbLayout.js';
import { isProvinceFactionId } from './faction/provinceFactions.js'; // PROVINCE-COURTS: a province's ruler
import { CASTLE_SEATS } from '../world/capitalCastles.js'; // PROVINCE-COURTS: the castle copy's throne seat

/** Daggerfall's chest (worldTooltips.js's "Chest", the first of its three). */
export const CROWN_HALL_CHEST_MODEL = 41811;
/** The roster board: Daggerfall's own notice board model (GUILD1e's hall board). */
export const CROWN_HALL_BOARD_MODEL = BULLETIN_BOARD_MODEL_ID;
/** Every length here, metres. The eye the rays are cast at over the floor; how far a ray looks round the throne for
 *  the wall behind it; how far that wall may stand for the banners to hang on it; the banners' spread either side of the ruler and their gap under the ceiling,
 *  and their least height over the floor; how far the cloth hangs off the wall. */
export const CROWN_HALL_EYE_M = 1.2;
/** The wall behind is looked for this high over the floor - above a throne's back, so the cloth hangs on the wall. */
export const CROWN_HALL_WALL_EYE_M = 2.4;
export const CROWN_HALL_LOOK_M = 12;
export const CROWN_HALL_WALL_M = 6;
export const CROWN_HALL_BANNER_SIDE_M = 1.5;
export const CROWN_HALL_BANNER_CEIL_M = 0.1;
export const CROWN_HALL_BANNER_TOP_M = 3.2;
export const CROWN_HALL_BANNER_OUT_M = 0.15;
/** Where the board and the chest are tried: paces into the room and to the side, in order, the first that stands. A
 *  piece keeps CROWN_HALL_CLEAR_M from anything the line to it meets, and its floor within CROWN_HALL_STEP_M of the
 *  throne room's. */
export const CROWN_HALL_SPOTS = Object.freeze([
  [2.5, 2],
  [2.5, 1.5],
  [2, 1.5],
  [3, 2],
  [2, 1],
  [1.5, 1],
]);
export const CROWN_HALL_CLEAR_M = 0.6;
export const CROWN_HALL_STEP_M = 0.6;
/** Eight ways round, the first the castle's +z. */
const WAYS = Object.freeze(
  Array.from({ length: 8 }, (_, i) => Object.freeze([Math.sin((i * Math.PI) / 4), Math.cos((i * Math.PI) / 4)])),
);

/**
 * THE CROWN'S RULER - the faction id of the region's ruler, or null: the region's Province faction (type 7) whose first
 * child is an Individual (type 4), as MacroHelper.GetLordNameForFaction reads it.
 * @param {Map<number, any>|null|undefined} factionDict
 * @param {number} region
 */
export function crownRulerFactionId(factionDict, region) {
  if (!factionDict || !Number.isInteger(region)) return null;
  for (const f of factionDict.values()) {
    if (f?.type !== FACTION_TYPES.Province || f.region !== region) continue;
    const first = f.children?.length ? factionDict.get(f.children[0]) : null;
    return first?.type === FACTION_TYPES.Individual ? first.id : null;
  }
  return null;
}

/**
 * THE THRONE ROOM'S PIECES about the ruler at `at` (`{ x, y, z }`, the dungeon's frame; `y` anywhere on their body) -
 * `{ floor, banners, board, chest }`, or null where no floor stands under them. `banners` is `[]` where no wall stands
 * behind the throne; `board` and `chest` (`{ pos, yawDeg, model }`) are null where no spot of CROWN_HALL_SPOTS stands.
 * `ray(origin, dir, max)` is the collider's: the distance to the first surface, or Infinity.
 * @param {{ x: number, y: number, z: number }} at
 * @param {(o: number[], d: number[], max: number) => number} ray
 */
export function crownHallPlan(at, ray) {
  if (!at || ![at.x, at.y, at.z].every(Number.isFinite) || typeof ray !== 'function') return null;
  const drop = ray([at.x, at.y + 0.5, at.z], [0, -1, 0], 8);
  if (!Number.isFinite(drop)) return null;
  const floor = at.y + 0.5 - drop;
  const eye = floor + CROWN_HALL_EYE_M;
  const look = (x, z, w, max) => {
    const d = ray([x, eye, z], [w[0], 0, w[1]], max);
    return Number.isFinite(d) ? d : max;
  };
  // the wall behind the throne: the nearest surface round the ruler, looked for over a throne's back (the first, on a
  // tie - an axis before its diagonal in a square room); the room opens the other way
  const high = floor + CROWN_HALL_WALL_EYE_M;
  let back = WAYS[4];
  let wall = Infinity;
  for (const w of WAYS) {
    const d = ray([at.x, high, at.z], [w[0], 0, w[1]], CROWN_HALL_LOOK_M);
    if (Number.isFinite(d) && d < wall - 1e-6) {
      wall = d;
      back = w;
    }
  }
  const open = [-back[0], -back[1]];
  const side = [open[1], -open[0]]; // the aisle's one side; its other, negated
  // THE BANNERS: on that wall, facing into the room, the cloth's top under the ceiling
  const banners = [];
  if (wall <= CROWN_HALL_WALL_M) {
    const up = ray([at.x, eye, at.z], [0, 1, 0], 8);
    const ceiling = Number.isFinite(up) ? eye + up : floor + CROWN_HALL_BANNER_TOP_M + CROWN_HALL_BANNER_CEIL_M;
    const top = Math.min(floor + CROWN_HALL_BANNER_TOP_M, ceiling - CROWN_HALL_BANNER_CEIL_M);
    if (top - BANNER_H_M >= floor) {
      const d = wall - CROWN_HALL_BANNER_OUT_M;
      const out = [open[0], 0, open[1]];
      const right = [-out[2], 0, out[0]]; // AUDIT GUILD1d R4: the cloth's right from its face, never from the wall's order
      for (const s of [-1, 1]) {
        const x = at.x + back[0] * d + side[0] * s * CROWN_HALL_BANNER_SIDE_M;
        const z = at.z + back[1] * d + side[1] * s * CROWN_HALL_BANNER_SIDE_M;
        banners.push({ top: [x, top, z], right, out });
      }
    }
  }
  /** A piece stood on the floor `fwd` paces into the room and `lat` to side `s`, facing the aisle - or null. */
  const stand = (s, model) => {
    for (const [fwd, lat] of CROWN_HALL_SPOTS) {
      const x = at.x + open[0] * fwd + side[0] * s * lat;
      const z = at.z + open[1] * fwd + side[1] * s * lat;
      const dx = x - at.x,
        dz = z - at.z,
        len = Math.hypot(dx, dz);
      if (look(at.x, at.z, [dx / len, dz / len], len + CROWN_HALL_CLEAR_M) < len + CROWN_HALL_CLEAR_M) continue;
      const under = ray([x, eye, z], [0, -1, 0], CROWN_HALL_EYE_M + CROWN_HALL_STEP_M);
      if (!Number.isFinite(under) || Math.abs(eye - under - floor) > CROWN_HALL_STEP_M) continue;
      const face = [-side[0] * s, -side[1] * s]; // towards the aisle
      return { pos: [x, eye - under, z], yawDeg: (Math.atan2(face[0], face[1]) * 180) / Math.PI, model };
    }
    return null;
  };
  return { floor, banners, board: stand(1, CROWN_HALL_BOARD_MODEL), chest: stand(-1, CROWN_HALL_CHEST_MODEL) };
}

/**
 * THE RULER IN THIS CASTLE: the first of `people` (the dungeon's static NPCs, `{ x, y, z, factionID }`) carrying the
 * ruler's faction id, or null.
 * @param {Array<any>|null|undefined} people
 * @param {number|null} rulerId
 */
export const crownRulerHere = (people, rulerId) => {
  if (rulerId == null) return null;
  const list = people ?? [];
  // PROVINCE-COURTS: a province's ruler (systems/faction/provinceFactions.js) sits a capital's castle under DFU's
  // generic ruler - the copy's throne seat (world/capitalCastles.js CASTLE_SEATS), one copy serving two capitals
  return (
    list.find((p) => p?.factionID === rulerId) ??
    (isProvinceFactionId(rulerId) ? (list.find((p) => p?.factionID === CASTLE_SEATS.ruler.faction) ?? null) : null)
  );
};

/** The throne room's words. */
export const CROWN_HALL_TEXT = Object.freeze({
  board: 'Roster board',
  chest: 'Stores chest',
  chestShut: (name) => `This chest is ${name || "the crown's guild"}'s. Its Stores are for its members.`,
});
