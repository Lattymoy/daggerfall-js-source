// @ts-check
// ═══════════════════════════════════════════════════════════════════
// RAID4 (2026-09-28) — THE TOWNS DEFENDED, AS THE SERVICE KEEPS THEM.
//
// Mac, on World Events - Raiding Parties online: "1. Server ... 3. We
// can also add renown and it's own atheric + armor sets". The relay
// keeps a town raid's ledger and, at its cleanse, signs a receipt for
// each account that struck a raider and stood in the town
// (src/net/raidReceipt.js - `w1`, under the relay's GATE_SIGNING_KEY).
// This file is where that receipt is honoured: counted once, and paid
// in Renown to the character that fought it. Design:
// bible/03-World/Raiding-Parties.md, "The rewards (RAID4)".
//
// ═══ WHOSE WORD, AND WHAT BOUNDS IT ════════════════════════════════
//
// The receipt is the RELAY's word - it saw the count reach its target
// and the account stand in the town - so a claim is not the client's
// report of a kill. What the relay could not check, this file bounds: it
// holds no copy of the day's schedule (no game data), so a modified
// client could name a raid the day never rolled; an account is counted at
// most RAID_CLAIMS_DAY_MAX a game day (a game day is two real hours, and
// a raid is ten minutes of them), and the key's day must be its own.
//
// AUDIT RAID R5 (2026-09-28): AND ITS RENOWN IS THE HOUR'S. It was
// credited outside the hour's bound ("one raid, one credit"), and six
// raids a game day of up to 3,900 each is 11,700 an hour - over half the
// bound again, for a modified client that names raids the day never
// rolled (the relay cannot tell). A raid's Renown is charged to the
// account's hour now, as every report is (renownTracks.js): the raid is
// counted whatever the hour has left, and paid what it has left.
//
// AUDIT RAID R4: A TOWN'S THANKS ARE THIS FILE'S WORD TOO. The receipt's
// seed rolls them on the device (src/systems/raidSpoils.js), once a
// receipt and DEVICE - and the relay hands an account's receipt to every
// socket it has, so a second browser rolled them again. The first claim
// of a (raid, account), a guest's too, writes the thanks' row with its
// device's claim id (`cid`, migration 0017); a claim is answered
// `spoils: true` only when that row is its own.
//
// ═══ ONE TRANSACTION ═══════════════════════════════════════════════
//
// The claim is one `db.batch` (renownTracks.js's law, AUDIT RENOWN1):
// the row is written first, under the day's bound, stamped with this
// claim's own NONCE; the track is credited only where THAT row exists -
// so a receipt claimed twice, from two devices at once, credits once
// (the second claim's INSERT is ignored, and no row carries its nonce).
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═══════════════════════════════════════════════════════════════════

import { verifyRaidReceipt } from '../../src/net/raidReceipt.js';
import { raidDayOfKey } from '../../src/net/raidLaw.js';
import { renownForXp, renownRaidXp, RENOWN_XP_MAX, RENOWN_XP_HOUR_MAX, RENOWN_TRACKS_MAX } from '../../src/net/renown.js';
import { renownCharacterOk, renownNameOf, renownTrackOf } from './renownTracks.js';

/** The raids an account is counted for in one game day. */
export const RAID_CLAIMS_DAY_MAX = 6;
/** AUDIT RAID R4: a device's claim id - the key a town's thanks are given under. */
export const RAID_CID_RE = /^[0-9a-f]{16}$/;
const HOUR_S = 3600;

/** AUDIT RAID R4: the statements that write a (raid, account)'s thanks row for `cid` if none is yet, and read whose it
 *  is - the claim's `spoils` is that row's cid being its own. */
const thanksOf = (db, raid, account, cid, nowS) => [
  db.prepare('INSERT OR IGNORE INTO raid_spoils (raid, account, cid, at) VALUES (?1, ?2, ?3, ?4)').bind(raid, account, cid, nowS),
  db.prepare('SELECT cid FROM raid_spoils WHERE raid = ?1 AND account = ?2').bind(raid, account),
];
const thanksAnswer = (res, cid) => res?.results?.[0]?.cid === cid;

const int = (v) => (Number.isSafeInteger(Number(v)) ? Number(v) : 0);
const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

/** An account's towns defended, for the cards: `{ defended }`. */
export async function raidRecordOf({ db }, playerId) {
  const r = await db.prepare('SELECT COUNT(*) AS n FROM raid_cleanses WHERE account = ?1').bind(playerId).first();
  return { defended: int(r?.n) };
}

