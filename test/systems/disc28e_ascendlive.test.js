// ASCEND-LIVE (2026-09-28, Discord, Megatronism: "The permanent stat bonuses from being a werewolf (vampire, etc...)
// do not appear on the level up screen, only showing what your stats would be before the bonuses were applied. You
// can actually put points into an already maxed out attribute if you are not careful, and waste part of your level
// up"). Every lane spends and caps the PERMANENT value, and still does - DFU's StatsRollout draws and caps
// GetPermanentStatValue, the mod reads `.base` - but the curse's +40 rides the live channel, so the Ascension's stars
// said 63 for a werewolf whose Stats page says 100. A star now wears the LIVE value (liveStat's own law over the
// working permanent value), and the chosen star's line says so - and, where a point would not show, that it would not.
// Fixtures from the port's own mints: createCharacter, the curse's own round, the screens themselves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createCharacter } from '../../src/systems/chargen.js';
import { SKILLS } from '../../src/systems/skills.js';
import { createLycanthropyCurse, morphSelf, lycanthropyMagicRound } from '../../src/systems/lycanthropy.js';
import { createVampirismCurse, vampirismMagicRound } from '../../src/systems/vampirism.js';
import { LYCANTHROPY_TYPES } from '../../src/systems/infection.js';
import { liveStat } from '../../src/systems/statMods.js';
import { isDayFromMinutes, CLASSIC_GAME_START_TIME } from '../../src/systems/gameDate.js';
import { applySpell } from '../../src/systems/effects.js';
import { LevelUpScreen, STAT_INCREASED_COLOR, STAT_DRAINED_COLOR } from '../../src/ui/charsheet.js';
import { ENHANCED_CSS } from '../../src/ui/enhanced/enhancedStyle.js';
import { LV2_CSS } from '../../src/ui/levelUp/levelUpStyle.js';
import { registerEntityFold, computeEntityMods } from '../../src/systems/entityMods.js';
import { codeHasOnce } from '../codeOnly.mjs';
import { VirtueLevelUpScreen } from '../../src/ui/virtueLevelUp.js';
import { rolloutRows, liveNote, liveTint, starLabel, viewOnlyScreen, raiseAt, focusAt, canAscend, ATTRIBUTE_BLURB } from '../../src/ui/levelUp/levelUpView.js';
import { sheetModel } from '../../src/ui/enhanced/enhancedCharSheet.js';
import { initVirtueLeveling, LEVELING_VIRTUE, levelingSettings, ORL_VENDOR } from '../../src/systems/oblivionLeveling.js';
import { MOD_SETTINGS } from '../../src/systems/modSettings.js';

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const career = {
  name: 'W', hitPointsPerLevel: 12, advancementMultiplier: 1.0,
  strength: 60, intelligence: 40, willpower: 45, agility: 55,
  endurance: 60, personality: 40, speed: 50, luck: 50,
  primarySkills: [SKILLS.LongBlade, SKILLS.Axe, SKILLS.CriticalStrike],
  majorSkills: [SKILLS.BluntWeapon, SKILLS.Dodging, SKILLS.Jumping],
  minorSkills: [SKILLS.ShortBlade, SKILLS.Archery, SKILLS.Running, SKILLS.Swimming, SKILLS.Climbing, SKILLS.Medical],
};
// The report's own figure: Strength 63 and Endurance 58 permanent under a werewolf's +40.
const REPORT = { strength: 63, intelligence: 100, willpower: 52, agility: 53, endurance: 58, personality: 52, speed: 50, luck: 57 };
const NIGHT = (() => { let m = CLASSIC_GAME_START_TIME; while (isDayFromMinutes(m)) m += 60; return m; })();
const DAY = (() => { let m = NIGHT; while (!isDayFromMinutes(m)) m += 60; return m; })();
function character() {
  const p = { isPlayer: true, reflexes: 2, items: [] };
  createCharacter(p, career, 16, { rolls: seq(0) });
  Object.assign(p.stats, REPORT);
  p.readyToLevelUp = true; p.pendingLevel = (p.level ?? 1) + 1;
  return p;
}
function werewolf() {
  const p = character();
  assert.ok(createLycanthropyCurse(p, LYCANTHROPY_TYPES.Werewolf, { now: NIGHT }));
  morphSelf(p, { force: true, nowMinutes: NIGHT });   // PIN MOVED (BAL6, bible/05-Combat/Balance-Arc.md section 12): the +40 is the beast's - the report's werewolf has changed
  lycanthropyMagicRound(p, { nowMinutes: NIGHT + 1 });
  assert.equal(liveStat(p, 'strength'), 100, 'the curse\'s +40, read through liveStat itself');
  return p;
}
const row = (screen, key) => rolloutRows(screen).find((r) => r.key === key);

