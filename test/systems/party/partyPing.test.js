// PARTY-PING: a look's point for the party, and the dungeon's dotted route to it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PING_MARK_MS, PING_PATH_MS, PING_IN_MS, PING_OUT_MS, PING_REACH_M,
  aimPoint, fadeAlpha, settleAim, groundRoute, pingGround, markUnderLook, pathRibbon, pingPlace, buildingStop,
} from '../../../src/systems/party/partyPing.js';
import { pingDistanceText } from '../../../src/render/partyPingLabels.js';
import { pingSubject } from '../../../src/systems/party/partyPingCaption.js';
import { createPartyPingHost } from '../../../src/scenes/partyPingHost.js';
import { validPartyPose, PARTY_SEND_MS, PARTY_HZ_MAX, RELAY_VERSION, SOCIAL_ROOM } from '../../../src/net/wire.js';
import { OnlineSession } from '../../../src/net/online.js';
import { fakeSocketClass } from '../../fakeSocket.mjs';
import {
  createBindings, setBinding, getBinding, adoptPartyPingKey, addRemovedPrimaryAction,
} from '../../../src/systems/inputActions.js';

test('PARTY-PING: a look names a point within reach, and the floor route is dashes', () => {
  assert.deepEqual(aimPoint([0, 2, 0], [0, 0, 2], 4), [0, 2, 4]);
  assert.equal(aimPoint([0, 2, 0], [0, 0, 1], 0), null);
  assert.equal(aimPoint([0, 2, 0], [0, 0, 1], PING_REACH_M + 1), null);
  assert.equal(aimPoint([0, 2, 0], [0, 0, 0], 4), null);
  const ribbon = pathRibbon([[0, 0, 0], [2, 0, 0]]);
  assert.ok(ribbon.length >= 18 && ribbon.length % 18 === 0, 'whole dashes');
  assert.ok(ribbon.every(Number.isFinite));
  assert.equal(pathRibbon([[0, 0, 0]]).length, 0);
  const y = pathRibbon([[0, 1, 0], [0, 1, 1]]);
  assert.ok(y.some((v, i) => i % 3 === 1 && v > 1), 'lifted off the floor');
  const far = pathRibbon([[0, 0, 0], [20, 0, 0]]);
  assert.ok(far.some((v, i) => i % 3 === 0 && v > 8), 'the route keeps drawing past a couple of metres');
  const tall = pathRibbon([[0, 1, 0], [1, 1, 0]]);
  assert.ok(tall.length > 0 && tall.every((v, i) => i % 3 !== 1 || Math.abs(v - 1.15) < 0.001), 'a dash lies flat, with no upright');
  assert.equal(PING_MARK_MS, 5000);
  assert.equal(fadeAlpha(0, 0, 5000), 0);
  assert.equal(fadeAlpha(PING_IN_MS, 0, 5000), 1);
  assert.equal(fadeAlpha(2500, 0, 5000), 1);
  assert.ok(fadeAlpha(5000 - 150, 0, 5000) > 0.4 && fadeAlpha(5000 - 150, 0, 5000) < 0.7);
  assert.equal(fadeAlpha(5000, 0, 5000), 0);
  const floor = settleAim([0, 1.6, 0], [0, 0, 1], { dist: 4, normal: [0, 1, 0] }, null);
  assert.deepEqual(floor, [0, 1.6, 4]);
  const wall = settleAim([0, 1.6, 0], [0, 0, 1], { dist: 4, normal: [0, 0, -1] }, { dist: 1.6 });
  assert.ok(wall[2] < 3.4 && wall[2] > 2.5, 'a wall names the ground in front of it');
  assert.ok(Math.abs(wall[1]) < 0.001);
  const crosses = (a, b) => {
    if ((a[0] - 5) * (b[0] - 5) > 0) return false;
    const t = (5 - a[0]) / ((b[0] - a[0]) || 1e-9);
    if (t < 0 || t > 1) return false;
    return Math.abs(a[2] + (b[2] - a[2]) * t) < 1.2;
  };
  const open = groundRoute([0, 1, 0], [10, 1, 0], () => 1, () => true);
  assert.ok(open && open.every((p) => Math.abs(p[2]) < 0.01), 'open ground is a straight line');
  const around = groundRoute([0, 1, 0], [10, 1, 0], () => 1, (a, b) => !crosses(a, b));
  assert.ok(around && around.some((p) => Math.abs(p[2]) > 1.2), 'a wall is walked around, not through');
  const hill = (x, z) => (z > 4 && z < 12 ? 4 : 0);
  const near = pingGround([0, 2, 0], [0, -0.05, 1], hill, 80);
  assert.ok(near && near[2] > 3.5 && near[2] < 6 && near[1] > 1, 'a rise is met on the near face');
  const flat = pingGround([0, 3, 0], [0, -0.02, 1], () => 0, 512);
  assert.ok(flat && flat[2] > 40, 'open ground is named well past a few metres');
  const icon = { at: [0, 0, 8], mine: false };
  assert.equal(markUnderLook([0, 0, 0], [0, 0, 1], [icon]), icon);
  assert.equal(markUnderLook([0, 0, 0], [0, 0, 1], [{ at: [0, 0, 8], mine: true }]), null);
  assert.equal(pingDistanceText(3.14), '3.1 m');
  assert.equal(pingDistanceText(14.2), '14 m');
  const shelf = pingSubject([0, 1, 0], [0, 0, 1], {
    collider: { raycast: () => Infinity },
    look: { targets: [{ key: 'search:1', aabb: { min: [-1, 0, 3], max: [1, 2, 4] }, distance: 30, reach: 30 }], name: () => 'Sarcophagus' },
  });
  assert.equal(shelf?.name, 'Sarcophagus');
  const board = pingSubject([0, 1, 0], [0, 0, 1], {
    collider: { raycast: () => Infinity },
    look: { targets: [{ key: 'search:2', aabb: { min: [-1, 0, 3], max: [1, 2, 4] }, distance: 30, reach: 30 }], name: () => 'Shelf' },
  });
  assert.equal(board?.name, 'Shelf');
  const who = pingSubject([0, 1, 0], [0, 0, 1], {
    collider: { raycast: () => Infinity },
    crowd: [{ name: 'Mara', dist: 6 }, { name: 'Bran', dist: 9 }],
  });
  assert.equal(who?.name, 'Mara', 'the nearer person is the one named');
  const house = { aabb: { min: [-2, 0, 5], max: [2, 8, 9] } };
  const stopped = buildingStop([0, 2, 0], [0, 0, 1], { raycastHit: () => ({ dist: 6, key: '12,4' }) }, [house], 80);
  assert.ok(stopped && Math.abs(stopped.dist - 6) < 0.01, 'a building stops the look');
  assert.equal(buildingStop([0, 2, 0], [0, 0, 1], { raycastHit: () => ({ dist: 6, key: '12,4' }) }, [{ aabb: { min: [20, 0, 20], max: [22, 4, 22] } }], 80), null, 'a rock, which is not a building, does not');
});

