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
// graph depend on. AUDIT MW-TEXTHREAD: the garments' colour measured in
// the pool and read from its memo (F2), the pool's refusal kept (F4), an
// archive entry read once while in flight and the measures a few at a
// time (F5), and an idle pool letting its workers go (F6).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { handleDecode as handle } from '../src/formats/mwTextureWorker.js';
import { createTexturePool, textureThreadDisabled, texturePoolSize, TEXTURE_WORKERS_MAX, _useTexturePool, _resetTexturePool } from '../src/formats/mwTextureClient.js';
import { decodeTextureImage } from '../src/formats/mwTexture.js';
import { buildFpArm, fpSkeletonPath, FP_CLIP_PATH, inLanes, MEASURE_LANES } from '../src/combat/fpArm.js';
import { MwBsaFile } from '../src/formats/mwBsaFile.js';
import { MW_CLOTHING_TYPE, DF_CLOTHING_DYE_RGB } from '../src/formats/mwItemMap.js';

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
  assert.match(preload, /if \(!TEXTURE_CACHE\.has\(key\)\) TEXTURE_CACHE\.set\(key, \{ ok: true, path, image \}\);/, 'the image is kept');
  assert.match(preload, /if \(err\?\.decoderError && !TEXTURE_CACHE\.has\(key\)\) TEXTURE_CACHE\.set\(key, \{ ok: false, path, error: err\.message, image: warningImage\(\) \}\);/, 'and so is the decoder\'s refusal, in collectArmTextures\' words (AUDIT F4)');
  // AUDIT F5: side by side, a few at a time - each garment once, heads and hairs in one set of lanes, in the pools' order
  assert.match(arm, /const once = asked\.filter\(\(rec\) => !seen\.has\(rec\.id\) && seen\.add\(rec\.id\)\);\n\s*await inLanes\(once, \(rec\) => preloadClothingColour\(rec, parts, archives, gen\)\);/, 'the garments\' measures in lanes, each record once');
  assert.match(arm, /const measured = await inLanes\(\[\.\.\.pools\.heads\.map\(\(rec\) => \[rec, 'head'\]\), \.\.\.pools\.hairs\.map\(\(rec\) => \[rec, 'hair'\]\)\],\n\s*async \(\[rec, kind\]\) => \(\{ id: rec\.id, f: await measurePart\(rec, archives, kind\) \}\)\);\n\s*const heads = measured\.slice\(0, pools\.heads\.length\);\n\s*const hairs = measured\.slice\(pools\.heads\.length\);/, 'the face match\'s candidates in lanes, in the pools\' own order');
  // the colour measure: level 0 alone, on this thread only for a candidate the pool's measure (AUDIT F2) did not answer
  assert.match(arm, /rgb = garmentColourOf\(decodeTextureImage\(tpath, tarc\.get\(tpath\)\.slice\(\), \{ levels: 1 \}\)\.mips\[0\]\);/, 'the colour measure decodes level 0 alone');
  assert.match(arm, /try \{ rgb = garmentColourOf\(\(await decodeTextureOffThread\(tpath, tarc\.get\(tpath\), \{ levels: 1 \}\)\)\.mips\[0\]\); \}/, 'and in the pool, the same level');
  assert.equal((arm.match(/tpath = clothingTexturePath\(rec, parts, archives\);/g) ?? []).length, 2, 'one derivation of the garment\'s texture, two measures of it');
});

