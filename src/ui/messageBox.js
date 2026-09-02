// U11: THE PARCHMENT MESSAGE BOX - DFU's DaggerfallMessageBox
// (MIT Daggerfall Workshop), the frame every popup in the game wants
// and the port has never had. U6's action boxes, the U10 gender
// screen and the race description box all drew on a flat colour rect
// because this did not exist.
//
// THE NATIVE-WINDOW RULE - the laws, with their DFU lines:
// - the frame is a NINE-SLICE over SPOP.RCI (DaggerfallUI.cs:48,
//   905-949 SetDaggerfallPopupStyle/LoadDaggerfallParchmentTextures):
//   records 0..8 are topLeft, top, topRight, left, fill, right,
//   bottomLeft, bottom, bottomRight - all 22x22 in the shipping data,
//   which is why the box rounds to a multiple of 22. Corners draw
//   once; edges and fill TILE (Panel.cs:243-330 draws them with
//   repeating tex coords - here an exact integer repeat, because the
//   box size is a multiple of the slice).
// - margins are 10 on every side (SetDaggerfallPopupStyle:931).
// - the label is centred horizontally and MIDDLE vertically in the
//   panel; rows advance by the font's glyph height, MultiFormat-
//   TextLabel's rowLeading being 0 (MultiFormatTextLabel.cs:33,259).
// - buttons are BUTTONS.RCI records INDEXED BY THE ENUM VALUE
//   (DaggerfallMessageBox.cs:67-90, 369-371), 32x16, laid left to
//   right with buttonSpacing 32, the strip centred.
// - the sizing law (UpdatePanelSizes, :506-570): adding buttons grows
//   the label block by the button height + buttonTextDistance 4 ONCE
//   (the `finalSize.y - buttonPanel.Size.y > 0` gate only passes on
//   the first button); width = max(buttonStripWidth, labelWidth) +
//   both margins, floored at minBoxWidth 132; height = labelBlock +
//   both margins; each is then rounded UP to a multiple of 22, or set
//   to 44 if it was under 44.
// - the button strip sits at panelH - (panelH - labelH)/2 -
//   stripH - bottomMargin, PLUS 11 when there is exactly one button
//   ("HACK: Lower vertical position if only a single button so that
//   it aligns like two or more buttons" - :544-550, verbatim quirk).
//
// ROAD-A7 closed this file's note. Both halves are here now:
//
// - THE SCROLLING VARIANT (:461-470, :571-590). EnableVerticalScrolling
//   sets MultiFormatTextLabel.MaxTextHeight, which CAPS the label's
//   Size.y (:393-396) while leaving ActualTextHeight at its full
//   measure - and the box is sized off the CAPPED one, so a long
//   record no longer grows the parchment off the screen. When
//   ActualTextHeight passes MaxTextHeight the bar turns on: 8 wide,
//   Right/Top in the panel, TotalUnits = ActualTextHeight + 1 and
//   DisplayUnits = MaxTextHeight + 9 - a PIXEL-wise scroll, not a row
//   one, which is why ScrollBar_OnScroll moves the labels by the
//   index DELTA (:668-673) and the wheel steps SIX pixels (:675-682).
//   The clipping is RestrictedRenderArea against scrollingPanel, the
//   scissor bracket the chargen question scroll already uses.
// - THE IMAGE PANEL (:527-534, :555). A painting's texture makes the
//   box taller by exactly the image, moves the label to
//   VerticalAlignment.Bottom, and - through the `finalSize.y -
//   buttonPanel.Size.y > 0` gate at :537, which the image height alone
//   is enough to open - grows the label block by buttonTextDistance
//   even with no buttons at all. That +4 is not decoration; it is the
//   gate firing on a message box that has no buttons.
//
// ActualTextHeight is `totalHeight + lastLabel.TextHeight` computed on
// the LAST label (:389), so it measures one row MORE than the text
// really is. Verbatim: it is what the scroll range is built from.
//
// WHO CALLS THE SCROLLING VARIANT: in DFU, exactly one caller -
// SaveLoadManager's mod-mismatch box (:497, EnableVerticalScrolling
// (80)) - which is a mod-loading screen this port has no equivalent
// of. So the variant ships here as the capability the box is supposed
// to HAVE, off by default (maxTextHeight 0 is every existing caller),
// and the first port window that needs to show more text than a
// parchment holds turns it on with one option rather than growing the
// box off the screen the way this file used to.

