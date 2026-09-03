// I3: THE PAUSE OPTIONS WINDOW - DaggerfallPauseOptionsWindow.cs (MIT,
// Daggerfall Workshop) on the real OPTN00I0.IMG. The Escape window:
// the in-game door to save/load/exit, the volume bars, and (I4) the
// controls grid. Until this slice the port had NO pause menu at all -
// the Ledger's "the launcher is the ONLY door" row.
//
// THE NATIVE-WINDOW RULE, element by element:
// - the panel is OPTN00I0.IMG at HorizontalAlignment.Center with
//   Position (0, 40) (:74-75) - alignment overrides position PER AXIS
//   (BaseScreenComponent :1217), so x centres and the declared y=40
//   applies. Size = the texture's own (:76).
// - the buttons are panel-child rects, verbatim (:86-140): exit
//   (101,4,45,16), save (4,4,45,16), load (52,4,46,16), continue
//   (76,60,70,17), controls (5,60,70,17), fullScreen (5,47,70,8),
//   headBobbing (76,47,70,8); the two toggle ticks sit at
//   (64,3.2,3.7,3.2) inside their buttons, in
//   DaggerfallUnityDefaultCheckboxToggleColor - Color32(146,12,4)
//   (DaggerfallUI.cs:70), the same dark red as the three bar fills.
// - the three bars are 109.1 wide (barMaxLength :28) at (6.15,23.20),
//   (6.15,30.85) and (6.15,39), each 5.5 tall with the fill inset
//   (0,1,value*109.1,3.5) (:107-124).
// - pausing itself costs nothing here: the hosts' overlay-hold law
//   (AUDIT 18 F9 - a held overlay stops the motor AND the clock) is
//   DFU's Time.timeScale = 0.
//
// What each control DOES, and which halves pend:
// - SAVE/LOAD ride the port's quicksave (the multi-slot
//   DaggerfallUnitySaveGameWindow pends its own slice - Ledger). DFU
//   gates save on IsSavingPrevented with "cannotSaveNow" (:296-303);
//   the hook defaults false and the gate is kept.
// - EXIT confirms on TEXT.RSC 1069 (:269-274) then posts
//   dfuiExitGame. In a browser Application.Quit means nothing; the
//   port's door out is the title menu - the same bare-URL unwind the
//   death sequence and chargen's cancel use (Ledger A).
// - the SOUND/MUSIC bars write Controls/SoundVolume / MusicVolume
//   with DFU's own click law (:230-262): x/109.1 rounded to 2 places,
//   snapped to 0 under 1% and to max over 99%. The sound bus re-reads
//   the setting on every sound (audio._out); music applies at the
//   songPlayer's next master touch.
// - the DETAIL bar is Video/QualityLevel over the six quality names
//   (:264-273, :221-224): value = round(lerp over x/width), width
//   back = lerp(0, 109.1, value/5). The port's renderer has no
//   quality ladder yet - the setting is stored-tier and writes.
// - FULL SCREEN toggles GUI/LargeHUD - DFU's quirk, kept: the button
//   labelled "FULL SCREEN" flips the large HUD (:315-325), and the
//   tick shows !LargeHUD. No large HUD exists in the port yet
//   (Ledger); the setting still writes.
// - HEAD BOBBING toggles Controls/HeadBobbing (:327-337) -
//   stored-tier until the HeadBobber motor lands.
// - CONTROLS pends I4 (the rebinding grid); the button says so in a
//   box rather than doing nothing.
// - the saveSettings LATCH (:73, :212-215): nothing persists until a
//   control was actually touched, then the whole store saves on close.
// - closing: CONTINUE (:276-280), or the same Escape that opened it
//   (:183-188 - DFU keys on GetKeyUp, and ROAD-E E1 built the key-up
//   route the port lacked, so `keyup` below is that edge. DFU's bare
//   GetKeyUp is safe only because GameManager.cs:515-518 OPENS the
//   window on ActionComplete - the release - so the opening release is
//   already spent; this port opens on the press, so the window arms on
//   the press it receives and closes on THAT press's release, which is
//   DaggerfallAutomapWindow.cs:703-713's deferral. The record that
//   stood here - "the port's overlay channel delivers keydowns, one
//   edge earlier" - is retired).
//
// FLAGGED: PauseOptionsDropdown (:83-84) - DFU's own quick-settings
// dropdown, a DFU-era addition riding its settings stack; the port's
// settings home is the launcher menu, and the dropdown pends with the
// settings arc. The version label draws the PORT's build tag (Ledger
// A: VersionInfo strings are DFU's identity, not this port's).

