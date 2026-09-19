// ═══════════════════════════════════════════════════════════════════
// U52 — THE CHARACTER SHEET DOOR: which sheet F5 opens, and the ONE
// place that builds either.
//
// The third seam of this shape (U50's createChargenWindow, U51's
// openPauseFlow) and the first one that had to be MADE rather than
// found: nothing funnelled the sheet. Three hosts each wrote
// `new CharSheet(playerEntity, charSheetHooks({ ... }))` by hand, and
// exterior.js wrote it TWICE - once as `makeCharSheetWindow` for the
// interior host to borrow, and once inline in its own F5 arm, with the
// second copy missing the first's reasoning about the withheld quest
// hooks. They agree today. That is what drift looks like the day
// before it stops being true, and it is the exact shape AUDIT 17i
// split createChargenWindow out for.
//
// So the door builds the hooks AND the window. A host says what it
// HAS - its inventory, its spellbook, its quest bridge - and never
// which sheet that adds up to.
//
// ── THE CHILD WINDOWS ARE THE HARD PART ──────────────────────────
//
// The sheet is not a leaf. Its four navigation buttons PUSH a window
// (DFU's UI stack), and the port's hosts hold ONE overlay slot, so
// CharSheet owns its child and delegates to it - see its constructor's
// own note. Those children are classic CANVAS windows, and the
// enhanced sheet is an opaque DOM div over that canvas: a child pushed
// under a live enhanced sheet would draw perfectly, underneath
// something you cannot see through.
//
// The enhanced overlay therefore HIDES ITSELF while a child is up and
// forwards the whole contract down - and `draw` is the one that only
// exists because the child is canvas. U42 is the warning: the classic
// sheet forwarded tick, wheel, input and click and NOT hover, and the
// spellbook silently lost its highlight and all three tooltips on
// exactly the route three of the four hosts take. Every arm is
// forwarded here and every arm is pinned.
// ═══════════════════════════════════════════════════════════════════

import { isEnhanced } from '../systems/uiSkin.js';
import { actionOf } from './input.js';   // MAC-C: the REGISTRY's answer for the two window keys
import { mountEnhancedChunk } from './enhancedChunk.js';   // MENU1: the one lazy-chunk door
import { registerOverlay } from './enhancedOverlays.js';   // PX28: Tab puts it away
import { CharSheet, LevelUpScreen, charSheetArtLoaded } from './charsheet.js';
import { charSheetHooks } from './charSheetNav.js';
import { VirtueLevelUpScreen } from './virtueLevelUp.js';   // ORL1
import { usesVirtueLeveling } from '../systems/oblivionLeveling.js';   // ORL1
import { spendPoolLowest } from '../systems/chargen.js';   // LV1: the headless pool policy, for the font-less escape

export { charSheetArtLoaded };

/** The gate a host asks before it opens the sheet. The classic window
 *  has a text fallback and survives a failed art load; the enhanced
 *  one reads no ARENA2 at all. Same law as ui/pauseDoor.js. */
export function charSheetDoorReady() {
  return isEnhanced() || charSheetArtLoaded();
}

/**
 * Build the sheet this skin wears. `deps` is charSheetHooks' own bag -
 * { entity, inventory, spellbook, questMessages, notebook, artDeps } -
 * and a host that hands no hook gets the sheet's honest refusal on that
 * button, on either skin.
 */
