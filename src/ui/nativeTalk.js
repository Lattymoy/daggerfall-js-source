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
//   portrait (119,65) 64x64 (panelPortraitPos/Size :158-159);
//   tone radios (258, 18/28/38) 6x6 - the selection marker is
//   panelTone, a flat 6x6 toggleColor (162,36,12) fill moved between
//   those three positions by UpdateCheckboxes (:916-930); no art is
//   involved.
//   Topic scroll arrows: up (102,69,9,16) down (102,161,9,16), each
//   worth +/-5 PIXELS of scroll (ButtonTopicUp/Down_OnMouseClick,
//   :1418-1428) - both listboxes are VerticalScrollModes.PixelWise,
//   so the scroll index is a pixel offset, never a row count;
//   left (4,177,16,9) right (86,177,16,9) with horizontalSliderTopic
//   (22,178) 62x5 between them (:207-208, :765-767), one pixel a
//   click and a DisplayUnits page on the trough - the topic list is
//   HorizontalScrollModes.PixelWise too, so a long topic PANS.
//
// AUDIT 58 (talk lane): the button labels are baked in TALK01I0, but
// their STATE is not - TALK02I0 (the grayed categories) and TALK03I0
// (the highlighted modes) supply the six 107x10 strips DFU assigns to
// the six buttons on every mode change (:34-35, :436-490, :944-949,
// :967-968, :1022-1088). See TALK_STRIP_SOURCES below.
//
// Interaction: clicks/taps through the hit rects (the phone path).
// ROAD-D D10 shipped the SELECTION model the window is built around:
// a click on a topic row only selects it and fills the player-says
// label (ListBox.MouseClick -> OnSelectItem -> UpdateQuestion,
// :549-550/:1381-1387), a DOUBLE click uses it (MouseDoubleClick ->
// OnUseSelectedItem -> SelectTopicFromTopicList), OKAY asks whatever
// is selected (ButtonOkay_OnMouseClick :1534-1548), and the selected
// row draws in ListBox's selectedTextColor with no shadow. The
// session's keyboard accelerators are preserved - W opens
// Where-is > Location, T cycles tone, digits USE a visible row
// (OURS: DFU has no keyboard here, so one press does both halves),
// N/P page (OURS: DFU has no keyboard scroll here, so they step a
// full listbox height), Esc/E goodbye. B5-6: Tell me about, People,
// Things and Work are LIVE pages over the engine's own lists
// (listTopicTellMeAbout / Person / Thing and the Work question);
// each stays a consumed no-op on a host with no engine mounted.

import { loadImg, nativeMetrics, drawImg, drawImgCrop, drawRect, shadowText, pointToNative, DEFAULT_TEXT_COLOR } from './nativePanel.js';
import { CifRciFile } from '../formats/cifRciFile.js';
import { bitmapToColor32 } from './hud.js';
import { drawScreenDimBackdrop, DOUBLE_CLICK_DELAY_MS } from './chargenArt.js';
import { wrapText } from './talkWindow.js';
import { getBool } from '../systems/settings.js';   // UI6: EnableModernConversationStyleInTalkWindow
import { measureText } from './text.js';
import { sliderThumb } from './horizontalSlider.js';   // ROAD-G G6: HorizontalSlider.cs' one home
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
// AUDIT 58 (seams): the resolvingError literal SetListboxTopics repairs
// an empty caption with (Internal_Strings.csv:582, '...never mind...').
import { RESOLVING_ERROR } from '../systems/rumorMill.js';

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
  // AUDIT 58 (talk lane): the HORIZONTAL pair and the slider between
  // them - rectButtonTopicLeft/Right (:207-208) and
  // horizontalSliderTopic's Position/Size (:766-767). listboxTopic is
  // HorizontalScrollMode.PixelWise with a RectRestrictedRenderArea over
  // its own 94x104 box (:543-546), and in that mode ListBox.cs:556-557
  // sets the row label's MaxWidth to -1: a long topic is CLIPPED by the
  // render area and read by PANNING, never truncated. The port had no
  // rect, no state and no input path for any of the three, and cut each
  // row to the box instead - miscited as "ListBox.AddItem sets MaxWidth
  // = Size.x", which is the CharWise branch this listbox is not.
  topicLeft: [4, 177, 16, 9],
  topicRight: [86, 177, 16, 9],
  topicSlider: [22, 178, 62, 5],
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
/** ROAD-D D10: the TOPIC listbox's selected row. listboxTopic sets no
 *  colour of its own (DaggerfallTalkWindow.cs:535-551), so it keeps
 *  ListBox's default selectedTextColor = DaggerfallUI.cs:62's
 *  DaggerfallDefaultSelectedTextColor (162,36,12) - the same dark red
 *  ui/listPicker.js already draws its selection in. */
export const TOPIC_SELECTED_TEXT_COLOR = [162 / 255, 36 / 255, 12 / 255, 1];
/** DecideTextColor (ListBox.cs:360-380) as this listbox reaches it.
 *  The talk window assigns no highlight colours, so the two hover
 *  arms collapse away and only the SELECTED arm remains - and that
 *  arm hands the label selectedShadowPosition = Vector2.zero (:41),
 *  which TextLabel's zero-position guard turns into no shadow pass at
 *  all (the ui/listPicker.js rowShadowOffset law, same source). */
