// AUDIT NAV2 (2026-09-30, the naval second pass's deep audit - the captains' lens) - what the captains still got wrong
// once SEA-PEACE and HELM-WAY had made the Bay's ships fight each other: a stern chase that caught only a runner dead
// on the line, no way round land to a prize or a boat lying still, two ships struck to each other lying so for ever, a
// galley fighting a low hull from inside her own guns' dead zone, a fighting power that picked the wrong winner of half
// the navy-pirate duels, a ram that sank a prize outright, a quarry let go mid-chase, heavy hulls' way at rates the
// player's never had, a boat mending while her fight went on without her, a merchantman taking prizes, and the guns a
// navy hears left behind by the world. Each pin was seen to fail on the unfixed tree first. The pure captains driven
// directly, the host through real frames over Come Sail Away's own hulls (test/navalSea.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCEL, DECEL, WIND_RATED, CHASE_GIVE_UP_S, HEAR_GUNS_M, HEAR_S, GRAPPLE_STILL_S, WARY_ODDS,
  createSeaShip, stepCaptain, outguns, lookoutOf, windShare, hostile, fightingPower, shipPower, classPower, strikeTime, odds, hitShare,
  velocityOf, layMin,
} from '../src/systems/naval/navalAI.js';
import { HULL, hullBuild, classById, batteryOf, SHIP_TOUGHNESS } from '../src/systems/naval/navalShips.js';
import { SHIP_STATES, STRUCK_AT } from '../src/systems/naval/navalDamage.js';
import { NAVAL_DEG } from '../src/systems/naval/navalBallistics.js';
import { DESPAWN_BEYOND, encounterClasses } from '../src/systems/naval/navalDirector.js';
import { mulberry32 } from '../src/combat/bloodArt.js';
import { HOSTILE_NEAR_M, RAM_SPEED, SHIP_FADE_S } from '../src/scenes/navalHost.js';
import { FIELD_QUIET_S } from '../src/systems/naval/navalYard.js';
import { HANDLING } from '../src/systems/comeSailAway.js';
import { sea } from './navalSea.mjs';
import { scene } from './csaScene.mjs';

