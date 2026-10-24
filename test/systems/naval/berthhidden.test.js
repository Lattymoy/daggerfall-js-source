// BERTH-HIDDEN (2026-10-04 - found chasing Mac's "The classic style ship is broken. its two ships clipped inside of
// eachother", which was the sailing cabin's: test/systems/comeSailAway/fb1003b_cabinhull.test.js) - a ship made fast at a port's quay, out of sight,
// read as a free berth. Come Sail Away hides a boat more than a map pixel off
// and every one while the player is indoors (comeSailAway.js UpdateBoatVisibility), and the berths asked only the boats
// it shows: from HARBOUR_STAND (1,200 m off the mouth - two pixels from her, coming in) the port's roll moored its own
// ship at her berth, and as the player came within a pixel she stood again inside it. A berth asks of every boat of
// mine placed outdoors, shown or not (scenes/naval/navalHost.js berthBoats), and of another player's boat hidden under its
// owner at its helm. bible/03-World/Holdings.md section 7.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findHarbour, alongside } from '../../../src/systems/naval/shipLife.js';
import { quatOfYaw } from '../../../src/systems/naval/navalAI.js';
import { Boat } from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { sea } from '../../navalSea.mjs';

/** quays.test.js's coast and town: land north of z = 200, a headland x 300-400 reaching south to z = -300. */
const coast = (x, z) => !(z > 200 || (x > 300 && x < 400 && z > -300));
const TOWN = { minX: -100, maxX: 100, minZ: 220, maxZ: 420 };

/** The sea with the port's harbour sounded and its roll not yet stood (the player past HARBOUR_STAND). */
async function portSea(o = {}) {
  const h = await sea({ hull: 2, water: coast, settings: { ShipsAtSea: 'off' }, ...o });
  h.deps.harbourNear = () => ({ key: 'port:1', name: 'Sentinel', rect: TOWN });
  h.boat.GameObject.position = [5000, 0, 5000];
  h.view.feet = [5000, 0, 5000];
  h.run(0.2);
  const hb = h.host.harbourList();
  assert.equal(hb.length, 1, 'the harbour found');
  return { ...h, harbour: hb[0].harbour };
}
/** `boat` made fast at berth `i` - alongside its quay for her hull, her bow along it, still. */
function makeFast(h, boat, i) {
  const b = h.harbour.berths[i], at = alongside(b, boat.hull, h.harbour.hull);
  boat.GameObject.position = [at[0], 0, at[1]];
  boat.GameObject.rotation = quatOfYaw(b.yaw);
  return b;
}
/** The port's own ships moored, by berth. */
const mooredAt = (h) => [...h.host._sea.values()].filter((e) => e.ship.errand?.kind === 'moored').map((e) => e.ship.errand.berth);
/** The player comes in to the port: within HARBOUR_STAND of its mouth, ashore. */
const comeIn = (h) => { h.view.feet = [0, 0, 150]; h.run(1); };

test('BERTH-HIDDEN the harbour roll: my ship made fast at a berth and out of sight (Come Sail Away hides her - a pixel off, or the player indoors) - the port moors none of its own into her; the roll stands at the other berths all the same; shown, the same', async () => {
  assert.ok(findHarbour({ rect: TOWN, isWater: coast }).berths.length >= 2, 'a harbour of several berths');
  for (const shown of [false, true]) {
    const h = await portSea();
    makeFast(h, h.boat, 0);
    h.runtime.sailing = false;
    h.boat.GameObject.setActive(shown);
    comeIn(h);
    const at = mooredAt(h);
    assert.ok(at.length >= 1, `the roll stood (${shown ? 'shown' : 'hidden'})`);
    assert.ok(!at.includes(0), `none moored into her (${shown ? 'shown' : 'hidden'}): ${at}`);
  }
});

test('BERTH-HIDDEN Summon and the helm: a berth my hidden ship lies at is none for the Fleet\'s Summon (freeBerth) and none to dock another of mine at (the warp\'s berths) - she is there, seen or not', async () => {
  const h = await portSea();
  const other = h.pool.spawnNow(Object.assign(new Boat(1, 0), { uid: 43 }), { position: [0, 0, 0], rotation: [0, 0, 0, 1] });
  h.runtime.state.AllBoats.push(other);
  const b0 = makeFast(h, other, 0);
  other.GameObject.setActive(false);
  h.view.feet = [b0.pos[0], 0, b0.pos[1] + 30];   // ashore by her berth: the nearest
  const fb = h.host.freeBerth(2);
  assert.ok(fb, 'a free berth');
  assert.ok(Math.hypot(fb.position[0] - b0.pos[0], fb.position[2] - b0.pos[1]) > 18, 'not hers');
  // my Small Ship at the helm, sails struck and slow, laid along her berth: no warp in
  makeFast(h, h.boat, 0);
  h.runtime.sailing = true;
  assert.equal(h.host.warp(h.boat, { struck: true, oars: false, dt: 0.1 }), null, 'no warp into her');
});

test('BERTH-HIDDEN what takes no berth: a boat of mine placed in a dungeon\'s water (`inside` - its own place, whatever its numbers) - the roll moors at its berth\'s numbers; another player\'s boat hidden under its owner at its helm (comeSailAwayPeers.js O4) takes it, as one shown does', async () => {
  const h = await portSea();
  makeFast(h, h.boat, 0);
  h.runtime.sailing = false;
  h.boat.GameObject.setActive(false);
  h.boat.inside = true;
  comeIn(h);
  assert.ok(mooredAt(h).includes(0), 'a dungeon\'s boat takes no berth up here');
  const p = await portSea();
  p.boat.GameObject.position = [5000, 0, 5000];
  const peer = p.pool.spawnPeerNow(new Boat(2, 0));
  makeFast(p, peer, 0);
  peer.GameObject.setActive(false);
  comeIn(p);
  assert.ok(!mooredAt(p).includes(0), 'none moored into the hidden owner\'s boat');
});
