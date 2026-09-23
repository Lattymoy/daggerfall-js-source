// UI1 - THE USE-MAGIC-ITEM WINDOW: DaggerfallUseMagicItemWindow (MIT,
// Daggerfall Workshop), whole. DFU's U key (Actions.UseMagicItem) opens
// a list picker of everything in the pack you can USE by magic - an
// item with a CastWhenUsed legacy enchantment, or any potion - and
// picking one uses it.
//
// The port had the door and not the room: input.js:714 routes the
// action to `ctx.openUseMagicItem`, hudLarge.js:152 gives the large
// HUD's button its rect, inputActions.js binds KeyU - and no host
// implemented the method, so a bound key did nothing. The anti-lie law
// says a deferred feature shows as deferred; a live binding that
// silently no-ops is the other thing.
//
// The window IS DaggerfallListPickerWindow (`: base(uiManager,
// previous)`), so the port's ListPickerWindow is the whole of it:
//   - AllowCancel = false (:34-35) switches off only the BASE class's
//     Escape ("Prevent duplicate close calls with base class's exitKey"):
//     the window closes ITSELF in Update (:68-80) - the UseMagicItem key
//     or the back button (Escape) arms on the press and closes on the
//     release. DISC8-D (Discord: "I also get stuck on the use magic item
//     window"): the port read AllowCancel as "Escape does not close it"
//     and left the toggle to a host that never had one, so nothing but
//     USING an item closed it - no key, no touch X, no pad Back.
//   - ParentPanel.BackgroundColor = Color.clear (:33): no backdrop.
//   - Refresh() lists LongName per item (:50-57).
//   - DaggerfallUI :581-583 pushes the window ONLY when
//     UpdateUsableMagicItems() > 0: with nothing usable, no window
//     opens at all rather than an empty list.
//   - MagicItemPicker_OnItemPicked (:123-136) closes FIRST, then uses:
//     a potion is drunk and one removed, an enchanted item runs its
//     Used payload. Both of those arms are systems/useItem.js already
//     (the inventory's own use path), so the pick hands the item to
//     the host's use seam rather than re-deriving them here.

import { ListPickerWindow } from './listPicker.js';
import { ENCHANTMENT_TYPES } from '../formats/magicDef.js';
import { isPotion } from '../systems/useItem.js';
import { isEnchanted as defaultIsEnchanted } from '../systems/inventory.js';
import { audio } from '../systems/audio.js';   // AUDIT 64 F43: MagicItemPicker_OnItemPicked's ButtonClick
import { SOUND } from '../systems/soundClips.js';
import { bindings } from './input.js';
import { actionForCode } from '../systems/inputActions.js';
import { normalizeCode } from '../systems/dialogShortcuts.js';

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

/** DISC12: DaggerfallUI.cs:584-585 - with nothing usable, `AddHUDText(GetLocalizedText("noItemToActivate"))`,
 *  Internal_Strings.csv:959 verbatim. The port opened nothing and said nothing: a U press that looked dead. */
export const NO_ITEM_TO_ACTIVATE_TEXT = 'You have no usable magic item';

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
    backdrop: 'none',   // :33 ParentPanel.BackgroundColor = Color.clear
    // AllowCancel = false (:34-35): the base class's Escape is off
    // because Update below closes the window itself.
    allowCancel: false,
    onPick: (index) => {
      // AUDIT 64 F43: MagicItemPicker_OnItemPicked (:123-125) HEADS
      // the handler with PlayOneShot(SoundClips.ButtonClick) - before
      // the close and before the use. Neither ListBox nor
      // DaggerfallListPickerWindow plays anything, so this handler is
      // the only click on the pick, and it must not move into
      // listPicker.js: the base window's other consumers are silent
      // in DFU too.
      audio.playOneShot(SOUND.ButtonClick, 1);
      // :88-90 - the window closes BEFORE the item is used, so a use
      // that opens its own box (a potion's message) is not covered by
      // a list that is on its way out.
      win.done = true;
      onClose?.();
      onUse?.(usable[index], index);
    },
  });
  // DISC8-D: Update (:68-80), verbatim - GetKeyDown(UseMagicItem) ||
  // GetBackButtonDown() ARMS (isCloseWindowDeferred), and the matching
  // release closes. The release of the press that OPENED the window
  // finds nothing armed, so it cannot close what it opened.
  const closesIt = (code, e) => {
    const c = normalizeCode(code, e);   // 'back' is Escape, 'char:u' is KeyU
    return c === 'Escape' || (c != null && actionForCode(bindings(), c) === 'UseMagicItem');
  };
  let isCloseWindowDeferred = false;
  const pick = win.input.bind(win);
  win.input = (code, e = null) => {
    if (closesIt(code, e)) isCloseWindowDeferred = true;
    pick(code, e);   // base.Update runs first in DFU: the list still sees the press
  };
  win.keyup = (code, e = null) => {
    if (!isCloseWindowDeferred || !closesIt(code, e)) return;
    isCloseWindowDeferred = false;
    win.done = true;   // CloseWindow
    onClose?.();
  };
  return win;
}
