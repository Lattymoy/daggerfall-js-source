// @ts-check
// EG-H1 (EG8d, 2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 21 and 10.8):
// THE FAIR TRAIL AND ITS TIME LAW - what the relay knows of where a member's body was, and when.
//
//   THE TIME LAW (section 21, "Time, before enforcement"). The relay kept its boss fights' trails timed by ARRIVAL, while
//     a client draws and resolves a landing on a clock that runs late by the welcome's one-way latency - so both poses
//     the judge read could predate the client's landing, and a dodge in its last round trip was counted as a hit. In an
//     `eg:` room each pose is placed at its SHARED time: its own `ts` (the sender's wall clock mod POSE_TS_MOD,
//     net/wire.js - unwrapped here by poseTsDiff) plus the socket's offset to relay time, the least `arrival - ts` over
//     its last EG_TS_KEEP poses (egPoseShared) - which is the send time plus the quickest way here - less the one-way
//     delay the member's own corrected clock measured (net/eliteGates/egClock.js: half its round trip, said with its `clk` ping), so
//     a pose stands at the instant it was sent. Never later than it arrived, never before the socket's last pose, never
//     more than EG_TS_LAG_MAX_MS before it arrived: a forged stamp or a forged delay buys at most the 300 ms the judge's
//     own window already allows, and a member that says no delay is placed at the quickest way's end, never before it.
//     The judge's readers (egTrailAt, egTrailAfter, egTrailNear - bossRef.js judgeShapes): where a body stood at a
//     landing is its last pose SENT at or before it; where it stood after, the first SENT after it, waited for up to
//     EG_POSE_WAIT_MS; a body with no pose within EG_POSE_NEAR_MS of the landing is not counted.
//   THE FAIR TRAIL (`spanFair`, on every `eg:` pose - egFairPose). The body trails are seconds long and a crossing takes
//     tens of seconds, so the room keeps an ONLINE accumulator per member, in the sender's own time:
//     - SUPPORT: a pose lies on a floor, a ramp or a platform's top (its footprint at that time by net/eliteGates/egSpanLaw.js
//       egPieceAt - the Steps' stepAt and beatStands - inflated by the capsule EG_BODY_R and by the platform's travel
//       over EG_SUPPORT_LAG_S), or a climb's hold beside one (the pose's `cl`), or is in the air. EG-ZB: a Falling
//       Wall's and the Collapsing Tube's fallen segments hold nothing after the hall's wake, and feet on one owe the
//       census a cast-back (egFallenAt);
//     - SPEED: no stretch faster than THE FAST BUILD's run times EG_FAIR_RUN_X, plus a push and a ride
//       (EG_FAIR_CARRY_MPS), plus EG_FAIR_SNAP_M for the snaps the game makes itself (a ring kept, a segment's cast);
//       a step back to where the member last stood (a cast-back) is no step;
//     - AIR: no airborne stretch past EG_AIR_MAX_S that is not a fall (a body dropping past EG_FALL_M under its last
//       support is cast back, not flying);
//     - BLINDNESS: a `ts` gap over EG_BLIND_MS is BLIND and judges nothing either way; a crossing more than
//       EG_FAIR_BLIND_MAX blind opens no door, and its measure says so. FIELD BUGS 2026-10-20f FAIR-STILL: a gap from
//       held ground to held ground within EG_FAIR_SNAP_M is a member STANDING STILL, never blind - a client says no pose
//       while nothing about it changes (net/online.js sendPose: every HEARTBEAT_MS, 20 s, else on a change), so a crossing
//       waited out at its timed pieces read as unseen and its door never opened (egStillGap);
//     - THE LAST ISLAND: a member's trail is fair while no stretch broke the law since it last stood on still ground (an
//       island, a plate, a passage's floor - never the end plate it is crossing to). Every pose-gated credit asks it.
//     - REPEATS: a second break within a hall refuses the member's hits for EG_FAIR_REPEAT_MS.
//     - THE CROSSING: from the hall's first judged pose to the end plate, its time against egCrossMinMs and its blind
//       share - the measure (egFairMeasure), which gates nothing until EG21. EG6a: the bound is the timed solver's
//       fastest crossing at THE FAST BUILD less 15% (net/eliteGates/egSpanLaw.js egCrossMin), no longer the course's length.
//     - EG-ZI (2026-10-12; section 10.6): THE FURTHEST FAIR POINT - the furthest along the road a held pose stood with no
//       break since the last island (`far`), and when still ground was last first stood on so (`fnew`, groundAt's keys):
//       the pull's toll counts the road still ahead of the one and is waived by the other (net/eliteGates/egBrain.js egTollOf).
//     - THE ASCENT (LAW 9, 2026-10-16; Elite-Gates-Ascent.md section 1): "along the road" and a cast-back's "behind" are
//       THE ROUTE's (net/eliteGates/egRoute.js egRouteAlongAt - the progress of the route's nearest point, by height too), never z: a
//       hall that turns, doubles back and crosses over itself is measured along its ways. Laws 4-8: their route's measure is
//       exactly their z, and every number is the number it was.
//   AUDIT EG III (2026-10-13, lane 1 #7 / lane 3 #10; section 15): SPIREBRIDGE IS GROUND WHILE IT STANDS - a plank the room
//     raised over a gap (net/eliteGates/egVestige.js egSpirebridge - `{ h, g, from, until }`, its gap's number) holds a body on its top
//     from its raising to its end (net/eliteGates/egSpanLaw.js egBridgeOf, egOnBridge): SUPPORT as a piece's (never still ground - the
//     last island stays the last island), so a member who walks it neither flies nor falls on the relay's trail.
//   RIDDEN POSES (section 10.8). A pose on a moving piece (a Drift, a Rail, a Drum) carries `pl`: the piece's index and
//     its offset from that piece's top at the sender's time (egRideOf); a receiver draws it at the piece's place on its
//     own clock plus the offset, and the relay judges it on the piece's clock position at the pose's shared time
//     (egRideAt), its offset held to the piece's top and its own feet on the piece (egRideHolds - AUDIT EG V) - a rider
//     never floats beside a swinging platform, and a pose cannot claim a piece it is not on.
//
// Pure: a pose, a spec and a clock in; the accumulator moved in place. In the relay bundle (net/eliteGates/egBrain.js); the client
// reads the ridden poses' half. Not a DFU member. Ledger A (ELITE-GATES).
//   EG-PERFECT (2026-10-18, Mac: "I want to ensure the boss attacks, the design of the halls, and everything is absolutely
//     perfect. Traversing between sections should present a challenge, platforming should be detailed"):
//     - THE COLLAPSING TUBE'S CLOCK IN A ROUTED HALL (egTubeEdgeIn): LAW 9 stands the tube's mouth 34-82 s of walking from
//       the plate, and its fall began a fixed EG_TUBE_START_MS (18 s) after the wake - always fallen before anyone reached it,
//       so the hall could not be finished. In a routed hall it falls from the instant the company reaches its mouth (the room
//       records the first fair pose within EG_TUBE_MOUTH_M - net/eliteGates/egBrain.js egPoseIn - and says it with the stage,
//       `tm`), EG_TUBE_MOUTH_S after it; laws 4-8 keep their fixed clock from the wake.
//     - THE VOID ZONES ENFORCED (egVoidCrossed; Elite-Gates-Ascent.md section 2): `spec.voids` (net/eliteGates/egAscent.js voidsOf)
//       were read by nothing - off a high bridge onto a later leg skipped 160-290 m of the way. A stretch that falls through a
//       void zone's heights within its footprint (widened by the step-off reach) from a floor over it is a fall into the void:
//       the screen casts it back (scenes/eliteGates/egSpan.js ride), the fair trail breaks and credits nothing past the floor
//       it left until the member stands there again (`vd`), and the census owes the cast-back (`vz` - egPoseIn).
//     - THE TOLL'S NEW GROUND KEYED BY ITS HERO (groundAt): a hero floor's key was its index within its own hero, `h<i>`,
//       and LAW 9 lays a hero a room - the first floor of every room after the first was "seen" already. From law 9 the key
//       is `h<hero>:<floor>`; laws 4-8 keep `h<i>`.
import { poseTsDiff } from '../wire.js';
import { egPieceAt, egCrossMin, EG_BODY_R, EG_SINK_GONE_M, EG_FAST_RUN_MPS } from './egSpanLaw.js';
import { EG_SPAN_RUN_MPS, EG_JUMP_G, EG_WAIT_MAX, EG_SET_MARGIN, EG_DROP_CM } from './egSpanLaw.js';   // EG-PERFECT: the tube's start, the step-off reach
import { egRouted } from './egRouteProof.js';   // EG-PERFECT: a hall proven over its route (LAW 9) - its tube falls from its mouth
import { egBridgeOf, egOnBridge } from './egSpanLaw.js';   // AUDIT EG III: Spirebridge's plank, ground while it stands
import { segDist, egPolyIn } from './egShape.js';   // EG-HERO-LAY: a hero's floors are polygons
import { egWallFallenZ } from './egLaw.js';   // EG-ZB: a Falling Wall's fallen edge - and the Collapsing Tube's, below
import { egTubeEdge } from './egFragLaw.js';
import { egRouteAlongAt } from './egRoute.js';   // THE ASCENT (LAW 9): progress is along the hall's route, never its z
import { egStampFloors } from './egLaw.js';   // THE ASCENT - HEIGHT: the floors a stamp lands on, the relay's own rule
import { egFeetY, egOneStorey } from './egWalkGraph.js';

