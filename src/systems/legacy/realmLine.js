// @ts-check
// LEGACY7 (2026-10-06, bible/06-Systems/Legacy-Arc.md section 9): THE LINE'S REALM COPY - online, the device's store
// (store.js) is a cache of the account service's (server-account/src/legacy.js). Read at every online boot, before a save
// is restored (`pull`: each line the account holds, its facts merged with the device's both ways - store.js
// mergeFacts, a death only ever added); written after every write of the device's (`push`: made from the service's rev
// this device last read or wrote - AUDIT LEGACY III A2, `base` - and past it; a stale write takes the service's facts in
// and is written again; one in flight at a time, the newest record next); waited on before the page goes (`flush`), so
// a fall, a birth or a switch is the realm's before anyone carries on.
// AUDIT LEGACY III O2/P1: A REFUSAL THE RECORD ITSELF EARNED (LINE_REFUSALS - too large, malformed, a model not its
// own, a line past the account's bound) is kept with its reason and said once (`onRefused`), and the line is not sent
// again this session: it was re-queued like a network's and re-sent at every write and flush, for good, unsaid - the
// realm kept the founding copy and the heir's birth was refused for a reason that was not the reason.
import { readFamily } from './family.js';
import { loadFamily, storeFamily, mergeFacts, rekeyClashes } from './store.js';
import { realmLineages, realmLineagePut } from '../realmSaves.js';

/** How many times a stale write is merged and tried again before it waits for the next. */
export const PUSH_TRIES = 4;
/** AUDIT LEGACY III O2/P1: the service's refusals of a record that the same record would earn again - never re-sent. */
export const LINE_REFUSALS = Object.freeze(['body', 'lineage-too-large', 'lineage-model', 'too-many-lineages']);

/**
 * The two copies of one line as one: the newer by rev, the other's facts taken in. Answers the record to keep.
 * AUDIT LEGACY III A3/P3: the realm's ids stand - its births name their person by id (realm_characters.person_id), so
 * the device's persons the realm holds as others move first (store.js rekeyClashes), whichever copy is the newer.
 * @param {any} mine - the device's (or null) @param {any} theirs - the service's (or null)
 */
export function mergeLines(mine, theirs) {
  const a = readFamily(mine), b = readFamily(theirs);
  if (!a || !b) return a ?? b;
  rekeyClashes(a, b);
  const [base, other] = b.rev > a.rev ? [b, a] : [a, b];
  mergeFacts(base, other);
  base.rev = Math.max(a.rev, b.rev);
  return base;
}

/**
 * @param {{ io: () => any, storage: () => any, list?: typeof realmLineages, put?: typeof realmLineagePut,
 *   onRefused?: (id: string, error: string) => void }} deps - `onRefused` a line the realm will not take, said once
 */
export function createRealmLine({ io, storage, list = realmLineages, put = realmLineagePut, onRefused = () => {} }) {
  /** @type {Map<string, any>} the newest record each line waits to have written */
  const queued = new Map();
  /** @type {Map<string, number>} AUDIT LEGACY III A2: the service's rev of each line as this device last read or wrote it */
  const bases = new Map();
  /** @type {Map<string, string>} the record each line last landed as - the same record is never written twice */
  const landed = new Map();
  /** @type {Map<string, string>} AUDIT LEGACY III O2/P1: a line the realm refused for the record's own sake, and why */
  const refused = new Map();
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
      if (Number.isSafeInteger(row?.rev)) bases.set(theirs.id, row.rev);
      const local = loadFamily(storage(), theirs.id);
      const kept = mergeLines(local, theirs);
      // written over the device's copy only as it was read here (store.js: a write since is merged in, never lost)
      if (kept && storeFamily(storage(), kept, local?.rev ?? null)) ids.push(kept.id);
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
        const r = await put(io(), id, record, bases.get(id) ?? null);
        if (r.ok) {
          lastError = null;
          bases.set(id, Number.isSafeInteger(r.data?.rev) ? r.data.rev : record.rev);
          landed.set(id, JSON.stringify(record));
          break;
        }
        if (r.error === 'lineage-stale' && r.data?.record && ++tries < PUSH_TRIES) {
          // the service holds facts this copy lacks (another device of the account): taken in, and written past both -
          // the service's rev the base the next write is made from
          if (Number.isSafeInteger(r.data.rev)) bases.set(id, r.data.rev);
          const merged = mergeLines(record, r.data.record);
          merged.rev = Math.max(record.rev | 0, r.data.rev | 0) + 1;
          storeFamily(storage(), merged, record.rev);   // over the device's copy as it was pushed: a write since is merged in
          record = JSON.parse(JSON.stringify(merged));
          continue;
        }
        lastError = r.error ?? 'server';
        if (LINE_REFUSALS.includes(lastError)) {
          // the record's own refusal: kept, said once, never sent again this session (the next write would earn it too)
          if (!refused.has(id)) { refused.set(id, lastError); try { onRefused(id, lastError); } catch { /* the line goes on */ } }
          queued.delete(id);
          break;
        }
        if (!queued.has(id)) queued.set(id, record);   // the network's: tried again with the next write, or the next flush
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
    /** The device wrote `family`: the realm's copy follows - unless it is the record the realm already holds from here,
     *  or a line the realm refused for the record's own sake. */
    push(/** @type {any} */ family) {
      if (!family?.id || !io() || refused.has(family.id)) return null;
      const text = JSON.stringify(family);
      if (landed.get(family.id) === text && !queued.has(family.id)) return running;
      queued.set(family.id, JSON.parse(text));
      return run();
    },
    /** Everything written so far, written to the realm. Answers whether every line stands there as written - false while
     *  one waits on the network, or one was refused (`error`, `refusalOf`). */
    async flush() {
      if (running) await running;
      if (queued.size) await run();
      return queued.size === 0 && refused.size === 0;
    },
    /** The last refusal, or null. */
    get error() { return lastError; },
    /** AUDIT LEGACY III O2/P1: why the realm will not take line `id` - the record's own refusal - or null. */
    refusalOf: (/** @type {string} */ id) => refused.get(id) ?? null,
    /** Why line `id` does not stand at the realm as last written - its refusal, or the network's word while it waits -
     *  or null when it does. */
    unwrittenOf: (/** @type {string} */ id) => refused.get(id) ?? (queued.has(id) ? lastError ?? 'offline' : null),
  };
}
