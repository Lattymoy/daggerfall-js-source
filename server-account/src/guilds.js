// @ts-check
// ═══════════════════════════════════════════════════════════════════
// GUILD1 - THE GUILDS, AS THE SERVICE KEEPS THEM.
//
// Mac, of the holdings: "future ownership for online guilds"; asked,
// founding takes "Gold and Renown", a guild is joined "Per character",
// its ranks are "Four, renamed by the guildmaster", and the treasury is
// the "Guildmaster only" to take from. What a guild is - its shapes,
// its bounds, what each rank may do - is src/net/guildLaw.js, which the
// client reads too; this is the one roster every client sees.
//
// ═══ REGISTERED ONLY ═══════════════════════════════════════════════
//
// A guest is a device (MAIL1's reading): a guild held by an account
// nobody can sign back into is a name and a tag taken out of the world.
// A guest may read an invitation's absence and nothing else.
//
// ═══ THE RENOWN IS THE SERVICE'S OWN ═══════════════════════════════
//
// Founding asks the character's Renown of the service's own track
// (renownTracks.js), never the client's word. The GOLD is the client's:
// the economy is the save's, so the service writes first and the client
// pays after (HOME1's order) - the founder short of it disbands the
// guild it just founded. A deposit is the other way round: the client
// takes the gold out of its purse, then asks the treasury to hold it,
// and puts it back if refused. A withdrawal is the guildmaster's alone,
// and the treasury gives it first.
//
// ═══ ONE STATEMENT DECIDES ═════════════════════════════════════════
//
// A join lands only while the guild holds fewer than its cap and the
// invitation still stands (one INSERT ... WHERE), a treasury moves only
// by what it holds (one UPDATE ... WHERE treasury >= n), and the ledger
// line is the schema's own trigger on that UPDATE (0013_guilds.sql) - so
// two members racing never overdraw it, no line is written for gold that
// did not move, and no gold moves without one. A rank is changed only
// from the rank it was read at, so two officers racing move a member
// once; a guild is handed on only while its giver still holds it, and
// its giver steps down only once the new guildmaster stands.
//
// ═══ A GUILD IS NEVER LEFT WITHOUT A GUILDMASTER ═══════════════════
//
// An account can go, and its memberships with it. A guild whose
// guildmaster went is given one before any read or write: its highest
// rank's longest-standing member. A guild nobody is left in holds its
// name and tag for no one, and gives them up to the next founder.
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═══════════════════════════════════════════════════════════════════
import { accountKind, displayName, overRate } from './accounts.js';
import { CHAR_ID_RE } from './service.js';
import { renownTrackOf } from './renownTracks.js';
import { HANDLE_RE } from '../../src/net/handleShape.js';
import {
  GUILD_FOUND_RENOWN, GUILD_MEMBERS_MAX, GUILD_RANK_NAMES, GUILD_RANK_MASTER, GUILD_RANK_OFFICER, GUILD_RANK_RECRUIT,
  GUILD_TREASURY_MAX, GUILD_LEDGER_SHOWN, GUILD_OPS_MAX, GUILD_OPS_WINDOW_S, GUILD_INVITE_TTL_S, GUILD_ID_RE, GUILD_MEMBER_RE,
  guildMay, guildMayMove, guildOutranks, guildNameOf, guildNameKey, guildTagOf, guildRankNamesOf, guildGoldOk,
} from '../../src/net/guildLaw.js';

const charOk = (c) => typeof c === 'string' && CHAR_ID_RE.test(c);
const memberIdOf = (m) => (typeof m === 'string' && GUILD_MEMBER_RE.test(m) ? Number(m.slice(1)) : null);

/** A new guild's id: `g` and ten of base 36. */
export function mintGuildId(rand) {
  const b = new Uint8Array(10);
  rand(b);
  return `g${[...b].map((x) => (x % 36).toString(36)).join('')}`;
}

/** The character's own membership, or null. */
async function memberRow(db, playerId, charId) {
  return db.prepare('SELECT rowid AS rid, * FROM guild_members WHERE player = ? AND char_id = ?').bind(playerId, charId).first();
}

/** A guild whose guildmaster is gone is given one: its highest rank's longest-standing member. A guild that has one
 *  finds its guildmaster first in that order, and is left unwritten. */
async function succeed(db, guildId) {
  await db.prepare(`UPDATE guild_members SET rank = ${GUILD_RANK_MASTER}
    WHERE rowid = (SELECT rowid FROM guild_members WHERE guild_id = ? ORDER BY rank, joined_at, rowid LIMIT 1) AND rank <> ${GUILD_RANK_MASTER}`).bind(guildId).run();
}

