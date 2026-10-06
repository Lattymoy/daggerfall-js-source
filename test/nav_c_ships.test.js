// NAV-C (2026-09-28, Mac: "introduce actual sailing ships to the world that players can encounter and pillage") -
// THE SHIPS OF THE ILIAC BAY: the classes and what they sail, their names and captains, the crowns whose waters
// these are; the captains' seamanship and gunnery; the traffic that brings them over the horizon
// (bible/03-World/Naval-Combat.md NAV-C). Pure modules, driven directly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HULL, HULL_BUILDS, SHIP_CLASSES, NAVAL_FACTIONS, FACTION_IDS, CROWNS, CROWN_LORE,
  classById, classFor, crownOf, shipNames, classLine, batteriesOf,
} from '../src/systems/naval/navalShips.js';
import {
  OARS_FLOOR, LOOKAHEAD_MIN, AVOID_SWINGS, BEAR_DEG, ENGAGE_RANGE, FLEE_RANGE, PIRATE_RUNS_AT, GRAPPLE_RANGE, GRAPPLE_STILL_S,
  GRAPPLE_HULL, NAVY_HUNTS, ACCEL, PROVOKED_S, RUN_OUT_S,
  windFactor, createSeaShip, velocityOf, hostile, provoke, courseClear, avoidLand, bearingTo, leadPoint, stepCaptain,
  batteryReach, broadsideReach, shipWireState, quatOfYaw, forwardOfYaw,
  TEMPERS,
} from '../src/systems/naval/navalAI.js';
import {
  DENSITY, SPAWN_RING, SPAWN_CLEAR, DESPAWN_BEYOND, SPAWN_EVERY, FIRST_ROLL_S, SHIP_SPAWN_CHANCE, FACTION_WEIGHTS, PORT_WEIGHTS, PORT_PIRATE_K,
  HUNTER_AT, HUNTER_WEIGHT, weightedPick, factionWeights, createNavalDirector, seedBaseOf,
} from '../src/systems/naval/navalDirector.js';
import { SHIP_STATES, STRUCK_AT } from '../src/systems/naval/navalDamage.js';
import { NAVAL_DEG } from '../src/systems/naval/navalBallistics.js';
import { srand, getSeed } from '../src/formats/dfRandom.js';
import { hash32 } from '../src/world/spawnedDungeons.js';

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} vs ${b} (±${eps})`);
const open = () => true;
const world = (o = {}) => ({ now: 0, dt: 1, seaY: 0, wind: [0, 0, 1], isWater: open, contacts: [], random: () => 0.5, ...o });
const player = (pos, o = {}) => ({ id: 'me', kind: 'player', pos, vel: [0, 0, 0], speed: 0, ...o });

// ── the classes ─────────────────────────────────────────────────────────────────────────────────────────────────

test('NAV-C the classes: nine in three trades, each a hull with guns scaled off its build, one pirate flagship, the galleys fighting over the stem; classFor draws among the classes a level has reached by weight, the draw\'s edges exact (mutants: the level gate off, a weight ignored, the edge off by one)', () => {
  assert.equal(SHIP_CLASSES.length, 9);
  assert.deepEqual(FACTION_IDS, ['pirate', 'merchant', 'navy']);
  for (const c of SHIP_CLASSES) {
    assert.ok(FACTION_IDS.includes(c.faction), c.id);
    assert.ok(batteriesOf(c.hull).length > 0, `${c.id}: a class fights - no rowboat sails as one`);
    assert.equal(classById(c.id), c);
    assert.equal(c.tactic, c.hull === HULL.LargeGalley ? 'bow' : 'broadside', `${c.id}: a galley's great guns are over her stem`);
  }
  assert.deepEqual(SHIP_CLASSES.filter((c) => c.flagship).map((c) => c.id), ['pirateFlagship']);
  // scaled off the hull's own build
  const sloop = classById('pirateSloop'), flag = classById('pirateFlagship');
  assert.equal(sloop.hullHp, Math.round(HULL_BUILDS[HULL.LargeBoat].hullHp * 1.1));
  assert.equal(flag.hullHp, Math.round(HULL_BUILDS[HULL.Carrack].hullHp * 1.15));
  assert.equal(flag.sailHp, HULL_BUILDS[HULL.Carrack].sailHp);
  assert.equal(classById('nope'), null);
  // the draw
  assert.equal(classFor('pirate', 1, 0.99).id, 'pirateSloop', 'a green captain meets sloops');
  assert.equal(classFor('pirate', 0, 0.5).id, 'pirateSloop', 'level 0 reads as 1');
  const w4 = 5 + 4;   // the sloop's weight and the brigantine's
  assert.equal(classFor('pirate', 4, 5 / w4 - 1e-9).id, 'pirateSloop');
  assert.equal(classFor('pirate', 4, 5 / w4 + 1e-9).id, 'pirateBrig');
  assert.equal(classFor('pirate', 9, 0.999).id, 'pirateFlagship');
  assert.equal(classFor('pirate', 9, 11 / 12 - 1e-9).id, 'pirateGalley');
  assert.equal(classFor('merchant', 5, 0.999).id, 'merchantCarrack');
  assert.equal(classFor('navy', 5, 0.999).id, 'navyCutter', 'the war galley waits for level 6');
  assert.equal(classFor('navy', 6, 0.999).id, 'navyGalley');
  assert.equal(classFor('smugglers', 5, 0.5), null, 'no faction, no class');
  // the factions' own table
  assert.equal(NAVAL_FACTIONS.pirate.hostile, true);
  assert.equal(NAVAL_FACTIONS.pirate.lawful, false);
  assert.equal(NAVAL_FACTIONS.merchant.flees, true);
  assert.equal(NAVAL_FACTIONS.navy.lawful, true);
  assert.equal(NAVAL_FACTIONS.navy.flees, false);
});