/**
 * THE CLAIM: `receipt` verified with the relay's public half and naming `player` (the session's row, never the
 * body's word), counted once a (raid, account), no more than RAID_CLAIMS_DAY_MAX a game day, and paid to `character`
 * - the character that fought it, which the client names (its own save's id) - in Renown (renownRaidXp at the track's
 * level before it - AUDIT RAID R5: as much of it as the account's hour has left). Answers, each with `spoils` (AUDIT
 * RAID R4: whether THIS claim is given the town's thanks):
 *   `{ recorded: true, defended, renown: { character, xp, level, credited, rose }, spoils }`,
 *   `{ recorded: false, why: 'claimed' | 'guest' | 'day-full', defended, spoils }`, or
 *   `{ error }` - `no-gate-key` (this service holds no public half), `receipt` (not a receipt the relay signed, or
 *   expired - `why` says which rung), `not-yours` (another account's), `renown-character` (no character to pay).
 * A new character past RENOWN_TRACKS_MAX is counted and paid nothing (its track has no place).
 * SILVER-WAYS: a counted claim answers too its `key`, whether its batch struck the town's silver (`struck`) and a guild
 * deed (`deedStruck`) - the service's own, which index.js answers in words.
 * @param {{ db: any, nowS: number, subtle: SubtleCrypto, rand: (b: Uint8Array) => Uint8Array }} ctx
 * @param {{ id: string, handle?: string|null }} player
 * @param {{ receipt: unknown, character: unknown, name?: unknown, cid?: unknown }} body `cid` the device's claim id
 *   (RAID_CID_RE) - a claim without one is answered `spoils: false` and writes no thanks
 * @param {CryptoKey|null} publicKey
 * @param {{ strike?: ((key: string, nonce: string) => any)|null, deeds?: ((key: string, nonce: string, character: string) => any[]|null)|null,
 *   contracts?: ((key: string, nonce: string) => Promise<{ statements: any[] }|null>)|null }} [silver] SILVER-WAYS: the
 *   claim's silver, each a statement (or statements) its batch runs by its own row - null where Marks are not this
 *   account's (marks.js raidStrikeStatement, deedStatements; contracts.js contractPayStatements)
 */
