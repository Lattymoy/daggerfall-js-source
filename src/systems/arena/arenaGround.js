// @ts-check
// CURSE-OFF-SAND (FIELD BUGS 2026-10-04e, Discord: "The ghosts outside are bothersome (I know they're story related)").
// The Curse of Daggerfall (S0000977, a world quest - scenes/quest/questFoeHost.js WORLD_QUESTS) tries a wraith every 21
// minutes and a ghost every 31 from 19:00 to 05:00 while the player is in the city, each stood on a ring 5-20 m round
// them (CreateFoe's own placement). The hour's exhibitions run until 21:00 and a ladder bout at any hour, so the curse's
// dead came for the player at the gate, in the stands and between bouts - and indoors, on the floor's instance and in
// the undercroft. The arena's grounds are kept: within ARENA_GROUND_M of the colosseum's sand (the hosts' own
// ARENA_NEAR_M, where the hour's bout is stood for a player outside), and the arena's two made levels, a curse wave is
// KEPT OFF at CreateFoe's spawn event (quest/actions.js `world.foeKeptOff` - the hosts' quest world asks this): it passes
// as a hidden Foe's does, the interval spent and no wave pending, so the curse is not lifted - its next interval's wave
// comes once the player is off the grounds. (Not at placement: a wave left pending raises the encounter event every
// machine tick, and broke a rest there each tick.) Only the curse: any other quest's foes are placed as DFU places them.
// Pure. Not a DFU member - Ledger A (CURSE-OFF-SAND; the arena is the port's own, ARENA2).

import { questNameIn } from '../quest/machine.js';

/** The quests whose foes keep off the arena's grounds: the Curse of Daggerfall. */
export const ARENA_GROUND_QUESTS = Object.freeze(['S0000977']);
/** The grounds' reach from the colosseum's sand, metres (scenes/world.js and scenes/exterior.js ARENA_NEAR_M). */
export const ARENA_GROUND_M = 150;

/**
 * Whether a wave of quest `questName` is kept off the arena's grounds: always on the arena's own levels
 * (`inArenaLevel` - the floor's instance, the undercroft), and outside while the player's `feet` stand within
 * ARENA_GROUND_M of the sand's `centre` (null where the arena is not built). Pure.
 * @param {{ questName?: string | null, feet?: number[] | null, centre?: number[] | null, inArenaLevel?: boolean }} q
 */
export function keptOffArenaGround({ questName = null, feet = null, centre = null, inArenaLevel = false } = {}) {
  if (questName == null || !questNameIn(ARENA_GROUND_QUESTS, questName)) return false;
  if (inArenaLevel) return true;
  if (!feet || !centre) return false;
  return Math.hypot(feet[0] - centre[0], feet[2] - centre[2]) < ARENA_GROUND_M;
}
