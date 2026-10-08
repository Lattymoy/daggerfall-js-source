// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LW8 (2026-10-05, bible/06-Systems/Living-World.md "LW8"): THE DOORS OPEN - the living world's residents inside the
// building the player is in. Mac: NPCs "dynamically all have tasks ... perform activities". LW2 stood a resident's day
// in the street and shut the door behind them; this stands what is behind the door.
//
// WHO. The town's own word (livingTown.js insideAt): each resident whose day has them in this building at the clock's
// minute - the evening's drinkers at the tavern, the errand's customers at a shop, the faithful at the temple, members
// at the guild hall, a household at home awake - read again each INDOOR_TICK_S; never the asleep, and never the
// building's own staff at their work where it is no house (DFU's static people stand for them, as they always have).
// WHERE. A room has no grid to walk; it is SOUNDED once from its way in (`origin`, AUDIT-E4: the first door's) - LW-ROOMS:
// its floor walked out cell by cell on a lattice of INDOOR_APART_M through the room's own collider (`move` - never through
// a wall, a counter or a table), each step onto a floor (`floorAt`) level with the last, every cell a place kept from the
// building's static people and from the ways in - and each resident given one, in the order of their ids over an order
// the building's key deals (those in the room on the way in stand alike for every reader). They stand facing into the
// room, in their own clothes (indoors no one is armed), to INDOOR_MAX - LW-ROOMS: and to what its floor holds.
// COMING AND GOING. One whose day takes them in comes on, one whose day takes them out goes - where the player is not
// looking, or at once on the way in (the room as the day has it, LW2's arrival law).
// TALK. Each is a talk target in the street's own shape ({ person, pos }), so the street's own talk ray takes them
// (townTalk.tryActivate through the host's press hook) - and their regard hears it as the street's does (the host's
// door: a refusal, a word, a tone); a hand caught in a purse here is seen by those in the room (`caught`).
//
// EVERY ALLOCATION HAS AN OWNER: each body is the sprites' (travellerSprites.js), synced each frame from this list;
// `clear()` frees them all - the building left, the living world off, the host's teardown.
//
// LW8b (2026-10-05, "LW8b"): THE ROOM'S TALK. Mac: NPCs "have conversations with each other ... much like the crew on
// board ships". The room's spots are grouped into TABLES (`tablesOf`: near enough to stand together), and the room fills
// table by table, so those inside stand in twos and threes, facing one another (one alone faces the room). Each round
// (the street's: meetups.js ROUND_S) those at a table its whole round meet as the street's circles do (`spotCircles`
// on the table's own key) - the street's share of them talking, the street's beat, the street's words and the room's
// own (lines.js ROOM_TALKS by the building's kind: the tavern's, the temple's, a shop's, the guild hall's, the
// palace's, a home's), the town's news among them. A resident not in a circle has the street's word for the player
// passing close (livingTown.js greetingFor). What is said (`speech`) goes over their heads on the crew's one layer.
//
// LW8c (2026-10-05, "LW8c"): THE ROOM ASTIR. Mac: NPCs "perform activities". One in no talking circle now and then
// (INDOOR_STIR_S of real seconds, their own) gets up and crosses the room - to a table where one stands alone, for the
// company, else to a free place of the room's - within INDOOR_WALK_M, along a line the room's own collider lets them
// walk (never through a wall or a table), at INDOOR_WALK_SPEED, facing the way they go; the place they make for is
// theirs from the moment they set out. Between tables they are at none (no circle, no table to face).
//
// LW-LODGE (2026-10-06, Mac: NPCs should "use tavern rooms"; "Lodgers in their rooms"): A LODGER HAS A ROOM - one who
// lodges at a tavern (livingTown.js lodgersAt: a visitor, a ship's hand ashore, one of the town whose home is its rooms)
// is dealt one of its beds (`bedsOf`: their id and the tavern's draw it, never the bed of the room the player rents), and
// is seen by it (`bedStand`) while their day has them up in it - before breakfast and after it, before bed (dayPlan.js);
// at breakfast and at supper they are in the common room with the rest, asleep in none. A lodger in their room is at no
// table and does not stir.
//
// LW-TALK (2026-10-06): A TABLE'S COMPANY MEETS FROM THE MINUTE IT SAT DOWN AS IT IS - its rounds run from then while it
// stays the same (the first cut dealt the tables on the street's round, so two who met mid-round stood mute to the next,
// and every table in the room spoke on the same second); one who comes while an exchange is on waits for its last line;
// its people stay put while an exchange is on and through their first round together (one in a quiet circle got up
// mid-talk, and a temple's two parted the moment their talk ended); and one who kept quiet as the player came by
// speaks when the player stops before them.
//
// LW-ROOMS (2026-10-08, Mac: "With living world integration, NPCs still group up in taverns"): THE WHOLE ROOM. The first
// cut sounded twelve ways out to 6.6 m from the way in, at its height - the door's middle: a tavern's every drinker stood
// within a few strides of its door, one crowd, and the sounding passed over the tables onto their tops. Now its floor is
// walked wherever it goes on (`soundRoom`), its tables fill apart (`spreadTables`, TABLE_GAP_M), it holds one to every
// INDOOR_FLOOR_M2 of floor, and one who stirs makes for a place of their own (`stirPlace`).
// ═══════════════════════════════════════════════════════════════════
import { WITNESS_M, GREET_RANGE, GREET_REST_MIN, GREET_S, LINE_RANGE } from '../systems/livingWorld/livingTown.js';
import { dealCircles, circleLine, exchangeAt, ROUND_S, GATHER_BEAT_S, SLOT_LINES } from '../systems/livingWorld/meetups.js';
import { PERSON_IDLE_DISTANCE } from '../characters/mobilePerson.js';
import { roomKindOf } from '../systems/livingWorld/lines.js';
import { lwSeed, textSeed } from '../systems/livingWorld/seed.js';
import { townClassOf, stillFlatOf } from '../systems/livingWorld/looks.js';
import { BUILDING_TYPES } from '../world/buildingNames.js';

