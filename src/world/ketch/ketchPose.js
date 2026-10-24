// @ts-check
// KETCH (bible/11-Multiplayer/Sky-Ketch.md sections 3 and 8): WHERE THE KETCH'S MOVING PARTS STAND AT A MOMENT - pure, read
// by the deck's set (scenes/ketch/ketchDeckHost.js) and pinned by its tests. Every clock here is the law's (net/ketch/
// ketchDeck.js - the shared clock's seconds every screen and the relay read alike), so the hammer a screen draws slamming
// is the one the relay judges, and the section a screen draws falling is the one the room let fall.
//
//   A HAMMER'S HEAD (hammerHeadY): at rest under its housing; drawn back up its wind-up (KT_HAMMER.wu); slammed to the deck
//     at its landing and held there its span (KT_HAMMER.sp); hauled back up to rest.
//   A STEAM LANE, AN ARC (hazardState): quiet, hissing or crackling through its wind-up, live through its span.
//   A SECTION OF THE BRIDGE'S OUTER RING (sectionPose): whole; lurching through its warning (KT_SECTION_LURCH_HZ, under the
//     flash law); fallen at its moment and dropping away out of sight; gone; and risen back into its place in the last
//     KT_SECTION_RISE_MS before it is whole.
//
// Not a DFU member. Ledger A (KETCH).
import { KT_HAMMER, KT_STEAM, KT_ARCS, KT_GALLERY, hammerPhase } from '../../net/ketch/ketchDeck.js';

/** A hammer's head's foot (deck y) at rest, drawn back and slammed home; how long its slam takes and its haul back. */
export const KT_HAMMER_POSE = Object.freeze({ rest: KT_GALLERY.y + 3.0, top: KT_GALLERY.y + 4.3, floor: KT_GALLERY.y + 0.02, slam: 0.12, haul: 0.7 });
const ease = (k) => { const x = Math.max(0, Math.min(1, k)); return x * x * (3 - 2 * x); };
const wrap = (t, c) => ((t % c) + c) % c;

/** Hammer (row `ri`, lane `li`)'s head's foot at shared second `t` (deck y). Pure. */
export function hammerHeadY(ri, li, t) {
  const H = KT_HAMMER, P = KT_HAMMER_POSE, c = H.cycle, sp = H.sp / 1000, wu = H.wu / 1000;
  const u = wrap(t - hammerPhase(ri, li), c);   // seconds since its last landing
  if (u < sp) return P.floor;
  if (u < sp + P.haul) return P.floor + (P.rest - P.floor) * ease((u - sp) / P.haul);
  if (u < c - wu) return P.rest;
  if (u < c - P.slam) return P.rest + (P.top - P.rest) * ease((u - (c - wu)) / (wu - P.slam));
  return P.top + (P.floor - P.top) * ((u - (c - P.slam)) / P.slam) ** 2;
}

/**
 * A steam lane's or an arc's state at shared second `t`: `{ live, warn, k }` - live through its span from each landing,
 * warning through its wind-up before (`k` how far into the wind-up, 0..1). `kind` 'steam' or 'arc', `j` its place. Pure.
 */
export function hazardState(kind, j, t, out = { live: false, warn: false, k: 0 }) {
  const H = kind === 'steam' ? KT_STEAM : KT_ARCS;
  const u = wrap(t - hazardPhase(kind, j), H.cycle), sp = H.sp / 1000, wu = H.wu / 1000;
  if (u < sp) { out.live = true; out.warn = false; out.k = 1; } else if (u >= H.cycle - wu) { out.live = false; out.warn = true; out.k = (u - (H.cycle - wu)) / wu; } else { out.live = false; out.warn = false; out.k = 0; }
  return out;   // `out` written in place (a frame's own - AUDIT KETCH L3-16: a new record each hazard each frame)
}

/** A steam lane's or an arc's phase in its cycle (s): the lanes half a cycle apart, the arcs a third. */
export const hazardPhase = (kind, j) => (kind === 'steam' ? (j * KT_STEAM.cycle) / 2 : (j * KT_ARCS.cycle) / 3);
/** WHICH STRIKE a steam lane or an arc is on at shared second `t`: its landings counted from the clock's zero (the last
 *  one at or before `t`) - one number a strike, so a look that changes a strike at a time holds still through it
 *  (KETCH-LOOK KL0: the arcs swapped their four frames 16.7 times a second, past the flash law's 3 Hz). Pure. */
export function hazardStrike(kind, j, t) {
  const H = kind === 'steam' ? KT_STEAM : KT_ARCS;
  return Math.floor((t - hazardPhase(kind, j)) / H.cycle);
}

/** How far a fallen section drops before it is out of sight (m), how fast (m/s^2), and how long its rise back takes (ms). */
export const KT_SECTION_DROP = Object.freeze({ seen: 60, g: 14, shudder: 0.06 });
export const KT_SECTION_RISE_MS = 1200;
/** A warned section's lurch (Hz): under the flash law's 3 Hz (`render/gate/gateTelegraph.js` TELEGRAPH_THROB_MAX_HZ) and
 *  its heartbeat ceiling of 2.5 (KETCH-LOOK KL0: it shook at 6.9 Hz - a sine of now / 23 ms). */
export const KT_SECTION_LURCH_HZ = 1.5;
/**
 * Section `k`'s pose at relay ms `now` from the fight's word of the ring (`sec` - `[[k, at, back], ...]`, the wire's): `{
 * solid, dy, shake, hidden }` - solid (its collider in place) until its moment and again from its return; `dy` its drop
 * (0 whole, negative falling or rising back), `shake` its shudder through its warning, `hidden` once out of sight.
 * `warnMs` how long its warning runs before its moment. Pure.
 */
export function sectionPose(k, sec, now, warnMs, out = { solid: true, dy: 0, shake: 0, hidden: false }) {
  const put = (solid, dy, shake, hidden) => { out.solid = solid; out.dy = dy; out.shake = shake; out.hidden = hidden; return out; };   // `out` written in place (AUDIT KETCH L3-16)
  let s = null;
  for (const e of sec ?? []) if (e[0] === k) { s = e; break; }
  if (!s || now >= s[2]) return put(true, 0, 0, false);
  const at = s[1], back = s[2];
  if (now < at - warnMs) return put(true, 0, 0, false);
  if (now < at) return put(true, 0, KT_SECTION_DROP.shudder * Math.sin((2 * Math.PI * KT_SECTION_LURCH_HZ * now) / 1000) * ((now - (at - warnMs)) / warnMs), false);
  const D = KT_SECTION_DROP;
  if (now >= back - KT_SECTION_RISE_MS) { const k2 = (back - now) / KT_SECTION_RISE_MS; return put(false, -D.seen * k2 * k2, 0, false); }
  const f = (now - at) / 1000, dy = -0.5 * D.g * f * f;
  return dy < -D.seen ? put(false, -D.seen, 0, true) : put(false, dy, 0, false);
}
