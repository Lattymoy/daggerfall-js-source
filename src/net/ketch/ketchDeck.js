// @ts-check
// KETCH (bible/11-Multiplayer/Sky-Ketch.md section 3): THE KETCH'S DECK PLAN - where every floor, wall, stage, spot and
// hazard of the sky-ketch Mzunthar stands, and the clocks its hazards run on. Pure, and both ends': the page lays the ship
// from it (world/ketch/ketchModel.js) and draws its hazards; the relay places its constructs, judges its cells and its
// hazards on the trails it holds (net/ketch/ketchBrain.js, net/ketch/ketchJudge.js).
//
// THE FRAME is the DECK's: metres, y up, x across (starboard -x, port +x - the engine's frame is left-handed: facing the
// bow, -z, the right hand is -x; AUDIT KETCH L4-12), z along the keel from the bow (z 0, the Anchor Deck's fore rail) to
// the stern - and into the dungeon host's frame by the Shattered Hour's own move (net/superDungeon/sdBrain.js
// realmToDungeon, SD_REALM_ORIGIN): one translation, so the Hour's Steps' scene lays the Sailwalk unchanged
// (scenes/superDungeon/sdSteps.js, with this file's course) and the Hour's telegraph floor reads it.
//
//   THE ANCHOR DECK   the bow, y 0 - where the anchor-lift sets a crew down, and its way down
//   THE WAIST         y 0, the open deck - THE BOARDING WATCH's three waves
//   THE GALLERY       y -6, the gun deck - THE GALLERY OF HAMMERS: six rows of hammers, two steam lanes, the Hammer Wardens
//   THE HOLD          y -12 - THE STARVED ENGINE: six cradles of aether cells aft, the engine fore, three arc-coils between
//   THE MAST-LIFT     a cage in a brass tower at the waist's port quarter, the hold to the main top (y 16)
//   THE SAILWALK      outboard to port over the open sky, the main top's yard to the bridge - the Hour's course law
//   THE BRIDGE        y 0, the stern's round deck - THE TONAL WARDEN; its outer ring in eight sections
//   THE CABIN         behind the helm - the Ketchmaster's hold, and the stern lift down
//
// Not a DFU member. Ledger A (KETCH).
import { realmToDungeon, dungeonToRealm, SD_REALM_ORIGIN } from '../superDungeon/sdBrain.js';
import { courseOf } from '../eliteGates/egSpanLaw.js';
import { shDisc, shLane } from '../eliteGates/egShape.js';
import { wrapAngle } from '../../world/mat4.js';   // ONCRASH1: the port's one angle wrap (net/wire.js imports it too)

/** The deck's frame into the dungeon's: the Hour's own move (one home). */
export const KT_ORIGIN = SD_REALM_ORIGIN;
export const deckToDungeon = realmToDungeon;
export const dungeonToDeck = dungeonToRealm;

// ── THE FLOORS ─────────────────────────────────────────────────────────────────────────────────────────────────
/** A deck's rectangle: across `x0`..`x1`, along `z0`..`z1`, its top at `y`. */
const box = (x0, x1, z0, z1, y) => Object.freeze({ x0, x1, z0, z1, y });
export const KT_ANCHOR = box(-9, 9, 0, 14, 0);
export const KT_WAIST = box(-13, 13, 14, 62, 0);
/** The gun deck: the Gallery's corridor and, aft, the Wardens' landing (wider). */
export const KT_GALLERY = box(-6, 6, 52, 110, -6);
export const KT_LANDING = box(-9, 9, 110, 128, -6);
export const KT_HOLD = box(-12, 12, 52, 132, -12);
/** The height a deck stands under the one above (its ceiling - the next floor's underside). */
export const KT_DECK_H = 6;
/** Where a crew arrives (the anchor-lift's cage), facing +z - and the anchor-lift itself, the way down. */
export const KT_ARRIVE = Object.freeze({ x: 0, y: 0, z: 6, yaw: 0 });
export const KT_ANCHOR_LIFT = Object.freeze({ x: 0, z: 2.2, r: 1.8 });
/** THE WATCH HATCH: an opening in the waist's floor (x0..x1, z0..z1) and the stair under it, y 0 at z0 to the gallery's
 *  -6 at z1 - barred (a grate over the opening) until the Watch is broken. */
