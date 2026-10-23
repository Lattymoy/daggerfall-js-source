// @ts-check
// ═══════════════════════════════════════════════════════════════════
// STAR7 (2026-10-20) — THE FALLEN STARS HELD, AS THE SERVICE KEEPS THEM.
//
// The owner: "A lore accurate world encounter defense mission ...
// something coming from the sky and crashing into the ground, where
// people need to defend the objective in a wave based format with a boss
// topping off the encounter at the end." The relay keeps a fallen star's
// ledger and, at its master's fall, signs a receipt for each account that
// struck one of the star's foes and stood at it (src/net/starfall/
// starReceipt.js - `j1`, under the relay's GATE_SIGNING_KEY). This file
// honours it: counted once, and paid in Renown to the character that
// fought it and in silver under the day's combat cap. Design:
// bible/11-Multiplayer/Starfall.md section 6. The raid's claim, rung for
// rung (raids.js) - one transaction, the row first and stamped with the
// claim's own nonce, every credit by that row alone.
//
// ═══ WHOSE WORD, AND WHAT BOUNDS IT ════════════════════════════════
//
// The receipt is the RELAY's word: it saw the master fall on its
// encounter clock and the account stand at the star. What the relay
// cannot check - the owner's machine runs the foes (section 10) - this
// file bounds: a star counts once an account (its night and star are the
// row's key), and an account is counted STAR_CLAIMS_DAY_MAX a UTC day,
// the day the star FELL (its own, never the claim's - a receipt carried
// to the next morning counts on its own night's bound).
//
// A GUEST is thanked (the spoils' row, once a device) and never counted,
// as at a raid; registered later, its next receipt counts.
//
// AN ANSWER LOST AFTER THE BATCH (AUDIT STARFALL B3): the batch is the
// whole of the claim's money - the row, the Renown, the silver and INT5's
// fill (budget.js spoilsGrantStatement) - so a 5xx past it, or a dropped
// line, takes nothing. Its retry is `claimed`, and where the row is THIS
// DEVICE'S (its claim id on the row, `own`) the answer carries what the
// lost one said - the count and the Renown the row credited its
// character - so the device finishes once (starClaims.js).
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═══════════════════════════════════════════════════════════════════

import { verifyStarReceipt } from '../../src/net/starfall/starReceipt.js';
import { starTimes } from '../../src/net/starfall/starfallLaw.js';
import { renownForXp, renownRaidXp, RENOWN_XP_MAX, RENOWN_XP_HOUR_MAX, RENOWN_TRACKS_MAX } from '../../src/net/renown.js';
import { renownCharacterOk, renownNameOf, renownTrackOf, renownHeldSql } from './renownTracks.js';
import { spoilsGrantStatement } from './budget.js';

/** The stars an account is counted for in one UTC day - three nights' worth (a night's three, nine an evening's
 *  hours), well past what a player defends in a sitting and well short of a day's every star (seventy-two). */
export const STAR_CLAIMS_DAY_MAX = 9;
/** A device's claim id - the key a star's spoils are given under (the raid's RAID_CID_RE). */
export const STAR_CID_RE = /^[0-9a-f]{16}$/;
const HOUR_S = 3600;
const DAY_MS = 86_400_000;

/** A star's key in the rows: its night and its star. */
export const starKeyOf = (n, k) => `${n}.${k}`;
/** The UTC day a star fell - its row's day, the bound's. */
export const starDayOf = (n, k) => Math.floor(starTimes(n, k).fallAt / DAY_MS);

/** The statements that write a (star, account)'s spoils row for `cid` if none is yet, and read whose it is - the claim's
 *  `spoils` is that row's cid being its own (the raid's AUDIT RAID R4: the relay hands a receipt to every socket of an
 *  account, so a second browser would roll the spoils again). */
const spoilsOf = (db, star, account, cid, nowS) => [
  db.prepare('INSERT OR IGNORE INTO star_spoils (star, account, cid, at) VALUES (?1, ?2, ?3, ?4)').bind(star, account, cid, nowS),
  db.prepare('SELECT cid FROM star_spoils WHERE star = ?1 AND account = ?2').bind(star, account),
];
const spoilsAnswer = (res, cid) => res?.results?.[0]?.cid === cid;

const int = (v) => (Number.isSafeInteger(Number(v)) ? Number(v) : 0);
const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

/** An account's stars held, for the cards: `{ held }`. */
export async function starRecordOf({ db }, playerId) {
  const r = await db.prepare('SELECT COUNT(*) AS n FROM stars_held WHERE account = ?1').bind(playerId).first();
  return { held: int(r?.n) };
}

