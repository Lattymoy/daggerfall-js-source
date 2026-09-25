// GROUP ENCOUNTERS - camps and packs.
//
// This is an ORIGINAL addition, not a Daggerfall Unity or classic
// Daggerfall system, and not a port of any third-party mod: the game
// has always spawned wandering monsters ONE AT A TIME outdoors
// (systems/encounters.js, `intermittentEnemySpawn`). This module is a
// second, much rarer roll that places several at once, reusing that
// same system's tables and cadence law rather than inventing new
// ones - a camp or a pack is drawn from exactly the same per-climate,
// day/night encounter table a lone wanderer would be, just several
// times over.
//
// CAMP vs PACK is composition and spacing, not movement. This engine's
// monster AI is classic Daggerfall's: a foe stands until it notices
// the player, then it closes in - there is no wander or patrol state
// to hook a "roaming group" into, and building one would be a whole
// new steering system rather than a wilderness-encounter tweak. So a
// CAMP is a few enemies stood close together (a settled group); a
// PACK is a few enemies stood further apart (a group crossing your
// path); and what makes either feel like a GROUP rather than several
// unrelated spawns that happen to land near each other is the one new
// behaviour this module asks for: when one member notices the player,
// it wakes the rest (see scenes/exteriorFoes.js `wakeCampmates`).
//
// ONLINE: this rides the exact same call site and cadence as the
// single-encounter roll (scenes/world.js `runEncounterTick`), so
// whatever already makes that roll behave correctly online - host
// authority, the puppet wire to peers - covers this for free. There is
// no separate multiplayer path to get wrong here.
//
// TWO THINGS ONLINE STILL NEEDED THEIR OWN LAW, THOUGH (Mac, 2026-09-17):
// foe ownership here is PER PLAYER, not host-authoritative (each player
// streams their own spawns to nearby peers as puppets - see
// scenes/exteriorFoes.js's header) - so with no further care, three
// players standing together would each independently roll their own
// camp on the same check and the wilderness would fill with duplicate
// groups stacked on top of each other. `amGroupRollOwner` below is the
// guard: among every player within GROUP_ROLL_RADIUS of each other,
// exactly one - a deterministic pick every one of them computes the
// same way, so no election message ever has to cross the wire - proceeds
// with the roll at all. The other reason not to roll independently: this
// module's own contract is "well OUTSIDE camps has this roll go up" -
// a check duplicated across a party would silently double this
// section's frequency for anyone travelling together.
import { chooseRandomEnemy, resolveEncounterTableIndex } from './encounters.js';
import { ENCOUNTER_TABLES } from '../characters/encounterTables.js';
import { factionOf, SOLITARY_TYPES, NIGHT_ONLY_FACTIONS } from '../characters/mobileFactions.js';
import { CLASSIC_MINUTES_PER_SECOND } from './worldTick.js';   // real-seconds -> game-minutes, so the cadence below can be stated in real play time

// A camp/pack seed roll that lands on a SOLITARY type (Dragonling,
// Daedra, an Atronach, ...) gets this many extra tries at a normal
// roll before the group is abandoned outright. Those ids are exactly
// "way too high level" for a group: the single-encounter roll can
// still surface one alone (that's classic's own rare-surprise design,
// untouched), but a camp/pack must never be built around one, and
// with only a handful of chances to dodge it that top-tier roll
// (encounters.js's "roll > 95" branch) stays rare here same as it
// always was.
const MAX_SEED_ATTEMPTS = 4;

// CAMP-FAR (2026-09-24, Mac: "when stepping into a new chunk, enemy camps
// spawn immediately behind the player, which is far too sudden and
// overwhelming ... enemies should spawn at a distance of 100-150 meters
// away"). The band WAS 14-26 - a lone wanderer's own reach, doubled -
// and a group of five stood there on the frame of a pixel crossing is
// on top of the player before they have turned round. A camp is a
// thing you come across, so it is stood well out: a hundred to a
// hundred and fifty metres (world units are metres, this port's scale).
export const MIN_CAMP_SPAWN_DISTANCE = 100;   // a camp is come across, never landed on
export const MAX_CAMP_SPAWN_DISTANCE = 150;

