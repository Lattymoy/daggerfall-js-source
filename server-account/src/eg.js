// @ts-check
// ═══════════════════════════════════════════════════════════════════
// EG-PLAY (2026-10-11, the Elite Gates arc) — THE ELITE BREACH, AS THE SERVICE KEEPS IT.
//
// Mac: "an endless procedural breach for a party of 8 ... keys ... checkpoints". Design:
// bible/11-Multiplayer/Elite-Gates.md sections 5, 16 and 23.
//
// ═══ THE BALANCE IS THE ACCOUNT'S ══════════════════════════════════
//
// A Weir Key opens a real relay instance, so it is a count on the account's row (`players.eg_keys`, migration 0113) -
// the item in the pack is its face, restacked by the client to every answer here that carries the count (`keys`). The
// service rolls every key with its own die (`rand`), at a claim it already verifies: a recorded Dagon's Breach kill
// (one in six, one in four for a fighter who broke the rite, the account's first kill certain, and the sixth kill after
// five in a row with none - the pity), and a recorded Hour (one in three).
//
// ═══ THE OPEN AND THE STAKE ════════════════════════════════════════
//
// `/v1/eg/open` takes one key (or the day's Rehearsal, no key) into a STAKE and signs the open order the hub opens the
// breach on (identityToken.js mintEgOrder - `egopen`). One conditional UPDATE takes the key and sets the account's live
// breach together (the insignia spend's way): two opens at once take one key and one breach. It is idempotent on the
// client's request id `rq` - a client that lost the answer asks again and gets the same breach back. A member's
// `/v1/eg/admit` sets the same live breach (one breach at a time, every account) and signs its admission. A lapsed live
// breach counts as clear: no lost receipt locks an account out.
//
// ═══ THE CLAIM ═════════════════════════════════════════════════════
//
// The relay's `e1` receipts (src/net/eliteGates/egReceipt.js), carried here by the account they name: a Redoubt taken (`w`) -
// one row a (breach, account, Redoubt), the signed win's spoils, and the stake spent; the member's end (`x`) - one row a
// (breach, account), the live breach cleared, and the stake settled (spent, or returned once ever by the first breach's
// mercy when the breach took no Redoubt); a void (`v`) - the stake given back. Guests are answered `guest` and counted
// nothing, as every claim's are.
//
// EG-E1 (2026-10-12, Mac: "I said I want everything"; Elite-Gates.md section 19): WHAT A REDOUBT PAYS - the week's pay,
// its Marks and guild's deed, its embers, a Valkynaz's Weir Key and the Panoply's pity - is egEconomy.js's, written in the
// `w` claim's own batch; the end's Reliquaries answered by the week's pay; the Broker's Panoply sink (`/v1/eg/sink`).
// ═══ THE DUNGEON'S FIND (EG-E3) ════════════════════════════════════
//
// No relay witnesses an ordinary dungeon, so an elite foe's killer's client asks (`/v1/eg/find`, section 5) with the
// dungeon's tier, and the service rolls the key with its own die - bounded, never believed: a handle and a proven account,
// EG_FIND_PER_DAY asks a tier a real day, EG_FIND_KEYS_PER_WEEK keys a week from finds (`eg_finds`, migration 0113).
//
// ═══ THE FIRST-TIME LINES AND THE RECAP'S BOARD LINE (EG-ZF) ═══════
//
// Section 27.7's first-time lines are said once an account: the lines a client has shown are OR'ed onto the account's row
// (`players.eg_first`, a bit a line - `/v1/eg/first`, egFirstSay) and answered on `/v1/eg/keys` (`first`), so a new
// device says none again. Section 27.6's board line: an end's claim answers the member's standing (`board` - egHonours.js
// egStandingOf). And First of the Spire's letter goes to a listed account at its keys' read (egHonours.js egFirstPost).
//
// ═══ THE STAKE'S CLOCK (EG-ZM) ═════════════════════════════════════
//
// Section 23: the key is never returned by a clock - a clock SPENDS. A stake no receipt has settled (no Redoubt, no void
// claimed, no end of the opener's - or only the one the first breach's mercy held it on) is spent by the service's own
// hourly clock (cron.js) once nothing can name it any more - EG_STAKE_CLOCK_S past its `until` - and its opener is told so
// in the mailbox, one letter a stake (EG_STAKE_POST; AUDIT EG IV: EG_STAKE_POST_HELD's words where the mercy held it). Its
// key stays taken, as any spent stake's does; a Rehearsal's held none and says nothing.
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═══════════════════════════════════════════════════════════════════

import { verifyEgReceipt, EG_RECEIPT_TTL_S } from '../../src/net/eliteGates/egReceipt.js';
import { POST_SENDER } from '../../src/net/postLaw.js';   // EG-ZM: the post's sender, as the box shows it
import { mintEgOrder } from '../../src/net/identityToken.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { egHonourStatements, egHonoursAnswer, egRecordOf } from './egHonours.js';   // EG-E2: the feats, the Annals, the honours
import { egStandingOf, egFirstPost, egBoardsMoved } from './egHonours.js';   // EG-ZF: the recap's board line; First of the Spire's letter; AUDIT EG III: the boards' kept rankings forgotten at a claim
import { egRedoubtPay, egReliquariesOf, egSinkOf } from './egEconomy.js';   // EG-E1: what a Redoubt pays, the sink
import { arenaWeekOf } from '../../src/net/arena/arenaLaw.js';   // EG-E3: the week a find's keys are capped by, the arena's
import { egMayStart, egWagerOf } from '../../src/net/eliteGates/egStartLaw.js';   // EG-F: the start Redoubt and the Wager, held at the open and every admission
import { egStartsFor } from './egStarts.js';
import { egSpoilsSeed } from '../../src/net/eliteGates/egPay.js';   // AUDIT EG V (L8-5): the spoils' seed, the receipt's mixed with the claim's own draw

