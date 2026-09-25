// TRAVEL-NAV1 (2026-09-25, Mac: "Improving travel options navigation to
// properly route around objects and stopping before running into
// buildings. Currently it could be so much better") - THE WALK GOES ROUND,
// AND STOPS SHORT.
//
// The autopilot (systems/travelAutopilot.js, PlayerAutoPilot.cs) answers
// ONE bearing - to the centre of the target rect, latched at every map
// pixel crossed - and the mod pushes the body along it at up to a hundred
// times walking pace. It has no idea anything stands in the way: a house,
// a city wall, a well or a World of Daggerfall boulder on the line is
// walked into, and the body grinds against it with the clock racing until
// the player notices. Daggerfall Unity's CharacterController slides along
// the face, so the mod's own journeys do the same; this port's collider is
// that controller's contract, so ours did too.
//
// This module is the port's own answer, and it sits BETWEEN the autopilot
// and the motor: the mod still decides where the journey is going and when
// it has arrived; this decides only how the body gets there this frame.
// It is CONTEXT STEERING over a fan of headings, each a CORRIDOR of three
// feelers as wide as the body, cast through the same collider the motor
// resolves against (createColliderProbe below):
//
//   ROUTE AROUND. While the way wanted is open the mod's own bearing is
//   returned untouched - a journey with nothing in its way is the mod's
//   journey to the last bit. When it closes, a DETOUR begins: the fan is
//   laid out from the way wanted AS IT WAS when the detour began (a fan
//   that turned with a pursuit point would swing the body back into the
//   wall it is walking round), a side is chosen - the nearer edge, found
//   by trying both sides a step at a time, or the last detour's side for
//   COMMIT metres, so a row of trunks is passed on one side and not
//   threaded left-right-left - and each frame the steering tries ONE
//   offset closer, keeps the one it holds while that still has room, and
//   only then scans outward. Opening needs the whole look-ahead, keeping
//   only room for the frame (half its reach, and never less than a step
//   past the stand-off) - that gap is the hysteresis that stops a heading
//   flip-flopping at a corner - and a detour that runs out of offsets on
//   its side tries the other side once.
//
//   THE POCKET. A heading that closes on the line's direction must be seen
//   clear PAST the face that blocked it (`past`, the Bug2 leave rule), and
//   a detour ends only when the way wanted is seen past it or the body is
//   past it: inside a U the way wanted is open for the depth of the U and
//   no further, so the walk backs out and goes round the arm instead of
//   re-entering the pocket every few frames.
//
//   BACK TO THE LINE. A detour leaves the body beside the mod's line, and
//   the mod does not know: its bearing is latched until the next pixel,
//   so the walk would run parallel to the road it was following. The line
//   is kept here (where the leg began, to the target's centre), and until
//   the body is back on it the way wanted is a PURSUIT point along it.
//
//   STOP SHORT. Every frame's forward force is capped so the frame cannot
//   carry the body past STANDOFF short of what the chosen corridor saw -
//   at x100 a hitching frame moves a horse a hundred metres, so the reach
//   is the frame's (travelFrameReach) and the feelers are cast that far.
//   When no heading on either side has room, or a detour has walked
//   DETOUR_BUDGET metres without getting past its obstacle, the journey
//   stops with the mod's own kind of message (travelOptionsText.js
//   TRAVEL_NAV_TEXT) - before contact, never after. And if the body stops
//   moving while the drive asks it to (something the feelers cannot see:
//   a sill under the knee, a post between two feelers), GRINDING is
//   measured against what the host really applied and stops it too.
//
// CHEAP. Three feelers a frame on an open road; a detour's frame is
// usually five (the way wanted's centre, one closer offset, the held
// corridor); and no frame casts more than MAX_FEELERS - a scan that would
// is resumed next frame with the body held for the one it waits.
//
// PURE, like the autopilot: it takes numbers and a probe function and
// answers numbers. No collider, no DOM, no world reads - which is what lets
// test/travelnav.test.js fly it over buildings, walls, pockets, rows of
// trees and gaps on a table. EVERY ALLOCATION HAS AN OWNER: the input,
// the output, the frame's scratch and the probe's own are made once, with
// the steer, and reused every frame.

