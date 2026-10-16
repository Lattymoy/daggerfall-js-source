// SEA-EASE (2026-10-01, Mac: "too many ships are appearing", "Friendly AI should help the player in combat", "The sea is
// too dangerous right now") - A QUIETER, SAFER BAY: the traffic's numbers, the pirates' share and temper, the grapple's
// patience and the raiders' cap; THE RELIEF the director sends a lawful player under a pirate's guns; a crown's ship
// standing by them (the pirate fighting them hers first); and THE STRAY - a ball of theirs on her in the melee forgiven
// (bible/03-World/Naval-Combat.md SEA-EASE).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createNavalDirector, factionWeights, DENSITY, SPAWN_EVERY, FIRST_ROLL_S, FACTION_WEIGHTS, PORT_PIRATE_K, PORT_WEIGHTS,
  RELIEF_WAIT_S, RELIEF_CHANCE, RELIEF_SALT, SPAWN_RING, SPAWN_CLEAR, SHIP_SPAWN_CHANCE,
} from '../../../src/systems/naval/navalDirector.js';
import { createSeaShip, stepCaptain, fightsAny, BOLD_SHARE, GRAPPLE_STILL_S, AID_PRIORITY, NAVY_HUNTS, ENGAGE_RANGE, TEMPERS } from '../../../src/systems/naval/navalAI.js';
import { RAIDER_SHIPS_MAX } from '../../../src/systems/naval/navalRaiders.js';
import { hullBoxOf, RELIEF_NEAR_M, RELIEF_REACHED_M, ALLY_STRAY_SHARE } from '../../../src/scenes/naval/navalHost.js';
import { navalHitData } from '../../../src/systems/naval/navalWire.js';
import { classById } from '../../../src/systems/naval/navalShips.js';
import { NOTORIETY } from '../../../src/systems/naval/navalLaw.js';
import { hash32 } from '../../../src/world/spawnedDungeons.js';
import { mulberry32 } from '../../../src/combat/blood/bloodArt.js';
import { sea } from '../../navalSea.mjs';

const world = (o = {}) => ({ now: 0, dt: 1, seaY: 0, wind: [0, 0, 1], isWater: () => true, contacts: [], random: () => 0.5, ...o });
const flat = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

// ── the numbers (Mac's calls) ──────────────────────────────────────────────────────────────────────────────────────

test('SEA-EASE the quieter bay: one, two or four ships near a player, rolled a minute to two and a half apart and half a minute first; the open bay 30 pirates to 45 merchantmen and 25 crown\'s ships, a port\'s waters half the pirates; one raider at a time; a quarter of the pirates bold; a still boat grappled after a quarter of a minute (mutants: each number put back)', () => {
  assert.deepEqual({ ...DENSITY }, { off: 0, few: 1, some: 2, many: 4 });
  assert.deepEqual([...SPAWN_EVERY], [60, 140]);
  assert.equal(FIRST_ROLL_S, 30);
  assert.deepEqual({ ...FACTION_WEIGHTS }, { pirate: 30, merchant: 45, navy: 25 });
  assert.equal(PORT_PIRATE_K, 0.5);
  assert.deepEqual(factionWeights({ nearPort: true }), { pirate: 15, merchant: 45 + PORT_WEIGHTS.merchant, navy: 25 + PORT_WEIGHTS.navy });
  assert.equal(factionWeights().pirate, 30, 'the open bay keeps its pirates');
  assert.equal(RAIDER_SHIPS_MAX, 1);
  assert.equal(BOLD_SHARE, 0.25);
  assert.equal(GRAPPLE_STILL_S, 15);
});

