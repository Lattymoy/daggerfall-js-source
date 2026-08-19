// U16 - WizardStages.Summary. CreateCharSummary is the wizard's
// closing screen and the last stage the port was missing: CHAR04I0.IMG
// COMPOSITING the stats rollout, the skills rollout, the face picker
// and the reflex picker onto one page with an editable name box.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ChargenFlow, NAME_MAX_CHARACTERS } from '../src/ui/chargen.js';
import { chargenHit, RECTS, SUMMARY_REFLEX_ORIGIN, reflexRowRect, REFLEX_PICKER, REFLEX_COUNT } from '../src/ui/chargenArt.js';
import { SKILLS } from '../src/systems/skills.js';

const CAREER = {
  name: 'Mage', hitPointsPerLevel: 8, advancementMultiplier: 1,
  strength: 40, intelligence: 60, willpower: 72, agility: 48,
  endurance: 52, personality: 55, speed: 48, luck: 57,
  primarySkills: [SKILLS.Mysticism, SKILLS.Alteration, SKILLS.Thaumaturgy],
  majorSkills: [SKILLS.Illusion, SKILLS.Destruction, SKILLS.Restoration],
  minorSkills: [SKILLS.Medical, SKILLS.ShortBlade, SKILLS.BluntWeapon, SKILLS.Dragonish, SKILLS.Daedric, SKILLS.Dodging],
};
const flow = () => new ChargenFlow([{ name: 'Mage', career: CAREER }], () => 0);
/** race -> gender -> U18's method -> class -> name -> face -> stats
 *  -> skills -> reflexes -> summary */
function toSummary(f = flow()) {
  f.input('confirm'); f.input('confirm'); f.input('confirm'); f.input('confirm');   // -> name
  f.name = 'Vanus';
  f.input('confirm');                                           // -> face
  f.input('confirm');                                           // -> stats
  while (f.statPool > 0) f.input('plus');
  f.input('confirm');                                           // -> skills
  // the pools are per GROUP and 'plus' only feeds the cursor's own
  // group, so the walk steps onto a row of each: 0, 3, 6.
  for (const start of [0, 3, 6]) {
    while (f.skillCursor !== start) f.input('down');
    for (let i = 0; i < 6; i++) f.input('plus');
  }
  f.input('confirm');                                           // -> reflexes
  f.input('confirm');                                           // -> summary
  return f;
}

test('U16: the summary sits between the reflexes and done', () => {
  // ReflexSelectWindow_OnClose (:539-549) goes to SetSummaryWindow,
  // and SummaryWindow_OnClose (:565-583) is what calls StartNewGame.
  const f = toSummary();
  assert.equal(f.state, 'summary');
  assert.ok(!f.done, 'reflexes no longer close the wizard');
  f.input('confirm');
  assert.equal(f.state, 'done');
});

test('U16: OK is gated on ALL FOUR pools, not just the stat one', () => {
  // OkButton_OnMouseClick (:174-189) tests BonusPool and all three
  // skill bonus-point counters, because the summary lets you take
  // points back DOWN off any of them.
  for (const pool of ['stat', 'primary', 'major', 'minor']) {
    const f = toSummary();
    if (pool === 'stat') f.statPool = 1; else f.pools[pool] = 1;
    f.input('confirm');
    assert.equal(f.state, 'summary', `an unspent ${pool} point holds the window`);
    assert.ok(f.poolBox, 'and pops TEXT.RSC 14 instead');
    f.input('confirm');                       // ClickAnywhereToClose
    assert.equal(f.poolBox, null, 'the box closes on any key');
    assert.equal(f.state, 'summary', 'closing the box does not also confirm');
  }
});

test('U16: entering the summary ZEROES all four pools, as SetCharacterSheet does', () => {
  // :119-136 - BonusPool = 0 and the three counters = 0, on EVERY
  // push. It is what makes the pools well-defined for a flow that
  // reached the summary without opening the skills screen at all.
  const f = flow();
  f.state = 'reflexes';
  f.statPool = 4;
  assert.equal(f.pools, undefined, 'the skills screen was never entered');
  f.input('confirm');
  assert.equal(f.statPool, 0);
  assert.deepEqual(f.pools, { primary: 0, major: 0, minor: 0 });
});

