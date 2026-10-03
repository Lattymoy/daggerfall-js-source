// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF2b (2026-10-03, Mac: "plus we need to build motherloads") - THE
// MOTHERLODES ON THIS DEVICE (bible/06-Systems/Professions-Arc.md 6, 38;
// the law is net/motherlodeLaw.js, the service's half
// server-account/src/motherlodes.js):
//
//   - TODAY'S THREE, as the service last said them (`/v1/prof/motherlodes`):
//     read on arrival, every MOTHERLODE_READ_MS, at the UTC day's turn and
//     after a strike - each its pixel, its ore, its hours and its strikers;
//     and the one this account found today.
//   - THE WARNING, every client's own from the shared clock (the gate's
//     omen's way, systems/gateOmen.js): MOTHERLODE_WARN_S ahead of a rising
//     - a Motherlode Sense's 30 minutes - a line in the chat; another as it
//     breaks ground. Each said once a session.
//   - THE WATCH: the relay's `k1` receipts this socket is handed (one every
//     two minutes while the account moves in a town's cell - the relay's
//     word on the pixel its pose stands in), the newest kept for each pixel
//     - a strike carries the Motherlode pixel's to the service.
//   - WHERE IT STANDS: a Motherlode risen and not yet spent stands on its
//     pixel (scenes/mineHost.js), so a change - its rising, its going, its
//     twentieth striker, this account's find - asks the host to stand that
//     pixel again (`onChange`).
// ═══════════════════════════════════════════════════════════════════
import { readWatchReceipt } from './watchReceipt.js';
import { motherlodeOpen, motherlodeWarnS, motherlodeWatchOk, MOTHERLODE_STRIKERS, MOTHERLODE_SILVER } from './motherlodeLaw.js';
import { marksText } from './marksLaw.js';

/** The day's Motherlodes read again this often (ms) - their strikers move. */
export const MOTHERLODE_READ_MS = 5 * 60_000;
/** A refused or failed read is asked again this soon (ms). */
export const MOTHERLODE_RETRY_MS = 60_000;
/** The Watch receipts kept: the newest for each of this many pixels. */
export const MOTHERLODE_WATCH_KEPT = 8;
/** A strike's act takes this long at most (s): a receipt is carried only while it will still be fresh at the act's end. */
export const MOTHERLODE_ACT_S = 120;
/** AUDIT SILVER-WAYS D1: the UTC day's turn read spread over this long (ms), each device its own moment in it - every
 *  client turns the day on the one shared clock, and the day's first read picks its Motherlodes. */
export const MOTHERLODE_TURN_SPREAD_MS = 90_000;
/** AUDIT SILVER-WAYS D7: the signed-in account read again this often (ms) - a stored session's parse, never a frame's. */
export const MOTHERLODE_ME_MS = 1000;

/** The words. `where` a region's name, `ore` the ore's. */
export const MOTHERLODE_TEXT = Object.freeze({
  warn: (ore, where, minutes) => `The surveyors report a Motherlode of ${ore} about to break ground in ${where} - in ${minutes} minutes. Look for it on your compass.`,
  risen: (ore, where) => `A Motherlode of ${ore} has broken ground in ${where}. The first ${MOTHERLODE_STRIKERS} miners to strike it each find ${marksText(MOTHERLODE_SILVER)}.`,
  // AUDIT SILVER-WAYS D3: the relay marks a pose that MOVED in its last five minutes (watchReceipt.js watchDue) - a
  // miner standing still at the rock was told to stand, and was never seen
  watch: 'The Watch has not seen you on the Motherlode\'s ground lately. Walk about on it a moment - the Watch marks those on the move, every two minutes.',
  found: 'You have found your Motherlode today. Another breaks ground tomorrow.',
  full: 'Its twenty miners have struck it. The Motherlode is spent.',
});

/**
 * @param {{
 *   door: { motherlodes: (character: string) => Promise<any> },
 *   character: () => (string|null), me: () => (string|null), nowS: () => number,
 *   onChange?: (lode: any) => void, say?: (text: string) => void,
 *   regionName?: (region: number) => string, oreName?: (material: string) => string, nowMs?: () => number,
 *   rand?: () => number,
 * }} deps `door` net/accountClient.js accountProf's; `me` the signed-in account (a receipt is kept only for it); `nowS`
 *   the shared clock's seconds; `onChange` a Motherlode's standing changed (the host stands its pixel again); `rand`
 *   this device's moment in the day's turn (MOTHERLODE_TURN_SPREAD_MS)
 */
