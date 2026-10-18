// @ts-check
// ═══════════════════════════════════════════════════════════════════
// RENOWN1 (2026-09-24) — WHAT A CHARACTER EARNS ONLINE, kept until the
// account service has it.
//
// Mac: "What if the leveling system was something seperate unique to
// online but compatible" - and offline play earns "No" Renown XP.
// net/renown.js holds the numbers; this file decides WHEN a character
// has earned some and carries it to the service.
//
// ═══ A FOE YOU FOUGHT ══════════════════════════════════════════════
//
// A foe pays its XP to every player who struck it in the last
// RENOWN_ASSIST_MS when it dies, whoever struck the last blow. That is one
// rule for every door a kill can come through online, and it has to be,
// because the doors do not agree on who killed what:
//   - a foe of your own dies in your own damage door;
//   - a foe another player's client runs (an outdoor cell) dies in its
//     owner's door, and your copy dies when the owner's frame says so;
//   - a dungeon's foes are its host's, and the host never tells a joiner
//     whose blow was the last one - so a joiner could never earn a kill
//     by "the killing blow", in the one place parties fight most.
// So every door stamps YOUR blows (`renownFoeStruck`) and every death
// (`renownFoeDied`) pays once, if a blow of yours is recent enough. A party
// fighting together each earns the whole foe, and the party bonus on top
// (net/renown.js renownPartyXp) - group play is where the big numbers are.
//
// The stamps live in a WeakMap, never on the foe: a foe record is
// streamed and saved by other code, and a field it never had cannot leak
// into either.
//
// NOT the city watch and not a townsperson: a kill the law calls murder
// earns nothing. Their doors (scenes/cityGuards.js) never stamp.
// AUDIT RENOWN1 GAME-1: and ANOTHER player's watch is stood here as a
// puppet in the foe pool, whose door does stamp - so the watch is refused
// HERE, by its species, whoever's it is (a partymate farmed the watch a
// criminal friend kept summoning). GAME-7: and my own ALLY - a summon of
// the Sanguine Rose or the Skull of Corruption turns when struck, and then
// paid like any foe - never pays either: a foe that is my ally when a blow
// of mine lands is marked paid for good. GAME-6: a scripted quest kill
// (`kill foe`, the SetHealth(0) door) is no blow of mine at all
// (exteriorFoes.js and dungeonContext.js zeroFoeHealth).
//
// A foe that dies of POISON more than RENOWN_ASSIST_MS after my last blow
// pays nothing (AUDIT RENOWN1 GAME-10, recorded): a poison round carries
// no striker, and a peer's dose rides into the owner's copy of a foe, so a
// round cannot be read as mine.
//
// ═══ THE REPORT ════════════════════════════════════════════════════
//
// What is earned is held here and sent every RENOWN_REPORT_MS (sooner when a
// report's worth has piled up), one report at a time. The service's
// answer is the truth: its total, its level, and whether the level ROSE
// (with the signed order the rooms take). SCALE4h: every RENOWN_COALESCE_MS
// instead while the answer would say nothing the page cannot - no rise, the
// hour's bound not near (renownReportSoon); the bar draws what waits. A report the network loses is
// kept for the next; one the hour's bound cut short is not re-sent - the
// service said how much counted.
//
// Pure: every clock and the service are arguments.
// ═══════════════════════════════════════════════════════════════════

import { RENOWN_REPORT_MS, RENOWN_COALESCE_MS, RENOWN_XP_REPORT_MAX, renownProgress } from './renown.js';
import { KNIGHT_CITY_WATCH } from '../characters/mobile/mobileTypes.js';

/** How recent a blow of yours must be when a foe dies for it to pay you - half a minute of the fight. */
export const RENOWN_ASSIST_MS = 30_000;

/** @type {WeakMap<object, { at: number, paid: boolean }>} */
let _struck = new WeakMap();
/** @type {((foe: any) => void)|null} */
let _onKill = null;

/** The host's hand for a foe that paid: `fn(foe)` - null to stop. One at a time (one world per page). */
export function setRenownKillHandler(fn) { _onKill = typeof fn === 'function' ? fn : null; }

/** AUDIT RENOWN1 GAME-1/GAME-7: a foe that never pays - the city watch, whoever's, and my own ally. */
const neverPays = (foe) => foe.mobileType === KNIGHT_CITY_WATCH || foe.entity?.team === 'PlayerAlly' || foe.entity?.mobileTeam === 'PlayerAlly';

