// @ts-check
// DECOR-BATCH: a decorating session's final differences. Nothing here talks to the service.
import { decorGoldMove, mintDecorId } from '../../net/decorLaw.js';
import { t } from '../textManager.js';

const shapeOf = (p) => JSON.stringify({
  model: p?.model ?? null,
  flat: p?.flat ?? null,
  item: p?.item ?? null,
  pos: p?.pos ?? null,
  rot: p?.rot ?? null,
  scale: p?.scale ?? null,
  light: p?.light ?? null,
  storage: !!p?.storage,
  paid: p?.paid ?? 0,
  station: p?.station ?? null,
  name: p?.name ?? null,
});

/** A Confirm's id: long enough for decorLaw's DECOR_TXN_RE, and a new one after each kept Confirm. */
export function mintDecorTxn(rand = Math.random) {
  return `${mintDecorId(rand)}${mintDecorId(rand)}`;
}

/**
 * The final differences. A piece added and then removed is neither. Several edits of one piece are its last state.
 * @param {any[]} before @param {any[]} after
 */
export function decorDelta(before, after) {
  const was = new Map((before ?? []).filter((p) => p?.id).map((p) => [p.id, p]));
  const now = new Map((after ?? []).filter((p) => p?.id).map((p) => [p.id, p]));
  const put = [];
  const drop = [];
  for (const [id, p] of was) if (!now.has(id)) drop.push(id);
  for (const [id, p] of now) {
    const old = was.get(id);
    if (!old || shapeOf(old) !== shapeOf(p)) put.push(p);
  }
  return { put, drop };
}

/** What the session costs, split. `delta` is the purse's net (negative: it pays). `pay` is what is spent.
 *  `back` is what comes back. A hall spends `pay` from the keeper and gives `back` to the guild, and does not net them. */
export function decorDraftParts(before, after) {
  const was = new Map((before ?? []).filter((p) => p?.id).map((p) => [p.id, p]));
  const now = new Map((after ?? []).filter((p) => p?.id).map((p) => [p.id, p]));
  let delta = 0;
  let pay = 0;
  let back = 0;
  const add = (d) => { delta += d; if (d > 0) back += d; else if (d < 0) pay -= d; };
  for (const [id, p] of was) if (!now.has(id)) add(decorGoldMove(p, null, p.paid).delta);
  for (const [id, p] of now) {
    const old = was.get(id) ?? null;
    if (!old || shapeOf(old) !== shapeOf(p)) add(decorGoldMove(old, p, old?.paid ?? 0).delta);
  }
  return { delta, pay, back };
}

/** What the record gains for the whole session (negative: the purse pays), off the same law as one piece. */
export function decorDraftGold(before, after) {
  return decorDraftParts(before, after).delta;
}

/** The bar's line in a guild hall: the keeper pays the cost, and what comes back is the guild's. */
export function decorHallDraftText(parts) {
  const pay = parts?.pay ?? 0;
  const back = parts?.back ?? 0;
  if (pay && back) return t('decor.draft.hallBoth', '{pay} gold to confirm, {back} to the guild', { pay: pay.toLocaleString('en-US'), back: back.toLocaleString('en-US') });
  if (back) return t('decor.draft.hallBack', '{back} gold to the guild', { back: back.toLocaleString('en-US') });
  return decorDraftText(-pay);
}

/** The bar's line for that gold, before Confirm. */
export function decorDraftText(delta) {
  if (!delta) return t('decor.draft.free', 'nothing to pay');
  const n = Math.abs(delta).toLocaleString('en-US');
  return delta < 0 ? t('decor.draft.pay', '{n} gold to confirm', { n }) : t('decor.draft.back', '{n} gold back on confirm', { n });
}