/**
 * CAMP-FAR: WHERE THE ANCHOR STANDS, a pure law. DFU's ring
 * (`placeFoeFreely`, CreateFoe.cs) was built for a foe five to twenty
 * units off: it walks out from the player's own height and probes FOUR
 * units down for a floor, so at a hundred metres any real grade puts
 * the ground outside the probe and the group never stands. The far
 * anchor keeps the ring's bearing law - just outside the field of view
 * (FOV plus 0..4 degrees, a coin for the side), so the group does not
 * pop in on screen - takes one distance roll across the band, and asks
 * the TERRAIN for its floor: `groundAt(x, z)` is the host's own height
 * sampler (the exterior collider's `heightAt`), which answers -Infinity
 * off the built ground, and that answers null here. The members are
 * still stood around the anchor by the ring law, at the group's own
 * spacing, where the four-unit probe is the right size.
 *
 * Unity's forward is (sin yaw, 0, cos yaw), the same as the ring's.
 * @param {{feet:number[], yawRad:number, fovDegrees:number, groundAt:(x:number,z:number)=>number,
 *          minDistance?:number, maxDistance?:number, rolls?:() => number}} o
 * @returns {{x:number,y:number,z:number}|null}
 */
export function campAnchorSpot({ feet, yawRad, fovDegrees, groundAt, minDistance = MIN_CAMP_SPAWN_DISTANCE, maxDistance = MAX_CAMP_SPAWN_DISTANCE, rolls = Math.random, bearingDegrees = null }) {
  if (!feet || typeof groundAt !== 'function') return null;
  // CAMP-RING: a group handed its own bearing (campGroupBearings - one of several groups spread
  // round the player) stands on that bearing, jittered two degrees either way; a lone group keeps
  // the old law - just outside the view, a coin for the side.
  let yawDegrees;
  if (Number.isFinite(bearingDegrees)) {
    yawDegrees = bearingDegrees + rolls() * 4 - 2;
  } else {
    const side = fovDegrees + rolls() * 4;
    yawDegrees = rolls() > 0.5 ? -side : side;
  }
  const yaw = yawRad + yawDegrees * Math.PI / 180;
  const dist = minDistance + rolls() * (maxDistance - minDistance);
  const x = feet[0] + Math.sin(yaw) * dist;
  const z = feet[2] + Math.cos(yaw) * dist;
  const y = groundAt(x, z);
  if (!Number.isFinite(y)) return null;   // off the built ground: no spot this try
  return { x, y, z };
}

// CAMP-SIGHT (2026-09-25, Mac: "reduce the sight radius to 60"): a wilderness camp's members see
// 60 metres, not DFU's 102.4 - so a group stood 100-150 m out never spots the player on the frame
// it appears, and a camp can be approached before it notices. Every other foe keeps SIGHT_RADIUS.
export const CAMP_SIGHT_RADIUS = 60;

export const CAMP_SIZE = Object.freeze([3, 5]);   // inclusive
export const PACK_SIZE = Object.freeze([2, 4]);
export const CAMP_SPACING = 3;     // metres between members - tight, a settled group
export const PACK_SPACING = 6;     // metres between members - loose, a group in transit
export const CAMP_ALERT_RADIUS = CAMP_SPACING * 3;
export const PACK_ALERT_RADIUS = PACK_SPACING * 2;

// Mac (2026-09-17): "every 15 minutes so it doesn't feel so empty" - REAL
// minutes of actual play, not the game clock's own hour: the game clock
// only advances 12 minutes per real minute (CLASSIC_MINUTES_PER_SECOND,
// classic Daggerfall's own compression, ported verbatim), so a window
// stated in game-minutes alone would drift out of what a real 15-minute
// play session feels like. 15 * 60 * (12/60) = 180 game-minutes.
export const CAMP_WINDOW_REAL_MINUTES = 15;
export const CAMP_WINDOW_MINUTES = CAMP_WINDOW_REAL_MINUTES * 60 * CLASSIC_MINUTES_PER_SECOND;   // 180
export const campWindowOpen = (gameMinutes) => Math.floor(gameMinutes) % CAMP_WINDOW_MINUTES === 0;

