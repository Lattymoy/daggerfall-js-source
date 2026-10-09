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
import { mintRemainsOrder, remainsDigest } from '../../src/net/identityToken.js';
import { takeWildDeath } from '../../src/systems/wildDropLaw.js';
import { prepareRealmRecord, seizeRealmRecord, realmAtOf, dropIfUnnamed, realmSaveTextOf, holdRefusal } from './realm.js';
import { ledgerKeyOf } from './judge.js';
import { piecesBarred } from './ledger.js';

/** How long a fall's row is kept (its receipt's hour, and the room's remains' ten minutes past its respawn's two). */
export const WILD_FALLS_KEEP_S = 2 * 3600;
/** A death to a foe's nonce: the tab's own, sixteen hex. */
export const WILD_NONCE_RE = /^[0-9a-f]{16}$/;

/** The ledger keys `save`'s death would take (a dry run on a copy) - asked of the ledger before the drop is taken. */
const dropKeys = (/** @type {any} */ save, /** @type {number} */ w) => takeWildDeath(JSON.parse(JSON.stringify(save)), w).taken.map(ledgerKeyOf).filter((k) => k != null);

/** A death to a foe's remains' id: twelve hex of SHA-256 over the character and the tab's nonce. */
async function foeFallId(/** @type {SubtleCrypto} */ subtle, /** @type {string} */ charId, /** @type {string} */ nonce) {
  const h = new Uint8Array(await subtle.digest('SHA-256', new TextEncoder().encode(`wild-foe:${charId}:${nonce}`)));
  return [...h.slice(0, 6)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** A fall's answer: the remains' id, the records taken, the pieces the ledger kept back, and - where the room is given
 *  any - the service's order over the records for it. */
async function answerOf(/** @type {any} */ ctx, /** @type {CryptoKey} */ signing, /** @type {any} */ { r, fallen, killer, records, kept, burnt, killerFirst, seq = null }) {
  let order = null;
  if (!burnt && records.length) {
    const wh = await remainsDigest(records, { subtle: ctx.subtle });
    order = await mintRemainsOrder({ s: fallen, wr: r, wh, wn: records.length, ...(killerFirst && killer ? { wk: killer, wi: 0 } : {}) }, signing, { subtle: ctx.subtle, nowS: ctx.nowS });
  }
  return { r, order, items: records, kept, ...(burnt ? { burnt: true } : {}), ...(seq != null ? { realm: { seq } } : {}) };
}

/**
 * /v1/wild/fall - A DEATH'S DROP, TAKEN. `body.receipt` a fall the relay signed (the caller its fallen or its killer), or
 * none (a death to a foe: the caller's own, `body.n` its tab's nonce); `body.realm` the caller's record where its tab says
 * it stands (the fallen's own act - required of the fallen, never of a killer). Answers `{ r, order, items, kept, burnt?,
 * realm? }` - the remains' id, the order the room keeps a deposit on (null: nothing for the room), the records taken, the
 * ledger keys the record kept - or `{ error }`: 'no-signing-key', 'no-gate-key', 'receipt' (with `why`), 'not-yours',
 * 'no-realm-character', 'grace' (the fallen's own tab has the first WILD_FALL_GRACE_S), 'nonce', the record's own words.
 * @param {any} ctx `{ db, bucket, rand, nowS, subtle }` @param {any} player the session's account
 * @param {any} body @param {{ gateKey: CryptoKey|null, signing: CryptoKey|null }} keys
 * @returns {Promise<any>}
 */
export async function wildFall(ctx, player, body, { gateKey, signing }) {
  if (!signing) return { error: 'no-signing-key' };
  let fallen = player.id, killer = null, charId = null, r = null, w = -1, seize = false;
  if (body?.receipt !== undefined) {
    if (!gateKey) return { error: 'no-gate-key' };
    const v = await verifyWildReceipt(body.receipt, gateKey, { subtle: ctx.subtle, nowS: ctx.nowS });
    if (!v.ok) return { error: 'receipt', why: v.why };
    const c = v.claims;
    if (player.id !== c.f && player.id !== c.k) return { error: 'not-yours' };
    if (!c.c) return { error: 'no-realm-character' };
    ({ f: fallen, k: killer, c: charId, r, w } = c);
    if (player.id === c.k) {
      if (ctx.nowS < c.i + WILD_FALL_GRACE_S) return { error: 'grace' };
      seize = true;
    }
  } else if (typeof body?.n !== 'string' || !WILD_NONCE_RE.test(body.n)) return { error: 'nonce' };
  const at = seize ? null : realmAtOf(body?.realm);
  if (!seize && !at) return { error: 'no-realm-character' };
  if (!seize && charId && at.id !== charId) return { error: 'not-yours' };
  charId ??= at.id;
  r ??= await foeFallId(ctx.subtle, charId, body.n);
  // once a fall: a second asking is the first's records, a fresh order
  const had = await ctx.db.prepare('SELECT player, killer, items, kept, burnt, wi FROM wild_falls WHERE r = ?1').bind(r).first();
  if (had) {
    if (had.player !== fallen) return { error: 'not-yours' };
    const read = (/** @type {any} */ t) => { try { const v = JSON.parse(t); return Array.isArray(v) ? v : []; } catch { return []; } };
    return answerOf(ctx, signing, { r, fallen, killer: had.killer, records: read(had.items), kept: read(had.kept), burnt: had.burnt === 1, killerFirst: had.wi === 0 });
  }
  // the ledger's word on what may leave, before the drop is taken (a copy, another's piece, a claim waiting - kept)
  const row = await ctx.db.prepare('SELECT obj, held, judged_seq FROM realm_characters WHERE id = ?1 AND player = ?2 AND dead_at IS NULL').bind(charId, fallen).first();
  if (!row?.obj || !ctx.bucket) return { error: 'no-realm-character' };
  let stored = null;
  try { stored = JSON.parse(/** @type {string} */ (await realmSaveTextOf(await ctx.bucket.get(row.obj)))); } catch { stored = null; }
  if (!stored || typeof stored !== 'object') return { error: 'no-data' };
  const barred = await piecesBarred(ctx.db, charId, dropKeys(stored, w));
  const keep = (/** @type {any} */ it) => { const k = ledgerKeyOf(it); return k != null && barred.has(k); };
  /** @type {any} */ let drop = null;
  const change = (/** @type {any} */ save) => { drop = takeWildDeath(save, w, keep); return null; };
  // the drop is let go (ledger.js letGoSteps), never the service's: whoever takes it from the remains takes it up
  const moved = seize ? await seizeRealmRecord(ctx, fallen, charId, change, { escrow: false }) : await prepareRealmRecord(ctx, fallen, /** @type {any} */ (at), change);
  if (moved.error) return moved;
  // LANE 1's FREEZE (Integrity-Arc 3.1): a record the judge holds hands no value to another player - its death still costs
  // it the drop, and the room is given none of it (no order, nothing deposited)
  const burnt = !!holdRefusal(row);
  const records = drop.records, kept = [...barred], killerFirst = !burnt && drop.killer;
  const steps = [
    ...moved.steps,
    ctx.db.prepare('INSERT INTO wild_falls (r, char_id, player, killer, at, items, kept, burnt, wi) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)')
      .bind(r, charId, fallen, killer, ctx.nowS, JSON.stringify(records), JSON.stringify(kept), burnt ? 1 : 0, killerFirst ? 0 : -1),
  ];
  try { await ctx.db.batch(steps); } catch (e) {
    await dropIfUnnamed(ctx.db, ctx.bucket, fallen, charId, moved.key);
    const now = await ctx.db.prepare('SELECT 1 AS x FROM wild_falls WHERE r = ?1').bind(r).first();
    if (now) return wildFall(ctx, player, body, { gateKey, signing });   // another asking landed it first: its answer
    throw e;
  }
  return answerOf(ctx, signing, { r, fallen, killer, records, kept, burnt, killerFirst, seq: seize ? null : moved.seq });
}