test('PARTY-PING: a place key is the dungeon, the building or the open air', () => {
  assert.deepEqual(pingPlace('exterior', null, null), { k: 'w', space: 'world' });
  assert.deepEqual(pingPlace('exterior', null, { x: 10, y: 20 }), { k: 'w:10.20', space: 'world' });
  assert.deepEqual(pingPlace('dungeon', { kind: 'dungeon', mapId: 5, size: 'full' }, null), { k: 'd:5.full', space: 'dungeon' });
  assert.deepEqual(pingPlace('dungeon', { kind: 'gate', day: 3 }, null), { k: 'd:gate:3', space: 'dungeon' });
  assert.equal(pingPlace('dungeon', { kind: 'dungeon', mapId: NaN }, null), null);
  assert.deepEqual(
    pingPlace('interior', { kind: 'interior', buildingKey: 12, instance: { owner: 'acct', epoch: 4 } }, { x: 10, y: 20 }),
    { k: 'i:10.20.12:acct.4', space: 'interior' },
  );
});

/** A host over a look that hits `dist` metres out, in `place`. */
function pingHost({ place = { k: 'w', space: 'world' }, mesh = null, route = null, ground = null, clear = null, subject = null, buildings = null } = {}) {
  let now = 5000;
  let press = false;
  let blocked = false;
  let dist = 4;
  let feet = [0, 0, 0];
  const sounds = [];
  let routed = 0;
  const h = createPartyPingHost({
    now: () => now,
    pressed: () => { const p = press; press = false; return p; },
    blocked: () => blocked,
    mode: () => (place.space === 'dungeon' ? 'dungeon' : 'exterior'),
    place: () => place,
    collider: () => ({ raycastHit: () => (dist == null ? null : { dist }) }),
    feet: () => feet,
    toWire: (p) => ({ x: p[0], y: p[1], z: p[2] }),
    fromWire: (pg) => [pg.x, pg.y, pg.z],
    sound: () => sounds.push(now),
    navMesh: () => mesh,
    ground,
    clear,
    subject: () => subject,
    buildings: () => buildings,
    route: (chf, from, to) => { routed += 1; return route ? route(chf, from, to) : [[...from], [...to]]; },
  });
  return {
    h, sounds, get routed() { return routed; },
    tap() { press = true; },
    at(t) { now = t; },
    get now() { return now; },
    block(v) { blocked = v; },
    miss() { dist = null; },
    hit(d) { dist = d; },
    stand(p) { feet = p; },
  };
}

