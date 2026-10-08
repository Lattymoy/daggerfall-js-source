// REST3 (2026-10-03, bible/06-Systems/Rest-Arc.md section 4; Mac: "Dungeon layouts now recieve multiple strategic
// placements for campfires"): THE DUNGEON'S OWN FIRES. A pure law over the layout's own data - its markers, its block
// grid, its water and its doors - with the collider's answers handed in, so every client of the dungeon stands the
// same fires and nothing rides the wire (the shape of PROF2's veins, scenes/dungeonContext.js profVeinWall). A placed
// fire is permanent: never cold, never picked up, a rest point and a hearth like any brazier the layout already has.
//
//   candidates  every start, enter, treasure and quest marker (199.10/8/19/11/18), every fixed treasure (216), and
//               every non-border block's centre, in layout order (block index, then marker order)
//   valid       a flat floor within 4 m below (ny > 0.99), the dungeon's own mesh and not a lift's (AUDIT REST-PARTY
//               C4), level to 5 cm half a metre all round (C3: no stair, no ramp), room to sit and a room round it
//               (colliderFireProbe), half a metre over the block's water, 3 m clear of every door, 8 m clear of every
//               enemy marker
//   chosen      the entrance fire (nearest the start, within 25 m, else the starting block's nearest - 25 m clear of
//               every fire the layout stands, C2; a layout fire by the door, or nearer it than that, IS the entrance's
//               and counts, C5), the deep fire (farthest from it, height counted twice), then farthest-point spread 80 m
//               apart and 80 m from every fire the layout already stands - a height band with candidates and no fire
//               served first - until N = clamp(round(blocks / 3), 2, 7), blocks the non-border ones; an elite dungeon
//               half (at least one)
//
// AUDIT REST II (the dungeon fires audited again): a palace stands none (F2 - any castle block in its layout); a marker's
// fire never stands on the marker - a loot pile, a quest item or the player's own entry is there - but on the first spot
// of a ring 2 m out that keeps every rule, and no fire stands within 1.5 m of any such marker (F3); a floor is a face
// that looks UP (a closed room's roof, seen from the void between storeys, is a ceiling's back - F4) with 1.4 m of level
// floor round it, so a tabletop, a plinth or a ledge is no hearth; a door is measured from its face's centre (F7); and
// the law says which layout fire it took for the entrance's, so the host gives it a campfire's ward and marks (F5).

import { hash32 } from './spawnedDungeons.js';
import { GLOBAL_SCALE } from './meshReader.js';
import { RDB_SIDE } from './rdbLayout.js';
import { isDungeonExitDoor } from './dungeonLayout.js';   // AUDIT REST-PARTY C6: the doors the law keeps clear of are the host's
import { transformPoint } from './mat4.js';   // AUDIT REST II F7: a door's face centre, as dungeonLayout's own overlap test reads it

/** The flame a placed fire draws: TEXTURE.210 record 1, the camp's own (survival/camp.js FIRE_FLAT). */
export const DUNGEON_FIRE_FLAT = Object.freeze({ archive: 210, record: 1 });
/** The editor markers a fire may stand on (archive 199): start, enter, random treasure, quest spawn, quest item. */
export const FIRE_MARKER_RECORDS = Object.freeze([10, 8, 19, 11, 18]);
/** The enemy markers a fire keeps clear of (archive 199): random and fixed. */
export const ENEMY_MARKER_RECORDS = Object.freeze([15, 16]);
/** Fixed treasure's archive (rdbLayout FIXED_TREASURE_FLATS_ARCHIVE) - its entries carry `archive`, a 199 marker none. */
export const FIXED_TREASURE_ARCHIVE = 216;
export const DFIRE = Object.freeze({
  floorM: 4,          // a floor within this far below the candidate
  flatNy: 0.99,       // ...and flat: no stair, no ramp (AUDIT REST-PARTY C3: 0.9 passed a 25.8 degree slope)
  levelR: 0.5,        // AUDIT REST-PARTY C3: ...and level all round - the floor sampled this far out on eight bearings
  levelM: 0.05,       // ...each within this of the centre's (a stair's next tread, a ramp's next half metre, a ledge)
  roomM: 1.5,         // eight chest-height rays clear this far
  reachR: 1.4,        // AUDIT REST II F4: ...and the floor level on a second ring this far out (roomM - 0.1): no tabletop, plinth or ledge
  itemM: 1.5,         // AUDIT REST II F3: never this near (across, on its storey) a start, enter, treasure, quest or fixed-treasure marker
  ringM: 2,           // AUDIT REST II F3: a marker's fire stands on a ring this far out from it, never on the marker
  dryM: 0.5,          // over the block's water
  doorM: 3,           // from every action and exit door
  enemyM: 8,          // from every enemy marker
  entranceM: 25,      // the entrance fire's reach from the start
  spacingM: 80,       // about a block and a half
  storeyM: 6,         // the height band that stands in for a storey (automapFloors builds off the draw, after these)
  wardM: 15,          // no wandering spawn stands this near a placed fire (OPEN 9)
  ceilingM: 10,       // a ceiling within this far over it: inside a room, never on a room's roof
  enclosedM: 30,      // ...and walls round it - at least `enclosedRays` of the eight rays meet one within this far
  enclosedRays: 4,
  min: 2, max: 7, perBlocks: 3,
});
const WATER_NONE = 10000;

