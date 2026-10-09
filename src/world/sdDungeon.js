// @ts-check
// SD4a (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 5): THE SUPER DUNGEON'S
// DIFFICULTY - the port's hardest. A Hollow is a Super dungeon by its location's word (`superTier`, read by the one law,
// systems/dungeonTier.js), and the dungeon host (scenes/dungeonContext.js) reads these where it reads the Elite's
// (world/spawnedDungeons.js ELITE_*):
//
//   |                        | Regular      | Elite        | Super                                                  |
//   | foes per enemy marker  | 1            | 3            | 3 - the Elite's own expansion (characters/              |
//   |                        |              |              | dungeonEnemies.js expandEliteEnemies), its 64 KiB frame |
//   |                        |              |              | proven at 151 markers - the largest spawn template; a   |
//   |                        |              |              | Hollow's own templates measured against it (AUDIT SD II |
//   |                        |              |              | L8 D1, test/sd11f_scenes.test.js, over the real data)  |
//   | foe health / damage    | x1 / x1      | x2 / x2      | x4 / x2.5                                              |
//   | foe level band         | the player's | the player's | at least SUPER_FOE_LEVEL_MIN - the tables' top band     |
//   | elite foes             | 1 at 20%     | 3-4          | 6 (systems/eliteFoes.js)                               |
//   | loot                   | -            | +20%         | +50% drop and quality, bodies and piles                |
//   | the dungeon's fires    | all          | half         | none - the Hour is cold (world/dungeonFires.js)        |
//
// THE LEVEL BAND: ChooseRandomEnemyType (characters/dungeonEnemies.js) draws from an encounter table's last six rows at
// any level past 18 on both its arms - and the alternate arm's power is full at 20 - so 24 is the top band whatever the
// dice say: Daedra, liches, ancient vampires. A class foe stands at the band's level too (its career's health and skills
// are its level's). The player's own level is never moved: the loot tables still read it.
//
// Online only, as the Hollow is. Not a DFU member. Ledger A (SUPER-DUNGEONS).

import { sdPhase, SD_NO_RIFT, SD_NO_CLOSED, SD_NO_FALLEN, SD_COLLAPSE_MS } from '../net/sdLaw.js';
import { timerText } from '../systems/eventTimers.js';
import { RDB_SIDE } from './rdbLayout.js';   // SD-REACH: a dungeon block's side - which block's square holds a marker
import { riftCentreY } from './sdRiftModel.js';   // AUDIT SD IV (F36): the ring's centre as it stands - it hovers
import { GLOBAL_SCALE } from './meshReader.js';   // AUDIT SD IV (F38): a block's water level, in metres

/** Health and damage multipliers for a Super dungeon's foes (the Elite's x2 and x2). */
export const SUPER_HEALTH_SCALE = 4;
export const SUPER_DAMAGE_SCALE = 2.5;
/** The least level a Super dungeon's foes are rolled and built at. */
export const SUPER_FOE_LEVEL_MIN = 24;
/** How many elite foes a Super dungeon holds (an Elite one 3 or 4) - fewer only if it has fewer foes. */
export const SUPER_ELITE_FOES = 6;
/** Loot in a Super dungeon: item drop chance x1.5, rarity odds x1.5 (the Elite's x1.2) - bodies and treasure piles. */
export const SUPER_LOOT_DROP_MULT = 1.5;
export const SUPER_LOOT_QUALITY_MULT = 1.5;

/** The level a Super dungeon's foes are rolled and built at: the player's, never under SUPER_FOE_LEVEL_MIN. */
export const superFoeLevel = (level) => Math.max(SUPER_FOE_LEVEL_MIN, Number.isFinite(level) ? Math.floor(level) : 0);

/**
 * A foe built from a Super dungeon's record: x4 health, x2.5 damage (combat/formulas.js calculateAttackDamage reads
 * `damageScale` at its tail, so every blow door is covered, as the Elite's) - and the Elite Dungeon's mark besides, so
 * its poise (ai/tells.js poiseSpecial) and its body's loot cap (systems/foeLootCap.js) are an Elite dungeon's at the
 * least. Answers the entity.
 * @template {object | null | undefined} T
 * @param {T} entity
 * @returns {T}
 */