import { rectDistance } from './travelAutopilot.js';
import { FIXED_DT, MAX_FRAME_DT, STEP_OFFSET, SLOPE_LIMIT_DEG } from '../player/motor.js';

const DEG = Math.PI / 180;
/** The fan's index for its own zero - the way the detour began. */
const REF = -1;
/** No fan heading held. */
const NONE = -2;

/** The steering's constants, in metres (scene units) and degrees. */
export const TRAVEL_STEER = Object.freeze({
  /** Half the corridor: the capsule's 0.35 (motor.js CAPSULE_RADIUS) and a
   *  hand's breadth. Two edge feelers ride this far either side of the
   *  centre one, so a corridor is 0.9 wide and a gap of 1.0 is passed. */
  body: 0.45,
  /** Nothing ahead is let closer than this, measured along the heading. */
  standoff: 1.0,
  /** A heading that leaves less than this past the stand-off is no way. */
  minStep: 0.5,
  /** The early-warning horizon at a stroll... */
  minLook: 8,
  /** ...and at speed, this many frames' reach. */
  lookFrames: 2,
  /** The fan's feelers reach no further than this (the way wanted and the
   *  held heading are still probed to the frame's whole reach). */
  feelerMax: 24,
  /** How far `past` may ask a feeler to see beyond a blocking face. A
   *  pocket deeper than this is a courtyard, and the budget ends it. */
  pastCap: 64,
  /** How far beyond the blocking face counts as past it. */
  exitMargin: 2,
  /** The rejoin aims this far along the line ahead of the body. */
  pursuit: 8,
  /** Within this of the line the mod's own bearing is the heading. */
  onLine: 0.25,
  /** The fan, either side of the reference. Fine near zero, so a gap
   *  barely wider than the corridor is found from close by; out to
   *  straight back, so a dead end is backed out of. */
  offsets: Object.freeze([5, 10, 20, 30, 45, 60, 75, 90, 105, 120, 150, 180]),
  /** A detour's side is sought over this many offsets each way. */
  sideSpan: 5,
  /** No frame casts more feelers than this. */
  maxFeelers: 16,
  /** Metres a detour may walk without getting past its obstacle. */
  detourBudget: 200,
  /** Metres a side is kept after a detour ends. */
  commitMetres: 40,
  /** A grinding window closes after this much asked-for travel... */
  grindWindow: 6,
  /** ...or this many motor steps' worth, whichever is longer... */
  grindSteps: 3,
  /** ...and grinds when the body moved less than this share of it... */
  grindRatio: 0.25,
  /** ...this many windows running. */
  grindWindows: 3,
});

/** How far the motor can carry the body THIS frame at a forward force of
 *  one: `speed * min(dt, maxFrameDt) * scale` is the frame (motor.js
 *  update, Unity's maximumDeltaTime applied before the scale), and one
 *  more fixed step rides on top because the accumulator can hold up to a
 *  step's worth from the last frame. That is a BOUND, not an estimate -
 *  the feelers must cover it, or a hitching frame at x100 walks through
 *  what they did not reach. Positional, so the per-frame call makes no
 *  object. */
export function travelFrameReach(speed, dt, scale, maxFrameDt = MAX_FRAME_DT, fixedDt = FIXED_DT) {
  return Math.max(0, speed) * Math.max(0, scale) * (Math.min(Math.max(0, dt), maxFrameDt) + fixedDt);
}

