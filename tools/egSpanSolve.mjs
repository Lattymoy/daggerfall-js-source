// EG6a (2026-10-12, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 9, 10.4 and 10.5): THE SPAN SOLVER'S
// CLI AND THE COURSE SWEEP.
//
// The solver is the law's (net/eliteGates/egSpanLaw.js - the relay and every client draw the same course); this only drives it, as
// tools/sdScoreProbe.mjs drives the Hour's score (section 9).
//
//     node tools/egSpanSolve.mjs <seed> <hall> [geo]
//         every course of the hall, road by road: each pair's launch windows (the span build's open share, its least in any
//         12 s, its longest wait), the proof, the road's crossing at THE SPAN BUILD (fastest, median) and at THE FAST BUILD,
//         and the crossing's bound (EG_CROSS_MIN, section 10.5)
//
//     node tools/egSpanSolve.mjs --sweep [--band <0-3>] [--seeds <n>] [--from <seed>] [--golden] [--part <p>/<k>]
//         THE SWEEP (section 10.5): every course the generator lays in a circle of the band, for each seed, crossed STEP BY
//         STEP BY THE REAL MOTOR - player/motor.js PlayerMotor at THE SPAN BUILD (Speed 10, Running 0, Jumping 0, every gap
//         a plain running jump; EG-PERFECT: the online page's parkour at skill 0 in every frame, as the game forces it, its
//         running leap refused as the Spire's made level refuses it) on player/collider.js Collider, over
//         the circle's floors (world/eliteGates/egHall.js egCircleColliderTris, the one bucket the dungeon stands) and its pieces as
//         the screen rides them (scenes/eliteGates/egSpan.js createEgSpan - the Steps' stepTris slabs, moving on the shared clock,
//         carrying, crumbling, a Pendulum's touch casting back, a Gust pushing). SD7b's harness (test/world/superDungeon/sd7b_steps.test.js) is
//         the model. A pilot plays each pair as a player would: it stands where it will run from, waits for a launch the
//         solver says lands (egJumpLands - its window held either side of the launch, its own piece standing under it to
//         the last, no gust in the flight), runs at the landing and jumps at the edge (what slides under it on the way, a
//         Rail's travel meeting its neighbour's, it stands on); a riser it runs up. Each band's
//         circle is the seed's (its first circle and the seed's fifth after it, its ground of span decrees the seed's from
//         the second). `--golden` adds the law pin's four seeds (test/net/eliteGates/egz_frag.test.js). A course that is not crossed
//         fails the run, naming its seed, hall, road and step; the exit code says so.
//
// CI runs 25 seeds a band on every pull request (.github/workflows/eg-sweep.yml, called by verify.yml), 500 nightly, and
// 500 again before every relay deploy (relay-deploy.yml).
//
// SWEEP-FAST (2026-10-19, Mac: "Yes" - a relay deploy took an hour, ~53 minutes of it one band's 500 seeds):
// `--part <p>/<k>` sweeps the p-th of k parts of the band's seeds - every k-th seed of the list from its p-th (sweepPart),
// the golden ones among them - so k jobs sweep a band at once and every seed is swept by exactly one of them.
//
// THE ASCENT (LAW 9, 2026-10-16; bible/11-Multiplayer/Elite-Gates-Ascent.md section 6): A HALL OF THE ASCENT'S LAW IS WALKED
// ALONG ITS ROUTE (sweepRoute), every road the route proves (net/eliteGates/egRouteProof.js egRouteRoads - the main way, THE FORK's
// other where it lays one; a side way never): the pilot turns onto each link (net/eliteGates/egSpanLaw.js egRouteSolved - the road's
// legs) and runs its walks and bridges, takes its stairs up and down, runs off its Drops, CLIMBS its climbs with the real
// climbing motor (player/parkour.js on the online page's lane at Climbing 0 with its fatigue spent - THE ROUTE'S PROOFS' own
// case - walked to the face, Forward held into it, resting on each ledge until its grip is back), and crosses each span
// link's course pair by pair as THE PLANNER crosses a course, to the door. The laws before keep their pilot exactly (one
// pilot, pilotOf, its course crossed as it always was). The circle's halls are walked so the moment they are THE ASCENT's;
// until THE ROOMS lays them:
//
//     node tools/egSpanSolve.mjs --sweep --law9 [--band <0-3>] [--seeds <n>] [--golden]
//         THE SWEEP over SYNTHETIC LAW 9 circles (tools/lib/egLaw9Synth.mjs, given as the relay gives a hall), CI's second step
//     node tools/egSpanSolve.mjs <seed> <hall> --law9 [--band <0-3>]
//         a synthetic hall read along its route: every link's kind and seconds, a climb's pitches against the grip, a span
//         link's pairs and their windows, THE MEDIAN's crossing and THE FAST BUILD's
//
// The climb faces a hall's collider does not stand (a synthetic hall's) the sweep stands itself (sweepClimbTris).
//
// Not a DFU member. Ledger A (ELITE-GATES).
import { egCircleSpecs, egFirstHallOf } from '../src/net/eliteGates/egLaw.js';
import { egHallOf, egSpecForget } from '../src/net/eliteGates/egLaw.js';
import { egSpanPairs, egPairWindows, egSpanProof, egRoadCross, egFastCross, egCrossMin, egCourseOf, egJumpLands, egJumpReach, egPieceAt, egPendHits,
  egSlagLane, egSlagState, egSlagX, egRouteCross, egRouteSolved, egAlongOf, egSpanBuildOf, EG_SPAN_RUN_MPS, EG_BODY_R, EG_CRUMBLE_KINDS, EG_CRUMBLE_DELAY_S, EG_SOLVE_HORIZON_S } from '../src/net/eliteGates/egSpanLaw.js';
import { egRouted, egRouteRoads, egClimbPitches, egPitchWallS, EG_ROUTE_COURSE_RISE_M } from '../src/net/eliteGates/egRouteProof.js';   // THE ASCENT: the route's legs
import { egRouteLen } from '../src/net/eliteGates/egRoute.js';
import { egSynth9Give } from './lib/egLaw9Synth.mjs';   // THE ASCENT: synthetic LAW 9 halls, until THE ROOMS lays them
import { egCircleColliderTris } from '../src/world/eliteGates/egHall.js';
import { createEgSpan, egStepKey, EG_FLOOR_KEY, EG_GUST_REACH_M } from '../src/scenes/eliteGates/egSpan.js';
import { egGustSections } from '../src/world/eliteGates/egLook.js';
import { PlayerMotor, walkSpeed } from '../src/player/motor.js';
import { Collider } from '../src/player/collider.js';
import { realmToDungeon, dungeonToRealm } from '../src/net/superDungeon/sdBrain.js';
import { gustAt } from '../src/world/superDungeon/sdSteps.js';
import { identity } from '../src/world/mat4.js';
import { egPolyIn } from '../src/net/eliteGates/egShape.js';   // EG-HERO-LAY: a hero's floors, crossed as still ground
import { isMain } from './lib/isMain.mjs';
import { madeLevelRule } from '../src/systems/madeLevel.js';   // EG-PERFECT: the Spire's running leap refused, as the game refuses it

