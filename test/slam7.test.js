// SLAM7 (2026-09-16, AUDIT SLAM, before Mac's 30th-anniversary server slam): THE PAPERDOLL CACHE EVICTED THE SCENE.
//
// `_evict` kept DOLLS_MAX (64) READY dolls and released the rest. It counted every ready doll - including the ones
// billboards were standing in at that moment - and `_release` destroys the batches wearing a released look. So past
// 64 distinct looks in view, every sweep tore down a peer that was ON SCREEN, which the next frame composed again,
// which swept another. A paperdoll composite is not cheap and they are serialized on one queue.
//
// MEASURED over 40 frames, one sync a frame, with the compose queue draining between frames as it really does:
//
//     looks in view    composes (ideal)    billboards destroyed    peers drawn
//     64               64   (64)           0                       64   - at the cap, perfect
//     70               304  (70)           234                     64   - one past it, and it is already 4x
//     128              2624 (128)          2496                    64
//     199              5464 (199)          2496                    64   - a DIFFERENT 64 each frame: the crowd flickered
//
// SLAM6 is what makes this Sunday's problem rather than a footnote: until this week the pose fan reached at most 32
// listeners, so a client held at most 32 looks and never came near the cap. The fan now reaches the whole room.
//
// TWO ROOTS, AND THE SECOND ONE IS THE EXPENSIVE ONE.
//
//   1. The order was FIFO BY BIRTH, not by use: `_dolls.set(key, doll)` on a key already in the Map does not move
//      it, so "the oldest" meant the first look ever composed, however long it had been on screen since.
//   2. The count included dolls THE SCENE NEEDED. A cache may evict what nobody is using; evicting what is on
//      screen is not eviction, it is a guaranteed recompose. Worn dolls are the scene, not the cache - and so are
//      the ones the last sync asked for and has not been handed yet, because a doll composes BETWEEN two frames
//      and is worn by nothing for exactly that gap.
//
// The cap now counts only what the scene does not need, so the map is bounded by DOLLS_MAX + the peers drawn - and
// the peers drawn are bounded by the room. Measured after: one compose per distinct look at every size, no
// billboard destroyed, every peer drawn; and under churn (a brand-new look every frame for 400 frames, 8000 looks
// seen) it holds exactly DOLLS_MAX + in-view and releases all 7,916 of the rest.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RemotePlayers, DOLLS_MAX, lookKey } from '../src/net/remotePlayers.js';

const look = (i) => ({ race: 'Nord', gender: 'male', faceIndex: 0, items: [{ templateIndex: i, group: 'Armor', equipSlot: 1 }] });
const peers = (n, from = 0) => Array.from({ length: n }, (_, k) => ({ id: `p${k}`, look: look(from + k), shown: { x: k, y: 0, z: 0 } }));

/** A host with counting fakes; `frame(peers)` is one sync plus the compose queue draining, as it does between frames. */
function host() {
  const c = { composes: 0, destroyed: 0, released: [] };
  const rp = new RemotePlayers({
    renderer: {
      uploadTexture: () => {}, releaseTexture: (_a, rec) => c.released.push(rec),
      createBillboardBatch: () => ({}), destroyBillboardBatch: () => { c.destroyed++; },
    },
    deps: {},
    compose: async () => { c.composes++; return { rgba: new Uint8Array(64).fill(255), width: 4, height: 4 }; },
    now: () => 1000,
  });
  const frame = async (list) => {
    rp.sync(list);
    for (let k = 0; k < list.length * 2 + 30; k++) { await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)); }
  };
  return { rp, c, frame };
}

test('SLAM7: past the cap every peer in view is still DRAWN and composed ONCE - the sweep no longer tears down the scene it is meant to serve (mutant: the cap counting worn dolls, as it did, which is 5,464 composes and a flickering crowd at 199)', async () => {
  const n = 199;   // a full room's worth, which is what SLAM6's fan now delivers
  const { rp, c, frame } = host();
  const crowd = peers(n);
  for (let f = 0; f < 12; f++) await frame(crowd);
  assert.ok(n > DOLLS_MAX, 'the case only exists past the cap');
  assert.equal(c.composes, n, `one compose per distinct look, not ${DOLLS_MAX}-odd a frame forever`);
  assert.equal(c.destroyed, 0, 'and not one billboard torn down while its peer stood there');
  assert.equal(rp._batches.size, n, 'every peer in view is drawn, not a rotating subset of the cap');
});

