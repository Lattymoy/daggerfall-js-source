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
import { mountEnhancedChunk } from './enhancedChunk.js';   // MENU1: the one lazy-chunk door
import { createCharSheetWindow } from './charSheetDoor.js';   // ASCEND-ANYTIME: a level OWED is answered by the sheet key's own door
import { playerEntity } from '../characters/playerEntity.js';   // the shared entity the Stats page already reads (enhancedMenu's sheetModel)
import { usesVirtueLeveling } from '../systems/oblivionLeveling.js';   // ORL1: which bar the Ascension reads
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
 * MAC-L1: THE PAUSE DOOR'S OPTIONS, READ IN ONE PLACE.
 *
 * Mac's report, 2026-09-16 (dycaite): pressing Escape threw
 * `TypeError: can't access property "at", w is null` out of
 * `togglePause`, indoors and then outdoors, and took the session with
 * it. Two faults met:
 *
 *   1. THE FOUR HOSTS DID NOT AGREE ON THE SIGNATURE. Three declared
 *      `togglePause(opts = {})` and `scenes/dungeonContext.js` declared
 *      `togglePause(setPlayerPos = null, opts = {})`. `routeAction`'s
 *      Escape arm called `ctx.togglePause(setPlayerPos)` - so on three
 *      of the four the FIRST argument, meant to be the options, was
 *      whatever the key router had for a position applier.
 *   2. `opts = {}` DOES NOT DEFEND AGAINST `null`. A default parameter
 *      fires on `undefined` alone, and `routeAction`'s own default for
 *      `setPlayerPos` is `null`, so the hosts got a hard null and
 *      `opts.at` threw.
 *
 * So there is ONE shape now - an options object, `setPlayerPos` inside
 * it - and this is the one function that reads it. A positional pair
 * that three callers spell one way and one spells the other is not a
 * contract, it is a coin toss; and a door that THROWS is worse than a
 * door that does nothing, because the pause screen is how a player
 * saves.
 *
 * @param {{ at?: string|null, setPlayerPos?: ((p: any) => void)|null }|null|undefined} opts
 * @returns {{ at: string|null, setPlayerPos: ((p: any) => void)|null }}
 */
export function pauseOpts(opts) {
  // `?? {}` IS THE WHOLE LAW, and the mutation campaign is why it is the
  // only line here. A `(opts && typeof opts === 'object')` screen stood
  // beside it first, written to catch the old positional call handing a
  // FUNCTION over - and a mutant forcing it away changed no answer at
  // all, because reading `.at` off a function or a string is `undefined`
  // just as it is off `{}`. Only `null` and `undefined` throw, and `??`
  // is exactly the operator for those two. A dead guard reads like a
  // reason and is one more line the next reader has to disprove.
  const o = opts ?? {};
  return { at: o.at ?? null, setPlayerPos: o.setPlayerPos ?? null };
}

/**
 * F5-QUESTS (2026-09-26, Mac: "Cant see quest on f5 menu but can on tab menu"): THE PAUSE WINDOW'S HOOKS, for BOTH
 * doors that mount it - this one (Escape, the dial's Stats arm) and ui/charSheetDoor.js's F5 page, which IS this
 * window opened on Stats (PX27). F5's page was handed the sheet's four doors and nothing else, so on it the Quests
 * tab said "The journal is not wired into this place yet", Save and Load said there was no door, and Exit did
 * nothing. `base` is the host's own bag; `seamsOf` answers the enhanced menu module once it has landed.
 *
 * SLOTS1: the enhanced Save pane names a slot and the Load pane picks one; the verbs stay the two the pin reads,
 * and THESE arms route a picked name onto the host's saveAs and a picked key onto its loadKey - the hosts' own slot
 * seams (SAV4) - falling back to the quick verbs where a host hands none.
 */