export function createCharSheetWindow(deps = {}) {
  // AUDIT 39: THE SHEET IS WHERE DFU LEVELS YOU UP. UpdatePlayerValues
  // (DaggerfallCharacterSheetWindow.cs:369-394) mounts the stats
  // rollout on the sheet itself whenever ReadyToLevelUp is set - there
  // is no separate window in DFU - and the Oghma Infinium's only push
  // is that sheet (OghmaInfiniumEffect posts
  // dfuiOpenCharacterSheetWindow after setting both flags). The port
  // split the rollout out as LevelUpScreen, so the door mounted THAT
  // while a level-up is owed; the book was otherwise consumed for a
  // read-only sheet that never read either flag.
  //
  // AUDIT 44 (a11): the CLASSIC lane now levels where DFU levels -
  // CharSheet mounts the rollout itself from the same two flags, so
  // the sheet a player opens on F5 is the sheet that hands out the
  // points, and the skills pages behind it still work while it does.
  // LevelUpScreen stays as the ENHANCED skin's door, which has no
  // native panel to mount a rollout onto.
  // ORL1: ...AND BEFORE EITHER LANE'S OWN ROLLOUT, the mod's window.
  // A character created under Oblivion-Remaster-Like Leveling levels by
  // the mod's law in BOTH skins, because the mod's window is the mod's
  // window - the fork above is about which SHEET a skin wears, and this
  // is not a sheet. The Oghma Infinium is excluded on purpose: that
  // artefact is Daggerfall's own and its thirty points are DFU's law -
  // a book the mod has never heard of - so it falls through to the
  // port's own rollout below, in whichever lane. (The reason this used
  // to give, that thirty points cannot be spent under the mod's
  // three-attribute cap, is FALSE at the mod's own defaults: three rows
  // at five apiece with Luck at four is exactly thirty. ORL1's deep
  // audit.)
  //
  // LV1 (Mac, 2026-09-18: "the next enhanced UI window... a replication
  // of the skyrim level up UI in our own constellation vision"): AND
  // THE ENHANCED SKIN HAS A FACE FOR BOTH LAWS NOW. Until this slice
  // the skin fork stopped at the sheet: a level-up in the enhanced skin
  // mounted the CLASSIC LevelUpScreen - eight drawText rows on the
  // canvas - because there was nothing else to mount. The window that
  // replaced it (ui/enhancedLevelUp.js) is a FACE, not a third rollout:
  // it drives whichever of these two screens this character's law
  // wants, through that screen's own `input`, so the Level++, the
  // health roll and the mod's caps stay exactly where a11 and ORL1 put
  // them.
  if (deps.entity?.readyToLevelUp) {
    const virtue = !deps.entity?.oghmaLevelUp && usesVirtueLeveling(deps.entity);
    const rollout = () => (virtue ? new VirtueLevelUpScreen(deps.entity) : new LevelUpScreen(deps.entity));
    // `document` for the reason this file's other fork gives: node
    // drives these hosts headless and keeps the canvas windows.
    if (isEnhanced() && typeof document !== 'undefined') return enhancedLevelUpOverlay(rollout(), deps.entity);
    if (virtue) return new VirtueLevelUpScreen(deps.entity);
    if (isEnhanced()) return new LevelUpScreen(deps.entity);
    // ...and the CLASSIC lane falls through to the sheet, which mounts
    // DFU's own rollout on itself (AUDIT 44 / a11). Unchanged.
  }
  const hooks = charSheetHooks(deps);
  // `document` for the reason chargenSession's and pauseDoor's forks
  // give: node drives these hosts headless and keeps the canvas window
  // rather than getting a special case written for it.
  if (isEnhanced() && typeof document !== 'undefined') {
    // PX27: THE ENHANCED SHEET IS THE PAUSE WINDOW'S STATS PAGE.
    //
    // There were two enhanced character sheets - this door's overlay
    // and the pause window's Stats tab - reading the SAME four
    // sections out of the SAME sheetModel, which enhancedMenu imports
    // from enhancedCharSheet.js. One of them was the last pre-PX
    // surface in the game and drew its three columns hard against the
    // left edge; the other is the sheet this arc built. Keeping both
    // was the fault the F5 overlay existed to demonstrate.
    //
    // The DOOR's contract does not change - the host is handed an
    // overlay it mounts, exactly as before - so no host learns
    // anything new. What changes is which face is inside it, and the
    // sheet's own four buttons become that page's doors, out of these
    // same hooks: PX25 built the Stats page to take them.
    return enhancedSheetPageOverlay(hooks);
  }
  return new CharSheet(deps.entity, hooks);
}

/**
 * PX27: the pause window, opened on Stats, in the overlay shape the
 * hosts already push. The keyboard, the scrim and the frame are all
 * enhancedMenu's; this only chooses the page and forwards the sheet's
 * own four buttons onto it.
 */