import { CifRciFile } from '../formats/cifRciFile.js';
import { RSC, TOKEN_TEXT } from '../formats/textRsc.js';
import { bitmapToColor32 } from './hud.js';
import { drawText, measureText } from './text.js';
import { shadowText } from './nativePanel.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
import { clampScrollIndex, thumbSpan, drawScrollThumb } from './verticalScrollBar.js';

/** MessageBoxButtons (DaggerfallMessageBox.cs:67-90) - the value IS
 *  the BUTTONS.RCI record. */
export const MB_BUTTONS = Object.freeze({
  Accept: 0, Reject: 1, Cancel: 2, Yes: 3, No: 4, OK: 5,
  Male: 6, Female: 7, Add: 8, Delete: 9, Edit: 10, Counter: 11,
  _12MON: 12, _36MON: 13, Copy: 14, Guilty: 15, NotGuilty: 16,
  Debate: 17, Lie: 18, Anchor: 19, Teleport: 20,
});

export const SLICE = 22;              // SPOP.RCI record size
export const MARGIN = 10;             // SetDaggerfallPopupStyle:931
export const MIN_BOX_WIDTH = 132;     // minBoxWidth :30
export const MIN_BOX_SIDE = 44;       // the `minimum` in UpdatePanelSizes
export const BUTTON_W = 32, BUTTON_H = 16;   // BUTTONS.RCI records
export const BUTTON_SPACING = 32;     // :39
export const BUTTON_TEXT_DISTANCE = 4;// :40
export const SINGLE_BUTTON_NUDGE = 11;// the :546-548 quirk
/** GetScrollingPanelHeight (:603-606) - MaxTextHeight plus NINE. */
export const SCROLL_PANEL_PAD = 9;
/** scrollBar.Size = new Vector2(8, ...) (:577). */
export const SCROLL_BAR_W = 8;
/** ScrollingPanel_OnMouseScrollUp/Down (:675-682) - SIX pixels. */
export const SCROLL_WHEEL_STEP = 6;
/** ROAD-Ar R14 - THE IMAGE PANEL SITS AT THE TOP MARGIN, AND THE
 *  WINDOW'S Position (0,5) IS DEAD BY DRAW TIME.
 *
 *  DaggerfallInventoryWindow's painting arm (:1622-1625) does set
 *  `ImagePanel.VerticalAlignment = None; Position = (0,5)` - but it
 *  sets BackgroundTexture at :1625 and then calls Show() at :1627, and
 *  Show (DaggerfallMessageBox.cs:295-301) runs UpdatePanelSizes()
 *  before PushWindow. That method's image arm (:528-534) fires on
 *  `BackgroundTexture != null` and reassigns
 *  `imagePanel.VerticalAlignment = VerticalAlignment.Top` (the same
 *  value Setup :249-250 gave it); nothing restores None. Under Top,
 *  BaseScreenComponent's rectangle getter ASSIGNS
 *  `rectangle.y = parentRect.yMin + Parent.TopMargin * parentScale.y`
 *  (:1228-1230) over the earlier `rectangle.y += position.y` (:1200),
 *  so Position.y is discarded - only the `None` arm (:1225-1227) ever
 *  adds it. TopMargin is 10 (DaggerfallUI.cs:931 SetMargins(All, 10)),
 *  which is this file's MARGIN. So the painting's y is `y + MARGIN`
 *  flat, and the 5 the port carried pushed it into the first text row
 *  whenever the 22-px slice rounding left under five pixels of slack. */