export async function claimRaid({ db, nowS, subtle, rand }, player, { receipt, character, name = null, cid = null }, publicKey, { strike = null, deeds = null, contracts = null } = {}) {
  if (!publicKey) return { error: 'no-gate-key' };
  const v = await verifyRaidReceipt(receipt, publicKey, { subtle, nowS });
  if (!v.ok) return { error: 'receipt', why: v.why };
  const c = v.claims;
  if (c.s !== player.id) return { error: 'not-yours' };
  const thanks = typeof cid === 'string' && RAID_CID_RE.test(cid);
  if (!player.handle) {   // a guest: never counted - but thanked, once
    const spoils = thanks ? thanksAnswer((await db.batch(thanksOf(db, c.w, player.id, cid, nowS)))[1], cid) : false;
    return { recorded: false, why: 'guest', ...(await raidRecordOf({ db }, player.id)), spoils };
  }
  if (typeof character !== 'string' || !renownCharacterOk(character)) return { error: 'renown-character' };
  const day = raidDayOfKey(c.w);
  const hour = Math.floor(nowS / HOUR_S);
  const before = await renownTrackOf({ db }, player.id, character);
  const xp = renownRaidXp(before?.level ?? 1);
  const nonce = hex(rand(new Uint8Array(8)));
  const mint = strike?.(c.w, nonce) ?? null;
  const deed = deeds?.(c.w, nonce, character) ?? null;
  const paid = contracts ? await contracts(c.w, nonce) : null;
  const mine = 'EXISTS (SELECT 1 FROM raid_cleanses WHERE raid = ?3 AND account = ?1 AND nonce = ?4)';
  const track = 'SELECT xp FROM renown_tracks WHERE player = ?1 AND char_id = ?2';
  // AUDIT RAID R5: WHAT THE TRACK CAN TAKE and WHAT THE HOUR HAS LEFT, as a report's (renownTracks.js) - and a new
  // character past the bound takes nothing (no track to hold it)
  const refused = `(NOT EXISTS (${track}) AND (SELECT COUNT(*) FROM renown_tracks WHERE player = ?1) >= ?9)`;
  const want = `CASE WHEN ${refused} THEN 0 ELSE MIN(?5, MAX(0, ?6 - COALESCE((${track}), 0))) END`;
  const room = 'CASE WHEN renown_hour >= ?8 THEN MAX(0, ?7 - renown_hour_xp) ELSE ?7 END';
  const credit = `CASE WHEN ${mine} THEN MIN(${want}, ${room}) ELSE 0 END`;
  const res = await db.batch([
    // THE ROW, under the day's bound, stamped with this claim's nonce - RETURNING it only when it was written
    db.prepare(
      `INSERT OR IGNORE INTO raid_cleanses (raid, account, day, party, char_id, xp, nonce, at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8
       WHERE (SELECT COUNT(*) FROM raid_cleanses WHERE account = ?2 AND day = ?3) < ?9
       RETURNING nonce`,
    ).bind(c.w, player.id, day, c.y, character, xp, nonce, nowS, RAID_CLAIMS_DAY_MAX),
    // THE HOUR SPENT and THE CREDIT DECIDED - by THIS claim's row alone. Every SET reads the row as it WAS, so
    // `renown_last_credit` is what this claim took out of the window before `renown_hour_xp` moved
    db.prepare(
      `UPDATE players SET
         renown_last_credit = ${credit},
         renown_hour_xp = CASE WHEN ${mine} THEN (CASE WHEN renown_hour >= ?8 THEN renown_hour_xp + ${credit} ELSE ${credit} END) ELSE renown_hour_xp END,
         renown_hour = CASE WHEN ${mine} THEN MAX(renown_hour, ?8) ELSE renown_hour END
       WHERE id = ?1
       RETURNING renown_last_credit AS credit`,
    ).bind(player.id, character, c.w, nonce, xp, RENOWN_XP_MAX, RENOWN_XP_HOUR_MAX, hour, RENOWN_TRACKS_MAX),
    // THE TRACK THAT EXISTS grows by the credit (never past the cap's total) - by THIS claim's row alone
    db.prepare(
      `UPDATE renown_tracks SET xp = MIN(?5, xp + (SELECT renown_last_credit FROM players WHERE id = ?1)), name = COALESCE(?6, name), updated_at = ?7
       WHERE player = ?1 AND char_id = ?2 AND ${mine}`,
    ).bind(player.id, character, c.w, nonce, RENOWN_XP_MAX, renownNameOf(name), nowS),
    // A NEW TRACK, with Renown to hold and under the bound - by THIS claim's row alone
    db.prepare(
      `INSERT INTO renown_tracks (player, char_id, name, xp, created_at, updated_at)
       SELECT ?1, ?2, ?5, renown_last_credit, ?6, ?6 FROM players
       WHERE id = ?1 AND renown_last_credit > 0
         AND NOT EXISTS (SELECT 1 FROM renown_tracks WHERE player = ?1 AND char_id = ?2)
         AND (SELECT COUNT(*) FROM renown_tracks WHERE player = ?1) < ?7
         AND ${mine}`,
    ).bind(player.id, character, c.w, nonce, renownNameOf(name), nowS, RENOWN_TRACKS_MAX),
    // the row says what the claim PAID (the hour may have left less than the raid is worth)
    db.prepare(`UPDATE raid_cleanses SET xp = (SELECT renown_last_credit FROM players WHERE id = ?1) WHERE raid = ?3 AND account = ?1 AND nonce = ?4`)
      .bind(player.id, character, c.w, nonce),
    db.prepare(track).bind(player.id, character),
    db.prepare('SELECT COUNT(*) AS n FROM raid_cleanses WHERE account = ?1').bind(player.id),
    ...(thanks ? thanksOf(db, c.w, player.id, cid, nowS) : []),
    // SILVER-WAYS: the town's silver (marks.js raidStrikeStatement - 30 under the day's combat cap), the guild's deed
    // (marks.js deedStatements) and the guild contracts it fills (contracts.js), each by THIS claim's row alone - so a
    // claim that strikes nothing more is still counted, and one whose batch fails takes them back with its row
    ...(mint ? [mint] : []),
    ...(deed ?? []),
    ...(paid?.statements ?? []),
  ]);
  const [row, decided, , , , after, count] = res;
  const spoils = thanks ? thanksAnswer(res[8], cid) : false;
  const at = 7 + (thanks ? 2 : 0);   // the first SILVER-WAYS statement's place in the batch
  const struck = !!mint && Number(res[at]?.meta?.changes ?? 0) > 0;
  const deedStruck = !!deed && Number(res[at + (mint ? 1 : 0) + 1]?.meta?.changes ?? 0) > 0;
  const defended = int(count?.results?.[0]?.n);
  if (!row?.results?.length) {
    const had = await db.prepare('SELECT 1 AS x FROM raid_cleanses WHERE raid = ?1 AND account = ?2').bind(c.w, player.id).first();
    return { recorded: false, why: had ? 'claimed' : 'day-full', defended, spoils };
  }
  const total = after?.results?.length ? int(after.results[0].xp) : null;
  const was = before?.xp ?? 0;
  return {
    recorded: true, defended, spoils, ...(strike || deeds || contracts ? { key: c.w, struck, ...(deed ? { deedStruck } : {}) } : {}),   // SILVER-WAYS: the service's own - index.js answers them in words
    renown: total === null
      ? { character, xp: null, level: null, credited: 0, rose: false }   // no place for a new track: counted, paid nothing
      : { character, xp: total, level: renownForXp(total), credited: Math.max(0, int(decided?.results?.[0]?.credit)), rose: renownForXp(total) > renownForXp(was) },
  };
}
