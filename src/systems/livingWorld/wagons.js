// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LW10 (2026-10-09, bible/06-Systems/Living-World-II.md "LW10"): THE WAGON TRAIN - the horses and wagons the road's
// parties travel with, and where each stands at any minute. Mac: "actual caravans utilizing horses and wagons". Pure,
// like the trips they ride on (LW0 decision 2): the team is the trip's, its place the party's place on its way - every
// reader's caravan has the same wagon at the same bend, its wheels at the same spoke.
//
// WHO HAS WHAT (`teamOf`). A merchant's caravan draws one wagon - two when its town is a great house's (GREAT_HOUSE_BLOCKS);
// a noble's procession its baggage wagon; a pedlar or a carter leads a pack horse. Nobody else has a team.
//
// THE TRAIN IN FILE (`trainOf`). The van - the first half of the armed - before; the leader at the head of the first horse,
// leading it by the bridle; each horse and its wagon on its shafts behind it (the axle HITCHED_HORSE_LOCAL_Z back, the
// mod's own parked-team distance), the trains of two one after the other; the rest behind. Every place is a distance
// along the WAY from the party's own, in its LANE (AUDIT LW-III: right of the road's middle the way it walks), and each
// axle its hitch STRAIGHT behind its horse, facing it - the trailer's law on the lane's own curve (`chordBehind`).
//
// AT CAMP (`campTeam`) the wagons stand at the ring's edge facing its fire, each horse unhitched beside its wagon; IN A
// FIGHT or a halt the train stands where it was. THE WHEELS turn with the distance walked (horseCartLaw.js
// wheelRotationDegrees). THE CARGO is the trip's: full on the way out; home, what was sold (half) or bought (three
// quarters), by its seed; a quarter if it was robbed (LW11/LW12 `robbed`).
import { laneAt, NATIVE_PER_M } from './trips.js';
import { lwSeed, textSeed } from './seed.js';
import { HITCHED_HORSE_LOCAL_Z, HORSE_BOX_SIZE, wheelRotationDegrees, wrapWheelAngle } from '../horse/horseCartLaw.js';
import { MEASURED } from '../../world/wagonModels.js';   // AUDIT LW-III: the Small Cart's footprint

/** A merchant of a town this big (blocks) trades in two wagons. */
export const GREAT_HOUSE_BLOCKS = 36;
/** The train's spacing (native): a walker's gap in file (livingRoads.js FILE_GAP_N's own), the leader a stride before
 *  their horse, the axle the mod's hitch back from the horse, and a wagon's length behind its axle before the next. */
export const WALK_GAP_N = 72;
export const LEAD_N = 40;
export const HITCH_N = HITCHED_HORSE_LOCAL_Z * NATIVE_PER_M;
export const WAGON_TAIL_N = 110;
/** The cargo's tiers (horseCartLaw.js cargoTier's percentages, CARGO_DEFINITIONS' thresholds): full, sold, bought, robbed. */
export const CARGO_FULL = 90, CARGO_SOLD = 50, CARGO_BOUGHT = 75, CARGO_ROBBED = 25;
/** At camp the wagons stand this far beyond the ring (native), a horse this far to a wagon's side. */
export const CAMP_PARK_N = 120;
export const CAMP_HORSE_SIDE_N = 70;

/**
 * @typedef {{ wagons: number, packs: number }} Team - the trip's: its wagons (each with its horse) and its pack horses
 * @typedef {{ key: string, x: number, z: number, yaw: number, moving: boolean }} HorsePlace - native; `yaw` a world yaw
 * @typedef {{ key: string, x: number, z: number, yaw: number, moving: boolean, tier: number, s: number, hitched: boolean }} WagonPlace - the
 *   axle's place (native), the way it faces, its cargo tier, the distance it has walked (its wheels') and whether its
 *   horse is in its shafts (WAGONS1's `hitched`: a cart borne level on the march, at rest at camp)
 */

/** WHO HAS WHAT: a merchant's caravan its wagon (two from a great house), a noble's procession its baggage wagon, a
 *  pedlar's or a carter's own trip a pack horse; none else. @param {any} trip @returns {Team} */
export function teamOf(trip) {
  if (trip.kind === 'merchant') return { wagons: (trip.from?.blocks | 0) >= GREAT_HOUSE_BLOCKS ? 2 : 1, packs: 0 };
  if (trip.kind === 'noble') return { wagons: 1, packs: 0 };
  if (trip.kind === 'pedlar' || trip.kind === 'carter') return { wagons: 0, packs: 1 };
  return { wagons: 0, packs: 0 };
}

/** THE CARGO a trip's wagons carry at minute `t`: full out, home by its trade (the seed's), a quarter robbed.
 *  @param {any} trip @param {number} t */
