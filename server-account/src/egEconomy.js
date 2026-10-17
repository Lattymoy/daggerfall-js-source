// @ts-check
// ═══════════════════════════════════════════════════════════════════
// EG-E1 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 19, REWARDS AND THE
// ECONOMY) — WHAT A REDOUBT PAYS, AS THE SERVICE PAYS IT, AND THE BROKER'S PANOPLY SINK.
//
// ═══ THE WEEK'S PAY ════════════════════════════════════════════════
//
// A Redoubt's number pays once an account an arena week (src/net/arena/arenaLaw.js arenaWeekOf): the account's first
// eg_redoubts row of that Redoubt in that week is PAID, and only a paid row pays - Marks, a guild's deed, embers, a
// Valkynaz's Weir Key and the Panoply's pity. Taken again that week the Redoubt pays its gold alone (the spoils the
// client rolls off the receipt's seed) and seals no Reliquary. A Rehearsal pays nothing at all. The row keeps what it
// paid (`paid`, `stones`, `forced`, `wkey`), so a receipt carried again - an answer lost - is answered the same pay,
// `again`.
//
// EVERYTHING IS DECIDED IN SQL, in claimEg's one batch (eg.js): the row's `paid` from the rows before it, its embers from
// the season's, its forced passes from the account's pity as the batch finds it; and every payment is written only while
// the row THIS claim stamped with its own nonce stands paid (marks.js CLAIM_GUARDS.eg - the service's draw, so a refused
// re-claim of the same receipt carries none). Two claims racing take one week's pay between them, never two.
//   MARKS - 20 (MARKS_FAUCETS.eg) under the day's combat cap with the gates', the raids' and the serpents' (marks.js
//     egStrikeStatement); its line `eg:<week>:<Redoubt>`, so the ledger's UNIQUE (actor, rid) holds it to once a week.
//   A GUILD'S DEED - three of one guild's accounts, each 7 days in it, on the same Redoubt of the same breach (the event
//     `eg:<breach>:<Redoubt>`), by the gate's law (marks.js deedStatements): 25 to the treasury, at most 4 a guild a day.
//   EMBERS - egEmbersOf(w, first this season) on the row (`stones`), in the purse the insignia and the sink spend
//     (accounts.js EMBERS_EARNED_SQL).
//   A VALKYNAZ'S WEIR KEY - at a paid Valkynaz's Redoubt, 1 in 4 by this service's own die (eg.js drawUnder - nothing the
//     page can read), at most one an account an arena week (`players.eg_valk_wk`).
//   THE PANOPLY'S PITY - `players.eg_pity`, the spoils passes in a row that drew no piece. Each pass of a paid receipt is
//     FORCED where the count stands at EG_PANOPLY_PITY (a piece; the count to 0); else a hit by its own draw (egPanoplyHit
//     - the stream the client rolls) sets it to 0 and a miss adds one. The answer names the forced passes (`pity`).
//
// ═══ THE RELIQUARIES ═══════════════════════════════════════════════
//
// A Reliquary is one more spoils roll (the client's, off the end receipt's seed), sealed only in a circle whose Redoubt
// pays this week (section 16.3) - and only the service knows which do. The member's end (`x`) names the circles whose
// Reliquaries it opens (`rl`, the relay's, one entry a Reliquary); the claim answers those of them that open. AUDIT EG V
// (lane8 L8-4): A CIRCLE'S RELIQUARIES OPEN ONCE AN ACCOUNT AN ARENA WEEK (`eg_reliqs`) - a circle whose Redoubt the
// breach never recorded opened while no row of it stood paid, so a member who held their Redoubt receipts back opened
// every circle's Reliquaries at every breach's end that week.
//
// ═══ THE SINK ══════════════════════════════════════════════════════
//
// The Sigil Broker sells one Panoply piece of the buyer's choosing (EG_PANOPLY_IDS), once an account an arena week, for
// EG_SINK_EMBERS out of the insignia's purse: ONE conditional UPDATE spends it (the insignia's way - accounts.js
// buyInsignia) where the purse covers it and no piece was bought this week, and the week's row (`eg_sink`) is written by
// that write alone. The client takes the embers from the pack and mints the piece (systems/sigil/sigilBroker.js panoplySale).
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═══════════════════════════════════════════════════════════════════

import { arenaWeekOf, arenaSeasonOf, arenaSeasonEndsS, ARENA_SEASON_S } from '../../src/net/arena/arenaLaw.js';
import { egValkRedoubt, egSpoilsPasses, egPanoplyHit, egEmbersOf, egSpoilsSeed, EG_PANOPLY_PITY, EG_VALK_KEY_ODDS, EG_SINK_EMBERS, EG_PANOPLY_IDS } from '../../src/net/eliteGates/egPay.js';
import { egStrikeStatement, egStrikeAnswer, deedStatements, deedEvent, deedAnswer } from './marks.js';
import { EMBERS_EARNED_SQL } from './accounts.js';

