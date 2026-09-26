// MW-TEXTHREAD - MORROWIND TEXTURES DECODED OFF THE MAIN THREAD, IN A POOL
// (formats/mwTextureWorker.js, formats/mwTextureClient.js), and the
// build's preload filling the decode memo through it (combat/fpArm.js
// preloadArmTextures). Pins: the wire (decode answers the decoder's own
// image with every level transferred, an error answers the message), the
// pool over fake workers (the same image, the caller's bytes copied and
// left whole, the jobs spread to the least busy, never past the size),
// the fallbacks (no factory, a throwing factory, a worker that dies with
// jobs in hand), a decoder error that is not decoded twice, the escape
// hatch, the pool's size law, the build's textures arriving through the
// pool, and the source spellings the bundler and the worker's import
// graph depend on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { handleDecode as handle } from '../src/formats/mwTextureWorker.js';
import { createTexturePool, textureThreadDisabled, texturePoolSize, TEXTURE_WORKERS_MAX, _useTexturePool, _resetTexturePool } from '../src/formats/mwTextureClient.js';
import { decodeTextureImage } from '../src/formats/mwTexture.js';
import { buildFpArm, fpSkeletonPath, FP_CLIP_PATH } from '../src/combat/fpArm.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const fixture = (n) => new Uint8Array(readFileSync(join(ROOT, 'test/fixtures/mw', n)));
const DDS = 'textures/tx_fixture.dds';
/** An 8x8 DXT1 with its whole chain (8, 4, 2, 1) - the committed fixture carries one level, and `levels` needs a chain
 *  to cut. The header is mwdds.test.js's; every block the same red-blue half. */
function chainedDds() {
  const block = [0x00, 0xf8, 0x1f, 0x00, 0xe4, 0xe4, 0xe4, 0xe4];
  const payload = new Uint8Array((4 + 1 + 1 + 1) * 8);
  for (let i = 0; i < payload.length; i += 8) payload.set(block, i);
  const out = new Uint8Array(128 + payload.length);
  const v = new DataView(out.buffer);
  v.setUint32(0, 0x20534444, true); v.setUint32(4, 124, true);
  v.setUint32(12, 8, true); v.setUint32(16, 8, true); v.setUint32(28, 4, true);
  v.setUint32(76, 32, true); v.setUint32(80, 0x4, true); v.setUint32(84, 0x31545844, true);
  out.set(payload, 128);
  return out;
}

/** A Worker double that runs the real `handle` on a later tick, the way a
 *  message port does, and records what crossed it. */
function fakeWorker({ answer = true, dieOnJob = false } = {}) {
  const w = {
    posted: [], terminated: 0, onmessage: null, onerror: null,
    postMessage(msg, transfer) {
      w.posted.push({ msg, transfer });
      if (dieOnJob) { queueMicrotask(() => w.onerror?.({ message: 'the worker died' })); return; }
      if (!answer) return;
      queueMicrotask(() => handle(msg, (reply, replyTransfer) => { (w.replies ??= []).push({ reply, replyTransfer }); w.onmessage?.({ data: reply }); }));
    },
    terminate() { w.terminated += 1; },
  };
  return w;
}

test('MW-TEXTHREAD worker: the wire - a decode answers the decoder\'s own image, every level transferred; a bad file and a bad message answer the error by id', () => {
  const bytes = fixture('fixture.dds');
  const out = [];
  const post = (m, t) => out.push({ m, t });
  handle({ t: 'decode', id: 3, path: DDS, bytes: bytes.slice() }, post);
  const want = decodeTextureImage(DDS, bytes);
  assert.equal(out[0].m.t, 'image'); assert.equal(out[0].m.id, 3);
  assert.deepEqual(out[0].m.image, want, 'the same image the main thread decodes');
  assert.deepEqual(out[0].t, out[0].m.image.mips.map((l) => l.rgba.buffer), 'every level crosses by transfer');
  assert.equal(new Set(out[0].t).size, out[0].t.length, 'each level its own buffer - a duplicate would throw at the port');
  // levels rides the message: level 0 alone, as the face match and the colour measure ask
  const chain = chainedDds();
  assert.equal(decodeTextureImage(DDS, chain).mips.length, 4, 'the chain is whole by default');
  handle({ t: 'decode', id: 4, path: DDS, bytes: chain.slice(), levels: 1 }, post);
  assert.equal(out[1].m.image.mips.length, 1, 'cut at the level asked for');
  assert.deepEqual(out[1].m.image.mips[0], decodeTextureImage(DDS, chain).mips[0]);
  handle({ t: 'decode', id: 5, path: DDS, bytes: new Uint8Array(16) }, post);
  assert.equal(out[2].m.t, 'error'); assert.equal(out[2].m.id, 5); assert.match(out[2].m.message, /DDS/);
  handle({ t: 'nope', id: 6 }, post);
  assert.equal(out[3].m.t, 'error'); assert.equal(out[3].m.id, 6);
});