// Mac (2026-09-17): "every 15 minutes guaranteed the rest based on
// chance... like 5% chance" - a CHECK on a reliable real-time cadence,
// not a guaranteed spawn: every 15 real minutes of actual play (180
// game-minutes - CAMP_WINDOW_REAL_MINUTES's own math, below), a 5%
// roll decides whether a group actually appears. A flat check cadence
// rather than the classic wandering-monster system's rare-window-times-
// rare-roll, so the frequency is exactly what it reads as: about one
// group appears per (15 / 0.05) = 300 real minutes of play on average,
// not buried under a second, harder-to-reason-about layer of odds.
// Mac (2026-09-17): "every 15 minutes it should happen guaranteed
// additionally" - the timer check is no longer a chance at all, it's the
// FLOOR: a group is guaranteed every 15 real minutes, on top of the
// separate 15%-per-chunk roll above. CAMP_CHANCE/rollCampChance are kept
// (still exported, still correct) for anything that wants a lower-than-
// guaranteed timer rate later; the timer path below no longer calls them.
export const CAMP_CHANCE = 0.05;
export const rollCampChance = (roll01 = Math.random()) => roll01 < CAMP_CHANCE;
export const rollCampKind = (roll01 = Math.random()) => (roll01 < 0.5 ? 'camp' : 'pack');

// Mac (2026-09-17): "this should always happen when loading world chunks
// if it works like that" - it does: scenes/world.js's floating-origin
// streaming fires a `pixelChanged` event each time the player crosses
// into a new map pixel (819.2 scene units on a side - world/streamingWorld.js's
// own header), which is this port's nearest thing to "a new chunk
// loaded". A player who explores gets a roll every new pixel entered.
//
// CAMP-NOTIMER (2026-09-19, Lost's package): scenes/world.js - the real
// streaming open world - dropped the 15-real-minute guaranteed timer
// trigger entirely, so this chunk-load roll is now that host's ONLY
// camp/pack trigger. The rate stays where Mac set it (2026-09-17: "set
// the camp encounter chance to 15% per chunk") rather than dropping to
// match the timer's 5%: a chunk is entered far less often than a
// background timer ticks, so carrying the whole load alone at the
// higher figure is what keeps the frequency the host had before.
//
// BOTH entry points stay exported. scenes/exterior.js is the fixed
// single-location preview host (`?exterior`/`?region=`/`?loc=`) with no
// chunk streaming to hang a roll off, so the timer below is the only
// trigger it can have, and it still calls it.
//
// CAMP-RING (2026-09-25): the chance is 50% per chunk entered, and a hit stands THREE groups at
// once, spread round the player a hundred to a hundred and fifty metres out (campGroupBearings).
export const CAMP_CHANCE_ON_CHUNK_LOAD = 0.50;   // 50% per chunk entered
export const rollCampChanceOnChunkLoad = (roll01 = Math.random()) => roll01 < CAMP_CHANCE_ON_CHUNK_LOAD;
/** CAMP-RING: how many groups one chunk-load hit stands. */
export const CAMP_GROUPS_ON_CHUNK_LOAD = 3;

/**
 * CAMP-RING: bearings (degrees off the player's facing, clockwise from above - Unity's yaw) for
 * the groups of one hit. Mac, 2026-09-25: "one in front of me, one right and one left" - so the
 * three stand ahead, to the right and to the left, 90 degrees apart. Ahead is IN view: at 100-150
 * metres that group is seen standing there, which is the point. More than three groups continue
 * round the circle evenly; `fovDegrees` is kept for the call shape and not read.
 */
export const CAMP_GROUP_BEARINGS = Object.freeze([0, 90, 270]);   // front, right, left
export function campGroupBearings(fovDegrees, n = CAMP_GROUPS_ON_CHUNK_LOAD) {
  void fovDegrees;
  if (n <= CAMP_GROUP_BEARINGS.length) return CAMP_GROUP_BEARINGS.slice(0, Math.max(1, n));
  return Array.from({ length: n }, (_, k) => (k * 360) / n);
}

