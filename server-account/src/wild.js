// INT9 (2026-10-09, the INTEGRITY arc's lane 2 - bible/06-Systems/Integrity-Arc.md; Mac: "I want to do everything and
// do it properly"): A DEATH IN THE OPEN ZONE, TAKEN OFF THE RECORD.
//
// WILD1 left a death's drop to the fallen's own game: it took its bag, its cart and half its purse out of its pack, saved
// without them and sent the records to the room - and its killer's worn piece the same way. A client that never fell
// dropped nothing, and one that fell dropped what it chose (a deposit was any records at all, for its friends to take).
// Now the relay referees the zone (src/net/wild/wildRef.js) and signs a fall (src/net/wild/wildReceipt.js `f1`) naming the fallen,
// its realm character, its killer and the worn piece the killer picked; and THIS SERVICE TAKES THE DROP OFF THE FALLEN'S
// JUDGED RECORD against it - the zone's own law (src/systems/wild/wildDropLaw.js takeWildDeath: the bag and the cart but what
// the fallen keep, half the purse, the killer's one worn piece, fitted to one remains), every piece the ledger bars from
// leaving kept - and signs what it took for the room: a `remains` order (src/net/identityToken.js), the records' digest
// and the killer's piece theirs alone. The room keeps a deposit only on that order.
//
// WHO CARRIES THE RECEIPT: the fallen's own tab first, as an act on its record (its `at` - prepareRealmRecord, the
// client's realmGoldAct taking the same out of its own pack); its killer once WILD_FALL_GRACE_S has gone by, as a
// SEIZURE (seizeRealmRecord: the record moved where it stands, its lease cleared - a fallen that never says it fell plays
// a record that moved under it). Once a fall (`wild_falls`, its remains' id): a second asking is answered the first's
// records with a fresh order. A death to a foe, no receipt: the fallen's own act alone, its remains' id the service's (a
// digest of the character and the tab's own nonce - asked again it is the same fall, and never a relay's id). A record the
// judge holds (lane 1's freeze) still loses its drop, and the room is given none of it.
//
// MAC'S DECISION (2026-10-14, "Yes, build it"): THE TWO-PHASE HANDOFF. The fallen loses the worn piece its killer picked
// only once the killer has it. The fall takes that piece off the fallen's record INTO ESCROW - `wild_escrow`, in the fall's
// own batch, its ledger key the service's (ledger.js ledgerMoves `escrow`) - where a room that signs collects lays it
// (the tab says so: `collect` 1, its relay's version - net/wire.js relaySupportsWildCollect). The killer's take of it in
// the room is the room's signed collect (net/wild/wildReceipt.js `g1`), carried by the killer's tab as an act on its record
// (wildCollect): the piece into that record and the escrow ended, one batch. Nobody collecting by the time the remains
// could have gone (`until_s`) and a collect signed at its last moment spent (WILD_COLLECT_TTL_S), the fallen's own tab
// takes it back into its record (wildReclaim), whenever it next plays. Every end moves the escrow's state from 'held' in
// the batch of the record it lands in, guarded to one row: the piece is in the fallen's record, the escrow, or one
// record - never two, never none - and an end asked twice moves nothing twice. A record the judge holds keeps the piece
// (it can never reach its killer, so it is never lost).
//
// CART-AWAY (FIELD BUGS 2026-10-15d; Mac, 2026-10-15: "if its parked outside the zone nothing should be lost"): THE CART
// DROPS ONLY WHILE THE WAGON IS WITH ITS FALLEN. Whether a parked wagon stands on the zone's ground is the zone's mask,
// which only a client holds (the map files); so the fallen's own tab says its wagon is away (`cart` 0 -
// src/systems/wild/wildCart.js wildCartAway), and the word is honoured only where the record this service keeps agrees by its
// mode (src/systems/wild/wildDropLaw.js wildCartMayBeAway: parked, stabled or none - never driven, following or beside them
// unstabled). A seizure honours none (its carrier holds neither the record nor the mask), and a tab that says nothing
// (one from before the word) drops the cart as ever. Asked again, a fall answers its first take, whatever is said.
//
// COMPANION-DROP (FIELD BUGS 2026-10-19f; the owner, 2026-10-19: "Bag drops; no send-off in zone"): A COMPANION AT THE
// FALLEN'S SIDE DROPS HIS PACK WITH THEIRS. No word is asked: the record says who is at the side - its sea's crew
// ashore and its feud's sworn walking with it, the zone's one (src/systems/wild/wildDropLaw.js wildPacksOf) - and the law
// takes their packs and kits as it takes the cart, its answer's `took` naming each piece's pack and `gold.packs` each
// pack's coin share, so the fallen's game takes the same out of its own (wildTakeTook). AUDIT FB1019f B2: A TAB FROM
// BEFORE IT IS NEVER HANDED SUCH A TAKE. Its game read every piece not the cart's as the bag's and no pack's coin - it
// stripped a piece of the bag bearing a companion's piece's marks, and left his piece and his coin in his pack while the
// record had dropped them. So the fallen's own tab says its game reads the packs (`packs` 1, wildDropLaw.js
// WILD_FALL_PACKS), and a take of the packs asked without it is REFUSED, nothing moved, in the word every shipped build
// says as "The game may need updating" (`not-found` - accounts.js legalRefusal's old game's word). Never a smaller take:
// the record decides what drops, and a word that shrank it would let any tab keep its companions' packs by leaving it
// out. A seizure takes them whatever is said: no game applies it (its fallen plays a record that moved under it, and
// its next join reads it) - so a fall at another's hand that the old tab is refused is still taken whole, by its killer
// once the grace is gone; a death to a foe, the fallen's own act, waits for a tab that says the word.
import { verifyWildReceipt, verifyWildCollect, WILD_FALL_GRACE_S, WILD_COLLECT_TTL_S } from '../../src/net/wild/wildReceipt.js';
import { mintRemainsOrder, remainsDigest, ORDER_TTL_S } from '../../src/net/identityToken.js';
import { streamsFoes, WILD_REMAINS_MS } from '../../src/net/wire.js';
import { GUILD_ID_RE } from '../../src/net/guild/guildLaw.js';
import { takeWildDeath, wildDropCandidates, wildTookOf, wildCartRecordOf, wildCartMayBeAway, WILD_FALL_PACKS, wildTakesPacks } from '../../src/systems/wild/wildDropLaw.js';
import { mintItemId } from '../../src/systems/item/itemIds.js';
import { giveTradeGoods } from '../../src/net/realm/realmTradeLaw.js';
import { prepareRealmRecord, seizeRealmRecord, realmAtOf, realmActFirst, recordMovedOf, mustChange, dropIfUnnamed, dropObjects, realmSaveTextOf, holdRefusal, REALM_ID_RE } from './realm.js';
import { ledgerKeyOf } from './judge.js';
import { piecesBarred, knownCopySteps } from './ledger.js';
import { isFrozen } from './staffFreeze.js';   // STAFF-PANEL5-FREEZE: a fall naming a frozen account
import { seaKillSteps } from './seaBounty.js';   // SEA-BOUNTY: a kill at sea, written with its fall

