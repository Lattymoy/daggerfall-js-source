// U14: the MENU BACKDROP and the POINTER path. Classic runs chargen
// from the menu over a black parent panel and every screen is
// clickable; the port ran it in-world and several screens were
// keyboard-only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MENU_BACKDROP, chargenHit, PICK_SCROLL_RECT, biogButtonRect, reflexRowRect, RECTS, SUMMARY_REFLEX_ORIGIN, METHOD_PANEL, METHOD_CHOOSE_CLASS, METHOD_CHOOSE_QUESTIONS, BIO_METHOD_PANEL, BIO_CHOOSE_GENERATE, BIO_CHOOSE_QUESTIONS, CUSTOM_EXIT, CUSTOM_HP_UP, CUSTOM_HP_DOWN, CUSTOM_HELP, CUSTOM_REP, CUSTOM_SKILL_RECTS, QSCROLL_Y, QSCROLL_H } from '../src/ui/chargenArt.js';
import { ChargenFlow } from '../src/ui/chargen.js';
import { SKILLS } from '../src/systems/skills.js';
import { createChargenWindow } from '../src/systems/chargenSession.js';   // ROAD-E2: the wrapper's hover seam
import { readFileSync } from 'node:fs';

test('U14: the backdrop is OPAQUE black, not a dim', () => {
  // DaggerfallBaseWindow.cs:40 - parentPanel.BackgroundColor = black.
  // A translucent value would let the world show through, which is
  // the bug: chargen is a MENU, the world is never behind it.
  assert.deepEqual(MENU_BACKDROP, [0, 0, 0, 1]);
  assert.equal(MENU_BACKDROP[3], 1, 'opaque - the town must not show through the letterbox');
});

const CAREER = {
  name: 'Mage', hitPointsPerLevel: 8, advancementMultiplier: 1,
  strength: 40, intelligence: 60, willpower: 72, agility: 48,
  endurance: 52, personality: 55, speed: 48, luck: 57,
  primarySkills: [SKILLS.Mysticism, SKILLS.Alteration, SKILLS.Thaumaturgy],
  majorSkills: [SKILLS.Illusion, SKILLS.Destruction, SKILLS.Restoration],
  minorSkills: [SKILLS.Medical, SKILLS.ShortBlade, SKILLS.BluntWeapon, SKILLS.Dragonish, SKILLS.Daedric, SKILLS.Dodging],
};
const flow = () => new ChargenFlow([{ name: 'Mage', career: CAREER }], () => 0);

test('U14: the gender BUTTON sets and closes, as classic has no OK', () => {
  // CreateCharGenderSelect.cs:59-71 - both handlers end in
  // CloseWindow(). The port made the click a selection and then
  // demanded a confirm the classic box has no button for.
  const f = flow();
  f.state = 'gender';
  f._genderBox = { buttons: [{ button: 6, rect: [10, 10, 32, 16] }, { button: 7, rect: [80, 10, 32, 16] }] };
  assert.ok(f.applyHit(chargenHit(f, 85, 15)), 'the Female button is live');
  assert.equal(f.gender, 'female');
  assert.equal(f.state, 'classMethod', 'and it CLOSED the box (U18: the class-method screen is next in the classic order)');
});

