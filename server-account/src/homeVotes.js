// @ts-check
// ═══════════════════════════════════════════════════════════════════
// HOME-VOTE (2026-10-10) - A TOWN'S WORD ON A PLAYER'S HOUSE, KEPT.
//
// The owner: "I want to implement a house voting system within vicinity
// of player houses. If the house votes run negative, the exterior
// decorations/interior decorations should not be shown to other players".
// What a vote is, and what a negative score hides, is src/net/homeVoteLaw.js,
// which the client reads too; the votes live here (migration 0108), one row
// an account a home, read out with the town's homes (homes.js homesInTown:
// each home's `score`, and the caller's own `vote`).
//
// ═══ A REGISTERED ACCOUNT A WEEK OLD, ONE VOTE, NEVER ITS OWN ══════
//
// A guest is a device - minted by a cleared browser, so a guest's vote is a
// vote anyone can cast a hundred times; votes are an account's, as owning a
// home is - and (AUDIT HOME-VOTE A1) an account registered a week
// (HOME_VOTE_AGE_S, a witness's bar): registering is two calls, and one vote
// down hides a home nobody has voted up. An account votes once a home (the
// primary key - a second vote is a change of mind, written over the first),
// and never on a home it is inside of: its own (any of its characters') or a
// guild's hall it has any character in (INSIDER). ONE STATEMENT DECIDES: a
// vote lands only while the home stands and the account is no insider of it,
// so a home sold or a guild joined between the read and the write takes no
// vote - nor (AUDIT HOME-VOTE II A4) one sold and bought again: a vote names
// the owner its door read, and lands only on that owner's house. A knight's
// deed house is none to vote on (II B5: its room, yard and paint are its
// save's, never the service's - a vote hid nothing). Taking one's own vote
// back is never refused, not even past the hour's bar (AUDIT A4: a vote cast
// on a hall before its voter joined the guild was held there for good; II A2).
// ═══════════════════════════════════════════════════════════════════
import { accountKind, overRate } from './accounts.js';
import { homeMapIdOk, homeBuildingKeyOk } from '../../src/net/homeLaw.js';
import { homeVoteOk, homeVoteOwnerOk, homeShunned, HOME_VOTES_MAX, HOME_VOTES_WINDOW_S, HOME_VOTE_AGE_S } from '../../src/net/homeVoteLaw.js';

/** HOME-VOTE: whether the account is an INSIDER of the home row `h` - its owner's account (any of its characters) for a
 *  home, an account with any character in the guild for a hall (AUDIT A5: the account, as `mine` is, never the playing
 *  character alone). Binds (player, player). homesInTown's `insider` and decorOf read the same clause. */
export const INSIDER = `((h.guild_id IS NULL AND h.player = ?)
    OR (h.guild_id IS NOT NULL AND EXISTS (SELECT 1 FROM guild_members g WHERE g.guild_id = h.guild_id AND g.player = ?)))`;
/** AUDIT HOME-VOTE II A4: the house's owner as the town names it at its door (homes.js homesInTown `owner`) - a home's
 *  owner, a hall's guild. */
const OWNER = `(CASE WHEN h.guild_id IS NULL THEN h.owner_name ELSE COALESCE((SELECT g.name FROM guilds g WHERE g.id = h.guild_id), h.owner_name) END)`;
/** HOME-VOTE: the home at (map, key) stands, held by the owner the vote names (II A4), no knight's deed (II B5), and the
 *  account is none of its insiders - binds (map, key, owner, player, player). */
const VOTABLE = `EXISTS (SELECT 1 FROM homes h WHERE h.map_id = ? AND h.building_key = ? AND h.deed = 0 AND ${OWNER} = ? AND NOT ${INSIDER})`;

/** A home's score - its votes summed, as the database keeps it on the home's row (AUDIT A2; 0 for none, or no home). */
export async function homeScore(db, mapId, buildingKey) {
  const r = await db.prepare('SELECT score FROM homes WHERE map_id = ? AND building_key = ?').bind(mapId, buildingKey).first();
  return Number(r?.score ?? 0);
}

/**
 * AUDIT HOME-VOTE A3: WHETHER A HOME'S DECOR IS SHOWN TO THE ACCOUNT `playerId` - by the service, so a build from
 * before HOME-VOTE (a desktop release not yet updated) or a client that ignores the law shows a shunned home's decor
 * no more than the law does (net/homeVoteLaw.js homeDecorShown): to its insiders always, to anyone else unless its votes
 * run down to HOME_SHUN_AT (HOME-SHUN). A building that is no home shows what stands.
 */