export function pauseMenuHooks(base, seamsOf) {
  return {
    ...base,
    quickSave: () => { const n = seamsOf()?.takePickedSaveName?.() ?? null; return n && typeof base.saveAs === 'function' ? base.saveAs(n) : base.quickSave?.(); },
    quickLoad: () => { const k = seamsOf()?.takePickedSaveKey?.() ?? null; return k != null && typeof base.loadKey === 'function' ? base.loadKey(k) : base.quickLoad?.(); },
  };
}

/** F5-QUESTS: the menu's `onAction`, for both doors - the window down FIRST, then the act (U51's order: a save
 *  answers with a HUD line, and an opaque window left up would cover it). */
export function pauseMenuAct(hooks, close) {
  return (action) => {
    close();
    // DISC22-B: opened from the classic pause window, Resume goes back to that window - the settings were a page of
    // it, not the way out of it (save, load and exit still leave as they always do).
    if (action === 'resume' && typeof hooks.onResume === 'function') { hooks.onResume(); return; }
    // MAC1 (Mac, 2026-09-10: "opening menu returning to game requiring
    // player to press buttons twice"). This close runs INSIDE the Resume
    // click or the Escape keydown - the transient activation a
    // pointer-lock request needs - while the hosts' look gate relocked
    // on the NEXT frame, outside any gesture, which the browser refuses
    // (pointerLock.js's own header). So the first click after a resume
    // went to re-grabbing the pointer, and took SetClickDelay with it
    // (world.js's pointerdown, PlayerActivate.cs:1050-1054), and only
    // the second reached the world. The host's relock rides THIS
    // gesture; the exit has no world to relock into.
    if (action !== 'exit') hooks.relock?.();
    if (action === 'save') hooks.quickSave?.();
    else if (action === 'load') hooks.quickLoad?.();
    else if (action === 'exit') hooks.exitToMenu?.();
    // 'resume' is the close and nothing else.
  };
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
  return classicPauseWithSettings(show, hooks);
}

/** DISC22-B (2026-09-24, kurkku on Discord: "could replace the controls button here with the full settings menu"):
 *  THE CLASSIC PAUSE WINDOW'S CONTROLS BUTTON OPENS THE PORT'S WHOLE SETTINGS SCREEN. DFU's button opens its controls
 *  grid alone, and on the classic skin that grid was the only settings a player could reach from a game in progress -
 *  every other key (the video, the HUD, the gameplay rules, the mods' dials) lived behind the enhanced screen. That
 *  screen holds the controls too (FT16: Controls is a Settings category, the grid's every key and the port's own), so
 *  the button lands on its Settings page, and its Resume comes BACK to this window - DFU's controls window pops back
 *  to the pause window it was opened from (previousWindow), and a player who opened settings from a menu expects that
 *  menu under it. Without a document (a node host) the classic grid stands. */