/**
 * THE CLAIM: `receipt` verified with the relay's public half and naming `player` (the session's row, never the body's
 * word), counted once a (star, account), no more than STAR_CLAIMS_DAY_MAX on the UTC day the star fell, and paid to
 * `character` - the character that fought it, its own save's id - in Renown (renownRaidXp at the track's level before
 * it, as much as the account's hour has left: a star is a fight about as long as a raid). Answers, each with `spoils`
 * (whether THIS claim is given the star's spoils):
 *   `{ recorded: true, held, key, renown: { character, xp, level, credited, rose }, spoils, struck }`,
 *   `{ recorded: false, why: 'claimed' | 'guest' | 'day-full', held, spoils }` - and a `claimed` whose row this device's
 *   claim id wrote `{ ..., own: true, renown: { character, xp, level, credited, rose } }` (B3: what the lost answer said -
 *   the row's character and what it credited, the track as it stands), or
 *   `{ error }` - `no-gate-key` (no public half here), `receipt` (`why` the verifier's rung), `not-yours`,
 *   `renown-character` (no character to pay).
 * @param {{ db: any, nowS: number, subtle: SubtleCrypto, rand: (b: Uint8Array) => Uint8Array }} ctx
 * @param {{ id: string, handle?: string|null }} player
 * @param {{ receipt: unknown, character: unknown, name?: unknown, cid?: unknown }} body
 * @param {CryptoKey|null} publicKey
 * @param {{ strike?: ((key: string, nonce: string) => any)|null }} [silver] the star's silver - a statement its batch runs
 *   by its own row (marks.js starStrikeStatement), null where Marks are not this account's
 */
