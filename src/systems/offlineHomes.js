// OFFLINE-HOUSING: Playable DFO-style housing in offline single-player.
// Mutual isolation with DFU bank housing, toggleable in settings (port:offlineHousing).
// Save data lives in modData.offlineHomes via registerModSaveData.
// Scenes use home:m<mapId>.<key> (DFU uses interior:m<mapId>.<key>).

import { registerModSaveData } from './modSaveData.js';
import { isOfflineHousingActive } from './uiPrefs.js';
import { homeSaleRefund, HOME_CAP } from '../net/homeLaw.js';
import { decorSaleBack } from '../net/decorLaw.js';
import { playerEntity } from '../characters/playerEntity.js';
import { isDfuHouseOwned } from './banking.js';

export const OFFLINE_HOMES_VENDOR = 'offlineHomes';

/** @type {Map<string, { mapId: number, buildingKey: number, region: number, price: number, entry: string, boughtAt: number, decor: any[], hidden: string[] }>} */
const _ownedHomes = new Map();

const homeKey = (mapId, buildingKey) => `${Number(mapId) >>> 0}:${Number(buildingKey)}`;

/** Returns whether an offline DFO house is owned by the player at this location. */
export function isOfflineHouseOwned(mapId, buildingKey) {
  if (!isOfflineHousingActive()) return false;
  return _ownedHomes.has(homeKey(mapId, buildingKey));
}

/** Whether the building is an offline home regardless of toggle (for quest site exclusion). */
export function offlineHomeStands(mapId, buildingKey) {
  return _ownedHomes.has(homeKey(mapId, buildingKey));
}

/** All offline homes owned by the player in `region`. */
export function offlineHomesInRegion(region) {
  const r = Number(region) || 0;
  return Array.from(_ownedHomes.values()).filter((h) => h.region === r);
}

/** All offline homes. */
export function allOfflineHomes() {
  return Array.from(_ownedHomes.values());
}

/** Resets offline homes state (for unit tests). */
export function _resetForTests() {
  _ownedHomes.clear();
}

// ═══ DFU MOD SAVE DATA REGISTRATION ════════════════════════════════════════
registerModSaveData(OFFLINE_HOMES_VENDOR, {
  newSaveData: () => ({ homes: [] }),
  getSaveData: () => ({
    homes: Array.from(_ownedHomes.values()).map((h) => ({
      mapId: h.mapId,
      buildingKey: h.buildingKey,
      region: h.region,
      price: h.price,
      entry: h.entry || 'only-me',
      boughtAt: h.boughtAt || 0,
      decor: Array.isArray(h.decor) ? [...h.decor] : [],
      hidden: Array.isArray(h.hidden) ? [...h.hidden] : [],
    })),
  }),
  restoreSaveData: (data) => {
    _ownedHomes.clear();
    if (!data || !Array.isArray(data.homes)) return;
    for (const h of data.homes) {
      if (!Number.isFinite(h?.mapId) || !Number.isFinite(h?.buildingKey)) continue;
      const id = Number(h.mapId) >>> 0;
      const key = Number(h.buildingKey);
      _ownedHomes.set(homeKey(id, key), {
        mapId: id,
        buildingKey: key,
        region: Number(h.region) || 0,
        price: Number(h.price) || 0,
        entry: typeof h.entry === 'string' ? h.entry : 'only-me',
        boughtAt: Number(h.boughtAt) || 0,
        decor: Array.isArray(h.decor) ? [...h.decor] : [],
        hidden: Array.isArray(h.hidden) ? [...h.hidden] : [],
      });
    }
  },
  newGame: () => {
    _ownedHomes.clear();
  },
});