// ── THE TIME LAW ─────────────────────────────────────────────────────────────────────────────────────────────
/** A socket's offset to relay time is the least `arrival - ts` over this many of its last poses. */
export const EG_TS_KEEP = 32;
/** A pose is never placed more than this before it arrived (ms) - and the judge counts no body silent this long either
 *  side of a landing (EG_POSE_NEAR_MS, the same 300 ms). */
export const EG_TS_LAG_MAX_MS = 300;
/** Where a body stood after a landing is the first pose sent after it, waited for up to this long (ms). */
export const EG_POSE_WAIT_MS = 800;
/** A body with no pose within this of a landing is not counted (ms). */
export const EG_POSE_NEAR_MS = 300;
/** The shared-time trail: this long, this many poses at most (the judge reads EG_POSE_WAIT_MS past a landing). */
export const EG_TRAIL_MS = 3000;
export const EG_TRAIL_MAX = 40;

/** A socket's pose clock, new: its `ts` unwrapped (`u`), its offsets, its last shared time, and `h` - the one-way delay its
 *  corrected clock measured (half its round trip, said with its `clk` ping - net/eliteGates/egClock.js), 0 until said. */
export const egPoseClock = () => ({ u: 0, ts: /** @type {number|null} */ (null), offs: /** @type {number[]} */ ([]), t: -Infinity, h: 0 });
/**
 * A POSE'S SHARED TIME (relay ms) at its `arrival`: its `ts` unwrapped plus the socket's offset to relay time - the least
 * `arrival - ts` over its last EG_TS_KEEP poses (a pose never arrives before it was sent, so this is the send time plus
 * the quickest way here), less the one-way delay the socket's own corrected clock measured (`C.h`, at most
 * EG_TS_LAG_MAX_MS - a member that never said one is placed at the quickest way's end, never before) - held within [its
 * arrival - EG_TS_LAG_MAX_MS, its arrival] and never before the socket's last pose. A pose with no `ts` (a client before
 * SCALE2b) stands at its arrival; one whose `ts` runs backwards is out of order - null, it judges nothing. Moves the clock.
 * @param {{u: number, ts: number|null, offs: number[], t: number, h?: number}} C @param {unknown} ts @param {number} arrival
 * @returns {number|null}
 */
export function egPoseShared(C, ts, arrival) {
  if (!Number.isInteger(ts)) { C.t = Math.max(C.t, arrival); return C.t; }
  const T = /** @type {number} */ (ts);
  if (C.ts != null) { const d = poseTsDiff(T, C.ts); if (d < 0) return null; C.u += d; }
  C.ts = T;
  C.offs.push(arrival - C.u);
  if (C.offs.length > EG_TS_KEEP) C.offs.shift();
  let off = Infinity;
  for (const o of C.offs) if (o < off) off = o;
  const h = Math.max(0, Math.min(EG_TS_LAG_MAX_MS, Number.isFinite(C.h) ? /** @type {number} */ (C.h) : 0));
  C.t = Math.min(arrival, Math.max(C.u + off - h, C.t, arrival - EG_TS_LAG_MAX_MS));
  return C.t;
}
/** A shared-time trail grown by one entry `[t, x, y, z, h]` (the hall's own frame, its hall's number), kept to
 *  EG_TRAIL_MS and EG_TRAIL_MAX. */
export function egTrailPush(tr, e) {
  tr.push(e);
  while (tr.length > EG_TRAIL_MAX || (tr.length && e[0] - tr[0][0] > EG_TRAIL_MS)) tr.shift();
  return tr;
}
/** Where the trail stood at `t`: its last entry sent at or before it, or null (not known). */
export function egTrailAt(tr, t) { let q = null; for (const e of tr ?? []) { if (e[0] <= t) q = e; else break; } return q; }
/** Where the trail stood next after `t`: its first entry sent after it, or null (none yet). */
export function egTrailAfter(tr, t) { for (const e of tr ?? []) if (e[0] > t) return e; return null; }
/** Is there an entry within EG_POSE_NEAR_MS of `t`? */
export const egTrailNear = (tr, t) => (tr ?? []).some((e) => Math.abs(e[0] - t) <= EG_POSE_NEAR_MS);
/** May a landing at `at` be judged at `now`: a pose sent after it has come, or EG_POSE_WAIT_MS has passed. */
export const egTrailReady = (tr, at, now) => now >= at + EG_POSE_WAIT_MS || !!egTrailAfter(tr, at);

