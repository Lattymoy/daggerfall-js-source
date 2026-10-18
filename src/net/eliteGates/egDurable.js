// @ts-check
// EG-H2 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 22, slice EG8e):
// DURABILITY - an Elite Breach is a three-hour instance on infrastructure that restarts. A relay deploy drops every
// socket and restarts every Durable Object; the runtime may evict one at any time. The breach's room (server/src/index.js
// `_egOf`, `_egTick`) keeps its record in storage (every CHECKPOINT_MS, and at once at every word that moves it) and this
// law is what it does when it wakes:
//
//   TIME ACROSS A RESTART - a beat gap over EG_GAP_MS is GIVEN BACK (`egGiveBack`): every instant the record holds after
//     its first wake moves forward by the gap, so the count, the hall's timers, the lords' clocks and each member's
//     absence do not run across it. The sealed hour and the open window run on the wall clock, as the call says them,
//     and the last word never moves (the stake's live window at the service is the wall clock's too).
//   THE HOLD - a room that wakes between trials (a closing, the swap to the next hall, a rest) HOLDS: the count frozen,
//     the director still, until every living member is back in the room or EG_REJOIN_MS (180 s) has passed; then the
//     whole gap since its last beat is given back and the count runs on (`egResume`, `egHoldDone`, `egRelease`). A
//     member who returns finds the hall where they left it. A room that wakes mid-trial gives the gap back at once, and
//     the dropped socket's rule (section 6.1) carries the rest.
//   THE LAW PIN - a breach records `egv`, the spec law it was opened under (net/eliteGates/egBrain.js egBreachNew). EG_LAWS are the
//     laws this build draws, each with the day it became the law; a law is kept EG_LAW_KEEP_DAYS (seven days) before it
//     may leave the table. A woken room whose law is not here ends its breach with `why: 'void'` (the stake returned,
//     the Redoubts taken kept); a client whose law is not the breach's asks `{k:'spec'}` and builds from the relay's own
//     bytes (net/eliteGates/egLaw.js egSpecGive).
//   SECRET, DETERMINISTIC RECEIPTS - a receipt's seed is HMAC-SHA-256(rs, sub|R|kind)'s first 32 bits (`egReceiptSeed`):
//     `rs` is 32 bytes the room draws at the open and never sends, so a re-woken room mints the same roll again, never a
//     second one, and no client can compute one ahead (the leak AUDIT SD III R4 moved the Hour's honours off).
//   THE COST - at most EG_LIVE_MAX breaches live at once (the hub's list, `eglive`).
//
// EG-ZA (2026-10-12, Mac: "I said I want everything"; Elite-Gates.md sections 22 and 23 - "A key's loss", THE COST's
// tick): A KEY IS NEVER LOST, the law the hub and the breach's room keep (server/src/index.js `_egOpen`, `_egVoid`,
// `_egVoidInternal`, `_egRcInternal`, `_egTick`):
//   THE OPEN RETRIED - the hub tells a breach's room its open EG_OPEN_HUB_TRIES times (the room answers the same order
//     with the record it kept: idempotent on `ez`), and once the room is told the call went out (EG_INTERNAL_CALLED,
//     `B.called`) the breach may end `'empty'`; with no hall woken and no call out, its end is a void (net/eliteGates/egBrain.js
//     egEnd). An open the room never took is voided BY THE ROOM (EG_INTERNAL_VOID): it writes the order into its
//     tombstone first (`egdone`, EG_DONE_KEY) and mints the `v` once, so the order can never be accepted after and a
//     void asked again is the same receipt. A client holding a stake no call answered asks it (`{k:'void', z}`, to the
//     hub, which asks the room). A void past EG_VOID_MAX_S since the order's issue is refused; the tombstone - the
//     voided orders' and the ended breach's - is kept that long, and then the room forgets the breach.
//   THE RECEIPTS HELD - every receipt a room mints is told the hub (EG_INTERNAL_RCPT, told again EG_RC_TELL_MS on while
//     the hub has not answered - an ended breach beats on for it) and kept there under `egrc:<sub>` (egRcFold: one entry
//     a receipt, the newest of its kind, EG_RC_KEEP at most, each for its own life) until its account says the service
//     has counted it (`{k:'claimed', b, q, w}`) - handed to every hello meanwhile, so a member offline at the end has
//     theirs when they come back.
//   THE FORCE VOID - a `force` relay deploy stamps the Worker (`EG_VOID_BEFORE`, ms - .github/workflows/relay-deploy.yml):
//     a room woken under it whose breach opened before the stamp ends it as a void, the law pin's way (egResume).
//   THE TICK (section 22, THE COST) - a breach's beat is BRAIN_TICK_MS (EG_BEAT_TRIAL_MS) only while a trial runs with
//     its company in the room, EG_BEAT_SLOW_MS otherwise (never past the stage's own deadline, so no stage ends late),
//     and none while the arch rises: its next beat is the open (egTickAt). Every gap stays under EG_GAP_MS, so THE TIME
//     law gives nothing back for it.
//
// Pure (the receipt seed asks the platform's SubtleCrypto, handed in). In the relay bundle. Not a DFU member. Ledger A
// (ELITE-GATES).
import { EG_LAST_WORD_MS, egCountHold, egCountRun } from './egLaw.js';
import { EG_ROLE, EG_FL } from './egBodies.js';

