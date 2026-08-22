// C2-slice (AUDIT 23 combat-9/10/11/12/17): the combat audio arms,
// the arrow Dodging tally, the player-side poison hook, the two
// roll-order laws, and the combat voices.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  combatVoicesEnabled, ATTACK_VOICE_CHANCE, PAIN_VOICE_CHANCE,
  rollVoiceRace, raceGenderAttackSound, raceGenderPainSound, combatVoice, isHeavyDamage,
} from '../src/combat/combatVoices.js';
import { enemyAttackVoice, enemyPainVoice, playerAttackGrunt, enemyMissSound, KNIGHT_CITY_WATCH } from '../src/scenes/hostCombat.js';
import { backstabDamage, SUCCESSFUL_BACKSTAB_TEXT } from '../src/combat/formulas.js';
import { RACES } from '../src/systems/races.js';
import { SOUND } from '../src/systems/soundClips.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(root, f), 'utf8');
const seq = (...vals) => { let i = 0; return () => vals[Math.min(i++, vals.length - 1)]; };

test('c2combat combat-17: the voice tables - race roll, clip picks, the HighElf swap, heavy damage', () => {
  // SETT: no longer a constant - a point-of-use read of the store,
  // which with no override reports DFU's shipped CombatVoices=True
  assert.equal(combatVoicesEnabled(), true, 'the setting ships enabled');
  assert.equal(ATTACK_VOICE_CHANCE, 20);
  assert.equal(PAIN_VOICE_CHANCE, 40);
  // the spawn roll lands Breton..HighElf only
  assert.equal(rollVoiceRace(() => 0), RACES.Breton);
  assert.equal(rollVoiceRace(() => 0.999), RACES.HighElf);
  // male voices: attack = the race's first pain clip, pain = +1
  assert.equal(raceGenderAttackSound(RACES.Breton, 'male'), 390);
  assert.equal(raceGenderPainSound(RACES.Breton, 'male', false), 391);
  assert.equal(raceGenderAttackSound(RACES.Argonian, 'male'), 411);
  // the male HighElf voice SWAPS to WoodElf inside combatVoice
  const v = combatVoice({ race: RACES.HighElf, gender: 'male', isAttack: true, rolls: () => 0 });
  assert.equal(v.clip, 405, 'HighElf male speaks WoodElf (the source comment law)');
  assert.ok(v.pitchLift >= 0 && v.pitchLift < 0.3);
  // female voices share clips: humans roll 43/44/53 on attack...
  assert.equal(raceGenderAttackSound(RACES.Nord, 'female', () => 0), 43);
  assert.equal(raceGenderAttackSound(RACES.Nord, 'female', () => 0.999), 53);
  // ...and pain forks on heavyDamage: 50 heavy, 46/52 light
  assert.equal(raceGenderPainSound(RACES.Redguard, 'female', true), 50);
  assert.equal(raceGenderPainSound(RACES.Redguard, 'female', false, () => 0), 46);
  assert.equal(raceGenderPainSound(RACES.Redguard, 'female', false, () => 0.9), 52);
  // heavyDamage = damage >= trunc(maxHealth / 4)
  assert.equal(isHeavyDamage(5, 20), true);
  assert.equal(isHeavyDamage(4, 20), false);
});

test('c2combat combat-17: the host gates - class-only, the rolls, the cached voice race, the bow-less grunt', () => {
  const classFoe = { gender: 'female', mobileType: 130, entity: { isClass: true, maxHealth: 40 } };
  // a MONSTER never voices, whatever the roll
  assert.equal(enemyAttackVoice({ entity: { isClass: false } }, () => 0), null);
  assert.equal(enemyPainVoice({ entity: { isClass: false } }, 10, () => 0), null);
  // the 20% attack gate: roll 0.2+ refuses (Dice100 floor)
  assert.equal(enemyAttackVoice({ ...classFoe }, seq(0.2)), null);
  // a passing roll returns a female clip and CACHES the voice race
  const f = { ...classFoe };
  const a1 = enemyAttackVoice(f, seq(0.1, 0.0, 0.0, 0.0));
  assert.ok(a1 && a1.clip >= 0);
  const race1 = f.voiceRace;
  assert.ok(race1 >= 1 && race1 <= 5, 'the spawn-roll band');
  enemyAttackVoice(f, seq(0.1, 0.999, 0.0, 0.0));
  assert.equal(f.voiceRace, race1, 'one voice race per foe - rolled once');
  // pain: zero damage never voices; the 40% gate reads its own roll
  assert.equal(enemyPainVoice(f, 0, seq(0.1)), null);
  const p = enemyPainVoice(f, 10, seq(0.3, 0.0, 0.0));
  assert.ok(p && p.clip >= 0, '0.3 passes the 40% gate');
  // the CityWatch knight is FORCED male
  const knight = { gender: 'female', mobileType: KNIGHT_CITY_WATCH, entity: { isClass: true, maxHealth: 40 } };
  const kv = enemyAttackVoice(knight, seq(0.1, 0.0, 0.0, 0.0));
  assert.ok(kv.clip >= 390, 'a male clip (the 390 block), not the female 43..62 block');
  // the player grunt: never for a bow; 20% otherwise; the player race key resolves
  assert.equal(playerAttackGrunt({ race: 'Breton', gender: 'male' }, true, () => 0), null);
  const g = playerAttackGrunt({ race: 'Khajiit', gender: 'male' }, false, seq(0.1, 0.0));
  assert.equal(g.clip, 408, 'the player grunt reads the PLAYER race (Khajiit male)');
});

