// @ts-check
// AN AURUM BUY GIVEN BACK, Admins alone. The preview names the account's buys, newest first, and what giving back the
// chosen one (the newest unless `ware` is named) would do. `confirm: true` with that buy's `ware` and `at`, a reason and a
// note gives it back in one batch: the buy's ledger line goes (so its Aurum is back on the balance, and a later buy pays
// again), the ware leaves the row as a money refund takes it (shop.js heldRevoked: never what another order or buy still
// covers), and the player gets a letter. The row and the line are guarded on what the preview read, so a buy or a grant
// landing meanwhile is read again, never undone blind.
import { shopWareById, shopHeldIds, SHOP_WARE_NAME } from '../../src/net/shopLaw.js';
import { POST_SENDER } from '../../src/net/postLaw.js';
import { heldRevoked, paidOthers, wareLine } from './shop.js';
import { aurumRow, balanceOfRow } from './aurum.js';
import { mustChange } from './realm.js';

export const AURUM_REFUND_PATH = '/v1/staff/aurum/refund';
export const AURUM_STAFF_ROUTES = Object.freeze([AURUM_REFUND_PATH]);
/** Why staff give a buy back. */
export const AURUM_REFUND_REASONS = Object.freeze(['player-asked', 'bug', 'compensation', 'testing', 'other']);
/** What each refusal answers. */
export const AURUM_STAFF_STATUS = Object.freeze({ 'no-aurum-buy': 404, 'aurum-buy-moved': 409, 'aurum-refund-busy': 503 });
/** The most buys the preview lists. */
export const AURUM_BUYS_SHOWN = 50;
const NOTE_MAX = 500;
const TRIES = 3;
/** A preview is written down once in this, per member and buy. */
const READ_ROW_S = 10 * 60;

const nameOf = (/** @type {string} */ id) => SHOP_WARE_NAME[/** @type {keyof typeof SHOP_WARE_NAME} */ (id)] ?? id;
const noteOf = (/** @type {unknown} */ text) => (typeof text === 'string' && text.trim() ? text.trim().slice(0, NOTE_MAX) : null);
const handleLc = (/** @type {unknown} */ handle) => (typeof handle === 'string' ? handle.trim().toLowerCase().slice(0, 64) : '');

/** The buy as an order, so the money refund's law reads it: its id is the one paidOthers gives a buy. */
const buyOrder = (/** @type {string} */ player, /** @type {any} */ line) => ({
  id: `aurum:${line.ref}`,
  player,
  ware: String(line.ref),
  credit: String(line.credit ?? ''),
});

/** The letter the player gets, its words fixed here. `gone` the ware ids that left the account. Pure. */
export function aurumRefundPost(/** @type {any} */ line, /** @type {ReadonlyArray<string>} */ gone) {
  const ware = /** @type {any} */ (shopWareById(line.ref));
  const aurum = -Number(line.amount) || 0;
  return {
    batch: `aurum-refund-${line.ref}-${line.at}`,
    subject: `Refunded: ${nameOf(ware.id)}`.slice(0, 80),
    body: [
      `Your purchase of ${wareLine(ware)} was refunded.`,
      `Its ${aurum.toLocaleString('en-US')} Aurum are back on your balance.`,
      gone.length ? `Off your account: ${gone.map(nameOf).join(', ')}.` : 'Your account still holds it through another purchase.',
      '',
      'Questions: ask the developers on the Discord.',
      '',
      `- ${POST_SENDER}`,
    ].join('\n'),
  };
}

/**
 * POST /v1/staff/aurum/refund { handle, ware?, at?, confirm?, reason?, note? }. Without `confirm`, the preview:
 * `{ player, buys, buy, gone, balance, after }`. With it, `{ ok, ware, aurum, gone, balance }`, or `{ error }`.
 * @param {any} ctx @param {any} env @param {string} path @param {any} body @param {any} who
 * @param {(act: string, target?: string|null, detail?: object|null, how?: object) => any} audit
 */
