// AUDIT NAV1 (2026-09-29, Mac: "Lets do a deep comprehensive audit and ensure this is perfection. I want ship movement
// and combat to flow perfectly, just like assisins creed black flag") - THE GUNS: the captains' gunnery and the tell
// before it (the run-out), what a ball does and to what, fire, the prize kept a prize, the readout's warning and tally.
// The law is bible/03-World/Naval-Combat.md "AUDIT NAV1 - The guns"; the measurements behind it are recorded there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RUN_OUT_S, RUN_OUT_DEG, RUN_IN_DEG, RUN_OUT_WAIT_S, RUN_IN_S, RUN_OUT_REACH, POINT_BLANK, FIRE_EXTENT_K, FIRE_EXTENT_SKILL,
  NO_BEAR_S, BEAR_DEG, PRESENT_SAILS, WIND_RATED, AIM_FREEBOARD, FRIEND_CLEAR,
  createSeaShip, stepCaptain, fireWindow, bearsWithin, layPasses, lineFoul, rigBand, batteryReach, quatOfYaw, velocityOf,
} from '../src/systems/naval/navalAI.js';
import { GUNS, BARREL, HULL, HULL_BUILDS, hullBuild, batteryOf, classById } from '../src/systems/naval/navalShips.js';
import {
  createShipDamage, fireOf, SHIP_STATES, STRUCK_AT, FIRE_HP, FIRE_SECONDS, FIRE_STACK, FIRE_SAIL, FIRE_CREW_S,
} from '../src/systems/naval/navalDamage.js';
import { aimSolution, volleyLaunches, createGunDeck, RIPPLE_S } from '../src/systems/naval/navalGunnery.js';
import { createShotField, FLOAT_DRIFT } from '../src/systems/naval/navalShots.js';
import { orientedBox, launchVelocity, rangeAt, NAVAL_DEG } from '../src/systems/naval/navalBallistics.js';
import { navalWireRecord } from '../src/systems/naval/navalWire.js';
import { NAVAL_SFX, navalSoundRange } from '../src/systems/naval/navalSounds.js';
import { hullBoxOf, rigBoxesOf, STRUCK_GRACE_S, TALLY_S, SHIP_FADE_S } from '../src/scenes/navalHost.js';
import { stowSail } from '../src/systems/comeSailAway.js';   // AUDIT GALLEON-2 RG3: her canvas set, where her rig's boxes stand
import { animatorOf } from '../src/systems/comeSailAwayBoat.js';
import { navalHudText } from '../src/ui/navalHud.js';
import { quatEuler } from '../src/world/unityAnimator.js';
import { sea } from './navalSea.mjs';

