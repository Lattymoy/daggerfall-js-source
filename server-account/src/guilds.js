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
// (renownTracks.js - RENOWN-CHAR: the founding character's again), never
// the client's word. The GOLD is the client's:
// the economy is the save's, so the service writes first and the client
// pays after (HOME1's order) - the founder short of it disbands the
// guild it just founded. A deposit is the other way round: the client
// takes the gold out of its purse, then asks the treasury to hold it,
// and puts it back if refused. A withdrawal is the guildmaster's alone,
// and the treasury gives it first.
//
// REALM P2.2: A REALM CHARACTER'S GOLD IS ITS RECORD'S, HERE. A realm
// character's save is the service's (realm.js), so its founding fee, its
// deposit and its withdrawal move the record's gold in the SAME batch as
// the guild's own write, guarded - both or neither (realm.js
// prepareRealmRecord, net/realmGoldLaw.js). The two-write order above
// stays for any other character; a realm character must name where its
// record stands, or it is refused (`realm-needed`).
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
// ═══ GUILD1c: A CHANGE SAYS WHO IT MOVED ═══════════════════════════
//
// A guild rides the identity token (its id, tag and member row, read by
// `guildBadgeOf` at the mint), so a room shows the tag beside the name
// and routes the guild's chat by it. A token is read once, at a hello;
// so every act that moves a membership answers what it moved, and the
// Worker signs it: `badge` (the actor's character's guild NOW - `{}`
// for none) becomes the order its own client carries to its rooms, and
// `out` (a member removed, a guild disbanded) the order the hub hears,
// whose word reaches that member wherever they stand.
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═══════════════════════════════════════════════════════════════════
import { accountKind, displayName, overRate } from './accounts.js';
import { CHAR_ID_RE } from './service.js';
import { prepareRealmRecord, realmActFirst, recordMovedOf, mustChange, dropObjects, dropIfUnnamed, REALM_ID_RE } from './realm.js';   // REALM P2.2; AUDIT REALM L1-F2: the record asked first; AUDIT REALM2 S2/S3
import { payFromSave, creditSave } from '../../src/net/realmGoldLaw.js';   // REALM P2.2: the wallet's own order, over the record
import { renownTrackOf } from './renownTracks.js';
import { HANDLE_RE } from '../../src/net/handleShape.js';
import { MARKS_LEDGER_SHOWN } from '../../src/net/marksLaw.js';   // MARKS1: the guild's Marks lines shown
import { marksOpenFor, guildMarksSweep, guildDeedsToday } from './marks.js';   // AUDIT 28 M5: the Marks shown only where they are the viewer's; M3: a guild that goes sweeps them; AUDIT SILVER-WAYS A3: the day's deeds
import { hallViewOf, heraldryOfRow } from './halls.js';   // GUILD1d: the guild's hall and heraldry, in its view
import {
  GUILD_FOUND_GOLD, GUILD_FOUND_RENOWN, GUILD_MEMBERS_MAX, GUILD_RANK_NAMES, GUILD_RANK_MASTER, GUILD_RANK_OFFICER, GUILD_RANK_RECRUIT,
  GUILD_TREASURY_MAX, GUILD_LEDGER_SHOWN, GUILD_OPS_MAX, GUILD_OPS_WINDOW_S, GUILD_INVITE_TTL_S, GUILD_ID_RE, GUILD_MEMBER_RE,
  guildMay, guildMayMove, guildOutranks, guildNameOf, guildNameKey, guildTagOf, guildRankNamesOf, guildGoldOk,
  GUILD_RENAME_GOLD, GUILD_RENAME_COOLDOWN_S, guildRenameAt, guildRenameOpen,   // GUILD2a: a new name, for a price
} from '../../src/net/guildLaw.js';
import { vaultStanding, guildVaultSlots } from '../../src/net/guildVaultLaw.js';   // GUILD2b: the vault, in the guild's view
import { checkName, normaliseName, standsAlone, IMPERSONATION, textCaught } from '../../src/net/nameFilter.js';   // GUILD2a: a guild's name and tag pass the name filter (Seats-Arc 18 said they did)
import { seatWeekOf } from '../../src/net/townSeatLaw.js';   // GUILD2a: no new name in a week the guild fights for a seat

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

/** GUILD1c: THE CHARACTER'S GUILD AS A TOKEN CARRIES IT - `{ gi, gt, gm }` (the guild's id, its tag, the member row)
 *  or null for a character in none. The mint's one read, so the tag beside a name is the roster's own row. */
export async function guildBadgeOf({ db }, playerId, character) {
  if (!charOk(character)) return null;
  const r = await db.prepare('SELECT m.rowid AS rid, g.id AS gid, g.tag AS tag FROM guild_members m JOIN guilds g ON g.id = m.guild_id WHERE m.player = ? AND m.char_id = ?')
    .bind(playerId, character).first();
  return r ? { gi: r.gid, gt: r.tag, gm: `m${r.rid}` } : null;
}
/** GUILD1c: a member row as a badge. */
const badgeOfRow = (me, tag) => ({ gi: me.guild_id, gt: tag, gm: `m${me.rid}` });

/** A guild whose guildmaster is gone is given one: its highest rank's longest-standing member. A guild that has one
 *  finds its guildmaster first in that order, and is left unwritten. */
