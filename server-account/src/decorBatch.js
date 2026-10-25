// @ts-check
// DECOR-BATCH: one Confirm writes a home's final differences, all of them or none.
// A guild hall does too: the keeper pays for what is placed, and what comes back goes to the guild's treasury.
// A palace keeps the one-piece writes (seat-batch).
import { accountKind, displayName } from './accounts.js';
import { GUILD_TREASURY_MAX } from '../../src/net/guild/guildLaw.js';
import { CHAR_ID_RE } from './service.js';
import { homeMapIdOk, homeBuildingKeyOk } from '../../src/net/homeLaw.js';
import {
  DECOR_BATCH_OPS, DECOR_CAP, DECOR_HALL_CAP, DECOR_ID_RE, DECOR_OPS_MAX, DECOR_OPS_WINDOW_S, DECOR_TXN_RE, DECOR_YARD_CAP,
  decorGoldMove, decorPieceOf, decorScaleOk, decorYardHighOk, decorYardPieceOf,
} from '../../src/net/decorLaw.js';
import { OWNS, provenOf, vendorStocked } from './decor.js';
import {
  dropIfUnnamed, dropObjects, getRealmBlob, mustChange, prepareRealmRecord, realmActFirst, realmSaveTextOf, realmSideOf, REALM_ID_RE,
} from './realm.js';
import { payFromSave, creditSave } from '../../src/net/realm/realmGoldLaw.js';

const placeJson = ({ pos, rot, scale, light, storage, paid, station, name }) => JSON.stringify({ pos, rot, scale, light, storage, paid, ...(station ? { station } : {}), ...(name ? { name } : {}) });

/** Ids in `save` whose storage still holds something. The record is the authority, not the client's word. */
export function decorHeldBlocks(save, ids) {
  const want = new Set(ids);
  const blocked = [];
  const scenes = save?.sceneCache?.scenes;
  if (!Array.isArray(scenes)) return blocked;
  for (const scene of scenes) {
    const items = scene?.decorItems;
    if (!items || typeof items !== 'object') continue;
    for (const id of want) {
      const list = items[id];
      if (Array.isArray(list) && list.length && !blocked.includes(id)) blocked.push(id);
    }
  }
  return blocked;
}

function stripDecorItems(save, ids) {
  const want = new Set(ids);
  let n = 0;
  for (const scene of save?.sceneCache?.scenes ?? []) {
    if (!scene?.decorItems || typeof scene.decorItems !== 'object') continue;
    for (const id of want) if (Object.prototype.hasOwnProperty.call(scene.decorItems, id)) { delete scene.decorItems[id]; n += 1; }
  }
  return n;
}

function rowPiece(row) {
  let place = null;
  let item = null;
  try { place = JSON.parse(row.place); } catch { return null; }
  if (row.item != null) { try { item = JSON.parse(row.item); } catch { return null; } }
  return decorPieceOf({ ...place, id: row.id, model: row.model ?? null, flat: row.model == null ? [row.flat_archive, row.flat_record] : null, item });
}

function sameWhat(was, now) {
  return was.model === now.model && (was.flat?.[0] ?? null) === (now.flat?.[0] ?? null) && (was.flat?.[1] ?? null) === (now.flat?.[1] ?? null);
}

async function chargeOps(db, nowS, playerId, n) {
  const start = Math.floor(nowS / DECOR_OPS_WINDOW_S) * DECOR_OPS_WINDOW_S;
  const row = await db.prepare(`INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      count = CASE WHEN rate_limits.window_start >= excluded.window_start THEN rate_limits.count + excluded.count ELSE excluded.count END,
      window_start = MAX(rate_limits.window_start, excluded.window_start)
    RETURNING count`).bind(`decor:${playerId}`, start, n).first();
  return (row?.count ?? 0) > DECOR_OPS_MAX;
}

/**
 * CONFIRM A HOME'S DRAFT. `put` is each piece's final state (new or changed). `drop` is each id that stood at `rev`
 * and must go. The same id is never both. `txn` answered once is answered again and changes nothing.
 * @param {{ db: any, nowS: number, bucket?: any, rand?: any }} ctx
 */
