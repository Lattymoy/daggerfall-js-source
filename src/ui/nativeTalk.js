// U8b: the NATIVE TALK WINDOW - real TALK01I0.IMG on the 320x200
// panel (DFU DaggerfallTalkWindow geometry, MIT Daggerfall
// Workshop). The button labels are BAKED in the art; DFU overlays
// invisible hit rects - so do we, through pointToNative. The window
// replaces the interim ChoiceWindow talk chain when the art is
// loaded; art-less sessions keep the old chain (never trap).
//
// Verbatim geometry (DaggerfallTalkWindow.cs):
//   buttons (x4, w107, h10): Tell me about y4 / Where is y14 /
//   Location y26 / People y36 / Things y46 / Work y56;
//   Okay (4,186,107,10); Goodbye (118,183,67,10);
//   topic list (6,71) 94x104; conversation (189,65) 114x126;
//   player-says label (123,8) 124x38; NPC name (117,52) 197x10;
//   portrait (119,65) 64x64 (TFAC faces PEND - the art's frame
//   shows); tone radios (258, 18/28/38) 6x6 - the selection marker is
//   panelTone, a flat 6x6 toggleColor (162,36,12) fill moved between
//   those three positions by UpdateCheckboxes (:916-930); no art is
//   involved.
//   Topic scroll arrows: up (102,69,9,16) down (102,161,9,16), each
//   worth +/-5 PIXELS of scroll (ButtonTopicUp/Down_OnMouseClick,
//   :1418-1428) - both listboxes are VerticalScrollModes.PixelWise,
//   so the scroll index is a pixel offset, never a row count.
//
// Interaction: clicks/taps through the hit rects (the phone path),
// with the session's keyboard accelerators preserved - W opens
// Where-is > Location, T cycles tone, digits pick visible rows,
// N/P page (OURS: DFU has no keyboard scroll here, so they step a
// full listbox height), Esc/E goodbye. B5-6: Tell me about, People,
// Things and Work are LIVE pages over the engine's own lists
// (listTopicTellMeAbout / Person / Thing and the Work question);
// each stays a consumed no-op on a host with no engine mounted.

import { loadImg, nativeMetrics, drawImg, drawRect, shadowText, pointToNative, DEFAULT_TEXT_COLOR } from './nativePanel.js';
import { drawScreenDimBackdrop } from './chargenArt.js';
import { wrapText } from './talkWindow.js';
import { measureText } from './text.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';

export const TALK_RECTS = Object.freeze({
  tellMeAbout: [4, 4, 107, 10],
  whereIs: [4, 14, 107, 10],
  categoryLocation: [4, 26, 107, 10],
  categoryPeople: [4, 36, 107, 10],
  categoryThings: [4, 46, 107, 10],
  categoryWork: [4, 56, 107, 10],
  okay: [4, 186, 107, 10],
  goodbye: [118, 183, 67, 10],
  topicList: [6, 71, 94, 104],
  conversation: [189, 65, 114, 126],
  npcName: [117, 52, 197, 10],
  tonePolite: [258, 18, 6, 6],
  toneNormal: [258, 28, 6, 6],
  toneBlunt: [258, 38, 6, 6],
  topicUp: [102, 69, 9, 16],
  // F159: rectButtonConversationUp/Down (:226-227) - the port had no
  // conversation arrows at all.
  conversationUp: [303, 64, 9, 16],
  conversationDown: [303, 176, 9, 16],
  topicDown: [102, 161, 9, 16],
});
// ListBox verbatim (the 17d UI audit): row height = FONT0003's
// fixedHeight 7 + RowSpacing (topic 0, conversation 4); the NPC
// name label centres in its 197-wide panel; questions render light
// blue (0.698,0.812,1) in the PLAYER-SAYS panel (123,8,124,38),
// answers land in the conversation in DaggerfallAnswerTextColor
// (227,223,0).
export const TOPIC_ROW_H = 7;                    // FONT0003 fixedHeight + spacing 0
export const ROW_H = 7;                          // FONT0003 fixedHeight
export const ROW_SPACING = 4;                    // ListBox RowSpacing, per ITEM
export const CONV_LINE_H = ROW_H + ROW_SPACING;  // kept: one single-line entry to the next
export const SELECTED_TEXT_COLOR = [0.98, 0.98, 0.98, 1];   // DaggerfallUI selectedTextColor (the newest row)
// AUDIT 17e F19: DFU's PixelWise ListBox DRAWS the partially-clipped
// last row (104/7 = 14.857 -> 15 rows, the last one cut) and its hit
// test selects it. AUDIT 18 folded that law into layoutPixelRows -
// a row is dropped only when it falls WHOLLY outside the band - so
// this count is now descriptive (the visible-row ceiling at scroll 0)
// rather than a slice bound; do NOT clamp the click to it.
export const TOPIC_ROWS = Math.ceil(TALK_RECTS.topicList[3] / TOPIC_ROW_H);
export const QUESTION_COLOR = [0.698, 0.812, 1, 1];      // DaggerfallQuestionTextColor
export const ANSWER_COLOR = [227 / 255, 223 / 255, 0, 1];   // DaggerfallAnswerTextColor
export const PLAYER_SAYS_RECT = Object.freeze([123, 8, 124, 38]);
export const TALK_TOGGLE_COLOR = [162 / 255, 36 / 255, 12 / 255, 1];   // DaggerfallTalkWindow.toggleColor
export const TOPIC_ARROW_SCROLL = 5;   // ButtonTopicUp/Down_OnMouseClick: ScrollIndex -/+= 5
/** ButtonConversationUp/Down_OnMouseClick (:1442-1452): 5 pixels. */
export const CONVERSATION_ARROW_SCROLL = 5;

