// AUDIT 18 - the chargen WIZARD's state machine. Every defect here is
// the same shape: DFU's wizard is a stack of windows whose PUSH and
// POP each carry side effects (SetFaceTextures zeroing the picker,
// SetChooseBioWindow raising skillsNeedReroll, SetCharacterSheet
// re-seeding the summary's own controls from the document), and the
// port had modelled several of those pushes as plain state
// assignments. Sources: DaggerfallStartNewGameWizard.cs and the
// CreateChar* windows it pushes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ChargenFlow, freshCareer } from '../src/ui/chargen.js';
import { chargenHit, RECTS, ADV_PICKER_ITEM_COUNT, CLASS_LIST_ROWS, preloadChargenArt, chargenSmallFont } from '../src/ui/chargenArt.js';
import { ADVANTAGE_KEYS, DISADVANTAGE_KEYS } from '../src/systems/specialAdvantages.js';
import { SKILLS } from '../src/systems/skills.js';
import { FntFile } from '../src/formats/fntFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';

const MAGE = {
  name: 'Mage', hitPointsPerLevel: 8, advancementMultiplier: 1,
  strength: 40, intelligence: 60, willpower: 72, agility: 48,
  endurance: 52, personality: 55, speed: 48, luck: 57,
  primarySkills: [SKILLS.Mysticism, SKILLS.Alteration, SKILLS.Thaumaturgy],
  majorSkills: [SKILLS.Illusion, SKILLS.Destruction, SKILLS.Restoration],
  minorSkills: [SKILLS.Medical, SKILLS.ShortBlade, SKILLS.BluntWeapon, SKILLS.Dragonish, SKILLS.Daedric, SKILLS.Dodging],
};
const WARRIOR = { ...MAGE, name: 'Warrior', strength: 70, intelligence: 30 };
const CAREERS = [{ name: 'Mage', career: MAGE }, { name: 'Warrior', career: WARRIOR }];

/** A roll sequence that never repeats, so "did it reroll?" is decidable
 *  by comparing the rolled values rather than by trusting a flag. */
const walking = () => { let n = 0; return () => { n += 0.017; return n % 1; }; };

/** A flow with the two description sources silenced. They are TEXT.RSC
 *  lookups that only exist once the art is loaded, and one pin below
 *  DOES load it - without this the class pick would open its Yes/No
 *  description box mid-walk and the walks would diverge by test order. */
const mkFlow = () => {
  const f = new ChargenFlow(CAREERS, walking());
  f.describeRace = () => null;
  f.describeClass = () => null;
  return f;
};

/** One BIOG question set, so the biography METHOD screen exists and
 *  the name screen's cancel has somewhere to go (:492). */
const BIOG = () => ({ backstoryId: 0, questions: [{ text: ['q'], answers: [{ text: 'a', effects: [] }] }] });

/** race -> gender -> classMethod -> class(list, row 0) -> bioMethod ->
 *  biography -> name. `bio` attaches the question set. */
function toName(f, bio = false) {
  if (bio) f.biogFor = () => BIOG();
  f.input('confirm');   // race
  f.input('confirm');   // gender
  f.input('confirm');   // classMethod -> the list
  f.input('confirm');   // class row 0
  if (bio) {
    assert.equal(f.state, 'bioMethod');
    f.input('down'); f.input('confirm');   // the QUESTIONS arm
    f.input('confirm');                     // the one answer -> name
  }
  assert.equal(f.state, 'name');
  f.name = 'Vanus';
  return f;
}
/** ...-> face -> stats */
function toStats(f, bio = false) {
  toName(f, bio);
  f.input('confirm');   // -> face
  f.input('confirm');   // -> stats
  assert.equal(f.state, 'stats');
  return f;
}
/** ...-> skills, the stat pool spent so OK is not gated */
function toSkills(f, bio = false) {
  toStats(f, bio);
  while (f.statPool > 0) f.input('plus');
  f.input('confirm');
  assert.equal(f.state, 'skills');
  return f;
}
/** spend all three group pools through the per-group spinners */
function spendSkillPools(f) {
  for (const g of ['primary', 'major', 'minor']) while (f.pools[g] > 0) f.applyHit({ skillStep: 1, group: g });
}

// ---------------------------------------------------------------
// 1. skillsNeedReroll - the FLAG, not the class-changed memo
// ---------------------------------------------------------------

