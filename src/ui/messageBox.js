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
// FLAGGED: the scrolling variant (a label taller than MaxTextHeight
// gets a scroll bar and clipped rendering, :571-590) is not ported -
// nothing in the port yet feeds a box more text than fits. The image
// panel (paintings) rides the paint overlay, not this.

import { CifRciFile } from '../formats/cifRciFile.js';
import { bitmapToColor32 } from './hud.js';
import { drawText, measureText } from './text.js';
import { shadowText } from './nativePanel.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';

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
export function layoutMessageBox(font, lines, buttons = [], { sizingRows = null } = {}) {
  const rowH = font?.fnt?.fixedHeight ?? 6;         // rowLeading 0
  const rows = normalizeRows(lines);
  // AUDIT 17g F4: an input box re-measured its own live entry every
  // frame, so the parchment GREW A SLICE as the player typed past a
  // 22px boundary. `sizingRows` measures the widest the content can
  // get (DaggerfallInputMessageBox's field is fixed at maxCharacters)
  // while the real rows are what draws.
  const measured = sizingRows ? normalizeRows(sizingRows) : rows;
  const textW = measured.length ? Math.max(...measured.map((r) => measureText(font.fnt, r.text))) : 0;
  const textH = Math.max(rows.length, measured.length) * rowH;
  // the strip: n buttons of 32 with 32 between them
  const stripW = buttons.length ? buttons.length * BUTTON_W + (buttons.length - 1) * BUTTON_SPACING : 0;
  const stripH = buttons.length ? BUTTON_H : 0;
  // the label block grows ONCE by the strip height + the text gap
  const labelH = textH + (buttons.length ? stripH + BUTTON_TEXT_DISTANCE : 0);

  let w = Math.max(stripW, textW) + MARGIN * 2;
  if (w < MIN_BOX_WIDTH) w = MIN_BOX_WIDTH;
  w = roundUpSlice(w);
  const h = roundUpSlice(labelH + MARGIN * 2);

  // messagePanel is Center/Middle on the 320x200 native panel
  const x = Math.round((320 - w) / 2), y = Math.round((200 - h) / 2);
  // the label is Center/Middle INSIDE the panel
  const textY = y + Math.round((h - labelH) / 2);
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
    // so the strip never rides higher than that. FLAGGED as a
    // deliberate departure, the only one in this file.
    stripY = Math.max(stripY, textY + textH + BUTTON_TEXT_DISTANCE);
  }
  const stripX = x + Math.round((w - stripW) / 2);
  const rects = buttons.map((b, i) => ({
    button: b,
    rect: [stripX + i * (BUTTON_W + BUTTON_SPACING), stripY, BUTTON_W, BUTTON_H],
  }));
  return { x, y, w, h, textY, textW, textH, rowH, rows, buttons: rects };
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
export function drawMessageBox(renderer, m, font, box, { textColor = undefined } = {}) {
  if (!_art || !font) return false;
  drawFrame(renderer, m, box);
  // the LABEL BOX is textW wide, centred in the panel; a centred row
  // centres inside the panel, a left row starts at the label box's
  // left edge (MultiFormatTextLabel.cs:341-344 sets HorizontalAlignment
  // .Center on JustifyCenter rows ONLY)
  const labelX = box.x + Math.round((box.w - box.textW) / 2);
  box.rows.forEach((r, i) => {
    const lw = measureText(font.fnt, r.text);
    const rx = r.center ? box.x + Math.round((box.w - lw) / 2) : labelX;
    shadowText(renderer, font, r.text, m, rx, box.textY + i * box.rowH, { color: textColor });
  });
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