const DEG = NAVAL_DEG;
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} vs ${b} (±${eps})`);
const open = () => true;
const world = (o = {}) => ({ now: 0, dt: 0.1, seaY: 0, wind: [0, 0, WIND_RATED], isWater: open, contacts: [], random: () => 0.5, ...o });
/** The player's boat as a captain sees it: a Small Ship heading +z unless told otherwise. */
const player = (pos, o = {}) => ({ id: 'me', kind: 'player', pos, vel: [0, 0, 0], speed: 0, yaw: 0, hull: HULL.SmallShip, ...o });
// SEA-PEACE: the audit's captains are bold - a temper is the traffic's, pinned in test/seapeace.test.js
const ship = (classId, o = {}) => createSeaShip({ id: o.id ?? classId, seed: 1, classId, pos: o.pos ?? [0, 0, 0], yaw: o.yaw ?? 0, temper: o.temper ?? 'bold' });
/** Steps a captain `seconds`, gathering her volleys and run-outs with her clock. */
function run(s, w, seconds, each = null) {
  const out = { volleys: [], runOuts: [] };
  for (let t = 0; t < seconds - 1e-9; t += w.dt) {
    each?.(s);
    const o = stepCaptain(s, w);
    for (const v of o.volleys) out.volleys.push({ ...v, at: s.clock });
    for (const side of o.runOuts) out.runOuts.push({ side, at: s.clock });
  }
  return out;
}
const at = (deg, d) => [Math.sin(deg * DEG) * d, 0, Math.cos(deg * DEG) * d];

// ── the captains' guns ────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV1 G1 the run-out: a battery that will bear is run out RUN_OUT_S before it fires - the tell the helm braces for - and fires once out with the lead inside the fire\'s window, never before; fired, it runs in and reloads (mutants: fired unrun, the wait dropped, the run-out kept)', () => {
  const b = ship('pirateBrig');
  const w = world({ contacts: [player([100, 0, 0])] });
  const first = stepCaptain(b, w);
  assert.deepEqual([first.runOuts, first.volleys.length], [['starboard'], 0], 'the starboard battery runs out - nothing fired yet');
  assert.ok(b.runOut.has('starboard'));
  const early = run(b, w, RUN_OUT_S - 0.15);
  assert.equal(early.volleys.length, 0, 'still running out');
  let fired = null;
  for (let t = 0; t < 0.6 && !fired; t += w.dt) {
    const o = stepCaptain(b, w);
    if (o.volleys.length) fired = { volleys: o.volleys, at: b.clock, out: b.runOut.has('starboard') };
  }
  assert.ok(fired, 'she fires');
  assert.equal(fired.volleys.length, 1);
  assert.equal(fired.volleys[0].side, 'starboard');
  assert.ok(fired.at - 0.1 >= RUN_OUT_S - 1e-9, `fired ${fired.at} s in, run out at 0.1`);
  assert.equal(fired.out, false, 'run in the step she fires');
  assert.equal(b.guns.ready('starboard'), false, 'reloading');
  assert.ok(RUN_OUT_S >= 1 && RUN_OUT_S <= 2, 'a tell a helm can answer');
});

test('AUDIT NAV1 G2 a tell is a promise: bearsWithin reads when the lead will come into the window - its way across her line of sight less her own turn - and a battery runs out only if that is inside RUN_OUT_S, with the lead inside RUN_OUT_REACH of its reach; it is run in past RUN_IN_DEG or unfired RUN_OUT_WAIT_S past its time, and not run out again for RUN_IN_S (mutants: the rate\'s sign, the reach\'s margin, the wait, the cooldown)', () => {
  // the rate: an enemy 30 degrees forward of the starboard beam, crossing toward it at 5 m/s
  const s = ship('pirateBrig');
  const e = (vel) => ({ id: 'e', pos: [86.6, 0, 50], vel });
  near(bearsWithin(s, [86.6, 0, 50], e([0, 0, -5]), 90, 5), (30 - 5) / ((86.6 * 5) / 10000 / DEG), 0.05, 'closing: the degrees to go over the rate');
  assert.equal(bearsWithin(s, [86.6, 0, 50], e([0, 0, 5]), 90, 5), Infinity, 'opening');
  assert.equal(bearsWithin(s, [86.6, 0, 50], e([0, 0, -5]), 90, 31), 0, 'already in the window');
  s.yawRate = (50 * 0 - 86.6 * -5) / (86.6 * 86.6 + 50 * 50);   // her own turn exactly cancels the bearing's
  assert.equal(bearsWithin(s, [86.6, 0, 50], e([0, 0, -5]), 90, 5), Infinity, 'standing: she turns with it');
  // the reach's margin
  const reach = batteryReach(ship('pirateBrig'), 'starboard', 0);
  const edge = ship('pirateBrig');
  assert.equal(stepCaptain(edge, world({ contacts: [player([reach * 0.97, 0, 0])] })).runOuts.length, 0, 'at the edge of her reach: no tell she may not keep');
  const inside = ship('pirateBrig');
  assert.deepEqual(stepCaptain(inside, world({ contacts: [player([reach * (RUN_OUT_REACH - 0.05), 0, 0])] })).runOuts, ['starboard']);
  // run in past RUN_IN_DEG, and the cooldown
  const b = ship('pirateBrig');
  const w = world({ contacts: [player([100, 0, 0])] });
  stepCaptain(b, w);
  w.contacts[0].pos = at(90 - RUN_IN_DEG - 15, 100);
  stepCaptain(b, w);
  assert.equal(b.runOut.has('starboard'), false, 'swung past RUN_IN_DEG: run in');
  assert.ok(b.runIn.has('starboard'));
  w.contacts[0].pos = [100, 0, b.pos[2]];
  const cool = run(b, w, RUN_IN_S - 0.3, (x) => { x.yaw = 0; x.yawRate = 0; });
  assert.equal(cool.runOuts.length, 0, 'not run out again inside RUN_IN_S');
  const again = run(b, w, 0.6, (x) => { x.yaw = 0; x.yawRate = 0; });
  assert.equal(again.runOuts.length, 1, 'after it, a tell again');
  // unfired past its wait: the lead held just outside the window, her helm held
  const h = ship('pirateBrig');
  const hw = world({ contacts: [player([100, 0, 0])] });
  stepCaptain(h, hw);
  const hold = (x) => { x.yaw = 0; x.yawRate = 0; const win = fireWindow(x, hw.contacts[0], hw.contacts[0].pos, 'long', BEAR_DEG); hw.contacts[0].pos = [x.pos[0] + Math.sin((90 + win + 2) * DEG) * 100, 0, x.pos[2] + Math.cos((90 + win + 2) * DEG) * 100]; };
  const waited = run(h, hw, RUN_OUT_S + RUN_OUT_WAIT_S - 0.3, hold);
  assert.equal(waited.volleys.length, 0);
  assert.ok(h.runOut.has('starboard'), 'waiting on her');
  run(h, hw, 0.6, hold);
  assert.equal(h.runOut.has('starboard'), false, 'run in unfired past RUN_OUT_WAIT_S');
  assert.ok(RUN_OUT_DEG > BEAR_DEG && RUN_IN_DEG > RUN_OUT_DEG);
});

test('AUDIT NAV1 G3 the fire\'s window: her half-extent across the line of fire - her length turned to it, her half beam - times the crew\'s share (a crack crew waits for her middle, a green one fires at her edge), over the range; never inside the gun\'s own spread, never past BEAR_DEG; her heading unknown, her mean profile, or her way\'s (mutants: the projection, the skill\'s sign, the floor, the cap)', () => {
  const b = hullBuild(HULL.SmallShip);
  const halfLen = (b.bowZ - b.aftZ) / 2;
  const win = (classId, enemy, dist) => fireWindow(ship(classId), enemy, [dist, 0, 0], 'long', BEAR_DEG);
  const beamOn = player([100, 0, 0], { yaw: 0 }), bowOn = player([100, 0, 0], { yaw: Math.PI / 2 });
  const share = (skill) => FIRE_EXTENT_K + FIRE_EXTENT_SKILL * (1 - skill);
  near(win('pirateBrig', beamOn, 100), Math.asin(halfLen * share(0.55) / 100) / DEG, 1e-9, 'beam on: her length across the line');
  near(win('pirateBrig', bowOn, 100), Math.asin(b.halfWidth * share(0.55) / 100) / DEG, 1e-9, 'bow on: her beam');
  assert.ok(win('navyCutter', beamOn, 100) < win('pirateBrig', beamOn, 100) && win('pirateBrig', beamOn, 100) < win('merchantGalleon', beamOn, 100), 'a crack crew waits for her middle, a green one fires at her edge');
  near(win('pirateBrig', player([400, 0, 0], { yaw: Math.PI / 2 }), 400), GUNS.long.yawSpread * (1.5 - 0.55), 1e-9, 'never inside the gun\'s own spread');
  assert.equal(win('pirateBrig', player([30, 0, 0], { yaw: 0 }), 30), BEAR_DEG, 'never past BEAR_DEG');
  near(win('pirateBrig', player([100, 0, 0], { yaw: undefined }), 100), Math.asin((halfLen + b.halfWidth) * 2 / Math.PI * share(0.55) / 100) / DEG, 1e-9, 'her heading unknown: her mean profile');
  near(win('pirateBrig', player([100, 0, 0], { yaw: undefined, vel: [5, 0, 0] }), 100), win('pirateBrig', bowOn, 100), 1e-9, 'or her way\'s');
});

test('AUDIT NAV1 G4 never over her, never short: a lay the carriage cannot depress to strike her - a Large Boat alongside a galley\'s high deck - is neither run out nor fired; the depression the audit asked lets a Carrack\'s broadside strike a sloop come alongside to grapple, where -3 flew over her, and the new galleon\'s low guns strike her laid shallower (mutants: layPasses always, the band\'s roof)', () => {
  const lb = hullBuild(HULL.LargeBoat);
  // the galley's long guns stand 11.1 m up: a Large Boat 21 m off her side is under them
  const g = ship('pirateGalley');
  const pose = (s) => ({ position: s.pos, rotation: quatOfYaw(s.yaw), velocity: velocityOf(s), hull: s.hull });
  const under = aimSolution(pose(g), 'starboard', null, 0, { target: [30, 0, 0], targetY: lb.top * AIM_FREEBOARD });
  assert.equal(layPasses(under, [30, 0, 0], [0, lb.top]), false, 'over her: the carriage at its lowest');
  const gw = world({ contacts: [player([30, 0, 0], { hull: HULL.LargeBoat })] });
  const r = run(g, gw, 4);
  assert.equal(r.volleys.filter((v) => v.side === 'starboard').length, 0, 'no broadside that flies over her');
  assert.equal(r.runOuts.filter((x) => x.side === 'starboard').length, 0, 'and no tell for one');
  // a Carrack's broadside at a sloop 25 m off her guns - PIN MOVED (GALLEON, 2026-10-01): the Small Ship's guns stand
  // 2.24 m over the sea now (Mac's galleon's gun deck), under the old -3's reach: hers strike a sloop alongside laid
  // a degree and a half down, and -3 too
  const brig = ship('pirateBrig');
  const low = aimSolution(pose(brig), 'starboard', null, 0, { target: [31, 0, 0], targetY: lb.top * AIM_FREEBOARD });
  assert.ok(layPasses(low, [31, 0, 0], [0, lb.top]) && low.elevation > -3 * DEG, `the Small Ship's low guns (${low.elevation / DEG})`);
  const b = ship('pirateFlagship');
  const sol = aimSolution(pose(b), 'starboard', null, 0, { target: [33, 0, 0], targetY: lb.top * AIM_FREEBOARD });
  assert.ok(layPasses(sol, [33, 0, 0], [0, lb.top]), 'laid low enough at -8');
  assert.ok(sol.elevation > GUNS.long.minEl * DEG && sol.elevation < -3 * DEG, `below the old -3 (${sol.elevation / DEG})`);
  const old = { ...sol, launches: sol.muzzles.map((p0) => ({ p0, v0: launchVelocity(sol.dir, -3 * DEG, GUNS.long.speed) })) };
  assert.equal(layPasses(old, [33, 0, 0], [0, lb.top]), false, 'at -3 it flew over her');
  assert.equal(layPasses(sol, [33, 0, 0], [0, 0.1]), false, 'the band\'s roof is read');
});