/** A beat gap past this is given back (ms - the gate's CHECKPOINT_MS: the beat runs every quarter or whole second). */
export const EG_GAP_MS = 2000;
/** The longest a woken room holds between trials for its living members to come back (ms). */
export const EG_REJOIN_MS = 180_000;
/** An instant the record holds is never earlier than its open less this (ms) - the give-back's lower bound. */
export const EG_INSTANT_SLACK_MS = 60_000;
/** How long a spec law is kept after it stops being the newest (days) - a client or a relay deployed a week apart from
 *  the other still draws a breach's own halls. */
export const EG_LAW_KEEP_DAYS = 7;
/** THE LAWS THIS BUILD DRAWS: spec law -> the day it became the law (net/eliteGates/egLaw.js EG_SPEC is always one). One line, read
 *  by the relay deploy's drain step (.github/workflows/relay-deploy.yml). EG-ZC: law 5 (the last fragments - the Cooling
 *  Slag, the shafts) beside law 4, kept EG_LAW_KEEP_DAYS with its generator (net/eliteGates/egLaw.js egHallOf's `law`). AUDIT EG III:
 *  law 6 (the span decrees on every span - net/eliteGates/egLaw.js EG_DECREE_LAW) beside laws 4 and 5, each kept its days. EG-HERO-LAY:
 *  law 7 (the heroes laid - net/eliteGates/egLaw.js EG_HERO_LAW) beside laws 4, 5 and 6, each kept its days. AUDIT EG V: law 8 (the ways
 *  laid - net/eliteGates/egLaw.js EG_WAYS_LAW) beside laws 4 to 7, each kept its days. THE ASCENT: law 9 (the hall a way of rooms and
 *  climbs - net/eliteGates/egLaw.js EG_ASCENT_LAW, net/eliteGates/egAscent.js) beside laws 4 to 8, each kept its days. EG-PERFECT: law
 *  10 (THE BROKEN WAY - net/eliteGates/egAscent.js EG_BROKEN_LAW) beside laws 4 to 9, each kept its days (law 4's seventh day today). */
export const EG_LAWS = Object.freeze({ 4: '2026-10-11', 5: '2026-10-12', 6: '2026-10-13', 7: '2026-10-13', 8: '2026-10-15', 9: '2026-10-16', 10: '2026-10-18' });
/** Does this build draw spec law `v`? */
export const egLawKnown = (/** @type {any} */ v) => Number.isSafeInteger(v) && Object.hasOwn(EG_LAWS, String(v));
/** The most breaches live at once (section 22, THE COST - the Rehearsals among them). */
export const EG_LIVE_MAX = 64;
/** Where the hub keeps its live list (breach -> `{ egv, until }`), the relay's public door that says it (the deploy's
 *  hold and drain read it), and the internal doors the Worker asks the hub through and the hub asks each room through. */
export const EG_LIVE_KEY = 'eglive';
/** AUDIT EG III (lane3 #19): how long the hub keeps its answer to the public live door (ms) - every ask meanwhile answered
 *  by it, so a flood of asks costs one round of the rooms each EG_LIVE_SAID_MS (server/src/index.js `_egLiveSay`). */
export const EG_LIVE_SAID_MS = 2000;
export const EG_LIVE_PATH = '/v1/eg/live';
export const EG_INTERNAL_LIVE = '/internal/eg/live';
export const EG_INTERNAL_STAGE = '/internal/eg/stage';