test('SEA-EASE measured: sailing a straight course at 6 m/s for twenty hours at the default density, the director launches under twenty ships an hour and under eight pirates (it launched 31 and 15) - each let go out of sight (mutants: the densities, the cadence, the weights)', () => {
  let a = 1;
  const random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const d = createNavalDirector({ random });
  const ships = [];
  let launched = 0, pirates = 0, n = 0, x = 0;
  const hours = 20;
  for (let t = 0; t < hours * 3600; t++) {
    x += 6;
    const out = d.step(1, { density: DENSITY.some, player: [x, 0, 0], players: [[x, 0, 0]], level: 8, ships, isOpenWater: () => true, nearPort: false, notoriety: 0, seedBase: 77, seaY: 0 });
    for (const id of out.despawn) ships.splice(ships.findIndex((s) => s.id === id), 1);
    for (const sp of [out.spawn, out.spawn?.company].filter(Boolean)) {
      ships.push({ id: `s${n++}`, pos: sp.pos, classId: sp.classId, engaged: false, afloat: true });
      launched++;
      if (classById(sp.classId).faction === 'pirate') pirates++;
    }
  }
  assert.ok(launched / hours < 20 && launched / hours > 10, `${launched / hours} an hour`);
  assert.ok(pirates / hours < 8 && pirates / hours > 3, `${pirates / hours} pirates an hour`);
});

// ── THE RELIEF (the director) ──────────────────────────────────────────────────────────────────────────────────────

/** A seed base whose first spawn's relief roll lands (`hit`) or misses. */
function baseFor(hit) {
  for (let b = 1; b < 5000; b++) {
    const roll = mulberry32((hash32(b >>> 0, 0) ^ RELIEF_SALT) >>> 0)();
    if ((roll < RELIEF_CHANCE) === hit) return b;
  }
  throw new Error('no base');
}
const full = [{ id: 'p', pos: [200, 0, 0], classId: 'pirateBrig', engaged: true, afloat: true }, { id: 'm', pos: [-600, 0, 0], classId: 'merchantCoaster', engaged: false, afloat: true }];
const ctx = (o = {}) => ({ density: DENSITY.some, player: [0, 0, 0], players: null, level: 8, ships: full, isOpenWater: () => true, nearPort: false, notoriety: 0, seedBase: baseFor(true), seaY: 0, distress: [0, 0, 0], relieving: false, ...o });

test('SEA-EASE the relief: a lawful player under a pirate\'s guns with no crown\'s ship by them - the roll comes within RELIEF_WAIT_S, in a berth past the density, and on RELIEF_CHANCE launches a navy ship on the ring about them, facing them; one at a time; never more strangers while they fight (mutants: the wait, the berth, the chance, the ring\'s centre, the facing, the strangers)', () => {
  const lo = () => 0.1;
  // the first roll's wait (FIRST_ROLL_S) cut to RELIEF_WAIT_S
  const d = createNavalDirector({ random: lo });
  assert.equal(d.step(RELIEF_WAIT_S - 0.5, ctx()).spawn, null, 'not before RELIEF_WAIT_S');
  const s = d.step(0.5, ctx()).spawn;
  assert.ok(s, 'the relief - the density full, a berth of her own');
  assert.equal(s.relief, true);
  assert.equal(s.hunter, false);
  assert.equal(classById(s.classId).faction, 'navy');
  const r = flat(s.pos, [0, 0, 0]);
  assert.ok(r >= SPAWN_RING[0] - 1e-6 && r <= SPAWN_RING[1] + 1e-6, `on the ring: ${r}`);
  assert.ok(Math.abs(Math.atan2(-s.pos[0], -s.pos[2]) - s.yaw) < 1e-9, 'facing them');
  // about the player in distress, wherever the stander is
  const there = createNavalDirector({ random: lo }).step(RELIEF_WAIT_S, ctx({ distress: [5000, 0, 0], players: [[0, 0, 0], [5000, 0, 0]] })).spawn;
  const r2 = flat(there.pos, [5000, 0, 0]);
  assert.ok(r2 >= SPAWN_RING[0] - 1e-6 && r2 <= SPAWN_RING[1] + 1e-6 && flat(there.pos, [0, 0, 0]) >= SPAWN_CLEAR, `about them: ${r2}`);
  // one at a time: a relief at sea - the cadence as ever, and the full density holds
  assert.equal(createNavalDirector({ random: lo }).step(RELIEF_WAIT_S, ctx({ relieving: true })).spawn, null, 'relieving: no faster roll');
  assert.equal(createNavalDirector({ random: lo }).step(FIRST_ROLL_S, ctx({ relieving: true })).spawn, null, 'relieving: the density full');
  // no distress: the full density holds
  assert.equal(createNavalDirector({ random: lo }).step(FIRST_ROLL_S, ctx({ distress: null })).spawn, null);
  // one berth past the density, not two
  const crowd = [...full, { id: 'x', pos: [900, 0, 0], classId: 'merchantCoaster', engaged: false, afloat: true }];
  assert.equal(createNavalDirector({ random: lo }).step(RELIEF_WAIT_S, ctx({ ships: crowd })).spawn, null, 'past the relief\'s berth');
  // the chance missed: nothing - not a stranger in the empty berth either
  const miss = createNavalDirector({ random: lo }).step(RELIEF_WAIT_S, ctx({ seedBase: baseFor(false), ships: [] }));
  assert.equal(miss.spawn, null, 'never more strangers while they fight');
  // the roll's own chance still stands before the relief's
  assert.equal(createNavalDirector({ random: () => SHIP_SPAWN_CHANCE }).step(RELIEF_WAIT_S, ctx()).spawn, null);
  // a relief's stream is her own: the same base without distress launches what it always did
  const plain = createNavalDirector({ random: lo }).step(FIRST_ROLL_S, ctx({ distress: null, ships: [] })).spawn;
  assert.ok(plain && !plain.relief);
});

