// @ts-check
// KETCH (bible/11-Multiplayer/Sky-Ketch.md section 8): THE SHIP'S BLOWS JUDGED WHERE THE CLIENT CANNOT SKIP THEM - the
// constructs' blows and the ship's own hazards (the gallery's hammers and steam, the hold's arc-coils) on the relay's
// trails, net/bossRef.js's law rung for rung: a body struck only standing BODY_MARGIN deep in a stamp where its last pose
// before the landing put it and where its first after does, and on the blow's own storey (its floor's height). A blow
// with a span (a hammer down, a steam lane bursting, an arc live) also catches a pose sent inside it while it lasts - and
// A LANE CROSSED while it lasts: two poses on its two sides, both sent inside its span, the line between them through it.
// An arc-coil's lane is narrower than the margin (no pose stands deep in it), and the way from the cradles to the engine
// runs across every one: the carrier's own two words either side are the crossing, in the struck player's favour still (a
// crossing that straddles the arc's waking or its dying is not counted).
//
// WHAT IT ANSWERS: `hits` - each plain blow's share (an element's is the struck member's own save, never counted; the
// Tonal Wave is jumped, which a pose cannot say); and `struck` - EVERY account a blow or hazard of any kind met, element
// or plain, whose cell it knocks from its hands (net/ketch/ketchBrain.js dropCell - the arc-coils' law, and every blow's on
// a carrier). The Warden's own are its fight's (net/ketch/ketchWarden.js judgeWarden).
//
// PURE: the voyage, its bodies (`{sub, x, z, y, dead, tr}` - `tr` the relay's trail `[[t, x, z, y], ...]`, the deck's
// frame), the clock in; its blows marked in place (`bj` judged, `bh` the bodies a span caught). Not a DFU member.
// Ledger A (KETCH).
import { posAt, posAfter, posYAt } from '../bossRef.js';
import { deepIn, BODY_AFTER_MS } from '../bossBody.js';
import { egInShape } from '../eliteGates/egShape.js';
import { hazardsBetween, deckZoneAt } from './ketchDeck.js';

/** A body stands on a blow's storey within this of its floor's height. */
export const KT_STOREY_BAND = 2.5;
/** The longest stretch of the shared clock one beat judges hazards over (s) - a woken room's gap is not a gale of hammers. */
export const KT_HAZARD_SPAN_S = 2;

const inBlow = (a, x, z) => (a.s ?? []).some((s) => egInShape(s, x, z));
/** Is body `b` deep in blow `a` at its landing - before it and after it both, on its storey? */
function deepAtLanding(a, b) {
  const p0 = posAt(b, a.at), p1 = posAfter(b, a.at);
  if (!p0) return false;
  const y0 = posYAt(b, a.at);
  if (Number.isFinite(a.y) && Number.isFinite(y0) && Math.abs(y0 - a.y) > KT_STOREY_BAND) return false;
  const test = (x, z) => inBlow(a, x, z);
  return deepIn(test, p0[0], p0[1]) && deepIn(test, p1[0], p1[1]);
}
/** Did a pose of body `b` sent in (from, until] stand in blow `a` (deep, on its storey)? */
function caughtWhile(a, b, from, until) {
  for (const e of b.tr ?? []) {
    if (e[0] <= from || e[0] > until) continue;
    if (Number.isFinite(a.y) && Number.isFinite(e[3]) && Math.abs(e[3] - a.y) > KT_STOREY_BAND) continue;
    if (deepIn((x, z) => inBlow(a, x, z), e[1], e[2])) return true;
  }
  return false;
}
/** Which side of lane stamp `s`'s line (x, z) stands on. */
const sideOf = (s, x, z) => (s[3] - s[1]) * (z - s[2]) - (s[4] - s[2]) * (x - s[1]);
/** Does the walk from (x0, z0) to (x1, z1) cross lane stamp `s` - its two ends either side of the lane's line, where it
 *  crosses inside the lane? */
function crossesLane(s, x0, z0, x1, z1) {
  const d0 = sideOf(s, x0, z0), d1 = sideOf(s, x1, z1);
  if (!(d0 * d1 < 0)) return false;
  const t = d0 / (d0 - d1);
  return egInShape(s, x0 + (x1 - x0) * t, z0 + (z1 - z0) * t);
}
/** Did body `b` cross a lane of blow `a` between two poses both sent in (from, until], on its storey? */
function crossedWhile(a, b, from, until) {
  const lanes = (a.s ?? []).filter((s) => s[0] === 'l'), tr = b.tr ?? [];
  if (!lanes.length) return false;
  const off = (e) => Number.isFinite(a.y) && Number.isFinite(e[3]) && Math.abs(e[3] - a.y) > KT_STOREY_BAND;
  for (let k = 1; k < tr.length; k++) {
    const p = tr[k - 1], q = tr[k];
    if (p[0] <= from || q[0] > until || off(p) || off(q)) continue;
    if (lanes.some((s) => crossesLane(s, p[1], p[2], q[1], q[2]))) return true;
  }
  return false;
}
/** One blow judged on the living: its plain share into `hits`, every account it met into `struck`; marked once done. */
function judgeOne(a, live, now, hits, struck) {
  if (a.bj || now < a.at + BODY_AFTER_MS) return;
  a.bh ??= [];
  const sp = Math.max(0, a.sp ?? 0), share = a.el == null && !a.jp ? Math.min(1, Math.max(0, a.p)) : 0;
  for (const b of live) {
    if (a.bh.includes(b.sub)) continue;
    const met = deepAtLanding(a, b) || (sp > 0 && (caughtWhile(a, b, a.at, Math.min(now, a.at + sp)) || crossedWhile(a, b, a.at, Math.min(now, a.at + sp))));
    if (!met) continue;
    a.bh.push(b.sub);
    if (!a.jp) struck.add(b.sub);
    if (share > 0) hits.push({ sub: b.sub, share });
  }
  if (now >= a.at + sp + BODY_AFTER_MS) a.bj = true;
}

/**
 * THE SHIP'S BLOWS AND HAZARDS judged this beat: the constructs' (`V.blows`) and the hazards landed since the last beat
 * (`V.hzAt`, the shared seconds judged to - net/ketch/ketchDeck.js hazardsBetween, the gallery's while a member stands on
 * the gun deck, the hold's while one stands in the hold). Answers `{ hits, struck }`.
 * @param {any} V @param {Array<{sub: string, x: number, z: number, y?: number, dead: boolean, tr?: number[][]}>} bodies
 * @param {number} now relay ms
 */
export function judgeVoyage(V, bodies, now) {
  const hits = [], struck = new Set();
  const live = bodies.filter((b) => !b.dead && V.players?.[b.sub]);
  for (const a of V.blows ?? []) judgeOne(a, live, now, hits, struck);
  const zones = new Set(live.map((b) => deckZoneAt(b.x, b.y ?? 0, b.z)));
  const gallery = zones.has('gallery') || zones.has('landing'), hold = zones.has('hold');
  const t1 = (now - BODY_AFTER_MS) / 1000, t0 = Math.max(Number.isFinite(V.hzAt) ? V.hzAt : t1 - 0.25, t1 - KT_HAZARD_SPAN_S);
  V.hzq ??= [];
  if ((gallery || hold) && t1 > t0) for (const hz of hazardsBetween(t0, t1, { gallery, hold })) V.hzq.push(hz);
  V.hzAt = t1;
  for (const hz of V.hzq) judgeOne(hz, live, now, hits, struck);
  V.hzq = V.hzq.filter((hz) => !hz.bj).slice(-64);
  return { hits, struck };
}