/** The steering, one per host. `params` defaults to TRAVEL_STEER. */
export function createTravelSteer(params = TRAVEL_STEER) {
  const P = params;
  const N = P.offsets.length;
  const s = {
    key: null,              // the autopilot the line belongs to - a new one is a new journey
    tx: NaN, tz: NaN,       // the target's centre the line runs to - a new one is a new leg
    ox: 0, oz: 0,           // where the line begins
    hasLast: false, lastX: 0, lastZ: 0, lastYaw: 0,
    episode: false,         // a detour is running
    ref: 0,                 // the way wanted when it began: the fan's zero
    side: 0,                // +1 right (yaw increasing), -1 left, 0 still being chosen
    sideK: 0,               // how far the side search has got
    k: NONE,                // the fan offset held: REF, an index, or NONE
    scanNext: -1,           // an outward scan to resume from, or -1
    scanBest: -1, scanBestC: 0,
    flipped: false,         // this detour has already tried the other side
    sBlock: 0,              // where on the line the blocking face stood
    sStart: 0,              // where on the line the detour began
    walked: 0,              // metres walked since
    commitSide: 0, commitLeft: 0,
    winAsked: 0, winMoved: 0, grind: 0,
    probes: 0,              // feelers cast this frame
    episodes: 0, flips: 0, holds: 0,   // counted, for the pins
  };
  /** The caller-owned shapes, made once (steerDrive fills `input`). */
  const input = { key: null, x: 0, z: 0, tx: 0, tz: 0, yaw: 0, goal: Infinity, reach: 0, quantum: 0, asked: 0 };
  const output = { yaw: 0, forward: 1, stop: null, deflected: false };
  /** This frame's reading of the line - scratch, so the helpers below are
   *  made once rather than closed over afresh every frame. */
  const f = { probe: null, want: 0, ux: 0, uz: 1, along: 0, lat: 0, reachFan: 0 };

  function endEpisode() {
    s.episode = false; s.k = NONE; s.side = 0; s.scanNext = -1;
  }

  function reset() {
    s.key = null; s.tx = NaN; s.tz = NaN; s.hasLast = false;
    endEpisode(); s.flipped = false; s.walked = 0;
    s.commitSide = 0; s.commitLeft = 0;
    s.winAsked = 0; s.winMoved = 0; s.grind = 0;
  }

  /** One feeler, counted, clamped to `dist`. */
  function feel(h, lateral, dist) {
    s.probes++;
    const c = f.probe(Math.sin(h), Math.cos(h), lateral, dist);
    return c < dist ? c : dist;
  }

  /** A corridor: the centre feeler, then the two edges, out to `dist`.
   *  Below `cut` it answers at once (a rejected heading costs one feeler);
   *  at or above it the answer is the exact least of the three. */
  function corridor(h, dist, cut) {
    let c = feel(h, 0, dist);
    if (c < cut) return c;
    const l = feel(h, -P.body, dist);
    if (l < c) c = l;
    if (c < cut) return c;
    const r = feel(h, P.body, dist);
    return r < c ? r : c;
  }

  /** The pocket rule: how far a heading must run clear to carry the body
   *  past the face that blocked it. Nothing outside a detour and nothing
   *  once the body is past; for a heading that does not close on the
   *  line's direction, nothing in the fan (walking along the face is how
   *  a detour goes round) and no end to it for LEAVING (going sideways
   *  never sees past anything). */
  function past(h, leaving) {
    if (!s.episode) return 0;
    const left = s.sBlock + P.exitMargin - f.along;
    if (left <= 0) return 0;
    const fwd = Math.sin(h) * f.ux + Math.cos(h) * f.uz;
    if (fwd <= 0.05) return leaving ? Infinity : 0;
    const d = left / fwd;
    // a detour ends only on a view that really reaches past - a heading
    // so shallow that the cap would stand in for it has seen nothing
    if (d > P.pastCap) return leaving ? Infinity : P.pastCap;
    return d;
  }

  /** The fan's heading at offset `k` on `side` from the detour's zero;
   *  REF (-1) is the zero itself - the way the detour began. */
  function headingAt(k, side = s.side) {
    return k === REF ? s.ref : s.ref + side * P.offsets[k] * DEG;
  }

  /** The fan's heading `k` on `side`: its corridor's clearance when it is
   *  OPEN - clear to the fan's reach and past the blocking face - and -1
   *  when it is not (at the cost of one feeler, usually). */
  function openAt(k, side) {
    const h = headingAt(k, side);
    const req = Math.max(f.reachFan, past(h, false));
    const c = corridor(h, req, req);
    return c >= req ? c : -1;
  }

  function go(out, inp, heading, clear, reach) {
    out.forward = reach > 0 ? Math.max(0, Math.min(1, (clear - P.standoff) / reach)) : 1;
    out.yaw = heading;
    out.deflected = heading !== inp.yaw;
    s.lastYaw = heading;
    return out;
  }

  /** A frame the body waits out - a scan changing hands, or one resumed. */
  function hold(out, inp) {
    s.holds++;
    out.forward = 0;
    out.yaw = s.lastYaw;
    out.deflected = out.yaw !== inp.yaw;
    return out;
  }

  function stopWith(out, inp, why) {
    out.stop = why;
    out.yaw = inp.yaw;          // the journey ends facing the mod's own bearing, as InterruptTravel leaves it
    out.forward = 0;            // and the frame that stops it moves nothing
    out.deflected = false;
    endEpisode();
    return out;
  }

  /** One frame. `inp`: { key, x, z, tx, tz, yaw, goal, reach, quantum,
   *  asked } - metres and radians, `x`/`z` in a frame that does not move
   *  under the body (steerDrive hands the world's own coordinates, so no
   *  floating-origin shift can reach here). `probe(dirX, dirZ, lateral,
   *  maxDist)` answers how far the feeler starting `lateral` metres to the
   *  right of the body runs clear along (dirX, dirZ) - `maxDist` or more
   *  when nothing is there. Writes `out` and returns it. */
  function step(inp, probe, out = output) {
    out.stop = null;
    out.deflected = false;
    s.probes = 0;
    f.probe = probe;
    if (inp.key !== s.key) { reset(); s.key = inp.key; s.lastYaw = inp.yaw; }
    if (inp.tx !== s.tx || inp.tz !== s.tz) {
      s.tx = inp.tx; s.tz = inp.tz; s.ox = inp.x; s.oz = inp.z;
      endEpisode();
    }

    // 1. WHAT THE LAST FRAME DID. `asked` is the travel the host really
    // applied last frame (after its own ground gate), so a drive held for
    // the streamer is not read as a body that will not move.
    if (s.hasLast) {
      const moved = Math.hypot(inp.x - s.lastX, inp.z - s.lastZ);
      if (s.episode) s.walked += moved;
      s.commitLeft -= moved;
      s.winAsked += inp.asked;
      s.winMoved += moved;
      if (s.winAsked >= Math.max(P.grindWindow, P.grindSteps * inp.quantum)) {
        s.grind = s.winMoved < P.grindRatio * s.winAsked ? s.grind + 1 : 0;
        s.winAsked = 0; s.winMoved = 0;
      }
    }
    s.hasLast = true; s.lastX = inp.x; s.lastZ = inp.z;
    if (s.grind >= P.grindWindows) return stopWith(out, inp, 'stuck');

    // 2. THE LINE. From where the leg began to the target's centre; the
    // progress along it and the signed distance off it (right positive).
    const lx = s.tx - s.ox, lz = s.tz - s.oz;
    const len = Math.hypot(lx, lz);
    f.ux = len > 1e-6 ? lx / len : Math.sin(inp.yaw);
    f.uz = len > 1e-6 ? lz / len : Math.cos(inp.yaw);
    const rx = inp.x - s.ox, rz = inp.z - s.oz;
    f.along = rx * f.ux + rz * f.uz;
    f.lat = rx * f.uz - rz * f.ux;

    // 3. THE WAY WANTED. On the line with no detour running: the mod's own
    // bearing, exactly. Otherwise the pursuit point PURSUIT ahead on it.
    f.want = inp.yaw;
    if (s.episode || Math.abs(f.lat) > P.onLine) {
      const ahead = len > 1e-6 ? Math.min(len, f.along + P.pursuit) : f.along + P.pursuit;
      const ax = s.ox + f.ux * ahead - inp.x, az = s.oz + f.uz * ahead - inp.z;
      if (ax * ax + az * az > 1e-8) f.want = Math.atan2(ax, az);
    }

    // 4. THE HORIZONS. `need` is what the frame's own travel asks for;
    // `look` the early warning, never past the arrival rect (a town's
    // walls behind its arrival buffer are no reason to turn away from it);
    // `reachFan` the fan's; `keep` what a held heading must still have.
    const reach = Math.max(0, inp.reach);
    const need = reach + P.standoff;
    const look = Math.max(P.minLook, P.lookFrames * reach) + P.standoff;
    const lookWant = Math.min(look, Math.max(0, inp.goal) + P.standoff);
    f.reachFan = Math.min(look, P.feelerMax);
    const pass = P.standoff + P.minStep;
    const keep = Math.max(pass, 0.5 * Math.min(need, f.reachFan));

    // 5. THE WAY WANTED, OPEN? Probed to the frame's whole reach, judged
    // against the look-ahead - and, in a detour, against `past`: a detour
    // ends when the way wanted is seen beyond what blocked it. Never less
    // than a step past the stand-off: a way that leaves no room is not
    // open however near the goal is, or the body would park at the
    // stand-off with the clock racing and nothing to say why.
    const leaveNeed = past(f.want, true);
    if (leaveNeed !== Infinity) {
      const openWant = Math.max(lookWant, leaveNeed, pass);
      const cw = corridor(f.want, Math.max(openWant, need), openWant);
      if (cw >= openWant) {
        if (s.episode) { s.commitSide = s.side || s.commitSide; s.commitLeft = P.commitMetres; endEpisode(); }
        return go(out, inp, f.want, cw, reach);
      }
      if (!s.episode) {
        s.episode = true; s.episodes++;
        s.walked = 0; s.sStart = f.along; s.flipped = false;
        s.ref = f.want; s.k = NONE; s.scanNext = -1;
        s.sBlock = f.along + cw * Math.max(0, Math.sin(f.want) * f.ux + Math.cos(f.want) * f.uz);
        if (s.commitLeft > 0 && s.commitSide) { s.side = s.commitSide; s.scanNext = 0; s.scanBest = -1; s.scanBestC = 0; }
        else { s.side = 0; s.sideK = 0; }
      }
    }

    // 6. THE SIDE, if the detour has none yet: both sides a step at a
    // time, the first open offset wins its side (a tie turns back toward
    // the line, and a tie on the line turns right - a rule, so a replay
    // walks the same way). Neither within SIDE_SPAN: the outward scan
    // takes the right from there, and the flip the left.
    let chosen = NONE, cc = 0;
    if (s.side === 0) {
      for (; s.sideK < Math.min(P.sideSpan, N); s.sideK++) {
        if (s.probes + 6 > P.maxFeelers) return hold(out, inp);
        const r = openAt(s.sideK, 1), l = openAt(s.sideK, -1);
        if (r >= 0 || l >= 0) {
          s.side = r >= 0 && l >= 0 ? (f.lat > P.onLine ? -1 : 1) : (r >= 0 ? 1 : -1);
          chosen = s.sideK; cc = s.side > 0 ? r : l;
          break;
        }
      }
      if (s.side === 0) { s.side = 1; s.scanNext = s.sideK; s.scanBest = -1; s.scanBestC = 0; }
      s.k = NONE;
    }

    // 7. THE FAN. First the way the detour began (REF), seen past the
    // face: it is how a gap is found as the body passes in front of it,
    // and how a corner is turned. Then one offset closer, then the one
    // held, and only then outward.
    if (chosen === NONE && s.scanNext < 0) {
      if (s.k !== REF) {
        const c = openAt(REF, s.side);
        if (c >= 0) { chosen = REF; cc = c; }
      }
      if (chosen === NONE && s.k >= 1) {
        const c = openAt(s.k - 1, s.side);
        if (c >= 0) { chosen = s.k - 1; cc = c; }
      }
      if (chosen === NONE && s.k !== NONE) {
        const c = corridor(headingAt(s.k), Math.max(f.reachFan, need), keep);
        if (c >= keep) { chosen = s.k; cc = c; }
      }
      if (chosen === NONE) { s.scanNext = s.k >= 0 ? s.k + 1 : 0; s.scanBest = -1; s.scanBestC = 0; }
    }
    if (chosen === NONE) {
      for (; s.scanNext < N; s.scanNext++) {
        if (s.probes + 3 > P.maxFeelers) return hold(out, inp);
        const k = s.scanNext, h = headingAt(k), req = Math.max(f.reachFan, past(h, false));
        const c = corridor(h, req, req);
        if (c >= req) { chosen = k; cc = c; break; }
        if (c > s.scanBestC) { s.scanBest = k; s.scanBestC = c; }
      }
      if (chosen === NONE && s.scanBest >= 0 && s.scanBestC >= pass) {
        // nothing open: the most room there is, measured exactly
        if (s.probes + 3 > P.maxFeelers) return hold(out, inp);
        const c = corridor(headingAt(s.scanBest), Math.max(f.reachFan, need), pass);
        if (c >= pass) { chosen = s.scanBest; cc = c; }
      }
      s.scanNext = -1;
    }
    if (chosen === NONE) {
      // 8. NOTHING ON THIS SIDE. Once a detour, the other side is tried -
      // the body holds for the frame the scan changes hands - and after
      // that there is no way round: stop, short of it.
      if (s.flipped) return stopWith(out, inp, 'blocked');
      s.flipped = true; s.flips++; s.side = -s.side; s.k = NONE;
      s.scanNext = 0; s.scanBest = -1; s.scanBestC = 0;
      return hold(out, inp);
    }
    s.k = chosen;
    // 9. THE BUDGET. Walked, less what the walking gained along the line.
    if (s.walked - (f.along - s.sStart) > P.detourBudget) return stopWith(out, inp, 'blocked');
    return go(out, inp, headingAt(chosen), cc, reach);
  }

  return { step, reset, input, output, state: s, params: P };
}

