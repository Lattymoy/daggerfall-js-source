// AUDIT FB1024 (2026-10-25, the owner: "Audit this", of FIELD BUGS 2026-10-24's EMBERS-OWED; bible/01-Overview/bugs/
// Field-Bugs-2026-10-24.md, BROKER-RID) - THE BROKER'S SALES BY THEIR REQUEST IDS.
//
// A press of the Broker's insignia (accounts.js buyInsignia) or her Panoply piece (egEconomy.js egSink) may carry a
// request id (`rid`, src/net/insignia.js BROKER_RID_RE). The sale writes `broker_sales` (migration 0174) in its own
// batch, only where its write took, and refuses a `rid` this account has a row of: a FENCE (`fenced`), or the same press
// asked again (the sale's own answer, `again`). A client whose answer was lost asks `/v1/broker/settle` by the `rid`
// (settleBrokerSale): the row it wrote answers the sale - `held`, and which ask came first (`by`, the first ask's nonce:
// the piece is handed to that ask, never to a save loaded again that asks a second time); no row, and the id is fenced in
// the same statement, so the press can never write after the client gave its embers back. The cause it closes: the
// client asked "does the account hold a sale like this one?" - by the week and the piece - and an earlier honest sale,
// or the week turning, answered for a press that never landed (AUDIT FB1024 lanes B and C).

import { arenaWeekOf } from '../../src/net/arena/arenaLaw.js';
import { BROKER_RID_RE } from '../../src/net/insignia.js';

/** A request id the law accepts. */
export const brokerRidOk = (rid) => typeof rid === 'string' && BROKER_RID_RE.test(rid);
/** A settle's nonce: the same shape as a request id. */
const nonceOk = brokerRidOk;

/** The row a request id wrote for this account, or null: `{ kind, item, at }`. */
export async function brokerSaleOf(db, account, rid) {
  const r = await db.prepare('SELECT kind, item, at FROM broker_sales WHERE account = ?1 AND rid = ?2').bind(account, rid).first();
  return r ? { kind: String(r.kind), item: typeof r.item === 'string' ? r.item : null, at: Number(r.at) || 0 } : null;
}

/** The sale's own row, in its batch after the write it records: written only where that write took (`changes()`). */
export const brokerSaleWrite = (db, { account, rid, kind, item, nowS }) => db.prepare(
  'INSERT INTO broker_sales (account, rid, kind, item, at) SELECT ?1, ?2, ?3, ?4, ?5 WHERE changes() > 0',
).bind(account, rid, kind, item, nowS);

/** The guard a sale's UPDATE carries: no row of this request id (`acc` and `rid` its SQL parameters). */
export const brokerRidFreeSql = (acc, rid) => `NOT EXISTS (SELECT 1 FROM broker_sales WHERE account = ${acc} AND rid = ${rid})`;

/**
 * THE SETTLE - `body.rid` the press asked after, `body.nonce` this ask's own. One batch: the fence written where the id
 * has no row (ON CONFLICT: a sale's row, or a fence already, stands), then the row counted and its first ask kept.
 * Answers `{ held: false }` (fenced - nothing was sold, nothing will be), or `{ held: true, kind, item, by, week? }`
 * (`by` the first ask's nonce; `week` a Panoply sale's arena week), or `{ error }`: `guest`, `rid` (a bad id or nonce).
 * @param {{ db: any, nowS: number }} ctx @param {{ id: string, handle?: string|null }} player @param {any} body
 */
export async function settleBrokerSale({ db, nowS }, player, body) {
  if (!player?.handle) return { error: 'guest' };
  const rid = body?.rid, nonce = body?.nonce;
  if (!brokerRidOk(rid) || !nonceOk(nonce)) return { error: 'rid' };
  const [, counted] = await db.batch([
    db.prepare("INSERT INTO broker_sales (account, rid, kind, item, at) VALUES (?1, ?2, 'fence', NULL, ?3) ON CONFLICT (account, rid) DO NOTHING").bind(player.id, rid, nowS),
    db.prepare('UPDATE broker_sales SET settled = settled + 1, asked_by = COALESCE(asked_by, ?3) WHERE account = ?1 AND rid = ?2 RETURNING kind, item, at, asked_by')
      .bind(player.id, rid, nonce),
  ]);
  const row = counted?.results?.[0];
  if (!row || row.kind === 'fence') return { held: false };
  return { held: true, kind: String(row.kind), item: row.item, by: String(row.asked_by), ...(row.kind === 'panoply' ? { week: arenaWeekOf(Number(row.at) || 0) } : {}) };
}