async function succeed(db, guildId) {
  // SCALE4b (2026-10-08): ASKED BEFORE IT IS WRITTEN - the update went on every guild read and write, and a guild with
  // its master changes nothing; the same first member is read, and only one that is not the master is written (the
  // update's own guard still stands, so a race that crowned someone meanwhile leaves it nothing to change)
  const first = await db.prepare('SELECT rank FROM guild_members WHERE guild_id = ? ORDER BY rank, joined_at, rowid LIMIT 1').bind(guildId).first();
  if (!first || Number(first.rank) === GUILD_RANK_MASTER) return;
  await db.prepare(`UPDATE guild_members SET rank = ${GUILD_RANK_MASTER}
    WHERE rowid = (SELECT rowid FROM guild_members WHERE guild_id = ? ORDER BY rank, joined_at, rowid LIMIT 1) AND rank <> ${GUILD_RANK_MASTER}`).bind(guildId).run();
}

/** AUDIT LEGACY III O5: A MEMBER DEAD FOR GOOD - a realm character's tombstone (legacy.js entomb: a Bloodline's fall, an
 *  Enduring line's last death, an elder's retirement) leaves its guild as one who will never act again. Its row goes; a
 *  guild it was master of is given one (succeed - the guild was stuck with a master nobody could succeed, its members'
 *  acts asked of a dead hand); a guild it leaves empty goes when nothing keeps it (no gold, no Marks, nothing
 *  guildKeepsSql names - a death cannot be refused as a leave is, so a guild still holding something stays, memberless,
 *  as any memberless guild does). */
export async function guildMemberDead(db, player, character) {
  const row = await db.prepare('SELECT rowid AS rid, guild_id FROM guild_members WHERE player = ? AND char_id = ?').bind(player, character).first();
  if (!row) return;
  await db.prepare('DELETE FROM guild_members WHERE rowid = ?').bind(row.rid).run();
  await succeed(db, row.guild_id);
  await db.prepare(`DELETE FROM guilds WHERE id = ?1 AND treasury = 0 AND NOT EXISTS (SELECT 1 FROM guild_members WHERE guild_id = ?1)
    AND NOT EXISTS (SELECT 1 FROM guild_marks WHERE guild_id = ?1 AND balance > 0) AND NOT ${guildKeepsSql('?1')}`).bind(row.guild_id).run();
}

/** The actor, its guild made whole first - or the word for why it cannot act. MARKS1: the Marks treasury's acts
 *  (marks.js) ask the same door. AUDIT LEGACY III O5: never a tombstone - a dead realm character acts no more; O12: the
 *  service's one door asks it of every body that names a character (index.js, legacy.js isTombstone), this one's too. */
export async function guildActorOf(db, player, character) { return actorOf(db, player, character); }
async function actorOf(db, player, character) {
  if (accountKind(player) !== 'linked') return { error: 'guilds-need-account' };
  if (!charOk(character)) return { error: 'guild-character' };
  const first = await memberRow(db, player.id, character);
  if (!first) return { error: 'no-guild' };
  await succeed(db, first.guild_id);
  return { me: first.rank === GUILD_RANK_MASTER ? first : await memberRow(db, player.id, character) };
}

/** What a member sees of their guild: its name, tag, rank names and treasury; the roster; the invitations its
 *  officers have out; the latest of the ledger. AUDIT 28 M5: the Marks treasury and its lines only where Marks are the
 *  viewer's (`marksOpen`, the service's switch) - at `dev` a member who is no developer saw who put in how much. */
