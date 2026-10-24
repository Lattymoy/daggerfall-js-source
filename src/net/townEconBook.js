// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TOWN-ECON TE2 (2026-10-18, Mac: "Everything"; bible/06-Systems/Town-Economy-Arc.md section 4) - THIS DEVICE'S HALF
// OF THE PLAYERS' SHARE:
//   - THE SHARES: every town's players' share as the account service answers it (/v1/towns/econ), read once a
//     TOWN_ECON_KEPT_S and held, synchronous to its readers (systems/town/townEcon.js) - the chapter sheet's shape
//     (net/chapterSheet.js), stopped by an account's refusal;
//   - THE FOOTSTEPS: the relay's signed Watch ticks (net/online.js onWatch) kept on the device where they stand in a
//     town with an economy - EVERY town's pixel, not a seat's alone (the seats keep theirs in net/townSeatBook.js) - and
//     claimed (/v1/towns/watch) TOWN_WATCH_CLAIM_MAX at a time, or the oldest after TOWN_ECON_CLAIM_EVERY_MS;
//   - THE REGISTRY: the town this client walks into reported once a UTC day (/v1/towns/witness) - its map id, pixel,
//     region and location index - until the service has counted it or knows it. AUDIT TOWN-ECON 2 SVC-1: with the relay's
//     Watch tick that stood this account at the town's pixel (a walk's proof): a town walked into before its first tick
//     there waits for it;
//   - SEA-TRADE (section 8): a captain's dealing at a port's exchange, vouched by the newest Watch tick unspent that stood
//     them at the port (TOWN_SEA_REACH_PX of it, TOWN_SEA_TICK_S old at most) - the tick kept, or held for the claim
//     where it stands beside the town's pixel, and flagged `sea` in the claim. One tick vouches one dealing.
// Online only: the world host builds none offline.
// ═══════════════════════════════════════════════════════════════════
import { readWatchReceipt } from './watchReceipt.js';
import { jittered } from './backoff.js';   // a failed claim's wait, jittered as every book's is
import { TOWN_WATCH_CLAIM_MAX, TOWN_ECON_KEPT_S, TOWN_SEA_REACH_PX, TOWN_SEA_TICK_S, townReportOf } from './townEconLaw.js';
import { turnedDayOf } from './dayTurn.js';   // DAY-TURN

/** Where the device keeps the ticks it holds: [{ r, s, i, e, sea? }] (`sea` a tick that vouches a dealing). */
export const TOWN_ECON_WATCH_KEY = 'townecon.watch';
/** The most it holds - a day offline walking keeps the newest. */
export const TOWN_ECON_WATCH_HELD_MAX = 60;
/** A claim waits for a claim's worth, or this long for the oldest. */
export const TOWN_ECON_CLAIM_EVERY_MS = 10 * 60_000;
/** A failed claim's first wait, doubling to TOWN_ECON_CLAIM_EVERY_MS. */
export const TOWN_ECON_RETRY_MS = 30_000;
/** Where the device keeps the day it last reported each town: { [mapId]: UTC day } (TOWN_ECON_DONE past it, never again). */
export const TOWN_ECON_REPORTED_KEY = 'townecon.towns';
export const TOWN_ECON_REPORTED_MAX = 200;
export const TOWN_ECON_DONE = 1_000_000;
/** The answers that say the towns are not this account's to read or report - asked no more this page (AUDIT TOWN-ECON 2
 *  SVC-7: and the doors shut by the service's switch). */
export const TOWN_ECON_STOPS = Object.freeze(['towns-need-account', 'no-session', 'auth', 'towns-closed']);
/** AUDIT TOWN-ECON 2 CLI-4: how often a reader's ask looks whether a claim is due - a tick waits no longer for the next. */
export const TOWN_ECON_DUE_LOOK_MS = 30_000;
/** SEA-TRADE: the newest ticks this page has seen at any pixel - a port's quay may stand beside its town's pixel. */
export const TOWN_SEA_SEEN_MAX = 8;
/** A claim answered with these lets its ticks go - their fate is the service's. */
const WATCH_SETTLED = Object.freeze(['bad-watch', 'towns-need-account']);

