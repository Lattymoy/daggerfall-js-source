// ═══════════════════════════════════════════════════════════════════
// U51 — THE PAUSE DOOR: which screen Escape opens, and the ONE place
// that decides.
//
// ── THE GAP THIS CLOSES ──────────────────────────────────────────
//
// U49 opened the enhanced front door and its own record states the
// complaint that justified it: settings were "reachable only at boot:
// once you were playing there was no door back that was not a
// reload". That was true of the CLASSIC front door. It stayed true of
// the enhanced one, because `runEnhancedMenu` is called from exactly
// one place - src/main.js, before the world boots - and Escape inside
// the game went on opening `ui/pauseWindow.js`, a 320x200 OPTN00I0
// panel with five hand-placed controls on it. A player on the
// enhanced skin met the enhanced design once, at boot, and then
// played a classic game.
//
// So Escape now opens the SAME screen the front door mounts, in pause
// mode, with the host's own save/load/exit hooks wired into it.
//
// ── WHY THE FORK IS HERE AND NOT IN THE FOUR HOSTS ───────────────
//
// THE ONE CONSTRUCTION SEAM, again. AUDIT 17i split `createChargenWindow`
// out after three separate bugs came from hosts wiring chargen by
// hand, and U50 then put the skin fork INSIDE it - which is why the
// enhanced wizard cost the two hosts that call it no edit at all. The
// four hosts here already funnel through one function, `openPauseFlow`,
// so the fork goes in front of that function and the hosts keep
// calling what they always called.
//
// It is a MODULE of its own rather than a branch inside
// `ui/pauseWindow.js` because that file is the classic window - 84
// lines of OPTN00I0 rect geometry cited to DaggerfallPauseOptionsWindow
// - and a classic window that imports the enhanced design is how the
// two skins stop being separable. Here the classic module knows
// nothing about the fork, and a player who chose classic never loads
// a byte of the enhanced screen: the import below is DYNAMIC.
//
// ── THE ART GATE MOVED, THE SAME WAY THE DATA GATE DID ───────────
//
// The hosts do not just call `openPauseFlow`; they GATE it on
// `pauseArtLoaded()`, because the classic window cannot draw one pixel
// without OPTN00I0.IMG. The enhanced screen needs no ARENA2 at all -
// that is the whole premise of U49's door - so gating it on classic
// art would mean a player whose art load failed had no pause menu, no
// settings and no way out, on a screen that would have rendered
// perfectly. `pauseDoorReady` is that decision in ONE predicate, for
// the reason systems/uiSkin.js gives for being one too: a port that
// spells the test out at six call sites is a port where the sixth
// spells it differently.
// ═══════════════════════════════════════════════════════════════════

import { isEnhanced } from '../systems/uiSkin.js';
import {
  openClassicPauseFlow,
  pauseArtLoaded,
  preloadPauseFlowArt,
} from './pauseWindow.js';

// The hosts warm the classic art on both skins and always have. It is
// re-exported rather than re-decided here: a player can switch to
// classic from inside the pause screen's own settings pane, and the
// switch reloads (ui/enhancedMenu.js's skinRow), so the art has to be
// warm on the way back in.
export { preloadPauseFlowArt, pauseArtLoaded };

/** The gate every host asks before it opens the door. Enhanced needs
 *  no art; classic cannot draw without it. */
export function pauseDoorReady() {
  return isEnhanced() || pauseArtLoaded();
}

/**
 * Open the pause screen. Same signature the four hosts have always
 * called: `show` puts the returned window in the host's overlay slot
 * (which is what stops the motor and the clock - the overlay-hold law,
 * AUDIT 18 F9), and `hooks` is that host's own
 * { quickSave, quickLoad, exitToMenu, savingPrevented, textLines }.
 */
/**
 * PX26: `hooks.at` names the page the enhanced window opens ON -
 * 'quests', 'stats' or 'system'. The CLASSIC flow takes the same hooks
 * and ignores it, because the classic pause has no tabs to land on.
 */