export function scaleSuperFoe(entity) {
  if (!entity) return entity;
  const e = /** @type {any} */ (entity);
  e.maxHealth = Math.max(1, Math.round((e.maxHealth || 1) * SUPER_HEALTH_SCALE));
  e.health = e.maxHealth;
  e.healthMult = (e.healthMult ?? 1) * SUPER_HEALTH_SCALE;   // TELL1: what was stood on the kind's own health (its poise)
  e.damageScale = SUPER_DAMAGE_SCALE;
  e.elite = true;
  return entity;
}

/** A Super dungeon's loot for a foe's body (hostCombat.spawnEnemyLoot's options) - the Elite's shape, at +50%. */
export const SUPER_LOOT_OPTS = Object.freeze({ lootDropMult: SUPER_LOOT_DROP_MULT, lootQualityMult: SUPER_LOOT_QUALITY_MULT });

// ── SD4b: THE END, THE RIFT AND THE RETURN (section 6) ─────────────────────────────────────────────────────────────
//
// THE END is the dungeon's enemy or start marker farthest from its entrance (world/dungeonEnd.js dungeonEndOf, RVN7d's
// lair law), on the floor the collider finds under it - the same on every client. THE RIFT stands there: a ring of brass
// light about a black-gold membrane, SD_RIFT_SIZE_M across at most - as wide and as tall as its hall lets it stand
// (`sdRiftPlace`, which looks a step or two about the end for the widest hall), never under SD_RIFT_MIN_M. THE RETURN
// stands beside it, a small portal of pale light, until the boss falls (`sdReturnStands`); it carries the player back
// to the dungeon's entrance, the start marker. Pressing either, or walking into it, takes it. The Rift asks its own word
// first (`sdRiftWord`): the realm's room admits a newcomer while the Hollow is found, and one who entered before until
// it is gone (the relay's _sdAdmit, SD3) - the client's own Rift says the same refusals before it asks, in words an old
// client already understands.

/** The Rift's ring across (m) at its most, the least it is drawn in a low or narrow hall, and the air it keeps from the
 *  hall's ceiling and walls. */
export const SD_RIFT_SIZE_M = 7;
export const SD_RIFT_MIN_M = 2.6;
export const SD_RIFT_AIR_M = 0.3;
/** How far the place's rays reach (m), and how far about the end it looks for a wider hall (m, then twice it). */
export const SD_RIFT_PROBE_M = 12;
export const SD_RIFT_SHIFT_M = 1.5;
/** Chest height (m) - the walls are asked there, so a step or a floor seam is never a wall. A step (m): a spot on
 *  another floor than the end's is not the end's hall. */
export const SD_CHEST_M = 1.2;
export const SD_STEP_M = 0.6;
/** How near its axis a body steps into the Rift (m); the Return's, and its size (m). */
export const SD_RIFT_REACH_M = 1.2;
export const SD_RETURN_REACH_M = 0.7;
export const SD_RETURN_SIZE = Object.freeze({ w: 1.3, h: 2.3 });
/** How far past the Rift's rim the Return stands (m). */
export const SD_RETURN_GAP_M = 1.2;
/** The plaque's words (World Tooltips' title and its row). */
export const SD_END_TEXT = Object.freeze({ rift: 'The Rift', riftTo: 'To the Shattered Hour', ret: 'The Return', retTo: 'To the way in' });
/** AUDIT SD IV (F2): no Mark in a Hollow - a place that ends, as the court and the Hour are: a later Hollow may stand on
 *  its pixel in another layout, and a dungeon anchor knows its dungeon by the pixel alone. */
export const SD_NO_MARK = 'You cannot set a Mark in an Abyss Dungeon.';

/** SD-REACH: a border block - the caps DFU closes a dungeon's layout with - by its name, GetRandomBlock's own test
 *  (world/smallerDungeons.js getRandomBlock). */
export const SD_BORDER_BLOCK_RE = /^b/i;

