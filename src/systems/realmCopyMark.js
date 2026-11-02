// @ts-check
// A COPY OF AN ONLINE CHARACTER STAYS OFFLINE (REALM-COPY, 2026-10-25, from the field reports: "Online -> Offline ->
// Online: Fails quietly (nothing happens)").
//
// Copy to offline writes a realm character's save as a new offline character with a new id (ui/enhanced/enhancedMenu.js
// copyToOffline). Customs lets an offline character in only when the realm counted its id before the realm opened
// (server-account/src/realm.js customsRealm). The copy's id is minted when the copy is made, so the realm never counted
// it, and Bring online on a copy can only be refused. The Online door therefore shows the reason on the copy's tile, as
// it does for a Test Room character, and offers no Bring online button that cannot succeed.

/** The save name that Copy to offline gives the slot it writes. */
export const REALM_COPY_SAVE_NAME = 'Copied from the realm';

/**
 * Marks a save as an offline copy of a realm character, in place. The mark is an entity field (systems/save/save.js
 * ENTITY_FIELDS), so every later save of the copy keeps it.
 * @param {{ realmCopy?: boolean }} snap
 */
export function markRealmCopy(snap) {
  snap.realmCopy = true;
}

/**
 * @typedef {object} SlotCard
 * @property {string | null} characterId
 * @property {string} saveName
 * @property {boolean} realmCopy
 */

/**
 * The ids of the offline characters that are copies of realm characters. A slot counts when its save carries the
 * mark. A copy made before the mark existed has no mark in any save, but the slot that Copy to offline wrote still has
 * REALM_COPY_SAVE_NAME, and it identifies every other slot of the same character.
 * @param {SlotCard[]} saves
 * @returns {Set<string>}
 */
export function realmCopyIds(saves) {
  const ids = new Set();
  for (const save of saves) {
    if (!save.characterId) continue;
    if (save.realmCopy || save.saveName === REALM_COPY_SAVE_NAME) ids.add(save.characterId);
  }
  return ids;
}