let _art = null;   // { slices: tex[9], buttons: Map<record, tex> }

export async function preloadMessageBoxArt({ renderer, fetchBytes, palette }) {
  if (_art) return;
  try {
    const load = async (name) => {
      const cif = new CifRciFile();
      cif.load(await fetchBytes(name), name, palette);
      return cif;
    };
    const spop = await load('SPOP.RCI');
    const slices = [];
    for (let i = 0; i < 9; i++) {
      slices.push(renderer.uploadTexture('img', `spop:${i}`, bitmapToColor32(spop.getDFBitmap(i, 0), palette)));
    }
    const btnCif = await load('BUTTONS.RCI');
    _art = { slices, btnCif, palette, renderer, buttons: new Map() };
  } catch (e) { console.warn('[messagebox] SPOP.RCI/BUTTONS.RCI unavailable; boxes keep the flat panel', e); }
}
export const messageBoxArtLoaded = () => !!_art;

/** Lazily upload one BUTTONS.RCI record (they are warmed on use, the
 *  icon-drawer shape - most of the 21 never appear in a session). */
function buttonTex(record) {
  if (!_art) return null;
  let t = _art.buttons.get(record);
  if (t === undefined) {
    try {
      t = _art.renderer.uploadTexture('img', `buttons:${record}`, bitmapToColor32(_art.btnCif.getDFBitmap(record, 0), _art.palette));
    } catch { t = null; }
    _art.buttons.set(record, t);
  }
  return t;
}

const roundUpSlice = (v) => (v > MIN_BOX_SIDE ? Math.ceil(v / SLICE) * SLICE : MIN_BOX_SIDE);

/** MultiFormatTextLabel.LayoutTextElements (:316-378) over a TOKEN
 *  array - linesById's row law, but starting from tokens a caller
 *  already holds rather than from record bytes. TEXT tokens APPEND to
 *  the row being built (AddTextLabel advances cursorX, :247); NewLine
 *  (0x00, which is also NewLineOffset) and JustifyLeft (0xfc) close
 *  the row; JustifyCenter (0xfd) closes it AND centres it, because it
 *  reaches back and stamps HorizontalAlignment.Center on `lastLabel`
 *  (:342-344) - the row it has just finished. Everything else
 *  (PositionPrefix's tab, FontPrefix, the cursor positioner, the
 *  record terminator) moves no row, exactly as the switch's remaining
 *  arms do not.
 *
 *  No trimming: linesById drops trailing empties because a record's
 *  bytes always end in break bytes, and a caller composing its own
 *  token list (PlayerActivate's bulletin board, :709-736) means every
 *  row it wrote. */
export function tokenRows(tokens) {
  const rows = [];
  let cur = '';
  for (const token of tokens ?? []) {
    const f = token?.formatting;
    if (f === RSC.NewLine || f === RSC.JustifyLeft || f === RSC.JustifyCenter) {
      rows.push({ text: cur, center: f === RSC.JustifyCenter });
      cur = '';
      continue;
    }
    if (f === TOKEN_TEXT) cur += token.text ?? '';
  }
  if (cur) rows.push({ text: cur, center: false });
  return rows;
}

/** Rows may arrive as plain strings or as TextRsc.linesById's
 *  { text, center } records. AUDIT 17g F2: a plain string CENTRES,
 *  which is what a caller composing its own prompt wants, but a row
 *  that came from TEXT.RSC carries the record's own alignment - and
 *  53 multi-row records are entirely LEFT while 27 mix the two, so
 *  centring everything drew 80 of 676 of them wrong. */
const normalizeRows = (lines) =>
  (lines ?? []).map((l) => (typeof l === 'string' ? { text: l, center: true } : { text: l.text ?? '', center: l.center !== false }));

