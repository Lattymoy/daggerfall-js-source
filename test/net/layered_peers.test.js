// LAYERED-PEERS (2026-10-19, the owner, playing LAYERED-GEAR: "when layered skins are on you only see it on your char
// and players who also choosen the option. Normaly once you picked it you should see all other players too in their
// layered gear").
//
// The walker layer (net/peer/peerRiders.js createPeerWalkers) drew a peer in the armor they wear only when their own
// look carried `lg`, so a player in Layered Gearing saw it on themselves and on the few who had chosen it too - and on
// nobody while the relay that drops `lg` stood. Now THIS player's choice decides: while they wear Layered Gearing
// (viewerLayered - Eye of the Beholder on and Graphics.LayeredGear a body, the default included), every other player on
// foot is a walker in the armor their look's items say they wear, in the body they chose (`lg`) else their
// character's own (the look's `gender`), whatever they chose themselves. A Skins viewer sees what they always saw.
// Riders, beasts, the dying and a Morrowind body on this screen are no walkers either way.
// Pinned through the real walker layer over a fake renderer, as DISC23-B's pins drive it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPeerWalkers, createEotbArt, viewerLayered } from '../../src/net/peer/peerRiders.js';
import { setModSetting, _resetModSettings } from '../../src/systems/modSettings.js';
import { LAYERED_ARCHIVE } from '../../src/player/eyeOfTheBeholder/layeredArmor.js';
import { ARCHIVE_FOOT } from '../../src/player/eyeOfTheBeholder/eotbBillboard.js';

const V = 'eye-of-the-beholder';

function rig() {
  const renderer = {
    uploadTexture() {},
    createBillboardBatch: (archive, record, size) => ({ archive, record, size, origin: null }),
    destroyBillboardBatch() {},
  };
  return createEotbArt({ renderer, urlFor: (k) => `u:${k}`, decode: async () => ({ width: 50, height: 110, colors: new Uint32Array(50 * 110) }) });
}
const settle = () => new Promise((r) => setTimeout(r, 5));
const toScene = (p) => [p.x, p.y, p.z];
const pose = (o = {}) => ({ x: 4, y: 0, z: 9, yaw: 0, pitch: 0, mv: 0, wd: 0, an: 0, sr: 0, cn: 0, ar: 0, ...o });
const plate = [{ templateIndex: 102, group: 'Armor', material: 0x0201, equipSlot: 18 }];   // a plate cuirass on the chest (layeredArmor.js OUTFIT_SLOTS.top)
/** The others: a Skins player in a chosen set, one who never chose anything, a woman in leather and one who chose
 *  the female body for a male character. */
const others = () => [
  { id: 'set', look: { gender: 'male', eo: 7, items: [] }, shown: pose() },
  { id: 'none', look: { gender: 'female', items: [] }, shown: pose({ x: 6 }) },
  { id: 'chose', look: { gender: 'male', lg: 1, items: plate }, shown: pose({ x: 8 }) },
];
/** Two frames - the art lands between - and what each walker is drawn as. */
async function drawn(w, peers, opts = {}) {
  w.sync(peers, toScene, { eye: [4, 1, 20], dt: 0.01, ...opts });
  await settle();
  w.sync(peers, toScene, { eye: [4, 1, 20], dt: 0.01, ...opts });
  return Object.fromEntries(peers.map((p) => [p.id, w.isWalking(p.id) ? w.walkers.get(p.id).batch?.archive ?? null : 'not a walker']));
}

test('LAYERED-PEERS: a viewer in Layered Gearing sees EVERY other player on foot in their armor - the Skins player in their set, the one who chose nothing, in their character\'s own body; the one who chose a body, in that body (mutants: LAYERED-PEERS-viewer-unread, LAYERED-PEERS-own-body)', async () => {
  const w = createPeerWalkers({ art: rig(), layeredAll: () => true });
  assert.deepEqual(await drawn(w, others()), { set: LAYERED_ARCHIVE.male, none: LAYERED_ARCHIVE.female, chose: LAYERED_ARCHIVE.female });
  // in what their look says they wear: leather where nothing is worn, the chest plate where it is
  assert.match(w.walkers.get('none').batch.record, /^lll_/, 'nothing worn: plain leather');
  assert.match(w.walkers.get('chose').batch.record, /^lp[0-6]l_/, 'the plate cuirass their items carry, on the chest');
});

test('LAYERED-PEERS: a Skins viewer sees what they always saw - a set as the set, a look with no set and no `lg` no walker, a chosen `lg` still in armor', async () => {
  const w = createPeerWalkers({ art: rig(), layeredAll: () => false });
  assert.deepEqual(await drawn(w, others()), { set: ARCHIVE_FOOT + 7, none: 'not a walker', chose: LAYERED_ARCHIVE.female });
});

test('LAYERED-PEERS: under Layered Gearing still no walker in the saddle, as a beast, dying, or where a Morrowind body stands them', async () => {
  const w = createPeerWalkers({ art: rig(), layeredAll: () => true });
  const peers = [
    { id: 'rider', look: { gender: 'male', items: [] }, shown: pose({ rd: 1 }) },
    { id: 'beast', look: { gender: 'male', items: [] }, shown: pose({ wb: 1 }) },
    { id: 'dying', look: { gender: 'male', items: [] }, shown: pose({ dd: 1 }) },
    { id: 'mw', look: { gender: 'male', items: [] }, shown: pose() },
  ];
  assert.deepEqual(await drawn(w, peers, { skip: (id) => id === 'mw' }), { rider: 'not a walker', beast: 'not a walker', dying: 'not a walker', mw: 'not a walker' });
});

test('LAYERED-PEERS: the viewer\'s choice is the setting, read each frame - on by default, off on Skins or with Eye of the Beholder off; the live layer follows it (mutants: LAYERED-PEERS-setting-unread)', async () => {
  _resetModSettings();
  try {
    assert.equal(viewerLayered(), true, 'the default: the character\'s own body');
    for (const v of [1, 2]) { setModSetting(V, 'Graphics.LayeredGear', v); assert.equal(viewerLayered(), true); }
    setModSetting(V, 'Graphics.LayeredGear', 0);
    assert.equal(viewerLayered(), false, 'Skins');
    setModSetting(V, 'Graphics.LayeredGear', 3);
    setModSetting(V, 'Enabled', false);
    assert.equal(viewerLayered(), false, 'no sprite body at all');
    setModSetting(V, 'Enabled', true);
    // the layer as the world makes it - no override: it reads the setting
    const w = createPeerWalkers({ art: rig() });
    const one = [{ id: 'set', look: { gender: 'male', eo: 7, items: [] }, shown: pose() }];
    assert.deepEqual(await drawn(w, one), { set: LAYERED_ARCHIVE.male });
    setModSetting(V, 'Graphics.LayeredGear', 0);
    assert.deepEqual(await drawn(w, one), { set: ARCHIVE_FOOT + 7 }, 'Skins chosen: the next frame draws their set');
  } finally { _resetModSettings(); }
});