test('AUDIT 18 F1: the skills screen RE-ROLLS on re-entry until the accept lowers skillsNeedReroll', () => {
  // DaggerfallStartNewGameWizard.cs:56 declares `bool skillsNeedReroll`,
  // :184 raises it inside SetChooseBioWindow, :256 passes
  // `!skillsNeedReroll` to SetCharacterDocument as isRestored, and :530
  // lowers it on AddBonusSkillsWindow_OnClose's ACCEPT arm alone. The
  // port had collapsed the whole flag onto "the career object changed",
  // so a walk back and forward RESTORED where DFU rerolls.
  const f = toSkills(mkFlow());
  assert.equal(f.skillsNeedReroll, true, 'the class accept went through SetChooseBioWindow');
  const first = [...f.rolledSkills];
  f.input('plus'); f.input('plus');
  assert.deepEqual(f.pools, { primary: 4, major: 6, minor: 6 });

  f.input('back');      // -> stats (AddBonusSkillsWindow_OnClose cancel)
  f.input('confirm');   // -> skills
  assert.notDeepEqual(f.rolledSkills, first, 'SkillsRollout.Reroll re-rolls all nine values (:111-146)');
  assert.deepEqual(f.pools, { primary: 6, major: 6, minor: 6 }, 'and resets all three spinners to bonusPoolPerSkillGroup');

  // the other half, so an over-fix that ALWAYS rerolls fails too
  spendSkillPools(f);
  const accepted = [...f.rolledSkills];
  const spent = [...f.skills];
  f.input('confirm');   // the accept arm - :530
  assert.equal(f.state, 'reflexes');
  assert.equal(f.skillsNeedReroll, false);
  f.input('back');      // ReflexSelectWindow_OnClose cancel -> SetAddBonusSkillsWindow
  assert.equal(f.state, 'skills');
  assert.deepEqual(f.rolledSkills, accepted, 'isRestored true: SetClassSkills(career, false)');
  assert.deepEqual(f.skills, spent);
  assert.deepEqual(f.pools, { primary: 0, major: 0, minor: 0 });
});

test('AUDIT 18 F1: the NAME screen\'s cancel re-raises it with the class untouched', () => {
  // This is the arm no class-changed memo can ever reach.
  // NameSelectWindow_OnClose's cancel (:492) goes to SetChooseBioWindow,
  // which raises the flag - so a player who backs out to the name
  // screen after accepting the skills and comes forward again gets a
  // fresh roll, with the same career object throughout.
  const f = toSkills(mkFlow(), true);
  spendSkillPools(f);
  f.input('confirm');                       // accept -> reflexes, flag down
  assert.equal(f.skillsNeedReroll, false);
  const accepted = [...f.rolledSkills];
  const career = f.career;

  f.input('back');      // -> skills
  f.input('back');      // -> stats
  f.input('back');      // -> face
  f.input('back');      // -> name
  assert.equal(f.state, 'name');
  f.input('back');      // -> the biography METHOD screen (:483-493)
  assert.equal(f.state, 'bioMethod');
  assert.equal(f.skillsNeedReroll, true, 'SetChooseBioWindow raised it again (:184)');

  f.input('down'); f.input('confirm');      // the questions arm
  f.input('confirm');                        // the one answer -> name
  f.input('confirm'); f.input('confirm');    // -> face -> stats
  while (f.statPool > 0) f.input('plus');
  f.input('confirm');                        // -> skills
  assert.equal(f.career, career, 'the CAREER OBJECT never changed');
  assert.notDeepEqual(f.rolledSkills, accepted, 'and DFU still rerolls');
});

test('AUDIT 18 F1: the STATS screen keeps its DFClass rule - re-entry restores', () => {
  // SetAddBonusStatsWindow (:227-246) rerolls only when
  // `createCharAddBonusStatsWindow.DFClass != characterDocument.career`,
  // so the two screens really do differ and the fix must not make the
  // stats screen reroll on a plain re-entry.
  const f = toStats(mkFlow());
  while (f.statPool > 0) f.input('plus');
  const spent = { ...f.stats };
  const rolled = { ...f.rolledStats };
  // out to the FACE screen and back in, which is a real
  // SetAddBonusStatsWindow push (FaceSelectWindow_OnClose :496-501)
  f.input('back');      // -> face
  f.input('confirm');   // -> stats, pushed again with DFClass unchanged
  assert.equal(f.state, 'stats');
  assert.deepEqual(f.stats, spent, 'the stats window is NOT gated on skillsNeedReroll');
  assert.deepEqual(f.rolledStats, rolled);
  assert.equal(f.statPool, 0);
});