test('U14: EVERY chargen screen answers a click somewhere', () => {
  // The guard rail. A screen that ships keyboard-only is invisible on
  // a phone, and three of them were. Each state must have at least one
  // point that produces an action.
  const probes = {
    // AUDIT 18: the random-name button's "FLAGGED unported" note was
    // retired by U15 - the button ships (chargenArt.js RECTS.randomName
    // and its {randomName:true} hit), so it is probed like any other.
    name: [[RECTS.ok[0] + 2, RECTS.ok[1] + 2],
      [RECTS.randomName[0] + 2, RECTS.randomName[1] + 2]],
    gender: [[85, 15]],
    face: [[RECTS.facePrev[0] + 2, RECTS.facePrev[1] + 2],
      [RECTS.faceNext[0] + 2, RECTS.faceNext[1] + 2],
      [RECTS.ok[0] + 2, RECTS.ok[1] + 2]],
    biography: [[biogButtonRect(0)[0] + 2, biogButtonRect(0)[1] + 2]],
    // U18: the method screen's two buttons and the questions screen's
    // scroll margins + three answer rows
    classMethod: [[METHOD_PANEL[0] + METHOD_CHOOSE_CLASS[0] + 2, METHOD_PANEL[1] + METHOD_CHOOSE_CLASS[1] + 2],
      [METHOD_PANEL[0] + METHOD_CHOOSE_QUESTIONS[0] + 2, METHOD_PANEL[1] + METHOD_CHOOSE_QUESTIONS[1] + 2]],
    classQuestions: [[160, QSCROLL_Y + 2], [160, QSCROLL_Y + QSCROLL_H - 2],
      [160, QSCROLL_Y + 16 + 7 + 3], [160, QSCROLL_Y + 16 + 14 + 3], [160, QSCROLL_Y + 16 + 21 + 3]],
    // U19: the bio-method screen's two buttons
    bioMethod: [[BIO_METHOD_PANEL[0] + BIO_CHOOSE_GENERATE[0] + 2, BIO_METHOD_PANEL[1] + BIO_CHOOSE_GENERATE[1] + 2],
      [BIO_METHOD_PANEL[0] + BIO_CHOOSE_QUESTIONS[0] + 2, BIO_METHOD_PANEL[1] + BIO_CHOOSE_QUESTIONS[1] + 2]],
    // U20a: the builder - exit, both HP arrows, the three side
    // buttons that are live in this slice, all twelve skill rows,
    // and the freeEdit rollout
    customClass: [[CUSTOM_EXIT[0] + 2, CUSTOM_EXIT[1] + 2],
      [CUSTOM_HP_UP[0] + 2, CUSTOM_HP_UP[1] + 2], [CUSTOM_HP_DOWN[0] + 2, CUSTOM_HP_DOWN[1] + 2],
      [CUSTOM_HELP[0] + 2, CUSTOM_HELP[1] + 2], [CUSTOM_REP[0] + 2, CUSTOM_REP[1] + 2],
      ...CUSTOM_SKILL_RECTS.map((r) => [r[0] + 2, r[1] + 2]),
      [20, 22], [51, 24]],
    // AUDIT 18: SAVE ROLL and LOAD ROLL (CreateCharAddBonusStats.cs
    // :116-122) were absent from the port entirely, and this pin's
    // hand-written list is exactly what let two of the screen's five
    // controls go missing unnoticed.
    stats: [[RECTS.reroll[0] + 2, RECTS.reroll[1] + 2],
      [RECTS.saveRoll[0] + 2, RECTS.saveRoll[1] + 2],
      [RECTS.loadRoll[0] + 2, RECTS.loadRoll[1] + 2],
      [RECTS.ok[0] + 2, RECTS.ok[1] + 2], [20, 22]],
    skills: [[100, 34], [RECTS.ok[0] + 2, RECTS.ok[1] + 2]],
    reflexes: [[reflexRowRect(0)[0] + 2, reflexRowRect(0)[1] + 2],
      [RECTS.ok[0] + 2, RECTS.ok[1] + 2]],
    // AUDIT 18: the summary was not probed at all, and it is the
    // screen with the most live controls (CreateCharSummary.cs:63-96).
    summary: [[RECTS.ok[0] + 2, RECTS.ok[1] + 2],
      [RECTS.restart[0] + 2, RECTS.restart[1] + 2],
      [RECTS.facePrev[0] + 2, RECTS.facePrev[1] + 2],
      [RECTS.faceNext[0] + 2, RECTS.faceNext[1] + 2],
      [SUMMARY_REFLEX_ORIGIN[0] + 2, SUMMARY_REFLEX_ORIGIN[1] + 2],
      [20, 22], [100, 34]],
  };
  for (const [state, points] of Object.entries(probes)) {
    const f = flow();
    f.state = state;
    if (state === 'gender') f._genderBox = { buttons: [{ button: 6, rect: [10, 10, 32, 16] }, { button: 7, rect: [80, 10, 32, 16] }] };
    if (state === 'stats') f._enterStats();
    if (state === 'skills') f._enterSkills();
    if (state === 'summary') { f._enterStats(); f._enterSkills(); f._enterSummary(); f.state = 'summary'; }
    if (state === 'biography') f.biogFor = () => ({ questions: [{ text: ['q', ''], answers: [{ text: 'a', effects: [] }] }] });
    if (state === 'classQuestions') f.qDisplay = { lines: ['q', ' a) x', ' b) y', ' c) z'], aIndex: 1, bIndex: 2, cIndex: 3 };
    if (state === 'customClass') f._enterCustomClass();
    // EVERY listed control must answer, not merely one of them - a
    // screen whose OK button works while its own controls are dead is
    // still keyboard-only in practice.
    for (const [x, y] of points) {
      assert.notEqual(chargenHit(f, x, y), null, `${state} answers the click at ${x},${y}`);
    }
  }
});

test('U14: the RACE screen answers a click through its picker', () => {
  // the province map is the one screen whose hit needs the art, so it
  // is checked by its own law rather than through chargenHit
  const f = flow();
  f.state = 'race';
  assert.equal(chargenHit(f, 5, 5), null, 'no art loaded -> null, never a throw');
});