test('PARTY-PING: one press names a point, a second inside the cooldown does not, and a window or a miss names nothing', () => {
  const g = pingHost();
  g.tap();
  g.h.frame({ eye: [0, 2, 0], dir: [0, 0, 1] });
  assert.deepEqual(g.h.poseField().pg, { k: 'w', x: 0, y: 2, z: 4, at: 5000 });
  assert.equal(g.sounds.length, 1);
  assert.equal(g.h.unsent(), true);
  g.tap();
  g.h.frame({ eye: [1, 2, 0], dir: [0, 0, 1] });
  assert.equal(g.h.poseField().pg.at, 5000, 'the cooldown keeps the first point');
  assert.equal(g.sounds.length, 1);
  g.at(5000 + 400);
  g.block(true);
  g.tap();
  g.h.frame({ eye: [0, 2, 0], dir: [1, 0, 0] });
  assert.equal(g.h.poseField().pg.x, 0, 'a window eats the press');
  g.block(false);
  g.miss();
  g.tap();
  g.h.frame({ eye: [0, 2, 0], dir: [1, 0, 0] });
  assert.equal(g.sounds.length, 1, 'a look that hits nothing names nothing');
  g.hit(4);
  g.at(5800);
  g.tap();
  g.h.frame({ eye: [0, 2, 0], dir: [1, 0, 0] });
  assert.equal(g.h.poseField().pg.x, 4);
  g.at(5880);
  g.h.frame({ eye: [0, 2, 0], dir: [0, 0, 1] });
  assert.equal(g.h.points().length, 2, 'the old point fades as the new one comes in');
  g.at(5800 + PING_OUT_MS + 1);
  g.h.frame({ eye: [0, 2, 0], dir: [0, 0, 1] });
  assert.equal(g.h.points().length, 1, 'the old point is gone');
  g.at(5800 + PING_PATH_MS + 1);
  assert.deepEqual(g.h.poseField(), {});
  const named = pingHost({ subject: { name: 'Chest', elite: true, dist: 1.2, at: [1, 0, 3] } });
  named.tap();
  named.h.frame({ eye: [0, 2, 0], dir: [0, 0, 1] });
  assert.equal(named.h.poseField().pg.n, 'Chest');
  assert.equal(named.h.poseField().pg.e, 1);
  assert.equal(named.h.poseField().pg.z, 1.2, 'the mark stands where the look hit, not on the object\'s pivot');
});