const int = (v) => (Number.isSafeInteger(Number(v)) ? Number(v) : 0);
const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
/** The most Reliquaries an end receipt names (net/eliteGates/egBrain.js oweEnd's own slice). */
const RL_MAX = 64;

/** The first arena week of the season holding `nowS`: a Redoubt is the account's first this season when no row of it was
 *  paid since. */
export const egSeasonWeek0 = (nowS) => arenaWeekOf(arenaSeasonEndsS(arenaSeasonOf(nowS)) - ARENA_SEASON_S);

/** The insignia's purse, as the row stands now: every ember earned less what the insignia and the sink cost. */
async function purseOf(db, id) {
  const r = await db.prepare(`SELECT MAX(0, ${EMBERS_EARNED_SQL} - insignia_spent) AS n FROM players WHERE id = ?1`).bind(id).first();
  return int(r?.n);
}

/**
 * THE PITY, IN SQL - for a receipt's passes whose own draws hit as `hits`, over the pity count `count` (SQL): `forced`
 * the bits of the passes the count forces (a bit a pass), `after` the count after them all.
 * @param {string} count @param {boolean[]} hits
 */
function pitySql(count, hits) {
  let n = count;
  const forced = [];
  hits.forEach((hit, p) => {
    forced.push(`(CASE WHEN ${n} >= ${EG_PANOPLY_PITY} THEN ${1 << p} ELSE 0 END)`);
    n = hit ? '0' : `(CASE WHEN ${n} >= ${EG_PANOPLY_PITY} THEN 0 ELSE ${n} + 1 END)`;
  });
  return { forced: forced.join(' + '), after: n };
}

/**
 * WHAT A REDOUBT'S `w` RECEIPT PAYS - its row and its pay's statements for claimEg's one batch, and the answer once the
 * batch has run. `c` the verified claims; `env` the service's (the Marks' switch); `character` the claiming character
 * (its guild's deed); `draw(p)` this service's die under `p` (eg.js drawUnder). Answers `{ row, statements, answer }`:
 * the row's INSERT (the batch's first), the pay's statements (after the stake's), and `answer(recorded, results)` -
 * `results` the batch's results from the first of `statements` - which reads the row back and says `{ b, w, paid,
 * again?, marks, deed, embers, purse, weir, pity }` (each null, 0 or empty where it does not apply).
 * @param {{ db: any, nowS: number, rand: (b: Uint8Array) => Uint8Array }} ctx
 * @param {{ id: string, handle?: string|null }} player @param {any} c
 * @param {{ env?: any, character?: string|null, draw?: (p: number) => boolean }} [opts]
 */