export const KT_HATCH = Object.freeze({ x0: -2, x1: 2, z0: 52, z1: 60, y0: 0, y1: -6 });
/** THE HOLD HATCH: the landing's opening and the stair down, -6 at z0 to the hold's -12 at z1 - barred until the
 *  Hammer Wardens fall. */
export const KT_HOLD_HATCH = Object.freeze({ x0: -2, x1: 2, z0: 116, z1: 124, y0: -6, y1: -12 });
/** THE QUARTER WALL: the waist's aft bulkhead, from rail to rail, this tall - the ship beyond it closed. */
export const KT_QUARTER_WALL = Object.freeze({ z: 62, h: 8 });

// ── THE MAST-LIFT ──────────────────────────────────────────────────────────────────────────────────────────────
/** The lift's tower (a square shaft `half` either way about its axis) and its cage (a disc `r`), from the hold's floor
 *  to the main top's. Its round trip on the shared clock: up KT_LIFT.rise s, KT_LIFT.wait at the top, down, KT_LIFT.wait
 *  at the foot. It runs once the engine is fed; before, its cage stands at the foot, dark. */
export const KT_LIFT = Object.freeze({ x: 9, z: 58, half: 3, r: 2.2, y0: -12, y1: 16, rise: 9, wait: 7 });
/** The cage's cycle (s). */
export const KT_LIFT_CYCLE = 2 * (KT_LIFT.rise + KT_LIFT.wait);
/** THE MAIN MAST: it stands on the waist beside the lift's tower (the made level's mast - world/ketch/ketchModel.js KT_MASTS[0]
 *  - is laid at these numbers; the constructs walk round it, net/ketch/ketchConstructs.js KT_OBSTACLES). */
export const KT_MAIN_MAST = Object.freeze({ x: KT_LIFT.x, z: KT_LIFT.z - 6, r: 0.85 });
/** The cage's top's height at shared second `t` (the deck's y): `on` false - the engine unfed - at its foot. */
export function liftYAt(t, on = true) {
  if (!on || !Number.isFinite(t)) return KT_LIFT.y0;
  const u = ((t % KT_LIFT_CYCLE) + KT_LIFT_CYCLE) % KT_LIFT_CYCLE, R = KT_LIFT.rise, W = KT_LIFT.wait, H = KT_LIFT.y1 - KT_LIFT.y0;
  const ease = (k) => k * k * (3 - 2 * k);
  if (u < W) return KT_LIFT.y0;
  if (u < W + R) return KT_LIFT.y0 + H * ease((u - W) / R);
  if (u < 2 * W + R) return KT_LIFT.y1;
  return KT_LIFT.y1 - H * ease((u - 2 * W - R) / R);
}
/** THE MAIN TOP: the round platform about the lift tower's head (the shaft's square open in its middle - the cage comes up
 *  into it), and THE YARD from its port edge out to the Sailwalk's first top (a plank railed and netted both sides). */
export const KT_MAIN_TOP = Object.freeze({ x: KT_LIFT.x, z: KT_LIFT.z, r: 6.5, y: KT_LIFT.y1 });
export const KT_YARD = Object.freeze({ x0: KT_LIFT.x + 6.2, x1: 21.4, z: KT_LIFT.z, halfW: 1.1, y: KT_LIFT.y1 });
/** THE BOSUN'S LINE: from the main top's aft side to the gangway's head, once the bridge is unbarred - where it is taken
 *  (its post, `r` about it), and where it sets a rider down. */
export const KT_LINE = Object.freeze({ x: KT_LIFT.x, z: KT_LIFT.z + 4.8, r: 1.4 });

// ── THE SAILWALK: the Hour's course law, outboard to port ──────────────────────────────────────────────────────
/** The Hour's step tops (world/superDungeon/sdSteps.js SD_DRIFT_SIZE, SD_BEAT_SIZE, SD_CRUMBLE_SIZE; SD_RISER_H) - one home
 *  there; restated as their numbers here only so the relay's bundle reads no world module. Pinned equal. */