// ── THE FIGHT FLOOR A BODY STANDS ON (section 11.7: "The relay's judge is 2D, per floor") ─────────────────────
/** A body is on a fight floor while its polygon holds it and its feet lie this far under it at most, and this far over. */
export const EG_FLOOR_UNDER_M = 0.5;
export const EG_FLOOR_OVER_M = 3.0;
/**
 * The fight floor (`spec.fl`) a body's feet at (x, y, z) stand on - the highest whose polygon holds it at or below its
 * height plus EG_FLOOR_UNDER_M, its feet no more than EG_FLOOR_OVER_M over it (a jumper at the fast build's 2.68 m apex is
 * still on its floor) - or null: traversal ground, where no lord or add aims a blow. Pure.
 * @param {any} spec @param {number} x @param {number} y @param {number} z
 */
export function egFightFloorAt(spec, x, y, z) {
  let best = null;
  for (const f of spec?.fl ?? []) {
    const fy = f.y ?? 0;
    if (!(fy <= y + EG_FLOOR_UNDER_M && y - fy <= EG_FLOOR_OVER_M)) continue;
    if (!(f.t === 'p' ? egPolyIn(f.poly, x, z) : f.t === 'd' ? Math.hypot(x - f.x, z - f.z) <= f.r : segDist(x, z, f.ax, f.az, f.bx, f.bz) <= f.hw)) continue;   // EG-HERO-LAY: a hero's fight floor, its polygon
    if (!best || fy > (best.y ?? 0)) best = f;
  }
  return best;
}
/**
 * THE ASCENT (Elite-Gates-Ascent.md section 2) - DOES BLOW `bl` LAND WHERE FEET AT (x, y, z) STAND (hall `spec`'s frame - its
 * fight ground, net/eliteGates/egWalkGraph.js egFightView): in a hall that judges by height, a blow that says its height (`y`) lands only
 * in its own storey (net/eliteGates/egWalkGraph.js egOneStorey - the top of the fight floor the feet stand on, else the feet) and, on a
 * fight floor, only on one of the floors under its anchor (net/eliteGates/egLaw.js egStampFloors - net/bossRef.js judgeShapes' rule), so
 * a screen's own verdict judges the floors the relay does; a blow that names its members lands wherever they stand. Anywhere
 * else - the laws before, a blow of no height - true (the screen's verdict in plan, as it was). Pure.
 * @param {any} spec @param {any} bl @param {number} x @param {number} y @param {number} z
 */
export function egBlowLandsOn(spec, bl, x, y, z) {
  const by = egFeetY(spec, bl?.y), H = egFeetY(spec, y);
  if (!Number.isFinite(by) || !Number.isFinite(H) || bl.on) return true;
  const f = egFightFloorAt(spec, x, H, z);
  if (!egOneStorey(f ? f.y ?? 0 : H, by)) return false;
  const ys = f ? egStampFloors(spec, bl.s?.[0], by) : null;
  return !ys || ys.includes(f.y ?? 0);
}

// ── RIDDEN POSES (section 10.8) ──────────────────────────────────────────────────────────────────────────────
/** The pieces a body rides (they carry it across or along: a Drift, a Rail, a Drum). */
export const EG_RIDE_KINDS = Object.freeze(['drift', 'rail', 'drum']);
/** A rider's offset over its piece's top: at most this under it and this over it (m - standing, a hop's start). */
export const EG_RIDE_DOWN_M = 0.3;
export const EG_RIDE_UP_M = 0.6;
const r2 = (v) => Math.round(v * 100) / 100;
/** The ridden piece at `i`, or null (a piece that rides nothing - a still slab, a Beat - is no ride). */
const ridden = (spec, i) => { const s = spec?.steps?.[i]; return s && s.i === i && EG_RIDE_KINDS.includes(s.kind) ? s : null; };
/**
 * The ride a body at (x, y, z) (the hall's frame, its feet) is on at shared second `tS`: `[i, dx, dy, dz]` - the piece's
 * index and the body's offset from the piece's top centre (cm) - or null. Pure.
 * @param {any} spec @param {number} x @param {number} y @param {number} z @param {number} tS
 */
export function egRideOf(spec, x, y, z, tS) {
  for (const s of spec?.steps ?? []) {
    if (!EG_RIDE_KINDS.includes(s.kind)) continue;
    const q = egPieceAt(s, tS);
    if (!q.solid) continue;
    const dx = x - (s.x + q.dx), dz = z - (s.z + q.dz), dy = y - s.y;
    if (Math.abs(dx) <= s.w / 2 + EG_BODY_R && Math.abs(dz) <= s.d / 2 + EG_BODY_R && dy >= -EG_RIDE_DOWN_M && dy <= EG_RIDE_UP_M) return [s.i, r2(dx), r2(dy), r2(dz)];
  }
  return null;
}
/**
 * Does a ride hold: its offset on its piece's top (the capsule about it), and - AUDIT EG V (lane4 L4-2; section 10.8, "a
 * pose cannot claim a piece it is not on") - the pose's own feet at (x, y, z) (the hall's frame) on that piece at shared
 * second `tS`: within its top's heights, and on its footprint inflated by the capsule as the piece stood within
 * EG_SUPPORT_LAG_S of `tS` (the support law's reach - egSupportAt). An offset alone placed any pose on any ridden piece in
 * the hall: a member on a fight floor claiming a far Drift was stood on it for the count, off every floor. Pure.
 * @param {any} spec @param {any} pl @param {number} x @param {number} y @param {number} z @param {number} tS
 */
export function egRideHolds(spec, pl, x, y, z, tS) {
  const s = Array.isArray(pl) ? ridden(spec, pl[0]) : null;
  if (!s || !(Math.abs(pl[1]) <= s.w / 2 + EG_BODY_R && Math.abs(pl[3]) <= s.d / 2 + EG_BODY_R && pl[2] >= -EG_RIDE_DOWN_M && pl[2] <= EG_RIDE_UP_M)) return false;
  if (!(y - s.y >= -EG_RIDE_DOWN_M && y - s.y <= EG_RIDE_UP_M)) return false;
  for (const t of [tS - EG_SUPPORT_LAG_S, tS, tS + EG_SUPPORT_LAG_S]) {
    const q = egPieceAt(s, t);
    if (Math.abs(x - (s.x + q.dx)) <= s.w / 2 + EG_BODY_R && Math.abs(z - (s.z + q.dz)) <= s.d / 2 + EG_BODY_R) return true;
  }
  return false;
}
/** Where a ridden pose stands at shared second `tS`: the piece's place on the clock plus the offset `[x, y, z]` (the hall's
 *  frame), or null when the ride is none of this hall's. */
export function egRideAt(spec, pl, tS) {
  const s = Array.isArray(pl) ? ridden(spec, pl[0]) : null;
  if (!s) return null;
  const q = egPieceAt(s, tS);
  return [s.x + q.dx + pl[1], s.y + pl[2], s.z + q.dz + pl[3]];
}

