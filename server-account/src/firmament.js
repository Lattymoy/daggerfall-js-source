// @ts-check
// ═══════════════════════════════════════════════════════════════════
// FIRM1 (2026-10-13) - THE FIRMAMENT, AS THE SERVICE KEEPS IT: a character's passive tree (migration 0114), its two
// purses read off what this service already holds - the Renown track (renownTracks.js) for Stars, the profession
// tracks (professions.js) for Craft points - and every change judged by the one law both ends read
// (src/net/firmament/firmamentLaw.js). The record is bible/06-Systems/Firmament.md.
//
// WHOSE WORD. Nothing a client says about its tree is believed: a change names the WHOLE tree it wants, and the law
// asks it here against the purses this service counts - a star the sky has not, a star not joined to its start, more
// stars than the purses pay for, are refused. What the tree then does in a fight is the client's (as every blow online
// is), held inside the law's budget; what it does to a harvest - its yield and its XP - is done HERE, on the service's
// own dice (professions.js harvestNode reads firmStatement in the harvest's own round trip).
//
// A REFUND COSTS SILVER (firmamentLaw.js refundSilver: free below Renown 10, then 10 a star) - Marks, the one currency a
// client cannot print, burnt in the change's own batch. A change is one request with its own id: asked twice it is
// answered from its row and charged once, and a change made over a tree another change already replaced is refused
// ('firm-stale'), never laid over it.
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═══════════════════════════════════════════════════════════════════

import { mintId, overRate } from './accounts.js';
import { prepareRealmRecord, realmActFirst, recordMovedOf, mustChange, dropObjects, dropIfUnnamed } from './realm.js';   // the respec's gold, on a realm character's record
import { payFromSave } from '../../src/net/realm/realmGoldLaw.js';
import { isDeveloper } from './titles.js';
import { marksOpenFor, balanceOf } from './marks.js';
import { renownTrackOf, renownCharacterOk } from './renownTracks.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { rankOfXp, PROFESSIONS } from '../../src/net/professionLaw.js';
import {
  starsFor, craftPointsFor, treeFault, unpackTree, packTree, treeDiff, refundSilver, treeStats, pointsLeft, cleanKeys,
  FIRM_RID_RE, REFUND_FREE_BELOW_RENOWN, REFUND_SILVER_PER_STAR, FIRM_RESPEC_GOLD,
} from '../../src/net/firmament/firmamentLaw.js';

/** The switch the service's config holds (FIRMAMENT_OPEN): off, dev (the developers alone), on. */
export const FIRM_SWITCH = Object.freeze(['off', 'dev', 'on']);
export const firmSwitchOf = (v) => (FIRM_SWITCH.includes(v) ? v : 'off');
/** Whether the Firmament is open to this account: the switch, and at `dev` the developers alone. */
export function firmamentOpenFor(player, env) {
  const s = firmSwitchOf(env?.FIRMAMENT_OPEN);
  return s === 'on' || (s === 'dev' && isDeveloper(player, env));
}
/** The changes an account may make an hour - a careful player re-plans a handful of times; a script, many. */
export const FIRM_OPS_MAX = 120;
export const FIRM_OPS_WINDOW_S = 3600;
/** The longest packed tree a request may carry (every star's key, with room). */
export const FIRM_PACKED_MAX = 16_384;

/** The statement that reads a character's tree - read in another act's own round trip (a harvest's). */
export const firmStatement = (db, playerId, charId) => db.prepare('SELECT tree FROM firmament WHERE player = ?1 AND char_id = ?2').bind(playerId, charId);
/** The capped stats a tree row gives (none for no row): what a harvest's yield and XP read. AUDIT UICALM-FIRM1 L2 M4:
 *  none while the Firmament is shut to this account - the switch is the tree's whole hand, its words and its trades. */
export const firmStatsFrom = (row, player, env) => (firmamentOpenFor(player, env) ? treeStats(unpackTree(row?.tree ?? '')) : {});
/** A character's capped stats, read on their own (none while the switch shuts it, as firmStatsFrom). */
export async function firmStatsOf(db, player, env, charId) {
  return firmStatsFrom(await firmStatement(db, player.id, charId).first(), player, env);
}

