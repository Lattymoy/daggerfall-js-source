// U20b: the SPECIAL ADVANTAGES / DISADVANTAGES window
// (CreateCharSpecialAdvantageWindow.cs). The last chargen window the
// port lacked, and the one that makes U20a's two difficulty terms real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ADVANTAGE_KEYS, DISADVANTAGE_KEYS, ONLY_ONE_KEYS, MAX_ITEMS, MAX_LABELS,
  LABEL_ORIGIN, LABEL_SPACING, TANDEM_SPACING,
  secondaryListFor, advDisAdjustment, cannotAdd, totalAdjust, labelRows,
  parseCareerData, labelFor, DIFFICULTY, DEFAULT_MAGERY_BITS,
} from '../src/systems/specialAdvantages.js';
import { spellPointMultiplier } from '../src/systems/chargen.js';
import { hasSpecialAbility, SPECIAL_ABILITY } from '../src/systems/rest.js';
import { careerAttackModifier, ENEMY_GROUPS } from '../src/combat/formulas.js';
import { buildCustomCareer, difficultyPoints, advancementMultiplier, HP_DEFAULT } from '../src/systems/customClass.js';
import { ChargenFlow } from '../src/ui/chargen.js';
import { SKILLS } from '../src/systems/skills.js';
import { STAT_KEYS_ORDER } from '../src/systems/chargen.js';

// ---- the two lists ----

test('U20b: the primary lists are DFU\'s eleven and eleven, in order', () => {
  // :64-90 - the order IS the picker's row order
  assert.equal(ADVANTAGE_KEYS.length, 11);
  assert.equal(DISADVANTAGE_KEYS.length, 11);
  assert.equal(ADVANTAGE_KEYS[0], 'acuteHearing');
  assert.equal(ADVANTAGE_KEYS[10], 'spellAbsorption');
  assert.equal(DISADVANTAGE_KEYS[0], 'criticalWeakness');
  assert.equal(DISADVANTAGE_KEYS[10], 'phobia');
  // every key must have display text, or the window draws blanks
  for (const k of [...ADVANTAGE_KEYS, ...DISADVANTAGE_KEYS]) assert.ok(labelFor(k).length, k);
});

test('U20b: each primary opens its own secondary list', () => {
  // PrimaryPicker_OnItemPicked's switch (:325-389)
  assert.deepEqual(secondaryListFor('bonusToHit'), ['animals', 'daedra', 'humanoid', 'undead']);
  assert.equal(secondaryListFor('phobia'), secondaryListFor('bonusToHit'), 'the phobia shares the enemy list');
  assert.deepEqual(secondaryListFor('expertiseIn'), ['axe', 'bluntWeapon', 'handToHand', 'longBlade', 'missileWeapon', 'shortBlade']);
  assert.equal(secondaryListFor('forbiddenWeaponry'), secondaryListFor('expertiseIn'));
  // FOUR primaries share the effect list - the tolerance quartet
  for (const k of ['immunity', 'resistance', 'criticalWeakness', 'lowTolerance']) {
    assert.equal(secondaryListFor(k).length, 7, k);
    assert.ok(secondaryListFor(k).includes('toParalysis'), k);
  }
  assert.deepEqual(secondaryListFor('regenerateHealth'), ['general', 'inDarkness', 'inLight', 'whileImmersed'],
    'regeneration alone has the fourth While Immersed row');
  assert.deepEqual(secondaryListFor('rapidHealing'), ['general', 'inDarkness', 'inLight'], 'rapid healing has only three');
  assert.equal(secondaryListFor('forbiddenMaterial').length, 10);
  // the three with NO secondary window at all
  for (const k of ['acuteHearing', 'adrenalineRush', 'athleticism', 'inabilityToRegen']) {
    assert.equal(secondaryListFor(k), null, k);
  }
});

// ---- the difficulty table ----