// ═══ AUDIT MW-TEXTHREAD ═════════════════════════════════════════════
const enc = (s) => [...s].map((c) => c.charCodeAt(0));
const u32 = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
const z = (s) => [...enc(s), 0];
const sub = (name, data) => [...enc(name), ...u32(data.length), ...data];
const rec = (type, subs) => { const data = subs.flat(); return [...enc(type), ...u32(data.length), ...u32(0), ...u32(0), ...data]; };
/** The fixture rig's deps over `files`, with the esm given and a generation of the test's own. */
function rigDeps(files, esm, gen) {
  const archive = { has: (p) => files.has(p), get: (p) => files.get(p) };
  return {
    loadMorrowindArchives: async () => [archive],
    storedMorrowindNames: async () => ['armfp.esm'],
    loadMorrowindFile: async () => esm,
    morrowindDataGeneration: () => gen,
  };
}
const rigFiles = (dds) => new Map([
  [fpSkeletonPath({}), fixture('armfp.nif')],
  [FP_CLIP_PATH, fixture('armfpidle.kf')],
  ['meshes/fixture/armfphand.nif', fixture('armfphand.nif')],
  ['meshes/fixture/armfparm.nif', fixture('armfparm.nif')],
  [DDS, dds],
]);
/** A solid w x h image in the decoder's shape. */
const solid = (w, h, [r, g, b]) => ({ width: w, height: h, mips: [{ width: w, height: h, rgba: Uint8Array.from({ length: w * h * 4 }, (_, i) => [r, g, b, 255][i % 4]) }] });

test('AUDIT MW-TEXTHREAD F2: a garment\'s colour is measured IN THE POOL - level 0, off this thread - and the build\'s dye pick reads that measure, never a decode here (mutant: the preload only loads, as before)', async () => {
  assert.equal(MW_CLOTHING_TYPE.Shirt, 2);
  // two shirts: _01 names a body no record carries (nothing to measure, and nothing it could dress), _02 dresses the
  // chest with the fixture hand mesh, whose texture is tx_fixture.dds. The texture's bytes in the archive are NOT a
  // texture: a decode on this thread refuses them, so only the pool's measure can find _02's colour - and the dye
  // then picks _02 over the id sort's _01.
  const esm = Uint8Array.from([
    ...fixture('armfp.esm'),
    ...rec('CLOT', [sub('NAME', z('common_shirt_01')), sub('MODL', z('c\\nomesh.nif')), sub('CTDT', [...u32(2), ...u32(0), ...u32(0)]), sub('INDX', [3]), sub('BNAM', z('nobody'))]),
    ...rec('CLOT', [sub('NAME', z('common_shirt_02')), sub('MODL', z('c\\shirt2.nif')), sub('CTDT', [...u32(2), ...u32(0), ...u32(0)]), sub('INDX', [3]), sub('BNAM', z('c_shirt_02_m'))]),
    ...rec('BODY', [sub('NAME', z('c_shirt_02_m')), sub('MODL', z('fixture\\armfphand.nif')), sub('FNAM', z('')), sub('BYDT', [3, 0, 0, 1])]),
  ]);
  const jobs = [];
  const red = DF_CLOTHING_DYE_RGB[2];
  // the pool: a full chain is the fixture's own image (the arm's textures), a level-0 ask is the measure's - answered
  // with the dye's own colour, so the pick is the pool's answer and nobody else's
  _useTexturePool({
    decode: async (path, bytes, { levels = null } = {}) => { jobs.push({ path, levels }); return levels === 1 ? solid(4, 4, red) : decodeTextureImage(path, fixture('fixture.dds')); },
    close() {},
  });
  try {
    const shirt = { kind: 'clothing', templateIndex: 165, name: 'Short Shirt', dye: 2 };
    const res = await buildFpArm({ race: 'fprace', armor: [shirt], deps: rigDeps(rigFiles(new Uint8Array(64)), esm, 9201) });
    assert.equal(res.ok, true, res.error);
    assert.ok(jobs.some((j) => j.path === DDS && j.levels === 1), 'the garment\'s texture was measured in the pool, level 0 alone');
    const row = res.worn.find((r) => r.label === 'Short Shirt');
    assert.ok(row && row.dressed.length > 0 && row.dressed.every((sl) => /common_shirt_02/.test(sl)),
      `the dye picked the shirt the pool measured - a decode here would have refused the bytes and fallen to _01 (${JSON.stringify(row)})`);
  } finally { _resetTexturePool(); }
  // and the pool's REFUSAL is the measure's null, kept: over good bytes a decode here would have measured _02 - it is
  // not asked, so nothing measures and the id sort's _01 stands
  _useTexturePool({
    decode: async (path, bytes, { levels = null } = {}) => {
      if (levels === 1) throw Object.assign(new Error('refused in the pool'), { decoderError: true });
      return decodeTextureImage(path, fixture('fixture.dds'));
    },
    close() {},
  });
  try {
    const shirt = { kind: 'clothing', templateIndex: 165, name: 'Short Shirt', dye: 2 };
    const res = await buildFpArm({ race: 'fprace', armor: [shirt], deps: rigDeps(rigFiles(fixture('fixture.dds')), esm, 9202) });
    assert.equal(res.ok, true, res.error);
    const row = res.worn.find((r) => r.label === 'Short Shirt');
    assert.deepEqual(row.dressed, [], `the refusal stood - nothing re-measured _02 on this thread (${JSON.stringify(row)})`);
  } finally { _resetTexturePool(); }
});