/** How long a fall's row is kept (its receipt's hour, and the room's remains' ten minutes past its respawn's two). */
export const WILD_FALLS_KEEP_S = 2 * 3600;
/** A death to a foe's nonce: the tab's own, sixteen hex. */
export const WILD_NONCE_RE = /^[0-9a-f]{16}$/;

/** The most a room key may be (the relay's own keys are far shorter). */
export const WILD_ROOM_MAX = 64;
/** MAC (2026-10-14): THE ESCROW'S LAST COLLECT - the latest a room may still hold the remains its order laid: the order's
 *  minute (a deposit never left inside it lays nothing) and the remains' life after it. A collect signed after it is late. */
export const WILD_ESCROW_HOLD_S = ORDER_TTL_S + Math.ceil(WILD_REMAINS_MS / 1000);
/** When the escrow may go back to its fallen: past its last collect, and a collect signed at that moment spent. */
export const escrowBackAt = (/** @type {number} */ until) => until + WILD_COLLECT_TTL_S;
const parse = (/** @type {any} */ t) => { try { return JSON.parse(t); } catch { return null; } };
/** An escrow row as its fallen's tab reads it. */
const escrowView = (/** @type {any} */ e) => (e ? { r: e.r, until: Number(e.until_s), back: escrowBackAt(Number(e.until_s)), state: e.state, rec: parse(e.rec) } : null);