/** Who is inside is read this often (real seconds). */
export const INDOOR_TICK_S = 1;
/** LW-ROOMS: the room is walked out from its way in on a lattice of INDOOR_APART_M - to INDOOR_REACH_M of it and
 *  INDOOR_CELLS cells at the most (m); a step reaches its cell within INDOOR_ARRIVE_M, onto a floor within INDOOR_LEVEL_M
 *  of the one it left (m). */
export const INDOOR_REACH_M = 20;
export const INDOOR_CELLS = 400;
export const INDOOR_ARRIVE_M = 0.3;
export const INDOOR_LEVEL_M = 0.15;
/** How far apart two spots stand (m), and how far a spot keeps from a static person and from the way in (m). */
export const INDOOR_APART_M = 1.3;
export const INDOOR_CLEAR_M = 1.1;
export const INDOOR_DOOR_M = 1.8;
/** The most residents stood in one room - LW-ROOMS: and on its floor one to every INDOOR_FLOOR_M2 of it (m^2). */
export const INDOOR_MAX = 12;
export const INDOOR_FLOOR_M2 = 8;
/** A coming or a going waits for the player to look away unless it is this far off (m) - indoors, little is. */
export const INDOOR_SEEN_M = 14;
/** LW8b: spots this near one another share a table (m), and the most at one. */
export const TABLE_M = 2.2;
export const TABLE_MAX = 3;
/** LW-ROOMS: how far apart the room's tables are filled, while it has room for it (m, middle to middle). */
export const TABLE_GAP_M = 4;
/** LW-LODGE: how far beside their bed a lodger stands (m, the nearer first) and the ways about it tried. */
export const BED_STEP_M = Object.freeze([0.9, 1.3]);
export const BED_FAN = 8;
/** LW-LODGE: a way off the bed is down by more than BED_LEVEL_M (less is level - the floor the marker stands on), and by
 *  no more than BED_DROP_M (a bed's height - more is a stair, another floor). */
export const BED_LEVEL_M = 0.2;
export const BED_DROP_M = 1;
/** LW8c: how long one stays put before they stir (real seconds, their own between these), how far they cross (m), and
 *  their pace across the room (m a second). */
export const INDOOR_STIR_S = Object.freeze([30, 90]);
export const INDOOR_WALK_M = 7;
export const INDOOR_WALK_SPEED = 1.2;

/**
 * Sound a room: LW-ROOMS - its floor walked out from `origin` (the way in), cell by cell on a lattice of INDOOR_APART_M,
 * each step through the collider (never through a wall, a counter or a table) onto a floor of this room level with the
 * one it left (never up a stair, never onto a table's top), to INDOOR_REACH_M and INDOOR_CELLS cells; every cell walked
 * to a spot, in the order walked to, kept apart from each other, from `keepClear` (feet) and from every way in
 * (`origin`, `waysIn`). Pure over the collider. The first cut walked a fan of twelve ways out to 6.6 m and no farther -
 * a tavern's every drinker within a few strides of its door - at the landing's height, the door's middle: over the
 * tables, and down onto their tops.
 * @param {number[]} origin
 * @param {{ move: (feet: number[], dx: number, dy: number, dz: number, height: number, snap?: boolean, keepFloor?: boolean, noStep?: boolean) => any }} collider -
 *   each step walked as a body that never steps up (the collider's `noStep`: a step up is not this floor)
 * @param {(x: number, y: number, z: number) => (number|null)} floorAt - the floor's height under a point, or null
 * @param {readonly number[][]} [keepClear] @param {readonly number[][]} [waysIn] - AUDIT-E4: the building's other ways in
 * @returns {number[][]}
 */