/**
 * The end's candidates, in the dungeon's frame ({ x, y, z }): the layout's enemy markers, each once (a list's Elite
 * copies left out). SD-REACH (2026-10-08, the Discord, of a Rift: "In a place with absolutely no connection to the other
 * blocks... was this done on purpose?"): NEVER A BLOCK'S START MARKERS - DFU reads them off the starting block alone
 * (FindMarkers), and a block's first carries its water level and castle flag (SetRDBResourceData), set down wherever its
 * maker put the data, pockets no walk reaches among them - and AN INTERIOR BLOCK'S FIRST: a border block (its name
 * begins B) is a cap DFU closes the layout with, and the caps ring it, so the point farthest from the way in all but
 * always stood in one. A marker is a block's whose square (its origin, RDB_SIDE a side) holds it. With no interior
 * enemy marker, every enemy marker; with no enemy marker at all, every block's start markers, as SD4b had it - a Rift
 * somewhere, never none. AUDIT SD IV (F38): OUT OF THE WATER where any is - a candidate whose foot (`floorOf`, the floor
 * the collider finds under it; its own height without one) stands under its block's water (the layout's own level,
 * never a runtime override - every client the same; DFU's no-water 10000 stands 250 m under every floor, as its own
 * UpdateFog reads it) is taken only when none of its kind is dry: a flooded block's
 * marker stood the Rift, the Return and the way back from the Hour at the bottom of the water.
 * @param {Array<{ x: number, y: number, z: number, eliteCopy?: boolean }> | null | undefined} enemies
 * @param {Array<{ name?: string, originX?: number, originZ?: number, layout?: { startMarkers?: Array<{ x: number, y: number, z: number }>, waterLevel?: number } }> | null | undefined} blocks
 * @param {((m: { x: number, y: number, z: number }) => number) | null} [floorOf]
 */
export function sdEndMarks(enemies, blocks, floorOf = null) {
  const marks = [];
  for (const e of enemies ?? []) if (e && !e.eliteCopy && Number.isFinite(e.x) && Number.isFinite(e.z)) marks.push({ x: e.x, y: e.y, z: e.z });
  const blockOf = (m) => (blocks ?? []).find((b) => {
    const ox = b?.originX ?? 0, oz = b?.originZ ?? 0;
    return m.x >= ox && m.x < ox + RDB_SIDE && m.z >= oz && m.z < oz + RDB_SIDE;
  });
  const wet = (m) => { const level = blockOf(m)?.layout?.waterLevel; return level != null && (floorOf ? floorOf(m) : m.y) < -level * GLOBAL_SCALE; };
  const dryFirst = (list) => { const dry = list.filter((m) => !wet(m)); return dry.length ? dry : list; };
  const inner = marks.filter((m) => !SD_BORDER_BLOCK_RE.test(blockOf(m)?.name ?? ''));
  if (inner.length) return dryFirst(inner);
  if (marks.length) return dryFirst(marks);
  const out = [];
  for (const b of blocks ?? []) {
    for (const m of b?.layout?.startMarkers ?? []) {
      if (Number.isFinite(m?.x) && Number.isFinite(m?.z)) out.push({ x: m.x + (b.originX ?? 0), y: m.y, z: m.z + (b.originZ ?? 0) });
    }
  }
  return dryFirst(out);
}

/** The ring's size in a hall `headroom` metres high (floor to ceiling) whose nearest wall is `clear` metres off its axis:
 *  SD_RIFT_SIZE_M at most, the hall's own less its air, never under SD_RIFT_MIN_M. An unmeasured side asks nothing.
 *  AUDIT SD IV (F36): its top over its foot is SD_RIFT_TOP of its size - it hovers a hand's breadth off the floor - so
 *  the hall's height less its air is its top's, not its size. */
export const SD_RIFT_TOP = riftCentreY(1) + 0.5;
export function sdRiftFit(headroom, clear) {
  const h = Number.isFinite(headroom) ? (headroom - SD_RIFT_AIR_M) / SD_RIFT_TOP : SD_RIFT_SIZE_M;
  const w = Number.isFinite(clear) ? 2 * (clear - SD_RIFT_AIR_M) : SD_RIFT_SIZE_M;
  return Math.max(SD_RIFT_MIN_M, Math.min(SD_RIFT_SIZE_M, h, w));
}

const BEARINGS = Object.freeze(Array.from({ length: 8 }, (_, k) => Object.freeze([Math.cos((k * Math.PI) / 4), 0, Math.sin((k * Math.PI) / 4)])));

/**
 * @typedef {{ floor: (at: number[]) => (number | null), ray: (from: number[], dir: number[], max: number) => (number | null) }} SdProbe
 *   the collider's answers: `floor` the floor's height under a point (null: none near), `ray` the clear distance along a
 *   unit direction (null: nothing within `max`)
 */

