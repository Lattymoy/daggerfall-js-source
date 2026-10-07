// AUDIT WATCH-KIT (2026-10-01, Mac: "Just want to audit this to make sure it's perfection") - the audit of PR #502
// (SHIP-WATCH, COMPANION-KIT; bible/01-Overview/Audit-Watch-Kit.md). This suite pins THE SEA BY NIGHT (lens N) and the
// host's side of THE WATCH ABOARD (lens W): who a gun's flashes show, the night's hearing and running, the lanterns a
// hull carries, the dark's own hours, my lookout's cry and my crew's alarm by the night's law, another player's lamps
// and her hands' work. Each test fails on the code as #502 stood, for its finding's reason.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { NIGHT_DARK_SIGHT, NIGHT_LIT_SIGHT } from '../src/systems/naval/shipWatch.js';
import { createSeaShip, stepCaptain, WIND_RATED, HEAR_S, FLEE_RANGE, RUN_ON_S, ENGAGE_RANGE } from '../src/systems/naval/navalAI.js';
import { HULL } from '../src/systems/naval/navalShips.js';
import { HOSTILE_NEAR_M } from '../src/scenes/navalHost.js';
import { Boat, setLights } from '../src/systems/comeSailAwayBoat.js';
import { sea, readyPool, modShipsPool } from './navalSea.mjs';
import { room } from './navalRoom.mjs';

const WORLD = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
const HOST = readFileSync(new URL('../src/scenes/navalHost.js', import.meta.url), 'utf8');
const NIGHT = { cityLights: true, night: true };
const open = () => true;
const contactOf = (s, o = {}) => ({ id: s.id, kind: 'ship', faction: s.cls.faction, pos: s.pos, vel: [0, 0, 0], speed: 0, yaw: s.yaw, hull: s.hull, ship: s, ...o });

// ── N1: who a gun's flashes show ───────────────────────────────────────────────────────────────────────────────────

test('AUDIT WK-N1 a player firing by night is seen by her flashes: my volley\'s report is heard as mine (my contact\'s id, not my boat\'s key) - a bold pirate 300 m off, past a dark boat\'s sight, takes me once I fire (mutants: the report under the boat\'s key)', async () => {
  const h = await sea({ hull: HULL.SmallShip, where: NIGHT, settings: { ShipsAtSea: 'off', Boarders: false } });
  const p = h.host._sea.get(h.host.spawnShip('pirateBrig', { range: 300, bearing: Math.PI / 2, temper: 'bold' }));
  const hold = () => { p.ship.pos = [300, 0, 0]; p.ship.speed = 0; };
  for (let i = 0; i < 10; i++) { hold(); h.host.frame(0.1); }
  assert.notEqual(p.ship.target, 'local', 'a dark boat 300 m off is unseen');
  assert.ok(300 > NIGHT_DARK_SIGHT && 300 < NIGHT_LIT_SIGHT);
  h.host._shots.fireVolley({ id: 'mine', shooter: 'me:42', launches: [{ gun: 'long', index: 0, p0: [0, 3, 0], v0: [0, 0.5, 60], delay: 0 }] });
  for (let i = 0; i < 10; i++) { hold(); h.host.frame(0.1); }
  assert.equal(p.ship.target, 'local', 'seen by my flashes');
  assert.match(HOST, /heardGun\(e\.pos, gunfireBy\(e\.shooter\)\)/);
  // another player's: her volley's report heard as hers - their contact's id, never `peer:` theirs
  let peer = null;
  const ONLINE = { id: () => 'b-player', peers: () => [{ id: 'ann', feet: [0, 0, 600] }], sendHit: () => true };
  const o = await sea({ hull: HULL.SmallShip, online: ONLINE, where: NIGHT, settings: { ShipsAtSea: 'off', Boarders: false }, peerBoats: () => (peer ? [peer] : []) });
  const pb = o.pool.spawnNow(Object.assign(new Boat(HULL.SmallShip, 0), { uid: 8 }), { position: [0, 0, 600], rotation: [0, 0, 0, 1] });
  peer = { id: 'ann', pos: [0, 0, 600], vel: [0, 0, 0], speed: 0, hull: HULL.SmallShip, yaw: 0, boat: pb };
  const q = o.host._sea.get(o.host.spawnShip('pirateBrig', { range: 900, bearing: 0, temper: 'bold' }));
  const keep = () => { q.ship.pos = [0, 0, 900]; q.ship.speed = 0; };
  for (let i = 0; i < 10; i++) { keep(); o.host.frame(0.1); }
  assert.notEqual(q.ship.target, 'ann', 'her dark boat 300 m off unseen');
  o.host._shots.fireVolley({ id: 'hers', shooter: 'peer:ann', launches: [{ gun: 'long', index: 0, p0: [0, 3, 600], v0: [60, 0.5, 0], delay: 0 }], resolve: false });
  for (let i = 0; i < 10; i++) { keep(); o.host.frame(0.1); }
  assert.equal(q.ship.target, 'ann', 'seen by her flashes');
});

