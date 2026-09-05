// SAV4: THE SAVE/LOAD WINDOW - DaggerfallUnitySaveGameWindow.cs
// verbatim geometry and behaviors (MIT, Daggerfall Workshop) over the
// slot store (systems/saveSlots.js). This is a DFU-STYLE window - its
// look is colored panels, not classic art - so every rect and color
// below is the C#'s own literal (:34-270).
//
//   main panel   280x170, centered        (:34, :111-113)
//   prompt       (4,4)                    (:120)
//   name panel   (4,12) 272x9, box max 26 (:125-133)
//   saves panel  (4,25) 100x141           (:139-140)
//   saves list   (2,2) 91x129, 16 rows    (:145-150)
//   scroller     (94,2) 5x129             (:157-159)
//   go button    (108,150) 40x16          (:164-165)
//   classic      (172,150) 40x16          (:173-174)
//   cancel       (236,150) 40x16          (:185-186)
//   screenshot   (108,25) 168x95          (:195-196)
//   info panel   (108,122) 168x26         (:204-205)
//   version      (1,1) in screenshot      (:210)
//   folder       right-aligned (0,1)      (:216-217)
//   save time    centered row 0           (:227-228)
//   game time    centered row 9           (:231-232)
//   rename       (2,132) 48x8             (:236-237)
//   delete       (51,132) 48x8            (:254-255)
//   switch char  (216,2) 60x8             (:264-265)
//
// Behaviors kept verbatim: the (character, save name) identity drives
// everything; save mode confirms an OVERWRITE with Yes/No and refuses
// an empty name; load mode's name box is read-only and the top save
// autoselects; the list orders by realTime DESCENDING; typing a name
// that matches a row selects it, a non-match deselects; rename opens
// an input box prefilled (the 31-char TextBox default, the F171 law)
// and writes only a changed name; delete confirms with Delete/Cancel;
// Return is the go key (:311-312); switch-character lists names
// ALPHABETICALLY and re-keys the window; LoadGame with NO saves at all
// prompts for a classic save (:328-332), and the CLASSIC button (load
// mode only, :437/:446) opens the classic list - which closes the SAV3
// residue: the classic window is reachable WITH saves present.
//
// ── ROAD-C C1, the second pass over the same C# ────────────────────
// SAV4 landed the window; C1 walked DaggerfallUnitySaveGameWindow.cs
// line by line against it and closed what the first pass left:
//
//  1. THE LOADING DEFER (:48, :246-251, :313-315, :516-520). LoadGame
//     is NOT called from the Load button. The button raises
//     `loading` and `loadingCountdown = 2`, and Update() spends the
//     countdown so the label can DRAW - DFU's own comment, "Allow
//     loading text to draw before loading". The port's `update()` is
//     that Update(), called at the top of `draw()` (the same order
//     Unity runs them in) so every host that draws the window ticks
//     it without new plumbing.
//  2. THE STRINGS, from Internal_Strings.csv verbatim: the prompt
//     format is `{0} for '{1}'` (:1580) - QUOTED - noSavesFound is
//     "No saves found. Load a Classic save?" (:934), confirmDelete is
//     "Are you sure you want to delete save?" (:930), the switch
//     button says "Switch Char" (:923) and the loading label says
//     "Please wait..." (:918).
//  3. UpdateSelectedSaveInfo's CLEAR arm (:374-385): an empty name
//     box OR no list selection blanks the screenshot, both time
//     labels, the version and folder lines, and drops rename/delete
//     back to namePanelBackgroundColor. SAV4 keyed all of it on "the
//     name resolves to a slot", which drew a live info panel for a
//     deselected window.
//  4. renameSaveButton goes GREEN with a selection (:415) -
//     saveButtonBackgroundColor, the same promotion delete already
//     had to cancelButtonBackgroundColor (:416).
//  5. THE OUTLINES. Panel's constructor sets `outline.Enabled = false`
//     (Panel.cs:91), so an outline exists only where the C# turns it
//     on: mainPanel/namePanel/savesPanel/screenshotPanel and the
//     go/classic/cancel buttons. rename and delete say
//     `Outline.Enabled = false` OUTRIGHT (:241, :259) and switchChar
//     never asks - all three drew a box they should not have.
//  6. Enabled=false is NOT DRAWN. SetMode disables switchChar and
//     switchClassic in save mode (:436-437) and switchChar again when
//     CharacterCount is 0 (:449-452); SAV4 drew both dimmed instead.
//
// ── ROAD-S CLOSEOUT, the third pass ───────────────────────────────
// The audit walked the same C# once more against what C1 landed:
//
//  1. POPTOHUD IS NOT ONE POP. SaveGame() (:422) and LoadGame() (:428)
//     both end in `DaggerfallUI.Instance.PopToHUD()`, which is
//     `while (uiManager.TopWindow != dfHUD) uiManager.PopWindow();`
//     (DaggerfallUI.cs:829-836) - the WHOLE stack drains and the game
//     resumes. Only Cancel is a single CloseWindow (:526). C1 made the
//     pause door a real PUSH, so `done` alone became exactly that one
//     pop and a completed save or load handed the player back the
//     PAUSE window with the motor and the clock still held. The
//     `popToHUD` hook below is the rest of the drain; the pause flow
//     hands it over wherever it pushed (ui/pauseWindow.js).
//  2. THE NAME BOX DRAWS ITS DefaultText IN BOTH MODES. SetMode gives
//     save mode "enterSaveName" (:435) as load mode gets
//     "selectSaveName" (:443), and TextBox.Draw's default-text branch
//     (TextBox.cs:253-260) is gated on `text.Length == 0` ALONE, never
//     on ReadOnly - the cursor is a separate child (:30, :236-239), so
//     an empty save box draws the prompt AND the caret over it. The
//     port computed the save arm and then drew a lone underscore.
//  3. THE LIST HAS NO SELECTION BAR. ListBox.Draw (ListBox.cs:301-330)
//     draws row labels and nothing else, and DecideTextColor (:360-372)
//     hands the selected row `selectedTextColor` - ListBox.cs:43's
//     DaggerfallDefaultSelectedTextColor, Color32(162,36,12)
//     (DaggerfallUI.cs:62), which this window never overrides. The
//     port painted a grey bar and white text.
//  4. FOUR LABELS CARRY NO SHADOW. Setup zeroes ShadowPosition on
//     promptLabel (:119), savesList (:149), saveTimeLabel (:226) and
//     gameTimeLabel (:230), and a zero position skips the shadow pass
//     outright (TextLabel.cs:354-355, :361-362). The rows' selected
//     arm is zero too (ListBox.cs:41). The version/folder labels
//     (:209, :215) and every button label keep theirs.
//  5. FindIndex IGNORES CASE. SaveNameTextBox_OnType (:539-551) resolves
//     the typed text through savesList.FindIndex, which compares
//     InvariantCultureIgnoreCase (ListBox.cs:822-833), and the hit goes
//     through SelectedIndex -> SavesList_OnSelectItem (:554-556), which
//     puts the row's STORED casing back in the box.
//
// Recorded departures: no mod-conflict prompt (the port has no mods,
// so PromptLoadGame's message box - SaveLoadManager.cs:489-513 -
// cannot fire and its callback is taken directly); the folder label
// opens no OS folder (no OS); the screenshot panel draws the stored
// capture when the slot has one and stays the bare panel otherwise,
// exactly as GetSaveScreenshot -> null does; a hook the host did not
// hand over DIMS its door rather than hiding it (the pause window's
// posture, and the one place a disabled-looking button is the port's
// own idea rather than SetMode's).
//
// REMAINDER, precise: the CLASSIC button is live from the start menu
// (scenes/menu.js) and dark in the pause flow. DFU pushes the classic
// list in place and StartLoadSavedGame rebuilds the world under it;
// the port's classic import is a BOOT arm (main.js' ?classicload and
// menu.js' setPendingClassicSave), so an in-game press has to unwind
// the whole run to the title flow the way exitToTitleMenu does. That
// is a destructive, never-once-rendered path, and Incident 2026-09-01
// lesson 2 puts it in front of the owner's eyes before it ships
// rather than behind a green button in this commit.
//
// hooks: {
//   playerName()            - the current character (PlayerEntity.Name)
//   saveAs(saveName)        - the HOST composes its envelope and saves
//   loadKey(key)            - the HOST restores the slot
//   onSwitchClassic()       - mounts the classic list (menu-side owns it)
//   onBack()                - re-open whatever pushed this (pause seam)
//   popToHUD()              - PopToHUD (:422/:428): the go paths drain
//                             the WHOLE stack, so whatever this window
//                             was PUSHED over closes with it. Absent
//                             where the door replaced rather than
//                             pushed - there is nothing left under it.
// } - absent hooks dim their doors, the pause window's own posture.

