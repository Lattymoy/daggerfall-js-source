// AUDIT NAV1 (2026-09-29, Mac: "Lets do a deep comprehensive audit and ensure this is perfection. I want ship movement
// and combat to flow perfectly, just like assisins creed black flag") - THE CAPTAINS' SEAMANSHIP, rebuilt on what the
// movement audit measured (bible/03-World/Naval-Combat.md "AUDIT NAV1"): the way the player's own hulls make, the
// turn a hull's length allows, eased and heeling on a spring; no course nearer the wind than close-hauled - a tack or
// a wear; room given to other hulls; the land sounded by the hull's own width and never stood on; the true intercept,
// the broadside that bears soonest, the chase given up; a pirate coming alongside to board; the traffic's berths and
// the hulls kept apart; the sea keeping the world's time. Pure modules driven directly, the host through real frames.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ENGAGE_RANGE, DISENGAGE, CHASE_GIVE_UP_S, SPARE_S, GRAPPLE_STILL_S, GRAPPLE_GAP, GRAPPLE_CREW, BOARD_SAILS, WRECK_SPARE_S, ACCEL, DECEL,
  WIND_RATED, WIND_SHARE, CLOSE_HAULED, TACK_MIN_S, TACK_FLIP, TURN_TAU, TURN_FLOOR, OARS_TURN, TURN_SPEED_LOSS, HEEL_MAX,
  AVOID_SHIP_SWING, AVOID_HOLD_S, NAV_EVERY_S, SCAN_STEP, PURSUIT_LEAD_S, RANGE_BEND, WEAR_BELOW, TACK_FROM, TACK_CARRY, IRONS_DEG, PAYOFF_TURN,
  WAYPOINT_REACHED, ADRIFT_SPEED, AGROUND_WAY, SIDE_HOLD_S, AVOID_HEAD_ON, SWEEP_RANGE, SWEEP_WAY, SWEEP_TURN, GRAPPLE_STILL,
  createSeaShip, stepCaptain, windShare, windFactor, maxTurnRate, turnRateAt, turnRadius, hullLength, courseClear, avoidLand, tackCourse, sailable,
  trafficCourse, intercept, hullGap, broadsideReach, velocityOf,
} from '../src/systems/naval/navalAI.js';
import { HULL, HULL_BUILDS, hullBuild, classById } from '../src/systems/naval/navalShips.js';
import { SHIP_STATES } from '../src/systems/naval/navalDamage.js';
import { NAVAL_DEG } from '../src/systems/naval/navalBallistics.js';
import { BERTH_GAP } from '../src/systems/naval/navalBoarding.js';
import { createNavalDirector, DESPAWN_BEYOND, FIRST_ROLL_S, DENSITY } from '../src/systems/naval/navalDirector.js';
import { FRAME_STEP_S, FRAME_STEPS_MAX, RAM_SPEED, SHIP_FADE_S } from '../src/scenes/navalHost.js';
import { sea } from './navalSea.mjs';
import { HELM_WAY, HULL_HELM, steerage } from '../src/systems/helmWay.js';   // HELM-WAY: the captains turn at the player's own helm

const DEG = NAVAL_DEG;
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} vs ${b} (±${eps})`);
const open = () => true;
const world = (o = {}) => ({ now: 0, dt: 0.1, seaY: 0, wind: [0, 0, WIND_RATED], isWater: open, contacts: [], random: () => 0.5, ...o });
const player = (pos, o = {}) => ({ id: 'me', kind: 'player', pos, vel: [0, 0, 0], speed: 0, ...o });
// SEA-PEACE: the audit's captains are bold - a temper is the traffic's, pinned in test/seapeace.test.js
const ship = (classId, o = {}) => createSeaShip({ id: o.id ?? classId, seed: 1, classId, pos: o.pos ?? [0, 0, 0], yaw: o.yaw ?? 0, temper: o.temper ?? 'bold' });
const steps = (s, w, seconds) => { let out = null; for (let t = 0; t < seconds - 1e-9; t += w.dt) out = stepCaptain(s, w); return out; };

// ── the way and the turn ───────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV1 M4 the way: the classes are rated at the player\'s own pace - Come Sail Away\'s linear wind, WIND_RATED its middle - a pirate brigantine near the player\'s Small Ship, a navy cutter the swiftest, a merchant slower; a stronger wind drives her harder, within WIND_SHARE (mutants: the old wind curve, the brig at half the player\'s way)', () => {
  near(windShare(WIND_RATED), 1, 1e-12);
  near(windShare(2), 2 / WIND_RATED, 1e-12, 'linear');
  near(windShare(0.1), WIND_SHARE[0], 1e-12);
  near(windShare(9), WIND_SHARE[1], 1e-12);
  assert.ok(classById('pirateBrig').speed >= 7, 'the player\'s Small Ship makes 7.4-9 m/s at the rated wind');
  assert.ok(classById('navyCutter').speed > classById('pirateBrig').speed && classById('pirateBrig').speed > classById('merchantGalleon').speed);
  // a brig on a broad reach at the rated wind makes her class's way, and twice the wind drives her harder
  const hold = (s) => { s.course = [Math.sin(s.yaw) * 1e6, Math.cos(s.yaw) * 1e6]; return s; };   // a course held (NAV-R's hook)
  const b = hold(ship('pirateBrig', { yaw: 100 * DEG }));
  steps(b, world({ wind: [0, 0, WIND_RATED] }), 40);
  near(b.speed, classById('pirateBrig').speed * windFactor(100 * DEG), 0.05, 'her way on a broad reach');
  const g = hold(ship('pirateBrig', { yaw: 100 * DEG }));
  steps(g, world({ wind: [0, 0, 2.4] }), 60);
  assert.ok(g.speed > b.speed * 1.4, `a fresh wind (${g.speed.toFixed(2)} vs ${b.speed.toFixed(2)})`);
});

test('AUDIT NAV1 M5 x HELM-WAY the turn: a hull turns at the player\'s own responsive helm - her hull\'s helm times the steerage of her way (answering at rest, hardest at half her way) - and no faster than her class allows; a galley\'s oars turn her at OARS_TURN; the helm eases in over TURN_TAU and never overshoots the course; a hard turn costs her way (mutants: the steerage unread, the floor, the ease, the loss)', () => {
  for (const b of HULL_BUILDS) assert.ok(b.bowZ > 0 && b.aftZ < 0 && b.halfWidth > 0, `hull ${b.hull}'s extents`);
  near(hullLength(HULL.SmallShip), 41.84, 0.01, 'the Small Ship\'s collider, stem to stern');   // PIN MOVED (GALLEON, 2026-10-01): Mac's galleon's, her stem 21.93 to her stern -19.91
  const b = ship('pirateBrig');
  near(turnRadius(b), classById('pirateBrig').speed / turnRateAt(b, classById('pirateBrig').speed), 1e-9, 'the lookout\'s room: the circle she sails at her class\'s way, whatever way she has on');
  assert.ok(turnRadius(b) > hullLength(HULL.SmallShip) * 0.5 && turnRadius(b) < 70, `${turnRadius(b).toFixed(1)} m - her circle was 70.6 m at every way`);
  near(maxTurnRate(b) / DEG, HULL_HELM[HULL.SmallShip] * HELM_WAY.steerFloor, 1e-9, 'at rest she answers her steerage\'s floor - the wind in her canvas (the mod\'s rudder gave nothing)');
  assert.ok(maxTurnRate(b) / DEG > TURN_FLOOR);
  b.speed = 1;
  near(maxTurnRate(b) / DEG, HULL_HELM[HULL.SmallShip] * steerage(1), 1e-9, 'the player\'s own Small Ship\'s helm at 1 m/s');
  assert.ok(maxTurnRate(b) / DEG > 5, `${(maxTurnRate(b) / DEG).toFixed(2)} deg/s at 1 m/s`);
  b.speed = 7;
  near(maxTurnRate(b) / DEG, Math.min(classById('pirateBrig').turn, HULL_HELM[HULL.SmallShip] * steerage(7)), 1e-9);
  b.speed = 4.5;
  near(maxTurnRate(b) / DEG, classById('pirateBrig').turn, 1e-9, 'at half her way the curve passes her class\'s handiness, which caps it');
  const g = ship('pirateGalley');
  near(maxTurnRate(g) / DEG, OARS_TURN, 1e-9, 'her oars');
  const c = ship('merchantCoaster'); c.speed = 2;
  near(maxTurnRate(c) / DEG, HULL_HELM[HULL.LargeBoat] * steerage(2), 1e-9, 'a Large Boat\'s helm is her whole steerage');
  // the helm eases in, reaches her rate, and settles on the course without passing it
  const s = ship('pirateBrig', { yaw: 0 });
  s.speed = 7;
  const w = world({ wind: [1.5, 0, 0], contacts: [] });
  s.course = [1e7, 0];   // a course 90 degrees off her bow, so far off its bearing never moves (NAV-R's hook: a cruise's course)
  stepCaptain(s, w);
  assert.ok(s.yawRate > 0 && s.yawRate < maxTurnRate(s) * 0.2, `the helm takes (${(s.yawRate / DEG).toFixed(2)})`);
  let peak = 0, over = -Infinity;
  for (let t = 0; t < 60; t += w.dt) { stepCaptain(s, w); peak = Math.max(peak, s.yawRate); over = Math.max(over, s.yaw / DEG - 90); }
  assert.ok(peak > maxTurnRate(s) * 0.9, 'she turns at her rate');
  assert.ok(over < 0.5, `never past the course (${over.toFixed(2)} deg)`);
  near(s.yaw / DEG, 90, 1, 'settled on it');
  assert.ok(TURN_TAU.every((t) => t > 0) && TURN_SPEED_LOSS > 0);
  // a hard turn costs her way: in a calm (every point of sail alike) one brig held straight, one kept hard over
  const straight = ship('pirateBrig', { yaw: 90 * DEG }), hard = ship('pirateBrig', { yaw: 90 * DEG });
  const calm = world({ wind: [0, 0, 0] });
  straight.course = [1e7, 0];
  for (let t = 0; t < 40; t += calm.dt) {
    stepCaptain(straight, calm);
    hard.course = [hard.pos[0] + Math.cos(hard.yaw) * 1e6, hard.pos[2] - Math.sin(hard.yaw) * 1e6];   // always hard to starboard
    stepCaptain(hard, calm);
  }
  assert.ok(hard.speed < straight.speed * (1 - TURN_SPEED_LOSS / 2), `the turn costs her way (${hard.speed.toFixed(2)} vs ${straight.speed.toFixed(2)})`);
});

