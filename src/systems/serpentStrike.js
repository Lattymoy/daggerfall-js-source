// @ts-check
// SERPENT1 (2026-10-04, Mac: "a large scale sea serpent in the ocean"): WHAT SETHRAKUL'S BLOWS DO, judged on the struck
// player's own machine (co-op's law, and the sea's victim's law - scenes/navalHost.js landHit): each attack's shape
// against the hull of MY ship and my own feet, the hurt it does her (a share of her whole and points on top, so a
// rowboat and a carrack feel each blow alike), the throw it gives her, the coil's grip and crush, the maelstrom's pull,
// and the venom's bite. The relay never learns a ship's hurts. Design: bible/11-Multiplayer/Sea-Serpent.md section 5.
//
// THE FRAME is the site's (net/serpentBody.js): metres, x east, z north. A ship is a footprint - her middle, her
// heading and her half length and beam (`{x, z, yw, hl, hw}`); a shape meets her when it meets her bow, her middle or
// her stern (a carrack is fifty metres long - a disc that takes her stern takes her).
//
// PURE. Not a DFU member. Ledger A (SERPENT1).
import { SERPENT_ATTACK_TABLE, SERPENT_ATTACK_BY_ID, CRUSH, GRIP, MAEL_R, MAEL_EYE_R, MAEL_PULL, MAEL_SWIRL, MAEL_GRIND, SPIT_FLIGHT_MS, ramLen, RAM_V, serpentWrapYaw } from '../net/serpentBrain.js';

/** The points of her a shape is tested at: her bow, her middle and her stern. */
export function shipPoints(boat) {
  const fx = Math.sin(boat.yw) * boat.hl, fz = Math.cos(boat.yw) * boat.hl;
  return [[boat.x + fx, boat.z + fz], [boat.x, boat.z], [boat.x - fx, boat.z - fz]];
}

/**
 * Does attack `atk` (its word - net/serpentBrain.js serpentAtkFrame) meet ship `boat` at `t`? The lane is the ram's: its head
 * has run `RAM_V` m/s down it from its landing, and a ship is met once that run has reached her (her beam's width
 * across it); the ring is the coil's (any of her inside it at the landing); the rest are met at the landing.
 */
export function shapeMeets(atk, boat, t = atk?.at ?? 0) {
  const A = SERPENT_ATTACK_BY_ID[atk?.a];
  if (!A || !boat || !atk.tg?.length) return false;
  const [cx, cz] = atk.tg[0];
  const pts = shipPoints(boat);
  switch (A.shape) {
    case 'disc': return pts.some(([x, z]) => Math.hypot(x - cx, z - cz) <= A.r + boat.hw);
    case 'rings': return pts.some(([x, z]) => { const d = Math.hypot(x - cx, z - cz); return d >= A.r0 - boat.hw && d <= A.r1 + boat.hw; });
    case 'sector': return pts.some(([x, z]) => {
      const d = Math.hypot(x - cx, z - cz);
      return d <= A.r + boat.hw && (d < 1 || Math.abs(serpentWrapYaw(Math.atan2(x - cx, z - cz) - atk.yw)) <= (A.arc * Math.PI) / 360);
    });
    case 'lane': {
      const [bx, bz] = atk.tg[1] ?? atk.tg[0];
      const len = Math.hypot(bx - cx, bz - cz) || 1, ux = (bx - cx) / len, uz = (bz - cz) / len;
      const run = Math.max(0, Math.min(len, ((t - atk.at) / 1000) * RAM_V));
      return pts.some(([x, z]) => { const a = (x - cx) * ux + (z - cz) * uz, s = Math.abs((x - cx) * uz - (z - cz) * ux); return a >= -boat.hw && a <= run + boat.hw && s <= A.width / 2 + boat.hw; });
    }
    case 'ring': return pts.some(([x, z]) => Math.hypot(x - cx, z - cz) <= A.r);   // AUDIT SERPENT B5: laid where the relay saw her helm - any of her inside it
    default: return false;
  }
}
/** The ram's head down its lane at `t` (for the draw - its wake's bow wave): `[x, z]`, or null outside its run. */
export function ramHead(atk, t) {
  const A = SERPENT_ATTACK_BY_ID[atk?.a];
  if (A !== SERPENT_ATTACK_TABLE.ram || t < atk.at || t > atk.at + A.active || !atk.tg?.[1]) return null;
  const [ax, az] = atk.tg[0], [bx, bz] = atk.tg[1];
  const k = Math.min(1, ((t - atk.at) / 1000) * RAM_V / Math.max(1, ramLen()));
  return [ax + (bx - ax) * k, az + (bz - az) * k];
}