test('U20b: the difficulty table is DFU\'s 53 entries', () => {
  // InitializeAdjustmentDict (:1031-1085). FIFTY entries, counted off
  // the C# literal - not the 53 an earlier reading of this slice
  // recorded. No key in DFU's dictionary repeats, so the count is also
  // the number of distinct priced picks.
  assert.equal(Object.keys(DIFFICULTY).length, 50);
  assert.equal(DIFFICULTY.acuteHearing, 1, 'the cheapest advantage');
  assert.equal(DIFFICULTY.regenerateHealthgeneral, 14, 'and the dearest');
  assert.equal(DIFFICULTY.spellAbsorptiongeneral, 14);
  assert.equal(DIFFICULTY.criticalWeakness, -14, 'the deepest discount');
  assert.equal(DIFFICULTY.inabilityToRegen, -14);
  assert.equal(DIFFICULTY.lightPoweredMageryunableToUseMagicInDarkness, -14);
  // the bonus-to-hit row DAEDRA is cheaper than the other three, and
  // that asymmetry is the table's, not a typo
  assert.equal(DIFFICULTY.bonusToHitdaedra, 3);
  assert.equal(DIFFICULTY.bonusToHitanimals, 6);
  assert.equal(DIFFICULTY.bonusToHithumanoid, 6);
  assert.equal(DIFFICULTY.bonusToHitundead, 6);
});

test('U20b: eight primaries ignore their secondary when pricing', () => {
  // GetAdvDisAdjustment (:479-497) - the switch returns
  // difficultyDict[primary] for these and [primary+secondary] for all
  // the rest. Immunity costs 10 whatever it is immunity TO.
  for (const s of ['toFire', 'toFrost', 'toDisease', '']) {
    assert.equal(advDisAdjustment('immunity', s), 10, s);
    assert.equal(advDisAdjustment('resistance', s), 5, s);
    assert.equal(advDisAdjustment('criticalWeakness', s), -14, s);
    assert.equal(advDisAdjustment('lowTolerance', s), -5, s);
    assert.equal(advDisAdjustment('expertiseIn', s), 2, s);
    assert.equal(advDisAdjustment('forbiddenWeaponry', s), -2, s);
    assert.equal(advDisAdjustment('forbiddenShieldTypes', s), -1, s);
    assert.equal(advDisAdjustment('phobia', s), -4, s);
  }
  // and the ones that DO read it
  assert.equal(advDisAdjustment('bonusToHit', 'daedra'), 3);
  assert.equal(advDisAdjustment('bonusToHit', 'undead'), 6);
  assert.equal(advDisAdjustment('forbiddenMaterial', 'steel'), -10, 'steel is the dearest to forbid');
  assert.equal(advDisAdjustment('forbiddenMaterial', 'iron'), -1, 'iron the cheapest');
  assert.equal(advDisAdjustment('increasedMagery', 'intInSpellPoints3'), 10);
});

test('U20b: the window\'s total is the sum of its picks', () => {
  // UpdateDifficultyAdjustment (:534-552)
  assert.equal(totalAdjust([]), 0);
  assert.equal(totalAdjust([{ difficulty: 4 }, { difficulty: 10 }, { difficulty: -6 }]), 8);
});

// ---- the add rules ----

test('U20b: an exact duplicate cannot be added', () => {
  // CannotAddAdvantage's first test (:565-566)
  const list = [{ primary: 'immunity', secondary: 'toFire', difficulty: 10 }];
  assert.equal(cannotAdd({ primary: 'immunity', secondary: 'toFire' }, list, []), true);
  assert.equal(cannotAdd({ primary: 'immunity', secondary: 'toFrost' }, list, []), false,
    'a DIFFERENT effect is a different pick');
});

