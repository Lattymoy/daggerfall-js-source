// @ts-check
// ═══════════════════════════════════════════════════════════════════
// ADMIT-LINE (2026-10-11, Mac: "I think the issue is so many people logging in at once. We need to implement a queue
// system"): THE SIGN-IN LINE.
//
// Every deploy that moves the relay drops every player, and every one of them signs in again in the same minute - a
// guest row or a login, a token mint, the session's read - each a dozen D1 statements, and the database refused as
// overloaded (500 on half of all calls at 00:15) until the wave passed, and the refusals asked again and held it down.
//
// So the doors a sign-in knocks at (ADMIT_ROUTES) take a place in ONE line, kept by one Durable Object the whole
// service shares (AdmitGate): the line is let in ADMIT_RATE a second, first come first served, and the rest are told
// their place and when to ask again - 503 `queue` with the place and the wait, which never touches the database.
//   - A PLACE IS AN ADDRESS'S: asked again, the same address keeps its ticket (a build from before the line, which
//     knows nothing of tickets, still moves up it); not asked about for ADMIT_KEEP_MS, it is let go.
//   - LET IN, AN ADDRESS HOLDS A PASS for ADMIT_PASS_MS - the guest row, the mint and the session of one sign-in are one
//     wait, never three.
//   - QUIET, THE LINE LETS ADMIT_BURST in at once - the head runs at most that far past the back of the line.
//   - A GATE THAT FAILS LETS EVERYONE IN: no binding, a throw, or no answer within ADMIT_ASK_MS, and the door is as it
//     was before the line. The line sheds load; it must never be what locks the realm out.
// ═══════════════════════════════════════════════════════════════════

/** The doors a sign-in knocks at - each a POST. */
export const ADMIT_ROUTES = new Set([
  '/v1/auth/guest',
  '/v1/auth/login',
  '/v1/auth/recover',
  '/v1/auth/token',
  '/v1/auth/session',
]);
/** Places let in a second. */
export const ADMIT_RATE = 5;
/** How many a quiet line lets in at once. */
export const ADMIT_BURST = 25;
/** A place nobody asked about this long is let go, ms. */
export const ADMIT_KEEP_MS = 120_000;
/** How long an address let in passes the gate without a place, ms - one sign-in's doors. */
export const ADMIT_PASS_MS = 90_000;
/** The wait told is never shorter, nor longer, than these, ms. */
export const ADMIT_WAIT_MIN_MS = 1_000;
export const ADMIT_WAIT_MAX_MS = 30_000;
/** How long a door waits for the gate before letting the caller in, ms. */
export const ADMIT_ASK_MS = 2_000;
/** How often the line forgets places and passes gone stale, ms. */
const ADMIT_SWEEP_MS = 10_000;

/** A line nobody stands in. */
export const admitLine = () => ({ head: 0, tail: 0, at: 0, swept: 0, places: new Map(), passes: new Map() });

/**
 * One address asking at the gate: `{ go: true }` let in, or `{ go: false, position, wait }` - its place in the line
 * and how long before it asks again, ms. Pure: the line, the address, the clock and the rate are arguments.
 * @param {ReturnType<typeof admitLine>} line @param {string} key @param {number} nowMs
 * @param {number} [rate] @param {number} [burst]
 */
export function admitAsk(line, key, nowMs, rate = ADMIT_RATE, burst = ADMIT_BURST) {
  line.head = line.at ? line.head + (Math.max(0, nowMs - line.at) * rate) / 1000 : line.tail + burst; // a new line stands quiet
  line.at = nowMs;
  line.head = Math.min(line.head, line.tail + burst); // quiet, the head waits a burst past the back
  if (nowMs - line.swept >= ADMIT_SWEEP_MS) {
    line.swept = nowMs;
    for (const [k, p] of line.places) if (nowMs - p.seen > ADMIT_KEEP_MS) line.places.delete(k);
    for (const [k, until] of line.passes) if (until <= nowMs) line.passes.delete(k);
  }
  if ((line.passes.get(key) ?? 0) > nowMs) return { go: true };
  let place = line.places.get(key);
  if (!place) {
    place = { ticket: ++line.tail, seen: nowMs };
    line.places.set(key, place);
  }
  place.seen = nowMs;
  if (place.ticket <= line.head) {
    line.places.delete(key);
    line.passes.set(key, nowMs + ADMIT_PASS_MS);
    return { go: true };
  }
  const position = Math.ceil(place.ticket - line.head);
  const wait = Math.round(Math.min(ADMIT_WAIT_MAX_MS, Math.max(ADMIT_WAIT_MIN_MS, (position / rate) * 1000)));
  return { go: false, position, wait };
}

/** A number the service's vars may set, else the default. @param {any} v @param {number} d */
const varOr = (v, d) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};

/** THE LINE ITSELF - one Durable Object (`idFromName('line')`), its line in memory: a line lost to an eviction is a
 *  line nobody stood in for a while. */
export class AdmitGate {
  /** @param {any} state @param {any} env */
  constructor(state, env) {
    this.line = admitLine();
    this.rate = varOr(env?.ADMIT_RATE, ADMIT_RATE);
    this.burst = varOr(env?.ADMIT_BURST, ADMIT_BURST);
  }

  /** @param {Request} request */
  async fetch(request) {
    let key = '';
    try {
      key = String((await request.json())?.key ?? '');
    } catch {
      key = '';
    }
    return new Response(JSON.stringify(admitAsk(this.line, key, Date.now(), this.rate, this.burst)), {
      headers: { 'content-type': 'application/json' },
    });
  }
}

/**
 * The door's question: null where the caller goes in (let in, or no gate to ask, or a gate that failed), else
 * `{ position, wait }`. @param {any} env @param {string} key
 */
export async function admitWait(env, key) {
  if (!env?.ADMIT) return null;
  try {
    const stub = env.ADMIT.get(env.ADMIT.idFromName('line'));
    const ask = stub
      .fetch('https://admit/ask', { method: 'POST', body: JSON.stringify({ key }) })
      .then((/** @type {any} */ res) => res.json());
    const r = await Promise.race([
      ask,
      new Promise((resolve) => globalThis.setTimeout(() => resolve(null), ADMIT_ASK_MS)),
    ]);
    if (!r || r.go !== false) return null;
    return {
      position: Math.max(1, Math.trunc(Number(r.position) || 1)),
      wait: Math.max(ADMIT_WAIT_MIN_MS, Math.trunc(Number(r.wait) || ADMIT_WAIT_MIN_MS)),
    };
  } catch {
    return null;
  }
}