/**
 * THE TOWN BOOK.
 * @param {{ door: { econ: () => Promise<any>, witness: (town: any, receipt: string) => Promise<any>, watch: (receipts: string[], sea?: number[]) => Promise<any> },
 *   storage?: any, nowMs?: () => number, me?: () => (string|null), isTownPixel?: (x: number, y: number) => boolean,
 *   relayNowS?: () => (number|null), rand?: () => number, turnMs?: number }} o
 *   `me` the signed-in account, `isTownPixel` whether a town with an economy stands at a map pixel, `relayNowS` the
 *   relay's clock (a tick's life is the relay's), `turnMs` this page's moment past midnight (DAY-TURN, net/dayTurn.js)
 */
export function createTownEconBook({ door, storage = null, nowMs = () => Date.now(), me = () => null, isTownPixel = () => false, relayNowS = () => null, rand = Math.random, turnMs = 0 }) {
  // ── the shares ──
  /** @type {Map<number, number>} */
  let shares = new Map();
  let readAt = -Infinity, busy = false, stopped = false, heard = false;
  const refresh = () => {
    if (stopped || busy || nowMs() - readAt < TOWN_ECON_KEPT_S * 1000) return false;
    busy = true;
    readAt = nowMs();
    Promise.resolve().then(() => door.econ()).then((r) => {
      if (r?.ok && Array.isArray(r.data?.towns)) {
        /** @type {Map<number, number>} */
        const next = new Map();
        for (const t of r.data.towns) if (Array.isArray(t) && Number.isSafeInteger(t[0]) && Number.isFinite(t[1]) && t[1] > 0) next.set(t[0] >>> 0, t[1]);
        shares = next;
        heard = true;
      } else if (TOWN_ECON_STOPS.includes(r?.error)) { stopped = true; heard = true; shares = new Map(); }
    }, () => { /* a read that failed is asked again at the next keeping */ }).finally(() => { busy = false; });
    return true;
  };

  // ── the footsteps ──
  /** @typedef {{ r: string, s: string, i: number, e: number, sea?: true }} HeldTick */
  /** @type {HeldTick[] | null} */
  let watchList = null;
  let watchBusy = false, watchFails = 0, watchRetryAt = -Infinity, watchStopped = false;
  const watchHeld = () => {
    if (watchList) return watchList;
    watchList = [];
    try {
      const v = JSON.parse(storage?.getItem?.(TOWN_ECON_WATCH_KEY) ?? 'null');
      if (Array.isArray(v)) {
        watchList = v.filter((w) => w && typeof w.r === 'string' && typeof w.s === 'string' && Number.isSafeInteger(w.i) && Number.isSafeInteger(w.e)).slice(-TOWN_ECON_WATCH_HELD_MAX)
          .map((w) => ({ r: w.r, s: w.s, i: w.i, e: w.e, ...(w.sea === true ? { sea: /** @type {true} */ (true) } : {}) }));
      }
    } catch { /* a bad key reads as none */ }
    return watchList;
  };
  const writeWatch = (/** @type {HeldTick[]} */ list) => {
    watchList = list.slice(-TOWN_ECON_WATCH_HELD_MAX);
    try { storage?.setItem?.(TOWN_ECON_WATCH_KEY, JSON.stringify(watchList)); } catch { /* this page keeps them */ }
  };
  const alive = (/** @type {{ e: number }} */ w, /** @type {number|null} */ t) => t == null || w.e > t;
  const mine = () => { const who = me(), t = relayNowS(); return watchHeld().filter((w) => w.s === who && alive(w, t)); };
  const due = () => {
    if (watchBusy || watchStopped || nowMs() < watchRetryAt) return false;
    const held = mine();
    if (!held.length) return false;
    const t = relayNowS();
    const oldest = Math.min(...held.map((w) => w.i)) * 1000;
    return held.length >= TOWN_WATCH_CLAIM_MAX || (t == null ? nowMs() : t * 1000) - oldest >= TOWN_ECON_CLAIM_EVERY_MS;
  };

  /** AUDIT TOWN-ECON 2 SVC-5: the pixels whose footsteps the service said full today (`full`) - `"x,y"` -> the UTC day. */
  const fullAt = new Map();
  let dueLookAt = -Infinity;

  // ── SEA-TRADE: the ticks seen, and those spent vouching a dealing ──
  /** @type {Array<{ r: string, s: string, x: number, y: number, i: number, e: number }>} */
  const seen = [];
  /** @type {Set<string>} */
  const seaSpent = new Set();

  // ── the registry ──
  /** @type {Record<string, number> | null} */
  let reported = null;
  let witnessStopped = false;
  const table = () => {
    if (reported) return reported;
    reported = {};
    try {
      const v = JSON.parse(storage?.getItem?.(TOWN_ECON_REPORTED_KEY) ?? 'null');
      if (v && typeof v === 'object' && !Array.isArray(v)) reported = v;
    } catch { /* a bad key reads as none */ }
    return /** @type {Record<string, number>} */ (reported);
  };
  // AUDIT TOWN-ECON 2 CLI-3: the newest kept by its day - a town done (TOWN_ECON_DONE past its day) outranked today's
  // row by its raw number, and past TOWN_ECON_REPORTED_MAX done towns today's was cut as it was written
  const writeTable = (/** @type {Record<string, number>} */ t) => {
    reported = Object.fromEntries(Object.entries(t).sort((a, b) => (b[1] % TOWN_ECON_DONE) - (a[1] % TOWN_ECON_DONE)).slice(0, TOWN_ECON_REPORTED_MAX));
    try { storage?.setItem?.(TOWN_ECON_REPORTED_KEY, JSON.stringify(reported)); } catch { /* this page keeps it */ }
  };
  const dayNow = () => turnedDayOf(nowMs(), turnMs);   // DAY-TURN: once a day, the day turned at this page's moment
  /** AUDIT TOWN-ECON 2 SVC-1: the towns walked into and waiting for a tick at their pixel, by map id. */
  /** @type {Map<number, any>} */
  const waiting = new Map();
  /** The newest tick this page has of the signed-in account's at a pixel, alive, or null. @param {number} x @param {number} y */
  const tickAt = (x, y) => {
    const who = me(), t = relayNowS();
    const all = [...watchHeld(), ...seen].filter((w) => w.s === who && alive(w, t));
    const at = all.filter((w) => { const c = readWatchReceipt(w.r); return !!c && c.x === x && c.y === y; });
    return at.sort((a, b) => b.i - a.i)[0]?.r ?? null;
  };
  /** A town's report sent with its tick, once a UTC day: the day marked before it is asked. */
  const sendWitness = async (/** @type {any} */ t, /** @type {string} */ receipt) => {
    const tab = table();
    tab[String(t.map)] = dayNow();
    writeTable(tab);
    let r = null;
    try { r = await door.witness(t, receipt); } catch { /* the next day asks again */ }
    if (TOWN_ECON_STOPS.includes(r?.error) || (r?.ok && r.data?.why === 'young')) witnessStopped = true;
    // AUDIT TOWN-ECON 2 CLI-3: the table as it stands now - a report sent while this one waited marked its own town there
    const done = r?.ok && (r.data?.confirmed === true || r.data?.why === 'known' || r.data?.why === 'struck' || (r.data?.counted === true && r.data?.why !== 'taken'));
    if (done) { const now = table(); now[String(t.map)] = TOWN_ECON_DONE + dayNow(); writeTable(now); }
    return true;
  };

  const book = {
    refresh,
    /** A TOWN'S PLAYERS' SHARE as last read (0 for none, and until the first read answers) - and the next read asked
     *  when the keeping has passed. @param {unknown} mapId */
    shareOf(mapId) {
      refresh();
      // AUDIT TOWN-ECON 2 CLI-4: a claim waits on no tick - the oldest's time looked at by every reader, now and then
      if (nowMs() - dueLookAt >= TOWN_ECON_DUE_LOOK_MS) { dueLookAt = nowMs(); if (due()) book.claim(); }
      return mapId == null || !Number.isFinite(Number(mapId)) ? 0 : shares.get(Number(mapId) >>> 0) ?? 0;
    },
    get stopped() { return stopped; },
    /** AUDIT TOWN-ECON 2 CLI-1: whether the shares have been answered (read, or refused for good) - a band before it is
     *  the TE1 terms' alone. */
    get heard() { return heard; },
    /** THE WATCH'S TICK KEPT (net/online.js onWatch): a signed receipt for the signed-in account, in a town's pixel,
     *  still alive by the relay's clock - and a claim's worth claimed. Answers whether it was kept. @param {unknown} r */
    keepWatch(r) {
      const c = readWatchReceipt(r);
      const t = relayNowS();
      if (watchStopped || !c || !c.signed || c.s !== me() || (t != null && c.e <= t)) return false;
      if (!seen.some((w) => w.r === r)) seen.push({ r: /** @type {string} */ (r), s: c.s, x: c.x, y: c.y, i: c.i, e: c.e });
      if (seen.length > TOWN_SEA_SEEN_MAX) seen.splice(0, seen.length - TOWN_SEA_SEEN_MAX);
      // AUDIT TOWN-ECON 2 SVC-1: a town walked into before its first tick there is reported with this one
      for (const [map, t] of waiting) if (t.px === c.x && t.py === c.y) { waiting.delete(map); if (!witnessStopped) sendWitness(t, /** @type {string} */ (r)); }
      if (!isTownPixel(c.x, c.y)) return false;
      if (fullAt.get(`${c.x},${c.y}`) === dayNow()) return false;   // AUDIT TOWN-ECON 2 SVC-5: its footsteps full today
      const list = watchHeld().filter((w) => alive(w, t));
      if (list.some((w) => w.r === r)) return false;
      list.push({ r: /** @type {string} */ (r), s: c.s, i: c.i, e: c.e });
      writeWatch(list);
      if (due()) book.claim();
      return true;
    },
    /** How many ticks this device holds for the signed-in account. */
    watchHeldCount: () => mine().length,
    /** SEA-TRADE: A CAPTAIN'S DEALING at the exchange of the port at map pixel (px, py) (scenes/harbourOffice.js buyGood,
     *  sellGood): the newest tick unspent for the signed-in account within TOWN_SEA_REACH_PX of it and TOWN_SEA_TICK_S
     *  old flagged `sea` - held already, or held now (a quay beside its town's pixel) - and a claim's worth claimed.
     *  Answers whether a tick vouched it. @param {number} px @param {number} py */
    seaDeal(px, py) {
      if (watchStopped || !Number.isSafeInteger(px) || !Number.isSafeInteger(py)) return false;
      const who = me(), t = relayNowS() ?? Math.floor(nowMs() / 1000);
      const list = watchHeld().filter((w) => alive(w, t));
      const near = (/** @type {{ r: string, s: string, i: number, e: number }} */ w) => {
        if (w.s !== who || !alive(w, t) || t - w.i > TOWN_SEA_TICK_S || seaSpent.has(w.r) || list.some((h) => h.r === w.r && h.sea)) return false;
        const c = readWatchReceipt(w.r);
        return !!c && Math.abs(c.x - px) <= TOWN_SEA_REACH_PX && Math.abs(c.y - py) <= TOWN_SEA_REACH_PX;
      };
      const pick = [...list.filter((w) => !w.sea), ...seen].filter(near).sort((a, b) => b.i - a.i)[0];
      if (!pick) return false;
      seaSpent.add(pick.r);
      const held = list.find((w) => w.r === pick.r);
      if (held) held.sea = true;
      else list.push({ r: pick.r, s: pick.s, i: pick.i, e: pick.e, sea: true });
      writeWatch(list);
      if (due()) book.claim();
      return true;
    },
    /** THE KEPT TICKS CLAIMED - the signed-in account's, TOWN_WATCH_CLAIM_MAX at a time, once a claim's worth is held or
     *  the oldest has waited (`force` now). An answer lets the claimed ones go; no answer keeps them, and the next claim
     *  waits the longer the more failures in a row. Answers the service's `{ counted, sea, why }`, or null. */
    async claim({ force = false } = {}) {
      if (watchBusy || watchStopped || (!force && !due())) return null;
      const batch = mine().slice(0, TOWN_WATCH_CLAIM_MAX);
      if (!batch.length) return null;
      watchBusy = true;
      let r;
      const sea = batch.flatMap((w, k) => (w.sea ? [k] : []));   // SEA-TRADE: the ticks that vouch a dealing
      try { r = await door.watch(batch.map((w) => w.r), sea); } catch { r = { ok: false, error: 'offline' }; } finally { watchBusy = false; }
      if (r?.ok || WATCH_SETTLED.includes(r?.error)) {
        const gone = new Set(batch.map((w) => w.r));
        writeWatch(watchHeld().filter((w) => !gone.has(w.r)));
        watchFails = 0; watchRetryAt = -Infinity;
        // a young account's ticks count nothing yet, and a guest's never: asked no more this page
        if ((r?.ok && r.data?.why?.young) || r?.error === 'towns-need-account') watchStopped = true;
        // AUDIT TOWN-ECON 2 SVC-5: the pixels whose footsteps are full today, kept off until the day turns
        if (r?.ok && Array.isArray(r.data?.full)) for (const k of r.data.full) if (typeof k === 'string' && /^\d{1,3},\d{1,3}$/.test(k)) fullAt.set(k, dayNow());
      } else if (TOWN_ECON_STOPS.includes(r?.error)) watchStopped = true;
      else {
        watchFails += 1;
        watchRetryAt = nowMs() + jittered(Math.min(TOWN_ECON_CLAIM_EVERY_MS, TOWN_ECON_RETRY_MS * 2 ** (watchFails - 1)), rand);
      }
      return r?.ok ? r.data : null;
    },
    /** A TOWN WITNESSED - `{ map, px, py, region, location }`, reported once a UTC day until the service counted it, knows
     *  it or struck its map id; a refusal in TOWN_ECON_STOPS, or a young account, stops it for the page. AUDIT TOWN-ECON 2
     *  SVC-1: with the newest tick of this account's at its pixel - none yet, the town waits for one (keepWatch). A town
     *  whose place another town holds (`taken`) is asked again the next day. Answers whether a report was sent.
     *  @param {any} town */
    async witness(town) {
      const t = townReportOf(town);
      if (!t || witnessStopped) return false;
      const at = table()[String(t.map)];
      if (at === dayNow() || at >= TOWN_ECON_DONE) return false;
      const receipt = tickAt(t.px, t.py);
      if (!receipt) { waiting.set(t.map, t); if (waiting.size > 8) waiting.delete(waiting.keys().next().value); return false; }
      waiting.delete(t.map);
      return sendWitness(t, receipt);
    },
  };
  return book;
}

