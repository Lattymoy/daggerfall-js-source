// DW1 - THE BUNDLE WORKER AND ITS CLIENT (formats/unityBundleWorker.js,
// formats/unityBundleClient.js), and the block-lazy reader behind them
// (formats/unityBundle.js blockStream). Diverse Weapons' bundle is ~10 s
// of LZ4 to index; the open runs in a worker, the reader keeps the
// blocks compressed, and the door (combat/diverseWeaponsAssets.js) reads
// through the client. Pins: the wire (open, rgba, close, error), the
// client over a fake worker (copied bytes, transferred pixels, the
// fallback on a throwing factory and on a worker that dies), the
// escape hatch, the door end to end, the reader's block edges and LRU,
// and the source spellings the bundler and the worker's import graph
// depend on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { handle } from '../src/formats/unityBundleWorker.js';
import { openUnityBundle, openBundleHere, bundleThreadDisabled } from '../src/formats/unityBundleClient.js';
import { readUnityFs, readUnityBundle, BLOCK_CACHE, TEXTURE_FORMAT } from '../src/formats/unityBundle.js';
import { unityFs, serializedFile, texture2dBody, textAssetBody, testBundle, RGBA_2x2 } from './unityFixture.mjs';
import {
  DIVERSE_WEAPONS_MOD, setDiverseWeaponsSources, clearDiverseWeaponsSources, diverseWeaponsBundle, diverseWeaponsImage, diverseWeaponsTexturesAttached, _resetDiverseWeaponsImages,
} from '../src/combat/diverseWeaponsAssets.js';
import { DFMOD_KEY_PREFIX } from '../src/systems/seasonsIliacBayAssets.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');

/** A Worker double that runs the real `handle` on a later tick, the way
 *  a message port does, and records what crossed it. */
function fakeWorker({ answer = true, dieOn = null } = {}) {
  const posted = [];
  const w = {
    posted, terminated: 0, onmessage: null, onerror: null,
    postMessage(msg, transfer) {
      posted.push({ msg, transfer });
      if (dieOn === msg.t) { queueMicrotask(() => w.onerror?.({ message: 'the worker died' })); return; }
      if (!answer) return;
      queueMicrotask(() => handle(msg, (reply, replyTransfer) => { w.replies = (w.replies ?? []); w.replies.push({ reply, replyTransfer }); w.onmessage?.({ data: reply }); }));
    },
    terminate() { w.terminated += 1; },
  };
  return w;
}

test('DW1 worker: the wire - open answers the index (text assets whole, textures by name and size, no pixels); rgba answers one texture transferred; a miss is null; a bad message and a bad bundle are errors keyed by id', () => {
  const out = [];
  const post = (m, t) => out.push({ m, t });
  handle({ t: 'open', id: 1, bytes: testBundle({ lz4: true }) }, post);
  assert.equal(out.length, 1);
  const opened = out[0].m;
  assert.equal(opened.t, 'opened'); assert.equal(opened.id, 1);
  assert.deepEqual(opened.textures, [{ name: 'K1', width: 2, height: 2, format: TEXTURE_FORMAT.RGBA32 }, { name: 'K2', width: 4, height: 4, format: TEXTURE_FORMAT.DXT5 }]);
  assert.ok(opened.textures.every((x) => !('rgba' in x) && !('data' in x)), 'the index carries no pixels and no closures');
  assert.equal(opened.textAssets.length, 1); assert.equal(opened.textAssets[0].name, 'Seasons.dfmod');
  assert.ok(opened.textAssets[0].bytes instanceof Uint8Array);
  assert.deepEqual(out[0].t, [opened.textAssets[0].bytes.buffer], 'the text assets cross by transfer');
  handle({ t: 'rgba', id: 2, name: 'K1' }, post);
  const img = out[1].m.image;
  assert.equal(out[1].m.id, 2);
  assert.deepEqual([img.width, img.height], [2, 2]);
  assert.deepEqual([...img.data], [30, 31, 32, 33, 40, 41, 42, 43, 10, 11, 12, 13, 20, 21, 22, 23], 'the decoder\'s top-down rows, as the reader answers them on this thread');
  assert.deepEqual(out[1].t, [img.data.buffer], 'the pixels cross by transfer');
  assert.equal(img.data.buffer.byteLength, 16, 'a buffer of exactly the pixels, not the reader\'s block');
  handle({ t: 'rgba', id: 3, name: 'nope' }, post);
  assert.deepEqual(out[2].m, { t: 'rgba', id: 3, image: null });
  handle({ t: 'what', id: 4 }, post);
  assert.equal(out[3].m.t, 'error'); assert.equal(out[3].m.id, 4); assert.match(out[3].m.message, /unknown message "what"/);
  handle({ t: 'open', id: 5, bytes: new Uint8Array([1, 2, 3]) }, post);
  assert.equal(out[4].m.t, 'error'); assert.equal(out[4].m.id, 5); assert.match(out[4].m.message, /not a UnityFS archive/);
  handle({ t: 'close', id: 6 }, post);
  assert.equal(out.length, 5, 'close answers nothing');
  handle({ t: 'rgba', id: 7, name: 'K1' }, post);
  assert.deepEqual(out[5].m, { t: 'rgba', id: 7, image: null }, 'closed: nothing carries the name');
});