export async function homeShownTo(db, mapId, buildingKey, playerId) {
  return homeShownOf(await homeShownRead(db, mapId, buildingKey, playerId).first());
}
/** DECOR-BATCH: homeShownTo's one read, as a statement a caller's batch carries - its answer is homeShownOf's. */
export const homeShownRead = (db, mapId, buildingKey, playerId) => db.prepare(`SELECT h.score AS score, ${INSIDER} AS insider FROM homes h WHERE h.map_id = ? AND h.building_key = ?`)
  .bind(playerId ?? '', playerId ?? '', mapId, buildingKey);
/** DECOR-BATCH: homeShownTo's answer off its row (null: no home stands there - what stands is shown). */
export const homeShownOf = (r) => !r || r.insider === 1 || !homeShunned(Number(r.score));

/**
 * VOTE ON A HOME: `vote` +1 (up), -1 (down) or 0 (the account's vote taken back); a vote cast names `owner`, the house's
 * owner as its door read it (AUDIT HOME-VOTE II A4). Answers `{ ok, mapId, buildingKey, vote, score }` - the home's
 * score after it - or `{ error }`: `homes-need-account` (a guest), `bad-vote`, `vote-young` (registered less than
 * HOME_VOTE_AGE_S ago - AUDIT A1), `vote-rate`, `no-home` (no home stands there held by `owner`, or a knight's deed),
 * `vote-own` (the account's own home, or a hall of a guild it is in).
 * @param {{db: any, nowS: number}} ctx
 * @param {any} player  the session's player row
 * @param {{mapId?: unknown, buildingKey?: unknown, vote?: unknown, owner?: unknown}} body
 */
export async function voteHome({ db, nowS }, player, { mapId, buildingKey, vote, owner } = {}) {
  if (accountKind(player) !== 'linked') return { error: 'homes-need-account' };
  if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(buildingKey) || !homeVoteOk(vote) || (vote !== 0 && !homeVoteOwnerOk(owner))) return { error: 'bad-vote' };
  if (vote !== 0 && !(Number.isSafeInteger(player.registered_at) && player.registered_at <= nowS - HOME_VOTE_AGE_S)) return { error: 'vote-young' };   // AUDIT A1
  // AUDIT HOME-VOTE II A2: the hour's bar is on votes cast - a vote taken back deletes the account's own row and no
  // other, and is never refused (30 presses spent, the last a slip, held a home hidden for the hour)
  if (vote !== 0 && await overRate({ db, nowS }, `vote:${player.id}`, HOME_VOTES_MAX, HOME_VOTES_WINDOW_S)) return { error: 'vote-rate' };
  // AUDIT A4: one's own vote is taken back whatever one is now - the key names the account's own row and nobody else's
  const write = vote === 0
    ? db.prepare('DELETE FROM home_votes WHERE map_id = ? AND building_key = ? AND player = ?').bind(mapId, buildingKey, player.id)
    : db.prepare(`INSERT INTO home_votes (map_id, building_key, player, vote, voted_at) SELECT ?, ?, ?, ?, ? WHERE ${VOTABLE}
      ON CONFLICT (map_id, building_key, player) DO UPDATE SET vote = excluded.vote, voted_at = excluded.voted_at`)
      .bind(mapId, buildingKey, player.id, vote, nowS, mapId, buildingKey, owner, player.id, player.id);
  const r = await write.run();
  if (!r?.meta?.changes && vote !== 0) {
    // AUDIT HOME-VOTE II A5: nothing written, so the statement found no home it may vote on - the account was an insider
    // of the house its vote named, or no such house stands. Said as the write found it, never re-asked: a guild left
    // between the write and a second look answered `ok` for a vote nobody kept
    const stands = await db.prepare(`SELECT 1 AS one FROM homes h WHERE h.map_id = ? AND h.building_key = ? AND h.deed = 0 AND ${OWNER} = ?`).bind(mapId, buildingKey, owner).first();
    return { error: stands ? 'vote-own' : 'no-home' };
  }
  return { ok: true, mapId, buildingKey, vote, score: await homeScore(db, mapId, buildingKey) };
}
