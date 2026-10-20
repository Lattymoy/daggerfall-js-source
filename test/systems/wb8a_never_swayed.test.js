// WB8a (2026-09-28, Mac: "Make the oblivion gate boss not be able to be pacified") - THE WARDEN IS NEVER SWAYED.
//
// No path reached him before this, but only by accident: he is in no foe pool, so the language roll (DFU's
// EnemySenses pacification, X11's seam for all three pools) never met him; his spell door took harmful families and a
// Soul Trap alone; and the relay keeps no hostility. Yet his stand-in is a Daedra Lord's entity (mobile 31, the Daedra
// group), which a Pacify Daedra MATCHES the moment anything routes a spell to it. Now it is his own word
// (`pacifyImmune`, world/gate/gateBoss.js bossStandIn) and every door that could sway anything refuses a target that says it:
// the language seam, the Pacify/Charm arm, the flag's door - and his own door answers a sway aimed at him in words.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { bossStandIn, bossLookOf, BOSS_SWAY_TEXT, BOSS_SWAY_TELL_MS } from '../../src/world/gate/gateBoss.js';
import { applySpell, spellSways } from '../../src/systems/effects.js';
import { buildCustomSpell, blankEffectSettings } from '../../src/systems/spell/spellMaker.js';
import { tryLanguagePacification } from '../../src/scenes/hostCombat.js';
import { enemyGroupOf, NEARBY } from '../../src/systems/nearbyObjects.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
/** DFU's roll stream for the arm: the OnCast chance first, then the target's save held high so it fails (test/systems/pacify.test.js). */
const seqRolls = () => { let i = 0; return () => (i++ === 0 ? 0 : 0.99); };
const cast = (target, type, subType) => applySpell(
  buildCustomSpell({ slots: [{ type, subType, settings: { ...blankEffectSettings(), chanceBase: 100, chanceMod: 0 } }], rangeType: 1 }),
  1, target, {}, seqRolls(), null, {});
const warden = () => bossStandIn(bossLookOf('ruhn'), 'Valkynaz Ruhn');

test('WB8a: his stand-in says it - pacifyImmune on the Daedra Lord\'s entity a Pacify Daedra would otherwise match; his refusal in words, said at most every four seconds', () => {
  const e = warden();
  assert.equal(e.pacifyImmune, true);
  assert.equal(e.mobileType, 31);
  assert.equal(enemyGroupOf(e.mobileType), NEARBY.Daedra, 'the group Pacify Daedra matches - the trap this closes');
  assert.equal(BOSS_SWAY_TEXT('Valkynaz Ruhn'), 'Valkynaz Ruhn cannot be swayed.');
  assert.equal(BOSS_SWAY_TEXT(''), 'The Warden cannot be swayed.');
  assert.equal(BOSS_SWAY_TELL_MS, 4000);
});

test('WB8a: the Pacify/Charm arm refuses a target that cannot be swayed - no chance, no save, no flag - where the same Daedra Lord without the word is pacified', () => {
  const control = { ...warden() };
  delete control.pacifyImmune;
  assert.equal(cast(control, 33, 3).pacify, true, 'control: Pacify Daedra sways a Daedra Lord');
  const r = cast(warden(), 33, 3);
  assert.equal(r.pacify, undefined, 'the Warden is not swayed');
  assert.equal(r.swayRefused, 1, 'refused, and counted');
  assert.equal(r.chanceFailed, undefined, 'no roll was spent on him');
  const classFoe = { stats: { luck: 50, willpower: 50 }, skills: [], activeEffects: [], level: 1, health: 20, maxHealth: 20, mobileType: 130 };
  assert.equal(cast(classFoe, 34, 255).pacify, true, 'control: Charm sways a class foe');
  assert.equal(cast({ ...classFoe, pacifyImmune: true }, 34, 255).pacify, undefined, 'and not one that cannot be swayed');
  assert.equal(spellSways(buildCustomSpell({ slots: [{ type: 33, subType: 3, settings: blankEffectSettings() }], rangeType: 1 })), true);
  assert.equal(spellSways(buildCustomSpell({ slots: [{ type: 34, subType: 255, settings: blankEffectSettings() }], rangeType: 1 })), true);
  assert.equal(spellSways(buildCustomSpell({ slots: [{ type: 12, subType: 255, settings: blankEffectSettings() }], rangeType: 1 })), false, 'a Soul Trap sways nothing');
  assert.equal(spellSways(null), false);
});