/** Is breach `B` between trials - past its first wake, not ended, in a closing, the swap (an arrival) or a rest? */
export const egBetween = (/** @type {any} */ B) => !!B && !B.end && B.wk > 0 && (B.sg === 'closing' || B.sg === 'rest' || B.sg === 'arrive');
/** The living, entered members (`[sub, m]`). */
const living = (B) => Object.entries(B.mem ?? {}).filter(([, m]) => m.in && m.alive && !m.home);
/** The record's top-level fields that are never moved: the open (the last word's), the end, this law's own clocks, and
 *  the signed and spent things (receipts, orders, the company, the owed claims, the secret). */
const KEPT = new Set(['op', 'endAt', 'tk', 'gv', 'hold', 'rc', 'zs', 'co', 'owe', 'rs', 'egv', 'seed']);

/**
 * GIVE THE GAP BACK: every instant breach `B` holds after its first wake - a number between its open (less
 * EG_INSTANT_SLACK_MS) and the last word from `now` - moved forward `gap` ms, the fight's clocks and the members' with the
 * stage's and the count's. A frozen piece (a hall's spec) holds no instant and is left; nothing before the first wake
 * moves. Answers the ms given back (`B.gv` keeps the sum). AUDIT EG III: `moves(object, key, value)`, where given, says
 * which instants move (THE HOLD's finding; a beat gap's own stamps stay).
 * @param {any} B @param {number} gap @param {number} now @param {((o: any, k: string, v: number) => boolean)|null} [moves]
 */
export function egGiveBack(B, gap, now, moves = null) {
  if (!B || !(gap > 0) || !(B.wk > 0) || B.end) return 0;
  instantsOf(B, now, (o, k, v) => { if (!moves || moves(o, k, v)) o[k] = v + gap; });
  B.gv = (B.gv ?? 0) + gap;
  return gap;
}
/** Every instant breach `B` holds at `now` - a number between its open (less EG_INSTANT_SLACK_MS) and the last word from
 *  `now`, outside a frozen piece and the KEPT fields - handed to `fn(object, key, value)`. */
function instantsOf(B, now, fn) {
  const lo = B.op - EG_INSTANT_SLACK_MS, hi = now + EG_LAST_WORD_MS, seen = new Set();
  const walk = (o, top) => {
    if (seen.has(o) || Object.isFrozen(o)) return;
    seen.add(o);
    for (const k of Object.keys(o)) {
      if (top && KEPT.has(k)) continue;
      const v = o[k];
      if (typeof v === 'number') { if (v >= lo && v <= hi) fn(o, k, v); }
      else if (v && typeof v === 'object') walk(v, false);
    }
  };
  walk(B, true);
}
/**
 * AUDIT EG III (lane3 #8; section 22, THE HOLD - "A member who returns finds the hall where they left it"): WHAT A HOLD
 * FOUND - so its release gives the gap back to those instants alone. A member's word during the hold (a ping, a pose, a
 * heal, a pick) stamps relay time, and moving it by the whole gap stood it in the future: a pose stamped ten seconds before
 * the release stood a hundred seconds ahead, and its fair trail judged nothing until the clock caught it. An instant
 * rewritten during the hold, or in a piece made during it, is the hold's own and stays; a deadline the hold found (a rest's
 * end, a closing's) still moves, however far into the hold it fell. AUDIT EG V (lane4 L4-9): KEPT IN THE RECORD - the
 * finding lived in memory, and a room woken again inside its hold (a second deploy, an eviction) took it afresh from what it
 * read, the words its company stamped meanwhile among it, and moved them by the whole gap into the future. Every instant the
 * room stamped before it slept is at or before its last beat (`B.hold.at`), and moves; past it, the hold keeps the values
 * it found (`B.hold.f` - its deadlines, and a word heard after the last beat: few), and only those move.
 * @param {any} B @param {number} at the hold's last beat @param {number} now
 * @returns {number[]}
 */
function holdFind(B, at, now) {
  const f = new Set();
  instantsOf(B, now, (_o, _k, v) => { if (v > at) f.add(v); });
  return [...f].sort((a, b) => a - b);
}

