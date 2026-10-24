// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SHIP-PVP (2026-10-22, the owner: "Build ever single bit of this and dont return until its perfected"; bible/03-World/
// Eltheric-Ocean.md SHIP-PVP) - THE NAVAL HOST'S SEAMS FOR THE OPEN SEA'S GUNS: what the referee's words need of the ships
// the naval host stands (scenes/naval/navalHost.js) - my ship as the referee is told of her, its word laid on her, her
// wreck, a peer's boat where she lies, a prize out of her hold - and the guns' module attached (scenes/naval/
// seaBroadsides.js, the sea's host's). HOST-SPLIT: built once by createNavalHost over its own internals, never grown there.
//
// deps = {
//   enabled() -> bool       the sea fight runs
//   boat() -> boat | null   the boat of mine the sea takes me by (navalHost.js boatInPlay)
//   stateOf(boat)           her damage and guns (navalHost.js myBoatState)
//   build(boat)             her build as her refits make her (navalHost.js refitBuild)
//   pose(boat)              her pose (navalHost.js boatPose)
//   boats() -> boat[]       every boat of mine (Come Sail Away's AllBoats)
//   peers() -> [{ id, pos }]   the peers' boats (navalHost.js deps.peerBoats)
//   clock() -> s            the naval host's clock
//   shake(k)                the camera's
//   due?() -> { hull }      the Captain's Due (systems/sigil/sigilSetPowers.js captainsDue - its own, when none is given)
// }
// ═══════════════════════════════════════════════════════════════════
import { hullBuild } from '../../systems/naval/navalShips.js';
import { SHIP_STATES } from '../../systems/naval/navalDamage.js';
import { captainsDue } from '../../systems/sigil/sigilSetPowers.js';
import { wildTakeTook } from '../../systems/wild/wildDropLaw.js';
import { SEA_HOLD_F } from '../../net/sea/seaPrizeLaw.js';
import { shutSeaHold } from '../../systems/naval/seaHoldGuard.js';

/** The camera's shake when a captain's shot the referee judged lands on my ship. */
export const PVP_STRUCK_SHAKE = 1.6;
/** AUDIT SEA VENTURES E6A: a stranger captain's ship this near mine is a hostile ship near (navalHost.js HOSTILE_NEAR_M,
 *  pinned equal) - no cabin below, off the guns, with another captain's coming on (metres). */
export const SEA_CAPTAIN_NEAR_M = 700;

/** @param {any} deps */
export function createNavalPvp(deps) {
  /** The guns' module (seaBroadsides.js) - attached by the sea's host. */
  let guns = null;
  /** THE SHIP I SAIL as the referee is told of her - `{ hl, u, t, h, wrecked, pos, boat }`: her hull, her uid, her
   *  toughness (her Hull refit's, over the Captain's Due's share taken), her hull's share, whether she lies wrecked - or
   *  null (the sea fight not running, no boat of mine at hand, or one with no uid the referee can sign). */
  function helm() {
    const boat = deps.enabled?.() ? deps.boat?.() : null;
    const st = boat ? deps.stateOf(boat) : null;
    if (!st || !(boat.uid > 0)) return null;
    const t = deps.build(boat).hullHp / Math.max(1, hullBuild(boat.hull).hullHp) / Math.max(0.01, (deps.due?.() ?? captainsDue()).hull);
    return { hl: boat.hull, u: boat.uid, t, h: st.damage.hullShare(), wrecked: st.damage.state === SHIP_STATES.wrecked, pos: deps.pose(boat).position, boat };
  }
  /** THE REFEREE'S WORD ON MY SHIP (`hull`): her bar's share `frac` and her canvas's `sail` struck, a fire set, her bar `left`
   *  - her hull no higher than the referee's bar leaves it. Answers the state it changed her to (or null). */
  function struck({ frac = 0, sail = 0, fire = false, left = 1 }) {
    const boat = deps.boat?.(), st = boat ? deps.stateOf(boat) : null;
    if (!st) return null;
    const d = st.damage;
    const hull = Math.max(frac * d.maxHull, d.hull - Math.max(0, left) * d.maxHull);
    const change = d.apply({ hull: Math.max(0, hull), sail: Math.max(0, sail) * d.maxSail, crew: 0, ...(fire ? { fire: 'hull' } : {}) }, deps.clock());
    deps.shake?.(PVP_STRUCK_SHAKE);
    return change;
  }
  /** THE REFEREE'S WRECK OF MY SHIP: her hull at none - she lies crippled, as a sea ship's guns leave her - and her hold
   *  shut while her wreck may be boarded (systems/naval/seaHoldGuard.js - AUDIT SEA VENTURES B3). */
  function wreck() {
    const boat = deps.boat?.(), st = boat ? deps.stateOf(boat) : null;
    if (st && st.damage.state !== SHIP_STATES.wrecked) st.damage.apply({ hull: st.damage.maxHull * 2, sail: 0, crew: 0 }, deps.clock());
    if (boat) shutSeaHold(boat.uid);
  }
  /** A BOARDED WRECK'S PRIZE out of my boat's hold - the pieces the service took, each found by its own marks (net/sea/
   *  seaPrizeLaw.js seaPrizeTook, systems/wild/wildDropLaw.js wildTakeTook), never by its place; her hold's list alone
   *  (a word naming my bag or my cart finds nothing). Answers the pieces taken. */
  function takeHold(/** @type {number} */ uid, /** @type {any[]} */ took) {
    const items = (deps.boats?.() ?? []).find((b) => b.uid === uid)?.Cargo?.Items;
    return Array.isArray(items) ? wildTakeTook({}, took, null, undefined, [{ f: SEA_HOLD_F, items }]) : [];
  }
  return {
    attach: (/** @type {any} */ g) => { guns = g; },
    /** May this ball meet a peer's ship (navalHost.js targets' `hitBy`)? - the guns' word; none attached, never. */
    open: (/** @type {string} */ peer, /** @type {unknown} */ shooter, /** @type {boolean} */ byMe) => !!guns?.open(peer, shooter, byMe),
    /** My ball on a peer's ship (navalHost.js landHit): gathered for the referee. */
    shot: (/** @type {string} */ peer, /** @type {any} */ hurt) => guns?.shot(peer, hurt),
    helm, struck, wreck, takeHold,
    peerAt: (/** @type {string} */ id) => (deps.peers?.() ?? []).find((p) => p.id === id)?.pos ?? null,
    /** AUDIT SEA VENTURES E6A: a stranger captain's ship at her helm within SEA_CAPTAIN_NEAR_M of mine where the open sea's
     *  guns are open (my balls may meet her - the guns' own word) - the cabin's hostile ship near (world.js sailingCabins). */
    captainNear() {
      const h = guns?.live ? helm() : null;
      return !!h && (deps.peers?.() ?? []).some((p) => Array.isArray(p.pos) && !!guns.open(p.id, null, true) && Math.hypot(p.pos[0] - h.pos[0], p.pos[2] - h.pos[2]) <= SEA_CAPTAIN_NEAR_M);
    },
  };
}