/** The odds a recorded gate kill rolls a key, a fighter who broke the rite, an Hour; the kills in a row the pity waits. */
export const EG_KEY_ODDS = 1 / 6;
export const EG_KEY_ODDS_RITE = 1 / 4;
/** WB14g (bible/11-Multiplayer/Breach-Portents.md section 11): a portent night's receipt (its `p`) rolls at the rite's odds. */
export const EG_KEY_ODDS_PORTENT = 1 / 4;
export const EG_KEY_ODDS_SD = 1 / 3;
export const EG_KEY_PITY = 5;
/** A live breach's bound past its open: the last word (36 game hours, three real ones - src/net/eliteGates/egLaw.js
 *  EG_LAST_WORD_MS, pinned equal), the open window before it, and ten minutes' slack. */
export const EG_LAST_WORD_S = 10_800;
export const EG_OPEN_WINDOW_S = 600;
export const EG_LIVE_SLACK_S = 600;
export const EG_LIVE_S = EG_LAST_WORD_S + EG_OPEN_WINDOW_S + EG_LIVE_SLACK_S;
/** AUDIT EG III (lane3 #15): how long after its open's ask a breach admits a member - the sealed hour and the open window
 *  (EG_OPEN_WINDOW_S: the relay's 5 and at most 5 real minutes from the opening) and the slack an order takes to reach the
 *  room. The page answers the call only while its breach is open (src/scenes/eliteGates/egClient.js `answer`), so a later ask is a
 *  breach that has closed behind its company: it locks no account out for three hours. */
export const EG_ADMIT_WINDOW_S = EG_OPEN_WINDOW_S + EG_LIVE_SLACK_S;
/** EG-E3 (2026-10-12, Mac: "I said I want everything"; section 5, "The dungeon's find"): a dungeon elite's odds of a key,
 *  by the dungeon's tier as the port names it (src/systems/dungeon/dungeonTier.js DUNGEON_TIERS - `super` the player's Abyss
 *  Dungeon); the asks a tier an account a real UTC day; the keys finds may pay an account an arena week. At the caps a
 *  forger's ceiling is 6/400 + 6/150 + 6/60 = 0.155 keys a day, under an honest gatebreaker's. */
export const EG_FIND_ODDS = Object.freeze({ super: 1 / 60, elite: 1 / 150, regular: 1 / 400 });
export const EG_FIND_PER_DAY = 6;
export const EG_FIND_KEYS_PER_WEEK = 2;
/** A request id an open is idempotent on, a breach id, an order id. */
export const EG_RQ_RE = /^[a-z0-9]{16,32}$/;
/** EG-ZM: how long after its order's issue a breach's void may be asked - the relay's (src/net/eliteGates/egDurable.js EG_VOID_MAX_S,
 *  pinned equal; that module is the relay's, outside this Worker's bundle). */
export const EG_VOID_WINDOW_S = 7 * 24 * 3600;
/** EG-ZM (section 23, "The clock"): THE STAKE'S CLOCK - a stake still `held` this long past its `until` is spent by the
 *  service's own clock. Past it nothing can name it: no void can be minted for its order (the hub and the room refuse one
 *  EG_VOID_WINDOW_S past the order's issue, and an order is issued at the latest at its stake's `until` - an open asked
 *  again signs it again only while the stake holds), and no receipt minted before is still alive (EG_RECEIPT_TTL_S, a
 *  receipt's life). Every end and Redoubt receipt is minted by the breach's last word, inside `until`. */
export const EG_STAKE_CLOCK_S = EG_VOID_WINDOW_S + EG_RECEIPT_TTL_S;
/** EG-ZM: THE LETTER a stake the clock spent sends its opener (server_post - the mailbox): one a stake, its batch
 *  `spire-stake-<ez>` (src/net/postLaw.js POST_BATCH_RE); `{day}` the UTC day the key was staked. */
export const EG_STAKE_POST = Object.freeze({
  batch: 'spire-stake-',
  subject: 'A Weir Key spent',
  body: [
    'The Weir Key you staked on {day} opened a breach that never sent word back: no Redoubt, no end and no void reached the Spire\'s ledger in the time a key waits for one.',
    '',
    'That key is spent. It does not return.',
    '',
    `- ${POST_SENDER}`,
  ].join('\n'),
});
/** AUDIT EG IV (lane3 #6; sections 5 and 23): THE LETTER for a stake the first breach's mercy held - its opener's own end
 *  reached the ledger (its row on `eg_runs`), and the stake waited for the word that the breach ended with no Redoubt taken
 *  (`nr`), which no claim brought: a member who never claimed it, or a breach that took a Redoubt nobody earned. The words
 *  EG_STAKE_POST's are untrue there; its subject and batch are the same. */
export const EG_STAKE_POST_HELD = Object.freeze({
  body: [
    'The Weir Key you staked on {day} was held for the first breach\'s mercy, which gives a key back when a first breach ends with no Redoubt taken. Your own end reached the Spire\'s ledger, but no word that the breach ended with no Redoubt taken came in the time a key waits for one.',
    '',
    'That key is spent. It does not return.',
    '',
    `- ${POST_SENDER}`,
  ].join('\n'),
});
/** AUDIT EG IV (lane3 #4, lane9 #24; section 5, "The launch gift"): THE LAUNCH GIFT'S LETTER - the key migration 0113 adds
 *  to every account with a recorded Dagon's Breach kill, worded in the mailbox by the same migration (server_post, batch
 *  `spire-launch`, HOURS-FIRST's send - 0094), its words these (test/net/eliteGates/egaudit4_net_service.test.js holds the migration's
 *  statement to them). It carries no item: the key is the balance's, already counted. */
