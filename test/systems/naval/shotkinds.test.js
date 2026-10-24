// SHOT-KINDS (2026-10-17, the owner: "Different cannon shot types, for example a grape shot to thin out crew, Chain to try
// to take down their sail, etc"; bible/03-World/Naval-Refit.md SHOT-KINDS) - WHAT A BATTERY IS LOADED WITH: the law's own
// numbers (systems/naval/shotKinds.js), the deck's loads and their reload (navalGunnery.js), the ball that keeps its load
// and says it (navalShots.js), the blow it strikes on the real naval host (test/navalSea.mjs), the room's word (navalWire.js
// `o`), the helm's choice (scenes/naval/navalLoads.js), the captains' grape (navalAI.js captainLoads), the HUD's words,
// each load's ball and effects, and the world's wiring. tools/mutants/shotkinds.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { SHOT_ORDER, SHOT_CODES, SHOT, GRAPE_FULL_S, GRAPE_SPENT_S, SHOT_SWITCH, shotId, naturalShot, shotGun, shotFireChance, shotRigFire, shotReach, nextShot } from '../../../src/systems/naval/shotKinds.js';
import { GUNS, HULL, hullBuild, batteryOf } from '../../../src/systems/naval/navalShips.js';
import { aimSolution, volleyLaunches, reloadSeconds, createGunDeck, LOAD_GROUPS, loadGroupOf, loadOf } from '../../../src/systems/naval/navalGunnery.js';
import { createShotField } from '../../../src/systems/naval/navalShots.js';
import { FIRE_CHANCE } from '../../../src/systems/naval/navalDamage.js';
import { navalWireRecord, validNavalRecord } from '../../../src/systems/naval/navalWire.js';
import { createNavalLoads, SHOT_WHEEL_S, shotName, groupName, gunSideOf } from '../../../src/scenes/naval/navalLoads.js';
import { captainLoads, boarderBroadsides, GRAPE_CLOSE_M, GRAPE_KEEP } from '../../../src/systems/naval/navalAI.js';
import { navalHudText } from '../../../src/ui/naval/navalHud.js';
import { ballPictures, GRAPE_PELLETS, CHAIN_HALF_M } from '../../../src/render/navalRender.js';
import { createNavalEffects, SPATTER_M } from '../../../src/systems/naval/navalEffects.js';
import { helmButtons } from '../../../src/ui/enhanced/enhancedHelm.js';
import { ACTIONS, ACTION_GROUPS, DEFAULT_BINDINGS, MOD_ACTIONS } from '../../../src/systems/inputActions.js';
import { PLUS_BIND_ROWS } from '../../../src/ui/plus/plusPadBinds.js';
import { sea } from '../../navalSea.mjs';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