export const isBorderBlock = (name) => /^B/i.test(String(name ?? ''));

/** How many fires a dungeon of `blocks` non-border blocks stands: clamp(round(blocks / 3), 2, 7) - an elite half, at least one. */
export function dungeonFireCount(blocks, elite = false) {
  const n = Math.max(DFIRE.min, Math.min(DFIRE.max, Math.round((Math.max(0, blocks | 0)) / DFIRE.perBlocks)));
  return elite ? Math.max(1, Math.floor(n / 2)) : n;
}

const isFireMarker = (m) => m && (m.archive === FIXED_TREASURE_ARCHIVE || (m.archive == null && FIRE_MARKER_RECORDS.includes(m.record)));
const isEnemyMarker = (m) => m && m.archive == null && ENEMY_MARKER_RECORDS.includes(m.record);
const half = RDB_SIDE / 2;

/**
 * The candidates in layout order: { pos: [x, y, z] (the marker's own, the dungeon's frame), block, start, water }.
 * `water` is the block's water plane's y (or -Infinity for a dry block). `blocks` is the layout's (dungeonLayout).
 * AUDIT REST II F3: a marker's candidate says so (`marker` - landCandidates stands it on its ring, never on the marker);
 * a block's centre (`centre`) stands where it is.
 */
export function fireCandidates(blocks) {
  const out = [];
  (blocks ?? []).forEach((b, bi) => {
    const lay = b?.layout;
    if (!lay || lay.castleBlock) return;   // AUDIT REST: a palace's block is a court, never a camp
    const water = Number.isFinite(lay.waterLevel) && lay.waterLevel !== WATER_NONE ? -lay.waterLevel * GLOBAL_SCALE : -Infinity;
    for (const m of lay.markers ?? []) {
      if (!isFireMarker(m)) continue;
      out.push({ pos: [m.x + b.originX, m.y, m.z + b.originZ], block: bi, start: !!b.isStartingBlock, water, marker: true });
    }
    if (!isBorderBlock(b.name)) {
      // a block's centre, at the height of its first marker (a block's floor sits near its markers), else zero
      const y0 = (lay.markers ?? []).find((m) => m && m.archive == null)?.y ?? 0;
      out.push({ pos: [b.originX + half, y0, b.originZ + half], block: bi, start: !!b.isStartingBlock, water, centre: true });
    }
  });
  return out;
}

/** The start marker the dungeon is entered at (the starting block's first 199.10), in the dungeon's frame, or null. */
export function dungeonStart(blocks) {
  for (const b of blocks ?? []) {
    if (!b?.isStartingBlock) continue;
    const m = (b.layout?.startMarkers ?? [])[0];
    if (m) return [m.x + b.originX, m.y, m.z + b.originZ];
  }
  return null;
}