/** A blow of the PLAYER's own landed on (or was sent at) `foe`. */
export function renownFoeStruck(foe, now = Date.now()) {
  if (!foe || typeof foe !== 'object') return;
  const never = neverPays(foe);   // read at the blow: the blow that lands on an ally is the one that turns it
  const e = _struck.get(foe);
  if (e) { e.at = now; if (never) e.paid = true; } else _struck.set(foe, { at: now, paid: never });
}

/** RAID1: when the player's last blow on `foe` landed (the clock `renownFoeStruck` was handed), or null. Raiding
 *  Parties' "the player fought this raid" (systems/raidingParties.js, fix 5) reads the same stamp - one record of the
 *  foes a player fought, not two. */
export function renownStruckAt(foe) {
  const e = foe && typeof foe === 'object' ? _struck.get(foe) : null;
  return e ? e.at : null;
}

/** AUDIT RENOWN1 GAME-10: a foe stood again as a NEW record (a Wabbajack's change, a joiner's rebuild of the host's foe
 *  as another species) is the same fight - my blows on the old record count on the new one. */
export function renownFoeCarry(from, to) {
  if (!from || !to || typeof from !== 'object' || typeof to !== 'object' || from === to) return;
  const e = _struck.get(from);
  if (e) _struck.set(to, { at: e.at, paid: e.paid });
}

/** AUDIT RENOWN1 GAME-10: a foe that stands up again IN PLACE (the stream's un-death, a save's restore) is a new fight -
 *  the blows on its last life and the pay it gave are forgotten, so its next death can pay. */
export function renownFoeRevived(foe) {
  if (foe && typeof foe === 'object') _struck.delete(foe);
}

/** `foe` died, by any hand: it pays once, if a blow of the player's is within RENOWN_ASSIST_MS. Answers whether it paid. */
export function renownFoeDied(foe, now = Date.now()) {
  const e = foe && typeof foe === 'object' ? _struck.get(foe) : null;
  if (!e || e.paid || !(now - e.at <= RENOWN_ASSIST_MS) || now < e.at) return false;
  e.paid = true;
  try { _onKill?.(foe); } catch (err) { console.error('[renown] a kill could not be counted:', err); }
  return true;
}

/** A foe's level as the game rolled it - the level its owner streamed (AUDIT RENOWN1 GAME-3: a dungeon joiner's copy of
 *  the host's class foe is BUILT at the joiner's level, and the host's own is the fight's), the entity's, or the level an
 *  outdoor copy was built at. */
export function renownFoeLevel(foe) {
  const l = foe?.streamedLevel ?? foe?.entity?.level ?? foe?.builtLevel;
  return Number.isFinite(l) && l > 0 ? l : 1;
}

/** Tests only: forget every stamp and the handler. */
export function _resetRenownKillsForTests() { _struck = new WeakMap(); _onKill = null; }

/**
 * AUDIT RENOWN1 (UI-5, UI-7, WIRE-2c): WHAT THE PAGE DOES WITH A REPORT'S ANSWER - pure, so it is pinned (world.js
 * carries it out). `sent` the XP the report carried, `said` the highest level the page has announced. Answers:
 *   `level`    the service's level, for the page to adopt (the page takes it only if it rises - world.js renownAdopt);
 *   `order`    the signed order, WHENEVER the service signed one. It was carried only when the answer's level beat the
 *              page's, and a token minted between the report's commit and its answer (every socket mints one) raised
 *              the page's level first - so the rise was never carried, and the rooms kept the old one;
 *   `announce` a level the service says ROSE and the page has not said yet ("Your Renown is now N.") - against what
 *              was SAID, never against the page's level, for the same reason;
 *   `capped`   whether the hour's bound cut this report short: never at the cap's total (`max`), where there is no
 *              hour to speak of, and never for a repeat (a report already credited, answered again);
 *   `xp`       RENOWN4: the track's total as the service now holds it, for the page's own bar (ui/hud/hudRenown.js) -
 *              null for an answer without one;
 *   `room`     SCALE4h: what the hour's bound still takes, as the service now holds it (renownReportSoon reads it) -
 *              null for an answer without one.
 */