test('c2combat combat-12: the backstab roll draws ONLY behind the >1 gate; a landed backstab speaks', () => {
  // level <= 1: the rolls function must never be consulted
  const bomb = () => { throw new Error('drawn'); };
  assert.equal(backstabDamage(10, 0, bomb), 10);
  assert.equal(backstabDamage(10, 1, bomb), 10);
  // level > 1: the roll draws; a success triples and SAYS so
  const said = [];
  assert.equal(backstabDamage(10, 50, () => 0.4, (l) => said.push(l)), 30);
  assert.deepEqual(said, [SUCCESSFUL_BACKSTAB_TEXT]);
  assert.equal(backstabDamage(10, 50, () => 0.6), 10);
});

test('c2combat combat-12: the enemy melee DFRandom byte draws on every idle classic tick', () => {
  const s = src('src/characters/enemyAttack.js');
  const tick = s.indexOf('this._classicTimer -= CLASSIC_UPDATE_INTERVAL;');
  const draw = s.indexOf('const meleePass = attackRollPasses(this.liveSpeed) && this.meleeTimer === 0;');
  const oneShot = s.indexOf("const oneShot = this.machine.state !== 'Idle';");
  const band = s.indexOf('if (this.rangedAttack && ai.inSight && ai.detected && ai.giveUpTimer > 0');
  const gate = s.indexOf('if (!meleePass) continue;');
  assert.ok(draw > 0, 'the draw is the LEFT operand of the && (FixedUpdate :81)');
  assert.ok(band > draw, 'the draw precedes the band arm - the attack component ticks even for a banded bow foe');
  assert.ok(gate > band, 'the gate consumes the ALREADY-DRAWN pass after the band');
  // AUDIT 24 characters-2: and NOTHING stands between the tick and the
  // draw. FixedUpdate's only early return above :81 is the
  // SeducerTransform one-shot; a swing in flight does not hold the byte.
  assert.ok(tick > 0 && draw > tick, 'the draw is inside the classic tick');
  assert.equal(/continue;/.test(s.slice(tick, draw)), false,
    'no early-out sits between the classic tick and the DFRandom draw');
  assert.ok(oneShot > draw, 'the one-shot test is READ after the byte is already drawn');
});

test('c2combat combat-9/10/11: the host wiring sweep', () => {
  const dc = src('src/scenes/dungeonContext.js');
  // combat-9: the whiff + failed-roll miss sounds and the ArrowShoot loose
  assert.ok(dc.includes('audio.play3d(enemyMissSound(wpn)'), 'the dungeon melee rings its misses');
  assert.ok(dc.includes('audio.play3d(SOUND.ArrowShoot, from'), 'the enemy loose rings from the archer');
  assert.equal(SOUND.ArrowShoot, 3);
  // combat-10: the arrow-vs-player arm tallies Dodging like the melee
  const i = dc.indexOf('// C2-slice (AUDIT 23 combat-10)');
  assert.ok(i > 0 && dc.slice(i, i + 400).includes('tallySkill(playerEntity, SKILLS.Dodging, 1)'),
    'an incoming arrow rides ApplyDamageToPlayer - the tally fires');
  // combat-11: the player-side poison hook in all three pools + the arrow
  const pw = src('src/combat/playerWeapon.js');
  assert.ok(pw.includes('onInflictPoison: onPoison ? (att, tgt, pt) => onPoison(foe, pt) : null'),
    'resolveHit threads the hook');
  for (const f of ['src/scenes/dungeonContext.js', 'src/scenes/cityGuards.js', 'src/scenes/exteriorFoes.js']) {
    const t = src(f);
    assert.ok(/resolveHit\([^)]*[\s\S]{0,400}?inflictPoison\((?:f|g)\.entity, pt, false/.test(t),
      `${f}: the player's poisoned blade doses its victim`);
  }
  assert.ok(dc.includes('inflictPoison(f.entity, pt, false'), 'the player ARROW doses its mark too');
  // combat-17: the grunt + pain voice ride all three player-hit paths
  for (const f of ['src/scenes/dungeonContext.js', 'src/scenes/cityGuards.js', 'src/scenes/exteriorFoes.js']) {
    const t = src(f);
    assert.ok(t.includes('playerAttackGrunt(playerEntity, false,'), `${f}: the 20% grunt at the hit frame (X4: each site threads its roll seam)`);
    assert.ok(t.includes('enemyPainVoice(foe'), `${f}: the 40% pain voice on a landed hit`);
    assert.ok(t.includes('enemyAttackVoice('), `${f}: the 20% attack voice at the enemy frame`);
  }
});
