// @ts-check
// STAFF-PANEL5-FEEDS (2026-10-22, design doc "DFO Staff Panel: design": Network bursts, Monster watch, Bot check, Server
// load) - THE RELAY'S STAFF COUNTS: what a room counts for the Staff Panel, in its own memory, and posts to the account
// service. The Room (index.js) calls these at the doors it already has - a frame in, a meter's refusal, a close, a leave,
// a foes frame fanned, a record stripped, a natural encounter's grant minted, a pose taken - one line each; the rest is
// here. NOTHING A PLAYER RECEIVES CHANGES: no frame, field or timing (mob, 03:51Z: the game "must not be able to tell it is
// a check, or thats worthless"), and nothing under src/ changes.
//
// ═══ NETWORK BURSTS AND MONSTER WATCH (Server load, not the first idea) ═══
// Every room every 10 s would have added 30 to 100% to the account database at peak. So: count in the relay's memory -
// each socket's frames and bytes, by kind, the busiest 10 s and the busiest minute of the window, the frames its meters
// refused (index.js _spend), its junk (_junk) and a close for "too many ..." (_refuse) - and REPORT ONLY A PLAYER OVER A
// LIMIT (NET_HOT, FOE_HOT), once a window (NET_FEED_MS) at most, a room posting nothing while nobody is over one. Frames
// are counted, never parsed for it: a frame's kind is its first word (`{"t":"..."`). Monsters (design doc, Weak spots:
// "Monster watch would flag honest dungeon hosts"): the distinct live monster ids in each full foes frame a sender streams
// in an OUTDOOR cell are its own; indoors only the host streams them, so an indoor sender is "host of N monsters", never
// an owner. STAFF-PANEL5-MONSTERS (2026-10-23, mob wants all three feed pages working with grantStrip off - an audit
// showed the strip hides honest players' monsters, so it stays off): they are counted whatever grantStrip says, on the
// frame as it fans (stripped first while the switch is on), so a batch says `ms` 1 always and the panel "measured" (an
// older relay counted them only while grantStrip was on, and said 0 with it off). Read, never changed: no record dropped,
// altered or held for it.
//
// ═══ BOT CHECK: AN ENCOUNTER'S REACTION (mob, 04:47Z: time natural monsters) ═══
// A natural encounter's grant is asked just before the player's game stands it (index.js _grantMintAsk), so its mint is
// the spawn moment. From it the room times the asker's reaction from the poses it already receives: the first pose, the
// weapon drawn, the first swing, cast or arrow, the first blow landed and taken, a death, and the distance moved and the
// turn in the first REACT_FIRST_MS. An episode ends at a death, at REACT_EPISODE_MS, or when its socket leaves; a socket
// holds REACT_OPEN_MAX open at most and a room REACT_ROOM_OPEN_MAX (Server load: "a modded game never closes them").
// Finished episodes post as a signed batch (staffFeedLaw.js), once a window or at the batch's bound.
//
// BOTH ARE OFF UNTIL THEIR URL IS SET (STAFF_NET_FEED_URL, REACTION_FEED_URL): unset, nothing is counted and nothing is
// posted - the relay release ships dark (design doc, Weak spots: "each relay part behind its own live switch").
// IN MEMORY ALONE: a woken or evicted room forgets what it counted - a measure is a sample (grantMeasure.js's law).
import { ID_RE } from '../../src/net/identityToken.js';
import { wrapAngle } from '../../src/world/mat4.js';
import { isCellRoom, foesFrameFull, PIXEL_UNITS, FOES_FIRST_MS } from './relay.js';
import { NET_FEED_MS, NET_FEED_V, REACT_FEED_V, NET_KINDS, REACT_KINDS, REACT_EPISODE_MS, REACT_FIRST_MS, STAFF_FEED_ROWS, STAFF_FEED_SIG_HEADER, STAFF_FEED_POST_MS, STAFF_FEED_AGE_MAX_MS, NET_HOT, FOE_HOT, sealStaffFeed, netRowOk, foeRowOk, reactRowOk } from './staffFeedLaw.js';

