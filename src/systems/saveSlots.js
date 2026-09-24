// @ts-check
// SAV4: MULTI-SLOT SAVE MANAGEMENT - SaveLoadManager's slot half, 1:1
// from DFU Game/Serialization/SaveLoadManager.cs (MIT, Daggerfall
// Workshop). The laws, kept verbatim:
//   - a save is identified by (characterName, saveName) -
//     FindSaveFolderByNames - and SAVING to an existing pair
//     OVERWRITES its slot while a new pair takes the FIRST FREE
//     integer key (CreateNewSavePath's `while (ContainsKey(key))
//     key++`), so deleted indexes recycle;
//   - THE QUICKSAVE IS JUST A SLOT named "QuickSave" for the current
//     character (QuickSave() = Save(name, quickSaveName)), which is
//     what finally retires the port's single dagger.quicksave key;
//   - a slot is only real WITH its SaveInfo (EnumerateSaveFolders
//     admits a folder only if SaveInfo.txt exists) - an orphaned data
//     blob does not enumerate;
//   - most-recent is the LARGEST realTime (FindMostRecentSave);
//   - per-character lists come from the info sweep
//     (EnumerateCharacterSaves), and the window orders them by
//     realTime DESCENDING;
//   - Rename writes the info ONLY when the name actually changed;
//   - Delete removes the known files and re-enumerates.
//
// Departures (structure only, recorded):
//   - DFU writes ~12 JSON files per save folder; the port's envelope
//     (systems/save.js snapshotPlayer) is ONE blob that already
//     carries the quest/talk/discovery/automap halves, so a slot is
//     three localStorage keys: data, info, screenshot. Same storage
//     the quicksave always used.
//   - SaveInfo.dateAndTime.gameTime holds CLASSIC MINUTES (the port's
//     one clock; DFU stores DaggerfallDateTime seconds) and realTime
//     holds Date.now() milliseconds (DFU stores DateTime.Now.Ticks) -
//     both are compare-and-display values, never arithmetic ones.
//   - The screenshot is an optional caller-supplied data URL: a WebGL
//     canvas without preserveDrawingBuffer can only be read inside
//     the frame that drew it, so the capture seam belongs to the
//     host's frame loop, and a save without one shows the empty panel
//     exactly as DFU's GetSaveScreenshot -> null does.
//   - dfuVersion carries the port's BUILD_TAG.
//
// MIGRATION: the legacy dagger.quicksave key becomes a "QuickSave"
// slot on first enumeration - written and VERIFIED before the legacy
// key is removed, so a quota failure leaves the old save untouched.

import { SAVE_VERSION, QUICKSAVE_KEY } from './save.js';
import { SAVE_DATA_PREFIX, SAVE_INFO_PREFIX, SAVE_SHOT_PREFIX, characterIdOf, adoptLegacyCards, mintCharacterId } from './characterId.js';   // CHARID1: the prefixes and the id, the one module save.js and this both read
import { BUILD_TAG } from '../buildTag.js';
import { appStorage } from './appStorage.js';   // DA1: localStorage in a browser, real save files in the desktop shell

// SaveLoadManager's names (:42-44), as storage-key prefixes.
export { SAVE_DATA_PREFIX, SAVE_INFO_PREFIX, SAVE_SHOT_PREFIX, characterIdOf, adoptLegacyCards, mintCharacterId };   // CHARID1: still this module's words to every caller
export const QUICK_SAVE_NAME = 'QuickSave';
export const AUTO_SAVE_NAME = 'AutoSave';

const store = () => appStorage();