async function viewOf(db, guildId, me, nowS, marksOpen = false) {
  const g = await db.prepare('SELECT * FROM guilds WHERE id = ?').bind(guildId).first();
  if (!g) return null;
  const members = await db.prepare('SELECT rowid AS rid, name, rank, joined_at, player, char_id, vault_level, vault_limit, vault_day, vault_taken FROM guild_members WHERE guild_id = ? ORDER BY rank, joined_at, rowid')
    .bind(guildId).all();
  // GUILD2b: the vault's shelves - how many are filled of how many (a hall's cupboards add theirs), and this member's
  // standing at it; the pieces themselves are read on the Vault page (guildVault.js vaultOf), never with every look
  const hall = await hallViewOf(db, guildId);
  const used = Number((await db.prepare('SELECT COUNT(*) AS n FROM guild_vault WHERE guild_id = ?').bind(guildId).first())?.n ?? 0);
  const today = Math.floor(nowS / 86_400);
  const standingOf = (m) => vaultStanding(Number(m.rank), m.vault_level == null ? null : { level: m.vault_level, limit: Number(m.vault_limit) });
  const invites = guildMay(me.rank, 'invite')
    ? await db.prepare('SELECT p.handle AS name, i.by_name, i.at FROM guild_invites i JOIN players p ON p.id = i.player WHERE i.guild_id = ? AND i.at > ? ORDER BY i.at DESC')
      .bind(guildId, nowS - GUILD_INVITE_TTL_S).all()
    : { results: [] };
  const ledger = await db.prepare('SELECT at, who, kind, amount, balance FROM guild_ledger WHERE guild_id = ? ORDER BY seq DESC LIMIT ?').bind(guildId, GUILD_LEDGER_SHOWN).all();
  // MARKS1: the Marks treasury beside the gold one, and its latest lines (0025_marks.sql - the one ledger)
  const marks = marksOpen ? await db.prepare('SELECT balance FROM guild_marks WHERE guild_id = ?').bind(guildId).first() : null;
  const marksLines = marksOpen ? await db.prepare(`SELECT at, who, kind, amount FROM marks_ledger
    WHERE (dst_kind = 'guild' AND dst_id = ?1) OR (src_kind = 'guild' AND src_id = ?1) ORDER BY seq DESC LIMIT ?2`).bind(guildId, MARKS_LEDGER_SHOWN).all() : null;
  let ranks = GUILD_RANK_NAMES;
  try { ranks = guildRankNamesOf(JSON.parse(g.ranks)) ?? GUILD_RANK_NAMES; } catch { /* the defaults */ }
  return {
    id: g.id, name: g.name, tag: g.tag, ranks: [...ranks], treasury: g.treasury, foundedAt: g.founded_at, rank: me.rank,
    // HALL-GOLD (FIELD BUGS 2026-10-03): what of the treasury buys a hall - the gold realm characters put in (`realm_gold`,
    // 0020_realm_audit.sql), the one the hall's buy spends (halls.js buyHall) - never shown, so a guild could not tell
    // why a treasury that held the price was refused
    hallGold: Number(g.realm_gold ?? 0),
    // GUILD1d (Seats-Arc 8): the hall (null for none) and the heraldry (null until chosen), every member's to read
    hall, heraldry: heraldryOfRow(g.heraldry),
    // GUILD2a: when the guild last took a new name, and when it may next (null: now)
    renamedAt: g.renamed_at == null ? null : Number(g.renamed_at), renameAt: guildRenameAt(g.renamed_at == null ? null : Number(g.renamed_at)),
    vault: (() => {
      const mine = (members?.results ?? []).find((m) => m.player === me.player && m.char_id === me.char_id) ?? me;
      return { used, max: guildVaultSlots(!!hall), me: { ...standingOf(mine), taken: Number(mine.vault_day) === today ? Number(mine.vault_taken ?? 0) : 0 } };
    })(),
    members: (members?.results ?? []).map((m) => ({
      member: `m${m.rid}`, name: m.name, rank: m.rank, joinedAt: m.joined_at, you: m.player === me.player && m.char_id === me.char_id,
      vault: standingOf(m),   // GUILD2b: each member's standing - the Members page's grants read it
    })),
    invites: (invites?.results ?? []).map((i) => ({ name: i.name, by: i.by_name, at: i.at })),
    ledger: (ledger?.results ?? []).map((l) => ({ at: l.at, who: l.who, kind: l.kind, amount: l.amount, balance: l.balance })),
    ...(marksOpen ? {
      marks: Number(marks?.balance ?? 0),
      // AUDIT GUILD1d R5: a heraldry changed is its own line (the treasury paid it), never a deposit
      marksLedger: (marksLines?.results ?? []).map((l) => ({ at: l.at, who: l.who, kind: GUILD_MARKS_LINE_KIND[l.kind] ?? 'deposit', amount: l.amount })),
      // AUDIT SILVER-WAYS A3: the day's guild deeds against their cap (marks.js guildDeedsToday) - written for this line
      // and never read, so a guild could not see its four
      ...(await guildDeedsToday(db, guildId, nowS)),
    } : {}),
  };
}

/** AUDIT GUILD1d R5: a treasury line's word on the Guild tab - a heraldry changed is the treasury paying, never a
 *  deposit. SILVER-WAYS: and a guild deed struck to it, a contract's pay put up from it and what came home. */
const GUILD_MARKS_LINE_KIND = Object.freeze({
  'guild-withdraw': 'withdraw', heraldry: 'heraldry', 'guild-deed': 'deed', 'contract-escrow': 'contract', 'contract-return': 'contract-return',
});

/** The member a roster names, in the actor's own guild - or null. */
async function targetOf(db, me, member) {
  const rid = memberIdOf(member);
  if (rid == null) return null;
  return db.prepare('SELECT rowid AS rid, * FROM guild_members WHERE rowid = ? AND guild_id = ?').bind(rid, me.guild_id).first();
}

const spend = (ctx, player) => overRate(ctx, `guild:${player.id}`, GUILD_OPS_MAX, GUILD_OPS_WINDOW_S);

/** GUILD2a: a guild's name and tag through the name filter (net/nameFilter.js checkName) - the chat's, and a player's -
 *  AND EACH WORD OF THE NAME ON ITS OWN: the filter is a handle's, and reads a name run together ("serveradmins"), where a
 *  reserved word inside a longer one stands alone nowhere - so "Server Admins" and "Moderator Guild" passed it whole. */
/*  AUDIT GUILD2 G3: a word with no letters in it is no word the filter reads - its `empty` is a handle's "a name needs some
 *  letters", not a refusal of a slur - so "The 7 Blades" and a tag of "22" passed GUILD1's shapes and were refused here. */
/*  AUDIT2 GUILD2 S2: A WORD IS READ AS A WORD. The filter's second reading - the letters' runs collapsed, a handle's
 *  `cccoooock` - is a handle's, and read over each word of a guild's name it caught ordinary words as the server's own:
 *  "The Iron Staff" (`staf`), "The Dark Mood" (`mod`). The slurs and the crude words keep both readings; the server's
 *  words (IMPERSONATION) are read on a word's own letters, as written. The whole name and the tag keep the filter whole.
 *  Answers the word caught, or null - the refusal names it (nameFilter.js's own law: "the refusal says WHICH word"). */
