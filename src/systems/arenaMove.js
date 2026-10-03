// ARENA1 (2026-10-02): A HOUSE THE ARENA TOOK, MOVED - ONCE, OFFLINE. Mac, 2026-10-02: "Move them to a new house."
//
// GEMSAL03 (Daggerfall's cell 4,3) stood fifteen houses and a house of the Academics; the arena's block stands none
// (world/arenaCity.js). A deed whose building key names a building of that cell names nothing now, so at the first
// load that stands the arena the deed is moved: to an unowned house of the same type elsewhere in Daggerfall (any
// house when none of its type is free), never one another record holds or an active quest's, chosen by the house
// market's own generator (systems/banking.js housesForSale: xorshift32) seeded by the city's map id and the old key
// - one answer for one save, whatever order the city's buildings were read in. The old cell's discovered buildings
// are forgotten, the new house is discovered as the player's residence, and the Daggerfall Bank says so in a letter
// (systems/arenaText.js) and the notebook.
//
// ARENA2 (the fix): WHAT WAS IN IT, MOVED - NOT ITS PLACES. ARENA1 renamed the old house's scene onto the new one, and
// the old house's places do not fit the new one: a placed piece stood where the old room had floor, a container index
// named another chest, the furniture taken out named pieces the new house never had. So the old scene is EMPTIED
// into the new one by what it held (`emptyArenaScene`), the house-sale law's own doors (scenes/worldModes.js decorSold)
// where they fit:
//   - the owner's own things standing in it (DECOR2a's `decorOwn`) back where they live - a piece of furniture among
//     "Your things" (DECOR2b's furnishings, the save's), anything else the pack (`hooks.giveOwn`);
//   - the pieces bought from the catalogue and placed (DECOR1's `decor`) paid back WHOLE into the Daggerfall bank
//     account (`hooks.refund`) - a sale gives half, but nobody sold this house;
//   - the furniture taken out (BASE-HIDE's `hiddenBase`) forgotten - the new house stands as Daggerfall furnished it;
//   - everything the chests held (`lootContainers`), the storage pieces held (`decorItems`) and the floor held
//     (`droppedPiles`) carried into the NEW HOUSE'S FIRST CONTAINER (`container:0` of its cached scene, marked `crate`
//     - and where the new house stands no container, a crate set down where the owner first walks in:
//     scenes/worldModes.js restoreInteriorScene). Its other layouts' visits go the same way, into the same chest.
// ARENA-FIX 11: a torch (or a candle) left burning on the old floor is carried too - put out and into the chest, the
// item PickupLightSource mints of it (scenes/droppedTorches.js pickupLightSource: its group, its template, ceil(burn
// left / 20 s) of condition) - where ARENA2 had let it burn out. A camp is no house's.
//
// Online homes are the account service's (ARENA4): the service moves each home row in one migration - see
// bible/11-Multiplayer/Arena.md "ARENA1 record". [ARENA4b: the owner's CLIENT picks the new house - `arenaHomeFor`, this
// file's own pick over the buildings an online home may be - since the service holds no town's records; the service
// carries the row (server-account/src/homes.js arenaMoveHome) and the client empties the old scene by `emptyArenaScene`
// (systems/onlineHomes.js moveArenaHomes).] Every other record keyed to the cell (a rented room, a repair
// ticket, a quest site, an inside save, a Recall anchor) needs no move: layoutPins.recordStands answers false for it
// (world/arenaCity.js arenaRecordDisplaced) and each system's own law for a building that is not there takes it.

import { inArenaCell, arenaRecordDisplaced, ARENA_REGION } from '../world/arenaCity.js';
import { interiorSceneName, cacheScene, containsPermanentScene, addPermanentScene, removePermanentScene } from './sceneCache.js';
import { isResidence } from '../world/buildingNames.js';
import { templateByIndex } from './itemTemplates.js';   // ARENA-FIX 11: a torch left burning, back into an item
import { homeCandidate } from './onlineHomes.js';   // ARENA4b: the buildings an online home may be

