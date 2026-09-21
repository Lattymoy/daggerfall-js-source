// HUD popup text (UI arc, U5). PopupText verbatim (PopupText.cs, MIT
// Daggerfall Workshop): rows lay out from the TOP of the 320x200
// NativePanel - DaggerfallHUD.cs:172-173 gives popupText
// NativePanel.Size and adds it there - starting at y = 4 and striding
// TextHeight + textSpacing (1), each row centred by
// HorizontalAlignment.Center over the panel's 320 px.
//
// The queue is DFU's single-timer model, not a per-line countdown:
// AddText arms `timer` with popDelay (1 s), Update decrements it -
// accelerated by 1 + rubberbandFactor * (rows - maxRows) once more
// than maxRows (7) are queued - and every crossing of -popDelay pops
// the FRONT row and adds nextPopDelay back. While timer is negative
// the whole block slides up by (TextHeight + textSpacing) *
// timer / popDelay, which is the classic scroll-out.
//
// Phrasings follow the classic strings ("Your %s skill has
// improved."). The TEXT.RSC reader SHIPPED (U6) - what remains open
// is only that the skill/loot literals here are not yet read from
// their TEXT.RSC record ids (AUDIT 23 narrowed the stale flag).

// FONT1 (2026-09-16, Mac: "Enhanced mode UI ... Ambient Text mod also
// doesnt use it. Any enhanced UI or text must be our enhanced
// version"): THE MODEL IS ONE, THE DRAW IS TWO.
//
// Everything above this line - the queue, the timer, the rubberband,
// the notebook tail - is PopupText and stays PopupText whatever skin
// is on: a second queue for the enhanced skin would be a second
// PopupText, and two of them drift apart on the first line that pops
// while a window is open. What the skin changes is the PAINT, so
// `draw` branches at its top and hands the enhanced face the frame
// this class would have drawn - the same rows, in the same order. The
// classic arm below is byte for byte what it was.
//
// ENH-NOTICE3 (2026-09-21, Mac: "All mods, including climates and
// calories need to utilize the enhanced notification popup"): THE
// ENHANCED FACE IS THE NOTICE STACK. FONT1's face was a DOM column at
// the top of the screen (ui/enhancedHudText.js, retired); that was a
// second enhanced face beside the notice panel ENH-NOTICE1 gave the
// message box, and the lines the player most wanted in the panel -
// Climates & Calories' hunger, thirst and cold, the Ambient Text
// mod's street lines, the torches' burn-out, every skill-up and loot
// tally - are exactly this class's rows (DaggerfallUI.AddHUDText, the
// HUD-text kind, never a box). So each row is a TOAST in that stack
// now (ui/enhancedNotice.js drawEnhancedToasts): a panel of its own,
// keyed by the row's id under this model's key, in while PopupText's
// timer keeps the row and out when this class pops it. The rows carry
// an id for that reason alone - the classic arm never reads it.
import { drawText, measureText } from './text.js';
import { nativeMetrics, NATIVE_W, DEFAULT_TEXT_COLOR } from './nativePanel.js';
import { isEnhanced } from '../systems/uiSkin.js';
import { drawEnhancedToasts, releaseEnhancedToasts } from './enhancedNotice.js';

/** AUDIT FONT F1: every model gets a name of its own, so two never
 *  share one DOM column - see ui/enhancedHudText.js's header for why
 *  there are two at all. A caller that passes none still gets a
 *  unique one, because the failure this closes was exactly two
 *  instances agreeing on a default. */
let _hudTextSeq = 0;

export const HUD_TEXT_POP_DELAY = 1.0;      // PopupText.popDelay
export const HUD_TEXT_MAX_ROWS = 7;         // PopupText.maxRows
export const HUD_TEXT_SPACING = 1;          // PopupText.textSpacing
export const HUD_TEXT_RUBBERBAND = 0.8;     // PopupText.rubberbandFactor
export const HUD_TEXT_TOP = 4;              // PopupText.Draw's `float y = 4`

export class HudText {
  constructor(key = null) {
    /** AUDIT FONT F1: this model's own DOM column (ui/enhancedHudText
     *  .js). `key` names the OWNER for a reader of the rendered page;
     *  the sequence is appended whatever is passed, so two contexts
     *  that overlap for a frame - one built before the other's
     *  teardown - can never land on one element either. */
    this.key = `${key ?? 'hud'}${++_hudTextSeq}`;
    /** AUDIT FONT F4: the host's last word on whether a canvas window
     *  stands over this column - see observe() below. */
    this.covered = false;
    this.lines = [];
    /** ENH-NOTICE3: the next row's id - each row is its own toast under
     *  the enhanced skin, and a toast must know which row it is across
     *  frames (a row that left the frame was POPPED; a row still in it
     *  stays put). Per model, never reused. */
    this._nextId = 0;
    this.timer = 0;
    this.nextPopDelay = HUD_TEXT_POP_DELAY;
    // AUDIT 24 (wave 22): PopupText.AddText's LAST line is
    // `GameManager.Instance.PlayerEntity.Notebook.AddMessage(pgText)`
    // (:123) - every HUD popup the player ever sees is filed in the
    // notebook's 50-slot message ring, and the journal's Messages page
    // is that ring. The port had the ring, GetMessages and AddMessage
    // all ported and NOTHING calling AddMessage, so the fourth page of
    // the journal was permanently blank. The host wires this to the
    // notebook.
    this.onMessage = null;
  }