/** TRAVEL-NAV1: the one door from the mod's frame to the steering, called
 *  by travelOptions.update through `deps.steer` with the autopilot's own
 *  drive. `worldX`/`worldZ` are the mod's world coordinates (32768 to a
 *  map pixel), `frame` the host's { speed, dt, scale, asked, ratio } -
 *  `ratio` the world units in a metre (streamingWorld.js SCENE_MAP_RATIO)
 *  and `asked` the metres the host's motor was really asked for last
 *  frame. The drive is written in place: its yaw only when the steering
 *  turned it (so an open road is the mod's bearing to the bit), its force
 *  scaled by the stand-off. Answers the stop, or null. */
export function steerDrive(steer, drive, worldX, worldZ, autopilot, frame, probe) {
  const r = frame.ratio;
  const inp = steer.input;
  inp.key = autopilot;
  inp.x = worldX / r; inp.z = worldZ / r;
  inp.tx = autopilot.destinationCentre.x / r;
  inp.tz = autopilot.destinationCentre.z / r;
  inp.goal = rectDistance(autopilot.destinationWorldRect, worldX, worldZ) / r;
  inp.yaw = drive.yaw * DEG;
  const force = Math.max(0, drive.forward);
  inp.reach = travelFrameReach(frame.speed, frame.dt, frame.scale) * force;
  inp.quantum = Math.max(0, frame.speed) * Math.max(0, frame.scale) * FIXED_DT * force;
  inp.asked = frame.asked;
  const out = steer.step(inp, probe, steer.output);
  if (out.deflected) drive.yaw = out.yaw / DEG;
  drive.forward *= out.forward;
  return out.stop;
}

