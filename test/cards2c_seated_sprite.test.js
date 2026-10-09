// CARDS2c (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 32; section 12's open item: "Eye Of The Beholder has
// no sitting art, so a sprite body - mine in that lane, a peer's walker or paperdoll - stands at its seat facing the
// table"): THE SPRITE LANE SEATED (net/remotePlayers.js seatedSink). Driven: a pose that says a seat (`st`, CARDS2b's
// table top) sinks its sprite by the seat's own hip drop - the Morrowind body's (player/seatPose.js SEAT_HIP_DROP), so
// the sprite's head stands where the seated rig's eye does - and a standing pose not at all; the paperdoll's billboard
// drawn sunk on a fake renderer, its name brought down with it; the class sprite's path the same; my own sprite needs
// none (seated, my view is the seat's own, first person - CARDS2b).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RemotePlayers, seatedSink, lookKey } from '../src/net/remotePlayers.js';
import { SEAT_HIP_DROP, SEATED_EYE_HEIGHT } from '../src/player/seatPose.js';
import { EYE_HEIGHT } from '../src/player/motor.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('CARDS2c a seated pose sinks its sprite by the seat\'s own drop; a standing one not at all (mutants: the drop; the seat read)', () => {
  assert.equal(seatedSink({ st: 16 }), SEAT_HIP_DROP);
  assert.equal(SEAT_HIP_DROP, 0.48);
  assert.ok(Math.abs(EYE_HEIGHT - seatedSink({ st: 16 }) - SEATED_EYE_HEIGHT) < 1e-9, 'a sprite\'s head comes down to the seated eye, as the rig\'s does');
  for (const shown of [{}, { st: 0 }, { st: undefined }, { st: 'x' }, null]) assert.equal(seatedSink(shown), 0, JSON.stringify(shown));
});

test('CARDS2c the paperdoll\'s billboard drawn sunk at its seat on a fake renderer, its name brought down with it; up again standing (mutants: the origin; the name\'s height)', () => {
  const made = [];
  const renderer = { createBillboardBatch: (archive, rec, size, at) => { const b = { archive, rec, size, at }; made.push(b); return b; }, destroyBillboardBatch() {} };
  const rp = new RemotePlayers({ renderer, deps: { fetchBytes: async () => null, palette: null }, compose: async () => null });
  const look = { race: 'Breton', gender: 'female', faceIndex: 1, items: [] };
  rp._dolls.set(lookKey(look), { rec: 'doll#0', w: 0.8, h: 1.9 });
  const peer = { id: 'p1', look, shown: { x: 2, y: 0, z: 3, st: 16 } };
  rp._shown = [];
  rp._syncDollPeer(peer, (p) => [p.x, p.y, p.z]);
  assert.equal(made.length, 1);
  assert.deepEqual(made[0].origin.map((v) => +v.toFixed(6)), [2, -SEAT_HIP_DROP, 3], 'sunk by the drop');
  assert.ok(Math.abs(rp._shown[0].height - (1.9 - SEAT_HIP_DROP)) < 1e-9, 'the name over the sunk head');
  peer.shown = { x: 2, y: 0, z: 3 };
  rp._shown = [];
  rp._syncDollPeer(peer, (p) => [p.x, p.y, p.z]);
  assert.deepEqual(made[0].origin, [2, 0, 3], 'stood up: on its feet again');
  assert.equal(rp._shown[0].height, 1.9);
});

test('CARDS2c the class sprite\'s path sinks the same; the record says why a sprite sinks rather than sits', () => {
  const src = read('src/net/remotePlayers.js');
  const mobile = src.slice(src.indexOf('  _syncMobilePeer('), src.indexOf('  /** OW-PEERS: the Overworld\'s grow at a peer\'s feet'));
  assert.ok(mobile.includes('const sink = seatedSink(shown);'));
  assert.ok(mobile.includes('entry.batch.origin[1] = f[1] - sink;'));
  assert.ok(mobile.includes('this._shown.push({ peer, height: entry.height - sink });'));
  assert.match(src, /A sprite cannot bend; it SINKS/);
});