// ═══ ADAPTER: ONLINE HOMES REGISTRY COMPATIBLE INTERFACE ════════════════════
export function createOfflineHomes({
  player = () => playerEntity,
  sceneCache = null,
  townTalk = null,
  onHomes = null,
  onWrote = null,
} = {}) {
  let version = 1;

  function ensure(mapId) {
    return Promise.resolve(true);
  }

  function waitFor(mapId) {
    return Promise.resolve(true);
  }

  const known = () => true;

  function homeAt(mapId, buildingKey) {
    if (!isOfflineHousingActive()) return null;
    const h = _ownedHomes.get(homeKey(mapId, buildingKey));
    if (!h) return null;
    const name = player?.()?.name || 'You';
    return Object.freeze({
      buildingKey: h.buildingKey,
      owner: name,
      mine: true,
      own: true,
      entry: h.entry || 'only-me',
      character: name,
      crossed: false,
      refund: homeSaleRefund(h.price),
      rentDue: 0,
      rent: null,
      tenant: null,
      look: null,
      guildmate: false,
      hall: null,
      member: false,
      keeper: false,
      hallEntry: false,
      hallSell: false,
      deed: false,
      offer: null,
      giving: null,
      score: 0,
      myVote: 0,
      insider: true,
    });
  }

  function homeStands(mapId, buildingKey) {
    if (_ownedHomes.has(homeKey(mapId, buildingKey))) return true;
    return isDfuHouseOwned(player?.()?.houses ?? [], null, buildingKey, mapId);
  }

  const heardHomeless = () => false;

  function homesIn(mapId) {
    const id = Number(mapId) >>> 0;
    const map = new Map();
    for (const h of _ownedHomes.values()) {
      if (h.mapId === id) {
        map.set(h.buildingKey, homeAt(id, h.buildingKey));
      }
    }
    return map;
  }

  function setEntry(mapId, buildingKey, entry) {
    const id = Number(mapId) >>> 0;
    const h = _ownedHomes.get(homeKey(id, buildingKey));
    if (!h) return Promise.resolve({ ok: false, error: 'no-home' });
    h.entry = entry;
    version++;
    try { onWrote?.(id, buildingKey); } catch { /* listener error */ }
    return Promise.resolve({ ok: true });
  }

  async function claim({ mapId, buildingKey, region, price, layout = null, ground = null }) {
    const id = Number(mapId) >>> 0;
    const reg = Number(region) || 0;
    const key = Number(buildingKey);

    if (offlineHomesInRegion(reg).length >= HOME_CAP) {
      return { ok: false, error: 'home-cap' };
    }
    if (_ownedHomes.has(homeKey(id, key))) {
      return { ok: false, error: 'home-taken' };
    }

    const home = {
      mapId: id,
      buildingKey: key,
      region: reg,
      price: Number(price) || 0,
      entry: 'only-me',
      boughtAt: Date.now(),
      decor: [],
      hidden: [],
    };
    _ownedHomes.set(homeKey(id, key), home);
    version++;

    try { onHomes?.(); } catch { /* ignore */ }
    try { onWrote?.(id, key); } catch { /* ignore */ }

    return {
      ok: true,
      data: {
        home: { entry: 'only-me' },
        refund: homeSaleRefund(home.price),
      },
    };
  }

  async function release(mapId, buildingKey) {
    const id = Number(mapId) >>> 0;
    const key = Number(buildingKey);
    const h = _ownedHomes.get(homeKey(id, key));
    if (!h) return { ok: false, error: 'no-home' };

    _ownedHomes.delete(homeKey(id, key));
    version++;

    const refund = homeSaleRefund(h.price);
    const decorBack = decorSaleBack(h.decor);
    const decorCount = Array.isArray(h.decor) ? h.decor.length : 0;

    try { onHomes?.(); } catch { /* ignore */ }
    try { onWrote?.(id, key); } catch { /* ignore */ }

    return {
      ok: true,
      price: h.price,
      refund,
      decorCount,
      decorBack,
    };
  }

  return {
    ensure,
    waitFor,
    known,
    homeAt,
    homeStands,
    heardHomeless,
    homesIn,
    setEntry,
    claim,
    release,
    hearEveryTown: () => false,
    hearHome: () => false,
    holdDeed: () => Promise.resolve({ ok: true }),
    releaseDeed: () => Promise.resolve({ ok: true }),
    setLook: () => Promise.resolve({ ok: true }),
    vote: () => Promise.resolve({ ok: true }),
    transfer: () => Promise.resolve({ ok: false, error: 'offline' }),
    version: () => version,
    bump: () => { version++; },
  };
}

// ═══ ADAPTER: OFFLINE DECOR DOOR FOR DECOR TOOL AND LOAD HOME DECOR ═════════
export function createOfflineDecor() {
  function getHome(mapId, buildingKey) {
    return _ownedHomes.get(homeKey(mapId, buildingKey)) ?? null;
  }

  async function list(mapId, buildingKey, seat = false, yard = false) {
    const h = getHome(mapId, buildingKey);
    if (!h) return { ok: true, data: { pieces: [], hidden: [] } };
    return {
      ok: true,
      data: {
        pieces: Array.isArray(h.decor) ? [...h.decor] : [],
        hidden: Array.isArray(h.hidden) ? [...h.hidden] : [],
      },
    };
  }

  async function place({ mapId, buildingKey, piece }) {
    const h = getHome(mapId, buildingKey);
    if (!h) return { ok: false, error: 'no-home' };
    h.decor = (h.decor || []).filter((p) => p.id !== piece.id);
    h.decor.push(piece);
    return { ok: true, data: { piece } };
  }

  async function move({ mapId, buildingKey, id, place: p }) {
    const h = getHome(mapId, buildingKey);
    if (!h) return { ok: false, error: 'no-home' };
    const idx = (h.decor || []).findIndex((pc) => pc.id === id);
    if (idx >= 0) {
      h.decor[idx] = { ...h.decor[idx], ...p };
      return { ok: true, data: { piece: h.decor[idx] } };
    }
    return { ok: false, error: 'no-piece' };
  }

  async function remove({ mapId, buildingKey, id }) {
    const h = getHome(mapId, buildingKey);
    if (h) {
      h.decor = (h.decor || []).filter((p) => p.id !== id);
    }
    return { ok: true };
  }

  async function hidden({ mapId, buildingKey, keys }) {
    const h = getHome(mapId, buildingKey);
    if (h) {
      h.hidden = Array.isArray(keys) ? [...keys] : [];
    }
    return { ok: true };
  }

  async function batch() {
    return { ok: true };
  }

  async function use() {
    return { ok: true };
  }

  return {
    list,
    place,
    move,
    remove,
    hidden,
    batch,
    use,
  };
}
