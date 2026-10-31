// @ts-check
// AURUM-CACHES (2026-10-30, the owner: "Also Aurum caches"; bible/06-Systems/Aurum.md section 3a): AN AURUM COFFER IN A
// DUNGEON. The dungeon host stands one in every dungeon (CACHES-ONCE: net/aurumCacheLaw.js), beside one of its treasure
// piles picked by the cache's hash, so every client stands it in one place. Pressed, it asks the account service
// (accountAurumCache) and opens on its yes; one this account emptied stands open on every visit. Online and signed in.
// THE FOUR HOSTS: scenes/dungeonContext.js stands it and its takeLoot presses it, worldModes.js's and dungeon.js's loot
// arms carry the key there; world.js and exterior.js (the street) stand none. Not a DFU member. Ledger A (AURUM-CACHES).
import { aurumCacheDungeonKey, aurumCacheIdOk, aurumCacheSpotOf, AURUM_CACHE_AURUM } from '../net/aurumCacheLaw.js';
import { AURUM_COFFER_ARCHIVE, AURUM_COFFER_ART, AURUM_COFFER_SIZE, registerAurumCofferArt } from '../world/aurumCofferArt.js';
import { AURUM_COFFER_MODELS } from '../world/chestModel.js';
import { trs } from '../world/mat4.js';
import { addVendorTextures } from '../systems/textureReplacement.js';
import { accountAurumCache, accountRefusalText, storedSession } from '../net/accountClient.js';
import { cacheProofFor } from '../net/cacheProof.js';
import { appStorage } from '../systems/appStorage.js';
import { isOnlinePage } from '../systems/online/onlineLane.js';
import { isHallMapId } from '../net/wire.js';
import { dungeonIdOf } from './dungeonIdentity.js';
import { madeLevelOf } from '../systems/madeLevel.js';
import { dungeonTier } from '../systems/dungeon/dungeonTier.js';
import { isArenaFloor } from '../world/arena/arenaFloor.js';
import { isArenaUndercroft } from '../world/arena/arenaCity.js';
import { RAY_DISTANCE, TREASURE_ACTIVATION_DISTANCE } from '../player/activate.js';
import { GLOBAL_SCALE } from '../world/meshReader.js';
import { audio as defaultAudio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
import { t } from '../systems/textManager.js';
import { setMidScreenText } from '../ui/midScreenText.js';

registerAurumCofferArt(addVendorTextures);   // the import is the registration (world/festivalArt.js's law)

/** The coffer's activation key: the press ladders' loot arm hands it to the context's takeLoot, whose `aurum` arm presses it. */
export const AURUM_CACHE_KEY = 'aurum:cache';
/** AUDIT-STOREFRONT III D1: the coffer's box stands AURUM_CACHE_GAP_M clear of its pile's (the pile's size from the
 *  archive) and half that clear of every pile's, door's and mover's (no tie at its own pile's edge); the way to it is
 *  clear at knee height to AURUM_CACHE_CLEAR_M past its foot, no wall within AURUM_CACHE_SIDE_M of it any eighth round
 *  at shin or knee height (none cuts its picture), and its foot within AURUM_CACHE_STEP_M of the pile's floor (no
 *  coffer off a ledge). Metres. */
export const AURUM_CACHE_GAP_M = 0.15;
export const AURUM_CACHE_CLEAR_M = 0.6;
export const AURUM_CACHE_SIDE_M = 0.45;
export const AURUM_CACHE_SHIN_M = 0.15;
export const AURUM_CACHE_KNEE_M = 0.5;
export const AURUM_CACHE_STEP_M = 0.3;
/** The coffer's half-width and height (m): its shut picture's, the box it is pressed by. */
const COFFER_HW = (AURUM_COFFER_SIZE.shut.w * GLOBAL_SCALE) / 2, COFFER_H = AURUM_COFFER_SIZE.shut.h * GLOBAL_SCALE;
/** The rays read the dungeon's own mesh alone (a door's stands only while shut); the doors and movers are kept clear of by
 *  their boxes, as the build stands them - every door shut, every platform home. */
const MESH = 'dungeon';
const MESH_ONLY = Object.freeze({ only: Object.freeze([MESH]) });
const NOT_MESH = Object.freeze({ skip: Object.freeze([MESH]) });
const DOWN = Object.freeze([0, -1, 0]), UP = Object.freeze([0, 1, 0]);
const EIGHT = Object.freeze(Array.from({ length: 8 }, (_, k) => Object.freeze([Math.sin((k * Math.PI) / 4), 0, Math.cos((k * Math.PI) / 4)])));
/** Where this device keeps the caches each account emptied (`{ [account]: [id, ...] }`) - a hint for the coffer it
 *  stands; the service's word is the claim's answer. Every one is kept (CACHES-ONCE: a cache is emptied once ever). */
export const AURUM_CACHE_STORE = 'dagger:aurumCaches';
const NO_TARGETS = Object.freeze([]);

/** The coffer's words. */
export const AURUM_CACHE_TEXT = Object.freeze({
  name: () => t('aurumCache.name', 'Aurum Coffer'),
  emptyName: () => t('aurumCache.emptyName', 'Aurum Coffer (empty)'),
  here: () => t('aurumCache.here', 'An Aurum coffer is hidden in this dungeon.'),
  found: (/** @type {number} */ n) => t('aurumCache.found', '+{n, number} Aurum', { n }),
  empty: () => t('aurumCache.empty', 'The coffer is empty.'),
});

/**
 * THE PLACE KEY a dungeon's cache is kept by - `d<id>`, the professions' identity (scenes/dungeonIdentity.js: the Bay's
 * pixel id, the whole map id past it) - or null for a dungeon that holds none: a made level (the court, the Hour, the
 * Spire, the ketch), an Abyss Dungeon, the arena's floor and undercroft, a zone hall. Pure.
 * @param {any} loc a dungeon's location (dungeonContext.js's `dfLocation`)
 */
export function aurumCachePlaceOf(loc) {
  const mapId = loc?.mapTableData?.mapId;
  if (!Number.isSafeInteger(mapId) || mapId < 0 || isHallMapId(mapId)) return null;
  if (madeLevelOf(loc) || dungeonTier(loc) === 'super' || isArenaFloor(loc) || isArenaUndercroft(loc)) return null;
  return aurumCacheDungeonKey(dungeonIdOf(mapId));
}

/** Two boxes `{ min, max }` meet, the one grown by `gap` (m). Pure. */
const meets = (/** @type {Box} */ a, /** @type {Box} */ b, /** @type {number} */ gap) => [0, 1, 2].every((k) => a.min[k] < b.max[k] + gap && b.min[k] < a.max[k] + gap);
/** The coffer's press box on its foot. Pure. @typedef {{ min: number[], max: number[] }} Box */
export const aurumCofferBox = (/** @type {number[]} */ f) => ({ min: [f[0] - COFFER_HW, f[1], f[2] - COFFER_HW], max: [f[0] + COFFER_HW, f[1] + COFFER_H, f[2] + COFFER_HW] });
/** A treasure pile's press box as dungeonContext.js lootTargets builds it, by its size from the archive (`lawHalf`). Pure. */
export function aurumPileBox(/** @type {{ pos: number[], lawHalf: number[] }} */ p) {
  const [hx, hy] = p.lawHalf;
  return { min: [p.pos[0] - hx, p.pos[1], p.pos[2] - hx], max: [p.pos[0] + hx, p.pos[1] + hy * 2, p.pos[2] + hx] };
}

/**
 * WHERE THE COFFER STANDS: beside the random treasure pile the cache's `pile` picks (a fixed one where none is random),
 * else the next in the list's order with room. From a pile on the dungeon's own floor, the first of eight ways from
 * `bearing` with room (the constants above), at the distance that holds the coffer's box clear of the pile's. Null where
 * no pile has room: no coffer stands. The same on every client: the layout's piles at their sizes from the archive, the
 * dungeon's mesh, its doors and movers as the build stands them. `piles`: dungeonContext.js lootPiles, in its order.
 * @param {ReadonlyArray<any>} piles @param {{ pile: number, bearing: number }} spot the law's (aurumCacheSpotOf) @param {any} collider player/collider.js's
 */
export function aurumCacheFoot(piles, spot, collider) {
  const sized = (piles ?? []).filter((p) => Array.isArray(p?.pos) && Array.isArray(p.lawHalf));
  const random = sized.filter((p) => !p.isFixed), list = random.length ? random : sized;
  if (!list.length) return null;
  const boxes = sized.map(aurumPileBox);
  /** @type {Box[] | null} */
  let others = null;
  const clear = (/** @type {number[]} */ foot) => {
    const box = aurumCofferBox(foot);
    others ??= /** @type {Box[]} */ (collider.bucketBoxes?.(NOT_MESH) ?? []);
    return !boxes.some((b) => meets(box, b, AURUM_CACHE_GAP_M / 2)) && !others.some((b) => meets(box, b, AURUM_CACHE_GAP_M / 2));
  };
  const first = Math.min(list.length - 1, Math.floor(spot.pile * list.length));
  for (let n = 0; n < list.length; n++) {
    const foot = footBeside(list[(first + n) % list.length], spot.bearing, collider, clear);
    if (foot) return foot;
  }
  return null;
}

/** One pile's coffer foot by aurumCacheFoot's law, or null. */
function footBeside(/** @type {any} */ pile, /** @type {number} */ bearing, /** @type {any} */ collider, /** @type {(f: number[]) => boolean} */ clear) {
  const g = pile.pos, under = collider.raycastHit([g[0], g[1] + AURUM_CACHE_KNEE_M, g[2]], DOWN, AURUM_CACHE_KNEE_M + AURUM_CACHE_STEP_M);
  if (under?.key !== MESH) return null;   // AUDIT-STOREFRONT III D2: a pile on a mover, a door or no floor
  const floor = g[1] + AURUM_CACHE_KNEE_M - under.dist, reach = pile.lawHalf[0] + COFFER_HW + AURUM_CACHE_GAP_M;
  for (let k = 0; k < 8; k++) {
    const a = bearing + (k * Math.PI) / 4, dir = [Math.sin(a), 0, Math.cos(a)];
    const off = reach / Math.max(Math.abs(dir[0]), Math.abs(dir[2])), from = [g[0], floor + AURUM_CACHE_KNEE_M, g[2]];
    if (Number.isFinite(collider.raycast(from, dir, off + AURUM_CACHE_CLEAR_M, MESH_ONLY))) continue;
    const at = [from[0] + dir[0] * off, from[1], from[2] + dir[2] * off];
    const down = collider.raycast(at, DOWN, AURUM_CACHE_KNEE_M + AURUM_CACHE_STEP_M, MESH_ONLY);
    if (!Number.isFinite(down) || Math.abs(at[1] - down - floor) > AURUM_CACHE_STEP_M) continue;
    const foot = [at[0], at[1] - down, at[2]];
    if (!walled(collider, foot) && clear(foot)) return foot;
  }
  return null;
}
/** A wall within AURUM_CACHE_SIDE_M of a foot, any eighth round, at shin or knee height, or a ceiling under the coffer's
 *  height: either would cut the picture. */
const walled = (/** @type {any} */ collider, /** @type {number[]} */ f) => Number.isFinite(collider.raycast([f[0], f[1] + 0.02, f[2]], UP, COFFER_H, MESH_ONLY))
  || [AURUM_CACHE_SHIN_M, AURUM_CACHE_KNEE_M].some((h) => EIGHT.some((d) => Number.isFinite(collider.raycast([f[0], f[1] + h, f[2]], d, AURUM_CACHE_SIDE_M, MESH_ONLY))));

/** CHEST3D: the coffer's facing (degrees about up, mat4.js trs's): its front away from the pile it stands beside, the
 *  nearest - every client the same. Pure. */
export function aurumCofferYaw(/** @type {{ pos: number[] }[]} */ piles, /** @type {number[]} */ foot) {
  let near = null, nd = Infinity;
  for (const p of piles ?? []) { const d = (p.pos[0] - foot[0]) ** 2 + (p.pos[2] - foot[2]) ** 2; if (d < nd) { nd = d; near = p; } }
  return near ? (Math.atan2(foot[0] - near.pos[0], foot[2] - near.pos[2]) * 180) / Math.PI : 0;
}

/** The ids an account emptied, as this device keeps them. */
function keptIds(/** @type {any} */ storage, /** @type {string} */ account) {
  const v = noteOf(storage)[account];
  return Array.isArray(v) ? v.filter(aurumCacheIdOk) : [];
}
/** The device's note as a plain object - a corrupt one (an array, a number, cut JSON) starts again empty (AUDIT lane 3 F6). */
function noteOf(/** @type {any} */ storage) {
  let v = null;
  try { v = JSON.parse(storage?.getItem?.(AURUM_CACHE_STORE) ?? '{}'); } catch { /* cut or not JSON: start again */ }
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}
/** Keep an emptied id for an account, dropping any that is no cache's (a day's id or mark from before CACHES-ONCE). */
function keepId(/** @type {any} */ storage, /** @type {string} */ account, /** @type {string} */ id) {
  try {
    const all = noteOf(storage);
    for (const k of Object.keys(all)) all[k] = (Array.isArray(all[k]) ? all[k] : []).filter(aurumCacheIdOk);
    if (!all[account]?.includes(id)) (all[account] ??= []).push(id);
    storage?.setItem?.(AURUM_CACHE_STORE, JSON.stringify(all));
  } catch { /* a full or blocked store keeps nothing: the service's word still opens it */ }
}

/** Set once the service answers `cache-closed`: no coffer stands again this session. */
let _closed = false;
/** The coffer stood last (a probe's and a test's reading). */
let _last = /** @type {any} */ (null);
export const aurumCacheStood = () => _last;
/** Test seam. */
export function _resetAurumCaches() { _closed = false; _last = null; }

/**
 * STAND THE DUNGEON'S COFFER in a dungeon context, if it holds one: its billboard (the context owns it and frees it
 * with the level), its activation target and its name on the plaque, and a line that it is here. Answers the coffer -
 * `{ id, foot, open, press(key) }` - or null. The context's takeLoot presses it (its `aurum` arm). `deps` are the tests'
 * and the probes': `online`, `session`, `claim`, `storage`, `audio`, `lateSay` (a line the level is gone for).
 * @param {any} ctx the context's api (dungeonContext.js) @param {any} loc its location @param {any[]} piles its treasure piles
 * @param {any} [deps]
 */
export function standAurumCache(ctx, loc, piles, deps = {}) {
  const storage = deps.storage !== undefined ? deps.storage : appStorage();
  const online = deps.online ?? (() => isOnlinePage());
  const session = deps.session ?? (() => storedSession(storage));
  const audio = deps.audio ?? defaultAudio;
  const lateSay = deps.lateSay ?? ((/** @type {string} */ line) => setMidScreenText(line));
  const me = session();
  if (_closed || !online() || !me?.id || me.kind === 'guest') return null;
  const id = aurumCachePlaceOf(loc);   // CACHES-ONCE: a cache's id is its dungeon's place key
  if (!id) return null;
  const kept = keptIds(storage, me.id);
  const foot = aurumCacheFoot(piles, aurumCacheSpotOf(id), ctx.collider);
  if (!foot) return null;
  const claim = deps.claim ?? accountAurumCache({ fetch: (/** @type {any} */ u, /** @type {any} */ i) => globalThis.fetch(u, i), storage }).claim;
  const say = (/** @type {string} */ line) => ctx.hudSay?.(line);
  let batch = /** @type {any} */ (null), stood = 0, asking = false, gone = false, away = false;
  const coffer = { id, foot, open: kept.includes(id), yaw: aurumCofferYaw(piles, foot), press };
  // CHEST3D (bible/03-World/Chests.md): the owner's chest in gold (world/chestModel.js), in the level's draws where the
  // host hands the mesh door, its lid open once emptied, its front away from its pile; else its picture
  const meshes = deps.meshes ?? null, draws = Array.isArray(ctx.dynamicDraws) ? ctx.dynamicDraws : null;
  let entry = /** @type {any} */ (null);
  const unstand = () => { if (entry && draws) { const k = draws.indexOf(entry); if (k >= 0) draws.splice(k, 1); } entry = null; if (batch) ctx.dropProfFlats?.(batch); batch = null; };
  /** The coffer as it is now - the model, else its picture; the last asked wins, an older one landing late is dropped. */
  const stand = async () => {
    const mine = ++stood;
    const gpu = meshes?.getGpuMesh && draws ? await Promise.resolve(meshes.getGpuMesh(coffer.open ? AURUM_COFFER_MODELS.open : AURUM_COFFER_MODELS.shut)).catch(() => null) : null;
    if (gone || away || mine !== stood) return;
    if (gpu && draws) {
      unstand();
      entry = { gpu, object: { matrix: trs(foot[0], foot[1], foot[2], 0, coffer.yaw, 0) } };
      draws.push(entry);
      return;
    }
    const b = await ctx.standProfFlats?.(AURUM_COFFER_ARCHIVE, coffer.open ? AURUM_COFFER_ART.open : AURUM_COFFER_ART.shut, 1, [foot]);
    if (gone || away || mine !== stood) { if (b) ctx.dropProfFlats?.(b); return; }
    if (batch) ctx.dropProfFlats?.(batch);
    batch = b ?? null;
  };
  const opened = () => { coffer.open = true; stand(); };
  /** AUDIT-STOREFRONT III D4: a coffer the service does not know (a page and a service of two laws) goes. */
  const takeAway = () => { away = true; stood++; unstand(); if (_last === coffer) _last = null; };
  /** A press on the coffer: an open one says it is empty; a shut one asks the service once - a second press while the
   *  ask is out is the same ask (ASYNC NEVER DROPS). */
  function press(/** @type {unknown} */ key) {
    if (key !== AURUM_CACHE_KEY || away) return false;
    if (coffer.open) { say(AURUM_CACHE_TEXT.empty()); return true; }
    if (asking) return true;
    asking = true;
    Promise.resolve().then(() => claim(id, cacheProofFor(id), me.id)).catch(() => ({ ok: false, error: 'server' })).then((/** @type {any} */ r) => {
      asking = false;
      // AUDIT-STOREFRONT III D5: what the ledger now holds is kept before the level's end is read
      if (r?.ok || r?.error === 'cache-taken') keepId(storage, me.id, id);
      const found = () => AURUM_CACHE_TEXT.found(Number.isSafeInteger(r.data?.aurum) ? r.data.aurum : AURUM_CACHE_AURUM);
      if (gone) { if (r?.ok) lateSay(found()); return; }
      if (r?.ok) {
        opened();
        say(found());
        try { audio?.play3d?.(SOUND.GoldPieces, [foot[0], foot[1] + 0.3, foot[2]], 1, { maxDistance: 16 }); } catch { /* silent */ }
        return;
      }
      if (r?.error === 'cache-taken') opened();
      if (r?.error === 'cache-closed') _closed = true;
      if (r?.error === 'cache-id') takeAway();
      say(accountRefusalText(r?.error));
    });
    return true;
  }
  const target = Object.freeze([{ key: AURUM_CACHE_KEY, aabb: aurumCofferBox(foot), distance: RAY_DISTANCE, reach: TREASURE_ACTIVATION_DISTANCE }]);
  ctx.addActivationTargets?.(() => (away ? NO_TARGETS : target));
  ctx.addActivationNamer?.((/** @type {unknown} */ key) => (key === AURUM_CACHE_KEY && !away ? { title: coffer.open ? AURUM_CACHE_TEXT.emptyName() : AURUM_CACHE_TEXT.name() } : null));
  ctx.addTeardown?.(() => { gone = true; unstand(); if (_last === coffer) _last = null; });
  stand();
  if (!coffer.open) say(AURUM_CACHE_TEXT.here());
  return (_last = coffer);
}
