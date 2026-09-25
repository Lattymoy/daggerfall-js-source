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
// (with the signed order the rooms take). A report the network loses is
// kept for the next; one the hour's bound cut short is not re-sent - the
// service said how much counted.
//
// Pure: every clock and the service are arguments.
// ═══════════════════════════════════════════════════════════════════

import { RENOWN_REPORT_MS, RENOWN_XP_REPORT_MAX } from './renown.js';
import { KNIGHT_CITY_WATCH } from '../characters/mobileTypes.js';

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
 *              hour to speak of, and never for a repeat (a report already credited, answered again).
 */
export function renownAnswer(data, sent, said = null) {
  const level = Number.isSafeInteger(data?.level) && data.level >= 1 ? data.level : null;
  const order = typeof data?.order === 'string' && data.order ? data.order : null;
  const announce = level !== null && data?.rose === true && (said === null || level > said) ? level : null;
  const capped = Number.isSafeInteger(data?.credited) && data.credited < sent && !data?.max && !data?.repeat;
  return { level, order, announce, capped };
}

/** The service's refusals that will not change by trying again: this character (or this build) cannot report. */
const PERMANENT = new Set(['renown-character', 'renown-xp', 'renown-full']);

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
 * @param {{ report: (c: string, xp: number, name: string|null, rid: string) => Promise<any>,
 *   leave?: ((c: string, xp: number, name: string|null, rid: string) => any)|null,
 *   character: () => string|null, name?: () => string|null, earning?: () => boolean, now?: () => number,
 *   onAnswer?: (data: any, sent: number) => void, onStop?: (error: string) => void, rid?: () => string }} o
 */
export function createRenownTracker({ report, leave = null, character, name = () => null, earning = () => true, now = () => Date.now(), onAnswer = () => {}, onStop = () => {}, rid = () => renownRid() }) {
  let pending = 0;          // earned, in no report yet
  /** @type {{ character: string, xp: number, rid: string }|null} */
  let held = null;          // the report formed and not yet answered
  let inFlight = false;
  let lastAt = -Infinity;   // when a report last went
  let refused = 0;          // refusals in a row that trying again could cure
  let stopped = false;

  /** Earn `xp` now - nothing while not earning (offline) or after a permanent refusal. Answers what was kept. */
  const earn = (xp) => {
    if (stopped || !earning()) return 0;
    const n = Number.isFinite(xp) ? Math.max(0, Math.trunc(xp)) : 0;
    pending += n;
    return n;
  };

  /** The report to send: the one held, or one formed now from what is pending (up to a report's worth). */
  const form = () => {
    if (held) return held;
    if (pending <= 0) return null;
    let c = null;
    try { c = character(); } catch { c = null; }
    if (typeof c !== 'string' || !c) return null;
    const xp = Math.min(pending, RENOWN_XP_REPORT_MAX);
    let id = null;
    try { id = rid(); } catch { id = null; }
    if (typeof id !== 'string' || !id) return null;
    pending -= xp;
    held = { character: c, xp, rid: id };
    return held;
  };

  /** How long since the last report before the next may go: a minute, doubling with each refusal in a row. */
  const waitMs = () => (refused ? Math.min(RENOWN_BACKOFF_MAX_MS, RENOWN_REPORT_MS * 2 ** (refused - 1)) : RENOWN_REPORT_MS);

  const due = (t = now()) => !stopped && !inFlight && (held !== null || pending > 0)
    && (t - lastAt >= waitMs() || (!refused && held === null && pending >= RENOWN_XP_REPORT_MAX));

  /** Send the held report, or form one and send it. Answers the service's data, or null. */
  const flush = async (t = now()) => {
    if (stopped || inFlight) return null;
    const h = form();
    if (!h) return null;
    inFlight = true;
    lastAt = t;
    let r;
    try { r = await report(h.character, h.xp, name?.() ?? null, h.rid); } catch { r = { ok: false, error: 'offline' }; } finally { inFlight = false; }
    if (r?.ok) {
      if (held === h) held = null;
      refused = 0;
      try { onAnswer(r.data, h.xp); } catch (err) { console.error('[renown] the answer could not be shown:', err); }
      return r.data ?? null;
    }
    if (PERMANENT.has(r?.error)) { stopped = true; held = null; pending = 0; try { onStop(r.error); } catch { /* the stop stands */ } }
    else if (r?.error === 'auth' || r?.error === 'no-session') { held = null; pending = 0; }   // no account to earn for: nothing to keep
    else refused++;   // anything else (offline, a busy service, a rate, a service without the route yet) holds the report and waits
    return null;
  };

  return {
    earn,
    due,
    flush,
    /** The frame's knock: a report when one is due. */
    tick: (t = now()) => (due(t) ? flush(t) : null),
    /** AUDIT RENOWN1 GAME-8: the page is going - the held report (or one formed now) by the page's last word. */
    leave: () => {
      if (stopped || typeof leave !== 'function') return false;
      const h = form();
      if (!h) return false;
      try { leave(h.character, h.xp, name?.() ?? null, h.rid); return true; } catch { return false; }
    },
    pending: () => pending + (held?.xp ?? 0),
    stopped: () => stopped,
  };
}
