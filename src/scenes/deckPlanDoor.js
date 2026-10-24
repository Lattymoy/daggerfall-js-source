// @ts-check
// DECK-PROPS (2026-10-17; bible/03-World/Naval-Refit.md DECK-PROPS) - THE DECK PLAN'S DOOR: the Fleet page's Deck
// (scenes/fleetHost.js `deckPlan`) opens the plan of her deck (ui/deckPlanWindow.js, through the sea's window door) over
// the world host's runtimes - her hull's deck baked by the boats' pool (scenes/comeSailAway/comeSailAwayPool.js deckOf),
// each fitting's model asked of the pipeline so its box can be drawn, and the Fleet's act that keeps what is set.
import { fleetShip, shipLabel } from '../systems/fleet.js';
import { t } from '../systems/textManager.js';
import { DECK_FITTINGS } from '../systems/naval/deckFittings.js';
import { createDeckPlanOverlay } from '../ui/naval/navalPlunderDoor.js';
import { vertexBox } from './comeSailAway/comeSailAwayPool.js';

/**
 * @param {{ pool: any, pipeline: any, act: (uid: number, verb: string, arg?: any) => { ok: boolean, text: string }, show: (overlay: any) => void,
 *   say?: (text: string) => void, overlay?: (deps: any) => any }} deps - `overlay` the plan's window made (navalPlunderDoor.js
 *   createDeckPlanOverlay's, the sea's window door)
 * @returns {(uid: number) => boolean} - opens her plan; answers whether it opened
 */
export function createDeckPlanDoor(deps) {
  /** A fitting's box on her deck, `[width, depth]` (metres) - null while its model loads. */
  const footprint = (m) => { const b = vertexBox(deps.pipeline?.cpuModels?.get(m)?.positions); return b ? [b.max[0] - b.min[0], b.max[2] - b.min[2]] : null; };
  return function openDeck(uid) {
    const rec = fleetShip(uid);
    const deck = rec ? deps.pool?.deckOf?.(rec.hull) ?? null : null;
    if (!rec || !deck?.count) { deps.say?.(t('naval.deck.unknown', 'The deck isn\'t loaded yet. Place the ship in the world first.')); return false; }
    for (const [m] of DECK_FITTINGS) Promise.resolve(deps.pipeline?.getGpuMesh?.(m)).catch(() => {});   // AUDIT 2: each asked, loaded or not - the ask pins it (a house's own hold freed it under the plan)
    const w = (deps.overlay ?? createDeckPlanOverlay)({ name: shipLabel(rec), deck, fittings: rec.deck ?? [], footprint, save: (list) => deps.act(uid, 'deck', list) });
    if (w) deps.show(w);
    return !!w;
  };
}