test('MW-TEXTHREAD pool: the same image off the thread, the caller\'s bytes copied and left whole, jobs spread to the least busy and never past the size', async () => {
  const made = [];
  const pool = createTexturePool({ workerFactory: () => { const w = fakeWorker(); made.push(w); return w; }, size: 3 });
  const bytes = fixture('fixture.dds');
  const want = decodeTextureImage(DDS, bytes);
  const images = await Promise.all(Array.from({ length: 7 }, () => pool.decode(DDS, bytes)));
  for (const img of images) assert.deepEqual(img, want);
  assert.equal(made.length, 3, 'three workers for seven jobs at once - the size is the cap');
  assert.deepEqual(made.map((w) => w.posted.length), [3, 2, 2], 'each job to the least busy worker, a new one while the pool is short');
  assert.ok(bytes.byteLength > 0 && bytes.buffer.byteLength > 0, 'the caller\'s bytes are not detached');
  for (const w of made) for (const { msg, transfer } of w.posted) {
    assert.notEqual(msg.bytes.buffer, bytes.buffer, 'a copy crosses, never the caller\'s buffer');
    assert.deepEqual(transfer, [msg.bytes.buffer]);
  }
  assert.equal(pool.stats.offThread, 7); assert.equal(pool.stats.onThread, 0);
  // one at a time reuses the idle worker rather than opening another
  const quiet = [];
  const q = createTexturePool({ workerFactory: () => { const w = fakeWorker(); quiet.push(w); return w; }, size: 4 });
  for (let i = 0; i < 3; i++) await q.decode(DDS, bytes);
  assert.equal(quiet.length, 1, 'jobs one after another keep one worker');
});

test('MW-TEXTHREAD pool: the fallbacks are the old path - no factory, a throwing factory, a worker that dies with jobs in hand all decode on this thread and answer the same image', async () => {
  const bytes = fixture('fixture.dds');
  const want = decodeTextureImage(DDS, bytes);
  const none = createTexturePool({ workerFactory: null, size: 2 });   // node: no Worker - the default factory is null here
  assert.deepEqual(await none.decode(DDS, bytes), want);
  assert.equal(none.stats.onThread, 1);
  let tries = 0;
  const throwing = createTexturePool({ workerFactory: () => { tries++; throw new Error('no workers here'); }, size: 2 });
  assert.deepEqual(await throwing.decode(DDS, bytes), want);
  assert.deepEqual(await throwing.decode(DDS, bytes), want);
  assert.equal(tries, 1, 'a factory that threw is not asked again');
  const dying = fakeWorker({ dieOnJob: true });
  const died = createTexturePool({ workerFactory: () => dying, size: 1 });
  const [a, b] = await Promise.all([died.decode(DDS, bytes), died.decode(DDS, bytes)]);
  assert.deepEqual(a, want); assert.deepEqual(b, want);
  assert.ok(dying.terminated >= 1, 'the dead worker is let go');
  assert.equal(died.stats.onThread, 2, 'both of its jobs finished here');
  assert.deepEqual(await died.decode(DDS, bytes), want, 'and every job after it');
});

test('MW-TEXTHREAD pool: a decoder error is the answer - rejected with decoderError, not decoded a second time on this thread', async () => {
  const w = fakeWorker();
  const pool = createTexturePool({ workerFactory: () => w, size: 1 });
  await assert.rejects(pool.decode(DDS, new Uint8Array(16)), (e) => e.decoderError === true && /DDS/.test(e.message));
  assert.equal(pool.stats.onThread, 0, 'the worker answered - nothing ran here');
  assert.equal(w.terminated, 0, 'and the worker is not dead for it');
  // on this thread the same refusal is the same rejection
  await assert.rejects(createTexturePool({ workerFactory: null }).decode(DDS, new Uint8Array(16)), (e) => e.decoderError === true);
});

test('MW-TEXTHREAD: the escape hatch and the pool\'s size - one core is the frame\'s, never past the cap', () => {
  assert.equal(textureThreadDisabled('?texturethread=off'), true);
  assert.equal(textureThreadDisabled('?world&texturethread=off&fps'), true);
  assert.equal(textureThreadDisabled('?texturethread=on'), false);
  assert.equal(textureThreadDisabled(''), false);
  assert.equal(TEXTURE_WORKERS_MAX, 4);
  assert.equal(texturePoolSize(16), 4);
  assert.equal(texturePoolSize(4), 3);
  assert.equal(texturePoolSize(2), 1);
  assert.equal(texturePoolSize(1), 1);
  assert.equal(texturePoolSize(null), 1, 'an unknown core count is treated as two');
  assert.equal(texturePoolSize(0), 1);
});

