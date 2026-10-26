// FERRY-CLEAR (2026-10-24, Discord - "Ferrys still unstable": "Had several issues with the ferry ramming a neighbour ship
// till it broke, or running ashore") - THE NAVAL HOST'S HALF: the sea's ships afloat are what the journey's hand steers
// round (a booked ship's master never rammed either - her stem in a neighbour's side broke one or the other, the passenger
// charged with piracy for it - and since BOARD-MAGNET no stem rams at all: boardmagnet.test.js) (the host's `hullAlong`, over systems/naval/seaClearance.js). The hand's own half, lifted
// from world.js over Come Sail Away's real runtime, is test/systems/auditships_sail.test.js FERRY-CLEAR. The law is
// bible/03-World/Passage.md FERRY-CLEAR.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HULL } from '../../../src/systems/naval/navalShips.js';
import { hullBoxOf } from '../../../src/scenes/naval/navalHost.js';
import { HULL_CLEAR_M, HULL_LEAD_S, createSeaHulls } from '../../../src/systems/naval/seaClearance.js';
import { SHIP_STATES } from '../../../src/systems/naval/navalDamage.js';
import { segmentBoxEntry } from '../../../src/systems/naval/navalBallistics.js';
import { sea } from '../../navalSea.mjs';

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} vs ${b} (±${eps})`);
async function helm(o = {}) {
  const h = await sea({ hull: HULL.SmallShip, ...o, settings: { ShipsAtSea: 'off', Boarders: false, ...(o.settings ?? {}) } });
  const e = h.host._sea.get(h.host.spawnShip('merchantGalleon', { range: 900 }));
  return { ...h, e };
}
function frames(h, held, n = 1) {
  for (let i = 0; i < n; i++) {
    for (const [e, p] of held) { e.ship.pos = [...p.pos]; e.ship.yaw = p.yaw ?? 0; e.ship.speed = p.speed ?? 0; e.ship.yawRate = 0; }
    h.host.frame(0.1);
  }
}

test('FERRY-CLEAR the host hands the journey\'s hand the sea\'s ships afloat: along her bow a ship ahead stops its look HULL_CLEAR_M off her near side, and a look past her goes on (mutants: the sea unhanded)', async () => {
  const h = await helm();
  frames(h, [[h.e, { pos: [0, 0, 120], yaw: Math.PI / 2 }]]);
  const b = hullBoxOf(h.e.boat, h.pool.models);
  const entry = segmentBoxEntry([0, b.c[1], 0], [0, b.c[1], 300], b, HULL_CLEAR_M);
  assert.ok(entry && entry.t > 0, 'her clearance across the bow\'s look');
  near(h.host.hullAlong([0, 0, 0], 0, 1, 300), entry.t * 300, 1e-6, 'HULL_CLEAR_M off her near side');
  assert.equal(h.host.hullAlong([0, 0, 0], 1, 0, 300), Infinity, 'a look past her');
});

test('AUDIT FERRY-CLEAR F3/F4 the hulls about her (seaClearance.js createSeaHulls): the sea\'s ships afloat, the peers\' boats and my own other boats - a sunk ship none, the boat at my helm never; the hand\'s `along` looks for a ship under way where her way carries her, the aim camera\'s `boxes` are the hulls as they stand; nothing while the arc is off (mutants: peers unseen; my boats unseen; the helm\'s own seen; the camera led)', () => {
  const box = (x, z) => ({ c: [x, 0, z], ax: [1, 0, 0], ay: [0, 1, 0], az: [0, 0, 1], h: [5, 5, 10] });
  const B = { afloat: box(0, 100), sunk: box(0, 60), peer: box(-150, 300), mine: box(0, 0), docked: box(40, 0) };
  const ship = (state) => ({ damage: { state } });
  let on = true;
  const hulls = createSeaHulls({
    sea: new Map([[1, { boat: 'afloat', ship: ship(SHIP_STATES.afloat) }], [2, { boat: 'sunk', ship: ship(SHIP_STATES.sunk) }], [3, { boat: null, ship: ship(SHIP_STATES.afloat) }]]),
    hullBox: (b) => B[b] ?? null, velocity: () => [0, 0, 0],
    peerBoats: () => [{ boat: 'peer', vel: [25, 0, 0] }, null], myBoats: () => ['mine', 'docked'], myBoat: () => 'mine', enabled: () => on,
  });
  assert.deepEqual(hulls.boxes(), [B.afloat, B.peer, B.docked], 'afloat, the peer\'s and my docked one - as they stand');
  near(hulls.along([0, 0, 0], 0, 1, 300), 90 - HULL_CLEAR_M, 1e-9, 'the sea\'s ship ahead; never my own helm\'s');
  near(hulls.along([40, 0, -50], 0, 1, 300), 40 - HULL_CLEAR_M, 1e-9, 'my boat at the next berth');
  // the peer at x -150 making 25 m/s east: where she stands is off the look up x 0, where her way carries her is not
  assert.ok(25 * HULL_LEAD_S >= 150, 'the stand-in crosses the look inside the lead');
  near(hulls.along([0, 0, 200], 0, 1, 300), 90 - HULL_CLEAR_M, 1e-9, 'the peer under way, looked for along her way');
  on = false;
  assert.deepEqual([hulls.boxes(), hulls.along([0, 0, 0], 0, 1, 300)], [[], Infinity], 'the arc off');
});
