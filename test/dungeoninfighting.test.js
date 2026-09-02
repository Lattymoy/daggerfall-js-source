// MT-iv - THE DUNGEON HOST ARMED. MT-i/ii left this pool on the
// player-only path (unchanged behaviour, recorded as the remainder);
// this slice gives it the shared candidate list, the two-arm melee
// and bow splits, the target==player alert gates, and the quest-foe
// reach that ChangeFoeTeam needs underground.
//
// The host is a 5,000-line scene closure with a lazily-loaded foe
// subsystem, so these are SOURCE pins over its wiring plus behaviour
// pins on the shared parts they route through. The behaviour of the
// target machine itself is pinned in enemytargets.test.js against
// real EnemyAI instances; what is provable HERE is that the dungeon
// asks the same questions in the same order.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DG = rd('src/scenes/dungeonContext.js');

test('MT-iv: the target machine rides the LAZY foe subsystem, not a static import', () => {
  // exteriorFoes imports enemyTargets statically; this host must not.
  // The whole foe subsystem sits behind `opts.foes && palette` so a
  // foe-less dungeon never pays for enemyMotor - and enemyTargets
  // imports enemyMotor, so a static import here defeats that gate.
  assert.ok(DG.includes("import('../characters/enemyTargets.js')"), 'the import is DYNAMIC');
  assert.ok(!/^import .*enemyTargets/m.test(DG), 'and never static');
  assert.match(DG, /runTargetMachine, isPlayerTarget, PLAYER_TARGET, resetAllyTeamOnPlayerAttack,/,
    'all four members are published on foeDeps for the consumers below the block');
  // every consumer guards on foeDeps, because the subsystem can fail
  // to load and the host must degrade rather than throw
  for (const guard of ['foeDeps.isPlayerTarget', 'foeDeps.runTargetMachine', 'foeDeps.resetAllyTeamOnPlayerAttack']) {
    const i = DG.indexOf(guard);
    assert.ok(i > 0, `${guard} is consumed`);
  }
  assert.ok(DG.includes('candidates: foeDeps ? () => foes.filter((f) => !f.dead && f.ai) : null'),
    'and the candidate getter itself idles without the subsystem');
});