/** The ring a spot's hall stands (sdRiftFit over the ceiling's ray and the eight walls' at chest height). */
function fitAt(at, probe) {
  const up = probe.ray([at[0], at[1] + 0.1, at[2]], [0, 1, 0], SD_RIFT_PROBE_M);
  let clear = Infinity;
  for (const dir of BEARINGS) {
    const d = probe.ray([at[0], at[1] + SD_CHEST_M, at[2]], dir, SD_RIFT_PROBE_M);
    if (d != null) clear = Math.min(clear, d);
  }
  return sdRiftFit(up == null ? Infinity : up + 0.1, clear);
}

/** A spot `r` metres along `dir` from `from` on its own floor - a clear line at chest height to it and a floor within a
 *  step of `from`'s - or null. AUDIT SD IV (F34): `lower`, or on any floor the probe finds below that (a dais's foot,
 *  down a stair or a ramp). */
function besideOn(from, dir, r, probe, lower = false) {
  if (probe.ray([from[0], from[1] + SD_CHEST_M, from[2]], dir, r + SD_RIFT_AIR_M) != null) return null;
  const x = from[0] + dir[0] * r, z = from[2] + dir[2] * r;
  const y = probe.floor([x, from[1], z]);
  return y != null && (lower ? y - from[1] : Math.abs(y - from[1])) <= SD_STEP_M ? [x, y, z] : null;
}

/**
 * THE RIFT'S PLACE: about the end's `foot` ([x, y, z], the floor under the end's marker), the spot whose hall stands the
 * widest ring - the end itself, then eight bearings at SD_RIFT_SHIFT_M and at twice it, on the end's own floor (the first
 * of a tie, so every client stands the same). Answers { at: the ring's foot, size, face }. AUDIT SD IV (F36): each
 * spot's ring is its hall's measure swept by the disc it stands as (`sdRiftSweep`, in its face's plane) - a spot whose
 * measure cannot beat the best is never asked further.
 * @param {number[]} foot
 * @param {SdProbe} probe
 */
export function sdRiftPlace(foot, probe) {
  let best = ringAt([foot[0], foot[1], foot[2]], probe, -Infinity);
  for (const r of [SD_RIFT_SHIFT_M, 2 * SD_RIFT_SHIFT_M]) {
    for (const dir of BEARINGS) {
      if (best.size >= SD_RIFT_SIZE_M) return best;
      const at = besideOn(foot, dir, r, probe);
      if (!at) continue;
      const ring = ringAt(at, probe, best.size);
      if (ring && ring.size > best.size) best = ring;
    }
  }
  return best;
}
/** A spot's ring - its hall's measure (fitAt), its face, its disc swept clear - or null when the measure cannot beat
 *  `floor` (the sweep only ever shrinks it). */
function ringAt(at, probe, floor) {
  const fit = fitAt(at, probe);
  if (fit <= floor) return null;
  const face = sdRiftFace(at, fit, probe);
  return { at, size: sdRiftSweep(at, fit, face, probe), face };
}

/** AUDIT SD IV (F36): the directions the disc is asked along from its centre, in its plane - across and up between, the
 *  upper half alone (below its centre a step or a floor seam is never a wall: its foot stands on the floor), never
 *  straight up (the hall's measure asks the ceiling over its axis - fitAt). */
const SD_DISC_ANGLES = Object.freeze([0, 1, 2, 3, 5, 6, 7, 8].map((k) => (k * Math.PI) / 8));
/** Whether the ring's disc at `size` stands clear in its face's plane: from its centre (world/sdRiftModel.js
 *  riftCentreY - it hovers), each direction reaching its rim and its air. */
