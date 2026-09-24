// @ts-check
// ═══════════════════════════════════════════════════════════════════
// ACC2 — THE CLOUD SAVE, SERVICE SIDE. The card in D1, the blob in R2.
//
// Mac: "Go in order." This is step 4 of the arc's own build order —
// "the card and the blob, backup only".
//
// ═══ THE CLOUD IS A BACKUP. THE LOCAL SAVE IS THE TRUTH ════════════
//
// The arc page's most important sentence, and a deliberate limit rather
// than a first cut. This repo has CHARID1 and SP1 BECAUSE PLAYERS LOST
// GAMES. A design where the cloud is the truth is one where a sync bug
// is catastrophic; a design where it is a copy is one where the same
// bug is an inconvenience. So nothing here merges, nothing here
// resolves a conflict, and nothing here deletes anything a player did
// not ask to have deleted.
//
// ═══ A SLOT IS (character, save name) ══════════════════════════════
//
// NOT the local integer key. `systems/saveSlots.js` files a slot under
// the FIRST FREE integer (SAV4, from DFU's CreateNewSavePath), and that
// integer is a fact about ONE store: two devices that saved in a
// different order hold the same character's QuickSave under different
// numbers. The identity is the pair DFU's FindSaveFolderByNames uses,
// with CHARID1's correction that the character half is an ID and not a
// name — which is the whole reason CHARID1 exists.
//
// ═══ THE CARD IS THE SaveInfo, AT BOTH ENDS ════════════════════════
//
// saveSlots.js keeps SAV4's law that "a slot is only real WITH its
// SaveInfo — an orphaned data blob does not enumerate". The same law
// runs here: the ROW is written first, a blob without a row is refused,
// and a listing reads rows. `bytes` stays 0 until the data lands, so an
// upload that died halfway shows as an unfinished slot instead of
// passing for a backup.
//
// ═══ EVERYTHING IS SCOPED BY THE PLAYER THE CALLER PROVED ══════════
//
// Every function here takes `playerId` from the resolved session and
// every statement binds it. There is no route that takes a player id
// from a caller, which is the shape of the bug this kind of service
// gets wrong: `WHERE character_id = ?` without the player is one typo
// away from handing somebody another account's game.
// ═══════════════════════════════════════════════════════════════════

import { SAVES_MAX, SAVE_NAME_MAX, saveKey } from './service.js';

/** How many characters of a player-typed character NAME are kept. It is
 *  display only — CHARID1's whole point is that the name is not the
 *  identity — so a long one is cut rather than refused. */
export const CHARACTER_NAME_MAX = 64;
/** The BUILD_TAG a slot was written by; bounded for the same reason. */
export const VERSION_TAG_MAX = 64;

/** A whole, non-negative number, or null. Every numeric field on a card
 *  is a compare-and-display value (saveSlots.js says so of gameTime and
 *  realTime both), so a fractional or negative one is not a smaller
 *  number, it is a card this service did not write. */
const wholeOrNull = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : null);
const textOrNull = (v, max) => (typeof v === 'string' && v ? v.slice(0, max) : null);

/**
 * THE CARD A CLIENT MAY SEND, projected — the fields this service
 * keeps and nothing else, the way `validSocialAct` projects an act on
 * the wire. A body with extra keys is not an error; the extras simply
 * do not exist here, which is what stops a client's private field
 * becoming a column somebody has to support.
 *
 * @param {any} body
 */
export function saveCardOf(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  return {
    characterName: textOrNull(body.characterName, CHARACTER_NAME_MAX),
    gameTime: wholeOrNull(body.gameTime),
    realTime: wholeOrNull(body.realTime),
    dfuVersion: textOrNull(body.dfuVersion, VERSION_TAG_MAX),
    saveVersion: wholeOrNull(body.saveVersion),
  };
}

/** The row as a client sees it. `bytes` is in, because a slot with none
 *  is one the player should be told is unfinished rather than one that
 *  fails when they try to restore it. */
