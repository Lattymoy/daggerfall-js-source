// An IndexedDB in memory, for the translation store's tests (L10N3b, L10N6) - moved here from test/systems/l10n3b.test.js.
/** An IndexedDB in memory: open with its upgrade, transactions over named stores, get/put/delete/getAll/getAllKeys
 *  answering on the next turn, a transaction completing after its requests. */
export function memoryIdb() {
  const dbs = new Map();
  const later = (fn) => setTimeout(fn, 0);
  return {
    open(name) {
      const req = {};
      later(() => {
        let db = dbs.get(name);
        const fresh = !db;
        if (fresh) {
          const stores = new Map();
          db = {
            stores,
            objectStoreNames: { contains: (n) => stores.has(n) },
            createObjectStore: (n) => { stores.set(n, new Map()); },
            transaction(names) {
              const tx = { pending: 0 };
              const settle = () => { if (--tx.pending === 0) later(() => tx.oncomplete?.()); };
              const request = (fn) => { const r = {}; tx.pending++; later(() => { r.result = fn(); r.onsuccess?.(); settle(); }); return r; };
              tx.objectStore = (n) => {
                const map = stores.get(n);
                return {
                  get: (k) => request(() => map.get(k)),
                  put: (v, k) => request(() => { map.set(k, structuredClone(v)); }),
                  delete: (k) => request(() => { map.delete(k); }),
                  getAll: () => request(() => [...map.values()]),
                  getAllKeys: () => request(() => [...map.keys()]),
                };
              };
              later(() => { if (tx.pending === 0) tx.oncomplete?.(); });
              void names;
              return tx;
            },
          };
          dbs.set(name, db);
        }
        req.result = db;
        if (fresh) req.onupgradeneeded?.();
        req.onsuccess?.();
      });
      return req;
    },
  };
}