function discClear(at, size, face, probe) {
  const R = size / 2, c = [at[0], at[1] + riftCentreY(size), at[2]];
  for (const a of SD_DISC_ANGLES) {
    const across = Math.cos(a), dir = [-face[2] * across, Math.sin(a), face[0] * across];
    if (probe.ray(c, dir, R + SD_RIFT_AIR_M) != null) return false;
  }
  return true;
}
/**
 * AUDIT SD IV (F36): THE RING SWEPT - the largest size up to `size` whose disc stands clear in its face's plane
 * (`discClear`), found by halving - never under SD_RIFT_MIN_M, as the measure never is. The hall's measure (fitAt) asks the ceiling straight up from the
 * foot and the walls at chest height: a ceiling beside the axis (a raised bay, a shaft over the end), a beam across the
 * ring's plane, and the ring's own hover went unseen, and a 7 m ring stood through a 5 m ceiling. Pure: the law's rays,
 * the law's order - every client the same.
 * @param {number[]} at
 * @param {number} size
 * @param {number[]} face
 * @param {SdProbe} probe
 */
export function sdRiftSweep(at, size, face, probe) {
  if (discClear(at, size, face, probe)) return size;
  let lo = SD_RIFT_MIN_M, hi = size;
  for (let k = 0; k < SD_SWEEP_HALVINGS; k++) {
    const mid = (lo + hi) / 2;
    if (discClear(at, mid, face, probe)) lo = mid; else hi = mid;
  }
  return lo;
}
/** How many halvings the sweep takes - 4.4 m to under 2 cm. */
export const SD_SWEEP_HALVINGS = 8;

/**
 * SD-LOOK (2026-10-08, bible/11-Multiplayer/Super-Dungeons-Look.md section 1): THE RIFT'S FACE - square to its hall's
 * long line, so the walk down the hall meets it face on. Of the four opposite pairs of the eight chest-height bearings,
 * the one whose two rays reach farthest together (each asked to SD_RIFT_FACE_M, a miss counted that) is the hall's long
 * line - the first of a tie - and its face lies along it; unless a ray along the ring's own plane, at half its height, falls short of half
 * its size and its air (a pillar the chest rays did not see), when the next pair is taken. Answers the face's direction
 * [x, 0, z] - the same on every client (the law's rays, the law's order). The walk-in does not move (inSdPortal's
 * cylinder is round); the press turns with it (scenes/sdEnd.js riftPress - AUDIT SD IV F33).
 * @param {number[]} at
 * @param {number} size
 * @param {SdProbe} probe
 */
export const SD_RIFT_FACE_M = 2 * SD_RIFT_PROBE_M;   // a hall's long line is asked farther than its walls are: past 12 m every long hall's diagonals tie
export function sdRiftFace(at, size, probe) {
  const reach = BEARINGS.map((dir) => probe.ray([at[0], at[1] + SD_CHEST_M, at[2]], dir, SD_RIFT_FACE_M) ?? SD_RIFT_FACE_M);
  const pairs = [0, 1, 2, 3].sort((a, b) => (reach[b] + reach[b + 4]) - (reach[a] + reach[a + 4]) || a - b);
  for (const k of pairs) {
    const along = BEARINGS[(k + 2) % 8], back = BEARINGS[(k + 6) % 8], half = [at[0], at[1] + size / 2, at[2]];
    const room = Math.min(probe.ray(half, along, size) ?? Infinity, probe.ray(half, back, size) ?? Infinity);
    if (room >= size / 2 + SD_RIFT_AIR_M) return [...BEARINGS[k]];
  }
  return [...BEARINGS[pairs[0]]];
}

/** SD-LOOK: THE RIFT'S LOOK - what its state shows, read off what the page holds (`sdRiftWord`'s inputs): `state` open,
 *  notyet, collapse, closed or refused; the iris's `aperture` (0 shut .. 1 wide - the state itself); the gear's ticks a
 *  second; `studs` lit (how many hours its Hour stands, all 24 past a day) and `ember` going (one each 7.5 s of the
 *  collapse); the brass's `tone` (gold, ember, cold or red) and its `light` (0..1). Readable from 30 m, no plaque. */
export const SD_RIFT_OPEN_LOOK = Object.freeze({ state: 'open', aperture: 1, tickHz: 1, studs: 24, ember: 0, tone: 'gold', light: 1 });
export const SD_RIFT_NOT_YET = Object.freeze({ state: 'notyet', aperture: 0.07, tickHz: 0, studs: 0, ember: 0, tone: 'gold', light: 0.3 });
export const SD_RIFT_CLOSED = Object.freeze({ state: 'closed', aperture: 0, tickHz: 0, studs: 0, ember: 0, tone: 'cold', light: 0 });
export const SD_RIFT_REFUSED = Object.freeze({ state: 'refused', aperture: 0, tickHz: 0, studs: 0, ember: 0, tone: 'red', light: 0.3 });
/**
 * @param {import('../net/sdLaw.js').SdRecord | null | undefined} rec
 * @param {number} s the Hollow's slot
 * @param {number} now
 */