/** The actor, its guild made whole first - or the word for why it cannot act. */
async function actorOf(db, player, character) {
  if (accountKind(player) !== 'linked') return { error: 'guilds-need-account' };
  if (!charOk(character)) return { error: 'guild-character' };
  const first = await memberRow(db, player.id, character);
  if (!first) return { error: 'no-guild' };
  await succeed(db, first.guild_id);
  return { me: first.rank === GUILD_RANK_MASTER ? first : await memberRow(db, player.id, character) };
}

/** What a member sees of their guild: its name, tag, rank names and treasury; the roster; the invitations its
 *  officers have out; the latest of the ledger. */
async function viewOf(db, guildId, me, nowS) {
  const g = await db.prepare('SELECT * FROM guilds WHERE id = ?').bind(guildId).first();
  if (!g) return null;
  const members = await db.prepare('SELECT rowid AS rid, name, rank, joined_at, player, char_id FROM guild_members WHERE guild_id = ? ORDER BY rank, joined_at, rowid')
    .bind(guildId).all();
  const invites = guildMay(me.rank, 'invite')
    ? await db.prepare('SELECT p.handle AS name, i.by_name, i.at FROM guild_invites i JOIN players p ON p.id = i.player WHERE i.guild_id = ? AND i.at > ? ORDER BY i.at DESC')
      .bind(guildId, nowS - GUILD_INVITE_TTL_S).all()
    : { results: [] };
  const ledger = await db.prepare('SELECT at, who, kind, amount, balance FROM guild_ledger WHERE guild_id = ? ORDER BY seq DESC LIMIT ?').bind(guildId, GUILD_LEDGER_SHOWN).all();
  let ranks = GUILD_RANK_NAMES;
  try { ranks = guildRankNamesOf(JSON.parse(g.ranks)) ?? GUILD_RANK_NAMES; } catch { /* the defaults */ }
  return {
    id: g.id, name: g.name, tag: g.tag, ranks: [...ranks], treasury: g.treasury, foundedAt: g.founded_at, rank: me.rank,
    members: (members?.results ?? []).map((m) => ({
      member: `m${m.rid}`, name: m.name, rank: m.rank, joinedAt: m.joined_at, you: m.player === me.player && m.char_id === me.char_id,
    })),
    invites: (invites?.results ?? []).map((i) => ({ name: i.name, by: i.by_name, at: i.at })),
    ledger: (ledger?.results ?? []).map((l) => ({ at: l.at, who: l.who, kind: l.kind, amount: l.amount, balance: l.balance })),
  };
}

/** The member a roster names, in the actor's own guild - or null. */
async function targetOf(db, me, member) {
  const rid = memberIdOf(member);
  if (rid == null) return null;
  return db.prepare('SELECT rowid AS rid, * FROM guild_members WHERE rowid = ? AND guild_id = ?').bind(rid, me.guild_id).first();
}

const spend = (ctx, player) => overRate(ctx, `guild:${player.id}`, GUILD_OPS_MAX, GUILD_OPS_WINDOW_S);

/**
 * FOUND ONE. The character must stand at Renown GUILD_FOUND_RENOWN on the service's own track and belong to no guild;
 * the name and the tag must be free. The founder is its guildmaster; the client pays the fee after (HOME1's order).
 * @param {{db: any, nowS: number, rand: (b: Uint8Array) => void}} ctx
 */
export async function foundGuild(ctx, player, { character, name, tag } = {}) {
  const { db, nowS, rand } = ctx;
  if (accountKind(player) !== 'linked') return { error: 'guilds-need-account' };
  if (!charOk(character)) return { error: 'guild-character' };
  const n = guildNameOf(name);
  const t = guildTagOf(tag);
  if (!n || !t) return { error: 'bad-guild' };
  if (await spend(ctx, player)) return { error: 'guild-rate' };
  const track = await renownTrackOf({ db }, player.id, character);
  if ((track?.level ?? 1) < GUILD_FOUND_RENOWN) return { error: 'guild-renown' };
  if (await memberRow(db, player.id, character)) return { error: 'guild-already' };
  const key = guildNameKey(n);
  // a guild nobody is left in holds its name and tag for no one
  await db.prepare('DELETE FROM guilds WHERE (name_key = ? OR tag = ?) AND NOT EXISTS (SELECT 1 FROM guild_members m WHERE m.guild_id = guilds.id)').bind(key, t).run();
  const id = mintGuildId(rand);
  try {
    await db.batch([
      db.prepare('INSERT INTO guilds (id, name, name_key, tag, ranks, treasury, founded_at) VALUES (?, ?, ?, ?, ?, 0, ?)')
        .bind(id, n, key, t, JSON.stringify(GUILD_RANK_NAMES), nowS),
      db.prepare(`INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, ${GUILD_RANK_MASTER}, ?, ?)`)
        .bind(player.id, character, id, displayName(player), nowS),
    ]);
  } catch {
    // one of the uniques held: say which
    if (await db.prepare('SELECT 1 FROM guilds WHERE name_key = ?').bind(key).first()) return { error: 'guild-name-taken' };
    if (await db.prepare('SELECT 1 FROM guilds WHERE tag = ?').bind(t).first()) return { error: 'guild-tag-taken' };
    return { error: 'guild-already' };
  }
  const me = await memberRow(db, player.id, character);
  return { ok: true, guild: await viewOf(db, id, me, nowS) };
}

