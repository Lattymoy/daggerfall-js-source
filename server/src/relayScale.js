// SCALE2b (2026-10-04, Mac: "I definitely want to do all these changes in full. No exceptions"): THE RELAY'S HALF OF
// THE SCALE ARC (bible/11-Multiplayer/Scale-Arc.md SCALE2b), in the one deploy SCALE's policy asks for - the socket
// index kept rather than re-walked, the hello's storage moved to memory, a pose's attachment written lazily and its fan
// selected rather than sorted, the caches bounded without thrashing, every call to another room given a deadline, and
// the room's counts written to Analytics Engine. Its constants and its one helper live here, not in index.js: a module
// Worker reads every named export of its entrypoint as an entrypoint (the account service's probe found a Worker that
// would not boot over four exported constants - Testing.md, `npm run account`).
import { LAYERS_MAX, LAYER_HEADER, LAYER_FULL_HEADER, LAYER_ASK_HEADER, LAYER_EMPTY_HEADER, LAYER_LAST_HEADER, layerName } from './relay.js';

/** SCALE2b: how long the socket index is trusted before one walk against the runtime's list (`_all`). */
export const IDX_TRUST_MS = 1000;
/** SCALE2b: the longest a moving pose waits before the runtime's copy of its attachment is rewritten (`_setAttach`). */
export const ATTACH_LAZY_MS = 2000;
/** SCALE2b: the most party records one object keeps in memory (`_parties` had no bound). */
export const PARTIES_MAX = 4096;
/** SCALE2b: the most accounts whose profile secret, gate receipt or raid receipts the hub keeps in memory. */
export const HUB_KEEP_MAX = 8192;
/** SCALE2b: a hub hello rewrites an account record whose only news is its last-seen stamp at most this often (the leave
 *  stamps it exactly; the idle sweep reads it in days). */
export const ACCT_SEEN_WRITE_MS = 10 * 60 * 1000;
/** SCALE2b: THE DEADLINE ON A CALL TO ANOTHER ROOM - a parked team's registry and its drop, an arena post, a gate's kill,
 *  a raid's cleanse and its day said to the hub. Six of them had none, and an awaited call holds its handler: one hung
 *  object (the hub, which every one of them reaches) held every caller's word for as long as it hung. Each caller
 *  already treats a failure as a miss to retry or let lapse; a deadline makes a hang one. (The rite's two calls carried
 *  theirs already - RITE_TELL_RETRY_MS and RITE_ASK_TIMEOUT_MS.) */
export const ROOM_CALL_MS = 5000;
/** SCALE2b: a Map bounded at `max` - a set past the bound lets the OLDEST go (insertion order; setting a key again
 *  moves it to the back), never the whole map. `_recs` and `_cool` cleared themselves whole when full, so one key
 *  past the bound forgot every warm record at once (a read storm) and every repeat-act cooldown (a spam window). */
export class Bounded extends Map {
  constructor(max) { super(); this.max = max; }
  set(k, v) {
    if (this.has(k)) this.delete(k);
    else while (this.size >= this.max) this.delete(this.keys().next().value);
    return super.set(k, v);
  }
}

/** SCALE2b: THE RELAY'S METRICS - one Analytics Engine point (the `METRICS` binding, dataset `daggerfall_relay`) per
 *  room per METRICS_WINDOW_MS in which anything happened, written on the next frame or close after the window ends and
 *  at a drain. The relay measured nothing: only an uncaught error reached a log, so "is the hub hot", "how many sends
 *  a pose costs at an event" and "what a hello costs in storage" were arithmetic from the constants (the SCALE audit's
 *  words: "None has been measured live"). Five minutes, not one: a point a room a minute at a thousand live rooms is
 *  forty million a month; this is a fifth of that, inside the plan's included ten million at the arc's target.
 *  NOTHING IDENTIFIES A PLAYER: the room's KIND (its key's prefix - `world`, `chat`, `dungeon`...) and the relay's
 *  version are the only words; everything else is a count. A metric never costs a frame (a missing binding is no
 *  metric, a throwing one is swallowed).
 *
 *  | field      | holds                                                        |
 *  |------------|--------------------------------------------------------------|
 *  | index1     | the room's kind                                              |
 *  | blob1/2    | the room's kind, the relay's version                         |
 *  | double1    | the window's length, ms                                      |
 *  | double2    | the sockets in the room as it closed                         |
 *  | double3/4  | hellos taken, hellos refused busy                            |
 *  | double5/6  | frames in, their bytes                                       |
 *  | double7    | poses in                                                     |
 *  | double8/9  | frames sent, their bytes                                     |
 *  | double10/11| storage reads (get, list), storage writes (put, delete)      |
 *  | double12   | sockets refused (closed with a reason)                       |
 *
 *  Per kind, sends a pose: SUM(double8) / SUM(double7); storage a hello: SUM(double10 + double11) / SUM(double3). */