test('AUDIT NAV1 M5 the heel: she leans into a turn with her way and to leeward with the wind on her beam, on a spring - no step between frames, never past HEEL_MAX (mutants: the spring bypassed, the wind\'s heel dropped)', () => {
  const s = ship('pirateBrig', { yaw: 0 });
  s.speed = 7;
  const w = world({ wind: [1.5, 0, 0], contacts: [] });   // the wind blowing to starboard across her
  s.course = [0, 5000];
  let last = s.heel, jump = 0;
  for (let t = 0; t < 20; t += w.dt) { stepCaptain(s, w); jump = Math.max(jump, Math.abs(s.heel - last)); last = s.heel; }
  assert.ok(s.heel > 1, `to leeward (starboard, +) with the wind across her (${s.heel.toFixed(2)})`);
  assert.ok(jump < 0.5, `no step (${jump.toFixed(3)} a frame)`);
  s.course = [5000, 0];   // hard to starboard: she heels out of it (the turn's heel negative)
  let most = 0;
  for (let t = 0; t < 8; t += w.dt) { stepCaptain(s, w); most = Math.min(most, s.heel); }
  assert.ok(most < -0.5, `into the turn (${most.toFixed(2)})`);
  assert.ok(Math.abs(most) <= HEEL_MAX);
});

// ── the wind's eye ─────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV1 M2 the wind\'s eye: no course nearer than close-hauled - one into the eye is beaten up to on a tack 45 degrees off it, held TACK_MIN_S, put about when the goal bears TACK_FLIP past the eye; a galley rows straight at it; `sailable` clamps a course to its own side of the eye (mutants: the tack skipped, the flip, the galley\'s oars)', () => {
  const wind = [0, 0, WIND_RATED];   // blowing to +z: the eye is dead astern of north, heading PI
  const s = ship('pirateBrig', { yaw: 170 * DEG });
  const goal = [0, 0, -2000];   // dead upwind
  const t1 = tackCourse(s, Math.PI, goal, wind);
  near(Math.abs(Math.abs(t1) - (180 - (180 - CLOSE_HAULED)) * DEG), 0, 1e-9, 'close-hauled');
  near(Math.abs(t1) / DEG, CLOSE_HAULED, 1e-9);
  const side = s.tack.side;
  assert.equal(tackCourse(s, 40 * DEG, goal, wind), 40 * DEG, 'a course off the eye is sailed as it is');
  assert.equal(s.tack, null);
  // the flip: the goal bearing past the eye on the other side, once TACK_MIN_S is served
  const t = ship('pirateBrig', { pos: [0, 0, 0] });
  tackCourse(t, Math.PI, [0, 0, -2000], wind);
  const first = t.tack.side;
  t.pos = [first * -1500, 0, 0];   // she has stood out so far that the goal now bears well past the eye
  t.clock += TACK_MIN_S - 1;
  tackCourse(t, Math.PI, [0, 0, -2000], wind);
  assert.equal(t.tack.side, first, 'held TACK_MIN_S');
  t.clock += 2;
  tackCourse(t, Math.PI, [0, 0, -2000], wind);
  assert.equal(t.tack.side, -first, 'put about');
  assert.ok(TACK_FLIP > 0 && TACK_FLIP < 45);
  const g = ship('pirateGalley');
  assert.equal(tackCourse(g, Math.PI, goal, wind), Math.PI, 'a galley rows it');
  near(sailable(s, Math.PI - 10 * DEG, wind) / DEG, 180 - (180 - CLOSE_HAULED), 1e-9, 'clamped on its own side');
  assert.equal(sailable(g, Math.PI, wind), Math.PI);
  assert.ok(side === 1 || side === -1);
});