export const KT_STEP_SIZES = Object.freeze({ drift: Object.freeze({ w: 3.0, d: 2.4 }), beat: Object.freeze({ w: 3.0, d: 2.6 }), crumble: Object.freeze({ w: 2.6, d: 2.6 }), riser: 2.3 });
/** The Beat's half cycle (s) - net/eliteGates/egSpanLaw.js EG_BEAT_HALF_MS's. */
const BEAT_HALF = 1.8;
/**
 * THE SAILWALK'S SPEC (net/eliteGates/egSpanLaw.js courseOf - the Hour's and the Spire's one course law): from THE FIRST TOP
 * at the yard's end (A), out along x 24 over the open sky - THE YARDS (six drifting spars, a running jump apart when they
 * line up), THE SECOND TOP (B); THE BEATING PLATES (five plates there only on the Ketch's beat, and a riser) to THE
 * MIZZEN TOP (C); THE ROTTEN RIGGING (seven planks stepping down to the bridge's deck, each falling 0.7 s after a foot
 * touches it, the Hour's breath gusting across them). A fall into the sky past the Hour's void (-30) is caught by the
 * nets and cast back to the span's top, 15% of the body's health (the Steps' own law).
 */
export const KT_COURSE_SPEC = (() => {
  const S = KT_STEP_SIZES, sz = (q) => Object.freeze({ w: q.w, d: q.d });
  const drift = [2.6, 2.8, 2.4, 3.0, 2.6, 2.8].map((gap, k) => Object.freeze({ kind: 'drift', gap, size: sz(S.drift), amp: [1.2, 1.6, 1.0, 1.8, 1.4, 2.0][k], period: [4, 5, 6, 4.5, 7, 5.5][k], phase: k * 0.9 }));
  let b = 0;
  const beats = [['beat', 2.6], ['beat', 2.8], ['riser', 0], ['beat', 2.6], ['beat', 2.8], ['beat', 2.6]]
    .map(([kind, gap]) => Object.freeze(kind === 'riser' ? { kind, gap, size: sz(S.beat), rise: S.riser } : { kind, gap, size: sz(S.beat), beat: (b++ % 2) * BEAT_HALF }));
  const crumble = [2.6, 2.4, 2.8, 2.6, 2.8, 2.6, 2.8].map((gap) => Object.freeze({ kind: 'crumble', gap, size: sz(S.crumble) }));
  return Object.freeze({
    x: 24, start: Object.freeze({ x: 24, y: KT_LIFT.y1, z: KT_LIFT.z, r: 3 }), checkR: 3, toEnd: 2.4,
    sections: Object.freeze([
      Object.freeze({ pieces: Object.freeze(drift), check: 2.6 }),
      Object.freeze({ pieces: Object.freeze(beats), check: 2.6 }),
      Object.freeze({ pieces: Object.freeze(crumble), check: null, descend: true }),
    ]),
  });
})();
/** The course laid (its steps, its three tops, its end at the bridge's deck). */
export const KT_COURSE = (() => {
  const c = courseOf(/** @type {any} */ (KT_COURSE_SPEC));
  return Object.freeze({ steps: Object.freeze(c.steps.map((s) => Object.freeze(s))), checkpoints: Object.freeze(c.checkpoints.map((q) => Object.freeze(q))), end: c.end });
})();

// ── THE BRIDGE ─────────────────────────────────────────────────────────────────────────────────────────────────
/** The stern's round deck: its centre, radius, and the core that never falls (the outer ring's eight sections do). */
export const KT_BRIDGE = Object.freeze({ x: 0, z: 200, r: 24, core: 15, y: 0 });
/** THE GANGWAY: the course's end to the bridge's rim, `w` wide. */
export const KT_GANGWAY = (() => {
  const ax = KT_COURSE_SPEC.x, az = KT_COURSE.end, dx = KT_BRIDGE.x - ax, dz = KT_BRIDGE.z - az, d = Math.hypot(dx, dz);
  const bx = ax + (dx / d) * (d - KT_BRIDGE.r + 1.2), bz = az + (dz / d) * (d - KT_BRIDGE.r + 1.2);
  return Object.freeze({ ax, az: az - 1.2, bx, bz, w: 3, y: 0 });
})();
/** WHERE THE BOSUN'S LINE SETS ITS RIDER DOWN (AUDIT KETCH L3-7, L4-6 - it set them at the gangway's open head, facing the
 *  drop behind them, inside the Rotten Rigging's gust, which blows to the course's end): KT_LINE_LAND_M along the gangway
 *  from its head - past the gust (world/superDungeon/sdSteps.js inBreath, z < KT_COURSE.end) - facing along it to the
 *  bridge (`yaw`, the motor's own: forward [sin, cos]). */
