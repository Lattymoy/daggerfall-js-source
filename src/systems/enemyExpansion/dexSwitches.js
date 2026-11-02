// MUDEX1 (2026-10-20, Mac: "We need to make everything compatible. No if ands or vutts", then "Approve MUDEX") - WHICH
// ENEMY MODS ARE LOADED FOR THE GAME, for the leaves that cannot import an install. Daggerfall Enemy Expansion's switch,
// and MUDEX's: Ralzar's "Meaner Unleveled Daggerfall Enemy Expansion" (vendor/mudex), the form of Meaner Monsters its
// author made for a game with DEX in it. Meaner Monsters' own Init finds DEX by its GUID and asks the player to make
// the swap ("Please switch to MUDEX", MeanerMonsters.cs:159-164); the port makes it - no switch of its own (MM1: no
// compatibility switches between mods), Meaner Monsters' switch beside DEX's IS MUDEX's:
//   - DEX loaded and Meaner Monsters on at the game's load: MUDEX is loaded (DEX's install latches it), and its tables
//     are read after DEX's own (dexInstall.js);
//   - DEX loaded: Meaner Monsters' own rows, its sprites' scales and PCAAO's edit of it stand aside, as they do in a
//     DFU game that took the advice (MUDEX installed, Meaner Monsters not - PCAAO's arm asks for that mod by name);
//   - DEX not loaded: Meaner Monsters is itself.
// A switch flipped mid-game waits for the next load, as DEX's does. A LEAF but for the settings store.

import { modSetting, modLatchedOn } from '../modSettings.js';

export const DEX_VENDOR = 'daggerfall-enemy-expansion';
export const MUDEX_VENDOR = 'mudex';

/** DEX as loaded for this game: the latch its install set, else (before the install, or in a test) its switch. */
export const dexLoaded = () => modLatchedOn(DEX_VENDOR) ?? modSetting(DEX_VENDOR, 'Enabled') === true;

/** MUDEX as loaded for this game: the latch DEX's install sets (DEX loaded, Meaner Monsters on); before it, none. */
export const mudexLoaded = () => modLatchedOn(MUDEX_VENDOR) === true;

/** Meaner Monsters as itself - its rows, its xml, PCAAO's edit of it: its switch `on`, and DEX's install has not
 *  loaded DEX beside it. The latch alone, as MUDEX's: the boot installs DEX before any foe is minted, and a game (or a
 *  test) that never ran the install has no MUDEX to stand in for this mod. */
export const meanerMonstersAlone = (on) => !!on && modLatchedOn(DEX_VENDOR) !== true;