export function cargoOf(trip, t) {
  if (trip.robbed && t >= trip.robbed.t) return CARGO_ROBBED;
  if (t < trip.backT0) return CARGO_FULL;
  return lwSeed(textSeed(trip.id), 0x63617267) % 2 ? CARGO_SOLD : CARGO_BOUGHT;   // 'carg'
}

/** AUDIT LW-III (KEEP RIGHT): a party on the march walks this far (native - 2 m) to the right of the road's middle, the
 *  way it goes, so two that meet pass side by side on the road's 12.8 m (travelPaths.js P_SIZE) - they walked its one
 *  line, and a caravan met on the road drove through the other's wagons. */
export const LANE_N = 80;

/**
 * AUDIT LW-III (THE TRAILER'S LAW): the distance along a path `at` (s -> point) behind `s0` (`dir` the way it walks)
 * whose point stands `dist` from `s0`'s, straight - where an axle hitched `dist` behind its horse stands. On a straight
 * it is `dist` along; round a corner on the line or inside it a little more (the chord is shorter than the arc), on a
 * lane outside it a little less (the lane runs longer than the way's own s); the first such point back from `s0`.
 * Walked out in eighths of `dist` and halved twenty times; past `3 dist` (the way's end) the arc's own.
 * @param {(s: number) => { x: number, z: number }} at @param {number} s0 @param {number} dir @param {number} dist
 */
export function chordBehind(at, s0, dir, dist) {
  const p0 = at(s0);
  const far = (/** @type {number} */ k) => { const q = at(s0 - dir * k); return Math.hypot(q.x - p0.x, q.z - p0.z); };
  if (Math.abs(far(dist) - dist) < 1e-9) return s0 - dir * dist;
  // the FIRST point back along the path that far: a lane outside a corner runs longer than the way's own s and swings
  // round it, so a later point stands as far too - walked out from the horse in eighths, then halved twenty times
  const step = dist / 8;
  let lo = 0, hi = step;
  while (far(hi) < dist) { lo = hi; hi += step; if (hi > dist * 3) return s0 - dir * dist; }
  for (let i = 0; i < 20; i++) { const mid = (lo + hi) / 2; if (far(mid) < dist) lo = mid; else hi = mid; }
  return s0 - dir * hi;
}

/**
 * THE TRAIN IN FILE at a moment of its walk - each member's place (the van before, the leader at the first horse's head,
 * the rest behind), each horse's, each wagon's. `members` the party standing (trips.js membersAt); `at` partyAt's;
 * `hitchN` the axle's way back from its horse (native) - the wagon drawn's own (WAGONS1: Mac's Small Cart's 3.8 m where
 * his wagon is drawn), the mod's HITCH_N unsaid; `lane` how far right of the road's middle the train walks, the way it
 * goes (AUDIT LW-III: the roads' layer hands LANE_N, or more beside a party abreast; 0 unsaid - on the line).
 * AUDIT LW-III (THE TRAILER'S LAW): each wagon's axle stands its hitch STRAIGHT behind its horse (`chordBehind`) and
 * faces it, so its shafts are where its horse is round a corner - it faced the road's heading at its axle, and for the
 * hitch's length past every corner its horse walked out of its shafts and the wagon turned all at once as its axle
 * crossed; the next team stands WAGON_TAIL_N straight behind the axle the same way.
 * @param {any} trip @param {any} at @param {any[]} members @param {number} t @param {number} [hitchN] @param {number} [lane]
 * @returns {{ people: { res: any, x: number, z: number, yaw: number, moving: boolean }[], horses: HorsePlace[], wagons: WagonPlace[] }}
 */