// ---- ROAD-E2: the list picker's scroll bar, at last with a HIT ----
//
// DaggerfallListPickerWindow.Setup (:96-99) adds a VerticalScrollBar
// at (181,23) sized 5x82 as a pickerPanel child; every picker in the
// wizard inherits it. ROAD-D2 drew its thumb; the rail was dead to a
// click until here.

const CAREERS = Array.from({ length: 18 }, (_, i) => ({ name: `C${i}`, career: CAREER }));
const listFlow = () => {
  const f = new ChargenFlow(CAREERS, () => 0);
  f.describeText = (id) => [{ text: `record ${id}`, center: true }];
  return f;
};
const [BX, BY, , BH] = PICK_SCROLL_RECT;
/** a press on the bar at BAR-LOCAL y */
const pressBar = (f, localY) => f.applyHit(chargenHit(f, BX + 2, BY + localY));

test('ROAD-E2: the picker bar sits at the panel origin plus (181,23), 5x82', () => {
  // DaggerfallListPickerWindow.cs:96-99 over PICK_PANEL (60,36) - the
  // ONE rect the draw, the hit and the drag share.
  assert.deepEqual([...PICK_SCROLL_RECT], [241, 59, 5, 82]);
});

test('ROAD-E2: the trough pages BOTH ways by DisplayUnits, and clamps', () => {
  // MouseClick (:142-150): below thumbRect.yMax pages down by
  // displayUnits, above yMin pages up; SetScrollIndex (:187-202)
  // clamps into [0, totalUnits - displayUnits].
  const f = listFlow();
  f.state = 'class';
  assert.equal(f.classRowCount(), 19, '18 careers plus the Custom row');
  // thumbHeight = 82 * 9/19 = 38.8, at scrollIndex 0 it spans y 0..38.8
  assert.ok(pressBar(f, 50), 'the rail answers a click');
  assert.equal(f.classScroll, 9, 'below the thumb: +DisplayUnits');
  assert.ok(pressBar(f, 10));
  assert.equal(f.classScroll, 0, 'above the thumb: -DisplayUnits');
  // and the clamp, from the far end
  pressBar(f, 80);
  pressBar(f, 80);
  assert.equal(f.classScroll, 10, 'totalUnits - displayUnits = 19 - 9');
  pressBar(f, 2);
  pressBar(f, 2);
  assert.equal(f.classScroll, 0);
});

test('ROAD-E2: a press ON the thumb moves nothing and latches the drag', () => {
  // VerticalScrollBar has no third MouseClick arm; Update (:105-113)
  // is what a press inside thumbRect does.
  const f = listFlow();
  f.state = 'class';
  assert.ok(pressBar(f, 20), 'still the bar\'s click');
  assert.equal(f.classScroll, 0, 'a click on the thumb pages nothing');
  assert.equal(f.pickBar.draggingThumb, true);
  // Update's drag arm (:115-121): scale = Size.y / totalUnits - the
  // TOTAL, not the span, which is DFU's own quirk; unitsMoved is then
  // a C# (int) cast, truncating TOWARD ZERO.
  //   82/19 = 4.3157...; a 30px pull is 6.95 units -> 6
  f.hover(BX + 2, BY + 50, { buttons: 1 });
  assert.equal(f.classScroll, 6);
  // and the same cast on the way back: -5px is -1.158 units -> -1,
  // where a floor would give -2
  f.hover(BX + 2, BY + 50, { buttons: 0 });   // let go
  assert.equal(f.pickBar.draggingThumb, false);
  f.classScroll = 10;
  pressBar(f, 60);                            // the thumb is now at 43.2..82
  assert.equal(f.pickBar.draggingThumb, true);
  f.hover(BX + 2, BY + 55, { buttons: 1 });
  assert.equal(f.classScroll, 9, 'truncation toward zero, not a floor');
});

test('ROAD-E2: the drag needs the held button, and letting go drops the latch', () => {
  // Update polls InputManager.GetMouseButton(0) (:105); `e.buttons`
  // is the port's only reading of it, exactly as ui/listPicker.js:291
  // takes it for the shared picker.
  const f = listFlow();
  f.state = 'class';
  pressBar(f, 20);
  f.hover(BX + 2, BY + 50, {});
  assert.equal(f.classScroll, 0, 'no button, no drag');
  assert.equal(f.pickBar.draggingThumb, false, 'and the latch is gone (the else arm, :123-129)');
  f.hover(BX + 2, BY + 50, { buttons: 1 });
  assert.equal(f.classScroll, 0, 'a held button alone does not re-latch - the press does');
});

