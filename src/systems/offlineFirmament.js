// @ts-check
// ═══════════════════════════════════════════════════════════════════
// OFFLINE FIRMAMENT & RENOWN SYSTEM (Daggerfall Forever)
//
// Enables the Firmament star constellation passive tree and authentic
// Renown progression offline in single-player mode.
//
// 1. RENOWN ACCRUAL:
//    - Uses authentic online curve and mechanics (renownKillXp, renownQuestXp,
//      renownXpFor, renownProgress).
//    - Proportional compensation: online activities not present offline
//      (party kill bonus up to +70%, town defense raids 3x quest XP,
//      sea serpent 6x quest XP, arena bouts) are proportionally
//      compensated by applying an offline factor (1.5x) to kills and quests.
// 2. STARS & PERKS:
//    - 2 Stars awarded per Renown level (starsFor(renown)).
//    - Passive tree perks and channels active offline in firmamentLive /
//      firmamentPowers (attributes, combat damage, spell efficiency, health, etc.).
// 3. PERSISTENCE:
//    - Saved in modData ('firmament') inside save files, and cached in
//      appStorage ('firm1.offline.<characterId>') across game sessions.
//    - Full respec support for 500 gold (FIRM_RESPEC_GOLD) or free below Renown 10.
// ═══════════════════════════════════════════════════════════════════

import { FORK_FLAGS } from '../config/forkFlags.js';
import { getPref } from './uiPrefs.js';
import { appStorage } from './appStorage.js';
import { characterIdOf } from './characterId.js';
import {
  starsFor,
  unpackTree,
  packTree,
  treeFault,
  FIRM_RESPEC_GOLD,
  REFUND_FREE_BELOW_RENOWN,
  REFUND_SILVER_PER_STAR,
} from '../net/firmament/firmamentLaw.js';
import { createFirmamentBook, setFirmamentBook } from '../net/firmament/firmamentBook.js';
import { setFirmamentTree, setFirmamentOffline } from './firmamentLive.js';
import {
  renownForXp,
  renownKillXp,
  renownQuestXp,
} from '../net/renown.js';
import { renownFoeLevel } from '../net/renownTracker.js';
import { setRenownLayer } from './renownLayer.js';
import { computeEntityMods } from './entityMods.js';
import { announceRenownRise } from '../ui/levelUp/levelNotice.js';
import { setHudRenown } from '../ui/hud/hudRenown.js';
import { registerModSaveData } from './modSaveData.js';

export const OFFLINE_FIRMAMENT_VENDOR = 'firmament';
export const OFFLINE_FIRM_STORAGE_PREFIX = 'firm1.offline.';

/** Proportional compensation factor for offline play (compensates for missing party kill bonus up to +70%, town raids 3x quest XP, and sea serpents 6x quest XP). */
export const OFFLINE_RENOWN_BOOST = 1.5;

/** A kill's offline XP, proportionally boosted for single-player offline progression. */
export function offlineKillXp(foeLevel, renown = null) {
  const base = renownKillXp(foeLevel, renown);
  return Math.round(base * OFFLINE_RENOWN_BOOST);
}

/** A quest's offline XP, proportionally boosted for single-player offline progression. */
export function offlineQuestXp(characterLevel, renown = null) {
  const base = renownQuestXp(characterLevel, renown);
  return Math.round(base * OFFLINE_RENOWN_BOOST);
}

/** Whether the Firmament is enabled in offline play (fork flag + settings preference). */
export function isOfflineFirmamentActive() {
  return !!FORK_FLAGS.ENABLE_OFFLINE_FIRMAMENT && getPref('offlineFirmament') !== false;
}

/**
 * @typedef {{ xp: number, renown: number, tree: string, said: number }} OfflineFirmamentRecord
 */

let _activeRecord = /** @type {OfflineFirmamentRecord|null} */ (null);
let _activeCharId = /** @type {string|null} */ (null);
let _activePlayerEntity = /** @type {any} */ (null);
let _activeFirmBook = /** @type {any} */ (null);
let _sayNotice = /** @type {((msg: string) => void)|null} */ (null);