/** VerticalScrollBar.SetScrollIndex (VerticalScrollBar.cs:187-198):
 *  clamp to [0, max(0, totalUnits - displayUnits)]. */
export const clampScrollPixels = (px, contentH, panelH) =>
  Math.max(0, Math.min(Math.max(0, contentH - panelH), px));

/** ListBox.Draw's PixelWise branch (ListBox.cs:329-355): rows lay
 *  out from the listbox origin at y = -scrollIndex, striding
 *  TextHeight + rowSpacing, and a row is skipped only when it falls
 *  wholly outside the panel band. Returns [{ index, y }] for the rows
 *  DFU would draw. */
export function layoutPixelRows(heights, scrollPx, panelH, rowSpacing = 0) {
  const out = [];
  let y = scrollPx ? -scrollPx : 0;
  for (let i = 0; i < heights.length; i++) {
    if (!(y + heights[i] < 0 || y >= panelH)) out.push({ index: i, y });
    y += heights[i] + rowSpacing;
  }
  return out;
}

/** UpdateScrollBarConversation (DaggerfallTalkWindow.cs:820-828):
 *  ScrollIndex = HeightContent() - Size.y, floored at 0 by
 *  SetScrollIndex - so a conversation shorter than the panel sits at
 *  the TOP, and a long one is pinned to its last row. */
export const conversationScroll = (contentH, panelH) => Math.max(0, contentH - panelH);

let _art = null;
export async function preloadTalkArt(deps) {
  if (_art) return;
  try { _art = await loadImg(deps, 'TALK01I0.IMG'); }
  catch { console.warn('[talk] TALK01I0.IMG unavailable; the text talk chain stands in'); }
}
export const talkArtLoaded = () => !!_art;

const inRect = ([rx, ry, rw, rh], x, y) => x >= rx && y >= ry && x < rx + rw && y < ry + rh;

/** The session seam: hooks = { categories() -> [{label, buildings}],
 *  answer(building) -> string, tone() -> 0|1|2, setTone(t),
 *  onClose() }. The conversation panel keeps the session history. */
