// U10: CHARGEN ART - the classic character-creation screens on the
// U8a native panel (DFU CreateChar*, MIT Daggerfall Workshop). This
// retires the U2b flow's clean-text panels: the real ARENA2 windows
// draw over the same flow, and the face picker finally shows the
// PORTRAIT the S3c face index was choosing blind.
//
// THE NATIVE-WINDOW RULE: every rect, colour and font below cites the
// DFU line it comes from. Sources:
//   name    CreateCharNameSelect.cs:26,73-85   CHAR00I0.IMG
//   race    CreateCharRaceSelect.cs:30-31,64   TMAP00I0 + TAMRIEL2
//   gender  CreateCharGenderSelect.cs:31       TEXT.RSC 2200 (a
//           DaggerfallMessageBox - ui/messageBox.js draws it)
//   face    CreateCharFaceSelect.cs:31,61 + FacePicker.cs:55-68
//   class   DaggerfallListPickerWindow.cs:31,82-98   PICK00I0.IMG
//   method  CreateCharChooseClassGen.cs:24-31        BUTN01I0.IMG (U18)
//   questions CreateCharClassQuestions.cs:32-51      CHGN00I0.IMG +
//           SCRL00I0/SCRL01I0.GFX (U18)
//   stats   CreateCharAddBonusStats.cs:32,88-124 + StatsRollout.cs
//   skills  CreateCharAddBonusSkills.cs:32,91-95 + SkillsRollout.cs
//   spinners UpDownSpinner.cs:25,96-116 / LeftRightSpinner.cs:30,76-96
//   colours DaggerfallUI.cs:52-62,81
//
// GENDER and the race DESCRIPTION are DaggerfallMessageBoxes rather
// than full-screen windows; U11 gave the port that frame, so both
// draw as the real parchment popup over the province map (the
// verbatim TEXT.RSC 2200 prompt with Male/Female, and the race's
// DescriptionID with Yes/No).
//
// (This note used to carry two flags. The CUSTOM-CLASS one retired
// with U20a and the SPECIAL ADVANTAGES one with U20b - both ship, and
// both sentences went with them.)

import { ImgFile } from '../formats/imgFile.js';
import { CifRciFile } from '../formats/cifRciFile.js';
import { GfxFile } from '../formats/gfxFile.js';   // U18: the question scroll
import { FlcFile } from '../formats/flcFile.js';   // F2: the constellation CELs
import { FlcPlayer } from './flcPlayer.js';
import { DFPalette } from '../formats/dfPalette.js';   // U18: CHGN00I0's own palette
import { TextRsc } from '../formats/textRsc.js';   // U11: the race description
import { generateBackstory } from '../systems/biography.js';   // U13
import { bitmapToColor32 } from './hud.js';
import { drawImg, drawRect, shadowText, DEFAULT_TEXT_COLOR, DEFAULT_SHADOW_COLOR, SCREEN_DIM } from './nativePanel.js';
import { thumbSpan, drawScrollThumb } from './verticalScrollBar.js';   // ROAD-D2: the list picker's thumb, DFU's own slices
import { drawText, measureText, makeFont } from './text.js';   // U15: the RANDOM button label; U18: the black scroll text; AUDIT 18: SmallFont
import { FntFile } from '../formats/fntFile.js';   // AUDIT 18: FONT0002, DaggerfallUI.SmallFont
import { layoutMessageBox, drawMessageBox, messageBoxHit, MB_BUTTONS } from './messageBox.js';   // U11
import { FACES_PER_RACE, raceById, raceArt } from '../systems/races.js';
import { SKILL_NAMES } from '../systems/skills.js';
import { daggerY, tickDaggerTrails, REP_GREEN, REP_RED, REP_EXIT, REP_BAR_TOP, REP_BAR_BOTTOM, REP_GROUPS, HELP_TOPICS } from '../systems/customClass.js';   // U20a; CG1 the trail machine
import { labelRows, labelFor, LABEL_ORIGIN, LABEL_HIT_HEIGHT } from '../systems/specialAdvantages.js';   // U20b
import { STAT_KEYS_ORDER } from '../systems/chargen.js';

// DaggerfallUI.cs:52-62 - the colours these windows actually use.
/** CreateCharNameSelect.cs:79-81 - the RANDOM button's own colours. */
export const RANDOM_BUTTON_BG = [0.5, 0.5, 0.5, 0.75];
export const RANDOM_LABEL = 'Random';

/** DaggerfallBaseWindow.cs:40 - parentPanel.BackgroundColor = black. */
export const MENU_BACKDROP = [0, 0, 0, 1];

/** U14 / U21b: paint DaggerfallBaseWindow's BLACK parent panel over the
 *  whole real canvas, in the host's own space.
 *
 *  It has to SUBTRACT the screen offset. The dungeon host draws overlays
 *  with a virtual 320x200*s canvas and a letterbox offset already set
 *  (dungeonContext's drawOverlay), so a quad at (0,0) landed DOWN-RIGHT
 *  by the margin: the top and left strips kept showing the host's 60%
 *  dim over the pale Iliac Bay sky, which read as a blue border down the
 *  side of every chargen screen. Measured before the fix, the left strip
 *  was (57,75,97) - the sky at 40% - and (0,0,0) after.
 *
 *  The exterior hosts pass the REAL canvas with no offset, where this
 *  subtracts zero and nothing changes.
 *
 *  U22: a TOP-LEVEL host (the splash) has a canvas rather than a live GL
 *  context to measure - and the letterbox bit there too, a third time.
 *  Pass one and it is measured instead of renderer.gl; the offset is
 *  still subtracted, which is a no-op at top level and correct anywhere
 *  else. Without this the helper cannot be shared with a host that draws
 *  before the world does, and a fourth copy of the idiom gets written. */
/** The eighteen windows that assign `ParentPanel.BackgroundColor =
 *  ScreenDimColor` in their own Setup - the inventory (:294), the
 *  character sheet (:105), the talk window (:398), the journal (:95),
 *  the trade window (:199) and the rest - REPLACE
 *  DaggerfallBaseWindow's black parent panel with Color.clear, so the
 *  game view behind them shows through the letterbox. AUDIT 24 ui: the
 *  port painted all of them opaque black on a comment asserting the
 *  inverse of what those files say. Alpha 0 blends to nothing, so this
 *  is the same call with the colour DFU actually uses. */
export function drawScreenDimBackdrop(renderer, canvas = null) {
  drawMenuBackdrop(renderer, canvas, SCREEN_DIM);
}

export function drawMenuBackdrop(renderer, canvas = null, color = MENU_BACKDROP) {
  const [ox, oy] = renderer.screenOffset ?? [0, 0];
  const w = canvas ? canvas.width : renderer.gl.drawingBufferWidth;
  const h = canvas ? canvas.height : renderer.gl.drawingBufferHeight;
  renderer.drawScreenQuad(null,
    // `0 - ox` rather than `-ox`: unary negation on 0 yields -0, which is
    // the same pixel but a different value to anything comparing rects.
    { x: 0 - ox, y: 0 - oy, w, h },
    undefined, color);
}
export const ALT_SHADOW_1 = [44 / 255, 60 / 255, 60 / 255, 1];        // DaggerfallAlternateShadowColor1
export const SELECTED_TEXT = [162 / 255, 36 / 255, 12 / 255, 1];      // DaggerfallDefaultSelectedTextColor
export const INPUT_TEXT = [227 / 255, 223 / 255, 0, 1];               // DaggerfallDefaultInputTextColor
const MODIFIED_STAT = [0, 1, 0, 1];                                   // StatsRollout.cs:47 (Color.green)

/** Every verbatim rect this arc draws, [x, y, w, h]. */
export const RECTS = Object.freeze({
  nameBox: [80, 5, 214, 7],           // CreateCharNameSelect.cs:73-74
  randomName: [279, 3, 36, 10],       // :78 - live since U15
  ok: [263, 172, 39, 22],             // :85 (and face/stats/skills OK)
  reroll: [263, 147, 39, 22],         // CreateCharAddBonusStats.cs:112
  // AUDIT 18: the stats screen's other two buttons (:116-122). Both
  // were missing entirely - the rects, the hit branch and the state -
  // so a player who rerolled away a good roll could not get it back.
  saveRoll: [162, 162, 71, 9],        // :117
  loadRoll: [162, 171, 71, 9],        // :121
  faceDisplay: [247, 25, 64, 40],     // FacePicker.cs:55-57
  facePrev: [245, 69, 42, 9],         // :65
  faceNext: [287, 69, 26, 9],         // :67
  pickList: [26, 27, 138, 72],        // DaggerfallListPickerWindow.cs:82-83
  pickPrev: [179, 10, 9, 9],          // :88
  pickNext: [179, 108, 9, 9],         // :92
  pickScroll: [181, 23, 5, 82],       // :97-98
  // U16 - CreateCharSummary.cs:86-96. The name box sits 20px further
  // right than the name SCREEN's (80,5), and RESTART takes the slot
  // the stats screen gives to REROLL.
  summaryName: [100, 5, 214, 7],      // :86-87
  restart: [263, 147, 39, 22],        // :91
});

/** ReflexPicker is a self-contained 66x45 Panel of five 66x9 buttons
 *  (ReflexPicker.cs:81-95) that its host merely POSITIONS - the reflex
 *  screen at (127,148) (CreateCharReflexSelect.cs:93), the summary at
 *  (246,95) (CreateCharSummary.cs:80). ONE DFU MEMBER, ONE EXPORT: the
 *  draw and the hit take the origin rather than being written twice. */
export const SUMMARY_REFLEX_ORIGIN = Object.freeze([246, 95]);

/** CreateCharSummary.cs:32 - strYouMustDistributeYourBonusPoints. */
/** TEXT.RSC's unspent-points box, the summary's OK gate. Exported for
 *  the same reason CLASS_DESCRIPTION_TEXT_ID is: the enhanced view
 *  needs the record and a second literal 14 is how the two skins come
 *  to refuse with different words. */
export const SUMMARY_BONUS_TEXT_ID = 14;

/** CreateCharClassSelect.cs:31 - startClassDescriptionID. The picked
 *  class's description is record 2100 + its index. */
/** TEXT.RSC's class descriptions, 2100 + classIndex. Exported because
 *  the enhanced view needs the same record and ONE DFU MEMBER, ONE
 *  EXPORT - a second 2100 literal is how the two skins would come to
 *  describe different classes. */
export const CLASS_DESCRIPTION_TEXT_ID = 2100;

/** BaseScreenComponent.cs:54 - doubleClickDelay, in SECONDS. The test
 *  at :691 is on TIME ALONE; the two clicks need not land on the same
 *  row, only inside the same component. */
export const DOUBLE_CLICK_DELAY_MS = 300;

// U18 - the class-METHOD screen (CreateCharChooseClassGen.cs). The
// window is BUTN01I0.IMG centred on the native panel (:49-51,
// Center/Middle); the file is headerless 26496 bytes = 184x144
// (ImgFile's exact-length table), so the panel sits at (68,28). The
// two buttons are BAKED in the art; only the hit rects are DFU's.
export const METHOD_PANEL = Object.freeze([68, 28, 184, 144]);
export const METHOD_CHOOSE_CLASS = Object.freeze([8, 41, 167, 43]);       // chooseClassRect (:30)
export const METHOD_CHOOSE_QUESTIONS = Object.freeze([8, 100, 167, 34]);  // chooseQuestionsRect (:31)

/** DaggerfallListPickerWindow's pickerPanel is Center/Middle on the
 *  native panel and PICK00I0.IMG decodes 200x128, so it sits at
 *  (60,36). U20a made this a CONSTANT, as the U18/U19 panels already
 *  were: the list hit used to derive the origin from the loaded
 *  image, which made it the one hit path in the arc that needed art -
 *  and so the one the pins could not drive. Draw and hit share it. */