export function riftLook(rec, s, now, { entered = false, fallen = false } = {}) {
  if (!rec) return SD_RIFT_NOT_YET;   // the hub's record not heard: not yet
  if (rec.s !== s) return SD_RIFT_CLOSED;
  if (fallen) return SD_RIFT_REFUSED;
  const ph = sdPhase(rec, now);
  if (ph === 'found') return { ...SD_RIFT_OPEN_LOOK, studs: Math.max(1, Math.min(24, Math.ceil((rec.until - now) / 3600000))) };
  if (ph === 'risen') return SD_RIFT_NOT_YET;
  if (ph === 'fell') {
    const left = Math.max(0, Math.min(1, (rec.fellAt + SD_COLLAPSE_MS - now) / SD_COLLAPSE_MS)), lit = Math.ceil(left * 24);
    return { state: 'collapse', aperture: entered ? 1 / 3 + (2 / 3) * left : 0, tickHz: 2, studs: lit, ember: 24 - lit, tone: entered ? 'gold' : 'ember', light: entered ? 0.5 + 0.5 * left : 0.3 };
  }
  return SD_RIFT_CLOSED;
}

/**
 * THE RETURN'S PLACE: beside the Rift - SD_RETURN_GAP_M past its rim on the first bearing (east, then round) whose line
 * is clear and whose floor is the ring's own; else a metre and a half out on the first such bearing; else the same onto
 * a lower floor (AUDIT SD IV F34 - a dais's foot, down a stair or a ramp: on the ring's own foot the Return stood inside
 * its walk-in, a walk to it crossed the Rift's, and a small ring's walk-in was always the Return's); else, boxed in, on
 * the ring's own foot. Answers its foot [x, y, z].
 * @param {{ at: number[], size: number }} rift
 * @param {SdProbe} probe
 */
export function sdReturnPlace(rift, probe) {
  for (const lower of [false, true]) {
    for (const r of [rift.size / 2 + SD_RETURN_GAP_M, 1.5]) {
      for (const dir of BEARINGS) {
        const at = besideOn(rift.at, dir, r, probe, lower);
        if (at) return at;
      }
    }
  }
  return [rift.at[0], rift.at[1], rift.at[2]];
}

/** AUDIT SD II (L6 F18): WHERE ONE BACK FROM THE HOUR IS STOOD - past the Return, never on its foot (one step off it and
 *  back carried them straight to the way in): SD_LANDING_PAST_M on along the line from the Rift's foot through the
 *  Return's, else on the first bearing from the Return that leads away from the Rift with a clear line and the Return's
 *  own floor, else - AUDIT SD IV (F35) - the first spot on the Return's floor clear of both portals' reach by
 *  SD_LANDING_CLEAR_M (SD_LANDING_PAST_M from it on each bearing, then just past its reach): a Return stood on a corner's
 *  diagonal had no bearing that led away, and the way back stood on its foot in plain rooms; else, boxed in, the
 *  Return's foot. */
export const SD_LANDING_PAST_M = 1.5;
/** AUDIT SD IV (F35): how far outside either portal's reach the landing stands (m) - more than a body's breadth
 *  (player/motor.js CAPSULE_RADIUS). */
export const SD_LANDING_CLEAR_M = 0.4;
export function sdLandingPlace(rift, ret, probe) {
  const dx = ret[0] - rift.at[0], dz = ret[2] - rift.at[2], len = Math.hypot(dx, dz);
  if (len > 1e-6) { const at = besideOn(ret, [dx / len, 0, dz / len], SD_LANDING_PAST_M, probe); if (at) return at; }
  for (const dir of BEARINGS) {
    const at = besideOn(ret, dir, SD_LANDING_PAST_M, probe);
    if (at && Math.hypot(at[0] - rift.at[0], at[2] - rift.at[2]) > len) return at;
  }
  const riftClear = Math.min(SD_RIFT_REACH_M, rift.size / 4) + SD_LANDING_CLEAR_M;
  for (const r of [SD_LANDING_PAST_M, SD_RETURN_REACH_M + SD_LANDING_CLEAR_M]) {
    for (const dir of BEARINGS) {
      const at = besideOn(ret, dir, r, probe);
      if (at && Math.hypot(at[0] - rift.at[0], at[2] - rift.at[2]) >= riftClear) return at;
    }
  }
  return [ret[0], ret[1], ret[2]];
}

