// @ts-check
// ═══════════════════════════════════════════════════════════════════
// GUILD2b (2026-10-03) — THE GUILD'S VAULT, AS THE SERVICE KEEPS IT
// (bible/11-Multiplayer/Guild-Overhaul.md; the law is src/net/
// guildVaultLaw.js).
//
// Asked: "guild item storage with the leader able to grant and revoke
// perms". A vault is a guild's shelf of items, held here and never in a
// save - so it is never a copy of anyone's pack.
//
// ═══ A PIECE MOVES ON A REALM RECORD, IN THE VAULT'S OWN BATCH ═════
//
// PUT IN: the depositor's realm record (realm.js prepareRealmRecord) has
// the piece taken out of it - the very record the client picked, at the
// count offered, by the trade's own law (net/realmTradeLaw.js
// takeTradeGoods: what may leave a pack, and nothing a save does not
// hold) - and the vault's slot is written, in ONE batch the record's
// guard rolls back unless both land. TAKE OUT is the same the other way:
// the slot's piece (or part of its stack) into the taker's record, the
// slot cleared or cut only from the count it was read at. A batch that
// lands and loses its answer keeps its save (AUDIT REALM2 S3's
// dropIfUnnamed). A put's client reads a record one on as the act,
// landed (realmSaves.js realmGoldAct); a take's NEEDS its answer - the
// piece is the answer - and one lost ends the session, a join reading the
// record that holds it (AUDIT2 GUILD2 K1: read as landed, the checkpoint
// after it wrote the record without the piece). So a piece is in a pack
// or in the vault - never both, never neither.
//
// AUDIT2 GUILD2 S3: THE SHELVES' BOUND is the batch's own read - fifty,
// and fifty more while the guild holds a hall. A hall sold with more than
// fifty pieces on the shelves leaves them there: each is taken out as
// ever, and nothing is put in until fewer than fifty stand.
//
// ═══ WHO MAY ═══════════════════════════════════════════════════════
//
// A member's standing is the guildmaster's grant, or its rank's default
// (guildVaultLaw.js vaultStanding); a withdrawer's day is counted on its
// member row in the take's own batch, and the count is the decision (a
// take past the limit is refused whole). The guildmaster grants and
// revokes; nobody grants the guildmaster.
//
// A REALM CHARACTER'S ALONE: the vault moves records, and only a realm
// character's record is the service's to move.
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═══════════════════════════════════════════════════════════════════
import { displayName, overRate } from './accounts.js';
import { guildActorOf } from './guilds.js';
import { prepareRealmRecord, realmActFirst, recordMovedOf, mustChange, dropObjects, dropIfUnnamed, REALM_ID_RE } from './realm.js';
import { GUILD_OPS_MAX, GUILD_OPS_WINDOW_S, GUILD_RANK_MASTER, guildMay, GUILD_MEMBER_RE } from '../../src/net/guildLaw.js';
import { vaultStanding, vaultMayPut, vaultMayTake, vaultGrantOf, guildVaultSlots, GUILD_VAULT_LOG_SHOWN, GUILD_VAULT_SLOTS, GUILD_VAULT_HALL_SLOTS } from '../../src/net/guildVaultLaw.js';
import { takeTradeGoods, giveTradeGoods, recordCount, REALM_TRADE_RECORD_MAX } from '../../src/net/realmTradeLaw.js';
import { lawfulItem } from '../../src/systems/itemLaw.js';   // INT1 (AUDIT INT): a piece put before the law read the vault, read as it is taken

const DAY_S = 86_400;
const spend = (ctx, player) => overRate(ctx, `guild:${player.id}`, GUILD_OPS_MAX, GUILD_OPS_WINDOW_S);
/** A member row's standing at the vault. */
const standingOf = (m) => vaultStanding(Number(m.rank), m.vault_level == null ? null : { level: m.vault_level, limit: Number(m.vault_limit) });
/** What a member took out today (UTC). */
const takenToday = (m, nowS) => (Number(m.vault_day) === Math.floor(nowS / DAY_S) ? Number(m.vault_taken ?? 0) : 0);
/** A piece's name as the vault's lines say it: its own, bounded. */
const pieceName = (rec) => String(rec?.name ?? 'an item').slice(0, 64);
/** Whether the guild holds a hall (its cupboards add the vault's second shelves). */
const holdsHall = async (db, gid) => !!(await db.prepare('SELECT 1 FROM homes WHERE guild_id = ?').bind(gid).first());
/** AUDIT2 GUILD2 S3: the vault's bound as the batch reads it (`?1` the guild) - the shelves, and the hall's while it holds
 *  one: a hall sold between a put's read and its batch no longer lends its fifty. */