export const METRICS_WINDOW_MS = 5 * 60 * 1000;
/** SCALE2b: a room key's kind for a metric - its prefix, at most 16 characters (never an id or a place's name). */
export const roomKindOf = (key) => { const k = String(key ?? ''); const i = k.indexOf(':'); return ((i > 0 ? k.slice(0, i) : k).replace(/[^a-z0-9_-]/gi, '').slice(0, 16)) || 'none'; };
export class RoomMetrics {
  constructor(now = Date.now()) { this.reset(now); }
  reset(now) {
    this.since = now;
    this.c = { hellos: 0, busy: 0, frames: 0, bytesIn: 0, poses: 0, sends: 0, bytesOut: 0, reads: 0, writes: 0, refusals: 0, full: 0, drops: 0, peak: 0, foes: 0, hits: 0, chats: 0, owed: 0, batches: 0 };   // SCALE5b: from `full` on
  }
  /** Anything to say? */
  get busy() { const c = this.c; return c.hellos + c.busy + c.frames + c.sends + c.reads + c.writes + c.refusals + c.full > 0; }   // SCALE5b: a room that only refused a socket for being full has that to say
  /** The window's point to `sink` (env.METRICS) when it is over (or `force`d), and a new window. True when written. */
  flush(sink, kind, sockets, version, now = Date.now(), force = false) {
    if (!force && now - this.since < METRICS_WINDOW_MS) return false;
    const c = this.c, wrote = this.busy && !!sink && typeof sink.writeDataPoint === 'function';
    if (wrote) {
      try {
        sink.writeDataPoint({
          indexes: [kind], blobs: [kind, String(version)],
          // SCALE5b (2026-10-10; bible/11-Multiplayer/Scale-Arc.md SCALE5b): WHAT SAYS A ROOM'S LIMIT IS NEAR, from double13 -
          // the sockets refused 'room full' (the Worker's door, which counted nothing - AUDIT SCALE II R1-5: a refusal the
          // walk could not get past, its last try's or a room's that does not layer, never a full layer it walked on from),
          // the frames its byte budgets dropped, the most sockets it held in the window, the foes frames (AUDIT SCALE II
          // R1-6: and the `own` frames - _foesFan counts both, a foes frame's method), blows and lines it took, and the second wire's work:
          // the items it carried in batches and the batch frames that carried them (items over batches: the sends saved).
          // Analytics Engine takes twenty doubles; these are the last eight.
          doubles: [now - this.since, sockets, c.hellos, c.busy, c.frames, c.bytesIn, c.poses, c.sends, c.bytesOut, c.reads, c.writes, c.refusals,
            c.full, c.drops, Math.max(c.peak, sockets), c.foes, c.hits, c.chats, c.owed, c.batches],
        });
      } catch { /* a metric never costs a frame */ }
    }
    this.reset(now);
    return wrote;
  }
}
/** SCALE2b: the object's state with its storage COUNTED into `metrics` - every get and list a read, every put and delete
 *  a write. A Proxy, so each method is looked up on the real storage at the call (a harness that swaps one sees its
 *  own), and every other member of the state is the runtime's own, bound to it. */
export function countedState(state, metrics) {
  const storage = state?.storage;
  if (!storage) return state;
  const counted = new Proxy(storage, {
    get(t, k) {
      const v = Reflect.get(t, k);
      if (typeof v !== 'function') return v;
      if (k === 'get' || k === 'list') return (...args) => { metrics.c.reads++; return v.apply(t, args); };
      if (k === 'put' || k === 'delete' || k === 'deleteAll') return (...args) => { metrics.c.writes++; return v.apply(t, args); };
      return v.bind(t);
    },
    set(t, k, v) { return Reflect.set(t, k, v); },
  });
  return new Proxy(state, {
    get(t, k) {
      if (k === 'storage') return counted;
      const v = Reflect.get(t, k);
      return typeof v === 'function' ? v.bind(t) : v;
    },
  });
}