/** THE SPAN BUILD on the motor (section 10.2 - SD7b's: Speed 10, Running 0), and its skills for the parkour (a riser). */
export const SWEEP_BUILD = Object.freeze({ speed: 10, running: 0, swimming: 30 });
const SKILL0 = Object.freeze({ climbing: 0, jumping: 0, khajiit: false, enhanced: false, fatigue: 1, load: 0 });
/** THE ASCENT (LAW 9): a climb on the way is climbed at Climbing 0 with its fatigue spent - THE ROUTE'S PROOFS' grip
 *  (net/eliteGates/egRouteProof.js EG_GRIP_S, parkour.js gripSeconds(0, 0)) - by a body that walked to its face (the proofs' pace). */
const CLIMB0 = Object.freeze({ ...SKILL0, fatigue: 0 });
/** The law pin's seeds (test/net/eliteGates/egz_frag.test.js) - every pull request sweeps their circles too. */
export const SWEEP_GOLDEN = Object.freeze([77, 0xbeef, 3, 12345]);
/** The pilot's frame, its margins (s, m), and how long a course may take before it is called lost (s of the clock). */
const DT = 1 / 60;
const HOLD_S = 0.06;          // a launch is taken only where it lands this long either side
const EDGE_M = 0;             // the jump is pressed at the edge: the motor still stands on it the frame it passes it, and a
                              // jump pressed short of it (SD7b pressed 0.1 m short) loses the widest gaps to a round island
const RUNUP_M = 0.45;         // the run-up the pilot stands back from the edge
const SIDE_M = 0.55;          // the landing aimed this far inside a piece's side
const COURSE_MAX_S = 240;
const ROUTE_MAX_S = 480;      // THE ASCENT: a routed hall's road, plate to door (THE ROOMS bound a way at 300 s at the span build)
const WINDOW_LOOK_S = 1.5;    // how far into a window the pilot looks for the moment its two tops line up
const REPLAN_MAX = 4;         // how often a course's pairs may be planned again, the pilot late to its run-up
const LATE_S = 0.2;           // a landing looked ahead from comes this late, at the near edge (a gap's widest is caught by the edge)
/** The pieces that stand still (and may be stepped down onto): a plain step, a ledge, a Drop's landing, a Gust's or a
 *  Vent's, a Bone bridge, a Crumble. */
const STILL = new Set(['still', 'ledge', 'drop', 'gust', 'vent', 'bone', 'crumble']);
/** The pieces that keep time under a foot: gone off their beat (a Beat, a Moon branch, a crust) or falling after one. */
const TIMED = new Set(['beat', 'moon', 'slag', 'crumble', 'bone', 'sink']);
/** EG-SWEEP-RED: THE SPAN BUILD with no catch at the far edge - its reach one capsule's radius short (the solver's reach
 *  counts the capsule over both edges: the landing's is a corner caught and stepped up onto, which a Rail's face moving
 *  away from the body never gives - the 500-seed sweep before world219's deploy, two jumps 3.1-3.2 m onto a Rail running
 *  away, the body pinned to its face and falling) */
const UNCAUGHT = Object.freeze({ ...egSpanBuildOf(0), reach: (/** @type {number} */ h) => { const r = egJumpReach(h); return { reach: r.reach - EG_BODY_R, air: r.air }; } });
const still = (o = {}) => ({ forward: 0, strafe: 0, run: false, jump: false, up: false, down: false, ...o });
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/** Still ground under me: the circle's floors, a Falling Wall's or a Collapsing Tube's segment, one of Grath's islands
 *  (scenes/eliteGates/egSpan.js's own buckets). */
const onGround = (key) => key === EG_FLOOR_KEY || /^eg:(wall|tube|isle):/.test(key ?? '');

/** A circle of `band` for `seed`, and its ground of span decrees (none in the first circle - its law has none). */
export function sweepCircleOf(seed, band) {
  const c = 1 + 5 * band + (seed % 5);
  return { c, geo: c <= 1 ? 0 : seed % 9 };
}

/** A road's chain as the pilot crosses it: the Low Road's the trunk's pairs to its fork, then its own (as the solver's). */
export function sweepPath(spec, road) {
  const launch = (p) => (p.a ? p.a.z + p.a.d / 2 : p.edge), roadOf = (p) => (p.b ?? p.a)?.road ?? 0;
  const fork = road === 1 && !!spec.fork;
  const path = egSpanPairs(spec).filter((p) => (fork ? roadOf(p) === 1 || (roadOf(p) === 0 && launch(p) < spec.fork.z - 0.01) : roadOf(p) === road));
  // a road's steps laid apart in the hall's count (THE FORK's High Road, its tail after the Low Road's) meet over no ground:
  // the solver's chain lands on the edge and leaves it again - the pilot jumps it whole
  const out = [];
  for (const p of path) {
    const l = out[out.length - 1];
    if (l && !l.b && l.a && !p.a && p.b && Math.abs(p.edge - l.edge) < 0.01 && roadOf(l) === roadOf(p)) out[out.length - 1] = { a: l.a, b: p.b, edge: p.edge };
    else out.push(p);
  }
  return out;
}

/**
 * THE CIRCLE STOOD for the sweep: its floors in one bucket and its pieces as the screen rides them, on a real Collider.
 * @param {number} seed @param {number} c @param {number} geo
 */
export function sweepStand(seed, c, geo) {
  const col = new Collider(() => -Infinity);
  const tris = egCircleColliderTris(seed, c, geo), n = tris.length / 3, idx = n > 65535 ? new Uint32Array(n) : new Uint16Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  col.addMesh(EG_FLOOR_KEY, tris, idx, identity());
  const specs = egCircleSpecs(seed, c, geo), faces = sweepClimbTris(col, specs);
  if (faces.length) { const k = faces.length / 3, fi = k > 65535 ? new Uint32Array(k) : new Uint16Array(k); for (let i = 0; i < k; i++) fi[i] = i; col.addMesh(SWEEP_CLIMB_KEY, faces, fi, identity()); }
  const span = createEgSpan({ seed, c, geo });
  span.stand({ dynamicDraws: [], collider: col });
  return { seed, c, geo, col, span, specs };
}
/** THE ASCENT (LAW 9): the bucket the sweep stands climb faces in, where the circle's collider stands none. */
export const SWEEP_CLIMB_KEY = 'eg:climbface';
/**
 * THE ASCENT (LAW 9) - A HALL'S CLIMB FACES the circle's collider does not stand (a synthetic hall's, before THE ROOMS' collider
 * stands them - world/eliteGates/egHall.js): every climb's pitches (spec.climbs - net/eliteGates/egRouteProof.js egClimbPitches), each a wall from
 * its ledge to the next, set back a ledge's depth (`d`) a pitch into the wall from the first face's line - each stood only
 * where a level ray from a metre before it, at its middle height, meets nothing within a metre and a half. Triangles in the
 * dungeon's frame.
 * @param {any} col @param {any[]} specs
 */
export function sweepClimbTris(col, specs) {
  const out = [];
  for (const spec of specs) for (const c of spec.climbs ?? []) {
    const nx = c.face[0], nz = c.face[1], d = c.d ?? 1.2, P = (x, y, z) => realmToDungeon(spec.x0 + x, y, z), ys = [c.y0];
    for (const H of egClimbPitches(c)) ys.push(ys[ys.length - 1] + H);
    for (let k = 0; k + 1 < ys.length; k++) {
      const ax = c.x0 - nx * d * k, az = c.z0 - nz * d * k, bx = c.x1 - nx * d * k, bz = c.z1 - nz * d * k, y0 = ys[k], y1 = ys[k + 1];
      if (col.raycastHit(P((ax + bx) / 2 + nx, (y0 + y1) / 2, (az + bz) / 2 + nz), [-nx, 0, -nz], 1.5).dist < 1.5) continue;
      const a = P(ax, y0, az), b = P(bx, y0, bz), e = P(bx, y1, bz), f = P(ax, y1, az);
      out.push(...a, ...b, ...e, ...a, ...e, ...f);
    }
  }
  return new Float32Array(out);
}