test('DW1 client: over a worker the bytes cross as a COPY (the caller\'s survive), the index is the worker\'s, rgba is one ask per name with the pixels back, close terminates', async () => {
  const w = fakeWorker();
  const bytes = testBundle({ lz4: true });
  const b = await openUnityBundle(bytes, { workerFactory: () => w });
  assert.equal(b.onThread, false);
  assert.equal(w.posted[0].msg.t, 'open');
  assert.notEqual(w.posted[0].msg.bytes.buffer, bytes.buffer, 'a copy');
  assert.deepEqual(w.posted[0].transfer, [w.posted[0].msg.bytes.buffer], 'the copy\'s buffer is what transfers');
  assert.equal(bytes.byteLength > 0, true, 'the caller\'s bytes are intact for the fallback');
  assert.equal(b.textAssets[0].name, 'Seasons.dfmod');
  assert.equal(JSON.parse(b.textAssets[0].text).GUID.length > 0, true, 'text decodes on this side');
  assert.deepEqual(b.textures.map((t) => t.name), ['K1', 'K2']);
  const img = await b.rgba('K1');
  assert.deepEqual([img.width, img.height, [...img.data].slice(0, 4)], [2, 2, [30, 31, 32, 33]]);
  assert.equal(await b.rgba('nope'), null);
  assert.equal(w.posted.filter((p) => p.msg.t === 'rgba').length, 2, 'one ask per name');
  b.close();
  assert.equal(w.posted.at(-1).msg.t, 'close');
  assert.equal(w.terminated, 1);
  await assert.rejects(b.rgba('K1'), /closed/, 'after close every ask rejects');
});

test('DW1 client: the same answers on this thread - no Worker, a factory that throws, ?bundlethread=off, a worker that dies before its index - and a worker that dies after it rejects the asks in flight', async () => {
  const bytes = testBundle();
  const here = openBundleHere(bytes);
  assert.equal(here.onThread, true);
  assert.deepEqual(here.textures, [{ name: 'K1', width: 2, height: 2, format: TEXTURE_FORMAT.RGBA32 }, { name: 'K2', width: 4, height: 4, format: TEXTURE_FORMAT.DXT5 }]);
  assert.equal(JSON.parse(here.textAssets[0].text).ModTitle, 'Seasons of the Iliac Bay');
  assert.deepEqual([...(await here.rgba('K1')).data].slice(0, 4), [30, 31, 32, 33]);
  assert.equal(await here.rgba('nope'), null);
  // node: no Worker global, no factory -> here
  assert.equal(typeof globalThis.Worker, 'undefined');
  assert.equal((await openUnityBundle(bytes)).onThread, true);
  // a factory that throws -> here, said once
  const warned = [];
  const warn = console.warn; console.warn = (...a) => warned.push(a.join(' '));
  try {
    const b = await openUnityBundle(bytes, { workerFactory: () => { throw new Error('workers forbidden here'); } });
    assert.equal(b.onThread, true);
    assert.deepEqual(b.textures.map((t) => t.name), ['K1', 'K2']);
    assert.match(warned.join('\n'), /worker unavailable; opening on the main thread.*workers forbidden here/);
    // a worker that dies before the index lands -> here, and the dead one is terminated
    const dying = fakeWorker({ dieOn: 'open' });
    const c = await openUnityBundle(bytes, { workerFactory: () => dying });
    assert.equal(c.onThread, true); assert.equal(dying.terminated, 1);
    assert.deepEqual([...(await c.rgba('K1')).data].slice(0, 4), [30, 31, 32, 33]);
  } finally { console.warn = warn; }
  // dies after: the ask in flight rejects, the door reads that as a miss
  const late = fakeWorker({ dieOn: 'rgba' });
  const d = await openUnityBundle(bytes, { workerFactory: () => late });
  assert.equal(d.onThread, false);
  await assert.rejects(d.rgba('K1'), /the worker died/);
  await assert.rejects(d.rgba('K2'), /the worker died/, 'and every ask after');
  assert.equal(late.terminated, 1);
  // the escape hatch
  assert.equal(bundleThreadDisabled('?bundlethread=off'), true);
  assert.equal(bundleThreadDisabled('?perf&bundlethread=off'), true);
  assert.equal(bundleThreadDisabled('?bundlethread=on'), false);
  assert.equal(bundleThreadDisabled(undefined), false);
});