export const PICK_PANEL = Object.freeze([60, 36, 200, 128]);

/** ROAD-E2 - the picker's scroll bar in NATIVE coordinates, the ONE
 *  rect the draw, the hit and the drag all resolve against. DFU adds
 *  it as a pickerPanel CHILD at (181,23) sized 5x82
 *  (DaggerfallListPickerWindow.cs:96-99), so its screen rect is the
 *  panel's own origin plus that - 60+181, 36+23. Every list picker in
 *  the wizard inherits it: the class list (CreateCharClassSelect
 *  extends DaggerfallListPickerWindow), the builder's skill and help
 *  pickers (CreateCharCustomClass.cs:283, :368) and the two special
 *  advantage pickers (CreateCharSpecialAdvantageWindow.cs:270, :273). */
export const PICK_SCROLL_RECT = Object.freeze([
  PICK_PANEL[0] + RECTS.pickScroll[0], PICK_PANEL[1] + RECTS.pickScroll[1],
  RECTS.pickScroll[2], RECTS.pickScroll[3],
]);

// U20a - the CUSTOM-CLASS BUILDER (CreateCharCustomClass.cs). The
// window is CUST00I0.IMG full-screen; the difficulty dagger is
// CUST08I0.IMG (24x9) at x 220 with its Y from the difficulty law;
// the reputation window is CUST03I0.IMG centred. Every rect is DFU's
// (:84-107 + CreateCharReputationWindow.cs:27,120-129).
export const CUSTOM_SKILL_RECTS = Object.freeze([
  [66, 31, 108, 8], [66, 41, 108, 8], [66, 51, 108, 8],
  [66, 80, 108, 8], [66, 90, 108, 8], [66, 100, 108, 8],
  [66, 129, 108, 8], [66, 139, 108, 8], [66, 149, 108, 8],
  [66, 159, 108, 8], [66, 169, 108, 8], [66, 179, 108, 8],
]);
export const CUSTOM_HP_UP = Object.freeze([252, 46, 8, 10]);
export const CUSTOM_HP_DOWN = Object.freeze([252, 57, 8, 10]);
export const CUSTOM_HELP = Object.freeze([249, 74, 66, 22]);
export const CUSTOM_ADVANTAGE = Object.freeze([249, 98, 66, 22]);
export const CUSTOM_DISADVANTAGE = Object.freeze([249, 122, 66, 22]);
export const CUSTOM_REP = Object.freeze([249, 146, 66, 22]);
export const CUSTOM_EXIT = Object.freeze([263, 172, 38, 21]);

// U20b - CreateCharSpecialAdvantageWindow. CUST01I0.IMG is the window
// (168x198) and CUST02I0.IMG (168x31) is the OVERLAY that retitles it
// from Disadvantages to Special Advantages (:243-254) - the same art
// serves both, which is why only the advantages arm draws the strip.
// The panel is Left/Top (:236-237, :248-249), NOT the Center/Middle
// the reputation window uses (:110-111), so it sits at the origin.
export const SPECIAL_ADV_PANEL = Object.freeze([0, 0, 168, 198]);
export const SPECIAL_ADV_OVERLAY_H = 31;
export const SPECIAL_ADV_ADD = Object.freeze([80, 4, 72, 22]);     // addAdvantageButtonRect (:190)
export const SPECIAL_ADV_EXIT = Object.freeze([6, 179, 155, 13]);  // exitButtonRect (:191)
export const ADV_PICKER_ITEM_COUNT = 12;                           // advPickerItemCount (:45)
export const CUSTOM_HP_LABEL = Object.freeze([285, 55]);
export const CUSTOM_DAGGER_X = 220;
/** The skill label sits at (3,2) inside its button (:227). */
export const CUSTOM_SKILL_LABEL_OFF = Object.freeze([3, 2]);

// U19 - the biography-METHOD screen (CreateCharChooseBio.cs). The
// window is BUTN02I0.IMG centred on the native panel (:50-52,
// Center/Middle); the file decodes 184x168, so the panel sits at
// (68,16). Both buttons are BAKED in the art; the rects are DFU's.
export const BIO_METHOD_PANEL = Object.freeze([68, 16, 184, 168]);
export const BIO_CHOOSE_GENERATE = Object.freeze([8, 41, 167, 54]);       // chooseGenerateRect (:29)
export const BIO_CHOOSE_QUESTIONS = Object.freeze([8, 113, 167, 46]);     // chooseQuestionsRect (:30)

// U18 - the class QUESTIONS screen (CreateCharClassQuestions.cs).
export const QSCROLL_Y = 120;           // questionScroll.Position (:121)
export const QSCROLL_W = 320, QSCROLL_H = 80;   // the SCRL GFX header (always 320x80)
export const QSCROLL_TEXT_OFFSET = 16;  // topTextOffset (:47)
export const QSCROLL_TEXT_LEFT = 20;    // leftTextOffset (:46)
export const QSCROLL_FRAMES = 16;       // SCRL00I0 + SCRL01I0, 8 frames each, one contiguous list (:103-118)
/** The question label's row pitch - MultiFormatTextLabel stacks
 *  TextLabels at the font's glyph height, FONT0003's fixedHeight 7
 *  (the nativeTalk ROW_H law). */
export const QUESTION_ROW_H = 7;
/** The constellations' palette slots, in the flow's [warrior, rogue,
 *  mage] weight order - warriorPaletteIndex 192, roguePaletteIndex
 *  160, magePaletteIndex 128 (:48-50). */
const CONSTELLATION_INDICES = Object.freeze([192, 160, 128]);
/** questionLabel: TextColor = Color.black, ShadowPosition zero (:262-263). */
const QUESTION_TEXT_COLOR = [0, 0, 0, 1];

/** The rows a class-description box carries, or null. */
export function classDescriptionLines(classIndex) {
  const rows = _art?.textRsc?.linesById(CLASS_DESCRIPTION_TEXT_ID + classIndex) ?? [];
  return rows.length ? rows : null;
}

/** U20a: a bare TEXT.RSC record as box rows, or null - the builder's
 *  refusal boxes (301/300/302/306), the rep gate (303) and the help
 *  topics (2400-2407). */
export function textRecordLines(id) {
  const rows = _art?.textRsc?.linesById(id) ?? [];
  return rows.length ? rows : null;
}

// StatsRollout.cs:88-127 - value panel (8,33) 34x6 stepping 22, the
// select button (7,20) 36x20 stepping 22, spinner at (44, 21+22i).
const STAT_PANEL = [8, 33, 34, 6], STAT_BUTTON = [7, 20, 36, 20], STAT_STEP = 22;
const STAT_SPINNER_X = 44, STAT_SPINNER_Y = 21;
// CreateCharAddBonusStats.cs:94-100 - the derived labels.
const DERIVED_POS = Object.freeze({
  damage: [83, 22], encumbrance: [103, 32], spellPoints: [112, 49],
  magicResist: [121, 71], toHit: [97, 93], hitPoints: [101, 110], healingRate: [122, 120],
});
// SkillsRollout.cs:182-236 - three groups, label x=68, value x=187,
// rows 10 apart, group tops 32 / 81 / 130; spinner x=203, tops -1.
const SKILL_LABEL_X = 68, SKILL_VALUE_X = 187, SKILL_ROW_STEP = 10, SKILL_SPINNER_X = 203;
const SKILL_GROUP_TOP = Object.freeze({ primary: 32, major: 81, minor: 130 });
const SKILL_SPINNER_TOP = Object.freeze({ primary: 31, major: 80, minor: 129 });
// UpDownSpinner.cs:96-116 / LeftRightSpinner.cs:82-96.
const UD_SPINNER = { w: 15, h: 20, up: [0, 0, 15, 7], value: [0, 7, 15, 6], down: [0, 13, 15, 7] };
const LR_SPINNER = { left: [0, 0, 11, 9], value: [0, 2, 15, 9], right: [26, 0, 11, 9] };
// S3e / CreateCharBiography.cs:32-42 - the question block and the
// TEN answer buttons in two columns of five.
const BIOG_QUESTION_LINES = 2, BIOG_LINE_SPACE = 11;
const BIOG_QUESTION_LEFT = 30, BIOG_QUESTION_TOP = 23;
const BIOG_BUTTON_COUNT = 10, BIOG_BUTTONS_LEFT = 10, BIOG_BUTTONS_TOP = 71;
const BIOG_BUTTON_W = 149, BIOG_BUTTON_H = 24;
const BIOG_LABEL_OFF = [21, 5];   // the answer label inside its button

/** The i-th answer button's rect (:83-92): even indices in the left
 *  column, odd in the right, stepping a row every TWO. */
export const biogButtonRect = (i) => [
  i % 2 === 0 ? BIOG_BUTTONS_LEFT : BIOG_BUTTONS_LEFT + BIOG_BUTTON_W,
  BIOG_BUTTONS_TOP + Math.floor(i / 2) * BIOG_BUTTON_H,
  BIOG_BUTTON_W, BIOG_BUTTON_H,
];
export const BIOG_BUTTONS = BIOG_BUTTON_COUNT;

// U13 / CreateCharReflexSelect.cs:32-96 + ReflexPicker.cs:31-98 - the
// info panel at (0,15) carrying TEXT.RSC 307, and the picker at
// (127,148): five 66x9 buttons stacked, with CHAR05I1.IMG (66x45,
// baked at that very offset) as a five-band highlight strip. DFU
// draws band `0.2 * (4 - value)` in Unity's BOTTOM-UP texcoords,
// which is band `value` counted from the TOP.
export const REFLEX_INFO_TOP = 15;
export const REFLEX_INFO_TEXT_ID = 307;
export const REFLEX_PICKER = [127, 148, 66, 45];
export const REFLEX_ROW_H = 9;
/** EntityEnums.PlayerReflexes - 0 VeryHigh .. 4 VeryLow. */
export const PLAYER_REFLEXES = Object.freeze({ VeryHigh: 0, High: 1, Average: 2, Low: 3, VeryLow: 4 });
export const REFLEX_COUNT = 5;
export const reflexRowRect = (i, origin = REFLEX_PICKER) =>
  [origin[0], origin[1] + i * REFLEX_ROW_H, REFLEX_PICKER[2], REFLEX_ROW_H];

// ListBox.cs:36-37 - nine rows, one pixel of spacing.
export const CLASS_LIST_ROWS = 9;   // ListBox.cs:36 rowsDisplayed
const LIST_ROWS = CLASS_LIST_ROWS, LIST_ROW_SPACING = 1;

const IMG_NAMES = ['CHAR00I0.IMG', 'CHAR01I0.IMG', 'CHAR02I0.IMG', 'CHAR03I0.IMG', 'CHAR04I0.IMG', 'PICK00I0.IMG', 'TMAP00I0.IMG', 'CHAR02I1.IMG', 'CHAR03I1.IMG', 'BIOG00I0.IMG', 'CHAR05I0.IMG', 'CHAR05I1.IMG', 'BUTN01I0.IMG', 'BUTN02I0.IMG', 'CUST00I0.IMG', 'CUST08I0.IMG', 'CUST03I0.IMG', 'CUST01I0.IMG', 'CUST02I0.IMG'];

let _art = null;          // { imgs: Map<name, {tex,w,h}>, picker: DFBitmap }
let _faces = null;        // { key, tex[] } - the loaded race/gender face set
let _facePending = null;  // ASYNC NEVER DROPS: the coalesced follow-up
let _deps = null;

