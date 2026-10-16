// PERF-DYE (2026-10-12, a profile of a player's live client travelling the overworld: 29 of the 122 frames over 50 ms
// in two minutes were a horse look's walk set dyed whole - forty pictures, some 45 ms, in one frame; bible/07-Rendering/
// Performance-Priority.md PERF-DYE) - A LOOK'S PICTURES ARE DYED HORSE_DYE_PICTURES A FRAME, never a set at once: no
// frame dyes more, among every look; a look's views then its walk frames, each once, and posed in the look only once
// its last is up; a look let go halfway gives back exactly the pictures it had.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHorseCartPool, horseStillRecord, horseWalkRecord, HORSE_ARCHIVE, HORSE_LOOKS_KEPT, HORSE_DYE_PICTURES } from '../../../src/scenes/horseCartPool.js';
import { HORSE_SPRITE_WIDTH, HORSE_SPRITE_HEIGHT, HORSE_VIEWS, HORSE_WALK_FRAMES } from '../../../src/systems/horse/horseCartLaw.js';
import { horseLookCode } from '../../../src/systems/horse/horseCoats.js';

const code = (coat, pattern = 0, legs = 0, seed = 0) => horseLookCode({ coat, pattern, legs, seed });
const flush = async (n = 8) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };
const PICTURES = HORSE_VIEWS * (1 + HORSE_WALK_FRAMES);
/** The pictures dyed in a look: its records' suffix. */
const ofLook = (keys, c) => keys.filter((k) => k.endsWith(`~${c}`));

/** A pool whose own horse wears `look.v`, its art up (the views, and the walk frames unless `walk` is false), counting
 *  what is dyed and let go. */
async function poolWith(look, { walk = true } = {}) {
  const uploads = [], evicted = [], batches = [];
  const renderer = {
    uploadTexture: (a, rec, px) => { uploads.push(`${a}_${rec}`); return px; },
    evictTexture: (k) => { evicted.push(k); return true; },
    createBillboardBatch: (archive, record) => { const b = { archive, record, origin: null }; batches.push(b); return b; },
    destroyBillboardBatch() {}, createMesh: () => ({}),
  };
  const decode = async () => ({ width: HORSE_SPRITE_WIDTH, height: HORSE_SPRITE_HEIGHT, data: new Uint8ClampedArray(HORSE_SPRITE_WIDTH * HORSE_SPRITE_HEIGHT * 4).fill(200) });
  const pool = createHorseCartPool({ renderer, meshes: null, collider: () => null, now: () => 0, fetchFn: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }), decode, horseLook: () => look.v });
  pool.attach({ view: () => ({ state: { HorseName: '' }, moving: null, deployed: null, horse: { isInteractive: true, position: [0, 0, 5], forward: [0, 0, 1], walk: { animationFrame: 0, walking: false } }, teamFollowing: false, horseFollowing: false, persistence: true }), lateUpdate() {}, rebase() {} });
  pool.presentation.horseArt.ensureStationary(); await flush();
  if (walk) { pool.presentation.horseArt.ensureWalk(); await flush(); }
  return { pool, uploads, evicted, batches, art: pool.presentation.horseArt };
}

