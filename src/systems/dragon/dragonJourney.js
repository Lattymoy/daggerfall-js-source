// @ts-check
// DRAGON6 (2026-10-29, the owner: "This should increase overworld travel speed, fly in the air and negate road travel";
// bible/11-Multiplayer/Dwarven-Dragon.md section 10): THE OVERWORLD FLOWN, PURE. A journey begun on the dragon is planned
// as one straight leg of its own kind (AIR_LEG_KIND) - no road followed, the sea and the peaks under it alike - which runs
// at the road's rate wherever it goes (systems/travel/travelOptions.js) while the ride holds the dragon at
// DRAGON_CRUISE_M over what is under it (player/dragonRide.js). Not a DFU member: Daggerfall has no flying mount.

/** A flown leg's kind: never a road's or the sea's, its own. */
export const AIR_LEG_KIND = 'air';
/** The cruise's height over the ground or the sea under the rider, m. */
export const DRAGON_CRUISE_M = 60;
/** The governor's band: a full climb (or dive) this far under (or over) the cruise, m. */
export const DRAGON_CRUISE_BAND_M = 15;

/** A flown journey's plan in planRoute's shape (`{ pixels, cost, kinds }`): from where the rider is straight to the end,
 *  one leg - never round a town, never by a road, never a crossing to arm. Null for no journey.
 *  @param {{x:number,y:number} | null | undefined} from @param {{x:number,y:number} | null | undefined} to */
export function dragonFlightPlan(from, to) {
  if (!from || !to) return null;
  if (from.x === to.x && from.y === to.y) return { pixels: [{ x: from.x, y: from.y }], cost: 0, kinds: [] };
  return {
    pixels: [
      { x: from.x, y: from.y },
      { x: to.x, y: to.y },
    ],
    cost: Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y)),
    kinds: [AIR_LEG_KIND],
  };
}

/** Whether a journey's leg is flown. @param {{ kind?: string } | null | undefined} leg */
export const flownLeg = (leg) => leg?.kind === AIR_LEG_KIND;

/** The governor: the climb (1) or dive (-1) that holds DRAGON_CRUISE_M over what is under the rider, in proportion
 *  within its band. @param {number} heightOver m over the ground or the sea */
export function cruiseHold(heightOver) {
  if (!Number.isFinite(heightOver)) return 0;
  return Math.max(-1, Math.min(1, (DRAGON_CRUISE_M - heightOver) / DRAGON_CRUISE_BAND_M));
}