test('DW1 door: through the client end to end - the bundle found by GUID in a worker, a texture flipped into color32 order, a miss null, a decode failure a miss said once, and a source change closes the worker', async () => {
  const manifest = { ModTitle: DIVERSE_WEAPONS_MOD.title, GUID: DIVERSE_WEAPONS_MOD.guid, ModVersion: DIVERSE_WEAPONS_MOD.version, ModAuthor: DIVERSE_WEAPONS_MOD.author, Files: [] };
  const bytes = unityFs(serializedFile([
    { typeIndex: 0, body: texture2dBody('LONGSWORD.CIF_0-0_Iron', 2, 2, TEXTURE_FORMAT.RGBA32, RGBA_2x2) },
    { typeIndex: 0, body: texture2dBody('BROKEN.CIF_0-0_Iron', 4, 4, TEXTURE_FORMAT.RGBA32, new Uint8Array(8)) },
    { typeIndex: 1, body: textAssetBody('DiverseWeapons.dfmod', JSON.stringify(manifest)) },
  ]), { lz4: true, blockSize: 64 });
  const workers = [];
  const factory = () => { const w = fakeWorker(); workers.push(w); return w; };
  const load = async (name) => (name === `${DFMOD_KEY_PREFIX}DiverseWeapons.dfmod` ? bytes : null);
  try {
    assert.equal(setDiverseWeaponsSources([`${DFMOD_KEY_PREFIX}DiverseWeapons.dfmod`, `${DFMOD_KEY_PREFIX}Seasons.dfmod`], load, { workerFactory: factory }), 1);
    assert.equal(await diverseWeaponsTexturesAttached(), true);
    const b = await diverseWeaponsBundle();
    assert.equal(b.bundle.onThread, false, 'opened in the worker');
    assert.equal(b.manifest.GUID, DIVERSE_WEAPONS_MOD.guid);
    assert.deepEqual([...b.byName.keys()], ['LONGSWORD.CIF_0-0_Iron', 'BROKEN.CIF_0-0_Iron']);
    const img = await diverseWeaponsImage('LONGSWORD.CIF_0-0_Iron');
    assert.deepEqual([img.width, img.height], [2, 2]);
    assert.ok(img.colors instanceof Uint8ClampedArray, 'the port\'s color32 shape');
    assert.deepEqual([...img.colors], [10, 11, 12, 13, 20, 21, 22, 23, 30, 31, 32, 33, 40, 41, 42, 43], 'flipped back into the port\'s bottom-up order (WW3)');
    assert.equal(workers.length, 1);
    assert.equal(workers[0].posted.filter((p) => p.msg.t === 'rgba').length, 1);
    assert.equal(await diverseWeaponsImage('LONGSWORD.CIF_0-0_Iron'), img, 'cached per name');
    assert.equal(await diverseWeaponsImage('KATANA.CIF_0-0_Iron'), null, 'a miss');
    assert.equal(workers[0].posted.filter((p) => p.msg.t === 'rgba').length, 1, 'a name the index lacks never crosses the wire');
    const warned = [];
    const warn = console.warn; console.warn = (...a) => warned.push(a.join(' '));
    try {
      assert.equal(await diverseWeaponsImage('BROKEN.CIF_0-0_Iron'), null, 'a decode failure is a miss');
      assert.match(warned.join('\n'), /\[diverse weapons\] BROKEN\.CIF_0-0_Iron would not decode:.*8 bytes for 4x4/);
    } finally { console.warn = warn; }
    // the same pick again is the same bundle: no close, no second worker
    setDiverseWeaponsSources([`${DFMOD_KEY_PREFIX}DiverseWeapons.dfmod`], load, { workerFactory: factory });
    assert.equal(await diverseWeaponsBundle(), b); assert.equal(workers.length, 1);
    // a new pick (another loader): the old worker is closed and terminated, the next open spawns another
    setDiverseWeaponsSources([`${DFMOD_KEY_PREFIX}DiverseWeapons.dfmod`], async (n) => load(n), { workerFactory: factory });
    await Promise.resolve(); await Promise.resolve();
    assert.equal(workers[0].posted.at(-1).msg.t, 'close'); assert.equal(workers[0].terminated, 1);
    assert.equal((await diverseWeaponsBundle()).bundle.onThread, false);
    assert.equal(workers.length, 2);
    _resetDiverseWeaponsImages();
    await Promise.resolve(); await Promise.resolve();
    assert.equal(workers[1].terminated, 1, 'the test seam closes too');
  } finally { clearDiverseWeaponsSources(); }
});

