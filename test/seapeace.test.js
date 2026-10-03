// SEA-PEACE (2026-09-29, the player: "People shouldnt get attacked if not on a ship, some ships should be passive, not
// all should be hostile. Enemy AI and Friendly AI should engage in their own encounters naturally") - the sea's guns
// are for those aboard; a captain's temper and her fighting power; a stern chase run down and a struck ship taken; the
// navy answering the guns; the director's pairs already at it (bible/03-World/Naval-Combat.md "SEA-PEACE"). The pure
// captains driven directly, the host through real frames over Come Sail Away's own hulls (test/navalSea.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TEMPERS, BOLD_SHARE, WARY_ODDS, PLAYER_GUN_SKILL, HEAR_GUNS_M, HEAR_S, CHASE_AWAY, ABAFT_DEG, CHASE_SHEER, FLEE_RANGE, GRAPPLE_HULL,
  WIND_RATED, BOW_BEAR,
  createSeaShip, stepCaptain, hostile, provoke, temperOf, fightingPower, shipPower, classPower, outguns, lookoutOf, odds, strikeTime, hitShare, TURN_PER_VOLLEY,
} from '../src/systems/naval/navalAI.js';
import { HULL, GUNS, classById, SHIP_CLASSES, batteryOf, hullBuild } from '../src/systems/naval/navalShips.js';
import { SHIP_STATES, STRUCK_AT, HOLED_BONUS, WATERLINE_BAND } from '../src/systems/naval/navalDamage.js';
import { NAVAL_DEG } from '../src/systems/naval/navalBallistics.js';
import { reloadSeconds } from '../src/systems/naval/navalGunnery.js';
import {
  createNavalDirector, encounterClasses, encounterRng, ENCOUNTER_CHANCE, ENCOUNTER_GAP, ENCOUNTERS, FIRST_ROLL_S, SPAWN_RING, SPAWN_CLEAR,
  DENSITY, weightedPick,
} from '../src/systems/naval/navalDirector.js';
import { PRIZE_TAKE_S, PRIZE_COST, NEWS_RANGE, HOSTILE_NEAR_M } from '../src/scenes/navalHost.js';
import { navalHitData } from '../src/systems/naval/navalWire.js';
import { hash32 } from '../src/world/spawnedDungeons.js';
import { mulberry32 } from '../src/combat/bloodArt.js';
import { sea } from './navalSea.mjs';

const DEG = NAVAL_DEG;
const world = (o = {}) => ({ now: 0, dt: 0.1, seaY: 0, wind: [0, 0, WIND_RATED], isWater: () => true, contacts: [], random: () => 0.5, ...o });
const shipOf = (classId, o = {}) => createSeaShip({ id: o.id ?? classId, seed: o.seed ?? 1, classId, pos: o.pos ?? [0, 0, 0], yaw: o.yaw ?? 0, temper: o.temper ?? null });
const contactOf = (s, o = {}) => ({ id: s.id, kind: 'ship', faction: s.cls.faction, pos: s.pos, vel: [0, 0, 0], speed: 0, yaw: s.yaw, hull: s.hull, ship: s, ...o });
const me = (o = {}) => ({ id: 'me', kind: 'player', pos: [0, 0, 0], vel: [0, 0, 0], speed: 0, ...o });
const powerOfHull = (hull, o = {}) => fightingPower({ hull, hullHp: hullBuild(hull).hullHp, ...o });   // PIN MOVED (TOUGHER-SHIPS): her build's hull

// ── the sea's guns are for those aboard ────────────────────────────────────────────────────────────────────────────

test('SEA-PEACE aboard: a pirate a bay off is no enemy of a player ashore - no rest or journey held, no "Sail ho!", no threat a journey slows for; aboard (at her helm, on my boat\'s deck, on a sea ship\'s deck) she is (mutants: the gate dropped from hostileNear, from the threats, from the hail)', async () => {
  const ashore = await sea({ hull: null });
  ashore.host.spawnShip('pirateBrig', { range: 300, bearing: 0 });
  ashore.run(6);
  assert.equal(ashore.host.hostileNear(), false, 'a rest, a journey and the time scale are no ship\'s to hold ashore');
  assert.deepEqual(ashore.host.threats(), [], 'no journey slows for her');
  assert.ok(!ashore.log.say.some((t) => /Sail ho/.test(t)), 'no lookout\'s cry on the beach');
  // on her own deck (a sea ship's) the player is aboard: she is an enemy nearby again
  const e = [...ashore.host._sea.values()][0];
  ashore.view.feet = [...e.ship.pos];
  assert.equal(ashore.host.hostileNear(), true, 'on a sea ship\'s deck, aboard');
  // at a helm: the pirate is an enemy near, the journey slows, the lookout cries once
  const helm = await sea({ hull: HULL.LargeBoat });
  helm.host.spawnShip('pirateBrig', { range: 300, bearing: 0 });
  helm.run(3);
  assert.equal(helm.host.hostileNear(), true);
  assert.equal(helm.host.threats().length, 1);
  assert.ok(helm.log.say.some((t) => /Sail ho! A Pirate Brigantine/.test(t)));
  // off the helm on her deck - still aboard; walked a kilometre off onto the land - not
  helm.runtime.sailing = false;
  helm.view.feet = [0, 0.5, 0];
  assert.equal(helm.host.hostileNear(), true, 'on my boat\'s deck, aboard');
  helm.view.feet = [0, 0, -HOSTILE_NEAR_M * 0.5];
  assert.equal(helm.host.hostileNear(), false, 'ashore beside her waters: not');
});