export const topicRowStyle = (selected) => (selected ? { color: TOPIC_SELECTED_TEXT_COLOR, shadowOffset: 0 } : {});
// AUDIT 17e F19: DFU's PixelWise ListBox DRAWS the partially-clipped
// last row (104/7 = 14.857 -> 15 rows, the last one cut) and its hit
// test selects it. AUDIT 18 folded that law into layoutPixelRows -
// a row is dropped only when it falls WHOLLY outside the band - so
// this count is now descriptive (the visible-row ceiling at scroll 0)
// rather than a slice bound; do NOT clamp the click to it.
export const TOPIC_ROWS = Math.ceil(TALK_RECTS.topicList[3] / TOPIC_ROW_H);
export const QUESTION_COLOR = [0.698, 0.812, 1, 1];      // DaggerfallQuestionTextColor
export const ANSWER_COLOR = [227 / 255, 223 / 255, 0, 1];   // DaggerfallAnswerTextColor
// UI6 - THE MODERN CONVERSATION STYLE (DaggerfallTalkWindow :53-60,
// :645-650, :1262-1267, :1273-1278). With
// EnableModernConversationStyleInTalkWindow the three conversation
// labels - the NPC's greeting, each question and each answer - are
// drawn SMALLER (TextScale 0.8), WRAPPED NARROWER (MaxWidth x 0.75)
// and on their own BACKGROUND BLOCK, one colour for questions and one
// for answers. Ships False; the classic path above is unchanged.
export const MODERN_TEXT_SCALE = 0.8;              // :59
export const MODERN_BLOCK_SIZE = 0.75;             // :60
export const MODERN_QUESTION_BG = [0.3, 0.35, 0.43, 1];    // :53
export const MODERN_ANSWER_BG = [0.32, 0.31, 0.06, 1];     // :54
export const PLAYER_SAYS_RECT = Object.freeze([123, 8, 124, 38]);
export const TALK_TOGGLE_COLOR = [162 / 255, 36 / 255, 12 / 255, 1];   // DaggerfallTalkWindow.toggleColor
export const TOPIC_ARROW_SCROLL = 5;   // ButtonTopicUp/Down_OnMouseClick: ScrollIndex -/+= 5
/** ButtonConversationUp/Down_OnMouseClick (:1442-1452): 5 pixels. */
export const CONVERSATION_ARROW_SCROLL = 5;

/** VerticalScrollBar.SetScrollIndex (VerticalScrollBar.cs:187-198):
 *  clamp to [0, max(0, totalUnits - displayUnits)]. */
export const clampScrollPixels = (px, contentH, panelH) =>
  Math.max(0, Math.min(Math.max(0, contentH - panelH), px));

/** HorizontalSlider.SetScrollIndex (HorizontalSlider.cs:279-291) -
 *  the same clamp the vertical bar takes, over WIDTHS: DisplayUnits is
 *  listboxTopic.Size.x (94) and TotalUnits is listboxTopic.WidthContent
 *  (ListBox.cs:699-707, the widest row's TextWidth). */
export const clampTopicHScroll = (px, widthContent, panelW) =>
  Math.max(0, Math.min(Math.max(0, widthContent - panelW), px));

/** HorizontalSlider.DrawSlider's thumb (:313-316), which
 *  HorizontalSlider.MouseClick (:170-178) pages against. ROAD-G G6 gave
 *  HorizontalSlider.cs its own home (ui/horizontalSlider.js) when the
 *  mouse-controls window needed the WHOLE component; this stays as the
 *  topic bar's name for it and delegates, so the arithmetic has one
 *  home rather than two copies of one C# method. */
export const topicSliderThumb = sliderThumb;

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

// ---- AUDIT 58 (talk lane): THE SIX BUTTON STRIPS ------------------
// DaggerfallTalkWindow.cs:34-35 names two more images beside the base
// panel - talkCategoriesImgName = "TALK02I0.IMG" and
// highlightedOptionsImgName = "TALK03I0.IMG" - and :436-490 cuts SIX
// 107x10 strips out of the three sheets, which SetTalkModeTellMeAbout
// (:944-949), SetTalkModeWhereIs (:967-968) and the four
// SetTalkCategory* arms (:1022-1025, :1043-1046, :1064-1067,
// :1085-1088) assign to the six buttons' BackgroundTexture on every
// mode change. The port loaded TALK01I0 alone and drew nothing over
// it, so which of Tell-me-about / Where-is was active and which of
// Location/People/Things/Work were reachable never appeared - and,
// worse, four of the six were drawn in the WRONG state on every frame,
// because the base art IS the grayed MODE rows and the highlighted
// CATEGORY rows (see the sources below). One frame after Setup, DFU
// shows Where-is highlighted with People/Things/Work grayed; the port
// showed the opposite of both.
export const TALK_CATEGORIES_IMG = 'TALK02I0.IMG';    // :34
export const TALK_HIGHLIGHT_IMG = 'TALK03I0.IMG';     // :35
/** WHERE each of the six strips is cut from. Unity's GetPixels is
 *  BOTTOM-LEFT origin, so every C# `y` below is converted to the
 *  top-down row this port's textures use:
 *   - the two GRAYED MODE strips and the four HIGHLIGHTED CATEGORY
 *     strips come out of textureBackground (TALK01I0) itself, at
 *     `200 - <rect.y> - 10` (:437-438, :459-462) - i.e. at exactly the
 *     button's own rect, which is why blitting them is the identity
 *     and why the untouched base art reads as "both modes grayed, all
 *     four categories lit";
 *   - the two HIGHLIGHTED MODE strips are TALK03I0's halves (:440-441:
 *     GetPixels at height/2 is the TOP half = Tell me about, at 0 the
 *     BOTTOM half = Where is);
 *   - the four GRAYED CATEGORY strips are TALK02I0's quarters
 *     (:443-446: height*3/4 -> Location, *2/4 -> People, /4 -> Thing,
 *     0 -> Work, i.e. top-down in that order). */
