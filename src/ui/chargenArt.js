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
// FLAGGED loud: the CUSTOM-CLASS path has no screen yet
// (CreateCharCustomClass) - the starting-gear law already handles
// `isCustom`, so only the builder window is missing. The port's
// overall wizard ORDER also still differs from DFU's: we ask the name
// first and the face early, where classic asks race, gender, class,
// biography, name, face. Both are their own slices.

import { ImgFile } from '../formats/imgFile.js';
import { CifRciFile } from '../formats/cifRciFile.js';
import { TextRsc } from '../formats/textRsc.js';   // U11: the race description
import { generateBackstory } from '../systems/biography.js';   // U13
import { bitmapToColor32 } from './hud.js';
import { drawImg, drawRect, shadowText, DEFAULT_TEXT_COLOR, DEFAULT_SHADOW_COLOR, SCREEN_DIM } from './nativePanel.js';
import { layoutMessageBox, drawMessageBox, messageBoxHit, MB_BUTTONS } from './messageBox.js';   // U11
import { FACES_PER_RACE, raceById, raceArt } from '../systems/races.js';
import { SKILL_NAMES } from '../systems/skills.js';
import { STAT_KEYS_ORDER } from '../systems/chargen.js';

// DaggerfallUI.cs:52-62 - the colours these windows actually use.
export const ALT_SHADOW_1 = [44 / 255, 60 / 255, 60 / 255, 1];        // DaggerfallAlternateShadowColor1
export const SELECTED_TEXT = [162 / 255, 36 / 255, 12 / 255, 1];      // DaggerfallDefaultSelectedTextColor
export const INPUT_TEXT = [227 / 255, 223 / 255, 0, 1];               // DaggerfallDefaultInputTextColor
const MODIFIED_STAT = [0, 1, 0, 1];                                   // StatsRollout.cs:47 (Color.green)

/** Every verbatim rect this arc draws, [x, y, w, h]. */
export const RECTS = Object.freeze({
  nameBox: [80, 5, 214, 7],           // CreateCharNameSelect.cs:73-74
  randomName: [279, 3, 36, 10],       // :78
  ok: [263, 172, 39, 22],             // :85 (and face/stats/skills OK)
  reroll: [263, 147, 39, 22],         // CreateCharAddBonusStats.cs:112
  faceDisplay: [247, 25, 64, 40],     // FacePicker.cs:55-57
  facePrev: [245, 69, 42, 9],         // :65
  faceNext: [287, 69, 26, 9],         // :67
  pickList: [26, 27, 138, 72],        // DaggerfallListPickerWindow.cs:82-83
  pickPrev: [179, 10, 9, 9],          // :88
  pickNext: [179, 108, 9, 9],         // :92
  pickScroll: [181, 23, 5, 82],       // :97-98
});

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
export const reflexRowRect = (i) => [REFLEX_PICKER[0], REFLEX_PICKER[1] + i * REFLEX_ROW_H, REFLEX_PICKER[2], REFLEX_ROW_H];

// ListBox.cs:36-37 - nine rows, one pixel of spacing.
export const CLASS_LIST_ROWS = 9;   // ListBox.cs:36 rowsDisplayed
const LIST_ROWS = CLASS_LIST_ROWS, LIST_ROW_SPACING = 1;

const IMG_NAMES = ['CHAR00I0.IMG', 'CHAR01I0.IMG', 'CHAR02I0.IMG', 'CHAR03I0.IMG', 'PICK00I0.IMG', 'TMAP00I0.IMG', 'CHAR02I1.IMG', 'CHAR03I1.IMG', 'BIOG00I0.IMG', 'CHAR05I0.IMG', 'CHAR05I1.IMG'];