test('AUDIT NAV1 M2 through the eye: a ship with way and already near the wind TACKS - her way carrying her through at the rate she went in with - one slow or off the wind WEARS the long way round, and one lying in irons pays off; she never lies head to wind at a standstill (mutants: the wear never taken, the carry dropped, the pay-off)', () => {
  const wind = [0, 0, WIND_RATED];
  // slow, off the wind: the short way through the eye becomes the long way
  const w0 = ship('pirateBrig', { yaw: 150 * DEG }); w0.speed = 0.5;
  const w = world({ wind, contacts: [] });
  w0.course = [Math.sin(-130 * DEG) * 1e6, Math.cos(-130 * DEG) * 1e6];   // a course she can sail, across the eye (PI) on the far side
  stepCaptain(w0, w);
  assert.equal(w0.turnWay?.kind, 'wear');
  assert.ok(w0.yawRate < 0, 'the long way: away from the eye');
  // with way, close-hauled: she tacks
  const t0 = ship('pirateBrig', { yaw: -140 * DEG }); t0.speed = 6;
  t0.course = [Math.sin(140 * DEG) * 5000, Math.cos(140 * DEG) * 5000];
  stepCaptain(t0, w);
  assert.equal(t0.turnWay?.kind, 'tack');
  assert.ok(t0.turnWay.rate > 0);
  assert.ok(TACK_FROM < CLOSE_HAULED && WEAR_BELOW > 0);
  // she comes through the eye in her own time - her way carrying her - and sails on the far tack
  let through = null;
  for (let t = 0; t < 60; t += w.dt) { stepCaptain(t0, w); if (through == null && Math.abs(t0.yaw - 140 * DEG) < 10 * DEG) through = t; }
  assert.ok(through != null && through < 25, `through the eye at ${through?.toFixed(1)} s`);
  assert.ok(t0.speed > 2, `with way on (${t0.speed.toFixed(2)})`);
  // the carry is what carries her when her way is nearly gone in the eye: put about on the least way she tacks with
  // (WEAR_BELOW of her pace, 3.42 m/s), her steerage there (HELM-WAY) falls under it - t0 keeps 1.4 m/s through the eye,
  // whose steerage (7.5 deg/s) beats the carry's 7.2, so t0 alone cannot tell
  const c0 = ship('pirateBrig', { yaw: -140 * DEG }); c0.speed = 3.5;
  c0.course = [Math.sin(140 * DEG) * 5000, Math.cos(140 * DEG) * 5000];
  stepCaptain(c0, w);
  assert.equal(c0.turnWay?.kind, 'tack');
  const rateIn = c0.turnWay.rate;
  let eye = null, was = c0.yaw;
  for (let t = 0; t < 20 && !eye; t += w.dt) {
    const way = c0.speed;
    stepCaptain(c0, w);
    if (was < 0 && c0.yaw > 0) eye = { way, rate: Math.abs(c0.yawRate) };   // her bow across the wind's eye (PI)
    was = c0.yaw;
  }
  assert.ok(eye && turnRateAt(c0, eye.way) < TACK_CARRY * rateIn - DEG, `in the eye her steerage (${eye && (turnRateAt(c0, eye.way) / DEG).toFixed(2)} deg/s) is under the carry`);
  near(eye.rate, TACK_CARRY * rateIn, 1e-9, 'through the eye at TACK_CARRY of the rate she went in with');
  // lying head to wind at rest the wind on her backed canvas swings her at PAYOFF_TURN - over her steerage's floor at
  // rest (HULL_HELM x steerFloor, 2.25 deg/s; TURN_FLOOR's 1 is under both since HELM-WAY, so the floor below cannot tell)
  const p0 = ship('pirateBrig', { yaw: Math.PI });
  p0.course = [0, -5000];
  stepCaptain(p0, w);
  near(Math.abs(p0.yawRate), PAYOFF_TURN * DEG * (1 - Math.exp(-w.dt / TURN_TAU[HULL.SmallShip])), 1e-12, 'her helm over toward PAYOFF_TURN');
  assert.ok(PAYOFF_TURN > HULL_HELM[HULL.SmallShip] * HELM_WAY.steerFloor);
  // lying head to wind at rest she pays off and gathers way
  const i0 = ship('pirateBrig', { yaw: Math.PI });
  i0.course = [0, -5000];
  steps(i0, w, 1);
  assert.ok(Math.abs(i0.yawRate) / DEG > TURN_FLOOR, 'paying off faster than her floor');
  steps(i0, w, 40);
  assert.ok(i0.speed > 3 && Math.abs(Math.abs(i0.yaw) - Math.PI) > IRONS_DEG * DEG, `out of irons (${i0.speed.toFixed(2)} m/s at ${(i0.yaw / DEG).toFixed(0)})`);
  assert.ok(PAYOFF_TURN > TURN_FLOOR);
});

// ── other hulls, the land ──────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV1 M6 other hulls: one that will pass within both hulls\' reach inside AVOID_SHIP_S is given room - to starboard for one met ahead (within AVOID_HEAD_ON of the bow), as the rule of the road has it, both ships alike; away from the side one passes on - overtaking, or close on her beam; nothing for one passing wide or the one she means to lie alongside (mutants: the room never given, the starboard rule, the beam steered into, the exception)', () => {
  const a = ship('merchantGalleon', { id: 'a', pos: [0, 0, 0], yaw: 0 }); a.speed = 6;
  const b = ship('merchantGalleon', { id: 'b', pos: [8, 0, 200], yaw: Math.PI }); b.speed = 6;   // near head-on, a touch to her starboard
  const cB = { id: 'b', kind: 'ship', pos: b.pos, vel: velocityOf(b), hull: b.hull };
  const cA = { id: 'a', kind: 'ship', pos: a.pos, vel: velocityOf(a), hull: a.hull };
  assert.ok(trafficCourse(a, 0, [cB]) > 0, 'a turns to starboard');
  assert.ok(wrapTo(trafficCourse(b, Math.PI, [cA]) - Math.PI) > 0, 'and so does b');
  assert.ok(trafficCourse(a, 0, [cB]) <= AVOID_SHIP_SWING * DEG + 1e-9);
  assert.equal(trafficCourse(a, 0, [cB], 'b'), 0, 'the one she lies alongside');
  const wide = { ...cB, pos: [400, 0, 200] };   // far wide
  assert.equal(trafficCourse(a, 0, [wide]), 0, 'passing wide');
  const noHull = { ...cB, hull: undefined };
  assert.equal(trafficCourse(a, 0, [noHull]), 0);
  // overtaking from her starboard quarter: she bears away to port
  const o = { id: 'o', kind: 'ship', pos: [15, 0, -60], vel: [0, 0, 12], hull: HULL.SmallShip };
  assert.ok(trafficCourse(a, 0, [o]) < 0, 'away from the overtaker');
  // a hull lying close on her starboard beam: away to port, never into her (the old starboard rule ran to 112.5)
  const beam = { id: 'm', kind: 'ship', pos: [30, 0, 0], vel: [0, 0, 0], hull: HULL.LargeBoat };
  assert.ok(trafficCourse(a, 0, [beam]) < 0, 'away from the beam');
  assert.ok(trafficCourse(a, 0, [{ ...beam, pos: [-30, 0, 0] }]) > 0, 'and from the other beam');
  assert.ok(AVOID_HEAD_ON < 45);
});
const wrapTo = (a) => Math.atan2(Math.sin(a), Math.cos(a));

test('AUDIT NAV1 M7 the land: the lookout sounds from the stem past her turning circle and LOOKAHEAD_S of her way, every SCAN_STEP on the keel line and past either side of the hull - an 18 m spit across her course is found; a swing is kept until it is foul or her course has been clear AVOID_HOLD_S, the course itself tried before a new swing; a swing she can sail is preferred; boxed in she comes about toward the open side (mutants: the steps, the width, the hold, the retry)', () => {
  const spit = (x, z) => !(z > 150 && z < 168 && Math.abs(x) < 600);
  assert.equal(courseClear([0, 0, 0], 0, 300, spit), false, 'the spit is found');
  assert.equal(courseClear([0, 0, 0], 0, 140, spit), true, 'short of it');
  assert.equal(courseClear([0, 0, 0], 0, 300, (x, z) => !(z > 150 && z < 168 && x > 5 && x < 12)), false, 'a sliver off the keel line, inside the hull\'s width');
  assert.equal(courseClear([0, 0, 0], 0, 300, (x, z) => !(z > 150 && z < 168 && x > 5 && x < 12), { half: 4 }), true, 'narrower than the half width asked');
  assert.ok(SCAN_STEP <= 6.4, 'a land tile is 6.4 m');
  const s = ship('pirateBrig', { yaw: 0 }); s.speed = 5;
  const shore = (x, z) => z < 120;   // a shore across her bow
  const first = avoidLand(s, 0, shore, [1.5, 0, 0]);
  assert.notEqual(first, 0, 'swung off');
  assert.ok(s.avoid.swing !== 0);
  const swung = s.avoid.swing;
  s.clock += NAV_EVERY_S / 2;
  assert.equal(avoidLand(s, 0, shore, [1.5, 0, 0]), first, 'between soundings the answer stands');
  // the shore gone: the swing held AVOID_HOLD_S, then let go
  for (let k = 0; k < Math.ceil(AVOID_HOLD_S / NAV_EVERY_S) - 1; k++) { s.clock += NAV_EVERY_S; avoidLand(s, 0, open, [1.5, 0, 0]); }
  assert.equal(s.avoid.swing, swung, 'held while the course has been clear under AVOID_HOLD_S');
  s.clock += NAV_EVERY_S * 2; avoidLand(s, 0, open, [1.5, 0, 0]);
  assert.equal(s.avoid.swing, 0, 'let go');
  // a held swing gone foul while her course is clear: the course itself, not a new swing
  const r = ship('pirateBrig', { yaw: 0 }); r.speed = 5;
  avoidLand(r, 0, shore, [1.5, 0, 0]);
  const heldSwing = r.avoid.swing;
  const onlyAhead = (x, z) => Math.hypot(x, z) < 45 || Math.abs(Math.atan2(x, z) - heldSwing * DEG) > 10 * DEG;   // her swung course now foul out along it, dead ahead clear (HELM-WAY: a tighter circle swings her 50 degrees, not 80 - the wedge starts past her stem's own soundings)
  r.clock += NAV_EVERY_S;
  assert.equal(avoidLand(r, 0, onlyAhead, [1.5, 0, 0]), 0, 'the course, clear again');
  // boxed in: about, toward the open side
  const box = ship('pirateBrig', { yaw: 0 }); box.speed = 3;
  const pond = (x, z) => Math.hypot(x + 45, z) < 80;   // a pond too small for any course, its water to her west (HELM-WAY: sized to her tighter circle's reach)
  const about = avoidLand(box, 0, pond, [1.5, 0, 0]);
  assert.ok(box.avoid.heading != null, 'boxed in');
  assert.ok(wrapTo(about - box.yaw) < 0, `round to port, the open side (${(about / DEG).toFixed(0)})`);
});