import { ControlsWindow, preloadControlsArt, controlsArtLoaded } from './controlsWindow.js';
import { SaveWindow } from './saveWindow.js';   // SAV4: the slot window rides the pause seam
import { loadImg, nativeMetrics, drawImg, drawRect, shadowText } from './nativePanel.js';
import { layoutMessageBox, drawMessageBox, messageBoxHit, MB_BUTTONS } from './messageBox.js';
import { drawMenuBackdrop } from './chargenArt.js';
import { measureText } from './text.js';
import { getFloat, effectiveSettings, setValue, saveSettings } from '../systems/settings.js';
import { ENUM_LAW } from './settingsLaw.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
import { BUILD_TAG } from '../buildTag.js';

/** barMaxLength (:28). */
export const BAR_MAX = 109.1;

/** optionsPanel.Position (:75) - y applies, x is centred away. */
export const PAUSE_PANEL_Y = 40;

/** #region the button rects (:86-140), panel-relative. */
export const PAUSE_RECTS = Object.freeze({
  save: [4, 4, 45, 16],
  load: [52, 4, 46, 16],
  exit: [101, 4, 45, 16],
  soundBar: [6.15, 23.20, BAR_MAX, 5.5],
  musicBar: [6.15, 30.85, BAR_MAX, 5.5],
  detailBar: [6.15, 39, BAR_MAX, 5.5],
  fullScreen: [5, 47, 70, 8],
  headBobbing: [76, 47, 70, 8],
  controls: [5, 60, 70, 17],
  continue: [76, 60, 70, 17],
});

/** The toggle tick, inside its button (:137, :141). */
export const TICK_RECT = Object.freeze([64, 3.2, 3.7, 3.2]);

/** DaggerfallUnityDefaultCheckboxToggleColor (DaggerfallUI.cs:70). */
export const TOGGLE_COLOR = Object.freeze([146 / 255, 12 / 255, 4 / 255, 1]);

/** The confirm-exit record (:27). */
export const ARE_YOU_SURE_ID = 1069;

/** SoundBar_OnMouseClick's value law (:230-241): the sub-1% and
 *  over-99% snaps, then two-place rounding of the fraction. */
export function barClickValue(x) {
  if (x / BAR_MAX > 0.99) x = BAR_MAX;
  else if (x / BAR_MAX < 0.01) x = 0;
  return Math.round((x / BAR_MAX) * 100) / 100;
}

/** GetDetailBarWidth (:221-224) + DetailButton_OnMouseClick's value
 *  pick (:266): both lerps over the quality-name count. */
export const QUALITY_COUNT = ENUM_LAW['Video/QualityLevel'].values.length;
export const detailBarWidth = (value) => (BAR_MAX * value) / (QUALITY_COUNT - 1);
export const detailClickValue = (x, w) => Math.round(((QUALITY_COUNT - 1) * x) / w);

// The three stored-tier controls (LargeHUD, HeadBobbing,
// QualityLevel) read through effectiveSettings - the settings MENU's
// own display surface - because the tier doctrine reserves the typed
// getters for LIVE keys ("read implies a consumer that changes
// play"). The window displays and writes them exactly as the menu
// does; the effect halves pend their own slices (Ledger).
const effBool = (sec, key) => effectiveSettings()[sec]?.[key] === 'True';
const effInt = (sec, key) => Number(effectiveSettings()[sec]?.[key] ?? 0);