export function renownAnswer(data, sent, said = null) {
  const level = Number.isSafeInteger(data?.level) && data.level >= 1 ? data.level : null;
  const order = typeof data?.order === 'string' && data.order ? data.order : null;
  const announce = level !== null && data?.rose === true && (said === null || level > said) ? level : null;
  const capped = Number.isSafeInteger(data?.credited) && data.credited < sent && !data?.max && !data?.repeat;
  const xp = Number.isSafeInteger(data?.xp) && data.xp >= 0 ? data.xp : null;
  const room = Number.isSafeInteger(data?.room) && data.room >= 0 ? data.room : null;   // SCALE4h: what the hour still takes
  return { level, order, announce, capped, xp, room };
}

/**
 * SCALE4h (2026-10-11, the plan's "10k writes"; bible/11-Multiplayer/Scale-Arc.md SCALE4h): IS THE NEXT REPORT'S
 * ANSWER ONE THE PAGE NEEDS SOON? Then it goes at the minute's pace (RENOWN_REPORT_MS), as every report did; else what
 * is earned waits RENOWN_COALESCE_MS, drawn meanwhile as the bar's ghost (ui/hud/hudRenown.js). Soon, when:
 *   - the hour's bound is spent (`capped`): what is earned in it is said within it, credited nothing, as before;
 *   - the track's total (`xp`) or the hour's room (`room`) is not known - the next answer says them;
 *   - what is earned (`pending`) reaches the room: the bound's word, and the sigils' stop, come at the minute's pace;
 *   - what is earned completes the level: the rise, and its signed order to the rooms, come at the minute's pace;
 *   - AUDIT SCALE II C-4: the hour has no more than RENOWN_REPORT_MS left (`hourLeftMs`, on the host's clock of the
 *     service's hour). The service charges a report to the hour it ARRIVES in, so what waited RENOWN_COALESCE_MS across
 *     the hour's turn was charged to the next hour's window: up to five minutes of one hour spent in the next, and a
 *     player just under the hourly bound lost what overflowed it. A report in the hour's last minute carries what was
 *     earned in it, and no more than a minute's worth crosses - what the minute's pace always let cross. Unknown
 *     (absent, not a number), the arm says nothing.
 * At the cap's total no rise is left to say. Pure.
 * @param {{ xp: number|null, pending: number, room: number|null, capped: boolean, hourLeftMs?: number|null }} o
 */
export function renownReportSoon({ xp, pending, room, capped, hourLeftMs = null }) {
  if (capped) return true;
  if (Number.isFinite(hourLeftMs) && /** @type {number} */ (hourLeftMs) <= RENOWN_REPORT_MS) return true;   // AUDIT SCALE II C-4
  if (!Number.isSafeInteger(xp) || !Number.isSafeInteger(room)) return true;
  const n = Number.isFinite(pending) && pending > 0 ? pending : 0;
  if (n >= /** @type {number} */ (room)) return true;
  const p = renownProgress(/** @type {number} */ (xp));
  return p.need > 0 && n >= p.need - p.into;
}

/** The service's refusals that will not change by trying again: this character (or this build) cannot report. */
const PERMANENT = new Set(['renown-character', 'renown-xp', 'renown-full', 'progress-seat', 'trade-held']);   // INT16: not the account's seat here, or a character whose trade is held

/** AUDIT RENOWN1 GAME-2: the longest a refused report waits before it goes again - the wait doubles from
 *  RENOWN_REPORT_MS with each refusal in a row, up to this. */
export const RENOWN_BACKOFF_MAX_MS = 15 * 60_000;

/** AUDIT RENOWN1 DATA-4: a report's own id - sixteen hex digits (net/renown.js RENOWN_RID_RE), drawn once per report. */
export function renownRid(rand = (b) => globalThis.crypto.getRandomValues(b)) {
  const b = rand(new Uint8Array(8));
  let out = '';
  for (const x of b) out += x.toString(16).padStart(2, '0');
  return out;
}

