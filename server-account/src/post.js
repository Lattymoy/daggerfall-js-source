// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SERVER-POST - THE SERVICE'S SIDE OF THE SERVER'S POST.
//
// Mac: "Let's develop an ingame server mailbox that goes next to the
// hourglass in the pause menu. It should show notifications whenever
// players have a message. First use is to utilize it for players being
// granted items."
//
// What a piece is - its bounds and its sender - is src/net/postLaw.js.
// This file is the four things its reader does with their own: list the
// box, open one, CLAIM its item, and throw one away. Nothing here writes
// a piece: the operator's workflow does (.github/workflows/server-post.yml,
// tools/sendServerPost.mjs), and no route a player can reach sends one.
//
// ═══ A READER'S POST IS THEIRS ALONE ═══════════════════════════════
//
// Every read, claim and delete names the piece AND its reader in the one
// statement (`WHERE id = ? AND to_id = ?`) - the letters' law (letters.js):
// an id that is somebody else's is exactly as absent as one that never
// existed, `no-post` for both.
//
// ═══ THE CLAIM IS THE GUILD VAULT'S TAKE ═══════════════════════════
//
// An online character's truth is the service's (0018_realm_characters):
// the item goes into the RECORD, written one sequence on by the service
// (realm.js prepareRealmRecord), and the piece's claim is stamped in the
// SAME batch, guarded - so the item lands in the record and the piece
// reads claimed together, or neither. A second claim (another tab, a lost
// answer asked again) finds `claimed_at` set and changes nothing. The
// client puts the answer's record in its pack (net/serverPost.js, as the
// vault's take does); a lost answer ends the session, and a join reads the
// record, which holds it.
// ═══════════════════════════════════════════════════════════════════
import { realmActFirst, prepareRealmRecord, mustChange, dropObjects, dropIfUnnamed, recordMovedOf, REALM_ID_RE } from './realm.js';
import { giveTradeGoods } from '../../src/net/realmTradeLaw.js';
import { POST_ID_RE, POST_BOX_MAX, postItemHead } from '../../src/net/postLaw.js';

/** The record a row holds, or null - a row the operator wrote is JSON, and one that is not is no item. */
const recordOf = (/** @type {any} */ row) => {
  if (typeof row?.item !== 'string') return null;
  try { const r = JSON.parse(row.item); return r && typeof r === 'object' && !Array.isArray(r) ? r : null; } catch { return null; }
};

/** A row's head as the box lists it. */
const headOf = (/** @type {any} */ row) => {
  const item = postItemHead(recordOf(row));
  return {
    id: row.id, from: row.sender, subject: row.subject, sentAt: row.sent_at, read: row.read_at != null,
    item, claimed: item ? row.claimed_at != null : false,
  };
};

/**
 * A READER'S BOX, newest first: every piece's head (from whom, about what, when, whether opened, what it holds and
 * whether that was taken), the count unopened and the count holding an item not yet taken - never a body (`readPost`).
 * @param {{ db: any }} ctx @param {any} reader the session's player row
 */
export async function postBoxOf({ db }, reader) {
  const { results = [] } = await db.prepare(`SELECT id, sender, subject, item, sent_at, read_at, claimed_at FROM server_post
    WHERE to_id = ? ORDER BY sent_at DESC, id DESC LIMIT ?`).bind(reader.id, POST_BOX_MAX).all();
  const post = results.map(headOf);
  return {
    post,
    unread: post.filter((p) => !p.read).length,
    unclaimed: post.filter((p) => p.item && !p.claimed).length,
    max: POST_BOX_MAX,
  };
}

/**
 * OPEN ONE of the reader's own: the whole piece, and its first opening stamped. `no-post` for an id not theirs.
 * @param {{ db: any, nowS: number }} ctx @param {any} reader @param {unknown} id
 */
export async function readPost({ db, nowS }, reader, id) {
  if (typeof id !== 'string' || !POST_ID_RE.test(id)) return { error: 'no-post' };
  const row = await db.prepare('SELECT id, sender, subject, body, item, sent_at, read_at, claimed_at FROM server_post WHERE id = ? AND to_id = ?')
    .bind(id, reader.id).first();
  if (!row) return { error: 'no-post' };
  if (row.read_at == null) await db.prepare('UPDATE server_post SET read_at = ? WHERE id = ? AND to_id = ? AND read_at IS NULL').bind(nowS, id, reader.id).run();
  return { post: { ...headOf(row), body: row.body, read: true, readAt: row.read_at ?? nowS } };
}