export function soundRoom(origin, collider, floorAt, keepClear = [], waysIn = []) {
  const far = (p, list, d) => list.every((q) => Math.hypot(p[0] - q[0], p[2] - q[2]) >= d);
  const y0 = floorAt(origin[0], origin[1] + 0.5, origin[2]);
  const start = [origin[0], y0 != null && Number.isFinite(y0) ? y0 : origin[1], origin[2]];   // on the floor under the way in
  /** the cells walked to, in the order walked to: steps from the way in (i, j) and the floor's point there */
  const cells = [{ i: 0, j: 0, p: start }];
  const seen = new Set(['0,0']);
  for (let h = 0; h < cells.length && cells.length < INDOOR_CELLS; h++) {
    const { i, j, p } = cells[h];
    for (const [di, dj] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const ni = i + di, nj = j + dj, key = `${ni},${nj}`;
      if (seen.has(key) || Math.hypot(ni, nj) * INDOOR_APART_M > INDOOR_REACH_M) continue;
      const tx = start[0] + ni * INDOOR_APART_M, tz = start[2] + nj * INDOOR_APART_M;
      const q = [p[0], p[1] + 0.05, p[2]];
      try { collider.move(q, tx - p[0], 0, tz - p[2], 1.8, true, false, true); } catch { continue; }
      if (Math.hypot(q[0] - tx, q[2] - tz) > INDOOR_ARRIVE_M) continue;   // stopped short: a wall, a counter, a table
      const y = floorAt(q[0], q[1] + 0.5, q[2]);
      if (y == null || !Number.isFinite(y) || Math.abs(y - p[1]) > INDOOR_LEVEL_M || Math.abs(y - start[1]) > 1.2) continue;   // this room's floor, level with the last: not a stair's step, a table's top or a hole
      seen.add(key);
      cells.push({ i: ni, j: nj, p: [q[0], y, q[2]] });
      if (cells.length >= INDOOR_CELLS) break;
    }
  }
  const spots = [];
  for (const { p } of cells) {
    if (Math.hypot(p[0] - origin[0], p[2] - origin[2]) < INDOOR_DOOR_M) continue;
    if (!far(p, spots, INDOOR_APART_M - 0.01) || !far(p, keepClear, INDOOR_CLEAR_M) || !far(p, waysIn, INDOOR_DOOR_M)) continue;   // apart to a centimetre: the lattice's own step, as its sums round it
    spots.push(p);
  }
  return spots;
}

/**
 * LW-LODGE: WHERE A LODGER STANDS BY THEIR BED - from the bed (its Rest marker: where the player is laid to sleep, the
 * surface under it its top where the bed is solid), a step out (BED_STEP_M) the nearest of BED_FAN ways the collider lets
 * them walk (never through a wall, never stopped short against one): down off the bed onto the floor where any way comes
 * down (within BED_DROP_M - a bed's height, never a stair's), else at the bed's own height (the marker on the floor); never
 * higher. Facing the bed. The bed's own place where no way serves. Pure over the collider.
 * @param {readonly number[]} bed @param {{ move: (feet: number[], dx: number, dy: number, dz: number, height: number) => any }} collider
 * @param {(x: number, y: number, z: number) => (number|null)} floorAt
 * @returns {{ feet: number[], yaw: number }}
 */
export function bedStand(bed, collider, floorAt) {
  const y0 = floorAt(bed[0], bed[1] + 1, bed[2]);
  const at = [bed[0], y0 ?? bed[1], bed[2]];
  /** @type {{ feet: number[], dy: number }[]} */
  const ways = [];
  for (const dist of BED_STEP_M) {
    for (let i = 0; i < BED_FAN; i++) {
      const a = (i / BED_FAN) * Math.PI * 2;
      const q = [at[0], at[1] + 0.05, at[2]];
      try { collider.move(q, Math.sin(a) * dist, 0, Math.cos(a) * dist, 1.8); } catch { continue; }
      if (Math.hypot(q[0] - at[0], q[2] - at[2]) < dist * 0.75) continue;   // stopped short against a wall
      const y = floorAt(q[0], q[1] + 0.5, q[2]);
      if (y == null || !Number.isFinite(y)) continue;
      const dy = y - at[1];
      if (dy > BED_LEVEL_M || dy < -BED_DROP_M) continue;   // higher, or down a stair
      ways.push({ feet: [q[0], y, q[2]], dy });
    }
  }
  const pick = ways.find((w) => w.dy < -BED_LEVEL_M) ?? ways.find((w) => Math.abs(w.dy) <= BED_LEVEL_M);
  return pick ? { feet: pick.feet, yaw: Math.atan2(at[0] - pick.feet[0], at[2] - pick.feet[2]) } : { feet: at, yaw: 0 };
}

/**
 * LW-LODGE: THE TAVERN'S ROOMS DEALT TO ITS LODGERS - each, in the order of their ids (`ids`, the day's lodgers), the bed
 * their id and the tavern's key draw, or the next free after it; more lodgers than beds, the rest have none (they are in
 * the common room). Every reader's deal alike - but the bed of the room the player rents here (`rented`, its index; -1
 * none) is no lodger's: the one it fell to takes the first bed after it nobody has, else none; the rest keep theirs.
 * @param {readonly string[]} ids @param {number} beds @param {number} key @param {number} [rented]
 * @returns {Map<string, number>}
 */
export function bedsOf(ids, beds, key, rented = -1) {
  /** @type {Map<string, number>} */
  const out = new Map();
  const taken = new Set();
  for (const id of ids) {
    if (taken.size >= beds) break;
    let i = lwSeed(textSeed(id), key >>> 0, 0x626564) % beds;   // 'bed'
    while (taken.has(i)) i = (i + 1) % beds;
    taken.add(i);
    out.set(id, i);
  }
  const who = rented >= 0 ? [...out].find(([, b]) => b === rented)?.[0] : undefined;
  if (who != null) {
    out.delete(who);
    for (let k = 1; k < beds; k++) { const i = (rented + k) % beds; if (!taken.has(i)) { out.set(who, i); break; } }
  }
  return out;
}