test('AUDIT NAV1 M7 never on the land: a stem or shoulder that would stand on land holds her there, her way falling to AGROUND_WAY of her best - she warps round where she lies and sails off; a ship sailed at a coast never crosses it (mutants: the guard skipped, the warp)', () => {
  const coast = (x, z) => z < 100;
  const s = ship('pirateBrig', { yaw: 0 });
  s.speed = 7;
  const w = world({ wind: [1.5, 0, 0], isWater: (x, z) => coast(x, z) });
  let dry = 0;
  const b = hullBuild(HULL.SmallShip);
  s.course = [0, 5000];   // she means to sail straight onto it
  for (let t = 0; t < 120; t += w.dt) {
    stepCaptain(s, w);
    if (s.pos[2] + b.bowZ > 100) dry += w.dt;
  }
  assert.equal(dry, 0, 'her stem never on the land');
  assert.ok(s.speed <= classById('pirateBrig').speed * windFactor(Math.PI / 2) + 1e-9);
  assert.ok(AGROUND_WAY < 1);
  // stood with her stem on the land, she holds, loses her way and turns off it
  const g = ship('pirateBrig', { yaw: 0, pos: [0, 0, 100 - b.bowZ - 0.5] });
  g.speed = 6;
  g.course = [0, 5000];
  stepCaptain(g, w);
  assert.ok(g.aground > 0, 'aground');
  assert.ok(g.speed <= AGROUND_WAY * classById('pirateBrig').speed + 1e-9);
  let stem = -Infinity;
  for (let t = 0; t < 25; t += w.dt) { stepCaptain(g, w); stem = Math.max(stem, g.pos[2] + Math.cos(g.yaw) * b.bowZ); }
  assert.ok(stem <= 100 + 1e-6, `she creeps to the shoreline and no further (${stem.toFixed(2)})`);
  assert.ok(Math.abs(wrapTo(g.yaw)) > 60 * DEG, `warped off it in 25 s (${(g.yaw / DEG).toFixed(0)})`);
  // the warp's own rate: aground she keeps AGROUND_WAY of her best (2.3 m/s, her steerage 9 deg/s), so g cannot tell it -
  // lying still and boxed in (a pond too small for any course, the wind on her beam, so not in irons) she is warped round
  // at PAYOFF_TURN, over her steerage's floor at rest, and holds no tack or wear
  const still = ship('pirateBrig', { yaw: 0 });
  stepCaptain(still, world({ wind: [1.5, 0, 0], isWater: (x, z) => Math.hypot(x + 45, z) < 80 }));
  assert.ok(still.avoid.heading != null, 'boxed in');
  near(Math.abs(still.yawRate), PAYOFF_TURN * DEG * (1 - Math.exp(-0.1 / TURN_TAU[HULL.SmallShip])), 1e-12, 'warped round at PAYOFF_TURN');
  assert.equal(still.turnWay, null, 'no tack or wear held while she is warped');
});

// ── the chase ──────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV1 M11 the intercept: the course that meets the enemy - the smallest t where her way and ours arrive together - and past her reach a pursuit leading by at most PURSUIT_LEAD_S; the enemy\'s way read smoothed (mutants: the old minutes-ahead lead, the lead uncapped)', () => {
  const i = intercept([0, 0, 0], 7, [0, 0, 400], [5, 0, 0]);
  const meet = Math.hypot(i.point[0], i.point[2]);
  near(meet / 7, i.t, 1e-6, 'she arrives when he does');
  near(i.point[0], 5 * i.t, 1e-9);
  // he outruns her: a pursuit, the lead capped
  const p = intercept([0, 0, 0], 3, [0, 0, 400], [0, 0, 8]);
  assert.ok(p.t <= PURSUIT_LEAD_S + 1e-9);
  near(p.point[2], 400 + 8 * p.t, 1e-9);
  // the brig closing a moving player steers the intercept, not his wake
  const b = ship('pirateBrig', { yaw: 0 });
  const w = world({ wind: [1.5, 0, 0], contacts: [player([300, 0, 600], { vel: [0, 0, -4], speed: 4 })] });
  stepCaptain(b, w);
  assert.equal(b.mode, 'engage');
  assert.ok(b.tvel && Math.abs(b.tvel.v[2] + 4) < 1e-9, 'his way, read');
});

