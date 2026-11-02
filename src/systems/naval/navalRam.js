// @ts-check
// RAM-RETURN (2026-10-26, the owner: "So players are complaining about ship ramming being removed. So I would like to
// reintegrate it in a thoughtful way. The major issue was that you could easily instability ships just by ramming";
// bible/03-World/Naval-Refit.md RAM-RETURN and its AUDIT) - THE RAM'S LAW, bounded. The port's own; pure. The naval
// host's module (scenes/naval/navalRams.js) finds the stems and lands the blows; this says what a ram does.
//
// WHY IT WAS RETIRED (BOARD-MAGNET): a ram dealt RAM_DAMAGE (14) a metre a second of closing way, a galley's three times
// that, with no bound - a Large Galley at 7 m/s dealt 294, past a Pirate Sloop's whole hull (264), and a storm's way
// (38.9 m/s) dealt 545 from a plain stem. Only one captain's galley on another's sound ship stopped at her strike (AUDIT
// NAV2 F26); the player's ram and a galley's on the player's boat did not. And RAM-BOARD's foul made a sound ship
// boardable the moment a stem touched her. So one ram sank a ship, or took her whole.
//
// WHAT A RAM IS NOW. A stem meets a hull at a FACE (`ramContact`: her side, or her bow or stern - the face of her box the
// stem stands nearest outside of), and it strikes at the CLOSING WAY toward that face (`ramClosing`: the two ships' way
// along its normal - a scrape along her side closes on her at nothing). At RAM_SPEED or more it deals a SHARE OF THE
// LESSER HULL of the two - RAM_SHARE for a plain stem, GALLEY_SHARE for a galley's ram, built to it - scaled by
//   PACE   the closing way over RAM_FULL_SPEED (a whole ram at a fighting way, never more past it: a storm's way rams as
//          hard as a fair day's), and
//   FACE   all of it into her side, RAM_GLANCE of it into her bow or her stern (her stoutest timbers).
// The lesser hull is the bound on both sides: a big ship's stem takes a share of the small ship it strikes, and a small
// stem strikes a big ship with no more than its own weight. Whatever the blow, it never takes a hull UNDER its line,
// STRUCK_AT of its whole (`ramLine`, landed as the hurt's floor - navalDamage.js apply): a ram brings a fighting ship to
// strike her colours and no further - her prize is the grapples' (navalBoarding.js, BOARD-MAGNET), her sinking the guns'.
// The rammer takes RAM_RECOIL of the blow back - BOW_RECOIL times it on a stem not built to ram, a GALLEY_RAM-th of it on
// a galley's - and a ram is only as hard as she can pay for (`ramPaid`): its recoil within her own room over her line,
// a whole point short of it (`recoilRoom`), so her own ram never brings her to strike and a hull at its line has no ram
// left in it. RAM-BOARD's foul does not come back: a sound ship is boarded once she has struck, as BOARD-MAGNET has it.

import { STRUCK_AT, ballMen } from './navalDamage.js';

/** The least closing way (m/s) toward the face a stem meets that rams - under it two hulls bump, and the collider keeps
 *  them apart. */
export const RAM_SPEED = 1.6;
/** The closing way (m/s) that drives a ram home whole (a Small Ship's fighting way under HELM-WAY is 8.2) - past it, no
 *  more: a ram is bounded by the hulls, never by the wind. */
export const RAM_FULL_SPEED = 8;
/** The most of the lesser hull one ram takes - a plain stem's, and a galley's ram's. From whole to her strike (three
 *  quarters of her hull) is five plain rams into her side, three of a galley's. */
export const RAM_SHARE = 0.15;
export const GALLEY_SHARE = 0.3;
/** What a ram into her bow or her stern deals of one into her side. */
export const RAM_GLANCE = 0.4;
/** The blow's share the rammer takes back - BOW_RECOIL times it on a stem not built to ram, a GALLEY_RAM-th of it on a
 *  galley's (AUDIT NAV1's numbers). */
export const RAM_RECOIL = 0.3;
export const BOW_RECOIL = 2;
export const GALLEY_RAM = 3;
/** The men a ram takes: one for every RAM_A_MAN of hull it deals - what the wire says (`ramMenSaid`) - and, where she is
 *  stood, over her crew's toughness on the `roll`, as a ball's (navalDamage.js ballMen). */
export const RAM_A_MAN = 40;
/** AUDIT NAV1 (the helm): the stem (the hull's own bowZ) strikes within RAM_REACH (m) of the other's box, at the way she
 *  came in with - the most of the last RAM_MEMORY_S (s), as the collider takes a bow's way off at the planking it meets. */