// ── the tempers and the odds ───────────────────────────────────────────────────────────────────────────────────────

test('SEA-PEACE tempers: a merchant peaceful, a navy dutiful, a flagship bold, any other pirate bold on BOLD_SHARE of her seed\'s own draw and wary otherwise - the same seed the same temper in every client; a named temper stands; the host\'s hand-launched pirate comes to fight (mutants: the share\'s edge, the salt dropped, the flagship wary)', async () => {
  assert.equal(temperOf(classById('merchantGalleon'), 1), TEMPERS.peaceful);
  assert.equal(temperOf(classById('navyCutter'), 1), TEMPERS.dutiful);
  assert.equal(temperOf(classById('pirateFlagship'), 1), TEMPERS.wary === temperOf(classById('pirateFlagship'), 1) ? 'never' : TEMPERS.bold);
  const brig = classById('pirateBrig');
  for (const seed of [1, 6, 7, 99, 0xdeadbeef]) {
    const drawn = mulberry32(((seed >>> 0) ^ 0x7e3a9e1d) >>> 0)();
    assert.equal(temperOf(brig, seed), drawn < BOLD_SHARE ? TEMPERS.bold : TEMPERS.wary, `seed ${seed}`);
  }
  let bold = 0;
  for (let i = 0; i < 4000; i++) if (temperOf(brig, hash32(i, 7)) === TEMPERS.bold) bold++;
  assert.ok(Math.abs(bold / 4000 - BOLD_SHARE) < 0.03, `bold ${bold / 4000}`);
  assert.equal(createSeaShip({ id: 'x', seed: 6, classId: 'pirateBrig', pos: [0, 0, 0] }).temper, temperOf(brig, 6), 'her seed\'s');
  assert.equal(createSeaShip({ id: 'x', seed: 6, classId: 'pirateBrig', pos: [0, 0, 0], temper: 'wary' }).temper, TEMPERS.wary, 'named');
  assert.equal(createSeaShip({ id: 'x', seed: 6, classId: 'pirateBrig', pos: [0, 0, 0], temper: 'furious' }).temper, temperOf(brig, 6), 'no such temper: her seed\'s');
  const s = await sea({ hull: null });
  const p = s.host._sea.get(s.host.spawnShip('pirateSloop', { range: 300 }));
  const w = s.host._sea.get(s.host.spawnShip('pirateSloop', { range: 400, temper: 'wary' }));
  const m = s.host._sea.get(s.host.spawnShip('merchantCoaster', { range: 500 }));
  assert.equal(p.ship.temper, TEMPERS.bold, 'the Sea battle\'s foe and a console\'s come to fight');
  assert.equal(w.ship.temper, TEMPERS.wary);
  assert.equal(m.ship.temper, TEMPERS.peaceful);
});

