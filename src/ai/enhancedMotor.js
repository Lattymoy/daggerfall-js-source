// ═══════════════════════════════════════════════════════════════════
// ENHANCED AI 4 — the motor reads the switch.
//
// Decision #1 of the arc, honoured to the letter: `characters/
// enemyMotor.js` is NOT edited. EnemyAI resolves `this._getDestination`
// by dynamic dispatch from `_classicTick`, and EVERYTHING downstream of
// the classic tick keys off `this.destination` - the 5.625° turn gate,
// AttemptMove's obstacle probe, the fall check, gravity, speed. So the
// enhanced motor is a subclass that answers one question differently:
// where is this foe walking TO right now. The answer is the next
// waypoint of a navmesh path to the target; when there is no bake, no
// path, or the classic detour is running, the answer is the classic
// one. Senses, decisions, attacks, sounds, knockback, water, flight:
// classic, untouched, by construction.
//
// ── THE LAWS ARE PROJECT-FINAL'S ────────────────────────────────
//
// The follow laws are Mac's, from project-final's src/game/
// enemyShared.js (repathToward, stuckWatch, the constants) and
// enemyMelee.js htClose (the waypoint advance), at project-final
// 8ba9100. The constants are his numbers with his comments; the two
// functions are his bodies, re-homed on `this` instead of `e` because
// the port's foe IS its motor. navWalkable is main.js:236 verbatim.
// Where the port's shape forced a change it is named below; there are
// exactly two, and neither touches how a route is chosen or held.
//
// ── ADAPTATION 1: THE STOP CHECK, AND THE PROJECTED DESTINATION ──
//
// His chase measures its stop against the PLAYER (`distP > MELEE_RANGE`)
// and steers at the waypoint; the two are separate. The classic tick
// has ONE destination doing both jobs, and when the target is out of
// sight it measures the stop against the DESTINATION - DFU's own law,
// because classic's out-of-sight destination is a last-known position
// the foe walks to and stops at. With a route, out of sight is the
// COMMON case (that is what a navmesh is for), and the destination is
// an intermediate corner: a foe would halt at every corner inside 2.25
// m of it and stutter down the corridor.
//
// The fix keeps his advance law exactly and changes only what the stop
// check can see: the destination is the waypoint's DIRECTION, extended
// to at least stopDistance - the yaw gate reads direction alone, so the
// steering is byte-identical to steering at the waypoint, and the stop
// check can no longer fire on a corner. The FINAL point is never
// extended, so the foe stops at the goal exactly as classic stops at
// its LKP. Pinned both ways.
//
// ── ADAPTATION 2: THE NUDGE GOES THROUGH THE COLLIDER ───────────
//
// His stuckWatch writes e.x/e.z directly after a walkable check. The
// port's feet move only through `collider.move` - a direct write would
// put a foe inside geometry the nav's erosion happened to disagree
// with. The nudge is his vector, his side choice, his walkable gate,
// resolved by the collider; a blocked nudge is a nudge of zero, and
// the route is dropped either way, exactly as his does when both sides
// are walls.
//
// ── ADAPTATION 3: THE ROUTE SUPPLIES X AND Z; THE Y IS CLASSIC'S ──
//
// findPath's waypoints carry y = surfH(chf.colliders, ...) ONLY when the
// chf has colliders, and otherwise y = 0. The port's live chf never
// does: it is hydrated on the main thread from a worker bake or the
// IndexedDB cache (3b), and hydrateBakedNav carries a constant floor,
// not the collider list. So every waypoint sat at y = 0 wherever the
// dungeon actually was. A walker ignores y. A flyer or swimmer moves
// along _dir3(destination), a 3D heading pitched toward y = 0 - down
// into the floor-lift clause, or up into the ceiling - and its
// out-of-sight stop check, hypot(dx, 0 - feet.y, dz), never comes
// inside stopDistance, so it never arrives. Mac's report: foes that
// disappear, and one in a ceiling.
//
// The nav has no vertical information to offer here - its heights are
// a flat floor - so it is not asked. A corner takes the FOE'S OWN y
// (level along the corridor, which for a walker is a no-op and for a
// flyer is the only honest guess) and the goal takes the GOAL'S real y,
// the predicted target position's, which is precisely the y classic's
// destination carries. The route bends x and z; nothing else changes.
//
// ── ADAPTATION 4: THE NUDGE RUNS THE FALL CHECK ─────────────────
//
// His nudge gates on walkable(). The nav's cell is walkable if it has a
// floor span; it says nothing about the DROP to the next cell, and at
// 0.5 m cells a ledge is a rounding error. Every classic move runs
// _fallCheck first (AttemptMove :978); a nudge that skipped it could
// side-step a foe off an edge classic would never step off. The nudge
// asks the port's own fall check on its own direction and takes the
// other side, or none.
//
// ── NEVER TRAPS ─────────────────────────────────────────────────
//
// The bake lands asynchronously (3b) and may never land. `nav()` is a
// thunk read every step; null at any moment means the classic answer
// this step, no state carried over but the timers. A throw inside the
// route logic is caught, logged once, and the foe is classic from then
// on - a broken navmesh costs a feature, never a dungeon.
// ═══════════════════════════════════════════════════════════════════