test('AUDIT NAV1 G5 no friend across the line: a ship she does not take for an enemy within FRIEND_CLEAR of the line from her guns out past the lead holds the battery - neither run out nor fired; an enemy there does not, nor a friend off the line (mutants: lineFoul never, an enemy counted a friend, the clearance)', () => {
  const sister = { id: 'sis', kind: 'ship', faction: 'pirate', pos: [75, 0, -1], vel: [0, 0, 0], speed: 0, yaw: 0, hull: HULL.LargeBoat };
  const b = ship('pirateBrig');
  const w = world({ contacts: [player([150, 0, 0]), sister] });
  const held = run(b, w, 3);
  assert.equal(held.runOuts.filter((x) => x.side === 'starboard').length + held.volleys.filter((v) => v.side === 'starboard').length, 0, 'her sister across the line: the starboard guns held');
  const bat = batteryOf(HULL.SmallShip, 'starboard');
  const s2 = ship('pirateBrig');
  assert.equal(lineFoul(s2, bat, [150, 0, 0], w.contacts[0], w), true);
  assert.equal(lineFoul(s2, bat, [150, 0, 0], w.contacts[0], world({ contacts: [player([150, 0, 0]), { ...sister, pos: [75, 0, hullBuild(HULL.LargeBoat).bowZ + FRIEND_CLEAR + 12] }] })), false, 'off the line by more than her length and FRIEND_CLEAR');
  const merchant = { ...sister, id: 'm', faction: 'merchant' };
  assert.equal(lineFoul(s2, bat, [150, 0, 0], w.contacts[0], world({ contacts: [player([150, 0, 0]), merchant] })), false, 'a merchantman is prey, not a friend');
  const free = run(ship('pirateBrig'), world({ contacts: [player([150, 0, 0]), merchant] }), 3);
  assert.ok(free.volleys.length >= 1, 'with prey across the line she fires');
});