// ── THE PROBE: THE FEELERS, THROUGH THE COLLIDER THE MOTOR USES ─────────

/** How high above the feet a feeler runs: over anything the motor steps
 *  up (STEP_OFFSET), under everything it cannot. */
export const FEELER_HEIGHT = STEP_OFFSET + 0.1;
/** A feeler follows the ground in legs this long - a heightmap cell and a
 *  quarter (819.2 / 128 = 6.4), so the terrain between two samples is
 *  near enough a straight line. */
export const FEELER_LEG = 8;
/** A face this close to level is ground to walk up, not a wall (the
 *  collider's own slope limit, motor.js SLOPE_LIMIT_DEG). */
export const WALKABLE_NY = Math.cos(SLOPE_LIMIT_DEG * DEG);
/** Stood this far over the terrain the body is on a structure, and its
 *  feelers run level from the feet rather than following the ground. */
const ON_STRUCTURE = 0.5;

/** A probe over a real collider (player/collider.js): `feet()` the body's
 *  feet in scene space. Each feeler starts FEELER_HEIGHT over the feet,
 *  `lateral` metres to the right of the heading, and runs out in legs of
 *  FEELER_LEG whose ends ride FEELER_HEIGHT over the terrain
 *  (`collider.heightAt`) - so a house on a rise ahead is met at its wall,
 *  not passed under by a level ray that went into the hill (the terrain
 *  is not in the collider's buckets, so a ray passes through it). A hit on
 *  a face flatter than the slope limit is a ramp and is walked on. The
 *  origin, the direction and the hit are this probe's own, reused every
 *  call (collider.raycastHit's `out`). */