/**
 * THE PILOT: the real motor set on hall `spec`'s arrival plate at shared second `t0` (road `road`), and its moves - `frame`
 * (the screen's ride, then the motor), `walkTo` a point, `crossGround` (the still ground along a line, its gaps leapt),
 * `crossPairs` (a chain of pairs crossed as THE PLANNER crosses them - each launch the solver allows, run, jump, flight and
 * landing), and THE ASCENT's (LAW 9): `wayTo` a node of the route along its link, `climbUp` a climb's pitches. `trace` hears
 * every frame (a hook for following one crossing): the clock, where I stand (the hall's frame), whether grounded and on
 * what, the input.
 * @param {ReturnType<typeof sweepStand>} S @param {any} spec @param {number} road @param {number} t0
 */
function pilotOf(S, spec, road, t0, trace = null) {
  const { col, span } = S, h = spec.h, X0 = spec.x0;
  // EG-PERFECT (2026-10-18; bible/11-Multiplayer/Elite-Gates.md section 10.5): THE ONLINE PAGE'S PARKOUR IN EVERY FRAME - the
  // enhanced climb is forced on online (systems/features.js `enhanced-climbing`), so the pilot crosses with it on as the game
  // does (it had it on for a riser and a climb alone, and so never met the running leap), and with the leap refused as the
  // Spire's made level refuses it (systems/madeLevel.js `runLeap` - scenes/shared.js parkourDeps' `leap`): every gap a plain
  // running jump, the wall run, the mantle and the free climb the game's own
  let skills = SKILL0;
  const parkour = { enabled: () => true, leap: () => madeLevelRule('spire', 'runLeap') !== 'refused', inputs: () => skills, tally: () => {}, say: () => {}, hold: null };
  const m = new PlayerMotor(col, SWEEP_BUILD, { parkour });
  const fail = (step, why) => ({ ok: false, seed: S.seed, h, road, step, why, t: t - t0 });
  let t = t0;
  const at = realmToDungeon(X0 + spec.arrive.x, spec.arrive.y ?? 0, spec.arrive.z);
  m.spawn(at[0], at[1] + 0.05, at[2]);
  span.setSafe(null);
  /** THE BROKEN WAY (spec law 10): the heading a turned span leg is crossed along (0 +z - the hall's own frame): while it is
   *  set, where I stand is read in its frame (egAlongOf - x across, z along) and every yaw I steer is turned with it, so the
   *  planner crosses a turned course's pairs (egSpanPairs' own frame) as it crosses any course */
  let turn = 0;
  const me = () => { const p = dungeonToRealm(m.pos[0], m.pos[1], m.pos[2]), x = p[0] - X0; if (!turn) return { x, y: p[1], z: p[2] }; const [a, b] = egAlongOf(turn, x, p[2]); return { x: a, y: p[1], z: b }; };
  /** THE ASCENT (LAW 9): the heights of the way being crossed (`[lo, hi]` - a span link's ends and its course's rise either
   *  side): still ground off them stands on another storey and is none of this way's. Null - every floor (the laws before). */
  let wayYs = /** @type {number[]|null} */ (null);
  const storey = (y) => wayYs != null && ((y ?? 0) < wayYs[0] || (y ?? 0) > wayYs[1]);
  /** one frame: the screen's ride before the motor (the game's order); a cast-back is a fall */
  const frame = (input, yaw = 0) => {
    const back = span.ride(t, DT, m, true);
    if (back) return 'fell';
    m.update(DT, input, yaw + (turn * Math.PI) / 2, 0);
    t += DT;
    trace?.(t, me(), m.grounded, m.groundKey, input);
    return null;
  };
  /** walk to (x, z) of the hall's frame - `rel` a piece it moves with (its offset from the piece's place) - and stand */
  const walkTo = (gx, gz, rel = null, until = Infinity) => {
    let best = Infinity, since = t;
    const y0 = me().y;
    for (let k = 0; k < 60 * 60; k++) {
      const o = rel ? egPieceAt(rel, t) : null;
      const tx = gx + (o ? o.dx : 0), tz = gz + (o ? o.dz : 0), p = me(), dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
      if (d < 0.08 || t >= until) return null;
      if (d < best - 0.02) { best = d; since = t; }
      if (t - since > 2) return 'stuck';
      const yaw = Math.atan2(dx, dz);
      if (frame(still({ forward: 1, run: d > 0.3 }), yaw)) return 'fell';
      if (!m.grounded && me().y < y0 - 2.5) return 'fell';
    }
    return 'stuck';
  };
  /** THE STILL GROUND along the line `x` (the hall's frame): its stretches along z, merged - a plate, an island, a band, a
   *  passage's floors, a lane along the course. The hall law leaves gaps between them (a passage's floor and the island
   *  after it, a Collapsing Tube's end): no piece keeps their time, so the solver's chain runs over them as one ground. */
  const groundAt = (x) => {
    const iv = [];
    for (const d of spec.discs) { const dx = Math.abs(x - d.x); if (dx <= d.r - 0.4 && !storey(d.y)) { const hh = Math.sqrt(d.r * d.r - dx * dx); iv.push([d.z - hh, d.z + hh]); } }
    for (const q of spec.bands) if (Math.abs(x - q.x) <= q.halfW - 0.4 && !storey(q.y)) iv.push([q.z0, q.z1]);
    for (const l of spec.lanes) if (Math.abs(l.ax - l.bx) < 0.01 && Math.abs(x - l.ax) <= l.hw - 0.4 && !storey(l.y)) iv.push([Math.min(l.az, l.bz), Math.max(l.az, l.bz)]);
    // EG-HERO-LAY: a hero's floors (its law's polygons) - where the line runs 0.4 m inside each, a tenth of a metre at a time
    for (const q of spec.heroes ?? []) for (const g of q.floors) {
      if (storey(g.y)) continue;
      const zs = g.poly.map((p) => p[1]), z1 = Math.max(...zs), on = (z) => egPolyIn(g.poly, x, z) && egPolyIn(g.poly, x - 0.4, z) && egPolyIn(g.poly, x + 0.4, z);
      let a = null;
      for (let k = 0, z = Math.min(...zs); z <= z1 + 1e-9; z = Math.min(...zs) + ++k * 0.1) { if (on(z)) a ??= z; else if (a != null) { iv.push([a, z - 0.1]); a = null; } }
      if (a != null) iv.push([a, z1]);
    }
    iv.sort((u, v) => u[0] - v[0]);
    const out = [];
    for (const q of iv) { const l = out[out.length - 1]; if (l && q[0] <= l[1] + 0.05) l[1] = Math.max(l[1], q[1]); else out.push([...q]); }
    return out;
  };
  /** over the still ground along `gx` to `gz`, every gap in it leapt (a running jump at its edge - nothing keeps its time) */
  const crossGround = (gx, gz) => {
    const iv = groundAt(gx);
    for (let n = 0; n < 32; n++) {
      const p = me(), here = iv.find((q) => p.z >= q[0] - 0.6 && p.z <= q[1] + 0.6);
      if (!here || gz <= here[1] - 0.3) return walkTo(gx, Math.min(gz, here ? here[1] - 0.5 : gz));
      const next = iv.find((q) => q[0] > here[1]);
      if (!next) return walkTo(gx, gz);
      if (next[0] - here[1] > 3.6) return `a gap of ${(next[0] - here[1]).toFixed(2)} m in the ground`;
      const err = walkTo(gx, here[1] - EDGE_M - RUNUP_M);
      if (err) return err;
      let jumped = false, landed = false;
      for (let k = 0; k < 4 * 60 && !landed; k++) {
        const go = !jumped && me().z >= here[1] - EDGE_M;
        if (frame(still({ forward: jumped ? 0 : 1, run: true, jump: go, up: go }), 0)) return 'fell';
        if (go) jumped = true;
        if (!m.grounded && me().y < p.y - 4.6) return 'fell over a gap in the ground';
        landed = jumped && m.grounded && !m.jumping && me().z > here[1];
      }
      if (!landed) return 'never landed over a gap in the ground';
    }
    return walkTo(gx, gz);
  };
  // the gust's sections of this hall (the screen's own reach: its Gust pieces, 4 m either side)
  const gz = egGustSections([spec]);
  // THE ASCENT (LAW 9): a section pushes only about its own line (the screen's EG_GUST_REACH_M - scenes/eliteGates/egSpan.js), never a
  // course of another line beside its z (a hall's courses stand side by side)
  const gusty = (r, z, a, b, x = null) => { if (!gz.some((g) => g.road === r && z >= g.z0 && z <= g.z1 && (x == null || Math.abs(x - g.x) <= EG_GUST_REACH_M))) return false; for (let u = a; u <= b; u += 0.05) if (gustAt(u).push) return true; return false; };

  // THE PLANNER's chain (crossPairs sets it), since when I stand on what I stand on, and the crust's lane I landed on
  let pairs = /** @type {any[]} */ ([]), standSince = t, standLane = -1;
  // THE PLANNER: a launch the solver says lands (egJumpLands - held HOLD_S either side), my own piece standing under me to
  // the last (a Beat on its beat, a Moon branch lit, a crust holding, a Crumble before its fall, a sinking flight before it
  // is gone), no gust in its flight - and, while what it lands on keeps time, the launch from THERE made in time too: a
  // player lands on a Beat only when the next launch comes before it goes (the chain looked ahead, its answers kept)
  const airOf = (p) => { const ya = p.a ? p.a.y : p.b ? p.b.y : 0; return egJumpReach((p.b ? p.b.y : ya) - ya).air; };
  /** a piece where it stands at `u` - a slag crossing the spout's crust I stand on (`lane`), never the other's */
  const pieceAt = (q, u, lane = -1) => (q.kind === 'slag' && lane >= 0 ? { dx: egSlagX(q, lane) - q.x, dz: 0, solid: egSlagState(q, lane, u).st === 'crust' } : egPieceAt(q, u));
  const lzOf = (p, u, lane = -1) => (p.a ? p.a.z + pieceAt(p.a, u, lane).dz + p.a.d / 2 : p.edge);
  /** EG-SWEEP-RED: what I land on runs away from me as I come down on it (a Rail, a Drum on its travel) - its edge's catch is none */
  const recedes = (p, u) => { if (!p.b) return false; const T = u + airOf(p); return egPieceAt(p.b, T + 0.02).dz > egPieceAt(p.b, T).dz + 1e-6; };
  const lands = (p, u) => egJumpLands(p, u - HOLD_S) && egJumpLands(p, u) && egJumpLands(p, u + HOLD_S) && (!recedes(p, u) || egJumpLands(p, u, UNCAUGHT));
  const goneAt = (q, since, lane = -1) => {
    if (!q || !TIMED.has(q.kind)) return Infinity;
    if (EG_CRUMBLE_KINDS.includes(q.kind)) return since + EG_CRUMBLE_DELAY_S - 0.06;
    if (q.kind === 'sink') return since + 5;
    for (let u = since; u < since + EG_SOLVE_HORIZON_S; u += 0.02) if (!pieceAt(q, u, lane).solid) return u;
    return Infinity;
  };
  /** THE AIM of pair `pi` launched at `u`: where on my piece's far edge (its width, a Drop's doorway) and where on the
   *  landing (its width at the landing, an island's middle), the run's way and the flight's reach, and whether it is run off
   *  rather than jumped (a still step a short way down - `run` or `walk` its pace off the edge) */
  const aimOf = (pi, u, lane = -1) => {
    const p = pairs[pi], { a, b } = p, ay = p.a ? p.a.y : me().y, by = p.b ? p.b.y : ay, lz = lzOf(p, u, lane);   // still ground: the height I stand at
    const offs = [];
    if (b && by - ay < -0.3 && STILL.has(b.kind) && (!a || STILL.has(a.kind))) {
      const fall = Math.sqrt((2 * (ay - by)) / 20), gap = b.z - b.d / 2 - lz;
      for (const [name, v] of [['run', EG_SPAN_RUN_MPS], ['walk', walkSpeed(SWEEP_BUILD.speed)]]) { const d = v * fall + EDGE_M; if (d >= gap + 0.4 && d <= gap + b.d - 0.5) offs.push([name, fall, v]); }
    }
    const off = offs[0] ?? null, air = off ? off[1] : egJumpReach(by - ay).air, T = u + air;
    const bx = b ? b.x + egPieceAt(b, T).dx : (a ? a.x : 0);   // onto still ground: its line (an island is round - its edge nearest on its middle)
    let xl;
    if (!a) xl = clamp(bx, (b ? b.x : 0) - 1.0, (b ? b.x : 0) + 1.0);
    else { const o = pieceAt(a, u, lane), half = a.kind === 'drop' ? 0.75 : a.w / 2 - 0.3; xl = clamp(bx, a.x + o.dx - half, a.x + o.dx + half); }   // a Drop's landing is left by its far wall's doorway
    const xt = b ? clamp(xl, bx - b.w / 2 + SIDE_M, bx + b.w / 2 - SIDE_M) : xl;
    const flight = off ? off[2] * air : (EG_SPAN_RUN_MPS + 0.225) * air, yaw = Math.asin(clamp((xt - xl) / Math.max(0.5, flight), -0.85, 0.85));
    return { off: off ? off[0] : null, air, ay, by, lz, xl, xt, yaw, zLand: lz - EDGE_M + flight * Math.cos(yaw) };
  };
  /** A Pendulum over the gap: its weight clear of the flight's whole line, not its middle alone (the screen judges every
   *  frame of it) */
  const pendClear = (pi, u, lane = -1) => {
    const b = pairs[pi].b;
    if (b?.kind !== 'pend') return true;
    const A = aimOf(pi, u, lane);
    for (let k = 0; k <= 12; k++) { const f = k / 12; if (egPendHits(b, u + f * A.air, A.xl + (A.xt - A.xl) * f, b.y, A.lz - EDGE_M + (A.zLand - A.lz + EDGE_M) * f)) return false; }
    return true;
  };
  let ahead = new Map();
  /** how far the two tops overlap across the course for a launch at `u` (m - the more, the straighter the jump) */
  const overlap = (p, u, air, lane = -1) => {
    if (!p.a || !p.b) return 0;
    const oa = pieceAt(p.a, u, lane), ob = egPieceAt(p.b, u + air);
    return Math.min(p.a.x + oa.dx + p.a.w / 2, p.b.x + ob.dx + p.b.w / 2) - Math.max(p.a.x + oa.dx - p.a.w / 2, p.b.x + ob.dx - p.b.w / 2);
  };
  /** a launch of pair `pi` at `u` the pilot takes: it lands held either side, no gust in the flight, a Pendulum clear */
  const takes = (pi, u, lane = -1) => {
    const p = pairs[pi];
    return lands(p, u) && (turn || !gusty((p.b ?? p.a)?.road ?? 0, lzOf(p, u, lane), u - 0.2, u + airOf(p) + 0.1, (p.b ?? p.a)?.x ?? null)) && pendClear(pi, u - HOLD_S, lane) && pendClear(pi, u, lane) && pendClear(pi, u + HOLD_S, lane);   // (a turned course keeps no Gust)
  };
  /** the chain from pair `pi` launched at `u`: while what it lands on keeps time, the launch from THERE made in time too */
  const follows = (pi, u, depth = 0) => {
    const p = pairs[pi], nx = pairs[pi + 1];
    if (!(p.b && TIMED.has(p.b.kind) && nx && nx.a === p.b && depth < 8)) return true;
    const land = u + airOf(p), kb = p.b.kind === 'slag' ? egSlagLane(p.b, land) : -1, key = `${pi + 1}:${Math.round(land * 50)}`;
    if (!ahead.has(key)) ahead.set(key, launch(pi + 1, land + p.b.d / EG_SPAN_RUN_MPS + LATE_S, EG_CRUMBLE_KINDS.includes(p.b.kind) || p.b.kind === 'sink' ? land + LATE_S : land, depth + 1, kb) != null);
    return ahead.get(key);
  };
  const launch = (pi, ready, since, depth = 0, lane = -1) => {
    const p = pairs[pi], gone = goneAt(p.a, since, lane), air = airOf(p);
    let best = null, bestOv = -Infinity, first = null;
    for (let u = ready; u <= ready + EG_SOLVE_HORIZON_S && u + 0.05 < gone; u += 0.02) {
      if (first != null && u > first + WINDOW_LOOK_S) break;
      if (!takes(pi, u, lane)) continue;
      // EG-SWEEP-RED: the chain held for a launch HOLD_S late too, as the launch itself is held - a plan whose next launch had no
      // slack at all (the 500-seed sweep before world219's deploy: a Beat jumped onto 0.03 s late, a frame of the run-up's
      // own, and no launch off it before it went)
      if (!follows(pi, u, depth) || !follows(pi, u + HOLD_S, depth)) continue;
      // the window found: within its first WINDOW_LOOK_S, the moment the two tops line up best (a still pair: its first)
      first ??= u;
      const ov = overlap(p, u, air, lane);
      if (ov > bestOv + 0.02) { bestOv = ov; best = u; }
    }
    return best;
  };
  /** THE PLANNER'S CHAIN CROSSED from where I stand: `list`'s pairs in turn - null, or the failure. `routed` (THE ASCENT, LAW
   *  9): a span link's course, whose way to it and on from it are the route's own links (THE FORK's bridges among them). */
  const crossPairs = (list, routed = false) => {
    pairs = list; ahead = new Map(); standSince = t; standLane = -1;
    let again = false, replans = 0;   // a pair planned again (the pilot late to its run-up), and how often this course
    for (let pi = 0; pi < pairs.length; pi++) {
      const pair = pairs[pi], { a, b } = pair, at = b ? b.i : a ? `${a.i}>ground` : 'ground';
      // the Low Road's first launch: across the fork's bridge to its island first
      if (!again && !routed && road === 1 && spec.fork && (b ?? a)?.road === 1 && (pi === 0 || ((pairs[pi - 1].b ?? pairs[pi - 1].a)?.road ?? 0) === 0)) {
        // the fork's island's middle, then the bridge - AUDIT EG V (spec law 8): over the still ground's gaps (a passage on the way to
        // the fork leaves its far floor 2-2.6 m short of the island, as every passage leaves the island after it)
        const err = crossGround(spec.fork.x, spec.fork.z - 3) ?? walkTo(spec.fork.lowX, spec.fork.z - 3);
        if (err) return fail(at, `${err} on the fork's bridge`);
      }
      // a riser is run up (CLIMB3's wall run at skill 0 - the online page's parkour), never jumped onto
      if (a?.kind === 'riser' && m.groundKey !== egStepKey(h, a.i)) {
        const p = me();
        const err = walkTo(clamp(p.x, a.x - 0.6, a.x + 0.6), a.z - a.d / 2 - 1.4);
        if (err) return fail(a.i, `${err} before the riser`);
        let up = false;
        for (let k = 0; k < 4 * 60 && !up; k++) {
          const go = me().z >= a.z - a.d / 2 - 0.8;
          if (frame(still({ forward: 1, run: true, jump: go, up: go }), 0)) return fail(a.i, 'fell off the riser');
          up = m.grounded && m.groundKey === egStepKey(h, a.i);
        }
        if (!up) return fail(a.i, 'the riser was not run up');
        for (let k = 0; k < 8; k++) if (frame(still())) return fail(a.i, 'fell off the riser');
      }
      // on still ground, over it to the launch's edge first (its gaps leapt - THE BROKEN WAY: a turned bridge's near foot walked)
      if (!a) { const err = turn ? walkTo(b ? b.x : me().x, pair.edge - EDGE_M - RUNUP_M - 0.2) : crossGround(b ? b.x : me().x, pair.edge - EDGE_M - RUNUP_M - 0.2); if (err) return fail(at, `${err} on the way to the launch`); }
      // where the launch is: the far edge of what I stand on, wherever it is then - or the ground's edge
      const lane = a?.kind === 'slag' ? standLane : -1, lzAt = (u) => lzOf(pair, u, lane);
      const tau = launch(pi, t + Math.max(0, lzAt(t) - EDGE_M - me().z) / EG_SPAN_RUN_MPS + 0.03, standSince, 0, lane);
      if (tau == null) return fail(at, a && TIMED.has(a.kind) ? `no launch before the ${a.kind} under me goes` : 'no launch the solver allows in its horizon');
      const A = aimOf(pi, tau, lane), { xl, xt, yaw, zLand, off } = A, T = tau + A.air, ob = b ? egPieceAt(b, T) : null;
      // stand back from the edge on the aim's line (on my piece, moving with it), held there against a push until it is time
      // to run; then run at the landing (steered at it each frame), and jump at the edge - or, onto a step a short way down,
      // run off it as a player steps down a stair (a running jump would fly past it)
      const v = off === 'walk' ? walkSpeed(SWEEP_BUILD.speed) : EG_SPAN_RUN_MPS;
      const run = RUNUP_M, lz0 = A.lz, rel = a && a.kind !== 'slag' ? a : null, o0 = rel ? egPieceAt(rel, tau) : null;   // a crust stands still
      const rx = xl - run * Math.sin(yaw), rz = lz0 - EDGE_M - run * Math.cos(yaw), go0 = tau - run / v;
      const gx = rel ? rx - o0.dx : rx, gz = rel ? rz - o0.dz : rz;
      const err = walkTo(gx, gz, rel, go0);
      if (err) return fail(at, `${err} on the way to the launch`);
      while (t < go0) { const e2 = walkTo(gx, gz, rel, go0); if (e2) return fail(at, `${e2} while waiting`); if (t < go0 && frame(still())) return fail(at, 'fell while waiting'); }
      // two Rails' travels may meet across the gap: what slides under me on the way to the edge is stood on, not jumped past
      const onB = () => !!b && m.grounded && (m.groundKey === egStepKey(h, b.i) || !!m.groundKey?.startsWith(`${egStepKey(h, b.i)}:`));
      // a pilot late to its run-up (the sweep, a LAW 9 hall of band 3: started 0.5 m back, it jumped 0.32 m short of the edge
      // at its moment and fell) never jumps short of the edge, as a player would not: it runs on and jumps there while the
      // solver's launch from the edge still lands, and plans the pair again from where it stands once it no longer does
      let jumped = false, across = false, late = false;
      again = false;
      for (let k = 0; k < 90 && !jumped && !across; k++) {
        const p = me(), edge = p.z >= lzAt(t) - EDGE_M;
        if (!off && !edge && t >= tau + 0.03 && !lands(pair, t)) { late = true; break; }
        const go = !off && edge;
        if (frame(still({ forward: 1, run: off !== 'walk', jump: go, up: go }), Math.atan2(xt + (b ? egPieceAt(b, T).dx - ob.dx : 0) - p.x, zLand - p.z))) return fail(at, 'fell before the launch');
        jumped = go || (!!off && !m.grounded);
        across = !jumped && onB();
      }
      if (late) { if (++replans > REPLAN_MAX) return fail(at, 'late to every launch'); again = true; pi--; continue; }
      if (!jumped && !across) return fail(at, off ? 'never ran off the edge' : 'never reached the edge');
      // the flight, and the landing
      let landed = across;
      for (let k = 0; k < 6 * 60 && !landed; k++) {
        if (frame(still(), yaw)) return fail(at, 'fell (cast back)');
        if (!m.grounded && me().y < Math.min(A.ay, A.by) - 2.5) return fail(at, 'fell short');
        landed = m.grounded && !m.jumping;
      }
      if (!landed) return fail(at, 'never landed');
      const key = m.groundKey, want = b ? egStepKey(h, b.i) : EG_FLOOR_KEY;
      // a slag crossing's crust is its spout's lane; the hall's own ground at the step's height (a vault's side lane laid
      // across the gap before it) is landed on as a player would, and walked onto the step from
      const level = onGround(key) && b && me().y >= b.y - 0.3;
      if (b ? key !== want && !key?.startsWith(`${want}:`) && !level : !onGround(key)) return fail(at, `landed on ${key ?? 'nothing'}, not ${want}`);
      // landed on that ground short of a Crumble (a sinking flight): walked onto it, and its clock starts there - the screen
      // starts it the frame my foot first stands on it (scenes/eliteGates/egSpan.js ride, `touched`), never at a landing beside it
      // (the sweep, 500 seeds: a side lane across the gap before a course's last Crumble - the pilot's clock ran from the
      // lane, 0.05-0.12 s early, and no launch to the ground came before it went)
      const onStep = () => m.groundKey === want || !!m.groundKey?.startsWith(`${want}:`);
      if (level && !onStep() && (EG_CRUMBLE_KINDS.includes(b.kind) || b.kind === 'sink')) {
        for (let k = 0; k < 2 * 60 && !onStep() && me().z < b.z + b.d / 2 - RUNUP_M - 0.1; k++) {
          const p = me();
          if (frame(still({ forward: 1, run: true }), Math.atan2(b.x + egPieceAt(b, t).dx - p.x, b.z - p.z))) return fail(at, 'fell stepping onto the step');
        }
      }
      standSince = t;
      standLane = b?.kind === 'slag' ? Number(/:(\d+)$/.exec(key)?.[1] ?? -1) : -1;   // the spout whose crust I landed on
      if (t - t0 > (routed ? ROUTE_MAX_S : COURSE_MAX_S)) return fail(at, 'the course took too long');
    }
    return null;
  };
  /** THE ASCENT (LAW 9) - ON TO NODE `q` ALONG LEG `g` (a walk, a bridge, a stair up or down, a Drop run off, a span link's
   *  island): straight at it at the run, walked its last half metre - null there and standing, or why not (a fall under the
   *  leg's lower end; no nearer in 3 s) */
  const wayTo = (q, g) => {
    const low = Math.min(g.from[1], g.to[1]);
    let best = Infinity, since = t;
    for (let k = 0; k < 60 * 120; k++) {
      const p = me(), dx = q[0] - p.x, dz = q[2] - p.z, d = Math.sqrt(dx * dx + dz * dz);
      if (d < 0.3 && m.grounded && Math.abs(p.y - q[1]) < 1.2) return null;
      if (d < best - 0.02) { best = d; since = t; }
      if (t - since > 3) return `stuck ${d.toFixed(2)} m short of (${q.map((v) => v.toFixed(1)).join(', ')})`;
      if (frame(still({ forward: 1, run: d > 0.6 }), Math.atan2(dx, dz))) return 'fell (cast back)';
      if (!m.grounded && me().y < low - 2.5) return 'fell';
    }
    return 'stuck';
  };
  /** THE ASCENT (LAW 9) - UP CLIMB LEG `g` BY THE REAL CLIMBING MOTOR (player/parkour.js on the online page's lane, Climbing 0
   *  with fatigue spent - THE ROUTE'S PROOFS' own case, net/eliteGates/egRouteProof.js): to its foot, a whole grip first, then Forward
   *  held into its face - the free climb's start, the wall, the hang at the lip, the mantle - and on each rest ledge the grip
   *  waited back with the feet on its floor, then on; until it stands on the lip's floor, then on to the link's top. Null, or
   *  why not (a fall - the highest it reached and its grip; never up). */
  const climbUp = (g) => {
    const c = g.climb;
    if (!c) return 'a climb with no face';
    const err = wayTo(g.from, g);
    if (err) return `${err} on the way to the climb's foot`;
    const yaw = Math.atan2(-c.face[0], -c.face[1]);   // into the face
    for (let k = 0; k < 60 * 5 && m.grip < 1; k++) if (frame(still(), yaw)) return 'fell at the climb\'s foot';
    skills = CLIMB0;
    const foot = me().y;
    let high = foot, up = false, why = '';
    for (let k = 0; k < 60 * 90 && !up && !why; k++) {
      const rest = m.grounded && m.grip < 1 && me().y > foot + 0.3;
      if (frame(still({ forward: rest ? 0 : 1 }), yaw)) why = 'fell off the climb (cast back)';
      const p = me();
      if (m.grounded && p.y < high - 1) why = `fell off the climb ${(high - foot).toFixed(2)} m up (its grip ${m.grip.toFixed(2)})`;
      high = Math.max(high, p.y);
      up = m.grounded && p.y >= c.y1 - 0.1;
    }
    skills = SKILL0;
    if (why) return why;
    if (!up) return `never stood on the climb's lip (${(high - foot).toFixed(2)} m up)`;
    return wayTo(g.to, g);
  };
  /** THE ASCENT (LAW 9): the heights the way being crossed stands at - span leg `g`'s ends and its course's rise either side
   *  (null: every floor). */
  const wayOf = (g) => { wayYs = g ? [Math.min(g.from[1], g.to[1]) - EG_ROUTE_COURSE_RISE_M, Math.max(g.from[1], g.to[1]) + EG_ROUTE_COURSE_RISE_M] : null; };
  return { m, me, frame, walkTo, crossGround, crossPairs, wayTo, climbUp, wayOf, fail, get t() { return t; }, turnTo: (/** @type {number} */ hd) => { turn = hd; },
    done: () => ({ ok: true, seed: S.seed, h, road, step: null, why: '', t: t - t0 }) };
}