/**
 * A ROOM WOKE (its record read from storage at `now`): the law pin first (`'void'` - the caller ends the breach), then a
 * breach between trials HOLDS from its last beat (`'hold'`), one mid-trial has the gap given back (`'gave'`), or nothing
 * (null - before the first wake, or within EG_GAP_MS). `B.tk` is the last beat's instant (the room stamps it). EG-ZA:
 * `voidBefore` a `force` deploy's stamp (ms, 0 none) - a breach opened before it is a void too (egForceVoided).
 * @param {any} B @param {number} now @param {number} [voidBefore]
 * @returns {'void'|'hold'|'gave'|null}
 */
export function egResume(B, now, voidBefore = 0) {
  if (!B || B.end) return null;
  if (!egLawKnown(B.egv) || egForceVoided(B, voidBefore)) return 'void';   // EG-ZA: and THE FORCE VOID - a breach live at a `force` deploy's stamp
  if (!(B.wk > 0)) { B.tk = now; return null; }
  const last = Number.isFinite(B.tk) && B.tk <= now ? B.tk : now;
  if (B.hold) return 'hold';   // woken again inside a hold: its release gives the whole gap back (AUDIT EG III: to what it found - AUDIT EG V: the record's)
  if (egBetween(B)) { egHoldBegin(B, last, now); return 'hold'; }
  B.tk = now;
  return now - last > EG_GAP_MS && egGiveBack(B, now - last, now) > 0 ? 'gave' : null;
}
/**
 * THE HOLD begun at `at` (the last beat): the count frozen there (whether it ran is kept), released by `until`.
 * @param {any} B @param {number} at @param {number} now
 */
export function egHoldBegin(B, at, now) {
  const ran = B.cnt?.at > 0 ? 1 : 0;
  if (B.cnt) B.cnt = egCountHold(B.cnt, at);
  B.hold = { at, until: now + EG_REJOIN_MS, ran, f: holdFind(B, at, now) };   // AUDIT EG III (lane3 #8): what the hold found - its release moves those alone; AUDIT EG V (L4-9): kept in the record
}
/**
 * May a held breach go on at `now`: every living member back in the room (`present` - the accounts with a fresh body
 * there), or the hold spent. A breach with nobody living goes on (the director ends it).
 * @param {any} B @param {number} now @param {Set<string>} present
 */
export function egHoldDone(B, now, present) {
  if (!B?.hold) return true;
  if (now >= B.hold.until) return true;
  const L = living(B);
  return !L.length || L.every(([sub]) => present.has(sub));
}
/**
 * THE HOLD RELEASED at `now`: the whole gap since its beat given back, the count running again if it ran. Answers the
 * ms given back. AUDIT EG III (lane3 #8): given back to the instants the hold found, never to one its company stamped
 * while it held (a record held by hand, with no finding, moves every instant).
 * @param {any} B @param {number} now
 */
export function egRelease(B, now) {
  const h = B?.hold;
  if (!h) return 0;
  B.hold = null;
  const found = Array.isArray(h.f) ? new Set(h.f) : null;
  const gap = egGiveBack(B, Math.max(0, now - h.at), now, found ? (_o, _k, v) => v <= h.at || found.has(v) : null);
  if (h.ran && B.cnt) B.cnt = egCountRun(B.cnt, now);
  B.tk = now;
  return gap;
}
/**
 * A BEAT at `now` of a breach whose room never slept: a gap past EG_GAP_MS since its last beat (an alarm the runtime
 * held) given back; the beat stamped. Answers the ms given back. AUDIT EG III (lane3 #8): the room was awake, so its
 * members' words in the gap stamped relay time - an instant inside the gap (after the last beat, by now) is the gap's
 * own and stays; those before it and the deadlines past it move.
 * @param {any} B @param {number} now
 */
export function egBeatGap(B, now) {
  const last = B?.tk;
  if (B) B.tk = now;
  return Number.isFinite(last) && now - last > EG_GAP_MS ? egGiveBack(B, now - last, now, (o, k, v) => v <= last || v > now) : 0;
}

/**
 * A RECEIPT'S OWN SEED: the first 32 bits of HMAC-SHA-256 keyed by the room's secret `rs` (64 hex) over
 * `sub|R|kind` (R the Redoubt for a `w`, 0 for an end) - the same receipt minted again draws the same roll.
 * @param {string} rs @param {string} sub @param {number} R @param {string} kind @param {SubtleCrypto} subtle
 */
