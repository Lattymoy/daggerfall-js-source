// @ts-check
// RAM-BOARD (2026-10-17, the owner: "Let us board a ship without weakening it.. like just ram and board";
// bible/03-World/Naval-Refit.md RAM-BOARD) - A RAM FOULS HER. The port's own; pure.
//
// Boarding was for a ship brought to strike her colours (navalDamage.js STRUCK_AT - a quarter of her hull) and no other:
// the helm's grapples (navalHost.js boardingGap), the rail on foot (footReach), the heave-to beside her and the crews'
// muster all asked `state === struck`, so the only way aboard a ship was to batter her first. Black Flag's other way is the
// one the owner asks for: put your stem into her and go over. So a ram that strikes home (navalHost.js checkRams: the stem
// in her hull's box at RAM_SPEED or more) FOULS her for FOUL_S - her bow caught in mine, her way held under FOUL_WAY
// (navalAI.js stepCaptain: her sails come in and her way comes off at FOUL_DECEL; her guns still answer - she has not
// struck) - and while she is fouled BY ME she can be boarded as she stands: her whole crew mustered against me
// (navalBoarding.js musterOf over her crew's share - a sound ship's full muster, MUSTER_MAX at most, her captain at
// their head), the prize hers to give if I win. A ship fouled by another player is theirs to board (`by`), never mine.
//
// The law is the law already: a ram on a lawful ship is an act of fire (navalLaw.js - piracy, notoriety, any navy in
// sight provoked) and taking her is a boarding's; nothing here is new to the crowns. Online (AUDIT 2026-10-17) a ram on a
// ship another player stands says its foul to her stander with its blow (navalWire.js navalHitData `foul`, the hit's `u`:
// the seconds it holds her), and her stander's AI holds her way (`foulSaid`) - her way had come off in the rammer's copy
// alone while her stander's word sailed her on out of the grapples' reach; the boarder adopts her at the grapple
// (navalHost.js adopt). A sound ship being boarded is said `afloat` on the wire with her captain's mode `boarded`
// (navalAI.js stepCaptain's), so no peer grapples her under the fight and none reads her colours struck.

/** How long a ram holds her fouled (s): time to come up alongside, or heave to beside her (navalHost.js HEAVE_TO_S 8). */
export const FOUL_S = 20;
/** Her way while fouled (m/s) - under navalBoarding.js BOARD_SPEED (2.5), so a boarding from her lee is never left behind. */
export const FOUL_WAY = 1.2;
/** How fast her way comes off once fouled (m/s^2): a hull caught by another's stem stops short. */
export const FOUL_DECEL = 4;

/** `ship` fouled by `by` (a player's id) at `now`: her bow caught until FOUL_S on - and `more` seconds besides (CAPTAIN-TREE:
 *  the ram's captain's grapnels, captainTree.js `foul`). A fresh ram renews it. */
export function foul(ship, by, now, more = 0) {
  if (!ship) return;
  ship.fouled = { by, until: now + FOUL_S + Math.max(0, Number(more) || 0) };
}
/** Whether `ship` is fouled at `now` (by anyone). */
export const isFouled = (ship, now) => !!ship?.fouled && now < ship.fouled.until;
/** The seconds left on her foul at `now` (0: none) - what her rammer says to her stander. */
export const foulLeft = (ship, now) => (isFouled(ship, now) ? ship.fouled.until - now : 0);
/** The most a word may say a foul holds (s): FOUL_S and every captain's grapnels past it, with room. */
export const FOUL_SAID_MAX = 60;
/** A ram's foul as her rammer `by` said it to her stander (`secs` it holds her, FOUL_SAID_MAX at most): taken on a sound
 *  ship not boarded already, as the ram's own `foul` takes it. Answers whether it was. */
export function foulSaid(ship, by, now, secs) {
  if (!ship || !(secs > 0) || ship.boarded || ship.damage?.state !== 'afloat') return false;
  ship.fouled = { by, until: now + Math.min(FOUL_SAID_MAX, secs) };
  return true;
}
/** Whether `ship` is fouled at `now` by `by`. */
export const fouledBy = (ship, by, now) => isFouled(ship, now) && ship.fouled.by === by;

/**
 * Whether `by` may throw the grapples on `ship` at `now` as her state stands: struck (her colours down - anyone's), or
 * afloat and fouled by `by` - never one being boarded already, never a prize, a wreck going down or gone.
 * @param {{ boarded?: boolean, damage: { state: string }, fouled?: { by: any, until: number } }} ship
 */
export function boardableState(ship, by, now) {
  if (!ship || ship.boarded) return false;
  const st = ship.damage.state;
  return st === 'struck' || (st === 'afloat' && fouledBy(ship, by, now));
}

/** A fouled ship's way (navalAI.js stepCaptain, after her helm): held under FOUL_WAY, coming off at FOUL_DECEL. */
export function holdFouled(ship, dt, now) {
  if (!isFouled(ship, now)) return false;
  ship.speed = Math.max(0, Math.min(ship.speed, Math.max(FOUL_WAY, ship.speed - FOUL_DECEL * Math.max(0, dt))));
  ship.sails = Math.max(0, (ship.sails ?? 0) - Math.max(0, dt) * 0.5);
  return true;
}