/**
 * ONE COURSE CROSSED BY THE REAL MOTOR: hall `spec`'s road `road`, from the arrival plate at shared second `t0`, pair by
 * pair, to the end plate (a Court's: onto its lord's ground). `{ ok, seed, h, road, step, why, t }` - `step` the step the
 * crossing failed at (its number in the hall, or `ground`), `t` the crossing's seconds. `trace` hears every frame (a hook
 * for following one crossing): the clock, where I stand (the hall's frame), whether grounded and on what, the input. THE
 * ASCENT (LAW 9): a routed hall's road is walked along its route (sweepRoute).
 * @param {ReturnType<typeof sweepStand>} S @param {any} spec @param {number} road @param {number} t0
 */
export function sweepCourse(S, spec, road, t0, trace = null) {
  if (egRouted(spec)) return sweepRoute(S, spec, road, t0, trace);
  const P = pilotOf(S, spec, road, t0, trace), { m, walkTo, crossGround, fail } = P;
  // settle on the plate
  for (let k = 0; k < 20; k++) if (P.frame(still())) return fail('ground', 'fell from the arrival plate');
  const crossed = P.crossPairs(sweepPath(spec, road));
  if (crossed) return crossed;
  // on to the goal: the end plate (the Low Road's bridge first), a Court's ground past its approach
  if (spec.end) {
    const lane = road === 1 && spec.fork ? spec.lanes.find((l) => l.role === 'bridge' && Math.abs(l.ax - spec.fork.lowX) < 0.01 && Math.abs(l.bz - spec.fork.plate) < 0.01) : null;
    if (lane) { const err = walkTo(lane.ax, lane.az + 1); if (err) return fail('ground', `${err} onto the Low Road's bridge`); const e2 = walkTo(lane.ax + 0.9 * (lane.bx - lane.ax), lane.az + 0.9 * (lane.bz - lane.az)); if (e2) return fail('ground', `${e2} on the Low Road's bridge`); }
    // onto the plate before its door (the door's posts stand across its middle)
    const err = lane ? walkTo(spec.end.x, spec.end.z - 1.5) : crossGround(spec.end.x, spec.end.z - 1.5);
    if (err) return fail('ground', `${err} on the way to the end plate`);
    if (m.groundKey !== EG_FLOOR_KEY) return fail('ground', 'not standing on the end plate');
  }
  return P.done();
}