/** A character's purses as this service counts them: `{ renown, stars, craft, ranks }`. */
async function pursesOf(ctx, playerId, charId) {
  const [track, profs] = await Promise.all([
    renownTrackOf(ctx, playerId, charId),
    ctx.db.prepare('SELECT profession, xp FROM prof_tracks WHERE player = ?1 AND char_id = ?2').bind(playerId, charId).all(),
  ]);
  const known = new Set(PROFESSIONS.map((p) => p.id));
  /** @type {Record<string, number>} */
  const ranks = {};
  for (const r of profs?.results ?? []) if (known.has(r.profession)) ranks[r.profession] = rankOfXp(Number(r.xp ?? 0));
  const renown = track?.level ?? 1;
  return { renown, stars: starsFor(renown), craft: craftPointsFor(Object.values(ranks)), ranks };
}

/** What the window reads: the tree, the purses and what is left in them, and the refund's price. */
function view(tree, purses, extra = {}) {
  return {
    tree: packTree(tree), renown: purses.renown, stars: purses.stars, craft: purses.craft, ranks: purses.ranks,
    left: pointsLeft(tree.keys, purses.stars, purses.craft),
    refund: { freeBelow: REFUND_FREE_BELOW_RENOWN, perStar: REFUND_SILVER_PER_STAR, respecGold: FIRM_RESPEC_GOLD },
    ...extra,
  };
}

const shut = (player, env) => (firmamentOpenFor(player, env) ? null : { error: 'firm-closed' });

/** POST /v1/firmament/state { character } -> the window's view. */
export async function firmamentState(ctx, player, env, body = {}) {
  const character = body?.character;
  if (!renownCharacterOk(character)) return { error: 'firm-character' };
  const closed = shut(player, env);
  if (closed) return closed;
  const [row, purses] = await Promise.all([firmStatement(ctx.db, player.id, character).first(), pursesOf(ctx, player.id, character)]);
  return view(unpackTree(row?.tree ?? ''), purses);
}

/**
 * POST /v1/firmament/set { character, tree, rid } - THE WHOLE TREE THE CHARACTER WANTS (`tree` packed), under the
 * request's id. Answers the view, with `silver` the refunds burnt and `balance` after them where any were; `repeat` for
 * a request already made. Refusals: 'firm-character', 'firm-rid', 'firm-closed', 'firm-rate', the law's (firm-start,
 * firm-key, firm-path, firm-points), 'marks-closed' and 'marks-short' (a refund to pay and no silver to pay it),
 * 'firm-stale' (another change landed first - the client reads again).
 */