test('NAV-C whose waters: the nearest of the three capitals the host found on the map, a bad capital skipped; without them the region\'s own crown, else Daggerfall\'s (mutants: the farthest taken, NaN let through)', () => {
  const caps = [{ region: 17, x: 10, y: 10 }, { region: 23, x: 100, y: 10 }, { region: 20, x: 50, y: 90 }, { region: 99, x: 90, y: 12 }, { region: 17, x: Number.NaN, y: 12 }];
  assert.equal(crownOf(90, 12, caps).name, 'Wayrest');
  assert.equal(crownOf(48, 80, caps).name, 'Sentinel');
  assert.equal(crownOf(12, 14, caps).name, 'Daggerfall');
  assert.equal(crownOf(0, 0, null, 23).name, 'Wayrest');
  assert.equal(crownOf(0, 0, [], 5).name, 'Daggerfall');
  assert.deepEqual(CROWNS.map((c) => c.ruler), ['Gothryd', 'Eadwyre', 'Akorithi']);
});

test('NAV-C names off the seed: the same seed names the same ship and captain on every client - a navy ship one of her crown\'s, a pirate or a merchant her trade\'s - and naming her moves no other system\'s DFRandom draws (mutants: the global stream left moved, the crown ignored)', () => {
  const wayrest = CROWNS.find((c) => c.name === 'Wayrest');
  const a = shipNames(classById('navyCutter'), 0xabc123, { regionIndex: 23, crown: wayrest });
  const b = shipNames(classById('navyCutter'), 0xabc123, { regionIndex: 23, crown: wayrest });
  assert.deepEqual(a, b, 'deterministic');
  assert.equal(a.crown, 'Wayrest');
  // SHIP-NAMES (2026-10-02) PIN MOVED: a navy ship's name is of her crown's forms - never another crown's words
  const others = CROWNS.filter((c) => c !== wayrest).flatMap((c) => [...c.ships, ...CROWN_LORE[c.name].royals.filter((r) => !CROWN_LORE.Wayrest.royals.includes(r)), ...CROWN_LORE[c.name].places.filter((q) => q !== 'Sentinel')]);   // "Wayrest Sentinel" is Wayrest's own
  for (let i = 0; i < 300; i++) {
    const n = shipNames(classById('navyCutter'), i * 104729 + 3, { regionIndex: 23, crown: wayrest }).name;
    assert.ok(!others.some((w) => n.includes(w)), `${n}: Wayrest's`);
  }
  assert.ok(typeof a.captain === 'string' && a.captain.trim().length > 2, a.captain);
  const p = shipNames(classById('pirateSloop'), 77, { regionIndex: 17 });
  assert.ok(/^(The |\S+(?: \S+)?'s )/.test(p.name), p.name);
  assert.equal(p.crown, null);
  const m = shipNames(classById('merchantCoaster'), 78, { regionIndex: 17 });
  assert.ok(m.name.startsWith('The '), m.name);
  // the global stream stands where it stood
  srand(4242);
  const before = getSeed();
  shipNames(classById('pirateBrig'), 999, { regionIndex: 20 });
  assert.equal(getSeed(), before, 'DFRandom put back');
  // the seeds spread: forty ships are not one name
  const names = new Set(Array.from({ length: 40 }, (_, i) => shipNames(classById('pirateBrig'), i * 7919 + 1).name));
  assert.ok(names.size > 8, `${names.size} names in forty`);
  assert.equal(classLine(classById('navyGalley'), 'Sentinel'), 'Sentinel War Galley');
  assert.equal(classLine(classById('pirateBrig'), 'Sentinel'), 'Pirate Brigantine');
});

// ── the captains ────────────────────────────────────────────────────────────────────────────────────────────────

test('NAV-C the point of sail: a run most of her best, a broad reach all of it, close-hauled a third, in irons almost nothing - never more than her best, falling all the way from the beam reach to the wind\'s eye (mutants: a band\'s ends swapped)', () => {
  near(windFactor(0), 0.85, 1e-12, 'running');
  near(windFactor(100 * NAVAL_DEG), 1, 1e-12, 'the broad reach');
  near(windFactor(135 * NAVAL_DEG), 0.7, 1e-12);
  near(windFactor(150 * NAVAL_DEG), 0.35, 1e-12, 'close-hauled');
  near(windFactor(Math.PI), 0.08, 1e-12, 'in irons');
  near(windFactor(-100 * NAVAL_DEG), 1, 1e-12, 'either tack');
  let last = Infinity;
  for (let d = 100; d <= 180; d += 5) { const f = windFactor(d * NAVAL_DEG); assert.ok(f <= last + 1e-12, `falling at ${d}`); assert.ok(f <= 1); last = f; }
});

test('NAV-C who takes whom: pirates take anything; a navy takes pirates, and the player once their notoriety in ITS crown\'s waters reaches NAVY_HUNTS or they struck it; a merchant only who fired on it; a blow is remembered PROVOKED_S (mutants: the crown not asked, the memory forever)', () => {
  const pirate = createSeaShip({ id: 1, seed: 1, classId: 'pirateBrig', pos: [0, 0, 0], temper: TEMPERS.bold });   // SEA-PEACE: a bold one's table (a wary one's, test/seapeace.test.js)
  const navy = createSeaShip({ id: 2, seed: 2, classId: 'navyCutter', pos: [0, 0, 0], names: { crown: 'Wayrest' } });
  const merchant = createSeaShip({ id: 3, seed: 3, classId: 'merchantGalleon', pos: [0, 0, 0] });
  const me = { kind: 'player', id: 'p' };
  assert.equal(hostile(pirate, me), true);
  assert.equal(hostile(navy, me), false);
  const asked = [];
  assert.equal(hostile(navy, me, { notoriety: (c) => { asked.push(c); return c === 'Wayrest' ? NAVY_HUNTS : 0; } }), true);
  assert.deepEqual(asked, ['Wayrest'], 'her own crown\'s waters');
  assert.equal(hostile(navy, me, { notoriety: () => NAVY_HUNTS - 1 }), false);
  assert.equal(hostile(merchant, me), false);
  provoke(merchant, 'p', 100);
  assert.equal(hostile(merchant, me, { now: 100 + PROVOKED_S - 1 }), true);
  assert.equal(hostile(merchant, me, { now: 100 + PROVOKED_S + 1 }), false, 'forgotten');
  provoke(navy, 'p', 0);
  assert.equal(hostile(navy, me, { now: 10 }), true, 'struck: she answers');
  // ship against ship
  const ship = (faction) => ({ kind: 'ship', faction, id: `s-${faction}` });
  assert.equal(hostile(pirate, ship('merchant')), true);
  assert.equal(hostile(pirate, ship('navy')), true);
  assert.equal(hostile(pirate, ship('pirate')), false);
  assert.equal(hostile(navy, ship('pirate')), true);
  assert.equal(hostile(navy, ship('merchant')), false);
  assert.equal(hostile(merchant, ship('pirate')), false);
});

test('NAV-C off the rocks (AUDIT NAV1: every SCAN_STEP on the keel line and past either side of the hull): a course is clear when its soundings are water; a foul one swings to the NEAREST clear swing, starboard first; a ship boxed in comes about (mutants: the beam soundings dropped, the swings\' order)', () => {
  const fresh = () => createSeaShip({ id: 1, seed: 1, classId: 'pirateBrig', pos: [0, 0, 0], yaw: 0 });
  const ship = fresh();
  const land = (x, z) => z < 50;   // a shore across the bow
  assert.equal(courseClear([0, 0, 0], 0, LOOKAHEAD_MIN, land), false);
  assert.equal(courseClear([0, 0, 0], Math.PI, LOOKAHEAD_MIN, land), true);
  // 25 degrees still meets the shore, 50 grazes it with a beam, 80 clears it
  assert.equal(courseClear([0, 0, 0], 50 * NAVAL_DEG, LOOKAHEAD_MIN, land), false, 'the beam sounding finds it');
  assert.deepEqual(AVOID_SWINGS.slice(0, 6), [25, -25, 50, -50, 80, -80]);
  near(avoidLand(ship, 0, land), 80 * NAVAL_DEG, 1e-12);
  near(avoidLand(fresh(), Math.PI, land), Math.PI, 1e-12, 'a clear course is kept');
  near(Math.abs(avoidLand(fresh(), 0, () => false)), Math.PI, 1e-2, 'boxed in: about');
  // the bearing: + to starboard (+x at a heading of 0)
  near(bearingTo(ship, [10, 0, 0]).bearing, Math.PI / 2, 1e-12);
  near(bearingTo(ship, [-10, 0, 0]).bearing, -Math.PI / 2, 1e-12);
  near(bearingTo(ship, [0, 0, -10]).dist, 10, 1e-12);
  assert.deepEqual(forwardOfYaw(0), [0, 0, 1]);
  near(quatOfYaw(Math.PI)[1], 1, 1e-12);
});

test('NAV-C the lead: a still target is laid on; a moving one where it will be when the balls arrive - its way for the flight, found by iterating the range (mutants: the target\'s velocity ignored, the flight\'s speed)', () => {
  assert.deepEqual(leadPoint([0, 0, 0], [100, 2, 0], [0, 0, 0], 62), [100, 2, 0]);
  const p = leadPoint([0, 0, 0], [100, 0, 0], [0, 0, 5], 62);
  assert.equal(p[0], 100);
  const t = Math.hypot(p[0], p[2]) / (62 * 0.97);
  near(p[2], 5 * t, 1e-3, 'the fixed point');
  assert.ok(p[2] > 8, 'ahead of her');
});

test('NAV-C a captain at sea: with no enemy she cruises for a waypoint on open water, gathering way at ACCEL; a pirate with the player in reach engages - she presents her loaded broadside, runs it out (AUDIT NAV1: RUN_OUT_S, the tell) and fires it as the player bears abeam, the side then reloading (mutants: the broadside\'s bearing, the reach, the reload skipped)', () => {
  const s = createSeaShip({ id: 'c', seed: 5, classId: 'pirateBrig', pos: [0, 0, 0], yaw: 0 });
  let k = 0;
  const out = stepCaptain(s, world({ random: () => [0.1, 0.4, 0.2][(k++) % 3] }));   // AUDIT NAV1: a constant draw would be an upwind course every try
  assert.equal(s.mode, 'cruise');
  assert.ok(Array.isArray(s.waypoint) && s.waypoint.length === 2, 'a waypoint');
  near(s.speed, ACCEL * 1, 1e-12, 'a heavy hull gathers way at half; a brigantine at ACCEL');
  assert.deepEqual(out, { volleys: [], barrels: [], grapple: null, runOuts: [] });
  // the player abeam to starboard, within her reach
  // SEA-EASE (PIN MOVED): a bold pirate named - seed 6's own draw is wary under BOLD_SHARE's quarter, and a wary one
  // never takes a boat she cannot size up; the engagement is this pin's, the temper seapeace's
  const b = createSeaShip({ id: 'b', seed: 6, classId: 'pirateBrig', pos: [0, 0, 0], yaw: 0, temper: 'bold' });
  assert.ok(broadsideReach(b, 0) > 150, `her long guns reach ${broadsideReach(b, 0)} m`);
  const o = stepCaptain(b, world({ contacts: [player([80, 0, 0])] }));
  assert.equal(b.mode, 'engage');
  assert.equal(b.target, 'me');
  near(b.yaw, 0, 1e-9, 'already presented: she holds her course');
  assert.deepEqual([o.volleys.length, o.runOuts], [0, ['starboard']], 'run out first - the tell');
  const volleys = [];
  for (let t = 1; t <= Math.ceil(RUN_OUT_S) + 1; t++) {
    const on = stepCaptain(b, world({ contacts: [player([80, 0, 0])] }));
    if (t < RUN_OUT_S) assert.equal(on.volleys.length, 0, `still running out at ${t} s`);
    volleys.push(...on.volleys);
  }
  assert.equal(volleys.length, 1);
  assert.equal(volleys[0].side, 'starboard');
  assert.equal(b.guns.ready('starboard'), false, 'reloading');
  assert.equal(b.guns.ready('port'), true);
  // the same player far out of reach: no volley, she closes
  const f = createSeaShip({ id: 'f', seed: 7, classId: 'pirateBrig', pos: [0, 0, 0], yaw: 0, temper: 'bold' });   // SEA-EASE (PIN MOVED): bold, as b
  const fo = stepCaptain(f, world({ contacts: [player([600, 0, 0])] }));
  assert.equal(f.mode, 'engage');
  assert.equal(fo.volleys.length, 0);
  assert.ok(600 < ENGAGE_RANGE && 600 > broadsideReach(f, 0));
  // past ENGAGE_RANGE she does not see a fight
  const g = createSeaShip({ id: 'g', seed: 8, classId: 'pirateBrig', pos: [0, 0, 0], yaw: 0, temper: 'bold' });   // SEA-EASE (PIN MOVED): bold, or her cruise says nothing of the reach
  stepCaptain(g, world({ contacts: [player([ENGAGE_RANGE + 10, 0, 0])] }));
  assert.equal(g.mode, 'cruise');
  assert.ok(BEAR_DEG > 0 && batteryReach(g, 'stern', 0) === 0, 'a barrel battery has no reach of its own');
});

test('NAV-C how she fights: a broadside ship turns her side to an enemy off the bow, a galley her stem - her great guns laid on the lead (mutants: the tactic ignored, the side\'s sign)', () => {
  const at = [100 * Math.sin(20 * NAVAL_DEG), 0, 100 * Math.cos(20 * NAVAL_DEG)];   // 100 m, 20 degrees to starboard
  // SEA-EASE (PIN MOVED): both bold - seeds 1 and 2 draw wary, and a wary pirate never takes a boat she cannot size up:
  // both CRUISED, and the turns read here were their waypoints'
  const brig = createSeaShip({ id: 'b', seed: 1, classId: 'pirateBrig', pos: [0, 0, 0], yaw: 0, temper: 'bold' });
  stepCaptain(brig, world({ contacts: [player(at)] }));
  assert.deepEqual([brig.mode, brig.present?.side], ['engage', 'starboard']);
  assert.ok(brig.turnNow < 0, `the brigantine wears to present her starboard side (${brig.turnNow})`);
  const galley = createSeaShip({ id: 'g', seed: 2, classId: 'pirateGalley', pos: [0, 0, 0], yaw: 0, temper: 'bold' });
  stepCaptain(galley, world({ contacts: [player(at)] }));
  assert.deepEqual([galley.mode, galley.present], ['engage', null], 'over her stem: no side shown');
  assert.ok(galley.turnNow > 0, `the galley turns her bow on him (${galley.turnNow})`);
  // under oars a galley never makes less than OARS_FLOOR of her best, even in irons
  const irons = createSeaShip({ id: 'i', seed: 3, classId: 'navyGalley', pos: [0, 0, 0], yaw: Math.PI });
  for (let i = 0; i < 60; i++) stepCaptain(irons, world({ wind: [0, 0, 1], isWater: open }));
  assert.ok(irons.speed >= irons.cls.speed * OARS_FLOOR - 1e-9, `${irons.speed} under oars`);
  near(Math.hypot(...velocityOf(irons)), irons.speed, 1e-9);
});

test('NAV-C running: a merchant runs from what would take her; a pirate short of hull (under PIRATE_RUNS_AT, over STRUCK_AT) runs too - a flagship never (mutants: the flagship running, the share\'s edge)', () => {
  const pirate = createSeaShip({ id: 'p', seed: 1, classId: 'pirateBrig', pos: [0, 0, 200] });
  const m = createSeaShip({ id: 'm', seed: 2, classId: 'merchantGalleon', pos: [0, 0, 0], yaw: 0 });
  stepCaptain(m, world({ wind: [0, 0, -1], contacts: [{ id: 'p', kind: 'ship', faction: 'pirate', pos: [0, 0, 200], vel: [0, 0, 0], ship: pirate }] }));
  assert.equal(m.mode, 'flee');
  assert.equal(m.target, 'p');
  assert.ok(200 < FLEE_RANGE);
  assert.ok(PIRATE_RUNS_AT > STRUCK_AT, 'a band where she runs before she strikes');
  const hurt = (id) => {
    const s = createSeaShip({ id, seed: 3, classId: id === 'flag' ? 'pirateFlagship' : 'pirateBrig', pos: [0, 0, 0], temper: TEMPERS.bold });   // SEA-PEACE: one that fought
    s.damage.apply({ hull: Math.ceil(s.damage.maxHull * (1 - (PIRATE_RUNS_AT - 0.03))), sail: 0, crew: 0 });
    assert.equal(s.damage.state, SHIP_STATES.afloat);
    stepCaptain(s, world({ contacts: [player([0, 0, 300])] }));
    return s.mode;
  };
  assert.equal(hurt('brig'), 'flee');
  assert.equal(hurt('flag'), 'engage', 'a flagship fights it out');
});

test('NAV-C the grapple: a pirate with men to send takes a boat within GRAPPLE_RANGE that is crippled at once, or one lying still for GRAPPLE_STILL_S; way on resets the count (mutants: the stillness never counted, the range ignored)', () => {
  const sloop = () => createSeaShip({ id: 's', seed: 1, classId: 'pirateSloop', pos: [0, 0, 0], yaw: 0, temper: TEMPERS.bold });   // SEA-PEACE: a bold one (a wary one's grapple: a crippled or holed boat alone)
  const s = sloop();
  const got = [];
  for (let i = 0; i < GRAPPLE_STILL_S; i++) got.push(stepCaptain(s, world({ contacts: [player([20, 0, 0])] })).grapple);
  assert.deepEqual(got, [...Array(GRAPPLE_STILL_S - 1).fill(null), 'me']);
  const c = sloop();
  assert.equal(stepCaptain(c, world({ contacts: [player([20, 0, 0], { crippled: true })] })).grapple, 'me', 'crippled: at once');
  const h = sloop();
  assert.equal(stepCaptain(h, world({ contacts: [player([20, 0, 0], { hullShare: GRAPPLE_HULL - 0.01, speed: 4 })] })).grapple, 'me', 'holed: at once');
  const moving = sloop();
  for (let i = 0; i < GRAPPLE_STILL_S + 2; i++) assert.equal(stepCaptain(moving, world({ contacts: [player([20, 0, 0], { speed: 3 })] })).grapple, null);
  const far = sloop();
  for (let i = 0; i < GRAPPLE_STILL_S + 2; i++) assert.equal(stepCaptain(far, world({ contacts: [player([GRAPPLE_RANGE + 40, 0, 0])] })).grapple, null);
  const merchant = createSeaShip({ id: 'm', seed: 2, classId: 'merchantCoaster', pos: [0, 0, 0] });
  provoke(merchant, 'me', 0);
  assert.equal(stepCaptain(merchant, world({ contacts: [player([20, 0, 0], { crippled: true })] })).grapple, null, 'only a pirate boards');
});

test('NAV-C a struck, taken or sinking ship fights no more: her canvas comes in, her way falls off, and nothing fires; the wire says her state (mutants: the struck arm skipped)', () => {
  const s = createSeaShip({ id: 's', seed: 1, classId: 'pirateBrig', pos: [0, 0, 0], yaw: 0 });
  s.speed = 3;
  s.damage.apply({ hull: Math.ceil(s.damage.maxHull * (1 - STRUCK_AT)), sail: 0, crew: 0 });
  assert.equal(s.damage.state, SHIP_STATES.struck);
  const o = stepCaptain(s, world({ contacts: [player([80, 0, 0])] }));
  assert.equal(s.mode, 'struck');
  assert.equal(o.volleys.length, 0);
  assert.ok(s.speed < 3 && s.sails < 1);
  s.damage.takePrize();
  stepCaptain(s, world());
  assert.equal(s.mode, 'prize');
  const w = shipWireState(s);
  assert.deepEqual(Object.keys(w), ['id', 'seed', 'cls', 'variant', 'pos', 'yaw', 'speed', 'sails', 'heel', 'mode', 'damage']);
  assert.equal(w.cls, 'pirateBrig');
  assert.equal(w.damage.state, SHIP_STATES.prize);
  assert.throws(() => createSeaShip({ id: 1, seed: 1, classId: 'ghostShip', pos: [0, 0, 0] }), /no ship class/);
});

// ── the traffic ─────────────────────────────────────────────────────────────────────────────────────────────────

const ctx = (o = {}) => ({ density: DENSITY.some, player: [0, 0, 0], players: null, level: 5, ships: [], isOpenWater: () => true, nearPort: false, notoriety: 0, seedBase: 1234, seaY: 0, ...o });
const ctxAll = ctx;

test('NAV-C the director: nothing before FIRST_ROLL_S, then a roll every SPAWN_EVERY while the density has room - the ship stood SPAWN_RING out on open water, never within SPAWN_CLEAR of a player, her seed hash32(seedBase, count) (mutants: the ring, the clear, the count not advanced)', () => {
  // SEA-PEACE: room for one ship - a pair already at it is its own law (test/seapeace.test.js)
  const ctx = (o = {}) => ctxAll({ density: 1, ...o });
  const d = createNavalDirector({ random: () => 0.1 });
  assert.equal(d.step(FIRST_ROLL_S - 0.5, ctx()).spawn, null);
  const { spawn } = d.step(0.5, ctx());
  assert.ok(spawn, 'the first roll');
  const r = Math.hypot(spawn.pos[0], spawn.pos[2]);
  assert.ok(r >= SPAWN_RING[0] && r <= SPAWN_RING[1], `${r} m out`);
  assert.equal(spawn.seed, hash32(1234, 0));
  assert.equal(d.count, 1);
  assert.equal(spawn.pos[1], 0, 'on the sea');
  // the next roll waits its draw: SPAWN_EVERY[0] + 0.1 of the span
  const wait = SPAWN_EVERY[0] + 0.1 * (SPAWN_EVERY[1] - SPAWN_EVERY[0]);
  assert.equal(d.step(wait - 0.01, ctx()).spawn, null);
  const second = d.step(0.02, ctx()).spawn;
  assert.ok(second);
  assert.equal(second.seed, hash32(1234, 1), 'the count advanced');
  // the same waters, the same ships
  const e = createNavalDirector({ random: () => 0.1 });
  e.step(FIRST_ROLL_S, ctx());
  assert.deepEqual(createNavalDirector({ random: () => 0.1 }).step(FIRST_ROLL_S, ctx()).spawn, spawn);
  // another player where she would stand: she is stood clear of both
  const other = [spawn.pos[0], 0, spawn.pos[2]];
  const f = createNavalDirector({ random: () => 0.1 }).step(FIRST_ROLL_S, ctx({ players: [[0, 0, 0], other] })).spawn;
  if (f) for (const p of [[0, 0, 0], other]) assert.ok(Math.hypot(f.pos[0] - p[0], f.pos[2] - p[2]) >= SPAWN_CLEAR, 'never in sight of a player as she appears');
  // only open water deep enough for her hull
  const asked = [];
  const east = createNavalDirector({ random: () => 0.1 }).step(FIRST_ROLL_S, ctx({ isOpenWater: (x, z, hull) => { asked.push(hull); return x > 0; } })).spawn;
  assert.ok(east && east.pos[0] > 0, 'the water test decides');
  assert.ok(asked.every((h) => h === asked[0]) && typeof asked[0] === 'number', 'asked with her hull');
  assert.equal(createNavalDirector({ random: () => 0.1 }).step(FIRST_ROLL_S, ctx({ isOpenWater: () => false })).spawn, null, 'no water: the roll given up');
});

test('NAV-C the director keeps the density and lets ships go: none rolled while the sea is full or the chance fails; a ship past DESPAWN_BEYOND of every player and not fighting sails out (mutants: an engaged ship let go, the density ignored)', () => {
  const full = [1, 2, 3].map((i) => ({ id: `s${i}`, pos: [100 * i, 0, 0], classId: 'pirateSloop', engaged: false }));
  assert.equal(createNavalDirector({ random: () => 0.1 }).step(FIRST_ROLL_S, ctx({ ships: full })).spawn, null);
  assert.equal(createNavalDirector({ random: () => SHIP_SPAWN_CHANCE }).step(FIRST_ROLL_S, ctx()).spawn, null, 'the chance failed');
  assert.equal(createNavalDirector({ random: () => 0.1 }).step(FIRST_ROLL_S, ctx({ density: DENSITY.off })).spawn, null);
  const ships = [
    { id: 'far', pos: [DESPAWN_BEYOND + 1, 0, 0], engaged: false },
    { id: 'fighting', pos: [DESPAWN_BEYOND + 1, 0, 0], engaged: true },
    { id: 'near', pos: [DESPAWN_BEYOND - 1, 0, 0], engaged: false },
    { id: 'byOther', pos: [0, 0, DESPAWN_BEYOND + 1900], engaged: false },   // far from me, a hundred metres from the other player
  ];
  const { despawn } = createNavalDirector().step(0, ctx({ ships, players: [[0, 0, 0], [0, 0, DESPAWN_BEYOND + 2000]] }));
  assert.deepEqual(despawn, ['far']);
  // a despawned ship makes room in the same roll
  const room = createNavalDirector({ random: () => 0.1 }).step(FIRST_ROLL_S, ctx({ density: 1, ships: [{ id: 'far', pos: [DESPAWN_BEYOND + 1, 0, 0], engaged: false }] }));
  assert.deepEqual(room.despawn, ['far']);
  assert.ok(room.spawn);
  const d = createNavalDirector({ random: () => 0.1 });
  d.step(FIRST_ROLL_S, ctx());
  d.reset();
  assert.equal(d.step(FIRST_ROLL_S - 0.1, ctx()).spawn, null, 'reset: the first wait again');
  d.count = 7;
  assert.equal(d.count, 7);
});

test('NAV-C who sails: the open bay\'s weights, a port adding merchants and the navy, a notorious captain drawing HUNTERS - a navy ship laid straight at the player; one pirate flagship at a time (mutants: the port weights dropped, the hunter not aimed, two flagships)', () => {
  assert.deepEqual(factionWeights(), { ...FACTION_WEIGHTS });
  // SEA-EASE (PIN MOVED): a port's waters cut the pirates' weight to PORT_PIRATE_K - the crown's own waters
  assert.deepEqual(factionWeights({ nearPort: true }), { pirate: FACTION_WEIGHTS.pirate * PORT_PIRATE_K, merchant: FACTION_WEIGHTS.merchant + PORT_WEIGHTS.merchant, navy: FACTION_WEIGHTS.navy + PORT_WEIGHTS.navy });
  assert.equal(factionWeights({ notoriety: HUNTER_AT }).navy, FACTION_WEIGHTS.navy + HUNTER_WEIGHT);
  assert.equal(factionWeights({ notoriety: HUNTER_AT - 1 }).navy, FACTION_WEIGHTS.navy);
  const w = { a: 1, b: 0, c: 3 };
  assert.equal(weightedPick(w, 0), 'a');
  assert.equal(weightedPick(w, 0.25 - 1e-9), 'a');
  assert.equal(weightedPick(w, 0.25 + 1e-9), 'c', 'a weight of nought never drawn');
  assert.equal(weightedPick(w, 1), 'c');
  // a hunter: the first seed base whose ship is a navy one, at a notorious player
  let hunter = null;
  for (let base = 0; base < 400 && !hunter; base++) {
    const s = createNavalDirector({ random: () => 0.1 }).step(FIRST_ROLL_S, ctx({ seedBase: base, notoriety: HUNTER_AT })).spawn;
    if (s?.classId.startsWith('navy') && !s.encounter) hunter = s;   // SEA-PEACE: a patrol's navy hunts her pirate, not me
  }
  assert.ok(hunter, 'a navy ship among the seeds');
  assert.equal(hunter.hunter, true);
  near(hunter.yaw, Math.atan2(-hunter.pos[0], -hunter.pos[2]), 1e-9, 'laid straight at the player');
  // one flagship: the first seed base that sends one sends something else while one sails
  let base = -1;
  for (let b = 0; b < 2000 && base < 0; b++) {
    if (createNavalDirector({ random: () => 0.1 }).step(FIRST_ROLL_S, ctx({ seedBase: b, level: 20 })).spawn?.classId === 'pirateFlagship') base = b;
  }
  assert.ok(base >= 0, 'a flagship among the seeds');
  const again = createNavalDirector({ random: () => 0.1 }).step(FIRST_ROLL_S, ctx({ seedBase: base, level: 20, ships: [{ id: 'f', pos: [300, 0, 0], classId: 'pirateFlagship', engaged: true }] })).spawn;
  assert.ok(again);
  assert.notEqual(again.classId, 'pirateFlagship');
  // the waters' seed: the pixel and the day
  assert.equal(seedBaseOf(10, 20, 3), seedBaseOf(10, 20, 3));
  assert.notEqual(seedBaseOf(10, 20, 3), seedBaseOf(10, 20, 4));
  assert.notEqual(seedBaseOf(10, 20, 3), seedBaseOf(11, 20, 3));
});