/** F2: the three FLCPlayer panels (CreateCharClassQuestions :141-165),
 *  indexed by the WEIGHT index an answer resolves to - 0 warrior,
 *  1 rogue, 2 mage - at DFU's verbatim panel positions. The
 *  transparent colour is (0,0,10) and Loop is false. */
export const CEL_FILES = Object.freeze([
  Object.freeze({ name: 'WARRIOR.CEL', x: 110, y: 1 }),
  Object.freeze({ name: 'ROGUE.CEL', x: 1, y: 1 }),
  Object.freeze({ name: 'MAGE.CEL', x: 79, y: 1 }),
]);
const CEL_TRANSPARENT = Object.freeze([0, 0, 10]);
let _celActive = -1;   // the weight index playing, or -1 (DFU's animPlaying)

/** Load one IMG as a texture (the nativePanel loader shape) plus,
 *  for TAMRIEL2, the RAW indexed bitmap the click law reads. */
async function loadOne(deps, name) {
  const img = new ImgFile();
  img.load(await deps.fetchBytes(name), name, deps.palette);
  const bmp = img.getDFBitmap();
  return { tex: deps.renderer.uploadTexture('img', `chargen:${name}`, bitmapToColor32(bmp, deps.palette)), w: bmp.width, h: bmp.height, bmp };
}

export async function preloadChargenArt(deps) {
  if (_art) return;
  try {
    const imgs = new Map();
    for (const n of IMG_NAMES) imgs.set(n, await loadOne(deps, n));
    // TAMRIEL2.IMG is never DRAWN - CreateCharRaceSelect reads its
    // palette INDEX at the click point and that index is the race id
    // (RaceTemplate.GetRaceDictionary keys on ID), so only the raw
    // indexed bitmap is needed.
    const picker = (await loadOne(deps, 'TAMRIEL2.IMG')).bmp;
    // U11: the race confirm box quotes TEXT.RSC by the template's
    // DescriptionID, so the strings ride with the art.
    let textRsc = null;
    try { textRsc = new TextRsc().load(await deps.fetchBytes('TEXT.RSC')); }
    catch { console.warn('[chargen] TEXT.RSC unavailable; the race description box stays bare'); }
    // U18: the class-questions art in its own guard, so a missing GFX
    // never costs the other screens their art. CHGN00I0 is PALETTIZED
    // (its 768 palette bytes follow the image, x4 on load) and
    // ImgFile._readPalette writes INTO the palette it was handed - so
    // it gets its OWN DFPalette, never the shared ART_PAL. The scroll
    // GFX files borrow that palette exactly as DFU assigns
    // scrollFile.Palette = backgroundBitmap.Palette (:106-107).
    let questions = null;
    try {
      const chgnPalette = new DFPalette();
      const chgnImg = new ImgFile();
      chgnImg.load(await deps.fetchBytes('CHGN00I0.IMG'), 'CHGN00I0.IMG', chgnPalette);
      const chgnBmp = chgnImg.getDFBitmap();   // reads the embedded palette
      const scroll = [];
      for (const name of ['SCRL00I0.GFX', 'SCRL01I0.GFX']) {
        const gfx = new GfxFile();
        gfx.load(await deps.fetchBytes(name), name);
        for (let i = 0; i < gfx.getFrameCount(); i++) {
          const bmp = gfx.getDFBitmap(0, i);
          scroll.push({ tex: deps.renderer.uploadTexture('img', `chargen:${name}:${i}`, bitmapToColor32(bmp, chgnPalette)), w: bmp.width, h: bmp.height });
        }
      }
      // AUDIT 17k F1: the PRISTINE slot colours, captured at load. DFU
      // constructs the window over a fresh ImgFile every time, so its
      // re-entry palette is always the file's own; the port keeps ONE
      // palette and must RESTORE these before drawing pristine, or a
      // second run's un-answered screen re-uploads the LAST run's
      // constellation blues under the 'pristine' key.
      const pristine = [192, 160, 128].map((i) => chgnPalette.get(i));
      // F2: the three constellation animations. Their own try, so a
      // missing CEL costs the ANIMATION and not the chart and scroll
      // (this block's own never-traps law), and ALL THREE OR NONE - a
      // half set would animate two answer paths and silently not the
      // third.
      let cels = [];
      try {
        for (const c of CEL_FILES) {
          const flc = new FlcFile();
          // the transparency switch must be set BEFORE load(): load()
          // decodes frame 0, and with it the COLOR_256 palette.
          flc.transparency = true;
          [flc.transparentRed, flc.transparentGreen, flc.transparentBlue] = CEL_TRANSPARENT;
          flc.load(await deps.fetchBytes(c.name), c.name);
          if (!flc.readyToPlay) throw new Error(`${c.name} did not decode`);
          cels.push({ ...c, player: new FlcPlayer(flc, { loop: false }), tex: null, texKey: null });
        }
      } catch (e) {
        cels = [];
        console.warn('[chargen] ROGUE/MAGE/WARRIOR.CEL unavailable; the constellations do not animate', e);
      }
      questions = { bmp: chgnBmp, palette: chgnPalette, pristine, scroll, texKey: null, tex: null, cels };
    } catch (e) { console.warn('[chargen] CHGN00I0/SCRL0*I0 unavailable; the class questions keep the text panel', e); }
    // AUDIT 18: DaggerfallUI.SmallFont is FONT0002 (DaggerfallUI.cs:155),
    // and the special advantage/disadvantage window draws its labels
    // AND both of its list pickers in it (CreateCharSpecialAdvantage
    // Window.cs:243, :263, :270, :273-274). FONT0002's fixedHeight is
    // 5 against FONT0003's 7, which is exactly why advPickerItemCount
    // is 12: 12 x (5+1) = 72 = the listBox height at
    // DaggerfallListPickerWindow.cs:83. In its own guard - a missing
    // FNT must not cost the other screens their art.
    let smallFont = null;
    try { smallFont = makeFont(deps.renderer, new FntFile().load(await deps.fetchBytes('FONT0002.FNT')), 'FONT0002'); }
    catch (e) { console.warn('[chargen] FONT0002.FNT unavailable; the advantages window falls back to the default font', e); }
    _art = { imgs, picker, textRsc, questions, smallFont };
    _deps = deps;
  } catch (e) { console.warn('[chargen] CHAR0*/PICK00/TMAP00 art unavailable; the interim text panels stand in', e); }
}
export const chargenArtLoaded = () => !!_art;
/** AUDIT 18: DaggerfallUI.SmallFont (FONT0002), the font the special
 *  advantage/disadvantage window and both of its pickers draw in. Null
 *  when the FNT could not be fetched, in which case the draw falls back
 *  to the caller's font. */
export const chargenSmallFont = () => _art?.smallFont ?? null;
export const chargenPickerBitmap = () => _art?.picker ?? null;

/** TAMRIEL2's index at a native point -> the race there, or null
 *  (CreateCharRaceSelect.cs:93-102 verbatim). */
export const raceAtProvince = (vx, vy) => raceAtPickerPoint(_art?.picker ?? null, vx, vy);

/** The law itself, over any DFBitmap ({ width, height, data }) - the
 *  shape ImgFile.getDFBitmap mints. Split out so it is testable
 *  without a GL renderer; the probe covers the real bitmap. */
export function raceAtPickerPoint(bmp, vx, vy) {
  if (!bmp) return null;
  const x = Math.floor(vx), y = Math.floor(vy);
  if (x < 0 || y < 0 || x >= bmp.width) return null;
  const off = y * bmp.width + x;
  if (off < 0 || off >= bmp.data.length) return null;
  return raceById(bmp.data[off]);
}

/** FacePicker.SetFaceTextures: the race/gender FACE CIF's ten head
 *  records. Coalesces rather than dropping an in-flight load. */
export async function loadFaceSet(raceKey, gender) {
  const key = `${raceKey}|${gender}`;
  if (_faces?.key === key || !_deps) return;
  if (_facePending) { _facePending = key; return; }
  _facePending = key;
  try {
    for (;;) {
      const want = _facePending;
      const [wantRace, wantGender] = want.split('|');
      const name = raceArt(wantRace, wantGender).heads;
      const cif = new CifRciFile();
      cif.load(await _deps.fetchBytes(name), name, _deps.palette);
      const set = { key: want, tex: [], size: [] };
      for (let i = 0; i < FACES_PER_RACE; i++) {
        const bmp = cif.getDFBitmap(i, 0);
        set.tex.push(_deps.renderer.uploadTexture('img', `face:${want}:${i}`, bitmapToColor32(bmp, _deps.palette)));
        set.size.push([bmp.width, bmp.height]);
      }
      if (_facePending !== want) continue;   // a newer identity arrived mid-load
      _faces = set;
      break;
    }
  } catch (e) { console.warn('[chargen] FACE CIF unavailable; the portrait stays bare', e); }
  finally { _facePending = null; }
}
export const faceSetLoaded = () => !!_faces;

/** RaceTemplate.DescriptionID through TEXT.RSC, split to rows
 *  (CreateCharRaceSelect.cs:104-106). */
export function raceDescriptionLines(race) {
  const t = _art?.textRsc;
  if (!t || !race) return [];
  // AUDIT 17g F2: the ROWS, with the record's own per-row alignment -
  // mapping them to bare strings threw away the JustifyCenter flag the
  // box needs.
  return t.linesById(race.descriptionId);
}

const img = (n) => _art.imgs.get(n);
const rowH = (font) => (font.fnt?.fixedHeight ?? 6) + LIST_ROW_SPACING;

/** DFU's AddTextLabel with the ALTERNATE shadow these rollouts use. */
const alt = (renderer, font, text, m, x, y, opts = {}) =>
  shadowText(renderer, font, text, m, x, y, { shadow: ALT_SHADOW_1, ...opts });

/** Draw the native screen for the flow's current state. Returns true
 *  when it drew (false = no art; the caller keeps its text panel). */
export function drawChargenNative(renderer, m, font, flow) {
  if (!_art || !font) return false;
  // U14 / THE MENU BACKDROP: DaggerfallBaseWindow.cs:40 paints the
  // parent panel BLACK behind the 320x200 native panel. Classic runs
  // chargen from the menu, so the world is NEVER visible around it;
  // the port ran it in-world and let the town show through the
  // letterbox on every screen. Black first, then the screen.
  drawMenuBackdrop(renderer);
  const s = flow.state;
  if (s === 'name') return drawName(renderer, m, font, flow);
  if (s === 'race') return drawRace(renderer, m, font, flow);
  if (s === 'gender') return drawGender(renderer, m, font, flow);
  if (s === 'face') return drawFace(renderer, m, font, flow);
  if (s === 'class') return drawClass(renderer, m, font, flow);
  if (s === 'classMethod') return drawClassMethod(renderer, m, font, flow);
  if (s === 'classQuestions') return drawClassQuestions(renderer, m, font, flow);
  if (s === 'bioMethod') return drawBioMethod(renderer, m, font, flow);
  if (s === 'customClass') return drawCustomClass(renderer, m, font, flow);
  if (s === 'stats') return drawStats(renderer, m, font, flow);
  if (s === 'skills') return drawSkills(renderer, m, font, flow);
  if (s === 'biography') return drawBiography(renderer, m, font, flow);
  if (s === 'reflexes') return drawReflexes(renderer, m, font, flow);
  if (s === 'summary') return drawSummary(renderer, m, font, flow);
  return false;
}

/** TEXT.RSC 307 - "Player reflexes determine..." - the rows the info
 *  panel carries, cached once the art is up. */
export function reflexInfoLines() {
  return _art?.textRsc?.linesById(REFLEX_INFO_TEXT_ID) ?? [];
}