test('ROAD-E2: the builder\'s skill picker scrolls on its own bar at 9 rows', () => {
  // CreateCharCustomClass.cs:283 constructs the picker with neither
  // font nor row count, so ListBox's default 9 stands (ListBox.cs:36).
  const f = listFlow();
  f.state = 'class';
  f.classListIndex = CAREERS.length;   // the Custom row
  f.useClass();
  const c = f.custom;
  f.customOpenSkillPick(0);
  const n = c.pickItems.length;
  assert.ok(n > 9, 'every skill not on a button - it overflows nine rows');
  assert.ok(pressBar(f, 80));
  assert.equal(c.pickScroll, 9, 'the SAME bar, re-pointed at this picker');
  assert.ok(pressBar(f, 2));
  assert.equal(c.pickScroll, 0);
  // and the drag writes the picker's own index
  pressBar(f, 2);
  assert.equal(f.pickBar.draggingThumb, true);
  f.hover(BX + 2, BY + 40, { buttons: 1 });
  assert.ok(c.pickScroll > 0);
});

test('ROAD-E2: the special-advantage picker takes advPickerItemCount rows, so its list FITS', () => {
  // Both are `new DaggerfallListPickerWindow(uiManager, this,
  // DaggerfallUI.SmallFont, advPickerItemCount)` (:270, :273) and
  // advPickerItemCount is 12 (:46), against eleven advantages. Draw
  // (:135-139) paints NOTHING when totalUnits <= displayUnits, so
  // thumbRect keeps the zero rect and EVERY rail click falls into
  // MouseClick's `> yMax` arm - which SetScrollIndex then clamps to 0.
  const f = listFlow();
  f.state = 'class';
  f.classListIndex = CAREERS.length;
  f.useClass();
  const c = f.custom;
  f._openSpecialAdv('advantage');
  f.advAdd();
  assert.equal(c.pickList.length, 11);
  assert.equal(f._pickRows(), 12);
  assert.ok(pressBar(f, 80), 'the rail still answers');
  assert.equal(c.pickScroll, 0, 'a list that fits cannot scroll at all');
  assert.equal(f.pickBar.draggingThumb, false, 'and there is no thumb to latch');
});

test('ROAD-E2: no picker on top means no bar - a modal box takes the rail with it', () => {
  // DaggerfallUI.Update runs Update() on the TOP window alone, so a
  // picker under a pushed box neither drags nor pages.
  const f = listFlow();
  f.state = 'class';
  pressBar(f, 20);
  assert.equal(f.pickBar.draggingThumb, true);
  f.classConfirm = [{ text: 'record 2100', center: true }];
  assert.equal(pressBar(f, 50), false, 'the description box is modal over the list - the rail does nothing');
  f.hover(BX + 2, BY + 50, { buttons: 1 });
  assert.equal(f.pickBar.draggingThumb, false, 'and the latch cannot survive losing the stack');
  assert.equal(f.classScroll, 0);
});

test('ROAD-E2: the wizard window exposes the HOVER seam every host already routes', () => {
  // THE FOUR HOSTS RULE. VerticalScrollBar.Update is a per-frame poll;
  // without a mousemove reaching the flow the thumb latches and never
  // moves. world.js and exterior.js route townTalk.hover, dungeon.js
  // and worldModes.js route dungeonContext.overlayHover, and both land
  // on the overlay's `hover`.
  const f = listFlow();
  f.state = 'class';
  const w = createChargenWindow(f, { onDone() {}, onCancel() {} });
  assert.equal(typeof w.hover, 'function', 'the classic wizard window carries it');
  // the press (clickNative gates on the ART, which the headless suite
  // has none of, so the pin drives the same hit the pointer route does)
  pressBar(f, 20);
  assert.equal(f.pickBar.draggingThumb, true);
  w.hover(BX + 2, BY + 50, { buttons: 1 });
  assert.equal(f.classScroll, 6, 'the drag reached the flow through the wrapper');
  // and the hosts really do hand a mousemove down
  const src = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
  assert.match(src('../src/scenes/townTalk.js'), /overlay\.hover\(/, 'world.js + exterior.js');
  assert.match(src('../src/scenes/dungeonContext.js'), /overlayHover\(vx, vy, e = null\) \{ activeOverlay\?\.hover\?\.\(vx, vy, e\); \}/, 'dungeonContext.js');
  for (const host of ['../src/scenes/dungeon.js', '../src/scenes/worldModes.js']) {
    assert.match(src(host), /overlayHover\?\.\(/, host);
  }
});
