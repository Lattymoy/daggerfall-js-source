// VAMP-DAY (2026-09-26, Mac: "do vampires have a negative??? seems they have no negative aspect bug or feature???
// instead of constant damage taken they should get reduced stats in day and get the bonus at night"; asked, "Day -20 /
// night +20"): THE PORT'S DEPARTURE from VampirismEffect. The sun no longer burns a vampire; the curse's stat
// advantages are the night's, and from 06:00 to 18:00 - wherever the vampire stands - the same stats are 20 down. A
// day never zeroes a stat (a live 0 kills - killIfAnyLiveStatZero). The skills' +30, holy ground's burn, the feeding
// and the rest it gates, and the travel rules stay DFU's.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createVampirismCurse, vampirismMagicRound, vampireStatMod, liveRaceTemplate, racialFastTravelBlock, racialRestBlock,
  VAMPIRE_STATS, VAMPIRE_STAT_MOD, VAMPIRE_SKILL_MOD, SUNLIGHT_TRAVEL_TEXT, NOT_SATED_TEXT_ID,
} from '../src/systems/vampirism.js';
import { VAMPIRE_CLANS } from '../src/systems/infection.js';
import { liveStat, killIfAnyLiveStatZero, REFRESH_MODS_DELAY } from '../src/systems/statMods.js';
import { passiveSpecialsMagicRound, setPassiveSpecialsHost, SUN_DAMAGE_AMOUNT, HOLY_DAMAGE_AMOUNT } from '../src/systems/passiveSpecials.js';
import { SPECIAL_ABILITY_BITS } from '../src/systems/specialAdvantages.js';
import { MINUTES_PER_DAY } from '../src/systems/gameDate.js';

const DAY = 400;   // a classic day number, far from the start
const at = (hour, minute = 0) => DAY * MINUTES_PER_DAY + hour * 60 + minute;
const mortal = (stats = {}) => ({
  isPlayer: true, name: 'Mac', race: 'Breton', gender: 'male', level: 10,
  stats: { strength: 60, intelligence: 50, willpower: 50, agility: 60, endurance: 60, personality: 50, speed: 60, luck: 50, ...stats },
  activeEffects: [], spells: [], health: 100, maxHealth: 100,
});
const vampire = (clan = VAMPIRE_CLANS.Lyrezi, stats = {}, now = at(19)) => {
  const p = mortal(stats);
  createVampirismCurse(p, clan, { now });
  return p;
};

test('VAMP-DAY: the curse\'s stat mod is DFU\'s +20 by night and the same 20 down by day - 06:00 to 18:00, by the hour', () => {
  for (const [h, m] of [[0, 0], [5, 59], [18, 0], [23, 59]]) assert.equal(vampireStatMod(at(h, m)), VAMPIRE_STAT_MOD, `${h}:${m} is night`);
  for (const [h, m] of [[6, 0], [12, 0], [17, 59]]) assert.equal(vampireStatMod(at(h, m)), -VAMPIRE_STAT_MOD, `${h}:${m} is day`);
  assert.equal(VAMPIRE_STAT_MOD, 20);
});

test('VAMP-DAY: the round sets the seven stats (and an Anthotis mind) by the clock\'s hour; the skills keep their +30', () => {
  const p = vampire(VAMPIRE_CLANS.Anthotis);
  vampirismMagicRound(p, { nowMinutes: at(12) });
  for (const stat of VAMPIRE_STATS) assert.equal(p.racialOverride.statMods[stat], -20, `${stat} by day`);
  assert.equal(p.racialOverride.statMods.intelligence, -20, 'the Anthotis mind dims with the rest');
  assert.equal(p.racialOverride.skillMods[Object.keys(p.racialOverride.skillMods)[0]], VAMPIRE_SKILL_MOD, 'the skills are the curse\'s day and night');
  assert.deepEqual([liveStat(p, 'strength'), liveStat(p, 'intelligence')], [40, 30]);
  vampirismMagicRound(p, { nowMinutes: at(22) });
  for (const stat of VAMPIRE_STATS) assert.equal(p.racialOverride.statMods[stat], 20, `${stat} by night`);
  assert.deepEqual([liveStat(p, 'strength'), liveStat(p, 'intelligence')], [80, 70]);
  const lyrezi = vampire(VAMPIRE_CLANS.Lyrezi);
  vampirismMagicRound(lyrezi, { nowMinutes: at(12) });
  assert.equal(lyrezi.racialOverride.statMods.intelligence, undefined, 'only the Anthotis touch the mind');
});

