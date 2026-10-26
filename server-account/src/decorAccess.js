// @ts-check
// DECOR-ACCESS: who may open one container or one station. The owner always may.
// A guest's word that they are a friend or a guildmate is never read. Guild is the roster.
// Friends and party are the handles the owner sent when the row was set, resolved here and stored.
// A shared container's goods live in decor_bin, not in two saves at once.
import { accountKind, displayName } from './accounts.js';
import { CHAR_ID_RE } from './service.js';
import { homeMapIdOk, homeBuildingKeyOk } from '../../src/net/homeLaw.js';
import { homeSceneName } from '../../src/net/homeScene.js';
import { DECOR_ID_RE } from '../../src/net/decorLaw.js';
import { OWNS } from './decor.js';
import { dropIfUnnamed, dropObjects, getRealmBlob, mustChange, prepareRealmRecord, realmActFirst, realmSaveTextOf, realmSideOf, recordMovedOf, REALM_ID_RE } from './realm.js';
import { HANDLE_RE } from '../../src/net/handleShape.js';
import { ITEM_UID_RE, lawfulItem } from '../../src/systems/item/itemLaw.js';
import { absorbStack, stacksWith } from '../../src/systems/inventory.js';
import { mintItemId } from '../../src/systems/item/itemIds.js';
import { GUILD_RANK_RECRUIT, guildRankOk } from '../../src/net/guild/guildLaw.js';

const KINDS = new Set(['storage', 'station']);
const MODES = new Set(['private', 'guild', 'friends', 'party', 'chosen_friends']);
const storedMode = (mode) => (mode === 'chosen_friends' ? 'friends' : mode);
const FRIENDS_MAX = 24;

const homeOf = (db, mapId, buildingKey) => db.prepare('SELECT player, char_id, guild_id FROM homes WHERE map_id = ? AND building_key = ?').bind(mapId, buildingKey).first();

function owns(db, mapId, buildingKey, player, character) {
  return db.prepare(`SELECT ${OWNS} AS owns`).bind(mapId, buildingKey, player.id, character).first();
}

async function pieceKind(db, mapId, buildingKey, id, kind) {
  const row = await db.prepare('SELECT place FROM home_decor WHERE map_id = ? AND building_key = ? AND id = ? AND yard = 0').bind(mapId, buildingKey, id).first();
  if (!row) return null;
  let place = null;
  try { place = JSON.parse(row.place); } catch { return null; }
  if (kind === 'storage' && !place?.storage) return null;
  if (kind === 'station' && !place?.station) return null;
  return place;
}

// shortcut: a chest left open past this can be opened by someone else; refresh the hold from the window when a sort runs longer
const HOLD_S = 180;
const holdRow = (db, mapId, buildingKey, id) => db.prepare('SELECT player, char_id, until FROM decor_hold WHERE map_id = ? AND building_key = ? AND piece_id = ?').bind(mapId, buildingKey, id).first();
const heldByOther = (row, player, character, nowS) => !!(row && row.until > nowS && !(row.player === player.id && row.char_id === character));

async function takeHold(db, player, character, mapId, buildingKey, id, nowS) {
  // One statement: a live hold is not replaced. Two opens that both saw an empty row cannot both succeed.
  const wrote = await db.prepare(`INSERT INTO decor_hold (map_id, building_key, piece_id, player, char_id, until) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(map_id, building_key, piece_id) DO UPDATE SET player = excluded.player, char_id = excluded.char_id, until = excluded.until
    WHERE decor_hold.until <= ? OR (decor_hold.player = excluded.player AND decor_hold.char_id = excluded.char_id)`)
    .bind(mapId, buildingKey, id, player.id, character, nowS + HOLD_S, nowS).run();
  return wrote?.meta?.changes ? { ok: true } : { error: 'decor-busy' };
}

async function ourHold(db, player, character, mapId, buildingKey, id, nowS) {
  const row = await holdRow(db, mapId, buildingKey, id);
  return !!(row && row.until > nowS && row.player === player.id && row.char_id === character);
}

function uidList(raw) {
  if (raw == null) return [];
  if (!Array.isArray(raw) || raw.length > 500) return null;
  const out = [];
  for (const u of raw) {
    if (typeof u !== 'string' || !ITEM_UID_RE.test(u) || out.includes(u)) return null;
    out.push(u);
  }
  return out;
}

