// AUDIT 24, wave 42: two things the exterior hosts got wrong about a
// fight - one they never did, and one they did twice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tryLanguagePacification, SWING_WEAPON_FATIGUE_LOSS } from '../src/scenes/hostCombat.js';
import { enemyLanguageSkill, calculateEnemyPacification } from '../src/combat/formulas.js';
import { SKILLS, SKILL_NAMES, skillValue } from '../src/systems/skills.js';
import { KNIGHT_CITY_WATCH, MOBILE_TYPES } from '../src/characters/mobileTypes.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

/** Does `fn(` appear as a STATEMENT in this source - a line that
 *  starts with the call - rather than merely appearing somewhere?
 *  A bare `src.includes('fn(')` is satisfied by `if (false) fn(...)`
 *  and by a commented-out call, which is how three mutants walked
 *  through the first campaign. */
function callsAsStatement(src, fn) {
  return src.split('\n').some((l) => l.trim().startsWith(`${fn}(`));
}

const ORC = MOBILE_TYPES.Orc;   // speaks Orcish - a MONSTER tongue

// Mutation campaign: 18 reintroductions, 18 killed. The edge not
// consumed on a failure; a quest foe pacified; a tongue-less foe still
// rolling; success tallying classic 1 instead of DFU's 3, or
// forgetting to stand the foe down; a failed Etiquette tallying, or a
// failed monster tongue not; the roll ignoring the drawn weapon; the
// line losing the enemy's name; each of the three pools' calls
// disabled; the sheathed state snapshotted instead of read live; the
// watch pool charging the swing fatigue a second time; the encounter
// pool starting to; a host charging twice; and a host not at all.
// THREE of those - the three "pool stops rolling" mutants - SURVIVED
// the first campaign, all for one reason: the pin was
// `assert.match(src, /tryLanguagePacification\(/)`, and
// `if (false) tryLanguagePacification(...)` still matches it. A
// commented-out call would have matched too. `callsAsStatement` reads
// the line, not the file. The same hole was open in wave 41's pool
// gate and is closed there now as well.
// One EQUIVALENT mutant, and it is worth the space. Rewriting
// `!ai?.justEncountered` as `!ai || !ai.justEncountered` is the same
// program - and the first campaign KILLED it, because
// pacification.test.js quoted the spelling. That is a false kill: a
// campaign that rewards a pin for noticing a rename has stopped
// measuring anything. The spelling assertion is gone and the edge is
// pinned by behaviour, so the mutant survives now, correctly.

const player = (skill = 80, personality = 80) => ({
  isPlayer: true, level: 1, skills: new Array(35).fill(skill), skillUses: new Array(35).fill(0),
  stats: { personality }, fatigue: 1000,
});
const ai = () => ({ justEncountered: true, isHostile: true });
// The roll seam is injected, so these pins are deterministic: DFU's
// own Random.Range(0, 200) < chance sits inside
// calculateEnemyPacification and the pools hand it in as a dep.
const deps = (roll = 0, extra = {}) => ({
  enemyLanguageSkill,
  calculateEnemyPacification: (pl, lang, sheathed) => calculateEnemyPacification(pl, lang, sheathed, roll),
  ...extra,
});

test('audit24 wave42: pacification stands a foe down, tallies 3, and consumes the EDGE', () => {
  const said = [];
  const p = player();
  const a = ai();
  const before = skillValue(p, SKILLS.Orcish);
  const r = tryLanguagePacification(a, { isClass: false, careerIndex: 7 }, ORC, p,
    { ...deps(0), sheathed: true, say: (l) => said.push(l) });
  assert.ok(r?.pacified, 'a fluent, charming, sheathed player at skill 80 talks an orc down');
  assert.equal(r.lang, SKILLS.Orcish);
  assert.equal(a.isHostile, false, 'IsHostile = false');
  assert.equal(a.justEncountered, false, 'the edge is spent');
  assert.equal(p.skillUses[SKILLS.Orcish], 3, 'DFU BCHG: three uses on a success, not classic one');
  assert.equal(before, skillValue(p, SKILLS.Orcish), 'the tally is uses, not the value');
  assert.deepEqual(said, [`Orc is pacified by your ${SKILL_NAMES[SKILLS.Orcish]} skill.`]);

  // the edge fires ONCE - a second call on the same encounter is a no-op
  assert.equal(tryLanguagePacification(a, { isClass: false, careerIndex: 7 }, ORC, p, deps(0)), null);
  assert.equal(p.skillUses[SKILLS.Orcish], 3, 'and tallied nothing more');
});