// ---------------------------------------------------------------
// 2. the face screen resets its picker on every push
// ---------------------------------------------------------------

test('AUDIT 18 F2: the face picker is zeroed on every push, and the CANCEL writes nothing', () => {
  // SetFaceSelectWindow (:213-224) calls SetFaceTextures OUTSIDE the
  // null-guarded construction, and CreateCharFaceSelect.SetFaceTextures
  // (:65-69) opens with `facePicker.FaceIndex = 0;`. FacePicker.
  // SetFaceTextures never writes the index back, so the zero stands.
  const f = toName(mkFlow());
  f.input('confirm');   // -> face
  for (let i = 0; i < 7; i++) f.input('down');
  assert.equal(f.facePick, 7);
  assert.equal(f.faceIndex, 0, 'the document is untouched while the picker moves');

  f.input('confirm');   // FaceSelectWindow_OnClose accept (:496-501)
  assert.equal(f.state, 'stats');
  assert.equal(f.faceIndex, 7, 'the accept arm is where the document takes it');

  f.input('back');      // AddBonusStatsWindow_OnClose CANCEL (:517)
  assert.equal(f.state, 'face');
  assert.equal(f.facePick, 0, 'the push zeroed the picker again');
  assert.equal(f.faceIndex, 7, 'and the document still carries the accepted face');

  f.input('confirm');
  assert.equal(f.faceIndex, 0, 'OK commits whatever the picker now shows');
  assert.equal(f.result().faceIndex, 0);
});

test('AUDIT 18 F2: the face SCREEN\'s escape leaves the document alone', () => {
  // FaceSelectWindow_OnClose's cancel arm (:502-507) is SetNameSelectWindow
  // and nothing else - a naive `faceIndex = 0` on entry would have
  // thrown the previously accepted face away on an Escape.
  const f = toName(mkFlow());
  f.input('confirm');
  for (let i = 0; i < 3; i++) f.input('down');
  f.input('confirm');                     // accept face 3
  assert.equal(f.faceIndex, 3);
  f.input('back');                        // stats -> face
  f.input('down');                        // move the picker to 1
  f.input('back');                        // ESCAPE to the name screen
  assert.equal(f.state, 'name');
  assert.equal(f.faceIndex, 3, 'the cancel arm writes nothing back');
});

// ---------------------------------------------------------------
// 3. the OK buttons pop TEXT.RSC 14 instead of swallowing the click
// ---------------------------------------------------------------

test('AUDIT 18 F3: the STATS OK pops TEXT.RSC 14 when the pool is unspent', () => {
  // CreateCharAddBonusStats.cs:187-200 - `if (statsRollout.BonusPool >
  // 0)` shows a DaggerfallMessageBox on strYouMustDistributeYourBonusPoints
  // (= 14, :33) with ClickAnywhereToClose, else CloseWindow(). The port
  // guarded the whole arm on `pool === 0`, so a live OK button did
  // nothing at all.
  const f = toStats(mkFlow());
  assert.ok(f.statPool > 0);
  f.input('confirm');
  assert.equal(f.state, 'stats', 'the window is held');
  assert.ok(Array.isArray(f.poolBox) && f.poolBox.length, 'and the box is UP');

  // the pointer must reach it too - a keyboard-only dismissal is the
  // U14 defect class all over again
  assert.equal(chargenHit(f, RECTS.ok[0] + 2, RECTS.ok[1] + 2), 'confirm', 'the box is clickable');
  assert.equal(chargenHit(f, RECTS.reroll[0] + 2, RECTS.reroll[1] + 2), 'confirm', 'and it is MODAL over the window');

  f.input('confirm');   // ClickAnywhereToClose
  assert.equal(f.poolBox, null);
  assert.equal(f.state, 'stats', 'closing the box does not also advance');

  while (f.statPool > 0) f.input('plus');
  f.input('confirm');
  assert.equal(f.state, 'skills');
  assert.equal(f.poolBox, null);
});