/** A stack taken in part: `leave` stays in the chest, the rest goes to the pack. */
function cutList(raw) {
  if (raw == null) return [];
  if (!Array.isArray(raw) || raw.length > 100) return null;
  const out = [];
  for (const c of raw) {
    if (typeof c?.uid !== 'string' || !ITEM_UID_RE.test(c.uid) || !Number.isInteger(c.leave) || c.leave < 1 || out.some((x) => x.uid === c.uid)) return null;
    out.push({ uid: c.uid, leave: c.leave });
  }
  return out;
}

function goodsIn(save, id) {
  const found = [];
  for (const scene of save?.sceneCache?.scenes ?? []) {
    const list = scene?.decorItems?.[id];
    if (Array.isArray(list)) found.push(...list);
  }
  return found;
}

function clearPiece(save, id) {
  for (const scene of save?.sceneCache?.scenes ?? []) if (scene?.decorItems?.[id]) delete scene.decorItems[id];
}

/** The lowest rank that may open a hall piece. No row, and anything that is not a rank, is the whole guild. Higher ranks may too. */
function hallCutoff(row) {
  if (!row || row.mode !== 'guild' || typeof row.friends !== 'string' || !/^[0-3]$/.test(row.friends)) return GUILD_RANK_RECRUIT;
  return Number(row.friends);
}

/** A hall's chest is the guild's. The rank is the roster's, never the request's. */
async function hallMay(db, home, player, character, id, kind) {
  const member = await db.prepare('SELECT rank FROM guild_members WHERE guild_id = ? AND player = ? AND char_id = ?').bind(home.guild_id, player.id, character).first();
  if (!member || !guildRankOk(member.rank)) return { error: 'decor-shut' };
  const row = await db.prepare('SELECT mode, friends FROM decor_access WHERE map_id = ? AND building_key = ? AND piece_id = ? AND kind = ?').bind(home.map_id, home.building_key, id, kind).first();
  return member.rank <= hallCutoff(row) ? { ok: true } : { error: 'decor-shut' };
}

/** Whether this account may use the piece. The owner always may. No row is private. A hall has no one owner. */
export async function decorMay(ctx, player, body) {
  const { db } = ctx;
  const { mapId, buildingKey, character, id, kind } = body ?? {};
  if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(buildingKey)) return { error: 'bad-home' };
  if (typeof id !== 'string' || !DECOR_ID_RE.test(id) || !KINDS.has(kind)) return { error: 'bad-decor' };
  if (typeof character !== 'string' || !CHAR_ID_RE.test(character) || !REALM_ID_RE.test(character)) return { error: 'realm-only' };
  const mine = await db.prepare('SELECT 1 AS ok FROM realm_characters WHERE id = ? AND player = ?').bind(character, player.id).first();
  if (!mine) return { error: 'realm-only' };
  const home = await homeOf(db, mapId, buildingKey);
  if (!home) return { error: 'no-home' };
  if (home.guild_id != null) return hallMay(db, { ...home, map_id: mapId, building_key: buildingKey }, player, character, id, kind);
  if (home.player === player.id) return { ok: true, owner: true };
  const row = await db.prepare('SELECT mode, friends FROM decor_access WHERE map_id = ? AND building_key = ? AND piece_id = ? AND kind = ?').bind(mapId, buildingKey, id, kind).first();
  if (!row || row.mode === 'private') return { error: 'decor-shut' };
  if (row.mode === 'guild') {
    const hit = await db.prepare(`SELECT 1 AS ok FROM guild_members a JOIN guild_members b ON b.guild_id = a.guild_id
      WHERE a.player = ? AND a.char_id = ? AND b.player = ? AND b.char_id = ?`).bind(home.player, home.char_id, player.id, character).first();
    return hit ? { ok: true } : { error: 'decor-shut' };
  }
  if (row.mode !== 'friends' && row.mode !== 'party' && row.mode !== 'chosen_friends') return { error: 'decor-shut' };
  let ids = [];
  try { ids = JSON.parse(row.friends); } catch { ids = []; }
  return Array.isArray(ids) && ids.includes(player.id) ? { ok: true } : { error: 'decor-shut' };
}

async function namesOf(db, ids) {
  const names = [];
  for (const id of ids) {
    const row = await db.prepare('SELECT handle, guest_name FROM players WHERE id = ?').bind(id).first();
    if (row) names.push(displayName(row));
  }
  return names;
}

