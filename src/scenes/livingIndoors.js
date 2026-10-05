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
// WHERE. A room has no grid to walk; it is SOUNDED once from its way in (`origin`, AUDIT-E4: the first door's): a fan of
// INDOOR_FAN directions walked out to INDOOR_SPREAD_M through the room's own collider (`move` - never through a wall),
// each landing on a floor (`floorAt`), kept INDOOR_APART_M from every other, from the building's static people and from
// the way in - and each resident given one, in the order of their ids over an order the building's key deals (those in
// the room on the way in stand alike for every reader). They stand facing into the room, in their own clothes (indoors
// no one is armed), to INDOOR_MAX.
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
// ═══════════════════════════════════════════════════════════════════
import { WITNESS_M, GREET_RANGE, GREET_REST_MIN, GREET_S, LINE_RANGE } from '../systems/livingWorld/livingTown.js';
import { spotCircles, circleLine } from '../systems/livingWorld/meetups.js';
import { roomKindOf } from '../systems/livingWorld/lines.js';
import { lwSeed, textSeed } from '../systems/livingWorld/seed.js';

/** Who is inside is read this often (real seconds). */
export const INDOOR_TICK_S = 1;
/** The directions a room is sounded in from the way in, and the distances walked out along each (m). */
export const INDOOR_FAN = 12;
export const INDOOR_SPREAD_M = Object.freeze([2.4, 3.8, 5.2, 6.6]);
/** How far apart two spots stand (m), and how far a spot keeps from a static person and from the way in (m). */
export const INDOOR_APART_M = 1.3;
export const INDOOR_CLEAR_M = 1.1;
export const INDOOR_DOOR_M = 1.8;
/** The most residents stood in one room. */
export const INDOOR_MAX = 12;
/** A coming or a going waits for the player to look away unless it is this far off (m) - indoors, little is. */
export const INDOOR_SEEN_M = 14;
/** LW8b: spots this near one another share a table (m), and the most at one. */
export const TABLE_M = 2.2;
export const TABLE_MAX = 3;
/** LW8c: how long one stays put before they stir (real seconds, their own between these), how far they cross (m), and
 *  their pace across the room (m a second). */
export const INDOOR_STIR_S = Object.freeze([30, 90]);
export const INDOOR_WALK_M = 7;
export const INDOOR_WALK_SPEED = 1.2;

/**
 * Sound a room: from `origin` (feet), a fan of directions walked out through the collider and landed on its floor,
 * kept apart from each other, from `keepClear` (feet) and from every way in (`origin`, `waysIn`). Pure over the collider.
 * @param {number[]} origin @param {{ move: (feet: number[], dx: number, dy: number, dz: number, height: number) => any }} collider
 * @param {(x: number, y: number, z: number) => (number|null)} floorAt - the floor's height under a point, or null
 * @param {readonly number[][]} [keepClear] @param {readonly number[][]} [waysIn] - AUDIT-E4: the building's other ways in
 * @returns {number[][]}
 */
export function soundRoom(origin, collider, floorAt, keepClear = [], waysIn = []) {
  const spots = [];
  const far = (p, list, d) => list.every((q) => Math.hypot(p[0] - q[0], p[2] - q[2]) >= d);
  for (const dist of INDOOR_SPREAD_M) {
    for (let i = 0; i < INDOOR_FAN; i++) {
      const a = (i / INDOOR_FAN) * Math.PI * 2 + (dist / 7);
      const q = [origin[0], origin[1] + 0.05, origin[2]];
      try { collider.move(q, Math.sin(a) * dist, 0, Math.cos(a) * dist, 1.8); } catch { continue; }
      const y = floorAt(q[0], q[1] + 0.5, q[2]);
      if (y == null || !Number.isFinite(y) || Math.abs(y - origin[1]) > 1.2) continue;   // a floor of this room, not a stair's foot or a hole
      const p = [q[0], y, q[2]];
      if (Math.hypot(p[0] - origin[0], p[2] - origin[2]) < INDOOR_DOOR_M) continue;
      if (!far(p, spots, INDOOR_APART_M) || !far(p, keepClear, INDOOR_CLEAR_M) || !far(p, waysIn, INDOOR_DOOR_M)) continue;
      spots.push(p);
    }
  }
  return spots;
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
 * LW8c: WHERE ONE STIRRING MAKES FOR - from their place `spot`, a free place of the room within INDOOR_WALK_M along a line
 * `walkable` lets them walk: a table where one stands alone first (the nearest - company), else one their own dice pick
 * (`stirs`, how often they have); -1, none. `standing` everyone stood ({ id, spot, walking }), the one stirring too. Pure
 * over the room, the standing and the line.
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
  const roll = lwSeed(textSeed(id), stirs, 0x67) % Math.max(1, free.length);
  for (let k = 0; k < free.length; k++) { const i = free[(roll + k) % free.length]; if (walkable(at, room.spots[i])) return i; }
  return -1;
}

