// U23: THE GUILD SERVICE POPUP - DFU's DaggerfallGuildServicePopupWindow
// (MIT, Daggerfall Workshop / Hazelnut) on real ARENA2 art. The small
// three-button panel every guild hall, temple and knightly order puts
// in front of you when you click its service NPC.
//
// THE NATIVE-WINDOW RULE, element by element:
// - the panel is GILD00I0.IMG (non-member: it has the Join Guild row)
//   or GILD01I0.IMG (member), :57-58. Both are 130x51 in the shipping
//   data, which is exactly mainPanel.Size (:124).
// - mainPanel is HorizontalAlignment.Center + VerticalAlignment.Middle
//   on the 320x200 NativePanel (:121-122). BaseScreenComponent
//   :1217/:1234 make BOTH alignments ignore Position, so the declared
//   `Position = new Vector2(0, 50)` (:123) never applies - the panel
//   sits at ((320-130)/2, (200-51)/2) = (95, 74.5). The half pixel is
//   real in DFU too (its rect is float); the port rounds it the way
//   layoutMessageBox rounds its own centring.
// - the four buttons are panel-CHILD rects (:36-39): join (5,5,120,7),
//   talk (5,14,120,7), service (5,23,120,7), exit (44,33,43,15). The
//   join button only EXISTS for a non-member (:127-132), which is the
//   same condition that picked the base texture - so the member panel
//   has no dead rect where its row used to be.
// - the service label is the one piece of text the window draws
//   (:135-139): Position (0,1) INSIDE the service button,
//   HorizontalAlignment.Center, and ShadowPosition = Vector2.zero -
//   NO SHADOW, unlike every other label in the port. The string is
//   Services.GetServiceLabelText (guildServiceFlow.SERVICE_LABEL).
//
// The window is geometry and hit rects only; every law it obeys is in
// systems/guildServiceFlow.js (routing, OnPush, the access refusal)
// and systems/guilds.js (the join decision). The message boxes it
// stacks are the U11 parchment.
//
// FLAGGED: DFU binds each button to a DaggerfallShortcut hotkey
// (:129, :133, :141, :147) read from the player's own keybind file,
// which the port has no source for; the keyboard accelerators here
// are the port's own (Ledger A) and are named as such.

import { loadImg, nativeMetrics, drawImg, shadowText, DEFAULT_TEXT_COLOR } from './nativePanel.js';
import { drawScreenDimBackdrop } from './chargenArt.js';
import { layoutMessageBox, drawMessageBox, messageBoxHit, MB_BUTTONS } from './messageBox.js';
import { drawText, measureText } from './text.js';
import { serviceLabel } from '../systems/guildServiceFlow.js';

/** mainPanel.Size (:124) - and the size of both IMGs. */
export const PANEL_W = 130, PANEL_H = 51;
/** Center/Middle on the 320x200 native panel (:121-122). */
export const PANEL_X = Math.round((320 - PANEL_W) / 2);
export const PANEL_Y = Math.round((200 - PANEL_H) / 2);

/** #region UI Rects (:36-39), panel-relative. */
export const GUILD_RECTS = Object.freeze({
  join: [5, 5, 120, 7],
  talk: [5, 14, 120, 7],
  service: [5, 23, 120, 7],
  exit: [44, 33, 43, 15],
});

/** serviceLabel.Position (:135) inside the service button. */
export const SERVICE_LABEL_OFFSET_Y = 1;

let _art = null;
export async function preloadGuildServiceArt(deps) {
  if (_art) return;
  try {
    const [base, member] = await Promise.all([
      loadImg(deps, 'GILD00I0.IMG'), loadImg(deps, 'GILD01I0.IMG'),
    ]);
    _art = { base, member };
  } catch { console.warn('[guild] GILD00I0/GILD01I0 unavailable; the guild popup stays text'); }
}
export const guildServiceArtLoaded = () => !!_art;

const inRect = ([rx, ry, rw, rh], x, y) => x >= rx + PANEL_X && y >= ry + PANEL_Y
  && x < rx + PANEL_X + rw && y < ry + PANEL_Y + rh;

/** hooks:
 *   member() -> bool          (guildServiceFlow.showsJoinButton, inverted)
 *   service() -> the GUILD_SERVICES kind this NPC offers
 *   steps() -> the OnPush stack (guildServiceFlow.onPushEffects), once
 *   rows(textId) -> [{text,center}] (TEXT.RSC through the host)
 *   onJoin() -> null | { rows, buttons?: 'YesNo', onYes }
 *   onTalk(), onService(), onClose()
 */