test('ASCEND-LIVE: the report - a werewolf\'s stars wear what the character HAS, and a point that cannot show says so', () => {
  const p = werewolf();
  const s = new LevelUpScreen(p, seq(0), { fanfare: false });
  const str = row(s, 'strength');
  assert.deepEqual([str.value, str.live, str.capped, str.canRaise], [63, 100, true, true],
    'permanent 63 (what the presses move, DFU\'s law), live 100 (what the Stats page shows), and a press the law allows that cannot show');
  assert.equal(liveNote(str), '100 with its bonus - a point here won\'t show');
  assert.deepEqual(['agility', 'endurance', 'speed'].map((k) => [row(s, k).live, row(s, k).capped]), [[93, false], [98, false], [90, false]]);
  assert.equal(liveNote(row(s, 'agility')), '93 with its bonus');
  assert.deepEqual([row(s, 'willpower').live, liveNote(row(s, 'willpower'))], [52, ''], 'a stat the curse leaves alone says nothing more');
  assert.deepEqual([liveTint(str), liveTint(row(s, 'willpower'))], ['boosted', ''], 'the classic sheet\'s tint above the permanent value, none where the two agree');
  assert.equal(starLabel(str), 'Strength 100 (63 permanent), a point here won\'t show for now');   // PIN MOVED (AUDIT GROWTH LANE5-1)
  assert.equal(starLabel(row(s, 'willpower')), 'Willpower 52');
  // The live value follows the WORKING value: Endurance 58 + 40 = 98, two points from the ceiling.
  focusAt(s, 'endurance');
  assert.ok(raiseAt(s, 'endurance') && raiseAt(s, 'endurance'));
  assert.deepEqual([row(s, 'endurance').value, row(s, 'endurance').live, row(s, 'endurance').capped], [60, 100, true]);
  // ...and the law is untouched: the permanent point still goes in, and the window closes the same way.
  assert.ok(raiseAt(s, 'strength'));
  assert.deepEqual([row(s, 'strength').value, row(s, 'strength').live], [64, 100]);
  assert.equal(starLabel(row(s, 'strength')), 'Strength 100 (64 permanent), raised by 1, a point here won\'t show for now');   // PIN MOVED (AUDIT GROWTH LANE5-1)
  assert.equal(canAscend(s), s.pool === 0);
});

test('ASCEND-LIVE: a vampire by day reads lower and by night higher - the live value is the clock\'s, as the Stats page\'s is', () => {
  const p = character();
  assert.ok(createVampirismCurse(p, 0, { now: NIGHT }));
  vampirismMagicRound(p, { nowMinutes: DAY });
  const s = new LevelUpScreen(p, seq(0), { fanfare: false });
  assert.deepEqual([row(s, 'strength').value, row(s, 'strength').live], [63, 43]);
  assert.equal(liveNote(row(s, 'strength')), 'Lowered to 43 for now');   // PIN MOVED (AUDIT GROWTH LANE5-1)
  assert.equal(liveTint(row(s, 'strength')), 'lowered', 'the classic sheet\'s drained tint');
  assert.equal(starLabel(row(s, 'strength')), 'Strength 43 (63 permanent)');   // PIN MOVED (AUDIT GROWTH LANE5-1)
  vampirismMagicRound(p, { nowMinutes: NIGHT + 24 * 60 });
  assert.equal(row(new LevelUpScreen(p, seq(0), { fanfare: false }), 'strength').live, 83);
});