test('AUDIT NAV1 G6 the lay: a broadside laid for AIM_FREEBOARD of her hull\'s height at the lead, chain shot for the middle of her rig - a pirate\'s chasers cut the canvas a boarding needs slowed (mutants: laid for the sea, chain laid for the hull)', () => {
  // a boat running dead ahead of her - the stern chase that keeps her chasers bearing (HELM-WAY: one lying still dead
  // ahead, her quicker helm shows her broadside before the chasers' tell is out)
  const b = ship('pirateBrig');
  const w = world({ contacts: [player([0, 0, 120], { vel: [0, 0, 6], speed: 6 })] });
  const r = run(b, w, 3);
  const bow = r.volleys.find((v) => v.side === 'bow');
  assert.ok(bow, 'the chasers fire over the stem');
  assert.equal(bow.solution.gun, 'chain');
  const pose = { position: [0, 0, 0], rotation: quatOfYaw(0), velocity: [0, 0, 0], hull: HULL.SmallShip };
  const hullLay = aimSolution(pose, 'bow', null, 0, { target: [0, 0, 120], targetY: hullBuild(HULL.SmallShip).top * AIM_FREEBOARD });
  assert.ok(bow.solution.elevation > hullLay.elevation + 2 * DEG, `laid high, for her rig (${bow.solution.elevation / DEG} over ${hullLay.elevation / DEG})`);
  const band = rigBand(hullBuild(HULL.SmallShip));
  assert.ok(layPasses(bow.solution, [0, 0, 120 - b.pos[2]], band) || layPasses(bow.solution, [0, 0, 120], band), 'through her rig');
  // a broadside's lay meets her at AIM_FREEBOARD of her height
  const side = run(ship('pirateBrig'), world({ contacts: [player([100, 0, 0])] }), 2).volleys[0];
  const l = side.solution.launches[side.solution.launches.length >> 1];
  const x = (100 - l.p0[0]) * side.solution.dir[0];
  const tt = x / (l.v0[0] * side.solution.dir[0] + l.v0[2] * side.solution.dir[2]);
  near(l.p0[1] + l.v0[1] * tt - 0.5 * 9.81 * tt * tt, hullBuild(HULL.SmallShip).top * AIM_FREEBOARD, 1.2, 'her side, not her waterline');
});

test('AUDIT NAV1 G7 station alongside: presented, her way matches the enemy\'s along her course - a boat under way is kept abeam, never dropped astern at a flat PRESENT_SAILS - and a slow one gets no more than PRESENT_SAILS; a side the wind holds out of the fire\'s window costs NO_BEAR_S and is not presented; loaded at point-blank she still opens the range (mutants: the flat sail, the no-bear cost, the point-blank bend)', () => {
  // a boat abeam making 5 m/s on her own heading, the brig presented and loaded
  const b = ship('pirateBrig');
  b.speed = 5;
  const w = world({ contacts: [player([100, 0, 0], { vel: [0, 0, 5], speed: 5 })] });
  run(b, w, 0.5);
  assert.ok(b.sailsWant > PRESENT_SAILS + 0.1, `she keeps her way with his (${b.sailsWant})`);
  const slow = ship('pirateBrig');
  run(slow, world({ contacts: [player([100, 0, 0])] }), 0.5);
  near(slow.sailsWant, PRESENT_SAILS, 1e-9, 'a still boat: PRESENT_SAILS');
  // the wind's eye: close-hauled, the starboard lay would need her 25 degrees into it - the lead held outside the fire's
  // window - so she shows the port side, 155 degrees round, rather than sail on unfired
  const upwind = ship('pirateBrig', { yaw: 135 * DEG });
  upwind.speed = 5;
  run(upwind, world({ wind: [0, 0, WIND_RATED], contacts: [player(at(250, 100))] }), 0.1);
  assert.equal(upwind.present?.side, 'port', 'she shows the side the wind lets bear');
  // that lay is 29 degrees off - BEAR_COST_S alone (29 s) outweighs port's 17 s turn since HELM-WAY. NO_BEAR_S is what
  // decides a lay only a little past the fire's window: at 232 degrees starboard asks her 11.7 into the eye (the window
  // 7.5), 11.7 s against port's 18.7 s turn - she would show it and sail on unfired
  const edge = ship('pirateBrig', { yaw: 135 * DEG });
  edge.speed = 5;
  run(edge, world({ wind: [0, 0, WIND_RATED], contacts: [player(at(232, 100))] }), 0.1);
  assert.equal(edge.present?.side, 'port', 'a lay a little past the window is not taken either');
  assert.ok(NO_BEAR_S > 60, 'a side that cannot bear outweighs the turn to the other');
  // point-blank, loaded: she bends off to open the range rather than slug hull to hull
  const pb = ship('pirateBrig');
  pb.speed = 4;
  run(pb, world({ boarders: false, contacts: [player([pb.cls.range * POINT_BLANK * 0.8, 0, 0], { hull: HULL.LargeBoat })] }), 0.5);
  assert.ok(pb.yawRate < 0, `bearing away to port, the range opened (${pb.yawRate})`);
});

test('AUDIT NAV1 G8 the helm leads a presented turn: orbiting a still boat she brings the lead into the window again on the same side\'s reload, where a helm that trailed the orbit 4 TURN_TAU times its rate held it 8 degrees aft of her beam and sailed on unfired (mutants: no lead, a jump read as a rate)', () => {
  const b = ship('pirateBrig', { pos: [120, 0, 0], yaw: -Math.PI / 2 });
  const w = world({ wind: [0.6, 0, 1.3], boarders: false, contacts: [player([0, 0, 0])] });
  const r = run(b, w, 50);
  const port = r.volleys.filter((v) => v.side === 'port');
  assert.ok(port.length >= 2, `the same side fired again on its reload (${r.volleys.map((v) => `${v.side}@${v.at.toFixed(1)}`).join(' ')})`);
});

