// INT9 (2026-10-09, the INTEGRITY arc's lane 2 - bible/06-Systems/Integrity-Arc.md; Mac: "I want to do everything and
// do it properly"): A DEATH IN THE OPEN ZONE, TAKEN OFF THE RECORD.
//
// WILD1 left a death's drop to the fallen's own game: it took its bag, its cart and half its purse out of its pack, saved
// without them and sent the records to the room - and its killer's worn piece the same way. A client that never fell
// dropped nothing, and one that fell dropped what it chose (a deposit was any records at all, for its friends to take).
// Now the relay referees the zone (src/net/wildRef.js) and signs a fall (src/net/wildReceipt.js `f1`) naming the fallen,
// its realm character, its killer and the worn piece the killer picked; and THIS SERVICE TAKES THE DROP OFF THE FALLEN'S
// JUDGED RECORD against it - the zone's own law (src/systems/wildDropLaw.js takeWildDeath: the bag and the cart but what
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
import { verifyWildReceipt, WILD_FALL_GRACE_S } from '../../src/net/wildReceipt.js';
import { mintRemainsOrder, remainsDigest, ORDER_TTL_S } from '../../src/net/identityToken.js';
import { streamsFoes } from '../../src/net/wire.js';
import { GUILD_ID_RE } from '../../src/net/guildLaw.js';
import { takeWildDeath, wildDropCandidates, wildTookOf } from '../../src/systems/wildDropLaw.js';
import { mintItemId } from '../../src/systems/itemIds.js';
import { prepareRealmRecord, seizeRealmRecord, realmAtOf, dropIfUnnamed, dropObjects, realmSaveTextOf, holdRefusal } from './realm.js';
import { ledgerKeyOf } from './judge.js';
import { piecesBarred, knownCopySteps } from './ledger.js';

/** How long a fall's row is kept (its receipt's hour, and the room's remains' ten minutes past its respawn's two). */
export const WILD_FALLS_KEEP_S = 2 * 3600;
/** A death to a foe's nonce: the tab's own, sixteen hex. */
export const WILD_NONCE_RE = /^[0-9a-f]{16}$/;

/** The most a room key may be (the relay's own keys are far shorter). */
export const WILD_ROOM_MAX = 64;

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
async function answerOf(/** @type {any} */ ctx, /** @type {CryptoKey} */ signing, /** @type {any} */ { r, fallen, killer, records, kept, burnt, killerFirst, wm, oi, wg, tk, seq = null }) {
  let order = null;
  if (!burnt && records.length && wm && ctx.nowS < oi + ORDER_TTL_S) {
    const wh = await remainsDigest(records, { subtle: ctx.subtle });
    order = await mintRemainsOrder({ s: fallen, wr: r, wh, wn: records.length, wm, ...(killerFirst && killer ? { wk: killer, wi: 0 } : {}), ...(wg ? { wg } : {}) }, signing, { subtle: ctx.subtle, nowS: oi });
  }
  return { r, order, items: records, kept, wi: killerFirst ? 0 : -1, took: Array.isArray(tk?.took) ? tk.took : [], gold: { purse: tk?.gold?.purse ?? 0, cart: tk?.gold?.cart ?? 0 }, ...(burnt ? { burnt: true } : {}), ...(seq != null ? { realm: { seq } } : {}) };
}

/**
 * /v1/wild/fall - A DEATH'S DROP, TAKEN. `body.receipt` a fall the relay signed (the caller its fallen or its killer), or
 * none (a death to a foe: the caller's own, `body.n` its tab's nonce); `body.realm` the caller's record where its tab says
 * it stands (the fallen's own act - required of the fallen, never of a killer); `body.room` the room the remains will be
 * laid in (the order names it, and no other room keeps it). Answers `{ r, order, items, kept, took, gold, burnt?, realm? }`
 * - the remains' id, the order the room keeps a deposit on (null: nothing for the room), the records taken, the ledger
 * keys the record kept, what the record lost as the fallen's game finds it again - or `{ error }`: 'no-signing-key',
 * 'no-gate-key', 'receipt' (with `why`), 'not-yours', 'no-realm-character', 'grace' (the fallen's own tab has the first
 * WILD_FALL_GRACE_S), 'nonce', 'room', the record's own words.
 * @param {any} ctx `{ db, bucket, rand, nowS, subtle }` @param {any} player the session's account
 * @param {any} body @param {{ gateKey: CryptoKey|null, signing: CryptoKey|null }} keys @param {boolean} [again] the
 *   second asking after a batch another asking beat
 * @returns {Promise<any>}
 */