test('ASCEND-LIVE: a point held at a FLOOR is flagged as one at the ceiling is - a vampire\'s day never takes a stat below 1', () => {
  // AUDIT 28e (the level lane): `capped` asked the ceiling alone, so a drained vampire by day - Strength held at 1 -
  // took points that showed nothing and said only "1 for now". Now the row asks liveStat one point on.
  const p = character();
  assert.ok(createVampirismCurse(p, 0, { now: NIGHT }));
  const drain = { type: 7, subType: 0, magnitudeBaseLow: 45, magnitudeBaseHigh: 45, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 0 };
  applySpell({ element: 4, rangeType: 2, effects: [drain] }, 1, p, {}, seq(0.99));
  vampirismMagicRound(p, { nowMinutes: DAY });
  assert.equal(liveStat(p, 'strength'), 1, 'the drain and the day, held at the floor');
  const s = new LevelUpScreen(p, seq(0), { fanfare: false });
  const str = row(s, 'strength');
  assert.deepEqual([str.value, str.live, str.capped], [63, 1, true]);
  assert.equal(liveNote(str), 'Lowered to 1 for now - a point here won\'t show');   // PIN MOVED (AUDIT GROWTH LANE5-1)
  assert.equal(starLabel(str), 'Strength 1 (63 permanent), a point here won\'t show for now');   // PIN MOVED (AUDIT GROWTH LANE5-1)
  // A point that shows is never flagged: by night the same Strength reads 63 - 45 + 20 and rises with a press.
  vampirismMagicRound(p, { nowMinutes: NIGHT + 24 * 60 });
  const night = row(new LevelUpScreen(p, seq(0), { fanfare: false }), 'strength');
  assert.deepEqual([night.live, night.capped, liveNote(night)], [38, false, 'Lowered to 38 for now']);   // PIN MOVED (AUDIT GROWTH LANE5-1)
});

test('ASCEND-LIVE: the mod\'s lane and the view the Stats page opens read the same live values the Stats page draws', () => {
  const p = werewolf();
  const view = viewOnlyScreen(p, false);
  assert.deepEqual(rolloutRows(view).map((r) => r.live), sheetModel(p).attributes.map((a) => a.value),
    'Ascend from the Stats page shows the Stats page\'s numbers');
  // A view has no points to place, so no star warns about one: the bonus is said, the press is not.
  assert.deepEqual([row(view, 'strength').capped, liveNote(row(view, 'strength'))], [false, '100 with its bonus']);
  initVirtueLeveling(p, LEVELING_VIRTUE);
  const reader = (k) => MOD_SETTINGS[ORL_VENDOR].keys[k].default;
  const v = new VirtueLevelUpScreen(p, { settings: levelingSettings(reader), rolls: seq(0), fanfare: false });
  assert.deepEqual([row(v, 'endurance').value, row(v, 'endurance').live], [58, 98]);
  focusAt(v, 'endurance');
  assert.ok(raiseAt(v, 'endurance'));
  assert.ok(row(v, 'endurance').live > 98, 'the mod\'s delta moves the live value too');
});

test('ASCEND-LIVE: the live value folds the modifier channels too - a set\'s or an affix\'s strength is on the star as on the Stats page', () => {
  // The producer's own mint: a fold registered on the one registry, summed onto _mods by computeEntityMods (an equip
  // change or a magic round runs it), read by liveStat's fold arm.
  const p = character();
  registerEntityFold('disc28e-test', (e) => (e === p ? { stats: { strength: 7, luck: -5 } } : null));
  try {
    computeEntityMods(p);
    const s = new LevelUpScreen(p, seq(0), { fanfare: false });
    assert.deepEqual([row(s, 'strength').value, row(s, 'strength').live, liveTint(row(s, 'strength'))], [63, 70, 'boosted']);
    assert.deepEqual([row(s, 'luck').value, row(s, 'luck').live, liveTint(row(s, 'luck'))], [57, 52, 'lowered']);
    assert.deepEqual(rolloutRows(s).map((r) => r.live), sheetModel(p).attributes.map((a) => a.value), 'the Stats page\'s numbers');
  } finally {
    registerEntityFold('disc28e-test', null);
  }
});

test('ASCEND-LIVE: the stars wear the classic sheet\'s own two colours - over a raised star\'s gold, under a full star\'s grey', () => {
  const rgb = (c) => `rgb(${c.slice(0, 3).map((v) => Math.round(v * 255)).join(',')})`;
  const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
  const css = strip(ENHANCED_CSS);
  const ruleColour = (sel, from = css) => {
    const at = from.indexOf(`\n${sel} {`);
    assert.ok(at >= 0, sel);
    return from.slice(at, from.indexOf('}', at)).match(/(?:^|[\s;{])color: (rgb\([^)]*\))/)?.[1];
  };
  assert.equal(ruleColour('.lv-star.boosted:not(.full) .lv-val'), rgb(STAT_INCREASED_COLOR));
  assert.equal(ruleColour('.lv-star.lowered:not(.full) .lv-val'), rgb(STAT_DRAINED_COLOR));
  assert.equal(ruleColour('.lv-live'), rgb(STAT_INCREASED_COLOR));
  assert.equal(ruleColour('.lv-live.lowered'), rgb(STAT_DRAINED_COLOR));
  // THE CASCADE, by specificity (AUDIT 28e: the Plus sheet's raised gold is appended after this sheet and won at equal
  // weight; the tint came after the full grey and won that). A class or a :not(.class) weighs one.
  const weight = (sel) => (sel.match(/\.[\w-]+/g) || []).length;
  assert.ok(strip(LV2_CSS).includes('\n.lv-star.raised .lv-val {'), 'the raised gold');
  assert.ok(css.includes('\n.lv-star.full .lv-val {'), 'the full grey');
  assert.ok(weight('.lv-star.boosted:not(.full) .lv-val') > weight('.lv-star.raised .lv-val'), 'the tint outranks the raised gold');
  assert.ok(!'.lv-star.full .lv-val'.includes(':not') && /:not\(\.full\)/.test('.lv-star.boosted:not(.full) .lv-val'), 'and stands aside for a full star');
});