export const KT_LINE_LAND_M = 2.5;
export const KT_LINE_LAND = (() => {
  const G = KT_GANGWAY, dx = G.bx - G.ax, dz = G.bz - G.az, d = Math.hypot(dx, dz);
  return Object.freeze({ x: G.ax + (dx / d) * KT_LINE_LAND_M, z: G.az + (dz / d) * KT_LINE_LAND_M, yaw: Math.atan2(dx, dz) });
})();
/** The helm (the Warden's home, facing the way in - -z), and the console it keeps (a block the bodies walk round). */
export const KT_HELM = Object.freeze({ x: 0, z: 214, yaw: Math.PI });
/** Where the Tonal Warden stands at its helm - before the wheel, facing the way in, never in the pedestal (AUDIT KETCH
 *  L4-10: its home was the pedestal's centre); its pedestal (the wheel's column) a body walks round. */
export const KT_HELM_PEDESTAL_R = 0.7;
export const KT_WARDEN_HOME = Object.freeze({ x: KT_HELM.x, z: KT_HELM.z - 2.8, yaw: KT_HELM.yaw });   // its body (KW_BODY.r 2) clear of the pedestal
export const KT_CONSOLE = Object.freeze({ x0: -2, x1: 2, z0: 217, z1: 219.5, h: 1.6 });
/** THE RESONATORS - four pylons on the outer ring at its quarters, each in the middle of its section (bearings 22.5 + 90k
 *  degrees from +z toward +x - sections 0, 2, 4 and 6: the ring's seams never run through one). */
export const KT_RESONATORS = Object.freeze([0, 1, 2, 3].map((k) => { const a = Math.PI / 8 + (k * Math.PI) / 2; return Object.freeze([KT_BRIDGE.x + Math.sin(a) * 19, KT_BRIDGE.z + Math.cos(a) * 19]); }));
/** THE BRIDGE'S CRADLES - two, on the core by the forward rim (never on a section that falls): the Discord's cells. */
export const KT_BRIDGE_CRADLES = Object.freeze([Object.freeze([-4, 189]), Object.freeze([4, 189])]);
/** THE TUNING-FORKS rise on the core, in this ring. */
export const KT_FORK_RING = Object.freeze([6, 13]);
/** THE OUTER RING'S EIGHT SECTIONS: section k spans the bearings [k, k+1) x 45 degrees from +z toward +x. */
export const KT_SECTIONS = 8;
export const sectionAt = (x, z) => {
  const dx = x - KT_BRIDGE.x, dz = z - KT_BRIDGE.z, d = Math.hypot(dx, dz);
  if (d < KT_BRIDGE.core || d > KT_BRIDGE.r + 0.5) return -1;
  const a = Math.atan2(-dx, -dz) + Math.PI;   // the bearing from +z toward +x in (0, 2 pi] - the opposite ray's, turned back
  return Math.floor(a / (Math.PI / 4)) % KT_SECTIONS;
};
/** THE CABIN behind the helm, its door on the bridge's aft rim; the vault's chest; the stern lift down. */
/** THE GUN DECK'S GUNS: where they stand along each wall, and how far their carriages reach in from it - clear of the outer
 *  hammer lanes (KT_HAMMER.lanes, a body's breadth to spare: AUDIT KETCH L4-11, drawn across them and walked through). */
export const KT_GUN_ZS = Object.freeze([64, 72, 80, 88, 96]);
export const KT_GUN_DEPTH = 1.1;
export const KT_CABIN = box(-7, 7, 224, 236, 0);
export const KT_CABIN_DOOR = Object.freeze({ x0: -1.8, x1: 1.8, z: 224 });
/** THE BRIDGE RAIL'S GAPS (AUDIT KETCH L4-1 - the outer ring's rail ran the whole way round, a wall across the gangway's foot
 *  and the cabin's door that only a well-timed running jump got over): where the rail stands open, each `{ at, half }` - its
 *  bearing (radians from +z toward +x about the bridge's centre) and its half-width - the gangway's width and the door's,
 *  each with a body's room to spare. */