// ── N2: the guns heard by night ────────────────────────────────────────────────────────────────────────────────────

test('AUDIT WK-N2 by night a navy answering the guns sails for them until she is inside half the lookout she sees a dark ship by - never turning away from a fight her night\'s lookout cannot see (mutants: half her day\'s lookout)', () => {
  const n = createSeaShip({ id: 'n', seed: 3, classId: 'navyCutter', pos: [0, 0, 0], yaw: 0 });
  const p = createSeaShip({ id: 'p', seed: 1, classId: 'pirateBrig', pos: [0, 0, 330], yaw: Math.PI / 2, temper: 'bold' });
  const fired = 100 - 21;
  const modes = [];
  for (let t = 100, i = 0; i < 120; i++, t += 0.1) {
    stepCaptain(n, { now: t, dt: 0.1, seaY: 0, wind: [0, 0, WIND_RATED], isWater: open, random: () => 0.5, night: true,
      contacts: [contactOf(p, { lit: false })], gunfire: [{ pos: [0, 0, 330], at: fired, by: 'p' }] });
    modes.push([+(t - fired).toFixed(1), Math.hypot(n.pos[0] - p.pos[0], n.pos[2] - p.pos[2]), n.mode]);
  }
  // inside HEAR_S and outside her night's dark sight she answers - the day's half lookout (375 m) no longer turns her
  for (const [age, d, mode] of modes) if (age < HEAR_S && d > NIGHT_DARK_SIGHT) assert.equal(mode, 'answer', `${age} s, ${d.toFixed(0)} m: ${mode}`);
  assert.ok(modes.some(([, d]) => d < ENGAGE_RANGE * 0.5), 'she came inside the day\'s half lookout still answering');
});

// ── N3: running on in the dark ─────────────────────────────────────────────────────────────────────────────────────

test('AUDIT WK-N3 by night a merchantman that ran from a dark pirate runs on RUN_ON_S from where she last saw her - dark all the while - and only then sails on; by day she stops at FLEE_RANGE as ever (mutants: no run-on, the day running on, the clock)', () => {
  const run = (night) => {
    const m = createSeaShip({ id: 'm', seed: 2, classId: 'merchantGalleon', pos: [0, 0, 0], yaw: 0 });
    const p = createSeaShip({ id: 'p', seed: 1, classId: 'pirateSloop', pos: [0, 0, 150], yaw: Math.PI, temper: 'bold' });
    const w = (t, pirateAt) => ({ now: t, dt: 0.5, seaY: 0, wind: [0, 0, WIND_RATED], isWater: open, random: () => 0.5, night,
      contacts: [contactOf(p, { pos: pirateAt, lit: false })] });
    stepCaptain(m, w(0, [m.pos[0], 0, m.pos[2] + 150]));
    assert.equal(m.mode, 'flee', 'she runs from the pirate she sees');
    const out = [];
    // the pirate drops out of her sight (night: past a dark ship's 220 m; day: past FLEE_RANGE)
    for (let t = 0.5; t <= RUN_ON_S + 10; t += 0.5) { stepCaptain(m, w(t, [m.pos[0], 0, m.pos[2] + (night ? 260 : FLEE_RANGE + 40)])); out.push([t, m.mode]); }
    return out;
  };
  const night = run(true);
  for (const [t, mode] of night) if (t < RUN_ON_S - 1) assert.equal(mode, 'flee', `${t} s: ${mode}`);
  assert.notEqual(night[night.length - 1][1], 'flee', 'the run\'s end');
  const day = run(false);
  assert.notEqual(day[0][1], 'flee', 'by day she stops at once past FLEE_RANGE');
  assert.equal(RUN_ON_S, 60);
});