export function openPauseFlow(show, hooks = {}) {
  // `document` is the second half of the test for the reason
  // chargenSession's fork gives: a node test drives these hosts
  // headless, has no document, and must keep the canvas window rather
  // than get a special case written for it.
  if (isEnhanced() && typeof document !== 'undefined') return enhancedPauseOverlay(show, hooks);
  return openClassicPauseFlow(show, hooks);
}

/**
 * THE ENHANCED PAUSE SCREEN, in the shape the hosts already push.
 *
 * It answers the same overlay contract as every canvas window and does
 * almost nothing with it, exactly as the enhanced wizard does: the div
 * is fixed and opaque over the canvas so pointers never reach the
 * host's seam, and the menu's own capture keydown answers Escape
 * through the shared table. Every host arm below is therefore a NO-OP
 * BY DESIGN and says so - a silently empty `input()` here would look
 * identical to a broken one.
 *
 * `done` goes true only after the view is down. The hosts tear an
 * overlay out of the slot the moment it reports done, and a DOM node
 * outlives the object reporting it, so the order is: unmount, then
 * fire.
 */
function enhancedPauseOverlay(show, hooks) {
  let fired = false;
  let view = null;

  const host = document.createElement('div');
  host.id = 'enhanced-pause';
  // z-index 13: above the front door (12), below the wizard (14).
  // PX4 (Mac): TRANSLUCENT - the classic pause has always drawn its
  // panel over the live frame in the same overlay slot, so the frame
  // is there to show; the menu's own .px-over scrim owns the tone.
  // STANDING CAVEAT: a host that stops presenting under an overlay
  // would show the renderer's pale clear through this - the classic
  // window's behaviour says none does, but the first real-ARENA2
  // eyeball owns the verdict (the boot door stays opaque for exactly
  // that clear).
  host.style.cssText = 'position:fixed;inset:0;z-index:13;background:transparent;overflow:hidden';
  document.body.append(host);

  const close = () => {
    if (fired) return;
    view?.unmount();
    view = null;
    host.remove();
    fired = true;   // last: `done` must not be true while the DOM is still up
  };

  const overlay = {
    isChoiceWindow: true,
    get done() { return fired; },
    input() { /* the view's own capture keydown owns the keyboard */ },
    click() { /* the view is a fixed opaque div; pointers never get here */ },
    wheel() { /* the view scrolls itself */ },
    tick() { /* nothing on this screen moves on a clock */ },
    draw() { /* DOM, not canvas */ },
    dispose() { close(); },
  };

  // THE FOUR EXITS. Every one of them takes the screen down FIRST and
  // then acts, which is classic's own order (pauseWindow.js:195, :198,
  // :161 - `_closeWith()` then the hook) and matters more here: the
  // port answers a save or a load with a HUD line, and this screen is
  // an opaque div over the entire canvas, so a hook fired underneath a
  // live door would put its own confirmation out of sight.
  const act = (action) => {
    close();
    if (action === 'save') hooks.quickSave?.();
    else if (action === 'load') hooks.quickLoad?.();
    else if (action === 'exit') hooks.exitToMenu?.();
    // 'resume' is the close and nothing else.
  };

  show(overlay);

  // Mounted lazily and asynchronously so the classic skin pays nothing
  // for a module it will never show. A failure to load costs the pause
  // menu, so it says so loudly and takes the empty div with it rather
  // than leaving the host holding an overlay that draws nothing and
  // never reports done - which would be a frozen game.
  import('./enhancedMenu.js').then(({ mountEnhancedMenu }) => {
    if (fired) { host.remove(); return; }   // disposed before the module landed
    view = mountEnhancedMenu(host, { mode: 'pause', hooks, onAction: act, at: hooks.at ?? null });
  }).catch((e) => {
    console.warn('[pause] the enhanced pause screen would not mount', e);
    host.remove();
    fired = true;
  });

  return overlay;
}