/** The owner sets one piece's access. Names are usernames. The answer names them back and never an account id. */
export async function setDecorAccess(ctx, player, body) {
  const { db, nowS } = ctx;
  const { mapId, buildingKey, character, id, kind, mode } = body ?? {};
  if (accountKind(player) !== 'linked') return { error: 'homes-need-account' };
  if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(buildingKey)) return { error: 'bad-home' };
  if (typeof id !== 'string' || !DECOR_ID_RE.test(id) || !KINDS.has(kind) || !MODES.has(mode)) return { error: 'bad-decor' };
  if (typeof character !== 'string' || !REALM_ID_RE.test(character)) return { error: 'realm-only' };
  if (!(await pieceKind(db, mapId, buildingKey, id, kind))) return { error: 'no-decor' };
  if (!(await owns(db, mapId, buildingKey, player, character))?.owns) return { error: 'no-home' };
  const kept = storedMode(mode);
  const home = await homeOf(db, mapId, buildingKey);
  if (home?.guild_id != null) {
    if (!guildRankOk(body.rank)) return { error: 'bad-decor' };
    await db.prepare(`INSERT INTO decor_access (map_id, building_key, piece_id, kind, mode, friends) VALUES (?, ?, ?, ?, 'guild', ?)
      ON CONFLICT(map_id, building_key, piece_id, kind) DO UPDATE SET mode = 'guild', friends = excluded.friends`)
      .bind(mapId, buildingKey, id, kind, String(body.rank)).run();
    return { ok: true, mode: 'guild', rank: body.rank, names: [], at: nowS };
  }
  /** @type {string[]} */
  const ids = [];
  if (kept === 'friends' || kept === 'party') {
    const names = Array.isArray(body.names) ? body.names : [];
    if (names.length > FRIENDS_MAX) return { error: 'bad-decor' };
    const strict = mode === 'chosen_friends';
    for (const name of names) {
      if (typeof name !== 'string' || !HANDLE_RE.test(name)) { if (strict) return { error: 'no-reader' }; continue; }
      const who = await db.prepare('SELECT id, handle FROM players WHERE handle_lc = ?').bind(name.toLowerCase()).first();
      if (!who?.handle || who.id === player.id) { if (strict) return { error: 'no-reader' }; continue; }
      if (!ids.includes(who.id)) ids.push(who.id);
    }
  }
  const wrote = () => ({ ok: true, mode: kept, names: kept === 'private' ? [] : undefined, at: nowS });
  if (home?.guild_id != null || kind !== 'storage') {
    await accessStep(db, mapId, buildingKey, id, kind, kept, ids).run();
    const answer = wrote();
    if (kept !== 'private') answer.names = await namesOf(db, ids);
    return answer;
  }
  return moveChest(ctx, player, { mapId, buildingKey, character, id, kind, kept, ids, realm: body.realm, at: nowS });
}

function accessStep(db, mapId, buildingKey, id, kind, kept, ids) {
  if (kept === 'private') return db.prepare('DELETE FROM decor_access WHERE map_id = ? AND building_key = ? AND piece_id = ? AND kind = ?').bind(mapId, buildingKey, id, kind);
  return db.prepare(`INSERT INTO decor_access (map_id, building_key, piece_id, kind, mode, friends) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(map_id, building_key, piece_id, kind) DO UPDATE SET mode = excluded.mode, friends = excluded.friends`)
    .bind(mapId, buildingKey, id, kind, kept, JSON.stringify(ids));
}

