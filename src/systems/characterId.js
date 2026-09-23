// @ts-check
// ═══════════════════════════════════════════════════════════════════
// CHARID1 (2026-09-21, a player on Discord: "he created a new character
// and it overwrote his save"): A CHARACTER IS AN ID, NOT A NAME.
//
// A save's identity was (characterName, saveName) - SaveLoadManager's
// FindSaveFolderByNames, taken verbatim. So a NEW character who took
// the name of an old one, or the default name, or a name the player
// simply reused, wrote its first QuickSave over the old character's
// QuickSave and the old character was gone. DFU has the same seam; a
// browser port with one Quick Save per character and a Discord full of
// people naming their third Breton the same thing does not get to keep
// it.
//
// Every character carries an id now: minted at chargen (and for a
// character read out of a classic DOS save), carried on the entity and
// in the save envelope, written onto the slot card. A save's identity
// is (characterId, saveName). A card written before this - no id - is
// ADOPTED the first time its character is loaded: restorePlayer mints
// the id and stamps every card of that name that has none, so the old
// player's next QuickSave still overwrites their own slot and never a
// new character's. A new character never matches a card without its
// id, which is the whole fix.
//
// The three storage prefixes live here, the one module save.js and
// saveSlots.js both import without importing each other.

export const SAVE_DATA_PREFIX = 'dagger.save.';
export const SAVE_INFO_PREFIX = 'dagger.saveinfo.';
export const SAVE_SHOT_PREFIX = 'dagger.saveshot.';

/** a fresh id - the platform's UUID where it has one, a stamp and a
 *  random tail where it does not (an old WebView); never empty */
export function mintCharacterId() {
  try { const u = globalThis.crypto?.randomUUID?.(); if (u) return u; } catch { /* no crypto */ }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** the entity's id, minted onto it the first time anything asks */
export function characterIdOf(entity) {
  if (!entity) return null;
  if (typeof entity.characterId !== 'string' || !entity.characterId) entity.characterId = mintCharacterId();
  return entity.characterId;
}

/**
 * Stamp `characterId` onto every card of `characterName` that carries
 * none - the legacy cards of the character being loaded. Returns the
 * keys stamped. A card that will not parse is left alone.
 */
export function adoptLegacyCards(storage, characterName, characterId) {
  const stamped = [];
  if (!storage || !characterId) return stamped;
  const keys = [];
  for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (k?.startsWith(SAVE_INFO_PREFIX)) keys.push(k); }
  for (const k of keys) {
    let info;
    try { info = JSON.parse(storage.getItem(k) ?? 'null'); } catch { continue; }
    if (!info || typeof info !== 'object' || info.characterId || (info.characterName ?? '') !== (characterName ?? '')) continue;
    try { storage.setItem(k, JSON.stringify({ ...info, characterId })); stamped.push(k); } catch { /* quota: the card stays a legacy card and is adopted next time */ }
  }
  return stamped;
}