test('SHOT-KINDS the law: four loads in the cycle\'s order, each its code its place; every factor over the gun\'s OWN load - a long gun\'s grape a fifth of its ball\'s hull and four times its men, a chaser\'s round shot a long gun\'s kind of ball - and a gun loaded with its own load (or none said) the row itself; heated shot\'s fire and its canvas; grape\'s men falling off past GRAPE_FULL_S to half at GRAPE_SPENT_S; the cycle on and back (mutants: each factor, the natural load, the reach\'s ends, the cycle\'s wrap)', () => {
  assert.deepEqual(SHOT_ORDER, ['round', 'grape', 'chain', 'heated']);
  assert.deepEqual(SHOT_CODES, { round: 0, grape: 1, chain: 2, heated: 3 });
  assert.equal(shotId('grape'), 'grape');
  assert.equal(shotId('canister'), 'round', 'an unknown load is round shot');
  assert.equal(naturalShot('chain'), 'chain', 'the chasers\' row IS chain shot');
  for (const g of ['long', 'swivel', 'heavy', 'barrel']) assert.equal(naturalShot(g), 'round');
  // its own load, or none said: the very row
  assert.equal(shotGun('long', GUNS.long, 'round'), GUNS.long);
  assert.equal(shotGun('long', GUNS.long, null), GUNS.long);
  assert.equal(shotGun('chain', GUNS.chain, 'chain'), GUNS.chain);
  assert.equal(shotGun('chain', GUNS.chain, null), GUNS.chain, 'a chaser\'s ball that says nothing is chain, as it always was');
  assert.equal(shotGun('barrel', GUNS.barrel, 'grape'), GUNS.barrel, 'a barrel carries no load');
  const grape = shotGun('long', GUNS.long, 'grape');
  assert.equal(grape.shot, 'grape');
  assert.ok(close(grape.hull, GUNS.long.hull * 0.2) && close(grape.crew, GUNS.long.crew * 4) && close(grape.sail, GUNS.long.sail * 0.6));
  assert.ok(close(grape.speed, GUNS.long.speed * 0.82) && close(grape.yawSpread, GUNS.long.yawSpread * 2.4) && close(grape.pitchSpread, GUNS.long.pitchSpread * 2.4));
  assert.ok(close(grape.radius, GUNS.long.radius + 0.45) && close(grape.reload, GUNS.long.reload * 0.9));
  const chain = shotGun('long', GUNS.long, 'chain');
  assert.ok(close(chain.sail, GUNS.long.sail * 4) && close(chain.hull, GUNS.long.hull * 0.22) && close(chain.reload, GUNS.long.reload * 1.15));
  // a chaser loaded with round: its chain's factors undone
  const ball = shotGun('chain', GUNS.chain, 'round');
  assert.ok(close(ball.hull, GUNS.chain.hull / 0.22) && close(ball.sail, GUNS.chain.sail / 4) && close(ball.speed, GUNS.chain.speed / 0.9));
  assert.ok(close(ball.radius, GUNS.chain.radius), 'a sweep never shrinks below the bore\'s own');
  const hot = shotGun('long', GUNS.long, 'heated');
  assert.ok(close(hot.hull, GUNS.long.hull * 0.85) && close(hot.reload, GUNS.long.reload * 1.6));
  assert.equal(shotFireChance('heated', FIRE_CHANCE), SHOT.heated.fire);
  assert.equal(shotFireChance('round', FIRE_CHANCE), FIRE_CHANCE);
  assert.equal(shotFireChance(null, FIRE_CHANCE), FIRE_CHANCE, 'none said: the gun\'s own');
  assert.equal(shotRigFire('heated'), true);
  assert.equal(shotRigFire('chain'), false);
  assert.equal(shotRigFire(null), false);
  assert.equal(shotReach('grape', GRAPE_FULL_S), 1);
  assert.ok(close(shotReach('grape', (GRAPE_FULL_S + GRAPE_SPENT_S) / 2), 0.75));
  assert.equal(shotReach('grape', GRAPE_SPENT_S), 0.5);
  assert.equal(shotReach('grape', GRAPE_SPENT_S + 5), 0.5, 'spent, never less');
  assert.equal(shotReach('round', 9), 1);
  assert.equal(shotReach(null, 9), 1);
  assert.equal(nextShot('round'), 'grape');
  assert.equal(nextShot('heated'), 'round', 'round again');
  assert.equal(nextShot('round', -1), 'heated');
  assert.equal(nextShot('grape', -1), 'round');
});