/** DO-ASK (2026-10-16): THE WORKER'S ASK OF A ROOM, ONCE MORE WHERE THE RUNTIME SAYS IT MAY BE. A Durable Object stub's
 *  error carries `retryable` where the object was reset or its connection lost before it ran anything, and `overloaded`
 *  where its queue ran too long - the live relay showed both (a region channel's storage reset, a crowded cell's queue).
 *  Every ask the Worker makes is a socket's upgrade, which nothing has run yet, so a retryable one is asked once more on
 *  a fresh stub; an overloaded one never (that only lengthens the queue). What is left is a 503 the page's backoff
 *  answers (online.js BACKOFF_MIN_MS..BACKOFF_MAX_MS) - never an exception thrown out of the Worker. */
export async function askRoom(rooms, name, request) {
  for (let i = 0; ; i++) {
    try { return await rooms.get(rooms.idFromName(name)).fetch(request); } catch (e) {
      const err = /** @type {{ retryable?: boolean, overloaded?: boolean, message?: string }} */ (e ?? {});
      if (i === 0 && err.retryable && !err.overloaded) continue;
      console.warn('[worker] a room did not answer', name, err.message ?? e);
      return new Response(JSON.stringify({ error: err.overloaded ? 'busy' : 'unavailable' }), { status: 503, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'retry-after': '2' } });
    }
  }
}

/** SCALE5d: the Worker's walk of a crowded place's layers - `start` first, then each after it, round to LAYERS_MAX; the
 *  first object that is not full answers (its socket, or its own refusal), and only a full room's refusal
 *  (LAYER_FULL_HEADER) sends the walk on. Every layer full: the last refusal, `room full`, as one room's was - the last
 *  try marked so (LAYER_LAST_HEADER, AUDIT SCALE II R1-5), and an asked layer that holds nobody walked from the place
 *  (LAYER_ASK_HEADER, AUDIT SCALE II R3-3). Here, not
 *  in index.js: the entrypoint's every named export is read as an entrypoint, and a function there stops workerd
 *  starting (test/server/accountdeploy.test.js AUDIT-ACC F2 caught it). */
export async function layerWalk(rooms, key, request, start) {
  // the page's own word of the walk's headers is never passed on: its layer is overwritten below, its ask and its last
  // dropped (a Headers lower-cases its names, as these are)
  const page = Object.fromEntries(request.headers);
  delete page[LAYER_ASK_HEADER]; delete page[LAYER_LAST_HEADER];
  // AUDIT SCALE II R3-3: AN ASKED LAYER IS THE PAGE'S ONLY WHILE SOMEONE STANDS IN IT. Every `?ly=` was honoured, so any
  // page had a private empty copy of any place on demand (in the Wild zone, a hiding place from its fights). The ask
  // rides the first try alone; an asked layer that holds no socket answers LAYER_EMPTY_HEADER, and the walk starts again
  // at the place, as a page that asked nothing is walked - the empty layer is admitted only when the walk reaches it in
  // turn. A party's layer holds the party; a reconnect's own holds the socket it replaces while the runtime lists it -
  // one that stood there alone, its socket gone, is walked from the place like any page.
  let ask = start > 0, res = null;
  for (let i = 0; i < LAYERS_MAX; i++) {
    const ly = (start + i) % LAYERS_MAX;
    const headers = { ...page, [LAYER_HEADER]: String(ly) };
    if (ask) headers[LAYER_ASK_HEADER] = '1';
    else if (i === LAYERS_MAX - 1) headers[LAYER_LAST_HEADER] = '1';   // AUDIT SCALE II R1-5: the refusal nothing walks past - the one a room counts (double13)
    res = await askRoom(rooms, layerName(key, ly), new Request(request, { headers }));   // DO-ASK: a layer that did not answer is asked once more, or its 503
    if (ask) { ask = false; if (res.status === 503 && res.headers.get(LAYER_EMPTY_HEADER) === '1') { start = 0; i = -1; continue; } }
    if (res.status !== 503 || res.headers.get(LAYER_FULL_HEADER) !== '1') return res;
  }
  return res;
}
