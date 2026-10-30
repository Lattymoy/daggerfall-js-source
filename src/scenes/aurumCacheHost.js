// @ts-check
// AURUM-CACHES (2026-10-30, the owner: "Also Aurum caches"; bible/06-Systems/Aurum.md section 3a): AN AURUM COFFER IN A
// CACHE DUNGEON. The dungeon host stands one in a dungeon the law names for the UTC day (net/aurumCacheLaw.js), beside
// one of its treasure piles picked by the cache's hash, so every client stands it in one place. Pressed, it asks the
// account service (accountAurumCache) and opens on its yes; one this account emptied stands open. Online and signed in.
// THE FOUR HOSTS: scenes/dungeonContext.js stands it and its takeLoot presses it, worldModes.js's and dungeon.js's loot
// arms carry the key there; world.js and exterior.js (the street) stand none. Not a DFU member. Ledger A (AURUM-CACHES).
import { aurumCacheDayOf, aurumCacheDungeonKey, aurumCacheHolds, aurumCacheId, aurumCacheSpotOf, AURUM_CACHE_AURUM } from '../net/aurumCacheLaw.js';
import { AURUM_COFFER_ARCHIVE, AURUM_COFFER_ART, AURUM_COFFER_SIZE, registerAurumCofferArt } from '../world/aurumCofferArt.js';
import { addVendorTextures } from '../systems/textureReplacement.js';
import { accountAurumCache, accountRefusalText, storedSession } from '../net/accountClient.js';
import { appStorage } from '../systems/appStorage.js';
import { isOnlinePage } from '../systems/online/onlineLane.js';
import { sharedClockOn, worldMinutes } from '../systems/worldTick.js';
import { wallMsForClassicMinutes, isHallMapId } from '../net/wire.js';
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

registerAurumCofferArt(addVendorTextures);   // the import is the registration (world/festivalArt.js's law)

/** The coffer's activation key: the press ladders' loot arm hands it to the context's takeLoot, whose `aurum` arm presses it. */
export const AURUM_CACHE_KEY = 'aurum:cache';
/** From its pile the coffer stands this far along its bearing (m), where the way is clear this far at knee height, the
 *  walls this far off either side of it (half its width: no wall cuts its picture), and its foot lands within
 *  AURUM_CACHE_STEP_M of the pile's floor (no coffer off a ledge). */
export const AURUM_CACHE_OFF_M = 0.9;
export const AURUM_CACHE_CLEAR_M = 1.5;
export const AURUM_CACHE_SIDE_M = 0.45;
export const AURUM_CACHE_KNEE_M = 0.5;
export const AURUM_CACHE_STEP_M = 0.3;
/** The rays read the dungeon's own mesh alone - never a door's, which stands only while shut (dungeonContext.js's veins'). */
const MESH_ONLY = Object.freeze({ only: Object.freeze(['dungeon']) });
/** Where this device keeps the caches each account emptied (`{ [account]: [id, ...] }`) - a hint for the coffer it
 *  stands; the service's word is the claim's answer. Today's and yesterday's are kept. */
export const AURUM_CACHE_STORE = 'dagger:aurumCaches';

