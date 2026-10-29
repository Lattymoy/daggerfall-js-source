// AUDIT-STOREFRONT II, lane C (2026-10-29): a concealed rider's mount look. The peers' effects player threw a riding
// peer's beat whatever the draw made of them - at an empty saddle on the classic lane, lit over a translucent rider on
// the enhanced one. The host now says, with each peer, whether its draw conceals them, and a concealed rider's horse
// throws nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createPeerFxPlayer } from '../../src/net/peer/peerFx.js';
import { setPlayerDoor } from '../../src/systems/playerDoor.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('AUDIT-STOREFRONT II C1 a concealed rider\'s mount look: no beat while the draw conceals them, hidden or translucent, and its beat again once seen; the host says so with each peer, both kinds (mutants: the veil unread; the host\'s word never given; the translucent left out)', () => {
  let t = 0;
  const beats = [];
  setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], hurtFoe() {}, castOnPlayer() {}, burst: (recipe, at) => { beats.push({ recipe, x: at[0] }); return true; } });
  const fx = createPeerFxPlayer({ toScene: (p) => [p.x, p.y, p.z], now: () => t });
  const ride = { x: 0, y: 0, z: 0, rd: 1, mv: 2, yaw: 0 };
  let hid = true;
  const gallop = (n) => {
    for (let i = 0; i < n; i++) { fx.update('open', ride, [0, 0, 0], 1.8, '00a', false); fx.update('hid', ride, [5, 0, 0], 1.8, '00a', hid); fx.frame(); t += 0.05; }
  };
  gallop(40);
  assert.ok(beats.filter((b) => b.x === 0).length >= 8, 'the rider seen: its beat');
  assert.deepEqual(beats.filter((b) => b.x === 5), [], 'the concealed rider: none');
  hid = false;
  beats.length = 0;
  gallop(40);
  assert.ok(beats.some((b) => b.x === 5 && b.recipe === 'mount-warhorse'), 'seen again: its beat');
  hid = true;
  beats.length = 0;
  gallop(40);
  assert.deepEqual(beats.filter((b) => b.x === 5), [], 'concealed mid-ride: none from that frame');
  setPlayerDoor(null);
  assert.match(rd('src/scenes/world.js'), /peerFxPlayer\.update\(p\.id, p\.shown, onlineToScene\(p\.shown\), peerBodies\?\.heightOf\?\.\(p\.id\) \|\| 0, p\.fx \?\? null, _hiddenPeers\.has\(p\.id\) \|\| _veils\.has\(p\.id\)\);/,
    'the host\'s concealment: the classic lane\'s hidden and the enhanced lane\'s translucent, as the draw decided it');
});
