// @ts-check
// RMB-CONTRACTS RMBC1 (2026-10-31, bible/03-World/RMB-Contracts.md): A NEW BUILDING'S KEY IS KEPT, NOT DERIVED. The ledger
// mints a key once for a plot's anchor and keeps it there through every regeneration; an anchor that goes retires its key,
// which is never minted again. A key the account service protects (a home, a hall, a rental, a recall) is neither retired
// nor moved without an explicit migration: the reconcile refuses. Legacy keys are their RMB records' and pass untouched.
// Pure: the inputs are not changed. Not a DFU member.
import { MINTED_KEY_MIN, MINTED_KEY_MAX } from './settlementContract.js';
import { hash32 } from '../blockHash.js';

/**
 * @typedef {import('./settlementContract.js').Building} Building
 * @typedef {{ place: number, next: number, keys: Readonly<Record<string, number>>, retired: readonly number[] }} IdLedger
 * @typedef {{ code: string, key?: number, anchor?: string, why: string }} IdConflict
 */

/** A place's ledger before its first plan. @param {number} place @returns {IdLedger} */
export const emptyIdLedger = (place) => Object.freeze({ place, next: MINTED_KEY_MIN, keys: Object.freeze({}), retired: Object.freeze([]) });

/**
 * RMBC7 (RD-19): A GROWN TOWN'S LEDGER, ITS ANCHORS' OWN. Each anchor's key is a hash of its place and its name in the
 * minted band, probed forward past a taken key in the anchors' sorted order - so a key depends on its anchor alone, a
 * plot added or dropped moves no other, and every client agrees with no ledger shipped.
 * @param {number} place @param {readonly string[]} anchors @returns {IdLedger}
 */
export function anchorLedger(place, anchors) {
  const span = MINTED_KEY_MAX - MINTED_KEY_MIN + 1, taken = new Set(), keys = {};
  let top = MINTED_KEY_MIN - 1;
  for (const a of [...new Set(anchors)].sort()) {
    let k = MINTED_KEY_MIN + (hash32(place >>> 0, 0x5eed, ...[...a].map((char) => char.charCodeAt(0))) % span);
    while (taken.has(k)) k = k === MINTED_KEY_MAX ? MINTED_KEY_MIN : k + 1;
    taken.add(k); keys[a] = k; top = Math.max(top, k);
  }
  return Object.freeze({ place, next: top + 1, keys: Object.freeze(keys), retired: Object.freeze([]) });
}

/** What a ledger must hold: next past every key it ever minted, each anchor's key in the band, none kept and retired. @param {IdLedger} l */
export function ledgerProblems(l) {
  const out = [];
  const kept = Object.values(l?.keys ?? {});
  const all = [...kept, ...(l?.retired ?? [])];
  if (!Number.isSafeInteger(l?.next) || l.next < MINTED_KEY_MIN || l.next > MINTED_KEY_MAX + 1) out.push('next is outside the minted band');
  if (all.some((k) => !Number.isSafeInteger(k) || k < MINTED_KEY_MIN || k >= l.next)) out.push('a key is outside what the ledger minted');
  if (new Set(all).size !== all.length) out.push('a key is kept twice, or kept and retired');
  return out;
}

/** The parts of a building whose change moves it (its owner's yard and rooms hang off them). @param {Building} b */
const standOf = (b) => JSON.stringify([b.pad, b.at, b.yaw, b.lift, b.footprint]);

/**
 * Give a proposed plan's buildings their keys.
 * @param {IdLedger} ledger the place's published ledger
 * @param {readonly Building[]} proposed the new plan's buildings; a non-legacy one's key is ignored and set here
 * @param {{ protectedKeys?: Iterable<number>, published?: readonly Building[] }} [o] the keys the service protects, and
 *   the published plan's buildings, to tell a protected building that moved
 * @returns {{ ok: boolean, buildings: Building[], ledger: IdLedger, minted: number[], retired: number[], conflicts: IdConflict[] }}
 */
export function reconcileBuildingIds(ledger, proposed, { protectedKeys = [], published = [] } = {}) {
  /** @type {IdConflict[]} */ const conflicts = ledgerProblems(ledger).map((why) => ({ code: 'ledger', why }));
  const guarded = new Set(protectedKeys);
  const was = new Map(published.map((b) => [b.key, b]));
  /** @type {Record<string, number>} */ const keys = { ...ledger.keys };
  let next = ledger.next;
  const minted = [], seen = new Set();
  const buildings = proposed.map((b) => {
    if (b.source === 'legacy') return b;
    if (seen.has(b.anchor)) conflicts.push({ code: 'anchor-dup', anchor: b.anchor, why: 'two buildings share an anchor, so one would take the other\'s key' });
    seen.add(b.anchor);
    let key = keys[b.anchor];
    if (key === undefined) {
      if (next > MINTED_KEY_MAX) { conflicts.push({ code: 'keys-spent', anchor: b.anchor, why: 'the place has minted every key of its band' }); return b; }
      key = keys[b.anchor] = next++;
      minted.push(key);
    }
    const before = was.get(key);
    if (guarded.has(key) && before && standOf(before) !== standOf(b)) {
      conflicts.push({ code: 'protected-moved', key, anchor: b.anchor, why: 'a protected building moved: its yard and rooms need an explicit migration' });
    }
    return { ...b, key };
  });
  const retired = [];
  for (const [anchor, key] of Object.entries(keys)) {
    if (seen.has(anchor)) continue;
    if (guarded.has(key)) { conflicts.push({ code: 'protected-removed', key, anchor, why: 'a protected building would be removed: its owner keeps it until a migration moves them' }); continue; }
    delete keys[anchor];
    retired.push(key);
  }
  return {
    ok: conflicts.length === 0, buildings, minted, retired, conflicts,
    ledger: Object.freeze({ place: ledger.place, next, keys: Object.freeze(keys), retired: Object.freeze([...ledger.retired, ...retired]) }),
  };
}