/**
 * CLAIM ITS ITEM into the realm character being played: `{ id, character, realm }` - `realm` where its record stands
 * (`{ id, lease, seq }`, the same character), asked FIRST as every realm act is (realm.js realmActFirst). The item goes
 * into the record and the piece is stamped claimed in one batch. Answers `{ ok, id, item, realm: { seq } }`, or a
 * refusal: `realm-only` (not an online character), the realm's own words (`lease`, `seq`, `realm-needed`), `no-post`,
 * `post-no-item`, `post-claimed`, or `server` - the batch failed with the piece still waiting, asked again.
 * @param {any} ctx  `{ db, bucket, rand, nowS }`
 * @param {any} reader
 * @param {{ id?: unknown, character?: unknown, realm?: unknown }} body
 */
export async function claimPost(ctx, reader, { id, character, realm = null } = {}) {
  const { db, bucket, nowS } = ctx;
  if (typeof character !== 'string' || !REALM_ID_RE.test(character)) return { error: 'realm-only' };
  const side = await realmActFirst(db, reader.id, character, realm);
  if (side.error) return side;
  if (!side.at) return { error: 'realm-needed' };
  if (typeof id !== 'string' || !POST_ID_RE.test(id)) return { error: 'no-post' };
  const row = await db.prepare('SELECT id, item, claimed_at FROM server_post WHERE id = ? AND to_id = ?').bind(id, reader.id).first();
  if (!row) return { error: 'no-post' };
  const rec = recordOf(row);
  if (!rec) return { error: 'post-no-item' };
  if (row.claimed_at != null) return { error: 'post-claimed' };
  const prep = await prepareRealmRecord(ctx, reader.id, side.at, (save) => { giveTradeGoods(save, [rec], 0); return null; });
  if ('error' in prep) return prep;
  try {
    await db.batch([
      ...prep.steps,
      // THE CLAIM, once: a second (another tab, an answer lost and asked again) finds it stamped and moves nothing
      db.prepare('UPDATE server_post SET claimed_at = ?, claimed_by = ?, read_at = COALESCE(read_at, ?) WHERE id = ? AND to_id = ? AND claimed_at IS NULL')
        .bind(nowS, character, nowS, id, reader.id),
      mustChange(db),
    ]);
  } catch {
    await dropIfUnnamed(db, bucket, reader.id, side.at.id, prep.key);
    const moved = await recordMovedOf(db, reader.id, side.at);
    if (moved) return moved;
    // the record stands where the tab said, so the claim's own write was what failed: taken meanwhile (another tab), gone,
    // or neither - the service's own failure, which the client asks again (realmSaves.js REALM_ACT_TRANSIENT)
    const again = await db.prepare('SELECT claimed_at FROM server_post WHERE id = ? AND to_id = ?').bind(id, reader.id).first();
    return { error: !again ? 'no-post' : again.claimed_at != null ? 'post-claimed' : 'server' };
  }
  await dropObjects(bucket, [prep.prev]);
  return { ok: true, id, item: rec, realm: { seq: prep.seq } };
}

/**
 * THROW ONE AWAY - the reader's own, and never one whose item is still waiting (`post-unclaimed`: claim it first, so a
 * gift is never thrown away by a slip).
 * @param {{ db: any }} ctx @param {any} reader @param {unknown} id
 */
export async function deletePost({ db }, reader, id) {
  if (typeof id !== 'string' || !POST_ID_RE.test(id)) return { error: 'no-post' };
  const r = await db.prepare('DELETE FROM server_post WHERE id = ? AND to_id = ? AND (item IS NULL OR claimed_at IS NOT NULL)').bind(id, reader.id).run();
  if (r?.meta?.changes) return { ok: true, id };
  const row = await db.prepare('SELECT id FROM server_post WHERE id = ? AND to_id = ?').bind(id, reader.id).first();
  return { error: row ? 'post-unclaimed' : 'no-post' };
}
