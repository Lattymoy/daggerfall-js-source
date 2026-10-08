// @ts-check
// CARDS6 (2026-10-08, Mac: "#2"; bible/11-Multiplayer/Tavern-Cards.md section 23): A CARD TABLE'S STAKES, ESCROWED HERE.
// Section 5, DECIDED: "online stakes are escrowed there. Sitting down moves the buy-in from the character to the table;
// standing up moves the stack back. A stake the service does not hold is a stake nobody can enforce, so a character
// the service does not keep plays for no gold (a friendly table)."
//
// FACT: the relay has no door to this service (net/siegeReceipt.js's word) - so the gold goes round by the player:
//
//   STAKE (/v1/cards/stake): the buy-in leaves the realm character's record (payFromSave, the wallet's own order) and a
//     `card_stakes` row is written HELD, in one batch; the answer carries this service's order on it
//     (net/identityToken.js mintStakeOrder) - the relay seats it with that many chips and spends its id, once.
//   CASH-OUT (/v1/cards/cashout): the relay's receipt (net/cardReceipt.js) for that stake - what the seat left with,
//     the whole stake for a sit refused or a stake voided - pays the record (creditSave) and turns the row PAID, in one
//     batch: a stake is paid once.
//
// WHAT HOLDS IT TOGETHER: every chip at a table came in as a stake (the relay seats a gold table's seat with nothing
// else), the law conserves every chip, and each stake comes back exactly once - in the receipt of the seat it bought,
// or of the sit it was refused, or of its void. A stake whose receipt is never brought stays held: gold that left the
// record for a table, the table's (a loser's stake is in the winners' receipts already).
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).
import { realmActFirst, prepareRealmRecord, mustChange, dropIfUnnamed, recordMovedOf, dropObjects } from './realm.js';
import { payFromSave, creditSave } from '../../src/net/realmGoldLaw.js';
import { regionOk } from '../../src/net/nodeLaw.js';
import { mintStakeOrder, STAKE_ROOM_RE } from '../../src/net/identityToken.js';
import { verifyCardReceipt } from '../../src/net/cardReceipt.js';
import { HOLDEM_BBS, HOLDEM_STAKE_MIN_BB, HOLDEM_STAKE_MAX_BB, HOLDEM_TABLES_MAX, HOLDEM_TOPUP_MIN_BB } from '../../src/net/holdemTable.js';
import { HOLDEM_SEATS_MAX } from '../../src/net/cardLaw.js';

/** A stake request's id - one asked twice is one stake. */
export const CARDS_RID_RE = /^[A-Za-z0-9_-]{8,40}$/;
/** A stake's id: twenty hex digits from the service's own randomness (net/identityToken.js STAKE_ID_RE). */
const stakeIdOf = (rand) => { const b = new Uint8Array(10); rand(b); return [...b].map((x) => x.toString(16).padStart(2, '0')).join(''); };

/** The order on a held stake, minted for its row. */
const orderOf = (row, player, signingKey, subtle, nowS) => mintStakeOrder({ s: player.id, cj: row.id, cr: row.room, ct: Number(row.tbl), ca: Number(row.amount), cb: Number(row.bb) }, signingKey, { subtle, nowS });

/**
 * STAKE: `{ character, realm, region, room, table, bb, amount, rid }` - `amount` gold of the realm character's held
 * for table `table` of room `room` at big blind `bb` (a gold table's buy-in: HOLDEM_STAKE_MIN_BB to HOLDEM_STAKE_MAX_BB
 * big blinds; `topup`, a seated player's addition, from HOLDEM_TOPUP_MIN_BB - Tavern-Cards section 24). Answers `{ ok, id, stake, amount, realm: { seq } }` - `stake` the order the relay seats; a request asked
 * again answers its stake again (`repeat`), no gold moving twice.
 * @param {any} ctx @param {any} player @param {any} env @param {any} body @param {CryptoKey|null} signingKey
 */
export async function stakeCards(ctx, player, env, { character, realm = null, region, room, table, bb, amount, rid, topup = false } = {}, signingKey = null) {
  const { db, nowS, rand, subtle } = ctx;
  const side = await realmActFirst(db, player.id, character, realm);   // AUDIT REALM L1-F2: where the record stands, first
  if (side.error) return side;
  if (!side.at) return { error: 'cards-realm' };   // section 5: a character the service does not keep plays for chips
  if (!signingKey) return { error: 'cards-closed' };
  if (typeof rid !== 'string' || !CARDS_RID_RE.test(rid)) return { error: 'bad-rid' };
  const prior = await db.prepare('SELECT * FROM card_stakes WHERE player = ?1 AND rid = ?2').bind(player.id, rid).first();
  // AUDIT CARDS-4 A1: asked again, the SAME order - minted at the stake's own instant, so a repeat is never a fresh minute
  // to sit on, nor a void the relay's memory of its spend (HOLDEM_STAKE_KEEP_S) has outlived
  if (prior) return prior.status === 'held' ? { ok: true, repeat: true, id: prior.id, amount: Number(prior.amount), stake: await orderOf(prior, player, signingKey, subtle, Number(prior.at)) } : { error: 'cards-stake-paid' };
  if (!regionOk(region)) return { error: 'bad-region' };
  if (typeof room !== 'string' || !STAKE_ROOM_RE.test(room)) return { error: 'bad-room' };
  if (!Number.isInteger(table) || table < 0 || table >= HOLDEM_TABLES_MAX) return { error: 'bad-table' };
  if (!HOLDEM_BBS.includes(bb)) return { error: 'bad-stakes' };
  // section 24: a top-up's stake is a seat's addition - from HOLDEM_TOPUP_MIN_BB (the relay keeps the seat within the most)
  if (!Number.isSafeInteger(amount) || amount < (topup === true ? HOLDEM_TOPUP_MIN_BB : HOLDEM_STAKE_MIN_BB) * bb || amount > HOLDEM_STAKE_MAX_BB * bb) return { error: 'bad-buy-in' };
  const id = stakeIdOf(rand);
  const prep = await prepareRealmRecord(ctx, player.id, side.at, (save) => (payFromSave(save, amount, region) ? null : 'realm-gold'));
  if (prep.error) return prep;
  try {
    await db.batch([
      ...prep.steps,
      db.prepare(`INSERT INTO card_stakes (id, player, char_id, rid, room, tbl, bb, amount, status, at, region) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'held', ?9, ?10)`)
        .bind(id, player.id, character, rid, room, table, bb, amount, nowS, region),
    ]);
  } catch {
    await dropIfUnnamed(db, ctx.bucket, player.id, side.at.id, prep.key);   // AUDIT REALM2 S3: a batch that landed and lost its answer keeps its save
    const moved = await recordMovedOf(db, player.id, side.at);
    if (moved) return moved;
    return { error: 'cards-stake-failed' };
  }
  await dropObjects(ctx.bucket, [prep.prev]);
  const row = { id, room, tbl: table, amount, bb };
  return { ok: true, id, amount, stake: await orderOf(row, player, signingKey, subtle, nowS), realm: { seq: prep.seq } };
}

