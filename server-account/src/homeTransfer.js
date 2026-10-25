// @ts-check
// A house changes hands as one write. The homes row is updated, never deleted, so nobody can claim it in between.
import { accountKind, displayName, overRate } from './accounts.js';
import { CHAR_ID_RE } from './service.js';
import { HOME_CAP, homeMapIdOk, homeBuildingKeyOk } from '../../src/net/homeLaw.js';
import { decorRefund } from '../../src/net/decorLaw.js';
import { decorHeldBlocks } from './decorBatch.js';
import { dropIfUnnamed, getRealmBlob, mustChange, prepareRealmRecord, realmActFirst, realmSaveTextOf, seizeRealmRecord } from './realm.js';
import { payFromSave, creditSave } from '../../src/net/realm/realmGoldLaw.js';

const OFFER_S = 3 * 24 * 60 * 60;
const PRICE_MAX = 100_000_000;
const UID_RE = /^[0-9a-f]{16}$/;

const offerId = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');

function goodsOf(save, ids) {
  const want = new Set(ids);
  const list = [];
  for (const scene of save?.sceneCache?.scenes ?? []) {
    const items = scene?.decorItems;
    if (!items || typeof items !== 'object') continue;
    for (const id of want) {
      const held = items[id];
      if (!Array.isArray(held)) continue;
      for (const it of held) {
        if (typeof it?.uid !== 'string' || !UID_RE.test(it.uid)) return null;
        list.push({ piece: id, uid: it.uid, item: it });
      }
    }
  }
  return list;
}

function stripGoods(save, ids) {
  const want = new Set(ids);
  for (const scene of save?.sceneCache?.scenes ?? []) {
    if (!scene?.decorItems || typeof scene.decorItems !== 'object') continue;
    for (const id of want) delete scene.decorItems[id];
  }
}

async function houseOf(db, mapId, buildingKey, playerId) {
  return db.prepare('SELECT * FROM homes WHERE map_id = ? AND building_key = ? AND player = ? AND guild_id IS NULL').bind(mapId, buildingKey, playerId).first();
}

async function blocked(db, mapId, buildingKey, nowS) {
  const tenants = await db.prepare('SELECT COUNT(*) AS n FROM home_rooms WHERE map_id = ? AND building_key = ? AND tenant IS NOT NULL AND until > ?').bind(mapId, buildingKey, nowS).first();
  if (Number(tenants?.n) > 0) return 'home-tenants';
  const stock = await db.prepare(`SELECT COUNT(*) AS n FROM market_listings l JOIN home_decor d ON d.map_id = l.vendor_map AND d.id = l.vendor_id
    WHERE l.state = 'open' AND d.map_id = ? AND d.building_key = ?`).bind(mapId, buildingKey).first();
  if (Number(stock?.n) > 0) return 'home-vendor-stocked';
  return null;
}

/** What the seller's save still holds in this house, or `home-holds` when it cannot be moved safely. */
async function heldGoods(ctx, home, pieceIds) {
  const blob = await getRealmBlob(ctx, home.player, home.char_id);
  if (!blob.ok) return { error: 'home-holds' };
  let save = null;
  try { save = JSON.parse(await realmSaveTextOf(blob.object)); } catch { save = null; }
  if (!save) return { error: 'home-holds' };
  if (decorHeldBlocks(save, pieceIds).length && goodsOf(save, pieceIds) == null) return { error: 'home-holds' };
  const goods = goodsOf(save, pieceIds);
  if (goods == null) return { error: 'home-holds' };
  return { goods };
}

