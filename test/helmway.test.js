// HELM-WAY (2026-09-29, Mac: "Improve the overall mobility and maneuverability of ships") - the responsive helm, driven
// on Come Sail Away's real runtime over the vendored hulls (test/csaScene.mjs) and on the sea's captains: the steerage
// law and the hulls' own helms read off the prefab, the way on and off, the rudder at rest, the Carrack that could
// neither make way nor turn, the Features row's choice (none handed is the mod to the letter), the captains' pace and
// sweeps at the player's own, and the ship with no hands left (an AI hull strikes; her fires burn on).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { sailFreeGain, HELM_WAY, HULL_HELM, CARGO_HOLD_MISSING, HANDLINGS, SAIL_FREE, steerage, isResponsive } from '../src/systems/helmWay.js';
import { HANDLING } from '../src/systems/comeSailAway.js';
import { ACCEL, DECEL, OARS_TURN, SWEEP_TURN, WIND_RATED, createSeaShip, maxTurnRate, turnRateAt } from '../src/systems/naval/navalAI.js';
import { createShipDamage, SHIP_STATES, STRUCK_AT } from '../src/systems/naval/navalDamage.js';
import { HULL } from '../src/systems/naval/navalShips.js';
import { NAVAL_DEG } from '../src/systems/naval/navalBallistics.js';
import { HEAVE_TO_DECEL } from '../src/scenes/navalHost.js';
import { FEATURES } from '../src/systems/features.js';
import { scene } from './csaScene.mjs';

