// SLAM4 (2026-09-16, Mac: Daggerfall's 30th, a streamer's server slam): WHAT ONLY EVER GREW.
//
// Three maps in the online path had no way of shrinking. None of them matters in a twenty-minute test, which is
// why none of them was caught: each is keyed by a peer id or a LOOK, and the case they were written for is a
// four-hour stream where hundreds of people come and go and almost every look is seen once.
//
//   - `_peerHeights` (scenes/world.js) kept every id that ever stood in the room, for the life of the session.
//   - `remotePlayers._dolls` kept a `{ failedUntil }` record for every look that would not compose. `_evict`
//     counts only READY dolls, so those were never counted and never swept; only re-asking for that exact look
//     cleared one, and a look nobody wears again is never asked for.
//   - `peerBodies._failed` kept every look whose Morrowind body would not build, forgotten only when a peer
//     wearing that same look asked again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RemotePlayers, DOLL_RETRY_MS } from '../src/net/remotePlayers.js';
import { PeerBodies, BODY_RETRY_MS } from '../src/net/peerBodies.js';

const code = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const look = (i) => ({ race: 'Nord', gender: 'male', faceIndex: 0, items: [{ templateIndex: i, group: 'Armor', equipSlot: 1 }] });

test('SLAM4: a doll that would not compose is FORGOTTEN once its retry has passed - a crowd of looks seen once does not accumulate for the session (mutant: the failure entries left, which is the leak; mutant: swept while still fresh, which re-composes a broken look every frame)', async () => {
  let now = 1000;
  const rp = new RemotePlayers({ renderer: { uploadTexture: () => {}, releaseTexture: () => {}, createBillboardBatch: () => ({}), destroyBillboardBatch: () => {} },
    deps: {}, compose: async () => null, now: () => now });   // every compose FAILS
  for (let i = 0; i < 40; i++) { rp.dollFor(look(i)); await Promise.resolve(); await Promise.resolve(); }
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(rp._dolls.size, 40, 'each failure is remembered while its retry stands');
  // still inside the retry: nothing is forgotten, or a broken look would be re-composed on every frame
  now += DOLL_RETRY_MS - 1;
  rp._evict();
  assert.equal(rp._dolls.size, 40, 'a fresh failure is kept - the retry is what it is for');
  // past it: gone
  now += 2;
  rp._evict();
  assert.equal(rp._dolls.size, 0, 'and past the retry they are nothing but memory');
});

test('SLAM4: the failure path reaches the sweep at all - it was the one outcome that never did (mutant: _evict on success only, as it was)', () => {
  const src = code('src/net/remotePlayers.js');
  const i = src.indexOf('failedUntil: this._now() + DOLL_RETRY_MS');
  assert.ok(i > 0);
  assert.match(src.slice(i, i + 200), /_evict\(\)/, 'a failing compose sweeps like a succeeding one');
});

test('SLAM4: a Morrowind body that would not build is forgotten once its retry has passed (mutant: forgotten only when that exact look is asked for again - a look nobody wears twice is never asked for)', () => {
  let now = 1000;
  const bodies = new PeerBodies({ renderer: {}, enabled: () => true, createRig: () => ({ attach() {}, unload() {}, build: async () => ({ ok: false, stage: 'x', error: 'y' }), canThirdPerson: () => false, setViewMode: () => false, update() {}, drawThird: () => false }), now: () => now, warn: () => {} });
  for (let i = 0; i < 30; i++) bodies._failed.set(`look-${i}`, { until: now + BODY_RETRY_MS, reason: 'no body' });
  assert.equal(bodies._failed.size, 30);
  // a sync inside the retry keeps them
  now += BODY_RETRY_MS - 1;
  bodies.sync([], () => [0, 0, 0], 0.016, [0, 0, 0]);
  assert.equal(bodies._failed.size, 30, 'a fresh refusal is kept - it is what stops the rebuild storm');
  now += 2;
  bodies.sync([], () => [0, 0, 0], 0.016, [0, 0, 0]);
  assert.equal(bodies._failed.size, 0, 'past the retry, forgotten without anybody asking again');
});

test('SLAM4: the remembered peer heights go with the peers - the session\'s roster is the truth about who exists (mutant: the map never pruned, which is the leak; mutant: pruned against the DRAWABLE set, which forgets a peer that is merely out of range and makes its aim point flicker)', () => {
  const w = code('src/scenes/world.js');
  assert.match(w, /if \(_peerHeights\.size > online\.peers\.size\) for \(const id of \[\.\.\._peerHeights\.keys\(\)\]\) if \(!online\.peers\.has\(id\)\) _peerHeights\.delete\(id\);/,
    'pruned against online.peers - the ROSTER, not the drawable set');
  // the guard reads the roster and not `visible`/`drawable`: a peer out of range is still a peer, and AUDIT
  // WORLD6b-ii C5 put this map here precisely so a height survives a peer not standing for a moment
  const i = w.indexOf('_peerHeights.size > online.peers.size');
  assert.doesNotMatch(w.slice(i, i + 200), /visible|drawable/, 'never pruned by what is DRAWN');
});
