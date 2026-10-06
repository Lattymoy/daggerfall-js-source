// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SEAT1a (2026-09-30, Mac: "Finish the seats") — THIS DEVICE'S SEATS:
// whether the seats are open to this account (the service's SEATS_OPEN),
// the seats the witnesses confirmed as the service last said them, and
// the seat this client stands in reported once a UTC day
// (bible/11-Multiplayer/Seats-Arc.md 3.2: "A client standing in a seat
// town online reports {key, name, region, tier, pixel} once a day").
//
// A seat is DRAWN off the client's own derivation (systems/townSeats.js):
// "a client never draws, lists or honours a seat its own derivation
// lacks" - the service's list says which of them the witnesses confirmed
// (what a pledge and a claim will need, SEAT1b-c). The service keeps the
// registry (server-account/src/townSeats.js); the law both ends read is
// net/townSeatLaw.js.
//
// SEAT1b: AND THIS DEVICE'S HALF OF INFLUENCE (Seats-Arc 4.1-4.2) - the
// standings at a seat, read for the board's Seat tab and kept a little;
// a pledge set or taken down; Tribute paid under its own request id; and
// the Watch's receipts the relay hands this socket (net/watchReceipt.js),
// kept - on the device, the signed-in account's alone, a seat's own
// pixel's alone - until the account service has counted them, a claim
// every SEAT_WATCH_CLAIM_EVERY_MS or as soon as a claim's worth is held.
//
// Pure - the door, the storage and the clock are handed in.
// ═══════════════════════════════════════════════════════════════════
import { SEAT_REPORT_EVERY_S, SEAT_WATCH_CLAIM_MAX, seatReportOf, seatKeyOk, EDICTS, siegeWindowText, seatWeekOf, seasonOf, guildWords } from './townSeatLaw.js';
import { accountRefusalText } from './accountClient.js';
import { readWatchReceipt } from './watchReceipt.js';
import { mintMarksRid } from './marksBook.js';
import { tideAt } from './tideLaw.js';   // SEASON1 part two: the Tides
import { fortWork, towersText } from './fortLaw.js';   // SEAT2b: the works; part two: the Watchtowers' word
import { jittered } from './backoff.js';   // STORM-SHED: a failed claim's wait, jittered as every book's is

/** How long a list read is kept before the next is asked, ms. */
export const SEAT_LIST_CACHE_MS = 5 * 60_000;
/** Where this device keeps the day it last reported each seat: { [key]: UTC day }. */
export const SEAT_REPORTED_KEY = 'seat1.reported';
/** The seats remembered - a player who wanders the Bay does not grow the key for ever. */
export const SEAT_REPORTED_MAX = 200;
/** The answers that say the seats are not open to THIS account now. */
const SHUT = Object.freeze(['seats-closed', 'no-session', 'auth']);
/** SEAT1b: how long a seat's standings are kept before they are asked again, ms. */
export const SEAT_STANDINGS_CACHE_MS = 30_000;
/** SEASON1 part three: how long a Hall of Records read is kept before the next is asked, ms - its rows change at a Turning. */
export const SEAT_RECORDS_CACHE_MS = 5 * 60_000;
/** SEAT1b: where this device keeps the Watch's receipts not yet counted - `[{ r, s, i, e }]`, each its receipt, its
 *  account, and when it was issued and expires (the relay's clock). */
export const SEAT_WATCH_KEY = 'seat1.watch';
/** SEAT1b: the most kept - a day's ticks (the service counts no more than that an account a day anyway). */
export const SEAT_WATCH_HELD_MAX = 60;
/** SEAT1b: the longest a held receipt waits before the kept ones are claimed, ms. */
export const SEAT_WATCH_CLAIM_EVERY_MS = 10 * 60_000;
/** STORM-SHED (2026-10-06 evening, the account service overloaded a second time - "D1 DB is overloaded"): HOW LONG A
 *  WATCH CLAIM THAT FAILED WAITS BEFORE THE NEXT, ms - doubling with each failure in a row to SEAT_WATCH_CLAIM_EVERY_MS,
 *  jittered (net/backoff.js), and an answer lets it go. The claim is asked each frame and keeps its receipts through a
 *  failure, so the frame after a failed answer claimed again: in the outage's two hours /v1/seats/watch was asked 5,587
 *  times where 600 is the pace, 76% of them failing, and every one of them read each seat's witnesses. */
export const SEAT_WATCH_RETRY_MS = 30_000;
/** CROWN2: the red announcements this device has put in chat (their ids, newest kept), and how many it keeps. */
export const SEAT_RED_SEEN_KEY = 'crown2.redSeen';
export const SEAT_RED_SEEN_MAX = 100;
/** CROWN2: how often an online client reads the seats' list again for the server's red lines, ms. */
export const SEAT_RED_READ_MS = 15 * 60_000;
/** AUDIT SEATS-3 C5: how long after a list read that FAILED (offline, a timeout, the service's fault - never a refusal)
 *  the frame asks again, ms. */
export const SEAT_LIST_RETRY_MS = 60_000;
/** SEAT2b part two (7.5): the Watchtowers' words said on this device (`week:seat:guild:share`) - its key, the most kept -
 *  and how often a holder's member asks its towers. */
export const SEAT_TOWERS_KEY = 'seat2b.towers';
export const SEAT_TOWERS_SAID_MAX = 100;
export const SEAT_TOWERS_EVERY_MS = 10 * 60_000;
/** SEAT1b: the answers after which a claim's receipts are let go - counted, or refused for good (a watch claim answers
 *  each receipt's fate in its `why`, and none of them is mended by asking again). AUDIT-SEATS C10: and the seats shut to
 *  this account - but never `auth` or `no-session`: a session run out is mended by signing in again, and the ticks it
 *  held were dropped with it. */