export function loadOfflineRecord(charId) {
  if (!charId) return { xp: 0, renown: 1, tree: '', said: 1 };
  try {
    const raw = appStorage()?.getItem(`${OFFLINE_FIRM_STORAGE_PREFIX}${charId}`);
    if (raw) {
      const data = JSON.parse(raw);
      const xp = Number.isFinite(data?.xp) && data.xp >= 0 ? Math.trunc(data.xp) : 0;
      const renown = Math.max(1, renownForXp(xp));
      const tree = typeof data?.tree === 'string' ? data.tree : '';
      const said = Number.isFinite(data?.said) ? data.said : renown;
      return { xp, renown, tree, said };
    }
  } catch {
    /* appStorage error fallback */
  }
  return { xp: 0, renown: 1, tree: '', said: 1 };
}

export function saveOfflineRecord(charId, record) {
  if (!charId || !record) return;
  try {
    appStorage()?.setItem(`${OFFLINE_FIRM_STORAGE_PREFIX}${charId}`, JSON.stringify(record));
  } catch {
    /* appStorage quota/disabled */
  }
}

export function getActiveOfflineRecord() {
  return _activeRecord;
}

/**
 * Create a Firmament Book for offline play, backed by local disk/appStorage and save data.
 * @param {{ entity: any, wallet?: (() => any) | null }} o
 */
export function createOfflineFirmamentBook({ entity, wallet = null }) {
  const charId = characterIdOf(entity);
  _activePlayerEntity = entity;
  _activeCharId = charId;
  _activeRecord = loadOfflineRecord(charId);

  const door = {
    account: () => 'offline',
    state: async (character) => {
      const rec = loadOfflineRecord(character);
      const renown = Math.max(1, renownForXp(rec.xp));
      const stars = starsFor(renown);
      return {
        ok: true,
        data: {
          tree: rec.tree || '',
          renown,
          stars,
          craft: 0,
          ranks: {},
          refund: {
            freeBelow: REFUND_FREE_BELOW_RENOWN,
            perStar: REFUND_SILVER_PER_STAR,
            respecGold: FIRM_RESPEC_GOLD,
          },
        },
      };
    },
    set: async (character, packedTree, rid) => {
      const rec = loadOfflineRecord(character);
      const renown = Math.max(1, renownForXp(rec.xp));
      const stars = starsFor(renown);
      const unpacked = unpackTree(packedTree);
      const fault = treeFault(unpacked, stars, 0);
      if (fault) return { ok: false, error: fault };
      rec.tree = packedTree;
      saveOfflineRecord(character, rec);
      _activeRecord = rec;
      return {
        ok: true,
        data: {
          tree: packedTree,
          renown,
          stars,
          craft: 0,
          ranks: {},
          refund: {
            freeBelow: REFUND_FREE_BELOW_RENOWN,
            perStar: REFUND_SILVER_PER_STAR,
            respecGold: FIRM_RESPEC_GOLD,
          },
        },
      };
    },
    respec: async (character, rid, at, region) => {
      const rec = loadOfflineRecord(character);
      rec.tree = '';
      saveOfflineRecord(character, rec);
      _activeRecord = rec;
      const renown = Math.max(1, renownForXp(rec.xp));
      return {
        ok: true,
        data: {
          tree: '',
          renown,
          stars: starsFor(renown),
          craft: 0,
          ranks: {},
        },
      };
    },
  };

  const realm = {
    act: async ({ reserve, call }) => {
      const w = wallet?.();
      if (!w || w.gold() < FIRM_RESPEC_GOLD) {
        return { ok: false, error: 'firm-gold' };
      }
      w.pay(FIRM_RESPEC_GOLD);
      return call();
    },
  };

  const book = createFirmamentBook({
    door,
    storage: appStorage(),
    character: () => characterIdOf(entity),
    realm,
    wallet,
  });

  _activeFirmBook = book;
  return book;
}

/**
 * Initialize offline Renown tracking, HUD, and Firmament perks for the player.
 * @param {{ playerEntity: any, firmBook: any, say?: ((msg: string) => void)|null }} o
 */
