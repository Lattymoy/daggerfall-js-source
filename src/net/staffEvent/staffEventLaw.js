// @ts-check
// STAFF-EVENT (2026-10-24, mob: "lets start making an event tool for staff to use / need to be scalable by amount of
// enemy and customizable by type of enemys / need to have a hidden meter that killing enemys build up into a mini boss /
// mini boss need to be a single enlarges version of the mob spawns / instead of the blue elite glow lets make the mini
// boss have a yellow glow / needs to be bale to select a town or area for these events"; and "need to be able to scal
// amount for the meter as well", "show the meter to staff", "should allow all of the monster in the game", "also let
// staff pick the miniboss"): A STAFF EVENT'S LAW - the one copy the account service, the relay and the game read.
// Design: bible/11-Multiplayer/Staff-Events.md.
//
// AN EVENT is staged by an Admin on the Staff Panel: a place (a town - a region and its location - or an AREA, any map
// pixel), the monsters it brings (any kinds, mixed evenly), how many in all, the kills that fill its hidden meter, and
// the mini boss the full meter calls (any kind, a size). The account service signs it as an order of its own kind
// (identityToken.js 'sevent'); the hub keeps the BOOK of the events live (server/src/staffEvents.js) and says it to
// every player online. A town's event is RUN as a town's raid is (systems/raidingParties.js RAID2 - one player in the
// place stands its monsters, every other player there stands them as puppets), and its KILL METER is its cell's, as a
// raid's count is (RAID3): each player in the place says the deaths of their own monsters, the cell keeps the count,
// calls the boss at the meter and tells the hub, which is where staff read it. Players are never told the meter.
//
// PURE - no clock, no storage, no socket. Imports nothing (raidLaw.js's law: the worker's graph stays flat).

/** An event's id: what the account service mints. */
export const STAFF_EVENT_ID_RE = /^[a-z0-9]{6,12}$/;
/** Its key where a raid's key rides (a raider's `rz` tag, a frame's `rk` word): `s.<id>`, which no raid key can be. */
export const STAFF_EVENT_KEY_RE = /^s\.[a-z0-9]{6,12}$/;
export const staffEventKey = (/** @type {string} */ id) => `s.${id}`;
/** The id of a key, or null. @param {unknown} key */
export const staffEventIdOf = (key) => (typeof key === 'string' && STAFF_EVENT_KEY_RE.test(key) ? key.slice(2) : null);

/** The events live at once (the hub's book). */
export const STAFF_EVENTS_MAX = 4;
/** The kinds one event may mix. */
export const STAFF_EVENT_KINDS_MAX = 12;
/** A kind's number: MobileTypes' (0-42 the monsters, 128-145 the classes) and any an expansion registers past them
 *  (characters/enemy/customEnemies.js) - the game builds what it knows and stands nothing for what it does not. */
export const STAFF_EVENT_KIND_MAX = 4095;
/** MobileTypes' two no game stands as an event's: Horse_Invalid (no foe) and the city watch (the town's own). */
export const STAFF_EVENT_KINDS_BARRED = Object.freeze([39, 146]);
/** How many monsters in all, and how many kills fill the meter. */
export const STAFF_EVENT_TOTAL_MIN = 1;
export const STAFF_EVENT_TOTAL_MAX = 500;
export const STAFF_EVENT_METER_MIN = 1;
export const STAFF_EVENT_METER_MAX = 500;
/** The mini boss's size, percent of its kind's (a quarter larger is an elite's 125). */
export const STAFF_BOSS_SIZE_MIN = 150;
export const STAFF_BOSS_SIZE_MAX = 300;
export const STAFF_BOSS_SIZE_DEFAULT = 200;
/** The mini boss's health, times its kind's (mob 2026-10-24 21:17Z: "needs the mini bosses health on the start panel"). */
export const STAFF_BOSS_HEALTH_MIN = 1;
export const STAFF_BOSS_HEALTH_MAX = 100;
export const STAFF_BOSS_HEALTH_DEFAULT = 10;
/** BOSS-HP (mob 2026-10-25 02:47Z: "need be able to eneter a exact amount of healt for mini bosses"): the mini boss's
 *  health as a number staff type (`hp`), in place of the times-its-kind's above; 0 is the times. */