import { EnemyAI } from '../characters/enemyMotor.js';
import { findPath } from './navmesh.js';

// ── project-final enemyShared.js:7-12, verbatim ────────────────────
export const REPATH_INT = 0.4;     // s between findPath refreshes toward the (moving) player
export const REPATH_FAIL = 0.5;    // s: back-off before retrying findPath after it returned null (unreachable goal). Without it a never-reachable goal (player off-mesh / on an island) re-paths every frame - bounded by the budget but a constant drain. The boss crawler already backs off the same way
export const STUCK_T = 0.6;        // s of no forward progress while path-following before the unstick fires
export const STUCK_EPS2 = 0.02 * 0.02; // (m)^2: squared per-tick movement at/below which counts as no progress (~1/3 of a normal step)
export const STUCK_NUDGE = 0.35;   // m: the perpendicular side-step the unstick takes
export const WP_REACH = 0.45;      // m: a waypoint counts as reached within this
// ── project-final enemy.js:402, verbatim ───────────────────────────
export const PATH_BUDGET_PER_FRAME = 3; // cap findPath (poly A* + funnel) calls per frame. A wave spawns all its enemies at once with repathT 0 and path null, so without this every enemy paths on the same first tick - N heavy pathfinds in one frame = the spawn lag spike. Enemies past the cap keep path null (stand a frame) and retry next frame; the burst spreads over a few frames instead of one. Tunable

/** How far past stopDistance the projected destination sits, so the
 *  classic stop check's `<=` cannot land on it. Adaptation 1's one
 *  number; the port's, not his. */
export const PROJECT_MARGIN = 0.05;

/** project-final main.js:236, verbatim: a cell is walkable iff it holds
 *  a walkable, regioned span (or its bit is set in a hydrated map's
 *  walkmask). */
export function navWalkable(chf, x, z) {
  const ix = Math.floor((x - chf.xmin) / chf.cs), iz = Math.floor((z - chf.zmin) / chf.cs);
  if (ix < 0 || iz < 0 || ix >= chf.nx || iz >= chf.nz) return false;
  const i = ix + iz * chf.nx;
  if (chf.walkmask) return (chf.walkmask[i >> 3] & (1 << (i & 7))) !== 0;
  for (const s of chf.spans[i]) if (s.walkable && s.reg) return true;
  return false;
}

/** The host's per-frame world for the routes: the findPath budget,
 *  refilled every frame by the host (his enemy.js:404), and the nav
 *  epoch that invalidates every held route when an obstacle changes
 *  (his Slice 9). One object per host, shared by every foe in it. */
export function makeNavWorld() {
  // budgetPerFrame rides the object so the host's frame loop - which
  // is outside the scope that imported this module - refills from
  // what it already holds rather than reaching for a second literal.
  return { pathBudget: PATH_BUDGET_PER_FRAME, budgetPerFrame: PATH_BUDGET_PER_FRAME, navEpoch: 0 };
}

export class EnhancedEnemyAI extends EnemyAI {
  /**
   * `nav`      () => chf | null   - the bake, read every step; null = classic
   * `navWorld` { pathBudget, navEpoch } from makeNavWorld(), host-owned
   * `navSeed`  an integer; his maulSeed's role - the nudge side comes
   *            off it so twin runs nudge the same way
   */
  constructor(collider, feet, yawRad, opts = {}) {
    super(collider, feet, yawRad, opts);
    this.nav = opts.nav ?? (() => null);
    this.navWorld = opts.navWorld ?? makeNavWorld();
    this.navSeed = (opts.navSeed ?? 0) >>> 0;
    // his movement scratch (enemy.js:64), re-homed
    this.path = null; this.pathI = 1; this.repathT = 0; this.pathEpoch = undefined;
    this.stuckT = 0; this.lastX = feet[0]; this.lastZ = feet[2];
    this.navBroken = false;
    /** observational, his stuckStats pattern - probes and tests only */
    this.navStats = { repaths: 0, fails: 0, stuckFires: 0 };
  }

  /** Where the route is heading: the classic destination's own target
   *  - the predicted position when the foe has one, else the target's
   *  feet. The same point classic would walk a straight line at. */
  _navGoal(targetFeet) {
    return this.predictedTargetPos ?? targetFeet;
  }

  /** project-final enemyShared.js:158-166 repathToward, on `this`.
   *  Returns true if a findPath was attempted this frame (budget
   *  consumed). Deliberately no `|| !this.path` catch: the timer alone
   *  gates retries, so the fail back-off actually sticks. */
  _repathToward(chf, gx, gz, dt) {
    const world = this.navWorld;
    if (this.path && world.navEpoch !== undefined && this.pathEpoch !== world.navEpoch) { this.path = null; this.repathT = 0; }
    if ((this.repathT -= dt) > 0) return false;
    if (world.pathBudget-- <= 0) return false;
    const np = findPath(chf, [this.feet[0], 0, this.feet[2]], [gx, 0, gz]);
    this.navStats.repaths++;
    if (np) { this.path = np; this.pathI = 1; this.repathT = REPATH_INT; this.pathEpoch = world.navEpoch; }
    else { this.path = null; this.repathT = REPATH_FAIL; this.navStats.fails++; }
    return true;
  }

