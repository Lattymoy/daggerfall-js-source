// @ts-check
// STOREFRONT (AUDIT LANE 5, 2026-10-29; bible/06-Systems/Battle-Pass.md section 6): THE RESONANT MAUL'S DAY, AS THE SERVICE
// KEEPS IT. The Brass Colossus is fought on the machine that stood its camp, so its fall is the page's word; the page kept
// the once-a-day bound in its own store, and a blocked store, a private window, a second browser or a clock set ahead each
// held a day of its own. The page asks here when a Colossus it struck falls with a body (scenes/seasonHost.js) and mints
// the Maul on a yes alone: once a UTC day an account, on this service's clock, inside the season's Heart stage.
// The Starfall's spoils' shape (stars.js spoilsOf): the day's row written once, its ask's id on it, so an answer lost and
// asked again with the same id is a yes again, and any other ask that day is `taken`.
import { utcDay } from '../../src/net/marksLaw.js';
import { passSeasonAt, passStageAt } from '../../src/net/battlePassLaw.js';

/** The stage whose Heart Fissures wake the Colossus - its key in the law (battlePassLaw.js PASS_SEASONS; the world's
 *  systems/pass/seasonWorld.js HEART_STAGE is its index). */
export const MAUL_STAGE_KEY = 'heart';
/** An ask's id: sixteen hex, the page's own draw (the Starfall's STAR_CID_RE). */
export const MAUL_RID_RE = /^[0-9a-f]{16}$/;
/** The answer's status by refusal. */
export const SEASON_MAUL_STATUS = Object.freeze({ guest: 403, rid: 400, closed: 409, taken: 409 });

/**
 * THE MAUL'S CLAIM for the session's account: `{ ok: true, day }` once a UTC day - the day's row written by this ask, or
 * by an earlier ask with the same `rid` whose answer was lost (its own day's, whatever the day now) - else `{ error }`:
 * `guest` (no account to keep a day for), `rid`, `closed` (outside the Heart stage) or `taken` (the day's Maul went to
 * another ask).
 * @param {{ db: any, nowS: number }} ctx @param {any} player @param {any} body
 */
export async function claimMaul({ db, nowS }, player, body) {
  if (!player?.handle) return { error: 'guest' };
  const rid = body?.rid;
  if (typeof rid !== 'string' || !MAUL_RID_RE.test(rid)) return { error: 'rid' };
  // AUDIT-STOREFRONT II (lane D 2): an ask's id answered as it was, whatever the day or the stage now - a page gone before
  // the save holding its Maul landed asks again by the id it kept (scenes/seasonHost.js), and the day may have turned
  const kept = await db.prepare('SELECT day FROM season_mauls WHERE account = ?1 AND rid = ?2').bind(player.id, rid).first();
  if (kept) return { ok: true, day: kept.day };
  const nowMs = nowS * 1000, season = passSeasonAt(nowMs);
  if (!season || season.stages[passStageAt(season, nowMs)]?.key !== MAUL_STAGE_KEY) return { error: 'closed' };
  const day = utcDay(nowS);
  const [, row] = await db.batch([
    db.prepare('INSERT OR IGNORE INTO season_mauls (account, day, season, rid, at) VALUES (?1, ?2, ?3, ?4, ?5)').bind(player.id, day, season.id, rid, nowS),
    db.prepare('SELECT rid FROM season_mauls WHERE account = ?1 AND day = ?2').bind(player.id, day),
  ]);
  return row?.results?.[0]?.rid === rid ? { ok: true, day } : { error: 'taken' };
}