// ── SUPPORT ──────────────────────────────────────────────────────────────────────────────────────────────────
/** A support's pad (the capsule) and the platform's travel over this long (s) beside it. */
export const EG_SUPPORT_PAD = EG_BODY_R;
export const EG_SUPPORT_LAG_S = 0.15;
/** A body stands on a floor while its feet are at most this over it and this under it (m - a hop's first frame, a slope's
 *  facet, a sinking slab's first metres). */
export const EG_SUPPORT_UP_M = 0.6;
export const EG_SUPPORT_DOWN_M = 1.0;
/** A climb's hold (`cl`) is support within this of a floor's plan (m - a Riser's 2.3 m face, a ledge's lip). */
export const EG_CLIMB_NEAR_M = 3;
/** What holds a body: none, an island (still ground - a plate, an island, a passage's floor, a bridge, a ramp), still
 *  ground that is no island (the end plate, an alcove), a piece. */
export const EG_HOLD = Object.freeze({ none: 0, island: 1, still: 2, piece: 3 });
const yOn = (y, fy) => y <= fy + EG_SUPPORT_UP_M && y >= fy - EG_SUPPORT_DOWN_M;
// ── EG-PERFECT: THE COLLAPSING TUBE'S CLOCK (section 11.3) ───────────────────────────────────────────────────────
/** How near the tube's mouth - its first metre, `{x, y, z0}` (the hall's frame) - a fair pose's feet stand (m, in three
 *  dimensions) when the room records that the company has reached it (a routed hall's tube falls from then). */
export const EG_TUBE_MOUTH_M = 3;
/**
 * HOW LONG AFTER THE COMPANY REACHES IT A ROUTED HALL'S TUBE BEGINS TO FALL (s). The fall runs behind the company at a fixed
 * EG_TUBE_MPS (4 m/s) and a segment holds while the fallen edge has not reached its far end, so a body stays up while it is
 * ahead of the edge. Two numbers make the start, and nothing else:
 *  - THE SPAN BUILD keeps the set piece's margin over the whole tube (section 10.5, `egTubeFair`'s EG_SET_MARGIN): a member
 *    at the trigger's reach (EG_TUBE_MOUTH_M short of the mouth) running at THE SPAN BUILD's pace reaches every metre z of the
 *    tube by (z + 3) / 5.47 s, the edge by START + z / 4 s, so the margin (the edge's time at least 1.25 x the runner's) holds
 *    everywhere when it holds at the mouth - 1.25 x 3 / 5.47 = 0.69 s (1.25 / 5.47 < 1 / 4: the runner gains from there on);
 *  - THE COMPANY: the member right behind the first may have missed the launch the first one took at the gap before, and
 *    the solver's no-queue law (EG_WAIT_MAX, section 10.5) waits it at most 4 s for the next - so the start waits that too.
 * 4.69 s: the first member into the mouth is 22 m down the tube before the vault starts to go behind it, a member one launch
 * behind runs it with the margin, and a member who stood about at the mouth is caught and cast forward (section 11.3) - the
 * fall chases the company as it runs, never a tube fallen before it came (the fixed 18 s from the wake) nor one that waits
 * so long that no runner ever sees it go (18 s after the mouth would be past the end of a 60-80 m tube at the run).
 */
export const EG_TUBE_MOUTH_S = EG_WAIT_MAX + (EG_SET_MARGIN * EG_TUBE_MOUTH_M) / EG_SPAN_RUN_MPS;
/** Is the tube of hall `spec` started from its mouth (a routed hall - LAW 9, net/eliteGates/egRouteProof.js egRouted), rather than from
 *  its wake (laws 4-8)? */
export const egTubeFromMouth = (spec) => !!spec?.tube && egRouted(spec);
/** Do feet at (x, y, z) (the hall's frame) stand at a routed hall's tube's mouth - within EG_TUBE_MOUTH_M of its first metre, or
 *  past it down the tube (THE AUDIT: a pose a beat late, already in, starts it too - at the mouth's sphere alone a pose that
 *  skipped it never did, and the tube stood for good), its floor's height within EG_TUBE_MOUTH_M? */
export const egTubeAtMouth = (spec, x, y, z) => {
  const T = spec?.tube;
  if (!egTubeFromMouth(spec) || Math.abs(y - (T.y ?? 0)) > EG_TUBE_MOUTH_M) return false;
  return Math.hypot(x - T.x, y - (T.y ?? 0), z - T.z0) <= EG_TUBE_MOUTH_M || (Math.abs(x - T.x) <= T.halfW && z >= T.z0 && z <= T.z1);
};
/**
 * THE COLLAPSING TUBE'S FALLEN EDGE (m along the hall, -Infinity before it begins) in hall `spec` at shared ms `tMs`: a routed
 * hall's from `tm`, the instant (relay ms) the room recorded the company at its mouth (0 not yet - it stands), EG_TUBE_MOUTH_S
 * after it; the laws before from the hall's wake `hw`, the tube's own `start` after it, as they always fell. One law for the
 * relay's judge (bandFallen) and the screen's segments (scenes/eliteGates/egSpan.js), allocating nothing: the mouth's start is the
 * law's egTubeEdge (net/eliteGates/egFragLaw.js) on a clock moved by its difference from the tube's own `start`. Pure.
 * @param {any} spec @param {number} hw @param {number} tm @param {number} tMs
 */
export function egTubeEdgeIn(spec, hw, tm, tMs) {
  const T = spec?.tube;
  if (!T) return -Infinity;
  if (egRouted(spec)) return tm > 0 ? egTubeEdge(T, tMs - tm - (EG_TUBE_MOUTH_S - T.start) * 1000) : -Infinity;
  return hw > 0 ? egTubeEdge(T, tMs - hw) : -Infinity;
}

/** EG-ZB (section 21; EG-H1's departure 3 closed): is band `b` fallen at `z` - a Falling Wall's walkway behind its fallen edge
 *  (net/eliteGates/egLaw.js egWallFallenZ), the Collapsing Tube's floor behind its (egTubeEdgeIn - EG-PERFECT: a routed hall's from the
 *  company's arrival at its mouth, `tm`) - with the hall woken at `hw` (relay ms) and the shared time `tMs`? A fallen segment
 *  holds nobody. */
const bandFallen = (spec, b, z, hw, tMs, tm = 0) => hw > 0 && ((b.role === 'walk' && z < egWallFallenZ(spec, hw, tMs)) || (b.role === 'tube' && !!spec.tube && z < egTubeEdgeIn(spec, hw, tm, tMs)));

