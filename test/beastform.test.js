// V4 - THE BEAST-FORM HOST LAWS, pinned against LycanthropyEffect's
// transformed members: the two suppression texts read VERBATIM from
// the widened sparse clone (Internal_Strings 380/381), the crime and
// population gates, SetFPSWeapon's claws, and OnWeaponHitEntity's
// voice half.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  createLycanthropyCurse, morphSelf, cureLycanthropy,
  racialSuppressInventory, racialSuppressTalk, racialSuppressCrime,
  racialSuppressPopulationSpawns, lycanthropeAttackVoice, racialFpsWeapon,
  WERECLAWS_ITEM, INVENTORY_WHILE_SHAPECHANGED_TEXT, NO_RESPONSE_TEXT,
} from '../src/systems/lycanthropy.js';
import { LYCANTHROPY_TYPES } from '../src/systems/infection.js';
import { setCrimeCommitted, CRIMES } from '../src/systems/court.js';
import { setRacialQuestHost } from '../src/systems/racialQuests.js';
import { weaponTypeForItem, WEAPON_TYPES } from '../src/combat/fpsWeapon.js';
import { swingSoundFor, SOUND } from '../src/systems/soundClips.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const P = () => ({
  isPlayer: true, level: 5, activeEffects: [],
  stats: { strength: 50, agility: 50, endurance: 50, speed: 50, willpower: 50, intelligence: 50, personality: 50, luck: 50 },
  skills: {}, health: 60, maxHealth: 60, items: [], spells: [],
});
const wolf = (type = LYCANTHROPY_TYPES.Werewolf) => {
  const p = P();
  createLycanthropyCurse(p, type, { now: 0 });
  return p;
};

test('V4: the four suppressions live ONLY while transformed, with the two Internal_Strings lines verbatim', () => {
  setRacialQuestHost(null);
  const p = wolf();
  assert.equal(racialSuppressInventory(p), null, 'untransformed: no gate');
  assert.equal(racialSuppressTalk(p), null);
  assert.equal(racialSuppressCrime(p), false);
  assert.equal(racialSuppressPopulationSpawns(p), false);
  morphSelf(p, { force: true, nowMinutes: 10 });
  assert.deepEqual(racialSuppressInventory(p), { text: 'You cannot access the inventory while shapechanged...' });
  assert.deepEqual(racialSuppressTalk(p), { text: 'You get no response.' });
  assert.equal(INVENTORY_WHILE_SHAPECHANGED_TEXT.endsWith('...'), true, 'the ellipsis is the string\'s own');
  assert.equal(NO_RESPONSE_TEXT, 'You get no response.');
  assert.equal(racialSuppressCrime(p), true);
  assert.equal(racialSuppressPopulationSpawns(p), true);
  cureLycanthropy(p, {});
  assert.equal(racialSuppressInventory(P()), null, 'a mortal never gates');
  assert.equal(racialSuppressCrime(p), false, 'the cure lifts everything');
});

test('V4: setCrimeCommitted is the ONE crime write, and a transformed lycanthrope is never tagged', () => {
  const mortal = P();
  assert.equal(setCrimeCommitted(mortal, CRIMES.Assault ?? 4), mortal.crimeCommitted);
  assert.notEqual(mortal.crimeCommitted, 0, 'a mortal is tagged');
  const p = wolf();
  morphSelf(p, { force: true, nowMinutes: 10 });
  setCrimeCommitted(p, CRIMES.Murder ?? 5);
  assert.equal(p.crimeCommitted, 0, 'PlayerEntity.cs:2352 - Crimes.None while suppressed');
  morphSelf(p, { nowMinutes: 2000 });   // morph back (past the once-a-day gate)
  setCrimeCommitted(p, 4);
  assert.equal(p.crimeCommitted, 4, 'back in human form the law returns');
  // and no scene writes the field directly any more
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/cityGuards.js']) {
    assert.ok(!/playerEntity\.crimeCommitted = [^0]/.test(read(f)), `${f} routes through the setter`);
  }
  assert.ok(read('src/systems/talk.js').includes('if (!racialSuppressCrime(player))'),
    'talk.js gates inline (court.js imports it - the one setter would cycle)');
});