test('SHOT-KINDS the gunnery: the aim laid with its load\'s muzzle speed and said on the solution (a long gun\'s grape falls shorter and is laid higher), a volley\'s launches flown with its speed and its scatter and carrying it; the reload the load\'s (mutants: the load unread, the solution\'s shot dropped, the launches\' shot dropped, the reload\'s load)', () => {
  const ship = { position: [0, 0, 0], rotation: [0, 0, 0, 1], velocity: [0, 0, 0], hull: HULL.SmallShip };
  const round = aimSolution(ship, 'starboard', null, 0, { range: 120 });
  const grape = aimSolution(ship, 'starboard', null, 0, { range: 120, shot: 'grape' });
  assert.equal(round.shot, 'round', 'none said: the bore\'s own');
  assert.equal(grape.shot, 'grape');
  assert.ok(grape.maxRange < round.maxRange, `grape\'s reach ${grape.maxRange} under round\'s ${round.maxRange}`);
  assert.ok(grape.elevation > round.elevation, 'slower, laid higher for the same range');
  assert.equal(aimSolution(ship, 'bow', null, 0, { range: 60 }).shot, 'chain', 'the chasers\' own');
  const stern = aimSolution({ ...ship, hull: HULL.SmallShip }, 'stern', null, 0, { shot: 'grape' });
  assert.equal(stern?.barrel ? stern.shot : null, null, 'a barrel says none');
  const lr = volleyLaunches(round, 7, { skill: 1 }), lg = volleyLaunches(grape, 7, { skill: 1 });
  assert.ok(lg.every((l) => l.shot === 'grape') && lr.every((l) => l.shot === 'round'));
  const speed = (l) => Math.hypot(...l.v0);
  assert.ok(close(speed(lg[0]), GUNS.long.speed * 0.82, 1e-6), 'flown at its own muzzle speed');
  // its scatter: the same draw, wider
  const yaw = (l) => Math.atan2(l.v0[2], l.v0[0]);
  const fan = (ls) => Math.max(...ls.map(yaw)) - Math.min(...ls.map(yaw));
  assert.ok(fan(lg) > fan(lr) * 2, 'grape opens wider on the same seed');
  assert.equal(reloadSeconds('long', 1, true), GUNS.long.reload);
  assert.ok(close(reloadSeconds('long', 1, true, 'heated'), GUNS.long.reload * 1.6));
  assert.ok(close(reloadSeconds('chain', 1, true, 'round'), GUNS.chain.reload / 1.15), 'a chaser\'s round shot loads quicker than its chain');
  assert.equal(reloadSeconds('barrel', 1, true, 'heated'), reloadSeconds('barrel', 1, true), 'a barrel\'s drop is its own');
  assert.equal(loadOf('barrel', 'grape'), null);
  assert.equal(loadOf('chain', null), 'chain');
  assert.equal(loadOf('long', 'bogus'), 'round');
});

test('SHOT-KINDS the deck\'s loads: each group its bores\' own until changed - the broadsides as one, the bow, the stern - a loaded battery drawn and loaded again in SHOT_SWITCH of the new load\'s reload, one reloading taking the new shot in on a clock scaled to it; a group\'s own load said as none; nothing for the barrels; the save keeps them (mutants: one broadside alone, the switch\'s share, the scale, the natural said, the barrels loaded, the restore)', () => {
  assert.deepEqual(LOAD_GROUPS, ['broadside', 'bow', 'stern']);
  assert.equal(loadGroupOf('port'), 'broadside');
  assert.equal(loadGroupOf('bow'), 'bow');
  assert.equal(loadGroupOf('nowhere'), null);
  const deck = createGunDeck(HULL.SmallShip);
  assert.equal(deck.load('starboard'), 'round');
  assert.equal(deck.load('bow'), 'chain');
  assert.equal(deck.load('stern'), null, 'her stern drops barrels');
  assert.deepEqual(deck.snapshot().loads, { broadside: null, bow: null, stern: null });
  assert.equal(deck.setLoad('stern', 'grape'), false, 'no guns to load');
  assert.equal(deck.setLoad('port', 'round'), false, 'already so');
  assert.equal(deck.setLoad('port', 'grape'), true);
  assert.equal(deck.load('starboard'), 'grape', 'both broadsides as one');
  const sw = SHOT_SWITCH * GUNS.long.reload * 0.9;
  assert.ok(close(deck.left('starboard'), sw) && close(deck.left('port'), sw), `drawn and loaded again in ${sw}`);
  assert.equal(deck.ready('port'), false);
  assert.equal(deck.left('bow'), 0, 'the chasers untouched');
  // a battery reloading takes the new shot in: its clock scaled to the new load's
  deck.step(sw);
  deck.fired('starboard');
  assert.ok(close(deck.left('starboard'), GUNS.long.reload * 0.9));
  deck.step(1);
  const before = deck.left('starboard');
  deck.setLoad('starboard', 'heated');
  assert.ok(close(deck.left('starboard'), before * (1.6 / 0.9)), 'scaled to the heated shot\'s reload');
  assert.ok(close(deck.left('port'), SHOT_SWITCH * GUNS.long.reload * 1.6), 'the loaded side drawn');
  assert.deepEqual(deck.snapshot().loads, { broadside: 'heated', bow: null, stern: null });
  deck.setLoad('bow', 'round');
  assert.equal(deck.snapshot().loads.bow, 'round');
  deck.setLoad('bow', 'chain');
  assert.equal(deck.snapshot().loads.bow, null, 'the chasers\' own chain said as none');
  // the save: a fresh deck reads the loads back, its own said as none, an unknown dropped
  const again = createGunDeck(HULL.SmallShip);
  again.restoreLoads({ broadside: 'grape', bow: 'chain', stern: 'heated' });
  assert.deepEqual(again.snapshot().loads, { broadside: 'grape', bow: null, stern: null });
  again.restore({ clocks: {}, barrels: 2, loads: { broadside: 'bogus' } });
  assert.equal(again.load('port'), 'round', 'an unknown load is round shot');
  // a crew's reload scale rides the switch
  const slow = createGunDeck(HULL.SmallShip, { reloadScale: () => 1.5 });
  slow.setLoad('starboard', 'chain');
  assert.ok(close(slow.left('starboard'), SHOT_SWITCH * GUNS.long.reload * 1.15 * 1.5));
});