export function guildWordRefusal(name, tag) {
  for (const w of [name, tag]) {
    if (!w || !normaliseName(w)) continue;
    const c = checkName(w);
    if (!c.ok) return c.word || w;   // never '' - a refusal names something, and '' reads as none
  }
  for (const w of String(name ?? '').split(/[\s'-]+/)) {
    const flat = normaliseName(w);
    if (!flat) continue;
    const c = checkName(w);
    if (c.ok) continue;
    if (c.kind !== 'impersonation') return c.word || w;
    const own = IMPERSONATION.find((x) => standsAlone(flat, x));
    if (own) return own;
  }
  return null;
}
export const guildWordsOk = (name, tag) => guildWordRefusal(name, tag) == null;

/**
 * GUILD2a (bible/11-Multiplayer/Guild-Overhaul.md; asked: "A way to change your guild name for a price"): A NEW NAME - the
 * guildmaster's: a name, a tag, or both (`name`/`tag` absent or the same keep the one standing), through the law's shapes
 * and the name filter, free of every other guild's (a guild nobody is left in gives its own up, as at a founding), paid
 * GUILD_RENAME_GOLD from the treasury - from the gold realm characters put in (`realm_gold`, the part a hall is bought
 * with: HALL-GOLD), so no bank's word buys it - never sooner than a fortnight after the last, and never in a week the
 * guild fights for a seat (heraldry's own rule, AUDIT-SEATS S10: its banners are on the field). ONE BATCH: the row
 * renamed and paid only where every one of those still holds, the treasury's line the ledger trigger's (`rename`), the
 * rename written down, the hall's owner name with it. Answers the guild's view and the actor's badge (its tag is new -
 * GUILD1c's order carries it to the rooms).
 */
export async function renameGuild(ctx, player, { character, name = null, tag = null } = {}) {
  const { db, nowS } = ctx;
  const a = await actorOf(db, player, character);
  if (a.error) return a;
  if (!guildMay(a.me.rank, 'rename')) return { error: 'guild-rank' };
  const gid = a.me.guild_id;
  const g = await db.prepare('SELECT * FROM guilds WHERE id = ?').bind(gid).first();
  if (!g) return { error: 'no-guild' };
  const n = name == null || name === '' ? g.name : guildNameOf(name);
  const t = tag == null || tag === '' ? g.tag : guildTagOf(tag);
  if (!n || !t) return { error: 'bad-guild' };
  if (n === g.name && t === g.tag) return { error: 'guild-rename-same' };
  const caught = guildWordRefusal(n, t);
  if (caught) return { error: 'guild-name-word', word: caught };   // AUDIT2 GUILD2 S2: the word caught, said
  const renamedAt = g.renamed_at == null ? null : Number(g.renamed_at);
  if (!guildRenameOpen(renamedAt, nowS)) return { error: 'guild-rename-soon', at: guildRenameAt(renamedAt) };
  const week = seatWeekOf(nowS * 1000);
  const battle = `EXISTS (SELECT 1 FROM town_seat_battles WHERE week = ${week} AND (attacker = ?1 OR defender = ?1) AND state <> 'void')`;
  if ((await db.prepare(`SELECT ${battle} AS b`).bind(gid).first())?.b) return { error: 'guild-rename-siege' };
  if (Number(g.realm_gold ?? 0) < GUILD_RENAME_GOLD) return { error: 'guild-rename-gold' };
  if (await spend(ctx, player)) return { error: 'guild-rate' };
  const key = guildNameKey(n);
  // a guild nobody is left in holds its name and tag for no one (foundGuild's sweep, the same clause)
  await db.prepare(`DELETE FROM guilds WHERE id != ?3 AND (name_key = ?1 OR tag = ?2) AND NOT EXISTS (SELECT 1 FROM guild_members m WHERE m.guild_id = guilds.id)
    AND treasury = 0 AND NOT EXISTS (SELECT 1 FROM guild_marks WHERE guild_id = guilds.id AND balance > 0) AND NOT ${guildKeepsSql('guilds.id')}`).bind(key, t, gid).run();
  const who = displayName(player);
  try {
    await db.batch([
      db.prepare(`UPDATE guilds SET name = ?2, name_key = ?3, tag = ?4, renamed_at = ?5, treasury = treasury - ?6, realm_gold = realm_gold - ?6,
          moved_by = ?7, moved_at = ?5, moved_kind = 'rename'
        WHERE id = ?1 AND name = ?8 AND tag = ?9 AND realm_gold >= ?6 AND treasury >= ?6
          AND (renamed_at IS NULL OR renamed_at + ?10 <= ?5) AND NOT ${battle}
          AND EXISTS (SELECT 1 FROM guild_members WHERE rowid = ?11 AND guild_id = ?1 AND rank = ${GUILD_RANK_MASTER})`)
        .bind(gid, n, key, t, nowS, GUILD_RENAME_GOLD, who, g.name, g.tag, GUILD_RENAME_COOLDOWN_S, a.me.rid),
      mustChange(db),
      db.prepare('INSERT INTO guild_renames (guild_id, at, who, old_name, old_tag, new_name, new_tag, cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(gid, nowS, who, g.name, g.tag, n, t, GUILD_RENAME_GOLD),
      // the hall's owner, as its purchase copied the guild's name (halls.js buyHall) - reads prefer the live name; the copy too
      db.prepare('UPDATE homes SET owner_name = ? WHERE guild_id = ?').bind(n, gid),
    ]);
  } catch {
    // a unique held (another guild took the name or the tag), or the row moved under it: say which
    if (await db.prepare('SELECT 1 FROM guilds WHERE name_key = ? AND id != ?').bind(key, gid).first()) return { error: 'guild-name-taken' };
    if (await db.prepare('SELECT 1 FROM guilds WHERE tag = ? AND id != ?').bind(t, gid).first()) return { error: 'guild-tag-taken' };
    const now = await db.prepare('SELECT realm_gold, renamed_at FROM guilds WHERE id = ?').bind(gid).first();
    if (!now) return { error: 'no-guild' };
    if (Number(now.realm_gold ?? 0) < GUILD_RENAME_GOLD) return { error: 'guild-rename-gold' };
    const was = now.renamed_at == null ? null : Number(now.renamed_at);
    if (!guildRenameOpen(was, nowS)) return { error: 'guild-rename-soon', at: guildRenameAt(was) };   // AUDIT2 GUILD2 S7: said here too
    return { error: 'guild-rename-moved' };
  }
  const me = await memberRow(db, player.id, character);
  if (!me) return { error: 'no-guild' };
  return { ok: true, guild: await viewOf(db, gid, me, nowS, marksOpenFor(player, ctx.env)), badge: badgeOfRow(me, t), cost: GUILD_RENAME_GOLD };
}

/**
 * FOUND ONE. The character must stand at Renown GUILD_FOUND_RENOWN on the service's own track (RENOWN-CHAR: its own
 * again) and belong to no guild;
 * the name and the tag must be free. The founder is its guildmaster; the client pays the fee after (HOME1's order).
 * @param {{db: any, nowS: number, rand: (b: Uint8Array) => void}} ctx
 */
export async function foundGuild(ctx, player, { character, name, tag, realm = null, region = null } = {}) {
  const { db, nowS, rand } = ctx;
  if (accountKind(player) !== 'linked') return { error: 'guilds-need-account' };
  if (!charOk(character)) return { error: 'guild-character' };
  // AUDIT REALM2 S2: A FOUNDING IS A REALM CHARACTER'S, PAID ON ITS RECORD - any other id founded on its client's word,
  // the fee never paid, and customs carried the guildmaster in
  if (!REALM_ID_RE.test(character)) return { error: 'realm-only' };
  const side = await realmActFirst(db, player.id, character, realm);   // REALM P2.2; AUDIT REALM L1-F2: where the record stands, before any other word
  if (side.error) return side;
  const n = guildNameOf(name);
  const t = guildTagOf(tag);
  if (!n || !t) return { error: 'bad-guild' };
  // GUILD2a: THE NAME FILTER, at last - Seats-Arc 18 said a guild's name and tag passed it, and neither ever had: only the
  // chat (wire.js) called it. A name or a tag that reads as a slur, a crude word or the server's is refused here as a new
  // name is (renameGuild)
  const caught = guildWordRefusal(n, t);
  if (caught) return { error: 'guild-name-word', word: caught };   // AUDIT2 GUILD2 S2: the word caught, said
  if (await spend(ctx, player)) return { error: 'guild-rate' };
  const track = await renownTrackOf({ db }, player.id, character);   // RENOWN-CHAR: the founding character's own
  if ((track?.level ?? 1) < GUILD_FOUND_RENOWN) return { error: 'guild-renown' };
  if (await memberRow(db, player.id, character)) return { error: 'guild-already' };
  const key = guildNameKey(n);
  // a guild nobody is left in holds its name and tag for no one - AUDIT 31 S7: while it keeps nothing, as any going
  // (endGuild's): its gold, its Marks, its guild Stores and its writs stay with the name until they are answered for
  await db.prepare(`DELETE FROM guilds WHERE (name_key = ?1 OR tag = ?2) AND NOT EXISTS (SELECT 1 FROM guild_members m WHERE m.guild_id = guilds.id)
    AND treasury = 0 AND NOT EXISTS (SELECT 1 FROM guild_marks WHERE guild_id = guilds.id AND balance > 0) AND NOT ${guildKeepsSql('guilds.id')}`).bind(key, t).run();
  const id = mintGuildId(rand);
  // REALM P2.2: a realm character pays the founding on its record, in the founding's own batch
  const prep = side.at ? await prepareRealmRecord(ctx, player.id, side.at, (save) => (payFromSave(save, GUILD_FOUND_GOLD, region) ? null : 'realm-gold')) : null;
  if (prep?.error) return prep;
  try {
    await db.batch([
      ...(prep?.steps ?? []),
      db.prepare('INSERT INTO guilds (id, name, name_key, tag, ranks, treasury, founded_at) VALUES (?, ?, ?, ?, ?, 0, ?)')
        .bind(id, n, key, t, JSON.stringify(GUILD_RANK_NAMES), nowS),
      db.prepare(`INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, ${GUILD_RANK_MASTER}, ?, ?)`)
        .bind(player.id, character, id, displayName(player), nowS),
    ]);
  } catch {
    if (prep) await dropIfUnnamed(db, ctx.bucket, player.id, character, prep.key);   // AUDIT REALM2 S3: a batch that landed and lost its answer keeps its save
    // AUDIT REALM L1-F2: a record that moved under the founding says so first; else one of the uniques held: say which
    const moved = side.at ? await recordMovedOf(db, player.id, side.at) : null;
    if (moved) return moved;
    if (await db.prepare('SELECT 1 FROM guilds WHERE name_key = ?').bind(key).first()) return { error: 'guild-name-taken' };
    if (await db.prepare('SELECT 1 FROM guilds WHERE tag = ?').bind(t).first()) return { error: 'guild-tag-taken' };
    return { error: 'guild-already' };
  }
  if (prep) await dropObjects(ctx.bucket, [prep.prev]);
  const me = await memberRow(db, player.id, character);
  return { ok: true, guild: await viewOf(db, id, me, nowS, marksOpenFor(player, ctx.env)), badge: badgeOfRow(me, t), ...(prep ? { realm: { seq: prep.seq } } : {}) };   // GUILD1c: the founder wears the tag now
}

/** THE CHARACTER'S GUILD, as its member sees it - `guild: null` for a character in none. */
export async function guildOf({ db, nowS, env }, player, { character } = {}) {
  const a = await actorOf(db, player, character);
  if (a.error === 'no-guild') return { ok: true, guild: null, badge: {} };   // GUILD1c: and the look says what the rooms should read - none
  if (a.error) return a;
  const guild = await viewOf(db, a.me.guild_id, a.me, nowS, marksOpenFor(player, env));
  return { ok: true, guild, badge: guild ? badgeOfRow(a.me, guild.tag) : {} };
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
export async function answerInvite({ db, nowS, env }, player, { character, guild, accept } = {}) {
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
  const view = await viewOf(db, guild, me, nowS, marksOpenFor(player, env));
  return { ok: true, guild: view, badge: view ? badgeOfRow(me, view.tag) : {} };   // GUILD1c: the joiner wears the tag now
}

/** SEAT1c: a battle the last Turning named (a Right of Siege or a Tourney, in `town_seat_rights`) is still to come - in
 *  the week after the last one settled. No clock: the next settle moves it into the past. */
const SEAT_BATTLE_PENDING = 'week > COALESCE((SELECT MAX(week) FROM town_seat_weeks), -1)';

/**
 * PROF6: whether a guild still keeps something of the professions' - goods in its guild Stores, or a writ standing (or a
 * closed one's escrow not yet home) - in SQL, the guild's id at `p`. A guild that keeps one does not go (Professions-Arc
 * 18's grown clause): the delete below asks it, and so does the Marks sweep batched before it (marks.js), so a refused
 * going leaves the Marks where they were.
 */
export const guildKeepsSql = (p) => `(EXISTS (SELECT 1 FROM guild_prof_stores WHERE guild_id = ${p} AND qty > 0)
  OR EXISTS (SELECT 1 FROM guild_writs WHERE guild_id = ${p} AND (state = 'open' OR (returned = 0 AND escrow > 0)))
  OR EXISTS (SELECT 1 FROM guild_contracts WHERE guild_id = ${p} AND (state = 'open' OR (returned = 0 AND escrow > 0)))   -- SILVER-WAYS: a contract standing, or its escrow not yet home
  OR EXISTS (SELECT 1 FROM homes WHERE guild_id = ${p})   -- GUILD1d: and its hall - sold first, its deed share into the treasury
  OR EXISTS (SELECT 1 FROM guild_vault WHERE guild_id = ${p})   -- GUILD2b: and its vault's pieces - taken out first, they are its members'
  OR EXISTS (SELECT 1 FROM town_seat_holds WHERE guild_id = ${p})   -- SEAT1c: a Charter it holds - relinquished first (SEAT0 16)
  OR EXISTS (SELECT 1 FROM town_seat_rights WHERE (guild_id = ${p} OR against = ${p}) AND ${SEAT_BATTLE_PENDING}))`;   // SEAT1c: a battle it is named in, still to come

/** The guild going: its Marks swept to the guildmaster (marks.js guildMarksSweep) and the row deleted, IN ONE BATCH -
 *  the delete only once the guild's gold treasury is empty and its Marks treasury has been emptied into the
 *  guildmaster's balance (AUDIT 28 M3: the leave's delete never looked at the Marks, and the cascade took them with no
 *  line). `alone`: a leave - nobody else may be in it. Answers the delete's result. */
async function endGuild(db, guildId, player, nowS, { alone = false } = {}) {
  const [, gone] = await db.batch([
    guildMarksSweep(db, guildId, player, nowS, { alone }),
    db.prepare(`DELETE FROM guilds WHERE id = ?1 AND treasury = 0 AND NOT EXISTS (SELECT 1 FROM guild_marks WHERE guild_id = ?1 AND balance > 0)
      AND NOT ${guildKeepsSql('?1')}
      AND (?2 = 0 OR (SELECT COUNT(*) FROM guild_members WHERE guild_id = ?1) = 1)`).bind(guildId, alone ? 1 : 0),
  ]);
  return gone;
}
/** Why a guild did not go: its members, its gold, its guild Stores or writs (PROF6), its hall (GUILD1d), or Marks its
 *  guildmaster's balance has no room for. */
async function whyNotGone(db, guildId, { alone = false } = {}) {
  if (alone) {
    const n = await db.prepare('SELECT COUNT(*) AS n FROM guild_members WHERE guild_id = ?').bind(guildId).first();
    if ((n?.n ?? 0) > 1) return 'guild-master-leaves';
  }
  const g = await db.prepare('SELECT treasury FROM guilds WHERE id = ?').bind(guildId).first();
  if (g && g.treasury > 0) return 'guild-treasury';
  // PROF6: its guild Stores, or its writs
  if (g && await db.prepare('SELECT 1 FROM guild_prof_stores WHERE guild_id = ?1 AND qty > 0').bind(guildId).first()) return 'guild-stores';
  if (g && await db.prepare(`SELECT 1 FROM guild_writs WHERE guild_id = ?1 AND state = 'open'`).bind(guildId).first()) return 'guild-writs';
  // AUDIT 31 A15: a closed writ's pay still on its way home - the treasury full, not a writ standing
  if (g && await db.prepare('SELECT 1 FROM guild_writs WHERE guild_id = ?1 AND returned = 0 AND escrow > 0').bind(guildId).first()) return 'guild-writ-escrow';
  // SILVER-WAYS: a contract standing, or a closed one's pay still on its way home
  if (g && await db.prepare(`SELECT 1 FROM guild_contracts WHERE guild_id = ?1 AND state = 'open'`).bind(guildId).first()) return 'guild-contracts';
  if (g && await db.prepare('SELECT 1 FROM guild_contracts WHERE guild_id = ?1 AND returned = 0 AND escrow > 0').bind(guildId).first()) return 'guild-writ-escrow';
  if (g && await db.prepare('SELECT 1 FROM homes WHERE guild_id = ?1').bind(guildId).first()) return 'guild-hall';   // GUILD1d: its hall, sold first
  if (g && await db.prepare('SELECT 1 FROM guild_vault WHERE guild_id = ?1').bind(guildId).first()) return 'guild-vault';   // GUILD2b: its vault, emptied first
  if (g && await db.prepare('SELECT 1 FROM town_seat_holds WHERE guild_id = ?1').bind(guildId).first()) return 'guild-seat';   // SEAT1c: a Charter, relinquished first
  if (g && await db.prepare(`SELECT 1 FROM town_seat_rights WHERE (guild_id = ?1 OR against = ?1) AND ${SEAT_BATTLE_PENDING}`).bind(guildId).first()) return 'guild-battle';   // SEAT1c: a battle the Turning named it in
  return g ? 'marks-full' : 'no-guild';
}

/** LEAVE. The guildmaster leaves only a guild with nobody else in it, and only once its gold treasury is empty - that
 *  guild goes, its Marks to the guildmaster (AUDIT 28 M3); one with members is handed on first. */
export async function leaveGuild({ db, nowS }, player, { character } = {}) {
  const a = await actorOf(db, player, character);
  if (a.error) return a;
  if (a.me.rank === GUILD_RANK_MASTER) {
    // one batch: nobody joins between the count and the going, and the Marks go where the guild's gold went
    const r = await endGuild(db, a.me.guild_id, player, nowS, { alone: true });
    // GUILD1c: nobody else was in it; AUDIT MERGE-PLUS A2: and the guild's out order, as a disbanding's (below) - the
    // hub takes it off every socket this account has open, not only the one that carried the act
    if (r?.meta?.changes) return { ok: true, disbanded: true, badge: {}, out: { s: player.id, gi: a.me.guild_id } };
    return { error: await whyNotGone(db, a.me.guild_id, { alone: true }) };
  }
  const r = await db.prepare('DELETE FROM guild_members WHERE rowid = ? AND guild_id = ?').bind(a.me.rid, a.me.guild_id).run();
  if (!r?.meta?.changes) return { error: 'no-guild' };
  // GUILD1c: the leaver wears no tag now. AUDIT MERGE-PLUS A2: AND THE HUB HEARS IT AS A REMOVAL - the member row's out
  // order, which the hub applies to every socket wearing that row and HOLDS against older tokens. The badge order alone
  // reached the one socket that carried it: the leaver's other tab went on hearing and speaking in the guild's chat, and
  // a token minted before the leave (a few minutes' life) put a fresh socket straight back in.
  return { ok: true, badge: {}, out: { s: player.id, gi: a.me.guild_id, gm: `m${a.me.rid}` } };
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
  // GUILD1c: and the member it took off, for the hub - their guild's chat closes to them wherever they stand
  return r?.meta?.changes ? { ok: true, out: { s: t.player, gi: a.me.guild_id, gm: `m${t.rid}` } } : { error: 'no-member' };
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
  // TEXT-F1 (2026-10-07): a rank's name is a name the guild's members wear - its words read as a name's, the word caught
  // said (AUDIT2 GUILD2 S2's own shape)
  const caught = names.map(textCaught).find(Boolean);
  if (caught) return { error: 'guild-rank-word', word: caught };
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
    : await db.prepare('UPDATE guilds SET treasury = treasury - ?1, realm_gold = MIN(realm_gold, treasury - ?1), moved_by = ?3, moved_at = ?4 WHERE id = ?2 AND treasury >= ?1 RETURNING treasury')
      .bind(gold, me.guild_id, who, nowS).first();   // AUDIT REALM L1-F3: what realm records paid in is never more than the treasury holds
  return row ? row.treasury : null;
}

/** REALM P2.2: THE TREASURY AND A REALM CHARACTER'S RECORD MOVE TOGETHER - one batch: the record pays (a deposit, by the
 *  wallet's own order, `region`'s account last) or is paid (a withdrawal, to the purse - GUILD-LETTER: or, `letter`, as
 *  a letter of credit), and the treasury moves by what it holds, each guarded; both or neither. Answers the balance and
 *  the record's new sequence.
 *  AUDIT REALM L1-F3: A RECORD IS PAID ONLY WHAT RECORDS PAID IN. `realm_gold` (migration 0020) is the part of the
 *  treasury realm records deposited, and a realm withdrawal takes from it alone: the rest came in on a client's word -
 *  before the realm, or through the old lane any other character still has (a million deposited by a character no
 *  record stands behind, then taken out by the guildmaster's record, was a million made). */
async function realmTreasury(ctx, player, me, at, kind, gold, region, letter = false) {
  const { db, bucket, nowS } = ctx;
  const prep = await prepareRealmRecord(ctx, player.id, at, (save) => (kind === 'deposit'
    ? (payFromSave(save, gold, region) ? null : 'realm-gold')
    : (creditSave(save, gold, { letter }) ? null : 'bad-gold')), { outbound: kind === 'deposit' });   // INT3: a deposit hands the gold to the guild's
  if (prep.error) return prep;
  const move = kind === 'deposit'
    ? db.prepare('UPDATE guilds SET treasury = treasury + ?1, realm_gold = realm_gold + ?1, moved_by = ?4, moved_at = ?5 WHERE id = ?2 AND treasury + ?1 <= ?3').bind(gold, me.guild_id, GUILD_TREASURY_MAX, displayName(player), nowS)
    : db.prepare('UPDATE guilds SET treasury = treasury - ?1, realm_gold = realm_gold - ?1, moved_by = ?3, moved_at = ?4 WHERE id = ?2 AND treasury >= ?1 AND realm_gold >= ?1').bind(gold, me.guild_id, displayName(player), nowS);
  try {
    await db.batch([...prep.steps, move, mustChange(db)]);
  } catch {
    await dropIfUnnamed(db, bucket, player.id, at.id, prep.key);   // AUDIT REALM2 S3
    const moved = await recordMovedOf(db, player.id, at);
    if (moved) return moved;
    if (kind === 'deposit') return { error: 'guild-treasury-full' };
    const g = await db.prepare('SELECT treasury FROM guilds WHERE id = ?').bind(me.guild_id).first();
    return { error: (g?.treasury ?? 0) >= gold ? 'guild-treasury-old' : 'guild-treasury-short' };   // it holds that much - but not of the realm's
  }
  await dropObjects(bucket, [prep.prev]);
  const g = await db.prepare('SELECT treasury FROM guilds WHERE id = ?').bind(me.guild_id).first();
  return { ok: true, treasury: g?.treasury ?? 0, realm: { seq: prep.seq } };
}

/** PUT GOLD IN - any member. The client has already taken it from its purse, and puts it back if this refuses. A realm
 *  character's record pays it here, with the treasury (REALM P2.2). */
export async function depositToGuild(ctx, player, { character, gold, realm = null, region = null } = {}) {
  const { db, nowS } = ctx;
  const side = await realmActFirst(db, player.id, character, realm);   // AUDIT REALM L1-F2: where the record stands, before any other word
  if (side.error) return side;
  const a = await actorOf(db, player, character);
  if (a.error) return a;
  if (!guildMay(a.me.rank, 'deposit')) return { error: 'guild-rank' };
  if (!guildGoldOk(gold)) return { error: 'bad-gold' };
  if (await spend(ctx, player)) return { error: 'guild-rate' };
  if (side.at) return realmTreasury(ctx, player, a.me, side.at, 'deposit', gold, region);
  const treasury = await moveTreasury(db, a.me, displayName(player), 'deposit', gold, nowS);
  return treasury == null ? { error: 'guild-treasury-full' } : { ok: true, treasury };
}

/** TAKE GOLD OUT - the guildmaster's alone (Mac: "Guildmaster only"), never more than the treasury holds. A realm
 *  character's record takes it here, with the treasury (REALM P2.2).
 *  GUILD-LETTER (FIELD BUGS 2026-09-30): `letter` true, the record takes it as a letter of credit, not as coin - the
 *  client weighed the coin against what its pack can carry (net/guildBook.js withdraw) and writes the same letter
 *  (net/realmGoldLaw.js creditSave, which reads nothing but `true`). A million gold weighs 2,500 kg. */
export async function withdrawFromGuild(ctx, player, { character, gold, realm = null, letter = false } = {}) {
  const { db, nowS } = ctx;
  const side = await realmActFirst(db, player.id, character, realm);   // AUDIT REALM L1-F2: where the record stands, before any other word
  if (side.error) return side;
  const a = await actorOf(db, player, character);
  if (a.error) return a;
  if (!guildMay(a.me.rank, 'withdraw')) return { error: 'guild-rank' };
  if (!guildGoldOk(gold)) return { error: 'bad-gold' };
  if (await spend(ctx, player)) return { error: 'guild-rate' };
  if (side.at) return realmTreasury(ctx, player, a.me, side.at, 'withdraw', gold, null, letter);
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

/** DISBAND - the guildmaster's, once the gold treasury is empty; its Marks go to the guildmaster's balance in the same
 *  batch (AUDIT 28 M3/M5 - never lost, and never locked behind a switch the guildmaster cannot pass). Everything else
 *  of the guild goes with it. */
export async function disbandGuild({ db, nowS }, player, { character } = {}) {
  const a = await actorOf(db, player, character);
  if (a.error) return a;
  if (!guildMay(a.me.rank, 'disband')) return { error: 'guild-rank' };
  const r = await endGuild(db, a.me.guild_id, player, nowS);
  // GUILD1c: the guildmaster wears no tag now, and the hub hears the guild gone - every member's chat with it
  return r?.meta?.changes ? { ok: true, badge: {}, out: { s: player.id, gi: a.me.guild_id } } : { error: await whyNotGone(db, a.me.guild_id) };
}