export const EG_LAUNCH_POST = Object.freeze({
  batch: 'spire-launch',
  subject: 'From the Battlespire',
  body: [
    'For the Dagon\'s Breach you closed, the Battlespire sends you a Weir Key - one of its portal keys, surrendered to the Kyn in 3E 398. It is already in your pack.',
    '',
    'Use it under open sky, away from any town, to open an Elite Breach: your party is called with you, and the Spire\'s halls go down as deep as you can take them.',
    '',
    `- ${POST_SENDER}`,
  ].join('\n'),
});
/** EG-ZF (section 27.7): the first-time lines' bits the account keeps - sixteen, room past the page's nine and the
 *  Rehearsal's own (src/ui/eliteGates/egBeats.js EG_FIRST_KEYS, EG_FIRST_REHEARSAL_BIT). */
export const EG_FIRST_BITS_MAX = 0xffff;
const BREACH_RE = /^[0-9a-f]{16}$/;

const int = (v) => (Number.isSafeInteger(Number(v)) ? Number(v) : 0);
const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
/** The account's live breach, if it still holds at `nowS`. */
const liveOf = (row, nowS) => (row?.eg_live_b && int(row.eg_live_until) > nowS ? { b: row.eg_live_b, until: int(row.eg_live_until) } : null);
/** May the account stake a key at all: a Dagon's Breach closed (a recorded kill, never the rite alone) or a Redoubt
 *  taken (section 5 - a fresh account cannot farm or open). The Rehearsal asks neither. */
async function proven(db, id) {
  const r = await db.prepare("SELECT (EXISTS (SELECT 1 FROM gate_kills WHERE account = ?1 AND earned != 'rite') OR EXISTS (SELECT 1 FROM eg_redoubts WHERE account = ?1)) AS ok").bind(id).first();
  return int(r?.ok) === 1;
}
async function playerRow(db, id) {
  return db.prepare('SELECT eg_keys, eg_key_miss, eg_live_b, eg_live_until, eg_rh_day, eg_mercy, eg_first FROM players WHERE id = ?1').bind(id).first();
}

/**
 * THE BALANCE AND THE LIVE BREACH - `{ keys, live, rehearsal, proven, redoubts, sink, annals, feats, first }`: the Weir Keys
 * held, the breach the account is in (`{b, until}`, or null), whether the day's Rehearsal is still free, whether it may
 * stake a key, the Redoubts it has taken, (EG-E1) the week's Panoply sink - `{ week, piece }`, the piece null until one is
 * bought - (EG-E2) the Annals' pages it keeps and each lord's feats (egHonours.js egRecordOf), and (EG-ZF) the first-time
 * lines it has been shown (`first`, a bit a line). EG-ZF: an account First of the Spire's list names is sent its letter,
 * once (egHonours.js egFirstPost - `env` the service's config).
 * @param {{ db: any, nowS: number }} ctx @param {{ id: string, handle?: string|null }} player @param {any} [env]
 */
export async function egKeysOf({ db, nowS }, player, env = null) {
  const row = await playerRow(db, player.id);
  const rd = await db.prepare('SELECT COUNT(*) AS n FROM eg_redoubts WHERE account = ?1').bind(player.id).first();
  await egFirstPost(db, player, env, nowS);
  return { keys: int(row?.eg_keys), live: liveOf(row, nowS), rehearsal: int(row?.eg_rh_day) !== utcDay(nowS), proven: await proven(db, player.id), redoubts: int(rd?.n), sink: await egSinkOf({ db, nowS }, player), ...(await egRecordOf(db, player.id)), first: int(row?.eg_first) };
}
/**
 * EG-ZF (section 27.7): THE FIRST-TIME LINES SHOWN (`{ bits }`, a bit a line - the client's lines in force), OR'ed onto
 * the account's row: a line once shown is held for good, and a bit asked again changes nothing. Answers `{ first }` (the
 * account's bits after), or `{ error }`: `guest` (no account to remember for - the device keeps its own), `bits` (not a
 * whole number of EG_FIRST_BITS_MAX's sixteen bits).
 * @param {{ db: any }} ctx @param {{ id: string, handle?: string|null }} player @param {any} body
 */
export async function egFirstSay({ db }, player, body) {
  if (!player.handle) return { error: 'guest' };
  const bits = body?.bits;
  if (!Number.isSafeInteger(bits) || bits < 0 || bits > EG_FIRST_BITS_MAX) return { error: 'bits' };
  const row = await db.prepare('UPDATE players SET eg_first = eg_first | ?2 WHERE id = ?1 RETURNING eg_first').bind(player.id, bits).first();
  return { first: int(row?.eg_first) };
}

/**
 * THE OPEN: one key staked (`rh` 1: the day's Rehearsal, no key) and the open order signed. Answers `{ order, b, ez,
 * keys, until, rh }`, or `{ error }`: `no-signing-key` (503), `guest`, `rq` (a bad request id), `unproven` (no gate
 * closed, no Redoubt taken), `live` (a breach held - `b` which), `short` (no key), `rehearsed` (today's Rehearsal
 * spent). EG-F (sections 5, 16.6 and 18): `ew` the start Redoubt the start window chose and `wg` its Wager - refused
 * `start` (`w`: not one the opener may start at - egStarts.js) and `wager` (not up to three decrees of three families);
 * a Rehearsal starts at Hall 1 with no Wager. Both ride the stake and the order (`ew`, `ewg`). AUDIT EG IV (lane3 #1):
 * `again` 1 asks only for the stake `rq` already took - its order signed as of the stake's `at` (a void's, never an open's),
 * `at` with it - or `none` (no key taken), `spent` (settled).
 * @param {{ db: any, nowS: number, subtle: SubtleCrypto, rand: (b: Uint8Array) => Uint8Array }} ctx
 * @param {{ id: string, handle?: string|null }} player @param {any} body @param {CryptoKey|null} key
 */
