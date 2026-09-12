// AUDIT 64 - the CHARACTER CREATION lane's five laws, each pinned
// against the C# it restores rather than against the port's own
// expression of it.
//
//   F29  BiogFile.GenerateBackstory runs the WHOLE macro table over
//        the class backstory record, not just %qN
//   F30  the biography reputation box speaks Lower/Higher/Unchanged
//   F31  the bonus-stats screen's signed labels are "+0;-0;0"
//   F32  the class-questions confirm box's DEFAULT button is No
//   F33  the summary's stat bonus pool is a SECOND rollout, never
//        copied back to the bonus-stats window
import './modsOff.js';   // MO1: this suite pins Daggerfall Unity's own numbers - the game without its mods
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { generateBackstory, biogMacroSource } from '../src/systems/biography.js';
import { repChangeStr, repBoxRowsFrom, statView } from '../src/ui/chargenArt.js';
import { attachChargenText } from '../src/ui/enhancedChargen.js';
import { ChargenFlow } from '../src/ui/chargen.js';
import { setSeed, rand } from '../src/formats/dfRandom.js';
import { GENDERS, getNameBank, fullName } from '../src/characters/nameHelper.js';
import { SKILLS } from '../src/systems/skills.js';
import { STAT_KEYS_ORDER } from '../src/systems/chargen.js';
import { NO_CLASS_INDEX, QUESTION_COUNT } from '../src/systems/classQuestions.js';

const CAREER = {
  name: 'Mage', hitPointsPerLevel: 8, advancementMultiplier: 1,
  strength: 40, intelligence: 60, willpower: 72, agility: 48,
  endurance: 52, personality: 55, speed: 48, luck: 57,
  primarySkills: [SKILLS.Mysticism, SKILLS.Alteration, SKILLS.Thaumaturgy],
  majorSkills: [SKILLS.Illusion, SKILLS.Destruction, SKILLS.Restoration],
  minorSkills: [SKILLS.Medical, SKILLS.ShortBlade, SKILLS.BluntWeapon, SKILLS.Dragonish, SKILLS.Daedric, SKILLS.Dodging],
};
/** A crafted CLASSES.DAT in the real header shape (the U18 pins' own
 *  fixture): the all-c walk lands in slot 12 -> header 3. */
function craftedClassesData() {
  const data = new Uint8Array(216);
  data.set([17, 16, 15, 14, 202, 199, 203, 201, 32, 35, 229, 36, 77, 76, 230, 200, 34, 33], 0);
  data.set([10, 0, 0], 18);
  data.set([7, 1, 2], 18 + 8 * 3);
  data.set([0, 5, 5], 18 + 12 * 3);
  data.set([0, 0, 10], 18 + 32 * 3);
  return data;
}
const craftedLibrary = () => Array.from({ length: 40 }, (_, i) =>
  `${i + 1}.  question ${i + 1} text\n a) alpha\n b) beta\n c) gamma`);

/** Every confirm box in the wizard needs a DESCRIPTION to open at all
 *  (an empty record accepts outright), so the stubs stand in for the
 *  TEXT.RSC the art path loads. */
function flow() {
  const careers = Array.from({ length: 18 }, (_, i) => ({ name: `C${i}`, career: CAREER }));
  const f = new ChargenFlow(careers, () => 0);
  f.questionLibrary = craftedLibrary();
  f.classesData = craftedClassesData();
  f.describeRace = (race) => [{ text: `${race.name} description`, center: false }];
  f.describeClass = (i) => [{ text: `class ${i}`, center: false }];
  return f;
}

// =====================================================================
// F29. BiogFile.cs:212-215 -
//   GameManager.Instance.PlayerEntity.BirthRaceTemplate =
//       characterDocument.raceTemplate;   // Need correct race set when
//                                         // parsing %ra macro
//   TextFile.Token[] tokens = ...GetRSCTokens(backstoryId);
//   MacroHelper.ExpandMacros(ref tokens, (IMacroContextProvider)this);
// The data source is BiogFileMCP: HomeProvinceName %hpn (:87-115),
// GeographicalFeature %hpw (:117-141), Name %bn (:143-148),
// ImperialName %imp (:618-624), FemaleName %fn (:626-632), MaleName
// %mn (:633-638); %ra is MacroHelper.PlayerRace (:942-945).
// Fourteen of the eighteen shipping class backstories (Internal_RSC.csv
// records 4116-4133) name at least one of them.
// =====================================================================

