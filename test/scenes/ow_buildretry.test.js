// BUILD-RETRY (bible/06-Systems/Travel-View.md, BUILD-RETRY under LOAD-OWED; the bug-reports channel, 2026-10-14: "the
// speed randomly drops and gets locked at 1x after traveling for a while"). LOAD-OWED let the Overworld's clock go when
// a pixel's build threw; this is the build that threw. The sweep of the pixel build over the real map
// (tools/pixelBuildSweep.mjs) found no pixel whose build throws on whole data - what throws is a READ that failed, and the
// port kept such a failure as the answer: the texture an archive is read into (scenes/dataPipeline.js getTexture), the
// people's pictures a town's build waits for (scenes/world.js ensurePersonTex) and the store's connection once the
// browser had closed it (scenes/dataSource.js getDb) - one failed read and every later pixel that needed the file threw
// for the rest of the session. And the stream asked for a failed pixel again only at the next crossing that listed it:
// now it asks on its own bounded wait (world/streamingWorld.js BUILD_RETRY_MS). Each run on its real producer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDataPipeline } from '../../src/scenes/dataPipeline.js';
import { DFPalette } from '../../src/formats/dfPalette.js';
import { StreamingWorldState, BUILD_RETRY_MS } from '../../src/world/streamingWorld.js';

const W = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');

/** A TEXTURE file of `n` 1x1 records (test/scenes/fb1004d_placelru.test.js's synthetic archive). */
function textureArchive(n) {
  const recPos = 26 + 20 * n, RECORD_HEADER = 28;
  const bytes = new Uint8Array(recPos + RECORD_HEADER + 256);
  const v = new DataView(bytes.buffer);
  v.setInt16(0, n, true);
  for (let i = 0; i < n; i++) v.setInt32(26 + 20 * i + 2, recPos, true);
  v.setInt16(recPos + 4, 1, true); v.setInt16(recPos + 6, 1, true);
  v.setUint32(recPos + 10, 256, true); v.setUint32(recPos + 14, RECORD_HEADER, true); v.setUint16(recPos + 20, 1, true);
  bytes[recPos + RECORD_HEADER] = 5;
  return bytes;
}

test('BUILD-RETRY, the texture: A READ THAT FAILED IS NO ANSWER - an archive whose read threw once is read again at the next ask, and every ask after a good read is the one file (it failed every later ask without reading, so every pixel of that climate threw for the session) (mutant: the failure kept)', async () => {
  const palette = new DFPalette(); palette.makeGrayscale();
  const tex = textureArchive(4);
  let fails = 1, reads = 0;
  const pipe = createDataPipeline({ renderer: { textureMiss: 0 }, arch: null, palette, fetch: async (name) => {
    if (name === 'FLATS.CFG') return new Uint8Array(0);
    reads++;
    if (fails-- > 0) throw new Error(`${name}: the read failed (a dropped fetch)`);
    return tex;
  } });
  await assert.rejects(pipe.getTexture(302), /the read failed/, 'the failed read is said to its asker');
  const t = await pipe.getTexture(302);
  assert.equal(t.recordCount, 4, 'the next ask reads again, and stands');
  assert.equal(reads, 2);
  assert.equal(await pipe.getTexture(302), t, 'one file from then on');
  assert.equal(reads, 2, 'and never read again');
});

test('BUILD-RETRY, the people: a town\'s person pictures whose load failed are loaded again by the next populated pixel (the host\'s own lines, lifted) - kept, one failed archive failed every town\'s build for the session (mutant: the failure kept)', async () => {
  const m = /\n {2}let _personTexLoad = null;\n[\s\S]*?\n {2}const ensurePersonTex = \(\) =>\n[^\n]*\n[^\n]*\);\n/.exec(W);
  assert.ok(m, 'world.js holds ensurePersonTex');
  let fails = 1, asks = 0;
  const getTexture = async (a) => { asks++; if (a === 2 && fails-- > 0) throw new Error(`TEXTURE.${a}: the read failed`); return { a }; };
  const { ensurePersonTex, personTex } = new Function('getTexture', `const personArchives = [1, 2, 3]; const personTex = new Map();${m[0]}return { ensurePersonTex, personTex };`)(getTexture);
  await assert.rejects(ensurePersonTex(), /the read failed/);
  await ensurePersonTex();
  assert.deepEqual([...personTex.keys()].sort(), [1, 2, 3], 'the next town loads them again, and they stand');
  const before = asks;
  await ensurePersonTex();
  assert.equal(asks, before, 'loaded once from then on');
});

