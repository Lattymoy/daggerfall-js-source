// @ts-check
// AUDIT QUESTLINES ACTS-8 (2026-10-19; bible/06-Systems/Questlines-Arc.md section 4.5; CLAUDE.md HOST-SPLIT): THE ELITE
// FOE'S ACT, `elite-foe-slain` (systems/questlines/qlActs.js), out of the dungeon host. QL11 wrote its whole condition into
// buildDungeonContext (scenes/dungeonContext.js), a host that does not grow; the host now hands this module the place it
// built (`hearEliteFoesIn(dfLocation)`, one line of wiring) and the condition is here, where a pin drives it.
//
// WHAT IT IS: a kill of MY blow (systems/playerKills.js - every pool's damage door tells it, and a peer's blow tells nothing)
// of an elite foe (`eliteFoe`, systems/eliteFoes.js promoteEliteFoe) standing as an Elite dungeon's (`elite`, the mark the
// dungeon's applyEliteScaling puts on its entity - no foe outside a dungeon carries it), in a place whose tier is 'elite'
// (systems/dungeon/dungeonTier.js) - never a Super dungeon's six, whose foes carry both marks too (characters/dungeonEnemies.js
// expandEliteEnemies; world/superDungeon/sdDungeon.js scaleSuperFoe).
//
// ONE LISTENER, BY NAME: each dungeon built registers it again over its own place, and a name re-registered replaces
// (playerKills.js), so the place it reads is the dungeon last built; out of every dungeon it still hears my kills, and no
// foe there carries `elite`.
//
// Of the leaves only - the kills', the tier's and the acts' - so the dungeon host imports nothing of the layer.
import { registerPlayerKillListener } from '../playerKills.js';
import { dungeonTier } from '../dungeon/dungeonTier.js';
import { noteAct } from './qlActs.js';

/** The kill listener's name (playerKills.js registerPlayerKillListener) - QL11's own, kept. */
export const QL_ELITE_FOE = 'ql11-elite-foe';

/** Whether a kill of mine in `loc` is the act: an elite foe of an Elite-tier dungeon's. Pure. */
export const eliteFoeSlainIn = (/** @type {any} */ entity, /** @type {any} */ loc) => !!entity?.eliteFoe && !!entity.elite && dungeonTier(loc) === 'elite';

/** THE DUNGEON HOST'S ONE LINE: `loc` the place it built - the act said for each elite foe my blow kills there. */
export function hearEliteFoesIn(/** @type {any} */ loc) {
  registerPlayerKillListener(QL_ELITE_FOE, (/** @type {any} */ entity) => { if (eliteFoeSlainIn(entity, loc)) noteAct('elite-foe-slain'); });
}
