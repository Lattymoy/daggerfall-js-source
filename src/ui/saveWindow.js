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
// Recorded departures: no mod-conflict prompt (the port has no mods);
// the folder label opens no OS folder (no OS); the screenshot panel
// draws the stored capture when the slot has one and stays the bare
// panel otherwise, exactly as GetSaveScreenshot -> null does.
//
// hooks: {
//   playerName()            - the current character (PlayerEntity.Name)
//   saveAs(saveName)        - the HOST composes its envelope and saves
//   loadKey(key)            - the HOST restores the slot
//   onSwitchClassic()       - mounts the classic list (menu-side owns it)
//   onBack()                - re-open whatever pushed this (pause seam)
// } - absent hooks dim their doors, the pause window's own posture.

import { nativeMetrics, drawRect, shadowText, pointToNative } from './nativePanel.js';
import { measureText } from './text.js';
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
    this.top = null;                    // 'overwrite'|'delete'|'note'|'rename'|'charPicker'
    this._noteRows = null;
    this._box = null;
    this.renameText = '';
    this._charRows = [];
    this._lastClick = { t: 0, index: -1 };
    this.refresh();
    // "Autoselect save at top of list" in load mode (:291-292).
    if (this.mode === 'load' && this.rows.length > 0) this._select(0);
  }

  _click() { audio.playOneShot(SOUND.ButtonClick, 1); }

  /** OnPush + UpdateSavesList: enumerate fresh, honor
   *  displayMostRecentChar, order the character's saves by realTime
   *  DESCENDING. */
  refresh() {
    const { info } = enumerateSaves();
    const mostRecent = findMostRecentSave();
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

  /** SaveLoadEventHandler - the go path for both modes. */
  _go() {
    if (this.mode === 'save') {
      if (this.nameText.length === 0) {
        this.top = 'note';
        this._noteRows = ['You must enter a save name.'];   // youMustEnterASaveName
        return;
      }
      if (this._selectedKey() !== -1) { this.top = 'overwrite'; return; }
      this._saveGame();
    } else {
      if (this.nameText.length === 0) {
        this.top = 'note';
        this._noteRows = ['You must select a save name.'];   // youMustSelectASaveName
        return;
      }
      const key = this._selectedKey();
      if (key === -1) return;
      this.done = true;                  // PopToHUD before the restore
      this.hooks.loadKey?.(key);
    }
  }

  _saveGame() {
    const ok = this.hooks.saveAs?.(this.nameText);
    this.done = true;                    // SaveGame() -> PopToHUD (:422)
    if (ok === false) this.hooks.onSaveFailed?.();
  }

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

  /** SaveNameTextBox_OnType: a typed name that matches a row selects
   *  it; a non-match deselects (:539-551). */
  _onType(text) {
    this.nameText = text;
    const index = this.rows.findIndex((r) => r.saveName === text);
    this.selectedIndex = index;
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
      ? 'No saves found. You can load a classic Daggerfall save.'
      : `${this.mode === 'save' ? 'Save Game' : 'Load Game'} for ${this.currentPlayerName}`;
    shadowText(renderer, font, prompt, m, M[0] + 4, M[1] + 4);

    // Name panel + text (the caret is the port's plain underscore).
    panel(R.namePanel, SW_COLORS.namePanel);
    const nameShown = this.nameText.length ? this.nameText
      : (this.mode === 'save' ? 'Enter save name' : 'Select a save');
    shadowText(renderer, font, this.mode === 'save' ? this.nameText + '_' : nameShown,
      m, M[0] + R.namePanel[0] + 2, M[1] + R.namePanel[1] + 1,
      this.nameText.length ? {} : { color: SW_COLORS.folder });

    // Saves panel, list, scroller.
    panel(R.savesPanel, SW_COLORS.main);
    panel(R.savesList, SW_COLORS.list, false);
    const visible = this.rows.slice(this.scrollIndex, this.scrollIndex + SW_LIST_ROWS);
    visible.forEach((row, i) => {
      const index = this.scrollIndex + i;
      const y = M[1] + R.savesList[1] + i * ROW_H;
      if (index === this.selectedIndex) {
        drawRect(renderer, m, M[0] + R.savesList[0], y, R.savesList[2], ROW_H, [0.3, 0.3, 0.3, 0.6]);
      }
      shadowText(renderer, font, row.saveName, m, M[0] + R.savesList[0] + 1, y + 1,
        { color: index === this.selectedIndex ? [1, 1, 1, 1] : SW_COLORS.listText });
    });
    if (this.rows.length > SW_LIST_ROWS) {
      panel(R.scroller, SW_COLORS.namePanel, false);
      const maxScroll = this.rows.length - SW_LIST_ROWS;
      const thumbH = Math.max(6, Math.floor(R.scroller[3] * SW_LIST_ROWS / this.rows.length));
      const thumbY = Math.floor((R.scroller[3] - thumbH) * (maxScroll ? this.scrollIndex / maxScroll : 0));
      drawRect(renderer, m, M[0] + R.scroller[0], M[1] + R.scroller[1] + thumbY, R.scroller[2], thumbH, [0.6, 0.6, 0.6, 1]);
    }

    // Screenshot + info panels.
    panel(R.screenshot, SW_COLORS.list);
    const key = this._selectedKey();
    if (key !== -1) {
      const tex = this.hooks.screenshotTexture?.(key, screenshotOf(key));
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
        shadowText(renderer, font, real, m, M[0] + R.infoPanel[0], M[1] + R.infoPanel[1], { align: 'center', w: R.infoPanel[2] });
        shadowText(renderer, font, midDateTimeString(dateFromClassicMinutes(info.dateAndTime?.gameTime ?? 0)), m,
          M[0] + R.infoPanel[0], M[1] + R.infoPanel[1] + 9, { align: 'center', w: R.infoPanel[2] });
      }
    }

    // Buttons.
    const button = (rect, label, color, dim = false) => {
      panel(rect, color);
      const [x, y, w, h] = at(rect);
      shadowText(renderer, font, label, m, x, y + Math.floor((h - 7) / 2),
        { align: 'center', w, color: dim ? SW_COLORS.folder : undefined });
    };
    button(R.go, this.mode === 'save' ? 'Save' : 'Load', SW_COLORS.save);
    button(R.switchClassic, 'Classic', SW_COLORS.classic,
      !(this.mode === 'load' && this.hooks.onSwitchClassic));
    button(R.cancel, 'Cancel', SW_COLORS.cancel);
    button(R.rename, 'Rename', SW_COLORS.namePanel, this.selectedIndex < 0);
    button(R.del, 'Delete', this.selectedIndex < 0 ? SW_COLORS.namePanel : SW_COLORS.cancel, this.selectedIndex < 0);
    if (this.mode === 'load') button(R.switchChar, 'Character', SW_COLORS.save);

    // The stacked boxes.
    this._box = null;
    if (this.top === 'overwrite' || this.top === 'delete' || this.top === 'note') {
      const rows = this.top === 'overwrite' ? ['Overwrite this save?', '']
        : this.top === 'delete' ? ['Are you sure you want to delete this save?', '']
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
      shadowText(renderer, font, 'Enter save name: ', m, 84, 93);
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