/** A personal chest's goods and its access move together. A good with no uid is marked here, and is not left behind. */
async function moveChest(ctx, player, { mapId, buildingKey, character, id, kind, kept, ids, realm, at }) {
  const { db } = ctx;
  const blob = await getRealmBlob(ctx, player.id, character);
  if (!blob.ok) return blob;
  let save = null;
  try { save = JSON.parse(await realmSaveTextOf(blob.object)); } catch { return { error: 'no-data' }; }
  const found = goodsIn(save, id);
  const marked = (it) => typeof it?.uid === 'string' && ITEM_UID_RE.test(it.uid);
  const seen = new Set();
  const moving = kept === 'private' ? [] : found.map((it) => {
    let uid = marked(it) ? it.uid : null;
    if (!uid || seen.has(uid)) uid = mintItemId(ctx.rand);
    seen.add(uid);
    return uid === it.uid ? it : { ...it, uid };
  });
  const { results: held = [] } = await db.prepare('SELECT uid, item FROM decor_bin WHERE map_id = ? AND building_key = ? AND piece_id = ?').bind(mapId, buildingKey, id).all();
  /** @type {any[]} */
  const back = [];
  if (kept === 'private') {
    for (const row of held) {
      try { const item = JSON.parse(row.item); if (marked(item)) back.push(item); } catch { /* a torn row is not poured */ }
    }
  }
  const names = kept === 'private' ? [] : await namesOf(db, ids);
  if (!moving.length && !back.length) {
    await accessStep(db, mapId, buildingKey, id, kind, kept, ids).run();
    return { ok: true, mode: kept, names, at };
  }
  const side = await realmActFirst(db, player.id, character, realm);
  if (side.error || !side.at) return side.error ? side : { error: 'realm-needed' };
  const have = new Set(goodsIn(save, id).map((it) => it?.uid));
  const pour = back.filter((it) => !have.has(it.uid));
  const prep = await prepareRealmRecord(ctx, player.id, side.at, (live) => {
    if (moving.length) clearPiece(live, id);
    if (pour.length) {
      // HOME-POUR: the home's own scene, the one the owner's client reads for it. The building's scene is a stranger's
      // visit: the client never reads it for its own home, and the next world move clears it.
      const name = homeSceneName(mapId, buildingKey);
      live.sceneCache ??= { scenes: [] };
      if (!Array.isArray(live.sceneCache.scenes)) live.sceneCache.scenes = [];
      if (!Array.isArray(live.sceneCache.permanentScenes)) live.sceneCache.permanentScenes = [];
      if (!live.sceneCache.permanentScenes.includes(name)) live.sceneCache.permanentScenes.push(name);
      let scene = live.sceneCache.scenes.find((s) => s?.sceneName === name);
      if (!scene) { scene = { sceneName: name }; live.sceneCache.scenes.push(scene); }
      const there = new Set(goodsIn(live, id).map((it) => it?.uid));
      const list = Array.isArray(scene.decorItems?.[id]) ? scene.decorItems[id] : [];
      scene.decorItems = { ...(scene.decorItems ?? {}), [id]: [...list, ...pour.filter((it) => !there.has(it.uid))] };
    }
    return null;
  });
  if (prep.error) return prep;
  const steps = [
    ...prep.steps,
    accessStep(db, mapId, buildingKey, id, kind, kept, ids),
    ...(kept === 'private' ? [db.prepare('DELETE FROM decor_bin WHERE map_id = ? AND building_key = ? AND piece_id = ?').bind(mapId, buildingKey, id)] : []),
    ...moving.map((item) => db.prepare('INSERT OR IGNORE INTO decor_bin (map_id, building_key, piece_id, uid, item) VALUES (?, ?, ?, ?, ?)').bind(mapId, buildingKey, id, item.uid, JSON.stringify(item))),
  ];
  const answer = { ok: true, mode: kept, names, at, realm: { seq: prep.seq }, ...(moving.length ? { moved: true } : {}), ...(back.length ? { restored: back } : {}) };
  try { await db.batch(steps); } catch {
    const landed = await dropIfUnnamed(db, ctx.bucket, player.id, side.at.id, prep.key);
    if (landed) return answer;
    return (await recordMovedOf(db, player.id, side.at)) ?? { error: 'decor-held' };
  }
  await dropObjects(ctx.bucket, [prep.prev]);
  return answer;
}

/** A hall's pieces are the guild's. No row is every member; a rank lets in that rank and every higher one. */
async function hallGrants(db, home, player, character, mapId, buildingKey) {
  const member = typeof character === 'string'
    ? await db.prepare('SELECT rank FROM guild_members WHERE guild_id = ? AND player = ? AND char_id = ?').bind(home.guild_id, player.id, character).first()
    : null;
  if (!member || !guildRankOk(member.rank)) return { ok: true, storage: [], station: [], bin: [] };
  const pieces = await db.prepare('SELECT id, place FROM home_decor WHERE map_id = ? AND building_key = ? AND yard = 0').bind(mapId, buildingKey).all();
  const { results: rows = [] } = await db.prepare('SELECT piece_id, kind, mode, friends FROM decor_access WHERE map_id = ? AND building_key = ?').bind(mapId, buildingKey).all();
  const access = new Map(rows.map((row) => [`${row.kind}:${row.piece_id}`, row]));
  const storage = [];
  const station = [];
  const use = [];
  for (const row of pieces.results ?? []) {
    let place = null;
    try { place = JSON.parse(row.place); } catch { place = null; }
    const kind = place?.storage ? 'storage' : place?.station ? 'station' : null;
    if (!kind) continue;
    const set = access.get(`${kind}:${row.id}`);
    if (member.rank > hallCutoff(set)) continue;
    if (kind === 'storage') storage.push(row.id);
    else station.push(row.id);
    if (set) use.push({ id: row.id, mode: 'guild', rank: hallCutoff(set) });
  }
  const bin = [];
  const held = await db.prepare('SELECT DISTINCT piece_id FROM decor_bin WHERE map_id = ? AND building_key = ?').bind(mapId, buildingKey).all();
  for (const row of held.results ?? []) if (storage.includes(row.piece_id)) bin.push(row.piece_id);
  return { ok: true, storage, station, bin, use };
}