test('AUDIT NAV1 M3 the broadside that bears soonest: each side\'s heading lays the enemy\'s LEAD abeam - dead abeam while it is loaded and in reach, bent up to RANGE_BEND to work the range while it reloads - the side weighed by the turn against its reload, a course past close-hauled presented close-hauled, a side onto the land never taken while the other serves; she keeps her side unless the other bears SIDE_HOLD_S sooner (mutants: the bend while loaded, the land, the hold)', () => {
  const at = [100 * Math.sin(20 * DEG), 0, 100 * Math.cos(20 * DEG)];   // 100 m, 20 degrees to starboard
  const b = ship('pirateBrig', { yaw: 0 });
  stepCaptain(b, world({ contacts: [player(at)] }));
  assert.equal(b.present.side, 'starboard', 'the side the enemy is on');
  assert.ok(b.yawRate < 0, 'wearing to show it');
  // loaded, in reach: dead abeam - she runs out (the guns' own tell, test/navaudit_guns.test.js) and fires at the lead
  const f = ship('pirateBrig', { yaw: 0 });
  const fw = world({ contacts: [player([80, 0, 0])] });
  const shots = [];
  for (let t = 0; t < 2; t += fw.dt) shots.push(...stepCaptain(f, fw).volleys);
  assert.equal(shots.length, 1);
  assert.equal(shots[0].side, 'starboard');
  // loaded, in reach but far past her fighting range, him forward of her beam: she turns him dead abeam and fires
  // rather than bending in to close
  const far = ship('pirateBrig', { yaw: 0 });
  far.speed = 6;
  const at60 = [180 * Math.sin(60 * DEG), 0, 180 * Math.cos(60 * DEG)];
  const under = world({ wind: [1.5, 0, 0], contacts: [player(at60, { vel: [0, 0, 0.5], speed: 1.5 })] });
  let fired = 0;
  for (let t = 0; t < 15; t += under.dt) { under.contacts[0].pos = [far.pos[0] + at60[0], 0, far.pos[2] + at60[2]]; fired += stepCaptain(far, under).volleys.filter((v) => v.side === 'starboard').length; }
  assert.ok(fired > 0 && 180 > far.cls.range, 'the loaded side fires at the edge of her reach');
  // reloading, far: bent toward him - the lead forward of the beam, the range worked
  const r = ship('pirateBrig', { yaw: 0 });
  r.guns.fired('starboard'); r.guns.fired('port');
  stepCaptain(r, world({ wind: [0, 0, 1.5], contacts: [player([180, 0, 0], { vel: [0, 0, 3], speed: 3 })] }));
  assert.ok(r.yawRate > 0, 'bending toward him while she reloads');
  assert.ok(RANGE_BEND > 0);
  // a side onto the land is not taken while the other serves
  const l = ship('pirateBrig', { yaw: 0 });
  stepCaptain(l, world({ wind: [1.5, 0, 0], isWater: (x, z) => z < 60, contacts: [player([60, 0, 5], { vel: [0, 0, 3], speed: 3 })] }));
  assert.equal(l.present.side, 'port', 'the starboard course runs onto the land: she wears to show her port side');
  // the hold: two sides that bear alike (both reloading alike) - the one she shows is kept
  const h = ship('pirateBrig', { yaw: 0 });
  h.guns.fired('starboard'); h.guns.fired('port');
  const wh = world({ wind: [0, 0, 1.5], contacts: [player([-60, 0, 0], { vel: [0, 0, 3], speed: 3 })] });
  stepCaptain(h, wh);
  assert.equal(h.present.side, 'port');
  h.clock += 1;
  stepCaptain(h, { ...wh, contacts: [player([0, 0, 60], { vel: [3, 0, 0], speed: 3 })] });
  assert.equal(h.present.side, 'port', 'kept, though starboard would bear as soon');
  assert.ok(SIDE_HOLD_S > 0);
  // a broadside course into the wind's eye is presented close-hauled
  // (HELM-WAY: her port side's run north is the land here - her quicker helm would otherwise wear round to show it, the
  // NO_BEAR_S law's own answer)
  const c = ship('pirateBrig', { yaw: 150 * DEG });
  stepCaptain(c, world({ wind: [0, 0, 1.5], isWater: (x, z) => z < 40, contacts: [player([Math.sin(-100 * DEG) * 100, 0, Math.cos(-100 * DEG) * 100], { vel: [0, 0, 1.5], speed: 1.5 })] }));
  assert.equal(c.present.side, 'starboard');
  assert.ok(c.yawRate < 0, 'off toward close-hauled, not up into the eye');
});

test('AUDIT NAV1 M12 giving up: a chase that has not closed in CHASE_GIVE_UP_S while past her fighting range is given up and the one she chased left be SPARE_S; in the fight it never is; an enemy held is let go only past DISENGAGE times the reach she saw it at (mutants: no give-up, the fight\'s refresh, the disengage)', () => {
  const b = ship('pirateBrig', { yaw: 0 });
  const w = world({ wind: [1.5, 0, 0], contacts: [player([0, 0, 400], { vel: [0, 0, 7], speed: 7 })] });
  let gaveUp = null;
  for (let t = 0; t < CHASE_GIVE_UP_S + 30; t += 1) {
    const c = w.contacts[0];
    c.pos = [b.pos[0], 0, b.pos[2] + 400];   // he keeps 400 m ahead of her, whatever she does: a chase that never gains
    stepCaptain(b, { ...w, dt: 1 });
    if (b.mode === 'cruise' && gaveUp == null) gaveUp = t;
  }
  assert.ok(gaveUp != null && gaveUp >= CHASE_GIVE_UP_S - 1, `given up at ${gaveUp}`);
  assert.ok(b.spare.get('me') > b.clock, 'left be');
  assert.ok(SPARE_S >= 60);
  // in the fight: never given up, however long - though her passes take her out and back. PIN MOVED (AUDIT NAV2 F21: the
  // gain is read against the farthest she lay in the last CHASE_GIVE_UP_S, so each return from a pass refreshed the
  // chase by itself): a spell in the fight longer than CHASE_GIVE_UP_S before the passes, and never given up between
  const f = ship('pirateBrig', { yaw: 0 });
  const wf = world({ wind: [1.5, 0, 0], contacts: [player([90, 0, 0], { vel: [0, 0, 3], speed: 3 })] });   // under way: a fight, not a boarding
  let quit = null;
  for (let t = 0; t < CHASE_GIVE_UP_S * 2; t += 1) {
    const out = t > CHASE_GIVE_UP_S && Math.floor(t / 20) % 2 === 1;   // then twenty seconds out on a pass, twenty in the fight
    wf.contacts[0].pos = [f.pos[0] + (out ? 260 : 90), 0, f.pos[2]];
    stepCaptain(f, { ...wf, dt: 1 });
    if (quit == null && f.mode !== 'engage') quit = t;
  }
  assert.equal(quit, null, `given up at ${quit}`);
  assert.equal(f.mode, 'engage');
  // held: kept past ENGAGE_RANGE to DISENGAGE times it
  const k = ship('pirateBrig');
  stepCaptain(k, world({ contacts: [player([0, 0, ENGAGE_RANGE - 10])] }));
  assert.equal(k.mode, 'engage');
  stepCaptain(k, world({ contacts: [player([0, 0, ENGAGE_RANGE * DISENGAGE - 10])] }));
  assert.equal(k.mode, 'engage', 'held');
  stepCaptain(k, world({ contacts: [player([0, 0, ENGAGE_RANGE * DISENGAGE + 10])] }));
  assert.equal(k.mode, 'cruise', 'let go');
});