export class NativeTalkWindow {
  constructor(greeting, hooks) {
    this.hooks = hooks;
    this.done = false;
    this.isChoiceWindow = true;      // raw codes through townTalk
    this.conversation = [greeting];  // classic: answers append here
    this.topics = [];                // current list rows
    this.topicMode = 'none';         // none | categories | buildings | topics | work
    this.scroll = 0;
    // F159: the conversation's PERSISTENT scroll -
    // verticalScrollBarConversation.ScrollIndex. null = pin to the
    // newest row at the next draw, which is UpdateScrollBarConversation
    // (:820-828) run from the content-changing sites, NOT every frame;
    // the old draw() recomputed the pin per frame, so the player could
    // never read back up.
    this.conversationScroll = null;
    this._conversationContentH = 0;
    this._mouse = [0, 0];            // for the wheel's per-panel routing
    this._category = null;
    // MERGE (the S-A lane's shape): selectedTalkCategory persists -
    // SetTalkModeWhereIs re-runs SetTalkCategory(selectedTalkCategory)
    // (:960-971), so Where-is after a People/Things/Work visit returns
    // to THAT page, not to Location. Location is the C# default arm.
    this._lastCategory = 'location';
    // selectedTalkOption (DaggerfallTalkWindow.cs:335-357). It is not
    // cosmetic: all four CATEGORY handlers open with
    // `if (selectedTalkOption == TalkOption.WhereIs)` and play the
    // click sound INSIDE that gate (:1465-1498), so while
    // Tell-me-about is selected the greyed-out category buttons do
    // nothing AND make no sound. The window still swallows the click.
    this._talkOption = 'whereIs';
  }

  _openCategories() {
    this.topics = this.hooks.categories();
    this.topicMode = 'categories';
    this.scroll = 0;
  }
  /** B5-6: the OTHER pages. Tell me about (SetTalkModeTellMeAbout,
   *  DaggerfallTalkWindow.cs:935-958: ListTopicTellMeAbout, a FLAT
   *  list - Any news, Where am I, org info, quest topics), People
   *  (SetTalkCategoryPeople :1039-1060: ListTopicPerson, flat, often
   *  empty), Things (SetTalkCategoryThings: ListTopicThings, EMPTY -
   *  classic never implemented it, the port's tree is verbatim), and
   *  Work (SetTalkCategoryWork :1079-1101: NO list - the question
   *  goes straight to the player-says panel and OKAY asks it,
   *  ButtonOkay_OnMouseClick :1534-1543). A page with no hook mounted
   *  (the pre-engine fallback host) stays the old no-op. */
  _openFlat(rows) {
    if (!rows) return false;
    this.topics = rows;
    this.topicMode = 'topics';
    this.scroll = 0;
    return true;
  }
  _openWork() {
    const q = this.hooks.workQuestion?.();
    if (q == null) return false;
    this.topics = [];
    this.topicMode = 'work';
    this.scroll = 0;
    this.question = q;   // the player-says panel shows it; OKAY asks
    return true;
  }
  /** SetTalkModeWhereIs (:960-971) -> SetTalkCategory(selected). */
  _reopenCategory() {
    if (this._lastCategory === 'people' && this._openFlat(this.hooks.peopleTopics?.())) return;
    if (this._lastCategory === 'things' && this._openFlat(this.hooks.thingsTopics?.())) return;
    if (this._lastCategory === 'work' && this._openWork()) return;
    this._openCategories();   // the C# default arm
  }
  _askWork() {
    if (this.topicMode !== 'work' || !this.hooks.askWork) return;
    this.conversation.push({ text: this.question, kind: 'question' });
    this.conversation.push({ text: this.hooks.askWork(), kind: 'answer' });
    this.conversationScroll = null;   // F159: UpdateScrollBarConversation on new content
  }
  /** The index of the first row ListBox.Draw renders at this pixel
   *  scroll - what the port's digit accelerators address. */
  _firstVisible() { return Math.max(0, Math.ceil(this.scroll / TOPIC_ROW_H) - 1); }
  _pick(i) { this._pickIndex(this._firstVisible() + i); }
  _pickIndex(idx) {
    const it = this.topics[idx];
    if (!it) return;
    if (this.topicMode === 'categories') {
      this._category = it;
      this.topics = it.buildings;
      this.topicMode = 'buildings';
      this.scroll = 0;
    } else if (this.topicMode === 'buildings' || this.topicMode === 'topics') {
      // AUDIT 17e F13: the question is a TEXT.RSC record chosen by
      // tone, not an English literal. F-addendum: DFU pushes the
      // question/answer PAIR into the conversation
      // (SetQuestionAnswerPairInConversationListbox) - the question
      // was only ever shown in the player-says panel here.
      // B5-6: the flat pages (Tell me about, People) ask through the
      // SAME pair - their rows carry listItems and the hooks already
      // speak them.
      this.question = this.hooks.question?.(it) ?? `Where is ${it.label ?? it.name}?`;
      this.conversation.push({ text: this.question, kind: 'question' });
      this.conversation.push({ text: this.hooks.answer(it), kind: 'answer' });
      this.conversationScroll = null;   // F159
    }
  }
  /** VerticalScrollBar.ScrollIndex +/- dPx, clamped. */
  /** F159: the conversation twin of _scrollBy - the clamp is
   *  SetScrollIndex against the content measured at the last draw. */
  _scrollConversationBy(dPx) {
    const pinned = conversationScroll(this._conversationContentH, TALK_RECTS.conversation[3]);
    const cur = this.conversationScroll ?? pinned;
    this.conversationScroll = clampScrollPixels(cur + dPx, this._conversationContentH, TALK_RECTS.conversation[3]);
  }