test('PARTY-PING: a mate\'s point sounds once, and a point in another place is silent', () => {
  const g = pingHost();
  const pg = { k: 'w', x: 3, y: 1, z: 2, at: 4900 };
  g.h.hear('mate', { pg });
  g.h.hear('mate', { pg });
  assert.equal(g.sounds.length, 1);
  g.h.hear('mate', { pg: { ...pg, k: 'd:9.full', at: 4950 } });
  assert.equal(g.sounds.length, 1);
  g.at(4900 + PING_MARK_MS + 1);
  g.h.hear('mate', { pg: { ...pg, at: 4900 } });
  assert.equal(g.sounds.length, 1, 'the same stamp, even late, is the one ping');
});

test('PARTY-PING: a route is laid by following a mate, and lifting it leaves the mark', () => {
  const g = pingHost({ place: { k: 'd:1.full', space: 'dungeon' }, mesh: { baked: true } });
  g.tap();
  g.h.frame({ eye: [0, 2, 0], dir: [0, 0, 1] });
  assert.equal(g.routed, 0, 'my own point lays no route');
  g.h.hear('mate', { pg: { k: 'd:1.full', x: 0, y: 0, z: 6, at: g.now } });
  assert.equal(g.h.line(), false);
  g.at(g.now + 400);
  g.tap();
  g.h.frame({ eye: [0, 0, 0], dir: [0, 0, 1] });
  assert.equal(g.routed, 1, 'a look at their mark lays the route');
  assert.equal(g.h.line(), true);
  g.at(g.now + 10);
  g.h.frame({ eye: [0, 0, 0], dir: [0, 0, 1] });
  assert.equal(g.routed, 1, 'a step that has not moved does not ask again');
  g.stand([0, 0, 6]);
  g.h.frame({ eye: [0, 0, 6], dir: [0, 0, 1] });
  assert.equal(g.h.line(), false, 'standing on the point hides the route');
  g.stand([8, 0, 8]);
  g.at(g.now + 500);
  g.h.frame({ eye: [0, 0, 0], dir: [0, 0, 1] });
  assert.equal(g.routed, 2, 'walking off lays it again');
  assert.equal(g.h.line(), true);
  const alive = g.h.points().length;
  g.tap();
  g.h.frame({ eye: [0, 0, 0], dir: [0, 0, 1] });
  assert.equal(g.h.line(), false, 'another look lifts the route');
  assert.equal(g.h.points().length, alive, 'the mark stays for its life');
  const w = pingHost({ place: { k: 'w:3.4', space: 'world' }, ground: () => 0, clear: () => true });
  w.tap();
  w.h.frame({ eye: [0, 2, 0], dir: [0, -1, 3] });
  assert.equal(w.h.line(), false, 'my own point on open ground lays no route');
  assert.ok(w.h.poseField().pg && w.h.poseField().pg.z > 2, 'the point meets the ground, not the air');
  const front = pingHost({
    place: { k: 'w:3.4', space: 'world' }, ground: () => 0,
    buildings: [{ aabb: { min: [-4, 0, 3], max: [4, 8, 10] } }],
    subject: { name: 'Door', dist: 6 },
  });
  front.hit(5.6);
  front.tap();
  front.h.frame({ eye: [0, 2, 0], dir: [0, -0.02, 1] });
  assert.equal(front.h.poseField().pg.n, 'Door', 'a door in front of its building is named');
  assert.ok(front.h.poseField().pg.z < 12, 'the mark stands on the door, not the ground beyond the house');
  const folk = pingHost({ place: { k: 'w:3.4', space: 'world' }, ground: () => 0, subject: { name: 'Mara', dist: 7 } });
  folk.tap();
  folk.h.frame({ eye: [0, 2, 0], dir: [0, -0.02, 1] });
  assert.equal(folk.h.poseField().pg.n, 'Mara', 'a person under the look is named');
  w.h.hear('mate', { pg: { k: 'w:3.4', x: 0, y: 0, z: 8, at: w.now } });
  w.at(w.now + 400);
  w.tap();
  w.h.frame({ eye: [0, 0, 0], dir: [0, 0, 1] });
  assert.equal(w.h.line(), true, 'following a mate lays the route along the ground');
});

