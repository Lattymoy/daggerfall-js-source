// AUDIT GALLEON-2 (2026-10-03, the second read of Mac's galleon) - HER GUN DECK AND ITS ONLINE SIDE. Each fix's pin
// failed on the code as it stood (57baee705); each test pin failed on the mutant it was written for
// (tools/mutants/auditgalleon2_guns.json):
//   PF1 a shutter snapped open as its ball leaves stands open on that frame in world.js's own order (the boat's Animators
//       before the sea's frame) - mine, and another player's on my screen;
//   GN2 another player's galleon laid and fired settles on my screen when she leaves her helm (her boat moored, out of
//       the helm list the gun deck stepped her from: guns frozen out, shutters up for ever);
//   GN3 another player's lay held still stays laid on my screen at Come Sail Away's time scale (her word comes on the
//       real clock: laid 165 frames of 360 at x5);
//   GN4 another player's ship's balls leave her ports as this screen drew them as each left, not her word's pose (each
//       volley's first ball stood up to 0.51 m off its port as drawn, a flash up to 1.16 m off it under way);
//   GN5 the Naval arc switched off, or the sea cleared, sets every gun deck at rest (a laid galleon stayed laid);
//   GN6 navalShips.js gives her gun deck at her model's own 1.0829;
//   TS1 her port battery stands on her port side - run in, run out and kicked back, the barrels outboard;
//   TS2 a galleon at sea lays her side ahead of her broadside (her captain's run-out) and each gun kicks back as it fires.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { scene } from '../../csaScene.mjs';
import { sea, freshPool } from '../../navalSea.mjs';
import * as ships from '../../../src/systems/naval/navalShips.js';
const { HULL } = ships;
import { MEASURED, LID_OPEN_DEG } from '../../../src/world/ships/galleonModel.js';
import { createGalleonGunDeck, RUN_OUT_X, RUN_IN_X, RUN_SPEED, RECOIL, KICK_S, HAUL_S, HOLD_S } from '../../../src/systems/naval/galleonGunDeck.js';
import { quatRotate } from '../../../src/world/quat.js';
import { setTimeScale, resetTimeScale } from '../../../src/systems/timeScale.js';
import { Boat } from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';