/**
 * CASH-OUT: `{ character, realm, region, receipt }` - the relay's receipt for a stake of this account's: what the seat
 * left with paid into the character that staked it (the bank of the region it was staked from, as a market's gold is collected), the stake turned
 * paid in the same batch. Answers `{ ok, gold, realm }`; a stake already paid answers `{ ok, repeat, gold }` and pays
 * nothing.
 * @param {any} ctx @param {any} player @param {any} env @param {any} body @param {CryptoKey|null} publicKey the relay's
 */
export async function cashoutCards(ctx, player, env, { character, realm = null, receipt } = {}, publicKey = null) {
  const { db, nowS, subtle } = ctx;
  if (!publicKey) return { error: 'no-gate-key' };
  // AUDIT CARDS-4 A3: a receipt pays its stake once whenever it is brought - its row is what spends it, so its age is no
  // reason to keep the gold (a receipt claimed a month on was refused 'expired' and the stake held for good)
  const v = await verifyCardReceipt(receipt, publicKey, { subtle, nowS, anyAge: true });
  if (!v.ok) return { error: 'cards-receipt', why: v.why };
  const c = v.claims;
  if (c.s !== player.id) return { error: 'cards-not-yours' };
  const row = await db.prepare('SELECT * FROM card_stakes WHERE id = ?1 AND player = ?2').bind(c.j, player.id).first();
  if (!row) return { error: 'cards-no-stake' };
  if (row.char_id !== character) return { error: 'cards-other-character' };   // the gold goes home to the character that staked it
  // AUDIT CARDS-4 E6: where the record stands FIRST (AUDIT REALM L1-F2), then a repeat - a paid stake answered before it
  // read a landed claim whose answer was lost as ok with no move, the device's sequence one behind the record's
  const side = await realmActFirst(db, player.id, character, realm);
  if (side.error) return side;
  if (!side.at) return { error: 'cards-realm' };
  if (row.status === 'paid') return { ok: true, repeat: true, gold: Number(row.paid ?? 0) };
  // a stake handed back whole is the stake; a seat leaves with no more than every seat's deepest stake at its table
  if ((c.w === 'refused' || c.w === 'void') && c.r !== Number(row.amount)) return { error: 'cards-receipt', why: 'sum' };
  if (c.r > HOLDEM_STAKE_MAX_BB * Number(row.bb) * HOLDEM_SEATS_MAX) return { error: 'cards-receipt', why: 'sum' };
  // AUDIT CARDS-4 A7: home to the region it was staked from - never the one the client names
  const home = Number(row.region);
  if (!regionOk(home)) return { error: 'bad-region' };
  const settle = db.prepare(`UPDATE card_stakes SET status = 'paid', paid = ?3, paid_at = ?4 WHERE id = ?1 AND player = ?2 AND status = 'held'`).bind(c.j, player.id, c.r, nowS);
  if (c.r === 0) {   // out of chips: nothing for the record, the stake settled
    // AUDIT CARDS-4 A6: a settle that failed is said - answered paid, the row stayed held
    const done = await db.batch([settle, mustChange(db)]).then(() => true, () => false);
    if (done) return { ok: true, gold: 0 };
    const now = await db.prepare('SELECT status FROM card_stakes WHERE id = ?1').bind(c.j).first();
    return now?.status === 'paid' ? { ok: true, repeat: true, gold: 0 } : { error: 'cards-cashout-failed' };
  }
  const prep = await prepareRealmRecord(ctx, player.id, side.at, (save) => (creditSave(save, c.r, { bank: home }) ? null : 'bad-gold'));
  if (prep.error) return prep;
  try {
    await db.batch([...prep.steps, settle, mustChange(db)]);
  } catch {
    await dropIfUnnamed(db, ctx.bucket, player.id, side.at.id, prep.key);
    const moved = await recordMovedOf(db, player.id, side.at);
    if (moved) return moved;
    const now = await db.prepare('SELECT status, paid FROM card_stakes WHERE id = ?1').bind(c.j).first();
    return now?.status === 'paid' ? { ok: true, repeat: true, gold: Number(now.paid ?? 0) } : { error: 'cards-cashout-failed' };
  }
  await dropObjects(ctx.bucket, [prep.prev]);
  return { ok: true, gold: c.r, realm: { seq: prep.seq } };
}
