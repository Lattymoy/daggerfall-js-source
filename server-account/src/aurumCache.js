// @ts-check
// AURUM-CACHES (2026-10-30, the owner: "Also Aurum caches"; bible/06-Systems/Aurum.md section 3a): AN AURUM CACHE
// CLAIMED. The page asks with the cache's id when a player opens a coffer (scenes/aurumCacheHost.js); the id is checked
// by the law (src/net/aurumCacheLaw.js - a dungeon's key in its one spelling) and by the relay's signed word that the
// account stood in that dungeon (net/cacheProof.js, AUDIT E1). One ledger line a cache an account,
// ever (CACHES-ONCE), written only while the account's claims today are under the forgery bound: the line's key makes a
// second claim of one id write nothing. The balance needs nothing new - it sums the ledger (aurum.js balanceOfRow).
import { AURUM_CACHE_AURUM, AURUM_CACHE_DAY_MAX, aurumCacheIdOk } from '../../src/net/aurumCacheLaw.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { aurumOpenFor } from './aurum.js';
import { gatePublicKey } from './signing.js';
import { verifyCacheProof, cacheProofPlace } from '../../src/net/cacheProof.js';

/** The answer's status by refusal. */
export const AURUM_CACHE_STATUS = Object.freeze({ 'cache-guest': 403, 'cache-closed': 409, 'cache-id': 400, 'cache-taken': 409, 'cache-capped': 429, 'cache-proof': 403 });

/** AUDIT AURUM-CACHES E1: the relay's signed word that THIS account stood in THIS cache's dungeon (net/cacheProof.js). */
async function provedHere(/** @type {{ subtle?: any, nowS: number }} */ { subtle, nowS }, /** @type {any} */ player, /** @type {string} */ id, /** @type {unknown} */ proof, /** @type {any} */ env) {
  if (!subtle) return false;
  const v = /** @type {any} */ (await verifyCacheProof(proof, await gatePublicKey(env, subtle), { subtle, nowS }));
  return v.ok && v.claims.s === player.id && cacheProofPlace(v.claims.m) === id;
}

/**
 * A CACHE CLAIMED for the session's account: `{ ok: true, id, aurum, today, max }` - `today` the caches it has claimed
 * this UTC day, this one counted - or `{ error }`: cache-guest (no account to keep Aurum for), cache-closed (AURUM_OPEN),
 * cache-id (no cache's id), cache-proof (no relay proof of standing in that dungeon), cache-taken (this account claimed
 * it already), cache-capped (the day's bound met).
 * The write and both reads are one batch, so the answer is the write's own.
 * @param {{ db: any, nowS: number, subtle?: any }} ctx @param {any} player @param {any} body @param {any} env
 */
export async function claimCache(ctx, player, body, env) {
  const { db, nowS } = ctx;
  if (!player?.handle) return { error: 'cache-guest' };
  if (!aurumOpenFor(player, env)) return { error: 'cache-closed' };
  const id = body?.id;
  if (!aurumCacheIdOk(id)) return { error: 'cache-id' };
  // AUDIT AURUM-CACHES E1: a claim from no dungeon pays nothing - one this account holds is still said to be held
  if (!(await provedHere(ctx, player, id, body?.proof, env))) {
    const held = await db.prepare("SELECT 1 AS held FROM aurum_ledger WHERE account = ?1 AND kind = 'cache' AND ref = ?2").bind(player.id, id).first();
    return { error: held ? 'cache-taken' : 'cache-proof' };
  }
  const day = utcDay(nowS);
  const [put, held, count] = await db.batch([
    db.prepare(`INSERT OR IGNORE INTO aurum_ledger (account, kind, ref, amount, day, at) SELECT ?1, 'cache', ?2, ?3, ?4, ?5
      WHERE (SELECT COUNT(*) FROM aurum_ledger WHERE account = ?1 AND kind = 'cache' AND day = ?4) < ?6`)
      .bind(player.id, id, AURUM_CACHE_AURUM, day, nowS, AURUM_CACHE_DAY_MAX),
    db.prepare("SELECT 1 AS held FROM aurum_ledger WHERE account = ?1 AND kind = 'cache' AND ref = ?2").bind(player.id, id),
    db.prepare("SELECT COUNT(*) AS n FROM aurum_ledger WHERE account = ?1 AND kind = 'cache' AND day = ?2").bind(player.id, day),
  ]);
  if (Number(put?.meta?.changes ?? 0) > 0) return { ok: true, id, aurum: AURUM_CACHE_AURUM, today: Number(count?.results?.[0]?.n ?? 0), max: AURUM_CACHE_DAY_MAX };
  return { error: held?.results?.length ? 'cache-taken' : 'cache-capped' };
}