/** The market's generator (banking.js housesForSale), seeded by what names this move. */
function pick(n, mapId, oldKey) {
  let seed = ((mapId * 0x9e3779b1) ^ (oldKey + 1)) >>> 0 || 1;
  // a few steps, not one: the market's seeds differ in their high bits (a map id), these in their low (a key)
  for (let i = 0; i < 4; i++) {
    seed ^= seed << 13; seed >>>= 0;
    seed ^= seed >>> 17;
    seed ^= seed << 5; seed >>>= 0;
  }
  return Math.floor((seed / 0x100000000) * n);
}

/**
 * The house a displaced deed moves to, or null. `summaries` is the city's building list as it stands now
 * (world/buildingSummaries.js - the arena's cell holds none); `oldType` the type the old house was; `held` the building
 * keys another record of the save holds in the city; `isActiveQuestBuilding(summary)` the market's own exclusion.
 */
export function arenaHouseFor({ mapId, oldKey, oldType }, summaries, { held = new Set(), isActiveQuestBuilding = null } = {}) {
  const free = (summaries ?? []).filter((s) => s.buildingKey > 0 && !inArenaCell(s.buildingKey) && !held.has(s.buildingKey)
    && !(isActiveQuestBuilding?.(s) ?? false)).sort((a, b) => a.buildingKey - b.buildingKey);
  let list = free.filter((s) => s.buildingType === oldType);
  if (!list.length) list = free.filter((s) => isResidence(s.buildingType));
  return list.length ? list[pick(list.length, mapId, oldKey)] : null;
}

/**
 * ARENA4b: THE HOUSE AN ONLINE HOME THE ARENA DISPLACED MOVES TO - the offline move's own pick (arenaHouseFor: the old
 * house's type first, any residence when none is free, by the market's generator seeded by the map id and the old key)
 * over the buildings an online home may be (systems/onlineHomes.js homeCandidate - the offline fallback would admit a
 * House2 a guild owns, which online never sells), `held` every key of the town a home holds (the service's town answer)
 * and `isActiveQuestBuilding` the market's own exclusion. The owner's client picks, in the town as the homes' layout stands
 * it; the service checks the keys (server-account/src/homes.js arenaMoveHome). Pure; null for none.
 */
export function arenaHomeFor(o, summaries, opts = {}) {
  return arenaHouseFor(o, (summaries ?? []).filter((s) => homeCandidate(s)), opts);
}

/** The key of the new house's first container in its scene (scenes/worldModes.js restoreInteriorScene's `container:i`). */
export const ARENA_CRATE_KEY = 'container:0';
const copyItem = (it) => ({ ...it });
/** HT1's light sources by template (systems/useItem.js TEMPLATES: Torch 247, Candle 253, Holy_candle 269) and their
 *  item groups - scenes/droppedTorches.js GROUP_FOR; SECONDS_PER_CONDITION systems/handheldTorches.js's. */
const LIGHT_GROUPS = Object.freeze({ 247: 'UselessItems2', 253: 'UselessItems2', 269: 'ReligiousItems' });
const LIGHT_SECONDS_PER_CONDITION = 20;
/** ARENA-FIX 11: a dropped light's saved entry (HandheldTorchesSaveData: `{ position, time, itemTemplateIndex }`) as the
 *  item picking it up gives, or null for no light. Pure. */
export function droppedLightItem(t) {
  const template = t?.itemTemplateIndex | 0;
  const group = LIGHT_GROUPS[template];
  if (!group) return null;
  return { group, templateIndex: template, maxCondition: templateByIndex(template)?.hitPoints ?? 0, currentCondition: Math.max(1, Math.ceil((Number(t.time) || 0) / LIGHT_SECONDS_PER_CONDITION)) };
}
/**
 * THE OLD HOUSE'S SCENE EMPTIED INTO THE NEW ONE (the fix above): every entry of `from` (and its other layouts' visits,
 * `from|<layout>`) taken out of the cache, what it held answered, and one entry cached under `to` - permanent if the old
 * one was - whose first container holds every item. Answers `{ own, refund, crate, pieces, hidden }`: the owner's own
 * things (to give back), the gold the placed pieces cost (to pay back whole), the items put in the new house's chest,
 * how many pieces were placed, how many furniture marks were dropped, and (ARENA-FIX 11) how many burning lights were
 * put out and carried. Pure on the cache.
 */