test('U20b: the incompatible pairs match only on the SAME secondary', () => {
  // IsMatchingAdvPair (:588-598) - both primaries AND equal
  // secondaries. This is the rule that lets a character be immune to
  // fire and critically weak to frost.
  const immuneFire = [{ primary: 'immunity', secondary: 'toFire', difficulty: 10 }];
  assert.equal(cannotAdd({ primary: 'resistance', secondary: 'toFire' }, [], immuneFire), true,
    'resistance to the SAME effect is blocked');
  assert.equal(cannotAdd({ primary: 'criticalWeakness', secondary: 'toFire' }, [], immuneFire), true);
  assert.equal(cannotAdd({ primary: 'lowTolerance', secondary: 'toFire' }, [], immuneFire), true);
  assert.equal(cannotAdd({ primary: 'resistance', secondary: 'toFrost' }, [], immuneFire), false,
    'but a different effect is free - the four only clash on ONE effect');
  // the two non-tolerance pairs
  assert.equal(cannotAdd({ primary: 'phobia', secondary: 'undead' },
    [], [{ primary: 'bonusToHit', secondary: 'undead' }]), true);
  assert.equal(cannotAdd({ primary: 'phobia', secondary: 'daedra' },
    [], [{ primary: 'bonusToHit', secondary: 'undead' }]), false);
  assert.equal(cannotAdd({ primary: 'forbiddenWeaponry', secondary: 'axe' },
    [], [{ primary: 'expertiseIn', secondary: 'axe' }]), true);
});

test('U20b: cannotAdd reads BOTH windows\' lists', () => {
  // adList = advDisList + otherList (:556-559). The advantages window
  // is handed the disadvantages list and vice versa, which is the only
  // reason an advantage can clash with a disadvantage at all.
  const other = [{ primary: 'criticalWeakness', secondary: 'toShock', difficulty: -14 }];
  assert.equal(cannotAdd({ primary: 'immunity', secondary: 'toShock' }, [], other), true,
    'the clash is found in the OTHER window\'s list');
});

// ---- the flow ----

const CAREER = {
  name: 'C', hitPointsPerLevel: 8,
  primarySkills: [SKILLS.Archery, SKILLS.LongBlade, SKILLS.CriticalStrike],
  majorSkills: [SKILLS.Dodging, SKILLS.Running, SKILLS.Stealth],
  minorSkills: [SKILLS.Climbing, SKILLS.Jumping, SKILLS.Swimming, SKILLS.Medical, SKILLS.Etiquette, SKILLS.Streetwise],
};
const CAREERS = Array.from({ length: 18 }, (_, i) => ({ name: `C${i}`, career: { ...CAREER, name: `C${i}` } }));
const twelve = [
  SKILLS.Archery, SKILLS.LongBlade, SKILLS.CriticalStrike,
  SKILLS.Dodging, SKILLS.Running, SKILLS.Stealth,
  SKILLS.Climbing, SKILLS.Jumping, SKILLS.Swimming,
  SKILLS.Medical, SKILLS.Etiquette, SKILLS.Streetwise,
];
const builder = () => {
  const f = new ChargenFlow(CAREERS, () => 0);
  f.describeText = (id) => [{ text: `record ${id}`, center: true }];
  f.state = 'class';
  f.classListIndex = CAREERS.length;
  f.useClass();
  return f;
};
/** pick `primary` (then `secondary`) through the real picker seam */
const pick = (f, list, primary, secondary = null) => {
  f._openSpecialAdv(list);
  f.advAdd();
  f.advPick(f.custom.pickList.indexOf(primary));
  if (secondary != null) f.advPick(f.custom.pickList.indexOf(secondary));
};

test('U20b: the builder\'s two buttons open the window, and Exit closes it', () => {
  const f = builder();
  assert.equal(f.custom.sub, null);
  f.applyHit({ customAdvantage: true });
  assert.equal(f.custom.sub, 'advantage');
  f.applyHit({ advExit: true });
  assert.equal(f.custom.sub, null, 'ExitButton_OnMouseClick is a bare CloseWindow');
  f.applyHit({ customDisadvantage: true });
  assert.equal(f.custom.sub, 'disadvantage', 'the same window serves the other list');
});

