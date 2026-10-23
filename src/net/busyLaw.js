// @ts-check
// BUSY-GATE (2026-10-13, after HOMES-SHED; the owner: "Build whatever can harden our server"): WHEN THE ACCOUNT DATABASE
// IS OVERLOADED, THE READS A TAB KEEPS ASKING STAND BACK - TOGETHER, AND AT BOTH ENDS. ONE LAW for the client's gate
// (net/accountClient.js `call`) and the service's shed (server-account/src/index.js), so the two can never disagree on
// which reads may wait.
//
// The outage of 2026-10-13 (bible/11-Multiplayer/Scale-Arc.md HOMES-SHED): the one D1 primary overloaded from 14:11 UTC
// and stayed down for hours, because every book asked again on its own schedule the moment its answer failed - market,
// marks, notices, writs and the professions twice within 1.5 s, others on a fixed 1-5 s - so a database too slow to
// answer was asked harder than one that answered. HOMES-SHED took the busiest book's flat retry away; this takes the
// class away. The service's overload answer stays `server`, 503 (SCALE4f: every book asks that again - a new word would
// be a refusal to eight of them), and now says how long to stand back (Retry-After). The client, told so once, sends
// none of these reads until the wait is over - each answered at once as the service would have answered it, `server`
// 503 - and the wait doubles while the service keeps saying so. The service, having met an overload itself, answers
// these reads the same way for a moment without asking the database, for the clients that predate the gate.
//
// THE READS ARE ONLY READS. Each route below answers what stands and writes nothing (its handler checked statement by
// statement), so a read held back loses nothing: its book keeps the last good view and asks again. (BUSY-HEART's two
// write what a missed ask loses anyway, below; VENDOR-BOARD's region's traders keep their board once a version, a write a
// held read only defers - AUDIT LEAN-READS C9.) Writes, sign-ins
// and every act are never held - each keeps its own retry, and an act is never dropped (`call` sends it). Left out on
// purpose: a read that may settle something on its way (the market's read, the chapters' list), the arena's board, and
// the mint and the account's own state.
// BUSY-HEART (2026-10-16, the owner: "Fix this" - the account database overloaded from 13:50 UTC and staying so;
// bible/11-Multiplayer/Scale-Arc.md BUSY-HEART): AND THE HEARTBEAT AND THE DAY'S MOTHERLODES, the two routes that spent
// the most of the database's time in the overload. They had been left out as reads the tab's bookmark keeps off the
// primary's queue; with the database slow the page keeps no bookmark (BOOKMARK-SPIRAL), and each was asked again on
// its own schedule - the heartbeat three times in 2 s, twice as often as before the overload, the motherlodes three
// times as often. Their writes are what a missed ask loses anyway: a beat's play credit (net/playClock.js, a beat that
// fails is dropped) and a pick that is a pure roll the next ask makes again (INSERT OR IGNORE). DISPLAY-REPLICA (2026-10-13): the reads below are replica routes too (service.js
// REPLICA_ROUTES), and still stand back - a page with no bookmark asks the primary their first statement. This file
// imports nothing: it is in the account Worker's bundle and the client's, and keeps both graphs flat.

/** The reads that stand back while the service is overloaded - route -> its method. */
export const BUSY_READS = new Map([
  ['/v1/homes/town', 'POST'],       // a town's homes - the busiest route of the 2026-10-13 hour (88,079 asks)
  ['/v1/homes/yards', 'POST'],      // a town's yards
  ['/v1/homes/layouts', 'POST'],    // every town's kept layout
  ['/v1/homes/mine', 'POST'],       // the caller's own homes
  ['/v1/homes/rooms', 'POST'],      // a home's rooms
  ['/v1/homes/decor', 'POST'],      // a home's pieces
  ['/v1/prof/pixels', 'POST'],      // a pixel's nodes - the hour's third busiest (29,249 asks)
  ['/v1/seats/list', 'POST'],       // the seats, from the isolate's kept rows
  ['/v1/market/vendors', 'POST'],   // a region's traders - VENDOR-BOARD: its kept board written once a version, a write a shed read only defers (market.js vendorBoard)
  ['/v1/marks/balance', 'POST'],    // the Marks held
  ['/v1/guilds/invites', 'POST'],   // the invitations waiting
  ['/v1/realm/lineages', 'POST'],   // the account's lineages
  ['/v1/realm/unions', 'POST'],     // the account's unions
  ['/v1/saves', 'GET'],             // the cloud saves' list
  ['/v1/heartbeat', 'POST'],        // BUSY-HEART: the box, the board, the post and the beat - the overload's busiest
  ['/v1/prof/motherlodes', 'POST'], // BUSY-HEART: the day's three, and its pick
  ['/v1/towns/econ', 'POST'],       // AUDIT TOWN-ECON 2 CLI-8: the towns' shares - a display read every page asks each keeping
  ['/v1/festival/town', 'POST'],    // WITCH1: a town's Hearth Offerings, asked a minute while the festival is live (scenes/witchesHost.js)
]);

/** Whether a call is one of the reads that stand back. */
export const busyRead = (/** @type {string} */ path, /** @type {string} */ method) => BUSY_READS.get(path) === method;

/** The seconds an overload answer tells a client to stand back (its Retry-After) - and the least a client waits. */
export const BUSY_RETRY_AFTER_S = 5;
/** How long the service, having met an overload, answers the reads without asking the database (ms). SHED-LONG
 *  (2026-10-16, bible/11-Multiplayer/Scale-Arc.md SHED-LONG): 10 s, where it was 2 - with the queue a minute deep, two
 *  seconds' rest let the next wave of the same reads in before it had drained. */
export const BUSY_SHED_MS = 10_000;
/** The client's first wait after an overload answer, and the most it ever waits (ms): the wait doubles with each
 *  overload answer in a row, between the two. */
export const BUSY_BASE_MS = BUSY_RETRY_AFTER_S * 1000;
export const BUSY_MAX_MS = 60_000;
/** How long a held read takes to answer (ms): never at once, so a book that asks again the moment it is refused is not a
 *  loop that spins - it is a few asks a second that reach nothing. */
export const BUSY_HOLD_MS = 250;

/** The wait after `n` overload answers in a row (ms), `r` a draw in [0, 1): doubled from BUSY_BASE_MS to BUSY_MAX_MS,
 *  then spread over its upper half, so the clients one overload told do not all ask again in the same second. */
export function busyWaitMs(/** @type {number} */ n, /** @type {number} */ r) {
  const w = Math.min(BUSY_MAX_MS, BUSY_BASE_MS * 2 ** Math.max(0, n - 1));
  return Math.round(w / 2 + (w / 2) * Math.min(1, Math.max(0, r)));
}

/** Whether an answer is the service saying it is overloaded: a 503 that says `server` (an overloaded database - SCALE4f -
 *  or its shed) or `queue` (the sign-in line, ADMIT-LINE). A 500 is a fault, not a load, and holds nothing back. */
export const busyAnswer = (/** @type {number} */ status, /** @type {unknown} */ error) => status === 503 && (error === 'server' || error === 'queue');

/** A Retry-After's seconds as a wait (ms) - a whole number of seconds, else none - never past BUSY_MAX_MS. */
export function retryAfterMs(/** @type {unknown} */ header) {
  const s = typeof header === 'string' && /^\d{1,6}$/.test(header.trim()) ? Number(header.trim()) : 0;
  return Math.min(BUSY_MAX_MS, s * 1000);
}
