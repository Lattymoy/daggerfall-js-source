// C-slice (AUDIT 23 characters-2): PACIFICATION.
// FormulaHelper.CalculateEnemyPacification (:357-391) +
// GetEnemyEntityLanguageSkill (:2808-2880) + the EnemySenses
// first-encounter hook (:504-528).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateEnemyPacification, enemyLanguageSkill } from '../src/combat/formulas.js';
import { SKILLS } from '../src/systems/skills.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const player = (skillVal, personality) => {
  const skills = new Array(35).fill(0);
  skills.fill(skillVal);
  return { isPlayer: true, level: 1, skills, stats: { personality } };
};

test('pacification: the language table - stealth classes Streetwise, the rest Etiquette; monster tongues', () => {
  // GetEnemyEntityLanguageSkill. The class split is DFU's BCHG
  // (classic used Etiquette for all); the port follows its source.
  for (const c of [7, 8, 9, 10, 11, 5]) {   // Burglar, Rogue, Acrobat, Thief, Assassin, Nightblade
    assert.equal(enemyLanguageSkill({ isClass: true, careerIndex: c }), SKILLS.Streetwise);
  }
  assert.equal(enemyLanguageSkill({ isClass: true, careerIndex: 0 }), SKILLS.Etiquette, 'a Mage hears manners');
  assert.equal(enemyLanguageSkill({ isClass: false, careerIndex: 7 }), SKILLS.Orcish, 'Orc');
  assert.equal(enemyLanguageSkill({ isClass: false, careerIndex: 24 }), SKILLS.Orcish, 'OrcWarlord');
  assert.equal(enemyLanguageSkill({ isClass: false, careerIndex: 13 }), SKILLS.Harpy);
  assert.equal(enemyLanguageSkill({ isClass: false, careerIndex: 22 }), SKILLS.Giantish, 'Gargoyle');
  assert.equal(enemyLanguageSkill({ isClass: false, careerIndex: 40 }), SKILLS.Dragonish, 'Dragonling_Alternate');
  assert.equal(enemyLanguageSkill({ isClass: false, careerIndex: 42 }), SKILLS.Nymph, 'Lamia');
  assert.equal(enemyLanguageSkill({ isClass: false, careerIndex: 31 }), SKILLS.Daedric, 'DaedraLord');
  assert.equal(enemyLanguageSkill({ isClass: false, careerIndex: 2 }), SKILLS.Spriggan);
  assert.equal(enemyLanguageSkill({ isClass: false, careerIndex: 8 }), SKILLS.Centaurian, 'Centaur');
  assert.equal(enemyLanguageSkill({ isClass: false, careerIndex: 41 }), SKILLS.Impish, 'Dreugh');
  assert.equal(enemyLanguageSkill({ isClass: false, careerIndex: 33 }), SKILLS.Etiquette, 'AncientLich');
  assert.equal(enemyLanguageSkill({ isClass: false, careerIndex: 0 }), -1, 'a Rat speaks nothing');
  assert.equal(enemyLanguageSkill({ isClass: false, careerIndex: 20 }), -1, 'a Giant Scorpion speaks nothing');
});

test('pacification: the chance arms - social skills divide, tongues count in full; the sheathed swing', () => {
  // CalculateEnemyPacification, C# INT divisions throughout.
  // Etiquette 50, personality 50, sheathed: 50/10 + 50/5 + 10 = 25.
  assert.equal(calculateEnemyPacification(player(50, 50), SKILLS.Etiquette, true, 24.9 / 200), true, 'roll 24 < 25');
  assert.equal(calculateEnemyPacification(player(50, 50), SKILLS.Etiquette, true, 25.1 / 200), false, 'roll 25 is not < 25');
  // the same numbers DRAWN: 50/10 + 50/5 - 25 = -10 - impossible
  assert.equal(calculateEnemyPacification(player(50, 50), SKILLS.Etiquette, false, 0), false, 'a drawn blade closes polite mouths');
  // a tongue at 50, personality 50, sheathed: 50 + 50/10 + 10 = 65
  assert.equal(calculateEnemyPacification(player(50, 50), SKILLS.Orcish, true, 64.9 / 200), true);
  assert.equal(calculateEnemyPacification(player(50, 50), SKILLS.Orcish, true, 65.1 / 200), false);
  // int division: skill 59 -> 59/10 = 5, personality 59 -> 59/5 = 11 (+10) = 26
  assert.equal(calculateEnemyPacification(player(59, 59), SKILLS.Streetwise, true, 25.9 / 200), true);
  assert.equal(calculateEnemyPacification(player(59, 59), SKILLS.Streetwise, true, 26.1 / 200), false);
});