export const KT_RAIL_R = KT_BRIDGE.r - 0.2;
export const KT_RAIL_GAPS = (() => {
  const B = KT_BRIDGE, G = KT_GANGWAY, half = (w) => Math.asin(Math.min(1, w / KT_RAIL_R));
  const way = Math.atan2(G.bx - B.x, G.bz - B.z), door = Math.atan2((KT_CABIN_DOOR.x0 + KT_CABIN_DOOR.x1) / 2 - B.x, KT_CABIN_DOOR.z - B.z);
  return Object.freeze([
    Object.freeze({ at: way, half: half(G.w / 2 + 0.3) }),
    Object.freeze({ at: door, half: half((KT_CABIN_DOOR.x1 - KT_CABIN_DOOR.x0) / 2 + 0.3) }),
  ]);
})();
/** The runs of a section's rail from bearing a0 to a1 (an arc under half a turn) - the arc less the gaps ([from, to] each,
 *  from < to), each gap taken at its bearing nearest the arc's middle. Pure. */
export function railRuns(a0, a1, gaps = KT_RAIL_GAPS) {
  const mid = (a0 + a1) / 2, cut = [];
  for (const g of gaps) { const c = mid + wrapAngle(g.at - mid), lo = c - g.half, hi = c + g.half; if (hi > a0 && lo < a1) cut.push([Math.max(a0, lo), Math.min(a1, hi)]); }
  cut.sort((p, q) => p[0] - q[0]);
  const out = [];
  let at = a0;
  for (const [lo, hi] of cut) { if (lo > at + 1e-6) out.push([at, lo]); at = Math.max(at, hi); }
  if (a1 > at + 1e-6) out.push([at, a1]);
  return out;
}
export const KT_VAULT = Object.freeze({ x: 3, z: 231 });
export const KT_STERN_LIFT = Object.freeze({ x: -3.5, z: 230.5, r: 1.6 });

// ── THE STAGES' SPOTS ──────────────────────────────────────────────────────────────────────────────────────────
/** The Watch's: where spheres drop from the rigging, sentries take their posts, the Watch-Captain comes up. */
export const KT_WATCH_SPOTS = Object.freeze({
  sphere: Object.freeze([[-11, 20], [11, 20], [-11, 30], [11, 30], [-11, 40], [11, 40], [-11, 50], [11, 50], [-6, 56], [2.5, 56], [0, 30], [0, 42]].map((p) => Object.freeze(p))),   // AUDIT KETCH L4-10: (6, 56) stood inside the lift's tower, (0, 44) in the aft hatch cover
  sentry: Object.freeze([[-10, 58], [10, 50], [-4, 58], [3, 58]].map((p) => Object.freeze(p))),   // AUDIT KETCH L4-10: (4, 58) against the lift's tower
  captain: Object.freeze([0, 54]),
});
/** The waist's cover: two capstans (discs) and three hatch covers (boxes `w` x `d`, `h` tall). */
export const KT_WAIST_COVER = Object.freeze({
  capstans: Object.freeze([Object.freeze({ x: -5.5, z: 38, r: 1.2, h: 1.3 }), Object.freeze({ x: 5.5, z: 38, r: 1.2, h: 1.3 })]),
  covers: Object.freeze([Object.freeze({ x: -8, z: 26, w: 3, d: 2.2, h: 1.0 }), Object.freeze({ x: 8, z: 26, w: 3, d: 2.2, h: 1.0 }), Object.freeze({ x: 0, z: 46, w: 3.4, d: 2.4, h: 1.0 })]),
});
/** The Hammer Wardens' posts on the landing, and how near a crew member's feet wake them. */
export const KT_WARDEN_POSTS = Object.freeze([Object.freeze([-4, 118]), Object.freeze([4, 118])]);
export const KT_WARDEN_WAKE_Z = 98;
/** THE STARVED ENGINE: the drum (fore in the hold) and its seven sockets on a ring about it, facing aft; THE CRADLES aft;
 *  the spiders' vents in the hold's walls. */