function enhancedSheetPageOverlay(hooks) {
  let fired = false;
  let view = null;
  let unregister = () => {};   // PX28
  const host = document.createElement('div');
  host.id = 'enhanced-sheetpage';
  // z-index 13, the pause door's depth: they are peers, never stacked.
  host.style.cssText = 'position:fixed;inset:0;z-index:13;background:transparent;overflow:hidden';
  document.body.append(host);
  const close = () => {
    if (fired) return;
    try { view?.unmount?.(); } catch { /* already gone */ }
    view = null;
    host.remove();
    fired = true;   // last: `done` must not be true while the DOM is up
    // MAC-C: EVERY LISTENER HAS AN OWNER. The capture handler below
    // outlives the DOM it was raised for unless this line runs, and an
    // orphan capture listener that swallows F5 for the life of the page
    // is the hazard this file's own siblings warn about.
    globalThis.removeEventListener?.('keydown', onSheetKey, true);
    unregister();
  };
  // PX28: AFTER `close` exists - a const is not hoisted, and the
  // first placement of this line read it before its initialiser.
  unregister = registerOverlay(close);
  // MAC-C (2026-09-17, Mac: "you can exit out of the F6 menu
  // (inventory) by pressing F6 again, but you cannot do the same for
  // the F5 one (char sheet)" + "it would be extra cool if you could
  // like, be on the F5 page, press F6 and then go straight from char
  // sheet to inv").
  //
  // THE SHEET HAD NO KEY OF ITS OWN. PX27 made the enhanced sheet the
  // pause window's Stats page, and `enhancedMenu`'s capture handler
  // answers ONE key - Escape, the back stack's. That is right for the
  // pause face it is shared with (F5 must not close a paused game),
  // which is exactly why the arm belongs HERE, on the overlay F5
  // opened, and not there.
  //
  // Both keys come off the REGISTRY rather than the literals, because
  // a rebound sheet key that cannot close the sheet is the same bug
  // one layer down. The pack arm reuses the door the four buttons
  // already have (`hooks.inventory`), so a host that hands no pack
  // gets a key that falls through - the same honest refusal that
  // button gives.
  // A FUNCTION DECLARATION, hoisted on purpose: `close` above names it
  // and `registerOverlay` is handed `close` before this line is
  // reached. PX28's note two paragraphs up is the same hazard read
  // from the other side - a const here would be in its own temporal
  // dead zone for any caller that fired early.
  function onSheetKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const act = actionOf(e);
    if (act !== 'CharacterSheet' && !(act === 'Inventory' && hooks.inventory)) return;
    // A MODAL OVERLAY OWNS ITS INPUT (U50's law, the same one
    // enhancedMenu's handler states): on CAPTURE and stopped, so the
    // host's window keydown - which would re-open the very screen this
    // press is closing - never sees a key this screen used.
    e.preventDefault();
    e.stopPropagation();
    const toPack = act === 'Inventory';
    close();                              // the sheet's own close law runs FIRST...
    if (toPack) hooks.inventory();        // ...and this replaces the slot it just freed
  }
  // `globalThis` and OPTIONAL, for the reason this file's own forks
  // give: node drives these hosts headless and has no listener target,
  // so a bare `addEventListener` is a ReferenceError at mount rather
  // than a feature that is off. (Caught by the pins on the first run.)
  globalThis.addEventListener?.('keydown', onSheetKey, true);
  // MENU1: the ONE lazy-chunk door (ui/enhancedChunk.js). This door
  // had NO catch at all - a deploy that moved `enhancedMenu` left an
  // unhandled rejection and a dial arm that did nothing.
  mountEnhancedChunk({
    load: () => import('./enhancedMenu.js'),
    alive: () => !fired, host, onDismiss: close, label: 'charsheet',
    mount: ({ mountEnhancedMenu }) => {
    view = mountEnhancedMenu(host, {
      mode: 'pause',
      at: 'stats',
      onAction: (a) => { if (a === 'resume') close(); },
      // The sheet's own buttons, onto the page PX25 built to take
      // them. A host that hands no hook gets no button, which is the
      // same honest refusal the classic sheet gives.
      hooks: {
        openPack: hooks.inventory ? () => { close(); hooks.inventory(); } : undefined,
        openSpellbook: hooks.spellbook ? () => { close(); hooks.spellbook(); } : undefined,
        openChronicle: hooks.logbook ? () => { close(); hooks.logbook(); } : undefined,
      },
    });
    },
  });
  return {
    // THE HOST CONTRACT, in the hosts' own words - `input`, not
    // `onKey`. The hosts dereference these unguarded and the DOM view
    // only claims the keys it uses, so a missing arm is a TypeError
    // thrown inside the host's keydown handler. Same arms as
    // ui/pauseDoor.js and ui/inventoryDoor.js.
    isChoiceWindow: true,
    get done() { return fired; },
    input() { /* the view's own capture keydown owns the keyboard */ },
    click() { /* the view is a fixed div over the canvas; pointers never get here */ },
    wheel() { /* the view scrolls itself */ },
    hover() { /* the view has its own :hover, and no canvas to hit-test */ },
    tick() { /* nothing on this screen moves on a clock */ },
    draw() { /* DOM, not canvas */ },
    close,
    // `dispose` and `destroy` are both the hosts' words for the same
    // act; the overlay this replaced answered both, so this does too.
    dispose: close,
    destroy: close,
  };
}