export const TALK_STRIP_SOURCES = Object.freeze({
  tellMeAboutGrayedOut: { art: 'base', rect: TALK_RECTS.tellMeAbout },
  whereIsGrayedOut: { art: 'base', rect: TALK_RECTS.whereIs },
  categoryLocationHighlighted: { art: 'base', rect: TALK_RECTS.categoryLocation },
  categoryPeopleHighlighted: { art: 'base', rect: TALK_RECTS.categoryPeople },
  categoryThingsHighlighted: { art: 'base', rect: TALK_RECTS.categoryThings },
  categoryWorkHighlighted: { art: 'base', rect: TALK_RECTS.categoryWork },
  tellMeAboutHighlighted: { art: 'highlighted', band: 0, bands: 2 },
  whereIsHighlighted: { art: 'highlighted', band: 1, bands: 2 },
  categoryLocationGrayedOut: { art: 'categories', band: 0, bands: 4 },
  categoryPeopleGrayedOut: { art: 'categories', band: 1, bands: 4 },
  categoryThingsGrayedOut: { art: 'categories', band: 2, bands: 4 },
  categoryWorkGrayedOut: { art: 'categories', band: 3, bands: 4 },
});
/** SetTalkCategory's switch (:973-994) - `case Location: default:`, so
 *  anything that is not one of the other three IS Location. */
export const TALK_CATEGORIES = Object.freeze(['location', 'people', 'things', 'work']);
/**
 * Which strip each of the six buttons wears, from the window's own
 * state. SetTalkModeTellMeAbout grays ALL FOUR categories (:946-949)
 * whatever the remembered one is; SetTalkModeWhereIs re-runs
 * SetTalkCategory(selectedTalkCategory) (:970), which lights exactly
 * one of them.
 */
export function talkButtonStrips(talkOption, category = 'location') {
  const whereIs = talkOption === 'whereIs';
  const cat = whereIs ? (TALK_CATEGORIES.includes(category) ? category : 'location') : null;
  const catStrip = (name, key) => (cat === key
    ? `category${name}Highlighted` : `category${name}GrayedOut`);
  return {
    tellMeAbout: whereIs ? 'tellMeAboutGrayedOut' : 'tellMeAboutHighlighted',
    whereIs: whereIs ? 'whereIsHighlighted' : 'whereIsGrayedOut',
    categoryLocation: catStrip('Location', 'location'),
    categoryPeople: catStrip('People', 'people'),
    categoryThings: catStrip('Things', 'things'),
    categoryWork: catStrip('Work', 'work'),
  };
}

let _art = null;
let _categoriesArt = null;   // TALK02I0
let _highlightArt = null;    // TALK03I0
export async function preloadTalkArt(deps) {
  _portraitDeps = deps;   // ROAD-D D10: SetNPCPortrait reads through the same host seam
  if (_art) return;
  try { _art = await loadImg(deps, 'TALK01I0.IMG'); }
  catch { console.warn('[talk] TALK01I0.IMG unavailable; the text talk chain stands in'); }
  // The two strip sheets ride the same seam. DFU CloseWindow()s when
  // either is missing (:442-448, :455-457); this port's art is fetched
  // asynchronously (the recorded departure the portrait carries below),
  // so a missing sheet costs the six overlays - the base art still
  // draws the six buttons - and never the conversation.
  try { _categoriesArt = await loadImg(deps, TALK_CATEGORIES_IMG); }
  catch { console.warn(`[talk] ${TALK_CATEGORIES_IMG} unavailable; the category buttons keep the base art`); }
  try { _highlightArt = await loadImg(deps, TALK_HIGHLIGHT_IMG); }
  catch { console.warn(`[talk] ${TALK_HIGHLIGHT_IMG} unavailable; the mode buttons keep the base art`); }
}
export const talkArtLoaded = () => !!_art;

/** One strip as an { img, rect } source, or null when its sheet has
 *  not landed (the never-trap above). */
export function talkStripSource(name, arts = { base: _art, categories: _categoriesArt, highlighted: _highlightArt }) {
  const src = TALK_STRIP_SOURCES[name];
  if (!src) return null;
  const img = arts[src.art];
  if (!img) return null;
  if (src.rect) return { img, rect: [...src.rect] };
  const h = Math.round(img.h / src.bands);
  return { img, rect: [0, src.band * h, img.w, h] };
}