/** AUDIT SD II (L6 F17): where the device keeps the slots whose Hour this player went through (the Rift's `entered`), and
 *  how many it keeps - a reload no longer forgets them. */
export const SD_ENTERED_KEY = 'sd11.entered';
export const SD_ENTERED_MAX = 8;
/** SD-ONELIFE: where the device keeps the slots whose Hour this player died in - its Rift refuses them for good. */
export const SD_FALLEN_KEY = 'sd12.fallen';
/**
 * The Rift's own word before it asks (section 6): null - step through; else its refusal. Not yet found, or the hub's
 * record not heard: "The Rift will not take you yet." The Hour closed - the slot gone or another's - or closing to a
 * newcomer after its boss fell: "The Hour has closed." `entered`: this player went through before (the realm's room
 * keeps them until it is gone). `fallen`: this player died in its Hour - one life a Hollow (SD-ONELIFE): "The Hour will not
 * take you back."
 * @param {import('../net/sdLaw.js').SdRecord | null | undefined} rec
 * @param {number} s the Hollow's slot
 * @param {number} now
 */
export function sdRiftWord(rec, s, now, { entered = false, fallen = false } = {}) {
  if (!rec) return SD_NO_RIFT;
  if (rec.s !== s) return SD_NO_CLOSED;
  if (fallen) return SD_NO_FALLEN;
  const ph = sdPhase(rec, now);
  if (ph === 'found' || (ph === 'fell' && entered)) return null;
  return ph === 'risen' ? SD_NO_RIFT : SD_NO_CLOSED;
}

/** AUDIT SD II (L6 F5): the Rift plaque's count words. */
export const SD_COUNT_TEXT = Object.freeze({
  fades: (t) => `Fades in ${t}`,
  collapses: (t) => `Collapses in ${t}`,
});
/**
 * AUDIT SD II (L6 F5): THE RIFT'S COUNT - its plaque's second row, how long its Hour stands: in its collapse
 * *"Collapses in 2:31"*; found or risen, *"Fades in 1d 22h"*, *"Fades in 3:00:00"*, *"Fades in 12:04"*. A Hollow unbeaten
 * closed on everyone in it with no count anywhere inside. AUDIT SD III (T6): in the one clock the game counts its events
 * in (systems/eventTimers.js timerText - its ring, its banner, its note and the Timers window say *"fades in 1d 22h"*;
 * this plaque alone said *"46h 12m"*). Null with no record, another slot's, or one gone.
 * @param {import('../net/sdLaw.js').SdRecord | null | undefined} rec
 * @param {number} s the Hollow's slot
 * @param {number} now
 */
export function sdRiftCount(rec, s, now) {
  if (!rec || rec.s !== s) return null;
  const ph = sdPhase(rec, now);
  if (ph === 'fell') return SD_COUNT_TEXT.collapses(timerText(rec.fellAt + SD_COLLAPSE_MS - now));
  if (ph !== 'risen' && ph !== 'found') return null;
  return SD_COUNT_TEXT.fades(timerText(rec.until - now));
}

/** The Return stands until the boss falls: while its slot's record is risen or found - and while no record has been
 *  heard (nothing says it fell). */
export function sdReturnStands(rec, s, now) {
  if (!rec) return true;
  if (rec.s !== s) return false;
  const ph = sdPhase(rec, now);
  return ph === 'risen' || ph === 'found';
}

/** Whether `feet` stand in a portal whose foot is `at`: within `reach` of its axis across the floor, between its foot
 *  (less a step) and its top. */
export function inSdPortal(feet, at, reach, height) {
  if (!feet || !at) return false;
  // AUDIT SD II (L2 F9): the reach by its square - Math.hypot made a list of its numbers on every frame's ask
  const dx = feet[0] - at[0], dz = feet[2] - at[2];
  return dx * dx + dz * dz <= reach * reach && feet[1] >= at[1] - SD_STEP_M && feet[1] <= at[1] + height;
}