export class GuildServiceWindow {
  constructor(hooks) {
    this.hooks = hooks;
    this.done = false;
    this.isChoiceWindow = true;   // raw codes through the overlay seam
    // OnPush runs BEFORE the first draw, exactly as DFU's does - the
    // heal and the recharge have already landed by the time the
    // player sees the panel behind the boxes.
    this.boxes = [...(hooks.steps?.() ?? [])];
  }

  get top() { return this.boxes.length ? this.boxes[0] : null; }

  _dismissTop(button = null) {
    const b = this.boxes.shift();
    if (!b) return;
    if (button === MB_BUTTONS.Yes) b.onYes?.();
    else if (button === MB_BUTTONS.No) b.onNo?.();
    if (b.closesWindow) this._close();
    // G6: ClickAnywhereToClose + OnClose (:436-437). The Spymaster's
    // greeting is a box whose DISMISSAL is the service - it hands the
    // player to the NPC's own talk window - so the hook runs after
    // the close, not instead of it.
    b.onDismiss?.();
  }

  _push(box) { if (box) this.boxes.push(box); }

  _close() { this.done = true; this.hooks.onClose?.(); }

  _join() {
    // JoinButton_OnMouseClick (:497-525): the popup CLOSES first, then
    // the eligibility box shows over whatever is beneath it. The port
    // keeps the box on this window and closes with it, which is the
    // same sequence a player sees.
    const r = this.hooks.onJoin?.();
    if (!r) { this._close(); return; }
    this._push({ ...r, closesWindow: !r.buttons });
    if (r.buttons) this.boxes[this.boxes.length - 1].closesWindow = true;
  }

  _service() {
    const r = this.hooks.onService?.();
    // A refusal is a box on this window (DFU keeps the popup open for
    // both refusals, :314-328); a dispatch closes it (every arm of the
    // switch calls CloseWindow first).
    if (r?.rows) { this._push({ ...r, closesWindow: !!r.closesWindow }); return; }
    if (r?.dispatched) this._close();
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
    if (code === 'KeyJ' && !this.hooks.member()) { this._join(); return; }
    if (code === 'KeyT') { this.hooks.onTalk?.(); this._close(); return; }
    if (code === 'KeyS') this._service();
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
    if (!this.hooks.member() && inRect(GUILD_RECTS.join, vx, vy)) { this._join(); return true; }
    if (inRect(GUILD_RECTS.talk, vx, vy)) { this.hooks.onTalk?.(); this._close(); return true; }
    if (inRect(GUILD_RECTS.service, vx, vy)) { this._service(); return true; }
    if (inRect(GUILD_RECTS.exit, vx, vy)) { this._close(); return true; }
    return false;
  }

  draw(renderer, canvas, font) {
    if (!_art) { this._close(); return; }
    const m = nativeMetrics(canvas);
    // This window's OWN constructor overrides DaggerfallBaseWindow's
    // black parent panel: `ParentPanel.BackgroundColor = Color.clear;`
    // (DaggerfallGuildServicePopupWindow.cs:99), and ScreenDimColor is
    // hardwired clear besides (DaggerfallPopupWindow.cs:27, :34). The
    // room behind the 130x51 panel stays visible - the same law
    // AUDIT 24 read off the five windows in chargenArt's list.
    drawScreenDimBackdrop(renderer, canvas);
    const member = this.hooks.member();
    drawImg(renderer, member ? _art.member : _art.base, m, PANEL_X, PANEL_Y);
    // The service label: centred in the service button, +1 down, and
    // WITHOUT the default shadow (ShadowPosition = Vector2.zero).
    const [sx, sy, sw] = GUILD_RECTS.service;
    const label = serviceLabel(this.hooks.service?.());
    const lw = measureText(font.fnt, label);
    drawText(renderer, font, label,
      m.ox + (PANEL_X + sx + Math.round((sw - lw) / 2)) * m.s,
      m.oy + (PANEL_Y + sy + SERVICE_LABEL_OFFSET_Y) * m.s, m.s, DEFAULT_TEXT_COLOR);
    const top = this.top;
    if (top) {
      const buttons = top.buttons === 'YesNo' ? [MB_BUTTONS.Yes, MB_BUTTONS.No] : [];
      this._box = layoutMessageBox(font, top.rows ?? this.hooks.rows?.(top.textId) ?? [], buttons);
      if (!drawMessageBox(renderer, m, font, this._box)) {
        // art-less fallback keeps the text chain (the U11 shape)
        (this._box.rows ?? []).forEach((r, i) =>
          shadowText(renderer, font, r.text, m, 20, 20 + i * this._box.rowH));
      }
    } else this._box = null;
  }
}