// PIN MOVED (AUDIT NAV2 F25, Mac: "Model crew losses"): the weight of metal times the hull left is gone - a ship is sized
// against another by the time each needs to make the other strike (test/auditnav2_captains.test.js); here, its sum
test('SEA-PEACE fighting power (AUDIT NAV2 F25): her measure - her hull and build, the hull and men she has left, whether she strikes with them down, her gunners, range and turn - and the time she needs to make another strike: her broadside\'s balls (never the chasers, never a fire barrel, one side) each reload and the turn between, striking at the other\'s size, holing a low hull, the hull left above the strike line; a class sized fresh from port, a sea ship as she stands (mutants: the barrel counted, the port side twice, the hull share unread)', () => {
  const brig = classById('pirateBrig');
  const s = shipOf('pirateBrig');
  assert.deepEqual(shipPower(s), classPower(brig), 'fresh from port');
  assert.deepEqual([classPower(brig).hull, classPower(brig).hullHp, classPower(brig).crew, classPower(brig).strikes, classPower(brig).skill, classPower(brig).range, classPower(brig).tactic], [HULL.SmallShip, brig.hullHp, brig.crew, true, brig.skill, brig.range, 'broadside']);
  const mine = fightingPower({ hull: HULL.SmallShip, hullHp: 420 });
  assert.deepEqual([mine.strikes, mine.skill, mine.crewed], [false, PLAYER_GUN_SKILL, true], 'a player\'s boat never strikes; her gunners the player\'s');
  // the brig on my Small Ship (by her hull alone): one broadside, a volley each reload and TURN_PER_VOLLEY at her turn
  const bat = batteryOf(HULL.SmallShip, 'starboard');
  const perS = bat.muzzles.length / (reloadSeconds('long', 1, true) + TURN_PER_VOLLEY / classPower(brig).turn);
  const hullPerS = perS * hitShare(bat, brig.skill, HULL.SmallShip) * GUNS.long.hull * (1 + HOLED_BONUS * Math.min(1, WATERLINE_BAND / 10.92));
  assert.ok(Math.abs(strikeTime(classPower(brig), mine) - 420 * (1 - STRUCK_AT) / hullPerS) < 1e-6, 'one side, her broadside alone');
  assert.equal(strikeTime(fightingPower({ hull: HULL.Rowboat, hullHp: 60 }), mine), Infinity, 'a rowboat carries no gun');
  // her hull above the strike line: half as much, half the time
  const half = fightingPower({ hull: HULL.SmallShip, hullHp: 420, hullShare: STRUCK_AT + (1 - STRUCK_AT) / 2 });
  assert.ok(Math.abs(strikeTime(classPower(brig), half) - strikeTime(classPower(brig), mine) / 2) < 1e-6, 'half her hull, half the time');
  assert.ok(strikeTime(fightingPower({ ...classPower(brig), crewShare: 0.5 }), mine) > strikeTime(classPower(brig), mine), 'her men thinned, her guns load slower');
  s.damage.apply({ hull: Math.round(brig.hullHp / 2), sail: 0, crew: 0 });
  assert.ok(Math.abs(shipPower(s).hullShare - 0.5) < 0.01, 'as she stands');
});

// PIN MOVED (AUDIT NAV2 F25): the prizes the odds give - a Large Boat's swivels take two men a ball and she never
// strikes, so a wary brig leaves her be now; a Large Galley alone at her guns is the brig's prize
test('SEA-PEACE the odds: a wary pirate takes a prize she outguns WARY_ODDS to one - a Large Galley alone at her guns, not a Small Ship until it is holed or crippled - leaves one she cannot size up, and answers a blow; a bold one takes anything her trade does (mutants: the odds inverted, the holed hull unread, a blow unanswered)', () => {
  const wary = shipOf('pirateBrig', { temper: 'wary' });
  const bold = shipOf('pirateBrig', { temper: 'bold' });
  const boat = powerOfHull(HULL.LargeGalley, { crewed: false }), ship = powerOfHull(HULL.SmallShip);
  assert.ok(odds(shipPower(wary), boat) >= WARY_ODDS && odds(shipPower(wary), ship) < WARY_ODDS, 'the numbers the pins stand on');
  assert.equal(hostile(wary, me({ power: boat })), true, 'a Large Galley alone at her guns is her prize');
  assert.equal(hostile(wary, me({ power: ship })), false, 'a Small Ship she leaves be');
  assert.equal(hostile(wary, me({ power: ship, hullShare: GRAPPLE_HULL - 0.01 })), true, 'holed under GRAPPLE_HULL: prey');
  assert.equal(hostile(wary, me({ power: ship, crippled: true })), true, 'crippled: prey');
  assert.equal(hostile(wary, me()), false, 'a player she cannot size up (off every boat) she leaves be');
  assert.equal(hostile(bold, me()), true, 'bold: anything');
  assert.equal(hostile(bold, me({ power: powerOfHull(HULL.Carrack) })), true);
  provoke(wary, 'me', 5);
  assert.equal(hostile(wary, me({ power: powerOfHull(HULL.Carrack) }), { now: 6 }), true, 'a blow is answered by every temper');
  // ship against ship: a wary brig takes a galleon, never a coaster (her swivels take two men a ball); a navy takes every
  // pirate; a merchant no one
  const brig = shipOf('pirateBrig', { temper: 'wary' });
  const sloop = shipOf('pirateSloop', { temper: 'wary' });
  assert.equal(hostile(brig, contactOf(shipOf('merchantGalleon'))), true);
  assert.equal(hostile(brig, contactOf(shipOf('merchantCoaster'))), false);
  assert.equal(hostile(sloop, contactOf(shipOf('pirateBrig'))), false, 'never her own trade');
  assert.equal(hostile(shipOf('navyCutter'), contactOf(shipOf('pirateFlagship'))), true, 'the navy\'s duty');
  assert.equal(hostile(shipOf('merchantCarrack'), contactOf(sloop)), false);
  // outguns: the threat's odds over hers, one unsized never
  assert.equal(outguns(contactOf(shipOf('navyCutter')), shipOf('pirateBrig')), true);
  assert.equal(outguns(contactOf(shipOf('merchantGalleon')), shipOf('pirateBrig')), false);
  assert.equal(outguns(me(), shipOf('pirateBrig')), false);
});