export async function staffAurum(ctx, env, path, body, who, audit) {
  const { db, nowS } = ctx;
  if (who.role !== 'admin') {
    await audit('refused', null, { path, need: 'admin' }, { outcome: 'denied' }).run();
    return { error: 'staff-admin' };
  }
  if (path !== AURUM_REFUND_PATH) return { error: 'not-found' };
  const handle = handleLc(body.handle);
  const player = handle ? await db.prepare('SELECT id, handle FROM players WHERE handle_lc = ?1').bind(handle).first() : null;
  if (!player?.handle) return { error: 'no-player' };
  const failed = async (/** @type {any} */ detail, /** @type {string} */ error) => {
    await audit('aurum-refund', player.id, { ...detail, error }, { outcome: 'failed' }).run();
    return { error };
  };

  for (let attempt = 0; attempt < TRIES; attempt++) {
    const [lines, row] = await Promise.all([
      db.prepare("SELECT ref, amount, at, credit FROM aurum_ledger WHERE account = ?1 AND kind = 'buy' ORDER BY at DESC, rowid DESC LIMIT ?2")
        .bind(player.id, AURUM_BUYS_SHOWN).all(),
      aurumRow(db, player.id),
    ]);
    const buys = (lines?.results ?? []).filter((/** @type {any} */ line) => shopWareById(line.ref));
    const named = typeof body.ware === 'string' ? body.ware : null;
    const line = named ? buys.find((/** @type {any} */ b) => b.ref === named) : buys[0];
    const detail = { ware: line?.ref ?? named, at: line ? Number(line.at) : null };
    if (!line) return body.confirm === true ? failed(detail, 'no-aurum-buy') : { error: 'no-aurum-buy' };

    const order = buyOrder(player.id, line);
    const others = (await paidOthers(db, order)).filter((other) => other.id !== order.id);   // the buy given back is no holder of its own
    const before = { shop_wares: Number(row.shop_wares) || 0, shop_held: String(row.shop_held ?? '') };
    const after = heldRevoked(before, order, others);
    const still = shopHeldIds(after);
    const gone = shopHeldIds(before).filter((id) => !still.includes(id));
    const aurum = -Number(line.amount) || 0;
    const balance = balanceOfRow(row);

    if (body.confirm !== true) {
      await audit('aurum-refund-check', player.id, detail, { onceIn: READ_ROW_S }).run();
      return {
        player: { id: player.id, handle: player.handle },
        buys: buys.map((/** @type {any} */ b) => ({ ware: b.ref, name: nameOf(b.ref), aurum: -Number(b.amount) || 0, at: Number(b.at) })),
        buy: { ware: line.ref, name: nameOf(line.ref), aurum, at: Number(line.at) },
        gone,
        balance,
        after: balance + aurum,
      };
    }
    const reason = AURUM_REFUND_REASONS.includes(body.reason) ? body.reason : null;
    const note = noteOf(body.note);
    const said = { ...detail, aurum, gone, reason, note };
    if (!named || !Number.isSafeInteger(body.at)) return failed(said, 'body');
    if (body.at !== Number(line.at)) return failed(said, 'aurum-buy-moved');
    if (!reason) return failed(said, 'staff-reason');
    if (!note) return failed(said, 'staff-note');
    const letter = aurumRefundPost(line, gone);
    try {
      await db.batch([
        db.prepare("DELETE FROM aurum_ledger WHERE account = ?1 AND kind = 'buy' AND ref = ?2 AND at = ?3 AND amount = ?4")
          .bind(player.id, line.ref, line.at, line.amount),
        mustChange(db),
        db.prepare('UPDATE players SET shop_wares = ?2, shop_held = ?3 WHERE id = ?1 AND shop_wares = ?4 AND shop_held = ?5')
          .bind(player.id, after.shop_wares, after.shop_held, before.shop_wares, before.shop_held),
        mustChange(db),
        db.prepare(`INSERT OR IGNORE INTO server_post (id, to_id, batch, sender, subject, body, item, sent_at, ware)
          VALUES (lower(hex(randomblob(12))), ?1, ?2, ?3, ?4, ?5, NULL, ?6, ?7)`)
          .bind(player.id, letter.batch, POST_SENDER, letter.subject, letter.body, nowS, line.ref),
        audit('aurum-refund', player.id, said),
      ]);
    } catch {
      continue;   // the row or the line moved under the batch: read again
    }
    return { ok: true, ware: line.ref, aurum, gone, balance: balanceOfRow(await aurumRow(db, player.id)) };
  }
  return failed({ ware: body.ware ?? null }, 'aurum-refund-busy');
}