const f = Math.fround;
const near = (a, b, eps = 1e-6, msg = '') => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} vs ${b}`);
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DEG = NAVAL_DEG;

/** A helm on `hull` with the wind `wind` (where it blows to), the Ship handling `handling` (undefined: none handed). */
function helmOn(hull, { handling, wind = [1.5, 0, 0], raise = true } = {}) {
  const s = scene();
  if (handling !== undefined) s.deps.handling = () => handling;
  const boat = s.helm(s.place(hull, 0));
  if (raise) s.rt.RaiseSails();
  s.rt.state.windVectorCurrent = [...wind];
  s.rt.state.windVectorTarget = [...wind];
  return { s, boat };
}

test('HELM-WAY the steerage: STEER_FLOOR at rest, steerPeak at steerPeakV, easing toward her full way - so half her way turns tightest; a hull\'s helm is the prefab\'s rudder x sail-turn modifiers (mutants: the floor, the peak\'s place, the ease)', () => {
  near(steerage(0), HELM_WAY.steerFloor, 1e-12, 'at rest the wind in her canvas swings her');
  near(steerage(HELM_WAY.steerPeakV), HELM_WAY.steerPeak, 1e-12, 'hardest at the peak');
  assert.ok(steerage(HELM_WAY.steerPeakV * 0.5) < steerage(HELM_WAY.steerPeakV) && steerage(HELM_WAY.steerPeakV * 2) < steerage(HELM_WAY.steerPeakV), 'rising to it, easing past it');
  assert.ok(steerage(9) > steerage(0) && steerage(9) > 9, 'a full way still answers better than the mod\'s own way-for-rate at 9 m/s would ask');
  near(steerage(-3), HELM_WAY.steerFloor, 1e-12, 'no negative way');
  for (const h of [HULL.Rowboat, HULL.LargeBoat, HULL.SmallShip, HULL.LargeGalley, HULL.Carrack]) {
    const { boat } = helmOn(h, { raise: false });
    near(HULL_HELM[h], boat.modifierRudder * boat.modifierTurnSpeedSail, 1e-6, `hull ${h}'s helm is her prefab's`);
  }
  assert.deepEqual([...HANDLINGS], ['responsive', 'classic']);
  assert.equal(isResponsive('responsive'), true);
  assert.equal(isResponsive('classic'), false);
});

test('HELM-WAY the rudder answers at rest: with her sails set and no way on, the responsive helm turns her by the steerage\'s floor - the mod\'s own rudder (its way) gives nothing; at way the steerage stands for the way, read at SAIL-FREE\'s gain (mutants: the steerage unread, the classic path moved)', () => {
  for (const handling of [undefined, 'classic', 'responsive']) {
    const { s, boat } = helmOn(HULL.LargeBoat, { handling });
    s.rt.state.MoveVectorCurrent = [0, 0, 0];
    s.held.add('MoveRight');
    s.frame();
    const want = handling === 'responsive' ? f(f(f(steerage(0)) * f(boat.modifierRudder)) / 10) : 0;
    assert.equal(s.rt.state.TurnTarget, want, `${handling ?? 'none handed'}: ${s.rt.state.TurnTarget}`);
    s.rt.state.MoveVectorCurrent = [0, 0, 4];
    s.frame();
    // PIN MOVED (SAIL-FREE, 2026-10-05): the responsive rudder reads her way at SAIL-FREE's gain - her swing at her new way
    // - PIN MOVED (AUDIT SHIPS A5, 2026-10-06): her rig's own gain (a Large Boat's, sailFreeGain)
    const at4 = handling === 'responsive' ? f(f(f(steerage(4 / sailFreeGain(boat))) * f(boat.modifierRudder)) / 10) : f(f(4 * boat.modifierRudder) / 10);
    assert.equal(s.rt.state.TurnTarget, at4, `${handling ?? 'none handed'} at 4 m/s`);
  }
});

test('HELM-WAY her way on and off: under sail the responsive helm gathers way at HELM_WAY.sailAccel of the mod\'s rate and, sails struck, coasts at HELM_WAY.coast of it, each times SAIL-FREE\'s gain; the helm comes over at HELM_WAY.turnAccelSail of the mod\'s; the oars are the mod\'s own (mutants: the sail\'s rate, the coast, the helm\'s, the oars touched)', () => {
  const classic = helmOn(HULL.SmallShip, { handling: 'classic' });
  const quick = helmOn(HULL.SmallShip, { handling: 'responsive' });
  // PIN MOVED (SAIL-FREE, 2026-10-05): her sail's rates times SAIL-FREE's gain - the same handling at her new way
  near(quick.s.rt.properties.moveAccel(), classic.s.rt.properties.moveAccel() * HELM_WAY.sailAccel * SAIL_FREE.gain, 1e-5, 'under sail');
  near(quick.s.rt.properties.turnAccel(), classic.s.rt.properties.turnAccel() * HELM_WAY.turnAccelSail, 1e-5, 'the helm');
  // PIN MOVED (AUDIT SHIPS A5, 2026-10-06): the gain on a coast is a way her canvas made - she sails a beat first
  for (const h of [classic, quick]) { h.s.frame(); h.s.rt.LowerSails(); }
  near(quick.s.rt.properties.moveAccel(), classic.s.rt.properties.moveAccel() * HELM_WAY.coast * SAIL_FREE.gain, 1e-5, 'the coast, sails struck');
  for (const h of [classic, quick]) h.s.rt.state.oarThrottle = 1;   // HELM-LADDER: the oars pulling ahead at their rung
  near(quick.s.rt.properties.moveAccel(), classic.s.rt.properties.moveAccel(), 1e-9, 'the oars pulled: the mod\'s own');
  // AUDIT SHIPS A5: and a way her oars made is lost at HELM-WAY's own coast, her rig's gain none of it. PIN MOVED (AUDIT 2
  // XA7, 2026-10-06): rowed from rest - a beat of sail and a frame of oars was the way her canvas made, all but a seventh
  const [cr, qr] = [helmOn(HULL.SmallShip, { handling: 'classic', raise: false }), helmOn(HULL.SmallShip, { handling: 'responsive', raise: false })];
  for (const h of [cr, qr]) { h.s.rt.state.oarThrottle = 1; h.s.frame(); h.s.rt.state.oarThrottle = 0; }
  near(qr.s.rt.properties.moveAccel(), cr.s.rt.properties.moveAccel() * HELM_WAY.coast, 1e-5, 'the oars at rest: HELM-WAY\'s coast');
  for (const h of [classic, quick]) { h.s.held.clear(); h.s.held.add('MoveRight'); }
  near(quick.s.rt.properties.turnAccel(), classic.s.rt.properties.turnAccel(), 1e-9, 'an oar turn: the mod\'s own');
  assert.ok(HELM_WAY.sailAccel > 1 && HELM_WAY.coast > 1 && HELM_WAY.turnAccelSail > 1);
});

test('HELM-WAY measured on the real runtime: a Small Ship on a beam reach gathers her way in seconds, not half a minute; struck, she loses it in seconds, not most of a minute; from rest with her sails set she swings at once (mutants: any of the three rates)', () => {
  const run = (handling) => {
    const { s, boat } = helmOn(HULL.SmallShip, { handling, wind: [1.5, 0, 0] });
    const top = () => Math.hypot(...s.rt.state.velocityTarget);
    s.frame();   // the sail's arm sets her way's target
    let t = 0.25;
    for (; t < 60 && Math.hypot(...s.rt.state.MoveVectorCurrent) < top() * 0.95; t += 0.25) s.frame();
    const gathered = t;
    s.rt.LowerSails();
    for (t = 0; t < 90 && Math.hypot(...s.rt.state.MoveVectorCurrent) > 2.5; t += 0.25) s.frame();
    const lost = t;
    s.rt.RaiseSails();
    s.rt.state.MoveVectorCurrent = [0, 0, 0];
    s.held.add('MoveRight');
    for (let k = 0; k < 8; k++) s.frame();
    return { gathered, lost, turning: Math.abs(s.rt.state.TurnCurrent), boat };
  };
  const classic = run('classic'), quick = run('responsive');
  assert.ok(classic.gathered > 20, `the mod's: ${classic.gathered} s to her way`);
  assert.ok(quick.gathered < 10, `the responsive helm's: ${quick.gathered} s`);
  assert.ok(classic.lost > 20 && quick.lost < classic.lost / 2.5, `losing her way: ${classic.lost} s against ${quick.lost} s`);
  // measured: the mod's 24.3 s to her way and 24 s off it, the responsive helm's 7 s and 8.3 s; two seconds from rest
  // with the helm over, the mod's swings her 0.4 deg/s (its rudder waits on her way), the responsive helm's 8.3
  assert.ok(classic.turning < 1 && quick.turning > classic.turning * 5, `from rest: ${classic.turning.toFixed(2)} against ${quick.turning.toFixed(2)} deg/s`);
});