/**
 * SERPENT3 - A PAIR'S SHARE (2026-10-05, Mac's call: "Two or more ships" - "its blows scale down when fewer than three
 * ships fight it, so a pair has a real chance; one ship alone still can't"): with exactly two ships fighting it (`n`,
 * the relay's count - serpentBrain.js serpentShipsFighting, the shares in its health: AUDIT SHIPS C1) every blow, grip,
 * crush, grind and venom bite lands at SERPENT_PAIR_SHARE - each of a pair takes what each of three would; a lone ship,
 * and three or more, the whole.
 */
export const SERPENT_PAIR_SHARE = 2 / 3;
export const fleetShare = (n) => (n === 2 ? SERPENT_PAIR_SHARE : 1);
/** AUDIT SHIPS C3 (2026-10-06): a hurt `x` at the fleet's share `k`, in whole points - CARRIED blow to blow on her own
 *  `carry` (updated in place: the nearest whole taken, the remainder kept either way), so a pair's hurt over a fight is
 *  two thirds of the whole's. Rounded a blow at a time, a one-man blow (a spit, a roar) still took the whole man and a
 *  two-man one (a lash, a Maw) took one. The whole (`k` 1) is rounded as it always was. */
function shared(x, k, carry, key) {
  if (k === 1 || !carry) return Math.round(x * k);
  const v = x * k + (carry[key] ?? 0), n = Math.round(v);
  carry[key] = v - n;
  return n;
}
/** WHAT A BLOW DOES TO HER: `hull` of her whole hull and `base` more, `sail` of her canvas, `crew` men - her whole her
 *  refits' (`whole` - {maxHull, maxSail}), times the fleet's share `k` (fleetShare), carried on `carry` (shared). The
 *  damage model's own hurt shape (navalDamage.js apply). */
export const shipHurt = (A, whole, k = 1, carry = null) => ({ hull: shared(A.hull * whole.maxHull + A.base, k, carry, 'hull'), sail: shared(A.sail * whole.maxSail, k, carry, 'sail'), crew: shared(A.crew | 0, k, carry, 'crew') });
/** The coil's crush at its end, and its grip for `dtS` seconds (whole points carried on the ship's own fraction -
 *  `carry`, the grip's remainder - so a grip of 3.4 a second is 3.4 a second, not 3); each times the fleet's share `k`. */
export const crushHurt = (whole, k = 1, carry = null) => shipHurt(CRUSH, whole, k, carry);
export function gripHurt(whole, dtS, carry = { hull: 0, crew: 0 }, k = 1) {
  const hull = carry.hull + (GRIP.hull * whole.maxHull + GRIP.base) * dtS * k, crew = carry.crew + GRIP.crew * dtS * k;
  const out = { hull: Math.floor(hull), sail: 0, crew: Math.floor(crew) };
  return { hurt: out, carry: { hull: hull - out.hull, crew: crew - out.crew } };
}
/** The maelstrom's eye grinding her for `dtS` seconds (the grip's carry law), times the fleet's share `k`. */
export function grindHurt(whole, dtS, carry = 0, k = 1) {
  const hull = carry + (MAEL_GRIND.hull * whole.maxHull + MAEL_GRIND.base) * dtS * k;
  return { hurt: { hull: Math.floor(hull), sail: 0, crew: 0 }, carry: hull - Math.floor(hull) };
}