export async function openEg({ db, nowS, subtle, rand }, player, body, key) {
  if (!key) return { error: 'no-signing-key' };
  if (!player.handle) return { error: 'guest' };
  const rq = body?.rq, rh = body?.rh === 1 ? 1 : 0;
  if (typeof rq !== 'string' || !EG_RQ_RE.test(rq)) return { error: 'rq' };
  // EG-F: the start and the Wager the window chose (a Rehearsal: Hall 1, none)
  const ew = body?.ew ?? 0, wg = egWagerOf(body?.wg);
  if (!Number.isSafeInteger(ew) || ew < 0 || ew > 999 || (rh && ew !== 0)) return { error: 'start', w: Number.isSafeInteger(ew) ? ew : 0 };
  if (!wg || (rh && wg.length)) return { error: 'wager' };
  // ASKED AGAIN: the same breach back, while its stake still holds
  const had = await db.prepare('SELECT ez, b, rh, at, until, state, ew, wg FROM eg_stakes WHERE account = ?1 AND rq = ?2').bind(player.id, rq).first();
  // AUDIT EG IV (lane3 #1; sections 22 and 23, "A key's loss"): AN OPEN WHOSE ANSWER WAS LOST, ASKED AFTER (`again`: 1 - the
  // device kept the request id before it asked): the stake that request took, or `none` - it never takes a key itself. The
  // order is signed as of the stake's own `at` (its issue the open's), so it opens nothing (it lived a minute) and its void
  // is the room's to mint for EG_VOID_MAX_S from the open, as any void is - the stake's clock waits that out
  if (body?.again === 1) {
    if (!had) return { error: 'none' };
    if (had.state !== 'held') return { error: 'spent' };
    const row = await playerRow(db, player.id);
    const order = await mintEgOrder({ o: 'egopen', s: player.id, eb: had.b, ez: had.ez, ew: int(had.ew), rh: int(had.rh) === 1 ? 1 : undefined, ewg: wagerOfRow(had.wg) }, key, { subtle, nowS: int(had.at) });
    return { order, b: had.b, ez: had.ez, keys: int(row?.eg_keys), until: int(had.until), rh: int(had.rh), at: int(had.at) };
  }
  if (had) {
    if (had.state !== 'held' || int(had.until) <= nowS) return { error: 'spent' };
    const row = await playerRow(db, player.id);
    // AUDIT EG V (lane4 L4-5; sections 6.1 and 23 - the stake's `until` is set "so no breach outlives it"): THE SAME ORDER
    // AGAIN, signed as of the stake's own `at` as `again`'s is - re-signed fresh until the stake's `until`, a request id
    // asked again hours on opened its breach then, past `eg_live`'s end, and the account opened a second beside it
    const order = await mintEgOrder({ o: 'egopen', s: player.id, eb: had.b, ez: had.ez, ew: int(had.ew), rh: int(had.rh) === 1 ? 1 : undefined, ewg: wagerOfRow(had.wg) }, key, { subtle, nowS: int(had.at) });
    return { order, b: had.b, ez: had.ez, keys: int(row?.eg_keys), until: int(had.until), rh: int(had.rh) };
  }
  if (!rh && !(await proven(db, player.id))) return { error: 'unproven' };
  if (ew > 0 && !egMayStart(await egStartsFor(db, player.id, nowS), ew)) return { error: 'start', w: ew };   // EG-F: no carries, the opener's own start too
  const b = hex(rand(new Uint8Array(8))), ez = hex(rand(new Uint8Array(12))), until = nowS + EG_LIVE_S, day = utcDay(nowS);
  // ONE TRANSACTION: the key (or the day's Rehearsal) and the live breach taken together, and the stake written by that
  // write alone (the row carries this breach only when the UPDATE took it)
  const [took] = await db.batch([
    db.prepare(`UPDATE players SET eg_keys = eg_keys - ?3, eg_rh_day = CASE WHEN ?6 = 1 THEN ?5 ELSE eg_rh_day END, eg_live_b = ?2, eg_live_until = ?4
      WHERE id = ?1 AND (eg_live_b IS NULL OR eg_live_until <= ?7) AND (CASE WHEN ?6 = 1 THEN eg_rh_day != ?5 ELSE eg_keys >= 1 END) RETURNING eg_keys`)
      .bind(player.id, b, rh ? 0 : 1, until, day, rh, nowS),
    db.prepare("INSERT INTO eg_stakes (ez, account, b, rq, rh, at, until, state, ew, wg) SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, 'held', ?8, ?9 WHERE EXISTS (SELECT 1 FROM players WHERE id = ?2 AND eg_live_b = ?3)")
      .bind(ez, player.id, b, rq, rh, nowS, until, ew, wg.join(',')),   // EG-F: the stake keeps its start and its Wager
  ]);
  const left = took?.results?.[0];
  if (!left) {
    const row = await playerRow(db, player.id);
    const live = liveOf(row, nowS);
    if (live) return { error: 'live', b: live.b };
    return rh ? { error: 'rehearsed' } : { error: 'short', keys: int(row?.eg_keys) };
  }
  const order = await mintEgOrder({ o: 'egopen', s: player.id, eb: b, ez, ew, rh: rh ? 1 : undefined, ewg: wg.length ? wg : undefined }, key, { subtle, nowS });
  return { order, b, ez, keys: int(left.eg_keys), until, rh };
}
/** EG-F: a stake's Wager as its row keeps it ('' none; the decrees' numbers joined by commas) - an order's `ewg`, or none. */
const wagerOfRow = (s) => { const wg = egWagerOf(String(s ?? '').split(',').filter(Boolean).map(Number)); return wg?.length ? wg : undefined; };