test('AUDIT MW-TEXTHREAD F4: the pool\'s refusal is the texture\'s answer - kept in the memo, never decoded again here; a failure that is not the decoder\'s is not kept (mutant: the refusal dropped, or every failure kept)', async () => {
  const esm = fixture('armfp.esm');
  const good = fixture('fixture.dds');
  // the bytes are GOOD: a decode on this thread would succeed, so an entry that says the pool's words came from the pool
  _useTexturePool({ decode: async () => { throw Object.assign(new Error('refused in the pool'), { decoderError: true }); }, close() {} });
  try {
    const res = await buildFpArm({ race: 'fprace', deps: rigDeps(rigFiles(good), esm, 9301) });
    assert.equal(res.ok, true, res.error);
    const e = [...res.textures.values()].find((t) => t.path === DDS);
    assert.equal(e.ok, false); assert.equal(e.error, 'refused in the pool', 'the pool\'s refusal stands - nothing decoded it a second time');
    assert.deepEqual(e.image.mips.length, 1, 'the warning image in its place');
  } finally { _resetTexturePool(); }
  _useTexturePool({ decode: async () => { throw new Error('the pool broke'); }, close() {} });
  try {
    const res = await buildFpArm({ race: 'fprace', deps: rigDeps(rigFiles(good), esm, 9302) });
    const e = [...res.textures.values()].find((t) => t.path === DDS);
    assert.equal(e.ok, true, 'no decoderError: not the file\'s answer - collectArmTextures decoded it');
    assert.deepEqual(e.image, decodeTextureImage(DDS, good));
  } finally { _resetTexturePool(); }
});

test('AUDIT MW-TEXTHREAD F5: an archive entry asked for while its read is in flight is that read - one range read, one answer; a failed read is not kept (mutant: the in-flight map dropped)', async () => {
  const names = ['meshes\\a.nif', 'textures\\b.dds'];
  const datas = [Uint8Array.from([1, 2, 3, 4]), Uint8Array.from([5, 6, 7])];
  const dirsize = 12 * 2 + names.reduce((n, s) => n + s.length + 1, 0);
  const whole = Uint8Array.from([...u32(0x100), ...u32(dirsize), ...u32(2),
    ...u32(4), ...u32(0), ...u32(3), ...u32(4), ...u32(0), ...u32(names[0].length + 1),
    ...z(names[0]), ...z(names[1]), ...new Array(16).fill(0), ...datas[0], ...datas[1]]);
  let reads = 0;
  let fail = false;
  const blob = new Blob([whole]);
  const counting = { size: blob.size, slice: (a, b) => { const part = blob.slice(a, b); return { arrayBuffer: async () => { reads++; await new Promise((r) => setTimeout(r, 5)); if (fail) throw new Error('read failed'); return part.arrayBuffer(); } }; } };
  const bsa = await MwBsaFile.open(counting);
  const before = reads;
  const [x, y] = await Promise.all([bsa.load('meshes/a.nif'), bsa.load('MESHES\\A.NIF')]);
  assert.equal(reads - before, 1, 'two asks in flight together: one read');
  assert.equal(x, y); assert.deepEqual([...x], [1, 2, 3, 4]);
  assert.equal(await bsa.load('meshes/a.nif'), x, 'and the landed bytes answer after');
  fail = true;
  await assert.rejects(bsa.load('textures/b.dds'), /read failed/);
  fail = false;
  assert.deepEqual([...await bsa.load('textures/b.dds')], [5, 6, 7], 'a failed read is not the answer: the next ask reads again');
});