function drawReflexes(renderer, m, font, flow) {
  drawImg(renderer, img('CHAR05I0.IMG'), m, 0, 0);
  // AUDIT 17h F3: the info panel is a PARCHMENT POPUP
  // (CreateCharReflexSelect.cs:60-88 calls SetDaggerfallPopupStyle),
  // centred horizontally and sized to its text plus the margins - not
  // bare rows laid over the map. U11 owns that frame, so the box lays
  // out here and the panel's own TOP (15) overrides the middle
  // alignment layoutMessageBox gives a free-standing box.
  const rows = reflexInfoLines();
  const box = layoutMessageBox(font, rows);
  const top = REFLEX_INFO_TOP;
  drawMessageBox(renderer, m, font, { ...box, y: top, textY: top + (box.textY - box.y) });
  drawReflexBlock(renderer, m, flow, REFLEX_PICKER);
  return true;
}

/** ReflexPicker.Draw (:59-64) - the CHAR05I1 strip's band for the
 *  current pick, blitted into the SELECTED button's rect. DFU picks
 *  band `0.2 * (4 - value)` in Unity's bottom-up texcoords, which is
 *  band `value` counted from the top. Shared by the reflex screen and
 *  U16's summary, which differ only in where the panel sits. */
function drawReflexBlock(renderer, m, flow, origin) {
  const strip = img('CHAR05I1.IMG');
  // AUDIT 18: the SUMMARY carries its own ReflexPicker value, re-seeded
  // from the document on every push and only committed by OK.
  const picked = flow.state === 'summary' ? flow.sumReflexes : flow.reflexes;
  const v = Math.max(0, Math.min(REFLEX_COUNT - 1, picked ?? PLAYER_REFLEXES.Average));
  const [px, py] = origin;
  renderer.drawScreenQuad(strip.tex,
    { x: m.ox + px * m.s, y: m.oy + (py + v * REFLEX_ROW_H) * m.s, w: REFLEX_PICKER[2] * m.s, h: REFLEX_ROW_H * m.s },
    { u0: 0, v0: v / REFLEX_COUNT, u1: 1, v1: (v + 1) / REFLEX_COUNT });
}

/** U13: the class's backstory prose, its %qN macros expanded from the
 *  player's own answers (GenerateBackstory). */
export const buildBackstory = (backstoryId, effects) =>
  generateBackstory(_art?.textRsc ?? null, backstoryId, effects).map((r) => r.text);

/** U13: TEXT.RSC 35's rows with %r1..%r5 filled from DigestRepChanges
 *  - the box that closes the biography screen. */
export function repBoxRows(changed) {
  const t = _art?.textRsc;
  if (!t || !changed) return null;
  return t.linesById(35).map((r) => ({
    ...r,
    text: r.text.replace(/%r([1-5])/g, (_, n) => String(changed[Number(n) - 1] ?? 0)),
  }));
}

function drawBiography(renderer, m, font, flow) {
  drawImg(renderer, img('BIOG00I0.IMG'), m, 0, 0);
  if (flow.biogRepBox) {
    const box = layoutMessageBox(font, flow.biogRepBox);
    drawMessageBox(renderer, m, font, box);
    return true;
  }
  const q = flow.biogQuestion?.();
  if (!q) return true;
  for (let j = 0; j < BIOG_QUESTION_LINES; j++) {
    if (!q.text[j]) continue;
    shadowText(renderer, font, q.text[j], m, BIOG_QUESTION_LEFT, BIOG_QUESTION_TOP + j * BIOG_LINE_SPACE);
  }
  // the answers fill the buttons in order; the rest stay BLANK
  // (PopulateControls blanks the remaining labels, :104-118)
  for (let i = 0; i < BIOG_BUTTON_COUNT; i++) {
    const a = q.answers[i];
    if (!a) continue;
    const [bx, by] = biogButtonRect(i);
    shadowText(renderer, font, a.text, m, bx + BIOG_LABEL_OFF[0], by + BIOG_LABEL_OFF[1],
      { color: i === flow.cursor ? SELECTED_TEXT : DEFAULT_TEXT_COLOR });
  }
  return true;
}

function drawName(renderer, m, font, flow) {
  drawImg(renderer, img('CHAR00I0.IMG'), m, 0, 0);
  // U15: the RANDOM button - a grey backing with a black-shadowed
  // label (CreateCharNameSelect.cs:78-82). It is only ENABLED once a
  // race is known (:112-119), which the classic wizard order now
  // guarantees: race is the first screen.
  const [rx, ry, rw, rh] = RECTS.randomName;
  drawRect(renderer, m, rx, ry, rw, rh, RANDOM_BUTTON_BG);
  const lw = measureText(font.fnt, RANDOM_LABEL);
  shadowText(renderer, font, RANDOM_LABEL, m, rx + Math.round((rw - lw) / 2), ry + 2,
    { shadow: [0, 0, 0, 1] });
  // TextBox at (80,5) 214x7 - the input colour, not the default
  const [bx, by] = RECTS.nameBox;
  shadowText(renderer, font, `${flow.name}_`, m, bx, by, { color: INPUT_TEXT });
  return true;
}

/** U16 - CreateCharSummary (CHAR04I0.IMG). The wizard's closing screen
 *  is not a new layout so much as a COMPOSITE: Setup (:63-96) adds the
 *  stats rollout, the skills rollout, the reflex picker at (246,95),
 *  the face picker and a name box, then two buttons. Every one of
 *  those components is already ported for its own screen, so the
 *  summary draws the same blocks over a different background - which
 *  is why they were extracted rather than copied. */
function drawSummary(renderer, m, font, flow) {
  drawImg(renderer, img('CHAR04I0.IMG'), m, 0, 0);
  drawStatBlock(renderer, m, font, statView(flow));
  drawSkillBlock(renderer, m, font, flow);
  drawFaceBlock(renderer, m, flow);
  drawReflexBlock(renderer, m, flow, SUMMARY_REFLEX_ORIGIN);
  // the name is EDITABLE here too (textBox at 100,5) - the caret says so
  const [bx, by] = RECTS.summaryName;
  shadowText(renderer, font, `${flow.sumName ?? flow.name}_`, m, bx, by, { color: INPUT_TEXT });
  // "You must distribute your bonus points" - a ClickAnywhereToClose
  // parchment box over the screen (:180-186).
  if (flow.poolBox) drawMessageBox(renderer, m, font, layoutMessageBox(font, flow.poolBox));
  return true;
}

/** TEXT.RSC 14 - strYouMustDistributeYourBonusPoints (:32). */
export function bonusPointsRows() {
  return _art?.textRsc?.linesById(SUMMARY_BONUS_TEXT_ID) ?? [''];
}

function drawRace(renderer, m, font, flow) {
  drawImg(renderer, img('TMAP00I0.IMG'), m, 0, 0);
  // promptLabel (0,16) CENTERED, default colour + default shadow
  shadowText(renderer, font, 'Please select your home province...', m, 0, 16, { align: 'center', w: 320 });
  // The keyboard flow's current race, named UNDER the prompt - the
  // classic map names nothing (you click a province), but the up/down
  // seam has to be legible without a click (phone + probe drive it by
  // key). Under the prompt, not over the banner at the map's foot.
  shadowText(renderer, font, flow.race.name, m, 0, 26, { align: 'center', w: 320, color: SELECTED_TEXT });
  // U11: a province click opens the race's DESCRIPTION in a Yes/No
  // box (CreateCharRaceSelect.cs:100-112) - Yes accepts the race and
  // leaves the screen, No returns to the map.
  if (flow.raceConfirm) {
    const lines = flow.raceConfirm;
    const box = layoutMessageBox(font, lines, [MB_BUTTONS.Yes, MB_BUTTONS.No]);
    flow._raceBox = box;
    drawMessageBox(renderer, m, font, box);
  } else {
    flow._raceBox = null;
  }
  return true;
}

/** CreateCharGenderSelect is a DaggerfallMessageBox over the province
 *  map: the TEXT.RSC 2200 prompt with the Male and Female buttons.
 *  U11 gave the port the parchment frame, so it is the real box now -
 *  the flat black panel U10 shipped is gone. */
export const GENDER_PROMPT = 'Select thy character\'s gender.';   // TEXT.RSC 2200
export const genderBox = (font) => layoutMessageBox(font, [GENDER_PROMPT], [MB_BUTTONS.Male, MB_BUTTONS.Female]);

function drawGender(renderer, m, font, flow) {
  drawImg(renderer, img('TMAP00I0.IMG'), m, 0, 0);
  const box = genderBox(font);
  flow._genderBox = box;   // the hit path has no font; the draw hands it the geometry
  if (!drawMessageBox(renderer, m, font, box)) return true;
  // the keyboard flow's current pick, named under the box - classic
  // has no selected STATE here (you click a button and the window
  // closes), but the up/down seam has to be legible
  shadowText(renderer, font, flow.gender === 'male' ? 'Male' : 'Female', m,
    box.x, box.y + box.h + 4, { align: 'center', w: box.w, color: SELECTED_TEXT });
  return true;
}

function drawFace(renderer, m, font, flow) {
  drawImg(renderer, img('CHAR01I0.IMG'), m, 0, 0);
  drawFaceBlock(renderer, m, flow);
  return true;
}

/** FacePicker (FacePicker.cs:55-57) - the 64x40 display panel at
 *  (247,25), on the face screen and on U16's summary alike. */
function drawFaceBlock(renderer, m, flow) {
  const [px, py, pw, ph] = RECTS.faceDisplay;
  if (_faces) {
    // facePanel is Center/Middle inside the 64x40 display panel
    // AUDIT 18: the face SCREEN draws its own picker value (reset to 0
    // on every push, CreateCharFaceSelect.cs:65-69); the SUMMARY's
    // picker is seeded from the document (CreateCharSummary.cs:132).
    const i = Math.max(0, Math.min(FACES_PER_RACE - 1, flow.state === 'face' ? flow.facePick : flow.faceIndex));
    const [fw, fh] = _faces.size[i];
    renderer.drawScreenQuad(_faces.tex[i], {
      x: m.ox + Math.round(px + (pw - fw) / 2) * m.s,
      y: m.oy + Math.round(py + (ph - fh) / 2) * m.s,
      w: fw * m.s, h: fh * m.s,
    });
  }
}

function drawClassConfirm(renderer, m, font, flow) {
  if (!flow.classConfirm) { flow._classBox = null; return; }
  const box = layoutMessageBox(font, flow.classConfirm, [MB_BUTTONS.Yes, MB_BUTTONS.No]);
  flow._classBox = box;
  drawMessageBox(renderer, m, font, box);
}