const stubRsc = (byId) => ({ linesById: (id) => byId[id] ?? [] });

// Internal_Strings.csv:456-469 - the localized values the two switches
// resolve to. Spelled out here so the table cannot drift silently.
const HPN = {
  Argonian: 'Black Marsh', Breton: 'High Rock', DarkElf: 'Morrowind',
  HighElf: 'Sumurset', Khajiit: 'Elsweyr', Nord: 'Skyrim',
  Redguard: 'Hammerfell', WoodElf: 'Valenwood',
};
const HPW = {
  Argonian: 'swamps', Breton: 'rolling hills', DarkElf: 'mountains',
  HighElf: 'shores', Khajiit: 'desertland', Nord: 'mountains',
  Redguard: 'desertland', WoodElf: 'forests',
};

test('AUDIT 64 F29: the eight races answer BiogFileMCP\'s %hpn and %hpw', () => {
  // BiogFileMCP.cs:87-141, both switches, against Internal_Strings.csv
  for (const key of Object.keys(HPN)) {
    const src = biogMacroSource(key, 1);
    assert.equal(src.homeProvinceName(), HPN[key], `%hpn for ${key}`);
    assert.equal(src.geographicalFeature(), HPW[key], `%hpw for ${key}`);
  }
  // `default: return null` for anything that is not a playable race
  const none = biogMacroSource(null, 1);
  assert.equal(none.homeProvinceName(), null);
  assert.equal(none.geographicalFeature(), null);
});

test('AUDIT 64 F29: %imp is the six-name table, indexed by DFRandom.rand() % 6', () => {
  // BiogFileMCP.cs:620-624 - the literal array, NOT SaveVars'
  // emperorSonNames, and one draw off the reseeded stream.
  const NAMES = ['Pelagius', 'Cephorus', 'Uriel', 'Cassynder', 'Voragiel', 'Trabbatus'];
  const seen = new Set();
  for (let seed = 0; seed < 60; seed++) {
    const got = biogMacroSource('Breton', seed).imperialName();
    assert.ok(NAMES.includes(got), `${got} is not one of the six`);
    setSeed(seed);
    assert.equal(got, NAMES[rand() % 6], 'the index is rand() % 6 off the base seed');
    seen.add(got);
  }
  assert.ok(seen.size > 1, 'the six are actually reachable');
});

test('AUDIT 64 F29: the three name macros keep DFU\'s seed offsets and genders', () => {
  // Name %bn (:145-147) seeds with the base and draws a MALE full name
  // off MacroHelper.GetNameBank(race) (:344-366); FemaleName %fn
  // (:628-630) is base+123 and FEMALE; MaleName %mn (:635-637) is
  // base+9543 and male again. The base itself is the Ledger A stand-in
  // for (uint)parent.GetHashCode().
  const SEED = 987654;
  const src = biogMacroSource('Breton', SEED);
  const bank = getNameBank('Breton');
  setSeed(SEED);
  const expectBn = fullName(bank, GENDERS.Male);
  setSeed(SEED + 123);
  const expectFn = fullName(bank, GENDERS.Female);
  setSeed(SEED + 9543);
  const expectMn = fullName(bank, GENDERS.Male);
  assert.equal(src.name(), expectBn);
  assert.equal(src.femaleName(), expectFn);
  assert.equal(src.maleName(), expectMn);
  // and the three differ from one another, which is the whole reason
  // the offsets exist
  assert.equal(new Set([src.name(), src.femaleName(), src.maleName()]).size, 3);
  // the Argonian arm of GetNameBank is IMPERIAL, not Argonian (:365)
  setSeed(SEED);
  const expectArgonian = fullName(getNameBank('Argonian'), GENDERS.Male);
  assert.equal(biogMacroSource('Argonian', SEED).name(), expectArgonian);
});