test('SHOT-KINDS the ball keeps its load: swept with its load\'s radius (a bag of grape meets what a ball would pass), every event it raises saying its load, a hit its flight\'s time aloft (mutants: the radius the bore\'s, the shot dropped from the hit, the time unmeasured)', () => {
  const ev = [];
  // a box whose floor is 0.3 m over the ball's line where it passes (its arc tops out over x 30): a round ball (0.11)
  // passes under it, grape (0.56) strikes it
  const box = { c: [30, 1.3, 0], ax: [1, 0, 0], ay: [0, 1, 0], az: [0, 0, 1], h: [1, 1, 1] };
  const field = createShotField({ seaY: () => -50, targets: () => [{ id: 'her', box, rig: [] }], onEvent: (e) => ev.push(e) });
  const launch = (shot) => ({ delay: 0, p0: [0, 0, 0], v0: [60, 2.4525, 0], gun: 'long', shot, weight: 1, index: 0 });
  field.fireVolley({ id: 'r', shooter: 'me', launches: [launch('round')] });
  field.fireVolley({ id: 'g', shooter: 'me', launches: [launch('grape')] });
  for (let i = 0; i < 20; i++) field.step(0.05);
  const hit = ev.find((e) => e.type === 'hit');
  assert.ok(hit, 'struck');
  assert.equal(hit.volley, 'g', 'the grape, never the ball');
  assert.equal(hit.shot, 'grape');
  assert.ok(hit.t > 0.4 && hit.t < 0.55, `its time aloft ${hit.t}`);
  assert.equal(ev.find((e) => e.type === 'muzzle' && e.volley === 'g').shot, 'grape');
  assert.ok(!ev.some((e) => e.type === 'hit' && e.volley === 'r'), 'the ball passed');
  const drawn = createShotField({ seaY: () => -50, targets: () => [] });
  drawn.fireVolley({ id: 'h', shooter: 'me', launches: [launch('heated')] });
  drawn.step(0.2);
  const b = drawn.balls()[0];
  assert.equal(b.shot, 'heated');
  assert.ok(close(b.age, 0.2, 1e-9) && b.vel.length === 3, 'its age and its way, for the draw');
});

async function strikeWith(shot, { y = 3, z = 0, roll = 5, t = 0.3 } = {}) {
  const h = await sea({ hull: HULL.SmallShip, wind: [0, 0, 0], seed: roll });
  const id = h.host.spawnShip('merchantGalleon', { range: 150, bearing: Math.PI / 2, yaw: 0 });
  const e = h.host._sea.get(id);
  e.ship.pos = [150, 0, 0];
  h.host.frame(0.1);
  const d0 = { hull: e.ship.damage.hull, crew: e.ship.damage.crew, sail: e.ship.damage.sail };
  h.host._shots.fireVolley({ id: 'v1', shooter: 'me:42', launches: [{ delay: 0, p0: [150 - hullBuild(e.ship.hull).halfWidth - 3 - 60 * t, y, z], v0: [60, 0.5 + 4.905 * t, 0], gun: 'long', shot, weight: 1, index: 0 }], resolve: true });   // lobbed to meet her at its height after `t` aloft
  h.host._shots.step(0);
  h.run(0.2 + t);
  return { h, e, hull: d0.hull - e.ship.damage.hull, crew: d0.crew - e.ship.damage.crew, sail: d0.sail - e.ship.damage.sail };
}