/** How long past its window's end a room posts it, ms - a frame a breath late is in it. */
export const NET_SLACK_MS = 2_000;
const SLOT_MS = 10_000;
const MINUTE_MS = 60_000;
/** The sea's monsters (characters/mobile/mobileTypes.js: Slaughterfish 11, Dreugh 41, Lamia 42). */
export const FOE_SEA_TYPES = Object.freeze([11, 41, 42]);
/** A greater giant's type (net/foeBounds.js FOE_BOUND.giantType). */
const GIANT_TYPE = 16;
/** A socket's open episodes at most, and a room's. */
export const REACT_OPEN_MAX = 2;
export const REACT_ROOM_OPEN_MAX = 64;
/** A reaction window's length, ms - finished episodes post once it has waited this long, or at the batch's bound. */
export const REACT_FEED_MS = 10 * 60_000;
/** World units in a metre: a cell's x and z are MapsFile's units (net/wire.js PIXEL_UNITS), 2.5 cm each
 *  (world/meshReader.js GLOBAL_SCALE). */
const UNITS_PER_M = 40;

/** Each frame's word, its kind's index (NET_KINDS) - the rest are `other`. */
const KIND_OF = new Map([['pose', 0], ['act', 1], ['cast', 1], ['hit', 2], ['trade', 3], ['foes', 4], ['own', 4], ['chat', 5], ['say', 5]]);
const OTHER = NET_KINDS.length - 1;
/** A frame's kind, read off its first word: the client writes `t` first (net/wire.js FOES_PREFIX, OWN_PREFIX). */
const kindOf = (/** @type {unknown} */ message) => (typeof message === 'string' && message.startsWith('{"t":"') ? KIND_OF.get(message.slice(6, message.indexOf('"', 6))) ?? OTHER : OTHER);
const on = (/** @type {unknown} */ url) => typeof url === 'string' && url.startsWith('https://');
const randomId = () => [...crypto.getRandomValues(new Uint8Array(8))].map((x) => x.toString(16).padStart(2, '0')).join('');
/** STAFF-PANEL5-FEEDS-FIX: the rows the feed's law refuses left out, and said - ONE ROW NEVER TAKES ITS BATCH WITH IT (a
 *  modded client's poses once failed one episode's law, and its room's whole batch, every honest row in it, was dropped).
 *  Once a post, never a frame. @param {any[]} rows @param {(r: any) => boolean} ok */
const lawful = (rows, ok) => {
  const out = rows.filter(ok);
  if (out.length < rows.length) console.warn('[staff] rows the law refuses left out', rows.length - out.length);
  return out;
};

/**
 * ONE BATCH POSTED - sealed with the relay's receipt key, to `url` through the ACCOUNTS binding where the Worker has it
 * (index.js _grantFlush's door). Answers 'ok', 'refused' (the service said no - never sent again) or 'failed' (nobody
 * answered, or the service failed - kept to send again under its own id).
 * @param {any} room @param {string} url @param {{ body: Uint8Array, sig: string }} sealed
 */
async function post(room, url, sealed) {
  const init = { method: 'POST', headers: { 'content-type': 'application/json', [STAFF_FEED_SIG_HEADER]: sealed.sig }, body: sealed.body, signal: AbortSignal.timeout(STAFF_FEED_POST_MS) };
  try {
    const svc = room.env?.ACCOUNTS;
    const res = typeof svc?.fetch === 'function' ? await svc.fetch(new Request(url, init)) : await fetch(url, init);
    if (!res.ok) console.warn('[staff] the service said', res.status);
    return res.ok ? 'ok' : res.status >= 500 ? 'failed' : 'refused';
  } catch (e) { console.warn('[staff] post failed', e?.message ?? e); return 'failed'; }
}

/** A batch sealed and posted, after the one that failed last time (under its own id, while young enough) - and one that
 *  fails kept, the newest only, and armed to go again. Answers whether this batch went.
 *  @param {any} room @param {any} W the feed's window state @param {string} url @param {any} batch @param {() => void} arm */
