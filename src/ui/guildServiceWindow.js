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
// THE HOTKEYS (D1, retiring the flag that stood here): the old note
// said DFU read these from "the player's own keybind file, which the
// port has no source for". Both halves were wrong. The source is
// DaggerfallShortcut's TEXT DATABASE, StreamingAssets/Text/
// DialogShortcuts.txt (DaggerfallShortcut.cs:307-326), which IS in the
// reference tree - and A8 already ported it whole to
// systems/dialogShortcuts.js. So the four bindings are now the table's
// answers (:128 GuildsJoin J, :134 GuildsTalk T, :145 the SERVICE's
// own button, :151 GuildsExit E) instead of four literals. The
// middle one is the correction that flag was hiding: DFU hangs
// `Services.GetServiceShortcutButton(service)` there, so the letter
// moves with the service - Training R, Get Quest G, Identify I,
// Donate D, Cure C... - where the port spelled a flat KeyS, which is
// right for exactly two of the twenty (SellMagicItems, Spymaster).
// The order asked is DFU's ADD order (join, talk, service, exit),
// which is the order Panel.ProcessHotkeySequences walks - it matters,
// because a member panel drops Join and because Spymaster's S and
// SellMagicItems' S sit under a Talk that is T, never colliding.

import { loadImg, nativeMetrics, drawImg, shadowText, DEFAULT_TEXT_COLOR } from './nativePanel.js';
import { drawScreenDimBackdrop } from './chargenArt.js';
import { audio } from '../systems/audio.js';   // F141: the ButtonClick roster
import { SOUND } from '../systems/soundClips.js';
import { layoutMessageBox, drawMessageBox, messageBoxHit, MB_BUTTONS } from './messageBox.js';
import { drawText, measureText } from './text.js';
import { serviceLabel, serviceShortcutButton } from '../systems/guildServiceFlow.js';
import { firstHotkey } from '../systems/dialogShortcuts.js';   // A8: the DaggerfallShortcut table

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
    if (button === MB_BUTTONS.Yes) {
      // CW1: a Yes handler may ANSWER A BOX - the summoning's
      // are-you-sure resolves to "not enough gold" / "the daedra does
      // not answer" / the greeting, each a box DFU pushes over the
      // popup (DaggerfallQuestPopupWindow.cs:207-266). This window
      // dropped the return, so the temple path spent the gold and
      // said nothing. A null return means the handler DISPATCHED
      // (the film window replaced this one in the overlay slot).
      const next = b.onYes?.();
      if (next?.rows) this.boxes.unshift({ ...next });
    } else if (button === MB_BUTTONS.No) b.onNo?.();
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

  input(code, e = null) {
    if (this.top) {
      if (this.top.buttons === 'YesNo') {
        if (code === 'KeyY') this._dismissTop(MB_BUTTONS.Yes);
        else if (code === 'KeyN' || code === 'Escape') this._dismissTop(MB_BUTTONS.No);
        return;
      }
      this._dismissTop();
      return;
    }
    // Escape/Enter are the port host's close keys, not DFU buttons.
    if (code === 'Escape' || code === 'Enter') { this._close(); return; }
    // D1: the four Hotkeys, from the table, in DFU's button ADD order.
    const serviceBtn = serviceShortcutButton(this.hooks.service?.());
    const buttons = [
      ...(this.hooks.member() ? [] : ['GuildsJoin']),   // the row only EXISTS for a non-member (:127-132)
      'GuildsTalk',
      ...(serviceBtn ? [serviceBtn] : []),              // Buttons.None -> no accelerator at all
      'GuildsExit',
    ];
    const hit = firstHotkey(buttons, code, e);
    if (hit === null) return;
    // F141 on the KEYBOARD side too: Talk/Service/Exit each play
    // ButtonClick in their OnKeyboardEvent's KeyDown arm (:299, :460,
    // :500), and Join - the one button with NO OnKeyboardEvent
    // handler - reaches its OnMouseClick through Button
    // .ProcessHotkeySequences' faked click (Button.cs:85-90), sound
    // included. So all four sound, which the flat letters never did.
    audio.playOneShot(SOUND.ButtonClick, 1);
    switch (hit) {
      case 'GuildsJoin': this._join(); return;
      case 'GuildsTalk': this.hooks.onTalk?.(); this._close(); return;
      case 'GuildsExit': this._close(); return;
      default: this._service();   // whichever of the nineteen service buttons hit
    }
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
    // Join (:501), Talk (:293), Service (:457), Exit (:477).
    if (!this.hooks.member() && inRect(GUILD_RECTS.join, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._join(); return true; }
    if (inRect(GUILD_RECTS.talk, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this.hooks.onTalk?.(); this._close(); return true; }
    if (inRect(GUILD_RECTS.service, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._service(); return true; }
    if (inRect(GUILD_RECTS.exit, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._close(); return true; }
    return false;
  }

  draw(renderer, canvas, font) {
    if (!_art) { this._close(); return; }
    const m = nativeMetrics(canvas);
    // AUDIT 26 F136: this window's OWN ctor overrides the base black -
    // `ParentPanel.BackgroundColor = Color.clear` (:99) - and
    // DaggerfallPopupWindow's ScreenDimColor is hard-clear (:26-34,
    // the setter discards its value), so the room stays visible behind
    // the 130x51 panel. The AUDIT 19 comment here cited the base
    // default this ctor overrides - the defect class AUDIT 24 fixed on
    // five sibling windows, with this one missed.
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