export const RAM_REACH = 1.2;
export const RAM_MEMORY_S = 0.6;
/** One ram a ship a stretch (s). */
export const RAM_COOLDOWN_S = 3;

/**
 * Where a stem at `p` meets `box` (an oriented hull box, navalShips.js hullBoxOf's: `c`, `ax` her beam, `az` her keel,
 * `h` the half extents) on the flat, within `reach` of it: the FACE it meets - her side (`side`), or her bow or stern -
 * the one it stands farthest outside of (least inside, for a stem already in her planking), and that face's outward
 * normal on the flat. Null out of reach.
 * @param {{ c: number[], ax: number[], az: number[], h: number[] }} box @param {number[]} p
 * @returns {{ side: boolean, normal: number[] } | null}
 */
export function ramContact(box, p, reach = RAM_REACH) {
  const l = [p[0] - box.c[0], p[1] - box.c[1], p[2] - box.c[2]];
  const x = l[0] * box.ax[0] + l[1] * box.ax[1] + l[2] * box.ax[2];
  const z = l[0] * box.az[0] + l[1] * box.az[1] + l[2] * box.az[2];
  const mx = Math.abs(x) - box.h[0],
    mz = Math.abs(z) - box.h[2];
  if (mx > reach || mz > reach) return null;
  const side = mx >= mz;
  const a = side ? box.ax : box.az,
    s = (side ? x : z) < 0 ? -1 : 1;
  const len = Math.hypot(a[0], a[2]) || 1;
  return { side, normal: [(s * a[0]) / len, 0, (s * a[2]) / len] };
}

/** The closing way (m/s) toward a face with outward `normal`: the most, over the stem's ship's ways `ways` (its velocity
 *  over the last moments - one for a ship whose way is never taken at the planking), of its way less `her` own, along it. */
export function ramClosing(ways, her, normal) {
  let most = -Infinity;
  for (const w of ways) most = Math.max(most, -((w[0] - her[0]) * normal[0] + (w[2] - her[2]) * normal[2]));
  return most;
}

/**
 * The blow of a ram (hull points), before her line: none under RAM_SPEED of `closing` way; else the stem's share of the
 * lesser of the two whole hulls (`mine` the rammer's, `hers` the struck ship's), times the pace and the face.
 * @param {{ closing: number, side: boolean, mine: number, hers: number, galley?: boolean }} ram
 */
export function ramBlow({ closing, side, mine, hers, galley = false }) {
  if (!(closing >= RAM_SPEED)) return 0;
  const pace = Math.min(1, closing / RAM_FULL_SPEED);
  const lesser = Math.max(0, Math.min(Number(mine) || 0, Number(hers) || 0));
  return Math.round((galley ? GALLEY_SHARE : RAM_SHARE) * lesser * pace * (side ? 1 : RAM_GLANCE));
}

/** A hull's line (navalDamage.js createShipDamage's `damage`): STRUCK_AT of her whole - a ram lands with it as its floor
 *  (apply's `floor`), so it takes her to it and never under. */
export const ramLine = (damage) => damage.maxHull * STRUCK_AT;
/** The hull a ram may still take from `damage`: down to her line (none from a hull at it or under). */
export const ramRoom = (damage) => Math.max(0, damage.hull - ramLine(damage));
/** The whole hull points a ram's recoil may take from the rammer's `damage`: a whole point short of her room, so her own
 *  ram never brings her to strike (her hull stays over her line). */
export const recoilRoom = (damage) => Math.max(0, Math.floor(ramRoom(damage) - 1));

/** The share of a blow a stem takes back: BOW_RECOIL x RAM_RECOIL on a plain stem, RAM_RECOIL / GALLEY_RAM on a galley's
 *  (before the brace and the Captain's Due). */
export const recoilShare = (galley = false) => RAM_RECOIL * (galley ? 1 / GALLEY_RAM : BOW_RECOIL);
/** A `blow` as hard as the rammer can pay for: its recoil (`k` of it) within her recoil `room`. A hull at its line rams
 *  nothing. */
export const ramPaid = (blow, room, k) => (k > 0 ? Math.min(blow, Math.floor(room / k)) : blow);

/** The men a ram that `dealt` hull takes, as the wire says them (before her toughness). */
export const ramMenSaid = (dealt) => Math.round(dealt / RAM_A_MAN);
/** The whole men a ram that `dealt` hull takes, over her crew's toughness `tough` on the `roll`. */
export const ramMen = (dealt, roll, tough) => ballMen(dealt / RAM_A_MAN, roll, tough);