export async function egRedoubtPay({ db, nowS, rand }, player, c, { env = null, character = null, draw = () => false } = {}) {
  const ctx = { db, nowS };
  const b = c.b, w = c.w, week = arenaWeekOf(nowS), payable = c.rh === 1 ? 0 : 1;
  const nonce = hex(rand(new Uint8Array(8)));
  // AUDIT EG V (lane8 L8-5): the spoils roll on the receipt's seed mixed with this claim's own draw (net/eliteGates/egPay.js
  // egSpoilsSeed) - the pity reads the passes the client will roll on it
  const hits = Array.from({ length: egSpoilsPasses(w) }, (_, p) => egPanoplyHit(egSpoilsSeed(c.c, nonce), w, p));
  // THE ROW: paid where the account has no paid row of this Redoubt this week (never a Rehearsal's); its embers a first
  // this season's where no row of it was paid since the season's first week; its forced passes off the pity as it stands
  const row = db.prepare(`INSERT OR IGNORE INTO eg_redoubts (b, account, w, h, t, at, wk, paid, stones, nonce, forced)
    SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, q.paid,
      CASE WHEN q.paid = 0 THEN 0 WHEN NOT EXISTS (SELECT 1 FROM eg_redoubts WHERE account = ?2 AND w = ?3 AND paid = 1 AND wk >= ?10) THEN ?11 ELSE ?12 END,
      ?8, CASE WHEN q.paid = 1 THEN ${pitySql('(SELECT eg_pity FROM players WHERE id = ?2)', hits).forced} ELSE 0 END
    FROM (SELECT CASE WHEN ?9 = 1 AND NOT EXISTS (SELECT 1 FROM eg_redoubts WHERE account = ?2 AND w = ?3 AND wk = ?7 AND paid = 1) THEN 1 ELSE 0 END AS paid) q`)
    .bind(b, player.id, w, c.h, c.t, nowS, week, nonce, payable, egSeasonWeek0(nowS), egEmbersOf(w, true), egEmbersOf(w, false));
  /** @type {any[]} */
  const statements = [];
  /** @type {Record<string, number>} */
  const at = {};
  const add = (k, st) => { if (st) { at[k] = statements.length; statements.push(st); } };
  const event = deedEvent('eg', `${b}:${w}`);
  if (payable) {
    // THE ROW THIS CLAIM WROTE, PAID - what every payment below is written under (?1 the breach, ?2 the account, ?3 the
    // Redoubt, ?4 the nonce)
    const mine = 'EXISTS (SELECT 1 FROM eg_redoubts WHERE b = ?1 AND account = ?2 AND w = ?3 AND nonce = ?4 AND paid = 1)';
    add('marks', egStrikeStatement(ctx, player, env, week, b, w, nonce));
    const deed = deedStatements(ctx, player, env, { kind: 'eg', event, character, guard: [b, w, nonce] });
    if (deed) { add('mark', deed[0]); add('deed', deed[1]); }
    add('pity', db.prepare(`UPDATE players SET eg_pity = ${pitySql('eg_pity', hits).after} WHERE id = ?2 AND ${mine}`).bind(b, player.id, w, nonce));
    // A VALKYNAZ'S KEY, drawn: the row marked only while the week has given the account none when the batch runs, and
    // the key counted (the week with it) only by the row so marked - two Valkynaz's Redoubts claimed at once find one key
    // between them
    if (egValkRedoubt(w) && draw(EG_VALK_KEY_ODDS)) {
      add('wkey', db.prepare(`UPDATE eg_redoubts SET wkey = 1 WHERE b = ?1 AND account = ?2 AND w = ?3 AND nonce = ?4 AND paid = 1
        AND EXISTS (SELECT 1 FROM players WHERE id = ?2 AND eg_valk_wk != ?5)`).bind(b, player.id, w, nonce, week));
      add('key', db.prepare(`UPDATE players SET eg_keys = eg_keys + 1, eg_valk_wk = ?5 WHERE id = ?2
        AND EXISTS (SELECT 1 FROM eg_redoubts WHERE b = ?1 AND account = ?2 AND w = ?3 AND nonce = ?4 AND wkey = 1)`).bind(b, player.id, w, nonce, week));
    }
  }
  /** @param {boolean} recorded @param {any[]} results */
  const answer = async (recorded, results) => {
    const r = await db.prepare('SELECT wk, paid, stones, forced, wkey, nonce FROM eg_redoubts WHERE b = ?1 AND account = ?2 AND w = ?3').bind(b, player.id, w).first();
    const me = await db.prepare(`SELECT eg_keys, MAX(0, ${EMBERS_EARNED_SQL} - insignia_spent) AS purse FROM players WHERE id = ?1`).bind(player.id).first();
    const paid = int(r?.paid) === 1;
    const wrote = (k) => at[k] !== undefined && Number(results?.[at[k]]?.meta?.changes ?? 0) > 0;
    return {
      b, w, paid, ...(recorded ? {} : { again: true }),
      // a claim asked again says the week's line as it stands - the strike this receipt's row made, if it made one
      marks: paid ? await egStrikeAnswer(ctx, player, env, recorded ? wrote('marks') : true, int(r?.wk), w) : null,
      deed: recorded && at.deed !== undefined ? await deedAnswer(db, player, event, wrote('deed')) : null,
      embers: int(r?.stones), purse: int(me?.purse),
      seed: egSpoilsSeed(c.c, r?.nonce),   // AUDIT EG V (lane8 L8-5): what the spoils roll on - the row's own claim's draw
      weir: paid && egValkRedoubt(w) ? { found: int(r?.wkey) === 1, keys: int(me?.eg_keys) } : null,
      pity: hits.map((_, p) => p).filter((p) => (int(r?.forced) & (1 << p)) !== 0),
    };
  };
  return { row, statements, answer };
}

/**
 * THE RELIQUARIES AN END OPENS (section 16.3) - of those the member's end names (`rl`: a circle's number a Reliquary,
 * the relay's), the ones whose circle pays this week for this account: its Redoubt's row in this breach paid, or - a
 * circle whose Redoubt this breach never recorded - none of it paid this arena week. AUDIT EG V (lane8 L8-4): and no other
 * end of the account's opened that circle's this week - the first end's claim that opens a circle writes it (`eg_reliqs`,
 * one row an account, week and circle, INSERT OR IGNORE: two claims at once open it once), and an end answers the circles
 * written in its own name; an end claimed again answers the circles it opened. `{ rl }`, or `{}` for an end that names
 * none.
 * @param {{ db: any, nowS: number }} ctx @param {{ id: string }} player @param {any} c
 */