// ── a crown's ship stands by a lawful player (the captains) ───────────────────────────────────────────────────────

test('SEA-EASE stands by: of two pirates in her lookout, a navy ship takes first the one fighting a player she does not hunt - as if AID_PRIORITY nearer - and the nearer when the player is one she hunts; a pirate that only cruises is no fight of theirs (mutants: the priority dropped, the hunted stood by, the fight\'s modes)', () => {
  const pirate = (id, mode, target) => Object.assign(createSeaShip({ id, seed: 3, classId: 'pirateBrig', pos: [0, 0, 0], yaw: 0, temper: TEMPERS.bold }), { mode, target });
  const contact = (s, pos) => ({ id: s.id, kind: 'ship', faction: 'pirate', pos, vel: [0, 0, 0], speed: 0, yaw: 0, hull: s.hull, ship: s });
  const me = { id: 'me', kind: 'player', pos: [0, 0, 560], vel: [0, 0, 0], speed: 0 };
  const run = (far, law) => {
    const navy = createSeaShip({ id: 'n', seed: 1, classId: 'navyCutter', pos: [0, 0, 0], yaw: 0 });
    const idle = pirate('a', 'cruise', null), busy = pirate('b', 'engage', 'me');
    stepCaptain(navy, world({ contacts: [contact(idle, [300, 0, 0]), contact(busy, [0, 0, far]), me], notoriety: () => law }));
    return navy.target;
  };
  assert.equal(run(500, 0), 'b', 'the pirate on the player, though farther');
  assert.equal(run(590, 0), 'b', 'inside AID_PRIORITY of the nearer');
  assert.equal(run(650, 0), 'a', 'past it');
  assert.equal(run(500, NAVY_HUNTS), 'a', 'a player she hunts is no one she stands by');
  assert.ok(500 < ENGAGE_RANGE && 300 / AID_PRIORITY === 600);
  // the fight's modes
  const ids = new Set(['me']);
  assert.equal(fightsAny(contact(pirate('c', 'board', 'me'), [0, 0, 0]), ids), true, 'coming alongside them');
  assert.equal(fightsAny(contact(pirate('c', 'flee', 'me'), [0, 0, 0]), ids), false, 'running from them');
  assert.equal(fightsAny(contact(pirate('c', 'engage', 'other'), [0, 0, 0]), ids), false, 'another\'s fight');
  assert.equal(fightsAny({ id: 'p', kind: 'player', pos: [0, 0, 0] }, ids), false);
  // only a crown's ship stands by anyone: a wary pirate who lets the player be, struck by two ships, answers the nearer -
  // never the one fighting the player first
  const wary = createSeaShip({ id: 'w', seed: 3, classId: 'pirateBrig', pos: [0, 0, 0], yaw: 0, temper: TEMPERS.wary });
  const merchant = Object.assign(createSeaShip({ id: 'mm', seed: 4, classId: 'merchantCoaster', pos: [300, 0, 0], yaw: 0 }), { mode: 'flee' });
  const hunter = Object.assign(createSeaShip({ id: 'nn', seed: 5, classId: 'navyCutter', pos: [0, 0, 500], yaw: 0 }), { mode: 'engage', target: 'me' });
  wary.provoked.set('mm', 0); wary.provoked.set('nn', 0);
  const mc = { id: 'mm', kind: 'ship', faction: 'merchant', pos: [300, 0, 0], vel: [0, 0, 0], speed: 0, yaw: 0, hull: merchant.hull, ship: merchant };
  const nc = { id: 'nn', kind: 'ship', faction: 'navy', pos: [0, 0, 500], vel: [0, 0, 0], speed: 0, yaw: 0, hull: hunter.hull, ship: hunter };
  stepCaptain(wary, world({ contacts: [mc, nc, me] }));
  assert.equal(wary.target, 'mm', 'a pirate stands by no one');
});