import { nativeMetrics, drawRect, shadowText, pointToNative } from './nativePanel.js';
import { measureText } from './text.js';
// DaggerfallUI.cs:62's DaggerfallDefaultSelectedTextColor, which
// ListBox hands every selected row (ListBox.cs:43) - one home for the
// literal, the picker window's.
import { SELECTED_TEXT_COLOR } from './listPicker.js';
import { layoutMessageBox, drawMessageBox, messageBoxHit, MB_BUTTONS } from './messageBox.js';
import { typedChar } from './input.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
import { dateFromClassicMinutes, midDateTimeString } from '../systems/gameDate.js';
import {
  enumerateSaves, findSave, findMostRecentSave, saveInfoOf, screenshotOf,
  deleteSave, renameSave, characterNames,
} from '../systems/saveSlots.js';

/** The window rects, panel-relative [x, y, w, h] (:34-270). The main
 *  panel centers in the 320x200 native space. */
export const MAIN_PANEL = Object.freeze([20, 15, 280, 170]);
export const SW_RECTS = Object.freeze({
  namePanel: Object.freeze([4, 12, 272, 9]),
  savesPanel: Object.freeze([4, 25, 100, 141]),
  savesList: Object.freeze([6, 27, 91, 129]),      // savesPanel + (2,2)
  scroller: Object.freeze([98, 27, 5, 129]),       // savesPanel + (94,2)
  go: Object.freeze([108, 150, 40, 16]),
  switchClassic: Object.freeze([172, 150, 40, 16]),
  cancel: Object.freeze([236, 150, 40, 16]),
  screenshot: Object.freeze([108, 25, 168, 95]),
  infoPanel: Object.freeze([108, 122, 168, 26]),
  rename: Object.freeze([6, 157, 48, 8]),          // savesPanel + (2,132)
  del: Object.freeze([55, 157, 48, 8]),            // savesPanel + (51,132)
  switchChar: Object.freeze([216, 2, 60, 8]),
});
export const SW_LIST_ROWS = 16;                        // RowsDisplayed (:150)
export const NAME_MAX_CHARS = 26;                   // saveNameTextBox (:133)
export const RENAME_MAX_CHARS = 31;                 // the TextBox default (F171's law)