test('DW1 reader: the blocks stay compressed - a read across block edges is the same bytes as one block, the file\'s `bytes` getter is the whole, a read is a fresh array, the LRU is bounded', () => {
  const objects = [
    { typeIndex: 0, body: texture2dBody('K1', 2, 2, TEXTURE_FORMAT.RGBA32, RGBA_2x2) },
    { typeIndex: 0, body: texture2dBody('K2', 2, 2, TEXTURE_FORMAT.RGBA32, RGBA_2x2.map((v) => v + 100)) },
    { typeIndex: 1, body: textAssetBody('m.dfmod', JSON.stringify({ ModTitle: 'x', GUID: 'y' })) },
  ];
  const cab = serializedFile(objects);
  const one = readUnityFs(unityFs(cab, { lz4: true }));
  for (const blockSize of [7, 64, 100]) {
    const many = readUnityFs(unityFs(cab, { lz4: true, blockSize }));
    assert.equal(many.files[0].size, cab.length);
    assert.deepEqual([...many.files[0].bytes], [...cab], `blockSize ${blockSize}: the whole file`);
    assert.deepEqual([...many.files[0].read(5, 200)], [...cab.subarray(5, 205)], 'a range spanning edges');
    assert.deepEqual([...many.files[0].read(cab.length - 3, 50)], [...cab.subarray(cab.length - 3)], 'short at the end');
    assert.equal(many.files[0].read(cab.length + 10, 4).length, 0, 'past the end: empty');
    assert.throws(() => many.files[0].read(-1, 4), /bad read/);
    const a = many.files[0].read(0, 8); a[0] = 255;
    assert.equal(many.files[0].read(0, 8)[0], cab[0], 'a read is a fresh array, never a view into the cache');
    const b = readUnityBundle(unityFs(cab, { lz4: true, blockSize }));
    assert.deepEqual(b.textures.map((t) => t.name), ['K1', 'K2']);
    assert.deepEqual([...b.textures[1].rgba().data].slice(0, 4), [130, 131, 132, 133], 'an object straddling blocks decodes');
    assert.equal(JSON.parse(b.textAssets[0].text).GUID, 'y');
  }
  assert.deepEqual([...one.files[0].bytes], [...cab]);
  assert.equal(BLOCK_CACHE, 32, 'a few MB of 128 KB blocks');
  assert.ok(!/const uncompressed = new Uint8Array\(total\)/.test(rd('src/formats/unityBundle.js')), 'the whole-stream decompress is gone');
});

test('DW1 spellings: the worker is spelled the way the bundler reads, imports only pure modules, the door reads through the client not the reader, and the pick sites are unchanged', () => {
  const client = rd('src/formats/unityBundleClient.js');
  assert.match(client, /new Worker\(new URL\('\.\/unityBundleWorker\.js', import\.meta\.url\), \{ type: 'module' \}\)/, 'the literal spelling Vite bundles');
  assert.equal((client.match(/new Worker\(new URL\('\.\//g) ?? []).length, 1, 'spelled once');
  assert.match(client, /const copy = bytes\.slice\(\);\n\s+const opened = await ask\(\{ t: 'open', bytes: copy \}, \[copy\.buffer\]\);/, 'a copy crosses, its buffer transferred');
  const worker = rd('src/formats/unityBundleWorker.js');
  const imports = [...worker.matchAll(/^import .* from '([^']+)';/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ['./unityBundle.js'], 'the worker\'s whole import graph is the reader');
  assert.match(worker, /globalThis\.onmessage = \(ev\) => handle\(ev\.data \?\? \{\}, /);
  const door = rd('src/combat/diverseWeaponsAssets.js');
  assert.match(door, /import \{ openUnityBundle \} from '\.\.\/formats\/unityBundleClient\.js';/);
  assert.ok(!/readUnityBundle/.test(door), 'the door never opens on this thread itself');
  assert.match(door, /const img = await b\.bundle\.rgba\(name\); if \(img\) return toColor32\(img\);/, 'the flip is on this side of the wire');
  assert.match(door, /if \(!manifest\) \{ bundle\.close\(\); continue; \}/, 'a bundle that is not a mod is closed, not leaked');
  // Weapon Widget's small bundle keeps its own in-thread door - nothing here reached into it
  assert.match(rd('src/combat/weaponWidgetAssets.js'), /readUnityBundle\(/);
});