/**
 * THE ASCENT (LAW 9; bible/11-Multiplayer/Elite-Gates-Ascent.md section 6) - ONE ROAD WALKED ALONG THE ROUTE BY THE REAL
 * MOTOR: hall `spec`'s road `road` (0 the main way, 1 THE FORK's other) from the arrival plate at shared second `t0`, link by
 * link along its path (net/eliteGates/egSpanLaw.js egRouteSolved) - turning onto each, running its walks and bridges, taking its stairs
 * up and down, running off its Drops, CLIMBING its climbs with the real climbing motor (climbUp - Climbing 0, fatigue spent,
 * a rest on each ledge), and crossing each span link's course pair by pair as THE PLANNER crosses a course (crossPairs) -
 * to the door, standing on the end plate. `{ ok, seed, h, road, step, why, t }` - `step` the link it failed on (`link <i>
 * (<kind>)`, or a course's step), `t` the road's seconds.
 * @param {ReturnType<typeof sweepStand>} S @param {any} spec @param {number} road @param {number} t0
 */
export function sweepRoute(S, spec, road, t0, trace = null) {
  const P = pilotOf(S, spec, road, t0, trace), { fail } = P;
  for (let k = 0; k < 20; k++) if (P.frame(still())) return fail('ground', 'fell from the arrival plate');
  for (const L of egRouteSolved(spec, road)) {
    const g = L.g;
    let why = null;
    if (g.kind === 'climb') why = P.climbUp(g);
    else if (L.pairs.length) {
      P.wayOf(g);
      P.turnTo(L.g.steps[0]?.hd ?? 0);   // THE BROKEN WAY: a turned course crossed in its heading's frame
      const crossed = P.crossPairs(L.pairs, true);
      P.turnTo(0);
      P.wayOf(null);
      if (crossed) return crossed;
      why = P.wayTo(g.to, g);
    } else why = P.wayTo(g.to, g);
    if (why) return fail(`link ${g.i} (${g.kind})`, why);
    if (P.t - t0 > ROUTE_MAX_S) return fail(`link ${g.i} (${g.kind})`, 'the way took too long');
  }
  // the door: standing on the end plate
  const e = spec.end, p = P.me();
  if (e && (P.m.groundKey !== EG_FLOOR_KEY || Math.hypot(p.x - e.x, p.z - e.z) > e.r || Math.abs(p.y - (e.y ?? 0)) > 1)) return fail('ground', 'not standing on the end plate');
  return P.done();
}