async function decorGrants(ctx, player, body) {
  const { db } = ctx;
  const { mapId, buildingKey, character } = body ?? {};
  if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(buildingKey)) return { error: 'bad-home' };
  const home = await homeOf(db, mapId, buildingKey);
  if (!home) return { error: 'no-home' };
  if (home.guild_id != null) return hallGrants(db, home, player, character, mapId, buildingKey);
  const { results = [] } = await db.prepare('SELECT piece_id, kind, mode, friends FROM decor_access WHERE map_id = ? AND building_key = ?').bind(mapId, buildingKey).all();
  const storage = [];
  const station = [];
  const bin = [];
  const use = [];
  const owner = home.player === player.id;
  let guild = false;
  if (!owner && typeof character === 'string') {
    const hit = await db.prepare(`SELECT 1 AS ok FROM guild_members a JOIN guild_members b ON b.guild_id = a.guild_id
      WHERE a.player = ? AND a.char_id = ? AND b.player = ? AND b.char_id = ?`).bind(home.player, home.char_id, player.id, character).first();
    guild = !!hit;
  }
  for (const row of results) {
    let ids = [];
    try { ids = JSON.parse(row.friends); } catch { ids = []; }
    const named = (row.mode === 'friends' || row.mode === 'party' || row.mode === 'chosen_friends') && Array.isArray(ids) && ids.includes(player.id);
    const allowed = owner || (row.mode === 'guild' && guild) || named;
    if (owner && row.mode !== 'private') use.push({ id: row.piece_id, mode: row.mode === 'chosen_friends' ? 'friends' : row.mode });
    if (!allowed) continue;
    if (row.kind === 'storage') storage.push(row.piece_id);
    else station.push(row.piece_id);
  }
  if (owner) {
    const pieces = await db.prepare('SELECT id, place FROM home_decor WHERE map_id = ? AND building_key = ? AND yard = 0').bind(mapId, buildingKey).all();
    for (const row of pieces.results ?? []) {
      let place = null;
      try { place = JSON.parse(row.place); } catch { place = null; }
      if (place?.storage && !storage.includes(row.id)) storage.push(row.id);
      if (place?.station && !station.includes(row.id)) station.push(row.id);
    }
  }
  const held = await db.prepare('SELECT DISTINCT piece_id FROM decor_bin WHERE map_id = ? AND building_key = ?').bind(mapId, buildingKey).all();
  for (const row of held.results ?? []) if (storage.includes(row.piece_id)) bin.push(row.piece_id);
  return { ok: true, storage, station, bin, ...(owner ? { use } : {}) };
}

async function decorDeposit(ctx, player, body) {
  const gate = await decorMay(ctx, player, { ...body, kind: 'storage' });
  if (gate.error) return gate;
  const { mapId, buildingKey, character, id, item, realm } = body;
  if (!item || typeof item !== 'object' || !ITEM_UID_RE.test(item.uid)) return { error: 'bad-item' };
  if (heldByOther(await holdRow(ctx.db, mapId, buildingKey, id), player, character, ctx.nowS)) return { error: 'decor-busy' };
  const have = await ctx.db.prepare('SELECT 1 AS ok FROM decor_bin WHERE map_id = ? AND building_key = ? AND piece_id = ? AND uid = ?').bind(mapId, buildingKey, id, item.uid).first();
  if (have) return { ok: true, repeat: true };
  const side = realmSideOf(character, realm);
  if (side.error) return side;
  const blob = await getRealmBlob(ctx, player.id, character);
  if (!blob.ok) return blob;
  let save = null;
  try { save = JSON.parse(await realmSaveTextOf(blob.object)); } catch { return { error: 'no-data' }; }
  const carried = (save.items ?? []).find((it) => it?.uid === item.uid);
  if (!carried) return { error: 'no-item' };
  const prep = await prepareRealmRecord(ctx, player.id, side.at, (live) => {
    const list = live.items;
    if (!Array.isArray(list)) return 'no-item';
    const at = list.findIndex((it) => it?.uid === item.uid);
    if (at < 0) return 'no-item';
    list.splice(at, 1);
    return null;
  });
  if (prep.error) return prep;
  try {
    await ctx.db.batch([
      ...prep.steps,
      ctx.db.prepare('INSERT INTO decor_bin (map_id, building_key, piece_id, uid, item) VALUES (?, ?, ?, ?, ?)').bind(mapId, buildingKey, id, carried.uid, JSON.stringify(carried)),
      mustChange(ctx.db),
    ]);
  } catch {
    const landed = await dropIfUnnamed(ctx.db, ctx.bucket, player.id, side.at.id, prep.key);
    if (landed) return { ok: true, repeat: true, realm: { seq: prep.seq } };
    return { error: 'decor-held' };
  }
  await dropObjects(ctx.bucket, [prep.prev]);
  return { ok: true, item: carried, realm: { seq: prep.seq } };
}

