// @ts-check
// ═══════════════════════════════════════════════════════════════════
// DECOR2a (2026-09-25) — YOUR OWN THINGS IN A ROOM.
//
// Mac, on what decor is: "rare misc artifacts and other items in the
// world can also be placed"; asked, placing one is "Free and can be
// picked back up", and a home, house or ship sold with them standing
// gives them "Back to pack". So an item of the player's own - a gem, a
// painting, a statue, a candle, an artifact - leaves the pack, stands
// in a room as the picture Daggerfall itself gives it in the world, and
// comes back whole when it is taken down.
//
// The ITEM is the owner's save's the whole time it stands (the room's
// pool keeps it by the piece's id, and the scene keeps it with the room,
// as what a storage piece holds is kept); the PIECE is only how the room
// shows it. An online home's piece is the account service's, and so it
// carries no free text: `item` is the game's own numbers for which item
// it is (net/decorLaw.js decorItemOf), which every visitor's client
// names from its own data.
//
// Weapons and armour are not stood: they are MOUNTED (DECOR2c).
//
// DECOR2c (2026-09-25) — THE MOUNTS. Mac: "a way to display your
// weapons"; asked, "Mounted": a weapon (arrows aside) or a shield hangs
// FLAT against the wall it is set on, as its detailed pack picture -
// the list's own, the owner's body's (net/decorLaw.js decorIsMount;
// scenes/decorRoom.js hangs it). Free, and back to the pack whole when
// taken down, as every own thing is. Its dye is read off its numbers,
// so every client wears it the same.
// ═══════════════════════════════════════════════════════════════════

import { templateByIndex, inventoryItemImage } from './itemTemplates.js';
import { itemLongName } from './itemInfo.js';
import { getMagicItemTemplates, ITEM_GROUP_NAME_BY_CLASS } from './loot.js';
import { TEMPLATES, isMap } from './useItem.js';
import { isSummoned } from './inventory.js';
import { decorFlatLight } from './decorCatalogue.js';
import { itemDyeColor } from './itemDye.js';
import { decorItemOf, decorIsMount, DECOR_ARCHIVE_MAX, DECOR_RECORD_MAX } from '../net/decorLaw.js';

/** The groups whose items never stand as themselves: weapons and armour are mounted (DECOR2c); a vehicle is no thing
 *  one carries, coin is a counter, and a deed or a quest's own item is not the player's to set down. */
export const DECOR_OWN_NEVER_GROUPS = Object.freeze(new Set(['Weapons', 'Armor', 'Transportation', 'Currency', 'Deeds', 'QuestItems']));
/** The items kept back by name: paper worth money or a house (a letter of credit, a deed) and the book of the
 *  player's own spells - set down in a home, it would be out of reach wherever the player went. */
export const DECOR_OWN_KEPT_BACK = Object.freeze(new Set([TEMPLATES.Spellbook, TEMPLATES.Letter_of_credit, TEMPLATES.House_Deed, TEMPLATES.Ship_Deed]));

/** An item's picture in the world - its own fields first (an artifact's own picture, a potion's own bottle - DFU's
 *  world arm reads the item, which SetItem only seeds from the template), else its template's - as a piece's flat, or
 *  null: none, or past what a piece may show. */
export function decorItemFlat(item) {
  const t = templateByIndex(item?.templateIndex);
  if (!t) return null;
  const own = Number.isSafeInteger(item.worldTextureArchive) && item.worldTextureArchive > 0 && Number.isSafeInteger(item.worldTextureRecord);
  const archive = own ? item.worldTextureArchive : t.worldTextureArchive;
  const record = own ? item.worldTextureRecord : t.worldTextureRecord;
  if (!Number.isSafeInteger(archive) || archive <= 0 || archive > DECOR_ARCHIVE_MAX) return null;
  if (!Number.isSafeInteger(record) || record < 0 || record > DECOR_RECORD_MAX) return null;
  return [archive, record];
}

/** WHICH item it is, as the game's own numbers (net/decorLaw.js decorItemOf): its template, its group's number, and
 *  its material, variant, artifact and message where it has them - or null. */
export function decorDescriptorOf(item) {
  if (!item) return null;
  const g = ITEM_GROUP_NAME_BY_CLASS.indexOf(item.group);
  const bits = item.artifactIndexBitfield ?? 0;
  const a = item.artifact && (bits & 1) ? bits >> 1 : null;
  const p = (item.group === 'Paintings' || item.group === 'Books') && Number.isSafeInteger(item.message) ? item.message : null;
  return decorItemOf({
    t: item.templateIndex, g: g >= 0 ? g : null,
    m: Number.isSafeInteger(item.material) && item.material > 0 ? item.material : null,
    v: Number.isSafeInteger(item.variant) && item.variant > 0 ? item.variant : null,
    a, p,
  });
}