test('V4: the population promote arm holds while transformed - the streets empty around the beast', () => {
  const tp = read('src/systems/townPopulation.js');
  assert.ok(tp.includes('suppressSpawns = () => false'), 'the ctor takes the gate');
  assert.ok(tp.includes('isDay && !this.suppressSpawns())'), 'and it holds the PROMOTE arm alone (walkers already out keep walking)');
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.ok(read(f).includes('suppressSpawns: () => racialSuppressPopulationSpawns(playerEntity)'), `${f} wires it`);
  }
});

test('V4: SetFPSWeapon - the transformed rig IS the wereclaws, silent draw, high-pitch swing', () => {
  const p = wolf(LYCANTHROPY_TYPES.Wereboar);
  assert.equal(racialFpsWeapon(p), null, 'untransformed: the hand slot rules');
  morphSelf(p, { force: true, nowMinutes: 10 });
  assert.equal(racialFpsWeapon(p), WERECLAWS_ITEM);
  assert.equal(weaponTypeForItem(WERECLAWS_ITEM), WEAPON_TYPES.Werecreature, 'the WEAPON11.CIF animation set');
  assert.equal(swingSoundFor(WERECLAWS_ITEM), SOUND.SwingHighPitch, 'SetFPSWeapon:339');
  const rig = read('src/combat/weaponRig.js');
  assert.ok(rig.includes('const claws = racialFpsWeapon(entity);'), 'the per-frame sync consults the override');
  assert.ok(rig.includes("!playerWeapon.weapon?.werecreatureClaws) audio.playOneShot(SOUND.DrawWeapon)"),
    'DrawWeaponSound = None (:338) - the claws draw silently');
});

test('V4: the attack voice - 10% attack ELSE 20% bark, strain-keyed, transformed only', () => {
  const w = wolf(LYCANTHROPY_TYPES.Werewolf);
  assert.equal(lycanthropeAttackVoice(w, () => 0), null, 'untransformed: silent');
  morphSelf(w, { force: true, nowMinutes: 10 });
  assert.equal(lycanthropeAttackVoice(w, () => 0.05), SOUND.EnemyWerewolfAttack, 'roll 5 < 10: the attack cry');
  const seq1 = [0.5, 0.1];
  assert.equal(lycanthropeAttackVoice(w, () => seq1.shift()), SOUND.EnemyWerewolfBark, 'miss the 10, land the 20');
  const seq2 = [0.5, 0.5];
  assert.equal(lycanthropeAttackVoice(w, () => seq2.shift()), null, 'miss both: silent - two SEPARATE rolls');
  const b = wolf(LYCANTHROPY_TYPES.Wereboar);
  morphSelf(b, { force: true, nowMinutes: 10 });
  assert.equal(lycanthropeAttackVoice(b, () => 0.05), SOUND.EnemyWereboarAttack, 'the boar\'s own clips');
  assert.equal(SOUND.EnemyWerewolfBark, 143);
  assert.equal(SOUND.EnemyWerewolfAttack, 144);
  assert.equal(SOUND.EnemyWereboarBark, 158);
  assert.equal(SOUND.EnemyWereboarAttack, 159);
  // played beside the grunt at all three player-hit sites
  for (const f of ['src/scenes/exteriorFoes.js', 'src/scenes/cityGuards.js', 'src/scenes/dungeonContext.js']) {
    assert.ok(read(f).includes('lycanthropeAttackVoice(playerEntity'), `${f} plays the voice`);
  }
});

test('V4: the inventory and talk doors refuse the beast - every opener, one gate each', () => {
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = read(f);
    assert.ok(s.includes('racialSuppressInventory(playerEntity)'), `${f} gates toggleInventory`);
  }
  const dc = read('src/scenes/dungeonContext.js');
  assert.ok(dc.includes('racialSuppressInventory(playerEntity)'), 'the dungeon gates INSIDE openInventory - loot included');
  const tt = read('src/scenes/townTalk.js');
  assert.ok(tt.includes('racialSuppressTalk(playerEntity)'), 'townTalk gates at B7\'s ONE window-opener');
  assert.ok(tt.indexOf('racialSuppressTalk(playerEntity)') < tt.indexOf('new NativeTalkWindow('),
    'the refusal comes before any window mounts');
});