/**
 * A MEMBER'S ADMISSION: the account's live breach set to `b` (one breach at a time - a lapsed one is clear) and its
 * admit order signed (`egadmit`). The room checks the company and spends the order once. Answers `{ order, b }`, or
 * `{ error }`: `no-signing-key`, `guest`, `breach` (a bad id, or one no stake opened - AUDIT EG III), `spent` (its stake
 * settled, or its open window past - AUDIT EG III), `live` (another breach held - `b` which). EG-F (section
 * 16.6): `start` (`w`) - the breach starts at a Redoubt this member may not start at (no carries); the order names the
 * breach's start (`ew`, its stake's).
 * @param {{ db: any, nowS: number, subtle: SubtleCrypto, rand: (b: Uint8Array) => Uint8Array }} ctx
 * @param {{ id: string, handle?: string|null }} player @param {any} body @param {CryptoKey|null} key
 */
export async function admitEg({ db, nowS, subtle, rand }, player, body, key) {
  if (!key) return { error: 'no-signing-key' };
  if (!player.handle) return { error: 'guest' };
  const b = body?.b;
  if (typeof b !== 'string' || !BREACH_RE.test(b)) return { error: 'breach' };
  // AUDIT EG III (lane3 #9, #15): THE BREACH'S OWN STAKE - a breach the service staked no key for is no breach (its start
  // read as Hall 1 signed an order any room would take), one whose stake is settled or whose open window is past admits
  // nobody (`spent`), and the live breach an admission sets is the stake's own `until`, never the ask's (section 23)
  const st = await db.prepare('SELECT ew, at, until, state FROM eg_stakes WHERE b = ?1').bind(b).first();
  if (!st) return { error: 'breach' };
  if (st.state !== 'held' || nowS > int(st.at) + EG_ADMIT_WINDOW_S) return { error: 'spent' };
  const ew = int(st.ew);   // EG-F: the breach's start
  if (ew > 0 && !egMayStart(await egStartsFor(db, player.id, nowS), ew)) return { error: 'start', w: ew };
  const took = await db.prepare(`UPDATE players SET eg_live_b = ?2, eg_live_until = CASE WHEN eg_live_b = ?2 AND eg_live_until > ?3 THEN eg_live_until ELSE ?4 END
    WHERE id = ?1 AND (eg_live_b IS NULL OR eg_live_b = ?2 OR eg_live_until <= ?3) RETURNING eg_live_b`).bind(player.id, b, nowS, int(st.until)).first();
  if (!took) { const live = liveOf(await playerRow(db, player.id), nowS); return { error: 'live', ...(live ? { b: live.b } : {}) }; }
  const order = await mintEgOrder({ o: 'egadmit', s: player.id, eb: b, ez: hex(rand(new Uint8Array(12))), ew }, key, { subtle, nowS });
  return { order, b };
}

/**
 * EG-ZA (2026-10-12; bible/11-Multiplayer/Elite-Gates.md sections 20, 21 and 23's table): WHAT THE REST OF A RECEIPT SAYS,
 * kept on the row its claim wrote (each guarded by that row, so only a recorded receipt writes): a Redoubt's `sh` (its
 * share of the circle's damage, thousandths) and `m` (THE FAIR TRAIL's measures over the circle - JSON, for staff; they
 * gate nothing until EG21); an end's company `co` (`[n, tag]` - net/eliteGates/egReceipt.js egCompanyTag), by which the Descent keeps
 * a company one row (egHonours.js egDescentCompanies). A receipt from before the relay minted them writes nothing.
 * @param {any} db @param {{ id: string }} player @param {any} c the verified claims
 */
export function egReceiptRest(db, player, c) {
  if (c.q === 'w' && (c.sh !== undefined || c.m !== undefined)) {
    return [db.prepare('UPDATE eg_redoubts SET sh = ?4, m = ?5 WHERE b = ?1 AND account = ?2 AND w = ?3 AND sh IS NULL AND m IS NULL')
      .bind(c.b, player.id, c.w, Number.isSafeInteger(c.sh) ? c.sh : null, Array.isArray(c.m) ? JSON.stringify(c.m) : null)];
  }
  if (c.q === 'x' && Array.isArray(c.co)) return [db.prepare('UPDATE eg_runs SET co_n = ?3, co_h = ?4 WHERE b = ?1 AND account = ?2').bind(c.b, player.id, int(c.co[0]), String(c.co[1]))];
  return [];
}
/** A UTC day's seconds (src/net/marksLaw.js utcDay's divisor - a Rehearsal's day is the day of its stake's `at`). */
const DAY_S = 86_400;
/** A stake given back, once: the key to its opener (a Rehearsal's held none) and the stake marked returned - one
 *  transaction, the key moved only while the stake still held. AUDIT EG III (lane3 #1, section 23 RETURNED: "an x with
 *  why:'void', even after w receipts"): A VOID gives back a stake its breach's first Redoubt SPENT too - a force deploy's
 *  void came after the company's Redoubts and left the key spent - and never one already returned; the mercy gives back a
 *  held one alone. AUDIT EG III (lane3 #14): a voided Rehearsal gives back the day it took (`eg_rh_day`, while it is still
 *  that day's), as a voided key's stake gives back its key. */
const returnStake = (db, ez, mercy = false) => {
  const from = mercy ? "state = 'held'" : "state IN ('held', 'spent')";
  return [
    db.prepare(`UPDATE players SET eg_keys = eg_keys + 1${mercy ? ', eg_mercy = 1' : ''} WHERE id = (SELECT account FROM eg_stakes WHERE ez = ?1 AND ${from} AND rh = 0)`).bind(ez),
    ...(mercy ? [] : [db.prepare(`UPDATE players SET eg_rh_day = -1 WHERE id = (SELECT account FROM eg_stakes WHERE ez = ?1 AND ${from} AND rh = 1)
      AND eg_rh_day = (SELECT at / ${DAY_S} FROM eg_stakes WHERE ez = ?1)`).bind(ez)]),
    db.prepare(`UPDATE eg_stakes SET state = 'returned' WHERE ez = ?1 AND ${from}`).bind(ez),
  ];
};
/** A stake spent, once. */
const spendStake = (db, ez) => db.prepare("UPDATE eg_stakes SET state = 'spent' WHERE ez = ?1 AND state = 'held'").bind(ez);
/**
 * AUDIT EG III (lane3 #6; section 5, "The first breach's mercy" - "an account's first opened breach"): MAY STAKE `ez` STILL
 * BE GIVEN BACK BY THE MERCY - a key's stake (a Rehearsal's held none), its opener's mercy unspent (`players.eg_mercy`), and
 * the opener's FIRST opened breach: no key it staked before this one stands unreturned (a breach a void gave back was given
 * back whole - the Spire kept nothing of it - so the breach after it is still the first).
 * @param {any} db @param {string} ez @param {{ account: string, rh: number }} stake
 */