/** Every enemy marker, in the dungeon's frame. */
export const enemyMarks = (blocks) => (blocks ?? []).flatMap((b) => (b?.layout?.markers ?? []).filter(isEnemyMarker).map((m) => [m.x + b.originX, m.y, m.z + b.originZ]));
/** AUDIT REST II F3: every start, enter, treasure, quest and fixed-treasure marker, in the dungeon's frame - the spots a
 *  loot pile, a quest's item or foe, or the player's own entry stands on (dungeonContext stands a pile at every 199.19
 *  and 216) - which no fire stands within DFIRE.itemM of. */
export const itemMarks = (blocks) => (blocks ?? []).flatMap((b) => (b?.layout?.markers ?? []).filter(isFireMarker).map((m) => [m.x + b.originX, m.y, m.z + b.originZ]));

/** AUDIT REST II F2: a palace - a layout with a castle block in it (rdbLayout's castleBlock, the court DFU's
 *  IsPlayerInsideDungeonCastle reads). "A palace has none": fireCandidates kept the castle's own block out, and the
 *  palace's other blocks are its halls, never a camp. */
export const isPalaceLayout = (blocks) => (blocks ?? []).some((b) => !!b?.layout?.castleBlock);
/** The fires a layout wants: dungeonFireCount over its non-border blocks - none in a palace, whose blocks count for
 *  nothing (AUDIT REST II F2). */
export function layoutFireCount(blocks, elite = false) {
  if (isPalaceLayout(blocks)) return 0;
  return dungeonFireCount((blocks ?? []).filter((b) => !isBorderBlock(b?.name)).length, elite);
}

/**
 * AUDIT REST-PARTY C6: THE LAW'S OTHER TWO INPUTS, read ONE way - the scene's and tools/dungeonFireProbe.mjs's, which
 * read them two ways and so could not say where the game stands its fires. `doors`: every action door (its model's
 * origin, at the block's) and every DungeonExit door (world/dungeonLayout.js isDungeonExitDoor - the layout's exit list
 * holds every door face its models carry, and only these leave, CRUX-DOOR), in the dungeon's frame. `existing`: the
 * layout's own fires at their FOOT - `hearths` the scene's `dungeonHearths` rows ({ x, y, z, foot }: an RDB flat's y is
 * its centre and `foot` half its height under it), the centre where no size was read; a fire the law placed (`placed`)
 * is never its own input.
 */
export function fireLayoutInputs(blocks, hearths) {
  // AUDIT REST II F7: a door is measured from where it IS - its face's centre under its matrix (player/enterExit.js
  // doorWorldPosition's reading, which every other reader of an exit door takes), not its model's origin, which can sit
  // metres off the opening; a door with no face of its own (an action door - a model; no `centre`) at its origin
  const at = (b, d) => {
    const p = d.centre ? transformPoint(d.matrix, d.centre.x, d.centre.y, d.centre.z) : [d.matrix[12], d.matrix[13], d.matrix[14]];
    return [p[0] + b.originX, p[1], p[2] + b.originZ];
  };
  const doors = (blocks ?? []).flatMap((b) => [
    ...(b?.layout?.actionDoors ?? []).map((d) => at(b, d)),
    ...(b?.layout?.exitDoors ?? []).filter(isDungeonExitDoor).map((d) => at(b, d)),
  ]);
  const existing = (hearths ?? []).filter((h) => h && !h.placed).map((h) => [h.x, h.lawFoot ?? h.foot ?? h.y, h.z]);   // AUDIT REST-PARTY C7: the classic foot - never a texture mod's
  return { doors, existing };
}

// AUDIT REST: every measure the choice compares is a SQUARED distance in plain arithmetic - Math.hypot's last bit differs
// between engines (and with its arguments' order), and a tie the hash breaks only on exact equality must be the same tie
// on every client. Thresholds are squared to match.
const d2 = (a, b) => { const x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2]; return x * x + y * y + z * z; };
/** The deep fire's measure: 3D, height counted twice. */
const deep = (a, b) => { const x = a[0] - b[0], y = 2 * (a[1] - b[1]), z = a[2] - b[2]; return x * x + y * y + z * z; };
const SQ = (m) => m * m;