export async function egReceiptSeed(rs, sub, R, kind, subtle) {
  const raw = new Uint8Array((String(rs).match(/[0-9a-f]{2}/g) ?? []).map((h) => parseInt(h, 16)));
  if (raw.length !== 32) throw new TypeError('egReceiptSeed needs the room\'s 32-byte secret');
  const key = await subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await subtle.sign('HMAC', key, new TextEncoder().encode(`${sub}|${R}|${kind}`)));
  return ((mac[0] << 24) | (mac[1] << 16) | (mac[2] << 8) | mac[3]) >>> 0;
}

// ── EG-ZA: A KEY IS NEVER LOST (sections 22 and 23) ─────────────────────────────────────────────────────────────────
/** How long a void may be asked after its order was issued, and how long a room keeps its tombstone (s - the
 *  HOLDEM_STAKE_VOID_S precedent: a week, the receipts' own life). */
export const EG_VOID_MAX_S = 7 * 24 * 3600;
/** Where a breach's room keeps its tombstone: `{ until, z: [[ez, why, r]] }` - each order it voided (`r` the void it
 *  minted, handed again to a void asked again) and the breach's own order at its end. */
export const EG_DONE_KEY = 'egdone';
/** The most orders one tombstone names (a room is opened by one order; the rest are voids asked of it). */
export const EG_DONE_MAX = 8;
/** How often the hub tells a breach's room its open before it asks the room to void the order instead. */
export const EG_OPEN_HUB_TRIES = 3;
/** The internal doors (HCC-PARK's law - the public worker forwards /room/<key> alone): the hub asking a room to void an
 *  order, telling a room its call went out, and a room telling the hub the receipts it minted. */
export const EG_INTERNAL_VOID = '/internal/eg/void';
export const EG_INTERNAL_CALLED = '/internal/eg/called';
export const EG_INTERNAL_RCPT = '/internal/eg/rcpt';
/** The hub's key for an account's held receipts (swept as `gaterc:` is), the most it holds, and how soon a room whose
 *  hub did not take its receipts tells it again (ms) - and the most a room keeps owed to the hub. */
export const EG_RC_PREFIX = 'egrc:';
export const egRcKey = (/** @type {string} */ sub) => `${EG_RC_PREFIX}${sub}`;
export const EG_RC_KEEP = 16;
export const EG_RC_TELL_MS = 5000;
export const EG_RC_OWED_MAX = 64;
/** A receipt's identity among its account's held ones: its breach, its kind and its Redoubt (0 for an end or a void) -
 *  the same receipt minted again (a woken room's) is the same entry. */
export const egRcId = (/** @type {any} */ c) => `${c.b}:${c.q}:${Number.isSafeInteger(c.w) ? c.w : 0}`;
/**
 * THE HUB'S HELD RECEIPTS FOLDED: `kept` (an account's `egrc:` list - `{ id, r, e }`, or `{ id, spent: 1, e }` where its
 * account has said the service counted it) with `add` (`{ id, r, e }` newly told) at `nowS`: one entry an identity, the
 * newer receipt of it kept, never over a spent mark; the expired dropped; the newest EG_RC_KEEP kept. AUDIT EG V (lane4's
 * EG_RC_KEEP question; section 23, "the hub is their holder of record"): the newest EG_RC_KEEP of each - unclaimed
 * receipts and spent marks are bounded apart, so a week of receipts its account claimed (each a mark kept its life) never
 * pushes out one it has not taken yet. Pure.
 * @param {any} kept @param {Array<{id: string, r: string, e: number, spent?: number}>} add @param {number} nowS
 */
export function egRcFold(kept, add, nowS) {
  const by = new Map();
  for (const x of [...(Array.isArray(kept) ? kept : []), ...add]) {
    if (!x || typeof x.id !== 'string' || !(Number.isSafeInteger(x.e) && x.e > nowS) || (!x.spent && typeof x.r !== 'string')) continue;
    if (by.get(x.id)?.spent) continue;
    by.delete(x.id);
    by.set(x.id, x);
  }
  const all = [...by.values()], held = all.filter((x) => !x.spent).slice(-EG_RC_KEEP), spent = all.filter((x) => x.spent).slice(-EG_RC_KEEP);
  return all.filter((x) => held.includes(x) || spent.includes(x));
}
/** An account's word that the service counted receipt `id`: its held copy forgotten, REMEMBERED AS SPENT until `e` (the
 *  gate's AUDIT WBX2 M3 law - the word may come before the room's own tell, and must stand over it). Pure. */