// PIN MOVED (AUDIT NAV2 F25): my boat sized as the new measure has her - her men and whether they load her guns - and a
// wary brig's prize a Large Galley alone at her guns (a Large Boat's swivels she leaves be now: two men a ball)
test('SEA-PEACE the host sizes me up: my boat\'s power off her build and her hurts - single-handed without her crew - so a wary pirate leaves a sound Small Ship be and comes for a Large Galley alone at her guns, never one with her crew aboard (mutants: the crewless boat at full rate, the hurt unread)', async () => {
  const big = await sea({ hull: HULL.SmallShip });
  big.boat.crewed = false;
  const c = big.host._contacts().find((x) => x.kind === 'player');
  assert.deepEqual(c.power, fightingPower({ hull: HULL.SmallShip, hullHp: hullBuild(HULL.SmallShip).hullHp, crew: 24, crewed: false }), 'a boat without her crew loads single-handed');
  big.boat.crewed = true;
  assert.deepEqual(big.host._contacts().find((x) => x.kind === 'player').power, fightingPower({ hull: HULL.SmallShip, hullHp: hullBuild(HULL.SmallShip).hullHp, crew: 24 }));
  const w = big.host._sea.get(big.host.spawnShip('pirateBrig', { range: 300, temper: 'wary' }));
  big.run(4);
  assert.equal(w.ship.mode, 'cruise', 'a stronger ship: she sails on');
  assert.equal(big.host.hostileNear(), false);
  const alone = await sea({ hull: HULL.LargeGalley });
  alone.boat.crewed = false;
  const w2 = alone.host._sea.get(alone.host.spawnShip('pirateBrig', { range: 300, temper: 'wary' }));
  alone.run(4);
  assert.ok(w2.ship.mode === 'engage' || w2.ship.mode === 'board', `a prize: ${w2.ship.mode}`);
  assert.equal(w2.ship.target, 'local');
  const manned = await sea({ hull: HULL.LargeGalley });
  manned.boat.crewed = true;
  const w3 = manned.host._sea.get(manned.host.spawnShip('pirateBrig', { range: 300, temper: 'wary' }));
  manned.run(4);
  assert.equal(w3.ship.mode, 'cruise', 'her crew at her guns: no prize');
});

test('SEA-PEACE a wary pirate runs from a ship that outguns her, inside FLEE_RANGE - one that fired on her too - where a bold one stands and fights (mutants: the wary flight dropped, a weaker threat fled)', () => {
  const navy = shipOf('navyCutter', { id: 'n', pos: [0, 0, 200] });
  const flee = (temper, threat) => { const p = shipOf('pirateBrig', { id: 'p', temper }); stepCaptain(p, world({ contacts: [contactOf(threat)] })); return p; };
  assert.ok(200 < FLEE_RANGE);
  const w = flee('wary', navy);
  assert.equal(w.mode, 'flee');
  assert.equal(w.target, 'n');
  assert.equal(flee('bold', navy).mode, 'engage', 'bold: she fights');
  const galleon = shipOf('merchantGalleon', { id: 'c', pos: [0, 0, 200] });   // PIN MOVED (AUDIT NAV2 F25): a coaster's swivels outgun a brig now
  provoke(galleon, 'p', 0);
  assert.notEqual(flee('wary', galleon).mode, 'flee', 'a weaker ship she never runs from');
  // a player who fired on her and outguns her
  const p = shipOf('pirateSloop', { id: 'p', temper: 'wary' });
  provoke(p, 'me', 0);
  stepCaptain(p, world({ contacts: [me({ pos: [0, 0, 150], power: powerOfHull(HULL.SmallShip) })] }));
  assert.equal(p.mode, 'flee', 'outgunned and fired on: she runs');
});

// ── the stern chase ────────────────────────────────────────────────────────────────────────────────────────────────