/** THE CHARACTER'S GUILD, as its member sees it - `guild: null` for a character in none. */
export async function guildOf({ db, nowS }, player, { character } = {}) {
  const a = await actorOf(db, player, character);
  if (a.error === 'no-guild') return { ok: true, guild: null };
  if (a.error) return a;
  return { ok: true, guild: await viewOf(db, a.me.guild_id, a.me, nowS) };
}

/** THE ACCOUNT'S INVITATIONS, still standing: which guild, and who asked. Any of its characters may answer one. */
export async function invitesOf({ db, nowS }, player) {
  if (accountKind(player) !== 'linked') return { ok: true, invites: [] };
  const r = await db.prepare(`SELECT i.guild_id, i.by_name, i.at, g.name, g.tag FROM guild_invites i JOIN guilds g ON g.id = i.guild_id
    WHERE i.player = ? AND i.at > ? ORDER BY i.at DESC`).bind(player.id, nowS - GUILD_INVITE_TTL_S).all();
  return { ok: true, invites: (r?.results ?? []).map((i) => ({ guild: i.guild_id, name: i.name, tag: i.tag, by: i.by_name, at: i.at })) };
}

/** INVITE AN ACCOUNT by its handle - an officer's or the guildmaster's, while the guild has room. */
export async function inviteToGuild(ctx, player, { character, handle } = {}) {
  const { db, nowS } = ctx;
  const a = await actorOf(db, player, character);
  if (a.error) return a;
  if (!guildMay(a.me.rank, 'invite')) return { error: 'guild-rank' };
  if (typeof handle !== 'string' || !HANDLE_RE.test(handle)) return { error: 'no-player' };
  if (await spend(ctx, player)) return { error: 'guild-rate' };
  const target = await db.prepare('SELECT id FROM players WHERE handle_lc = ?').bind(handle.toLowerCase()).first();
  if (!target) return { error: 'no-player' };
  const n = await db.prepare('SELECT COUNT(*) AS n FROM guild_members WHERE guild_id = ?').bind(a.me.guild_id).first();
  if ((n?.n ?? 0) >= GUILD_MEMBERS_MAX) return { error: 'guild-full' };
  await db.batch([
    // the guild's invitations a week old go with it, rather than lie there unanswerable
    db.prepare('DELETE FROM guild_invites WHERE guild_id = ? AND at <= ?').bind(a.me.guild_id, nowS - GUILD_INVITE_TTL_S),
    db.prepare('INSERT OR REPLACE INTO guild_invites (guild_id, player, by_name, at) VALUES (?, ?, ?, ?)').bind(a.me.guild_id, target.id, displayName(player), nowS),
  ]);
  return { ok: true };
}

/** ANSWER AN INVITATION with one character: declined, it goes; accepted, the character joins as a recruit while the
 *  guild has room, and it goes with the join. A join refused - the character in a guild, the guild full - leaves it
 *  standing, for another character or a free place. */
