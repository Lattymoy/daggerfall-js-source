// @ts-check
// SHIP-COLOURS (2026-10-17, the owner: "Finally, a fully customizable flag with the option to use your guild insignia";
// bible/03-World/Naval-Refit.md SHIP-COLOURS) - THE FLAGS FLOWN, the world host's: which boats fly a flag of cloth this
// frame and where (render/shipFlagPass.js draws them), the boats whose pennant it replaces (scenes/world.js
// csaParticleLists leaves their cubes out), and the flag each of mine says to the room (systems/comeSailAway/
// comeSailAwayWire.js `f`).
//
//   MINE - every boat of mine standing (Come Sail Away's AllBoats) whose record in the Fleet's ledger carries colours
//          (systems/fleet.js `colours`): flown as systems/naval/shipFlag.js flownFlag reads them - the guild's arms while
//          the flag is the guild's and the guild has any (`guildArms`, the account's guild book)
//   THEIRS - another player's boat stood here (scenes/comeSailAway/comeSailAwayPeers.js) whose word says a flag
//   THE SEA'S - SEA-COLOURS (systems/naval/seaColours.js): a ship of the sea flying her colours, within SEA_FLAG_M, the
//          nearest first (the naval host's `seaFlags`) - her wave her seed's
//
// The cloth hangs from her FlagObject (the mod aims it down her wind - its forward is the fly) at her hull's size
// (shipFlag.js flagSizeOf); a boat with no FlagObject, or none standing, flies none. Each flag's phase is her number's,
// so a fleet at anchor does not wave as one.
import { flownFlag, flagKey, flagSizeOf } from '../systems/naval/shipFlag.js';
import { flyOf, FLAGS_MAX } from '../render/shipFlagPass.js';

/** A boat's wave phase from her number (radians). */
export const flagPhaseOf = (uid) => (((Number(uid) >>> 0) * 2654435761) >>> 0) / 0xffffffff * Math.PI * 2;

/**
 * @param {{ myBoats: () => any[], coloursOf: (uid: number) => any, guildArms?: () => any, peerFlags?: () => { boat: any, flag: any }[],
 *   seaFlags?: () => { boat: any, flag: any, phase?: number }[], shown?: () => boolean }} deps - `myBoats` my boats standing;
 *   `coloursOf` a ship's colours by her number (the ledger's); `peerFlags` the peers' boats that say one; `seaFlags` the
 *   sea's ships' (SEA-COLOURS); `shown` whether the cloth is drawn this frame (the exterior's pass - a boat on a dungeon's
 *   water flies her pennant, no cloth being drawn there)
 */
export function createShipFlagHost(deps) {
  /** @type {WeakMap<any, any>} the flag a boat flies this frame */
  let flown = new WeakMap();
  /** @type {any[]} */
  let list = [];
  /** The flag one boat of mine flies (null: her pennant). */
  const mineOf = (boat) => (boat?.uid ? flownFlag(deps.coloursOf(boat.uid), deps.guildArms?.() ?? null) : null);

  /** This frame's flags: every boat of mine and every peer's that flies one, where it flies. */
  function frame() {
    flown = new WeakMap();
    list = [];
    if (deps.shown && !deps.shown()) return;
    const take = (boat, flag, phase = boat?.uid ?? list.length) => {
      if (!boat || !flag || list.length >= FLAGS_MAX) return;   // AUDIT 2: one past the pass's cap flies her pennant - it was left out for cloth never drawn
      const size = flagSizeOf(boat.hull);
      const node = boat.FlagObject;
      if (!size || !node || boat.GameObject?.activeSelf === false || (boat.fade ?? 1) <= 0) return;
      const top = node.position;
      if (!Array.isArray(top) || !top.every(Number.isFinite)) return;
      flown.set(boat, flag);   // flown where it is drawn - her pennant's cubes left out for it
      list.push({ key: flagKey(flag), flag, top, fly: flyOf(node.forward), size, phase: flagPhaseOf(phase), fade: boat.fade ?? 1 });   // AUDIT 2: her fade, the cloth dissolving with her hull
    };
    for (const boat of deps.myBoats() ?? []) take(boat, mineOf(boat));
    for (const p of deps.peerFlags?.() ?? []) take(p.boat, p.flag);
    for (const p of deps.seaFlags?.() ?? []) { if (list.length >= FLAGS_MAX) break; take(p.boat, p.flag, p.phase); }   // SEA-COLOURS: the nearest, to the pass's cap
  }

  return {
    frame,
    /** Whether `boat` flies a flag of cloth this frame - her pennant's cubes are not drawn. */
    flies: (boat) => flown.has(boat),
    /** The flags to draw (render/shipFlagPass.js ShipFlagRenderer.draw's). */
    draws: () => list,
    /** The flag a boat of mine flies, as the room's word says it (shipFlag.js flagCode) - null for her pennant. */
    wireFlag: (boat) => mineOf(boat),
  };
}
