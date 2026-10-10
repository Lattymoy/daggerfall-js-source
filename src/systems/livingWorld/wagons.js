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
// along the WAY from the party's own (the way is the road's centre line, so a trailer's law - the axle on the line from
// where its wheels stood to its hitch - reduces to the way's own curve).
//
// AT CAMP (`campTeam`) the wagons stand at the ring's edge facing its fire, each horse unhitched beside its wagon; IN A
// FIGHT or a halt the train stands where it was. THE WHEELS turn with the distance walked (horseCartLaw.js
// wheelRotationDegrees). THE CARGO is the trip's: full on the way out; home, what was sold (half) or bought (three
// quarters), by its seed; a quarter if it was robbed (LW11/LW12 `robbed`).
import { wayAt, NATIVE_PER_M } from './trips.js';
import { lwSeed, textSeed } from './seed.js';
import { HITCHED_HORSE_LOCAL_Z, wheelRotationDegrees, wrapWheelAngle } from '../horseCartLaw.js';

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

/**
 * THE TRAIN IN FILE at a moment of its walk - each member's place (the van before, the leader at the first horse's head,
 * the rest behind), each horse's, each wagon's. `members` the party standing (trips.js membersAt); `at` partyAt's;
 * `hitchN` the axle's way back from its horse (native) - the wagon drawn's own (WAGONS1: Mac's Small Cart's 3.8 m where
 * his wagon is drawn), the mod's HITCH_N unsaid.
 * @param {any} trip @param {any} at @param {any[]} members @param {number} t @param {number} [hitchN]
 * @returns {{ people: { res: any, x: number, z: number, yaw: number, moving: boolean }[], horses: HorsePlace[], wagons: WagonPlace[] }}
 */
export function trainOf(trip, at, members, t, hitchN = HITCH_N) {
  const team = teamOf(trip);
  const back = at.phase === 'back';
  const dir = back ? -1 : 1;   // the way it walks, along the way's own s
  const moving = !at.halt && !at.camp;
  const place = (/** @type {number} */ s, side = 0) => {
    const p = wayAt(trip.way, s);
    return { x: p.x + Math.cos(p.yaw) * side, z: p.z - Math.sin(p.yaw) * side, yaw: back ? p.yaw + Math.PI : p.yaw };
  };
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
    horses.push({ key: `${trip.id}:h${i}`, ...place(s), moving });
    if (i < team.wagons) {
      const axle = s - dir * hitchN;
      // AUDIT LW-II E8: the distance walked the way the wagon faces - home, from the far end (the mod turns its wheels by
      // travel along the wagon's forward: the way's own s, falling home, spun them backwards)
      wagons.push({ key: `${trip.id}:w${i}`, ...place(axle), moving, tier: cargoOf(trip, t), s: back ? trip.way.len - axle : axle, hitched: true });
      s = axle - dir * WAGON_TAIL_N;
    } else s -= dir * WALK_GAP_N;
  }
  rear.forEach((m, i) => people.push({ res: m, ...place(s - dir * (i + 1) * WALK_GAP_N, (i % 2 ? 1 : -1) * 22), moving }));
  return { people, horses, wagons };
}

/**
 * AT CAMP: each wagon at the ring's edge beyond its people (CAMP_PARK_N past `ring`), facing the fire, its horse unhitched
 * at its side; a pack horse by itself. `cx`/`cz` the camp's fire (native), `r` its ring.
 * @param {any} trip @param {number} cx @param {number} cz @param {number} r @param {number} t
 * @returns {{ horses: HorsePlace[], wagons: WagonPlace[] }}
 */
export function campTeam(trip, cx, cz, r, t) {
  const team = teamOf(trip);
  const turn = (lwSeed(textSeed(trip.id), 0x7061726b) % 628) / 100;   // 'park'
  /** @type {HorsePlace[]} */
  const horses = [];
  /** @type {WagonPlace[]} */
  const wagons = [];
  const n = team.wagons + team.packs;
  for (let i = 0; i < n; i++) {
    const a = turn + (i / Math.max(1, n)) * Math.PI * 2;
    const d = r + CAMP_PARK_N;
    const x = cx + Math.sin(a) * d, z = cz + Math.cos(a) * d;
    const face = Math.atan2(cx - x, cz - z);   // to the fire
    if (i < team.wagons) {
      wagons.push({ key: `${trip.id}:w${i}`, x, z, yaw: face, moving: false, tier: cargoOf(trip, t), s: 0, hitched: false });
      horses.push({ key: `${trip.id}:h${i}`, x: x + Math.cos(face) * CAMP_HORSE_SIDE_N, z: z - Math.sin(face) * CAMP_HORSE_SIDE_N, yaw: face + Math.PI / 2, moving: false });
    } else horses.push({ key: `${trip.id}:h${i}`, x, z, yaw: face + Math.PI / 2, moving: false });
  }
  return { horses, wagons };
}

/** A wagon's wheels at the distance it has walked (native): the mod's turn by travel, wrapped. @param {number} s @param {number} wheelRadius */
export const wheelAngleAt = (s, wheelRadius) => wrapWheelAngle(wheelRotationDegrees(s / NATIVE_PER_M, wheelRadius));