test('SHOT-KINDS on the real host: a ball\'s blow is its load\'s - grape a sliver of a ball\'s hole and more men, its men fewer past GRAPE_FULL_S aloft; the loads read off the deck for the aim and said to the room only when not the bores\' own; the save keeps them (mutants: the loaded gun unread, the reach unread, the natural said on the wire, the loads unsaved)', async () => {
  const round = await strikeWith('round');
  const grape = await strikeWith('grape');
  assert.ok(round.hull > 0 && grape.hull > 0, `both holed her: ${round.hull}, ${grape.hull}`);
  assert.ok(grape.hull < round.hull * 0.4, `grape ${grape.hull} under a ball's ${round.hull}`);
  // the men: summed over seeds (each ball's odd man is its roll)
  let rm = 0, gm = 0, far = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    rm += (await strikeWith('round', { roll: seed })).crew;
    gm += (await strikeWith('grape', { roll: seed })).crew;
    far += (await strikeWith('grape', { roll: seed, t: GRAPE_SPENT_S + 0.4 })).crew;
  }
  assert.ok(gm > rm * 2, `grape's men ${gm} over a ball's ${rm}`);
  assert.ok(far > 0 && far < gm, `spent grape ${far} under close grape ${gm}`);
  // heated shot sets her alight where a cold ball seldom does - and through her canvas too (SHOT.heated.fire, rigFire)
  let hotFires = 0, coldFires = 0, rigFires = 0;
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    hotFires += (await strikeWith('heated', { roll: seed })).e.ship.damage.fire > 0 ? 1 : 0;
    coldFires += (await strikeWith('round', { roll: seed })).e.ship.damage.fire > 0 ? 1 : 0;
    const rig = await strikeWith('heated', { roll: seed, y: 15, z: 0.9 });   // through her main course, over her hull's roof
    rigFires += rig.e.ship.damage.fire > 0 ? 1 : 0;
  }
  assert.ok(hotFires >= 2 && hotFires > coldFires, `heated ${hotFires} of 8 alight, round ${coldFires}`);
  assert.ok(rigFires >= 1, `heated shot through her canvas alone set ${rigFires} alight`);
  // the helm's aim lays with the deck's load; the volley's word says it only when it is not her bores' own
  const h = await sea({ hull: HULL.SmallShip });
  const st = h.host._myState(h.boat);
  st.guns.setLoad('starboard', 'chain');
  h.view.look = { origin: [0, 5, 0], dir: [1, -0.05, 0] };
  assert.equal(h.host.attackInput(true), true);
  h.host.frame(0.1);
  assert.equal(h.host.hudModel().aim.shot, 'chain');
  assert.equal(h.host.hudModel().batteries.find((b) => b.side === 'port').shot, 'chain');
  for (let i = 0; i < 60 && !st.guns.ready('starboard'); i++) h.host.frame(0.1);
  h.host.attackInput(true); h.host.frame(0.1); h.host.attackInput(false);
  const said = h.host.volleyWire.at(-1);
  assert.equal(said?.side, 'starboard');
  assert.equal(said.shot, 'chain', 'a load not her bores\' own, said');
  st.guns.setLoad('starboard', 'round');
  for (let i = 0; i < 200 && !st.guns.ready('starboard'); i++) h.host.frame(0.1);
  h.host.attackInput(true); h.host.frame(0.1); h.host.attackInput(false);
  assert.equal(h.host.volleyWire.at(-1)?.side, 'starboard');
  assert.equal(h.host.volleyWire.at(-1).shot, null, 'her own round shot says nothing');
  // the save
  st.guns.setLoad('bow', 'grape');
  const save = h.host.getSaveData();
  assert.deepEqual(save.boats[42].loads, { broadside: null, bow: 'grape', stern: null });
  const back = await sea({ hull: HULL.SmallShip, save });
  assert.equal(back.host._myState(back.boat).guns.load('bow'), 'grape');
});

