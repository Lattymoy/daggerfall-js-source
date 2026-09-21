// @ts-check
// BLOOD2c - A WOUNDED BODY BLEEDS, AND A DEAD ONE BLEEDS OUT (2026-09-21,
// Mac: "make it even more visceral and detailed").
//
// The reference (bible/05-Combat/Blood-Arc.md, "Player bleeding") bleeds
// the PLAYER: below a health threshold, every 2..5 seconds, a spawn whose
// particle count ramps from nothing at the threshold to MaxParticles at
// one percent. This port turns that shape on the FOES, because a foe you
// have cut to half its health should leave a trail you can follow, and a
// foe you have killed should lie in a pool that spreads.
//
//   THE TRAIL: under BLEED_THRESHOLD of its health, a body drips every
//   BLEED_WAIT.min..max seconds (the reference's cadence), a spray of
//   `round(share * BLEED_DROPS_MAX)` small drops at its feet - so a
//   walking foe leaves them in a line, and a standing one a stain that
//   grows. `share` is the reference's ramp: 0 at the threshold, 1 at one
//   percent.
//
//   THE POOL: the first frame a body is seen dead WITH a corpse (a foe
//   removed by a quest or walked off the map has no body and leaves no
//   pool), one pool mark at its feet that spreads from POOL_SIZE.start
//   to POOL_SIZE.end over POOL_SPREAD seconds, in POOL_STEPS rewrites.
//
// NO RENDERER, NO POOL, NO HOST. This ledger reads bodies through a VIEW
// the host hands it - { feet, health, maxHealth, bloodIndex, dead,
// corpse } - and answers ACTIONS; the splash pool turns them into marks.
// A bloodless body (bloodIndex 2) neither drips nor pools.
import { marksBlood } from './bloodDecals.js';
import { GIB_SPLASH_RATE } from './bloodGibs.js';

/** Below this share of its health a body bleeds. The port's own: the
 *  reference's threshold is a setting; half is where a fight has clearly
 *  gone one way. */
export const BLEED_THRESHOLD = 0.5;
/** The reference's cadence: every 2..5 seconds, random. */
export const BLEED_WAIT = Object.freeze({ min: 2, max: 5 });
/** The reference's MaxParticles is 40; a mark is not a particle, and six
 *  small drops at the feet read as a body bleeding rather than a body
 *  emptying. The port's own. */
export const BLEED_DROPS_MAX = 6;
/** How far a drip's drops fall from the feet, and the size ladder they
 *  take: the gib's splat rate - one piece landing, not a body opening -
 *  and THE GIB'S OWN NUMBER, not a second copy of it (BLOOD AUDIT 4). */
export const BLEED_RADIUS = 0.35;
export const BLEED_RATE = GIB_SPLASH_RATE;

/** The corpse's pool: from a body's width to a metre and a half, over
 *  twelve seconds, in eight rewrites. The port's own numbers. */
export const POOL_SIZE = Object.freeze({ start: 0.45, end: 1.5 });
export const POOL_SPREAD = 12;
export const POOL_STEPS = 8;

/** BLOOD2d: A BODY'S STRIDE. A foe's feet are streamed, not stepped, so
 *  its steps are counted off the ground it covers: one every STRIDE. */
export const STRIDE = 0.7;
/** BLOOD AUDIT 4: A TELEPORT IS A SPEED, not a distance. The guard was
 *  "more than eight strides in one frame", which is a frame-rate: a foe
 *  running at 6 m/s covered 0.1 m a frame at sixty and 6 m a frame at
 *  one, and the one-frame hitch a texture load costs erased a running
 *  foe's whole trail. Faster than this, in metres a second, is a
 *  teleport - a stream correction, a quest move, a recentre - and
 *  nothing that walks comes near it. */
export const TELEPORT_SPEED = 40;

/** The reference's ramp: `clamp01(1 - (pct - 1) / (threshold - 1))` with
 *  pct in percent - nothing at the threshold, everything at one percent.
 *  Answered as a fraction of health rather than a percent. */
export function bleedShare(health, maxHealth, threshold = BLEED_THRESHOLD) {
  if (!(maxHealth > 0) || !(health > 0)) return 0;
  const pct = health / maxHealth;
  if (pct >= threshold) return 0;
  return Math.max(0, Math.min(1, 1 - (pct - 0.01) / (threshold - 0.01)));
}

/** How many drops a drip lays for a share - at least one once bleeding. */
export function bleedDrops(share) {
  if (!(share > 0)) return 0;
  return Math.max(1, Math.round(share * BLEED_DROPS_MAX));
}

/** The pool's size at `t` seconds into its spread, in POOL_STEPS steps. */
export function poolSizeAt(t) {
  const f = Math.max(0, Math.min(1, t / POOL_SPREAD));
  const step = Math.floor(f * POOL_STEPS) / POOL_STEPS;
  return POOL_SIZE.start + (POOL_SIZE.end - POOL_SIZE.start) * step;
}