export async function answerInvite({ db, nowS }, player, { character, guild, accept } = {}) {
  if (accountKind(player) !== 'linked') return { error: 'guilds-need-account' };
  if (typeof guild !== 'string' || !GUILD_ID_RE.test(guild)) return { error: 'no-invite' };
  const live = nowS - GUILD_INVITE_TTL_S;
  if (accept !== true) {
    const gone = await db.prepare('DELETE FROM guild_invites WHERE guild_id = ? AND player = ? AND at > ? RETURNING guild_id').bind(guild, player.id, live).first();
    return gone ? { ok: true, guild: null } : { error: 'no-invite' };
  }
  if (!charOk(character)) return { error: 'guild-character' };
  const standing = () => db.prepare('SELECT 1 FROM guild_invites WHERE guild_id = ? AND player = ? AND at > ?').bind(guild, player.id, live).first();
  if (!(await standing())) return { error: 'no-invite' };
  if (await memberRow(db, player.id, character)) return { error: 'guild-already' };
  let joined;
  try {
    [joined] = await db.batch([
      db.prepare(`INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at)
        SELECT ?1, ?2, ?3, ${GUILD_RANK_RECRUIT}, ?4, ?5
        WHERE EXISTS (SELECT 1 FROM guild_invites WHERE guild_id = ?3 AND player = ?1 AND at > ?6)
          AND (SELECT COUNT(*) FROM guild_members WHERE guild_id = ?3) < ?7`)
        .bind(player.id, character, guild, displayName(player), nowS, live, GUILD_MEMBERS_MAX),
      // spent by the join, and only by it
      db.prepare('DELETE FROM guild_invites WHERE guild_id = ?1 AND player = ?2 AND EXISTS (SELECT 1 FROM guild_members WHERE player = ?2 AND char_id = ?3 AND guild_id = ?1)')
        .bind(guild, player.id, character),
    ]);
  } catch {
    return { error: 'guild-already' };   // the character joined a guild in the meantime
  }
  if (!joined?.meta?.changes) return { error: (await standing()) ? 'guild-full' : 'no-invite' };
  const me = await memberRow(db, player.id, character);
  return { ok: true, guild: await viewOf(db, guild, me, nowS) };
}

/** LEAVE. The guildmaster leaves only a guild with nobody else in it, and only once its treasury is empty - that
 *  guild goes; one with members is handed on first. */
export async function leaveGuild({ db }, player, { character } = {}) {
  const a = await actorOf(db, player, character);
  if (a.error) return a;
  if (a.me.rank === GUILD_RANK_MASTER) {
    // one statement: nobody joins between the count and the going
    const r = await db.prepare('DELETE FROM guilds WHERE id = ?1 AND treasury = 0 AND (SELECT COUNT(*) FROM guild_members WHERE guild_id = ?1) = 1')
      .bind(a.me.guild_id).run();
    if (r?.meta?.changes) return { ok: true, disbanded: true };
    const n = await db.prepare('SELECT COUNT(*) AS n FROM guild_members WHERE guild_id = ?').bind(a.me.guild_id).first();
    return { error: (n?.n ?? 0) > 1 ? 'guild-master-leaves' : 'guild-treasury' };
  }
  await db.prepare('DELETE FROM guild_members WHERE player = ? AND char_id = ?').bind(player.id, character).run();
  return { ok: true };
}

/** REMOVE A MEMBER of a lower rank - an officer's or the guildmaster's. */
export async function removeFromGuild(ctx, player, { character, member } = {}) {
  const { db } = ctx;
  const a = await actorOf(db, player, character);
  if (a.error) return a;
  const t = await targetOf(db, a.me, member);
  if (!t) return { error: 'no-member' };
  if (!guildMay(a.me.rank, 'remove') || !guildOutranks(a.me.rank, t.rank)) return { error: 'guild-rank' };
  if (await spend(ctx, player)) return { error: 'guild-rate' };
  const r = await db.prepare('DELETE FROM guild_members WHERE rowid = ? AND guild_id = ? AND rank = ?').bind(t.rid, a.me.guild_id, t.rank).run();
  return r?.meta?.changes ? { ok: true } : { error: 'no-member' };
}

/** MOVE A MEMBER between the ranks below one's own. */
export async function rankGuildMember(ctx, player, { character, member, rank } = {}) {
  const { db } = ctx;
  const a = await actorOf(db, player, character);
  if (a.error) return a;
  const t = await targetOf(db, a.me, member);
  if (!t) return { error: 'no-member' };
  if (!guildMayMove(a.me.rank, t.rank, rank)) return { error: 'guild-rank' };
  if (await spend(ctx, player)) return { error: 'guild-rate' };
  const r = await db.prepare('UPDATE guild_members SET rank = ? WHERE rowid = ? AND guild_id = ? AND rank = ?').bind(rank, t.rid, a.me.guild_id, t.rank).run();
  return r?.meta?.changes ? { ok: true } : { error: 'no-member' };
}

/** RENAME THE FOUR RANKS - the guildmaster's. */
export async function renameGuildRanks(ctx, player, { character, ranks } = {}) {
  const { db } = ctx;
  const a = await actorOf(db, player, character);
  if (a.error) return a;
  if (!guildMay(a.me.rank, 'renameRanks')) return { error: 'guild-rank' };
  const names = guildRankNamesOf(ranks);
  if (!names) return { error: 'bad-ranks' };
  if (await spend(ctx, player)) return { error: 'guild-rate' };
  await db.prepare('UPDATE guilds SET ranks = ? WHERE id = ?').bind(JSON.stringify(names), a.me.guild_id).run();
  return { ok: true, ranks: names };
}