// The C# colors (:56-62), as [r,g,b,a] 0..1.
export const SW_COLORS = Object.freeze({
  main: Object.freeze([0, 0, 0, 1]),
  namePanel: Object.freeze([0.2, 0.2, 0.2, 1]),
  save: Object.freeze([0, 0.5, 0, 0.4]),
  cancel: Object.freeze([0.7, 0, 0, 0.4]),
  list: Object.freeze([0.1, 0.1, 0.1, 0.4]),
  listText: Object.freeze([0.8, 0.8, 0.8, 1]),
  folder: Object.freeze([0.7, 0.7, 0.7, 0.5]),
  classic: Object.freeze([0.2, 0.2, 0, 1]),
});

/** The window's localized strings, from
 *  StreamingAssets/Text/Master Localization CSV Files/
 *  Internal_Strings.csv - the keys TextManager is asked for, with the
 *  English values verbatim (the port has one language). */
export const SW_TEXT = Object.freeze({
  savePrompt: 'Save Game',                                     // :924
  loadPrompt: 'Load Game',                                     // :925
  saveLoadPromptFormat: "{0} for '{1}'",                       // :1580
  noSavesFound: 'No saves found. Load a Classic save?',        // :934
  enterSaveName: 'Enter save name',                            // :928
  selectSaveName: 'Select a save',                             // :929
  saveButton: 'Save',                                          // :926
  loadButton: 'Load',                                          // :927
  classicSave: 'Classic',                                      // :919
  cancel: 'Cancel',
  renameSave: 'Rename',                                        // :921
  deleteSave: 'Delete',                                        // :922
  switchChar: 'Switch Char',                                   // :923
  loading: 'Please wait...',                                   // :918
  confirmOverwriteSave: 'Overwrite this save?',                // :931
  confirmDeleteSave: 'Are you sure you want to delete save?',  // :930
  youMustEnterASaveName: 'You must enter a save name.',        // :932
  youMustSelectASaveName: 'You must select a save name.',      // :933
});

/** saveLoadPromptFormat's two slots (:369). */
export const saveLoadPrompt = (promptText, characterName) =>
  SW_TEXT.saveLoadPromptFormat.replace('{0}', promptText).replace('{1}', characterName);

/** loadingCountdown's initial value (:69). */
export const LOADING_FRAMES = 2;

const ROW_H = 8;   // ListBox default row pitch at 16 rows in 129px

const inRect = ([x, y, w, h], vx, vy) => vx >= x && vy >= y && vx < x + w && vy < y + h;

export class SaveWindow {
  /** @param {'save'|'load'} mode
   *  @param {object} hooks - see the header.
   *  @param {{displayMostRecentChar?: boolean}} [opts] - the start
   *    window's Load passes true (:89 -> :337-341). */
  constructor(mode, hooks = {}, { displayMostRecentChar = false } = {}) {
    this.mode = mode;
    this.hooks = hooks;
    this.done = false;
    this.isChoiceWindow = true;         // raw codes through the overlay channel
    this.displayMostRecentChar = displayMostRecentChar;
    this.currentPlayerName = hooks.playerName?.() ?? '';
    this.nameText = '';
    this.selectedIndex = -1;
    this.scrollIndex = 0;
    this.rows = [];                     // [{ key, saveName, info }]
    this.noSaves = false;
    this.characterCount = 0;            // SaveLoadManager.CharacterCount (:449)
    // The :313-315 defer. `loading` raises the label; the countdown
    // spends the frames that let it draw.
    this.loading = false;
    this.loadingCountdown = LOADING_FRAMES;
    this._loadingKey = -1;
    this.top = null;                    // 'overwrite'|'delete'|'note'|'rename'|'charPicker'
    this._noteRows = null;
    this._box = null;
    this.renameText = '';
    this._charRows = [];
    this._lastClick = { t: 0, index: -1 };
    this._shot = null;                  // SS1: the selected slot's decoded screenshot
    this._renderer = null;              // latched at draw so dispose can release
    this.refresh();
    // "Autoselect save at top of list" in load mode (:291-292).
    if (this.mode === 'load' && this.rows.length > 0) this._select(0);
  }

  _click() { audio.playOneShot(SOUND.ButtonClick, 1); }

