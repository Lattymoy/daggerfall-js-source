// INT9 (2026-10-09, the INTEGRITY arc's lane 2 - bible/06-Systems/Integrity-Arc.md; Mac: "I want to do everything and
// do it properly"): A DEATH IN THE OPEN ZONE, TAKEN OFF THE RECORD.
//
// WILD1 left a death's drop to the fallen's own game: it took its bag, its cart and half its purse out of its pack, saved
// without them and sent the records to the room - and its killer's worn piece the same way. A client that never fell
// dropped nothing, and one that fell dropped what it chose (a deposit was any records at all, for its friends to take).
// Now the relay referees the zone (src/net/wild/wildRef.js) and signs a fall (src/net/wild/wildReceipt.js `f1`) naming the fallen,
// its realm character, its killer and the worn piece the killer picked; and THIS SERVICE TAKES THE DROP OFF THE FALLEN'S
// JUDGED RECORD against it - the zone's own law (src/systems/wild/wildDropLaw.js takeWildDeath: the bag but what the fallen
// keep - STORE-KEEPS: the cart too, until it - a tenth of the purse - FOE-KEEPS: it was half - the killer's one worn piece,
// fitted to one remains),
// every piece the ledger bars from leaving kept - and signs what it took for the room: a `remains` order
// (src/net/identityToken.js), the records' digest
// and the killer's piece theirs alone. The room keeps a deposit only on that order.
//
// WHO CARRIES THE RECEIPT: the fallen's own tab first, as an act on its record (its `at` - prepareRealmRecord, the
// client's realmGoldAct taking the same out of its own pack); its killer once WILD_FALL_GRACE_S has gone by - at once
// when the relay signed the fall with the fallen gone from its room (WILD-REJOIN: `g` 1, wildFallGraceS) - as a
// SEIZURE (seizeRealmRecord: the record moved where it stands, its lease cleared - a fallen that never says it fell plays
// a record that moved under it). Once a fall (`wild_falls`, its remains' id): a second asking is answered the first's
// records with a fresh order. A death to a foe, no receipt, takes nothing (FOE-KEEPS, 2026-10-24 - the owner: "I dont want
// people to lose everything they have"): refused, 'foe'; one taken before it is still answered as it was, its remains' id the
// service's (a digest of the character and the tab's own nonce - never a relay's id). A record the
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
// STORE-KEEPS (2026-10-26, the owner: "Make it where you cant lose your wagon/horse or anything stored on death"; asked,
// "Wagon + companions' packs"): A DEATH TAKES THE BAG AND THE PURSE ALONE. The cart's cargo and coin and every companion's
// pack, kit and coin are storage, and no fall takes them (src/systems/wild/wildDropLaw.js takeWildDeath). It retired two
// words this service read: CART-AWAY's `cart` (FIELD BUGS 2026-10-15d - the cart dropped while the wagon was with its
// fallen, and the fallen's tab said when it was away) and COMPANION-DROP's `packs` (FIELD BUGS 2026-10-19f - a take of
// the packs was refused a tab that did not say its game applied one). A tab from before the word still says both; they
// are read by nothing. A fall taken before it and asked again is answered its first take, packs and cart as they were.
//
// WILD-INSURE (2026-10-26, the owner: "being able to insure gear on death"; asked, "Kept, policy spent" at "20% of
// worth"): A PIECE UNDER A POLICY IN FORCE AT THE FALL STAYS. The policies are this service's (`wild_insurance`, written
// by wildInsure.js against the premium off the record); one in force at the fall's signing (wildInsureLaw.js
// wildPolicyInForce over the receipt's `i`) keeps its piece as the ledger keeps a barred one - never taken - and the
// policy of each piece this death would have TAKEN is SPENT in the fall's own batch (AUDIT PVP-EASE L1-3: the killer's
// pick landed on it, or the bag's drop would have carried it - takeWildDeath's `saved`); a policy on a piece nothing named
// stays in force. Its answer names the keys kept (`insured`), for the death screen.
//
// REPEAT-SHIELD (2026-10-26, the owner chose "Repeat-kill shield"): THE SAME HAND TAKES NOTHING TWICE IN HALF AN HOUR. A
// fall whose killer felled the same character within WILD_REPEAT_S takes nothing at all - no worn piece, no bag, no gold
// - and spends no policy; it is written as a fall all the same (`tk.shield`), so a killer camping the rise keeps the
// shield up for as long as they camp. Its answer says so (`shield`). The half hour is between the KILLS - each fall's
// receipt signing, `ki` (AUDIT PVP-EASE L1-1) - never between when each was carried here.
import {
  verifyWildReceipt,
  verifyWildCollect,
  wildFallGraceS,
  WILD_COLLECT_TTL_S,
} from '../../src/net/wild/wildReceipt.js';
import { mintRemainsOrder, remainsDigest, ORDER_TTL_S } from '../../src/net/identityToken.js';
import { streamsFoes, WILD_REMAINS_MS, sanitizeName, FALLBACK_NAME } from '../../src/net/wire.js';
import { GUILD_ID_RE } from '../../src/net/guild/guildLaw.js';
import {
  takeWildDeath,
  takeWildLastRoll,
  wildDropCandidates,
  wildTookOf,
  WILD_FALL_LETTERS,
} from '../../src/systems/wild/wildDropLaw.js';
import { wildPolicyInForce } from '../../src/systems/wild/wildInsureLaw.js'; // WILD-INSURE
import {
  pvpInsuredFor,
  pvpRewardRoll,
  pvpRollIndex,
  pvpPolicyGold,
  pvpPolicyGoldOf,
  pvpGoldPaid,
  pvpLetterOf,
} from '../../src/systems/wild/pvpReward.js'; // PVP-REWARD
import { wornOffer } from '../../src/systems/wild/wildDropLaw.js';
import { mintItemId } from '../../src/systems/item/itemIds.js';
import { giveTradeGoods } from '../../src/net/realm/realmTradeLaw.js';
import {
  prepareRealmRecord,
  seizeRealmRecord,
  realmAtOf,
  realmActFirst,
  recordMovedOf,
  mustChange,
  dropIfUnnamed,
  dropObjects,
  realmSaveTextOf,
  holdRefusal,
  REALM_ID_RE,
} from './realm.js';
import { ledgerKeyOf } from './judge.js';
import { piecesBarred, knownCopySteps } from './ledger.js';
import { isFrozen } from './staffFreeze.js'; // STAFF-PANEL5-FREEZE: a fall naming a frozen account
import { wornNameOf } from './accounts.js'; // WILD-REMAINS-LOSS: the name the fallen wears, its token's law
import { seaKillSteps } from './seaBounty.js'; // SEA-BOUNTY: a kill at sea, written with its fall
import { villainFallSteps } from './villainy.js';
import { isVillain } from '../../src/systems/wild/villainLaw.js'; // PVP-VILLAIN: a villain's policies keep nothing   // PVP-VILLAIN-KEEP: a kill's villain points, written with its fall

