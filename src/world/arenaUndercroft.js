// @ts-check
// ARENA-FIX 4 (2026-10-02): THE ARENA UNDERCROFT - THE FIGHTERS' HALL. Kamer's 32 blocks under the colosseum
// (world/arenaCity.js undercroftLocation) were laid as any keep is: a HumanStronghold's encounter table over its 343
// random markers, so the stair down from the sand opened on a dungeon full of bandits. The design (bible/11-Multiplayer/
// Arena.md "1. The building", the undercroft) is a HALL: "Its people are fighters at rest, the arena's keepers and the
// caged beasts of the beast tiers; it holds the ladder's training pit (an unranked bout against a dummy-fighter) and
// the Hall of Champions - a plaque wall naming every Grand Champion this save".
//
// So, down there (all of it Daggerfall's own art, laid at the layout's own markers - nothing placed by hand, so the
// same every load and every machine):
// - NO RANDOM FOE stands at any marker and no rest is broken by one (scenes/dungeonContext.js reads `isUndercroft`).
// - THE PEOPLE: nearest the stair down, the PIT MASTER (357:3, the man in black) at the training pit, its straw dummy
//   (211:20) beside him; the KEEPER OF THE HALL (183:12, the hooded archivist) at the Hall of Champions, its trophies
//   (the champions' cups 200:1 and 200:5, a shield, a helm and a sword of TEXTURE.207) round her; then, at the next
//   markers out, the fighters at rest (357:10 and 357:11 the pit fighters, 357:7 sitting, 334:11 at his lute on a
//   chest) and the keepers (334:14 the armourer at his anvil, 184:16 the cook, 334:7 at his book, 334:17 and 334:18).
//   The pit and the Hall each burn a brazier (210:19), and every place a person stands is lit (a dungeon Light).
//   Static people in person archives with the People of Daggerfall's faction (518) - the ray meets them and they talk
//   as the city's people do; the four with an office answer by it (ARENA_TEXT.undercroft.names).
// - THE CHAINED BEASTS of the beast tier (a Grizzly Bear, a Sabertooth Tiger, a Giant Scorpion, a second bear) at the
//   markers past the people, chained (211:5 either side): real bodies, passive, and caged by the bout team's gate
//   (characters/enemyTargets.js boutGate - a tag nobody shares and always held: they target nobody and nobody them),
//   held at the foe yield floor if struck (no corpse, no loot) and the keepers' warning said.
// - The rest of the markers stand empty - the deep cellars are quiet.
//
// Pure: markers in, the population out. Not a DFU member. Ledger A (ARENA).

import { MOBILE_TYPES as M } from '../characters/mobileTypes.js';

/** The People of Daggerfall (FACTION.TXT) - the hall's people talk as the city's do. */
export const UNDERCROFT_FACTION = 518;
/** The training pit's ring, metres (a cellar is not the sand: the clamp holds the bout to the pit). */
export const PIT_RING_R = 6;
/** Editor markers: archive 199, record 10 the start, 15 a random foe, 16 a fixed one. */
const EDITOR = 199, START = 10, RANDOM = 15, FIXED = 16;

/** The two with a post, then the hall's people in the order they take the markers out from the stair. `female` sets
 *  StaticNPC's gender flag (32). */
export const PIT_MASTER = Object.freeze({ role: 'pitMaster', archive: 357, record: 3 });
export const HALL_KEEPER = Object.freeze({ role: 'hallKeeper', archive: 183, record: 12 });
export const UNDERCROFT_PEOPLE = Object.freeze([
  Object.freeze({ role: 'fighter', archive: 357, record: 10 }),
  Object.freeze({ role: 'armourer', archive: 334, record: 14 }),
  Object.freeze({ role: 'fighter', archive: 357, record: 11 }),
  Object.freeze({ role: 'keeper', archive: 184, record: 16 }),
  Object.freeze({ role: 'fighter', archive: 357, record: 7 }),
  Object.freeze({ role: 'fighter', archive: 334, record: 11 }),
  Object.freeze({ role: 'keeper', archive: 334, record: 7 }),
  Object.freeze({ role: 'keeper', archive: 334, record: 17 }),
  Object.freeze({ role: 'keeper', archive: 334, record: 18, female: true }),
]);
/** The beast tier's chained beasts, in the order they take the markers past the people. */
export const UNDERCROFT_BEASTS = Object.freeze([M.GrizzlyBear, M.SabertoothTiger, M.GiantScorpion, M.GrizzlyBear]);
/** The training pit's dummy; the Hall of Champions' trophies; a beast's chain. */
export const PIT_DUMMY = Object.freeze([211, 20]);
export const HALL_TROPHIES = Object.freeze([Object.freeze([200, 1]), Object.freeze([207, 8]), Object.freeze([200, 5]), Object.freeze([207, 12]), Object.freeze([207, 2])]);
export const BEAST_CHAIN = Object.freeze([211, 5]);
/** The braziers that light the pit and the Hall (TEXTURE.210's standing brazier, the colosseum's own), and the reach of
 *  the light every lit place of the hall gives, metres (a dungeon Light's range). */
export const HALL_BRAZIER = Object.freeze([210, 19]);
export const HALL_LIGHT_M = 7;
/** The undercroft's flats' identities (StaticNPC's name seed and the actions' keys stay clear of any RDB object's). */
const SEED = 0x55430000;

const isEditor = (m) => (m.archive ?? EDITOR) === EDITOR;