test('SLAM7: a doll is protected while the scene NEEDS it - worn by a billboard, or asked for by the last sync and still composing (mutant: worn only, which evicts a doll in the gap between the compose finishing and the next frame picking it up)', async () => {
  const { rp, frame } = host();
  const crowd = peers(70);
  for (let f = 0; f < 6; f++) await frame(crowd);
  const needed = rp._needed();
  assert.equal(needed.size, 70, 'all seventy looks are the scene');
  for (const p of crowd) assert.ok(needed.has(lookKey(p.look)), 'each one by its look key');
  // the wanted set is REBUILT each frame, so a look nobody stands in any more stops being needed at once
  await frame(crowd.slice(0, 5));
  assert.equal(rp._wanted.size, 5, 'only what this frame asked for');
  assert.equal(rp._needed().size, 5, 'and the batches of the departed were dropped in the same sync');
});

test('SLAM7: the cache is still BOUNDED, and it is a real LRU - the least recently DRAWN spare goes first, not the first ever composed (mutants: the bound removed, which leaks a texture per look for the session; the order left at insertion, which keeps a look last seen an hour ago over one that left the screen this frame)', async () => {
  const { rp, c, frame } = host();
  // twenty in view, a brand-new look every frame: the spare set would grow without limit if the sweep stopped working
  const IN_VIEW = 20;
  for (let f = 0; f < 120; f++) await frame(peers(IN_VIEW, f * IN_VIEW));
  assert.equal(rp._dolls.size, DOLLS_MAX + IN_VIEW, 'the map holds the cap of spares plus exactly what is on screen');
  assert.ok(c.released.length > 120 * IN_VIEW - rp._dolls.size - 5, 'and every look that fell out was really released, not leaked');
  // the order: draw an old look again and it stops being the next to go
  const { rp: rp2, frame: frame2 } = host();
  const a = peers(1, 0), b = peers(1, 1000);
  await frame2([...a, ...b]);
  const keyA = lookKey(a[0].look);
  assert.equal([...rp2._dolls.keys()][0], keyA, 'A was composed first, so it sits at the front');
  await frame2([...b, ...a]);   // both still drawn, A touched last
  assert.equal([...rp2._dolls.keys()].at(-1), keyA, 'and drawing A moves it to the BACK - the Map is the LRU list');
});

test('SLAM7: and the LEAST recently drawn spare is the one that goes - driven, so the order is a behaviour and not just a Map\'s (mutant: the last spare taken instead of the first, which throws away the look that left the screen a moment ago and keeps the one nobody has seen in an hour)', async () => {
  const { rp, frame } = host();
  // each look drawn ALONE, in order: every earlier one becomes a spare, touched in exactly the order it was drawn
  const n = DOLLS_MAX + 3;
  for (let i = 0; i < n; i++) await frame(peers(1, i));
  const gone = [];
  for (let i = 0; i < n; i++) if (!rp._dolls.has(lookKey(look(i)))) gone.push(i);
  assert.equal(rp._dolls.size, DOLLS_MAX + 1, 'the cap of spares, plus the one look still on screen');
  assert.deepEqual(gone, [0, 1], 'the two that went are the two drawn LONGEST ago - front of the list, not the back');
  assert.ok(rp._dolls.has(lookKey(look(n - 2))), 'and the one that left the screen last frame is still there');
  // drawing an old look again saves it: it goes to the BACK of the list, so the next sweep takes the one behind it
  await frame(peers(1, 2));   // look 2 was next in line; drawn again, it is now the newest thing in the cache
  assert.equal([...rp._dolls.keys()].at(-1), lookKey(look(2)));
  await frame(peers(1, n + 1));   // one more brand-new look: one compose, one sweep
  assert.ok(rp._dolls.has(lookKey(look(2))), 'look 2 was next to go and was drawn again, so it survives');
  assert.ok(!rp._dolls.has(lookKey(look(3))), 'and the one behind it went in its place');
});

test('SLAM7: under the cap nothing changed at all - ordinary play in the Bay is a handful of people and must not pay for an event it is not having (mutant: the protection applied only past some crowd threshold)', async () => {
  const { rp, c, frame } = host();
  const few = peers(3);
  for (let f = 0; f < 8; f++) await frame(few);
  assert.equal(c.composes, 3); assert.equal(c.destroyed, 0); assert.equal(c.released.length, 0);
  assert.equal(rp._dolls.size, 3, 'three looks, three dolls, nothing swept');
});