// ── boarding ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV1 M1/G3 alongside to board: a pirate with men comes up to a player\'s boat lying still GRAPPLE_STILL_S, crippled or holed - on the side she approaches from, her way falling to stop her short of the berth, her broadsides held (her chasers still fire) - and grapples across GRAPPLE_GAP of water; a peer\'s only as their own word allows (AUDIT NAV1, online), never with Boarders off, never short of men (mutants: the stillness at range, the side, the held broadsides, the gap)', () => {
  const s = ship('pirateBrig', { pos: [-220, 0, 60], yaw: 90 * DEG });
  const boat = player([0, 0, 0], { yaw: 0, hull: HULL.SmallShip, crippled: true });
  const w = world({ wind: [0, 0, 1.5], contacts: [boat] });
  const o1 = stepCaptain(s, w);
  assert.equal(s.mode, 'board');
  assert.equal(s.berthSide, -1, 'she comes up on the side she is on (port of the boat)');
  assert.equal(o1.volleys.filter((v) => v.side === 'starboard' || v.side === 'port').length, 0, 'her broadsides held');
  let grapple = null, t0 = 0, minGap = Infinity;
  for (let t = 0; t < 180 && !grapple; t += w.dt) {
    const o = stepCaptain(s, w);
    minGap = Math.min(minGap, hullGap(s.pos, s.yaw, s.hull, boat.pos, 0, HULL.SmallShip));
    if (o.grapple) { grapple = o.grapple; t0 = t; }
  }
  assert.equal(grapple, 'me', 'she grapples');
  assert.ok(hullGap(s.pos, s.yaw, s.hull, boat.pos, 0, HULL.SmallShip) <= GRAPPLE_GAP, 'across GRAPPLE_GAP of water');
  assert.ok(minGap > -1, `never through the boat (${minGap.toFixed(1)})`);
  assert.ok(s.speed < 4, `slow at the rail (${s.speed.toFixed(2)} m/s, at ${t0.toFixed(0)} s)`);
  assert.ok(BOARD_SAILS.min > 0 && BERTH_GAP > 0);
  // still, not crippled: once GRAPPLE_STILL_S has passed, at any range
  const st = ship('pirateBrig', { pos: [0, 0, 400] });
  const still = world({ wind: [0, 0, 1.5], contacts: [player([0, 0, 0], { yaw: 0, hull: HULL.SmallShip })] });
  steps(st, still, GRAPPLE_STILL_S - 0.5);
  assert.equal(st.mode, 'engage');
  steps(st, still, 1);
  assert.equal(st.mode, 'board', 'lying still: they come to board');
  // lying alongside a still boat, the boat abeam and loaded guns in reach: she holds them
  const along = ship('pirateBrig', { pos: [40, 0, 0], yaw: 0 });
  along.stillFor.set('me', GRAPPLE_STILL_S + 1);
  let broadsides = 0;
  for (let t = 0; t < 3; t += still.dt) broadsides += stepCaptain(along, world({ wind: [0, 0, 1.5], contacts: [player([0, 0, 0], { yaw: 0, hull: HULL.SmallShip })] })).volleys.filter((v) => v.side === 'starboard' || v.side === 'port').length;
  assert.equal(along.mode, 'board');
  assert.equal(broadsides, 0, 'coming alongside she holds her broadsides');
  // a long hull: her stem 5 m off a galley's stern is alongside enough, though their middles lie 67 m apart
  const galleyAft = hullBuild(HULL.LargeGalley).aftZ, bow = hullBuild(HULL.SmallShip).bowZ;
  const lg = ship('pirateBrig', { pos: [0, 0, galleyAft - 5 - bow], yaw: 0 });
  const o2 = stepCaptain(lg, world({ contacts: [player([0, 0, 0], { yaw: 0, hull: HULL.LargeGalley, crippled: true })] }));
  assert.equal(o2.grapple, 'me', 'the grapnels fly across GRAPPLE_GAP of water');
  // AUDIT NAV1 (online #10): a peer's wreck when their own word lets pirates board them (the grapple theirs to take),
  // never when it does not; never with Boarders off, never short of men
  const peer = ship('pirateBrig', { pos: [0, 0, 300] });
  stepCaptain(peer, world({ contacts: [player([0, 0, 0], { crippled: true, peer: true, boarders: true })] }));
  assert.equal(peer.mode, 'board', 'a peer who lets them');
  const refuses = ship('pirateBrig', { pos: [0, 0, 300] });
  stepCaptain(refuses, world({ boarders: true, contacts: [player([0, 0, 0], { crippled: true, peer: true, boarders: false })] }));
  assert.notEqual(refuses.mode, 'board', 'a peer who does not - whatever my own setting says');
  const off = ship('pirateBrig', { pos: [0, 0, 300] });
  stepCaptain(off, world({ boarders: false, contacts: [player([0, 0, 0], { crippled: true })] }));
  assert.notEqual(off.mode, 'board');
  const few = ship('pirateBrig', { pos: [0, 0, 300] });
  few.damage.apply({ hull: 0, sail: 0, crew: few.damage.crew - (GRAPPLE_CREW - 1) });
  stepCaptain(few, world({ contacts: [player([0, 0, 0], { crippled: true })] }));
  assert.notEqual(few.mode, 'board');
});

test('AUDIT NAV1 (online #10) HER SWEEPS: a pirate coming to board a boat lying still gets out her long oars within SWEEP_RANGE of the berth - straight for it, pulled round the short way at SWEEP_TURN at least, through the wind\'s eye as readily as from it, SWEEP_WAY of way whatever the wind (the pace that stops her short of the berth under it). Under sail alone she beat and wore round a wreck 60 m off for two minutes and more in a third of the winds (180 of 512 approaches never closed in 120 s, the player stuck with a hostile ship in sight); now every approach from 60 m in eight winds grapples (mutants: no sweeps, the eye still worn round or tacked, no way under them, their way unpaced, never shipped, the stern approach to a still boat, the sweeps past their range or for a boat under way)', () => {
  const wreck = (o = {}) => player([0, 0, 0], { yaw: 0, hull: HULL.SmallShip, crippled: true, ...o });
  const run = (s, w, limit) => {
    let far = 0;
    for (let t = 0; t < limit; t += w.dt) {
      const o = stepCaptain(s, w);
      far = Math.max(far, Math.hypot(s.pos[0], s.pos[2]));
      if (o.grapple) return { t, far };
    }
    return { t: null, far };
  };
  // the two the audit's sweep lost: the berth dead to windward, and her stern to it with no way on
  for (const [pos, yaw] of [[[23, 0, 55], 68], [[55, 0, -23], 157]]) {
    const s = ship('pirateBrig', { pos, yaw: yaw * DEG });
    const r = run(s, world({ wind: [0, 0, 0.9], contacts: [wreck()] }), 120);
    assert.ok(r.t != null && r.t < 60, `from ${pos} she grapples (${r.t?.toFixed(1)} s)`);
    assert.ok(r.far < 95, `no loop out and back (${r.far.toFixed(0)} m at most)`);
  }
  // eight winds, four bearings, two headings: every one alongside
  let worst = 0;
  for (let wi = 0; wi < 8; wi++) {
    const wa = wi * Math.PI / 4;
    for (let bi = 0; bi < 4; bi++) {
      const ba = bi * Math.PI / 2 + Math.PI / 8;
      for (const turn of [-1, 1]) {
        const s = ship('pirateBrig', { pos: [Math.sin(ba) * 60, 0, Math.cos(ba) * 60], yaw: ba + Math.PI + turn * Math.PI / 2 });
        const r = run(s, world({ wind: [Math.sin(wa) * 0.9, 0, Math.cos(wa) * 0.9], contacts: [wreck()] }), 120);
        assert.ok(r.t != null, `wind ${wi * 45}, bearing ${(bi * 90 + 22.5).toFixed(1)}, turned ${turn}: never alongside`);
        worst = Math.max(worst, r.t);
      }
    }
  }
  assert.ok(worst < 100, `the worst ${worst.toFixed(1)} s`);
  // the laws: out within SWEEP_RANGE of the berth of a boat lying still - straight for it, the short way round
  const s = ship('pirateBrig', { pos: [55, 0, -23], yaw: 157 * DEG });
  const w = world({ wind: [0, 0, 0.9], contacts: [wreck()] });
  stepCaptain(s, w);
  assert.ok(s.sweeps > 0 && s.sweeps <= SWEEP_WAY, `her sweeps out (${s.sweeps})`);
  const y0 = s.yaw;
  steps(s, w, 3);
  assert.ok(s.yaw > y0 && s.turnWay == null, 'round the short way - through the eye, never worn round the long');
  assert.ok(maxTurnRate(s) < SWEEP_TURN * DEG && Math.abs(s.yawRate) > maxTurnRate(s), 'pulled round faster than her way alone would turn her');
  steps(s, w, 12);
  assert.ok(s.speed >= s.sweeps * 0.9 && s.sweeps === SWEEP_WAY, `her way under them (${s.speed.toFixed(2)} m/s)`);
  // straight for the berth - the boat's starboard side, both halves' width and BERTH_GAP off - never the point astern
  // of it a boat under way is met from (from 150 m on her beam that lay 17 degrees off)
  const beam = ship('pirateBrig', { pos: [150, 0, 0], yaw: -90 * DEG });
  const bw = world({ wind: [0, 0, -0.9], contacts: [wreck()] });
  steps(beam, bw, 4);
  const gap = hullBuild(beam.hull).halfWidth + hullBuild(HULL.SmallShip).halfWidth + BERTH_GAP;
  const toBerth = Math.atan2(gap - beam.pos[0], 0 - beam.pos[2]);
  const off = Math.abs(Math.atan2(Math.sin(beam.yaw - toBerth), Math.cos(beam.yaw - toBerth))) / DEG;
  assert.ok(beam.sweeps > 0 && off < 4, `her head on the berth (${off.toFixed(1)} degrees off)`);
  // in irons, the sweeps still carry her
  const irons = ship('pirateBrig', { pos: [0, 0, -120], yaw: 0 });
  const iw = world({ wind: [0, 0, -0.9], contacts: [wreck()] });   // blowing toward the south: the wreck dead to windward
  steps(irons, iw, 20);
  assert.ok(irons.sweeps > 0 && irons.speed > SWEEP_WAY * 0.8 && irons.pos[2] > -110, `into the wind's eye on her sweeps (${irons.speed.toFixed(2)} m/s, ${irons.pos[2].toFixed(0)})`);
  const ironsGap = hullBuild(irons.hull).halfWidth + hullBuild(HULL.SmallShip).halfWidth + BERTH_GAP;
  const upwind = Math.atan2((irons.berthSide || 1) * ironsGap - irons.pos[0], 0 - irons.pos[2]);
  assert.ok(Math.abs(Math.atan2(Math.sin(irons.yaw - upwind), Math.cos(irons.yaw - upwind))) < 10 * DEG, `her head on the berth, not a tack 45 degrees off it (${(irons.yaw / DEG).toFixed(0)} vs ${(upwind / DEG).toFixed(0)})`);
  // near the berth the sweeps' way is the pace that stops her short of it
  const back = BOARD_SAILS.from + SWEEP_WAY ** 2 / (2 * DECEL) * 0.5;   // inside the band where the pace is under SWEEP_WAY
  const close = ship('pirateBrig', { pos: [hullBuild(HULL.SmallShip).halfWidth * 2 + BERTH_GAP, 0, -back], yaw: 0 });   // astern of the berth
  stepCaptain(close, world({ contacts: [wreck()] }));
  const d = Math.hypot(close.pos[0] - (hullBuild(close.hull).halfWidth + hullBuild(HULL.SmallShip).halfWidth + BERTH_GAP), close.pos[2]);
  near(close.sweeps, Math.min(SWEEP_WAY, Math.sqrt(2 * DECEL * Math.max(0, d - BOARD_SAILS.from))), 0.05, 'her sweeps paced to the berth');
  assert.ok(close.sweeps < SWEEP_WAY, `slowing for the berth (${close.sweeps.toFixed(2)})`);
  // past SWEEP_RANGE of the berth, or the boat under way: sail alone
  const far = ship('pirateBrig', { pos: [0, 0, SWEEP_RANGE + 60] });
  stepCaptain(far, world({ contacts: [wreck()] }));
  assert.equal(far.mode, 'board');
  assert.equal(far.sweeps, 0, 'past SWEEP_RANGE: her sails');
  const under = ship('pirateBrig', { pos: [0, 0, 100] });
  stepCaptain(under, world({ contacts: [wreck()] }));
  assert.ok(under.sweeps > 0);
  stepCaptain(under, world({ contacts: [wreck({ vel: [0, 0, GRAPPLE_STILL + 1], speed: GRAPPLE_STILL + 1 })] }));
  assert.equal(under.mode, 'board');
  assert.equal(under.sweeps, 0, 'the boat under way: her sweeps shipped, and she is met under sail, up from astern');
  assert.ok(SWEEP_TURN > PAYOFF_TURN - 1e-9 && SWEEP_RANGE > GRAPPLE_GAP);
});