// ---- ROAD-D D10: THE NPC PORTRAIT (SetNPCPortrait, :360-385) -------
// DFU has ONE talk window and texturePortrait is its field, set from
// TalkManager.SetTargetNPC BEFORE the window is pushed (:817, :849) -
// so this state is module-level, exactly as HUDEscortingNPCFaces'
// panel list is, and for the same reason.
//
// The two archives are DaggerfallTalkWindow's own constants (:37-38):
// CommonFaces = TFAC00I0.RCI (mobile NPCs and common static NPCs),
// SpecialFaces = FACES.CIF (story and special NPCs). Both are RCI
// grids of 64x64 records in this port's reader (cifRciFile.js:33-41),
// which is the panel's size (:158-159) - no fit is involved.
//
// RECORDED DEPARTURE (async art), the same one hudEscortFaces.js
// carries and the same Ledger A row: ART LANDS ASYNC, AND A MISSING
// RECORD COSTS THE PICTURE RATHER THAN THE SESSION (AUDIT 58, seams
// lane), cited by name because a line number rots. DFU loads the
// record synchronously and CLOSES THE WINDOW when it fails
// (:375-379). The port's art is fetched through the
// host's async seam, so the portrait draws from the frame it lands
// and a missing record costs the portrait (warned once), never the
// conversation.
export const PORTRAIT_ARCHIVE = Object.freeze({ CommonFaces: 'TFAC00I0.RCI', SpecialFaces: 'FACES.CIF' });
export const PORTRAIT_RECT = Object.freeze([119, 65, 64, 64]);

let _portraitDeps = null;
let _portrait = null;            // { tex, w, h } once the record has landed
let _portraitKey = null;         // `${file}#${record}` - what _portrait holds or is loading
let _portraitWarned = false;
const _portraitFiles = new Map();   // file -> Promise<CifRciFile>
const _portraitTex = new Map();     // key -> { tex, w, h }

function _loadPortraitFile(file) {
  let pr = _portraitFiles.get(file);
  if (!pr) {
    pr = (async () => {
      const cif = new CifRciFile();
      cif.load(await _portraitDeps.fetchBytes(file), file, _portraitDeps.palette);
      return cif;
    })();
    _portraitFiles.set(file, pr);
  }
  return pr;
}

/** SetNPCPortrait(FacePortraitArchive, recordId) (:360-385). */
export function setNpcPortrait(archive, recordId) {
  const file = PORTRAIT_ARCHIVE[archive] ?? PORTRAIT_ARCHIVE.CommonFaces;
  const key = `${file}#${recordId}`;
  _portraitKey = key;
  _portrait = _portraitTex.get(key) ?? null;
  if (_portrait || !_portraitDeps) return;
  _loadPortraitFile(file).then((cif) => {
    if (!_portraitTex.has(key)) {
      const bmp = cif.getDFBitmap(recordId, 0);
      _portraitTex.set(key, {
        tex: _portraitDeps.renderer.uploadTexture('cif', key, bitmapToColor32(bmp, _portraitDeps.palette)),
        w: bmp.width, h: bmp.height,
      });
    }
    if (_portraitKey === key) _portrait = _portraitTex.get(key);
  }).catch((e) => {
    if (!_portraitWarned) { _portraitWarned = true; console.warn('[talk] portrait art unavailable:', e?.message ?? e); }
  });
}

/** ClearNPCPortrait - the port's own: a session with no portrait set
 *  must not inherit the last NPC's face. */
