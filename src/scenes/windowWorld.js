// @ts-check
// RPT1026-FIGHTS (WINDOW-ONLINE; two private reports, 2026-10-25 and 2026-10-26: the room's host pausing or opening the
// inventory froze every foe of the shared dungeon while a party member killed them freely; a paralysed player waited the
// paralysis out in the inventory): WHETHER A WINDOW OVER THE DUNGEON HOLDS ITS WORLD.
//
// WHAT DFU DOES. A PauseWhileOpen window pauses the game (UserInterfaceManager.PushWindow -> GameManager.PauseGame,
// Time.timeScale 0): the foes, the player's own clock and every effect's rounds stop together, and resume together.
//
// WHAT THE PORT DID. Both dungeon hosts held the whole dungeon frame under such a window - they return before
// dungeonContext.js drawFoes, which steps the foes, ticks the character's minutes and the foes' rounds, flies the missiles
// - so offline the dungeon paused as DFU's does. Online it could not. The world's clock is nobody's to stop (WORLD5), and
// the character's own clock runs with it while they are in the world (systems/worldTick.js LIVED1): the paralysis'
// rounds ran out under the inventory and were walked whole on the first frame after it, while the foes had stood frozen
// beside the paralysed player all that time - a shelter. And the dungeon's foes are ONE simulation a room (WORLD2): the
// room's host steps them for everyone, so its window froze every foe its party fought, which went on taking their blows
// (the host's damage door answers a peer's hit off the network, window or not) - a party member killed them freely. Above
// ground none of this held since WINFOE1 (2026-09-17, Mac: "enemies should still be able to do damage - a window
// (inventory, status, quest) no longer zeroes their clock; only your own input/camera pause"); the dungeon was the pool
// it never reached.
//
// THE LAW. Online - the shared clock on - a window holds no dungeon while the player lives under it: the frame runs (the
// foes act, the rounds tick on the clock they always ran on), and what the window holds is the player's own motor, input
// and breath, as WINFOE1 holds them above ground. Offline the dungeon pauses as DFU's does, unchanged. The death screen is
// no living player's window: it holds the dungeon in both.
//
// A departure from DFU's PauseGame, online alone (Port-Ledger A, ONLINE).
import { sharedClockOn } from '../systems/worldTick.js';

/**
 * Does a window over the dungeon hold its frame - `up` the context's pause (dungeonContext.js uiOverlayActive: its stack's
 * PauseWhileOpen), `alive` the player alive under it (no death screen in its slot)? Offline, whenever one is up (DFU's
 * pause); online, only over the dead.
 * @param {unknown} up @param {unknown} alive
 */
export const windowHoldsDungeon = (up, alive) => !!up && !(sharedClockOn() && !!alive);