/**
 * The ledger: one per splash pool. `tick(dt, bodies, view)` walks the
 * bodies the host hands it, reads each through `view`, and answers the
 * actions due this frame. State rides a WeakMap keyed by the body, so a
 * body that leaves the list is forgotten with it.
 */
export function createBleedLedger({ rng = Math.random } = {}) {
  /** @type {WeakMap<object, { next: number, pooled: boolean, bleeding: boolean, last: number[]|null, walked: number }>} */
  let state = new WeakMap();
  const wait = () => BLEED_WAIT.min + rng() * (BLEED_WAIT.max - BLEED_WAIT.min);

  function tick(dt, bodies, view) {
    const out = [];
    if (!(dt > 0) || !bodies) return out;
    for (const body of bodies) {
      if (!body) continue;
      const v = view ? view(body) : body;
      if (!v || !v.feet || !marksBlood(v.bloodIndex ?? 0)) continue;
      // BLOOD AUDIT 4: FEET THAT ARE NOWHERE ARE NOT FEET. A body seen on
      // its death frame with a NaN in its feet spent its one pool on a
      // point the ring refused, and never pooled again.
      if (!Number.isFinite(v.feet[0]) || !Number.isFinite(v.feet[1]) || !Number.isFinite(v.feet[2])) continue;
      let s = state.get(body);
      // BLOOD AUDIT 4: A BODY FIRST SEEN DEAD HAS ALREADY BLED OUT - a
      // corpse a save restored, a room re-entered, a foe a peer killed
      // before this ledger was born. Its blood is not on this floor and
      // never was, and a pool that starts spreading under a body that
      // died an hour ago is a body dying twice.
      if (!s) { s = { next: wait(), pooled: !!v.dead, bleeding: false, last: null, walked: 0 }; state.set(body, s); }
      // BLOOD2d: THE STEPS, off the ground covered - alive or not (a
      // corpse does not walk, but the ledger does not have to know that:
      // it does not move). One `step` every STRIDE, ALONG the run and
      // facing the way it went (BLOOD AUDIT 4: a frame that covers two
      // strides lays two steps where the feet passed, not one where
      // they stopped - and the remainder carries).
      if (s.last) {
        const dx = v.feet[0] - s.last[0], dy = v.feet[1] - s.last[1], dz = v.feet[2] - s.last[2];
        const run = Math.hypot(dx, dz);
        if (run > 0 && run <= TELEPORT_SPEED * dt) {
          const fx = dx / run, fz = dz / run;
          for (let a = STRIDE - s.walked; a <= run; a += STRIDE) {
            const f = a / run;
            out.push({ kind: 'step', body, pos: [s.last[0] + dx * f, s.last[1] + dy * f, s.last[2] + dz * f], forward: [fx, 0, fz] });
          }
          s.walked = (s.walked + run) % STRIDE;
        } else if (run > 0) s.walked = 0;   // a teleport is not a walk
      }
      s.last = [v.feet[0], v.feet[1], v.feet[2]];
      if (v.dead) {
        // BLEEDS OUT: once, at the feet, only with a body to bleed from
        if (!s.pooled && v.corpse) { s.pooled = true; out.push({ kind: 'pool', body, pos: [v.feet[0], v.feet[1], v.feet[2]], bloodIndex: v.bloodIndex ?? 0 }); }
        s.bleeding = false;
        continue;
      }
      // BLOOD AUDIT 4: ALIVE AGAIN IS A NEW LIFE. The dungeon's load and
      // the online stream un-death a foe IN PLACE (the same record),
      // so the latch that says "this body has pooled" was the previous
      // life's, and the foe killed a second time lay in no pool.
      s.pooled = false;
      const share = bleedShare(v.health, v.maxHealth);
      if (!(share > 0)) {
        // healed past the threshold: the next wound starts a fresh wait
        if (s.bleeding) { s.bleeding = false; s.next = wait(); }
        continue;
      }
      s.bleeding = true;
      s.next -= dt;
      if (s.next > 0) continue;
      s.next = wait();
      out.push({ kind: 'drip', body, pos: [v.feet[0], v.feet[1], v.feet[2]], bloodIndex: v.bloodIndex ?? 0, count: bleedDrops(share), share });
    }
    return out;
  }

  /** BLOOD AUDIT 4: THE ROOM THROWN AWAY takes the ledger's memory with
   *  it - what was pooled, what was walked - so the bodies of the next
   *  room (or the same room, reloaded) are met fresh. A WeakMap cannot
   *  be emptied; it is replaced. */
  function clear() { state = new WeakMap(); }

  return { tick, clear, _state: (body) => state.get(body) ?? null };
}
