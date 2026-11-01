// @ts-check
// RPT1026-EVENTS GATE-WAY (2026-10-26; two private reports: Portal Stone portals opened at the mouth of a breach or another
// event to carry the arriving crowd elsewhere, and a breach's gate walled with a parked wagon while a portal was laid in it as the gate
// opened, more than once): AN EVENT'S GATE KEEPS ITS WAY CLEAR.
//
// A Portal Stone's portal takes whoever steps into it (systems/portalStone.js), and a crowd running at a Dagon's Breach as
// it opens runs into whatever stands before its fire. So, while an event's gate stands on this screen, no portal stands
// within EVENT_GROUND_M of it: its opener's pick refuses the place (portalStone.js portalStonePlace), a peer's word of one there
// is not believed (scenes/portalGates.js applyOwner), and a portal already open when a gate rises beside it closes and takes
// nobody (portalGates.js tick). A caravan cannot wall a gate (PR-WAGON1 stands no peer's wagon in my collider), but parked
// across one it hid the fire and the portal laid inside it: another player's PARKED wagon inside the same ground is not
// drawn here (scenes/horseCartPool.js), as a concealed owner's is not.
//
// THE AUTHORITY IS EVERY SCREEN'S. A portal and a parked wagon are their owners' words, which the relay never reads (the
// foes frame's `pg` and `hcc`); what a portal does is done on the screen that steps into it. So each screen judges both by
// the gates IT stands - the gate's place is the shared clock's and the map's (scenes/gate/gatePool.js), an Elite Breach's
// arch the room's word (scenes/eliteGates/egArch.js), a fallen star's heart the law's (scenes/starfall/starfallHost.js) - and a
// modded opener cannot reach a screen past its own law.
//
// A LEAF: the pools that stand an event's gate say where it stands, each under its own name, once (`setEventGround`), and the
// laws that keep a way clear ask (`eventGroundAt`) - THE ONE CONSTRUCTION SEAM's shape (systems/questlines/qlActs.js's
// sink): nothing of a host is grown for it. Every point is the SCENE's (the pools' own frame - a recentre moves them all).
// Not a DFU member: Daggerfall has no portals, no world events and no other players. Ledger A (GATE-WAY).

/** How far about an event's gate (m, on the ground) no portal stands and no other player's parked wagon is drawn: past the
 *  gate's own rock clearing (world/gate/gateClearance.js GATE_CLEAR_M, 24) and a fallen star's coven's ring (STAR_ROCK_M,
 *  28) - the ground a company gathers on and runs across to the fire. */
export const EVENT_GROUND_M = 40;

/** @type {Map<string, () => (ReadonlyArray<ArrayLike<number>> | null | undefined)>} */
const _sources = new Map();

/** A pool's word: `fn()` answers its gates' feet standing now (the scene's [x, y, z] each; none, an empty list or null).
 *  `null` lets the name go. */
export function setEventGround(name, fn) {
  if (typeof fn === 'function') _sources.set(name, fn);
  else _sources.delete(name);
}

/** THE LAW: the first of `feet` within `r` of `p` on the ground (x and z), or null. Pure. */
export function groundNear(feet, p, r = EVENT_GROUND_M) {
  if (!p || !feet) return null;
  for (const f of feet) if (f && Math.hypot(f[0] - p[0], f[2] - p[2]) <= r) return f;
  return null;
}

/** Does scene point `p` stand within `r` of an event's gate standing on this screen? Answers the pool's name, or null. A pool
 *  that throws stands nothing. */
export function eventGroundAt(p, r = EVENT_GROUND_M) {
  if (!p) return null;
  for (const [name, fn] of _sources) {
    let feet = null;
    try {
      feet = fn();
    } catch {
      feet = null;
    }
    if (feet?.length && groundNear(feet, p, r)) return name;
  }
  return null;
}