/** How long a fall's row is kept (its receipt's hour, and the room's remains' ten minutes past its respawn's two). */
export const WILD_FALLS_KEEP_S = 2 * 3600;
/** REPEAT-SHIELD: how long after a fall its killer takes nothing more from the same character (the owner's half hour). */
export const WILD_REPEAT_S = 30 * 60;
/** A death to a foe's nonce: the tab's own, sixteen hex. */
export const WILD_NONCE_RE = /^[0-9a-f]{16}$/;

/** The most a room key may be (the relay's own keys are far shorter). */
export const WILD_ROOM_MAX = 64;
/** MAC (2026-10-14): THE ESCROW'S LAST COLLECT - the latest a room may still hold the remains its order laid: the order's
 *  minute (a deposit never left inside it lays nothing) and the remains' life after it. A collect signed after it is late. */
export const WILD_ESCROW_HOLD_S = ORDER_TTL_S + Math.ceil(WILD_REMAINS_MS / 1000);
/** When the escrow may go back to its fallen: past its last collect, and a collect signed at that moment spent. */
export const escrowBackAt = (/** @type {number} */ until) => until + WILD_COLLECT_TTL_S;
const parse = (/** @type {any} */ t) => {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
};
/** An escrow row as its fallen's tab reads it. */
const escrowView = (/** @type {any} */ e) =>
  e
    ? { r: e.r, until: Number(e.until_s), back: escrowBackAt(Number(e.until_s)), state: e.state, rec: parse(e.rec) }
    : null;