/** The room's rays read the dungeon's own mesh (its 'dungeon' bucket) - never a door's or a platform's (PROF2's veins'
 *  rule, AUDIT 29 C3: a closed door's bucket exists only while shut, and the next stand would move the fire). */
const ONLY_DUNGEON = Object.freeze({ only: Object.freeze(['dungeon']) });
/** The bucket a floor must be (AUDIT REST-PARTY C4). */
const DUNGEON_BUCKET = 'dungeon';
/** AUDIT REST II: eight points `r` out round a spot - the four axis bearings, then the four diagonals - literals and one
 *  IEEE product (Math.SQRT1_2; no sine, whose last bit is an engine's own), in this fixed order on every client. */
const ringOf = (r) => { const d = r * Math.SQRT1_2; return Object.freeze([[r, 0], [-r, 0], [0, r], [0, -r], [d, d], [d, -d], [-d, d], [-d, -d]].map(Object.freeze)); };
/** The room's eight chest-height rays, unit [x, z] - ringOf's bearings (REST3 turned k * PI / 4 through Math.sin and
 *  Math.cos, an engine's own last bit in every diagonal ray, where the law must be one answer on every client). */
const ROOM_RAYS = ringOf(1);
/**
 * THE COLLIDER'S ANSWERS (player/collider.js): `floor` the first surface within DFIRE.floorM under a point a metre over
 * the candidate (its normal faces the ray, so a floor's ny is up); `room` a ceiling within DFIRE.ceilingM (inside a
 * room, never on its roof), no wall within DFIRE.roomM of eight chest-height rays and at least DFIRE.enclosedRays of
 * them meeting one within DFIRE.enclosedM (walls round it, not the void between rooms), and the body fits there
 * (findClearFloor's own test). The scene and tools/dungeonFireProbe.mjs cast these same rays.
 *
 * AUDIT REST II F4: AND A FLOOR LOOKS UP. The collider meets a face from either side and turns the normal it answers to
 * face the ray, so the ROOF of a closed room - its ceiling seen from the void between storeys - read as a floor (ny 1),
 * and a block's centre over it passed the ceiling and wall rays on the storey above's floor and the corridors round it.
 * A face's own winding says which way it looks (the world pass draws front faces alone - renderer.js frontFace - and
 * automapFloors.js reads a ceiling's facing the same way, DISC22-G): a ray that struck a face's back (`hit.back`) is on
 * a ceiling's top, never a floor.
 */
export function colliderFireProbe(collider) {
  return {
    // AUDIT REST-PARTY C4: the floor ray reads EVERY bucket and answers only when the first thing under the point is the
    // dungeon's own mesh. Read through to 'dungeon' alone, a marker on a lift's platform (a mover is a bucket of its
    // own, actionSystem addAction; a special door the same) landed its fire on the pit's floor under it. Still the same
    // answer on every client: the law runs once at the build, after every block's movers and doors are hung and before
    // a save or the room's memory moves one (applyWorld's restoreSaveData), so each bucket stands at its build pose.
    floor: (p) => {
      const from = [p[0], p[1] + 1, p[2]];
      const hit = collider.raycastHit(from, [0, -1, 0], DFIRE.floorM + 1);
      return Number.isFinite(hit?.dist) && hit.normal && !hit.back && hit.key === DUNGEON_BUCKET ? { y: from[1] - hit.dist, ny: hit.normal[1] } : null;   // AUDIT REST II F4: a face that looks up
    },
    room: (p) => {
      if (!Number.isFinite(collider.raycast([p[0], p[1] + 0.2, p[2]], [0, 1, 0], DFIRE.ceilingM, ONLY_DUNGEON))) return false;
      let walls = 0;
      for (const [dx, dz] of ROOM_RAYS) {
        const d = collider.raycast([p[0], p[1] + 0.9, p[2]], [dx, 0, dz], DFIRE.enclosedM, ONLY_DUNGEON);
        if (d < DFIRE.roomM) return false;
        if (Number.isFinite(d)) walls++;
      }
      return walls >= DFIRE.enclosedRays && collider.penetrationAt([p[0], p[1] + 0.05, p[2]]) < 0.03;
    },
  };
}