export function createColliderProbe({ collider, feet, height = FEELER_HEIGHT, leg = FEELER_LEG }) {
  const o = [0, 0, 0];
  const d = [0, 0, 0];
  const hit = { dist: Infinity, key: null, normal: [0, 0, 0] };
  return function probe(dirX, dirZ, lateral, maxDist) {
    const at = feet();
    const sx = at[0] + dirZ * lateral, sz = at[2] - dirX * lateral;   // right of (dirX, dirZ) is (dirZ, -dirX): motor.js's screen-right
    const g0 = collider.heightAt(at[0], at[2]);
    const level = !(at[1] - g0 <= ON_STRUCTURE);   // no ground under the feet (NaN, -Infinity) reads as a structure too
    let y0 = at[1] + height;
    let a = 0;
    while (a < maxDist) {
      const b = Math.min(maxDist, a + leg);
      const x0 = sx + dirX * a, z0 = sz + dirZ * a;
      const x1 = sx + dirX * b, z1 = sz + dirZ * b;
      let y1 = y0;
      if (!level) {
        const g1 = collider.heightAt(x1, z1);
        if (Number.isFinite(g1)) y1 = g1 + height;
      }
      const ex = x1 - x0, ey = y1 - y0, ez = z1 - z0;
      const span = Math.hypot(ex, ey, ez);
      if (span > 1e-9) {
        o[0] = x0; o[1] = y0; o[2] = z0;
        d[0] = ex / span; d[1] = ey / span; d[2] = ez / span;
        collider.raycastHit(o, d, span, null, hit);
        if (hit.dist <= span && Math.abs(hit.normal[1]) < WALKABLE_NY) {
          return a + (b - a) * (hit.dist / span);
        }
      }
      a = b; y0 = y1;
    }
    return Infinity;
  };
}