/** A death to a foe's remains' id: twelve hex of SHA-256 over the character and the tab's nonce. */
async function foeFallId(
  /** @type {SubtleCrypto} */ subtle,
  /** @type {string} */ charId,
  /** @type {string} */ nonce,
) {
  const h = new Uint8Array(await subtle.digest('SHA-256', new TextEncoder().encode(`wild-foe:${charId}:${nonce}`)));
  return [...h.slice(0, 6)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** WILD-REMAINS-LOSS: the name the fallen wears for its remains' order - its token's, by the same law (accounts.js
 *  wornNameOf: the account's name, or the realm character's where the player chose it), so a remains its killer laid
 *  reads as one the fallen laid would. Null when there is none the wire would show (the room then names the remains as
 *  it did before). */
async function fallenNameOf(/** @type {any} */ ctx, /** @type {string} */ fallen, /** @type {string} */ charId) {
  const player = await ctx.db.prepare('SELECT * FROM players WHERE id = ?1').bind(fallen).first();
  if (!player) return null;
  const row = await ctx.db.prepare('SELECT name FROM realm_characters WHERE id = ?1').bind(charId).first();
  const name = sanitizeName((await wornNameOf(ctx, player, row?.name ?? null)).name);
  return name === FALLBACK_NAME ? null : name;
}

/** A fall's answer: the remains' id, the records taken (`wi` 0: the first is the killer's), the pieces the ledger kept back, what the record lost as the
 *  fallen's game finds it again (`took`, `gold` - wildDropLaw.js wildTakeTook), and - where the room is given any - the
 *  service's order over the records. THE FALL'S OWN ORDER: issued at `oi` for room `wm`, the same every asking, good its
 *  minute alone (AUDIT INT9: a fresh order each asking, naming no room, laid one fall's drop twice - in a second room, or
 *  in the first once it had let its emptied remains go). */
async function answerOf(
  /** @type {any} */ ctx,
  /** @type {CryptoKey} */ signing,
  /** @type {any} */ {
    r,
    fallen,
    charId,
    killer,
    records,
    kept,
    burnt,
    killerFirst,
    wm,
    oi,
    wg,
    tk,
    seq = null,
    escrow = null,
  },
) {
  let order = null;
  if (!burnt && records.length && wm && ctx.nowS < oi + ORDER_TTL_S) {
    const wh = await remainsDigest(records, { subtle: ctx.subtle });
    const wnm = await fallenNameOf(ctx, fallen, charId);
    order = await mintRemainsOrder(
      {
        s: fallen,
        wr: r,
        wh,
        wn: records.length,
        wm,
        ...(killerFirst && killer ? { wk: killer, wi: 0, ...(escrow ? { we: 1 } : {}) } : {}),
        ...(wg ? { wg } : {}),
        ...(wnm ? { wnm } : {}),
      },
      signing,
      { subtle: ctx.subtle, nowS: oi },
    );
  }
  const packs = tk?.gold?.packs && typeof tk.gold.packs === 'object' ? { packs: tk.gold.packs } : {}; // COMPANION-DROP: each pack's coin share, by its word
  const letters = tk?.gold?.letters && typeof tk.gold.letters === 'object' ? { letters: tk.gold.letters } : {}; // AUDIT FOE-KEEPS LETTERS-TENTH: each letter's share, by its id
  const insured = Array.isArray(tk?.insured) && tk.insured.length ? { insured: tk.insured } : {}; // WILD-INSURE: the keys its policies kept
  const shield = tk?.shield ? { shield: true } : {}; // REPEAT-SHIELD: nothing taken - the same hand inside WILD_REPEAT_S
  const last = tk?.last ? { last: true } : {}; // PVP-NO-TENTH: the gold its killer took is the last roll's
  if (escrow && pvpPolicyGoldOf(parse(escrow.rec))) escrow = null; // PVP-REWARD: a policy's gold is never the fallen's to watch or take back
  return {
    r,
    order,
    items: records,
    kept,
    wi: killerFirst ? 0 : -1,
    took: Array.isArray(tk?.took) ? tk.took : [],
    gold: { purse: tk?.gold?.purse ?? 0, cart: tk?.gold?.cart ?? 0, ...packs, ...letters },
    ...insured,
    ...shield,
    ...last,
    ...(burnt ? { burnt: true } : {}),
    ...(seq != null ? { realm: { seq } } : {}),
    ...(escrow ? { escrow: escrowView(escrow) } : {}),
  };
}

/**
 * /v1/wild/fall - A DEATH'S DROP, TAKEN. `body.receipt` a fall the relay signed (the caller its fallen or its killer), or
 * none (a death to a foe: the caller's own, `body.n` its tab's nonce - refused, FOE-KEEPS, unless taken before); `body.realm` the caller's record where its tab says
 * it stands (the fallen's own act - required of the fallen, never of a killer); `body.room` the room the remains will be
 * laid in (the order names it, and no other room keeps it); `body.letters` 1 the fallen's word that its game lowers a
 * letter by its share (LETTERS-TENTH). A tab from before STORE-KEEPS also says `cart` and `packs`, which nothing reads.
 * Answers `{ r, order, items, kept, took, gold, insured?, shield?, burnt?, realm? }` - the remains' id, the order the room
 * keeps a deposit on (null: nothing for the room), the records taken, the ledger keys the record kept, what the record
 * lost as the fallen's game finds it again, the keys its policies kept (WILD-INSURE), whether the repeat shield took
 * nothing (REPEAT-SHIELD) - or `{ error }`: 'no-signing-key', 'no-gate-key', 'receipt' (with `why`), 'not-yours',
 * 'no-realm-character', 'grace' (the fallen's own tab has the first WILD_FALL_GRACE_S, none when the receipt says it was
 * gone from the room - wildFallGraceS), 'nonce', 'room', 'foe' (FOE-KEEPS: a death to a foe, never taken), the record's
 * own words.
 * @param {any} ctx `{ db, bucket, rand, nowS, subtle }` @param {any} player the session's account
 * @param {any} body @param {{ gateKey: CryptoKey|null, signing: CryptoKey|null }} keys @param {boolean} [again] the
 *   second asking after a batch another asking beat
 * @returns {Promise<any>}
 */
export async function wildFall(ctx, player, body, { gateKey, signing }, again = false) {
  if (!signing) return { error: 'no-signing-key' };
  let fallen = player.id,
    killer = null,
    charId = null,
    r = null,
    w = -1,
    wt = null,
    seize = false,
    sea = null,
    fallAt = 0;
  if (body?.receipt !== undefined) {
    if (!gateKey) return { error: 'no-gate-key' };
    const v = await verifyWildReceipt(body.receipt, gateKey, { subtle: ctx.subtle, nowS: ctx.nowS });
    if (!v.ok) return { error: 'receipt', why: v.why };
    const c = v.claims;
    if (player.id !== c.f && player.id !== c.k) return { error: 'not-yours' };
    if (!c.c) return { error: 'no-realm-character' };
    ({ f: fallen, k: killer, c: charId, r, w, i: fallAt } = c);
    wt = Array.isArray(c.wt) ? c.wt : null;
    sea = c; // SEA-BOUNTY: the room it fell in and its killer's character - a kill at sea, written with the fall
    if (player.id === c.k) {
      if (ctx.nowS < c.i + wildFallGraceS(c)) return { error: 'grace' };
      seize = true;
    }
  } else if (typeof body?.n !== 'string' || !WILD_NONCE_RE.test(body.n)) return { error: 'nonce' };
  // STAFF-PANEL5-FREEZE (staffFreeze.js; design doc Weak spots: "A frozen player can still be killed and robbed"): a fall
  // that names a frozen account takes nothing - its own (the freeze gate shuts its door already) or a killer's filing
  if (
    fallen !== player.id &&
    isFrozen(await ctx.db.prepare('SELECT frozen_until FROM players WHERE id = ?1').bind(fallen).first(), ctx.nowS)
  )
    return { error: 'fallen-frozen' };
  const room =
    typeof body?.room === 'string' && body.room.length <= WILD_ROOM_MAX && streamsFoes(body.room) ? body.room : null;
  if (!room) return { error: 'room' };
  const at = seize ? null : realmAtOf(body?.realm);
  if (!seize && !at) return { error: 'no-realm-character' };
  if (!seize && charId && at.id !== charId) return { error: 'not-yours' };
  charId ??= at.id;
  r ??= await foeFallId(ctx.subtle, charId, body.n);
  // once a fall: a second asking is the first's records and its own order
  const had = await ctx.db
    .prepare('SELECT player, killer, items, kept, burnt, wi, wm, oi, wg, tk FROM wild_falls WHERE r = ?1')
    .bind(r)
    .first();
  if (had) {
    if (had.player !== fallen) return { error: 'not-yours' };
    const escrow = await ctx.db.prepare('SELECT * FROM wild_escrow WHERE r = ?1').bind(r).first(); // MAC (2026-10-14): its escrow, as the first asking made it
    const read = (/** @type {any} */ t, /** @type {any} */ none) => {
      try {
        return JSON.parse(t) ?? none;
      } catch {
        return none;
      }
    };
    const list = (/** @type {any} */ t) => {
      const v = read(t, []);
      return Array.isArray(v) ? v : [];
    };
    // AUDIT INT9: the fallen's own tab asking again (its first answer lost) is told where its record stands - the act's
    // sequence - while the record is still its tab's
    let seq = null;
    if (at) {
      const now = await ctx.db
        .prepare('SELECT seq, lease FROM realm_characters WHERE id = ?1 AND player = ?2 AND dead_at IS NULL')
        .bind(charId, fallen)
        .first();
      if (now && now.lease === at.lease) seq = now.seq;
    }
    return answerOf(ctx, signing, {
      r,
      fallen,
      charId,
      killer: had.killer,
      records: list(had.items),
      kept: list(had.kept),
      burnt: had.burnt === 1,
      killerFirst: had.wi === 0,
      wm: had.wm,
      oi: had.oi,
      wg: had.wg,
      tk: read(had.tk, {}),
      seq,
      escrow,
    });
  }
  // FOE-KEEPS (2026-10-24, the owner: "I dont want people to lose everything they have"; asked, "Only PvP deaths drop",
  // in the mountains and at sea): a death to a foe takes nothing - no receipt, no take. Asked by a tab from before the
  // word, it is refused and nothing moves; a foe's fall taken before it is answered as it was taken (above).
  if (body?.receipt === undefined) return { error: 'foe' };
  // REPEAT-SHIELD: the same hand inside WILD_REPEAT_S takes nothing - the fall written, the record untouched. AUDIT
  // PVP-EASE L1-1: measured between the KILLS (the receipts' own `i`, the falls' `ki`), on either side - by when each
  // was carried, a killer who held a second kill's receipt (good for an hour) until the first's row was half an hour old
  // took it whole
  const repeat = await ctx.db
    .prepare('SELECT 1 AS x FROM wild_falls WHERE char_id = ?1 AND killer = ?2 AND ki > ?3 AND ki < ?4 LIMIT 1')
    .bind(charId, killer, fallAt - WILD_REPEAT_S, fallAt + WILD_REPEAT_S)
    .first();
  if (repeat)
    return wildShielded(ctx, player, body, { gateKey, signing }, again, {
      r,
      charId,
      fallen,
      killer,
      room,
      sea,
      fallAt,
    });
  // the ledger's word on what may leave, before the drop is taken - asked of EVERY piece the death could take (a copy,
  // another's piece, a claim waiting - kept)
  const row = await ctx.db
    .prepare(
      'SELECT obj, held, judged_seq, villainy FROM realm_characters WHERE id = ?1 AND player = ?2 AND dead_at IS NULL',
    )
    .bind(charId, fallen)
    .first();
  if (!row?.obj || !ctx.bucket) return { error: 'no-realm-character' };
  let stored = null;
  try {
    stored = JSON.parse(/** @type {string} */ (await realmSaveTextOf(await ctx.bucket.get(row.obj))));
  } catch {
    stored = null;
  }
  if (!stored || typeof stored !== 'object') return { error: 'no-data' };
  // LANE 1's FREEZE (Integrity-Arc 3.1): a record the judge holds hands no value to another player - its death still costs
  // it the drop, and the room is given none of it (no order, nothing deposited). MAC (2026-10-14): and it keeps the worn
  // piece its killer picked - that one goes only to its killer, who can never have it from a held record
  const burnt = !!holdRefusal(row);
  // WILD-INSURE: the policies in force at the fall's signing keep their pieces. PVP-VILLAIN's seam: a villain holds none
  const { results: policies = [] } = await ctx.db
    .prepare("SELECT key, at, premium FROM wild_insurance WHERE char_id = ?1 AND state = 'active'")
    .bind(charId)
    .all();
  const live = policies.filter((p) => wildPolicyInForce(Number(p.at), fallAt));
  const insured = pvpInsuredFor(
    live.map((p) => String(p.key)),
    { villain: isVillain(Number(row.villainy)), among: stored.items },
  ); // the owner: "villian lose insurance"; INSURE-ALL: a key two pieces carry keeps neither
  // AUDIT FOE-KEEPS LETTERS-TENTH: a tab that says it lowers a letter by its share (or a seizure, which no game applies) -
  // PVP-NO-TENTH: the letters pay the last roll what the purse cannot; a tab from before the word, the purse alone
  const letters = seize || body?.letters === WILD_FALL_LETTERS;
  // PVP-REWARD: the ledger asked of every worn piece the roll may land on; the killer's pick (`w`, `wt`) is read no more
  const barred = await piecesBarred(
    ctx.db,
    charId,
    [...wornOffer(stored.items).filter((it) => !insured(it)), ...wildDropCandidates(stored, -1, null, { insured })]
      .map(ledgerKeyOf)
      .filter((k) => k != null),
  );
  const keep = (/** @type {any} */ it) => {
    const k = ledgerKeyOf(it);
    return k != null && barred.has(k);
  };
  // MAC (2026-10-14): the killer's piece, where the tab's room collects, into escrow - its ledger key the service's
  const collect = body?.collect === 1;
  // PVP-REWARD: one random worn piece no policy keeps; every one insured, one random policy's gold (escrowed: a room
  // that signs collects), that policy spent and its piece kept. A held record gives nothing.
  const roll = burnt ? null : pvpRewardRoll(stored.items, { insured, keep, pick: (n) => pvpRollIndex(ctx.rand, n) });
  w = roll && 'w' in roll ? roll.w : -1;
  wt = null;
  const policy = roll && 'policy' in roll && collect ? live.find((p) => String(p.key) === roll.policy) : null;
  const policyGold = policy ? pvpPolicyGold(Math.max(1, Math.floor(Number(policy.premium) || 0))) : null;
  // PVP-NO-TENTH: no gold and no letter pays a kill a tenth, but THE LAST ROLL - no piece to take and no policy to pay,
  // a tenth of the coin and the letters together (wildDropLaw.js takeWildLastRoll), escrowed as a policy's gold is
  const lastRoll = !burnt && collect && roll === null;
  /** @type {any} */ let drop = null,
    lastPile = null;
  /** @type {Set<string>} */ const escrowKeys = new Set();
  const change = (/** @type {any} */ save) => {
    drop = takeWildDeath(save, w, keep, wt, { insured, bag: false, purse: false });
    if (lastRoll)
      ({ pile: lastPile, gold: drop.gold } = takeWildLastRoll(save, (it) => keep(it) || insured(it), { letters }));
    if (collect && drop.killer) {
      const k = ledgerKeyOf(drop.taken[0]);
      if (k != null) escrowKeys.add(k);
    }
    return null;
  };
  // the drop is let go (ledger.js letGoSteps), never the service's: whoever takes it from the remains takes it up
  const moved = seize
    ? await seizeRealmRecord(ctx, fallen, charId, change, { escrow: escrowKeys })
    : await prepareRealmRecord(ctx, fallen, /** @type {any} */ (at), change, { escrow: escrowKeys });
  if (moved.error) return moved;
  const escrowed = collect && drop.killer;
  // AUDIT INT9: A DROPPED PIECE IS A NEW PIECE IN THE REMAINS. Each valuable one's id is minted afresh for the room, and
  // the id it had is written down as the fallen's own copy (ledger.js knownCopySteps): a fallen whose game kept the piece
  // holds a copy that moves by no route, where before it held the piece again and the one who took it up was charged
  // for a copy. A crafted piece keeps its craft's key (the craft's record is the account `products`'s), written down the
  // same - its fallen taking it back from its own remains holds it as a copy too, worn but never traded.
  const dropped = [];
  const records = drop.records.map((/** @type {any} */ rec, /** @type {number} */ i) => {
    if (escrowed && i === 0) return rec; // MAC (2026-10-14): the escrowed piece is no new piece - the same one, the service's until it ends
    const key = ledgerKeyOf(drop.taken[i]);
    if (key == null) return rec;
    dropped.push(key);
    return key === drop.taken[i].provenance ? rec : { ...rec, uid: mintItemId(ctx.rand) };
  });
  const killerGold = policyGold ?? lastPile,
    lastGold = lastPile ? pvpPolicyGoldOf(lastPile) : 0;
  if (killerGold) records.unshift(killerGold); // PVP-REWARD, PVP-NO-TENTH: the gold, the killer's alone in the remains
  const kept = [...barred],
    killerFirst = !burnt && (drop.killer || !!killerGold);
  /** @type {string[]} */ const spent = policy ? [...new Set([...drop.saved, String(policy.key)])] : drop.saved;
  const gm = await ctx.db
    .prepare('SELECT guild_id FROM guild_members WHERE player = ?1 AND char_id = ?2')
    .bind(fallen, charId)
    .first();
  const wg = typeof gm?.guild_id === 'string' && GUILD_ID_RE.test(gm.guild_id) ? gm.guild_id : null;
  const tk = {
    took: wildTookOf(drop.taken, drop.from),
    gold: drop.gold,
    ...(spent.length ? { insured: spent } : {}),
    ...(lastGold > 0 ? { last: 1 } : {}),
  };
  const escrow =
    escrowed || killerGold
      ? {
          r,
          player: fallen,
          char_id: charId,
          killer,
          rec: JSON.stringify(killerGold ?? drop.records[0]),
          at: ctx.nowS,
          until_s: ctx.nowS + WILD_ESCROW_HOLD_S,
          state: 'held',
        }
      : null;
  const steps = [
    ...moved.steps,
    ...knownCopySteps(ctx.db, charId, dropped, ctx.nowS),
    ctx.db
      .prepare(
        'INSERT INTO wild_falls (r, char_id, player, killer, at, items, kept, burnt, wi, wm, oi, wg, tk, ki) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?5, ?11, ?12, ?13)',
      )
      .bind(
        r,
        charId,
        fallen,
        killer,
        ctx.nowS,
        JSON.stringify(records),
        JSON.stringify(kept),
        burnt ? 1 : 0,
        killerFirst ? 0 : -1,
        room,
        wg,
        JSON.stringify(tk),
        fallAt,
      ),
    // MAC (2026-10-14): the killer's piece, held - in the batch that took it off the record, or neither lands
    ...(escrow
      ? [
          ctx.db
            .prepare(
              "INSERT INTO wild_escrow (r, player, char_id, killer, rec, at, until_s, state) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'held')",
            )
            .bind(escrow.r, escrow.player, escrow.char_id, escrow.killer, escrow.rec, escrow.at, escrow.until_s),
        ]
      : []),
    // SEA-BOUNTY (seaBounty.js): a fall at sea at another's hand - the bounties on the fallen claimed for its killer, in the
    // batch that writes the fall, or neither lands
    ...seaKillSteps(ctx.db, sea, ctx.nowS),
    ...villainFallSteps(ctx.db, sea), // PVP-VILLAIN-KEEP: the kill's points on its killer, once with the fall
    // WILD-INSURE: each policy that kept its piece, spent in the batch that kept it
    ...spent.map((k) =>
      ctx.db
        .prepare(
          "UPDATE wild_insurance SET state = 'spent', spent_r = ?3, spent_at = ?4 WHERE char_id = ?1 AND key = ?2 AND state = 'active'",
        )
        .bind(charId, k, r, ctx.nowS),
    ),
  ];
  try {
    await ctx.db.batch(steps);
  } catch (e) {
    await dropIfUnnamed(ctx.db, ctx.bucket, fallen, charId, moved.key);
    const now = await ctx.db.prepare('SELECT 1 AS x FROM wild_falls WHERE r = ?1').bind(r).first();
    if (now && !again) return wildFall(ctx, player, body, { gateKey, signing }, true); // another asking landed it first: its answer (asked once more, never a loop)
    throw e;
  }
  await dropObjects(ctx.bucket, [moved.prev]); // AUDIT INT9: the save two back, as every act drops it
  return answerOf(ctx, signing, {
    r,
    fallen,
    charId,
    killer,
    records,
    kept,
    burnt,
    killerFirst,
    wm: room,
    oi: ctx.nowS,
    wg,
    tk,
    seq: seize ? null : moved.seq,
    escrow,
  });
}

/**
 * REPEAT-SHIELD: A FALL THAT TAKES NOTHING - its killer felled the same character inside WILD_REPEAT_S. Written as a fall
 * (no records, nothing kept, `tk.shield`) beside its sea kill's bounties, the record untouched and no policy spent; asked
 * again it is answered as one (wildFall's `had`). The bounties are the kill's, never the take's: a bounty is paid by its
 * setter, not the fallen.
 * @param {any} ctx @param {any} player @param {any} body @param {{ gateKey: CryptoKey|null, signing: CryptoKey|null }} keys
 * @param {boolean} again @param {{ r: string, charId: string, fallen: string, killer: string, room: string, sea: any, fallAt: number }} fall
 */
async function wildShielded(ctx, player, body, keys, again, { r, charId, fallen, killer, room, sea, fallAt }) {
  const tk = { took: [], gold: { purse: 0 }, shield: 1 };
  try {
    await ctx.db.batch([
      ctx.db
        .prepare(
          "INSERT INTO wild_falls (r, char_id, player, killer, at, items, kept, burnt, wi, wm, oi, wg, tk, ki) VALUES (?1, ?2, ?3, ?4, ?5, '[]', '[]', 0, -1, ?6, ?5, NULL, ?7, ?8)",
        )
        .bind(r, charId, fallen, killer, ctx.nowS, room, JSON.stringify(tk), fallAt),
      ...seaKillSteps(ctx.db, sea, ctx.nowS),
      ...villainFallSteps(ctx.db, sea), // PVP-VILLAIN-KEEP: a shielded kill is still a kill its killer chose
    ]);
  } catch (e) {
    const now = await ctx.db.prepare('SELECT 1 AS x FROM wild_falls WHERE r = ?1').bind(r).first();
    if (now && !again) return wildFall(ctx, player, body, /** @type {any} */ (keys), true); // another asking landed it first: its answer
    throw e;
  }
  return answerOf(ctx, /** @type {CryptoKey} */ (keys.signing), {
    r,
    fallen,
    killer,
    records: [],
    kept: [],
    burnt: false,
    killerFirst: false,
    wm: room,
    oi: ctx.nowS,
    wg: null,
    tk,
  });
}

/**
 * ONE END OF AN ESCROW, on a record: the piece into it (`at`, where its tab says it stands - `playerId`'s), the escrow's
 * state moved from 'held' to `state` in the same batch, guarded to exactly one row. Answers `{ r, item, realm }`, or `{ error }`:
 * the record's own word ('lease', 'seq' - realm.js realmActFirst asked first), or 'escrow-moved' (another end landed).
 * @param {any} ctx @param {string} playerId @param {{ id: string, lease: string, seq: number }} at @param {any} row
 * @param {'collected' | 'returned'} state
 */
async function endEscrow(ctx, playerId, at, row, state, freeKg = null) {
  let item = parse(row.rec);
  if (!item || typeof item !== 'object') return { error: 'no-escrow' };
  // PVP-REWARD: a policy's gold - coin where it fits the killer's weight, else a letter of credit for the whole
  const gold = pvpPolicyGoldOf(item);
  if (gold && pvpGoldPaid(gold, freeKg) === 'letter') item = pvpLetterOf(gold, mintItemId(ctx.rand));
  const coin = gold && item.group === 'Currency';
  const prep = await prepareRealmRecord(ctx, playerId, at, (save) => {
    giveTradeGoods(save, coin ? [] : [item], coin ? gold : 0);
    return null;
  });
  if (prep.error) return prep;
  try {
    await ctx.db.batch([
      ...prep.steps,
      ctx.db
        .prepare("UPDATE wild_escrow SET state = ?2, to_char = ?3, ended_at = ?4 WHERE r = ?1 AND state = 'held'")
        .bind(row.r, state, at.id, ctx.nowS),
      mustChange(ctx.db),
    ]);
  } catch (e) {
    if (await dropIfUnnamed(ctx.db, ctx.bucket, playerId, at.id, prep.key))
      return { r: row.r, item, realm: { seq: prep.seq } }; // landed, its answer lost
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
  const side = await realmActFirst(ctx.db, player.id, c.c, body?.realm); // where the record stands, before any other word
  if (side.error) return side;
  if (!side.at) return { error: 'no-realm-character' };
  const row = await ctx.db.prepare('SELECT * FROM wild_escrow WHERE r = ?1').bind(c.r).first();
  if (!row || row.killer !== player.id) return { error: 'no-escrow' };
  if (row.state === 'collected')
    return row.to_char === side.at.id ? { r: row.r, item: parse(row.rec), again: true } : { error: 'escrow-collected' };
  if (row.state === 'returned') return { error: 'escrow-returned' };
  if (c.i > Number(row.until_s)) return { error: 'escrow-late' };
  const paid = await endEscrow(ctx, player.id, side.at, row, 'collected', body?.free);
  if (paid.error || !pvpPolicyGoldOf(parse(row.rec))) return paid;
  // PVP-NO-TENTH: the last roll's gold said as its own, never as a policy's
  const fall = await ctx.db.prepare('SELECT tk FROM wild_falls WHERE r = ?1').bind(row.r).first();
  return parse(fall?.tk)?.last ? { ...paid, last: true } : paid;
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
  if (!row || row.player !== player.id || row.char_id !== side.at.id || pvpPolicyGoldOf(parse(row.rec)))
    return { error: 'no-escrow' }; // PVP-REWARD: a policy's gold was never the fallen's
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
  const { results = [] } = await ctx.db
    .prepare("SELECT * FROM wild_escrow WHERE char_id = ?1 AND player = ?2 AND state = 'held' ORDER BY at LIMIT 16")
    .bind(id, player.id)
    .all();
  return { escrows: results.filter((e) => !pvpPolicyGoldOf(parse(e.rec))).map(escrowView) }; // PVP-REWARD: a policy's gold is not the fallen's
}
