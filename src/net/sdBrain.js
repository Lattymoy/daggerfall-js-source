// @ts-check
// SD5 (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 7): THE SHATTERED HOUR'S FRAME
// - where its stages stand, the one place both the client's made level (world/sdRealm.js) and the relay's judgements
// (the Orrery's reach, SD6; the Brass Remnant's arena, SD8) read them. Pure, no imports: the relay's bundle may take it
// whole.
//
// Metres, the dungeon's own frame: the realm's one made block at the grid's origin, the Threshold's centre at its middle
// (SD_REALM_ORIGIN), every floor's top at y 0, the stages laid along +z:
//
//   | stage                  | where (the realm's frame)   | what                                                    |
//   | THE THRESHOLD          | a disc at z 0, radius 8     | the landing; the way back through the Rift at its back  |
//   | the walk               | z 7 to 25, 4 m wide         | from the Threshold to the Orrery                        |
//   | THE ORRERY OF ENDINGS  | a disc at z 42, radius 18   | the puzzle hall (SD6) - z 24 to 60                      |
//   | THE UNMOORED STEPS     | z 60 to 190                 | the platforming course (SD7) - the void until then      |
//   | THE LAST MOMENT        | a disc at z 220, radius 26  | the boss's arena, four brass pillars (SD8) - z 194-246  |
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).

/** The Threshold's centre in the dungeon's frame: the made block's middle (RDB_SIDE / 2 either way), the floor at y 0. */
export const SD_REALM_ORIGIN = Object.freeze([25.6, 0, 25.6]);
/** The stages, in the realm's frame (x, z from SD_REALM_ORIGIN). */
export const SD_THRESHOLD = Object.freeze({ x: 0, z: 0, r: 8 });
export const SD_WALK = Object.freeze({ x: 0, z0: 7, z1: 25, halfW: 2 });
export const SD_ORRERY = Object.freeze({ x: 0, z: 42, r: 18 });
export const SD_STEPS = Object.freeze({ z0: 60, z1: 190 });
export const SD_ARENA = Object.freeze({ x: 0, z: 220, r: 26 });
/** The arena's four brass pillars: on its diagonals, this far from its centre, this thick and this tall. */
export const SD_PILLAR_R = 16;
export const SD_PILLAR_W = 1.6;
export const SD_PILLAR_H = 14;

/** A point in the realm's frame, in the dungeon's. */
export const realmToDungeon = (x, y, z) => [SD_REALM_ORIGIN[0] + x, SD_REALM_ORIGIN[1] + y, SD_REALM_ORIGIN[2] + z];
/** A point in the dungeon's frame, in the realm's. */
export const dungeonToRealm = (x, y, z) => [x - SD_REALM_ORIGIN[0], y - SD_REALM_ORIGIN[1], z - SD_REALM_ORIGIN[2]];