const WATCH_SETTLED = Object.freeze(['bad-watch', 'seats-need-account', 'seats-closed']);
/** AUDIT-SEATS C9: THE STANDINGS' CACHE, whose every clear (an act, a claim, a Tribute) moves its generation - so a read
 *  asked BEFORE an act and answered after it is not kept as the seat's standings (it was the seat before the act: the
 *  Edict just proclaimed read as none for the cache's thirty seconds). */
class StandingsCache extends Map {
  gen = 0;
  clear() { this.gen++; super.clear(); }
}

/** A developer's chat word (SEAT0 3.2: "`/seat strike <key>`"): `{ op: 'strike', key }`, `{ error }` in words, or null
 *  when the line is not /seat. NEVER GUARDED HERE (RED1's law): whether this player may is the service's question. */
export const SEAT_USAGE = 'Usage: /seat strike <seat key> - the map id a developer sees on the seat.';
export function parseSeatCommand(text) {
  const m = /^\/seat(?:\s+([\s\S]*))?$/i.exec(String(text ?? '').trim());
  if (!m) return null;
  const [op, key, ...more] = (m[1] ?? '').trim().split(/\s+/).filter(Boolean);
  const k = Number(key);
  if (String(op ?? '').toLowerCase() !== 'strike' || !/^\d+$/.test(key ?? '') || !seatKeyOk(k) || more.length) return { error: SEAT_USAGE };
  return { op: 'strike', key: k };
}
/** VOID (Seats-Arc 18: "Moderators (MOD1) may **void a siege** (`/siege void`)"): a moderator's chat word -
 *  `{ op: 'void', key }`, `{ error }` in words, or null when the line is not /siege. NEVER GUARDED HERE (RED1's law): whether
 *  this player may is the service's question (server-account/src/seatSiege.js voidSiege). */
export const SIEGE_USAGE = 'Usage: /siege void <seat key> - the map id of the seat whose battle this week was won by an exploit.';
export function parseSiegeCommand(text) {
  const m = /^\/siege(?:\s+([\s\S]*))?$/i.exec(String(text ?? '').trim());
  if (!m) return null;
  const [op, key, ...more] = (m[1] ?? '').trim().split(/\s+/).filter(Boolean);
  const k = Number(key);
  if (String(op ?? '').toLowerCase() !== 'void' || !/^\d+$/.test(key ?? '') || !seatKeyOk(k) || more.length) return { error: SIEGE_USAGE };
  return { op: 'void', key: k };
}

/**
 * @param {{
 *   door: ReturnType<typeof import('./accountClient.js').accountSeats>,
 *   storage?: { getItem: (k: string) => (string|null), setItem: (k: string, v: string) => void }|null,
 *   nowMs?: () => number,
 *   me?: () => (string|null), character?: () => (string|null), rid?: () => string,
 *   isSeatPixel?: (x: number, y: number) => boolean, relayNowS?: () => (number|null),
 *   onRed?: ((line: { text: string, at: number }) => boolean)|null,
 *   rand?: () => number,
 * }} deps SEAT1b: `me` the signed-in account's id, `character` the character standing here, `rid` a fresh request id
 *   (the Marks' own shape), `isSeatPixel` whether this client's own derivation holds a seat at a map pixel, `relayNowS`
 *   the relay's clock (null unheard - a receipt's life is the relay's); CROWN2: `onRed` says a red line (false: not yet);
 *   STORM-SHED: `rand` Math.random's shape, a failed Watch claim's jitter
 */