/**
 * LW8b: THE ROOM'S TABLES - its spots grouped where people stand together. In the building's deal (`order`), each spot
 * not yet at a table opens one and takes the nearest of the rest within TABLE_M of every one already at it, to
 * TABLE_MAX. Pure over the spots and the deal.
 * @param {readonly number[][]} spots @param {readonly number[]} order
 * @returns {number[][]} - each table's spots, the opener first
 */
export function tablesOf(spots, order) {
  const at = new Int32Array(spots.length).fill(-1);
  /** @type {number[][]} */
  const tables = [];
  const apart = (/** @type {number} */ i, /** @type {number} */ j) => Math.hypot(spots[i][0] - spots[j][0], spots[i][2] - spots[j][2]);
  for (const i of order) {
    if (at[i] >= 0) continue;
    const table = [i];
    at[i] = tables.length;
    const near = order.filter((j) => at[j] < 0 && apart(i, j) <= TABLE_M).sort((a, b) => apart(i, a) - apart(i, b) || a - b);
    for (const j of near) {
      if (table.length >= TABLE_MAX) break;
      if (!table.every((k) => apart(j, k) <= TABLE_M)) continue;
      table.push(j);
      at[j] = tables.length;
    }
    tables.push(table);
  }
  return tables;
}

/**
 * LW-ROOMS: THE ORDER THE ROOM FILLS ITS TABLES - the building's deal (`tables`, tablesOf's), but each next the first of
 * it whose middle stands TABLE_GAP_M from every table's before it, while any does; then the rest, in the deal's order.
 * So the room fills apart, all over it - the first cut filled the deal's tables as they came, and two of them side by
 * side stood as one crowd. Pure over the spots and the deal.
 * @param {readonly number[][]} spots @param {readonly number[][]} tables @returns {number[][]}
 */
export function spreadTables(spots, tables) {
  const left = tables.map((tb) => ({ tb, x: tb.reduce((s, i) => s + spots[i][0], 0) / tb.length, z: tb.reduce((s, i) => s + spots[i][2], 0) / tb.length }));
  /** @type {typeof left} */
  const out = [];
  for (;;) {
    const k = left.findIndex((a) => out.every((b) => Math.hypot(a.x - b.x, a.z - b.z) >= TABLE_GAP_M));
    if (k < 0) break;
    out.push(...left.splice(k, 1));
  }
  return [...out, ...left].map((a) => a.tb);
}

/**
 * LW8c: WHERE ONE STIRRING MAKES FOR - from their place `spot`, a free place of the room within INDOOR_WALK_M along a line
 * `walkable` lets them walk: a table where one stands alone first (the nearest - company), else one their own dice pick
 * (`stirs`, how often they have) - LW-ROOMS: of the places of their own first, TABLE_GAP_M from everyone else's (where
 * they stand, or make for), or where none in reach is, the farthest from everyone that any is; else of any (the first
 * cut's every pick: beside a table of strangers, so the room's stirs drew it back into one crowd); -1, none. `standing`
 * everyone stood ({ id, spot, walking }), the one stirring too. Pure over the room, the standing and the line.
 * @param {{ spots: number[][], tableOf: number[] }} room @param {readonly { id: string, spot: number, walking: boolean }[]} standing
 * @param {string} id @param {number} spot @param {number} stirs @param {(a: number[], b: number[]) => boolean} walkable
 * @returns {number}
 */
export function stirPlace(room, standing, id, spot, stirs, walkable) {
  const at = room.spots[spot];
  const taken = new Set(standing.map((x) => x.spot));
  taken.add(spot);
  const free = room.spots.map((_, i) => i).filter((i) => !taken.has(i) && Math.hypot(room.spots[i][0] - at[0], room.spots[i][2] - at[2]) <= INDOOR_WALK_M);
  /** @type {Map<number, number>} */
  const alone = new Map();
  for (const x of standing) if (x.id !== id && !x.walking) alone.set(room.tableOf[x.spot], (alone.get(room.tableOf[x.spot]) ?? 0) + 1);
  const company = free.filter((i) => room.tableOf[i] !== room.tableOf[spot] && alone.get(room.tableOf[i]) === 1)
    .sort((a, b) => Math.hypot(room.spots[a][0] - at[0], room.spots[a][2] - at[2]) - Math.hypot(room.spots[b][0] - at[0], room.spots[b][2] - at[2]) || a - b);
  for (const i of company) if (walkable(at, room.spots[i])) return i;
  const theirs = standing.filter((x) => x.id !== id && x.spot >= 0).map((x) => room.spots[x.spot]);   // LW-LODGE: one up by their bed is in no place of this room
  const clear = new Map(free.map((i) => [i, Math.min(Infinity, ...theirs.map((p) => Math.hypot(room.spots[i][0] - p[0], room.spots[i][2] - p[2])))]));
  const best = Math.max(0, ...clear.values());
  const own = new Set(free.filter((i) => (clear.get(i) ?? 0) >= Math.min(TABLE_GAP_M, best)));
  for (const list of [[...own], free.filter((i) => !own.has(i))]) {
    const roll = lwSeed(textSeed(id), stirs, 0x67) % Math.max(1, list.length);
    for (let k = 0; k < list.length; k++) { const i = list[(roll + k) % list.length]; if (walkable(at, room.spots[i])) return i; }
  }
  return -1;
}