// ── EG-PERFECT: THE VOID ZONES (Elite-Gates-Ascent.md section 2) ────────────────────────────────────────────────────
/** A fall that passed a void zone is a fall into the void once the feet are this far under the floor they left (m - the fair
 *  trail's own fall, EG_FALL_M): a running jump down a stair at THE SPAN BUILD lands 2.55 m under its tread, and every zone
 *  stands over a way at least 5 m under the one it was left from (net/eliteGates/egAscent.js voidsOf), so a fall through one passes
 *  this mark in the air. THE AUDIT: past the deepest Drop (EG_DROP_CM, a quarter metre more) - spec law 10 lays its Drops 3 to
 *  4.5 m under their road, and at a Gale-Swept fork a zone about the plate held the Drop past its edge: at 3 m every way down
 *  onto it was the void's (seed 3's hall 7, both roads). */
export const EG_VOID_DROP_M = EG_DROP_CM / 100 + 0.25;
/** THE STEP-OFF REACH: how far out a body run off an edge at THE SPAN BUILD carries while it falls `dy` metres (its run held,
 *  the motor's g - EG_JUMP_G), its capsule beside (m). A void zone's footprint is the lower way's plan under the upper's 3 m
 *  about it (net/eliteGates/egAscent.js voidsOf); a running step-off from 10 m carries 6 m, past it - so it is read widened by this. */
export const egStepOffReach = (dy) => EG_SPAN_RUN_MPS * Math.sqrt((2 * Math.max(0, dy)) / EG_JUMP_G) + EG_BODY_R;
/**
 * DOES A STRETCH PASS ONE OF HALL `spec`'s VOID ZONES (Elite-Gates-Ascent.md section 2: "wherever a fall would skip ahead along
 * the route, the law lays a VOID ZONE ... over which a body is cast back as into the void"): the stretch from feet `a` to feet
 * `b` (`[x, y, z]`, the hall's frame), going down, by a body that last stood on a floor `fromY` high over the zone's foot,
 * through the zone's heights (`y0`-`y1`) over its footprint widened by the step-off reach from that floor to the zone's foot
 * (egStepOffReach) - tested where the stretch meets the zone's top and its foot, and at `b`. Answers the zone, or null (a hall
 * that lays none - laws 4-8). A fall that passed one is the void's once it is EG_VOID_DROP_M under the floor it left (the
 * screen's ride and the fair trail keep the passage until the feet stand again: a thin zone is passed in a frame, and a
 * stair's hop through a well's widened plan lands before the mark). Pure.
 * @param {any} spec @param {number} fromY @param {number[]} a @param {number[]} b
 */
export function egVoidCrossed(spec, fromY, a, b) {
  const V = spec?.voids;
  if (!V?.length || !a || !b || !Number.isFinite(fromY) || !(b[1] < a[1])) return null;
  for (const v of V) {
    if (!(fromY > v.y0 && b[1] <= v.y1 && a[1] >= v.y0)) continue;
    const pad = egStepOffReach(fromY - v.y0), along = (y) => { const k = (a[1] - y) / (a[1] - b[1]); return [a[0] + (b[0] - a[0]) * k, a[2] + (b[2] - a[2]) * k]; };
    const yTop = Math.min(a[1], v.y1), yFoot = Math.max(b[1], v.y0);
    for (const [x, z] of [along(yTop), along(yFoot), [b[0], b[2]]]) if (egPolyIn(v.poly, x, z, pad)) return v;
  }
  return null;
}
/**
 * ONE STEP OF A FALL OVER THE VOID ZONES - the screen's frame (scenes/eliteGates/egSpan.js ride) and the fair trail's pose (egFairPose)
 * alike: `P` the fall's memory (`{ v }` - the zone it passed, null none), moved in place. The stretch from feet `a` to feet `b`
 * passing a zone (egVoidCrossed - from a floor `fromY` high) is kept; the feet at `b` EG_VOID_DROP_M under that floor with a
 * zone passed are the void's - answers that zone; feet standing at `b` (`held`) let the memory go once judged. Pure but for `P`.
 * @param {{ v: any }} P @param {any} spec @param {number} fromY @param {number[]|null} a @param {number[]} b @param {boolean} held
 */
export function egVoidStep(P, spec, fromY, a, b, held) {
  if (!P.v && a) P.v = egVoidCrossed(spec, fromY, a, b);
  const hit = P.v && fromY - b[1] >= EG_VOID_DROP_M ? P.v : null;
  if (held || hit) P.v = null;
  return hit;
}
/**
 * EG-ZI (section 10.6): THE STILL GROUND under a body's feet at (x, y, z) at shared second `tS` - its key, or '' none: `a`
 * the arrival plate, `e` the end plate, `d<i>` another disc (an island, a court, a balcony), `b<i>` a band (a passage's
 * floor, a walkway, a bridge), `l<i>` a lane, `r<i>` a ramp (a stair, a slope); EG-HERO-LAY: `h<i>` a hero's floor (its law's
 * polygon, a fight floor or not - spec law 7's `heroes`). egSupportAt's first reads, in its order, so the toll's "new island,
 * or a fragment's node" is the support law's own ground. EG-PERFECT: from spec law 9 a hero's floor is keyed by its hero too,
 * `h<hero>:<i>` - LAW 9 lays a hero a room, and `h<i>` named floor 0 of every room alike, so no room after the first was new
 * ground (the toll's waiver - net/eliteGates/egBrain.js egTollOf - never came); the laws before keep `h<i>`. `tm` the instant the
 * company reached a routed hall's Collapsing Tube (egTubeEdgeIn). Pure.
 * @param {any} spec @param {number} x @param {number} y @param {number} z @param {number} tS @param {boolean} plan @param {number} hw
 * @param {number} [tm]
 */
function groundAt(spec, x, y, z, tS, plan, hw, tm = 0) {
  const P = EG_SUPPORT_PAD + (plan ? EG_CLIMB_NEAR_M : 0), on = (fy) => plan || yOn(y, fy ?? 0);
  const D = spec?.discs ?? [], Bd = spec?.bands ?? [], Ln = spec?.lanes ?? [], R = spec?.ramps ?? [];
  for (let i = 0; i < D.length; i++) { const d = D[i]; if (Math.hypot(x - d.x, z - d.z) <= d.r + P && on(d.y)) return d.role === 'end' ? 'e' : d.role === 'arrive' ? 'a' : `d${i}`; }
  for (let i = 0; i < Bd.length; i++) { const b = Bd[i]; if (z >= b.z0 - P && z <= b.z1 + P && Math.abs(x - b.x) <= b.halfW + P && on(b.y) && !bandFallen(spec, b, z, hw, tS * 1000, tm)) return `b${i}`; }
  for (let i = 0; i < Ln.length; i++) { const l = Ln[i]; if (segDist(x, z, l.ax, l.az, l.bx, l.bz) <= l.hw + P && on(l.y)) return `l${i}`; }
  for (let i = 0; i < R.length; i++) {
    const r = R[i], dx = r.bx - r.ax, dz = r.bz - r.az, L2 = dx * dx + dz * dz, u = L2 > 0 ? Math.max(0, Math.min(1, ((x - r.ax) * dx + (z - r.az) * dz) / L2)) : 0;
    if (segDist(x, z, r.ax, r.az, r.bx, r.bz) <= r.hw + P && on(r.y0 + (r.y1 - r.y0) * u)) return `r${i}`;
  }
  const H = spec?.heroes ?? [], byHero = (spec?.law ?? 0) >= 9;   // EG-PERFECT: law 9 keys a floor by its hero
  for (let k = 0; k < H.length; k++) for (const [i, f] of H[k].floors.entries()) if (on(f.y) && egPolyIn(f.poly, x, z, P)) return byHero ? `h${k}:${i}` : `h${i}`;
  return '';
}
/**
 * WHAT HOLDS a body's feet at (x, y, z) (the hall's frame) at shared second `tS` (EG_HOLD). `plan` - the floor's plan
 * alone, every height (a climb's hold). EG-ZB: `hw` the hall's wake (relay ms) - a Falling Wall's and the Collapsing Tube's
 * fallen segments hold nothing after it. EG-ZI: still ground is groundAt's - the end plate still, the rest an island. AUDIT
 * EG III: `bridges` the Spirebridges the room raised (`{ h, g, from, until }`, relay ms) - one of this hall standing at `tS`
 * holds its top as a piece does. EG-PERFECT: `tm` the instant the company reached a routed hall's Collapsing Tube (relay ms, 0
 * not yet - egTubeEdgeIn). Pure.
 * @param {any} spec @param {number} x @param {number} y @param {number} z @param {number} tS @param {boolean} [plan] @param {number} [hw]
 * @param {Array<{h: number, g: number, from: number, until: number}>|null} [bridges] @param {number} [tm]
 */