test('AUDIT 64 F29: a multi-macro backstory record leaves no raw macro text', () => {
  // Record 4126 (Monk) is the worst case in the shipping data:
  // %hpn %hpw %imp %mn %ra together with its %q block.
  const SEED = 987654;
  const rsc = stubRsc({
    4126: [
      { text: 'Born among the %hpw of %hpn, a %ra of no name.', center: false },
      { text: 'Sworn to %mn in the days of %imp, you carried %q1.', center: false },
    ],
    50: [{ text: 'a staff', center: false }],
  });
  setSeed(SEED + 9543);
  const mn = fullName(getNameBank('Breton'), GENDERS.Male);
  setSeed(SEED);
  const imp = ['Pelagius', 'Cephorus', 'Uriel', 'Cassynder', 'Voragiel', 'Trabbatus'][rand() % 6];
  const rows = generateBackstory(rsc, 4126, ['#50 0'],
    { raceKey: 'Breton', raceName: 'Breton', seed: SEED });
  const text = rows.map((r) => r.text).join('\n');
  assert.ok(!text.includes('%'), `raw macro text survived: ${text}`);
  assert.equal(rows[0].text, 'Born among the rolling hills of High Rock, a Breton of no name.');
  assert.equal(rows[1].text, `Sworn to ${mn} in the days of ${imp}, you carried a staff.`);
});

test('AUDIT 64 F29: ONE ExpandMacros pass with C#\'s per-call macro cache', () => {
  // MacroHelper.cs:427-429 keeps a Dictionary<string,string> "used to
  // ensure macros are only evaluated once per ExpandMacros() call.
  // Important since some macros evaluate differently each time" - so a
  // record naming %fn in two different TOKENS names the same woman.
  const rsc = stubRsc({
    900: [{ text: 'You loved %fn.', center: false }, { text: 'You buried %fn.', center: false }],
  });
  const rows = generateBackstory(rsc, 900, [], { raceKey: 'Nord', raceName: 'Nord', seed: 4242 });
  const first = rows[0].text.replace('You loved ', '').replace('.', '');
  assert.ok(first.length > 0 && !first.includes('%'), `%fn did not expand: ${rows[0].text}`);
  assert.equal(rows[1].text, `You buried ${first}.`, 'the cache spans the whole record, not one row');
});

test('AUDIT 64 F29: %ra reads the CHARGEN DOCUMENT\'s race, not a player entity', () => {
  // BiogFile.cs:212 assigns BirthRaceTemplate from characterDocument
  // one line before the macro pass; the port builds the backstory
  // while the flow still owns the race and no entity exists.
  const rsc = stubRsc({ 900: [{ text: 'A %ra.', center: false }] });
  for (const [key, name] of [['DarkElf', 'Dark Elf'], ['WoodElf', 'Wood Elf'], ['Khajiit', 'Khajiit']]) {
    const rows = generateBackstory(rsc, 900, [], { raceKey: key, raceName: name, seed: 7 });
    assert.equal(rows[0].text, `A ${name}.`);
  }
});

test('AUDIT 64 F29: the flow threads its race and one seed into the record', () => {
  // ChargenFlow._finishBiography is the port's GenerateBackstory call
  // site; it must hand over race and seed or %ra and the four name
  // macros have nothing to answer with.
  const f = flow();
  f.input('confirm');                       // race -> the description box
  f.input('char:y');                        // Yes  -> gender
  f.input('char:m');                        // gender -> method (the box's Male hotkey)

  let seen = null;
  f.seedRandom = () => 24680;
  f.buildBackstory = (id, effects, ctx) => { seen = ctx; return ['story']; };
  f.repBoxRows = () => null;
  f.biogFor = () => ({ backstoryId: 4126, questions: [] });
  f.classIndex = 0;
  f.biographyEffects = [];
  f._finishBiography();
  assert.equal(seen.raceKey, f.race.key);
  assert.equal(seen.raceName, f.race.name);
  assert.equal(seen.seed, 24680, 'one injectable seed per biography');
});

// =====================================================================
// F30. BiogFileMCP.cs:35-47 GetChangeStr: `val == 0` -> "unchanged",
// `val < 0` -> "lower", else "higher"; :54-89 route %r1..%r5 through
// it. Internal_Strings.csv:453-455 gives the English `Lower` /
// `Higher` / `Unchanged`. TEXT.RSC 35 never shows a number.
// =====================================================================

test('AUDIT 64 F30: GetChangeStr is three words, never a number', () => {
  assert.equal(repChangeStr(0), 'Unchanged');
  assert.equal(repChangeStr(-1), 'Lower');
  assert.equal(repChangeStr(-5), 'Lower');
  assert.equal(repChangeStr(1), 'Higher');
  assert.equal(repChangeStr(5), 'Higher');
});

