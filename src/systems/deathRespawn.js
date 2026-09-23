// ONLINE DEATH: RESPAWN INSTEAD OF LOAD (D-ONLINE1).
//
// Classic Daggerfall single-player death: PlayerDeath's 3-second fall
// and fade, then straight to the title menu - "you die, you load a
// save" (scenes/shared.js endRunToTitleMenu). That is the wrong cost
// for an online session: the rest of the party is still playing, and
// ending the whole run - or reloading a save that unwinds everyone's
// progress - is not what one death in co-op should mean.
//
// So in online play this REPLACES that ending: the same death
// sequence plays (the camera sink, the fade, the sound), then instead
// of the death video and the title menu, the player wakes up at the
// nearest fitting safe point - a temple, a town, a graveyard, or (if
// they died underground) the dungeon's own door - with a short line
// of flavor text saying so, and a fraction of their health back.
//
// This is an ORIGINAL addition, not a DFU or classic system. It reuses
// the SAME teleport core the vampire-turn cemetery transfer already
// rides (scenes/world.js `_teleportToPixel`, `transferToCemeteryArm`'s
// exact pattern - a random cemetery in the CURRENT region, off the
// same mapTable this module searches) - no new teleport machinery,
// just a different, distance-based pick of where to land, and three
// kinds to choose among instead of one.
import { LOCATION_TYPES, DUNGEON_TYPES, longitudeLatitudeToMapPixel } from '../formats/mapsFile.js';
import { cureAllOfKind } from './effects.js';   // DEATHLOOP1

const SAFE_KINDS = Object.freeze([
  { kind: 'temple', match: (e) => e.locationType === LOCATION_TYPES.ReligionTemple },
  { kind: 'city', match: (e) => e.locationType === LOCATION_TYPES.TownCity
    || e.locationType === LOCATION_TYPES.TownHamlet || e.locationType === LOCATION_TYPES.TownVillage },
  // The same subtype `randomCemeteryLocationIndex` reads (systems/infection.js) -
  // a GRAVEYARD location whose dungeonType is specifically the small Cemetery,
  // not the other dungeon shapes a Graveyard-type location can carry.
  { kind: 'graveyard', match: (e) => e.locationType === LOCATION_TYPES.Graveyard && e.dungeonType === DUNGEON_TYPES.Cemetery },
]);

/**
 * The nearest of the three safe kinds to a map pixel, searched over the
 * CURRENT region's own mapTable - the same single-region scope
 * `transferToCemeteryArm` already accepts for a cemetery alone (a
 * region runs to hundreds of map pixels; a same-region nearest almost
 * always finds something, and a location across a region seam would
 * not read as "close" to anyone). Returns { kind, locationIndex,
 * mapPixel } or null when the region carries none of the three at all
 * - vanishingly rare, but not a throw; the caller falls back to
 * whatever it already had (see respawnOnlinePlayer's own fallback).
 */
export function nearestSafeLocation(mapTable, mapPixelXY) {
  let best = null;
  let bestDist = Infinity;
  for (let i = 0; i < (mapTable?.length ?? 0); i++) {
    const e = mapTable[i];
    if (!e) continue;
    const found = SAFE_KINDS.find((t) => t.match(e));
    if (!found) continue;
    const px = longitudeLatitudeToMapPixel(e.longitude, e.latitude);
    const dx = px.x - mapPixelXY.x, dz = px.y - mapPixelXY.y;
    const d2 = dx * dx + dz * dz;
    if (d2 < bestDist) { bestDist = d2; best = { kind: found.kind, locationIndex: i, mapPixel: px }; }
  }
  return best;
}

const FLAVOR = Object.freeze({
  temple: [
    'The temple priests found you at death\u2019s door and pulled you back through it. You wake on cool stone, a healer\u2019s hand still warm on your chest.',
    'The Divines were not ready for you yet. You wake on the temple steps, the chanting still fading from your ears.',
  ],
  city: [
    'You wake in an alley just outside the gates, alive against the odds and no idea how you got here.',
    'A passing guard found you and dragged you to the city gate. You come to just outside the walls, owing him one.',
  ],
  graveyard: [
    'You claw your way up through loose earth - not your grave, not yet.',
    'You wake among the headstones, cold and very much alive, brushing the dirt from your clothes.',
  ],
  dungeon: [
    'You wake in the open air, the dungeon door standing behind you and no memory of the walk out.',
    'Something dragged you out before the dark could keep you. You come to just outside the entrance.',
  ],
});

/** One flavor line for the kind that took the player back - `roll`
 *  injectable so a test can pin the pick. */