test('SHOT-KINDS the room\'s word: `o` names the volleys loaded with other than their bores\' own by SHOT_CODES, the reader setting each volley\'s shot - an older word\'s none, a pair for no volley nothing; a bad pair fails the word whole (mutants: the code unread, the door\'s bounds, the length)', () => {
  const vo = (id, shot) => ({ id, shooter: -1, hull: 2, side: 'port', pos: [1, 2, 3], yaw: 0.5, vel: [1, 0, 0], elevation: 0.1, seed: 9, skill: 0.5, age: 10, shot });
  const rec = navalWireRecord({ volleys: [vo(5, 'grape'), vo(6, null), vo(7, 'heated')] });
  assert.deepEqual(rec.o, [[5, 1], [7, 3]]);
  const back = validNavalRecord(rec);
  assert.deepEqual(back.volleys.map((v) => v.shot ?? null), ['grape', null, 'heated']);
  assert.equal('o' in navalWireRecord({ volleys: [vo(6, null)] }), false, 'nothing said for the bores\' own');
  assert.ok(validNavalRecord({ ...rec, o: [[99, 2]] }), 'a pair for no volley reads as nothing');
  for (const bad of [[[5, 4]], [[5, -1]], [[5]], [[-1, 1]], 'x', Array.from({ length: 13 }, () => [5, 1])]) assert.equal(validNavalRecord({ ...rec, o: bad }), null, JSON.stringify(bad));
});

test('SHOT-KINDS the helm\'s choice: the group laid, else the one the look bears on, else her first with guns, stepped on and said; the wheel the guns\' while they are laid - one step a SHOT_WHEEL_S - and nobody\'s else; the helm button\'s words; a boat with no guns nothing (mutants: the group by the look, the fallback, the wheel unlatched, the cooldown, the say)', () => {
  const deck = createGunDeck(HULL.SmallShip);
  let side = 'bow', aiming = false, now = 0;
  const said = [];
  const boat = { hull: HULL.SmallShip };
  const loads = createNavalLoads({ boat: () => boat, deck: () => deck, side: () => side, aiming: () => aiming, say: (t) => said.push(t), now: () => now });
  assert.equal(loads.label(boat), 'Bow chasers: Chain shot');
  assert.equal(loads.cycle(1), true);
  assert.equal(deck.load('bow'), 'heated', 'chain on to heated');
  assert.equal(said.at(-1), 'Bow chasers: Heated shot - loading');
  side = 'port';
  loads.cycle(-1);
  assert.equal(deck.load('starboard'), 'heated', 'round back to heated, both broadsides');
  side = 'stern';
  assert.equal(loads.label(boat), 'Broadsides: Heated shot', 'the barrels carry none: her first group with guns');
  side = null;
  loads.cycle(1);
  assert.equal(deck.load('port'), 'round');
  assert.equal(loads.wheel(120), false, 'the wheel is the camera\'s while the guns are not laid');
  aiming = true;
  assert.equal(loads.wheel(120), true);
  assert.equal(deck.load('port'), 'grape');
  now += SHOT_WHEEL_S / 2;
  assert.equal(loads.wheel(120), true, 'still the guns\'');
  assert.equal(deck.load('port'), 'grape', 'but a trackpad\'s stream steps once');
  now += SHOT_WHEEL_S;
  loads.wheel(-30);
  assert.equal(deck.load('port'), 'round', 'a notch back');
  assert.equal(loads.wheel(0), false);
  const none = createNavalLoads({ boat: () => ({ hull: HULL.Rowboat }), deck: () => createGunDeck(HULL.Rowboat), side: () => 'port', aiming: () => true, now: () => 0 });
  assert.equal(none.cycle(1), false);
  assert.equal(none.label({ hull: HULL.Rowboat }), null);
  assert.equal(gunSideOf(HULL.SmallShip, 'stern'), null);
  assert.equal(gunSideOf(HULL.SmallShip, 'broadside'), 'starboard');
  assert.equal(shotName('grape'), 'Grapeshot');
  assert.equal(groupName('stern'), 'Stern guns');
});