/**
 * THE SWEEP of one seed's circle in `band`: every course (each hall's every road) crossed by the real motor. Answers each
 * crossing's result.
 */
export function sweepSeed(seed, band) {
  const { c, geo } = sweepCircleOf(seed, band), S = sweepStand(seed, c, geo), out = [];
  let k = 0;
  for (const spec of S.specs) for (const road of [0, 1]) {
    // THE ASCENT (LAW 9): a routed hall's every proven road, walked along its route; the laws before, each course laid
    if (egRouted(spec)) { if (!egRouteRoads(spec).includes(road)) continue; } else {
      const course = egCourseOf(spec, road);
      if (!course || !course.steps.length) continue;
    }
    const t0 = 1_800_000_000 + (seed % 36) + 0.37 + 200 * k++;
    out.push({ c, geo, t0, ...sweepCourse(S, spec, road, t0) });
  }
  S.span.clear();
  return out;
}

/**
 * THE ASCENT (LAW 9) - THE SWEEP OF ONE SEED'S SYNTHETIC LAW 9 CIRCLE in `band` (tools/lib/egLaw9Synth.mjs - its five halls
 * given as the relay gives a hall, so the collider, the screen's pieces and the pilot all build them): every road the route
 * proves walked by the real motor (sweepSeed), the given halls forgotten after. For the sweep before THE ROOMS lays LAW 9's
 * own halls - once it does, the plain sweep walks them (the circle's halls are THE ASCENT's law).
 */