/**
 * The client's tracker. `report(character, xp, name, rid)` is the account service's `/v1/renown/xp`
 * (net/accountClient.js accountRenown), answering `{ ok, data }` or `{ ok: false, error }`; `leave` the same report
 * made as the page goes (`keepalive`); `character()` the character earning (systems/characterId.js), `name()` its name
 * for the account card, `earning()` whether XP may be earned now (online, and only online), `onAnswer(data, sent)` the
 * service's word after each report, `onStop(error)` a refusal that ends reporting for this page, `rid()` a report's
 * own id.
 *
 * ═══ AUDIT RENOWN1: ONE REPORT HELD UNTIL IT IS ANSWERED ════════════
 *
 * A report is formed ONCE - its character, its XP and its own id - and HELD until the service answers it: sent again,
 * exactly as it was, after every refusal that trying again could cure. The service keeps the id of the last report a
 * track took (renownTracks.js), so a report it took whose answer was lost is answered as a repeat and credited once
 * (DATA-4/GAME-9: it was credited twice - 3,000 earned, 6,000 kept). What is earned meanwhile waits for the next.
 *
 * A REFUSED REPORT WAITS (GAME-2). A report's worth piled up (RENOWN_XP_REPORT_MAX) skipped the minute's wait, so
 * against a service having a bad minute the same report went again the moment the last one failed - every frame, when
 * the network failed fast - and each one spent the account's limiter (240 a minute), so the minting of every token on
 * the account failed with it. Now the minute is skipped only after an ANSWER, and each refusal in a row doubles the
 * wait (RENOWN_REPORT_MS, then two minutes, four... up to RENOWN_BACKOFF_MAX_MS) - which also carries a service one
 * deploy behind (a 404 for the route) until it has the route.
 *
 * THE PAGE'S LAST WORD (GAME-8). `leave()` on pagehide sends what is held - or forms it, from what was earned since
 * the last report - through `keepalive`, so the browser finishes it after the page. It clears nothing: a page the
 * back-forward cache brings back sends the same report again under the same id, and the service answers a repeat.
 * AUDIT SCALE II C-5: every other region's pending goes ahead of it, a report each (see `leave`).
 *
 * SEAT1b (Seats-Arc 4.2): `region()` - the region the player stands in as XP is earned (0-61, or null) - rides each
 * report as its `region`, which the account service keeps for the character's guild where it pledged a seat there.
 *
 * SCALE4h: `soon()` - whether the next answer is one the page needs at the minute's pace (renownReportSoon, the host's
 * word over what it last heard); not soon, a report waits RENOWN_COALESCE_MS. None given, every report is soon, as
 * before. A refusal's wait is its own either way.
 * @param {{ report: (c: string, xp: number, name: string|null, rid: string, region?: number|null) => Promise<any>,
 *   leave?: ((c: string, xp: number, name: string|null, rid: string, region?: number|null) => any)|null,
 *   character: () => string|null, name?: () => string|null, earning?: () => boolean, now?: () => number,
 *   onAnswer?: (data: any, sent: number) => void, onStop?: (error: string) => void, rid?: () => string,
 *   region?: () => number|null, soon?: () => boolean }} o
 */