/** UpdatePanelSizes verbatim. `lines` are the already-wrapped rows the
 *  caller draws (strings, or { text, center } from linesById);
 *  `buttons` are MB_BUTTONS values. Returns everything the draw and
 *  the hit test need, in VIRTUAL (320x200) pixels. */
export function layoutMessageBox(font, lines, buttons = [], {
  sizingRows = null, maxTextHeight = 0, image = null, scrollIndex = 0,
} = {}) {
  const rowH = font?.fnt?.fixedHeight ?? 6;         // rowLeading 0
  const rows = normalizeRows(lines);
  // AUDIT 17g F4: an input box re-measured its own live entry every
  // frame, so the parchment GREW A SLICE as the player typed past a
  // 22px boundary. `sizingRows` measures the widest the content can
  // get (DaggerfallInputMessageBox's field is fixed at maxCharacters)
  // while the real rows are what draws.
  const measured = sizingRows ? normalizeRows(sizingRows) : rows;
  const textW = measured.length ? Math.max(...measured.map((r) => measureText(font.fnt, r.text))) : 0;
  const rowCount = Math.max(rows.length, measured.length);
  // MultiFormatTextLabel.RefreshLayout (:381-396): totalHeight is the
  // last row's bottom, CAPPED at MaxTextHeight, while actualTextHeight
  // keeps the uncapped measure - plus one extra row, because :389
  // adds lastLabel.TextHeight to a totalHeight that already includes
  // it. That over-count is DFU's, and the scroll range is built on it.
  const fullTextH = rowCount * rowH;
  const actualTextHeight = rowCount ? fullTextH + rowH : 0;
  const textH = (maxTextHeight > 0 && fullTextH > maxTextHeight) ? maxTextHeight : fullTextH;
  // the strip: n buttons of 32 with 32 between them
  const stripW = buttons.length ? buttons.length * BUTTON_W + (buttons.length - 1) * BUTTON_SPACING : 0;
  const stripH = buttons.length ? BUTTON_H : 0;
  // UpdatePanelSizes :527-538, in DFU's own order: the image height
  // joins finalSize.y BEFORE the `> 0` gate, and is then subtracted
  // back out of the label's growth - so an image with no buttons still
  // opens the gate and the label block still grows by the 4px gap.
  const imageH = image ? (image.height ?? 0) : 0;
  const imageW = image ? (image.width ?? 0) : 0;
  const finalY = stripH + imageH;
  const labelH = textH + (finalY > 0 ? finalY - imageH + BUTTON_TEXT_DISTANCE : 0);

  let w = Math.max(stripW, textW) + MARGIN * 2;
  if (w < MIN_BOX_WIDTH) w = MIN_BOX_WIDTH;
  w = roundUpSlice(w);
  // :555 - the image's height is part of the PANEL's height, not of
  // the label block's.
  const h = roundUpSlice(labelH + imageH + MARGIN * 2);

  // messagePanel is Center/Middle on the 320x200 native panel
  const x = Math.round((320 - w) / 2), y = Math.round((200 - h) / 2);
  // the label is Center/Middle INSIDE the panel - except with an image,
  // where :533 moves it to VerticalAlignment.Bottom
  // (BaseScreenComponent.cs:1231-1232: yMax - BottomMargin - height).
  const textY = imageH ? y + h - MARGIN - labelH : y + Math.round((h - labelH) / 2);
  let stripY = 0;
  if (buttons.length) {
    // The verbatim placement (:544-550), single-button HACK included.
    stripY = y + h - Math.round((h - labelH) / 2) - stripH - MARGIN;
    if (buttons.length === 1) stripY += SINGLE_BUTTON_NUDGE;
    // ...and the CLAMP the port needs. DFU computes this from
    // messagePanel.Size.y, which at that moment still holds the height
    // from the PREVIOUS UpdatePanelSizes call - the panel is resized
    // three lines later. The result lands 6px above the text's last
    // row even though the label block reserved exactly stripH + 4
    // beneath it, so a long final line (the race descriptions all end
    // with one) has the buttons punched through it. Eyeballed: "Is
    // your [YES]ter to [NO]Redguard?". The reservation is the intent -
    // 4px under the text is where 16px of button exactly fills it -
    // so the strip never rides higher than that. A DELIBERATE
    // DEPARTURE, recorded in Port-Ledger.md section A (the row at
    // :119) - a DFU layout bug the port chose not to be bug-for-bug
    // about - and the only one in this file.
    stripY = Math.max(stripY, textY + textH + BUTTON_TEXT_DISTANCE);
  }
  const stripX = x + Math.round((w - stripW) / 2);
  const rects = buttons.map((b, i) => ({
    button: b,
    rect: [stripX + i * (BUTTON_W + BUTTON_SPACING), stripY, BUTTON_W, BUTTON_H],
  }));
  // ── the SCROLLING variant (:571-590) ────────────────────────────
  // The bar turns on only when the label really overflows; when it
  // does the panel is scrollingPanel's, its own DisplayUnits, and the
  // range is TotalUnits = ActualTextHeight + 1. Everything here is in
  // PIXELS, not rows.
  const scrollPanelH = maxTextHeight + SCROLL_PANEL_PAD;
  const scrolling = maxTextHeight > 0 && actualTextHeight > maxTextHeight;
  let scroll = null;
  if (scrolling) {
    const total = actualTextHeight + 1;
    const index = clampScrollIndex(scrollIndex, total, scrollPanelH);
    scroll = {
      index, totalUnits: total, displayUnits: scrollPanelH,
      // scrollingPanel: Center/Top, Size (label.Size.x, panelH) (:575)
      panel: [x + Math.round((w - textW) / 2), y + MARGIN, textW, scrollPanelH],
      // scrollBar: Right/Top, Size (8, panelH) (:577)
      bar: [x + w - MARGIN - SCROLL_BAR_W, y + MARGIN, SCROLL_BAR_W, scrollPanelH],
    };
    scroll.thumb = thumbSpan(scrollPanelH, total, scrollPanelH, index);
  }
  // The ImagePanel's rect: Setup's Center horizontal alignment over
  // UpdatePanelSizes' VerticalAlignment.Top, i.e. the top MARGIN. See
  // the R14 note above for why the window's Position (0,5) is not here.
  const imageRect = imageH
    ? [x + Math.round((w - imageW) / 2), y + MARGIN, imageW, imageH]
    : null;
  return {
    x, y, w, h, textY, textW, textH, rowH, rows, buttons: rects,
    actualTextHeight, maxTextHeight, scroll, image: imageRect,
  };
}