/** A death to a foe's remains' id: twelve hex of SHA-256 over the character and the tab's nonce. */
async function foeFallId(/** @type {SubtleCrypto} */ subtle, /** @type {string} */ charId, /** @type {string} */ nonce) {
  const h = new Uint8Array(await subtle.digest('SHA-256', new TextEncoder().encode(`wild-foe:${charId}:${nonce}`)));
  return [...h.slice(0, 6)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** A fall's answer: the remains' id, the records taken (`wi` 0: the first is the killer's), the pieces the ledger kept back, what the record lost as the
 *  fallen's game finds it again (`took`, `gold` - wildDropLaw.js wildTakeTook), and - where the room is given any - the
 *  service's order over the records. THE FALL'S OWN ORDER: issued at `oi` for room `wm`, the same every asking, good its
 *  minute alone (AUDIT INT9: a fresh order each asking, naming no room, laid one fall's drop twice - in a second room, or
 *  in the first once it had let its emptied remains go). */
async function answerOf(/** @type {any} */ ctx, /** @type {CryptoKey} */ signing, /** @type {any} */ { r, fallen, killer, records, kept, burnt, killerFirst, wm, oi, wg, tk, seq = null, escrow = null }) {
  let order = null;
  if (!burnt && records.length && wm && ctx.nowS < oi + ORDER_TTL_S) {
    const wh = await remainsDigest(records, { subtle: ctx.subtle });
    order = await mintRemainsOrder({ s: fallen, wr: r, wh, wn: records.length, wm, ...(killerFirst && killer ? { wk: killer, wi: 0, ...(escrow ? { we: 1 } : {}) } : {}), ...(wg ? { wg } : {}) }, signing, { subtle: ctx.subtle, nowS: oi });
  }
  const packs = tk?.gold?.packs && typeof tk.gold.packs === 'object' ? { packs: tk.gold.packs } : {};   // COMPANION-DROP: each pack's coin share, by its word
  return { r, order, items: records, kept, wi: killerFirst ? 0 : -1, took: Array.isArray(tk?.took) ? tk.took : [], gold: { purse: tk?.gold?.purse ?? 0, cart: tk?.gold?.cart ?? 0, ...packs }, ...(burnt ? { burnt: true } : {}), ...(seq != null ? { realm: { seq } } : {}), ...(escrow ? { escrow: escrowView(escrow) } : {}) };
}

/**
 * /v1/wild/fall - A DEATH'S DROP, TAKEN. `body.receipt` a fall the relay signed (the caller its fallen or its killer), or
 * none (a death to a foe: the caller's own, `body.n` its tab's nonce); `body.realm` the caller's record where its tab says
 * it stands (the fallen's own act - required of the fallen, never of a killer); `body.room` the room the remains will be
 * laid in (the order names it, and no other room keeps it); `body.cart` 0 the fallen's word that its wagon is away
 * (CART-AWAY - honoured where its record agrees, never on a seizure); `body.packs` 1 the fallen's word that its game
 * reads its companions' packs (COMPANION-DROP, WILD_FALL_PACKS). Answers `{ r, order, items, kept, took, gold, burnt?, realm? }`
 * - the remains' id, the order the room keeps a deposit on (null: nothing for the room), the records taken, the ledger
 * keys the record kept, what the record lost as the fallen's game finds it again - or `{ error }`: 'no-signing-key',
 * 'no-gate-key', 'receipt' (with `why`), 'not-yours', 'no-realm-character', 'grace' (the fallen's own tab has the first
 * WILD_FALL_GRACE_S), 'nonce', 'room', 'not-found' (a take of the packs, asked by a fallen's tab without `packs` 1: a
 * game too old to apply it), the record's own words.
 * @param {any} ctx `{ db, bucket, rand, nowS, subtle }` @param {any} player the session's account
 * @param {any} body @param {{ gateKey: CryptoKey|null, signing: CryptoKey|null }} keys @param {boolean} [again] the
 *   second asking after a batch another asking beat
 * @returns {Promise<any>}
 */
export async function wildFall(ctx, player, body, { gateKey, signing }, again = false) {
  if (!signing) return { error: 'no-signing-key' };
  let fallen = player.id, killer = null, charId = null, r = null, w = -1, wt = null, seize = false, sea = null;
  if (body?.receipt !== undefined) {
    if (!gateKey) return { error: 'no-gate-key' };
    const v = await verifyWildReceipt(body.receipt, gateKey, { subtle: ctx.subtle, nowS: ctx.nowS });
    if (!v.ok) return { error: 'receipt', why: v.why };
    const c = v.claims;
    if (player.id !== c.f && player.id !== c.k) return { error: 'not-yours' };
    if (!c.c) return { error: 'no-realm-character' };
    ({ f: fallen, k: killer, c: charId, r, w } = c);
    wt = Array.isArray(c.wt) ? c.wt : null;
    sea = c;   // SEA-BOUNTY: the room it fell in and its killer's character - a kill at sea, written with the fall
    if (player.id === c.k) {
      if (ctx.nowS < c.i + WILD_FALL_GRACE_S) return { error: 'grace' };
      seize = true;
    }
  } else if (typeof body?.n !== 'string' || !WILD_NONCE_RE.test(body.n)) return { error: 'nonce' };
  // STAFF-PANEL5-FREEZE (staffFreeze.js; design doc Weak spots: "A frozen player can still be killed and robbed"): a fall
  // that names a frozen account takes nothing - its own (the freeze gate shuts its door already) or a killer's filing
  if (fallen !== player.id && isFrozen(await ctx.db.prepare('SELECT frozen_until FROM players WHERE id = ?1').bind(fallen).first(), ctx.nowS)) return { error: 'fallen-frozen' };
  const room = typeof body?.room === 'string' && body.room.length <= WILD_ROOM_MAX && streamsFoes(body.room) ? body.room : null;
  if (!room) return { error: 'room' };
  const at = seize ? null : realmAtOf(body?.realm);
  if (!seize && !at) return { error: 'no-realm-character' };
  if (!seize && charId && at.id !== charId) return { error: 'not-yours' };
  charId ??= at.id;
  r ??= await foeFallId(ctx.subtle, charId, body.n);
  // once a fall: a second asking is the first's records and its own order
  const had = await ctx.db.prepare('SELECT player, killer, items, kept, burnt, wi, wm, oi, wg, tk FROM wild_falls WHERE r = ?1').bind(r).first();
  if (had) {
    if (had.player !== fallen) return { error: 'not-yours' };
    const escrow = await ctx.db.prepare('SELECT * FROM wild_escrow WHERE r = ?1').bind(r).first();   // MAC (2026-10-14): its escrow, as the first asking made it
    const read = (/** @type {any} */ t, /** @type {any} */ none) => { try { return JSON.parse(t) ?? none; } catch { return none; } };
    const list = (/** @type {any} */ t) => { const v = read(t, []); return Array.isArray(v) ? v : []; };
    // AUDIT INT9: the fallen's own tab asking again (its first answer lost) is told where its record stands - the act's
    // sequence - while the record is still its tab's
    let seq = null;
    if (at) {
      const now = await ctx.db.prepare('SELECT seq, lease FROM realm_characters WHERE id = ?1 AND player = ?2 AND dead_at IS NULL').bind(charId, fallen).first();
      if (now && now.lease === at.lease) seq = now.seq;
    }
    return answerOf(ctx, signing, { r, fallen, killer: had.killer, records: list(had.items), kept: list(had.kept), burnt: had.burnt === 1, killerFirst: had.wi === 0, wm: had.wm, oi: had.oi, wg: had.wg, tk: read(had.tk, {}), seq, escrow });
  }
  // the ledger's word on what may leave, before the drop is taken - asked of EVERY piece the death could take (a copy,
  // another's piece, a claim waiting - kept)
  const row = await ctx.db.prepare('SELECT obj, held, judged_seq FROM realm_characters WHERE id = ?1 AND player = ?2 AND dead_at IS NULL').bind(charId, fallen).first();
  if (!row?.obj || !ctx.bucket) return { error: 'no-realm-character' };
  let stored = null;
  try { stored = JSON.parse(/** @type {string} */ (await realmSaveTextOf(await ctx.bucket.get(row.obj)))); } catch { stored = null; }
  if (!stored || typeof stored !== 'object') return { error: 'no-data' };
  // LANE 1's FREEZE (Integrity-Arc 3.1): a record the judge holds hands no value to another player - its death still costs
  // it the drop, and the room is given none of it (no order, nothing deposited). MAC (2026-10-14): and it keeps the worn
  // piece its killer picked - that one goes only to its killer, who can never have it from a held record
  const burnt = !!holdRefusal(row);
  if (burnt) { w = -1; wt = null; }
  // CART-AWAY: the fallen's own word that its wagon is away, where its record agrees - the cart's pieces and coin stay
  const away = !seize && body?.cart === 0 && wildCartMayBeAway(wildCartRecordOf(stored));
  const cart = { cart: !away };
  // COMPANION-DROP (AUDIT FB1019f B2): the fallen's own tab says its game reads the packs, or is handed no take of them
  const packsRead = seize || body?.packs === WILD_FALL_PACKS;
  const barred = await piecesBarred(ctx.db, charId, wildDropCandidates(stored, w, wt, cart).map(ledgerKeyOf).filter((k) => k != null));
  const keep = (/** @type {any} */ it) => { const k = ledgerKeyOf(it); return k != null && barred.has(k); };
  /** @type {any} */ let drop = null;
  // MAC (2026-10-14): the killer's piece, where the tab's room collects, into escrow - its ledger key the service's
  const collect = body?.collect === 1;
  /** @type {Set<string>} */ const escrowKeys = new Set();
  const change = (/** @type {any} */ save) => {
    drop = takeWildDeath(save, w, keep, wt, cart);
    if (!packsRead && wildTakesPacks(drop)) return 'not-found';   // a game from before the word: the take refused, nothing moved
    if (collect && drop.killer) { const k = ledgerKeyOf(drop.taken[0]); if (k != null) escrowKeys.add(k); }
    return null;
  };
  // the drop is let go (ledger.js letGoSteps), never the service's: whoever takes it from the remains takes it up
  const moved = seize ? await seizeRealmRecord(ctx, fallen, charId, change, { escrow: escrowKeys }) : await prepareRealmRecord(ctx, fallen, /** @type {any} */ (at), change, { escrow: escrowKeys });
  if (moved.error) return moved;
  const escrowed = collect && drop.killer;
  // AUDIT INT9: A DROPPED PIECE IS A NEW PIECE IN THE REMAINS. Each valuable one's id is minted afresh for the room, and
  // the id it had is written down as the fallen's own copy (ledger.js knownCopySteps): a fallen whose game kept the piece
  // holds a copy that moves by no route, where before it held the piece again and the one who took it up was charged
  // for a copy. A crafted piece keeps its craft's key (the craft's record is the account `products`'s), written down the
  // same - its fallen taking it back from its own remains holds it as a copy too, worn but never traded.
  const dropped = [];
  const records = drop.records.map((/** @type {any} */ rec, /** @type {number} */ i) => {
    if (escrowed && i === 0) return rec;   // MAC (2026-10-14): the escrowed piece is no new piece - the same one, the service's until it ends
    const key = ledgerKeyOf(drop.taken[i]);
    if (key == null) return rec;
    dropped.push(key);
    return key === drop.taken[i].provenance ? rec : { ...rec, uid: mintItemId(ctx.rand) };
  });
  const kept = [...barred], killerFirst = !burnt && drop.killer;
  const gm = await ctx.db.prepare('SELECT guild_id FROM guild_members WHERE player = ?1 AND char_id = ?2').bind(fallen, charId).first();
  const wg = typeof gm?.guild_id === 'string' && GUILD_ID_RE.test(gm.guild_id) ? gm.guild_id : null;
  const tk = { took: wildTookOf(drop.taken, drop.from), gold: drop.gold };
  const escrow = escrowed ? { r, player: fallen, char_id: charId, killer, rec: JSON.stringify(drop.records[0]), at: ctx.nowS, until_s: ctx.nowS + WILD_ESCROW_HOLD_S, state: 'held' } : null;
  const steps = [
    ...moved.steps,
    ...knownCopySteps(ctx.db, charId, dropped, ctx.nowS),
    ctx.db.prepare('INSERT INTO wild_falls (r, char_id, player, killer, at, items, kept, burnt, wi, wm, oi, wg, tk) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?5, ?11, ?12)')
      .bind(r, charId, fallen, killer, ctx.nowS, JSON.stringify(records), JSON.stringify(kept), burnt ? 1 : 0, killerFirst ? 0 : -1, room, wg, JSON.stringify(tk)),
    // MAC (2026-10-14): the killer's piece, held - in the batch that took it off the record, or neither lands
    ...(escrow ? [ctx.db.prepare("INSERT INTO wild_escrow (r, player, char_id, killer, rec, at, until_s, state) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'held')")
      .bind(escrow.r, escrow.player, escrow.char_id, escrow.killer, escrow.rec, escrow.at, escrow.until_s)] : []),
    // SEA-BOUNTY (seaBounty.js): a fall at sea at another's hand - the bounties on the fallen claimed for its killer, in the
    // batch that writes the fall, or neither lands
    ...seaKillSteps(ctx.db, sea, ctx.nowS),
  ];
  try { await ctx.db.batch(steps); } catch (e) {
    await dropIfUnnamed(ctx.db, ctx.bucket, fallen, charId, moved.key);
    const now = await ctx.db.prepare('SELECT 1 AS x FROM wild_falls WHERE r = ?1').bind(r).first();
    if (now && !again) return wildFall(ctx, player, body, { gateKey, signing }, true);   // another asking landed it first: its answer (asked once more, never a loop)
    throw e;
  }
  await dropObjects(ctx.bucket, [moved.prev]);   // AUDIT INT9: the save two back, as every act drops it
  return answerOf(ctx, signing, { r, fallen, killer, records, kept, burnt, killerFirst, wm: room, oi: ctx.nowS, wg, tk, seq: seize ? null : moved.seq, escrow });
}

/**
 * ONE END OF AN ESCROW, on a record: the piece into it (`at`, where its tab says it stands - `playerId`'s), the escrow's
 * state moved from 'held' to `state` in the same batch, guarded to exactly one row. Answers `{ r, item, realm }`, or `{ error }`:
 * the record's own word ('lease', 'seq' - realm.js realmActFirst asked first), or 'escrow-moved' (another end landed).
 * @param {any} ctx @param {string} playerId @param {{ id: string, lease: string, seq: number }} at @param {any} row
 * @param {'collected' | 'returned'} state
 */
async function endEscrow(ctx, playerId, at, row, state) {
  const item = parse(row.rec);
  if (!item || typeof item !== 'object') return { error: 'no-escrow' };
  const prep = await prepareRealmRecord(ctx, playerId, at, (save) => { giveTradeGoods(save, [item], 0); return null; });
  if (prep.error) return prep;
  try {
    await ctx.db.batch([
      ...prep.steps,
      ctx.db.prepare("UPDATE wild_escrow SET state = ?2, to_char = ?3, ended_at = ?4 WHERE r = ?1 AND state = 'held'").bind(row.r, state, at.id, ctx.nowS),
      mustChange(ctx.db),
    ]);
  } catch (e) {
    if (await dropIfUnnamed(ctx.db, ctx.bucket, playerId, at.id, prep.key)) return { r: row.r, item, realm: { seq: prep.seq } };   // landed, its answer lost
    const moved = await recordMovedOf(ctx.db, playerId, at);
    if (moved) return moved;
    const now = await ctx.db.prepare('SELECT state FROM wild_escrow WHERE r = ?1').bind(row.r).first();
    if (now && now.state !== 'held') return { error: 'escrow-moved' };
    throw e;
  }
  await dropObjects(ctx.bucket, [prep.prev]);
  return { r: row.r, item, realm: { seq: prep.seq } };
}

/**
 * /v1/wild/collect - A KILLER'S COLLECT: `body.receipt` the room's signed collect (net/wild/wildReceipt.js `g1` - the caller its
 * killer), `body.realm` where the killer's record stands (the collect's own character). The piece the fall put in escrow
 * goes into that record, once. Answers `{ r, item, realm }`; `{ r, item, again: true }` for a collect already landed in
 * this character (nothing moves twice); or `{ error }` - 'no-gate-key', 'receipt' (with `why`), 'not-yours',
 * 'no-realm-character', 'no-escrow', 'escrow-late' (signed past the escrow's last collect), 'escrow-returned',
 * 'escrow-collected' (into another character), 'escrow-moved', the record's own words.
 * @param {any} ctx @param {any} player @param {any} body @param {{ gateKey: CryptoKey | null }} keys
 */
export async function wildCollect(ctx, player, body, { gateKey }) {
  if (!gateKey) return { error: 'no-gate-key' };
  const v = await verifyWildCollect(body?.receipt, gateKey, { subtle: ctx.subtle, nowS: ctx.nowS });
  if (!v.ok) return { error: 'receipt', why: v.why };
  const c = v.claims;
  if (c.k !== player.id) return { error: 'not-yours' };
  const side = await realmActFirst(ctx.db, player.id, c.c, body?.realm);   // where the record stands, before any other word
  if (side.error) return side;
  if (!side.at) return { error: 'no-realm-character' };
  const row = await ctx.db.prepare('SELECT * FROM wild_escrow WHERE r = ?1').bind(c.r).first();
  if (!row || row.killer !== player.id) return { error: 'no-escrow' };
  if (row.state === 'collected') return row.to_char === side.at.id ? { r: row.r, item: parse(row.rec), again: true } : { error: 'escrow-collected' };
  if (row.state === 'returned') return { error: 'escrow-returned' };
  if (c.i > Number(row.until_s)) return { error: 'escrow-late' };
  return endEscrow(ctx, player.id, side.at, row, 'collected');
}

/**
 * /v1/wild/reclaim - THE FALLEN TAKES ITS PIECE BACK: `body.r` the fall, `body.realm` where the fallen's record stands. Once
 * its killer could no longer collect it (escrowBackAt), the piece the fall put in escrow goes back into that record, once.
 * Answers `{ r, item, realm }`; `{ r, item, again: true }` (back already - nothing moves twice); or `{ error }` -
 * 'no-escrow', 'escrow-wait' (with `wait`, seconds to wait), 'escrow-collected' (its killer has it),
 * 'escrow-moved', the record's own words.
 * @param {any} ctx @param {any} player @param {any} body
 */
export async function wildReclaim(ctx, player, body) {
  const r = typeof body?.r === 'string' && /^[0-9a-f]{12}$/.test(body.r) ? body.r : null;
  if (!r) return { error: 'body' };
  const at = realmAtOf(body?.realm);
  if (!at) return { error: 'no-realm-character' };
  const side = await realmActFirst(ctx.db, player.id, at.id, body.realm);
  if (side.error) return side;
  if (!side.at) return { error: 'no-realm-character' };
  const row = await ctx.db.prepare('SELECT * FROM wild_escrow WHERE r = ?1').bind(r).first();
  if (!row || row.player !== player.id || row.char_id !== side.at.id) return { error: 'no-escrow' };
  if (row.state === 'returned') return { r, item: parse(row.rec), again: true };
  if (row.state === 'collected') return { error: 'escrow-collected' };
  const back = escrowBackAt(Number(row.until_s));
  if (ctx.nowS < back) return { error: 'escrow-wait', wait: back - ctx.nowS };
  return endEscrow(ctx, player.id, side.at, row, 'returned');
}

/** /v1/wild/escrows - A FALLEN'S PIECES IN ESCROW: `body.character` a realm character of the caller's. Answers `{ escrows }`,
 *  each `{ r, until, back, state, rec }` - the held ones, for its tab to watch and take back (a game closed while one was
 *  held asks here at its next play). */
export async function wildEscrows(ctx, player, body) {
  const id = typeof body?.character === 'string' && REALM_ID_RE.test(body.character) ? body.character : null;
  if (!id) return { error: 'body' };
  const { results = [] } = await ctx.db.prepare("SELECT * FROM wild_escrow WHERE char_id = ?1 AND player = ?2 AND state = 'held' ORDER BY at LIMIT 16").bind(id, player.id).all();
  return { escrows: results.map(escrowView) };
}