async function offerHome(ctx, player, body) {
  const { db, nowS } = ctx;
  const { mapId, buildingKey, character, to, price, keepDecor, keepItems } = body ?? {};
  if (accountKind(player) !== 'linked') return { error: 'homes-need-account' };
  if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(buildingKey) || typeof character !== 'string' || !CHAR_ID_RE.test(character)) return { error: 'no-home' };
  if (!Number.isSafeInteger(price) || price < 0 || price > PRICE_MAX || typeof keepDecor !== 'boolean' || typeof keepItems !== 'boolean') return { error: 'bad-offer' };
  if (keepItems && !keepDecor) return { error: 'bad-offer' };
  if (typeof to !== 'string' || !/^[A-Za-z0-9]{3,16}$/.test(to)) return { error: 'no-reader' };
  if (await overRate(ctx, `hometransfer:${player.id}`, 30, 3600)) return { error: 'home-rate' };
  const home = await houseOf(db, mapId, buildingKey, player.id);
  if (!home || home.char_id !== character) return { error: 'no-home' };
  if (home.deed === 1) return { error: 'home-deed' };
  const why = await blocked(db, mapId, buildingKey, nowS);
  if (why) return { error: why };
  const buyer = await db.prepare('SELECT id, handle FROM players WHERE handle_lc = ?').bind(to.toLowerCase()).first();
  if (!buyer?.handle || buyer.id === player.id) return { error: 'no-reader' };
  const pieces = (await db.prepare('SELECT id, place FROM home_decor WHERE map_id = ? AND building_key = ?').bind(mapId, buildingKey).all())?.results ?? [];
  const bin = Number((await db.prepare('SELECT COUNT(*) AS n FROM decor_bin WHERE map_id = ? AND building_key = ?').bind(mapId, buildingKey).first())?.n) || 0;
  const held = await heldGoods(ctx, home, pieces.map((p) => p.id));
  if (held.error) return held;
  if ((!keepItems || !keepDecor) && (bin > 0 || held.goods.length > 0)) return { error: 'home-holds' };
  const rev = Number((await db.prepare('SELECT rev FROM decor_rev WHERE map_id = ? AND building_key = ?').bind(mapId, buildingKey).first())?.rev) || 0;
  const id = offerId();
  const until = nowS + OFFER_S;
  await db.prepare(`UPDATE home_offers SET state = 'expired' WHERE map_id = ? AND building_key = ? AND state = 'open' AND until <= ?`).bind(mapId, buildingKey, nowS).run();
  try {
    const wrote = await db.prepare(`INSERT INTO home_offers (id, map_id, building_key, seller, seller_char, buyer, price, keep_decor, keep_items, rev, state, at, until)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`).bind(id, mapId, buildingKey, player.id, character, buyer.id, price, keepDecor ? 1 : 0, keepItems ? 1 : 0, rev, nowS, until).run();
    if (!wrote?.meta?.changes) return { error: 'offer-open' };
  } catch {
    return { error: 'offer-open' };
  }
  return { ok: true, id, until, price, keepDecor, keepItems };
}

async function closeOffer(db, id, playerId, state) {
  const row = await db.prepare('SELECT * FROM home_offers WHERE id = ?').bind(id).first();
  if (!row || row.state !== 'open') return { error: 'offer-closed' };
  const who = state === 'cancelled' ? row.seller : row.buyer;
  if (who !== playerId) return { error: 'offer-closed' };
  const wrote = await db.prepare(`UPDATE home_offers SET state = ? WHERE id = ? AND state = 'open'`).bind(state, id).run();
  return wrote?.meta?.changes ? { ok: true, state } : { error: 'offer-closed' };
}