export function trainOf(trip, at, members, t, hitchN = HITCH_N, lane = 0) {
  const team = teamOf(trip);
  const back = at.phase === 'back';
  const dir = back ? -1 : 1;   // the way it walks, along the way's own s
  const moving = !at.halt && !at.camp;
  const place = (/** @type {number} */ s, side = 0) => {
    const p = laneAt(trip.way, s, dir * lane + side);
    return { x: p.x, z: p.z, yaw: back ? p.yaw + Math.PI : p.yaw };
  };
  const line = (/** @type {number} */ s) => laneAt(trip.way, s, dir * lane);
  const leader = members.find((m) => m.id === trip.leader.id) ?? null;
  const others = members.filter((m) => m !== leader);
  const armed = others.filter((m) => m.cls != null);
  const van = armed.slice(0, Math.ceil(armed.length / 2));
  const rear = others.filter((m) => !van.includes(m));
  const s0 = /** @type {number} */ (at.s);
  /** @type {{ res: any, x: number, z: number, yaw: number, moving: boolean }[]} */
  const people = [];
  van.forEach((m, i) => people.push({ res: m, ...place(s0 + dir * (van.length - i) * WALK_GAP_N, (i % 2 ? 1 : -1) * 22), moving }));
  if (leader) people.push({ res: leader, ...place(s0, 30), moving });
  /** @type {HorsePlace[]} */
  const horses = [];
  /** @type {WagonPlace[]} */
  const wagons = [];
  let s = s0 - dir * LEAD_N;
  const teams = team.wagons + team.packs;
  for (let i = 0; i < teams; i++) {
    const horse = place(s);
    horses.push({ key: `${trip.id}:h${i}`, ...horse, moving });
    if (i < team.wagons) {
      const axle = chordBehind(line, s, dir, hitchN);
      const a = place(axle);
      const yaw = Math.hypot(horse.x - a.x, horse.z - a.z) > 1e-6 ? Math.atan2(horse.x - a.x, horse.z - a.z) : a.yaw;
      // AUDIT LW-II E8: the distance walked the way the wagon faces - home, from the far end (the mod turns its wheels by
      // travel along the wagon's forward: the way's own s, falling home, spun them backwards)
      wagons.push({ key: `${trip.id}:w${i}`, x: a.x, z: a.z, yaw, moving, tier: cargoOf(trip, t), s: back ? trip.way.len - axle : axle, hitched: true });
      s = chordBehind(line, axle, dir, WAGON_TAIL_N);
    } else s -= dir * WALK_GAP_N;
  }
  rear.forEach((m, i) => people.push({ res: m, ...place(s - dir * (i + 1) * WALK_GAP_N, (i % 2 ? 1 : -1) * 22), moving }));
  return { people, horses, wagons };
}

/** AUDIT LW-III: how far a party's file runs before its own place and behind it along its way (native) - the van and the
 *  train's teams and its rear (`trainOf`'s spacing on a straight), or a file's walkers (`gap` apart). The roads' layer
 *  reads it to tell two parties on one stretch of road. @param {any} trip @param {number} n the members standing
 *  @param {number} [hitchN] @param {number} [gap] */
export function fileSpan(trip, n, hitchN = HITCH_N, gap = WALK_GAP_N) {
  const team = teamOf(trip);
  if (team.wagons + team.packs === 0) return { ahead: 0, behind: Math.max(0, n - 1) * gap };
  const armed = (trip.party ?? []).filter((/** @type {any} */ m) => m.id !== trip.leader?.id && m.cls != null).length;
  const van = Math.ceil(armed / 2);
  const rear = Math.max(0, n - 1 - van);
  return { ahead: van * WALK_GAP_N, behind: LEAD_N + team.wagons * (hitchN + WAGON_TAIL_N) + team.packs * WALK_GAP_N + rear * WALK_GAP_N };
}

/** AUDIT LW-III (ONE CAMP, ONE PARK): the park's ring is at least this far round (native - 5 m) a team at a shared camp,
 *  a wagon's half width and its horse beside it (CART_FOOT_N, CAMP_HORSE_SIDE_N, HORSE_FOOT_N) and a stride. */
export const CAMP_TEAM_ARC_N = 200;

/**
 * AT CAMP: each wagon at the ring's edge beyond its people (CAMP_PARK_N past `ring`), facing the fire, its horse unhitched
 * at its side; a pack horse by itself. `cx`/`cz` the camp's fire (native), `r` its ring.
 * AUDIT LW-III (ONE CAMP, ONE PARK): `slots` - a shared camp's (the roads' layer: `k0` this party's first of the camp's
 * `n` teams, `turn` the camp's) - stands every team of the camp round one park, each its share of the ring and the ring
 * grown to CAMP_TEAM_ARC_N a team; each party parked round the fire its own way and two caravans of one camp stood their
 * wagons in one another. Unsaid, the party's own: its teams, its own turn.
 * @param {any} trip @param {number} cx @param {number} cz @param {number} r @param {number} t
 * @param {{ k0: number, n: number, turn: number } | null} [slots]
 * @returns {{ horses: HorsePlace[], wagons: WagonPlace[] }}
 */