const SHELVES_SQL = `(${GUILD_VAULT_SLOTS} + CASE WHEN EXISTS (SELECT 1 FROM homes WHERE guild_id = ?1) THEN ${GUILD_VAULT_HALL_SLOTS} ELSE 0 END)`;

/**
 * THE VAULT, as a member reads it: every slot's piece (its record, for the picture and the card), who put it there and
 * when; the shelves' count; the latest lines; this member's standing and what it took today.
 * @param {{ db: any, nowS: number }} ctx
 */
export async function vaultOf({ db, nowS }, player, { character } = {}) {
  const a = await guildActorOf(db, player, character);
  if ('error' in a) return a;
  const gid = a.me.guild_id;
  const { results: rows = [] } = await db.prepare('SELECT slot, rec, name, count, dep_name, at FROM guild_vault WHERE guild_id = ? ORDER BY slot').bind(gid).all();
  const { results: log = [] } = await db.prepare('SELECT at, who, kind, name, count FROM guild_vault_log WHERE guild_id = ? ORDER BY seq DESC LIMIT ?').bind(gid, GUILD_VAULT_LOG_SHOWN).all();
  const me = await db.prepare('SELECT * FROM guild_members WHERE rowid = ?').bind(a.me.rid).first();
  const parse = (/** @type {string} */ t) => { try { return JSON.parse(t); } catch { return null; } };
  return {
    ok: true,
    vault: {
      max: guildVaultSlots(await holdsHall(db, gid)),
      items: rows.map((r) => ({ slot: Number(r.slot), rec: parse(r.rec), name: r.name, count: Number(r.count), by: r.dep_name, at: Number(r.at) })),
      log: log.map((l) => ({ at: Number(l.at), who: l.who, kind: l.kind, name: l.name, count: Number(l.count) })),
      me: { ...standingOf(me ?? a.me), taken: takenToday(me ?? a.me, nowS) },
    },
  };
}

/**
 * PUT A PIECE IN: `{ character, realm, pick, item, count }` - the record the client offers (its window's projection, as a
 * trade's offer is), the index of that record in the save the client checkpointed (`pick`), and how many of its stack
 * (`count`, the whole stack where absent). The member's standing must allow it; a free slot takes it. Refusals:
 * `guild-vault-rank`, `guild-vault-full`, `vault-goods` (the record does not hold it, or it may not leave a pack),
 * `guild-vault-moved` (a slot taken under it - ask again), and the realm's own (`realm-only`, `lease`, `seq`).
 * @param {any} ctx
 */