// ── what a ball does ──────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV1 G9 the prize stays a prize: the rest of the volley that struck her cannot take her under one hull (STRUCK_GRACE_S, the same striker), and her fires are put out as she strikes; a new volley can sink her (mutants: the floor dropped, the grace\'s striker, the douse)', async () => {
  const d = createShipDamage({ hullHp: 100, sailHp: 10, crew: 5 });
  d.apply({ hull: 50, sail: 0, crew: 0 });
  d.apply({ hull: 80, sail: 0, crew: 0 }, 1, { floor: 1 });
  assert.equal(d.hull, 1, 'floored at one');
  d.apply({ hull: 5, sail: 0, crew: 0 }, 1, { floor: 3 });
  assert.equal(d.hull, 1, 'a floor never mends her');
  // in the host: a merchantman just over the line, a whole broadside of mine into her
  const h = await sea({ hull: HULL.SmallShip, settings: { ShipsAtSea: 'off', Boarders: false } });
  const id = h.host.spawnShip('merchantGalleon', { range: 900, bearing: Math.PI / 2 });
  h.run(0.3);
  const e = h.host._sea.get(id);
  const dmg = e.ship.damage;
  dmg.apply({ hull: Math.round(dmg.maxHull * (1 - STRUCK_AT)) - 6, sail: 0, crew: 0, fire: true }, 0);
  assert.ok(dmg.fire > 0 && dmg.state === SHIP_STATES.afloat);
  const box = hullBoxOf(e.boat, h.pool.models);
  const ball = (dz) => ({ delay: 0, p0: [box.c[0] - 25, box.c[1], box.c[2] + dz], v0: [120, 0, 0], gun: 'heavy', index: 0 });   // great guns: the rest of the volley would sink her twice over
  h.host._shots.fireVolley({ id: 'mine1', shooter: 'me:42', launches: [-6, -3, 0, 3, 6, 9].map(ball) });
  h.run(0.5);
  assert.equal(dmg.state, SHIP_STATES.struck, 'she strikes');
  assert.ok(dmg.hull >= 1, `and the rest of that volley leaves her afloat (${dmg.hull})`);
  assert.equal(dmg.fire, 0, 'her fires out as she strikes');
  h.run(STRUCK_GRACE_S);
  h.host._shots.fireVolley({ id: 'mine2', shooter: 'me:42', launches: [-3, 0, 3, 6].map(ball) });
  h.run(0.5);
  assert.equal(dmg.state, SHIP_STATES.sinking, 'a new volley sinks her');
});

test('AUDIT NAV1 G10 no feud from a stray: a ball from a ship of her own trade, or between two lawful ones, provokes nothing; from another trade it does, and mine always (mutants: the trade unread, the lawful pair unread)', async () => {
  const h = await sea({ hull: HULL.SmallShip, settings: { ShipsAtSea: 'off', Boarders: false } });
  const place = (cls, pos) => { const id = h.host.spawnShip(cls, { range: 900 }); const e = h.host._sea.get(id); e.ship.pos = [...pos]; return e; };
  const a = place('pirateBrig', [800, 0, 0]), b = place('pirateBrig', [0, 0, 800]), m = place('merchantGalleon', [-800, 0, 0]), n = place('navyCutter', [0, 0, -800]);
  h.run(0.5);
  const into = (target, shooter, id) => {
    const box = hullBoxOf(target.boat, h.pool.models);
    h.host._shots.fireVolley({ id, shooter, launches: [{ delay: 0, p0: [box.c[0] - 25, box.c[1], box.c[2]], v0: [120, 0, 0], gun: 'swivel', index: 0 }] });
    h.run(0.4);
  };
  into(b, a.id, 's1');
  assert.equal(b.ship.provoked.has(a.id), false, 'a sister\'s stray');
  into(m, n.id, 's2');
  assert.equal(m.ship.provoked.has(n.id), false, 'a navy\'s stray into a merchantman');
  into(m, a.id, 's3');
  assert.equal(m.ship.provoked.has(a.id), true, 'a pirate\'s ball is a pirate\'s');
  into(n, 'me:42', 's4');
  assert.equal(n.ship.provoked.has('local'), true, 'and mine is mine');
});