/** Whether IT IS THIS PLAYER'S TURN to roll, among every player within
 *  `radius` (world units - metres, this port's scale) of `myFeet`,
 *  including players outside this scene's own streamed cell (`peers`
 *  is `peersNear()`'s list, `{id, feet}` each, already converted into
 *  THIS frame's coordinates). The pick is deterministic and needs no
 *  message of its own: greedy by id over everyone this client can place
 *  (AUDIT PSCALE1 COUNT-5) - the lowest id rolls, and each next id rolls
 *  unless a roller already chosen stands within `radius` of it - so a
 *  group within reach of one another agrees on its one lowest id, and a
 *  chain elects its lowest end AND whoever stands out of that roller's
 *  reach. PSCALE1's lone-wanderer roll passes the partymates alone
 *  (world.js runEncounterTick); the camps pass every peer. Offline
 *  (`myId` null, or no peers) always answers true - there is no one to
 *  defer to. */
export const GROUP_ROLL_RADIUS = 100;
export function amGroupRollOwner(myId, myFeet, peers, radius = GROUP_ROLL_RADIUS) {
  if (myId == null || !myFeet || !peers?.length) return true;
  const r2 = radius * radius;
  const me = String(myId);
  const near = (a, b) => { const dx = a[0] - b[0], dz = a[2] - b[2]; return dx * dx + dz * dz <= r2; };
  // AUDIT PSCALE1 COUNT-5: GREEDY BY ID, over everyone this client can place. The lowest id rolls; each next id rolls
  // unless a roller already chosen stands within `radius` of it. Deferring to ANY lower id within reach let a chain
  // (A, B, C sixty apart, ids ascending) elect A alone, and C - 120 from A - met nothing: A's wanderers stand at A.
  const all = [{ id: me, feet: myFeet }];
  for (const p of peers) if (p?.id != null && String(p.id) !== me && Array.isArray(p.feet)) all.push({ id: String(p.id), feet: p.feet });
  all.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const rollers = [];
  for (const p of all) {
    const taken = rollers.some((r) => near(r.feet, p.feet));
    if (p.id === me) return !taken;
    if (!taken) rollers.push(p);
  }
  return true;
}

/** The composition a hit rolls, shared by both entry points below -
 *  `rollCampEncounter` (the timer) and `rollCampEncounterOnChunkLoad`
 *  (a new pixel entered) differ only in what GATES the chance roll,
 *  never in what a hit is made of.
 *
 *  THEMED, not independent: the old version called chooseRandomEnemy
 *  once per member with no relation between the picks, so nothing
 *  stopped e.g. three unrelated tiers of monster - or a roll that hit
 *  encounters.js's rare top-of-table branch more than once - from
 *  landing in the same "group". Now exactly ONE seed member is drawn
 *  the normal way (so the usual climate/day-night/level odds still
 *  decide whether a group happens at all and how tough it opens at),
 *  and every other member is drawn from THAT SAME climate table,
 *  filtered down to the seed's faction (mobileFactions.js) - so a
 *  camp reads as "a knot of bandits", "an orc raiding party", "a
 *  cluster of spiders", never a grab-bag, and a table entry that was
 *  never in that climate's list to begin with still can't appear. */