export const KT_ENGINE = Object.freeze({ x: 0, z: 64, r: 3, h: 5 });
export const KT_SOCKET_R = 4.6;
export const KT_SOCKETS = Object.freeze([-120, -80, -40, 0, 40, 80, 120].map((deg) => { const a = (deg * Math.PI) / 180; return Object.freeze([KT_ENGINE.x + Math.sin(a) * KT_SOCKET_R, KT_ENGINE.z + Math.cos(a) * KT_SOCKET_R]); }));
export const KT_CRADLES = Object.freeze([[-7, 112], [7, 112], [-7, 119], [7, 119], [-7, 126], [7, 126]].map((p) => Object.freeze(p)));
export const KT_VENTS = Object.freeze([[-11.5, 76], [11.5, 76], [-11.5, 100], [11.5, 100]].map((p) => Object.freeze(p)));
/** The reach a hand takes a cell from a cradle at, sets one in a socket or a resonator at, or picks a dropped one up at. */
export const KT_REACH = 2.6;
/** How many cells the engine eats for a crew of `n`: three, and one for each two aboard (four to seven). */
export const engineNeeds = (n) => Math.min(7, 5 + Math.ceil(Math.max(1, Math.min(8, n | 0)) / 2));   // KETCH-LONGER: 3 + half the crew before - six for one or two, seven (every socket) from three

// ── THE HAZARDS' CLOCKS (the shared clock's seconds - every screen and the relay alike) ─────────────────────────
/** THE GALLERY'S HAMMERS: six rows across the corridor, three lanes a row; each hammer slams once a cycle, its row's
 *  lanes a second apart, so one lane of every row stands clear two seconds in three. Each a disc `r` at its spot, wound up
 *  `wu` ms before it lands (its head rising), down `sp` ms. */
export const KT_HAMMER = Object.freeze({ rows: Object.freeze([68, 74, 80, 86, 92, 98]), lanes: Object.freeze([-4, 0, 4]), r: 1.9, cycle: 3.0, wu: 1000, sp: 450, p: 0.22, b: 8, nm: 'Gallery Hammer' });
/** Hammer (row `ri`, lane `li`)'s phase in its cycle (s). */
export const hammerPhase = (ri, li) => (ri * 0.5 + li * 1.0) % KT_HAMMER.cycle;
/** THE STEAM LANES: two across the corridor before the landing - each bursts `sp` ms every cycle, half a cycle apart. */
export const KT_STEAM = Object.freeze({ z: Object.freeze([103, 107]), w: 2.4, cycle: 4.0, wu: 900, sp: 1200, p: 0.14, b: 6, el: 'fire', nm: 'Steam' });
/** THE ARC-COILS in the hold: three pairs of posts across it, between the cradles and the engine - each arc live `sp`
 *  ms of every cycle, a third of a cycle apart. A carrier caught by one drops its cell. */
export const KT_ARCS = Object.freeze({ z: Object.freeze([84, 95, 106]), w: 1.8, cycle: 5.0, wu: 800, sp: 1400, p: 0.12, b: 6, el: 'shock', nm: 'Arc-Coil', post: 11.6 });

/**
 * The gallery's and the hold's hazard landings in (t0, t1] (shared seconds): each `{ k, i, s: [stamp], at (ms), wu, p, b,
 * el, nm, sp, y }` - `k` 'hammer' | 'steam' | 'arc', `i` its one number on the ship (a hammer row*3+lane, a steam lane 32+,
 * an arc 64+). Pure; both ends read it (the page draws each from its word, the relay judges each on its trails).
 * @param {number} t0 @param {number} t1 @param {{ gallery?: boolean, hold?: boolean }} [on]
 */
export function hazardsBetween(t0, t1, { gallery = true, hold = true } = {}) {
  const out = [];
  if (!(t1 > t0)) return out;
  const each = (cycle, phase, fn) => {
    const k0 = Math.ceil((t0 - phase) / cycle - 1e-9), k1 = Math.floor((t1 - phase) / cycle + 1e-9);
    for (let k = k0; k <= k1; k++) { const at = phase + k * cycle; if (at > t0 && at <= t1) fn(at); }
  };
  if (gallery) {
    const H = KT_HAMMER;
    H.rows.forEach((z, ri) => H.lanes.forEach((x, li) => each(H.cycle, hammerPhase(ri, li), (at) => out.push({ k: 'hammer', i: ri * 3 + li, s: [shDisc(x, z, H.r)], at: Math.round(at * 1000), wu: H.wu, p: H.p, b: H.b, el: null, nm: H.nm, sp: H.sp, y: KT_GALLERY.y }))));
    const S = KT_STEAM;
    S.z.forEach((z, j) => each(S.cycle, (j * S.cycle) / 2, (at) => out.push({ k: 'steam', i: 32 + j, s: [shLane(KT_GALLERY.x0, z, KT_GALLERY.x1, z, S.w)], at: Math.round(at * 1000), wu: S.wu, p: S.p, b: S.b, el: S.el, nm: S.nm, sp: S.sp, y: KT_GALLERY.y })));
  }
  if (hold) {
    const A = KT_ARCS;
    A.z.forEach((z, j) => each(A.cycle, (j * A.cycle) / 3, (at) => out.push({ k: 'arc', i: 64 + j, s: [shLane(-A.post, z, A.post, z, A.w)], at: Math.round(at * 1000), wu: A.wu, p: A.p, b: A.b, el: A.el, nm: A.nm, sp: A.sp, y: KT_HOLD.y })));
  }
  return out.sort((a, b) => a.at - b.at || a.i - b.i);
}