/**
 * @param {{
 *   sprites: ReturnType<typeof import('../world/travellerSprites.js').createTravellerSprites>,
 *   building: () => ({ key: number, town: any } | null),
 *   collider: () => any,
 *   floorAt: (x: number, y: number, z: number) => (number|null),
 *   origin: () => (number[] | null),
 *   staticFeet: () => number[][],
 *   waysIn?: () => number[][],
 *   clock: () => number,
 *   ready?: () => boolean,
 * }} deps - `building()` the building the player is in and its town's LivingTown (null: none, or not a living town's);
 *   `origin()` where the player came in (feet, the room's frame); `floorAt` the room's floor under a point;
 *   `staticFeet()` the building's static people standing; `waysIn()` every door's landing (AUDIT-E4); `ready()` whether
 *   the room is whole (nothing loading)
 */
export function createLivingIndoors(deps) {
  /** @type {{ key: number, spots: number[][], centre: number[], order: number[], tableOf: number[] } | null} */
  let room = null;
  /** @type {Map<string, { res: any, spot: number, next: number, stirs: number, walk: { from: number[], to: number[], t: number, dur: number } | null }>}
   *  who stands where - LW8c: when each next stirs (real seconds), how often they have, and a walk under way */
  const stood = new Map();
  /** @type {{ res: any, e?: any }[]} who the day has inside, at the last read */
  let inside = [];
  let timer = Infinity;
  let arriving = true;
  /** @type {any[]} */
  const list = [];
  /** LW8b: this frame's circles at the tables, who is in one, the words to the player standing, when each was last
   *  greeted (the clock's minutes - kept across rooms, as the street keeps its), and the real seconds run. */
  /** @type {any[]} */
  let circles = [];
  const inCircle = new Set();
  /** LW8c: the members of a talking circle (they stay put) */
  const talking = new Set();
  /** LW-FIX1: the round the tables' circles were dealt for, and each table's circles as the round began */
  let roomRound = /** @type {number|null} */ (null);
  /** @type {Map<number, any[]>} */
  const roundCircles = new Map();
  /** @type {Map<string, { text: string, until: number }>} */
  const words = new Map();
  /** @type {Map<string, number>} */
  const greeted = new Map();
  let realNow = 0;

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
    circles = [];
    inCircle.clear();
    talking.clear();
    roomRound = null;
    roundCircles.clear();
    words.clear();
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
        // LW8b: the room fills table by table - the tables in the building's deal, each its spots in turn
        const groups = tablesOf(spots, dealOf(b.key, spots.length));
        const tableOf = new Array(spots.length).fill(-1);
        groups.forEach((tb, ti) => { for (const i of tb) tableOf[i] = ti; });
        room = { key: b.key, spots, centre: [cx, origin[1], cz], order: groups.flat(), tableOf };
      }
      timer += dt;
      realNow += dt;
      if (timer >= INDOOR_TICK_S) {
        timer = 0;
        inside = b.town.insideAt(b.key, deps.clock()).slice(0, INDOOR_MAX);
      }
      // comings and goings: at once on the way in, else where the player is not looking (or far)
      const unseen = (p) => {
        const dx = p[0] - feet[0], dz = p[2] - feet[2];
        return arriving || Math.hypot(dx, dz) > INDOOR_SEEN_M || dx * Math.sin(viewYaw) + dz * Math.cos(viewYaw) <= 0;
      };
      /** LW8c: where one is now - on a walk, along it. */
      const placeOf = (s) => (s.walk ? [s.walk.from[0] + (s.walk.to[0] - s.walk.from[0]) * (s.walk.t / s.walk.dur), s.walk.to[1], s.walk.from[2] + (s.walk.to[2] - s.walk.from[2]) * (s.walk.t / s.walk.dur)] : room.spots[s.spot]);
      const want = new Set(inside.map((x) => x.res.id));
      for (const [id, s] of [...stood]) if (!want.has(id) && unseen(placeOf(s))) stood.delete(id);   // LW-FIX1: one walking judged where they are, not where they make for
      for (const { res } of inside) {
        if (stood.has(res.id)) continue;
        const spot = freeSpot();
        if (spot < 0) break;
        if (!unseen(room.spots[spot])) continue;
        stood.set(res.id, { res: { ...res, cls: null }, spot, next: realNow + stirWait(res.id, 0), stirs: 0, walk: null });   // indoors no one is armed
      }
      arriving = false;
      // LW8c: the room astir - one in no talking circle (the last frame's) whose wait is up makes for another place; a
      // walk under way goes on
      for (const [id, s] of stood) {
        if (s.walk) {
          s.walk.t += dt;
          if (s.walk.t >= s.walk.dur) { s.walk = null; s.next = realNow + stirWait(id, s.stirs); }
          continue;
        }
        if (talking.has(id) || realNow < s.next) continue;
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
      for (const [id, s] of stood) {
        if (s.walk) continue;
        const ti = room.tableOf[s.spot];
        const at = tables.get(ti) ?? [];
        at.push({ id, res: s.res, spot: s.spot });
        tables.set(ti, at);
      }
      list.length = 0;
      for (const [id, s] of stood) {
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
        list.push({ key: `in:${id}`, res: s.res, feet: p, yaw: Math.atan2(toward[0] - p[0], toward[2] - p[2]), moving: false, distM: Math.hypot(p[0] - feet[0], p[2] - feet[2]) });
      }
      deps.sprites.sync(list, { dt, eye, ground: true });
      // LW8b: the tables' circles this round - those at a table the whole of it, on the street's rule (meetups.js)
      const t = deps.clock();
      const beat = b.town.talkBeat?.();
      const stays = new Map(inside.map((x) => [x.res.id, x.e]));
      circles = [];
      inCircle.clear();
      talking.clear();
      // LW-FIX1: a table's circles are the round's as it began - one who comes mid-round joins the next, and a circle one
      // of whom goes is silent till then (never a talk re-dealt mid-script)
      const round = beat ? Math.floor(t / beat.roundMin) : null;
      if (round !== roomRound) {
        roomRound = round;
        roundCircles.clear();
        // AUDIT-E5: a table nobody stands at as the round begins deals nothing this round - two who sit down at it
        // mid-round talk from the next (dealt now, they began mid-script)
        for (const ti of room.tableOf) if (ti >= 0 && !tables.has(ti)) roundCircles.set(ti, []);
      }
      for (const [ti, at] of tables) {
        if (!beat) continue;
        let dealt = roundCircles.get(ti);
        if (dealt === undefined) {
          const present = at.flatMap((m) => { const e = stays.get(m.id); return e ? [{ who: m.res, t0: e.t0, t1: e.t1 }] : []; });
          dealt = at.length < 2 ? [] : spotCircles(`in:${b.key}:${ti}`, present, t, beat.roundMin);
          roundCircles.set(ti, dealt);
        }
        for (const c of dealt) {
          if (!c.members.every((m) => at.some((x) => x.id === m.id))) continue;   // one of them gone: silent till the next round
          circles.push(c);
          for (const m of c.members) { inCircle.add(m.id); if (c.talks) talking.add(m.id); }   // LW8c: who stays put
        }
      }
      // LW8b: the street's word for the player passing close - one in no circle, once in GREET_REST_MIN of the clock
      for (const [id, s] of stood) {
        const p = placeOf(s);
        if (inCircle.has(id) || Math.hypot(p[0] - feet[0], p[2] - feet[2]) > GREET_RANGE) continue;
        const last = greeted.get(id);
        if (last != null && t >= last && t - last < GREET_REST_MIN) continue;   // AUDIT-E6: a clock gone back (a load) forgets the rest
        greeted.set(id, t);
        const text = b.town.greetingFor?.(s.res, t, false) ?? null;
        if (text != null) words.set(id, { text, until: realNow + GREET_S });
      }
      if (greeted.size > 512) for (const [id, at] of greeted) if (t - at >= GREET_REST_MIN) greeted.delete(id);
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
        for (const c of circles) {
          const line = circleLine(c, t, beat.lineMin, ctx);
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
    stood: () => [...stood.entries()].map(([id, s]) => ({ id, res: s.res, at: room?.spots[s.spot] ?? null, table: room?.tableOf[s.spot] ?? -1, walking: !!s.walk })),
    /** The room's spots (the probes; the pins). */
    spots: () => room?.spots ?? [],
    clear,
    get size() { return stood.size; },
  };
}
