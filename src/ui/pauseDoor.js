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
import { mountEnhancedChunk } from './enhanced/enhancedChunk.js';   // MENU1: the one lazy-chunk door
import { growthPageAt } from './growth/growthPages.js';   // GROWTH1: the Growth tab's pages, on either skin (a leaf: the tab is the menu chunk's)
import { revenantStarsOver } from './firmamentOver.js';   // RVN-STARS: a sworn one's stars, over Companions
import { levelUpScreenFor } from './charSheetDoor.js';   // GROWTH1: a level owed's rollout, drawn in the Growth tab (the view is the tab's own)
import { playerEntity } from '../characters/playerEntity.js';   // the shared entity the Stats page already reads (enhancedMenu's sheetModel)
import { profPagesShown, PROF_PAGE_SECTIONS } from './professions/profPages.js';   // CLASSIC-PAGES: the professions' two pages, on either skin
import { FAMILY_PAGE_SECTIONS, familyTabShown, familyProvider, noFamilyLine } from './familyPages.js';   // LEGACY3: Project Legacy's Family tab, on either skin; FAMILY-TAB: and only where the game is played with it
import { hudText } from '../systems/notify.js';
import { t } from '../systems/textManager.js';   // L10N4: the professions' closed line in the player's language
import { isTextEntryTarget } from './input.js';   // AUDIT PRIVATE-REPORT UI-10: a field's held key is the field's
import {
  openClassicPauseFlow as openClassicPauseWindow,
  pauseArtLoaded,
  preloadPauseFlowArt,
} from './pauseWindow.js';

// The hosts warm the classic art on both skins and always have. It is
// re-exported rather than re-decided here: a player can switch to
// classic from inside the pause screen's own settings pane, and the
// switch reloads (ui/enhanced/enhancedMenu.js's skinRow), so the art has to be
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
    // ESC-BOOK: a door that opens ANOTHER window hands the slot on - no relock under it, no return to a classic window.
    if (action === 'handoff') return;
    // DISC22-B: opened from the classic pause window, Resume goes back to that window - the settings were a page of
    // it, not the way out of it (save, load and exit still leave as they always do).
    if (action === 'resume' && typeof hooks.onResume === 'function') { hooks.onResume(); return; }
    // MAC1 (Mac, 2026-09-10: "opening menu returning to game requiring
    // player to press buttons twice"). This close runs INSIDE the Resume
    // click - the transient activation a pointer-lock request needs; an
    // Escape keydown is NOT one (ESC-LOCK, player/pointerLock.js: a tab
    // relocks on the next click or key, the desktop shell re-runs the
    // request as a gesture) - while the hosts' look gate relocked
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
/** CLASSIC-PAGES: what a door pressed for a professions page says when the pages are not this account's (offline, the
 *  professions' switch closed, the book not read yet). */
export const PROF_PAGES_CLOSED_LINE = 'Professions are online only. Your Professions and Stores pages open while you play online.';
/** L10N4: the line in the player's language (PROF_PAGES_CLOSED_LINE stays the English the pins read). */
export const profPagesClosedLine = () => t('pause.profPagesClosed', PROF_PAGES_CLOSED_LINE);
/** Whether a door's landing page is one of the professions' own (the Professions key's, a station's). */
export const profPageAt = (at) => PROF_PAGE_SECTIONS.some(([id]) => id === at);
/** LEGACY3: whether a door's landing is the Family tab or one of its pages. */
export const familyPageAt = (at) => at === 'family' || FAMILY_PAGE_SECTIONS.some(([id]) => id === at);

/**
 * PX26: `hooks.at` names the page the enhanced window opens ON -
 * 'quests', 'stats', 'holdings' or 'system' (or a page of one - PAUSE_TAB_IDS). The CLASSIC flow takes the same hooks
 * and ignores it, because the classic pause has no tabs to land on.
 *
 * CLASSIC-PAGES (2026-09-30, Mac: "Enhanced pages + key"): EXCEPT a
 * professions page ('professions', 'stores' - the Professions key, a
 * shop's or a home's station). The classic pause has no pages, so an
 * online classic player could neither read a rank nor withdraw a
 * gathered good; that door opens the enhanced pause on its page on
 * either skin, as DISC22-B's Controls button opens its Settings. With
 * no pages to show it says why and opens nothing.
 */
