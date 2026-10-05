// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SERPENT1 (2026-10-04) — THE SERPENTS SLAIN, AS THE SERVICE KEEPS THEM.
//
// Mac: "A new world event that requires players with a ship to meet up
// and take on a large scale sea serpent in the ocean." The relay holds
// Sethrakul's fight in the cell its site stands in and, at the kill, signs
// a receipt for each account that took a real part in it (src/net/
// serpentReceipt.js - `l1`, under the relay's GATE_SIGNING_KEY). This file
// is where that receipt is honoured: counted once, and paid in Renown to
// the character that fought it. Design: bible/11-Multiplayer/Sea-Serpent.md
// section 8. The raids' claim (raids.js) rung for rung - SERPENT-SET (2026-10-05):
// and its silver now, a combat strike under the day's cap (marks.js
// serpentStrikeStatement), and the gate's currency on its row: the
// embers its hoard paid (`stones`, migration 0083 - SERPENT_EMBERS), which
// the insignia's purse counts as a breach's (accounts.js insigniaPurse).
//
// ═══ WHOSE WORD, AND WHAT BOUNDS IT ════════════════════════════════
//
// The receipt is the RELAY's word - it saw the serpent fall and the
// account's part in it. What the relay could not check, this file bounds:
// it holds no map, so a modified client could stand a serpent's fight at
// a site that is not the day's (the relay keeps it apart - AUDIT SERPENT
// S1); an account is counted ONE serpent a day (migration 0081's key),
// and its Renown is charged to the account's hour, as every report is
// (renownTracks.js). A receipt earned by standing the fight out is paid
// SERPENT_STOOD_RENOWN of it.
//
// A SERPENT'S HOARD IS THIS FILE'S WORD TOO (the raids' AUDIT RAID R4):
// the receipt's seed rolls it on the device (src/systems/serpentSpoils.js)
// - and the relay hands an account's receipt to every socket of it, so the
// first claim of a (day, account), a guest's too, writes the hoard's row
// with its device's claim id (`cid`), and a claim is answered
// `spoils: true` only when that row is its own.
//
// ONE TRANSACTION (renownTracks.js's law): the row is written first,
// stamped with this claim's own NONCE; the track is credited only where
// THAT row exists - so a receipt claimed twice at once credits once.
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═══════════════════════════════════════════════════════════════════

import { verifySerpentReceipt } from '../../src/net/serpentReceipt.js';
import { SERPENT_EMBERS } from '../../src/net/serpentHoardLaw.js';   // SERPENT-SET: the embers a receipt's hoard pays
import { renownForXp, renownSerpentXp, RENOWN_XP_MAX, RENOWN_XP_HOUR_MAX, RENOWN_TRACKS_MAX } from '../../src/net/renown.js';
import { renownCharacterOk, renownNameOf, renownTrackOf } from './renownTracks.js';

/** A device's claim id - the key a serpent's hoard is given under (the raids' RAID_CID_RE). */
export const SERPENT_CID_RE = /^[0-9a-f]{16}$/;
/** AUDIT SERPENT (the books): what a receipt earned by STANDING the fight out (a hand aboard, a ship that held its
 *  waters) is paid of a serpent's Renown - half; one whose guns dealt their share is paid it whole. */
export const SERPENT_STOOD_RENOWN = 0.5;
const HOUR_S = 3600;

/** The statements that write a (day, account)'s hoard row for `cid` if none is yet, and read whose it is. */
const hoardOf = (db, day, account, cid, nowS) => [
  db.prepare('INSERT OR IGNORE INTO serpent_spoils (day, account, cid, at) VALUES (?1, ?2, ?3, ?4)').bind(day, account, cid, nowS),
  db.prepare('SELECT cid FROM serpent_spoils WHERE day = ?1 AND account = ?2').bind(day, account),
];
const hoardAnswer = (res, cid) => res?.results?.[0]?.cid === cid;

const int = (v) => (Number.isSafeInteger(Number(v)) ? Number(v) : 0);
const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