// ── the host: the relief sent and laid, the cry, the stray ────────────────────────────────────────────────────────

test('SEA-EASE the host\'s relief: a pirate fighting me with no crown\'s ship by me - the director launches a navy relief laid for where I was; she keeps the course until her lookout has the fight, takes the pirate on, and says once she comes to my aid; a relief afloat sends no other (mutants: the distress unread, the course not laid, the course kept, the cry every frame)', async () => {
  const s = await sea({ hull: 2, settings: { ShipsAtSea: 'some', Boarders: false } });
  const pirateId = s.host.spawnShip('pirateBrig', { range: 260, bearing: Math.PI / 2 });
  const pirate = s.host._sea.get(pirateId);
  s.run(2);
  assert.equal(pirate.ship.mode, 'engage');
  assert.equal(pirate.ship.target, 'local');
  let relief = null;
  for (let t = 0; t < 240 && !relief; t++) { s.run(1); relief = [...s.host._sea.values()].find((e) => e.relief) ?? null; }
  assert.ok(relief, 'a relief launched');
  assert.equal(relief.ship.cls.faction, 'navy');
  assert.ok(relief.ship.course, 'her course laid');
  assert.ok(flat([relief.ship.course[0], 0, relief.ship.course[1]], [0, 0, 0]) < 1, 'for where I was');
  assert.ok(relief.ship.errand == null, 'no errand of her own');
  // one at a time
  const reliefs = () => [...s.host._sea.values()].filter((e) => e.relief).length;
  s.run(60);
  assert.equal(reliefs(), 1);
  // she comes up, takes the pirate on, and says so once
  for (let t = 0; t < 300 && !(relief.ship.mode === 'engage' && relief.ship.target === pirateId); t++) s.run(1);
  assert.equal(relief.ship.target, pirateId, 'the pirate on me is hers');
  assert.equal(relief.ship.course, null, 'the course let go at the fight');
  s.run(5);
  assert.equal(s.log.say.filter((t) => t.endsWith('comes to your aid!')).length, 1, s.log.say.join(' | '));
  assert.ok(RELIEF_NEAR_M > ENGAGE_RANGE && RELIEF_REACHED_M < RELIEF_NEAR_M);
});