function rollGroupComposition(ctx, rolls) {
  const timeOfDay = ctx.gameMinutes % 1440;
  const isDay = timeOfDay >= 360 && timeOfDay <= 1080;
  const rollCtx = { ...ctx, isDay };

  // Seed roll: same odds as a lone wanderer would get, but re-rolled
  // away from SOLITARY types (never forced into a group), and away
  // from a NIGHT_ONLY faction caught out by daylight, up to
  // MAX_SEED_ATTEMPTS times before giving up on a group this tick.
  let seed = -1;
  for (let attempt = 0; attempt < MAX_SEED_ATTEMPTS; attempt++) {
    const m = chooseRandomEnemy(rollCtx, rolls);
    if (m === -1) return null;   // an unknown climate, or a town's day - nothing to spawn at all
    if (SOLITARY_TYPES.has(m)) continue;
    if (isDay && NIGHT_ONLY_FACTIONS.has(factionOf(m))) continue;
    seed = m;
    break;
  }
  if (seed === -1) return null;   // kept landing on a bad-fit type - no group this time

  const kind = rollCampKind(rolls());
  const [lo, hi] = kind === 'camp' ? CAMP_SIZE : PACK_SIZE;
  const size = lo + Math.floor(rolls() * (hi - lo + 1));
  const mobileTypes = [seed];

  // The theme pool: every id in THIS SAME climate/day-night table that
  // shares the seed's faction. Still just that one table - climate and
  // time-of-day are exactly as restrictive as they were before this
  // change - only now narrowed to "things that belong with the seed".
  const theme = factionOf(seed);
  const tableIdx = resolveEncounterTableIndex(rollCtx);
  const table = tableIdx != null ? ENCOUNTER_TABLES[tableIdx] : null;
  const pool = theme && table ? table.filter((id) => factionOf(id) === theme) : [];

  for (let i = 1; i < size; i++) {
    // No theme-mates available in this climate's table (a lone
    // faction member is all it offers) - fill out the group with more
    // of the seed itself rather than reaching outside the theme.
    mobileTypes.push(pool.length ? pool[Math.floor(rolls() * pool.length)] : seed);
  }

  return {
    kind, mobileTypes,
    spacing: kind === 'camp' ? CAMP_SPACING : PACK_SPACING,
    alertRadius: kind === 'camp' ? CAMP_ALERT_RADIUS : PACK_ALERT_RADIUS,
    minDistance: MIN_CAMP_SPAWN_DISTANCE, maxDistance: MAX_CAMP_SPAWN_DISTANCE,
  };
}

/** The wilderness/town gate both entry points share - camps are a
 *  wilderness thing, so an indoor tick or a town's rect returns null
 *  before either roll is spent, same as before. Group ownership is
 *  NOT checked here: the caller (scenes/world.js) checks
 *  `amGroupRollOwner` itself, before EITHER of these is even called,
 *  so a losing player never reaches this module at all for the tick. */
const campGateOk = (ctx) => !(ctx.inside || ctx.inLocationRect || ctx.preventEnemySpawns);

/**
 * A group encounter, as a pure decision - mirrors
 * `intermittentEnemySpawn`'s own shape and calling convention: run once
 * per elapsed game minute, right after the single-encounter roll so the
 * two never both fire in the same minute (the caller should only reach
 * this when that roll came back empty). Returns null, or:
 *   { kind: 'camp'|'pack', mobileTypes: [...], spacing, alertRadius,
 *     minDistance, maxDistance }
 *
 * ctx is `chooseRandomEnemy`'s own ctx (climateIndex, playerLevel, ...)
 * plus { inside, inLocationRect, gameMinutes, preventEnemySpawns } -
 * camps are a wilderness thing, so both an indoor tick and a town's
 * ring return null before any roll is spent.
 */
export function rollCampEncounter(ctx, rolls = Math.random) {
  if (!campGateOk(ctx)) return null;
  if (!campWindowOpen(ctx.gameMinutes)) return null;
  // GUARANTEED: no chance check here any more - every open window (once
  // per 15 real minutes) spawns a group. See the header note above.
  return rollGroupComposition(ctx, rolls);
}

/** The chunk-load twin: same chance, same composition, no time gate at
 *  all - the caller's own `pixelChanged` event IS the cadence. */
export function rollCampEncounterOnChunkLoad(ctx, rolls = Math.random) {
  if (!campGateOk(ctx)) return null;
  if (!rollCampChanceOnChunkLoad(rolls())) return null;
  return rollGroupComposition(ctx, rolls);
}

/** CAMP-RING: the chunk-load roll that stands SEVERAL groups. One chance roll for the chunk; on a
 *  hit, each group rolls its own composition (so one can be bandits and the next wolves) and
 *  takes its own bearing round the player. Null on a miss, else the non-empty list of groups. */
export function rollCampEncountersOnChunkLoad(ctx, rolls = Math.random, { groups = CAMP_GROUPS_ON_CHUNK_LOAD, fovDegrees = 60 } = {}) {
  if (!campGateOk(ctx)) return null;
  if (!rollCampChanceOnChunkLoad(rolls())) return null;
  const bearings = campGroupBearings(fovDegrees, groups);
  const out = [];
  for (let g = 0; g < groups; g++) {
    const hit = rollGroupComposition(ctx, rolls);
    if (hit) out.push({ ...hit, bearingDegrees: bearings[g] });
  }
  return out.length ? out : null;
}
