// @ts-check
// DECOR2a/DECOR2b: THE OWNER'S OWN THINGS' DOORS - where one lives while it stands nowhere, one of it out of the pack to
// stand in a room, one given back. Moved out of the interior host (scenes/worldModes.js) by AUDIT FB1025i CHEST-DRAFT E1
// (HOST-SPLIT: the host shrinks), so the decorator's pins stand on the producer's own doors (test/decorFakes.mjs): the
// rig's give pushed where the host's refuses a record the pack already holds (inventory.js addItem), and its take
// spliced where the host's moves one as a drop does - and a Discard that gave before it took lost the only copy.
import { isFurnishing, ownBackLines } from './decorFurnish.js';
import { applyTransfer } from '../item/itemTransfer.js';
import { addItem } from '../inventory.js';
import { t } from '../textManager.js';   // the room's words, in the player's language

/**
 * The doors over `entity()` (the player's entity, read at each call - a load replaces it).
 * @param {() => any} entity
 */
export function createDecorPack(entity) {
  /** DECOR2b: where one of the player's own things lives while it stands nowhere - the pack, or the furnisher's
   *  deliveries (the save's `furnishings`: a bed is never carried). */
  function decorHome(/** @type {any} */ item) {
    if (isFurnishing(item)) return (entity().furnishings ??= []);
    return (entity().items ??= []);
  }
  /** DECOR2a: ONE OF THE PLAYER'S OWN THINGS OUT OF THE PACK, to stand in a room - one of a stack, moved as a drop
   *  moves it (itemTransfer.js applyTransfer: a lit torch stops lighting the player, a stack splits one off) - or null
   *  when it is no longer carried. AUDIT FB1025i E9: or worn - a piece in a slot is never pulled out of the pack from
   *  under its wearer (decorItems.js offers none to set down; a Discard asks after one taken down and put on since). */
  function decorPackTake(/** @type {any} */ item) {
    if (isFurnishing(item)) {   // DECOR2b: a delivered piece leaves the deliveries whole
      const list = decorHome(item);
      const i = list.indexOf(item);
      if (i < 0) return null;
      list.splice(i, 1);
      return item;
    }
    const pack = entity().items ?? [];
    if (!pack.includes(item) || item?.equipSlot != null) return null;
    return applyTransfer(item, { ok: true, amount: 1 }, pack, [], { entity: entity(), fromLocal: true }) ?? null;
  }
  /** DECOR2a: one of the player's own things back where it lives - taken down, or its room sold: the pack, or (DECOR2b)
   *  a piece of furniture delivered again. Answers the record that holds it now - AUDIT FB1025i E1: a candle given back
   *  joins the pack's stack of candles (inventory.js addItem), and the draft takes one off THAT stack to undo it. */
  function decorPackGive(/** @type {any} */ item) {
    if (isFurnishing(item)) { decorHome(item).push(item); return item; }
    entity().items ??= [];
    return addItem(entity().items, item);
  }
  return { decorHome, decorPackTake, decorPackGive };
}

/**
 * AUDIT FB1025i E8: WHAT A ROOM'S RECORD KEEPS UNDER PIECES IT DOES NOT STAND, back to its owner - a room whose pieces are
 * the save's (an offline house, a ship, a caravan): a draft left by its door and not discarded (the exit pressed while
 * decorating, the page closed) wrote what its staged pieces held and stood - the chests' goods and the owner's own things -
 * under ids its saved picture never stood again, out of reach for good. An online home's list stands its own (HOLD-KEPT,
 * decorReturnStrays); here the room's `pieces` (as restored) say which stand, and each thing kept under another id is
 * handed to `give` - the pack's own door (a piece of furniture to the deliveries): the restore runs before the player
 * stands inside, so no feet to set it down at - and `say`s so, as an online home's strays are said (worldModes.js
 * decorReturnStrays). Answers what came back.
 * @param {any} room scenes/decor/decorRoom.js's pool @param {any[]} pieces @param {(item: any) => void} give
 * @param {(line: string) => void} [say]
 */
export function returnUnstood(room, pieces, give, say) {
  const standing = new Set((pieces ?? []).map((p) => p?.id));
  const own = (room.ownIds?.() ?? []).filter((/** @type {string} */ id) => !standing.has(id)).map((/** @type {string} */ id) => room.takeOwn(id)).filter(Boolean);
  const back = [...own, ...(room.takeUnserved?.(pieces) ?? [])];
  for (const it of back) give(it);
  if (back.length) say?.(ownBackLines(back, (n) => t('decor.tool.strayBack', '{n, plural, one {One of your things was no longer here and went back to your pack.} other {# of your things were no longer here and went back to your pack.}}', { n })));
  return back;
}