test('HELM-WAY the Carrack makes way and turns: a hull the mod gave no Cargo node carries CARGO_HOLD_MISSING under the responsive helm - the mod\'s own divides every speed to nothing, kept under its own handling (mutants: the hold unread, the classic path moved)', () => {
  const classic = helmOn(HULL.Carrack, { handling: 'classic' });
  assert.equal(classic.boat.modifierCargoThreshold, 0, 'no Cargo node');
  assert.equal(classic.s.rt.state.boatCargoMod, 0, 'the mod\'s: 2 - w / 0 clamps to nothing');
  assert.equal(classic.s.rt.properties.moveSpeed(), 0);
  const quick = helmOn(HULL.Carrack, { handling: 'responsive' });
  assert.ok(quick.s.rt.state.boatCargoMod > 0.9, `the responsive helm's hold (${quick.s.rt.state.boatCargoMod})`);
  assert.ok(quick.s.rt.properties.moveSpeed() > 0 && quick.s.rt.properties.turnSpeed() > 0, 'she makes way and turns');
  assert.ok(CARGO_HOLD_MISSING >= 3);
});

test('HELM-WAY the captains sail at the player\'s own helm: their way comes on at the responsive helm\'s rate at the rated wind and off at its coast, they turn by its steerage (the brig at 1 m/s as the player\'s Small Ship), a galley rows round and a ship\'s sweeps turn her as the player\'s own oars turn their Small Ship (mutants: the old rates)', () => {
  near(ACCEL, HANDLING.moveAccelSail * HELM_WAY.sailAccel * WIND_RATED, 0.06, 'gathering way');
  near(DECEL, HANDLING.moveAccelSail * HELM_WAY.coast, 1e-6, 'losing it');
  const b = createSeaShip({ id: 'b', seed: 1, classId: 'pirateBrig', pos: [0, 0, 0] });
  b.speed = 1;
  near(maxTurnRate(b) / DEG, HULL_HELM[HULL.SmallShip] * steerage(1), 1e-9);
  near(turnRateAt(b, 1), maxTurnRate(b), 1e-12);
  const { boat } = helmOn(HULL.SmallShip, { raise: false });
  near(SWEEP_TURN, HANDLING.turnSpeedOar * boat.modifierTurnSpeedOar, 1e-6, 'her sweeps: the player\'s Small Ship\'s oars');
  assert.ok(OARS_TURN > 3, 'a galley rows round faster than she did');
});