let _img = null;
/** The art loads once, before the window can open (the U23 shape). */
export async function preloadPauseArt(deps) {
  _img ??= await loadImg(deps, 'OPTN00I0.IMG');
  return _img;
}
export const pauseArtLoaded = () => !!_img;

const panelX = () => Math.round((320 - (_img?.w ?? 150)) / 2);   // OPTN00I0 ships 150x84
const inRect = ([rx, ry, rw, rh], x, y) => x >= rx + panelX() && y >= ry + PAUSE_PANEL_Y
  && x < rx + panelX() + rw && y < ry + PAUSE_PANEL_Y + rh;

export class PauseOptionsWindow {
  /** hooks: { quickSave(), quickLoad(), exitToMenu(), textLines(id),
   *  savingPrevented?() } - each host hands its own. */
  constructor(hooks) {
    this.hooks = hooks;
    this.done = false;
    this.isChoiceWindow = true;   // raw codes through the overlay channel
    this.top = null;              // 'exit' | 'note' - the stacked box
    this._noteRows = null;
    this._box = null;             // laid out at draw (the U23 shape)
    // The automap windows' latch (automapWindow.js:560,
    // DaggerfallAutomapWindow.cs:703-713's `isCloseWindowDeferred`), and
    // this window needs it for the reason those two do: DFU opens the
    // pause screen on `ActionComplete(Actions.Escape)` -
    // GameManager.cs:515-518, and ActionComplete is the RELEASE edge
    // (InputManager.cs:634-637) - so its opening release is spent before
    // the window exists and :186's bare `GetKeyUp` is safe there. Every
    // host here opens on the key DOWN (world.js:4105, exterior.js:1462,
    // ui/input.js:297) and then routes that same key's release into the
    // window it just mounted, so the release door closes only a window
    // whose own press it saw.
    this.isCloseWindowDeferred = false;
  }

  _click() { audio.playOneShot(SOUND.ButtonClick, 1); }

  _closeWith() {
    if (this._saveSettings) saveSettings();   // OnPop (:212-215)
    this.done = true;
  }

  _confirmExit() {
    if (this._saveSettings) saveSettings();   // ConfirmExitBox (:254-257)
    this.done = true;
    this.hooks.exitToMenu?.();
  }

  input(code) {
    if (this.top === 'exit') {
      if (code === 'KeyY') { this._confirmExit(); return; }
      if (code === 'KeyN' || code === 'Escape') { this.top = null; }
      return;
    }
    if (this.top) { this.top = null; return; }   // any key clears a note
    // :703-708's arming edge - the press this window SAW, which the
    // press that opened it never is.
    if (code === 'Escape') this.isCloseWindowDeferred = true;
  }

  /** ROAD-E E1: THE TOGGLE CLOSE, on the edge DFU reads it from. :183-188
   *  is `if (GetKeyUp(toggleClosedBinding) || GetBackButtonUp())
   *  CloseWindow();` inside Update - a RELEASE. DFU can read it bare
   *  because GameManager.cs:515-518 opens the window on the release
   *  too; this port's hosts open on the press and hand the window that
   *  same press's release, so the door carries the automap windows'
   *  `isCloseWindowDeferred` and the Escape that OPENS this window
   *  still cannot close it. The port had no key-up route when this
   *  window was built and the site recorded the edge as "one edge
   *  earlier"; E1 built the route, so the record is now the law. A note
   *  or the exit box owns the keyboard while it stands, and they take
   *  the press, exactly as `input` above has them. */
  keyup(code) {
    if (this.top) return;
    if (code !== 'Escape') return;
    // :709's `&& isCloseWindowDeferred` - the press that opened this
    // window was consumed by the host and never reached here, so its
    // release finds nothing armed and closes nothing.
    if (!this.isCloseWindowDeferred) return;
    this.isCloseWindowDeferred = false;
    this._click();   // ContinueButton's sound, which this port's two close doors share
    this._closeWith();
  }