export function sweepSynth9(seed, band) {
  const { c, geo } = sweepCircleOf(seed, band);
  egSynth9Give(seed, c, geo, band);
  try { return sweepSeed(seed, band); } finally { egSpecForget(); }
}

/** The sweep's seeds: `n` from `from`, the law pin's beside them when asked. */
export const sweepSeeds = (n, from = 1, golden = false) => [...new Set([...Array.from({ length: n }, (_, i) => from + i), ...(golden ? SWEEP_GOLDEN : [])])];

/** SWEEP-FAST: `p/k` -> {p, k} (1 <= p <= k), or null. */
export function sweepPartOf(s) {
  const m = /^(\d+)\/(\d+)$/.exec(String(s ?? ''));
  if (!m) return null;
  const p = Number(m[1]), k = Number(m[2]);
  return k >= 1 && p >= 1 && p <= k ? { p, k } : null;
}
/** SWEEP-FAST: the p-th of k parts of `seeds` - every k-th seed from its p-th, so each part's circles are the band's
 *  mix (a seed's circle is its fifth) and every seed is in exactly one part. */
export const sweepPart = (seeds, p, k) => seeds.filter((_, i) => i % k === p - 1);

/** THE SOLVER'S READING of a hall: each road's pairs and their windows, its proof, its crossings, its bound. */
export function solveReport(seed, hall, geo = 0) {
  const spec = egHallOf(seed, hall, geo), lines = [];
  lines.push(`seed ${seed} hall ${hall} (${spec.kind}${spec.variant ? ` ${spec.variant}` : ''}, band ${spec.band}, circle ${spec.c}, ground ${geo}) - ${spec.steps.length} steps, laid again ${spec.laid} time(s)`);
  const proof = egSpanProof(spec);
  lines.push(`  proof: ${proof.ok ? 'proven' : `REFUSED - ${proof.why.join('; ')}`}`);
  if (egRouted(spec)) return [...lines, ...routeReport(spec)];   // THE ASCENT: a routed hall read along its route
  for (const road of [0, 1]) {
    const course = egCourseOf(spec, road);
    if (!course) continue;
    lines.push(`  road ${road}: ${course.steps.length} steps, ${course.checkpoints.length} checkpoints, end at ${course.end.toFixed(2)} m`);
    for (const pair of sweepPath(spec, road)) {
      const w = egPairWindows(pair), name = `${pair.a ? `${pair.a.i} ${pair.a.kind}` : 'ground'} > ${pair.b ? `${pair.b.i} ${pair.b.kind}` : 'ground'}`;
      lines.push(`    ${name.padEnd(28)} open ${w.open.toFixed(2)} s of ${EG_SOLVE_HORIZON_S}, least in 12 s ${w.worst12.toFixed(2)}, longest wait ${w.wait.toFixed(2)}`);
    }
    const c = egRoadCross(spec, road);
    lines.push(`    the span build: fastest ${c.fast.toFixed(2)} s, median ${c.median.toFixed(2)} s`);
    if (spec.end) lines.push(`    the fast build: ${egFastCross(spec, road).toFixed(2)} s - EG_CROSS_MIN ${egCrossMin(spec, road)} ms`);
  }
  return lines;
}