const near = (a, b, eps, what) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b}`);
const nodesOf = (boat) => [...boat.GameObject.walk()];
const nodeOf = (boat, name) => nodesOf(boat).find((n) => n.name === name);
const animatorsOf = (boat) => nodesOf(boat).flatMap((n) => n.getComponents('Animator').map((c) => c.animator).filter(Boolean));
const lidAngle = (n) => Math.abs(2 * Math.atan2(Math.hypot(n.localRotation[0], n.localRotation[2]), n.localRotation[3]) * 180 / Math.PI);
const FIVE = [0, 1, 2, 3, 4];
const LOOK_STARBOARD = { origin: [0, 5, 0], dir: [1, -0.05, 0] };
const LOOK_PORT = { origin: [0, 5, 0], dir: [-1, -0.05, 0] };
/** How long a laid and fired side takes to come to rest once nothing lays it (s): its hold, its run in, its haul. */
const SETTLE_S = HOLD_S + (RUN_OUT_X - RUN_IN_X) / RUN_SPEED + KICK_S + HAUL_S + 1;

/** Two players: A at her armed helm, B with A's galleon built in B's own pool - in B's helm list while `at.helm`. A
 *  frame of both in world.js's order: csaUpdate (Come Sail Away's animate - my boats' Animators; csaPeers.frame -
 *  another player's boats', moored or at the helm) and then navalFrame. */
async function pair() {
  const poolB = await freshPool();
  const aOnB = poolB.spawnNow(Object.assign(new Boat(HULL.SmallShip, 0), { uid: 7 }), { position: [0, 0, 0], rotation: [0, 0, 0, 1] });
  const at = { helm: true };
  const A = await sea({ hull: HULL.SmallShip, pool: await freshPool(), online: { id: () => 'a', peers: () => [{ id: 'b', feet: [30, 0, 0] }], sendHit: () => true } });
  const B = await sea({ hull: null, pool: poolB, online: { id: () => 'b', peers: () => [{ id: 'a', feet: [0, 0, 0] }], sendHit: () => true },
    peerBoats: () => (at.helm ? [{ id: 'a', pos: [0, 0, 0], vel: [0, 0, 0], speed: 0, hull: HULL.SmallShip, yaw: 0, boat: aOnB }] : []) });
  B.view.feet = [30, 0, 0];
  const animsA = animatorsOf(A.boat), animsB = animatorsOf(aOnB);
  const tick = ({ send = true, older = false, dt = 1 / 30 } = {}) => {
    for (const a of animsA) a.update(dt);
    A.host.frame(dt);
    for (const a of animsB) a.update(dt);
    B.host.frame(dt);
    if (!send) return;
    const w = A.host.word((p) => p);
    if (!w) return;
    B.host.applyWord('a', JSON.parse(JSON.stringify(older ? (({ g, ...rest }) => rest)(w) : w)), (p) => p);
  };
  return { A, B, aOnB, at, tick };
}

test('AUDIT GALLEON-2 PF1: a shutter snapped open as its ball leaves stands open on that very frame in the order world.js runs one - the boat\'s Animators (csaUpdate: Come Sail Away\'s animate, csaPeers.frame) and THEN the sea (navalFrame); the Play waited for their next update, and a quick click\'s balls left through shutters at 0-27 deg', async () => {
  // mine: a quick click, the release with no lay before it, at 60 frames a second
  {
    const h = await sea({ hull: HULL.SmallShip });
    const anims = animatorsOf(h.boat);
    const frame = (dt) => { for (const a of anims) a.update(dt); h.host.frame(dt); };
    frame(0.1); frame(0.1);
    h.view.look = LOOK_STARBOARD;
    h.host.attackInput(true);
    h.host.attackInput(false);
    const atShot = [];
    let shakes = h.log.shake.length;
    for (let k = 0; k < 120 && atShot.length < 5; k++) {
      frame(1 / 60);
      const r = h.host.gunDeckOf(h.boat);
      for (; shakes < h.log.shake.length; shakes++) { const i = atShot.length; atShot.push({ x: r.starboard.guns[i], lid: lidAngle(nodeOf(h.boat, `GunportStarboard${i}`)) }); }
    }
    assert.equal(atShot.length, 5, 'my five balls');
    atShot.forEach(({ x, lid }, i) => {
      assert.ok(x >= RUN_OUT_X - 0.2, `my gun ${i} out as its ball left (${x.toFixed(3)})`);
      assert.ok(Math.abs(lid - LID_OPEN_DEG) < 1.5, `my shutter ${i} up on the frame its ball left (${lid.toFixed(1)} deg)`);
    });
  }
  // hers on my screen, from a word with no lay in it (an older build's): her Animators stepped (csaPeers.frame) before
  // my sea's frame flies her balls
  {
    const { A, B, aOnB, tick } = await pair();
    for (let i = 0; i < 10; i++) tick({ older: true });
    A.view.look = LOOK_STARBOARD;
    A.host.attackInput(true);
    for (let i = 0; i < 45; i++) tick({ older: true });
    A.host.attackInput(false);
    const atShot = [];
    let heard = B.log.sounds.filter((x) => x[0] === 'naval:cannon').length;
    for (let i = 0; i < 90 && atShot.length < 5; i++) {
      tick({ older: true });
      const n = B.log.sounds.filter((x) => x[0] === 'naval:cannon').length;
      for (; heard < n; heard++) { const k = atShot.length; atShot.push(lidAngle(nodeOf(aOnB, `GunportStarboard${k}`))); }
    }
    assert.equal(atShot.length, 5, 'her five reports heard');
    atShot.forEach((a, k) => assert.ok(Math.abs(a - LID_OPEN_DEG) < 1.5, `her shutter ${k} up on my screen on the frame its ball left (${a.toFixed(1)} deg)`));
  }
});

test('AUDIT GALLEON-2 GN2: another player\'s galleon laid and fired on my screen comes to rest when she leaves her helm - her boat moored here drops out of the helm list (csaPeers.helmBoats) the gun deck stepped her from, and her guns stood frozen out and her shutters up for ever', async () => {
  // laid from her word and fired; and fired alone (an older build's word says no lay - her side laid by her shots)
  for (const older of [false, true]) {
    const { A, B, aOnB, at, tick } = await pair();
    for (let i = 0; i < 10; i++) tick({ older });
    A.view.look = LOOK_STARBOARD;
    A.host.attackInput(true);
    for (let i = 0; i < 45; i++) tick({ older });
    A.host.attackInput(false);   // her broadside away
    for (let i = 0; i < 10; i++) tick({ older });
    const was = B.host.gunDeckOf(aOnB).starboard;
    assert.ok(was.laid && was.guns.some((x) => x > RUN_IN_X + 0.1), `${older ? 'an older word' : 'her lay said'}: fired and laid on my screen (${was.guns.map((x) => x.toFixed(2))})`);
    at.helm = false; A.runtime.sailing = false;   // she leaves her helm, her boat moored where she lies
    for (let i = 0; i < 30 * SETTLE_S; i++) tick({ older });
    const gx = FIVE.map((i) => Math.abs(nodeOf(aOnB, `GunStarboard${i}`).localPosition[0]));
    assert.ok(gx.every((x) => Math.abs(x - RUN_IN_X) < 1e-6), `${older ? 'an older word' : 'her lay said'}: her guns run in on my screen (${gx.map((x) => x.toFixed(2))}, run in ${RUN_IN_X})`);
    const lids = FIVE.map((i) => lidAngle(nodeOf(aOnB, `GunportStarboard${i}`)));
    assert.ok(lids.every((a) => a < 1), `${older ? 'an older word' : 'her lay said'}: her shutters down on my screen (${lids.map((a) => a.toFixed(0))} deg)`);
  }
});

test('AUDIT GALLEON-2 GN3: another player\'s lay held still stays laid on my screen whatever Come Sail Away\'s time scale - her word comes on the real clock (a still one every FOES_FULL_MS, 2 s), and PEER_LAY_S on my scaled sea clock let it lapse between two (laid 165 frames of 360 at x5)', async () => {
  for (const scale of [1, 5, 15]) {
    const { A, B, aOnB } = await pair();
    const animsA = animatorsOf(A.boat), animsB = animatorsOf(aOnB);
    let t = 0, lastSent = -Infinity, lastFull = -Infinity, key = null;
    const DT = 1 / 30;
    // her world at one, mine at `scale` (world.js naval.frame(dt * worldTimeScale()); her boat's Animators on the real
    // clock, csaPeers.frame); the world's pump (test/navalRoom.mjs, world.js navalWord) on the real clock - on change
    // every FOES_MS (200 ms), always every FOES_FULL_MS (2 s)
    const step = () => {
      t += DT;
      setTimeScale(1);
      for (const a of animsA) a.update(DT);
      A.host.frame(DT);
      setTimeScale(scale);
      for (const a of animsB) a.update(DT);
      B.host.frame(DT * scale);
      if (t * 1000 - lastSent >= 200) {
        lastSent = t * 1000;
        const full = t * 1000 - lastFull >= 2000;
        const rec = A.host.word((p) => p), k = rec ? JSON.stringify(rec) : '';
        if (full || k !== key) { key = k; if (full) lastFull = t * 1000; B.host.applyWord('a', rec == null ? null : JSON.parse(k), (p) => p); }
      }
    };
    try {
      for (let i = 0; i < 30; i++) step();
      A.view.look = LOOK_STARBOARD;
      A.host.attackInput(true);   // she lays and holds
      for (let i = 0; i < 60; i++) step();
      let down = 0;
      for (let i = 0; i < 30 * 12; i++) { step(); if (!B.host.gunDeckOf(aOnB).starboard.laid) down++; }
      assert.ok(A.host.gunDeckOf(A.boat).starboard.laid, 'laid on her own screen');
      assert.equal(down, 0, `at x${scale} her battery laid on my screen every frame of twelve seconds (${down} of 360 not)`);
    } finally {
      resetTimeScale();
    }
  }
});

/** A muzzle of a battery (the root's frame) through a hull lying `q` about its own place `lp` (her MeshObject's turn;
 *  the node between at identity on every hull), stood on a root at `pos`, `yaw` (navalHost.js heeled). */
function heeledMuzzle(m, q, lp, pos, yaw) {
  const h = quatRotate(q, [m[0] - lp[0], m[1] - lp[1], m[2] - lp[2]]);
  const p = [h[0] + lp[0], h[1] + lp[1], h[2] + lp[2]];
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [pos[0] + c * p[0] + s * p[2], pos[1] + p[1], pos[2] - s * p[0] + c * p[2]];
}

test('AUDIT GALLEON-2 GN4: another player\'s ship\'s balls leave her ports as this screen drew them when each left - her drawn root (gliding on between her words, PUPPET-GLIDE) set back by her way over the volley\'s age, not the pose her word gave: her shutters and guns are the drawn copy\'s, and her flashes stood up to 1.16 m off them', async () => {
  const mk = async (id, i) => sea({ hull: null, settings: { ShipsAtSea: 'off' }, seed: 5 + i * 7919, pool: await freshPool(),
    online: { id: () => id, peers: () => [{ id: id === 'a' ? 'b' : 'a', feet: [0, 0, 0] }], sendHit: () => false } });
  const A = await mk('a', 0), B = await mk('b', 1);
  const wind = () => ({ state: { windVectorCurrent: [0.6, 0, 0.8], AllBoats: [] }, isSailing: () => false });
  A.deps.csa = wind; B.deps.csa = wind;
  // a relay's latency, 50-400 ms a word, in order (the reviewer's p1_puppet_muzzle)
  let s = 11; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const queue = []; let t = 0, sent = -Infinity, last = 0;
  // her copies as my screen draws them, frame by frame (my sea's clock: every frame a whole step), and each ball she
  // flies here with the moment it leaves on that clock (its flash, navalShots.js 'muzzle', where it starts)
  const drawn = new Map(), balls = [];
  const fly = B.host._shots.fireVolley;
  B.host._shots.fireVolley = (o) => { for (const l of o.launches) balls.push({ shooter: o.shooter, side: o.side, i: l.index, p0: [...l.p0], born: t - (o.since ?? 0) + (l.delay ?? 0) }); return fly(o); };
  const tick = (dt) => {
    t += dt;
    A.host.frame(dt); B.host.frame(dt);
    for (const [id, e] of B.host._sea) {
      if (!e.owner || !e.boat) continue;
      if (!drawn.has(id)) drawn.set(id, []);
      drawn.get(id).push({ t, pos: [...e.boat.GameObject.position], yaw: e.ship.yaw, q: [...e.boat.MeshObject.localRotation], lp: [...e.boat.MeshObject.localPosition] });
    }
    if (t - sent >= 0.2) { sent = t; last = Math.max(last, t + 0.05 + rnd() * 0.35); queue.push({ at: last, rec: JSON.stringify(A.host.word((p) => p)) }); }
    while (queue.length && queue[0].at <= t) B.host.applyWord('a', JSON.parse(queue.shift().rec), (p) => p);
  };
  const X = A.host._sea.get(A.host.spawnShip('navyCutter', { range: 100, bearing: 0 }));
  const Y = A.host._sea.get(A.host.spawnShip('pirateBrig', { range: 200, bearing: 0, temper: 'bold' }));
  X.ship.pos = [-130, 0, 700]; Y.ship.pos = [130, 0, 700];
  X.ship.yaw = Math.PI / 2 - 0.5; Y.ship.yaw = 1.5 * Math.PI + 0.4;
  for (let k = 0; k < 120 * 30 && balls.length < 40; k++) {
    tick(1 / 30);
    const mid = [(X.ship.pos[0] + Y.ship.pos[0]) / 2, 0, (X.ship.pos[2] + Y.ship.pos[2]) / 2];
    A.view.feet = mid; B.view.feet = mid;
  }
  for (let k = 0; k < 30; k++) tick(1 / 30);   // the ripple's last balls leave
  // each ball's start against its port as her copy was drawn when it left (between two frames, her way taken evenly)
  const off = [], first = [];
  for (const b of balls) {
    const h = drawn.get(b.shooter) ?? [];
    const j = h.findIndex((x) => x.t >= b.born);
    if (j < 1) continue;
    const a = h[j - 1], c = h[j], u = (b.born - a.t) / (c.t - a.t);
    const w = heeledMuzzle(ships.batteryOf(HULL.SmallShip, b.side).muzzles[b.i], c.q, c.lp, a.pos.map((x, k) => x + (c.pos[k] - x) * u), a.yaw + (c.yaw - a.yaw) * u);
    const d = Math.hypot(b.p0[0] - w[0], b.p0[1] - w[1], b.p0[2] - w[2]);
    off.push(d);
    if (b.i === 0) first.push(d);
  }
  assert.ok(off.length >= 30 && first.length >= 6, `their broadsides flown on my screen (${off.length} balls, ${first.length} volleys)`);
  const sorted = [...off].sort((x, y) => x - y), q = (f) => sorted[Math.floor(f * (sorted.length - 1))];
  // a volley's first ball has no ripple to carry it - at its port; the ripple's later balls go on her way as her word
  // said it, the copy on hers as she glides (a few tenths over the ripple's 0.36 s)
  assert.ok(Math.max(...first) < 0.2, `each volley's first ball from its port as drawn (worst ${Math.max(...first).toFixed(2)} m)`);
  assert.ok(q(0.5) < 0.1 && q(0.9) < 0.3, `her balls from her ports as drawn: median ${q(0.5).toFixed(2)} m, 90th ${q(0.9).toFixed(2)} m (worst ${sorted.at(-1).toFixed(2)}; the port's half-width ${MEASURED.portHalfW})`);
});