test('AUDIT 18 F3: the SKILLS OK pops it for EACH of the three pools independently', () => {
  // CreateCharAddBonusSkills.cs:120-135 tests all three counters with
  // ORs, so a single non-zero group holds the window.
  for (const group of ['primary', 'major', 'minor']) {
    const f = toSkills(mkFlow());
    spendSkillPools(f);
    f.pools[group] = 1;                    // one point left in this group alone
    f.input('confirm');
    assert.equal(f.state, 'skills', `an unspent ${group} point holds the window`);
    assert.ok(Array.isArray(f.poolBox) && f.poolBox.length, `and pops TEXT.RSC 14 for ${group}`);
    assert.equal(chargenHit(f, RECTS.ok[0] + 2, RECTS.ok[1] + 2), 'confirm');
    f.input('confirm');
    assert.equal(f.poolBox, null);
    assert.equal(f.state, 'skills');
    assert.equal(f.skillsNeedReroll, true, 'a refused OK does NOT lower the flag');
    f.pools[group] = 0;
    f.input('confirm');
    assert.equal(f.state, 'reflexes');
  }
});

// ---------------------------------------------------------------
// 4. advPickerItemCount = 12 rows, in SmallFont
// ---------------------------------------------------------------

test('AUDIT 18 F4: the advantage pickers display 12 rows, the builder\'s two still 9', () => {
  // CreateCharSpecialAdvantageWindow.cs:270/:273 construct BOTH pickers
  // as `new DaggerfallListPickerWindow(uiManager, this,
  // DaggerfallUI.SmallFont, advPickerItemCount)` with advPickerItemCount
  // = 12 (:46); DaggerfallListPickerWindow.cs:26-31 writes that into
  // listBox.RowsDisplayed. CreateCharCustomClass.cs:283/:368 pass
  // neither, so the skill and help pickers keep ListBox.cs:36's 9. The
  // port exported the constant and read it NOWHERE.
  assert.equal(ADV_PICKER_ITEM_COUNT, 12);
  assert.equal(CLASS_LIST_ROWS, 9);
  const f = mkFlow();
  f._enterCustomClass();
  assert.equal(f._pickRows(), CLASS_LIST_ROWS, 'no picker open -> the ListBox default');
  f.custom.sub = 'skillPick';
  f.custom.pickItems = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  assert.equal(f._pickRows(), CLASS_LIST_ROWS, 'the skill picker passes no row count');

  f._openSpecialAdv('advantage');
  assert.equal(f._pickRows(), CLASS_LIST_ROWS, 'the WINDOW is not a picker');
  f.advAdd();                                  // the primary picker pushes over it
  assert.equal(f.custom.pickList.length, ADVANTAGE_KEYS.length);
  assert.equal(ADVANTAGE_KEYS.length, 11);
  assert.equal(DISADVANTAGE_KEYS.length, 11);
  assert.equal(f._pickRows(), ADV_PICKER_ITEM_COUNT);
  // 11 items in a 12-row window: DFU never scrolls this list
  f.custom.pickCursor = 10;
  f._scrollPick(ADVANTAGE_KEYS.length);
  assert.equal(f.custom.pickScroll, 0, 'twelve rows hold all eleven advantages');
});

test('AUDIT 18 F4: the picker hit test bounds on the SAME row count', () => {
  // chargenHit's row bound and the draw's loop must be one number, or a
  // row that draws is dead to a tap. The row PITCH comes from the font
  // the draw used, which it caches as custom._rowH.
  const f = mkFlow();
  f._enterCustomClass();
  f._openSpecialAdv('advantage');
  f.advAdd();
  f.custom._rowH = 6;   // SmallFont: fixedHeight 5 + ListBox spacing 1
  const [plx, ply] = RECTS.pickList;
  const [ox, oy] = [60, 36];   // PICK_PANEL
  const at = (row) => chargenHit(f, ox + plx + 2, oy + ply + row * 6 + 2);
  assert.deepEqual(at(10), { pickRow: 10 }, 'the eleventh row is live');
  assert.equal(at(11), null, 'and the twelfth is empty (11 advantages)');
  // an item count past 12 is what the bound itself guards
  f.custom.pickList = [...ADVANTAGE_KEYS, ...ADVANTAGE_KEYS];
  assert.deepEqual(at(11), { pickRow: 11 }, 'row 12 answers');
  assert.equal(at(12), null, 'row 13 is past rowsDisplayed');
});

