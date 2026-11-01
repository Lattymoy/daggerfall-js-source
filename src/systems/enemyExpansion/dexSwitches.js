// WHICH ENEMY TABLES ARE LOADED FOR THE GAME, for the leaves that cannot import an install. Daggerfall Enemy Expansion's switch, and our meaner monsters for it (dexMeaner.js), which took the place of Ralzar's
// MUDEX 1.0.1. Meaner Monsters' own Init finds DEX by its GUID and asks the player to swap it ("Please switch to MUDEX", MeanerMonsters.cs:159-164); the port makes the swap - no switch of its own (MM1: no
// compatibility switches between mods), Meaner Monsters' switch beside DEX's turns ours on:
//   - DEX loaded and Meaner Monsters on at the game's load: ours are loaded (DEX's install latches them), and read
//     after DEX's own tables (dexInstall.js);
//   - DEX loaded: Meaner Monsters' own rows, its sprites' scales and PCAAO's edit of it stand aside - ours are the
//     meaner monsters for that mod;
//   - DEX not loaded: Meaner Monsters is itself.
// A switch flipped mid-game waits for the next load, as DEX's does. A LEAF but for the settings store.

import { modSetting, modLatchedOn } from '../modSettings.js';

export const DEX_VENDOR = 'daggerfall-enemy-expansion';
/** The latch our meaner monsters are loaded under - Meaner Monsters' switch beside DEX's, not a mod of its own. */
export const DEX_MEANER_LATCH = 'dexMeaner';

/** DEX as loaded for this game: the latch its install set, else (before the install, or in a test) its switch. */
export const dexLoaded = () => modLatchedOn(DEX_VENDOR) ?? modSetting(DEX_VENDOR, 'Enabled') === true;

/** Our meaner monsters as loaded for this game: the latch DEX's install sets (DEX loaded, Meaner Monsters on); before
 *  it, none. */
export const dexMeanerLoaded = () => modLatchedOn(DEX_MEANER_LATCH) === true;

/** Meaner Monsters as itself - its rows, its xml, PCAAO's edit of it: its switch `on`, and DEX's install has not
 *  loaded DEX beside it. The latch alone, as ours: the boot installs DEX before any foe is minted, and a game (or a
 *  test) that never ran the install has none of ours to stand in for this mod. */
export const meanerMonstersAlone = (on) => !!on && modLatchedOn(DEX_VENDOR) !== true;