test('AUDIT GALLEON-2 GN5: the Naval arc switched off, or the sea cleared (a transition), sets every gun deck at rest at once - her guns in and her shutters coming down with her own Animators (a laid galleon stood laid for as long as the arc was off: the sea\'s frame steps nothing)', async () => {
  for (const how of ['off', 'clear']) {
    const h = await sea({ hull: HULL.SmallShip });
    const anims = animatorsOf(h.boat);
    const animate = (dt) => { for (const a of anims) a.update(dt); };   // Come Sail Away's: her Animators run on whatever the sea does
    const frame = (dt) => { animate(dt); h.host.frame(dt); };
    frame(0.1);
    h.view.look = LOOK_STARBOARD;
    h.host.attackInput(true);
    for (let t = 0; t < 2; t += 0.05) frame(0.05);
    const was = h.host.gunDeckOf(h.boat).starboard;
    assert.ok(was.laid && was.guns.every((x) => Math.abs(x - RUN_OUT_X) < 1e-6), `${how}: laid first`);
    if (how === 'off') h.host.setEnabled(false); else h.host.clear();
    const gx = FIVE.map((i) => nodeOf(h.boat, `GunStarboard${i}`).localPosition[0]);
    assert.ok(gx.every((x) => Math.abs(x - RUN_IN_X) < 1e-9), `${how}: her guns run in at once (${gx.map((x) => x.toFixed(2))})`);
    assert.ok(!h.host.gunDeckOf(h.boat).starboard.laid, `${how}: her side no longer laid`);
    for (let t = 0; t < 2; t += 0.05) (how === 'off' ? animate : frame)(0.05);
    const lids = FIVE.map((i) => lidAngle(nodeOf(h.boat, `GunportStarboard${i}`)));
    assert.ok(lids.every((a) => a < 1), `${how}: her shutters down (${lids.map((a) => a.toFixed(1))} deg)`);
    h.host.attackInput(false);
  }
});