test('pacification: the host runs it on the FIRST-encounter edge and a pacified foe stands down', () => {
  const src = readFileSync(join(root, 'src/scenes/dungeonContext.js'), 'utf8');
  // AUDIT 24 (wave 42): the roll moved out of this frame body into
  // hostCombat.tryLanguagePacification, because the dungeon was its
  // only caller though the motor raises justEncountered for every
  // pool. The law is asserted by RUNNING it now, not by quoting the
  // dungeon's copy of it - see the exercise below.
  const hc = readFileSync(join(root, 'src/scenes/hostCombat.js'), 'utf8');
  const i = hc.indexOf('export function tryLanguagePacification');
  assert.ok(i > 0, 'the one home exists');
  const arm = hc.slice(i);
  // AUDIT 24 (wave 42): the EDGE gate is asserted by BEHAVIOUR in
  // audit24_wave42 (no edge -> null, null ai -> null), not by its
  // spelling. Quoting `!ai?.justEncountered` here failed an
  // equivalent rewrite to `!ai || !ai.justEncountered` and called it
  // a kill, which is the opposite of what a campaign is for.
  assert.ok(arm.includes('justEncountered'), 'the edge drives the check');
  // X11 added a fifth argument (the Comprehend Languages bonus), which
  // this pin's exact-call spelling flagged at once - correctly. It is
  // relaxed to the SHAPE rather than re-frozen to the new spelling, for
  // the reason written three lines above about `justEncountered`.
  assert.ok(/calculateEnemyPacification\(playerEntity, lang, sheathed[,)]/.test(arm),
    'the sheathed state feeds the roll');
  assert.ok(arm.includes('comprehendLanguagesChance(playerEntity)')
    && /calculateEnemyPacification\([^)]*comprehend\)/.test(arm),
  'and so does the Comprehend Languages bonus (X11 - DFU reads it inside the formula, FormulaHelper.cs:377-380)');
  assert.ok(arm.includes('ai.isHostile = false'), 'success stands the foe down');
  assert.ok(arm.includes('tallySkill(playerEntity, lang, 3)'), 'success tallies 3 (DFU BCHG)');
  assert.ok(arm.includes('lang !== SKILLS.Etiquette && lang !== SKILLS.Streetwise'), 'a failed tongue still tallies 1');
  // and all three pools call it now, not one
  for (const f of ['src/scenes/dungeonContext.js', 'src/scenes/exteriorFoes.js', 'src/scenes/cityGuards.js']) {
    assert.ok(readFileSync(join(root, f), 'utf8').includes('tryLanguagePacification('), `${f} runs the roll`);
  }
  // AUDIT 24 (the re-read): the stand-down is a TARGET DROP, not an
  // action skip. EnemySenses.Update:321-327 nulls the target for a
  // non-hostile motor and :410-414 then forces targetInSight and
  // detectedTarget false - so the foe reads BLIND and every gate that
  // asks about sight refuses. EnemyAttack.FixedUpdate has no hostility
  // test of its own (:55-56 gates on DisableAI/IsParalyzed alone), so
  // the component keeps ticking and keeps burning its DFRandom byte;
  // holding it at the host desynced the one shared global stream for
  // as long as the foe stood pacified.
  // MT-iv: paralysis, or NO TARGET - EnemyAttack's own two returns
  // (:55-57 paralysed, :136-137 `senses.Target == null`). Still no
  // hostility gate, which is what this pin guards: a pacified foe
  // keeps ticking its component and burning its DFRandom byte.
  assert.ok(src.includes('f.events = (_fParalyzed || !_tgt) ? [] : f.attack.update'),
    'only paralysis and a null target skip the attack component - DFU has no hostility gate there');
  assert.equal(/_fParalyzed \|\| !f\.ai\.isHostile/.test(src), false, 'no hostility gate crept in');
  assert.equal(/_fParalyzed \|\| !f\.ai\.isHostile/.test(src), false, 'the host gate is gone');
  const motor = readFileSync(join(root, 'src/characters/enemyMotor.js'), 'utf8');
  // MT-i refined the blind arm to what :321-327 actually says: the
  // non-hostile drop nulls the PLAYER target only, so a pacified foe
  // that a bear is mauling keeps its senses and fights back (through
  // MakeEnemyHostileToAttacker). With no target - the unarmed pool's
  // pacified foe, and every pre-MT caller - it still reads blind.
  assert.ok(motor.includes('if (!this.isHostile && !foeTarget) {\n      this.inSight = false;\n      this.detected = false;'),
    'the senses read blind instead');
  assert.ok(motor.includes('const foeTarget = this._armedTargeting && this._targetCandidate && !this._targetCandidate.isPlayer;'),
    'and the one exception is a live FOE target, per :321-327');
  // the CASTING gate stays: DFU's spell paths hang off the MOTOR's
  // TakeAction, behind CanAct, which HandleNoAction:357-364 drops the
  // moment the target is null.
  assert.ok(src.includes('!_fParalyzed && !_fPaused && f.ai.isHostile) {'), 'no casts while pacified');
  // AUDIT 26 F041: the flip asks WHOSE blow it was - it sits inside
  // HandleAttackFromSource's player-source gate, so a fall no longer
  // un-pacifies a language-pacified foe.
  // ...and MT-iv runs the WHOLE method inside that gate, with the
  // narrow raise kept as the no-subsystem fallback.
  assert.ok(src.includes('if (fromPlayer && foe.ai) {'), 'a PLAYER attack re-hostiles (MakeEnemyHostileToAttacker)');
  assert.ok(src.includes('foeDeps.resetAllyTeamOnPlayerAttack(foe.ai, foe.entity, foe.mobileType);'), 'and reverts a struck ally');
});