  /** F159: the wheel - ListBox.MouseScrollUp/Down fire per COMPONENT
   *  in DFU (:514-526), one unit (= one pixel, PixelWise) per notch;
   *  the port routes by the cursor's panel. hover() feeds it. */
  hover(vx, vy) { this._mouse = [vx, vy]; }
  wheel(dir) {
    if (!dir) return;
    const [vx, vy] = this._mouse;
    if (inRect(TALK_RECTS.conversation, vx, vy)) this._scrollConversationBy(Math.sign(dir));
    else if (inRect(TALK_RECTS.topicList, vx, vy)) this._scrollBy(Math.sign(dir));
  }

  _scrollBy(dPx) {
    this.scroll = clampScrollPixels(this.scroll + dPx, this.topics.length * TOPIC_ROW_H, TALK_RECTS.topicList[3]);
  }
  _close() { this.done = true; this.hooks.onClose?.(); }

  /** Keyboard accelerators (the session's established keys). */
  input(code) {
    if (code === 'Escape' || code === 'KeyE' || code === 'Enter') { this._close(); return; }
    if (code === 'KeyW') { this._openCategories(); return; }
    if (code === 'KeyT') { this.hooks.setTone((this.hooks.tone() + 1) % 3); return; }
    if (code === 'KeyN') { this._scrollBy(TALK_RECTS.topicList[3]); return; }   // ours: a full page
    if (code === 'KeyP') { this._scrollBy(-TALK_RECTS.topicList[3]); return; }
    const d = /^Digit([1-9])$/.exec(code);
    if (d) this._pick(Number(d[1]) - 1);
  }

