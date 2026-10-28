// @ts-check
// VIDEO1 — account-authoritative video surfaces on home paintings.
import { accountKind } from './accounts.js';
import { overRate } from './accounts.js';
import { CHAR_ID_RE } from './service.js';
import { homeMapIdOk, homeBuildingKeyOk } from '../../src/net/homeLaw.js';
import { DECOR_ID_RE } from '../../src/net/decorLaw.js';
import { OWNS } from './decor.js';
import { REALM_ID_RE } from './realm.js';
import {
  VIDEO_OPS_MAX, VIDEO_OPS_WINDOW_S,
  videoApplyCmd, videoStateOf, videoIsPaintingItem,
} from '../../src/net/videoSurfaceLaw.js';
import { mintVideoOrder } from '../../src/net/identityToken.js';
import { signingKey } from './signing.js';

function rowState(row) {
  return videoStateOf({
    mapId: row.map_id,
    buildingKey: row.building_key,
    pieceId: row.piece_id,
    provider: row.provider,
    sourceId: row.source_id,
    status: row.status,
    basePositionSeconds: row.base_position_seconds,
    serverStartedAt: row.server_started_at,
    updatedAt: row.updated_at,
    revision: row.revision,
  });
}

async function paintingPiece(db, mapId, buildingKey, id) {
  const row = await db.prepare(
    'SELECT item, yard FROM home_decor WHERE map_id = ? AND building_key = ? AND id = ?',
  ).bind(mapId, buildingKey, id).first();
  if (!row || row.yard) return null;
  let item = null;
  try { item = row.item ? JSON.parse(row.item) : null; } catch { return null; }
  return videoIsPaintingItem(item) ? item : null;
}

async function mayControl(db, player, mapId, buildingKey, character) {
  const mine = await db.prepare('SELECT 1 AS ok FROM realm_characters WHERE id = ? AND player = ?').bind(character, player.id).first();
  if (!mine) return { error: 'realm-only' };
  const owns = await db.prepare(`SELECT ${OWNS} AS owns`).bind(mapId, buildingKey, player.id, character).first();
  return owns?.owns ? { ok: true } : { error: 'decor-shut' };
}

/** List video surfaces for a home. Any visitor of the home may read. */
export async function videoSurfacesOf(ctx, player, body = {}) {
  const { db } = ctx;
  const { mapId, buildingKey, character } = body;
  if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(buildingKey)) return { error: 'bad-home' };
  if (typeof character !== 'string' || !CHAR_ID_RE.test(character) || !REALM_ID_RE.test(character)) return { error: 'realm-only' };
  const home = await db.prepare('SELECT 1 AS ok FROM homes WHERE map_id = ? AND building_key = ?').bind(mapId, buildingKey).first();
  if (!home) return { error: 'no-home' };
  const { results = [] } = await db.prepare(
    'SELECT * FROM home_video_surface WHERE map_id = ? AND building_key = ?',
  ).bind(mapId, buildingKey).all();
  const surfaces = [];
  for (const row of results) {
    const s = rowState(row);
    if (s) surfaces.push(s);
  }
  return { ok: true, surfaces };
}

/**
 * Apply a playback command. Answers `{ ok, surface, videoOrder? }` or `{ error }`.
 * @param {{ db: any, nowS: number }} ctx
 * @param {any} player
 * @param {any} body
 * @param {{ env?: any, subtle?: SubtleCrypto }} [sign]
 */
