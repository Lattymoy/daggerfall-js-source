// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LW4 / LW6 (bible/06-Systems/Living-World.md): THE FOES A PARTY ON THE ROAD MEETS - the host's `foesOf` for the living
// world's trouble (systems/livingWorld/trouble.js TroubleWorld): on the land the campers' themed group at the place the
// trouble falls (campEncounters.js rollGroupComposition - CAMP1's), at the party's level, sized to it; inside a dive's
// dungeon its type's own table (encounters.js chooseRandomEnemy, LW6).
//
// BAY-LEFT-GROUND (bible/06-Systems/Living-World-II.md; the audit "no system left behind in the Bay", D2): THE LAND'S OWN
// WILD PAST THE BAY. Every other encounter path hands the encounter law the pixel's zone's wild (`fauna`, systems/
// tamrielFauna.js faunaBandAt - TESA-BIOME's choice 4: a province's own beasts), and this one handed none, so a caravan in
// Black Marsh was beset out of Daggerfall's climate tables - Orcs and Centaurs in the swamp. The trouble now hands the
// place it falls (`px`, `py`) and the group is rolled on that pixel's wild. On the Bay a pixel is no zone's (faunaBandAt
// answers null) and the law reads the climate's band as it always did: the Bay's trouble the same, roll for roll.
//
// Moved out of world.js bootWorld (HOST-SPLIT) - its one producer, the roads' harness's too (test/lwRoads.mjs).
// ═══════════════════════════════════════════════════════════════════
import { rollGroupComposition } from '../../systems/campEncounters.js';
import { chooseRandomEnemy } from '../../systems/encounters.js';

/**
 * The trouble's `foesOf`: `{ climateIndex, px, py, dungeonType, minute, level, size, rolls }` -> mobile types, or null.
 * `faunaAt(px, py)` the pixel's zone's band (the composed maps' getFaunaBand - null on the Bay and at sea).
 * @param {{ faunaAt?: (px: number, py: number) => (number[] | null | undefined) }} [o]
 * @returns {(q: { climateIndex: number, px?: number, py?: number, dungeonType?: number, minute: number, level: number, size: number, rolls: () => number }) => (number[] | null)}
 */
export function troubleFoesOf({ faunaAt = () => null } = {}) {
  return ({ climateIndex, px, py, dungeonType, minute, level, size, rolls }) => (dungeonType != null
    ? Array.from({ length: size }, () => chooseRandomEnemy({ dungeonType, playerLevel: level }, rolls)).filter((m) => m >= 0)   // LW6: the deep's own
    : rollGroupComposition({ climateIndex, fauna: px != null && py != null ? faunaAt(px, py) : null, skyMinutes: minute, inLocationRect: false, playerLevel: level, size }, rolls)?.mobileTypes ?? null);
}