/** U20a: DaggerfallListPickerWindow's body over PICK00I0, extracted
 *  from the class list so the builder's skill and help pickers share
 *  it (ONE DFU MEMBER, ONE EXPORT). Draws the visible window from
 *  `scroll`, the selected row in the selected colour; returns the
 *  panel origin + row height for the caller's overlays.
 *
 *  ROAD-D2 drew the THUMB. AUDIT 17g flagged it because the three
 *  texture slices were unidentified and inventing a colour would
 *  break the NATIVE-WINDOW RULE; ROAD-A7 then identified and carried
 *  them (vScrollThumbTop/Body/Bottom, fifteen literal bytes in
 *  ui/verticalScrollBar.js), so nothing is invented here: the bar is
 *  the picker panel's own 5x82 at (181,23) (RECTS.pickScroll,
 *  DaggerfallListPickerWindow.cs:96-99), the span is
 *  VerticalScrollBar.cs:206-211 verbatim through thumbSpan, and Draw
 *  (:135-139) paints NOTHING when the list fits - which thumbSpan's
 *  null carries. The rail and both arrows are baked into PICK00I0.
 *
 *  ROAD-E2 SHIPPED THE HIT, which AUDIT 17g had narrowed to itself.
 *  All three of chargenHit's picker arms now answer `PICK_SCROLL_RECT`
 *  with `{ pickBar: [vx, vy] }`, and `ChargenFlow` drives DFU's own
 *  component through it - one `VerticalScrollBar` (ui/verticalScrollBar.js,
 *  the same object the shared list picker and the item scroller use),
 *  re-pointed each frame at whichever picker is open by
 *  `_openPickList` + `syncPickBar`, which are
 *  DaggerfallListPickerWindow.Update (:103-119) verbatim: TotalUnits
 *  from the live list, DisplayUnits from RowsDisplayed, and the index
 *  flowing FROM the bar while the thumb is dragged and TO it
 *  otherwise. `press()` is MouseClick's trough paging (:142-150) and
 *  Update's drag latch (:105-113); `flow.hover` is Update's per-frame
 *  arm, polling the host's `e.buttons & 1` for
 *  InputManager.GetMouseButton(0) exactly as ui/listPicker.js:259
 *  does. The held-button frame the flag named is that hover seam, and
 *  every host that runs the wizard already routes it
 *  (townTalk.hover for world.js and exterior.js, overlayHover for
 *  dungeonContext.js; worldModes.js and interior.js never run it). */
function drawListPicker(renderer, m, font, names, scroll, selected, rows = LIST_ROWS) {
  const [ox, oy] = PICK_PANEL;
  drawImg(renderer, img('PICK00I0.IMG'), m, ox, oy);
  const [lx, ly] = RECTS.pickList;
  const h = rowH(font);
  for (let i = 0; i < rows; i++) {
    const idx = scroll + i;
    if (idx >= names.length) break;
    const y = ly + i * h;
    // AUDIT 18: the height break here was the port's own invention.
    // ListBox.Draw clips on rowsDisplayed ALONE (ListBox.cs:313), and
    // the caller's row count is what makes the two agree - 9 rows of
    // FONT0003 and 12 of FONT0002 both fill the 72px list exactly.
    shadowText(renderer, font, names[idx], m, ox + lx, oy + y,
      { color: idx === selected ? SELECTED_TEXT : DEFAULT_TEXT_COLOR, shadow: DEFAULT_SHADOW_COLOR });
  }
  drawPickerScrollThumb(renderer, m, names.length, rows, scroll);
  return [ox, oy, h];
}

/** ROAD-D2 - the picker's scrollBar (DaggerfallListPickerWindow.cs:96-99
 *  is the rect; VerticalScrollBar.cs:132-221 is everything it does).
 *  Its own function because it is its own COMPONENT in DFU and because
 *  it needs no art: PICK00I0 has the rail and the arrows baked in, the
 *  thumb is the three carried slices, so this pins bare where the rest
 *  of drawListPicker cannot. Update (:103-119) refreshes TotalUnits
 *  from the live list and DisplayUnits from RowsDisplayed every frame,
 *  which is exactly the two arguments here - so the 9-row class list
 *  and the 15-row SmallFont pickers each take their own fraction of
 *  the rail. */
export function drawPickerScrollThumb(renderer, m, totalUnits, displayUnits, scrollIndex) {
  const [ox, oy] = PICK_PANEL;
  const [sx, sy, sw, sh] = RECTS.pickScroll;
  return drawScrollThumb(renderer, m, [ox + sx, oy + sy, sw, sh],
    thumbSpan(sh, totalUnits, displayUnits, scrollIndex));
}

function drawClass(renderer, m, font, flow) {
  // U14: a DaggerfallPopupWindow is pushed OVER the previous window,
  // which keeps drawing beneath it - so the picker sits on the FACE
  // screen it was opened from, dimmed, not on a bare backdrop.
  drawFace(renderer, m, font, flow);
  // DaggerfallUI.ScreenDimColor over that previous window.
  drawRect(renderer, m, 0, 0, 320, 200, SCREEN_DIM);
  // AUDIT 17g F6: the scroll index is the LIST'S STATE, moved
  // minimally as the selection leaves the window (ListBox.cs:709-730)
  // - not a centred window recomputed here every frame. U20a: the
  // list's LAST row is Custom.
  const names = Array.from({ length: flow.classRowCount() }, (_, i) => flow.classRowName(i));
  const [, , h] = drawListPicker(renderer, m, font, names, flow.classScroll ?? 0, flow.classListIndex);
  flow._classRowH = h;   // the hit path has no font (the _genderBox pattern)
  drawClassConfirm(renderer, m, font, flow);
  return true;
}

/** U18 - CreateCharChooseClassGen: BUTN01I0.IMG centred on the native
 *  panel (:49-51), its two buttons BAKED in the art. A
 *  DaggerfallPopupWindow draws over its previous window - here the
 *  race map (the wizard constructs it with createCharRaceSelectWindow,
 *  DaggerfallStartNewGameWizard.cs:144) - dimmed, the U14 popup law. */
function drawClassMethod(renderer, m, font, flow) {
  drawImg(renderer, img('TMAP00I0.IMG'), m, 0, 0);
  drawRect(renderer, m, 0, 0, 320, 200, SCREEN_DIM);
  const [px, py, pw, ph] = METHOD_PANEL;
  drawImg(renderer, img('BUTN01I0.IMG'), m, px, py);
  // the keyboard cursor's legibility line under the panel (the gender
  // screen's seam) - classic's two buttons are mouse-only
  shadowText(renderer, font, flow.methodCursor === 0 ? 'Choose from a list' : 'Answer ten questions', m,
    px, py + ph + 4, { align: 'center', w: pw, color: SELECTED_TEXT });
  return true;
}

/** U20a - CreateCharReputationWindow: CUST03I0.IMG (168x189) centred,
 *  so the panel sits at (76,5). The five columns' bars are flat
 *  COLOUR panels 5 wide (:37-41,203-232): green grows UP from the
 *  middle line for positive rep, red DOWN from middle+1 for negative;
 *  the per-column value labels sit at y143, the balance at (64,173). */
// Center/Middle of a 168x189 image on the 320x200 panel: x is exactly
// 76, and y is DFU's own 5.5 - Unity's alignment is float math and
// the panel really does land on the half pixel (the mapping carries
// it: m.oy + 5.5 * scale).
const REP_PANEL = Object.freeze([76, 5.5, 168, 189]);
const REP_COLUMN_X = Object.freeze([3, 36, 69, 102, 135]);        // merchants..underworld (:123-127)
const REP_LABEL_X = Object.freeze([18, 50, 82, 114, 146]);        // :131-135
// ONE DFU MEMBER, ONE EXPORT: the five-group ORDER is REP_GROUPS,
// declared once in the laws module - this file imports it.

function drawCustomRep(renderer, m, font, flow) {
  const [px, py] = REP_PANEL;
  drawImg(renderer, img('CUST03I0.IMG'), m, px, py);
  const reps = flow.custom.reps;
  REP_GROUPS.forEach((g, i) => {
    const v = reps[g] ?? 0;
    if (v > 0) {
      // greenBar.Position.y = 76 - v*5, height = 76 - position
      drawRect(renderer, m, px + REP_COLUMN_X[i], py + 76 - v * 5, 5, v * 5, REP_GREEN);
    } else if (v < 0) {
      // redBar sits at y77 and grows by -v*5
      drawRect(renderer, m, px + REP_COLUMN_X[i], py + 77, 5, -v * 5, REP_RED);
    }
    shadowText(renderer, font, String(v), m, px + REP_LABEL_X[i], py + 143);
  });
  // distributePtsLabel prints the WINDOW'S field, which is 0 until a
  // bar is clicked - not a fresh sum of the bars (:136,283-287)
  shadowText(renderer, font, String(flow.custom.repPoints ?? 0), m, px + 64, py + 173);
  return true;
}

/** U20b - CreateCharSpecialAdvantageWindow. ONE window serves both
 *  lists: CUST01I0 is the body, and the advantages arm lays CUST02I0
 *  over its top strip to retitle it (:243-254). The label block is the
 *  laws module's own layout (UpdateLabels), so the draw and the click
 *  test cannot disagree about where a row is. The primary/secondary
 *  pickers are DaggerfallListPickerWindows pushed OVER this one, the
 *  same component the class list and the skill picker ride. */
function drawSpecialAdv(renderer, m, font, flow) {
  const c = flow.custom;
  const [px, py] = SPECIAL_ADV_PANEL;
  drawImg(renderer, img('CUST01I0.IMG'), m, px, py);
  if (c.sub === 'advantage') drawImg(renderer, img('CUST02I0.IMG'), m, px, py);
  // DFU's rows are TextLabels with their own click handlers, so a
  // click only removes an item when it lands ON the text - the widths
  // are cached here for the hit test, the `_rowH` idiom.
  // AUDIT 18: this window is drawn in SmallFont (:243 sets `font =
  // DaggerfallUI.SmallFont` and :263 hands it to every label), not the
  // FONT0003 the rest of the arc uses.
  const f = _art.smallFont ?? font;
  const rows = labelRows(c.sub === 'advantage' ? c.advantages : c.disadvantages);
  for (const row of rows) {
    shadowText(renderer, f, row.text, m, px + LABEL_ORIGIN[0], py + row.y);
    row.w = measureText(f.fnt, row.text);
  }
  c._advRows = rows;
  // the two pickers push over the window (:271-278), BOTH constructed
  // with SmallFont and advPickerItemCount = 12 rows
  if (c.pickList) {
    const [, , h] = drawListPicker(renderer, m, f, c.pickList.map(labelFor), c.pickScroll, c.pickCursor, ADV_PICKER_ITEM_COUNT);
    c._rowH = h;
  }
  return true;
}

/** U20a - CreateCharCustomClass (CUST00I0.IMG full-screen): the name
 *  box, the freeEdit stats rollout, the twelve skill buttons' labels,
 *  the HP label and the difficulty DAGGER (CUST08I0 at x220, its Y
 *  from the difficulty law). CG1: the dagger's one-second fading
 *  TRAIL draws too - AnimateDagger's machine lives in
 *  systems/customClass.js (tickDaggerTrails), and the trails draw
 *  AFTER the dagger, DFU's Components.Add order. Sub-windows draw
 *  OVER it, as their pushes do. */