test('U20b: a pick with no secondary lands at once; one with a secondary waits', () => {
  const f = builder();
  pick(f, 'advantage', 'acuteHearing');
  assert.deepEqual(f.custom.advantages, [{ primary: 'acuteHearing', secondary: '', difficulty: 1 }]);
  assert.equal(f.custom.pickList, null, 'the picker closed');
  // one WITH a secondary opens the second list and adds nothing yet
  f.advAdd();
  f.advPick(f.custom.pickList.indexOf('bonusToHit'));
  assert.equal(f.custom.advantages.length, 1, 'nothing added until the secondary is picked');
  assert.deepEqual(f.custom.pickList, ['animals', 'daedra', 'humanoid', 'undead']);
  f.advPick(1);   // daedra
  assert.deepEqual(f.custom.advantages[1], { primary: 'bonusToHit', secondary: 'daedra', difficulty: 3 });
});

test('U20b: cancelling the secondary picker adds nothing', () => {
  // SecondaryPicker_OnCancel (:439-442)
  const f = builder();
  f._openSpecialAdv('advantage');
  f.advAdd();
  f.advPick(f.custom.pickList.indexOf('immunity'));
  assert.equal(f.custom.pickPrimary, 'immunity');
  f.advCancelPick();
  assert.deepEqual(f.custom.advantages, [], 'the half-built item does not survive the cancel');
  assert.equal(f.custom.pickPrimary, null);
});

test('U20b: the three ONLY-ONE limits hold', () => {
  // :340-346, :359-365, :378-384 - the loop sets alreadyAdded and the
  // handler returns before the secondary window ever opens
  assert.deepEqual([...ONLY_ONE_KEYS], ['increasedMagery', 'darknessPoweredMagery', 'lightPoweredMagery']);
  const f = builder();
  pick(f, 'advantage', 'increasedMagery', 'intInSpellPoints2');
  assert.equal(f.custom.advantages.length, 1);
  f.advAdd();
  f.advPick(f.custom.pickList.indexOf('increasedMagery'));
  assert.equal(f.custom.advantages.length, 1, 'a second Increased Magery is refused');
  assert.equal(f.custom.pickList, null, 'and the picker closes without opening the secondary');
  // a NON-limited primary may repeat with a different secondary
  pick(f, 'advantage', 'bonusToHit', 'undead');
  pick(f, 'advantage', 'bonusToHit', 'daedra');
  assert.equal(f.custom.advantages.length, 3, 'bonus-to-hit is not limited to one');
});

test('U20b: the add button does nothing at seven items', () => {
  // AddAdvantageButton_OnMouseClick (:297-300) returns silently
  const f = builder();
  const secondaries = ['toFire', 'toFrost', 'toDisease', 'toMagic', 'toParalysis', 'toPoison', 'toShock'];
  for (const s of secondaries) pick(f, 'advantage', 'immunity', s);
  assert.equal(f.custom.advantages.length, MAX_ITEMS);
  assert.equal(MAX_ITEMS, 7);
  f._openSpecialAdv('advantage');
  f.advAdd();
  assert.equal(f.custom.pickList, null, 'the picker never opens at seven');
  assert.equal(f.custom.advantages.length, 7);
});

test('U20b: a label click removes that item and re-tallies', () => {
  // AdvantageLabel_OnMouseClick (:436-460)
  const f = builder();
  pick(f, 'advantage', 'acuteHearing');
  pick(f, 'advantage', 'athleticism');
  assert.equal(f.custom.advantageAdjust, 5, '1 + 4');
  f.applyHit({ advRemove: 0 });
  assert.deepEqual(f.custom.advantages.map((a) => a.primary), ['athleticism']);
  assert.equal(f.custom.advantageAdjust, 4, 'the tally follows');
});

// ---- the whole point: the tally is LIVE ----

test('U20b: the advantage terms reach the difficulty dagger and the multiplier', () => {
  // UpdateDifficulty (:477-498): difficultyPoints = the HP tally PLUS
  // advantageAdjust + disadvantageAdjust, and the advancement
  // multiplier is recomputed from it. For the whole of U20a both terms
  // were pinned at 0, so a custom class advanced at its HP-only rate
  // however many advantages it took.
  const f = builder();
  assert.equal(f.customDifficulty(), 0, 'a default-HP class with no picks');
  pick(f, 'advantage', 'regenerateHealth', 'general');       // +14
  assert.equal(f.custom.advantageAdjust, 14);
  assert.equal(f.customDifficulty(), 14, 'the advantage RAISES the difficulty');
  pick(f, 'disadvantage', 'inabilityToRegen');               // -14
  assert.equal(f.custom.disadvantageAdjust, -14);
  assert.equal(f.customDifficulty(), 0, 'and the disadvantage pays for it');
  // the two terms are tracked SEPARATELY, as DFU's two windows are
  assert.equal(f.custom.advantageAdjust, 14);
});