async function mercyMay(db, ez, stake) {
  if (int(stake.rh) !== 0) return false;
  // "before" by the stakes' own order of writing (the table's rowid - never deleted but with their account): two opens in
  // one second, an end claimed between them, are still one before the other
  const r = await db.prepare(`SELECT (SELECT eg_mercy FROM players WHERE id = ?2) AS m,
      EXISTS (SELECT 1 FROM eg_stakes WHERE account = ?2 AND rh = 0 AND state != 'returned' AND rowid < (SELECT rowid FROM eg_stakes WHERE ez = ?1)) AS before`)
    .bind(ez, stake.account).first();
  return int(r?.m) === 0 && int(r?.before) === 0;
}

/**
 * EG-ZM (section 23, "The clock"): THE STAKE'S CLOCK, ONE PAGE - at most `limit` stakes still `held` EG_STAKE_CLOCK_S past
 * their `until`, the oldest first, asked in one statement (a quiet world's hour asks no more), then spent in one
 * transaction with their openers' letters (EG_STAKE_POST - a key's stake alone, EG_STAKE_POST_HELD's words where its opener's
 * own end held it for the first breach's mercy - AUDIT EG IV; INSERT OR IGNORE over 0093's one-a-batch
 * index, so a letter already there never holds the clock), each only while it is still held - a receipt claimed between
 * the ask and the spending settles it its own way. The key is not given back: a spent stake's key stays taken. Answers how
 * many it spent (cron.js asks again while a page is full).
 * @param {any} db @param {number} nowS @param {number} limit
 */
export async function spendLapsedStakes(db, nowS, limit) {
  const due = (await db.prepare("SELECT ez FROM eg_stakes WHERE state = 'held' AND until <= ?1 ORDER BY until, ez LIMIT ?2").bind(nowS - EG_STAKE_CLOCK_S, limit).all()).results ?? [];
  if (!due.length) return 0;
  const ez = JSON.stringify(due.map((r) => r.ez));
  const [, spent] = await db.batch([
    // AUDIT EG IV (lane3 #6): a stake its opener's own end held for the mercy (that end's row on eg_runs) says so
    db.prepare(`INSERT OR IGNORE INTO server_post (id, to_id, batch, sender, subject, body, item, sent_at)
      SELECT lower(hex(randomblob(12))), account, ?2 || ez, ?3, ?4, replace(CASE WHEN EXISTS (SELECT 1 FROM eg_runs r WHERE r.b = eg_stakes.b AND r.account = eg_stakes.account) THEN ?7 ELSE ?5 END, '{day}', strftime('%Y-%m-%d', at, 'unixepoch')), NULL, ?6
      FROM eg_stakes WHERE state = 'held' AND rh = 0 AND ez IN (SELECT value FROM json_each(?1))`).bind(ez, EG_STAKE_POST.batch, POST_SENDER, EG_STAKE_POST.subject, EG_STAKE_POST.body, nowS, EG_STAKE_POST_HELD.body),
    db.prepare("UPDATE eg_stakes SET state = 'spent' WHERE state = 'held' AND ez IN (SELECT value FROM json_each(?1))").bind(ez),
  ]);
  return Number(spent?.meta?.changes ?? 0);
}

/**
 * THE CLAIM: an `e1` receipt verified with the relay's public half and naming `player`. Answers `{ recorded, q, ...,
 * keys }` (`recorded` false with `why: 'claimed'` for one already counted, `why: 'guest'` for a guest), or `{ error }` -
 * `no-gate-key`, `receipt` (`why` the rung), `not-yours`. EG-E1: a Redoubt's says what it paid (egEconomy.js egRedoubtPay
 * - `paid`, `marks`, `deed`, `embers`, `purse`, `weir`, `pity`; `again` for one already counted), an end's the Reliquaries
 * it opens (`rl`); `env` the service's (the Marks' switch), `character` the claiming character (its guild's deed).
 * EG-E2: a `w` that grants an honour the account did not hold says it - `honours`, the titles (egHonours.js
 * egHonoursAnswer).
 * @param {{ db: any, nowS: number, subtle: SubtleCrypto, rand: (b: Uint8Array) => Uint8Array }} ctx
 * @param {{ id: string, handle?: string|null }} player @param {unknown} receipt @param {CryptoKey|null} publicKey
 * @param {{ env?: any, character?: string|null }} [pay]
 */