async function send(room, W, url, batch, arm) {
  const old = W.retry;
  W.retry = null;
  if (old && Date.now() - old.at < STAFF_FEED_AGE_MAX_MS && (await post(room, url, old.sealed)) === 'failed') W.retry = old;
  const sealed = batch && await sealStaffFeed(batch, await room._receiptKeyOf(), { subtle: crypto.subtle });
  const r = sealed ? await post(room, url, sealed) : 'refused';
  if (r === 'failed') W.retry = { sealed, at: batch.at };
  if (W.retry) arm();
  return r === 'ok';
}

// ═══ NETWORK BURSTS ═══════════════════════════════════════════════════════════════════════════════════════════════

/** The room's net window: the hot rows folded (account -> row), its senders' monsters (account -> row), its timer. */
const netOf = (/** @type {any} */ room) => (room._staffNet ??= { rows: new Map(), foes: new Map(), from: 0, q: null, timer: null, retry: null });
/** A socket's count, begun at window `w` - its meters' refusals, junk and closes so far the window's zero. */
const netBegin = (/** @type {number} */ w, /** @type {any} */ m) => ({ w, slot: -1, min: -1, c10: 0, b10: 0, c60: 0, b60: 0, p10: 0, pb10: 0, p60: 0, pb60: 0, n: 0, b: 0,
  k: NET_KINDS.map(() => 0), nr0: m.nr | 0, j0: m.junk | 0, c0: m.nc | 0, hot: false });
/** The busiest 10 s and minute so far, the slot under way counted. In place. @param {any} s */
const netPeaks = (s) => { s.p10 = Math.max(s.p10, s.c10); s.pb10 = Math.max(s.pb10, s.b10); s.p60 = Math.max(s.p60, s.c60); s.pb60 = Math.max(s.pb60, s.b60); };
/** Over a limit: a busy 10 s, or a refusal, junk or a close since the window began. Pure. */
export const netHot = (/** @type {any} */ s, /** @type {any} */ m) => s.p10 >= NET_HOT.frames10 || s.pb10 >= NET_HOT.bytes10 || (m.nr | 0) > s.nr0 || (m.junk | 0) > s.j0 || (m.nc | 0) > s.c0;
/** The room's post armed for the end of the window under way (a hot row or monster in it). @param {any} room @param {number} now */
function netArm(room, now) {
  const W = netOf(room);
  if (!W.timer) W.timer = setTimeout(() => { void staffNetFlush(room); }, (Math.floor(now / NET_FEED_MS) + 1) * NET_FEED_MS + NET_SLACK_MS - now);
}

/**
 * A FRAME IN (index.js webSocketMessage, before its door): counted for its socket - its kind, its bytes, its slot. A
 * window gone by is folded first. A few compares a frame decide a burst, or a refusal or junk since the window began (a
 * frame's own is read at the socket's next, its leave, or the post).
 * @param {any} room @param {any} ws @param {unknown} message @param {number} now
 */
export function staffNetFrame(room, ws, message, now) {
  if (!on(room.env?.STAFF_NET_FEED_URL)) return;
  const m = room._meterOf(ws);
  const w = Math.floor(now / NET_FEED_MS);
  if (m.nf && m.nf.w !== w) netFold(room, m, room._attach(ws));
  const s = (m.nf ??= netBegin(w, m));
  const slot = Math.floor(now / SLOT_MS);
  if (slot !== s.slot) {
    netPeaks(s);
    s.slot = slot; s.c10 = 0; s.b10 = 0;
    const min = Math.floor(now / MINUTE_MS);
    if (min !== s.min) { s.min = min; s.c60 = 0; s.b60 = 0; }
  }
  const bytes = typeof message === 'string' ? message.length : (/** @type {any} */ (message)?.byteLength ?? 0);
  s.c10++; s.c60++; s.n++; s.b10 += bytes; s.b60 += bytes; s.b += bytes;
  s.k[kindOf(message)]++;
  if (!s.hot && (s.c10 >= NET_HOT.frames10 || s.b10 >= NET_HOT.bytes10 || netHot(s, m))) { s.hot = true; netArm(room, now); }
}