const REP_RSC = stubRsc({
  35: [
    { text: 'Your reputations have changed as follows:', center: true },
    { text: 'Commoners: %r1', center: false },
    { text: 'Merchants: %r2', center: false },
    { text: 'Scholars: %r3', center: false },
    { text: 'Nobility: %r4', center: false },
    { text: 'Underworld: %r5', center: false },
  ],
});
const REP_EXPECTED = [
  'Your reputations have changed as follows:',
  'Commoners: Lower', 'Merchants: Unchanged', 'Scholars: Higher',
  'Nobility: Higher', 'Underworld: Unchanged',
];

test('AUDIT 64 F30: TEXT.RSC 35 renders the WORDS on the classic path', () => {
  const rows = repBoxRowsFrom(REP_RSC, [-5, 0, 5, 5, 0]);
  assert.deepEqual(rows.map((r) => r.text), REP_EXPECTED);
  // the null guards chargen.js:1191 leans on stay
  assert.equal(repBoxRowsFrom(null, [-5, 0, 5, 5, 0]), null);
  assert.equal(repBoxRowsFrom(REP_RSC, null), null);
});

test('AUDIT 64 F30: the ENHANCED skin binds the same law, not a copy', () => {
  const f = attachChargenText({}, REP_RSC);
  assert.deepEqual(f.repBoxRows([-5, 0, 5, 5, 0]).map((r) => r.text), REP_EXPECTED);
  assert.equal(f.repBoxRows(null), null);
});

// =====================================================================
// F31. CreateCharAddBonusStats.cs:156, :160, :161, :162 format
// DamageModifier / ToHitModifier / HitPointsModifier /
// HealingRateModifier with the C# picture "+0;-0;0". The three unnamed
// sections are positive;negative;ZERO, and the third is a bare `0`.
// =====================================================================

/** "+0;-0;0" spelled out from the picture itself. */
const dfuSigned = (n) => (n > 0 ? `+${n}` : n < 0 ? `${n}` : '0');

const atStats = () => {
  const f = flow();
  f.input('confirm'); f.input('char:y');    // race -> its box -> gender
  f.input('char:m');                        // gender -> method (the box's Male hotkey)
  f.input('confirm');                       // method -> class list
  f.input('confirm'); f.input('char:y');    // class -> its box -> name
  f.name = 'Vanus';
  f.input('confirm');                       // -> face
  f.input('confirm');                       // -> stats
  assert.equal(f.state, 'stats');
  return f;
};

test('AUDIT 64 F31: the zero section of "+0;-0;0" is a bare 0', () => {
  const f = atStats();
  assert.equal(f.state, 'stats');
  // the ordinary rolled band: DamageModifier 0 for STR 50-54,
  // ToHit/HitPoints/HealingRate 0 for AGI/END 50-59
  f.stats = {
    strength: 52, intelligence: 50, willpower: 50, agility: 52,
    endurance: 55, personality: 50, speed: 50, luck: 50,
  };
  const d = f.derived();
  assert.equal(d.damage, dfuSigned(0));
  assert.equal(d.toHit, dfuSigned(0));
  assert.equal(d.hitPoints, dfuSigned(0));
  assert.equal(d.healingRate, dfuSigned(0));
  assert.deepEqual([d.damage, d.toHit, d.hitPoints, d.healingRate], ['0', '0', '0', '0']);
});

test('AUDIT 64 F31: the positive and negative sections still carry their signs', () => {
  const f = atStats();
  f.stats = {
    strength: 60, intelligence: 50, willpower: 50, agility: 65,
    endurance: 45, personality: 50, speed: 50, luck: 50,
  };
  const d = f.derived();
  assert.equal(d.damage, dfuSigned(2), 'floor((60-50)/5) = +2');
  assert.equal(d.toHit, dfuSigned(1), 'floor(65/10)-5 = +1');
  assert.equal(d.hitPoints, dfuSigned(-1), 'floor(45/10)-5 = -1');
  assert.equal(d.healingRate, dfuSigned(-1));
  assert.deepEqual([d.damage, d.toHit, d.hitPoints, d.healingRate], ['+2', '+1', '-1', '-1']);
  // the three plain-ToString() labels are unsigned whatever happens
  assert.ok(!/^[+]/.test(d.encumbrance) && !/^[+]/.test(d.spellPoints) && !/^[+]/.test(d.magicResist));
});