  click(vx, vy) {
    if (this.top === 'exit') {
      const hit = this._box ? messageBoxHit(this._box, vx, vy) : null;
      if (hit === MB_BUTTONS.Yes) this._confirmExit();
      else if (hit === MB_BUTTONS.No) this.top = null;
      return true;
    }
    if (this.top) { this.top = null; return true; }
    const R = PAUSE_RECTS;
    if (inRect(R.continue, vx, vy)) { this._click(); this._closeWith(); return true; }
    if (inRect(R.exit, vx, vy)) {
      this._click();
      this.top = 'exit';
      return true;
    }
    if (inRect(R.save, vx, vy)) {
      this._click();
      if (this.hooks.savingPrevented?.()) {
        this.top = 'note';
        this._noteRows = ['You cannot save now.'];   // cannotSaveNow (Internal_Strings, recovered)
      } else if (this.hooks.openSave) {
        // SAV4: DFU's SAVE GAME opens the slot window (:302), with
        // this window as its previous.
        // ROAD-C C1: `previous` means it is a PUSH - this window stays
        // open UNDER the save window and comes back when the save
        // window pops, so the U24 done-first dispatch is exactly wrong
        // here and only the replace fallback keeps it. The settings
        // latch stays armed with it: saveSettings is OnPop's (:212-215)
        // and a pushed-over window has not popped.
        if (!this.hooks.saveLoadPushes) this._closeWith();
        this.hooks.openSave();
      } else { this._closeWith(); this.hooks.quickSave?.(); }
      return true;
    }
    if (inRect(R.load, vx, vy)) {
      this._click();
      // SAV4: LOAD GAME opens the slot window too (:308); a host
      // without the loadKey seam keeps the one-press quickload. C1: a
      // push leaves this window standing, same as SAVE above.
      if (this.hooks.openLoad) {
        if (!this.hooks.saveLoadPushes) this._closeWith();
        this.hooks.openLoad();
      } else { this._closeWith(); this.hooks.quickLoad?.(); }
      return true;
    }
    const bx = vx - panelX(), by = vy - PAUSE_PANEL_Y;
    if (inRect(R.soundBar, vx, vy)) {
      this._click();
      setValue('Controls', 'SoundVolume', barClickValue(bx - R.soundBar[0]));
      this._saveSettings = true;
      return true;
    }
    if (inRect(R.musicBar, vx, vy)) {
      this._click();
      setValue('Controls', 'MusicVolume', barClickValue(bx - R.musicBar[0]));
      this._saveSettings = true;
      return true;
    }
    if (inRect(R.detailBar, vx, vy)) {
      this._click();
      setValue('Video', 'QualityLevel', detailClickValue(bx - R.detailBar[0], R.detailBar[2]));
      this._saveSettings = true;
      return true;
    }
    if (inRect(R.fullScreen, vx, vy)) {
      // DFU's quirk kept: "FULL SCREEN" flips the large HUD (:315-325)
      this._click();
      setValue('GUI', 'LargeHUD', effBool('GUI', 'LargeHUD') ? 'False' : 'True');
      this._saveSettings = true;
      return true;
    }
    if (inRect(R.headBobbing, vx, vy)) {
      this._click();
      setValue('Controls', 'HeadBobbing', effBool('Controls', 'HeadBobbing') ? 'False' : 'True');
      this._saveSettings = true;
      return true;
    }
    if (inRect(R.controls, vx, vy)) {
      this._click();
      // ControlsButton (:311-315): dispatch to the controls window.
      // The U24 dispatch law: mark done, then open - the host's slot
      // assignment replaces this window, never nulls the successor.
      if (this.hooks.openControls) {
        if (this._saveSettings) saveSettings();
        this.done = true;
        this.hooks.openControls();
      } else {
        this.top = 'note';
        this._noteRows = ['The controls window needs its art loaded.'];
      }
      return true;
    }
    void by;
    return true;   // an open window owns the pointer
  }