function drawCustomClass(renderer, m, font, flow) {
  const c = flow.custom;
  if (!c) return false;   // the hit path guards the same way
  drawImg(renderer, img('CUST00I0.IMG'), m, 0, 0);
  // the name TextBox at (100,5) 214x7 (:157-160) - the input colour
  const [nx, ny] = [100, 5];
  shadowText(renderer, font, `${c.className}_`, m, nx, ny, { color: INPUT_TEXT });
  drawStatBlock(renderer, m, font, customStatView(flow));
  // the twelve skill labels inside their buttons (:225-228)
  CUSTOM_SKILL_RECTS.forEach((r, i) => {
    const id = c.skills[i];
    if (id == null) return;
    shadowText(renderer, font, SKILL_NAMES[id], m, r[0] + CUSTOM_SKILL_LABEL_OFF[0], r[1] + CUSTOM_SKILL_LABEL_OFF[1]);
  });
  // hpLabel (:169) and the difficulty dagger (:500-512)
  shadowText(renderer, font, String(c.hp), m, ...CUSTOM_HP_LABEL);
  const dagger = img('CUST08I0.IMG');
  const dy = daggerY(flow.customDifficulty());
  drawImg(renderer, dagger, m, CUSTOM_DAGGER_X, dy);
  // CG1: AnimateDagger's trail - a full-alpha copy spawns where the
  // dagger LANDS and fades over one second, so a spot it leaves within
  // that second keeps a fading ghost. Drawn after the dagger
  // (Components.Add order); the ghost under the live dagger is an
  // identical sprite over an identical sprite, invisible - as in DFU.
  c._daggerTrails ??= {};
  for (const t of tickDaggerTrails(c._daggerTrails, dy, performance.now() / 1000)) {
    drawImg(renderer, dagger, m, CUSTOM_DAGGER_X, t.y, dagger.w, dagger.h, [1, 1, 1, t.alpha], { blend: true });
  }
  // the sub-windows, each pushed OVER this one
  if (c.sub === 'skillPick') {
    const names = c.pickItems.map((id) => SKILL_NAMES[id]);
    const [, , h] = drawListPicker(renderer, m, font, names, c.pickScroll, c.pickCursor);
    c._rowH = h;
  } else if (c.sub === 'help') {
    const [, , h] = drawListPicker(renderer, m, font, HELP_TOPICS.map(([label]) => label), c.pickScroll, c.pickCursor);
    c._rowH = h;
  } else if (c.sub === 'rep') {
    drawCustomRep(renderer, m, font, flow);
  } else if (c.sub === 'advantage' || c.sub === 'disadvantage') {
    drawSpecialAdv(renderer, m, font, flow);
  }
  // the refusal / help boxes are ClickAnywhereToClose parchment
  if (c.box) drawMessageBox(renderer, m, font, layoutMessageBox(font, c.box));
  return true;
}

/** U19 - CreateCharChooseBio: BUTN02I0.IMG centred (:50-52), its two
 *  buttons BAKED in the art. The popup draws over its previous window
 *  - the race map again (the wizard constructs it with
 *  createCharRaceSelectWindow, :180) - dimmed, the U14 popup law. The
 *  GENERATE arm's reputation box shows over THIS screen (the wizard
 *  pushes it over createCharChooseBioWindow, :444). */
function drawBioMethod(renderer, m, font, flow) {
  drawImg(renderer, img('TMAP00I0.IMG'), m, 0, 0);
  drawRect(renderer, m, 0, 0, 320, 200, SCREEN_DIM);
  const [px, py, pw, ph] = BIO_METHOD_PANEL;
  drawImg(renderer, img('BUTN02I0.IMG'), m, px, py);
  if (flow.biogRepBox) {
    drawMessageBox(renderer, m, font, layoutMessageBox(font, flow.biogRepBox));
    return true;
  }
  // the keyboard cursor's legibility line under the panel (the U18 seam)
  shadowText(renderer, font, flow.bioMethodCursor === 0 ? 'Have your history generated' : 'Answer questions', m,
    px, py + ph + 4, { align: 'center', w: pw, color: SELECTED_TEXT });
  return true;
}

/** U18 / AUDIT 17k F1: the constellation palette law, pure. Answered
 *  runs write (0, 0, blue) into the three slots - blue 8 + 24 per
 *  answer on that path (CEL_OnAnimEnd :504-513 rebuilds the texture
 *  from the mutated palette). A pristine draw (no answers yet)
 *  RESTORES the file's own slot colours: DFU constructs the window
 *  over a FRESH ImgFile every time, so its re-entry palette is always
 *  the file's own; the port keeps one palette, and without the
 *  restore a second run's un-answered screen re-uploaded the LAST
 *  run's blues under the 'pristine' key. */
export function constellationPalette(palette, pristine, blues) {
  if (blues) for (let i = 0; i < 3; i++) palette.set(CONSTELLATION_INDICES[i], 0, 0, blues[i]);
  else for (let i = 0; i < 3; i++) palette.set(CONSTELLATION_INDICES[i], pristine[i].r, pristine[i].g, pristine[i].b);
}

/** F2 - FLCPlayer.Start() for the constellation an answer lit.
 *  Returns the animation's length in SECONDS, or 0 when there is
 *  nothing to play (no art, no CELs, a reader that will not start) -
 *  which is the flow's signal to run the anim-end body AT ONCE, i.e.
 *  exactly the behaviour this screen had before F2. */
export function startConstellationAnim(index) {
  const cels = _art?.questions?.cels;
  if (!cels?.length || !cels[index]) return 0;
  stopConstellationAnim();
  const cel = cels[index];
  // Re-arm: the frame buffer still holds the LAST run's final frame,
  // and Update() displays the CURRENT buffer before decoding the next
  // - without this, replays 2..10 would flash the previous run's end.
  cel.player.flc.bufferNextFrame(0);
  if (!cel.player.start()) return 0;
  _celActive = index;
  // AUDIT F2-P3: the duration must never read as "nothing to play"
  // once the player IS playing - a zero-frame or zero-delay CEL would
  // otherwise leave _celActive latched while the flow ran its end body
  // inline. A started animation always reports a positive length; the
  // flow's deadline is what bounds it.
  const secs = cel.player.flc.header.numOfFrames * cel.player.flc.frameDelay;   // frameDelay is SECONDS
  return secs > 0 ? secs : Number.MIN_VALUE;
}

/** One FLCPlayer.Update(). True while still playing; false on the
 *  tick it ended (which is the flow's cue to run the end body). */
export function tickConstellationAnim(dt) {
  if (_celActive < 0) return false;
  const cel = _art?.questions?.cels?.[_celActive];
  if (!cel) { _celActive = -1; return false; }
  cel.player.tick(dt > 0 ? dt : 0);
  return cel.player.playing;
}

/** FLCPlayer.Stop() + CEL_OnAnimEnd's texture clear. Idempotent, and
 *  safe with no art at all. */
export function stopConstellationAnim() {
  const cel = _art?.questions?.cels?.[_celActive];
  if (cel) {
    cel.player.stop();
    if (cel.texKey && _deps?.renderer) _deps.renderer.releaseTexture('img', cel.texKey);
    cel.tex = null;
    cel.texKey = null;
    cel.frameRef = null;
  }
  _celActive = -1;
}

/** Test/diagnostic seam: which constellation is playing, or -1. */
export const constellationAnimIndex = () => _celActive;

/** The CHGN00I0 background: the palette law above, textures versioned
 *  by the blues and the stale one released (the paperdoll ownership
 *  law). The PRISTINE palette shows until an animation ENDS - DFU
 *  writes the slots in CEL_OnAnimEnd (:504-513), never at the answer,
 *  which is what the flow's qPaintBlues carries (F2). */
function ensureChgnTexture(renderer, flow) {
  const q = _art.questions;
  const blues = flow.qPaintBlues ?? null;
  const rec = `CHGN00I0:${blues ? blues.join(',') : 'pristine'}`;
  if (q.texKey === rec) return;
  constellationPalette(q.palette, q.pristine, blues);
  if (q.texKey) renderer.releaseTexture('img', q.texKey);
  q.tex = renderer.uploadTexture('img', rec, bitmapToColor32(q.bmp, q.palette));
  q.texKey = rec;
}

/** U18 - CreateCharClassQuestions: the question scroll over the
 *  constellation chart, with the three constellation animations
 *  (F2). An answer lights ROGUE/MAGE/WARRIOR.CEL over the chart and
 *  the next question waits it out, as DFU does; the palette
 *  brightening lands when the animation ENDS. */
/** F2: the playing constellation, over the chart AND over the scroll.
 *  AUDIT F2-P1 corrected this: DFU adds textArea and questionScroll to
 *  NativePanel.Components FIRST (:128-129) and the three FLCPlayer
 *  panels LAST (:164-166), and Panel.Draw walks the children in
 *  ascending index order - so the constellations paint over the
 *  parchment, and over the question label, which is a child of the
 *  scroll (:276). The comment here used to claim the exact inverse.
 *  Uploads only when the frame CHANGED (the videoPlayer's
 *  release-then-upload law, so a frame cannot leak a texture per
 *  tick) - AUDIT F2-P2: the body had no such check either. */
function drawConstellationAnim(renderer, m) {
  const cel = _art?.questions?.cels?.[_celActive];
  const frame = cel?.player?.frame;
  if (!cel || !frame) return;
  const key = `chargen:cel:${cel.name}`;
  if (cel.frameRef !== frame) {   // FlcPlayer hands a NEW object per decoded frame
    if (cel.texKey) renderer.releaseTexture('img', cel.texKey);
    cel.tex = renderer.uploadTexture('img', key, frame);
    cel.texKey = key;
    cel.frameRef = frame;
  }
  drawImg(renderer, { tex: cel.tex, w: frame.width, h: frame.height }, m, cel.x, cel.y);
}

function drawClassQuestions(renderer, m, font, flow) {
  // EndQuestions (:400-413) blanks the background and the scroll
  // before the confirm box shows - only the box draws, over the
  // parent panel's black.
  if (flow.qConfirm) {
    const box = layoutMessageBox(font, flow.qConfirm, [MB_BUTTONS.Yes, MB_BUTTONS.No]);
    flow._qBox = box;
    drawMessageBox(renderer, m, font, box);
    return true;
  }
  flow._qBox = null;
  const q = _art.questions;
  if (!q || !flow.qDisplay) return false;
  ensureChgnTexture(renderer, flow);
  drawImg(renderer, { tex: q.tex, w: q.bmp.width, h: q.bmp.height }, m, 0, 0);
  const frame = q.scroll[flow.qScrollFrame % q.scroll.length];
  drawImg(renderer, frame, m, 0, QSCROLL_Y);
  // the question label: black, unshadowed (:262-263), rows at the
  // label position inside the scroll. CG1: DFU pixel-clips the label
  // to the textArea (MultiFormatTextLabel RestrictedRenderArea over
  // the Panel at (20, 136) 320x48, CreateCharClassQuestions.cs
  // :125-126, :268-271) - the scissor bracket shears the boundary row
  // AT THE PIXEL, so a scrolling line slides out instead of popping.
  // Rows wholly outside still skip; rows overlapping the edge draw and
  // let the scissor cut them.
  const top = QSCROLL_Y + QSCROLL_TEXT_OFFSET;
  const bottom = QSCROLL_Y + QSCROLL_H - QSCROLL_TEXT_OFFSET;
  renderer.setScreenScissor(m.ox + QSCROLL_TEXT_LEFT * m.s, m.oy + top * m.s, QSCROLL_W * m.s, (bottom - top) * m.s);
  for (let i = 0; i < flow.qDisplay.lines.length; i++) {
    const vy = QSCROLL_Y + flow.qLabelY + i * QUESTION_ROW_H;
    if (vy + QUESTION_ROW_H <= top || vy >= bottom) continue;
    drawText(renderer, font, flow.qDisplay.lines[i], m.ox + QSCROLL_TEXT_LEFT * m.s, m.oy + vy * m.s, m.s, QUESTION_TEXT_COLOR);
  }
  renderer.clearScreenScissor();
  drawConstellationAnim(renderer, m);   // LAST: DFU's anim panels are the last children (F2-P1)
  return true;
}

function drawSpinnerUD(renderer, m, font, x, y, value) {
  drawImg(renderer, img('CHAR02I1.IMG'), m, x, y, UD_SPINNER.w, UD_SPINNER.h);
  const [vx, vy, vw] = UD_SPINNER.value;
  alt(renderer, font, String(value), m, x + vx, y + vy, { align: 'center', w: vw });
}