test('SEA-PEACE the stern chase: a quarry running from her - her way away over CHASE_AWAY of the pursuer\'s pace - with the pursuer abaft her beam is run down dead astern (her chasers bear) and within CHASE_SHEER of her range she sheers for a berth abeam; a slow quarry is presented to (mutants: the pace unread, the sheer at any range, the abaft test)', () => {
  const run = (quarryPos, quarryVel, d0) => {
    const p = shipOf('pirateBrig', { id: 'p', temper: 'bold' });
    p.speed = 6;
    stepCaptain(p, world({ contacts: [{ ...contactOf(shipOf('merchantGalleon', { id: 'm', pos: quarryPos }), { vel: quarryVel, speed: Math.hypot(...quarryVel) }), yaw: Math.atan2(quarryVel[0], quarryVel[2]) }] }));
    return { p, d0 };
  };
  const range = classById('pirateBrig').range;
  // dead ahead, 180 m, running straight away at 4 m/s: the course is the quarry's intercept - her bow held on her, the
  // chasers bearing, for as long as the chase runs past CHASE_SHEER of her range (a berth off the beam would swing her
  // 28 degrees off)
  const far = run([0, 0, 180], [0, 0, 4]);
  assert.ok(180 > range * CHASE_SHEER);
  assert.equal(far.p.present, null, 'no side presented');
  {
    const p = shipOf('pirateBrig', { id: 'p', temper: 'bold' });
    p.speed = 6;
    const q = shipOf('merchantGalleon', { id: 'm', pos: [0, 0, 200] });
    for (let t = 0; t < 8; t += 0.1) {
      q.pos = [0, 0, 200 + 4 * t];
      stepCaptain(p, world({ now: t, contacts: [{ ...contactOf(q, { vel: [0, 0, 4], speed: 4 }), yaw: 0 }] }));
    }
    const off = Math.abs(Math.atan2(q.pos[0] - p.pos[0], q.pos[2] - p.pos[2]) - p.yaw) / DEG;
    assert.ok(off < BOW_BEAR, `her bow on the quarry - ${off.toFixed(1)} degrees off after 8 s`);
  }
  // close (under CHASE_SHEER of her range) and still astern: she sheers out for the berth abeam, toward the side she lies on
  const close = run([-5, 0, range * 1.1], [0, 0, 4]);
  assert.ok(close.p.yawRate > 0, 'sheering out to starboard - the side she lies on');
  // a quarry making little way (under CHASE_AWAY of her pace) is presented to as ever
  const slow = run([0, 0, 120], [0, 0, 0.4]);
  assert.ok(slow.p.present, 'a side presented');
  // a runner going away from a crippled pursuer that lies forward of ABAFT_DEG off her bow - 100 degrees - is no stern
  // chase however fast she opens it: the pursuer fires what bears as she passes
  {
    const p = shipOf('pirateBrig', { id: 'p', temper: 'bold' });
    p.damage.apply({ hull: 0, sail: p.damage.maxSail, crew: 0 });   // bare poles: her pace a third
    const at = 150, a = 100 * DEG;   // the pursuer 100 degrees off the quarry's bow
    const qYaw = Math.PI / 2;   // the quarry heading east
    const qPos = [-Math.sin(qYaw + a) * at, 0, -Math.cos(qYaw + a) * at];
    const v = [Math.sin(qYaw) * 10, 0, Math.cos(qYaw) * 10];   // opening it faster than CHASE_AWAY of her crippled pace
    assert.ok(10 * Math.cos(80 * DEG) > CHASE_AWAY * classById('pirateBrig').speed * 0.35, 'the runner outruns the pace test - the abaft test alone decides');
    stepCaptain(p, world({ contacts: [{ ...contactOf(shipOf('merchantGalleon', { id: 'm', pos: qPos }), { vel: v, speed: 10 }), yaw: qYaw }] }));
    assert.ok(p.present, 'forward of her beam: a side presented, never a chase');
  }
  assert.ok(CHASE_AWAY > 0 && ABAFT_DEG > 90);
});

// ── the ends of a fight between ships ─────────────────────────────────────────────────────────────────────────────