export const STAFF_BOSS_HP_MAX = 1000000;
/** The longest an event may be set to run, ms (a day; "only when I end it" is 0). */
export const STAFF_EVENT_LONGEST_MS = 24 * 60 * 60 * 1000;
/** A staff member's name as the book carries it. */
export const STAFF_EVENT_BY_MAX = 32;
/** A place's name as the book carries it (the panel's word, for the panel - the game names a town off its own map). */
export const STAFF_EVENT_PLACE_MAX = 48;

/** How often a player standing in the place says its word, ms (a raid's RAID_WORD_MS), and at once when it moves. */
export const STAFF_EVENT_WORD_MS = 5000;
/** THE CAP: the count grows no faster than this many kills a second, past STAFF_EVENT_KILLS_BURST - a staff event stands
 *  up to 25 at once against a crowd, so four a second (a raid's is one: its raiders stand one at a time). */
export const STAFF_EVENT_KILL_MS = 250;
export const STAFF_EVENT_KILLS_BURST = 10;
/** The most deaths one word may say. */
export const STAFF_EVENT_WORD_KILLS_MAX = 9999;
/** The accounts one ledger records. */
export const STAFF_EVENT_ACCOUNTS_MAX = 64;
/** "Fighting now": a word within this, ms. */
export const STAFF_EVENT_PRESENT_MS = 15000;
/** How often a cell tells the hub a count that moved, ms (a call meter or the boss's moments go at once). */
export const STAFF_EVENT_TELL_MS = 3000;
/** How long a ledger is kept past its event's end, ms. */
export const STAFF_EVENT_KEEP_MS = 10 * 60 * 1000;
/** THE REWARD (mob 2026-10-24: "something like dagons leaderboard", "but not his ghear"): at the mini boss's first fall
 *  every account that EARNED it is handed a receipt of its own (staffEventReceipt.js) and the place is told the board.
 *  Earned: this many kills on the meter, or standing in the place for half the event's run (a healer's way, the gate's). */
export const STAFF_EVENT_EARN_KILLS = 3;
/** The board's length: the top fighters by kills, said to the place and shown to staff. */
export const STAFF_EVENT_BOARD_MAX = 10;
/** A word counts toward the stand once this long after the last that counted, ms (a word comes every 5 s). */
export const STAFF_EVENT_STAND_TICK_MS = 4000;

const intIn = (/** @type {unknown} */ v, /** @type {number} */ lo, /** @type {number} */ hi) => Number.isSafeInteger(v) && /** @type {number} */ (v) >= lo && /** @type {number} */ (v) <= hi;
const bit = (/** @type {unknown} */ v) => v === 1 ? 1 : 0;
const clean = (/** @type {unknown} */ s, /** @type {number} */ max) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, max) : '');
/** Is `t` a kind an event may bring? @param {unknown} t */
export const staffEventKindOk = (t) => intIn(t, 0, STAFF_EVENT_KIND_MAX) && !STAFF_EVENT_KINDS_BARRED.includes(/** @type {number} */ (t));

/**
 * @typedef {{ id: string, rg: number, loc: number, px: number, py: number, nm: string, ct: 0|1, mt: number[], n: number, m: number,
 *   b: number, bs: number, bh: number, hp: number, at: number, ue: number, eb: 0|1, fb: number, by: string }} StaffEvent
 *   `loc` -1 for an area (the pixel alone); `ct` 1 when the place is a city (a town on the game's own map - the panel's
 *   pick), never for an area, so its lines say a city or an area; `ue` the end it was set to (ms, 0 none); `eb` 1 ends it at the boss's fall;
 *   `bh` the mini boss's health, times its kind's; `hp` BOSS-HP's exact health, which wins over `bh` (0 none);
 *   `fb` how many times staff called the boss by hand (Spawn mini boss now) - each call is one more boss.
 */

/**
 * An event, projected: its fields bounded, its kinds each once, or null. The one shape every door and frame carries.
 * @param {any} e @returns {StaffEvent|null}
 */
export function validStaffEvent(e) {
  if (staffEventFault(e)) return null;
  const mt = [...new Set(/** @type {number[]} */ (e.mt))];
  return { id: e.id, rg: e.rg, loc: e.loc, px: e.px, py: e.py, nm: clean(e.nm, STAFF_EVENT_PLACE_MAX), ct: e.loc >= 0 ? bit(e.ct) : 0, mt, n: e.n, m: e.m, b: e.b, bs: e.bs, bh: e.bh ?? STAFF_BOSS_HEALTH_DEFAULT, hp: e.hp ?? 0, at: e.at, ue: e.ue, eb: bit(e.eb), fb: e.fb ?? 0, by: clean(e.by, STAFF_EVENT_BY_MAX) };
}
/**
 * EVENT-FAULT (mob 2026-10-25: "service refused", "toop of event menu says the refusal"): the first field validStaffEvent
 * refuses, by name - the panel says which - or null for an event it takes.
 * @param {any} e @returns {string|null}
 */