test('VAMP-DAY: a day never kills - a stat of twenty or less stops at 1, and the kill rule finds no zero', () => {
  const p = vampire(VAMPIRE_CLANS.Lyrezi, { luck: 15, personality: 20, speed: 21 });
  vampirismMagicRound(p, { nowMinutes: at(9) });
  assert.deepEqual([liveStat(p, 'luck'), liveStat(p, 'personality'), liveStat(p, 'speed')], [1, 1, 1]);
  let hurt = 0;
  assert.equal(killIfAnyLiveStatZero(p, { hurt: (n) => { hurt += n; } }, REFRESH_MODS_DELAY + 0.01), false, 'no dawn death');
  assert.equal(hurt, 0);
  // a drain between two rounds: the day's penalty yields to it, never below the live 1
  p.activeEffects.push({ kind: 'drainAttribute', stat: 'strength', magnitude: 45 });
  assert.equal(liveStat(p, 'strength'), 1, '60 - 45 = 15, and the day takes it to 1, not 0');
  // the night is the whole +20, the clamp at 100 as ever
  vampirismMagicRound(p, { nowMinutes: at(21) });
  assert.deepEqual([liveStat(p, 'luck'), liveStat(p, 'strength')], [35, 35]);
  const strong = vampire(VAMPIRE_CLANS.Lyrezi, { strength: 95 });
  vampirismMagicRound(strong, { nowMinutes: at(21) });
  assert.equal(liveStat(strong, 'strength'), 100);
});

test('VAMP-DAY: the sun burns a vampire no more - an old save\'s curse too - while a sun-cursed CAREER still burns and holy ground still burns the vampire', () => {
  const prev = setPassiveSpecialsHost({ isInside: () => false, inPrison: () => false, isHolyPlace: () => false });
  try {
    const noon = at(12);   // on the 4-round cadence
    assert.equal(noon % 4, 0);
    const v = vampire();
    assert.equal(v.racialOverride.sunDamage, true, 'the flag stands, as an old save\'s does - the travel rules read it');
    let hurt = 0;
    passiveSpecialsMagicRound(v, { nowMinutes: noon, sinks: { hurt: (n) => { hurt += n; } } });
    assert.equal(hurt, 0, 'no burn at noon, outside');
    const career = mortal();
    career.career = { abilityFlagsAndSpellPointsBitfield: SPECIAL_ABILITY_BITS.sunDamage };
    let burnt = 0;
    passiveSpecialsMagicRound(career, { nowMinutes: noon, sinks: { hurt: (n) => { burnt += n; } } });
    assert.equal(burnt, SUN_DAMAGE_AMOUNT, 'the chosen disadvantage is the player\'s own, and stays');
    setPassiveSpecialsHost({ isInside: () => true, isHolyPlace: () => true });
    passiveSpecialsMagicRound(v, { nowMinutes: noon, sinks: { hurt: (n) => { hurt += n; } } });
    assert.equal(hurt, HOLY_DAMAGE_AMOUNT, 'a temple still burns a vampire');
  } finally { setPassiveSpecialsHost(prev); }
});

test('VAMP-DAY: the sheet no longer lists damage from sunlight - holy places it does - and the travel and feeding rules stand', () => {
  const v = vampire();
  const race = liveRaceTemplate(v);
  assert.equal(race.specialAbilities & SPECIAL_ABILITY_BITS.sunDamage, 0, 'no sun on the sheet');
  assert.equal(race.specialAbilities & SPECIAL_ABILITY_BITS.holyDamage, SPECIAL_ABILITY_BITS.holyDamage);
  assert.deepEqual(racialFastTravelBlock(v, at(12)), { text: SUNLIGHT_TRAVEL_TEXT }, 'no fast travel by day');
  assert.equal(racialFastTravelBlock(v, at(22)), null);
  assert.deepEqual(racialRestBlock(v, at(19) + MINUTES_PER_DAY + 1), { textId: NOT_SATED_TEXT_ID }, 'an unfed vampire cannot rest');
});
