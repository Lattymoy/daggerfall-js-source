// POI-KEPT (2026-10-27): the POI feed's kept copy on each page. The desktop app serves the game over `dagger://`, where
// Chromium opens no Cache Storage (`caches.open` rejects), so the copy goes to IndexedDB there; every other page keeps
// the Cache API. Run against small fakes of both stores - the real ones are a browser's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPoiFeed, idbPoiCache, pagePoiCache, POI_FEED_CACHE_KEY } from '../../src/poi/poiFeed.js';

/** An IndexedDB with one database per name and one store per database, answering on the next tick as the real one does. */
function fakeIndexedDB() {
  /** @type {Map<string, Map<string, Map<any, any>>>} */
  const dbs = new Map();
  const answer = (value) => {
    const req = { result: value, onsuccess: null, onerror: null };
    setTimeout(() => req.onsuccess?.());
    return req;
  };
  return {
    dbs,
    open(name) {
      const isNew = !dbs.has(name);
      if (isNew) dbs.set(name, new Map());
      const stores = dbs.get(name);
      const db = {
        createObjectStore(s) { stores.set(s, new Map()); },
        close() {},
        transaction(s) {
          const rows = stores.get(s);
          return { objectStore: () => ({ get: (k) => answer(rows.get(k)), put: (v, k) => { rows.set(k, v); return answer(k); } }) };
        },
      };
      const req = { result: db, onupgradeneeded: null, onsuccess: null, onerror: null, onblocked: null };
      setTimeout(() => { if (isNew) req.onupgradeneeded?.(); req.onsuccess?.(); });
      return req;
    },
  };
}

test('POI-KEPT: the IndexedDB copy gives back the bytes it was given, and nothing for a key never kept', async () => {
  const idb = fakeIndexedDB();
  const cache = idbPoiCache(idb);
  await cache.put('poi:a:x', new Uint8Array([1, 2, 3]));
  assert.deepEqual(Array.from(await cache.get('poi:a:x')), [1, 2, 3]);
  assert.equal(await cache.get('poi:a:y'), null);
  assert.ok(idb.dbs.get('dagger-poi')?.has('kept'), 'its own database, not the roads\'');
  assert.equal(idbPoiCache(undefined), null, 'no IndexedDB is no kept copy, not an error');
});

test('POI-KEPT: a feed kept in IndexedDB at one start is stood at the next before the service answers', async () => {
  const idb = fakeIndexedDB();
  const base = () => 'https://acct.test';
  const doc = { v: 7, pois: [] };
  const fetch = async () => ({ status: 200, ok: true, text: async () => JSON.stringify(doc), headers: { get: () => '"poi-7"' } });
  const first = createPoiFeed({ base, fetch, cache: idbPoiCache(idb), log: null });
  await first.start();
  await first.tick(0);
  await new Promise((r) => setTimeout(r, 10));   // the kept copy's put is not awaited by the ask
  assert.ok(await idbPoiCache(idb).get(POI_FEED_CACHE_KEY), 'the feed was kept');
  const never = async () => { throw new Error('offline'); };
  const second = createPoiFeed({ base, fetch: never, cache: idbPoiCache(idb), log: null });
  await second.start();
  assert.equal(second.version(), 7, 'the kept feed stands with no network');
});

test('POI-KEPT: dagger:// keeps the copy in IndexedDB, every other page in the Cache API', () => {
  const saved = { caches: globalThis.caches, indexedDB: globalThis.indexedDB };
  try {
    globalThis.indexedDB = /** @type {any} */ (fakeIndexedDB());
    globalThis.caches = /** @type {any} */ ({ open: async () => { throw new Error('the Cache API was used'); } });
    const desktop = pagePoiCache('dagger:');
    const browser = pagePoiCache('https:');
    assert.ok(desktop && browser);
    return Promise.all([
      desktop.get('k').then((v) => assert.equal(v, null, 'dagger:// never opens CacheStorage')),
      assert.rejects(browser.get('k'), /the Cache API was used/, 'https: opens CacheStorage'),
    ]);
  } finally {
    globalThis.caches = saved.caches;
    globalThis.indexedDB = saved.indexedDB;
  }
});
