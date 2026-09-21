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
export const respawnHealth = (maxHealth) => Math.max(1, Math.floor((maxHealth ?? 0) * RESPAWN_HEALTH_FRACTION));

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