test('AUDIT NAV1 M1 the wreck: no captain fires on a crippled player\'s boat, and one that will not board her (a navy, Boarders off) leaves her after WRECK_SPARE_S (mutants: the wreck fired on, never left)', () => {
  const n = ship('navyCutter', { yaw: 0 });
  n.provoked.set('me', 0);
  const w = world({ contacts: [player([80, 0, 0], { crippled: true })] });
  let volleys = 0;
  for (let t = 0; t < WRECK_SPARE_S - 1; t += 1) volleys += stepCaptain(n, { ...w, dt: 1 }).volleys.length;
  assert.equal(volleys, 0, 'not a gun fired at a wreck');
  assert.equal(n.mode, 'engage');
  for (let t = 0; t < 3; t += 1) stepCaptain(n, { ...w, dt: 1 });
  assert.equal(n.mode, 'cruise', 'she leaves the wreck');
  assert.ok(n.spare.get('me') > n.clock);
});

// ── the cruise, a prize adrift ─────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV1 M7 the cruise: a waypoint from any quarter but never upwind of close-hauled nor across the land; one reached is let go; with none to be had she goes back the way she came (mutants: the upwind waypoint, the leg unsounded, the fallback)', () => {
  let k = 0;
  const seq = [0.5, 0.1, 0.25, 0.6, 0.9, 0.3, 0.75, 0.05, 0.45, 0.8, 0.15, 0.55];
  const r = () => seq[(k++) % seq.length];
  const wind = [0, 0, 1.5];   // the eye is heading PI
  for (let i = 0; i < 20; i++) {
    const s = ship('merchantGalleon', { yaw: 0 });
    stepCaptain(s, world({ wind, random: r }));
    if (!s.waypoint) continue;
    const a = Math.atan2(s.waypoint[0], s.waypoint[1]);
    assert.ok(Math.abs(wrapTo(a - 0)) <= CLOSE_HAULED * DEG + 1e-9, `never upwind (${(a / DEG).toFixed(0)})`);
  }
  // an island across every leg but one
  const s = ship('merchantGalleon', { yaw: 0 });
  const island = (x, z) => !(Math.hypot(x, z - 500) < 350);
  stepCaptain(s, world({ wind: [1.5, 0, 0], isWater: island, random: () => 0.02 }));
  if (s.waypoint) for (let d = 60; d < Math.hypot(...s.waypoint); d += 60) {
    const a = Math.atan2(s.waypoint[0], s.waypoint[1]);
    assert.ok(island(Math.sin(a) * d, Math.cos(a) * d), 'the leg is open water');
  }
  // reached: let go
  const g = ship('merchantGalleon', { yaw: 0 });
  g.waypoint = [0, WAYPOINT_REACHED - 1];
  stepCaptain(g, world({ wind: [1.5, 0, 0], random: () => 0.02 }));
  assert.ok(!g.waypoint || Math.hypot(g.waypoint[0], g.waypoint[1] - WAYPOINT_REACHED) > 1, 'a new one, or none');
  // a channel's end: back the way she came
  const c = ship('merchantGalleon', { yaw: 0, pos: [0, 0, 400] });
  const channel = (x, z) => z < 0 || (Math.abs(x) < 70 && z < 520);
  stepCaptain(c, world({ wind: [1.5, 0, 0], isWater: channel, random: () => 0.02 }));
  assert.ok(c.waypoint && c.waypoint[1] < 400, `back down the channel (${c.waypoint})`);
});

test('AUDIT NAV1 B11 a prize cast adrift goes where the wind takes her at ADRIFT_SPEED, never onto the land; one merely struck lies hove to (mutants: the drift, the land)', () => {
  const p = ship('merchantGalleon');
  p.damage.takePrize(); p.adrift = true;
  steps(p, world({ wind: [1.5, 0, 0] }), 10);
  near(p.pos[0], ADRIFT_SPEED * 10, 0.2, 'downwind');
  const q = ship('merchantGalleon');
  q.damage.takePrize(); q.adrift = true;
  steps(q, world({ wind: [1.5, 0, 0], isWater: (x) => x < 1 }), 10);
  assert.ok(q.pos[0] < 1, 'not onto the land');
  const s = ship('merchantGalleon');
  s.damage.apply({ hull: Math.ceil(s.damage.maxHull * 0.8), sail: 0, crew: 0 });
  assert.equal(s.damage.state, SHIP_STATES.struck);
  steps(s, world({ wind: [1.5, 0, 0] }), 10);
  near(s.pos[0], 0, 1e-9, 'struck: hove to');
});

