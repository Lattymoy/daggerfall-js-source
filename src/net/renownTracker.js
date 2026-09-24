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

/** How recent a blow of yours must be when a foe dies for it to pay you - half a minute of the fight. */
export const RENOWN_ASSIST_MS = 30_000;

/** @type {WeakMap<object, { at: number, paid: boolean }>} */
let _struck = new WeakMap();
/** @type {((foe: any) => void)|null} */
let _onKill = null;

/** The host's hand for a foe that paid: `fn(foe)` - null to stop. One at a time (one world per page). */
export function setRenownKillHandler(fn) { _onKill = typeof fn === 'function' ? fn : null; }

/** A blow of the PLAYER's own landed on (or was sent at) `foe`. */
export function renownFoeStruck(foe, now = Date.now()) {
  if (!foe || typeof foe !== 'object') return;
  const e = _struck.get(foe);
  if (e) e.at = now; else _struck.set(foe, { at: now, paid: false });
}

/** `foe` died, by any hand: it pays once, if a blow of the player's is within RENOWN_ASSIST_MS. Answers whether it paid. */
export function renownFoeDied(foe, now = Date.now()) {
  const e = foe && typeof foe === 'object' ? _struck.get(foe) : null;
  if (!e || e.paid || !(now - e.at <= RENOWN_ASSIST_MS) || now < e.at) return false;
  e.paid = true;
  try { _onKill?.(foe); } catch (err) { console.error('[renown] a kill could not be counted:', err); }
  return true;
}

/** A foe's level as the game rolled it - the entity's, or the level an outdoor copy was built at. */
export function renownFoeLevel(foe) {
  const l = foe?.entity?.level ?? foe?.builtLevel;
  return Number.isFinite(l) && l > 0 ? l : 1;
}

/** Tests only: forget every stamp and the handler. */
export function _resetRenownKillsForTests() { _struck = new WeakMap(); _onKill = null; }

/** The service's refusals that will not change by trying again: this character (or this build) cannot report. */
const PERMANENT = new Set(['renown-character', 'renown-xp', 'renown-full']);

/**
 * The client's tracker. `report(character, xp, name)` is the account service's `/v1/renown/xp`
 * (net/accountClient.js accountRenown), answering `{ ok, data }` or `{ ok: false, error }`; `character()` the character
 * earning (systems/characterId.js), `name()` its name for the account card, `earning()` whether XP may be earned now
 * (online, and only online), `onAnswer(data, sent)` the service's word after each report, `onStop(error)` a refusal
 * that ends reporting for this page.
 * @param {{ report: (c: string, xp: number, name: string|null) => Promise<any>, character: () => string|null,
 *   name?: () => string|null, earning?: () => boolean, now?: () => number,
 *   onAnswer?: (data: any, sent: number) => void, onStop?: (error: string) => void }} o
 */
export function createRenownTracker({ report, character, name = () => null, earning = () => true, now = () => Date.now(), onAnswer = () => {}, onStop = () => {} }) {
  let pending = 0;
  let inFlight = false;
  let lastAt = -Infinity;
  let stopped = false;

  /** Earn `xp` now - nothing while not earning (offline) or after a permanent refusal. Answers what was kept. */
  const earn = (xp) => {
    if (stopped || !earning()) return 0;
    const n = Number.isFinite(xp) ? Math.max(0, Math.trunc(xp)) : 0;
    pending += n;
    return n;
  };

  const due = (t = now()) => !stopped && !inFlight && pending > 0 && (t - lastAt >= RENOWN_REPORT_MS || pending >= RENOWN_XP_REPORT_MAX);

  /** Send what is held now, up to one report's worth. Answers the service's data, or null. */
  const flush = async (t = now()) => {
    if (stopped || inFlight || pending <= 0) return null;
    let c = null;
    try { c = character(); } catch { c = null; }
    if (typeof c !== 'string' || !c) return null;
    const sent = Math.min(pending, RENOWN_XP_REPORT_MAX);
    inFlight = true;
    lastAt = t;
    let r;
    try { r = await report(c, sent, name?.() ?? null); } catch { r = { ok: false, error: 'offline' }; } finally { inFlight = false; }
    if (r?.ok) {
      pending = Math.max(0, pending - sent);
      try { onAnswer(r.data, sent); } catch (err) { console.error('[renown] the answer could not be shown:', err); }
      return r.data ?? null;
    }
    if (PERMANENT.has(r?.error)) { stopped = true; pending = 0; try { onStop(r.error); } catch { /* the stop stands */ } }
    else if (r?.error === 'auth' || r?.error === 'no-session') pending = 0;   // no account to earn for: nothing to keep
    return null;   // anything else (offline, a busy service, a rate) keeps what is held for the next report
  };

  return {
    earn,
    due,
    flush,
    /** The frame's knock: a report when one is due. */
    tick: (t = now()) => (due(t) ? flush(t) : null),
    pending: () => pending,
    stopped: () => stopped,
  };
}