test('U20b: the built career carries the full tally in its advancement multiplier', () => {
  const f = builder();
  f.custom.className = 'Scout';
  twelve.forEach((id, i) => { f.custom.skills[i] = id; });
  pick(f, 'advantage', 'athleticism');                        // +4
  f.customExit();
  assert.equal(f.customDifficulty(), 4);
  assert.equal(f.customCareer.advancementMultiplier, advancementMultiplier(4),
    'NOT advancementMultiplier(difficultyPoints(hp)) - the adjusts are in');
  assert.notEqual(f.customCareer.advancementMultiplier, advancementMultiplier(difficultyPoints(HP_DEFAULT)));
});

test('U20b: the difficulty gate reads the adjusted tally', () => {
  // the 306 gate (:450-458) sits AFTER UpdateDifficulty has folded the
  // adjusts in, so advantages alone can push a legal-HP class out of
  // the band - which HP alone cannot do (max 22, min -8).
  const f = builder();
  f.custom.className = 'Scout';
  twelve.forEach((id, i) => { f.custom.skills[i] = id; });
  // three of the dearest advantages: 14 + 14 + 12 = 40 exactly, still legal
  pick(f, 'advantage', 'regenerateHealth', 'general');
  pick(f, 'advantage', 'spellAbsorption', 'general');
  pick(f, 'advantage', 'spellAbsorption', 'inDarkness');
  assert.equal(f.customDifficulty(), 40, 'exactly the ceiling');
  f.customExit();
  assert.equal(f.state !== 'customClass' || f.custom.box == null, true, 'the ceiling itself passes');
  // one more point and the dagger is in the red
  const g = builder();
  g.custom.className = 'Scout';
  twelve.forEach((id, i) => { g.custom.skills[i] = id; });
  pick(g, 'advantage', 'regenerateHealth', 'general');
  pick(g, 'advantage', 'spellAbsorption', 'general');
  pick(g, 'advantage', 'spellAbsorption', 'inDarkness');
  pick(g, 'advantage', 'acuteHearing');                        // +1 -> 41
  assert.equal(g.customDifficulty(), 41);
  g.customExit();
  assert.match(g.custom.box[0].text, /306/, 'strAdvancingDaggerInRed');
  assert.equal(g.state, 'customClass', 'and the builder stays open');
});

// ---- the label block ----

test('U20b: a secondary is squished to +6 and the block resumes at +8', () => {
  // UpdateLabels (:498-532)
  assert.equal(MAX_LABELS, 14);
  const rows = labelRows([
    { primary: 'acuteHearing', secondary: '' },
    { primary: 'bonusToHit', secondary: 'undead' },
    { primary: 'athleticism', secondary: '' },
  ]);
  assert.deepEqual(rows.map((r) => [r.text, r.y, r.index]), [
    ['Acute Hearing', 35, 0],
    ['Bonus to hit', 43, 1],
    ['Undead', 49, 1],          // +6 from its primary, not +8
    ['Athleticism', 57, 2],     // and the block resumes the 8 step
  ]);
  assert.equal(LABEL_ORIGIN[1], 35);
  assert.equal(LABEL_SPACING, 8);
  assert.equal(TANDEM_SPACING, 6);
});

// ---- ParseCareerData, decoded through the port's OWN readers ----

const freshCareer = () => buildCustomCareer({
  name: 'X', hp: HP_DEFAULT, skills: twelve,
  stats: Object.fromEntries(STAT_KEYS_ORDER.map((k) => [k, 50])),
});