test('AUDIT MW-TEXTHREAD F5: inLanes - every item once, the answers in the list\'s order, never more than the lanes in flight and more than one when there is room (mutant: all at once, or one at a time)', async () => {
  assert.equal(MEASURE_LANES, 8);
  let inFlight = 0; let most = 0;
  const seen = [];
  const out = await inLanes(Array.from({ length: 20 }, (_, i) => i), async (n) => {
    inFlight++; most = Math.max(most, inFlight); seen.push(n);
    await new Promise((r) => setTimeout(r, 20 - n));   // later items land first: the order is the list's, not the landing's
    inFlight--;
    return n * 10;
  });
  assert.deepEqual(out, Array.from({ length: 20 }, (_, i) => i * 10));
  assert.deepEqual([...seen].sort((a, b) => a - b), Array.from({ length: 20 }, (_, i) => i), 'each once');
  assert.equal(most, MEASURE_LANES, 'the lanes are the cap, and they fill');
  assert.deepEqual(await inLanes([], async () => 1), []);
  most = 0;
  await inLanes([1, 2, 3], async () => { inFlight++; most = Math.max(most, inFlight); await new Promise((r) => setTimeout(r, 2)); inFlight--; }, 2);
  assert.equal(most, 2);
});

test('AUDIT MW-TEXTHREAD F6: an idle pool lets its workers go once every job has answered, and the next decode opens one again; a pool with a job in hand keeps its worker (mutant: never let go, or let go while busy)', async () => {
  const bytes = fixture('fixture.dds');
  const want = decodeTextureImage(DDS, bytes);
  const made = [];
  const pool = createTexturePool({ workerFactory: () => { const w = fakeWorker(); made.push(w); return w; }, size: 2, idleMs: 10 });
  await Promise.all([pool.decode(DDS, bytes), pool.decode(DDS, bytes)]);
  assert.equal(made.length, 2); assert.equal(pool.stats.workers, 2);
  await new Promise((r) => setTimeout(r, 40));
  assert.deepEqual(made.map((w) => w.terminated), [1, 1], 'quiet past idleMs: both let go');
  assert.equal(pool.stats.workers, 0);
  assert.deepEqual(await pool.decode(DDS, bytes), want, 'the next decode is answered');
  assert.equal(made.length, 3, 'by a worker opened again - retired is not dead');
  assert.equal(pool.stats.offThread, 3); assert.equal(pool.stats.onThread, 0);
  // no quiet while a job is in hand anywhere in the pool, and a job asked inside the quiet ends it - so neither the
  // idle worker beside a busy one, nor the one a new burst would reuse, is let go under the work
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const inTime = (p) => Promise.race([p, sleep(200).then(() => 'never answered')]);
  const answer = (w, i) => handle(w.posted[i].msg, (reply) => w.onmessage?.({ data: reply }));
  const held = [];
  const two = createTexturePool({ workerFactory: () => { const w = fakeWorker({ answer: false }); held.push(w); return w; }, size: 2, idleMs: 10 });
  const a1 = two.decode(DDS, bytes);
  const b1 = two.decode(DDS, bytes);
  assert.equal(held.length, 2, 'one job each');
  answer(held[0], 0);
  assert.deepEqual(await a1, want);
  await sleep(40);
  assert.deepEqual(held.map((w) => w.terminated), [0, 0], 'the other still holds a job: no quiet began');
  answer(held[1], 0);
  assert.deepEqual(await inTime(b1), want);
  const a2 = two.decode(DDS, bytes);   // asked at once, inside the quiet the last answer began
  await sleep(40);
  assert.deepEqual(held.map((w) => w.terminated), [0, 0], 'a job asked in the quiet ends it - the pool stays whole for the burst');
  answer(held[0], 1);
  assert.deepEqual(await inTime(a2), want);
  await sleep(40);
  assert.deepEqual(held.map((w) => w.terminated), [1, 1], 'quiet again, with nothing in hand: both let go');
  two.close();
  assert.match(rd('src/formats/mwTextureClient.js'), /idle\.unref\?\.\(\);/, 'and an idle timer never holds node open');
});