/** AUDIT REST-PARTY C3: the eight bearings the floor is sampled on round a spot, DFIRE.levelR out - and AUDIT REST II
 *  F4's eight more DFIRE.reachR out - ringOf's literals, so every client asks the same sixteen points. */
const LEVEL_RINGS = Object.freeze([...ringOf(DFIRE.levelR), ...ringOf(DFIRE.reachR)]);
/** AUDIT REST II F3: the spots a marker's fire may stand on, in order - DFIRE.ringM out, never the marker's own. */
const MARKER_RING = ringOf(DFIRE.ringM);
/**
 * AUDIT REST-PARTY C3: IS THE FLOOR LEVEL ALL ROUND `pos` (already on its floor)? One downward ray read a stair's tread
 * as a floor (a tread is flat: ny 1) and passed a ramp to 25.8 degrees, where 4.2 says "no stairs, no ramps". So the
 * floor is asked again on the eight bearings DFIRE.levelR out, each answer flat and within DFIRE.levelM of the centre's:
 * a stair's next tread (a rise), a ramp's next half metre (0.24 m at 25.8 degrees; 5 cm in half a metre is under six
 * degrees) and a ledge's drop all fail it, a landing or a room's floor never does. The scene's probe and the tool's
 * cast these rays as they cast the centre's (colliderFireProbe), so a lift under the ring refuses the spot too (C4).
 * AUDIT REST II F4: and again DFIRE.reachR out (roomM - 0.1). The wall rays are cast at chest height, so a table, a
 * plinth or a dais under them was "room", and a fixed treasure's fire stood on its tabletop: the floor is level a
 * hearth's width round it now, so a spot on furniture, a plinth or a ledge - or one hard by a table - is refused.
 */
function levelRound(probe, pos) {
  for (const [dx, dz] of LEVEL_RINGS) {
    const g = probe.floor([pos[0] + dx, pos[1], pos[2] + dz]);
    if (!g || !(g.ny > DFIRE.flatNy) || !(Math.abs(g.y - pos[1]) <= DFIRE.levelM)) return false;
  }
  return true;
}

/**
 * AUDIT REST II F3: each candidate's spots, in the order they are asked - a marker's the ring DFIRE.ringM out
 * (MARKER_RING: the axis bearings, then the diagonals), never the marker's own spot, where its pile, its quest's item or
 * foe, or the player's entry stands; any other candidate (a block's centre) its own.
 */
function candidateSpots(cands) {
  const out = [];
  for (const c of cands ?? []) {
    if (!c?.marker) { out.push({ c, at: c.pos }); continue; }
    for (const [dx, dz] of MARKER_RING) out.push({ c, at: [c.pos[0] + dx, c.pos[1], c.pos[2] + dz] });
  }
  return out;
}

/**
 * Land and keep: each candidate dropped onto its floor and kept only where every rule holds. `probe` is the scene's:
 * `floor(pos)` -> { y, ny } | null (the floor within DFIRE.floorM below, its normal's y), `room(pos)` -> bool (the
 * eight rays and findClearFloor). `doors`, `enemies` and `items` are positions in the dungeon's frame.
 * AUDIT REST II F3: a marker's candidate lands on the first spot of its ring that keeps every rule (candidateSpots), and
 * no spot - a block's centre's neither - stands within DFIRE.itemM of an item marker (`items`, itemMarks) on its storey.
 */
export function landCandidates(cands, { probe, doors = [], enemies = [], items = [] } = {}) {
  const out = [];
  let landed = null;   // the candidate whose spot was just kept: its later spots are not asked
  for (const { c, at } of candidateSpots(cands)) {
    if (c === landed) continue;
    const f = probe?.floor?.(at);
    if (!f || !Number.isFinite(f.y) || !(f.ny > DFIRE.flatNy)) continue;
    const pos = [at[0], f.y, at[2]];
    if (pos[1] < c.water + DFIRE.dryM) continue;
    if (doors.some((d) => d2(d, pos) < SQ(DFIRE.doorM))) continue;
    if (enemies.some((e) => SQ(e[0] - pos[0]) + SQ(e[2] - pos[2]) < SQ(DFIRE.enemyM) && Math.abs(e[1] - pos[1]) < DFIRE.storeyM)) continue;
    if (items.some((m) => SQ(m[0] - pos[0]) + SQ(m[2] - pos[2]) < SQ(DFIRE.itemM) && Math.abs(m[1] - pos[1]) < DFIRE.storeyM)) continue;   // AUDIT REST II F3: never on a pile, a quest's item or the way in
    if (!levelRound(probe, pos)) continue;   // AUDIT REST-PARTY C3: no stair, no ramp, no ledge
    if (!probe?.room?.(pos)) continue;
    out.push({ ...c, pos });
    landed = c;
  }
  return out;
}