test('U20b: the tolerance quartet writes its four separate EffectFlags bytes', () => {
  // SetTolerance (:714-745) - resistance/immunity/lowTolerance/
  // criticalWeakness are four distinct CFG bytes, not one field
  const c = freshCareer();
  parseCareerData(c, [
    { primary: 'immunity', secondary: 'toFire' },
    { primary: 'resistance', secondary: 'toFrost' },
    { primary: 'lowTolerance', secondary: 'toPoison' },
    { primary: 'criticalWeakness', secondary: 'toShock' },
  ]);
  assert.equal(c.immunityFlags, 8, 'Fire');
  assert.equal(c.resistanceFlags, 16, 'Frost');
  assert.equal(c.lowToleranceFlags, 4, 'Poison');
  assert.equal(c.criticalWeaknessFlags, 32, 'Shock');
});

test('U20b: the special-ability bits read back through hasSpecialAbility', () => {
  // TEST THE SHAPE THE PRODUCER MINTS: decode with the port's own
  // consumer, not by re-asserting the literal we just wrote.
  const c = freshCareer();
  parseCareerData(c, [
    { primary: 'acuteHearing', secondary: '' },
    { primary: 'athleticism', secondary: '' },
    { primary: 'adrenalineRush', secondary: '' },
    { primary: 'inabilityToRegen', secondary: '' },
    { primary: 'damage', secondary: 'fromSunlight' },
  ]);
  assert.equal(hasSpecialAbility(c, SPECIAL_ABILITY.AcuteHearing), true);
  assert.equal(hasSpecialAbility(c, SPECIAL_ABILITY.Athleticism), true);
  assert.equal(hasSpecialAbility(c, SPECIAL_ABILITY.AdrenalineRush), true);
  assert.equal(hasSpecialAbility(c, SPECIAL_ABILITY.NoRegenSpellPoints), true);
  assert.equal(hasSpecialAbility(c, SPECIAL_ABILITY.SunDamage), true);
  assert.equal(hasSpecialAbility(c, SPECIAL_ABILITY.HolyDamage), false, 'the other damage arm was not taken');
});

test('U20b: Increased Magery REPLACES the spell point multiplier', () => {
  // SetMagery (:747-775). The builder starts at Times_0_50 and the
  // pick must overwrite those three bits, not OR into them.
  const c = freshCareer();
  assert.equal(spellPointMultiplier(c.abilityFlagsAndSpellPointsBitfield), 0.5, 'the builder default');
  parseCareerData(c, [{ primary: 'increasedMagery', secondary: 'intInSpellPoints3' }]);
  assert.equal(spellPointMultiplier(c.abilityFlagsAndSpellPointsBitfield), 3.0);
  // and every rung of the ladder
  for (const [key, mult] of [['intInSpellPoints', 1.0], ['intInSpellPoints15', 1.5],
    ['intInSpellPoints175', 1.75], ['intInSpellPoints2', 2.0]]) {
    const k = freshCareer();
    parseCareerData(k, [{ primary: 'increasedMagery', secondary: key }]);
    assert.equal(spellPointMultiplier(k.abilityFlagsAndSpellPointsBitfield), mult, key);
  }
  assert.equal(DEFAULT_MAGERY_BITS, 20, 'Times_0_50');
});

test('U20b: the magery bits do not disturb the ability bits beside them', () => {
  // The bitfield packs abilities at 0-5, light magery at 6-7, darkness
  // at 8-9 and the multiplier at 10-12 (DFCareer:619-620,782). A
  // careless OR or a wrong mask corrupts a neighbour.
  const c = freshCareer();
  parseCareerData(c, [
    { primary: 'acuteHearing', secondary: '' },
    { primary: 'increasedMagery', secondary: 'intInSpellPoints2' },
    { primary: 'darknessPoweredMagery', secondary: 'unableToUseMagicInDaylight' },
    { primary: 'lightPoweredMagery', secondary: 'lowerMagicAbilityDarkness' },
  ]);
  assert.equal(hasSpecialAbility(c, SPECIAL_ABILITY.AcuteHearing), true, 'the ability bit survived');
  assert.equal(spellPointMultiplier(c.abilityFlagsAndSpellPointsBitfield), 2.0, 'the multiplier survived');
  assert.equal((c.abilityFlagsAndSpellPointsBitfield & 0x300) >> 8, 1, 'darkness: UnableToCastInLight');
  assert.equal((c.abilityFlagsAndSpellPointsBitfield & 0x00C0) >> 6, 2, 'light: ReducedPowerInDarkness');
});

