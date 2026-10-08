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
//   - A PART IS SENT WHEN IT IS DUE, never earlier than RIDE_EARLY_MS: a heartbeat that goes anyway carries a part due
//     that soon, so two clocks whose paces divide (the board's minute, the box's three) fall into step and stay there.
//   - THE BEAT WAITS FOR A RIDE, up to BEAT_RIDE_MS. Its credit is the service's own gap, capped at PLAY_GRACE_S - twice
//     PLAY_BEAT_S - so a knock carried two minutes late credits exactly what it would have; one with nothing due to
//     ride within its wait (a single-player world: no box, no board) goes at once, alone, as it always did.
//   - A HIDDEN PAGE SENDS NOTHING (the frames that polled the box and the board stop when a page is hidden, and the
//     beat never knocked there).
//   - A LOST ANSWER (`offline`, `server`) IS ASKED AGAIN, NOTICE_RETRY_MS apart, NOTICE_TRIES in all - the board's own
//     discipline, now the three parts' - and then each part takes the failure as its own request's.
// ═══════════════════════════════════════════════════════════════════

import { call, storedSession, serviceBase } from './accountClient.js';
import { PLAY_BEAT_S, PLAY_GRACE_S } from './playClock.js';
import { NOTICE_TRIES, NOTICE_RETRY_MS } from './noticeBook.js';

/** How often the heartbeat asks its parts whether one is due, ms. */
export const HEARTBEAT_TICK_MS = 1000;
/** A part due within this long rides a heartbeat that is going anyway, ms. */
export const RIDE_EARLY_MS = 5_000;
/** How long a knock waits for a part to ride with, ms - inside the play clock's grace (PLAY_GRACE_S - PLAY_BEAT_S), so
 *  a beat carried late credits all it would have on time. */
export const BEAT_RIDE_MS = 120_000;
/** The words a heartbeat asks again (net/backoff.js ASK_AGAIN_NOW's own two). */
const RETRY = Object.freeze(['offline', 'server']);

/**
 * One clock's share of the heartbeat. `due(t)` - its own clock says it is time; `soon(t, early)` - it would be within
 * `early` ms; `body()` - what the request carries for it (undefined: nothing this time, and it is not sent); `take(r)` -
 * its answer, in net/accountClient.js call's shape (`{ ok, data }` or `{ ok: false, error }`).
 * @typedef {{ due: (t: number) => boolean, soon: (t: number, early: number) => boolean, body: () => any, take: (r: any) => void }} HeartbeatPart
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
 *   sleep?: (ms: number) => Promise<void> }} io
 */
export function createHeartbeat({
  fetch, storage, now = () => Date.now(), visible = () => true,
  setInterval = globalThis.setInterval, clearInterval = globalThis.clearInterval,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
}) {
  /** @type {Map<string, HeartbeatPart>} */
  const parts = new Map();
  /** when the play clock last knocked, while its beat waits - null when none waits */
  let beatAt = /** @type {number|null} */ (null);
  /** @type {Array<() => void>} */
  let beatWaiters = [];
  /** @type {Promise<any>|null} */
  let flying = null;

  /** Will any clock be due before the knock's wait is out? Then the beat waits for it; else it goes now. */
  const rideComing = (/** @type {number} */ t) => {
    const left = BEAT_RIDE_MS - (t - /** @type {number} */ (beatAt));
    return left > 0 && [...parts.values()].some((p) => p.soon(t, left));
  };

  async function send(/** @type {Array<[string, HeartbeatPart]>} */ riding, /** @type {boolean} */ withBeat) {
    /** @type {Record<string, any>} */
    const body = {};
    /** @type {Array<[string, HeartbeatPart]>} */
    const sent = [];
    for (const [name, p] of riding) {
      const b = p.body();
      if (b === undefined) continue;
      body[name] = b;
      sent.push([name, p]);
    }
    const waiters = withBeat ? beatWaiters : [];
    if (withBeat) { body.beat = true; beatAt = null; beatWaiters = []; }
    const done = () => { for (const w of waiters) w(); };
    if (!sent.length && !withBeat) return null;
    const session = storedSession(storage);
    if (!session) {   // signed out: every part told so, the knock dropped (accountClient.js accountPlayBeat's own answer)
      for (const [, p] of sent) p.take({ ok: false, error: 'no-session' });
      done();
      return null;
    }
    let r = null;
    for (let i = 0; i < NOTICE_TRIES; i++) {
      if (i > 0) await sleep(NOTICE_RETRY_MS[Math.min(i - 1, NOTICE_RETRY_MS.length - 1)]);
      r = await call({ fetch, base: serviceBase(storage), secret: session.secret }, '/v1/heartbeat', body);
      if (r.ok || !RETRY.includes(r.error)) break;
    }
    for (const [name, p] of sent) {
      try { p.take(r.ok ? partAnswer(r.data?.[name]) : { ok: false, error: r.error, ...(r.status ? { status: r.status } : {}) }); }
      catch (e) { console.warn(`[heartbeat] the ${name} part's answer threw`, e); }
    }
    done();   // A BEAT THAT FAILS IS DROPPED (net/playClock.js): a counter never breaks the world it counts
    return r;
  }

  /** One look at the clocks: a heartbeat when any is due, carrying every one due within RIDE_EARLY_MS and the waiting
   *  knock. Answers the heartbeat's promise, or null when nothing went. */
  function tick(t = now()) {
    if (flying || !visible()) return null;
    const due = [...parts].filter(([, p]) => p.due(t));
    const beatDue = beatAt != null && (due.length > 0 || !rideComing(t));
    if (!due.length && !beatDue) return null;
    const riding = [...parts].filter(([name, p]) => due.some(([n]) => n === name) || p.soon(t, RIDE_EARLY_MS));
    flying = send(riding, beatAt != null).finally(() => { flying = null; });
    return flying;
  }

  const timer = setInterval(() => { tick(); }, HEARTBEAT_TICK_MS);
  return {
    /** A clock joins - its due, its soon, its body and its take (HeartbeatPart). */
    add(/** @type {string} */ name, /** @type {HeartbeatPart} */ part) { parts.set(name, part); },
    remove(/** @type {string} */ name) { parts.delete(name); },
    /** THE PLAY CLOCK'S KNOCK: carried by the next heartbeat, or alone once nothing will come to ride within BEAT_RIDE_MS.
     *  Resolves when it has gone (or been dropped). */
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