test('U16: RESTART returns to the race screen, keeping the document', () => {
  // RestartButton_OnMouseClick (:170-174) raises OnRestart, which the
  // wizard answers with SetRaceSelectWindow (:555-558). It is a SOFT
  // restart - the document survives, so the F7 rule still holds and a
  // player who re-picks the same class keeps the stats they rolled.
  const f = toSummary();
  const stats = { ...f.stats };
  const hit = chargenHit(f, RECTS.restart[0] + 2, RECTS.restart[1] + 2);
  assert.deepEqual(hit, { restart: true });
  f.applyHit(hit);
  assert.equal(f.state, 'race');
  assert.equal(f.name, 'Vanus', 'the name survives');
  assert.deepEqual(f.stats, stats, 'and so does the roll');
});

test('U16: RESTART cannot double-apply the biography', () => {
  // The reset lives on _enterBiography, which EVERY arrival goes
  // through, because DFU never reuses that window - both
  // SetBiographyWindow and SetChooseBioWindow new a fresh
  // CreateCharBiography over a fresh BiogFile. Put the reset on the
  // name screen's cancel alone (where 17j F3 first placed it) and
  // restarting walks the questions again with the previous run's
  // effects still in the list.
  const f = flow();
  f.biogFor = () => ({ questions: [{ text: 'Q1', answers: [{ effects: [{ type: 'gold', amount: 100 }] }] }] });
  f.input('confirm'); f.input('confirm'); f.input('confirm'); f.input('confirm');   // -> U19's bio-method screen
  f.input('down'); f.input('confirm');                                              // answer questions -> biography
  assert.equal(f.state, 'biography');
  f.answerBiography(0);
  assert.equal(f.biographyEffects.length, 1);

  f.state = 'summary';
  f.restartSummary();
  assert.equal(f.state, 'race');
  f.input('confirm'); f.input('confirm'); f.input('confirm'); f.input('confirm');   // -> the bio-method screen again
  f.input('down'); f.input('confirm');                                              // -> biography again
  assert.equal(f.state, 'biography');
  assert.deepEqual(f.biographyEffects, [], 'the previous run\'s effects are gone');
  f.answerBiography(0);
  assert.equal(f.biographyEffects.length, 1, 'one pass through the questions, one set of effects');
});

test('U16: the summary keeps the name box, the face picker and the reflex picker live', () => {
  const f = toSummary();
  // the name is editable here too (textBox at 100,5). AUDIT 18: the
  // box is the SUMMARY's own control (sumName), re-seeded from the
  // document on every push and committed only by OK.
  f.input('backspace');
  assert.equal(f.sumName, 'Vanu');
  f.input('char:s');
  assert.equal(f.sumName, 'Vanus');
  for (let i = 0; i < 40; i++) f.input('char:a');
  assert.equal(f.sumName.length, NAME_MAX_CHARACTERS, 'and holds the same 31 as the name screen');

  // FacePicker's PREVIOUS/NEXT, which have no 'up'/'down' state arm here
  const before = f.faceIndex;
  const next = chargenHit(f, RECTS.faceNext[0] + 2, RECTS.faceNext[1] + 2);
  assert.deepEqual(next, { faceStep: 1 });
  f.applyHit(next);
  assert.equal(f.faceIndex, before + 1);
  const prev = chargenHit(f, RECTS.facePrev[0] + 2, RECTS.facePrev[1] + 2);
  assert.deepEqual(prev, { faceStep: -1 });
  f.applyHit(prev);
  assert.equal(f.faceIndex, before);

  // the reflex picker, at the summary's origin rather than the reflex screen's
  for (let i = 0; i < REFLEX_COUNT; i++) {
    const [rx, ry] = reflexRowRect(i, SUMMARY_REFLEX_ORIGIN);
    assert.deepEqual(chargenHit(f, rx + 2, ry + 2), { setReflexes: i }, `reflex row ${i}`);
  }
});