/** A CLOSE for "too many ..." (index.js _refuse): counted on the socket's meters, its words kept. @param {any} room @param {any} ws @param {unknown} why */
export function staffNetClosed(room, ws, why) {
  if (typeof why !== 'string' || !why.startsWith('too many') || !on(room.env?.STAFF_NET_FEED_URL)) return;
  const m = room._meterOf(ws);
  m.nc = (m.nc | 0) + 1;
  m.nw = why.slice(0, 40);
}

/** A socket's window folded into the room's - only when over a limit - and its count ended. @param {any} room @param {any} m @param {any} a */
function netFold(room, m, a) {
  const s = m.nf;
  m.nf = null;
  if (!s) return;
  netPeaks(s);
  if (!s.hot && !netHot(s, m)) return;
  const acct = a?.sub || a?.id;
  if (typeof acct !== 'string' || !ID_RE.test(acct)) return;
  const W = netOf(room);
  W.q ??= a.key ?? null;
  if (!W.from || s.w * NET_FEED_MS < W.from) W.from = Math.max(1, s.w * NET_FEED_MS);
  const c = (m.nc | 0) - s.c0;
  const row = W.rows.get(acct) ?? { a: acct, n: 0, b: 0, p10: 0, pb10: 0, p60: 0, pb60: 0, k: NET_KINDS.map(() => 0), nr: 0, j: 0, c: 0 };
  row.n += s.n; row.b += s.b; row.nr += (m.nr | 0) - s.nr0; row.j += (m.junk | 0) - s.j0; row.c += c;
  row.p10 = Math.max(row.p10, s.p10); row.pb10 = Math.max(row.pb10, s.pb10); row.p60 = Math.max(row.p60, s.p60); row.pb60 = Math.max(row.pb60, s.pb60);
  s.k.forEach((x, i) => { row.k[i] += x; });
  if (c > 0 && m.nw) row.w = m.nw;
  W.rows.set(acct, row);
  if (W.rows.size + W.foes.size >= STAFF_FEED_ROWS * 4) void staffNetFlush(room);   // a room of many hot senders posts early, its most urgent first
}

/** A MONSTER ROW over its limit, or a strip: hot. Pure. */
export const foeHot = (/** @type {any} */ r) => r.o >= FOE_HOT.own || r.h >= FOE_HOT.host || r.x > 0;
/** The room's row for a sender's monsters - made only when `make` (STAFF-PANEL5-FEEDS-FIX: a quiet sender takes no room,
 *  and a room's bound posts the window early, as netFold's does - 256 quiet senders once left Monster watch blind to the
 *  next account, a spawner's every frame and the relay's own strips of it). @param {any} room @param {any} a @param {boolean} make */
function foeRow(room, a, make) {
  const acct = a?.sub || a?.id;
  if (typeof acct !== 'string' || !ID_RE.test(acct)) return null;
  const W = netOf(room);
  W.q ??= a.key ?? null;
  let row = W.foes.get(acct);
  if (!row && make) {
    if (W.rows.size + W.foes.size >= STAFF_FEED_ROWS * 4) void staffNetFlush(room);   // its maps new before it awaits
    row = { a: acct, o: 0, h: 0, r: 0, e: 0, bo: 0, s: 0, x: 0 };
    W.foes.set(acct, row);
  }
  return row ?? null;
}
/**
 * A FOES OR OWN FRAME FANNED (index.js _foesSend), grantStrip on or off: a full frame's distinct live monster ids are its
 * sender's - owned in an outdoor cell (the most in the window, split regular, elite, boss and sea), hosted anywhere else.
 * STAFF-PANEL5-MONSTERS: with grantStrip off `data` is the client's own, unstripped: anything JSON parses to, read and
 * never written. Only a full frame is walked, one pass, its Map gone with the call - and (STAFF-PANEL5-MONSTERS REVIEW)
 * at most one each FOES_FIRST_MS on its sender's `lane` (index.js _foesLane), the cadence FOES-FIRST lets a full frame go
 * first: an honest sender's come FOES_FULL_MS apart, so every one is walked, and one that calls every frame full has one
 * a second walked. A cell's or own lane's frame holds CELL_FRAME_RECORDS_MAX records, about a microsecond's walk; a world
 * room's host frame has no record cap, only FOES_FRAME_MAX bytes - about 6,000 records, a walk of 0.3 ms, about what
 * the frame's own parse costs - so without the gate a host saying full at FOES_HZ_MAX added 3 to 5 ms of each second to
 * its room, and with it about 0.3 ms (test/net/staffpanel5bench.test.js measures both). A row is made only over a limit,
 * and a room's rows post at STAFF_FEED_ROWS * 4 (foeRow).
 * @param {any} room @param {any} a @param {any} data @param {number} now @param {any} [lane]
 */