export function emptyArenaScene(cache, from, to) {
  const out = { own: [], refund: 0, crate: [], pieces: 0, hidden: 0, lights: 0 };
  if (!cache?.scenes) return out;
  const moved = (name) => name === from || name.startsWith(`${from}|`);
  let permanent = false;
  for (const [name, d] of [...cache.scenes]) {
    if (!moved(name)) continue;
    cache.scenes.delete(name);
    for (const item of Object.values(d?.decorOwn ?? {})) if (item) out.own.push(copyItem(item));
    for (const p of d?.decor ?? []) { if (p?.item) continue; out.pieces++; out.refund += Number.isSafeInteger(p?.paid) && p.paid > 0 ? p.paid : 0; }
    out.hidden += Array.isArray(d?.hiddenBase) ? d.hiddenBase.length : 0;
    for (const c of d?.lootContainers ?? []) if (Array.isArray(c?.items) && !String(c.key ?? '').startsWith('shelf')) out.crate.push(...c.items.map(copyItem));
    for (const list of Object.values(d?.decorItems ?? {})) if (Array.isArray(list)) out.crate.push(...list.map(copyItem));
    for (const pile of d?.droppedPiles ?? []) if (Array.isArray(pile?.items)) out.crate.push(...pile.items.map(copyItem));
    for (const t of d?.droppedTorches ?? []) { const it = droppedLightItem(t); if (it) { out.crate.push(it); out.lights++; } }   // ARENA-FIX 11
  }
  for (const name of [...cache.permanent]) if (moved(name)) { permanent = true; cache.permanent.delete(name); }
  removePermanentScene(cache, from);
  if (out.crate.length || permanent || containsPermanentScene(cache, to)) {
    cacheScene(cache, to, { lootContainers: out.crate.length ? [{ key: ARENA_CRATE_KEY, items: out.crate.map(copyItem), crate: true, stockedDate: 0 }] : [], frame: 'building' });
    if (permanent) addPermanentScene(cache, to);
  }
  return out;
}

/**
 * The move, on the save's records. `houses` banking's per-region deeds; `summaries`, `oldTypeOf(buildingKey)`,
 * `held`, `isActiveQuestBuilding` as above; `scenes` the save's scene cache; the hooks the host's (each optional):
 * `undiscoverCell()`, `discover(summary)`, `addNote(text)`, `notice()`; ARENA2's `giveOwn(items)` (the owner's own
 * things back - furniture to the furnishings, the rest to the pack) and `refund(gold)` (the placed pieces' cost, to
 * the bank). `displaced(rec)` defaults to the arena's law. Answers { from, to, name, own, refund, crate } for a deed
 * moved, else null.
 */
export function moveArenaRecords({ houses, summaries, oldTypeOf, held = new Set(), isActiveQuestBuilding = null, scenes = null, displaced = arenaRecordDisplaced } = {}, hooks = {}) {
  const slot = houses?.[ARENA_REGION];
  if (!slot || !(slot.buildingKey > 0) || !displaced(slot)) return null;
  const from = slot.buildingKey;
  const to = arenaHouseFor({ mapId: slot.mapId, oldKey: from, oldType: oldTypeOf?.(from) ?? null }, summaries, { held, isActiveQuestBuilding });
  if (!to) return null;
  const emptied = scenes ? emptyArenaScene(scenes, interiorSceneName(slot.mapId, from), interiorSceneName(slot.mapId, to.buildingKey)) : { own: [], refund: 0, crate: [] };
  slot.buildingKey = to.buildingKey;
  if (emptied.own.length) hooks.giveOwn?.(emptied.own);
  if (emptied.refund > 0) hooks.refund?.(emptied.refund);
  hooks.undiscoverCell?.();
  hooks.discover?.(to);
  hooks.addNote?.(to);
  hooks.notice?.(to);
  return { from, to: to.buildingKey, name: to.name ?? '', own: emptied.own.length, refund: emptied.refund, crate: emptied.crate.length };
}