export function egSupportAt(spec, x, y, z, tS, plan = false, hw = 0, bridges = null, tm = 0) {
  const g = groundAt(spec, x, y, z, tS, plan, hw, tm);
  if (g) return g === 'e' ? EG_HOLD.still : EG_HOLD.island;
  const P = EG_SUPPORT_PAD + (plan ? EG_CLIMB_NEAR_M : 0), on = (fy) => plan || yOn(y, fy ?? 0);
  if (egBridgeHolds(spec, bridges, x, y, z, tS * 1000, plan ? Infinity : EG_SUPPORT_UP_M, plan ? Infinity : EG_SUPPORT_DOWN_M, P)) return EG_HOLD.piece;
  for (const s of spec?.steps ?? []) {
    const fy = s.y ?? 0;
    if (!plan && !(y <= fy + EG_SUPPORT_UP_M && y >= fy - (s.kind === 'sink' ? EG_SINK_GONE_M : EG_SUPPORT_DOWN_M))) continue;
    for (const t of [tS - EG_SUPPORT_LAG_S, tS, tS + EG_SUPPORT_LAG_S]) {
      const q = egPieceAt(s, t);
      if (!q.solid && !plan) continue;
      if (Math.abs(x - (s.x + q.dx)) <= s.w / 2 + P && Math.abs(z - (s.z + q.dz)) <= s.d / 2 + P) return EG_HOLD.piece;
    }
  }
  for (const a of spec?.alcoves ?? []) if (Math.hypot(x - a.x, z - a.z) <= 1.8 + P && on(a.y)) return EG_HOLD.still;
  return EG_HOLD.none;
}
/** AUDIT EG III - IS A BODY ON A SPIREBRIDGE of hall `spec` standing at relay ms `tMs` (`bridges` the room's - `{ h, g, from,
 *  until }`): its feet on the plank's top, within `up` over and `down` under it, the capsule `pad` about it. Pure. */
export function egBridgeHolds(spec, bridges, x, y, z, tMs, up = EG_SUPPORT_UP_M, down = EG_SUPPORT_DOWN_M, pad = EG_SUPPORT_PAD) {
  for (const q of bridges ?? []) {
    if (!q || q.h !== spec?.h || !(tMs >= q.from && tMs < q.until)) continue;
    if (egOnBridge(egBridgeOf(spec, q.g), x, y, z, up, down, pad)) return true;
  }
  return false;
}
/** EG-ZB (section 21): IS A BODY CAUGHT BY FALLEN GROUND - its feet at (x, y, z) over a Falling Wall's or the Collapsing
 *  Tube's fallen segment at shared ms `tMs` (the hall woken at `hw`; EG-PERFECT: a routed hall's tube from `tm`, the company at
 *  its mouth), and nothing else holding it? The screen casts it on to the nearest standing segment at the cast-back's cost
 *  (section 8.3), and the census owes that cost (net/eliteGates/egBrain.js egPoseIn). Pure. */
export function egFallenAt(spec, hw, x, y, z, tMs, tm = 0) {
  if (!(hw > 0)) return false;
  const over = (spec?.bands ?? []).some((b) => z >= b.z0 && z <= b.z1 && Math.abs(x - b.x) <= b.halfW && yOn(y, b.y ?? 0) && bandFallen(spec, b, z, hw, tMs, tm));
  return over && egSupportAt(spec, x, y, z, tMs / 1000, false, hw, null, tm) === EG_HOLD.none;
}

// ── THE FAIR TRAIL ───────────────────────────────────────────────────────────────────────────────────────────
/** THE FAST BUILD's run (section 10.2 - Speed 100, Running 100, Fleetfoot III's +10%): player/motor.js runSpeed(100, 100) x
 *  1.1, pinned equal by test/net/eliteGates/egint_relay.test.js (the relay's bundle does not carry the motor). EG6a: the span law's (its
 *  one home, beside THE SPAN BUILD's - net/eliteGates/egSpanLaw.js), said here. */
export { EG_FAST_RUN_MPS };
/** The law's speed: the fast build's run times this, plus a push and a ride (a blow's, a gust's, a Rail's, a belt's). */
export const EG_FAIR_RUN_X = 1.1;
export const EG_FAIR_CARRY_MPS = 4;
/** The game's own snaps beside a stretch (m): a challenge's ring kept, a falling segment's cast forward. */
export const EG_FAIR_SNAP_M = 2.5;
/** Speed is measured over stretches at least this long (ms - a pose's jitter is no speed). */
export const EG_FAIR_WIN_MS = 500;
/** A cast-back lands within this of where the member last stood (m). */
export const EG_CAST_NEAR_M = 3;
/** The air's law: no airborne stretch past this that is not a fall (s), and a fall is this far under the last support (m). */
export const EG_AIR_MAX_S = 2.5;
export const EG_FALL_M = 3;
/** A `ts` gap over this is BLIND (ms); a crossing more than this share blind opens no door. */
export const EG_BLIND_MS = 400;
export const EG_FAIR_BLIND_MAX = 0.3;
/**
 * FIELD BUGS 2026-10-20f (FAIR-STILL; bible/01-Overview/bugs/Field-Bugs-2026-10-20f.md, ilovemybonk: "the game doesnt register i made
 * it to the end") - IS A GAP A MEMBER STANDING STILL? A client says a pose when something about it changes - a step, a turn of
 * the head, a draw - and otherwise one every HEARTBEAT_MS (20 s; net/online.js sendPose, wire.js poseChanged), so silence is
 * the protocol's own word for "unchanged", the reading the census already gives it (server/src/index.js _egTrails, AUDIT EG V
 * L4-1). The trail read it as BLIND: a member who waited out a span's timed pieces (a Beat's return, a Drift's swing) without
 * moving the mouse was unseen there, and a crossing that waited a second at each lost its door in 24 of 44 spans, two seconds
 * in 42 of 44 - at the door, with no word. A gap is still when it begins on held ground (`sup`, the last pose's support -
 * stamped at that pose) and ends on held ground (`hold`) within EG_FAIR_SNAP_M of where it began - the game's own snap, and
 * more than the first step a client says as it moves off (one frame of THE FAST BUILD's run). A gap that went further, or
 * through the air, stays blind: what a body did unseen is still unknown. Pure.
 * @param {ReturnType<typeof egFairNew>} A @param {number[]} L the last pose `[t, x, y, z]` @param {{x: number, y: number, z: number}} p @param {number} hold
 */