function drawStats(renderer, m, font, flow) {
  drawImg(renderer, img('CHAR02I0.IMG'), m, 0, 0);
  drawStatBlock(renderer, m, font, statView(flow));
  // U16: the seven derived labels belong to THIS WINDOW, not to the
  // rollout - CreateCharAddBonusStats.cs:94-100 adds them to its
  // NativePanel and StatsRollout has never heard of them. Folding them
  // into the shared block put them on the summary too, where they
  // landed across the skill panels ("+BRIMARY SKILLS", a 110 over the
  // Axe row). The screenshot is what caught it.
  const d = flow.derived?.() ?? null;
  if (d) {
    alt(renderer, font, d.damage, m, ...DERIVED_POS.damage);
    alt(renderer, font, d.encumbrance, m, ...DERIVED_POS.encumbrance);
    alt(renderer, font, d.spellPoints, m, ...DERIVED_POS.spellPoints);
    alt(renderer, font, d.magicResist, m, ...DERIVED_POS.magicResist);
    alt(renderer, font, d.toHit, m, ...DERIVED_POS.toHit);
    alt(renderer, font, d.hitPoints, m, ...DERIVED_POS.hitPoints);
    alt(renderer, font, d.healingRate, m, ...DERIVED_POS.healingRate);
  }
  // AUDIT 18: "You must distribute your bonus points" - the same
  // ClickAnywhereToClose parchment box the summary pops (:189-194).
  if (flow.poolBox) drawMessageBox(renderer, m, font, layoutMessageBox(font, flow.poolBox));
  return true;
}

/** StatsRollout (StatsRollout.cs:88-127) - one component, drawn by the
 *  stats screen and by U16's summary, which composites it on CHAR04I0
 *  at the SAME geometry: CreateCharSummary news it up with
 *  onCharacterSheet false, so the (141,17)/24-step alternate layout is
 *  the character sheet's, not the summary's. */
function drawStatBlock(renderer, m, font, view) {
  const [sx, sy, sw] = STAT_PANEL;
  STAT_KEYS_ORDER.forEach((k, i) => {
    const v = view.stats[k];
    // U20a: in freeEdit the rollout's modifiedStatTextColor IS the
    // default text colour (StatsRollout.cs:76-80), so the builder's
    // values never turn green - there is no roll to differ from.
    const modified = !view.freeEdit && v !== view.rolled[k];
    alt(renderer, font, String(v), m, sx, sy + i * STAT_STEP, {
      align: 'center', w: sw,
      color: modified ? MODIFIED_STAT : DEFAULT_TEXT_COLOR,
    });
  });
  // the spinner rides the SELECTED stat's row and carries the pool
  drawSpinnerUD(renderer, m, font, STAT_SPINNER_X, STAT_SPINNER_Y + view.cursor * STAT_STEP, view.pool);
}

/** The flow's own rollout view (the stats screen + U16's summary). */
const statView = (flow) => ({ stats: flow.stats, rolled: flow.rolledStats, cursor: flow.statCursor, pool: flow.statPool });
/** U20a: the BUILDER's, in freeEdit. */
const customStatView = (flow) => ({ stats: flow.custom.stats, rolled: flow.custom.stats, cursor: flow.custom.statCursor, pool: flow.custom.statPool, freeEdit: true });

function drawSkills(renderer, m, font, flow) {
  drawImg(renderer, img('CHAR03I0.IMG'), m, 0, 0);
  drawSkillBlock(renderer, m, font, flow);
  // AUDIT 18: CreateCharAddBonusSkills.cs:126-130 pops the same box.
  if (flow.poolBox) drawMessageBox(renderer, m, font, layoutMessageBox(font, flow.poolBox));
  return true;
}

/** SkillsRollout (SkillsRollout.cs:182-236) - the summary's other
 *  composited component, same geometry again. U17 gave it its three
 *  real spinners, one per group. */
function drawSkillBlock(renderer, m, font, flow) {
  const lr = img('CHAR03I1.IMG');
  const bonuses = flow.skillBonuses?.() ?? null;
  let idx = 0;
  for (const [group, ids] of flow.skillRows()) {
    ids.forEach((id, i) => {
      const y = SKILL_GROUP_TOP[group] + i * SKILL_ROW_STEP;
      const v = flow.skills[id];
      const modified = v !== flow.rolledSkills[id];
      alt(renderer, font, SKILL_NAMES[id], m, SKILL_LABEL_X, y);
      // S3e: the BIOGRAPHY bonus shows on top of the working value
      // (CreateCharAddBonusSkills.cs:67-72 + SkillsRollout.cs:295-308)
      // but does NOT turn it green - that colour compares working
      // against ROLLED, and the bonus is not the player's spend.
      alt(renderer, font, String(v + (bonuses?.[id] ?? 0)), m, SKILL_VALUE_X, y, { color: modified ? MODIFIED_STAT : DEFAULT_TEXT_COLOR });
      idx++;
    });
    // U17: EACH GROUP has its own spinner, on its own selected row,
    // showing its own remaining pool (SkillsRollout.cs:240-262 builds
    // three; :356-372 positions each at (203, top + 10*index)). The
    // port drew ONE, on whichever row the shared cursor sat, so two of
    // the three pools were invisible until you walked into them.
    const sy = SKILL_SPINNER_TOP[group] + (flow.skillSel?.[group] ?? 0) * SKILL_ROW_STEP;
    drawImg(renderer, lr, m, SKILL_SPINNER_X, sy);
    // HorizontalAlignment.Center places the LABEL BOX inside its
    // PARENT (the 37-wide spinner), not the label inside itself -
    // which is what puts the number BETWEEN the two arrows
    // (left ends at 11, right starts at 26). Centering within the
    // label's own 15px alone drew it over the left arrow.
    const [, vy, vw] = LR_SPINNER.value;
    alt(renderer, font, String(flow.pools[group]), m, SKILL_SPINNER_X + (lr.w - vw) / 2, sy + vy, { align: 'center', w: vw });
  }
}

/** Pointer routing: a native point -> the flow ACTION it triggers, or
 *  null. Hosts feed this from their pointerdown seam (the U8b law:
 *  taps and clicks ride one path). */