export function createTownSeatBook({ door, storage = null, nowMs = () => Date.now(), me = () => null, character = () => null, rid = () => mintMarksRid(), isSeatPixel = () => false, relayNowS = () => null, onRed = null, rand = Math.random }) {
  /** CROWN2: the red lines already said, by id - read from the device once */
  let redSeen = null;
  const redSeenList = () => {
    if (redSeen) return redSeen;
    redSeen = [];
    try {
      const v = JSON.parse(storage?.getItem?.(SEAT_RED_SEEN_KEY) ?? 'null');
      if (Array.isArray(v)) redSeen = v.filter((id) => Number.isSafeInteger(id)).slice(-SEAT_RED_SEEN_MAX);
    } catch { /* a bad key reads as none */ }
    return redSeen;
  };
  /** CROWN2: each red line the list carries that this device has not said yet, handed to `onRed` oldest first - kept as
   *  said unless `onRed` answers false (no chat to say it in yet: the next read offers it again). */
  const sayRed = (rows) => {
    if (!onRed || !Array.isArray(rows)) return;
    const seen = redSeenList();
    const said = rows.filter((r) => Number.isSafeInteger(r?.id) && typeof r.text === 'string' && !seen.includes(r.id))
      .filter((r) => onRed({ text: r.text, at: Number(r.at) * 1000 }) !== false);
    if (!said.length) return;
    redSeen = [...seen, ...said.map((r) => r.id)].slice(-SEAT_RED_SEEN_MAX);
    try { storage?.setItem?.(SEAT_RED_SEEN_KEY, JSON.stringify(redSeen)); } catch { /* this page keeps them */ }
  };
  /** whether the seats are open to this account, as the last read said: true, false, or null not yet asked */
  let open = null;
  let data = null, at = -Infinity, pending = null;
  /** AUDIT SEATS-3 C5: whether the last list read failed (no answer, or the service's fault) - redTick asks again */
  let failed = false;
  /** @type {Map<number, string>} the confirmed seats' states, by key */
  let states = new Map();
  /** SEAT1c: each confirmed seat's holder and this week's battle at it, by key */
  let dress = new Map();
  let reported = null;
  const reportedTable = () => {
    if (reported) return reported;
    reported = {};
    try {
      const v = JSON.parse(storage?.getItem?.(SEAT_REPORTED_KEY) ?? 'null');
      if (v && typeof v === 'object' && !Array.isArray(v)) reported = v;
    } catch { /* a bad key reads as none */ }
    return reported;
  };
  const writeReported = (t) => {
    const keep = Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, SEAT_REPORTED_MAX);
    reported = Object.fromEntries(keep);
    try { storage?.setItem?.(SEAT_REPORTED_KEY, JSON.stringify(reported)); } catch { /* this page keeps it */ }
  };
  const dayNow = () => Math.floor(nowMs() / 1000 / SEAT_REPORT_EVERY_S);
  /** SEAT1b: each seat's standings as last read, `{ at, data }` by key (AUDIT-SEATS C9: cleared by generation); the
   *  Tribute asked and its one request id */
  const standingsAt = new StandingsCache();
  /** SEASON1 part three: each seat's Hall of Records as last read, `{ at, data }` by key */
  const recordsAt = new Map();
  /** @type {{ ask: string, rid: string }|null} */
  let tributeAsk = null;
  /** SEAT2b: a project begun - its ask and its one request id, as the Tribute's */
  /** @type {{ ask: string, rid: string }|null} */
  let fortAsk = null;
  /** SEAT2b part two: the Watchtowers' words already said (`week:seat:guild:share`), read from the device once, and the
   *  last ask's moment and its flight */
  let towersSaid = null, towersAt = -Infinity, towersBusy = false;
  const towersSaidList = () => {
    if (towersSaid) return towersSaid;
    towersSaid = [];
    try {
      const v = JSON.parse(storage?.getItem?.(SEAT_TOWERS_KEY) ?? 'null');
      if (Array.isArray(v)) towersSaid = v.filter((x) => typeof x === 'string').slice(-SEAT_TOWERS_SAID_MAX);
    } catch { /* a bad key reads as none */ }
    return towersSaid;
  };
  /** SEAT2b part two: the seats `guild` holds whose Watchtowers stand, as the list last said them. */
  // AUDIT SEATS-3 C4: asked each frame (towersDue) - kept by the list read and the guild, filtered again only when either moves
  let _towersOf = null, _towersGuild = null, _towers = [];
  const towerSeats = (guild) => {
    if (!guild) return [];
    if (data !== _towersOf || guild !== _towersGuild) {
      _towersOf = data; _towersGuild = guild;
      _towers = (data?.seats ?? []).filter((s) => s?.holder?.guild?.id === guild && Number(s?.forts?.watchtowers ?? 0) >= 1);
    }
    return _towers;
  };
  /** SEAT1b: the Watch's receipts held - read from the device once, kept in memory where the store refuses writes */
  let watchList = null, watchBusy = false;
  /** STORM-SHED: the failed claims in a row, and the page's time before which none is asked again */
  let watchFails = 0, watchRetryAt = -Infinity;
  const watchHeld = () => {
    if (watchList) return watchList;
    watchList = [];
    try {
      const v = JSON.parse(storage?.getItem?.(SEAT_WATCH_KEY) ?? 'null');
      if (Array.isArray(v)) watchList = v.filter((w) => w && typeof w.r === 'string' && typeof w.s === 'string' && Number.isSafeInteger(w.i) && Number.isSafeInteger(w.e)).slice(-SEAT_WATCH_HELD_MAX);
    } catch { /* a bad key reads as none */ }
    return watchList;
  };
  const writeWatch = (list) => {
    watchList = list;
    try { storage?.setItem?.(SEAT_WATCH_KEY, JSON.stringify(list)); } catch { /* this page keeps them */ }
  };

  /** The confirmed seats: the last answer inside SEAT_LIST_CACHE_MS (a refusal too) and this seat week, else the service's. */
  function read({ force = false } = {}) {
    // AUDIT FESTIVAL S1: a list read before the Turning is last week's - its holders' edicts (a Festival, a Curfew) gone
    if (!force && nowMs() - at < SEAT_LIST_CACHE_MS && seatWeekOf(at) === seatWeekOf(nowMs())) return Promise.resolve({ data, error: open === false ? 'seats-closed' : null });
    if (pending) return pending;
    pending = (async () => {
      let r;
      try { r = await door.list(); } catch { r = { ok: false, error: 'offline' }; }
      pending = null;
      // a session not yet there is asked again at the next ask (a player who signs in sees the seats then); any other
      // answer, a refusal too, holds the list's minutes
      at = r?.error === 'no-session' ? -Infinity : nowMs();
      failed = !r?.ok && !SHUT.includes(r?.error);   // AUDIT SEATS-3 C5
      if (r?.ok) {
        open = true; data = r.data;
        states = new Map((data?.seats ?? []).map((s) => [s.key, s.state]));
        dress = new Map((data?.seats ?? []).map((s) => [s.key, { holder: s.holder ?? null, battle: s.battle ?? null, forts: s.forts ?? null }]));   // SEAT2b part two: its works standing
        sayRed(data?.red);   // CROWN2: the server's red lines, each said once
        return { data, error: null };
      }
      if (SHUT.includes(r?.error)) { open = false; data = null; states = new Map(); dress = new Map(); }
      return { data, error: r?.error ?? 'server' };
    })();
    return pending;
  }

  return {
    read,
    /** Whether the seats are open to this account, as the last read said (null before any). */
    get open() { return open; },
    /** A seat's state as the witnesses say it - 'confirmed', 'disputed', or null (unconfirmed, or not read). */
    stateOf: (key) => states.get(key) ?? null,
    /** The last list read, or null. */
    get data() { return data; },
    /** SEAT1c: a seat this client derived, dressed in what the service last said of it - its holder and this week's battle
     *  there (both null for an unheld, quiet one, or a seat not read yet). */
    dressed: (seat) => (seat ? { ...seat, holder: dress.get(seat.key)?.holder ?? null, battle: dress.get(seat.key)?.battle ?? null, forts: dress.get(seat.key)?.forts ?? null } : null),   // SEAT2b part two: and its works
    /** SEAT1c: the guildmaster gives up a Charter at its board - `{ ok, text }`, the list and standings read afresh after. */
    async relinquish(seat) {
      let r;
      try { r = await door.relinquish(character(), seat.key); } catch { r = { ok: false, error: 'offline' }; }
      standingsAt.clear();
      if (r?.ok) at = -Infinity;
      return r?.ok ? { ok: true, text: `Your guild has given up the Charter of ${seat.name}.` } : { ok: false, text: accountRefusalText(r?.error) };
    },
    /**
     * THE SEAT THIS CLIENT STANDS IN, REPORTED - once a UTC day a seat (this device's), only while the seats are open to
     * this account. Answers whether a report was sent. A refusal is quiet: the town is the same town either way.
     * @param {any} seat the client's own derivation (systems/townSeats.js)
     */
    async witness(seat) {
      const s = seatReportOf(seat);
      if (!s || open !== true) return false;
      const t = reportedTable();
      if (t[String(s.key)] === dayNow()) return false;
      t[String(s.key)] = dayNow();
      writeReported(t);
      try { await door.witness(s); } catch { /* the next day asks again */ }
      return true;
    },
    // ─── SEAT1d: THE HOLDER'S LEVERS, A BOUNTY'S CAMP ───────────────
    /** The Tithe at `seat` set (an Officer's or the guildmaster's, once a week) - `{ ok, text }`, the standings read afresh. */
    async tithe(seat, pct) {
      let r;
      try { r = await door.tithe(character(), seat.key, pct); } catch { r = { ok: false, error: 'offline' }; }
      standingsAt.clear();
      if (r?.ok) at = -Infinity;
      return r?.ok ? { ok: true, text: `The Tithe at ${seat.name} is ${pct}% from the next sale.` } : { ok: false, text: accountRefusalText(r?.error) };
    },
    /** The coming week's Edict at `seat` proclaimed (`edict` null: taken back) - `{ ok, text }`. A Bounty names what it
     *  sets aside. */
    async edict(seat, edict, setAside = 0) {
      let r;
      try { r = await door.edict(character(), seat.key, edict, setAside); } catch { r = { ok: false, error: 'offline' }; }
      standingsAt.clear();
      if (!r?.ok) return { ok: false, text: accountRefusalText(r?.error) };
      return { ok: true, text: edict ? `${EDICTS[edict]?.name ?? 'The Edict'} is proclaimed at ${seat.name} for next week. The Turning makes it law.` : 'The Edict for next week is taken back.' };
    },
    // ─── SEAT2a: THE BATTLES' WEEK ───────────────────────────────────
    /** One act on this week's battle at `seat` - `{ ok, text }`, the standings read afresh after it. */
    async battleAct(seat, ask, said) {
      let r;
      try { r = await ask(); } catch { r = { ok: false, error: 'offline' }; }
      standingsAt.clear();
      return r?.ok ? { ok: true, text: said(r.data ?? {}) } : { ok: false, text: accountRefusalText(r?.error) };
    },
    /** The holder's window at `seat` set - an Officer's or the guildmaster's. */
    window(seat, day, hour) {
      return this.battleAct(seat, () => door.window(character(), seat.key, day, hour), () => `The battles at ${seat.name} are fought from ${siegeWindowText({ day, hour })}, from the next Turning.`);
    },
    /** This character signed onto its side of the battle at `seat` (or as a hired Sellsword). */
    sign(seat) {
      return this.battleAct(seat, () => door.sign(character(), seat.key), (d) => `You are signed for the ${d.side === 'attack' ? 'attackers' : 'defenders'}${d.sellsword ? ' as a Sellsword' : ''} at ${seat.name}.`);
    },
    /** This account's place on the battle at `seat` given back. */
    unsign(seat) {
      return this.battleAct(seat, () => door.unsign(seat.key), () => `You are no longer signed for the battle at ${seat.name}.`);
    },
    /** A Sellsword hired by name at a fee in Drakes - the side's Guildmaster's. */
    hire(seat, handle, fee) {
      return this.battleAct(seat, () => door.hire(character(), seat.key, handle, fee), () => `${handle} is offered a Sellsword's contract${fee ? ` at ${fee} silver` : ''}.`);
    },
    /** A Sellsword's contract withdrawn before it is signed. */
    withdrawHire(seat, handle) {
      return this.battleAct(seat, () => door.withdrawHire(character(), seat.key, handle), () => `${handle}'s contract is withdrawn.`);
    },
    // ─── SEAT2a part three: THE PASS AND THE CLAIM ───────────────────
    /** A pass into the battle at `seat` (`field` the field this game derived from the town) - `{ ok, pass, side, window }`
     *  or `{ ok: false, error, text }` (`field-unsettled` asks again in a moment). */
    async siegePass(seat, field) {
      let r;
      try { r = await door.pass(seat.key, field); } catch { r = { ok: false, error: 'offline' }; }
      if (!r?.ok) return { ok: false, error: r?.error ?? 'offline', text: accountRefusalText(r?.error) };
      const d = r.data ?? {};
      return { ok: true, pass: d.pass ?? null, side: d.side, week: d.week, startsAt: d.startsAt, endsAt: d.endsAt, window: d.window };
    },
    /** A fighter's `s1` receipt carried to the service - the battle's result, and this character's Honours where it earned
     *  them. `{ ok, result, winner, honours }` or `{ ok: false, error, text }`; the board's standings read afresh. */
    async claimSiege(receipt) {
      let r;
      try { r = await door.claimSiege(receipt, character()); } catch { r = { ok: false, error: 'offline' }; }
      standingsAt.clear();
      if (!r?.ok) return { ok: false, error: r?.error ?? 'offline', ...(r?.why ? { why: r.why } : {}), text: accountRefusalText(r?.error) };   // the rung, which the carrier reads (net/siegeClaims.js)
      const d = r.data ?? {};
      return { ok: true, result: d.result, winner: d.winner ?? null, honours: d.honours ?? null };
    },
    /** CROWN1 part two: A ROYAL TOURNEY'S PASS for `seat` - a contender's with the ring this game derived (`field`), or a
     *  spectator's (`watch`). `{ ok, pass, side, week, startsAt, endsAt }` or `{ ok: false, error, text }`. */
    async royalPass(seat, field, watch = false) {
      let r;
      try { r = await door.royalPass(seat.key, field, watch); } catch { r = { ok: false, error: 'offline' }; }
      if (!r?.ok) return { ok: false, error: r?.error ?? 'offline', text: accountRefusalText(r?.error) };
      const d = r.data ?? {};
      return { ok: true, pass: d.pass ?? null, side: d.side, week: d.week, startsAt: d.startsAt, endsAt: d.endsAt };
    },
    /** CROWN1 part two: a bout's `t1` receipt carried to the service - `{ ok, counted, wins }` or `{ ok: false, error, text }`;
     *  the board's standings read afresh (its ladder moved). */
    async claimRoyal(receipt) {
      let r;
      try { r = await door.claimRoyal(receipt); } catch { r = { ok: false, error: 'offline' }; }
      standingsAt.clear();
      if (!r?.ok) return { ok: false, error: r?.error ?? 'offline', ...(r?.why ? { why: r.why } : {}), text: accountRefusalText(r?.error) };
      const d = r.data ?? {};
      return { ok: true, counted: !!d.counted, wins: Number(d.wins ?? 0) };
    },
    // ─── CROWN2: FEALTY AND PACTS ────────────────────────────────────
    /** One act on this guild's crown politics - `{ ok, text }`, the standings read afresh after it. */
    async politicsAct(ask, said) {
      let r;
      try { r = await ask(); } catch { r = { ok: false, error: 'offline' }; }
      standingsAt.clear();
      return r?.ok ? { ok: true, text: said(r.data ?? {}) } : { ok: false, text: accountRefusalText(r?.error) };
    },
    /** Fealty offered to the guild tagged `tag` - `as` 'vassal' (this guild swears to it) or 'liege' (takes it as vassal). */
    offerFealty(tag, as) {
      return this.politicsAct(() => door.fealty(character(), tag, as), () => (as === 'vassal' ? `Your guild offers to swear fealty to <${tag}>.` : `Your guild offers to take <${tag}> as its vassal.`));
    },
    /** The fealty <tag> offered, accepted - sworn from this week. */
    acceptFealty(tag) {
      return this.politicsAct(() => door.fealtyAccept(character(), tag), () => `The fealty with <${tag}> is sworn.`);
    },
    /** This guild's fealty with <tag> broken at the next Turning (a vassal's needs no tag) - or its offer withdrawn. */
    breakFealty(tag) {
      return this.politicsAct(() => door.fealtyBreak(character(), tag), (d) => (d.withdrawn ? 'Your guild\'s offer of fealty is withdrawn.' : 'The fealty ends at the Turning. Your guild loses 10 Standing at each seat it holds.'));
    },
    /** A Pact offered to <tag>, or its offer signed. */
    offerPact(tag) {
      return this.politicsAct(() => door.pact(character(), tag), (d) => (d.signed ? `The Pact with <${tag}> is signed, until week ${d.until}.` : `Your guild offers <${tag}> a Pact of non-aggression.`));
    },
    /** The Pact with <tag> broken (a signed one is announced to everyone in red) - or its offer withdrawn. */
    /** AUDIT-SEATS: the offer of fealty the guild tagged `tag` made to this one, declined. */
    declineFealty(tag) {
      return this.politicsAct(() => door.fealtyBreak(character(), tag), (d) => (d.declined ? `The offer of fealty from <${tag}> is declined.` : d.withdrawn ? 'Your guild\'s offer of fealty is withdrawn.' : 'The fealty ends at the Turning. Your guild loses 10 Standing at each seat it holds.'));
    },
    /** AUDIT-SEATS: the offer of a Pact the guild tagged `tag` made to this one, declined (an unsigned offer's break). */
    declinePact(tag) {
      return this.politicsAct(() => door.pactBreak(character(), tag), (d) => (d.announced ? `Your guild has broken its Pact with <${tag}>. Everyone has been told.` : `The offer of a Pact from <${tag}> is declined.`));
    },
    breakPact(tag) {
      return this.politicsAct(() => door.pactBreak(character(), tag), (d) => (d.announced ? `Your guild has broken its Pact with <${tag}>. Everyone has been told.` : `The offer of a Pact with <${tag}> is withdrawn.`));
    },
    /** CROWN2: the seats' list read again for the server's red lines, while the seats are open, every SEAT_RED_READ_MS -
     *  AUDIT FESTIVAL S1: and once at the Turning. */
    redTick() {
      // AUDIT SEATS-3 C5: and a read that failed (the first at the session's start above all - the seats left shut, never
      // asked again by the frame) asked again every SEAT_LIST_RETRY_MS until one answers
      if (!pending && (open === true || failed) && nowMs() - at >= (failed ? SEAT_LIST_RETRY_MS : SEAT_RED_READ_MS)) read({ force: true });
      // AUDIT FESTIVAL S1: and once when the seat week turns - a player who stays in a town sees the Festival (or Curfew)
      // that ended at the Turning end, and the one that became law begin (the read is this week's: asked once)
      else if (!pending && open === true && seatWeekOf(at) !== seatWeekOf(nowMs())) read({ force: true });
    },
    // ─── SEASON1 part two: THE TIDES AS THIS CLIENT READS THEM ───────
    /** The week Season 0 began, as the seats' list last said - or null (no Season counted: every land is Calm). */
    get zero() { return Number.isSafeInteger(data?.zero) ? data.zero : null; },
    /** The Tide at `region` this seat week, while the seats are open to this account and a Season is counted - else Calm. */
    tideAt(region) {
      if (open !== true) return 'calm';
      const week = seatWeekOf(nowMs());
      return tideAt(week, region, !!seasonOf(week, this.zero));
    },
    /** An Orc Raid's camp cleared in `region` - its influence for this character's guild where the Tide is Orc Raids.
     *  Quiet: `{ counted }`. */
    async orcCamp(site, region) {
      if (open !== true) return { counted: false };
      let r;
      try { r = await door.orcCamp(character(), site, region); } catch { r = { ok: false, error: 'offline' }; }
      if (r?.ok) standingsAt.clear();
      return { counted: !!(r?.ok && r.data?.counted) };
    },
    /** A World of Daggerfall camp cleared in `region` - the Bounty's twenty Drakes where one rules there. Quiet: `{ paid }`. */
    async bounty(site, region) {
      if (open !== true) return { paid: 0 };
      let r;
      try { r = await door.bounty(character(), site, region); } catch { r = { ok: false, error: 'offline' }; }
      return { paid: r?.ok ? Number(r.data?.paid ?? 0) : 0 };
    },
    // ─── SEAT1b: INFLUENCE ─────────────────────────────────────────
    /** A seat's standings (`/v1/seats/standings`, with this character's own guild): the last answer inside
     *  SEAT_STANDINGS_CACHE_MS, else the service's. `{ data, error }`. */
    async standings(key, { force = false } = {}) {
      const kept = standingsAt.get(key);
      if (!force && kept && nowMs() - kept.at < SEAT_STANDINGS_CACHE_MS) return { data: kept.data, error: null };
      const gen = standingsAt.gen;   // AUDIT-SEATS C9: an act between the ask and its answer makes the answer old
      let r;
      try { r = await door.standings(key, character()); } catch { r = { ok: false, error: 'offline' }; }
      if (r?.ok) { if (gen === standingsAt.gen) standingsAt.set(key, { at: nowMs(), data: r.data }); return { data: r.data, error: null }; }
      if (SHUT.includes(r?.error)) open = false;
      return { data: kept?.data ?? null, error: r?.error ?? 'server' };
    },
    /** SEASON1 part three (Seats-Arc 9.2): A SEAT'S HALL OF RECORDS (`/v1/seats/records`) - its Chronicle oldest first and
     *  the week Season 0 began, `{ data: { rows, zero }, error }`; the last answer inside SEAT_RECORDS_CACHE_MS. */
    async records(key) {
      const kept = recordsAt.get(key);
      if (kept && nowMs() - kept.at < SEAT_RECORDS_CACHE_MS) return { data: kept.data, error: null };
      if (open !== true) return { data: null, error: 'seats-closed' };
      let r;
      try { r = await door.records(key); } catch { r = { ok: false, error: 'offline' }; }
      if (r?.ok) {
        const data = { rows: Array.isArray(r.data?.rows) ? r.data.rows : [], zero: Number.isSafeInteger(r.data?.zero) ? r.data.zero : null };
        recordsAt.set(key, { at: nowMs(), data });
        return { data, error: null };
      }
      if (SHUT.includes(r?.error)) open = false;
      return { data: null, error: r?.error ?? 'server' };
    },
    /** SEAT2b (Seats-Arc 7.9): A SEAT'S WORKS (`/v1/seats/forts`) - each work's tier and the project raising it, and the
     *  stockpile, `{ data: { works, stockpile }, error }`. Read afresh each time the tab is: a delivery moves it. */
    async forts(key) {
      if (open !== true) return { data: null, error: 'seats-closed' };
      let r;
      try { r = await door.forts(key); } catch { r = { ok: false, error: 'offline' }; }
      if (r?.ok) return { data: { works: r.data?.works ?? {}, stockpile: Array.isArray(r.data?.stockpile) ? r.data.stockpile : [] }, error: null };
      if (SHUT.includes(r?.error)) open = false;
      return { data: null, error: r?.error ?? 'server' };
    },
    /** SEAT2b (7.5): a project begun on `work` at `seat` - its tier's Drakes burnt from the holder's treasury (an Officer's
     *  or the guildmaster's), `port` whether DFU names the town a port (a Harbour's ask). `{ ok, text, forts }`. ONE
     *  REQUEST ID A PROJECT, as the Tribute's: the same work asked again after an answer that never came carries the same
     *  id, and the service answers it `repeat` rather than burning twice. */
    async fortFund(seat, work, port = false) {
      const ask = `${seat.key}:${work}`;
      if (fortAsk?.ask !== ask) fortAsk = { ask, rid: rid() };
      const id = fortAsk.rid;
      let r;
      try { r = await door.fortFund(character(), seat.key, work, id, port); } catch { r = { ok: false, error: 'offline' }; }
      if (r?.ok || (r?.error && !['offline', 'server', 'timeout'].includes(r.error))) { if (fortAsk?.rid === id) fortAsk = null; }
      standingsAt.clear();
      if (!r?.ok) return { ok: false, text: accountRefusalText(r?.error) };
      const name = fortWork(work)?.name ?? 'work';
      const forts = r.data?.forts ?? null;
      if (r.data?.repeat) return { ok: true, text: `Work on the ${name} at ${seat.name} was already begun.`, forts };
      return { ok: true, text: `Work on the ${name} at ${seat.name} is begun toward tier ${r.data?.tier}: ${Number(r.data?.marks ?? 0).toLocaleString('en-US')} silver from the treasury. Seat writs deliver what they need.`, forts };
    },
    /** A pledge to `seat` for this week (an Officer's or the guildmaster's) - `{ ok, text }`, the standings read afresh after. */
    async pledge(seat) {
      let r;
      try { r = await door.pledge(character(), seat.key); } catch { r = { ok: false, error: 'offline' }; }
      standingsAt.clear();
      return r?.ok ? { ok: true, text: `Your guild is pledged to ${seat.name} this week.` } : { ok: false, text: accountRefusalText(r?.error) };
    },
    /** The pledge in `region` taken down - `{ ok, text }`. */
    async unpledge(region) {
      let r;
      try { r = await door.pledge(character(), null, region); } catch { r = { ok: false, error: 'offline' }; }
      standingsAt.clear();
      return r?.ok ? { ok: true, text: 'The pledge is taken down.' } : { ok: false, text: accountRefusalText(r?.error) };
    },
    /** TRIBUTE: `marks` Drakes of the guild's treasury burnt on its pledge at `seat` (the guildmaster's) - `{ ok, text }`.
     *  ONE REQUEST ID A PAYMENT: the same seat and sum asked again after an answer that never came carries the same id, so
     *  the service answers it `repeat` rather than burning twice; any answer lets the id go. */
    async tribute(seat, marks) {
      const ask = `${seat.key}:${marks}`;
      if (tributeAsk?.ask !== ask) tributeAsk = { ask, rid: rid() };
      const id = tributeAsk.rid;
      let r;
      try { r = await door.tribute(character(), seat.key, marks, id); } catch { r = { ok: false, error: 'offline' }; }
      if (r?.ok || (r?.error && !['offline', 'server', 'timeout'].includes(r.error))) { if (tributeAsk?.rid === id) tributeAsk = null; }
      standingsAt.clear();
      if (!r?.ok) return { ok: false, text: accountRefusalText(r?.error) };
      return { ok: true, text: r.data?.repeat ? 'That Tribute was already paid.' : `Tribute paid to ${seat.name}: ${marks} silver burnt, ${r.data?.influence ?? marks / 10} influence.` };
    },
    /**
     * THE WATCH'S TICK, KEPT (net/online.js `onWatch`): a signed receipt for the signed-in account, in a seat's own pixel as
     * this client derives the seats, still alive by the relay's clock - kept on the device until it is counted. Answers
     * whether it was kept. Nothing is kept while the seats are shut to this account.
     */
    keepWatch(r) {
      const c = readWatchReceipt(r);
      const t = relayNowS();
      if (!c || !c.signed || open === false || c.s !== me() || !isSeatPixel(c.x, c.y) || (t != null && c.e <= t)) return false;
      const list = watchHeld().filter((w) => t == null || w.e > t);   // the dead let go as a new one comes
      if (list.some((w) => w.r === r)) return false;
      list.push({ r, s: c.s, i: c.i, e: c.e });
      writeWatch(list.slice(-SEAT_WATCH_HELD_MAX));
      return true;
    },
    /** How many receipts this device holds for the signed-in account. */
    watchHeldCount: () => watchHeld().filter((w) => w.s === me()).length,
    /** AUDIT-SEATS C12: WHETHER claimWatch WOULD CLAIM NOW - its own test, asked each frame before the async call
     *  (scenes/world.js), counted in a loop: a frame with nothing due makes no Promise and no list. */
    claimWatchDue() {
      if (watchBusy || open !== true || nowMs() < watchRetryAt) return false;   // STORM-SHED: a failed claim's wait
      const list = watchHeld(), who = me(), t = relayNowS();
      let n = 0, oldest = Infinity;
      for (const w of list) if (w.s === who && (t == null || w.e > t)) { n++; if (w.i < oldest) oldest = w.i; }
      return n > 0 && (n >= SEAT_WATCH_CLAIM_MAX || (t == null ? nowMs() : t * 1000) - oldest * 1000 >= SEAT_WATCH_CLAIM_EVERY_MS);
    },
    /**
     * THE KEPT TICKS CLAIMED (`/v1/seats/watch`) - the signed-in account's, SEAT_WATCH_CLAIM_MAX at a time, once a claim's
     * worth is held or the oldest has waited SEAT_WATCH_CLAIM_EVERY_MS (`force` now). An answer lets the claimed ones go
     * (counted or not - each receipt's fate is the service's, never mended by asking again); no answer keeps them.
     * Answers the service's `{ counted, why }`, or null for no claim.
     */
    async claimWatch({ force = false } = {}) {
      if (watchBusy || open !== true) return null;
      if (!force && nowMs() < watchRetryAt) return null;   // STORM-SHED: a failed claim's wait
      const who = me();
      const t = relayNowS();
      const mine = watchHeld().filter((w) => w.s === who && (t == null || w.e > t));
      if (!mine.length) return null;
      const oldest = Math.min(...mine.map((w) => w.i)) * 1000;
      if (!force && mine.length < SEAT_WATCH_CLAIM_MAX && (t == null ? nowMs() : t * 1000) - oldest < SEAT_WATCH_CLAIM_EVERY_MS) return null;
      const batch = mine.slice(0, SEAT_WATCH_CLAIM_MAX);
      watchBusy = true;
      let r;
      try { r = await door.watch(character(), batch.map((w) => w.r)); } catch { r = { ok: false, error: 'offline' }; } finally { watchBusy = false; }
      const settled = r?.ok || WATCH_SETTLED.includes(r?.error);   // AUDIT-SEATS C10: a session run out keeps them
      if (settled) {
        const gone = new Set(batch.map((w) => w.r));
        writeWatch(watchHeld().filter((w) => !gone.has(w.r)));
        if (r?.ok) standingsAt.clear();
        watchFails = 0; watchRetryAt = -Infinity;
      } else {
        // STORM-SHED: kept for the next claim - which waits, the longer the more failures in a row
        watchFails += 1;
        watchRetryAt = nowMs() + jittered(Math.min(SEAT_WATCH_CLAIM_EVERY_MS, SEAT_WATCH_RETRY_MS * 2 ** (watchFails - 1)), rand);
      }
      return r?.ok ? r.data : null;
    },
    /** SEAT2b part two (Seats-Arc 7.5): WHETHER THE WATCHTOWERS ARE DUE TO BE ASKED - `guild` (the playing character's)
     *  holds a seat whose Watchtowers stand and SEAT_TOWERS_EVERY_MS has passed since the last ask. Asked in sync each
     *  frame (scenes/world.js), as claimWatchDue: a frame with nothing due makes no Promise. */
    towersDue(guild) {
      return !towersBusy && open === true && nowMs() - towersAt >= SEAT_TOWERS_EVERY_MS && towerSeats(guild).length > 0;
    },
    /** SEAT2b part two (7.5: "the holder is told when a challenger passes half its defence (tier 1) or a quarter (tier
     *  2)"): THE WATCHTOWERS ASKED - each seat `guild` holds with Watchtowers, its standings read (the service answers
     *  `towers` to the holder's members alone - seatInfluence.js readStandings) and every challenger past the towers'
     *  share not yet said this week handed to `say` (fortLaw.js towersText), kept as said on the device. Answers the
     *  lines said.
     *  @param {string|null} guild @param {(text: string) => void} [say] */
    async towers(guild, say = (_text) => {}) {
      if (towersBusy) return [];
      towersBusy = true; towersAt = nowMs();
      const lines = [];
      try {
        for (const s of towerSeats(guild)) {
          const r = await this.standings(s.key, { force: true });
          const week = r.data?.week;
          for (const w of Array.isArray(r.data?.towers) ? r.data.towers : []) {
            const id = `${week}:${s.key}:${w.guild}:${w.share}`;
            const said = towersSaidList();
            if (said.includes(id)) continue;
            const text = towersText(s.name ?? 'the seat', guildWords({ name: w.name, tag: w.tag }), w.share);
            say(text);
            lines.push(text);
            towersSaid = [...said, id].slice(-SEAT_TOWERS_SAID_MAX);
            try { storage?.setItem?.(SEAT_TOWERS_KEY, JSON.stringify(towersSaid)); } catch { /* this page keeps them */ }
          }
        }
      } finally { towersBusy = false; }
      return lines;
    },
    /** The chat's `/seat strike <key>`: a developer's strike - the list read afresh after. */
    async strike(key) {
      let r;
      try { r = await door.strike(key); } catch { r = { ok: false, error: 'offline' }; }
      if (r?.ok) { at = -Infinity; return { ok: true, text: `Seat ${key} is struck from the registry (${r.data?.reports ?? 0} reports).` }; }
      return { ok: false, text: accountRefusalText(r?.error) };
    },
    /** VOID: the chat's `/siege void <key>` - a moderator's void of the seat's battle this week; the list and the standings
     *  read afresh after (a Charter may have gone back). */
    async voidSiege(key) {
      let r;
      try { r = await door.voidSiege(key); } catch { r = { ok: false, error: 'offline' }; }
      if (!r?.ok) return { ok: false, text: accountRefusalText(r?.error) };
      at = -Infinity;
      standingsAt.clear();
      const what = r.data?.battle === 'tourney' ? 'Tourney' : r.data?.battle === 'revolt' ? 'revolt' : 'siege';
      if (r.data?.repeat) return { ok: true, text: `The ${what} at seat ${key} is void already.` };
      return { ok: true, text: `The ${what} at seat ${key} is voided${r.data?.restored ? ' - its Charter went back to the guild that held it' : ''}.` };
    },
  };
}
