// BEAST-PEER (2026-09-26, Mac: "Wereform uses daggerfall paperdoll when others see you transform"): on another
// player's screen a peer in beast form stands as Eye Of The Beholder's lycanthrope (net/peerRiders.js) or, until that
// art is up, the beast's enemy sprite (DISC12) - and until THAT was built, the peer's HUMAN paperdoll. Both load at
// first sight, which is the moment of the change, so every transformation showed the person first. A beast is never
// the person now: no doll while its art loads, and the doll it wore as a person goes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RemotePlayers } from '../src/net/remotePlayers.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';

const P = { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 };
const LOOK = { race: 'Breton', gender: 'male', faceIndex: 0, class: 'Warrior', items: [] };
const pending = () => Object.assign(new Promise(() => {}), { mobileType: MOBILE_TYPES.Werewolf, gender: 'male' });

function rig() {
  const made = [], gone = [];
  const rp = new RemotePlayers({
    renderer: { createBillboardBatch: (a, r) => { const b = { a, r, origin: [0, 0, 0] }; made.push(b); return b; }, destroyBillboardBatch: (b) => gone.push(b) },
    deps: { fetchBytes: async () => null, palette: null, audio: null }, compose: async () => null,
  });
  const dolls = [];
  const realDoll = rp._syncDollPeer.bind(rp);
  rp._syncDollPeer = (peer, toScene) => { dolls.push(peer.id); return realDoll(peer, toScene); };
  return { rp, made, gone, dolls };
}
const peer = (id, wb, look = LOOK) => ({ id, name: id, look, shown: { ...P, ...(wb ? { wb } : {}) } });

test('BEAST-PEER: a beast whose art is still loading stands as nothing - never the person\'s paperdoll', () => {
  const { rp, dolls } = rig();
  rp._mobileFor = () => pending();
  rp.sync([peer('wolf', 1), peer('boar', 2)], (p) => [p.x, p.y, p.z], {});
  assert.deepEqual(dolls, [], 'no doll for a beast');
});

test('BEAST-PEER: the doll a peer wore as a person goes at the change', () => {
  const { rp, gone } = rig();
  rp._mobileFor = () => pending();
  const batch = { id: 'the-person', origin: [0, 0, 0] };
  rp._batches.set('wolf', { kind: 'doll', batch, key: 'k', doll: { h: 1.8 }, peer: peer('wolf', 0) });
  rp.sync([peer('wolf', 1)], (p) => [p.x, p.y, p.z], {});
  assert.deepEqual(gone, [batch], 'the person\'s billboard released');
  assert.equal(rp._batches.has('wolf'), false);
});

test('BEAST-PEER: a person is untouched - a peer with no sprite yet keeps the doll path; a beast with its sprite up stands as the beast', () => {
  const { rp, dolls } = rig();
  rp._mobileFor = () => null;   // no class sprite for the person (the card off, or a build without it)
  rp.sync([peer('man', 0)], (p) => [p.x, p.y, p.z], {});
  assert.deepEqual(dolls, ['man'], 'a person without a sprite is still their doll');
  const mobiles = [];
  const r2 = rig();
  r2.rp._mobileFor = (id, t) => ({ mobileType: t, gender: 'male', mobileUnit: {} });
  r2.rp._syncMobilePeer = (p) => mobiles.push(p.id);
  r2.rp.sync([peer('wolf', 1)], (p) => [p.x, p.y, p.z], {});
  assert.deepEqual(mobiles, ['wolf'], 'the beast\'s own sprite');
  assert.deepEqual(r2.dolls, []);
});