/** An account's serpents slain, for the cards: `{ slain }`. */
export async function serpentRecordOf({ db }, playerId) {
  const r = await db.prepare('SELECT COUNT(*) AS n FROM serpent_kills WHERE account = ?1').bind(playerId).first();
  return { slain: int(r?.n) };
}

/**
 * THE CLAIM: `receipt` verified with the relay's public half and naming `player` (the session's row, never the body's
 * word), counted once a (day, account), and paid to `character` - the character that fought it, which the client names
 * - in Renown (renownSerpentXp at the track's level before it, as much as the account's hour has left). SERPENT-SET:
 * the row carries the embers its hoard paid (SERPENT_EMBERS), and `strike(day, nonce, earned)` - marks.js
 * serpentStrikeStatement, null where Marks are not this account's - strikes its silver in the row's own batch, by THIS
 * claim's row alone. Answers, each with `spoils` (whether THIS claim is given the serpent's hoard):
 *   `{ recorded: true, slain, renown: { character, xp, level, credited, rose }, spoils, day, struck? }` (`day` and
 *   `struck` the service's own - the route answers the strike as `marks`),
 *   `{ recorded: false, why: 'claimed' | 'guest', slain, spoils }`, or
 *   `{ error }` - `no-gate-key`, `receipt` (`why` says which rung), `not-yours`, `renown-character`.
 * @param {{ db: any, nowS: number, subtle: SubtleCrypto, rand: (b: Uint8Array) => Uint8Array }} ctx
 * @param {{ id: string, handle?: string|null }} player
 * @param {{ receipt: unknown, character: unknown, name?: unknown, cid?: unknown }} body
 * @param {CryptoKey|null} publicKey
 */
