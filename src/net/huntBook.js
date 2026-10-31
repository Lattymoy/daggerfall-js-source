// @ts-check
// HUNTERS-MARK (2026-10-27; bible/06-Systems/Bounty-Boards.md 12.2): THE HUNT'S BOOK - the character's hunt as the
// account service keeps it (server-account/src/hunts.js), and every paid bounty reported KEPT until the service answers
// it, as the professions book keeps its acts (net/profBook.js): each account and character its own, kept across a
// reload, asked again on the pump's beat, let go once the service has answered it or refused it for good.
import { huntClearOf } from './huntLaw.js';
import { utcDay } from './marksLaw.js';

/** Where the kept reports live (the device's storage), by `account:character`. */
export const HUNT_KEPT_KEY = 'hunt1.kept';
/** The most reports one slot keeps - over an hour of the fastest hunt (tools/huntPace.mjs); the oldest goes first. */
export const HUNT_KEPT_MAX = 32;
/** How often the pump asks the kept reports again, and how long a read of the state stands (ms). HUNT-LEAN: ten
 *  minutes, where it was two - a clear's answer carries the state, so the poll only catches another tab's clears. */
export const HUNT_PUMP_MS = 20_000;
export const HUNT_STATE_MS = 600_000;
/** AUDIT HORIZONTAL F4: how often a guest's book asks again whether the account keeps a rank (a registration opens it). */
export const HUNT_CLOSED_MS = 300_000;
/** The answers a kept report waits through, asked again later: the network, the service's load or fault, a session not
 *  signed yet, a seat this tab does not hold, a hold the judge may lift, a service older than the ledger; AUDIT HORIZONTAL
 *  F7: no session on this device (signed out, or another account's sign-in), as the professions book keeps it. */
export const HUNT_KEEP = Object.freeze([
  'offline',
  'server',
  'rate',
  'maintenance',
  'busy',
  'hunt-rate',
  'progress-play',
  'progress-seat',
  'trade-held',
  'auth',
  'not-found',
  'frozen',
  'no-session',
]);

/** The book in play, for the pages that show the rank (ui/bounty/huntRank.js) - null offline. */
let _book = /** @type {any} */ (null);
export const setHuntBook = (/** @type {any} */ book) => {
  _book = book ?? null;
};
export const huntBook = () => _book;

/**
 * @param {{ door: { account: () => (string|null), state: (c: string) => Promise<any>, clear: (c: string, id: string, region?: number|null) => Promise<any> },
 *   storage?: any, character: () => (string|null), now?: () => number }} o
 */