test('SEA-PEACE a prize taken: a navy that beats a pirate comes alongside her, grapples, lies lashed PRIZE_TAKE_S, then fires her - she founders - her own crew thinned by PRIZE_COST, and sails on; the news reaches my HUD within NEWS_RANGE (mutants: the prize never boarded, never fired, the crew uncharged, the news unbounded)', async () => {
  const s = await sea({ hull: null });
  const p = s.host._sea.get(s.host.spawnShip('pirateSloop', { range: 400, bearing: 0 }));   // the cutter's win here, and men to spare (PIN MOVED, AUDIT NAV2 F25: close, no longer fifteen to one)
  const n = s.host._sea.get(s.host.spawnShip('navyCutter', { range: 700, bearing: 299 * DEG }));
  let lashedAt = null, crewAt = null, prizeCrew = null;
  for (let t = 0; t < 600 && s.host._sea.has(p.id); t += 1) {
    s.run(1);
    if (n.ship.lashed && lashedAt == null) {
      lashedAt = t; crewAt = n.ship.damage.crew;
      assert.equal(p.takenBy, n.id); assert.equal(p.ship.damage.state, SHIP_STATES.struck);
      p.ship.damage.restore({ ...p.ship.damage.snapshot(), crew: 8 });   // men left aboard her to fight for the deck
      prizeCrew = p.ship.damage.crew;
      assert.equal(prizeCrew, 8);
      assert.ok(crewAt >= 2, `the victor has a man to lose (${crewAt})`);
    }
    if (lashedAt != null && !n.ship.lashed && p.ship.damage.state === SHIP_STATES.sinking && crewAt != null) {
      assert.ok(t - lashedAt >= PRIZE_TAKE_S - 1 && t - lashedAt <= PRIZE_TAKE_S + 1, `lashed ${t - lashedAt} s`);
      assert.equal(n.ship.damage.crew, crewAt - Math.min(crewAt - 1, Math.round(prizeCrew * PRIZE_COST)), 'the fight for her deck: her men left');
      assert.ok(n.ship.damage.crew < crewAt, 'the deck cost the victor men');
      assert.ok(p.ship.damage.fire > 0, 'her torch burns as she goes');
      crewAt = null;
    }
  }
  assert.ok(lashedAt != null, 'grappled');
  assert.equal(s.host._sea.has(p.id), false, 'gone under');
  assert.notEqual(n.ship.mode, 'board', 'sailing on');
  assert.ok(s.log.say.some((t) => /strikes her colours/.test(t)) && s.log.say.some((t) => /grapples/.test(t)) && s.log.say.some((t) => /puts her to the torch/.test(t)), JSON.stringify(s.log.say));
  // the same fight with me a bay off (past NEWS_RANGE, inside DESPAWN_BEYOND): nothing said, and the prize kept for her
  // taker though no player is near (the director lets no prize being taken go)
  const far = await sea({ hull: null });
  const fp = far.host._sea.get(far.host.spawnShip('pirateSloop', { range: 400, bearing: 0 }));
  far.host.spawnShip('navyCutter', { range: 700, bearing: 299 * DEG });
  far.view.feet = [0, 0, -(NEWS_RANGE - 200)];   // the pair 1,400-1,500 m off: past NEWS_RANGE, inside DESPAWN_BEYOND
  let burned = false;
  for (let t = 0; t < 600 && far.host._sea.has(fp.id); t++) { far.run(1); burned ||= fp.ship.damage.state === SHIP_STATES.sinking && fp.ship.damage.fire > 0; }
  assert.ok(burned, 'fought, taken and fired - never let go from under her taker');
  assert.deepEqual(far.log.say, [], 'no news of a fight out of sight');
});

test('SEA-PEACE a prize her taker comes for is in a fight: though every player is a bay off, the director lets neither go (mutants: the prize let go before the grapple)', async () => {
  const s = await sea({ hull: null });
  const p = s.host._sea.get(s.host.spawnShip('pirateSloop', { range: 400, bearing: 0 }));
  const n = s.host._sea.get(s.host.spawnShip('navyCutter', { range: 700, bearing: 299 * DEG }));
  for (let t = 0; t < 600 && p.ship.damage.state === SHIP_STATES.afloat; t++) s.run(1);
  assert.equal(p.ship.damage.state, SHIP_STATES.struck);
  assert.equal(n.ship.lashed, null, 'struck, not yet grappled');
  s.view.feet = [0, 0, -5000];
  s.run(2);
  assert.ok(s.host._sea.has(p.id) && s.host._sea.has(n.id), 'both kept');
  assert.ok(!p.retiring && !n.retiring, 'neither fading out of the world (AUDIT BAY A15: a ship let go stands in the sea while she fades)');
});

test('SEA-PEACE a victor struck casts off her prize to fight, and the prize is anyone\'s again; a prize I board is never hers (mutants: the lash kept under fire)', async () => {
  const s = await sea({ hull: null });
  const p = s.host._sea.get(s.host.spawnShip('pirateSloop', { range: 400, bearing: 0 }));   // the cutter's win here, and men to spare (PIN MOVED, AUDIT NAV2 F25: close, no longer fifteen to one)
  const n = s.host._sea.get(s.host.spawnShip('navyCutter', { range: 700, bearing: 299 * DEG }));
  for (let t = 0; t < 600 && !n.ship.lashed; t++) s.run(1);
  assert.ok(n.ship.lashed, 'lashed');
  assert.equal(s.host.applyPeerHit('peerX', navalHitData('local', { n: n.n, hull: 1 })), true);
  assert.equal(n.ship.lashed, null, 'cast off');
  assert.equal(p.takenBy, null, 'the prize is anyone\'s');
});