test('AUDIT 18 F4: SmallFont is FONT0002, and 12 rows is exactly its list height', () => {
  // Measured against the real corpus, which is the whole reason the
  // wrong row count looked right: FONT0002 (DaggerfallUI.cs:155) has
  // fixedHeight 5 and FONT0003 has 7, so 12 x (5+1) = 9 x (7+1) = 72 =
  // the listBox height at DaggerfallListPickerWindow.cs:83.
  const arena2 = process.env.ARENA2_PATH;
  if (!arena2) return;
  const h = (n) => new FntFile().load(new Uint8Array(readFileSync(join(arena2, n)))).fixedHeight;
  assert.equal(h('FONT0002.FNT'), 5);
  assert.equal(h('FONT0003.FNT'), 7);
  const listHeight = RECTS.pickList[3];
  assert.equal(listHeight, 72);
  assert.equal(ADV_PICKER_ITEM_COUNT * (h('FONT0002.FNT') + 1), listHeight);
  assert.equal(CLASS_LIST_ROWS * (h('FONT0003.FNT') + 1), listHeight);
});

test('AUDIT 18 F4: the chargen art LOADS FONT0002 from the real corpus', () => {
  // The row count alone is half the fix: before this, the port never
  // loaded FONT0002 anywhere (`grep FONT000 src/` found only 0003 and
  // 0004), so both pickers and the window's own labels drew at
  // FONT0003's 8px pitch and 12 rows would have overflowed the 72px
  // list by 24px.
  const arena2 = process.env.ARENA2_PATH;
  if (!arena2) return;
  const palette = new DFPalette();
  palette.load(new Uint8Array(readFileSync(join(arena2, 'ART_PAL.COL'))));
  const renderer = { uploadTexture: (kind, name) => ({ kind, name }) };
  const deps = { palette, renderer, fetchBytes: async (n) => new Uint8Array(readFileSync(join(arena2, n))) };
  return preloadChargenArt(deps).then(() => {
    const small = chargenSmallFont();
    assert.ok(small, 'DaggerfallUI.SmallFont is loaded with the rest of the art');
    assert.equal(small.fnt.fixedHeight, 5, 'FONT0002, not FONT0003');
    assert.equal(ADV_PICKER_ITEM_COUNT * (small.fnt.fixedHeight + 1), RECTS.pickList[3]);
  });
});

// ---------------------------------------------------------------
// 5. the summary REVERTS the name and the reflexes on a cancel
// ---------------------------------------------------------------

test('AUDIT 18 F5: summary name and reflex edits are reverted by the cancel arm', () => {
  // SetSummaryWindow (:282) assigns CharacterDocument on every push and
  // that setter IS SetCharacterSheet (CreateCharSummary.cs:44-48), which
  // re-reads `textBox.Text = characterDocument.name` (:122) and
  // `reflexPicker.PlayerReflexes = characterDocument.reflexes` (:135).
  // SummaryWindow_OnClose's cancel arm (:567-577) copies back only the
  // skills, the stats, the three bonus counters and faceIndex - name
  // and reflexes are ABSENT, so they revert.
  const f = toSkills(mkFlow());
  spendSkillPools(f);
  f.input('confirm');                        // -> reflexes
  f.input('up');                             // High
  assert.equal(f.reflexes, 1);
  f.input('confirm');                        // -> summary
  assert.equal(f.state, 'summary');
  assert.equal(f.sumName, 'Vanus');
  assert.equal(f.sumReflexes, 1);

  f.input('char:!'); f.input('char:X');
  f.applyHit({ setReflexes: 4 });
  assert.equal(f.sumName, 'Vanus!X');
  assert.equal(f.sumReflexes, 4);
  assert.equal(f.name, 'Vanus', 'the document is untouched while the box is edited');
  assert.equal(f.reflexes, 1);

  f.input('back');                           // the CANCEL arm
  assert.equal(f.state, 'reflexes');
  f.input('confirm');                        // pushed again -> SetCharacterSheet
  assert.equal(f.sumName, 'Vanus', 'the box is re-seeded from the document');
  assert.equal(f.sumReflexes, 1);
  assert.equal(f.name, 'Vanus');
  assert.equal(f.reflexes, 1);

  // and the OK arm DOES commit - an over-fix that drops the edits fails
  f.input('char:!');
  f.applyHit({ setReflexes: 0 });
  f.input('confirm');
  assert.ok(f.done);
  assert.equal(f.result().name, 'Vanus!', 'GetUpdatedCharacterDocument (:138-148)');
  assert.equal(f.result().reflexes, 0);
});