let _art = null;          // { imgs: Map<name, {tex,w,h}>, picker: DFBitmap }
let _faces = null;        // { key, tex[] } - the loaded race/gender face set
let _facePending = null;  // ASYNC NEVER DROPS: the coalesced follow-up
let _deps = null;

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
    _art = { imgs, picker, textRsc };
    _deps = deps;
  } catch (e) { console.warn('[chargen] CHAR0*/PICK00/TMAP00 art unavailable; the interim text panels stand in', e); }
}
export const chargenArtLoaded = () => !!_art;
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
  const s = flow.state;
  if (s === 'name') return drawName(renderer, m, font, flow);
  if (s === 'race') return drawRace(renderer, m, font, flow);
  if (s === 'gender') return drawGender(renderer, m, font, flow);
  if (s === 'face') return drawFace(renderer, m, font, flow);
  if (s === 'class') return drawClass(renderer, m, font, flow);
  if (s === 'stats') return drawStats(renderer, m, font, flow);
  if (s === 'skills') return drawSkills(renderer, m, font, flow);
  if (s === 'biography') return drawBiography(renderer, m, font, flow);
  if (s === 'reflexes') return drawReflexes(renderer, m, font, flow);
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
  // the highlight band for the current pick, drawn from the strip
  const strip = img('CHAR05I1.IMG');
  const v = Math.max(0, Math.min(REFLEX_COUNT - 1, flow.reflexes ?? PLAYER_REFLEXES.Average));
  const [px, py, pw] = REFLEX_PICKER;
  renderer.drawScreenQuad(strip.tex,
    { x: m.ox + px * m.s, y: m.oy + (py + v * REFLEX_ROW_H) * m.s, w: pw * m.s, h: REFLEX_ROW_H * m.s },
    { u0: 0, v0: v / REFLEX_COUNT, u1: 1, v1: (v + 1) / REFLEX_COUNT });
  return true;
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
  // TextBox at (80,5) 214x7 - the input colour, not the default
  const [bx, by] = RECTS.nameBox;
  shadowText(renderer, font, `${flow.name}_`, m, bx, by, { color: INPUT_TEXT });
  return true;
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
  const [px, py, pw, ph] = RECTS.faceDisplay;
  if (_faces) {
    // facePanel is Center/Middle inside the 64x40 display panel
    const i = Math.max(0, Math.min(FACES_PER_RACE - 1, flow.faceIndex));
    const [fw, fh] = _faces.size[i];
    renderer.drawScreenQuad(_faces.tex[i], {
      x: m.ox + Math.round(px + (pw - fw) / 2) * m.s,
      y: m.oy + Math.round(py + (ph - fh) / 2) * m.s,
      w: fw * m.s, h: fh * m.s,
    });
  }
  return true;
}

function drawClass(renderer, m, font, flow) {
  // DaggerfallPopupWindow dims what is behind it (DaggerfallUI
  // .ScreenDimColor) - the list picker is the one chargen screen that
  // does NOT cover the whole 320x200 panel.
  drawRect(renderer, m, 0, 0, 320, 200, SCREEN_DIM);
  const pick = img('PICK00I0.IMG');
  // pickerPanel is Center/Middle on the 320x200 native panel
  const ox = Math.floor((320 - pick.w) / 2), oy = Math.floor((200 - pick.h) / 2);
  drawImg(renderer, pick, m, ox, oy);
  const [lx, ly, , lh] = RECTS.pickList;
  const h = rowH(font);
  // AUDIT 17g F6: the scroll index is the LIST'S STATE, moved
  // minimally as the selection leaves the window (ListBox.cs:709-730)
  // - not a centred window recomputed here every frame.
  const first = flow.classScroll ?? 0;
  flow._classRowH = h;   // the hit path has no font (the _genderBox pattern)
  // AUDIT 17g FLAGGED: the scrollbar THUMB does not draw. Its geometry
  // is verbatim and simple (VerticalScrollBar.cs:206-221 - height =
  // rail * displayed/total floored at 10, y = scroll * (rail - height)
  // / (total - displayed)) but the thumb is three texture slices this
  // port has not identified yet, and inventing a colour would break
  // the NATIVE-WINDOW RULE. The rail and both arrows are baked into
  // PICK00I0 and do draw.
  for (let i = 0; i < LIST_ROWS; i++) {
    const c = flow.careers[first + i];
    if (!c) break;
    const y = ly + i * h;
    if (y + h > ly + lh) break;
    const on = first + i === flow.classIndex;
    shadowText(renderer, font, c.name, m, ox + lx, oy + y,
      { color: on ? SELECTED_TEXT : DEFAULT_TEXT_COLOR, shadow: DEFAULT_SHADOW_COLOR });
  }
  return true;
}

function drawSpinnerUD(renderer, m, font, x, y, value) {
  drawImg(renderer, img('CHAR02I1.IMG'), m, x, y, UD_SPINNER.w, UD_SPINNER.h);
  const [vx, vy, vw] = UD_SPINNER.value;
  alt(renderer, font, String(value), m, x + vx, y + vy, { align: 'center', w: vw });
}

function drawStats(renderer, m, font, flow) {
  drawImg(renderer, img('CHAR02I0.IMG'), m, 0, 0);
  const [sx, sy, sw] = STAT_PANEL;
  STAT_KEYS_ORDER.forEach((k, i) => {
    const v = flow.stats[k];
    alt(renderer, font, String(v), m, sx, sy + i * STAT_STEP, {
      align: 'center', w: sw,
      color: v !== flow.rolledStats[k] ? MODIFIED_STAT : DEFAULT_TEXT_COLOR,
    });
  });
  // the spinner rides the SELECTED stat's row and carries the pool
  drawSpinnerUD(renderer, m, font, STAT_SPINNER_X, STAT_SPINNER_Y + flow.cursor * STAT_STEP, flow.statPool);
  // the derived block - all seven, each through the FormulaHelper home
  // (CreateCharAddBonusStats.cs:94-100)
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
  return true;
}