export function createRenownTracker({ report, leave = null, character, name = () => null, earning = () => true, now = () => Date.now(), onAnswer = () => {}, onStop = () => {}, rid = () => renownRid(), region = () => null, soon = () => true }) {
  /** earned, in no report yet - by the region it was earned in (SEAT1b, Seats-Arc 4.2: "The Renown report grows
   *  `region`"; null where none was known), so one report never names a region XP was not earned in */
  const pend = new Map();
  const pendingXp = () => { let n = 0; for (const v of pend.values()) n += v; return n; };
  /** @type {{ character: string, xp: number, rid: string, region: number|null }|null} */
  let held = null;          // the report formed and not yet answered
  let inFlight = false;
  let lastAt = -Infinity;   // when a report last went
  let refused = 0;          // refusals in a row that trying again could cure
  let stopped = false;

  /** Earn `xp` now - nothing while not earning (offline) or after a permanent refusal. Answers what was kept. */
  const earn = (xp) => {
    if (stopped || !earning()) return 0;
    const n = Number.isFinite(xp) ? Math.max(0, Math.trunc(xp)) : 0;
    if (n > 0) {
      let r = null;
      try { r = region(); } catch { r = null; }
      const k = Number.isSafeInteger(r) && r >= 0 && r <= 61 ? r : null;
      pend.set(k, (pend.get(k) ?? 0) + n);
    }
    return n;
  };

  /** A report formed from what is pending in region `k` (up to a report's worth) - its character, its XP and its own id,
   *  the XP taken off what is pending; null when there is no character or no id to form it under. */
  const mint = (k) => {
    const v = pend.get(k) ?? 0;
    if (!(v > 0)) return null;
    let c = null;
    try { c = character(); } catch { c = null; }
    if (typeof c !== 'string' || !c) return null;
    const xp = Math.min(v, RENOWN_XP_REPORT_MAX);
    let id = null;
    try { id = rid(); } catch { id = null; }
    if (typeof id !== 'string' || !id) return null;
    if (v - xp > 0) pend.set(k, v - xp); else pend.delete(k);
    return { character: c, xp, rid: id, region: k };
  };
  /** The report to send: the one held, or one formed now from what is pending (up to a report's worth). */
  const form = () => {
    if (held) return held;
    const first = [...pend].find(([, v]) => v > 0);
    if (!first) return null;
    held = mint(first[0]);
    return held;
  };

  /** SCALE4h: the host's word that the next answer is wanted at the minute's pace - a word that throws is soon. */
  const soonNow = () => { try { return soon() !== false; } catch { return true; } };
  /** How long since the last report before the next may go: a minute, doubling with each refusal in a row - and
   *  (SCALE4h) RENOWN_COALESCE_MS while the answer would say nothing the page needs soon. */
  const waitMs = () => (refused ? Math.min(RENOWN_BACKOFF_MAX_MS, RENOWN_REPORT_MS * 2 ** (refused - 1)) : soonNow() ? RENOWN_REPORT_MS : RENOWN_COALESCE_MS);

  const due = (t = now()) => !stopped && !inFlight && (held !== null || pendingXp() > 0)
    && (t - lastAt >= waitMs() || (!refused && held === null && pendingXp() >= RENOWN_XP_REPORT_MAX));

  /** Send the held report, or form one and send it. Answers the service's data, or null. */
  const flush = async (t = now()) => {
    if (stopped || inFlight) return null;
    const h = form();
    if (!h) return null;
    inFlight = true;
    lastAt = t;
    let r;
    try { r = await report(h.character, h.xp, name?.() ?? null, h.rid, h.region); } catch { r = { ok: false, error: 'offline' }; } finally { inFlight = false; }
    if (r?.ok) {
      if (held === h) held = null;
      refused = 0;
      try { onAnswer(r.data, h.xp); } catch (err) { console.error('[renown] the answer could not be shown:', err); }
      return r.data ?? null;
    }
    if (PERMANENT.has(r?.error)) { stopped = true; held = null; pend.clear(); try { onStop(r.error); } catch { /* the stop stands */ } }
    else if (r?.error === 'auth' || r?.error === 'no-session') { held = null; pend.clear(); }   // no account to earn for: nothing to keep
    else refused++;   // anything else (offline, a busy service, a rate, a service without the route yet) holds the report and waits
    return null;
  };

  return {
    earn,
    due,
    flush,
    /** The frame's knock: a report when one is due. */
    tick: (t = now()) => (due(t) ? flush(t) : null),
    /** AUDIT RENOWN1 GAME-8: the page is going - the held report (or one formed now) by the page's last word.
     *  AUDIT SCALE II C-5: AND EVERY REGION'S PENDING WITH IT. One report names one region, so the last word carried the
     *  held report, or the first region's pending, and what else was pending died with the page - up to
     *  RENOWN_COALESCE_MS of it once SCALE4h held reports that long, and a coast or a sea crossing alternates regions.
     *  Each other region's pending goes as its own report (formed as `form` forms one: its own id, a report's worth),
     *  sent FIRST and kept by nobody; the held report goes LAST and stays held. The service keeps the id of the last
     *  report a track took (renownTracks.js `last_rid`), so the one a page the back-forward cache brings back sends again
     *  must be the one it heard last - sent in any other order, the held report's second sending was credited twice. */
    leave: () => {
      if (stopped || typeof leave !== 'function') return false;
      const h = form();
      if (!h) return false;
      for (const k of [...pend.keys()]) {
        const r = mint(k);
        if (!r) continue;
        try { leave(r.character, r.xp, name?.() ?? null, r.rid, r.region); } catch { pend.set(k, (pend.get(k) ?? 0) + r.xp); }   // not sent: still pending
      }
      try { leave(h.character, h.xp, name?.() ?? null, h.rid, h.region); return true; } catch { return false; }
    },
    pending: () => pendingXp() + (held?.xp ?? 0),
    stopped: () => stopped,
  };
}