/**
 * @param {{
 *   sprites: ReturnType<typeof import('../world/travellerSprites.js').createTravellerSprites>,
 *   building: () => ({ key: number, town: any, only?: (res: any) => boolean } | null),
 *   collider: () => any,
 *   floorAt: (x: number, y: number, z: number) => (number|null),
 *   origin: () => (number[] | null),
 *   staticFeet: () => number[][],
 *   waysIn?: () => number[][],
 *   clock: () => number,
 *   ready?: () => boolean,
 *   beds?: () => number[][],
 *   rented?: () => number,
 * }} deps - `building()` the building the player is in and its town's LivingTown (null: none, or not a living town's),
 *   and (LEGACY-HOME) `only(res)` the residents it holds when it is not the census's to fill - a family's house: its own;
 *   `origin()` where the player came in (feet, the room's frame); `floorAt` the room's floor under a point;
 *   `staticFeet()` the building's static people standing; `waysIn()` every door's landing (AUDIT-E4); `ready()` whether
 *   the room is whole (nothing loading); LW-LODGE `beds()` its beds (the Rest markers, feet), `rented()` the index among
 *   them of the bed of the room the player rents here (-1 none)
 */
export function createLivingIndoors(deps) {
  /** @type {{ key: number, spots: number[][], centre: number[], order: number[], tableOf: number[], beds: { feet: number[], yaw: number }[], holds: number } | null} */
  let room = null;
  /** @type {Map<string, { res: any, spot: number, bed: number, next: number, stirs: number, walk: { from: number[], to: number[], t: number, dur: number } | null, flat?: { archive: number, record: number } | null }>}
   *  who stands where - LW8c: when each next stirs (real seconds), how often they have, and a walk under way; LW-LODGE: a
   *  lodger up in their room at their bed (-1: in the common room, at `spot`); LW-LOOKS: the still picture one stands as */
  const stood = new Map();
  /** @type {{ res: any, e?: any }[]} who the day has inside, at the last read */
  let inside = [];
  /** LW-LODGE: the bed each of the day's lodgers has here @type {Map<string, number>} */
  let bedOf = new Map();
  /** The table each one stands at this frame (LW-LODGE: none in their room) @type {Map<string, number>} */
  const tableAt = new Map();
  let timer = Infinity;
  let arriving = true;
  /** @type {any[]} */
  const list = [];
  /** LW8b: this frame's circles at the tables, who is in one, the words to the player standing, when each was last
   *  greeted (the clock's minutes - kept across rooms, as the street keeps its), and the real seconds run. */
  /** @type {any[]} */
  let circles = [];
  const inCircle = new Set();
  /** LW8c: who stays put - LW-TALK: a circle's people while an exchange is on, and through their first round together */
  const staying = new Set();
  /** LW-TALK: each table's company - who stands at it, the minute it sat down as it is (or met, after the exchange it
   *  came in on), the circle it carries till then, and its own @type {Map<number, { ids: string, since: number, carry: any, circle: any }>} */
  const company = new Map();
  /** LW-TALK: each exchange's script as it began (meetups.js exchangeScript) @type {Map<string, any>} */
  const scripts = new Map();
  /** @type {Map<string, { text: string, until: number }>} */
  const words = new Map();
  /** @type {Map<string, { t: number, said: boolean }>} */
  const greeted = new Map();
  let realNow = 0;
  /** LW-TALK: the player's feet at the last frame (standing still before one: a stop) @type {number[]|null} */
  let lastFeet = null;

  /** The building's own deal of its spots: a seeded order, the same for every reader. */
  const dealOf = (key, n) => {
    const order = Array.from({ length: n }, (_, i) => i);
    let h = (key * 2654435761) >>> 0;
    for (let i = n - 1; i > 0; i--) { h = (Math.imul(h ^ (h >>> 15), 2246822519) + i) >>> 0; const j = h % (i + 1); [order[i], order[j]] = [order[j], order[i]]; }
    return order;
  };

  function clear() {
    deps.sprites.clear();
    stood.clear();
    inside = [];
    room = null;
    timer = Infinity;
    arriving = true;
    list.length = 0;
    bedOf = new Map();
    tableAt.clear();
    circles = [];
    inCircle.clear();
    staying.clear();
    company.clear();
    scripts.clear();
    words.clear();
    lastFeet = null;
  }

  /** The first free spot in the building's deal. */
  const freeSpot = () => {
    const taken = new Set([...stood.values()].map((s) => s.spot));
    return room?.order.find((i) => !taken.has(i)) ?? -1;
  };

  /** LW8c: one's own wait before they next stir (real seconds). @param {string} id @param {number} n */
  const stirWait = (id, n) => INDOOR_STIR_S[0] + (lwSeed(textSeed(id), n, 0x73746972) % 1000) / 1000 * (INDOOR_STIR_S[1] - INDOOR_STIR_S[0]);   // 'stir'
  /** LW8c: whether the room's collider lets one walk the line from `a` to `b` (feet). */
  const walkable = (a, b) => {
    const collider = deps.collider();
    if (!collider) return false;
    const q = [a[0], a[1] + 0.05, a[2]];
    try { collider.move(q, b[0] - a[0], 0, b[2] - a[2], 1.8); } catch { return false; }
    return Math.hypot(q[0] - b[0], q[2] - b[2]) < 0.25;
  };

  return {
    /**
     * One frame inside: the room sounded on the way in, who is inside read on its beat, comings and goings where the
     * player is not looking, every body synced. `feet` the player's (the room's frame), `viewYaw` the camera's yaw.
     * @param {number} dt @param {number[]} feet @param {number} viewYaw @param {number[]} eye
     */
    frame(dt, feet, viewYaw, eye) {
      const b = deps.building();
      if (!b?.town || deps.ready?.() === false) { if (room || stood.size) clear(); return; }
      if (!room || room.key !== b.key) {
        clear();
        const origin = deps.origin() ?? feet;
        const collider = deps.collider();
        const spots = collider ? soundRoom(origin, collider, deps.floorAt, deps.staticFeet(), deps.waysIn?.() ?? []) : [];
        const cx = spots.reduce((s, p) => s + p[0], 0) / Math.max(1, spots.length), cz = spots.reduce((s, p) => s + p[2], 0) / Math.max(1, spots.length);
        // LW8b: the room fills table by table - the tables in the building's deal, each its spots in turn (LW-ROOMS: the
        // deal's tables apart first)
        const groups = spreadTables(spots, tablesOf(spots, dealOf(b.key, spots.length)));
        const tableOf = new Array(spots.length).fill(-1);
        groups.forEach((tb, ti) => { for (const i of tb) tableOf[i] = ti; });
        // LW-LODGE: where a lodger stands by each of the room's beds
        const beds = collider ? (deps.beds?.() ?? []).map((m) => bedStand(m, collider, deps.floorAt)) : [];
        // LW-ROOMS: what its floor holds - one to every INDOOR_FLOOR_M2 of it (its places, a lattice cell each)
        const holds = Math.ceil((spots.length * INDOOR_APART_M ** 2) / INDOOR_FLOOR_M2);
        room = { key: b.key, spots, centre: [cx, origin[1], cz], order: groups.flat(), tableOf, beds, holds };
      }
      timer += dt;
      realNow += dt;
      /** LW-LODGE: the bed one inside is at - a lodger up in their room (their day's `home` here), else none (-1) */
      const bedFor = (/** @type {{ res: any, e?: any }} */ x) => (x.e?.kind === 'home' ? bedOf.get(x.res.id) ?? -1 : -1);
      if (timer >= INDOOR_TICK_S) {
        timer = 0;
        // LW-LODGE: the day's lodgers here dealt the room's beds (none but at a tavern)
        const lodgers = room.beds.length ? b.town.lodgersAt?.(b.key, b.town.dayOf(deps.clock())) ?? [] : [];
        bedOf = bedsOf(lodgers.map((r) => r.id), room.beds.length, b.key, deps.rented?.() ?? -1);
        // the day's own, to INDOOR_MAX - LW-ROOMS: and no more on the room's floor than it holds (one up in their room by
        // their bed is on none of it; the first cut stood twelve in any room, a closet of a shop's as a great hall's)
        inside = [];
        let onFloor = 0;
        for (const x of b.town.insideAt(b.key, deps.clock()).filter((x) => !b.only || b.only(x.res))) {   // LEGACY-HOME: a family's house holds its own
          if (inside.length >= INDOOR_MAX) break;
          if (bedFor(x) < 0 && onFloor++ >= room.holds) continue;
          inside.push(x);
        }
      }
      // comings and goings: at once on the way in, else where the player is not looking (or far)
      const unseen = (p) => {
        const dx = p[0] - feet[0], dz = p[2] - feet[2];
        return arriving || Math.hypot(dx, dz) > INDOOR_SEEN_M || dx * Math.sin(viewYaw) + dz * Math.cos(viewYaw) <= 0;
      };
      /** LW8c: where one is now - on a walk, along it; LW-LODGE: one in their room, by their bed. */
      const placeOf = (s) => (s.bed >= 0 ? room.beds[s.bed].feet : s.walk ? [s.walk.from[0] + (s.walk.to[0] - s.walk.from[0]) * (s.walk.t / s.walk.dur), s.walk.to[1], s.walk.from[2] + (s.walk.to[2] - s.walk.from[2]) * (s.walk.t / s.walk.dur)] : room.spots[s.spot]);
      const want = new Map(inside.map((x) => [x.res.id, bedFor(x)]));
      // one gone - or gone up to their room, or down from it (where they stand is another place): when unseen where they are
      for (const [id, s] of [...stood]) if ((!want.has(id) || (want.get(id) ?? -1) !== s.bed) && unseen(placeOf(s))) stood.delete(id);   // LW-FIX1: one walking judged where they are, not where they make for
      for (const x of inside) {
        const res = x.res;
        if (stood.has(res.id)) continue;
        const bed = bedFor(x);
        if (bed >= 0) {
          if (unseen(room.beds[bed].feet)) stood.set(res.id, { res: { ...res, cls: townClassOf(res) }, spot: -1, bed, next: realNow + stirWait(res.id, 0), stirs: 0, walk: null });
          continue;
        }
        const spot = freeSpot();
        if (spot < 0) break;
        if (!unseen(room.spots[spot])) continue;
        stood.set(res.id, { res: { ...res, cls: townClassOf(res) }, spot, bed: -1, next: realNow + stirWait(res.id, 0), stirs: 0, walk: null });   // indoors no one is armed - LW-LOOKS: but one whose calling is a class's wears it
      }
      // LW8c: the room astir - one in no talking circle (the last frame's) whose wait is up makes for another place; a
      // walk under way goes on
      for (const [id, s] of stood) {
        if (s.bed >= 0) continue;   // LW-LODGE: in their room
        if (s.walk) {
          s.walk.t += dt;
          if (s.walk.t >= s.walk.dur) { s.walk = null; s.next = realNow + stirWait(id, s.stirs); }
          continue;
        }
        if (staying.has(id) || realNow < s.next) continue;
        s.stirs++;
        const to = stirPlace(room, [...stood].map(([oid, x]) => ({ id: oid, spot: x.spot, walking: !!x.walk })), id, s.spot, s.stirs, walkable);
        if (to < 0) { s.next = realNow + stirWait(id, s.stirs); continue; }
        const from = room.spots[s.spot];
        s.walk = { from, to: room.spots[to], t: 0, dur: Math.hypot(room.spots[to][0] - from[0], room.spots[to][2] - from[2]) / INDOOR_WALK_SPEED };
        s.spot = to;   // theirs from the moment they set out
      }
      // LW8b: who stands at each table; those at one face its middle, one alone the room (LW8c: one walking at none)
      /** @type {Map<number, { id: string, res: any, spot: number }[]>} */
      const tables = new Map();
      tableAt.clear();
      for (const [id, s] of stood) {
        if (s.walk || s.bed >= 0) continue;   // LW-LODGE: one in their room at no table
        const ti = room.tableOf[s.spot];
        const at = tables.get(ti) ?? [];
        at.push({ id, res: s.res, spot: s.spot });
        tables.set(ti, at);
        tableAt.set(id, ti);
      }
      // LW8b: the tables' circles - LW-TALK: a table's company meets from the minute it sat down as it is, a round at a
      // time while it stays the same (one who leaves ends it, one who comes begins another); its talk begins a beat after
      const t = deps.clock();
      const beat = b.town.talkBeat?.();
      circles = [];
      inCircle.clear();
      staying.clear();
      for (const ti of [...company.keys()]) if (!tables.has(ti)) company.delete(ti);
      for (const [ti, at] of tables) {
        if (!beat || at.length < 2) { company.delete(ti); continue; }
        const ids = at.map((m) => m.id).sort().join(',');
        let co = company.get(ti);
        if (!co || co.ids !== ids) {
          // one come to a table mid-exchange waits for it: the company there talks it out, and the new one meets after its
          // last line (LW-FIX1's law - a talk never re-dealt mid-script); one gone, the talk is over at once
          const was = co?.circle && co.circle.members.every((m) => at.some((x) => x.id === m.id)) ? exchangeAt(co.circle, t, beat.lineMin) : null;
          company.set(ti, co = { ids, since: was ? was.s + SLOT_LINES * beat.lineMin : t, carry: was ? co.circle : null, circle: null });
        }
        if (co.carry && t < co.since) {
          circles.push(co.carry);
          for (const m of co.carry.members) { inCircle.add(m.id); staying.add(m.id); }
          continue;
        }
        co.carry = null;
        const round = Math.max(0, Math.floor((t - co.since) / beat.roundMin));
        const start = co.since + round * beat.roundMin;
        co.circle = null;
        for (const c of dealCircles(`in:${b.key}:${ti}:${co.since}`, at.map((m) => m.res), round, start, start + beat.roundMin, GATHER_BEAT_S * beat.roundMin / ROUND_S)) {
          circles.push(c);
          co.circle ??= c;
          const on = t - co.since < beat.roundMin || exchangeAt(c, t, beat.lineMin) != null;
          for (const m of c.members) { inCircle.add(m.id); if (on) staying.add(m.id); }   // LW8c: who stays put
        }
      }
      // LW-LOOKS: the palace's courtiers keeping their place alone (in no circle - this frame's, dealt above: on the way in
      // too - nor crossing the room) stand as Daggerfall's still pictures of the court, stood as on the way in or where the
      // player is not looking; themselves at once in a circle or on their way
      const court = b.town.typeOf?.(b.key) === BUILDING_TYPES.Palace;
      for (const [id, s] of stood) {
        const want = court && s.res.job === 'courtier' && s.bed < 0 && !s.walk && !inCircle.has(id) ? stillFlatOf(s.res, 'court') : null;
        if ((want?.archive ?? -1) === (s.flat?.archive ?? -1) && (want?.record ?? -1) === (s.flat?.record ?? -1)) continue;
        if (!want || unseen(placeOf(s))) s.flat = want;
      }
      arriving = false;
      list.length = 0;
      for (const [id, s] of stood) {
        if (s.bed >= 0) {   // LW-LODGE: by their bed, facing it
          const st = room.beds[s.bed];
          list.push({ key: `in:${id}`, res: s.res, feet: st.feet, yaw: st.yaw, moving: false, distM: Math.hypot(st.feet[0] - feet[0], st.feet[2] - feet[2]) });
          continue;
        }
        if (s.walk) {
          const p = placeOf(s);
          list.push({ key: `in:${id}`, res: s.res, feet: p, yaw: Math.atan2(s.walk.to[0] - s.walk.from[0], s.walk.to[2] - s.walk.from[2]), moving: true, distM: Math.hypot(p[0] - feet[0], p[2] - feet[2]) });
          continue;
        }
        const p = room.spots[s.spot];
        const mates = tables.get(room.tableOf[s.spot]) ?? [];
        const toward = mates.length > 1
          ? [mates.reduce((a, m) => a + room.spots[m.spot][0], 0) / mates.length, 0, mates.reduce((a, m) => a + room.spots[m.spot][2], 0) / mates.length]
          : room.centre;
        list.push({ key: `in:${id}`, res: s.res, feet: p, yaw: Math.atan2(toward[0] - p[0], toward[2] - p[2]), moving: false, distM: Math.hypot(p[0] - feet[0], p[2] - feet[2]), flat: s.flat ?? null });
      }
      deps.sprites.sync(list, { dt, eye, ground: true });
      // LW8b: the street's word for the player passing close - one in no circle, once in GREET_REST_MIN of the clock;
      // LW-TALK: one who kept quiet as the player came by speaks when the player stops before them (stands still within
      // the street's idle distance - the first cut never asked, and a quiet stranger here never spoke)
      const still = lastFeet != null && Math.hypot(feet[0] - lastFeet[0], feet[2] - lastFeet[2]) < 1e-3;
      lastFeet = [feet[0], feet[1], feet[2]];
      for (const [id, s] of stood) {
        const p = placeOf(s);
        const dist = Math.hypot(p[0] - feet[0], p[2] - feet[2]);
        if (inCircle.has(id) || dist > GREET_RANGE) continue;
        const stopped = still && dist <= PERSON_IDLE_DISTANCE;
        const last = greeted.get(id);
        if (last && t >= last.t && t - last.t < GREET_REST_MIN && (last.said || !stopped)) continue;   // AUDIT-E6: a clock gone back (a load) forgets the rest
        const text = b.town.greetingFor?.(s.res, t, stopped) ?? null;
        greeted.set(id, { t, said: text != null });
        if (text != null) words.set(id, { text, until: realNow + GREET_S });
      }
      if (greeted.size > 512) for (const [id, at] of greeted) if (t - at.t >= GREET_REST_MIN) greeted.delete(id);
    },
    /**
     * LW8b: what is being said in the room this moment - each talking circle's line over its speaker (the street's
     * words, the room's own among them), and the words to the player - within LINE_RANGE of `eye` (the room's frame).
     * @param {number[]} eye
     * @returns {{ person: any, text: string, kind: 'talk' }[]}
     */
    speech(eye) {
      const b = deps.building();
      const out = [];
      if (!b?.town || !room || !stood.size) return out;
      const t = deps.clock();
      const seats = deps.sprites.persons();
      const heard = (id) => {
        const seat = seats.find((x) => x.person?.living?.id === id);
        return seat && Math.hypot(seat.pos[0] - eye[0], seat.pos[2] - eye[2]) <= LINE_RANGE ? seat : null;
      };
      if (circles.length) {
        const beat = b.town.talkBeat();
        const ctx = { ...b.town.lineCtx(t), room: roomKindOf(b.town.typeOf(b.key)) };
        if (scripts.size > 2048) scripts.clear();
        for (const c of circles) {
          const line = circleLine(c, t, beat.lineMin, ctx, scripts);
          const seat = line ? heard(line.who.id) : null;
          if (line && seat) out.push({ person: seat.person, text: line.text, kind: /** @type {'talk'} */ ('talk') });
        }
      }
      for (const [id, w] of [...words]) {
        if (!(w.until > realNow)) { words.delete(id); continue; }
        const seat = heard(id);
        if (seat) out.push({ person: seat.person, text: w.text, kind: /** @type {'talk'} */ ('talk') });
      }
      return out;
    },
    /** The bodies' talk seats ({ person, pos } - the street's activation shape). */
    seats: () => deps.sprites.persons(),
    /** This frame's drawn bodies (the building's billboard pass). */
    batches: () => deps.sprites.batches(),
    /** The town the room's residents belong to (the host's door asks it), or null. */
    town: () => deps.building()?.town ?? null,
    /**
     * A hand caught in a purse here: the crime in the regard of the one robbed and of every resident in the room within
     * the street's witness reach. Answers the resident's id, or null.
     * @param {any} person
     */
    caught(person) {
      const id = person?.living?.id;
      const town = deps.building()?.town;
      if (!id || !town) return null;
      const rel = town.o?.relations?.();
      const day = town.dayOf(deps.clock());
      rel?.note(id, 'crime', day);
      const at = person.pos;
      for (const seat of deps.sprites.persons()) {
        const w = seat.person?.living?.id;
        if (!w || w === id || !at || Math.hypot(seat.pos[0] - at[0], seat.pos[2] - at[2]) > WITNESS_M) continue;
        rel?.note(w, 'crime', day);
      }
      return id;
    },
    /** Who stands where, and at which table (the probes; the pins). */
    stood: () => [...stood.entries()].map(([id, s]) => ({ id, res: s.res, at: s.bed >= 0 ? room?.beds[s.bed].feet ?? null : room?.spots[s.spot] ?? null, table: tableAt.has(id) ? tableAt.get(id) : s.bed >= 0 ? -1 : room?.tableOf[s.spot] ?? -1, walking: !!s.walk, bed: s.bed, flat: s.flat ?? null })),
    /** LW-LODGE: where a lodger stands by each of the room's beds (the probes; the pins). */
    beds: () => room?.beds ?? [],
    /** The room's spots (the probes; the pins). */
    spots: () => room?.spots ?? [],
    clear,
    get size() { return stood.size; },
  };
}
