import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sea } from '../../navalSea.mjs';
import { scene, terrain } from '../../csaScene.mjs';
import { Boat } from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { hullBuild } from '../../../src/systems/naval/navalShips.js';

async function boarded({ peer = true } = {}) {
  const h = await sea({ hull: null });
  const sc = scene({ terrains: [terrain(10, 20), terrain(11, 20)] });
  sc.deps.pool = h.pool;
  h.deps.csa = () => sc.rt;
  const pack = [];
  Object.assign(h.deps.board, {
    mintUid: () => 9001, packDeed: (it) => { pack.push(it); return () => pack; },
    terrainAt: () => sc.terrains[1],
    takeHelm: (b) => { h.log.helm.push(b); sc.rt.StartSailing(b); },
  });
  const origin = peer ? h.pool.spawnPeerNow(Object.assign(new Boat(2, 0), { uid: 777 })) : null;
  h.deps.aboardPeer = () => origin;
  const e = h.host._sea.get(h.host.spawnShip('pirateBrig', { range: 10, bearing: Math.PI / 2, yaw: 0 }));
  h.host.frame(.1);
  e.ship.damage.apply({ hull: Math.ceil(e.ship.damage.maxHull * .8), sail: 0, crew: 0 });
  h.host.frame(.1);
  const feet = [e.ship.pos[0] + hullBuild(e.ship.hull).beam + 1, 0, e.ship.pos[2]];
  h.view.feet = feet;
  h.view.look = { origin: [feet[0], 1.7, feet[2]], dir: [-1, 0, 0] };
  assert.equal(h.host.activate(), true);
  h.deps.aboardPeer = () => null; // Now fighting on the prize, no longer on the origin deck.
  h.run(.3);
  for (const f of h.log.foes.filter((f) => f.side === 'enemy')) f.dead = true;
  h.run(.3);
  const model = h.log.plunder.at(-1);
  assert.ok(model);
  h.log.placed.length = 0;
  h.log.helm.length = 0;
  return { ...h, origin, model, entry: e, rt: sc.rt };
}
for (const fate of ['scuttle', 'adrift', 'claim', 'leave']) test(`naval passenger ${fate}: surviving peer origin receives player without granting helm`, async () => {
  const h = await boarded();
  const destinations = [];
  h.deps.board.deckSpots = (boat) => { destinations.push(boat); return [[[3, 5, 2], .4]]; };
  if (fate === 'leave') h.model.leave(); else assert.equal(h.model.fate(fate), true);
  assert.ok(destinations.at(-1) === h.origin, 'returned to original peer deck');
  assert.deepEqual(h.log.placed, [[[3, 5, 2], .4]]);
  assert.equal(h.log.helm.length, 0);
  if (fate === 'claim') assert.equal(h.rt.AllBoats.length, 1);
});
for (const missing of ['no origin', 'removed peer', 'inactive peer', 'no landing']) for (const fate of ['scuttle', 'adrift']) test(`naval ${fate} refuses safely with ${missing}`, async () => {
  const h = await boarded({ peer: missing !== 'no origin' });
  if (missing === 'removed peer') h.pool.remove(h.origin);
  if (missing === 'inactive peer') h.origin.GameObject.activeSelf = false;
  if (missing === 'no landing') h.deps.board.deckSpots = () => [];
  assert.equal(h.model.fate(fate), false);
  assert.equal(h.model.fated(), null);
  assert.equal(h.entry.ship.damage.state, 'prize');
  assert.equal(h.entry.ship.adrift, false);
  assert.equal(h.log.placed.length, 0);
  assert.equal(h.log.helm.length, 0);
});
test('naval on-foot claim returns onto the new owned boat before continuing', async () => {
  const h = await boarded({ peer: false });
  assert.equal(h.model.fate('claim'), true);
  const owned = h.rt.AllBoats[0];
  assert.ok(owned?.GameObject.activeSelf);
  assert.equal(h.host._sea.has(h.entry.id), false);
  assert.equal(h.log.placed.length, 1);
  assert.equal(h.log.helm.length, 1);
  assert.ok(h.log.helm[0] === owned);
  assert.equal(h.rt.state.CurrentBoat, owned);
});