const DEG = NAVAL_DEG;
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} vs ${b} (±${eps})`);
const open = () => true;
const world = (o = {}) => ({ now: 0, dt: 0.1, seaY: 0, wind: [0, 0, WIND_RATED], isWater: open, contacts: [], random: () => 0.5, ...o });
const ship = (classId, o = {}) => createSeaShip({ id: o.id ?? classId, seed: o.seed ?? 1, classId, pos: o.pos ?? [0, 0, 0], yaw: o.yaw ?? 0, temper: o.temper ?? 'bold' });
const contactOf = (s, o = {}) => ({ id: s.id, kind: 'ship', faction: s.cls.faction, pos: s.pos, vel: [0, 0, 0], speed: 0, yaw: s.yaw, hull: s.hull, ship: s, ...o });
const player = (pos, o = {}) => ({ id: 'me', kind: 'player', pos, vel: [0, 0, 0], speed: 0, yaw: 0, hull: HULL.SmallShip, ...o });
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
/** A sea with no boat of mine and its own wind (the host reads its runtime's wind each step). */
function windOn(s, w) { s.deps.csa = () => ({ state: { windVectorCurrent: w, AllBoats: [] }, isSailing: () => false }); }

// ── F8: the guns heard move with the world, and go with it ─────────────────────────────────────────────────────────

test('AUDIT NAV2 F8 the guns a navy hears are the world\'s: a floating-origin shift moves every report by the offset, and a transition\'s clear() empties them - a navy launched after it hears nothing (mutants: the reports left where the world was, kept across the clear)', async () => {
  const s = await sea({ hull: null, seed: 9 });
  windOn(s, [0.6, 0, 0.8]);
  s.host.spawnShip('pirateBrig', { range: 300, bearing: 0, temper: 'bold' });
  s.host.spawnShip('merchantGalleon', { range: 450, bearing: 0.3 });
  const n = s.host._sea.get(s.host.spawnShip('navyCutter', { range: 900, bearing: Math.PI }));
  for (let t = 0; t < 80 && n.ship.mode !== 'answer'; t += 0.1) s.host.frame(0.1);
  assert.equal(n.ship.mode, 'answer', 'she answers the guns');
  const heard = [...n.ship.heard.pos];
  const off = [-819.2, 0, 409.6];
  s.host.offsetAll(off);
  s.view.feet = [s.view.feet[0] + off[0], 0, s.view.feet[2] + off[2]];
  s.host.frame(0.1);
  assert.ok(n.ship.heard, 'still answering');
  assert.ok(dist2(n.ship.heard.pos, [heard[0] + off[0], 0, heard[2] + off[2]]) < 60, `the report moved with the world: ${n.ship.heard.pos.map((v) => v.toFixed(0))} against ${heard.map((v) => v.toFixed(0))} + the offset`);
  // a transition: the sea empties - and so do the guns it heard
  s.host.clear();
  const m = s.host._sea.get(s.host.spawnShip('navyCutter', { range: 900, bearing: Math.PI }));
  assert.ok(dist2(m.ship.pos, n.ship.heard.pos) < HEAR_GUNS_M && dist2(m.ship.pos, n.ship.heard.pos) > lookoutOf(m.ship) * 0.5, 'she would hear the old reports');
  s.host.frame(0.1);
  assert.equal(m.ship.heard, null, 'no report outlives the clear');
  assert.notEqual(m.ship.mode, 'answer');
  assert.ok(HEAR_S > 1);
});

// ── F21: the stern chase ───────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV2 F21 the stern chase runs down a runner slower than CHASE_AWAY of her pace: a cutter astern of a fleeing sloop making 0.45 of the cutter\'s pace fires within 60 s, closes inside her fighting range and has not given her up at 150 s; a boat running at 0.45 of a brig\'s pace draws her fire within 60 s, and one at 0.3 of a brig\'s or a cutter\'s with the wind 45 degrees on her bow within 40 s (the course bent to outpace her; the lead laid abeam only when it will be in the run-out\'s reach once she is round and run out, and held while it is) (mutants: the flee unread, the bend flat, laid at the edge of reach, the laying never held)', () => {
  const W = [1.5, 0, 0];   // a beam wind for a chase to the north
  // the wary sloop fleeing a cutter (the patrol that escaped 7 times in 11)
  {
    const c = ship('navyCutter', { id: 'c' });
    const pace = classById('navyCutter').speed * windShare(Math.hypot(...W));
    c.speed = 6;
    const q = ship('pirateSloop', { id: 'q', temper: 'wary', pos: [0, 0, 250] });
    q.mode = 'flee';
    const v = 0.45 * pace;
    let first = null, gaveUp = null, least = Infinity;
    for (let t = 0; t < 150; t += 0.1) {
      q.pos = [q.pos[0], 0, q.pos[2] + v * 0.1];
      const out = stepCaptain(c, world({ now: t, wind: W, contacts: [contactOf(q, { vel: [0, 0, v], speed: v, yaw: 0 })] }));
      if (first == null && out.volleys.length) first = t;
      if (gaveUp == null && c.mode !== 'engage') gaveUp = t;
      least = Math.min(least, dist2(c.pos, q.pos));
    }
    assert.ok(first != null && first <= 60, `she fires on the runner within 60 s (first at ${first?.toFixed(1) ?? 'never'})`);
    assert.ok(least <= classById('navyCutter').range, `run down inside her fighting range (${least.toFixed(0)} m at the nearest)`);
    assert.equal(gaveUp, null, `never given up (${gaveUp?.toFixed(1)})`);
    assert.equal(c.mode, 'engage');
    assert.ok(!(c.spare.get('q') > c.clock), 'not spared');
  }
  // a player running from her (no flight of hers to read - her way alone): at 0.45 of a brig's pace on a beam wind; at
  // 0.3 of a brig's or a cutter's with the wind 45 degrees on her bow, either side
  for (const [classId, share, wind, within] of [['pirateBrig', 0.45, W, 60], ['pirateBrig', 0.3, [1.06, 0, -1.06], 40], ['pirateBrig', 0.3, [-1.06, 0, -1.06], 40],
    ['navyCutter', 0.3, [1.06, 0, -1.06], 40], ['navyCutter', 0.3, [-1.06, 0, -1.06], 40]]) {
    const b = ship(classId, { id: 'b' });
    const pace = classById(classId).speed * windShare(Math.hypot(...wind));
    b.speed = 6;
    const v = share * pace;
    const me = player([0, 0, 250], { vel: [0, 0, v], speed: v });
    let first = null;
    for (let t = 0; t < within && first == null; t += 0.1) {
      me.pos = [0, 0, me.pos[2] + v * 0.1];
      if (stepCaptain(b, world({ now: t, wind, notoriety: () => 100, contacts: [me] })).volleys.length) first = t;
    }
    assert.ok(first != null, `a ${classId} fires on the boat at ${share} of her pace within ${within} s (wind ${wind})`);
  }
});

test('AUDIT NAV2 F21 the chasers bear on a runner off the line: run down dead astern, a loaded bow battery steers for its own lead - an 8-degree-off runner at 5 m/s draws at least five chaser volleys in 90 s, as one dead on the line does (mutants: the intercept steered with the chasers loaded)', () => {
  const W = [0.5, 0, 0.87];
  const chase = (off) => {
    const n = createSeaShip({ id: 'n', seed: 1, classId: 'navyCutter', pos: [0, 0, 0], yaw: 0 });
    n.speed = 5.3;
    const qYaw = off * DEG, v = 5;
    const q = createSeaShip({ id: 'q', seed: 1, classId: 'pirateBrig', pos: [0, 0, 130], yaw: qYaw, temper: 'wary' });
    const vq = [Math.sin(qYaw) * v, 0, Math.cos(qYaw) * v];
    let fired = 0;
    const dt = 1 / 60;
    for (let t = 0; t < 90; t += dt) {
      q.pos = [q.pos[0] + vq[0] * dt, 0, q.pos[2] + vq[2] * dt];
      const out = stepCaptain(n, { now: t, dt, seaY: 0, wind: W, isWater: open, random: () => 0.5, contacts: [{ id: 'q', kind: 'ship', faction: 'pirate', pos: q.pos, vel: vq, speed: v, yaw: qYaw, hull: q.hull, ship: q }] });
      fired += out.volleys.filter((x) => x.side === 'bow').length;
    }
    return fired;
  };
  const dead = chase(0), off = chase(8);
  assert.ok(dead >= 5, `dead on the line: ${dead} chaser volleys`);
  assert.ok(off >= 5, `8 degrees off the line: ${off} chaser volleys in 90 s`);
});

test('AUDIT NAV2 F21 a chase that closes again after losing ground is kept: the gain is measured against the farthest she has lain in the last CHASE_GIVE_UP_S, not the best she ever did; one that gains nothing is still given up (mutants: the best ever)', () => {
  const b = ship('pirateBrig', { yaw: 0 });
  const w = world({ wind: [1.5, 0, 0], contacts: [player([0, 0, 300], { vel: [0, 0, 7], speed: 7 })] });
  // she loses ground for a minute (300 m to 450), then closes at 1.5 m/s - 315 m at 150 s, still past her fighting range
  const d = (t) => (t < 60 ? 300 + 2.5 * t : 450 - 1.5 * (t - 60));
  let gaveUp = null;
  for (let t = 0; t <= 200; t += 1) {
    w.contacts[0].pos = [b.pos[0], 0, b.pos[2] + d(t)];
    stepCaptain(b, { ...w, now: t, dt: 1 });
    if (gaveUp == null && b.mode !== 'engage') gaveUp = t;
  }
  assert.equal(gaveUp, null, `closing again, never given up (given up at ${gaveUp})`);
  assert.ok(d(200) > classById('pirateBrig').range * 1.8, 'past her fighting range all the while');
  // a chase that gains nothing - he keeps 400 m ahead whatever she does - is given up at CHASE_GIVE_UP_S
  const g = ship('pirateBrig', { yaw: 0 });
  let quit = null;
  for (let t = 0; t < CHASE_GIVE_UP_S + 30; t += 1) {
    w.contacts[0].pos = [g.pos[0], 0, g.pos[2] + 400];
    stepCaptain(g, { ...w, now: t, dt: 1 });
    if (quit == null && g.mode === 'cruise') quit = t;
  }
  assert.ok(quit != null && quit >= CHASE_GIVE_UP_S - 1, `given up at ${quit}`);
});

// ── F22: a way round the land ───────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV2 F22 a way round the land to a prize: a struck prize lying 31 m beyond a 900 m spit - the victor 250 m off on the far side - is reached round the spit\'s end (the cruise\'s law: legs sounded clear of the land), one end only; from every bearing she grapples within 600 s (mutants: no route, the route unsounded, the way round flips)', () => {
  const W = [0.6, 0, 0.8];
  const land = (x, z) => Math.abs(z) < 9 && x > -450 && x < 450;
  const failed = [];
  for (const [victor, prizeCls] of [['pirateSloop', 'merchantCoaster'], ['pirateBrig', 'merchantGalleon']]) {
    for (const pyaw of [0, 90]) {
      for (const from of [0, 45, 135, 180, 225, 315]) {
        const a = from * DEG;
        const start = [Math.sin(a) * 250, 0, 31 + Math.cos(a) * 250];
        const v = createSeaShip({ id: 'v', seed: 1, classId: victor, pos: start, yaw: Math.atan2(-Math.sin(a), -Math.cos(a)), temper: 'bold' });
        v.speed = 3;
        const p = createSeaShip({ id: 'pz', seed: 2, classId: prizeCls, pos: [0, 0, 31], yaw: pyaw * DEG });
        let grappled = null, left = null, onLand = 0, west = Infinity, east = -Infinity;
        for (let t = 0; t < 600 && grappled == null && left == null; t += 0.1) {
          const out = stepCaptain(v, { now: t, dt: 0.1, seaY: 0, wind: W, isWater: (x, z) => !land(x, z), random: () => 0.5, contacts: [contactOf(p, { struck: true, struckTo: 'v' })] });
          if (out.grapple) grappled = t; else if (v.mode !== 'board') left = t;
          if (land(v.pos[0], v.pos[2])) onLand++;
          if (v.pos[2] < -9) { west = Math.min(west, v.pos[0]); east = Math.max(east, v.pos[0]); }   // on the spit's far side
        }
        const say = `${victor} from ${from} (prize yaw ${pyaw})`;
        if (grappled == null) failed.push(`${say}: ${left != null ? `left at ${left.toFixed(0)} s` : 'never alongside'}`);
        if (Math.min(east, -west) > 30) failed.push(`${say}: made for both ends of the spit (${west.toFixed(0)} to ${east.toFixed(0)})`);
        assert.equal(onLand, 0, 'never across the spit');
      }
    }
  }
  assert.deepEqual(failed, [], 'every approach grapples, round one end');
});

test('AUDIT NAV2 F22 a boarding that gains nothing is given up: a prize lying in a lagoon the land closes round is spared SPARE_S and her victor sails on - so the host lets both go; a boat lying still in one is left be (mutants: the prize kept for ever, the boarding\'s tally unread)', () => {
  const lagoon = (x, z) => { const r = Math.hypot(x, z); return r > 60 && r < 90; };   // a ring of land about the prize
  const water = (x, z) => !lagoon(x, z);
  const v = createSeaShip({ id: 'v', seed: 1, classId: 'pirateBrig', pos: [0, 0, 300], yaw: Math.PI, temper: 'bold' });
  const p = createSeaShip({ id: 'pz', seed: 2, classId: 'merchantGalleon', pos: [0, 0, 0], yaw: 0 });
  let left = null;
  for (let t = 0; t < CHASE_GIVE_UP_S + 150 && left == null; t += 0.1) {
    stepCaptain(v, world({ now: t, isWater: water, contacts: [contactOf(p, { struck: true, struckTo: 'v' })] }));
    if (v.mode !== 'board') left = t;
  }
  assert.ok(left != null, 'she gives the prize up');
  assert.ok(left >= CHASE_GIVE_UP_S - 1, `only when she has gained nothing for CHASE_GIVE_UP_S (${left?.toFixed(1)})`);
  assert.ok(v.spare.get('pz') > v.clock, 'the prize spared');
  assert.equal(v.target, null);
  for (let t = 0; t < 20; t += 0.1) stepCaptain(v, world({ now: 1000 + t, isWater: water, contacts: [contactOf(p, { struck: true, struckTo: 'v' })] }));
  assert.equal(v.mode, 'cruise', 'and she sails on, leaving her be');
  // a boat of mine lying still in the lagoon: she comes to board, gains nothing, and leaves me be
  const b = createSeaShip({ id: 'b', seed: 1, classId: 'pirateBrig', pos: [0, 0, 300], yaw: Math.PI, temper: 'bold' });
  const me = player([0, 0, 0]);
  let boarded = false, gone = null;
  for (let t = 0; t < CHASE_GIVE_UP_S + GRAPPLE_STILL_S + 150 && gone == null; t += 0.1) {
    stepCaptain(b, world({ now: t, isWater: water, contacts: [me] }));
    boarded ||= b.mode === 'board';
    if (boarded && b.mode !== 'board') gone = t;
  }
  assert.ok(boarded, 'she came to board');
  assert.ok(gone != null && b.spare.get('me') > b.clock, 'and left me be');
});

test('AUDIT NAV2 F22 the berth is sounded: coming up on a boat moored with the land close along her starboard side, from that side, she takes the other - the berth she would lie in stands on the land (mutants: the berth unsounded)', () => {
  const water = (x) => x < 14;   // the quay 14 m off her keel, 5.6 m off her side
  const b = createSeaShip({ id: 'b', seed: 1, classId: 'pirateBrig', pos: [4, 0, 260], yaw: Math.PI, temper: 'bold' });
  const me = player([0, 0, 0], { crippled: true });
  stepCaptain(b, world({ isWater: (x) => water(x), contacts: [me] }));
  assert.equal(b.mode, 'board');
  assert.equal(b.berthSide, -1, 'the berth to starboard of her lies on the quay: to port');
  let grapple = null;
  for (let t = 0; t < 240 && !grapple; t += 0.1) grapple = stepCaptain(b, world({ now: t, isWater: (x) => water(x), contacts: [me] })).grapple;
  assert.equal(grapple, 'me', 'alongside on the open side');
  assert.ok(b.pos[0] < 0, `to port of her (${b.pos[0].toFixed(1)})`);
});

test('AUDIT NAV2 F22 a boat lying still behind a spit is no refuge: my Small Ship still 30 m beyond a thin spit, a bold brig standing in from the far side, is boarded - or the pirate leaves - within 600 s (mutants: no route round)', async () => {
  const land = (x, z) => Math.abs(z + 30) < 9 && x > -450 && x < 450;
  const s = await sea({ hull: HULL.SmallShip, seed: 7, water: (x, z) => !land(x, z) });
  s.runtime.state.velocityCurrent = [0, 0, 0];
  const e = s.host._sea.get(s.host.spawnShip('pirateBrig', { range: 330, bearing: Math.PI + 0.2, temper: 'bold' }));
  let end = null;
  for (let t = 0; t < 600 && end == null; t += 0.1) {
    s.host.frame(0.1);
    if (s.host.boarding) end = 'boarded';
    else if (t > GRAPPLE_STILL_S + 5 && !(e.ship.mode === 'board' && e.ship.target === 'local')) end = `left (${e.ship.mode})`;
  }
  assert.ok(end != null, `boarded or left within 600 s (she is ${e.ship.mode} at ${e.ship.pos.map((x) => x.toFixed(0))})`);
});

// ── F23: two ships struck to each other ──────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV2 F23 two ships struck to each other are let go: a ship that strikes (or sinks) fights no one - her target, berth side, side presented and chase cleared - and the director counts her in a fight only while she fights afloat (a prize is kept only for a taker coming for her); with every player past DESPAWN_BEYOND both go on the next director step (mutants: the target kept, a struck ship\'s last word read as a fight)', async () => {
  // the captain: struck, she lets her enemy go
  const c = ship('pirateBrig', { id: 'c' });
  stepCaptain(c, world({ contacts: [player([0, 0, 120], { vel: [0, 0, 3], speed: 3 })] }));
  assert.equal(c.target, 'me');
  c.damage.apply({ hull: Math.ceil(c.damage.hull - c.damage.maxHull * STRUCK_AT), sail: 0, crew: 0 });
  assert.equal(c.damage.state, SHIP_STATES.struck);
  stepCaptain(c, world({ contacts: [player([0, 0, 120])] }));
  assert.deepEqual([c.mode, c.target, c.berthSide, c.present, c.chase], ['struck', null, 0, null, null]);
  const k = ship('pirateBrig', { id: 'k' });
  stepCaptain(k, world({ contacts: [player([0, 0, 120], { vel: [0, 0, 3], speed: 3 })] }));
  k.damage.apply({ hull: k.damage.hull, sail: 0, crew: 0 });
  assert.equal(k.damage.state, SHIP_STATES.sinking);
  stepCaptain(k, world({ contacts: [player([0, 0, 120])] }));
  assert.equal(k.target, null, 'going down, she fights no one');
  // the host: a war galley and a brig at it, each struck to the other
  const pair = async () => {
    const s = await sea({ hull: null });
    const g = s.host._sea.get(s.host.spawnShip('navyGalley', { range: 300, bearing: 0 }));
    const b = s.host._sea.get(s.host.spawnShip('pirateBrig', { range: 480, bearing: 0.1 }));
    s.run(3);
    assert.equal(g.ship.target, b.id);
    assert.equal(b.ship.target, g.id);
    for (const [x, by] of [[g, b], [b, g]]) {
      x.ship.damage.apply({ hull: Math.ceil(x.ship.damage.hull - x.ship.damage.maxHull * STRUCK_AT), sail: 0, crew: 0 });
      assert.equal(x.ship.damage.state, SHIP_STATES.struck);
      x.struck = { by: by.id, at: 0 };
    }
    return { s, g, b };
  };
  {
    const { s, g, b } = await pair();
    s.host.frame(0.1);
    assert.deepEqual([g.ship.mode, g.ship.target, b.ship.mode, b.ship.target], ['struck', null, 'struck', null], 'each lies struck, fighting no one');
    assert.ok(s.host._sea.has(g.id) && s.host._sea.has(b.id) && !g.retiring && !b.retiring, 'in sight: kept');   // AUDIT BAY A15: never fading
    s.view.feet = [0, 0, -(DESPAWN_BEYOND + 3000)];
    s.host.frame(0.1);
    assert.ok(s.host._sea.get(g.id)?.retiring && s.host._sea.get(b.id)?.retiring, 'both let go on the next director step (SHIP-FADE: fading)');   // SHIP-FADE (2026-10-02) PIN MOVED
    for (let t = 0; t < SHIP_FADE_S + 0.5; t += 0.1) s.host.frame(0.1);
    assert.ok(!s.host._sea.has(g.id) && !s.host._sea.has(b.id), 'and gone once faded');
  }
  // the player gone the very step they struck - their last word still 'engage', each at the other: a ship fights only
  // afloat, so both go at once
  {
    const { s, g, b } = await pair();
    s.view.feet = [0, 0, -(DESPAWN_BEYOND + 3000)];
    s.host.frame(0.1);
    assert.ok(s.host._sea.get(g.id)?.retiring && s.host._sea.get(b.id)?.retiring, 'both let go on the next director step (SHIP-FADE: fading)');
    for (let t = 0; t < SHIP_FADE_S + 0.5; t += 0.1) s.host.frame(0.1);
    assert.ok(!s.host._sea.has(g.id) && !s.host._sea.has(b.id), 'and gone once faded');
  }
});

// ── F24: a galley's dead zone ─────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV2 F24 a galley turns her stem on a low hull only where her great guns can strike it: they cannot lay on a Large Boat inside 91 m, so inside it she fights her broadside - a war galley on a Large Boat making 3 m/s round a slow circle fires within 120 s from every quarter (mutants: the bow inside its dead zone, no dead zone sounded)', () => {
  const cases = [[[0, 0, -300], [0.6, 0, 0.8]], [[250, 0, 100], [-1.2, 0, 0.5]], [[-200, 0, 250], [0, 0, -1.5]], [[0, 0, 380], [1.4, 0, -0.4]]];
  const late = [];
  for (const [start, wind] of cases) {
    const g = createSeaShip({ id: 'g', seed: 1, classId: 'navyGalley', pos: start, yaw: Math.atan2(-start[0], -start[2]) });
    let yaw = 0, pos = [0, 0, 0], first = null;
    const v = 3, dt = 0.1;
    for (let t = 0; t < 120 && first == null; t += dt) {
      yaw += 2 * DEG * dt;
      pos = [pos[0] + Math.sin(yaw) * v * dt, 0, pos[2] + Math.cos(yaw) * v * dt];
      const out = stepCaptain(g, { now: t, dt, seaY: 0, wind, isWater: open, random: () => 0.5, notoriety: () => 100,
        contacts: [player(pos, { vel: [Math.sin(yaw) * v, 0, Math.cos(yaw) * v], speed: v, yaw, hull: HULL.LargeBoat, hullShare: 1 })] });
      if (out.volleys.length) first = t;
    }
    if (first == null) late.push(`from ${start}`);
  }
  assert.deepEqual(late, [], 'she fires within 120 s');
});

test('AUDIT NAV2 F24 a galley fights a low hull from outside her dead zone: a war galley and a bold pirate sloop, each the other\'s captain, in p04\'s eight geometries and winds - the sloop closing to her own 55 m, inside the galley\'s broadside\'s 57 - the galley opens the range hard, lays no gun inside it, and fires in every one within 90 s, lying inside it under a third of the time (mutants: the dead zone not opened, laid inside the dead zone)', () => {
  const WINDS = [[0.6, 0, 0.8], [-1.2, 0, 0.5], [0, 0, -1.5], [1.4, 0, -0.4]];
  const dz = layMin(HULL.LargeGalley, 'starboard', HULL.LargeBoat);
  near(dz, 57, 2, 'the broadside\'s dead zone on a Large Boat');
  const T = 300, late = [];
  let inside = 0;
  for (let k = 0; k < 8; k++) {
    const brg = k * 0.77, sep = 260 + (k % 3) * 60;
    const g = createSeaShip({ id: 'g', seed: 5 + k, classId: 'navyGalley', pos: [-Math.sin(brg) * sep / 2, 0, -Math.cos(brg) * sep / 2], yaw: brg + (k % 2 ? 0.8 : -0.5) });
    const p = createSeaShip({ id: 'p', seed: 7 + k, classId: 'pirateSloop', pos: [Math.sin(brg) * sep / 2, 0, Math.cos(brg) * sep / 2], yaw: brg + Math.PI + (k % 3 ? 0.4 : -0.9), temper: 'bold' });
    const c = (s) => contactOf(s, { vel: velocityOf(s), speed: s.speed });
    let first = null;
    for (let t = 0; t < T; t += 0.1) {
      const cg = c(g), cp = c(p);
      const w = world({ now: t, wind: WINDS[k % 4] });
      if (stepCaptain(g, { ...w, contacts: [cp] }).volleys.length && first == null) first = t;
      stepCaptain(p, { ...w, contacts: [cg] });
      if (dist2(g.pos, p.pos) < dz) inside += 0.1;
    }
    if (!(first <= 90)) late.push(`k ${k}: first ${first?.toFixed(0) ?? 'never'}`);
  }
  assert.deepEqual(late, [], 'she fires in every one within 90 s');
  assert.ok(inside < 8 * T / 3, `inside her dead zone ${inside.toFixed(0)} s of ${8 * T}`);
});

// AUDIT TOUGHER-SHIPS (the station re-pinned): the duels below caught a galley stationed inside her great guns' dead zone
// only by a stall - neither ship struck the other in 900 s - and with the ships toughened none of their eight stalls
// whether she does or not. Her station itself, against a boat that lies still and leaves the range to her alone.
test('AUDIT NAV2 F24 a war galley on a Large Boat lying still keeps her station off it - her fighting range never inside her great guns\' dead zone (91 m on a Large Boat), where at her class\'s own 70 m she sat inside it: from 75 m off, in eight bearings and four winds, she lies out past 70 m the minute through (mutants: the station inside the dead zones)', () => {
  const winds = [[0.6, 0, 0.8], [-1.2, 0, 0.5], [0, 0, -1.5], [1.4, 0, -0.4]];
  assert.ok(layMin(HULL.LargeGalley, 'bow', HULL.LargeBoat) > classById('navyGalley').range, 'her great guns\' dead zone past her class\'s range');
  const close = [];
  for (let k = 0; k < 8; k++) {
    const a = k * 0.79;
    const g = createSeaShip({ id: 'g', seed: 3 + k, classId: 'navyGalley', pos: [Math.sin(a) * 75, 0, Math.cos(a) * 75], yaw: a + (k % 2 ? 1.2 : -1.2) });
    const ds = [];
    for (let t = 0; t < 180; t += 0.1) {
      stepCaptain(g, { now: t, dt: 0.1, seaY: 0, wind: winds[k % 4], isWater: open, random: () => 0.5, notoriety: () => 100,
        contacts: [player([0, 0, 0], { hull: HULL.LargeBoat, hullShare: 1 })] });
      if (t > 60) ds.push(Math.hypot(g.pos[0], g.pos[2]));
    }
    ds.sort((x, y) => x - y);
    if (ds[ds.length >> 3] <= 70) close.push(`k ${k}: ${ds[ds.length >> 3].toFixed(0)} m`);
  }
  assert.deepEqual(close, [], 'she lies out past her class\'s range, toward her dead zone\'s edge');
});

// ── F26: a galley's ram and a prize ──────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV2 F26 a galley\'s ram brings a sound ship to strike, never under: a corsair galley\'s stem into a coaster at speed - a blow that would sink her outright - leaves her struck, a prize to take (mutants: the ram unbounded)', async () => {
  const s = await sea({ hull: null });
  const g = s.host._sea.get(s.host.spawnShip('pirateGalley', { range: 400, bearing: 0, temper: 'bold' }));
  const c = s.host._sea.get(s.host.spawnShip('merchantCoaster', { range: 700, bearing: 0 }));
  for (let i = 0; i < 20 && !(g.boat && c.boat); i++) s.host.frame(0.1);
  assert.ok(g.boat && c.boat, 'both hulls built');
  // her stem a hand's breadth off the coaster's side, the hulls posed where they stand, then the galley at speed
  const place = () => {
    c.ship.pos = [0, 0, 400]; c.ship.yaw = Math.PI / 2; c.ship.speed = 0;
    g.ship.pos = [0, 0, 400 - hullBuild(HULL.LargeBoat).halfWidth - 0.3 - hullBuild(HULL.LargeGalley).bowZ]; g.ship.yaw = 0;
  };
  place(); g.ship.speed = 0;
  s.host.frame(0.1);
  place(); g.ship.speed = RAM_SPEED + 4;
  const h0 = c.ship.damage.hullShare();
  for (let i = 0; i < 3; i++) s.host.frame(0.1);
  assert.ok(c.ship.damage.hullShare() < h0, 'the ram struck her');
  assert.equal(c.ship.damage.state, SHIP_STATES.struck, `struck, not ${c.ship.damage.state}`);
  assert.ok(c.ship.damage.hullShare() > 0);
});

// ── F27: the quarry kept while she is chased ─────────────────────────────────────────────────────────────────────────

test('AUDIT NAV2 F27 a quarry is in the fight while she is chased: a merchantman running from a pirate that engages her is never let go from under her pursuer, though every player is a bay off (mutants: flight not counted)', async () => {
  const s = await sea({ hull: null });
  windOn(s, [0.6, 0, 0.8]);
  const n = s.host._sea.get(s.host.spawnShip('pirateBrig', { range: 300, bearing: 0, temper: 'bold' }));
  const p = s.host._sea.get(s.host.spawnShip('merchantGalleon', { range: 460, bearing: 0.05 }));
  for (let t = 0; t < 20 && !(p.ship.mode === 'flee' && n.ship.mode === 'engage'); t += 0.1) s.host.frame(0.1);
  assert.equal(p.ship.mode, 'flee');
  assert.equal(n.ship.mode, 'engage');
  assert.equal(n.ship.target, p.id);
  s.view.feet = [0, 0, -(DESPAWN_BEYOND + 3000)];
  s.host.frame(0.1);
  assert.ok(s.host._sea.has(n.id) && !n.retiring, 'the pursuer kept');   // AUDIT BAY A15: a ship let go stands in the sea while she fades
  assert.ok(s.host._sea.has(p.id) && !p.retiring, 'and her quarry with her');
});

// ── F28: the heavy hulls' way ────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV2 F28 every hull\'s way comes and goes at the player\'s own rates: a captain gathers way as the player\'s hull of her kind does under the responsive helm at the rated wind, and loses it at that hull\'s coast - the Carrack as quick as a Small Ship, the Large Galley half as quick both ways (mutants: the old heavy half, the coast one rate)', () => {
  for (const [classId, hull] of [['pirateSloop', HULL.LargeBoat], ['pirateBrig', HULL.SmallShip], ['navyGalley', HULL.LargeGalley], ['pirateFlagship', HULL.Carrack]]) {
    const sc = scene();
    sc.deps.handling = () => 'responsive';
    sc.helm(sc.place(hull, 0));
    sc.rt.RaiseSails();
    sc.rt.state.windVectorCurrent = [WIND_RATED, 0, 0];
    sc.rt.state.windVectorTarget = [WIND_RATED, 0, 0];
    const gain = sc.rt.properties.moveAccel();
    sc.rt.state.sailPosition = 0;
    const coast = sc.rt.properties.moveAccel();
    const s = ship(classId, { yaw: 90 * DEG });
    s.course = [1e6, 0];   // a course held
    stepCaptain(s, world({ dt: 0.1, wind: [0, 0, WIND_RATED] }));
    near(s.speed / 0.1, gain, 0.06, `hull ${hull}: gathering way`);
    s.speed = 30;
    stepCaptain(s, world({ dt: 0.1, wind: [0, 0, WIND_RATED] }));
    near((30 - s.speed) / 0.1, coast, 1e-6, `hull ${hull}: losing it`);
  }
  assert.ok(ACCEL > 0 && DECEL > 0 && HANDLING.moveAccelSail > 0);
});

// ── F29: the mending waits on the boat's own waters ───────────────────────────────────────────────────────────────────

test('AUDIT NAV2 F29 her hands mend her only when no hostile ship is near HER: over the side or ashore the fight she lies in goes on, and so does the wait - a hurt boat with a bold pirate 400 m off mends nothing while I swim; with the pirate gone off she mends (mutants: the quiet read by where I stand)', async () => {
  const save = { v: 1, boats: { 42: { hull: 84, sail: 16, crew: 24, fire: 0, state: 'afloat', barrels: 4 } }, notoriety: {}, day: 1, raids: [] };
  const s = await sea({ hull: HULL.SmallShip, save, settings: { ShipsAtSea: 'off', Boarders: false } });
  s.boat.crewed = true;
  const pirate = s.host._sea.get(s.host.spawnShip('pirateBrig', { range: 900, temper: 'bold' }));
  const hold = (at) => { pirate.ship.pos = [...at]; pirate.ship.yaw = 0; pirate.ship.speed = 0; pirate.ship.yawRate = 0; };
  // over the side: 60 m off her in the water, the pirate 400 m off her
  s.runtime.sailing = false;
  s.view.feet = [60, 0, 0];
  assert.equal(s.host.aboard(), false, 'in the water, aboard no ship');
  const before = s.host.getSaveData().boats[42].hull;
  for (let i = 0; i < 100; i++) { hold([0, 0, 400]); s.host.frame(0.1); }
  assert.ok(400 < HOSTILE_NEAR_M);
  assert.equal(s.host.getSaveData().boats[42].hull, before, `no mending with her fight in the offing (${before} -> ${s.host.getSaveData().boats[42].hull})`);
  // the pirate a bay off: quiet, and she mends
  for (let i = 0; i < 100; i++) { hold([0, 0, 5000]); s.host.frame(0.1); }
  assert.ok(s.host.getSaveData().boats[42].hull > before, 'mending once her waters are quiet');
  assert.ok(FIELD_QUIET_S > 0);
});

// ── F30: merchants take no prizes ────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV2 F30 merchants take no prizes: a merchantman a pirate struck to (her return fire did it) sails on - never alongside, never grappled; navies and pirates take theirs (mutants: the merchant boards)', () => {
  for (const victorCls of ['merchantGalleon', 'merchantCarrack', 'merchantCoaster']) {
    const v = createSeaShip({ id: 'v', seed: 1, classId: victorCls, pos: [0, 0, 0], yaw: 0 });
    const p = createSeaShip({ id: 'pz', seed: 2, classId: 'pirateBrig', pos: [60, 0, 150], yaw: 1.2 });
    let grapple = null, boarded = false;
    for (let t = 0; t < 200 && grapple == null; t += 0.1) {
      const out = stepCaptain(v, world({ now: t, wind: [0.6, 0, 0.8], contacts: [contactOf(p, { struck: true, struckTo: 'v' })] }));
      grapple = out.grapple;
      boarded ||= v.mode === 'board';
    }
    assert.equal(grapple, null, `${victorCls}: never grappled`);
    assert.equal(boarded, false, `${victorCls}: never alongside`);
    assert.equal(v.target, null);
  }
  // a navy takes hers
  const n = createSeaShip({ id: 'v', seed: 1, classId: 'navyCutter', pos: [0, 0, 0], yaw: 0 });
  const q = createSeaShip({ id: 'pz', seed: 2, classId: 'pirateBrig', pos: [60, 0, 150], yaw: 1.2 });
  stepCaptain(n, world({ wind: [0.6, 0, 0.8], contacts: [contactOf(q, { struck: true, struckTo: 'v' })] }));
  assert.equal(n.mode, 'board');
});

// ── F25: the fighting power the duels bear out ───────────────────────────────────────────────────────────────────────

/** p04's duel: navy `a` on a bold pirate `b` - the k-th of eight geometries and winds, at the host's own step. */
async function duel(a, b, k) {
  const WINDS = [[0.6, 0, 0.8], [-1.2, 0, 0.5], [0, 0, -1.5], [1.4, 0, -0.4]];
  const s = await sea({ hull: null, seed: 5 + k * 31 });
  windOn(s, WINDS[k % WINDS.length]);
  const A = s.host._sea.get(s.host.spawnShip(a, { range: 100, bearing: 0 }));
  const B = s.host._sea.get(s.host.spawnShip(b, { range: 200, bearing: 0, temper: 'bold' }));
  const mid = [Math.sin(k * 2.1) * 700, 0, Math.cos(k * 2.1) * 700];
  const brg = k * 0.77, sep = 260 + (k % 3) * 60;
  A.ship.pos = [mid[0] - Math.sin(brg) * sep / 2, 0, mid[2] - Math.cos(brg) * sep / 2];
  B.ship.pos = [mid[0] + Math.sin(brg) * sep / 2, 0, mid[2] + Math.cos(brg) * sep / 2];
  A.ship.yaw = brg + (k % 2 ? 0.8 : -0.5); B.ship.yaw = brg + Math.PI + (k % 3 ? 0.4 : -0.9);
  for (let t = 0; t < 900 * SHIP_TOUGHNESS; t += 0.1) {   // PIN MOVED (TOUGHER-SHIPS): a fight as much longer as her ships are tougher
    s.host.frame(0.1);
    if (s.host._sea.has(A.id) && s.host._sea.has(B.id)) s.view.feet = [(A.ship.pos[0] + B.ship.pos[0]) / 2 + 600, 0, (A.ship.pos[2] + B.ship.pos[2]) / 2];
    const sa = A.ship.damage.state, sb = B.ship.damage.state;
    if (sa !== SHIP_STATES.afloat || sb !== SHIP_STATES.afloat) return sa !== SHIP_STATES.afloat ? b : a;
  }
  return null;
}

test('AUDIT NAV2 F25 the fighting power is the time each ship needs to make the other strike - by her hull or, one that strikes with her hands down, her men, whichever first; her hits by the other\'s size; her reload by her men; no fire from a battery that cannot lay where the other fights; a player\'s boat never strikes by her men - and the wary odds, the flight and the director\'s plunders read it (mutants: the crew\'s line unread, the size unread, the reload unread, the dead zone unread, the readers on the old scalar)', () => {
  const C = (id) => classPower(classById(id));
  const sloop = C('pirateSloop'), cutter = C('navyCutter'), galley = C('navyGalley'), brig = C('pirateBrig');
  // her hits by the other's size: the same battery strikes a Small Ship far oftener than a Large Boat
  const long = batteryOf(HULL.SmallShip, 'starboard');
  assert.ok(hitShare(long, 0.75, HULL.SmallShip) > 1.8 * hitShare(long, 0.75, HULL.LargeBoat), `${hitShare(long, 0.75, HULL.SmallShip).toFixed(2)} against ${hitShare(long, 0.75, HULL.LargeBoat).toFixed(2)}`);
  assert.ok(hitShare(long, 0.75, HULL.LargeBoat) > hitShare(long, 0.3, HULL.LargeBoat), 'and a crack crew\'s oftener than a green one\'s');
  // by her men: the sloop's swivels take two a ball - she makes a cutter strike by her crew long before her hull
  const byMen = strikeTime(sloop, cutter);
  assert.ok(byMen < strikeTime(sloop, fightingPower({ ...cutter, strikes: false })) / 3, `the cutter's men first (${byMen.toFixed(0)} s)`);
  // a player's boat never strikes by her men: sized by her hull alone
  const mine = fightingPower({ hull: HULL.SmallShip, hullHp: hullBuild(HULL.SmallShip).hullHp, crew: 24 });   // PIN MOVED (TOUGHER-SHIPS): her build's hull
  assert.equal(mine.strikes, false);
  assert.ok(strikeTime(sloop, mine) > 3 * byMen, 'my Small Ship is sized by her hull');
  // her fire slows as her men fall, and a boat without her crew loads single-handed
  assert.ok(strikeTime(fightingPower({ ...cutter, crewShare: 0.5 }), sloop) > strikeTime(cutter, sloop), 'her men thinned, her guns load slower');
  assert.ok(strikeTime(fightingPower({ ...mine, crewed: false }), sloop) > strikeTime(mine, sloop), 'single-handed, slower');
  // no fire from a battery that cannot lay where the other fights: a war galley's great guns (91 m) and broadside (57 m)
  // on a Large Boat that fights at 55 m - none; one that stands off at 100 m, both
  assert.equal(strikeTime(galley, sloop), Infinity);
  assert.ok(Number.isFinite(strikeTime(galley, fightingPower({ ...sloop, range: 100 }))));
  // the odds: the sloop masters the war galley; the cutter is no longer the sloop's master fifteen to one
  assert.ok(odds(sloop, galley) >= WARY_ODDS, 'the sloop outguns the war galley');
  assert.ok(odds(cutter, sloop) < WARY_ODDS && odds(sloop, cutter) < WARY_ODDS, `cutter and sloop close (${odds(cutter, sloop).toFixed(2)})`);
  near(odds(cutter, sloop) * odds(sloop, cutter), 1, 1e-9, 'one duel, two sides');
  // the readers: a wary pirate's prize at WARY_ODDS, her flight from a ship that outguns her, the director's plunders
  const warySloop = ship('pirateSloop', { temper: 'wary' });
  const coaster = ship('merchantCoaster', { id: 'm' });
  assert.equal(hostile(warySloop, contactOf(coaster)), odds(shipPower(warySloop), shipPower(coaster)) >= WARY_ODDS);
  assert.equal(outguns(contactOf(ship('navyCutter', { id: 'n' })), ship('pirateBrig', { temper: 'wary' })), odds(cutter, brig) > 1);
  assert.equal(outguns(contactOf(ship('navyGalley', { id: 'n' })), ship('pirateSloop', { temper: 'wary' })), false, 'a wary sloop never runs from a war galley that cannot lay on her');
  // a peer's bare number (an older word's) is read off her hull as she stands; with no hull, she cannot be sized up
  assert.equal(hostile(warySloop, player([0, 0, 0], { power: 12345, hull: HULL.LargeGalley, hullShare: 1 })), odds(sloop, fightingPower({ hull: HULL.LargeGalley, hullHp: hullBuild(HULL.LargeGalley).hullHp })) >= WARY_ODDS);
  assert.equal(hostile(warySloop, player([0, 0, 0], { power: 12345, hull: HULL.LargeGalley })), true, 'a galley that cannot lay on her is the sloop\'s prize');
  assert.equal(hostile(warySloop, player([0, 0, 0], { power: 12345, hull: undefined })), false, 'no hull: not sized');
  for (let i = 0; i < 60; i++) {
    const pl = encounterClasses('plunder', 9, mulberry32(i));
    if (pl) assert.ok(odds(classPower(pl.hunter), classPower(pl.quarry)) >= WARY_ODDS, `${pl.hunter.id} on ${pl.quarry.id}`);
  }
});