test('audit24 wave42: a FAILED roll tallies 1 - except for the two social tongues', () => {
  // :525-526 - `else if (languageSkill != Etiquette && != Streetwise)
  // player.TallySkill(languageSkill, 1);`
  const hopeless = () => ({ ...player(0, 0), skills: new Array(35).fill(0) });

  const p1 = hopeless(); const a1 = ai();
  const r1 = tryLanguagePacification(a1, { isClass: false, careerIndex: 7 }, ORC, p1, { ...deps(0.999), sheathed: false });
  assert.equal(r1.pacified, false);
  assert.equal(a1.isHostile, true, 'still hostile');
  assert.equal(a1.justEncountered, false, 'but the edge is spent all the same');
  assert.equal(p1.skillUses[SKILLS.Orcish], 1, 'using a monster tongue counts even when it fails');

  // a class enemy speaks Etiquette (or Streetwise for the six stealth
  // careers) and gets NOTHING for being ignored
  const p2 = hopeless(); const a2 = ai();
  const r2 = tryLanguagePacification(a2, { isClass: true, careerIndex: 17 }, KNIGHT_CITY_WATCH, p2, { ...deps(0.999), sheathed: false });
  assert.equal(r2.lang, SKILLS.Etiquette);
  assert.equal(r2.pacified, false);
  assert.equal(p2.skillUses[SKILLS.Etiquette], 0, 'Etiquette gets nothing for failing');
  const p3 = hopeless(); const a3 = ai();
  tryLanguagePacification(a3, { isClass: true, careerIndex: 11 }, 139, p3, { ...deps(0.999), sheathed: false });
  assert.equal(p3.skillUses[SKILLS.Streetwise], 0, 'nor does Streetwise');
});

test('audit24 wave42: the guards DFU puts on it - no tongue, and no quest foes', () => {
  // Skills.None is -1: most monsters have no language at all, and the
  // roll must not run for them.
  const p = player(); const a = ai();
  assert.equal(enemyLanguageSkill({ isClass: false, careerIndex: 0 }), -1, 'a Rat speaks nothing');
  assert.equal(tryLanguagePacification(a, { isClass: false, careerIndex: 0 }, 0, p, deps(0)), null);
  assert.equal(a.isHostile, true);
  assert.equal(a.justEncountered, false, 'the edge is still consumed - DFU sets hasEncounteredPlayer first');
  assert.equal(p.skillUses.reduce((x, y) => x + y, 0), 0, 'and nothing was tallied');

  // :509 - `if (!questBehaviour && ...)`: a quest foe is never talked down
  const p2 = player(); const a2 = ai();
  assert.equal(tryLanguagePacification(a2, { isClass: false, careerIndex: 7 }, ORC, p2,
    { ...deps(0), sheathed: true, isQuestFoe: true }), null);
  assert.equal(a2.isHostile, true, 'the quest orc still wants you');
  assert.equal(a2.justEncountered, false);

  // no edge at all: nothing happens and nothing is read
  assert.equal(tryLanguagePacification({ justEncountered: false }, {}, ORC, p, deps(0)), null);
  assert.equal(tryLanguagePacification(null, {}, ORC, p, deps(0)), null);
});