export function createMotherlodeBook({ door, character, me, nowS, onChange = () => {}, say = () => {}, regionName = (r) => `region ${r}`, oreName = (m) => m, nowMs = () => Date.now(), rand = Math.random }) {
  const state = {
    /** today's UTC day as read, its Motherlodes (`struck` each), this account's find today (a key) */
    day: /** @type {number|null} */ (null),
    lodes: /** @type {any[]} */ ([]),
    found: /** @type {string|null} */ (null),
  };
  let readAt = -Infinity, busy = false, readMe = /** @type {string|null} */ (null), readChar = /** @type {string|null} */ (null);
  /** AUDIT SILVER-WAYS D1: when a read was last asked (ms) - the day's turn asks again no sooner than its retry - and
   *  this device's moment in the turn */
  let askedAt = -Infinity;
  const turnMs = Math.floor(Math.max(0, Math.min(1, rand())) * MOTHERLODE_TURN_SPREAD_MS);
  /** AUDIT SILVER-WAYS D7: the account, read again once a MOTHERLODE_ME_MS; D6: another account's receipts let go */
  let meNowV = /** @type {string|null} */ (null), meAt = -Infinity;
  function meNow() {
    const t = nowMs();
    if (t - meAt < MOTHERLODE_ME_MS) return meNowV;
    meAt = t;
    const m = me() ?? null;
    if (m !== meNowV) { meNowV = m; watches.clear(); }
    return meNowV;
  }
  /** the lines said this session, by `warn|key` and `risen|key`; the standing each lode was last stood with */
  const said = new Set();
  const stood = new Map();
  /** pixel `x,y` -> { r, i, s } - the newest Watch receipt for each pixel this account stood in */
  const watches = new Map();
  const hear = (fn, ...a) => { try { fn(...a); } catch (e) { console.warn('[motherlode]', e?.message ?? e); } };

  /** Whether a Motherlode stands for this account now - risen, not gone, not spent, not the day's find made. */
  const standing = (l, t) => motherlodeOpen(l, t) && (l.struck ?? 0) < MOTHERLODE_STRIKERS && !state.found;
  /** The host told of every Motherlode whose standing moved since it was last stood. */
  function settle(t) {
    for (const l of state.lodes) {
      const now = standing(l, t);
      if (stood.get(l.key) !== now) { stood.set(l.key, now); hear(onChange, l); }
    }
  }

  async function read() {
    const c = character();
    if (!c || busy) return null;
    busy = true;
    askedAt = nowMs();
    try {
      let r;
      try { r = await door.motherlodes(c); } catch { r = { ok: false, error: 'offline' }; }
      readMe = meNow(); readChar = c;
      if (!r?.ok) { readAt = nowMs() - MOTHERLODE_READ_MS + MOTHERLODE_RETRY_MS; return r; }
      readAt = nowMs();
      const d = r.data ?? {};
      state.day = Number.isSafeInteger(d.day) ? d.day : null;
      state.lodes = Array.isArray(d.lodes) ? d.lodes.filter((l) => l && typeof l.key === 'string') : [];
      state.found = typeof d.found === 'string' ? d.found : null;
      settle(nowS());
      return r;
    } finally { busy = false; }
  }

  return {
    state,
    /** The day's read asked now (a strike's answer, a sign-in). */
    read,
    /**
     * EVERY FRAME (the host's): the read when it is due - arrival, its five minutes, the UTC day's turn, another
     * character or account - then the warnings and the risings said, and every change of standing handed on. `sense`
     * whether this character's Mining stands under Motherlode Sense (30 minutes' warning).
     */
    tick({ sense = false } = {}) {
      const t = nowS();
      const today = Math.floor(t / 86400);
      const m = meNow(), c = character();
      // AUDIT SILVER-WAYS D1: the day's turn asked at this device's moment in it, and again no sooner than a retry - a
      // turn whose read failed (offline over midnight, a refusal) or answered yesterday (the clocks a little apart) was
      // asked again every frame
      const turned = state.day != null && state.day !== today && (t - today * 86400) * 1000 >= turnMs && nowMs() - askedAt >= MOTHERLODE_RETRY_MS;
      if (!busy && (nowMs() - readAt >= MOTHERLODE_READ_MS || turned || m !== readMe || c !== readChar)) void read();
      const ahead = motherlodeWarnS(sense);
      for (const l of state.lodes) {
        if (state.day !== today) break;
        // AUDIT SILVER-WAYS D7: the names made only for a line said
        if (t >= l.opensAt - ahead && t < l.opensAt && !said.has(`warn|${l.key}`)) {
          said.add(`warn|${l.key}`);
          say(MOTHERLODE_TEXT.warn(oreName(l.material), regionName(l.region), Math.max(1, Math.ceil((l.opensAt - t) / 60))));
        }
        if (motherlodeOpen(l, t) && (l.struck ?? 0) < MOTHERLODE_STRIKERS && !said.has(`risen|${l.key}`)) {
          said.add(`risen|${l.key}`);
          say(MOTHERLODE_TEXT.risen(oreName(l.material), regionName(l.region)));
        }
      }
      settle(t);
    },
    /** A Watch receipt the relay handed this socket - kept, the newest for its pixel, where it is this account's. */
    watch(r) {
      const c = readWatchReceipt(r);
      if (!c || !c.signed || c.s !== meNow()) return false;
      const k = `${c.x},${c.y}`;
      if ((watches.get(k)?.i ?? -Infinity) >= c.i) return false;
      watches.delete(k);
      watches.set(k, { r, i: c.i, s: c.s });
      while (watches.size > MOTHERLODE_WATCH_KEPT) watches.delete(watches.keys().next().value);
      return true;
    },
    /** The receipt a strike on pixel (`x`, `y`) carries - the newest, where it will still stand `aheadS` from now (a
     *  strike begun now: its act's MOTHERLODE_ACT_S; AUDIT SILVER-WAYS D5: an act ending now, nought - the act asks
     *  again at its end, so a receipt that arrived during a long act is the one sent) - or null: the relay has not seen
     *  this account there lately. AUDIT SILVER-WAYS D6: this account's alone, whoever signed in since. */
    watchFor(x, y, aheadS = MOTHERLODE_ACT_S) {
      const w = watches.get(`${x},${y}`);
      return w && w.s === meNow() && motherlodeWatchOk(w.i, nowS() + Math.max(0, aheadS)) ? w.r : null;
    },
    /** The Motherlodes standing on pixel (`px`, `py`) now, for this account - the host stands them. */
    standingOn(px, py) {
      const t = nowS();
      return state.lodes.filter((l) => l.x === px && l.y === py && state.day === Math.floor(t / 86400) && standing(l, t));
    },
    /** Every Motherlode standing now, wherever it is - the compass's, every frame: AUDIT SILVER-WAYS D7, into `out` (the
     *  caller's own list, emptied first) where one is handed, so the frame makes none. */
    standingAll(out = []) {
      out.length = 0;
      const t = nowS();
      if (state.day !== Math.floor(t / 86400)) return out;
      for (const l of state.lodes) if (standing(l, t)) out.push(l);
      return out;
    },
    /** A lode by its node key. */
    lodeOf: (key) => state.lodes.find((l) => l.key === key) ?? null,
    /** Whether this account's Motherlode today is found. */
    found: () => state.found,
    /** A strike's answer heard: the find, the count - and the change of standing handed on; then read again. */
    heard(data) {
      if (!data?.motherlode) return;
      state.found = typeof data.node === 'string' ? data.node : state.found;
      const l = state.lodes.find((x) => x.key === data.node);
      if (l && Number.isSafeInteger(data.lode?.struck)) l.struck = data.lode.struck;
      settle(nowS());
    },
    /**
     * AUDIT SILVER-WAYS D2: A STRIKE REFUSED, learned from (REFUSALS-LEARNED) - a refusal only toasted left the
     * Motherlode standing as last read, and every try played the act, wore the Pick-Axe and spent an op on the same
     * refusal until the five-minute read: `motherlode-full` its twenty struck, `motherlode-found` this account's one
     * found today, `motherlode-closed` / `bad-node` / `prof-day` the day's list read again. Whether it was one of these.
     */
    refused(key, error) {
      const l = state.lodes.find((x) => x.key === key) ?? null;
      if (error === 'motherlode-full') { if (l) l.struck = Math.max(l.struck ?? 0, MOTHERLODE_STRIKERS); }
      else if (error === 'motherlode-found') state.found = state.found ?? key;
      else if (error !== 'motherlode-closed' && error !== 'bad-node' && error !== 'prof-day') return false;
      settle(nowS());
      if (error !== 'motherlode-full') void read();
      return true;
    },
  };
}