/** THE ASCENT (LAW 9) - THE SOLVER'S READING OF A ROUTED HALL: each proven road along its route - every link's kind and its
 *  seconds unwaited at THE SPAN BUILD (a climb's pitches and their walls against the grip; a span link's pairs and their
 *  windows), the road's crossing at THE SPAN BUILD (fastest, median - THE MEDIAN's) and at THE FAST BUILD, and its bound. */
export function routeReport(spec) {
  const lines = [];
  for (const road of egRouteRoads(spec)) {
    lines.push(`  road ${road} along the route: ${egRouteLen(spec, road).toFixed(1)} m, plate to door`);
    for (const L of egRouteSolved(spec, road)) {
      const g = L.g, at = `    link ${String(g.i).padStart(2)} ${g.kind.padEnd(6)} ${g.len.toFixed(1).padStart(5)} m, ${g.rise >= 0 ? '+' : ''}${g.rise.toFixed(1)} m: ${L.span.toFixed(2)} s`;
      if (g.kind === 'climb') lines.push(`${at} - pitches ${(g.climb ? egClimbPitches(g.climb) : []).map((H) => `${H.toFixed(2)} m (${egPitchWallS(H).toFixed(2)} s on the wall)`).join(', ') || 'none: no face'}`);
      else lines.push(L.pairs.length ? `${at} + its ${L.pairs.length} pairs' waits` : at);
      for (const pair of L.pairs) {
        const w = egPairWindows(pair), name = `${pair.a ? `${pair.a.i} ${pair.a.kind}` : 'ground'} > ${pair.b ? `${pair.b.i} ${pair.b.kind}` : 'ground'}`;
        lines.push(`      ${name.padEnd(26)} open ${w.open.toFixed(2)} s of ${EG_SOLVE_HORIZON_S}, least in 12 s ${w.worst12.toFixed(2)}, longest wait ${w.wait.toFixed(2)}`);
      }
    }
    const c = egRouteCross(spec, road);
    lines.push(`    the span build: fastest ${c.fast.toFixed(2)} s, median ${c.median.toFixed(2)} s (${(c.median / c.fast).toFixed(2)} x)`);
    if (spec.end) lines.push(`    the fast build: ${egFastCross(spec, road).toFixed(2)} s - EG_CROSS_MIN ${egCrossMin(spec, road)} ms`);
  }
  return lines;
}

/**
 * THE SWEEP RUN: every seed's circle of every band asked, each course crossed (`sweep` - sweepSeed), each one not crossed
 * said by its seed, hall, road and step, each band's count and time said. Answers `{ bad, n }`.
 */
export function runSweep(bands, seeds, sweep = sweepSeed, log = console.log) {
  let bad = 0, n = 0;
  for (const band of bands) {
    const t0 = performance.now();
    let courses = 0;
    for (const seed of seeds) {
      for (const r of sweep(seed, band)) {
        courses++; n++;
        if (!r.ok) { bad++; log(`FAIL seed ${r.seed} hall ${r.h} road ${r.road} step ${r.step} (circle ${r.c}, ground ${r.geo}, from ${r.t0}): ${r.why}`); }
      }
    }
    log(`band ${band}: ${seeds.length} seeds, ${courses} courses crossed by the real motor in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  }
  log(bad ? `${bad} of ${n} courses NOT crossed` : `every one of ${n} courses crossed`);
  return { bad, n };
}

export function main(argv, log = console.log, sweep = sweepSeed) {
  const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
  const law9 = argv.includes('--law9');   // THE ASCENT: the synthetic LAW 9 halls (tools/lib/egLaw9Synth.mjs), given
  if (!argv.includes('--sweep')) {
    const [seed, hall, geo] = argv.filter((x, i) => !x.startsWith('--') && argv[i - 1] !== '--band').map(Number);
    if (!Number.isSafeInteger(seed) || !Number.isSafeInteger(hall) || hall < 1) { log('usage: node tools/egSpanSolve.mjs <seed> <hall> [geo] [--law9 [--band 0-3]] | --sweep [--band 0-3] [--seeds n] [--from seed] [--golden] [--part p/k] [--law9]'); return 2; }
    if (law9) egSynth9Give(seed, Math.ceil(hall / 5), geo || 0, Number(arg('--band', 0)));
    try { for (const l of solveReport(seed, hall, geo || 0)) log(l); } finally { if (law9) egSpecForget(); }
    return 0;
  }
  const bands = argv.includes('--band') ? [Number(arg('--band'))] : [0, 1, 2, 3];
  if (!bands.every((b) => [0, 1, 2, 3].includes(b))) { log('--band is 0, 1, 2 or 3'); return 2; }
  const part = argv.includes('--part') ? sweepPartOf(arg('--part')) : { p: 1, k: 1 };
  if (!part) { log('--part is p/k, 1 <= p <= k'); return 2; }
  const all = sweepSeeds(Number(arg('--seeds', 25)), Number(arg('--from', 1)), argv.includes('--golden'));
  const seeds = sweepPart(all, part.p, part.k);
  if (part.k > 1) log(`part ${part.p}/${part.k}: ${seeds.length} of the ${all.length} seeds`);
  const { bad } = runSweep(bands, seeds, law9 && sweep === sweepSeed ? sweepSynth9 : sweep, log);
  return bad ? 1 : 0;
}

if (isMain(import.meta.url)) process.exitCode = main(process.argv.slice(2));