test('audit24 wave42: the drawn weapon matters, and every pool asks the host for it', () => {
  // CalculateEnemyPacification: a sheathed weapon adds 10, a drawn one
  // costs 25 - a 35-point swing, which decides most rolls.
  let sheathedWins = 0, drawnWins = 0;
  for (let i = 0; i < 200; i++) {
    const roll = i / 200;
    if (calculateEnemyPacification(player(40, 40), SKILLS.Orcish, true, roll)) sheathedWins++;
    if (calculateEnemyPacification(player(40, 40), SKILLS.Orcish, false, roll)) drawnWins++;
  }
  assert.ok(sheathedWins > drawnWins, `sheathed ${sheathedWins} beats drawn ${drawnWins}`);

  // ALL THREE pools actually run the roll - as a statement, not as
  // something that merely appears in the file.
  for (const f of ['src/scenes/dungeonContext.js', 'src/scenes/exteriorFoes.js', 'src/scenes/cityGuards.js']) {
    assert.ok(callsAsStatement(rd(f), 'tryLanguagePacification'), `${f}: the roll is REACHED`);
  }

  // the pools take it as a dep and the hosts feed the real rig
  for (const f of ['src/scenes/exteriorFoes.js', 'src/scenes/cityGuards.js']) {
    assert.match(rd(f), /playerWeaponSheathed = \(\) => false/, `${f}: takes the state`);
    assert.match(rd(f), /sheathed: playerWeaponSheathed\(\)/, `${f}: and feeds it to the roll`);
  }
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(rd(f), /playerWeaponSheathed: \(\) => !!weaponRig\.playerWeapon\.sheathed/, `${f}: from the rig`);
  }
  // read LIVE, not captured: drawing your sword mid-approach has to
  // change the next foe's roll
  assert.doesNotMatch(rd('src/scenes/world.js'), /playerWeaponSheathed: !!weaponRig/, 'a thunk, not a snapshot');
});

test('audit24 wave42: a swing costs eleven fatigue, ONCE, whatever is standing near you', () => {
  // WeaponManager.cs:420 - `playerEntity.DecreaseFatigue(swingWeaponFatigueLoss)`
  // sits in the single isDamageFinished block. It is a property of
  // SWINGING, not of what you swung at.
  assert.equal(SWING_WEAPON_FATIGUE_LOSS, 11);

  // The watch pool used to drain it a SECOND time inside
  // resolvePlayerHit, on top of the host's melee arm - and its early
  // `if (!live.length) return false` meant the extra charge landed
  // only while a guard was alive. 22 near the watch, 11 everywhere.
  const cg = rd('src/scenes/cityGuards.js');
  assert.doesNotMatch(cg, /SWING_WEAPON_FATIGUE_LOSS/, 'the watch pool no longer touches the swing fatigue');
  assert.match(cg, /AUDIT 24 \(wave 42\): the FATIGUE drain that used to sit here was/, 'and says why');

  // the other two pools never did, and must not start
  assert.doesNotMatch(rd('src/scenes/exteriorFoes.js'), /SWING_WEAPON_FATIGUE_LOSS/);
  // the HOSTS own it - exactly one melee charge each
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const src = rd(f);
    const charges = src.split('\n').filter((l) => /drain\w*Fatigue\(SWING_WEAPON_FATIGUE_LOSS\)/.test(l));
    assert.equal(charges.length, 2, `${f}: one bow arm, one melee arm, and no more`);
  }
  // the dungeon is the shape this was corrected TO: the frame body
  // charges, resolvePlayerHit does not
  const dc = rd('src/scenes/dungeonContext.js');
  const rp = dc.slice(dc.indexOf('function resolvePlayerHit('), dc.indexOf('function resolvePlayerHit(') + 4000);
  assert.doesNotMatch(rp, /SWING_WEAPON_FATIGUE_LOSS/, 'the dungeon never charged it inside the resolver');
});