// =====================================================================
// F32. DaggerfallMessageBox.cs:630-632 - AddCommonButtons' YesNo arm is
// `AddButton(Yes); AddButton(No, true)`, so NO is the DEFAULT button;
// Update (:318-324) triggers the default button on Return. The class
// questions box takes that constructor (CreateCharClassQuestions.cs
// :406-409) and its No arm sets `classIndex = noClassIndex` (:425-427).
// The race and class-list boxes take two bare AddButton calls
// (CreateCharRaceSelect.cs:107-108, CreateCharClassSelect.cs:87-88), so
// GetDefaultButton() is null and Return is inert there. Every button
// carries a HOTKEY whatever the box (:377) - Yes 'Y', No 'N'.
// =====================================================================

function atQuestions() {
  const f = flow();
  f._enterClassQuestions();
  for (let i = 0; i < QUESTION_COUNT; i++) f.answerClassQuestion(2);
  assert.ok(f.qConfirm, 'EndQuestions opened the confirm box');
  return f;
}

test('AUDIT 64 F32: Return on the class-questions box clicks NO', () => {
  const f = atQuestions();
  assert.notEqual(f.qClassIndex, NO_CLASS_INDEX);
  f.input('confirm');
  assert.equal(f.qClassIndex, NO_CLASS_INDEX, 'the default button is No, and No drops the class');
  assert.equal(f.state, 'class', 'and the wizard falls to SetClassSelectWindow');
});

test('AUDIT 64 F32: Y and N are the hotkeys AddButton binds on that box', () => {
  const y = atQuestions();
  const generated = y.qClassIndex;
  y.input('char:y');
  assert.equal(y.classIndex, generated, 'Y adopts the generated class');
  const n = atQuestions();
  n.input('char:n');
  assert.equal(n.qClassIndex, NO_CLASS_INDEX);
  assert.equal(n.state, 'class');
  // the MOUSE Yes is a separate door and still accepts
  const m = atQuestions();
  const gen2 = m.qClassIndex;
  m.applyHit({ confirmQClass: true });
  assert.equal(m.classIndex, gen2);
});

test('AUDIT 64 F32: Return is INERT on the race box, which has no default button', () => {
  const f = flow();
  f.input('confirm');                       // opens the race description
  assert.ok(f.raceConfirm);
  f.input('confirm');
  assert.ok(f.raceConfirm, 'no default button -> GetDefaultButton() null -> Return does nothing');
  assert.equal(f.state, 'race');
  f.input('char:y');
  assert.equal(f.raceConfirm, null);
  assert.equal(f.state, 'gender', 'Y is what accepts');
  // and N closes the box back onto the map
  const g = flow();
  g.input('confirm');
  g.input('char:n');
  assert.equal(g.raceConfirm, null);
  assert.equal(g.state, 'race');
});

test('AUDIT 64 F32: Return is INERT on the class-list box too', () => {
  const f = flow();
  f.input('confirm'); f.input('char:y');    // race
  f.input('char:m');                        // gender -> method (the box's Male hotkey)
  f.input('confirm');                       // method -> class list
  f.input('confirm');                       // opens the class description
  assert.ok(f.classConfirm);
  f.input('confirm');
  assert.ok(f.classConfirm, 'Return does nothing on a box with no default button');
  assert.equal(f.state, 'class');
  f.input('char:y');
  assert.equal(f.classConfirm, null);
  assert.notEqual(f.state, 'class');
});

test('AUDIT 64 F32: the race box\'s mouse Yes is its own hit, not the shared confirm', () => {
  // Splitting it is what lets Return be inert while the button works:
  // chargenArt's race-box hit answers { confirmRace: true }.
  const f = flow();
  f.input('confirm');
  assert.ok(f.raceConfirm);
  assert.equal(f.applyHit({ confirmRace: true }), true);
  assert.equal(f.raceConfirm, null);
  assert.equal(f.state, 'gender');
});