function drawSkills(renderer, m, font, flow) {
  drawImg(renderer, img('CHAR03I0.IMG'), m, 0, 0);
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
      if (idx === flow.cursor) {
        const sy = SKILL_SPINNER_TOP[group] + i * SKILL_ROW_STEP;
        drawImg(renderer, lr, m, SKILL_SPINNER_X, sy);
        // HorizontalAlignment.Center places the LABEL BOX inside its
        // PARENT (the 37-wide spinner), not the label inside itself -
        // which is what puts the number BETWEEN the two arrows
        // (left ends at 11, right starts at 26). Centering within the
        // label's own 15px alone drew it over the left arrow.
        const [, vy, vw] = LR_SPINNER.value;
        alt(renderer, font, String(flow.pools[group]), m, SKILL_SPINNER_X + (lr.w - vw) / 2, sy + vy, { align: 'center', w: vw });
      }
      idx++;
    });
  }
  return true;
}

/** Pointer routing: a native point -> the flow ACTION it triggers, or
 *  null. Hosts feed this from their pointerdown seam (the U8b law:
 *  taps and clicks ride one path). */
export function chargenHit(flow, vx, vy) {
  const inRect = ([x, y, w, h]) => vx >= x && vy >= y && vx < x + w && vy < y + h;
  const s = flow.state;
  if (s === 'name') return inRect(RECTS.ok) ? 'confirm' : null;
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
    // AUDIT 17g F3: this derefed _art.imgs directly, so the ONE branch
    // that needs the art THREW where every other branch returns null.
    // The live caller guards on chargenArtLoaded(); nothing else has
    // to know that.
    const pick = _art ? img('PICK00I0.IMG') : null;
    if (!pick) return null;
    const ox = Math.floor((320 - pick.w) / 2), oy = Math.floor((200 - pick.h) / 2);
    const lx = vx - ox, ly = vy - oy;
    if (lx >= RECTS.pickPrev[0] && ly >= RECTS.pickPrev[1] && lx < RECTS.pickPrev[0] + 9 && ly < RECTS.pickPrev[1] + 9) return 'up';
    if (lx >= RECTS.pickNext[0] && ly >= RECTS.pickNext[1] && lx < RECTS.pickNext[0] + 9 && ly < RECTS.pickNext[1] + 9) return 'down';
    // a click ON a row selects it (DaggerfallListPickerWindow's list)
    const [plx, ply, plw] = RECTS.pickList;
    if (lx >= plx && lx < plx + plw && ly >= ply) {
      const row = Math.floor((ly - ply) / (flow._classRowH || 1));
      const idx = (flow.classScroll ?? 0) + row;
      if (row >= 0 && row < LIST_ROWS && idx < flow.careers.length) return { setClass: idx };
    }
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
    if (inRect(RECTS.reroll)) return 'reroll';
    if (inRect(RECTS.ok)) return 'confirm';
    const [bx, by, bw, bh] = STAT_BUTTON;
    for (let i = 0; i < STAT_KEYS_ORDER.length; i++) {
      if (vx >= bx && vx < bx + bw && vy >= by + i * STAT_STEP && vy < by + i * STAT_STEP + bh) return { setCursor: i };
    }
    const sy = STAT_SPINNER_Y + flow.cursor * STAT_STEP;
    if (vx >= STAT_SPINNER_X && vx < STAT_SPINNER_X + UD_SPINNER.w) {
      if (vy >= sy && vy < sy + UD_SPINNER.up[3]) return 'plus';
      if (vy >= sy + UD_SPINNER.down[1] && vy < sy + UD_SPINNER.down[1] + UD_SPINNER.down[3]) return 'minus';
    }
    return null;
  }
  if (s === 'skills') {
    if (inRect(RECTS.ok)) return 'confirm';
    let idx = 0;
    for (const [group, ids] of flow.skillRows()) {
      for (let i = 0; i < ids.length; i++) {
        const y = SKILL_GROUP_TOP[group] + i * SKILL_ROW_STEP;
        // skillSelectButtonSize (106,7) at the label position
        if (vx >= SKILL_LABEL_X && vx < SKILL_LABEL_X + 106 && vy >= y && vy < y + 7) return { setCursor: idx };
        if (idx === flow.cursor) {
          const sy = SKILL_SPINNER_TOP[group] + i * SKILL_ROW_STEP;
          if (vy >= sy && vy < sy + 9) {
            if (vx >= SKILL_SPINNER_X && vx < SKILL_SPINNER_X + 11) return 'minus';
            if (vx >= SKILL_SPINNER_X + LR_SPINNER.right[0] && vx < SKILL_SPINNER_X + LR_SPINNER.right[0] + 11) return 'plus';
          }
        }
        idx++;
      }
    }
    return null;
  }
  return null;
}