test('MT-iv: the candidate list is this host\'s whole active-enemy database, filtered live', () => {
  // EnemySenses.cs:741-749. Unlike world.js there is nothing to join -
  // the dungeon has no guard or encounter pool - but corpses and
  // culled records must leave the database the frame they die.
  assert.match(DG, /candidates: foeDeps \? \(\) => foes\.filter\(\(f\) => !f\.dead && f\.ai\) : null/);
  // the activity bag is PERSISTENT: spread, never mutate
  assert.match(DG, /sensesContext\(playerEntity, classicMinutesRef\.value, \{\n\s*\.\.\._activity,/,
    'the shared builder, with the bag spread rather than written through');
  // the record IS the candidate, and the two quest halves are LIVE
  // getters (bindQuestFoeHost runs after the record is stood, and
  // ChangeFoeInfighting flips the flag mid-quest)
  assert.match(DG, /isQuestFoe: \{ get: \(\) => !!rec\.questBehaviour, enumerable: false \}/);
  assert.match(DG, /questAttackable: \{ get: \(\) => !!rec\.questBehaviour\?\.isAttackableByAI, enumerable: false \}/);
  assert.equal((DG.match(/asCandidate\(\{ mobile,/g) ?? []).length, 2,
    'BOTH record mints - the class branch and the monster branch - are decorated');
});

test('MT-iv: a DESTROYED foe is swept out of every other foe\'s target slots', () => {
  // Destroy(gameObject) marks dead with health still ABOVE zero, so
  // the machine's health-based cull can never drop it and every foe
  // holding it would chase an object that no longer draws.
  assert.match(DG, /function dropCandidate\(f\) \{/);
  for (const slot of ['o.ai.target === f', 'o.ai.secondaryTarget === f', 'o.ai.targetSenses === f']) {
    assert.ok(DG.includes(slot), `dropCandidate clears ${slot.split(' ')[0].slice(5)}`);
  }
  const rm = DG.indexOf('removeFoe: (f) => {');
  assert.ok(rm > 0 && DG.slice(rm, rm + 400).includes('dropCandidate(f);'),
    'and the one removal door calls it');
});

test('MT-iv: MeleeDamage\'s two-arm split lives in ONE home, above both call sites', () => {
  // EnemyAttack.cs:199-209. This host resolves melee from two places
  // (the rig path and the sprite marker path), so the fork sits
  // inside the resolver rather than being copied to each.
  const fork = DG.indexOf('function resolveFoeMeleeVsFoe(f) {');
  const player = DG.indexOf('function resolveFoeMelee(f, playerFeet) {');
  assert.ok(fork > 0 && player > fork, 'the foe arm is declared above the player arm');
  assert.match(DG, /if \(resolveFoeMeleeVsFoe\(f\)\) return;/, 'and the player arm is the ELSE');
  assert.match(DG, /applyDamageToNonPlayer\(f, t, \{/, 'the foe arm routes through the SHARED payload');
  assert.match(DG, /dealDamage: \(tt, d\) => tt\.hurtFromFoe\?\.\(d, fwd\)/,
    'and the TARGET\'s own pool owns its death chain');
  // both call sites reach it, and neither gates on the player's feet
  assert.ok(DG.includes('if (!f.mobile) resolveFoeMelee(f, _pf);'), 'the rig path');
  assert.ok(DG.includes('if (_tgt && !_fParalyzed && f.mobile.doMeleeDamage)'), 'the sprite marker path, gated on a live TARGET');
});

test('MT-iv: BowDamage forks too - an arrow aimed at a foe LANDS on it, and the shaft is recoverable there', () => {
  // The aim and the impact had to land together: aiming an enemy
  // arrow at another foe while the impact test still knew only the
  // player would have made it fly through and hit nothing, which is
  // worse than never aiming there.
  assert.match(DG, /m\.aimFoe = \(foeDeps && ct && !foeDeps\.isPlayerTarget\(ct\)\) \? ct : null;/,
    'the missile REMEMBERS its victim at fire time');
  assert.match(DG, /\} else if \(m\.aimFoe && !m\.aimFoe\.dead\) \{/, 'and the impact forks on it');
  assert.match(DG, /bowAttack: true/, 'through ApplyDamageToNonPlayer with the bow flag (:143)');
  assert.match(DG, /addItem\(af\.entity\.items \?\?= \[\], \{ group: 'Weapons', name: 'Arrow'/,
    ':145-147 - the recovered Arrow goes into the TARGET\'s items, not the player\'s');
  // the enemy SPELL missile takes the same fork
  assert.match(DG, /an enemy SPELL missile aimed at another foe resolves/);
  assert.match(DG, /applySpell\(m\.spell, m\.casterLevel \?\? playerEntity\.level, af\.entity, foeSinks\(af\)/,
    'and lands on that foe\'s own sinks');
});

test('MT-iv: both alert gates carry EnemySenses\' target==player term', () => {
  // :531-535 raise, EnemyDeath:131-136 clear. Unobservable while
  // every foe targeted the player; armed, two foes brawling must not
  // hold the player's alert state up or clear it by dying.
  assert.match(DG, /foeDeps\.isPlayerTarget\(f\.ai\.target\)\)\n\s*&& f\.ai\.inSight && f\.ai\.detected && !f\.dead\) setEnemyAlert\(playerEntity, true/);
  assert.match(DG, /foeDeps\.isPlayerTarget\(foe\.ai\?\.target\)\) && foe\.ai\?\.detected\) setEnemyAlert\(playerEntity, false\)/);
  // and both degrade to the old behaviour with no subsystem
  assert.ok(DG.includes('(!foeDeps || !f.ai._armedTargeting || foeDeps.isPlayerTarget(f.ai.target))'),
    'the raise idles its new term when the subsystem never loaded');
});

test('MT-iv: the attack component and the caster aim at the SELECTED target', () => {
  assert.ok(DG.includes('f.events = (_fParalyzed || !_tgt) ? [] : f.attack.update(dt, f.ai, _tgt, _fPaused);'),
    'EnemyAttack reads senses.Target (:199-209), and holds when there is none (:136-137)');
  assert.ok(DG.includes('const dec = f.caster.update(dt, f.ai, f.attack, _tgt, _castEnt);'),
    'so does the casting decision');
  assert.match(DG, /\? playerEntity : \(f\.ai\.target\?\.entity \?\? playerEntity\);/,
    'and it reads the TARGET\'s own entity, so a foe duelling a foe does not pick its school off the player');
});

test('MT-iv: ChangeFoeTeam finally reaches a quest foe standing in a DUNGEON', () => {
  // ChangeFoeInfighting.cs:59 / ChangeFoeTeam.cs:77 walk ONE global
  // ActiveGameObjectDatabase. The port's door walked the two exterior
  // pools only, so an underground quest foe was never found - and
  // since SetComplete sits inside the instance loop, the action
  // re-ran every machine tick for ever instead of completing.
  const w = rd('src/scenes/world.js');
  assert.match(w, /\[\.\.\.exteriorFoes\.foes, \.\.\.cityGuards\.guards, \.\.\.\(modes\?\.liveQuestFoes\?\.\(\) \?\? \[\]\)\]/,
    'the walk unions the inside pool');
  const wm = rd('src/scenes/worldModes.js');
  assert.match(wm, /liveQuestFoes\(\) \{/, 'worldModes exposes it');
  assert.match(wm, /return dungeonCtx\.foes\.filter\(\(f\) => !f\.dead && f\.questBehaviour\);/,
    'as the live quest-spawned records');
  assert.match(wm, /if \(mode !== 'dungeon' \|\| !dungeonCtx\) return \[\];/,
    'and the INTERIOR arm stays empty - that host has no enemy pool');
});

test("P0b (Mac 2026-08-28): the dungeon's CAST arm guards on the SELECTED target, not the player", () => {
  // The live crash: `playerFeet[0], n is null` inside
  // EnemyCaster.update. _targetFeet answers NULL exactly when the
  // target machine is ARMED and holds no target (its duel opponent
  // died this frame) - and the cast arm guarded on `playerFeet`, a
  // DIFFERENT variable that is non-null whenever the player stands in
  // the block, then passed _tgt in. The attack arm one screen up and
  // the exterior host both guarded on _tgt all along; this pin closes
  // the one arm that did not, in the shape audit24_wave32 already
  // pins for the exterior.
  assert.match(DG, /const _tgt = _targetFeet\(f\);/, 'the selected-target feet exist');
  assert.match(DG, /return rec\.ai\._armedTargeting \? null : _pf;/,
    'armed-with-no-target really answers null - the state the guard is for');
  assert.ok(DG.includes('if (_tgt && f.caster && !_fParalyzed && !_fPaused && f.ai.isHostile) {'),
    'the cast arm gates on _tgt');
  assert.ok(!DG.includes('if (playerFeet && f.caster && !_fParalyzed && f.ai.isHostile) {'),
    'and the playerFeet guard that let the null through is gone');
  assert.ok(DG.includes('(_fParalyzed || !_tgt) ? [] : f.attack.update(dt, f.ai, _tgt, _fPaused);'),
    'beside the attack arm that always guarded correctly');
});
