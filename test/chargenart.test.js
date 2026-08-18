// U10: the classic chargen screens. Every pin fails under a
// one-character mutation of the law it names.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RECTS, raceAtPickerPoint, chargenHit, ALT_SHADOW_1, SELECTED_TEXT, INPUT_TEXT } from '../src/ui/chargenArt.js';
import { SKILL_NAMES, SKILL_KEYS, SKILLS } from '../src/systems/skills.js';
import { ChargenFlow } from '../src/ui/chargen.js';
import { damageModifier, maxEncumbrance, magicResist, toHitModifier, hitPointsModifier, healingRateModifier, spellPointsFor } from '../src/combat/formulas.js';
import { healingRateModifier as restHealing } from '../src/systems/rest.js';
import { spellPoints } from '../src/systems/chargen.js';

test('U10: the window rects, pinned WHOLE against the DFU literals', () => {
  // A spot check would let a single drifted rect through, and a rect
  // is exactly the thing that drifts (the 17d audit's lesson).
  assert.deepEqual({ ...RECTS }, {
    nameBox: [80, 5, 214, 7],        // CreateCharNameSelect.cs:73-74
    randomName: [279, 3, 36, 10],    // :78
    ok: [263, 172, 39, 22],          // :85
    reroll: [263, 147, 39, 22],      // CreateCharAddBonusStats.cs:112
    faceDisplay: [247, 25, 64, 40],  // FacePicker.cs:55-57
    facePrev: [245, 69, 42, 9],      // :65
    faceNext: [287, 69, 26, 9],      // :67
    pickList: [26, 27, 138, 72],     // DaggerfallListPickerWindow.cs:82-83
    pickPrev: [179, 10, 9, 9],       // :88
    pickNext: [179, 108, 9, 9],      // :92
    pickScroll: [181, 23, 5, 82],    // :97-98
  });
});

test('U10: the window colours are DaggerfallUI\'s, not invented', () => {
  // DaggerfallUI.cs:52-62. The rollouts use the ALTERNATE shadow, not
  // the default one every other native window draws with.
  assert.deepEqual(ALT_SHADOW_1, [44 / 255, 60 / 255, 60 / 255, 1]);
  assert.deepEqual(SELECTED_TEXT, [162 / 255, 36 / 255, 12 / 255, 1]);
  assert.deepEqual(INPUT_TEXT, [227 / 255, 223 / 255, 0, 1]);
});

test('U10: the province picker reads TAMRIEL2 index -> race id', () => {
  // CreateCharRaceSelect.cs:93-102 - offset = y*width + x into the
  // RAW indexed bitmap, and the index IS the race id because
  // RaceTemplate.GetRaceDictionary keys on ID (RaceTemplate.cs:76-101).
  const bmp = { width: 4, height: 3, data: Uint8Array.from([
    0, 1, 2, 3,
    4, 5, 6, 7,
    8, 0, 0, 0,
  ]) };
  assert.equal(raceAtPickerPoint(bmp, 1, 0).key, 'Breton');     // id 1
  assert.equal(raceAtPickerPoint(bmp, 3, 0).key, 'Nord');       // id 3
  assert.equal(raceAtPickerPoint(bmp, 2, 1).key, 'WoodElf');    // id 6
  assert.equal(raceAtPickerPoint(bmp, 0, 2).key, 'Argonian');   // id 8
  assert.equal(raceAtPickerPoint(bmp, 0, 0), null, 'index 0 is not a province');
  assert.equal(raceAtPickerPoint(bmp, 4, 0), null, 'past the row wraps in a flat buffer - must be rejected');
  assert.equal(raceAtPickerPoint(bmp, 0, 9), null, 'past the last row');
  assert.equal(raceAtPickerPoint(null, 1, 0), null);
});

test('U10: GetSkillName\'s display strings, not the enum keys', () => {
  // TextProvider.GetSkillName over Internal_Strings.csv:380-400,498.
  // The port printed the raw key, so the char sheet read "ShortBlade".
  assert.equal(SKILL_KEYS[SKILLS.ShortBlade], 'ShortBlade', 'the KEY is code identity');
  assert.equal(SKILL_NAMES[SKILLS.ShortBlade], 'Short Blade');
  assert.equal(SKILL_NAMES[SKILLS.LongBlade], 'Long Blade');
  assert.equal(SKILL_NAMES[SKILLS.BluntWeapon], 'Blunt Weapon');
  assert.equal(SKILL_NAMES[SKILLS.CriticalStrike], 'Critical Strike');
  assert.equal(SKILL_NAMES[SKILLS.HandToHand], 'Hand-to-Hand', 'the one hyphenated name');
  assert.equal(SKILL_NAMES[SKILLS.Medical], 'Medical', 'single words are untouched');
  assert.equal(SKILL_NAMES.length, SKILL_KEYS.length);
});