test('AUDIT NAV1 G11 fire: a gun\'s FIRE_HP for FIRE_SECONDS, a barrel\'s BARREL.burnPerSecond for BARREL.burn; up to FIRE_STACK at once, a new one past that taking the place of the one nearest out; each eats canvas and men; in the host only a hull hit above the waterline can start one - never the canvas a ball tore, never a hole the sea comes in by (mutants: the stack\'s cap, a barrel as a ball, the chance on every zone)', async () => {
  assert.deepEqual(fireOf(true), { hp: FIRE_HP, t: FIRE_SECONDS });
  assert.deepEqual(fireOf('barrel'), { hp: BARREL.burnPerSecond, t: BARREL.burn });
  assert.deepEqual(fireOf(2), fireOf('barrel'), 'the wire\'s code for a barrel\'s');
  const d = createShipDamage({ hullHp: 1000, sailHp: 100, crew: 30 });
  for (let i = 0; i < FIRE_STACK; i++) { d.apply({ hull: 0, sail: 0, crew: 0, fire: true }); d.step(1); }
  assert.equal(d.fires, FIRE_STACK);
  d.apply({ hull: 0, sail: 0, crew: 0, fire: 'barrel' });
  assert.equal(d.fires, FIRE_STACK, 'never past the stack');
  const before = d.hull;
  d.step(1);
  near(before - d.hull, FIRE_HP * (FIRE_STACK - 1) + BARREL.burnPerSecond, 1e-9, 'the barrel\'s took the place of the fire with least harm left');
  near(d.sail, 100 - FIRE_SAIL * (1 + 2 + 3 + FIRE_STACK), 1e-9, 'each eats her canvas');
  // three barrels' fires burning: a ball's lesser fire takes none of their places
  const hot = createShipDamage({ hullHp: 1000, sailHp: 100, crew: 30 });
  for (let i = 0; i < FIRE_STACK; i++) hot.apply({ hull: 0, sail: 0, crew: 0, fire: 'barrel' });
  hot.step(1);
  hot.apply({ hull: 0, sail: 0, crew: 0, fire: true });
  const was = hot.hull;
  hot.step(1);
  near(was - hot.hull, BARREL.burnPerSecond * FIRE_STACK, 1e-9, 'a lesser fire takes no greater one\'s place');
  assert.ok(FIRE_CREW_S > 0);
  // the host: many balls into one hull - through her rig, at her waterline, into her side
  const h = await sea({ hull: HULL.SmallShip, seed: 11, settings: { ShipsAtSea: 'off', Boarders: false } });
  const id = h.host.spawnShip('merchantCarrack', { range: 900, bearing: Math.PI / 2 });
  h.run(SHIP_FADE_S + 0.3);   // AUDIT BAY A14 PIN MOVED: come into the world whole first - a ship under FADE_FLATS raises no smoke, and the stream her rolls draw on moves with it
  const e = h.host._sea.get(id);
  const box = hullBoxOf(e.boat, h.pool.models);
  const volley = (y, n, tag, gun = 'swivel') => h.host._shots.fireVolley({ id: tag, shooter: 'me:42', launches: Array.from({ length: n }, (_, i) => ({ delay: i * 0.02, p0: [box.c[0] - 30, y, box.c[2] + (i % 9) - 4], v0: [150, 0, 0], gun, index: i })) });
  volley(box.c[1] + box.h[1] + 12, 40, 'rig');
  h.run(1);
  assert.equal(e.ship.damage.fires, 0, 'the canvas a ball tore does not burn');
  e.ship.damage.repair();
  volley(0.4, 40, 'holed');
  h.run(1);
  assert.equal(e.ship.damage.fires, 0, 'nor a hole the sea comes in by');
  e.ship.damage.repair();
  // (HELM-WAY: long guns hole her side - sixty swivels' grape killed every hand first, and a ship with none strikes, the
  // rest of that volley setting nothing alight on her)
  volley(box.c[1] + 2, 20, 'hull', 'long');
  h.run(1.5);
  assert.ok(e.ship.damage.fires > 0, 'a hull hit above the waterline can');
});

test('AUDIT NAV1 G12 the rig is a target: a ball through her canvas tears it - a hit in zone rig, once a ship however many of her sails it crosses - and flies on to what stops it; her rig rides her MeshObject, heeling with her; the rowboat carries none (mutants: the rig stops the ball, twice a ship, the rig on the root)', async () => {
  const unit = (c, hh) => orientedBox([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, c[0], c[1], c[2], 1], [0, 0, 0], hh);
  const events = [];
  const field = createShotField({ seaY: () => 0, targets: () => [{ id: 'her', box: unit([40, 2, 0], [3, 2, 10]), rig: [unit([38, 12, 0], [1, 6, 4]), unit([44, 12, 0], [1, 6, 4])] }], onEvent: (e) => events.push(e) });
  field.fireVolley({ id: 1, shooter: 'x', launches: [{ delay: 0, p0: [0, 12, 0], v0: [60, 0.5, 0], gun: 'chain', index: 0 }] });
  for (let i = 0; i < 40; i++) field.step(0.05);
  const hits = events.filter((e) => e.type === 'hit');
  assert.deepEqual(hits.map((e) => e.zone), ['rig'], 'through both sails at once: one rig hit');
  assert.ok(events.some((e) => e.type === 'splash' && e.point[0] > 43), 'and it flew on past her');
  events.length = 0;
  field.fireVolley({ id: 2, shooter: 'x', launches: [{ delay: 0, p0: [0, 3.5, 0], v0: [60, 0.3, 0], gun: 'long', index: 0 }] });
  for (let i = 0; i < 40; i++) field.step(0.05);
  assert.deepEqual(events.filter((e) => e.type === 'hit').map((e) => e.zone), ['hull'], 'her side is hull');
  // a real hull's rig, heeled with her
  const h = await sea({ hull: HULL.SmallShip });
  for (const sail of h.boat.Sails) stowSail(animatorOf(sail), false);   // PIN MOVED (AUDIT GALLEON-2 RG3): her canvas set - furled, no box stands
  const upright = rigBoxesOf(h.boat)[0];
  near(upright.ay[1], 1, 1e-9, 'upright');
  h.boat.MeshObject.localRotation = quatEuler(0, 0, 12);
  const heeled = rigBoxesOf(h.boat)[0];
  near(Math.acos(heeled.ay[1]) / DEG, 12, 0.01, 'the masts heel with her');
  assert.equal(HULL_BUILDS[HULL.Rowboat].rig.length, 0);
  assert.equal(HULL_BUILDS[HULL.Carrack].rig.length, 3, 'two courses and a lateen mizzen');
  // PIN MOVED (AUDIT GALLEON R5/G9): the Small Ship's boxes hang down to her canvas under her roof (her course's foot,
  // her gaff sail's, her jib's) - each still reaches out of her hull's box, and the chain shot's band (navalAI.js rigBand)
  // starts at her roof; every other hull's canvas stands over its roof as it did
  for (const b of HULL_BUILDS) for (const [mn, mx] of b.rig) {
    if (b.hull === HULL.SmallShip) assert.ok(mx[1] > b.top || mx[2] > b.bowZ || mn[2] < b.aftZ || mx[0] > b.halfWidth || mn[0] < -b.halfWidth, `hull ${b.hull}: each box out of her hull's`);
    else assert.ok(mn[1] >= b.top - 1e-9, `hull ${b.hull}: the canvas stands over her roof`);
  }
});

