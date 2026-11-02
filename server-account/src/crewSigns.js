// @ts-check
// CREW-SIGNED (2026-10-27; bible/03-World/Shipyards.md CREW-SIGNED) - A CREW HALL'S RECRUIT SIGNED ONCE ONLINE, the
// service's half (the law src/net/crewSignLaw.js, the table migrations/0180's).
//   HALL (/v1/crew/hall): a town's hall on a day - the slots others hold, and the asking character's own.
//   SIGN (/v1/crew/sign): held by the first character to ask, for his day; asked again by it, the same; else `crew-taken`.
//   RELEASE (/v1/crew/release): a recruit the asker holds let go. An account holds CREW_SIGN_DAY_MAX a day.
// A row's holder is `<account>:<character>` (AUDIT HORIZONTAL C8: one account's two characters held one man as one, and
// the first to pay him off let him go from under the other). No gold moves here. Not a DFU member.
import {
  crewSignOf,
  crewDayOk,
  CREW_SIGN_DAY_MAX,
  CREW_SIGN_SLOTS,
  CREW_SIGN_KEEP_DAYS,
  crewDayAt,
} from '../../src/net/crewSignLaw.js';
import { renownCharacterOk } from './renownTracks.js'; // a character id in the saves' shape - the same id, one door

/** A refusal's HTTP status. */
export const CREW_STATUS = Object.freeze({ 'crew-bad': 400, 'crew-day': 400, 'crew-taken': 409, 'crew-many': 429 });

/** The holder a character of `player`'s is, `<account>:<character>` - or null for no character in the saves' shape. */
const holderOf = (player, character) => (renownCharacterOk(character) ? `${player.id}:${character}` : null);
/** Every holder of `player`'s account sorts in [lo, hi): an account id is base64url, never `:` or `;`. */
const accountSpan = (player) => [`${player.id}:`, `${player.id};`];

/** The id asked, read and on the shared day - or the refusal. */
function asked(ctx, id) {
  const s = crewSignOf(id);
  if (!s) return { error: 'crew-bad' };
  if (!crewDayOk(s.day, ctx.nowS * 1000)) return { error: 'crew-day' };
  return s;
}

/** HALL: `{ town, day, character }` - `{ taken, mine }`, the slots held by others (the account's other characters too)
 *  and by the asking character. @param {any} ctx @param {any} player @param {any} body */
export async function crewHall(ctx, player, body = {}) {
  const town = Number(body?.town),
    day = Number(body?.day),
    who = holderOf(player, body?.character);
  if (!who || !Number.isInteger(town) || town < 0 || town > 0xffffffff || !Number.isInteger(day) || day < 0)
    return { error: 'crew-bad' };
  if (!crewDayOk(day, ctx.nowS * 1000)) return { error: 'crew-day' };
  const { results } = await ctx.db
    .prepare('SELECT slot, player FROM crew_signed WHERE town = ?1 AND day = ?2')
    .bind(town, day)
    .all();
  const taken = [],
    mine = [];
  for (const r of results ?? [])
    if (r.slot >= 0 && r.slot < CREW_SIGN_SLOTS) (r.player === who ? mine : taken).push(r.slot);
  return { taken: taken.sort(), mine: mine.sort() };
}

/** SIGN: `{ id, character }` - `{ signed: true, fresh }` (`fresh` when this ask took him), `crew-taken` or `crew-many`.
 *  @param {any} ctx @param {any} player @param {any} body */
export async function crewSign(ctx, player, body = {}) {
  const s = asked(ctx, body?.id);
  if ('error' in s) return s;
  const who = holderOf(player, body?.character);
  if (!who) return { error: 'crew-bad' };
  const [lo, hi] = accountSpan(player);
  // AUDIT HORIZONTAL C2: the day's cap and the hold in ONE statement - asked as a count, then a write, parallel asks all
  // read the count under the cap. The key settles two asks for one man; the loser reads the winner. A second try only
  // when the read finds him free under the cap: a release landed between the two statements.
  for (let tries = 0; tries < 2; tries++) {
    const r = await ctx.db
      .prepare(
        `INSERT OR IGNORE INTO crew_signed (town, day, slot, player, at) SELECT ?1, ?2, ?3, ?4, ?5
      WHERE (SELECT COUNT(*) FROM crew_signed WHERE player >= ?6 AND player < ?7 AND day = ?2) < ?8`,
      )
      .bind(s.town, s.day, s.slot, who, ctx.nowS, lo, hi, CREW_SIGN_DAY_MAX)
      .run();
    if (Number(r?.meta?.changes ?? 0) > 0) return { signed: true, fresh: true };
    const held = await ctx.db
      .prepare(
        `SELECT (SELECT player FROM crew_signed WHERE town = ?1 AND day = ?2 AND slot = ?3) AS holder,
      (SELECT COUNT(*) FROM crew_signed WHERE player >= ?4 AND player < ?5 AND day = ?2) AS n`,
      )
      .bind(s.town, s.day, s.slot, lo, hi)
      .first();
    if (held?.holder != null) return held.holder === who ? { signed: true, fresh: false } : { error: 'crew-taken' };
    if (Number(held?.n ?? 0) >= CREW_SIGN_DAY_MAX) return { error: 'crew-many' };
  }
  return { error: 'crew-taken' };
}

/** RELEASE: `{ id, character }` - `{ released }`, whether that character held him. Any day's id is let go.
 *  @param {any} ctx @param {any} player @param {any} body */
export async function crewRelease(ctx, player, body = {}) {
  const s = crewSignOf(body?.id),
    who = holderOf(player, body?.character);
  if (!s || !who) return { error: 'crew-bad' };
  const r = await ctx.db
    .prepare('DELETE FROM crew_signed WHERE town = ?1 AND day = ?2 AND slot = ?3 AND player = ?4')
    .bind(s.town, s.day, s.slot, who)
    .run();
  return { released: Number(r?.meta?.changes ?? 0) > 0 };
}

/** The sweep (cron.js): rows CREW_SIGN_KEEP_DAYS past their day - `[sql, cutoff day]`. */
export const crewSweep = (/** @type {number} */ nowS) =>
  /** @type {[string, number]} */ ([
    'DELETE FROM crew_signed WHERE rowid IN (SELECT rowid FROM crew_signed WHERE day < ?1 LIMIT ?2)',
    crewDayAt(nowS * 1000) - CREW_SIGN_KEEP_DAYS,
  ]);
