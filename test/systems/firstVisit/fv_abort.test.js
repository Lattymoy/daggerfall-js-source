// FIRST-VISIT (bible/07-Rendering/Performance-Priority.md FIRST-VISIT, review of #1292): A WRITE THE STORE REFUSES
// NEVER HOLDS THE GAME. A commit the origin's quota refuses aborts the transaction with no request error; the derived
// store's writes must reject on that abort, and the two callers that were awaiting a write (the port ships' models, the
// ways' land pieces) must return with the answer they built whether the write settles or not.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { keepLandPieces } from '../../../src/systems/travel/landPiecesKept.js';
import { routeGround } from '../../../src/systems/travel/travelRoute.js';

/** An IndexedDB whose every transaction aborts at its commit, as a full quota does: no request error, only `abort`. */
function abortingIndexedDB() {
  const store = { put() {}, delete() {}, getAllKeys() { return {}; } };
  const db = {
    objectStoreNames: { contains: () => true },
    transaction() {
      const tx = { objectStore: () => store, error: null };
      setTimeout(() => tx.onabort?.(), 0);
      return tx;
    },
  };
  return { open() { const req = {}; setTimeout(() => { req.result = db; req.onsuccess?.(); }, 0); return req; } };
}
/** Settles within a second, or answers 'hung'. */
const settles = (p) => Promise.race([p.then(() => 'settled', () => 'rejected'), new Promise((r) => setTimeout(() => r('hung'), 1000))]);

test('FIRST-VISIT abort: the derived store\'s write and sweep reject when the transaction aborts (mutant: no onabort)', async () => {
  globalThis.indexedDB = abortingIndexedDB();
  try {
    const door = await import('../../../src/scenes/dataSource.js');
    assert.equal(await settles(door.storeDerivedValue('fv-test:k', 1)), 'rejected');
    assert.equal(await settles(door.sweepDerived(() => true)), 'rejected');
  } finally { delete globalThis.indexedDB; }
});

const neverSettles = () => ({ async get() { return null; }, set: () => new Promise(() => {}), sweep: () => new Promise(() => {}) });

test('FIRST-VISIT abort: the land\'s pieces are answered while the write is still pending (mutant: the write awaited)', async () => {
  const ground = routeGround(() => 0, () => 30, 10, 16, 8);
  assert.equal(await settles(keepLandPieces(ground, { roads: new Uint8Array(128) }, neverSettles())), 'settled');
});

test('FIRST-VISIT abort: the port ships\' models load while the write is still pending (mutant: the write awaited)', async () => {
  const MODELS = new URL('../../../src/systems/comeSailAway/comeSailAwayModels.js', import.meta.url).href;
  const fileFetch = async (url) => {
    const bytes = readFileSync(fileURLToPath(url));
    return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
  };
  const mod = await import(`${MODELS}?abort=1`);
  const loaded = mod.loadComeSailAwayModels(fileFetch, undefined, { warn() {} }, mod.GALLEON_MODEL_URL, undefined, neverSettles());
  assert.equal(await settles(loaded), 'settled');
  const models = await loaded;
  assert.ok(models?.galleon && models.carrack && models.largeBoat);
});