export async function claimSerpent({ db, nowS, subtle, rand }, player, { receipt, character, name = null, cid = null }, publicKey, { strike = null } = {}) {
  if (!publicKey) return { error: 'no-gate-key' };
  const v = await verifySerpentReceipt(receipt, publicKey, { subtle, nowS });
  if (!v.ok) return { error: 'receipt', why: v.why };
  const c = v.claims;
  if (c.s !== player.id) return { error: 'not-yours' };
  const hoard = typeof cid === 'string' && SERPENT_CID_RE.test(cid);
  if (!player.handle) {   // a guest: never counted - but given its hoard, once
    const spoils = hoard ? hoardAnswer((await db.batch(hoardOf(db, c.d, player.id, cid, nowS)))[1], cid) : false;
    return { recorded: false, why: 'guest', ...(await serpentRecordOf({ db }, player.id)), spoils };
  }
  if (typeof character !== 'string' || !renownCharacterOk(character)) return { error: 'renown-character' };
  const hour = Math.floor(nowS / HOUR_S);
  const before = await renownTrackOf({ db }, player.id, character);
  // AUDIT SERPENT (the books): a hand who stood the fight out is paid SERPENT_STOOD_RENOWN of what a ship that dealt is
  const xp = Math.floor(renownSerpentXp(before?.level ?? 1) * (c.x === 'stood' ? SERPENT_STOOD_RENOWN : 1));
  const nonce = hex(rand(new Uint8Array(8)));
  const stmt = strike?.(c.d, nonce, c.x) ?? null;   // SERPENT-SET: the serpent's silver, in this batch
  const mine = 'EXISTS (SELECT 1 FROM serpent_kills WHERE day = ?3 AND account = ?1 AND nonce = ?4)';
  const track = 'SELECT xp FROM renown_tracks WHERE player = ?1 AND char_id = ?2';
  const refused = `(NOT EXISTS (${track}) AND (SELECT COUNT(*) FROM renown_tracks WHERE player = ?1) >= ?9)`;
  const want = `CASE WHEN ${refused} THEN 0 ELSE MIN(?5, MAX(0, ?6 - COALESCE((${track}), 0))) END`;
  const room = 'CASE WHEN renown_hour >= ?8 THEN MAX(0, ?7 - renown_hour_xp) ELSE ?7 END';
  const credit = `CASE WHEN ${mine} THEN MIN(${want}, ${room}) ELSE 0 END`;
  const res = await db.batch([
    // THE ROW, stamped with this claim's nonce - RETURNING it only when it was written
    db.prepare(
      `INSERT OR IGNORE INTO serpent_kills (day, account, boss, hull, char_id, xp, nonce, at, stones)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
       RETURNING nonce`,
    ).bind(c.d, player.id, c.b, c.h, character, xp, nonce, nowS, SERPENT_EMBERS),
    // THE HOUR SPENT and THE CREDIT DECIDED - by THIS claim's row alone (raids.js's statement)
    db.prepare(
      `UPDATE players SET
         renown_last_credit = ${credit},
         renown_hour_xp = CASE WHEN ${mine} THEN (CASE WHEN renown_hour >= ?8 THEN renown_hour_xp + ${credit} ELSE ${credit} END) ELSE renown_hour_xp END,
         renown_hour = CASE WHEN ${mine} THEN MAX(renown_hour, ?8) ELSE renown_hour END
       WHERE id = ?1
       RETURNING renown_last_credit AS credit`,
    ).bind(player.id, character, c.d, nonce, xp, RENOWN_XP_MAX, RENOWN_XP_HOUR_MAX, hour, RENOWN_TRACKS_MAX),
    // THE TRACK THAT EXISTS grows by the credit (never past the cap's total) - by THIS claim's row alone
    db.prepare(
      `UPDATE renown_tracks SET xp = MIN(?5, xp + (SELECT renown_last_credit FROM players WHERE id = ?1)), name = COALESCE(?6, name), updated_at = ?7
       WHERE player = ?1 AND char_id = ?2 AND ${mine}`,
    ).bind(player.id, character, c.d, nonce, RENOWN_XP_MAX, renownNameOf(name), nowS),
    // A NEW TRACK, with Renown to hold and under the bound - by THIS claim's row alone
    db.prepare(
      `INSERT INTO renown_tracks (player, char_id, name, xp, created_at, updated_at)
       SELECT ?1, ?2, ?5, renown_last_credit, ?6, ?6 FROM players
       WHERE id = ?1 AND renown_last_credit > 0
         AND NOT EXISTS (SELECT 1 FROM renown_tracks WHERE player = ?1 AND char_id = ?2)
         AND (SELECT COUNT(*) FROM renown_tracks WHERE player = ?1) < ?7
         AND ${mine}`,
    ).bind(player.id, character, c.d, nonce, renownNameOf(name), nowS, RENOWN_TRACKS_MAX),
    // the row says what the claim PAID (the hour may have left less than the serpent is worth)
    db.prepare(`UPDATE serpent_kills SET xp = (SELECT renown_last_credit FROM players WHERE id = ?1) WHERE day = ?3 AND account = ?1 AND nonce = ?4`)
      .bind(player.id, character, c.d, nonce),
    db.prepare(track).bind(player.id, character),
    db.prepare('SELECT COUNT(*) AS n FROM serpent_kills WHERE account = ?1').bind(player.id),
    ...(hoard ? hoardOf(db, c.d, player.id, cid, nowS) : []),
    // SERPENT-SET: THE SILVER, last - by THIS claim's row alone (marks.js CLAIM_GUARDS.serpent), once a (day, account)
    ...(stmt ? [stmt] : []),
  ]);
  const [row, decided, , , , after, count] = res;
  const spoils = hoard ? hoardAnswer(res[8], cid) : false;
  const struck = !!stmt && Number(res[res.length - 1]?.meta?.changes ?? 0) > 0;
  const slain = int(count?.results?.[0]?.n);
  if (!row?.results?.length) return { recorded: false, why: 'claimed', slain, spoils };
  const total = after?.results?.length ? int(after.results[0].xp) : null;
  const was = before?.xp ?? 0;
  return {
    recorded: true, slain, spoils, day: c.d, ...(stmt ? { struck } : {}),
    renown: total === null
      ? { character, xp: null, level: null, credited: 0, rose: false }   // no place for a new track: counted, paid nothing
      : { character, xp: total, level: renownForXp(total), credited: Math.max(0, int(decided?.results?.[0]?.credit)), rose: renownForXp(total) > renownForXp(was) },
  };
}