/** AUDIT REST II F5: the fire of `list` nearest `p` - a tie to the lesser x, then y, then z, so the answer is the
 *  layout's and never its list's order. */
const nearestOf = (list, p) => list.reduce((best, q) => {
  if (!best) return q;
  const a = d2(q, p), b = d2(best, p);
  return a < b || (a === b && (q[0] < best[0] || (q[0] === best[0] && (q[1] < best[1] || (q[1] === best[1] && q[2] < best[2]))))) ? q : best;
}, null);

/**
 * THE CHOICE: the entrance fire, the deep fire, the spread. `valid` the landed candidates (layout order), `seed` the
 * dungeon's locationId, `existing` the layout's own fires' positions, `start` the start marker, `count` the fires to
 * stand. Returns `{ fires, doorFire }`: the chosen positions, in pick order - their index is the fire's key - and
 * (AUDIT REST II F5) the layout's fire taken for the entrance's (C5), or null where the law stood its own.
 */
export function chooseFirePlan(valid, { seed = 0, existing = [], start = null, count = DFIRE.min } = {}) {
  const pool = (valid ?? []).map((c, i) => ({ ...c, tie: hash32(seed >>> 0, i, 0x0f1e) }));
  const chosen = [];
  if (!pool.length || count <= 0) return { fires: [], doorFire: null };
  const better = (a, b, sa, sb) => (sa !== sb ? sa > sb : a.tie < b.tie);
  const take = (c) => { chosen.push(c); pool.splice(pool.indexOf(c), 1); };
  const clearOf = (p, list, m) => list.every((q) => d2(q, p) >= SQ(m));
  // 1. the entrance fire - unless the layout already stands one by the door in
  // AUDIT REST-PARTY C2: and never beside one the layout stands. The layout's fires were measured from the START alone,
  // so a brazier 26 m in let the law stand its fire a metre from it, and the fallbacks (the starting block's, then the
  // nearest anywhere) asked nothing at all - where 4.3 says "the law only adds where none stand". A candidate is the
  // entrance's only DFIRE.entranceM clear of every layout fire: the reach that makes a layout fire the door's own (the
  // test below) is the reach that makes a candidate one standing beside it. The deep fire and the spread keep their 80.
  const from = start ?? pool.find((c) => c.start)?.pos ?? pool[0].pos;
  const near = (list) => list.reduce((best, c) => (!best || better(c, best, -d2(c.pos, from), -d2(best.pos, from)) ? c : best), null);
  const clear = pool.filter((c) => clearOf(c.pos, existing, DFIRE.entranceM));
  const inReach = clear.filter((c) => d2(c.pos, from) <= SQ(DFIRE.entranceM));
  const first = near(inReach.length ? inReach : clear.filter((c) => c.start)) ?? near(clear);
  // ...and a layout fire within DFIRE.entranceM of the door - or nearer it than any clear candidate stands (the C2 rule
  // can send the pick past one; a brazier 25.5 m in is the door's fire, not a reason to light one 200 m in) - IS the
  // entrance fire. AUDIT REST-PARTY C5: and it counts. It stood for the entrance and the law still placed all N past it,
  // so a brazier by the door gave the dungeon N + 1 fires, and an elite - half, "at least one, the entrance's" - two deep
  // fires and none at the door. One fewer is placed: an elite of one stands its brazier and nothing more.
  const reach = Math.max(SQ(DFIRE.entranceM), first ? d2(first.pos, from) : Infinity);
  const doorFire = existing.some((q) => d2(q, from) < reach);
  // AUDIT REST II F5: ...and the law says WHICH (the nearest the door): the ward, the compass and the map read only what
  // it reports, so a brazier it adopted for the entrance's kept none of a campfire's promises
  const adopted = doorFire ? nearestOf(existing, from) : null;
  if (!doorFire) take(first);   // never null here: no clear candidate means a layout fire, and none is "nearer" than Infinity
  const want = doorFire ? count - 1 : count;
  const anchors = () => [...existing, ...chosen.map((c) => c.pos)];
  const anchorFrom = chosen[0]?.pos ?? from;
  // 2. the deep fire - the far reach, where the quest's target usually waits
  if (chosen.length < want) {
    const far = pool.filter((c) => clearOf(c.pos, anchors(), DFIRE.spacingM))
      .reduce((best, c) => (!best || better(c, best, deep(c.pos, anchorFrom), deep(best.pos, anchorFrom)) ? c : best), null);
    if (far) take(far);
  }
  // 3. the spread - a height band with candidates and no fire first, then farthest-point
  const band = (p) => Math.floor(p[1] / DFIRE.storeyM);
  while (chosen.length < want) {
    const open = pool.filter((c) => clearOf(c.pos, anchors(), DFIRE.spacingM));
    if (!open.length) break;
    const lit = new Set([...existing, ...chosen.map((c) => c.pos)].map(band));
    const unserved = open.filter((c) => !lit.has(band(c.pos)));
    const from2 = unserved.length ? unserved : open;
    const score = (c) => Math.min(...anchors().map((q) => d2(q, c.pos)));
    take(from2.reduce((best, c) => (!best || better(c, best, score(c), score(best)) ? c : best), null));
  }
  return { fires: chosen.map((c) => c.pos), doorFire: adopted && [adopted[0], adopted[1], adopted[2]] };
}
/** The choice's fires alone (chooseFirePlan). */
export const chooseFires = (valid, opts) => chooseFirePlan(valid, opts).fires;