export async function wildFall(ctx, player, body, { gateKey, signing }, again = false) {
  if (!signing) return { error: 'no-signing-key' };
  let fallen = player.id, killer = null, charId = null, r = null, w = -1, wt = null, seize = false;
  if (body?.receipt !== undefined) {
    if (!gateKey) return { error: 'no-gate-key' };
    const v = await verifyWildReceipt(body.receipt, gateKey, { subtle: ctx.subtle, nowS: ctx.nowS });
    if (!v.ok) return { error: 'receipt', why: v.why };
    const c = v.claims;
    if (player.id !== c.f && player.id !== c.k) return { error: 'not-yours' };
    if (!c.c) return { error: 'no-realm-character' };
    ({ f: fallen, k: killer, c: charId, r, w } = c);
    wt = Array.isArray(c.wt) ? c.wt : null;
    if (player.id === c.k) {
      if (ctx.nowS < c.i + WILD_FALL_GRACE_S) return { error: 'grace' };
      seize = true;
    }
  } else if (typeof body?.n !== 'string' || !WILD_NONCE_RE.test(body.n)) return { error: 'nonce' };
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
    const read = (/** @type {any} */ t, /** @type {any} */ none) => { try { return JSON.parse(t) ?? none; } catch { return none; } };
    const list = (/** @type {any} */ t) => { const v = read(t, []); return Array.isArray(v) ? v : []; };
    // AUDIT INT9: the fallen's own tab asking again (its first answer lost) is told where its record stands - the act's
    // sequence - while the record is still its tab's
    let seq = null;
    if (at) {
      const now = await ctx.db.prepare('SELECT seq, lease FROM realm_characters WHERE id = ?1 AND player = ?2 AND dead_at IS NULL').bind(charId, fallen).first();
      if (now && now.lease === at.lease) seq = now.seq;
    }
    return answerOf(ctx, signing, { r, fallen, killer: had.killer, records: list(had.items), kept: list(had.kept), burnt: had.burnt === 1, killerFirst: had.wi === 0, wm: had.wm, oi: had.oi, wg: had.wg, tk: read(had.tk, {}), seq });
  }
  // the ledger's word on what may leave, before the drop is taken - asked of EVERY piece the death could take (a copy,
  // another's piece, a claim waiting - kept)
  const row = await ctx.db.prepare('SELECT obj, held, judged_seq FROM realm_characters WHERE id = ?1 AND player = ?2 AND dead_at IS NULL').bind(charId, fallen).first();
  if (!row?.obj || !ctx.bucket) return { error: 'no-realm-character' };
  let stored = null;
  try { stored = JSON.parse(/** @type {string} */ (await realmSaveTextOf(await ctx.bucket.get(row.obj)))); } catch { stored = null; }
  if (!stored || typeof stored !== 'object') return { error: 'no-data' };
  const barred = await piecesBarred(ctx.db, charId, wildDropCandidates(stored, w, wt).map(ledgerKeyOf).filter((k) => k != null));
  const keep = (/** @type {any} */ it) => { const k = ledgerKeyOf(it); return k != null && barred.has(k); };
  /** @type {any} */ let drop = null;
  const change = (/** @type {any} */ save) => { drop = takeWildDeath(save, w, keep, wt); return null; };
  // the drop is let go (ledger.js letGoSteps), never the service's: whoever takes it from the remains takes it up
  const moved = seize ? await seizeRealmRecord(ctx, fallen, charId, change, { escrow: false }) : await prepareRealmRecord(ctx, fallen, /** @type {any} */ (at), change);
  if (moved.error) return moved;
  // LANE 1's FREEZE (Integrity-Arc 3.1): a record the judge holds hands no value to another player - its death still costs
  // it the drop, and the room is given none of it (no order, nothing deposited)
  const burnt = !!holdRefusal(row);
  // AUDIT INT9: A DROPPED PIECE IS A NEW PIECE IN THE REMAINS. Each valuable one's id is minted afresh for the room, and
  // the id it had is written down as the fallen's own copy (ledger.js knownCopySteps): a fallen whose game kept the piece
  // holds a copy that moves by no route, where before it held the piece again and the one who took it up was charged
  // for a copy. A crafted piece keeps its craft's key (the craft's record is the account `products`'s), written down the
  // same - its fallen taking it back from its own remains holds it as a copy too, worn but never traded.
  const dropped = [];
  const records = drop.records.map((/** @type {any} */ rec, /** @type {number} */ i) => {
    const key = ledgerKeyOf(drop.taken[i]);
    if (key == null) return rec;
    dropped.push(key);
    return key === drop.taken[i].provenance ? rec : { ...rec, uid: mintItemId(ctx.rand) };
  });
  const kept = [...barred], killerFirst = !burnt && drop.killer;
  const gm = await ctx.db.prepare('SELECT guild_id FROM guild_members WHERE player = ?1 AND char_id = ?2').bind(fallen, charId).first();
  const wg = typeof gm?.guild_id === 'string' && GUILD_ID_RE.test(gm.guild_id) ? gm.guild_id : null;
  const tk = { took: wildTookOf(drop.taken, drop.from), gold: drop.gold };
  const steps = [
    ...moved.steps,
    ...knownCopySteps(ctx.db, charId, dropped, ctx.nowS),
    ctx.db.prepare('INSERT INTO wild_falls (r, char_id, player, killer, at, items, kept, burnt, wi, wm, oi, wg, tk) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?5, ?11, ?12)')
      .bind(r, charId, fallen, killer, ctx.nowS, JSON.stringify(records), JSON.stringify(kept), burnt ? 1 : 0, killerFirst ? 0 : -1, room, wg, JSON.stringify(tk)),
  ];
  try { await ctx.db.batch(steps); } catch (e) {
    await dropIfUnnamed(ctx.db, ctx.bucket, fallen, charId, moved.key);
    const now = await ctx.db.prepare('SELECT 1 AS x FROM wild_falls WHERE r = ?1').bind(r).first();
    if (now && !again) return wildFall(ctx, player, body, { gateKey, signing }, true);   // another asking landed it first: its answer (asked once more, never a loop)
    throw e;
  }
  await dropObjects(ctx.bucket, [moved.prev]);   // AUDIT INT9: the save two back, as every act drops it
  return answerOf(ctx, signing, { r, fallen, killer, records, kept, burnt, killerFirst, wm: room, oi: ctx.nowS, wg, tk, seq: seize ? null : moved.seq });
}