export function initOfflineRenown({ playerEntity, firmBook, say = null }) {
  _activePlayerEntity = playerEntity;
  _activeCharId = characterIdOf(playerEntity);
  _activeFirmBook = firmBook;
  _sayNotice = typeof say === 'function' ? say : null;
  _activeRecord = loadOfflineRecord(_activeCharId);

  const renown = Math.max(1, renownForXp(_activeRecord.xp));
  _activeRecord.renown = renown;
  setRenownLayer(playerEntity, renown);
  if (_activeRecord.tree) {
    setFirmamentTree(unpackTree(_activeRecord.tree));
  }
  setFirmamentOffline(true);
  computeEntityMods(playerEntity);

  // Setup HUD Renown bar
  setHudRenown(() => ({
    level: _activeRecord ? _activeRecord.renown : 1,
    xp: _activeRecord ? _activeRecord.xp : 0,
    pending: 0,
  }));

  // Initial read of book
  firmBook?.read?.().catch(() => {});
}

/**
 * Earn offline Renown XP and process potential level up and star gains.
 * @param {number} amount
 */
export function addOfflineRenownXp(amount) {
  if (!_activeRecord || !_activeCharId || amount <= 0) return 0;
  const oldXp = _activeRecord.xp;
  const newXp = oldXp + amount;
  _activeRecord.xp = newXp;

  const oldLevel = _activeRecord.renown;
  const newLevel = Math.max(1, renownForXp(newXp));
  _activeRecord.renown = newLevel;

  saveOfflineRecord(_activeCharId, _activeRecord);

  if (newLevel > oldLevel) {
    const starsGained = starsFor(newLevel) - starsFor(oldLevel);
    announceRenownRise(newLevel, {
      stars: starsGained,
      say: _sayNotice,
    });
    if (_activePlayerEntity) {
      setRenownLayer(_activePlayerEntity, newLevel);
      computeEntityMods(_activePlayerEntity);
    }
    _activeFirmBook?.read?.().catch(() => {});
  }

  return amount;
}

/** Handle an offline foe death. */
export function onOfflineFoeKilled(foe) {
  if (!isOfflineFirmamentActive() || !_activeRecord || !_activePlayerEntity) return;
  const foeLevel = renownFoeLevel(foe);
  const currentRenown = _activeRecord.renown;
  const xp = offlineKillXp(foeLevel, currentRenown);
  if (xp > 0) {
    addOfflineRenownXp(xp);
  }
}

/** Handle an offline quest completion. */
export function onOfflineQuestEnded(playerEntity) {
  if (!isOfflineFirmamentActive() || !_activeRecord) return;
  const charLevel = playerEntity?.level ?? 1;
  const currentRenown = _activeRecord.renown;
  const xp = offlineQuestXp(charLevel, currentRenown);
  if (xp > 0) {
    addOfflineRenownXp(xp);
  }
}

// Register with DFU save manager
registerModSaveData(OFFLINE_FIRMAMENT_VENDOR, {
  newSaveData: () => ({ xp: 0, renown: 1, tree: '', said: 1 }),
  getSaveData: () => {
    if (_activeRecord) return { ..._activeRecord };
    return { xp: 0, renown: 1, tree: '', said: 1 };
  },
  restoreSaveData: (data) => {
    if (!data || typeof data !== 'object') return;
    const xp = Number.isFinite(data.xp) && data.xp >= 0 ? Math.trunc(data.xp) : 0;
    const renown = Math.max(1, renownForXp(xp));
    const tree = typeof data.tree === 'string' ? data.tree : '';
    const said = Number.isFinite(data.said) ? data.said : renown;
    _activeRecord = { xp, renown, tree, said };
    if (_activeCharId) {
      saveOfflineRecord(_activeCharId, _activeRecord);
    }
    if (_activePlayerEntity) {
      setRenownLayer(_activePlayerEntity, renown);
      if (tree) {
        setFirmamentTree(unpackTree(tree));
      }
      if (isOfflineFirmamentActive()) {
        setFirmamentOffline(true);
      }
      computeEntityMods(_activePlayerEntity);
    }
    _activeFirmBook?.read?.().catch(() => {});
  },
  newGame: () => {
    _activeRecord = { xp: 0, renown: 1, tree: '', said: 1 };
    if (_activeCharId) {
      saveOfflineRecord(_activeCharId, _activeRecord);
    }
    setFirmamentTree(null);
  },
});

/** Tests only reset seam. */
export function _resetOfflineFirmamentForTests() {
  _activeRecord = null;
  _activeCharId = null;
  _activePlayerEntity = null;
  _activeFirmBook = null;
  _sayNotice = null;
}
