// OFFLINE-HOUSING: Playable DFO-style housing in offline single-player.
// Mutual isolation with DFU bank housing, toggleable in settings (port:offlineHousing).
// Save data lives in modData.offlineHomes via registerModSaveData.
// Scenes use home:m<mapId>.<key> (DFU uses interior:m<mapId>.<key>).

import { registerModSaveData } from './modSaveData.js';
import { isOfflineHousingActive } from './uiPrefs.js';
import { homeSaleRefund, HOME_CAP, homeLookOf } from '../net/homeLaw.js';
import { decorSaleBack } from '../net/decorLaw.js';
import { playerEntity } from '../characters/playerEntity.js';
import { isDfuHouseOwned } from './banking.js';
import { yardCellOf } from '../net/yardCellLaw.js';

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
      look: h.look || null,
      decor: Array.isArray(h.decor) ? [...h.decor] : [],
      yardDecor: Array.isArray(h.yardDecor) ? [...h.yardDecor] : [],
      hidden: Array.isArray(h.hidden) ? [...h.hidden] : [],
      useModes: h.useModes ? { ...h.useModes } : {},
      chests: h.chests ? JSON.parse(JSON.stringify(h.chests)) : {},
      rev: Number(h.rev) || 1,
      yardRev: Number(h.yardRev) || 1,
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
        look: h.look ? homeLookOf(h.look) : null,
        decor: Array.isArray(h.decor) ? [...h.decor] : [],
        yardDecor: Array.isArray(h.yardDecor) ? [...h.yardDecor] : [],
        hidden: Array.isArray(h.hidden) ? [...h.hidden] : [],
        useModes: (h.useModes && typeof h.useModes === 'object') ? { ...h.useModes } : {},
        chests: (h.chests && typeof h.chests === 'object') ? JSON.parse(JSON.stringify(h.chests)) : {},
        rev: Number(h.rev) || 1,
        yardRev: Number(h.yardRev) || 1,
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
      look: h.look || null,
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
      look: null,
      decor: [],
      yardDecor: [],
      hidden: [],
      useModes: {},
      chests: {},
      rev: 1,
      yardRev: 1,
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
    async setLook(mapId, buildingKey, look) {
      const id = Number(mapId) >>> 0;
      const key = Number(buildingKey);
      const h = _ownedHomes.get(homeKey(id, key));
      if (!h) return { ok: false, error: 'no-home' };
      const next = look == null ? null : homeLookOf(look);
      if (look != null && !next) return { ok: false, error: 'bad-look' };
      h.look = next;
      version++;
      try { onHomes?.(); } catch {}
      try { onWrote?.(id, key); } catch {}
      return { ok: true, look: next };
    },
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
    if (!h) return { ok: true, data: { pieces: [], hidden: [], rev: 1 } };
    if (yard) {
      return {
        ok: true,
        data: {
          pieces: Array.isArray(h.yardDecor) ? [...h.yardDecor] : [],
          hidden: [],
          rev: Number(h.yardRev) || 1,
        },
      };
    }
    return {
      ok: true,
      data: {
        pieces: Array.isArray(h.decor) ? [...h.decor] : [],
        hidden: Array.isArray(h.hidden) ? [...h.hidden] : [],
        rev: Number(h.rev) || 1,
      },
    };
  }

  async function rev(mapId, buildingKey, seat = false, yard = false) {
    const h = getHome(mapId, buildingKey);
    if (yard) {
      return { ok: true, data: { rev: Number(h?.yardRev) || 1 } };
    }
    return { ok: true, data: { rev: Number(h?.rev) || 1 } };
  }

  async function place({ mapId, buildingKey, piece, yard = false }) {
    const h = getHome(mapId, buildingKey);
    if (!h) return { ok: false, error: 'no-home' };
    if (yard) {
      h.yardDecor = (h.yardDecor || []).filter((p) => p.id !== piece.id);
      h.yardDecor.push(piece);
      h.yardRev = (Number(h.yardRev) || 1) + 1;
      return { ok: true, data: { piece, rev: h.yardRev, yardVer: h.yardRev } };
    }
    h.decor = (h.decor || []).filter((p) => p.id !== piece.id);
    h.decor.push(piece);
    h.rev = (Number(h.rev) || 1) + 1;
    return { ok: true, data: { piece, rev: h.rev } };
  }

  async function move({ mapId, buildingKey, id, place: p, yard = false }) {
    const h = getHome(mapId, buildingKey);
    if (!h) return { ok: false, error: 'no-home' };
    if (yard) {
      const idx = (h.yardDecor || []).findIndex((pc) => pc.id === id);
      if (idx >= 0) {
        h.yardDecor[idx] = { ...h.yardDecor[idx], ...p };
        h.yardRev = (Number(h.yardRev) || 1) + 1;
        return { ok: true, data: { piece: h.yardDecor[idx], rev: h.yardRev, yardVer: h.yardRev } };
      }
    }
    const idx = (h.decor || []).findIndex((pc) => pc.id === id);
    if (idx >= 0) {
      h.decor[idx] = { ...h.decor[idx], ...p };
      h.rev = (Number(h.rev) || 1) + 1;
      return { ok: true, data: { piece: h.decor[idx], rev: h.rev } };
    }
    const yIdx = (h.yardDecor || []).findIndex((pc) => pc.id === id);
    if (yIdx >= 0) {
      h.yardDecor[yIdx] = { ...h.yardDecor[yIdx], ...p };
      h.yardRev = (Number(h.yardRev) || 1) + 1;
      return { ok: true, data: { piece: h.yardDecor[yIdx], rev: h.yardRev, yardVer: h.yardRev } };
    }
    return { ok: false, error: 'no-piece' };
  }

  async function remove({ mapId, buildingKey, id }) {
    const h = getHome(mapId, buildingKey);
    if (h) {
      const hadYard = (h.yardDecor || []).some((p) => p.id === id);
      if (hadYard) {
        h.yardDecor = h.yardDecor.filter((p) => p.id !== id);
        h.yardRev = (Number(h.yardRev) || 1) + 1;
      }
      const hadDecor = (h.decor || []).some((p) => p.id === id);
      if (hadDecor) {
        h.decor = h.decor.filter((p) => p.id !== id);
        h.rev = (Number(h.rev) || 1) + 1;
      }
      if (h.useModes?.[id]) delete h.useModes[id];
      if (h.chests?.[id]) delete h.chests[id];
    }
    return { ok: true, data: { rev: Number(h?.rev) || 1, yardVer: Number(h?.yardRev) || 1 } };
  }

  async function hidden({ mapId, buildingKey, keys }) {
    const h = getHome(mapId, buildingKey);
    if (h) {
      h.hidden = Array.isArray(keys) ? [...keys] : [];
      h.rev = (Number(h.rev) || 1) + 1;
    }
    return { ok: true, data: { rev: Number(h?.rev) || 1 } };
  }

  async function batch({ mapId, buildingKey, put = [], drop = [], yard = false } = {}) {
    const h = getHome(mapId, buildingKey);
    if (!h) return { ok: false, error: 'no-home' };
    const dropSet = new Set(drop);
    if (yard) {
      h.yardDecor = (h.yardDecor || []).filter((p) => !dropSet.has(p.id));
      for (const p of put) {
        const idx = h.yardDecor.findIndex((existing) => existing.id === p.id);
        if (idx >= 0) h.yardDecor[idx] = p;
        else h.yardDecor.push(p);
      }
      h.yardRev = (Number(h.yardRev) || 1) + 1;
      return { ok: true, data: { rev: h.yardRev, yardVer: h.yardRev } };
    }
    h.decor = (h.decor || []).filter((p) => !dropSet.has(p.id));
    for (const p of put) {
      const idx = h.decor.findIndex((existing) => existing.id === p.id);
      if (idx >= 0) h.decor[idx] = p;
      else h.decor.push(p);
    }
    h.rev = (Number(h.rev) || 1) + 1;
    return { ok: true, data: { rev: h.rev } };
  }

  async function use(body = {}) {
    const h = getHome(body?.mapId, body?.buildingKey);
    const op = body?.op;

    if (op === 'set') {
      if (!h) return { ok: false, error: 'no-home' };
      h.useModes = h.useModes || {};
      const mode = typeof body.mode === 'string' ? body.mode : 'private';
      if (body.id) {
        if (mode === 'private') delete h.useModes[body.id];
        else h.useModes[body.id] = mode;
      }
      h.rev = (Number(h.rev) || 1) + 1;
      return { ok: true, data: { mode, id: body.id, rev: h.rev } };
    }

    if (op === 'hold' || op === 'release') {
      return { ok: true };
    }

    if (op === 'ground') {
      if (h) {
        h.ground = Number(body.ground) || 100;
        h.rev = (Number(h.rev) || 1) + 1;
      }
      return { ok: true, data: { ground: Number(body?.ground) || 100 } };
    }

    if (op === 'list') {
      const chestId = body.id;
      const items = (h?.chests && Array.isArray(h.chests[chestId])) ? h.chests[chestId] : [];
      return {
        ok: true,
        data: {
          items: items.map((it) => ({ ...it })),
          master: true,
        },
      };
    }

    if (op === 'settle') {
      if (!h) return { ok: false, error: 'no-home' };
      h.chests = h.chests || {};
      const chestId = body.id;
      let list = Array.isArray(h.chests[chestId]) ? h.chests[chestId] : [];
      const putting = Array.isArray(body.put) ? body.put : [];
      const taking = Array.isArray(body.take) ? new Set(body.take) : new Set();
      const cutting = Array.isArray(body.cut) ? body.cut : [];

      list = list.filter((it) => !taking.has(it?.uid));

      for (const cut of cutting) {
        const idx = list.findIndex((it) => it?.uid === cut.uid);
        if (idx >= 0 && Number.isInteger(cut.leave)) {
          if (cut.leave <= 0) list.splice(idx, 1);
          else list[idx] = { ...list[idx], stackCount: cut.leave };
        }
      }

      const playerItems = playerEntity.items ?? [];
      for (const uid of putting) {
        const item = playerItems.find((it) => it?.uid === uid);
        if (item) {
          list.push(JSON.parse(JSON.stringify(item)));
        }
      }

      h.chests[chestId] = list;
      h.rev = (Number(h.rev) || 1) + 1;
      return { ok: true, data: { rev: h.rev } };
    }

    if (op === 'vault') {
      return { ok: false, error: 'no-guild' };
    }

    const pieces = Array.isArray(h?.decor) ? h.decor : [];
    const storage = pieces.filter((p) => p?.storage).map((p) => p.id);
    const station = pieces.filter((p) => p?.station).map((p) => p.id);
    const useModes = h?.useModes || {};
    const use = Object.entries(useModes)
      .filter(([_, mode]) => mode && mode !== 'private')
      .map(([id, mode]) => ({ id, mode }));
    return {
      ok: true,
      data: {
        storage,
        station,
        bin: [],
        use,
        rest: true,
        ground: Number(h?.ground) || Number(body?.ground) || 100,
        items: [],
        rev: Number(h?.rev) || 1,
      },
    };
  }

  async function yardCells(mapId, cells = []) {
    const list = [];
    for (const entry of cells) {
      const cell = Array.isArray(entry) ? entry[0] : entry;
      const yards = [];
      let cellVer = 0;
      for (const h of _ownedHomes.values()) {
        if ((h.mapId >>> 0) === (Number(mapId) >>> 0) && yardCellOf(h.buildingKey) === cell) {
          if (Array.isArray(h.yardDecor) && h.yardDecor.length > 0) {
            yards.push({
              buildingKey: h.buildingKey,
              pieces: [...h.yardDecor],
            });
          }
          cellVer = Math.max(cellVer, Number(h.yardRev) || 1);
        }
      }
      list.push({ cell, ver: cellVer || 1, yards });
    }
    return { ok: true, data: { cells: list } };
  }

  return {
    list,
    rev,
    place,
    move,
    remove,
    hidden,
    batch,
    use,
    yardCells,
  };
}
