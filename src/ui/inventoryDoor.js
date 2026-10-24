// ═══════════════════════════════════════════════════════════════════
// U53 — THE INVENTORY DOOR: which pack the player opens, and the ONE
// place that builds either.
//
// The fourth seam of this shape, and the second that had to be MADE.
// FIVE sites constructed `new NativeInventoryWindow({ ... })`: three
// host factories, and TWO hand-rolled copies of a factory that was
// already in the same file and already took the extra keys they
// needed. The copies were verbatim - eleven identical hooks each,
// plus `loot` and `onClose`, which is exactly what `...extra` is for -
// and their indentation had drifted, which is what a copy-paste looks
// like a month later. Same finding as U52's, twice over.
//
// ── THE FORK WAS NARROW, AND U58 CLOSED IT ───────────────────────
//
// The classic window is not one screen. It is the pack, the LOOT pile,
// the WAGON, the guild REWARD picker, drop-gold and the whole USE
// chain, each with its own DFU law. U53 shipped the first of those and
// handed the classic window every call carrying a `loot` target or a
// `chooseOne` list - a boundary rather than a gap, since nothing was
// unreachable.
//
// U58 removed it, and could only remove it because U56 and U57 took
// the law out of the window first: TransferItem's ladder is
// systems/item/itemTransfer.js, the remote side's four claims and the
// wagon's two refusals are systems/inventorySession.js, and the
// enhanced pane runs both rather than a second reading of either.
// `CLASSIC_ONLY_MODES` is gone; the fork is now the plain skin
// question every other door asks.
//
// WHAT THE DOOR STILL OWES: the drop pile. DFU mints a world flat from
// the session's dropped items in OnPop (AUDIT B-C1), and the window
// GOING is the door's event rather than the view's - so the door reads
// the pile back out of the view and runs the same closeSession the
// classic window runs.
// ═══════════════════════════════════════════════════════════════════

import { isEnhanced } from '../systems/uiSkin.js';
import { mountEnhancedChunk } from './enhanced/enhancedChunk.js';   // MENU1: the one lazy-chunk door
import { registerOverlay } from './enhanced/enhancedOverlays.js';   // PX28: Tab puts it away
import { NativeInventoryWindow, inventoryArtLoaded } from './native/nativeInventory.js';
import { closeSession } from '../systems/inventorySession.js';
import { immersiveFootsteps } from '../systems/immersiveFootsteps.js';   // AUDIT-IF F5: the enhanced skin's close refreshes the mod's armour slots too
import { racialSuppressInventory } from '../systems/lycanthropy.js';   // DISC10-E L3: GetSuppressInventory, in the window itself
import { messageBox } from '../systems/notify.js';   // DISC10-E L3: DaggerfallUI.MessageBox, the refusal's voice
import { ChoiceWindow } from './talkWindow.js';   // REVENANT-FATE: the classic skin's keyed box
import { noteFirstUse } from '../systems/tutorials.js';   // TUT1: the first touch of a system pops its tutorial page

export { inventoryArtLoaded };

/** The gate a host asks before it opens the pack. The classic window
 *  cannot draw without INVE00I0 and its icon archives; the enhanced
 *  one reads no ARENA2 at all. Same law as ui/pauseDoor.js and
 *  ui/charSheetDoor.js. */
export function inventoryDoorReady() {
  return isEnhanced() || inventoryArtLoaded();
}

/**
 * Build the pack this skin wears. `deps` is NativeInventoryWindow's
 * own hook bag, unchanged - a host says what it HAS and never which
 * window that adds up to.
 */
export function createInventoryWindow(deps = {}) {
  // DISC10-E L3: THE BEAST'S REFUSAL LIVES IN THE WINDOW, as DFU's does.
  // DaggerfallInventoryWindow.OnPush asks the racial override
  // (GetSuppressInventory, :583-587) and its Update closes the window with
  // `DaggerfallUI.MessageBox(suppressInventoryMessage)` (:355-362) - every
  // way into the pack, loot and wagon and sheet alike, and the trade window
  // inherits it (DaggerfallTradeWindow.cs:355-376). The port had copied the
  // refusal onto a few of its doors and missed the rest (a building's pack,
  // every corpse and pile, the sheet's Items button). Here it is ONE door:
  // the line is said and no window is built - the caller mounts nothing.
  // REVENANT-FATE: a beaten revenant's choice is the loot window's fate side on the enhanced skin; the classic's canvas
  // window has no room for one, so there it is a keyed box - its name, its plea, K kill, S spare, Esc leave it
  // AUDIT (2026-10-02): before the beast's refusal - it refuses the pack, never the judgement (the classic box always
  // came first; the enhanced skin's loot window was refused in beast form)
  if (deps.fate) { noteFirstUse('revenants'); noteFirstUse('companions'); }   // TUT1: a beaten revenant's judgement - and the oath a spared one swears
  if (deps.fate) return isEnhanced() && typeof document !== 'undefined' ? enhancedInventoryOverlay(deps) : classicFateWindow(deps.fate);
  const sup = racialSuppressInventory(deps.entity);
  if (sup) { messageBox(sup.text); return null; }
  noteFirstUse(deps.loot && !deps.loot.playerOwned ? 'loot' : 'inventory');   // TUT1: a pile or a body is the loot page; the pack (and a store of the player's own) the inventory's
  // `document` for the reason every fork before this one gives: node
  // drives these hosts headless and keeps the canvas window rather
  // than getting a special case written for it.
  let built;
  if (isEnhanced() && typeof document !== 'undefined') {
    built = enhancedInventoryOverlay(deps);
  } else {
    built = new NativeInventoryWindow(deps);
  }
  // OUTDOOR-LOOT (DESIGN 3.6): a container that shares its list (a peer's foe's body) is told its window stands - once it is
  // built, on either skin - so it composes nothing under it (AUDIT WORLD4 C1); closeSession tells it the window is gone.
  // A refusal above built no window and told nobody. A host needs no line for either: both skins pass through here and there.
  deps.loot?.opened?.();
  return built;
}