  /** project-final enemyShared.js:177-187 stuckWatch, on `this`, with
   *  the nudge resolved by the collider (adaptation 2). (hx, hz) is the
   *  heading the foe was walking. Call once per step, AFTER the move. */
  _stuckWatch(chf, hx, hz, dt) {
    const dx = this.feet[0] - this.lastX, dz = this.feet[2] - this.lastZ;
    this.lastX = this.feet[0]; this.lastZ = this.feet[2];
    if (dx * dx + dz * dz > STUCK_EPS2) { this.stuckT = 0; return false; }
    if ((this.stuckT += dt) < STUCK_T) return false;
    this.stuckT = 0;
    const hl = Math.hypot(hx, hz) || 1, side = ((this.navSeed >>> 7) & 1) ? 1 : -1;
    for (const s of [side, -side]) {
      const ox = (-hz / hl) * s, oz = (hx / hl) * s;
      const nx = this.feet[0] + ox * STUCK_NUDGE, nz = this.feet[2] + oz * STUCK_NUDGE;
      if (!navWalkable(chf, nx, nz)) continue;
      // adaptation 4: classic's own drop test, on the nudge's heading.
      // WITH THE OBSTACLE FLAGS CLEARED FOR THE PROBE. _fallCheck returns
      // "no fall" without casting when obstacleDetected, foundUpwardSlope
      // or foundDoor is set - and a foe the watchdog fires on is stuck
      // against something, so it has obstacleDetected set almost by
      // definition. AUDIT 55 found the check answering false in exactly
      // the case it was added for. The flags are the classic tick's to
      // own; they are put back as they were.
      const od = this.obstacleDetected, us = this.foundUpwardSlope, fd = this.foundDoor;
      this.obstacleDetected = false; this.foundUpwardSlope = false; this.foundDoor = false;
      this._fallCheck([ox, 0, oz]);
      const drop = this.fallDetected;
      this.obstacleDetected = od; this.foundUpwardSlope = us; this.foundDoor = fd; this.fallDetected = false;
      if (drop) continue;
      this.collider.move(this.feet, nx - this.feet[0], 0, nz - this.feet[2]);
      break;
    }
    this.path = null; this.repathT = 0;
    this.navStats.stuckFires++;
    return true;
  }

  _step(dt, playerFeet, senses = null, paralyzed = false, paused = false) {
    super._step(dt, playerFeet, senses, paralyzed, paused);
    if (this.navBroken) return;
    const chf = this.nav();
    if (!chf) { this.path = null; return; }
    try {
      // The route lives only while the classic tick would be
      // pursuing: CanAct, not given up, and a position to head for -
      // the classic tick's own three gates, read after it ran.
      const targetFeet = this.target == null || this.target.isPlayer ? playerFeet : this.target.ai.feet;
      const pursuing = this.canAct && this.giveUpTimer > 0 && this.predictedTargetPos !== null && targetFeet != null;
      if (!pursuing) { this.path = null; this.stuckT = 0; this.lastX = this.feet[0]; this.lastZ = this.feet[2]; return; }
      const goal = this._navGoal(targetFeet);
      this._repathToward(chf, goal[0], goal[2], dt);
      if (this.path && this.moving) {
        this._stuckWatch(chf, Math.sin(this.yaw), Math.cos(this.yaw), dt);
      } else { this.stuckT = 0; this.lastX = this.feet[0]; this.lastZ = this.feet[2]; }
    } catch (e) {
      this.navBroken = true; this.path = null;
      console.warn('[enhanced-ai] motor fell back to classic:', e?.message ?? e);
    }
  }

  /** The seam. The classic tick calls this; when a route is held and
   *  no detour is running, the destination is the route's next corner
   *  (his advance law, enemyMelee.js:110-112), projected past the stop
   *  distance unless it is the goal (adaptation 1). */
  _getDestination(targetFeet) {
    if (this.avoidObstaclesTimer > 0 || !this.path || this.pathI >= this.path.length || this.nav() == null) {
      return super._getDestination(targetFeet);
    }
    let wp = this.path[this.pathI];
    while (this.pathI < this.path.length - 1 && Math.hypot(wp[0] - this.feet[0], wp[2] - this.feet[2]) <= WP_REACH) wp = this.path[++this.pathI];
    const last = this.pathI === this.path.length - 1;
    // adaptation 3: the goal's y is the goal's, a corner's is the foe's
    const y = last ? this._navGoal(targetFeet)[1] : this.feet[1];
    const dx = wp[0] - this.feet[0], dz = wp[2] - this.feet[2];
    const d = Math.hypot(dx, dz);
    const reach = this.stopDistance + PROJECT_MARGIN;
    if (last || d <= 1e-6 || d >= reach) { this.destination = [wp[0], y, wp[2]]; return; }
    const k = reach / d;
    this.destination = [this.feet[0] + dx * k, y, this.feet[2] + dz * k];
  }
}