  /** Pointer path (phone taps + mouse): virtual-space hit rects. */
  click(vx, vy) {
    const R = TALK_RECTS;
    // AUDIT 17e F12: GOODBYE closes. OKAY is DFU's "ask the selected
    // topic" button (DaggerfallTalkWindow) - it never closed the
    // window. Consumed as a no-op until the highlight/selection model
    // lands with the Tell-me-about slice (FLAGGED).
    // Every talk-window button assigns ButtonClick (DaggerfallTalkWindow
    // :1315-1605); the topic ask itself clicks at the Q&A pair (:1253).
    if (inRect(R.goodbye, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._close(); return true; }
    // B6: OKAY asks the WORK question when the Work page is up
    // (ButtonOkay_OnMouseClick :1534-1543); everywhere else it stays
    // the recorded no-op (the port's one-click-asks idiom has no
    // selected topic for it to ask).
    if (inRect(R.okay, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._askWork(); return true; }
    if (inRect(R.whereIs, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._talkOption = 'whereIs'; this._reopenCategory(); return true; }
    if (inRect(R.categoryLocation, vx, vy)) {
      if (this._talkOption !== 'whereIs') return true;   // greyed out: silent, per the gate above
      audio.playOneShot(SOUND.ButtonClick, 1); this._lastCategory = 'location'; this._openCategories(); return true;
    }
    if (inRect(R.tonePolite, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this.hooks.setTone(0); return true; }
    if (inRect(R.toneNormal, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this.hooks.setTone(1); return true; }
    if (inRect(R.toneBlunt, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this.hooks.setTone(2); return true; }
    if (inRect(R.topicUp, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._scrollBy(-TOPIC_ARROW_SCROLL); return true; }
    if (inRect(R.topicDown, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._scrollBy(TOPIC_ARROW_SCROLL); return true; }
    // F159: the conversation arrows (:1442-1452) - 5 pixels a click.
    if (inRect(R.conversationUp, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._scrollConversationBy(-CONVERSATION_ARROW_SCROLL); return true; }
    if (inRect(R.conversationDown, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._scrollConversationBy(CONVERSATION_ARROW_SCROLL); return true; }
    // ListBox.MouseClick's PixelWise branch: the hit row is found at
    // scrollIndex + clickY, not at the visible-row ordinal.
    if (inRect(R.topicList, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._pickIndex(Math.floor((vy - R.topicList[1] + this.scroll) / TOPIC_ROW_H)); return true; }
    // B5-6: the four pages that were INTERIM no-ops. Each falls back
    // to consuming the click when its hook is absent (the pre-engine
    // host), so an art-only session never half-opens a page.
    if (inRect(R.tellMeAbout, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._talkOption = 'tellMeAbout'; this._openFlat(this.hooks.tellMeAboutTopics?.()); return true; }
    // The three remaining CATEGORY buttons, behind the same gate as
    // Location above - the sound sits inside it, as C# has it.
    if (inRect(R.categoryPeople, vx, vy)) {
      if (this._talkOption !== 'whereIs') return true;
      audio.playOneShot(SOUND.ButtonClick, 1); if (this._openFlat(this.hooks.peopleTopics?.())) this._lastCategory = 'people'; return true;
    }
    if (inRect(R.categoryThings, vx, vy)) {
      if (this._talkOption !== 'whereIs') return true;
      audio.playOneShot(SOUND.ButtonClick, 1); if (this._openFlat(this.hooks.thingsTopics?.())) this._lastCategory = 'things'; return true;
    }
    if (inRect(R.categoryWork, vx, vy)) {
      if (this._talkOption !== 'whereIs') return true;
      audio.playOneShot(SOUND.ButtonClick, 1); if (this._openWork()) this._lastCategory = 'work'; return true;
    }
    return false;
  }

  draw(renderer, canvas, font) {
    if (!_art) { this._close(); return; }   // art gone mid-session: release the motor
    const m = nativeMetrics(canvas);
    // AUDIT 19 F2: OPAQUE BLACK, not a dim. DaggerfallBaseWindow's
    // constructor sets `parentPanel.BackgroundColor = Color.black`
    // (DaggerfallBaseWindow.cs:40) - ScreenDimColor is used only by the
    // handful of windows that explicitly override it, and this is not one.
    // Drawing a 50% dim here left the letterbox showing the world at half
    // brightness around the panel, which is the SAME defect U21 fixed for
    // the menu, U21b for chargen and U22 for the splash. Fourth, fifth and
    // sixth instance; one shared helper now.
    // AUDIT 24 ui: this window's Setup assigns
    // `ParentPanel.BackgroundColor = ScreenDimColor` (DaggerfallTalkWindow.cs:398),
    // which is Color.clear - the letterbox is NOT painted.
    drawScreenDimBackdrop(renderer, canvas);
    drawImg(renderer, _art, m, 0, 0);
    const R = TALK_RECTS;
    // NPC name CENTRED in its 197-wide panel (labelNameNPC
    // HorizontalAlignment.Center; seed-named persons pend - the
    // People faction stands in)
    shadowText(renderer, font, this.hooks.npcName ?? '', m, R.npcName[0], R.npcName[1] + 1, { align: 'center', w: R.npcName[2] });
    // the pending question in the PLAYER-SAYS panel, light blue
    if (this.question) {
      wrapText(font.fnt, this.question, PLAYER_SAYS_RECT[2]).slice(0, Math.floor(PLAYER_SAYS_RECT[3] / TOPIC_ROW_H)).forEach((l, i) =>
        shadowText(renderer, font, l, m, PLAYER_SAYS_RECT[0], PLAYER_SAYS_RECT[1] + i * TOPIC_ROW_H, { color: QUESTION_COLOR }));
    }
    // panelTone: the flat 6x6 toggleColor fill at the active position
    const toneRect = [R.tonePolite, R.toneNormal, R.toneBlunt][this.hooks.tone()];
    drawRect(renderer, m, toneRect[0], toneRect[1], toneRect[2], toneRect[3], TALK_TOGGLE_COLOR);
    // topic rows, truncated to the listbox width (ListBox.AddItem sets
    // MaxWidth = Size.x), laid out at the listbox origin
    const fit = (t, w) => { let s = t; while (s.length > 1 && measureText(font.fnt, s) > w) s = s.slice(0, -1); return s; };
    layoutPixelRows(this.topics.map(() => TOPIC_ROW_H), this.scroll, R.topicList[3]).forEach(({ index, y }) => {
      const it = this.topics[index];
      shadowText(renderer, font, fit(it.label ?? it.name, R.topicList[2]), m, R.topicList[0], R.topicList[1] + y);
    });
    // conversation - AUDIT 17e F11/F18. Two laws were wrong here:
    // (1) RowSpacing 4 is per LIST ITEM, not per wrapped line, so
    //     rows INSIDE one entry sit 7px apart (FONT0003 fixedHeight)
    //     and only the gap BETWEEN entries adds 4 - the port applied
    //     11px to every wrapped line and then pushed a blank row
    //     between entries, doubling the gaps;
    // (2) the whole panel rendered DaggerfallAnswerTextColor. DFU's
    //     ListBox default is the standard text colour, the QUESTION
    //     rows carry DaggerfallQuestionTextColor, and the NEWEST row
    //     is highlighted white (selectedTextColor).
    const entries = [];
    for (const c of this.conversation) {
      const e = typeof c === 'string' ? { text: c, kind: 'answer' } : c;
      entries.push({ lines: wrapText(font.fnt, e.text, R.conversation[2]), kind: e.kind });
    }
    // AUDIT 18: DFU lays the conversation out FORWARD from the listbox
    // origin at y = -scrollIndex, and UpdateScrollBarConversation's
    // HeightContent() - Size.y is floored at 0 - so a short
    // conversation fills from the TOP and only a long one is pinned to
    // its last row. The port anchored every conversation to the bottom.
    const heights = entries.map((e) => e.lines.length * ROW_H);
    const contentH = heights.reduce((a, b) => a + b, 0) + Math.max(0, entries.length - 1) * ROW_SPACING;
    // F159: null = new content since the last draw - pin to the
    // newest row ONCE (UpdateScrollBarConversation), then hold the
    // player's own position between frames.
    this._conversationContentH = contentH;
    if (this.conversationScroll == null) this.conversationScroll = conversationScroll(contentH, R.conversation[3]);
    else this.conversationScroll = clampScrollPixels(this.conversationScroll, contentH, R.conversation[3]);
    const scroll = this.conversationScroll;
    for (const { index, y } of layoutPixelRows(heights, scroll, R.conversation[3], ROW_SPACING)) {
      const e = entries[index];
      const newest = index === entries.length - 1;
      const color = newest ? SELECTED_TEXT_COLOR
        : e.kind === 'question' ? QUESTION_COLOR : DEFAULT_TEXT_COLOR;
      // AUDIT 26 F165: the QUESTION label is placed Right and the
      // ANSWER Left (SetQuestionAnswerPairInConversationListbox
      // :1259, :1270) - the classic look, the player's questions
      // hugging the right margin and the NPC's answers the left. The
      // port drew every line at the panel's left edge. Only the
      // label's PLACEMENT differs; DFU sets HorizontalTextAlignment
      // Left on both, so a wrapped line's own text stays left-run and
      // each row is offset by its OWN width.
      e.lines.forEach((text, j) => {
        const x = e.kind === 'question'
          ? R.conversation[0] + R.conversation[2] - measureText(font.fnt, text)
          : R.conversation[0];
        shadowText(renderer, font, text, m, x, R.conversation[1] + y + j * ROW_H, { color });
      });
    }
  }
}