/**
 * HARD3 - THE SLOT CARD, written down. Every slot in this file
 * enumerates through one of these and nothing else (the
 * SaveInfo.txt-must-exist law), so this is the shape the load door, the
 * online door and the most-recent question all read. It was `{object}`
 * on the way out of `parse`, which is how three call sites read
 * `.dateAndTime` off a value nothing promised had one.
 *
 * It comes back from `JSON.parse`, so it is UNTRUSTED: a slot written by
 * an older build, or edited by hand, can be missing any field. That is
 * why every read here is optional-chained and defaulted, and why the type
 * marks the fields optional rather than pretending the parse checked them.
 *
 * @typedef {object} SaveInfo
 * @property {number} [saveVersion]  the envelope version (systems/save.js SAVE_VERSION)
 * @property {string} [saveName]     the slot's name; with characterName it is the slot's identity
 * @property {string} [characterName]
 * @property {{gameTime?: number, realTime?: number}} [dateAndTime]  gameTime in CLASSIC MINUTES, realTime in Date.now() ms - both compare-and-display, never arithmetic
 * @property {string} [dfuVersion]   the port's BUILD_TAG
 * @property {string} [characterId]  CHARID1: the character's id - a card without one is a legacy card, adopted on its character's next load
 */

// HARD3: ONE reader, TWO shapes. `parse` was handed both the slot CARD
// and the save ENVELOPE, and returned `object` for each, so neither had a
// type and a card could be read where an envelope was meant without a
// word from anything. Same body, two names, two contracts - and the names
// say at the call site which of the three storage keys is being opened.
/** @returns {SaveInfo|null} */
const parseInfo = (raw) => { try { return JSON.parse(raw); } catch { return null; } };
/** The save ENVELOPE (systems/save.js snapshotPlayer), untrusted the same way. @returns {any} */
const parseSnap = (raw) => { try { return JSON.parse(raw); } catch { return null; } };

/** EnumerateSaveFolders + EnumerateSaveInfo + EnumerateCharacterSaves:
 *  one sweep over storage. A slot enumerates ONLY through a parseable
 *  SaveInfo (the SaveInfo.txt-must-exist law).
 *  @returns {{ info: Map<number, SaveInfo>, characterSaves: Map<string, number[]> }} */
export function enumerateSaves(storage = store()) {
  const info = new Map();
  const characterSaves = new Map();
  if (!storage) return { info, characterSaves };
  migrateLegacyQuicksave(storage);
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (!k?.startsWith(SAVE_INFO_PREFIX)) continue;
    const key = Number(k.slice(SAVE_INFO_PREFIX.length));
    if (!Number.isInteger(key) || key < 0) continue;   // int.TryParse's gate
    const saveInfo = parseInfo(storage.getItem(k));
    if (!saveInfo) continue;
    info.set(key, saveInfo);
    const name = saveInfo.characterName ?? '';
    if (!characterSaves.has(name)) characterSaves.set(name, []);
    characterSaves.get(name).push(key);
  }
  return { info, characterSaves };
}

/** The one-time legacy migration. Write first, VERIFY, then remove -
 *  a failed write (quota) leaves dagger.quicksave standing and the
 *  next enumeration tries again. */
export function migrateLegacyQuicksave(storage = store()) {
  if (!storage) return false;
  const raw = storage.getItem(QUICKSAVE_KEY);
  if (!raw) return false;
  const snap = parseSnap(raw);
  if (!snap) { storage.removeItem(QUICKSAVE_KEY); return false; }   // corrupt legacy blob: nothing to keep
  const key = firstFreeKey(storage);
  const saveInfo = {
    saveVersion: snap.v ?? 0,
    saveName: QUICK_SAVE_NAME,
    characterName: snap.name ?? '',
    dateAndTime: { gameTime: snap.classicMinutes ?? 0, realTime: 0 },   // no real stamp survives the legacy key
    dfuVersion: BUILD_TAG,
  };
  try {
    storage.setItem(SAVE_DATA_PREFIX + key, raw);
    storage.setItem(SAVE_INFO_PREFIX + key, JSON.stringify(saveInfo));
  } catch (err) {
    console.warn('[saveSlots] legacy quicksave migration failed:', err?.name ?? err);
    return false;
  }
  if (storage.getItem(SAVE_DATA_PREFIX + key) !== raw) return false;   // verify before the point of no return
  storage.removeItem(QUICKSAVE_KEY);
  return true;
}