export function respawnFlavorText(kind, roll = Math.random) {
  const pool = FLAVOR[kind] ?? FLAVOR.city;
  return pool[Math.min(pool.length - 1, Math.floor(roll() * pool.length))];
}

// How much health a respawn leaves the player with - not full (a
// death online should still cost something) and not none (they need
// to be able to walk away from whatever killed them).
export const RESPAWN_HEALTH_FRACTION = 0.5;
export const respawnHealth = (maxHealth) => {
  // MAC-D3: ...and it answers a LIVING number for any input. A
  // corrupt or absent maxHealth used to come back through
  // Math.max(1, NaN), which is NaN - and a NaN health is neither
  // alive (health > 0 is false) nor dead (health <= 0 is false), so
  // the player stands up with a health bar that no comparison can
  // ever satisfy. One is the floor for everything that is not a
  // usable number.
  const m = Number.isFinite(maxHealth) ? maxHealth : 0;
  return Math.max(1, Math.floor(m * RESPAWN_HEALTH_FRACTION));
};

// ONLINE-UNDERGROUND-LOAD1 (Lost, 2026-09-19: "online mode only saves the game if you close it - when closed in a
// dungeon it should spawn you near a city, graveyard, temple etc when loading into an online game again").
//
// Online, leaving the page saves every slot the character has (world.js's beforeunload arm), and a save made
// underground is keyed `dungeon:<id>` with the dungeon's own map pixel in its envelope (dungeonContext's
// dungeonHome). Loading it used to put the player back inside that dungeon, at the saved spot. Online the boot load
// now takes the SAME search a death takes - the nearest temple, town or graveyard, over the region the dungeon
// stands in - and lands on that place's start marker. Not a death: no health is taken and no line about dying is
// said (the wake lines below are their own pool, not FLAVOR's).
//
// The one dungeon this never applies to is the tutorial's (D-ONLINE2's own reading: it is the one door out that is
// not a mercy) - that exception is the CALLER's, because it is read off the configured start cell, which is a
// setting and not this module's business.

/** Where an online load lands a character saved underground: the nearest safe place to the dungeon's pixel, or,
 *  when the region carries none of the three, the dungeon's own door (the pixel itself). `kind` names the place. */
export function undergroundWakeSpot(mapTable, pixel) {
  const safe = nearestSafeLocation(mapTable, pixel);
  return safe
    ? { kind: safe.kind, mapPixel: safe.mapPixel }
    : { kind: 'dungeon', mapPixel: { x: pixel.x, y: pixel.y } };
}

const WAKE_FLAVOR = Object.freeze({
  temple: 'You went to sleep underground and wake on the temple steps - someone carried you out while you were away.',
  city: 'You went to sleep underground and wake just outside the city gate - someone carried you out while you were away.',
  graveyard: 'You went to sleep underground and wake among the headstones - someone carried you out while you were away.',
  dungeon: 'You went to sleep underground and wake outside the dungeon door - someone carried you out while you were away.',
});

/** The one line said when an online load wakes a character above ground; an unknown kind reads as the city's. */
export const undergroundWakeText = (kind) => WAKE_FLAVOR[kind] ?? WAKE_FLAVOR.city;


// ── DEATHLOOP1: A REVIVAL HAS TO END WHAT KILLED THEM ────────────
//
// SquidKamer on Discord (2026-09-22): "Respawn after poison and likely
// disease and other things can cause a deathloop. Probably should do
// something about that. Its basically permanent death for your
// character." He is right, and MAC-D3 did not cover it: that fix put
// the heal FIRST so no frame could see a dead player with no death
// screen, which closed the window between reviving and landing. This
// is the other half - the health comes back and THE CAUSE DOES NOT
// GO AWAY. A poisoned character wakes at half health, the poison ticks
// them straight back to zero, and the respawn runs again, for ever.
//
// So: every path that puts a living player back into the world ends
// the drains that are still running. It is not a general cure, and the
// line is drawn on RATE, because that is what decides whether a
// revival is real:
//
//   CLEARED - poison, continuous damage, and health transfer. These
//   tick on the combat round, so they empty a half-full health bar in
//   seconds. Leaving them running makes the revival a lie: the player
//   never gets far enough to do anything about them.
//
//   KEPT - diseases, infections included. A disease's HEA column falls
//   ONCE PER CLASSIC DAY (systems/diseases.js - `data.HEA && sinks.hurt`),
//   so half of max health is days of walking, which is enough to reach
//   the temple that cures it. And they must be kept for a second
//   reason that is not about rate at all: vampirism and lycanthropy
//   are carried as `kind: 'disease'` entries (systems/infection.js),
//   so a blanket cure here would let a player shake off an infection
//   by dying on purpose - the cheapest cure in the game, at a
//   graveyard, for free. Paralysis is kept for the same rate reason:
//   it does not drain anything, and it wears off.
//
// A revival that lands somewhere safe is the whole promise of the
// online death. This is what makes the promise true.
export const LETHAL_DRAINS = Object.freeze(['poison', 'continuousDamage', 'transferHealth']);

