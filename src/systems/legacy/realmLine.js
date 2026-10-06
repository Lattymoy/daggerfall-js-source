// @ts-check
// LEGACY7 (2026-10-06, bible/06-Systems/Legacy-Arc.md section 9): THE LINE'S REALM COPY - online, the device's store
// (store.js) is a cache of the account service's (server-account/src/legacy.js). Read at every online boot, before a save
// is restored (`pull`: each line the account holds, its facts merged with the device's both ways - store.js
// mergeFacts, a death only ever added); written after every write of the device's (`push`: past the service's rev - a
// stale write takes the service's facts in and is written again; one in flight at a time, the newest record next);
// waited on before the page goes (`flush`), so a fall, a birth or a switch is the realm's before anyone carries on.
import { readFamily } from './family.js';
import { loadFamily, storeFamily, mergeFacts } from './store.js';
import { realmLineages, realmLineagePut } from '../realmSaves.js';

/** How many times a stale write is merged and tried again before it waits for the next. */
export const PUSH_TRIES = 4;

/**
 * The two copies of one line as one: the newer by rev, the other's facts taken in. Answers the record to keep.
 * @param {any} mine - the device's (or null) @param {any} theirs - the service's (or null)
 */
export function mergeLines(mine, theirs) {
  const a = readFamily(mine), b = readFamily(theirs);
  if (!a || !b) return a ?? b;
  const [base, other] = b.rev > a.rev ? [b, a] : [a, b];
  mergeFacts(base, other);
  base.rev = Math.max(a.rev, b.rev);
  return base;
}

/**
 * @param {{ io: () => any, storage: () => any, list?: typeof realmLineages, put?: typeof realmLineagePut }} deps
 */
export function createRealmLine({ io, storage, list = realmLineages, put = realmLineagePut }) {
  /** @type {Map<string, any>} the newest record each line waits to have written */
  const queued = new Map();
  /** @type {Promise<any> | null} */
  let running = null;
  let lastError = null;

  /** Every line the account holds, into the device's store. Answers `{ ok, ids }` or the service's refusal. */
  async function pull() {
    const r = await list(io());
    if (!r.ok) return r;
    const ids = [];
    for (const row of r.lineages) {
      const theirs = readFamily(row?.record);
      if (!theirs) continue;
      const kept = mergeLines(loadFamily(storage(), theirs.id), theirs);
      if (kept && storeFamily(storage(), kept)) ids.push(kept.id);
    }
    return { ok: true, ids };
  }

  async function drain() {
    while (queued.size) {
      const [id, rec] = queued.entries().next().value;
      queued.delete(id);
      let record = rec;
      let tries = 0;
      for (;;) {
        const r = await put(io(), id, record);
        if (r.ok) { lastError = null; break; }
        if (r.error === 'lineage-stale' && r.data?.record && ++tries < PUSH_TRIES) {
          // the service holds facts this copy lacks (another device of the account): taken in, and written past both
          const merged = mergeLines(record, r.data.record);
          merged.rev = Math.max(record.rev | 0, r.data.rev | 0) + 1;
          storeFamily(storage(), merged);
          record = JSON.parse(JSON.stringify(merged));
          continue;
        }
        lastError = r.error ?? 'server';
        if (!queued.has(id)) queued.set(id, record);   // tried again with the next write, or the next flush
        return;
      }
    }
  }
  const run = () => {
    if (!running) running = drain().finally(() => { running = null; });
    return running;
  };

  return {
    pull,
    /** The device wrote `family`: the realm's copy follows. */
    push(/** @type {any} */ family) {
      if (!family?.id || !io()) return null;
      queued.set(family.id, JSON.parse(JSON.stringify(family)));
      return run();
    },
    /** Everything written so far, written to the realm (or refused). Answers whether nothing waits. */
    async flush() {
      if (running) await running;
      if (queued.size) await run();
      return queued.size === 0;
    },
    /** The last refusal, or null. */
    get error() { return lastError; },
  };
}