export function staffEventFault(e) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return 'event';
  if (typeof e.id !== 'string' || !STAFF_EVENT_ID_RE.test(e.id)) return 'id';
  if (!intIn(e.rg, 0, 255)) return 'region';
  if (!intIn(e.loc, -1, 9999)) return 'place';
  if (!intIn(e.px, 0, 999) || !intIn(e.py, 0, 499)) return 'pixel';
  if (!Array.isArray(e.mt) || !e.mt.length || e.mt.length > STAFF_EVENT_KINDS_MAX || !e.mt.every(staffEventKindOk)) return 'monsters';
  if (!intIn(e.n, STAFF_EVENT_TOTAL_MIN, STAFF_EVENT_TOTAL_MAX)) return 'total';
  if (!intIn(e.m, STAFF_EVENT_METER_MIN, Math.min(STAFF_EVENT_METER_MAX, e.n))) return 'meter';
  if (!staffEventKindOk(e.b)) return 'boss';
  if (!intIn(e.bs, STAFF_BOSS_SIZE_MIN, STAFF_BOSS_SIZE_MAX)) return 'size';
  if (!intIn(e.bh ?? STAFF_BOSS_HEALTH_DEFAULT, STAFF_BOSS_HEALTH_MIN, STAFF_BOSS_HEALTH_MAX) || !intIn(e.hp ?? 0, 0, STAFF_BOSS_HP_MAX)) return 'health';
  if (!Number.isSafeInteger(e.at) || e.at <= 0) return 'start';
  if (!(e.ue === 0 || (Number.isSafeInteger(e.ue) && e.ue > e.at && e.ue - e.at <= STAFF_EVENT_LONGEST_MS))) return 'runs';
  if (!intIn(e.fb ?? 0, 0, 99)) return 'calls';
  return null;
}
/** Is the event over by its own clock at `nowMs`? @param {StaffEvent} e @param {number} nowMs */
export const staffEventLapsed = (e, nowMs) => e.ue > 0 && nowMs >= e.ue;
/** Is it an area's (any pixel) rather than a town's? @param {StaffEvent} e */
export const isAreaEvent = (e) => e.loc < 0;

// ═══ THE WORDS ═══════════════════════════════════════════════════════════════════════════════════

/**
 * A player's word to the place's cell, projected: `{k:'w', id, px, py, n, s, bu, bk, fb, h}` - the event, its place's
 * pixel (the cell reads it against its own), the deaths of MY monsters in it so far, 1 once I struck one, 1 once the
 * boss I stand stood (`bu`) and once it fell (`bk`), the boss call (`fb`) the boss answered, and THE REWARD's `h`: the
 * monsters that fell after a blow of mine, whoever stood them (the board's kills - `n` is the runner's, who stands them
 * all) - or null.
 * @param {any} m
 */
export function validStaffEventIn(m) {
  if (!m || typeof m !== 'object' || m.k !== 'w') return null;
  if (typeof m.id !== 'string' || !STAFF_EVENT_ID_RE.test(m.id)) return null;
  if (!intIn(m.px, 0, 999) || !intIn(m.py, 0, 499) || !intIn(m.n, 0, STAFF_EVENT_WORD_KILLS_MAX) || !intIn(m.fb ?? 0, 0, 99) || !intIn(m.h ?? 0, 0, STAFF_EVENT_WORD_KILLS_MAX)) return null;
  for (const k of ['s', 'bu', 'bk']) if (m[k] !== undefined && m[k] !== 0 && m[k] !== 1) return null;
  return { k: 'w', id: m.id, px: m.px, py: m.py, n: m.n, s: bit(m.s), bu: bit(m.bu), bk: bit(m.bk), fb: m.fb ?? 0, h: m.h ?? 0 };
}

/** The bound on a receipt's length on the wire (staffEventReceipt.js STAFF_RECEIPT_MAX - this file imports nothing). */
export const STAFF_RECEIPT_WIRE_MAX = 512;
/** The kinds a relay's staff event frame says. */
export const STAFF_EVENT_OUT_KINDS = Object.freeze(['ev', 'end', 'st', 'bd', 'rc']);