/** A fake IndexedDB holding `store`: `connections` the ones opened; `close(c)` is the browser closing one under the
 *  page, `hear` whether its `close` event is fired (the read may come first and meet a closing connection). */
function fakeIndexedDb(store) {
  const connections = [];
  const closingError = () => { const e = new Error('Failed to execute \'transaction\' on \'IDBDatabase\': The database connection is closing.'); e.name = 'InvalidStateError'; return e; };
  return {
    connections,
    close(c, hear = true) { c.closed = true; if (hear) c.onclose?.(); },
    open() {
      const req = {};
      queueMicrotask(() => {
        const c = {
          closed: false, onclose: null, objectStoreNames: { contains: () => true },
          transaction() {
            if (c.closed) throw closingError();
            return { objectStore: () => ({ get(key) { const r = {}; queueMicrotask(() => { r.result = store.get(key) ?? null; r.onsuccess?.(); }); return r; } }) };
          },
        };
        connections.push(c);
        req.result = c;
        req.onsuccess?.();
      });
      return req;
    },
  };
}

test('BUILD-RETRY, the store: A CONNECTION THE BROWSER CLOSED IS NEVER ASKED AGAIN - the next read opens another and reads the stored file, whether the close was heard first or the read met the closing connection (it read on the dead connection, fell through to the server - which on the deployed site holds no game data - and every file not yet read failed for the session) (mutants: the close unheard, the closing read not asked again)', async (t) => {
  const store = new Map([['TEXTURE.001', new Uint8Array([1]).buffer], ['TEXTURE.002', new Uint8Array([2]).buffer], ['TEXTURE.003', new Uint8Array([3]).buffer],
    ['mw-arms', new TextEncoder().encode(JSON.stringify({ key: 'mw-arms', value: 42 })).buffer]]);
  const idb = fakeIndexedDb(store);
  const had = { indexedDB: globalThis.indexedDB, fetch: globalThis.fetch };
  let served = 0;
  globalThis.indexedDB = idb;
  globalThis.fetch = async () => { served++; return { ok: false, status: 404 }; };   // the deployed site: no game data on the server
  t.after(() => { globalThis.indexedDB = had.indexedDB; globalThis.fetch = had.fetch; });
  const { getBytes, loadDerivedJson } = await import('../../src/scenes/dataSource.js');
  assert.deepEqual([...await getBytes('TEXTURE.001')], [1], 'read from the store');
  idb.close(idb.connections[0]);   // the browser closes it, and says so
  assert.equal(await loadDerivedJson('mw-arms'), 42, 'every door of the store opens another connection - not the game data\'s alone');
  assert.deepEqual([...await getBytes('TEXTURE.002')], [2], 'the next read reads the store');
  assert.equal(idb.connections.length, 2);
  idb.close(idb.connections[1], false);   // closing, its close not yet heard: the read meets it
  assert.deepEqual([...await getBytes('TEXTURE.003')], [3], 'a read that meets a closing connection asks again on a new one');
  assert.equal(idb.connections.length, 3);
  assert.equal(served, 0, 'never the server');
});