export const egRcSpent = (/** @type {any} */ kept, /** @type {string} */ id, /** @type {number} */ nowS, /** @type {number} */ e) => egRcFold((Array.isArray(kept) ? kept : []).filter((x) => x?.id !== id), [{ id, spent: 1, e, r: '' }], nowS);
/** The receipts an account's hello is handed: every held one still good. Pure. */
export const egRcLive = (/** @type {any} */ kept, /** @type {number} */ nowS) => (Array.isArray(kept) ? kept : []).filter((x) => x && !x.spent && typeof x.r === 'string' && x.e > nowS).map((x) => x.r);
/**
 * A ROOM'S TOMBSTONE with order `ez` written (`why` 'void' with the receipt `r` it minted, or the breach's end) at `nowS`:
 * kept EG_VOID_MAX_S from now. Pure - a new record.
 * @param {any} done @param {string} ez @param {string} why @param {string|null} r @param {number} nowS
 */
export function egDoneWith(done, ez, why, r, nowS) {
  const z = (Array.isArray(done?.z) ? done.z : []).filter((e) => Array.isArray(e) && e[0] !== ez);
  return { until: nowS + EG_VOID_MAX_S, z: [...z, [ez, why, r ?? '']].slice(-EG_DONE_MAX) };
}
/** The tombstone's entry for order `ez` (`[ez, why, r]`), or null. */
export const egDoneOf = (/** @type {any} */ done, /** @type {string} */ ez) => (Array.isArray(done?.z) ? done.z.find((e) => Array.isArray(e) && e[0] === ez) ?? null : null);
/**
 * MAY A ROOM VOID breach `B` on its opener's ask (EG_INTERNAL_VOID naming `B.ez`): only while nothing has begun - no call
 * told out (`called`), no hall woken, no member entered, not ended. Otherwise the breach's own receipts settle its stake.
 * @param {any} B
 */
export const egVoidable = (B) => !!B && !B.end && !B.called && !(B.wk > 0) && !Object.values(B.mem ?? {}).some((m) => m?.in);
/** THE FORCE VOID: breach `B` was live when a `force` deploy stamped the Worker at `before` (ms) - opened before it, not
 *  ended. */
export const egForceVoided = (/** @type {any} */ B, /** @type {number} */ before) => Number.isSafeInteger(before) && before > 0 && !!B && !B.end && B.op < before;

// ── EG-ZA: THE TICK (section 22, THE COST) ───────────────────────────────────────────────────────────────────────────
/** A beat while a trial runs (the gate's BRAIN_TICK_MS - pinned equal), and otherwise (ms). */
export const EG_BEAT_TRIAL_MS = 250;
export const EG_BEAT_SLOW_MS = 1000;
/** Does a trial run in breach `B` - its trial, or a closing whose fight still stands a foe (a Kyn Mimic's Lurker)? */
export const egTrialRuns = (/** @type {any} */ B) => !!B && !B.end && (B.sg === 'trial' || (B.sg === 'closing' && (B.F?.bodies ?? []).some((t) => t.role !== EG_ROLE.obj && t.hp > 0 && !(t.fl & EG_FL.friend) && !(t.fl & EG_FL.fell))));
/**
 * WHEN BREACH `B`'s NEXT BEAT FALLS at `now` (`here`: a member's socket is in the room): EG_BEAT_TRIAL_MS while a trial
 * runs with its company here; while the arch rises (`wait`) none until the open (`su`); otherwise EG_BEAT_SLOW_MS, or
 * sooner at the stage's own end (`su`), never sooner than a trial's beat.
 * @param {any} B @param {number} now @param {boolean} here
 */
export function egTickAt(B, now, here) {
  if (B.sg === 'wait') return Math.max(now + EG_BEAT_TRIAL_MS, B.su);
  if (here && egTrialRuns(B)) return now + EG_BEAT_TRIAL_MS;
  return B.su > now ? Math.min(now + EG_BEAT_SLOW_MS, Math.max(now + EG_BEAT_TRIAL_MS, B.su)) : now + EG_BEAT_SLOW_MS;
}