export function createHuntBook({ door, storage = null, character, now = () => Date.now() }) {
  let state = /** @type {any} */ (null);
  let stateAt = -Infinity;
  let closed = false; // AUDIT HORIZONTAL F4: the service said this account keeps no rank (a guest) - asked again rarely
  let asking = false;
  let pumping = false;
  let pumpAt = -Infinity;
  let memory = /** @type {Record<string, any[]>|null} */ (null);
  const listeners = new Set();
  const tell = () => {
    for (const fn of [...listeners]) {
      try {
        fn(state);
      } catch {
        /* a page's own trouble */
      }
    }
  };
  const slot = () => `${door?.account?.() ?? ''}:${character?.() ?? ''}`;
  const table = () => {
    if (memory) return memory;
    try {
      const t = JSON.parse(storage?.getItem?.(HUNT_KEPT_KEY) ?? 'null');
      return t && typeof t === 'object' && !Array.isArray(t) ? t : {};
    } catch {
      return {};
    }
  };
  const write = (/** @type {Record<string, any[]>} */ t) => {
    try {
      storage?.setItem?.(HUNT_KEPT_KEY, JSON.stringify(t));
      memory = null;
    } catch {
      memory = t;
    }
  };
  const valid = (/** @type {any} */ k) =>
    !!k && typeof k.id === 'string' && (k.region == null || Number.isSafeInteger(k.region));
  /** This slot's kept reports, the ones the clock has passed let go (the service would call them late). */
  const keptOf = () =>
    (Array.isArray(table()[slot()]) ? table()[slot()] : []).filter(
      (k) => valid(k) && !('why' in huntClearOf(k.id, now())),
    );
  /** AUDIT HORIZONTAL F3: a report the account's day was full for (`full`, the service's UTC day) waits for the next. */
  const today = () => utcDay(Math.floor(now() / 1000));
  const waitsDay = (/** @type {any} */ k) => Number.isSafeInteger(k.full) && k.full >= today();
  const setKept = (/** @type {any[]} */ list) => {
    const t = table();
    if (list.length) t[slot()] = list.slice(-HUNT_KEPT_MAX);
    else delete t[slot()];
    write(t);
  };
  const adopt = (/** @type {any} */ data) => {
    if (!data || typeof data !== 'object' || !Number.isSafeInteger(data.clears)) return;
    state = {
      clears: data.clears,
      marks: data.marks ?? 0,
      markDone: data.markDone === true,
      regions: data.regions ?? {},
      account: data.account ?? null,
    };
    stateAt = now();
  };

  /** The service's answers to the kept reports, one at a time; a report the service may answer later stays kept. */
  async function pump() {
    if (pumping || !door || !character?.()) return;
    pumping = true;
    pumpAt = now();
    try {
      for (const k of keptOf().filter((x) => !waitsDay(x))) {
        const r = await door.clear(/** @type {string} */ (character()), k.id, k.region ?? null);
        if (!r?.ok && HUNT_KEEP.includes(r?.error)) break; // the service's to answer later - the rest wait with it
        if (r?.error === 'hunt-need-account') closed = true;
        if (r?.ok && r.data?.why === 'day-full') {
          // AUDIT HORIZONTAL F3: the account's day is full, not the clear refused - every kept report waits for the
          // service's next UTC day, asked again then while its notice is inside the clock's window (keptOf)
          const full = Number.isSafeInteger(r.data?.account?.day) ? r.data.account.day : today();
          setKept(keptOf().map((x) => ({ ...x, full })));
          adopt(r.data);
          break;
        }
        setKept(keptOf().filter((x) => x.id !== k.id));
        if (r?.ok) adopt(r.data);
      }
    } finally {
      pumping = false;
    }
    tell();
  }
  /** The service's word on the character's hunt, asked again once it is stale. */
  async function refresh() {
    if (asking || !door || !character?.()) return state;
    asking = true;
    try {
      const r = await door.state(/** @type {string} */ (character()));
      if (r?.ok) {
        adopt(r.data);
        closed = false;
      }
      if (r?.error === 'hunt-need-account') {
        closed = true;
        state = null;
      } // AUDIT HORIZONTAL F4: a final answer, not a wait
      stateAt = now();
    } finally {
      asking = false;
    }
    tell();
    return state;
  }
  return {
    get state() {
      return state;
    },
    /** AUDIT HORIZONTAL F4: whether the service said this account keeps no hunter's rank (a guest's). */
    get closed() {
      return closed;
    },
    /** A paid bounty reported - kept first, so a page closed before its answer still reports it; a guest's is not. */
    report(/** @type {string} */ id, /** @type {number|null} */ region = null) {
      if (closed || !door || !character?.() || 'why' in huntClearOf(id, now())) return false;
      const list = keptOf().filter((k) => k.id !== id);
      const full = list.find(waitsDay)?.full; // a day already full: this one waits with the rest, unasked
      setKept([
        ...list,
        { id, ...(Number.isSafeInteger(region) ? { region } : {}), ...(full != null ? { full } : {}) },
      ]);
      void pump();
      return true;
    },
    kept: () => keptOf().map((k) => k.id),
    /** AUDIT HORIZONTAL F3: the kept reports waiting for the account's next UTC day. */
    waitingDay: () => keptOf().filter(waitsDay).length,
    pump,
    refresh,
    /** The pump's beat - the kept reports asked again, the state read again when stale (a guest's rarely). */
    tick() {
      const t = now();
      if (!pumping && t - pumpAt >= HUNT_PUMP_MS && keptOf().some((k) => !waitsDay(k))) void pump();
      if (!asking && t - stateAt >= (closed ? HUNT_CLOSED_MS : HUNT_STATE_MS)) void refresh();
    },
    onChange(/** @type {(s: any) => void} */ fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