test('PARTY-PING: the pose keeps a point in its law and drops one that is not', () => {
  const P = { px: 100, py: 200, loc: 'Daggerfall', in: 1, h: 50, hm: 60, f: 1000, fm: 2000, m: 10, mm: 20, race: 'Nord', gender: 'male', face: 2 };
  const kept = validPartyPose({ ...P, pg: { k: 'd:5.full', x: 1.234, y: 2, z: 3, at: 10.2 } });
  assert.deepEqual(kept.pg, { k: 'd:5.full', x: 1.23, y: 2, z: 3, at: 10 });
  const named = validPartyPose({ ...P, pg: { k: 'd:5.full', x: 1, y: 2, z: 3, at: 10, n: 'Chest', e: 1 } });
  assert.equal(named.pg.n, 'Chest');
  assert.equal(named.pg.e, 1);
  assert.equal(validPartyPose({ ...P, pg: { k: 'd:5.full', x: 1, y: 2, z: 3, at: 10, n: '<b>', e: 2 } }).pg.n, undefined);
  assert.equal(validPartyPose({ ...P, pg: { k: 'd:5.full', x: 1, y: 2, z: 3, at: 10, e: 2 } }).pg.e, undefined);
  assert.equal(validPartyPose(P).pg, undefined);
  assert.equal(validPartyPose({ ...P, pg: { k: 'bad key', x: 0, y: 0, z: 0, at: 1 } }).pg, undefined);
  assert.equal(validPartyPose({ ...P, pg: { k: 'd:1', x: 1e12, y: 0, z: 0, at: 1 } }).pg, undefined);
  assert.equal(PING_MARK_MS < PING_PATH_MS, true);
});

test('PARTY-PING: a saved middle button that is still auto-run becomes the ping', () => {
  const stock = createBindings();
  setBinding(stock, 'Mouse2', 'AutoRun');
  assert.equal(adoptPartyPingKey(stock), true);
  assert.equal(getBinding(stock, 'PartyPing'), 'Mouse2');
  assert.equal(getBinding(stock, 'AutoRun'), 'F3');
  assert.equal(adoptPartyPingKey(stock), false);
  const moved = createBindings();
  setBinding(moved, 'Mouse2', 'SwingWeapon');
  assert.equal(adoptPartyPingKey(moved), false);
  assert.equal(getBinding(moved, 'SwingWeapon'), 'Mouse2');
  assert.equal(getBinding(moved, 'PartyPing'), null);
  const gone = createBindings();
  setBinding(gone, 'Mouse2', 'AutoRun');
  addRemovedPrimaryAction(gone, 'PartyPing');
  assert.equal(adoptPartyPingKey(gone), false);
  assert.equal(gone.primary.get('Mouse2'), 'AutoRun');
});

test('PARTY-PING: a ping skips the pose floor and still spends the party gate', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  const clock = { t: 1e6 };
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'peer-me', secret: 'secret-of-peer-me', WebSocketImpl: FakeWS, now: () => clock.t, acct: 'acct-me', asecret: 'secret-of-acct-me' });
  s.join(SOCIAL_ROOM);
  const ws = sockets[0];
  ws.open();
  ws.receive({ t: 'welcome', id: 'peer-me', peers: [], n: 1, v: RELAY_VERSION });
  const sent = () => ws.sent.map((x) => JSON.parse(x)).filter((m) => m.t === 'party');
  const P = { px: 100, py: 200, loc: 'Daggerfall', in: 0, h: 50, hm: 60, f: 1000, fm: 2000, m: 10, mm: 20, race: 'Nord', gender: 'male', face: 2 };
  const pg = { k: 'd:1.full', x: 1, y: 2, z: 3, at: 5 };
  assert.equal(s.sendParty(P), true);
  assert.equal(s.sendParty({ ...P, pg }, { urgent: true }), true, 'inside the floor, a ping still goes');
  assert.equal(sent().at(-1).p.pg.k, 'd:1.full');
  assert.equal(s.sendParty({ ...P, pg: { ...pg, at: 6 } }, { urgent: true }), false, 'the gate still holds the third');
  assert.equal(sent().length, PARTY_HZ_MAX);
  clock.t += PARTY_SEND_MS;
  assert.equal(s.sendParty({ ...P, pg: { ...pg, at: 7 } }, { urgent: true }), true, 'refilled');
});