test('pacification: the motor edge fires once and non-hostile foes stop moving', async () => {
  const { EnemyAI } = await import('../src/characters/enemyMotor.js');
  const { Collider } = await import('../src/player/collider.js');
  const collider = new Collider(() => -100);
  collider.addMesh('floor', new Float32Array([-40, 0, -40, 40, 0, -40, 40, 0, 40, -40, 0, 40]),
    new Uint16Array([0, 1, 2, 0, 2, 3]), new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]));
  const ai = new EnemyAI(collider, [0, 0, 0], 0, { liveSpeed: 50 });
  assert.equal(ai.isHostile, true, 'hostile by default');
  ai.update(1 / 4, [0, 0, 3]);   // in sight, close
  assert.equal(ai.justEncountered, true, 'the first detection raises the edge');
  ai.justEncountered = false;
  ai.update(1 / 4, [0, 0, 3]);
  assert.equal(ai.justEncountered, false, 'the edge fires ONCE (hasEncounteredPlayer holds)');
  ai.isHostile = false;
  const before = [...ai.feet];
  const yaw0 = ai.yaw;
  for (let i = 0; i < 8; i++) ai.update(1 / 4, [6, 0, 2]);   // off-axis: a hostile tick would TURN to it
  assert.equal(ai.moving, false, 'a pacified foe does not pursue');
  assert.deepEqual(ai.feet, before, '...its feet stay planted');
  assert.equal(ai.yaw, yaw0, '...and it does not even TURN - the decision tick itself is gated (DFU TakeAction)');
});