// ── the navy answers the guns ──────────────────────────────────────────────────────────────────────────────────────

test('SEA-PEACE the guns heard: a navy with no enemy in sight sails for gunfire within HEAR_GUNS_M fired in the last HEAR_S - never her own, never a stale report, never one inside half her lookout - and a pirate hears nothing of it (mutants: the age unread, her own guns answered, the range unread)', () => {
  const navy = () => shipOf('navyCutter', { id: 'n' });
  const heard = (gunfire, now = 100, s = navy()) => { stepCaptain(s, world({ now, gunfire })); return s; };
  const at = [HEAR_GUNS_M * 0.8, 0, 0];
  const a = heard([{ pos: at, at: 100 - HEAR_S + 1, by: 'x' }]);
  assert.equal(a.mode, 'answer');
  assert.ok(a.yawRate > 0, 'turning toward the guns (to starboard)');
  assert.equal(heard([{ pos: at, at: 100 - HEAR_S - 1, by: 'x' }]).mode, 'cruise', 'a stale report');
  assert.equal(heard([{ pos: at, at: 100, by: 'n' }]).mode, 'cruise', 'her own guns');
  assert.equal(heard([{ pos: [HEAR_GUNS_M + 50, 0, 0], at: 100, by: 'x' }]).mode, 'cruise', 'out of hearing');
  assert.equal(heard([{ pos: [lookoutOf(navy()) * 0.4, 0, 0], at: 100, by: 'x' }]).mode, 'cruise', 'in her own lookout: the table decides');
  const pirate = shipOf('pirateBrig', { id: 'p', temper: 'bold' });
  stepCaptain(pirate, world({ now: 100, gunfire: [{ pos: at, at: 100, by: 'x' }] }));
  assert.equal(pirate.mode, 'cruise', 'the crown\'s peace is the navy\'s');
});

test('SEA-PEACE the host hears the guns: every volley\'s first report is kept HEAR_S for the captains - a pirate raiding a merchantman draws a navy out of her lookout toward the fight (mutants: the report unkept)', async () => {
  const s = await sea({ hull: null, seed: 9 });
  s.host.spawnShip('pirateBrig', { range: 300, bearing: 0, temper: 'wary' });
  s.host.spawnShip('merchantGalleon', { range: 450, bearing: 0.3 });
  // inside HEAR_GUNS_M of the fight (1,200 m) and outside her own lookout - where only the guns can tell her (HELM-WAY: at
  // 1,700 m she heard them only when her own cruise happened to bear toward them)
  const n = s.host._sea.get(s.host.spawnShip('navyCutter', { range: 900, bearing: Math.PI }));
  assert.ok(Math.hypot(...n.ship.pos) + 300 < HEAR_GUNS_M && Math.hypot(...n.ship.pos) > lookoutOf(n.ship));
  let answered = false;
  for (let t = 0; t < 80 && !answered; t++) { s.run(1); answered = n.ship.mode === 'answer'; }
  assert.ok(answered, 'she answered the guns');
});

// ── the bay's own fights ───────────────────────────────────────────────────────────────────────────────────────────