/**
 * A relay's staff event frame, projected for the game: the hub's BOOK (`ev`: the events live, each validStaffEvent's
 * shape), an END (`end`: the event and why - 'staff', 'boss', 'time', 'done'), or a cell's LEDGER (`st`: the event's
 * boss state - `bd` the boss is due, `bu` it stood, `bk` it fell, `fc` the boss call the ledger has heard, and `n` the
 * kills so far, which the game uses only to stop standing monsters at the event's total; it never shows it), and THE
 * REWARD's two at the first boss's fall: the BOARD (`bd`: `top`, staffEventBoard's rows) and MY RECEIPT (`rc`: `r`,
 * staffEventReceipt.js's `e1` string, read there) - or null.
 * @param {any} m
 */
export function validStaffEventOut(m) {
  if (!m || typeof m !== 'object' || !STAFF_EVENT_OUT_KINDS.includes(m.k)) return null;
  if (m.k === 'ev') {
    if (!Array.isArray(m.l)) return null;
    const l = [];
    for (const e of m.l) { if (l.length >= STAFF_EVENTS_MAX) break; const v = validStaffEvent(e); if (v && !l.some((x) => x.id === v.id)) l.push(v); }
    return { k: 'ev', l };
  }
  if (typeof m.id !== 'string' || !STAFF_EVENT_ID_RE.test(m.id)) return null;
  if (m.k === 'end') return { k: 'end', id: m.id, why: ['staff', 'boss', 'time', 'done'].includes(m.why) ? m.why : 'staff' };
  if (m.k === 'bd') { const top = validStaffBoard(m.top); return top ? { k: 'bd', id: m.id, top } : null; }   // THE REWARD: the board, at the fall
  if (m.k === 'rc') return typeof m.r === 'string' && m.r.length <= STAFF_RECEIPT_WIRE_MAX ? { k: 'rc', id: m.id, r: m.r } : null;   // and my receipt
  if (!intIn(m.n, 0, STAFF_EVENT_TOTAL_MAX) || !intIn(m.fc ?? 0, 0, 99)) return null;
  return { k: 'st', id: m.id, n: m.n, bd: bit(m.bd), bu: bit(m.bu), bk: bit(m.bk), fc: m.fc ?? 0 };
}

// ═══ THE CELL'S LEDGER ═══════════════════════════════════════════════════════════════════════════

/**
 * @typedef {{ nm: string, n: number, s: 0|1, last: number, t?: number, tAt?: number, h?: number }} StaffEventAccount
 *   `h` its kills (a word's `h`, the board's), `t` the words that counted toward its stand (one a STAFF_EVENT_STAND_TICK_MS), `tAt` the last of them.
 * @typedef {{ id: string, first: number, n: number, a: Record<string, StaffEventAccount>, bd: 0|1, bu: 0|1, bk: 0|1,
 *   fc: number, bossN: number, ended: 0|1, kb?: string, fellAt?: number, rw?: 0|1, top?: StaffBoardRow[],
 *   rc?: Record<string, string>, hc?: number, mc?: number }} StaffEventLedger
 *   `fc` the boss call now (each call one more boss, by the meter or staff's hand); `hc` the hand calls taken (the book's
 *   `fb`); `mc` the meter's calls (BOSS-AGAIN); `bossN` the bosses that fell; THE
 *   REWARD's: `kb` the account whose word felled the first boss and `fellAt` when, `rw` 1 once it was paid, `top` the
 *   board, `rc` each earner's receipt.
 * @typedef {[string, number, 0|1]} StaffBoardRow  a fighter's name, kills, and 1 for the boss's killer
 */

/** A ledger, off the event's first word in its cell. @param {StaffEvent} e @param {number} nowMs @returns {StaffEventLedger} */
export const newStaffLedger = (e, nowMs) => ({ id: e.id, first: nowMs, n: 0, a: {}, bd: 0, bu: 0, bk: 0, fc: 0, bossN: 0, ended: 0 });

/** The most the count may be at `nowMs` (THE CAP). @param {StaffEventLedger} led @param {number} nowMs */
export const staffEventCap = (led, nowMs) => STAFF_EVENT_KILLS_BURST + Math.floor(Math.max(0, nowMs - led.first) / STAFF_EVENT_KILL_MS);