/**
 * THE THROW a blow gives her - the way it shoves her off hers, m/s on the flat `[vx, vz]`: away from where it came from
 * (the lash's sweep, the breach's burst, the roar's blast), across the ram's lane.
 */
export function shoveOf(atk, boat) {
  const A = SERPENT_ATTACK_BY_ID[atk?.a];
  if (!A || !(A.shove > 0) || !atk.tg?.length) return [0, 0];
  let dx = boat.x - atk.tg[0][0], dz = boat.z - atk.tg[0][1];
  if (A.shape === 'lane' && atk.tg[1]) {
    const lx = atk.tg[1][0] - atk.tg[0][0], lz = atk.tg[1][1] - atk.tg[0][1], l = Math.hypot(lx, lz) || 1;
    const side = Math.sign(dx * (lz / l) - dz * (lx / l)) || 1;
    dx = (lz / l) * side; dz = (-lx / l) * side;
  }
  const d = Math.hypot(dx, dz) || 1;
  return [(dx / d) * A.shove, (dz / d) * A.shove];
}
/** A throw's way left `ageS` seconds after it was given: it dies away over SHOVE_S. */
export const SHOVE_S = 2.5;
export const shoveLeft = (v, ageS) => { const k = Math.max(0, 1 - ageS / SHOVE_S); return [v[0] * k, v[1] * k]; };

/**
 * THE MAELSTROM'S PULL on a ship at (x, z) at `t`: `[vx, vz]` m/s (toward its heart, harder near it, and round it -
 * the whirl turns as the serpent circles it), growing in over MAEL_GROW_MS from its forming; `eye` whether she is in
 * the eye that grinds her. None past MAEL_R.
 */
export const MAEL_GROW_MS = 4000;
export function maelPull(mael, x, z, t) {
  if (!mael || t < mael.at) return { v: [0, 0], eye: false, k: 0 };
  const dx = mael.x - x, dz = mael.z - z, d = Math.hypot(dx, dz);
  if (d > MAEL_R || d < 1e-6) return { v: [0, 0], eye: d <= MAEL_EYE_R, k: 0 };
  const grow = Math.min(1, (t - mael.at) / MAEL_GROW_MS), near = 1 - d / MAEL_R;
  const inward = (MAEL_PULL[0] + (MAEL_PULL[1] - MAEL_PULL[0]) * near) * grow, swirl = MAEL_SWIRL * near * grow;
  const ux = dx / d, uz = dz / d;
  // the swirl: the inward way turned a quarter (clockwise from above - the way the serpent circles the eye)
  return { v: [ux * inward + uz * swirl, uz * inward - ux * swirl], eye: d <= MAEL_EYE_R, k: grow };
}

/** THE SPIT'S GLOB in the air: `[x, y, z]` (y over the sea) at `t`, from the jaws to its mark over SPIT_FLIGHT_MS before
 *  the landing - or null outside its flight. */
export function globAt(atk, t, jawY = 14) {
  if (SERPENT_ATTACK_BY_ID[atk?.a] !== SERPENT_ATTACK_TABLE.spit || !atk.tg?.[0]) return null;
  const from = atk.at - SPIT_FLIGHT_MS;
  if (t < from || t > atk.at) return null;
  const k = (t - from) / SPIT_FLIGHT_MS, [bx, bz] = atk.tg[0];
  return [atk.x + (bx - atk.x) * k, jawY * (1 - k) + 22 * k * (1 - k), atk.z + (bz - atk.z) * k];
}
/** A pool of venom where a spit landed: `{x, z, r, at, until, pct, base}`. */
export const poolOf = (atk) => { const P = SERPENT_ATTACK_TABLE.spit.pool; return { x: atk.tg[0][0], z: atk.tg[0][1], r: P.r, at: atk.at, until: atk.at + P.ms, pct: P.pct, base: P.base }; };
/** Does venom pool `p` bite a player at (x, z) at `t` (standing in it, on a deck or the water)? */
export const poolBites = (p, x, z, t) => t >= p.at && t < p.until && Math.hypot(x - p.x, z - p.z) <= p.r;