test('PERF-DYE: my horse\'s look dyed HORSE_DYE_PICTURES a frame - the views, then the walk frames, each once - and worn once its last is up', async () => {
  const look = { v: code(4, 1, 1, 77) };
  const { pool, uploads, batches } = await poolWith(look);
  const perFrame = [];
  let posedAt = -1;
  for (let i = 0; i < Math.ceil(PICTURES / HORSE_DYE_PICTURES) + 3; i++) {
    const n = ofLook(uploads, look.v).length;
    pool.frame(0, [0, 1, 0]);
    perFrame.push(ofLook(uploads, look.v).length - n);
    const mine = batches.find((b) => b.archive === HORSE_ARCHIVE);
    if (posedAt < 0 && mine?.record.endsWith(`~${look.v}`)) posedAt = i;
  }
  assert.ok(perFrame.every((n) => n <= HORSE_DYE_PICTURES), `never more than HORSE_DYE_PICTURES a frame: ${perFrame}`);
  assert.equal(perFrame[0], HORSE_DYE_PICTURES, 'the budget spent from the first frame');
  const mine = ofLook(uploads, look.v);
  assert.equal(mine.length, PICTURES, 'every view and walk frame dyed');
  assert.equal(new Set(mine).size, PICTURES, 'each once');
  for (let v = 0; v < HORSE_VIEWS; v++) {
    assert.ok(mine.indexOf(`${HORSE_ARCHIVE}_${horseStillRecord(v, look.v)}`) < mine.indexOf(`${HORSE_ARCHIVE}_${horseWalkRecord(0, 0, look.v)}`), 'the views before the walk frames');
  }
  assert.equal(posedAt, Math.ceil(PICTURES / HORSE_DYE_PICTURES) - 1, 'worn in the frame its last picture is dyed, the bay\'s until');
});

test('PERF-DYE: the budget is the frame\'s, among every look - two looks met at once dye HORSE_DYE_PICTURES between them', async () => {
  const look = { v: 0 };   // my own horse the bay's: only the two looks below are dyed
  const { pool, uploads, art } = await poolWith(look);
  const a = code(2, 0, 0, 5), b = code(3, 2, 1, 9);
  let done = 0;
  for (let i = 0; i < 2 * Math.ceil(PICTURES / HORSE_DYE_PICTURES) + 2; i++) {
    const n = uploads.length;
    pool.frame(0, [0, 1, 0]);
    const upA = art.ensureLook(a), upB = art.ensureLook(b);
    assert.ok(uploads.length - n <= HORSE_DYE_PICTURES, `frame ${i}: ${uploads.length - n} pictures dyed`);
    if (upA && upB) { done = i; break; }
  }
  assert.ok(done > 0, 'both looks up in time');
  assert.equal(ofLook(uploads, a).length, PICTURES);
  assert.equal(ofLook(uploads, b).length, PICTURES);
});

test('PERF-DYE: before the walk art is up, a look is worn once its views are - never while the frame\'s budget left them for later', async () => {
  const look = { v: 0 };
  const { pool, art } = await poolWith(look, { walk: false });
  const a = code(2, 0, 0, 5), b = code(3, 2, 1, 9);
  pool.frame(0, [0, 1, 0]);
  assert.equal(art.ensureLook(a), true, 'the first look\'s views, the whole budget');
  assert.equal(art.ensureLook(b), false, 'the second\'s wait for the next frame: none of its views is up');
  pool.frame(0, [0, 1, 0]);
  assert.equal(art.ensureLook(b), true, 'and are, in it');
});

test('PERF-DYE: a look let go halfway gives back exactly the pictures dyed so far - none it never had, none kept', async () => {
  const look = { v: 0 };
  const { pool, uploads, evicted, art } = await poolWith(look);
  const half = code(5, 1, 0, 3);
  for (let i = 0; i < 3; i++) { pool.frame(0, [0, 1, 0]); art.ensureLook(half); }
  const dyed = ofLook(uploads, half);
  assert.equal(dyed.length, 3 * HORSE_DYE_PICTURES, 'three frames of it');
  assert.ok(dyed.length > HORSE_VIEWS && dyed.length < PICTURES, 'its views up and its walk set halfway');
  // HORSE_LOOKS_KEPT others drawn since: the half-dyed one is the longest undrawn, and let go
  for (let s = 1; s <= HORSE_LOOKS_KEPT; s++) { pool.frame(0, [0, 1, 0]); art.ensureLook(code(1, 0, 0, s)); }
  pool.frame(0, [0, 1, 0]);
  const gone = ofLook(evicted, half);
  assert.deepEqual([...gone].sort(), [...dyed].sort(), 'its dyed pictures, every one and no other');
});