/**
 * A boss called: the meter full (the count at `e.m`), or staff's hand (`e.fb` past the calls the ledger took). A boss
 * already standing is not called by the meter; BOSS-AGAIN (mob 2026-10-25: "boss seems to not spawn every time"): the
 * meter calls one more each time it fills again - every `e.m` kills - once the last has fallen. Each call is the next
 * `fc`. Answers whether it moved.
 * @param {StaffEventLedger} led @param {StaffEvent} e
 */
export function staffBossCall(led, e) {
  if (led.ended) return false;
  const hc = led.hc ?? led.fc, mc = led.mc ?? led.bd;   // a ledger kept before BOSS-AGAIN: `fc` was the hands', and a meter boss called once
  if (e.fb > hc) { led.hc = e.fb; led.mc = mc; nextStaffBoss(led); return true; }   // by hand: one more boss
  if ((!led.bd || led.bk) && led.n >= e.m * (mc + 1)) { led.hc = hc; led.mc = mc + 1; nextStaffBoss(led); return true; }   // the meter, each time it fills
  return false;
}
/** The next call: the one after the last, a new boss due. @param {StaffEventLedger} led */
function nextStaffBoss(led) {
  if (led.bd) led.fc = Math.min(99, led.fc + 1);
  led.bd = 1; led.bu = 0; led.bk = 0;
}

/**
 * One word folded in: the account's record and its deaths - the most it has said, credited as far as the cap and the
 * event's total let them - and the boss's moments (stood once called; fell once stood). Answers what moved.
 * @param {StaffEventLedger} led @param {StaffEvent} e @param {string} acct @param {string} name
 * @param {{ n: number, s?: number, bu?: number, bk?: number, fb?: number, h?: number }} w @param {number} nowMs
 */
export function foldStaffWord(led, e, acct, name, w, nowMs) {
  const out = { credited: 0, known: false, boss: false };
  if (led.ended) return out;
  let rec = led.a[acct];
  if (!rec) {
    if (Object.keys(led.a).length >= STAFF_EVENT_ACCOUNTS_MAX) return out;
    rec = led.a[acct] = { nm: '', n: 0, s: 0, last: 0, t: 0, tAt: 0, h: 0 };
  }
  out.known = true;
  rec.nm = typeof name === 'string' ? name.slice(0, 32) : '';
  rec.last = nowMs;
  if (nowMs - (rec.tAt ?? 0) >= STAFF_EVENT_STAND_TICK_MS) { rec.t = (rec.t ?? 0) + 1; rec.tAt = nowMs; }   // THE STAND: a word a tick
  if (w.s === 1) rec.s = 1;
  if ((w.h ?? 0) > (rec.h ?? 0)) rec.h = Math.max(rec.h ?? 0, Math.min(w.h ?? 0, e.n, staffEventCap(led, nowMs)));   // THE REWARD: my kills, never past the event's total or its pace
  if (w.n > rec.n) {
    out.credited = Math.max(0, Math.min(w.n - rec.n, staffEventCap(led, nowMs) - led.n, e.n - led.n));
    rec.n += out.credited;
    led.n += out.credited;
  }
  if (staffBossCall(led, e)) out.boss = true;
  // the boss's moments, said by the player who stands it, for the call it answers (an old call's word moves nothing)
  if ((w.fb ?? 0) === led.fc && led.bd) {
    if (w.bu === 1 && !led.bu) { led.bu = 1; out.boss = true; }
    if (w.bk === 1 && led.bu && !led.bk) { led.bk = 1; led.bossN++; out.boss = true; if (!led.kb) { led.kb = acct; led.fellAt = nowMs; } }   // THE REWARD: its first killer and fall
  }
  return out;
}

/** Is the event done by its ledger - its boss fell and it ends there, or every monster fell and no boss stands? Answers
 *  the end's word, or null. @param {StaffEventLedger} led @param {StaffEvent} e */
export function staffEventDone(led, e) {
  if (led.bk && e.eb) return 'boss';
  if (led.n >= e.n && (!led.bd || led.bk)) return 'done';
  return null;
}

/**
 * THE REWARD's earners at the first boss's fall: every account (never a guest's socket, `id:`) with STAFF_EVENT_EARN_KILLS
 * kills of its own (`h`) - REWARD-KILLS: a stand alone no longer earns - most kills first, the killer before an equal
 * count, then the longest stand. Each with its RANK on the board (1 to STAFF_EVENT_BOARD_MAX, 0 past it).
 * @param {StaffEventLedger} led @returns {{ acct: string, rec: StaffEventAccount, rank: number }[]}
 */