/**
 * LV1: THE ASCENSION, in the overlay shape the hosts already push.
 *
 * The rollout `screen` is built by the caller above and is the LAW;
 * this is the host contract around a DOM window that drives it. The
 * shape is ui/charSheetDoor.js's own `enhancedSheetPageOverlay` -
 * fixed div, lazy chunk, the hosts' arms - with three differences,
 * each of which is a rule rather than a preference:
 *
 *   NO CROSS-OVER KEY. The sheet answers F5 and F6 because a sheet is
 *   a thing you toggle. A level-up is not: DFU's sheet refuses to
 *   close while points are unspent (CheckIfDoneLeveling :433-455), so
 *   there is no key that dismisses this and the window owns the
 *   keyboard whole.
 *
 *   NO OUTSIDE TAP. OT1's rule is that a tap on the scrim closes the
 *   window, and it is right for every framed window - but this screen
 *   has no scrim, because there is nothing behind it to return to.
 *
 *   A HEADLESS SPEND. `spendRemainingHeadless` is the font-less
 *   escape's arm (scenes/dungeonContext.js's drawOverlay): a level-up
 *   that cannot draw must not silently eat the pool. It lives HERE
 *   rather than in the chunk on purpose - the escape has to work in
 *   the one case where the chunk is what failed.
 */
function enhancedLevelUpOverlay(screen, entity) {
  let fired = false;
  let view = null;
  const host = document.createElement('div');
  host.id = 'enhanced-levelup';
  // z-index 14 - above the sheet's 13. They are never both up (a
  // level-up is the door's answer INSTEAD of a sheet), and the order
  // says which would win if a host ever pushed both.
  host.style.cssText = 'position:fixed;inset:0;z-index:14;background:transparent;overflow:hidden';
  document.body.append(host);
  const close = () => {
    if (fired) return;
    try { view?.destroy?.(); } catch { /* already gone */ }
    view = null;
    host.remove();
    fired = true;   // last: `done` must not be true while the DOM is up
  };
  // MENU1: the ONE lazy-chunk door. A deploy that moved this chunk
  // leaves the notice up and the door OPEN - `done` stays false and
  // the host keeps the slot, so the game does not hand the keys back
  // to a player who is owed a level. Dismissing it closes this window
  // and nothing else: `readyToLevelUp` is still set, so the next
  // 360-minute check and the next F5 both re-offer it (the cost is one
  // discarded BonusPool draw, which AUDIT 23 minds about the RNG
  // stream and which no player can observe).
  mountEnhancedChunk({
    load: () => import('./enhancedLevelUp.js'),
    alive: () => !fired, host, onDismiss: close, label: 'levelup',
    mount: ({ mountEnhancedLevelUp }) => {
      view = mountEnhancedLevelUp(host, { screen, entity, onExit: close });
    },
  });
  return {
    /** The duck type the font-less escape asks for, in this file's own
     *  idiom (`isVirtueLevelUp`, `isRestWindow`): a scene must not
     *  import a UI class for a type test. */
    isEnhancedLevelUp: true,
    isChoiceWindow: true,
    get done() { return fired; },
    input() { /* the view's own capture keydown owns the keyboard */ },
    click() { /* the view is a fixed div over the canvas; pointers never get here */ },
    wheel() { /* the view scrolls itself */ },
    hover() { /* the view has its own :hover, and no canvas to hit-test */ },
    tick() { /* the sky owns its own clock */ },
    draw() { /* DOM, not canvas */ },
    /**
     * THE FONT-LESS ESCAPE, per lane. The mod's purse is not a DFU
     * bonus pool - spending it with spendPoolLowest would ignore the
     * three-attribute cap, the +5 ceiling and Luck's price - so its own
     * planner runs and commits through the same `confirm` a player's
     * Enter uses. The classic pool takes the policy every other
     * headless path takes (systems/chargen.js's spendPoolLowest), which
     * is what scenes/dungeonContext.js's `.leveling` arm already does
     * to the sheet's rollout; the shape is the same because the state
     * is the same.
     */
    spendRemainingHeadless() {
      if (screen?.isVirtueLevelUp) { screen.spendRemainingHeadless(); close(); return true; }
      if (screen?.working) {
        spendPoolLowest(screen.working, Object.keys(screen.working), screen.pool ?? 0);
        screen.pool = 0;
        screen.input('confirm');   // applyLevelUp writes the working stats home, with the PRE-ROLLED pool
      }
      close();
      return true;
    },
    close,
    // `dispose` and `destroy` are both the hosts' words for the same act.
    dispose: close,
    destroy: close,
  };
}

/* PX27: THE ENHANCED SHEET OVERLAY IS RETIRED.
 *
 * It lived here from U52 until this slice and was the last pre-PX
 * surface in the game: a `.sheet-shell` of three columns filling the
 * viewport from the left edge, with the sheet's four buttons down its
 * side. Everything it showed, the pause window's Stats page shows -
 * the same four sections out of the same sheetModel, which
 * enhancedMenu imports from ui/enhancedCharSheet.js - and since PX25
 * that page takes the four buttons too.
 *
 * `ui/enhancedCharSheet.js` STAYS: `sheetModel` is the model both
 * sheets always read, and it is now read by the one that remains.
 * What went is the ~200 lines of view that drew the second one.
 */