export async function videoSurfaceCmd(ctx, player, body = {}, sign = {}) {
  const { db, nowS } = ctx;
  const { mapId, buildingKey, character, id, op, url, seconds, position, rev } = body;
  if (accountKind(player) !== 'linked') return { error: 'homes-need-account' };
  if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(buildingKey)) return { error: 'bad-home' };
  if (typeof id !== 'string' || !DECOR_ID_RE.test(id)) return { error: 'bad-decor' };
  if (typeof character !== 'string' || !CHAR_ID_RE.test(character) || !REALM_ID_RE.test(character)) return { error: 'realm-only' };
  if (!Number.isSafeInteger(rev) || rev < 0) return { error: 'video-rev' };

  const gate = await mayControl(db, player, mapId, buildingKey, character);
  if (gate.error) return gate;
  if (!(await paintingPiece(db, mapId, buildingKey, id))) return { error: 'no-painting' };
  if (await overRate(ctx, `video:${player.id}`, VIDEO_OPS_MAX, VIDEO_OPS_WINDOW_S)) return { error: 'video-rate' };

  const nowMs = nowS * 1000;
  const priorRow = await db.prepare(
    'SELECT * FROM home_video_surface WHERE map_id = ? AND building_key = ? AND piece_id = ?',
  ).bind(mapId, buildingKey, id).first();
  const prior = priorRow ? rowState(priorRow) : null;
  const haveRev = prior?.revision ?? 0;
  if (haveRev !== rev) return { error: 'video-rev' };

  if (op === 'clear') {
    if (!prior) return { ok: true, surface: null, revision: 0 };
    await db.prepare(
      'DELETE FROM home_video_surface WHERE map_id = ? AND building_key = ? AND piece_id = ? AND revision = ?',
    ).bind(mapId, buildingKey, id, rev).run();
    return withOrder({ ok: true, surface: null, revision: rev + 1 }, player.id, mapId, buildingKey, id, rev + 1, sign, nowS);
  }

  const next = videoApplyCmd(prior, { op, url, seconds, position }, nowMs);
  if (next.error) return next;
  const nextRev = haveRev + 1;
  const state = videoStateOf({
    mapId, buildingKey, pieceId: id,
    ...next, revision: nextRev,
  });
  if (!state) return { error: 'bad-state' };

  await db.prepare(`
    INSERT INTO home_video_surface (
      map_id, building_key, piece_id, provider, source_id, status,
      base_position_seconds, server_started_at, updated_at, revision
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(map_id, building_key, piece_id) DO UPDATE SET
      provider = excluded.provider,
      source_id = excluded.source_id,
      status = excluded.status,
      base_position_seconds = excluded.base_position_seconds,
      server_started_at = excluded.server_started_at,
      updated_at = excluded.updated_at,
      revision = excluded.revision
    WHERE home_video_surface.revision = ?
  `).bind(
    mapId, buildingKey, id, state.provider, state.sourceId, state.status,
    state.basePositionSeconds, state.serverStartedAt, state.updatedAt, state.revision,
    rev,
  ).run();

  const again = await db.prepare(
    'SELECT * FROM home_video_surface WHERE map_id = ? AND building_key = ? AND piece_id = ?',
  ).bind(mapId, buildingKey, id).first();
  if (!again || again.revision !== nextRev) return { error: 'video-rev' };
  const surface = rowState(again);
  return withOrder({ ok: true, surface, revision: nextRev }, player.id, mapId, buildingKey, id, nextRev, sign, nowS);
}

async function withOrder(r, accountId, mapId, buildingKey, pieceId, revision, sign, nowS) {
  const { env, subtle } = sign;
  if (!env || !subtle || !r.ok) return r;
  try {
    const key = await signingKey(env, subtle);
    if (!key) return r;
    const videoOrder = await mintVideoOrder(
      { s: accountId, vm: mapId, vb: buildingKey, vs: pieceId, vr: revision },
      key, { subtle, nowS },
    );
    return { ...r, videoOrder };
  } catch {
    return r;
  }
}

/** Drop video rows for a removed piece. Call after a successful remove. */
export async function clearVideoForPiece(db, mapId, buildingKey, pieceId) {
  if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(buildingKey)) return;
  if (typeof pieceId !== 'string' || !DECOR_ID_RE.test(pieceId)) return;
  await db.prepare(
    'DELETE FROM home_video_surface WHERE map_id = ? AND building_key = ? AND piece_id = ?',
  ).bind(mapId, buildingKey, pieceId).run();
}

/** Drop every video row for a home (transfer / release). */
export async function clearVideoForHome(db, mapId, buildingKey) {
  if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(buildingKey)) return;
  await db.prepare(
    'DELETE FROM home_video_surface WHERE map_id = ? AND building_key = ?',
  ).bind(mapId, buildingKey).run();
}