// ---------------------------------------------------------------
// 6. the QUESTIONS path mints a fresh career, the LIST path does not
// ---------------------------------------------------------------

test('AUDIT 18 F6: a second class adoption through the QUESTIONS path rerolls the stats', () => {
  // CreateCharClassQuestions_OnClose (:335-343) builds `new
  // ClassFile(files[0])` and takes its .Career on every trip, and
  // ClassFile.Load assigns `new DFCareer(cfg)` (API/ClassFile.cs:184).
  // DFCareer overrides neither operator== nor Equals, so
  // SetAddBonusStatsWindow's `DFClass != characterDocument.career`
  // (:238) is a REFERENCE test and fires.
  const f = toStats(mkFlow());
  const asList = { ...f.rolledStats };
  const poolAsList = f.statPool;

  f.state = 'class';
  f.qClassIndex = 0;                       // the SAME class, via the questions
  f._acceptQuestionClass();
  f.input('confirm');                      // name -> face
  f.input('confirm');                      // face -> stats
  assert.equal(f.state, 'stats');
  assert.notDeepEqual(f.rolledStats, asList, 'a fresh ClassFile is a fresh object');
  assert.equal(f.career.name, 'Mage', 'carrying identical values');
  assert.deepEqual(f.career.primarySkills, MAGE.primarySkills);
  assert.notEqual(f.career, MAGE, 'but not the same object');
  void poolAsList;
});

test('AUDIT 18 F6: the LIST path re-picks the SAME object, so it does NOT reroll', () => {
  // CreateCharClassSelect.cs:47-59 builds classList inside Setup and
  // SetClassSelectWindow (:158-167) REUSES the window, so re-picking a
  // row hands back the identical DFCareer. An over-fix that rerolls on
  // every adoption fails here.
  const f = toStats(mkFlow());
  const asList = { ...f.rolledStats };
  f.state = 'class';
  f.classListIndex = 0;
  f._acceptStandardClass();
  f.input('confirm');   // -> face
  f.input('confirm');   // -> stats
  assert.deepEqual(f.rolledStats, asList, 'the cached list object compares equal');
  assert.equal(f.career, MAGE);
});

test('AUDIT 18 F6: freshCareer copies the three skill arrays, not their references', () => {
  const c = freshCareer(MAGE);
  assert.deepEqual(c, MAGE, 'identical values, key for key');
  assert.notEqual(c, MAGE);
  for (const k of ['primarySkills', 'majorSkills', 'minorSkills']) {
    assert.notEqual(c[k], MAGE[k], `${k} is copied, not aliased`);
  }
  assert.equal(freshCareer(null), null);
});

// ---------------------------------------------------------------
// 7. the invented skills REROLL, and the two missing stats buttons
// ---------------------------------------------------------------

test('AUDIT 18: the SKILLS screen has no reroll control - DFU adds only OK', () => {
  // CreateCharAddBonusSkills.Setup (:76-99) adds exactly one button, OK
  // at (263,172,39,22), and SkillsRollout.SetupControls (:179-260) adds
  // only labels, select buttons and the three LeftRightSpinners. The
  // port bound 'r' to a full reroll there.
  const f = toSkills(mkFlow());
  const rolled = [...f.rolledSkills];
  f.input('plus');
  const spent = [...f.skills];
  const pools = { ...f.pools };
  f.input('reroll');
  assert.deepEqual(f.rolledSkills, rolled, 'no key on this screen re-rolls');
  assert.deepEqual(f.skills, spent);
  assert.deepEqual(f.pools, pools);
  assert.equal(chargenHit(f, RECTS.reroll[0] + 2, RECTS.reroll[1] + 2), null, 'and there is no button there either');

  // the STATS screen's reroll button is real (CreateCharAddBonusStats.cs:112)
  const g = toStats(mkFlow());
  const before = { ...g.rolledStats };
  g.input('reroll');
  assert.notDeepEqual(g.rolledStats, before);
});