export const egStillGap = (A, L, p, hold) => !!hold && !!A.sup && A.sup[0] === L[0] && Math.hypot(p.x - L[1], p.y - L[2], p.z - L[3]) <= EG_FAIR_SNAP_M;
/** FIELD BUGS 2026-10-20f DOOR-WORD: what the door says to a member it will not take (net/eliteGates/egBrain.js doorWord) - a break's
 *  own reason (broke's `why`), else `blind`; net/wire.js EG_FAIR_WIRE_WORDS carries them, pinned equal (the wire imports no
 *  law of the Spire's). */
export const EG_FAIR_WORDS = Object.freeze(['blind', 'speed', 'air', 'void']);
/** A crossing's blind share is read once it has run this long (ms). */
export const EG_FAIR_SPAN_MIN_MS = 2000;
/** A second break within a hall refuses the member's hits this long (ms). */
export const EG_FAIR_REPEAT_MS = 5000;

/**
 * A member's FAIR TRAIL in hall `h`, fresh (its arrival, a recall, a new hall): no break, nothing judged. `from` the
 * crossing's start (its first judged pose), `cross` its time at the end plate, `blind`/`span` the ms blind and judged,
 * `brk` breaks since the last island, `brks` the hall's, `fast` its fastest stretch (cm/s), `refuse` hits refused until.
 * EG-ZB: `hw` the hall's wake (relay ms) - after it a Falling Wall's and the Collapsing Tube's fallen segments hold nothing.
 * EG-ZI (section 10.6): `far` the furthest fair point (its progress along THE ROUTE - net/eliteGates/egRoute.js; laws 4-8 the road's
 * +z - null none yet), `fnew` when the newest still ground was first stood on fairly (shared ms), `seen` the still ground
 * so stood on (groundAt's keys), `atEnd` stood at the door on a fair trail (net/eliteGates/egBrain.js egPoseIn) - the pull's toll
 * reads them. EG-PERFECT: `tm` the instant the company reached a routed hall's Collapsing Tube (net/eliteGates/egBrain.js egPoseIn
 * sets it before each pose - egTubeEdgeIn), and THE VOID ZONES' marks, made as they are first needed: `vp` the fall's passage
 * (egVoidStep's memory), `vz` this pose fell into the void (the census owes its cast-back), `vd` the progress of the floor a
 * void fall left - the break holds until the member stands on still ground no further along than it.
 * @param {number} h @param {number} [hw]
 */
export const egFairNew = (h, hw = 0) => ({ h, hw, last: /** @type {number[]|null} */ (null), sup: /** @type {number[]|null} */ (null), isl: /** @type {number[]|null} */ (null), airAt: 0, airBrk: 0,
  win: /** @type {number[]|null} */ (null), brk: 0, brks: 0, why: '', refuse: 0, fast: 0, blind: 0, span: 0, from: 0, cross: 0, cblind: 0, road: 0, wake: 0,
  far: /** @type {number|null} */ (null), fnew: 0, seen: /** @type {string[]} */ ([]), atEnd: 0 });

/** A break of the law: counted since the last island and in the hall; a second in the hall refuses the hits a while. */
function broke(A, why, t) {
  A.brk++; A.brks++; A.why = why;
  if (A.brks >= 2) A.refuse = t + EG_FAIR_REPEAT_MS;
}
/**
 * ONE POSE of a member's fair trail: `p` its feet in the hall's own frame (`{x, y, z}` - a ridden pose already at its
 * piece's clock position) with `ride` (it claimed a piece and the piece holds it) and `cl` (a climb's hold), `t` its
 * shared time (ms). The stretch from the last pose is judged - its speed, its air - unless it was blind; the hold under
 * it is read; still ground ends the window from the last island. Moves `A` in place. AUDIT EG III: `bridges` the room's
 * Spirebridges (egSupportAt's) - a pose on a standing plank is held. Pure.
 * @param {ReturnType<typeof egFairNew>} A @param {any} spec @param {{x: number, y: number, z: number, ride?: boolean, cl?: boolean}} p @param {number} t
 * @param {Array<{h: number, g: number, from: number, until: number}>|null} [bridges]
 */