export async function claimEg({ db, nowS, subtle, rand }, player, receipt, publicKey, { env = null, character = null } = {}) {
  if (!publicKey) return { error: 'no-gate-key' };
  const v = await verifyEgReceipt(receipt, publicKey, { subtle, nowS });
  if (!v.ok) return { error: 'receipt', why: v.why };
  const c = v.claims;
  if (c.s !== player.id) return { error: 'not-yours' };
  if (!player.handle) return { recorded: false, why: 'guest', q: c.q };
  let recorded = false, said = {}, honours = {};
  if (c.q === 'w') {
    // EG-E1: the row written with the week's pay, and the pay's statements in this batch (egEconomy.js)
    const pay = await egRedoubtPay({ db, nowS, rand }, player, c, { env, character, draw: (p) => drawUnder(rand, p) });
    const [row, , ...paid] = await db.batch([
      pay.row,
      spendStake(db, c.z),   // the stake is spent by the breach's first Redoubt
      ...pay.statements,
      ...egHonourStatements(db, player, c, nowS),   // EG-E2: the lord's feats kept (egHonours.js)
      ...egReceiptRest(db, player, c),   // EG-ZA: the share dealt and the circle's measures on the row
    ]);
    recorded = Number(row?.meta?.changes ?? 0) > 0;
    said = await pay.answer(recorded, paid.slice(0, pay.statements.length));   // the pay's own results (the honours' follow them)
    honours = await egHonoursAnswer(db, player, c);   // EG-E2: the honours it grants, written on the row; the new ones answered
  } else if (c.q === 'x') {
    // the stake (section 23): a void gives it back - AUDIT EG III (lane3 #1): held, or spent by the breach's Redoubts;
    // the first breach's mercy gives it back once ever - AUDIT EG III (lane3 #6): only on the relay's word that the BREACH
    // ended with no Redoubt taken (`nr`, on every end its end owes - net/eliteGates/egBrain.js oweEnd), whichever member's end carries
    // it (the opener's own may have come first, a fall or a forsaking while the company played on); the opener's end
    // without that word holds the stake for it while the mercy may still be paid (a Redoubt's receipt spends it, the
    // stake's clock at the last), and spends it otherwise; any other member's end settles nothing
    const stake = await db.prepare('SELECT account, state, rh FROM eg_stakes WHERE ez = ?1').bind(c.z).first();
    let settle = [];
    if (c.why === 'void') { if (stake?.state === 'held' || stake?.state === 'spent') settle = returnStake(db, c.z); }
    else if (stake?.state === 'held' && (c.nr === 1 || stake.account === player.id)) {
      const may = await mercyMay(db, c.z, stake);
      settle = may && c.nr === 1 ? returnStake(db, c.z, true) : may ? [] : [spendStake(db, c.z)];
    }
    const [row] = await db.batch([
      // AUDIT EG V (lane8 L8-5): the row's own draw (`nonce`) - the end's Reliquaries roll on the receipt's seed mixed with it
      db.prepare('INSERT OR IGNORE INTO eg_runs (b, account, h, why, t, at, nonce) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)').bind(c.b, player.id, c.h, c.why, c.t, nowS, hex(rand(new Uint8Array(8)))),
      db.prepare('UPDATE players SET eg_live_b = NULL, eg_live_until = 0 WHERE id = ?1 AND eg_live_b = ?2').bind(player.id, c.b),
      ...settle,
      ...egHonourStatements(db, player, c, nowS),   // EG-E2: the end as the boards rank it, the Annals' pages kept (egHonours.js)
      ...egReceiptRest(db, player, c),   // EG-ZA: the company, as the Descent keeps a company one row
    ]);
    recorded = Number(row?.meta?.changes ?? 0) > 0;
    said = { ...(await egReliquariesOf({ db, nowS }, player, c)), ...(await egStandingOf(db, player, c)), ...(await egEndSeedOf(db, player, c)) };   // EG-E1: the Reliquaries it opens, by the week's pay; EG-ZF: the member's standing - the recap's board line; AUDIT EG V (L8-5): the seed they roll on
  } else {
    // a void: the stake back (once - the stake's own state guards it; AUDIT EG III: held or spent) and the live breach
    // cleared; answered as recorded however often it is carried
    await db.batch([...returnStake(db, c.z), db.prepare('UPDATE players SET eg_live_b = NULL, eg_live_until = 0 WHERE id = ?1 AND eg_live_b = ?2').bind(player.id, c.b)]);
    recorded = true;
  }
  if (recorded && c.q !== 'v') egBoardsMoved();   // AUDIT EG III (lane3 #18): a Redoubt or an end moved the boards this Worker keeps
  const keys = int((await playerRow(db, player.id))?.eg_keys);
  return recorded ? { recorded: true, q: c.q, b: c.b, ...(c.q === 'w' ? { w: c.w } : {}), keys, ...said, ...honours } : { recorded: false, why: 'claimed', q: c.q, keys, ...said, ...honours };
}

/** AUDIT EG V (lane8 L8-5; section 16.3): AN END'S SPOILS SEED - its receipt's `c` mixed with the draw its row keeps
 *  (net/eliteGates/egPay.js egSpoilsSeed), `{ seed }`; `{}` with no row (a guest's end writes none). */
async function egEndSeedOf(db, player, c) {
  const r = await db.prepare('SELECT nonce FROM eg_runs WHERE b = ?1 AND account = ?2').bind(c.b, player.id).first();
  return r ? { seed: egSpoilsSeed(c.c, r.nonce) } : {};
}

/**
 * THE KEY ROLLED AT A CLAIM THE SERVICE ALREADY VERIFIED (section 5) - a recorded Hour ('sd': one in three), after its row.
 * The draw is this service's own (`rand` - nothing the page can read). Answers `{ found, keys }`. AUDIT EG IV (lane3 #16):
 * a Dagon's Breach kill's key is rolled here no longer, after its claim - it rides the claim's own batch (egGateWeir).
 * @param {{ db: any, rand?: (b: Uint8Array) => Uint8Array }} ctx @param {{ id: string }} player
 * @param {{ kind: 'sd' }} what
 */