test('SEA-EASE the relief near a port: a harbour known, the relief still goes about the player\'s fight - no errand of her own, her course laid for them (mutants: the relief sent on an errand)', async () => {
  const coast = (x, z) => !(z > 200 || (x > 300 && x < 400 && z > -300));
  const s = await sea({ hull: 2, water: coast, settings: { ShipsAtSea: 'some', Boarders: false } });
  s.deps.harbourNear = () => ({ key: 'port:1', rect: { minX: -100, maxX: 100, minZ: 220, maxZ: 420 } });
  s.run(1);
  for (const e of [...s.host._sea.values()]) if (e.ship.cls.faction === 'navy') s.host._sea.delete(e.id);   // no crown's ship moored by me
  s.host.spawnShip('pirateBrig', { range: 200, bearing: Math.PI / 2 });
  const d = s.host.directorState;
  const real = d.step.bind(d);
  let sent = false;
  d.step = (dt, ctx) => {
    if (sent || !ctx.distress) return real(dt, ctx);
    sent = true;
    // past her lookout (the pirate 1500 m off): she sails her laid course, no fight of her own yet - nearer, she would
    // take the pirate at once and her course would end with it
    return { despawn: [], spawn: { seed: 99, classId: 'navyCutter', variant: 0, pos: [0, 0, -1500], yaw: 0, hunter: false, relief: true } };
  };
  s.run(1);
  assert.equal(sent, true, 'the distress reached the director');
  const relief = [...s.host._sea.values()].find((e) => e.relief);
  assert.ok(relief);
  assert.equal(relief.ship.errand, null, 'no errand');
  assert.ok(relief.ship.course, 'her course laid for the fight');
});

test('SEA-EASE no relief: a crown\'s ship already by me, a player the crown hunts, or no pirate on me - the director sends none (mutants: the navy by me uncounted, the law unread)', async () => {
  const relieved = async (o, setup) => {
    const s = await sea({ hull: 2, settings: { ShipsAtSea: 'some', Boarders: false }, ...o });
    setup(s);
    s.run(150);
    return [...s.host._sea.values()].some((e) => e.relief);
  };
  assert.equal(await relieved({}, (s) => { s.host.spawnShip('pirateBrig', { range: 260, bearing: Math.PI / 2 }); s.host.spawnShip('navyCutter', { range: 500, bearing: -Math.PI / 2 }); }), false, 'a navy ship by me');
  assert.equal(await relieved({}, (s) => { s.host.spawnShip('pirateBrig', { range: 260, bearing: Math.PI / 2 }); s.host.notoriety.add('Wayrest', NAVY_HUNTS); }), false, 'the crown hunts me');
  assert.equal(await relieved({}, () => {}), false, 'no pirate on me');
});

/** A ship stood where a test wants her, built, and settled a frame. */
function place(s, classId, pos, yaw = 0, temper = null) {
  const id = s.host.spawnShip(classId, { range: Math.hypot(pos[0], pos[2]), bearing: Math.atan2(pos[0], pos[2]), yaw, temper });
  const e = s.host._sea.get(id);
  e.ship.pos = [...pos];
  s.host.frame(0.1);
  assert.ok(e.boat, 'built');
  return e;
}
const shootAt = (s, e, height = 4) => {
  const box = hullBoxOf(e.boat, s.pool.models);
  s.host._shots.fireVolley({ id: `t${Math.random()}`, shooter: 'me:42', launches: [{ gun: 'long', index: 0, p0: [box.c[0] - 40, height, box.c[2]], v0: [80, 0.4, 0], delay: 0 }] });
};