test('BUILD-RETRY, the stream\'s law: A PIXEL WHOSE BUILD THREW IS ASKED FOR AGAIN BY THE STREAM ITSELF - at BUILD_RETRY_MS after each failure (2, 4, 8, 16, 32 s), taken back on its books (so the land is owed while it builds again: LOAD-OWED), nearest first, never while a crossing\'s ask stands and never out of the grid; past the fifth, only a crossing that lists it; standing forgets it, a new grid forgets all (mutants: never asked again, asked at once, out of the grid, unbounded)', () => {
  assert.deepEqual(BUILD_RETRY_MS, [2000, 4000, 8000, 16000, 32000]);
  const s = new StreamingWorldState(3);
  s.init(500, 250);
  const P = [502, 250], Q = [501, 250];
  s.fail(...P, 0);
  s.fail(...Q, 0);
  assert.equal(s.loaded.has('502,250'), false, 'let go');
  assert.deepEqual(s.retryDue(1999), [], 'not before its wait');
  assert.deepEqual(s.retryDue(2000), [{ px: 501, py: 250 }, { px: 502, py: 250 }], 'then both, nearest first');
  assert.equal(s.loaded.has('502,250'), true, 'back on the books: owed while it builds');
  assert.deepEqual(s.retryDue(99999), [], 'asked once a wait');
  s.stood(...Q);
  assert.equal(s.failed.has('501,250'), false, 'standing forgets it');
  // P fails again and again: each wait doubles, five in all
  const asked = [2000];
  let t = 2000;
  for (let i = 1; i < 8; i++) {
    s.fail(...P, t);
    const due = s.failed.get('502,250').at;
    if (!Number.isFinite(due)) break;
    assert.deepEqual(s.retryDue(due - 1), [], 'not early');
    assert.equal(s.retryDue(due).length, 1);
    asked.push(due);
    t = due;
  }
  assert.deepEqual(asked.map((a, i) => (i ? a - asked[i - 1] : a)), [2000, 4000, 8000, 16000, 32000], 'five asks, the wait doubling');
  assert.equal(s.failed.get('502,250').at, Infinity, 'past the fifth the stream waits for a crossing');
  assert.deepEqual(s.retryDue(1e12), []);
  // a crossing lists it again, as ever; one out of the grid is forgotten
  const r = s.update([3 * 819.2 + 1, 0, 409.6]);   // three pixels east: 503 - 502 is still in the grid
  assert.ok(r.load.some((p) => p.px === 502 && p.py === 250), 'the crossing lists it, as before');
  s.fail(...P, 0);
  s.init(900, 250);
  assert.equal(s.failed.size, 0, 'a new grid asks every pixel afresh');
  const far = new StreamingWorldState(1);
  far.init(500, 250);
  far.fail(501, 250, 0);
  far.update([819.2 * 3 + 1, 0, 409.6]);   // three pixels east: 501 is out of a one-pixel grid about 503
  assert.deepEqual(far.retryDue(2000), [], 'out of the grid: not asked');
  assert.equal(far.failed.size, 0, 'and forgotten');
});

test('BUILD-RETRY, the host: the pump\'s catch lets a failed pixel go to the stream\'s wait and the frame\'s line asks for it again - a pixel whose first build threw stands after the first wait with the traveller still where they were (no crossing); one that cannot be built is asked five times more and no more (the host\'s own pump and frame line, lifted)', async () => {
  const pump = /\n {2}async function pump\(\) \{\n[\s\S]*?\n {2}\}\n/.exec(W);
  const retry = /\n {4}if \(state\.failed\.size\) queue\.push\(\.\.\.state\.retryDue\(performance\.now\(\)\)\);[^\n]*\n/.exec(W);
  assert.ok(pump && retry, 'world.js holds the pump and the frame\'s retry line');
  const run = (failsFor) => {
    const clock = { t: 0 };
    const state = new StreamingWorldState(3);
    const built = new Map();
    const queue = [];
    for (const p of state.init(500, 250)) if (p.px !== 502 || p.py !== 250) built.set(`${p.px},${p.py}`, p);
    queue.push({ px: 502, py: 250 });
    const counts = { builds: 0 };
    const buildPixel = async (px, py) => {
      const k = `${px},${py}`;
      if (built.has(k)) return built.get(k);
      counts.builds++;
      if (counts.builds <= failsFor) throw new Error(`pixel ${k}: a read failed`);
      built.set(k, { px, py });
      return built.get(k);
    };
    const s = { state, built, queue, buildPixel, destroyPixel: (px, py) => built.delete(`${px},${py}`), _wodArrival: { keys: new Set() }, console: { error() {} }, performance: { now: () => clock.t } };
    const frame = new Function('s', `let { state, built, queue, buildPixel, destroyPixel, _wodArrival, console, performance } = s;
      let building = false, _streamSince = null;
      ${pump[0]}
      return () => {${retry[0]}    pump();
      };`)(s);
    return { clock, state, built, counts, frame };
  };
  const settle = () => new Promise((r) => setImmediate(r));
  const once = run(1);
  for (let i = 0; i < 40; i++) { once.clock.t = i * 100; once.frame(); await settle(); }   // four seconds of frames at 10 a second
  assert.equal(once.built.has('502,250'), true, 'a read that failed once: the pixel stands after the stream\'s first wait');
  assert.equal(once.counts.builds, 2);
  assert.equal(once.state.failed.size, 0, 'its failure forgotten');
  const never = run(Infinity);
  for (let i = 0; i < 1200; i++) { never.clock.t = i * 100; never.frame(); await settle(); }   // two minutes
  assert.equal(never.counts.builds, 1 + BUILD_RETRY_MS.length, 'a pixel that cannot be built: its own build and five asks, no more');
  assert.equal(never.state.loaded.has('502,250'), false, 'let go - nothing owed, so nothing holds the clock (LOAD-OWED)');
});