test('AUDIT 18: SAVE ROLL and LOAD ROLL are live on the stats screen', () => {
  // CreateCharAddBonusStats.cs:116-122 adds both buttons and :160-186
  // implements them: save copies startingStats, workingStats and
  // bonusPool; load is INERT until a save has happened, then calls
  // statsRollout.SetStats(saved...) - which ends in SelectStat(0).
  assert.deepEqual(RECTS.saveRoll, [162, 162, 71, 9]);
  assert.deepEqual(RECTS.loadRoll, [162, 171, 71, 9]);
  const f = toStats(mkFlow());
  assert.deepEqual(chargenHit(f, RECTS.saveRoll[0] + 2, RECTS.saveRoll[1] + 2), { saveRoll: true });
  assert.deepEqual(chargenHit(f, RECTS.loadRoll[0] + 2, RECTS.loadRoll[1] + 2), { loadRoll: true });

  // LOAD before any SAVE is inert
  const untouched = { ...f.stats };
  const poolBefore = f.statPool;
  f.applyHit({ loadRoll: true });
  assert.deepEqual(f.stats, untouched);
  assert.equal(f.statPool, poolBefore);

  f.input('plus');                                  // spend one at Strength
  f.applyHit({ saveRoll: true });
  const savedStats = { ...f.stats };
  const savedRolled = { ...f.rolledStats };
  const savedPool = f.statPool;
  f.statCursor = 5;
  f.input('reroll');
  assert.notDeepEqual(f.rolledStats, savedRolled, 'sanity: the roll is gone');
  f.applyHit({ loadRoll: true });
  assert.deepEqual(f.stats, savedStats, 'LOAD ROLL brings the saved roll back');
  assert.deepEqual(f.rolledStats, savedRolled);
  assert.equal(f.statPool, savedPool);
  assert.equal(f.statCursor, 0, 'SetStats ends in SelectStat(0) (StatsRollout.cs:183-191)');
});

// ---------------------------------------------------------------
// 8. the rollout selections move only where DFU moves them
// ---------------------------------------------------------------

test('AUDIT 18: a RESTORING push leaves both spinner selections alone', () => {
  // StatsRollout's selection is written by SelectStat, reached only
  // from SetStats (:190) and the button handler (:225). SkillsRollout's
  // three are written only in SetupControls. A push that restores calls
  // neither, so the spinners stay where the player left them; the port
  // zeroed the cursor on four separate arms.
  const f = toSkills(mkFlow());
  spendSkillPools(f);
  f.input('confirm');                     // accept -> reflexes (flag down)
  f.input('back');                        // -> skills, restored
  f.skillCursor = 7; f._syncSkillSel();
  f.input('back');                        // -> stats, restored
  f.statCursor = 6;
  f.input('confirm');                     // -> skills, restored
  assert.equal(f.skillCursor, 7, 'the skills spinner survives the round trip');
  f.input('back');
  assert.equal(f.statCursor, 6, 'and so does the stats one');
});

// ---------------------------------------------------------------
// 9. the Ledger citation
// ---------------------------------------------------------------

test('AUDIT 18: no source file cites the Port Ledger for a row that is not there', () => {
  // Port-Ledger.md's own preamble: "If a departure or gap is not on
  // this page, it does not exist." src/ui/chargen.js claimed the
  // isCustom bug-for-bug quirk was "recorded in the Ledger"; section B
  // has no chargen row of any kind. Same shape AUDIT 17m deleted from
  // UI-Arc.md, and the false citation is exactly what hides the defect
  // it claims to license.
  const root = new URL('../', import.meta.url).pathname;
  const ledger = readFileSync(join(root, 'bible/01-Overview/Port-Ledger.md'), 'utf8');
  const walk = (dir) => readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : (p.endsWith('.js') ? [p] : []);
  });
  const claims = walk(join(root, 'src'))
    .filter((p) => /recorded in the Ledger/i.test(readFileSync(p, 'utf8')))
    .map((p) => p.slice(root.length));
  if (/isCustom/.test(ledger)) return;   // the row shipped: the claim is licensed
  assert.deepEqual(claims, [], 'a source file cites a Ledger row that Port-Ledger.md does not carry');
});