// ── N4: the lanterns a hull carries ────────────────────────────────────────────────────────────────────────────────

test('AUDIT WK-N4 a hull is lit only by lanterns she carries: Come Sail Away\'s carrack prefab has none, so a merchant carrack sails dark by night - her contact unlit, a dark ship to every captain - while a galleon at the lights\' hour is lit (mutants: the lanterns unasked, the unbuilt carrack lit)', async () => {
  // SHIPS-2 (2026-10-07): the carrack without lanterns is the mod's own - hull 4 as the game stands it when Mac's
  // carrack's model will not load (test/navalSea.mjs modShipsPool); Mac's carries seven, and is lit
  const mod = await modShipsPool();
  try {
    const counts = [0, 1, 2, 3, 4].map((hull) => mod.pool.spawnNow(Object.assign(new Boat(hull, 0), { uid: 900 + hull }), { position: [hull * 200, 0, 5000], rotation: [0, 0, 0, 1] }).Lights.length);
    assert.equal(counts[HULL.Carrack], 0, 'the mod\'s carrack carries no lantern');
    for (const hull of [HULL.Rowboat, HULL.LargeBoat, HULL.SmallShip, HULL.LargeGalley]) assert.ok(counts[hull] > 0, `hull ${hull} carries lanterns`);
    const h = await sea({ hull: HULL.SmallShip, pool: mod.pool, where: NIGHT, settings: { ShipsAtSea: 'off', Boarders: false } });
    const carrack = h.host._sea.get(h.host.spawnShip('merchantCarrack', { range: 400, bearing: 1 }));
    const galleon = h.host._sea.get(h.host.spawnShip('merchantGalleon', { range: 400, bearing: -1 }));
    h.run(0.3);
    const lit = (e) => h.host._contacts().find((c) => c.id === e.id)?.lit;
    assert.equal(lit(carrack), false, 'no lanterns, no light');
    assert.equal(lit(galleon), true);
    // a carrack not yet built is judged by her hull
    carrack.boat = null;
    assert.equal(lit(carrack), false);
  } finally { mod.restore(); }
  const pool = await readyPool();
  assert.equal(pool.spawnNow(Object.assign(new Boat(HULL.Carrack, 0), { uid: 904 }), { position: [800, 0, 5000], rotation: [0, 0, 0, 1] }).Lights.length, 7, 'Mac\'s carrack carries seven');
  const h = await sea({ hull: HULL.SmallShip, where: NIGHT, settings: { ShipsAtSea: 'off', Boarders: false } });
  const carrack = h.host._sea.get(h.host.spawnShip('merchantCarrack', { range: 400, bearing: 1 }));
  h.run(0.3);
  assert.equal(h.host._contacts().find((c) => c.id === carrack.id)?.lit, true, 'Mac\'s carrack lit');
  carrack.boat = null;
  assert.equal(h.host._contacts().find((c) => c.id === carrack.id)?.lit, true, 'and judged lit by her hull, not yet built');
  // my own carrack's switch lights nothing either
  assert.match(HOST, /lit: !!boat\.LightOn && carriesLanterns\(boat, boat\.hull\),/);
});

// ── N5: the dark's own hours ───────────────────────────────────────────────────────────────────────────────────────

test('AUDIT WK-N5 the captains\', the errands\' and the lookout\'s night is the dark\'s (worldClock isNight), the lanterns\' hours their own: at 07:30 - the lights still lit, the day come - a dark pirate 560 m off is hailed as by day (mutants: the lanterns\' hours for the dark\'s)', async () => {
  assert.match(WORLD, /cityLights: isCityLightsOn\(minuteNow\(\)\), night: isNight\(minuteNow\(\)\) \}; \},/);
  assert.match(HOST, /const night = !!where\(\)\.night;[^\n]*\n\s*const world = \{/);
  const morning = await sea({ hull: HULL.SmallShip, where: { cityLights: true, night: false }, settings: { ShipsAtSea: 'off', Boarders: false } });
  morning.boat.crewed = true;
  const p = morning.host._sea.get(morning.host.spawnShip('pirateBrig', { range: 560, bearing: Math.PI / 2, temper: 'bold' }));
  p.ship.speed = 0;
  morning.run(1.2);
  assert.ok(morning.log.say.some((t) => /Sail ho/.test(t)), `hailed in the morning light: ${morning.log.say}`);
  assert.equal(p.boat?.LightOn ?? false, false, 'a pirate keeps hers out whatever the hour');
});