// ── the traffic and the host ───────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV1 B1 the traffic\'s berths: only a ship afloat counts against the density - a prize, a struck hulk or a wreck going down fills none, so taking prizes never empties the sea (mutants: every ship counted)', () => {
  const d = createNavalDirector({ random: () => 0.1 });
  const ctx = (ships) => ({ density: DENSITY.few, player: [0, 0, 0], players: null, level: 5, ships, isOpenWater: () => true, nearPort: false, notoriety: 0, seedBase: 7, seaY: 0 });
  const prizes = [{ id: 'a', pos: [100, 0, 0], classId: 'merchantGalleon', engaged: false, afloat: false }, { id: 'b', pos: [0, 0, 100], classId: 'merchantGalleon', engaged: false, afloat: false }];
  const out = d.step(FIRST_ROLL_S + 1, ctx(prizes));
  assert.ok(out.spawn, 'a ship over the horizon though two prizes lie by');
  const e = createNavalDirector({ random: () => 0.1 });
  const full = e.step(FIRST_ROLL_S + 1, ctx(prizes.map((p) => ({ ...p, afloat: true }))));
  assert.equal(full.spawn, null, 'two afloat fill "few"');
  assert.ok(DESPAWN_BEYOND > 0);
});

test('AUDIT NAV1 B1 the host lets a prize go: a boarding won clears her boarded mark and she is no longer "engaged" - out of sight she sails out of the world like any hulk, and the density rolls a new ship (mutants: the mark kept, a prize engaged)', async () => {
  const { host, run, view } = await sea({ hull: 2, settings: { ShipsAtSea: 'few', Boarders: true } });
  const id = host.spawnShip('merchantGalleon', { range: 30, bearing: Math.PI / 2 });
  const e = host._sea.get(id);
  e.ship.damage.apply({ hull: Math.ceil(e.ship.damage.maxHull * 0.8), sail: 0, crew: 0 });
  run(1);
  assert.equal(host.activate(), true, 'grapples away');
  run(3);
  for (const f of host.boarding.foes) f.handle.dead = true;
  run(0.5);
  assert.equal(e.ship.damage.state, SHIP_STATES.prize);
  assert.equal(e.ship.boarded, false, 'the fight is over');
  // out of sight: she goes
  view.feet = [DESPAWN_BEYOND + 500, 0, 0];
  run(2 + SHIP_FADE_S);   // SHIP-FADE (2026-10-02) PIN MOVED: she fades as she goes
  assert.equal(host._sea.has(id), false, 'let go past DESPAWN_BEYOND');
});

test('AUDIT NAV1 M6 the host keeps hulls apart: a ship of mine standing in another hull is pushed out along the shallowest axis (two of mine share it) and her way into it taken off; my own boat is never moved by it (mutants: the push, the way kept, my boat shoved)', async () => {
  const { host, run, boat } = await sea({ hull: 2 });
  const a = host._sea.get(host.spawnShip('merchantGalleon', { range: 200, bearing: 0 }));
  const b = host._sea.get(host.spawnShip('merchantGalleon', { range: 205, bearing: 0 }));
  a.ship.pos = [0, 0, 200]; a.ship.yaw = Math.PI / 2; a.ship.speed = 0;
  b.ship.pos = [6, 0, 204]; b.ship.yaw = Math.PI / 2; b.ship.speed = 0;
  a.ship.course = [5000, 200]; b.ship.course = [5000, 204];
  run(0.1);
  const gap = hullGap(a.ship.pos, a.ship.yaw, a.ship.hull, b.ship.pos, b.ship.yaw, b.ship.hull);
  assert.ok(gap > -0.01, `apart (${gap.toFixed(2)})`);
  // one of mine rammed into my boat's side: she is pushed out, my boat stands
  const c = host._sea.get(host.spawnShip('merchantGalleon', { range: 20, bearing: Math.PI / 2 }));
  c.ship.pos = [14, 0, 0]; c.ship.yaw = -Math.PI / 2; c.ship.speed = 5;
  const before = [...boat.GameObject.position];
  run(0.1);
  assert.deepEqual(boat.GameObject.position, before, 'my boat unmoved');
  assert.ok(hullGap(c.ship.pos, c.ship.yaw, c.ship.hull, [0, 0, 0], 0, 2) > -0.2, 'she stands clear of my hull');
  assert.ok(c.ship.speed < 2, `her way into it taken off (${c.ship.speed.toFixed(2)})`);
});

test('AUDIT NAV1 G9 a galley rams: her stem into a hull at RAM_SPEED or more is the ram\'s own law - my boat takes it on my client (braced, half), a ship of mine is struck - and she takes a share back; RAM_COOLDOWN_S between (mutants: the galley\'s ram never checked, the brace unread)', async () => {
  const { host, run, boat } = await sea({ hull: 2 });
  const g = host._sea.get(host.spawnShip('pirateGalley', { range: 200, bearing: 0 }));
  const b = hullBuild(HULL.LargeGalley);
  g.ship.pos = [0, 0, -(b.bowZ + 2)]; g.ship.yaw = 0; g.ship.speed = RAM_SPEED + 4;
  g.ship.course = [0, 5000];
  const st = () => host.hudModel().ship.hull;
  const h0 = st();
  run(0.3);
  assert.ok(st() < h0, `my hull took the ram (${h0} -> ${st()})`);
  assert.ok(g.ship.damage.hullShare() < 1, 'she takes a share back');
  assert.ok(boat, 'at my helm');
  // braced, the same blow does half
  const b2 = await sea({ hull: 2 });
  const g2 = b2.host._sea.get(b2.host.spawnShip('pirateGalley', { range: 200, bearing: 0 }));
  g2.ship.pos = [0, 0, -(b.bowZ + 2)]; g2.ship.yaw = 0; g2.ship.speed = RAM_SPEED + 4; g2.ship.course = [0, 5000];
  const u = h0 - st();
  b2.host.frame(0.1, { brace: true }); b2.host.frame(0.1, { brace: true }); b2.host.frame(0.1, { brace: true });
  const v = h0 - b2.host.hudModel().ship.hull;
  near(v, u / 2, 0.02, 'braced: half');
});

test('AUDIT NAV1 M8 the sea keeps the world\'s time: a long frame (Come Sail Away\'s time scale) is stepped in FRAME_STEP_S steps up to FRAME_STEPS_MAX - a ship crosses the same water in one 1 s frame as in ten 0.1 s frames (mutants: the one clamped step)', async () => {
  const one = await sea({ hull: null, water: open });
  const a = one.host._sea.get(one.host.spawnShip('merchantGalleon', { range: 300, bearing: 0, yaw: Math.PI / 2 }));
  a.ship.speed = 6; a.ship.course = [9000, 300];
  one.host.frame(1);
  const moved1 = a.ship.pos[0];
  const ten = await sea({ hull: null, water: open });
  const b = ten.host._sea.get(ten.host.spawnShip('merchantGalleon', { range: 300, bearing: 0, yaw: Math.PI / 2 }));
  b.ship.speed = 6; b.ship.course = [9000, 300];
  for (let i = 0; i < 10; i++) ten.host.frame(0.1);
  near(moved1, b.ship.pos[0], 0.05, 'one long frame, ten short ones');
  assert.ok(moved1 > 5, `she sailed a whole second (${moved1.toFixed(2)} m)`);
  assert.ok(FRAME_STEP_S * FRAME_STEPS_MAX >= 1);
});

test('AUDIT NAV1 NAV-R a raider coming alongside to board is chasing me - the Overworld\'s map says so, and losing me spends her (mutants: the board mode unread)', async () => {
  const { host, run, log } = await sea({ hull: 2, settings: { ShipsAtSea: 'off', Boarders: true } });
  host.raiders([{ id: 'r1', seed: 0x51f00d, pos: [300, 0, 0], yaw: Math.PI / 2, ahead: [600, 0, 0] }], { sight: 1000, spent: new Set() });
  run(GRAPPLE_STILL_S + 3);   // SEA-EASE (PIN MOVED): a boat lying still is boarded after GRAPPLE_STILL_S (it was 5 s, the run 8)
  const e = [...host._sea.values()].find((x) => x.raider);
  assert.equal(e.ship.mode, 'board', 'my boat lies still: she comes to board');
  assert.equal(host.raiderShipOf(0x51f00d).chase, true);
  assert.ok(e.raider.chased);
  assert.deepEqual(log.spent, []);
  assert.ok(ACCEL > 0 && FIRST_ROLL_S > 0 && broadsideReach(e.ship, 0) > 0);
});