test('ASCEND-LIVE by source: the window paints the live value on the star, its brightness, its tint, its words and its line', () => {
  const w = readFileSync(new URL('../../src/ui/enhanced/enhancedLevelUp.js', import.meta.url), 'utf8');
  const paint = w.slice(w.indexOf('    for (const s of stars) {'), w.indexOf('    // A LINE LIGHTS WHEN BOTH ITS STARS HAVE RISEN.'));
  codeHasOnce(paint, /s\.val\.textContent = String\(r\.live\);/);
  codeHasOnce(paint, /s\.gem\.style\.opacity = String\(0\.45 \+ 0\.55 \* starBrightness\(r\.live\)\);/);
  codeHasOnce(paint, /const tint = liveTint\(r\);\s*s\.node\.classList\.toggle\('boosted', tint === 'boosted'\);\s*s\.node\.classList\.toggle\('lowered', tint === 'lowered'\);/);
  codeHasOnce(paint, /s\.node\.setAttribute\('aria-label', starLabel\(r\)\);/);
  const about = w.slice(w.indexOf('    for (const [k, a] of about) {'), w.indexOf('    plus.disabled'));
  codeHasOnce(about, /a\.item\.classList\.toggle\('on', k === m\.focus\);\s*a\.line\.textContent = liveNote\(r\);\s*a\.line\.classList\.toggle\('lowered', liveTint\(r\) === 'lowered'\);/,
    'every attribute\'s line is written, the chosen one seen - so the band is the tallest\'s, whichever is chosen');
  const build = w.slice(w.indexOf("  const pickName = el('div', 'lv-pickname');"), w.indexOf('  choice.append(') + 80);
  codeHasOnce(build, /pickName\.append\(pickN, pickF, pickC\);/, 'the pick name keeps to its own three - no line widens it');
  codeHasOnce(build, /const item = el\('div', 'lv-about'\);\s*const line = el\('div', 'lv-live'\);\s*item\.append\(line, el\('p', null, ATTRIBUTE_BLURB\[k\] \?\? ''\)\);/);
  codeHasOnce(build, /choice\.append\(ask, pick, blurb\);/);
  // THE ROOM, in the sheet (comments stripped): one cell for the eight; on a phone or a short screen the line takes
  // its blurb's place; short, both are one line. The browser probe measured it: the choosing tap never moves the figure.
  const css = ENHANCED_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /\n\.lv-blurb > \.lv-about \{ grid-area: 1 \/ 1;[^}]*visibility: hidden; \}\n\.lv-blurb > \.lv-about\.on \{ visibility: visible; \}/);
  assert.match(css, /@media \(max-width: 480px\), \(max-height: 620px\) \{\s*\.lv-about:has\(> \.lv-live:not\(:empty\)\) > p \{ display: none; \}\s*\}/);
  assert.match(css, /@media \(max-height: 620px\) \{\s*\.lv-about > p \{ white-space: nowrap;[^}]*\}\s*\.lv-live \{ height: 1\.3em; max-height: none; white-space: nowrap; \}\s*\}/);
  assert.ok(css.indexOf('@media (max-height: 620px) {\n  .lv-about > p') > css.indexOf('@media (max-width: 480px) {\n  .lv-live {'), 'the short screen\'s one line holds over the phone\'s two');
  // The tallest blurb sets the band for all eight, so none may be the lone long one (Luck's ran to a third line at 360
  // to 375 wide; the probe measured the rest level there).
  const len = Object.values(ATTRIBUTE_BLURB).map((b) => b.length);
  assert.ok(ATTRIBUTE_BLURB.luck.length <= Math.max(...len.filter((_, i) => i !== Object.keys(ATTRIBUTE_BLURB).indexOf('luck'))), 'Luck no longer the outlier');
});
