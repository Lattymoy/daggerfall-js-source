// @ts-check
// SD8d (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 10): THE BRASS REMNANT'S BLOWS
// ON ME - judged on the struck player's own machine, as the gate's are (net/gateStrike.js: co-op's law, "an enemy's strike
// on a client is applied by that client"), from the words the realm says (net/sdFightLink.js) and the geometry the law
// shares with every screen (net/sdRemnant.js stompRingAt, ringPassed, handSwept, behindPillar). Pure: a blow, where I
// stand (the arena's frame), two frames' moments on the relay's clock and whether I stood on the ground between them; the
// strikes it lands on me out.
//
//   THE STOMP - its disc as it lands (`r` about its feet); then its ring rolling out to `r1`: a body ON THE GROUND as the
//     front's centre crosses it is struck (a body in the air lets it pass under) - each part once a blow.
//   THE HOUR-HAND - its beam sweeping a half-circle over its span: struck as it passes over me, within its length -
//     unless a pillar stands between me and where it was cast from.
//   THE GEAR VOLLEY - a disc at each mark as it lands (one strike however many meet me); the brass then burns there
//     (`pool`), a bite each POOL_TICK_MS I stand in it, the first a tick after I stepped in (the gate's law).
//   THE HOUR'S OWN - the Mantella Pulse (pulsePct of its count), the Reset as it lands (its Hearts left standing - a
//     broken Reset never lands: the stun's word takes it out of flight) and the Hour's End: the whole arena, no save.
//
// A landing this screen first sees later than SD_STRIKE_LATE_MS after it is not judged (a hidden tab, a stalled frame -
// the gate's AUDIT WB B7 law): the relay never learns who was struck, and a stale verdict would be a blow nobody saw. Nor
// a rolling part (the ring, the beam) over a span that ends SD_STRIKE_LATE_MS past it (AUDIT SD II, L4 F6).
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { SD_BLOW_BY_ID, SD_BLOWS, SD_RESET_PCT, SD_END_PCT, SD_ARENA_SLACK, pulsePct, stompFrontAt, ringPassed, handSwept, behindPillar, inArena } from './sdRemnant.js';
import { STRIKE_LATE_MS } from './gateStrike.js';

/** A landing first seen later than this is not judged (the gate's). */
export const SD_STRIKE_LATE_MS = STRIKE_LATE_MS;
const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

/**
 * ONE BLOW JUDGED over the span `t0`..`t1` on me at (px, pz) - the strikes it lands (`hits`, each `{ part, pct, base }`
 * - a share of my own maximum health and a base, net/gateStrike.js strikeDamage), what of it has been judged (`seen`,
 * carried from the frame before), and whether it is DONE (nothing of it can strike me again). `grounded`: I stand on the
 * ground this frame.
 * @param {any} atk a blow as the page holds it ({a, at, x, z, yw, tg, sw?, n?}) @param {number} px @param {number} pz
 * @param {number} t0 @param {number} t1 @param {boolean} grounded @param {Record<string, boolean>} [seen]
 * @returns {{ hits: Array<{part: string, pct: number, base: number}>, seen: Record<string, boolean>, done: boolean }}
 */
export function sdBlowVerdict(atk, px, pz, t0, t1, grounded, seen = {}) {
  const A = atk ? SD_BLOW_BY_ID[atk.a] : null;
  const hits = [], out = { ...seen };
  if (!A) return { hits, seen: out, done: true };
  if (t1 < atk.at) return { hits, seen: out, done: false };   // still winding up
  const late = t1 - atk.at > SD_STRIKE_LATE_MS;
  const landing = (part) => {   // the landing's moment, judged once - never one first seen long after
    if (out[part]) return false;
    out[part] = true;
    return !late;
  };
  const end = atk.at + Math.max(A.active, 0);
  // AUDIT SD II (L4 F6): a rolling part over a span that ends this late past it is done, with no hit - the gate's rolling
  // charge's law (net/gateStrike.js strikeVerdict). A tab hidden across a Stomp's landing and shown 2.5 s on was struck by
  // its ring, one shown 4.9 s into a Hand by its beam: the page judges the span from the last frame it drew
  const stale = t1 > end + SD_STRIKE_LATE_MS;
  switch (A.shape) {
    case 'stomp': {
      const d = dist(px, pz, atk.x, atk.z);
      if (landing('disc') && d <= A.r) hits.push({ part: 'disc', pct: A.pct, base: A.base });
      // AUDIT SD II (L4 F7): the ring judged ONCE, the frame its front's centre crosses me, on that frame's ground - where
      // I stood the frame before kept (`ro`: outside its front), so a body running out with it is crossed once and one
      // running in through it is never past its centre unjudged. The band was judged whole, on any grounded frame inside
      // it: running out with it at 7-10 m/s, it stayed over a body longer than any jump
      if (!out.ring && !stale && t0 <= end) {
        const was = out.ro ?? d > stompFrontAt(atk, t0);
        out.ro = d > stompFrontAt(atk, t1);
        if (ringPassed(atk, d, t0, t1, was)) {
          out.ring = true;
          if (grounded) hits.push({ part: 'ring', pct: A.ringPct, base: A.ringBase });
        }
      }
      return { hits, seen: out, done: t1 > end };
    }
    case 'sweep': {
      if (!out.beam && !stale && t0 <= end && handSwept(atk, px, pz, Math.max(t0, atk.at), t1) && !behindPillar(atk.x, atk.z, px, pz)) {
        out.beam = true;
        hits.push({ part: 'beam', pct: A.pct, base: A.base });
      }
      return { hits, seen: out, done: !!out.beam || t1 > end };
    }
    case 'disc': {
      if (landing('discs') && (atk.tg ?? []).some((q) => dist(px, pz, q[0], q[1]) <= A.r)) hits.push({ part: 'discs', pct: A.pct, base: A.base });
      return { hits, seen: out, done: true };
    }
    case 'all': {
      const pct = A === SD_BLOWS.pulse ? pulsePct(atk.n ?? 0) : A === SD_BLOWS.reset ? SD_RESET_PCT : SD_END_PCT;
      if (landing('all') && inArena(px, pz, SD_ARENA_SLACK)) hits.push({ part: 'all', pct, base: A.base });   // AUDIT SD II (L4 C2): never the Steps
      return { hits, seen: out, done: true };
    }
    default: return { hits, seen: out, done: true };
  }
}

/** THE BURNING BRASS a Gear Volley leaves where it lands - a pool at each mark (`SD_BLOWS.volley.pool`), from its landing
 *  for its span. Pure. */
export function sdVolleyPools(atk) {
  const A = SD_BLOWS.volley, P = A.pool;
  if (!atk || atk.a !== A.id) return [];
  return (atk.tg ?? []).map((q) => ({ x: q[0], z: q[1], r: P.r, from: atk.at, until: atk.at + P.ms, pct: P.pct, base: P.base }));
}
/** The pool I stand in at `now`, or null. Pure. */
export function sdPoolUnder(pools, px, pz, now) {
  for (const p of pools) if (now >= p.from && now < p.until && dist(px, pz, p.x, p.z) <= p.r) return p;
  return null;
}