export async function claimStar({ db, nowS, subtle, rand }, player, { receipt, character, name = null, cid = null }, publicKey, { strike = null } = {}) {
  if (!publicKey) return { error: 'no-gate-key' };
  const v = await verifyStarReceipt(receipt, publicKey, { subtle, nowS });
  if (!v.ok) return { error: 'receipt', why: v.why };
  const c = v.claims;
  if (c.s !== player.id) return { error: 'not-yours' };
  const [n, k] = c.sf;
  const key = starKeyOf(n, k);
  const thanks = typeof cid === 'string' && STAR_CID_RE.test(cid);
  if (!player.handle) {   // a guest: never counted - but given the spoils, once a device
    const spoils = thanks ? spoilsAnswer((await db.batch(spoilsOf(db, key, player.id, cid, nowS)))[1], cid) : false;
    return { recorded: false, why: 'guest', ...(await starRecordOf({ db }, player.id)), spoils };
  }
  if (typeof character !== 'string' || !renownCharacterOk(character)) return { error: 'renown-character' };
  const day = starDayOf(n, k);
  const hour = Math.floor(nowS / HOUR_S);
  const before = await renownTrackOf({ db }, player.id, character);
  const xp = renownRaidXp(before?.level ?? 1);
  const nonce = hex(rand(new Uint8Array(8)));
  const mint = strike?.(key, nonce) ?? null;
  const mine = 'EXISTS (SELECT 1 FROM stars_held WHERE star = ?3 AND account = ?1 AND nonce = ?4)';
  const track = 'SELECT xp FROM renown_tracks WHERE player = ?1 AND char_id = ?2';
  // WHAT THE TRACK CAN TAKE and WHAT THE HOUR HAS LEFT (the raid's AUDIT RAID R5) - a new character past the bound takes
  // nothing (no track to hold it)
  const refused = `(NOT EXISTS (${track}) AND ${renownHeldSql('?1')} >= ?9)`;
  const want = `CASE WHEN ${refused} THEN 0 ELSE MIN(?5, MAX(0, ?6 - COALESCE((${track}), 0))) END`;
  const room = 'CASE WHEN renown_hour >= ?8 THEN MAX(0, ?7 - renown_hour_xp) ELSE ?7 END';
  const credit = `CASE WHEN ${mine} THEN MIN(${want}, ${room}) ELSE 0 END`;
  const res = await db.batch([
    // THE ROW, under the day's bound, stamped with this claim's nonce and the device's claim id (B3: whose row a `claimed`
    // retry finds) - RETURNING it only when it was written
    db.prepare(
      `INSERT OR IGNORE INTO stars_held (star, account, day, char_id, xp, nonce, at, cid)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?9
       WHERE (SELECT COUNT(*) FROM stars_held WHERE account = ?2 AND day = ?3) < ?8
       RETURNING nonce`,
    ).bind(key, player.id, day, character, xp, nonce, nowS, STAR_CLAIMS_DAY_MAX, thanks ? cid : null),
    // THE HOUR SPENT and THE CREDIT DECIDED - by THIS claim's row alone; every SET reads the row as it WAS
    db.prepare(
      `UPDATE players SET
         renown_last_credit = ${credit},
         renown_hour_xp = CASE WHEN ${mine} THEN (CASE WHEN renown_hour >= ?8 THEN renown_hour_xp + ${credit} ELSE ${credit} END) ELSE renown_hour_xp END,
         renown_hour = CASE WHEN ${mine} THEN MAX(renown_hour, ?8) ELSE renown_hour END
       WHERE id = ?1
       RETURNING renown_last_credit AS credit`,
    ).bind(player.id, character, key, nonce, xp, RENOWN_XP_MAX, RENOWN_XP_HOUR_MAX, hour, RENOWN_TRACKS_MAX),
    // THE TRACK THAT EXISTS grows by the credit (never past the cap's total) - by THIS claim's row alone
    db.prepare(
      `UPDATE renown_tracks SET xp = MIN(?5, xp + (SELECT renown_last_credit FROM players WHERE id = ?1)), name = COALESCE(?6, name), updated_at = ?7
       WHERE player = ?1 AND char_id = ?2 AND ${mine}`,
    ).bind(player.id, character, key, nonce, RENOWN_XP_MAX, renownNameOf(name), nowS),
    // A NEW TRACK, with Renown to hold and under the bound - by THIS claim's row alone
    db.prepare(
      `INSERT INTO renown_tracks (player, char_id, name, xp, created_at, updated_at)
       SELECT ?1, ?2, ?5, renown_last_credit, ?6, ?6 FROM players
       WHERE id = ?1 AND renown_last_credit > 0
         AND NOT EXISTS (SELECT 1 FROM renown_tracks WHERE player = ?1 AND char_id = ?2)
         AND ${renownHeldSql('?1')} < ?7
         AND ${mine}`,
    ).bind(player.id, character, key, nonce, renownNameOf(name), nowS, RENOWN_TRACKS_MAX),
    // the row says what the claim PAID (the hour may have left less than the star is worth)
    db.prepare(`UPDATE stars_held SET xp = (SELECT renown_last_credit FROM players WHERE id = ?1) WHERE star = ?3 AND account = ?1 AND nonce = ?4`)
      .bind(player.id, character, key, nonce),
    db.prepare(track).bind(player.id, character),
    db.prepare('SELECT COUNT(*) AS n FROM stars_held WHERE account = ?1').bind(player.id),
    ...(thanks ? spoilsOf(db, key, player.id, cid, nowS) : []),
    // the star's silver (marks.js starStrikeStatement - under the day's combat cap), by THIS claim's row alone: a claim that
    // strikes nothing more is still counted, and one whose batch fails takes the silver back with its row
    ...(mint ? [mint] : []),
    // INT5's FILL - a signed win's spoils, the playing character's bucket - by THIS claim's row alone, IN the batch (B3: run
    // after it, as index.js ran it, an answer lost between the two lost the fill for good)
    spoilsGrantStatement(db, player.id, 0, `EXISTS (SELECT 1 FROM stars_held WHERE star = ?5 AND account = ?1 AND nonce = ?6)`, key, nonce),
  ]);
  const [row, decided, , , , after, count] = res;
  const spoils = thanks ? spoilsAnswer(res[8], cid) : false;
  const struck = !!mint && Number(res[7 + (thanks ? 2 : 0)]?.meta?.changes ?? 0) > 0;
  const held = int(count?.results?.[0]?.n);
  if (!row?.results?.length) {
    const had = await db.prepare('SELECT char_id, xp, cid FROM stars_held WHERE star = ?1 AND account = ?2').bind(key, player.id).first();
    if (!had) return { recorded: false, why: 'day-full', held, spoils };
    // B3: THIS DEVICE'S OWN ROW - its claim id on it - answered with what its lost answer said: the row's character, what
    // the row credited it, and its track as it stands (the device adopts it once, starClaims.js - never on an answer it heard)
    if (!thanks || had.cid !== cid) return { recorded: false, why: 'claimed', held, spoils };
    const now = await renownTrackOf({ db }, player.id, String(had.char_id));
    const paid = int(had.xp);
    return {
      recorded: false, why: 'claimed', held, spoils, own: true,
      renown: now
        ? { character: String(had.char_id), xp: now.xp, level: renownForXp(now.xp), credited: paid, rose: renownForXp(now.xp) > renownForXp(Math.max(0, now.xp - paid)) }
        : { character: String(had.char_id), xp: null, level: null, credited: 0, rose: false },
    };
  }
  const total = after?.results?.length ? int(after.results[0].xp) : null;
  const was = before?.xp ?? 0;
  return {
    recorded: true, held, spoils, key, struck,
    renown: total === null
      ? { character, xp: null, level: null, credited: 0, rose: false }   // no place for a new track: counted, paid nothing
      : { character, xp: total, level: renownForXp(total), credited: Math.max(0, int(decided?.results?.[0]?.credit)), rose: renownForXp(total) > renownForXp(was) },
  };
}