export async function setFirmament(ctx, player, env, body = {}) {
  const { db, nowS, rand } = ctx;
  if (!Number.isSafeInteger(nowS)) throw new TypeError('setFirmament needs an integer epoch-seconds clock');
  const { character, rid } = body ?? {};
  if (!renownCharacterOk(character)) return { error: 'firm-character' };
  if (typeof rid !== 'string' || !FIRM_RID_RE.test(rid)) return { error: 'firm-rid' };
  const prior = await db.prepare('SELECT char_id, tree, silver FROM firmament_sets WHERE player = ?1 AND rid = ?2').bind(player.id, rid).first();
  if (prior) {
    if (prior.char_id !== character) return { error: 'firm-rid' };
    // AUDIT UICALM-FIRM1 L2 M2: AN ID NAMES ONE TREE - another tree asked under a made change's id is refused, never
    // answered as that change's repeat (the newer tree would be told it landed and never be made)
    if (typeof body.tree !== 'string' || packTree(unpackTree(body.tree)) !== String(prior.tree ?? '')) return { error: 'firm-rid' };
    const purses = await pursesOf(ctx, player.id, character);
    const now = await firmStatement(db, player.id, character).first();
    return view(unpackTree(now?.tree ?? ''), purses, { repeat: true, silver: Number(prior.silver) });
  }
  const closed = shut(player, env);
  if (closed) return closed;
  if (typeof body.tree !== 'string' || body.tree.length > FIRM_PACKED_MAX) return { error: 'firm-key' };
  // the law reads the request's own list (a key twice, a start among the stars, a key the sky has not: refused, never
  // quietly cleaned into something the player did not ask for)
  const bar = body.tree.indexOf('|');
  const want = body.tree === '' ? { start: null, keys: [] }
    : { start: bar < 0 ? body.tree : body.tree.slice(0, bar), keys: bar < 0 || bar === body.tree.length - 1 ? [] : body.tree.slice(bar + 1).split(',') };
  if (await overRate(ctx, `firm:${player.id}`, FIRM_OPS_MAX, FIRM_OPS_WINDOW_S)) return { error: 'firm-rate' };
  const [row, purses] = await Promise.all([firmStatement(db, player.id, character).first(), pursesOf(ctx, player.id, character)]);
  const fault = treeFault(want, purses.stars, purses.craft);
  if (fault) return { error: fault };
  const next = { start: want.start ?? null, keys: cleanKeys(want.keys) };
  const prevPacked = String(row?.tree ?? '');
  const prev = unpackTree(prevPacked);
  const nextPacked = packTree(next);
  if (nextPacked === packTree(prev)) return view(prev, purses);   // already so
  // WHAT IS TAKEN BACK: every star the change removes - choosing a first sign takes nothing back
  const { removed } = treeDiff(prev, next);
  const silver = refundSilver(prev.start ? removed.length : 0, purses.renown);
  if (silver > 0 && !marksOpenFor(player, env)) return { error: 'marks-closed' };
  const nonce = mintId(rand);
  const stillPrev = 'COALESCE((SELECT tree FROM firmament WHERE player = ?1 AND char_id = ?2), \'\') = ?3';
  await db.batch([
    // THE REFUND'S SILVER, burnt only while the tree is still the one the change was made over and the balance holds
    // it; a plain INSERT, the id's line refused in the statement (AUDIT 30 S4's rule: an OR IGNORE swallows the
    // balance trigger's CHECK)
    ...(silver > 0 ? [db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'account', ?1, 'burn', NULL, 'firmament', ?4, ?5, ?6, ?1, ?2, ?7
      WHERE COALESCE((SELECT balance FROM marks WHERE account = ?1), 0) >= ?4
        AND ${stillPrev}
        AND NOT EXISTS (SELECT 1 FROM marks_ledger WHERE actor = ?1 AND rid = ?7)
        AND NOT EXISTS (SELECT 1 FROM firmament_sets WHERE player = ?1 AND rid = ?8)`)
      .bind(player.id, character, prevPacked, silver, utcDay(nowS), nowS, `firm:${rid}`, rid)] : []),
    // THE CHANGE'S ROW: over the same tree, and paid where it had a price
    db.prepare(`INSERT OR IGNORE INTO firmament_sets (player, rid, char_id, prev, tree, silver, at, n)
      SELECT ?1, ?4, ?2, ?3, ?5, ?6, ?7, ?8
      WHERE ${stillPrev}
        AND (?6 = 0 OR EXISTS (SELECT 1 FROM marks_ledger WHERE actor = ?1 AND rid = ?9 AND kind = 'firmament'))`)
      .bind(player.id, character, prevPacked, rid, nextPacked, silver, nowS, nonce, `firm:${rid}`),
    // THE TREE, by the change's own row
    db.prepare(`INSERT INTO firmament (player, char_id, tree, updated_at)
      SELECT ?1, ?2, ?3, ?4 FROM firmament_sets WHERE player = ?1 AND rid = ?5 AND n = ?6
      ON CONFLICT (player, char_id) DO UPDATE SET tree = excluded.tree, updated_at = excluded.updated_at`)
      .bind(player.id, character, nextPacked, nowS, rid, nonce),
  ]);
  const made = await db.prepare('SELECT n, char_id, silver FROM firmament_sets WHERE player = ?1 AND rid = ?2').bind(player.id, rid).first();
  if (made?.n === nonce) {
    return view(next, purses, { silver, ...(silver > 0 ? { balance: await balanceOf(db, player.id) } : {}) });
  }
  if (made) return made.char_id === character ? setFirmament(ctx, player, env, body) : { error: 'firm-rid' };   // another request of the same id won the race: answered as its repeat
  if (silver > 0 && (await balanceOf(db, player.id)) < silver) return { error: 'marks-short', silver };
  return { error: 'firm-stale' };
}

/**
 * POST /v1/firmament/respec { character, rid, realm?, region? } - THE WHOLE SKY TAKEN BACK for FIRM_RESPEC_GOLD gold: every
 * star and the birthsign, to choose again. A realm character's record pays the gold in the respec's own batch (realm.js
 * prepareRealmRecord, the wallet's own order - its purse, its letters, then `region`'s account), asked first where the
 * record stands (realmActFirst: a respec asked again after its answer was lost finds its record one on - that is it,
 * landed); one with no realm record is refused ('realm-needed' - AUDIT UICALM-FIRM1 L2 L1). Answers the view (`respec`,
 * `gold`, and `realm: { seq }`); `repeat` for a request already made. Refusals: 'firm-character', 'firm-rid',
 * 'firm-closed', 'firm-rate', 'firm-respec-empty' (a sky with nothing in it), 'firm-stale', the realm's ('realm-needed',
 * 'lease', 'seq', 'realm-gold', 'no-realm-character', 'no-data', 'no-storage').
 */
export async function respecFirmament(ctx, player, env, body = {}) {
  const { db, nowS, rand } = ctx;
  if (!Number.isSafeInteger(nowS)) throw new TypeError('respecFirmament needs an integer epoch-seconds clock');
  const { character, rid, realm, region } = body ?? {};
  if (!renownCharacterOk(character)) return { error: 'firm-character' };
  if (typeof rid !== 'string' || !FIRM_RID_RE.test(rid)) return { error: 'firm-rid' };
  const side = await realmActFirst(db, player.id, character, realm);   // where the record stands, before any other word
  if (side.error) return side;
  const prior = await db.prepare('SELECT char_id, silver FROM firmament_sets WHERE player = ?1 AND rid = ?2').bind(player.id, rid).first();
  if (prior) {
    if (prior.char_id !== character) return { error: 'firm-rid' };
    const now = await firmStatement(db, player.id, character).first();
    return view(unpackTree(now?.tree ?? ''), await pursesOf(ctx, player.id, character), { repeat: true, respec: true });
  }
  const closed = shut(player, env);
  if (closed) return closed;
  // AUDIT UICALM-FIRM1 L2 L1: THE GOLD IS THE RECORD'S - a respec with no realm record to pay it is refused, never made
  // free (it had answered `gold` it never took, and a sky taken back that way skipped the refund's silver)
  if (!side.at) return { error: 'realm-needed' };
  if (await overRate(ctx, `firm:${player.id}`, FIRM_OPS_MAX, FIRM_OPS_WINDOW_S)) return { error: 'firm-rate' };
  const [row, purses] = await Promise.all([firmStatement(db, player.id, character).first(), pursesOf(ctx, player.id, character)]);
  const prevPacked = String(row?.tree ?? '');
  if (!unpackTree(prevPacked).start) return { error: 'firm-respec-empty' };
  const prep = await prepareRealmRecord(ctx, player.id, side.at, (save) => (payFromSave(save, FIRM_RESPEC_GOLD, region ?? null) ? null : 'realm-gold'));
  if (prep.error) return prep;
  const nonce = mintId(rand);
  try {
    await db.batch([
      ...prep.steps,
      // THE RESPEC'S ROW: over the tree it was asked over - a change landed first fails the whole batch, gold and all
      db.prepare(`INSERT INTO firmament_sets (player, rid, char_id, prev, tree, silver, at, n)
        SELECT ?1, ?4, ?2, ?3, '', 0, ?5, ?6
        WHERE COALESCE((SELECT tree FROM firmament WHERE player = ?1 AND char_id = ?2), '') = ?3`)
        .bind(player.id, character, prevPacked, rid, nowS, nonce),
      mustChange(db),
      db.prepare("UPDATE firmament SET tree = '', updated_at = ?3 WHERE player = ?1 AND char_id = ?2").bind(player.id, character, nowS),
    ]);
  } catch {
    await dropIfUnnamed(db, ctx.bucket, player.id, character, prep.key);   // a batch that landed and lost its answer keeps its save
    const moved = await recordMovedOf(db, player.id, side.at);
    if (moved) return moved;
    return { error: 'firm-stale' };
  }
  await dropObjects(ctx.bucket, [prep.prev]);
  return view({ start: null, keys: [] }, purses, { respec: true, gold: FIRM_RESPEC_GOLD, realm: { seq: prep.seq } });
}

/** The statuses a refusal answers with. */
export const FIRM_STATUS = Object.freeze({
  'firm-character': 400, 'firm-rid': 400, 'firm-key': 400, 'firm-start': 400, 'firm-path': 400, 'firm-points': 409,
  'firm-closed': 403, 'firm-rate': 429, 'firm-stale': 409, 'marks-closed': 403, 'marks-short': 409,
  'firm-respec-empty': 409, 'realm-needed': 400, 'realm-gold': 409, lease: 409, seq: 409, 'no-realm-character': 404, 'no-data': 404, 'no-storage': 503, body: 400,
});