test('AUDIT GALLEON-2 GN6: navalShips.js gives her gun deck where her model measures it (galleonModel.js MEASURED.gunDeckY 1.0829 - it said 1.085)', () => {
  const src = readFileSync(new URL('../../../src/systems/naval/navalShips.js', import.meta.url), 'utf8');
  const said = [...src.matchAll(/gun deck(?: at)? \(?(\d+\.\d+)/g)].map((m) => Number(m[1]));
  assert.ok(said.length >= 2, `her gun deck's height said (${said})`);
  for (const v of said) assert.equal(v, MEASURED.gunDeckY, `her gun deck said at ${v}`);
});

test('AUDIT GALLEON-2 TS1: her port battery stands on her port side - each port gun at -RUN_IN_X run in, -RUN_OUT_X run out, -(RUN_OUT_X - RECOIL) kicked back, its barrel outboard to port (the gun deck\'s side sign was unpinned: every reading was |x|, every host test fired to starboard)', async () => {
  const s = scene();
  const boat = s.place(HULL.SmallShip, 0);
  const deck = createGalleonGunDeck();
  const at = (side) => FIVE.map((i) => nodeOf(boat, `Gun${side}${i}`).localPosition[0]);
  const both = (want, what) => {
    for (const [side, sgn] of [['Starboard', 1], ['Port', -1]]) at(side).forEach((x, i) => near(x, sgn * want, 1e-9, `${side} gun ${i} ${what}`));
  };
  deck.step([boat], 0);
  both(RUN_IN_X, 'run in');
  deck.lay(boat, 'starboard', 0); deck.lay(boat, 'port', 0);
  deck.step([boat], 1.5);
  both(RUN_OUT_X, 'run out');
  for (const i of FIVE) { deck.fired(boat, 'starboard', i, 1.5); deck.fired(boat, 'port', i, 1.5); }
  deck.step([boat], 1.5 + KICK_S);
  both(RUN_OUT_X - RECOIL, 'kicked back');
  // at her helm: my look to port lays her port side - out to port, the starboard side in - and each port gun kicks back
  // inboard from its port as its ball leaves
  const h = await sea({ hull: HULL.SmallShip });
  const g = (side, i) => nodeOf(h.boat, `Gun${side}${i}`).localPosition[0];
  h.run(0.2);
  FIVE.forEach((i) => { near(g('Port', i), -RUN_IN_X, 1e-9, `port gun ${i} in`); near(g('Starboard', i), RUN_IN_X, 1e-9, `starboard gun ${i} in`); });
  h.view.look = LOOK_PORT;
  h.host.attackInput(true);
  h.run(1.5);
  FIVE.forEach((i) => { near(g('Port', i), -RUN_OUT_X, 1e-9, `port gun ${i} out to port`); near(g('Starboard', i), RUN_IN_X, 1e-9, `starboard gun ${i} still in`); });
  h.host.attackInput(false);
  const deepest = FIVE.map(() => Infinity);
  for (let k = 0; k < 75; k++) {
    h.run(0.02, 0.02);
    FIVE.forEach((i) => { const x = g('Port', i); assert.ok(x < 0, `port gun ${i} on her port side (${x.toFixed(3)})`); deepest[i] = Math.min(deepest[i], -x); });
  }
  deepest.forEach((d, i) => near(d, RUN_OUT_X - RECOIL, 0.01, `port gun ${i} kicked back inboard from its port`));
});

test('AUDIT GALLEON-2 TS2: a galleon at sea runs her guns out and opens her ports ahead of her broadside - her side laid and her shutters ordered open a second and more before her first report, up at it - and each gun kicks back as its ball leaves (her captain\'s run-out, her gun deck\'s step and her shooter\'s boat each unpinned)', async () => {
  const h = await sea({ hull: null, seed: 5 });
  h.deps.csa = () => ({ state: { windVectorCurrent: [0.6, 0, 0.8], AllBoats: [] }, isSailing: () => false });
  const A = h.host._sea.get(h.host.spawnShip('navyCutter', { range: 100, bearing: 0 }));
  const B = h.host._sea.get(h.host.spawnShip('pirateBrig', { range: 200, bearing: 0, temper: 'bold' }));
  A.ship.pos = [-130, 0, 700]; B.ship.pos = [130, 0, 700];
  A.ship.yaw = Math.PI / 2 - 0.5; B.ship.yaw = 1.5 * Math.PI + 0.4;
  const pair2 = [A, B];
  const battery = ships.batteriesOf(HULL.SmallShip).filter((b) => b.side === 'starboard' || b.side === 'port');
  let t = 0;
  const laidAt = new Map(), openAt = new Map(), first = new Map(), kicks = [];
  const play = h.deps.audio.play3d;
  h.deps.audio.play3d = (k, p, v, o) => {
    if (k === 'naval:cannon') {
      // the ship, side and gun the report is of: the nearest muzzle in her root's frame as she fires
      let best = null;
      for (const e of pair2) {
        const c = Math.cos(e.ship.yaw), sn = Math.sin(e.ship.yaw), dx = p[0] - e.ship.pos[0], dz = p[2] - e.ship.pos[2];
        const x = c * dx - sn * dz, z = sn * dx + c * dz;
        for (const b of battery) b.muzzles.forEach((m, i) => { const d = Math.hypot(x - m[0], z - m[2]); if (!best || d < best.d) best = { d, e, side: b.side, i }; });
      }
      if (best && best.d < 2) {
        const key = `${best.e.id}:${best.side}`;
        if (!first.has(key)) first.set(key, { t, lids: FIVE.map((i) => lidAngle(nodeOf(best.e.boat, `Gunport${best.side === 'port' ? 'Port' : 'Starboard'}${i}`))) });
        kicks.push({ ...best, t, deepest: Infinity });
      }
    }
    return play(k, p, v, o);
  };
  for (; t < 60; t += 0.1) {
    h.host.frame(0.1);
    h.view.feet = [(A.ship.pos[0] + B.ship.pos[0]) / 2, 0, (A.ship.pos[2] + B.ship.pos[2]) / 2];
    for (const e of pair2) {
      const r = e.boat ? h.host.gunDeckOf(e.boat) : null;
      if (!r) continue;   // not built yet
      for (const side of ['starboard', 'port']) {
        const key = `${e.id}:${side}`;
        if (r[side].laid) { if (!laidAt.has(key)) laidAt.set(key, t); } else laidAt.delete(key);
        if (r[side].open.every(Boolean)) { if (!openAt.has(key)) openAt.set(key, t); } else openAt.delete(key);
        if (first.has(key) && first.get(key).laidFor == null) Object.assign(first.get(key), { laidFor: first.get(key).t - (laidAt.get(key) ?? first.get(key).t), openFor: first.get(key).t - (openAt.get(key) ?? first.get(key).t) });
      }
      for (const kk of kicks) if (kk.e === e && t - kk.t <= 0.35) kk.deepest = Math.min(kk.deepest, r[kk.side].guns[kk.i]);
    }
    if (first.size >= 2 && kicks.length >= 10 && kicks.every((kk) => t - kk.t > 0.35)) break;
  }
  assert.ok(first.size >= 2 && kicks.length >= 10, `both their broadsides heard (${first.size} sides, ${kicks.length} balls)`);
  for (const [key, f] of first) {
    assert.ok(f.laidFor >= 1, `${key}: her side laid ${f.laidFor.toFixed(1)} s before her first report (her run-out's tell is 1.3 s)`);
    assert.ok(f.openFor >= 1, `${key}: her shutters ordered open ${f.openFor.toFixed(1)} s before it`);
    assert.ok(f.lids.every((a) => Math.abs(a - LID_OPEN_DEG) < 1.5), `${key}: her shutters up at it (${f.lids.map((a) => a.toFixed(0))} deg)`);
  }
  for (const kk of kicks) assert.ok(kk.deepest < RUN_OUT_X - RECOIL / 2, `${kk.e.id} ${kk.side} gun ${kk.i} kicked back as its ball left (${kk.deepest.toFixed(2)}, run out ${RUN_OUT_X})`);
});
