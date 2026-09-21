// @ts-check
// SOC5 (2026-09-16, Mac: "Players should be able to interact with others in the world upon encountering them by
// pressing F on their body, which should show options to add as a friend or invite to a party"): WHICH BODY IS THE
// ONE IN FRONT OF ME - the reach law, pure arithmetic, no scene and no DOM.
//
// WHY IT IS ITS OWN MODULE. "On their body" is an ACTIVATION, and this port already has one law for that
// (player/activationRace.js): a ray leaves the camera, everything it can strike is measured along it, the NEAREST
// in reach wins, and nothing behind the camera is struck at all. The F-menu is a fifth thing that ray can strike -
// another player - and the one way to keep it honest with the other four is to measure it the same way and to write
// that measuring down where a test can drive it with plain numbers. scenes/world.js keeps the ARM (it opens the
// menu); this answers who the arm is for.
//
// THE CYLINDER IS NOT COPIED. `distanceOf` is handed in, and the host hands in scenes/townTalk.js's
// `rayPersonDistance` - the port's ONE ray-vs-person test, whose radius and height are the MobilePersonNPC
// controller's own. A second copy of it here would be a second law, which is exactly the defect HARD2's header
// records - and the numbers are not restated in this file for the same reason, which a pin holds; and an
// import of scenes/ from player/ would be the first upward one in the tree. So it is a parameter, the test hands in
// the real function, and a source pin holds the host to it.
//
// AUDIT SOC D14 - TWO THINGS THIS PICK DOES NOT DO, ON PURPOSE. The cylinder is UNOCCLUDED: a peer behind a wall,
// a door or a market stall is picked exactly as one standing in the open, because nothing here casts against the
// world's geometry. That is the STREET'S OWN LAW and not a shortcut - scenes/world.js's raceActivation feeds the
// same person distances in as one more racer with no collider of its own, so a mobile NPC is talked to through the
// same un-occluded cylinder, and a social pick that added an occlusion test would be the one thing on that corner
// measured differently from everything beside it. And `t <= 0` answers Infinity for a peer AT MY FEET as well as
// for one behind me: a body whose cylinder the camera is standing inside has no along-ray distance to report and
// no direction to be in front of, so it is out of the race rather than at distance zero and winning every tie.
//
// Not a DFU member: Daggerfall Unity has no other players to stand in front of. Ledger A row (ONLINE).
import { MOBILE_NPC_ACTIVATION_DISTANCE } from './activate.js';

/** HOW NEAR "on their body" IS. PlayerActivate.cs:88 MobileNpcActivationDistance (256 * GlobalScale = 6.4) - the
 *  game's OWN reach for a person, the one scenes/townTalk.js refuses a conversation past ('You are too far away...').
 *  A player is a person; the F-menu reaches exactly as far as a talk does, and not one unit further, so "I could talk
 *  to them" and "I could friend them" never disagree on the same street corner. */
export const SOCIAL_REACH = MOBILE_NPC_ACTIVATION_DISTANCE;

/**
 * THE PEER UNDER THE RAY, or null.
 *
 * `peers` is scenes/world.js's `peersNear()` - `[{ id, feet, height }]`, each `feet` in THIS scene's frame. `fwd` is
 * the camera's forward, `camPos` its position, both as the activation site reads them. `distanceOf(camPos, fwd, feet)`
 * answers the along-ray distance or Infinity (scenes/townTalk.js rayPersonDistance: Infinity behind the camera, and
 * Infinity for a ray that misses the cylinder).
 *
 * THE THREE REFUSALS, which are the pins:
 *   - BEHIND is not "far". rayPersonDistance answers Infinity for `t <= 0`, so a peer at my back never enters the
 *     race at all - it does not merely lose it to someone in front.
 *   - PAST THE REACH is nothing, not the nearest thing. The nearest peer under the ray is found first and THEN
 *     measured against `reach`, so a peer across the square does not shield a second one behind them; both are out.
 *   - A TIE KEEPS THE FIRST. `d < bestDist` and not `<=`: one ray has one hit, and the order `peersNear` hands them
 *     in is the only tie-break there is. NaN and Infinity lose every comparison, so neither can ever win.
 *
 * @param {number[]} camPos
 * @param {number[]} fwd
 * @param {{ id: string, feet: number[] }[]|null} peers
 * @param {number} reach
 * @param {(camPos: number[], fwd: number[], feet: number[]) => number} distanceOf
 * @returns {{ peer: { id: string, feet: number[] }, distance: number }|null}
 */
export function pickPeerInFront(camPos, fwd, peers, reach, distanceOf) {
  if (!Array.isArray(peers) || typeof distanceOf !== 'function') return null;
  let best = null, bestDist = Infinity;
  for (const p of peers) {
    if (!p || !Array.isArray(p.feet)) continue;   // a peer whose body is not standing yet has no feet to aim at
    const d = distanceOf(camPos, fwd, p.feet);
    if (d < bestDist) { best = p; bestDist = d; }
  }
  if (!best || !(bestDist <= reach)) return null;
  return { peer: best, distance: bestDist };
}