export function staffEventEarned(led) {
  const fell = led.fellAt ?? led.first;
  const half = Math.max(0, fell - led.first) / 2;
  const rows = Object.entries(led.a)
    .filter(([acct, r]) => !acct.startsWith('id:') && (r.h ?? 0) >= STAFF_EVENT_EARN_KILLS)   // REWARD-KILLS (mob 2026-10-25: "im getting drops even tho i barlky particpate"; card "Kills only (3+)"): a stand alone earns nothing
    .sort(([a, x], [b, y]) => (y.h ?? 0) - (x.h ?? 0) || Number(b === led.kb) - Number(a === led.kb) || (y.t ?? 0) - (x.t ?? 0) || (a < b ? -1 : 1));
  return rows.map(([acct, rec], i) => ({ acct, rec, rank: i < STAFF_EVENT_BOARD_MAX ? i + 1 : 0 }));
}
/** The board: the earners' top STAFF_EVENT_BOARD_MAX as `[name, kills, killer]`. @param {StaffEventLedger} led @returns {StaffBoardRow[]} */
export const staffEventBoard = (led) => staffEventEarned(led).filter((x) => x.rank > 0).map((x) => [x.rec.nm || '', Math.min(x.rec.h ?? 0, STAFF_EVENT_WORD_KILLS_MAX), x.acct === led.kb ? 1 : 0]);   // a nameless row the reader's own word (raidingParties.js staffBoardLine)
/** A board, projected (a frame's, a tell's). @param {unknown} top @returns {StaffBoardRow[] | null} */
export function validStaffBoard(top) {
  if (!Array.isArray(top) || top.length > STAFF_EVENT_BOARD_MAX) return null;
  const out = [];
  for (const r of top) {
    if (!Array.isArray(r) || r.length !== 3 || typeof r[0] !== 'string' || !intIn(r[1], 0, STAFF_EVENT_WORD_KILLS_MAX)) return null;
    out.push(/** @type {StaffBoardRow} */ ([clean(r[0], 32), r[1], bit(r[2])]));
  }
  return out;
}

/** The ledger as a cell says it to the place. @param {StaffEventLedger} led */
export const staffLedgerState = (led) => ({ k: 'st', id: led.id, n: led.n, bd: led.bd, bu: led.bu, bk: led.bk, fc: led.fc });
/** The accounts fighting now (a word within STAFF_EVENT_PRESENT_MS). @param {StaffEventLedger} led @param {number} nowMs */
export const staffEventFighters = (led, nowMs) => Object.values(led.a).filter((r) => nowMs - r.last <= STAFF_EVENT_PRESENT_MS).length;
/** What a cell tells the hub, and the hub tells staff: the count, the boss, who is fighting. @param {StaffEventLedger} led @param {number} nowMs */
export const staffEventTell = (led, nowMs) => ({ id: led.id, n: led.n, bd: led.bd, bu: led.bu, bk: led.bk, fc: led.fc, bossN: led.bossN, f: staffEventFighters(led, nowMs), ...(led.top ? { top: led.top } : {}) });
/** A tell, projected (the hub's door reads a cell's). @param {any} t */
export function validStaffEventTell(t) {
  if (!t || typeof t !== 'object' || typeof t.id !== 'string' || !STAFF_EVENT_ID_RE.test(t.id)) return null;
  if (!intIn(t.n, 0, STAFF_EVENT_TOTAL_MAX) || !intIn(t.fc ?? 0, 0, 99) || !intIn(t.bossN ?? 0, 0, 99) || !intIn(t.f ?? 0, 0, STAFF_EVENT_ACCOUNTS_MAX)) return null;
  const top = t.top === undefined ? null : validStaffBoard(t.top);
  if (t.top !== undefined && !top) return null;
  return { id: t.id, n: t.n, bd: bit(t.bd), bu: bit(t.bu), bk: bit(t.bk), fc: t.fc ?? 0, bossN: t.bossN ?? 0, f: t.f ?? 0, ...(top ? { top } : {}) };
}

/** The relay that knows staff events (net/wire.js RELAY_VERSION) - an older one closes a socket on the frame. */
export const STAFF_EVENT_RELAY_MIN = 256;   // world255 on its branch, renumbered past KETCH at the merge
export const relaySupportsStaffEvents = (/** @type {unknown} */ v) => { const r = /^world(\d+)$/.exec(typeof v === 'string' ? v : ''); return !!r && Number(r[1]) >= STAFF_EVENT_RELAY_MIN; };