export function staffFoesSeen(room, a, data, now, lane) {
  if (!on(room.env?.STAFF_NET_FEED_URL) || !foesFrameFull(data) || !Array.isArray(data?.f)) return;
  if (lane) { if (now - (lane.counted ?? -Infinity) < FOES_FIRST_MS) return; lane.counted = now; }
  /** @type {Map<unknown, any>} */
  const live = new Map();
  for (const r of data.f) if (r && typeof r === 'object' && r.d !== 1 && r.i != null) live.set(r.i, r);
  const indoor = !isCellRoom(a.key);
  const row = foeRow(room, a, live.size >= (indoor ? FOE_HOT.host : FOE_HOT.own));   // a row only matters once over its limit - the window's most is that frame's or a later one's
  if (!row) return;
  if (indoor) row.h = Math.max(row.h, live.size);
  else if (live.size > row.o) {
    row.o = live.size; row.r = 0; row.e = 0; row.bo = 0; row.s = 0;
    for (const r of live.values()) {
      if (Number.isInteger(r.cp) || (typeof r.nm === 'string' && r.nm) || (Number.isInteger(r.gg) && r.t === GIANT_TYPE)) row.bo++;   // a champion, a revenant, a greater giant (net/foeBounds.js)
      else if (r.z === 1) row.e++;
      else if (FOE_SEA_TYPES.includes(r.t)) row.s++;
      else row.r++;
    }
  }
  if (foeHot(row)) netArm(room, now);
}
/** RECORDS THE RELAY STRIPPED for their health (index.js _grantRelayTally - FOE-BOUNDS): counted on the sender's row. @param {any} room @param {any} a @param {number} n @param {number} now */
export function staffFoesStripped(room, a, n, now) {
  if (!on(room.env?.STAFF_NET_FEED_URL)) return;
  const row = foeRow(room, a, true);
  if (!row) return;
  row.x += n;
  netArm(room, now);
}

/** Most urgent first: closes, then refusals and junk, then the busiest 10 s. */
const netUrgent = (/** @type {any} */ x, /** @type {any} */ y) => y.c - x.c || (y.nr + y.j) - (x.nr + x.j) || y.p10 - x.p10 || y.pb10 - x.pb10;
/** Most urgent first: strips, then the most owned, then the most hosted. */
const foeUrgent = (/** @type {any} */ x, /** @type {any} */ y) => y.x - x.x || y.o - x.o || y.h - x.h;

/**
 * THE WINDOW POSTED (its timer at the window's end, its bound, or a test): every live socket's window gone by folded, the
 * hot rows and monsters sent, most urgent first within the batch's bound, to STAFF_NET_FEED_URL. Answers whether it went.
 * @param {any} room @param {number} [now]
 */
