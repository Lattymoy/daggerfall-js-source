// CW1: THE WITCHES COVEN POPUP - DFU's DaggerfallWitchesCovenPopupWindow
// (MIT, Daggerfall Workshop / Hazelnut) on real ARENA2 art. "This is
// only for witch covens currently, but may be generalised if similarly
// handled NPCs are found" - the C# header's own scope, kept.
//
// THE NATIVE-WINDOW RULE, element by element:
// - the panel is DAED00I0.IMG (:43) - Talk / Daedra Summoning / Quest
//   painted into the art itself, so this window draws NO text of its
//   own (unlike the guild popup's service label).
// - mainPanel is Center/Middle on the 320x200 NativePanel (:76-77)
//   with Size 130x51 (:79) - the same geometry as the guild popup,
//   and the same ignored `Position = new Vector2(0, 50)` (:78):
//   BaseScreenComponent's alignments discard Position, so the panel
//   sits at ((320-130)/2, (200-51)/2).
// - the four buttons are panel-CHILD rects (:24-27): talk (5,5,120,7),
//   summon (5,14,120,7), quest (5,23,120,7), exit (44,33,43,15).
// - the ctor clears the parent backdrop (:62) - the room stays
//   visible behind the 130x51 panel, the AUDIT 26 F136 law.
//
// The window is geometry and hit rects; its three actions are the
// host's: Talk is TalkToStaticNPC through the popup door (menu
// defaulted TRUE, :168), Summon is DaedraSummoningService with the
// WITCH NPC's OWN factionID (:186) - not the building's - and Quest
// is the Witches-pool nonmember offer (offerFlow.offerCovenQuest).
// The boxes it stacks are the U11 parchment, the guild popup's idiom.
//
// FLAGGED: DFU binds each button to a DaggerfallShortcut hotkey
// (:84, :90, :96, :102) read from the player's own keybind file,
// which the port has no source for; the keyboard accelerators here
// are the port's own (Ledger A) and are named as such.

import { loadImg, nativeMetrics, drawImg, shadowText } from './nativePanel.js';
import { drawScreenDimBackdrop } from './chargenArt.js';
import { audio } from '../systems/audio.js';   // F141: the ButtonClick roster
import { SOUND } from '../systems/soundClips.js';
import { layoutMessageBox, drawMessageBox, messageBoxHit, MB_BUTTONS } from './messageBox.js';

/** mainPanel.Size (:79) - and the size of the IMG. */
export const COVEN_PANEL_W = 130, COVEN_PANEL_H = 51;
/** Center/Middle on the 320x200 native panel (:76-77). */
export const COVEN_PANEL_X = Math.round((320 - COVEN_PANEL_W) / 2);
export const COVEN_PANEL_Y = Math.round((200 - COVEN_PANEL_H) / 2);

/** #region UI Rects (:24-27), panel-relative. */
export const COVEN_RECTS = Object.freeze({
  talk: [5, 5, 120, 7],
  summon: [5, 14, 120, 7],
  quest: [5, 23, 120, 7],
  exit: [44, 33, 43, 15],
});

let _art = null;
export async function preloadCovenArt(deps) {
  if (_art) return;
  try {
    _art = { base: await loadImg(deps, 'DAED00I0.IMG') };
  } catch { console.warn('[coven] DAED00I0 unavailable; the coven popup stays text'); }
}
export const covenArtLoaded = () => !!_art;

const inRect = ([rx, ry, rw, rh], x, y) => x >= rx + COVEN_PANEL_X && y >= ry + COVEN_PANEL_Y
  && x < rx + COVEN_PANEL_X + rw && y < ry + COVEN_PANEL_Y + rh;

/** hooks:
 *   rows(textId) -> [{text,center}] (TEXT.RSC through the host)
 *   onTalk()                            (closes the window, then talks)
 *   onSummon() -> null | { rows, buttons?, onYes } | { dispatched }
 *   onQuest()  -> null | { dispatched }  (the offer mounts its own window)
 *   onClose()
 */
export class CovenWindow {
  constructor(hooks) {
    this.hooks = hooks;
    this.done = false;
    this.isChoiceWindow = true;   // raw codes through the overlay seam
    this.boxes = [];
  }