/** Move the treasury - in, never past its cap; out, never past what it holds - naming the mover for the ledger's line
 *  (the schema's trigger writes it with the move). Answers the balance, or null when it did not move. */
async function moveTreasury(db, me, who, kind, gold, nowS) {
  const row = kind === 'deposit'
    ? await db.prepare('UPDATE guilds SET treasury = treasury + ?1, moved_by = ?4, moved_at = ?5 WHERE id = ?2 AND treasury + ?1 <= ?3 RETURNING treasury')
      .bind(gold, me.guild_id, GUILD_TREASURY_MAX, who, nowS).first()
    : await db.prepare('UPDATE guilds SET treasury = treasury - ?1, moved_by = ?3, moved_at = ?4 WHERE id = ?2 AND treasury >= ?1 RETURNING treasury')
      .bind(gold, me.guild_id, who, nowS).first();
  return row ? row.treasury : null;
}

/** PUT GOLD IN - any member. The client has already taken it from its purse, and puts it back if this refuses. */
export async function depositToGuild(ctx, player, { character, gold } = {}) {
  const { db, nowS } = ctx;
  const a = await actorOf(db, player, character);
  if (a.error) return a;
  if (!guildMay(a.me.rank, 'deposit')) return { error: 'guild-rank' };
  if (!guildGoldOk(gold)) return { error: 'bad-gold' };
  if (await spend(ctx, player)) return { error: 'guild-rate' };
  const treasury = await moveTreasury(db, a.me, displayName(player), 'deposit', gold, nowS);
  return treasury == null ? { error: 'guild-treasury-full' } : { ok: true, treasury };
}

/** TAKE GOLD OUT - the guildmaster's alone (Mac: "Guildmaster only"), never more than the treasury holds. */
export async function withdrawFromGuild(ctx, player, { character, gold } = {}) {
  const { db, nowS } = ctx;
  const a = await actorOf(db, player, character);
  if (a.error) return a;
  if (!guildMay(a.me.rank, 'withdraw')) return { error: 'guild-rank' };
  if (!guildGoldOk(gold)) return { error: 'bad-gold' };
  if (await spend(ctx, player)) return { error: 'guild-rate' };
  const treasury = await moveTreasury(db, a.me, displayName(player), 'withdraw', gold, nowS);
  return treasury == null ? { error: 'guild-treasury-short' } : { ok: true, treasury };
}

/** HAND THE GUILD ON - the guildmaster makes another member guildmaster, and becomes an officer. */
export async function handOverGuild(ctx, player, { character, member } = {}) {
  const { db } = ctx;
  const a = await actorOf(db, player, character);
  if (a.error) return a;
  if (!guildMay(a.me.rank, 'handOver')) return { error: 'guild-rank' };
  const t = await targetOf(db, a.me, member);
  if (!t || t.rid === a.me.rid) return { error: 'no-member' };
  if (await spend(ctx, player)) return { error: 'guild-rate' };
  const [given] = await db.batch([
    // only while the giver still holds it...
    db.prepare(`UPDATE guild_members SET rank = ${GUILD_RANK_MASTER} WHERE rowid = ?1 AND guild_id = ?2
      AND EXISTS (SELECT 1 FROM guild_members WHERE rowid = ?3 AND guild_id = ?2 AND rank = ${GUILD_RANK_MASTER})`).bind(t.rid, a.me.guild_id, a.me.rid),
    // ...and the giver steps down only once the new guildmaster stands
    db.prepare(`UPDATE guild_members SET rank = ${GUILD_RANK_OFFICER} WHERE rowid = ?1 AND guild_id = ?2
      AND EXISTS (SELECT 1 FROM guild_members WHERE rowid = ?3 AND guild_id = ?2 AND rank = ${GUILD_RANK_MASTER})`).bind(a.me.rid, a.me.guild_id, t.rid),
  ]);
  return given?.meta?.changes ? { ok: true } : { error: 'no-member' };
}

/** DISBAND - the guildmaster's, once the treasury is empty; everything of the guild goes with it. */
export async function disbandGuild({ db }, player, { character } = {}) {
  const a = await actorOf(db, player, character);
  if (a.error) return a;
  if (!guildMay(a.me.rank, 'disband')) return { error: 'guild-rank' };
  const r = await db.prepare('DELETE FROM guilds WHERE id = ? AND treasury = 0').bind(a.me.guild_id).run();
  return r?.meta?.changes ? { ok: true } : { error: 'guild-treasury' };
}