function classicPauseWithSettings(show, hooks) {
  const again = () => classicPauseWithSettings(show, hooks);
  const openSettings = typeof document !== 'undefined'
    ? () => enhancedPauseOverlay(show, { ...hooks, at: 'settings', onResume: again })
    : null;
  return openClassicPauseFlow(show, { ...hooks, openSettings });
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
function enhancedPauseOverlay(show, base) {
  let fired = false;
  let view = null;
  let seams = null;   // the enhanced menu module, once it lands: its takePickedSaveKey / takePickedSaveName
  let ascendView = null;   // ASCEND-ANYTIME: the Ascension screen, while it has this window's place
  let ascendHost = null;
  // SLOTS1: a picked slot rides onto the host's saveAs / loadKey - pauseMenuHooks, the one home F5's page shares.
  const hooks = {
    ...pauseMenuHooks(base, () => seams),
    // ASCEND-ANYTIME: the Stats page draws its Ascend button only when a door hands this over, and F5's door
    // (ui/charSheetDoor.js) always did - this one never did, so the same page reached through Tab (the dial's
    // character arm) or Escape had no way in. A function declaration below: it is hoisted, so this line may name it.
    openAscend: () => openAscend(),
  };

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
    dropAscend();   // ASCEND-ANYTIME: whatever is on top of this window goes with it
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

  /** ASCEND-ANYTIME: take the Ascension screen down and leave this window as it was. Safe to call with none up. */
  function dropAscend() {
    try { ascendView?.destroy?.(); } catch { /* already gone */ }
    ascendView = null;
    ascendHost?.remove();
    ascendHost = null;
  }

  /**
   * ASCEND-ANYTIME: the Stats page's Ascend button, from the pause window (Tab's dial, or Escape).
   *
   * Two answers, the same two ui/charSheetDoor.js gives F5:
   *   - A level OWED is the real level-up, so this puts this window away (the way the Pack button does) and asks
   *     charSheetDoor for the sheet key's own answer, which IS the rollout while points are owed.
   *   - Nothing owed is a VIEW of the stars (levelUpView.viewOnlyScreen): the Ascension swaps in over this window
   *     and, when it closes, this window comes back on the Stats page. Through the ONE lazy-chunk door, so a chunk
   *     that will not load says so instead of doing nothing - and the pause window stays up behind that notice.
   */
  function openAscend() {
    if (fired || ascendHost || !playerEntity) return;
    if (playerEntity.readyToLevelUp) {
      act('resume');   // down first, then the level-up takes the slot it frees (the Pack button's own order)
      show(createCharSheetWindow({ entity: playerEntity }));
      return;
    }
    const h = document.createElement('div');
    h.id = 'enhanced-ascend-view';
    // 14: above this window's 13, the level-up overlay's own depth.
    h.style.cssText = 'position:fixed;inset:0;z-index:14;background:transparent;overflow:hidden';
    document.body.append(h);
    ascendHost = h;
    const drop = () => { if (ascendHost === h) dropAscend(); else h.remove(); };
    mountEnhancedChunk({
      load: () => import('./enhancedLevelUp.js'),
      alive: () => !fired && ascendHost === h,
      host: h, onDismiss: drop, label: 'ascend',
      mount: ({ mountEnhancedLevelUp, viewOnlyScreen }) => {
        // This window gives the keyboard up BEFORE the Ascension takes it: two capture handlers on one window
        // would answer Escape twice.
        try { view?.unmount(); } catch { /* already gone */ }
        view = null;
        ascendView = mountEnhancedLevelUp(h, {
          screen: viewOnlyScreen(playerEntity, usesVirtueLeveling(playerEntity)),
          entity: playerEntity,
          onExit: () => {
            dropAscend();
            if (!fired && seams) view = seams.mountEnhancedMenu(host, { mode: 'pause', hooks, onAction: act, at: 'stats' });
          },
        });
      },
    });
  }

  // THE FOUR EXITS. Every one of them takes the screen down FIRST and
  // then acts, which is classic's own order (pauseWindow.js:271, :307,
  // :198 - `_closeWith()` then the hook) and matters more here: the
  // port answers a save or a load with a HUD line, and this screen is
  // an opaque div over the entire canvas, so a hook fired underneath a
  // live door would put its own confirmation out of sight.
  const act = pauseMenuAct(hooks, close);   // F5-QUESTS: the one act law - F5's page shares it

  show(overlay);

  // Mounted lazily and asynchronously so the classic skin pays nothing
  // for a module it will never show. A failure to load costs the pause
  // menu, so it says so loudly and takes the empty div with it rather
  // than leaving the host holding an overlay that draws nothing and
  // never reports done - which would be a frozen game.
  // MENU1: the ONE lazy-chunk door (ui/enhancedChunk.js).
  mountEnhancedChunk({
    load: () => import('./enhancedMenu.js'),
    mount: (mod) => {
      const { mountEnhancedMenu } = mod;
      seams = mod;
      view = mountEnhancedMenu(host, { mode: 'pause', hooks, onAction: act, at: hooks.at ?? null });
    },
    alive: () => !fired, host, onDismiss: () => { host.remove(); fired = true; }, label: 'pause',
  });

  return overlay;
}