export async function commitDecorBatch(ctx, player, body = {}) {
  const { db, nowS } = ctx;
  const { mapId, buildingKey, character, txn, rev } = body;
  const yard = body.yard === true;
  if (body.seat === true) return { error: 'seat-batch' };
  if (accountKind(player) !== 'linked') return { error: 'homes-need-account' };
  if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(buildingKey)) return { error: 'bad-home' };
  if (typeof character !== 'string' || !CHAR_ID_RE.test(character) || !REALM_ID_RE.test(character)) return { error: 'realm-only' };
  if (typeof txn !== 'string' || !DECOR_TXN_RE.test(txn)) return { error: 'bad-decor' };
  if (!Number.isSafeInteger(rev) || rev < 0) return { error: 'decor-rev' };
  const putIn = Array.isArray(body.put) ? body.put : null;
  const dropIn = Array.isArray(body.drop) ? body.drop : null;
  if (!putIn || !dropIn) return { error: 'bad-decor' };
  if (putIn.length + dropIn.length > DECOR_BATCH_OPS) return { error: 'decor-ops' };

  const prior = await db.prepare('SELECT player, map_id, building_key, result FROM decor_batch_receipt WHERE txn = ?').bind(txn).first();
  if (prior) {
    if (prior.player !== player.id || prior.map_id !== mapId || prior.building_key !== buildingKey) return { error: 'decor-txn' };
    try { return { ...JSON.parse(prior.result), repeat: true }; } catch { return { error: 'decor-txn' }; }
  }

  const home = await db.prepare('SELECT guild_id, region FROM homes WHERE map_id = ? AND building_key = ?').bind(mapId, buildingKey).first();
  if (!home) return { error: 'no-home' };
  const hall = home.guild_id != null;

  if (body.realm != null) {
    const first = await realmActFirst(db, player.id, character, body.realm);
    if (first.error) return first;
  }

  const seen = new Set();
  const drops = [];
  for (const id of dropIn) {
    if (typeof id !== 'string' || !DECOR_ID_RE.test(id) || seen.has(id)) return { error: 'bad-decor' };
    seen.add(id);
    drops.push(id);
  }
  /** @type {any[]} */
  const puts = [];
  for (const raw of putIn) {
    const sent = yard ? decorYardPieceOf(raw) : decorPieceOf(raw);
    if (!sent || !decorScaleOk(sent) || seen.has(sent.id)) return { error: 'bad-decor' };
    if (yard && !decorYardHighOk(sent)) return { error: 'yard-high' };
    seen.add(sent.id);
    const p = sent.item?.pv ? await provenOf(db, player, sent, mapId, buildingKey) : sent;
    if (!p) return { error: 'bad-decor' };
    puts.push(p);
  }
  if (hall) for (const p of puts) if (p.item) return { error: 'hall-item' };

  const out = yard ? 1 : 0;
  const { results = [] } = await db.prepare('SELECT * FROM home_decor WHERE map_id = ? AND building_key = ? AND yard = ?')
    .bind(mapId, buildingKey, out).all();
  const have = new Map();
  for (const row of results) {
    const piece = rowPiece(row);
    if (piece) have.set(piece.id, { row, piece });
  }
  const revRow = await db.prepare('SELECT rev FROM decor_rev WHERE map_id = ? AND building_key = ?').bind(mapId, buildingKey).first();
  const curRev = Number(revRow?.rev) || 0;
  if (curRev !== rev) return { error: 'decor-rev' };
  if (!puts.length && !drops.length) return { ok: true, rev: curRev, gold: 0 };
  if (await chargeOps(db, nowS, player.id, puts.length + drops.length)) return { error: 'decor-rate' };

  let net = 0;
  let pay = 0;
  let refund = 0;
  const addGold = (d) => { net += d; if (d > 0) refund += d; else if (d < 0) pay -= d; };
  const next = new Map(have);
  for (const id of drops) {
    const had = have.get(id);
    if (!had) return { error: 'no-decor' };
    if (had.piece.station === 'vendor' && await vendorStocked(db, mapId, id)) return { error: 'vendor-stocked' };
    addGold(decorGoldMove(had.piece, null, had.row.paid).delta);
    next.delete(id);
  }
  const cap = yard ? DECOR_YARD_CAP : (hall ? DECOR_HALL_CAP : DECOR_CAP);
  /** @type {{ p: any, had: any }[]} */
  const writes = [];
  for (const p of puts) {
    const had = have.get(p.id) ?? null;
    if (had && !sameWhat(had.piece, p)) return { error: 'bad-decor' };
    if (had?.piece.station === 'vendor' && p.station !== 'vendor' && await vendorStocked(db, mapId, p.id)) return { error: 'vendor-stocked' };
    if (had && had.piece.storage && p.storage === false) {
      /* emptying the flag does not empty the chest; the drop path is the one that can lose goods */
    }
    const move = decorGoldMove(had?.piece ?? null, p, had ? had.row.paid : 0);
    addGold(move.delta);
    writes.push({ p: { ...p, paid: had ? move.ledger : (move.ledger || p.paid) }, had, ledger: move.ledger });
    next.set(p.id, { piece: p });
  }
  if (next.size > cap) return { error: yard ? 'yard-cap' : 'decor-cap' };
  const delta = hall ? -pay : net;
  if (hall && refund > 0) {
    const g = await db.prepare('SELECT treasury FROM guilds WHERE id = ?').bind(home.guild_id).first();
    if (!g || g.treasury + refund > GUILD_TREASURY_MAX) return { error: g ? 'guild-treasury-full' : 'no-home' };
  }

  if (drops.length) {
    const marks = drops.map(() => '?').join(', ');
    const heldBin = await db.prepare(`SELECT piece_id FROM decor_bin WHERE map_id = ? AND building_key = ? AND piece_id IN (${marks}) LIMIT 1`).bind(mapId, buildingKey, ...drops).first();
    if (heldBin) return { error: 'decor-holds' };
  }
  const clears = writes.filter((w) => w.had?.piece.storage && !w.p.storage).map((w) => w.p.id);
  let saveNote = null;
  if (drops.length || clears.length) {
    const blob = await getRealmBlob(ctx, player.id, character);
    if (!blob.ok) return blob;
    let save = null;
    try { save = JSON.parse(await realmSaveTextOf(blob.object)); } catch { save = null; }
    if (!save) return { error: 'no-data' };
    if (decorHeldBlocks(save, [...drops, ...clears]).length) return { error: 'decor-holds' };
    saveNote = save;
  }

  const side = realmSideOf(character, body.realm);
  if (side.error && !(side.error === 'realm-needed' && delta === 0 && body.realm == null)) return side;
  const at = side.at ?? null;
  let prep = null;
  if (at && (delta !== 0 || (saveNote && stripDecorItems(saveNote, drops) > 0))) {
    if (saveNote) stripDecorItems(saveNote, drops);
    prep = await prepareRealmRecord(ctx, player.id, at, (save) => {
      if (saveNote) {
        stripDecorItems(save, drops);
        if (decorHeldBlocks(save, drops).length) return 'decor-holds';
      }
      if (delta < 0) return payFromSave(save, -delta, home.region) ? null : 'realm-gold';
      if (delta > 0) return creditSave(save, delta) ? null : 'no-data';
      return null;
    });
    if (prep.error) return prep;
  } else if (delta !== 0) return { error: 'realm-needed' };

  const answer = { ok: true, rev: curRev + 1, gold: delta, ...(hall && refund > 0 ? { treasury: refund } : {}), ...(prep ? { realm: { seq: prep.seq } } : {}) };
  const steps = [];
  if (prep) steps.push(...prep.steps);
  const ownsTail = [mapId, buildingKey, player.id, character];
  for (const id of drops) {
    const had = have.get(id);
    steps.push(db.prepare(`DELETE FROM home_decor WHERE map_id = ? AND building_key = ? AND id = ? AND yard = ? AND place = ? AND paid = ? AND ${OWNS}`)
      .bind(mapId, buildingKey, id, out, had.row.place, had.row.paid, ...ownsTail));
    steps.push(mustChange(db));
    steps.push(db.prepare('DELETE FROM decor_access WHERE map_id = ? AND building_key = ? AND piece_id = ?').bind(mapId, buildingKey, id));
  }
  for (const w of writes) {
    if (w.had) {
      steps.push(db.prepare(`UPDATE home_decor SET place = ?, paid = ? WHERE map_id = ? AND building_key = ? AND id = ? AND yard = ? AND place = ? AND paid = ? AND ${OWNS}`)
        .bind(placeJson(w.p), w.ledger, mapId, buildingKey, w.p.id, out, w.had.row.place, w.had.row.paid, ...ownsTail));
    } else {
      const pv = typeof w.p.item?.pv === 'string' ? w.p.item.pv : null;
      const pvSql = pv ? ' AND EXISTS (SELECT 1 FROM products WHERE provenance = ? AND owner = ? AND listed = 0)' : '';
      steps.push(db.prepare(`INSERT OR IGNORE INTO home_decor (map_id, building_key, id, model, flat_archive, flat_record, place, placed_at, item, paid, yard)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${OWNS} AND (SELECT COUNT(*) FROM home_decor WHERE map_id = ? AND building_key = ? AND yard = ?) < ?${pvSql}`)
        .bind(mapId, buildingKey, w.p.id, w.p.model, w.p.flat?.[0] ?? null, w.p.flat?.[1] ?? null, placeJson(w.p), nowS,
          w.p.item ? JSON.stringify(w.p.item) : null, w.ledger, out, ...ownsTail, mapId, buildingKey, out, cap, ...(pv ? [pv, player.id] : [])));
    }
    steps.push(mustChange(db));
  }
  if (hall && refund > 0) {
    steps.push(db.prepare(`UPDATE guilds SET treasury = treasury + ?1, realm_gold = realm_gold + ?1, moved_by = ?2, moved_at = ?3, moved_kind = 'hall-piece'
      WHERE id = ?4 AND treasury + ?1 <= ?5`).bind(refund, displayName(player), nowS, home.guild_id, GUILD_TREASURY_MAX));
    steps.push(mustChange(db));
  }
  steps.push(db.prepare('INSERT INTO decor_rev (map_id, building_key, rev) VALUES (?, ?, 0) ON CONFLICT(map_id, building_key) DO NOTHING').bind(mapId, buildingKey));
  steps.push(db.prepare('UPDATE decor_rev SET rev = rev + 1 WHERE map_id = ? AND building_key = ? AND rev = ?').bind(mapId, buildingKey, curRev));
  steps.push(mustChange(db));
  steps.push(db.prepare('INSERT INTO decor_batch_receipt (txn, player, map_id, building_key, rev, result, at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(txn, player.id, mapId, buildingKey, curRev + 1, JSON.stringify(answer), nowS));
  steps.push(mustChange(db));
  try {
    await db.batch(steps);
  } catch {
    if (prep) {
      const landed = await dropIfUnnamed(db, ctx.bucket, player.id, at.id, prep.key);
      if (landed) return (await db.prepare('SELECT result FROM decor_batch_receipt WHERE txn = ?').bind(txn).first())?.result
        ? JSON.parse((await db.prepare('SELECT result FROM decor_batch_receipt WHERE txn = ?').bind(txn).first()).result)
        : { error: 'seq', seq: prep.seq };
    }
    const again = await db.prepare('SELECT result FROM decor_batch_receipt WHERE txn = ?').bind(txn).first();
    if (again?.result) { try { return JSON.parse(again.result); } catch { /* the row is the refusal below */ } }
    const nowRev = Number((await db.prepare('SELECT rev FROM decor_rev WHERE map_id = ? AND building_key = ?').bind(mapId, buildingKey).first())?.rev) || 0;
    if (nowRev !== curRev) return { error: 'decor-rev' };
    const owns = await db.prepare(`SELECT ${OWNS} AS owns`).bind(...ownsTail).first();
    return { error: owns?.owns ? 'decor-cap' : 'no-home' };
  }
  if (prep) await dropObjects(ctx.bucket, [prep.prev]);
  return answer;
}