async function decorWithdraw(ctx, player, body) {
  const gate = await decorMay(ctx, player, { ...body, kind: 'storage' });
  if (gate.error) return gate;
  const { mapId, buildingKey, character, id, uid, realm } = body;
  if (!ITEM_UID_RE.test(uid)) return { error: 'bad-item' };
  if (heldByOther(await holdRow(ctx.db, mapId, buildingKey, id), player, character, ctx.nowS)) return { error: 'decor-busy' };
  const row = await ctx.db.prepare('SELECT item FROM decor_bin WHERE map_id = ? AND building_key = ? AND piece_id = ? AND uid = ?').bind(mapId, buildingKey, id, uid).first();
  if (!row) return { error: 'no-item' };
  let item = null;
  try { item = JSON.parse(row.item); } catch { return { error: 'no-item' }; }
  const side = realmSideOf(character, realm);
  if (side.error) return side;
  const prep = await prepareRealmRecord(ctx, player.id, side.at, (live) => {
    if (!Array.isArray(live.items)) live.items = [];
    if (live.items.some((it) => it?.uid === uid)) return 'decor-held';
    live.items.push(item);
    return null;
  });
  if (prep.error) return prep;
  try {
    await ctx.db.batch([
      ...prep.steps,
      ctx.db.prepare('DELETE FROM decor_bin WHERE map_id = ? AND building_key = ? AND piece_id = ? AND uid = ?').bind(mapId, buildingKey, id, uid),
      mustChange(ctx.db),
    ]);
  } catch {
    await dropIfUnnamed(ctx.db, ctx.bucket, player.id, side.at.id, prep.key);
    return { error: 'decor-held' };
  }
  await dropObjects(ctx.bucket, [prep.prev]);
  return { ok: true, item, realm: { seq: prep.seq } };
}