async function acceptHome(ctx, player, body) {
  const { db, nowS } = ctx;
  const { id, character, realm } = body ?? {};
  if (typeof id !== 'string' || !/^[0-9a-f]{32}$/.test(id)) return { error: 'offer-closed' };
  if (typeof character !== 'string' || !CHAR_ID_RE.test(character)) return { error: 'no-home' };
  const offer = await db.prepare('SELECT * FROM home_offers WHERE id = ?').bind(id).first();
  if (!offer || offer.buyer !== player.id) return { error: 'offer-closed' };
  if (offer.state === 'accepted' && offer.result) return { ...JSON.parse(offer.result), repeat: true };
  if (offer.state !== 'open' || offer.until <= nowS) {
    if (offer.state === 'open') await db.prepare(`UPDATE home_offers SET state = 'expired' WHERE id = ? AND state = 'open'`).bind(id).run();
    return { error: 'offer-closed' };
  }
  if (realm != null) {
    const moved = await realmActFirst(db, player.id, character, realm);
    if (moved?.error) return moved;
  }
  const mine = await db.prepare('SELECT id FROM realm_characters WHERE id = ? AND player = ? AND dead_at IS NULL').bind(character, player.id).first();
  if (!mine) return { error: 'no-home' };
  const owned = Number((await db.prepare('SELECT COUNT(*) AS n FROM homes WHERE player = ? AND char_id = ? AND guild_id IS NULL').bind(player.id, character).first())?.n) || 0;
  if (owned >= HOME_CAP) return { error: 'home-cap' };
  const home = await houseOf(db, offer.map_id, offer.building_key, offer.seller);
  if (!home || home.char_id !== offer.seller_char || home.deed === 1) {
    await db.prepare(`UPDATE home_offers SET state = 'cancelled' WHERE id = ? AND state = 'open'`).bind(id).run();
    return { error: home?.deed === 1 ? 'home-deed' : 'no-home' };
  }
  const why = await blocked(db, offer.map_id, offer.building_key, nowS);
  if (why) return { error: why };
  const rev = Number((await db.prepare('SELECT rev FROM decor_rev WHERE map_id = ? AND building_key = ?').bind(offer.map_id, offer.building_key).first())?.rev) || 0;
  if (rev !== offer.rev) return { error: 'offer-stale' };
  const pieces = (await db.prepare('SELECT id, place FROM home_decor WHERE map_id = ? AND building_key = ?').bind(offer.map_id, offer.building_key).all())?.results ?? [];
  const pieceIds = pieces.map((p) => p.id);
  const bin = Number((await db.prepare('SELECT COUNT(*) AS n FROM decor_bin WHERE map_id = ? AND building_key = ?').bind(offer.map_id, offer.building_key).first())?.n) || 0;
  const held = await heldGoods(ctx, home, pieceIds);
  if (held.error) return held;
  const keepDecor = offer.keep_decor === 1;
  const keepItems = offer.keep_items === 1;
  if ((!keepItems || !keepDecor) && (bin > 0 || held.goods.length > 0)) return { error: 'home-holds' };
  let refund = 0;
  if (!keepDecor) {
    for (const row of pieces) {
      let place = null;
      try { place = JSON.parse(row.place); } catch { place = null; }
      refund += decorRefund(place?.paid);
    }
  }
  const price = offer.price;
  if (price > 0 && realm == null) return { error: 'realm-needed' };
  const moved = [];
  let sellerKey = null;
  let buyerKey = null;
  const sellerPrep = (price > 0 || refund > 0 || held.goods.length > 0 || !keepDecor) ? await seizeRealmRecord(ctx, offer.seller, offer.seller_char, (save) => {
    const again = goodsOf(save, pieceIds);
    if (again == null) return 'home-holds';
    if ((!keepItems || !keepDecor) && again.length > 0) return 'home-holds';
    if (keepItems) {
      stripGoods(save, pieceIds);
      moved.push(...again);
    }
    if (price + refund > 0 && !creditSave(save, price + refund)) return 'no-data';
    return null;
  }) : null;
  if (sellerPrep?.error) return sellerPrep;
  sellerKey = sellerPrep?.key ?? null;
  const buyerPrep = price > 0 ? await prepareRealmRecord(ctx, player.id, realm, (save) => (payFromSave(save, price, home.region) ? null : 'realm-gold'), { outbound: true }) : null;   // INT3: the price goes to the seller - a held record pays no one
  if (buyerPrep?.error) {
    if (sellerKey) await dropIfUnnamed(db, ctx.bucket, offer.seller, offer.seller_char, sellerKey);
    return buyerPrep;
  }
  buyerKey = buyerPrep?.key ?? null;
  const result = { ok: true, price, keepDecor, keepItems, ...(buyerPrep ? { realm: { seq: buyerPrep.seq } } : {}) };
  const steps = [
    ...(sellerPrep?.steps ?? []),
    ...(buyerPrep?.steps ?? []),
    db.prepare(`UPDATE homes SET player = ?1, char_id = ?2, owner_name = ?3
      WHERE map_id = ?4 AND building_key = ?5 AND player = ?6 AND char_id = ?7 AND guild_id IS NULL AND (deed IS NULL OR deed = 0)
      AND (SELECT COUNT(*) FROM homes WHERE player = ?1 AND char_id = ?2 AND guild_id IS NULL) < ?8`)
      .bind(player.id, character, displayName(player), offer.map_id, offer.building_key, offer.seller, offer.seller_char, HOME_CAP),
    mustChange(db),
    db.prepare('DELETE FROM decor_access WHERE map_id = ? AND building_key = ?').bind(offer.map_id, offer.building_key),
  ];
  if (!keepDecor) {
    steps.push(db.prepare('DELETE FROM home_decor WHERE map_id = ? AND building_key = ?').bind(offer.map_id, offer.building_key));
    steps.push(db.prepare('DELETE FROM decor_bin WHERE map_id = ? AND building_key = ?').bind(offer.map_id, offer.building_key));
  } else {
    for (const g of moved) {
      steps.push(db.prepare('INSERT INTO decor_bin (map_id, building_key, piece_id, uid, item) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING')
        .bind(offer.map_id, offer.building_key, g.piece, g.uid, JSON.stringify(g.item)));
    }
  }
  steps.push(
    db.prepare('INSERT INTO decor_rev (map_id, building_key, rev) VALUES (?, ?, 0) ON CONFLICT DO NOTHING').bind(offer.map_id, offer.building_key),
    db.prepare('UPDATE decor_rev SET rev = rev + 1 WHERE map_id = ? AND building_key = ? AND rev = ?').bind(offer.map_id, offer.building_key, rev),
    mustChange(db),
    db.prepare(`UPDATE home_offers SET state = 'accepted', result = ? WHERE id = ? AND state = 'open'`).bind(JSON.stringify(result), id),
    mustChange(db),
  );
  try {
    await db.batch(steps);
  } catch {
    if (sellerKey) await dropIfUnnamed(db, ctx.bucket, offer.seller, offer.seller_char, sellerKey);
    if (buyerKey) await dropIfUnnamed(db, ctx.bucket, player.id, character, buyerKey);
    const done = await db.prepare('SELECT state, result FROM home_offers WHERE id = ?').bind(id).first();
    if (done?.state === 'accepted' && done.result) return { ...JSON.parse(done.result), repeat: true };
    const nowRev = Number((await db.prepare('SELECT rev FROM decor_rev WHERE map_id = ? AND building_key = ?').bind(offer.map_id, offer.building_key).first())?.rev) || 0;
    if (nowRev !== rev) return { error: 'offer-stale' };
    const still = await houseOf(db, offer.map_id, offer.building_key, offer.seller);
    if (!still) return { error: 'no-home' };
    const after = Number((await db.prepare('SELECT COUNT(*) AS n FROM homes WHERE player = ? AND char_id = ? AND guild_id IS NULL').bind(player.id, character).first())?.n) || 0;
    if (after >= HOME_CAP) return { error: 'home-cap' };
    return { error: 'offer-closed' };
  }
  return result;
}

/** Offer, accept, decline or cancel. The client names none of the gold, the owner, or the goods. */
export async function homeTransfer(ctx, player, body = {}) {
  if (body.op === 'offer') return offerHome(ctx, player, body);
  if (body.op === 'decline') return closeOffer(ctx.db, body.id, player.id, 'declined');
  if (body.op === 'cancel') return closeOffer(ctx.db, body.id, player.id, 'cancelled');
  if (body.op === 'accept') return acceptHome(ctx, player, body);
  return { error: 'bad-offer' };
}