/** The odds within which a duel is a coin toss (TOUGHER-SHIPS). */
const COIN_TOSS = 1.1;
for (const navy of ['navyCutter', 'navyGalley']) {
  test(`AUDIT NAV2 F25 the fighting power bears out (Mac's bar): a ${navy} against each pirate, eight duels each - wherever the model favours a side at WARY_ODDS or better she wins six of eight, and no side wins six of eight that the model does not lean to (seven, where the odds are a coin toss - COIN_TOSS); and every duel is fought to a strike (AUDIT NAV2 F24: no galley held in her dead zone for 900 s, TOUGHER-SHIPS: times SHIP_TOUGHNESS) (mutants: the crew's line unread, the size unread, the dead zone unread)`, async () => {
    const lines = [];
    let called = 0;
    for (const pirate of ['pirateSloop', 'pirateBrig', 'pirateGalley', 'pirateFlagship']) {
      const o = odds(classPower(classById(navy)), classPower(classById(pirate)));
      const fav = o >= WARY_ODDS ? navy : 1 / o >= WARY_ODDS ? pirate : null;
      const wins = { [navy]: 0, [pirate]: 0, none: 0 };
      for (let k = 0; k < 8; k++) wins[(await duel(navy, pirate, k)) ?? 'none']++;
      const say = `${navy} v ${pirate}: the model's odds ${o.toFixed(2)}, the duels ${JSON.stringify(wins)}`;
      if (fav) { called++; if (wins[fav] < 6) lines.push(say); }
      // PIN MOVED (TOUGHER-SHIPS): odds within COIN_TOSS of even are a coin toss the model cannot call either way - six of
      // eight to one side is a fair coin's one time in seven, seven of eight one in thirty, so a toss still fails at
      // seven. The cutter and the sloop (0.95) went 4-4 here before the ships were toughened and 6-2 after, where 32
      // duels went 20-12 before and 16-16 after: as even as the model says
      const toss = Math.abs(Math.log(o)) <= Math.log(COIN_TOSS), bar = toss ? 7 : 6;
      if ((wins[navy] >= bar && !(o > 1)) || (wins[pirate] >= bar && !(o < 1))) lines.push(say);
      if (wins.none) lines.push(`${say} - not fought to a strike`);
    }
    assert.deepEqual(lines, []);
    assert.ok(called >= 2, `the model calls two of the four at least (${called})`);
  });
}