/** ScrollingPanel_OnMouseScrollUp/Down (:675-682): SIX pixels a notch,
 *  through SetScrollIndex's clamp. Answers the new index; a box with
 *  no bar answers 0, because there is nowhere to scroll to. */
export function messageBoxWheel(box, dir) {
  if (!box?.scroll || !dir) return box?.scroll?.index ?? 0;
  return clampScrollIndex(box.scroll.index + Math.sign(dir) * SCROLL_WHEEL_STEP,
    box.scroll.totalUnits, box.scroll.displayUnits);
}

/** Draw the nine-slice frame. Corners once, edges and fill tiled -
 *  an exact integer repeat, the box being a multiple of the slice. */
function drawFrame(renderer, m, box) {
  const [TL, T, TR, L, F, R, BL, B, BR] = _art.slices;
  const at = (tex, x, y) => renderer.drawScreenQuad(tex,
    { x: m.ox + x * m.s, y: m.oy + y * m.s, w: SLICE * m.s, h: SLICE * m.s });
  const { x, y, w, h } = box;
  const cols = (w - SLICE * 2) / SLICE, rows = (h - SLICE * 2) / SLICE;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) at(F, x + SLICE + c * SLICE, y + SLICE + r * SLICE);
  for (let c = 0; c < cols; c++) { at(T, x + SLICE + c * SLICE, y); at(B, x + SLICE + c * SLICE, y + h - SLICE); }
  for (let r = 0; r < rows; r++) { at(L, x, y + SLICE + r * SLICE); at(R, x + w - SLICE, y + SLICE + r * SLICE); }
  at(TL, x, y); at(TR, x + w - SLICE, y);
  at(BL, x, y + h - SLICE); at(BR, x + w - SLICE, y + h - SLICE);
}