test('AUDIT NAV1 G13 the shots\' own: the targets read once a step however many balls fly; each gun of a ripple fires from its port where the deck has carried it; the brace stops the reload; what floats drifts downwind (mutants: the targets per ball, the carry dropped, the clocks braced, no drift)', () => {
  let asked = 0;
  const field = createShotField({ seaY: () => 0, targets: () => { asked++; return []; }, wind: () => [2, 0, 0] });
  field.fireVolley({ id: 1, shooter: 'x', launches: Array.from({ length: 12 }, (_, i) => ({ delay: 0, p0: [0, 5, i], v0: [50, 1, 0], gun: 'long', index: i })) });
  field.step(0.05);
  assert.equal(asked, 1, 'twelve balls, one reading');
  field.dropBarrel({ id: 'b', shooter: 'x', pos: [0, 0, 0] });
  field.step(0.05);
  const x0 = field.floaters()[0].pos[0];
  field.step(1);
  near(field.floaters()[0].pos[0] - x0, 2 * FLOAT_DRIFT, 1e-9, 'downwind');
  // the ripple from the moving port
  const pose = { position: [0, 0, 0], rotation: quatOfYaw(0), velocity: [0, 0, 10], hull: HULL.Carrack };
  const sol = aimSolution(pose, 'starboard', null, 0, { range: 120 });
  const launches = volleyLaunches(sol, 7, { skill: 0.6, carry: [0, 0, 10] });
  launches.forEach((l, i) => near(l.p0[2] - sol.muzzles[i][2], 10 * i * RIPPLE_S, 1e-9, `gun ${i}`));
  // the brace
  const deck = createGunDeck(HULL.SmallShip);
  deck.fired('starboard');
  const left = deck.left('starboard');
  deck.braced = true;
  deck.step(5);
  assert.equal(deck.left('starboard'), left, 'a crew holding on is not loading');
  deck.braced = false;
  deck.step(5);
  near(deck.left('starboard'), left - 5, 1e-9);
});

test('AUDIT NAV1 G14 the guns\' reach: the carriages depress to -8 (long), -6 (great and chase), -10 (swivel); the galley\'s great guns throw 68 m/s to 15 degrees, outranging her own long guns (mutants: the old carriages, the old great gun)', () => {
  assert.deepEqual([GUNS.long.minEl, GUNS.heavy.minEl, GUNS.chain.minEl, GUNS.swivel.minEl], [-8, -6, -6, -10]);
  assert.deepEqual([GUNS.heavy.speed, GUNS.heavy.maxEl], [68, 15]);
  const g = ship('pirateGalley');
  assert.ok(batteryReach(g, 'bow', 0) > batteryReach(g, 'starboard', 0) * 1.1, `great ${batteryReach(g, 'bow', 0)} over long ${batteryReach(g, 'starboard', 0)}`);
  near(rangeAt(GUNS.long.minEl * DEG, GUNS.long.speed, 4.5), 26, 1, 'a Small Ship\'s nearest broadside');
  assert.ok(classById('pirateGalley').tactic === 'bow');
});

// ── the readout and the tell ──────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV1 G15 the warning: a run-out that bears on my boat puts BROADSIDE and the brace\'s key over the crosshair from the run-out through the balls\' flight, gone once they are down; a battery run out at someone else warns nobody (mutants: the flight dropped, every run-out warns)', async () => {
  const h = await sea({ hull: HULL.SmallShip, settings: { ShipsAtSea: 'off', Boarders: false } });
  const id = h.host.spawnShip('pirateBrig', { range: 120, bearing: Math.PI / 2 });
  const e = h.host._sea.get(id);
  e.ship.pos = [120, 0, 0]; e.ship.yaw = Math.PI;
  let warnedAt = null, firedAt = null, clearAt = null;
  for (let t = 0; t < 8; t += 0.05) {
    h.host.frame(0.05);
    const m = h.host.hudModel();
    if (m.incoming && warnedAt == null) warnedAt = t;
    if (h.host.volleyWire.length && firedAt == null) firedAt = t;
    if (firedAt != null && !m.incoming && clearAt == null) clearAt = t;
  }
  assert.ok(warnedAt != null && firedAt != null && clearAt != null, `warned ${warnedAt}, fired ${firedAt}, cleared ${clearAt}`);
  assert.ok(firedAt - warnedAt >= RUN_OUT_S - 0.1, 'the warning comes before the volley by the run-out');
  assert.ok(clearAt - firedAt >= 0.9, `and stands through the flight (${(clearAt - firedAt).toFixed(2)} s)`);
  const text = navalHudText({ ...h.host.hudModel(), incoming: { name: 'x', side: 'port', t: 0 } }, { brace: 'Left Ctrl' });
  assert.deepEqual(text.warn, { text: 'Broadside', key: 'Left Ctrl: brace' });
  assert.equal(navalHudText(h.host.hudModel()).warn, null);
  // a pirate run out at a merchantman on her far side warns me of nothing
  const g = await sea({ hull: HULL.SmallShip, settings: { ShipsAtSea: 'off', Boarders: false } });
  const p = g.host._sea.get(g.host.spawnShip('pirateBrig', { range: 400, bearing: Math.PI / 2 }));
  const m = g.host._sea.get(g.host.spawnShip('merchantCoaster', { range: 520, bearing: Math.PI / 2 }));
  p.ship.pos = [400, 0, 0]; p.ship.yaw = 0; m.ship.pos = [520, 0, 0]; m.ship.yaw = 0;
  let out = false, warned = false;
  for (let t = 0; t < 3; t += 0.05) { g.host.frame(0.05); out ||= p.ship.runOut.size > 0; warned ||= !!g.host.hudModel().incoming; }
  assert.ok(out, 'she ran out at the merchantman');
  assert.equal(warned, false, 'and nobody warned me');
});