  /** OnPush + UpdateSavesList: enumerate fresh, honor
   *  displayMostRecentChar, order the character's saves by realTime
   *  DESCENDING. */
  refresh() {
    const { info, characterSaves } = enumerateSaves();
    const mostRecent = findMostRecentSave();
    this.characterCount = characterSaves.size;   // CharacterCount, the :449 gate
    this.noSaves = this.mode === 'load' && mostRecent === -1;
    if (this.mode === 'load' && mostRecent !== -1 && this.displayMostRecentChar) {
      this.currentPlayerName = info.get(mostRecent)?.characterName ?? this.currentPlayerName;
    }
    this.rows = [...info.entries()]
      .filter(([, i]) => i.characterName === this.currentPlayerName)
      .sort((a, b) => (b[1].dateAndTime?.realTime ?? 0) - (a[1].dateAndTime?.realTime ?? 0))
      .map(([key, i]) => ({ key, saveName: i.saveName, info: i }));
    if (this.scrollIndex > Math.max(0, this.rows.length - SW_LIST_ROWS)) this.scrollIndex = 0;
  }

  /** SavesList_OnSelectItem: the row's name lands in the box. */
  _select(index) {
    this.selectedIndex = index;
    this.nameText = this.rows[index]?.saveName ?? this.nameText;
  }

  /** The selected slot's key through the (character, name) identity -
   *  the window never trusts the row index alone, exactly as the C#
   *  re-finds by names at every action. */
  _selectedKey() {
    return findSave(this.currentPlayerName, this.nameText);
  }

  /** SaveLoadEventHandler - the go path for both modes (:480-522). */
  _go() {
    if (this.loading) return;            // the defer owns the window now
    if (this.mode === 'save') {
      if (this.nameText.length === 0) {
        this.top = 'note';
        this._noteRows = [SW_TEXT.youMustEnterASaveName];
        return;
      }
      if (this._selectedKey() !== -1) { this.top = 'overwrite'; return; }
      this._saveGame();
    } else {
      if (this.nameText.length === 0) {
        this.top = 'note';
        this._noteRows = [SW_TEXT.youMustSelectASaveName];
        return;
      }
      const key = this._selectedKey();
      if (key === -1) return;
      // PromptLoadGame's callback (:516-520). DFU's mod-conflict box
      // cannot fire here (recorded in the header), so the callback is
      // taken straight: the label goes up and the LOAD WAITS.
      this._loadingKey = key;
      this.loading = true;
      this.loadingCountdown = LOADING_FRAMES;
    }
  }

  /** Update() (:307-315). Called at the top of `draw()` so a host that
   *  only draws still spends the countdown, in Unity's own order
   *  (Update before Draw). The Return key half lives in `input()` -
   *  the port's overlay channel delivers keys as events, not as a
   *  per-frame GetKeyDown poll. */
  update() {
    if (this.loading && --this.loadingCountdown === 0) this._loadGame();
  }

  /** LoadGame() (:425-429): the restore, then PopToHUD. */
  _loadGame() {
    this.loading = false;
    this.done = true;
    this.hooks.loadKey?.(this._loadingKey);
    this.hooks.popToHUD?.();             // PopToHUD (:428), AFTER the load
  }

  _saveGame() {
    const ok = this.hooks.saveAs?.(this.nameText);
    this.done = true;                    // SaveGame() -> PopToHUD (:422)
    this.hooks.popToHUD?.();
    if (ok === false) this.hooks.onSaveFailed?.();
  }

  /** UpdateSelectedSaveInfo's gate (:375): an empty box or no list
   *  selection clears the screenshot, both time labels, the version
   *  and folder lines, and drops rename/delete to the plain colour.
   *  One predicate because the C# clears all of it in one branch. */
  _infoShown() { return this.nameText.length > 0 && this.selectedIndex >= 0; }

  /** The overlay channel's raw keys: typing the name box (save mode -
   *  load's box is READ-ONLY, :444), Return = go (:311-312), Escape =
   *  cancel. */
  input(code, e = null) {
    if (this.top === 'rename') {
      if (code === 'Enter' || code === 'NumpadEnter') { this._renameCommit(); return true; }
      if (code === 'Escape') { this.top = null; return true; }
      if (code === 'Backspace') { this.renameText = this.renameText.slice(0, -1); return true; }
      const ch = typedChar(code, e);
      if (ch && this.renameText.length < RENAME_MAX_CHARS) this.renameText += ch;
      return true;
    }
    if (this.top) {
      if (code === 'Escape') this.top = null;
      return true;
    }
    if (code === 'Enter' || code === 'NumpadEnter') { this._go(); return true; }
    if (code === 'Escape') { this._cancel(); return true; }
    if (this.mode === 'save') {
      if (code === 'Backspace') { this._onType(this.nameText.slice(0, -1)); return true; }
      const ch = typedChar(code, e);
      if (ch && this.nameText.length < NAME_MAX_CHARS) this._onType(this.nameText + ch);
      return true;
    }
    return true;
  }