/** The window's moves, one write: uids into the chest and uids out of it. The items are the save's and the bin's. */
async function decorSettle(ctx, player, body) {
  const gate = await decorMay(ctx, player, { ...body, kind: 'storage' });
  if (gate.error) return gate;
  const { db, bucket } = ctx;
  const { mapId, buildingKey, character, id, realm } = body;
  if (!(await ourHold(db, player, character, mapId, buildingKey, id, ctx.nowS))) return { error: 'decor-busy' };
  const put = uidList(body.put);
  const take = uidList(body.take);
  const cuts = cutList(body.cut);
  const release = db.prepare('DELETE FROM decor_hold WHERE map_id = ? AND building_key = ? AND piece_id = ? AND player = ? AND char_id = ?').bind(mapId, buildingKey, id, player.id, character);
  if (!put || !take || !cuts || put.some((u) => take.includes(u) || cuts.some((c) => c.uid === u)) || take.some((u) => cuts.some((c) => c.uid === u))) { await release.run(); return { error: 'bad-item' }; }
  if (!put.length && !take.length && !cuts.length) { await release.run(); return { ok: true }; }
  const { results = [] } = await db.prepare('SELECT uid, item FROM decor_bin WHERE map_id = ? AND building_key = ? AND piece_id = ?').bind(mapId, buildingKey, id).all();
  const bin = new Map();
  const raw = new Map();
  for (const row of results) {
    raw.set(row.uid, row.item);
    try { bin.set(row.uid, JSON.parse(row.item)); } catch { /* a torn row is not a good */ }
  }
  for (const uid of take) if (!bin.get(uid)) { await release.run(); return { error: 'no-item' }; }
  for (const uid of put) if (bin.has(uid)) { await release.run(); return { error: 'decor-held' }; }
  const portions = [];
  for (const cut of cuts) {
    const item = bin.get(cut.uid);
    const stack = item?.stackCount ?? 1;
    if (!item || stack <= cut.leave) { await release.run(); return { error: 'no-item' }; }
    portions.push({ cut, item, raw: raw.get(cut.uid), give: { ...item, uid: mintItemId(), stackCount: stack - cut.leave } });
  }
  const side = realmSideOf(character, realm);
  if (side.error) { await release.run(); return side; }
  const carried = new Map();
  const prep = await prepareRealmRecord(ctx, player.id, side.at, (live) => {
    const list = live.items;
    if (!Array.isArray(list)) return 'no-item';
    for (const uid of put) {
      const at = list.findIndex((it) => it?.uid === uid);
      if (at < 0) return 'no-item';
      carried.set(uid, list[at]);
      list.splice(at, 1);
    }
    for (const uid of take) {
      const incoming = bin.get(uid);
      // The window already counted a gold pile into the purse. The row leaves; a second pile would pay it twice.
      if (incoming?.group === 'Currency' && incoming?.templateIndex === 276) continue;
      // Already in this save: a close that landed in the pack and not the bin. Drop the chest's row, do not grant a second.
      if (list.some((it) => it?.uid === uid)) continue;
      list.push(incoming);
    }
    for (const part of portions) {
      if (part.give?.group === 'Currency' && part.give?.templateIndex === 276) continue;
      if (list.some((it) => it?.uid === part.give.uid)) return 'decor-held';
      list.push(part.give);
    }
    return null;
  });
  if (prep.error) { await release.run(); return prep; }
  // Two piles of one good are one pile. The window sent each stack whole; the count is added here, once.
  const hosts = [];
  for (const [uid, item] of bin) {
    if (take.includes(uid) || cuts.some((c) => c.uid === uid)) continue;
    hosts.push({ uid, item, raw: raw.get(uid), bin: true, grown: false });
  }
  const absorbed = new Set();
  for (const uid of put) {
    const item = carried.get(uid);
    const host = hosts.find((h) => stacksWith(h.item, item));
    if (!host) { hosts.push({ uid, item, bin: false, grown: false }); continue; }
    absorbStack(host.item, item);
    host.grown = true;
    absorbed.add(uid);
  }
  try {
    await db.batch([
      ...prep.steps,
      ...put.filter((uid) => !absorbed.has(uid)).map((uid) => db.prepare('INSERT INTO decor_bin (map_id, building_key, piece_id, uid, item) VALUES (?, ?, ?, ?, ?)').bind(mapId, buildingKey, id, uid, JSON.stringify(carried.get(uid)))),
      ...hosts.filter((h) => h.bin && h.grown).flatMap((h) => [
        db.prepare('UPDATE decor_bin SET item = ? WHERE map_id = ? AND building_key = ? AND piece_id = ? AND uid = ? AND item = ?').bind(JSON.stringify(h.item), mapId, buildingKey, id, h.uid, h.raw),
        mustChange(db),
      ]),
      ...take.flatMap((uid) => [
        db.prepare('DELETE FROM decor_bin WHERE map_id = ? AND building_key = ? AND piece_id = ? AND uid = ?').bind(mapId, buildingKey, id, uid),
        mustChange(db),
      ]),
      ...portions.flatMap((part) => [
        db.prepare('UPDATE decor_bin SET item = ? WHERE map_id = ? AND building_key = ? AND piece_id = ? AND uid = ? AND item = ?').bind(JSON.stringify({ ...part.item, stackCount: part.cut.leave }), mapId, buildingKey, id, part.cut.uid, part.raw),
        mustChange(db),
      ]),
      release,
      mustChange(db),
    ]);
  } catch {
    const landed = await dropIfUnnamed(db, bucket, player.id, side.at.id, prep.key);
    if (landed) return { ok: true, repeat: true, realm: { seq: prep.seq } };
    await release.run();
    return { error: 'decor-held' };
  }
  await dropObjects(bucket, [prep.prev]);
  return { ok: true, realm: { seq: prep.seq } };
}