test('SEA-EASE the stray: my ball on a crown\'s ship fighting a pirate is no Piracy, no notoriety, no provocation and no witness while what I struck her for stays under ALLY_STRAY_SHARE of her hull - "Check your fire!" said once; past it, the law as ever (mutants: the stray unweighed, the share, the witnesses, the cry)', async () => {
  const s = await sea({ hull: 2, settings: { ShipsAtSea: 'off', Boarders: false } });
  const crimes = [];
  s.deps.law.crime = (region, crime) => crimes.push([region, crime]);
  const pirate = place(s, 'pirateBrig', [70, 0, 300], 0, TEMPERS.bold);
  const navy = place(s, 'navyCutter', [70, 0, 0], Math.PI / 2);
  const witness = place(s, 'navyCutter', [140, 0, -200], 0);
  s.run(0.5);
  assert.equal(navy.ship.mode, 'engage');
  assert.equal(navy.ship.target, pirate.id);
  const hull0 = navy.ship.damage.hull;
  shootAt(s, navy);
  s.run(1);
  assert.ok(navy.ship.damage.hull < hull0, 'struck');
  assert.deepEqual(crimes, [], 'no Piracy');
  assert.equal(s.host.notoriety.get('Wayrest'), 0);
  assert.equal(navy.ship.provoked.has('local'), false, 'no feud');
  assert.equal(witness.ship.provoked.has('local'), false, 'no witness');
  shootAt(s, navy);
  s.run(1);
  assert.equal(s.log.say.filter((t) => t.startsWith('Check your fire!')).length, 1, 'said once');
  // past ALLY_STRAY_SHARE of her hull: a feud
  for (let i = 0; i < 12 && !crimes.length; i++) { shootAt(s, navy); s.run(1); }
  assert.ok(hull0 - navy.ship.damage.hull > ALLY_STRAY_SHARE * navy.ship.damage.maxHull, 'past the share');
  assert.equal(crimes.length, 1, 'Piracy, at last');
  assert.equal(s.host.notoriety.get('Wayrest'), NOTORIETY.fire);
  assert.equal(navy.ship.provoked.has('local'), true);
});

test('SEA-EASE the stray, not: a crown\'s ship fighting no pirate (cruising) is struck as ever - Piracy at the first ball (mutants: every navy ship forgiven)', async () => {
  const s = await sea({ hull: 2, settings: { ShipsAtSea: 'off', Boarders: false } });
  const crimes = [];
  s.deps.law.crime = (region, crime) => crimes.push([region, crime]);
  const navy = place(s, 'navyCutter', [70, 0, 0], Math.PI / 2);
  s.run(0.5);
  assert.notEqual(navy.ship.mode, 'engage');
  shootAt(s, navy);
  s.run(1);
  assert.equal(crimes.length, 1);
  assert.equal(s.log.say.some((t) => t.startsWith('Check your fire!')), false);
});

test('SEA-EASE the stray, a peer\'s: another player\'s ball landed on my crown\'s ship fighting a pirate is weighed as mine - no feud and no witness under ALLY_STRAY_SHARE of her hull, both past it (mutants: the peer\'s blow unweighed)', async () => {
  const s = await sea({ hull: 2, settings: { ShipsAtSea: 'off', Boarders: false } });
  const pirate = place(s, 'pirateBrig', [70, 0, 300], 0, TEMPERS.bold);
  const navy = place(s, 'navyCutter', [70, 0, 0], Math.PI / 2);
  const witness = place(s, 'navyCutter', [140, 0, -200], 0);
  s.run(0.5);
  assert.equal(navy.ship.target, pirate.id);
  const blow = (hull) => s.host.applyPeerHit('ann', navalHitData('local', { n: navy.n, hull, sail: 0, crew: 0, fire: false, zone: 'hull' }));
  assert.equal(blow(20), true);
  assert.equal(navy.ship.provoked.has('ann'), false, 'a stray');
  assert.equal(witness.ship.provoked.has('ann'), false);
  assert.equal(blow(ALLY_STRAY_SHARE * navy.ship.damage.maxHull), true);
  assert.equal(navy.ship.provoked.has('ann'), true, 'past the share: a feud');
  assert.equal(witness.ship.provoked.has('ann'), true, 'and witnessed');
  assert.equal(s.log.say.some((t) => t.startsWith('Check your fire!')), false, 'the cry is the shooter\'s own');
});
