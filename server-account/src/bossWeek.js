// @ts-check
// PWR5 (2026-10-23, bible/05-Combat/Power-Arc.md section 8): THE WEEK'S FINEST, THE SERVICE'S SIDE - the law is
// src/net/bossWeek.js. A claim of a boss's kill writes its week's row in its own batch (one transaction with the kill's
// row: a batch that fails takes neither), and answers from the row it reads back after: `top` where the week is this
// kill's, taken from this device, with `topSeed` - the receipt's seed mixed with the row's draw - for the client's
// second roll. A guest holds no week (no statement, no `top`).
import { bossWeekKey, bossWeekOf, bossWeekRef, bossTopSeed, BOSS_WEEK_CID_RE } from '../../src/net/bossWeek.js';

const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
const cidOf = (cid) => (typeof cid === 'string' && BOSS_WEEK_CID_RE.test(cid) ? cid : null);

/**
 * The statement that takes the week for this kill where nothing has yet - into the claim's batch, after its kill row.
 * Null for a kind the law does not hold, or a claim that names no device (a build from before the law): such a claim
 * neither takes the week nor is answered it.
 * @param {{ db: any, nowS: number, rand?: (b: Uint8Array) => Uint8Array }} ctx
 * @param {{ id: string }} player @param {string} kind @param {any} c the receipt's claims @param {unknown} cid
 */
export function bossWeekStatement({ db, nowS, rand }, player, kind, c, cid) {
  const boss = bossWeekKey(kind, c), mine = cidOf(cid);
  if (!boss || !mine) return null;
  const draw = rand ?? ((b) => globalThis.crypto.getRandomValues(b));
  return db.prepare('INSERT OR IGNORE INTO boss_weeks (account, boss, wk, ref, cid, nonce, at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)')
    .bind(player.id, boss, bossWeekOf(c), bossWeekRef(c), mine, hex(draw(new Uint8Array(8))), nowS);
}

/**
 * The week as the row says it, for this kill and device: `{ top: true, topSeed }` or `{ top: false }`.
 * @param {{ db: any }} ctx @param {{ id: string }} player @param {string} kind @param {any} c @param {unknown} cid
 */
export async function bossWeekAnswer({ db }, player, kind, c, cid) {
  const boss = bossWeekKey(kind, c), mine = cidOf(cid);
  if (!boss || !mine) return { top: false };
  const r = await db.prepare('SELECT ref, cid, nonce FROM boss_weeks WHERE account = ?1 AND boss = ?2 AND wk = ?3').bind(player.id, boss, bossWeekOf(c)).first();
  return r && r.ref === bossWeekRef(c) && r.cid === mine ? { top: true, topSeed: bossTopSeed(c.c, r.nonce) } : { top: false };
}
