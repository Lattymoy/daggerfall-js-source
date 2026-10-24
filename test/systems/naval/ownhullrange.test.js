// OWN-HULL-RANGE (2026-10-12, a player's live client travelling the overworld: 14 hulls of its own sea 9-727 km off -
// the peers' ships it adopted as they left, wherever they lay - and 90 -> 37 FPS while they stood; bible/07-Rendering/
// Performance-Priority.md OWN-HULL-RANGE) - MY OWN SEA'S SHIP FAR OFF STANDS NO HULL EITHER. PEER-HULL-RANGE's edges
// for a ship with no owner: none built past PEER_HULL_NEAR_M, given back past PEER_HULL_FAR_M, her record kept; an
// adopted peer's ship stays hull-less; and what reads a ship BY her hull keeps it wherever she is (hullKept): bodies
// on her deck, the boarding, a prize not yet settled, a fight - hers or one that targets her. The sea of
// test/navalSea.mjs, on foot on a speck of land at the eye (no director: its despawn is the water's).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sea } from '../../navalSea.mjs';
import { PEER_HULL_NEAR_M, PEER_HULL_FAR_M, hullKept } from '../../../src/scenes/naval/navalHost.js';
import { navalWireRecord } from '../../../src/systems/naval/navalWire.js';
import { SHIP_STATES } from '../../../src/systems/naval/navalDamage.js';

const said = (n, pos, seed) => navalWireRecord({ ships: [{ n, classId: 'merchantGalleon', variant: 0, pos, yaw: 0, speed: 0, sails: 1, hull: 1, sail: 1, crew: 1, state: 'afloat', heel: 0, seed, fire: false }] }).s[0];
const word = (...ships) => ({ s: ships, v: [], b: [] });
/** A sea whose one speck of land is under the stander's feet, wherever they stand. */
async function landed() {
  const at = { x: 0, z: 0 };
  const h = await sea({ hull: null, water: (x, z) => Math.hypot(x - at.x, z - at.z) > 30 });
  h.standAt = (x, z) => { at.x = x; at.z = z; h.view.feet = [x, 0, z]; h.view.look = { origin: [x, 5, z], dir: [1, -0.05, 0] }; };
  h.standAt(0, 0);
  return h;
}
const mine = (h, id) => h.host._sea.get(id);

test('OWN-HULL-RANGE: one of my own sea\'s ships stands her hull within PEER_HULL_NEAR_M of the eye and none 90 km off; the eye come near, built; gone past PEER_HULL_FAR_M, given back - her record mine still', async () => {
  const h = await landed();
  const nearId = h.host.spawnShip('merchantGalleon', { range: 1000, bearing: Math.PI / 2 });
  const farId = h.host.spawnShip('merchantGalleon', { range: 90000, bearing: Math.PI / 2 });
  h.run(1);
  const near = mine(h, nearId), far = mine(h, farId);
  assert.ok(near && far && !near.owner && !far.owner, 'both my own sea\'s');
  assert.ok(near.boat, 'the near one built');
  assert.equal(far.boat, null, 'the far one waits for the eye');
  assert.deepEqual(h.pool.seaBoats, [near.boat]);
  h.standAt(far.ship.pos[0] - (PEER_HULL_NEAR_M - 300), far.ship.pos[2]);
  h.run(1);
  assert.ok(far.boat, 'built as the eye comes within reach');
  assert.equal(near.boat, null, 'the first, now some 85 km off, given back');
  assert.ok(mine(h, nearId), 'her record stays');
  h.standAt(far.ship.pos[0] - PEER_HULL_FAR_M - 300, far.ship.pos[2]);
  h.run(1);
  assert.equal(far.boat, null, 'let go past PEER_HULL_FAR_M');
  assert.deepEqual(h.pool.seaBoats, []);
});

test('OWN-HULL-RANGE: a peer\'s ship 100 km off, adopted as they leave, is mine and still stands no hull', async () => {
  const h = await landed();
  h.host.applyWord('z', word(said(1, [100000, 0, 20000], 31)), (p) => p);
  h.run(1);
  assert.equal(h.host._sea.get('z:1')?.boat, null, 'PEER-HULL-RANGE: theirs, far, hull-less');
  h.host.sweepOwners(new Set());
  h.run(1);
  const ships = [...h.host._sea.values()];
  assert.equal(ships.length, 1, 'adopted, not let go');
  assert.ok(!ships[0].owner, 'mine now');
  assert.equal(ships[0].boat, null, 'and still no hull this far off');
  assert.deepEqual(h.pool.seaBoats, []);
});

test('OWN-HULL-RANGE hullKept: bodies on her deck, the boarding, a prize not settled, her fight and a fight that targets her keep a hull - nothing else', () => {
  const ship = (o = {}) => ({ id: 'a', ship: { damage: { state: SHIP_STATES.afloat }, mode: 'cruise', ...o } });
  const none = { fought: new Set() };
  assert.equal(hullKept(ship(), none), false, 'a ship going about her business');
  assert.equal(hullKept({ ...ship(), deck: [{}] }, none), true, 'bodies on her deck');
  assert.equal(hullKept({ ...ship(), deck: [] }, none), false, 'an empty deck');
  assert.equal(hullKept(ship(), { fought: new Set(), boardingId: 'a' }), true, 'the boarding I am in');
  assert.equal(hullKept(ship(), { fought: new Set(), boardingId: 'b' }), false, 'another\'s boarding');
  assert.equal(hullKept({ ...ship(), prize: { fate: null } }, none), true, 'a prize not yet settled');
  assert.equal(hullKept({ ...ship(), prize: { fate: 'scuttled' } }, none), false, 'a prize settled');
  assert.equal(hullKept(ship({ mode: 'engage' }), none), true, 'engaging');
  assert.equal(hullKept(ship({ mode: 'board' }), none), true, 'boarding another');
  assert.equal(hullKept(ship({ mode: 'engage', damage: { state: SHIP_STATES.struck } }), none), false, 'struck, her fight is over');
  assert.equal(hullKept(ship(), { fought: new Set(['a']) }), true, 'a fight that targets her');
});

test('OWN-HULL-RANGE: a far ship of mine kept by hullKept is built and never given back; a peer\'s far ship is not kept by it', async () => {
  const h = await landed();
  const id = h.host.spawnShip('merchantGalleon', { range: 90000, bearing: Math.PI / 2 });
  const e = mine(h, id);
  e.prize = { fate: null };
  h.run(1);
  assert.ok(e.boat, 'a prize not yet settled stands her hull 90 km off');
  const near = mine(h, h.host.spawnShip('merchantGalleon', { range: 1000, bearing: Math.PI / 2 }));
  h.run(1);
  assert.ok(near.boat);
  near.prize = { fate: null };
  h.standAt(0, 60000);
  h.run(1);
  assert.ok(near.boat, 'and keeps it as the eye goes');
  h.host.applyWord('z', word(said(1, [100000, 0, 20000], 31)), (p) => p);
  h.host._sea.get('z:1').prize = { fate: null };
  h.run(1);
  assert.equal(h.host._sea.get('z:1').boat, null, 'PEER-HULL-RANGE unchanged: a peer\'s stays hull-less');
});
