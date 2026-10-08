// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SCALE4c (2026-10-08, Mac: "Do 1 2 and 3" - the scaling audit's "one heartbeat replacing the mail, beat and board
// polls", bible/11-Multiplayer/Scale-Arc.md): A TAB'S THREE CLOCKS, ONE REQUEST.
//
// A tab at play asked the account service on three clocks of its own - the play beat every PLAY_BEAT_S (net/playClock.js),
// the letterbox every MAIL_POLL_MS (net/mail.js), and the board of the town it stands in every BOARD_CACHE_MS (net/
// noticeBook.js, for the count that floats over the boards) - each its own request, each its own session for the
// service to resolve. Measured by the load harness (tools/loadHarness.mjs), that was ninety-odd requests a player-hour
// in a town, a third of every request the game makes.
//
// Here they ride one request, /v1/heartbeat (server-account/src/heartbeat.js), which answers each part exactly as its
// own route would - so a part's book takes the same answer it always took, and every clock keeps its own pace:
//   - A PART IS SENT WHEN IT IS DUE, or rides a heartbeat that goes anyway: one due within RIDE_EARLY_MS, and a slower
//     clock (its `every` no shorter) that would fall due before the soonest of the going clocks' periods, less
//     RIDE_EARLY_MS - the going clocks start again as they go (each part counts its clock from the send), so it would
//     otherwise go alone between their heartbeats. Two clocks whose paces divide (the board's minute, the box's three)
//     fall into step from any phase and stay there: a town entered starts the board's minute again, and the box's next
//     look rides the board's heartbeat early rather than going alone ever after. A faster clock never rides a slower
//     one's early - it goes again within its own period, and would only move.
//   - THE BEAT WAITS FOR A RIDE, up to BEAT_RIDE_MS - and never past the grace. The service credits the gap since the
//     account's last beat when it is PLAY_GRACE_S or less, and nothing for a longer one (a new sitting), so a knock
//     waits only while the last beat this page saw credited leaves room (BEAT_GRACE_MARGIN_MS short of the grace): after
//     a dropped knock, the next goes at once. The page's first knock goes at once, as it always did - nothing says how
//     long ago the account last beat. One with nothing due to ride within its wait (a single-player world: no box, no
//     board) goes at once, alone, as it always did.
//   - A HIDDEN PAGE SENDS NO PART (the frames that asked the box and the board stop when a page is hidden, and the play
//     clock does not knock there) - but a knock made while the page was seen goes as it hides, kept alive past the
//     page (AUDIT SCALE B1: held through the hide, its gap outgrew the grace and the sitting's time was lost).
//   - A LOST ANSWER (`offline`, `server`) IS ASKED AGAIN, NOTICE_RETRY_MS apart, NOTICE_TRIES in all - the board's own
//     discipline, now the three parts' - and then each part takes the failure as its own request's. Each try is given
//     up after ACCOUNT_ACT_WAIT_MS (AUDIT 28 N6's law, AUDIT SCALE B2: a request that hangs is given up, never wedged -
//     one heartbeat in flight holds all three clocks).
// ═══════════════════════════════════════════════════════════════════

import { call, storedSession, serviceBase, ACCOUNT_ACT_WAIT_MS } from './accountClient.js';
import { PLAY_BEAT_S, PLAY_GRACE_S } from './playClock.js';
import { NOTICE_TRIES, NOTICE_RETRY_MS } from './noticeBook.js';

/** How often the heartbeat asks its parts whether one is due, ms. */
export const HEARTBEAT_TICK_MS = 1000;
/** A part due within this long rides a heartbeat that is going anyway, ms. */
export const RIDE_EARLY_MS = 5_000;
/** How long a knock waits for a part to ride with, ms - inside the play clock's grace (PLAY_GRACE_S - PLAY_BEAT_S), so
 *  a beat carried late after one on time credits all it would have on time. */
export const BEAT_RIDE_MS = 120_000;
/** How far short of PLAY_GRACE_S since the last beat credited a waiting knock goes anyway, ms - the round trip and the
 *  service's whole-second clock (AUDIT SCALE B1). */
export const BEAT_GRACE_MARGIN_MS = 15_000;
/** The words a heartbeat asks again (net/backoff.js ASK_AGAIN_NOW's own two). */
const RETRY = Object.freeze(['offline', 'server']);