test('AUDIT NAV1 G16 the tell is heard and seen: the trucks\' rumble from her side as a battery runs out (NAVAL_SFX.runout, carried further than her timbers), the glint at each of its ports while it is out; a peer\'s ship\'s run-out comes over the wire as bits, heard and seen the same, and goes when the bit does (mutants: the sound unplayed, the glint on the wrong side, the bits unread)', async () => {
  const h = await sea({ hull: HULL.SmallShip, settings: { ShipsAtSea: 'off', Boarders: false } });
  const e = h.host._sea.get(h.host.spawnShip('pirateBrig', { range: 120, bearing: Math.PI / 2 }));
  e.ship.pos = [120, 0, 0]; e.ship.yaw = Math.PI;   // her starboard to me
  h.run(0.6);
  const rumble = h.log.sounds.filter(([k]) => k === NAVAL_SFX.runout);
  assert.equal(rumble.length, 1, 'one rumble as the battery runs out');
  assert.deepEqual(rumble[0][1], { ...navalSoundRange(NAVAL_SFX.runout) });
  assert.ok(navalSoundRange(NAVAL_SFX.runout).maxDistance > navalSoundRange(NAVAL_SFX.hit).maxDistance * 0.8);
  const glints = h.host._effects.drawList().filter((p) => p.kind === 'glint');
  assert.ok(glints.length > 0, 'her ports glint');
  assert.ok(glints.every((p) => p.pos[0] < 120), 'on her starboard side - the side toward me');
  // a peer's ship
  const peer = await sea({ hull: HULL.SmallShip, settings: { ShipsAtSea: 'off' } });
  const rec = (runOut) => navalWireRecord({ ships: [{ n: 4, classId: 'pirateBrig', variant: 0, pos: [0, 0, 150], yaw: 0, speed: 3, sails: 1, hull: 1, sail: 1, crew: 1, state: 'afloat', heel: 0, seed: 77, fire: false, runOut }] });
  assert.equal(peer.host.applyWord('ann', rec(0b0001)), true);
  const puppet = peer.host._sea.get('ann:4');
  assert.ok(puppet.ship.runOut.has('starboard'), 'her starboard battery out, as her stander says');
  assert.equal(peer.log.sounds.filter(([k]) => k === NAVAL_SFX.runout).length, 1, 'and heard here');
  peer.host.applyWord('ann', rec(0));
  assert.equal(puppet.ship.runOut.size, 0, 'run in when the bit goes');
});

test('AUDIT NAV1 G17 my volley\'s tally: once its last ball is down, how many struck, how many below her waterline, how many through her rigging - on the readout TALLY_S, then gone; a volley laid clean over her is a miss (mutants: counted before the last ball, a miss counted a hit)', async () => {
  const h = await sea({ hull: HULL.SmallShip, settings: { ShipsAtSea: 'off', Boarders: false } });
  const e = h.host._sea.get(h.host.spawnShip('merchantCarrack', { range: 70, bearing: Math.PI / 2 }));
  e.ship.pos = [68, 0, 0]; e.ship.yaw = 0;   // beam on, her side 60 m off my rail
  h.run(0.2);
  const lookAt = (p) => { const o = [0, 12.6, 0]; const d = [p[0] - o[0], p[1] - o[1], p[2] - o[2]]; const l = Math.hypot(...d); h.view.look = { origin: o, dir: d.map((v) => v / l) }; };
  const volley = () => { h.host.attackInput(true); h.host.frame(0.05); h.host.attackInput(false); h.host.frame(0.05); };
  lookAt([72, 0, 0]);   // the sea under her, past her near side: the balls meet her side on the way down
  volley();
  assert.equal(h.host.hudModel().tally, null, 'not before its last ball is down');
  h.run(2);
  const t = h.host.hudModel().tally;
  const guns = batteryOf(HULL.SmallShip, 'starboard').muzzles.length;
  assert.deepEqual([t.balls, t.hits], [guns, guns], 'every ball into her side at 60 m');
  assert.equal(navalHudText(h.host.hudModel()).tally.hits, `${guns} of ${guns} balls struck`);
  h.run(TALLY_S + 0.5);
  assert.equal(h.host.hudModel().tally, null, 'gone after TALLY_S');
  // reloaded, laid at the carriage's top: clean over her hull and under her canvas
  h.run(GUNS.long.reload + 0.5);
  lookAt([400, 12.6, 0]);
  volley();
  h.run(4.5);   // the longest flight
  const over = h.host.hudModel().tally;
  assert.deepEqual([over.balls, over.hits, over.rig], [guns, 0, 0], 'a clean miss');
  assert.equal(navalHudText(h.host.hudModel()).tally.miss, true);
});