  /** ListBox.MouseScrollUp/MouseScrollDown (ListBox.cs:513-525) ->
   *  ScrollUp/ScrollDown (:791-812): ONE ROW per notch in the
   *  EntryWise default mode, clamped at 0 and at
   *  `listItems.Count - rowsDisplayed`. SavesList_OnScroll (:534-537)
   *  carries the index to the scroller, which the port draws off that
   *  same index rather than a second field.
   *
   *  RECORDED (structural): DFU routes the wheel to the component under
   *  the pointer; the port's host channel delivers a bare sign
   *  (townTalk.js:898, worldModes.js:5778, dungeonContext's
   *  overlayWheel), so the window forwards it to its one scrolling
   *  list. There is nothing else on this window a wheel could mean. */
  wheel(dir) {
    if (this.top) return true;          // a stacked box is the top window, not this one
    const maxScroll = Math.max(0, this.rows.length - SW_LIST_ROWS);
    this.scrollIndex = Math.max(0, Math.min(maxScroll, this.scrollIndex + Math.sign(dir)));
    return true;
  }

  /** SaveNameTextBox_OnType: a typed name that matches a row selects
   *  it; a non-match deselects (:539-551).
   *
   *  The match is savesList.FindIndex, and ListBox.cs:822-833 compares
   *  `StringComparison.InvariantCultureIgnoreCase` - so "old" finds the
   *  save called "Old". The hit is then `savesList.SelectedIndex =
   *  index`, whose setter raises OnSelectItem (:554-556) and puts the
   *  row's OWN text back in the box, which is why the port routes it
   *  through `_select`: the stored casing is what every later
   *  (character, name) lookup has to be given. The MISS arm is
   *  SelectNone + UpdateSelectedSaveInfo (:547-548). */
  _onType(text) {
    this.nameText = text;
    const index = this.rows.findIndex(
      (r) => r.saveName.localeCompare(text, undefined, { sensitivity: 'accent' }) === 0);
    if (index !== -1) this._select(index);
    else this.selectedIndex = -1;
  }

  _cancel() {
    this.done = true;
    this.hooks.onBack?.();
  }

  _renameCommit() {
    // RenameSaveButton_OnGotUserInput: empty input is a no-op (:575).
    if (this.renameText.length === 0) { this.top = null; return; }
    const key = this._selectedKey();
    if (key !== -1 && renameSave(key, this.renameText)) {
      this.nameText = this.renameText;
      this.refresh();
      this._select(this.rows.findIndex((r) => r.key === key));
    }
    this.top = null;
  }

  /** The stacked box's hit table (a method so the headless suite can
   *  drive the confirm arms without a laid-out box). */
  _boxHit(vx, vy) {
    return this._box ? messageBoxHit(this._box, vx, vy) : null;
  }