// =====================================================================
// F33. DaggerfallStartNewGameWizard.cs:566-577 (SummaryWindow_OnClose,
// cancel arm) copies startingSkills, workingSkills, startingStats,
// workingStats, the three SKILL bonus counters and faceIndex - and NOT
// the stat bonus pool. The summary owns its own StatsRollout, zeroed on
// every push (CreateCharSummary.cs:125); the bonus-stats window's is a
// different instance whose pool nothing else writes (:534-536 is a
// `.Copy` on the getter, bypassing SetStats, StatsRollout.cs:183-191)
// and whose OK gate (CreateCharAddBonusStats.cs:189) guarantees it is 0.
// So a point un-spent on the summary is DESTROYED, not refunded.
// =====================================================================

function toSummary(f = flow()) {
  f.input('confirm'); f.input('char:y');    // race
  f.input('char:m');                        // gender -> method (the box's Male hotkey)
  f.input('confirm');                       // method -> class list
  f.input('confirm'); f.input('char:y');    // class
  f.name = 'Vanus';
  f.input('confirm');                       // -> face
  f.input('confirm');                       // -> stats
  assert.equal(f.state, 'stats', 'the walk reached the bonus-stats screen');
  while (f.statPool > 0) f.input('plus');
  f.input('confirm');                       // -> skills
  assert.equal(f.state, 'skills');
  for (const start of [0, 3, 6]) {
    while (f.skillCursor !== start) f.input('down');
    for (let i = 0; i < 6; i++) f.input('plus');
  }
  f.input('confirm');                       // -> reflexes
  f.input('confirm');                       // -> summary
  assert.equal(f.state, 'summary');
  return f;
}

test('AUDIT 64 F33: a point un-spent on the summary never reaches the bonus-stats screen', () => {
  const f = toSummary();
  assert.equal(f.statPool, 0, 'the stats screen\'s OK gate guarantees this');
  const key = STAT_KEYS_ORDER[0];
  const before = f.stats[key];
  f.applyHit({ setStatCursor: 0 });
  f.applyHit({ statStep: -1 });
  assert.equal(f.stats[key], before - 1, 'the working value goes down');
  assert.equal(f.sumStatPool, 1, 'on the SUMMARY\'s own rollout');
  assert.equal(f.statPool, 0, 'and not on the bonus-stats window\'s');
  // summary -> reflexes -> skills -> stats: the cancel arm copies the
  // stat VALUES back and nothing else
  f.input('back');
  assert.equal(f.state, 'reflexes');
  f.input('back');
  assert.equal(f.state, 'skills');
  f.input('back');
  assert.equal(f.state, 'stats');
  assert.equal(f.statPool, 0, 'DFU shows 0 here - the point is destroyed, not refunded');
  assert.equal(f.stats[key], before - 1, 'while the lowered value stands');
});

test('AUDIT 64 F33: the summary\'s OK gate reads the summary\'s own pool', () => {
  // CreateCharSummary.cs:174-178 - BonusPool of THIS window plus the
  // three skill counters.
  const f = toSummary();
  f.sumStatPool = 1;
  f.input('confirm');
  assert.equal(f.state, 'summary', 'an unspent summary point holds the window');
  assert.ok(f.poolBox);
  f.input('confirm');                       // ClickAnywhereToClose
  f.sumStatPool = 0;
  f.statPool = 3;                           // the OTHER rollout: not this gate's business
  f.input('confirm');
  assert.equal(f.state, 'done');
});

test('AUDIT 64 F33: entering the summary zeroes the SUMMARY pool alone', () => {
  const f = toSummary();
  f.applyHit({ setStatCursor: 0 });
  f.applyHit({ statStep: -1 });
  assert.equal(f.sumStatPool, 1);
  f.input('back');                          // -> reflexes
  f.input('confirm');                       // -> summary again
  assert.equal(f.state, 'summary');
  assert.equal(f.sumStatPool, 0, 'CreateCharSummary.cs:125, on every push');
});

test('AUDIT 64 F33: the drawn spinner digit follows the screen\'s own rollout', () => {
  // chargenArt.statView feeds drawStatBlock for BOTH screens
  // (drawSummary and the bonus-stats page), and drawStatBlock hands
  // view.pool to the up/down spinner. Without the per-screen read the
  // summary's spinner printed the OTHER rollout's number.
  const f = toSummary();
  f.applyHit({ setStatCursor: 0 });
  f.applyHit({ statStep: -1 });
  assert.equal(statView(f).pool, 1, 'on the summary: its own pool');
  f.input('back'); f.input('back'); f.input('back');
  assert.equal(f.state, 'stats');
  assert.equal(statView(f).pool, 0, 'on the bonus-stats screen: the window\'s own, still 0');
});