export async function staffNetFlush(room, now = Date.now()) {
  const W = room._staffNet;
  if (!W) return false;
  if (W.timer) { clearTimeout(W.timer); W.timer = null; }
  const url = room.env?.STAFF_NET_FEED_URL;
  const w = Math.floor(now / NET_FEED_MS);
  for (const [ws, a] of room._all()) { const m = room._meters.get(ws); if (m?.nf && m.nf.w < w) netFold(room, m, a); }
  const rows = lawful([...W.rows.values()], netRowOk).sort(netUrgent);
  const foes = lawful([...W.foes.values()], foeRowOk).sort(foeUrgent);   // each over its limit: foeRow makes no other
  const batch = rows.length || foes.length ? (() => {
    const net = rows.slice(0, STAFF_FEED_ROWS - Math.min(foes.length, STAFF_FEED_ROWS / 2));
    return { v: NET_FEED_V, id: randomId(), at: now, q: W.q, from: W.from || now, ms: 1, net, foe: foes.slice(0, STAFF_FEED_ROWS - net.length) };   // STAFF-PANEL5-MONSTERS: monsters counted whatever grantStrip says
  })() : null;
  W.rows = new Map(); W.foes = new Map(); W.from = 0;
  if (!on(url) || (!batch && !W.retry)) return false;
  return send(room, W, url, batch, () => netArm(room, Date.now()));
}

// ═══ BOT CHECK: REACTIONS ═════════════════════════════════════════════════════════════════════════════════════════

/** The room's episodes: the open ones by socket, the finished ones waiting, the window's start, its timer. */
const reactOf = (/** @type {any} */ room) => (room._staffReact ??= { open: new Map(), openN: 0, rows: [], from: 0, q: null, timer: null, retry: null });
/** The room's tick armed: aged episodes closed, the window posted once it has waited. @param {any} room */
function reactArm(room) {
  const R = reactOf(room);
  if (!R.timer) R.timer = setTimeout(() => { R.timer = null; void staffReactTick(room); }, REACT_EPISODE_MS);
}

/**
 * A NATURAL ENCOUNTER'S GRANT MINTED (index.js _grantMintAsk): its asker's episode opened - the spawn moment its clock
 * starts at, its pose then the one each next is read against. In a cell (an encounter is the open country's), on an
 * account, within the caps; otherwise nothing.
 * @param {any} room @param {any} ws @param {any} a @param {any} gr the grant as minted @param {number} now
 */
export function staffReactAsk(room, ws, a, gr, now) {
  if (!on(room.env?.REACTION_FEED_URL) || !REACT_KINDS.includes(gr?.k) || !isCellRoom(a.key) || typeof a.sub !== 'string' || !ID_RE.test(a.sub)) return;
  const R = reactOf(room);
  const mine = R.open.get(ws) ?? [];
  if (mine.length >= REACT_OPEN_MAX || R.openN >= REACT_ROOM_OPEN_MAX) return;
  const p = a.pose ?? {};
  mine.push({ a: a.sub, k: gr.k, n: gr.n, t0: now, last: p, w0: p.wd ? 1 : 0, hk: p.hk | 0, hu: p.hu | 0, ps: 0, mv: 0, tn: 0, at: {} });
  R.open.set(ws, mine);
  R.openN++;
  R.q ??= a.key;
  reactArm(room);
}

/**
 * A POSE TAKEN (index.js _poseFrame) from a socket with an open episode: what moved since its last, timed from the ask -
 * each first once. A pose past the episode's length closes it unread.
 * @param {any} room @param {any} ws @param {any} p the pose as the door took it (net/wire.js validPose) @param {number} now
 */
export function staffReactPose(room, ws, p, now) {
  const mine = room._staffReact?.open.get(ws);
  if (!mine) return;
  for (const e of [...mine]) {
    const t = now - e.t0;
    if (t > REACT_EPISODE_MS) { reactClose(room, ws, e, now); continue; }
    const q = e.last, at = e.at;
    e.ps++;
    at.p1 ??= t;
    if (p.wd && !q.wd) at.wd ??= t;
    if ((p.an | 0) !== (q.an | 0) || (p.cn | 0) !== (q.cn | 0) || (p.ar | 0) !== (q.ar | 0)) at.ac ??= t;
    if ((p.hk | 0) > e.hk) { at.hk ??= t; e.hk = p.hk | 0; }   // a count that only grows: a pose that drops its point says 0, never a blow
    if ((p.hu | 0) > e.hu) { at.hu ??= t; e.hu = p.hu | 0; }
    if (t <= REACT_FIRST_MS && Number.isFinite(q.x) && Number.isFinite(q.z)) {
      const step = Math.hypot(p.x - q.x, p.z - q.z);
      if (step <= PIXEL_UNITS) e.mv += step;   // STAFF-PANEL5-FEEDS-FIX: a step past a cell is a teleport, never movement (a modded client's ±POSE_BOUND swings once passed the row's law)
      e.tn += Math.abs(wrapAngle(p.yaw - q.yaw));
    }
    e.last = p;
    if (p.dd) { at.dd = t; reactClose(room, ws, e, now); }
  }
}