test('HELM-WAY a ship with no hands left: an AI hull whose every man is down strikes - nobody lays her guns or trims her sails - and her fires burn on (nobody fights them); a hull strike still douses; hands back and she fights again; a player\'s boat never strikes, whoever is left (mutants: the unmanned strike, the douse on it)', () => {
  const d = createShipDamage({ hullHp: 400, sailHp: 100, crew: 10 });
  d.apply({ hull: 10, sail: 0, crew: 4, fire: true });
  assert.equal(d.state, SHIP_STATES.afloat);
  assert.equal(d.fires, 1);
  assert.equal(d.apply({ hull: 0, sail: 0, crew: 6 }), SHIP_STATES.struck, 'the last man down: her colours come down');
  assert.equal(d.fires, 1, 'her fire burns on');
  d.repair({ hull: 20, sail: 0, crew: 0 });
  assert.equal(d.state, SHIP_STATES.struck, 'timber without hands: still nobody to fight her');
  d.repair({ hull: 0, sail: 0, crew: 5 });
  assert.equal(d.state, SHIP_STATES.afloat, 'hands again, a hull above STRUCK_AT: she fights');
  const h = createShipDamage({ hullHp: 400, sailHp: 100, crew: 10 });
  h.apply({ hull: 0, sail: 0, crew: 0, fire: true });
  h.apply({ hull: Math.ceil(400 * (1 - STRUCK_AT)), sail: 0, crew: 0 });
  assert.equal(h.state, SHIP_STATES.struck);
  assert.equal(h.fires, 0, 'a hull strike: her crew fights her fires now');
  const crewless = createShipDamage({ hullHp: 60, sailHp: 0, crew: 0 });
  crewless.apply({ hull: 1, sail: 0, crew: 5 });
  assert.equal(crewless.state, SHIP_STATES.afloat, 'a hull that never carried a crew is never unmanned');
  const mine = createShipDamage({ hullHp: 420, sailHp: 160, crew: 24, player: true });
  mine.apply({ hull: 5, sail: 0, crew: 24 });
  assert.equal(mine.state, SHIP_STATES.afloat, 'the player works her guns alone');
});

test('HELM-WAY the Features row\'s Ship handling (responsive, or the mod\'s own - classic), each player\'s own; the world hands it and the heave-to\'s brake (HEAVE_TO_DECEL, m/s^2) to Come Sail Away', () => {
  const row = FEATURES.find((r) => r.id === 'naval-combat');
  assert.ok(row.control.also.some((a) => a.key === 'naval-handling' && a.initial === 'responsive' && a.online === 'player'));
  const part = row.control.parts.find((p) => p.key === 'naval-handling');
  assert.deepEqual(part.tiers.map(([k]) => k), [...HANDLINGS]);
  assert.equal(part.label, 'Ship handling');
  const w = src('src/scenes/world.js');
  assert.match(w, /brake: \(\) => naval\?\.brake\(\) \?\? 0,/);
  assert.match(w, /handling: \(\) => getPref\('naval-handling'\) \?\? 'responsive',/);
  assert.ok(HEAVE_TO_DECEL > 0 && HEAVE_TO_DECEL < 5, 'a brake, not a wall');
});