/** The coffer's words. */
export const AURUM_CACHE_TEXT = Object.freeze({
  name: () => t('aurumCache.name', 'Aurum Coffer'),
  emptyName: () => t('aurumCache.emptyName', 'Aurum Coffer (empty)'),
  here: () => t('aurumCache.here', 'An Aurum coffer is hidden in this dungeon today.'),
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

/**
 * WHERE THE COFFER STANDS: one of the dungeon's random treasure piles (its fixed ones where it has none), picked by the
 * cache's `pile`, and from that pile's foot the first of eight ways from `bearing` clear at knee height, AURUM_CACHE_OFF_M
 * along it, clear to either side, on a floor no step from the pile's; the pile's own foot where no way is. The same on
 * every client: the piles are the layout's, the rays the dungeon's own mesh. Null with no pile.
 * @param {ReadonlyArray<{ pos?: number[], isFixed?: boolean }>} piles in the build's order (dungeonContext.js lootPiles)
 * @param {{ pile: number, bearing: number }} spot the law's (aurumCacheSpotOf) @param {{ raycast: (from: number[], dir: number[], max: number, filter?: any) => number }} collider
 */
export function aurumCacheFoot(piles, spot, collider) {
  const placed = (piles ?? []).filter((p) => Array.isArray(p?.pos));
  const random = placed.filter((p) => !p.isFixed), list = random.length ? random : placed;
  if (!list.length) return null;
  const g = /** @type {number[]} */ (list[Math.min(list.length - 1, Math.floor(spot.pile * list.length))].pos);
  for (let k = 0; k < 8; k++) {
    const a = spot.bearing + (k * Math.PI) / 4, dir = [Math.sin(a), 0, Math.cos(a)];
    const from = [g[0], g[1] + AURUM_CACHE_KNEE_M, g[2]];
    if (Number.isFinite(collider.raycast(from, dir, AURUM_CACHE_CLEAR_M, MESH_ONLY))) continue;
    const at = [from[0] + dir[0] * AURUM_CACHE_OFF_M, from[1], from[2] + dir[2] * AURUM_CACHE_OFF_M];
    if ([1, -1].some((s) => Number.isFinite(collider.raycast(at, [dir[2] * s, 0, -dir[0] * s], AURUM_CACHE_SIDE_M, MESH_ONLY)))) continue;
    const down = collider.raycast(at, [0, -1, 0], AURUM_CACHE_KNEE_M + AURUM_CACHE_STEP_M, MESH_ONLY);
    if (!Number.isFinite(down) || Math.abs(at[1] - down - g[1]) > AURUM_CACHE_STEP_M) continue;
    return [at[0], at[1] - down, at[2]];
  }
  return [g[0], g[1], g[2]];
}

/** The ids an account emptied, as this device keeps them. */
function keptIds(/** @type {any} */ storage, /** @type {string} */ account) {
  try { const v = JSON.parse(storage?.getItem?.(AURUM_CACHE_STORE) ?? '{}')?.[account]; return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; } catch { return []; }
}
/** Keep an emptied id for an account, dropping every id older than yesterday. */
function keepId(/** @type {any} */ storage, /** @type {string} */ account, /** @type {string} */ id, /** @type {number} */ day) {
  try {
    const all = JSON.parse(storage?.getItem?.(AURUM_CACHE_STORE) ?? '{}') ?? {};
    for (const k of Object.keys(all)) all[k] = (Array.isArray(all[k]) ? all[k] : []).filter((x) => typeof x === 'string' && Number(x.split(':')[0]) >= day - 1);
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
 * STAND TODAY'S COFFER in a dungeon context, if this dungeon holds one: its billboard (the context owns it and frees it
 * with the level), its activation target and its name on the plaque, and a line that it is here. Answers the coffer -
 * `{ id, foot, open, press(key) }` - or null. The context's takeLoot presses it (its `aurum` arm).
 * `deps` are the tests' and the probes': `online`, `session`, `nowMs`, `claim`, `storage`, `audio`.
 * @param {any} ctx the context's api (dungeonContext.js) @param {any} loc its location @param {any[]} piles its treasure piles
 * @param {any} [deps]
 */
export function standAurumCache(ctx, loc, piles, deps = {}) {
  const storage = deps.storage !== undefined ? deps.storage : appStorage();
  const online = deps.online ?? (() => isOnlinePage());
  const session = deps.session ?? (() => storedSession(storage));
  const nowMs = deps.nowMs ?? (() => (sharedClockOn() ? wallMsForClassicMinutes(worldMinutes()) : Date.now()));
  const audio = deps.audio ?? defaultAudio;
  const me = session();
  if (_closed || !online() || !me?.id || me.kind === 'guest') return null;
  const place = aurumCachePlaceOf(loc), day = aurumCacheDayOf(nowMs() / 1000);
  if (!place || !aurumCacheHolds(day, place)) return null;
  const id = aurumCacheId(day, place), foot = aurumCacheFoot(piles, aurumCacheSpotOf(id), ctx.collider);
  if (!foot) return null;
  const claim = deps.claim ?? accountAurumCache({ fetch: (/** @type {any} */ u, /** @type {any} */ i) => globalThis.fetch(u, i), storage }).claim;
  const say = (/** @type {string} */ line) => ctx.hudSay?.(line);
  let batch = /** @type {any} */ (null), stood = 0, asking = false, gone = false;
  const coffer = { id, foot, open: keptIds(storage, me.id).includes(id), press };
  /** The billboard for the coffer as it is now - the last asked wins, an older one landing late is dropped. */
  const stand = async () => {
    const mine = ++stood;
    const b = await ctx.standProfFlats?.(AURUM_COFFER_ARCHIVE, coffer.open ? AURUM_COFFER_ART.open : AURUM_COFFER_ART.shut, 1, [foot]);
    if (gone || mine !== stood) { if (b) ctx.dropProfFlats?.(b); return; }
    if (batch) ctx.dropProfFlats?.(batch);
    batch = b ?? null;
  };
  const opened = () => { coffer.open = true; keepId(storage, me.id, id, day); stand(); };
  /** A press on the coffer: an open one says it is empty; a shut one asks the service once - a second press while the
   *  ask is out is the same ask (ASYNC NEVER DROPS: one claim, one answer said). */
  function press(/** @type {unknown} */ key) {
    if (key !== AURUM_CACHE_KEY) return false;
    if (coffer.open) { say(AURUM_CACHE_TEXT.empty()); return true; }
    if (asking) return true;
    asking = true;
    Promise.resolve().then(() => claim(id)).catch(() => ({ ok: false, error: 'server' })).then((/** @type {any} */ r) => {
      asking = false;
      if (gone) return;
      if (r?.ok) {
        opened();
        say(AURUM_CACHE_TEXT.found(Number.isSafeInteger(r.data?.aurum) ? r.data.aurum : AURUM_CACHE_AURUM));
        try { audio?.play3d?.(SOUND.GoldPieces, [foot[0], foot[1] + 0.3, foot[2]], 1, { maxDistance: 16 }); } catch { /* silent */ }
        return;
      }
      if (r?.error === 'cache-taken') opened();
      if (r?.error === 'cache-closed') _closed = true;
      say(accountRefusalText(r?.error));
    });
    return true;
  }
  const size = AURUM_COFFER_SIZE.shut, hw = (size.w * GLOBAL_SCALE) / 2, top = size.h * GLOBAL_SCALE;
  const target = Object.freeze([{ key: AURUM_CACHE_KEY, aabb: { min: [foot[0] - hw, foot[1], foot[2] - hw], max: [foot[0] + hw, foot[1] + top, foot[2] + hw] }, distance: RAY_DISTANCE, reach: TREASURE_ACTIVATION_DISTANCE }]);
  ctx.addActivationTargets?.(() => target);
  ctx.addActivationNamer?.((/** @type {unknown} */ key) => (key === AURUM_CACHE_KEY ? { title: coffer.open ? AURUM_CACHE_TEXT.emptyName() : AURUM_CACHE_TEXT.name() } : null));
  ctx.addTeardown?.(() => { gone = true; if (_last === coffer) _last = null; });
  stand();
  if (!coffer.open) say(AURUM_CACHE_TEXT.here());
  return (_last = coffer);
}