test('SEA-PEACE the director\'s pairs: of the rolls that launch with room for two, ENCOUNTER_CHANCE on the spawn\'s own stream launch a hunter with her quarry ENCOUNTER_GAP ahead on her course - a pirate on a merchantman she outguns WARY_ODDS to one, or a navy on a pirate; a single roll draws what it always drew (mutants: the chance, the pair\'s stream shared, the plunder\'s odds, room for one)', () => {
  // a roll whose pair's stream says yes, and one whose says no - PIN MOVED (AUDIT NAV2 F25): one that past the chance
  // would draw a pair (a corsair galley has no merchantman to plunder now, so the first "no" drew none either way)
  const ctx = (o = {}) => ({ density: DENSITY.some, player: [0, 0, 0], players: null, level: 9, ships: [], isOpenWater: () => true, nearPort: false, notoriety: 0, seedBase: 0, seaY: 0, ...o });
  let pairBase = -1, singleBase = -1;
  for (let b = 0; b < 400 && (pairBase < 0 || singleBase < 0); b++) {
    const r = encounterRng(hash32(b, 0));
    const yes = r() < ENCOUNTER_CHANCE;
    if (yes && pairBase < 0) pairBase = b;
    if (!yes && singleBase < 0 && encounterClasses(weightedPick(ENCOUNTERS, r()), 9, r)) singleBase = b;
  }
  const pair = createNavalDirector({ random: () => 0.1 }).step(FIRST_ROLL_S, ctx({ seedBase: pairBase })).spawn;
  assert.ok(pair?.company, 'a pair');
  assert.ok(Object.keys(ENCOUNTERS).includes(pair.encounter));
  const gap = Math.hypot(pair.company.pos[0] - pair.pos[0], pair.company.pos[2] - pair.pos[2]);
  assert.ok(gap >= ENCOUNTER_GAP[0] - 1e-6 && gap <= ENCOUNTER_GAP[1] + 1e-6, `${gap} m apart`);
  const ahead = [Math.sin(pair.yaw), Math.cos(pair.yaw)];
  assert.ok((pair.company.pos[0] - pair.pos[0]) * ahead[0] + (pair.company.pos[2] - pair.pos[2]) * ahead[1] > 0, 'the quarry ahead of her hunter');
  assert.equal(pair.company.seed, hash32(pairBase, 1), 'the company\'s seed the next count\'s');
  for (const x of [pair, pair.company]) { const r = Math.hypot(x.pos[0], x.pos[2]); assert.ok(r >= SPAWN_RING[0] - ENCOUNTER_GAP[1] && r <= SPAWN_RING[1] + ENCOUNTER_GAP[1] && r >= SPAWN_CLEAR, `${r} m`); }
  const [h, q] = [classById(pair.classId), classById(pair.company.classId)];
  if (pair.encounter === 'plunder') { assert.equal(h.faction, 'pirate'); assert.equal(q.faction, 'merchant'); assert.ok(odds(classPower(h), classPower(q)) >= WARY_ODDS); }   // PIN MOVED (AUDIT NAV2 F25): the odds
  else { assert.equal(h.faction, 'navy'); assert.equal(q.faction, 'pirate'); assert.equal(q.flagship, false); }
  // room for one: never a pair
  assert.equal(createNavalDirector({ random: () => 0.1 }).step(FIRST_ROLL_S, ctx({ seedBase: pairBase, density: 1 })).spawn?.company, undefined);
  // a single roll's ship is the one its own stream always drew
  const single = createNavalDirector({ random: () => 0.1 }).step(FIRST_ROLL_S, ctx({ seedBase: singleBase })).spawn;
  const alone = createNavalDirector({ random: () => 0.1 }).step(FIRST_ROLL_S, ctx({ seedBase: singleBase, density: 1 })).spawn;
  assert.equal(single.company, undefined);
  assert.deepEqual(single, alone, 'the pair\'s roll moved nothing of the single spawn\'s');
  // the classes: plunder only merchantmen the pirate outguns; patrol a navy on a pirate never the flagship
  for (let i = 0; i < 200; i++) {
    const r = mulberry32(i);
    const pl = encounterClasses('plunder', 9, r);
    if (pl) assert.ok(odds(classPower(pl.hunter), classPower(pl.quarry)) >= WARY_ODDS && !pl.hunter.flagship);
    const pa = encounterClasses('patrol', 9, r);
    assert.ok(pa && pa.hunter.faction === 'navy' && pa.quarry.faction === 'pirate' && !pa.quarry.flagship);
  }
  assert.ok(weightedPick(ENCOUNTERS, 0) === 'plunder');
  assert.ok(SHIP_CLASSES.some((c) => c.faction === 'merchant' && c.minLevel <= 1 && odds(classPower(classById('pirateSloop')), classPower(c)) >= WARY_ODDS), 'the least pirate has a prize at level 1');
});

test('SEA-PEACE the host stands a pair: both ships launched, the hunter at her quarry from the first steps (mutants: the company unlaunched)', async () => {
  const s = await sea({ hull: null, settings: { ShipsAtSea: 'some' } });
  let pair = null;
  const orig = s.host.directorState.step;
  s.host.directorState.step = (dt, ctx) => {
    const out = orig.call(s.host.directorState, dt, ctx);
    if (!pair && !out.spawn && ctx.density >= 2) {
      const cls = [classById('pirateBrig'), classById('merchantGalleon')];
      out.spawn = { seed: 5, classId: cls[0].id, variant: 0, pos: [600, 0, 0], yaw: 0, hunter: false, encounter: 'plunder', company: { seed: 6, classId: cls[1].id, variant: 0, pos: [600, 0, 180], yaw: 0, hunter: false } };
      pair = out.spawn;
    }
    return out;
  };
  for (let t = 0; t < 30 && !pair; t++) s.run(1);
  assert.ok(pair, 'the pair launched');
  s.run(4);
  const ships = [...s.host._sea.values()];
  const hunter = ships.find((e) => e.ship.seed === 5), quarry = ships.find((e) => e.ship.seed === 6);
  assert.ok(hunter && quarry, 'both at sea');
  assert.equal(hunter.ship.target, quarry.id, 'the hunter at her quarry');
  assert.equal(quarry.ship.mode, 'flee', 'the quarry running');
});