/** CreateNewSavePath's key walk: the first free integer from 0. */
export function firstFreeKey(storage = store()) {
  const taken = new Set();
  if (storage) {
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      // A DATA or INFO key holds the index - a half-written slot must
      // not be recycled under a player's feet.
      for (const prefix of [SAVE_DATA_PREFIX, SAVE_INFO_PREFIX]) {
        if (k?.startsWith(prefix)) {
          const key = Number(k.slice(prefix.length));
          if (Number.isInteger(key) && key >= 0) taken.add(key);
        }
      }
    }
  }
  let key = 0;
  while (taken.has(key)) key++;
  return key;
}

/** GetSaveInfo: populated info or null (DFU's empty struct). */
export function saveInfoOf(key, storage = store()) {
  return parseInfo(storage?.getItem(SAVE_INFO_PREFIX + key) ?? null);
}

/** GetCharacterSaveKeys. */
export function saveKeysOfCharacter(characterName, storage = store()) {
  return enumerateSaves(storage).characterSaves.get(characterName) ?? [];
}

/** GetCharacterNames. */
export function characterNames(storage = store()) {
  return [...enumerateSaves(storage).characterSaves.keys()];
}

/** FindSaveFolderByNames, with CHARID1's law: the identity is
 *  (characterId, saveName) when the caller knows the id - a card
 *  without an id never matches an id, which is what keeps a new
 *  character off an old one's slot - and (characterName, saveName)
 *  only for a caller with no id to give. -1 when absent. */
export function findSave(characterName, saveName, storage = store(), characterId = null) {
  const { info } = enumerateSaves(storage);
  for (const [key, saveInfo] of info) {
    if (saveInfo.saveName !== saveName) continue;
    if (characterId ? saveInfo.characterId === characterId : saveInfo.characterName === characterName) return key;
  }
  return -1;
}

/** FindMostRecentSave: the largest realTime, -1 with no saves. */
export function findMostRecentSave(storage = store()) {
  let mostRecentTime = -1;
  let mostRecentKey = -1;
  for (const [key, saveInfo] of enumerateSaves(storage).info) {
    const t = saveInfo.dateAndTime?.realTime ?? 0;
    if (t > mostRecentTime) { mostRecentTime = t; mostRecentKey = key; }
  }
  return mostRecentKey;
}

/** Save(characterName, saveName): overwrite the character's save of
 *  the same name, else the first free key. The info is written LAST -
 *  its presence is what makes the slot real, the manifest-last shape
 *  the ingest already proved out.
 *  @returns {{ ok: boolean, key: number }} */
export function saveSlot(characterName, saveName, snap, { screenshot = null, storage = store(), now = Date.now() } = {}) {
  if (!storage || !snap) return { ok: false, key: -1 };
  // CHARID1: the envelope carries the character's id (snapshotPlayer
  // mints one onto a character that has none), and the slot it
  // overwrites is ITS OWN slot of that name - never a namesake's.
  const characterId = typeof snap.characterId === 'string' && snap.characterId ? snap.characterId : null;
  let key = findSave(characterName, saveName, storage, characterId);
  if (key === -1) key = firstFreeKey(storage);
  const saveInfo = {
    saveVersion: snap.v ?? SAVE_VERSION,
    saveName,
    characterName,
    characterId,
    dateAndTime: { gameTime: Math.floor(snap.classicMinutes ?? 0), realTime: now },
    dfuVersion: BUILD_TAG,
  };
  try {
    storage.setItem(SAVE_DATA_PREFIX + key, JSON.stringify(snap));
    if (screenshot) storage.setItem(SAVE_SHOT_PREFIX + key, screenshot);
    else storage.removeItem(SAVE_SHOT_PREFIX + key);   // an overwrite without a capture drops the stale picture
    storage.setItem(SAVE_INFO_PREFIX + key, JSON.stringify(saveInfo));
    return { ok: true, key };
  } catch (err) {
    console.warn('[saveSlots] save write failed:', err?.name ?? err);
    // A half-written NEW slot must not linger as an orphan; an
    // overwritten slot keeps whatever survived (its info still names
    // the old write's data - the blob is one key, so it is whole).
    try { if (!saveInfoOf(key, storage)) { storage.removeItem(SAVE_DATA_PREFIX + key); storage.removeItem(SAVE_SHOT_PREFIX + key); } } catch { /* storage gone */ }
    return { ok: false, key };
  }
}

