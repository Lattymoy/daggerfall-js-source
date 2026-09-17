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
import { chooseRandomEnemy } from './encounters.js';
import { CLASSIC_MINUTES_PER_SECOND } from './worldTick.js';   // real-seconds -> game-minutes, so the cadence below can be stated in real play time

export const MIN_CAMP_SPAWN_DISTANCE = 14;   // a cluster wants more clearance than one foe
export const MAX_CAMP_SPAWN_DISTANCE = 26;

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
// loaded". The 5% CHANCE doesn't change - what changes is the CHECK: a
// player who explores gets a roll every new pixel entered, on top of
// (not instead of) the 15-real-minute timer below, so standing still
// in one place still gets checked and covering ground quickly gets
// checked more.
// Mac (2026-09-17): "set the camp encounter chance to 15% per chunk" -
// its own rate, separate from the timer's 5%, since a chunk is entered far
// more often than a 15-real-minute window comes around.
export const CAMP_CHANCE_ON_CHUNK_LOAD = 0.15;   // 15% per chunk entered
export const rollCampChanceOnChunkLoad = (roll01 = Math.random()) => roll01 < CAMP_CHANCE_ON_CHUNK_LOAD;

/** Whether IT IS THIS PLAYER'S TURN to roll, among every player within
 *  `radius` (world units - metres, this port's scale) of `myFeet`,
 *  including players outside this scene's own streamed cell (`peers`
 *  is `peersNear()`'s list, `{id, feet}` each, already converted into
 *  THIS frame's coordinates). The pick is deterministic and needs no
 *  message of its own: everyone in range computes the same comparison
 *  over the same roster and agrees on the same one lowest id, so
 *  exactly one of them proceeds and the rest return null before
 *  spending a roll at all. Offline (`myId` null, or no peers) always
 *  answers true - there is no one to defer to. */
export const GROUP_ROLL_RADIUS = 100;
export function amGroupRollOwner(myId, myFeet, peers, radius = GROUP_ROLL_RADIUS) {
  if (myId == null || !myFeet || !peers?.length) return true;
  const r2 = radius * radius;
  let lowest = String(myId);
  for (const p of peers) {
    if (p?.id == null || p.id === myId || !p.feet) continue;
    const dx = p.feet[0] - myFeet[0], dz = p.feet[2] - myFeet[2];
    if (dx * dx + dz * dz > r2) continue;
    const pid = String(p.id);
    if (pid < lowest) lowest = pid;
  }
  return lowest === String(myId);
}

/** The composition a hit rolls, shared by both entry points below -
 *  `rollCampEncounter` (the timer) and `rollCampEncounterOnChunkLoad`
 *  (a new pixel entered) differ only in what GATES the chance roll,
 *  never in what a hit is made of. */
function rollGroupComposition(ctx, rolls) {
  const timeOfDay = ctx.gameMinutes % 1440;
  const isDay = timeOfDay >= 360 && timeOfDay <= 1080;
  const kind = rollCampKind(rolls());
  const [lo, hi] = kind === 'camp' ? CAMP_SIZE : PACK_SIZE;
  const size = lo + Math.floor(rolls() * (hi - lo + 1));
  const mobileTypes = [];
  for (let i = 0; i < size; i++) {
    const m = chooseRandomEnemy({ ...ctx, isDay }, rolls);
    if (m !== -1) mobileTypes.push(m);
  }
  if (!mobileTypes.length) return null;   // an unknown climate, or a town's day - nothing to spawn
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