/**
 * One clock's share of the heartbeat. `due(t)` - its own clock says it is time; `soon(t, early)` - it would be within
 * `early` ms; `body()` - what the request carries for it (undefined: nothing this time, and it is not sent); `take(r)` -
 * its answer, in net/accountClient.js call's shape (`{ ok, data }` or `{ ok: false, error }`); `every` - how long after it
 * is sent it falls due again, ms (its clock's own period; none - another part never rides early on its account).
 * @typedef {{ due: (t: number) => boolean, soon: (t: number, early: number) => boolean, body: () => any, take: (r: any) => void, every?: number }} HeartbeatPart
 */

/** A part asked only while `live()` - the host's frames that used to ask it are running (a page hidden, a lane gone
 *  still: nothing asked, as nothing was). */
export const whileLive = (/** @type {HeartbeatPart} */ part, /** @type {() => boolean} */ live) => ({
  ...part,
  due: (/** @type {number} */ t) => live() && part.due(t),
  soon: (/** @type {number} */ t, /** @type {number} */ early) => live() && part.soon(t, early),
});

/** A part's answer, out of the heartbeat's: the route's own body, or its refusal word. */
export const partAnswer = (/** @type {any} */ v) => (v && typeof v === 'object'
  ? (typeof v.error === 'string' ? { ok: false, error: v.error } : { ok: true, data: v })
  : { ok: false, error: 'server' });

/**
 * THE HEARTBEAT: `add(name, part)` its clocks (`mail`, `board`), `beat()` the play clock's knock, and its own tick every
 * HEARTBEAT_TICK_MS (started here; `stop()` ends it). Every clock and side effect is an argument, so node drives it.
 * @param {{ fetch: any, storage: any, now?: () => number, visible?: () => boolean,
 *   setInterval?: (fn: () => void, ms: number) => unknown, clearInterval?: (id: unknown) => void,
 *   sleep?: (ms: number) => Promise<void>, waitMs?: number }} io
 */