  get top() { return this.boxes.length ? this.boxes[0] : null; }

  _dismissTop(button = null) {
    const b = this.boxes.shift();
    if (!b) return;
    if (button === MB_BUTTONS.Yes) {
      // the summoning's are-you-sure: Yes may answer ANOTHER box
      // (poor / failed / greeting), which stacks in the dead one's
      // place - the guild popup's own chaining shape.
      const next = b.onYes?.();
      if (next?.rows) this.boxes.unshift({ ...next });
      // a dispatched Yes (the film window, the offer chain) replaced
      // this window in the overlay slot; nothing to stack.
      if (next === null) this._close();
    } else if (button === MB_BUTTONS.No) b.onNo?.();
    if (b.closesWindow && !this.boxes.length) this._close();
    b.onDismiss?.();
  }

  _close() { this.done = true; this.hooks.onClose?.(); }

  _summon() {
    const r = this.hooks.onSummon?.();
    if (r?.rows) { this.boxes.push({ ...r }); return; }
    if (r?.dispatched || r === null) this._close();
  }

  _quest() {
    const r = this.hooks.onQuest?.();
    // GetQuest either dispatched an offer window (which replaced this
    // one) or bailed on an active questor - CloseWindow both ways
    // (:125-129, and the message box rides its own window).
    if (r?.dispatched || !r) this._close();
  }

  input(code) {
    if (this.top) {
      if (this.top.buttons === 'YesNo') {
        if (code === 'KeyY') this._dismissTop(MB_BUTTONS.Yes);
        else if (code === 'KeyN' || code === 'Escape') this._dismissTop(MB_BUTTONS.No);
        return;
      }
      this._dismissTop();
      return;
    }
    // The port's own accelerators (Ledger A - DFU reads its keybinds).
    if (code === 'Escape' || code === 'Enter' || code === 'KeyE') { this._close(); return; }
    if (code === 'KeyT') { audio.playOneShot(SOUND.ButtonClick, 1); this._close(); this.hooks.onTalk?.(); return; }
    if (code === 'KeyS') { audio.playOneShot(SOUND.ButtonClick, 1); this._summon(); return; }
    if (code === 'KeyQ') { audio.playOneShot(SOUND.ButtonClick, 1); this._quest(); }
  }

  click(vx, vy) {
    if (this.top) {
      if (this.top.buttons === 'YesNo') {
        const hit = this._box ? messageBoxHit(this._box, vx, vy) : null;
        if (hit !== null) this._dismissTop(hit);
        return true;
      }
      this._dismissTop();
      return true;
    }
    // F141: PlayOneShot(SoundClips.ButtonClick) heads every handler -
    // Talk (:166), Summon (:184), Quest (:203), Exit (:222).
    // TALK: CloseWindow THEN TalkToStaticNPC (:167-168) - the popup
    // yields to the conversation, so the close comes first.
    if (inRect(COVEN_RECTS.talk, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._close(); this.hooks.onTalk?.(); return true; }
    if (inRect(COVEN_RECTS.summon, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._summon(); return true; }
    if (inRect(COVEN_RECTS.quest, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._quest(); return true; }
    if (inRect(COVEN_RECTS.exit, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._close(); return true; }
    return false;
  }

  draw(renderer, canvas, font) {
    if (!_art) { this._close(); return; }
    const m = nativeMetrics(canvas);
    // ParentPanel.BackgroundColor = Color.clear (:62): the room stays
    // visible behind the panel (the AUDIT 26 F136 law).
    drawScreenDimBackdrop(renderer, canvas);
    drawImg(renderer, _art.base, m, COVEN_PANEL_X, COVEN_PANEL_Y);
    const top = this.top;
    if (top) {
      const buttons = top.buttons === 'YesNo' ? [MB_BUTTONS.Yes, MB_BUTTONS.No] : [];
      this._box = layoutMessageBox(font, top.rows ?? this.hooks.rows?.(top.textId) ?? [], buttons);
      if (!drawMessageBox(renderer, m, font, this._box)) {
        (this._box.rows ?? []).forEach((r, i) =>
          shadowText(renderer, font, r.text, m, 20, 20 + i * this._box.rowH));
      }
    } else this._box = null;
  }
}