/**
 * WHAT AN ITEM OF THE PLAYER'S OWN STANDS AS - `{ flat, light, item }`, its picture, the light it gives (a candle's,
 * a torch's - Daggerfall's own, as the catalogue's) and its descriptor - or null when it cannot stand: anything worn
 * (DFU's own pack list never shows it), a quest's item, a summoned one, a map (it is read, never kept), the groups
 * and items kept back above, and anything with no picture of its own.
 */
export function decorStandOf(item) {
  if (!item || item.questItem || item.equipSlot != null || isSummoned(item) || isMap(item)) return null;
  if (DECOR_OWN_NEVER_GROUPS.has(item.group) || DECOR_OWN_KEPT_BACK.has(item.templateIndex)) return null;
  const flat = decorItemFlat(item);
  const descriptor = flat ? decorDescriptorOf(item) : null;
  if (!flat || !descriptor) return null;
  return { flat, light: decorFlatLight(flat), item: descriptor };
}

/**
 * DECOR2c: WHAT A WEAPON OR A SHIELD HANGS AS - `{ flat, light: null, item }`, its pack picture (the list's own - the
 * owner's body's, as the pack draws it) - or null: no weapon or shield (arrows neither), anything worn, a quest's, a
 * summoned one, or a picture past what a piece may show.
 */
export function decorMountOf(item, identity = undefined) {
  if (!item || item.questItem || item.equipSlot != null || isSummoned(item)) return null;
  const descriptor = decorDescriptorOf(item);
  if (!descriptor) return null;
  const pic = inventoryItemImage(item, identity);
  const flat = pic ? [pic.archive, pic.record] : null;
  if (!flat || !decorIsMount({ model: null, flat, item: descriptor })) return null;
  if (!Number.isSafeInteger(flat[0]) || flat[0] <= 0 || flat[0] > DECOR_ARCHIVE_MAX) return null;
  if (!Number.isSafeInteger(flat[1]) || flat[1] < 0 || flat[1] > DECOR_RECORD_MAX) return null;
  return { flat, light: null, item: descriptor };
}

/** DECOR2c: the dye a mount's picture wears - its material's, as the pack's (itemDye.js), read off its numbers alone
 *  so every client wears it the same; an artifact's own colours are its own. */
export function decorMountDye(d) {
  const own = decorItemOf(d);
  if (!own) return null;
  const group = own.g != null ? ITEM_GROUP_NAME_BY_CLASS[own.g] ?? null : null;
  return itemDyeColor({ templateIndex: own.t, group, material: own.m ?? 0, artifact: own.a != null });
}

/**
 * The name every client gives an own item's piece from its descriptor alone - so a visitor reads what the owner set
 * down: an artifact's own name (MAGIC.DEF, once it is read), a book's title, else the name the item lists under (a
 * plant's northern or southern, a material before a blade), else its template's. Null for nothing known.
 */
export function decorItemName(d) {
  const own = decorItemOf(d);
  if (!own) return null;
  if (own.a != null) {
    const artifacts = (getMagicItemTemplates() ?? []).filter((m) => m.type === 1 || m.type === 2);
    const name = artifacts[own.a]?.name;
    if (name) return name;
  }
  const t = templateByIndex(own.t);
  if (!t) return null;
  const group = own.g != null ? ITEM_GROUP_NAME_BY_CLASS[own.g] ?? null : null;
  // the list's own naming reads a book's title off its message (itemInfo.js resolveItemName)
  const item = { templateIndex: own.t, group, material: own.m ?? 0, variant: own.v ?? 0, isIdentified: true, message: own.p ?? 0 };
  return itemLongName(item) || t.name;
}

/**
 * The decorate panel's row for one item in the pack - `{ key, kind: 'own', own, name, flat, light, item, icon, ... }`,
 * `own` the item itself and `icon` its pack picture (the list's own, dye and all) - or null when it can neither stand
 * nor (DECOR2c) hang: `mount` says it hangs. `index` keys the row (the tool keys it by the item itself -
 * scenes/decorTool.js ownEntries).
 */
export function decorOwnEntry(item, index, identity = undefined) {
  const stands = decorStandOf(item);
  const hangs = stands ? null : decorMountOf(item, identity);
  const as = stands ?? hangs;
  if (!as) return null;
  const pic = inventoryItemImage(item, identity);
  return {
    key: `own:${index}`, kind: 'own', own: item, name: itemLongName(item), model: null, flat: as.flat,
    light: as.light, item: as.item, storage: false, count: item.stackCount ?? 1, mount: !!hangs,
    icon: pic && (pic.archive > 0 || pic.record > 0) ? pic : { archive: as.flat[0], record: as.flat[1], dye: null },
  };
}

/** What a sale says of the owner's own things that stood in the room - back in the pack (Mac: "Back to pack"). */
export const decorOwnBackLine = (n) => (n === 1 ? 'One of your things that stood in it came back to your pack.'
  : `${n} of your things that stood in it came back to your pack.`);