test('U20b: proficiencies split across the bitfield\'s forbidden and expert halves', () => {
  // SetProficiency (:622-700) + DFCareer:606-607 - forbidden at bits
  // 0..5, expert at 16..21, in ONE u32
  const c = freshCareer();
  parseCareerData(c, [
    { primary: 'expertiseIn', secondary: 'missileWeapon' },
    { primary: 'forbiddenWeaponry', secondary: 'axe' },
  ]);
  assert.equal(c.weaponArmorShieldsBitfield & 0x3f, 8, 'forbidden: Axes');
  assert.equal((c.weaponArmorShieldsBitfield >>> 16) & 0x3f, 32, 'expert: MissileWeapons');
});

test('U20b: armor, shields and materials land on their own fields', () => {
  const c = freshCareer();
  parseCareerData(c, [
    { primary: 'forbiddenArmorType', secondary: 'plate' },
    { primary: 'forbiddenShieldTypes', secondary: 'towerShield' },
    { primary: 'forbiddenMaterial', secondary: 'daedric' },
    { primary: 'forbiddenMaterial', secondary: 'iron' },
  ]);
  assert.equal((c.weaponArmorShieldsBitfield >>> 6) & 0x07, 4, 'Plate');
  assert.equal((c.weaponArmorShieldsBitfield >>> 9) & 0x0f, 8, 'TowerShield');
  assert.equal(c.forbiddenMaterialsFlags, 512 | 1, 'Daedric | Iron - materials accumulate');
});

test('U20b: bonus-to-hit and phobia read back through careerAttackModifier', () => {
  // SetAttackModifier (:598-620), decoded by the combat consumer that
  // actually reads the byte in play.
  const c = freshCareer();
  parseCareerData(c, [
    { primary: 'bonusToHit', secondary: 'undead' },
    { primary: 'phobia', secondary: 'animals' },
  ]);
  assert.equal(careerAttackModifier(c.attackModifierFlags, ENEMY_GROUPS.Undead), 1);
  assert.equal(careerAttackModifier(c.attackModifierFlags, ENEMY_GROUPS.Animals), -1);
  assert.equal(careerAttackModifier(c.attackModifierFlags, ENEMY_GROUPS.Daedra), 0, 'untouched groups stay neutral');
});

test('U20b: rapid healing, regeneration and absorption take whole-byte flags', () => {
  const c = freshCareer();
  parseCareerData(c, [
    { primary: 'rapidHealing', secondary: 'inDarkness' },
    { primary: 'regenerateHealth', secondary: 'whileImmersed' },
    { primary: 'spellAbsorption', secondary: 'general' },
  ]);
  assert.equal(c.rapidHealing, 2, 'RapidHealingFlags.InDarkness');
  assert.equal(c.regeneration, 4, 'RegenerationFlags.InWater - the fourth row only regeneration has');
  assert.equal(c.spellAbsorptionFlags, 4, 'SpellAbsorptionFlags.Always');
});

test('U20b: a finished class carries its picks all the way out of the builder', () => {
  const f = builder();
  f.custom.className = 'Nightblade';
  twelve.forEach((id, i) => { f.custom.skills[i] = id; });
  pick(f, 'advantage', 'immunity', 'toParalysis');
  pick(f, 'disadvantage', 'forbiddenArmorType', 'plate');
  f.customExit();
  assert.equal(f.customCareer.immunityFlags, 1, 'Paralysis, through the whole flow');
  assert.equal((f.customCareer.weaponArmorShieldsBitfield >>> 6) & 0x07, 4, 'and Plate forbidden');
  assert.equal(f.customDifficulty(), 10 - 5, 'immunity 10, forbidden plate -5');
});