export async function egReliquariesOf({ db, nowS }, player, c) {
  if (!Array.isArray(c?.rl)) return {};
  if (c.rh === 1) return { rl: [] };
  const named = c.rl.slice(0, RL_MAX).filter((w) => Number.isSafeInteger(w) && w >= 1 && w <= 19_999);
  if (!named.length) return { rl: [] };
  const opened = async () => new Set(((await db.prepare('SELECT w FROM eg_reliqs WHERE account = ?1 AND b = ?2').bind(player.id, c.b).all())?.results ?? []).map((r) => int(r.w)));
  let mineOpen = await opened();
  if (!mineOpen.size) {
    const here = await db.prepare('SELECT w, paid FROM eg_redoubts WHERE b = ?1 AND account = ?2').bind(c.b, player.id).all();
    const wk = arenaWeekOf(nowS);
    const week = await db.prepare('SELECT DISTINCT w FROM eg_redoubts WHERE account = ?1 AND wk = ?2 AND paid = 1').bind(player.id, wk).all();
    const mine = new Map((here?.results ?? []).map((r) => [int(r.w), int(r.paid) === 1]));
    const paidWeek = new Set((week?.results ?? []).map((r) => int(r.w)));
    const pays = [...new Set(named.filter((w) => (mine.has(w) ? mine.get(w) : !paidWeek.has(w))))];
    if (pays.length) await db.batch(pays.map((w) => db.prepare('INSERT OR IGNORE INTO eg_reliqs (account, wk, w, b) VALUES (?1, ?2, ?3, ?4)').bind(player.id, wk, w, c.b)));
    mineOpen = await opened();
  }
  return { rl: named.filter((w) => mineOpen.has(w)) };
}

/**
 * THE WEEK'S SINK - `{ week, piece }`: this arena week, and the Panoply piece the account bought from the Broker in it
 * (null: none yet). `/v1/eg/keys` carries it, so a client whose sale's answer was lost asks whether it holds.
 * @param {{ db: any, nowS: number }} ctx @param {{ id: string }} player
 */
export async function egSinkOf({ db, nowS }, player) {
  const week = arenaWeekOf(nowS);
  const r = await db.prepare('SELECT piece FROM eg_sink WHERE account = ?1 AND wk = ?2').bind(player.id, week).first();
  return { week, piece: typeof r?.piece === 'string' ? r.piece : null };
}

/**
 * THE BROKER'S PANOPLY SINK - one piece of the buyer's choosing (`body.piece`, one of EG_PANOPLY_IDS), once an account an
 * arena week, for EG_SINK_EMBERS out of the purse the insignia spend. Answers `{ ok, piece, week, purse }` (the purse
 * after), or `{ error }`: `guest` (a guest row is one storage clear from gone - the insignia's reasoning), `piece` (not a
 * Panoply piece), `bought` (this week's taken - `piece` which), `short` (`purse` and `price`).
 * @param {{ db: any, nowS: number }} ctx @param {{ id: string, handle?: string|null }} player @param {any} body
 */
export async function egSink({ db, nowS }, player, body) {
  if (!player?.handle) return { error: 'guest' };
  const piece = body?.piece;
  if (typeof piece !== 'string' || !EG_PANOPLY_IDS.includes(piece)) return { error: 'piece' };
  const week = arenaWeekOf(nowS);
  // ONE STATEMENT DECIDES: the price spent where the purse covers it and the week has no piece yet - and the week's row
  // written by that write alone (two sales pressed at once spend once and take one piece)
  const [took] = await db.batch([
    db.prepare(`UPDATE players SET insignia_spent = insignia_spent + ?3, last_seen = ?4
      WHERE id = ?1
        AND NOT EXISTS (SELECT 1 FROM eg_sink WHERE account = ?1 AND wk = ?2)
        AND ${EMBERS_EARNED_SQL} - insignia_spent >= ?3
      RETURNING insignia_spent`).bind(player.id, week, EG_SINK_EMBERS, nowS),
    db.prepare('INSERT INTO eg_sink (account, wk, piece, at) SELECT ?1, ?2, ?3, ?4 WHERE changes() > 0').bind(player.id, week, piece, nowS),
  ]);
  if (!took?.results?.[0]) {
    const had = await egSinkOf({ db, nowS }, player);
    if (had.piece) return { error: 'bought', piece: had.piece };
    return { error: 'short', purse: await purseOf(db, player.id), price: EG_SINK_EMBERS };
  }
  return { ok: true, piece, week, purse: await purseOf(db, player.id) };
}