  /** SS1: GetSaveScreenshot -> the panel texture (:255-268 + :195-201).
   *  The stored data URL decodes through an Image, asynchronously -
   *  until it lands the panel stays bare, which is GetSaveScreenshot
   *  -> null's own look. Cached for the SELECTED slot only and
   *  RELEASED on change (every allocation has an owner); an overwrite
   *  changes the URL under the same key and re-decodes. Headless (no
   *  Image/document) always answers null. */
  _shotTexture(renderer, key) {
    this._renderer = renderer;
    const url = screenshotOf(key);
    if (!url) { this._dropShot(); return null; }
    if (this._shot?.key === key && this._shot.url === url) return this._shot.tex;
    this._dropShot();
    const shot = { key, url, tex: null };
    this._shot = shot;
    if (typeof Image === 'undefined' || typeof document === 'undefined') return null;
    const img = new Image();
    img.onload = () => {
      if (this._shot !== shot) return;   // superseded while decoding
      try {
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, c.width, c.height);
        shot.tex = renderer.uploadTexture('saveshot', key,
          { width: c.width, height: c.height, colors: data.data }, { smooth: true });
      } catch { /* a corrupt shot draws as none */ }
    };
    img.src = url;
    return null;
  }

  _dropShot() {
    if (this._shot?.tex) this._renderer?.releaseTexture?.('saveshot', this._shot.key);
    this._shot = null;
  }

  /** The overlay slots dispose what they replace - the shot texture
   *  leaves with the window. */
  dispose() { this._dropShot(); }

  click(vx, vy) {
    // The stacked boxes swallow every click (their own hit tables).
    if (this.top === 'overwrite' || this.top === 'delete') {
      const hit = this._boxHit(vx, vy);
      if (this.top === 'overwrite') {
        if (hit === MB_BUTTONS.Yes) { this._click(); this._saveGame(); }
        else if (hit === MB_BUTTONS.No) { this._click(); this.top = null; }   // ConfirmOverwrite's No pops the confirm
      } else if (this.top === 'delete') {
        if (hit === MB_BUTTONS.Delete) {
          this._click();
          const key = this._selectedKey();
          if (key !== -1) deleteSave(key);
          this.nameText = '';
          this.selectedIndex = -1;
          this.refresh();
          this.top = null;               // ConfirmDelete's tail CloseWindow pops the confirm either way
        } else if (hit === MB_BUTTONS.Cancel) { this._click(); this.top = null; }
      }
      return true;
    }
    if (this.top === 'rename') { return true; }   // the input box holds focus; Escape leaves
    if (this.top === 'charPicker') {
      const row = Math.floor((vy - 40) / 10);
      if (row >= 0 && row < this._charRows.length && vx >= 90 && vx < 230) {
        // Picker_OnItemPicked: re-key the window and clear the box.
        this._click();
        this.displayMostRecentChar = false;
        this.currentPlayerName = this._charRows[row];
        this.nameText = '';
        this.selectedIndex = -1;
        this.refresh();
      }
      this.top = null;
      return true;
    }
    if (this.top) { this.top = null; return true; }

    const M = MAIN_PANEL;
    const px = vx - M[0], py = vy - M[1];
    const R = SW_RECTS;

    // The list: a row click selects; a second click on the SAME row
    // within the double window is OnMouseDoubleClick = go (:153).
    if (inRect(R.savesList, px, py)) {
      const row = Math.floor((py - R.savesList[1]) / ROW_H);
      const index = this.scrollIndex + row;
      if (index >= 0 && index < this.rows.length) {
        this._click();
        const now = Date.now();
        const isDouble = this._lastClick.index === index && now - this._lastClick.t < 400;
        this._lastClick = { t: now, index };
        this._select(index);
        if (isDouble) this._go();
      }
      return true;
    }
    // The scroller trough pages by displayed rows (the F180 shape).
    if (inRect(R.scroller, px, py) && this.rows.length > SW_LIST_ROWS) {
      this._click();
      const frac = (py - R.scroller[1]) / R.scroller[3];
      const maxScroll = this.rows.length - SW_LIST_ROWS;
      const thumbAt = maxScroll ? this.scrollIndex / maxScroll : 0;
      this.scrollIndex = Math.max(0, Math.min(maxScroll,
        this.scrollIndex + (frac < thumbAt ? -SW_LIST_ROWS : SW_LIST_ROWS)));
      return true;
    }
    if (inRect(R.go, px, py)) { this._click(); this._go(); return true; }
    if (inRect(R.cancel, px, py)) { this._click(); this._cancel(); return true; }
    // The classic switch is a LOAD-mode door (:437 disables it for
    // save) and needs its mount.
    if (inRect(R.switchClassic, px, py) && this.mode === 'load' && this.hooks.onSwitchClassic) {
      this._click();
      this.done = true;
      this.hooks.onSwitchClassic();
      return true;
    }
    // Rename and delete want a selection (:562, :592).
    if (inRect(R.rename, px, py) && this.selectedIndex >= 0) {
      this._click();
      this.renameText = this.nameText;   // TextBox.Text prefills (:568)
      this.top = 'rename';
      return true;
    }
    if (inRect(R.del, px, py) && this.selectedIndex >= 0) {
      this._click();
      this.top = 'delete';
      return true;
    }
    // Switch character: load mode with at least one character (:449-452).
    if (inRect(R.switchChar, px, py) && this.mode === 'load') {
      const names = characterNames().sort();   // OrderBy(o => o), :642
      if (names.length >= 1) {
        this._click();
        this._charRows = names;
        this.top = 'charPicker';
      }
      return true;
    }
    return true;   // the window is modal - a stray click never falls through
  }

  draw(renderer, canvas, font) {
    this.update();                       // Update() runs before Draw()
    const m = nativeMetrics(canvas);
    const M = MAIN_PANEL;
    const R = SW_RECTS;
    const at = ([x, y, w, h]) => [M[0] + x, M[1] + y, w, h];
    const panel = (rect, color, outline = true) => {
      const [x, y, w, h] = at(rect);
      drawRect(renderer, m, x, y, w, h, color);
      if (outline) {
        drawRect(renderer, m, x - 1, y - 1, w + 2, 1, [1, 1, 1, 0.35]);
        drawRect(renderer, m, x - 1, y + h, w + 2, 1, [1, 1, 1, 0.35]);
        drawRect(renderer, m, x - 1, y, 1, h, [1, 1, 1, 0.35]);
        drawRect(renderer, m, x + w, y, 1, h, [1, 1, 1, 0.35]);
      }
    };

    panel([0, 0, M[2], M[3]], SW_COLORS.main);
    // Prompt (savePrompt/loadPrompt + the character name, :363-369).
    const prompt = this.noSaves
      ? SW_TEXT.noSavesFound
      : saveLoadPrompt(this.mode === 'save' ? SW_TEXT.savePrompt : SW_TEXT.loadPrompt,
        this.currentPlayerName);
    // promptLabel.ShadowPosition = Vector2.zero (:119) - and a zero
    // position skips the shadow pass outright (TextLabel.cs:354-355).
    shadowText(renderer, font, prompt, m, M[0] + 4, M[1] + 4, { shadowOffset: 0 });

    // Name panel + text. TextBox.Draw has ONE branch on the content
    // (TextBox.cs:244 vs :253-260): the text, or the DefaultText in
    // defaultTextColor - never gated on ReadOnly, so save mode shows
    // "Enter save name" exactly as load mode shows "Select a save"
    // (SetMode :435, :443). The CURSOR is a separate child (:30, :160)
    // that only ReadOnly disables (:236-239), so it draws over the
    // default text in save mode and never in load mode; the caret is
    // the port's plain underscore, drawn at the text's own width.
    panel(R.namePanel, SW_COLORS.namePanel);
    const nameShown = this.nameText.length ? this.nameText
      : (this.mode === 'save' ? SW_TEXT.enterSaveName : SW_TEXT.selectSaveName);
    const nameX = M[0] + R.namePanel[0] + 2, nameY = M[1] + R.namePanel[1] + 1;
    shadowText(renderer, font, nameShown, m, nameX, nameY,
      this.nameText.length ? {} : { color: SW_COLORS.folder });
    if (this.mode === 'save') {
      shadowText(renderer, font, '_', m, nameX + measureText(font.fnt, this.nameText), nameY);
    }

    // Saves panel, list, scroller.
    panel(R.savesPanel, SW_COLORS.main);
    panel(R.savesList, SW_COLORS.list, false);
    // ListBox.Draw (ListBox.cs:301-330) draws the row LABELS and
    // nothing else - there is no per-row background anywhere in it, so
    // the selection is a COLOUR: DecideTextColor (:360-372) hands the
    // selected row `selectedTextColor`, which ListBox.cs:43 and :68
    // both take from DaggerfallDefaultSelectedTextColor (162,36,12,
    // DaggerfallUI.cs:62) and this window never overrides (it sets
    // TextColor alone, :147). No row carries a shadow either:
    // savesList.ShadowPosition is zeroed at :149 and the selected arm
    // rides ListBox.cs:41's selectedShadowPosition, zero as well.
    const visible = this.rows.slice(this.scrollIndex, this.scrollIndex + SW_LIST_ROWS);
    visible.forEach((row, i) => {
      const index = this.scrollIndex + i;
      const y = M[1] + R.savesList[1] + i * ROW_H;
      shadowText(renderer, font, row.saveName, m, M[0] + R.savesList[0] + 1, y + 1,
        { color: index === this.selectedIndex ? SELECTED_TEXT_COLOR : SW_COLORS.listText, shadowOffset: 0 });
    });
    if (this.rows.length > SW_LIST_ROWS) {
      panel(R.scroller, SW_COLORS.namePanel, false);
      const maxScroll = this.rows.length - SW_LIST_ROWS;
      const thumbH = Math.max(6, Math.floor(R.scroller[3] * SW_LIST_ROWS / this.rows.length));
      const thumbY = Math.floor((R.scroller[3] - thumbH) * (maxScroll ? this.scrollIndex / maxScroll : 0));
      drawRect(renderer, m, M[0] + R.scroller[0], M[1] + R.scroller[1] + thumbY, R.scroller[2], thumbH, [0.6, 0.6, 0.6, 1]);
    }

    // Screenshot + info panels. UpdateSelectedSaveInfo's clear arm
    // (:374-385) comes first: no name or no selection and the panel is
    // bare, both time labels and both corner labels blank. C1 - SAV4
    // asked only whether the name resolved to a slot, so a window whose
    // list selection had been dropped still drew a live info panel.
    panel(R.screenshot, SW_COLORS.list);
    const key = this._infoShown() ? this._selectedKey() : -1;
    if (key === -1) this._dropShot();    // the destroyed BackgroundTexture (:393-397)
    if (key !== -1) {
      // SS1: the WINDOW loads the shot itself, exactly as the C#'s
      // UpdateSelectedSaveInfo calls GetSaveScreenshot and sets the
      // panel texture (:195-201); the hook stays as the override seam.
      const tex = this.hooks.screenshotTexture
        ? this.hooks.screenshotTexture(key, screenshotOf(key))
        : this._shotTexture(renderer, key);
      if (tex) {
        const [sx, sy, sw, sh] = at(R.screenshot);
        renderer.drawScreenQuad(tex, { x: m.ox + sx * m.s, y: m.oy + sy * m.s, w: sw * m.s, h: sh * m.s });
      }
      const info = saveInfoOf(key);
      if (info) {
        shadowText(renderer, font, `V${info.saveVersion}`, m, M[0] + R.screenshot[0] + 1, M[1] + R.screenshot[1] + 1, { color: SW_COLORS.folder });
        const folder = `SAVE${key}`;
        shadowText(renderer, font, folder, m,
          M[0] + R.screenshot[0] + R.screenshot[2] - 1 - measureText(font.fnt, folder), M[1] + R.screenshot[1] + 1,
          { color: SW_COLORS.folder });
        const real = info.dateAndTime?.realTime
          ? new Date(info.dateAndTime.realTime).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
          : '';
        // saveTimeLabel (:226) and gameTimeLabel (:230) are the other
        // two ShadowPosition = Vector2.zero labels; the version and
        // folder lines above keep theirs (:209, :215).
        shadowText(renderer, font, real, m, M[0] + R.infoPanel[0], M[1] + R.infoPanel[1], { align: 'center', w: R.infoPanel[2], shadowOffset: 0 });
        shadowText(renderer, font, midDateTimeString(dateFromClassicMinutes(info.dateAndTime?.gameTime ?? 0)), m,
          M[0] + R.infoPanel[0], M[1] + R.infoPanel[1] + 9, { align: 'center', w: R.infoPanel[2], shadowOffset: 0 });
      }
    }

    // Buttons. `outline` is the C#'s Outline.Enabled, which Panel's
    // constructor leaves OFF (Panel.cs:91) - so only go/classic/cancel
    // carry one (:168, :179, :190); rename and delete turn theirs off
    // outright (:241, :259) and switchChar never asks for one.
    const button = (rect, label, color, { dim = false, outline = true } = {}) => {
      panel(rect, color, outline);
      const [x, y, w, h] = at(rect);
      shadowText(renderer, font, label, m, x, y + Math.floor((h - 7) / 2),
        { align: 'center', w, color: dim ? SW_COLORS.folder : undefined });
    };
    const hasInfo = this._infoShown();   // UpdateSelectedSaveInfo's two colour arms (:382-383, :415-416)
    button(R.go, this.mode === 'save' ? SW_TEXT.saveButton : SW_TEXT.loadButton, SW_COLORS.save);
    // SetMode disables the classic switch in save mode (:437) and an
    // Enabled=false component is NOT DRAWN. The dim arm below is the
    // port's own (a host that handed over no mount).
    if (this.mode === 'load') {
      button(R.switchClassic, SW_TEXT.classicSave, SW_COLORS.classic,
        { dim: !this.hooks.onSwitchClassic });
    }
    button(R.cancel, SW_TEXT.cancel, SW_COLORS.cancel);
    button(R.rename, SW_TEXT.renameSave, hasInfo ? SW_COLORS.save : SW_COLORS.namePanel,
      { dim: !hasInfo, outline: false });
    button(R.del, SW_TEXT.deleteSave, hasInfo ? SW_COLORS.cancel : SW_COLORS.namePanel,
      { dim: !hasInfo, outline: false });
    // switchChar: load mode AND at least one character (:436, :449-452).
    if (this.mode === 'load' && this.characterCount >= 1) {
      button(R.switchChar, SW_TEXT.switchChar, SW_COLORS.save, { outline: false });
    }

    // The loading label (:246-251, :518): gray ground, white text,
    // centred in the main panel both ways (Center + Middle overrides
    // the declared position per axis). Empty until `loading`, and an
    // empty TextLabel draws nothing at all.
    if (this.loading) {
      const lw = measureText(font.fnt, SW_TEXT.loading);
      const lx = M[0] + Math.floor((M[2] - lw) / 2);
      const ly = M[1] + Math.floor((M[3] - 9) / 2);
      drawRect(renderer, m, lx - 1, ly - 1, lw + 2, 11, [0.5, 0.5, 0.5, 1]);   // Color.gray
      shadowText(renderer, font, SW_TEXT.loading, m, lx, ly, { color: [1, 1, 1, 1] });
    }

    // The stacked boxes.
    this._box = null;
    if (this.top === 'overwrite' || this.top === 'delete' || this.top === 'note') {
      const rows = this.top === 'overwrite' ? [SW_TEXT.confirmOverwriteSave, '']
        : this.top === 'delete' ? [SW_TEXT.confirmDeleteSave, '']
          : this._noteRows ?? [];
      const buttons = this.top === 'overwrite' ? [MB_BUTTONS.Yes, MB_BUTTONS.No]
        : this.top === 'delete' ? [MB_BUTTONS.Delete, MB_BUTTONS.Cancel] : [];
      this._box = layoutMessageBox(font, rows, buttons);
      if (!drawMessageBox(renderer, m, font, this._box)) {
        rows.forEach((r, i) => shadowText(renderer, font, r, m, 20, 20 + i * 10));
      }
    } else if (this.top === 'rename') {
      drawRect(renderer, m, 80, 90, 160, 22, SW_COLORS.main);
      drawRect(renderer, m, 80, 90, 160, 1, [1, 1, 1, 0.5]);
      drawRect(renderer, m, 80, 111, 160, 1, [1, 1, 1, 0.5]);
      shadowText(renderer, font, `${SW_TEXT.enterSaveName}: `, m, 84, 93);   // SetTextBoxLabel (:567)
      shadowText(renderer, font, this.renameText + '_', m, 84, 102);
    } else if (this.top === 'charPicker') {
      const h = this._charRows.length * 10 + 8;
      drawRect(renderer, m, 90, 36, 140, h, SW_COLORS.main);
      this._charRows.forEach((name, i) => {
        shadowText(renderer, font, name, m, 90, 40 + i * 10, {
          align: 'center', w: 140,
          color: name === this.currentPlayerName ? undefined : SW_COLORS.listText,
        });
      });
    }
  }
}

/** The pause seam's doors (openClassicPauseFlow's own shape): mount
 *  the window in the shared slot so all four hosts get it with the
 *  hooks they already hand the pause window. `pointFromEvent` is the
 *  menu-side drive's concern - overlay hosts translate for us. */
export function openSaveWindow(show, mode, hooks, opts = {}) {
  const win = new SaveWindow(mode, hooks, opts);
  show(win);
  return win;
}

export { pointToNative };