export async function rollWeirKey({ db, rand }, player, { kind }) {
  const found = kind === 'sd' && drawUnder(rand, EG_KEY_ODDS_SD);
  const after = await db.prepare('UPDATE players SET eg_keys = eg_keys + ?2 WHERE id = ?1 RETURNING eg_keys').bind(player.id, found ? 1 : 0).first();
  return { found, keys: int(after?.eg_keys) };
}
/**
 * AUDIT EG IV (lane3 #16; section 5): A DAGON'S BREACH KILL'S WEIR KEY, IN ITS CLAIM'S OWN BATCH - the statement accounts.js
 * claimGate sets directly after its `gate_kills` INSERT OR IGNORE, for a verified receipt's claims `c` (never the rite's):
 * - written only by the claim that wrote that row (`changes()`, the INSERT's) and in its transaction, so a failure between
 *   them can no longer lose the roll (the account's certain first key among them), and a claim asked again rolls nothing;
 * - THE FIRST decided by that row: no recorded kill of the account's before it in the table's own order (its rowid, as
 *   mercyMay decides "before") - two receipts claimed at once each counted the other's row and neither was the first;
 * - one in six (one in four for a fighter who broke the rite, `r`, and WB14g for a portent night's receipt, `p`), this service's die drawn before the batch; THE PITY
 *   after EG_KEY_PITY recorded kills in a row with none (`eg_key_miss`, reset by a key).
 * RETURNING the balance and the misses after it - a key found leaves none (egGateWeirAnswer).
 * @param {{ db: any, rand?: (b: Uint8Array) => Uint8Array }} ctx @param {{ id: string }} player
 */
export function egGateWeir({ db, rand }, player) {
  const found = `(?3 = 1 OR eg_key_miss >= ?4 OR NOT EXISTS (SELECT 1 FROM gate_kills g WHERE g.account = ?1 AND g.earned != 'rite' AND g.rowid < (SELECT k.rowid FROM gate_kills k WHERE k.day = ?2 AND k.account = ?1)))`;
  return (/** @type {any} */ c) => db.prepare(`UPDATE players SET eg_keys = eg_keys + (CASE WHEN ${found} THEN 1 ELSE 0 END), eg_key_miss = CASE WHEN ${found} THEN 0 ELSE eg_key_miss + 1 END
    WHERE id = ?1 AND changes() > 0 RETURNING eg_keys, eg_key_miss`).bind(player.id, c.d, drawUnder(rand, c.r === 1 ? EG_KEY_ODDS_RITE : c.p > 0 ? EG_KEY_ODDS_PORTENT : EG_KEY_ODDS) ? 1 : 0, EG_KEY_PITY);   // WB14g: a portent night's at the rite's
}
/** AUDIT EG IV (lane3 #16): what egGateWeir's statement answered (its row - claimGate's `weirRow`), as the claim says it:
 *  `{ found, keys }` - a key found leaves no miss - or null where it rolled nothing. */
export const egGateWeirAnswer = (/** @type {any} */ row) => (row && Number.isSafeInteger(Number(row.eg_keys)) ? { found: int(row.eg_key_miss) === 0, keys: int(row.eg_keys) } : null);
/**
 * EG-E3: THE DUNGEON'S FIND (section 5) - an elite foe fallen in a dungeon online, asked by its killer's client with the
 * dungeon's tier (`{ tier }`, a key of EG_FIND_ODDS). The ask is counted before the die (a lost roll spends it too), at
 * most EG_FIND_PER_DAY a tier a real day; the die is this service's own at the tier's odds; a yes adds one to `eg_keys`
 * while the account's finds this arena week have paid fewer than EG_FIND_KEYS_PER_WEEK. Answers `{ found, keys, asks }`
 * (`asks` the tier's asks left today), or `{ error }`: `guest`, `tier` (not a tier), `unproven` (no gate closed, no
 * Redoubt taken - a fresh account cannot farm), `capped` (the tier's asks spent today - `keys` with it).
 * @param {{ db: any, nowS: number, rand?: (b: Uint8Array) => Uint8Array }} ctx
 * @param {{ id: string, handle?: string|null }} player @param {any} body
 */
export async function findEg({ db, nowS, rand }, player, body) {
  if (!player.handle) return { error: 'guest' };
  const tier = body?.tier;
  if (typeof tier !== 'string' || !Object.hasOwn(EG_FIND_ODDS, tier)) return { error: 'tier' };
  if (!(await proven(db, player.id))) return { error: 'unproven' };
  const day = utcDay(nowS), wk = arenaWeekOf(nowS);
  const ask = await db.prepare(`INSERT INTO eg_finds (account, day, tier, wk, asks, found) VALUES (?1, ?2, ?3, ?4, 1, 0)
    ON CONFLICT (account, day, tier) DO UPDATE SET asks = asks + 1 WHERE asks < ?5 RETURNING asks`).bind(player.id, day, tier, wk, EG_FIND_PER_DAY).first();
  if (!ask) return { error: 'capped', keys: int((await playerRow(db, player.id))?.eg_keys) };
  let found = false;
  if (drawUnder(rand, EG_FIND_ODDS[tier])) {
    // ONE TRANSACTION: the key and the find's mark together, each only while the week's finds are under the cap
    const [took] = await db.batch([
      db.prepare('UPDATE players SET eg_keys = eg_keys + 1 WHERE id = ?1 AND (SELECT COALESCE(SUM(found), 0) FROM eg_finds WHERE account = ?1 AND wk = ?2) < ?3 RETURNING eg_keys')
        .bind(player.id, wk, EG_FIND_KEYS_PER_WEEK),
      db.prepare('UPDATE eg_finds SET found = found + 1 WHERE account = ?1 AND day = ?2 AND tier = ?3 AND (SELECT COALESCE(SUM(found), 0) FROM eg_finds WHERE account = ?1 AND wk = ?4) < ?5')
        .bind(player.id, day, tier, wk, EG_FIND_KEYS_PER_WEEK),
    ]);
    found = !!took?.results?.[0];
  }
  return { found, keys: int((await playerRow(db, player.id))?.eg_keys), asks: EG_FIND_PER_DAY - int(ask.asks) };
}
/** One draw of this service's die under `p` - none without a die (a harness's ctx). */
function drawUnder(rand, p) {
  if (typeof rand !== 'function') return false;
  const d = rand(new Uint8Array(4));
  return (((d[0] << 24) | (d[1] << 16) | (d[2] << 8) | d[3]) >>> 0) / 4294967296 < p;
}