export async function vaultPut(ctx, player, { character, realm = null, pick, item, count = null } = {}) {
  const { db, bucket, nowS } = ctx;
  if (typeof character !== 'string' || !REALM_ID_RE.test(character)) return { error: 'realm-only' };
  const side = await realmActFirst(db, player.id, character, realm);   // AUDIT REALM L1-F2: where the record stands, before any other word
  if (side.error) return side;
  if (!side.at) return { error: 'realm-needed' };
  const a = await guildActorOf(db, player, character);
  if ('error' in a) return a;
  const gid = a.me.guild_id;
  const me = await db.prepare('SELECT * FROM guild_members WHERE rowid = ?').bind(a.me.rid).first();
  if (!vaultMayPut(standingOf(me ?? a.me))) return { error: 'guild-vault-rank' };
  if (!item || typeof item !== 'object' || Array.isArray(item) || !Number.isSafeInteger(pick) || pick < 0) return { error: 'bad-vault-item' };
  const n = count == null ? recordCount(item) : count;
  if (!Number.isSafeInteger(n) || n < 1 || n > recordCount(item)) return { error: 'bad-vault-count' };
  if (await spend(ctx, player)) return { error: 'guild-rate' };
  const max = guildVaultSlots(await holdsHall(db, gid));
  const { results: held = [] } = await db.prepare('SELECT slot FROM guild_vault WHERE guild_id = ?').bind(gid).all();
  const taken = new Set(held.map((r) => Number(r.slot)));
  let slot = -1;
  for (let i = 0; i < max; i++) if (!taken.has(i)) { slot = i; break; }
  if (slot < 0) return { error: 'guild-vault-full' };
  // THE RECORD'S PIECE OUT: the trade's own law - what the record holds at `pick`, the offer its very record, no more
  // than its stack, and only what may leave a pack (worn, quest, summoned, bound, gold, a boat's, a Materials Bag: never)
  /** @type {any} */
  let piece = null;
  const offered = { ...item, stackCount: n };
  const prep = await prepareRealmRecord(ctx, player.id, side.at, (save) => {
    const moved = takeTradeGoods(save, { items: [offered], gold: 0 }, [pick]);
    if (!moved || moved.length !== 1) return 'vault-goods';
    piece = moved[0];
    return JSON.stringify(piece).length > REALM_TRADE_RECORD_MAX ? 'vault-goods' : null;
  }, { outbound: true, escrow: true });   // INT3: a deposit hands the piece to the guild's members; INT4: and the ledger holds it the vault's
  if ('error' in prep) return prep;
  const who = displayName(player);
  const name = pieceName(piece);
  try {
    await db.batch([
      ...prep.steps,
      // the slot, while the member still stands in the guild. AUDIT2 GUILD2 S4: at the standing read (a revoke, or a rank
      // moved, between the read and this batch refuses the put - the take's G4, on the other door). S3: and inside the
      // vault's bound as it stands - a slot past it, or a vault already at it (a hall sold under the put), takes nothing
      db.prepare(`INSERT INTO guild_vault (guild_id, slot, rec, name, count, dep_player, dep_char, dep_name, at)
        SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9
        WHERE EXISTS (SELECT 1 FROM guild_members WHERE rowid = ?10 AND guild_id = ?1 AND rank = ?11 AND vault_level IS ?12)
          AND ?2 < ${SHELVES_SQL} AND (SELECT COUNT(*) FROM guild_vault WHERE guild_id = ?1) < ${SHELVES_SQL}`)
        .bind(gid, slot, JSON.stringify(piece), name, recordCount(piece), player.id, character, who, nowS, a.me.rid, Number(me?.rank ?? a.me.rank), me?.vault_level ?? null),
      mustChange(db),
      db.prepare("INSERT INTO guild_vault_log (guild_id, at, who, kind, name, count) VALUES (?, ?, ?, 'put', ?, ?)").bind(gid, nowS, who, name, recordCount(piece)),
    ]);
  } catch {
    await dropIfUnnamed(db, bucket, player.id, side.at.id, prep.key);   // AUDIT REALM2 S3: a batch that landed and lost its answer keeps its save
    const moved = await recordMovedOf(db, player.id, side.at);
    if (moved) return moved;
    // AUDIT2 GUILD2 S3/S4: the refusal the batch's guard meant - the standing gone, or the vault at its bound
    const again = await db.prepare('SELECT * FROM guild_members WHERE rowid = ? AND guild_id = ?').bind(a.me.rid, gid).first();
    if (!again || !vaultMayPut(standingOf(again))) return { error: 'guild-vault-rank' };
    const used = Number((await db.prepare('SELECT COUNT(*) AS n FROM guild_vault WHERE guild_id = ?').bind(gid).first())?.n ?? 0);
    if (used >= guildVaultSlots(await holdsHall(db, gid))) return { error: 'guild-vault-full' };
    return { error: 'guild-vault-moved' };
  }
  await dropObjects(bucket, [prep.prev]);
  return { ok: true, slot, item: piece, realm: { seq: prep.seq } };
}