/** End the drains that would empty the bar again before the player can
 *  act. Answers the kinds it actually removed, so a caller can say so
 *  and a pin can read it. */
export function endLethalDrains(entity) {
  const had = new Set((entity?.activeEffects ?? []).map((a) => a?.kind));
  const cleared = LETHAL_DRAINS.filter((k) => had.has(k));
  for (const kind of cleared) cureAllOfKind(entity, kind);
  return cleared;
}

/**
 * DEATHLOOP2 (2026-09-22, DragynDance on Discord: "my game keeps
 * spamming a wailing sound at me", with "I almost died in privateers
 * hold due to freezing to death" and "as soon as I stepped outside my
 * health bar started draaaaining").
 *
 * THE WAILING IS THE DEATH SOUND, ONE PER LOOP. PlayerDeathSequence
 * plays the character's own Pain3 in its CONSTRUCTOR, and every host
 * builds a fresh DeathScreen each time death is raised (all four are
 * guarded against STACKING one over another, so it is not that) - so a
 * player who dies, revives and dies again hears the wail once per turn
 * of the loop, with the survival notices behind it.
 *
 * AND DEATHLOOP1 ONLY CLOSED HALF OF IT. That fix ended the `poison`,
 * `continuousDamage` and `transferHealth` entries still draining the
 * bar - effects on the entity - and stopped there. The cold is not an
 * effect: survival/needs.js computes the felt temperature fresh every
 * tick from the climate, the month, the hour, the weather, what is
 * worn, how WET it is, and the race (an Argonian carries RACE_TEMP
 * -10, the coldest of the eight), and its harm is DELIBERATELY LETHAL
 * - needs.js says so where the floor is withheld: "the bare-skin harms
 * leave the last five points BECAUSE they are not meant to kill, and
 * this one is."
 *
 * That lethality is the design and is left alone. What is not the
 * design is the LOOP: a character revived at half health in the same
 * weather, still soaked, with the exposure counter still full, takes
 * the same killing tick again before they can walk anywhere. So the
 * revival clears the two survival fields that CARRY the death across
 * it - the accumulated `exposure` and the `wet` that is defeating the
 * clothes - exactly as it clears a poison, and for the same reason.
 * Neither is the weather: step back out into a mountain night in a
 * loincloth and it will kill you again, which is the system working.
 */
export const REVIVED_SURVIVAL_RESET = Object.freeze({ exposure: 0, wet: 0 });

/** Clear the stored survival state that would re-kill on the next harm
 *  tick. Answers the fields it actually reset. */
export function endLethalExposure(entity) {
  const s = entity?.survival;
  if (!s || typeof s !== 'object') return [];
  const cleared = [];
  for (const [k, v] of Object.entries(REVIVED_SURVIVAL_RESET)) {
    if ((s[k] ?? 0) !== v) { s[k] = v; cleared.push(k); }
  }
  return cleared;
}

/** THE ONE REVIVAL. Health back to the respawn fraction if they are at
 *  or below zero, and the fast drains ended - in that order, and
 *  together, because either alone is the bug: health with the poison
 *  still on is SquidKamer's loop, and a cure with no health is a
 *  corpse that cannot be hurt any further.
 *
 *  `force` re-asserts the health even on a living entity (the respawn
 *  path pays the death's cost up front); without it an already-living
 *  player keeps the health they have, which is what a prison release
 *  wants - it is not a free heal, it is a floor under zero. */
export function reviveForPlay(entity, { force = false } = {}) {
  if (!entity) return { revived: false, cleared: [] };
  const dead = !(entity.health > 0);
  if (dead || force) entity.health = respawnHealth(entity.maxHealth);
  // DEATHLOOP2: the effects AND the exposure. Either alone leaves a
  // loop - the poison one for a poisoned character, the cold one for a
  // freezing one, and the second is what a player actually reported.
  return { revived: dead || force, cleared: endLethalDrains(entity), exposure: endLethalExposure(entity) };
}