  draw(renderer, canvas, font) {
    if (!_img) { this.done = true; return; }
    const m = nativeMetrics(canvas);
    drawMenuBackdrop(renderer, canvas);   // ScreenDimColor (:71)
    const px = panelX();
    drawImg(renderer, _img, m, px, PAUSE_PANEL_Y);
    const R = PAUSE_RECTS;
    // the fills: (0,1,value*109.1,3.5) inside each bar (:107-124)
    const fill = (r, w) => {
      if (w > 0) drawRect(renderer, m, px + r[0], PAUSE_PANEL_Y + r[1] + 1, w, 3.5, TOGGLE_COLOR);
    };
    fill(R.soundBar, getFloat('Controls', 'SoundVolume', 0, 1) * BAR_MAX);
    fill(R.musicBar, getFloat('Controls', 'MusicVolume', 0, 1) * BAR_MAX);
    fill(R.detailBar, detailBarWidth(Math.min(QUALITY_COUNT - 1, Math.max(0, effInt('Video', 'QualityLevel')))));
    // the ticks (fullScreen shows !LargeHUD - :138)
    const tick = (r) => drawRect(renderer, m,
      px + r[0] + TICK_RECT[0], PAUSE_PANEL_Y + r[1] + TICK_RECT[1], TICK_RECT[2], TICK_RECT[3], TOGGLE_COLOR);
    if (!effBool('GUI', 'LargeHUD')) tick(R.fullScreen);
    if (effBool('Controls', 'HeadBobbing')) tick(R.headBobbing);
    // the version line, right-aligned at the top (:146-152) - the
    // PORT's identity, not DFU's VersionInfo strings (Ledger A)
    const ver = `project-dagger ${BUILD_TAG}`;
    shadowText(renderer, font, ver, m, 320 - 2 - measureText(font.fnt, ver), 2,
      { color: [0.75, 0.75, 0.75, 1] });
    // the stacked box (exit confirm / note), the U23 shape: laid out
    // here where the font lives, hit-tested from the stored layout
    if (this.top) {
      const got = this.top === 'exit' ? this.hooks.textLines?.(ARE_YOU_SURE_ID) : null;
      const rows = this.top === 'exit'
        ? (got?.length ? got : ['Are you sure you want to quit?'])   // townTalk.lines answers [] without data
        : this._noteRows;
      const buttons = this.top === 'exit' ? [MB_BUTTONS.Yes, MB_BUTTONS.No] : [];
      this._box = layoutMessageBox(font, rows, buttons);
      if (!drawMessageBox(renderer, m, font, this._box)) {
        (this._box.rows ?? []).forEach((r, i) =>
          shadowText(renderer, font, r.text, m, 20, 20 + i * this._box.rowH));
      }
    } else this._box = null;
  }
}

/** THE ONE CONSTRUCTION SEAM for the pause flow. Every host mounts
 *  the pause window through this, so the pause -> controls -> pause
 *  round trip is built once rather than four times: `show(win)` is
 *  the host's own slot assignment (townTalk.showOverlay, the interior
 *  slot, the dungeon's activeOverlay), and CONTINUE out of the
 *  controls grid re-enters the pause window exactly as DFU's window
 *  stack pops back to it (DaggerfallControlsWindow's previousWindow).
 *
 *  The U24 dispatch law applies at both ends: a window that opens
 *  another marks itself done FIRST and the host's slot assignment
 *  replaces it - never an onClose that nulls its own successor.
 *
 *  IT WAS `openPauseFlow` UNTIL U51, and the hosts still call that
 *  name - it now belongs to ui/pauseDoor.js, which picks between this
 *  flow and the enhanced screen and hands the four hosts one door.
 *  Renamed rather than shadowed: two modules exporting one name is the
 *  drift the audit24_onehome ratchet exists to catch, and the classic
 *  flow is what this module is. */