/**
 * TAKE A PIECE OUT: `{ character, realm, slot, count, at }` - the slot's piece, or `count` of its stack, into the taker's
 * record; `at` when the slot was read (the client's view), so a slot emptied and filled again under it is never the one
 * taken. The member's standing must allow it and its day's limit hold. Refusals: `guild-vault-rank`, `guild-vault-limit`,
 * `guild-vault-empty`, `guild-vault-moved`, and the realm's own.
 * @param {any} ctx
 */
export async function vaultTake(ctx, player, { character, realm = null, slot, count = null, at = null } = {}) {
  const { db, bucket, nowS } = ctx;
  if (typeof character !== 'string' || !REALM_ID_RE.test(character)) return { error: 'realm-only' };
  const side = await realmActFirst(db, player.id, character, realm);
  if (side.error) return side;
  if (!side.at) return { error: 'realm-needed' };
  const a = await guildActorOf(db, player, character);
  if ('error' in a) return a;
  const gid = a.me.guild_id;
  const me = await db.prepare('SELECT * FROM guild_members WHERE rowid = ?').bind(a.me.rid).first();
  const standing = standingOf(me ?? a.me);
  if (standing.level !== 'withdraw') return { error: 'guild-vault-rank' };
  if (!vaultMayTake(standing, takenToday(me ?? a.me, nowS))) return { error: 'guild-vault-limit' };
  if (!Number.isSafeInteger(slot) || slot < 0 || slot >= 100) return { error: 'bad-vault-slot' };
  const row = await db.prepare('SELECT * FROM guild_vault WHERE guild_id = ? AND slot = ?').bind(gid, slot).first();
  if (!row || (at != null && Number(row.at) !== at)) return { error: row ? 'guild-vault-moved' : 'guild-vault-empty' };
  const have = Number(row.count);
  const n = count == null ? have : count;
  if (!Number.isSafeInteger(n) || n < 1 || n > have) return { error: 'bad-vault-count' };
  if (await spend(ctx, player)) return { error: 'guild-rate' };
  /** @type {any} */
  let rec = null;
  try { rec = JSON.parse(row.rec); } catch { rec = null; }
  if (!rec || typeof rec !== 'object') return { error: 'guild-vault-empty' };
  if (!lawfulItem(rec)) return { error: 'vault-goods' };   // one no honest client mints goes to no member: it waits for staff
  const give = { ...rec };
  if (rec.stackCount !== undefined || n > 1) give.stackCount = n;
  const left = have - n;
  const rest = left > 0 ? { ...rec, stackCount: left } : null;
  const prep = await prepareRealmRecord(ctx, player.id, side.at, (save) => { giveTradeGoods(save, [give], 0); return null; });
  if ('error' in prep) return prep;
  const who = displayName(player);
  const day = Math.floor(nowS / DAY_S);
  const limit = standing.limit;
  try {
    await db.batch([
      ...prep.steps,
      // the slot, only as it was read - cleared, or its stack cut. AUDIT GUILD2 G1: and holding the very piece read - a
      // slot emptied and filled again in the same second, with a stack of the same count, kept its `at` and its count, and
      // the taker was given the piece it saw while the vault lost the one put in after
      rest
        ? db.prepare('UPDATE guild_vault SET rec = ?4, count = ?5 WHERE guild_id = ?1 AND slot = ?2 AND at = ?3 AND count = ?6 AND rec = ?7').bind(gid, slot, Number(row.at), JSON.stringify(rest), left, have, row.rec)
        : db.prepare('DELETE FROM guild_vault WHERE guild_id = ?1 AND slot = ?2 AND at = ?3 AND count = ?4 AND rec = ?5').bind(gid, slot, Number(row.at), have, row.rec),
      mustChange(db),
      // THE DAY'S COUNT is the decision: a take past the limit moves nothing (a second tab racing the last take). AUDIT
      // GUILD2 G4: and the member's standing as it was read - a guildmaster's revoke, or a demotion, that lands between the
      // read and this batch refuses the take (the limit bound here is the standing read; a standing moved is not it)
      db.prepare(`UPDATE guild_members SET vault_taken = CASE WHEN vault_day = ?3 THEN vault_taken + 1 ELSE 1 END, vault_day = ?3
        WHERE rowid = ?1 AND guild_id = ?2 AND (?4 = 0 OR (CASE WHEN vault_day = ?3 THEN vault_taken ELSE 0 END) < ?4)
          AND rank = ?5 AND vault_level IS ?6 AND vault_limit = ?7`).bind(a.me.rid, gid, day, limit, Number(me?.rank ?? a.me.rank), me?.vault_level ?? null, Number(me?.vault_limit ?? 0)),
      mustChange(db),
      db.prepare("INSERT INTO guild_vault_log (guild_id, at, who, kind, name, count) VALUES (?, ?, ?, 'take', ?, ?)").bind(gid, nowS, who, pieceName(rec), n),
    ]);
  } catch {
    await dropIfUnnamed(db, bucket, player.id, side.at.id, prep.key);
    const moved = await recordMovedOf(db, player.id, side.at);
    if (moved) return moved;
    const again = await db.prepare('SELECT * FROM guild_members WHERE rowid = ? AND guild_id = ?').bind(a.me.rid, gid).first();
    if (!again || standingOf(again).level !== 'withdraw') return { error: 'guild-vault-rank' };   // AUDIT GUILD2 G4
    if (!vaultMayTake(standingOf(again), takenToday(again, nowS))) return { error: 'guild-vault-limit' };
    return { error: 'guild-vault-moved' };
  }
  await dropObjects(bucket, [prep.prev]);
  return { ok: true, slot, item: give, left, realm: { seq: prep.seq } };
}

