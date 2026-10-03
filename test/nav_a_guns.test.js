// NAV-A (2026-09-28, Mac: "proper naval combat with a huge reference to assassins creed black flag. Being able to aim
// and fire when viewing from the side") - THE GUNS: the closed-form flight, the aim a look lays, the volley, the
// reload, and what a ball does to a ship (bible/03-World/Naval-Combat.md). Pure modules, driven directly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SHOT_GRAVITY, launchVelocity, shotPosition, shotVelocity, timeToHeight, landing, rangeAt, elevationForRange, maxRange, arcPoints,
  orientedBox, toBoxLocal, segmentBoxEntry, segmentCrossesDown, volleyRandom, scatter, flatUnit, raySeaHit, NAVAL_DEG,
} from '../src/systems/naval/navalBallistics.js';
import {
  BOW_ARC, STERN_ARC, RIPPLE_S, RELOAD_UNDERMANNED, RELOAD_SINGLEHANDED, BARREL_DROP_S,
  bearingOf, sideForBearing, aimSolution, volleyLaunches, reloadSeconds, createGunDeck,
} from '../src/systems/naval/navalGunnery.js';
import { GUNS, BARREL, batteryOf, batteriesOf, HULL_BUILDS, SHIP_TOUGHNESS } from '../src/systems/naval/navalShips.js';
import {
  SHIP_STATES, STRUCK_AT, SINK_SECONDS, WATERLINE_BAND, HOLED_BONUS, FIRE_HP, FIRE_SECONDS, FIRE_STACK, FIRE_SAIL, FIRE_CREW_S, BRACE_TAKEN, BARE_POLES,
  hitZone, shotDamage, createShipDamage, repairCost, REPAIR_PRICE,
} from '../src/systems/naval/navalDamage.js';
import { createShotField, insideGrown, BALL_LIFE, BARREL_ARM, FLOTSAM_LIFE, FLOTSAM_REACH } from '../src/systems/naval/navalShots.js';

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} vs ${b} (±${eps})`);
const ID = [0, 0, 0, 1];
const yawQuat = (a) => [0, Math.sin(a / 2), 0, Math.cos(a / 2)];

test('NAV-A the flight is a closed form: p(t) = p0 + v0 t - g t^2/2, its velocity, the later root through a height (null when the arc never reaches it), the landing on the sea and the arc the aim draws ending on it (mutants: the half dropped, the earlier root taken, the sign of g)', () => {
  const p0 = [1, 5, -2], v0 = [3, 10, 4];
  assert.deepEqual(shotPosition(p0, v0, 0), [1, 5, -2]);
  const p = shotPosition(p0, v0, 2);
  near(p[0], 7, 1e-12); near(p[1], 5 + 20 - 0.5 * SHOT_GRAVITY * 4, 1e-12); near(p[2], 6, 1e-12);
  assert.deepEqual(shotVelocity(v0, 2).map((v) => +v.toFixed(6)), [3, +(10 - 2 * SHOT_GRAVITY).toFixed(6), 4]);
  // down through y 0 from 5 m rising at 10: the LATER root
  const t = timeToHeight(5, 10, 0);
  near(5 + 10 * t - 0.5 * SHOT_GRAVITY * t * t, 0, 1e-9, 'on the height');
  assert.ok(t > 10 / SHOT_GRAVITY, 'past the apex - the fall, not the rise');
  assert.equal(timeToHeight(0, 5, 100), null, 'a height the arc never reaches');
  near(timeToHeight(3, 0, 3), 0, 1e-12, 'launched level at the height itself: now');
  const l = landing(p0, v0, 0);
  near(l.point[1], 0, 1e-9); near(l.t, t, 1e-12);
  const arc = arcPoints(p0, v0, 0, 9);
  assert.equal(arc.length, 9);
  assert.deepEqual(arc[0], p0);
  near(arc[8][1], 0, 1e-9, 'the last point is the landing');
  near(SHOT_GRAVITY, 9.81, 0);
});

test('NAV-A the lay: the LOW arc that lands a range (checked back through rangeAt), the carriage\'s top past the reach, its bottom for nothing ahead; the longest shot at the top or 45 degrees; the carry rides every ball (mutants: the high arc, the discriminant\'s sign, the clamp dropped, no carry)', () => {
  const g = GUNS.long;
  const lo = g.minEl * NAVAL_DEG, hi = g.maxEl * NAVAL_DEG;
  for (const range of [60, 120, 180]) {
    const e = elevationForRange(range, g.speed, 4.5, lo, hi);
    near(rangeAt(e, g.speed, 4.5), range, 0.01, `range ${range}`);
    assert.ok(e < 45 * NAVAL_DEG, 'the low arc');
  }
  assert.equal(elevationForRange(5000, g.speed, 4.5, lo, hi), hi, 'past its reach: the carriage at its top');
  assert.equal(elevationForRange(0, g.speed, 4.5, lo, hi), lo);
  assert.equal(elevationForRange(-10, g.speed, 4.5, lo, hi), lo);
  assert.equal(elevationForRange(1, g.speed, 4.5, lo, hi), lo, 'nearer than the carriage can depress: its bottom');
  near(maxRange(g.speed, 4.5, hi), rangeAt(hi, g.speed, 4.5), 1e-9);
  near(maxRange(g.speed, 4.5, 80 * NAVAL_DEG), rangeAt(45 * NAVAL_DEG, g.speed, 4.5), 1e-9, 'a carriage past 45 throws its longest at 45');
  // the long gun's band from a Small Ship's deck, as the bible's table reads it
  near(rangeAt(lo, g.speed, 4.5), 26, 1, 'lowest (AUDIT NAV1: the quoins out to -8)'); near(maxRange(g.speed, 4.5, hi), 211, 1, 'longest');
  const v = launchVelocity([2, 7, 0], 30 * NAVAL_DEG, 50, [1, 0, -3]);
  near(v[0], Math.cos(30 * NAVAL_DEG) * 50 + 1, 1e-9, 'the direction renormalised flat, its y ignored');
  near(v[1], Math.sin(30 * NAVAL_DEG) * 50, 1e-9);
  near(v[2], -3, 1e-9, 'the deck\'s way carried');
});

test('NAV-A what a ball meets: an oriented box through a node\'s matrix, a point in its frame, a segment\'s first entry (the ball\'s radius grown on), a start inside at nought, a miss null; the crossing down through the sea; a ray\'s point on the sea (mutants: the slab\'s swap, the radius ignored, t1 for t0)', () => {
  // a box 2 x 1 x 4 (half) at (10, 0, 0), turned a quarter about up
  const a = Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
  const m = [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 10, 0, 0, 1];
  const box = orientedBox(m, [0, 1, 0], [2, 1, 4]);
  assert.deepEqual(box.c.map((v) => +v.toFixed(9)), [10, 1, 0]);
  assert.deepEqual(box.h, [2, 1, 4]);
  near(box.az[0], 1, 1e-9, 'its z along the world x');
  assert.deepEqual(toBoxLocal(box, [14, 1, 0]).map((v) => +v.toFixed(9)), [0, 0, 4]);
  const hit = segmentBoxEntry([0, 1, 0], [20, 1, 0], box);
  near(hit.t, 6 / 20, 1e-9, 'enters at x 6');
  near(hit.point[0], 6, 1e-9);
  near(hit.local[2], -4, 1e-9, 'on the box\'s own face');
  near(segmentBoxEntry([0, 1, 0], [20, 1, 0], box, 0.5).t, 5.5 / 20, 1e-9, 'the ball\'s radius grows the box');
  assert.equal(segmentBoxEntry([0, 5, 0], [20, 5, 0], box), null, 'over it');
  assert.equal(segmentBoxEntry([10, 1, 0], [11, 1, 0], box).t, 0, 'begun inside');
  near(segmentCrossesDown([0, 3, 0], [0, -1, 0], 0), 0.75, 1e-12);
  assert.equal(segmentCrossesDown([0, -1, 0], [0, 3, 0], 0), null, 'going up is no landing');
  const r = raySeaHit([0, 10, 0], [0.6, -0.8, 0], 2);
  near(r.distance, 10, 1e-9); near(r.point[0], 6, 1e-9); near(r.point[1], 2, 1e-9);
  assert.equal(raySeaHit([0, 10, 0], [1, 0, 0], 2), null, 'a level look never meets it');
  assert.equal(raySeaHit([0, 10, 0], [0, 0.5, 0.5], 2), null);
  assert.equal(flatUnit([0, 5, 0]), null);
  assert.deepEqual(flatUnit([3, 9, 4]), [0.6, 0, 0.8]);
});

test('NAV-A the scatter is seeded: one volley\'s seed scatters it the same way on every client, within the gun\'s spread, peaked at the lay; another seed another way (mutants: an unseeded draw, the spread unscaled)', () => {
  const a = volleyRandom(1234), b = volleyRandom(1234), c = volleyRandom(99);
  const sa = [a(), a(), a()], sb = [b(), b(), b()], sc = [c(), c(), c()];
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
  const rand = volleyRandom(7);
  let maxYaw = 0, maxPitch = 0, sumAbs = 0;
  for (let i = 0; i < 2000; i++) {
    const s = scatter([0, 0, 1], 0.1, 2, 1, rand);
    const yaw = Math.abs(Math.atan2(s.dir[0], s.dir[2])) / NAVAL_DEG;
    maxYaw = Math.max(maxYaw, yaw); maxPitch = Math.max(maxPitch, Math.abs(s.elevation - 0.1) / NAVAL_DEG);
    sumAbs += yaw;
    near(Math.hypot(...s.dir), 1, 1e-9, 'still a unit');
  }
  assert.ok(maxYaw <= 2 && maxYaw > 1.6, `the yaw within its spread and reaching it (${maxYaw})`);
  assert.ok(maxPitch <= 1 && maxPitch > 0.8, `the pitch within its spread (${maxPitch})`);
  near(sumAbs / 2000, 2 / 3, 0.06, 'a triangular spread: the mean distance a third of the way');
});

test('NAV-A which battery bears: the look\'s bearing off the bow (positive to starboard), the bow within BOW_ARC, the stern within STERN_ARC, the sides between; the ship\'s turn turns it (mutants: the sign, an arc\'s edge)', () => {
  assert.equal(BOW_ARC, 35); assert.equal(STERN_ARC, 40);
  near(bearingOf([0, 0, 1], ID), 0, 1e-9);
  near(bearingOf([1, 0, 0], ID), 90, 1e-9, 'starboard is +x at no turn');
  near(bearingOf([-1, 0, 0], ID), -90, 1e-9);
  near(bearingOf([1, 0, 0], yawQuat(Math.PI / 2)), 0, 1e-9, 'a ship turned to +x looks over her bow');
  assert.equal(bearingOf([0, 1, 0], ID), 0, 'straight up bears nothing');
  assert.equal(sideForBearing(0), 'bow');
  assert.equal(sideForBearing(BOW_ARC), 'bow');
  assert.equal(sideForBearing(BOW_ARC + 0.01), 'starboard');
  assert.equal(sideForBearing(-(BOW_ARC + 0.01)), 'port');
  assert.equal(sideForBearing(180 - STERN_ARC - 0.01), 'starboard');
  assert.equal(sideForBearing(180 - STERN_ARC), 'stern');
  assert.equal(sideForBearing(-179), 'stern');
});

test('NAV-A the aim: a look that meets the sea lays the side\'s guns to fall there - the zone at the look\'s range, every landing on the sea, a muzzle a gun; over the horizon the longest shot (AUDIT NAV1: toward it the lay goes on AIM_SLOPE a degree - test/navaudit_helm.test.js); a barrel rolled under the stern; a side with no guns none (mutants: the range measured from the eye, the look ignored, the carriage\'s top on a near look)', () => {
  const ship = { position: [0, 0, 0], rotation: ID, velocity: [0, 0, 0], hull: 2 };
  const seaY = 0;
  // look from 6 m up, out to starboard to meet the sea 60 m from the guns
  const bat = batteryOf(2, 'starboard');
  const cx = bat.muzzles.reduce((s, m) => s + m[0], 0) / bat.muzzles.length;
  const target = [cx + 60, 0, 0], eye = [0, 6, 0];
  const d = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]], dl = Math.hypot(...d);
  const aim = aimSolution(ship, 'starboard', { origin: eye, dir: d.map((v) => v / dl) }, seaY);
  assert.equal(aim.side, 'starboard'); assert.equal(aim.gun, 'long'); assert.equal(aim.barrel, false);
  assert.equal(aim.launches.length, 6, 'six long guns a side on a Small Ship');
  assert.deepEqual(aim.dir.map((v) => +v.toFixed(9) + 0), [1, 0, 0], 'fired square to starboard');
  near(aim.range, 60, 1.5, 'the zone where the look meets the sea');
  near(aim.lookPoint[0], target[0], 1e-9, 'the look\'s own point on the sea');
  for (const l of aim.landings) near(l.point[1], seaY, 1e-9);
  assert.ok(aim.elevation < GUNS.long.maxEl * NAVAL_DEG);
  assert.ok(aim.width >= 2);
  // the horizon: the guns at their highest, the zone at their longest
  const far = aimSolution(ship, 'starboard', { origin: eye, dir: [1, 0.1, 0] }, seaY);
  near(far.elevation, GUNS.long.maxEl * NAVAL_DEG, 1e-12);
  near(far.range, far.maxRange, 2);
  // the stern of a Small Ship rolls a barrel
  const stern = aimSolution(ship, 'stern', null, seaY);
  assert.equal(stern.barrel, true);
  assert.equal(stern.landings.length, 1);
  near(stern.landings[0].point[1], seaY, 0);
  assert.equal(aimSolution({ ...ship, hull: 0 }, 'starboard', null, seaY), null, 'a rowboat has no guns');
  assert.equal(batteriesOf(0).length, 0);
  // a lay for a world point (the AI's lead) with no look
  const lead = aimSolution(ship, 'starboard', null, seaY, { target: [cx + 90, 0, 0] });
  near(lead.range, 90, 1.5);
});

test('NAV-A the volley: a launch a muzzle, a gun every RIPPLE_S from the first at once, the same balls from the same seed, a crack crew\'s spread tighter than a poor one\'s, the deck\'s way carried (mutants: the ripple dropped, skill unscaled, the seed ignored)', () => {
  const ship = { position: [0, 0, 0], rotation: ID, velocity: [0, 0, 0], hull: 4 };
  const aim = aimSolution(ship, 'port', null, 0, { range: 100 });
  const a = volleyLaunches(aim, 42, { skill: 0.5 }), b = volleyLaunches(aim, 42, { skill: 0.5 });
  assert.equal(a.length, 7, 'seven long guns a side on the Carrack');
  assert.deepEqual(a, b);
  assert.notDeepEqual(volleyLaunches(aim, 43, { skill: 0.5 }), a);
  a.forEach((l, i) => near(l.delay, i * RIPPLE_S, 1e-12));
  assert.equal(RIPPLE_S, 0.09);
  const spreadOf = (skill) => {
    let m = 0;
    for (let seed = 1; seed < 60; seed++) for (const l of volleyLaunches(aim, seed, { skill })) m = Math.max(m, Math.abs(Math.atan2(l.v0[2], -l.v0[0])));
    return m;
  };
  assert.ok(spreadOf(1) < spreadOf(0) * 0.5, 'a crack crew throws tighter');
  const carried = volleyLaunches(aim, 42, { skill: 0.5, carry: [0, 0, 5] });
  near(carried[0].v0[2] - a[0].v0[2], 5, 1e-9);
  assert.deepEqual(volleyLaunches(aimSolution(ship, 'stern', null, 0), 1), [], 'a barrel is no volley');
});

test('NAV-A the reload: the gun\'s own at a full crew, RELOAD_UNDERMANNED slower as the crew thins, RELOAD_SINGLEHANDED with no crew, a barrel\'s drop its own; the deck fires, reloads, braces, spends barrels, and keeps its clocks (mutants: the crew share inverted, a battery ready while braced)', () => {
  near(reloadSeconds('long', 1, true), GUNS.long.reload, 1e-12);
  near(reloadSeconds('long', 0, true), GUNS.long.reload * (1 + RELOAD_UNDERMANNED), 1e-12);
  near(reloadSeconds('long', 0.5, true), GUNS.long.reload * (1 + RELOAD_UNDERMANNED / 2), 1e-12);
  near(reloadSeconds('swivel', 1, false), GUNS.swivel.reload * RELOAD_SINGLEHANDED, 1e-12);
  assert.equal(reloadSeconds('barrel', 0, false), BARREL_DROP_S);
  let crew = 1;
  const deck = createGunDeck(2, { crewed: true, crewShare: () => crew });
  assert.equal(deck.ready('starboard'), true);
  assert.equal(deck.progress('starboard'), 1);
  deck.fired('starboard');
  assert.equal(deck.ready('starboard'), false);
  near(deck.left('starboard'), GUNS.long.reload, 1e-12);
  deck.step(GUNS.long.reload / 2);
  near(deck.progress('starboard'), 0.5, 1e-9);
  deck.step(GUNS.long.reload / 2);
  assert.equal(deck.ready('starboard'), true);
  crew = 0;
  deck.fired('port');
  near(deck.left('port'), GUNS.long.reload * (1 + RELOAD_UNDERMANNED), 1e-12, 'the crew read at the shot');
  deck.braced = true;
  assert.equal(deck.ready('starboard'), false, 'no gun fires braced');
  deck.braced = false;
  assert.equal(deck.barrels, BARREL.stock);
  for (let i = 0; i < BARREL.stock; i++) { assert.equal(deck.ready('stern'), true); deck.fired('stern'); deck.step(BARREL_DROP_S); }
  assert.equal(deck.barrels, 0);
  assert.equal(deck.ready('stern'), false, 'no barrels, no roll');
  assert.equal(deck.ready('bow'), true);
  const snap = deck.snapshot();
  const other = createGunDeck(2);
  other.restore(snap);
  assert.deepEqual(other.snapshot(), snap);
  other.restore({ clocks: { starboard: 1e9, port: -4, bow: NaN }, barrels: 1e6 });
  assert.equal(other.left('starboard'), 60, 'a clock bounded');
  assert.equal(other.left('port'), 0);
  assert.equal(other.barrels, 99);
});

test('NAV-A where a ball strikes her hull: within WATERLINE_BAND of the sea, by the height of the point it struck, holed, else the hull (her rigging is a target of its own - AUDIT NAV1, test/navaudit_guns.test.js); what each does - canvas and a man in the rig, HOLED_BONUS below the waterline, BRACE_TAKEN braced, each ball 85-115% (mutants: the band\'s edge, the bonus, the brace)', () => {
  assert.equal(hitZone(1), 'holed', 'a metre over the sea');
  assert.equal(hitZone(WATERLINE_BAND), 'holed');
  assert.equal(hitZone(WATERLINE_BAND + 0.01), 'hull');
  assert.equal(hitZone(9), 'hull', 'her castle, her deck: hull');
  const g = GUNS.long;
  assert.deepEqual(shotDamage(g, 'hull', { roll: 0.5 }), { hull: g.hull, sail: Math.round(g.sail * 0.25), crew: g.crew });
  assert.deepEqual(shotDamage(g, 'holed', { roll: 0.5 }), { hull: Math.round(g.hull * (1 + HOLED_BONUS)), sail: Math.round(g.sail * 0.25), crew: g.crew });
  assert.deepEqual(shotDamage(g, 'rig', { roll: 0.5 }), { hull: 0, sail: Math.round(Math.max(g.sail * 2, g.hull * 0.5)), crew: 1 });
  assert.equal(shotDamage(g, 'hull', { roll: 0.5, braced: true }).hull, Math.round(g.hull * BRACE_TAKEN));
  assert.equal(shotDamage(g, 'hull', { roll: 0 }).hull, Math.round(g.hull * 0.85));
  assert.equal(shotDamage(g, 'hull', { roll: 1 }).hull, Math.round(g.hull * 1.15));
  assert.equal(shotDamage(GUNS.chain, 'rig', { roll: 0.5 }).sail, GUNS.chain.sail * 2, 'chain shot for the canvas');
});

test('NAV-A a ship\'s life: she strikes her colours at STRUCK_AT, sinks at nought over SINK_SECONDS and is gone; each fire burns FIRE_HP a second for FIRE_SECONDS, eating FIRE_SAIL of canvas a second and a man each FIRE_CREW_S, and a second fire burns beside the first (AUDIT NAV1 - up to FIRE_STACK); her way BARE_POLES bare; a player\'s boat is WRECKED, never sunk, and floats again repaired (mutants: the threshold\'s edge, a fire topping up, a player sinking)', () => {
  const d = createShipDamage({ hullHp: 400, sailHp: 100, crew: 20 });
  assert.equal(d.state, SHIP_STATES.afloat);
  assert.equal(d.apply({ hull: 400 - 400 * STRUCK_AT - 1, sail: 0, crew: 0 }, 1), null, 'one over the line: afloat');
  assert.equal(d.apply({ hull: 1, sail: 0, crew: 0 }, 2), SHIP_STATES.struck);
  assert.equal(d.fighting(), false);
  assert.equal(d.apply({ hull: 1000, sail: 0, crew: 0 }, 3), SHIP_STATES.sinking);
  assert.equal(d.step(SINK_SECONDS - 0.01, 4), null);
  assert.equal(d.step(0.02, 5), SHIP_STATES.sunk);
  assert.equal(d.apply({ hull: 5, sail: 0, crew: 0 }), null, 'the sunk take nothing');
  // the fire
  const f = createShipDamage({ hullHp: 100, sailHp: 50, crew: 5 });
  f.apply({ hull: 0, sail: 0, crew: 0, fire: true });
  near(f.fire, FIRE_SECONDS, 0);
  f.step(4);
  near(f.hull, 100 - FIRE_HP * 4, 1e-9);
  near(f.sail, 50 - FIRE_SAIL * 4, 1e-9, 'the canvas burns too');
  f.apply({ hull: 0, sail: 0, crew: 0, fire: true });
  assert.equal(f.fires, 2, 'a second fire burns beside the first');
  near(f.fire, FIRE_SECONDS, 0);
  f.step(100);
  near(f.hull, 100 - FIRE_HP * FIRE_SECONDS * 2, 1e-9, 'each out after its own seconds');
  // PIN MOVED (TOUGHER-SHIPS): a man's worth each FIRE_CREW_S of burning, a toughened crew losing 1/SHIP_TOUGHNESS of a man for it
  assert.equal(f.crew, 5 - Math.floor(Math.floor(FIRE_SECONDS * 2 / FIRE_CREW_S) / SHIP_TOUGHNESS), 'a man\'s worth each FIRE_CREW_S of burning');
  assert.equal(f.fires, 0);
  assert.ok(FIRE_STACK >= 2);
  // the way
  const w = createShipDamage({ hullHp: 100, sailHp: 80, crew: 5 });
  near(w.wayShare(), 1, 0);
  w.apply({ hull: 0, sail: 80, crew: 0 });
  near(w.wayShare(), BARE_POLES, 1e-12);
  w.apply({ hull: 0, sail: 0, crew: 0 }); w.repair({ sail: 40, hull: 0, crew: 0 });
  near(w.wayShare(), BARE_POLES + (1 - BARE_POLES) * 0.5, 1e-12);
  // the player's
  const p = createShipDamage({ hullHp: 150, sailHp: 60, crew: 0, player: true });
  assert.equal(p.apply({ hull: 120, sail: 0, crew: 0 }), null, 'a boat of mine never strikes');
  assert.equal(p.apply({ hull: 500, sail: 0, crew: 0 }), SHIP_STATES.wrecked);
  p.step(100);
  assert.equal(p.state, SHIP_STATES.wrecked, 'never sinks');
  p.repair({ hull: 10 });
  assert.equal(p.state, SHIP_STATES.afloat);
  // taken and scuttled
  const t = createShipDamage({ hullHp: 100, sailHp: 10, crew: 4 });
  t.apply({ hull: 80, sail: 0, crew: 0 });
  t.takePrize();
  assert.equal(t.state, SHIP_STATES.prize);
  assert.equal(t.apply({ hull: 50, sail: 0, crew: 0 }), null, 'a prize takes no more');
  t.scuttle();
  assert.equal(t.state, SHIP_STATES.sinking);
});

test('NAV-A the record: a snapshot back bounded to the ship\'s own numbers and a state it can be in (a player\'s boat afloat or wrecked, nothing else); the shipwright prices what is missing (mutants: the bounds dropped, a player restored sunk)', () => {
  const d = createShipDamage({ hullHp: 200, sailHp: 50, crew: 10 });
  d.apply({ hull: 50, sail: 10, crew: 3, fire: true });
  const snap = d.snapshot();
  assert.deepEqual(snap, { hull: 150, sail: 40, crew: 7, fire: FIRE_SECONDS, state: SHIP_STATES.afloat });
  const e = createShipDamage({ hullHp: 200, sailHp: 50, crew: 10 });
  e.restore(snap);
  assert.deepEqual(e.snapshot(), snap);
  e.restore({ hull: 1e9, sail: -5, crew: 3.7, fire: 99, state: 'haunted' });
  assert.deepEqual(e.snapshot(), { hull: 200, sail: 0, crew: 4, fire: FIRE_SECONDS, state: SHIP_STATES.afloat });
  const p = createShipDamage({ hullHp: 100, sailHp: 10, crew: 0, player: true });
  p.restore({ hull: 50, sail: 5, crew: 0, fire: 0, state: SHIP_STATES.sunk });
  assert.equal(p.state, SHIP_STATES.afloat, 'a player\'s boat is never restored sunk');
  p.restore({ hull: 0, sail: 5, crew: 0, fire: 0, state: SHIP_STATES.afloat });
  assert.equal(p.state, SHIP_STATES.wrecked);
  const q = createShipDamage({ hullHp: 100, sailHp: 40, crew: 10 });
  q.apply({ hull: 30, sail: 10, crew: 2 });
  assert.equal(repairCost(q), 30 * REPAIR_PRICE.hull + 10 * REPAIR_PRICE.sail + 2 * REPAIR_PRICE.crew);
  assert.equal(repairCost(null), 0);
});

test('NAV-A the hulls\' batteries as HULL_BUILDS measures them: a rowboat none, the Large Boat swivels, the Small Ship and the Carrack long guns, chain chasers and a barrel, the Galley great guns on the bow - and every muzzle on its own side of the keel (mutants: a side\'s muzzles mirrored)', () => {
  const kinds = (h) => Object.fromEntries(batteriesOf(h).map((b) => [b.side, `${b.gun}x${b.muzzles.length}`]));
  assert.deepEqual(kinds(0), {});
  assert.deepEqual(kinds(1), { starboard: 'swivelx3', port: 'swivelx3', bow: 'swivelx1' });
  assert.deepEqual(kinds(2), { starboard: 'longx6', port: 'longx6', bow: 'chainx2', stern: 'barrelx1' });
  assert.deepEqual(kinds(3), { starboard: 'longx4', port: 'longx4', bow: 'heavyx3' });
  assert.deepEqual(kinds(4), { starboard: 'longx7', port: 'longx7', bow: 'chainx2', stern: 'barrelx1' });
  for (let h = 1; h < HULL_BUILDS.length; h++) {
    for (const m of batteryOf(h, 'starboard').muzzles) assert.ok(m[0] > 0, `hull ${h}: a starboard muzzle on the starboard side`);
    for (const m of batteryOf(h, 'port').muzzles) assert.ok(m[0] < 0, `hull ${h}: a port muzzle on the port side`);
  }
});

// ── the shot in flight, and what floats ─────────────────────────────────────────────────────────────────────────

/** A ship as the shots see her: an unturned box at `c`, half `h`, her centre `overSea` over the sea. */
const shipBox = (id, c, h = [3, 3, 8], overSea = 1) => ({ id, box: orientedBox([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, c[0], c[1], c[2], 1], [0, 0, 0], h), overSea });
const ball = (o = {}) => ({ gun: 'long', index: 0, p0: [0, 2, 0], v0: [60, 1.5, 0], delay: 0, ...o });
function field(targets = [], o = {}) {
  const events = [];
  const f = createShotField({ seaY: () => 0, targets: () => targets, onEvent: (e) => events.push(e), random: () => 0.25, ...o });
  return { f, events, of: (t) => events.filter((e) => e.type === t) };
}

test('NAV-A the ball in flight: each gun\'s ball waits its ripple and appears at its muzzle - the event the host smokes and flashes - flies its closed form, and meets the NEAREST of what lies on its sweep: a ship\'s box (never her own - it leaves through her planking), the ground, the sea; past BALL_LIFE it is gone (mutants: the ripple ignored, the shooter struck by her own ball, the far ship first)', () => {
  const near1 = shipBox('near', [50, 1, 0]), far1 = shipBox('far', [100, 1, 0]), own = shipBox('own', [0, 1, 0]);
  const { f, events, of } = field([far1, own, near1]);
  f.fireVolley({ id: 7, shooter: 'own', launches: [ball(), ball({ index: 1, delay: 0.5, p0: [0, 2, 2] })], side: 'starboard', owner: 'me' });
  f.step(0.1);
  assert.equal(of('muzzle').length, 1, 'the first gun at once');
  assert.deepEqual(of('muzzle')[0], { type: 'muzzle', volley: 7, shooter: 'own', owner: 'me', side: 'starboard', gun: 'long', index: 0, count: 2, pos: [0, 2, 0], dir: [60, 1.5, 0], resolve: true });   // AUDIT NAV1: the volley's size - the mix's
  assert.equal(f.balls().length, 1, 'the second waits its ripple, unseen');
  assert.equal(f.inFlight, 2);
  for (let i = 0; i < 20; i++) f.step(0.1);
  assert.equal(of('muzzle').length, 2);
  const hits = of('hit');
  assert.equal(hits.length, 2);
  assert.ok(hits.every((h) => h.target === 'near'), 'the nearest, and never her own');
  assert.ok(Math.abs(hits[0].point[0] - (50 - 3 - GUNS.long.radius)) < 1e-6, `at her planking (${hits[0].point[0]})`);
  assert.ok(['hull', 'rig', 'holed'].includes(hits[0].zone));
  assert.equal(hits[0].resolve, true);
  assert.equal(f.inFlight, 0);
  // two hulls inside ONE sweep (a long frame): the nearer is met, whatever order the targets come in
  const one = field([shipBox('behind', [40, 1, 0]), shipBox('before', [20, 1, 0])]);
  one.f.fireVolley({ id: 8, shooter: 'x', launches: [ball()] });
  one.f.step(1);
  assert.deepEqual(one.of('hit').map((h) => h.target), ['before'], 'the nearer of two in one sweep');
  // the sea and the ground
  const s = field();
  s.f.fireVolley({ id: 1, shooter: 'x', launches: [ball({ v0: [10, -5, 0] })] });
  for (let i = 0; i < 20; i++) s.f.step(0.05);
  assert.equal(s.of('splash').length, 1);
  assert.equal(s.of('splash')[0].point[1], 0, 'on the sea');
  const g = field([], { ground: (p) => p[0] > 30 });
  g.f.fireVolley({ id: 2, shooter: 'x', launches: [ball()] });
  for (let i = 0; i < 10; i++) g.f.step(0.1);
  assert.equal(g.of('land').length, 1);
  assert.ok(g.of('land')[0].point[0] > 30 && g.of('land')[0].point[0] <= 30 + 4, 'where the ground rises, to a step');
  // a ball aimed at the sky is gone after its life
  const sky = field();
  sky.f.fireVolley({ id: 3, shooter: 'x', launches: [ball({ v0: [0, 200, 0] })] });
  for (let i = 0; i <= BALL_LIFE * 2 + 2; i++) sky.f.step(0.5);
  assert.equal(sky.f.inFlight, 0);
  assert.deepEqual(sky.events.map((e) => e.type), ['muzzle', 'gone'], 'never landed - gone, and said so (AUDIT NAV1: the tally counts it down)');
});

test('NAV-A another client\'s volley is drawn here, never judged: the same balls from the same launches, their hits raised with resolve false; the origin\'s move carries every ball and floater; a clear takes them all (mutants: resolve dropped, the launch left behind)', () => {
  const { f, of } = field([shipBox('ship', [30, 1, 0])]);
  f.fireVolley({ id: 9, shooter: 'peer', launches: [ball()], resolve: false });
  for (let i = 0; i < 10; i++) f.step(0.1);
  assert.equal(of('hit').length, 1);
  assert.equal(of('hit')[0].resolve, false);
  const o = field();
  o.f.fireVolley({ id: 1, shooter: 'x', launches: [ball({ delay: 5 })] });
  o.f.dropFlotsam({ id: 'c', pos: [5, 0, 5] });
  o.f.offsetAll([100, 0, -50]);
  o.f.step(5.01);
  assert.deepEqual(o.of('muzzle')[0].pos, [100, 2, -50], 'the launch moved with the world');
  assert.deepEqual(o.f.floaters()[0].pos.filter((_, i) => i !== 1), [105, -45]);
  o.f.clear();
  assert.deepEqual([o.f.inFlight, o.f.floaters().length], [0, 0]);
});

test('NAV-A what floats: a fire barrel bobs where it was rolled, harmless for BARREL_ARM, then the first ship but its own within BARREL.fuse sets it off; its life out, it sinks. A sunk ship\'s cask floats FLOTSAM_LIFE and the first collector within FLOTSAM_REACH hauls it in (mutants: armed at once, its own stern set it off, the reach ignored)', () => {
  const them = shipBox('them', [0, 1, BARREL.fuse + 8 - 1]), own = shipBox('own', [0, 1, 0]);
  const { f, events, of } = field([own, them]);
  f.dropBarrel({ id: 'b1', shooter: 'own', pos: [0, 0, 0], owner: 'me' });
  f.step(BARREL_ARM - 0.1);
  assert.equal(of('blast').length, 0, 'not armed yet - and never for her own stern');
  const y = f.floaters()[0].pos[1];
  assert.ok(Math.abs(y) <= 0.15, 'bobbing on the sea');
  f.step(0.2);
  assert.deepEqual(of('blast').map((e) => [e.id, e.target, e.shooter, e.owner, e.resolve]), [['b1', 'them', 'own', 'me', true]]);
  assert.equal(f.floaters().length, 0);
  const lone = field([own]);
  lone.f.dropBarrel({ id: 'b2', shooter: 'own', pos: [0, 0, 0] });
  lone.f.step(BARREL.life + 1);
  assert.deepEqual(lone.events.map((e) => e.type), ['sink'], 'out of fuse and life');
  // flotsam
  const mine = { id: 'mine', box: shipBox('mine', [0, 1, 20]).box };
  let collectors = [];
  const c = field([], { collectors: () => collectors });
  c.f.dropFlotsam({ id: 'cask', pos: [0, 0, 20 + 8 + FLOTSAM_REACH + 1], lot: 2, from: 's9' });
  c.f.step(1);
  assert.equal(c.events.length, 0, 'no collector');
  collectors = [mine];
  c.f.step(1);
  assert.equal(c.events.length, 0, 'out of reach');
  c.f.offsetAll([0, 0, -2]);
  c.f.step(1);
  assert.deepEqual(c.of('pickup').map((e) => [e.id, e.lot, e.from, e.collector]), [['cask', 2, 's9', 'mine']]);
  const lost = field();
  lost.f.dropFlotsam({ id: 'cask2', pos: [0, 0, 0] });
  lost.f.step(FLOTSAM_LIFE + 1);
  assert.deepEqual(lost.of('sink').map((e) => e.kind), ['flotsam']);
  assert.equal(insideGrown(mine.box, [0, 1, 20 + 8 + FLOTSAM_REACH], FLOTSAM_REACH), true);
  assert.equal(insideGrown(mine.box, [0, 1, 20 + 8 + FLOTSAM_REACH + 0.01], FLOTSAM_REACH), false);
});