test('SHOT-KINDS the captains: a pirate who means to board loads her broadsides and her chasers with grape and fires it (her prize kept whole), never round shot into her; she keeps it through the fight while it stands within GRAPE_KEEP of GRAPE_CLOSE_M and draws it once the fight is done or opened past that; every other captain her bores\' own (mutants: the faction, the chasers, the hysteresis, the opened fight, the gate)', () => {
  const deck = createGunDeck(HULL.SmallShip);
  const ship = { hull: HULL.SmallShip, pos: [0, 0, 0], cls: { faction: 'pirate' }, mode: 'cruise', guns: deck };
  const at = (d) => ({ pos: [d, 0, 0] });
  captainLoads(ship, null);
  assert.equal(deck.load('port'), 'round');
  ship.mode = 'board';
  captainLoads(ship, at(400));
  assert.equal(deck.load('port'), 'grape', 'the moment she means to board, at any range');
  assert.equal(deck.load('bow'), 'grape', 'her chasers too');
  assert.equal(deck.load('stern'), null, 'her barrels carry none');
  assert.equal(boarderBroadsides(ship), true);
  ship.mode = 'engage';
  captainLoads(ship, at(GRAPE_CLOSE_M * GRAPE_KEEP - 1));
  assert.equal(deck.load('port'), 'grape', 'kept through the fight');
  captainLoads(ship, at(GRAPE_CLOSE_M * GRAPE_KEEP + 1));
  assert.equal(deck.load('port'), 'round', 'the fight opened past it: drawn');
  assert.equal(deck.load('bow'), 'chain', 'her chasers\' own');
  ship.mode = 'board';
  captainLoads(ship, at(30));
  ship.mode = 'cruise';
  captainLoads(ship, null);
  assert.equal(deck.load('port'), 'round', 'drawn once it is done');
  ship.mode = 'board';
  deck.setLoad('port', 'round');
  assert.equal(boarderBroadsides(ship), false, 'round shot into a prize, never');
  ship.mode = 'engage';
  assert.equal(boarderBroadsides(ship), true);
  const navy = { hull: HULL.Carrack, pos: [0, 0, 0], cls: { faction: 'navy' }, mode: 'board', guns: createGunDeck(HULL.Carrack) };
  captainLoads(navy, at(20));
  assert.equal(navy.guns.load('port'), 'round');
  const ai = rd('src/systems/naval/navalAI.js');
  assert.match(ai, /captainLoads\(ship, enemy\);\n\s+if \(!ship\.guns\.braced && !\(enemy\?\.crippled && enemy\.kind === 'player'\)\) \{\n\s+gunnery\(ship, world, enemy \?\? \(ship\.cls\.faction === 'merchant' \? threat : null\), out, \{ broadsides: boarderBroadsides\(ship\) \}\);/);
  assert.match(ai, /const shot = ship\.guns\.load\(side\);[^\n]*\n\s+const g = shotGun\(bat\.gun, GUNS\[bat\.gun\], shot\);/, 'laid and led for her load');
  assert.match(ai, /targetY: aimY, shot \}\);/);
});

test('SHOT-KINDS the HUD and the picture: each battery\'s load under its count (the chasers named as the bore they are), the aim\'s line naming it; each load its own ball - grape\'s pellets, chain\'s two halves and its links, heated shot\'s glow and trail - and its own splash and hit (mutants: the load word, the aim\'s load, each picture)', () => {
  const t = navalHudText({
    ship: { name: 'Small Ship', hull: 1, sail: 1, crew: 1 }, notoriety: { crown: 'Daggerfall', level: 0 }, armed: true,
    batteries: [{ side: 'bow', gun: 'chain', guns: 2, progress: 1, ready: true, shot: 'chain' }, { side: 'port', gun: 'long', guns: 7, progress: 1, ready: true, shot: 'grape' }, { side: 'stern', gun: 'barrel', guns: 1, barrels: 3, progress: 1, ready: true, shot: null }],
    aim: { side: 'port', gun: 'long', shot: 'grape', range: 90, max: 150, state: 'ready' },
  });
  const b = Object.fromEntries(t.plate.batteries.map((x) => [x.side, x]));
  assert.equal(b.bow.count, '2 chasers');
  assert.equal(b.bow.load, 'chain');
  assert.equal(b.port.load, 'grape');
  assert.equal(b.stern.load, '', 'a barrel carries none');
  assert.equal(t.aim.text, 'Port broadside, grapeshot - ');
  const axes = { right: [1, 0, 0], up: [0, 1, 0] };
  assert.equal(ballPictures({ pos: [0, 0, 0], gun: 'long', shot: 'round' }, axes).length, 1);
  assert.equal(ballPictures({ pos: [0, 0, 0], gun: 'long', shot: null }, axes).length, 1, 'none said: a ball');
  const g = ballPictures({ pos: [0, 0, 0], gun: 'long', shot: 'grape', spin: 0, age: 2 }, axes);
  assert.equal(g.length, GRAPE_PELLETS);
  assert.ok(g.every((p) => p.size < 0.26 && Math.hypot(...p.pos) > 0.2), 'small balls, opened about its line');
  const c = ballPictures({ pos: [0, 0, 0], gun: 'long', shot: 'chain', spin: 0 }, axes);
  assert.equal(c.length, 5);
  assert.ok(close(Math.hypot(...c[0].pos), CHAIN_HALF_M, 1e-9) && close(c[0].pos[0], -c[1].pos[0], 1e-9), 'two halves either side');
  const hot = ballPictures({ pos: [0, 0, 0], gun: 'long', shot: 'heated', vel: [10, 0, 0] }, axes);
  assert.equal(hot.filter((p) => p.blend === 'add').length, 4, 'a glow and three trailing');
  assert.ok(hot.filter((p) => p.blend === 'add').slice(1).every((p) => p.pos[0] < 0), 'trailing behind its way');
  const fx = createNavalEffects({ random: () => 0.5 });
  fx.shotSplash([0, 0, 0], false, 'grape');
  assert.equal(fx.drawList().filter((p) => p.kind === 'foam').length, 6, 'a spatter of spouts');
  assert.ok(fx.drawList().every((p) => Math.hypot(p.pos[0], p.pos[2]) <= SPATTER_M + 0.2));
  const fy = createNavalEffects({ random: () => 0.5 });
  fy.shotSplash([0, 0, 0], false, 'heated');
  assert.ok(fy.drawList().some((p) => p.kind === 'smoke'), 'its hiss of steam');
  const fz = createNavalEffects({ random: () => 0.5 });
  fz.shotHit([0, 0, 0], [1, 0, 0], false, 1, 'heated');
  assert.equal(fz.drawList().filter((p) => p.kind === 'ember').length, 10);
  const fw = createNavalEffects({ random: () => 0.5 });
  fw.shotTear([0, 0, 0], [1, 0, 0], 'chain');
  assert.equal(fw.drawList().filter((p) => p.kind === 'shred').length, 18, 'twice the canvas');
});