/** TUT1: the pause window this door last opened, while it stands - a tutorial page waits for it to go down
 *  (ui/tutorialPopup.js), rather than being pushed over the menu the player is reading. */
let _pauseShown = null;
export const pauseFlowShowing = () => !!_pauseShown && !_pauseShown.done;
/** AUDIT TUT1: every pause window this door raises is the one shown - the classic window's Controls detour to the
 *  enhanced Settings and its Resume back to a fresh classic window open theirs without passing openPauseFlow. */
const shown = (win) => { if (win) _pauseShown = win; return win; };
/** AUDIT TUT1: the classic window, kept wherever it is opened from - the door, and the fresh one the Settings detour's
 *  Resume opens again (classicPauseWithSettings's `again`). */
const openClassicPauseFlow = (show, hooks) => shown(openClassicPauseWindow(show, hooks));

export function openPauseFlow(show, hooks = {}) {
  return shown(openPauseFlowNow(show, hooks));
}

function openPauseFlowNow(show, hooks) {
  if (profPageAt(hooks.at)) {
    if (!profPagesShown()) { hudText(profPagesClosedLine()); return null; }
    if (typeof document !== 'undefined') return enhancedPauseOverlay(show, hooks);
  }
  // LEGACY3: Project Legacy's Family tab (its key, the death's Succession) - the classic pause has no tabs, so the family's
  // pages open the enhanced pause on either skin, as the professions' do
  if (familyPageAt(hooks.at)) {
    // FAMILY-TAB (2026-10-06): a game played without Project Legacy has no Family tab - the key says why (the pages' own
    // words) and opens nothing, as a professions door with no pages does
    if (!familyTabShown()) { hudText(noFamilyLine(familyProvider())); return null; }
    if (typeof document !== 'undefined') return enhancedPauseOverlay(show, hooks);
  }
  // SERVER-POST: the mailbox (`/mail`, ui/enhanced/enhancedPost.js) is the enhanced face's - the classic pause window has no envelope - so
  // its door opens the enhanced pause on either skin, as the family's pages do
  if ((hooks.at === 'mailbox' || hooks.at === 'report' || hooks.at === 'season') && typeof document !== 'undefined') return enhancedPauseOverlay(show, hooks);   // PRIVATE-REPORT: `/bug`, its form; SEASON-BOOK: `/season`, the laurel's window
  // GROWTH4: the Growth tab (the classic sheet's specialisation rows, a door to the level or the skies) - the classic pause
  // has no tabs, so its pages open the enhanced pause on either skin, as the family's do (the owner, asked: the classic skin
  // reaches it)
  if (growthPageAt(hooks.at) && typeof document !== 'undefined') return enhancedPauseOverlay(show, hooks);
  // AUDIT QUESTLINES UI-6 (REWARD-8): the Quests tab - a reward waiting is chosen there (ui/questlines/qlJournal.js), and the
  // classic pause has no tabs - so a door that names it opens the enhanced pause on either skin, as the family's pages do
  if (hooks.at === 'quests' && typeof document !== 'undefined') return enhancedPauseOverlay(show, hooks);
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
    ? () => shown(enhancedPauseOverlay(show, { ...hooks, at: 'settings', onResume: again }))   // AUDIT TUT1: the detour is a pause window too
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
  // SLOTS1: a picked slot rides onto the host's saveAs / loadKey - pauseMenuHooks, the one home F5's page shares.
  const hooks = {
    ...pauseMenuHooks(base, () => seams),
    // GROWTH1 (was ASCEND-ANYTIME's Ascend door, and FIRM1's sky swapped in over this window): the Growth tab draws the
    // Ascension and the Firmament in its own pane (ui/growth/growthStage.js) - this door hands it the screen to draw, a
    // level owed or the view of the stars, off the shared entity the Stats page reads
    ascendScreen: () => (playerEntity ? levelUpScreenFor(playerEntity) : null),
    // RVN-STARS: the Companions page's Stars - a sworn one's sky over this window, the window back on Companions (the
    // owner: "Keep it on the companion page")
    get openRevenantStars() { return rvnStars.hook; },
  };
  const rvnStars = revenantStarsOver({
    alive: () => !fired,
    below: () => { try { view?.unmount(); } catch { /* already gone */ } view = null; },
    back: () => { if (!fired && seams) view = seams.mountEnhancedMenu(host, { mode: 'pause', hooks, onAction: act, at: 'companions' }); },
  });
  const host = document.createElement('div');
  host.id = 'enhanced-pause';
  host.setAttribute?.('data-dom-focus', '');   // AUDIT LEGACY II U3: Tab walks its controls (ui/input.js isDomFocusWalk)
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
  // AUDIT LEGACY III U1: A HELD KEY PRESSES NOTHING HERE EITHER - the Succession's own rule (ui/legacy/legacySuccession.js,
  // AUDIT LEGACY II U1). The browser presses a focused button at every repeat of Enter or Space, and the Family tab's
  // arm-then-confirm acts keep the focus on the armed button (AUDIT LEGACY II U6): "Play as" and "Pass the mantle"
  // armed and fired on one held press. Every other ask-twice act of this window is covered by the same line.
  host.addEventListener?.('keydown', (e) => {
    // PRIVATE-REPORT (AUDIT PRIVATE-REPORT UI-10): never in a field - a held Space or Enter types, as every other key does
    if (e.repeat && (e.key === 'Enter' || e.key === ' ') && !isTextEntryTarget(e.target)) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  // AUDIT LEGACY III U2: THE KEYBOARD COMES INTO THE WINDOW. Opened, the focus stood on the page's body, where every Tab
  // was the game's (AUDIT LEGACY II U3's walk asks the focus to be inside already): a Tab from outside lands on the
  // window's first control (its last, back), and the window takes the focus as it mounts (focusIn, below).
  const tabIn = (/** @type {KeyboardEvent} */ e) => {
    if (fired) { document.removeEventListener?.('keydown', tabIn, true); return; }   // the window went (close, or a load that failed): gone with it
    if (e.key !== 'Tab' || host.contains?.(/** @type {any} */ (document.activeElement))) return;
    // AUDIT SERVER-POST: never into what is out of reach - a window over the face makes the face inert, and a focus() on an
    // inert button fails silently, the Tab already cancelled: the press went nowhere (the mailbox's and the timers' windows)
    const all = [...(host.querySelectorAll?.('button:not([disabled]), [href], select, input, [tabindex]:not([tabindex="-1"])') ?? [])].filter((n) => !n.closest?.('[inert]'));
    const to = e.shiftKey ? all.at(-1) : all[0];
    if (!to) return;
    e.preventDefault();
    /** @type {any} */ (to).focus?.({ preventScroll: true });
  };
  document.addEventListener?.('keydown', tabIn, true);
  /** The window's own place for the keyboard: its lit tab, else its first control. */
  const focusIn = () => {
    const to = host.querySelector?.('.px-tabs button.on') ?? host.querySelector?.('button:not([disabled])');
    /** @type {any} */ (to)?.focus?.({ preventScroll: true });
  };

  const close = () => {
    if (fired) return;
    rvnStars.drop();   // RVN-STARS: a sworn one's stars go with this window
    document.removeEventListener?.('keydown', tabIn, true);
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
  // then acts, which is classic's own order (pauseWindow.js:"if (inRect(R.continue, vx, vy))".."this._closeWith();", pauseWindow.js:"window, so it relocks".."this._closeWith();",
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
  // MENU1: the ONE lazy-chunk door (ui/enhanced/enhancedChunk.js).
  mountEnhancedChunk({
    load: () => import('./enhanced/enhancedMenu.js'),
    mount: (mod) => {
      const { mountEnhancedMenu } = mod;
      seams = mod;
      view = mountEnhancedMenu(host, { mode: 'pause', hooks, onAction: act, at: hooks.at ?? null });
      focusIn();   // AUDIT LEGACY III U2
    },
    alive: () => !fired, host, onDismiss: () => { host.remove(); fired = true; }, label: 'pause',
  });

  return overlay;
}