// =====================================================================
// THE REVIEW ROUND (2026-09-08). Two halves of the laws above that the
// first pass left standing.
//
//   F32  CreateCharGenderSelect IS a DaggerfallMessageBox
//        (CreateCharGenderSelect.cs:30) with two bare AddButton calls
//        (:53-54), so it is the FOURTH box on the wizard whose Return
//        is inert and whose hotkeys are what act.
//   F33  StatsRollout.selectedStat (StatsRollout.cs:43) is a plain
//        instance field, so the wizard's two rollouts
//        (CreateCharAddBonusStats.cs:87, CreateCharSummary.cs:37) carry
//        two of them, and SummaryWindow_OnClose's cancel arm
//        (DaggerfallStartNewGameWizard.cs:559-578) copies neither back.
// =====================================================================

test('AUDIT 64 F32: Return is INERT on the GENDER box; M and F are what close it', () => {
  // CreateCharGenderSelect.cs:53-54 -
  //   Button maleButton   = AddButton(MessageBoxButtons.Male);
  //   Button femaleButton = AddButton(MessageBoxButtons.Female);
  // no `defaultButton` argument on either, so GetDefaultButton()
  // (DaggerfallMessageBox.cs:394-403) returns null and Update's Return
  // arm (:318-324) clicks nothing. AddButton binds the hotkey
  // unconditionally (:377) - Male 'M', Female 'F' in
  // DialogShortcuts.txt - and each handler sets the gender and
  // CloseWindow()s (:59-71).
  const f = flow();
  f.input('confirm'); f.input('char:y');    // race
  assert.equal(f.state, 'gender');
  f.input('confirm');
  assert.equal(f.state, 'gender', 'no default button -> Return does nothing');
  f.input('char:m');
  assert.equal(f.gender, 'male');
  assert.equal(f.state, 'classMethod', 'the Male button closes to SetChooseClassGenWindow');

  const g = flow();
  g.input('confirm'); g.input('char:y');
  g.input('char:f');
  assert.equal(g.gender, 'female', 'and F is the other button, not a second Return');
  assert.equal(g.state, 'classMethod');
});

test('AUDIT 64 F33: the summary\'s spinner row is its own rollout\'s selectedStat', () => {
  // SelectStat (StatsRollout.cs:210-217) writes `selectedStat` and
  // moves `spinner.Position` on the instance whose spinner was
  // clicked. The bonus-stats window keeps the row the player left it
  // on: nothing in SummaryWindow_OnClose's cancel arm
  // (DaggerfallStartNewGameWizard.cs:559-578) writes it, and the only
  // caller of SelectStat(0) is SetStats (:183-191), which that window
  // runs on a REROLL alone.
  const f = flow();
  f.input('confirm'); f.input('char:y');    // race
  f.input('char:m');                        // gender -> method
  f.input('confirm');                       // method -> class list
  f.input('confirm'); f.input('char:y');    // class
  f.name = 'Vanus';
  f.input('confirm');                       // -> face
  f.input('confirm');                       // -> stats
  assert.equal(f.state, 'stats');
  for (let i = 0; i < 7; i++) f.input('down');
  assert.equal(f.statCursor, 7, 'the bonus-stats window sits on Luck');
  while (f.statPool > 0) f.input('plus');
  f.input('confirm');                       // -> skills
  for (const start of [0, 3, 6]) {
    while (f.skillCursor !== start) f.input('down');
    for (let i = 0; i < 6; i++) f.input('plus');
  }
  f.input('confirm');                       // -> reflexes
  f.input('confirm');                       // -> summary
  assert.equal(f.state, 'summary');
  // SetCharacterSheet assigns THIS window's rollout
  // (CreateCharSummary.cs:123), so SelectStat(0) lands here...
  assert.equal(f.sumStatCursor, 0);
  f.applyHit({ setStatCursor: 3 });
  assert.equal(statView(f).cursor, 3, 'the summary spinner moved');
  // ...and three cancels later the OTHER rollout is where it was.
  f.input('back'); f.input('back'); f.input('back');
  assert.equal(f.state, 'stats');
  assert.equal(f.statCursor, 7, 'DFU\'s bonus-stats rollout still reads 7');
  assert.equal(statView(f).cursor, 7, 'and that is the row its spinner draws on');
});