test('SHOT-KINDS the world: the key appended unbound in Combat (no mod\'s row - those ship keys) and a pad button\'s to choose; the wheel\'s rung before the camera\'s; the key read at the helm; the helm panel\'s Shot button with its label (mutants: the rung, the key unread, the button, the label)', () => {
  assert.equal(ACTIONS.at(-2), 'ShotCycle');   // PIN MOVED (PARTY-PING: PartyPing appended after)
  assert.ok(!DEFAULT_BINDINGS.some(([, a]) => a === 'ShotCycle'), 'no key ships on it');
  assert.ok(ACTION_GROUPS.find((g) => g.title === 'Combat').rows.some((r) => r.action === 'ShotCycle' && r.label === 'Shot (aboard)'));
  assert.ok(!Object.values(MOD_ACTIONS).flat().some((r) => r.action === 'ShotCycle'));
  assert.ok(PLUS_BIND_ROWS.some((r) => r.sec === 'ShotCycle'));
  const w = rd('src/scenes/world.js');
  assert.match(w, /const shotWheel = \(deltaY\) => !!naval\?\.shotWheel\?\.\(deltaY\);/);
  assert.match(w, /spyglassWheel\(e\.deltaY\) \|\| shotWheel\(e\.deltaY\) \|\| mwViewWheel\(e\.deltaY\)/);
  assert.match(w, /if \(navalOn\(\) && hccActionPressed\('ShotCycle'\)\) naval\?\.cycleShot\?\.\(1\);/);
  assert.match(w, /shot: \(\) => \{ naval\?\.cycleShot\?\.\(1\); \},/);
  assert.match(w, /shot: navalOn\(\) \? naval\?\.shotLabel\?\.\(\) \?\? null : null/);
  assert.deepEqual(helmButtons({ shot: 'Broadsides: Grapeshot' }).find((b) => b.act === 'shot'), { act: 'shot', label: 'Broadsides: Grapeshot', kind: 'hook' });
  assert.ok(!helmButtons({}).some((b) => b.act === 'shot'));
  const host = rd('src/scenes/naval/navalHost.js');
  assert.match(host, /cycleShot: \(dir = 1\) => loads\.cycle\(dir\), shotWheel: \(dy\) => loads\.wheel\(dy\), shotLabel: \(\) => \(enabled \? loads\.label\(myBoat\(\)\) : null\),/);
});