test('WB8a: the language seam never rolls on him - no tongue asked, no line, no skill tallied; the edge still consumed; a Daedra Lord without the word is rolled as ever', () => {
  const said = [];
  const asked = [];
  const opts = {
    enemyLanguageSkill: (en) => { asked.push(en); return 34; },   // Daedric
    calculateEnemyPacification: () => true,
    say: (l) => said.push(l),
  };
  const player = { stats: { personality: 90 }, skills: { 34: 100 }, activeEffects: [] };
  const ai = { justEncountered: true, isHostile: true };
  assert.equal(tryLanguagePacification(ai, warden(), 31, player, opts), null);
  assert.equal(ai.isHostile, true); assert.equal(ai.justEncountered, false, 'the edge is consumed whatever happens');
  assert.deepEqual(said, []); assert.deepEqual(asked, [], 'his tongue is never asked');
  const control = { ...warden() };
  delete control.pacifyImmune;
  const ai2 = { justEncountered: true, isHostile: true };
  assert.equal(tryLanguagePacification(ai2, control, 31, player, opts)?.pacified, true, 'control: the roll runs and sways');
  assert.equal(ai2.isHostile, false);
});

test('WB8a: the doors, by source - the flag\'s door skips him; a sway stops at him (his marks and the missile\'s) and is refused in his words, the rest of the spell landing as it would', () => {
  const hm = read('src/scenes/hostMagic.js');
  assert.match(hm, /if \(r\.pacify && foe\.ai && !foe\.entity\?\.pacifyImmune\) foe\.ai\.isHostile = false;/);
  assert.match(hm, /function bossMarksFor\(sp\) \{\n\s*if \(!bossMark \|\| !castAtBoss \|\| !sp \|\| !\(duelSpellOf\(sp\) \|\| \(sp\.effects \?\? \[\]\)\.some\(\(e\) => e && isSoulTrapEffect\(e\)\) \|\| spellSways\(sp\)\)\) return \[\];/);
  assert.match(hm, /boss: !!duelSpellOf\(sp\) \|\| \(sp\.effects \?\? \[\]\)\.some\(\(e\) => e && isSoulTrapEffect\(e\)\) \|\| spellSways\(sp\) \}\);/);
  // PIN MOVED (FIELD BUGS 2026-10-19f STAND-IN-WHOLE, HOST-SPLIT): his spell door left the dungeon context for
  // scenes/gate/standInSpell.js, which the context wires with its mid-screen line
  assert.match(read('src/scenes/dungeonContext.js'), /createStandInSpell\(\{\n\s*player: playerEntity, say: \(line\) => hudText\.add\(line\),/);
  const dc = read('src/scenes/gate/standInSpell.js');
  assert.match(dc, /const sways = spellSways\(sp\) && !!boss\.entity\.pacifyImmune;\n\s*if \(sways && now\(\) - swayToldAt >= BOSS_SWAY_TELL_MS\) \{ swayToldAt = now\(\); say\(BOSS_SWAY_TEXT\(boss\.entity\.name\)\); \}/);
  assert.match(dc, /if \(!harm\) return laid \|\| sways;/, 'a sway alone met him - the missile is spent there');
  assert.match(read('src/scenes/hostCombat.js'), /if \(isQuestFoe\) return null;\n\s*if \(entity\?\.pacifyImmune\) return null;/);
});