export function openClassicPauseFlow(show, hooks = {}) {
  // SAV4: the save/load doors mount the slot window in the SAME slot
  // the controls grid uses, so all four hosts get it through the one
  // seam. A host without the saveAs/loadKey seams keeps the old
  // one-press quicksave arms (the two overlay-less hosts' posture).
  //
  // ROAD-C C1: DFU does not REPLACE the pause window with the save
  // window - both buttons are `uiManager.PushWindow(... , this, ...)`
  // (DaggerfallPauseOptionsWindow.cs:302, :308), the pause window
  // riding underneath as `previous`, and the save window's Cancel is
  // `CloseWindow()` (:526) which pops back onto it. The port has that
  // depth now (ui/windowStack.js), so a host that hands over its push
  // door gets the real shape; the rebuild-on-back below is what a host
  // without one falls back to, and it is not the same thing - a
  // rebuilt pause window re-reads the settings store and loses
  // anything the open one was holding.
  const push = hooks.pushWindow ?? null;
  const mount = (win) => { if (push) push(win); else show(win); };
  // ROAD-S: ...and the OTHER half of that push. The slot window has
  // three exits, and only ONE of them is CloseWindow: Cancel (:526).
  // SaveGame (:422) and LoadGame (:428) both end in
  // `DaggerfallUI.Instance.PopToHUD()`, which is `while
  // (uiManager.TopWindow != dfHUD) uiManager.PopWindow();`
  // (DaggerfallUI.cs:829-836) - the WHOLE stack drains and play
  // resumes. C1 gave the slot window depth and left all three exits as
  // the single `done`, so a completed save or load popped back onto
  // THIS window with the motor and the clock still held and the player
  // had to dismiss the pause menu a second time.
  //
  // The hook below is the rest of that drain, and it is `_closeWith`
  // rather than a bare `done` on purpose: PopToHUD pops this window
  // too, so its OnPop settings latch (:212-215) fires on the way out
  // exactly as DFU's does. Each host's own `if (overlay?.done)
  // dropOverlay()` then takes both levels off its stack - one pop a
  // frame, which is the port's done-drain law at every other close on
  // these slots, applied one level deeper rather than four hosts
  // learning a second word for it.
  //
  // Null under the replace fallback: there the pause window closed
  // when the slot window opened, so `done` alone already lands on the
  // HUD and a second close would only re-run the latch.
  let win = null;
  const saveWindowHooks = (extra) => ({
    playerName: hooks.playerName,
    // Under a real push the pop uncovers the pause window itself, so
    // `done` is the whole of CloseWindow and onBack must NOT rebuild.
    onBack: push ? null : () => openClassicPauseFlow(show, hooks),
    popToHUD: push ? () => win?._closeWith() : null,
    ...extra,
  });
  win = new PauseOptionsWindow({
    ...hooks,
    saveLoadPushes: !!push,   // C1: does this host's door stack, or replace?
    openControls: controlsArtLoaded()
      ? () => show(new ControlsWindow({ onBack: () => openClassicPauseFlow(show, hooks) }))
      : null,
    openSave: hooks.saveAs
      ? () => mount(new SaveWindow('save', saveWindowHooks({ saveAs: hooks.saveAs })))
      : null,
    openLoad: hooks.loadKey
      ? () => mount(new SaveWindow('load', saveWindowHooks({ loadKey: hooks.loadKey })))
      : null,
  });
  show(win);
  return win;
}

/** Both panels warm together - the pause window's CONTROLS button is
 *  live only where the grid's art loaded. */
export async function preloadPauseFlowArt(deps) {
  await preloadPauseArt(deps);
  await preloadControlsArt(deps);
}