test('MW-TEXTHREAD: the build\'s textures arrive through the pool - its preload decodes them there into the memo, and the build answers the same image', async () => {
  const esm = fixture('armfp.esm');
  const files = new Map([
    [fpSkeletonPath({}), fixture('armfp.nif')],
    [FP_CLIP_PATH, fixture('armfpidle.kf')],
    ['meshes/fixture/armfphand.nif', fixture('armfphand.nif')],
    ['meshes/fixture/armfparm.nif', fixture('armfparm.nif')],
    [DDS, fixture('fixture.dds')],
  ]);
  const archive = { has: (p) => files.has(p), get: (p) => files.get(p) };
  const made = [];
  _useTexturePool(createTexturePool({ workerFactory: () => { const w = fakeWorker(); made.push(w); return w; }, size: 2 }));
  try {
    let gen = 9101;   // a generation of its own, so no other test's memo answers first
    const deps = {
      loadMorrowindArchives: async () => [archive],
      storedMorrowindNames: async () => ['armfp.esm'],
      loadMorrowindFile: async () => esm,
      morrowindDataGeneration: () => gen,
    };
    const res = await buildFpArm({ race: 'fprace', deps });
    assert.equal(res.ok, true, res.error);
    const jobs = made.flatMap((w) => w.posted.map((p) => p.msg));
    assert.ok(jobs.some((m) => m.t === 'decode' && m.path === DDS), 'the arm\'s texture went to the pool');
    const entries = [...res.textures.values()].filter((e) => e.path === DDS);
    assert.ok(entries.length > 0 && entries.every((e) => e.ok === true), 'and the build holds it, decoded');
    assert.deepEqual(entries[0].image, decodeTextureImage(DDS, fixture('fixture.dds')), 'the pool\'s image is the decoder\'s');
    // the memo answers a rebuild of the same generation: nothing new is asked of the pool
    const before = jobs.length;
    const again = await buildFpArm({ race: 'fprace', deps });
    assert.equal(again.ok, true);
    assert.equal(made.flatMap((w) => w.posted).length, before, 'the second build decodes nothing');
    gen = 9102;
  } finally { _resetTexturePool(); }
});

test('MW-TEXTHREAD: the source spellings - the worker constructed as Vite bundles it, the worker importing the pure decoder alone, and every decode site of the build going through the pool', () => {
  const client = rd('src/formats/mwTextureClient.js');
  assert.match(client, /return new Worker\(new URL\('\.\/mwTextureWorker\.js', import\.meta\.url\), \{ type: 'module' \}\);/);
  const worker = rd('src/formats/mwTextureWorker.js');
  assert.deepEqual([...worker.matchAll(/^import .* from '([^']+)';/gm)].map((m) => m[1]), ['./mwTexture.js'], 'the worker graph is the pure decoder alone');
  const arm = rd('src/combat/fpArm.js');
  const preload = arm.slice(arm.indexOf('async function preloadArmTextures('), arm.indexOf('\n}\n', arm.indexOf('async function preloadArmTextures(')));
  assert.match(preload, /image = await decodeTextureOffThread\(path, arc\.get\(path\)\)/);
  assert.match(preload, /if \(!TEXTURE_CACHE\.has\(key\)\) TEXTURE_CACHE\.set\(key, \{ ok: true, path, image \}\);/, 'an image alone is kept - a refusal stays collectArmTextures\' to record');
  assert.match(arm, /await Promise\.all\(asked\.map\(\(rec\) => preloadClothingColour\(rec, parts, archives, gen\)\)\);/, 'the garments\' reads side by side');
  assert.match(arm, /const \[heads, hairs\] = await Promise\.all\(\[\n\s*Promise\.all\(pools\.heads\.map\(async \(rec\) => \(\{ id: rec\.id, f: await measurePart\(rec, archives, 'head'\) \}\)\)\),\n\s*Promise\.all\(pools\.hairs\.map\(async \(rec\) => \(\{ id: rec\.id, f: await measurePart\(rec, archives, 'hair'\) \}\)\)\),\n\s*\]\);/, 'the face match\'s candidates measured side by side, in the pools\' own order');
  assert.match(arm, /const m0 = decodeTextureImage\(tpath, tarc\.get\(tpath\)\.slice\(\), \{ levels: 1 \}\)\.mips\[0\];/, 'the colour measure decodes level 0 alone');
});
