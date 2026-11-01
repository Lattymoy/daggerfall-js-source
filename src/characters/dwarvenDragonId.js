// @ts-check
// DWARVEN-DRAGON: its numbers alone, a leaf, so the soul trap reads them without the install's imports (characters/dwarvenDragon.js).

/** Its enemy id: a monster (no 128 bit), past Enemy Expansion's 256-290 and 384-398. */
export const DWARVEN_DRAGON_ID = 512;
/** Its pictures' archive: past Enemy Expansion's 1500-1708, a stand-in (no TEXTURE file carries it). */
export const DWARVEN_DRAGON_ARCHIVE = 1800;
/** DRAGON7: the Aetherbright's pictures - 1800's under its own palette (characters/dwarvenDragonShiny.js), never a wash. */
export const AETHERBRIGHT_ARCHIVE = 1801;
/** The archive a dragon of `look` is drawn from: 1 the Aetherbright, anything else the brass - the boss's, a peer's
 *  rider's and the tamed mount's icon alike. @param {number | null | undefined} look */
export const dragonArchiveOf = (look) => (look === 1 ? AETHERBRIGHT_ARCHIVE : DWARVEN_DRAGON_ARCHIVE);
/** DRAGON-HOVER (2026-10-29): at rest in the air it hovers -
 *  records 20-24, eight frames a facing, the wings' beat and the body's bob on the mobile's RangedAttack1 table (it has no
 *  ranged blow of its own). Frames a second of that loop. */
export const DRAGON_HOVER_FPS = 10;
/** The hover's frame at `ms` on any clock - every screen the same loop. @param {number} ms */
export const dragonHoverFrame = (ms) => Math.floor((Math.max(0, ms) / 1000) * DRAGON_HOVER_FPS) % 8;