export function campTeam(trip, cx, cz, r, t, slots = null) {
  const team = teamOf(trip);
  const turn = slots ? slots.turn : campTurn(trip);
  /** @type {HorsePlace[]} */
  const horses = [];
  /** @type {WagonPlace[]} */
  const wagons = [];
  const n = team.wagons + team.packs;
  const all = slots ? Math.max(slots.n, n) : n, k0 = slots ? slots.k0 : 0;
  const d = Math.max(r + CAMP_PARK_N, slots ? (all * CAMP_TEAM_ARC_N) / (Math.PI * 2) : 0);
  for (let i = 0; i < n; i++) {
    const a = turn + ((k0 + i) / Math.max(1, all)) * Math.PI * 2;
    const x = cx + Math.sin(a) * d, z = cz + Math.cos(a) * d;
    const face = Math.atan2(cx - x, cz - z);   // to the fire
    if (i < team.wagons) {
      wagons.push({ key: `${trip.id}:w${i}`, x, z, yaw: face, moving: false, tier: cargoOf(trip, t), s: 0, hitched: false });
      // AUDIT LW-III: tied ALONGSIDE, facing the fire as its wagon does - it faced out from the wagon's side (a quarter
      // turn), and its 2.6 m reached back into the cart's bed
      horses.push({ key: `${trip.id}:h${i}`, x: x + Math.cos(face) * CAMP_HORSE_SIDE_N, z: z - Math.sin(face) * CAMP_HORSE_SIDE_N, yaw: face, moving: false });
    } else horses.push({ key: `${trip.id}:h${i}`, x, z, yaw: face + Math.PI / 2, moving: false });
  }
  return { horses, wagons };
}

/** A party's park turned its own way round its fire (radians, the trip's seed). @param {any} trip */
export const campTurn = (trip) => (lwSeed(textSeed(trip.id), 0x7061726b) % 628) / 100;   // 'park'

/** AUDIT LW-III (CLEAR OF THE TEAM): the road's wagon's footprint about its axle (native) - the Small Cart's
 *  (wagonModels.js MEASURED.cart: its bottom's back edge behind, its shafts' tips before, its body's half width). */
export const CART_FOOT_N = Object.freeze({
  back: -MEASURED.cart.bottomBack[1] * NATIVE_PER_M, front: MEASURED.cart.frontZ * NATIVE_PER_M, half: MEASURED.cart.sideX * NATIVE_PER_M,
});
/** The horse's body about its feet (native): the pool's own box (horseCartLaw.js HORSE_BOX_SIZE - 1.1 m wide, 2.6 m long). */
export const HORSE_FOOT_N = Object.freeze({ half: (HORSE_BOX_SIZE[2] / 2) * NATIVE_PER_M, side: (HORSE_BOX_SIZE[0] / 2) * NATIVE_PER_M });
/** And a body's own girth, kept off either. */
export const BODY_CLEAR_N = 14;

/**
 * AUDIT LW-III (CLEAR OF THE TEAM): a body's place (native) moved out of every wagon's and horse's footprint it stands in -
 * to the footprint's nearest side, BODY_CLEAR_N beyond it. A beset caravan's ring stood about its leader, a stride
 * before its first horse, and its foes' 4.75 m beyond: the unarmed stood in the horse and the foes behind in the cart;
 * the live fight's foes (roadFights.js FOE_STAND_M, 7-13 m) rose inside a second wagon's box on the collider. Pure: the
 * same places for every reader. `foot` the cart's (`CART_FOOT_N` unsaid).
 * @param {number} x @param {number} z @param {{ wagons: { x: number, z: number, yaw: number }[], horses: { x: number, z: number, yaw: number }[] }} team
 * @param {{ back: number, front: number, half: number }} [foot]
 */
export function clearOfTeam(x, z, team, foot = CART_FOOT_N) {
  const boxes = [
    ...team.wagons.map((w) => ({ c: w, back: foot.back, front: foot.front, half: foot.half })),
    ...team.horses.map((h) => ({ c: h, back: HORSE_FOOT_N.half, front: HORSE_FOOT_N.half, half: HORSE_FOOT_N.side })),
  ];
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const b of boxes) {
      const fx = Math.sin(b.c.yaw), fz = Math.cos(b.c.yaw);
      const dx = x - b.c.x, dz = z - b.c.z;
      const f = dx * fx + dz * fz, r = dx * fz - dz * fx;
      const back = b.back + BODY_CLEAR_N, front = b.front + BODY_CLEAR_N, half = b.half + BODY_CLEAR_N;
      if (f <= -back || f >= front || Math.abs(r) >= half) continue;
      // out by the nearest side
      const out = [[front - f, 'f'], [f + back, 'b'], [half - Math.abs(r), 'r']].sort((p, q) => /** @type {number} */ (p[0]) - /** @type {number} */ (q[0]))[0][1];
      let nf = f, nr = r;
      if (out === 'f') nf = front; else if (out === 'b') nf = -back; else nr = (r < 0 ? -1 : 1) * half;
      x = b.c.x + nf * fx + nr * fz; z = b.c.z + nf * fz - nr * fx;
      moved = true;
    }
    if (!moved) break;
  }
  return { x, z };
}

/** A wagon's wheels at the distance it has walked (native): the mod's turn by travel, wrapped. @param {number} s @param {number} wheelRadius */
export const wheelAngleAt = (s, wheelRadius) => wrapWheelAngle(wheelRotationDegrees(s / NATIVE_PER_M, wheelRadius));