/** Draw a laid-out box. Returns false when the art is not up, so the
 *  caller keeps its flat-panel fallback. */
export function drawMessageBox(renderer, m, font, box, { textColor = undefined, image = null } = {}) {
  if (!_art || !font) return false;
  drawFrame(renderer, m, box);
  // The IMAGE PANEL, under the label - the paintings' arm. It draws
  // BEFORE the text because messagePanel's children go down in Setup
  // order and the label is added first (:243, :249).
  if (image && box.image) {
    const [ix, iy, iw, ih] = box.image;
    renderer.drawScreenQuad(image, { x: m.ox + ix * m.s, y: m.oy + iy * m.s, w: iw * m.s, h: ih * m.s });
  }
  // the LABEL BOX is textW wide, centred in the panel; a centred row
  // centres inside the panel, a left row starts at the label box's
  // left edge (MultiFormatTextLabel.cs:341-344 sets HorizontalAlignment
  // .Center on JustifyCenter rows ONLY)
  const labelX = box.x + Math.round((box.w - box.textW) / 2);
  // StartClippingScrollingText (:592-597): the label's render area is
  // the scrollingPanel, and ChangeScrollPosition (:668-673) walks the
  // rows by the scroll index. Rows wholly outside skip; a row across
  // the boundary draws and the scissor shears it, the chargen
  // question-scroll bracket's shape.
  const clip = box.scroll?.panel ?? null;
  const dy = box.scroll ? box.scroll.index : 0;
  if (clip) renderer.setScreenScissor(m.ox + clip[0] * m.s, m.oy + clip[1] * m.s, clip[2] * m.s, clip[3] * m.s);
  box.rows.forEach((r, i) => {
    const lw = measureText(font.fnt, r.text);
    const rx = r.center ? box.x + Math.round((box.w - lw) / 2) : labelX;
    const ry = box.textY + i * box.rowH - dy;
    if (clip && (ry + box.rowH <= clip[1] || ry >= clip[1] + clip[3])) return;
    shadowText(renderer, font, r.text, m, rx, ry, { color: textColor });
  });
  if (clip) renderer.clearScreenScissor();
  if (box.scroll) drawScrollThumb(renderer, m, box.scroll.bar, box.scroll.thumb);
  for (const b of box.buttons) {
    const tex = buttonTex(b.button);
    if (!tex) continue;
    renderer.drawScreenQuad(tex, { x: m.ox + b.rect[0] * m.s, y: m.oy + b.rect[1] * m.s, w: b.rect[2] * m.s, h: b.rect[3] * m.s });
  }
  return true;
}

/** A native point -> the MB_BUTTONS value it hit, or null. Every hit
 *  clicks: DaggerfallMessageBox.ButtonClickHandler (:487) plays
 *  SoundClips.ButtonClick for every popup button, and this is the one
 *  place all of the port's box clicks route through. */
export function messageBoxHit(box, vx, vy) {
  for (const b of box.buttons) {
    const [bx, by, bw, bh] = b.rect;
    if (vx >= bx && vy >= by && vx < bx + bw && vy < by + bh) {
      audio.playOneShot(SOUND.ButtonClick, 1);
      return b.button;
    }
  }
  return null;
}