/** Load-side read of a slot's envelope (the LoadGame path parses the
 *  blob; restorePlayer's own version gate stays the restorer's). */
export function loadSlot(key, storage = store()) {
  return parseSnap(storage?.getItem(SAVE_DATA_PREFIX + key) ?? null);
}

/** The F2 law extended to slots: "is there a game THIS BUILD can
 *  restore" - version-gated beside the reader, like
 *  restorableQuicksave. */
export function restorableSlot(key, storage = store()) {
  const snap = loadSlot(key, storage);
  return snap && snap.v === SAVE_VERSION ? snap : null;
}

/** SLOTS1 (Mac, 2026-09-12: "multiple save slots and then the ability
 *  to choose which save to use in online"): EVERY slot this build can
 *  restore, most recent first - { key, info, snap } each. The front
 *  doors' lists (Load, Online) and the most-recent question below are
 *  one walk, so a stale-version save never hides a good one and the
 *  list never disagrees with the card. */
export function restorableSaves(storage = store()) {
  const out = [];
  const entries = [...enumerateSaves(storage).info.entries()]
    .sort((a, b) => (b[1].dateAndTime?.realTime ?? 0) - (a[1].dateAndTime?.realTime ?? 0));
  for (const [key, info] of entries) {
    const snap = restorableSlot(key, storage);
    if (snap) out.push({ key, info, snap });
  }
  return out;
}

/** The front doors' question: the most recent slot this build can
 *  restore, or null. Walks recency order so one stale-version save
 *  does not hide an older good one. */
export function mostRecentRestorable(storage = store()) {
  const first = restorableSaves(storage)[0];
  return first ? { key: first.key, snap: first.snap } : null;
}

/** GetSaveScreenshot: the stored data URL or null. */
export function screenshotOf(key, storage = store()) {
  return storage?.getItem(SAVE_SHOT_PREFIX + key) ?? null;
}

// ── SS1: THE SCREENSHOT CAPTURE ──────────────────────────────────
// SaveLoadManager.SaveGame's tail (:1146-1152, :1225-1227): the shot
// is taken at END OF FRAME - the coroutine yields WaitForEndOfFrame
// TWICE (so the save window has popped), then ReadPixels the whole
// screen WITH the HUD on it (the hide-UI attempt is commented out in
// the C#), EncodeToJPG, write beside the save. The port's WebGL
// context has preserveDrawingBuffer false, so the canvas is only
// readable in the same task as the draw: the save ARMS a request here
// and the host frame loop DELIVERS it after its last draw call, with
// the same two-frame countdown standing in for the two yields.
// RECORDED departure: DFU stores the full Screen.width x height JPEG
// on disk; the port downscales to 320x200 (the native frame) for the
// localStorage quota - the window's panel is 168x95, so nothing the
// player can see is lost.
export const SCREENSHOT_W = 320;
export const SCREENSHOT_H = 200;
let _pendingShot = null;               // { key, frames }
export function requestScreenshot(key) {
  _pendingShot = Number.isInteger(key) && key >= 0 ? { key, frames: 2 } : null;
}
/** The host frame loop's delivery - call after the frame's last draw.
 *  True only on the frame the shot lands. A slot deleted while the
 *  countdown ran captures nothing (the info-must-exist law), and a
 *  failure of any kind leaves the slot shotless - the window's bare
 *  panel is GetSaveScreenshot -> null's own look. */