  /** PopupText.AddText verbatim - the row is queued unconditionally;
   *  only the timer retires rows. */
  add(text, delayInSeconds = HUD_TEXT_POP_DELAY) {
    if (this.lines.length === 0) this.timer = delayInSeconds;
    else if (this.timer >= 0) this.timer = Math.max(this.timer, delayInSeconds);
    else this.nextPopDelay = Math.max(this.nextPopDelay, delayInSeconds);
    this.lines.push({ id: ++this._nextId, text });
    this.onMessage?.(text);
  }

  /** PopupText.Update verbatim. */
  tick(dt) {
    if (!this.lines.length) return;
    const rowsLate = this.lines.length - HUD_TEXT_MAX_ROWS;
    this.timer -= rowsLate > 0 ? dt * (1 + HUD_TEXT_RUBBERBAND * rowsLate) : dt;
    while (this.lines.length && this.timer < -HUD_TEXT_POP_DELAY) {
      this.timer += this.nextPopDelay;
      this.lines.shift();
      this.nextPopDelay = HUD_TEXT_POP_DELAY;
    }
  }

  /** FONT1: PopupText.Draw's frame as DATA - the rows it would paint,
   *  front first, and the scroll-out in ROWS - for a renderer that is
   *  not the bitmap one. The row count is Draw's own: the loop breaks
   *  AFTER the row that takes the count past maxRows (`if (++count >
   *  maxCount) break`), so a full queue paints maxRows + 1 rows. That
   *  is DFU's off-by-one and it is kept, because this is the same Draw
   *  described twice and the two must not disagree. */
  frame() {
    const maxCount = Math.min(this.lines.length, HUD_TEXT_MAX_ROWS);
    const drawn = this.lines.slice(0, maxCount + 1);
    return {
      rows: drawn.map((l) => l.text),
      ids: drawn.map((l) => l.id),   // ENH-NOTICE3: beside the rows, so a toast keeps its row across frames
      slide: this.timer < 0 ? this.timer / HUD_TEXT_POP_DELAY : 0,
    };
  }

  /** FONT1: THE HIDE DOOR, and why there is one at all.
   *
   *  The classic column is repainted every frame, so a host that wants
   *  it gone simply does not call `draw` - which is what the hosts'
   *  `if (font && hudRenderEnabled())` has always been. A DOM column is
   *  not repainted: it STAYS until it is told otherwise (AUDIT 64 F37,
   *  the enhanced HUD's own finding), so under the enhanced skin the
   *  not-drawing has to be SAID. The hosts say it in the `else` of the
   *  gate they already had, and on the classic skin this is nothing at
   *  all - which is exactly what the classic did with those frames. */
  hide() {
    if (isEnhanced() && typeof document !== 'undefined') drawEnhancedToasts({ rows: [], ids: [], slide: 0, visible: false }, undefined, this.key);
  }

  /** EVERY ALLOCATION HAS AN OWNER (AUDIT FONT F1): a model whose host
   *  is ending takes its toasts with it. */
  dispose() {
    if (typeof document !== 'undefined') releaseEnhancedToasts(this.key);
  }

  /** AUDIT FONT F4 - WHAT THE HOST CAN SEE AND THIS MODEL CANNOT: a
   *  canvas window standing over the column.
   *
   *  The classic column is painted by the host BEFORE the window on
   *  top of it (scenes/townTalk.js draws the column, then the overlay
   *  stack), which is DFU's order too - DaggerfallHUD paints under the
   *  top window. A DOM face is over the canvas and obeys no such
   *  order, so under the enhanced skin the popup lines stood OVER the
   *  death screen, the rest and save windows, the travel pop-up, the
   *  quest journal and every MessageBox. So the hosts REPORT their
   *  window slot per frame - the same idiom ui/hud.js already uses for
   *  the mid-screen label's `observe` - and the enhanced arm hides the
   *  toasts for as long as one stands (ENH-NOTICE3 kept the law: the
   *  stack is the box's too, and a toast under a box the player is
   *  reading is DFU's column under DFU's box).
   *  The classic arm reads it not at all: there the draw order has
   *  always said it, and DFU really does paint that column under the
   *  window. A window slot is the HOST's to know, and a fourth
   *  positional argument here is a slot the window sweep reserves for
   *  the scale (audit24 wave40). */
  observe(covered) { this.covered = !!covered; }

  /** PopupText.Draw verbatim, in NativePanel coordinates - and, under
   *  the enhanced skin, the same frame handed to the notice stack as
   *  toasts instead (FONT1, ENH-NOTICE3). The hosts pass a fourth
   *  argument (the HUD scale) and this has never declared one: the
   *  classic column measures itself off the native panel and the
   *  enhanced face off the sheet. */
  draw(renderer, canvas, font) {
    if (isEnhanced() && typeof document !== 'undefined') {
      drawEnhancedToasts({ ...this.frame(), visible: !this.covered }, undefined, this.key);
      return;
    }
    if (!font || !this.lines.length) return;
    const m = nativeMetrics(canvas);
    const rowH = font.fnt.fixedHeight;   // TextLabel.TextHeight = font.GlyphHeight
    let y = HUD_TEXT_TOP;
    if (this.timer < 0) y += (rowH + HUD_TEXT_SPACING) * this.timer / HUD_TEXT_POP_DELAY;
    const maxCount = Math.min(this.lines.length, HUD_TEXT_MAX_ROWS);
    let count = 0;
    for (const l of this.lines) {
      const x = (NATIVE_W - measureText(font.fnt, l.text)) / 2;
      drawText(renderer, font, l.text, m.ox + x * m.s, m.oy + y * m.s, m.s, DEFAULT_TEXT_COLOR);
      y += rowH + HUD_TEXT_SPACING;
      if (++count > maxCount) break;
    }
  }
}