// ── N6 / W6: my lookout by the flashes ─────────────────────────────────────────────────────────────────────────────

test('AUDIT WK-N6/W6 my lookout keeps the captains\' law by night: a dark pirate firing on a merchantman 400 m from me is hailed by her flashes (mutants: the lanterns alone)', async () => {
  const h = await sea({ hull: HULL.SmallShip, where: NIGHT, settings: { ShipsAtSea: 'off', Boarders: false } });
  h.boat.crewed = true;
  const p = h.host._sea.get(h.host.spawnShip('pirateBrig', { range: 420, bearing: Math.PI / 2, temper: 'bold' }));
  h.host.spawnShip('merchantGalleon', { range: 560, bearing: Math.PI / 2 });
  let fired = false, hailed = false;
  for (let i = 0; i < 400 && !hailed; i++) {
    p.ship.pos[2] = 0; p.ship.pos[0] = Math.max(p.ship.pos[0], 300);
    h.host.frame(0.1);
    fired ||= h.host._shots.inFlight > 0;
    hailed = h.log.say.some((t) => /Sail ho/.test(t));
  }
  assert.ok(fired, 'she fired');
  assert.ok(hailed, 'hailed by her flashes');
  assert.ok(Math.hypot(p.ship.pos[0], p.ship.pos[2]) > NIGHT_DARK_SIGHT, 'and never within a dark ship\'s sight');
});

// ── N7: another player's lamps ─────────────────────────────────────────────────────────────────────────────────────

test('AUDIT WK-N7 another player\'s lit boat is drawn by her far lamps as a sea ship\'s and mine are - my captains see her by those lanterns (mutants: the peers\' boats unread)', async () => {
  let peer = null;
  const ONLINE = { id: () => 'b-player', peers: () => [{ id: 'a-player', feet: [10, 0, 0] }], sendHit: () => true };
  const h = await sea({ hull: HULL.SmallShip, online: ONLINE, where: NIGHT, peerBoats: () => (peer ? [peer] : []) });
  const pb = h.pool.spawnNow(Object.assign(new Boat(HULL.SmallShip, 0), { uid: 7 }), { position: [300, 0, 0], rotation: [0, 0, 0, 1] });
  setLights(pb, true);
  pb.GameObject.position = [300, 0, 0];   // posed, as comeSailAwayPeers poses a peer's boat each frame
  peer = { id: 'a-player', pos: [300, 0, 0], vel: [0, 0, 0], speed: 0, hull: HULL.SmallShip, yaw: 0, boat: pb };
  h.run(0.3);
  const lamps = h.host.drawFrame().particles.filter((q) => q.kind === 'lamp' && Math.hypot(q.pos[0] - 300, q.pos[2]) < 60);
  assert.ok(lamps.length > 0, 'her lamps drawn');
  setLights(pb, false);
  assert.equal(h.host.drawFrame().particles.filter((q) => q.kind === 'lamp' && Math.hypot(q.pos[0] - 300, q.pos[2]) < 60).length, 0, 'doused: none');
});

// ── W2: my crew's alarm by the night's law ─────────────────────────────────────────────────────────────────────────