/** AUDIT TOWN-ECON 2 SVC-1: A DEVELOPER'S CHAT WORD (the halls' `/hall`, npcHallBook.js parseHallCommand): `/town audit`
 *  (the confirmed towns of the region the player stands in) or `/town strike <map id>` - `{ op, key? }`, `{ error }` in
 *  words, or null when the line is not /town. NEVER GUARDED HERE (RED1's law): the service asks whether this player may. */
export const TOWN_USAGE = 'Usage: /town audit - the confirmed towns of this region; /town strike <map id> - a false town struck from the registry.';
export function parseTownCommand(/** @type {unknown} */ text) {
  const m = /^\/town(?:\s+([\s\S]*))?$/i.exec(String(text ?? '').trim());
  if (!m) return null;
  const [op, key, ...more] = (m[1] ?? '').trim().split(/\s+/).filter(Boolean);
  const o = String(op ?? '').toLowerCase();
  if (o === 'audit' && key == null) return { op: 'audit' };
  const k = Number(key);
  if (o !== 'strike' || !/^\d+$/.test(key ?? '') || !Number.isSafeInteger(k) || k < 1 || k > 0xffffffff || more.length) return { error: TOWN_USAGE };
  return { op: 'strike', key: k };
}
/** The registry's audit as chat lines: a confirmed town a line - its map id, pixel, place, the accounts that confirmed
 *  it, and FALSE where the town this client's own map holds at that pixel is another (`mapAt(px, py)`, its map id) -
 *  or a line that none is confirmed. */
export function townAuditLines(/** @type {any} */ data, /** @type {(x: number, y: number) => (number|null|undefined)} */ mapAt) {
  const towns = data?.towns ?? [];
  if (!towns.length) return ['No town of this region is confirmed in the registry.'];
  return towns.map((/** @type {any} */ t) => {
    const here = mapAt(t.px, t.py);
    const own = here == null ? 'no town here at that pixel' : (here >>> 0) === t.map ? 'the town here' : `FALSE - the town here is ${here >>> 0}`;
    return `Town ${t.map} at ${t.px},${t.py} (location ${t.location}): ${own}; confirmed by ${(t.by ?? []).join(', ') || 'nobody kept'}`;
  });
}

