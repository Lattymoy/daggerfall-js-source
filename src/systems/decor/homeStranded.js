// @ts-check
// ═══════════════════════════════════════════════════════════════════
// HOME-STRANDED (bible/01-Overview/bugs/Field-Bugs-2026-10-25d.md): GOODS THE OLD POUR LEFT UNDER A HOME'S BUILDING.
//
// From the decorations overhaul (#1223, 2026-10-25 05:00Z) to HOME-POUR's deploy (22:13Z the same day), a shared chest
// set back to private had its goods written under the building's scene, `DaggerfallInterior [...]`. When that answer was
// lost, the goods stayed there: out of the owner's reach (the client reads an online home from `OnlineHome [...]`), and
// gone at the next world move, which clears a scene that is not permanent. This module brings them home, once:
//
//   - At the boot, keepStrandedHomes makes each held home's building scene that still holds such goods permanent, so a
//     world move before the owner walks in keeps them.
//   - When the owner walks in and the service's grants answer arrives (decorGrants.js noteDecorGrants), bringStrandedHome
//     moves them into the chest the room stands, as the window reads it. A chest the service says is shared, or whose
//     goods are in the bin, is skipped: the share took the goods into the bin, and what the building's scene holds of
//     them is a ghost the client wrote back. A good the save holds anywhere else (the pack, the chest, another scene) is
//     a ghost too, and is dropped. What is moved leaves the building's scene in the same step, so a second run finds
//     nothing.
//   - dropGhosts is the client's half of the service's own moves (decorTool.js keepChestGoods): a share takes the
//     piece's goods out of every scene the cache holds, and a pour takes the poured goods out of them, as moveChest does
//     in the record. Without it the next checkpoint wrote them back.
// ═══════════════════════════════════════════════════════════════════
import { interiorSceneName } from '../sceneCache.js';
import { t } from '../textManager.js';

/** The building's scene names the old pour may have used: the map id as the client sent it, signed or not. */
const buildingScenes = (/** @type {number} */ mapId, /** @type {number} */ buildingKey) =>
  [...new Set([interiorSceneName(mapId >>> 0, buildingKey), interiorSceneName(mapId | 0, buildingKey)])];

/** The pieces whose goods a building's scene holds without a piece of its own standing there to hold them. */
function strandedIds(/** @type {any} */ entry) {
  const standing = new Set((entry?.decor ?? []).map((/** @type {any} */ p) => p?.id));
  const ids = [];
  for (const [id, list] of Object.entries(entry?.decorItems ?? {})) {
    if (!standing.has(id) && Array.isArray(list) && list.length) ids.push(id);
  }
  return ids;
}

/** The building's scenes of one home that hold stranded goods, as `{ name, entry, ids }`. */
function strandedScenes(/** @type {any} */ cache, /** @type {number} */ mapId, /** @type {number} */ buildingKey) {
  const found = [];
  for (const name of buildingScenes(mapId, buildingKey)) {
    const entry = cache?.scenes?.get?.(name);
    const ids = strandedIds(entry);
    if (ids.length) found.push({ name, entry, ids });
  }
  return found;
}

/**
 * At the boot: each held home whose building's scene holds stranded goods keeps that scene across a world move.
 * Answers the scene names made permanent.
 * @param {{ scenes: Map<string, any>, permanent: Set<string> }} cache @param {any[]} held the account's homes
 */
export function keepStrandedHomes(cache, held) {
  const kept = [];
  for (const home of Array.isArray(held) ? held : []) {
    for (const { name } of strandedScenes(cache, Number(home?.mapId), Number(home?.buildingKey))) {
      if (cache.permanent.has(name)) continue;
      cache.permanent.add(name);
      kept.push(name);
    }
  }
  return kept;
}

/** Every uid the cache holds outside the named scenes: the pieces' goods and the owner's own things. */
function uidsOutside(/** @type {any} */ cache, /** @type {Set<string>} */ skip) {
  const uids = new Set();
  for (const [name, entry] of cache?.scenes ?? []) {
    if (skip.has(name)) continue;
    for (const list of Object.values(entry?.decorItems ?? {})) for (const it of Array.isArray(list) ? list : []) if (it?.uid) uids.add(it.uid);
    for (const it of Object.values(entry?.decorOwn ?? {})) if (/** @type {any} */ (it)?.uid) uids.add(/** @type {any} */ (it).uid);
  }
  return uids;
}

/** A scene entry with no list or record left in it: the old pour made it for the goods alone. */
function emptyEntry(/** @type {any} */ entry) {
  return Object.values(entry ?? {}).every((v) => (Array.isArray(v) ? !v.length : v && typeof v === 'object' ? !Object.keys(v).length : true));
}

/**
 * When the owner walks in and the grants answer arrives: the stranded goods of the room's private chests go into the
 * chest. Answers the items moved.
 * @param {{ scenes: Map<string, any>, permanent: Set<string> }} cache
 * @param {{ mapId: number, buildingKey: number }} home
 * @param {{ storage: string[], shared: Set<string>, itemsOf: (id: string) => any[], carried: any[] }} room
 *   `storage` the room's storage pieces, `shared` those the service shares or holds goods for, `itemsOf` the live list
 *   a chest's window reads, `carried` the pack
 */
export function bringStrandedHome(cache, home, { storage, shared, itemsOf, carried }) {
  const scenes = strandedScenes(cache, Number(home.mapId), Number(home.buildingKey));
  if (!scenes.length) return [];
  const held = uidsOutside(cache, new Set(scenes.map((s) => s.name)));
  for (const it of carried ?? []) if (it?.uid) held.add(it.uid);
  const moved = [];
  for (const { name, entry, ids } of scenes) {
    for (const id of ids) {
      if (!storage.includes(id) || shared.has(id)) continue;
      const list = itemsOf(id);
      for (const it of list) if (it?.uid) held.add(it.uid);
      for (const it of entry.decorItems[id]) {
        if (it?.uid && held.has(it.uid)) continue;
        if (it?.uid) held.add(it.uid);
        list.push(it);
        moved.push(it);
      }
      delete entry.decorItems[id];
    }
    // The name stays permanent: a house's deed may have made it so (banking.js addPermanentScene), and a permanent name
    // with no entry keeps nothing (sceneCache.js clearSceneCache).
    if (emptyEntry(entry)) cache.scenes.delete(name);
  }
  return moved;
}

/**
 * The service took a chest's goods out of every scene of the record (a share), or the poured ones (`uids`, a pour back
 * into the home's own scene): the cache drops its copies too, or the next checkpoint writes them back as ghosts.
 * @param {{ scenes: Map<string, any> } | null | undefined} cache @param {string} id @param {Set<string> | null} uids null for all
 */
export function dropGhosts(cache, id, uids) {
  for (const entry of cache?.scenes?.values?.() ?? []) {
    const list = entry?.decorItems?.[id];
    if (!Array.isArray(list)) continue;
    const kept = uids ? list.filter((/** @type {any} */ it) => !uids.has(it?.uid)) : [];
    if (kept.length) entry.decorItems[id] = kept;
    else delete entry.decorItems[id];
  }
}

/** What is said when stranded goods come back into the home's chests. */
export const strandedBackLine = (/** @type {number} */ n) => t('decor.strandedBack', '{n, plural, one {One thing your home\'s chest had lost was found and put back in it.} other {# things your home\'s chests had lost were found and put back in them.}}', { n });