test('U16: ReflexPicker is POSITIONED by its host, not rewritten per screen', () => {
  // ReflexPicker.cs:81-95 is one 66x45 panel of five 66x9 buttons; the
  // reflex screen puts it at (127,148) and the summary at (246,95).
  assert.deepEqual(SUMMARY_REFLEX_ORIGIN, [246, 95]);   // CreateCharSummary.cs:80
  assert.deepEqual(REFLEX_PICKER, [127, 148, 66, 45]);  // CreateCharReflexSelect.cs:93
  assert.deepEqual(reflexRowRect(0), [127, 148, 66, 9], 'the default origin is the reflex screen\'s');
  assert.deepEqual(reflexRowRect(2, SUMMARY_REFLEX_ORIGIN), [246, 95 + 18, 66, 9]);
});

test('U16: the stats and skills rollouts have INDEPENDENT selections', () => {
  // Two DFU components, two selections. One shared cursor was fine
  // while they were separate screens; the summary draws both, and a
  // click on a skill row would have moved the stat spinner.
  const f = toSummary();
  const stat = chargenHit(f, 20, 70);
  assert.deepEqual(stat, { setStatCursor: 2 }, 'the third stat button');
  f.applyHit(stat);
  const skill = chargenHit(f, 100, 84);
  assert.deepEqual(skill, { setSkillCursor: 3 }, 'the first major skill row');
  f.applyHit(skill);
  assert.equal(f.statCursor, 2, 'the skill click left the stat selection alone');
  assert.equal(f.skillCursor, 3);
});

test('U16: back returns to the reflex screen', () => {
  // SummaryWindow_OnClose's cancel arm (:571-583) ends in
  // SetSelectReflexesWindow. Its copying of skills, stats, bonus
  // points and faceIndex back to the earlier windows has no port
  // equivalent: those windows and the summary edit ONE flow object,
  // so there is nothing to copy back to.
  const f = toSummary();
  f.input('back');
  assert.equal(f.state, 'reflexes');
});


test('U16: the derived block belongs to the STATS window, not the rollout', () => {
  // CreateCharAddBonusStats.cs:94-100 adds the seven secondary labels
  // to its own NativePanel; StatsRollout has never heard of them.
  // Sharing them with the summary drew them across its skill panels -
  // "+BRIMARY SKILLS", a 110 over the Axe row - which only the
  // screenshot caught. A source sweep, because the draw needs GL.
  const src = readFileSync(new URL('../src/ui/chargenArt.js', import.meta.url), 'utf8');
  const block = src.slice(src.indexOf('function drawStatBlock('));
  const body = block.slice(0, block.indexOf('\nfunction '));
  for (const k of ['damage', 'encumbrance', 'spellPoints', 'magicResist', 'toHit', 'hitPoints', 'healingRate']) {
    assert.ok(!body.includes(`DERIVED_POS.${k}`), `${k} must not ride the shared rollout block`);
  }
  const stats = src.slice(src.indexOf('function drawStats('));
  const statsBody = stats.slice(0, stats.indexOf('\n/** StatsRollout'));
  assert.ok(statsBody.includes('DERIVED_POS.healingRate'), 'the stats WINDOW still draws them');
});

test('U16: arriving at the summary puts the stat selection back on the first row', () => {
  // SetCharacterSheet assigns the rollout's stats, and SetStats calls
  // SelectStat(0) (StatsRollout.cs:190) - the spinner does not stay
  // where the stats screen left it.
  const f = toSummary();
  assert.equal(f.statCursor, 0);
  f.state = 'reflexes';
  f.statCursor = 5; f.skillCursor = 4;
  f.input('confirm');
  assert.equal(f.state, 'summary');
  assert.equal(f.statCursor, 0, 'SelectStat(0)');
  // AUDIT 18: and the SKILL selection is NOT reset - SetCharacterSheet
  // assigns SetSkills, and SelectPrimarySkill lives in
  // SkillsRollout.SetupControls alone.
  assert.equal(f.skillCursor, 4);
});