/** The guildmaster's vault, into this chest. The pieces never pass through a pack. */
async function decorVault(ctx, player, body) {
  const gate = await decorMay(ctx, player, { ...body, kind: 'storage' });
  if (gate.error) return gate;
  const { db, nowS } = ctx;
  const { mapId, buildingKey, character, id } = body;
  if (!(await ourHold(db, player, character, mapId, buildingKey, id, nowS))) return { error: 'decor-busy' };
  const home = await homeOf(db, mapId, buildingKey);
  if (!home?.guild_id) return { error: 'decor-shut' };
  const member = await db.prepare('SELECT rank FROM guild_members WHERE guild_id = ? AND player = ? AND char_id = ?').bind(home.guild_id, player.id, character).first();
  if (!member || Number(member.rank) !== 0) return { error: 'decor-shut' };
  const { results = [] } = await db.prepare('SELECT slot, rec, name, count, at FROM guild_vault WHERE guild_id = ? ORDER BY slot').bind(home.guild_id).all();
  const { results: have = [] } = await db.prepare('SELECT uid FROM decor_bin WHERE map_id = ? AND building_key = ? AND piece_id = ?').bind(mapId, buildingKey, id).all();
  const seen = new Set(have.map((row) => row.uid));
  const moved = [];
  for (const row of results) {
    let rec = null;
    try { rec = JSON.parse(row.rec); } catch { rec = null; }
    if (!rec || !lawfulItem(rec)) continue;
    let uid = typeof rec.uid === 'string' && ITEM_UID_RE.test(rec.uid) && !seen.has(rec.uid) ? rec.uid : mintItemId();
    while (seen.has(uid)) uid = mintItemId();
    seen.add(uid);
    moved.push({ row, item: { ...rec, uid } });
  }
  if (!moved.length) return { ok: true, items: [] };
  const who = displayName(player);
  try {
    await db.batch([
      ...moved.flatMap((m) => [
        db.prepare('DELETE FROM guild_vault WHERE guild_id = ? AND slot = ? AND at = ? AND rec = ?').bind(home.guild_id, m.row.slot, Number(m.row.at), m.row.rec),
        mustChange(db),
        db.prepare('INSERT INTO decor_bin (map_id, building_key, piece_id, uid, item) VALUES (?, ?, ?, ?, ?)').bind(mapId, buildingKey, id, m.item.uid, JSON.stringify(m.item)),
        db.prepare("INSERT INTO guild_vault_log (guild_id, at, who, kind, name, count) VALUES (?, ?, ?, 'take', ?, ?)").bind(home.guild_id, nowS, who, m.row.name, Number(m.row.count)),
      ]),
      db.prepare('INSERT INTO realm_tx_guard (moved, expected) SELECT 0, 1 WHERE NOT EXISTS (SELECT 1 FROM guild_members WHERE guild_id = ? AND player = ? AND char_id = ? AND rank = 0)').bind(home.guild_id, player.id, character),
    ]);
  } catch {
    return { error: 'guild-vault-moved' };
  }
  return { ok: true, items: moved.map((m) => m.item) };
}

/** One door. `op` is set, grants, open, deposit, withdraw, settle, vault or craft. */
export async function decorUse(ctx, player, body = {}) {
  if (body.op === 'set') return setDecorAccess(ctx, player, body);
  if (body.op === 'grants') return decorGrants(ctx, player, body);
  if (body.op === 'deposit') return decorDeposit(ctx, player, body);
  if (body.op === 'withdraw') return decorWithdraw(ctx, player, body);
  if (body.op === 'settle') return decorSettle(ctx, player, body);
  if (body.op === 'vault') return decorVault(ctx, player, body);
  if (body.op === 'release') {
    const { mapId, buildingKey, character, id } = body;
    if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(buildingKey) || typeof id !== 'string' || !DECOR_ID_RE.test(id)) return { error: 'bad-decor' };
    if (typeof character !== 'string' || !REALM_ID_RE.test(character)) return { error: 'realm-only' };
    await ctx.db.prepare('DELETE FROM decor_hold WHERE map_id = ? AND building_key = ? AND piece_id = ? AND player = ? AND char_id = ?').bind(mapId, buildingKey, id, player.id, character).run();
    return { ok: true };
  }
  if (body.op === 'list') {
    const gate = await decorMay(ctx, player, { ...body, kind: 'storage' });
    if (gate.error) return gate;
    if (body.hold === true) {
      const held = await takeHold(ctx.db, player, body.character, body.mapId, body.buildingKey, body.id, ctx.nowS);
      if (held.error) return held;
    }
    const { results = [] } = await ctx.db.prepare('SELECT item FROM decor_bin WHERE map_id = ? AND building_key = ? AND piece_id = ?').bind(body.mapId, body.buildingKey, body.id).all();
    const items = [];
    for (const row of results) { try { items.push(JSON.parse(row.item)); } catch { /* a torn row is not shown */ } }
    const home = await homeOf(ctx.db, body.mapId, body.buildingKey);
    const member = home?.guild_id ? await ctx.db.prepare('SELECT rank FROM guild_members WHERE guild_id = ? AND player = ? AND char_id = ?').bind(home.guild_id, player.id, body.character).first() : null;
    return { ok: true, items, ...(Number(member?.rank) === 0 ? { master: true } : {}) };
  }
  if (body.op === 'craft' || body.op === 'open') {
    const gate = await decorMay(ctx, player, { ...body, kind: body.op === 'craft' ? 'station' : body.kind });
    return gate.error ? gate : { ok: true };
  }
  return { error: 'bad-decor' };
}