export function egFairPose(A, spec, p, t, bridges = null) {
  if (![p.x, p.y, p.z, t].every(Number.isFinite)) return;
  const L = A.last;
  const hold = p.ride ? EG_HOLD.piece : egSupportAt(spec, p.x, p.y, p.z, t / 1000, false, A.hw ?? 0, bridges, A.tm ?? 0) || (p.cl && egSupportAt(spec, p.x, p.y, p.z, t / 1000, true, 0, bridges) ? EG_HOLD.piece : EG_HOLD.none);
  A.last = [t, p.x, p.y, p.z];
  A.vz = 0;   // EG-PERFECT: this pose fell into no void yet
  if (!A.from) A.from = t;
  if (!L) { if (hold) { A.sup = [t, p.x, p.y, p.z]; if (hold === EG_HOLD.island) A.isl = [p.x, p.z]; } farther(A, spec, p, t, hold); return; }
  const dt = t - L[0];
  if (!(dt > 0)) return;
  A.span += dt;
  let fair = true;
  if (dt > EG_BLIND_MS && !egStillGap(A, L, p, hold)) {   // FIELD BUGS 2026-10-20f FAIR-STILL: a member standing still is seen standing
    // BLIND: the stretch judges nothing either way - its speed unknown, its air begun again here (EG-PERFECT: and a fall's
    // passage over a void zone forgotten - where the body went in it is not known)
    A.blind += dt; A.win = null; A.airAt = hold ? 0 : t; A.airBrk = 0; A.vp = null;
  } else {
    // THE SPEED: over stretches of at least EG_FAIR_WIN_MS, the law's run plus a carry and the game's own snaps; a step back
    // to where the member last stood or last held an island (a cast-back), or out of a fall, is no step
    const d = Math.hypot(p.x - L[1], p.z - L[3]);
    const fell = !!A.sup && L[2] < A.sup[2] - EG_FALL_M;
    const home = (q) => !!q && Math.hypot(p.x - q[0], p.z - q[1]) <= EG_CAST_NEAR_M;
    const back = hold === EG_HOLD.island && egRouteAlongAt(spec, p.x, p.y, p.z) < egRouteAlongAt(spec, L[1], L[2], L[3]) - EG_FAIR_SNAP_M;   // a cast back onto still ground behind along the route - a Pendulum's, a waystone's: it gains nothing
    if (fell || (d > EG_FAIR_SNAP_M && hold && (back || home(A.isl) || (A.sup && home([A.sup[1], A.sup[3]]))))) A.win = null;
    else {
      const w = (A.win ??= [0, 0]);
      w[0] += d; w[1] += dt;
      // judged at once when the stretch already outruns what its whole window allows (a teleport, then a credit asked at
      // once, is never a window late), and closed at EG_FAIR_WIN_MS
      if (w[0] > (EG_FAST_RUN_MPS * EG_FAIR_RUN_X + EG_FAIR_CARRY_MPS) * (Math.max(w[1], EG_FAIR_WIN_MS) / 1000) + EG_FAIR_SNAP_M) { broke(A, 'speed', t); fair = false; A.win = null; }
      else if (w[1] >= EG_FAIR_WIN_MS) { A.fast = Math.max(A.fast, Math.round((w[0] / (w[1] / 1000)) * 100)); A.win = null; }
    }
    // THE AIR: an airborne stretch past EG_AIR_MAX_S that is no fall breaks the law once
    if (hold) { A.airAt = 0; A.airBrk = 0; }
    else {
      if (!A.airAt) A.airAt = A.sup ? Math.max(A.sup[0], L[0]) : L[0];
      const falling = !!A.sup && p.y < A.sup[2] - EG_FALL_M;
      if (!falling && !A.airBrk && (t - A.airAt) / 1000 > EG_AIR_MAX_S) { A.airBrk = 1; broke(A, 'air', t); fair = false; }
    }
    // EG-PERFECT - THE VOID ZONES (Elite-Gates-Ascent.md section 2): a fall from the last floor stood on that passed a void zone
    // and is EG_VOID_DROP_M under that floor fell into the void (egVoidStep - the screen's own law): it breaks the trail, the
    // census owes its cast-back (`vz` - net/eliteGates/egBrain.js egPoseIn), and nothing past the floor it left is credited (`vd`)
    if (A.sup && egVoidStep((A.vp ??= { v: null }), spec, A.sup[2], [L[1], L[2], L[3]], [p.x, p.y, p.z], !!hold)) {
      A.vz = 1; A.vd = egRouteAlongAt(spec, A.sup[1], A.sup[2], A.sup[3]); broke(A, 'void', t); fair = false;
    }
  }
  if (hold) A.sup = [t, p.x, p.y, p.z];
  // THE LAST ISLAND: a fair pose on still ground (never the end plate) ends the window - EG-PERFECT: after a fall into a void,
  // only still ground no further along the route than the floor it left (the screen's cast-back stands it there): a body
  // that landed on the way further on is still the void's
  if (hold === EG_HOLD.island && fair && !(A.vd != null && egRouteAlongAt(spec, p.x, p.y, p.z) > A.vd + EG_FAIR_SNAP_M)) { A.brk = 0; A.isl = [p.x, p.z]; A.vd = null; }
  farther(A, spec, p, t, hold);
}
/**
 * EG-ZI (section 10.6) - THE FURTHEST FAIR POINT, after a pose of the trail: a held pose (still ground, a piece, the end
 * plate - never one in the air, a leap toward the end is no ground reached) with no break since the last island moves `far`
 * along THE ROUTE (net/eliteGates/egRoute.js - laws 4-8 the road's +z); still ground stood on so for the first time this hall (an
 * island, a passage's or a chamber's floor, a stair - the arrival plate it began on aside) is new ground, `fnew` its
 * instant. The pull's toll reads both.
 * @param {ReturnType<typeof egFairNew>} A @param {any} spec @param {{x: number, y: number, z: number}} p @param {number} t @param {number} hold
 */
function farther(A, spec, p, t, hold) {
  if (!hold || A.brk !== 0) return;
  const at = egRouteAlongAt(spec, p.x, p.y, p.z);
  if (A.far == null || at > A.far) A.far = at;
  if (hold !== EG_HOLD.island) return;
  const g = groundAt(spec, p.x, p.y, p.z, t / 1000, false, A.hw ?? 0, A.tm ?? 0);
  if (!g || g === 'a' || (A.seen ??= []).includes(g)) return;
  A.seen.push(g); A.fnew = t;
}
/** Is the member's crossing more than EG_FAIR_BLIND_MAX blind (once it has run EG_FAIR_SPAN_MIN_MS)? */
export const egFairBlind = (A) => !!A && A.span >= EG_FAIR_SPAN_MIN_MS && A.blind / A.span > EG_FAIR_BLIND_MAX;
/** IS THE TRAIL FAIR for a pose-gated credit: no break since the last island, and the crossing not too blind. A member the
 *  relay has no trail of yet (a reload before its first pose) is fair - the law judges poses, never their absence. */
export const egFairOk = (A) => !A || (A.brk === 0 && !egFairBlind(A));
/** Are the member's hits refused at `now` (a second break in the hall, EG_FAIR_REPEAT_MS)? */
export const egFairRefuses = (A, now) => !!A && now < A.refuse;
/** The crossing reached the end plate at shared ms `t` (once a hall): its time, its blind share, its road. */
export function egFairCross(A, t, road = 0) {
  if (!A || A.cross || !A.from) return;
  A.cross = Math.max(1, t - A.from); A.cblind = A.span > 0 ? A.blind / A.span : 0; A.road = road;
}
/** THE CROSSING'S LOWER BOUND (section 10.5's EG_CROSS_MIN): EG6a - the timed solver's fastest crossing of the road at THE
 *  FAST BUILD, arrival plate to end plate, less 15% (ms - net/eliteGates/egSpanLaw.js egCrossMin; the Low Road's bridges across and
 *  back run too). A measure; it gates nothing. */
export function egCrossMinMs(spec, road = 0) {
  if (!spec?.arrive || !spec?.end) return 0;
  return egCrossMin(spec, road);
}
/**
 * A MEMBER'S MEASURES as a receipt's `m` would carry them (whole numbers): the crossing (ds), its lower bound (ds), its
 * blind share (%), the hall's breaks, the fastest stretch (cm/s), whether the door was the room's wake's (`m.wake`). Null
 * when the hall measured nothing.
 * @param {ReturnType<typeof egFairNew>|null} A @param {any} spec
 */
export function egFairMeasure(A, spec) {
  if (!A || !A.span) return null;
  return [Math.round(A.cross / 100), Math.round(egCrossMinMs(spec, A.road) / 100), Math.round(100 * (A.cross ? A.cblind : A.blind / A.span)), A.brks, A.fast, A.wake ? 1 : 0];
}