test('U10 / ONE DFU MEMBER, ONE EXPORT: the derived stats have one home', () => {
  // FormulaHelper.cs:66-125. These were scattered - MaxEncumbrance
  // inline in charsheet, MagicResist inline in spellcast,
  // HealingRateModifier in rest, SpellPoints in chargen - with
  // ToHitModifier and HitPointsModifier missing entirely.
  assert.equal(damageModifier(50), 0);
  assert.equal(damageModifier(40), -2);
  assert.equal(maxEncumbrance(50), 75);
  assert.equal(magicResist(72), 7);
  assert.equal(toHitModifier(48), -1);
  assert.equal(hitPointsModifier(52), 0);
  assert.equal(healingRateModifier(52), 0);
  assert.equal(spellPointsFor(60, 2), 120);
  // and the old import sites resolve to the SAME function
  assert.equal(restHealing, healingRateModifier);
  assert.equal(spellPoints, spellPointsFor);
});

const CAREER = {
  name: 'Mage', hitPointsPerLevel: 8, advancementMultiplier: 1.0,
  strength: 40, intelligence: 60, willpower: 72, agility: 48,
  endurance: 52, personality: 55, speed: 48, luck: 57,
  primarySkills: [SKILLS.Mysticism, SKILLS.Alteration, SKILLS.Thaumaturgy],
  majorSkills: [SKILLS.Illusion, SKILLS.Destruction, SKILLS.Restoration],
  minorSkills: [SKILLS.Medical, SKILLS.ShortBlade, SKILLS.BluntWeapon, SKILLS.Dragonish, SKILLS.Daedric, SKILLS.Dodging],
};
const atStats = () => {
  const f = new ChargenFlow([{ name: 'Mage', career: CAREER }], () => 0);
  f.state = 'stats'; f._enterStats();
  return f;
};

test('U10: the derived block reads the flow\'s LIVE stats', () => {
  // CreateCharAddBonusStats.cs:94-100 - the seven labels, signed
  // modifiers carrying their sign as DFU's labels do.
  const f = atStats();
  const before = f.derived();
  assert.equal(before.magicResist, String(magicResist(f.stats.willpower)));
  assert.equal(before.toHit, `${toHitModifier(f.stats.agility)}`.replace(/^(\d)/, '+$1'));
  // spend a point on the cursor stat and the block must follow
  const key = Object.keys(f.stats)[0];
  const was = f.stats[key];
  f.input('plus');
  assert.equal(f.stats[key], was + 1, 'the cursor starts on the first stat');
  assert.equal(f.derived().damage, (() => { const n = damageModifier(f.stats.strength); return n >= 0 ? `+${n}` : String(n); })());
});

test('U10: clicks land on DFU\'s own buttons', () => {
  const f = new ChargenFlow([{ name: 'Mage', career: CAREER }], () => 0);
  // the pure hit law - no art needed
  f.state = 'face';
  assert.equal(chargenHit(f, 246, 70), 'up', 'PREVIOUS');
  assert.equal(chargenHit(f, 300, 70), 'down', 'NEXT');
  assert.equal(chargenHit(f, 280, 180), 'confirm', 'OK');
  assert.equal(chargenHit(f, 10, 10), null, 'the panel is not one big button');
  f.state = 'stats'; f._enterStats();
  assert.equal(chargenHit(f, 280, 155), 'reroll');
  assert.equal(chargenHit(f, 280, 180), 'confirm');
  assert.deepEqual(chargenHit(f, 20, 70), { setCursor: 2 }, 'the third stat button (7,20)+22*2');
  assert.equal(chargenHit(f, 50, 24), 'plus', 'the spinner rides the cursor row');
  assert.equal(chargenHit(f, 50, 36), 'minus');
  f.state = 'skills'; f._enterSkills();
  assert.deepEqual(chargenHit(f, 100, 34), { setCursor: 0 }, 'primary row 0 at y=32, 106x7');
  assert.deepEqual(chargenHit(f, 100, 84), { setCursor: 3 }, 'major row 0 at y=81');
  assert.deepEqual(chargenHit(f, 100, 133), { setCursor: 6 }, 'minor row 0 at y=130');
  assert.equal(chargenHit(f, 100, 120), null, 'the gaps between the groups are dead');
  // the row button is 7 tall on a 10px pitch (SkillsRollout.cs:184),
  // so the 3px BETWEEN rows is dead too - a button sized to the pitch
  // would swallow it and mis-target the row above
  assert.equal(chargenHit(f, 100, 40), null, 'the 3px between two primary rows');
  assert.deepEqual(chargenHit(f, 100, 38), { setCursor: 0 }, 'the button\'s last pixel row still hits');
});