/** An episode finished: out of the open, its row waiting - posted at the batch's bound. @param {any} room @param {any} ws @param {any} e @param {number} now */
function reactClose(room, ws, e, now) {
  const R = reactOf(room);
  const mine = R.open.get(ws) ?? [];
  const i = mine.indexOf(e);
  if (i < 0) return;
  mine.splice(i, 1);
  if (!mine.length) R.open.delete(ws);
  R.openN--;
  const ms = Math.min(REACT_EPISODE_MS, Math.max(0, now - e.t0));
  const times = Object.fromEntries(Object.entries(e.at).filter(([, v]) => v <= ms));
  R.rows.push({ a: e.a, k: e.k, n: e.n, t: e.t0, ms, ps: e.ps, w0: e.w0, mv: Math.round((e.mv / UNITS_PER_M) * 10), tn: Math.round(e.tn * 100), ...times });
  if (!R.from) R.from = now;
  if (R.rows.length >= STAFF_FEED_ROWS) void staffReactFlush(room);
}

/** THE TICK: episodes past their length closed, the window posted once it has waited REACT_FEED_MS - a failed batch
 *  alone too (STAFF-PANEL5-FEEDS-FIX: one waiting with no new episode was never sent again, and the tick re-armed for
 *  ever; send() lets it go past STAFF_FEED_AGE_MAX_MS) - and armed again while anything is open or waiting.
 *  @param {any} room @param {number} [now] */
export async function staffReactTick(room, now = Date.now()) {
  const R = reactOf(room);
  for (const [ws, mine] of [...R.open]) for (const e of [...mine]) if (now - e.t0 >= REACT_EPISODE_MS) reactClose(room, ws, e, now);
  if ((R.rows.length || R.retry) && now - R.from >= REACT_FEED_MS) await staffReactFlush(room, now);
  if (R.openN || R.rows.length || R.retry) reactArm(room);
}

/** THE WINDOW POSTED - the finished episodes, to REACTION_FEED_URL. Answers whether it went. @param {any} room @param {number} [now] */
export async function staffReactFlush(room, now = Date.now()) {
  const R = room._staffReact;
  if (!R) return false;
  const rows = lawful(R.rows.splice(0, STAFF_FEED_ROWS), (r) => reactRowOk(r, now));
  R.from = R.rows.length ? now : 0;
  const url = room.env?.REACTION_FEED_URL;
  if (!on(url) || (!rows.length && !R.retry)) return false;
  const went = await send(room, R, url, rows.length ? { v: REACT_FEED_V, id: randomId(), at: now, q: R.q, rows } : null, () => reactArm(room));
  R.from ||= R.retry ? now : 0;   // STAFF-PANEL5-FEEDS-FIX: a failed batch waits a window to go again, the net feed's pace - a failing service is not asked every minute
  return went;
}

/** Its timers cleared - a test's end, as _grantFlush clears the grants'. @param {any} room */
export function staffFeedsStop(room) {
  for (const W of [room._staffNet, room._staffReact]) if (W?.timer) { clearTimeout(W.timer); W.timer = null; }
}

/**
 * A SOCKET LEFT (index.js _leave): its net window folded (a close for "too many ..." with it), its open episodes ended.
 * @param {any} room @param {any} ws @param {any} a @param {number} now
 */
export function staffLeft(room, ws, a, now) {
  const m = room._meters?.get(ws);
  if (m?.nf) netFold(room, m, a);
  const mine = room._staffReact?.open.get(ws);
  if (mine) for (const e of [...mine]) reactClose(room, ws, e, now);
}