const cardView = (r) => ({
  characterId: r.character_id,
  saveName: r.save_name,
  characterName: r.character_name ?? null,
  gameTime: r.game_time ?? null,
  realTime: r.real_time ?? null,
  dfuVersion: r.dfu_version ?? null,
  saveVersion: r.save_version ?? null,
  bytes: r.bytes ?? 0,
  shotBytes: r.shot_bytes ?? 0,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/** Every slot this account holds, newest first. ONE query on the index
 *  0003 declares, and bounded by SAVES_MAX because that is the most
 *  rows that can exist. */
export async function listSaves({ db }, playerId) {
  const r = await db.prepare(
    'SELECT character_id, save_name, character_name, game_time, real_time, dfu_version, save_version, bytes, shot_bytes, created_at, updated_at'
    + ' FROM saves WHERE player_id = ? ORDER BY updated_at DESC LIMIT ?',
  ).bind(playerId, SAVES_MAX).all();
  return (r?.results ?? []).map(cardView);
}

/**
 * WRITE THE CARD. This is what creates a slot; the blobs refuse to land
 * without one.
 *
 * THE BOUND IS COUNTED ONLY FOR A NEW SLOT. Overwriting a slot the
 * account already holds is how a player backs up the same character
 * again, and refusing that at the bound would mean an account at 60
 * slots could never save again — the bound is on how many slots exist,
 * not on how often they are written.
 */
export async function putCard({ db, nowS }, playerId, { characterId, saveName, card }) {
  if (!playerId || !characterId || !saveName || saveName.length > SAVE_NAME_MAX) return { error: 'body' };
  if (!card) return { error: 'body' };
  const have = await db.prepare('SELECT 1 AS one FROM saves WHERE player_id = ? AND character_id = ? AND save_name = ?')
    .bind(playerId, characterId, saveName).first();
  // AT THE BOUND, THE ANSWER IS NO. The oldest slot is never taken to
  // make room: this is a backup, and a backup that deletes things to
  // make room is not one. AUDIT 68 X7-putcard-count-toctou: the bound is
  // asked IN the write, as a letter's is - a count read before it let two
  // new slots racing for the last place both land, and the oldest backup
  // fell off listSaves' LIMIT where nothing could reach it.
  const wrote = await db.prepare(
    'INSERT INTO saves (player_id, character_id, save_name, character_name, game_time, real_time, dfu_version, save_version, bytes, shot_bytes, created_at, updated_at)'
    + ' SELECT ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?'
    + ' WHERE EXISTS (SELECT 1 FROM saves WHERE player_id = ? AND character_id = ? AND save_name = ?)'
    + ' OR (SELECT COUNT(*) FROM saves WHERE player_id = ?) < ?'
    + ' ON CONFLICT (player_id, character_id, save_name) DO UPDATE SET'
    // THE BLOB COUNTS ARE NOT TOUCHED HERE. A re-written card over a
    // slot whose data is already up would otherwise reset `bytes` to 0
    // and make a good backup read as an unfinished one.
    + ' character_name = excluded.character_name, game_time = excluded.game_time, real_time = excluded.real_time,'
    + ' dfu_version = excluded.dfu_version, save_version = excluded.save_version, updated_at = excluded.updated_at',
  ).bind(
    playerId, characterId, saveName, card.characterName, card.gameTime, card.realTime,
    card.dfuVersion, card.saveVersion, nowS, nowS,
    playerId, characterId, saveName, playerId, SAVES_MAX,
  ).run();
  if (!wrote.meta.changes) return { error: 'too-many-saves' };
  return { ok: true, created: !have };
}

/**
 * PUT ONE BLOB. `part` is 'data' or 'shot'; the caller has already
 * bounded the body's size against SAVE_MAX_BYTES / SHOT_MAX_BYTES,
 * because that check belongs where the bytes are read.
 *
 * A BLOB WITHOUT A CARD IS REFUSED (`no-slot`). That is SAV4's law and
 * it is also the only thing bounding R2: without it an account could
 * write objects under keys no row ever names, and SAVES_MAX — which
 * counts rows — would bound nothing.
 */
export async function putBlob({ db, bucket, nowS }, playerId, { characterId, saveName }, part, body, bytes) {
  if (!bucket) return { error: 'no-storage' };
  const have = await db.prepare('SELECT 1 AS one FROM saves WHERE player_id = ? AND character_id = ? AND save_name = ?')
    .bind(playerId, characterId, saveName).first();
  if (!have) return { error: 'no-slot' };
  await bucket.put(saveKey(playerId, characterId, saveName, part), body);
  const col = part === 'shot' ? 'shot_bytes' : 'bytes';
  await db.prepare(`UPDATE saves SET ${col} = ?, updated_at = ? WHERE player_id = ? AND character_id = ? AND save_name = ?`)
    .bind(bytes, nowS, playerId, characterId, saveName).run();
  return { ok: true, bytes };
}

/** The object, or null. The card is checked first so a slot this
 *  account does not hold answers the same way whether the object is
 *  missing or somebody else's. */
export async function getBlob({ db, bucket }, playerId, { characterId, saveName }, part) {
  if (!bucket) return { error: 'no-storage' };
  const have = await db.prepare('SELECT 1 AS one FROM saves WHERE player_id = ? AND character_id = ? AND save_name = ?')
    .bind(playerId, characterId, saveName).first();
  if (!have) return { error: 'no-slot' };
  const obj = await bucket.get(saveKey(playerId, characterId, saveName, part));
  return obj ? { ok: true, object: obj } : { error: 'no-data' };
}

/** THE PLAYER'S OWN DELETE, and the only thing in this arc that removes
 *  a save. Both objects go, then the row — that order, so a failure
 *  halfway leaves a card whose `bytes` lie rather than an object nothing
 *  names and nothing can ever reach again. */
export async function deleteSave({ db, bucket }, playerId, { characterId, saveName }) {
  const have = await db.prepare('SELECT 1 AS one FROM saves WHERE player_id = ? AND character_id = ? AND save_name = ?')
    .bind(playerId, characterId, saveName).first();
  if (!have) return { error: 'no-slot' };
  if (bucket) {
    for (const part of ['data', 'shot']) {
      try { await bucket.delete(saveKey(playerId, characterId, saveName, part)); }
      catch { /* an object that will not go is not a reason to keep the row */ }
    }
  }
  await db.prepare('DELETE FROM saves WHERE player_id = ? AND character_id = ? AND save_name = ?')
    .bind(playerId, characterId, saveName).run();
  return { ok: true };
}