export function chargenHit(flow, vx, vy) {
  const inRect = ([x, y, w, h]) => vx >= x && vy >= y && vx < x + w && vy < y + h;
  const s = flow.state;
  if (s === 'name') {
    if (inRect(RECTS.randomName)) return { randomName: true };
    return inRect(RECTS.ok) ? 'confirm' : null;
  }
  if (s === 'race') {
    if (flow._raceBox) {
      const hit = messageBoxHit(flow._raceBox, vx, vy);
      if (hit === MB_BUTTONS.Yes) return 'confirm';        // CloseWindow - the race stands
      if (hit === MB_BUTTONS.No) return { cancelRace: true };   // CancelWindow - back to the map
      return null;   // the box is modal: the map underneath is dead
    }
    const r = raceAtProvince(vx, vy);
    if (!r) return null;
    return { setRace: r.key, describe: raceDescriptionLines(r) };
  }
  if (s === 'gender') {
    // U11: the real BUTTONS.RCI rects, not the invented halves of a
    // flat panel. The layout needs the font, which the hit path does
    // not carry - the box geometry is font-INDEPENDENT for a single
    // known line width, so the flow caches the last drawn box.
    const box = flow._genderBox;
    if (!box) return null;
    const hit = messageBoxHit(box, vx, vy);
    if (hit === MB_BUTTONS.Male) return { setGender: 'male' };
    if (hit === MB_BUTTONS.Female) return { setGender: 'female' };
    return null;
  }
  if (s === 'face') {
    if (inRect(RECTS.facePrev)) return 'up';
    if (inRect(RECTS.faceNext)) return 'down';
    return inRect(RECTS.ok) ? 'confirm' : null;
  }
  if (s === 'class') {
    // U17: the class DESCRIPTION box is modal over the list, exactly
    // as the race screen's is (CreateCharClassSelect.cs:84-93 pushes a
    // DaggerfallMessageBox with Yes and No).
    if (flow._classBox) {
      const hit = messageBoxHit(flow._classBox, vx, vy);
      if (hit === MB_BUTTONS.Yes) return { confirmClass: true };   // sender.CloseWindow(); CloseWindow();
      if (hit === MB_BUTTONS.No) return { cancelClass: true };     // selectedClass = null; sender.CancelWindow();
      return null;
    }
    // AUDIT 17g F3 / U20a: this used to deref the loaded image for its
    // origin, so the ONE branch that needed art returned null where
    // every other screen answers art-free. PICK_PANEL is the constant
    // the draw uses too, so the pins can drive this path.
    const [ox, oy] = PICK_PANEL;
    const lx = vx - ox, ly = vy - oy;
    if (lx >= RECTS.pickPrev[0] && ly >= RECTS.pickPrev[1] && lx < RECTS.pickPrev[0] + 9 && ly < RECTS.pickPrev[1] + 9) return 'up';
    if (lx >= RECTS.pickNext[0] && ly >= RECTS.pickNext[1] && lx < RECTS.pickNext[0] + 9 && ly < RECTS.pickNext[1] + 9) return 'down';
    if (inRect(PICK_SCROLL_RECT)) return { pickBar: [vx, vy] };   // ROAD-E2: the bar answers in NATIVE coords - press() and the drag both want them
    // a click ON a row selects it (DaggerfallListPickerWindow's list)
    const [plx, ply, plw] = RECTS.pickList;
    if (lx >= plx && lx < plx + plw && ly >= ply) {
      const row = Math.floor((ly - ply) / (flow._classRowH || 1));
      const idx = (flow.classScroll ?? 0) + row;
      // U20a: the bound is the LIST's row count, not the careers'.
      // Bounding on careers.length left the CUSTOM row unclickable -
      // reachable by keyboard, dead to a tap, which is the U14
      // keyboard-only shape again. The live probe caught it.
      if (row >= 0 && row < LIST_ROWS && idx < flow.classRowCount()) return { setClass: idx };
    }
    return null;
  }
  if (s === 'classMethod') {
    // the panel geometry is fixed (headerless 184x144, centred), so
    // the hit needs no art - the pointer pin drives it bare
    const lx = vx - METHOD_PANEL[0], ly = vy - METHOD_PANEL[1];
    const inR = ([x, y, w, h]) => lx >= x && ly >= y && lx < x + w && ly < y + h;
    if (inR(METHOD_CHOOSE_CLASS)) return { classMethod: 'list' };
    if (inR(METHOD_CHOOSE_QUESTIONS)) return { classMethod: 'questions' };
    return null;
  }
  if (s === 'classQuestions') {
    // the description box is MODAL, Yes and No its only answers
    if (flow.qConfirm) {
      const hit = flow._qBox ? messageBoxHit(flow._qBox, vx, vy) : null;
      if (hit === MB_BUTTONS.Yes) return { confirmQClass: true };
      if (hit === MB_BUTTONS.No) return { cancelQClass: true };
      return null;
    }
    if (!flow.qDisplay) return null;
    if (vy < QSCROLL_Y || vy >= QSCROLL_Y + QSCROLL_H) return null;
    const ly = vy - QSCROLL_Y;
    // QuestionScroll_OnMouseDown (:452-466): the top margin scrolls
    // up, the bottom margin down - held-to-scroll in DFU, one pixel
    // per event here (the wheel repeats; a held touch does not, yet)
    if (ly < QSCROLL_TEXT_OFFSET) return { qScroll: -1 };
    if (ly > QSCROLL_H - QSCROLL_TEXT_OFFSET) return { qScroll: 1 };
    // the answer rows (:468-489): the row under the click - strict
    // bounds, NO x test, the LAST matching row wins - then the a/b/c
    // ranges over aIndex/bIndex/cIndex, all verbatim
    let labelIndex = 0;
    for (let i = 0; i < flow.qDisplay.lines.length; i++) {
      const top = flow.qLabelY + i * QUESTION_ROW_H;
      if (ly > top && ly < top + QUESTION_ROW_H) labelIndex = i;
    }
    const { aIndex, bIndex, cIndex } = flow.qDisplay;
    if (labelIndex >= aIndex && labelIndex < bIndex) return { answerClass: 0 };
    if (labelIndex >= bIndex && labelIndex < cIndex) return { answerClass: 1 };
    if (labelIndex >= cIndex) return { answerClass: 2 };
    return null;
  }
  if (s === 'customClass') {
    const c = flow.custom;
    if (!c) return null;
    // every open box is MODAL and ClickAnywhereToClose
    if (c.box) return { customBox: true };
    if (c.sub === 'skillPick' || c.sub === 'help') {
      const [ox, oy] = PICK_PANEL;
      const lx = vx - ox, ly = vy - oy;
      if (lx >= RECTS.pickPrev[0] && ly >= RECTS.pickPrev[1] && lx < RECTS.pickPrev[0] + 9 && ly < RECTS.pickPrev[1] + 9) return { pickStep: -1 };
      if (lx >= RECTS.pickNext[0] && ly >= RECTS.pickNext[1] && lx < RECTS.pickNext[0] + 9 && ly < RECTS.pickNext[1] + 9) return { pickStep: 1 };
      if (inRect(PICK_SCROLL_RECT)) return { pickBar: [vx, vy] };   // ROAD-E2: the bar answers in NATIVE coords - press() and the drag both want them
      const [plx, ply, plw] = RECTS.pickList;
      if (lx >= plx && lx < plx + plw && ly >= ply) {
        const row = Math.floor((ly - ply) / (c._rowH || 1));
        const n = c.sub === 'help' ? HELP_TOPICS.length : (c.pickItems?.length ?? 0);
        const idx = (c.pickScroll ?? 0) + row;
        if (row >= 0 && row < LIST_ROWS && idx < n) return { pickRow: idx };
      }
      return null;
    }
    if (c.sub === 'rep') {
      const [px, py, pw, ph] = REP_PANEL;
      const lx = vx - px, ly = vy - py;
      // DFU hangs the handler on the PANEL, so a click outside its
      // 168x189 bounds never reaches it at all. Testing the y band
      // alone let a click to the RIGHT of the window (lx >= 134) set
      // underworld reputation from off-panel.
      if (lx < 0 || ly < 0 || lx >= pw || ly >= ph) return null;
      if (lx >= REP_EXIT[0] && ly >= REP_EXIT[1] && lx < REP_EXIT[0] + REP_EXIT[2] && ly < REP_EXIT[1] + REP_EXIT[3]) return { repExit: true };
      // RepPanel_OnMouseClick takes PANEL-local coords; the band test
      // and the column thresholds live in the pure law
      if (ly >= REP_BAR_TOP && ly <= REP_BAR_BOTTOM) return { repClick: [lx, ly] };
      return null;
    }
    if (c.sub === 'advantage' || c.sub === 'disadvantage') {
      // the pickers push OVER the window, so they answer first
      if (c.pickList) {
        const [ox, oy] = PICK_PANEL;
        const lx = vx - ox, ly = vy - oy;
        if (lx >= RECTS.pickPrev[0] && ly >= RECTS.pickPrev[1] && lx < RECTS.pickPrev[0] + 9 && ly < RECTS.pickPrev[1] + 9) return { pickStep: -1 };
        if (lx >= RECTS.pickNext[0] && ly >= RECTS.pickNext[1] && lx < RECTS.pickNext[0] + 9 && ly < RECTS.pickNext[1] + 9) return { pickStep: 1 };
        if (inRect(PICK_SCROLL_RECT)) return { pickBar: [vx, vy] };   // ROAD-E2: the bar answers in NATIVE coords - press() and the drag both want them
        const [plx, ply, plw] = RECTS.pickList;
        if (lx >= plx && lx < plx + plw && ly >= ply) {
          // AUDIT 18: advPickerItemCount rows, at SmallFont's 6px pitch
          const row = Math.floor((ly - ply) / (c._rowH || 1));
          const idx = (c.pickScroll ?? 0) + row;
          if (row >= 0 && row < ADV_PICKER_ITEM_COUNT && idx < c.pickList.length) return { pickRow: idx };
        }
        return null;
      }
      // the window's own handlers hang off the PANEL (:236-237), so a
      // click outside its 168x198 bounds never reaches it
      const [px, py, pw, ph] = SPECIAL_ADV_PANEL;
      const lx = vx - px, ly = vy - py;
      if (lx < 0 || ly < 0 || lx >= pw || ly >= ph) return null;
      if (lx >= SPECIAL_ADV_ADD[0] && ly >= SPECIAL_ADV_ADD[1]
        && lx < SPECIAL_ADV_ADD[0] + SPECIAL_ADV_ADD[2] && ly < SPECIAL_ADV_ADD[1] + SPECIAL_ADV_ADD[3]) return { advAdd: true };
      if (lx >= SPECIAL_ADV_EXIT[0] && ly >= SPECIAL_ADV_EXIT[1]
        && lx < SPECIAL_ADV_EXIT[0] + SPECIAL_ADV_EXIT[2] && ly < SPECIAL_ADV_EXIT[1] + SPECIAL_ADV_EXIT[3]) return { advExit: true };
      for (const row of c._advRows ?? []) {
        if (lx >= LABEL_ORIGIN[0] && lx < LABEL_ORIGIN[0] + (row.w ?? 0)
          && ly >= row.y && ly < row.y + LABEL_HIT_HEIGHT) return { advRemove: row.index };
      }
      return null;
    }
    if (inRect(CUSTOM_EXIT)) return { customExit: true };
    if (inRect(CUSTOM_HP_UP)) return { customHp: 1 };
    if (inRect(CUSTOM_HP_DOWN)) return { customHp: -1 };
    if (inRect(CUSTOM_HELP)) return { customHelp: true };
    if (inRect(CUSTOM_ADVANTAGE)) return { customAdvantage: true };
    if (inRect(CUSTOM_DISADVANTAGE)) return { customDisadvantage: true };
    if (inRect(CUSTOM_REP)) return { customRep: true };
    for (let i = 0; i < CUSTOM_SKILL_RECTS.length; i++) if (inRect(CUSTOM_SKILL_RECTS[i])) return { customSkill: i };
    // the freeEdit rollout shares the stats screen's geometry
    const st = statBlockHit(c.statCursor, vx, vy);
    if (st) {
      if (typeof st === 'string') return { customStatStep: st === 'plus' ? 1 : -1 };
      return { customStatCursor: st.setStatCursor };
    }
    return null;
  }
  if (s === 'bioMethod') {
    // the reputation box is MODAL and ClickAnywhereToClose
    if (flow.biogRepBox) return 'confirm';
    const lx = vx - BIO_METHOD_PANEL[0], ly = vy - BIO_METHOD_PANEL[1];
    const inR = ([x, y, w, h]) => lx >= x && ly >= y && lx < x + w && ly < y + h;
    if (inR(BIO_CHOOSE_GENERATE)) return { bioMethod: 'generate' };
    if (inR(BIO_CHOOSE_QUESTIONS)) return { bioMethod: 'questions' };
    return null;
  }
  if (s === 'biography') {
    if (flow.biogRepBox) return 'confirm';   // ClickAnywhereToClose
    const q = flow.biogQuestion?.();
    if (!q) return null;
    for (let i = 0; i < BIOG_BUTTONS; i++) {
      // an index past this question's answers is INERT, verbatim
      if (i >= q.answers.length) continue;
      if (inRect(biogButtonRect(i))) return { answerBiography: i };
    }
    return null;
  }
  if (s === 'reflexes') {
    for (let i = 0; i < REFLEX_COUNT; i++) if (inRect(reflexRowRect(i))) return { setReflexes: i };
    return inRect(RECTS.ok) ? 'confirm' : null;
  }
  if (s === 'stats') {
    if (flow.poolBox) return 'confirm';   // ClickAnywhereToClose - the box is MODAL over the window
    if (inRect(RECTS.reroll)) return 'reroll';
    if (inRect(RECTS.saveRoll)) return { saveRoll: true };
    if (inRect(RECTS.loadRoll)) return { loadRoll: true };
    if (inRect(RECTS.ok)) return 'confirm';
    return statBlockHit(flow.statCursor, vx, vy);
  }
  if (s === 'summary') {
    if (flow.poolBox) return 'confirm';   // ClickAnywhereToClose
    if (inRect(RECTS.ok)) return 'confirm';
    if (inRect(RECTS.restart)) return { restart: true };
    if (inRect(RECTS.facePrev)) return { faceStep: -1 };
    if (inRect(RECTS.faceNext)) return { faceStep: 1 };
    for (let i = 0; i < REFLEX_COUNT; i++) {
      if (inRect(reflexRowRect(i, SUMMARY_REFLEX_ORIGIN))) return { setReflexes: i };
    }
    // Both rollouts are live at once here, and each answers a spinner
    // with the same bare 'plus'/'minus' its own screen uses. On the
    // summary that is ambiguous, so the branch that ANSWERED names
    // itself - it is the only place that knows.
    const st = statBlockHit(flow.statCursor, vx, vy);
    if (st) return typeof st === 'string' ? { statStep: st === 'plus' ? 1 : -1 } : st;
    return skillBlockHit(flow, vx, vy);
  }
  if (s === 'skills') {
    if (flow.poolBox) return 'confirm';   // ClickAnywhereToClose
    if (inRect(RECTS.ok)) return 'confirm';
    return skillBlockHit(flow, vx, vy);
  }
  return null;
}

/** The two rollouts' own hit routing, shared by their screens and by
 *  U16's summary, which draws BOTH at once. They cannot collide: the
 *  stat buttons and spinner live at x 7..59, the skill rows and their
 *  spinner at x 68..240. */
function statBlockHit(cursor, vx, vy) {
  const [bx, by, bw, bh] = STAT_BUTTON;
  for (let i = 0; i < STAT_KEYS_ORDER.length; i++) {
    if (vx >= bx && vx < bx + bw && vy >= by + i * STAT_STEP && vy < by + i * STAT_STEP + bh) return { setStatCursor: i };
  }
  const sy = STAT_SPINNER_Y + cursor * STAT_STEP;
  if (vx >= STAT_SPINNER_X && vx < STAT_SPINNER_X + UD_SPINNER.w) {
    if (vy >= sy && vy < sy + UD_SPINNER.up[3]) return 'plus';
    if (vy >= sy + UD_SPINNER.down[1] && vy < sy + UD_SPINNER.down[1] + UD_SPINNER.down[3]) return 'minus';
  }
  return null;
}

function skillBlockHit(flow, vx, vy) {
  let idx = 0;
  for (const [group, ids] of flow.skillRows()) {
    for (let i = 0; i < ids.length; i++) {
      const y = SKILL_GROUP_TOP[group] + i * SKILL_ROW_STEP;
      // skillSelectButtonSize (106,7) at the label position
      if (vx >= SKILL_LABEL_X && vx < SKILL_LABEL_X + 106 && vy >= y && vy < y + 7) return { setSkillCursor: idx };
      idx++;
    }
    // U17: this group's OWN spinner, which names its group because all
    // three are live at once and 'plus' alone could not say which.
    const sy = SKILL_SPINNER_TOP[group] + (flow.skillSel?.[group] ?? 0) * SKILL_ROW_STEP;
    if (vy >= sy && vy < sy + 9) {
      if (vx >= SKILL_SPINNER_X && vx < SKILL_SPINNER_X + 11) return { skillStep: -1, group };
      if (vx >= SKILL_SPINNER_X + LR_SPINNER.right[0] && vx < SKILL_SPINNER_X + LR_SPINNER.right[0] + 11) return { skillStep: 1, group };
    }
  }
  return null;
}