/**
 * GRANT OR REVOKE: `{ character, member, level, limit }` - the guildmaster's alone (guildLaw.js GUILD_POWERS.vaultGrant):
 * a member's standing at the vault set to `level` ('none', 'deposit', 'withdraw' - a withdrawer's `limit` a day, 0 none;
 * AUDIT2 GUILD2 S6: none named, an officer's ten - guildVaultLaw.js vaultGrantOf), or `level: null` - revoked, back to its
 * rank's. Never the guildmaster's own row.
 * @param {any} ctx
 */
export async function vaultGrant(ctx, player, { character, member, level = null, limit = null } = {}) {
  const { db } = ctx;
  const a = await guildActorOf(db, player, character);
  if ('error' in a) return a;
  if (!guildMay(a.me.rank, 'vaultGrant')) return { error: 'guild-rank' };
  const grant = vaultGrantOf({ level, limit });
  if (!grant) return { error: 'bad-vault-grant' };
  const rid = typeof member === 'string' && GUILD_MEMBER_RE.test(member) ? Number(member.slice(1)) : null;
  if (rid == null) return { error: 'no-member' };
  const t = await db.prepare('SELECT rowid AS rid, rank FROM guild_members WHERE rowid = ? AND guild_id = ?').bind(rid, a.me.guild_id).first();
  if (!t || Number(t.rank) === GUILD_RANK_MASTER) return { error: 'no-member' };
  if (await spend(ctx, player)) return { error: 'guild-rate' };
  // AUDIT2 GUILD2 S5: while the granter still holds the rank it was read at - a guildmaster who handed the guild over
  // between the read and this write grants nothing
  const r = await db.prepare(`UPDATE guild_members SET vault_level = ?1, vault_limit = ?2 WHERE rowid = ?3 AND guild_id = ?4 AND rank <> ${GUILD_RANK_MASTER}
      AND EXISTS (SELECT 1 FROM guild_members WHERE rowid = ?5 AND guild_id = ?4 AND rank = ?6)`)
    .bind(grant.level, grant.limit, rid, a.me.guild_id, a.me.rid, Number(a.me.rank)).run();
  if (!r?.meta?.changes) {
    const still = await db.prepare('SELECT rank FROM guild_members WHERE rowid = ? AND guild_id = ?').bind(a.me.rid, a.me.guild_id).first();
    return { error: still && guildMay(Number(still.rank), 'vaultGrant') ? 'no-member' : 'guild-rank' };
  }
  return { ok: true, member, vault: vaultStanding(Number(t.rank), grant.level == null ? null : grant) };
}