export function clearNpcPortrait() { _portrait = null; _portraitKey = null; }
export const npcPortraitKey = () => _portraitKey;

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
    // AUDIT 58: horizontalSliderTopic.ScrollIndex, in PIXELS
    // (listboxTopic.HorizontalScrollIndex, :1364). UpdateScrollBarsTopic
    // zeroes it with every page (:816), so _setListboxTopics does.
    // _topicWidthContent is ListBox.WidthContent measured at the last
    // draw - the same shape _conversationContentH takes, because a
    // width in glyphs is not knowable without the font.
    this.topicHScroll = 0;
    this._topicWidthContent = 0;
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
    // ROAD-D D10: listboxTopic.SelectedIndex. DFU splits the topic
    // list in two (DaggerfallTalkWindow.cs:549-550): OnSelectItem
    // (:1381-1387) only moves this index and refreshes the
    // player-says label through UpdateQuestion, and OnUseSelectedItem
    // (:1389-1392) is what asks. -1 = nothing selected (SelectNone).
    this.selected = -1;
    this._lastRowClick = null;   // BaseScreenComponent's double-click clock
  }

  /** SetListboxTopics' tail (:893-905): a freshly filled list SELECTS
   *  its first row - index 1 when row 0 is the NavigationBack
   *  "previous" row, which this port's flattened lists never carry
   *  (treeCategories drops them, townTalk.js:658) - and SelectIndex
   *  (ListBox.cs:761-770) raises OnSelectItem, so the player-says
   *  label is filled before the player clicks anything.
   *
   *  AN EMPTY LIST CLEARS BOTH, and the clearing does not happen
   *  here. SetListboxTopics opens with `listboxTopic.ClearItems()`
   *  (:858), which is Clear + scrollIndex 0 + SelectNone
   *  (ListBox.cs:532-537, :773-776), so SelectedIndex is ALREADY -1
   *  by the time `if (listTopic.Count <= 0) return;` (:892-893) skips
   *  the SelectIndex below. Every caller then runs a TRAILING
   *  `UpdateQuestion(listboxTopic.SelectedIndex)` - SetTalkModeTellMe
   *  About :957, SetTalkCategoryLocation :1033, People :1054, Things
   *  :1075 - and UpdateQuestion's out-of-range arm (:1232-1236) sets
   *  `textlabelPlayerSays.Text = ""`. So opening the EMPTY Things
   *  page blanks the player-says label and leaves nothing selected;
   *  it does not leave the previous page's question standing. Both
   *  halves fold in here because this port's four page-openers are
   *  the one door SetListboxTopics is reached through. */
  _setListboxTopics(rows, mode) {
    this.topics = this._repairCaptions(rows);
    this.topicMode = mode;
    this.scroll = 0;
    this.topicHScroll = 0;               // UpdateScrollBarsTopic :816
    this._topicWidthContent = 0;
    this.selected = -1;                                // ClearItems -> SelectNone
    if (!rows.length) { this._updateQuestion(-1); return; }   // the trailing UpdateQuestion(-1)
    this._selectIndex(0);
  }

  /** AUDIT 58 (seams): THE CAPTION REPAIR, which this window did not
   *  have. SetListboxTopics repairs EVERY row before it adds it
   *  (DaggerfallTalkWindow.cs:863-872):
   *
   *      if (item.caption == null) {        // old save data
   *        item.caption = item.key;         // "just try to take key"
   *        if (item.caption == String.Empty)
   *          item.caption = GetLocalizedText("resolvingError");
   *      } else if (item.caption == String.Empty) {
   *        item.caption = GetLocalizedText("resolvingError");
   *      }
   *
   *  `resolvingError` is `...never mind...` (Internal_Strings.csv:582),
   *  so DFU never draws a blank row: an unlabelled row is still
   *  SELECTABLE and still answerable, and a player cannot tell it from
   *  a gap in the list. The port drew the caption verbatim and had no
   *  substitution anywhere, so those rows came out zero-width.
   *
   *  Empty captions are reachable from the port's own assembler:
   *  topicTree.js's `captionString` starts '' (:578) and the NotSet
   *  arm never overwrites it, the Location arm's null test takes an
   *  EMPTY buildingName as the caption (:588-589, and quest/place.js
   *  builds dungeon and town siteDetails with `buildingName: ''`), and
   *  the Thing arm only fills it once the Item resource has minted its
   *  daggerfallUnityItem (:602).
   *
   *  DFU's ListItem is a CLASS (TalkManager.cs:159), so the repair is
   *  a WRITE-BACK that outlives the draw - the tree's own row stays
   *  repaired for every later reader. Mirrored here: the row's label
   *  and, where the row wraps one, its ListItem's caption.
   *
   *  This is the ONE door - all four page setters reach the listbox
   *  through `_setListboxTopics`, and `_updateQuestion` reads the same
   *  repaired label when it builds the player-says line. */
  _repairCaptions(rows) {
    for (const row of rows) {
      const was = row.label ?? row.name;
      let caption = was;
      if (caption == null) {
        caption = row.listItem?.key ?? '';
        if (caption === '') caption = RESOLVING_ERROR;
      } else if (caption === '') {
        caption = RESOLVING_ERROR;
      }
      if (caption === was) continue;
      row.label = caption;
      if (row.listItem) row.listItem.caption = caption;
    }
    return rows;
  }

  /** ListBox.MouseClick (:465-505) -> SelectIndex -> OnSelectItem. */
  _selectIndex(idx) {
    if (idx < 0 || idx >= this.topics.length) return;
    if (idx === this.selected) return;   // ListboxTopic_OnSelectItem's selectionIndexLastUsed guard (:1383-1386)
    this.selected = idx;
    this._updateQuestion(idx);
  }

  /** UpdateQuestion (:1222-1249). The Work page answers from a FAKE
   *  ListItem with no list behind it; otherwise an out-of-range index
   *  CLEARS the label, an ItemGroup row leaves currentQuestion "" (it
   *  is not a question), and only an Item asks GetQuestionText for the
   *  currently selected tone. */
  _updateQuestion(index) {
    if (this.topicMode === 'work') { this.question = this.hooks.workQuestion?.() ?? this.question; return; }
    const it = this.topics[index];
    if (!it) { this.question = ''; return; }
    if (this.topicMode === 'categories') { this.question = ''; return; }   // ListItemType.ItemGroup
    this.question = this.hooks.question?.(it) ?? `Where is ${it.label ?? it.name}?`;
  }

  /** SetQuestionAnswerPairInConversationListbox (:1290-1293): the
   *  ButtonClick belongs to the PAIR, which is why
   *  ButtonOkay_OnMouseClick (:1534-1548) plays none of its own. */
  _pushQA(question, answer) {
    audio.playOneShot(SOUND.ButtonClick, 1);
    this.conversation.push({ text: question, kind: 'question' });
    this.conversation.push({ text: answer, kind: 'answer' });
    this.conversationScroll = null;   // F159: UpdateScrollBarConversation on new content
  }

  _openCategories() {
    this._setListboxTopics(this.hooks.categories(), 'categories');
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
    this._setListboxTopics(rows, 'topics');
    return true;
  }
  _openWork() {
    const q = this.hooks.workQuestion?.();
    if (q == null) return false;
    this.topics = [];
    this.topicMode = 'work';
    this.scroll = 0;
    this.topicHScroll = 0;               // ClearListboxTopics + UpdateScrollBarsTopic (:1090-1093)
    this._topicWidthContent = 0;
    this.selected = -1;
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
    this._pushQA(this.question, this.hooks.askWork());
  }
  /** The index of the first row ListBox.Draw renders at this pixel
   *  scroll - what the port's digit accelerators address. */
  _firstVisible() { return Math.max(0, Math.ceil(this.scroll / TOPIC_ROW_H) - 1); }
  _pick(i) { this._pickIndex(this._firstVisible() + i); }
  /** SelectTopicFromTopicList (:1290-1340) - DFU's USE arm. It moves
   *  the selection first (`listboxTopic.SelectedIndex = index`,
   *  :1307), then walks the row's type: a group descends into its
   *  children with a ButtonClick of its own (:1318-1330), an Item
   *  pushes the Q/A pair and RE-RUNS UpdateQuestion for the row that
   *  is still selected under it (:1333). */
  _pickIndex(idx) {
    const it = this.topics[idx];
    if (!it) return;
    // AUDIT 58 (talk lane): this is `listboxTopic.SelectedIndex = index`
    // (:1307) and NOTHING more. The assignment raises OnSelectItem
    // (ListBox.cs:761-771), whose handler is guarded -
    // `if (index != selectionIndexLastUsed) UpdateQuestion(index);`
    // (:1381-1387) - so on an ALREADY selected row, which is every
    // double-click and every OKAY press (both enter here with
    // `this.selected` already standing), UpdateQuestion is SKIPPED and
    // the pair at :1331 logs the standing currentQuestion: the very
    // sentence the player-says panel is showing. The port re-ran
    // _updateQuestion here unconditionally, and GetQuestionText is
    // ExpandRandomTextRecord - a fresh RANDOM variant of 7212/7225 per
    // call (systems/answerPipeline.js -> talkMacros.js:328-332) - so
    // the conversation recorded a different sentence from the one on
    // screen. _selectIndex IS that guarded handler.
    this._selectIndex(idx);
    if (this.topicMode === 'categories') {
      this._category = it;
      audio.playOneShot(SOUND.ButtonClick, 1);   // the ItemGroup arm's own click (:1329)
      this._setListboxTopics(it.buildings, 'buildings');
    } else if (this.topicMode === 'buildings' || this.topicMode === 'topics') {
      // AUDIT 17e F13: the question is a TEXT.RSC record chosen by
      // tone, not an English literal. F-addendum: DFU pushes the
      // question/answer PAIR into the conversation
      // (SetQuestionAnswerPairInConversationListbox) - the question
      // was only ever shown in the player-says panel here.
      // B5-6: the flat pages (Tell me about, People) ask through the
      // SAME pair - their rows carry listItems and the hooks already
      // speak them.
      this._pushQA(this.question, this.hooks.answer(it));
      this._updateQuestion(idx);   // :1333 - "and get new question text for textlabel"
    }
  }
  /** AUDIT 58 (talk lane): ButtonTone{Polite,Normal,Blunt}_OnClickHandler
   *  (DaggerfallTalkWindow.cs:1501-1532), whole. All three handlers are
   *  the same four statements: assign the tone, RETURN on the
   *  toneLastUsed guard (:1505), UpdateCheckboxes, then
   *  `UpdateQuestion(listboxTopic.SelectedIndex)` - so the question is
   *  RE-DRAWN from GetQuestionText(listItem, selectedTalkTone) at the
   *  NEW tone. The port's four call sites set the tone and returned, so
   *  (a) the player-says panel kept the old tone's sentence until the
   *  selection moved, and (b) on the WORK page - whose question is
   *  stored once by _openWork and pushed verbatim by _askWork - the
   *  logged question stayed at the OLD tone's record while
   *  getAnswerText recomputed the reaction tier at the NEW one. DFU's
   *  UpdateQuestion takes its Work arm FIRST (:1224-1231), rebuilding
   *  the fake Work ListItem before any index check, which is why the
   *  Work page refreshes here too. UpdateCheckboxes (:916-930) is the
   *  flat panelTone fill, which draw() already paints live from
   *  hooks.tone(). */
  _setTone(t) {
    if (t === this.hooks.tone()) return;   // TalkToneToIndex(selectedTalkTone) == toneLastUsed (:1505)
    this.hooks.setTone(t);
    this._updateQuestion(this.selected);
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

  /** ButtonTopicLeft/Right_OnMouseClick (:1430-1440) - one slider unit,
   *  and the slider is pixel-unit here, so one PIXEL. */
  _scrollTopicH(dPx) {
    this.topicHScroll = clampTopicHScroll(this.topicHScroll + dPx, this._topicWidthContent, TALK_RECTS.topicList[2]);
  }
  _close() { this.done = true; this.hooks.onClose?.(); }

  /** Keyboard accelerators (the session's established keys). */
  input(code) {
    if (code === 'Escape' || code === 'KeyE' || code === 'Enter') { this._close(); return; }
    if (code === 'KeyW') { this._openCategories(); return; }
    if (code === 'KeyT') { this._setTone((this.hooks.tone() + 1) % 3); return; }
    if (code === 'KeyN') { this._scrollBy(TALK_RECTS.topicList[3]); return; }   // ours: a full page
    if (code === 'KeyP') { this._scrollBy(-TALK_RECTS.topicList[3]); return; }
    const d = /^Digit([1-9])$/.exec(code);
    if (d) this._pick(Number(d[1]) - 1);
  }

  /** Pointer path (phone taps + mouse): virtual-space hit rects.
   *  The third slot is the host's right-button boolean
   *  (townTalk.js:914) and is not read here; `now` is the
   *  double-click clock, injectable for the pins. */
  click(vx, vy, _rightButton = false, now = null) {
    const R = TALK_RECTS;
    // AUDIT 17e F12: GOODBYE closes. OKAY is DFU's "ask the selected
    // topic" button (DaggerfallTalkWindow) - it never closed the
    // window.
    // Every talk-window button assigns ButtonClick (DaggerfallTalkWindow
    // :1315-1605); the topic ask itself clicks at the Q&A pair (:1253).
    if (inRect(R.goodbye, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._close(); return true; }
    // ROAD-D D10: OKAY, whole. ButtonOkay_OnMouseClick (:1534-1548)
    // has TWO arms and the port only ever had one: the Work page asks
    // its fake ListItem, and EVERY other page asks
    // SelectTopicFromTopicList(listboxTopic.SelectedIndex) - the
    // selected topic, which is what makes OKAY the button its art
    // says it is. It plays no sound of its own (the pair does).
    if (inRect(R.okay, vx, vy)) {
      if (this.topicMode === 'work') this._askWork();
      else this._pickIndex(this.selected);
      return true;
    }
    if (inRect(R.whereIs, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._talkOption = 'whereIs'; this._reopenCategory(); return true; }
    if (inRect(R.categoryLocation, vx, vy)) {
      if (this._talkOption !== 'whereIs') return true;   // greyed out: silent, per the gate above
      audio.playOneShot(SOUND.ButtonClick, 1); this._lastCategory = 'location'; this._openCategories(); return true;
    }
    // The ButtonClick is played BEFORE the toneLastUsed guard (:1503),
    // so a re-click of the standing tone still sounds and changes nothing.
    if (inRect(R.tonePolite, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._setTone(0); return true; }
    if (inRect(R.toneNormal, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._setTone(1); return true; }
    if (inRect(R.toneBlunt, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._setTone(2); return true; }
    if (inRect(R.topicUp, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._scrollBy(-TOPIC_ARROW_SCROLL); return true; }
    if (inRect(R.topicDown, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._scrollBy(TOPIC_ARROW_SCROLL); return true; }
    // AUDIT 58: the horizontal pair, one slider unit a click (:1433, :1439).
    if (inRect(R.topicLeft, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._scrollTopicH(-1); return true; }
    if (inRect(R.topicRight, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._scrollTopicH(1); return true; }
    // ...and the trough, which pages by DisplayUnits on whichever side
    // of the thumb was hit (HorizontalSlider.MouseClick :170-178). The
    // slider plays no ButtonClick of its own - it is a slider, not a
    // Button.
    if (inRect(R.topicSlider, vx, vy)) {
      const thumb = topicSliderThumb(R.topicSlider, this.topicHScroll, this._topicWidthContent, R.topicList[2]);
      if (thumb) {
        if (vx < thumb[0]) this._scrollTopicH(-R.topicList[2]);
        else if (vx > thumb[0] + thumb[2]) this._scrollTopicH(R.topicList[2]);
      }
      return true;
    }
    // F159: the conversation arrows (:1442-1452) - 5 pixels a click.
    if (inRect(R.conversationUp, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._scrollConversationBy(-CONVERSATION_ARROW_SCROLL); return true; }
    if (inRect(R.conversationDown, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._scrollConversationBy(CONVERSATION_ARROW_SCROLL); return true; }
    // ListBox.MouseClick's PixelWise branch: the hit row is found at
    // scrollIndex + clickY, not at the visible-row ordinal.
    // ROAD-D D10: and it only SELECTS (ListBox.cs:465-505). Reaching
    // UseSelectedItem takes MouseDoubleClick (:507-512), the same law
    // ui/listPicker.js carries; the test is on TIME alone
    // (BaseScreenComponent.cs:691) because MouseClick has already
    // moved the selection under the second press. The listbox itself
    // plays no ButtonClick - the navigation arms and the Q/A pair do.
    if (inRect(R.topicList, vx, vy)) {
      const t = now ?? Date.now();
      const wasDouble = this._lastRowClick != null && (t - this._lastRowClick) < DOUBLE_CLICK_DELAY_MS;
      this._selectIndex(Math.floor((vy - R.topicList[1] + this.scroll) / TOPIC_ROW_H));
      this._lastRowClick = t;
      if (wasDouble) { this._lastRowClick = null; this._pickIndex(this.selected); }
      return true;
    }
    // B5-6: the four pages are live at :313-327 - tellMeAbout, then
    // people/things/work behind the whereIs gate - with three of the
    // hooks supplied at scenes/townTalk.js:612-614 and Work's OKAY
    // question shipped alongside them (_askWork :293, ButtonOkay's
    // fake Work ListItem at DaggerfallTalkWindow.cs:1534-1543). Each
    // still falls back to consuming the click when its hook is absent
    // (the pre-engine host), so an art-only session never half-opens
    // a page.
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
    // AUDIT 58: the six button BackgroundTextures, over the base art
    // and under everything else - DFU assigns all six on every mode
    // change (:944-949, :967-968, :1022-1088), so all six are blitted
    // from state here. The `base` ones are the identity (their source
    // rect IS the button's rect); the differing ones are TALK03I0's
    // halves and TALK02I0's quarters.
    for (const [button, strip] of Object.entries(talkButtonStrips(this._talkOption, this._lastCategory))) {
      const src = talkStripSource(strip);
      if (src) drawImgCrop(renderer, src.img, m, src.rect, TALK_RECTS[button]);
    }
    // panelPortrait (:417-418) - the BackgroundTexture at its own
    // 64x64 over the art's frame, before the labels.
    if (_portrait) drawImg(renderer, _portrait, m, PORTRAIT_RECT[0], PORTRAIT_RECT[1], PORTRAIT_RECT[2], PORTRAIT_RECT[3]);
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
    // AUDIT 58 (talk lane): the topic rows PAN, they are not cut. This
    // listbox is HorizontalScrollModes.PixelWise (:545), where
    // ListBox.cs:556-557 sets the row label's MaxWidth to -1 - no
    // truncation at all - and ListBox.Draw lays each row at
    // `x = -horizontalScrollIndex` (:344-352) inside the
    // RectRestrictedRenderArea the listbox declares over its own box
    // (:546). The old code cut every row to 94px with a local fit(),
    // citing the CharWise branch, so a topic wider than the box lost
    // its tail permanently and no input path could reveal it.
    // WidthContent (ListBox.cs:699-707) is the widest row, measured
    // here because the font is only in hand at draw time; the arrows
    // and the slider clamp against it.
    const labels = this.topics.map((it) => it.label ?? it.name ?? '');
    this._topicWidthContent = labels.reduce((w, t) => Math.max(w, measureText(font.fnt, t)), 0);
    this.topicHScroll = clampTopicHScroll(this.topicHScroll, this._topicWidthContent, R.topicList[2]);
    // ROAD-D D10: DecideTextColor (ListBox.cs:360-380) - the SELECTED
    // row draws in selectedTextColor and, because
    // selectedShadowPosition is Vector2.zero (:41), carries NO shadow.
    // This listbox has no hover highlight: the talk window never
    // assigns highlightedIndex's colours the way the picker does.
    renderer.setScreenScissor(m.ox + R.topicList[0] * m.s, m.oy + R.topicList[1] * m.s, R.topicList[2] * m.s, R.topicList[3] * m.s);
    layoutPixelRows(this.topics.map(() => TOPIC_ROW_H), this.scroll, R.topicList[3]).forEach(({ index, y }) => {
      shadowText(renderer, font, labels[index], m, R.topicList[0] - this.topicHScroll, R.topicList[1] + y, topicRowStyle(index === this.selected));
    });
    renderer.clearScreenScissor();
    // conversation - AUDIT 17e F11/F18. Two laws were wrong here:
    // UI6: the modern conversation style, read once for the whole
    // conversation block (DFU sets it per label, from the same flag).
    const modern = getBool('GUI', 'EnableModernConversationStyleInTalkWindow');
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
      // UI6: MaxWidth is multiplied by textBlockSizeModernConversationStyle
      // BEFORE the wrap, so a modern line breaks at three quarters of
      // the panel; the glyphs are then drawn at TextScale 0.8.
      const wrapW = modern ? Math.trunc(R.conversation[2] * MODERN_BLOCK_SIZE) : R.conversation[2];
      entries.push({ lines: wrapText(font.fnt, e.text, modern ? Math.round(wrapW / MODERN_TEXT_SCALE) : wrapW), kind: e.kind });
    }
    // AUDIT 18: DFU lays the conversation out FORWARD from the listbox
    // origin at y = -scrollIndex, and UpdateScrollBarConversation's
    // HeightContent() - Size.y is floored at 0 - so a short
    // conversation fills from the TOP and only a long one is pinned to
    // its last row. The port anchored every conversation to the bottom.
    const rowH = modern ? ROW_H * MODERN_TEXT_SCALE : ROW_H;
    const heights = entries.map((e) => e.lines.length * rowH);
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
        const tw = measureText(font.fnt, text) * (modern ? MODERN_TEXT_SCALE : 1);
        const x = e.kind === 'question'
          ? R.conversation[0] + R.conversation[2] - tw
          : R.conversation[0];
        const ly = R.conversation[1] + y + j * rowH;
        if (modern) {
          // The label's own BackgroundColor fills the label's box, so
          // the block is exactly the drawn line, not the panel.
          renderer.drawScreenQuad(null,
            { x: m.ox + x * m.s, y: m.oy + ly * m.s, w: tw * m.s, h: rowH * m.s },
            undefined, e.kind === 'question' ? MODERN_QUESTION_BG : MODERN_ANSWER_BG);
        }
        shadowText(renderer, font, text, m, x, ly, { color, scale: modern ? MODERN_TEXT_SCALE : 1 });
      });
    }
  }
}