/**
 * THE HALL'S POPULATION over a laid-out undercroft: `blocks` `[{ layout: { markers }, originX, originZ }]` (the
 * dungeon context's own). Answers `{ flats, beasts, lights, pit, hall, quiet }`: `flats` to add to their block's flats
 * (`{ block, archive, record, x, y, z, npc, role, factionID, flags, position, flatPosition, rawX, rawY, rawZ }`, in the
 * block's frame), `beasts` the chained beasts (`{ x, y, z, mobileType }`, the dungeon's frame), `pit` the training
 * pit's centre (and `pitAxis` its passage's way, [x, z]) and `hall` the Hall of Champions' (the dungeon's frame, or null), `lights` the hall's lamps (`{ x, y, z, range }`, the
 * dungeon's frame - every lit place: the pit's and the Hall's braziers, each person's lamp), `quiet` how many markers
 * stand empty.
 * Pure.
 */
export function undercroftPopulation(blocks) {
  /** @type {{ x: number, y: number, z: number, block: number, k: number }[]} */
  const marks = [];
  let start = null;
  blocks.forEach((b, block) => {
    for (const m of b.layout?.markers ?? []) {
      if (!isEditor(m)) continue;
      const at = { x: m.x + b.originX, y: m.y, z: m.z + b.originZ, block, k: marks.length };
      if (m.record === START && !start) start = at;
      else if (m.record === RANDOM || m.record === FIXED) marks.push(at);
    }
  });
  const out = { flats: [], beasts: [], lights: [], pit: null, pitAxis: null, hall: null, quiet: 0 };
  if (!marks.length) return out;
  const s = start ?? marks[0];
  const d = (m) => Math.hypot(m.x - s.x, m.y - s.y, m.z - s.z);
  const order = marks.slice().sort((a, b) => d(a) - d(b) || a.k - b.k);
  let seed = 0;
  /** a flat at a marker's place, `side`/`along` metres off it (the side square to the way back to the stair) */
  const flat = (m, archive, record, { side = 0, along = 0, person = null } = {}) => {
    const hx = s.x - m.x, hz = s.z - m.z, hl = Math.hypot(hx, hz) || 1;
    const ux = hx / hl, uz = hz / hl, px = -uz, pz = ux;
    const b = blocks[m.block];
    const x = m.x + px * side + ux * along - b.originX, z = m.z + pz * side + uz * along - b.originZ;
    const position = SEED + seed++;
    out.flats.push({
      block: m.block, archive, record, x, y: m.y, z, action: null, position, flatPosition: position,
      npc: !!person, role: person?.role ?? null, factionID: person ? UNDERCROFT_FACTION : 0, flags: person?.female ? 32 : 0,
      rawX: Math.round(x / 0.025), rawY: Math.round(-m.y / 0.025), rawZ: Math.round(z / 0.025),
    });
  };
  let i = 0;
  // the training pit: its master, its dummy
  const pit = order[i++];
  flat(pit, PIT_MASTER.archive, PIT_MASTER.record, { person: PIT_MASTER });
  flat(pit, PIT_DUMMY[0], PIT_DUMMY[1], { side: 1.8 });
  flat(pit, HALL_BRAZIER[0], HALL_BRAZIER[1], { side: -2.2 });
  out.pit = [pit.x, pit.y, pit.z];
  { const hx = s.x - pit.x, hz = s.z - pit.z, hl = Math.hypot(hx, hz) || 1; out.pitAxis = [hx / hl, hz / hl]; }   // the way back to the stair: the pit's passage
  const lit = (m, range = HALL_LIGHT_M) => out.lights.push({ x: m.x, y: m.y + 1.2, z: m.z, range });
  lit(pit);
  // the Hall of Champions: its keeper, its trophies in a row beside her
  if (i < order.length) {
    const hall = order[i++];
    flat(hall, HALL_KEEPER.archive, HALL_KEEPER.record, { person: HALL_KEEPER });
    HALL_TROPHIES.forEach(([a, r], t) => flat(hall, a, r, { side: (t % 2 ? -1 : 1) * (1.1 + 0.45 * Math.floor(t / 2)), along: -0.3 }));
    flat(hall, HALL_BRAZIER[0], HALL_BRAZIER[1], { along: 1.6 });
    out.hall = [hall.x, hall.y, hall.z];
    lit(hall);
  }
  for (const p of UNDERCROFT_PEOPLE) { if (i >= order.length) break; const m = order[i++]; flat(m, p.archive, p.record, { person: p }); lit(m, HALL_LIGHT_M * 0.7); }
  for (const mobileType of UNDERCROFT_BEASTS) {
    if (i >= order.length) break;
    const m = order[i++];
    out.beasts.push({ x: m.x, y: m.y, z: m.z, mobileType });
    flat(m, BEAST_CHAIN[0], BEAST_CHAIN[1], { side: 1.2 });
    flat(m, BEAST_CHAIN[0], BEAST_CHAIN[1], { side: -1.2 });
  }
  out.quiet = order.length - i;
  return out;
}

/** A beast's chain: the bout team's tag no other body carries, always held - it targets nobody, nobody targets it; the
 *  yield floor holds it at 1 if struck. `say` the keepers' warning. */
export function chainTag(n, say = null) {
  return { id: `undercroft:chain:${n}`, side: 0, out: false, hold: true, chained: true, hooks: { hurt: () => {}, floor: () => {}, intrude: () => say?.() } };
}