/** THE WARD: is a spawn's spot (`{ x, y, z }`) within DFIRE.wardM of a placed fire? The bonfire's promise, not a
 *  guarantee - a layout foe can still walk up. */
export const inFireWard = (fires, spot) => !!spot && (fires ?? []).some((q) => SQ(q[0] - spot.x) + SQ(q[1] - spot.y) + SQ(q[2] - spot.z) < SQ(DFIRE.wardM));

/**
 * The whole law in one call, for the scene: `blocks` the layout's, `probe` the collider's answers, `doors` the
 * dungeon's door positions, `existing` its own fires, `seed` its locationId, `elite` an elite copy, `cold` a Super
 * dungeon (SD4a, bible/11-Multiplayer/Super-Dungeons.md section 5 - none, and the layout's own brazier by the door is
 * no campfire of the law's). An arena stands none (the caller says so); a palace none (AUDIT REST II F2,
 * layoutFireCount). Returns `{ fires, doorFire, candidates,
 * valid }`: the fires placed ([[x, y, z], ...], in pick order), the layout fire adopted as the entrance's or null (F5),
 * and the candidates' and the landed ones' counts (tools/dungeonFireProbe.mjs reports them off this one call).
 */
export function dungeonFirePlan({ blocks, probe, doors = [], existing = [], seed = 0, elite = false, cold = false } = {}) {
  if (cold) return { fires: [], doorFire: null, candidates: 0, valid: 0 };   // SD4a: a Super dungeon - the Hour is cold, no ray cast
  const count = layoutFireCount(blocks, elite);
  const cands = fireCandidates(blocks);
  const valid = count > 0 ? landCandidates(cands, { probe, doors, enemies: enemyMarks(blocks), items: itemMarks(blocks) }) : [];
  const { fires, doorFire } = chooseFirePlan(valid, { seed, existing, start: dungeonStart(blocks), count });
  return { fires, doorFire, candidates: cands.length, valid: valid.length };
}
/** The law's placed fires alone (dungeonFirePlan). */
export const placeDungeonFires = (o) => dungeonFirePlan(o).fires;