/** REVENANT-FATE on the classic skin: the choice as a keyed box (talkWindow.js ChoiceWindow). */
function classicFateWindow(fate) {
  // AUDIT (2026-10-02): the details ride the box's wrapped lines (an option's label is never wrapped - a Spare's whole
  // sentence ran off the screen), and a choice it cannot take says why instead of vanishing
  const lines = [fate.name, fate.sub ?? '', '', fate.plea?.speech ? `"${fate.plea.speech}"` : (fate.plea?.body ?? ''), '',
    ...fate.options.map((o) => `${o.label}: ${o.detail}`)].filter((l, i, a) => l !== '' || (i > 0 && a[i - 1] !== ''));
  const options = fate.options.filter((o) => !o.disabled).map((o) => ({ code: `Key${o.key}`, label: `${o.key} - ${o.label}`, action: () => fate.choose(o.id) }));
  options.push({ code: 'Escape', label: 'Esc - Leave it kneeling', action: () => {} });
  return new ChoiceWindow({ lines, options });
}

/**
 * THE ENHANCED PACK, in the shape the hosts already push.
 *
 * A leaf, unlike U52's sheet: nothing it opens is a canvas window, so
 * there is no child to hide behind and every host arm is a NO-OP BY
 * DESIGN - the wizard's and the pause door's contract rather than the
 * sheet's. It says so at each arm, because a silently empty input()
 * is indistinguishable from a broken one.
 */
function enhancedInventoryOverlay(deps) {
  let fired = false;
  let view = null;

  const host = document.createElement('div');
  host.id = 'enhanced-inventory';
  // z-index 13, the depth every in-game enhanced screen shares: they
  // are peers and are never stacked on each other.
  // PX17c (Mac: "IT SHOULD BE TRANSPARENT LIKE THE REFERENCE"): the
  // pack's own scrims carry the tone now (PX16b/c) and the reference's
  // ground is THE GAME - this opaque slab was the pause door's pre-PX4
  // shape, one door over, and it blacked out every scrim behind it.
  // Same standing caveat as PX4: the classic window keeps its own
  // opaque draw; only the enhanced host goes glass.
  // CARD-FIT U5 (the card audit): CLIPPED, NOT HIDDEN - a box with `overflow: hidden` is still scrolled by the browser
  // to show a focused control, so a Tab onto a button under the screen's foot shoved the whole pack up and left it
  // there (nothing a wheel or a thumb could scroll back). `clip` is no scroller at all; `hidden` stays for a browser
  // without it.
  host.style.cssText = 'position:fixed;inset:0;z-index:13;background:transparent;overflow:hidden;overflow:clip';
  document.body.append(host);
  let unregister = () => {};   // PX28: Tab must be able to put the pack away

  const close = () => {
    if (fired) return;
    unregister();
    // THE PILE IS READ BEFORE THE UNMOUNT, which clears the view's
    // state. A drop that mints nothing is not a visible bug - it looks
    // like the player misremembered dropping something.
    const dropped = view?.dropped?.() ?? [];
    view?.unmount();
    view = null;
    host.remove();
    fired = true;   // last: `done` must not be true while the DOM is up
    // OnPop, through the module the classic window uses: the session's
    // dropped items mint their world flat and the container releases.
    // AUDIT 17e F28's law is the second half of that - a host that
    // handed onClose is owed the call whatever skin drew the window.
    closeSession(deps, { dropped });
    // AUDIT-IF F5: and Immersive Footsteps' inventory-close refresh is owed the same way. The first draft hooked
    // NativeInventoryWindow._closeSilently alone, and this skin - the DEFAULT one - never passes through it, so a
    // player in enhanced mode changed boots and walked five seconds in the old pair. (Not in closeSession itself:
    // systems/inventorySession.js is upstream of transport.js, which the component imports - a cycle.)
    immersiveFootsteps.onInventoryClose(deps.entity ?? null);
  };
  unregister = registerOverlay(close);

  const overlay = {
    isChoiceWindow: true,
    get done() { return fired; },
    input() { /* the view's own capture keydown owns the keyboard */ },
    click() { /* the view is a fixed opaque div; pointers never get here */ },
    wheel() { /* the view scrolls itself */ },
    hover() { /* the view has its own :hover, and no canvas to hit-test */ },
    tick() { /* nothing on this screen moves on a clock */ },
    draw() { /* DOM, not canvas */ },
    dispose() { close(); },
  };

  // MW-D36: the pack takes the Morrowind arm module by dynamic import
  // beside its own - the model figure reads fpArm.figure() when a body
  // stands and never touches it otherwise. Enhanced only: this door is
  // the enhanced skin's.
  // MENU1: the ONE lazy-chunk door (ui/enhanced/enhancedChunk.js). The arms
  // module keeps its own optional catch - a missing fpArm is a feature
  // that is off, not a screen that failed.
  mountEnhancedChunk({
    load: () => Promise.all([import('./enhanced/enhancedInventory.js'), import('../combat/fpArm.js').catch(() => null)]),
    mount: ([{ mountEnhancedInventory }, armMod]) => {
      view = mountEnhancedInventory(host, { ...deps, onExit: close, fpArm: armMod?.fpArm ?? null });
    },
    alive: () => !fired, host, onDismiss: () => { host.remove(); fired = true; }, label: 'inventory',
  });

  return overlay;
}