test('AUDIT WK-W2 by night my crew is called to the guns only by a hostile the night shows - a dark pirate cruising 495 m off, unseen, wakes no one; lit, or by day, or coming for me, she does; a rest still reads every hostile near (mutants: the alarm by HOSTILE_NEAR_M alone, the comer unread)', async () => {
  const at = async (where, setup) => {
    const h = await sea({ hull: HULL.SmallShip, where, settings: { ShipsAtSea: 'off', Boarders: false } });
    h.boat.crewed = true;
    const p = h.host._sea.get(h.host.spawnShip('pirateBrig', { range: 495, bearing: Math.PI / 2, temper: 'bold' }));
    setup?.(p, h);
    p.ship.speed = 0; p.ship.pos = [495, 0, 0];
    h.host.frame(0.1);
    p.ship.pos = [495, 0, 0];
    return { battle: h.host.myCrew(h.boat).battle, near: h.host.hostileNear(), p };
  };
  const dark = await at(NIGHT);
  assert.ok(495 < HOSTILE_NEAR_M && 495 > NIGHT_DARK_SIGHT);
  assert.notEqual(dark.p.ship.target, 'local', 'she has not seen me');
  assert.equal(dark.battle, false, 'unseen in the dark');
  assert.equal(dark.near, true, 'a rest still reads her');
  const day = await at({ cityLights: false, night: false });
  assert.equal(day.battle, true, 'by day');
  assert.match(HOST, /battle: aiming \|\| crewAlarm\(\), toward,/);
  assert.match(HOST, /crew: st\.damage\.crew, battle: aiming \|\| crewAlarm\(\), boatHull: b\.hull \}/);
  assert.match(HOST, /if \(!night \|\| e\.ship\.target === myId\(\) \|\| d <= nightSight\(HOSTILE_NEAR_M, \{ night, lit: showsLight\(e\) \}\)\) return true;/);
});

// ── W12: another player's hands at work ────────────────────────────────────────────────────────────────────────────

test('AUDIT WK-W12 another player\'s battered boat: her word\'s hull loss is her hands\' work on my screen as on hers (mutants: the work unsaid, the world\'s peer crew unworked)', async () => {
  const r = await room([{ id: 'a', hull: HULL.SmallShip }, { id: 'b', hull: HULL.SmallShip }]);
  const A = r.get('a'), B = r.get('b');
  B.s.view.feet = [0, 0, 60];
  A.s.host.restoreSaveData({ v: 1, boats: { 42: { hull: 210, sail: 160, crew: 24, fire: 0, state: 'afloat', barrels: 4 } }, notoriety: {}, day: 1, raids: [] });
  r.run(2);
  assert.ok(Math.abs(A.s.host.myCrew(A.s.boat).work - 0.5) < 1e-9, 'on her owner\'s screen');
  const said = B.s.host.peerBoat('a');
  assert.ok(said && Math.abs(said.work - 0.5) < 0.02, `on mine: ${said?.work}`);
  assert.match(HOST, /battle: said\.battle, work: Math\.min\(1, Math\.max\(0, 1 - \(self\.me\?\.hull \?\? 1\)\)\) \}/);
  assert.match(WORLD, /faction: null, battle: !!word\?\.battle, work: word\?\.work \?\? 0 \}\);/);
});

// ── W10: her card's Lookout, handed to her crew ────────────────────────────────────────────────────────────────────

test('AUDIT WK-W10 the host hands my crew her card\'s Lookout: myCrew names the roster place of the hand her card calls Lookout (the crew keeps her bow with him), none for a boat with no hands - and the world sets it on every ship\'s ctx, the sea\'s and a peer\'s none (mutants: the card unread, the role misnamed, the ctx unset)', async () => {
  const h = await sea({ hull: HULL.LargeGalley, settings: { ShipsAtSea: 'off', Boarders: false } });
  assert.equal(h.host.myCrew(h.boat).lookout, -1, 'no hands of hers, no Lookout');
  h.boat.crewed = true;
  h.run(0.2);   // her hands hired as her crew stands
  const hands = h.host.crewOf(h.boat).hands;
  const at = hands.findIndex((x) => x.role === 'Lookout');
  assert.ok(at > 0, `her card names a Lookout (${hands.map((x) => x.role).join(', ')})`);
  assert.equal(h.host.myCrew(h.boat).lookout, at, 'his roster place');
  assert.notEqual(hands[at].role, hands[0].role);
  assert.match(WORLD, /_crewCtx\.lookout = ship\.mine\?\.lookout \?\? -1;/, 'set for every ship, every frame (the ctx is shared)');
  assert.match(WORLD, /const _crewCtx = \{[^}]*lookout: -1 \}/);
});