export function createHeartbeat({
  fetch, storage, now = () => Date.now(), visible = () => true,
  setInterval = globalThis.setInterval, clearInterval = globalThis.clearInterval,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)), waitMs = ACCOUNT_ACT_WAIT_MS,
}) {
  /** @type {Map<string, HeartbeatPart>} */
  const parts = new Map();
  /** when the play clock last knocked, while its beat waits - null when none waits */
  let beatAt = /** @type {number|null} */ (null);
  /** @type {Array<() => void>} */
  let beatWaiters = [];
  /** @type {Promise<any>|null} */
  let flying = null;
  /** when this page's last beat the service answered was sent - null before the first */
  let creditedAt = /** @type {number|null} */ (null);
  /** each try's fetch, given up after `waitMs` (accountClient.js waitedPost's own: an abort is `offline`) */
  const waited = (/** @type {any} */ url, /** @type {any} */ init) => fetch(url, {
    ...init, signal: typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(waitMs) : undefined,
  });

  /** How much longer the waiting knock may wait: BEAT_RIDE_MS from the knock, never past the grace since the last beat
   *  credited - and none for the page's first, which opens or carries on a sitting nothing here measured. */
  const waitLeft = (/** @type {number} */ t) => (creditedAt == null ? 0
    : Math.min(BEAT_RIDE_MS - (t - /** @type {number} */ (beatAt)), creditedAt + PLAY_GRACE_S * 1000 - BEAT_GRACE_MARGIN_MS - t));
  /** Will any clock be due before the knock's wait is out? Then the beat waits for it; else it goes now. */
  const rideComing = (/** @type {number} */ t) => {
    const left = waitLeft(t);
    return left > 0 && [...parts.values()].some((p) => p.soon(t, left));
  };

  async function send(/** @type {Array<[string, HeartbeatPart]>} */ riding, /** @type {boolean} */ withBeat, keepalive = false) {
    /** @type {Record<string, any>} */
    const body = {};
    /** @type {Array<[string, HeartbeatPart]>} */
    const sent = [];
    for (const [name, p] of riding) {
      let b;
      // AUDIT SCALE B6: a part whose body throws does not ride - and leaves the others theirs
      try { b = p.body(); } catch (e) { console.warn(`[heartbeat] the ${name} part's body threw`, e); continue; }
      if (b === undefined) continue;
      body[name] = b;
      sent.push([name, p]);
    }
    const waiters = withBeat ? beatWaiters : [];
    if (withBeat) { body.beat = true; beatAt = null; beatWaiters = []; }
    const done = () => { for (const w of waiters) w(); };
    if (!sent.length && !withBeat) return null;
    /** @type {any} */
    let r = { ok: false, error: 'offline' };
    try {
      const session = storedSession(storage);
      if (!session) r = { ok: false, error: 'no-session' };   // signed out: every part told so, the knock dropped (accountPlayBeat's own answer)
      else {
        for (let i = 0; i < NOTICE_TRIES; i++) {
          if (i > 0) await sleep(NOTICE_RETRY_MS[Math.min(i - 1, NOTICE_RETRY_MS.length - 1)]);
          const at = now();
          r = await call({ fetch: waited, base: serviceBase(storage), secret: session.secret, keepalive }, '/v1/heartbeat', body);
          if (r.ok && withBeat && partAnswer(r.data?.beat).ok) creditedAt = at;
          if (r.ok || !RETRY.includes(r.error)) break;
        }
      }
    } catch (e) {
      console.warn('[heartbeat] the request threw', e);   // AUDIT SCALE B6: every part stamped still takes an answer
      r = { ok: false, error: 'offline' };
    }
    for (const [name, p] of sent) {
      try { p.take(r.ok ? partAnswer(r.data?.[name]) : { ok: false, error: r.error, ...(r.status ? { status: r.status } : {}) }); }
      catch (e) { console.warn(`[heartbeat] the ${name} part's answer threw`, e); }
    }
    done();   // A BEAT THAT FAILS IS DROPPED (net/playClock.js): a counter never breaks the world it counts
    return r.error === 'no-session' ? null : r;
  }

  /** One look at the clocks: a heartbeat when any is due, carrying every one due within RIDE_EARLY_MS, every slower
   *  one that would fall due before the next heartbeat, and the waiting knock. Answers the heartbeat's promise, or null
   *  when nothing went. */
  function tick(t = now()) {
    if (flying) return null;
    if (!visible()) {
      // AUDIT SCALE B1: a knock made while the page was seen goes as it hides - alone, kept alive past the page
      if (beatAt == null) return null;
      flying = send([], true, true).finally(() => { flying = null; });
      return flying;
    }
    const due = [...parts].filter(([, p]) => p.due(t));
    const beatDue = beatAt != null && (due.length > 0 || !rideComing(t));
    if (!due.length && !beatDue) return null;
    const going = [...parts].filter(([name, p]) => due.some(([n]) => n === name) || p.soon(t, RIDE_EARLY_MS));
    // the going clocks start again as they go, none due before its own period: a slower clock due before the soonest of
    // those would go alone in between, so it rides this one. Less RIDE_EARLY_MS, so clocks in step stay in step - the
    // box rides the board's third minute, never its second.
    const pace = Math.min(...going.map(([, p]) => p.every ?? Infinity));
    const riding = Number.isFinite(pace)
      ? [...parts].filter(([name, p]) => going.some(([n]) => n === name) || ((p.every ?? 0) >= pace && p.soon(t, pace - RIDE_EARLY_MS)))
      : going;
    flying = send(riding, beatAt != null).finally(() => { flying = null; });
    return flying;
  }

  const timer = setInterval(() => { tick(); }, HEARTBEAT_TICK_MS);
  return {
    /** A clock joins - its due, its soon, its body and its take (HeartbeatPart). */
    add(/** @type {string} */ name, /** @type {HeartbeatPart} */ part) { parts.set(name, part); },
    remove(/** @type {string} */ name) { parts.delete(name); },
    /** THE PLAY CLOCK'S KNOCK: carried by the next heartbeat, or alone once nothing will come to ride within its wait
     *  (waitLeft), or as the page hides. Resolves when it has gone (or been dropped). */
    beat() {
      if (beatAt == null) beatAt = now();
      const p = new Promise((r) => { beatWaiters.push(() => r(undefined)); });
      tick();
      return p;
    },
    tick,
    stop() { clearInterval(timer); },
    get flying() { return flying; },
  };
}

// The grace a late beat leans on must hold the wait: a knock carried BEAT_RIDE_MS late still credits its whole gap.
if (BEAT_RIDE_MS > (PLAY_GRACE_S - PLAY_BEAT_S) * 1000) throw new Error('heartbeat.js: BEAT_RIDE_MS outruns the play clock\'s grace');