// ── WHERE A BODY STANDS ────────────────────────────────────────────────────────────────────────────────────────
const inBox = (B, x, z, pad = 0) => x >= B.x0 - pad && x <= B.x1 + pad && z >= B.z0 - pad && z <= B.z1 + pad;
const near = (y, Y, band = 2.5) => Math.abs(y - Y) <= band;
/**
 * The part of the ship a point (the deck's frame) stands in: 'anchor', 'waist', 'gallery', 'landing', 'hold', 'top' (the
 * main top and its yard), 'sailwalk', 'gangway', 'bridge', 'cabin', 'lift' (in the cage's shaft), or null (the open sky).
 * @param {number} x @param {number} y @param {number} z
 */
export function deckZoneAt(x, y, z) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  if (Math.abs(x - KT_LIFT.x) <= KT_LIFT.half && Math.abs(z - KT_LIFT.z) <= KT_LIFT.half && y > KT_LIFT.y0 - 1 && y < KT_LIFT.y1 - 1) return 'lift';
  if (near(y, 0)) {
    if (inBox(KT_ANCHOR, x, z)) return 'anchor';
    if (inBox(KT_WAIST, x, z)) return 'waist';
    if (Math.hypot(x - KT_BRIDGE.x, z - KT_BRIDGE.z) <= KT_BRIDGE.r + 0.5) return 'bridge';
    if (inBox(KT_CABIN, x, z)) return 'cabin';
    if (gangwayHolds(x, z, 0.5)) return 'gangway';
  }
  if (near(y, KT_GALLERY.y) && (inBox(KT_GALLERY, x, z) || inBox(KT_LANDING, x, z))) return inBox(KT_LANDING, x, z) ? 'landing' : 'gallery';
  if (near(y, KT_HOLD.y) && inBox(KT_HOLD, x, z)) return 'hold';
  if (near(y, KT_MAIN_TOP.y) && (Math.hypot(x - KT_MAIN_TOP.x, z - KT_MAIN_TOP.z) <= KT_MAIN_TOP.r + 0.5 || (x >= KT_YARD.x0 - 0.5 && x <= KT_YARD.x1 + 0.5 && Math.abs(z - KT_YARD.z) <= KT_YARD.halfW + 0.5))) return 'top';
  if (Math.abs(x - KT_COURSE_SPEC.x) <= 6 && z >= KT_COURSE_SPEC.start.z - KT_COURSE_SPEC.start.r && z <= KT_COURSE.end + 1 && y > -4) return 'sailwalk';
  return null;
}
/** Does the gangway hold (x, z), `pad` m about? */
export function gangwayHolds(x, z, pad = 0) {
  const G = KT_GANGWAY, dx = G.bx - G.ax, dz = G.bz - G.az, L = dx * dx + dz * dz;
  const t = L > 0 ? Math.max(0, Math.min(1, ((x - G.ax) * dx + (z - G.az) * dz) / L)) : 0;
  return Math.hypot(x - (G.ax + dx * t), z - (G.az + dz * t)) <= G.w / 2 + pad;
}
/** Does the bridge hold (x, z) - its disc, `pad` m about? */
export const onBridge = (x, z, pad = 0) => Number.isFinite(x) && Number.isFinite(z) && Math.hypot(x - KT_BRIDGE.x, z - KT_BRIDGE.z) <= KT_BRIDGE.r + pad;
/** The floor height of a zone (the deck's y). */
export const zoneFloorY = (zone) => (zone === 'gallery' || zone === 'landing' ? KT_GALLERY.y : zone === 'hold' ? KT_HOLD.y : zone === 'top' ? KT_MAIN_TOP.y : 0);