export function capturePendingScreenshot(canvas, storage = store()) {
  if (!_pendingShot || !canvas || !storage) return false;
  if (--_pendingShot.frames > 0) return false;   // the two WaitForEndOfFrame yields
  const { key } = _pendingShot;
  _pendingShot = null;                           // one save, one shot
  try {
    if (!saveInfoOf(key, storage)) return false;
    const off = document.createElement('canvas');
    off.width = SCREENSHOT_W; off.height = SCREENSHOT_H;
    off.getContext('2d').drawImage(canvas, 0, 0, SCREENSHOT_W, SCREENSHOT_H);
    const url = off.toDataURL('image/jpeg', 0.7);   // EncodeToJPG
    if (!url || !url.startsWith('data:image/')) return false;
    storage.setItem(SAVE_SHOT_PREFIX + key, url);
    return true;
  } catch { return false; }   // quota, tainted canvas, headless - never a thrown frame
}

/** DeleteSaveFolder: the known files only, then the caller
 *  re-enumerates (every reader here enumerates fresh). */
export function deleteSave(key, storage = store()) {
  if (!storage || !saveInfoOf(key, storage)) return false;
  storage.removeItem(SAVE_DATA_PREFIX + key);
  storage.removeItem(SAVE_INFO_PREFIX + key);
  storage.removeItem(SAVE_SHOT_PREFIX + key);
  return true;
}

/** Rename: writes the info ONLY when the name changed, verbatim. */
export function renameSave(key, newSaveName, storage = store()) {
  const saveInfo = saveInfoOf(key, storage);
  if (!saveInfo) return false;
  if (newSaveName === saveInfo.saveName) return false;
  saveInfo.saveName = newSaveName;
  try {
    storage.setItem(SAVE_INFO_PREFIX + key, JSON.stringify(saveInfo));
    return true;
  } catch (err) {
    console.warn('[saveSlots] rename write failed:', err?.name ?? err);
    return false;
  }
}

/** QuickSave() = Save(currentName, "QuickSave"). */
export function quickSaveSlot(characterName, snap, opts = {}) {
  return saveSlot(characterName, QUICK_SAVE_NAME, snap, opts);
}

/** HasQuickSave(characterName) - CHARID1: by the character's id when the caller has it. */
export function hasQuickSave(characterName, storage = store(), characterId = null) {
  return findSave(characterName, QUICK_SAVE_NAME, storage, characterId) !== -1;
}

/** QuickLoad() = Load(currentName, "QuickSave") - the envelope, or
 *  null so the caller's own "No saved game." arm answers. CHARID1: the
 *  character's OWN QuickSave, by id, never a namesake's. */
export function quickLoadSlot(characterName, storage = store(), characterId = null) {
  const key = findSave(characterName, QUICK_SAVE_NAME, storage, characterId);
  return key === -1 ? null : loadSlot(key, storage);
}

/** ONLINE-AUTOSAVE1's slots (scenes/world.js's `beforeunload`): the
 *  QuickSave and every slot this character already has - OR NONE while
 *  the player is dead or the death screen is up (DISC18-C). DFU never
 *  writes during a death (PlayerDeath pauses the game and ends in
 *  TitleMenuFromDeath); the exit autosave wrote the corpse, still
 *  poisoned, into every slot, and every load of every slot died again.
 *  "Already has" is findSave's CHARID1 law (AUDIT DISC18): by the
 *  character's id when it has one - the name list alone named a
 *  namesake's slots too, and saveSlot, matching by id, minted a new
 *  slot of this character's for every one of them. */
export function exitAutosaveNames(entity, { deathUp = false, storage = store() } = {}) {
  if (deathUp || !(entity?.health > 0)) return [];
  const id = typeof entity.characterId === 'string' && entity.characterId ? entity.characterId : null;
  const own = saveKeysOfCharacter(entity.name, storage).map((key) => saveInfoOf(key, storage))
    .filter((info) => info?.saveName && (!id || info.characterId === id));
  return [...new Set([QUICK_SAVE_NAME, ...own.map((info) => info.saveName)])];
}
