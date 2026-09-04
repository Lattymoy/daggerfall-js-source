// UI1 - THE USE-MAGIC-ITEM WINDOW: DaggerfallUseMagicItemWindow (MIT,
// Daggerfall Workshop), whole. DFU's U key (Actions.UseMagicItem) opens
// a list picker of everything in the pack you can USE by magic - an
// item with a CastWhenUsed legacy enchantment, or any potion - and
// picking one uses it.
//
// The port had the door and not the room: input.js:419 routes the
// action to `ctx.openUseMagicItem`, hudLarge.js:151 gives the large
// HUD's button its rect, inputActions.js binds KeyU - and no host
// implemented the method, so a bound key did nothing. The anti-lie law
// says a deferred feature shows as deferred; a live binding that
// silently no-ops is the other thing.
//
// The window IS DaggerfallListPickerWindow (`: base(uiManager,
// previous)`), so the port's ListPickerWindow is the whole of it:
//   - AllowCancel = false (:18) - the toggle key closes it, not Escape.
//   - Refresh() lists LongName per item (:50-57).
//   - DaggerfallUI :581-583 pushes the window ONLY when
//     UpdateUsableMagicItems() > 0: with nothing usable, no window
//     opens at all rather than an empty list.
//   - MagicItemPicker_OnItemPicked (:86-98) closes FIRST, then uses:
//     a potion is drunk and one removed, an enchanted item runs its
//     Used payload. Both of those arms are systems/useItem.js already
//     (the inventory's own use path), so the pick hands the item to
//     the host's use seam rather than re-deriving them here.

import { ListPickerWindow } from './listPicker.js';
import { ENCHANTMENT_TYPES } from '../formats/magicDef.js';
import { isPotion } from '../systems/useItem.js';
import { isEnchanted as defaultIsEnchanted } from '../systems/inventory.js';

/**
 * UpdateUsableMagicItems (:58-81), verbatim: walk the pack in order;
 * an ENCHANTED item joins on its first CastWhenUsed enchantment (the
 * `break` - one entry per item, however many such enchantments it
 * carries), and a POTION joins on the else arm. An enchanted potion
 * takes the first arm, so a potion whose enchantments include
 * CastWhenUsed is listed once, not twice.
 */
export function usableMagicItems(items = [], { isEnchanted = defaultIsEnchanted } = {}) {
  const out = [];
  for (const item of items ?? []) {
    if (!item) continue;
    if (isEnchanted(item) && item.enchantments != null) {
      for (const e of item.enchantments) {
        if (e?.type === ENCHANTMENT_TYPES.CastWhenUsed) { out.push(item); break; }
      }
    } else if (isPotion(item)) {
      out.push(item);
    }
  }
  return out;
}

/**
 * DaggerfallUI's `dfuiOpenUseMagicItemWindow` arm (:581-583): the
 * window opens only when something is usable.
 * @returns {ListPickerWindow|null} the window, or null when nothing is
 */
export function createUseMagicItemWindow({ items = [], onUse = null, onClose = null,
  isEnchanted = defaultIsEnchanted, nameOf = (it) => it?.name ?? '' } = {}) {
  const usable = usableMagicItems(items, { isEnchanted });
  if (usable.length === 0) return null;
  const win = new ListPickerWindow({
    items: usable.map(nameOf),
    // AllowCancel = false (:18): Escape does not close this one - the
    // UseMagicItem key does, which is the host's toggle.
    allowCancel: false,
    onPick: (index) => {
      // :88-90 - the window closes BEFORE the item is used, so a use
      // that opens its own box (a potion's message) is not covered by
      // a list that is on its way out.
      win.done = true;
      onClose?.();
      onUse?.(usable[index], index);
    },
  });
  return win;
}
